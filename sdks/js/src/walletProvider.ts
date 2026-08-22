/**
 * Wallet provider interface for Fund-My-Cause applications.
 * Abstracts wallet interactions (Freighter, Lobstr, etc.) for testability.
 */

export type WalletProviderState = "idle" | "pending" | "connected" | "error";

/**
 * Wallet provider interface that components should depend on.
 * Enables dependency injection for testing without a live wallet.
 */
export interface WalletProvider {
  /**
   * Current connection state.
   */
  state: WalletProviderState;

  /**
   * Currently connected public key, or null if not connected.
   */
  publicKey: string | null;

  /**
   * Connect to the wallet and request access.
   * @returns The connected public key
   * @throws Error if connection fails or user denies
   */
  connect(): Promise<string>;

  /**
   * Disconnect from the wallet.
   */
  disconnect(): Promise<void>;

  /**
   * Sign a transaction XDR with the wallet.
   * @param xdr - The prepared transaction as base64 XDR
   * @returns The signed transaction as base64 XDR
   * @throws Error if signing fails or wallet is not connected
   */
  signTransaction(xdr: string): Promise<string>;

  /**
   * Get the network details from the wallet.
   * @returns Network name (e.g., 'Public Global Stellar Network')
   */
  getNetworkDetails(): Promise<string>;

  /**
   * Subscribe to connection state changes.
   * @param callback - Called when state or publicKey changes
   * @returns Unsubscribe function
   */
  onStateChange(callback: (state: WalletProviderState, publicKey: string | null) => void): () => void;
}

/**
 * Options for creating a mock wallet provider in tests.
 */
export interface MockWalletProviderConfig {
  /**
   * Initial state: "idle", "pending", "connected", or "error"
   */
  initialState?: WalletProviderState;

  /**
   * Public key to use when connected
   */
  publicKey?: string;

  /**
   * Error message to throw on connect() (makes state "error")
   */
  connectError?: string;

  /**
   * Error message to throw on signTransaction()
   */
  signError?: string;

  /**
   * Network name to return from getNetworkDetails()
   */
  networkName?: string;

  /**
   * Delay in ms before completing async operations (useful for testing loading states)
   */
  delay?: number;
}
