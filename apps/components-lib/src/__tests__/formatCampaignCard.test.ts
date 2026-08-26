import { describe, it, expect } from "vitest";
import { formatCampaignCard } from "../utils/formatCampaignCard";

describe("formatCampaignCard", () => {
  describe("progress and funded state", () => {
    it("computes percent and displayPercent for a partially-funded campaign", () => {
      const result = formatCampaignCard({ raised: 25, goal: 100 });
      expect(result.percent).toBe(25);
      expect(result.displayPercent).toBe(25);
      expect(result.isFunded).toBe(false);
    });

    it("reports isFunded once the goal is reached", () => {
      const result = formatCampaignCard({ raised: 100, goal: 100 });
      expect(result.isFunded).toBe(true);
    });

    it("does not clamp percent for an over-funded campaign, but clamps displayPercent", () => {
      const result = formatCampaignCard({ raised: 150, goal: 100 });
      expect(result.percent).toBe(150);
      expect(result.displayPercent).toBe(100);
      expect(result.isFunded).toBe(true);
    });

    it("returns 0% for a zero or negative goal", () => {
      expect(formatCampaignCard({ raised: 10, goal: 0 }).percent).toBe(0);
      expect(formatCampaignCard({ raised: 10, goal: -5 }).percent).toBe(0);
    });
  });

  describe("ended state", () => {
    const now = 1_700_000_000_000;

    it("is not ended when the deadline is in the future", () => {
      const result = formatCampaignCard(
        { raised: 10, goal: 100, deadline: now + 86_400_000 },
        { now },
      );
      expect(result.isEnded).toBe(false);
    });

    it("is ended once the deadline has passed and the goal is unmet", () => {
      const result = formatCampaignCard(
        { raised: 10, goal: 100, deadline: now - 86_400_000 },
        { now },
      );
      expect(result.isEnded).toBe(true);
    });

    it("funded takes precedence — a funded campaign is never ended", () => {
      const result = formatCampaignCard(
        { raised: 100, goal: 100, deadline: now - 86_400_000 },
        { now },
      );
      expect(result.isFunded).toBe(true);
      expect(result.isEnded).toBe(false);
    });

    it("treats a missing deadline as never-ending", () => {
      const result = formatCampaignCard({ raised: 10, goal: 100 }, { now });
      expect(result.isEnded).toBe(false);
    });

    it("treats an unparsable deadline as never-ending rather than throwing", () => {
      const result = formatCampaignCard(
        { raised: 10, goal: 100, deadline: "not-a-date" },
        { now },
      );
      expect(result.isEnded).toBe(false);
    });
  });

  describe("amount formatting", () => {
    it("uses locale-aware number formatting by default", () => {
      const result = formatCampaignCard({ raised: 15400, goal: 24000 });
      expect(result.raisedText).toBe(
        (15400).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      );
      expect(result.goalText).toBe(
        (24000).toLocaleString(undefined, { maximumFractionDigits: 2 }),
      );
    });

    it("appends the raised/goal labels when provided", () => {
      const result = formatCampaignCard(
        { raised: 15400, goal: 24000 },
        { raisedLabel: "raised", goalLabel: "goal" },
      );
      expect(result.raisedText).toBe(
        `${(15400).toLocaleString(undefined, { maximumFractionDigits: 2 })} raised`,
      );
      expect(result.goalText).toBe(
        `${(24000).toLocaleString(undefined, { maximumFractionDigits: 2 })} goal`,
      );
    });

    it("delegates to a custom formatAmount (e.g. XLM-with-USD, or a compact currency notation)", () => {
      const result = formatCampaignCard(
        { raised: 1_500_000, goal: 2_000_000 },
        {
          formatAmount: (n) =>
            n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M XLM` : `${n} XLM`,
        },
      );
      expect(result.raisedText).toBe("1.5M XLM");
      expect(result.goalText).toBe("2.0M XLM");
    });

    it("handles a zero raised amount without throwing", () => {
      const result = formatCampaignCard({ raised: 0, goal: 100 });
      expect(result.raisedText).toBe((0).toLocaleString());
      expect(result.isFunded).toBe(false);
    });
  });
});
