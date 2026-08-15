import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterOutlet, RouterLinkActive } from '@angular/router';
import { ReportKpiCardComponent } from './components/report-kpi-card.component';
import { ReportPeriodSelectorComponent } from './components/report-period-selector.component';
import { BarChartItem, SvgBarChartComponent } from './components/svg-bar-chart.component';
import { LineChartItem, SvgLineChartComponent } from './components/svg-line-chart.component';
import {
  DashboardReport,
  ReportFilter,
  ReportPeriod,
  ReportsApiService,
} from './reports-api.service';

@Component({
  selector: 'app-reports-dashboard',
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
        <h2>Reports & Analytics / التقارير والتحليلات</h2>
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

      <div *ngIf="loading" class="state-msg">
        Loading dashboard data... / جاري تحميل البيانات...
      </div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && data" class="dashboard-content">
        <div class="kpi-grid">
          <app-report-kpi-card
            title="New Patients / المرضى الجدد"
            [value]="data.newPatients"
            theme="theme-primary"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Appointments / المواعيد"
            [value]="data.appointmentsCount"
            [subText]="data.completedAppointments + ' completed'"
            theme="theme-primary"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Treatments / العلاجات"
            [value]="data.completedTreatments"
            theme="theme-success"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Prescriptions / الروشتات"
            [value]="data.prescriptionsIssued"
            theme="theme-warning"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Revenue / الإيرادات"
            [value]="data.revenue"
            [isCurrency]="true"
            [currency]="data.currency"
            theme="theme-success"
          ></app-report-kpi-card>

          <app-report-kpi-card
            title="Payments Received / المقبوضات"
            [value]="data.paymentsReceived"
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
            title="Doctor Cost / مستحقات الأطباء"
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

        <div class="charts-grid">
          <app-svg-bar-chart
            title="Appointments Overview / ملخص المواعيد"
            [items]="appointmentBarItems"
          ></app-svg-bar-chart>

          <app-svg-bar-chart
            title="Financial Summary / الملخص المالي"
            [items]="financialBarItems"
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
        margin: 0 0 16px 0;
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
      .charts-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 24px;
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
export class ReportsDashboardComponent implements OnInit {
  private api = inject(ReportsApiService);

  filter: ReportFilter = { period: ReportPeriod.ThisMonth };
  data?: DashboardReport;
  loading = false;
  error?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.error = undefined;

    this.api.getDashboard(this.filter).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.title || 'Failed to load dashboard report.';
        this.loading = false;
      },
    });
  }

  onFilterChange(f: ReportFilter): void {
    this.filter = f;
    this.loadData();
  }

  downloadCsv(): void {
    this.api.downloadCsv('dashboard', this.filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'dashboard-report.csv';
      a.click();
    });
  }

  get appointmentBarItems(): BarChartItem[] {
    if (!this.data) return [];
    return [
      { label: 'Completed / المكتملة', value: this.data.completedAppointments, color: '#10b981' },
      { label: 'Cancelled / الملغاة', value: this.data.cancelledAppointments, color: '#ef4444' },
      { label: 'No-Show / لم يحضر', value: this.data.noShowAppointments, color: '#f59e0b' },
    ];
  }

  get financialBarItems(): BarChartItem[] {
    if (!this.data) return [];
    return [
      { label: 'Revenue / الإيرادات', value: this.data.revenue, color: '#10b981' },
      { label: 'Payments / المقبوضات', value: this.data.paymentsReceived, color: '#06b6d4' },
      { label: 'Expenses / المصروفات', value: this.data.expenses, color: '#ef4444' },
      { label: 'Doctor Cost / الأطباء', value: this.data.doctorCompensation, color: '#f59e0b' },
      { label: 'Net Profit / الأرباح', value: this.data.netProfit, color: '#2563eb' },
    ];
  }
}
