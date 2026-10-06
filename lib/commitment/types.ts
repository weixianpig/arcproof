export type Bytes32 = `0x${string}`;

export type FileHashCommitment = {
  type: "file";
  algorithm: "sha256";
  commitment: Bytes32;
};

export type C2PAProvenanceCommitment = {
  type: "c2pa-provenance";
  algorithm: "arcproof-c2pa-v1";
  commitment: Bytes32;
  contentHash: Bytes32;
  manifestHash: Bytes32;
};

export type ProofCommitment =
  | FileHashCommitment
  | C2PAProvenanceCommitment;
