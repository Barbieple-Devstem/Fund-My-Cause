# Backend & Indexer Architecture

This document describes the off-chain backend infrastructure that powers the Fund-My-Cause platform, including the indexer service, GraphQL API, REST API, and supporting infrastructure.

## Overview

The Fund-My-Cause backend is a multi-service architecture that ingests on-chain events from Soroban smart contracts, indexes them into a queryable database, and exposes them via REST and GraphQL APIs.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌───────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │   Next.js     │  │  Mobile App  │  │  Widget Embeds    │   │
│  │   Interface   │  │  (Future)    │  │                   │   │
│  └───────┬───────┘  └──────┬───────┘  └────────┬──────────┘   │
└──────────┼──────────────────┼───────────────────┼──────────────┘
           │                  │                   │
           └──────────────────┴───────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │      API Gateway / CDN         │
              │    (Cloudflare, nginx)         │
              └───────────┬────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
┌─────────▼──────────┐        ┌──────────▼─────────────┐
│   GraphQL API      │        │      REST API          │
│   (Port 4000)      │        │    (Port 3001)         │
│                    │        │                        │
│ • Apollo Server    │        │ • Express Server       │
│ • Real-time Subs   │        │ • OpenAPI/Swagger      │
│ • Query Resolver   │        │ • Read-only Queries    │
└─────────┬──────────┘        └──────────┬─────────────┘
          │                               │
          └───────────────┬───────────────┘
                          │
                ┌─────────▼──────────┐
                │   Redis Cache      │
                │  (Query Caching)   │
                └─────────┬──────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
┌─────────▼───────────┐        ┌─────────▼──────────────┐
│  Indexer Service    │        │   PostgreSQL DB        │
│   (Port 3001)       │        │                        │
│                     │        │ Tables:                │
│ • Event Ingestor    │────────▶ • campaigns           │
│ • RPC Polling       │        │ • contributions        │
│ • Event Parser      │        │ • users                │
└─────────┬───────────┘        │ • events               │
          │                    │ • metadata             │
          │                    └────────────────────────┘
          │
┌─────────▼───────────────────────────────────┐
│         Stellar Soroban RPC                 │
│   https://soroban-testnet.stellar.org      │
│                                             │
│ • getEvents (contract events)               │
│ • getLedgerEntries (contract state)         │
│ • simulateTransaction (validation)          │
└─────────┬───────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────┐
│          Soroban Smart Contracts            │
│                                             │
│ • Crowdfund Contract (campaign logic)       │
│ • Registry Contract (campaign discovery)    │
└─────────────────────────────────────────────┘
```

---

## Services

### 1. Indexer Service

**Purpose:** Ingest and parse contract events from the Stellar blockchain.

**Location:** `services/indexer/`

**Tech Stack:**
- Node.js / TypeScript
- Stellar RPC Client
- PostgreSQL
- Express (health endpoints)

#### Responsibilities

1. **Event Ingestion**
   - Poll Soroban RPC for new contract events
   - Filter events by contract ID
   - Parse event payloads using contract schema

2. **Data Persistence**
   - Store events in PostgreSQL
   - Update campaign state (raised amount, contributor count, status)
   - Maintain contributor records and contribution history

3. **Health Monitoring**
   - Expose `/health` and `/ready` endpoints
   - Track last processed ledger
   - Report event processing metrics

#### Key Components

```typescript
// services/indexer/src/ingestor.ts
class EventIngestor {
  // Poll RPC for new events
  async pollEvents(): Promise<void>
  
  // Parse event payload
  parseEvent(event: ContractEvent): ParsedEvent
  
  // Store in database
  async storeEvent(event: ParsedEvent): Promise<void>
  
