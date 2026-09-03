import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Address, PublicKey } from "@nimiq/core";
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

export async function verifyWalletSignature(challenge: AuthChallenge, request: AuthVerifyRequest): Promise<boolean> {
  if (challenge.wallet !== request.wallet || Date.parse(challenge.expiresAt) <= Date.now()) {
    return false;
  }

  if (config.NODE_ENV !== "production") {
    return request.signature === `dev:${challenge.wallet}`;
  }

  if (!config.NIMIQ_RPC_URL || !request.publicKey) {
    return false;
  }

  try {
    const derivedWallet = Address.fromPublicKeys([PublicKey.fromAny(request.publicKey)], 1).toUserFriendlyAddress();
    if (derivedWallet !== request.wallet) return false;
    const response = await fetch(config.NIMIQ_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method: "verifySignature",
        params: { message: challenge.message, publicKey: request.publicKey, signature: request.signature, isHex: false }
      })
    });
    if (!response.ok) return false;
    const result = await response.json() as { result?: { bool?: boolean } | boolean };
    return typeof result.result === "boolean" ? result.result : result.result?.bool === true;
  } catch {
    return false;
  }
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
