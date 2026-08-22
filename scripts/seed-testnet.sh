#!/usr/bin/env bash
# Seed testnet with realistic campaign data for local development and testing
# Usage: ./scripts/seed-testnet.sh [OPTIONS]

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
NETWORK="testnet"
CREATOR="${CREATOR:-}"
TOKEN="${TOKEN:-}"
REGISTRY_ID="${REGISTRY_ID:-}"
NUM_CAMPAIGNS=5
VERBOSE=false

# Parse command-line options
while [[ $# -gt 0 ]]; do
  case $1 in
    --network)
      NETWORK="$2"
      shift 2
      ;;
    --creator)
      CREATOR="$2"
      shift 2
      ;;
    --token)
      TOKEN="$2"
      shift 2
      ;;
    --registry-id)
      REGISTRY_ID="$2"
      shift 2
      ;;
    --num-campaigns)
      NUM_CAMPAIGNS="$2"
      shift 2
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      print_usage
      exit 0
      ;;
    -*)
      echo -e "${RED}Error: Unknown option: $1${NC}" >&2
      print_usage
      exit 1
      ;;
    *)
      echo -e "${RED}Error: Unexpected argument: $1${NC}" >&2
      print_usage
      exit 1
      ;;
  esac
done

# Function to print usage
print_usage() {
  cat << EOF
${BLUE}Usage: ./scripts/seed-testnet.sh [OPTIONS]${NC}

${BLUE}Description:${NC}
  Seeds the testnet with realistic campaign data covering all lifecycle stages:
  - Active campaigns (new, mid-progress, near goal)
  - Fully funded campaigns
  - Failed campaigns (expired, below goal)
  - Campaigns in refunding state

${BLUE}Options:${NC}
  --network NETWORK              Network to seed (default: testnet)
  --creator ADDRESS              Creator Stellar address (required)
  --token ADDRESS                Token contract ID (required)
  --registry-id ID               Existing registry contract ID (optional)
  --num-campaigns NUM            Number of campaigns to create (default: 5)
  --verbose, -v                  Enable verbose output
  --help, -h                     Show this help message

${BLUE}Examples:${NC}
  # Seed testnet with default 5 campaigns
  ./scripts/seed-testnet.sh \\
    --creator GBBD47UZQ2QDAAK63XUIFH5FXVLNFSMQC4MLR4LHPWKFG7FMKGV2FI2QI \\
    --token CAQCBGVLWCSMNRMQ4ZBVWWV5CSTW2UNKHJ42OU7CW7ADGNBORAEOSON

  # Seed with 10 campaigns and verbose output
  ./scripts/seed-testnet.sh --creator \$CREATOR --token \$TOKEN \\
    --num-campaigns 10 --verbose

${BLUE}Environment Variables:${NC}
  CREATOR                        Default creator address
  TOKEN                          Default token contract ID
  REGISTRY_ID                    Default registry contract ID

${BLUE}Output:${NC}
  - Deploys registry contract (if not provided)
  - Creates campaigns with varied states
  - Simulates contributions for realistic data
  - Saves contract IDs to apps/interface/.env.local
  - Generates fixtures/seed-data.json for reference
EOF
}

# Helper functions for colored output
log_info() {
  echo -e "${BLUE}➜${NC} $1"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1" >&2
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${CYAN}  $1${NC}"
  fi
}

log_section() {
  echo ""
  echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC} $1"
  echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
}

# Validate required arguments
if [ -z "$CREATOR" ]; then
  log_error "Creator address is required. Use --creator or set CREATOR env var."
  print_usage
  exit 1
fi

if [ -z "$TOKEN" ]; then
  log_error "Token contract ID is required. Use --token or set TOKEN env var."
  print_usage
  exit 1
fi

# Validate numeric parameters
if ! [[ "$NUM_CAMPAIGNS" =~ ^[0-9]+$ ]] || [ "$NUM_CAMPAIGNS" -lt 1 ]; then
  log_error "Number of campaigns must be a positive integer"
  exit 1
