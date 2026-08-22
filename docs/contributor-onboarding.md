# Contributor Onboarding Walkthrough

Welcome to Fund-My-Cause! This guide will walk you through setting up your local development environment, building the smart contracts, running the frontend, and working with the backend stack.

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Tools

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Git** | 2.30+ | Version control | [git-scm.com](https://git-scm.com/downloads) |
| **Rust** | 1.70+ | Contract development | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **wasm32 target** | - | Compile to WebAssembly | `rustup target add wasm32-unknown-unknown` |
| **Stellar CLI** | 21.0+ | Deploy & interact with contracts | [Installation Guide](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli) |
| **Node.js** | 18+ | Frontend & backend services | [nodejs.org](https://nodejs.org) |
| **npm** | 9+ | Package manager | Included with Node.js |

### Optional Tools

- **Docker** (recommended) — for running the full stack locally
- **Freighter Wallet** — for testing frontend wallet integration ([freighter.app](https://www.freighter.app/))
- **PostgreSQL** (optional) — for backend/indexer development

---

## Step 1: Fork and Clone the Repository

1. **Fork the repository** on GitHub:
   - Navigate to [github.com/Fund-My-Cause/Fund-My-Cause](https://github.com/Fund-My-Cause/Fund-My-Cause)
   - Click "Fork" in the top-right corner

2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Fund-My-Cause.git
   cd Fund-My-Cause
   ```

3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/Fund-My-Cause/Fund-My-Cause.git
   git fetch upstream
   ```

4. **Create a feature branch**:
   ```bash
   git checkout -b feat/your-feature-name
   ```

---

## Step 2: Build the Smart Contracts

### Build the WASM Binaries

1. **Navigate to the project root** (if not already there):
   ```bash
   cd Fund-My-Cause
   ```

2. **Build the contracts**:
   ```bash
   cargo build --release --target wasm32-unknown-unknown
   ```

   This compiles both the `crowdfund` and `registry` contracts to WebAssembly. The output will be in:
   - `target/wasm32-unknown-unknown/release/crowdfund.wasm`
   - `target/wasm32-unknown-unknown/release/registry.wasm`

3. **Run the contract tests**:
   ```bash
   cargo test --workspace
   ```

   Expected output:
   ```
   running 87 tests
   test result: ok. 87 passed; 0 failed; 0 ignored; 0 measured
   ```

### Optimize the WASM (Optional)

For production deployment, optimize the WASM file:

```bash
cargo install --locked soroban-cli
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm
```

---

## Step 3: Deploy Contracts to Testnet

### Set Up Stellar CLI

1. **Configure the testnet network**:
   ```bash
   stellar network add testnet \
     --rpc-url https://soroban-testnet.stellar.org:443 \
     --network-passphrase "Test SDF Network ; September 2015"
   ```

2. **Generate or import an identity** (for the creator account):
   ```bash
   stellar keys generate creator --network testnet
   stellar keys address creator
   ```

   Save the displayed address. You'll need testnet XLM for gas fees.

3. **Fund the account** using the Stellar friendbot:
   ```bash
   curl "https://friendbot.stellar.org?addr=$(stellar keys address creator)"
   ```

### Deploy the Crowdfund Contract

1. **Deploy the contract**:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/crowdfund.wasm \
     --source creator \
     --network testnet
   ```

   Save the output contract ID (e.g., `CCAMPAIGNCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXX`).

2. **Deploy the Registry Contract**:
   ```bash
   stellar contract deploy \
     --wasm target/wasm32-unknown-unknown/release/registry.wasm \
     --source creator \
     --network testnet
   ```

   Save the registry contract ID.

### Initialize a Test Campaign

1. **Create a test campaign**:
   ```bash
   stellar contract invoke \
     --id <CROWDFUND_CONTRACT_ID> \
     --source creator \
     --network testnet \
     -- initialize \
     --creator $(stellar keys address creator) \
     --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
     --goal 1000000000 \
     --deadline $(($(date +%s) + 2592000)) \
     --min_contribution 10000000 \
     --max_contribution 0 \
     --title '"Test Campaign"' \
     --description '"A test campaign for development"' \
     --social_links null \
     --platform_config null \
     --accepted_tokens null \
     --category Technology \
     --vesting null \
     --penalty_bps null
   ```

   *(Replace `<CROWDFUND_CONTRACT_ID>` with your deployed contract ID)*

2. **Verify the campaign**:
   ```bash
   stellar contract invoke \
     --id <CROWDFUND_CONTRACT_ID> \
     --network testnet \
     -- get_campaign_info
   ```

---

## Step 4: Run the Frontend

### Install Dependencies

1. **Navigate to the frontend directory**:
   ```bash
   cd apps/interface
   ```

2. **Install npm packages**:
   ```bash
   npm install
   ```

### Configure Environment Variables

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env.local
   ```

2. **Edit `.env.local`** with your contract IDs:
   ```env
   NEXT_PUBLIC_CONTRACT_ID=<YOUR_CROWDFUND_CONTRACT_ID>
   NEXT_PUBLIC_REGISTRY_CONTRACT_ID=<YOUR_REGISTRY_CONTRACT_ID>
   NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org:443
   NEXT_PUBLIC_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
   NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
   ```

   For detailed configuration options, see [docs/environment-config.md](./environment-config.md).

### Run the Development Server

```bash
npm run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

**Expected Output:**
```
▲ Next.js 15.x.x
- Local:        http://localhost:3000
- ready started server on [::]:3000, url: http://localhost:3000
```

### Test Wallet Integration

1. **Install Freighter Wallet** browser extension ([freighter.app](https://www.freighter.app/))
2. **Switch to Testnet** in Freighter settings
3. **Import your test identity** (or create a new one and fund it via friendbot)
4. **Open the frontend** and click "Connect Wallet"
5. **Approve the connection** in Freighter

---

## Step 5: Run the Backend Stack

The backend consists of three main services:

1. **Indexer** — ingests Soroban events from the RPC
2. **GraphQL API** — provides fast queries for the frontend
3. **Monitoring Service** — tracks health and metrics

### Option A: Run with Docker Compose (Recommended)

1. **Navigate to the project root**:
   ```bash
   cd ../..  # from apps/interface back to root
   ```

2. **Start all services**:
   ```bash
   docker compose -f docker-compose.full.yml up --build
   ```

   This starts:
   - Indexer service on `http://localhost:3001`
   - GraphQL API on `http://localhost:4000`
   - PostgreSQL database on `localhost:5432`
   - Redis on `localhost:6379`

3. **Verify services are running**:
   ```bash
   # Check indexer health
   curl http://localhost:3001/health

   # Check GraphQL playground
   open http://localhost:4000/graphql
   ```

### Option B: Run Services Individually

#### Run the Indexer

1. **Navigate to the indexer directory**:
   ```bash
   cd services/indexer
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
   CROWDFUND_CONTRACT_ID=<YOUR_CONTRACT_ID>
   PORT=3001
   LOG_LEVEL=info
   ```

4. **Run the indexer**:
   ```bash
   npm run dev
   ```

   **Expected Output:**
   ```
   [INFO] Indexer starting...
   [INFO] Listening on port 3001
   [INFO] Connected to Soroban RPC at https://soroban-testnet.stellar.org:443
   ```

#### Run the GraphQL API

1. **Navigate to the GraphQL API directory**:
   ```bash
   cd ../graphql-api
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env`:
   ```env
   PORT=4000
   INDEXER_URL=http://localhost:3001
   REDIS_URL=redis://localhost:6379
   ```

4. **Run the GraphQL server**:
   ```bash
   npm run dev
   ```

5. **Open the GraphQL Playground**:
   ```bash
   open http://localhost:4000/graphql
   ```

---

## Step 6: Verify Your Setup

### Test Contract Interaction

```bash
# From project root
stellar contract invoke \
  --id <YOUR_CONTRACT_ID> \
  --source creator \
  --network testnet \
  -- get_stats
```

### Test Indexer

```bash
curl http://localhost:3001/health
curl http://localhost:3001/events?limit=10
```

### Test GraphQL API

Visit [http://localhost:4000/graphql](http://localhost:4000/graphql) and run:

```graphql
query {
  campaigns(limit: 10) {
    id
    title
    totalRaised
    goal
    status
  }
}
```

### Test Frontend

1. Open [http://localhost:3000](http://localhost:3000)
2. Connect your Freighter wallet
3. Navigate to a campaign page
4. Try making a test contribution

---

## Step 7: Run Tests

### Contract Tests

```bash
# From project root
cargo test --workspace
```

### Frontend Tests

```bash
cd apps/interface
npm run test
npm run test:coverage  # Check coverage (must be >80%)
```

### E2E Tests (Playwright)

```bash
# From project root
npm install  # Install root dependencies including Playwright
npx playwright install  # Install browser drivers
npm run test:e2e
```

---

## Common Issues and Troubleshooting

### Contract Deployment Fails

**Error:** `transaction submission failed: tx_failed`

**Solution:**
- Ensure your account has sufficient XLM balance for gas fees
- Fund via friendbot: `curl "https://friendbot.stellar.org?addr=$(stellar keys address creator)"`

### Frontend Can't Connect to Contracts

**Error:** `Contract not found` or `RPC error`

**Solution:**
- Verify `NEXT_PUBLIC_CONTRACT_ID` in `.env.local` matches your deployed contract
- Check `NEXT_PUBLIC_RPC_URL` is correct
- Restart the dev server: `npm run dev`

### Indexer Not Receiving Events

**Solution:**
- Verify the `CROWDFUND_CONTRACT_ID` in the indexer's `.env` matches your deployed contract
- Check the RPC URL is reachable: `curl https://soroban-testnet.stellar.org:443`
- Make some test contributions to generate events

### Build Errors with `wasm32-unknown-unknown`

**Error:** `can't find crate for 'core'`

**Solution:**
```bash
rustup target add wasm32-unknown-unknown
cargo clean
cargo build --release --target wasm32-unknown-unknown
```

### Freighter Wallet Not Connecting

**Solution:**
- Ensure Freighter is installed and unlocked
- Switch Freighter to Testnet in settings
- Clear browser cache and reload the page
- Check browser console for errors

---

## Next Steps

Now that your environment is set up:

1. **Read the architecture docs**: [docs/architecture.md](./architecture.md)
2. **Explore the contract API**: [docs/contract-api.md](./contract-api.md)
3. **Review coding standards**: [CONTRIBUTING.md](../CONTRIBUTING.md#code-style)
4. **Pick an issue**: Check [good first issue](https://github.com/Fund-My-Cause/Fund-My-Cause/labels/good%20first%20issue) labels
5. **Join the community**: [Discord](https://discord.gg/fund-my-cause) (if available)

---

## Additional Resources

- [Stellar Documentation](https://developers.stellar.org)
- [Soroban Smart Contracts](https://soroban.stellar.org)
- [Next.js Documentation](https://nextjs.org/docs)
- [Freighter Wallet Documentation](https://docs.freighter.app)
- [Project README](../README.md)

---

**Questions?** Open a [discussion](https://github.com/Fund-My-Cause/Fund-My-Cause/discussions) or reach out in the issues!
