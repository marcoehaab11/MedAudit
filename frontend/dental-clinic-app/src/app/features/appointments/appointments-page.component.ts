import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { DoctorApiService, DoctorListItem } from '../doctors/doctor-api.service';
import {
  AppointmentApiService,
  AppointmentDetails,
  AppointmentItem,
  AppointmentSearchResult,
  AvailabilitySlot,
} from './appointment-api.service';
import { appointmentStatus, appointmentType } from './appointment-labels';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

@Component({
  styleUrl: './appointments.scss',
  selector: 'app-appointments-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinic schedule', 'جدول العيادة') }}</p>
        <h1>{{ t('Appointments', 'المواعيد') }}</h1>
      </div>
      @if (auth.hasPermission('Appointments.Create')) {
        <a class="button primary" routerLink="/appointments/create" [queryParams]="{ date: selectedDate() }">
          {{ t('New appointment', 'موعد جديد') }}
        </a>
      }
    </section>

    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <section class="panel calendar-toolbar">
      <div class="view-toggle">
        <button type="button" [class.active]="view() === 'day'" (click)="setView('day')">
          {{ t('Day', 'يوم') }}
        </button>
        <button type="button" [class.active]="view() === 'week'" (click)="setView('week')">
          {{ t('Week', 'أسبوع') }}
        </button>
      </div>

      <!-- Quick Day Shortcuts (اليوم / غداً) -->
      <div class="quick-day-shortcuts">
        <button type="button" class="btn-shortcut" [class.active]="isToday()" (click)="selectToday()">
          📅 {{ t('Today', 'اليوم') }}
        </button>
        <button type="button" class="btn-shortcut" [class.active]="isTomorrow()" (click)="selectTomorrow()">
          ☀️ {{ t('Tomorrow', 'غداً') }}
        </button>
      </div>

      <div class="date-nav">
        <button type="button" (click)="move(-1)" aria-label="Previous">‹</button>
        <input type="date" [value]="selectedDate()" (change)="onDateChange($event)" />
        <button type="button" (click)="move(1)" aria-label="Next">›</button>
      </div>

      <select [value]="doctorFilter()" (change)="onDoctorChange($event)">
        <option value="">{{ t('All doctors', 'كل الأطباء') }}</option>
        @for (d of doctors(); track d.id) {
          <option [value]="d.id">{{ d.displayName }}</option>
        }
      </select>

      <select [value]="statusFilter()" (change)="onStatusChange($event)">
        <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ statusLabel(s) }}</option>
        }
      </select>

      <select [value]="typeFilter()" (change)="onTypeChange($event)">
        <option value="">{{ t('All types', 'كل الأنواع') }}</option>
        @for (x of types; track x) {
          <option [value]="x">{{ typeLabel(x) }}</option>
        }
      </select>
    </section>

    <div class="calendar-layout">
      <section class="panel calendar" data-testid="appointment-calendar">
        @if (loading()) {
          <div class="state">{{ t('Loading schedule…', 'جارٍ تحميل الجدول…') }}</div>
        } @else if (!result()?.page?.items?.length) {
          <div class="state">
            <strong>{{ t('No appointments', 'لا توجد مواعيد') }}</strong>
            <p>
              {{ t('There are no appointments in this period.', 'لا توجد مواعيد في هذه الفترة.') }}
            </p>
            @if (auth.hasPermission('Appointments.Create')) {
              <a class="button primary" routerLink="/appointments/create" [queryParams]="{ date: selectedDate() }">
                + {{ t('Book for this date', 'حجز موعد لهذا اليوم') }}
              </a>
            }
          </div>
        } @else {
          @for (day of days(); track day) {
            <section class="calendar-day">
              <h2>{{ dayLabel(day) }}</h2>
              <div class="appointment-stack">
                @if (itemsFor(day).length === 0) {
                  <div class="empty-day-note">
                    {{ t('No appointments on this day', 'لا توجد مواعيد في هذا اليوم') }}
                  </div>
                } @else {
                  @for (item of itemsFor(day); track item.id) {
                    <button
                      type="button"
                      class="appointment-card status-{{ item.status }} type-{{ item.type }}"
                      (click)="open(item)"
                    >
                      <div class="card-time">
                        <span class="time-range">{{ time(item.startAt, item.timeZone) }} – {{ time(item.endAt, item.timeZone) }}</span>
                        <span class="duration-tag">{{ item.durationMinutes }} {{ t('min', 'د') }}</span>
                      </div>
                      <div class="card-info">
                        <div class="patient-line">
                          <strong class="patient-name">{{ item.patientName }}</strong>
                          <span class="type-badge type-badge-{{ item.type }}">
                            @if (item.type === 5) { 🚨 }
                            {{ typeLabel(item.type) }}
                          </span>
                        </div>
                        <div class="doctor-line">
                          <span class="doctor-name">👨‍⚕️ {{ item.doctorName }}</span>
                        </div>
                      </div>
                      <div class="card-status-col">
                        <span class="status-badge status-badge-{{ item.status }}">{{ statusLabel(item.status) }}</span>
                        @if (item.status <= 4 && auth.hasPermission('Examination.View')) {
                          <a
                            class="card-visit-link"
                            [routerLink]="['/appointments', item.id, 'visit']"
                            (click)="$event.stopPropagation()"
                            [title]="t('Open Clinical Visit Flow', 'بدء ومتابعة مراحل الزيارة')"
                          >
                            🦷 {{ t('Visit Flow', 'مراحل الزيارة') }}
                          </a>
                        }
                      </div>
                    </button>
                  }
                }
              </div>
            </section>
          }
        }
      </section>

      @if (selected()) {
        <aside class="panel details">
          <button class="close" type="button" (click)="selected.set(null)">×</button>
          <div class="details-header-badges">
            <span class="status-badge status-badge-{{ selected()!.status }}">{{ statusLabel(selected()!.status) }}</span>
            <span class="type-badge type-badge-{{ selected()!.type }}">
              @if (selected()!.type === 5) { 🚨 }
              {{ typeLabel(selected()!.type) }}
            </span>
          </div>
          <h2>{{ selected()!.patientName }}</h2>
          <dl>
            <div>
              <dt>{{ t('Doctor', 'الطبيب') }}</dt>
              <dd>{{ selected()!.doctorName }}</dd>
            </div>
            <div>
              <dt>{{ t('Time', 'الوقت') }}</dt>
              <dd>
                {{ dayLabel(localDate(selected()!.startAt, selected()!.timeZone)) }} ·
                {{ time(selected()!.startAt, selected()!.timeZone) }}
              </dd>
            </div>
            <div>
              <dt>{{ t('Duration', 'المدة') }}</dt>
              <dd>{{ selected()!.durationMinutes }} {{ t('minutes', 'دقيقة') }}</dd>
            </div>
            <div>
              <dt>{{ t('Type', 'النوع') }}</dt>
              <dd>
                <span class="type-badge type-badge-{{ selected()!.type }}">
                  @if (selected()!.type === 5) { 🚨 }
                  {{ typeLabel(selected()!.type) }}
                </span>
              </dd>
            </div>
          </dl>
          @if (selected()!.notes) {
            <p>{{ selected()!.notes }}</p>
          }
          <div class="actions">
            @if (selected()!.status <= 4 && auth.hasPermission('Examination.View')) {
              <a class="button primary visit-flow-btn" [routerLink]="['/appointments', selected()!.id, 'visit']">
                ✨ 🦷 {{ t('Open Clinical Visit Flow (5 Steps)', 'بدء ومتابعة مراحل الزيارة (5 خطوات)') }}
              </a>
            } @else if (selected()!.status === 5 && auth.hasPermission('Examination.View')) {
              <a class="button" [routerLink]="['/appointments', selected()!.id, 'examination']">
                🦷 {{ t('View Completed Examination', 'عرض سجل الفحص والزيارة') }}
              </a>
            }
            @if (auth.hasPermission('TreatmentPlans.Create')) {
              <a
                class="button"
                routerLink="/treatment-plans/create"
                [queryParams]="{
                  appointmentId: selected()!.id,
                  patientId: selected()!.patientId,
                  doctorProfileId: selected()!.doctorProfileId,
                }"
              >
                📋 {{ t('Create treatment plan', 'إنشاء خطة علاج') }}
              </a>
            }
            @if (auth.hasPermission('Prescriptions.Create')) {
              <a
                class="button"
                routerLink="/prescriptions/create"
                [queryParams]="{
                  appointmentId: selected()!.id,
                  patientId: selected()!.patientId,
                  doctorProfileId: selected()!.doctorProfileId,
                }"
              >
                💊 {{ t('Create prescription', 'إنشاء وصفة') }}
              </a>
            }
            @if (selected()!.status === 1 && auth.hasPermission('Appointments.Edit')) {
              <button (click)="action('confirm')">{{ t('Confirm', 'تأكيد') }}</button>
            }
            @if (selected()!.status === 2 && auth.hasPermission('Appointments.CheckIn')) {
              <button (click)="action('check-in')">{{ t('Check in', 'تسجيل الحضور') }}</button>
            }
            @if (selected()!.status === 3 && auth.hasPermission('Appointments.Start')) {
              <button (click)="action('start')">{{ t('Start', 'بدء') }}</button>
            }
            @if ((selected()!.status === 3 || selected()!.status === 4) && auth.hasPermission('Appointments.Complete')) {
              <button (click)="action('complete')">{{ t('Complete session', 'إنهاء الجلسة') }}</button>
            }
            @if (
              (selected()!.status === 1 || selected()!.status === 2) &&
              auth.hasPermission('Appointments.MarkNoShow')
            ) {
              <button (click)="action('no-show')">{{ t('No-show', 'لم يحضر') }}</button>
            }
            @if (selected()!.status <= 3 && auth.hasPermission('Appointments.Cancel')) {
              <button class="danger" (click)="cancel()">{{ t('Cancel', 'إلغاء') }}</button>
            }
          </div>
          @if (
            (selected()!.status === 1 || selected()!.status === 2) &&
            auth.hasPermission('Appointments.Edit')
          ) {
            <details>
              <summary>{{ t('Reschedule', 'إعادة الجدولة') }}</summary>
              <form [formGroup]="rescheduleForm" (ngSubmit)="reschedule()">
                <input
                  type="date"
                  formControlName="date"
                  (change)="loadRescheduleAvailability()"
                />
                <input
                  type="number"
                  min="5"
                  max="480"
                  formControlName="durationMinutes"
                  (change)="loadRescheduleAvailability()"
                />
                @if (rescheduleLoading()) {
                  <span>{{ t('Checking availability…', 'جارٍ التحقق من الأوقات…') }}</span>
                } @else {
                  <div class="slots">
                    @for (slot of rescheduleSlots(); track slot.startAt) {
                      <button
                        type="button"
                        [class.selected]="
                          rescheduleForm.controls.startTime.value === slot.localStartTime
                        "
                        (click)="chooseRescheduleSlot(slot)"
                      >
                        {{ slot.localStartTime.slice(0, 5) }}
                      </button>
                    }
                  </div>
                }
                <button [disabled]="!rescheduleForm.controls.startTime.value">
                  {{ t('Save new time', 'حفظ الوقت الجديد') }}
                </button>
              </form>
            </details>
          }
        </aside>
      }
    </div>
  `,
})
export class AppointmentsPageComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly doctorApi = inject(DoctorApiService);
  protected readonly auth = inject(AuthService);
  protected readonly confirmDialog = inject(ConfirmDialogService);
  readonly i18n = inject(LocalizationService);
  readonly fb = inject(FormBuilder);

  private readonly route = inject(ActivatedRoute);

  readonly selectedDate = signal<string>(this.iso(new Date()));
  readonly view = signal<'day' | 'week'>('day');
  readonly doctorFilter = signal<string>('');
  readonly statusFilter = signal<string>('');
  readonly typeFilter = signal<string>('');

  readonly result = signal<AppointmentSearchResult | null>(null);
  readonly doctors = signal<DoctorListItem[]>([]);
  readonly selected = signal<AppointmentDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
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

  constructor() {
    if (history.state?.message) this.message.set(history.state.message as string);
    const qDate = this.route.snapshot.queryParamMap.get('date');
    if (qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)) {
      this.selectedDate.set(qDate);
    }
    const qView = this.route.snapshot.queryParamMap.get('view');
    if (qView === 'day' || qView === 'week') {
      this.view.set(qView);
    }
    const qDoctor = this.route.snapshot.queryParamMap.get('doctorProfileId');
    if (qDoctor) {
      this.doctorFilter.set(qDoctor);
    }
    this.doctorApi.doctors('', '1', '', 1).subscribe((x) => this.doctors.set(x.items));
    this.load();

    this.route.queryParamMap.subscribe((params) => {
      const d = params.get('date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== this.selectedDate()) {
        this.selectedDate.set(d);
        this.load();
      }
    });
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    const days = this.days();
    this.api
      .appointments({
        from: days[0],
        to: days.at(-1)!,
        doctorProfileId: this.doctorFilter() || undefined,
        status: this.statusFilter() || undefined,
        type: this.typeFilter() || undefined,
      })
      .subscribe({
        next: (x) => {
          this.result.set(x);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.t('Schedule could not be loaded.', 'تعذر تحميل الجدول.'));
          this.loading.set(false);
        },
      });
  }

  setView(view: 'day' | 'week') {
    this.view.set(view);
    this.load();
  }

  selectToday() {
    this.selectedDate.set(this.iso(new Date()));
    this.load();
  }

  selectTomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    this.selectedDate.set(this.iso(d));
    this.load();
  }

  onDateChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.value) {
      this.selectedDate.set(input.value);
      this.load();
    }
  }

  onDoctorChange(event: Event) {
    this.doctorFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onStatusChange(event: Event) {
    this.statusFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  onTypeChange(event: Event) {
    this.typeFilter.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  move(direction: number) {
    const d = this.parseDate(this.selectedDate());
    d.setDate(d.getDate() + direction * (this.view() === 'day' ? 1 : 7));
    this.selectedDate.set(this.iso(d));
    this.load();
  }

  itemsFor(day: string) {
    return (
      this.result()?.page.items.filter((x) => this.localDate(x.startAt, x.timeZone) === day) ?? []
    );
  }

  open(item: AppointmentItem) {
    this.api.appointment(item.id).subscribe((x) => {
      this.selected.set(x);
      this.rescheduleForm.setValue({
        date: this.localDate(x.startAt, x.timeZone),
        startTime: '',
        durationMinutes: x.durationMinutes,
      });
      this.loadRescheduleAvailability();
    });
  }

  loadRescheduleAvailability() {
    if (!this.selected() || !this.rescheduleForm.controls.date.value) return;
    this.rescheduleForm.controls.startTime.setValue('');
    this.rescheduleLoading.set(true);
    this.api
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

  action(action: 'confirm' | 'check-in' | 'start' | 'complete' | 'no-show') {
    this.api.action(this.selected()!.id, action).subscribe({
      next: () => this.refresh(this.t('Appointment updated.', 'تم تحديث الموعد.')),
      error: () =>
        this.error.set(this.t('The appointment could not be updated.', 'تعذر تحديث الموعد.')),
    });
  }

  async cancel() {
    const reason = prompt(this.t('Cancellation reason', 'سبب الإلغاء'));
    if (!reason) return;

    const confirmed = await this.confirmDialog.ask({
      title: this.t('Cancel Appointment', 'إلغاء الموعد'),
      message: this.t('Are you sure you want to cancel this appointment?', 'هل تريد بالتأكيد إلغاء هذا الموعد الطبي؟'),
      confirmText: this.t('Yes, Cancel Appointment', 'نعم، إلغاء الموعد'),
      cancelText: this.t('Back', 'تراجع'),
      variant: 'danger',
      icon: '⚠️',
    });

    if (!confirmed) return;

    this.api.cancel(this.selected()!.id, reason).subscribe({
      next: () => this.refresh(this.t('Appointment cancelled.', 'تم إلغاء الموعد.')),
      error: () => this.error.set(this.t('Cancellation failed.', 'تعذر الإلغاء.')),
    });
  }

  reschedule() {
    this.api.reschedule(this.selected()!.id, this.rescheduleForm.getRawValue()).subscribe({
      next: () => this.refresh(this.t('Appointment rescheduled.', 'تمت إعادة جدولة الموعد.')),
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
        this.load();
      },
    });
  }

  private refresh(message: string) {
    this.message.set(message);
    const id = this.selected()!.id;
    this.load();
    this.api.appointment(id).subscribe((x) => this.selected.set(x));
  }

  localDate(value: string, zone: string) {
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

  time(value: string, zone: string) {
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

  dayLabel(day: string) {
    return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(this.parseDate(day));
  }

  statusLabel(x: number) {
    return appointmentStatus(x, this.i18n.language());
  }

  typeLabel(x: number) {
    return appointmentType(x, this.i18n.language());
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }

  private iso(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private parseDate(x: string) {
    const [y, m, d] = x.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}

