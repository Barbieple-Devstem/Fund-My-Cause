[**@fund-my-cause/sdk**](../README.md)

***

[@fund-my-cause/sdk](../README.md) / WalletProvider

# Interface: WalletProvider

Defined in: [sdks/js/src/walletProvider.ts:12](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L12)

Wallet provider interface that components should depend on.
Enables dependency injection for testing without a live wallet.

## Properties

### state

> **state**: [`WalletProviderState`](../type-aliases/WalletProviderState.md)

Defined in: [sdks/js/src/walletProvider.ts:16](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L16)

Current connection state.

***

### publicKey

> **publicKey**: `string` \| `null`

Defined in: [sdks/js/src/walletProvider.ts:21](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L21)

Currently connected public key, or null if not connected.

## Methods

### connect()

> **connect**(): `Promise`\<`string`\>

Defined in: [sdks/js/src/walletProvider.ts:28](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L28)

Connect to the wallet and request access.

#### Returns

`Promise`\<`string`\>

The connected public key

#### Throws

Error if connection fails or user denies

***

### disconnect()

> **disconnect**(): `Promise`\<`void`\>

Defined in: [sdks/js/src/walletProvider.ts:33](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L33)

Disconnect from the wallet.

#### Returns

`Promise`\<`void`\>

***

### signTransaction()

> **signTransaction**(`xdr`): `Promise`\<`string`\>

Defined in: [sdks/js/src/walletProvider.ts:41](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L41)

Sign a transaction XDR with the wallet.

#### Parameters

##### xdr

`string`

The prepared transaction as base64 XDR

#### Returns

`Promise`\<`string`\>

The signed transaction as base64 XDR

#### Throws

Error if signing fails or wallet is not connected

***

### getNetworkDetails()

> **getNetworkDetails**(): `Promise`\<`string`\>

Defined in: [sdks/js/src/walletProvider.ts:47](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L47)

Get the network details from the wallet.

#### Returns

`Promise`\<`string`\>

Network name (e.g., 'Public Global Stellar Network')

***

### onStateChange()

> **onStateChange**(`callback`): () => `void`

Defined in: [sdks/js/src/walletProvider.ts:54](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/sdks/js/src/walletProvider.ts#L54)

Subscribe to connection state changes.

#### Parameters

##### callback

(`state`, `publicKey`) => `void`

Called when state or publicKey changes

#### Returns

Unsubscribe function

() => `void`
