# NimiqPay

A social payments backend for a Nimiq-powered frontend. This project exposes a REST API for wallet authentication, user profiles, posts, likes, comments, tips, notifications, and streak tracking.

## Overview

This project contains a Nimiq-powered social mini-app with a React frontend and a Fastify backend.

- Frontend: https://nimiqgram.vercel.app
- API base (deployed): https://nimsoc.onrender.com/api
- Local backend API: http://localhost:3001/api
- API prefix: /api
- Auth model: wallet-based challenge + signature verification
- Payment flow: Nimiq wallet signatures and on-chain tip verification
- Data layer: PostgreSQL
- Post text supports clickable website links and mentions

## Tech stack

- Fastify
- TypeScript
- PostgreSQL
- Nimiq RPC + wallet signature verification
- Zod validation

## Local setup

### 1. Install dependencies

From the backend folder:

```bash
cd backend
npm install
```

### 2. Create environment file

Create a .env file in the backend folder with values like:

```bash
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/dbname
SESSION_SECRET=replace_with_a_long_random_string
NODE_ENV=development
NIMIQ_NETWORK=testnet
NIMIQ_RPC_URL=https://rpc.nimiqwatch.com
CORS_ORIGIN=http://localhost:3000,http://localhost:5173,https://nimiqgram.vercel.app
```

For the frontend, set a Vite env value when needed:

```bash
VITE_API_BASE=http://localhost:3001/api
```

### 3. Start the backend

```bash
npm run dev
```

### 4. Run smoke checks

```bash
npm run smoke
npm run typecheck
npm run build
```

## API contract

All frontend calls should target the API base URL plus the route paths below.

### Authentication

#### 1. Create a challenge

```http
POST /api/auth/challenge
Content-Type: application/json

{
  "wallet": "NQ..."
}
```

Response:

```json
{
  "message": "Sign this message to authenticate",
  "expiresAt": "2026-01-01T00:00:00.000Z"
}
```

#### 2. Verify signature

```http
POST /api/auth/verify
Content-Type: application/json

{
  "wallet": "NQ...",
  "publicKey": "...",
  "signature": "..."
}
```

Response:

```json
{
  "token": "jwt_token_here",
  "user": {
    "wallet": "NQ...",
    "username": null
  }
}
```

Store the returned token in frontend session storage and send it as:

```http
Authorization: Bearer <token>
```

### User profile

```http
GET /api/profile/:wallet
PUT /api/profile
```

Example body:

```json
{
  "username": "alice",
  "bio": "Building social payments",
  "avatarUrl": "https://example.com/avatar.png"
}
```

### Feed and posts

```http
GET /api/feed?cursor=
POST /api/posts
GET /api/posts/:id
POST /api/posts/:id/like
POST /api/posts/:id/comment
```

Example post payload with optional Cloudinary media:

```json
{
  "text": "Launching a new creator wallet experience",
  "mediaUrl": "https://res.cloudinary.com/example/image/upload/post.png",
  "mediaType": "image/png"
}
```

`mediaUrl` and `mediaType` are optional, but must be supplied together. The API stores the Cloudinary URL and MIME type and returns them on every post in the feed and on post details.

Post text also supports plain website URLs such as `https://example.com`, `www.example.com`, and `example.com`, which render as clickable links in the app.

### Following

```http
GET /api/users/:wallet/following
GET /api/users/:wallet/followers
POST /api/users/:wallet/follow
DELETE /api/users/:wallet/follow
```

The list endpoints return `{ "users": [] }`. Follow and unfollow require the authenticated wallet's bearer token. A wallet cannot follow itself.

### Tips and notifications

```http
POST /api/tips
GET /api/notifications
POST /api/notifications/read
GET /api/tips/leaderboard?range=daily
```

Example tip payload:

```json
{
  "toWallet": "NQ...",
  "amount": 2.5,
  "txHash": "...",
  "postId": "uuid-here"
}
```

## Frontend integration notes

- Always include the Authorization header on protected routes.
- The frontend should keep the session token in memory or session storage.
- The app expects wallet addresses in Nimiq format like NQ... addresses.
- For local development, the backend accepts a dev signature format like `dev:<wallet>` for authentication. This is not intended for production.
- Protected endpoints return 401 for missing or invalid bearer tokens.

## Example frontend fetch

```js
const res = await fetch('http://localhost:3001/api/feed');
const data = await res.json();
console.log(data.posts);
```

With auth:

```js
const token = localStorage.getItem('token');

const res = await fetch('http://localhost:3001/api/profile/NQ123', {
  headers: {
    Authorization: `Bearer ${token}`
  }
});

const profile = await res.json();
```

## Project structure

```text
backend/
  src/
  scripts/
  package.json
  tsconfig.json

docs/
  api-contract.md
```

## Notes

This repo is a backend-first project for frontend integration. The API contract is intentionally stable so that a frontend can integrate early while the backend evolves.

For the full route and payload details, see [docs/api-contract.md](docs/api-contract.md).
