import type { ManifestStore } from "@contentauth/c2pa-web";
import type { C2PAProvenanceCommitment } from "@/lib/commitment/types";
import type { VerificationCheck } from "@/lib/verification/types";

export type C2PAInspectionState = "verified" | "invalid" | "none" | "unavailable";

export type C2PASummary = {
  manifest: VerificationCheck;
  assetIntegrity: VerificationCheck;
  signature: VerificationCheck;
  signerTrust: VerificationCheck;
  timestampTrust: VerificationCheck;
  claimGenerator?: string;
  issuer?: string;
  aiDisclosure?: string;
  warnings: string[];
  errors: string[];
};

export type C2PAInspection = {
  state: C2PAInspectionState;
  canAnchor: boolean;
  summary: C2PASummary;
  manifestStore?: ManifestStore;
  provenance?: C2PAProvenanceCommitment;
};
