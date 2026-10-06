# ArcProof

ArcProof is privacy-preserving provenance and verification infrastructure built for the Arc Microgrants program. It creates public, timestamped records for private files and embedded C2PA Content Credentials without uploading or revealing the original evidence.

## What it does

1. Standard mode computes a file's SHA-256 fingerprint with the Web Crypto API.
2. Provenance mode additionally validates an embedded C2PA manifest in browser WebAssembly.
3. The browser produces either a file commitment or a domain-separated provenance commitment.
4. The file remains on the device; only the 32-byte commitment is sent to the wallet.
5. `ProofRegistry` records the commitment, submitting address, block timestamp, and block number on Arc.
6. Public proof URLs and portable JSON receipts can be checked without a wallet.
7. Supplying the original evidence to `/verify/receipt` reproduces its commitment locally.

## Why Arc

Arc provides ArcProof's public, timestamped, tamper-resistant verification layer. Its EVM compatibility keeps the contract small and reviewable, deterministic finality makes registrations available quickly, and USDC-denominated fees make costs easier to understand. Arc replaces a private timestamping server or database: anyone can inspect the contract and verify the same file independently.

## Privacy

Selected evidence is read only by browser code and the ArcProof-hosted C2PA Web Worker. It is never uploaded, sent to an API, placed in browser storage, or written onchain. Filenames and extracted metadata are not submitted. Only the commitment and registering wallet address become public.

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
Arc public verification + Arc Explorer
```

There is no backend, database, login, admin role, proxy, NFT, or custom token. `blockNumber` is stored so the frontend can retrieve the registration event and transaction hash with a one-block log query.

### Protocol architecture

```text
                     ARC PROOF

                PRIVATE EVIDENCE
                      │
      ┌───────────────┼───────────────┐
      │                               │
      ▼                               ▼
   FILE                         C2PA MEDIA
      │                               │
   SHA-256                    verify locally
      │                               │
      └───────────────┬───────────────┘
                      ▼
             PROOF COMMITMENT
                      │
                ┌─────┴─────┐
                │           │
              Direct      Merkle
                │           │
                └─────┬─────┘
                      ▼
                 ARC MAINNET
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
    Timestamp      Portable       Provenance
                   Receipt          Proof
        │             │             │
        └─────────────┼─────────────┘
                      ▼
              PUBLIC VERIFIER
                      │
            no original uploaded
