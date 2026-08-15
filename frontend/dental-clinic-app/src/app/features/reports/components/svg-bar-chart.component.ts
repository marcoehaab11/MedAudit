import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: 'app-svg-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-container" *ngIf="items && items.length; else emptyState">
      <div class="chart-title" *ngIf="title">{{ title }}</div>
      <div class="bars-wrapper">
        <div class="bar-row" *ngFor="let item of items; let i = index">
          <div class="bar-label" [title]="item.label">{{ item.label }}</div>
          <div class="bar-track">
            <div
              class="bar-fill"
              [style.width.%]="getPercentage(item.value)"
              [style.background-color]="item.color || getDefaultColor(i)"
            ></div>
          </div>
          <div class="bar-value">{{ item.value | number }}</div>
        </div>
      </div>
    </div>
    <ng-template #emptyState>
      <div class="empty-chart">No data available</div>
    </ng-template>
  `,
  styles: [
    `
      .chart-container {
        background: #ffffff;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #e5e7eb;
      }
      .chart-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 16px;
        color: #1f2937;
      }
      .bars-wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bar-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .bar-label {
        width: 130px;
        font-size: 0.875rem;
        color: #4b5563;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-track {
        flex: 1;
        height: 20px;
        background: #f3f4f6;
        border-radius: 4px;
        overflow: hidden;
      }
      .bar-fill {
        height: 100%;
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      .bar-value {
        width: 70px;
        text-align: right;
        font-size: 0.875rem;
        font-weight: 600;
        color: #111827;
      }
      .empty-chart {
        padding: 24px;
        text-align: center;
        color: #9ca3af;
        font-style: italic;
      }
    `,
  ],
})
export class SvgBarChartComponent {
  @Input() title = '';
  @Input() items: BarChartItem[] = [];

  private colors = [
    '#2563eb',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#ec4899',
    '#64748b',
  ];

  get maxValue(): number {
    if (!this.items || this.items.length === 0) return 1;
    const max = Math.max(...this.items.map((i) => i.value));
    return max > 0 ? max : 1;
  }

  getPercentage(val: number): number {
    return Math.min(100, Math.max(2, (val / this.maxValue) * 100));
  }

  getDefaultColor(index: number): string {
    return this.colors[index % this.colors.length];
  }
}
