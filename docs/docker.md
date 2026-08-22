# Docker Development Stack

## Overview
The Fund-My-Cause project uses Docker Compose to provide a complete local development environment with all services running in containers.

## Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Main database |
| Redis | 6379 | Cache and queue |
| API | 3000 | Backend API |
| Indexer | 3001 | Blockchain indexer |
| Frontend | 3002 | Next.js application |

## Quick Start

### One-Command Setup

```bash
# Bootstrap everything
./scripts/bootstrap.sh
# Start all services
docker compose -f docker-compose.full.yml up -d

# View logs
docker compose -f docker-compose.full.yml logs -f

# Stop all services
docker compose -f docker-compose.full.yml down
# Rebuild and restart a specific service
docker compose -f docker-compose.full.yml up -d --build api

# Or rebuild all
docker compose -f docker-compose.full.yml up -d --build
# Run migrations manually
docker exec -i fund-my-cause-postgres psql -U fundmycause -d fundmycause < scripts/init-db.sql
# Seed sample data
./scripts/seed-db.sh
# Connect to PostgreSQL
docker exec -it fund-my-cause-postgres psql -U fundmycause -d fundmycause
# View all logs
docker compose -f docker-compose.full.yml logs -f

# View specific service logs
docker compose -f docker-compose.full.yml logs -f api
docker compose -f docker-compose.full.yml logs -f indexer
docker compose -f docker-compose.full.yml logs -f frontend
# Run commands in container
docker exec -it fund-my-cause-api sh
docker exec -it fund-my-cause-indexer sh
docker exec -it fund-my-cause-frontend sh
cp .env.example .env
ports:
  - "3002:3002"  # Change the first port to something else
# Stop and remove containers
docker compose -f docker-compose.full.yml down -v

# Remove images
docker compose -f docker-compose.full.yml down --rmi all

# Rebuild fresh
docker compose -f docker-compose.full.yml up -d --build
# Check if PostgreSQL is healthy
docker inspect fund-my-cause-postgres --format='{{.State.Health.Status}}'

# Restart PostgreSQL
docker compose -f docker-compose.full.yml restart postgres
# Scale API horizontally
docker compose -f docker-compose.full.yml up -d --scale api=3


# Check service status
docker compose -f docker-compose.full.yml ps

# View resource usage
docker stats

# Clean up unused resources
docker system prune -f

# Rebuild everything (used after Dockerfile changes)
docker compose -f docker-compose.full.yml build --no-cache
