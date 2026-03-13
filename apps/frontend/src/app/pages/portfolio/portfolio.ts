import { Component, inject, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { PortfolioService, Position } from '../../services/portfolio.service';
import { TradeService } from '../../services/trade.service';
import { PnlChart } from '../../components/pnl-chart/pnl-chart';

@Component({
  selector: 'app-portfolio',
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, PnlChart],
  template: `
    <h1 class="text-2xl font-bold mb-6">Portfolio</h1>

    <!-- Performance stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Balance</div>
        <div class="stat-value text-lg">{{ portfolio.balance() | currency }}</div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Portfolio Value</div>
        <div class="stat-value text-lg">{{ portfolio.portfolioValue() | currency }}</div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Total P&L</div>
        <div class="stat-value text-lg" [class]="pnlClass()">
          {{ portfolio.totalPnl() | currency }}
        </div>
        <div class="stat-desc">{{ portfolio.pnlPercent() | number:'1.1-1' }}%</div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Daily P&L</div>
        <div class="stat-value text-lg" [class]="dailyPnlClass()">
          {{ portfolio.dailyPnl() | currency }}
        </div>
      </div>
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Win Rate</div>
        <div class="stat-value text-lg">{{ portfolio.winRate() | percent:'1.0-1' }}</div>
        <div class="stat-desc">{{ tradeService.winCount() }}W / {{ tradeService.lossCount() }}L</div>
      </div>
    </div>

    <!-- P&L Chart -->
    <div class="card bg-base-200 mb-6">
      <div class="card-body">
        <h2 class="card-title">P&L Overview</h2>
        <app-pnl-chart
          [labels]="chartLabels()"
          [values]="chartData()" />
      </div>
    </div>

    <!-- Open Positions -->
    <div class="card bg-base-200">
      <div class="card-body">
        <h2 class="card-title">Open Positions ({{ portfolio.positions().length }})</h2>
        @if (portfolio.positions().length === 0) {
          <p class="text-base-content/60">No open positions</p>
        } @else {
          <div class="overflow-x-auto">
            <table class="table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Token</th>
                  <th>Quantity</th>
                  <th>Avg Price</th>
                  <th>Current</th>
                  <th>Unrealized P&L</th>
                </tr>
              </thead>
              <tbody>
                @for (pos of portfolio.positions(); track pos.market_id) {
                  <tr>
                    <td class="font-mono text-sm">{{ pos.market_id }}</td>
                    <td><span class="badge badge-outline uppercase">{{ pos.token }}</span></td>
                    <td>{{ pos.quantity | number:'1.2-2' }}</td>
                    <td>{{ pos.avg_price | currency }}</td>
                    <td>{{ pos.current_price | currency }}</td>
                    <td [class]="pos.unrealized_pnl >= 0 ? 'text-success' : 'text-error'">
                      {{ pos.unrealized_pnl | currency }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class PortfolioPage {
  readonly portfolio = inject(PortfolioService);
  readonly tradeService = inject(TradeService);

  readonly pnlClass = computed(() =>
    this.portfolio.totalPnl() >= 0 ? 'text-success' : 'text-error'
  );

  readonly dailyPnlClass = computed(() =>
    this.portfolio.dailyPnl() >= 0 ? 'text-success' : 'text-error'
  );

  readonly chartLabels = computed(() => {
    const trades = this.tradeService.trades();
    return trades.slice(0, 20).reverse().map((_, i) => `T${i + 1}`);
  });

  readonly chartData = computed(() => {
    const trades = this.tradeService.trades();
    return trades.slice(0, 20).reverse().map(t => t.pnl ?? 0);
  });
}
