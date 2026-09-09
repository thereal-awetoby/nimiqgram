import type { FastifyInstance } from "fastify";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { consumeChallenge, createChallenge, getChallenge, issueSession, verifySession, verifyWalletSignature } from "./auth.js";
import { config } from "./config.js";
import { pool } from "./db.js";
import { nimToLunas, sendEscrowTransfer, verifyBasicTransfer, verifyTipTransaction } from "./nimiq-rpc.js";

const walletSchema = z.object({ wallet: z.string().min(1).max(128) });
const verifySchema = walletSchema.extend({ signature: z.string().min(1), publicKey: z.string().min(1).optional() });
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(64).optional(), username: z.string().trim().min(1).max(32), bio: z.string().max(280), avatarUrl: z.preprocess((value) => value === '' ? null : value, z.string().url().nullable().optional()), bannerUrl: z.preprocess((value) => value === '' ? null : value, z.string().url().nullable().optional()) });
const postSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  mediaUrl: z.string().url().max(2048).nullable().optional(),
  mediaType: z.string().trim().min(1).max(128).nullable().optional()
}).refine((post) => Boolean(post.mediaUrl) === Boolean(post.mediaType), {
  message: "mediaUrl and mediaType must be provided together"
});
const commentSchema = z.object({ text: z.string().trim().min(1).max(1000), parentCommentId: z.string().uuid().nullable().optional() });
const tipSchema = z.object({ toWallet: walletSchema.shape.wallet, postId: z.string().uuid().optional(), amount: z.coerce.number().positive(), txHash: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "txHash must be a 32-byte hexadecimal transaction hash") });
const notificationReadSchema = z.object({ ids: z.array(z.string().uuid()).optional() });
const redPacketSchema = z.object({
  amount: z.coerce.number().positive().max(100000),
  claimLimit: z.coerce.number().int().min(1).max(1000),
  expiresAt: z.string().datetime()
});
const redPacketFundingSchema = z.object({ txHash: z.string().trim().toLowerCase().regex(/^[0-9a-f]{64}$/) });

function getSession(request: { headers: { authorization?: string } }): { wallet: string } | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }

  return verifySession(authorization.slice(7));
}

function mapPost(row: Record<string, any>) {
  return {
    id: row.id,
    text: row.text,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    createdAt: row.created_at,
    author: {
      wallet: row.author_wallet,
      displayName: row.display_name,
      username: row.username,
      bio: row.bio,
      avatarUrl: row.avatar_url
    },
    likeCount: row.like_count,
    likedByMe: Boolean(row.liked_by_me),
    bookmarkedByMe: Boolean(row.bookmarked_by_me),
    bookmarkCount: row.bookmark_count ?? row.save_count ?? 0,
    commentCount: row.comment_count,
    tipTotal: row.tip_total,
    viewCount: row.view_count ?? 0,
    redPacket: row.red_packet_id ? {
      id: row.red_packet_id,
      amount: row.red_packet_amount,
      remainingAmount: row.red_packet_remaining,
      claimLimit: row.red_packet_claim_limit,
      claimedCount: row.red_packet_claimed_count,
      status: row.red_packet_status,
      expiresAt: row.red_packet_expires_at
    } : null
  };
}

