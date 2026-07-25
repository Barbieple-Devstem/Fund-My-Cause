import { createMockWalletProvider } from "./mockWalletProvider";

describe("createMockWalletProvider", () => {
  it("creates a provider in idle state by default", () => {
    const provider = createMockWalletProvider();
    expect(provider.state).toBe("idle");
    expect(provider.publicKey).toBeNull();
  });

  it("creates a provider in connected state when configured", () => {
    const provider = createMockWalletProvider({ initialState: "connected" });
    expect(provider.state).toBe("connected");
    expect(provider.publicKey).toBeTruthy();
  });

  it("connects and sets state to connected", async () => {
    const provider = createMockWalletProvider({ initialState: "idle" });

    const pk = await provider.connect();

    expect(pk).toBeTruthy();
    expect(provider.state).toBe("connected");
    expect(provider.publicKey).toBe(pk);
  });

  it("disconnects and clears public key", async () => {
    const provider = createMockWalletProvider({ initialState: "connected" });

    await provider.disconnect();

    expect(provider.state).toBe("idle");
    expect(provider.publicKey).toBeNull();
  });

  it("throws error on connect when connectError is configured", async () => {
    const provider = createMockWalletProvider({
      initialState: "idle",
      connectError: "User denied",
    });

    await expect(provider.connect()).rejects.toThrow("User denied");
    expect(provider.state).toBe("error");
  });

  it("throws error on signTransaction when not connected", async () => {
    const provider = createMockWalletProvider({ initialState: "idle" });

    await expect(provider.signTransaction("xdr123")).rejects.toThrow(
      "Wallet not connected",
    );
  });

  it("signs transaction when connected", async () => {
    const provider = createMockWalletProvider({ initialState: "connected" });

    const signed = await provider.signTransaction("xdr123");

    expect(signed).toBe("signed_xdr123");
  });

  it("throws error on signTransaction when signError is configured", async () => {
    const provider = createMockWalletProvider({
      initialState: "connected",
      signError: "Sign failed",
    });

    await expect(provider.signTransaction("xdr123")).rejects.toThrow(
      "Sign failed",
    );
  });

  it("returns network details", async () => {
    const provider = createMockWalletProvider({
      networkName: "Test SDF Network",
    });

    const network = await provider.getNetworkDetails();

    expect(network).toBe("Test SDF Network");
  });

  it("notifies listeners on state change", async () => {
    const provider = createMockWalletProvider({ initialState: "idle" });
    const listener = jest.fn();

    provider.onStateChange(listener);
    await provider.connect();

    expect(listener).toHaveBeenCalledWith("connected", expect.any(String));
  });

  it("unsubscribes listener when returned function is called", async () => {
    const provider = createMockWalletProvider({ initialState: "idle" });
    const listener = jest.fn();

    const unsubscribe = provider.onStateChange(listener);
    unsubscribe();
    await provider.connect();

    expect(listener).not.toHaveBeenCalled();
  });

  it("respects delay configuration", async () => {
    const provider = createMockWalletProvider({
      initialState: "idle",
      delay: 50,
    });

    const start = Date.now();
    await provider.connect();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeGreaterThanOrEqual(50);
  });

  it("uses custom public key when provided", async () => {
    const customPk = "GAABBCCDD";
    const provider = createMockWalletProvider({
      initialState: "idle",
      publicKey: customPk,
    });

    const pk = await provider.connect();

    expect(pk).toBe(customPk);
  });
});
