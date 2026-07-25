[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / SetupMatchingOptions

# Interface: SetupMatchingOptions

Defined in: [sdks/js/src/types.ts:210](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L210)

Arguments for `FmcClient.setupMatching`.

## Properties

### sponsorAddress

> **sponsorAddress**: `string`

Defined in: [sdks/js/src/types.ts:212](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L212)

Address funding the matching pool; must be the one that signs.

***

### matchRatioBps

> **matchRatioBps**: `number`

Defined in: [sdks/js/src/types.ts:214](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L214)

Match rate in basis points; must not exceed 10 000.

***

### maxMatchXlm

> **maxMatchXlm**: `number`

Defined in: [sdks/js/src/types.ts:216](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L216)

Maximum to match in total, in XLM.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:218](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L218)

Wallet callback that signs the prepared transaction.