```

ArcProof separates private evidence, deterministic commitments, anchor strategies, portable receipts, and verification. The website is one implementation of that protocol; a third-party implementation can reproduce a commitment and verify its Arc anchor without trusting ArcProof.

Today, file commitments, embedded-C2PA provenance commitments, the direct Arc anchor, portable receipts, and wallet-free verification are implemented. Merkle batching is a planned strategy only: ArcProof does not currently build Merkle trees, publish roots, or generate inclusion proofs.

The invariant across every strategy is that ArcProof never needs to upload or store the original evidence.

## Portable receipts

A Standard Proof receipt uses protocol version `1.0`:

```json
{
  "protocol": "arcproof",
  "version": "1.0",
  "proof": {
    "type": "file",
    "algorithm": "sha256",
    "commitment": "0x..."
  },
  "anchor": {
    "strategy": "direct",
    "chainId": 5042,
    "registry": "0x...",
    "transactionHash": "0x...",
    "blockNumber": "24277769",
    "timestamp": "1760000000",
    "registrant": "0x..."
  }
}
```

Block numbers and timestamps are decimal strings so they remain lossless in JSON. The timestamp is Unix seconds copied from the contract's stored Arc block timestamp.

A Provenance Proof receipt uses version `2.0` and replaces the `proof` object with:

```json
{
  "type": "c2pa-provenance",
  "algorithm": "arcproof-c2pa-v1",
  "commitment": "0x...",
  "contentHash": "0x...",
  "manifestHash": "0x..."
}
```

`/verify/receipt` strictly validates the schema and supported strategy, confirms the configured chain and registry, reads the commitment from `ProofRegistry`, retrieves its registration event, and compares the registrant, timestamp, block, and transaction hash. An optional original file is hashed locally for a separate file-match result. The receipt is not a signed certificate; its claims are established by reproducing the commitment and comparing them with Arc.

Future anchor strategies can extend the discriminated `anchor.strategy` model without changing what constitutes private evidence or a proof commitment. Unsupported versions and strategies are currently rejected.

## C2PA provenance commitment

ArcProof uses `@contentauth/c2pa-web@0.15.3`, backed by `c2pa-rs` WebAssembly. The SDK is loaded only when Provenance mode is selected. Its version-matched WASM and worker are copied from the installed package and served by ArcProof under `/vendor/c2pa/`; no third-party runtime CDN is used.

The commitment algorithm is exactly:

1. `contentHash = SHA-256(original media bytes)`.
2. Build `{ "active_manifest": ..., "manifests": ... }` from the validated `ManifestStore`.
3. Recursively omit verifier-run fields named `validation_status`, `validation_results`, `validation_state`, `validationTime`, and `validation_time`.
4. Canonicalize JSON by sorting object keys lexicographically, retaining array order, using JSON primitive encoding, and encoding the result as UTF-8.
5. `manifestHash = SHA-256(canonical manifest bytes)`.
6. Canonicalize this payload using the same rules:

```json
{
  "contentHash": "0x...",
  "manifestHash": "0x...",
  "protocol": "arcproof",
  "type": "c2pa-provenance",
  "version": 2
}
```

7. `commitment = SHA-256(UTF-8("ARCPROOF:C2PA:V1\n") || UTF-8(canonical payload))`.

The hexadecimal hashes inside the payload include their lowercase `0x` prefix. Only the final 32-byte commitment is registered through the existing `ProofRegistry`.

### C2PA privacy boundary

ArcProof supports embedded C2PA manifests only. `remoteManifestFetch` and `ocspFetch` are explicitly disabled. External manifest servers are never contacted, requests are never proxied, and an unavailable external credential is not described as invalid. Because the current browser SDK cannot reliably expose an external manifest URL before fetching it, remote C2PA manifests are intentionally unsupported in this version.

Validation results distinguish manifest detection, media integrity, cryptographic signature validity, signer trust, timestamp trust, and validation warnings. A valid signature is not described as an authentic image, trusted creator, or proof that the media is true.

## Smart contract design

`ProofRegistry` is an immutable, append-only mapping keyed by `bytes32` SHA-256 hashes. `registerProof` rejects the zero hash and any hash that already exists, then records `msg.sender`, `block.timestamp`, and `block.number`. `getProof` and `proofExists` are read-only. The contract has no administrator, ownership transfer, upgrade mechanism, external calls, payable functions, token logic, or withdrawal path.

## Network configuration

The production application runs exclusively on Arc Mainnet.

| Setting | Arc Mainnet |
| --- | --- |
| Chain ID | `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| Native gas token | USDC, 18 decimals |

Verified mainnet deployment:

