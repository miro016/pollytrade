import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

export interface Market extends RecordModel {
  polymarket_id: string;
  question: string;
  current_prices: { yes: number; no: number };
  volume: number;
  liquidity: number;
  status: 'active' | 'closed' | 'resolved';
  end_date: string;
}

@Injectable({ providedIn: 'root' })
export class MarketService implements OnDestroy {
  private readonly pb = inject(PocketBaseService);
  private unsubscribe?: () => void;

  readonly markets = signal<Market[]>([]);
  readonly loading = signal(false);

  readonly activeMarkets = computed(() =>
    this.markets().filter(m => m.status === 'active')
  );

  readonly marketCount = computed(() => this.markets().length);

  constructor() {
    this.loadMarkets();
    this.subscribeToUpdates();
  }

  async loadMarkets(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.pb.listRecords<Market>('markets', 1, 100, '-volume');
      this.markets.set(items);
    } catch (e) {
      console.error('Failed to load markets:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    this.unsubscribe = this.pb.subscribe('markets', (data) => {
      const current = this.markets();
      if (data.action === 'create') {
        this.markets.set([...current, data.record as Market]);
      } else if (data.action === 'update') {
        this.markets.set(
          current.map(m => m.id === data.record.id ? data.record as Market : m)
        );
      } else if (data.action === 'delete') {
        this.markets.set(current.filter(m => m.id !== data.record.id));
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
