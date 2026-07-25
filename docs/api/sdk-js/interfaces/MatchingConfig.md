[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / MatchingConfig

# Interface: MatchingConfig

Defined in: [sdks/js/src/types.ts:149](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L149)

An active matching-pool configuration, returned by
`FmcClient.getMatchingConfig`.

A sponsor commits to matching contributions at `matchRatioBps` until
`maxMatchXlm` is exhausted.

## Properties

### sponsor

> **sponsor**: `string`

Defined in: [sdks/js/src/types.ts:151](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L151)

Address funding the matching pool.

***

### matchRatioBps

> **matchRatioBps**: `number`

Defined in: [sdks/js/src/types.ts:153](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L153)

Match rate in basis points — 5000 matches 50% of each contribution.

***

### maxMatchXlm

> **maxMatchXlm**: `number`

Defined in: [sdks/js/src/types.ts:155](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L155)

Maximum the sponsor will match in total, in XLM.

***

### maxMatchStroops

> **maxMatchStroops**: `bigint`

Defined in: [sdks/js/src/types.ts:157](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L157)

Maximum the sponsor will match in total, in stroops.
