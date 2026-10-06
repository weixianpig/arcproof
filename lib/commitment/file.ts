import type { FileHashCommitment } from "./types";

export function createFileHashCommitment(
  hash: `0x${string}`,
): FileHashCommitment {
  return {
    type: "file",
    algorithm: "sha256",
    commitment: hash,
  };
}
