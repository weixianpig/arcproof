import type { DirectArcAnchor } from "@/lib/anchor/types";
import type { C2PAProvenanceCommitment, FileHashCommitment } from "@/lib/commitment/types";

export type StandardProofReceipt = {
  protocol: "arcproof";
  version: "1.0";
  proof: FileHashCommitment;
  anchor: DirectArcAnchor;
};

export type ProvenanceProofReceipt = {
  protocol: "arcproof";
  version: "2.0";
  proof: C2PAProvenanceCommitment;
  anchor: DirectArcAnchor;
};

export type ArcProofReceipt = StandardProofReceipt | ProvenanceProofReceipt;