  // Update campaign state
  async updateCampaignState(campaignId: string): Promise<void>
}
```

#### Event Types Indexed

| Event Topic | Description | Updates |
|-------------|-------------|---------|
| `initialized` | Campaign created | Insert campaign record |
| `contributed` | New contribution | Increment raised, add contributor |
| `withdrawn` | Funds withdrawn | Mark campaign as successful |
| `refunded` | Contributor refunded | Update contributor status |
| `cancelled` | Campaign cancelled | Update campaign status |
| `metadata_updated` | Metadata changed | Update campaign fields |

#### Configuration

```env
# services/indexer/.env
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
CROWDFUND_CONTRACT_ID=CCAMPAIGNCONTRACT...
REGISTRY_CONTRACT_ID=CREGISTRYCONTRACT...
DATABASE_URL=postgresql://user:pass@localhost:5432/fundmycause
POLL_INTERVAL_MS=5000
START_LEDGER=1000000  # Ledger to start indexing from
LOG_LEVEL=info
```

---

### 2. GraphQL API

**Purpose:** Provide flexible, type-safe queries with real-time subscriptions.

**Location:** `services/graphql-api/`

**Tech Stack:**
- Apollo Server
- TypeScript
- PostgreSQL (via Prisma/Knex)
- Redis (caching)
- GraphQL Subscriptions (WebSocket)

#### Responsibilities

1. **Query Resolution**
   - Resolve GraphQL queries against PostgreSQL
   - Implement filtering, sorting, pagination
   - Join relations efficiently

2. **Real-Time Subscriptions**
   - WebSocket-based subscriptions
   - Publish events when data changes
   - Subscribe to campaign updates, new contributions

3. **Caching**
   - Redis-based query caching
   - Cache frequently accessed campaigns
   - Invalidate cache on state changes

4. **Authentication**
   - JWT-based authentication for mutations
   - Wallet signature verification
   - Role-based access control (RBAC)

#### Key Resolvers

```typescript
// services/graphql-api/src/resolvers.ts
const resolvers = {
  Query: {
    // Get single campaign
    campaign: (_, { id }, context) => context.db.getCampaign(id),
    
    // List campaigns with filtering
    campaigns: (_, { filter, pagination, sort }, context) => 
      context.db.getCampaigns(filter, pagination, sort),
    
    // Get user profile
    user: (_, { address }, context) => 
      context.db.getUserProfile(address),
    
    // Platform statistics
    stats: (_, __, context) => 
      context.db.getPlatformStats(),
  },
  
  Subscription: {
    // Subscribe to new contributions
    newContribution: {
      subscribe: (_, { campaignId }, context) => 
        context.pubsub.asyncIterator(`CONTRIBUTION_${campaignId}`),
    },
    
    // Subscribe to campaign progress
    campaignProgressChanged: {
      subscribe: (_, { id }, context) => 
        context.pubsub.asyncIterator(`PROGRESS_${id}`),
    },
  },
};
```

#### Configuration

```env
# services/graphql-api/.env
PORT=4000
DATABASE_URL=postgresql://user:pass@localhost:5432/fundmycause
REDIS_URL=redis://localhost:6379
INDEXER_URL=http://localhost:3001
JWT_SECRET=your-secret-key
ENABLE_PLAYGROUND=true
ENABLE_INTROSPECTION=true
```

---

### 3. REST API

**Purpose:** Simple, read-only REST endpoints for querying indexed data.

**Location:** `services/indexer/src/rest-api.ts` (embedded in indexer)

**Tech Stack:**
- Express.js
- OpenAPI 3.0 specification
- Swagger UI / ReDoc

#### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/ready` | GET | Readiness probe |
| `/campaigns` | GET | List campaigns with filtering |
| `/campaigns/:id` | GET | Get campaign details |
| `/campaigns/:id/contributions` | GET | List campaign contributions |
| `/stats` | GET | Platform statistics |
| `/api-docs` | GET | Swagger UI |
| `/redoc` | GET | ReDoc UI |

#### Configuration

Same as Indexer Service (embedded).

---

### 4. PostgreSQL Database

**Purpose:** Primary data store for indexed blockchain data.

#### Schema

