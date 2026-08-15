import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { NotificationsPageComponent } from './notifications-page.component';
import { NotificationsApiService } from '../../core/notifications-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { of, throwError } from 'rxjs';

describe('NotificationsPageComponent', () => {
  let component: NotificationsPageComponent;
  let fixture: ComponentFixture<NotificationsPageComponent>;
  let apiMock: any;
  let authMock: any;

  beforeEach(async () => {
    apiMock = {
      getNotifications: vi.fn().mockReturnValue(
        of([
          {
            id: 'n1',
            title: 'Test Notification',
            body: 'Body text',
            type: 'General',
            isRead: false,
            readAt: null,
            relatedEntityType: null,
            relatedEntityId: null,
            createdAt: '2026-08-15T10:00:00Z',
          },
        ]),
      ),
      getUnreadCount: vi.fn().mockReturnValue(of({ count: 1 })),
      getDeliveries: vi.fn().mockReturnValue(of([])),
      markAsRead: vi.fn().mockReturnValue(of(void 0)),
      markAllAsRead: vi.fn().mockReturnValue(of({ count: 1 })),
    };

    authMock = {
      hasPermission: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [NotificationsPageComponent],
      providers: [
        { provide: NotificationsApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
        LocalizationService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load inbox notifications and unread count', () => {
    expect(component).toBeTruthy();
    expect(component.notifications().length).toBe(1);
    expect(component.unreadCount()).toBe(1);
  });

  it('supports marking a notification as read', () => {
    component.markAsRead('n1');
    expect(apiMock.markAsRead).toHaveBeenCalledWith('n1');
  });

  it('supports marking all notifications as read', () => {
    component.markAllAsRead();
    expect(apiMock.markAllAsRead).toHaveBeenCalled();
  });

  it('displays error state when api fails', () => {
    apiMock.getNotifications.mockReturnValue(throwError(() => new Error('API Error')));
    component.loadNotifications();
    expect(component.errorMessage()).toBeTruthy();
  });
});
