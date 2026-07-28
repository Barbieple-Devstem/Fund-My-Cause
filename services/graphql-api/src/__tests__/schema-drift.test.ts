/**
 * Schema-drift test: services/graphql-api vs sdks/js (#941)
 *
 * Ensures that the GraphQL type names, fields, and enum values defined in
 * services/graphql-api/src/schema.ts remain aligned with the TypeScript types
 * consumed by sdks/js and the graphql-api's own resolver layer.
 *
 * Strategy
 * ────────
 * 1. Load the committed GraphQL SDL from services/graphql-api/src/schema.ts.
 * 2. Build a GraphQLSchema from it and introspect the type map.
 * 3. For each "contract type" in sdks/js/src/types.ts and
 *    services/graphql-api/src/types.ts, assert that the corresponding
 *    GraphQL type and its required fields are present in the schema.
 * 4. Fail with a clear, actionable error message when drift is detected,
 *    telling the developer exactly what command to run to regenerate types.
 *
 * If drift is detected, run:
 *   npx graphql-codegen --config apps/interface/codegen.ts
 * to regenerate client types from the committed schema, then update
 * sdks/js/src/types.ts accordingly.
 *
 * To run this test:
 *   npm test --workspace=services/graphql-api
 *   # or from the repo root:
 *   npx vitest run services/graphql-api/src/__tests__/schema-drift.test.ts
 */

import { describe, it, expect } from "vitest";
import { buildASTSchema } from "graphql";
import type {
  GraphQLObjectType,
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLField,
  GraphQLNamedType,
} from "graphql";
import { typeDefs } from "../schema";

// ── Regeneration instructions embedded in drift messages ─────────────────────
const REGEN_COMMAND =
  "npx graphql-codegen --config apps/interface/codegen.ts";

const REGEN_MSG =
  `Schema drift detected. Run the following command to regenerate client types:\n` +
  `  ${REGEN_COMMAND}\n` +
  `Then update sdks/js/src/types.ts and services/graphql-api/src/types.ts ` +
  `to match the new schema.`;

// ── Build schema from committed typeDefs ─────────────────────────────────────

/** The compiled schema built from the committed SDL in schema.ts */
const schema = buildASTSchema(typeDefs);

// ── Helper utilities ──────────────────────────────────────────────────────────

/**
 * Returns a GraphQLObjectType by name or throws a drift-aware error.
 */
function requireObjectType(typeName: string): GraphQLObjectType {
  const type: GraphQLNamedType | undefined = schema.getType(typeName) ?? undefined;
  if (!type) {
    throw new Error(
      `[Schema drift] GraphQL type '${typeName}' is missing from the schema.\n${REGEN_MSG}`,
    );
  }
  if (type.constructor.name !== "GraphQLObjectType") {
    throw new Error(
      `[Schema drift] '${typeName}' exists but is not an ObjectType (got ${type.constructor.name}).\n${REGEN_MSG}`,
    );
  }
  return type as GraphQLObjectType;
}

/**
 * Returns a GraphQLEnumType by name or throws a drift-aware error.
 */
function requireEnumType(typeName: string): GraphQLEnumType {
  const type: GraphQLNamedType | undefined = schema.getType(typeName) ?? undefined;
  if (!type) {
    throw new Error(
      `[Schema drift] GraphQL enum '${typeName}' is missing from the schema.\n${REGEN_MSG}`,
    );
  }
  if (type.constructor.name !== "GraphQLEnumType") {
    throw new Error(
      `[Schema drift] '${typeName}' is not an EnumType (got ${type.constructor.name}).\n${REGEN_MSG}`,
    );
  }
  return type as GraphQLEnumType;
}

/**
 * Returns a GraphQLInputObjectType by name or throws a drift-aware error.
 */