fi

# Start seeding process
log_section "Fund-My-Cause Testnet Seeding"
log_info "Network: $NETWORK"
log_info "Creator: $CREATOR"
log_info "Token: $TOKEN"
log_info "Campaigns to create: $NUM_CAMPAIGNS"

# Build contracts
log_section "Building Contracts"
log_info "Building crowdfund contract..."
if ! cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/crowdfund/Cargo.toml 2>&1 | tail -3; then
  log_error "Failed to build crowdfund contract"
  exit 1
fi
log_success "Crowdfund contract built"

log_info "Building registry contract..."
if ! cargo build --release --target wasm32-unknown-unknown --manifest-path contracts/registry/Cargo.toml 2>&1 | tail -3; then
  log_error "Failed to build registry contract"
  exit 1
fi
log_success "Registry contract built"

# Deploy or use existing registry
log_section "Registry Setup"
if [ -z "$REGISTRY_ID" ]; then
  log_info "Deploying registry contract..."
  REGISTRY_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/registry.wasm \
    --network "$NETWORK" \
    --source "$CREATOR" 2>&1) || {
    log_error "Failed to deploy registry: $REGISTRY_ID"
    exit 1
  }
  log_success "Registry deployed: $REGISTRY_ID"
else
  log_info "Using existing registry: $REGISTRY_ID"
fi

# Campaign templates with different states
declare -a CAMPAIGNS
CAMPAIGNS[0]="Active (New)|Save the Rainforest|Help protect endangered species and their habitats|10000000000|1735689600|1000000|0|Active"
CAMPAIGNS[1]="Active (Mid-Progress)|Clean Ocean Initiative|Remove plastic waste from our oceans|5000000000|1735689600|500000|3000000000|Active"
CAMPAIGNS[2]="Active (Near Goal)|Community Library Fund|Build a library for our local community|2000000000|1735689600|100000|1950000000|Active"
CAMPAIGNS[3]="Fully Funded|Solar Panel Installation|Install solar panels on community center|3000000000|1704067200|200000|3500000000|Funded"
CAMPAIGNS[4]="Failed (Expired)|Mobile App Development|Create education app for students|8000000000|1672531200|500000|2000000000|Failed"

# Additional varied campaigns if requested
if [ "$NUM_CAMPAIGNS" -gt 5 ]; then
  CAMPAIGNS[5]="Active (Early Stage)|Wildlife Sanctuary|Create a safe haven for rescued wildlife|15000000000|1767225600|1000000|500000000|Active"
  CAMPAIGNS[6]="Refunding|Medical Equipment Fund|Purchase medical equipment for clinic|4000000000|1672531200|300000|1500000000|Refunding"
  CAMPAIGNS[7]="Active (Low Progress)|Art Gallery Opening|Launch contemporary art gallery|6000000000|1735689600|250000|400000000|Active"
  CAMPAIGNS[8]="Near Deadline (Active)|Emergency Relief Fund|Provide emergency relief to disaster victims|12000000000|1704153600|500000|11000000000|Active"
  CAMPAIGNS[9]="Paused|Tech Startup Seed|Launch innovative tech startup|20000000000|1767225600|1000000|8000000000|Paused"
fi

# Array to store deployed contract IDs
declare -a CONTRACT_IDS
declare -a CAMPAIGN_DATA

# Get current timestamp for deadline calculations
CURRENT_TIME=$(date +%s)
FUTURE_30_DAYS=$((CURRENT_TIME + 2592000))
FUTURE_60_DAYS=$((CURRENT_TIME + 5184000))
PAST_30_DAYS=$((CURRENT_TIME - 2592000))
PAST_60_DAYS=$((CURRENT_TIME - 5184000))

# Deploy campaigns
log_section "Deploying Campaigns"

