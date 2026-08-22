#!/bin/bash
# Bootstrap the entire stack with one command

set -e

echo "🚀 Bootstrapping Fund-My-Cause stack..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo -e "${YELLOW}📦 Building and starting containers...${NC}"
docker compose -f docker-compose.full.yml up -d --build

echo -e "${YELLOW}⏳ Waiting for services to be ready...${NC}"
sleep 10

# Wait for PostgreSQL
echo -e "${YELLOW}⏳ Waiting for PostgreSQL...${NC}"
until docker exec fund-my-cause-postgres pg_isready -U fundmycause > /dev/null 2>&1; do
    sleep 1
done

echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Run migrations
echo -e "${YELLOW}📊 Running migrations...${NC}"
docker exec -i fund-my-cause-postgres psql -U fundmycause -d fundmycause < scripts/init-db.sql

# Seed data
echo -e "${YELLOW}🌱 Seeding data...${NC}"
./scripts/seed-db.sh

echo -e "${GREEN}✅ Bootstrap complete!${NC}"
echo ""
echo -e "${GREEN}📋 Services running:${NC}"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - API: http://localhost:3000"
echo "   - Indexer: http://localhost:3001"
echo "   - Frontend: http://localhost:3002"
echo ""
echo -e "${GREEN}📝 View logs:${NC}"
echo "   docker compose -f docker-compose.full.yml logs -f"
echo ""
echo -e "${GREEN}🛑 Stop stack:${NC}"
echo "   docker compose -f docker-compose.full.yml down"
echo ""
echo -e "${GREEN}✅ Stack is ready! Visit http://localhost:3002${NC}"
