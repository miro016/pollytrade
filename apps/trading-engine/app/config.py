from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # PocketBase
    pb_url: str = "http://localhost:8090"
    pb_admin_email: str = "admin@pollytrade.local"
    pb_admin_password: str = "PollyAdmin2024!"

    # Polymarket
    polymarket_api_key: str = ""
    polymarket_api_secret: str = ""
    polymarket_passphrase: str = ""

    # Trading
    trading_mode: str = "paper"  # paper or live

    # Risk parameters
    max_daily_drawdown: float = 0.05
    max_total_drawdown: float = 0.15
    max_position_size: float = 0.10
    kelly_fraction: float = 0.5
    circuit_breaker_daily_loss: float = 0.03
    circuit_breaker_weekly_loss: float = 0.07
    circuit_breaker_consecutive_losses: int = 5
    circuit_breaker_timeout_seconds: int = 3600
    min_edge: float = 0.02

    # Paper trading
    paper_balance: float = 10000.0

    # Server
    host: str = "0.0.0.0"
    port: int = 8080

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
