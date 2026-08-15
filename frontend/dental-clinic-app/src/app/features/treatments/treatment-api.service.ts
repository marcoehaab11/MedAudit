import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface CatalogItem {
  id: string;
  type: number;
  name: string;
  code: string;
  description?: string;
  defaultPrice: number;
  isActive: boolean;
}
export interface PlanItem {
  id: string;
  catalogItemId: string;
  treatmentName: string;
  toothNumber?: number;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  total: number;
  notes?: string;
}
export interface TreatmentPlan {
  id: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  title: string;
  notes?: string;
  status: number;
  subtotal: number;
  discountAmount: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  version: string;
  items: PlanItem[];
}
export interface TreatmentPlanList {
  id: string;
  patientName: string;
  doctorName: string;
  title: string;
  status: number;
  total: number;
  createdAt: string;
}
export interface Treatment {
  id: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  treatmentName: string;
  type: number;
  toothNumbers: number[];
  status: number;
  price: number;
  notes?: string;
  createdAt: string;
  completedAt?: string;
  version: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface PlanItemInput {
  catalogItemId: string;
  toothNumber?: number;
  quantity: number;
  discountAmount: number;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class TreatmentApiService {
  private readonly http = inject(HttpClient);
  catalog(includeInactive = false) {
    return this.http.get<CatalogItem[]>('/api/treatment-catalog', { params: { includeInactive } });
  }
  plans(filters: Record<string, string> = {}) {
    return this.http.get<Page<TreatmentPlanList>>('/api/treatment-plans', {
      params: new HttpParams({ fromObject: { pageSize: '50', ...filters } }),
    });
  }
  plan(id: string) {
    return this.http.get<TreatmentPlan>(`/api/treatment-plans/${id}`);
  }
  createPlan(value: {
    patientId: string;
    doctorProfileId: string;
    title: string;
    notes?: string;
    discountAmount: number;
    items: PlanItemInput[];
  }) {
    return this.http.post<{ id: string }>('/api/treatment-plans', value);
  }
  updatePlan(
    id: string,
    value: { title: string; notes?: string; discountAmount: number; version: string },
  ) {
    return this.http.put<void>(`/api/treatment-plans/${id}`, value);
  }
  addPlanItem(id: string, item: PlanItemInput, version: string) {
    return this.http.post<void>(`/api/treatment-plans/${id}/items`, item, { params: { version } });
  }
  removePlanItem(id: string, itemId: string, version: string) {
    return this.http.delete<void>(`/api/treatment-plans/${id}/items/${itemId}`, {
      params: { version },
    });
  }
  planAction(id: string, action: string, version: string) {
    return this.http.post<void>(`/api/treatment-plans/${id}/${action}`, { version });
  }
  treatments(filters: Record<string, string> = {}) {
    return this.http.get<Page<Treatment>>('/api/treatments', {
      params: new HttpParams({ fromObject: { pageSize: '50', ...filters } }),
    });
  }
  treatment(id: string) {
    return this.http.get<Treatment>(`/api/treatments/${id}`);
  }
  treatmentAction(id: string, action: string, version: string) {
    return this.http.post<void>(`/api/treatments/${id}/${action}`, { version });
  }
}
