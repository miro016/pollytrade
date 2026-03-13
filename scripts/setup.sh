#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Polymarket Trading Bot Setup ==="

# Copy .env if not exists
if [ ! -f "$ROOT_DIR/docker/.env" ]; then
    cp "$ROOT_DIR/docker/.env.example" "$ROOT_DIR/docker/.env"
    echo "[+] Created docker/.env from .env.example — edit it with your credentials"
else
    echo "[=] docker/.env already exists, skipping"
fi

# Build Docker images
echo "[+] Building Docker images..."
docker compose -f "$ROOT_DIR/docker/docker-compose.yml" build

echo ""
echo "=== Setup complete ==="
echo "  make dev      — Start PocketBase only"
echo "  make dev-all  — Start all services"
echo "  make test     — Run all tests"
