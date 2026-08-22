/**
 * Polyfills that must be loaded before any modules are imported.
 * This runs before setupFilesAfterEnv.
 */

// Polyfill TextEncoder/TextDecoder for jsdom
// Required by @walletconnect and other dependencies
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}
