[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / MockWalletProviderConfig

# Interface: MockWalletProviderConfig

Defined in: [sdks/js/src/walletProvider.ts:60](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L60)

Options for creating a mock wallet provider in tests.

## Properties

### initialState?

> `optional` **initialState?**: [`WalletProviderState`](../type-aliases/WalletProviderState.md)

Defined in: [sdks/js/src/walletProvider.ts:64](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L64)

Initial state: "idle", "pending", "connected", or "error"

***

### publicKey?

> `optional` **publicKey?**: `string`

Defined in: [sdks/js/src/walletProvider.ts:69](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L69)

Public key to use when connected

***

### connectError?

> `optional` **connectError?**: `string`

Defined in: [sdks/js/src/walletProvider.ts:74](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L74)

Error message to throw on connect() (makes state "error")

***

### signError?

> `optional` **signError?**: `string`

Defined in: [sdks/js/src/walletProvider.ts:79](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L79)

Error message to throw on signTransaction()

***

### networkName?

> `optional` **networkName?**: `string`

Defined in: [sdks/js/src/walletProvider.ts:84](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L84)

Network name to return from getNetworkDetails()

***

### delay?

> `optional` **delay?**: `number`

Defined in: [sdks/js/src/walletProvider.ts:89](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L89)

Delay in ms before completing async operations (useful for testing loading states)
