import { Component, inject, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { PortfolioService } from '../../services/portfolio.service';
import { BotStatusService } from '../../services/bot-status.service';
import { MarketService } from '../../services/market.service';
import { StatusBadge } from '../../components/status-badge/status-badge';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, DecimalPipe, PercentPipe, StatusBadge],
  template: `
    <h1 class="text-2xl font-bold mb-6">Dashboard</h1>

    <!-- Stats cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <!-- Portfolio Value -->
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Portfolio Value</div>
        <div class="stat-value text-lg">{{ portfolioService.portfolioValue() | currency }}</div>
        <div class="stat-desc">
          Mode: <span class="uppercase font-semibold">{{ portfolioService.mode() }}</span>
        </div>
      </div>

      <!-- Daily P&L -->
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Daily P&L</div>
        <div class="stat-value text-lg" [class]="pnlClass()">
          {{ portfolioService.dailyPnl() | currency }}
        </div>
        <div class="stat-desc">
          Total: {{ portfolioService.totalPnl() | currency }}
        </div>
      </div>

      <!-- Win Rate -->
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Win Rate</div>
        <div class="stat-value text-lg">{{ portfolioService.winRate() | percent:'1.0-1' }}</div>
        <div class="stat-desc">
          {{ portfolioService.positions().length }} active positions
        </div>
      </div>

      <!-- Bot Status -->
      <div class="stat bg-base-200 rounded-box">
        <div class="stat-title">Bot Status</div>
        <div class="stat-value text-lg flex items-center gap-2">
          <app-status-badge
            [status]="botStatus.isRunning() ? 'running' : 'stopped'"
            [label]="botStatus.isRunning() ? 'Running' : 'Stopped'" />
        </div>
        <div class="stat-desc">
          Strategy: {{ botStatus.strategy() }}
        </div>
      </div>
    </div>

    <!-- Risk & Markets row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <!-- Risk State -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Risk Management</h2>
          <div class="flex gap-2 items-center">
            <span>Circuit Breaker:</span>
            <app-status-badge
              [status]="botStatus.status()?.circuit_breaker_state ?? 'closed'"
              [label]="botStatus.status()?.circuit_breaker_state ?? 'Closed'" />
          </div>
          <div class="flex gap-2 items-center">
            <span>Risk State:</span>
            <app-status-badge
              [status]="botStatus.riskState()"
              [label]="botStatus.riskState()" />
          </div>
          <div class="text-sm opacity-70 mt-2">
            Markets monitored: {{ botStatus.status()?.markets_monitored ?? 0 }}
          </div>
        </div>
      </div>

      <!-- Active Markets -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Active Markets</h2>
          <div class="text-3xl font-bold">{{ marketService.marketCount() }}</div>
          <div class="text-sm opacity-70">
            {{ marketService.activeMarkets().length }} currently active
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardPage {
  readonly portfolioService = inject(PortfolioService);
  readonly botStatus = inject(BotStatusService);
  readonly marketService = inject(MarketService);

  readonly pnlClass = computed(() =>
    this.portfolioService.dailyPnl() >= 0 ? 'text-success' : 'text-error'
  );
}
