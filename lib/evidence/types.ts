/**
 * Evidence exists only in browser memory. It must never be serialized into a
 * receipt, persisted by ArcProof, or passed to an anchoring strategy.
 */
export type FileEvidence = {
  kind: "file";
  file: File;
};

export type C2PAEvidence = {
  kind: "c2pa";
  file: File;
};

export type Evidence = FileEvidence | C2PAEvidence;
