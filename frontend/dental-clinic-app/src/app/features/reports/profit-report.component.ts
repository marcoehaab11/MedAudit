import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ReportKpiCardComponent } from './components/report-kpi-card.component';
import { ReportPeriodSelectorComponent } from './components/report-period-selector.component';
import { BarChartItem, SvgBarChartComponent } from './components/svg-bar-chart.component';
import { ProfitReport, ReportFilter, ReportPeriod, ReportsApiService } from './reports-api.service';

@Component({
  selector: 'app-profit-report',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ReportPeriodSelectorComponent,
    ReportKpiCardComponent,
  ],
  template: `
    <div class="reports-page">
      <div class="header">
        <h2>Profit Analysis & Period Comparison / تحليل الأرباح ومقارنة الفترات</h2>
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

      <div *ngIf="loading" class="state-msg">Loading profit comparison data...</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && data" class="content">
        <div class="kpi-grid">
          <app-report-kpi-card
            title="Net Profit (Current) / صافي الربح الحالى"
            [value]="data.currentPeriod.netProfit"
            [isCurrency]="true"
            [currency]="data.currency"
            [growthPercentage]="data.profitGrowthPercentage"
            theme="theme-primary"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Revenue Growth / نمو الإيرادات"
            [value]="data.currentPeriod.revenue"
            [isCurrency]="true"
            [currency]="data.currency"
            [growthPercentage]="data.revenueGrowthPercentage"
            theme="theme-success"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Expense Growth / تغير المصروفات"
            [value]="data.currentPeriod.operatingExpenses"
            [isCurrency]="true"
            [currency]="data.currency"
            [growthPercentage]="data.expenseGrowthPercentage"
            theme="theme-danger"
          ></app-report-kpi-card>
        </div>

        <div class="comparison-table-card">
          <h4>Period Comparison Summary / مقارنة الفترات</h4>
          <table class="data-table">
            <thead>
              <tr>
                <th>Metric / المؤشر</th>
                <th>Current Period / الفترة الحالية</th>
                <th>Previous Period / الفترة السابقة</th>
                <th>Growth Rate / نسبة النمو</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Revenue / الإيرادات</td>
                <td>{{ data.currentPeriod.revenue | number: '1.0-2' }} {{ data.currency }}</td>
                <td>{{ data.previousPeriod.revenue | number: '1.0-2' }} {{ data.currency }}</td>
                <td [ngClass]="data.revenueGrowthPercentage >= 0 ? 'pos' : 'neg'">
                  {{ data.revenueGrowthPercentage }}%
                </td>
              </tr>
              <tr>
                <td>Doctor Compensation / مستحقات الأطباء</td>
                <td>
                  {{ data.currentPeriod.doctorCompensation | number: '1.0-2' }} {{ data.currency }}
                </td>
                <td>
                  {{ data.previousPeriod.doctorCompensation | number: '1.0-2' }} {{ data.currency }}
                </td>
                <td>-</td>
              </tr>
              <tr>
                <td>Operating Expenses / المصروفات التشغيلية</td>
                <td>
                  {{ data.currentPeriod.operatingExpenses | number: '1.0-2' }} {{ data.currency }}
                </td>
                <td>
                  {{ data.previousPeriod.operatingExpenses | number: '1.0-2' }} {{ data.currency }}
                </td>
                <td [ngClass]="data.expenseGrowthPercentage <= 0 ? 'pos' : 'neg'">
                  {{ data.expenseGrowthPercentage }}%
                </td>
              </tr>
              <tr class="highlight">
                <td>Net Profit / صافي الربح</td>
                <td>{{ data.currentPeriod.netProfit | number: '1.0-2' }} {{ data.currency }}</td>
                <td>{{ data.previousPeriod.netProfit | number: '1.0-2' }} {{ data.currency }}</td>
                <td [ngClass]="data.profitGrowthPercentage >= 0 ? 'pos' : 'neg'">
                  {{ data.profitGrowthPercentage }}%
                </td>
              </tr>
            </tbody>
          </table>
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
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }
      .comparison-table-card {
        background: #ffffff;
        border-radius: 8px;
        padding: 20px;
        border: 1px solid #e5e7eb;
      }
      .comparison-table-card h4 {
        margin: 0 0 16px 0;
        font-size: 1rem;
        color: #111827;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      .data-table th,
      .data-table td {
        padding: 12px 16px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 0.875rem;
      }
      .data-table th {
        background: #f9fafb;
        font-weight: 600;
        color: #374151;
      }
      .data-table tr.highlight {
        font-weight: 700;
        background: #f0f9ff;
      }
      .pos {
        color: #059669;
        font-weight: 600;
      }
      .neg {
        color: #dc2626;
        font-weight: 600;
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
export class ProfitReportComponent implements OnInit {
  private api = inject(ReportsApiService);

  filter: ReportFilter = { period: ReportPeriod.ThisMonth };
  data?: ProfitReport;
  loading = false;
  error?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.getProfit(this.filter).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.title || 'Failed to load profit report.';
        this.loading = false;
      },
    });
  }

  onFilterChange(f: ReportFilter): void {
    this.filter = f;
    this.loadData();
  }

  downloadCsv(): void {
    this.api.downloadCsv('profit', this.filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'profit-report.csv';
      a.click();
    });
  }
}