**campaigns**
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY,
  contract_address VARCHAR(56) UNIQUE NOT NULL,
  creator_address VARCHAR(56) NOT NULL,
  title VARCHAR(128) NOT NULL,
  description TEXT,
  goal BIGINT NOT NULL,
  total_raised BIGINT DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  deadline TIMESTAMP NOT NULL,
  min_contribution BIGINT NOT NULL,
  category VARCHAR(50),
  image_url TEXT,
  video_url TEXT,
  contributor_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_status (status),
  INDEX idx_creator (creator_address),
  INDEX idx_category (category),
  INDEX idx_created (created_at DESC)
);
```

**contributions**
```sql
CREATE TABLE contributions (
  id UUID PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id),
  contributor_address VARCHAR(56) NOT NULL,
  amount BIGINT NOT NULL,
  token_amount BIGINT NOT NULL,
  contributed_at TIMESTAMP NOT NULL,
  tx_hash VARCHAR(64) NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  INDEX idx_campaign (campaign_id),
  INDEX idx_contributor (contributor_address),
  INDEX idx_timestamp (contributed_at DESC)
);
```

**users**
```sql
CREATE TABLE users (
  address VARCHAR(56) PRIMARY KEY,
  total_contributed BIGINT DEFAULT 0,
  contribution_count INT DEFAULT 0,
  campaigns_created INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT NOW(),
  last_activity TIMESTAMP DEFAULT NOW()
);
```

**events**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  contract_id VARCHAR(56) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  ledger_sequence BIGINT NOT NULL,
  transaction_hash VARCHAR(64) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  INDEX idx_contract (contract_id),
  INDEX idx_type (event_type),
  INDEX idx_ledger (ledger_sequence DESC)
);
```

---

### 5. Redis Cache

**Purpose:** Cache frequently accessed queries and reduce database load.

#### Cache Strategy

1. **Query Caching**
   - Cache campaign list queries for 30 seconds
   - Cache individual campaigns for 60 seconds
   - Cache platform stats for 5 minutes

2. **Invalidation**
   - Invalidate on campaign state changes
   - Invalidate on new contributions
   - Use Redis Pub/Sub for cache invalidation across services

3. **Cache Keys**
   ```
   campaign:{id}
   campaigns:list:{filter_hash}
   stats:platform
   user:{address}
   ```

---

## Data Flow

### Contribution Flow

```
1. User submits contribution via frontend
   └─> Freighter wallet signs transaction
   
2. Transaction submitted to Stellar network
   └─> Smart contract executes contribute()
   
3. Contract emits "contributed" event
   └─> Event written to blockchain
   
4. Indexer polls RPC for new events
   └─> Fetches events since last processed ledger
   
5. Indexer parses event payload
   └─> Extracts: contributor, amount, campaign_id
   
6. Indexer updates database
   ├─> Insert contribution record
   ├─> Update campaign.total_raised
   ├─> Increment campaign.contributor_count
   └─> Update user.total_contributed
   
7. Indexer publishes to Redis Pub/Sub
   └─> GraphQL subscriptions notified
   
8. Frontend receives real-time update
   └─> UI updates instantly
```

### Query Flow

```
1. Frontend requests campaign data
   └─> GraphQL query: campaign(id: "xxx")
   
2. GraphQL server checks Redis cache
   ├─> Cache HIT → Return cached data
   └─> Cache MISS → Continue
   
3. Query resolver fetches from PostgreSQL
   └─> SELECT * FROM campaigns WHERE id = 'xxx'
   
4. Result cached in Redis (TTL: 60s)
   └─> Subsequent requests served from cache
   
5. Response returned to frontend
   └─> Frontend renders campaign page
```

---

## Deployment

### Docker Compose (Development)

```yaml
# docker-compose.full.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: fundmycause
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  indexer:
    build: ./services/indexer
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/fundmycause
      SOROBAN_RPC_URL: https://soroban-testnet.stellar.org:443
    depends_on:
      - postgres
      - redis
    ports:
      - "3001:3001"

  graphql-api:
    build: ./services/graphql-api
    environment:
      DATABASE_URL: postgresql://user:password@postgres:5432/fundmycause
      REDIS_URL: redis://redis:6379
    depends_on:
      - postgres
      - redis
      - indexer
    ports:
      - "4000:4000"

volumes:
  postgres_data:
```

### Kubernetes (Production)

