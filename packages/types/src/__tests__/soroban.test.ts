import { describe, it, expect } from "vitest";
import { CAMPAIGN_STATUS_VALUES } from "../soroban";

/**
 * Contract test: CAMPAIGN_STATUS_VALUES is the single source of truth for
 * campaign status values across graphql-api, sdks/js and apps/interface.
 * It must keep mirroring the crowdfund contract's `Status` enum
 * (contracts/crowdfund/src/types.rs) exactly, including casing and order.
 * If this test needs to change, every consumer's mapping (e.g.
 * services/graphql-api/src/resolvers.ts's CAMPAIGN_STATUS_ENUM_MAP) needs
 * a matching update.
 */
describe("CAMPAIGN_STATUS_VALUES", () => {
  it("matches the crowdfund contract's Status enum exactly", () => {
    expect(CAMPAIGN_STATUS_VALUES).toEqual([
      "Active",
      "Successful",
      "Refunded",
      "Cancelled",
      "Paused",
      "Archived",
    ]);
  });

  it("has no duplicate values", () => {
    expect(new Set(CAMPAIGN_STATUS_VALUES).size).toBe(CAMPAIGN_STATUS_VALUES.length);
  });
});
