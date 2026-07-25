[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / CancelOptions

# Interface: CancelOptions

Defined in: [sdks/js/src/types.ts:235](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L235)

Arguments for `FmcClient.cancelCampaign`.

## Properties

### creator

> **creator**: `string`

Defined in: [sdks/js/src/types.ts:237](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L237)

Campaign creator's address; must be the one that signs.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:239](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L239)

Wallet callback that signs the prepared transaction.
