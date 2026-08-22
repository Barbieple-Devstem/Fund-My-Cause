# Interactive REST API Documentation

The Fund-My-Cause Indexer exposes a REST API for querying indexed campaign data from the blockchain.

## 🚀 Try It Out

### Swagger UI (Interactive)

Access the interactive API documentation with try-it-out functionality:

**Development:** [http://localhost:3001/api-docs](http://localhost:3001/api-docs)  
**Production:** [https://api.fundmycause.com/api-docs](https://api.fundmycause.com/api-docs)

### ReDoc (Clean Reference)

For a clean, readable API reference:

**Development:** [http://localhost:3001/redoc](http://localhost:3001/redoc)  
**Production:** [https://api.fundmycause.com/redoc](https://api.fundmycause.com/redoc)

---

## Base URL

```
Development: http://localhost:3001
Production:  https://api.fundmycause.com
```

---

## Authentication

The REST API is **read-only** and does not require authentication.

---

## Common Query Examples

### 1. List All Campaigns

**Request:**
```bash
GET /campaigns?page=1&limit=20&sort=created_at&order=desc
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/campaigns?page=1&limit=20&sort=created_at&order=desc"
```

**Response:**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "creator_address": "GCREATORADDRESS...",
      "contract_address": "CCAMPAIGNCONTRACT...",
      "title": "Build a Community Center",
      "description": "Help us build a community center for local youth programs",
      "goal": 1000000000,
      "total_raised": 650000000,
      "status": "active",
      "deadline": 1735689600,
      "contributor_count": 42,
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 2. Get Campaign Details

**Request:**
```bash
GET /campaigns/{id}
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/campaigns/550e8400-e29b-41d4-a716-446655440000"
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "creator_address": "GCREATORADDRESS...",
  "contract_address": "CCAMPAIGNCONTRACT...",
  "title": "Build a Community Center",
  "description": "Help us build a community center for local youth programs",
  "goal": 1000000000,
  "total_raised": 650000000,
  "status": "active",
  "deadline": 1735689600,
  "contributor_count": 42,
  "created_at": "2025-01-15T10:30:00Z",
  "category": "community",
  "social_links": ["https://twitter.com/campaign"],
  "progress_percentage": 65.0
}
```

### 3. List Campaign Contributions

**Request:**
```bash
GET /campaigns/{id}/contributions?page=1&limit=20
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/campaigns/550e8400-e29b-41d4-a716-446655440000/contributions?page=1&limit=20"
```

**Response:**
```json
{
  "data": [
    {
      "id": "contrib-001",
      "contributor_address": "GCONTRIBUTORADDRESS...",
      "amount": 50000000,
      "token_amount": 50000000,
      "contributed_at": "2025-01-16T14:25:00Z",
      "tx_hash": "abcdef123456..."
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

### 4. Get Platform Statistics

**Request:**
```bash
GET /stats
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/stats"
```

**Response:**
```json
{
  "total_campaigns": 150,
  "active_campaigns": 78,
  "succeeded_campaigns": 62,
  "total_raised": 5500000000,
  "total_contributors": 1250,
  "avg_raised_per_campaign": 36666666.67
}
```

### 5. Filter Campaigns by Status

**Request:**
```bash
GET /campaigns?status=active&category=technology&limit=10
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/campaigns?status=active&category=technology&limit=10"
```

### 6. Search Campaigns

**Request:**
```bash
GET /campaigns?search=community&limit=10
```

**cURL:**
```bash
curl -X GET "http://localhost:3001/campaigns?search=community&limit=10"
```

---

## Endpoints Reference

### Campaigns

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/campaigns` | GET | List all campaigns with filtering and pagination |
| `/campaigns/{id}` | GET | Get detailed campaign information |
| `/campaigns/{id}/contributions` | GET | List all contributions for a campaign |
| `/campaigns/{id}/stats` | GET | Get campaign statistics |

### Analytics

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/stats` | GET | Get global platform statistics |
| `/trending` | GET | Get trending campaigns |
| `/categories` | GET | List available categories |

### Health & System

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/ready` | GET | Readiness probe for K8s |
| `/metrics` | GET | Prometheus metrics |

---

## Query Parameters

### Pagination

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `limit` | integer | 20 | Items per page (max 100) |

### Filtering

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `active`, `succeeded`, `failed` |
| `category` | string | Filter by category |
| `creator` | string | Filter by creator address |
| `search` | string | Full-text search across title and description |
| `min_goal` | integer | Minimum goal amount |
| `max_goal` | integer | Maximum goal amount |

### Sorting

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `sort` | string | `created_at` | Sort field: `created_at`, `total_raised`, `deadline`, `status` |
| `order` | string | `desc` | Sort order: `asc`, `desc` |

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Campaign not found",
    "details": {}
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `BAD_REQUEST` | Invalid request parameters |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Indexer is syncing or unavailable |

---

## Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Anonymous requests:** 60 requests per minute
- **Rate limit headers** are included in all responses:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Time when the limit resets (Unix timestamp)

---

## CORS

Cross-Origin Resource Sharing (CORS) is enabled for all origins in development. In production, only whitelisted origins are allowed.

---

## OpenAPI Specification

Download the full OpenAPI 3.0 spec:

**Development:** [http://localhost:3001/openapi.json](http://localhost:3001/openapi.json)  
**Production:** [https://api.fundmycause.com/openapi.json](https://api.fundmycause.com/openapi.json)

---

## Setup Instructions

### Running Locally

1. **Start the indexer service**:
   ```bash
   cd services/indexer
   npm install
   npm run dev
   ```

2. **Access Swagger UI**:
   Open [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

3. **Try example queries** in the Swagger UI interface

### Docker

```bash
docker compose up indexer
```

Then access at [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

---

## Example Integration

### JavaScript/TypeScript

```typescript
const BASE_URL = 'http://localhost:3001';

// Fetch all active campaigns
async function getActiveCampaigns() {
  const response = await fetch(`${BASE_URL}/campaigns?status=active&limit=20`);
  const data = await response.json();
  return data;
}

// Get campaign details
async function getCampaign(id: string) {
  const response = await fetch(`${BASE_URL}/campaigns/${id}`);
  return response.json();
}

// Get campaign contributions
async function getContributions(campaignId: string) {
  const response = await fetch(
    `${BASE_URL}/campaigns/${campaignId}/contributions?limit=50`
  );
  return response.json();
}
```

### Python

```python
import requests

BASE_URL = "http://localhost:3001"

def get_active_campaigns():
    response = requests.get(f"{BASE_URL}/campaigns", params={
        "status": "active",
        "limit": 20
    })
    return response.json()

def get_campaign(campaign_id):
    response = requests.get(f"{BASE_URL}/campaigns/{campaign_id}")
    return response.json()
```

### cURL

```bash
# Get all campaigns
curl -X GET "http://localhost:3001/campaigns"

# Get campaign by ID with pretty output
curl -X GET "http://localhost:3001/campaigns/{id}" | jq '.'

# Filter and sort
curl -X GET "http://localhost:3001/campaigns?status=active&sort=total_raised&order=desc&limit=10"
```

---

## Next Steps

- **GraphQL API:** For more flexible queries, see [GraphQL API Documentation](./graphql-api-docs.md)
- **SDK:** Use the TypeScript SDK for type-safe API access: [sdks/js/README.md](../../sdks/js/README.md)
- **WebSocket Events:** Real-time updates via GraphQL subscriptions

---

**Questions or issues?** Open an issue on [GitHub](https://github.com/Fund-My-Cause/Fund-My-Cause/issues).
