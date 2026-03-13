import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from '../../services/pocketbase.service';
import { STRATEGY_PRESETS, StrategyPresetDef } from './strategy-presets';

@Component({
  selector: 'app-setup',
  imports: [FormsModule],
  template: `
    <h1 class="text-2xl font-bold mb-6">Setup Wizard</h1>

    <!-- Steps indicator -->
    <ul class="steps steps-horizontal w-full mb-8">
      <li class="step" [class.step-primary]="step() >= 1">Wallet Setup</li>
      <li class="step" [class.step-primary]="step() >= 2">Choose Strategies</li>
      <li class="step" [class.step-primary]="step() >= 3">Review & Activate</li>
    </ul>

    <!-- Step 1: Wallet Setup -->
    @if (step() === 1) {
      <div class="max-w-2xl mx-auto space-y-6">
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Trading Mode</h2>
            <p class="text-sm opacity-70 mb-4">Start with paper trading to test strategies risk-free.</p>
            <div class="flex gap-4">
              <label class="label cursor-pointer gap-2">
                <input type="radio" name="mode" class="radio radio-primary"
                  [checked]="walletMode() === 'paper'" (change)="walletMode.set('paper')" />
                <span class="label-text text-lg">Paper Trading</span>
              </label>
              <label class="label cursor-pointer gap-2 opacity-50">
                <input type="radio" name="mode" class="radio" disabled />
                <span class="label-text text-lg">Live Trading (coming soon)</span>
              </label>
            </div>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Balance Per Strategy</h2>
            <p class="text-sm opacity-70 mb-4">Each active strategy gets its own independent paper balance.</p>
            <div class="form-control">
              <label class="label"><span class="label-text">Balance per strategy (USD)</span></label>
              <input type="number" class="input input-bordered w-full max-w-xs"
                min="100" max="1000000" step="100"
                [ngModel]="walletBalance()" (ngModelChange)="walletBalance.set($event)" />
            </div>
            <div class="flex gap-2 mt-3">
              @for (preset of balancePresets; track preset) {
                <button class="btn btn-sm btn-outline"
                  [class.btn-primary]="walletBalance() === preset"
                  (click)="walletBalance.set(preset)">
                  {{ '$' + preset.toLocaleString() }}
                </button>
              }
            </div>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">API Credentials</h2>
            <p class="text-sm opacity-70 mb-4">Optional for paper trading. Required for live trading.</p>
            <div class="form-control mb-3">
              <label class="label"><span class="label-text">Polymarket API Key</span></label>
              <input type="password" class="input input-bordered w-full"
                placeholder="Leave blank for paper trading"
                [ngModel]="apiKey()" (ngModelChange)="apiKey.set($event)" />
            </div>
            <div class="form-control mb-3">
              <label class="label"><span class="label-text">API Secret</span></label>
              <input type="password" class="input input-bordered w-full"
                placeholder="Leave blank for paper trading"
                [ngModel]="apiSecret()" (ngModelChange)="apiSecret.set($event)" />
            </div>
            <div class="form-control">
              <label class="label"><span class="label-text">Passphrase</span></label>
              <input type="password" class="input input-bordered w-full"
                placeholder="Leave blank for paper trading"
                [ngModel]="passphrase()" (ngModelChange)="passphrase.set($event)" />
            </div>
          </div>
        </div>

        <div class="flex justify-end">
          <button class="btn btn-primary" (click)="step.set(2)">
            Next: Choose Strategies
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    }

    <!-- Step 2: Choose Strategies (multi-select) -->
    @if (step() === 2) {
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- Category filter + bulk actions -->
        <div class="flex gap-2 flex-wrap items-center">
          @for (cat of categories; track cat.value) {
            <button class="btn btn-sm"
              [class.btn-primary]="selectedCategory() === cat.value"
              [class.btn-outline]="selectedCategory() !== cat.value"
              (click)="selectedCategory.set(cat.value)">
              {{ cat.label }}
              <span class="badge badge-sm ml-1">{{ getCategoryCount(cat.value) }}</span>
            </button>
          }
          <div class="divider divider-horizontal mx-1"></div>
          <button class="btn btn-sm btn-outline btn-success" (click)="selectAllInCategory()">
            Select All {{ selectedCategory() !== 'all' ? selectedCategory() : '' }}
          </button>
          <button class="btn btn-sm btn-outline btn-error" (click)="deselectAllInCategory()">
            Deselect All
          </button>
        </div>

        <div class="flex justify-between items-center">
          <div class="alert py-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{{ getCategoryDescription() }}</span>
          </div>
          <span class="badge badge-lg badge-primary ml-4 shrink-0">{{ selectedStrategies().length }} selected</span>
        </div>

        <!-- Strategy cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (strategy of filteredStrategies(); track strategy.name) {
            <div class="card bg-base-200 cursor-pointer transition-all hover:shadow-lg"
              [class.ring-2]="isSelected(strategy.name)"
              [class.ring-primary]="isSelected(strategy.name)"
              (click)="toggleStrategy(strategy)">
              <div class="card-body p-4">
                <div class="flex items-start justify-between">
                  <h3 class="card-title text-sm">{{ strategy.name }}</h3>
                  <input type="checkbox" class="checkbox checkbox-primary checkbox-sm"
                    [checked]="isSelected(strategy.name)"
                    (click)="$event.stopPropagation()" (change)="toggleStrategy(strategy)" />
                </div>
                <p class="text-xs opacity-70">{{ strategy.description }}</p>
                <div class="flex flex-wrap gap-1 mt-2">
                  <span class="badge badge-xs badge-outline">Conf: {{ strategy.parameters.min_confidence }}</span>
                  <span class="badge badge-xs badge-outline">Edge: {{ strategy.parameters.min_edge }}</span>
                  @for (ind of getEnabledIndicators(strategy); track ind) {
                    <span class="badge badge-xs badge-primary badge-outline">{{ ind }}</span>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <div class="flex justify-between">
          <button class="btn btn-ghost" (click)="step.set(1)">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button class="btn btn-primary" [disabled]="selectedStrategies().length === 0" (click)="step.set(3)">
            Next: Review ({{ selectedStrategies().length }})
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    }

    <!-- Step 3: Review & Activate -->
    @if (step() === 3) {
      <div class="max-w-2xl mx-auto space-y-6">
        <!-- Wallet summary -->
        <div class="card bg-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h2 class="card-title">Wallet Configuration</h2>
              <button class="btn btn-ghost btn-sm" (click)="step.set(1)">Edit</button>
            </div>
            <div class="grid grid-cols-2 gap-4 mt-2">
              <div>
                <p class="text-sm opacity-70">Mode</p>
                <p class="font-semibold uppercase">{{ walletMode() }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">Balance Per Strategy</p>
                <p class="font-semibold">{{'$' + walletBalance().toLocaleString() }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">Total Allocated</p>
                <p class="font-semibold">{{'$' + (walletBalance() * selectedStrategies().length).toLocaleString() }}</p>
              </div>
              <div>
                <p class="text-sm opacity-70">API Credentials</p>
                <p class="font-semibold">{{ apiKey() ? 'Configured' : 'Not set (paper mode)' }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Strategies summary -->
        <div class="card bg-base-200">
          <div class="card-body">
            <div class="flex justify-between items-center">
              <h2 class="card-title">Selected Strategies ({{ selectedStrategies().length }})</h2>
              <button class="btn btn-ghost btn-sm" (click)="step.set(2)">Change</button>
            </div>

            <div class="grid grid-cols-3 gap-2 mt-2 text-sm">
              <div>
                <p class="opacity-70">Conservative</p>
                <p class="font-semibold">{{ countByCategory('conservative') }}</p>
              </div>
              <div>
                <p class="opacity-70">Realistic</p>
                <p class="font-semibold">{{ countByCategory('realistic') }}</p>
              </div>
              <div>
                <p class="opacity-70">Dynamic</p>
                <p class="font-semibold">{{ countByCategory('dynamic') }}</p>
              </div>
            </div>

            <div class="divider my-2"></div>

            <div class="max-h-64 overflow-y-auto">
              @for (s of selectedStrategies(); track s.name) {
                <div class="flex justify-between items-center py-1 text-sm">
                  <span>{{ s.name }}</span>
                  <div class="flex gap-1">
                    <span class="badge badge-xs badge-outline">{{ s.parameters.min_confidence }}</span>
                    <span class="badge badge-xs badge-outline">{{ s.parameters.min_edge }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>

        @if (activateError()) {
          <div class="alert alert-error">
            <span>{{ activateError() }}</span>
          </div>
        }

        @if (activateSuccess()) {
          <div class="alert alert-success">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span>Setup complete! {{ selectedStrategies().length }} strategies activated. Redirecting to comparison...</span>
          </div>
        }

        @if (activating()) {
          <div class="flex items-center gap-3">
            <span class="loading loading-spinner loading-sm"></span>
            <span class="text-sm">Activating {{ activateProgress() }} of {{ selectedStrategies().length }} strategies...</span>
          </div>
        }

        <div class="flex justify-between">
          <button class="btn btn-ghost" (click)="step.set(2)" [disabled]="activating()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <button class="btn btn-success" (click)="activate()" [disabled]="activating() || activateSuccess()">
            @if (activating()) {
              <span class="loading loading-spinner loading-sm"></span>
            }
            Activate {{ selectedStrategies().length }} Strategies
          </button>
        </div>
      </div>
    }
  `,
})
export class SetupPage {
  private readonly pb = inject(PocketBaseService);
  private readonly router = inject(Router);

