import { describe, it, expect } from "vitest";
import { CAMPAIGN_STATUS_VALUES } from "@fund-my-cause/types";
import { CAMPAIGN_STATUS_ENUM_MAP } from "../resolvers.js";

/**
 * Contract test: guards against the exact bug this issue fixes — the public
 * GraphQL schema's CampaignStatus enum (schema.ts, SCREAMING_CASE) silently
 * drifting out of sync with the canonical internal values from
 * @fund-my-cause/types (PascalCase, matching the crowdfund contract).
 */
describe("CAMPAIGN_STATUS_ENUM_MAP", () => {
  it("has exactly one entry per canonical CampaignStatus value", () => {
    expect(Object.keys(CAMPAIGN_STATUS_ENUM_MAP).sort()).toEqual(
      CAMPAIGN_STATUS_VALUES.map((v) => v.toUpperCase()).sort()
    );
  });

  it("maps every SCREAMING_CASE GraphQL name to its canonical PascalCase value", () => {
    for (const value of CAMPAIGN_STATUS_VALUES) {
      expect(CAMPAIGN_STATUS_ENUM_MAP[value.toUpperCase()]).toBe(value);
    }
  });

  it("never maps to the pre-consolidation uppercase-only values", () => {
    for (const internalValue of Object.values(CAMPAIGN_STATUS_ENUM_MAP)) {
      expect(internalValue).not.toBe(internalValue.toUpperCase());
    }
  });
});
