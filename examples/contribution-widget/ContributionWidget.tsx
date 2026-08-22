/**
 * Drop-in contribution widget.
 *
 * A self-contained React component that can be embedded in any Next.js or
 * React app. It reads campaign stats on mount, renders a progress bar and
 * amount suggestions, and handles the full contribution flow.
 *
 * Wallet connection is handled by the shared implementation in
 * `@fund-my-cause/sdk/wallet` — the widget does not implement its own. A host
 * that already manages a wallet can bypass it entirely by passing
 * `walletAddress` + `signTx`.
 *
 * Props:
 *   contractId   — crowdfund contract address
 *   tokenId      — XLM (or other) token address to contribute
 *   rpcUrl       — Soroban RPC endpoint
 *   networkPassphrase
 *   horizonUrl
 */

"use client";

import React, { useEffect, useState, useCallback } from "react";
import { FmcClient, CampaignStats, CampaignInfo, FmcContractError } from "@fund-my-cause/sdk";
import {
  freighterAdapter,
  createLobstrAdapter,
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
  classifySignError,
  type WalletAdapter,
  type WalletType,
} from "@fund-my-cause/sdk/wallet";
import { ProgressBar } from "@fund-my-cause/components";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WidgetProps {
  contractId: string;
  tokenId: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  /**
   * Wallet address of the connected user. Omit to let the widget manage the
   * connection itself via `@fund-my-cause/sdk/wallet`.
   */
  walletAddress?: string;
  /**
   * Signing callback. Omit to let the widget sign through the wallet it
   * connected itself. Only used when `walletAddress` is also supplied.
   */
  signTx?: (xdr: string) => Promise<string>;
  /**
   * WalletConnect project ID — enables the LOBSTR option in the widget's own
   * wallet picker. Without it only Freighter is offered.
   */
  walletConnectProjectId?: string;
}

type WidgetState = "idle" | "submitting" | "success" | "error";

// ── Preset suggestion amounts in XLM ─────────────────────────────────────────

const PRESET_AMOUNTS = [5, 10, 25, 50];

// ── Wallet ────────────────────────────────────────────────────────────────────

/**
 * Wraps the shared adapters from `@fund-my-cause/sdk/wallet` in the small
 * amount of React state the widget needs. All connect/sign/disconnect and
 * session logic lives in the SDK — this only holds the current address.
 */
