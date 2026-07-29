/**
 * Unit tests for the sdks/js wallet-connect module (#940)
 *
 * Covers every public export from sdks/js/src/wallet/:
 *   - WalletAdapter interface contract (freighterAdapter, createLobstrAdapter)
 *   - connect / sign / disconnect flows — success AND failure paths
 *   - Edge cases: user rejection, network error, sign-before-connect
 *   - onAccountChange / disconnect event subscriptions
 *   - classifySignError & isNetworkMatch helpers
 *   - saveWalletSession / loadWalletSession / clearWalletSession
 *
 * The Stellar SDK and WalletConnect client are fully mocked — no outbound
 * network connections occur during these tests.
 *
 * Coverage target: ≥ 90 % of the wallet-connect module (all files under
 * sdks/js/src/wallet/).
 *
 * Run:
 *   npm test --workspace=sdks/js
 *   # or from the repo root:
 *   npx jest sdks/js/src/wallet/wallet-connect.test.ts
 */

// ── Mock @stellar/freighter-api ───────────────────────────────────────────────

const mockWatch = jest.fn();
const mockStop = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  requestAccess: jest.fn(),
  signTransaction: jest.fn(),
  getNetworkDetails: jest.fn(),
  WatchWalletChanges: class MockWatcher {
    watch = mockWatch;
    stop = mockStop;
  },
}));

// ── Mock @walletconnect/sign-client ───────────────────────────────────────────

const mockWcInit = jest.fn();

jest.mock("@walletconnect/sign-client", () => ({
  __esModule: true,
  default: {
    init: (...args: unknown[]) => mockWcInit(...args),
  },
}));

// ── Imports (after mocks are declared) ────────────────────────────────────────

import {
  requestAccess,
  signTransaction as freighterSign,
  getNetworkDetails,
} from "@stellar/freighter-api";
import { freighterAdapter } from "./adapters/freighter";
import { createLobstrAdapter } from "./adapters/lobstr";
import { classifySignError, isNetworkMatch } from "./errors";
import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
} from "./session";
import type { WalletAdapter, AccountChange } from "./types";

// ── Typed mock helpers ─────────────────────────────────────────────────────────

const mockRequestAccess = requestAccess as jest.MockedFunction<typeof requestAccess>;
const mockFreighterSign = freighterSign as jest.MockedFunction<typeof freighterSign>;
const mockGetNetworkDetails = getNetworkDetails as jest.MockedFunction<
  typeof getNetworkDetails
>;

// ── Constants ─────────────────────────────────────────────────────────────────

const MOCK_ADDRESS = "GMOCK1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
const MAINNET_PASSPHRASE = "Public Global Stellar Network ; September 2015";
const UNSIGNED_XDR = "AAAAAQAAAAAA...UNSIGNED";
const SIGNED_XDR = "AAAAAQAAAAAA...SIGNED";

// ── WalletConnect client stub factory ─────────────────────────────────────────

interface WcClientStub {
  connect: jest.Mock;
  request: jest.Mock;
  disconnect: jest.Mock;
}

function makeWcClient(
  accounts: string[] = [`stellar:testnet:${MOCK_ADDRESS}`],
): WcClientStub {
  return {
    connect: jest.fn().mockResolvedValue({
      uri: "wc:test@2?relay-protocol=irn",
      approval: jest
        .fn()
        .mockResolvedValue({
          topic: "test-topic",
          namespaces: { stellar: { accounts } },
        }),
    }),
    request: jest.fn().mockResolvedValue({ signedXDR: SIGNED_XDR }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

// ── sessionStorage stub (jsdom absent in node test env) ───────────────────────

function makeSessionStorageStub(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
  };
}

// ── Global setup / teardown ───────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  globalThis.sessionStorage = makeSessionStorageStub();
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1 — freighterAdapter
// ═════════════════════════════════════════════════════════════════════════════

describe("freighterAdapter — interface contract", () => {
  it("implements the WalletAdapter interface", () => {
    const adapter: WalletAdapter = freighterAdapter;
    expect(adapter).toBeDefined();
    expect(typeof adapter.connect).toBe("function");
    expect(typeof adapter.signTransaction).toBe("function");
  });

  it("is named 'Freighter'", () => {
    expect(freighterAdapter.name).toBe("Freighter");
  });

  it("does not expose a disconnect method (extension manages its own session)", () => {
    expect(freighterAdapter.disconnect).toBeUndefined();
  });

  it("exposes getNetwork and onAccountChange as optional capabilities", () => {
    expect(typeof freighterAdapter.getNetwork).toBe("function");
    expect(typeof freighterAdapter.onAccountChange).toBe("function");
  });
});

describe("freighterAdapter.connect — success path", () => {
  it("resolves with the public key granted by the extension", async () => {
    mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS } as never);
    await expect(freighterAdapter.connect()).resolves.toBe(MOCK_ADDRESS);
  });

  it("calls requestAccess exactly once", async () => {
    mockRequestAccess.mockResolvedValue({ address: MOCK_ADDRESS } as never);
    await freighterAdapter.connect();
    expect(mockRequestAccess).toHaveBeenCalledTimes(1);
  });
});

