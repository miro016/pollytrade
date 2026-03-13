import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

export interface BotStatus extends RecordModel {
  running: boolean;
  last_heartbeat: string;
  current_strategy: string;
  risk_state: 'normal' | 'caution' | 'halted';
  circuit_breaker_state: 'closed' | 'open' | 'half_open';
  active_positions: number;
  markets_monitored: number;
  last_trade_at: string;
  last_error: string;
  uptime_seconds: number;
}

@Injectable({ providedIn: 'root' })
export class BotStatusService implements OnDestroy {
  private readonly pb = inject(PocketBaseService);
  private unsubscribe?: () => void;

  readonly status = signal<BotStatus | null>(null);
  readonly loading = signal(false);

  readonly isRunning = computed(() => this.status()?.running ?? false);
  readonly riskState = computed(() => this.status()?.risk_state ?? 'normal');
  readonly strategy = computed(() => this.status()?.current_strategy ?? 'None');

  constructor() {
    this.loadStatus();
    this.subscribeToUpdates();
  }

  async loadStatus(): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.pb.listRecords<BotStatus>('bot_status', 1, 1, '-created');
      if (items.length > 0) {
        this.status.set(items[0]);
      }
    } catch (e) {
      console.error('Failed to load bot status:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    this.unsubscribe = this.pb.subscribe('bot_status', (data) => {
      if (data.action === 'update' || data.action === 'create') {
        this.status.set(data.record as BotStatus);
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
