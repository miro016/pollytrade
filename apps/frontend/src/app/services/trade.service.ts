import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

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
  slippage: number;
  signal_id?: string;
}

@Injectable({ providedIn: 'root' })
export class TradeService implements OnDestroy {
  private readonly pb = inject(PocketBaseService);
  private unsubscribe?: () => void;

  readonly trades = signal<Trade[]>([]);
  readonly loading = signal(false);
  readonly totalCount = signal(0);

  readonly recentTrades = computed(() => this.trades().slice(0, 50));

  readonly totalPnl = computed(() =>
    this.trades().reduce((sum, t) => sum + (t.pnl ?? 0), 0)
  );

  readonly winCount = computed(() =>
    this.trades().filter(t => (t.pnl ?? 0) > 0).length
  );

  readonly lossCount = computed(() =>
    this.trades().filter(t => (t.pnl ?? 0) < 0).length
  );

  constructor() {
    this.loadTrades();
    this.subscribeToUpdates();
  }

  async loadTrades(page = 1, perPage = 100, mode?: string, side?: string): Promise<void> {
    this.loading.set(true);
    try {
      let filter = '';
      const filters: string[] = [];
      if (mode) filters.push(`mode = "${mode}"`);
      if (side) filters.push(`side = "${side}"`);
      if (filters.length) filter = filters.join(' && ');

      const items = await this.pb.listRecords<Trade>('trades', page, perPage, '-created', filter || undefined);
      this.trades.set(items);
    } catch (e) {
      console.error('Failed to load trades:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    this.unsubscribe = this.pb.subscribe('trades', (data) => {
      if (data.action === 'create') {
        this.trades.update(current => [data.record as Trade, ...current]);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
