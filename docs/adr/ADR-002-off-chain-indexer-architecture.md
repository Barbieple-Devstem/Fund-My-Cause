# ADR-002: Off-chain indexer architecture

- **Status:** Accepted
- **Date:** 2024-02-10
- **Deciders:** core team

## Context

The Soroban RPC `getEvents` endpoint lets callers query contract events by ledger range, but it is not designed for rich, paginated queries (e.g. "all campaigns by creator", "campaigns sorted by funds raised", "campaigns expiring in the next 24 hours"). Calling the RPC directly from the frontend for every list view would be slow, expensive in terms of RPC quota, and would push complex filtering logic into the browser.

The on-chain registry contract stores campaign contract IDs but does not index metadata — fetching a list of campaigns with full stats requires N separate RPC calls (one per campaign).

## Decision

Run a lightweight off-chain TypeScript indexer daemon (`services/indexer`) that:

1. Polls the Stellar RPC for new ledger events using `getEvents`.
2. Parses and validates events against the published event schema.
3. Persists structured campaign and contribution records to a local database.
4. Exposes this data through a REST API and a GraphQL endpoint for the frontend to consume.

The indexer is **read-only and derived** — it is a projection of on-chain state, not the source of truth. If the database is lost it can be rebuilt by replaying events from genesis.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Off-chain indexer daemon (chosen) | Fast, paginated queries; decouples UI from RPC rate limits; enables full-text and relational queries | Additional infrastructure to operate; introduces eventual consistency lag (typically < 6 s on Stellar) |
| Direct RPC calls from frontend | No extra infrastructure; always up to date | N+1 RPC calls for list views; no sorting/filtering; hits RPC quotas; slow UX |
| Subgraph (The Graph) | Managed hosting; standard tooling | No Stellar/Soroban support; requires EVM-compatible chain |
| On-chain registry with full metadata | Zero infrastructure | Soroban storage is expensive; contract size limits prevent rich metadata; no query flexibility |

## Consequences

**Good:**
- Frontend list views are fast (single indexed query vs. N RPC calls).
- Complex filters and sort orders are possible without smart contract changes.
- RPC quota is consumed only by the indexer, not by every frontend user.
- The indexer can be rebuilt from on-chain history — no permanent data loss.

**Bad / trade-offs:**
- Eventual consistency: indexed data lags on-chain state by up to one ledger close (~5 s).
- The indexer is a new service to deploy, monitor, and keep in sync with the event schema.
- Schema changes in the contract require a coordinated migration in the indexer.

## References

- `services/indexer/` — indexer source
- `docs/event-schema.md` — canonical event definitions consumed by the indexer
- `docs/event-monitoring.md` — alerting on indexer lag
- `docs/runbooks/backend-error-spike.md` — indexer incident runbook
