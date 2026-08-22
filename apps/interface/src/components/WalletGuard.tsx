"use client";

import React from "react";
import { Loader2, Wallet, AlertTriangle } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { NETWORK_NAME } from "@/lib/constants";

interface WalletGuardProps {
  children: React.ReactNode;
  message?: string;
}

export function WalletGuard({
  children,
  message = "Connect your wallet to continue.",
}: WalletGuardProps) {
  const {
    address,
    connect,
    isConnecting,
    isAutoConnecting,
    networkMismatch,
    walletNetwork,
  } = useWallet();

  if (isAutoConnecting) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    );
  }

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4">
        <p className="text-gray-600 dark:text-gray-400">{message}</p>
        <button
          onClick={connect}
          disabled={isConnecting}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-medium transition disabled:opacity-50 text-white"
        >
          {isConnecting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Wallet size={16} />
          )}
          Connect Wallet
        </button>
      </div>
    );
  }

  if (networkMismatch) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-4 px-6">
        <div
          role="alert"
          aria-live="assertive"
          className="flex flex-col items-center gap-4 max-w-md w-full p-6 rounded-2xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-center"
        >
          <AlertTriangle size={32} className="text-amber-500 shrink-0" />
          <div>
            <h2 className="text-base font-semibold mb-1">Wrong Network</h2>
            <p className="text-sm leading-relaxed">
              Your wallet is connected to{" "}
              <strong>{walletNetwork ?? "an unknown network"}</strong>, but this
              app requires <strong>{NETWORK_NAME}</strong>.
            </p>
            <p className="text-sm mt-2 leading-relaxed">
              Please switch your wallet to <strong>{NETWORK_NAME}</strong> to
              continue.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
