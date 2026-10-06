import type { DirectArcAnchor } from "./types";

export type DirectAnchorInput = Omit<DirectArcAnchor, "strategy" | "chainId">;

export function createDirectArcAnchor(
  input: DirectAnchorInput,
): DirectArcAnchor {
  return {
    strategy: "direct",
    chainId: 5042,
    ...input,
  };
}

export function directAnchorsEqual(
  receiptAnchor: DirectArcAnchor,
  chainAnchor: DirectArcAnchor,
): boolean {
  return (
    receiptAnchor.strategy === chainAnchor.strategy &&
    receiptAnchor.chainId === chainAnchor.chainId &&
    receiptAnchor.registry.toLowerCase() === chainAnchor.registry.toLowerCase() &&
    receiptAnchor.transactionHash.toLowerCase() ===
      chainAnchor.transactionHash.toLowerCase() &&
    receiptAnchor.blockNumber === chainAnchor.blockNumber &&
    receiptAnchor.timestamp === chainAnchor.timestamp &&
    receiptAnchor.registrant.toLowerCase() ===
      chainAnchor.registrant.toLowerCase()
  );
}