async function recordActivity(wallet: string): Promise<void> {
  const result = await pool.query(`select current_streak, longest_streak, last_activity_date, badges from streaks where wallet = $1`, [wallet]);
  const today = new Date().toISOString().slice(0, 10);
  const row = result.rows[0];
  const lastActivity = row?.last_activity_date instanceof Date ? row.last_activity_date.toISOString().slice(0, 10) : row?.last_activity_date;
  if (lastActivity === today) return;

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentStreak = lastActivity === yesterday ? Number(row.current_streak) + 1 : 1;
  const longestStreak = Math.max(currentStreak, Number(row?.longest_streak ?? 0));
  const badges = new Set<string>(row?.badges ?? []);
  if (currentStreak >= 3) badges.add("three-day-streak");
  if (currentStreak >= 7) badges.add("seven-day-streak");
  if (currentStreak >= 30) badges.add("thirty-day-streak");
  await pool.query(
    `insert into streaks (wallet, current_streak, longest_streak, last_activity_date, badges)
     values ($1, $2, $3, $4, $5)
     on conflict (wallet) do update set current_streak = excluded.current_streak,
       longest_streak = excluded.longest_streak, last_activity_date = excluded.last_activity_date, badges = excluded.badges`,
    [wallet, currentStreak, longestStreak, today, JSON.stringify([...badges])]
  );
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ status: "ok" }));

  app.get("/search", async (request, reply) => {
    const query = request.query as { q?: string };
    const term = query.q?.trim();
    if (!term) return { people: [], posts: [] };
    if (term.length > 80) return reply.badRequest("search query is too long");
    const pattern = `%${term}%`;
    const [people, posts] = await Promise.all([
      pool.query(
        `select wallet, display_name, username, bio, avatar_url
         from users
         where display_name ilike $1 or username ilike $1 or wallet ilike $1
         order by username nulls last, created_at desc limit 20`,
        [pattern]
      ),
      pool.query(
        `select p.id, p.text, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.avatar_url
         from posts p join users u on u.wallet = p.author_wallet
         where p.text ilike $1
         order by p.created_at desc limit 30`,
        [pattern]
      )
    ]);
    return {
      people: people.rows.map((row: Record<string, any>) => ({ wallet: row.wallet, displayName: row.display_name, username: row.username, bio: row.bio, avatarUrl: row.avatar_url })),
      posts: posts.rows.map((row: Record<string, any>) => ({ id: row.id, text: row.text, createdAt: row.created_at, author: { wallet: row.author_wallet, displayName: row.display_name, username: row.username, avatarUrl: row.avatar_url } }))
    };
  });

  app.post("/auth/challenge", async (request, reply) => {
    const result = walletSchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest("wallet is required");
    }

    const challenge = createChallenge(result.data.wallet);
    return { message: challenge.message, expiresAt: challenge.expiresAt };
  });

  app.post("/auth/verify", async (request, reply) => {
    const result = verifySchema.safeParse(request.body);
    if (!result.success) {
      return reply.badRequest("wallet and signature are required");
    }

    const challenge = getChallenge(result.data.wallet);
    const verifiedWallet = challenge ? await verifyWalletSignature(challenge, result.data) : undefined;
    if (!verifiedWallet) {
      return reply.unauthorized("invalid or expired wallet signature");
    }
    consumeChallenge(result.data.wallet);
    await pool.query(
      `insert into users (wallet) values ($1) on conflict (wallet) do nothing`,
      [verifiedWallet]
    );

    return {
      token: issueSession({ wallet: verifiedWallet, username: null }),
      user: { wallet: verifiedWallet, username: null }
    };
  });

  app.get("/profile/:wallet", async (request, reply) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select u.wallet, u.display_name, u.username, u.bio, u.avatar_url,
              u.banner_url, coalesce(s.badges, '[]'::jsonb) as badges,
              coalesce(s.current_streak, 0) as streak
       from users u left join streaks s on s.wallet = u.wallet where u.wallet = $1`,
      [params.wallet]
    );
    if (result.rowCount === 0) {
      return reply.notFound("profile not found");
    }
    const row = result.rows[0];
    return { wallet: row.wallet, displayName: row.display_name, username: row.username, bio: row.bio, avatarUrl: row.avatar_url, bannerUrl: row.banner_url, badges: row.badges, streak: row.streak };
  });

  app.get("/users/:wallet/posts", async (request) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
            `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.avatar_url,
              rp.id as red_packet_id, rp.total_amount_nim::text as red_packet_amount, rp.remaining_amount_nim::text as red_packet_remaining,
              rp.claim_limit as red_packet_claim_limit, rp.claimed_count as red_packet_claimed_count, rp.status as red_packet_status, rp.expires_at as red_packet_expires_at,
              (select count(*)::int from likes l where l.post_id = p.id) as like_count,
              (select count(*)::int from comments c where c.post_id = p.id) as comment_count,
              (select count(*)::int from bookmarks b where b.post_id = p.id) as bookmark_count,
              (select coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text from tips t where t.post_id = p.id) as tip_total,
              (select count(*)::int from post_views v where v.post_id = p.id) as view_count
             from posts p join users u on u.wallet = p.author_wallet left join red_packets rp on rp.post_id = p.id
             where p.author_wallet = $1 order by p.created_at desc limit 50`,
      [params.wallet]
    );
    return { posts: result.rows.map(mapPost) };
  });

  app.get("/users/:wallet/likes", async (request) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.avatar_url,
          rp.id as red_packet_id, rp.total_amount_nim::text as red_packet_amount, rp.remaining_amount_nim::text as red_packet_remaining,
          rp.claim_limit as red_packet_claim_limit, rp.claimed_count as red_packet_claimed_count, rp.status as red_packet_status, rp.expires_at as red_packet_expires_at,
          (select count(*)::int from likes l2 where l2.post_id = p.id) as like_count,
          (select count(*)::int from comments c where c.post_id = p.id) as comment_count,
          (select count(*)::int from bookmarks b2 where b2.post_id = p.id) as bookmark_count,
          (select coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text from tips t where t.post_id = p.id) as tip_total,
          (select count(*)::int from post_views v where v.post_id = p.id) as view_count
       from likes l join posts p on p.id = l.post_id join users u on u.wallet = p.author_wallet left join red_packets rp on rp.post_id = p.id
       where l.wallet = $1 order by l.created_at desc limit 50`,
      [params.wallet]
    );
    return { posts: result.rows.map(mapPost) };
  });

  app.get("/users/:wallet/tip-activity", async (request) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select t.id,
              t.amount_nim::text as amount,
              t.status,
              t.created_at,
              t.to_wallet,
              t.from_wallet,
              case when t.to_wallet = $1 then 'received' else 'sent' end as kind,
              u_to.display_name as to_display_name,
              u_to.username as to_username,
              u_from.display_name as from_display_name,
              u_from.username as from_username,
              coalesce(u_to.wallet, t.to_wallet) as counterparty_wallet,
              coalesce(u_from.wallet, t.from_wallet) as counterpart_from_wallet
       from tips t
       left join users u_to on u_to.wallet = t.to_wallet
       left join users u_from on u_from.wallet = t.from_wallet
       where t.from_wallet = $1 or t.to_wallet = $1
       order by t.created_at desc limit 50`,
      [params.wallet]
    );
    return { tips: result.rows };
  });

  app.get("/users/:wallet/bookmarks", async (request, reply) => {
    const session = getSession(request);
    const params = request.params as { wallet: string };
    if (!session || session.wallet !== params.wallet) return reply.unauthorized();
    const result = await pool.query(
      `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.avatar_url,
          rp.id as red_packet_id, rp.total_amount_nim::text as red_packet_amount, rp.remaining_amount_nim::text as red_packet_remaining,
          rp.claim_limit as red_packet_claim_limit, rp.claimed_count as red_packet_claimed_count, rp.status as red_packet_status, rp.expires_at as red_packet_expires_at,
          (select count(*)::int from likes l where l.post_id = p.id) as like_count,
          (select count(*)::int from comments c where c.post_id = p.id) as comment_count,
          (select count(*)::int from bookmarks b2 where b2.post_id = p.id) as bookmark_count,
          (select coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text from tips t where t.post_id = p.id) as tip_total,
          (select count(*)::int from post_views v where v.post_id = p.id) as view_count
       from bookmarks b join posts p on p.id = b.post_id join users u on u.wallet = p.author_wallet left join red_packets rp on rp.post_id = p.id
       where b.wallet = $1 order by b.created_at desc`,
      [params.wallet]
    );
    return {
      count: result.rows.length,
      posts: result.rows.map(mapPost)
    };
  });

  app.get("/users/:wallet/following", async (request, reply) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select u.wallet, u.display_name, u.username, u.bio, u.avatar_url
       from follows f join users u on u.wallet = f.followed_wallet
       where f.follower_wallet = $1 order by f.created_at desc`,
      [params.wallet]
    );
    return { users: result.rows.map((row: Record<string, any>) => ({ wallet: row.wallet, displayName: row.display_name, username: row.username, bio: row.bio, avatarUrl: row.avatar_url })) };
  });

  app.get("/users/:wallet/followers", async (request, reply) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select u.wallet, u.display_name, u.username, u.bio, u.avatar_url
       from follows f join users u on u.wallet = f.follower_wallet
       where f.followed_wallet = $1 order by f.created_at desc`,
      [params.wallet]
    );
    return { users: result.rows.map((row: Record<string, any>) => ({ wallet: row.wallet, displayName: row.display_name, username: row.username, bio: row.bio, avatarUrl: row.avatar_url })) };
  });

  app.get("/users/:wallet/follow-status", async (request) => {
    const session = getSession(request);
    const params = request.params as { wallet: string };
    if (!session || session.wallet === params.wallet) return { following: false };
    const result = await pool.query(
      `select exists(select 1 from follows where follower_wallet = $1 and followed_wallet = $2) as following`,
      [session.wallet, params.wallet]
    );
    return { following: Boolean(result.rows[0]?.following) };
  });

  app.post("/users/:wallet/follow", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { wallet: string };
    if (params.wallet === session.wallet) return reply.badRequest("cannot follow yourself");
    const user = await pool.query(`select wallet from users where wallet = $1`, [params.wallet]);
    if (user.rowCount === 0) return reply.notFound("user not found");
    await pool.query(
      `insert into follows (follower_wallet, followed_wallet) values ($1, $2) on conflict do nothing`,
      [session.wallet, params.wallet]
    );
    return { following: true, wallet: params.wallet };
  });

  app.post("/posts/:id/bookmark", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    await pool.query(`insert into bookmarks (wallet, post_id) values ($1, $2) on conflict do nothing`, [session.wallet, params.id]);
    return { bookmarked: true };
  });

  app.get("/posts/:id/bookmark", async (request) => {
    const session = getSession(request);
    if (!session) return { bookmarked: false };
    const params = request.params as { id: string };
    const result = await pool.query(`select exists(select 1 from bookmarks where wallet = $1 and post_id = $2) as bookmarked`, [session.wallet, params.id]);
    return { bookmarked: Boolean(result.rows[0]?.bookmarked) };
  });

  app.delete("/posts/:id/bookmark", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    await pool.query(`delete from bookmarks where wallet = $1 and post_id = $2`, [session.wallet, params.id]);
    return { bookmarked: false };
  });

  app.delete("/users/:wallet/follow", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { wallet: string };
    await pool.query(`delete from follows where follower_wallet = $1 and followed_wallet = $2`, [session.wallet, params.wallet]);
    return { following: false, wallet: params.wallet };
  });

  app.put("/profile", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const body = profileSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const result = await pool.query(
      `update users set display_name = $1, username = $2, bio = $3, avatar_url = $4, banner_url = $5, updated_at = now()
       where wallet = $6 returning wallet, display_name as "displayName", username, bio, avatar_url as "avatarUrl", banner_url as "bannerUrl"`,
      [body.data.displayName ?? body.data.username, body.data.username, body.data.bio, body.data.avatarUrl ?? null, body.data.bannerUrl ?? null, session.wallet]
    );
    return result.rows[0];
  });

  app.get("/feed", async (request) => {
    const query = request.query as { cursor?: string; scope?: string };
    const cursor = query.cursor ? new Date(query.cursor) : new Date();
    const scope = query.scope === "following" ? "following" : "all";
    const session = getSession(request);
    const viewerWallet = session?.wallet ?? null;
    if (scope === "following" && session) {
      const followingCount = await pool.query(
        `select count(*)::int as count from follows where follower_wallet = $1`,
        [session.wallet]
      );

      if (Number(followingCount.rows[0]?.count ?? 0) === 0) {
        return { posts: [], nextCursor: null };
      }
    }

    const result = await pool.query(
      `with post_stats as (
         select
           p.id,
           p.author_wallet,
           p.text,
           p.media_url,
           p.media_type,
           p.created_at,
           u.display_name,
           u.username,
           u.bio,
           u.avatar_url,
           rp.id as red_packet_id,
           rp.total_amount_nim::text as red_packet_amount,
           rp.remaining_amount_nim::text as red_packet_remaining,
           rp.claim_limit as red_packet_claim_limit,
           rp.claimed_count as red_packet_claimed_count,
           rp.status as red_packet_status,
           rp.expires_at as red_packet_expires_at,
           count(distinct l.wallet)::int as like_count,
           count(distinct c.id)::int as comment_count,
           count(distinct b.wallet)::int as save_count,
           coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::numeric as verified_tip_total,
           count(distinct t.id) filter (where t.status = 'verified')::int as verified_tip_count,
           coalesce((select s.current_streak from streaks s where s.wallet = p.author_wallet), 0) as streak,
           coalesce((select s.longest_streak from streaks s where s.wallet = p.author_wallet), 0) as longest_streak
         from posts p
         join users u on u.wallet = p.author_wallet
         left join red_packets rp on rp.post_id = p.id
         left join likes l on l.post_id = p.id
         left join comments c on c.post_id = p.id
         left join bookmarks b on b.post_id = p.id
         left join tips t on t.post_id = p.id
         where p.created_at < $1
           and ($3 = 'all' or p.author_wallet in (select followed_wallet from follows where follower_wallet = $2))
         group by p.id, u.wallet, rp.id
       ),
       scored as (
         select
           ps.*, 
           case
             when $2 is null then 0.15
             when ps.author_wallet = $2 then 1.0
             when exists (select 1 from follows f where f.follower_wallet = $2 and f.followed_wallet = ps.author_wallet) then 1.0
             else 0.25
           end as follow_boost,
           (
             ln(1 + ps.verified_tip_count)
             + 0.5 * ln(1 + ps.verified_tip_total)
           ) as tip_score,
           (
             2 * ps.like_count + 5 * ps.comment_count + 6 * ps.save_count
           ) as engagement_score,
           exp(-((extract(epoch from (now() - ps.created_at)) / 3600) / 18)) as recency_score,
           (
             0.3 + 0.7 * least(ps.streak / 30.0, 1.0)
           ) as creator_score
         from post_stats ps
       )
       select
         id,
         author_wallet,
         text,
         media_url,
         media_type,
         created_at,
         display_name,
         username,
         bio,
         avatar_url,
         like_count,
         comment_count,
         save_count,
         verified_tip_total as tip_total,
         verified_tip_count,
         streak,
         (
           35 * follow_boost +
           25 * tip_score +
           20 * least(engagement_score, 100) +
           12 * recency_score +
           8 * creator_score
         ) as feed_score,
         exists(select 1 from likes l2 where l2.post_id = id and l2.wallet = $2) as liked_by_me,
         exists(select 1 from bookmarks b2 where b2.post_id = id and b2.wallet = $2) as bookmarked_by_me,
         (select count(*)::int from post_views v where v.post_id = id) as view_count
       from scored
       where created_at >= now() - interval '30 days'
      order by (case when author_wallet = $2 then 1 else 0 end) desc, feed_score desc, created_at desc
       limit 21`,
      [cursor, viewerWallet, scope]
    );
    const hasMore = result.rows.length > 20;
    const rows = hasMore ? result.rows.slice(0, 20) : result.rows;
    return { posts: rows.map(mapPost), nextCursor: hasMore ? rows.at(-1).created_at.toISOString() : null };
  });

  app.post("/posts", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const body = postSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const result = await pool.query(
      `insert into posts (author_wallet, text, media_url, media_type) values ($1, $2, $3, $4) returning id, text, media_url, media_type, created_at`,
      [session.wallet, body.data.text, body.data.mediaUrl ?? null, body.data.mediaType ?? null]
    );
    await recordActivity(session.wallet);
    return reply.code(201).send({ id: result.rows[0].id, text: result.rows[0].text, mediaUrl: result.rows[0].media_url, mediaType: result.rows[0].media_type, createdAt: result.rows[0].created_at });
  });

  app.post("/red-packets", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    if (!config.RED_PACKET_ESCROW_ADDRESS) return reply.serviceUnavailable("red packet escrow is not configured");
    const body = redPacketSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest("amount, claimLimit, and a valid expiresAt are required");
    const expiry = new Date(body.data.expiresAt);
    if (expiry <= new Date()) return reply.badRequest("expiresAt must be in the future");
    const result = await pool.query(
      `insert into red_packets (creator_wallet, escrow_address, total_amount_nim, remaining_amount_nim, claim_limit, expires_at)
       values ($1, $2, $3, $3, $4, $5) returning id, total_amount_nim::text as amount, claim_limit, expires_at`,
      [session.wallet, config.RED_PACKET_ESCROW_ADDRESS, body.data.amount, body.data.claimLimit, expiry]
    );
    return reply.code(201).send({ ...result.rows[0], escrowAddress: config.RED_PACKET_ESCROW_ADDRESS });
  });

  app.post("/red-packets/:id/fund", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const body = redPacketFundingSchema.safeParse(request.body);
    if (!body.success) return reply.badRequest("txHash is required");
    const packet = await pool.query(`select * from red_packets where id = $1 and creator_wallet = $2`, [params.id, session.wallet]);
    if (packet.rowCount === 0) return reply.notFound("red packet not found");
    const row = packet.rows[0];
    if (row.status !== "draft") return reply.badRequest("red packet is already funded or closed");
    const verified = await verifyBasicTransfer(body.data.txHash, session.wallet, row.escrow_address, row.total_amount_nim);
    if (!verified) return reply.badRequest("funding transaction could not be verified");
    const post = await pool.query(
      `insert into posts (author_wallet, text) values ($1, $2) returning id, text, created_at`,
      [session.wallet, `Red packet: ${row.total_amount_nim} NIM for ${row.claim_limit} people`]
    );
    await pool.query(
      `update red_packets set status = 'active', funding_tx_hash = $1, post_id = $2 where id = $3`,
      [body.data.txHash, post.rows[0].id, params.id]
    );
    return reply.code(201).send({ packetId: params.id, postId: post.rows[0].id, status: "active" });
  });

  app.post("/red-packets/:id/claim", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const client = await pool.connect();
    let claimId: string | undefined;
    let amount: string | undefined;
    try {
      await client.query("begin");
      const result = await client.query(`select * from red_packets where id = $1 for update`, [params.id]);
      if (result.rowCount === 0) { await client.query("rollback"); return reply.notFound("red packet not found"); }
      const packet = result.rows[0];
      if (packet.status !== "active" || new Date(packet.expires_at) <= new Date()) {
        await client.query(`update red_packets set status = 'expired' where id = $1 and status = 'active'`, [params.id]);
        await client.query("commit");
        return reply.badRequest("red packet is expired or closed");
      }
      if (Number(packet.claimed_count) >= Number(packet.claim_limit) || Number(packet.remaining_amount_nim) <= 0) {
        await client.query(`update red_packets set status = 'closed' where id = $1`, [params.id]);
        await client.query("commit");
        return reply.badRequest("red packet has no claims remaining");
      }
      const existing = await client.query(`select id, amount_nim::text as amount, status from red_packet_claims where packet_id = $1 and wallet = $2`, [params.id, session.wallet]);
      if (existing.rowCount && existing.rows[0].status !== "failed") { await client.query("rollback"); return reply.conflict("you already claimed this red packet"); }
      if (existing.rowCount) await client.query(`delete from red_packet_claims where id = $1`, [existing.rows[0].id]);
      const claimsLeft = Number(packet.claim_limit) - Number(packet.claimed_count);
      const remainingLunas = nimToLunas(String(packet.remaining_amount_nim));
      const maxShare = claimsLeft === 1 ? remainingLunas : remainingLunas / BigInt(claimsLeft) * 2n;
      const shareLunas = claimsLeft === 1 ? remainingLunas : BigInt(randomInt(1, Number(maxShare) + 1));
      amount = (Number(shareLunas) / 100000).toFixed(5).replace(/0+$/, "").replace(/\.$/, "");
      const claim = await client.query(
        `insert into red_packet_claims (packet_id, wallet, amount_nim) values ($1, $2, $3) returning id`,
        [params.id, session.wallet, amount]
      );
      claimId = claim.rows[0].id;
      const remaining = remainingLunas - shareLunas;
      const nextStatus = claimsLeft === 1 ? "closed" : "active";
      await client.query(
        `update red_packets set remaining_amount_nim = $1, claimed_count = claimed_count + 1, status = $2 where id = $3`,
        [(Number(remaining) / 100000).toFixed(5), nextStatus, params.id]
      );
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
    try {
      const payoutTxHash = await sendEscrowTransfer(session.wallet, amount!);
      await pool.query(`update red_packet_claims set status = 'paid', payout_tx_hash = $1 where id = $2`, [payoutTxHash, claimId]);
      const packet = await pool.query(`select remaining_amount_nim::text as "remainingAmount", claimed_count as "claimedCount", status from red_packets where id = $1`, [params.id]);
      return { status: "paid", amount, payoutTxHash, ...packet.rows[0] };
    } catch (error) {
      await pool.query("begin");
      try {
        await pool.query(`update red_packet_claims set status = 'failed' where id = $1`, [claimId]);
        await pool.query(
          `update red_packets set remaining_amount_nim = remaining_amount_nim + $1, claimed_count = claimed_count - 1, status = 'active' where id = $2`,
          [amount, params.id]
        );
        await pool.query("commit");
      } catch (rollbackError) {
        await pool.query("rollback");
        console.error("Failed to restore red packet after payout failure", rollbackError);
      }
      return reply.code(503).send({ error: "payout is temporarily unavailable", claimId });
    }
  });

  app.post("/red-packets/:id/refund", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const packet = await pool.query(`select * from red_packets where id = $1 and creator_wallet = $2`, [params.id, session.wallet]);
    if (packet.rowCount === 0) return reply.notFound("red packet not found");
    const row = packet.rows[0];
    if (new Date(row.expires_at) > new Date() || Number(row.remaining_amount_nim) <= 0) return reply.badRequest("packet is not refundable yet");
    const txHash = await sendEscrowTransfer(session.wallet, row.remaining_amount_nim);
    await pool.query(`update red_packets set remaining_amount_nim = 0, status = 'closed' where id = $1`, [params.id]);
    return { status: "refunded", txHash };
  });

  app.get("/posts/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const session = getSession(request);
    const viewerWallet = session?.wallet ?? "__anonymous__";
    const result = await pool.query(
      `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.bio, u.avatar_url,
              rp.id as red_packet_id, rp.total_amount_nim::text as red_packet_amount, rp.remaining_amount_nim::text as red_packet_remaining,
              rp.claim_limit as red_packet_claim_limit, rp.claimed_count as red_packet_claimed_count, rp.status as red_packet_status, rp.expires_at as red_packet_expires_at,
              count(distinct l.wallet)::int as like_count, count(distinct c.id)::int as comment_count,
              count(distinct b.wallet)::int as bookmark_count,
              coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text as tip_total,
              count(distinct v.viewer_wallet)::int as view_count,
              exists(select 1 from likes l2 where l2.post_id = p.id and l2.wallet = $2) as liked_by_me,
              exists(select 1 from bookmarks b2 where b2.post_id = p.id and b2.wallet = $2) as bookmarked_by_me
       from posts p join users u on u.wallet = p.author_wallet
       left join likes l on l.post_id = p.id
       left join comments c on c.post_id = p.id
      left join bookmarks b on b.post_id = p.id
      left join red_packets rp on rp.post_id = p.id
       left join tips t on t.post_id = p.id
       left join post_views v on v.post_id = p.id
      where p.id = $1 group by p.id, u.wallet, rp.id`,
      [params.id, viewerWallet]
    );
    if (result.rowCount === 0) return reply.notFound("post not found");
    const comments = await pool.query(
      `select c.id, c.text, c.created_at, c.parent_comment_id, c.author_wallet, u.username,
              count(distinct cl.wallet)::int as like_count,
              exists(select 1 from comment_likes cl2 where cl2.comment_id = c.id and cl2.wallet = $2) as liked_by_me
       from comments c
       join users u on u.wallet = c.author_wallet
       left join comment_likes cl on cl.comment_id = c.id
       where c.post_id = $1
       group by c.id, u.username
       order by c.created_at asc`,
      [params.id, viewerWallet]
    );
    return { ...mapPost(result.rows[0]), comments: comments.rows.map((row: Record<string, any>) => ({ id: row.id, text: row.text, createdAt: row.created_at, parentCommentId: row.parent_comment_id, likeCount: row.like_count, likedByMe: Boolean(row.liked_by_me), author: { wallet: row.author_wallet, username: row.username } })) };
  });

  app.post("/posts/:id/like", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const post = await pool.query(`select author_wallet from posts where id = $1`, [params.id]);
    if (post.rowCount === 0) return reply.notFound("post not found");

    const existing = await pool.query(`delete from likes where post_id = $1 and wallet = $2 returning post_id`, [params.id, session.wallet]);
    const liked = existing.rowCount === 0;
    if (liked) {
      await pool.query(`insert into likes (post_id, wallet) values ($1, $2)`, [params.id, session.wallet]);
      await recordActivity(session.wallet);
      if (post.rows[0].author_wallet !== session.wallet) {
        await pool.query(
          `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'like', $3)`,
          [post.rows[0].author_wallet, session.wallet, params.id]
        );
      }
    }
    const count = await pool.query(`select count(*)::int as count from likes where post_id = $1`, [params.id]);
    return { liked, likeCount: count.rows[0].count, likedByMe: liked };
  });

  app.post("/comments/:id/like", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const comment = await pool.query(`select id from comments where id = $1`, [params.id]);
    if (comment.rowCount === 0) return reply.notFound("comment not found");

    const existing = await pool.query(
      `delete from comment_likes where comment_id = $1 and wallet = $2 returning comment_id`,
      [params.id, session.wallet]
    );
    const liked = existing.rowCount === 0;
    if (liked) {
      await pool.query(`insert into comment_likes (comment_id, wallet) values ($1, $2)`, [params.id, session.wallet]);
    }
    const count = await pool.query(`select count(*)::int as count from comment_likes where comment_id = $1`, [params.id]);
    return { liked, likeCount: count.rows[0].count, likedByMe: liked };
  });

  app.post("/posts/:id/view", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const post = await pool.query(`select id from posts where id = $1`, [params.id]);
    if (post.rowCount === 0) return reply.notFound("post not found");

    await pool.query(
      `insert into post_views (post_id, viewer_wallet) values ($1, $2) on conflict do nothing`,
      [params.id, session.wallet]
    );
    const count = await pool.query(`select count(*)::int as count from post_views where post_id = $1`, [params.id]);
    return { viewed: true, viewCount: count.rows[0].count };
  });

  app.post("/posts/:id/comment", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const body = commentSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const post = await pool.query(`select author_wallet from posts where id = $1`, [params.id]);
    if (post.rowCount === 0) return reply.notFound("post not found");
    if (body.data.parentCommentId) {
      const parent = await pool.query(`select id from comments where id = $1 and post_id = $2`, [body.data.parentCommentId, params.id]);
      if (parent.rowCount === 0) return reply.badRequest("parent comment not found on this post");
    }
    const result = await pool.query(
      `insert into comments (post_id, author_wallet, text, parent_comment_id) values ($1, $2, $3, $4) returning id, text, created_at, parent_comment_id`,
      [params.id, session.wallet, body.data.text, body.data.parentCommentId ?? null]
    );
    if (post.rows[0].author_wallet !== session.wallet) {
      await pool.query(
        `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'comment', $3)`,
        [post.rows[0].author_wallet, session.wallet, params.id]
      );
    }
    await recordActivity(session.wallet);
    const author = await pool.query(
      `select wallet, display_name, username, avatar_url from users where wallet = $1`,
      [session.wallet]
    );
    const authorRow = author.rows[0];
    return reply.code(201).send({
      id: result.rows[0].id,
      text: result.rows[0].text,
      createdAt: result.rows[0].created_at,
      parentCommentId: result.rows[0].parent_comment_id,
      likeCount: 0,
      likedByMe: false,
      author: {
        wallet: authorRow.wallet,
        displayName: authorRow.display_name,
        username: authorRow.username,
        avatarUrl: authorRow.avatar_url
      }
    });
  });

  app.post("/tips", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const body = tipSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (body.data.toWallet === session.wallet) return reply.badRequest("cannot tip yourself");
    const recipient = await pool.query(`select wallet from users where wallet = $1`, [body.data.toWallet]);
    if (recipient.rowCount === 0) return reply.notFound("recipient not found");
    if (body.data.postId) {
      const post = await pool.query(`select id from posts where id = $1`, [body.data.postId]);
      if (post.rowCount === 0) return reply.notFound("post not found");
    }
    const amount = body.data.amount.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    const verified = await verifyTipTransaction({
      txHash: body.data.txHash,
      fromWallet: session.wallet,
      toWallet: body.data.toWallet,
      amountNim: amount
    });
    const status = verified ? "verified" : "pending";
    const result = await pool.query(
      `insert into tips (from_wallet, to_wallet, post_id, amount_nim, tx_hash, status, verified_at) values ($1, $2, $3, $4, $5, $6, case when $6 = 'verified' then now() else null end)
       returning id, from_wallet, to_wallet, post_id, amount_nim::text as amount, tx_hash, status, created_at`,
      [session.wallet, body.data.toWallet, body.data.postId ?? null, body.data.amount, body.data.txHash, status]
    );
    await pool.query(
      `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'tip', $3)`,
      [body.data.toWallet, session.wallet, body.data.postId ?? null]
    );
    return reply.code(verified ? 201 : 202).send({ ...result.rows[0], message: verified ? "Tip verified on-chain" : "Tip recorded and awaiting on-chain verification" });
  });

  app.post("/tips/:id/verify", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const tip = await pool.query(`select id, from_wallet, to_wallet, post_id, amount_nim::text as amount, tx_hash, status from tips where id = $1`, [params.id]);
    if (tip.rowCount === 0) return reply.notFound("tip not found");
    if (tip.rows[0].from_wallet !== session.wallet && tip.rows[0].to_wallet !== session.wallet) return reply.forbidden();
    if (tip.rows[0].status === "verified") return tip.rows[0];
    if (!/^[0-9a-f]{64}$/.test(tip.rows[0].tx_hash.trim().replace(/^0x/i, "").toLowerCase())) {
      return reply.send({ ...tip.rows[0], status: "invalid", message: "tip has an invalid transaction hash" });
    }
    const verified = await verifyTipTransaction({
      txHash: tip.rows[0].tx_hash,
      fromWallet: tip.rows[0].from_wallet,
      toWallet: tip.rows[0].to_wallet,
      amountNim: tip.rows[0].amount
    });
    if (!verified) return reply.code(202).send({ ...tip.rows[0], message: "Tip is not visible as a matching on-chain transaction yet" });
    const result = await pool.query(`update tips set status = 'verified', verified_at = now() where id = $1 returning id, from_wallet, to_wallet, post_id, amount_nim::text as amount, tx_hash, status, verified_at`, [params.id]);
    return result.rows[0];
  });

  app.get("/tips/leaderboard", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range === "weekly" ? "weekly" : query.range === "daily" ? "daily" : undefined;
    if (!range) return reply.code(400).send({ error: "range must be daily or weekly" });
    const interval = range === "daily" ? "1 day" : "7 days";
    const [tippers, earners, streakers] = await Promise.all([
      pool.query(
        `select from_wallet as wallet, coalesce(u.username, from_wallet) as username, sum(amount_nim)::text as amount, count(*)::int as tips
         from tips t left join users u on u.wallet = t.from_wallet where t.status = 'verified' and t.created_at >= now() - $1::interval
         group by from_wallet, u.username order by sum(amount_nim) desc limit 20`, [interval]
      ),
      pool.query(
        `select to_wallet as wallet, coalesce(u.username, to_wallet) as username, sum(amount_nim)::text as amount, count(*)::int as tips
         from tips t left join users u on u.wallet = t.to_wallet where t.status = 'verified' and t.created_at >= now() - $1::interval
         group by to_wallet, u.username order by sum(amount_nim) desc limit 20`, [interval]
      ),
      pool.query(
        `select s.wallet, coalesce(u.username, s.wallet) as username, s.current_streak as streak
         from streaks s join users u on u.wallet = s.wallet
         where s.current_streak > 0 order by s.current_streak desc, s.longest_streak desc limit 20`
      )
    ]);
    return { range, topTippers: tippers.rows, topEarners: earners.rows, topStreakers: streakers.rows };
  });

  app.get("/notifications", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const result = await pool.query(
      `select n.id, n.type, n.post_id as "postId", n.read_at as "readAt", n.created_at as "createdAt",
              n.actor_wallet as "actorWallet", u.username as "actorUsername"
       from notifications n join users u on u.wallet = n.actor_wallet
       where n.recipient_wallet = $1 order by n.created_at desc limit 100`, [session.wallet]
    );
    return { notifications: result.rows };
  });

  app.post("/notifications/read", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const body = notificationReadSchema.safeParse(request.body ?? {});
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    if (body.data.ids?.length) {
      await pool.query(`update notifications set read_at = now() where recipient_wallet = $1 and id = any($2::uuid[])`, [session.wallet, body.data.ids]);
    } else {
      await pool.query(`update notifications set read_at = now() where recipient_wallet = $1 and read_at is null`, [session.wallet]);
    }
    return { markedRead: body.data.ids?.length ?? "all" };
  });

  app.get("/streaks/:wallet", async (request, reply) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(`select current_streak as "currentStreak", longest_streak as "longestStreak", badges from streaks where wallet = $1`, [params.wallet]);
    return result.rows[0] ?? { currentStreak: 0, longestStreak: 0, badges: [] };
  });
}