import { GraphQLError } from "graphql";
import type { IResolvers } from "@graphql-tools/utils";
import { CAMPAIGN_STATUS_VALUES, type CampaignStatus } from "@fund-my-cause/types";
import type { Context, Campaign } from "./types.js";
import { CacheService } from "./services/cache.js";
import { ContractService } from "./services/contract.js";
import { PubSubService } from "./services/pubsub.js";
import { notifyContribution } from "./services/fraud-client.js";
import type { MutationName } from "./services/rate-limiter.js";
import { buildPage, decodeCursor, CursorError } from "./services/cursor-pagination.js";

/**
 * Maps the public GraphQL schema's SCREAMING_CASE enum names (schema.ts)
 * to the canonical internal CampaignStatus values from @fund-my-cause/types
 * (PascalCase, matching the crowdfund contract). Derived programmatically
 * so a new status added to the shared package is picked up automatically
 * instead of silently drifting out of sync — this is the contract test
 * that guards against the bug this resolver map exists to fix.
 */
export const CAMPAIGN_STATUS_ENUM_MAP: Record<string, CampaignStatus> = Object.fromEntries(
  CAMPAIGN_STATUS_VALUES.map((value) => [value.toUpperCase(), value])
);

// ---------------------------------------------------------------------------
// Mutation rate-limit helper (#899)
// ---------------------------------------------------------------------------

/**
 * Enforce per-mutation rate limiting.
 *
 * Uses the authenticated wallet address as the key (one independent bucket per
 * user) with the IP address as a fallback for unauthenticated callers.  Throws
 * a structured GraphQLError with:
 *  - extensions.code   = "TOO_MANY_REQUESTS"
 *  - extensions.retryAfter (seconds until the bucket resets)
 *  - extensions.mutation   (which mutation was limited)
 */
async function enforceMutationRateLimit(
  mutation: MutationName,
  context: Context
): Promise<void> {
  const rateLimiter = (context as any).rateLimiter;
  if (!rateLimiter) return; // not present in test stubs — skip

  const key = context.user?.address ?? (context as any).ip ?? "anonymous";
  try {
    await rateLimiter.checkMutationLimit(mutation, key);
  } catch (error: any) {
    const retryAfter: number = error.retryAfter ?? 60;
    throw new GraphQLError(
      error.message ?? `Rate limit exceeded for mutation '${mutation}'. Retry after ${retryAfter}s.`,
      {
        extensions: {
          code: "TOO_MANY_REQUESTS",
          http: { status: 429 },
          retryAfter,
          mutation,
        },
      }
    );
  }
}

