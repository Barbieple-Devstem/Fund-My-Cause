# Fund-My-Cause Local Development Setup Guide

> **Single source of truth for onboarding and local development across all monorepo workspaces.**

Fund-My-Cause is a monorepo consisting of Soroban smart contracts, a Next.js frontend, Node.js microservices, Python scoring engines, and shared TypeScript libraries. This guide covers environment configuration, installation, contract compilation, and service startup for all components.

---

## Table of Contents

1. [Monorepo Architecture Overview](#monorepo-architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quickstart (5-Minute Setup)](#quickstart-5-minute-setup)
4. [Workspace Setup & Execution](#workspace-setup--execution)
   - [Contracts (`contracts/`)](#1-smart-contracts-contracts)
   - [Frontend (`apps/interface`)](#2-frontend-application-appsinterface)
   - [GraphQL API Service (`services/graphql-api`)](#3-graphql-api-service-servicesgraphql-api)
   - [Indexer Service (`services/indexer`)](#4-blockchain-indexer-servicesindexer)
   - [Monitoring Service (`services/monitoring-service`)](#5-monitoring-service-servicesmonitoring-service)
   - [Python Engines (`backend/`)](#6-backend-python-services-backend)
   - [SDKs & Packages (`sdks/`, `packages/`)](#7-sdks--shared-packages)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Docker & Containerized Stack](#docker--containerized-stack)
7. [Testing & Quality Checks](#testing--quality-checks)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Monorepo Architecture Overview

```
Fund-My-Cause/
├── apps/
│   ├── interface/              # Next.js 16 App Router UI (Tailwind CSS, Freighter)
│   └── components-lib/         # Shared UI React component library
├── backend/
│   ├── fraud_detection/        # Python pipeline for Sybil & donation fraud detection
│   └── recommendations/        # Python campaign ranking & scoring engine
├── contracts/
│   ├── crowdfund/              # Core crowdfunding Soroban smart contract (Rust)
│   ├── registry/               # Campaign registry & discovery contract (Rust)
│   └── achievements/           # Gamification / NFT badges contract (Rust)
├── packages/
│   ├── shared-utils/           # Cross-package utility functions & logging helpers
│   └── types/                  # Shared TypeScript data models & schemas
├── sdks/
│   └── js/                     # JavaScript/TypeScript SDK for contract interaction
├── services/
│   ├── graphql-api/            # Apollo Server 4 GraphQL API with Redis caching & WS
│   ├── indexer/                # Soroban RPC event listener & ingestion daemon
│   └── monitoring-service/     # APM, metrics exporter, and health monitoring
└── docker-compose.yml          # Local infra (PostgreSQL, Redis)
```

---

## Prerequisites

Ensure the following tools are installed on your machine:

| Tool | Version | Purpose | Installation |
|------|---------|---------|--------------|
| **Node.js** | 20.x or higher | Frontend, services, SDKs | [nodejs.org](https://nodejs.org) or `nvm install 20` |
| **npm** | 9.x or higher | Monorepo package management | Included with Node.js |
| **Rust & Cargo** | 1.70+ | Smart contract compilation | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| **wasm32 target** | Latest | WebAssembly contract target | `rustup target add wasm32-unknown-unknown` |
| **Stellar CLI** | 21.0+ | Contract deployment & RPC | `cargo install --locked stellar-cli --features opt` |
| **Python** | 3.10+ | Backend fraud & recommendation | [python.org](https://python.org) |
| **Docker & Compose** | Latest | PostgreSQL & Redis services | [docker.com](https://www.docker.com/) |
| **Freighter Wallet** | Latest | Browser extension for Stellar auth | [freighter.app](https://www.freighter.app/) |

---

## Quickstart (5-Minute Setup)

For contributors wanting to get up and running immediately with mock data:

```bash
# 1. Clone the repository
git clone https://github.com/Fund-My-Cause/Fund-My-Cause.git
cd Fund-My-Cause

# 2. Install monorepo dependencies
npm install

# 3. Build smart contracts into WASM
npm run contracts:build

# 4. Generate local test fixtures
npm run fixtures:generate

# 5. Start the frontend
npm run dev
```

Visit `http://localhost:3000` to interact with the UI using local mock data.

---

## Workspace Setup & Execution

### 1. Smart Contracts (`contracts/`)

Contracts are written in Rust for the Stellar Soroban runtime.

#### Build
```bash
# Build all contracts via root script
npm run contracts:build

# Or build manually using cargo
cargo build --release --target wasm32-unknown-unknown
```

WASM artifacts are generated in `target/wasm32-unknown-unknown/release/`.

#### Run Contract Tests
```bash
# Run unit & integration tests across all Rust crates
npm run contracts:test
```

#### Deploying & Seeding Testnet
```bash
# Generate a testnet account and fund it via Friendbot
stellar keys generate --network testnet --name dev-deployer
stellar keys address dev-deployer

# Set credentials
export CREATOR=$(stellar keys address dev-deployer)
export TOKEN="CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

# Seed testnet with sample campaigns and generate apps/interface/.env.local
./scripts/seed-testnet.sh --creator "$CREATOR" --token "$TOKEN"
```

---

### 2. Frontend Application (`apps/interface`)

Next.js 16 application with Tailwind CSS and Stellar Freighter wallet integration.

#### Configuration
```bash
cp apps/interface/.env.example apps/interface/.env.local
```

Key `.env.local` variables:
```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_HORIZON_URL=https://horizon-testnet.stellar.org
NEXT_PUBLIC_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_REGISTRY_ID=C... # Generated by seed script or deploy.sh
NEXT_PUBLIC_GRAPHQL_URL=http://localhost:4000/graphql
```

#### Running Dev Server
```bash
# From monorepo root
npm run dev

# Or directly in workspace
npm run dev --workspace=apps/interface
```
Access at `http://localhost:3000`.

---

### 3. GraphQL API Service (`services/graphql-api`)

Apollo Server 4 / Express service providing query aggregation, Redis caching, and WebSocket subscriptions.

#### Infrastructure Dependency
Start Redis:
```bash
docker compose up -d redis
```

#### Configuration
```bash
cp services/graphql-api/.env.example services/graphql-api/.env
```

Ensure `JWT_SECRET` is at least 32 characters long and not a default value:
```env
PORT=4000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
RPC_URL=https://soroban-testnet.stellar.org
CONTRACT_NETWORK=testnet
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long_12345
CORS_ORIGIN=http://localhost:3000,http://localhost:5173
```

#### Running GraphQL Service
```bash
# Start in development mode
npm run dev --workspace=services/graphql-api
```
GraphQL Playground / Endpoint: `http://localhost:4000/graphql`  
Health check: `http://localhost:4000/health`

#### Generate Schema Documentation
```bash
npm run docs:generate --workspace=services/graphql-api
```

---

### 4. Blockchain Indexer (`services/indexer`)

Event listener and ingestion daemon that scans Soroban contract events and syncs state to PostgreSQL.

#### Infrastructure Dependency
Start PostgreSQL:
```bash
docker compose up -d postgres
```

#### Configuration
```bash
cp services/indexer/.env.example services/indexer/.env
```
```env
PORT=3001
DATABASE_URL=postgresql://fundmycause:fundmycause123@localhost:5432/fundmycause
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NETWORK=testnet
POLL_INTERVAL_MS=3000
```

#### Running Indexer
```bash
npm run dev --workspace=services/indexer
```

---

### 5. Monitoring Service (`services/monitoring-service`)

Metrics aggregator, health monitor, and OpenTelemetry / Prometheus APM exporter.

#### Configuration & Startup
```bash
cp services/monitoring-service/.env.example services/monitoring-service/.env
npm run dev --workspace=services/monitoring-service
```
Metrics endpoint: `http://localhost:9090/metrics`

---

### 6. Backend Python Services (`backend/`)

Python modules for fraud detection and quadratic funding / campaign recommendation scoring.

#### Setup Virtual Environment
```bash
# Create and activate Python virtual environment
python3 -m venv venv
source venv/bin/activate # Windows: .\venv\Scripts\activate

# Install dependencies
pip install -r backend/fraud_detection/requirements.txt
pip install -r backend/recommendations/requirements.txt
```

#### Running Recommendations Engine
```bash
python backend/recommendations/service.py
```

#### Running Python Tests
```bash
pytest backend/fraud_detection/
pytest backend/recommendations/
```

---

### 7. SDKs & Shared Packages

When modifying `@fund-my-cause/sdk`, `@fund-my-cause/types`, or `@fund-my-cause/shared-utils`:

```bash
# Build shared types
cd packages/types && npm run build

# Build shared utilities
cd packages/shared-utils && npm run build

# Build JavaScript SDK
cd sdks/js && npm run build
```

---

## Environment Variables Reference

| Workspace | File | Key Variables | Description |
|-----------|------|---------------|-------------|
| **Root** | `.env` | `DATABASE_URL`, `REDIS_URL`, `COMPOSE_PROJECT_NAME` | Global Docker Compose and infrastructure config |
| **`apps/interface`** | `.env.local` | `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_REGISTRY_ID`, `NEXT_PUBLIC_NETWORK` | Frontend contract IDs, network selectors, API URLs |
| **`services/graphql-api`** | `.env` | `PORT`, `REDIS_URL`, `RPC_URL`, `JWT_SECRET` (>=32 chars), `CORS_ORIGIN` | GraphQL Apollo server configuration |
| **`services/indexer`** | `.env` | `DATABASE_URL`, `STELLAR_RPC_URL`, `NETWORK`, `POLL_INTERVAL_MS` | Blockchain event ingestion parameters |
| **`services/monitoring-service`**| `.env` | `PORT`, `LOG_LEVEL`, `METRICS_PORT` | Prometheus and APM monitoring flags |

---

## Docker & Containerized Stack

You can launch the complete local stack (Postgres, Redis, GraphQL API, Indexer, Frontend) using Docker Compose:

```bash
# Start all backing services (PostgreSQL, Redis)
docker compose up -d postgres redis

# Or start the full stack including containers
docker compose -f docker-compose.full.yml up --build
```

---

## Testing & Quality Checks

Run the following checks before committing code:

```bash
# 1. Smart Contract Tests
npm run contracts:test

# 2. Frontend Linting & Typecheck
npm run lint --workspace=apps/interface

# 3. End-to-End Tests (Playwright)
npm run test:e2e

# 4. Secret Scan & Git Hooks
npx lint-staged
```

---

## Troubleshooting Guide

### 1. `stellar: command not found` or `soroban: command not found`
- **Cause**: The Stellar CLI binary is not in your system `$PATH`.
- **Solution**: Install via Cargo:
  ```bash
  cargo install --locked stellar-cli --features opt
  ```
  Ensure `~/.cargo/bin` is in your `PATH` (`export PATH="$HOME/.cargo/bin:$PATH"`).

### 2. `error[E0463]: can't find crate for 'core' target 'wasm32-unknown-unknown'`
- **Cause**: WebAssembly compilation target is missing in your Rust toolchain.
- **Solution**:
  ```bash
  rustup target add wasm32-unknown-unknown
  ```

### 3. `JWT_SECRET must be at least 32 characters for secure operation`
- **Cause**: `services/graphql-api` validates `JWT_SECRET` on startup and rejects empty, short (<32 chars), or example default keys.
- **Solution**: Generate a strong 32+ character key in `services/graphql-api/.env`:
  ```bash
  openssl rand -hex 32
  ```

### 4. `Redis Connection Error / ECONNREFUSED 127.0.0.1:6379`
- **Cause**: Redis server is not running.
- **Solution**: Start Redis using Docker Compose:
  ```bash
  docker compose up -d redis
  ```
  Note: `services/graphql-api` will automatically fall back to an in-memory rate limiter if `REDIS_URL` is omitted.

### 5. Frontend shows "No campaigns found" or "Contract not found"
- **Cause**: `.env.local` contains placeholder contract IDs or testnet contracts were not deployed.
- **Solution**:
  - For mock UI development: Run `npm run fixtures:generate`
  - For real testnet interaction: Run `./scripts/seed-testnet.sh` to populate fresh testnet contract IDs into `apps/interface/.env.local`.

### 6. Friendbot funding failure
- **Cause**: Stellar Friendbot rate limiting or network congestion.
- **Solution**: Visit `https://friendbot.stellar.org/?addr=<YOUR_STELLAR_ADDRESS>` in your browser or retry after a few seconds.

---

## Additional Resources

- [Contributing Guidelines](../CONTRIBUTING.md)
- [System Architecture](./architecture.md)
- [API Reference](./api/README.md)
- [GraphQL API Reference](./api/graphql.md)
- [Security Model](./security-model.md)
