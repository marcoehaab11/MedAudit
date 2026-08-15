import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
export interface CrmDashboard {
  newPatientsToday: number;
  newPatientsThisWeek: number;
  newPatientsThisMonth: number;
  pendingFollowUps: number;
  overdueFollowUps: number;
  completedFollowUps: number;
  todayFollowUps: number;
  timeZone: string;
}
export interface FollowUpList {
  id: string;
  patientId: string;
  patientName: string;
  assignedToUserId: string;
  assignedToName: string;
  type: number;
  status: number;
  dueAt: string;
  isOverdue: boolean;
  title: string;
  createdAt: string;
  completedAt?: string;
  version: string;
  timeZone: string;
}
export interface FollowUp extends FollowUpList {
  createdByUserId: string;
  notes?: string;
  relatedAppointmentId?: string;
  relatedTreatmentPlanId?: string;
  relatedTreatmentId?: string;
  relatedPrescriptionId?: string;
  updatedAt: string;
  cancelledAt?: string;
}
export interface CrmUser {
  id: string;
  displayName: string;
}
export interface Activity {
  id: string;
  patientId: string;
  patientName: string;
  userId: string;
  userName: string;
  type: number;
  direction: number;
  subject?: string;
  notes?: string;
  occurredAt: string;
  createdAt: string;
}
export interface PatientCrm {
  patientId: string;
  isNew: boolean;
  status: number;
  pendingFollowUps: number;
  recentFollowUps: FollowUpList[];
  recentActivities: Activity[];
  timeZone: string;
}
export interface FollowUpPayload {
  patientId: string;
  assignedToUserId: string;
  type: number;
  dueDate: string;
  dueTime: string;
  title: string;
  notes?: string;
  relatedAppointmentId?: string;
  relatedTreatmentPlanId?: string;
  relatedTreatmentId?: string;
  relatedPrescriptionId?: string;
}

@Injectable({ providedIn: 'root' })
export class CrmApiService {
  private readonly http = inject(HttpClient);
  dashboard() {
    return this.http.get<CrmDashboard>('/api/crm/dashboard');
  }
  users() {
    return this.http.get<CrmUser[]>('/api/crm/users');
  }
  followUps(filters: Record<string, string>) {
    return this.http.get<Page<FollowUpList>>('/api/crm/follow-ups', {
      params: new HttpParams({ fromObject: { pageSize: '20', ...filters } }),
    });
  }
  followUp(id: string) {
    return this.http.get<FollowUp>(`/api/crm/follow-ups/${id}`);
  }
  create(value: FollowUpPayload) {
    return this.http.post<{ id: string }>('/api/crm/follow-ups', value);
  }
  update(id: string, value: FollowUpPayload, version: string) {
    return this.http.put<void>(`/api/crm/follow-ups/${id}`, { followUp: value, version });
  }
  assign(id: string, assignedToUserId: string, version: string) {
    return this.http.post<void>(`/api/crm/follow-ups/${id}/assign`, { assignedToUserId, version });
  }
  action(id: string, action: 'start' | 'complete' | 'cancel', version: string) {
    return this.http.post<void>(`/api/crm/follow-ups/${id}/${action}`, { version });
  }
  patient(patientId: string) {
    return this.http.get<PatientCrm>(`/api/crm/patients/${patientId}`);
  }
  activities(patientId: string, take = 20) {
    return this.http.get<Activity[]>(`/api/crm/patients/${patientId}/activities`, {
      params: { take },
    });
  }
  createActivity(value: {
    patientId: string;
    type: number;
    direction: number;
    subject?: string;
    notes?: string;
    occurredDate: string;
    occurredTime: string;
  }) {
    return this.http.post<{ id: string }>('/api/crm/activities', value);
  }
}
