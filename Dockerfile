# =============================================================================
# Single-container build for PocketBase + Trading Engine + Angular Frontend
# Uses supervisord to manage all three processes
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build Angular frontend
# ---------------------------------------------------------------------------
FROM node:22-alpine AS frontend-builder

WORKDIR /app

COPY apps/frontend/package.json apps/frontend/package-lock.json* ./
RUN npm ci

COPY apps/frontend/ .
RUN npx ng build --configuration=production

# ---------------------------------------------------------------------------
# Stage 2: Build Python trading engine dependencies
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS python-builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY apps/trading-engine/pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir --prefix=/install .

# ---------------------------------------------------------------------------
# Stage 3: Final runtime image
# ---------------------------------------------------------------------------
FROM python:3.12-slim

ARG PB_VERSION=0.25.9

# Install nginx, supervisor, and utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    wget \
    unzip \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# --- PocketBase ---
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
    -O /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /pb/ \
    && rm /tmp/pb.zip \
    && chmod +x /pb/pocketbase

COPY apps/pocketbase/pb_migrations/ /pb/pb_migrations/

# --- Python trading engine ---
COPY --from=python-builder /install /usr/local
COPY apps/trading-engine/app/ /engine/app/

# --- Angular frontend (built static files) ---
COPY --from=frontend-builder /app/dist/frontend/browser /usr/share/nginx/html

# --- Nginx config ---
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
RUN rm -f /etc/nginx/sites-enabled/default

# --- Supervisord config ---
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create data directory for PocketBase
RUN mkdir -p /pb/pb_data

EXPOSE 80 8090

CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
