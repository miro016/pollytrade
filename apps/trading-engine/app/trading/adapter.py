from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class TokenType(str, Enum):
    YES = "yes"
    NO = "no"


@dataclass
class Order:
    market_id: str
    side: OrderSide
    token: TokenType
    amount: float  # Dollar amount
    price: float  # Limit price (0-1)


@dataclass
class OrderResult:
    success: bool
    order_id: str = ""
    filled_amount: float = 0.0
    filled_price: float = 0.0
    fees: float = 0.0
    slippage: float = 0.0
    error: str = ""


@dataclass
class Position:
    market_id: str
    token: TokenType
    quantity: float
    avg_price: float
    current_price: float = 0.0
    unrealized_pnl: float = 0.0


class TradingAdapter(ABC):
    """Abstract trading adapter for paper/live trading.

    Strategy code uses this interface identically regardless of mode,
    enabling seamless paper-to-live transitions.
    """

    @abstractmethod
    async def place_order(self, order: Order) -> OrderResult:
        """Place a buy or sell order."""
        ...

    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order."""
        ...

    @abstractmethod
    async def get_position(self, market_id: str) -> Position | None:
        """Get current position for a market."""
        ...

    @abstractmethod
    async def get_positions(self) -> list[Position]:
        """Get all open positions."""
        ...

    @abstractmethod
    async def get_balance(self) -> float:
        """Get current cash balance."""
        ...

    @abstractmethod
    async def get_market_price(self, market_id: str) -> float | None:
        """Get current market price for YES token."""
        ...
