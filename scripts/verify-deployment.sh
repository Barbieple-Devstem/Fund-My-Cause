#!/usr/bin/env bash
# Verify deployed Soroban contract against source
# Usage: ./scripts/verify-deployment.sh <contract_id> [network]
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info() { echo -e "${BLUE}➜${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }
log_warning() { echo -e "${YELLOW}⚠${NC} $1"; }

CONTRACT_ID="${1:-}"
NETWORK="${2:-testnet}"

if [ -z "$CONTRACT_ID" ]; then
  echo "Usage: $0 <contract_id> [network]"
  echo "Example: $0 CC3D... testnet"
  exit 1
fi

log_info "Verifying contract $CONTRACT_ID on $NETWORK"

# ── 1. Fetch on-chain WASM hash ───────────────────────────────────────────────
log_info "Fetching on-chain WASM hash..."
CONTRACT_INFO=$(stellar contract info --id "$CONTRACT_ID" --network "$NETWORK" 2>&1)
ONCHAIN_HASH=$(echo "$CONTRACT_INFO" | grep -oiE 'hash:\s*[0-9a-f]{64}' | awk '{print $2}' || echo "")

if [ -z "$ONCHAIN_HASH" ]; then
  log_warning "Could not extract on-chain hash. Attempting alternate method..."
  ONCHAIN_HASH=$(echo "$CONTRACT_INFO" | grep -oiE '[0-9a-f]{64}' | head -1 || echo "")
fi

if [ -z "$ONCHAIN_HASH" ]; then
  log_error "Failed to retrieve on-chain WASM hash"
  exit 1
fi
log_success "On-chain hash: $ONCHAIN_HASH"

# ── 2. Identify the correct contract Cargo.toml ──────────────────────────────
log_info "Identifying contract source..."
if [ -f "contracts/crowdfund/Cargo.toml" ]; then
  CONTRACT_DIR="contracts/crowdfund"
elif [ -f "contracts/registry/Cargo.toml" ]; then
  CONTRACT_DIR="contracts/registry"
else
  log_error "No contract source found in contracts/"
  exit 1
fi
log_success "Contract source: $CONTRACT_DIR"

# ── 3. Build from source ─────────────────────────────────────────────────────
log_info "Building WASM from source..."
cargo build --release --target wasm32-unknown-unknown --manifest-path "$CONTRACT_DIR/Cargo.toml" 2>&1 | tail -3

WASM_FILE="target/wasm32-unknown-unknown/release/$(basename "$CONTRACT_DIR").wasm"
if [ ! -f "$WASM_FILE" ]; then
  log_error "WASM file not found: $WASM_FILE"
  exit 1
fi

LOCAL_HASH=$(sha256sum "$WASM_FILE" | awk '{print $1}')
log_success "Local hash: $LOCAL_HASH"

# ── 4. Compare ────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "  On-chain: ${ONCHAIN_HASH}"
echo -e "  Local:    ${LOCAL_HASH}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$ONCHAIN_HASH" = "$LOCAL_HASH" ]; then
  log_success "HASHES MATCH — deployment is verified against source"
  STATUS="verified"
else
  log_warning "Hash mismatch! This may mean:"
  log_warning "  - Different git commit than deployment"
  log_warning "  - Different Rust toolchain version"
  log_warning "  - Non-reproducible build (check CI)"
  STATUS="mismatch"
fi

# ── 5. Generate verification report ───────────────────────────────────────────
COMMIT_SHA=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
REPORT_FILE="verify-${CONTRACT_ID:0:8}-$(date +%s).json"

cat > "$REPORT_FILE" << REPORT_EOF
{
  "contract_id": "$CONTRACT_ID",
  "network": "$NETWORK",
  "verification_timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "source_commit": "$COMMIT_SHA",
  "onchain_hash": "$ONCHAIN_HASH",
  "local_hash": "$LOCAL_HASH",
  "status": "$STATUS",
  "toolchain": "$(rustc --version 2>/dev/null || echo 'unknown')"
}
REPORT_EOF

log_success "Verification report saved: $REPORT_FILE"

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║${NC}                  ${GREEN}VERIFICATION COMPLETE${NC}                        ${BLUE}║${NC}"
echo -e "${BLUE}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC} Contract:          ${GREEN}$CONTRACT_ID${NC}"
echo -e "${BLUE}║${NC} Network:           ${GREEN}$NETWORK${NC}"
echo -e "${BLUE}║${NC} Status:            ${GREEN}$STATUS${NC}"
echo -e "${BLUE}║${NC} Report:            ${GREEN}$REPORT_FILE${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
