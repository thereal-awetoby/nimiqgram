# NimqPay AI Project Context

This file is a handoff for an AI assistant working on the NimqPay repository. Read it before changing code.

## Project Purpose

NimqPay is a Nimiq-powered social mini-app. Users authenticate with a Nimiq wallet, create posts, follow users, like/comment on posts, send NIM tips, receive notifications, and view tip activity/leaderboards.

## Repository Layout

```text
backend/
  src/
    auth.ts          Wallet challenge/signature auth and sessions
    config.ts        Zod-validated environment configuration
    db.ts            PostgreSQL pool
    nimiq-rpc.ts     On-chain tip verification
    routes.ts        Fastify REST API routes
    server.ts        Fastify server entry point
  sql/               Ordered PostgreSQL migrations
  scripts/           Migration and smoke-test scripts
  package.json

docs/api-contract.md API route contract
render.yaml           Render backend deployment configuration
social-miniapp-frontend/
  src/App.jsx         React router/app shell
  src/components/     Shared UI, wallet connection, tip modal
  src/context/        Auth context
  src/lib/api.js      API client; currently uses the deployed backend URL
  src/pages/          Feed, profile, post, notifications, search, leaderboard
```

## Runtime Architecture

- Frontend: React 19 + Vite.
- Backend: Fastify 5 + TypeScript.
- Database: PostgreSQL/Supabase.
- Auth: wallet challenge, signed message, backend-issued bearer session.
- Wallet integration: `@nimiq/mini-app-sdk`; real wallet actions require running inside the Nimiq Pay environment.
- Blockchain lookup: JSON-RPC `getTransactionByHash`.
- Frontend API base is hardcoded in `social-miniapp-frontend/src/lib/api.js` as `https://nimsoc.onrender.com/api`.
- Render deploys only the backend through `render.yaml`; frontend deployment is separate, currently on Vercel.

## Local Commands

Run commands from the relevant directory. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

```powershell
cd backend
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke

cd ..\social-miniapp-frontend
npm.cmd install
npm.cmd run dev
npm.cmd run lint
npm.cmd run build
```

Backend health endpoint:

```text
https://nimsoc.onrender.com/api/health
```

Expected response:

```json
{"status":"ok"}
```

## Environment

Backend configuration is validated in `backend/src/config.ts`:

```text
PORT=3001
DATABASE_URL=postgresql://...
SESSION_SECRET=<at least 32 characters>
CORS_ORIGIN=<frontend origin>
NIMIQ_NETWORK=testnet|mainnet
NIMIQ_RPC_URL=<JSON-RPC endpoint>
```

`NIMIQ_NETWORK` is currently used for configuration/logging but does not select the RPC endpoint automatically. The wallet network and RPC network must match. Do not change testnet to mainnet without confirming the wallet is sending mainnet funds.

The public `https://rpc.nimiqwatch.com` endpoint is rate-limited. It has returned HTTP 429 when many old pending tips were checked at once. Do not parallelize large batches of verification requests. A dedicated RPC endpoint is preferable for production.

## Tip Flow

1. `TipModal.jsx` calls the Nimiq wallet SDK `sendBasicTransaction`.
2. The wallet returns a serialized transaction/hash.
3. The frontend extracts a canonical 64-character hexadecimal transaction hash.
4. `POST /api/tips` stores the tip and calls `verifyTipTransaction` immediately.
5. If RPC lookup succeeds and fields match, the tip is stored as `verified`; otherwise it is stored as `pending`.
6. A notification is inserted for the recipient regardless of immediate verification.
7. Pending tips call `POST /api/tips/:id/verify` later.
8. Feed/Post close the tip modal only after verification succeeds and then update the post tip total.
9. Profile Activity can retry a limited number of old pending tips sequentially.

## Current RPC Verification Contract

`backend/src/nimiq-rpc.ts` currently sends:

```json
{
  "jsonrpc": "2.0",
  "method": "getTransactionByHash",
  "params": ["64-character-lowercase-hex-hash"],
  "id": 1
}
```

