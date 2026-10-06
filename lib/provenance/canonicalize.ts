const OMITTED_PROVENANCE_KEYS = new Set([
  "validation_status",
  "validation_results",
  "validation_state",
  "validationTime",
  "validation_time",
]);

function canonicalValue(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON cannot contain non-finite numbers.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalValue).join(",")}]`;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined && !OMITTED_PROVENANCE_KEYS.has(key))
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalValue(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}.`);
}

/**
 * Canonical JSON uses UTF-8 JSON primitives, lexicographically sorted object
 * keys, and preserved array order. SDK-generated validation results are omitted
 * because they describe a verification run rather than signed provenance.
 */
export function canonicalize(value: unknown): string {
  return canonicalValue(value);
}

export function canonicalizeManifestStore(store: unknown): string {
  if (typeof store !== "object" || store === null || Array.isArray(store)) {
    throw new TypeError("C2PA manifest store must be an object.");
  }
  const record = store as Record<string, unknown>;
  if (typeof record.manifests !== "object" || record.manifests === null) {
    throw new TypeError("C2PA manifest store has no manifests.");
  }
  return canonicalize({
    active_manifest: record.active_manifest ?? null,
    manifests: record.manifests,
  });
}
