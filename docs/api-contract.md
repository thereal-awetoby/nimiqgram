# NimiqPay API Contract

Base path: `/api`

Builder B owns these endpoints. Field names should remain stable once Builder A starts integration. Every protected endpoint requires `Authorization: Bearer <token>`.

## Authentication

1. `POST /auth/challenge` with `{ "wallet": "NQ..." }` returns `{ "message", "expiresAt" }`.
2. Ask Nimiq Pay to sign the returned `message`.
3. `POST /auth/verify` with `{ "wallet", "publicKey", "signature" }` returns `{ "token", "user" }`.
4. Store the token in frontend session state and send it on protected requests.

For local development, `signature: "dev:<wallet>"` is accepted. It is rejected in production.

| Method | Path | Response or request shape |
| --- | --- | --- |
| POST | `/auth/challenge` | `{ wallet }` -> `{ message, expiresAt }` |
| POST | `/auth/verify` | `{ wallet, publicKey?, signature }` -> `{ token, user }`; production verifies with Nimiq RPC |
| GET | `/profile/:wallet` | `{ username, bio, avatarUrl, bannerUrl, badges[], streak }` |
| PUT | `/profile` | `{ username, bio, avatarUrl?, bannerUrl? }` (Bearer auth) |
| GET | `/feed?cursor=` | `{ posts[], nextCursor }`; posts include optional `mediaUrl` and `mediaType`; pass the previous `nextCursor` to load more |
| POST | `/posts` | `{ text, mediaUrl?, mediaType? }`; media fields must be supplied together (Bearer auth) |
| GET | `/posts/:id` | Post with comments |
| GET | `/users/:wallet/following` | `{ users[] }`; people followed by the wallet |
| GET | `/users/:wallet/followers` | `{ users[] }`; people following the wallet |
| POST | `/users/:wallet/follow` | Follow the user (Bearer auth) |
| DELETE | `/users/:wallet/follow` | Unfollow the user (Bearer auth) |
| POST | `/posts/:id/like` | Toggle like; returns `{ liked, likeCount }` (Bearer auth) |
| POST | `/posts/:id/comment` | `{ text }`; returns created comment (Bearer auth) |
| POST | `/tips` | `{ toWallet, postId?, amount, txHash }`; `201` verified or `202` pending (Bearer auth) |
| POST | `/tips/:id/verify` | Retry on-chain verification for own pending tip (Bearer auth) |
| GET | `/tips/leaderboard?range=daily\|weekly` | `{ range, topTippers[], topEarners[], topStreakers[] }`; verified tips only for tip lists, current streak for streakers |
| GET | `/notifications` | `{ notifications[] }` (Bearer auth) |
| POST | `/notifications/read` | `{ ids? }`; omit ids to mark all read (Bearer auth) |
| GET | `/streaks/:wallet` | `{ currentStreak, longestStreak, badges[] }` |

Stretch endpoints, after the core loop is reliable:

- `POST /posts/:id/repost`
- `POST /posts/:id/bookmark`
