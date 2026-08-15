import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface LineChartItem {
  label: string;
  value: number;
}

@Component({
  selector: 'app-svg-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="line-chart-card" *ngIf="items && items.length; else emptyState">
      <div class="chart-header" *ngIf="title">
        <h4 class="chart-title">{{ title }}</h4>
      </div>
      <div class="chart-svg-container">
        <svg viewBox="0 0 500 200" preserveAspectRatio="none" class="chart-svg">
          <polyline fill="none" stroke="#2563eb" stroke-width="3" [attr.points]="pointsString" />
          <circle
            *ngFor="let pt of svgPoints"
            [attr.cx]="pt.x"
            [attr.cy]="pt.y"
            r="4"
            fill="#2563eb"
          />
        </svg>
      </div>
      <div class="x-axis">
        <span *ngFor="let item of items">{{ item.label }}</span>
      </div>
    </div>
    <ng-template #emptyState>
      <div class="empty-chart">No trend data available</div>
    </ng-template>
  `,
  styles: [
    `
      .line-chart-card {
        background: #ffffff;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #e5e7eb;
      }
      .chart-title {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 12px;
        color: #1f2937;
      }
      .chart-svg-container {
        height: 160px;
        width: 100%;
      }
      .chart-svg {
        width: 100%;
        height: 100%;
      }
      .x-axis {
        display: flex;
        justify-content: space-between;
        margin-top: 8px;
        font-size: 0.75rem;
        color: #6b7280;
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
export class SvgLineChartComponent {
  @Input() title = '';
  @Input() items: LineChartItem[] = [];

  get svgPoints(): { x: number; y: number }[] {
    if (!this.items || this.items.length === 0) return [];
    const max = Math.max(...this.items.map((i) => i.value), 1);
    const stepX = 500 / Math.max(1, this.items.length - 1);

    return this.items.map((item, index) => {
      const x = index * stepX;
      const y = 180 - (item.value / max) * 150;
      return { x, y };
    });
  }

  get pointsString(): string {
    return this.svgPoints.map((p) => `${p.x},${p.y}`).join(' ');
  }
}
