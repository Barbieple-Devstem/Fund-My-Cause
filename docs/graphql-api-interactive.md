# Interactive GraphQL API Documentation

The Fund-My-Cause GraphQL API provides a flexible, type-safe interface for querying campaign data with powerful filtering, sorting, and real-time subscription capabilities.

## 🚀 Try It Out

### GraphQL Playground (Interactive)

Access the interactive GraphQL playground with built-in documentation and query validation:

**Development:** [http://localhost:4000/graphql](http://localhost:4000/graphql)  
**Production:** [https://graphql.fundmycause.com/graphql](https://graphql.fundmycause.com/graphql)

### GraphQL Voyager (Schema Explorer)

Visualize the complete GraphQL schema interactively:

**Development:** [http://localhost:4000/voyager](http://localhost:4000/voyager)  
**Production:** [https://graphql.fundmycause.com/voyager](https://graphql.fundmycause.com/voyager)

---

## Base URL

```
Development: http://localhost:4000/graphql
Production:  https://graphql.fundmycause.com/graphql
```

---

## Authentication

Most queries are public and do not require authentication. Mutations require a valid JWT token.

```graphql
# Include in HTTP headers
{
  "Authorization": "Bearer YOUR_JWT_TOKEN"
}
```

---

## Common Query Examples

### 1. Get All Active Campaigns

```graphql
query GetActiveCampaigns {
  activeCampaigns(limit: 20) {
    id
    title
    description
    goal
    totalRaised
    percentageFunded
    status
    creator
    deadline
    daysRemaining
    totalContributors
  }
}
```

**Response:**
```json
{
  "data": {
    "activeCampaigns": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "Build a Community Center",
        "description": "Help us build a community center",
        "goal": "1000000000",
        "totalRaised": "650000000",
        "percentageFunded": 65.0,
        "status": "ACTIVE",
        "creator": "GCREATOR...",
        "deadline": "2025-12-31T23:59:59Z",
        "daysRemaining": 180,
        "totalContributors": 42
      }
    ]
  }
}
```

### 2. Get Campaign with Full Details

```graphql
query GetCampaignDetail($id: ID!) {
  campaignDetail(id: $id) {
    campaign {
      id
      title
      description
      goal
      totalRaised
      percentageFunded
      status
      creator
      deadline
      category
      image
      videoUrl
      createdAt
      updatedAt
    }
    contributors {
      address
      amount
      contributionCount
      isTopContributor
    }
    topContributors(limit: 10) {
      rank
      address
      amount
      percentage
    }
    updates {
      id
      content
      ipfsHash
      timestamp
    }
    milestones {
      id
      title
      description
      targetAmount
      releasePercentage
      status
    }
  }
}
```

**Variables:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Search Campaigns with Filtering

```graphql
query SearchCampaigns($filter: CampaignFilter, $sort: CampaignSort) {
  campaigns(
    filter: $filter
    sort: $sort
    pagination: { limit: 20, offset: 0 }
  ) {
    edges {
      node {
        id
        title
        totalRaised
        goal
        percentageFunded
        status
        daysRemaining
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
    totalCount
  }
}
```

**Variables:**
```json
{
  "filter": {
    "status": ["ACTIVE"],
    "category": ["technology", "creative"],
    "minGoal": "100000000",
    "search": "community"
  },
  "sort": {
    "field": "RAISED_AMOUNT",
    "direction": "DESC"
  }
}
```

### 4. Get User Profile with Contributions

```graphql
query GetUserProfile($address: String!) {
  user(address: $address) {
    address
    totalContributed
    contributionCount
    joinedAt
    campaigns {
      id
      title
      status
      totalRaised
    }
    contributions {
      id
      campaignId
      amount
      timestamp
      transactionHash
    }
  }
}
```

**Variables:**
```json
{
  "address": "GUSERADDRESS..."
}
```

### 5. Get Trending Campaigns

```graphql
query GetTrendingCampaigns {
  trendingCampaigns(limit: 10) {
    id
    title
    totalRaised
    goal
    percentageFunded
    totalContributors
    daysRemaining
    category
    image
  }
}
```

### 6. Get Platform Statistics

```graphql
query GetPlatformStats {
  stats {
    totalCampaigns
    activeCampaigns
    totalRaised
    totalContributors
    averageContribution
    successRate
  }
}
```

**Response:**
```json
{
  "data": {
    "stats": {
      "totalCampaigns": 150,
      "activeCampaigns": 78,
      "totalRaised": "5500000000",
      "totalContributors": 1250,
      "averageContribution": "4400000",
      "successRate": 0.68
    }
  }
}
```

### 7. Get User Contributions for a Campaign

```graphql
query GetUserContributions($address: String!, $campaignId: ID) {
  contributions(campaignId: $campaignId, contributor: $address) {
    id
    campaignId
    amount
    timestamp
    transactionHash
  }
}
```

**Variables:**
```json
{
  "address": "GCONTRIBUTOR...",
  "campaignId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

## Real-Time Subscriptions

GraphQL subscriptions enable real-time updates via WebSocket.

### 1. Subscribe to New Contributions

```graphql
subscription OnNewContribution($campaignId: ID!) {
  newContribution(campaignId: $campaignId) {
    id
    contributor
    amount
    timestamp
    transactionHash
  }
}
```

**Variables:**
```json
{
  "campaignId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### 2. Subscribe to Campaign Progress

```graphql
subscription OnCampaignProgress($id: ID!) {
  campaignProgressChanged(id: $id) {
    campaignId
    raised
    percentageFunded
    contributors
    daysRemaining
    timestamp
  }
}
```

### 3. Subscribe to Milestone Reached

```graphql
subscription OnMilestoneReached($campaignId: ID!) {
  milestoneReached(campaignId: $campaignId) {
    id
    title
    targetAmount
    releasePercentage
    status
  }
}
```

### 4. Subscribe to Campaign Status Changes

```graphql
subscription OnCampaignStatusChange($id: ID!) {
  campaignStatusChanged(id: $id) {
    id
    status
    totalRaised
    updatedAt
  }
}
```

---

## Mutations (Authenticated)

### 1. Authenticate User

```graphql
mutation Authenticate($signature: String!, $message: String!, $address: String!) {
  authenticate(signature: $signature, message: $message, address: $address) {
    token
    user {
      address
      totalContributed
      contributionCount
    }
  }
}
```

### 2. Create Campaign (Future)

```graphql
mutation CreateCampaign($input: CreateCampaignInput!) {
  createCampaign(input: $input) {
    id
    title
    goal
    deadline
    status
  }
}
```

**Variables:**
```json
{
  "input": {
    "title": "New Campaign",
    "description": "Campaign description",
    "goal": "1000000000",
    "deadline": "2025-12-31T23:59:59Z",
    "category": "technology",
    "minContribution": "10000000"
  }
}
```

---

## Schema Reference

### Types

#### Campaign
```graphql
type Campaign {
  id: ID!
  contractId: String!
  title: String!
  description: String!
  creator: String!
  goal: BigInt!
  raised: BigInt!
  deadline: String!
  status: CampaignStatus!
  category: String!
  image: String
  videoUrl: String
  minContribution: BigInt!
  totalRaised: BigInt!
  totalContributors: Int!
  percentageFunded: Float!
  daysRemaining: Int!
  token: String!
  platformFeeBps: Int
  hasRBACEnabled: Boolean!
  createdAt: String!
  updatedAt: String!
}
```

#### CampaignStatus
```graphql
enum CampaignStatus {
  ACTIVE
  SUCCESSFUL
  REFUNDED
  CANCELLED
  PAUSED
  ARCHIVED
}
```

#### Contribution
```graphql
type Contribution {
  id: ID!
  campaignId: ID!
  contributor: String!
  amount: BigInt!
  timestamp: String!
  transactionHash: String!
}
```

#### User
```graphql
type User {
  address: String!
  totalContributed: BigInt!
  contributionCount: Int!
  campaigns: [Campaign!]!
  contributions: [Contribution!]!
  joinedAt: String!
}
```

### Input Types

#### CampaignFilter
```graphql
input CampaignFilter {
  status: [CampaignStatus!]
  category: [String!]
  minGoal: BigInt
  maxGoal: BigInt
  creator: String
  search: String
}
```

#### PaginationInput
```graphql
input PaginationInput {
  limit: Int = 20
  offset: Int = 0
}
```

#### CampaignSort
```graphql
input CampaignSort {
  field: SortField!
  direction: SortDirection!
}

enum SortField {
  CREATED_AT
  RAISED_AMOUNT
  GOAL
  DEADLINE
  CONTRIBUTORS
}

enum SortDirection {
  ASC
  DESC
}
```

---

## Error Handling

GraphQL errors follow this format:

```json
{
  "errors": [
    {
      "message": "Campaign not found",
      "locations": [{ "line": 2, "column": 3 }],
      "path": ["campaign"],
      "extensions": {
        "code": "NOT_FOUND",
        "campaignId": "invalid-id"
      }
    }
  ],
  "data": null
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHENTICATED` | Missing or invalid authentication token |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `BAD_USER_INPUT` | Invalid input parameters |
| `INTERNAL_SERVER_ERROR` | Server error |
| `PERSISTED_QUERY_NOT_FOUND` | Persisted query not found (APQ) |

---

## Advanced Features

### Automatic Persisted Queries (APQ)

Save bandwidth by using persisted queries:

```graphql
# First request: send full query with hash
{
  "query": "...",
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "ecf4edb46db40b5132295c0291d62fb65d6759a9eedfa4d5d612dd5ec54a6b38"
    }
  }
}

# Subsequent requests: send only hash
{
  "extensions": {
    "persistedQuery": {
      "version": 1,
      "sha256Hash": "ecf4edb46db40b5132295c0291d62fb65d6759a9eedfa4d5d612dd5ec54a6b38"
    }
  }
}
```

### Query Complexity Limiting

Complex queries are automatically limited to prevent resource exhaustion. Each field has a complexity cost:

- Simple fields: 1 point
- Relations: 5 points
- Lists: 10 points × limit

**Maximum query complexity:** 1000 points

---

## Setup Instructions

### Running Locally

1. **Start the GraphQL service**:
   ```bash
   cd services/graphql-api
   npm install
   npm run dev
   ```

2. **Access GraphQL Playground**:
   Open [http://localhost:4000/graphql](http://localhost:4000/graphql)

3. **Try example queries** in the playground interface

### Docker

```bash
docker compose up graphql-api
```

Then access at [http://localhost:4000/graphql](http://localhost:4000/graphql)

---

## Client Integration Examples

### Apollo Client (React)

```typescript
import { ApolloClient, InMemoryCache, gql, useQuery } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache(),
});

const GET_CAMPAIGNS = gql`
  query GetActiveCampaigns {
    activeCampaigns(limit: 20) {
      id
      title
      totalRaised
      goal
      status
    }
  }
`;

function CampaignList() {
  const { loading, error, data } = useQuery(GET_CAMPAIGNS);
  
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;
  
  return (
    <ul>
      {data.activeCampaigns.map(campaign => (
        <li key={campaign.id}>{campaign.title}</li>
      ))}
    </ul>
  );
}
```

### urql (React)

```typescript
import { createClient, useQuery } from 'urql';

const client = createClient({
  url: 'http://localhost:4000/graphql',
});

const CampaignsQuery = `
  query {
    activeCampaigns(limit: 20) {
      id
      title
      status
    }
  }
`;

function App() {
  const [result] = useQuery({ query: CampaignsQuery });
  return <div>{/* render campaigns */}</div>;
}
```

### Plain JavaScript (fetch)

```javascript
async function fetchCampaigns() {
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query {
          activeCampaigns(limit: 20) {
            id
            title
            totalRaised
          }
        }
      `,
    }),
  });
  
  const { data } = await response.json();
  return data.activeCampaigns;
}
```

### cURL

```bash
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { activeCampaigns(limit: 5) { id title totalRaised } }"
  }' | jq '.'
```

---

## WebSocket Subscriptions (Client)

### Apollo Client

```typescript
import { ApolloClient, InMemoryCache, split, HttpLink } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';

const httpLink = new HttpLink({
  uri: 'http://localhost:4000/graphql',
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: 'ws://localhost:4000/graphql',
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === 'OperationDefinition' &&
      definition.operation === 'subscription'
    );
  },
  wsLink,
  httpLink
);

const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
```

---

## Next Steps

- **REST API:** For simpler queries, see [REST API Documentation](./rest-api-interactive.md)
- **SDK:** Use the TypeScript SDK for type-safe API access: [sdks/js/README.md](../../sdks/js/README.md)
- **Schema Visualization:** Explore the full schema with GraphQL Voyager

---

**Questions or issues?** Open an issue on [GitHub](https://github.com/Fund-My-Cause/Fund-My-Cause/issues).
