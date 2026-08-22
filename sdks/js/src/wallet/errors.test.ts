import { classifySignError, isNetworkMatch } from "./errors";

describe("classifySignError", () => {
  it.each([
    "User declined the request",
    "Request rejected by user",
    "Transaction cancelled",
    "Access denied",
  ])("classifies %p as cancelled", (message) => {
    expect(classifySignError(new Error(message))).toBe("cancelled");
  });

  it("matches case-insensitively", () => {
    expect(classifySignError(new Error("USER DECLINED"))).toBe("cancelled");
  });

  it.each([
    "network error",
    "failed to fetch",
    "request timeout",
    "connection reset",
  ])("classifies %p as network", (message) => {
    expect(classifySignError(new Error(message))).toBe("network");
  });

  it("prefers cancelled over network when a message matches both", () => {
    expect(classifySignError(new Error("user rejected: network unreachable"))).toBe(
      "cancelled",
    );
  });

  it("classifies an unrecognised message as unknown", () => {
    expect(classifySignError(new Error("XDR is malformed"))).toBe("unknown");
  });

  it.each([["a string", "declined"], ["null", null], ["undefined", undefined], ["an object", { message: "declined" }]])(
    "classifies %s (a non-Error) as unknown",
    (_label, thrown) => {
      expect(classifySignError(thrown)).toBe("unknown");
    },
  );

  it("classifies an Error with an empty message as unknown", () => {
    expect(classifySignError(new Error(""))).toBe("unknown");
  });
});

describe("isNetworkMatch", () => {
  const TESTNET = "Test SDF Network ; September 2015";
  const MAINNET = "Public Global Stellar Network ; September 2015";

  it("returns true for identical passphrases", () => {
    expect(isNetworkMatch(TESTNET, TESTNET)).toBe(true);
  });

  it("returns false when the wallet is on a different network", () => {
    expect(isNetworkMatch(TESTNET, MAINNET)).toBe(false);
  });

  it("is exact — whitespace differences do not match", () => {
    expect(isNetworkMatch(TESTNET, TESTNET.replace(" ; ", ";"))).toBe(false);
  });

  it("treats two empty passphrases as matching", () => {
    expect(isNetworkMatch("", "")).toBe(true);
  });
});
