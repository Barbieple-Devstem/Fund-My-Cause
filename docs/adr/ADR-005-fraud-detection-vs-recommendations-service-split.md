# ADR-005: Keeping `fraud_detection` and `recommendations` as separate services

- **Status:** Proposed
- **Date:** 2026-07-25
- **Deciders:** owners of `backend/fraud_detection`, owners of `backend/recommendations`

## Context

`backend/fraud_detection` and `backend/recommendations` are two FastAPI services that landed in the same commit — `baed004` (2026-06-24, "feat: implement #634 #635 #636 #637") — as part of one batch of backend work. Because they arrived together and both nominally read "indexed campaign and contribution activity", a concern was raised that they overlap in data access and should perhaps be merged or share a data layer.

That concern was based on an assumption about the code rather than the code itself. This ADR records what is actually there, so the split is decided on evidence.

### Correcting the record: there is no data-access overlap, because neither service has a data-access layer

The overlap claim requires both services to read the same data source. Neither service reads *any* data source. Both operate purely on module-level in-process Python objects, and in both cases the only code in the repository that ever writes to those objects is the service's own test suite.

**`backend/recommendations/service.py` is a pre-integration stub.** Its campaign data is a hardcoded literal:

- `service.py:62-68` — `_CAMPAIGNS` is a list of five `Campaign` objects written inline in the source ("Open-Source Wallet", "Community Garden", "Stellar SDK Docs", "Local Music Festival", "Solar Panels for Schools"), with hardcoded amounts and contributor counts.
- `service.py:70` — `_ACTIVITY` is an empty `dict` populated only by `tests_service.py:51` and `tests_service.py:68`.
- The section is explicitly labelled in the source: `# Stub data store (replace with real DB / Horizon indexer in production)` (`service.py:59-61`).

Consequently the service has **no error handling at all** — not as an oversight, but because nothing in it can fail. There is no connection to drop, no query to time out, and no deserialisation to reject. `_recommend` cannot raise.

**`backend/fraud_detection/pipeline.py` is real, working logic on empty inputs.** This is the part most often misread. Its three heuristics — `scan_wash_contributions`, `scan_contribution_spikes`, `scan_duplicate_content` — are genuine implementations with real algorithms (windowed refund correlation, rolling-window spike detection, token-level Jaccard similarity), covered by `tests_pipeline.py`. That logic is not a stub.

Its *inputs*, however, are:

- `pipeline.py:110-112` — `_CONTRIBUTIONS`, `_REFUNDS`, and `_CAMPAIGN_RECORDS` are empty lists.
- The section header says so: `# Indexed event store (populated by indexer; stubbed here)` (`pipeline.py:85-86`).
- No code path in the repository appends to them. There is no ingestion endpoint, no indexer client, no subscriber. The only writers are `tests_pipeline.py:47-71`.

So `POST /scan` against a running instance is well-defined and always produces zero flags, because it scans three empty lists.

The accurate distinction between the two services is therefore **not** "one is live and one is a stub". It is:

| | `fraud_detection` | `recommendations` |
|---|---|---|
| Domain logic | Implemented and tested (3 heuristics) | Implemented and tested (trending + personalised scoring) |
| Data-access layer | **None** — empty in-process lists | **None** — hardcoded in-process literals |
| Behaviour when run as shipped | Returns zero flags (empty inputs) | Returns 5 seeded campaigns (hardcoded inputs) |
| Error handling | Minimal — a 404 on unknown flag ID | None — nothing can fail |
| Wired into deployment | No — absent from `docker-compose.full.yml` | No — absent from `docker-compose.full.yml` |

Both are pre-integration. Neither is deployed: neither appears in `docker-compose.full.yml`, and neither is mentioned in `docs/backend-architecture.md`. (`backend/Dockerfile` is a Node image — `FROM node:18-alpine`, `npm ci`, `npm start` — in a directory containing only Python services, and cannot build either of them. It is stale and unrelated to both.)

**The real risk is prospective, not present.** There is nothing to de-duplicate today. What matters is what happens when each service is wired to a real data source — if that happens independently, the two will invent two different data-access patterns for the same underlying event stream, and the overlap the original concern imagined will be created rather than discovered.

## Decision

1. **`fraud_detection` and `recommendations` remain separate services.** They have different consumers (internal moderators vs. end users), different latency profiles (batch scans vs. per-request reads), and different failure tolerances (a stalled fraud scan is an internal backlog; a failed recommendation call degrades a user-facing page). There is no shared data-access code to consolidate, so merging them would trade those independent profiles for no deduplication benefit.
2. **Neither service is presented as production-ready in any documentation, dashboard, or deployment manifest until it has a real data-access layer.** `fraud_detection`'s heuristics being genuinely implemented must not be read as the service being operational — it scans empty lists.
3. **When `recommendations` gains real I/O, it adopts the data-access pattern below rather than inventing its own or copying `fraud_detection`'s in-process lists.** The in-memory store in `fraud_detection` is a placeholder, not a reference implementation, and must not be propagated.

