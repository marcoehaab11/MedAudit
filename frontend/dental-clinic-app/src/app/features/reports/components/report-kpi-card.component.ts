import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-report-kpi-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="kpi-card" [ngClass]="theme">
      <div class="kpi-label">{{ title }}</div>
      <div class="kpi-value">
        <span *ngIf="isCurrency">{{ currency }}</span>
        {{ value | number: '1.0-2' }}
      </div>
      <div class="kpi-sub" *ngIf="subText || growthPercentage !== undefined">
        <span *ngIf="growthPercentage !== undefined" [ngClass]="growthClass">
          {{ growthPercentage >= 0 ? '↑ +' : '↓ ' }}{{ growthPercentage }}%
        </span>
        <span *ngIf="subText">{{ subText }}</span>
      </div>
    </div>
  `,
  styles: [
    `
      .kpi-card {
        background: #ffffff;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #e5e7eb;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .kpi-label {
        font-size: 0.8125rem;
        font-weight: 500;
        color: #6b7280;
      }
      .kpi-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #111827;
      }
      .kpi-sub {
        font-size: 0.75rem;
        color: #9ca3af;
        display: flex;
        gap: 6px;
        align-items: center;
      }
      .positive {
        color: #059669;
        font-weight: 600;
      }
      .negative {
        color: #dc2626;
        font-weight: 600;
      }
      .theme-primary {
        border-left: 4px solid #2563eb;
      }
      .theme-success {
        border-left: 4px solid #10b981;
      }
      .theme-warning {
        border-left: 4px solid #f59e0b;
      }
      .theme-danger {
        border-left: 4px solid #ef4444;
      }
    `,
  ],
})
export class ReportKpiCardComponent {
  @Input() title = '';
  @Input() value: number | string = 0;
  @Input() isCurrency = false;
  @Input() currency = 'EGP';
  @Input() subText?: string;
  @Input() growthPercentage?: number;
  @Input() theme: 'theme-primary' | 'theme-success' | 'theme-warning' | 'theme-danger' | '' = '';

  get growthClass(): string {
    if (this.growthPercentage === undefined) return '';
    return this.growthPercentage >= 0 ? 'positive' : 'negative';
  }
}
