import { describe, it, expect, vi } from "vitest";
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatLocalDate,
  formatLocalTime,
  formatLocalDateTime,
  formatCompactNumber,
  formatRelativeTime,
  formatList,
  getCurrencySymbol,
} from "./locale-formatting";

// Fixed reference timestamp: 2026-06-27T00:00:00Z (unix seconds).
const FIXED_TS = 1782518400;

// US spring-forward 2026 (America/New_York): clocks jump 2:00am -> 3:00am on Mar 8.
const DST_SPRING_BEFORE = 1772951400; // 2026-03-08T06:30:00Z = 01:30 EST
const DST_SPRING_AFTER = 1772955000; // 2026-03-08T07:30:00Z = 03:30 EDT

// US fall-back 2026 (America/New_York): clocks repeat 1:00am-2:00am on Nov 1.
const DST_FALLBACK_BEFORE = 1793511000; // 2026-11-01T05:30:00Z = 01:30 EDT (first pass)
const DST_FALLBACK_AFTER = 1793514600; // 2026-11-01T06:30:00Z = 01:30 EST (second pass)

// Same instant, differing calendar date depending on timezone offset (no DST involved).
const OFFSET_BOUNDARY_TS = 1772949600; // 2026-03-08T06:00:00Z

describe("locale-formatting", () => {
  describe("formatCurrency", () => {
    it("should format USD in English", () => {
      const result = formatCurrency(1234.56, "USD", "en");
      expect(result).toContain("$");
      expect(result).toContain("1");
      expect(result).toContain(",");
    });

    it("should format EUR in German", () => {
      const result = formatCurrency(1234.56, "EUR", "de");
      expect(result).toContain("1.234");
    });

    it("should handle Arabic RTL locale", () => {
      const result = formatCurrency(1234.56, "USD", "ar");
      // Arabic should include directional marks
      expect(typeof result).toBe("string");
    });
  });

  describe("formatNumber", () => {
    it("should format number in English with thousands separator", () => {
      const result = formatNumber(1234567.89, "en");
      expect(result).toContain("1");
      expect(result).toContain(",");
    });

    it("should format number in German with German separators", () => {
      const result = formatNumber(1234567.89, "de");
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("formatPercentage", () => {
    it("should format percentage in English", () => {
      const result = formatPercentage(75, "en");
      expect(result).toContain("75");
    });

    it("should format percentage with fraction digits", () => {
      const result = formatPercentage(75.5, "en", 1);
      expect(typeof result).toBe("string");
    });
  });

  describe("formatLocalDate", () => {
    it("should format date in English locale", () => {
      const date = new Date("2026-06-27");
      const result = formatLocalDate(date, "en");
      expect(result).toContain("June") || expect(result).toContain("Jun");
    });

    it("should format date in Spanish locale", () => {
      const date = new Date("2026-06-27");
      const result = formatLocalDate(date, "es");
      expect(typeof result).toBe("string");
    });

    describe("locale coverage (fixed reference timestamp, UTC)", () => {
      it("formats in English (en-US) as M/D/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "en", { timeZone: "UTC" })).toBe(
          "6/27/2026",
        );
      });

      it("formats in Spanish (es-ES) as D/M/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "es", { timeZone: "UTC" })).toBe(
          "27/6/2026",
        );
      });

      it("formats in French (fr-FR) as DD/MM/YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "fr", { timeZone: "UTC" })).toBe(
          "27/06/2026",
        );
      });

      it("formats in German (de-DE) as D.M.YYYY", () => {
        expect(formatLocalDate(FIXED_TS, "de", { timeZone: "UTC" })).toBe(
          "27.6.2026",
        );
      });
    });

    describe("DST-boundary and UTC-vs-local-offset edge cases (fixed reference timestamps)", () => {
      it("formats the correct calendar date just before the US spring-forward jump (America/New_York)", () => {
        expect(
          formatLocalDate(DST_SPRING_BEFORE, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("3/8/2026");
      });

      it("formats the correct calendar date just after the US spring-forward jump (America/New_York)", () => {
        expect(
          formatLocalDate(DST_SPRING_AFTER, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("3/8/2026");
      });

      it("formats the correct calendar date across the US fall-back repeated hour (America/New_York)", () => {
        expect(
          formatLocalDate(DST_FALLBACK_BEFORE, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("11/1/2026");
        expect(
          formatLocalDate(DST_FALLBACK_AFTER, "en", {
            timeZone: "America/New_York",
          }),
        ).toBe("11/1/2026");
      });

      it("resolves to a different calendar date in UTC vs. a negative-offset timezone for the same instant", () => {
        expect(
          formatLocalDate(OFFSET_BOUNDARY_TS, "en", { timeZone: "UTC" }),
        ).toBe("3/8/2026");
        expect(
          formatLocalDate(OFFSET_BOUNDARY_TS, "en", {
            timeZone: "America/Los_Angeles",
          }),
        ).toBe("3/7/2026");
      });
    });

    describe("invalid input", () => {
      it("returns 'Invalid Date' instead of throwing for null", () => {
        expect(() =>
          formatLocalDate(null as unknown as number, "en"),
        ).not.toThrow();
        expect(formatLocalDate(null as unknown as number, "en")).toBe(
          "Invalid Date",
        );
      });

      it("returns 'Invalid Date' instead of throwing for undefined", () => {
        expect(() =>
          formatLocalDate(undefined as unknown as number, "en"),
        ).not.toThrow();
        expect(formatLocalDate(undefined as unknown as number, "en")).toBe(
          "Invalid Date",
        );
      });

      it("returns 'Invalid Date' instead of throwing for a malformed date string", () => {
        expect(() =>
          formatLocalDate("not-a-date" as unknown as number, "en"),
        ).not.toThrow();
        expect(formatLocalDate("not-a-date" as unknown as number, "en")).toBe(
          "Invalid Date",
        );
      });

      it("returns 'Invalid Date' for a NaN numeric timestamp", () => {
        expect(formatLocalDate(NaN, "en")).toBe("Invalid Date");
      });
    });
  });

  describe("formatLocalTime", () => {
    it("returns 'Invalid Date' instead of throwing for null/undefined/malformed input", () => {
      expect(formatLocalTime(null as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatLocalTime(undefined as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatLocalTime("not-a-date" as unknown as number, "en")).toBe(
        "Invalid Date",
      );
    });

    it("formats a fixed timestamp consistently under an explicit timezone", () => {
      expect(
        formatLocalTime(DST_SPRING_BEFORE, "en", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }),
      ).toBe("1:30 AM");
    });
  });

  describe("formatLocalDateTime", () => {
    it("returns 'Invalid Date' instead of throwing for null/undefined/malformed input", () => {
      expect(formatLocalDateTime(null as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatLocalDateTime(undefined as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatLocalDateTime("not-a-date" as unknown as number, "en")).toBe(
        "Invalid Date",
      );
    });

    it("reflects the spring-forward jump across the DST boundary (America/New_York)", () => {
      expect(
        formatLocalDateTime(DST_SPRING_BEFORE, "en", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }),
      ).toContain("1:30 AM");
      expect(
        formatLocalDateTime(DST_SPRING_AFTER, "en", {
          timeZone: "America/New_York",
          hour: "numeric",
          minute: "2-digit",
        }),
      ).toContain("3:30 AM");
    });
  });

  describe("formatCompactNumber", () => {
    it("should format large number in compact form", () => {
      const result = formatCompactNumber(1500000, "en");
      expect(result).toMatch(/[KM]/);
    });

    it("should format in German compact form", () => {
      const result = formatCompactNumber(1500000, "de");
      expect(typeof result).toBe("string");
    });
  });

  describe("formatRelativeTime", () => {
    it("should format relative time", () => {
      const yesterday = new Date(Date.now() - 86400000);
      const result = formatRelativeTime(yesterday, "en");
      expect(typeof result).toBe("string");
    });

    it("formats a fixed 2-day-old reference timestamp deterministically", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(FIXED_TS * 1000));
      const twoDaysBefore = FIXED_TS - 2 * 86400;
      expect(formatRelativeTime(twoDaysBefore, "en")).toBe("2 days ago");
      vi.useRealTimers();
    });

    it("returns 'Invalid Date' instead of throwing for null/undefined/malformed input", () => {
      expect(formatRelativeTime(null as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatRelativeTime(undefined as unknown as number, "en")).toBe(
        "Invalid Date",
      );
      expect(formatRelativeTime("not-a-date" as unknown as number, "en")).toBe(
        "Invalid Date",
      );
    });
  });

  describe("formatList", () => {
    it("should format list in English", () => {
      const result = formatList(["apple", "banana", "orange"], "en");
      expect(result).toContain("apple");
      expect(result).toContain("and");
    });

    it("should format list in Spanish", () => {
      const result = formatList(["apple", "banana", "orange"], "es");
      expect(typeof result).toBe("string");
    });
  });

  describe("getCurrencySymbol", () => {
    it("should get USD symbol for English", () => {
      const symbol = getCurrencySymbol("USD", "en");
      expect(symbol).toBe("$");
    });

    it("should get EUR symbol for German", () => {
      const symbol = getCurrencySymbol("EUR", "de");
      expect(typeof symbol).toBe("string");
    });
  });
});
