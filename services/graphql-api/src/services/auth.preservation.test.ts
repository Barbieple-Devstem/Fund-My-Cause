import { describe, it, expect } from "vitest";
import { AuthService } from "./auth.js";
import jwt from "jsonwebtoken";

/**
 * Preservation Property Tests for JWT_SECRET Hardcoded Fallback Bugfix
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 * 
 * IMPORTANT: These tests run on UNFIXED code to observe baseline behavior.
 * They verify that valid JWT_SECRET values (32+ chars, not defaults) work correctly.
 * 
 * Property 2: Preservation - Normal Operation with Valid JWT_SECRET
 * For any application startup where JWT_SECRET is set to a string of 32 or more
 * characters that is not in the known defaults list, the fixed application SHALL
 * start normally and produce the same JWT generation and verification behavior
 * as the original code.
 * 
 * EXPECTED OUTCOME: All tests PASS on unfixed code (baseline behavior to preserve)
 */
describe("Preservation Property: Normal Operation with Valid JWT_SECRET", () => {
  const KNOWN_DEFAULTS = [
    "your-secret-key",
    "your-secret-key-change-in-production",
    "dev-secret-key-change-in-production",
  ];

  /**
   * Generate valid JWT_SECRET test cases
   * Valid = 32+ characters AND not in known defaults
   */
  const generateValidSecrets = (): string[] => {
    return [
      // Exactly 32 characters (boundary case)
      "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      // More than 32 characters
      "very-long-secret-key-for-testing-purposes-12345678",
      // 64 characters (common for production secrets)
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      // With special characters
      "my-$ecret-K3y!@#$%^&*()-_+={}[]|:;<>?,./~`",
      // 100 characters
      "a".repeat(100),
      // Mixed case and numbers
      "Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6",
    ];
  };

  describe("Property: Service starts normally with valid JWT_SECRET", () => {
    it("should successfully instantiate AuthService with 32+ char secrets not in defaults", () => {
      const validSecrets = generateValidSecrets();

      for (const secret of validSecrets) {
        // Verify the secret meets our criteria
        expect(secret.length).toBeGreaterThanOrEqual(32);
        expect(KNOWN_DEFAULTS).not.toContain(secret);

        // OBSERVE: Service starts successfully with valid secret
        expect(() => {
          const authService = new AuthService(secret);
          expect(authService).toBeDefined();
        }).not.toThrow();
      }
    });
  });

  describe("Property: Token generation produces valid JWTs with address and iat claims", () => {
    it("should generate tokens with address and iat claims for all valid secrets", () => {
      const validSecrets = generateValidSecrets();
      const testAddress = "GADDRESS123TEST";

      for (const secret of validSecrets) {
        const authService = new AuthService(secret);

        // OBSERVE: generateToken produces a valid JWT
        const token = authService.generateToken(testAddress);
        expect(token).toBeDefined();
        expect(typeof token).toBe("string");
        expect(token.split(".").length).toBe(3); // JWT format: header.payload.signature

        // OBSERVE: Token contains address claim and iat claim
        const decoded = jwt.decode(token) as any;
        expect(decoded).not.toBeNull();
        expect(decoded.address).toBe(testAddress);
        expect(decoded.iat).toBeDefined();
        expect(typeof decoded.iat).toBe("number");
      }
    });
  });

  describe("Property: Token verification succeeds with correct signature", () => {
    it("should successfully verify tokens generated with the same secret", () => {
      const validSecrets = generateValidSecrets();
      const testAddress = "GADDRESS456TEST";

      for (const secret of validSecrets) {
        const authService = new AuthService(secret);

        // OBSERVE: Token generation and verification round-trip works
        const token = authService.generateToken(testAddress);
        const verified = authService.verifyToken(token);

        // OBSERVE: Verification succeeds and returns correct data
        expect(verified).not.toBeNull();
        expect(verified?.address).toBe(testAddress);
        expect(typeof verified?.iat).toBe("number");
      }
    });

    it("should reject tokens when verified with a different secret", () => {
      const secret1 = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
      const secret2 = "z9y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4";
      
      const authService1 = new AuthService(secret1);
      const authService2 = new AuthService(secret2);

      const token = authService1.generateToken("GADDRESS789TEST");

      // OBSERVE: Token verification fails with wrong secret
      const verifiedWithWrongSecret = authService2.verifyToken(token);
      expect(verifiedWithWrongSecret).toBeNull();
    });
  });

  describe("Property: Tokens use HS256 algorithm", () => {
    it("should use HS256 algorithm for all valid secrets", () => {
      const validSecrets = generateValidSecrets();
      const testAddress = "GADDRESSHS256TEST";

      for (const secret of validSecrets) {
        const authService = new AuthService(secret);
        const token = authService.generateToken(testAddress);

        // OBSERVE: Token uses HS256 algorithm
        const decoded = jwt.decode(token, { complete: true }) as any;
        expect(decoded).not.toBeNull();
        expect(decoded.header.alg).toBe("HS256");

        // OBSERVE: Token can be verified using HS256 algorithm
        const verified = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
        expect(verified.address).toBe(testAddress);
      }
    });
  });

  describe("Property: Token expiry logic works correctly", () => {
    it("should respect token expiry settings for all valid secrets", () => {
      const secret = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
      const authService = new AuthService(secret, "24h");
      
      const token = authService.generateToken("GADDRESSEXPIRYTEST");
      const decoded = jwt.decode(token) as any;

      // OBSERVE: Token has exp claim
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe("number");

      // OBSERVE: isTokenExpired returns false for fresh token
      expect(authService.isTokenExpired(token)).toBe(false);

      // OBSERVE: getTokenExpiry returns valid Date
      const expiry = authService.getTokenExpiry(token);
      expect(expiry).not.toBeNull();
      expect(expiry).toBeInstanceOf(Date);
    });
  });

  describe("Property: Multiple addresses can be encoded", () => {
    it("should generate unique tokens for different addresses using the same secret", () => {
      const secret = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
      const authService = new AuthService(secret);

      const addresses = [
        "GADDRESS001",
        "GADDRESS002",
        "GADDRESS003",
        "STELLAR_ADDRESS_LONG_FORMAT_TEST",
        "A",
      ];

      const tokens = addresses.map(addr => authService.generateToken(addr));

      // OBSERVE: Each address produces a different token
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(addresses.length);

      // OBSERVE: Each token verifies back to its original address
      for (let i = 0; i < addresses.length; i++) {
        const verified = authService.verifyToken(tokens[i]);
        expect(verified?.address).toBe(addresses[i]);
      }
    });
  });

  describe("Property: Special characters in secrets are handled correctly", () => {
    it("should work with secrets containing various special characters", () => {
      const secretsWithSpecialChars = [
        "my-secret-key-with-dashes-32chars!",
        "my_secret_key_with_underscores_32",
        "my.secret.key.with.dots.32chars!",
        "my$secret@key#with%symbols&32chars",
        "my secret key with spaces 32chars!",
      ];

      const testAddress = "GADDRESSSPECIALTEST";

      for (const secret of secretsWithSpecialChars) {
        // OBSERVE: AuthService handles special characters in secrets
        const authService = new AuthService(secret);
        const token = authService.generateToken(testAddress);
        const verified = authService.verifyToken(token);

        expect(verified).not.toBeNull();
        expect(verified?.address).toBe(testAddress);
      }
    });
  });

  describe("Property: Long secrets work correctly", () => {
    it("should handle very long secrets (100+ characters)", () => {
      const longSecrets = [
        "a".repeat(100),
        "b".repeat(256),
        "c".repeat(500),
      ];

      const testAddress = "GADDRESSLONGTEST";

      for (const secret of longSecrets) {
        // OBSERVE: Long secrets work correctly
        const authService = new AuthService(secret);
        const token = authService.generateToken(testAddress);
        const verified = authService.verifyToken(token);

        expect(verified).not.toBeNull();
        expect(verified?.address).toBe(testAddress);
      }
    });
  });
});
