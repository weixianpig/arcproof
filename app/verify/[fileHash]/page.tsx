import Link from "next/link";
import { createPublicClient, http, isHash, type Hash } from "viem";
import { arcMainnet, ARC_MAINNET_RPC, registryAddress } from "@/lib/arc";
import { proofRegistryAbi } from "@/lib/contract";

export const dynamic = "force-dynamic";

const client = createPublicClient({
  chain: arcMainnet,
  transport: http(ARC_MAINNET_RPC),
});

type PageProps = { params: Promise<{ fileHash: string }> };

export default async function VerificationPage({ params }: PageProps) {
  const { fileHash } = await params;
  const validHash = isHash(fileHash) && fileHash.length === 66;
  let proof:
    | { owner: `0x${string}`; timestamp: bigint; blockNumber: bigint; transactionHash?: Hash }
    | undefined;
  let readError = "";

  if (validHash && registryAddress) {
    try {
      const hash = fileHash as Hash;
      const exists = await client.readContract({
        address: registryAddress,
        abi: proofRegistryAbi,
        functionName: "proofExists",
        args: [hash],
      });
      if (exists) {
        const [owner, timestamp, blockNumber] = await client.readContract({
          address: registryAddress,
          abi: proofRegistryAbi,
          functionName: "getProof",
          args: [hash],
        });
        const logs = await client.getContractEvents({
          address: registryAddress,
          abi: proofRegistryAbi,
          eventName: "ProofRegistered",
          args: { fileHash: hash },
          fromBlock: blockNumber,
          toBlock: blockNumber,
        });
        proof = { owner, timestamp: BigInt(timestamp), blockNumber: BigInt(blockNumber), transactionHash: logs[0]?.transactionHash };
      }
    } catch {
      readError = "Arc Mainnet could not be reached. Try again shortly.";
    }
  }

  const date = proof
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "long",
        timeZone: "UTC",
      }).format(Number(proof.timestamp) * 1000)
    : "";

  return (
    <main className="shell">
      <nav>
        <Link className="brand" href="/">Arc<span>Proof</span></Link>
        <div className="network"><i /> Arc Mainnet</div>
      </nav>
      <section className="card verifyCard">
        {proof ? (
          <>
            <span className="verifiedMark">✓</span>
            <h1>ArcProof <em>Verified</em></h1>
            <p className="lede">This file fingerprint has a timestamped record on Arc Mainnet.</p>
            <code className="verifyHash">{fileHash}</code>
            <div className="proof">
              <dl>
                <div><dt>Registered on Arc</dt><dd>{date} UTC</dd></div>
                <div><dt>Registered by</dt><dd>{proof.owner}</dd></div>
                <div><dt>Transaction</dt><dd>{proof.transactionHash ?? "Event unavailable"}</dd></div>
                <div><dt>Block</dt><dd>{proof.blockNumber.toString()}</dd></div>
              </dl>
              {proof.transactionHash && (
                <div className="proofActions">
                  <a href={`${arcMainnet.blockExplorers.default.url}/tx/${proof.transactionHash}`} target="_blank" rel="noreferrer">View on Arc Explorer ↗</a>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <h1>Proof <em>not found</em></h1>
            <p className="lede">
              {!validHash
                ? "This URL does not contain a valid SHA-256 hash."
                : !registryAddress
                  ? "ArcProof is not connected to a deployed registry yet."
                  : readError || "This hash has not been registered in the configured Arc Mainnet registry."}
            </p>
            {validHash && <code className="verifyHash">{fileHash}</code>}
          </>
        )}
        <p className="verifyDisclaimer">ArcProof proves that this specific hash was registered at a particular time. It does not prove ownership of the underlying document or establish that its contents are true.</p>
        <Link className="backLink" href="/">← Verify a file</Link>
      </section>
    </main>
  );
}
