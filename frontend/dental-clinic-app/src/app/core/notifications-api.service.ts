import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InAppNotificationDto {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  readAt: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  createdAt: string;
}

export interface NotificationTemplateDto {
  id: string;
  name: string;
  channel: number;
  language: string;
  subject: string | null;
  body: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPreferenceDto {
  id: string;
  eventType: string;
  channel: number;
  isEnabled: boolean;
}

export interface NotificationDeliveryDto {
  id: string;
  channel: number;
  status: number;
  recipientType: number;
  recipientId: string;
  destination: string;
  templateName: string;
  subject: string | null;
  body: string;
  language: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  providerName: string | null;
  attemptCount: number;
  lastAttemptedAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsApiService {
  private readonly http = inject(HttpClient);

  getNotifications(unreadOnly = false, take = 50): Observable<InAppNotificationDto[]> {
    return this.http.get<InAppNotificationDto[]>(
      `/api/notifications?unreadOnly=${unreadOnly}&take=${take}`,
    );
  }

  getUnreadCount(): Observable<{ count: number }> {
    return this.http.get<{ count: number }>('/api/notifications/unread-count');
  }

  markAsRead(id: string): Observable<void> {
    return this.http.post<void>(`/api/notifications/${id}/read`, {});
  }

  markAllAsRead(): Observable<{ count: number }> {
    return this.http.post<{ count: number }>('/api/notifications/read-all', {});
  }

  getTemplates(): Observable<NotificationTemplateDto[]> {
    return this.http.get<NotificationTemplateDto[]>('/api/notifications/templates');
  }

  getPreferences(): Observable<NotificationPreferenceDto[]> {
    return this.http.get<NotificationPreferenceDto[]>('/api/notifications/preferences');
  }

  getDeliveries(take = 50): Observable<NotificationDeliveryDto[]> {
    return this.http.get<NotificationDeliveryDto[]>(`/api/notifications/deliveries?take=${take}`);
  }
}
