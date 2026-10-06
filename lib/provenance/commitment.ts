import type { C2PAProvenanceCommitment } from "@/lib/commitment/types";
import { hashText } from "@/lib/hash";
import { canonicalize, canonicalizeManifestStore } from "./canonicalize";

export const C2PA_COMMITMENT_DOMAIN = "ARCPROOF:C2PA:V1";

export async function createProvenanceCommitment(
  contentHash: `0x${string}`,
  manifestStore: unknown,
): Promise<C2PAProvenanceCommitment> {
  const manifestHash = await hashText(canonicalizeManifestStore(manifestStore));
  const payload = canonicalize({
    contentHash,
    manifestHash,
    protocol: "arcproof",
    type: "c2pa-provenance",
    version: 2,
  });
  const commitment = await hashText(`${C2PA_COMMITMENT_DOMAIN}\n${payload}`);

  return {
    type: "c2pa-provenance",
    algorithm: "arcproof-c2pa-v1",
    commitment,
    contentHash,
    manifestHash,
  };
}
