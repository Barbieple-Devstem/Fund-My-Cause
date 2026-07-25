[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / RefundMatchingSponsorOptions

# Interface: RefundMatchingSponsorOptions

Defined in: [sdks/js/src/types.ts:227](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L227)

Arguments for `FmcClient.refundMatchingSponsor`.

Note this takes the **creator**, not the sponsor: the creator authorises
releasing unspent matching funds back to the sponsor.

## Properties

### creatorAddress

> **creatorAddress**: `string`

Defined in: [sdks/js/src/types.ts:229](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L229)

Campaign creator's address; must be the one that signs.

***

### signTx

> **signTx**: [`SignFn`](../type-aliases/SignFn.md)

Defined in: [sdks/js/src/types.ts:231](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L231)

Wallet callback that signs the prepared transaction.
