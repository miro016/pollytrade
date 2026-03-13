import uuid
from dataclasses import dataclass, field

import structlog

from app.trading.adapter import (
    Order,
    OrderResult,
    OrderSide,
    Position,
    TokenType,
    TradingAdapter,
)

logger = structlog.get_logger()


@dataclass
class PaperTradingAdapter(TradingAdapter):
    """Paper trading adapter that simulates order fills.

    Simulates realistic execution with configurable slippage and fees.
    All state is maintained in memory and can be persisted to PocketBase.
    """

    initial_balance: float = 10000.0
    slippage_bps: float = 5.0  # 5 basis points default
    fee_rate: float = 0.001  # 0.1% fee

    _balance: float = 0.0
    _positions: dict[str, Position] = field(default_factory=dict)
    _market_prices: dict[str, float] = field(default_factory=dict)
    _trades: list[dict] = field(default_factory=list)

    def __post_init__(self):
        if self._balance == 0.0:
            self._balance = self.initial_balance

    async def place_order(self, order: Order) -> OrderResult:
        """Simulate order fill with slippage and fees."""
        order_id = str(uuid.uuid4())[:8]

        # Calculate slippage
        slippage = order.price * (self.slippage_bps / 10000)
        if order.side == OrderSide.BUY:
            filled_price = min(order.price + slippage, 0.99)
        else:
            filled_price = max(order.price - slippage, 0.01)

        # Calculate fees
        fees = order.amount * self.fee_rate
        total_cost = order.amount + fees

        # Check balance for buys
        if order.side == OrderSide.BUY and total_cost > self._balance:
            return OrderResult(
                success=False,
                error=f"insufficient_balance: need {total_cost:.2f}, have {self._balance:.2f}",
            )

        # Calculate quantity
        quantity = order.amount / filled_price

        # Update position
        pos_key = f"{order.market_id}_{order.token.value}"
        if order.side == OrderSide.BUY:
            self._balance -= total_cost
            existing = self._positions.get(pos_key)
            if existing:
                total_qty = existing.quantity + quantity
                existing.avg_price = (
                    (existing.avg_price * existing.quantity + filled_price * quantity) / total_qty
                )
                existing.quantity = total_qty
            else:
                self._positions[pos_key] = Position(
                    market_id=order.market_id,
                    token=order.token,
                    quantity=quantity,
                    avg_price=filled_price,
                    current_price=filled_price,
                )
        else:  # SELL
            existing = self._positions.get(pos_key)
            if not existing or existing.quantity < quantity:
                return OrderResult(
                    success=False,
                    error="insufficient_position",
                )
            pnl = (filled_price - existing.avg_price) * quantity
            self._balance += order.amount - fees + pnl
            existing.quantity -= quantity
            if existing.quantity <= 0.001:
                del self._positions[pos_key]

        # Record trade
        trade = {
            "order_id": order_id,
            "market_id": order.market_id,
            "side": order.side.value,
            "token": order.token.value,
            "amount": order.amount,
            "filled_price": filled_price,
            "quantity": quantity,
            "fees": fees,
            "slippage": slippage,
        }
        self._trades.append(trade)

        logger.info("paper_trade_filled", **trade)

        return OrderResult(
            success=True,
            order_id=order_id,
            filled_amount=order.amount,
            filled_price=filled_price,
            fees=fees,
            slippage=slippage,
        )

    async def cancel_order(self, order_id: str) -> bool:
        """Paper trading fills immediately, so cancel is a no-op."""
        return False

    async def get_position(self, market_id: str) -> Position | None:
        """Get position for a specific market (YES token by default)."""
        for key, pos in self._positions.items():
            if pos.market_id == market_id:
                pos.current_price = self._market_prices.get(market_id, pos.current_price)
                pos.unrealized_pnl = (pos.current_price - pos.avg_price) * pos.quantity
                return pos
        return None

    async def get_positions(self) -> list[Position]:
        """Get all open positions."""
        positions = []
        for pos in self._positions.values():
            pos.current_price = self._market_prices.get(pos.market_id, pos.current_price)
            pos.unrealized_pnl = (pos.current_price - pos.avg_price) * pos.quantity
            positions.append(pos)
        return positions

    async def get_balance(self) -> float:
        """Get current cash balance."""
        return self._balance

    async def get_market_price(self, market_id: str) -> float | None:
        """Get current market price."""
        return self._market_prices.get(market_id)

    def update_market_price(self, market_id: str, price: float) -> None:
        """Update simulated market price (called from data feed)."""
        self._market_prices[market_id] = price
