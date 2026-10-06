import { directAnchorsEqual } from "@/lib/anchor/direct";
import {
  readDirectArcAnchor,
  type DirectAnchorReader,
} from "@/lib/anchor/verify";
import { registryAddress } from "@/lib/arc";
import type { ArcProofReceipt, StandardProofReceipt } from "@/lib/receipt/types";
import type { C2PAProvenanceCommitment } from "@/lib/commitment/types";
import type { ReceiptVerificationResult, VerificationCheck } from "./types";

const verified = (message: string): VerificationCheck => ({ status: "verified", message });
const failed = (message: string): VerificationCheck => ({ status: "failed", message });
const unavailable = (message: string): VerificationCheck => ({ status: "unavailable", message });

export async function verifyReceiptAnchor(
  receipt: ArcProofReceipt,
  readAnchor: DirectAnchorReader = readDirectArcAnchor,
  expectedRegistry: `0x${string}` | undefined = registryAddress,
): Promise<ReceiptVerificationResult> {
  const receiptCheck = verified("Receipt schema and protocol version are valid.");

  if (!expectedRegistry) {
    return {
      receipt: receiptCheck,
      commitment: unavailable("The configured ArcProof registry is unavailable."),
      anchor: unavailable("The Arc anchor could not be checked."),
      verified: false,
    };
  }

  if (receipt.anchor.registry.toLowerCase() !== expectedRegistry.toLowerCase()) {
    return {
      receipt: receiptCheck,
      commitment: failed("The receipt names a different registry."),
      anchor: failed("The Arc anchor does not belong to this ArcProof deployment."),
      verified: false,
    };
  }

  try {
    const chainAnchor = await readAnchor(receipt.proof);
    if (!chainAnchor) {
      return {
        receipt: receiptCheck,
        commitment: failed("The commitment is not registered in ProofRegistry."),
        anchor: failed("No matching direct Arc anchor was found."),
        verified: false,
      };
    }

    const matches = directAnchorsEqual(receipt.anchor, chainAnchor);
    return {
      receipt: receiptCheck,
      commitment: verified("The receipt commitment exists in ProofRegistry."),
      anchor: matches
        ? verified("Every receipt anchor field matches Arc Mainnet.")
        : failed("One or more receipt anchor fields differ from Arc Mainnet."),
      verified: matches,
    };
  } catch {
    return {
      receipt: receiptCheck,
      commitment: unavailable("Arc Mainnet could not be reached."),
      anchor: unavailable("The anchor could not be independently checked."),
      verified: false,
    };
  }
}

export const verifyStandardReceipt = verifyReceiptAnchor as (
  receipt: StandardProofReceipt,
  readAnchor?: DirectAnchorReader,
  expectedRegistry?: `0x${string}`,
) => Promise<ReceiptVerificationResult>;

export function verifyFileHashAgainstReceipt(
  fileHash: `0x${string}`,
  receipt: ArcProofReceipt,
): VerificationCheck {
  return fileHash.toLowerCase() === receipt.proof.commitment.toLowerCase()
    ? verified("The selected file matches the receipt commitment.")
    : failed("The selected file does not match the receipt commitment.");
}

export function provenanceCommitmentMatchesReceipt(
  reproduced: C2PAProvenanceCommitment | undefined,
  receipt: Extract<ArcProofReceipt, { version: "2.0" }>,
): boolean {
  return Boolean(
    reproduced &&
    reproduced.contentHash.toLowerCase() === receipt.proof.contentHash.toLowerCase() &&
    reproduced.manifestHash.toLowerCase() === receipt.proof.manifestHash.toLowerCase() &&
    reproduced.commitment.toLowerCase() === receipt.proof.commitment.toLowerCase(),
  );
}
