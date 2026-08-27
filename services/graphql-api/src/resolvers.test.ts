import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GraphQLError } from "graphql";
import { resolvers } from "./resolvers.js";
import type { Context } from "./types.js";

const mockLog = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as any;

function createMockContext(overrides: Partial<Context> = {}): Context {
  const dataLoader = {
    campaigns: { load: vi.fn() },
    contributions: { load: vi.fn() },
    users: { load: vi.fn() },
    campaignContributors: { load: vi.fn() },
    campaignContributions: { load: vi.fn() },
    campaignUpdates: { load: vi.fn() },
    campaignMilestones: { load: vi.fn() },
    campaignsByStatus: { load: vi.fn() },
    userCampaigns: { load: vi.fn() },
    userContributions: { load: vi.fn() },
  };

  return {
    cache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(undefined),
      delPattern: vi.fn().mockResolvedValue(undefined),
    },
    contractService: {
      getCampaign: vi.fn(),
      getCampaigns: vi.fn(),
      getCampaignCount: vi.fn(),
      getTrendingCampaigns: vi.fn(),
      searchCampaigns: vi.fn(),
      getUser: vi.fn(),
      getStats: vi.fn(),
      verifySignature: vi.fn(),
      createCampaign: vi.fn(),
      updateCampaign: vi.fn(),
      recordContribution: vi.fn(),
    },
    dataLoader: dataLoader as any,
    pubsub: {
      publish: vi.fn().mockResolvedValue(undefined),
      asyncIterator: vi.fn(),
    } as any,
    authService: {
      generateToken: vi.fn(),
    } as any,
    user: undefined,
    redis: {} as any,
    traceId: "fmc-00000000-0000000000000000",
    log: mockLog,
    ...overrides,
  } as Context;
}

