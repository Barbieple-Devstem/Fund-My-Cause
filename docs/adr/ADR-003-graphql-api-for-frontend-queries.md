# ADR-003: GraphQL API for frontend queries

- **Status:** Accepted
- **Date:** 2024-02-18
- **Deciders:** frontend and backend teams

## Context

The off-chain indexer (ADR-002) needs to expose indexed campaign and contribution data to the Next.js frontend. The frontend has several distinct query shapes: a campaign list page (paginated, filtered by status/creator), a campaign detail page (full stats + top contributors), a dashboard (all campaigns by a wallet address), and a search view. These shapes vary significantly in the fields required, and the set of views is expected to grow.

A traditional REST API would require either many bespoke endpoints (one per view) or over-fetching on a generic endpoint. The frontend team wanted the flexibility to compose queries without waiting for backend changes on every new view.

## Decision

Expose a GraphQL endpoint (`/graphql`) from the indexer service alongside the existing REST API. The frontend uses GraphQL for all read queries against indexed data. Write operations (contributions, withdrawals, refunds) continue to go directly to the Soroban contract via the Stellar RPC — GraphQL is read-only.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| GraphQL read API (chosen) | Frontend selects exactly the fields it needs; single endpoint for all read shapes; easy to add new views without backend changes; introspectable schema | Extra layer of tooling (schema, resolvers, codegen); N+1 resolver risk requires DataLoader; less familiar to some contributors |
| REST with per-view endpoints | Simple, widely understood; easy to cache at CDN | New view = new endpoint; over- or under-fetching; tight frontend/backend coupling |
| REST with a generic query endpoint (filter params) | Flexible filtering | Complex query DSL to maintain; still returns fixed field sets; reinvents much of GraphQL |
| Direct RPC from frontend (no indexer API) | No backend needed for reads | Ruled out in ADR-002 |

## Consequences

**Good:**
- Frontend teams can add new views (e.g. leaderboard, matching dashboard) by writing a new query, not a new API endpoint.
- The schema serves as a contract between frontend and backend; breaking changes are caught at codegen time.
- Over-fetching is eliminated — mobile and low-bandwidth clients only receive the fields they request.

**Bad / trade-offs:**
- GraphQL resolvers must use DataLoader (or equivalent batching) to avoid N+1 database queries on nested fields.
- REST endpoints are retained for simple health-check and webhook consumers that do not need GraphQL.
- Contributors unfamiliar with GraphQL face a steeper onboarding curve than REST.
- Schema changes require coordinated frontend codegen updates.

## References

- `services/indexer/` — GraphQL schema and resolvers
- `docs/event-schema.md` — underlying data model
- `docs/frontend-api.md` — frontend API integration guide
- ADR-002 — off-chain indexer (prerequisite)