function useSdkWallet(networkPassphrase: string, walletConnectProjectId?: string) {
  const [address, setAddress] = useState<string | null>(null);
  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [walletError, setWalletError] = useState("");

  const adapterFor = useCallback(
    (walletType: WalletType): WalletAdapter =>
      walletType === "lobstr"
        ? createLobstrAdapter({ projectId: walletConnectProjectId ?? "" })
        : freighterAdapter,
    [walletConnectProjectId],
  );

  // Restore a session persisted by an earlier page load.
  useEffect(() => {
    const saved = loadWalletSession();
    if (!saved) return;
    setAddress(saved.address);
    setAdapter(adapterFor(saved.walletType));
  }, [adapterFor]);

  const connect = useCallback(
    async (walletType: WalletType) => {
      setIsConnecting(true);
      setWalletError("");
      try {
        const next = adapterFor(walletType);
        const addr = await next.connect();
        saveWalletSession(addr, walletType);
        setAddress(addr);
        setAdapter(next);
      } catch (e) {
        setWalletError(
          classifySignError(e) === "cancelled"
            ? "Connection cancelled."
            : e instanceof Error
            ? e.message
            : "Could not connect wallet.",
        );
      } finally {
        setIsConnecting(false);
      }
    },
    [adapterFor],
  );

  const disconnect = useCallback(async () => {
    await adapter?.disconnect?.();
    clearWalletSession();
    setAddress(null);
    setAdapter(null);
  }, [adapter]);

  const signTx = useCallback(
    (xdr: string) => {
      if (!adapter) throw new Error("No wallet connected");
      return adapter.signTransaction(xdr, networkPassphrase);
    },
    [adapter, networkPassphrase],
  );

  return { address, isConnecting, walletError, connect, disconnect, signTx };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ContributionWidget({
  contractId, tokenId, rpcUrl, networkPassphrase, horizonUrl,
  walletAddress, signTx, walletConnectProjectId,
}: WidgetProps) {
  const [info,   setInfo]   = useState<CampaignInfo | null>(null);
  const [stats,  setStats]  = useState<CampaignStats | null>(null);
  const [amount, setAmount] = useState("");
  const [state,  setState]  = useState<WidgetState>("idle");
  const [error,  setError]  = useState("");
  const [txHash, setTxHash] = useState("");

  const wallet = useSdkWallet(networkPassphrase, walletConnectProjectId);

  // A host that passes both props manages its own wallet; otherwise the widget
  // uses the shared SDK adapters it connected itself.
  const hostManagesWallet = Boolean(walletAddress && signTx);
  const activeAddress = hostManagesWallet ? walletAddress : wallet.address;
  const activeSignTx  = hostManagesWallet ? signTx! : wallet.signTx;

  const client = new FmcClient({ contractId, rpcUrl, networkPassphrase, horizonUrl });

  const load = useCallback(async () => {
    const [i, s] = await Promise.all([client.getCampaignInfo(), client.getStats()]);
    setInfo(i);
    setStats(s);
  }, [contractId]);

  useEffect(() => { load(); }, [load]);

  const minXlm = info ? info.minContributionXlm : 1;

  // "Complete the goal" suggestion — remaining XLM needed
  const remaining = stats ? Math.max(0, stats.goalXlm - stats.raisedXlm) : null;

  async function handleContribute() {
    if (!activeAddress) return;
    const xlm = parseFloat(amount);
    if (isNaN(xlm) || xlm < minXlm) {
      setError(`Minimum is ${minXlm} XLM`);
      return;
    }
    setState("submitting");
    setError("");
    try {
      const hash = await client.contribute({
        contributor: activeAddress,
        amountXlm:  xlm,
        tokenId,
        signTx: activeSignTx,
      });
      setTxHash(hash);
      setState("success");
      await load(); // refresh stats
    } catch (e) {
      setState("error");
      if (e instanceof FmcContractError) {
        setError(`Contract error ${e.code}: ${e.message}`);
      } else if (classifySignError(e) === "cancelled") {
        setError("Transaction cancelled.");
      } else {
        setError(e instanceof Error ? e.message : "Contribution failed.");
      }
    }
  }

  if (!info || !stats) {
    return <div className="fmc-widget fmc-widget--loading">Loading campaign…</div>;
  }

  const progressPct = Math.min(100, stats.progressPercent);
  const isProcessing = state === "submitting";

  return (
    <div className="fmc-widget">
      {/* Header */}
      <h3 className="fmc-widget__title">{info.title}</h3>

      {/* Progress bar */}
      <ProgressBar progress={progressPct} showLabel={false} />
      <div className="fmc-widget__progress-label">
        <span>{stats.raisedXlm.toFixed(2)} XLM raised</span>
        <span>{progressPct.toFixed(1)}% of {stats.goalXlm.toFixed(2)} XLM</span>
      </div>

      {/* Amount input */}
      {state === "success" ? (
        <div className="fmc-widget__success">
          <p>✓ Contribution submitted!</p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            View on Stellar Expert →
          </a>
        </div>
      ) : (
        <>
          {/* Preset chips */}
          <div className="fmc-widget__presets" role="group" aria-label="Suggested amounts">
            {PRESET_AMOUNTS.filter((a) => a >= minXlm).map((a) => (
              <button
                key={a}
                onClick={() => setAmount(String(a))}
                disabled={isProcessing}
                className={`fmc-widget__preset${amount === String(a) ? " fmc-widget__preset--active" : ""}`}
              >
                {a} XLM
              </button>
            ))}
            {remaining !== null && remaining > 0 && remaining >= minXlm && (
              <button
                onClick={() => setAmount(remaining.toFixed(7))}
                disabled={isProcessing}
                className={`fmc-widget__preset fmc-widget__preset--complete${
                  amount === remaining.toFixed(7) ? " fmc-widget__preset--active" : ""
                }`}
                title="This amount would complete the campaign goal"
              >
                {remaining.toFixed(2)} XLM (complete goal)
              </button>
            )}
          </div>

          <label htmlFor="fmc-amount" className="sr-only">
            Amount in XLM (minimum {minXlm} XLM)
          </label>
          <input
            id="fmc-amount"
            type="number"
            inputMode="decimal"
            placeholder={`Min ${minXlm} XLM`}
            value={amount}
            min={minXlm}
            step="0.1"
            onChange={(e) => setAmount(e.target.value)}
            disabled={isProcessing}
            className="fmc-widget__input"
            aria-describedby={error ? "fmc-error" : undefined}
          />

          {error && (
            <p id="fmc-error" className="fmc-widget__error" role="alert">
              {error}
            </p>
          )}

          {activeAddress ? (
            <button
              onClick={handleContribute}
              disabled={isProcessing}
              className="fmc-widget__button"
              aria-label={`Contribute ${amount || "an amount"} XLM`}
            >
              {isProcessing ? "Processing…" : "Contribute"}
            </button>
          ) : hostManagesWallet ? (
            <button className="fmc-widget__button" disabled aria-label="Connect your wallet to contribute">
              Connect wallet to contribute
            </button>
          ) : (
            /* No host-managed wallet — connect through the shared SDK adapters. */
            <div className="fmc-widget__connect" role="group" aria-label="Connect a wallet">
              <button
                onClick={() => wallet.connect("freighter")}
                disabled={wallet.isConnecting}
                className="fmc-widget__button"
              >
                {wallet.isConnecting ? "Connecting…" : "Connect Freighter"}
              </button>
              {walletConnectProjectId && (
                <button
                  onClick={() => wallet.connect("lobstr")}
                  disabled={wallet.isConnecting}
                  className="fmc-widget__button fmc-widget__button--secondary"
                >
                  {wallet.isConnecting ? "Connecting…" : "Connect LOBSTR"}
                </button>
              )}
              {wallet.walletError && (
                <p className="fmc-widget__error" role="alert">
                  {wallet.walletError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p className="fmc-widget__meta">
        {stats.contributorCount} contributors · ends{" "}
        {info.deadline.toLocaleDateString()}
        {!hostManagesWallet && wallet.address && (
          <>
            {" · "}
            <button
              onClick={wallet.disconnect}
              className="fmc-widget__disconnect"
              aria-label={`Disconnect wallet ${wallet.address}`}
            >
              Disconnect {wallet.address.slice(0, 4)}…{wallet.address.slice(-4)}
            </button>
          </>
        )}
      </p>
    </div>
  );
}
