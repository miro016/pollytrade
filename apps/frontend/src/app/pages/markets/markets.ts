import { Component, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MarketService, Market } from '../../services/market.service';
import { StatusBadge } from '../../components/status-badge/status-badge';

@Component({
  selector: 'app-markets',
  imports: [CurrencyPipe, DecimalPipe, StatusBadge],
  template: `
    <h1 class="text-2xl font-bold mb-6">Markets</h1>

    <!-- Search -->
    <div class="form-control mb-4">
      <input
        type="text"
        placeholder="Search markets..."
        class="input input-bordered w-full max-w-md"
        (input)="onSearch($event)" />
    </div>

    <!-- Markets table -->
    <div class="overflow-x-auto">
      <table class="table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Yes Price</th>
            <th>No Price</th>
            <th>Volume</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (market of filteredMarkets(); track market.id) {
            <tr class="hover">
              <td class="max-w-md truncate">{{ market.question }}</td>
              <td class="font-mono">{{ market.current_prices?.yes | number:'1.2-2' }}</td>
              <td class="font-mono">{{ market.current_prices?.no | number:'1.2-2' }}</td>
              <td>{{ market.volume | currency:'USD':'symbol':'1.0-0' }}</td>
              <td>
                <app-status-badge [status]="market.status" [label]="market.status" />
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" class="text-center opacity-50">
                {{ marketService.loading() ? 'Loading...' : 'No markets found' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class MarketsPage {
  readonly marketService = inject(MarketService);
  readonly searchQuery = signal('');

  readonly filteredMarkets = computed(() => {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.marketService.markets();
    return this.marketService.markets().filter(
      m => m.question.toLowerCase().includes(query)
    );
  });

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }
}
