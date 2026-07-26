/**
 * Drop-in contribution widget.
 *
 * A self-contained React component that can be embedded in any Next.js or
 * React app. It reads campaign stats on mount, renders a progress bar and
 * amount suggestions, and handles the full contribution flow.
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
import { ProgressBar } from "@fund-my-cause/components";

// ── Types ─────────────────────────────────────────────────────────────────────

interface WidgetProps {
  contractId: string;
  tokenId: string;
  rpcUrl: string;
  networkPassphrase: string;
  horizonUrl: string;
  /** Wallet address of the connected user. */
  walletAddress?: string;
  /** Signing callback — matches Freighter's signTransaction. */
  signTx?: (xdr: string) => Promise<string>;
}

type WidgetState = "idle" | "submitting" | "success" | "error";

// ── Preset suggestion amounts in XLM ─────────────────────────────────────────

const PRESET_AMOUNTS = [5, 10, 25, 50];

// ── Component ─────────────────────────────────────────────────────────────────

export function ContributionWidget({
  contractId, tokenId, rpcUrl, networkPassphrase, horizonUrl,
  walletAddress, signTx,
}: WidgetProps) {
  const [info,   setInfo]   = useState<CampaignInfo | null>(null);
  const [stats,  setStats]  = useState<CampaignStats | null>(null);
  const [amount, setAmount] = useState("");
  const [state,  setState]  = useState<WidgetState>("idle");
  const [error,  setError]  = useState("");
  const [txHash, setTxHash] = useState("");

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
    if (!walletAddress || !signTx) return;
    const xlm = parseFloat(amount);
    if (isNaN(xlm) || xlm < minXlm) {
      setError(`Minimum is ${minXlm} XLM`);
      return;
    }
    setState("submitting");
    setError("");
    try {
      const hash = await client.contribute({
        contributor: walletAddress,
        amountXlm:  xlm,
        tokenId,
        signTx,
      });
      setTxHash(hash);
      setState("success");
      await load(); // refresh stats
    } catch (e) {
      setState("error");
      if (e instanceof FmcContractError) {
        setError(`Contract error ${e.code}: ${e.message}`);
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

          <button
            onClick={handleContribute}
            disabled={isProcessing || !walletAddress}
            className="fmc-widget__button"
            aria-label={
              !walletAddress
                ? "Connect your wallet to contribute"
                : `Contribute ${amount || "an amount"} XLM`
            }
          >
            {isProcessing
              ? "Processing…"
              : !walletAddress
              ? "Connect wallet to contribute"
              : "Contribute"}
          </button>
        </>
      )}

      <p className="fmc-widget__meta">
        {stats.contributorCount} contributors · ends{" "}
        {info.deadline.toLocaleDateString()}
      </p>
    </div>
  );
}
