import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, shareReplay, tap } from 'rxjs';

export interface DoctorProfileInput {
  clinicUserId?: string;
  displayName?: string;
  phone?: string | null;
  specialization: string;
  licenseNumber?: string | null;
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
  licenseNumber?: string;
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

import { AuthService } from '../../core/auth.service';

@Injectable({ providedIn: 'root' })
export class DoctorApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private cachedAll$: Observable<DoctorListItem[]> | null = null;

  constructor() {
    this.auth.onAuthReset$.subscribe(() => this.invalidateCache());
  }

  listAll(force = false): Observable<DoctorListItem[]> {
    if (!this.cachedAll$ || force) {
      const params = new HttpParams().set('page', 1).set('pageSize', 100);
      this.cachedAll$ = this.http
        .get<PagedDoctors>('/api/doctors', { params })
        .pipe(
          map((res) => (res.items ?? []).filter((d) => d.status === 1)),
          shareReplay(1)
        );
    }
    return this.cachedAll$;
  }

  invalidateCache() {
    this.cachedAll$ = null;
  }

  doctors(search: string, status: string, specialization: string, page: number = 1, pageSize: number = 50) {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
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
    return this.http.post<{ id: string }>('/api/doctors', value).pipe(tap(() => this.invalidateCache()));
  }
  update(id: string, value: DoctorProfileInput) {
    return this.http.put<void>(`/api/doctors/${id}`, value).pipe(tap(() => this.invalidateCache()));
  }
  status(id: string, active: boolean) {
    return this.http.post<void>(`/api/doctors/${id}/${active ? 'activate' : 'deactivate'}`, {}).pipe(tap(() => this.invalidateCache()));
  }
  archive(id: string) {
    return this.http.post<void>(`/api/doctors/${id}/archive`, {}).pipe(tap(() => this.invalidateCache()));
  }
  restore(id: string) {
    return this.http.post<void>(`/api/doctors/${id}/restore`, {}).pipe(tap(() => this.invalidateCache()));
  }
  delete(id: string) {
    return this.http.delete<void>(`/api/doctors/${id}`).pipe(tap(() => this.invalidateCache()));
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

