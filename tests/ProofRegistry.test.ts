import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import ganache from "ganache";
import solc from "solc";
import { createPublicClient, createWalletClient, custom, defineChain, parseAbi, stringToHex, sha256 } from "viem";
import { readFile } from "node:fs/promises";

const abi = parseAbi([
  "function registerProof(bytes32 fileHash)",
  "function getProof(bytes32 fileHash) view returns (address submitter, uint64 timestamp, uint64 blockNumber)",
  "function proofExists(bytes32 fileHash) view returns (bool)",
  "event ProofRegistered(bytes32 indexed fileHash, address indexed submitter, uint64 timestamp)",
]);

describe("ProofRegistry", () => {
  const provider = ganache.provider({ chain: { hardfork: "shanghai", chainId: 1337 }, logging: { quiet: true } });
  const transport = custom(provider as never);
  const localChain = defineChain({
    id: 1337,
    name: "Ganache",
    nativeCurrency: { name: "Test Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  });
  const publicClient = createPublicClient({ chain: localChain, transport });
  const walletClient = createWalletClient({ chain: localChain, transport });
  let account: `0x${string}`;
  let contract: `0x${string}`;

  before(async () => {
    [account] = await walletClient.getAddresses();
    const source = await readFile(new URL("../contracts/ProofRegistry.sol", import.meta.url), "utf8");
    const input = {
      language: "Solidity",
      sources: { "ProofRegistry.sol": { content: source } },
      settings: { evmVersion: "shanghai", optimizer: { enabled: true, runs: 200 }, outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } } },
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    const errors = (output.errors ?? []).filter((entry: { severity: string }) => entry.severity === "error");
    assert.deepEqual(errors, []);
    const bytecode = output.contracts["ProofRegistry.sol"].ProofRegistry.evm.bytecode.object;
    const hash = await walletClient.deployContract({ abi, bytecode: `0x${bytecode}`, account, gas: BigInt(3_000_000) });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, "success", "contract deployment reverted");
    assert.ok(receipt.contractAddress);
    contract = receipt.contractAddress;
    assert.notEqual(await publicClient.getCode({ address: contract }), "0x", "deployed contract has no code");
  });

  after(async () => provider.disconnect());

  it("registers and retrieves a proof", async () => {
    const fileHash = sha256(stringToHex("arcproof fixture"));
    const tx = await walletClient.writeContract({ address: contract, abi, functionName: "registerProof", args: [fileHash], account });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    assert.equal(await publicClient.readContract({ address: contract, abi, functionName: "proofExists", args: [fileHash] }), true);
    const [submitter, timestamp, blockNumber] = await publicClient.readContract({ address: contract, abi, functionName: "getProof", args: [fileHash] });
    assert.equal(submitter.toLowerCase(), account.toLowerCase());
    assert.ok(timestamp > BigInt(0));
    assert.ok(blockNumber > BigInt(0));
  });

  it("rejects duplicate registrations", async () => {
    const fileHash = sha256(stringToHex("duplicate fixture"));
    const first = await walletClient.writeContract({ address: contract, abi, functionName: "registerProof", args: [fileHash], account });
    await publicClient.waitForTransactionReceipt({ hash: first });
    await assert.rejects(() => publicClient.simulateContract({ address: contract, abi, functionName: "registerProof", args: [fileHash], account }));
  });

  it("rejects the zero hash", async () => {
    await assert.rejects(() => publicClient.simulateContract({ address: contract, abi, functionName: "registerProof", args: [`0x${"00".repeat(32)}`], account }));
  });
});