The verifier expects a result shaped approximately like:

```json
{
  "result": {
    "transaction": {
      "fromAddress": "NQ...",
      "toAddress": "NQ...",
      "value": 1000,
      "confirmations": 1
    },
    "executionResult": true
  }
}
```

It accepts `fromAddress`/`toAddress` first, with fallbacks to `sender`/`recipient` and `from`/`to`. It compares:

- Sender against the authenticated session wallet.
- Recipient against the requested post author wallet.
- Value in lunas against the submitted NIM amount.
- `executionResult !== false`.

The transaction must be found by the RPC. The current code does not require a minimum confirmation count; lookup plus matching fields is treated as verified.

## Important Historical Failure Modes

### Empty JSON body

`POST /tips/:id/verify` must send an empty JSON object because Fastify rejects an empty body with `Content-Type: application/json`:

```js
body: JSON.stringify({})
```

### RPC parameter shape

Generic Nimiq RPC documentation uses positional parameters (`params: [hash]`). An earlier compatibility fallback tried `params: { hash }`, but the current source should prefer the documented positional form. If Render logs `Invalid params`, inspect the actual stored hash first.

### Invalid transaction hash

The backend now expects a 32-byte transaction hash represented by exactly 64 hexadecimal characters, optionally prefixed with `0x` before normalization. Malformed hashes should be rejected rather than stored as permanently pending.

### RPC rate limiting

HTTP 429 means the public RPC is rate-limiting the service. Do not interpret it as an invalid blockchain transaction. Reduce request concurrency or configure a dedicated RPC endpoint.

### Stale frontend/backend deployment

Render logs showing old messages such as `Nimiq RPC rejected array parameters; retrying object parameters` indicate an old backend build is still deployed. Vercel/browser caches can also show an old frontend. After deployment, hard refresh the browser and verify the Render build contains the current source.

## Debugging Tip Verification

When debugging a real tip, inspect Render logs for this sequence:

```text
POST /api/tips
POST /api/tips/:id/verify
```

Useful verifier log meanings:

```text
Tip verification RPC returned HTTP 429
```

Public RPC rate limit.

```text
Tip verification RPC error: Invalid params
```

The RPC rejected the request, usually because the hash/request shape is invalid. Check the exact hash and deployed backend version.

```text
Tip verification RPC returned no transaction
```

Wrong network, unknown hash, or RPC indexing/availability issue.

```text
Tip transaction address mismatch
```

The transaction exists, but sender/recipient fields do not match the authenticated sender and intended recipient.

```text
Tip transaction amount mismatch
```

The on-chain value does not equal the submitted amount converted to lunas (`1 NIM = 100000 lunas`).

```text
Tip transaction verified on-chain
```

The backend matched the transaction and updated the database to `verified`.

If logs show only `/api/posts/.../view`, profile, or notification requests, blockchain verification was not attempted in that session.

## API Auth Rules

Protected routes require:

```text
Authorization: Bearer <session-token>
```

`POST /tips/:id/verify` should be allowed for the tip sender and recipient so old pending tips can be recovered from either side. Do not weaken authorization for unrelated users.

## Database Tip State

`tips.status` is one of:

```text
pending | verified | failed
```

Tip totals, leaderboards, and profile activity should generally count only `verified` tips where applicable. `tx_hash` is unique. The original transaction hash is required to recover an old pending tip.

## Change Guidelines

- Preserve existing API response shapes unless necessary.
- Do not expose RPC tokens or database credentials in frontend code or committed `.env` files.
- Validate transaction hashes at the API boundary.
- Keep RPC diagnostics useful but avoid logging secrets.
- Never mark a tip verified solely because the wallet UI says it was sent; verify sender, recipient, amount, execution result, and ideally confirmations.
- Before deploying, run backend typecheck/build and frontend lint/build.
- Do not commit or push unless explicitly requested by the user.