describe("freighterAdapter.connect — failure paths", () => {
  it("throws when the extension returns an error with a message", async () => {
    mockRequestAccess.mockResolvedValue({
      error: { message: "User declined access" },
    } as never);
    await expect(freighterAdapter.connect()).rejects.toThrow("User declined access");
  });

  it("throws a generic message when the error has no message field", async () => {
    mockRequestAccess.mockResolvedValue({ error: {} } as never);
    await expect(freighterAdapter.connect()).rejects.toThrow(
      "Freighter connection failed",
    );
  });

  it("propagates a rejection thrown directly by the extension", async () => {
    mockRequestAccess.mockRejectedValue(new Error("Extension not installed"));
    await expect(freighterAdapter.connect()).rejects.toThrow("Extension not installed");
  });

  it("classifies a user-rejection error as 'cancelled'", async () => {
    mockRequestAccess.mockRejectedValue(new Error("User declined the request"));
    const err = await freighterAdapter.connect().catch((e) => e);
    expect(classifySignError(err)).toBe("cancelled");
  });

  it("classifies a network error as 'network'", async () => {
    mockRequestAccess.mockRejectedValue(new Error("network error connecting to extension"));
    const err = await freighterAdapter.connect().catch((e) => e);
    expect(classifySignError(err)).toBe("network");
  });
});

describe("freighterAdapter.signTransaction — success path", () => {
  it("resolves with the signed XDR string", async () => {
    mockFreighterSign.mockResolvedValue({ signedTxXdr: SIGNED_XDR } as never);
    await expect(
      freighterAdapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).resolves.toBe(SIGNED_XDR);
  });

  it("forwards the XDR and network passphrase to the extension", async () => {
    mockFreighterSign.mockResolvedValue({ signedTxXdr: SIGNED_XDR } as never);
    await freighterAdapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE);
    expect(mockFreighterSign).toHaveBeenCalledWith(UNSIGNED_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
  });
});

