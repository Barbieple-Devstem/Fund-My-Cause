import { describe, it, expect } from "vitest";
import {
  calculateProgress,
  formatXlmWithUsd,
  getTimeRemaining,
  isCampaignEnded,
  isCampaignFunded,
} from "../campaign";

describe("calculateProgress", () => {
  it("returns the raised amount as a percentage of the goal", () => {
    expect(calculateProgress(5000, 10000)).toBe(50);
  });

  it("does not clamp over-funded campaigns", () => {
    expect(calculateProgress(15000, 10000)).toBe(150);
  });

  it("returns 0 for a zero or negative goal rather than dividing by zero", () => {
    expect(calculateProgress(500, 0)).toBe(0);
    expect(calculateProgress(500, -1)).toBe(0);
  });
});

describe("isCampaignFunded", () => {
  it("is true once the goal is reached exactly", () => {
    expect(isCampaignFunded(10000, 10000)).toBe(true);
  });

  it("is false below the goal", () => {
    expect(isCampaignFunded(9999, 10000)).toBe(false);
  });
});

describe("isCampaignEnded", () => {
  const now = Date.UTC(2026, 0, 10);

  it("is true once the deadline has passed without funding", () => {
    expect(isCampaignEnded("2026-01-01T00:00:00Z", 100, 10000, now)).toBe(true);
  });

  it("is false before the deadline", () => {
    expect(isCampaignEnded("2026-02-01T00:00:00Z", 100, 10000, now)).toBe(false);
  });

  it("is false for a funded campaign even after the deadline", () => {
    expect(isCampaignEnded("2026-01-01T00:00:00Z", 10000, 10000, now)).toBe(
      false,
    );
  });
});

describe("getTimeRemaining", () => {
  const now = Date.UTC(2026, 0, 1, 0, 0, 0);

  it("splits the remaining time into calendar units", () => {
    const deadline = Date.UTC(2026, 0, 3, 4, 5, 6);
    expect(getTimeRemaining(deadline, now)).toEqual({
      days: 2,
      hours: 4,
      minutes: 5,
      seconds: 6,
      total: deadline - now,
      expired: false,
    });
  });

  it("reports an expired deadline as all zeroes", () => {
    expect(getTimeRemaining(Date.UTC(2025, 11, 31), now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      total: 0,
      expired: true,
    });
  });
});

describe("formatXlmWithUsd", () => {
  it("appends a USD estimate when a price is available", () => {
    expect(formatXlmWithUsd(15400, 0.14)).toContain("XLM");
    expect(formatXlmWithUsd(15400, 0.14)).toContain("USD");
  });

  it("omits the USD estimate when the price feed is unavailable", () => {
    expect(formatXlmWithUsd(15400, null)).not.toContain("USD");
  });
});
