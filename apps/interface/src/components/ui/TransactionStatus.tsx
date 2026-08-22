"use client";

import React, { useEffect } from "react";
import {
  Loader2,
  CheckCircle,
  XCircle,
  CircleDot,
  FileSignature,
  Send,
  Clock,
  FlaskConical,
} from "lucide-react";

export type TxStatus =
  | "idle"
  | "simulating"
  | "signing"
  | "submitting"
  | "confirming"
  | "success"
  | "error";

export interface TransactionStatusProps {
  status: TxStatus;
  txHash?: string;
  errorMessage?: string;
  onDismiss?: () => void;
}

const STEPS = [
  { key: "idle", label: "Idle", Icon: CircleDot },
  { key: "simulating", label: "Simulating", Icon: FlaskConical },
  { key: "signing", label: "Signing", Icon: FileSignature },
  { key: "submitting", label: "Submitting", Icon: Send },
  { key: "confirming", label: "Confirming", Icon: Clock },
] as const;

const STATUS_INDEX: Record<TxStatus, number> = {
  idle: 0,
  simulating: 1,
  signing: 2,
  submitting: 3,
  confirming: 4,
  success: 4,
  error: 4,
};

export function TransactionStatus({
  status,
  txHash,
  errorMessage,
  onDismiss,
}: TransactionStatusProps) {
  useEffect(() => {
    if (status === "success" && onDismiss) {
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }
  }, [status, onDismiss]);

  if (status === "idle") return null;

  const currentIndex = STATUS_INDEX[status];
  const isActive = (s: TxStatus) =>
    ["simulating", "signing", "submitting", "confirming"].includes(s);

  return (
    <div
      className="space-y-4 p-4 rounded-[var(--radius-xl)] animate-pulse-none"
      style={{ background: "var(--color-surface-elevated)" }}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      aria-label={`Transaction status: ${status === "success" ? "completed successfully" : status === "error" ? "failed" : "in progress"}`}
    >
      {/* Steps */}
      <ol
        className="flex items-center justify-between"
        aria-label="Transaction steps"
      >
        {STEPS.map(({ key, label, Icon }, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isSpinning = isCurrent && isActive(status);

          return (
            <li
              key={key}
              className="flex items-center"
              aria-label={`${label}: ${isCompleted ? "completed" : isCurrent ? "in progress" : "pending"}`}
            >
              <div
                className="flex items-center gap-2"
                style={{
                  color: isCompleted
                    ? "var(--color-success)"
                    : isCurrent
                      ? "var(--color-brand)"
                      : "var(--color-text-muted)",
                }}
              >
                {isSpinning ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : isCompleted ? (
                  <CheckCircle size={20} />
                ) : (
                  <Icon size={20} />
                )}
                <span className="text-sm font-medium">{label}</span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className="w-8 h-0.5 mx-2"
                  style={{
                    background:
                      index < currentIndex
                        ? "var(--color-success)"
                        : "var(--color-border-subtle)",
                  }}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Success */}
      {status === "success" && (
        <div
          className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border"
          style={{
            background:
              "color-mix(in srgb, var(--color-success) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-success) 30%, transparent)",
          }}
        >
          <CheckCircle style={{ color: "var(--color-success)" }} size={24} />
          <div className="flex-1">
            <p
              className="font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Transaction Successful
            </p>
            {txHash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="View transaction on Stellar Expert (opens in new tab)"
                className="text-sm hover:underline"
                style={{ color: "var(--color-brand)" }}
              >
                View on Stellar Expert →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div
          className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)] border"
          style={{
            background:
              "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor:
              "color-mix(in srgb, var(--color-danger) 30%, transparent)",
          }}
        >
          <XCircle style={{ color: "var(--color-danger)" }} size={24} />
          <div className="flex-1">
            <p
              className="font-medium"
              style={{ color: "var(--color-text-primary)" }}
            >
              Transaction Failed
            </p>
            {errorMessage && (
              <p
                className="text-sm"
                style={{ color: "var(--color-danger-subtle)" }}
              >
                {errorMessage}
              </p>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              aria-label="Dismiss transaction error"
              className="ds-btn-ghost px-3 py-1 text-sm"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
