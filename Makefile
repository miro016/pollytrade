.PHONY: dev dev-all build clean generate setup test test-python test-frontend

COMPOSE_FILE := docker/docker-compose.yml

# Start PocketBase only (for development)
dev:
	docker compose -f $(COMPOSE_FILE) up pocketbase

# Start all services
dev-all:
	docker compose -f $(COMPOSE_FILE) up

# Build all Docker images
build:
	docker compose -f $(COMPOSE_FILE) build

# Stop and remove containers
clean:
	docker compose -f $(COMPOSE_FILE) down -v

# Generate TypeScript + Python types from JSON schemas
generate:
	./scripts/generate-types.sh

# First-time setup
setup:
	./scripts/setup.sh

# Run all tests
test: test-python test-frontend

# Run Python tests
test-python:
	cd apps/trading-engine && python -m pytest tests/ -v --cov=app

# Run Angular tests
test-frontend:
	cd apps/frontend && npx ng test --watch=false
