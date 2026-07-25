[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / CampaignInfo

# Interface: CampaignInfo

Defined in: [sdks/js/src/types.ts:67](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L67)

A campaign's metadata and configuration, returned by
`FmcClient.getCampaignInfo`.

This is the state fixed at initialization plus the current status — not live
funding progress, which [CampaignStats](CampaignStats.md) carries.

## Properties

### creator

> **creator**: `string`

Defined in: [sdks/js/src/types.ts:69](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L69)

Address that created the campaign and may withdraw or cancel it.

***

### token

> **token**: `string`

Defined in: [sdks/js/src/types.ts:71](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L71)

Contract ID of the token this campaign accepts.

***

### goalXlm

> **goalXlm**: `number`

Defined in: [sdks/js/src/types.ts:73](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L73)

Funding goal in XLM.

***

### goalStroops

> **goalStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:75](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L75)

Funding goal in stroops — the exact on-chain value behind `goalXlm`.

***

### deadline

> **deadline**: `Date`

Defined in: [sdks/js/src/types.ts:77](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L77)

Deadline, converted from the contract's Unix seconds.

***

### minContributionXlm

> **minContributionXlm**: `number`

Defined in: [sdks/js/src/types.ts:79](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L79)

Smallest accepted contribution, in XLM.

***

### minContributionStroops

> **minContributionStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:81](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L81)

Smallest accepted contribution, in stroops.

***

### maxContributionXlm

> **maxContributionXlm**: `number`

Defined in: [sdks/js/src/types.ts:83](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L83)

Per-contributor cap in XLM. `0` means uncapped.

***

### maxContributionStroops

> **maxContributionStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:85](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L85)

Per-contributor cap in stroops. `0` means uncapped.

***

### title

> **title**: `string`

Defined in: [sdks/js/src/types.ts:87](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L87)

Campaign title as stored on-chain.

***

### description

> **description**: `string`

Defined in: [sdks/js/src/types.ts:89](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L89)

Campaign description as stored on-chain.

***

### status

> **status**: `"Active"` \| `"Successful"` \| `"Refunded"` \| `"Cancelled"` \| `"Paused"` \| `"Archived"`

Defined in: [sdks/js/src/types.ts:91](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L91)

Current lifecycle status (active, successful, cancelled, …).

***

### category

> **category**: [`Category`](../type-aliases/Category.md)

Defined in: [sdks/js/src/types.ts:93](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L93)

Campaign category.

***

### hasPlatformConfig

> **hasPlatformConfig**: `boolean`

Defined in: [sdks/js/src/types.ts:95](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L95)

Whether a platform fee is configured; when `false`, ignore `platformFeeBps`.

***

### platformFeeBps

> **platformFeeBps**: `number`

Defined in: [sdks/js/src/types.ts:97](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L97)

Platform fee in basis points, deducted from the creator's payout on withdrawal.
