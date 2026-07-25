[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / FmcRegistryClient

# Class: FmcRegistryClient

Defined in: [sdks/js/src/registry.ts:41](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/registry.ts#L41)

Read-only client for the Fund-My-Cause registry contract — the on-chain index
of deployed campaigns.

The registry stores campaign *contract addresses*, not campaign data. Use it
to discover which campaigns exist, then construct an [FmcClient](FmcClient.md) per
address to read that campaign's stats and metadata.

Every method here is a view call: they simulate rather than submit, so none
requires a wallet or costs fees. Registration is performed by the campaign
contract itself at deployment, so this client exposes no write methods.

## Example

```ts
const registry = new FmcRegistryClient({
  contractId:        "C...", // registry contract, not a campaign
  rpcUrl:            "https://soroban-testnet.stellar.org",
  networkPassphrase: "Test SDF Network ; September 2015",
  horizonUrl:        "https://horizon-testnet.stellar.org",
});

for (const address of await registry.listAll()) {
  const campaign = new FmcClient({ ...config, contractId: address });
  console.log(await campaign.getStats());
}
```

## See

[FmcClient](FmcClient.md) for reading an individual campaign.

## Constructors

### Constructor

> **new FmcRegistryClient**(`config`): `FmcRegistryClient`

Defined in: [sdks/js/src/registry.ts:58](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/registry.ts#L58)

Creates a client bound to a registry contract.

Performs no network I/O and does not verify that `contractId` is a
registry — pointing it at a campaign contract by mistake surfaces as a
contract error on the first call, not here.

#### Parameters

##### config

[`RegistryClientConfig`](../interfaces/RegistryClientConfig.md)

Registry contract ID plus the RPC URL and network
passphrase to reach it. `horizonUrl` is accepted for symmetry with
[FmcClientConfig](../interfaces/FmcClientConfig.md) but is unused, since this client never submits
transactions.

#### Returns

`FmcRegistryClient`

## Methods

### list()

> **list**(`opts`): `Promise`\<`string`[]\>

Defined in: [sdks/js/src/registry.ts:96](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/registry.ts#L96)

Lists registered campaign contract addresses, one page at a time.

Calls the registry's `list`. Advance by increasing `offset` until a page
comes back shorter than `limit`, or use [FmcRegistryClient.listAll](#listall)
to have that loop done for you.

#### Parameters

##### opts

[`ListOptions`](../interfaces/ListOptions.md)

`offset` (0-based index to start from) and `limit` (maximum
addresses to return). Both are sent as `u32`, so both must be non-negative
integers.

#### Returns

`Promise`\<`string`[]\>

Up to `limit` campaign contract addresses. A short or empty page
means the end of the registry has been reached.

#### Throws

If the contract rejects the call — for example
the registry has not been initialized (`#2`).

***

### getByCampaignCategory()

> **getByCampaignCategory**(`opts`): `Promise`\<`string`[]\>

Defined in: [sdks/js/src/registry.ts:119](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/registry.ts#L119)

Lists registered campaigns in one category, a page at a time.

Calls the registry's `get_campaigns_by_category`. Paginates exactly like
[FmcRegistryClient.list](#list), with offset and limit applied within the
filtered set rather than the whole registry.

#### Parameters

##### opts

[`ListByCategoryOptions`](../interfaces/ListByCategoryOptions.md)

`categoryId` to filter by, plus `offset` and `limit`. All
three are sent as `u32`, so all must be non-negative integers. Category IDs
are assigned by the contract; an unrecognised one yields an empty result
rather than an error.

#### Returns

`Promise`\<`string`[]\>

Up to `limit` campaign contract addresses in that category. A
short or empty page means the end of the filtered set.

#### Throws

If the contract rejects the call — for example
the registry has not been initialized (`#2`).

***

### listAll()

> **listAll**(`pageSize?`): `Promise`\<`string`[]\>

Defined in: [sdks/js/src/registry.ts:144](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/registry.ts#L144)

Fetches every registered campaign address, paginating internally.

Repeatedly calls [FmcRegistryClient.list](#list), advancing the offset until
a short page signals the end. Convenient, but the calls are sequential and
the result is unbounded — on a large registry this issues many round trips
and holds every address in memory. Prefer `list` with your own paging for
anything user-facing.

#### Parameters

##### pageSize?

`number` = `50`

Addresses to request per underlying call. Defaults to
`50`. Larger values mean fewer round trips, but the registry enforces its
own per-page maximum.

#### Returns

`Promise`\<`string`[]\>

Every registered campaign contract address, in registry order.

#### Throws

If any page's call is rejected. Pages already
fetched are discarded — the method is not resumable, so a failure part-way
through means starting over.
