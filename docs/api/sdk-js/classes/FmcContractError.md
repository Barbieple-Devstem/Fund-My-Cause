[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / FmcContractError

# Class: FmcContractError

Defined in: [sdks/js/src/errors.ts:20](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/errors.ts#L20)

Thrown when the Soroban contract returns a `ContractError(n)`.

Distinguishes contract-level rejections — a failed precondition the caller
can act on — from network, wallet, and submission failures, which surface as
a plain `Error`. Narrow with `instanceof` before reading [FmcContractError.code](#code).

## Example

```ts
try {
  await client.contribute({ ... });
} catch (e) {
  if (e instanceof FmcContractError) {
    console.error(`Contract error ${e.code}: ${e.message}`);
  }
}
```

## Extends

- `Error`

## Constructors

### Constructor

> **new FmcContractError**(`code`, `message`): `FmcContractError`

Defined in: [sdks/js/src/errors.ts:21](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/errors.ts#L21)

#### Parameters

##### code

`number`

The contract's numeric error code, matching the `ContractError`
discriminant. Stable across releases, so it is safe to branch on — see
`docs/api/errors.md` for the full table.

##### message

`string`

#### Returns

`FmcContractError`

#### Overrides

`Error.constructor`

## Properties

### code

> `readonly` **code**: `number`

Defined in: [sdks/js/src/errors.ts:27](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/errors.ts#L27)

The contract's numeric error code, matching the `ContractError`
discriminant. Stable across releases, so it is safe to branch on — see
`docs/api/errors.md` for the full table.
