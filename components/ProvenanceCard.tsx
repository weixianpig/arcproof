import type { C2PAInspection } from "@/lib/provenance/types";
import type { VerificationCheck } from "@/lib/verification/types";

function Row({ label, check }: { label: string; check: VerificationCheck }) {
  const value = check.status === "verified" ? "Verified" : check.status === "failed" ? "Failed" : "Unavailable";
  return (
    <div className={`credentialRow ${check.status}`} title={check.message}>
      <span>{label}</span><strong>{value}</strong>
    </div>
  );
}

export function ProvenanceCard({ inspection }: { inspection: C2PAInspection }) {
  return (
    <section className="provenanceCard">
      <div className="provenanceHeading"><span>CONTENT CREDENTIALS</span><small>Analyzed locally</small></div>
      <Row label="Manifest" check={inspection.summary.manifest} />
      <Row label="Asset integrity" check={inspection.summary.assetIntegrity} />
      <Row label="Signature" check={inspection.summary.signature} />
      <Row label="Signer trust" check={inspection.summary.signerTrust} />
      <Row label="Timestamp trust" check={inspection.summary.timestampTrust} />
      {inspection.summary.claimGenerator && <div className="credentialDetail"><span>Claim generator</span><strong>{inspection.summary.claimGenerator}</strong></div>}
      {inspection.summary.issuer && <div className="credentialDetail"><span>Signer / issuer</span><strong>{inspection.summary.issuer}</strong></div>}
      {inspection.summary.aiDisclosure && <div className="credentialDetail"><span>AI disclosure</span><strong>{inspection.summary.aiDisclosure}</strong></div>}
      {inspection.provenance && <div className="credentialFingerprint"><span>Provenance commitment</span><code>{inspection.provenance.commitment}</code></div>}
      {inspection.state === "none" && <p className="credentialNotice">No embedded Content Credentials were found.</p>}
      {inspection.state === "unavailable" && (
        <p className="credentialNotice">Content Credentials unavailable. ArcProof could not verify an embedded credential locally. ArcProof does not automatically contact external manifest servers. Your original media remains on this device.</p>
      )}
      {inspection.summary.warnings.length > 0 && <p className="credentialNotice">Validation note: {inspection.summary.warnings.join(" · ")}</p>}
      {inspection.summary.errors.length > 0 && <p className="credentialNotice errorNotice">{inspection.summary.errors.join(" · ")}</p>}
      <p className="privacyLine"><strong>Privacy</strong> Original media never uploaded.</p>
    </section>
  );
}
