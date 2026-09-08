import { config } from "./config.js";

export type TipVerificationInput = {
  txHash: string;
  fromWallet: string;
  toWallet: string;
  amountNim: string;
};

type RpcResponse = {
  result?: Record<string, unknown> | null;
  error?: { message?: string };
};

function nimToLunas(amountNim: string): bigint {
  const [whole, fraction = ""] = amountNim.trim().split(".");
  const normalizedFraction = fraction.padEnd(5, "0").slice(0, 5);
  return BigInt(whole || "0") * 100000n + BigInt(normalizedFraction || "0");
}

function normalizeWallet(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.toLowerCase();
}

export async function verifyTipTransaction(input: TipVerificationInput): Promise<boolean> {
  if (!config.NIMIQ_RPC_URL) return false;

  try {
    const response = await fetch(config.NIMIQ_RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params: [input.txHash] })
    });

    if (!response.ok) return false;

    const payload = await response.json() as RpcResponse;
    if (!payload.result || payload.error) return false;
    const transaction = (payload.result.transaction as Record<string, unknown> | undefined) ?? payload.result;
    if (payload.result.executionResult === false) return false;

    const sender = normalizeWallet(transaction.sender ?? transaction.from);
    const recipient = normalizeWallet(transaction.recipient ?? transaction.to);
    const expectedSender = normalizeWallet(input.fromWallet);
    const expectedRecipient = normalizeWallet(input.toWallet);

    if (sender !== expectedSender || recipient !== expectedRecipient) return false;

    const rawValue = transaction.value ?? transaction.amount;
    let txValue: bigint | undefined;
    if (typeof rawValue === "string") {
      txValue = BigInt(rawValue);
    } else if (typeof rawValue === "number") {
      txValue = BigInt(Math.trunc(rawValue));
    }

    return txValue === nimToLunas(input.amountNim);
  } catch (err) {
    console.error("Tip verification failed (treating as unverified/pending):", err);
    return false;
  }
}