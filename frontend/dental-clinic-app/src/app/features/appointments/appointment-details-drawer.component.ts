import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, DestroyRef, ElementRef, inject, Injector, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { AppointmentApiService, AppointmentDetails, AppointmentItem, AvailabilitySlot, ClinicRoom } from './appointment-api.service';
import { AppointmentCardActionsComponent } from './appointment-card-actions.component';
import { appointmentBookingState, appointmentBookingStatus, appointmentType } from './appointment-labels';

@Component({
  selector: 'app-appointment-details-drawer',
  imports: [ReactiveFormsModule, RouterLink, WorkspaceDialogComponent, AppointmentCardActionsComponent],
  templateUrl: './appointment-details-drawer.component.html',
  styleUrl: './appointment-details-drawer.component.scss',
})
export class AppointmentDetailsDrawerComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = viewChild.required(WorkspaceDialogComponent);
  private readonly reschedulePanel = viewChild<ElementRef<HTMLDetailsElement>>('reschedulePanel');
  private detailsRequest?: Subscription;
  private availabilityRequest?: Subscription;
  protected readonly auth = inject(AuthService);
  readonly rooms = input<ClinicRoom[]>();
  readonly changed = output<string>();

  protected readonly selected = signal<AppointmentDetails | AppointmentItem | null>(null);
  protected readonly notes = signal<string | undefined>(undefined);
  protected readonly fetchedRooms = signal<ClinicRoom[] | undefined>(undefined);
  readonly busy = signal(false);
  protected readonly loadingDetails = signal(false);
  protected readonly error = signal('');
  protected readonly message = signal('');
  protected readonly cancelling = signal(false);
  protected readonly reason = this.fb.nonNullable.control('', Validators.required);
  protected readonly rescheduleSlots = signal<AvailabilitySlot[]>([]);
  protected readonly rescheduleLoading = signal(false);
  protected readonly availabilityError = signal(false);
  protected readonly rescheduleForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    startTime: ['', Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(5), Validators.max(480)]],
  });

  open(item: AppointmentItem): void {
    this.selected.set(item);
    this.error.set('');
    this.message.set('');
    this.notes.set(undefined);
    this.cancelling.set(false);
    this.reason.reset();
    this.resetRescheduleForm(item);
    this.loadDetails(item.id);
    if (!this.rooms() && !this.fetchedRooms() && this.auth.hasPermission('Appointments.Edit')) {
      this.api.rooms().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (rooms) => this.fetchedRooms.set(rooms),
        error: () => {},
      });
    }
    this.dialog().open();
  }

  protected closed(): void {
    this.detailsRequest?.unsubscribe();
    this.availabilityRequest?.unsubscribe();
    this.selected.set(null);
  }

  private loadDetails(id: string, afterSave = false): void {
    this.detailsRequest?.unsubscribe();
    this.loadingDetails.set(true);
    this.detailsRequest = this.api.appointment(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (item) => {
        const previous = this.selected();
        this.selected.set(item);
        this.notes.set(item.notes);
        if (previous?.startAt !== item.startAt || previous?.durationMinutes !== item.durationMinutes) {
          this.resetRescheduleForm(item);
        }
        this.loadingDetails.set(false);
        if (afterSave) this.focusDialog();
      },
      error: () => {
        this.loadingDetails.set(false);
        if (afterSave) this.selected.set(null);
        this.error.set(this.t('Could not load appointment details.', 'تعذر تحميل بيانات الموعد.'));
        if (afterSave) this.focusDialog();
      },
    });
  }

  private focusDialog(): void {
    afterNextRender(() => {
      if (this.selected() || this.error()) this.dialog().focusCloseButton();
    }, { injector: this.injector });
  }

  private resetRescheduleForm(item: AppointmentItem): void {
    this.availabilityRequest?.unsubscribe();
    this.rescheduleLoading.set(false);
    this.rescheduleSlots.set([]);
    this.availabilityError.set(false);
    this.rescheduleForm.reset({
      date: new Intl.DateTimeFormat('sv-SE', { timeZone: item.timeZone || 'UTC' }).format(new Date(item.startAt)),
      startTime: '',
      durationMinutes: item.durationMinutes,
    });
  }

  protected loadRescheduleAvailability(): void {
    this.availabilityRequest?.unsubscribe();
    const item = this.selected();
    const { date, durationMinutes, startTime } = this.rescheduleForm.controls;
    startTime.setValue('');
    this.rescheduleSlots.set([]);
    this.availabilityError.set(false);
    this.rescheduleLoading.set(false);
    if (!item || date.invalid || durationMinutes.invalid) return;
    this.rescheduleLoading.set(true);
    this.availabilityRequest = this.api.availability(item.doctorProfileId, date.value, durationMinutes.value, item.type === 5)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          this.rescheduleSlots.set(slots);
          this.rescheduleLoading.set(false);
        },
        error: () => {
          this.availabilityError.set(true);
          this.rescheduleLoading.set(false);
        },
      });
  }

  protected action(item: AppointmentItem, action: Parameters<AppointmentApiService['action']>[1]): void {
    this.save(item, () => this.api.action(item.id, action), this.t('Appointment updated.', 'تم تحديث الموعد.'),
      this.t('The appointment could not be updated.', 'تعذر تحديث الموعد.'));
  }

  protected cancel(item: AppointmentItem): void {
    const reason = this.reason.value.trim();
    if (!reason) return;
    this.save(item, () => this.api.cancel(item.id, reason), this.t('Appointment cancelled.', 'تم إلغاء الموعد.'),
      this.t('Cancellation failed.', 'تعذر الإلغاء.'));
  }

  protected assignRoom(item: AppointmentItem, roomId: string): void {
    if ((item.roomId ?? '') === roomId) return;
    this.save(item, () => this.api.assignRoom(item.id, roomId || null), this.t('Room updated.', 'تم تحديث الغرفة.'),
      this.t('Could not assign the room. It may already be in use.', 'تعذر تعيين الغرفة. قد تكون مشغولة في هذا الوقت.'));
  }

  protected reschedule(item: AppointmentItem): void {
    if (this.rescheduleForm.invalid || this.rescheduleLoading()) return;
    this.save(item, () => this.api.reschedule(item.id, this.rescheduleForm.getRawValue()),
      this.t('Appointment rescheduled.', 'تمت إعادة جدولة الموعد.'),
      this.t('Rescheduling failed.', 'تعذرت إعادة الجدولة.'), true);
  }

  private save(item: AppointmentItem, request: () => Observable<void>, success: string, failure: string, rescheduling = false): void {
    if (this.busy() || this.loadingDetails()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    request().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.cancelling.set(false);
        this.reason.reset();
        const panel = this.reschedulePanel()?.nativeElement;
        if (rescheduling && panel) panel.open = false;
        this.message.set(success);
        this.loadDetails(item.id, true);
        this.changed.emit(success);
        this.busy.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        if (rescheduling && error.status === 409) {
          this.error.set(this.t('That slot was just booked. Choose another time.', 'تم حجز هذا الوقت للتو. اختر وقتًا آخر.'));
          this.loadRescheduleAvailability();
          return;
        }
        this.error.set(failure);
      },
    });
  }

  protected status(item: AppointmentItem): string {
    return appointmentBookingStatus(item.status, this.i18n.language());
  }

  protected readonly state = appointmentBookingState;

  protected type(item: AppointmentItem): string {
    return appointmentType(item.type, this.i18n.language());
  }

  protected time(item: AppointmentItem): string {
    return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: item.timeZone || 'UTC',
      dateStyle: 'full',
      timeStyle: 'short',
      hour12: true,
    }).format(new Date(item.startAt));
  }

  protected t(en: string, ar: string): string {
    return this.i18n.language() === 'ar' ? ar : en;
  }
}