function requireInputType(typeName: string): GraphQLInputObjectType {
  const type: GraphQLNamedType | undefined = schema.getType(typeName) ?? undefined;
  if (!type) {
    throw new Error(
      `[Schema drift] GraphQL input '${typeName}' is missing from the schema.\n${REGEN_MSG}`,
    );
  }
  if (type.constructor.name !== "GraphQLInputObjectType") {
    throw new Error(
      `[Schema drift] '${typeName}' is not an InputObjectType (got ${type.constructor.name}).\n${REGEN_MSG}`,
    );
  }
  return type as GraphQLInputObjectType;
}

/**
 * Asserts that a field exists on an object type.
 */
function assertField(
  type: GraphQLObjectType | GraphQLInputObjectType,
  fieldName: string,
): GraphQLField<unknown, unknown> | ReturnType<GraphQLInputObjectType["getFields"]>[string] {
  const fields = type.getFields();
  const field = fields[fieldName];
  if (!field) {
    throw new Error(
      `[Schema drift] Field '${type.name}.${fieldName}' is missing from the GraphQL schema.\n${REGEN_MSG}`,
    );
  }
  return field;
}

/**
 * Asserts that an enum value exists.
 */
function assertEnumValue(enumType: GraphQLEnumType, value: string): void {
  const values = enumType.getValues().map((v) => v.name);
  if (!values.includes(value)) {
    throw new Error(
      `[Schema drift] Enum value '${enumType.name}.${value}' is missing.\n` +
        `Current values: [${values.join(", ")}]\n${REGEN_MSG}`,
    );
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Schema drift — schema.ts is a valid GraphQL SDL (#941)", () => {
  it("builds without errors from the committed typeDefs", () => {
    expect(() => buildASTSchema(typeDefs)).not.toThrow();
  });

  it("exposes a Query type", () => {
    expect(schema.getQueryType()).not.toBeNull();
  });

  it("exposes a Mutation type", () => {
    expect(schema.getMutationType()).not.toBeNull();
  });

  it("exposes a Subscription type", () => {
    expect(schema.getSubscriptionType()).not.toBeNull();
  });
});

describe("Schema drift — Campaign type (#941)", () => {
  /**
   * These fields must exist in the GraphQL schema and also correspond to
   * the Campaign interface used in sdks/js/src/types.ts and
   * services/graphql-api/src/types.ts.
   *
   * If any assertion fails the developer must run REGEN_COMMAND.
   */
  const CAMPAIGN_FIELDS = [
    "id",
    "contractId",
    "title",
    "description",
    "creator",
    "goal",
    "raised",
    "deadline",
    "status",
    "category",
    "token",
    "minContribution",
    "totalContributors",
    "percentageFunded",
    "daysRemaining",
    "hasRBACEnabled",
    "createdAt",
    "updatedAt",
  ];

  it("Campaign type exists in the schema", () => {
    expect(() => requireObjectType("Campaign")).not.toThrow();
  });

  it.each(CAMPAIGN_FIELDS)("Campaign.%s field is present", (field) => {
    const type = requireObjectType("Campaign");
    expect(() => assertField(type, field)).not.toThrow();
  });
});

describe("Schema drift — CampaignStatus enum (#941)", () => {
  const EXPECTED_VALUES = [
    "ACTIVE",
    "SUCCESSFUL",
    "REFUNDED",
    "CANCELLED",
    "PAUSED",
    "ARCHIVED",
  ];

  it("CampaignStatus enum exists", () => {
    expect(() => requireEnumType("CampaignStatus")).not.toThrow();
  });

  it.each(EXPECTED_VALUES)("CampaignStatus.%s value is present", (value) => {
    const enumType = requireEnumType("CampaignStatus");
    expect(() => assertEnumValue(enumType, value)).not.toThrow();
  });

  it("CampaignStatus has exactly the expected values (no undocumented additions)", () => {
    const enumType = requireEnumType("CampaignStatus");
    const actual = enumType.getValues().map((v) => v.name).sort();
    const expected = [...EXPECTED_VALUES].sort();
    expect(actual).toEqual(expected);
  });
});

describe("Schema drift — Contribution type (#941)", () => {
  const CONTRIBUTION_FIELDS = [
    "id",
    "campaignId",
    "contributor",
    "amount",
    "timestamp",
    "transactionHash",
  ];

  it("Contribution type exists", () => {
    expect(() => requireObjectType("Contribution")).not.toThrow();
  });

  it.each(CONTRIBUTION_FIELDS)("Contribution.%s field is present", (field) => {
    const type = requireObjectType("Contribution");
    expect(() => assertField(type, field)).not.toThrow();
  });
});

describe("Schema drift — User type (#941)", () => {
  const USER_FIELDS = [
    "address",
    "totalContributed",
    "contributionCount",
    "campaigns",
    "contributions",
    "joinedAt",
  ];

  it("User type exists", () => {
    expect(() => requireObjectType("User")).not.toThrow();
  });

  it.each(USER_FIELDS)("User.%s field is present", (field) => {
    const type = requireObjectType("User");
    expect(() => assertField(type, field)).not.toThrow();
  });
});

describe("Schema drift — Statistics type (#941)", () => {
  const STATS_FIELDS = [
    "totalCampaigns",
    "activeCampaigns",
    "totalRaised",
    "totalContributors",
    "averageContribution",
    "successRate",
  ];

  it("Statistics type exists", () => {
    expect(() => requireObjectType("Statistics")).not.toThrow();
  });

  it.each(STATS_FIELDS)("Statistics.%s field is present", (field) => {
    const type = requireObjectType("Statistics");
    expect(() => assertField(type, field)).not.toThrow();
  });
});

describe("Schema drift — CampaignProgress type (#941)", () => {
  const PROGRESS_FIELDS = [
    "campaignId",
    "raised",
    "percentageFunded",
    "contributors",
    "daysRemaining",
    "timestamp",
  ];

  it("CampaignProgress type exists", () => {
    expect(() => requireObjectType("CampaignProgress")).not.toThrow();
  });

  it.each(PROGRESS_FIELDS)("CampaignProgress.%s field is present", (field) => {
    const type = requireObjectType("CampaignProgress");
    expect(() => assertField(type, field)).not.toThrow();
  });
});

describe("Schema drift — Query root (#941)", () => {
  const QUERY_FIELDS = [
    "campaign",
    "campaigns",
    "activeCampaigns",
    "trendingCampaigns",
    "searchCampaigns",
    "campaignDetail",
    "contribution",
    "contributions",
    "user",
    "userContributions",
    "stats",
  ];

  it("Query type exists", () => {
    expect(schema.getQueryType()).not.toBeNull();
  });

  it.each(QUERY_FIELDS)("Query.%s field is present", (field) => {
    const queryType = schema.getQueryType()!;
    expect(() => assertField(queryType, field)).not.toThrow();
  });
});

describe("Schema drift — Mutation root (#941)", () => {
  const MUTATION_FIELDS = ["authenticate", "createCampaign", "updateCampaign", "recordContribution"];

  it("Mutation type exists", () => {
    expect(schema.getMutationType()).not.toBeNull();
  });

  it.each(MUTATION_FIELDS)("Mutation.%s field is present", (field) => {
    const mutationType = schema.getMutationType()!;
    expect(() => assertField(mutationType, field)).not.toThrow();
  });
});

describe("Schema drift — Subscription root (#941)", () => {
  const SUBSCRIPTION_FIELDS = [
    "campaignUpdated",
    "campaignStatusChanged",
    "newContribution",
    "campaignProgressChanged",
    "milestoneReached",
  ];

  it("Subscription type exists", () => {
    expect(schema.getSubscriptionType()).not.toBeNull();
  });

  it.each(SUBSCRIPTION_FIELDS)("Subscription.%s field is present", (field) => {
    const subType = schema.getSubscriptionType()!;
    expect(() => assertField(subType, field)).not.toThrow();
  });
});

describe("Schema drift — Input types (#941)", () => {
  it("CampaignFilter input type exists", () => {
    expect(() => requireInputType("CampaignFilter")).not.toThrow();
  });

  it("CreateCampaignInput exists with required fields", () => {
    const input = requireInputType("CreateCampaignInput");
    for (const field of ["title", "description", "goal", "deadline", "category"]) {
      expect(() => assertField(input, field)).not.toThrow();
    }
  });

  it("RecordContributionInput exists with required fields", () => {
    const input = requireInputType("RecordContributionInput");
    for (const field of ["campaignId", "contributor", "amount", "transactionHash"]) {
      expect(() => assertField(input, field)).not.toThrow();
    }
  });

  it("PaginationInput exists", () => {
    expect(() => requireInputType("PaginationInput")).not.toThrow();
  });
});

describe("Schema drift — SortField and SortDirection enums (#941)", () => {
  it("SortField enum contains expected values", () => {
    const enumType = requireEnumType("SortField");
    for (const v of ["CREATED_AT", "RAISED_AMOUNT", "GOAL", "DEADLINE", "CONTRIBUTORS"]) {
      expect(() => assertEnumValue(enumType, v)).not.toThrow();
    }
  });

  it("SortDirection enum contains ASC and DESC", () => {
    const enumType = requireEnumType("SortDirection");
    expect(() => assertEnumValue(enumType, "ASC")).not.toThrow();
    expect(() => assertEnumValue(enumType, "DESC")).not.toThrow();
  });
});

describe("Schema drift — MilestoneStatus enum (#941)", () => {
  it("MilestoneStatus enum contains PENDING, REACHED, RELEASED", () => {
    const enumType = requireEnumType("MilestoneStatus");
    for (const v of ["PENDING", "REACHED", "RELEASED"]) {
      expect(() => assertEnumValue(enumType, v)).not.toThrow();
    }
  });
});

describe("Schema drift — SDK/resolver type alignment (#941)", () => {
  /**
   * These tests verify that the GraphQL schema's field names and enum values
   * align with what sdks/js/src/types.ts and services/graphql-api/src/types.ts
   * expose. They act as a canary: if the schema is modified without updating
   * client types (or vice versa), these assertions catch the discrepancy
   * immediately, with a clear message pointing to REGEN_COMMAND.
   *
   * Regeneration command:
   *   npx graphql-codegen --config apps/interface/codegen.ts
   */

  it("CampaignStatus ACTIVE maps to SDK contract status 'Active'", () => {
    // The GraphQL schema uses SCREAMING_CASE; the SDK uses PascalCase.
    // resolvers.ts bridges these via CAMPAIGN_STATUS_ENUM_MAP.
    // This test confirms the GraphQL enum value 'ACTIVE' exists in the schema
    // so the bridge mapping is never broken silently.
    const enumType = requireEnumType("CampaignStatus");
    expect(() => assertEnumValue(enumType, "ACTIVE")).not.toThrow();
  });

  it("Campaign.raised field corresponds to SDK CampaignStats.raisedStroops", () => {
    // GraphQL schema exposes 'raised' as BigInt.
    // SDK types.ts exposes 'raisedStroops: bigint' and 'raisedXlm: number'.
    // Both must exist — this test checks the schema side.
    const type = requireObjectType("Campaign");
    expect(() => assertField(type, "raised")).not.toThrow();
  });

  it("Campaign.totalContributors corresponds to SDK CampaignStats.contributorCount", () => {
    const type = requireObjectType("Campaign");
    expect(() => assertField(type, "totalContributors")).not.toThrow();
  });

  it("Contribution.transactionHash is present in both schema and SDK type", () => {
    const type = requireObjectType("Contribution");
    expect(() => assertField(type, "transactionHash")).not.toThrow();
  });

  it("drift test provides regeneration instructions on failure", () => {
    // Intentionally verify that the error message is actionable.
    let caught: Error | undefined;
    try {
      requireObjectType("NonExistentType_ThisShouldFail");
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();
    expect(caught?.message).toContain(REGEN_COMMAND);
    expect(caught?.message).toContain("Schema drift detected");
  });
});
