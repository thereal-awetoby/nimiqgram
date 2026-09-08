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

async function getTransactionByHash(txHash: string): Promise<RpcResponse> {
  const request = async (params: unknown): Promise<RpcResponse> => {
    const response = await fetch(config.NIMIQ_RPC_URL!, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params })
    });

    if (!response.ok) {
      throw new Error(`RPC HTTP ${response.status}`);
    }

    return await response.json() as RpcResponse;
  };

  const arrayResponse = await request([txHash]);
  if (arrayResponse.error?.message !== "Invalid params") return arrayResponse;

  console.warn("Nimiq RPC rejected array parameters; retrying object parameters");
  return request({ hash: txHash });
}

function describeTransaction(transaction: Record<string, unknown>): string {
  return JSON.stringify({
    hash: transaction.hash,
    from: transaction.from,
    sender: transaction.sender,
    to: transaction.to,
    recipient: transaction.recipient,
    value: transaction.value,
    confirmations: transaction.confirmations,
    networkId: transaction.networkId,
    blockNumber: transaction.blockNumber
  });
}

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
    const payload = await getTransactionByHash(input.txHash);
    if (payload.error) {
      console.error("Tip verification RPC error:", payload.error.message ?? "unknown RPC error");
      return false;
    }
    if (!payload.result) {
      console.error("Tip verification RPC returned no transaction", { txHash: input.txHash, network: config.NIMIQ_NETWORK });
      return false;
    }
    const transaction = (payload.result.transaction as Record<string, unknown> | undefined) ?? payload.result;
    if (payload.result.executionResult === false) {
      console.error("Tip transaction execution failed", { txHash: input.txHash });
      return false;
    }

    const sender = normalizeWallet(transaction.sender ?? transaction.from);
    const recipient = normalizeWallet(transaction.recipient ?? transaction.to);
    const expectedSender = normalizeWallet(input.fromWallet);
    const expectedRecipient = normalizeWallet(input.toWallet);

    if (sender !== expectedSender || recipient !== expectedRecipient) {
      console.error("Tip transaction address mismatch", {
        expectedSender,
        sender,
        expectedRecipient,
        recipient,
        transaction: describeTransaction(transaction)
      });
      return false;
    }

    const rawValue = transaction.value ?? transaction.amount;
    let txValue: bigint | undefined;
    if (typeof rawValue === "string") {
      txValue = BigInt(rawValue);
    } else if (typeof rawValue === "number") {
      txValue = BigInt(Math.trunc(rawValue));
    }

    const expectedValue = nimToLunas(input.amountNim);
    if (txValue !== expectedValue) {
      console.error("Tip transaction amount mismatch", {
        expectedValue: expectedValue.toString(),
        actualValue: txValue?.toString(),
        transaction: describeTransaction(transaction)
      });
      return false;
    }

    console.log("Tip transaction verified on-chain", {
      txHash: input.txHash,
      network: config.NIMIQ_NETWORK,
      transaction: describeTransaction(transaction)
    });
    return true;
  } catch (err) {
    console.error("Tip verification failed (treating as unverified/pending):", err);
    return false;
  }
}