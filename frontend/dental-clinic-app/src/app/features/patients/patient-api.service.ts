import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface PatientProfile {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  gender: number;
  dateOfBirth: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  nationality?: string | null;
  occupation?: string | null;
  maritalStatus?: number | null;
  notes?: string | null;
}
export interface PatientListItem {
  id: string;
  patientNumber: string;
  fullName: string;
  gender: number;
  phone: string;
  email?: string | null;
  status: number;
  createdAt: string;
}
export interface MedicalTextItem {
  id: string;
  name: string;
  notes?: string | null;
}
export interface MedicationItem extends MedicalTextItem {
  dosage?: string | null;
}
export interface SurgeryItem {
  id: string;
  procedure: string;
  procedureDate?: string | null;
  notes?: string | null;
}
export interface PatientDetails extends PatientProfile {
  id: string;
  patientNumber: string;
  status: number;
  createdAt: string;
  updatedAt: string;
  medicalNotes?: string | null;
  canViewMedicalInformation: boolean;
  canEditMedicalInformation: boolean;
  allergies: MedicalTextItem[];
  medicalConditions: MedicalTextItem[];
  medications: MedicationItem[];
  surgeries: SurgeryItem[];
}
export interface PagedPatients {
  items: PatientListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

@Injectable({ providedIn: 'root' })
export class PatientApiService {
  private readonly http = inject(HttpClient);

  patients(filters: {
    search: string;
    status: string;
    gender: string;
    page: number;
    sortBy: string;
    descending: boolean;
  }) {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', 20)
      .set('sortBy', filters.sortBy)
      .set('descending', filters.descending);
    if (filters.search) params = params.set('search', filters.search);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.gender) params = params.set('gender', filters.gender);
    return this.http.get<PagedPatients>('/api/patients', { params });
  }
  patient(id: string) {
    return this.http.get<PatientDetails>(`/api/patients/${id}`);
  }
  create(profile: PatientProfile) {
    return this.http.post<{ id: string }>('/api/patients', profile);
  }
  update(id: string, profile: PatientProfile) {
    return this.http.put<void>(`/api/patients/${id}`, profile);
  }
  archive(id: string) {
    return this.http.post<void>(`/api/patients/${id}/archive`, {});
  }
  updateMedicalNotes(id: string, medicalNotes: string) {
    return this.http.put<void>(`/api/patients/${id}/medical-notes`, { medicalNotes });
  }
  addText(id: string, kind: 'allergies' | 'conditions', value: { name: string; notes?: string }) {
    return this.http.post<{ id: string }>(`/api/patients/${id}/${kind}`, value);
  }
  removeText(id: string, kind: 'allergies' | 'conditions', itemId: string) {
    return this.http.delete<void>(`/api/patients/${id}/${kind}/${itemId}`);
  }
  addMedication(id: string, value: { name: string; dosage?: string; notes?: string }) {
    return this.http.post<{ id: string }>(`/api/patients/${id}/medications`, value);
  }
  removeMedication(id: string, itemId: string) {
    return this.http.delete<void>(`/api/patients/${id}/medications/${itemId}`);
  }
  addSurgery(id: string, value: { procedure: string; procedureDate?: string; notes?: string }) {
    return this.http.post<{ id: string }>(`/api/patients/${id}/surgeries`, value);
  }
  removeSurgery(id: string, itemId: string) {
    return this.http.delete<void>(`/api/patients/${id}/surgeries/${itemId}`);
  }
}
