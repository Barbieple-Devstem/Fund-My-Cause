import { createLobstrAdapter } from "./lobstr";

const mockInit = jest.fn();

jest.mock("@walletconnect/sign-client", () => ({
  __esModule: true,
  default: { init: (...args: unknown[]) => mockInit(...args) },
}));

const ADDRESS = "GABC123456789ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMN";
const TESTNET = "Test SDF Network ; September 2015";
const MAINNET = "Public Global Stellar Network ; September 2015";

interface SignClientStub {
  connect: jest.Mock;
  request: jest.Mock;
  disconnect: jest.Mock;
}

/** A WalletConnect SignClient stub that approves with the given accounts. */
function stubSignClient(
  accounts: string[] = [`stellar:testnet:${ADDRESS}`],
): SignClientStub {
  return {
    connect: jest.fn().mockResolvedValue({
      uri: "wc:topic@2?relay-protocol=irn",
      approval: jest
        .fn()
        .mockResolvedValue({ topic: "topic-1", namespaces: { stellar: { accounts } } }),
    }),
    request: jest.fn().mockResolvedValue({ signedXDR: "SIGNED_XDR" }),
    disconnect: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createLobstrAdapter", () => {
  it("is named for the wallet-selection UI", () => {
    expect(createLobstrAdapter({ projectId: "pid" }).name).toBe("LOBSTR");
  });

  it("returns independent instances so two apps don't share a session", async () => {
    const first = stubSignClient();
    const second = stubSignClient();
    mockInit.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    await createLobstrAdapter({ projectId: "pid" }).connect();
    await createLobstrAdapter({ projectId: "pid" }).connect();

    expect(mockInit).toHaveBeenCalledTimes(2);
  });

  describe("connect", () => {
    it("returns the address parsed out of the CAIP account id", async () => {
      mockInit.mockResolvedValue(stubSignClient());

      await expect(createLobstrAdapter({ projectId: "pid" }).connect()).resolves.toBe(
        ADDRESS,
      );
    });

    it("passes the project id and app metadata to SignClient.init", async () => {
      mockInit.mockResolvedValue(stubSignClient());

      await createLobstrAdapter({
        projectId: "pid",
        appName: "My App",
        appDescription: "Does things",
        appUrl: "https://example.test",
      }).connect();

      expect(mockInit).toHaveBeenCalledWith({
        projectId: "pid",
        metadata: {
          name: "My App",
          description: "Does things",
          url: "https://example.test",
          icons: [],
        },
      });
    });

    it("requests the Stellar namespace on both testnet and mainnet", async () => {
      const client = stubSignClient();
      mockInit.mockResolvedValue(client);

      await createLobstrAdapter({ projectId: "pid" }).connect();

      expect(client.connect).toHaveBeenCalledWith({
        requiredNamespaces: {
          stellar: {
            methods: ["stellar_signXDR"],
            chains: ["stellar:testnet", "stellar:pubnet"],
            events: [],
          },
        },
      });
    });

    it("initialises the client only once across repeated calls", async () => {
      const client = stubSignClient();
      mockInit.mockResolvedValue(client);
      const adapter = createLobstrAdapter({ projectId: "pid" });

      await adapter.connect();
      await adapter.connect();

      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    it("throws when the approved session carries no Stellar account", async () => {
      mockInit.mockResolvedValue(stubSignClient([]));

      await expect(
        createLobstrAdapter({ projectId: "pid" }).connect(),
      ).rejects.toThrow("No Stellar account returned by LOBSTR");
    });

    it("throws when the account id has no address segment", async () => {
      mockInit.mockResolvedValue(stubSignClient(["stellar:testnet"]));

      await expect(
        createLobstrAdapter({ projectId: "pid" }).connect(),
      ).rejects.toThrow("Could not parse address from LOBSTR session");
    });
  });

  describe("signTransaction", () => {
    it("returns the signed XDR from the wallet", async () => {
      mockInit.mockResolvedValue(stubSignClient());
      const adapter = createLobstrAdapter({ projectId: "pid" });
      await adapter.connect();

      await expect(adapter.signTransaction("UNSIGNED_XDR", TESTNET)).resolves.toBe(
        "SIGNED_XDR",
      );
    });

    it("targets the testnet chain for the testnet passphrase", async () => {
      const client = stubSignClient();
      mockInit.mockResolvedValue(client);
      const adapter = createLobstrAdapter({ projectId: "pid" });
      await adapter.connect();

      await adapter.signTransaction("UNSIGNED_XDR", TESTNET);

      expect(client.request).toHaveBeenCalledWith({
        topic: "topic-1",
        chainId: "stellar:testnet",
        request: { method: "stellar_signXDR", params: { xdr: "UNSIGNED_XDR" } },
      });
    });

    it("targets the mainnet chain for the public passphrase", async () => {
      const client = stubSignClient();
      mockInit.mockResolvedValue(client);
      const adapter = createLobstrAdapter({ projectId: "pid" });
      await adapter.connect();

      await adapter.signTransaction("UNSIGNED_XDR", MAINNET);

      expect(client.request).toHaveBeenCalledWith(
        expect.objectContaining({ chainId: "stellar:pubnet" }),
      );
    });

    it("throws when signing before connecting", async () => {
      const adapter = createLobstrAdapter({ projectId: "pid" });

      await expect(adapter.signTransaction("UNSIGNED_XDR", TESTNET)).rejects.toThrow(
        "LOBSTR not connected",
      );
    });
  });

  describe("disconnect", () => {
    it("closes the WalletConnect session", async () => {
      const client = stubSignClient();
      mockInit.mockResolvedValue(client);
      const adapter = createLobstrAdapter({ projectId: "pid" });
      await adapter.connect();

      await adapter.disconnect?.();

      expect(client.disconnect).toHaveBeenCalledWith({
        topic: "topic-1",
        reason: { code: 6000, message: "User disconnected" },
      });
    });

    it("leaves the adapter unable to sign afterwards", async () => {
      mockInit.mockResolvedValue(stubSignClient());
      const adapter = createLobstrAdapter({ projectId: "pid" });
      await adapter.connect();

      await adapter.disconnect?.();

      await expect(adapter.signTransaction("UNSIGNED_XDR", TESTNET)).rejects.toThrow(
        "LOBSTR not connected",
      );
    });

    it("is a no-op when never connected", async () => {
      const adapter = createLobstrAdapter({ projectId: "pid" });

      await expect(adapter.disconnect?.()).resolves.toBeUndefined();
      expect(mockInit).not.toHaveBeenCalled();
    });
  });
});
