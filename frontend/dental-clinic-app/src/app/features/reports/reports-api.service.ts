import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export enum ReportPeriod {
  Today = 0,
  ThisWeek = 1,
  ThisMonth = 2,
  ThisYear = 3,
  Custom = 4,
}

export interface ReportFilter {
  period?: ReportPeriod;
  from?: string;
  to?: string;
  doctorId?: string;
  categoryId?: string;
  treatmentType?: string;
  status?: string;
}

export interface DashboardReport {
  newPatients: number;
  appointmentsCount: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completedTreatments: number;
  prescriptionsIssued: number;
  followUpsCompleted: number;
  revenue: number;
  paymentsReceived: number;
  outstanding: number;
  expenses: number;
  doctorCompensation: number;
  netProfit: number;
  currency: string;
  timeZone: string;
}

export interface FinancialReport {
  revenue: number;
  payments: number;
  outstanding: number;
  expenses: number;
  doctorCompensation: number;
  netProfit: number;
  currency: string;
}

export interface RevenueByPeriod {
  period: string;
  amount: number;
}
export interface RevenueByDoctor {
  doctorId: string;
  doctorName: string;
  revenue: number;
}
export interface RevenueByTreatment {
  treatmentType: string;
  revenue: number;
  count: number;
}
export interface RevenueByCategory {
  categoryId: string;
  categoryName: string;
  revenue: number;
}

export interface RevenueReport {
  totalRevenue: number;
  byPeriod: RevenueByPeriod[];
  byDoctor: RevenueByDoctor[];
  byTreatment: RevenueByTreatment[];
  byCategory: RevenueByCategory[];
  currency: string;
}

export interface ExpensesByCategory {
  categoryId: string;
  categoryName: string;
  amount: number;
}
export interface ExpensesByMonth {
  month: string;
  amount: number;
}

export interface ExpenseReport {
  totalExpenses: number;
  byCategory: ExpensesByCategory[];
  byMonth: ExpensesByMonth[];
  topCategories: ExpensesByCategory[];
  currency: string;
}

export interface ProfitPeriodMetrics {
  revenue: number;
  doctorCompensation: number;
  operatingExpenses: number;
  netProfit: number;
}

export interface ProfitReport {
  currentPeriod: ProfitPeriodMetrics;
  previousPeriod: ProfitPeriodMetrics;
  revenueGrowthPercentage: number;
  expenseGrowthPercentage: number;
  profitGrowthPercentage: number;
  currency: string;
}

export interface NewPatientsByPeriod {
  period: string;
  count: number;
}

export interface PatientReport {
  newPatients: number;
  returningPatients: number;
  activePatients: number;
  archivedPatients: number;
  totalPatients: number;
  newPatientsByMonth: NewPatientsByPeriod[];
  patientGrowthPercentage: number;
}

export interface AppointmentStatusCount {
  status: string;
  count: number;
}

export interface AppointmentReport {
  totalAppointments: number;
  scheduled: number;
  confirmed: number;
  checkedIn: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
  cancellationRate: number;
  noShowRate: number;
  byStatus: AppointmentStatusCount[];
}

export interface DoctorPerformanceItem {
  doctorId: string;
  doctorName: string;
  appointmentsCount: number;
  completedAppointments: number;
  cancelledAppointments: number;
  noShowAppointments: number;
  completedTreatments: number;
  revenue: number;
  doctorCompensationCost: number;
}

export interface DoctorPerformanceReport {
  doctors: DoctorPerformanceItem[];
  currency: string;
}

export interface TreatmentsByType {
  typeName: string;
  count: number;
  revenue: number;
}
export interface TreatmentsByDoctor {
  doctorId: string;
  doctorName: string;
  count: number;
  revenue: number;
}
export interface TreatmentsByMonth {
  month: string;
  count: number;
  revenue: number;
}

export interface TreatmentReport {
  totalCount: number;
  completedCount: number;
  cancelledCount: number;
  totalRevenue: number;
  byType: TreatmentsByType[];
  byDoctor: TreatmentsByDoctor[];
  byMonth: TreatmentsByMonth[];
  currency: string;
}

export interface PrescriptionsByMonth {
  month: string;
  count: number;
}
export interface PrescriptionsByDoctor {
  doctorId: string;
  doctorName: string;
  count: number;
}

export interface PrescriptionReport {
  totalIssued: number;
  totalCancelled: number;
  byMonth: PrescriptionsByMonth[];
  byDoctor: PrescriptionsByDoctor[];
}

export interface FollowUpsByType {
  followUpType: string;
  count: number;
}
export interface FollowUpsByAssignee {
  assigneeId?: string;
  assigneeName: string;
  count: number;
}

export interface CrmReport {
  followUpsCreated: number;
  followUpsCompleted: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  cancelledFollowUps: number;
  byType: FollowUpsByType[];
  byAssignee: FollowUpsByAssignee[];
}

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  private readonly http = inject(HttpClient);

  getDashboard(filter?: ReportFilter) {
    return this.http.get<DashboardReport>('/api/reports/dashboard', {
      params: cleanParams(filter),
    });
  }

  getFinancial(filter?: ReportFilter) {
    return this.http.get<FinancialReport>('/api/reports/financial', {
      params: cleanParams(filter),
    });
  }

  getRevenue(filter?: ReportFilter) {
    return this.http.get<RevenueReport>('/api/reports/revenue', { params: cleanParams(filter) });
  }

  getExpenses(filter?: ReportFilter) {
    return this.http.get<ExpenseReport>('/api/reports/expenses', { params: cleanParams(filter) });
  }

  getProfit(filter?: ReportFilter) {
    return this.http.get<ProfitReport>('/api/reports/profit', { params: cleanParams(filter) });
  }

  getPatients(filter?: ReportFilter) {
    return this.http.get<PatientReport>('/api/reports/patients', { params: cleanParams(filter) });
  }

  getAppointments(filter?: ReportFilter) {
    return this.http.get<AppointmentReport>('/api/reports/appointments', {
      params: cleanParams(filter),
    });
  }

  getDoctors(filter?: ReportFilter) {
    return this.http.get<DoctorPerformanceReport>('/api/reports/doctors', {
      params: cleanParams(filter),
    });
  }

  getTreatments(filter?: ReportFilter) {
    return this.http.get<TreatmentReport>('/api/reports/treatments', {
      params: cleanParams(filter),
    });
  }

  getPrescriptions(filter?: ReportFilter) {
    return this.http.get<PrescriptionReport>('/api/reports/prescriptions', {
      params: cleanParams(filter),
    });
  }

  getCrm(filter?: ReportFilter) {
    return this.http.get<CrmReport>('/api/reports/crm', { params: cleanParams(filter) });
  }

  downloadCsv(reportType: string, filter?: ReportFilter) {
    return this.http.get(`/api/reports/export/${reportType}`, {
      params: cleanParams(filter),
      responseType: 'blob',
    });
  }
}

function cleanParams(filter?: ReportFilter): HttpParams {
  let p = new HttpParams();
  if (!filter) return p;

  if (filter.period !== undefined) p = p.set('period', filter.period);
  if (filter.from) p = p.set('from', filter.from);
  if (filter.to) p = p.set('to', filter.to);
  if (filter.doctorId) p = p.set('doctorId', filter.doctorId);
  if (filter.categoryId) p = p.set('categoryId', filter.categoryId);
  if (filter.treatmentType) p = p.set('treatmentType', filter.treatmentType);
  if (filter.status) p = p.set('status', filter.status);

  return p;
}
