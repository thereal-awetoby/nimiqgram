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

  if (!config.NIMIQ_RPC_URL || !request.publicKey) {
    console.warn({ walletSuffix, hasRpcUrl: Boolean(config.NIMIQ_RPC_URL), hasPublicKey: Boolean(request.publicKey), reason: "missing-rpc-or-public-key" }, "Wallet verification rejected");
    return undefined;
  }

  try {
    const derivedWallet = Address.fromPublicKeys([PublicKey.fromAny(request.publicKey)], 1).toUserFriendlyAddress();
    if (derivedWallet !== request.wallet) {
      console.warn({ walletSuffix, derivedSuffix: derivedWallet.slice(-6), reason: "public-key-wallet-mismatch-using-derived-wallet" }, "Wallet address differed from signing key; using derived wallet");
    }
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
    if (!response.ok) {
      console.warn({ walletSuffix, status: response.status, reason: "rpc-http-error" }, "Wallet verification rejected");
      return undefined;
    }
    const result = await response.json() as { result?: { bool?: boolean } | boolean };
    const verified = typeof result.result === "boolean" ? result.result : result.result?.bool === true;
    if (!verified) console.warn({ walletSuffix, reason: "rpc-signature-rejected" }, "Wallet verification rejected");
    return verified ? derivedWallet : undefined;
  } catch (error) {
    console.warn({ walletSuffix, reason: "rpc-request-failed", error: error instanceof Error ? error.message : "unknown" }, "Wallet verification rejected");
    return undefined;
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
