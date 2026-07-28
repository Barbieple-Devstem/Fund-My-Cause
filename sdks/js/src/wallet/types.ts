/**
 * Wallet identifiers supported by the shared wallet-connect module.
 */
export type WalletType = "freighter" | "lobstr";

/**
 * The network a wallet is currently pointed at.
 */
export interface WalletNetwork {
  /** Human-readable network name, e.g. `"TESTNET"`. */
  network: string;
  /** Passphrase identifying the network, for comparison via {@link isNetworkMatch}. */
  networkPassphrase: string;
}

/**
 * Payload delivered when the user switches account or network in their wallet.
 */
export interface AccountChange {
  /** The now-active Stellar public key. */
  address: string;
  /** The now-active network. */
  network: string;
  /** Passphrase of the now-active network. */
  networkPassphrase: string;
}

/**
 * Removes a previously registered listener.
 */
export type Unsubscribe = () => void;

/**
 * Common interface every wallet integration must implement.
 * Abstracts over Freighter (browser extension) and LOBSTR (WalletConnect),
 * so consuming apps can connect, sign, and disconnect without depending on
 * either wallet's SDK directly.
 *
 * `connect`, `signTransaction` are required; the rest are optional
 * capabilities — call them with `?.` and degrade gracefully when a wallet
 * does not provide them.
 */
export interface WalletAdapter {
  /** Human-readable wallet name shown in wallet-selection UI. */
  name: string;
  /**
   * Request access and return the user's public key.
   * @returns The connected Stellar public key (G...).
   */
  connect(): Promise<string>;
  /**
   * Sign a transaction XDR and return the signed XDR.
   * @param xdr - Unsigned transaction envelope, base64-encoded.
   * @param networkPassphrase - Network the transaction targets.
   * @returns The signed transaction envelope, base64-encoded.
   */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
  /**
   * Optional cleanup (e.g. closing a WalletConnect session).
   */
  disconnect?(): Promise<void>;
  /**
   * Reports which network the wallet is currently set to, so the app can warn
   * on a mismatch (e.g. wallet on Testnet while the app targets Mainnet).
   * @returns The wallet's current network, or `null` if it cannot be read.
   */
  getNetwork?(): Promise<WalletNetwork | null>;
  /**
   * Subscribes to account/network switches made by the user inside the wallet.
   * @param callback - Invoked with the newly active account and network.
   * @returns A function that stops the subscription.
   */
  onAccountChange?(callback: (change: AccountChange) => void): Unsubscribe;
}