  readonly step = signal(1);
  readonly activating = signal(false);
  readonly activateError = signal('');
  readonly activateSuccess = signal(false);
  readonly activateProgress = signal(0);

  // Step 1: Wallet
  readonly walletMode = signal<'paper' | 'live'>('paper');
  readonly walletBalance = signal(10000);
  readonly apiKey = signal('');
  readonly apiSecret = signal('');
  readonly passphrase = signal('');
  readonly balancePresets = [1000, 5000, 10000, 50000, 100000];

  // Step 2: Strategy - multi-select
  readonly allStrategies = STRATEGY_PRESETS;
  readonly selectedCategory = signal<string>('all');
  private readonly selectedNames = signal<Set<string>>(new Set());

  readonly selectedStrategies = computed(() =>
    this.allStrategies.filter(s => this.selectedNames().has(s.name))
  );

  readonly categories = [
    { value: 'all', label: 'All' },
    { value: 'conservative', label: 'Conservative' },
    { value: 'realistic', label: 'Realistic' },
    { value: 'dynamic', label: 'Dynamic' },
  ];

  readonly filteredStrategies = computed(() => {
    const cat = this.selectedCategory();
    if (cat === 'all') return this.allStrategies;
    return this.allStrategies.filter(s => s.category === cat);
  });

