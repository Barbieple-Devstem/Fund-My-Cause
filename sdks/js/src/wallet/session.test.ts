import {
  saveWalletSession,
  loadWalletSession,
  clearWalletSession,
} from "./session";

const ADDRESS = "GABC123456789ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN";

/**
 * Minimal in-memory `sessionStorage` — the SDK targets the browser, but the
 * SDK's Jest environment is "node", which provides no Web Storage.
 */
function createStorageStub(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = String(v);
    },
    removeItem: (k: string) => {
      delete store[k];
    },
    clear: () => {
      store = {};
    },
  };
}

beforeEach(() => {
  globalThis.sessionStorage = createStorageStub();
});

describe("wallet session persistence", () => {
  it("round-trips a saved session", () => {
    saveWalletSession(ADDRESS, "freighter");

    expect(loadWalletSession()).toEqual({
      address: ADDRESS,
      walletType: "freighter",
    });
  });

  it("preserves the wallet type it was saved with", () => {
    saveWalletSession(ADDRESS, "lobstr");

    expect(loadWalletSession()?.walletType).toBe("lobstr");
  });

  it("returns null when nothing was persisted", () => {
    expect(loadWalletSession()).toBeNull();
  });

  it("overwrites a previous session rather than appending", () => {
    saveWalletSession(ADDRESS, "freighter");
    saveWalletSession("GXYZ", "lobstr");

    expect(loadWalletSession()).toEqual({ address: "GXYZ", walletType: "lobstr" });
  });

  it("falls back to freighter when only the address was persisted", () => {
    // Sessions written by an older build predate the wallet-type key.
    sessionStorage.setItem("fmc:wallet_address", ADDRESS);

    expect(loadWalletSession()).toEqual({
      address: ADDRESS,
      walletType: "freighter",
    });
  });

  it("treats a wallet type with no address as no session", () => {
    sessionStorage.setItem("fmc:wallet_type", "lobstr");

    expect(loadWalletSession()).toBeNull();
  });

  it("clears both keys on disconnect", () => {
    saveWalletSession(ADDRESS, "lobstr");
    clearWalletSession();

    expect(loadWalletSession()).toBeNull();
    expect(sessionStorage.getItem("fmc:wallet_type")).toBeNull();
  });

  it("is a no-op when clearing with no session saved", () => {
    expect(() => clearWalletSession()).not.toThrow();
    expect(loadWalletSession()).toBeNull();
  });
});
