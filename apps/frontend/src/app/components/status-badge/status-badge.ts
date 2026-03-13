import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `
    <div class="badge" [class]="badgeClass()">
      {{ label() }}
    </div>
  `,
})
export class StatusBadge {
  readonly status = input.required<string>();
  readonly label = input.required<string>();

  readonly badgeClass = computed(() => {
    switch (this.status()) {
      case 'running':
      case 'normal':
      case 'closed':
      case 'active':
        return 'badge-success';
      case 'caution':
      case 'half_open':
        return 'badge-warning';
      case 'halted':
      case 'open':
      case 'stopped':
        return 'badge-error';
      default:
        return 'badge-ghost';
    }
  });
}
