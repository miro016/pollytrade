import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

export interface Position {
  market_id: string;
  token: 'yes' | 'no';
  quantity: number;
  avg_price: number;
  current_price: number;
  unrealized_pnl: number;
}

export interface Portfolio extends RecordModel {
  balance: number;
  positions: Position[];
  daily_pnl: number;
  total_pnl: number;
  win_rate: number;
  total_trades: number;
  mode: 'paper' | 'live';
  peak_balance: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioService implements OnDestroy {
  private readonly pb = inject(PocketBaseService);
  private unsubscribe?: () => void;

  readonly portfolio = signal<Portfolio | null>(null);
  readonly loading = signal(false);

  readonly balance = computed(() => this.portfolio()?.balance ?? 0);
  readonly totalPnl = computed(() => this.portfolio()?.total_pnl ?? 0);
  readonly dailyPnl = computed(() => this.portfolio()?.daily_pnl ?? 0);
  readonly winRate = computed(() => this.portfolio()?.win_rate ?? 0);
  readonly positions = computed(() => this.portfolio()?.positions ?? []);
  readonly mode = computed(() => this.portfolio()?.mode ?? 'paper');

  readonly portfolioValue = computed(() => {
    const bal = this.balance();
    const posValue = this.positions().reduce(
      (sum, p) => sum + p.quantity * p.current_price, 0
    );
    return bal + posValue;
  });

  readonly pnlPercent = computed(() => {
    const port = this.portfolio();
    if (!port || port.peak_balance === 0) return 0;
    return (this.totalPnl() / port.peak_balance) * 100;
  });

  constructor() {
    this.loadPortfolio();
    this.subscribeToUpdates();
  }

  async loadPortfolio(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.pb.listRecords<Portfolio>('portfolio', 1, 1, '-created');
      if (items.length > 0) {
        this.portfolio.set(items[0]);
      }
    } catch (e) {
      console.error('Failed to load portfolio:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    this.unsubscribe = this.pb.subscribe('portfolio', (data) => {
      if (data.action === 'update' || data.action === 'create') {
        this.portfolio.set(data.record as Portfolio);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