- Contract: [`0x3443f82f20f20b12B8c6EDD79379CE265E729ccE`](https://explorer.arc.io/address/0x3443f82f20f20b12B8c6EDD79379CE265E729ccE)
- Deployment transaction: [`0xe3725e926e34ef4a217dfa5175c2bcc5b04cf6ccab58391b29fbf349bbfd5bf1`](https://explorer.arc.io/tx/0xe3725e926e34ef4a217dfa5175c2bcc5b04cf6ccab58391b29fbf349bbfd5bf1)
- Deployment block: `24277769`

Historical testnet deployment:

- Chain ID: `5042002`
- Contract: [`0x60Bdf53BF9dB5821d032252DffCC95f20aA5C6e1`](https://testnet.arcscan.app/address/0x60Bdf53BF9dB5821d032252DffCC95f20aA5C6e1)
- Deployment transaction: [`0x438c8986b0a792aed0a740e43d0466946609497eb6524bd0cc3e56639936abcb`](https://testnet.arcscan.app/tx/0x438c8986b0a792aed0a740e43d0466946609497eb6524bd0cc3e56639936abcb)

## Running locally

Requires Node.js 22 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `postinstall`, `predev`, and `prebuild` copy the pinned C2PA WASM and worker into the ignored `public/vendor/c2pa` directory. On HTTPS deployments the worker is served from that same-origin path; local HTTP development uses the SDK's blob worker because version `0.15.3` requires an HTTPS URL for an explicit worker source. The WASM remains same-origin in both cases.

## Testing

```bash
npm run contract:test
npm test
npm run lint
npm run typecheck
npm run build
```

Contract tests compile Solidity, deploy to an in-memory EVM, and verify registration, lookup, duplicate rejection, and zero-hash rejection. Hash tests cover a standard SHA-256 vector, filename independence, and distinct contents. Receipt tests cover deterministic generation, strict validation, malformed and unsupported receipts, local file mismatches, independent anchor verification, and modified receipt detection. Provenance tests cover canonicalization, domain separation, changed content and manifests, v2 receipt round trips, disabled remote networking, same-origin SDK assets, and licensed C2PA fixtures.

## Contract deployment

Use [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry) with a password-protected local keystore or hardware wallet. Never put a seed phrase or raw private key in this repository or a shell command. Arc uses native USDC for gas.

Import a dedicated testnet key directly into Foundry's encrypted keystore from a private terminal:

```bash
arc-cast wallet import arcproof-mainnet
```

Before broadcasting, record the public deployer address and verify network and balance:

```bash
arc-cast chain-id --rpc-url https://rpc.mainnet.arc.io
arc-cast balance DEPLOYER_ADDRESS --ether --rpc-url https://rpc.mainnet.arc.io
```

The chain ID must be `5042`. After reviewing the deployer address, balance, and gas estimate, deploy only with explicit approval:

```bash
arc-forge create contracts/ProofRegistry.sol:ProofRegistry \
  --rpc-url https://rpc.mainnet.arc.io \
  --chain 5042 \
  --account arcproof-mainnet \
  --broadcast
```

Do not run the broadcast command until the deployer address, balance, target network, and expected gas cost have been reviewed and deployment is explicitly approved.

After deployment, place only the public address in `.env.local`:

```dotenv
NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS=0x3443f82f20f20b12B8c6EDD79379CE265E729ccE
NEXT_PUBLIC_ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
```

Restart the app and verify contract reads before submitting a registration.

## Deploying the frontend

ArcProof is a standard Next.js application and can be imported into Vercel without a custom build configuration. Configure these variables for Production, Preview, and Development:

```dotenv
NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS=0x3443f82f20f20b12B8c6EDD79379CE265E729ccE
NEXT_PUBLIC_ARC_MAINNET_RPC_URL=https://rpc.mainnet.arc.io
```

The first variable is required. The second is recommended and otherwise defaults to the same public RPC. Neither value is secret. The homepage is statically generated, while `/verify/[fileHash]` and `/verify/provenance/[commitment]` are rendered on demand and read Arc directly. Browser wallet registration remains client-side. Vercel's normal install/build lifecycle generates the same-origin C2PA assets automatically.

## Mainnet status

ArcProof is deployed on Arc Mainnet and the production frontend is configured for chain `5042`. The testnet chain definition remains in the source only as historical/development configuration; it is not included in the production wagmi provider.

## Security considerations

- Duplicate hashes cannot overwrite earlier proofs, and the zero hash is rejected.
- The contract has no owner, administrator, privileged functions, upgrade mechanism, payable functions, withdrawals, external calls, token logic, or NFT logic.
- Timestamps come from the Arc block and have normal blockchain timestamp semantics.
- SHA-256 hides ordinary file contents, but hashes of easily guessed content can be reproduced.
- Wallet addresses, hashes, timestamps, blocks, and transactions are permanently public.
- C2PA metadata can contain identifying information. ArcProof displays a conservative local summary but does not include that metadata in receipts or place it onchain.
- Environment files, key files, keystores, wallet files, Foundry broadcasts, build output, and logs are ignored by Git.

## Limitations

- ArcProof proves that a specific cryptographic commitment was registered at a particular time.
- It does not prove legal ownership of the underlying file.
- It does not validate the truth, safety, authorship, or contents of a document.
- Anyone who possesses a file can independently hash and verify it.
- A verification URL identifies a hash; it cannot reveal or reconstruct the original file.
- Provenance mode supports embedded Content Credentials only; externally referenced manifests and live OCSP checks are unavailable by design.
