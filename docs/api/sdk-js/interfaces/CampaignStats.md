[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / CampaignStats

# Interface: CampaignStats

Defined in: [sdks/js/src/types.ts:41](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L41)

Live funding metrics for a campaign, returned by `FmcClient.getStats`.

Amounts appear twice: as XLM `number`s for display, and as raw stroop
`bigint`s where exact arithmetic matters. Prefer the stroop fields for any
comparison or sum — the XLM values are lossy above ~15 significant digits.

## Properties

### raisedXlm

> **raisedXlm**: `number`

Defined in: [sdks/js/src/types.ts:43](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L43)

Total raised in XLM

***

### goalXlm

> **goalXlm**: `number`

Defined in: [sdks/js/src/types.ts:45](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L45)

Goal in XLM

***

### progressPercent

> **progressPercent**: `number`

Defined in: [sdks/js/src/types.ts:47](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L47)

Progress 0–100 (can exceed 100 with matching)

***

### contributorCount

> **contributorCount**: `number`

Defined in: [sdks/js/src/types.ts:49](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L49)

Number of distinct addresses that have contributed.

***

### avgContributionXlm

> **avgContributionXlm**: `number`

Defined in: [sdks/js/src/types.ts:51](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L51)

Mean contribution in XLM, or `0` when there are no contributors.

***

### largestContributionXlm

> **largestContributionXlm**: `number`

Defined in: [sdks/js/src/types.ts:53](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L53)

Largest single contribution in XLM, or `0` when there are none.

***

### raisedStroops

> **raisedStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:55](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L55)

Total raised in stroops — the exact on-chain value behind `raisedXlm`.

***

### goalStroops

> **goalStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:57](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L57)

Goal in stroops — the exact on-chain value behind `goalXlm`.
