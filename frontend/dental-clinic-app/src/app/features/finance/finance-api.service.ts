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
  treatmentId?: string;
  treatmentName?: string;
  doctorProfileId?: string;
  doctorName?: string;
  amount: number;
  paid: number;
  outstanding: number;
  currency: string;
  description: string;
  occurredAt: string;
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
  revenues(filters: Record<string, string | number | undefined>) {
    return this.http.get<Page<Revenue>>('/api/finance/revenue', {
      params: clean({ pageSize: 20, ...filters }),
    });
  }
  revenue(id: string) {
    return this.http.get<Revenue>(`/api/finance/revenue/${id}`);
  }
  payments(filters: Record<string, string | number | undefined>) {
    return this.http.get<Page<Payment>>('/api/finance/payments', {
      params: clean({ pageSize: 20, ...filters }),
    });
  }
  createPayment(value: object) {
    return this.http.post<{ id: string }>('/api/finance/payments', value);
  }
  expenses(filters: Record<string, string | number | undefined>) {
    return this.http.get<Page<Expense>>('/api/finance/expenses', {
      params: clean({ pageSize: 20, ...filters }),
    });
  }
  createExpense(value: object) {
    return this.http.post<{ id: string }>('/api/finance/expenses', value);
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
