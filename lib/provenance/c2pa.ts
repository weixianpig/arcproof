import type { Manifest, ManifestStore, ValidationStatus } from "@contentauth/c2pa-web";
import type { VerificationCheck } from "@/lib/verification/types";
import { createProvenanceCommitment } from "./commitment";
import type { C2PAInspection, C2PASummary } from "./types";

const verified = (message: string): VerificationCheck => ({ status: "verified", message });
const failed = (message: string): VerificationCheck => ({ status: "failed", message });
const unavailable = (message: string): VerificationCheck => ({ status: "unavailable", message });

let sdkPromise: Promise<Awaited<ReturnType<typeof import("@contentauth/c2pa-web")["createC2pa"]>>> | undefined;

export const C2PA_WASM_PATH = "/vendor/c2pa/c2pa_bg.wasm";
export const C2PA_WORKER_PATH = "/vendor/c2pa/c2pa_worker.js";
export const C2PA_VERIFY_SETTINGS = Object.freeze({
  verifyAfterReading: true,
  verifyTrust: true,
  remoteManifestFetch: false,
  ocspFetch: false,
});

async function getSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@contentauth/c2pa-web").then(({ createC2pa }) => {
      const workerSrc = window.location.protocol === "https:"
        ? new URL(C2PA_WORKER_PATH, window.location.origin)
        : undefined;
      return createC2pa({
        wasmSrc: new URL(C2PA_WASM_PATH, window.location.origin).toString(),
        workerSrc,
      });
    });
  }
  return sdkPromise;
}

function allStatuses(store: ManifestStore) {
  const statuses: ValidationStatus[] = [...(store.validation_status ?? [])];
  const results = store.validation_results?.activeManifest;
  if (results) statuses.push(...results.success, ...results.informational, ...results.failure);
  return statuses;
}

function codes(statuses: ValidationStatus[], kind: "success" | "failure") {
  return statuses.filter((status) =>
    kind === "success" ? status.success === true : status.success === false,
  );
}

function findStringForKey(value: unknown, keys: Set<string>): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringForKey(item, keys);
      if (found) return found;
    }
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  for (const [key, child] of Object.entries(value)) {
    if (keys.has(key) && typeof child === "string") return child;
    const found = findStringForKey(child, keys);
    if (found) return found;
  }
  return undefined;
}

function activeManifest(store: ManifestStore): Manifest | undefined {
  if (!store.active_manifest || !store.manifests) return undefined;
  return store.manifests[store.active_manifest];
}

export function summarizeManifestStore(store: ManifestStore): C2PASummary {
  const statuses = allStatuses(store);
  const successes = codes(statuses, "success");
  const failures = [
    ...codes(statuses, "failure"),
    ...(store.validation_results?.activeManifest?.failure ?? []),
  ];
  const informational = store.validation_results?.activeManifest?.informational ?? [];
  const trustOnlyFailure = (status: ValidationStatus) =>
    /signingCredential\.untrusted|time.?stamp\.untrusted/i.test(status.code);
  const trustWarnings = failures.filter(trustOnlyFailure);
  const validationFailures = failures.filter((status) => !trustOnlyFailure(status));
  const active = activeManifest(store);
  const valid = store.validation_state === "Valid" || store.validation_state === "Trusted";
  const invalid = store.validation_state === "Invalid" || validationFailures.length > 0;
  const signatureCode = (status: ValidationStatus) => /claimSignature/i.test(status.code);
  const timestampCode = (status: ValidationStatus) => /time.?stamp/i.test(status.code);

  const signature = failures.some(signatureCode)
    ? failed("The C2PA claim signature failed validation.")
    : successes.some(signatureCode) || (valid && Boolean(active?.signature_info))
      ? verified("The C2PA claim signature is cryptographically valid.")
      : unavailable("Signature validation status was not reported.");

  const timestampTrust = validationFailures.some(timestampCode)
    ? failed("The credential timestamp did not pass trust validation.")
    : successes.some((status) => timestampCode(status) && /trusted/i.test(status.code))
      ? verified("The credential timestamp is trusted.")
      : unavailable("Timestamp trust was not established locally.");

  const sourceType = findStringForKey(active, new Set(["digitalSourceType", "digital_source_type"]));
  const aiDisclosure = sourceType?.toLowerCase().includes("algorithm")
    ? sourceType
    : undefined;

  return {
    manifest: active ? verified("An embedded C2PA manifest was detected.") : failed("No active C2PA manifest was available."),
    assetIntegrity: invalid
      ? failed("The media or its provenance data failed an integrity check.")
      : valid
        ? verified("The embedded manifest is bound to these media bytes.")
        : unavailable("Asset integrity could not be established locally."),
    signature,
    signerTrust: store.validation_state === "Trusted"
      ? verified("The signer chains to a locally configured trust anchor.")
      : store.validation_state === "Valid"
        ? unavailable("The signature is valid, but signer trust was not established locally.")
        : invalid
          ? failed("Signer trust cannot be established for an invalid manifest.")
          : unavailable("Signer trust status was not reported."),
    timestampTrust,
    claimGenerator: active?.claim_generator_info?.map((item) =>
      item.version ? `${item.name} ${item.version}` : item.name,
    ).join(", ") || active?.claim_generator || undefined,
    issuer: active?.signature_info?.issuer || active?.signature_info?.common_name || undefined,
    aiDisclosure,
    warnings: [...informational, ...trustWarnings].map((status) => status.explanation || status.code),
    errors: validationFailures.map((status) => status.explanation || status.code),
  };
}

function emptySummary(message: string): C2PASummary {
  return {
    manifest: unavailable(message),
    assetIntegrity: unavailable("No embedded credential was validated."),
    signature: unavailable("No embedded credential was validated."),
    signerTrust: unavailable("No embedded credential was validated."),
    timestampTrust: unavailable("No embedded credential was validated."),
    warnings: [],
    errors: [],
  };
}

/**
 * Privacy boundary: the File is transferred only to ArcProof's local worker.
 * Remote manifests and OCSP are disabled, and no file data is sent to a server.
 */
export async function inspectC2PA(
  file: File,
  contentHash: `0x${string}`,
): Promise<C2PAInspection> {
  try {
    const [{ Context, Reader }, sdk] = await Promise.all([
      import("@contentauth/c2pa-web"),
      getSdk(),
    ]);
    const context = new Context({
      verify: C2PA_VERIFY_SETTINGS,
    });
    const reader = await Reader.fromBlob(sdk, file.type || undefined, file, context);
    if (!reader) {
      return {
        state: "none",
        canAnchor: false,
        summary: emptySummary("No embedded Content Credentials were found."),
      };
    }

    try {
      const manifestStore = await reader.manifestStore();
      const summary = summarizeManifestStore(manifestStore);
      const valid = manifestStore.validation_state === "Valid" || manifestStore.validation_state === "Trusted";
      const canAnchor = valid && summary.assetIntegrity.status === "verified" && summary.signature.status === "verified";
      return {
        state: canAnchor ? "verified" : "invalid",
        canAnchor,
        summary,
        manifestStore,
        provenance: canAnchor
          ? await createProvenanceCommitment(contentHash, manifestStore)
          : undefined,
      };
    } finally {
      await reader.free();
    }
  } catch {
    return {
      state: "unavailable",
      canAnchor: false,
      summary: emptySummary("Content Credentials unavailable. ArcProof could not verify an embedded credential locally."),
    };
  }
}
