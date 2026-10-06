import { createPublicClient, http, type Hash } from "viem";
import { ARC_MAINNET_RPC, arcMainnet, registryAddress } from "@/lib/arc";
import { proofRegistryAbi } from "@/lib/contract";
import { createDirectArcAnchor } from "./direct";
import type { DirectArcAnchor } from "./types";

export type DirectAnchorReader = (
  commitment: { commitment: `0x${string}` },
) => Promise<DirectArcAnchor | undefined>;

const client = createPublicClient({
  chain: arcMainnet,
  transport: http(ARC_MAINNET_RPC),
});

export const readDirectArcAnchor: DirectAnchorReader = async (commitment) => {
  if (!registryAddress) return undefined;

  const fileHash = commitment.commitment as Hash;
  const exists = await client.readContract({
    address: registryAddress,
    abi: proofRegistryAbi,
    functionName: "proofExists",
    args: [fileHash],
  });
  if (!exists) return undefined;

  const [registrant, timestamp, blockNumber] = await client.readContract({
    address: registryAddress,
    abi: proofRegistryAbi,
    functionName: "getProof",
    args: [fileHash],
  });
  const logs = await client.getContractEvents({
    address: registryAddress,
    abi: proofRegistryAbi,
    eventName: "ProofRegistered",
    args: { fileHash },
    fromBlock: blockNumber,
    toBlock: blockNumber,
  });
  const transactionHash = logs[0]?.transactionHash;
  if (!transactionHash) return undefined;

  return createDirectArcAnchor({
    registry: registryAddress,
    transactionHash,
    blockNumber: blockNumber.toString(),
    timestamp: timestamp.toString(),
    registrant,
  });
};
