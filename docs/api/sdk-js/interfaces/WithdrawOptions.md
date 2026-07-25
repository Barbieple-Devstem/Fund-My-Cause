[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / WithdrawOptions

# Interface: WithdrawOptions

Defined in: [sdks/js/src/types.ts:194](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L194)

Arguments for `FmcClient.withdraw`.

## Properties

### creator

> **creator**: `string`

Defined in: [sdks/js/src/types.ts:196](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L196)

Campaign creator's address; must be the one that signs.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:198](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L198)

Wallet callback that signs the prepared transaction.
