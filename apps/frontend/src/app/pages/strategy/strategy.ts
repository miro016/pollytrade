import { Component, inject, signal, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../../services/pocketbase.service';

export interface StrategyConfig extends RecordModel {
  name: string;
  description: string;
  parameters: {
    indicators: {
      zscore: { enabled: boolean; window: number; threshold: number; weight: number };
      entropy: { enabled: boolean; threshold: number; weight: number };
      garch: { enabled: boolean; p: number; q: number; weight: number };
      rsi: { enabled: boolean; period: number; overbought: number; oversold: number; weight: number };
    };
    min_confidence: number;
    min_edge: number;
  };
  active: boolean;
  mode: 'paper' | 'live';
  version: number;
}

@Component({
  selector: 'app-strategy',
  imports: [DecimalPipe, FormsModule],
  template: `
    <h1 class="text-2xl font-bold mb-6">Strategy Configuration</h1>

    @if (config(); as cfg) {
      <div class="max-w-2xl space-y-6">
        <!-- Strategy info -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">{{ cfg.name }}</h2>
            <p class="text-sm opacity-70">{{ cfg.description }}</p>
            <div class="flex gap-2 text-sm">
              <span class="badge badge-outline">v{{ cfg.version }}</span>
              <span class="badge" [class]="cfg.active ? 'badge-success' : 'badge-ghost'">
                {{ cfg.active ? 'Active' : 'Inactive' }}
              </span>
              <span class="badge badge-outline uppercase">{{ cfg.mode }}</span>
            </div>
          </div>
        </div>

        <!-- Indicator cards -->
        @for (indicator of indicators; track indicator.key) {
          <div class="card bg-base-200">
            <div class="card-body">
              <div class="flex justify-between items-center">
                <h3 class="card-title text-base">{{ indicator.label }}</h3>
                <input
                  type="checkbox"
                  class="toggle toggle-success"
                  [checked]="getIndicator(cfg, indicator.key)?.enabled"
                  (change)="toggleIndicator(indicator.key)" />
              </div>
              @if (getIndicator(cfg, indicator.key)?.enabled) {
                <div class="grid grid-cols-2 gap-4 mt-3">
                  <div class="form-control">
                    <label class="label"><span class="label-text">Weight</span></label>
                    <input
                      type="range"
                      min="0" max="1" step="0.05"
                      class="range range-sm range-success"
                      [value]="getIndicator(cfg, indicator.key)?.weight"
                      (input)="updateParam(indicator.key, 'weight', $event)" />
                    <span class="text-xs text-center mt-1">
                      {{ getIndicator(cfg, indicator.key)?.weight | number:'1.2-2' }}
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Global settings -->
        <div class="card bg-base-200">
          <div class="card-body">
            <h3 class="card-title text-base">Global Settings</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="form-control">
                <label class="label"><span class="label-text">Min Confidence</span></label>
                <input
                  type="number"
                  class="input input-bordered input-sm"
                  min="0" max="1" step="0.05"
                  [value]="cfg.parameters.min_confidence" />
              </div>
              <div class="form-control">
                <label class="label"><span class="label-text">Min Edge</span></label>
                <input
                  type="number"
                  class="input input-bordered input-sm"
                  min="0" max="0.5" step="0.005"
                  [value]="cfg.parameters.min_edge" />
              </div>
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div class="text-center opacity-50 py-12">
        {{ loading() ? 'Loading strategy...' : 'No strategy configured' }}
      </div>
    }
  `,
})
export class StrategyPage implements OnInit {
  private readonly pb = inject(PocketBaseService);

  readonly config = signal<StrategyConfig | null>(null);
  readonly loading = signal(false);

  readonly indicators = [
    { key: 'zscore', label: 'Z-Score (Mean Reversion)' },
    { key: 'entropy', label: 'Entropy (Market Uncertainty)' },
    { key: 'garch', label: 'GARCH (Volatility Forecast)' },
    { key: 'rsi', label: 'RSI (Momentum)' },
  ];

  ngOnInit(): void {
    this.loadConfig();
  }

  async loadConfig(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.pb.listRecords<StrategyConfig>(
        'strategy_configs', 1, 1, '-created', 'active = true'
      );
      if (items.length > 0) {
        this.config.set(items[0]);
      }
    } catch (e) {
      console.error('Failed to load strategy config:', e);
    } finally {
      this.loading.set(false);
    }
  }

  getIndicator(cfg: StrategyConfig, key: string): any {
    return (cfg.parameters.indicators as any)?.[key];
  }

  toggleIndicator(key: string): void {
    const cfg = this.config();
    if (!cfg) return;
    const indicators = { ...cfg.parameters.indicators } as any;
    indicators[key] = { ...indicators[key], enabled: !indicators[key].enabled };
    this.config.set({
      ...cfg,
      parameters: { ...cfg.parameters, indicators },
    });
  }

  updateParam(key: string, param: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    const cfg = this.config();
    if (!cfg) return;
    const indicators = { ...cfg.parameters.indicators } as any;
    indicators[key] = { ...indicators[key], [param]: value };
    this.config.set({
      ...cfg,
      parameters: { ...cfg.parameters, indicators },
    });
  }
}
