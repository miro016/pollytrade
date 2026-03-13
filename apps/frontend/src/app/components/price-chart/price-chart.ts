import {
  Component,
  ElementRef,
  input,
  effect,
  viewChild,
  OnDestroy,
} from '@angular/core';
import { createChart, IChartApi, ISeriesApi, LineSeries } from 'lightweight-charts';

export interface PricePoint {
  time: string;
  value: number;
}

@Component({
  selector: 'app-price-chart',
  template: `<div #chartContainer class="w-full h-64"></div>`,
})
export class PriceChart implements OnDestroy {
  readonly data = input<PricePoint[]>([]);
  readonly chartContainer = viewChild.required<ElementRef>('chartContainer');

  private chart?: IChartApi;
  private series?: ISeriesApi<'Line'>;

  constructor() {
    effect(() => {
      const container = this.chartContainer().nativeElement;
      if (!this.chart) {
        this.chart = createChart(container, {
          width: container.clientWidth,
          height: 256,
          layout: {
            background: { color: 'transparent' },
            textColor: '#a6adbb',
          },
          grid: {
            vertLines: { color: 'rgba(166, 173, 187, 0.1)' },
            horzLines: { color: 'rgba(166, 173, 187, 0.1)' },
          },
        });
        this.series = this.chart.addSeries(LineSeries, {
          color: '#36d399',
          lineWidth: 2,
        });
      }
      const points = this.data();
      if (points.length > 0 && this.series) {
        this.series.setData(points as any);
        this.chart!.timeScale().fitContent();
      }
    });
  }

  ngOnDestroy(): void {
    this.chart?.remove();
  }
}
