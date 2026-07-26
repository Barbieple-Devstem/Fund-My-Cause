"use client";

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from "react";
import type {
  WalletProvider,
  WalletProviderState,
} from "@fund-my-cause/sdks/js";

const WalletProviderContext = createContext<WalletProvider | undefined>(
  undefined,
);

export interface WalletProviderContextProps {
  children: React.ReactNode;
  provider: WalletProvider;
}

/**
 * Provides a wallet provider instance to child components via context.
 * Enables dependency injection for testing.
 */
export function WalletProviderContextProvider({
  children,
  provider,
}: WalletProviderContextProps) {
  return (
    <WalletProviderContext.Provider value={provider}>
      {children}
    </WalletProviderContext.Provider>
  );
}

/**
 * Hook to access the injected wallet provider.
 * Returns the wallet provider or throws if not wrapped by WalletProviderContextProvider.
 */
export function useWalletProvider(): WalletProvider {
  const provider = useContext(WalletProviderContext);
  if (!provider) {
    throw new Error(
      "useWalletProvider must be called within a WalletProviderContextProvider",
    );
  }
  return provider;
}

/**
 * Hook for convenient access to wallet state and operations.
 */
export function useWallet() {
  const provider = useWalletProvider();
  const [state, setState] = useState<WalletProviderState>(provider.state);
  const [publicKey, setPublicKey] = useState<string | null>(provider.publicKey);

  useEffect(() => {
    return provider.onStateChange((newState, newPublicKey) => {
      setState(newState);
      setPublicKey(newPublicKey);
    });
  }, [provider]);

  const connect = useCallback(() => provider.connect(), [provider]);
  const disconnect = useCallback(() => provider.disconnect(), [provider]);
  const signTransaction = useCallback(
    (xdr: string) => provider.signTransaction(xdr),
    [provider],
  );
  const getNetworkDetails = useCallback(
    () => provider.getNetworkDetails(),
    [provider],
  );

  return {
    state,
    publicKey,
    isConnected: state === "connected" && publicKey !== null,
    isPending: state === "pending",
    isError: state === "error",
    connect,
    disconnect,
    signTransaction,
    getNetworkDetails,
  };
}
