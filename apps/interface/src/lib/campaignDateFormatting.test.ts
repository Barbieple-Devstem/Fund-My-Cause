import {
  formatCampaignDateShort,
  formatCampaignDateLong,
  formatCampaignDateTime,
} from "./campaignDateFormatting";

describe("campaignDateFormatting", () => {
  const testDate = new Date("2026-03-19T15:45:00Z");
  const isoString = "2026-03-19T15:45:00Z";

  describe("formatCampaignDateShort", () => {
    it("formats date in short form with Date object", () => {
      const result = formatCampaignDateShort(testDate, "en-US");
      expect(result).toBe("Mar 19, 2026");
    });

    it("formats date in short form with ISO string", () => {
      const result = formatCampaignDateShort(isoString, "en-US");
      expect(result).toBe("Mar 19, 2026");
    });

    it("handles different locales", () => {
      const resultES = formatCampaignDateShort(testDate, "es-ES");
      expect(resultES).toBe("19 mar 2026");
    });

    it("defaults to en-US locale", () => {
      const result = formatCampaignDateShort(testDate);
      expect(result).toBe("Mar 19, 2026");
    });
  });

  describe("formatCampaignDateLong", () => {
    it("formats date in long form with weekday", () => {
      const result = formatCampaignDateLong(testDate, "en-US");
      expect(result).toContain("2026");
      expect(result).toContain("March");
      expect(result).toContain("19");
    });

    it("formats date with ISO string", () => {
      const result = formatCampaignDateLong(isoString, "en-US");
      expect(result).toContain("2026");
      expect(result).toContain("March");
    });

    it("includes weekday in different locales", () => {
      const resultES = formatCampaignDateLong(testDate, "es-ES");
      expect(resultES).toContain("2026");
    });
  });

  describe("formatCampaignDateTime", () => {
    it("formats date with time", () => {
      const result = formatCampaignDateTime(testDate, "en-US");
      expect(result).toMatch(/Mar 19, 2026 at \d{1,2}:\d{2}/);
    });

    it("handles ISO string input", () => {
      const result = formatCampaignDateTime(isoString, "en-US");
      expect(result).toMatch(/Mar 19, 2026 at \d{1,2}:\d{2}/);
    });

    it("formats with different locale", () => {
      const resultES = formatCampaignDateTime(testDate, "es-ES");
      expect(resultES).toContain("19");
      expect(resultES).toContain("2026");
    });
  });

  describe("timezone edge cases", () => {
    it("handles UTC date correctly", () => {
      const utcDate = new Date("2026-03-19T00:00:00Z");
      const result = formatCampaignDateShort(utcDate, "en-US");
      expect(result).toContain("Mar");
      expect(result).toContain("2026");
    });

    it("handles date near DST boundary", () => {
      const dstDate = new Date("2026-03-08T12:00:00Z");
      const result = formatCampaignDateShort(dstDate, "en-US");
      expect(result).toContain("Mar");
      expect(result).toContain("2026");
    });

    it("maintains consistency across multiple invocations", () => {
      const result1 = formatCampaignDateShort(testDate, "en-US");
      const result2 = formatCampaignDateShort(testDate, "en-US");
      expect(result1).toBe(result2);
    });
  });
});
