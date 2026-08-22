[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / FmcClientConfig

# Interface: FmcClientConfig

Defined in: [sdks/js/src/types.ts:168](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L168)

Configuration for [FmcClient](../classes/FmcClient.md), bound to one campaign contract.

`networkPassphrase` must match the network `rpcUrl` and `horizonUrl` point
at, or signatures will be rejected at submission.

## Properties

### contractId

> **contractId**: `string`

Defined in: [sdks/js/src/types.ts:170](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L170)

Contract ID of the campaign this client reads and writes.

***

### rpcUrl

> **rpcUrl**: `string`

Defined in: [sdks/js/src/types.ts:172](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L172)

Soroban RPC endpoint, used for simulation, submission, and polling.

***

### networkPassphrase

> **networkPassphrase**: `string`

Defined in: [sdks/js/src/types.ts:174](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L174)

Network passphrase the transactions are signed against.

***

### horizonUrl

> **horizonUrl**: `string`

Defined in: [sdks/js/src/types.ts:176](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/types.ts#L176)

Horizon endpoint, used to load the signing account's sequence number.
