import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CurrencyPipe, DecimalPipe, DatePipe, PercentPipe, UpperCasePipe } from '@angular/common';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../../services/pocketbase.service';
import { StatusBadge } from '../../components/status-badge/status-badge';

interface MarketDetail extends RecordModel {
  polymarket_id: string;
  question: string;
  current_prices: { yes: number; no: number };
  volume: number;
  liquidity: number;
  status: string;
  end_date: string;
}

interface Signal extends RecordModel {
  signal_type: string;
  direction: string;
  value: number;
  confidence: number;
}

interface Trade extends RecordModel {
  side: string;
  token: string;
  amount: number;
  price: number;
  strategy: string;
  mode: string;
  pnl: number;
}

@Component({
  selector: 'app-market-detail',
  imports: [RouterLink, CurrencyPipe, DecimalPipe, DatePipe, PercentPipe, UpperCasePipe, StatusBadge],
  template: `
    <div class="mb-4">
      <a routerLink="/markets" class="btn btn-ghost btn-sm">&larr; Back to Markets</a>
    </div>

    @if (loading()) {
      <div class="flex justify-center p-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
    } @else if (market()) {
      <h1 class="text-xl font-bold mb-4">{{ market()!.question }}</h1>

      <!-- Price & Info -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Yes Price</div>
          <div class="stat-value text-lg text-success">
            {{ market()!.current_prices?.yes | percent:'1.0-1' }}
          </div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">No Price</div>
          <div class="stat-value text-lg text-error">
            {{ market()!.current_prices?.no | percent:'1.0-1' }}
          </div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Volume</div>
          <div class="stat-value text-lg">{{ market()!.volume | currency:'USD':'symbol':'1.0-0' }}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Status</div>
          <div class="stat-value text-lg">
            <app-status-badge [status]="market()!.status" [label]="market()!.status" />
          </div>
        </div>
      </div>

      <!-- Signals -->
      <div class="card bg-base-200 mb-6">
        <div class="card-body">
          <h2 class="card-title">Recent Signals ({{ signals().length }})</h2>
          @if (signals().length === 0) {
            <p class="text-base-content/60">No signals for this market</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Direction</th>
                    <th>Value</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  @for (sig of signals(); track sig.id) {
                    <tr>
                      <td>{{ sig['created'] | date:'short' }}</td>
                      <td><span class="badge badge-outline">{{ sig.signal_type }}</span></td>
                      <td [class]="sig.direction === 'buy' ? 'text-success' : sig.direction === 'sell' ? 'text-error' : ''">
                        {{ sig.direction }}
                      </td>
                      <td>{{ sig.value | number:'1.3-3' }}</td>
                      <td>
                        <progress class="progress progress-primary w-20" [value]="sig.confidence * 100" max="100"></progress>
                        {{ sig.confidence | percent:'1.0-0' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>

      <!-- Trades -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Trade History ({{ trades().length }})</h2>
          @if (trades().length === 0) {
            <p class="text-base-content/60">No trades for this market</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Side</th>
                    <th>Token</th>
                    <th>Amount</th>
                    <th>Price</th>
                    <th>Strategy</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  @for (trade of trades(); track trade.id) {
                    <tr>
                      <td>{{ trade['created'] | date:'short' }}</td>
                      <td [class]="trade.side === 'buy' ? 'text-success' : 'text-error'">
                        {{ trade.side | uppercase }}
                      </td>
                      <td class="uppercase">{{ trade.token }}</td>
                      <td>{{ trade.amount | currency }}</td>
                      <td>{{ trade.price | percent:'1.1-1' }}</td>
                      <td>{{ trade.strategy }}</td>
                      <td [class]="(trade.pnl ?? 0) >= 0 ? 'text-success' : 'text-error'">
                        {{ trade.pnl | currency }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    } @else {
      <div class="alert alert-error">Market not found</div>
    }
  `,
})
export class MarketDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pb = inject(PocketBaseService);

  readonly market = signal<MarketDetail | null>(null);
  readonly signals = signal<Signal[]>([]);
  readonly trades = signal<Trade[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadMarket(id);
    }
  }

  private async loadMarket(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const record = await this.pb.getRecord<MarketDetail>('markets', id);
      this.market.set(record);

      // Load signals for this market
      const sigs = await this.pb.listRecords<Signal>(
        'signals', 1, 50, '-created', `market_id = "${id}"`
      );
      this.signals.set(sigs);

      // Load trades for this market
      const tds = await this.pb.listRecords<Trade>(
        'trades', 1, 50, '-created', `market_id = "${id}"`
      );
      this.trades.set(tds);
    } catch (e) {
      console.error('Failed to load market detail:', e);
    } finally {
      this.loading.set(false);
    }
  }
}
