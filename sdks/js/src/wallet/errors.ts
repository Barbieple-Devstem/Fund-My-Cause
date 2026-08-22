/**
 * Coarse classification of a wallet-signing failure, used to decide what
 * feedback to surface to the user (e.g. a neutral "cancelled" toast vs. a
 * retryable "network" error).
 */
export type SignErrorKind = "cancelled" | "network" | "unknown";

/**
 * Classifies a wallet sign/connect error by inspecting its message.
 * @param err - The error thrown by a {@link WalletAdapter} method.
 * @returns `"cancelled"` if the user declined/rejected, `"network"` if it
 * looks like a connectivity failure, otherwise `"unknown"`.
 */
export function classifySignError(err: unknown): SignErrorKind {
  const msg = err instanceof Error ? err.message : "";
  if (/declined|rejected|cancel|denied/i.test(msg)) return "cancelled";
  if (/network|fetch|timeout|connection/i.test(msg)) return "network";
  return "unknown";
}

/**
 * Compares the network passphrase reported by a connected wallet against the
 * passphrase the app expects, to detect e.g. a wallet set to Testnet while
 * the app targets Mainnet.
 * @param actualPassphrase - Passphrase reported by the wallet.
 * @param expectedPassphrase - Passphrase the app is configured to use.
 * @returns Whether the two match.
 */
export function isNetworkMatch(
  actualPassphrase: string,
  expectedPassphrase: string,
): boolean {
  return actualPassphrase === expectedPassphrase;
}
