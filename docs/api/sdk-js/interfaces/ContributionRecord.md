[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / ContributionRecord

# Interface: ContributionRecord

Defined in: [sdks/js/src/types.ts:133](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L133)

A single contribution by one address, as returned in the array from
`FmcClient.getContributionHistory`.

## Properties

### amountXlm

> **amountXlm**: `number`

Defined in: [sdks/js/src/types.ts:135](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L135)

Amount contributed in this individual contribution, in XLM.

***

### timestamp

> **timestamp**: `Date`

Defined in: [sdks/js/src/types.ts:137](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L137)

When the contribution was made, converted from the contract's Unix seconds.

***

### runningTotalXlm

> **runningTotalXlm**: `number`

Defined in: [sdks/js/src/types.ts:139](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L139)

The address's cumulative total after this contribution, in XLM.