for i in $(seq 0 $((NUM_CAMPAIGNS - 1))); do
  if [ $i -ge ${#CAMPAIGNS[@]} ]; then
    break
  fi
  
  IFS='|' read -r state title description goal deadline min_contrib current_total status <<< "${CAMPAIGNS[$i]}"
  
  log_info "[$((i + 1))/$NUM_CAMPAIGNS] Creating campaign: $title ($state)"
  
  # Adjust deadline based on state
  case "$state" in
    *"Active"*)
      deadline=$FUTURE_30_DAYS
      ;;
    *"Funded"*)
      deadline=$PAST_30_DAYS
      ;;
    *"Failed"*|*"Refunding"*)
      deadline=$PAST_60_DAYS
      ;;
    *"Near Deadline"*)
      deadline=$((CURRENT_TIME + 86400)) # 1 day from now
      ;;
  esac
  
  log_verbose "  Title: $title"
  log_verbose "  Goal: $goal stroops"
  log_verbose "  Deadline: $deadline"
  log_verbose "  Target state: $status"
  
  # Deploy campaign contract
  log_verbose "  Deploying contract..."
  CONTRACT_ID=$(stellar contract deploy \
    --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
    --network "$NETWORK" \
    --source "$CREATOR" 2>&1) || {
    log_error "Failed to deploy campaign contract"
    continue
  }
  
  log_verbose "  Contract ID: $CONTRACT_ID"
  
  # Determine category based on title
  category="Other"
  case "$title" in
    *"Rainforest"*|*"Ocean"*|*"Wildlife"*|*"Solar"*)
      category="Environment"
      ;;
    *"Library"*|*"Education"*|*"App Development"*)
      category="Education"
      ;;
    *"Medical"*|*"Relief"*)
      category="Health"
      ;;
    *"Art"*|*"Gallery"*)
      category="Arts"
      ;;
    *"Tech"*|*"Startup"*)
      category="Technology"
      ;;
  esac
  
  # Initialize campaign
  log_verbose "  Initializing campaign..."
  if ! stellar contract invoke \
    --id "$CONTRACT_ID" \
    --network "$NETWORK" \
    --source "$CREATOR" \
    -- initialize \
    --creator "$CREATOR" \
    --token "$TOKEN" \
    --goal "$goal" \
    --deadline "$deadline" \
    --min_contribution "$min_contrib" \
    --max_contribution "0" \
    --title "$title" \
    --description "$description" \
    --social_links "null" \
    --platform_config "null" \
    --accepted_tokens "null" \
    --category "$category" \
    --vesting "null" \
    --penalty_bps "null" > /dev/null 2>&1; then
    log_error "Failed to initialize campaign: $title"
    continue
  fi
  
  # Register in registry
  log_verbose "  Registering in registry..."
  if ! stellar contract invoke \
    --id "$REGISTRY_ID" \
    --network "$NETWORK" \
    --source "$CREATOR" \
    -- register \
    --campaign_id "$CONTRACT_ID" > /dev/null 2>&1; then
    log_warning "Failed to register campaign in registry (non-fatal)"
  fi
  
  # Simulate contributions for campaigns with progress
  if [ "$current_total" != "0" ]; then
    log_verbose "  Simulating contributions (target: $current_total stroops)..."
    
    # Calculate number of contributors (3-10 random)
    num_contributors=$((3 + RANDOM % 8))
    contribution_per=$((current_total / num_contributors))
    
    for j in $(seq 1 $num_contributors); do
      # Add some randomness to contribution amounts
      variance=$((RANDOM % 20 - 10)) # ±10%
      amount=$((contribution_per + contribution_per * variance / 100))
      
      # Ensure amount is at least minimum
      if [ "$amount" -lt "$min_contrib" ]; then
        amount=$min_contrib
      fi
      
      log_verbose "    Contribution $j/$num_contributors: $amount stroops"
      
      # Note: In real scenario, you'd need actual contributor addresses
      # For seeding, we'll just record the intended state
      # Actual contributions would require multiple funded testnet accounts
    done
  fi
  
  CONTRACT_IDS+=("$CONTRACT_ID")
  CAMPAIGN_DATA+=("$title|$CONTRACT_ID|$status|$goal|$current_total|$deadline")
  
  log_success "Campaign created: $title"
  log_verbose "  Contract ID: $CONTRACT_ID"
