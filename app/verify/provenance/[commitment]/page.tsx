import Link from "next/link";
import { isHash } from "viem";
import { arcMainnet } from "@/lib/arc";
import { readDirectArcAnchor } from "@/lib/anchor/verify";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ commitment: string }> };

export default async function ProvenanceVerificationPage({ params }: PageProps) {
  const { commitment } = await params;
  const validHash = isHash(commitment) && commitment.length === 66;
  let anchor;
  let readError = "";

  if (validHash) {
    try {
      anchor = await readDirectArcAnchor({ commitment: commitment as `0x${string}` });
    } catch {
      readError = "Arc Mainnet could not be reached. Try again shortly.";
    }
  }

  const date = anchor
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "long", timeZone: "UTC" }).format(Number(anchor.timestamp) * 1000)
    : "";

  return (
    <main className="shell">
      <nav>
        <Link className="brand" href="/">Arc<span>Proof</span></Link>
        <div className="network"><i /> Arc Mainnet</div>
      </nav>
      <section className="card verifyCard">
        {anchor ? (
          <>
            <span className="verifiedMark">✓</span>
            <h1>Arc Anchor <em>Verified</em></h1>
            <p className="lede">This provenance commitment was anchored to Arc Mainnet. The underlying media has not been reverified on this page.</p>
            <code className="verifyHash">{commitment}</code>
            <div className="proof">
              <dl>
                <div><dt>Registered on Arc</dt><dd>{date} UTC</dd></div>
                <div><dt>Registered by</dt><dd>{anchor.registrant}</dd></div>
                <div><dt>Transaction</dt><dd>{anchor.transactionHash}</dd></div>
                <div><dt>Block</dt><dd>{anchor.blockNumber}</dd></div>
              </dl>
              <div className="proofActions">
                <a href={`${arcMainnet.blockExplorers.default.url}/tx/${anchor.transactionHash}`} target="_blank" rel="noreferrer">View on Arc Explorer ↗</a>
              </div>
            </div>
          </>
        ) : (
          <>
            <h1>Provenance proof <em>not found</em></h1>
            <p className="lede">{!validHash ? "This URL does not contain a valid 32-byte commitment." : readError || "This provenance commitment has not been registered in the ArcProof registry."}</p>
            {validHash && <code className="verifyHash">{commitment}</code>}
          </>
        )}
        <p className="verifyDisclaimer">The original content is not stored by ArcProof. This page verifies only the Arc anchor. Full Provenance Verification requires the original media, its portable receipt, local C2PA reinspection, recomputed content and manifest hashes, a reproduced provenance commitment, and a matching Arc anchor.</p>
        <Link className="backLink" href="/">← Create or inspect a proof</Link>
      </section>
    </main>
  );
}
