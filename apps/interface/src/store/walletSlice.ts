/**
 * walletSlice — wallet connection and session state.
 *
 * Re-exports the existing useWalletStore under the canonical "slice" name
 * so consumers can migrate to the sliced API while keeping the store
 * implementation unchanged.
 *
 * All wallet state lives here:
 *   • connected address
 *   • adapter reference (freighter / lobstr)
 *   • loading flags (isConnecting, isAutoConnecting, isSigning)
 *   • error message
 *   • network mismatch flag
 *   • wallet-select modal visibility
 *
 * See useWalletStore.ts for the full implementation.
 */

export {
  useWalletStore,
  type WalletStoreState as WalletSliceState,
} from "./useWalletStore";

// ── Selectors ─────────────────────────────────────────────────────────────────

import type { WalletStoreState } from "./useWalletStore";

/** Returns the connected wallet address, or null when disconnected. */
export const selectWalletAddress = (s: WalletStoreState) => s.address;

/** Returns true while the wallet is being connected for the first time. */
export const selectIsConnecting = (s: WalletStoreState) => s.isConnecting;

/** Returns true during the silent auto-restore on app load. */
export const selectIsAutoConnecting = (s: WalletStoreState) =>
  s.isAutoConnecting;

/** Returns true while a transaction is waiting for wallet signature. */
export const selectIsSigning = (s: WalletStoreState) => s.isSigning;

/** Returns the last wallet error message, or null. */
export const selectWalletError = (s: WalletStoreState) => s.error;

/** Returns true when the in-wallet network does not match the configured network. */
export const selectNetworkMismatch = (s: WalletStoreState) => s.networkMismatch;

/** Returns the Stellar network reported by the wallet extension. */
export const selectWalletNetwork = (s: WalletStoreState) => s.walletNetwork;

/** Returns true when the wallet picker modal should be shown. */
export const selectShowWalletSelect = (s: WalletStoreState) =>
  s.showWalletSelect;

/** Returns true when a wallet is currently connected. */
export const selectIsConnected = (s: WalletStoreState) => s.address !== null;