const sampleCampaign = (overrides: Record<string, any> = {}) => ({
  id: "camp_1",
  contractId: "contract_1",
  title: "Test Campaign",
  description: "A campaign",
  creator: "GCREATOR",
  goal: BigInt("10000000000"),
  raised: BigInt("5000000000"),
  deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  status: "ACTIVE",
  category: "Technology",
  minContribution: BigInt("1000000"),
  totalContributors: 10,
  token: "native",
  platformFeeBps: 250,
  hasRBACEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

describe("resolvers", () => {
  describe("Query.campaign", () => {
    it("returns the cached campaign without touching the contract service", async () => {
      const context = createMockContext();
      const cached = sampleCampaign();
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (resolvers.Query as any).campaign(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toBe(cached);
      expect(context.contractService.getCampaign).not.toHaveBeenCalled();
    });

    it("fetches from the contract service on a cache miss and populates the cache", async () => {
      const context = createMockContext();
      const campaign = sampleCampaign();
      (context.contractService.getCampaign as any).mockResolvedValue(campaign);

      const result = await (resolvers.Query as any).campaign(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.cache.set).toHaveBeenCalledWith(
        "campaign:camp_1",
        campaign,
        300,
      );
    });

    it("throws a GraphQLError when the campaign does not exist", async () => {
      const context = createMockContext();
      (context.contractService.getCampaign as any).mockResolvedValue(null);

      await expect(
        (resolvers.Query as any).campaign(null, { id: "missing" }, context),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
      expect(context.cache.set).not.toHaveBeenCalled();
    });
  });

  describe("Query.campaigns", () => {
    it("returns the cached connection on a cache hit", async () => {
      const context = createMockContext();
      const cached = { edges: [], pageInfo: {}, totalCount: 0 };
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (resolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 20, offset: 0 } },
        context,
      );

      expect(result).toBe(cached);
      expect(context.contractService.getCampaigns).not.toHaveBeenCalled();
    });

    it("builds a cursor-paginated connection from contract service results on a cache miss", async () => {
      const context = createMockContext();
      // Two campaigns, resolver requests limit+1 (21) — only 2 come back, so hasNextPage = false.
      const campaigns = [
        sampleCampaign({ id: "a" }),
        sampleCampaign({ id: "b" }),
      ];
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(2);

      const result = await (resolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 20, offset: 0 } },
        context,
      );

      expect(result.edges).toHaveLength(2);
      expect(result.edges[0].node).toBe(campaigns[0]);
      // Cursors are now HMAC-signed base64url strings (not plain base64 offsets).
      expect(typeof result.edges[0].cursor).toBe("string");
      expect(result.totalCount).toBe(2);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
      expect(result.pageInfo.hasNextPage).toBe(false); // 2 returned < limit+1 (21)
      expect(context.cache.set).toHaveBeenCalledWith(
        expect.any(String),
        result,
        600,
      );
    });

    it("sets hasNextPage true when N+1 items are returned", async () => {
      const context = createMockContext();
      // Resolver requests pageSize+1 (limit=2 → requests 3). Return 3 items → hasNextPage = true.
      const campaigns = Array.from({ length: 3 }, (_, i) =>
        sampleCampaign({ id: `c${i}` }),
      );
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(50);

      const result = await (resolvers.Query as any).campaigns(
        null,
        { pagination: { limit: 2, offset: 4 } },
        context,
      );

      expect(result.edges).toHaveLength(2); // sliced to pageSize
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(true); // offset > 0
    });

    it("accepts first/after cursor arguments and decodes the cursor", async () => {
      const context = createMockContext();
      // Import encodeCursor to build a valid cursor for the test.
      const { encodeCursor } = await import("./services/cursor-pagination.js");
      const validCursor = encodeCursor({
        id: "camp_prev",
        sortKey: "2024-01-01T00:00:00.000Z",
      });

      const campaigns = [sampleCampaign({ id: "x" })];
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(1);

      const result = await (resolvers.Query as any).campaigns(
        null,
        { first: 10, after: validCursor },
        context,
      );

      expect(result.edges).toHaveLength(1);
      // hasPreviousPage is true when after cursor is present
      expect(result.pageInfo.hasPreviousPage).toBe(true);
    });

    it("throws BAD_USER_INPUT for a tampered cursor", async () => {
      const context = createMockContext();
      await expect(
        (resolvers.Query as any).campaigns(
          null,
          { first: 10, after: "tampered.invalidsig" },
          context,
        ),
      ).rejects.toMatchObject({
        extensions: { code: "BAD_USER_INPUT" },
      });
    });

    it("clamps first to a maximum of 100", async () => {
      const context = createMockContext();
      const campaigns = Array.from({ length: 5 }, (_, i) =>
        sampleCampaign({ id: `d${i}` }),
      );
      (context.contractService.getCampaigns as any).mockResolvedValue(
        campaigns,
      );
      (context.contractService.getCampaignCount as any).mockResolvedValue(5);

      await (resolvers.Query as any).campaigns(null, { first: 9999 }, context);

      // Resolver clamps to 100; passes limit=101 to getCampaigns (N+1 trick).
      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 101, offset: 0 } }),
      );
    });
  });

  describe("Query.activeCampaigns", () => {
    it("delegates to the campaignsByStatus dataloader", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.dataLoader.campaignsByStatus.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (resolvers.Query as any).activeCampaigns(
        null,
        { limit: 5 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.dataLoader.campaignsByStatus.load).toHaveBeenCalledWith({
        status: "Active",
        limit: 5,
      });
    });
  });

  describe("Query.trendingCampaigns", () => {
    it("returns cached trending campaigns without calling the contract service", async () => {
      const context = createMockContext();
      const cached = [sampleCampaign()];
      (context.cache.get as any).mockResolvedValue(cached);

      const result = await (resolvers.Query as any).trendingCampaigns(
        null,
        { limit: 10 },
        context,
      );

      expect(result).toBe(cached);
      expect(
        context.contractService.getTrendingCampaigns,
      ).not.toHaveBeenCalled();
    });

    it("fetches and caches trending campaigns on a miss", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.contractService.getTrendingCampaigns as any).mockResolvedValue(
        campaigns,
      );

      const result = await (resolvers.Query as any).trendingCampaigns(
        null,
        { limit: 10 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.cache.set).toHaveBeenCalledWith(
        "trending:10",
        campaigns,
        1800,
      );
    });
  });

  describe("Query.searchCampaigns", () => {
    it("delegates to contractService.searchCampaigns", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.contractService.searchCampaigns as any).mockResolvedValue(
        campaigns,
      );

      const result = await (resolvers.Query as any).searchCampaigns(
        null,
        { query: "water", limit: 5 },
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.contractService.searchCampaigns).toHaveBeenCalledWith(
        "water",
        5,
      );
    });
  });

  describe("Query.campaignDetail", () => {
    it("assembles campaign, contributors, updates, and milestones", async () => {
      const context = createMockContext();
      const campaign = sampleCampaign();
      const contributors = [{ address: "a", amount: 1n }];
      const updates = [{ id: "u1" }];
      const milestones = [{ id: "m1" }];

      (context.dataLoader.campaigns.load as any).mockResolvedValue(campaign);
      (context.dataLoader.campaignContributors.load as any).mockResolvedValue(
        contributors,
      );
      (context.dataLoader.campaignUpdates.load as any).mockResolvedValue(
        updates,
      );
      (context.dataLoader.campaignMilestones.load as any).mockResolvedValue(
        milestones,
      );

      const result = await (resolvers.Query as any).campaignDetail(
        null,
        { id: "camp_1" },
        context,
      );

      expect(result).toEqual({ campaign, contributors, updates, milestones });
    });

    it("throws a GraphQLError when the campaign is not found", async () => {
      const context = createMockContext();
      (context.dataLoader.campaigns.load as any).mockResolvedValue(null);

      await expect(
        (resolvers.Query as any).campaignDetail(
          null,
          { id: "missing" },
          context,
        ),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
    });
  });

  describe("Query.contribution / contributions", () => {
    it("contribution loads by id via the dataloader", async () => {
      const context = createMockContext();
      const contribution = { id: "contrib_1" };
      (context.dataLoader.contributions.load as any).mockResolvedValue(
        contribution,
      );

      const result = await (resolvers.Query as any).contribution(
        null,
        { id: "contrib_1" },
        context,
      );

      expect(result).toBe(contribution);
    });

    it("contributions loads by campaignId when provided", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c1" }];
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (resolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1" },
        context,
      );

      expect(result).toBe(contributions);
      expect(context.dataLoader.userContributions.load).not.toHaveBeenCalled();
    });

    it("contributions loads by contributor when campaignId is absent", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c2" }];
      (context.dataLoader.userContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (resolvers.Query as any).contributions(
        null,
        { contributor: "GADDR" },
        context,
      );

      expect(result).toBe(contributions);
    });

    it("throws when neither campaignId nor contributor is provided", async () => {
      const context = createMockContext();

      await expect(
        (resolvers.Query as any).contributions(null, {}, context),
      ).rejects.toThrow(GraphQLError);
    });
  });

  describe("Query.user", () => {
    it("returns cached user without calling the contract service", async () => {
      const context = createMockContext();
      const user = { address: "GADDR" };
      (context.cache.get as any).mockResolvedValue(user);

      const result = await (resolvers.Query as any).user(
        null,
        { address: "GADDR" },
        context,
      );

      expect(result).toBe(user);
      expect(context.contractService.getUser).not.toHaveBeenCalled();
    });

    it("fetches and caches the user on a miss", async () => {
      const context = createMockContext();
      const user = { address: "GADDR" };
      (context.contractService.getUser as any).mockResolvedValue(user);

      const result = await (resolvers.Query as any).user(
        null,
        { address: "GADDR" },
        context,
      );

      expect(result).toBe(user);
      expect(context.cache.set).toHaveBeenCalledWith("user:GADDR", user, 600);
    });

    it("throws a GraphQLError when the user does not exist", async () => {
      const context = createMockContext();
      (context.contractService.getUser as any).mockResolvedValue(null);

      await expect(
        (resolvers.Query as any).user(null, { address: "unknown" }, context),
      ).rejects.toMatchObject({ extensions: { code: "NOT_FOUND" } });
    });
  });

  describe("Query.stats", () => {
    it("returns cached stats without calling the contract service", async () => {
      const context = createMockContext();
      const stats = { totalCampaigns: 1 };
      (context.cache.get as any).mockResolvedValue(stats);

      const result = await (resolvers.Query as any).stats(null, null, context);

      expect(result).toBe(stats);
      expect(context.contractService.getStats).not.toHaveBeenCalled();
    });

    it("fetches and caches stats on a miss", async () => {
      const context = createMockContext();
      const stats = { totalCampaigns: 42 };
      (context.contractService.getStats as any).mockResolvedValue(stats);

      const result = await (resolvers.Query as any).stats(null, null, context);

      expect(result).toBe(stats);
      expect(context.cache.set).toHaveBeenCalledWith(
        "platform:stats",
        stats,
        1800,
      );
    });
  });

  describe("Campaign field resolvers", () => {
    it("percentageFunded computes raised/goal as a whole percentage", () => {
      const campaign = sampleCampaign({ goal: 200n, raised: 50n });
      const result = (resolvers.Campaign as any).percentageFunded(campaign);
      expect(result).toBe(25);
    });

    it("percentageFunded returns 0 when goal is zero", () => {
      const campaign = sampleCampaign({ goal: 0n, raised: 0n });
      const result = (resolvers.Campaign as any).percentageFunded(campaign);
      expect(result).toBe(0);
    });

    it("daysRemaining rounds up remaining whole days", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

      const campaign = sampleCampaign({
        deadline: new Date("2026-01-03T12:00:00.000Z").toISOString(),
      });
      const result = (resolvers.Campaign as any).daysRemaining(campaign);

      expect(result).toBe(3); // 2.5 days rounds up to 3

      vi.useRealTimers();
    });

    it("daysRemaining clamps to 0 for a past deadline", () => {
      const campaign = sampleCampaign({
        deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      });
      const result = (resolvers.Campaign as any).daysRemaining(campaign);
      expect(result).toBe(0);
    });
  });

  describe("CampaignDetail.topContributors field resolver", () => {
    it("ranks contributors by amount descending and computes percentage of raised", () => {
      const parent = {
        campaign: sampleCampaign({ raised: 100n }),
        contributors: [
          { address: "a", amount: 10n },
          { address: "b", amount: 50n },
          { address: "c", amount: 40n },
        ],
      };

      const result = (resolvers.CampaignDetail as any).topContributors(parent, {
        limit: 10,
      });

      expect(result.map((c: any) => c.address)).toEqual(["b", "c", "a"]);
      expect(result[0]).toMatchObject({
        rank: 1,
        address: "b",
        percentage: 50,
      });
      expect(result[1]).toMatchObject({
        rank: 2,
        address: "c",
        percentage: 40,
      });
    });

    it("respects the limit argument", () => {
      const parent = {
        campaign: sampleCampaign({ raised: 100n }),
        contributors: [
          { address: "a", amount: 10n },
          { address: "b", amount: 50n },
          { address: "c", amount: 40n },
        ],
      };

      const result = (resolvers.CampaignDetail as any).topContributors(parent, {
        limit: 1,
      });

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe("b");
    });
  });

  describe("User field resolvers", () => {
    it("campaigns delegates to userCampaigns dataloader", async () => {
      const context = createMockContext();
      const campaigns = [sampleCampaign()];
      (context.dataLoader.userCampaigns.load as any).mockResolvedValue(
        campaigns,
      );

      const result = await (resolvers.User as any).campaigns(
        { address: "GADDR" },
        null,
        context,
      );

      expect(result).toBe(campaigns);
      expect(context.dataLoader.userCampaigns.load).toHaveBeenCalledWith(
        "GADDR",
      );
    });

    it("contributions delegates to userContributions dataloader", async () => {
      const context = createMockContext();
      const contributions = [{ id: "c1" }];
      (context.dataLoader.userContributions.load as any).mockResolvedValue(
        contributions,
      );

      const result = await (resolvers.User as any).contributions(
        { address: "GADDR" },
        null,
        context,
      );

      expect(result).toBe(contributions);
      expect(context.dataLoader.userContributions.load).toHaveBeenCalledWith(
        "GADDR",
      );
    });
  });

  describe("BigInt scalar", () => {
    it("serializes to a string", () => {
      expect((resolvers.BigInt as any).serialize(123n)).toBe("123");
    });

    it("parses a value string into a BigInt", () => {
      expect((resolvers.BigInt as any).parseValue("456")).toBe(456n);
    });

    it("parses an IntValue AST literal into a BigInt", () => {
      expect(
        (resolvers.BigInt as any).parseLiteral({
          kind: "IntValue",
          value: "789",
        }),
      ).toBe(789n);
    });

    it("throws a GraphQLError for a non-int AST literal", () => {
      expect(() =>
        (resolvers.BigInt as any).parseLiteral({
          kind: "StringValue",
          value: "789",
        }),
      ).toThrow(GraphQLError);
    });
  });

  // DateTime scalar tests removed in #913 — the DateTime scalar was dropped from
  // the schema because no field ever used it (all date/time fields use String!).
  // The resolver entry was removed accordingly; there is nothing left to test.

  describe("Mutation.authenticate", () => {
    it("issues a token and returns the user on a valid signature", async () => {
      const context = createMockContext();
      (context.contractService.verifySignature as any).mockResolvedValue(true);
      (context.authService.generateToken as any).mockReturnValue(
        "signed-token",
      );
      const user = { address: "GADDR" };
      (context.contractService.getUser as any).mockResolvedValue(user);

      const result = await (resolvers.Mutation as any).authenticate(
        null,
        { signature: "sig", message: "msg", address: "GADDR" },
        context,
      );

      expect(result).toEqual({ token: "signed-token", user });
    });

    it("throws a GraphQLError on an invalid signature", async () => {
      const context = createMockContext();
      (context.contractService.verifySignature as any).mockResolvedValue(false);

      await expect(
        (resolvers.Mutation as any).authenticate(
          null,
          { signature: "bad", message: "msg", address: "GADDR" },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.authService.generateToken).not.toHaveBeenCalled();
    });
  });

  describe("Mutation.createCampaign", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (resolvers.Mutation as any).createCampaign(
          null,
          { input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.createCampaign).not.toHaveBeenCalled();
    });

    it("creates the campaign and invalidates related caches when authenticated", async () => {
      const context = createMockContext({
        user: { address: "GCREATOR", isAuthenticated: true },
      });
      const campaign = sampleCampaign();
      (context.contractService.createCampaign as any).mockResolvedValue(
        campaign,
      );

      const validInput = {
        title: "New Campaign",
        description: "A great cause worth funding.",
        goal: 10000n,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        category: "Technology",
        minContribution: 10n,
      };

      const result = await (resolvers.Mutation as any).createCampaign(
        null,
        { input: validInput },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.contractService.createCampaign).toHaveBeenCalledWith(
        context.user,
        validInput,
      );
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
    });
  });

  describe("Mutation.updateCampaign", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (resolvers.Mutation as any).updateCampaign(
          null,
          { id: "camp_1", input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.updateCampaign).not.toHaveBeenCalled();
    });

    it("updates the campaign, invalidates caches, and publishes an update event", async () => {
      const context = createMockContext({
        user: { address: "GCREATOR", isAuthenticated: true },
      });
      const campaign = sampleCampaign({ id: "camp_1" });
      (context.contractService.updateCampaign as any).mockResolvedValue(
        campaign,
      );

      const result = await (resolvers.Mutation as any).updateCampaign(
        null,
        { id: "camp_1", input: { title: "Updated" } },
        context,
      );

      expect(result).toBe(campaign);
      expect(context.cache.del).toHaveBeenCalledWith("campaign:camp_1");
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "campaign_updated:camp_1",
        campaign,
      );
    });
  });

  describe("Mutation.recordContribution", () => {
    it("throws when there is no authenticated user", async () => {
      const context = createMockContext({ user: undefined });

      await expect(
        (resolvers.Mutation as any).recordContribution(
          null,
          { input: {} },
          context,
        ),
      ).rejects.toThrow(GraphQLError);
      expect(context.contractService.recordContribution).not.toHaveBeenCalled();
    });

    it("records the contribution, invalidates caches, and publishes contribution + progress events", async () => {
      const context = createMockContext({
        user: { address: "GCONTRIBUTOR", isAuthenticated: true },
      });
      const input = {
        campaignId: "camp_1",
        contributor: "GCONTRIBUTOR",
        amount: 20000000n, // 2 XLM in stroops
        transactionHash: "hash",
      };
      const contribution = { id: "contrib_1", ...input };
      const campaign = sampleCampaign({
        id: "camp_1",
        raised: 5000n,
        goal: 10000n,
      });

      (context.contractService.recordContribution as any).mockResolvedValue(
        contribution,
      );
      (context.contractService.getCampaign as any).mockResolvedValue(campaign);

      const result = await (resolvers.Mutation as any).recordContribution(
        null,
        { input },
        context,
      );

      expect(result).toBe(contribution);
      expect(context.cache.del).toHaveBeenCalledWith("campaign:camp_1");
      expect(context.cache.del).toHaveBeenCalledWith("platform:stats");
      expect(context.cache.del).toHaveBeenCalledWith("user:GCONTRIBUTOR");
      expect(context.cache.delPattern).toHaveBeenCalledWith("campaigns:*");
      expect(context.cache.delPattern).toHaveBeenCalledWith("trending:*");
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "contribution:camp_1",
        contribution,
      );
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "progress:camp_1",
        expect.objectContaining({ campaignId: "camp_1", percentageFunded: 50 }),
      );
    });

    it("does not publish a progress event when the campaign can no longer be found", async () => {
      const context = createMockContext({
        user: { address: "GCONTRIBUTOR", isAuthenticated: true },
      });
      const input = {
        campaignId: "camp_missing",
        contributor: "GCONTRIBUTOR",
        amount: 20000000n, // 2 XLM in stroops
        transactionHash: "hash",
      };
      const contribution = { id: "contrib_1", ...input };

      (context.contractService.recordContribution as any).mockResolvedValue(
        contribution,
      );
      (context.contractService.getCampaign as any).mockResolvedValue(null);

      await (resolvers.Mutation as any).recordContribution(
        null,
        { input },
        context,
      );

      expect(context.pubsub.publish).toHaveBeenCalledTimes(1); // only the contribution event
      expect(context.pubsub.publish).toHaveBeenCalledWith(
        "contribution:camp_missing",
        contribution,
      );
    });
  });

  describe("Pagination Boundaries", () => {
    it("Query.campaigns clamps page size to 100 maximum", async () => {
      const context = createMockContext();
      (context.contractService.getCampaigns as any).mockResolvedValue([]);
      (context.contractService.getCampaignCount as any).mockResolvedValue(0);

      await (resolvers.Query as any).campaigns(
        null,
        { first: 9999 },
        context,
      );

      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 101, offset: 0 } }),
      );
    });

    it("Query.campaigns enforces minimum page size of 1", async () => {
      const context = createMockContext();
      (context.contractService.getCampaigns as any).mockResolvedValue([]);
      (context.contractService.getCampaignCount as any).mockResolvedValue(0);

      await (resolvers.Query as any).campaigns(
        null,
        { first: 0 },
        context,
      );

      expect(context.contractService.getCampaigns).toHaveBeenCalledWith(
        expect.objectContaining({ pagination: { limit: 2, offset: 0 } }),
      );
    });

    it("Query.activeCampaigns clamps to 100 and includes N+1 for cursor detection", async () => {
      const context = createMockContext();
      const campaigns = Array(101).fill(null).map((_, i) => sampleCampaign({ id: `camp_${i}` }));
      (context.dataLoader.campaignsByStatus.load as any).mockResolvedValue(campaigns);

      const result = await (resolvers.Query as any).activeCampaigns(
        null,
        { first: 150 },
        context,
      );

      expect(context.dataLoader.campaignsByStatus.load).toHaveBeenCalledWith({
        status: "Active",
        limit: 101,
        afterSortKey: undefined,
        afterId: undefined,
      });
      expect(result.edges.length).toBe(100);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it("Query.contributions returns empty page info for empty results", async () => {
      const context = createMockContext();
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue([]);

      const result = await (resolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1", first: 20 },
        context,
      );

      expect(result.edges).toHaveLength(0);
      expect(result.pageInfo.startCursor).toBeNull();
      expect(result.pageInfo.endCursor).toBeNull();
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("Query.contributions respects first parameter for page size", async () => {
      const context = createMockContext();
      const contributions = Array(30).fill(null).map((_, i) => ({
        id: `contrib_${i}`,
        timestamp: new Date().toISOString(),
        amount: 1000n,
        campaignId: "camp_1",
      }));
      (context.dataLoader.campaignContributions.load as any).mockResolvedValue(contributions);

      const result = await (resolvers.Query as any).contributions(
        null,
        { campaignId: "camp_1", first: 10 },
        context,
      );

      expect(result.edges.length).toBe(10);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("User.campaigns field resolver supports pagination", async () => {
      const context = createMockContext();
      const campaigns = Array(25).fill(null).map((_, i) => sampleCampaign({ id: `camp_${i}` }));
      (context.dataLoader.userCampaigns.load as any).mockResolvedValue(campaigns);

      const result = await (resolvers.User as any).campaigns(
        { address: "GUSER123" },
        { first: 10 },
        context,
      );

      expect(result.edges.length).toBe(10);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(context.dataLoader.userCampaigns.load).toHaveBeenCalledWith("GUSER123");
    });

    it("User.contributions field resolver clamps to maximum page size", async () => {
      const context = createMockContext();
      const contributions = Array(150).fill(null).map((_, i) => ({
        id: `contrib_${i}`,
        timestamp: new Date().toISOString(),
        amount: 1000n,
      }));
      (context.dataLoader.userContributions.load as any).mockResolvedValue(contributions);

      const result = await (resolvers.User as any).contributions(
        { address: "GUSER123" },
        { first: 200 },
        context,
      );

      expect(result.edges.length).toBe(100);
      expect(context.dataLoader.userContributions.load).toHaveBeenCalledWith("GUSER123");
    });
  });
});
