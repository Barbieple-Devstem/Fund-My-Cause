/**
 * Typed client for `services/graphql-api`.
 *
 * Every operation here is bound to types generated from the service's own
 * schema (see `codegen.ts` and `npm run codegen`), so request variables and
 * response shapes are checked at compile time rather than cast to `any` at the
 * call site. If the schema changes and an operation no longer matches, `tsc`
 * fails on the next regeneration.
 *
 * Do not hand-edit `./generated.ts` — regenerate it instead.
 */

import { GraphQLClient } from "graphql-request";
import { getSdk, type Sdk } from "./generated";
import type {
  CampaignDetailQuery,
  CampaignDetailQueryVariables,
} from "./generated";

export const GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_URL ?? "http://localhost:4000";

/** GraphQL endpoint path on the API service. */
const GRAPHQL_ENDPOINT = `${GRAPHQL_URL}/graphql`;

let sdk: Sdk | null = null;

/**
 * Returns the shared, lazily-constructed SDK bound to the graphql-api endpoint.
 *
 * @param headers - Extra headers merged into every request (e.g. auth token).
 */
export function getGraphqlSdk(headers?: Record<string, string>): Sdk {
  if (headers) {
    // Per-request headers: build a throwaway client rather than mutating the
    // shared one, so an authenticated call can't leak its token into others.
    return getSdk(new GraphQLClient(GRAPHQL_ENDPOINT, { headers }));
  }
  sdk ??= getSdk(new GraphQLClient(GRAPHQL_ENDPOINT));
  return sdk;
}

// ── Operations ────────────────────────────────────────────────────────────────

/**
 * The `campaignDetail` payload narrowed to the fields the operation selects.
 * Distinct from the generated schema-level `CampaignDetail`, which carries
 * every field the type could return.
 */
export type CampaignDetailResult = CampaignDetailQuery["campaignDetail"];

/**
 * Fetches a campaign with its contributors, updates and milestones.
 *
 * @param id - Campaign ID.
 * @param headers - Optional per-request headers.
 * @returns The fully typed campaign detail payload.
 * @throws The underlying `graphql-request` ClientError when the API responds
 *   with GraphQL errors or a non-2xx status.
 */
export async function fetchCampaignDetail(
  id: CampaignDetailQueryVariables["id"],
  headers?: Record<string, string>,
): Promise<CampaignDetailResult> {
  const data = await getGraphqlSdk(headers).CampaignDetail({ id });
  return data.campaignDetail;
}

// ── Service health ────────────────────────────────────────────────────────────
// `/status` is a plain REST endpoint on the same service (see
// services/graphql-api/src/index.ts) rather than a GraphQL operation, so it is
// typed by hand here to match that handler's response body.

/** Health levels reported per component and overall. */
export type HealthStatus = "healthy" | "degraded" | "unhealthy";

/** Components the API reports health for, in display order. */
export const HEALTH_COMPONENTS = ["api", "cache", "rpc"] as const;

export type HealthComponent = (typeof HEALTH_COMPONENTS)[number];

export interface ComponentHealth {
  status: HealthStatus;
  latencyMs: number;
}

export interface ApiStatus {
  status: HealthStatus;
  version: string;
  /** Process uptime in seconds. */
  uptime: number;
  timestamp: string;
  components: Record<HealthComponent, ComponentHealth>;
}

/**
 * Reads aggregate service health.
 *
 * @returns The status payload, or `null` if the service is unreachable —
 *   callers render an "unreachable" state rather than failing the page.
 */
export async function fetchApiStatus(): Promise<ApiStatus | null> {
  try {
    const res = await fetch(`${GRAPHQL_URL}/status`, {
      next: { revalidate: 30 },
    });
    if (!res.ok && res.status !== 207) return null;
    return (await res.json()) as ApiStatus;
  } catch {
    return null;
  }
}

export type {
  CampaignDetailQuery,
  CampaignDetailQueryVariables,
} from "./generated";
export type {
  Campaign,
  CampaignStatus,
  Contributor,
  Milestone,
  MilestoneStatus,
  CampaignUpdate,
} from "./generated";
