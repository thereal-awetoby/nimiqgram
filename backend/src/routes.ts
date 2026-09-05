import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { consumeChallenge, createChallenge, getChallenge, issueSession, verifySession, verifyWalletSignature } from "./auth.js";
import { pool } from "./db.js";
import { verifyTipTransaction } from "./nimiq-rpc.js";

const walletSchema = z.object({ wallet: z.string().min(1).max(128) });
const verifySchema = walletSchema.extend({ signature: z.string().min(1), publicKey: z.string().min(1).optional() });
const profileSchema = z.object({ displayName: z.string().trim().min(1).max(64).optional(), username: z.string().trim().min(1).max(32), bio: z.string().max(280), avatarUrl: z.string().url().nullable().optional() });
const postSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  mediaUrl: z.string().url().max(2048).nullable().optional(),
  mediaType: z.string().trim().min(1).max(128).nullable().optional()
}).refine((post) => Boolean(post.mediaUrl) === Boolean(post.mediaType), {
  message: "mediaUrl and mediaType must be provided together"
});
const commentSchema = z.object({ text: z.string().trim().min(1).max(1000) });
const tipSchema = z.object({ toWallet: walletSchema.shape.wallet, postId: z.string().uuid().optional(), amount: z.coerce.number().positive(), txHash: z.string().min(1).max(256) });
const notificationReadSchema = z.object({ ids: z.array(z.string().uuid()).optional() });

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
    commentCount: row.comment_count,
    tipTotal: row.tip_total,
    viewCount: row.view_count ?? 0
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
    if (!challenge || !(await verifyWalletSignature(challenge, result.data))) {
      return reply.unauthorized("invalid or expired wallet signature");
    }
    consumeChallenge(result.data.wallet);
    await pool.query(
      `insert into users (wallet) values ($1) on conflict (wallet) do nothing`,
      [result.data.wallet]
    );

    return {
      token: issueSession({ wallet: result.data.wallet, username: null }),
      user: { wallet: result.data.wallet, username: null }
    };
  });

  app.get("/profile/:wallet", async (request, reply) => {
    const params = request.params as { wallet: string };
    const result = await pool.query(
      `select u.wallet, u.username, u.bio, u.avatar_url,
              coalesce(s.badges, '[]'::jsonb) as badges,
              coalesce(s.current_streak, 0) as streak
       from users u left join streaks s on s.wallet = u.wallet where u.wallet = $1`,
      [params.wallet]
    );
    if (result.rowCount === 0) {
      return reply.notFound("profile not found");
    }
    const row = result.rows[0];
    return { wallet: row.wallet, displayName: row.display_name, username: row.username, bio: row.bio, avatarUrl: row.avatar_url, badges: row.badges, streak: row.streak };
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
      `update users set display_name = $1, username = $2, bio = $3, avatar_url = $4, updated_at = now()
       where wallet = $5 returning wallet, display_name as "displayName", username, bio, avatar_url as "avatarUrl"`,
      [body.data.displayName ?? body.data.username, body.data.username, body.data.bio, body.data.avatarUrl ?? null, session.wallet]
    );
    return result.rows[0];
  });

  app.get("/feed", async (request) => {
    const query = request.query as { cursor?: string; scope?: string };
    const cursor = query.cursor ? new Date(query.cursor) : new Date();
    const scope = query.scope === "following" ? "following" : "all";
    const session = getSession(request);
    const viewerWallet = session?.wallet ?? "__anonymous__";
    const followingWallet = session?.wallet ?? "__anonymous__";
    const result = await pool.query(
            `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name,
              u.username,
              u.bio, u.avatar_url,
              count(distinct l.wallet)::int as like_count,
              count(distinct c.id)::int as comment_count,
              coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text as tip_total,
              count(distinct v.viewer_wallet)::int as view_count,
              exists(select 1 from likes l2 where l2.post_id = p.id and l2.wallet = $2) as liked_by_me
       from posts p join users u on u.wallet = p.author_wallet
       left join likes l on l.post_id = p.id
       left join comments c on c.post_id = p.id
       left join tips t on t.post_id = p.id
       left join post_views v on v.post_id = p.id
       where p.created_at < $1
         and ($4 = 'all' or p.author_wallet in (select followed_wallet from follows where follower_wallet = $3))
       group by p.id, u.wallet order by p.created_at desc limit 21`,
      [cursor, viewerWallet, followingWallet, scope]
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

  app.get("/posts/:id", async (request, reply) => {
    const params = request.params as { id: string };
    const session = getSession(request);
    const viewerWallet = session?.wallet ?? "__anonymous__";
    const result = await pool.query(
      `select p.id, p.text, p.media_url, p.media_type, p.created_at, u.wallet as author_wallet, u.display_name, u.username, u.bio, u.avatar_url,
              count(distinct l.wallet)::int as like_count, count(distinct c.id)::int as comment_count,
              coalesce(sum(t.amount_nim) filter (where t.status = 'verified'), 0)::text as tip_total,
              count(distinct v.viewer_wallet)::int as view_count,
              exists(select 1 from likes l2 where l2.post_id = p.id and l2.wallet = $2) as liked_by_me
       from posts p join users u on u.wallet = p.author_wallet
       left join likes l on l.post_id = p.id
       left join comments c on c.post_id = p.id
       left join tips t on t.post_id = p.id
       left join post_views v on v.post_id = p.id
       where p.id = $1 group by p.id, u.wallet`,
      [params.id, viewerWallet]
    );
    if (result.rowCount === 0) return reply.notFound("post not found");
    const comments = await pool.query(
      `select c.id, c.text, c.created_at, c.author_wallet, u.username from comments c join users u on u.wallet = c.author_wallet where c.post_id = $1 order by c.created_at asc`,
      [params.id]
    );
    return { ...mapPost(result.rows[0]), comments: comments.rows.map((row: Record<string, any>) => ({ id: row.id, text: row.text, createdAt: row.created_at, author: { wallet: row.author_wallet, username: row.username } })) };
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
    const result = await pool.query(
      `insert into comments (post_id, author_wallet, text) values ($1, $2, $3) returning id, text, created_at`,
      [params.id, session.wallet, body.data.text]
    );
    if (post.rows[0].author_wallet !== session.wallet) {
      await pool.query(
        `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'comment', $3)`,
        [post.rows[0].author_wallet, session.wallet, params.id]
      );
    }
    await recordActivity(session.wallet);
    return reply.code(201).send({ id: result.rows[0].id, text: result.rows[0].text, createdAt: result.rows[0].created_at, authorWallet: session.wallet });
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
    if (verified) {
      await pool.query(
        `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'tip', $3)`,
        [body.data.toWallet, session.wallet, body.data.postId ?? null]
      );
    }
    return reply.code(verified ? 201 : 202).send({ ...result.rows[0], message: verified ? "Tip verified on-chain" : "Tip recorded and awaiting on-chain verification" });
  });

  app.post("/tips/:id/verify", async (request, reply) => {
    const session = getSession(request);
    if (!session) return reply.unauthorized();
    const params = request.params as { id: string };
    const tip = await pool.query(`select id, from_wallet, to_wallet, post_id, amount_nim::text as amount, tx_hash, status from tips where id = $1`, [params.id]);
    if (tip.rowCount === 0) return reply.notFound("tip not found");
    if (tip.rows[0].from_wallet !== session.wallet) return reply.forbidden();
    if (tip.rows[0].status === "verified") return tip.rows[0];
    const verified = await verifyTipTransaction(tip.rows[0]);
    if (!verified) return reply.code(202).send({ ...tip.rows[0], message: "Tip is not visible as a matching on-chain transaction yet" });
    const result = await pool.query(`update tips set status = 'verified', verified_at = now() where id = $1 returning id, from_wallet, to_wallet, post_id, amount_nim::text as amount, tx_hash, status, verified_at`, [params.id]);
    await pool.query(
      `insert into notifications (recipient_wallet, actor_wallet, type, post_id) values ($1, $2, 'tip', $3)`,
      [tip.rows[0].to_wallet, session.wallet, tip.rows[0].post_id]
    );
    return result.rows[0];
  });

  app.get("/tips/leaderboard", async (request, reply) => {
    const query = request.query as { range?: string };
    const range = query.range === "weekly" ? "weekly" : query.range === "daily" ? "daily" : undefined;
    if (!range) return reply.code(400).send({ error: "range must be daily or weekly" });
    const interval = range === "daily" ? "1 day" : "7 days";
    const [tippers, earners] = await Promise.all([
      pool.query(
        `select from_wallet as wallet, coalesce(u.username, from_wallet) as username, sum(amount_nim)::text as amount, count(*)::int as tips
         from tips t left join users u on u.wallet = t.from_wallet where t.status = 'verified' and t.created_at >= now() - $1::interval
         group by from_wallet, u.username order by sum(amount_nim) desc limit 20`, [interval]
      ),
      pool.query(
        `select to_wallet as wallet, coalesce(u.username, to_wallet) as username, sum(amount_nim)::text as amount, count(*)::int as tips
         from tips t left join users u on u.wallet = t.to_wallet where t.status = 'verified' and t.created_at >= now() - $1::interval
         group by to_wallet, u.username order by sum(amount_nim) desc limit 20`, [interval]
      )
    ]);
    return { range, topTippers: tippers.rows, topEarners: earners.rows };
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
