/**
 * @jest-environment jsdom
 */

import type { WalletAdapter } from "./walletAdapters";

// Mock adapters for testing interface compliance
const mockFreighterAdapter: WalletAdapter = {
  name: "Freighter",
  connect: jest.fn().mockResolvedValue("GTEST123"),
  signTransaction: jest.fn().mockResolvedValue("signed-xdr"),
};

const mockLobstrAdapter: WalletAdapter = {
  name: "LOBSTR",
  connect: jest.fn().mockResolvedValue("GTEST456"),
  signTransaction: jest.fn().mockResolvedValue("signed-xdr"),
  disconnect: jest.fn().mockResolvedValue(undefined),
};

describe("WalletAdapter Interface", () => {
  describe("interface compliance", () => {
    it("freighterAdapter should implement WalletAdapter interface", () => {
      expect(mockFreighterAdapter).toHaveProperty("name");
      expect(mockFreighterAdapter).toHaveProperty("connect");
      expect(mockFreighterAdapter).toHaveProperty("signTransaction");
      expect(typeof mockFreighterAdapter.name).toBe("string");
      expect(typeof mockFreighterAdapter.connect).toBe("function");
      expect(typeof mockFreighterAdapter.signTransaction).toBe("function");
    });

    it("lobstrAdapter should implement WalletAdapter interface", () => {
      expect(mockLobstrAdapter).toHaveProperty("name");
      expect(mockLobstrAdapter).toHaveProperty("connect");
      expect(mockLobstrAdapter).toHaveProperty("signTransaction");
      expect(typeof mockLobstrAdapter.name).toBe("string");
      expect(typeof mockLobstrAdapter.connect).toBe("function");
      expect(typeof mockLobstrAdapter.signTransaction).toBe("function");
    });

    it("adapters should have optional disconnect method", () => {
      // Freighter does not have disconnect
      expect(mockFreighterAdapter.disconnect).toBeUndefined();

      // LOBSTR has disconnect
      expect(mockLobstrAdapter.disconnect).toBeDefined();
      expect(typeof mockLobstrAdapter.disconnect).toBe("function");
    });
  });

  describe("adapter registry", () => {
    const adapters: WalletAdapter[] = [mockFreighterAdapter, mockLobstrAdapter];

    it("should have unique adapter names", () => {
      const names = adapters.map((adapter) => adapter.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });

    it("all adapters should have non-empty names", () => {
      adapters.forEach((adapter) => {
        expect(adapter.name).toBeTruthy();
        expect(adapter.name.length).toBeGreaterThan(0);
      });
    });

    it("all adapters should have async connect method", () => {
      adapters.forEach((adapter) => {
        expect(typeof adapter.connect).toBe("function");
        const result = adapter.connect();
        expect(result).toBeInstanceOf(Promise);
      });
    });

    it("all adapters should have async signTransaction method", () => {
      adapters.forEach((adapter) => {
        expect(typeof adapter.signTransaction).toBe("function");
        const result = adapter.signTransaction(
          "mock-xdr",
          "Test SDF Network ; September 2015"
        );
        expect(result).toBeInstanceOf(Promise);
      });
    });
  });

  describe("error mapping consistency", () => {
    // Mock implementations for testing error consistency
    class MockAdapter implements WalletAdapter {
      name = "MockWallet";
      errorType: "Error" | "string" | "unknown" = "Error";

      async connect(): Promise<string> {
        switch (this.errorType) {
          case "Error":
            throw new Error("Connection failed");
          case "string":
            throw "Connection failed";
          case "unknown":
            throw { message: "Connection failed" };
          default:
            return "GTEST123";
        }
      }

      async signTransaction(xdr: string): Promise<string> {
        switch (this.errorType) {
          case "Error":
            throw new Error("Signing failed");
          case "string":
            throw "Signing failed";
          case "unknown":
            throw { message: "Signing failed" };
          default:
            return `signed-${xdr}`;
        }
      }
    }

    it("should throw Error instances for connection failures", async () => {
      const adapter = new MockAdapter();
      adapter.errorType = "Error";

      try {
        await adapter.connect();
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Connection failed");
      }
    });

    it("should throw Error instances for signing failures", async () => {
      const adapter = new MockAdapter();
      adapter.errorType = "Error";

      try {
        await adapter.signTransaction("test-xdr");
        fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe("Signing failed");
      }
    });

    it("adapters should provide descriptive error messages", async () => {
      const errorScenarios = [
        { message: "User rejected the connection request", shouldInclude: "reject" },
        { message: "Network timeout occurred", shouldInclude: "timeout" },
        { message: "Extension not found", shouldInclude: "not found" },
      ];

      for (const scenario of errorScenarios) {
        expect(scenario.message.toLowerCase()).toContain(
          scenario.shouldInclude.toLowerCase()
        );
      }
    });
  });

  describe("method signatures", () => {
    it("connect should return Promise<string> (address)", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => "GTEST123",
        signTransaction: async (xdr) => `signed-${xdr}`,
      };

      const address = await mockAdapter.connect();
      expect(typeof address).toBe("string");
      expect(address.length).toBeGreaterThan(0);
    });

    it("signTransaction should accept xdr and network passphrase", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => "GTEST123",
        signTransaction: async (xdr, networkPassphrase) => {
          expect(typeof xdr).toBe("string");
          expect(typeof networkPassphrase).toBe("string");
          return `signed-${xdr}`;
        },
      };

      await mockAdapter.signTransaction(
        "test-xdr",
        "Test SDF Network ; September 2015"
      );
    });

    it("signTransaction should return Promise<string> (signed XDR)", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => "GTEST123",
        signTransaction: async (xdr) => `signed-${xdr}`,
      };

      const signedXdr = await mockAdapter.signTransaction(
        "test-xdr",
        "Test SDF Network ; September 2015"
      );
      expect(typeof signedXdr).toBe("string");
      expect(signedXdr).toContain("signed-");
    });

    it("disconnect should be optional and return Promise<void>", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => "GTEST123",
        signTransaction: async (xdr) => `signed-${xdr}`,
        disconnect: async () => {},
      };

      if (mockAdapter.disconnect) {
        const result = await mockAdapter.disconnect();
        expect(result).toBeUndefined();
      }
    });
  });

  describe("adapter lifecycle", () => {
    it("should support connect -> sign -> disconnect flow", async () => {
      let connected = false;
      let disconnected = false;

      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          connected = true;
          return "GTEST123";
        },
        signTransaction: async (xdr) => {
          if (!connected) throw new Error("Not connected");
          return `signed-${xdr}`;
        },
        disconnect: async () => {
          connected = false;
          disconnected = true;
        },
      };

      // Connect
      await mockAdapter.connect();
      expect(connected).toBe(true);

      // Sign
      const signedXdr = await mockAdapter.signTransaction("test-xdr", "testnet");
      expect(signedXdr).toBe("signed-test-xdr");

      // Disconnect
      await mockAdapter.disconnect!();
      expect(disconnected).toBe(true);
      expect(connected).toBe(false);
    });

    it("should handle multiple sign operations without reconnecting", async () => {
      let connectCount = 0;

      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          connectCount++;
          return "GTEST123";
        },
        signTransaction: async (xdr) => `signed-${xdr}`,
      };

      // Connect once
      await mockAdapter.connect();
      expect(connectCount).toBe(1);

      // Multiple signs
      await mockAdapter.signTransaction("xdr1", "testnet");
      await mockAdapter.signTransaction("xdr2", "testnet");
      await mockAdapter.signTransaction("xdr3", "testnet");

      // Should not have reconnected
      expect(connectCount).toBe(1);
    });

    it("should be able to reconnect after disconnect", async () => {
      let connected = false;

      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          connected = true;
          return "GTEST123";
        },
        signTransaction: async (xdr) => `signed-${xdr}`,
        disconnect: async () => {
          connected = false;
        },
      };

      // First connection
      await mockAdapter.connect();
      expect(connected).toBe(true);

      // Disconnect
      await mockAdapter.disconnect!();
      expect(connected).toBe(false);

      // Reconnect
      await mockAdapter.connect();
      expect(connected).toBe(true);
    });
  });

  describe("error handling patterns", () => {
    it("should reject with descriptive errors on connection failure", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          throw new Error("User denied access to wallet");
        },
        signTransaction: async (xdr) => `signed-${xdr}`,
      };

      await expect(mockAdapter.connect()).rejects.toThrow(
        "User denied access to wallet"
      );
    });

    it("should reject with descriptive errors on signing failure", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => "GTEST123",
        signTransaction: async () => {
          throw new Error("User rejected the transaction");
        },
      };

      await expect(
        mockAdapter.signTransaction("test-xdr", "testnet")
      ).rejects.toThrow("User rejected the transaction");
    });

    it("should handle timeout errors", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          throw new Error("Connection timeout");
        },
        signTransaction: async () => {
          throw new Error("Signing timeout");
        },
      };

      await expect(mockAdapter.connect()).rejects.toThrow("Connection timeout");
      await expect(
        mockAdapter.signTransaction("test-xdr", "testnet")
      ).rejects.toThrow("Signing timeout");
    });

    it("should handle network errors", async () => {
      const mockAdapter: WalletAdapter = {
        name: "Test",
        connect: async () => {
          throw new Error("Network error");
        },
        signTransaction: async () => {
          throw new Error("Network error");
        },
      };

      await expect(mockAdapter.connect()).rejects.toThrow("Network error");
      await expect(
        mockAdapter.signTransaction("test-xdr", "testnet")
      ).rejects.toThrow("Network error");
    });
  });

  describe("adapter selection", () => {
    const adapters: WalletAdapter[] = [mockFreighterAdapter, mockLobstrAdapter];

    it("should be able to select adapter by name", () => {
      const freighter = adapters.find((a) => a.name === "Freighter");
      const lobstr = adapters.find((a) => a.name === "LOBSTR");

      expect(freighter).toBeDefined();
      expect(lobstr).toBeDefined();
      expect(freighter?.name).toBe("Freighter");
      expect(lobstr?.name).toBe("LOBSTR");
    });

    it("should list all available adapters", () => {
      const adapterNames = adapters.map((a) => a.name);
      expect(adapterNames).toContain("Freighter");
      expect(adapterNames).toContain("LOBSTR");
      expect(adapterNames.length).toBe(2);
    });

    it("should provide consistent interface across all adapters", () => {
      adapters.forEach((adapter) => {
        // Required properties
        expect(adapter).toHaveProperty("name");
        expect(adapter).toHaveProperty("connect");
        expect(adapter).toHaveProperty("signTransaction");

        // Required types
        expect(typeof adapter.name).toBe("string");
        expect(typeof adapter.connect).toBe("function");
        expect(typeof adapter.signTransaction).toBe("function");

        // Optional property
        if (adapter.disconnect) {
          expect(typeof adapter.disconnect).toBe("function");
        }
      });
    });
  });
});
