# ArcProof

ArcProof is a small proof-of-existence application built for the Arc Microgrants program. It creates a public, timestamped record for a file without uploading or revealing the file.

## What it does

1. The user chooses a local file.
2. The browser computes a SHA-256 fingerprint with the Web Crypto API.
3. The file remains on the device; only its 32-byte fingerprint is sent to the wallet.
4. `ProofRegistry` records the fingerprint, submitting address, block timestamp, and block number on Arc.
5. Selecting the same file later retrieves its original proof.
6. `/verify/[fileHash]` provides a shareable, read-only view without requiring the original file or a wallet.

## Why Arc

Arc provides ArcProof's public, timestamped, tamper-resistant verification layer. Its EVM compatibility keeps the contract small and reviewable, deterministic finality makes registrations available quickly, and USDC-denominated fees make costs easier to understand. Arc replaces a private timestamping server or database: anyone can inspect the contract and verify the same file independently.

## Privacy

The file is read by browser code solely to calculate SHA-256. It is never uploaded, sent to an API, placed in browser storage, or written onchain. Filenames and personal information are not submitted. Only the hash and registering wallet address become public.

## Architecture

```text
local file
    │
    ▼
Browser Web Crypto SHA-256
    │  bytes32 only
    ▼
EVM wallet
    │  registerProof(fileHash)
    ▼
ProofRegistry smart contract
    │
    ▼
Arc public verification + ArcScan
```

There is no backend, database, login, admin role, proxy, NFT, or custom token. `blockNumber` is stored so the frontend can retrieve the registration event and transaction hash with a one-block log query.

## Smart contract design

`ProofRegistry` is an immutable, append-only mapping keyed by `bytes32` SHA-256 hashes. `registerProof` rejects the zero hash and any hash that already exists, then records `msg.sender`, `block.timestamp`, and `block.number`. `getProof` and `proofExists` are read-only. The contract has no administrator, ownership transfer, upgrade mechanism, external calls, payable functions, token logic, or withdrawal path.

## Network configuration

The application runtime is intentionally restricted to Arc Testnet.

| Setting | Arc Testnet |
| --- | --- |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network/` |
| Explorer | `https://testnet.arcscan.app` |
| Native gas token | USDC, 18 decimals |
| Minimum `maxFeePerGas` | 20 gwei |

Verified testnet deployment:

- Contract: [`0x60Bdf53BF9dB5821d032252DffCC95f20aA5C6e1`](https://testnet.arcscan.app/address/0x60Bdf53BF9dB5821d032252DffCC95f20aA5C6e1)
- Deployment transaction: [`0x438c8986b0a792aed0a740e43d0466946609497eb6524bd0cc3e56639936abcb`](https://testnet.arcscan.app/tx/0x438c8986b0a792aed0a740e43d0466946609497eb6524bd0cc3e56639936abcb)
- Creation block: `65426425`

Mainnet is defined separately for future readiness but is not exposed by the wallet provider. The official configuration currently recorded for future review is chain ID `5042`, RPC `https://rpc.mainnet.arc.io`, and explorer `https://explorer.arc.io`. Recheck these against the [official Arc RPC reference](https://docs.arc.io/arc/references/rpc-endpoints) immediately before deployment.

## Running locally

Requires Node.js 22 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Local hashing works without a deployed contract.

## Testing

```bash
npm run contract:test
npm test
npm run lint
npm run typecheck
npm run build
```

Contract tests compile Solidity, deploy to an in-memory EVM, and verify registration, lookup, duplicate rejection, and zero-hash rejection. Hash tests cover a standard SHA-256 vector, filename independence, and distinct contents.

## Testnet deployment

Use [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry) with a password-protected local keystore or hardware wallet. Never put a seed phrase or raw private key in this repository or a shell command. Fund the deployer with testnet USDC from the [Circle faucet](https://faucet.circle.com).

Import a dedicated testnet key directly into Foundry's encrypted keystore from a private terminal:

```bash
arc-cast wallet import arcproof-testnet
```

Before broadcasting, record the public deployer address and verify network and balance:

```bash
arc-cast chain-id --rpc-url https://rpc.testnet.arc.network/
arc-cast balance DEPLOYER_ADDRESS --ether --rpc-url https://rpc.testnet.arc.network/
```

The chain ID must be `5042002`. After reviewing the deployer address, balance, and gas estimate, the exact deployment command is:

```bash
arc-forge create contracts/ProofRegistry.sol:ProofRegistry \
  --rpc-url https://rpc.testnet.arc.network/ \
  --account arcproof-testnet \
  --broadcast
```

Do not run the broadcast command until the deployer address, balance, target network, and expected gas cost have been reviewed and deployment is explicitly approved.

After deployment, place only the public address in `.env.local`:

```dotenv
NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network/
```

Restart the app and perform the three end-to-end checks: register a new fixture, reload and rediscover it, then select different content and confirm it has a different unregistered hash.

## Deploying the frontend

ArcProof is a standard Next.js application and can be imported into Vercel without a custom build configuration. Configure these variables for Production, Preview, and Development:

```dotenv
NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS=0x60Bdf53BF9dB5821d032252DffCC95f20aA5C6e1
NEXT_PUBLIC_ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network/
```

The first variable is required. The second is recommended and otherwise defaults to the same public RPC. Neither value is secret. The homepage is statically generated, while `/verify/[fileHash]` is rendered on demand and reads Arc directly. Browser wallet registration remains client-side.

## Mainnet deployment

**Status: not deployed.** ArcProof currently runs on Arc Testnet only. Mainnet deployment is not part of the current release. Before any future broadcast:

1. Revalidate chain ID, RPC, explorer, fee rules, and Arc Foundry guidance against official Arc documentation.
2. Create a separate encrypted mainnet keystore backed by a dedicated wallet.
3. Complete the full test suite and Arc Testnet end-to-end workflow.
4. Estimate deployment gas and convert it to the required native USDC amount.
5. Display the deployer address, balance, exact network, estimated maximum fee, and exact command.
6. Obtain explicit approval before broadcasting or signing anything.
7. Configure a separate public mainnet registry address rather than overwriting testnet records.

## Security considerations

- Duplicate hashes cannot overwrite earlier proofs, and the zero hash is rejected.
- The contract has no owner, administrator, privileged functions, upgrade mechanism, payable functions, withdrawals, external calls, token logic, or NFT logic.
- Timestamps come from the Arc block and have normal blockchain timestamp semantics.
- SHA-256 hides ordinary file contents, but hashes of easily guessed content can be reproduced.
- Wallet addresses, hashes, timestamps, blocks, and transactions are permanently public.
- Environment files, key files, keystores, wallet files, Foundry broadcasts, build output, and logs are ignored by Git.

## Limitations

- ArcProof proves that a specific hash was registered at a particular time.
- It does not prove legal ownership of the underlying file.
- It does not validate the truth, safety, authorship, or contents of a document.
- Anyone who possesses a file can independently hash and verify it.
- A verification URL identifies a hash; it cannot reveal or reconstruct the original file.
