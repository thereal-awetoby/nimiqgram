import { config } from "./config.js";
import { HashedTimeLockedContract } from "@nimiq/core";

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
  const response = await fetch(config.NIMIQ_RPC_URL!, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method: "getTransactionByHash", params: [txHash] })
  });

  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }

  return await response.json() as RpcResponse;
}

function describeTransaction(transaction: Record<string, unknown>): string {
  return JSON.stringify({
    hash: transaction.hash,
    from: transaction.from,
    fromAddress: transaction.fromAddress,
    fromType: transaction.fromType,
    sender: transaction.sender,
    to: transaction.to,
    toAddress: transaction.toAddress,
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
  // Nimiq RPC (and decoded HTLC proofs) return addresses in spaced
  // human-readable form (e.g. "NQ12 FBBY GJ2V ..."), so strip all
  // whitespace before comparing.
  const normalized = value.replace(/\s+/g, "").trim();
  if (!normalized) return undefined;
  return normalized.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function verifyTipTransaction(input: TipVerificationInput): Promise<boolean> {
  if (!config.NIMIQ_RPC_URL) return false;
  const txHash = input.txHash.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(txHash)) {
    console.error("Tip verification received an invalid transaction hash", { txHash: input.txHash });
    return false;
  }

  try {
    const payload = await getTransactionByHash(txHash);
    if (payload.error) {
      console.error("Tip verification RPC error:", payload.error.message ?? "unknown RPC error");
      return false;
    }
    if (!payload.result) {
      console.error("Tip verification RPC returned no transaction", { txHash, network: config.NIMIQ_NETWORK });
      return false;
    }

    // Albatross RPC nests the transaction under `data`; older shape used `transaction`.
    const nestedTransaction = payload.result.data ?? payload.result.transaction;
    const transaction = isRecord(nestedTransaction) && Object.keys(nestedTransaction).length > 0
      ? nestedTransaction
      : Object.keys(payload.result).some((key) => ["from", "fromAddress", "sender", "to", "toAddress", "recipient", "value"].includes(key))
        ? payload.result
        : undefined;
    if (!transaction) {
      console.error("Tip verification RPC returned an empty transaction result", {
        txHash,
        network: config.NIMIQ_NETWORK,
        resultKeys: Object.keys(payload.result),
        nestedTransactionType: typeof nestedTransaction
      });
      return false;
    }

    // executionResult lives on the transaction object itself in the Albatross shape.
    if (transaction.executionResult === false) {
      console.error("Tip transaction execution failed", { txHash: input.txHash });
      return false;
    }

    // If this settlement transaction's sender is an HTLC contract (fromType 2),
    // the *real* payer is the HTLC's creator, decodable from the proof — not
    // `transaction.from`, which is always the contract address. Nimiq Pay
    // funds tips via user -> HTLC -> recipient, so decode the proof and use
    // `creator` as the effective sender whenever this path is taken.
    let effectiveSender = normalizeWallet(transaction.fromAddress ?? transaction.sender ?? transaction.from);
    if (transaction.fromType === 2 && typeof transaction.proof === "string") {
      try {
        const proofBytes = Uint8Array.from(Buffer.from(transaction.proof, "hex"));
        const decodedProof = HashedTimeLockedContract.proofToPlain(proofBytes);
        if ("creator" in decodedProof && typeof decodedProof.creator === "string") {
          effectiveSender = normalizeWallet(decodedProof.creator);
        }
      } catch (err) {
        console.error("Failed to decode HTLC proof for sender verification", {
          txHash,
          err: err instanceof Error ? err.message : err
        });
        // Fall through with effectiveSender left as the contract address,
        // which will correctly fail the sender check below rather than
        // silently passing verification with unverified sender info.
      }
    }

    const recipient = normalizeWallet(transaction.toAddress ?? transaction.recipient ?? transaction.to);
    const expectedSender = normalizeWallet(input.fromWallet);
    const expectedRecipient = normalizeWallet(input.toWallet);

    if (effectiveSender !== expectedSender || recipient !== expectedRecipient) {
      console.error("Tip transaction address mismatch", {
        expectedSender,
        sender: effectiveSender,
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