  isSelected(name: string): boolean {
    return this.selectedNames().has(name);
  }

  toggleStrategy(strategy: StrategyPresetDef): void {
    const names = new Set(this.selectedNames());
    if (names.has(strategy.name)) {
      names.delete(strategy.name);
    } else {
      names.add(strategy.name);
    }
    this.selectedNames.set(names);
  }

  selectAllInCategory(): void {
    const names = new Set(this.selectedNames());
    for (const s of this.filteredStrategies()) {
      names.add(s.name);
    }
    this.selectedNames.set(names);
  }

  deselectAllInCategory(): void {
    const filtered = new Set(this.filteredStrategies().map(s => s.name));
    const names = new Set(this.selectedNames());
    for (const name of filtered) {
      names.delete(name);
    }
    this.selectedNames.set(names);
  }

  getCategoryCount(value: string): number {
    if (value === 'all') return this.allStrategies.length;
    return this.allStrategies.filter(s => s.category === value).length;
  }

  countByCategory(cat: string): number {
    return this.selectedStrategies().filter(s => s.category === cat).length;
  }

  getCategoryDescription(): string {
    switch (this.selectedCategory()) {
      case 'conservative':
        return 'Low risk, strict thresholds, high confidence requirements. Best for capital preservation and steady, reliable returns.';
      case 'realistic':
        return 'Balanced risk/reward with moderate thresholds. Good for everyday trading with reasonable trade frequency.';
      case 'dynamic':
        return 'Higher risk tolerance, aggressive thresholds, more frequent trades. For experienced traders seeking maximum returns.';
      default:
        return 'Select multiple strategies to run concurrently and compare their performance. Each gets its own independent paper balance.';
    }
  }

  getEnabledIndicators(strategy: StrategyPresetDef): string[] {
    const indicators = strategy.parameters.indicators;
    const enabled: string[] = [];
    if (indicators.zscore.enabled) enabled.push('Z-Score');
    if (indicators.entropy.enabled) enabled.push('Entropy');
    if (indicators.garch.enabled) enabled.push('GARCH');
    if (indicators.rsi.enabled) enabled.push('RSI');
    return enabled;
  }

  async activate(): Promise<void> {
    const strategies = this.selectedStrategies();
    if (strategies.length === 0) return;

    this.activating.set(true);
    this.activateError.set('');
    this.activateProgress.set(0);

    try {
      // Deactivate all existing active strategies
      const active = await this.pb.listRecords<RecordModel>(
        'strategy_configs', 1, 100, '-created', 'active = true',
      );
      for (const s of active) {
        await this.pb.updateRecord('strategy_configs', s.id, { active: false });
      }

      // Activate each selected strategy
      for (let i = 0; i < strategies.length; i++) {
        const strategy = strategies[i];
        this.activateProgress.set(i + 1);

        // Check if strategy exists
        const existing = await this.pb.listRecords<RecordModel>(
          'strategy_configs', 1, 1, '-created', `name = "${strategy.name}"`,
        );

        if (existing.length > 0) {
          await this.pb.updateRecord('strategy_configs', existing[0].id, {
            parameters: strategy.parameters,
            description: strategy.description,
            active: true,
            mode: this.walletMode(),
          });
        } else {
          await this.pb.createRecord('strategy_configs', {
            name: strategy.name,
            description: strategy.description,
            parameters: strategy.parameters,
            active: true,
            mode: this.walletMode(),
            version: 1,
          });
        }
      }

      // Update portfolio balance (total across all strategies)
      const portfolios = await this.pb.listRecords<RecordModel>(
        'portfolio', 1, 1, '-created',
      );
      const totalBalance = this.walletBalance() * strategies.length;
      if (portfolios.length > 0) {
        await this.pb.updateRecord('portfolio', portfolios[0].id, {
          balance: totalBalance,
          peak_balance: totalBalance,
          mode: this.walletMode(),
        });
      }

      this.activateSuccess.set(true);
      setTimeout(() => this.router.navigate(['/comparison']), 2000);
    } catch (e) {
      this.activateError.set('Failed to activate strategies. Please try again.');
      console.error('Activation failed:', e);
    } finally {
      this.activating.set(false);
    }
  }
}
