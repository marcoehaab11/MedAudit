import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface NamedAmount {
  id?: string;
  name: string;
  amount: number;
}
export interface DailyAmount {
  date: string;
  amount: number;
}
export interface DoctorDues { total: number; currency: string; treatmentCount: number; byCurrency?: { currency: string; total: number; treatmentCount: number }[] }
export interface BillingQueueItem { revenueId: string; patientId: string; patientName: string; patientNumber?: string; treatmentName: string; outstanding: number; currency: string; appointmentId?: string; occurredAt: string }
export interface FinanceSummary {
  revenue: number;
  payments: number;
  outstanding: number;
  expenses: number;
  doctorCompensation: number;
  netProfit: number;
  currency: string;
  from: string;
  to: string;
  timeZone: string;
  revenueComparison?: { revenue: number; from: string; to: string } | null;
  revenueByCategory: NamedAmount[];
  revenueByDoctor: NamedAmount[];
  expensesByCategory: NamedAmount[];
  revenueByDay: DailyAmount[];
  expensesByDay: DailyAmount[];
}
export interface Category {
  id: string;
  name: string;
  code: string;
  type: number;
  parentId?: string;
  parentName?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  version: string;
}
export interface Revenue {
  id: string;
  categoryId: string;
  categoryName: string;
  patientId?: string;
  patientName?: string;
  patientNumber?: string;
  treatmentId?: string;
  treatmentName?: string;
  serviceType?: number;
  doctorProfileId?: string;
  doctorName?: string;
  amount: number;
  paid: number;
  outstanding: number;
  currency: string;
  description: string;
  occurredAt: string;
}
export interface RevenueCurrencyTotals {
  currency: string;
  revenue: number;
  paid: number;
  outstanding: number;
}
export interface RevenueServiceTotal {
  catalogItemId: string;
  name: string;
  serviceType: number;
  currency: string;
  revenue: number;
}
export interface RevenuePage extends Page<Revenue> {
  summary: { totals: RevenueCurrencyTotals[]; services: RevenueServiceTotal[] } | null;
}
export interface Payment {
  id: string;
  patientId?: string;
  patientName?: string;
  revenueId: string;
  treatmentId?: string;
  amount: number;
  currency: string;
  paymentMethod: number;
  reference?: string;
  paidAt: string;
  createdAt: string;
}
export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currency: string;
  description: string;
  vendorName?: string;
  reference?: string;
  expenseDate: string;
  createdAt: string;
  isFixed?: boolean;
}
export interface DueExpense {
  id: string;
  dueDate: string;
  isFixed: boolean;
  categoryId?: string;
  categoryName: string;
  description: string;
  vendorName?: string;
  amount: number;
  currency: string;
  labPatientId?: string;
  labStatementId?: string;
}
export interface FixedExpenseInput {
  name: string;
  categoryId: string;
  beneficiary: string;
  monthlyAmount: number;
  dueDay: number;
  startsOn: string;
}
export interface FixedExpenseSchedule extends FixedExpenseInput {
  id: string;
  currency: string;
}
export interface PatientBalance {
  patientId: string;
  totalRevenue: number;
  totalPaid: number;
  outstanding: number;
  currency: string;
}

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  private readonly http = inject(HttpClient);
  myDues() { return this.http.get<DoctorDues>('/api/finance/my-dues'); }
  billingQueue() { return this.http.get<BillingQueueItem[]>('/api/finance/billing-queue'); }
  dashboard(period = 3, from = '', to = '') {
    return this.http.get<FinanceSummary>('/api/finance/dashboard', {
      params: clean({ period, from, to }),
    });
  }
  categories(includeInactive = false, type?: number) {
    return this.http.get<Category[]>('/api/finance/categories', {
      params: clean({ includeInactive, type }),
    });
  }
  createCategory(category: { name: string; code: string; type: number; parentId?: string }) {
    return this.http.post<{ id: string }>('/api/finance/categories', category);
  }
  updateCategory(
    item: Category,
    category: { name: string; code: string; type: number; parentId?: string },
  ) {
    return this.http.put<void>(`/api/finance/categories/${item.id}`, {
      category,
      version: item.version,
    });
  }
  categoryStatus(item: Category, isActive: boolean) {
    return this.http.post<void>(`/api/finance/categories/${item.id}/status`, {
      isActive,
      version: item.version,
    });
  }
  revenues(filters: Record<string, string | number | boolean | undefined>) {
    return this.http.get<RevenuePage>('/api/finance/revenue', {
      params: clean({ page: 1, pageSize: 20, ...filters }),
    });
  }
  revenue(id: string) {
    return this.http.get<Revenue>(`/api/finance/revenue/${id}`);
  }
  payments(filters: Record<string, string | number | undefined>) {
    return this.http.get<Page<Payment>>('/api/finance/payments', {
      params: clean({ page: 1, pageSize: 20, ...filters }),
    });
  }
  createPayment(value: object) {
    return this.http.post<{ id: string }>('/api/finance/payments', value);
  }
  expenses(filters: Record<string, string | number | undefined>) {
    return this.http.get<Page<Expense>>('/api/finance/expenses', {
      params: clean({ page: 1, pageSize: 20, ...filters }),
    });
  }
  createExpense(value: object) {
    return this.http.post<{ id: string }>('/api/finance/expenses', value);
  }
  expenseLedger(paidPage: number, duePage: number) {
    return this.http.get<{ paid: Page<Expense>; due: Page<DueExpense> }>('/api/finance/expenses/ledger', {
      params: { paidPage, duePage },
    });
  }
  fixedDueExpense(id: string) {
    return this.http.get<DueExpense>(`/api/finance/expenses/due/${encodeURIComponent(id)}`);
  }
  fixedExpenses() {
    return this.http.get<FixedExpenseSchedule[]>('/api/finance/expenses/fixed');
  }
  createFixedExpense(value: FixedExpenseInput) {
    return this.http.post<{ id: string }>('/api/finance/expenses/fixed', value);
  }
  patientBalance(id: string) {
    return this.http.get<PatientBalance>(`/api/finance/patients/${id}/balance`);
  }
}
function clean(values: Record<string, string | number | boolean | undefined>) {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(values))
    if (value !== undefined && value !== '') p = p.set(key, value);
  return p;
}

