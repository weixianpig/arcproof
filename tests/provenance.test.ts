import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { createDirectArcAnchor } from "../lib/anchor/direct";
import { createFileHashCommitment } from "../lib/commitment/file";
import { hashBytes } from "../lib/hash";
import { C2PA_VERIFY_SETTINGS, C2PA_WASM_PATH, C2PA_WORKER_PATH } from "../lib/provenance/c2pa";
import { canonicalizeManifestStore } from "../lib/provenance/canonicalize";
import { createProvenanceCommitment } from "../lib/provenance/commitment";
import { createProvenanceReceipt, serializeReceipt } from "../lib/receipt/create";
import { parseReceipt } from "../lib/receipt/validate";

const contentHash = `0x${"11".repeat(32)}` as const;
const manifestStore = {
  active_manifest: "urn:uuid:active",
  manifests: {
    "urn:uuid:active": {
      claim_generator: "fixture/1.0",
      assertions: [{ label: "c2pa.actions", data: { actions: [{ action: "c2pa.created" }] } }],
      signature_info: { alg: "Es256", issuer: "Fixture issuer" },
    },
  },
  validation_state: "Valid",
  validation_results: { validationTime: "changes every run" },
};

describe("C2PA provenance commitments", () => {
  it("canonicalizes manifest maps deterministically and excludes validation output", () => {
    const reordered = {
      validation_results: { validationTime: "another run" },
      manifests: manifestStore.manifests,
      active_manifest: manifestStore.active_manifest,
    };
    assert.equal(canonicalizeManifestStore(manifestStore), canonicalizeManifestStore(reordered));
  });

  it("produces the same commitment for the same content and manifest", async () => {
    assert.deepEqual(
      await createProvenanceCommitment(contentHash, manifestStore),
      await createProvenanceCommitment(contentHash, manifestStore),
    );
  });

  it("changes when the media content hash changes", async () => {
    const first = await createProvenanceCommitment(contentHash, manifestStore);
    const second = await createProvenanceCommitment(`0x${"22".repeat(32)}`, manifestStore);
    assert.notEqual(first.commitment, second.commitment);
  });

  it("changes when the manifest changes", async () => {
    const first = await createProvenanceCommitment(contentHash, manifestStore);
    const second = await createProvenanceCommitment(contentHash, {
      ...manifestStore,
      manifests: { ...manifestStore.manifests, "urn:uuid:active": { claim_generator: "different/2.0" } },
    });
    assert.notEqual(first.manifestHash, second.manifestHash);
    assert.notEqual(first.commitment, second.commitment);
  });

  it("domain-separates file and provenance commitments", async () => {
    const provenance = await createProvenanceCommitment(contentHash, manifestStore);
    assert.notEqual(createFileHashCommitment(contentHash).commitment, provenance.commitment);
  });

  it("round-trips a provenance receipt", async () => {
    const proof = await createProvenanceCommitment(contentHash, manifestStore);
    const anchor = createDirectArcAnchor({
      registry: `0x${"22".repeat(20)}`,
      transactionHash: `0x${"33".repeat(32)}`,
      blockNumber: "42",
      timestamp: "1760000000",
      registrant: `0x${"44".repeat(20)}`,
    });
    assert.deepEqual(parseReceipt(serializeReceipt(createProvenanceReceipt(proof, anchor))), createProvenanceReceipt(proof, anchor));
  });

  it("pins the privacy settings and same-origin SDK assets", () => {
    assert.equal(C2PA_VERIFY_SETTINGS.remoteManifestFetch, false);
    assert.equal(C2PA_VERIFY_SETTINGS.ocspFetch, false);
    assert.match(C2PA_WASM_PATH, /^\/vendor\/c2pa\//);
    assert.match(C2PA_WORKER_PATH, /^\/vendor\/c2pa\//);
    assert.equal(new URL(C2PA_WASM_PATH, "https://arcproof.example").origin, "https://arcproof.example");
  });

  it("includes open valid/no-credential media fixtures and creates tampered bytes locally", async () => {
    const valid = await readFile(new URL("./fixtures/c2pa-valid.jpg", import.meta.url));
    const noCredential = await readFile(new URL("./fixtures/no-c2pa.svg", import.meta.url));
    const tampered = Uint8Array.from(valid);
    tampered[tampered.length - 1] ^= 1;
    assert.ok(valid.length > 100_000);
    assert.ok(noCredential.includes(Buffer.from("<svg")));
    assert.notEqual(await hashBytes(valid), await hashBytes(tampered));
  });
});
