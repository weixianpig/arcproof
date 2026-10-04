import { defineChain } from "viem";

export const ARC_TESTNET_RPC =
  process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "https://rpc.testnet.arc.network/";

export const ARC_MAINNET_RPC =
  process.env.NEXT_PUBLIC_ARC_MAINNET_RPC_URL ?? "https://rpc.mainnet.arc.io";

export const arcTestnet = defineChain({
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: [ARC_TESTNET_RPC] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
  fees: {
    baseFeeMultiplier: 1.2,
    defaultPriorityFee: BigInt(0),
  },
});

// Readiness-only: the wallet provider intentionally exposes testnet alone.
export const arcMainnet = defineChain({
  id: 5_042,
  name: "Arc",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: [ARC_MAINNET_RPC] } },
  blockExplorers: {
    default: { name: "Arc Explorer", url: "https://explorer.arc.io" },
  },
  fees: { baseFeeMultiplier: 1.2, defaultPriorityFee: BigInt(0) },
});

export const registryAddress = process.env.NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS as
  | `0x${string}`
  | undefined;
