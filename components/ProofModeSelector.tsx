export type ProofMode = "standard" | "provenance";

export function ProofModeSelector({
  mode,
  onChange,
  disabled,
}: {
  mode: ProofMode;
  onChange: (mode: ProofMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="modeSelector" aria-label="Proof type">
      <button className={mode === "standard" ? "active" : ""} disabled={disabled} onClick={() => onChange("standard")}>Standard</button>
      <button className={mode === "provenance" ? "active" : ""} disabled={disabled} onClick={() => onChange("provenance")}>Provenance</button>
    </div>
  );
}
