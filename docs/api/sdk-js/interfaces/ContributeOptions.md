[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / ContributeOptions

# Interface: ContributeOptions

Defined in: [sdks/js/src/types.ts:180](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L180)

Arguments for `FmcClient.contribute`.

## Properties

### contributor

> **contributor**: `string`

Defined in: [sdks/js/src/types.ts:182](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L182)

Address making the contribution; must be the one that signs.

***

### amountXlm

> **amountXlm**: `number`

Defined in: [sdks/js/src/types.ts:184](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L184)

Amount to contribute in XLM, rounded to the nearest stroop.

***

### tokenId

> **tokenId**: `string`

Defined in: [sdks/js/src/types.ts:186](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L186)

Contract ID of the token to pay with; must be the campaign's token.

***

### message?

> `optional` **message?**: `string`

Defined in: [sdks/js/src/types.ts:188](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L188)

Optional public message, stored on-chain. Maximum 256 characters.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:190](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L190)

Wallet callback that signs the prepared transaction.
