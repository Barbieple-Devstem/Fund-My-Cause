[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / RefundOptions

# Interface: RefundOptions

Defined in: [sdks/js/src/types.ts:202](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L202)

Arguments for `FmcClient.refundSingle`.

## Properties

### contributor

> **contributor**: `string`

Defined in: [sdks/js/src/types.ts:204](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L204)

Address claiming its own refund; must be the one that signs.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:206](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L206)

Wallet callback that signs the prepared transaction.
