#!/usr/bin/env node
/**
 * check-dead-exports.js — Issue #819
 *
 * Scans apps/interface/src/lib/webhooks/*.ts for exported symbols and checks
 * whether each symbol is imported anywhere else in the project.
 *
 * Usage:
 *   node scripts/check-dead-exports.js
 *   node scripts/check-dead-exports.js --verbose
 *
 * Exit codes:
 *   0 — no dead exports found (or only expected utility-only exports)
 *   1 — dead exports found (not imported by any consumer file)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Configuration ─────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(__dirname, '..');

/** Directory whose exports we want to audit. */
const AUDIT_DIR = path.join(REPO_ROOT, 'apps/interface/src/lib/webhooks');

/**
 * Source roots to search for import references.
 * The audit files themselves are excluded from consumer checks.
 */
const SEARCH_ROOTS = [
  path.join(REPO_ROOT, 'apps/interface/src'),
];

/** File extensions to scan. */
const SCAN_EXTENSIONS = ['.ts', '.tsx'];

/**
 * Exports that are part of the public SDK/utility API and are intentionally
 * exported even if not consumed inside this application. Listing them here
 * prevents false positives without suppressing truly dead code.
 *
 * Rationale:
 *  - signPayload    — public utility for webhook consumers to build signatures
 *  - verifySignature — public utility for webhook consumers to verify payloads
 */
const KNOWN_PUBLIC_API = new Set(['signPayload', 'verifySignature']);

const VERBOSE = process.argv.includes('--verbose');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Recursively collect all files matching the given extensions. */
function collectFiles(dir, extensions, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden dirs, node_modules, .next, __mocks__, dist
      if (['.', 'node_modules', '.next', 'dist', 'build', '.cache'].some(s => entry.name.startsWith(s))) continue;
      collectFiles(full, extensions, results);
    } else if (extensions.includes(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Parse exported symbols from a TypeScript file using regex heuristics.
 * Returns an array of { name, line } objects.
 *
 * Handles:
 *   export function foo(...)
 *   export async function foo(...)
 *   export const foo = ...
 *   export type Foo = ...
 *   export interface Foo { ... }
 *   export class Foo { ... }
 *   export enum Foo { ... }
 *   export { foo, bar }           (re-exports)
 *   export { foo as bar }         (re-exports with alias)
 */
function parseExports(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const lines = src.split('\n');
  const symbols = [];

  // Pattern 1: `export [async] function|const|let|var|class|type|interface|enum <Name>`
  const declPattern = /^export\s+(?:async\s+)?(?:function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

  // Pattern 2: `export { foo, bar as baz, ... }`  (may span multiple lines but we check single-line form)
  const namedExportPattern = /^export\s*\{([^}]+)\}/;

  // Pattern 3: `export default function|class <Name>` (if named)
  const defaultPattern = /^export\s+default\s+(?:function|class)\s+([A-Za-z_$][A-Za-z0-9_$]*)/;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const trimmed = line.trim();

    let m;

    if ((m = declPattern.exec(trimmed))) {
      symbols.push({ name: m[1], line: lineNum });
      return;
    }

    if ((m = defaultPattern.exec(trimmed))) {
      symbols.push({ name: m[1], line: lineNum });
      return;
    }

    if ((m = namedExportPattern.exec(trimmed))) {
      // Parse `foo, bar as baz, type Baz` — extract the *exported* name (after "as")
      const entries = m[1].split(',').map(s => s.trim()).filter(Boolean);
      for (const entry of entries) {
        // skip `type` keyword-only entries with no name
        const parts = entry.replace(/^type\s+/, '').split(/\s+as\s+/);
        const exportedName = (parts[1] ?? parts[0]).trim();
        if (exportedName && /^[A-Za-z_$]/.test(exportedName)) {
          symbols.push({ name: exportedName, line: lineNum });
        }
      }
    }
  });

  return symbols;
}

/**
 * Check whether a symbol name is imported/used in any file outside the
 * audit directory.
 *
 * We look for:
 *   - import { ..., name, ... }
 *   - import { ..., name as alias, ... }
 *   - import * as ns from ... (namespace imports — hard to trace statically,
 *     so we conservatively skip flagging these)
 *
 * Returns the list of files that reference the symbol.
 */
