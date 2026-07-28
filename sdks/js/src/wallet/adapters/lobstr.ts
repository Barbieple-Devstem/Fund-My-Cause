import type { WalletAdapter } from "../types";

const LOBSTR_WALLET_CONNECT_APP_URL = "https://lobstr.co";
const STELLAR_NAMESPACE = "stellar";
const STELLAR_CHAIN_TESTNET = "stellar:testnet";
const STELLAR_CHAIN_MAINNET = "stellar:pubnet";

/**
 * Configuration for {@link createLobstrAdapter}.
 */
export interface LobstrAdapterOptions {
  /** WalletConnect project ID — see https://cloud.walletconnect.com. */
  projectId: string;
  /** App name shown in the LOBSTR connection prompt. */
  appName?: string;
  /** App description shown in the LOBSTR connection prompt. */
  appDescription?: string;
  /** App URL shown in the LOBSTR connection prompt; defaults to `window.location.origin`. */
  appUrl?: string;
}

type SignClientInstance = Awaited<
  ReturnType<(typeof import("@walletconnect/sign-client"))["default"]["init"]>
>;

/**
 * Creates a {@link WalletAdapter} backed by LOBSTR via WalletConnect.
 * Lazily imports `@walletconnect/sign-client` on first connect to avoid
 * pulling it into a server-rendered bundle.
 * @param options - WalletConnect project configuration.
 * @returns A WalletAdapter that connects to LOBSTR over WalletConnect.
 */
export function createLobstrAdapter(options: LobstrAdapterOptions): WalletAdapter {
  const {
    projectId,
    appName = "Fund-My-Cause",
    appDescription = "Decentralized crowdfunding on Stellar",
    appUrl,
  } = options;

  let session: { topic: string } | null = null;
  let client: SignClientInstance | null = null;

  async function getClient(): Promise<SignClientInstance> {
    if (client) return client;
    const { default: SignClient } = await import("@walletconnect/sign-client");
    client = await SignClient.init({
      projectId,
      metadata: {
        name: appName,
        description: appDescription,
        url: appUrl ?? (typeof window !== "undefined" ? window.location.origin : ""),
        icons: [],
      },
    });
    return client;
  }

  return {
    name: "LOBSTR",

    async connect() {
      const signClient = await getClient();
      const { uri, approval } = await signClient.connect({
        requiredNamespaces: {
          [STELLAR_NAMESPACE]: {
            methods: ["stellar_signXDR"],
            chains: [STELLAR_CHAIN_TESTNET, STELLAR_CHAIN_MAINNET],
            events: [],
          },
        },
      });

      // Open WalletConnect URI — in a real app you'd show a QR code modal.
      if (uri && typeof window !== "undefined") {
        window.open(
          `${LOBSTR_WALLET_CONNECT_APP_URL}/wc?uri=${encodeURIComponent(uri)}`,
          "_blank",
        );
      }

      const approvedSession = await approval();
      session = approvedSession;

      const accounts = approvedSession.namespaces[STELLAR_NAMESPACE]?.accounts ?? [];
      if (!accounts.length) {
        throw new Error("No Stellar account returned by LOBSTR");
      }
      // Format: "stellar:testnet:GADDRESS..."
      const address = accounts[0]?.split(":")[2];
      if (!address) {
        throw new Error("Could not parse address from LOBSTR session");
      }
      return address;
    },

    async signTransaction(xdr, networkPassphrase) {
      if (!session) throw new Error("LOBSTR not connected");
      const signClient = await getClient();
      const chainId = networkPassphrase?.includes("Public")
        ? STELLAR_CHAIN_MAINNET
        : STELLAR_CHAIN_TESTNET;
      const result = await signClient.request<{ signedXDR: string }>({
        topic: session.topic,
        chainId,
        request: {
          method: "stellar_signXDR",
          params: { xdr },
        },
      });
      return result.signedXDR;
    },

    async disconnect() {
      if (!session || !client) return;
      await client.disconnect({
        topic: session.topic,
        reason: { code: 6000, message: "User disconnected" },
      });
      session = null;
    },
  };
}
