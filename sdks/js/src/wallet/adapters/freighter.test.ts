import {
  requestAccess,
  signTransaction,
  getNetworkDetails,
} from "@stellar/freighter-api";
import { freighterAdapter } from "./freighter";

const mockWatch = jest.fn();
const mockStop = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  requestAccess: jest.fn(),
  signTransaction: jest.fn(),
  getNetworkDetails: jest.fn(),
  WatchWalletChanges: class {
    watch = mockWatch;
    stop = mockStop;
  },
}));

const mockRequestAccess = requestAccess as jest.MockedFunction<typeof requestAccess>;
const mockSignTransaction = signTransaction as jest.MockedFunction<
  typeof signTransaction
>;
const mockGetNetworkDetails = getNetworkDetails as jest.MockedFunction<
  typeof getNetworkDetails
>;

const ADDRESS = "GABC123456789ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN";
const PASSPHRASE = "Test SDF Network ; September 2015";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("freighterAdapter", () => {
  it("is named for the wallet-selection UI", () => {
    expect(freighterAdapter.name).toBe("Freighter");
  });

  it("has no disconnect — the extension holds no session to tear down", () => {
    expect(freighterAdapter.disconnect).toBeUndefined();
  });

  describe("connect", () => {
    it("returns the address the extension granted", async () => {
      mockRequestAccess.mockResolvedValue({ address: ADDRESS } as never);

      await expect(freighterAdapter.connect()).resolves.toBe(ADDRESS);
    });

    it("throws the extension's message when access is refused", async () => {
      mockRequestAccess.mockResolvedValue({
        error: { message: "User declined access" },
      } as never);

      await expect(freighterAdapter.connect()).rejects.toThrow(
        "User declined access",
      );
    });

    it("falls back to a generic message when the error carries none", async () => {
      mockRequestAccess.mockResolvedValue({ error: {} } as never);

      await expect(freighterAdapter.connect()).rejects.toThrow(
        "Freighter connection failed",
      );
    });

    it("propagates a rejection from the extension itself", async () => {
      mockRequestAccess.mockRejectedValue(new Error("Freighter is not installed"));

      await expect(freighterAdapter.connect()).rejects.toThrow(
        "Freighter is not installed",
      );
    });
  });

  describe("signTransaction", () => {
    it("returns the signed XDR", async () => {
      mockSignTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" } as never);

      await expect(
        freighterAdapter.signTransaction("UNSIGNED_XDR", PASSPHRASE),
      ).resolves.toBe("SIGNED_XDR");
    });

    it("forwards the network passphrase to the extension", async () => {
      mockSignTransaction.mockResolvedValue({ signedTxXdr: "SIGNED_XDR" } as never);

      await freighterAdapter.signTransaction("UNSIGNED_XDR", PASSPHRASE);

      expect(mockSignTransaction).toHaveBeenCalledWith("UNSIGNED_XDR", {
        networkPassphrase: PASSPHRASE,
      });
    });

    it("throws the extension's message when signing is rejected", async () => {
      mockSignTransaction.mockResolvedValue({
        error: { message: "User declined the transaction" },
      } as never);

      await expect(
        freighterAdapter.signTransaction("UNSIGNED_XDR", PASSPHRASE),
      ).rejects.toThrow("User declined the transaction");
    });

    it("falls back to a generic message when the error carries none", async () => {
      mockSignTransaction.mockResolvedValue({ error: {} } as never);

      await expect(
        freighterAdapter.signTransaction("UNSIGNED_XDR", PASSPHRASE),
      ).rejects.toThrow("Signing failed");
    });
  });

  describe("getNetwork", () => {
    it("reports the network the extension is set to", async () => {
      mockGetNetworkDetails.mockResolvedValue({
        network: "TESTNET",
        networkPassphrase: PASSPHRASE,
        networkUrl: "https://horizon-testnet.stellar.org",
      } as never);

      await expect(freighterAdapter.getNetwork?.()).resolves.toEqual({
        network: "TESTNET",
        networkPassphrase: PASSPHRASE,
      });
    });

    it("returns null rather than throwing when the network cannot be read", async () => {
      mockGetNetworkDetails.mockResolvedValue({
        error: { message: "Freighter is locked" },
      } as never);

      await expect(freighterAdapter.getNetwork?.()).resolves.toBeNull();
    });
  });

  describe("onAccountChange", () => {
    it("forwards the new account and network to the callback", () => {
      const callback = jest.fn();
      freighterAdapter.onAccountChange?.(callback);

      mockWatch.mock.calls[0][0]({
        address: ADDRESS,
        network: "TESTNET",
        networkPassphrase: PASSPHRASE,
      });

      expect(callback).toHaveBeenCalledWith({
        address: ADDRESS,
        network: "TESTNET",
        networkPassphrase: PASSPHRASE,
      });
    });

    it("swallows watcher errors instead of surfacing a partial account", () => {
      const callback = jest.fn();
      freighterAdapter.onAccountChange?.(callback);

      mockWatch.mock.calls[0][0]({
        address: "",
        network: "",
        networkPassphrase: "",
        error: { message: "Freighter is locked" },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("stops the watcher when the returned unsubscribe is called", () => {
      const unsubscribe = freighterAdapter.onAccountChange?.(jest.fn());

      unsubscribe?.();

      expect(mockStop).toHaveBeenCalled();
    });
  });
});
