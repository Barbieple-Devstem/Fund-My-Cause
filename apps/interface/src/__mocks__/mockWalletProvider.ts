/**
 * Mock wallet provider for testing, satisfying the WalletProvider interface.
 * Allows configurable success/failure/pending states.
 */

import type {
  WalletProvider,
  WalletProviderState,
  MockWalletProviderConfig,
} from "@fund-my-cause/sdks/js";

export function createMockWalletProvider(
  config: MockWalletProviderConfig = {},
): WalletProvider {
  const {
    initialState = "idle",
    publicKey = "GBBD47UZQ5XKLQY4DH4Z5WCS6EDBLEDCCPPKRETZ3W6HDRNKYXI5V5CZ",
    connectError = undefined,
    signError = undefined,
    networkName = "Public Global Stellar Network",
    delay = 0,
  } = config;

  let currentState: WalletProviderState = initialState;
  let currentPublicKey: string | null =
    initialState === "connected" ? publicKey : null;
  const listeners: Set<
    (state: WalletProviderState, publicKey: string | null) => void
  > = new Set();

  function notifyListeners() {
    listeners.forEach((listener) => listener(currentState, currentPublicKey));
  }

  function setStateAndNotify(state: WalletProviderState, pk: string | null) {
    currentState = state;
    currentPublicKey = pk;
    notifyListeners();
  }

  async function applyDelay() {
    if (delay > 0) {
      return new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return {
    get state() {
      return currentState;
    },

    get publicKey() {
      return currentPublicKey;
    },

    async connect() {
      setStateAndNotify("pending", currentPublicKey);
      await applyDelay();

      if (connectError) {
        setStateAndNotify("error", null);
        throw new Error(connectError);
      }

      setStateAndNotify("connected", publicKey);
      return publicKey;
    },

    async disconnect() {
      await applyDelay();
      setStateAndNotify("idle", null);
    },

    async signTransaction(xdr: string) {
      if (currentState !== "connected") {
        throw new Error("Wallet not connected");
      }

      await applyDelay();

      if (signError) {
        throw new Error(signError);
      }

      return `signed_${xdr}`;
    },

    async getNetworkDetails() {
      await applyDelay();
      return networkName;
    },

    onStateChange(
      callback: (state: WalletProviderState, publicKey: string | null) => void,
    ) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
}
