import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  NotificationsApiService,
  InAppNotificationDto,
  NotificationDeliveryDto,
  NotificationPreferenceDto,
  NotificationChannelStatusDto,
  NotificationTemplateDto,
} from '../../core/notifications-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  styleUrl: './notifications-page.component.scss',
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-page.component.html',
})
export class NotificationsPageComponent implements OnInit {
  readonly i18n = inject(LocalizationService);
  readonly auth = inject(AuthService);
  private readonly api = inject(NotificationsApiService);

  activeTab = signal<'inbox' | 'deliveries' | 'settings'>('inbox');
  unreadOnly = signal<boolean>(false);
  loading = signal<boolean>(true);
  notifications = signal<InAppNotificationDto[]>([]);
  deliveries = signal<NotificationDeliveryDto[]>([]);
  unreadCount = signal<number>(0);
  errorMessage = signal<string | null>(null);
  statusMessage = signal<string | null>(null);
  preferences = signal<NotificationPreferenceDto[]>([]);
  channels = signal<NotificationChannelStatusDto[]>([]);
  templates = signal<NotificationTemplateDto[]>([]);
  selectedTemplate = signal<string>('BookingCreated');
  templateSubject = signal<string>('');
  templateBody = signal<string>('');
  templateActive = signal<boolean>(true);
  savingTemplate = signal<boolean>(false);
  savingEvent = signal<string | null>(null);
  readonly eventOptions = [
    { eventType: 'BookingCreated', channel: 4, en: 'New online booking', ar: 'حجز جديد من الموقع' },
    { eventType: 'BookingInquiry', channel: 4, en: 'New booking inquiry', ar: 'استفسار حجز جديد' },
    { eventType: 'BookingCancelled', channel: 4, en: 'Patient cancellation', ar: 'إلغاء الحجز من المريض' },
    { eventType: 'BookingRescheduled', channel: 4, en: 'Patient reschedule', ar: 'تغيير موعد الحجز' },
    { eventType: 'LabDue', channel: 4, en: 'Laboratory case due', ar: 'اقتراب موعد حالة المعمل' },
    { eventType: 'InsurancePending', channel: 4, en: 'Insurance approval pending', ar: 'موافقة تأمين معلقة' },
    { eventType: 'LowStock', channel: 4, en: 'Low inventory stock', ar: 'انخفاض المخزون' },
    { eventType: 'BookingCreated', channel: 1, en: 'Patient booking email', ar: 'بريد تأكيد الحجز للمريض' },
    { eventType: 'BookingReminder24h', channel: 1, en: '24-hour email reminder', ar: 'تذكير بالبريد قبل 24 ساعة' },
    { eventType: 'BookingReminder2h', channel: 1, en: '2-hour email reminder', ar: 'تذكير بالبريد قبل ساعتين' },
  ];

  ngOnInit(): void {
    this.loadNotifications();
    if (this.auth.hasPermission('Notifications.Manage')) {
      this.loadDeliveries();
      this.api.getChannels().subscribe({ next: (data) => this.channels.set(data) });
    }
    if (this.auth.hasPermission('Notifications.Preferences')) {
      this.loadPreferences();
    }
    if (this.auth.hasPermission('Notifications.Templates')) {
      this.api.getTemplates().subscribe({ next: (data) => { this.templates.set(data); this.selectTemplate(this.selectedTemplate()); } });
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

  setTab(tab: 'inbox' | 'deliveries' | 'settings'): void {
    this.activeTab.set(tab);
  }

  loadPreferences(): void {
    this.api.getPreferences().subscribe({
      next: (data) => this.preferences.set(data),
      error: () => this.errorMessage.set(this.i18n.language() === 'en' ? 'Failed to load preferences.' : 'تعذر تحميل التفضيلات.'),
    });
  }

  isEnabled(eventType: string, channel: number): boolean {
    return this.preferences().find((item) => item.eventType === eventType && item.channel === channel)?.isEnabled ?? true;
  }

  setEnabled(eventType: string, channel: number, enabled: boolean): void {
    const key = `${eventType}:${channel}`;
    this.savingEvent.set(key);
    this.api.setPreference(eventType, channel, enabled).subscribe({
      next: () => {
        this.preferences.update((items) => [
          ...items.filter((item) => !(item.eventType === eventType && item.channel === channel)),
          { id: key, eventType, channel, isEnabled: enabled },
        ]);
        this.savingEvent.set(null);
      },
      error: () => {
        this.savingEvent.set(null);
        this.errorMessage.set(this.i18n.language() === 'en' ? 'Could not save preference.' : 'تعذر حفظ التفضيل.');
      },
    });
  }

  sendTest(): void {
    this.api.testInApp().subscribe({
      next: () => {
        this.statusMessage.set(this.i18n.language() === 'en' ? 'Test queued. Check your inbox shortly.' : 'تم وضع إشعار التجربة في قائمة الإرسال. راجع صندوق الإشعارات بعد قليل.');
        this.loadDeliveries();
      },
      error: () => this.errorMessage.set(this.i18n.language() === 'en' ? 'Could not queue test.' : 'تعذر إرسال إشعار التجربة.'),
    });
  }

  selectTemplate(eventType: string): void {
    this.selectedTemplate.set(eventType);
    const item = this.templates().find((template) => template.name === eventType && template.channel === 4 && template.language === 'en');
    this.templateSubject.set(item?.subject ?? '');
    this.templateBody.set(item?.body ?? '');
    this.templateActive.set(item?.isActive ?? true);
  }

  saveTemplate(): void {
    if (!this.templateBody().trim()) {
      this.errorMessage.set(this.i18n.language() === 'en' ? 'Template message is required.' : 'نص القالب مطلوب.');
      return;
    }
    this.savingTemplate.set(true);
    this.api.saveTemplate(this.selectedTemplate(), this.templateSubject(), this.templateBody(), this.templateActive()).subscribe({
      next: (result) => {
        this.templates.update((items) => [
          ...items.filter((item) => !(item.name === this.selectedTemplate() && item.channel === 4 && item.language === 'en')),
          { id: result.id, name: this.selectedTemplate(), channel: 4, language: 'en', subject: this.templateSubject(), body: this.templateBody(), isActive: this.templateActive(), createdAt: '', updatedAt: '' },
        ]);
        this.savingTemplate.set(false);
        this.statusMessage.set(this.i18n.language() === 'en' ? 'Template saved.' : 'تم حفظ القالب.');
      },
      error: () => {
        this.savingTemplate.set(false);
        this.errorMessage.set(this.i18n.language() === 'en' ? 'Could not save template.' : 'تعذر حفظ القالب.');
      },
    });
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

