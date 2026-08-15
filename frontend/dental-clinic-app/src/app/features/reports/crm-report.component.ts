import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ReportKpiCardComponent } from './components/report-kpi-card.component';
import { ReportPeriodSelectorComponent } from './components/report-period-selector.component';
import { BarChartItem, SvgBarChartComponent } from './components/svg-bar-chart.component';
import { CrmReport, ReportFilter, ReportPeriod, ReportsApiService } from './reports-api.service';

@Component({
  selector: 'app-crm-report',
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
        <h2>CRM & Follow-ups Report / تقرير المتابعة وخدمة العملاء</h2>
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

      <div *ngIf="loading" class="state-msg">Loading CRM report...</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && data" class="content">
        <div class="kpi-grid">
          <app-report-kpi-card
            title="Follow-ups Created / متابعات أنشئت"
            [value]="data.followUpsCreated"
            theme="theme-primary"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Completed / مكتملة"
            [value]="data.followUpsCompleted"
            theme="theme-success"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Pending / قيد المتابعة"
            [value]="data.pendingFollowUps"
            theme="theme-warning"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Overdue / متأخرة"
            [value]="data.overdueFollowUps"
            theme="theme-danger"
          ></app-report-kpi-card>
          <app-report-kpi-card
            title="Cancelled / ملغاة"
            [value]="data.cancelledFollowUps"
            theme="theme-danger"
          ></app-report-kpi-card>
        </div>

        <div class="charts-grid">
          <app-svg-bar-chart
            title="Follow-ups By Type / حسب النوع"
            [items]="typeBarItems"
          ></app-svg-bar-chart>
          <app-svg-bar-chart
            title="Follow-ups By Assignee / حسب الموظف"
            [items]="assigneeBarItems"
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
export class CrmReportComponent implements OnInit {
  private api = inject(ReportsApiService);

  filter: ReportFilter = { period: ReportPeriod.ThisMonth };
  data?: CrmReport;
  loading = false;
  error?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.getCrm(this.filter).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.title || 'Failed to load CRM report.';
        this.loading = false;
      },
    });
  }

  onFilterChange(f: ReportFilter): void {
    this.filter = f;
    this.loadData();
  }

  downloadCsv(): void {
    this.api.downloadCsv('crm', this.filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'crm-report.csv';
      a.click();
    });
  }

  get typeBarItems(): BarChartItem[] {
    if (!this.data) return [];
    return this.data.byType.map((t) => ({
      label: t.followUpType,
      value: t.count,
      color: '#06b6d4',
    }));
  }

  get assigneeBarItems(): BarChartItem[] {
    if (!this.data) return [];
    return this.data.byAssignee.map((a) => ({
      label: a.assigneeName,
      value: a.count,
      color: '#8b5cf6',
    }));
  }
}
