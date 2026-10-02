import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
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
import { appointmentStatus, appointmentType } from '../appointments/appointment-labels';
import { DoctorApiService, DoctorListItem } from '../doctors/doctor-api.service';
import { PatientApiService, PatientListItem } from '../patients/patient-api.service';
import { DashboardReport, ReportsApiService } from '../reports/reports-api.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardPageComponent implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(LocalizationService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly doctorApi = inject(DoctorApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly reportsApi = inject(ReportsApiService);

  readonly loading = signal(true);
  readonly appointmentsLoading = signal(false);
  readonly error = signal('');
  readonly successMessage = signal('');

  readonly displayName = this.auth.displayName;
  readonly upcomingAppointments = signal<AppointmentItem[]>([]);
  readonly recentPatients = signal<PatientListItem[]>([]);
  readonly dashboardReport = signal<DashboardReport | null>(null);
  readonly totalPatientsCount = signal<number>(0);

  // Appointments schedule state matching AppointmentsPageComponent
  readonly selectedDate = signal<string>(this.iso(new Date()));
  readonly view = signal<'day' | 'week'>('day');
  readonly doctorFilter = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly typeFilter = signal<string>('');

  readonly result = signal<AppointmentSearchResult | null>(null);
  readonly doctors = signal<DoctorListItem[]>([]);
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

  readonly isTomorrow = computed(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.selectedDate() === this.iso(tomorrow);
  });

  readonly days = computed(() => {
    const start = this.parseDate(this.selectedDate());
    return Array.from({ length: this.view() === 'day' ? 1 : 7 }, (_, i) =>
      this.iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
    );
  });

  // Formatted date string for hero
  readonly formattedTodayDate = computed(() => {
    const now = new Date();
    const isAr = this.i18n.language() === 'ar';
    return now.toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  });

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {}

  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set('');

    const now = new Date();
    const tomorrowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const nextWeekDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7);

    const tomorrowStr = this.iso(tomorrowDate);
    const nextWeekStr = this.iso(nextWeekDate);

    const upcomingAppReq = this.appointmentApi
      .appointments({ from: tomorrowStr, to: nextWeekStr })
      .pipe(catchError(() => of({ page: { items: [], totalCount: 0 } })));

    const patientsReq = this.patientApi
      .patients({ search: '', status: '', gender: '', page: 1, sortBy: '1', descending: true })
      .pipe(catchError(() => of({ items: [], totalCount: 0 })));

    const reportReq = this.auth.hasPermission('Reports.View')
      ? this.reportsApi.getDashboard().pipe(catchError(() => of(null)))
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

  loadAppointments(): void {
    this.appointmentsLoading.set(true);
    const days = this.days();
    this.appointmentApi
      .appointments({
        from: days[0],
        to: days.at(-1)!,
        doctorProfileId: this.doctorFilter() || undefined,
        status: this.statusFilter() || undefined,
        type: this.typeFilter() || undefined,
      })
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: (x) => {
          this.result.set(x);
          this.appointmentsLoading.set(false);
          if (this.selected()) {
            const currentSelected = this.selected()!;
            const found = x?.page?.items?.find((item: AppointmentItem) => item.id === currentSelected.id);
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

  setView(view: 'day' | 'week') {
    this.view.set(view);
    this.loadAppointments();
  }

  selectToday() {
    this.selectedDate.set(this.iso(new Date()));
    this.loadAppointments();
  }

  selectTomorrow() {
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
    d.setDate(d.getDate() + direction * (this.view() === 'day' ? 1 : 7));
    this.selectedDate.set(this.iso(d));
    this.loadAppointments();
  }

  itemsFor(day: string) {
    return (
      this.result()?.page.items.filter((x) => this.localDate(x.startAt, x.timeZone) === day) ?? []
    );
  }

  open(item: AppointmentItem) {
    this.appointmentApi.appointment(item.id).subscribe({
      next: (x) => {
        this.selected.set(x);
        this.rescheduleForm.setValue({
          date: this.localDate(x.startAt, x.timeZone),
          startTime: '',
          durationMinutes: x.durationMinutes,
        });
        this.loadRescheduleAvailability();
      },
      error: () => {
        this.selected.set(item as any);
      },
    });
  }

  closeDetails(): void {
    this.selected.set(null);
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
    if (!this.selected()) return;
    const id = this.selected()!.id;
    this.appointmentApi.action(id, actionType).subscribe({
      next: () => {
        this.showTemporarySuccess(this.t('Appointment updated.', 'تم تحديث الموعد بنجاح.'));
        this.loadAppointments();
        this.appointmentApi.appointment(id).subscribe((x) => this.selected.set(x));
      },
      error: () =>
        this.error.set(this.t('The appointment could not be updated.', 'تعذر تحديث الموعد.')),
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
        this.selected.set(null);
      },
      error: () => this.error.set(this.t('Cancellation failed.', 'تعذر الإلغاء.')),
    });
  }

  reschedule() {
    if (!this.selected()) return;
    this.appointmentApi.reschedule(this.selected()!.id, this.rescheduleForm.getRawValue()).subscribe({
      next: () => {
        this.showTemporarySuccess(this.t('Appointment rescheduled.', 'تمت إعادة جدولة الموعد.'));
        const id = this.selected()!.id;
        this.loadAppointments();
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

