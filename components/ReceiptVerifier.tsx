"use client";

import { useState } from "react";
import { arcMainnet } from "@/lib/arc";
import { hashFile } from "@/lib/hash";
import { inspectC2PA } from "@/lib/provenance/c2pa";
import { parseReceipt, ReceiptValidationError } from "@/lib/receipt/validate";
import type { ArcProofReceipt } from "@/lib/receipt/types";
import { provenanceCommitmentMatchesReceipt, verifyFileHashAgainstReceipt, verifyReceiptAnchor } from "@/lib/verification/receipt";
import type { ReceiptVerificationResult, VerificationCheck } from "@/lib/verification/types";

function Check({ label, check }: { label: string; check?: VerificationCheck }) {
  if (!check) return null;
  const icon = check.status === "verified" ? "✓" : check.status === "failed" ? "×" : "?";
  return (
    <div className={`verificationCheck ${check.status}`}>
      <span>{icon}</span>
      <div><strong>{label}</strong><small>{check.message}</small></div>
    </div>
  );
}

export function ReceiptVerifier() {
  const [receipt, setReceipt] = useState<ArcProofReceipt>();
  const [result, setResult] = useState<ReceiptVerificationResult>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const chooseReceipt = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setReceipt(undefined);
    setResult(undefined);
    try {
      // The receipt is parsed in this browser and is never uploaded.
      const parsed = parseReceipt(await file.text());
      setReceipt(parsed);
      setResult(await verifyReceiptAnchor(parsed));
    } catch (cause) {
      setError(cause instanceof ReceiptValidationError ? cause.message : "The receipt could not be verified.");
    } finally {
      setBusy(false);
    }
  };

  const chooseOriginal = async (file?: File) => {
    if (!file || !receipt || !result) return;
    setBusy(true);
    setError("");
    try {
      // The optional original is hashed locally. Only the digest is compared.
      const hash = await hashFile(file);
      if (receipt.version === "2.0") {
        const provenanceReceipt = receipt;
        const inspection = await inspectC2PA(file, hash);
        const fileMatches = hash.toLowerCase() === provenanceReceipt.proof.contentHash.toLowerCase();
        const commitmentMatches = provenanceCommitmentMatchesReceipt(inspection.provenance, provenanceReceipt);
        setResult({
          ...result,
          file: {
            status: fileMatches ? "verified" : "failed",
            message: fileMatches ? "The selected media matches the receipt content hash." : "The selected media does not match the receipt content hash.",
          },
          contentCredentials: {
            status: inspection.canAnchor ? "verified" : inspection.state === "invalid" ? "failed" : "unavailable",
            message: inspection.canAnchor ? "Embedded Content Credentials were validated locally." : inspection.summary.manifest.message,
          },
          commitment: {
            status: commitmentMatches ? "verified" : "failed",
            message: commitmentMatches ? "The provenance commitment was reproduced locally." : "The provenance commitment could not be reproduced from this media.",
          },
          verified: result.anchor.status === "verified" && fileMatches && commitmentMatches,
        });
        return;
      }
      const fileCheck = verifyFileHashAgainstReceipt(hash, receipt);
      setResult({
        ...result,
        file: fileCheck,
        verified: result.anchor.status === "verified" && fileCheck.status === "verified",
      });
    } catch {
      setError("The selected file could not be hashed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <label className="dropzone compactDropzone">
        <input
          aria-label="Choose ArcProof receipt"
          type="file"
          accept=".json,application/json"
          onChange={(event) => void chooseReceipt(event.target.files?.[0])}
        />
        <span className="uploadIcon">↑</span>
        <strong>{busy ? "Checking…" : "Choose an ArcProof receipt"}</strong>
        <small>Parsed locally · never uploaded</small>
      </label>

      {error && <div className="status"><div><strong>Verification stopped</strong><small>{error}</small></div></div>}

      {receipt && result && (
        <div className="receiptResult">
          <div className={`receiptVerdict ${result.verified ? "verified" : "notVerified"}`}>
            <strong>{receipt.proof.type === "c2pa-provenance"
              ? result.file
                ? result.verified ? "Full Provenance Verified" : "Full provenance not verified"
                : result.anchor.status === "verified" ? "Arc Anchor Verified" : "Arc anchor not verified"
              : result.verified ? "ArcProof receipt verified" : "Receipt not fully verified"}</strong>
            <small>{receipt.proof.type === "c2pa-provenance" && !result.file
              ? "Select the original media to perform full local provenance verification."
              : "Receipt, evidence, commitment, and Arc anchor must all match."}</small>
          </div>
          <Check label="RECEIPT" check={result.receipt} />
          <Check label="FILE MATCH" check={result.file} />
          <Check label="CONTENT CREDENTIALS" check={result.contentCredentials} />
          <Check label="COMMITMENT" check={result.commitment} />
          <Check label="ARC ANCHOR" check={result.anchor} />

          {!result.file && (
            <label className="button secondary fileButton">
              <input
                aria-label="Choose original file"
                type="file"
                onChange={(event) => void chooseOriginal(event.target.files?.[0])}
              />
              Check original file locally
            </label>
          )}

          <div className="proof receiptDetails">
            <dl>
              <div><dt>Commitment</dt><dd>{receipt.proof.commitment}</dd></div>
              {receipt.proof.type === "c2pa-provenance" && <>
                <div><dt>Content hash</dt><dd>{receipt.proof.contentHash}</dd></div>
                <div><dt>Manifest hash</dt><dd>{receipt.proof.manifestHash}</dd></div>
              </>}
              <div><dt>Registrant</dt><dd>{receipt.anchor.registrant}</dd></div>
              <div><dt>Block</dt><dd>{receipt.anchor.blockNumber}</dd></div>
              <div><dt>Timestamp</dt><dd>{receipt.anchor.timestamp} Unix seconds</dd></div>
            </dl>
            <div className="proofActions">
              <a href={`${arcMainnet.blockExplorers.default.url}/tx/${receipt.anchor.transactionHash}`} target="_blank" rel="noreferrer">
                View on Arc Explorer ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
