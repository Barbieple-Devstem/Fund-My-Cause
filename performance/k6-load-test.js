// k6 Load Test for API Autoscaling Validation
import http from 'k6/http';
import { check, sleep } from 'k6';

// Test configuration
export const options = {
  stages: [
    // Stage 1: Ramp up to 50 users
    { duration: '2m', target: 50 },
    // Stage 2: Stay at 50 users (steady load)
    { duration: '3m', target: 50 },
    // Stage 3: Ramp up to 100 users
    { duration: '2m', target: 100 },
    // Stage 4: Stay at 100 users (high load)
    { duration: '3m', target: 100 },
    // Stage 5: Ramp up to 200 users
    { duration: '2m', target: 200 },
    // Stage 6: Stay at 200 users (peak load)
    { duration: '3m', target: 200 },
    // Stage 7: Ramp down to 0
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.01'],    // Less than 1% failure rate
    http_reqs: ['rate>50'],            // At least 50 RPS
  },
};

// Test data
const API_URL = __ENV.API_URL || 'http://localhost:3000';
const API_KEY = __ENV.API_KEY || 'test-key';

// Helper function to generate random data
function generateData() {
  return {
    title: `Campaign ${Date.now()}`,
    description: 'Test campaign description',
    goalAmount: Math.floor(Math.random() * 10000) + 1000,
  };
}

export default function () {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${API_KEY}`,
  };

  // Test 1: GET campaigns
  const getCampaigns = http.get(`${API_URL}/api/campaigns`, { headers });
  check(getCampaigns, {
    'GET campaigns status is 200': (r) => r.status === 200,
  });

  // Test 2: GET campaign details
  const campaignId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const getCampaign = http.get(`${API_URL}/api/campaigns/${campaignId}`, { headers });
  check(getCampaign, {
    'GET campaign status is 200': (r) => r.status === 200,
  });

  // Test 3: POST create campaign
  const createCampaign = http.post(
    `${API_URL}/api/campaigns`,
    JSON.stringify(generateData()),
    { headers }
  );
  check(createCampaign, {
    'POST campaign status is 201': (r) => r.status === 201,
  });

  // Test 4: GraphQL query
  const graphqlQuery = {
    query: `
      query {
        campaigns {
          id
          title
          raisedAmount
          goalAmount
        }
      }
    `,
  };
  const graphqlRequest = http.post(
    `${API_URL}/api/graphql`,
    JSON.stringify(graphqlQuery),
    { headers }
  );
  check(graphqlRequest, {
    'GraphQL status is 200': (r) => r.status === 200,
  });

  // Sleep between iterations
  sleep(Math.random() * 2 + 0.5);
}
