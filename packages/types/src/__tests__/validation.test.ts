import { describe, it, expect } from "vitest";
import {
  validateCampaignTitle,
  validateCampaignDescription,
  validateCampaignGoal,
  validateCampaignDeadline,
  validateMinContribution,
  validateMaxContribution,
  validateFeeBps,
  validateDonationAmount,
  validateCampaignInput,
  validateDonationInput,
  XLM_TO_STROOPS,
} from "../validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a ISO string that is `hours` hours from now. */
function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/** Returns a ISO string that is `days` days from now. */
function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// validateCampaignTitle
// ---------------------------------------------------------------------------

describe("validateCampaignTitle", () => {
  it("accepts a valid title", () => {
    expect(validateCampaignTitle("Save the rainforest")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateCampaignTitle("")).not.toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    expect(validateCampaignTitle("   ")).not.toBeNull();
  });

  it("rejects a title longer than 100 characters", () => {
    const longTitle = "a".repeat(101);
    expect(validateCampaignTitle(longTitle)).not.toBeNull();
  });

  it("accepts a title exactly 100 characters long", () => {
    const maxTitle = "a".repeat(100);
    expect(validateCampaignTitle(maxTitle)).toBeNull();
  });

  it("strips HTML tags before checking length — a title with HTML that is <=100 chars after stripping is valid", () => {
    // <b>abc</b> → "abc" (3 chars after stripping) — valid
    expect(validateCampaignTitle("<b>abc</b>")).toBeNull();
  });

  it("strips HTML before checking length — tags are not counted toward the limit", () => {
    // 100 'a' chars inside tags: stripped length = 100 → valid
    const withHtml = `<b>${"a".repeat(100)}</b>`;
    expect(validateCampaignTitle(withHtml)).toBeNull();
  });

  it("rejects a title whose stripped text exceeds 100 characters", () => {
    const withHtml = `<b>${"a".repeat(101)}</b>`;
    expect(validateCampaignTitle(withHtml)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateCampaignDescription
// ---------------------------------------------------------------------------

describe("validateCampaignDescription", () => {
  it("accepts a valid description", () => {
    expect(validateCampaignDescription("A meaningful campaign for a great cause.")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateCampaignDescription("")).not.toBeNull();
  });

  it("rejects a whitespace-only string", () => {
    expect(validateCampaignDescription("   ")).not.toBeNull();
  });

  it("rejects a description longer than 1000 characters", () => {
    expect(validateCampaignDescription("a".repeat(1001))).not.toBeNull();
  });

  it("accepts a description exactly 1000 characters long", () => {
    expect(validateCampaignDescription("a".repeat(1000))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateCampaignGoal
// ---------------------------------------------------------------------------

describe("validateCampaignGoal", () => {
  it("accepts a positive goal", () => {
    expect(validateCampaignGoal("1000")).toBeNull();
  });

  it("accepts a fractional positive goal", () => {
    expect(validateCampaignGoal("0.5")).toBeNull();
  });

  it("rejects 0", () => {
    expect(validateCampaignGoal("0")).not.toBeNull();
  });

  it("rejects a negative number", () => {
    expect(validateCampaignGoal("-1")).not.toBeNull();
  });

  it("rejects NaN input", () => {
    expect(validateCampaignGoal("abc")).not.toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateCampaignGoal("")).not.toBeNull();
  });

  it("rejects a goal that exceeds i128::MAX / 10 in stroops", () => {
    // i128::MAX = 9223372036854775807; /10 = 922337203685477580
    // 922337203685477580 stroops = 92233720368.547758 XLM — use a value well above
    const hugGoal = "100000000000"; // 100 billion XLM → stroops overflows
    expect(validateCampaignGoal(hugGoal)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateCampaignDeadline
// ---------------------------------------------------------------------------

describe("validateCampaignDeadline", () => {
  it("accepts a deadline 2 hours from now", () => {
    expect(validateCampaignDeadline(hoursFromNow(2))).toBeNull();
  });

  it("accepts a deadline 30 days from now", () => {
    expect(validateCampaignDeadline(daysFromNow(30))).toBeNull();
  });

  it("rejects a past deadline", () => {
    expect(validateCampaignDeadline(hoursFromNow(-1))).not.toBeNull();
  });

  it("rejects a deadline less than 1 hour in the future", () => {
    expect(validateCampaignDeadline(hoursFromNow(0.5))).not.toBeNull();
  });

  it("rejects a deadline more than 1 year in the future", () => {
    expect(validateCampaignDeadline(daysFromNow(366))).not.toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateCampaignDeadline("")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateMinContribution
// ---------------------------------------------------------------------------

describe("validateMinContribution", () => {
  it("accepts 1 XLM", () => {
    expect(validateMinContribution("1")).toBeNull();
  });

  it("accepts 10 XLM", () => {
    expect(validateMinContribution("10")).toBeNull();
  });

  it("rejects 0", () => {
    expect(validateMinContribution("0")).not.toBeNull();
  });

  it("rejects 0.5 (below 1 XLM minimum)", () => {
    expect(validateMinContribution("0.5")).not.toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateMinContribution("")).not.toBeNull();
  });

  it("rejects a value greater than the goal", () => {
    expect(validateMinContribution("500", "100")).not.toBeNull();
  });

  it("accepts a value equal to the goal", () => {
    expect(validateMinContribution("100", "100")).toBeNull();
  });

  it("accepts a value less than the goal", () => {
    expect(validateMinContribution("10", "100")).toBeNull();
  });

  it("does not apply goal check when goal is not provided", () => {
    expect(validateMinContribution("9999")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateMaxContribution
// ---------------------------------------------------------------------------

describe("validateMaxContribution", () => {
  it("accepts 0 (no limit)", () => {
    expect(validateMaxContribution("0", "10")).toBeNull();
  });

  it("accepts an empty string (optional field)", () => {
    expect(validateMaxContribution("", "10")).toBeNull();
  });

  it("accepts a valid max >= min", () => {
    expect(validateMaxContribution("50", "10")).toBeNull();
  });

  it("accepts max equal to min", () => {
    expect(validateMaxContribution("10", "10")).toBeNull();
  });

  it("rejects a value less than minContribution", () => {
    expect(validateMaxContribution("5", "10")).not.toBeNull();
  });

  it("rejects a negative number", () => {
    expect(validateMaxContribution("-1", "10")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateFeeBps
// ---------------------------------------------------------------------------

describe("validateFeeBps", () => {
  it("accepts 0", () => {
    expect(validateFeeBps("0")).toBeNull();
  });

  it("accepts 10000", () => {
    expect(validateFeeBps("10000")).toBeNull();
  });

  it("accepts a mid-range value like 250 (2.5%)", () => {
    expect(validateFeeBps("250")).toBeNull();
  });

  it("rejects -1", () => {
    expect(validateFeeBps("-1")).not.toBeNull();
  });

  it("rejects 10001", () => {
    expect(validateFeeBps("10001")).not.toBeNull();
  });

  it("accepts an empty string (optional field)", () => {
    expect(validateFeeBps("")).toBeNull();
  });

  it("accepts undefined-like whitespace (optional field)", () => {
    expect(validateFeeBps("  ")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateDonationAmount
// ---------------------------------------------------------------------------

describe("validateDonationAmount", () => {
  it("accepts a valid positive amount", () => {
    expect(validateDonationAmount("5")).toBeNull();
  });

  it("rejects 0", () => {
    expect(validateDonationAmount("0")).not.toBeNull();
  });

  it("rejects a negative amount", () => {
    expect(validateDonationAmount("-1")).not.toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateDonationAmount("")).not.toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateDonationAmount("abc")).not.toBeNull();
  });

  it("rejects an amount below minContributionStroops", () => {
    const minStroops = 10n * XLM_TO_STROOPS; // 10 XLM
    expect(
      validateDonationAmount("5", { minContributionStroops: minStroops }),
    ).not.toBeNull();
  });

  it("accepts an amount equal to minContributionStroops", () => {
    const minStroops = 10n * XLM_TO_STROOPS; // 10 XLM
    expect(
      validateDonationAmount("10", { minContributionStroops: minStroops }),
    ).toBeNull();
  });

  it("accepts an amount above minContributionStroops", () => {
    const minStroops = 10n * XLM_TO_STROOPS;
    expect(
      validateDonationAmount("20", { minContributionStroops: minStroops }),
    ).toBeNull();
  });

  it("rejects an amount above maxContributionStroops", () => {
    const maxStroops = 100n * XLM_TO_STROOPS; // 100 XLM
    expect(
      validateDonationAmount("200", { maxContributionStroops: maxStroops }),
    ).not.toBeNull();
  });

  it("accepts an amount equal to maxContributionStroops", () => {
    const maxStroops = 100n * XLM_TO_STROOPS;
    expect(
      validateDonationAmount("100", { maxContributionStroops: maxStroops }),
    ).toBeNull();
  });

  it("treats maxContributionStroops of 0 as no limit", () => {
    expect(
      validateDonationAmount("9999", { maxContributionStroops: 0n }),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateCampaignInput
// ---------------------------------------------------------------------------

describe("validateCampaignInput", () => {
  const validInput = {
    title: "Save the Rainforest",
    description: "Help us protect biodiversity.",
    goal: "1000",
    deadline: hoursFromNow(48),
    minContribution: "1",
  };

  it("returns an empty object for a fully valid input", () => {
    expect(validateCampaignInput(validInput)).toEqual({});
  });

  it("returns errors for every invalid field", () => {
    const errors = validateCampaignInput({
      title: "",
      description: "",
      goal: "0",
      deadline: hoursFromNow(-1),
      minContribution: "0",
    });
    expect(Object.keys(errors)).toContain("title");
    expect(Object.keys(errors)).toContain("description");
    expect(Object.keys(errors)).toContain("goal");
    expect(Object.keys(errors)).toContain("deadline");
    expect(Object.keys(errors)).toContain("minContribution");
  });

  it("includes feeBps error when feeBps is invalid", () => {
    const errors = validateCampaignInput({ ...validInput, feeBps: "99999" });
    expect(errors["feeBps"]).toBeDefined();
  });

  it("includes maxContribution error when maxContribution is less than min", () => {
    const errors = validateCampaignInput({
      ...validInput,
      minContribution: "10",
      maxContribution: "5",
    });
    expect(errors["maxContribution"]).toBeDefined();
  });

  it("does not include feeBps key when feeBps is not provided", () => {
    const errors = validateCampaignInput(validInput);
    expect(errors["feeBps"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// validateDonationInput
// ---------------------------------------------------------------------------

describe("validateDonationInput", () => {
  it("returns an empty object for a valid donation", () => {
    expect(
      validateDonationInput({ amount: "5", campaignId: "CABC123" }),
    ).toEqual({});
  });

  it("returns an amount error for an invalid amount", () => {
    const errors = validateDonationInput({
      amount: "0",
      campaignId: "CABC123",
    });
    expect(errors["amount"]).toBeDefined();
  });

  it("returns a campaignId error when campaignId is empty", () => {
    const errors = validateDonationInput({ amount: "5", campaignId: "" });
    expect(errors["campaignId"]).toBeDefined();
  });

  it("returns errors for both fields when both are invalid", () => {
    const errors = validateDonationInput({ amount: "-1", campaignId: "" });
    expect(errors["amount"]).toBeDefined();
    expect(errors["campaignId"]).toBeDefined();
  });

  it("respects min contribution options", () => {
    const minStroops = 10n * XLM_TO_STROOPS;
    const errors = validateDonationInput(
      { amount: "1", campaignId: "CABC123" },
      { minContributionStroops: minStroops },
    );
    expect(errors["amount"]).toBeDefined();
  });
});
