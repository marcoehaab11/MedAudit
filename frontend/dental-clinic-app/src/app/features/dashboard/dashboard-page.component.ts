import { AppointmentIntakeActionsComponent } from '../appointments/appointment-intake-actions.component';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { afterNextRender, Component, ElementRef, HostListener, Injector, computed, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, Subscription } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import {
  AppointmentApiService,
  AppointmentDetails,
  AppointmentItem,
  AppointmentSearchResult,
  AvailabilitySlot,
} from '../appointments/appointment-api.service';
import { money } from '../finance/finance-ui';
import { AppointmentCardActionsComponent } from '../appointments/appointment-card-actions.component';
import { DoctorVisitQueueComponent } from './doctor-visit-queue.component';
import { BillingQueueComponent } from '../finance/billing-queue.component';
import { DoctorDues, FinanceApiService } from '../finance/finance-api.service';
import { appointmentStatus, appointmentType } from '../appointments/appointment-labels';
import { DoctorApiService, DoctorListItem } from '../doctors/doctor-api.service';
import { PatientApiService, PatientListItem } from '../patients/patient-api.service';
import { DashboardReport, ReportPeriod, ReportsApiService } from '../reports/reports-api.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    BillingQueueComponent,
    DoctorVisitQueueComponent,
    AppointmentCardActionsComponent,
    AppointmentIntakeActionsComponent,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly detailsPanel = viewChild<ElementRef<HTMLElement>>('detailsPanel');
  private detailsTrigger?: HTMLElement;
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly doctorApi = inject(DoctorApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly reportsApi = inject(ReportsApiService);

  private readonly financeApi = inject(FinanceApiService);
  readonly myDues = signal<DoctorDues | null>(null);
  readonly isDoctor = computed(
    () => this.auth.roles().includes('Doctor') || this.myDues() !== null,
  );
  readonly loading = signal(true);
  readonly appointmentsLoading = signal(false);
  readonly scheduleError = signal('');
  readonly upcomingUnavailable = signal(false);
  readonly patientsUnavailable = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');

  readonly displayName = this.auth.displayName;
  readonly upcomingAppointments = signal<AppointmentItem[]>([]);
  readonly recentPatients = signal<PatientListItem[]>([]);
  readonly dashboardReport = signal<DashboardReport | null>(null);
  readonly todayAppointments = signal<AppointmentSearchResult | null>(null);
  readonly waitingPatients = computed(() => {
    const items = this.todayAppointments()?.page.items;
    return items ? new Set(items.filter((item) => item.status === 3).map((item) => item.patientId)).size : null;
  });
  private scheduleRequest?: Subscription;
  private todayRequest?: Subscription;
  readonly totalPatientsCount = signal<number>(0);

  // Appointments schedule state matching AppointmentsPageComponent
  readonly selectedDate = signal<string>(this.iso(new Date()));
  readonly view = signal<'day' | 'week' | 'month'>('day');
  readonly doctorFilter = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly typeFilter = signal<string>('');

  readonly result = signal<AppointmentSearchResult | null>(null);
  readonly doctors = signal<DoctorListItem[]>([]);
  readonly appointmentActionPending = signal(false);
  readonly selected = signal<AppointmentDetails | null>(null);
  readonly rescheduleSlots = signal<AvailabilitySlot[]>([]);
  readonly rescheduleLoading = signal(false);
  readonly statuses = [1, 2, 3, 4, 5, 6, 7];
  readonly types = [1, 2, 3, 4, 5, 6];

  readonly rescheduleForm = this.fb.nonNullable.group({
    date: '',
    startTime: '',
    durationMinutes: 30,
  });

  readonly isToday = computed(() => {
    return this.selectedDate() === this.iso(new Date());
  });

  readonly scheduleRange = computed(() => {
    const date = this.parseDate(this.selectedDate());
    const year = date.getFullYear();
    const month = date.getMonth();
    if (this.view() === 'month') {
      return { from: this.iso(new Date(year, month, 1)), to: this.iso(new Date(year, month + 1, 0)) };
    }
    const lastDay = date.getDate() + (this.view() === 'week' ? 6 : 0);
    return { from: this.selectedDate(), to: this.iso(new Date(year, month, lastDay)) };
  });

  revenueCaption(): string {
    const report = this.dashboardReport();
    return report?.revenue === undefined ? '—' : money(report.revenue, report.currency, this.i18n.language());
  }

  patientInitials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join('');
  }

  duesCaption(): string {
    const dues = this.myDues();
    if (!dues) return '—';
    const balances = dues.byCurrency?.length
      ? dues.byCurrency
      : [{ total: dues.total, currency: dues.currency }];
    return balances.map((x) => money(x.total, x.currency, this.i18n.language())).join(' · ');
  }

  ngOnInit(): void {
    this.loadDashboardData();
    if (
      this.auth.hasPermission('Finance.View') &&
      (this.auth.roles().includes('Doctor') || this.auth.hasPermission('Examination.Edit'))
    )
      this.financeApi
        .myDues()
        .subscribe({ next: (value) => this.myDues.set(value), error: () => {} });
  }

  ngOnDestroy(): void {
    this.scheduleRequest?.unsubscribe();
    this.todayRequest?.unsubscribe();
  }

  @HostListener('window:focus')
  refreshScheduleOnFocus(): void {
    if (!this.loading() && !this.appointmentsLoading() && !this.appointmentActionPending()) {
      this.loadAppointments();
      this.loadTodayAppointments();
    }
  }

  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set('');
    this.upcomingUnavailable.set(false);
    this.patientsUnavailable.set(false);
    this.dashboardReport.set(null);
    this.loadTodayAppointments();

    const now = new Date();
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const nextWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

    const tomorrowStr = this.iso(tomorrowDate);
    const nextWeekStr = this.iso(nextWeekDate);

    const upcomingAppReq = this.appointmentApi
      .appointments({ from: tomorrowStr, to: nextWeekStr })
      .pipe(
        catchError(() => {
          this.upcomingUnavailable.set(true);
          return of({ page: { items: [], totalCount: 0 } });
        }),
      );

    const patientsReq = this.patientApi
      .patients({ search: '', status: '', gender: '', page: 1, sortBy: '1', descending: true })
      .pipe(
        catchError(() => {
          this.patientsUnavailable.set(true);
          return of({ items: [], totalCount: 0 });
        }),
      );

    const reportReq = this.auth.hasPermission('Reports.View')
      ? this.reportsApi.getDashboard({ period: ReportPeriod.Today }).pipe(catchError(() => of(null)))
      : of(null);

    const doctorsReq = this.auth.hasPermission('Doctors.View')
      ? this.doctorApi.doctors('', '1', '', 1).pipe(catchError(() => of({ items: [] })))
      : of({ items: [] });

    forkJoin({
      upcomingApp: upcomingAppReq,
      patients: patientsReq,
      report: reportReq,
      doctors: doctorsReq,
    }).subscribe({
      next: (res: any) => {
        this.loading.set(false);

        const upcomingItems: AppointmentItem[] = res.upcomingApp?.page?.items ?? [];
        upcomingItems.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
        this.upcomingAppointments.set(upcomingItems.slice(0, 5));

        this.recentPatients.set(res.patients?.items?.slice(0, 5) ?? []);
        this.totalPatientsCount.set(res.patients?.totalCount ?? 0);

        if (res.report) {
          this.dashboardReport.set(res.report);
        }
        if (res.doctors?.items) {
          this.doctors.set(res.doctors.items);
        }

        this.loadAppointments();
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          this.t(
            'Unable to load dashboard data. Please try again.',
            'تعذر تحميل بيانات لوحة التحكم. يرجى المحاولة مرة أخرى.',
          ),
        );
      },
    });
  }

  private loadTodayAppointments(): void {
    if (!this.auth.hasPermission('Appointments.View')) return;
    this.todayRequest?.unsubscribe();
    const today = this.iso(new Date());
    this.todayRequest = this.appointmentApi.appointments({ from: today, to: today })
      .pipe(catchError(() => of(null)))
      .subscribe((result) => this.todayAppointments.set(result));
  }

  loadAppointments(): void {
    if (!this.auth.hasPermission('Appointments.View')) return;
    this.scheduleRequest?.unsubscribe();
    this.appointmentsLoading.set(true);
    this.scheduleError.set('');
    this.scheduleRequest = this.appointmentApi
      .appointments({
        ...this.scheduleRange(),
        doctorProfileId: this.doctorFilter() || undefined,
        status: this.statusFilter() || undefined,
        type: this.typeFilter() || undefined,
      })
      .pipe(
        catchError(() => {
          this.scheduleError.set(
            this.t('Schedule could not be loaded.', 'تعذر تحميل جدول المواعيد.'),
          );
          return of(null);
        }),
      )
      .subscribe({
        next: (x) => {
          if (x) {
            x.page.items.sort((first, second) => Date.parse(first.startAt) - Date.parse(second.startAt));
          }
          this.result.set(x);
          this.appointmentsLoading.set(false);
          if (this.selected()) {
            const currentSelected = this.selected()!;
            const found = x?.page?.items?.find(
              (item: AppointmentItem) => item.id === currentSelected.id,
            );
            if (!found) {
              this.selected.set(null);
            }
          }
        },
        error: () => {
          this.appointmentsLoading.set(false);
        },
      });
  }

  setView(view: 'day' | 'week' | 'month') {
    this.view.set(view);
    this.loadAppointments();
  }

  selectToday() {
    this.view.set('day');
    this.selectedDate.set(this.iso(new Date()));
    this.loadAppointments();
  }

  selectTomorrow() {
    this.view.set('day');
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.selectedDate.set(this.iso(d));
    this.loadAppointments();
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
      this.loadAppointments();
    }
  }

  onDoctorChange(event: Event) {
    this.doctorFilter.set((event.target as HTMLSelectElement).value);
    this.loadAppointments();
  }

  onStatusChange(event: Event) {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.loadAppointments();
  }

  onTypeChange(event: Event) {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
    this.loadAppointments();
  }

  move(direction: number) {
    const d = this.parseDate(this.selectedDate());
    if (this.view() === 'month') {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    } else {
      d.setDate(d.getDate() + direction * (this.view() === 'day' ? 1 : 7));
    }
    this.selectedDate.set(this.iso(d));
    this.loadAppointments();
  }

  open(item: AppointmentItem, event: Event) {
    this.detailsTrigger = event.currentTarget as HTMLElement;
    this.appointmentApi.appointment(item.id).subscribe({
      next: (x) => {
        this.selected.set(x);
        this.focusDetails();
        this.rescheduleForm.setValue({
          date: this.localDate(x.startAt, x.timeZone),
          startTime: '',
          durationMinutes: x.durationMinutes,
        });
        this.loadRescheduleAvailability();
      },
      error: () => {
        this.selected.set(item as AppointmentDetails);
        this.focusDetails();
      },
    });
  }

  private focusDetails(): void {
    afterNextRender(() => this.detailsPanel()?.nativeElement.focus(), { injector: this.injector });
  }

  closeDetails(): void {
    this.selected.set(null);
    if (this.detailsTrigger?.isConnected) this.detailsTrigger.focus();
    this.detailsTrigger = undefined;
  }

  loadRescheduleAvailability() {
    if (!this.selected() || !this.rescheduleForm.controls.date.value) return;
    this.rescheduleForm.controls.startTime.setValue('');
    this.rescheduleLoading.set(true);
    this.appointmentApi
      .availability(
        this.selected()!.doctorProfileId,
        this.rescheduleForm.controls.date.value,
        this.rescheduleForm.controls.durationMinutes.value,
      )
      .subscribe({
        next: (slots) => {
          this.rescheduleSlots.set(slots);
          this.rescheduleLoading.set(false);
        },
        error: () => {
          this.rescheduleSlots.set([]);
          this.rescheduleLoading.set(false);
        },
      });
  }

  chooseRescheduleSlot(slot: AvailabilitySlot) {
    this.rescheduleForm.controls.startTime.setValue(slot.localStartTime);
  }

  action(actionType: 'confirm' | 'check-in' | 'start' | 'complete' | 'no-show') {
    if (!this.selected() || this.appointmentActionPending()) return;
    const id = this.selected()!.id;
    this.appointmentActionPending.set(true);
    this.appointmentApi.action(id, actionType).subscribe({
      next: () => {
        this.showTemporarySuccess(this.t('Appointment updated.', 'تم تحديث الموعد بنجاح.'));
        this.loadAppointments();
        this.loadTodayAppointments();
        this.appointmentApi.appointment(id).subscribe({
          next: (x) => {
            this.selected.set(x);
            this.appointmentActionPending.set(false);
          },
          error: () => {
            this.appointmentActionPending.set(false);
            this.error.set(
              this.t('Could not refresh appointment details.', 'تعذر تحديث بيانات الموعد.'),
            );
          },
        });
      },
      error: () => {
        this.appointmentActionPending.set(false);
        this.error.set(this.t('The appointment could not be updated.', 'تعذر تحديث الموعد.'));
      },
    });
  }

  cancel() {
    if (!this.selected()) return;
    const reason = prompt(this.t('Cancellation reason', 'سبب الإلغاء'));
    if (!reason || !confirm(this.t('Cancel this appointment?', 'هل تريد إلغاء هذا الموعد؟')))
      return;
    const id = this.selected()!.id;
    this.appointmentApi.cancel(id, reason).subscribe({
      next: () => {
        this.showTemporarySuccess(this.t('Appointment cancelled.', 'تم إلغاء الموعد.'));
        this.loadAppointments();
        this.loadTodayAppointments();
        this.selected.set(null);
      },
      error: () => this.error.set(this.t('Cancellation failed.', 'تعذر الإلغاء.')),
    });
  }

  reschedule() {
    if (!this.selected()) return;
    this.appointmentApi
      .reschedule(this.selected()!.id, this.rescheduleForm.getRawValue())
      .subscribe({
        next: () => {
          this.showTemporarySuccess(this.t('Appointment rescheduled.', 'تمت إعادة جدولة الموعد.'));
          const id = this.selected()!.id;
          this.loadAppointments();
          this.loadTodayAppointments();
          this.appointmentApi.appointment(id).subscribe((x) => this.selected.set(x));
        },
        error: (e: HttpErrorResponse) => {
          this.error.set(
            e.status === 409
              ? this.t(
                  'That slot was just booked. Choose another time.',
                  'تم حجز هذا الوقت للتو. اختر وقتًا آخر.',
                )
              : this.t('Rescheduling failed.', 'تعذرت إعادة الجدولة.'),
          );
          this.loadRescheduleAvailability();
          this.loadAppointments();
        },
      });
  }

  localDate(value: string, zone?: string): string {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: zone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(value));
      const part = (type: string) => parts.find((x) => x.type === type)!.value;
      return `${part('year')}-${part('month')}-${part('day')}`;
    } catch {
      const d = new Date(value);
      return this.iso(d);
    }
  }

  time(value: string, zone?: string): string {
    if (!value) return '—';
    try {
      return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
        timeZone: zone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(value));
    } catch {
      const d = new Date(value);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  dayLabel(day: string): string {
    if (!day) return '';
    try {
      const [y, m, d] = day.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(date);
    } catch {
      return day;
    }
  }

  statusLabel(x: number): string {
    return appointmentStatus(x, this.i18n.language());
  }

  typeLabel(x: number): string {
    return appointmentType(x, this.i18n.language());
  }

  formatShortDate(isoDate: string): string {
    if (!isoDate) return '—';
    const d = new Date(isoDate);
    const isAr = this.i18n.language() === 'ar';
    return d.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  formatTime(isoDate: string): string {
    return this.time(isoDate);
  }

  getStatusLabel(status: number): string {
    return this.statusLabel(status);
  }

  getTypeLabel(type: number): string {
    return this.typeLabel(type);
  }

  private iso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parseDate(x: string): Date {
    const [y, m, d] = x.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  private showTemporarySuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set('');
    }, 4000);
  }

  t(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
