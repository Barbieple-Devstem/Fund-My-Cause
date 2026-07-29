import { describe, it, expect, afterEach } from 'vitest';
import { loadStoreConfig, DEFAULT_STORE_CONFIG } from './store-config.js';

const ENV_KEYS = [
  'STORE_MAX_EVENT_CAPACITY',
  'STORE_EVENT_BATCH_SIZE',
  'STORE_STALE_LEDGER_THRESHOLD_MS',
  'RPC_REQUEST_TIMEOUT_MS',
  'RPC_MAX_CONCURRENT_REQUESTS',
  'RPC_RETRY_ATTEMPTS',
] as const;

describe('loadStoreConfig', () => {
  afterEach(() => {
    for (const key of ENV_KEYS) {
      delete process.env[key];
    }
  });

  it('returns defaults when no env vars are set', () => {
    const config = loadStoreConfig();
    expect(config).toEqual(DEFAULT_STORE_CONFIG);
  });

  it('reads STORE_MAX_EVENT_CAPACITY from env', () => {
    process.env.STORE_MAX_EVENT_CAPACITY = '50000';
    const config = loadStoreConfig();
    expect(config.maxEventCapacity).toBe(50000);
    // other values stay at defaults
    expect(config.eventBatchSize).toBe(DEFAULT_STORE_CONFIG.eventBatchSize);
  });

  it('reads STORE_EVENT_BATCH_SIZE from env', () => {
    process.env.STORE_EVENT_BATCH_SIZE = '200';
    const config = loadStoreConfig();
    expect(config.eventBatchSize).toBe(200);
  });

  it('reads STORE_STALE_LEDGER_THRESHOLD_MS from env', () => {
    process.env.STORE_STALE_LEDGER_THRESHOLD_MS = '120000';
    const config = loadStoreConfig();
    expect(config.staleLedgerThresholdMs).toBe(120000);
  });

  it('reads RPC_REQUEST_TIMEOUT_MS from env', () => {
    process.env.RPC_REQUEST_TIMEOUT_MS = '15000';
    const config = loadStoreConfig();
    expect(config.rpcRequestTimeoutMs).toBe(15000);
  });

  it('reads RPC_MAX_CONCURRENT_REQUESTS from env', () => {
    process.env.RPC_MAX_CONCURRENT_REQUESTS = '10';
    const config = loadStoreConfig();
    expect(config.rpcMaxConcurrentRequests).toBe(10);
  });

  it('reads RPC_RETRY_ATTEMPTS from env', () => {
    process.env.RPC_RETRY_ATTEMPTS = '5';
    const config = loadStoreConfig();
    expect(config.rpcRetryAttempts).toBe(5);
  });

  it('falls back to default for invalid numeric values', () => {
    process.env.STORE_MAX_EVENT_CAPACITY = 'not-a-number';
    process.env.STORE_EVENT_BATCH_SIZE = 'abc';
    process.env.RPC_REQUEST_TIMEOUT_MS = '';
    process.env.RPC_MAX_CONCURRENT_REQUESTS = 'NaN';
    process.env.RPC_RETRY_ATTEMPTS = 'undefined';
    const config = loadStoreConfig();
    expect(config.maxEventCapacity).toBe(DEFAULT_STORE_CONFIG.maxEventCapacity);
    expect(config.eventBatchSize).toBe(DEFAULT_STORE_CONFIG.eventBatchSize);
    expect(config.rpcRequestTimeoutMs).toBe(DEFAULT_STORE_CONFIG.rpcRequestTimeoutMs);
    expect(config.rpcMaxConcurrentRequests).toBe(DEFAULT_STORE_CONFIG.rpcMaxConcurrentRequests);
    expect(config.rpcRetryAttempts).toBe(DEFAULT_STORE_CONFIG.rpcRetryAttempts);
  });

  it('reads all env vars simultaneously', () => {
    process.env.STORE_MAX_EVENT_CAPACITY = '75000';
    process.env.STORE_EVENT_BATCH_SIZE = '250';
    process.env.STORE_STALE_LEDGER_THRESHOLD_MS = '45000';
    process.env.RPC_REQUEST_TIMEOUT_MS = '20000';
    process.env.RPC_MAX_CONCURRENT_REQUESTS = '8';
    process.env.RPC_RETRY_ATTEMPTS = '2';
    const config = loadStoreConfig();
    expect(config).toEqual({
      maxEventCapacity: 75000,
      eventBatchSize: 250,
      staleLedgerThresholdMs: 45000,
      rpcRequestTimeoutMs: 20000,
      rpcMaxConcurrentRequests: 8,
      rpcRetryAttempts: 2,
    });
  });
});
