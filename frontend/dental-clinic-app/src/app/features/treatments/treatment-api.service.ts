import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface PriceTier {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
  notes?: string;
}

export interface CatalogItem {
  id: string;
  type: number;
  name: string;
  code: string;
  description?: string;
  defaultPrice: number;
  isActive: boolean;
}

export interface CatalogItemInput {
  type: number;
  name: string;
  code: string;
  description?: string;
  defaultPrice: number;
  isActive?: boolean;
}

export interface ParsedCatalogItem extends CatalogItem {
  nameEn: string;
  nameAr: string;
  priceTiers: PriceTier[];
  cleanDescription: string;
}

export function parseCatalogItem(item: CatalogItem): ParsedCatalogItem {
  let nameEn = item.name;
  let nameAr = item.name;
  let priceTiers: PriceTier[] = [];
  let cleanDescription = item.description || '';

  if (item.name.includes('/')) {
    const parts = item.name.split('/');
    nameEn = parts[0].trim();
    nameAr = parts[1].trim();
  } else if (item.name.includes('|')) {
    const parts = item.name.split('|');
    nameEn = parts[0].trim();
    nameAr = parts[1].trim();
  }

  if (item.description && item.description.startsWith('{')) {
    try {
      const data = JSON.parse(item.description);
      if (data.nameEn) nameEn = data.nameEn;
      if (data.nameAr) nameAr = data.nameAr;
      if (Array.isArray(data.priceTiers)) priceTiers = data.priceTiers;
      if (data.description !== undefined) cleanDescription = data.description;
    } catch {
      // Keep fallback
    }
  }

  if (!priceTiers.length) {
    priceTiers = [
      {
        id: 'base',
        nameEn: 'Standard Base Price',
        nameAr: 'السعر الأساسي',
        price: item.defaultPrice,
      },
    ];
  }

  return {
    ...item,
    nameEn,
    nameAr,
    priceTiers,
    cleanDescription,
  };
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
  createCatalog(item: CatalogItemInput) {
    return this.http.post<{ id: string }>('/api/treatment-catalog', item);
  }
  updateCatalog(id: string, item: CatalogItemInput) {
    return this.http.put<void>(`/api/treatment-catalog/${id}`, item);
  }
  deleteCatalog(id: string) {
    return this.http.delete<void>(`/api/treatment-catalog/${id}`);
  }
  plans(filters: Record<string, string> = {}) {
    return this.http.get<Page<TreatmentPlanList>>('/api/treatment-plans', {
      params: new HttpParams({ fromObject: { page: '1', pageSize: '50', ...filters } }),
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
      params: new HttpParams({ fromObject: { page: '1', pageSize: '50', ...filters } }),
    });
  }
  treatment(id: string) {
    return this.http.get<Treatment>(`/api/treatments/${id}`);
  }
  createTreatment(value: {
    patientId: string;
    doctorProfileId: string;
    catalogItemId: string;
    appointmentId?: string;
    treatmentPlanItemId?: string;
    sourceDentalProcedureId?: string;
    toothNumbers?: number[];
    notes?: string;
    price?: number;
  }) {
    return this.http.post<{ id: string }>('/api/treatments', value);
  }
  treatmentAction(id: string, action: string, version: string) {
    return this.http.post<void>(`/api/treatments/${id}/${action}`, { version });
  }
}

