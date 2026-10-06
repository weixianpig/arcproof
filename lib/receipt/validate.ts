import type { ArcProofReceipt } from "./types";

const HASH = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

export class ReceiptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptValidationError";
  }
}

export function validateReceipt(value: unknown): ArcProofReceipt {
  if (!isRecord(value)) throw new ReceiptValidationError("Receipt must be a JSON object.");
  if (value.protocol !== "arcproof") throw new ReceiptValidationError("Unsupported receipt protocol.");
  if (value.version !== "1.0" && value.version !== "2.0") throw new ReceiptValidationError("Unsupported receipt version.");
  if (!hasExactKeys(value, ["protocol", "version", "proof", "anchor"])) {
    throw new ReceiptValidationError("Receipt contains missing or unexpected fields.");
  }

  const proof = value.proof;
  if (!isRecord(proof)) {
    throw new ReceiptValidationError("Invalid proof commitment.");
  }
  if (typeof proof.commitment !== "string" || !HASH.test(proof.commitment)) {
    throw new ReceiptValidationError("Commitment must be a 32-byte hexadecimal hash.");
  }
  if (value.version === "1.0") {
    if (!hasExactKeys(proof, ["type", "algorithm", "commitment"]) || proof.type !== "file" || proof.algorithm !== "sha256") {
      throw new ReceiptValidationError("Unsupported Standard Proof commitment.");
    }
  } else {
    if (!hasExactKeys(proof, ["type", "algorithm", "commitment", "contentHash", "manifestHash"]) ||
      proof.type !== "c2pa-provenance" || proof.algorithm !== "arcproof-c2pa-v1") {
      throw new ReceiptValidationError("Unsupported provenance commitment.");
    }
    if (typeof proof.contentHash !== "string" || !HASH.test(proof.contentHash) ||
      typeof proof.manifestHash !== "string" || !HASH.test(proof.manifestHash)) {
      throw new ReceiptValidationError("Invalid provenance hashes.");
    }
  }

  const anchor = value.anchor;
  if (!isRecord(anchor) || !hasExactKeys(anchor, [
    "strategy",
    "chainId",
    "registry",
    "transactionHash",
    "blockNumber",
    "timestamp",
    "registrant",
  ])) {
    throw new ReceiptValidationError("Invalid Arc anchor.");
  }
  if (anchor.strategy !== "direct") throw new ReceiptValidationError("Unsupported anchor strategy.");
  if (anchor.chainId !== 5042) throw new ReceiptValidationError("Receipt is not anchored to Arc Mainnet.");
  if (typeof anchor.registry !== "string" || !ADDRESS.test(anchor.registry)) {
    throw new ReceiptValidationError("Invalid registry address.");
  }
  if (typeof anchor.transactionHash !== "string" || !HASH.test(anchor.transactionHash)) {
    throw new ReceiptValidationError("Invalid transaction hash.");
  }
  if (typeof anchor.registrant !== "string" || !ADDRESS.test(anchor.registrant)) {
    throw new ReceiptValidationError("Invalid registrant address.");
  }
  if (typeof anchor.blockNumber !== "string" || !DECIMAL.test(anchor.blockNumber)) {
    throw new ReceiptValidationError("Invalid block number.");
  }
  if (typeof anchor.timestamp !== "string" || !DECIMAL.test(anchor.timestamp)) {
    throw new ReceiptValidationError("Invalid block timestamp.");
  }

  return value as ArcProofReceipt;
}

export function parseReceipt(json: string): ArcProofReceipt {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new ReceiptValidationError("Receipt is not valid JSON.");
  }
  return validateReceipt(value);
}
