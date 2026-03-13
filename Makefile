.PHONY: dev build clean generate setup test test-python test-frontend up down logs

COMPOSE_FILE := docker/docker-compose.yml

# Start the app (all services in one container)
dev:
	docker compose -f $(COMPOSE_FILE) up --build

# Build the Docker image
build:
	docker compose -f $(COMPOSE_FILE) build

# Start in detached mode
up:
	docker compose -f $(COMPOSE_FILE) up -d

# Stop and remove containers
down:
	docker compose -f $(COMPOSE_FILE) down

# Tail logs
logs:
	docker compose -f $(COMPOSE_FILE) logs -f

# Stop and remove containers + volumes
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
