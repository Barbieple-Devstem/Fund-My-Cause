"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useWalletSlice } from "@/hooks/useWalletSlice";
import { WalletSelectModal } from "@/components/ui/WalletSelectModal";
import type { WalletType } from "@/services/wallet.service";

/**
 * Renders the wallet picker whenever useWallet()'s connect() is called.
 * Lives outside the WalletContext's old Provider tree since Zustand stores
 * don't need one — mount this once near the app root.
 */
export function WalletSelectModalHost() {
  const {
    showWalletSelect,
    setShowWalletSelect,
    connectWith: connectWithAction,
  } = useWalletSlice();
  const { addToast } = useToast();

  const handleSelect = useCallback(
    (walletType: WalletType) =>
      connectWithAction(walletType, (msg, type) => addToast(msg, type)),
    [connectWithAction, addToast],
  );

  if (!showWalletSelect) return null;

  return (
    <WalletSelectModal
      onSelect={handleSelect}
      onClose={() => setShowWalletSelect(false)}
    />
  );
}
