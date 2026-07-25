[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / RegistryClientConfig

# Interface: RegistryClientConfig

Defined in: [sdks/js/src/types.ts:253](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L253)

Configuration for [FmcRegistryClient](../classes/FmcRegistryClient.md), bound to a registry contract.

## Properties

### contractId

> **contractId**: `string`

Defined in: [sdks/js/src/types.ts:255](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L255)

Contract ID of the registry — not of a campaign.

***

### rpcUrl

> **rpcUrl**: `string`

Defined in: [sdks/js/src/types.ts:257](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L257)

Soroban RPC endpoint, used to simulate the view calls.

***

### networkPassphrase

> **networkPassphrase**: `string`

Defined in: [sdks/js/src/types.ts:259](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L259)

Network passphrase the simulated transactions are built against.

***

### horizonUrl

> **horizonUrl**: `string`

Defined in: [sdks/js/src/types.ts:261](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L261)

Accepted for symmetry with [FmcClientConfig](FmcClientConfig.md); unused, as this client never submits.
