[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / ListByCategoryOptions

# Interface: ListByCategoryOptions

Defined in: [sdks/js/src/types.ts:273](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L273)

Pagination and filter arguments for `FmcRegistryClient.getByCampaignCategory`.

## Extends

- [`ListOptions`](ListOptions.md)

## Properties

### offset

> **offset**: `number`

Defined in: [sdks/js/src/types.ts:267](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L267)

0-based index to start from.

#### Inherited from

[`ListOptions`](ListOptions.md).[`offset`](ListOptions.md#offset)

***

### limit

> **limit**: `number`

Defined in: [sdks/js/src/types.ts:269](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L269)

Maximum addresses to return in this page.

#### Inherited from

[`ListOptions`](ListOptions.md).[`limit`](ListOptions.md#limit)

***

### categoryId

> **categoryId**: `number`

Defined in: [sdks/js/src/types.ts:275](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L275)

Contract-assigned category ID to filter by. Unknown IDs yield an empty result.
