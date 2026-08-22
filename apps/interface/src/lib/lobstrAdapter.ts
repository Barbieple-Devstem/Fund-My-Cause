import { createLobstrAdapter } from "@fund-my-cause/sdk/wallet";

// LOBSTR connect/sign/disconnect logic lives in @fund-my-cause/sdk/wallet.
// This just supplies the app's WalletConnect project ID (set
// NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local).
export const lobstrAdapter = createLobstrAdapter({
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "",
});
