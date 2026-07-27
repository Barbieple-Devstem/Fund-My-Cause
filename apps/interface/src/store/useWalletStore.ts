import { create } from "zustand";
import { getNetworkDetails } from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE } from "@/lib/constants";
import { freighterAdapter } from "@/lib/freighterAdapter";
import { lobstrAdapter } from "@/lib/lobstrAdapter";
import type { WalletAdapter } from "@/lib/walletAdapters";
import type { ToastType } from "@/components/ui/Toast";
import {
  saveSession,
  loadSession,
  clearSession,
  isNetworkMatch,
  classifySignError,
  type WalletType,
} from "@/services/wallet.service";

const ADAPTERS: Record<WalletType, WalletAdapter> = {
  freighter: freighterAdapter,
  lobstr: lobstrAdapter,
};

type Toaster = (message: string, type: ToastType) => void;

export interface WalletStoreState {
  address: string | null;
  activeAdapter: WalletAdapter | null;
  isConnecting: boolean;
  isAutoConnecting: boolean;
  isSigning: boolean;
  error: string | null;
  networkMismatch: boolean;
  walletNetwork: string | null;
  showWalletSelect: boolean;

  setShowWalletSelect: (show: boolean) => void;
  autoRestore: () => Promise<void>;
  connectWith: (walletType: WalletType, onToast: Toaster) => Promise<void>;
  disconnect: (onToast: Toaster) => Promise<void>;
  signTx: (xdr: string, onToast: Toaster) => Promise<string>;
}

async function checkNetwork(set: (partial: Partial<WalletStoreState>) => void) {
  const result = await getNetworkDetails();
  if (result.error) return;
  set({
    walletNetwork: result.network,
    networkMismatch: !isNetworkMatch(result.networkPassphrase),
  });
}

export const useWalletStore = create<WalletStoreState>((set, get) => ({
  address: null,
  activeAdapter: null,
  isConnecting: false,
  isAutoConnecting: true,
  isSigning: false,
  error: null,
  networkMismatch: false,
  walletNetwork: null,
  showWalletSelect: false,

  setShowWalletSelect: (show) => set({ showWalletSelect: show }),

  autoRestore: async () => {
    const saved = loadSession();
    if (saved) {
      set({
        address: saved.address,
        activeAdapter: ADAPTERS[saved.walletType],
      });
      await checkNetwork(set);
    }
    set({ isAutoConnecting: false });
  },

  connectWith: async (walletType, onToast) => {
    set({ showWalletSelect: false, isConnecting: true, error: null });
    const adapter = ADAPTERS[walletType];
    try {
      const addr = await adapter.connect();
      saveSession(addr, walletType);
      set({ address: addr, activeAdapter: adapter });
      await checkNetwork(set);
      onToast("Wallet connected successfully!", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to connect wallet.";
      set({ error: msg });
      onToast(msg, "error");
    } finally {
      set({ isConnecting: false });
    }
  },

  disconnect: async (onToast) => {
    await get().activeAdapter?.disconnect?.();
    clearSession();
    set({
      address: null,
      activeAdapter: null,
      networkMismatch: false,
      walletNetwork: null,
    });
    onToast("Wallet disconnected", "info");
  },

  signTx: async (xdr, onToast) => {
    const adapter = get().activeAdapter;
    if (!adapter) throw new Error("No wallet connected");
    set({ isSigning: true });
    try {
      return await adapter.signTransaction(xdr, NETWORK_PASSPHRASE);
    } catch (e) {
      const kind = classifySignError(e);
      if (kind === "cancelled") onToast("Transaction cancelled", "info");
      else if (kind === "network")
        onToast("Network error, please try again", "error");
      throw e;
    } finally {
      set({ isSigning: false });
    }
  },
}));
