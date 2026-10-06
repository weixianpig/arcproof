import type { DirectArcAnchor } from "@/lib/anchor/types";
import type { C2PAProvenanceCommitment, FileHashCommitment } from "@/lib/commitment/types";
import type { ArcProofReceipt, ProvenanceProofReceipt, StandardProofReceipt } from "./types";

export function createStandardReceipt(
  proof: FileHashCommitment,
  anchor: DirectArcAnchor,
): StandardProofReceipt {
  return {
    protocol: "arcproof",
    version: "1.0",
    proof: { ...proof },
    anchor: { ...anchor },
  };
}

export function createProvenanceReceipt(
  proof: C2PAProvenanceCommitment,
  anchor: DirectArcAnchor,
): ProvenanceProofReceipt {
  return {
    protocol: "arcproof",
    version: "2.0",
    proof: { ...proof },
    anchor: { ...anchor },
  };
}

export function serializeReceipt(receipt: ArcProofReceipt): string {
  return `${JSON.stringify(receipt, null, 2)}\n`;
}
