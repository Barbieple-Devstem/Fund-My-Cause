/**
 * donation-mutation-helpers.js
 *
 * Artillery processor module for the donation mutation load test.
 *
 * Exports:
 *  - setRequestHeaders   — injects per-request trace ID, auth token, and a
 *                          unique transaction hash before each request.
 *  - checkGraphQLErrors  — counts GraphQL-level errors (HTTP 200 with errors[])
 *                          so they are surfaced in the Artillery report.
 *
 * Called by donation-mutation-load-test.yml via the `processor` and `function`
 * directives.
 */

'use strict';

const { randomBytes } = require('crypto');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a pseudo-random Stellar-style transaction hash (64 hex chars).
 * Not a real XDR hash — only used to give each load test request a unique
 * transactionHash so the resolver can distinguish calls.
 */
function generateTxHash() {
  return randomBytes(32).toString('hex').toUpperCase();
}

/**
 * Generate a UUID v4-style trace ID.
 */
function generateTraceId() {
  return randomBytes(16).toString('hex').replace(
    /(.{8})(.{4})(.{4})(.{4})(.{12})/,
    '$1-$2-$3-$4-$5',
  );
}

// ── Artillery processor hooks ─────────────────────────────────────────────────

/**
 * beforeRequest / function hook
 *
 * Runs before every request in the scenario.  Injects:
 *  - Authorization header (if AUTH_TOKEN env var is set)
 *  - X-Trace-ID header (unique per request for server-side log correlation)
 *  - txHash variable (unique per request so each call is a distinct tx)
 */
function setRequestHeaders(requestParams, context, ee, next) {
  // Auth token: read from environment or from context vars set by scenario
  const token = process.env.AUTH_TOKEN || context.vars.authToken || '';
  if (token) {
    requestParams.headers = requestParams.headers || {};
    requestParams.headers['Authorization'] = `Bearer ${token}`;
  }

  // Trace ID — echoed back by the server as X-Trace-ID response header
  const traceId = generateTraceId();
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['X-Trace-ID'] = traceId;
  context.vars.traceId = traceId;

  // Unique transaction hash so each mutation call looks like a different tx
  context.vars.txHash = generateTxHash();

  return next();
}

/**
 * afterResponse / function hook
 *
 * Inspects the parsed response body for GraphQL errors[] arrays.
 * If errors are present Artillery records them as custom counter metrics:
 *
 *   counters.gql_errors         — total GraphQL errors seen
 *   counters.gql_errors_auth    — authentication / authorization errors
 *   counters.gql_errors_rate    — rate-limit errors (429 surfaced in body)
 *   counters.gql_errors_rpc     — Soroban RPC / contract errors
 *
 * These counters appear in the Artillery JSON report and terminal summary.
 */
function checkGraphQLErrors(requestParams, response, context, ee, next) {
  try {
    const body =
      typeof response.body === 'string'
        ? JSON.parse(response.body)
        : response.body;

    const errors = Array.isArray(body && body.errors) ? body.errors : [];

    if (errors.length > 0) {
      ee.emit('counter', 'gql_errors', errors.length);

      errors.forEach((err) => {
        const msg = (err.message || '').toLowerCase();
        if (msg.includes('authentication') || msg.includes('unauthorized') || msg.includes('unauthenticated')) {
          ee.emit('counter', 'gql_errors_auth', 1);
        } else if (msg.includes('rate limit') || msg.includes('too many')) {
          ee.emit('counter', 'gql_errors_rate', 1);
        } else if (msg.includes('rpc') || msg.includes('contract') || msg.includes('soroban') || msg.includes('stellar')) {
          ee.emit('counter', 'gql_errors_rpc', 1);
        } else {
          ee.emit('counter', 'gql_errors_other', 1);
        }
      });
    }

    // Also track HTTP-level errors explicitly
    if (response.statusCode === 429) {
      ee.emit('counter', 'http_429_rate_limited', 1);
    } else if (response.statusCode >= 500) {
      ee.emit('counter', 'http_5xx_errors', 1);
    }

  } catch (_parseErr) {
    // Body was not JSON — count as a generic error
    ee.emit('counter', 'gql_errors_parse_failed', 1);
  }

  return next();
}

module.exports = {
  setRequestHeaders,
  checkGraphQLErrors,
};
