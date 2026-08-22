#!/bin/bash
# Load test script for API autoscaling validation

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting API load test...${NC}"

# Check if k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ k6 is not installed.${NC}"
    echo -e "${YELLOW}📦 Installing k6...${NC}"
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install k6
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
        echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
        sudo apt-get update
        sudo apt-get install k6
    else
        echo -e "${RED}❌ Please install k6 manually: https://k6.io/docs/getting-started/installation/${NC}"
        exit 1
    fi
fi

# Set environment variables
export API_URL=${API_URL:-http://localhost:3000}
export API_KEY=${API_KEY:-test-key}

echo -e "${GREEN}📊 Running load test against ${API_URL}${NC}"

# Run the load test
k6 run performance/k6-load-test.js \
    --out json=performance/load-test-results.json \
    --summary-export=performance/load-test-summary.json

# Check results
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Load test completed successfully!${NC}"
else
    echo -e "${RED}❌ Load test failed!${NC}"
    exit 1
fi

# Parse results
echo -e "${YELLOW}📊 Load test summary:${NC}"
cat performance/load-test-summary.json | jq '.metrics | {http_req_failed, http_req_duration, http_reqs}'

echo -e "${GREEN}📁 Results saved to performance/load-test-results.json${NC}"
