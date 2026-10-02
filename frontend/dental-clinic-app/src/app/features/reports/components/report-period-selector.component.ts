import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReportFilter, ReportPeriod } from '../reports-api.service';

@Component({
  selector: 'app-report-period-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Period / الفترة</label>
        <select [(ngModel)]="currentFilter.period" (change)="onPeriodChange()">
          <option [ngValue]="ReportPeriod.Today">Today / اليوم</option>
          <option [ngValue]="ReportPeriod.ThisWeek">This Week / هذا الأسبوع</option>
          <option [ngValue]="ReportPeriod.ThisMonth">This Month / هذا الشهر</option>
          <option [ngValue]="ReportPeriod.ThisYear">This Year / هذه السنة</option>
          <option [ngValue]="ReportPeriod.Custom">Custom Range / فترة مخصصة</option>
        </select>
      </div>

      <div class="filter-group" *ngIf="currentFilter.period === ReportPeriod.Custom">
        <label>From / من</label>
        <input type="date" [(ngModel)]="currentFilter.from" (change)="emitChange()" />
      </div>

      <div class="filter-group" *ngIf="currentFilter.period === ReportPeriod.Custom">
        <label>To / إلى</label>
        <input type="date" [(ngModel)]="currentFilter.to" (change)="emitChange()" />
      </div>

      <div class="actions">
        <button class="btn btn-primary" (click)="emitChange()">Apply / تطبيق</button>
        <button class="btn btn-secondary" (click)="exportCsv.emit()" *ngIf="showExport">
          Export CSV / تصدير CSV
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 12px;
        background: var(--surface-card, #ffffff);
        padding: 16px 20px;
        border-radius: var(--radius-lg, 16px);
        border: 1px solid var(--border, #d4e1f0);
        margin-bottom: 20px;
        box-shadow: var(--shadow-sm, 0 1px 3px rgba(12, 40, 117, 0.06));
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .filter-group label {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--muted, #5e719b);
      }
      select,
      input[type='date'] {
        height: 42px;
        padding: 0 12px;
        border-radius: var(--radius-md, 10px);
        border: 1.5px solid var(--border, #d4e1f0);
        font-size: 0.875rem;
        font-weight: 500;
        background: #ffffff;
        color: var(--ink, #0f1c3f);
        transition: all 0.2s ease;
      }
      select:hover,
      input[type='date']:hover {
        border-color: #93c5fd;
      }
      select:focus,
      input[type='date']:focus {
        outline: none;
        border-color: var(--brand-cyan, #00b4d8);
        box-shadow: 0 0 0 3.5px rgba(0, 180, 216, 0.18);
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-left: auto;
      }
      [dir='rtl'] .actions {
        margin-left: 0;
        margin-right: auto;
      }
      .btn {
        height: 42px;
        padding: 0 18px;
        border-radius: var(--radius-md, 10px);
        font-size: 0.875rem;
        font-weight: 700;
        cursor: pointer;
        border: 1.5px solid transparent;
        transition: all 0.2s ease;
      }
      .btn-primary {
        background: var(--brand-gradient, linear-gradient(135deg, #0c2875 0%, #0088cc 50%, #00b4d8 100%));
        color: #ffffff;
        border-color: transparent;
        box-shadow: 0 2px 8px rgba(12, 40, 117, 0.25);
      }
      .btn-primary:hover {
        background: var(--brand-gradient-hover, linear-gradient(135deg, #091e57 0%, #0077b6 50%, #0096c7 100%));
        box-shadow: 0 4px 14px rgba(0, 180, 216, 0.35);
        transform: translateY(-1px);
      }
      .btn-secondary {
        background: #ffffff;
        border-color: var(--border, #d4e1f0);
        color: var(--ink-secondary, #2c3e6b);
      }
      .btn-secondary:hover {
        border-color: var(--brand, #0088cc);
        color: var(--brand, #0088cc);
        transform: translateY(-1px);
      }
    `,
  ],
})
export class ReportPeriodSelectorComponent {
  ReportPeriod = ReportPeriod;

  @Input() currentFilter: ReportFilter = { period: ReportPeriod.ThisMonth };
  @Input() showExport = true;

  @Output() filterChange = new EventEmitter<ReportFilter>();
  @Output() exportCsv = new EventEmitter<void>();

  onPeriodChange(): void {
    if (this.currentFilter.period !== ReportPeriod.Custom) {
      this.currentFilter.from = undefined;
      this.currentFilter.to = undefined;
      this.emitChange();
    }
  }

  emitChange(): void {
    this.filterChange.emit({ ...this.currentFilter });
  }
}

