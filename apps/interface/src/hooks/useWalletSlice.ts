/**
 * useWalletSlice — scoped selector hook for wallet/session state.
 *
 * Returns a shallow-stable snapshot so components only re-render when
 * the fields they care about actually change.
 *
 * Usage:
 *   const { address, isConnecting } = useWalletSlice();
 *   const { signTx, disconnect } = useWalletSlice();
 */

"use client";

import { useShallow } from "zustand/react/shallow";
import { useWalletStore } from "@/store/useWalletStore";
import type { WalletStoreState } from "@/store/useWalletStore";

/** Full wallet slice state + actions. */
export function useWalletSlice(): WalletStoreState {
  return useWalletStore(
    useShallow((s) => ({
      address: s.address,
      activeAdapter: s.activeAdapter,
      isConnecting: s.isConnecting,
      isAutoConnecting: s.isAutoConnecting,
      isSigning: s.isSigning,
      error: s.error,
      networkMismatch: s.networkMismatch,
      walletNetwork: s.walletNetwork,
      showWalletSelect: s.showWalletSelect,
      setShowWalletSelect: s.setShowWalletSelect,
      autoRestore: s.autoRestore,
      connectWith: s.connectWith,
      disconnect: s.disconnect,
      signTx: s.signTx,
    })),
  );
}

/**
 * Returns only the connection-status fields.
 * Use when a component only needs to know whether the wallet is connected.
 */
export function useWalletStatus() {
  return useWalletStore(
    useShallow((s) => ({
      address: s.address,
      isConnecting: s.isConnecting,
      isAutoConnecting: s.isAutoConnecting,
      networkMismatch: s.networkMismatch,
      walletNetwork: s.walletNetwork,
    })),
  );
}

/**
 * Returns only the signing-related fields.
 * Use in transaction submission flows.
 */
export function useWalletSigning() {
  return useWalletStore(
    useShallow((s) => ({
      isSigning: s.isSigning,
      signTx: s.signTx,
      address: s.address,
      error: s.error,
    })),
  );
}
