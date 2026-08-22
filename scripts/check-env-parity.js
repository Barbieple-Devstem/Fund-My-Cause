#!/usr/bin/env node
/**
 * scripts/check-env-parity.js — Issue #715
 *
 * Validates that every required environment variable defined in the schema
 * (REQUIRED_VARS) is present in each .env.* file under apps/interface/.
 *
 * Exit codes:
 *   0 — all files pass
 *   1 — one or more files are missing required keys
 *
 * Usage:
 *   node scripts/check-env-parity.js [--env-dir apps/interface]
 *
 * In CI, run as a pre-build gate to prevent staging/production drift.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Single source of truth for required env vars ───────────────────────────────
// Any key listed here must appear in every .env.* file checked.
// Add new required vars here when they are introduced.
const REQUIRED_VARS = [
  'NEXT_PUBLIC_CROWDFUND_CONTRACT_ID',
  'NEXT_PUBLIC_REGISTRY_CONTRACT_ID',
  'NEXT_PUBLIC_SOROBAN_RPC_URL',
  'NEXT_PUBLIC_NETWORK_PASSPHRASE',
  'NEXT_PUBLIC_HORIZON_URL',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Parse a .env file and return a Set of key names.
 * Ignores blank lines and comments.
 */
function parseEnvKeys(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const keys = new Set();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    keys.add(trimmed.slice(0, eqIdx).trim());
  }
  return keys;
}

// Files that serve a specific feature override — not full environment configs.
// These are excluded from the required-key check.
const SKIP_FILES = new Set(['.env.graphql', '.env.local', '.env.test']);

/**
 * Collect all .env.* and .env.example files in a directory.
 * Skips feature-specific overrides listed in SKIP_FILES.
 */
function collectEnvFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => (/^\.env(\.\w+)?$/.test(f) || f === '.env.example') && !SKIP_FILES.has(f))
    .map((f) => path.join(dir, f));
}

// ── Main ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const envDirArg = args[args.indexOf('--env-dir') + 1];
const envDir = path.resolve(envDirArg || 'apps/interface');

if (!fs.existsSync(envDir)) {
  console.error(`[env-parity] Directory not found: ${envDir}`);
  process.exit(1);
}

const files = collectEnvFiles(envDir);
if (files.length === 0) {
  console.warn('[env-parity] No .env files found — nothing to check.');
  process.exit(0);
}

let failed = false;

console.log(`[env-parity] Checking ${files.length} env file(s) against ${REQUIRED_VARS.length} required keys\n`);

for (const file of files) {
  const relPath = path.relative(process.cwd(), file);
  const presentKeys = parseEnvKeys(file);
  const missing = REQUIRED_VARS.filter((k) => !presentKeys.has(k));
  const extra = [...presentKeys].filter(
    (k) => k.startsWith('NEXT_PUBLIC_') && !REQUIRED_VARS.includes(k),
  );

  if (missing.length === 0) {
    console.log(`  ✓  ${relPath}`);
  } else {
    console.error(`  ✗  ${relPath}`);
    for (const key of missing) {
      console.error(`       MISSING: ${key}`);
    }
    failed = true;
  }

  if (extra.length > 0) {
    for (const key of extra) {
      console.warn(`       EXTRA (undocumented): ${key} — add to REQUIRED_VARS if intentional`);
    }
  }
}

console.log('');

if (failed) {
  console.error('[env-parity] FAILED — one or more env files are missing required keys.');
  console.error('[env-parity] See docs/environment-config.md for the full variable reference.');
  process.exit(1);
} else {
  console.log('[env-parity] PASSED — all env files contain the required keys.');
}
