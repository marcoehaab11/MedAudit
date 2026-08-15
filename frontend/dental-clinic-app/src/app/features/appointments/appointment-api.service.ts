import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface AppointmentItem {
  id: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  type: number;
  status: number;
  startAt: string;
  endAt: string;
  durationMinutes: number;
  timeZone: string;
}
export interface AppointmentDetails extends AppointmentItem {
  notes?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}
export interface AppointmentSearchResult {
  page: {
    items: AppointmentItem[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  timeZone: string;
}
export interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  localDate: string;
  localStartTime: string;
  localEndTime: string;
  timeZone: string;
}
export interface AppointmentTime {
  date: string;
  startTime: string;
  durationMinutes: number;
}
export interface AppointmentFilters {
  from: string;
  to: string;
  doctorProfileId?: string;
  status?: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class AppointmentApiService {
  private readonly http = inject(HttpClient);

  appointments(filters: AppointmentFilters) {
    let params = new HttpParams()
      .set('from', filters.from)
      .set('to', filters.to)
      .set('pageSize', 250);
    if (filters.doctorProfileId) params = params.set('doctorProfileId', filters.doctorProfileId);
    if (filters.status) params = params.set('status', filters.status);
    if (filters.type) params = params.set('type', filters.type);
    return this.http.get<AppointmentSearchResult>('/api/appointments', { params });
  }
  appointment(id: string) {
    return this.http.get<AppointmentDetails>(`/api/appointments/${id}`);
  }
  availability(doctorProfileId: string, date: string, durationMinutes: number) {
    return this.http.get<AvailabilitySlot[]>('/api/appointments/availability', {
      params: { doctorProfileId, date, durationMinutes },
    });
  }
  create(value: {
    patientId: string;
    doctorProfileId: string;
    type: number;
    time: AppointmentTime;
    notes?: string;
  }) {
    return this.http.post<{ id: string }>('/api/appointments', value);
  }
  reschedule(id: string, time: AppointmentTime) {
    return this.http.put<void>(`/api/appointments/${id}/reschedule`, { time });
  }
  action(id: string, action: 'confirm' | 'check-in' | 'start' | 'complete' | 'no-show') {
    return this.http.post<void>(`/api/appointments/${id}/${action}`, {});
  }
  cancel(id: string, reason: string) {
    return this.http.post<void>(`/api/appointments/${id}/cancel`, { reason });
  }
}
