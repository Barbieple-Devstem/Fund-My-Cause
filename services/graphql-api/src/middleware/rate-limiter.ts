import { GraphQLError } from "graphql";
import type { RateLimiterService } from "../services/rate-limiter.js";
import type { Context } from "../types.js";

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyPrefix?: string;
  scope?: "ip" | "user" | "operation";
}

/**
 * Isolated rate-limiting middleware for GraphQL mutations.
 * Evaluates incoming requests against rate limits before passing control
 * to mutation resolvers without requiring a full running Apollo server stack.
 */
export function createRateLimitMiddleware(
  rateLimiter: RateLimiterService,
  options: RateLimitOptions = {}
) {
  const { scope = "ip", keyPrefix = "gql_mutation" } = options;

  return async (
    resolver: (parent: any, args: any, context: Context, info: any) => Promise<any>,
    parent: any,
    args: any,
    context: Context,
    info: any
  ) => {
    const operationName = info?.fieldName || "mutation";
    const ip = (context as any)?.req?.ip || (context as any)?.ip || "127.0.0.1";
    const userAddress = context?.user?.address;

    try {
      if (scope === "user") {
        if (!userAddress) {
          throw new GraphQLError("UNAUTHENTICATED", {
            extensions: { code: "UNAUTHENTICATED", http: { status: 401 } },
          });
        }
        await rateLimiter.checkUserLimit(userAddress);
      } else if (scope === "ip") {
        await rateLimiter.checkIpLimit(ip);
      } else {
        const key = `${keyPrefix}:${operationName}:${userAddress || ip}`;
        await rateLimiter.checkRequestLimit(key);
      }
    } catch (error: any) {
      if (error instanceof GraphQLError) {
        throw error;
      }
      const retryAfter = error.retryAfter || 60;
      throw new GraphQLError(`Rate limit exceeded for mutation '${operationName}'. Retry after ${retryAfter}s`, {
        extensions: {
          code: "TOO_MANY_REQUESTS",
          http: { status: 429 },
          retryAfter,
          operationName,
        },
      });
    }

    return resolver(parent, args, context, info);
  };
}
