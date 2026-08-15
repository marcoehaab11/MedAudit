import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ReportKpiCardComponent } from './components/report-kpi-card.component';
import { ReportPeriodSelectorComponent } from './components/report-period-selector.component';
import {
  DoctorPerformanceReport,
  ReportFilter,
  ReportPeriod,
  ReportsApiService,
} from './reports-api.service';

@Component({
  selector: 'app-doctor-report',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, ReportPeriodSelectorComponent],
  template: `
    <div class="reports-page">
      <div class="header">
        <h2>Doctor Performance / أداء الأطباء</h2>
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

      <div *ngIf="loading" class="state-msg">Loading doctor performance data...</div>
      <div *ngIf="error" class="state-msg error">{{ error }}</div>

      <div *ngIf="!loading && data" class="content">
        <div class="table-card">
          <table class="data-table">
            <thead>
              <tr>
                <th>Doctor / الطبيب</th>
                <th>Appointments Total / المواعيد</th>
                <th>Completed / مكتملة</th>
                <th>Cancelled / ملغاة</th>
                <th>No Show / لم يحضر</th>
                <th>Treatments / العلاجات</th>
                <th>Revenue Generated / الإيرادات</th>
                <th>Compensation Cost / مستحقات الطبيب</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let doc of data.doctors">
                <td class="font-bold">{{ doc.doctorName }}</td>
                <td>{{ doc.appointmentsCount }}</td>
                <td>{{ doc.completedAppointments }}</td>
                <td>{{ doc.cancelledAppointments }}</td>
                <td>{{ doc.noShowAppointments }}</td>
                <td>{{ doc.completedTreatments }}</td>
                <td class="pos">{{ doc.revenue | number: '1.0-2' }} {{ data.currency }}</td>
                <td>{{ doc.doctorCompensationCost | number: '1.0-2' }} {{ data.currency }}</td>
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
      .table-card {
        background: #ffffff;
        border-radius: 8px;
        padding: 16px;
        border: 1px solid #e5e7eb;
        overflow-x: auto;
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
      .font-bold {
        font-weight: 600;
      }
      .pos {
        color: #059669;
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
export class DoctorReportComponent implements OnInit {
  private api = inject(ReportsApiService);

  filter: ReportFilter = { period: ReportPeriod.ThisMonth };
  data?: DoctorPerformanceReport;
  loading = false;
  error?: string;

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading = true;
    this.api.getDoctors(this.filter).subscribe({
      next: (res) => {
        this.data = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.title || 'Failed to load doctor performance report.';
        this.loading = false;
      },
    });
  }

  onFilterChange(f: ReportFilter): void {
    this.filter = f;
    this.loadData();
  }

  downloadCsv(): void {
    this.api.downloadCsv('doctors', this.filter).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'doctor-performance-report.csv';
      a.click();
    });
  }
}
