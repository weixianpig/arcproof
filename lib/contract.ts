export const proofRegistryAbi = [
  {
    type: "function",
    name: "registerProof",
    stateMutability: "nonpayable",
    inputs: [{ name: "fileHash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getProof",
    stateMutability: "view",
    inputs: [{ name: "fileHash", type: "bytes32" }],
    outputs: [
      { name: "submitter", type: "address" },
      { name: "timestamp", type: "uint64" },
      { name: "blockNumber", type: "uint64" },
    ],
  },
  {
    type: "function",
    name: "proofExists",
    stateMutability: "view",
    inputs: [{ name: "fileHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "ProofRegistered",
    inputs: [
      { name: "fileHash", type: "bytes32", indexed: true },
      { name: "submitter", type: "address", indexed: true },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
] as const;
