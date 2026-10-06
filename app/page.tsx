"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { type Hash } from "viem";
import { ProofModeSelector, type ProofMode } from "@/components/ProofModeSelector";
import { ProvenanceCard } from "@/components/ProvenanceCard";
import { arcMainnet, registryAddress } from "@/lib/arc";
import { createDirectArcAnchor } from "@/lib/anchor/direct";
import { createFileHashCommitment } from "@/lib/commitment/file";
import { proofRegistryAbi } from "@/lib/contract";
import { hashFile } from "@/lib/hash";
import { inspectC2PA } from "@/lib/provenance/c2pa";
import type { C2PAInspection } from "@/lib/provenance/types";
import { createProvenanceReceipt, createStandardReceipt, serializeReceipt } from "@/lib/receipt/create";

type Proof = {
  owner: `0x${string}`;
  timestamp: bigint;
  blockNumber: bigint;
  transactionHash?: Hash;
};

const short = (value: string) => `${value.slice(0, 8)}…${value.slice(-6)}`;
const friendlyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (/rejected|denied|cancelled/i.test(message)) return "Request cancelled in your wallet.";
  if (/insufficient funds/i.test(message)) return "Your wallet needs USDC on Arc to pay gas.";
  return message.split("\n")[0];
};

export default function Home() {
  const [mode, setMode] = useState<ProofMode>("standard");
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState<Hash>();
  const [provenance, setProvenance] = useState<C2PAInspection>();
  const [proof, setProof] = useState<Proof>();
  const [status, setStatus] = useState("Choose a file to create its private fingerprint.");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, error: connectError, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: arcMainnet.id });

  const explorer = arcMainnet.blockExplorers.default.url;
  const wrongNetwork = isConnected && chainId !== arcMainnet.id;
  const proofCommitment = mode === "provenance" ? provenance?.provenance : fileHash ? createFileHashCommitment(fileHash) : undefined;

  const findProof = useCallback(async (hash: Hash) => {
    if (!registryAddress || !client) return undefined;
    const exists = await client.readContract({
      address: registryAddress,
      abi: proofRegistryAbi,
      functionName: "proofExists",
      args: [hash],
    });
    if (!exists) return undefined;
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
    return { owner, timestamp: BigInt(timestamp), blockNumber: BigInt(blockNumber), transactionHash: logs[0]?.transactionHash };
  }, [client]);

  const copyVerificationLink = async () => {
    if (!proofCommitment) return;
    const path = proofCommitment.type === "c2pa-provenance"
      ? `/verify/provenance/${proofCommitment.commitment}`
      : `/verify/${proofCommitment.commitment}`;
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const selectFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setProof(undefined);
    setProvenance(undefined);
    setFileName(file.name);
    setStatus("Hashing locally in your browser…");
    try {
      const hash = await hashFile(file);
      setFileHash(hash);
      let commitment = hash;
      if (mode === "provenance") {
        setStatus("Inspecting embedded Content Credentials locally…");
        const inspection = await inspectC2PA(file, hash);
        setProvenance(inspection);
        if (!inspection.provenance) {
          setStatus(inspection.state === "none" ? "No embedded Content Credentials found." : inspection.state === "invalid" ? "Content Credentials did not pass local validation." : "Content Credentials unavailable.");
          return;
        }
        commitment = inspection.provenance.commitment;
      }
      setStatus(registryAddress ? "Checking Arc Mainnet…" : "Commitment created. Add a deployed contract address to register or verify.");
      const existing = await findProof(commitment);
      if (existing) {
        setProof(existing);
        setStatus("Existing proof found");
      } else if (registryAddress) {
        setStatus("No proof found yet. This fingerprint is ready to register.");
      }
    } catch (cause) {
      setError(friendlyError(cause));
      setStatus("Could not hash or verify this file.");
    } finally {
      setBusy(false);
    }
  };

  const register = async () => {
    if (!proofCommitment || !registryAddress || !client) return;
    setBusy(true);
    setError("");
    try {
      if (chainId !== arcMainnet.id) await switchChainAsync({ chainId: arcMainnet.id });
      setStatus("Confirm the registration in your wallet…");
      const transactionHash = await writeContractAsync({
        chainId: arcMainnet.id,
        address: registryAddress,
        abi: proofRegistryAbi,
        functionName: "registerProof",
        args: [proofCommitment.commitment],
      });
      setStatus("Waiting for Arc finality…");
      await client.waitForTransactionReceipt({ hash: transactionHash });
      const registered = await findProof(proofCommitment.commitment);
      if (!registered) throw new Error("Transaction finalized, but the proof could not be read back.");
      setProof({ ...registered, transactionHash });
      setStatus("Proof registered");
    } catch (cause) {
      setError(friendlyError(cause));
      setStatus("Registration was not completed.");
    } finally {
      setBusy(false);
    }
  };

  const formattedDate = useMemo(
    () => proof ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "long" }).format(Number(proof.timestamp) * 1000) : "",
    [proof],
  );

  const receipt = useMemo(() => {
    if (!proofCommitment || !proof?.transactionHash || !registryAddress) return undefined;
    const anchor = createDirectArcAnchor({
      registry: registryAddress,
      transactionHash: proof.transactionHash,
      blockNumber: proof.blockNumber.toString(),
      timestamp: proof.timestamp.toString(),
      registrant: proof.owner,
    });
    return proofCommitment.type === "c2pa-provenance"
      ? createProvenanceReceipt(proofCommitment, anchor)
      : createStandardReceipt(proofCommitment, anchor);
  }, [proofCommitment, proof]);

  const changeMode = (nextMode: ProofMode) => {
    setMode(nextMode);
    setFileName("");
    setFileHash(undefined);
    setProvenance(undefined);
    setProof(undefined);
    setError("");
    setStatus(nextMode === "provenance" ? "Choose C2PA media to inspect it locally." : "Choose a file to create its private fingerprint.");
  };

  const downloadReceipt = () => {
    if (!receipt) return;
    const blob = new Blob([serializeReceipt(receipt)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName || "proof"}.arcproof.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="shell">
      <nav>
        <a className="brand" href="#">Arc<span>Proof</span></a>
        <div className="network"><i /> Arc Mainnet</div>
      </nav>

      <section className="hero">
        <p className="eyebrow">PRIVATE · PERMANENT · ONCHAIN</p>
        <h1>Prove when private evidence existed.<br /><em>And where it came from.</em></h1>
        <p className="lede">ArcProof creates a private commitment inside your browser, then anchors only that commitment to Arc. Your file never leaves this device.</p>
      </section>

      <section className="card">
        <ProofModeSelector mode={mode} onChange={changeMode} disabled={busy} />
        <div className="step"><span>01</span><div><strong>Select a file</strong><small>It stays on your device</small></div></div>
        <label className="dropzone">
          <input aria-label="Choose file" type="file" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <span className="uploadIcon">↑</span>
          <strong>{fileName || "Choose any file"}</strong>
          <small>{fileName ? "Choose again" : "Click to browse · never uploaded"}</small>
        </label>

        {fileHash && (
          <div className="hashBox">
            <div><span>SHA-256 fingerprint</span><span className="localBadge">Computed locally</span></div>
            <code>{fileHash}</code>
          </div>
        )}

        {mode === "provenance" && provenance && <ProvenanceCard inspection={provenance} />}

        <div className="step second"><span>02</span><div><strong>Anchor or verify</strong><small>On Arc Mainnet</small></div></div>

        {!isConnected ? (
          <button className="button primary" disabled={connecting} onClick={() => connect({ connector: connectors[0] })}>
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        ) : (
          <div className="walletRow">
            <div><i /><span>{short(address!)}</span><small>{wrongNetwork ? "Wrong network" : "Arc Mainnet"}</small></div>
            <button onClick={() => disconnect()}>Disconnect</button>
          </div>
        )}

        {proofCommitment && !proof && (
          <button className="button primary" disabled={busy || !isConnected || !registryAddress} onClick={() => void register()}>
            {busy ? "Working…" : wrongNetwork ? "Switch to Arc & register" : mode === "provenance" ? "Anchor provenance to Arc" : "Register proof"}
          </button>
        )}

        <div className={`status ${proof ? "success" : ""}`} aria-live="polite">
          {proof && <span>✓</span>}
          <div><strong>{status}</strong>{(error || connectError) && <small>{error || friendlyError(connectError)}</small>}</div>
        </div>

        {proof && (
          <div className="proof">
            <dl>
              <div><dt>Registered by</dt><dd title={proof.owner}>{short(proof.owner)}</dd></div>
              <div><dt>Registered at</dt><dd>{formattedDate}</dd></div>
              <div><dt>Transaction</dt><dd>{proof.transactionHash ? short(proof.transactionHash) : "Event unavailable"}</dd></div>
              <div><dt>Block</dt><dd>{proof.blockNumber.toString()}</dd></div>
            </dl>
            <div className="proofActions">
              {proof.transactionHash && <a href={`${explorer}/tx/${proof.transactionHash}`} target="_blank" rel="noreferrer">View on Arc Explorer ↗</a>}
              <button onClick={() => void copyVerificationLink()}>{copied ? "Copied!" : "Copy verification link"}</button>
              {receipt && <button onClick={downloadReceipt}>Download proof</button>}
            </div>
          </div>
        )}

        {!registryAddress && <p className="configNote">Local hashing is ready. Set <code>NEXT_PUBLIC_PROOF_REGISTRY_ADDRESS</code> after a testnet deployment to enable onchain actions.</p>}
      </section>

      <section className="disclosure">
        <strong>Private by design</strong>
        <p>Your file never leaves your device. Only its cryptographic commitment is written to Arc.</p>
        <p>ArcProof creates a timestamped, tamper-resistant record on Arc. It does not prove legal ownership or validate the contents of a file.</p>
        <Link className="textLink" href="/verify/receipt">Verify a portable receipt →</Link>
      </section>

      <footer>
        <span>EVIDENCE</span><b>→</b><span>COMMITMENT</span><b>→</b><span>ARC MAINNET</span>
        <p>No upload. No account. No database.</p>
      </footer>
    </main>
  );
}
