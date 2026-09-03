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
  const [whole, fraction = ""] = amountNim.split(".");
  const normalizedFraction = fraction.padEnd(5, "0").slice(0, 5);
  return BigInt(whole) * 100000n + BigInt(normalizedFraction);
}

export async function verifyTipTransaction(input: TipVerificationInput): Promise<boolean> {
  if (!config.NIMIQ_RPC_URL) return false;
  const response = await fetch(config.NIMIQ_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params: { hash: input.txHash } })
  });
  if (!response.ok) return false;
  const payload = await response.json() as RpcResponse;
  const transaction = payload.result;
  if (!transaction || payload.error) return false;
  const sender = typeof transaction.sender === "string" ? transaction.sender : undefined;
  const recipient = typeof transaction.recipient === "string" ? transaction.recipient : undefined;
  if (sender !== input.fromWallet || recipient !== input.toWallet) return false;
  try {
    const value = typeof transaction.value === "number" || typeof transaction.value === "string" ? BigInt(transaction.value) : undefined;
    return value === nimToLunas(input.amountNim);
  } catch {
    return false;
  }
}