describe("freighterAdapter.signTransaction — failure paths", () => {
  it("throws the extension's rejection message", async () => {
    mockFreighterSign.mockResolvedValue({
      error: { message: "User declined the transaction" },
    } as never);
    await expect(
      freighterAdapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).rejects.toThrow("User declined the transaction");
  });

  it("falls back to 'Signing failed' when error has no message", async () => {
    mockFreighterSign.mockResolvedValue({ error: {} } as never);
    await expect(
      freighterAdapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).rejects.toThrow("Signing failed");
  });

  it("classifies a user-rejection sign error as 'cancelled'", async () => {
    mockFreighterSign.mockResolvedValue({
      error: { message: "User rejected the signing request" },
    } as never);
    const err = await freighterAdapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(classifySignError(err)).toBe("cancelled");
  });

  it("classifies a connectivity sign error as 'network'", async () => {
    mockFreighterSign.mockRejectedValue(new Error("fetch failed: network timeout"));
    const err = await freighterAdapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(classifySignError(err)).toBe("network");
  });

  it("surfaces as a typed Error, not an unhandled rejection", async () => {
    mockFreighterSign.mockResolvedValue({ error: { message: "oops" } } as never);
    const result = await freighterAdapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("freighterAdapter.getNetwork", () => {
  it("returns the network and passphrase reported by the extension", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      network: "TESTNET",
      networkPassphrase: TESTNET_PASSPHRASE,
      networkUrl: "https://horizon-testnet.stellar.org",
    } as never);
    await expect(freighterAdapter.getNetwork?.()).resolves.toEqual({
      network: "TESTNET",
      networkPassphrase: TESTNET_PASSPHRASE,
    });
  });

  it("returns null when the extension reports an error (non-throwing)", async () => {
    mockGetNetworkDetails.mockResolvedValue({
      error: { message: "Freighter is locked" },
    } as never);
    await expect(freighterAdapter.getNetwork?.()).resolves.toBeNull();
  });

  it("returns null rather than throwing when the extension is unavailable", async () => {
    mockGetNetworkDetails.mockRejectedValue(new Error("Freighter not installed"));
    await expect(freighterAdapter.getNetwork?.()).resolves.toBeNull();
  });
});

describe("freighterAdapter.onAccountChange — subscription", () => {
  it("invokes the callback when the account changes", () => {
    const callback = jest.fn();
    freighterAdapter.onAccountChange?.(callback);

    const change: AccountChange = {
      address: MOCK_ADDRESS,
      network: "TESTNET",
      networkPassphrase: TESTNET_PASSPHRASE,
    };
    mockWatch.mock.calls[0]?.[0](change);

    expect(callback).toHaveBeenCalledWith(change);
  });

  it("does not invoke the callback when the watcher emits an error", () => {
    const callback = jest.fn();
    freighterAdapter.onAccountChange?.(callback);

    mockWatch.mock.calls[0]?.[0]({
      address: "",
      network: "",
      networkPassphrase: "",
      error: { message: "Freighter locked" },
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that stops the watcher", () => {
    const unsub = freighterAdapter.onAccountChange?.(jest.fn());
    unsub?.();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("supports multiple independent subscriptions", () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    freighterAdapter.onAccountChange?.(cb1);
    freighterAdapter.onAccountChange?.(cb2);

    // Each call registers a new watcher; fire the first one
    mockWatch.mock.calls[0]?.[0]({
      address: MOCK_ADDRESS,
      network: "TESTNET",
      networkPassphrase: TESTNET_PASSPHRASE,
    });

    expect(cb1).toHaveBeenCalledTimes(1);
    // cb2 is on its own watcher instance — not triggered by the first call
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2 — createLobstrAdapter
// ═════════════════════════════════════════════════════════════════════════════

describe("createLobstrAdapter — interface contract", () => {
  it("is named 'LOBSTR'", () => {
    expect(createLobstrAdapter({ projectId: "pid" }).name).toBe("LOBSTR");
  });

  it("implements connect, signTransaction, and disconnect", () => {
    const adapter = createLobstrAdapter({ projectId: "pid" });
    expect(typeof adapter.connect).toBe("function");
    expect(typeof adapter.signTransaction).toBe("function");
    expect(typeof adapter.disconnect).toBe("function");
  });
});

describe("createLobstrAdapter.connect — success path", () => {
  it("resolves with the Stellar address parsed from the CAIP account", async () => {
    mockWcInit.mockResolvedValue(makeWcClient());
    await expect(
      createLobstrAdapter({ projectId: "pid" }).connect(),
    ).resolves.toBe(MOCK_ADDRESS);
  });

  it("initialises the WalletConnect client only once per adapter instance", async () => {
    const client = makeWcClient();
    mockWcInit.mockResolvedValue(client);
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.connect();
    expect(mockWcInit).toHaveBeenCalledTimes(1);
  });

  it("passes project id and app metadata to SignClient.init", async () => {
    mockWcInit.mockResolvedValue(makeWcClient());
    await createLobstrAdapter({
      projectId: "my-pid",
      appName: "TestApp",
      appDescription: "Testing things",
      appUrl: "https://test.example",
    }).connect();

    expect(mockWcInit).toHaveBeenCalledWith({
      projectId: "my-pid",
      metadata: {
        name: "TestApp",
        description: "Testing things",
        url: "https://test.example",
        icons: [],
      },
    });
  });
});

describe("createLobstrAdapter.connect — failure paths", () => {
  it("throws when the approved session carries no Stellar account", async () => {
    mockWcInit.mockResolvedValue(makeWcClient([]));
    await expect(
      createLobstrAdapter({ projectId: "pid" }).connect(),
    ).rejects.toThrow("No Stellar account returned by LOBSTR");
  });

  it("throws when the CAIP account string has no address segment", async () => {
    mockWcInit.mockResolvedValue(makeWcClient(["stellar:testnet"]));
    await expect(
      createLobstrAdapter({ projectId: "pid" }).connect(),
    ).rejects.toThrow("Could not parse address from LOBSTR session");
  });

  it("surfaces as a typed Error, not an unhandled rejection", async () => {
    mockWcInit.mockResolvedValue(makeWcClient([]));
    const result = await createLobstrAdapter({ projectId: "pid" })
      .connect()
      .catch((e) => e);
    expect(result).toBeInstanceOf(Error);
  });
});

describe("createLobstrAdapter.signTransaction — success path", () => {
  it("returns the signed XDR from LOBSTR", async () => {
    mockWcInit.mockResolvedValue(makeWcClient());
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await expect(
      adapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).resolves.toBe(SIGNED_XDR);
  });

  it("targets stellar:testnet for the testnet passphrase", async () => {
    const client = makeWcClient();
    mockWcInit.mockResolvedValue(client);
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE);

    expect(client.request).toHaveBeenCalledWith({
      topic: "test-topic",
      chainId: "stellar:testnet",
      request: { method: "stellar_signXDR", params: { xdr: UNSIGNED_XDR } },
    });
  });

  it("targets stellar:pubnet for the mainnet passphrase", async () => {
    const client = makeWcClient([`stellar:pubnet:${MOCK_ADDRESS}`]);
    mockWcInit.mockResolvedValue(client);
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.signTransaction(UNSIGNED_XDR, MAINNET_PASSPHRASE);

    expect(client.request).toHaveBeenCalledWith(
      expect.objectContaining({ chainId: "stellar:pubnet" }),
    );
  });
});

describe("createLobstrAdapter.signTransaction — failure paths", () => {
  it("throws when called before connecting", async () => {
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await expect(
      adapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).rejects.toThrow("LOBSTR not connected");
  });

  it("classifies a user-rejection as 'cancelled'", async () => {
    const client = makeWcClient();
    client.request.mockRejectedValue(new Error("User rejected the request"));
    mockWcInit.mockResolvedValue(client);

    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    const err = await adapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(classifySignError(err)).toBe("cancelled");
  });

  it("classifies a network error as 'network'", async () => {
    const client = makeWcClient();
    client.request.mockRejectedValue(new Error("WalletConnect: connection timeout"));
    mockWcInit.mockResolvedValue(client);

    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    const err = await adapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(classifySignError(err)).toBe("network");
  });
});

describe("createLobstrAdapter.disconnect", () => {
  it("closes the WalletConnect session", async () => {
    const client = makeWcClient();
    mockWcInit.mockResolvedValue(client);
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.disconnect?.();

    expect(client.disconnect).toHaveBeenCalledWith({
      topic: "test-topic",
      reason: { code: 6000, message: "User disconnected" },
    });
  });

  it("prevents signing after disconnect", async () => {
    mockWcInit.mockResolvedValue(makeWcClient());
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.disconnect?.();

    await expect(
      adapter.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).rejects.toThrow("LOBSTR not connected");
  });

  it("is a no-op when called before connecting", async () => {
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await expect(adapter.disconnect?.()).resolves.toBeUndefined();
    expect(mockWcInit).not.toHaveBeenCalled();
  });

  it("surfaces as a typed Error post-disconnect, not an unhandled rejection", async () => {
    mockWcInit.mockResolvedValue(makeWcClient());
    const adapter = createLobstrAdapter({ projectId: "pid" });
    await adapter.connect();
    await adapter.disconnect?.();

    const result = await adapter
      .signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE)
      .catch((e) => e);
    expect(result).toBeInstanceOf(Error);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3 — classifySignError
// ═════════════════════════════════════════════════════════════════════════════

describe("classifySignError", () => {
  it.each([
    "User declined the request",
    "Request rejected by user",
    "Transaction cancelled",
    "Access denied",
    "USER DECLINED",
  ])("returns 'cancelled' for: %s", (msg) => {
    expect(classifySignError(new Error(msg))).toBe("cancelled");
  });

  it.each([
    "network error",
    "failed to fetch",
    "request timeout",
    "connection reset",
  ])("returns 'network' for: %s", (msg) => {
    expect(classifySignError(new Error(msg))).toBe("network");
  });

  it("returns 'cancelled' when a message matches both patterns (cancelled wins)", () => {
    expect(
      classifySignError(new Error("user rejected: network unreachable")),
    ).toBe("cancelled");
  });

  it("returns 'unknown' for an unrecognised message", () => {
    expect(classifySignError(new Error("XDR is malformed"))).toBe("unknown");
  });

  it("returns 'unknown' for a non-Error value (string)", () => {
    expect(classifySignError("declined")).toBe("unknown");
  });

  it("returns 'unknown' for null", () => {
    expect(classifySignError(null)).toBe("unknown");
  });

  it("returns 'unknown' for an Error with an empty message", () => {
    expect(classifySignError(new Error(""))).toBe("unknown");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4 — isNetworkMatch
// ═════════════════════════════════════════════════════════════════════════════

describe("isNetworkMatch", () => {
  it("returns true when both passphrases are identical", () => {
    expect(isNetworkMatch(TESTNET_PASSPHRASE, TESTNET_PASSPHRASE)).toBe(true);
  });

  it("returns false when the wallet is on a different network", () => {
    expect(isNetworkMatch(TESTNET_PASSPHRASE, MAINNET_PASSPHRASE)).toBe(false);
  });

  it("is exact — whitespace differences do not match", () => {
    expect(
      isNetworkMatch(TESTNET_PASSPHRASE, TESTNET_PASSPHRASE.replace(" ; ", ";")),
    ).toBe(false);
  });

  it("treats two empty passphrases as matching", () => {
    expect(isNetworkMatch("", "")).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 5 — Session persistence
// ═════════════════════════════════════════════════════════════════════════════

describe("wallet session persistence", () => {
  it("saves and restores a freighter session", () => {
    saveWalletSession(MOCK_ADDRESS, "freighter");
    expect(loadWalletSession()).toEqual({
      address: MOCK_ADDRESS,
      walletType: "freighter",
    });
  });

  it("saves and restores a lobstr session", () => {
    saveWalletSession(MOCK_ADDRESS, "lobstr");
    expect(loadWalletSession()?.walletType).toBe("lobstr");
  });

  it("returns null when no session has been persisted", () => {
    expect(loadWalletSession()).toBeNull();
  });

  it("overwrites a previous session on reconnect", () => {
    saveWalletSession(MOCK_ADDRESS, "freighter");
    saveWalletSession("GNEWADDR", "lobstr");
    expect(loadWalletSession()).toEqual({ address: "GNEWADDR", walletType: "lobstr" });
  });

  it("clearWalletSession removes both keys", () => {
    saveWalletSession(MOCK_ADDRESS, "lobstr");
    clearWalletSession();
    expect(loadWalletSession()).toBeNull();
    expect(sessionStorage.getItem("fmc:wallet_type")).toBeNull();
  });

  it("clearWalletSession is a no-op when no session exists", () => {
    expect(() => clearWalletSession()).not.toThrow();
    expect(loadWalletSession()).toBeNull();
  });

  it("falls back to 'freighter' when only the address key was persisted (legacy)", () => {
    sessionStorage.setItem("fmc:wallet_address", MOCK_ADDRESS);
    expect(loadWalletSession()).toEqual({
      address: MOCK_ADDRESS,
      walletType: "freighter",
    });
  });

  it("returns null when only the wallet-type key is present (no address)", () => {
    sessionStorage.setItem("fmc:wallet_type", "lobstr");
    expect(loadWalletSession()).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 6 — Adapter isolation
// ═════════════════════════════════════════════════════════════════════════════

describe("adapter isolation — adapters do not share state", () => {
  it("two LOBSTR adapter instances each initialise their own WC client", async () => {
    mockWcInit
      .mockResolvedValueOnce(makeWcClient())
      .mockResolvedValueOnce(makeWcClient());

    await createLobstrAdapter({ projectId: "pid-1" }).connect();
    await createLobstrAdapter({ projectId: "pid-2" }).connect();

    expect(mockWcInit).toHaveBeenCalledTimes(2);
  });

  it("disconnecting one LOBSTR adapter does not affect another", async () => {
    const clientA = makeWcClient();
    const clientB = makeWcClient();
    mockWcInit
      .mockResolvedValueOnce(clientA)
      .mockResolvedValueOnce(clientB);

    const adapterA = createLobstrAdapter({ projectId: "pid" });
    const adapterB = createLobstrAdapter({ projectId: "pid" });
    await adapterA.connect();
    await adapterB.connect();

    await adapterA.disconnect?.();

    // adapterB should still be able to sign
    await expect(
      adapterB.signTransaction(UNSIGNED_XDR, TESTNET_PASSPHRASE),
    ).resolves.toBe(SIGNED_XDR);
  });
});
