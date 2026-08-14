import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface DoctorProfileInput {
  clinicUserId?: string;
  specialization: string;
  licenseNumber: string;
  bio?: string | null;
  consultationDurationMinutes: number;
}
export interface DoctorListItem {
  id: string;
  clinicUserId: string;
  displayName: string;
  email: string;
  phone?: string;
  specialization: string;
  licenseNumber: string;
  status: number;
  createdAt: string;
}
export interface DoctorDetails extends DoctorListItem {
  accountStatus: number;
  bio?: string;
  consultationDurationMinutes: number;
  updatedAt: string;
  canManageSchedule: boolean;
  canManageCompensation: boolean;
}
export interface DoctorCandidate {
  clinicUserId: string;
  displayName: string;
  email: string;
  phone?: string;
}
export interface PagedDoctors {
  items: DoctorListItem[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface ScheduleBreak {
  id?: string;
  startTime: string;
  endTime: string;
}
export interface SchedulePeriod {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  breaks: ScheduleBreak[];
}
export interface Compensation {
  id: string;
  compensationType: number;
  fixedAmount?: number;
  percentage?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class DoctorApiService {
  private readonly http = inject(HttpClient);
  doctors(search: string, status: string, specialization: string, page: number) {
    let params = new HttpParams().set('page', page).set('pageSize', 20);
    if (search) params = params.set('search', search);
    if (status) params = params.set('status', status);
    if (specialization) params = params.set('specialization', specialization);
    return this.http.get<PagedDoctors>('/api/doctors', { params });
  }
  doctor(id: string) {
    return this.http.get<DoctorDetails>(`/api/doctors/${id}`);
  }
  candidates() {
    return this.http.get<DoctorCandidate[]>('/api/doctors/candidates');
  }
  create(value: DoctorProfileInput) {
    return this.http.post<{ id: string }>('/api/doctors', value);
  }
  update(id: string, value: DoctorProfileInput) {
    return this.http.put<void>(`/api/doctors/${id}`, value);
  }
  status(id: string, active: boolean) {
    return this.http.post<void>(`/api/doctors/${id}/${active ? 'activate' : 'deactivate'}`, {});
  }
  archive(id: string) {
    return this.http.post<void>(`/api/doctors/${id}/archive`, {});
  }
  schedule(id: string) {
    return this.http.get<SchedulePeriod[]>(`/api/doctors/${id}/schedule`);
  }
  saveSchedule(id: string, periods: SchedulePeriod[]) {
    return this.http.put<void>(`/api/doctors/${id}/schedule`, { periods });
  }
  compensation(id: string) {
    return this.http.get<Compensation[]>(`/api/doctors/${id}/compensation`);
  }
  createCompensation(id: string, value: Omit<Compensation, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.http.post<{ id: string }>(`/api/doctors/${id}/compensation`, value);
  }
  changeCompensation(id: string, value: Omit<Compensation, 'id' | 'createdAt' | 'updatedAt'>) {
    return this.http.post<{ id: string }>(`/api/doctors/${id}/compensation/change`, value);
  }
}
