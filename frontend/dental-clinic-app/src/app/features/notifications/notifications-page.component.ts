import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  NotificationsApiService,
  InAppNotificationDto,
  NotificationDeliveryDto,
} from '../../core/notifications-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent implements OnInit {
  readonly i18n = inject(LocalizationService);
  readonly auth = inject(AuthService);
  private readonly api = inject(NotificationsApiService);

  activeTab = signal<'inbox' | 'deliveries'>('inbox');
  unreadOnly = signal<boolean>(false);
  loading = signal<boolean>(true);
  notifications = signal<InAppNotificationDto[]>([]);
  deliveries = signal<NotificationDeliveryDto[]>([]);
  unreadCount = signal<number>(0);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadNotifications();
    if (this.auth.hasPermission('Notifications.Manage')) {
      this.loadDeliveries();
    }
  }

  loadNotifications(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getNotifications(this.unreadOnly(), 50).subscribe({
      next: (data) => {
        this.notifications.set(data);
        this.loading.set(false);
        this.updateUnreadCount();
      },
      error: () => {
        this.errorMessage.set(
          this.i18n.language() === 'en' ? 'Failed to load notifications.' : 'تعذر تحميل الإشعارات.',
        );
        this.loading.set(false);
      },
    });
  }

  loadDeliveries(): void {
    this.api.getDeliveries(50).subscribe({
      next: (data) => this.deliveries.set(data),
      error: () => {},
    });
  }

  updateUnreadCount(): void {
    this.api.getUnreadCount().subscribe({
      next: (res) => this.unreadCount.set(res.count),
      error: () => {},
    });
  }

  setTab(tab: 'inbox' | 'deliveries'): void {
    this.activeTab.set(tab);
  }

  toggleUnreadFilter(): void {
    this.unreadOnly.set(!this.unreadOnly());
    this.loadNotifications();
  }

  markAsRead(id: string): void {
    this.api.markAsRead(id).subscribe({
      next: () => {
        this.notifications.update((list) =>
          list.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
        );
        this.updateUnreadCount();
      },
    });
  }

  markAllAsRead(): void {
    this.api.markAllAsRead().subscribe({
      next: () => {
        this.notifications.update((list) => list.map((item) => ({ ...item, isRead: true })));
        this.unreadCount.set(0);
      },
    });
  }
}
