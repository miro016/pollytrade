import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PocketBaseService } from '../../services/pocketbase.service';
import { BotStatusService } from '../../services/bot-status.service';
import { PortfolioService } from '../../services/portfolio.service';
import { StatusBadge } from '../../components/status-badge/status-badge';

@Component({
  selector: 'app-settings',
  imports: [FormsModule, StatusBadge],
  template: `
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Engine Control -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Engine Control</h2>
          <div class="flex items-center gap-3 mb-4">
            <span>Status:</span>
            <app-status-badge
              [status]="botStatus.isRunning() ? 'running' : 'stopped'"
              [label]="botStatus.isRunning() ? 'Running' : 'Stopped'" />
          </div>
          <div class="flex gap-2">
            <button
              class="btn btn-success"
              [disabled]="botStatus.isRunning()"
              (click)="startEngine()">
              Start Engine
            </button>
            <button
              class="btn btn-error"
              [disabled]="!botStatus.isRunning()"
              (click)="stopEngine()">
              Stop Engine
            </button>
          </div>
          @if (engineMessage()) {
            <div class="alert mt-3">
              <span>{{ engineMessage() }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Trading Mode -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Trading Mode</h2>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text text-lg">Paper Trading</span>
              <input
                type="radio"
                name="mode"
                class="radio radio-primary"
                [checked]="portfolio.mode() === 'paper'"
                (change)="setMode('paper')" />
            </label>
          </div>
          <div class="form-control">
            <label class="label cursor-pointer">
              <span class="label-text text-lg">Live Trading</span>
              <input
                type="radio"
                name="mode"
                class="radio radio-error"
                [checked]="portfolio.mode() === 'live'"
                (change)="setMode('live')" />
            </label>
          </div>
          <div class="alert alert-warning mt-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>Live trading is not yet enabled. Paper mode only.</span>
          </div>
        </div>
      </div>

      <!-- Connection Status -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">Connection Status</h2>
          <div class="flex items-center gap-3 mb-2">
            <span>PocketBase:</span>
            <app-status-badge
              [status]="pb.isConnected() ? 'running' : 'stopped'"
              [label]="pb.isConnected() ? 'Connected' : 'Disconnected'" />
          </div>
          <div class="flex items-center gap-3 mb-2">
            <span>Risk State:</span>
            <app-status-badge
              [status]="botStatus.riskState()"
              [label]="botStatus.riskState()" />
          </div>
          <div class="flex items-center gap-3">
            <span>Circuit Breaker:</span>
            <app-status-badge
              [status]="botStatus.status()?.circuit_breaker_state ?? 'closed'"
              [label]="botStatus.status()?.circuit_breaker_state ?? 'closed'" />
          </div>
        </div>
      </div>

      <!-- About -->
      <div class="card bg-base-200">
        <div class="card-body">
          <h2 class="card-title">About</h2>
          <p>PollyTrade v0.1.0</p>
          <p class="text-sm opacity-70">Polymarket prediction market trading bot with statistical analysis, risk management, and paper trading.</p>
        </div>
      </div>
    </div>
  `,
})
export class SettingsPage {
  readonly pb = inject(PocketBaseService);
  readonly botStatus = inject(BotStatusService);
  readonly portfolio = inject(PortfolioService);

  readonly engineMessage = signal('');

  async startEngine(): Promise<void> {
    try {
      const resp = await fetch('/engine/control/start', { method: 'POST' });
      const data = await resp.json();
      this.engineMessage.set(data.message);
    } catch {
      this.engineMessage.set('Failed to start engine');
    }
  }

  async stopEngine(): Promise<void> {
    try {
      const resp = await fetch('/engine/control/stop', { method: 'POST' });
      const data = await resp.json();
      this.engineMessage.set(data.message);
    } catch {
      this.engineMessage.set('Failed to stop engine');
    }
  }

  setMode(mode: string): void {
    if (mode === 'live') {
      this.engineMessage.set('Live trading is not yet enabled');
      return;
    }
    this.engineMessage.set(`Mode set to ${mode}`);
  }
}
