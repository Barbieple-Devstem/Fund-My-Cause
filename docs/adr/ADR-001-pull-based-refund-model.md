# ADR-001: Pull-based refund model

- **Status:** Accepted
- **Date:** 2024-01-15
- **Deciders:** core contract team

## Context

When a campaign fails to meet its goal by the deadline, all contributors are entitled to a full refund. Two models exist for delivering those refunds: push (the contract iterates all contributors and sends money back) and pull (each contributor calls the contract to claim their own refund).

Soroban enforces hard per-transaction CPU, memory, and instruction limits. A campaign with thousands of contributors cannot be refunded in a single transaction under the push model — the transaction will be rejected before it completes. Additionally, a single failed sub-transfer (e.g. a closed account) aborts the entire transaction under a push model, blocking every other contributor.

## Decision

Adopt a pull-based refund model. Each contributor calls `refund_single(contributor)` to claim their own refund as an independent transaction. The contract verifies eligibility, transfers the stored amount, and zeroes the contributor's balance.

## Alternatives considered

| Option | Pros | Cons |
|--------|------|------|
| Pull-based — `refund_single` per contributor (chosen) | Scales to any number of contributors; one failure is isolated; no griefing vector | Contributors must actively claim; unclaimed refunds require TTL / expiry handling |
| Push-based — single `refund_all` loop | Simple UX; contributor does nothing | Fails at scale due to Soroban instruction limits; one bad address blocks everyone; griefing vector |
| Batched push — loop N contributors per call | Better than full push | Still has a ceiling; requires off-chain orchestration to drive batches; complex retry logic |

## Consequences

**Good:**
- The contract is unbounded in the number of contributors it can support.
- Each refund is an atomic, independent transaction; failures are isolated.
- No single malicious or broken contributor can block others.

**Bad / trade-offs:**
- Contributors must initiate a transaction to receive their refund — passive contributors do not receive funds automatically.
- The frontend and SDK must surface a clear "claim refund" flow so contributors are not confused.
- Unclaimed contributions remain locked in the contract until claimed; a future TTL / contract expiry policy will be needed.

## References

- `contracts/crowdfund/src/lib.rs` — `refund_single` implementation
- `docs/refund-model.md` — extended explanation with code examples
