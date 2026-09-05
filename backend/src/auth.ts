import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PublicKey, Signature } from "@nimiq/core";
import { config } from "./config.js";

export type AuthChallenge = {
  wallet: string;
  message: string;
  expiresAt: string;
};

export type SessionUser = {
  wallet: string;
  username: string | null;
};

export type AuthVerifyRequest = {
  wallet: string;
  signature: string;
  publicKey?: string;
};

const challenges = new Map<string, AuthChallenge>();
const challengeLifetimeMs = 5 * 60 * 1000;

export function createChallenge(wallet: string): AuthChallenge {
  const expiresAt = new Date(Date.now() + challengeLifetimeMs).toISOString();
  const challenge: AuthChallenge = {
    wallet,
    message: `Sign in to NimqPay as ${wallet}\nNonce: ${randomBytes(16).toString("hex")}`,
    expiresAt
  };

  challenges.set(wallet, challenge);
  return challenge;
}

export async function verifyWalletSignature(challenge: AuthChallenge, request: AuthVerifyRequest): Promise<string | undefined> {
  const walletSuffix = request.wallet.slice(-6);
  if (challenge.wallet !== request.wallet) {
    console.warn({ walletSuffix, reason: "challenge-wallet-mismatch" }, "Wallet verification rejected");
    return undefined;
  }
  if (Date.parse(challenge.expiresAt) <= Date.now()) {
    console.warn({ walletSuffix, reason: "challenge-expired" }, "Wallet verification rejected");
    return undefined;
  }

  if (config.NODE_ENV !== "production") {
    return request.signature === `dev:${challenge.wallet}` ? challenge.wallet : undefined;
  }

  if (!request.publicKey) {
    console.warn({ walletSuffix, reason: "missing-public-key" }, "Wallet verification rejected");
    return undefined;
  }

  let publicKey: PublicKey;
  let derivedWallet: string;
  try {
    publicKey = PublicKey.fromAny(request.publicKey);
    derivedWallet = publicKey.toAddress().toUserFriendlyAddress();
  } catch (error) {
    console.warn({ walletSuffix, reason: "invalid-public-key", error: error instanceof Error ? error.message : "unknown" }, "Wallet verification rejected");
    return undefined;
  }

  if (derivedWallet !== request.wallet) {
    console.warn({ walletSuffix, derivedSuffix: derivedWallet.slice(-6), reason: "public-key-wallet-mismatch-using-derived-wallet" }, "Wallet address differed from signing key; using derived wallet");
  }

  // Verified locally via @nimiq/core instead of the RPC's "verifySignature"
  // method, which isn't a documented/standard Nimiq node RPC call and was
  // very likely either hitting an unsupported method or checking the raw
  // message bytes against a signature produced over a differently-encoded
  // (e.g. prefixed) message.
  //
  // Confirmed against the installed @nimiq/core wasm-bindgen API
  // (node --input-type=module -e "..."): `verify` lives on PublicKey, not
  // Signature. Signature only exposes serialize/toHex/free. Call shape is
  // publicKey.verify(signature, messageBytes) — signature first, then the
  // raw message bytes.
  let signature: Signature;
  try {
    signature = Signature.fromAny(request.signature);
  } catch (error) {
    console.warn({ walletSuffix, reason: "invalid-signature-encoding", error: error instanceof Error ? error.message : "unknown" }, "Wallet verification rejected");
    return undefined;
  }

  const messageBytes = Buffer.from(challenge.message, "utf8");

  let verified: boolean;
  try {
    verified = publicKey.verify(signature, messageBytes);
  } catch (error) {
    // publicKey.verify() may throw on a malformed/garbage signature rather
    // than returning false — keep this distinct from a clean "rejected"
    // result so the two failure modes don't get conflated in logs.
    console.warn({ walletSuffix, reason: "verification-error", error: error instanceof Error ? error.message : "unknown" }, "Wallet verification rejected");
    return undefined;
  }

  if (!verified) {
    console.warn({ walletSuffix, reason: "signature-rejected" }, "Wallet verification rejected");
    return undefined;
  }

  return derivedWallet;
}

export function getChallenge(wallet: string): AuthChallenge | undefined {
  const challenge = challenges.get(wallet);
  if (!challenge || Date.parse(challenge.expiresAt) <= Date.now()) {
    challenges.delete(wallet);
    return undefined;
  }

  return challenge;
}

export function consumeChallenge(wallet: string): void {
  challenges.delete(wallet);
}

export function issueSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  const signature = createHmac("sha256", config.SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySession(token: string): SessionUser | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return undefined;
  }

  const expected = createHmac("sha256", config.SESSION_SECRET).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return undefined;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp: number };
    return session.exp > Date.now() ? { wallet: session.wallet, username: session.username } : undefined;
  } catch {
    return undefined;
  }
}