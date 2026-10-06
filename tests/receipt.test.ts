import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createDirectArcAnchor } from "../lib/anchor/direct";
import { createFileHashCommitment } from "../lib/commitment/file";
import { createProvenanceReceipt, createStandardReceipt, serializeReceipt } from "../lib/receipt/create";
import { parseReceipt, ReceiptValidationError, validateReceipt } from "../lib/receipt/validate";
import { provenanceCommitmentMatchesReceipt, verifyFileHashAgainstReceipt, verifyReceiptAnchor, verifyStandardReceipt } from "../lib/verification/receipt";

const commitment = `0x${"11".repeat(32)}` as const;
const registry = `0x${"22".repeat(20)}` as const;
const transactionHash = `0x${"33".repeat(32)}` as const;
const registrant = `0x${"44".repeat(20)}` as const;

const receipt = createStandardReceipt(
  createFileHashCommitment(commitment),
  createDirectArcAnchor({
    registry,
    transactionHash,
    blockNumber: "24277769",
    timestamp: "1760000000",
    registrant,
  }),
);

describe("portable Standard Proof receipts", () => {
  it("generates deterministic receipts", () => {
    assert.equal(serializeReceipt(receipt), serializeReceipt(createStandardReceipt(receipt.proof, receipt.anchor)));
  });

  it("validates a supported receipt", () => {
    assert.deepEqual(parseReceipt(serializeReceipt(receipt)), receipt);
  });

  it("rejects malformed receipts", () => {
    assert.throws(() => parseReceipt("not json"), ReceiptValidationError);
    assert.throws(() => validateReceipt({ ...receipt, unexpected: true }), ReceiptValidationError);
  });

  it("rejects unsupported versions and strategies", () => {
    assert.throws(() => validateReceipt({ ...receipt, version: "3.0" }), /Unsupported receipt version/);
    assert.throws(() => validateReceipt({ ...receipt, anchor: { ...receipt.anchor, strategy: "merkle" } }), /Unsupported anchor strategy/);
  });

  it("detects a content hash mismatch", () => {
    const result = verifyFileHashAgainstReceipt(`0x${"ff".repeat(32)}`, receipt);
    assert.equal(result.status, "failed");
  });

  it("independently verifies every direct anchor field", async () => {
    const result = await verifyStandardReceipt(receipt, async () => receipt.anchor, registry);
    assert.equal(result.verified, true);
    assert.equal(result.anchor.status, "verified");
  });

  it("rejects a structurally valid receipt modified after creation", async () => {
    const modified = validateReceipt({
      ...receipt,
      anchor: { ...receipt.anchor, transactionHash: `0x${"55".repeat(32)}` },
    });
    const result = await verifyReceiptAnchor(modified, async () => receipt.anchor, registry);
    assert.equal(result.verified, false);
    assert.equal(result.anchor.status, "failed");
  });
});

describe("portable provenance receipt tamper detection", () => {
  const proof = {
    type: "c2pa-provenance",
    algorithm: "arcproof-c2pa-v1",
    commitment,
    contentHash: `0x${"55".repeat(32)}`,
    manifestHash: `0x${"66".repeat(32)}`,
  } as const;
  const provenanceReceipt = createProvenanceReceipt(proof, receipt.anchor);
  const changedHash = `0x${"77".repeat(32)}` as const;

  it("rejects modified content, manifest, or provenance commitment fields", () => {
    for (const field of ["contentHash", "manifestHash", "commitment"] as const) {
      const modified = validateReceipt({
        ...provenanceReceipt,
        proof: { ...provenanceReceipt.proof, [field]: changedHash },
      });
      assert.equal(modified.version, "2.0");
      assert.equal(provenanceCommitmentMatchesReceipt(proof, modified), false, field);
    }
  });

  it("rejects a modified chain ID at schema validation", () => {
    assert.throws(
      () => validateReceipt({ ...provenanceReceipt, anchor: { ...provenanceReceipt.anchor, chainId: 5042002 } }),
      /Arc Mainnet/,
    );
  });

  it("rejects every modified direct anchor identity field", async () => {
    const changes = {
      registry: `0x${"88".repeat(20)}`,
      transactionHash: `0x${"99".repeat(32)}`,
      blockNumber: "24277770",
      timestamp: "1760000001",
      registrant: `0x${"aa".repeat(20)}`,
    } as const;

    for (const [field, value] of Object.entries(changes)) {
      const modified = validateReceipt({
        ...provenanceReceipt,
        anchor: { ...provenanceReceipt.anchor, [field]: value },
      });
      const result = await verifyReceiptAnchor(modified, async () => provenanceReceipt.anchor, registry);
      assert.equal(result.verified, false, field);
    }
  });
});
