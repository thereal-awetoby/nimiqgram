import { config } from "./config.js";
import { Address, HashedTimeLockedContract, KeyPair, PrivateKey, TransactionBuilder } from "@nimiq/core";

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

export async function nimiqRpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  if (!config.NIMIQ_RPC_URL) throw new Error("Nimiq RPC is not configured");
  const response = await fetch(config.NIMIQ_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params })
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const payload = await response.json() as { result?: T; error?: { message?: string } };
  if (payload.error) throw new Error(payload.error.message ?? `RPC ${method} failed`);
  return payload.result as T;
}

export function nimToLunas(amountNim: string): bigint {
  const [whole, fraction = ""] = amountNim.trim().split(".");
  return BigInt(whole || "0") * 100000n + BigInt(fraction.padEnd(5, "0").slice(0, 5) || "0");
}

export async function sendEscrowTransfer(recipient: string, amountNim: string): Promise<string> {
  if (!config.RED_PACKET_PRIVATE_KEY) throw new Error("Red packet private key is not configured");
  if (!config.RED_PACKET_ESCROW_ADDRESS) throw new Error("Red packet escrow address is not configured");

  const keyPair = KeyPair.derive(PrivateKey.fromHex(config.RED_PACKET_PRIVATE_KEY));
  const sender = keyPair.toAddress();
  const expectedSender = Address.fromUserFriendlyAddress(config.RED_PACKET_ESCROW_ADDRESS);
  if (!sender.equals(expectedSender)) throw new Error("Red packet private key does not match escrow address");

  const [validityStartHeight, networkId] = await Promise.all([
    nimiqRpc<number>("getBlockNumber"),
    nimiqRpc<number>("getNetworkId")
  ]);
  const transaction = TransactionBuilder.newBasic(
    sender,
    Address.fromUserFriendlyAddress(recipient),
    nimToLunas(amountNim),
    0n,
    validityStartHeight,
    networkId
  );
  keyPair.signTransaction(transaction);
  return nimiqRpc<string>("sendRawTransaction", [transaction.toHex()]);
}

export async function verifyBasicTransfer(txHash: string, expectedSender: string, expectedRecipient: string, expectedAmountNim: string): Promise<boolean> {
  const normalizedHash = txHash.trim().replace(/^0x/i, "").toLowerCase();
  const expectedSenderWallet = normalizeWallet(expectedSender);
  const expectedRecipientWallet = normalizeWallet(expectedRecipient);
  const expectedValue = nimToLunas(expectedAmountNim);

  // A wallet can return a transaction before the public RPC index has seen it.
  // Retry briefly instead of rejecting a valid funding payment immediately.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const payload = await getTransactionByHash(normalizedHash);
    if (!payload.error && payload.result) {
      const nested = payload.result.data ?? payload.result.transaction;
      const transaction = isRecord(nested) && Object.keys(nested).length > 0
        ? nested
        : payload.result;
      const sender = getEffectiveSender(transaction);
      const recipient = normalizeWallet(transaction.toAddress ?? transaction.recipient ?? transaction.to);
      const rawValue = transaction.value ?? transaction.amount;
      const value = typeof rawValue === "string" ? BigInt(rawValue) : typeof rawValue === "number" ? BigInt(Math.trunc(rawValue)) : undefined;
      if (sender === expectedSenderWallet && recipient === expectedRecipientWallet && value === expectedValue) return true;
      console.warn("Red packet funding transaction did not match", {
        txHash: normalizedHash,
        expectedSender: expectedSenderWallet,
        actualSender: sender,
        expectedRecipient: expectedRecipientWallet,
        actualRecipient: recipient,
        expectedValue: expectedValue.toString(),
        actualValue: value?.toString()
      });
      return false;
    }
    if (attempt < 5) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  return false;
}

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

function normalizeWallet(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  // Nimiq RPC (and decoded HTLC proofs) return addresses in spaced
  // human-readable form (e.g. "NQ12 FBBY GJ2V ..."), so strip all
  // whitespace before comparing.
  const normalized = value.replace(/\s+/g, "").trim();
  if (!normalized) return undefined;
  return normalized.toLowerCase();
}

function getEffectiveSender(transaction: Record<string, unknown>): string | undefined {
  let sender = normalizeWallet(transaction.fromAddress ?? transaction.sender ?? transaction.from);
  const fromType = transaction.fromType ?? transaction.senderType;
  const proof = transaction.proof;
  if (fromType === 2 && typeof proof === "string") {
    try {
      const decodedProof = HashedTimeLockedContract.proofToPlain(Uint8Array.from(Buffer.from(proof, "hex")));
      if ("creator" in decodedProof && typeof decodedProof.creator === "string") {
        sender = normalizeWallet(decodedProof.creator);
      }
    } catch (error) {
      console.error("Failed to decode HTLC sender proof for funding verification", {
        error: error instanceof Error ? error.message : error
      });
    }
  }
  return sender;
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
    let effectiveSender = getEffectiveSender(transaction);
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