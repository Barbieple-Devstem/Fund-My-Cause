import type { WalletType } from "./types";

const SESSION_KEY = "fmc:wallet_address";
const SESSION_WALLET_KEY = "fmc:wallet_type";

/**
 * A persisted wallet session, restorable across page loads.
 */
export interface WalletSession {
  /** Connected Stellar public key. */
  address: string;
  /** Which wallet adapter this session was connected through. */
  walletType: WalletType;
}

/**
 * Persists the connected wallet's address and type to `sessionStorage`, so
 * the connection survives a page reload within the same browser tab.
 * @param address - Connected Stellar public key.
 * @param walletType - Which wallet adapter connected.
 */
export function saveWalletSession(address: string, walletType: WalletType): void {
  sessionStorage.setItem(SESSION_KEY, address);
  sessionStorage.setItem(SESSION_WALLET_KEY, walletType);
}

/**
 * Reads a previously persisted wallet session, if any.
 * @returns The saved session, or `null` if none was persisted.
 */
export function loadWalletSession(): WalletSession | null {
  const address = sessionStorage.getItem(SESSION_KEY);
  if (!address) return null;
  const walletType = (sessionStorage.getItem(SESSION_WALLET_KEY) ??
    "freighter") as WalletType;
  return { address, walletType };
}

/**
 * Clears any persisted wallet session, e.g. on disconnect.
 */
export function clearWalletSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_WALLET_KEY);
}
