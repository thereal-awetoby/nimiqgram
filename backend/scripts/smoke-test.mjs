const baseUrl = process.env.API_URL || "http://localhost:3001/api";
const firstWallet = `NQSMOKE${Date.now()}`;
const secondWallet = `${firstWallet}B`;

async function request(path, options = {}, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (response.status !== expectedStatus) {
    throw new Error(`${options.method || "GET"} ${path}: expected ${expectedStatus}, got ${response.status}: ${text}`);
  }
  return body;
}

function json(method, body, token) {
  return {
    method,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  };
}

async function login(wallet) {
  await request("/auth/challenge", json("POST", { wallet }));
  return (await request("/auth/verify", json("POST", { wallet, signature: `dev:${wallet}` }))).token;
}

const health = await request("/health");
if (health.status !== "ok") throw new Error("health check returned an unexpected status");

const firstToken = await login(firstWallet);
const secondToken = await login(secondWallet);

const profile = await request("/profile/" + firstWallet);
if (profile.wallet !== firstWallet) throw new Error("profile lookup failed");

const updatedProfile = await request("/profile", json("PUT", {
  username: `smoke_${Date.now()}`,
  bio: "Smoke test profile"
}, firstToken));
if (updatedProfile.wallet !== firstWallet) throw new Error("profile update failed");

const post = await request("/posts", json("POST", { text: "NimqPay backend smoke test" }, firstToken), 201);
const feed = await request("/feed");
if (!feed.posts.some((item) => item.id === post.id)) throw new Error("created post missing from feed");

const firstLike = await request(`/posts/${post.id}/like`, json("POST", {}, secondToken));
if (firstLike.liked !== true || firstLike.likeCount !== 1) throw new Error("like failed");
const secondLike = await request(`/posts/${post.id}/like`, json("POST", {}, secondToken));
if (secondLike.liked !== false || secondLike.likeCount !== 0) throw new Error("unlike failed");

const comment = await request(`/posts/${post.id}/comment`, json("POST", { text: "Nice post" }, secondToken), 201);
if (comment.authorWallet !== secondWallet) throw new Error("comment failed");

const detail = await request(`/posts/${post.id}`);
if (detail.comments.length !== 1) throw new Error("post detail comment missing");

const tip = await request("/tips", json("POST", {
  toWallet: firstWallet,
  postId: post.id,
  amount: 1,
  txHash: `smoke-${Date.now()}`
}, secondToken), 202);
if (tip.status !== "pending") throw new Error("tip was not recorded as pending");

console.log("Smoke test passed: health, auth, profile, post, feed, like/unlike, comment, detail, and pending tip.");