[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / FmcClient

# Class: FmcClient

Defined in: [sdks/js/src/client.ts:71](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L71)

Typed client for a **single** Fund-My-Cause crowdfund campaign contract.

One instance is bound to one campaign, fixed by [FmcClientConfig.contractId](../interfaces/FmcClientConfig.md#contractid)
at construction. To read across campaigns, discover their contract IDs with
[FmcRegistryClient](FmcRegistryClient.md) and construct one `FmcClient` per campaign.

Methods fall into two groups:

- **View methods** simulate the call and never submit a transaction, so they
  need no wallet, cost no fees, and change no state.
- **Write methods** build, sign (via the caller-supplied `signTx` callback),
  submit, and then poll for confirmation. Each resolves only once the
  transaction has succeeded on-chain.

Amounts are exposed in XLM as `number` for convenience; the raw stroop values
are also returned where precision matters (`raisedStroops`, `goalStroops`, …).
Conversion helpers are exported separately as `xlmToStroops` / `stroopsToXlm`.

## Example

```ts
const client = new FmcClient({
  contractId:        "C...",
  rpcUrl:            "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  horizonUrl:        "https://horizon-testnet.stellar.org",
});

const stats = await client.getStats();
console.log(`${stats.raisedXlm} / ${stats.goalXlm} XLM`);
```

## See

[FmcRegistryClient](FmcRegistryClient.md) for discovering campaign contract IDs.

## Constructors

### Constructor

> **new FmcClient**(`config`): `FmcClient`

Defined in: [sdks/js/src/client.ts:88](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L88)

Creates a client bound to one campaign contract.

The constructor performs no network I/O and does not validate that
`contractId` exists — an invalid or non-campaign contract ID surfaces as an
error on the first method call, not here.

#### Parameters

##### config

[`FmcClientConfig`](../interfaces/FmcClientConfig.md)

Campaign contract ID plus the RPC, Horizon, and network
passphrase to reach it. The passphrase must match the network the RPC and
Horizon URLs point at, or signatures will be rejected on submission.

#### Returns

`FmcClient`

## Methods

### getStats()

> **getStats**(): `Promise`\<[`CampaignStats`](../interfaces/CampaignStats.md)\>

Defined in: [sdks/js/src/client.ts:174](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L174)

Fetches live funding metrics for the campaign.

Calls the contract's `get_stats`. Amounts are returned both in XLM
(`raisedXlm`, `goalXlm`) and in raw stroops (`raisedStroops`,
`goalStroops`); the contract's `progress_bps` is converted from basis
points to a percentage.

`progressPercent` can exceed 100 when a matching pool has contributed
beyond the goal — do not assume it is capped when driving a progress bar.

#### Returns

`Promise`\<[`CampaignStats`](../interfaces/CampaignStats.md)\>

The campaign's current funding statistics.

#### Throws

If the contract rejects the call.

***

### getCampaignInfo()

> **getCampaignInfo**(): `Promise`\<[`CampaignInfo`](../interfaces/CampaignInfo.md)\>

Defined in: [sdks/js/src/client.ts:204](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L204)

Fetches the campaign's full metadata snapshot.

Calls the contract's `get_campaign_info`. This is the configuration set at
initialization — creator, token, goal, deadline, contribution bounds,
title, description, status, category, and platform fee — rather than live
funding progress, which is [FmcClient.getStats](#getstats)'s job.

`deadline` is converted from the contract's Unix seconds to a `Date`.

#### Returns

`Promise`\<[`CampaignInfo`](../interfaces/CampaignInfo.md)\>

The campaign's metadata and configuration.

#### Throws

If the contract rejects the call.

***

### getPerformanceMetrics()

> **getPerformanceMetrics**(): `Promise`\<[`PerformanceMetrics`](../interfaces/PerformanceMetrics.md)\>

Defined in: [sdks/js/src/client.ts:241](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L241)

Fetches derived performance and velocity metrics for the campaign.

Calls the contract's `get_performance_metrics`. These are computed on-chain
from contribution history: success rate, contribution velocity, a trend
indicator (positive means accelerating), milestone progress, and elapsed
and projected times.

`estimatedSecondsToGoal` is a projection from current velocity, not a
commitment — treat it as a hint, and expect large values when velocity is
near zero.

#### Returns

`Promise`\<[`PerformanceMetrics`](../interfaces/PerformanceMetrics.md)\>

The campaign's performance metrics, with durations in seconds and
amounts converted to XLM.

#### Throws

If the contract rejects the call.

***

### getContribution()

> **getContribution**(`address`): `Promise`\<`number`\>

Defined in: [sdks/js/src/client.ts:269](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L269)

Returns the total amount one address has contributed to this campaign.

Calls the contract's `contribution`. The result is the address's running
total across all its contributions, not its most recent one.

#### Parameters

##### address

`string`

Stellar account address (`G...`) to look up.

#### Returns

`Promise`\<`number`\>

The address's total contribution in XLM. Returns `0` for an
address that has never contributed — this is not an error, so use
[FmcClient.isContributor](#iscontributor) to distinguish "never contributed" from
"contributed zero".

#### Throws

If the contract rejects the call.

#### Throws

If `address` is not a valid Stellar address.

***

### getContributionHistory()

> **getContributionHistory**(`address`): `Promise`\<[`ContributionRecord`](../interfaces/ContributionRecord.md)[]\>

Defined in: [sdks/js/src/client.ts:291](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L291)

Returns one address's itemised contribution history.

Calls the contract's `get_contribution_history`. Each record carries the
individual amount, its timestamp, and the running total after that
contribution — so the last record's `runningTotalXlm` matches what
[FmcClient.getContribution](#getcontribution) returns.

This method is not paginated: the contract returns the full history in one
call, which grows with the number of contributions the address has made.

#### Parameters

##### address

`string`

Stellar account address (`G...`) to look up.

#### Returns

`Promise`\<[`ContributionRecord`](../interfaces/ContributionRecord.md)[]\>

The address's contributions in contract order, with amounts in XLM
and timestamps as `Date`s. Empty for an address that has never contributed.

#### Throws

If the contract rejects the call.

#### Throws

If `address` is not a valid Stellar address.

***

### isContributor()

> **isContributor**(`address`): `Promise`\<`boolean`\>

Defined in: [sdks/js/src/client.ts:315](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L315)

Reports whether an address has contributed to this campaign.

Calls the contract's `is_contributor`. Cheaper than
[FmcClient.getContribution](#getcontribution) when you only need membership — for
example to decide whether to offer a refund action.

#### Parameters

##### address

`string`

Stellar account address (`G...`) to check.

#### Returns

`Promise`\<`boolean`\>

`true` if the address has contributed at least once.

#### Throws

If the contract rejects the call.

#### Throws

If `address` is not a valid Stellar address.

***

### listContributors()

> **listContributors**(`opts`): `Promise`\<`string`[]\>

Defined in: [sdks/js/src/client.ts:334](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L334)

Lists contributor addresses, one page at a time.

Calls the contract's `contributor_list`. Pagination is mandatory — there is
no unpaginated variant, because the full list is unbounded. Advance by
increasing `offset` until a page comes back shorter than `limit`.

#### Parameters

##### opts

[`ListContributorsOptions`](../interfaces/ListContributorsOptions.md)

`offset` (0-based index to start from) and `limit` (maximum
addresses to return). Both are sent as `u32`, so both must be non-negative
integers.

#### Returns

`Promise`\<`string`[]\>

Up to `limit` contributor addresses. A short or empty page means
the end of the list has been reached.

#### Throws

If the contract rejects the call — including
when `limit` exceeds the contract's per-page maximum.

***

### getMatchingConfig()

> **getMatchingConfig**(): `Promise`\<[`MatchingConfig`](../interfaces/MatchingConfig.md) \| `null`\>

Defined in: [sdks/js/src/client.ts:355](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L355)

Fetches the campaign's matching-pool configuration, if one is set up.

Calls the contract's `get_matching_config`. A matching pool lets a sponsor
commit to matching contributions at `matchRatioBps` basis points, up to
`maxMatchXlm`.

#### Returns

`Promise`\<[`MatchingConfig`](../interfaces/MatchingConfig.md) \| `null`\>

The active matching configuration, or `null` when no sponsor has
called [FmcClient.setupMatching](#setupmatching). Check for `null` before reading
[FmcClient.getTotalMatched](#gettotalmatched) or [FmcClient.getMatchingPool](#getmatchingpool),
which both return `0` in that case and are indistinguishable from an
exhausted pool.

#### Throws

If the contract rejects the call.

***

### getTotalMatched()

> **getTotalMatched**(): `Promise`\<`number`\>

Defined in: [sdks/js/src/client.ts:378](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L378)

Returns how much the matching sponsor has paid out so far.

Calls the contract's `get_total_matched`. This is money already committed
to the campaign, and is included in [FmcClient.getStats](#getstats)'s
`raisedXlm` — do not add the two together.

#### Returns

`Promise`\<`number`\>

Total matched to date in XLM. `0` when no matching pool exists;
use [FmcClient.getMatchingConfig](#getmatchingconfig) to tell that apart from a pool that
simply has not matched anything yet.

#### Throws

If the contract rejects the call.

***

### getMatchingPool()

> **getMatchingPool**(): `Promise`\<`number`\>

Defined in: [sdks/js/src/client.ts:395](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L395)

Returns the matching funds still available to be paid out.

Calls the contract's `get_matching_pool`. This is the sponsor's remaining
commitment — `maxMatchXlm` minus [FmcClient.getTotalMatched](#gettotalmatched) — so it
only decreases as contributions are matched.

#### Returns

`Promise`\<`number`\>

Remaining unspent matching pool in XLM. `0` means either no pool
exists or it has been fully consumed; [FmcClient.getMatchingConfig](#getmatchingconfig)
distinguishes the two.

#### Throws

If the contract rejects the call.

***

### contribute()

> **contribute**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:424](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L424)

Pledges tokens to the campaign.

Calls the contract's `contribute`, signed by the contributor. `amountXlm`
is converted to stroops by rounding to the nearest stroop, so amounts with
more than 7 decimal places are not represented exactly.

The transaction is submitted and polled to completion, so this resolves
only after the contribution is confirmed on-chain.

#### Parameters

##### opts

[`ContributeOptions`](../interfaces/ContributeOptions.md)

Contributor address, amount in XLM, the token contract ID to
pay with, an optional public message, and the wallet `signTx` callback.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the contribution — for
example the campaign has ended (`#2`), is not active (`#7`), the amount is
below the minimum (`#9`) or would exceed the per-contributor cap (`#14`),
the token is not accepted (`#13`), the address is blacklisted (`#16`) or
not whitelisted (`#15`), or the message exceeds 256 characters (`#26`).

#### Throws

If the contributor's account cannot be loaded from Horizon,
if `signTx` rejects, or if the transaction is not confirmed within the
polling window (~30s).

***

### withdraw()

> **withdraw**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:453](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L453)

Withdraws the raised funds to the campaign creator.

Calls the contract's `withdraw`, signed by the creator. Only the creator
may call this, and only once the campaign has succeeded — the goal was met
and the deadline has passed. If a platform fee is configured, it is
deducted on-chain before the payout.

#### Parameters

##### opts

[`WithdrawOptions`](../interfaces/WithdrawOptions.md)

Creator address and the wallet `signTx` callback.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the withdrawal — for
example the caller is not the creator (`#39`), the campaign is still active
(`#3`), the goal was not reached (`#4`), or funds have already been
withdrawn.

#### Throws

If the creator's account cannot be loaded from Horizon, if
`signTx` rejects, or if the transaction is not confirmed within the polling
window (~30s).

***

### refundSingle()

> **refundSingle**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:478](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L478)

Claims a refund for one contributor.

Calls the contract's `refund_single`, signed by the contributor. Refunds
follow a pull-based model: each contributor claims their own, and there is
no bulk refund. Available once the campaign has failed — the deadline
passed without the goal being met — or after it was cancelled.

#### Parameters

##### opts

[`RefundOptions`](../interfaces/RefundOptions.md)

Contributor address and the wallet `signTx` callback. An
address can only refund itself; passing someone else's fails authorization.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the refund — for example
the campaign is still active (`#3`), the goal was reached so refunds are
unavailable (`#5`), the address never contributed, or it has already been
refunded.

#### Throws

If the contributor's account cannot be loaded from Horizon,
if `signTx` rejects, or if the transaction is not confirmed within the
polling window (~30s).

#### See

[ADR-001 — pull-based refund model](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/docs/adr/ADR-001-pull-based-refund-model.md)
for why refunds are claimed individually rather than pushed in bulk.

***

### cancelCampaign()

> **cancelCampaign**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:503](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L503)

Cancels the campaign.

Calls the contract's `cancel_campaign`, signed by the creator. Cancelling
stops further contributions and makes every contributor eligible to claim a
refund via [FmcClient.refundSingle](#refundsingle). It does **not** refund anyone
automatically — refunds remain pull-based.

This is irreversible.

#### Parameters

##### opts

[`CancelOptions`](../interfaces/CancelOptions.md)

Creator address and the wallet `signTx` callback.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the cancellation — for
example the caller is not the creator (`#39`), or the campaign is not in an
active state (`#7`) because it already completed or was cancelled.

#### Throws

If the creator's account cannot be loaded from Horizon, if
`signTx` rejects, or if the transaction is not confirmed within the polling
window (~30s).

***

### setupMatching()

> **setupMatching**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:526](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L526)

Sets up a matching pool, funded by a sponsor.

Calls the contract's `setup_matching`, signed by the sponsor. Once
configured, contributions are matched at `matchRatioBps` basis points until
`maxMatchXlm` is exhausted — for example `matchRatioBps: 5000` matches 50%
of each contribution.

#### Parameters

##### opts

[`SetupMatchingOptions`](../interfaces/SetupMatchingOptions.md)

Sponsor address, match ratio in basis points, the maximum to
match in XLM, and the wallet `signTx` callback. `matchRatioBps` is sent as
a `u32` and must be a non-negative integer.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the setup — for example
the basis points exceed 10 000 (`#8`), the campaign is not active (`#7`),
or a matching pool already exists.

#### Throws

If the sponsor's account cannot be loaded from Horizon, if
`signTx` rejects, or if the transaction is not confirmed within the polling
window (~30s).

***

### refundMatchingSponsor()

> **refundMatchingSponsor**(`opts`): `Promise`\<`string`\>

Defined in: [sdks/js/src/client.ts:554](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/client.ts#L554)

Returns unspent matching funds to the sponsor.

Calls the contract's `refund_matching_sponsor`. Only the amount still
unmatched — [FmcClient.getMatchingPool](#getmatchingpool) — is returned; funds already
matched into contributions stay with the campaign.

Note that despite refunding the *sponsor*, this call is signed by the
**creator**, which is why `opts` takes `creatorAddress` rather than a
sponsor address.

#### Parameters

##### opts

[`RefundMatchingSponsorOptions`](../interfaces/RefundMatchingSponsorOptions.md)

Creator address and the wallet `signTx` callback.

#### Returns

`Promise`\<`string`\>

The confirmed transaction hash.

#### Throws

If the contract rejects the refund — for example
the caller is not the creator (`#39`), no matching pool was configured, or
the campaign has not reached a state where the pool can be released.

#### Throws

If the creator's account cannot be loaded from Horizon, if
`signTx` rejects, or if the transaction is not confirmed within the polling
window (~30s).
