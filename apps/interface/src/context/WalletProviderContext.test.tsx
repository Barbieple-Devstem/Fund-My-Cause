import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  WalletProviderContextProvider,
  useWallet,
} from "./WalletProviderContext";
import { createMockWalletProvider } from "@/__mocks__/mockWalletProvider";

function TestComponent() {
  const {
    state,
    publicKey,
    isConnected,
    isPending,
    isError,
    connect,
    disconnect,
  } = useWallet();

  return (
    <div>
      <div data-testid="state">{state}</div>
      <div data-testid="public-key">{publicKey || "null"}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="is-pending">{isPending.toString()}</div>
      <div data-testid="is-error">{isError.toString()}</div>
      <button onClick={() => connect()}>Connect</button>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}

describe("WalletProviderContext", () => {
  it("provides wallet provider to children", () => {
    const mockProvider = createMockWalletProvider({ initialState: "idle" });

    render(
      <WalletProviderContextProvider provider={mockProvider}>
        <TestComponent />
      </WalletProviderContextProvider>,
    );

    expect(screen.getByTestId("state")).toHaveTextContent("idle");
    expect(screen.getByTestId("is-connected")).toHaveTextContent("false");
  });

  it("tracks connection state changes", async () => {
    const mockProvider = createMockWalletProvider({ initialState: "idle" });

    render(
      <WalletProviderContextProvider provider={mockProvider}>
        <TestComponent />
      </WalletProviderContextProvider>,
    );

    const connectButton = screen.getByRole("button", { name: /Connect/ });
    connectButton.click();

    await waitFor(() => {
      expect(screen.getByTestId("is-connected")).toHaveTextContent("true");
      expect(screen.getByTestId("public-key")).not.toHaveTextContent("null");
    });
  });

  it("tracks disconnection", async () => {
    const mockProvider = createMockWalletProvider({
      initialState: "connected",
    });

    render(
      <WalletProviderContextProvider provider={mockProvider}>
        <TestComponent />
      </WalletProviderContextProvider>,
    );

    expect(screen.getByTestId("is-connected")).toHaveTextContent("true");

    const disconnectButton = screen.getByRole("button", { name: /Disconnect/ });
    disconnectButton.click();

    await waitFor(() => {
      expect(screen.getByTestId("is-connected")).toHaveTextContent("false");
      expect(screen.getByTestId("public-key")).toHaveTextContent("null");
    });
  });

  it("throws when useWallet is called outside provider", () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => {
      render(<TestComponent />);
    }).toThrow(
      "useWalletProvider must be called within a WalletProviderContextProvider",
    );

    consoleErrorSpy.mockRestore();
  });

  it("handles connection errors", async () => {
    const mockProvider = createMockWalletProvider({
      initialState: "idle",
      connectError: "User denied access",
    });

    render(
      <WalletProviderContextProvider provider={mockProvider}>
        <TestComponent />
      </WalletProviderContextProvider>,
    );

    const connectButton = screen.getByRole("button", { name: /Connect/ });
    connectButton.click();

    await waitFor(() => {
      expect(screen.getByTestId("is-error")).toHaveTextContent("true");
    });
  });
});
