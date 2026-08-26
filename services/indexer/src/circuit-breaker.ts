/**
 * Re-exports the canonical CircuitBreaker from @fund-my-cause/rpc-client.
 *
 * The implementation was promoted to the shared package so that both
 * graphql-api and indexer use the same circuit breaker without duplication.
 * All existing imports of this module continue to work unchanged.
 */
export { CircuitBreaker, CircuitOpenError } from "@fund-my-cause/rpc-client";
export type {
  CircuitBreakerOptions,
  CircuitBreakerMetrics,
  CircuitState,
} from "@fund-my-cause/rpc-client";
