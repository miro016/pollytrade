import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PocketBaseService } from './pocketbase.service';

export interface Signal extends RecordModel {
  market_id: string;
  signal_type: 'zscore' | 'entropy' | 'garch' | 'nash' | 'ml' | 'technical' | 'composite';
  direction: 'buy' | 'sell' | 'hold';
  value: number;
  confidence: number;
  metadata: Record<string, unknown>;
}

@Injectable({ providedIn: 'root' })
export class SignalService implements OnDestroy {
  private readonly pb = inject(PocketBaseService);
  private unsubscribe?: () => void;

  readonly signals = signal<Signal[]>([]);
  readonly loading = signal(false);

  readonly activeSignals = computed(() =>
    this.signals().filter(s => s.direction !== 'hold' && s.confidence > 0)
  );

  readonly compositeSignals = computed(() =>
    this.signals().filter(s => s.signal_type === 'composite')
  );

  readonly buySignals = computed(() =>
    this.activeSignals().filter(s => s.direction === 'buy')
  );

  readonly sellSignals = computed(() =>
    this.activeSignals().filter(s => s.direction === 'sell')
  );

  constructor() {
    this.loadSignals();
    this.subscribeToUpdates();
  }

  async loadSignals(perPage = 100): Promise<void> {
    this.loading.set(true);
    try {
      const items = await this.pb.listRecords<Signal>('signals', 1, perPage, '-created');
      this.signals.set(items);
    } catch (e) {
      console.error('Failed to load signals:', e);
    } finally {
      this.loading.set(false);
    }
  }

  private subscribeToUpdates(): void {
    this.unsubscribe = this.pb.subscribe('signals', (data) => {
      if (data.action === 'create') {
        this.signals.update(current => {
          const updated = [data.record as Signal, ...current];
          return updated.slice(0, 200); // Keep last 200
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
