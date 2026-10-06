import type { ProofCommitment } from "@/lib/commitment/types";

export type DirectArcAnchor = {
  strategy: "direct";
  chainId: 5042;
  registry: `0x${string}`;
  transactionHash: `0x${string}`;
  blockNumber: string;
  /** Arc block timestamp expressed as decimal Unix seconds. */
  timestamp: string;
  registrant: `0x${string}`;
};

// This union is the extension point for a future Merkle anchor. Only the
// direct strategy is accepted or emitted in the current protocol version.
export type ArcAnchor = DirectArcAnchor;

export interface AnchorStrategy<TAnchor extends ArcAnchor = ArcAnchor> {
  anchor(commitment: ProofCommitment): Promise<TAnchor>;
}
