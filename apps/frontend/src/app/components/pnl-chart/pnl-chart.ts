import { Component, input, computed } from '@angular/core';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';

@Component({
  selector: 'app-pnl-chart',
  imports: [BaseChartDirective],
  template: `
    <canvas baseChart
      [data]="chartData()"
      [options]="chartOptions"
      type="bar">
    </canvas>
  `,
})
export class PnlChart {
  readonly labels = input<string[]>([]);
  readonly values = input<number[]>([]);

  readonly chartData = computed((): ChartConfiguration<'bar'>['data'] => ({
    labels: this.labels(),
    datasets: [{
      data: this.values(),
      backgroundColor: this.values().map(v => v >= 0 ? '#36d399' : '#f87272'),
      borderRadius: 4,
    }],
  }));

  readonly chartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: {
      legend: { display: false },
    },
    scales: {
      y: { beginAtZero: true },
    },
  };
}