function findConsumers(symbolName, allFiles, auditFiles) {
  const auditSet = new Set(auditFiles);
  const consumers = [];

  // Named import: `{ symbolName` or `, symbolName` followed by optional ` as`
  // Also matches re-export: `export { symbolName`
  const importRe = new RegExp(
    `(?:^|[{,]\\s*)(?:type\\s+)?${escapeRegex(symbolName)}(?:\\s+as\\s+[A-Za-z_$][A-Za-z0-9_$]*)?\\s*(?:,|\\})`,
    'm',
  );

  for (const file of allFiles) {
    if (auditSet.has(file)) continue; // skip the source file itself
    try {
      const src = fs.readFileSync(file, 'utf8');
      if (importRe.test(src)) {
        consumers.push(file);
      }
    } catch {
      // unreadable file — skip
    }
  }

  return consumers;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function relativePath(absPath) {
  return path.relative(REPO_ROOT, absPath);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  // 1. Collect audit files (files whose exports we check)
  const auditFiles = collectFiles(AUDIT_DIR, SCAN_EXTENSIONS);
  if (auditFiles.length === 0) {
    console.error(`[check-dead-exports] No files found in ${relativePath(AUDIT_DIR)}`);
    process.exit(0);
  }

  // 2. Collect all project files to search for consumers
  const allFiles = [];
  for (const root of SEARCH_ROOTS) {
    collectFiles(root, SCAN_EXTENSIONS, allFiles);
  }

  if (VERBOSE) {
    console.log(`Auditing ${auditFiles.length} file(s) in ${relativePath(AUDIT_DIR)}`);
    console.log(`Searching ${allFiles.length} file(s) across project\n`);
  }

  // 3. For each audit file, extract exports and check usage
  const deadExports = [];
  const publicApiExports = [];
  const usedExports = [];

  for (const auditFile of auditFiles) {
    const symbols = parseExports(auditFile);

    if (VERBOSE) {
      console.log(`\n── ${relativePath(auditFile)} (${symbols.length} exports) ──`);
    }

    for (const { name, line } of symbols) {
      const consumers = findConsumers(name, allFiles, [auditFile]);

      if (VERBOSE) {
        const status = consumers.length > 0
          ? `✓ used in ${consumers.length} file(s)`
          : KNOWN_PUBLIC_API.has(name)
            ? `⚠ public API (not imported internally)`
            : `✗ DEAD`;
        console.log(`  L${String(line).padEnd(4)} ${name.padEnd(30)} ${status}`);
        if (consumers.length > 0 && VERBOSE) {
          for (const c of consumers) {
            console.log(`           → ${relativePath(c)}`);
          }
        }
      }

      const entry = { file: relativePath(auditFile), name, line };
      if (consumers.length === 0) {
        if (KNOWN_PUBLIC_API.has(name)) {
          publicApiExports.push(entry);
        } else {
          deadExports.push(entry);
        }
      } else {
        usedExports.push({ ...entry, consumers: consumers.map(relativePath) });
      }
    }
  }

  // 4. Report
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  check-dead-exports — webhook export audit');
  console.log('═══════════════════════════════════════════════════════\n');

  if (usedExports.length > 0) {
    console.log(`✓  Used exports (${usedExports.length}):`);
    for (const e of usedExports) {
      console.log(`   ${e.file}:${e.line}  ${e.name}`);
    }
    console.log();
  }

  if (publicApiExports.length > 0) {
    console.log(`⚠  Public API exports — exported but not imported internally (${publicApiExports.length}):`);
    console.log(`   These are intentional public utilities (SDK/consumer-facing).`);
    console.log(`   Add them to KNOWN_PUBLIC_API in this script if you want to suppress.`);
    for (const e of publicApiExports) {
      console.log(`   ${e.file}:${e.line}  ${e.name}`);
    }
    console.log();
  }

  if (deadExports.length === 0) {
    console.log('✓  No dead exports found.\n');
    process.exit(0);
  } else {
    console.log(`✗  Dead exports found (${deadExports.length}) — not imported anywhere:\n`);
    for (const e of deadExports) {
      console.log(`   ${e.file}:${e.line}  ${e.name}`);
    }
    console.log(
      '\n  These symbols are exported but never imported by any consumer file.',
      '\n  Consider removing them or moving them to an internal (non-exported) scope.',
      '\n',
    );
    process.exit(1);
  }
}

main();