```yaml
# k8s/deployment-indexer.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: indexer
spec:
  replicas: 2
  selector:
    matchLabels:
      app: indexer
  template:
    metadata:
      labels:
        app: indexer
    spec:
      containers:
      - name: indexer
        image: fundmycause/indexer:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: url
        - name: SOROBAN_RPC_URL
          value: "https://soroban-testnet.stellar.org:443"
        ports:
        - containerPort: 3001
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
```

---

## Monitoring & Observability

### Health Checks

```bash
# Indexer health
curl http://localhost:3001/health

# GraphQL API health
curl http://localhost:4000/.well-known/apollo/server-health
```

### Metrics (Prometheus)

```
# Indexer metrics
fundmycause_events_processed_total
fundmycause_last_ledger_processed
fundmycause_ingest_latency_seconds

# GraphQL metrics
fundmycause_graphql_requests_total
fundmycause_graphql_query_duration_seconds
fundmycause_cache_hits_total
```

### Logging

All services use structured JSON logging:

```json
{
  "timestamp": "2025-01-15T10:30:00Z",
  "level": "info",
  "service": "indexer",
  "message": "Event processed",
  "campaignId": "550e8400...",
  "eventType": "contributed",
  "ledger": 1234567
}
```

---

## Performance Optimization

### Indexer

1. **Batch Processing**
   - Process events in batches of 100
   - Bulk insert into database
   - Reduces DB round-trips

2. **Parallel Processing**
   - Process multiple campaigns concurrently
   - Use worker threads for heavy parsing

3. **Incremental Sync**
   - Store last processed ledger
   - Resume from checkpoint on restart

### GraphQL API

1. **DataLoader**
   - Batch and cache database queries
   - Prevent N+1 query problems

2. **Query Complexity Limiting**
   - Limit query depth and complexity
   - Prevent resource exhaustion

3. **Caching**
   - Redis-based response caching
   - Cache invalidation on mutations

---

## Security

### API Security

1. **Rate Limiting**
   - 60 requests/minute for anonymous
   - 600 requests/minute for authenticated

2. **CORS**
   - Whitelist allowed origins
   - Disable in development for local testing

3. **Input Validation**
   - Validate all query parameters
   - Sanitize user inputs
   - Prevent SQL injection

### Database Security

1. **Connection Pooling**
   - Limit concurrent connections
   - Use connection timeouts

2. **Prepared Statements**
   - Always use parameterized queries
   - Never concatenate user input

3. **Read-Only Users**
   - GraphQL/REST use read-only DB user
   - Only indexer has write access

---

## Troubleshooting

### Indexer Not Processing Events

**Symptom:** `/health` shows `lastEventTime` is stale

**Solutions:**
1. Check RPC connectivity: `curl https://soroban-testnet.stellar.org:443`
2. Verify contract ID is correct in `.env`
3. Check indexer logs for errors
4. Restart indexer service

### GraphQL Queries Timing Out

**Symptom:** Queries take >5 seconds or timeout

**Solutions:**
1. Check PostgreSQL query performance: `EXPLAIN ANALYZE`
2. Add missing database indexes
3. Increase Redis cache TTL
4. Scale up database resources

### Database Connection Pool Exhausted

**Symptom:** `Error: Connection pool exhausted`

**Solutions:**
1. Increase pool size in config
2. Check for long-running queries
3. Implement connection timeout
4. Scale horizontally (add replicas)

---

## Future Enhancements

- [ ] Event replay and backfill
- [ ] Multi-region deployment with replication
- [ ] Elasticsearch for full-text search
- [ ] Kafka/RabbitMQ for event streaming
- [ ] GraphQL Federation (split API by domain)
- [ ] TimescaleDB for time-series analytics
- [ ] Mainnet support

---

## Related Documentation

- [REST API Documentation](./rest-api-interactive.md)
- [GraphQL API Documentation](./graphql-api-interactive.md)
- [Indexer README](../services/indexer/README.md)
- [GraphQL API README](../services/graphql-api/README.md)
- [Database Migrations](../services/indexer/migrations/README.md)

---

**Questions?** Open an issue on [GitHub](https://github.com/Fund-My-Cause/Fund-My-Cause/issues).