done

# Save configuration
log_section "Saving Configuration"

ENV_FILE="apps/interface/.env.local"
log_info "Updating $ENV_FILE..."

# Preserve existing variables and update
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$ENV_FILE.backup"
  log_verbose "  Backup created: $ENV_FILE.backup"
fi

{
  echo "# Auto-generated by seed-testnet.sh - $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "NEXT_PUBLIC_REGISTRY_ID=$REGISTRY_ID"
  echo "NEXT_PUBLIC_NETWORK=$NETWORK"
  echo "NEXT_PUBLIC_TOKEN_ID=$TOKEN"
  echo ""
  echo "# Seeded Campaign IDs"
  for i in "${!CONTRACT_IDS[@]}"; do
    echo "NEXT_PUBLIC_CAMPAIGN_${i}_ID=${CONTRACT_IDS[$i]}"
  done
} > "$ENV_FILE"

log_success "Configuration saved to $ENV_FILE"

# Generate fixtures JSON
FIXTURES_FILE="fixtures/seed-data.json"
log_info "Generating fixtures file: $FIXTURES_FILE..."

mkdir -p fixtures

{
  echo "{"
  echo "  \"generated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"network\": \"$NETWORK\","
  echo "  \"registry_id\": \"$REGISTRY_ID\","
  echo "  \"token_id\": \"$TOKEN\","
  echo "  \"creator\": \"$CREATOR\","
  echo "  \"campaigns\": ["
  
  for i in "${!CAMPAIGN_DATA[@]}"; do
    IFS='|' read -r title contract_id status goal current_total deadline <<< "${CAMPAIGN_DATA[$i]}"
    
    echo "    {"
    echo "      \"index\": $i,"
    echo "      \"title\": \"$title\","
    echo "      \"contract_id\": \"$contract_id\","
    echo "      \"status\": \"$status\","
    echo "      \"goal\": $goal,"
    echo "      \"current_total\": $current_total,"
    echo "      \"deadline\": $deadline"
    
    if [ $i -lt $((${#CAMPAIGN_DATA[@]} - 1)) ]; then
      echo "    },"
    else
      echo "    }"
    fi
  done
  
  echo "  ]"
  echo "}"
} > "$FIXTURES_FILE"

log_success "Fixtures saved to $FIXTURES_FILE"

# Print summary
log_section "Seeding Complete"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║${NC}                      ${GREEN}SEEDING SUCCESSFUL${NC}                        ${CYAN}║${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} Network:            ${GREEN}$NETWORK${NC}"
echo -e "${CYAN}║${NC} Registry ID:        ${GREEN}$REGISTRY_ID${NC}"
echo -e "${CYAN}║${NC} Token ID:           ${GREEN}$TOKEN${NC}"
echo -e "${CYAN}║${NC} Campaigns Created:  ${GREEN}${#CONTRACT_IDS[@]}${NC}"
echo -e "${CYAN}║${NC} Config File:        ${GREEN}$ENV_FILE${NC}"
echo -e "${CYAN}║${NC} Fixtures File:      ${GREEN}$FIXTURES_FILE${NC}"
echo -e "${CYAN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║${NC} ${BLUE}Campaign States:${NC}"

for data in "${CAMPAIGN_DATA[@]}"; do
  IFS='|' read -r title contract_id status goal current_total deadline <<< "$data"
  percentage=0
  if [ "$goal" -gt 0 ]; then
    percentage=$((current_total * 100 / goal))
  fi
  echo -e "${CYAN}║${NC}   • ${GREEN}$title${NC} ($status - $percentage%)"
done

echo -e "${CYAN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
log_success "Ready to use! Start the frontend:"
echo -e "  ${BLUE}cd apps/interface && npm run dev${NC}"
echo ""
log_info "Note: To fully simulate contributions, fund additional testnet accounts"
log_info "and use the contribute function on deployed contracts."