export const resolvers: IResolvers<any, Context> = {
  CampaignStatus: CAMPAIGN_STATUS_ENUM_MAP,

  // Custom scalar resolvers
  BigInt: {
    serialize(value: bigint | string | number) {
      return value.toString();
    },
    parseValue(value: string) {
      return BigInt(value);
    },
    parseLiteral(ast: any) {
      if (ast.kind === "IntValue") {
        return BigInt(ast.value);
      }
      throw new GraphQLError(`Cannot coerce value: ${ast}`);
    },
  },

  DateTime: {
    serialize(value: Date | string) {
      if (typeof value === "string") return value;
      return value.toISOString();
    },
    parseValue(value: string) {
      return new Date(value).toISOString();
    },
    parseLiteral(ast: any) {
      if (ast.kind === "StringValue") {
        return new Date(ast.value).toISOString();
      }
      throw new GraphQLError(`Cannot coerce value: ${ast}`);
    },
  },

  // Query resolvers
  Query: {
    async campaign(_, { id }, context: Context) {
      const cacheKey = `campaign:${id}`;
      const cached = await context.cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const campaign = await context.contractService.getCampaign(id);
      if (!campaign) {
        throw new GraphQLError(`Campaign not found: ${id}`);
      }

      await context.cache.set(cacheKey, campaign, 300); // Cache for 5 minutes
      return campaign;
    },

    async campaigns(
      _,
      { filter, first, after, pagination = { limit: 20, offset: 0 }, sort },
      context: Context
    ) {
      // ---------------------------------------------------------------------------
      // Resolve effective page size and offset.
      //
      // Cursor args (first / after) take precedence over the legacy offset-based
      // PaginationInput.  When a cursor is supplied we decode it to extract the
      // last-seen sortKey so the database layer can apply a keyset filter.
      // ---------------------------------------------------------------------------
      const pageSize = first ?? pagination.limit ?? 20;
      const clampedSize = Math.max(1, Math.min(pageSize, 100));

      // Decode the `after` cursor if provided.  An invalid cursor is a client
      // error — surface it as a BAD_USER_INPUT so the caller gets a clear message.
      let afterSortKey: string | undefined;
      let afterId: string | undefined;
      if (after) {
        try {
          const decoded = decodeCursor(after);
          afterSortKey = decoded.sortKey;
          afterId = decoded.id;
        } catch (err) {
          if (err instanceof CursorError) {
            throw new GraphQLError(`Invalid pagination cursor: ${err.message}`, {
              extensions: { code: "BAD_USER_INPUT" },
            });
          }
          throw err;
        }
      }

      // Use offset from legacy input when no cursor is present.
      const legacyOffset = after ? 0 : (pagination.offset ?? 0);

      const cacheKey = `campaigns:${JSON.stringify({ filter, first: clampedSize, after, legacyOffset, sort })}`;
      const cached = await context.cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      // Fetch one extra item so we can determine hasNextPage without a separate
      // COUNT query.  This is the standard "fetch N+1" cursor-pagination trick.
      const campaigns = await context.contractService.getCampaigns({
        filter,
        pagination: { limit: clampedSize + 1, offset: legacyOffset },
        sort,
      });

      const hasNextPage = campaigns.length > clampedSize;
      const hasPreviousPage = after ? true : legacyOffset > 0;
      const pageItems: Campaign[] = campaigns.slice(0, clampedSize);

      // Build cursor-paginated response using the cursor-pagination service.
      // Sort key is createdAt (ISO string) which gives stable ordering;
      // the opaque id ties-breaks duplicate timestamps.
      const pageResult = buildPage(
        pageItems,
        (c) => c.id,
        (c) => c.createdAt,
        hasNextPage,
        hasPreviousPage,
      );

      const result = {
        ...pageResult,
        totalCount: await context.contractService.getCampaignCount(filter),
      };

      await context.cache.set(cacheKey, result, 600); // Cache for 10 minutes
      return result;
    },

    async activeCampaigns(_, { limit = 20 }, context: Context) {
      return context.dataLoader.campaignsByStatus.load({ status: "Active", limit });
    },

    async trendingCampaigns(_, { limit = 10 }, context: Context) {
      const cacheKey = `trending:${limit}`;
      const cached = await context.cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const campaigns = await context.contractService.getTrendingCampaigns(limit);
      await context.cache.set(cacheKey, campaigns, 1800); // Cache for 30 minutes
      return campaigns;
    },

    async searchCampaigns(_, { query, limit = 20 }, context: Context) {
      return context.contractService.searchCampaigns(query, limit);
    },

    async campaignDetail(_, { id }, context: Context) {
      const campaign = await context.dataLoader.campaigns.load(id);

      if (!campaign) {
        throw new GraphQLError(`Campaign not found: ${id}`);
      }

      const [contributors, updates, milestones] = await Promise.all([
        context.dataLoader.campaignContributors.load(id),
        context.dataLoader.campaignUpdates.load(id),
        context.dataLoader.campaignMilestones.load(id),
      ]);

      return {
        campaign,
        contributors,
        updates,
        milestones,
      };
    },

    async contribution(_, { id }, context: Context) {
      return context.dataLoader.contributions.load(id);
    },

    async contributions(_, { campaignId, contributor }, context: Context) {
      if (campaignId) {
        return context.dataLoader.campaignContributions.load(campaignId);
      }

      if (contributor) {
        return context.dataLoader.userContributions.load(contributor);
      }

      throw new GraphQLError("Either campaignId or contributor must be provided");
    },

    async user(_, { address }, context: Context) {
      const cacheKey = `user:${address}`;
      const cached = await context.cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const user = await context.contractService.getUser(address);
      if (!user) {
        throw new GraphQLError(`User not found: ${address}`);
      }

      await context.cache.set(cacheKey, user, 600); // Cache for 10 minutes
      return user;
    },

    async userContributions(_, { address }, context: Context) {
      return context.dataLoader.userContributions.load(address);
    },

    async stats(_, __, context: Context) {
      const cacheKey = "platform:stats";
      const cached = await context.cache.get(cacheKey);

      if (cached) {
        return cached;
      }

      const stats = await context.contractService.getStats();
      await context.cache.set(cacheKey, stats, 1800); // Cache for 30 minutes
      return stats;
    },
  },

  // Campaign field resolvers
  Campaign: {
    percentageFunded(campaign) {
      if (campaign.goal === 0n) return 0;
      return Number((campaign.raised * 100n) / campaign.goal);
    },

    daysRemaining(campaign) {
      const now = Date.now();
      const deadline = new Date(campaign.deadline).getTime();
      return Math.max(0, Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)));
    },
  },

  // CampaignDetail field resolvers
  CampaignDetail: {
    topContributors(parent, { limit = 10 }) {
      return parent.contributors
        .sort((a: any, b: any) => Number(b.amount - a.amount))
        .slice(0, limit)
        .map((contributor: any, index: number) => ({
          rank: index + 1,
          address: contributor.address,
          amount: contributor.amount,
          percentage: Number(
            (contributor.amount * 100n) /
              parent.campaign.raised
          ),
        }));
    },
  },

  // User field resolvers
  User: {
    async campaigns(user, _, context: Context) {
      return context.dataLoader.userCampaigns.load(user.address);
    },

    async contributions(user, _, context: Context) {
      return context.dataLoader.userContributions.load(user.address);
    },
  },

  // Subscription resolvers
  Subscription: {
    campaignUpdated: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`campaign_updated:${id}`]);
      },

      resolve(payload: any) {
        return payload;
      },
    },

    campaignStatusChanged: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`campaign_status:${id}`]);
      },

      resolve(payload: any) {
        return payload;
      },
    },

    newContribution: {
      subscribe(_, { campaignId }, context: Context) {
        return context.pubsub.asyncIterator([`contribution:${campaignId}`]);
      },

      resolve(payload: any) {
        return payload;
      },
    },

    campaignProgressChanged: {
      subscribe(_, { id }, context: Context) {
        return context.pubsub.asyncIterator([`progress:${id}`]);
      },

      resolve(payload: any) {
        return payload;
      },
    },

    milestoneReached: {
      subscribe(_, { campaignId }, context: Context) {
        return context.pubsub.asyncIterator([`milestone:${campaignId}`]);
      },

      resolve(payload: any) {
        return payload;
      },
    },
  },

  // Mutation resolvers
  Mutation: {
    async authenticate(_, { signature, message, address }, context: Context) {
      const verified = await context.contractService.verifySignature(
        address,
        message,
        signature
      );

      if (!verified) {
        throw new GraphQLError("Invalid signature");
      }

      const token = context.authService.generateToken(address);
      const user = await context.contractService.getUser(address);

      return {
        token,
        user,
      };
    },

    async createCampaign(_, { input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }

      // Rate-limit: 5 campaign creations per wallet per hour (#899)
      await enforceMutationRateLimit("createCampaign", context);

      const campaign = await context.contractService.createCampaign(
        context.user,
        input
      );

      // Invalidate cache
      await context.cache.del("campaigns:*");
      await context.cache.del("trending:*");

      return campaign;
    },

    async updateCampaign(_, { id, input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }

      const campaign = await context.contractService.updateCampaign(
        id,
        context.user,
        input
      );

      // Invalidate cache
      await context.cache.del(`campaign:${id}`);
      await context.cache.del("campaigns:*");

      // Publish update
      await context.pubsub.publish(`campaign_updated:${id}`, campaign);

      return campaign;
    },

    async recordContribution(_, { input }, context: Context) {
      if (!context.user) {
        throw new GraphQLError("Authentication required");
      }

      // Rate-limit: 20 contributions per wallet per 10 minutes (#899)
      await enforceMutationRateLimit("recordContribution", context);

      const { traceId, log } = context;

      log.info(
        {
          campaignId: input.campaignId,
          contributor: input.contributor,
          amount: input.amount.toString(),
          txHash: input.transactionHash,
        },
        "recordContribution: started",
      );

      const contribution = await context.contractService.recordContribution(input);

      log.info(
        { contributionId: contribution.id, campaignId: input.campaignId },
        "recordContribution: contract call succeeded",
      );

      // ── Notify fraud-detection (best-effort, never blocks the response) ──
      // X-Trace-ID is forwarded inside notifyContribution so the same trace ID
      // appears in fraud-detection logs for this donation.
      void notifyContribution(
        {
          campaignId: input.campaignId,
          contributor: input.contributor,
          amount: input.amount.toString(),
          transactionHash: input.transactionHash,
          timestamp: Math.floor(Date.now() / 1000),
        },
        traceId,
        log,
      );

      // Invalidate caches
      await context.cache.del(`campaign:${input.campaignId}`);
      await context.cache.del("platform:stats");
      await context.cache.del(`user:${input.contributor}`);

      // Publish events
      await context.pubsub.publish(
        `contribution:${input.campaignId}`,
        contribution,
      );

      // Update progress
      const campaign = await context.contractService.getCampaign(
        input.campaignId,
      );
      if (campaign) {
        await context.pubsub.publish(`progress:${input.campaignId}`, {
          campaignId: input.campaignId,
          raised: campaign.raised,
          percentageFunded: Number((campaign.raised * 100n) / campaign.goal),
          contributors: campaign.totalContributors,
          daysRemaining: Math.max(
            0,
            Math.ceil(
              (new Date(campaign.deadline).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24),
            ),
          ),
          timestamp: new Date().toISOString(),
        });
      }

      log.info(
        { contributionId: contribution.id, campaignId: input.campaignId },
        "recordContribution: completed",
      );

      return contribution;
    },
  },
};
