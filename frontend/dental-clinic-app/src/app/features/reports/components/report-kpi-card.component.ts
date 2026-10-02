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
        background: var(--surface-card, #ffffff);
        border-radius: var(--radius-lg, 12px);
        padding: 16px 20px;
        border: 1px solid var(--border, #d2e4df);
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: var(--shadow-sm, 0 1px 3px rgba(14, 72, 62, 0.06));
        transition: transform 0.15s ease, box-shadow 0.15s ease;
      }
      .kpi-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow, 0 4px 16px rgba(14, 72, 62, 0.07));
      }
      .kpi-label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted, #6b8880);
      }
      .kpi-value {
        font-size: 1.65rem;
        font-weight: 800;
        letter-spacing: -0.03em;
        color: var(--ink, #15312d);
      }
      .kpi-sub {
        font-size: 0.8rem;
        color: var(--muted, #6b8880);
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
        border-inline-start: 4px solid var(--brand, #087b68);
      }
      .theme-success {
        border-inline-start: 4px solid #10b981;
      }
      .theme-warning {
        border-inline-start: 4px solid #f59e0b;
      }
      .theme-danger {
        border-inline-start: 4px solid #ef4444;
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

