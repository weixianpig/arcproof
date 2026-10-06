import Link from "next/link";
import { ReceiptVerifier } from "@/components/ReceiptVerifier";

export const metadata = {
  title: "Verify receipt · ArcProof",
  description: "Independently verify a portable ArcProof receipt on Arc Mainnet.",
};

export default function ReceiptVerificationPage() {
  return (
    <main className="shell">
      <nav>
        <Link className="brand" href="/">Arc<span>Proof</span></Link>
        <div className="network"><i /> Arc Mainnet</div>
      </nav>
      <section className="card verifyCard receiptVerifierCard">
        <p className="eyebrow">PORTABLE PROOF</p>
        <h1>Verify a <em>receipt</em></h1>
        <p className="lede">Select an ArcProof receipt to check its commitment and transaction directly against Arc Mainnet. No wallet is required.</p>
        <ReceiptVerifier />
        <p className="verifyDisclaimer">Receipt and file processing happen in this browser. ArcProof proves that a specific cryptographic commitment was registered on Arc at a particular time. It does not prove ownership or that a file&apos;s contents are true.</p>
        <Link className="backLink" href="/">← Create or find a proof</Link>
      </section>
    </main>
  );
}
