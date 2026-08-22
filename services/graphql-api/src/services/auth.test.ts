import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import jwt from "jsonwebtoken";
import { AuthService } from "./auth.js";

describe("AuthService", () => {
  // Use a valid 32+ character secret for testing
  const secret = "test-secret-key-32-chars-minimum!";
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(secret, "24h");
  });

  describe("generateToken / verifyToken round trip", () => {
    it("issues a token that verifies back to the same address", () => {
      const token = auth.generateToken("GADDRESS123");
      const decoded = auth.verifyToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded?.address).toBe("GADDRESS123");
      expect(typeof decoded?.iat).toBe("number");
    });

    it("signs with HS256 and the configured secret", () => {
      const token = auth.generateToken("GADDRESS123");
      const decodedWithRealSecret = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
      expect(decodedWithRealSecret.address).toBe("GADDRESS123");

      expect(() => jwt.verify(token, "wrong-secret", { algorithms: ["HS256"] })).toThrow();
    });

    it("rejects a token verified against a different secret", () => {
      const token = auth.generateToken("GADDRESS123");
      // Use another valid 32+ character secret
      const otherAuth = new AuthService("a-completely-different-secret-32c", "24h");

      expect(otherAuth.verifyToken(token)).toBeNull();
    });

    it("returns null for a malformed token instead of throwing", () => {
      expect(auth.verifyToken("not-a-real-token")).toBeNull();
    });

    it("rejects an expired token", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      // jwt expiry is second-granularity, so wait past the boundary.
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.verifyToken(token)).toBeNull();
          resolve();
        }, 1100);
      });
    });
  });

  describe("constructor validation", () => {
    it("throws error when JWT_SECRET is too short (less than 32 characters)", () => {
      expect(() => {
        new AuthService("short-secret");
      }).toThrow(/32 characters/);
    });

    it("throws error when JWT_SECRET is undefined", () => {
      expect(() => {
        new AuthService(undefined as any);
      }).toThrow(/JWT_SECRET/);
    });

    it("throws error when JWT_SECRET is empty", () => {
      expect(() => {
        new AuthService("");
      }).toThrow(/JWT_SECRET/);
    });

    it("accepts valid JWT_SECRET (32+ characters)", () => {
      expect(() => {
        new AuthService("valid-secret-32-characters-long!");
      }).not.toThrow();
    });
  });

  describe("extractTokenFromHeader", () => {
    it("extracts the token from a well-formed Bearer header", () => {
      expect(auth.extractTokenFromHeader("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    });

    it("returns null when the header is missing", () => {
      expect(auth.extractTokenFromHeader(undefined)).toBeNull();
    });

    it("returns null when the scheme is not Bearer", () => {
      expect(auth.extractTokenFromHeader("Basic abc.def.ghi")).toBeNull();
    });

    it("returns null when the header has the wrong number of parts", () => {
      expect(auth.extractTokenFromHeader("Bearer")).toBeNull();
      expect(auth.extractTokenFromHeader("Bearer a b")).toBeNull();
    });
  });

  describe("decodeToken", () => {
    it("decodes token payload without verifying the signature", () => {
      const token = auth.generateToken("GADDRESS123");
      // Use another valid 32+ character secret
      const otherAuth = new AuthService("different-secret-32-chars-minimum", "24h");
      const decoded = otherAuth.decodeToken(token);

      expect(decoded.address).toBe("GADDRESS123");
    });

    it("returns null for an undecodable token", () => {
      expect(auth.decodeToken("not-a-token")).toBeNull();
    });
  });

  describe("isTokenExpired", () => {
    it("returns false for a freshly issued token", () => {
      const token = auth.generateToken("GADDRESS123");
      expect(auth.isTokenExpired(token)).toBe(false);
    });

    it("returns true for a token whose exp has passed", () => {
      const shortLivedAuth = new AuthService(secret, "1ms");
      const token = shortLivedAuth.generateToken("GADDRESS123");

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(shortLivedAuth.isTokenExpired(token)).toBe(true);
          resolve();
        }, 1100);
      });
    });

    it("returns true for an undecodable token", () => {
      expect(auth.isTokenExpired("garbage")).toBe(true);
    });
  });

  describe("createSignatureMessage", () => {
    it("embeds the address and nonce in the message", () => {
      const message = auth.createSignatureMessage("GADDRESS123", "nonce-1");

      expect(message).toContain("GADDRESS123");
      expect(message).toContain("nonce-1");
      expect(message).toContain("Sign this message to authenticate with Fund My Cause");
    });
  });

  describe("getTokenExpiry", () => {
    it("returns a Date matching the token's exp claim", () => {
      const token = auth.generateToken("GADDRESS123");
      const decoded = jwt.decode(token) as any;

      const expiry = auth.getTokenExpiry(token);

      expect(expiry).not.toBeNull();
      expect(expiry?.getTime()).toBe(decoded.exp * 1000);
    });

    it("returns null for an undecodable token", () => {
      expect(auth.getTokenExpiry("garbage")).toBeNull();
    });
  });
});
