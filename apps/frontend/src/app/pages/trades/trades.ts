import { Component, inject, signal, OnInit } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../../services/pocketbase.service';
import { StatusBadge } from '../../components/status-badge/status-badge';

export interface Trade extends RecordModel {
  market_id: string;
  side: 'buy' | 'sell';
  token: 'yes' | 'no';
  amount: number;
  price: number;
  strategy: string;
  mode: 'paper' | 'live';
  pnl: number;
  fees: number;
  created: string;
}

@Component({
  selector: 'app-trades',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, UpperCasePipe, StatusBadge],
  template: `
    <h1 class="text-2xl font-bold mb-6">Trade History</h1>

    <!-- Filters -->
    <div class="flex gap-2 mb-4">
      <select class="select select-bordered select-sm" (change)="onModeFilter($event)">
        <option value="">All Modes</option>
        <option value="paper">Paper</option>
        <option value="live">Live</option>
      </select>
      <select class="select select-bordered select-sm" (change)="onSideFilter($event)">
        <option value="">All Sides</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
    </div>

    <!-- Trades table -->
    <div class="overflow-x-auto">
      <table class="table table-sm">
        <thead>
          <tr>
            <th>Date</th>
            <th>Side</th>
            <th>Token</th>
            <th>Amount</th>
            <th>Price</th>
            <th>Strategy</th>
            <th>Mode</th>
            <th>P&L</th>
          </tr>
        </thead>
        <tbody>
          @for (trade of trades(); track trade.id) {
            <tr class="hover">
              <td>{{ trade.created | date:'short' }}</td>
              <td>
                <span class="badge" [class]="trade.side === 'buy' ? 'badge-success' : 'badge-error'">
                  {{ trade.side | uppercase }}
                </span>
              </td>
              <td class="uppercase">{{ trade.token }}</td>
              <td>{{ trade.amount | currency }}</td>
              <td class="font-mono">{{ trade.price | number:'1.4-4' }}</td>
              <td>{{ trade.strategy }}</td>
              <td>
                <app-status-badge [status]="trade.mode" [label]="trade.mode" />
              </td>
              <td [class]="(trade.pnl ?? 0) >= 0 ? 'text-success' : 'text-error'">
                {{ trade.pnl | currency }}
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8" class="text-center opacity-50">
                {{ loading() ? 'Loading...' : 'No trades yet' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex justify-center mt-4">
      <div class="join">
        <button class="join-item btn btn-sm" (click)="prevPage()" [disabled]="page() <= 1">Prev</button>
        <button class="join-item btn btn-sm">Page {{ page() }}</button>
        <button class="join-item btn btn-sm" (click)="nextPage()">Next</button>
      </div>
    </div>
  `,
})
export class TradesPage implements OnInit {
  private readonly pb = inject(PocketBaseService);

  readonly trades = signal<Trade[]>([]);
  readonly loading = signal(false);
  readonly page = signal(1);
  private modeFilter = '';
  private sideFilter = '';

  ngOnInit(): void {
    this.loadTrades();
  }

  async loadTrades(): Promise<void> {
    this.loading.set(true);
    try {
      const filters: string[] = [];
      if (this.modeFilter) filters.push(`mode = "${this.modeFilter}"`);
      if (this.sideFilter) filters.push(`side = "${this.sideFilter}"`);

      const items = await this.pb.listRecords<Trade>(
        'trades',
        this.page(),
        20,
        '-created',
        filters.join(' && '),
      );
      this.trades.set(items);
    } catch (e) {
      console.error('Failed to load trades:', e);
    } finally {
      this.loading.set(false);
    }
  }

  onModeFilter(event: Event): void {
    this.modeFilter = (event.target as HTMLSelectElement).value;
    this.page.set(1);
    this.loadTrades();
  }

  onSideFilter(event: Event): void {
    this.sideFilter = (event.target as HTMLSelectElement).value;
    this.page.set(1);
    this.loadTrades();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadTrades();
    }
  }

  nextPage(): void {
    this.page.update(p => p + 1);
    this.loadTrades();
  }
}
