import {
  CONTRACT_ERROR_CODES,
  getErrorMessage,
  parseContractError,
} from "./contractErrorMessages";

describe("contractErrorMessages", () => {
  describe("CONTRACT_ERROR_CODES", () => {
    it("should map common error codes", () => {
      expect(CONTRACT_ERROR_CODES[2]).toContain("deadline");
      expect(CONTRACT_ERROR_CODES[9]).toContain("minimum");
      expect(CONTRACT_ERROR_CODES[32]).toContain("Insufficient funds");
      expect(CONTRACT_ERROR_CODES[33]).toContain("not authorized");
    });

    it("should have all defined error codes", () => {
      const maxCode = Math.max(
        ...Object.keys(CONTRACT_ERROR_CODES).map(Number),
      );
      expect(maxCode).toBeGreaterThan(0);
    });
  });

  describe("getErrorMessage", () => {
    it("should return mapped message for known error code", () => {
      const message = getErrorMessage(2);
      expect(message).toBe("Campaign deadline has passed");
    });

    it("should handle string error codes", () => {
      const message = getErrorMessage("32");
      expect(message).toContain("Insufficient");
    });

    it("should return generic message for unknown error code", () => {
      const message = getErrorMessage(9999);
      expect(message).toContain("unexpected error");
      expect(message).toContain("9999");
    });

    it("should handle all defined error codes", () => {
      for (const code of Object.keys(CONTRACT_ERROR_CODES)) {
        const message = getErrorMessage(Number(code));
        expect(message).toBeDefined();
        expect(message.length).toBeGreaterThan(0);
        expect(message).not.toContain("undefined");
      }
    });

    describe("each explicitly mapped error code", () => {
      it.each(
        Object.entries(CONTRACT_ERROR_CODES).map(([code, expected]) => [
          Number(code),
          expected,
        ]),
      )("should map code %i to %p", (code, expected) => {
        expect(getErrorMessage(code)).toBe(expected);
      });
    });
  });

  describe("parseContractError", () => {
    it("should parse error string with code pattern", () => {
      const result = parseContractError("Contract error: code 32");
      expect(result.code).toBe(32);
      expect(result.message).toContain("Insufficient");
    });

    it("should parse error with different code pattern", () => {
      const result = parseContractError("error code: 9");
      expect(result.code).toBe(9);
      expect(result.message).toContain("minimum");
    });

    it("should handle Error object with code", () => {
      const error = new Error("Soroban error: code 11");
      const result = parseContractError(error);
      expect(result.code).toBe(11);
      expect(result.message).toContain("paused");
    });

    it("should handle Error object without code", () => {
      const error = new Error("Network timeout");
      const result = parseContractError(error);
      expect(result.code).toBeNull();
      expect(result.message).toBe("Network timeout");
    });

    it("should handle string without code pattern", () => {
      const result = parseContractError("Something went wrong");
      expect(result.code).toBeNull();
      expect(result.message).toBe("Something went wrong");
    });

    it("should handle unknown error types gracefully", () => {
      const result = parseContractError(null);
      expect(result.code).toBeNull();
      expect(result.message).toContain("unexpected error");
    });

    it("should map known error code to user-facing message", () => {
      const result = parseContractError("error: code 2");
      expect(result.message).toBe("Campaign deadline has passed");
    });

    it("should provide generic message for unknown code", () => {
      const result = parseContractError("error: code 9999");
      expect(result.message).toContain("unexpected error");
      expect(result.message).toContain("9999");
    });
  });
});
