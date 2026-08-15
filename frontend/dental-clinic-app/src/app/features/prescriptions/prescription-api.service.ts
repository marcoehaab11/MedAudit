import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface Medication {
  id: string;
  name: string;
  genericName?: string;
  strength?: string;
  form?: number;
  isActive: boolean;
}
export interface PrescriptionItem {
  id: string;
  medicationId?: string;
  medicationName: string;
  genericName?: string;
  strength?: string;
  form?: number;
  dose: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions: string;
  quantity?: number;
  sortOrder: number;
}
export interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  appointmentId?: string;
  examinationId?: string;
  treatmentId?: string;
  status: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  cancelledAt?: string;
  version: string;
  items: PrescriptionItem[];
}
export interface PrescriptionList {
  id: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  status: number;
  createdAt: string;
  issuedAt?: string;
}
export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface PrescriptionItemInput {
  medicationId?: string;
  medicationName?: string;
  genericName?: string;
  strength?: string;
  form?: number;
  dose: string;
  frequency: string;
  duration: string;
  route?: string;
  instructions: string;
  quantity?: number;
  sortOrder: number;
}

@Injectable({ providedIn: 'root' })
export class PrescriptionApiService {
  private readonly http = inject(HttpClient);
  prescriptions(filters: Record<string, string> = {}) {
    return this.http.get<Page<PrescriptionList>>('/api/prescriptions', {
      params: new HttpParams({ fromObject: { pageSize: '50', ...filters } }),
    });
  }
  prescription(id: string) {
    return this.http.get<Prescription>(`/api/prescriptions/${id}`);
  }
  medications(search: string) {
    return this.http.get<Page<Medication>>('/api/medications', {
      params: { search, pageSize: 20 },
    });
  }
  create(value: {
    patientId: string;
    doctorProfileId: string;
    appointmentId?: string;
    examinationId?: string;
    treatmentId?: string;
    notes?: string;
    items: PrescriptionItemInput[];
  }) {
    return this.http.post<{ id: string }>('/api/prescriptions', value);
  }
  update(
    id: string,
    value: {
      patientId: string;
      doctorProfileId: string;
      appointmentId?: string;
      examinationId?: string;
      treatmentId?: string;
      notes?: string;
      version: string;
    },
  ) {
    return this.http.put<void>(`/api/prescriptions/${id}`, value);
  }
  addItem(id: string, item: PrescriptionItemInput, version: string) {
    return this.http.post<void>(`/api/prescriptions/${id}/items`, item, { params: { version } });
  }
  updateItem(id: string, item: PrescriptionItem, version: string) {
    return this.http.put<void>(`/api/prescriptions/${id}/items/${item.id}`, {
      dose: item.dose,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      instructions: item.instructions,
      quantity: item.quantity,
      sortOrder: item.sortOrder,
      version,
    });
  }
  removeItem(id: string, itemId: string, version: string) {
    return this.http.delete<void>(`/api/prescriptions/${id}/items/${itemId}`, {
      params: { version },
    });
  }
  action(id: string, action: 'issue' | 'cancel', version: string) {
    return this.http.post<void>(`/api/prescriptions/${id}/${action}`, { version });
  }
  document(id: string, print = false) {
    return this.http.get(`/api/prescriptions/${id}/${print ? 'print' : 'document'}`, {
      responseType: 'blob',
    });
  }
  qr(id: string) {
    return this.http.get(`/api/prescriptions/${id}/qr`, { responseType: 'text' });
  }
}
