import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ReportKpiCardComponent } from './components/report-kpi-card.component';
import { ReportPeriodSelectorComponent } from './components/report-period-selector.component';
import { BarChartItem, SvgBarChartComponent } from './components/svg-bar-chart.component';
import {
  FinancialReport,
  ReportFilter,
  ReportPeriod,
  ReportsApiService,
} from './reports-api.service';

@Component({
  selector: 'app-financial-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ReportPeriodSelectorComponent,
    ReportKpiCardComponent,
    SvgBarChartComponent,
  ],
  template: `
    <div class="reports-page">
      <div class="header">
        <h2>Financial Report / التقرير المالي</h2>
      </div>

      <nav class="sub-nav">
        <a
          routerLink="/reports"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: true }"
          >Overview / النظرة العامة</a
        >
        <a routerLink="/reports/financial" routerLinkActive="active">Financial / المالية</a>
        <a routerLink="/reports/revenue" routerLinkActive="active">Revenue / الإيرادات</a>
        <a routerLink="/reports/expenses" routerLinkActive="active">Expenses / المصروفات</a>
        <a routerLink="/reports/profit" routerLinkActive="active">Profit / الأرباح</a>
        <a routerLink="/reports/patients" routerLinkActive="active">Patients / المرضى</a>
        <a routerLink="/reports/appointments" routerLinkActive="active">Appointments / المواعيد</a>
        <a routerLink="/reports/doctors" routerLinkActive="active">Doctors / الأطباء</a>
        <a routerLink="/reports/treatments" routerLinkActive="active">Treatments / العلاجات</a>
        <a routerLink="/reports/prescriptions" routerLinkActive="active"
          >Prescriptions / الروشتات</a
        >
        <a routerLink="/reports/crm" routerLinkActive="active">CRM / خدمة العملاء</a>
      </nav>

      <app-report-period-selector
        [currentFilter]="filter"
        (filterChange)="onFilterChange($event)"
        (exportCsv)="downloadCsv()"
      ></app-report-period-selector>

      <div *ngIf="loading" class="state-msg">Loading financial data...</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && data" class="content">
        <div class="kpi-grid">
          <app-report-kpi-card
            title="Revenue / الإيرادات"
            [value]="data.revenue"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-success"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Payments / المقبوضات"
            [value]="data.payments"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-success"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Outstanding / المستحقات"
            [value]="data.outstanding"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-warning"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Expenses / المصروفات"
            [value]="data.expenses"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-danger"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Doctor Costs / مستحقات الأطباء"
            [value]="data.doctorCompensation"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-warning"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Net Profit / صافي الربح"
            [value]="data.netProfit"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-primary"
          ></app-report-kpi-card>
        </div>

        <div class="chart-section">
          <app-svg-bar-chart
            title="Financial Overview Breakdown"
            [items]="barItems"
          ></app-svg-bar-chart>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .reports-page {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
      }
      .header h2 {
        margin-bottom: 16px;
        color: #111827;
      }
      .sub-nav {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 12px;
        margin-bottom: 16px;
        border-bottom: 1px solid #e5e7eb;
      }
      .sub-nav a {
        text-decoration: none;
        color: #4b5563;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 0.875rem;
        white-space: nowrap;
        background: #f9fafb;
      }
      .sub-nav a.active {
        background: #2563eb;
        color: #ffffff;
        font-weight: 500;
      }
      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .state-msg {
        padding: 24px;
        text-align: center;
        background: #ffffff;
        border-radius: 8px;
        color: #6b7280;
      }
      .state-msg.error {
        color: #dc2626;
      }
    `,
  ],
})
export class FinancialReportComponent implements OnInit {
  private api = inject(ReportsApiService);

  filter: ReportFilter = { period: ReportPeriod.ThisMonth };
  data?: FinancialReport;
  loading = false;
  error?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.getFinancial(this.filter).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.title || 'Failed to load financial report.';
        this.loading = false;
      },
    });
  }

  onFilterChange(f: ReportFilter): void {
    this.filter = f;
    this.loadData();
  }

  downloadCsv(): void {
    this.api.downloadCsv('financial', this.filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'financial-report.csv';
      a.click();
    });
  }

  get barItems(): BarChartItem[] {
    if (!this.data) return [];
    return [
      { label: 'Revenue', value: this.data.revenue, color: '#10b981' },
      { label: 'Payments', value: this.data.payments, color: '#06b6d4' },
      { label: 'Outstanding', value: this.data.outstanding, color: '#f59e0b' },
      { label: 'Expenses', value: this.data.expenses, color: '#ef4444' },
      { label: 'Doctor Cost', value: this.data.doctorCompensation, color: '#8b5cf6' },
      { label: 'Net Profit', value: this.data.netProfit, color: '#2563eb' },
    ];
  }
}
