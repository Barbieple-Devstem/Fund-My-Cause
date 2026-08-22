#!/usr/bin/env bash
# performance/run-donation-load-test.sh
#
# Convenience wrapper that:
#   1. Sources performance/.env if it exists
#   2. Creates the results/ directory
#   3. Runs the Artillery donation mutation load test
#   4. Generates an HTML report
#   5. Prints a summary with pass/fail outcome
#
# Usage:
#   cd /workspaces/Fund-My-Cause
#   bash performance/run-donation-load-test.sh
#
# Override individual env vars at the call site:
#   GRAPHQL_URL=http://staging:4000 bash performance/run-donation-load-test.sh
#
# Options:
#   --smoke     Run the smoke test instead of the full load test
#   --dry-run   Print the artillery command without executing it

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RESULTS_DIR="${SCRIPT_DIR}/results"
ENV_FILE="${SCRIPT_DIR}/.env"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SMOKE=false
DRY_RUN=false

# ── Parse arguments ────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --smoke)   SMOKE=true ;;
    --dry-run) DRY_RUN=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--smoke] [--dry-run]" >&2
      exit 1
      ;;
  esac
done

# ── Load environment ───────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  echo "Loading environment from $ENV_FILE"
  # shellcheck disable=SC1090
  set -o allexport
  source "$ENV_FILE"
  set +o allexport
else
  echo "No $ENV_FILE found — using shell environment variables (or defaults)."
  echo "Copy performance/.env.example to performance/.env and fill in values."
fi

# ── Validate required env vars ────────────────────────────────────────────
GRAPHQL_URL="${GRAPHQL_URL:-http://localhost:4000}"
CAMPAIGN_ID="${CAMPAIGN_ID:-PLACEHOLDER_CAMPAIGN_CONTRACT_ID}"
CONTRIBUTOR_ADDR="${CONTRIBUTOR_ADDR:-GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Fund-My-Cause — Donation Mutation Load Test"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Target:        ${GRAPHQL_URL}"
echo "  Campaign:      ${CAMPAIGN_ID}"
echo "  Contributor:   ${CONTRIBUTOR_ADDR}"
echo "  Auth token:    $([ -n "${AUTH_TOKEN}" ] && echo "set (${#AUTH_TOKEN} chars)" || echo "NOT SET — mutations will return auth errors")"
echo ""

if [[ "${CAMPAIGN_ID}" == "PLACEHOLDER_CAMPAIGN_CONTRACT_ID" ]]; then
  echo "⚠  WARNING: CAMPAIGN_ID is still the placeholder value."
  echo "   The recordContribution mutation will fail the on-chain view call."
  echo "   Set CAMPAIGN_ID to a real Soroban contract address in performance/.env"
  echo ""
fi

# ── Locate Artillery binary ───────────────────────────────────────────────
ARTILLERY_BIN=""
# Try local graphql-api node_modules first (this is where it's installed)
if [[ -x "${SCRIPT_DIR}/../services/graphql-api/node_modules/.bin/artillery" ]]; then
  ARTILLERY_BIN="${SCRIPT_DIR}/../services/graphql-api/node_modules/.bin/artillery"
elif command -v artillery &>/dev/null; then
  ARTILLERY_BIN="artillery"
else
  echo "❌  Artillery not found."
  echo "   Install it with:"
  echo "     cd services/graphql-api && npm install --save-dev artillery@^2.0.0"
  exit 1
fi

echo "  Artillery:     ${ARTILLERY_BIN}"
echo ""

# ── Choose test file ──────────────────────────────────────────────────────
if [[ "$SMOKE" == true ]]; then
  TEST_FILE="${SCRIPT_DIR}/donation-mutation-smoke.yml"
  OUTPUT_PREFIX="donation-mutation-smoke"
else
  TEST_FILE="${SCRIPT_DIR}/donation-mutation-load-test.yml"
  OUTPUT_PREFIX="donation-mutation"
fi

mkdir -p "$RESULTS_DIR"

JSON_REPORT="${RESULTS_DIR}/${OUTPUT_PREFIX}-${TIMESTAMP}.json"
HTML_REPORT="${RESULTS_DIR}/${OUTPUT_PREFIX}-${TIMESTAMP}.html"

ARTILLERY_CMD=(
  "$ARTILLERY_BIN" run
  "$TEST_FILE"
  --output "$JSON_REPORT"
)

echo "  Test file:     ${TEST_FILE}"
echo "  JSON report:   ${JSON_REPORT}"
echo "  HTML report:   ${HTML_REPORT}"
echo ""

if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN — command that would be executed:"
  echo "  ${ARTILLERY_CMD[*]}"
  exit 0
fi

# ── Run the test ──────────────────────────────────────────────────────────
echo "Starting load test at $(date)…"
echo ""

export GRAPHQL_URL CAMPAIGN_ID CONTRIBUTOR_ADDR AUTH_TOKEN

EXIT_CODE=0
"${ARTILLERY_CMD[@]}" || EXIT_CODE=$?

# ── Generate HTML report ──────────────────────────────────────────────────
if [[ -f "$JSON_REPORT" ]]; then
  echo ""
  echo "Generating HTML report…"
  "$ARTILLERY_BIN" report "$JSON_REPORT" --output "$HTML_REPORT" 2>/dev/null || \
    echo "  (HTML report generation skipped — open $JSON_REPORT manually)"
fi

# ── Print outcome ─────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "  ✅  Load test PASSED"
else
  echo "  ❌  Load test FAILED (exit code $EXIT_CODE)"
  echo "  Review $JSON_REPORT for per-phase metrics."
  echo "  See performance/RESULTS.md for bottleneck investigation steps."
fi
echo ""
echo "  Results saved to: $RESULTS_DIR/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $EXIT_CODE
