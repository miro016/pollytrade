# PollyTrade

Polymarket prediction market trading bot with statistical analysis, risk management, and an Angular dashboard.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Single Docker Container             │
│                    (supervisord)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Nginx     │  │  PocketBase  │  │  Trading   │ │
│  │  (port 80)  │──│  (port 8090) │──│  Engine    │ │
│  │  Angular SPA│  │  SQLite DB   │  │  (FastAPI) │ │
│  └─────────────┘  └──────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

- **Frontend**: Angular 21 + DaisyUI + TailwindCSS, served by Nginx
- **Backend**: PocketBase (SQLite-based BaaS) for data storage and real-time SSE
- **Engine**: Python FastAPI trading engine with WebSocket market data, statistical analysis, and risk management

## Prerequisites

- Docker & Docker Compose
- Node.js 22+ (for local frontend dev)
- Python 3.11+ (for local engine dev)

## Quick Start

```bash
# Clone and start
make build && make up

# Or build and run interactively
make dev
```

Access:
- Dashboard: http://localhost
- PocketBase Admin: http://localhost:8090/_/
  - Email: `admin@pollytrade.local`
  - Password: `PollyAdmin2024!`

## Project Structure

```
pollytrade/
├── Dockerfile                 # Single multi-stage build
├── Makefile                   # Dev commands
├── docker/
│   ├── docker-compose.yml     # Single-service compose
│   ├── nginx.conf             # Reverse proxy config
│   ├── supervisord.conf       # Process manager
│   └── .env.example           # Environment template
├── apps/
│   ├── frontend/              # Angular 21 SPA
│   │   └── src/app/
│   │       ├── pages/         # Dashboard, Markets, Trades, Portfolio, Strategy, Settings
│   │       ├── services/      # PocketBase, Market, Portfolio, Trade, Signal, BotStatus
│   │       └── components/    # StatusBadge, PnlChart, PriceChart
│   ├── trading-engine/        # Python FastAPI
│   │   └── app/
│   │       ├── analysis/      # Statistics, Volatility (GARCH), Game Theory, Technical
│   │       ├── signals/       # Multi-signal generator (Z-score, Entropy, GARCH, ML)
│   │       ├── risk/          # Kelly criterion, Circuit breaker, Risk gate
│   │       ├── trading/       # Paper & Live adapters
│   │       ├── ws/            # Polymarket WebSocket stream
│   │       └── services/      # Engine orchestrator, PocketBase client, Market discovery
│   └── pocketbase/            # PocketBase migrations & config
│       └── pb_migrations/     # Collection schemas & seed data
├── packages/
│   └── shared-schemas/        # JSON Schema definitions
└── scripts/                   # Setup, deploy, type generation
```

## Collections (PocketBase)

| Collection | Purpose |
|---|---|
| `markets` | Tracked Polymarket markets with prices |
| `trades` | Paper/live trade history |
| `signals` | Generated trading signals (z-score, entropy, GARCH, etc.) |
| `portfolio` | Balance, positions, P&L snapshots |
| `strategy_configs` | Indicator weights, risk parameters |
| `bot_status` | Engine heartbeat, risk state, circuit breaker |

## Trading Engine

The engine runs a continuous loop:

1. **Market Discovery** — Fetches active markets from Polymarket CLOB API
2. **WebSocket Stream** — Real-time price data via `wss://ws-subscriptions-clob.polymarket.com`
3. **Signal Generation** — Z-score, entropy, GARCH volatility, ML classifier, composite
4. **Risk Gate** — Drawdown limits, circuit breaker, exponential backoff, Kelly sizing
5. **Paper Trading** — Simulated fills with slippage and fees

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/status` | GET | Current engine status |
| `/control/start` | POST | Start engine |
| `/control/stop` | POST | Stop engine |
| `/control/mode` | POST | Switch paper/live mode |

## Development

```bash
# Run tests
make test

# Python tests only
make test-python

# Frontend tests only
make test-frontend

# Local frontend dev (requires PocketBase running)
cd apps/frontend && npm start

# Local engine dev
cd apps/trading-engine && uvicorn app.main:app --reload --port 8080
```

## Configuration

Copy `docker/.env.example` to `docker/.env` and set:

| Variable | Default | Description |
|---|---|---|
| `PB_URL` | `http://127.0.0.1:8090` | PocketBase URL |
| `PB_ADMIN_EMAIL` | `admin@pollytrade.local` | PocketBase admin email |
| `PB_ADMIN_PASSWORD` | `PollyAdmin2024!` | PocketBase admin password |
| `TRADING_MODE` | `paper` | `paper` or `live` |
| `PAPER_BALANCE` | `10000` | Initial paper trading balance |
| `MAX_DAILY_DRAWDOWN` | `0.05` | Max daily loss before halt (5%) |
| `MAX_TOTAL_DRAWDOWN` | `0.15` | Max total drawdown (15%) |
| `KELLY_FRACTION` | `0.5` | Half-Kelly position sizing |
| `MIN_EDGE` | `0.02` | Minimum edge to trade (2%) |

## Safety

- Paper trading mode by default — live trading adapter raises `NotImplementedError`
- 4-layer risk gate: drawdown limits, circuit breaker, exponential backoff, Kelly sizing
- All trades logged to PocketBase for audit
