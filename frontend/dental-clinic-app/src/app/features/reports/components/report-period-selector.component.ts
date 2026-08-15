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
        <button class="btn btn-outline" (click)="emitChange()">Apply / تطبيق</button>
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
        gap: 16px;
        background: #ffffff;
        padding: 16px;
        border-radius: 8px;
        border: 1px solid #e5e7eb;
        margin-bottom: 24px;
      }
      .filter-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .filter-group label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #4b5563;
      }
      select,
      input[type='date'] {
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid #d1d5db;
        font-size: 0.875rem;
      }
      .actions {
        display: flex;
        gap: 8px;
        margin-left: auto;
      }
      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        border: none;
      }
      .btn-outline {
        border: 1px solid #2563eb;
        color: #2563eb;
        background: transparent;
      }
      .btn-secondary {
        background: #f3f4f6;
        color: #374151;
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

  onPeriodChange() {
    if (this.currentFilter.period !== ReportPeriod.Custom) {
      this.currentFilter.from = undefined;
      this.currentFilter.to = undefined;
    }
    this.emitChange();
  }

  emitChange() {
    this.filterChange.emit({ ...this.currentFilter });
  }
}
