[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / SignFn

# Type Alias: SignFn

> **SignFn** = (`xdr`) => `Promise`\<`string`\>

Defined in: [sdks/js/src/types.ts:11](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L11)

Wallet signing callback — matches WalletContext.signTx.

Receives the prepared transaction as base64 XDR and must resolve with the
signed XDR. Every write method takes one of these rather than a secret key,
so the SDK never handles private keys itself.

## Parameters

### xdr

`string`

The prepared, unsigned transaction as base64 XDR.

## Returns

`Promise`\<`string`\>

The signed transaction as base64 XDR.
