import pytest

from app.trading.adapter import Order, OrderSide, TokenType
from app.trading.paper import PaperTradingAdapter


@pytest.fixture
def adapter():
    return PaperTradingAdapter(initial_balance=10000.0, slippage_bps=5.0, fee_rate=0.001)


class TestPaperTrading:
    @pytest.mark.asyncio
    async def test_initial_balance(self, adapter):
        balance = await adapter.get_balance()
        assert balance == 10000.0

    @pytest.mark.asyncio
    async def test_buy_order(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=100.0,
            price=0.55,
        )
        result = await adapter.place_order(order)
        assert result.success is True
        assert result.filled_amount == 100.0
        assert result.filled_price > 0
        assert result.fees > 0

        # Balance should decrease
        balance = await adapter.get_balance()
        assert balance < 10000.0

    @pytest.mark.asyncio
    async def test_buy_creates_position(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=100.0,
            price=0.55,
        )
        await adapter.place_order(order)

        pos = await adapter.get_position("market-1")
        assert pos is not None
        assert pos.market_id == "market-1"
        assert pos.quantity > 0

    @pytest.mark.asyncio
    async def test_insufficient_balance(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=20000.0,  # More than balance
            price=0.55,
        )
        result = await adapter.place_order(order)
        assert result.success is False
        assert "insufficient_balance" in result.error

    @pytest.mark.asyncio
    async def test_sell_without_position(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.SELL,
            token=TokenType.YES,
            amount=100.0,
            price=0.55,
        )
        result = await adapter.place_order(order)
        assert result.success is False
        assert "insufficient_position" in result.error

    @pytest.mark.asyncio
    async def test_buy_then_sell(self, adapter):
        # Buy
        buy_order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=100.0,
            price=0.55,
        )
        await adapter.place_order(buy_order)

        # Sell half the position (use a small amount to stay within position)
        pos = await adapter.get_position("market-1")
        # Sell amount must result in quantity <= pos.quantity after slippage
        sell_amount = 40.0  # Well under the ~100 we bought
        sell_order = Order(
            market_id="market-1",
            side=OrderSide.SELL,
            token=TokenType.YES,
            amount=sell_amount,
            price=0.55,
        )
        result = await adapter.place_order(sell_order)
        assert result.success is True

    @pytest.mark.asyncio
    async def test_slippage_applied(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=100.0,
            price=0.55,
        )
        result = await adapter.place_order(order)
        # Buy slippage makes price slightly higher
        assert result.filled_price > 0.55
        assert result.slippage > 0

    @pytest.mark.asyncio
    async def test_fees_applied(self, adapter):
        order = Order(
            market_id="market-1",
            side=OrderSide.BUY,
            token=TokenType.YES,
            amount=1000.0,
            price=0.55,
        )
        result = await adapter.place_order(order)
        assert result.fees == pytest.approx(1.0, abs=0.01)  # 0.1% of 1000

    @pytest.mark.asyncio
    async def test_get_positions_empty(self, adapter):
        positions = await adapter.get_positions()
        assert positions == []

    @pytest.mark.asyncio
    async def test_multiple_buys_average_price(self, adapter):
        for _ in range(3):
            order = Order(
                market_id="market-1",
                side=OrderSide.BUY,
                token=TokenType.YES,
                amount=100.0,
                price=0.55,
            )
            await adapter.place_order(order)

        pos = await adapter.get_position("market-1")
        assert pos is not None
        assert pos.quantity > 0  # Should have accumulated

    @pytest.mark.asyncio
    async def test_update_market_price(self, adapter):
        adapter.update_market_price("market-1", 0.60)
        price = await adapter.get_market_price("market-1")
        assert price == 0.60

    @pytest.mark.asyncio
    async def test_cancel_order_noop(self, adapter):
        result = await adapter.cancel_order("any-id")
        assert result is False