### Data-access pattern for `recommendations`' future I/O work

Recorded now, while the service is still a stub and the choice is free.

- **Read from the indexer, not from Soroban RPC directly.** Recommendation scoring needs aggregate campaign activity across many campaigns; per-request contract calls do not scale to that shape. This is the same reasoning as ADR-002.
- **Isolate all I/O behind a repository interface** — something like `CampaignRepository` with `list_campaigns()` and `get_activity(wallet)` — and keep `_trending_score`, `_personalised_score`, and `_recommend` pure functions over the returned data. They already are; the point is to keep them that way, so the current tests continue to work against an in-memory fake rather than being rewritten around a live source.
- **Keep the existing TTL cache in front of the repository, not behind it.** `_CACHE`/`CACHE_TTL_SECONDS` (`service.py:22-34`) is already keyed per `(wallet, limit)`. Once reads hit the network, that cache becomes the thing bounding load, so it should wrap the I/O rather than sit inside it.
- **Add error handling at the repository boundary when, and only when, I/O is introduced.** A data-source failure should degrade to cold-start trending output or a stale cache entry, not a 500 — recommendations are advisory, and an empty carousel is better than an error page. There is deliberately nothing to do here today.
- **Do not replicate `fraud_detection`'s module-level mutable globals.** They are the main thing in these two services that should not be copied.

### What would trigger revisiting this decision

This ADR should be superseded if any of the following becomes true:

- **Both services are wired to the same data source** and end up with materially similar read paths — at which point a shared client library (not a merged service) becomes worth extracting.
- **`recommendations` needs fraud signals as a scoring input** — for example suppressing flagged campaigns from recommendations. This is a plausible product requirement and would create the first genuine coupling. Prefer an API call between the services over a shared data layer.
- **`fraud_detection` gains a real ingestion path** and its in-memory `_QUEUE` moderation store needs durability, forcing a persistence decision that `recommendations` would also face.
- **Either service is deployed for real**, which will require resolving the stale Node `backend/Dockerfile` and adding compose/manifest entries — a natural checkpoint to re-examine the boundary.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Keep both services separate (chosen) | Preserves distinct consumers, latency profiles, and failure tolerances; no shared code exists to consolidate; records the future data-access pattern before divergence can occur | Two services to deploy and monitor; the pattern above is guidance, not enforcement |
| Merge into one backend service | One deployment; guaranteed single data-access path | Couples a user-facing read path to batch fraud scans; the premise for merging — existing overlap — is factually absent |
| Extract a shared data-access library now | Would prevent future divergence by construction | Nothing to extract: neither service has a data-access layer, so the library would be designed against two sets of hardcoded literals and would almost certainly be wrong |
| Leave the boundary undocumented | No work | The "overlap" misreading has already cost review time once; it recurs without a written record |

## Consequences

**Good:**
- The false overlap narrative is corrected with specific line references, so the next reviewer does not re-derive it or act on it.
- `fraud_detection`'s status is stated precisely — real heuristics, empty inputs — rather than as either "working" or "a stub", both of which mislead.
- `recommendations` has a data-access pattern to follow, recorded while changing course is still free.
- The re-evaluation triggers are concrete, so a future reviewer can check them rather than re-litigate the split.

**Bad / trade-offs:**
- The pattern is written guidance, not an enforced interface. Nothing prevents `recommendations` from being wired up differently; this ADR is the only check.
- Recording a data-access decision for I/O that does not exist risks being wrong once the real indexer schema is known. It is deliberately scoped to shape (repository boundary, cache placement, pure scoring functions) rather than to specific queries.
- Keeping two services means two deployments once either is productionised, including the unresolved `backend/Dockerfile` problem, which this ADR notes but does not fix.
- The decision to keep them separate rests on their intended consumers, since their current implementations are too thin to argue from. If those intentions change, the rationale weakens.

## References

- `backend/recommendations/service.py:59-70` — the hardcoded stub data store and empty `_ACTIVITY`; the primary evidence that no data-access layer exists
- `backend/recommendations/service.py:22-34` — the TTL cache referenced in the pattern above
- `backend/fraud_detection/pipeline.py:85-112` — `# Indexed event store (populated by indexer; stubbed here)` and the three empty input lists
- `backend/fraud_detection/pipeline.py:128-222` — the three implemented heuristics
- `backend/fraud_detection/tests_pipeline.py:47-71`, `backend/recommendations/tests_service.py:51-68` — the only writers to either service's stores
- `docs/fraud-detection-heuristics.md` — threshold tuning guide for the heuristics
- Commit `baed004` — the commit that created both services
- ADR-002 — off-chain indexer architecture, the basis for reading via the indexer rather than RPC
- [Issue #860](https://github.com/Fund-My-Cause/Fund-My-Cause/issues/860) — this ADR
