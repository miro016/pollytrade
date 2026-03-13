import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DecimalPipe, PercentPipe, CurrencyPipe } from '@angular/common';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../../services/pocketbase.service';

interface StrategyStats {
  name: string;
  category: string;
  active: boolean;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  maxDrawdown: number;
  balance: number;
}

interface Trade extends RecordModel {
  strategy: string;
  pnl: number;
  amount: number;
  side: string;
  price: number;
  mode: string;
  created: string;
}

interface StrategyConfig extends RecordModel {
  name: string;
  active: boolean;
  parameters: { min_confidence: number; min_edge: number };
}

@Component({
  selector: 'app-comparison',
  imports: [DecimalPipe, PercentPipe, CurrencyPipe],
  template: `
    <h1 class="text-2xl font-bold mb-6">Strategy Comparison</h1>

    <!-- Category filter -->
    <div class="flex gap-2 flex-wrap mb-6">
      @for (cat of categories; track cat.value) {
        <button class="btn btn-sm"
          [class.btn-primary]="filterCategory() === cat.value"
          [class.btn-outline]="filterCategory() !== cat.value"
          (click)="filterCategory.set(cat.value)">
          {{ cat.label }}
        </button>
      }
    </div>

    @if (loading()) {
      <div class="text-center py-12">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2 opacity-50">Loading strategy data...</p>
      </div>
    } @else {
      <!-- Summary stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Active Strategies</div>
          <div class="stat-value text-lg">{{ activeCount() }}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Total Trades</div>
          <div class="stat-value text-lg">{{ totalTrades() }}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Best Performer</div>
          <div class="stat-value text-sm">{{ bestStrategy() }}</div>
        </div>
        <div class="stat bg-base-200 rounded-box">
          <div class="stat-title">Avg Win Rate</div>
          <div class="stat-value text-lg">{{ avgWinRate() | percent:'1.0-1' }}</div>
        </div>
      </div>

      <!-- Strategy comparison table -->
      <div class="card bg-base-200 mb-6">
        <div class="card-body p-0">
          <div class="overflow-x-auto">
            <table class="table table-sm">
              <thead>
                <tr>
                  <th class="cursor-pointer" (click)="sortBy('name')">Strategy</th>
                  <th>Status</th>
                  <th class="cursor-pointer text-right" (click)="sortBy('trades')">Trades</th>
                  <th class="cursor-pointer text-right" (click)="sortBy('wins')">W/L</th>
                  <th class="cursor-pointer text-right" (click)="sortBy('winRate')">Win Rate</th>
                  <th class="cursor-pointer text-right" (click)="sortBy('totalPnl')">Total P&L</th>
                  <th class="cursor-pointer text-right" (click)="sortBy('avgPnl')">Avg P&L</th>
                </tr>
              </thead>
              <tbody>
                @for (s of sortedStrategies(); track s.name) {
                  <tr>
                    <td>
                      <div class="font-semibold text-sm">{{ s.name }}</div>
                      <div class="text-xs opacity-50">{{ s.category }}</div>
                    </td>
                    <td>
                      <span class="badge badge-xs"
                        [class.badge-success]="s.active"
                        [class.badge-ghost]="!s.active">
                        {{ s.active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    <td class="text-right font-mono">{{ s.trades }}</td>
                    <td class="text-right font-mono">
                      <span class="text-success">{{ s.wins }}</span>/<span class="text-error">{{ s.losses }}</span>
                    </td>
                    <td class="text-right font-mono"
                      [class.text-success]="s.winRate >= 0.5"
                      [class.text-error]="s.winRate < 0.5 && s.trades > 0">
                      {{ s.trades > 0 ? (s.winRate | percent:'1.0-1') : '-' }}
                    </td>
                    <td class="text-right font-mono"
                      [class.text-success]="s.totalPnl >= 0"
                      [class.text-error]="s.totalPnl < 0">
                      {{ s.totalPnl | currency:'USD':'symbol':'1.2-2' }}
                    </td>
                    <td class="text-right font-mono"
                      [class.text-success]="s.avgPnl >= 0"
                      [class.text-error]="s.avgPnl < 0">
                      {{ s.trades > 0 ? (s.avgPnl | currency:'USD':'symbol':'1.2-2') : '-' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-center opacity-50 py-8">
                      No strategies found. Activate strategies in the Setup Wizard.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Category performance summary -->
      <h2 class="text-lg font-bold mb-4">Category Performance</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        @for (group of categoryStats(); track group.category) {
          <div class="card bg-base-200">
            <div class="card-body p-4">
              <h3 class="card-title text-sm capitalize">{{ group.category }}</h3>
              <div class="grid grid-cols-2 gap-2 mt-2 text-sm">
                <div>
                  <p class="opacity-70">Strategies</p>
                  <p class="font-semibold">{{ group.count }}</p>
                </div>
                <div>
                  <p class="opacity-70">Total Trades</p>
                  <p class="font-semibold">{{ group.trades }}</p>
                </div>
                <div>
                  <p class="opacity-70">Avg Win Rate</p>
                  <p class="font-semibold" [class.text-success]="group.avgWinRate >= 0.5" [class.text-error]="group.avgWinRate < 0.5 && group.trades > 0">
                    {{ group.trades > 0 ? (group.avgWinRate | percent:'1.0-1') : '-' }}
                  </p>
                </div>
                <div>
                  <p class="opacity-70">Total P&L</p>
                  <p class="font-semibold" [class.text-success]="group.totalPnl >= 0" [class.text-error]="group.totalPnl < 0">
                    {{ group.totalPnl | currency:'USD':'symbol':'1.2-2' }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class ComparisonPage implements OnInit {
  private readonly pb = inject(PocketBaseService);

  readonly loading = signal(true);
  readonly allStats = signal<StrategyStats[]>([]);
  readonly filterCategory = signal<string>('all');
  readonly sortField = signal<keyof StrategyStats>('totalPnl');
  readonly sortAsc = signal(false);

  readonly categories = [
    { value: 'all', label: 'All' },
    { value: 'conservative', label: 'Conservative' },
    { value: 'realistic', label: 'Realistic' },
    { value: 'dynamic', label: 'Dynamic' },
  ];

  readonly filteredStats = computed(() => {
    const cat = this.filterCategory();
    const all = this.allStats();
    if (cat === 'all') return all;
    return all.filter(s => s.category === cat);
  });

  readonly sortedStrategies = computed(() => {
    const stats = [...this.filteredStats()];
    const field = this.sortField();
    const asc = this.sortAsc();
    stats.sort((a, b) => {
      const av = a[field] ?? 0;
      const bv = b[field] ?? 0;
      if (typeof av === 'string' && typeof bv === 'string') {
        return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      return asc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return stats;
  });

  readonly activeCount = computed(() => this.filteredStats().filter(s => s.active).length);
  readonly totalTrades = computed(() => this.filteredStats().reduce((sum, s) => sum + s.trades, 0));
  readonly bestStrategy = computed(() => {
    const stats = this.filteredStats().filter(s => s.trades > 0);
    if (stats.length === 0) return 'N/A';
    const best = stats.reduce((a, b) => a.totalPnl > b.totalPnl ? a : b);
    return best.name.replace(/^(Conservative|Realistic|Dynamic) - /, '');
  });
  readonly avgWinRate = computed(() => {
    const withTrades = this.filteredStats().filter(s => s.trades > 0);
    if (withTrades.length === 0) return 0;
    return withTrades.reduce((sum, s) => sum + s.winRate, 0) / withTrades.length;
  });

  readonly categoryStats = computed(() => {
    const cats = ['conservative', 'realistic', 'dynamic'];
    return cats.map(cat => {
      const strategies = this.allStats().filter(s => s.category === cat);
      const withTrades = strategies.filter(s => s.trades > 0);
      const trades = strategies.reduce((sum, s) => sum + s.trades, 0);
      return {
        category: cat,
        count: strategies.length,
        trades,
        avgWinRate: withTrades.length > 0
          ? withTrades.reduce((sum, s) => sum + s.winRate, 0) / withTrades.length
          : 0,
        totalPnl: strategies.reduce((sum, s) => sum + s.totalPnl, 0),
      };
    });
  });

  ngOnInit(): void {
    this.loadData();
  }

  sortBy(field: keyof StrategyStats): void {
    if (this.sortField() === field) {
      this.sortAsc.set(!this.sortAsc());
    } else {
      this.sortField.set(field);
      this.sortAsc.set(false);
    }
  }

  private getCategory(name: string): string {
    if (name.startsWith('Conservative')) return 'conservative';
    if (name.startsWith('Realistic')) return 'realistic';
    if (name.startsWith('Dynamic')) return 'dynamic';
    return 'other';
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      // Load all strategies
      const configs = await this.pb.listRecords<StrategyConfig>(
        'strategy_configs', 1, 100, 'name',
      );

      // Load all trades
      const trades = await this.pb.listRecords<Trade>(
        'trades', 1, 500, '-created',
      );

      // Group trades by strategy name
      const tradesByStrategy = new Map<string, Trade[]>();
      for (const trade of trades) {
        const key = trade.strategy || 'Unknown';
        if (!tradesByStrategy.has(key)) {
          tradesByStrategy.set(key, []);
        }
        tradesByStrategy.get(key)!.push(trade);
      }

      // Build stats
      const stats: StrategyStats[] = configs.map(cfg => {
        const stratTrades = tradesByStrategy.get(cfg.name) || [];
        const wins = stratTrades.filter(t => (t.pnl ?? 0) > 0).length;
        const losses = stratTrades.filter(t => (t.pnl ?? 0) < 0).length;
        const totalPnl = stratTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

        return {
          name: cfg.name,
          category: this.getCategory(cfg.name),
          active: cfg.active,
          trades: stratTrades.length,
          wins,
          losses,
          winRate: stratTrades.length > 0 ? wins / stratTrades.length : 0,
          totalPnl,
          avgPnl: stratTrades.length > 0 ? totalPnl / stratTrades.length : 0,
          maxDrawdown: 0,
          balance: 10000 + totalPnl,
        };
      });

      this.allStats.set(stats);
    } catch (e) {
      console.error('Failed to load comparison data:', e);
    } finally {
      this.loading.set(false);
    }
  }
}
