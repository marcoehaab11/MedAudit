import { AppointmentIntakeActionsComponent } from './appointment-intake-actions.component';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AppointmentCardActionsComponent } from './appointment-card-actions.component';
import { BillingQueueComponent } from '../finance/billing-queue.component';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { DoctorApiService, DoctorLookupItem } from '../doctors/doctor-api.service';
import {
  AppointmentApiService,
  AppointmentDetails,
  AppointmentItem,
  AppointmentSearchResult,
  ClinicRoom,
  AvailabilitySlot,
} from './appointment-api.service';
import { Subscription } from 'rxjs';
import { appointmentStatus, appointmentType } from './appointment-labels';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';

@Component({
  styleUrls: ['./appointments.scss', './appointments-rooms.scss'],
  selector: 'app-appointments-page',
  standalone: true,
  imports: [
    AppointmentCardActionsComponent,
    AppointmentIntakeActionsComponent,
    BillingQueueComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  template: `
    <ng-template #statusIcon let-state>
      <svg class="room-status-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
        stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path [attr.d]="statusIconPath(state)" />
      </svg>
    </ng-template>
    <section class="workspace-page-head">
      <div>

        <h1>{{ t('Appointments', 'المواعيد') }}</h1>
        <p class="page-description">
          {{
            t('Review the schedule and manage each visit.', 'راجع جدول المواعيد وتابع كل زيارة.')
          }}
        </p>
      </div>
      <app-appointment-intake-actions [date]="selectedDate()"
        (appointmentCreated)="appointmentCreated()" (patientCreated)="patientCreated()" />
    </section>

    @if (message()) {
      <div class="alert success" role="status">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }

    <section
      class="panel calendar-toolbar workspace-filters"
      [attr.aria-label]="t('Schedule filters', 'عوامل تصفية الجدول')"
    >
      <div class="workspace-filter-field">
        <span>{{ t('Calendar view', 'عرض الجدول') }}</span>
        <div class="view-toggle" role="group" [attr.aria-label]="t('Calendar view', 'عرض الجدول')">
          <button
            type="button"
            [class.active]="view() === 'day'"
            [attr.aria-pressed]="view() === 'day'"
            (click)="setView('day')"
          >
            {{ t('Day', 'يوم') }}
          </button>
          <button
            type="button"
            [class.active]="view() === 'week'"
            [attr.aria-pressed]="view() === 'week'"
            (click)="setView('week')"
          >
            {{ t('Week', 'أسبوع') }}
          </button>
        </div>
      </div>

      <div class="workspace-filter-field schedule-date">
        <label for="schedule-date">{{ t('Schedule date', 'تاريخ الجدول') }}</label>
        <div class="date-nav">
          <button
            type="button"
            (click)="move(-1)"
            [attr.aria-label]="t('Previous period', 'الفترة السابقة')"
          >
            ‹
          </button>
          <input
            id="schedule-date"
            type="date"
            [value]="selectedDate()"
            (change)="onDateChange($event)"
          />
          <button
            type="button"
            (click)="move(1)"
            [attr.aria-label]="t('Next period', 'الفترة التالية')"
          >
            ›
          </button>
        </div>
      </div>
      <details class="schedule-filters">
        <summary>{{ t('Schedule filters', 'فلاتر المواعيد') }}</summary>
        <div class="schedule-filter-grid">
          <div class="workspace-filter-field">
            <span>{{ t('Jump to', 'انتقل إلى') }}</span>
            <div class="quick-day-shortcuts">
              <button
                type="button"
                class="btn-shortcut"
                [class.active]="isToday()"
                (click)="selectToday()"
              >
                {{ t('Today', 'اليوم') }}
              </button>
              <button
                type="button"
                class="btn-shortcut"
                [class.active]="isTomorrow()"
                (click)="selectTomorrow()"
              >
                {{ t('Tomorrow', 'غداً') }}
              </button>
            </div>
          </div>
          <label class="workspace-filter-field">
            <span>{{ t('Doctor', 'الطبيب') }}</span>
            <select [value]="doctorFilter()" (change)="onDoctorChange($event)">
              <option value="">{{ t('All doctors', 'كل الأطباء') }}</option>
              @for (d of doctors(); track d.id) {
                <option [value]="d.id">{{ d.displayName }}</option>
              }
            </select>
          </label>

          <label class="workspace-filter-field">
            <span>{{ t('Status', 'الحالة') }}</span>
            <select [value]="statusFilter()" (change)="onStatusChange($event)">
              <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
              @for (s of statuses; track s) {
                <option [value]="s">{{ statusLabel(s) }}</option>
              }
            </select>
          </label>

          <label class="workspace-filter-field">
            <span>{{ t('Visit type', 'نوع الزيارة') }}</span>
            <select [value]="typeFilter()" (change)="onTypeChange($event)">
              <option value="">{{ t('All types', 'كل الأنواع') }}</option>
              @for (x of types; track x) {
                <option [value]="x">{{ typeLabel(x) }}</option>
              }
            </select>
          </label>
        </div>
      </details>
    </section>

    <div class="calendar-layout" [class.has-details]="selected()">
      <section
        class="panel calendar workspace-results"
        data-testid="appointment-calendar"
        [attr.aria-busy]="loading()"
      >
        @if (loading()) {
          <div class="state" role="status">{{ t('Loading schedule…', 'جارٍ تحميل الجدول…') }}</div>
        } @else if (result()) {
          @if (view() === 'day') {
            @if (roomLoadFailed()) { <p role="alert">{{ t('Could not load clinic rooms.', 'تعذر تحميل غرف العيادة.') }}</p> }
            <div class="room-schedule">
              @for (room of roomSchedule(); track room.id) {
                <section class="room-column" [class.dense]="room.items.length >= 5" [class.compact]="room.items.length >= 9">
                  <h2>{{ room.name }}</h2>
                  <div class="room-appointments">
                    @for (item of room.items; track item.id) {
                      <button class="room-card" type="button" [attr.data-state]="attendanceColor(item.status)" (click)="open(item)">
                        <time><bdi>{{ time(item.startAt, item.timeZone) }}</bdi></time>
                        <span class="room-card-info">
                          <strong><bdi>{{ item.patientName }}</bdi></strong>
                          <span><bdi>{{ item.doctorName }}</bdi></span>
                          <span>{{ typeLabel(item.type) }}</span>
                        </span>
                        <span class="room-card-states">
                          @let booking = confirmationState(item);
                          <span class="room-badge" [attr.data-state]="booking">
                            <ng-container *ngTemplateOutlet="statusIcon; context: { $implicit: booking }" />{{ confirmationLabel(booking) }}
                          </span>
                          @if (item.status >= 3) {
                            <span class="room-badge" [attr.data-state]="attendanceColor(item.status)">
                              <ng-container *ngTemplateOutlet="statusIcon; context: { $implicit: attendanceColor(item.status) }" />{{ attendanceLabel(item.status) }}
                            </span>
                          }
                        </span>
                      </button>
                    } @empty {
                      <p class="empty-day-note">{{ t('No appointments', 'لا توجد مواعيد') }}</p>
                    }
                  </div>
                </section>
              }
            </div>
            <ul class="room-legend" role="list" [attr.aria-label]="t('Appointment status legend', 'مفتاح ألوان المواعيد')">
              @for (state of legend; track state.color) {
                <li class="room-badge" [attr.data-state]="state.color"><ng-container *ngTemplateOutlet="statusIcon; context: { $implicit: state.color }" />{{ t(state.en, state.ar) }}</li>
              }
            </ul>
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
                          <span class="time-range"
                            >{{ time(item.startAt, item.timeZone) }} –
                            {{ time(item.endAt, item.timeZone) }}</span
                          >
                          <span class="duration-tag"
                            >{{ item.durationMinutes }} {{ t('min', 'د') }}</span
                          >
                        </div>
                        <div class="card-info">
                          <div class="patient-line">
                            <strong class="patient-name">{{ item.patientName }}</strong>
                            <span class="type-badge type-badge-{{ item.type }}">
                              @if (item.type === 5) {
                                🚨
                              }
                              {{ typeLabel(item.type) }}
                            </span>
                          </div>
                          <div class="doctor-line">
                            <span class="doctor-name">👨‍⚕️ {{ item.doctorName }}</span>
                          </div>
                        </div>
                        <div class="card-status-col">
                          <span class="status-badge status-badge-{{ item.status }}">{{
                            statusLabel(item.status)
                          }}</span>
                          @if (
                            (item.status === 3 || item.status === 4) &&
                            auth.hasPermission('Examination.View')
                          ) {
                            <a
                              class="card-visit-link"
                              [routerLink]="['/appointments', item.id, 'visit']"
                              (click)="$event.stopPropagation()"
                              [title]="
                                item.status === 4
                                  ? t('Continue visit', 'متابعة الزيارة')
                                  : t('Open visit', 'فتح الزيارة')
                              "
                            >
                              🦷
                              {{
                                item.status === 4
                                  ? t('Continue visit', 'متابعة الزيارة')
                                  : t('Open visit', 'فتح الزيارة')
                              }}
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
        }
      </section>

      @if (selected()) {
        <aside class="panel details">
          <button class="close" type="button" (click)="selected.set(null)">×</button>
          <div class="details-header-badges">
            <span class="status-badge status-badge-{{ selected()!.status }}">{{
              statusLabel(selected()!.status)
            }}</span>
            <span class="type-badge type-badge-{{ selected()!.type }}">
              @if (selected()!.type === 5) {
                🚨
              }
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
                  @if (selected()!.type === 5) {
                    🚨
                  }
                  {{ typeLabel(selected()!.type) }}
                </span>
              </dd>
            </div>
          </dl>
          @if (selected()!.notes) {
            <p>{{ selected()!.notes }}</p>
          }
          @if (rooms().length && auth.hasPermission('Appointments.Edit') && ![5, 6, 7].includes(selected()!.status)) {
            <div class="room-edit">
              <label class="workspace-filter-field"><span>{{ t('Room', 'الغرفة') }}</span>
                <select #roomSelect [value]="selected()!.roomId ?? ''">
                  <option value="">{{ t('No room assigned', 'بدون غرفة محددة') }}</option>
                  @for (room of rooms(); track room.id) { <option [value]="room.id">{{ room.name }}</option> }
                </select>
              </label>
              <button class="button" type="button" [disabled]="appointmentActionPending()"
                (click)="assignRoom(roomSelect.value)">{{ t('Save room', 'حفظ الغرفة') }}</button>
            </div>
          }
          <app-appointment-card-actions
            [appointment]="selected()!"
            [busy]="appointmentActionPending()"
            (action)="action($event)"
            (cancel)="cancel()"
          />
          @if (
            auth.hasPermission('TreatmentPlans.Create') ||
            auth.hasPermission('Prescriptions.Create')
          ) {
            <details>
              <summary>{{ t('Clinical tools', 'أدوات الزيارة') }}</summary>
              <div class="actions">
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
              </div>
            </details>
          }
          @if (
            (selected()!.status === 1 || selected()!.status === 2) &&
            auth.hasPermission('Appointments.Edit')
          ) {
            <details>
              <summary>{{ t('Reschedule', 'إعادة الجدولة') }}</summary>
              <form [formGroup]="rescheduleForm" (ngSubmit)="reschedule()">
                <input type="date" formControlName="date" (change)="loadRescheduleAvailability()" />
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
    @if (auth.hasPermission('Finance.Revenue.View')) {
      <app-billing-queue />
    }
  `,
})
export class AppointmentsPageComponent {
  private calendarRequest?: Subscription;
  ngOnDestroy() {
    this.calendarRequest?.unsubscribe();
  }
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
  readonly doctors = signal<DoctorLookupItem[]>([]);
  readonly appointmentActionPending = signal(false);
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
    this.doctorApi.listAll().subscribe({
      next: (items) => this.doctors.set(items),
      error: () =>
        this.error.set(this.t('Doctors could not be loaded.', 'تعذر تحميل أسماء الأطباء.')),
    });
    this.api.rooms().subscribe({
      next: rooms => this.rooms.set(rooms),
      error: () => this.roomLoadFailed.set(true),
    });
    this.load();

    this.route.queryParamMap.subscribe((params) => {
      const d = params.get('date');
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== this.selectedDate()) {
        this.selectedDate.set(d);
        this.load();
      }
    });
  }

  load(preserveSelection = false, quiet = false) {
    this.calendarRequest?.unsubscribe();
    if (!preserveSelection) this.selected.set(null);
    if (!quiet) this.loading.set(true);
    this.error.set('');
    const days = this.days();
    this.calendarRequest = this.api
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
      this.result()?.page.items.filter(
        (x) =>
          this.localDate(x.startAt, x.timeZone) <= day &&
          this.localDate(x.endAt, x.timeZone) >= day &&
          (this.localDate(x.endAt, x.timeZone) !== day ||
            this.minuteOfDay(x.endAt, x.timeZone) > 0),
      ) ?? []
    );
  }

  minuteOfDay(value: string, zone: string) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(value));
    return Number(parts.find(p => p.type === 'hour')?.value) * 60 +
      Number(parts.find(p => p.type === 'minute')?.value);
  }

  readonly rooms = signal<ClinicRoom[]>([]);
  readonly roomLoadFailed = signal(false);
  readonly roomSchedule = computed(() => {
    const items = [...this.itemsFor(this.selectedDate())].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
    const known = new Set(this.rooms().map(room => room.id));
    const columns = this.rooms().map(room => ({ ...room, items: items.filter(item => item.roomId === room.id) }));
    const unassigned = items.filter(item => !item.roomId || !known.has(item.roomId));
    if (!columns.length || unassigned.length) {
      columns.push({ id: '', name: this.t('No room assigned', 'بدون غرفة محددة'), items: unassigned });
    }
    return columns;
  });
  readonly legend = [
    { color: 'unconfirmed', en: 'Unconfirmed', ar: 'غير مؤكد' },
    { color: 'confirmed', en: 'Confirmed', ar: 'مؤكد' },
    { color: 'attended', en: 'Attended', ar: 'حضر' },
    { color: 'no-show', en: 'No show', ar: 'لم يحضر' },
    { color: 'cancelled', en: 'Cancelled', ar: 'ملغي' },
  ];

  confirmationState(item: AppointmentItem): 'confirmed' | 'unconfirmed' {
    return item.status === 2 || item.confirmedAt ? 'confirmed' : 'unconfirmed';
  }

  confirmationLabel(state: 'confirmed' | 'unconfirmed'): string {
    return state === 'confirmed' ? this.t('Confirmed', 'مؤكد') : this.t('Unconfirmed', 'غير مؤكد');
  }

  statusIconPath(state: string): string {
    return ({
      unconfirmed: 'M8 3v5l3 2M8 1a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
      confirmed: 'm4.5 8 2 2 5-5M8 1a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
      attended: 'm3 8 3 3 7-7',
      'no-show': 'm5 5 6 6m0-6-6 6M8 1a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
      cancelled: 'm3 3 10 10M8 1a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z',
    } as Record<string, string>)[state] ?? '';
  }

  attendanceColor(status: number): string {
    return ({ 1: 'unconfirmed', 2: 'confirmed', 6: 'cancelled', 7: 'no-show' } as Record<number, string>)[status] ?? 'attended';
  }

  attendanceLabel(status: number): string {
    if (status === 6) return this.t('Cancelled', 'ملغي');
    if (status === 7) return this.t('No show', 'لم يحضر');
    return this.t('Attended', 'حضر');
  }

  @HostListener('window:focus')
  refreshOnFocus(): void {
    if (!this.loading() && !this.appointmentActionPending()) this.load(true, true);
  }

  assignRoom(roomId: string): void {
    const item = this.selected();
    if (!item || this.appointmentActionPending() || (item.roomId ?? '') === roomId) return;
    this.appointmentActionPending.set(true);
    this.api.assignRoom(item.id, roomId || null).subscribe({
      next: () => {
        if (this.selected()?.id === item.id) this.selected.set({ ...item, roomId: roomId || undefined });
        this.appointmentActionPending.set(false);
        this.load(true, true);
      },
      error: () => {
        this.appointmentActionPending.set(false);
        this.error.set(this.t('Could not assign the room. It may already be in use.', 'تعذر تعيين الغرفة. قد تكون مشغولة في هذا الوقت.'));
      },
    });
  }

  appointmentCreated(): void {
    this.message.set(this.t('Appointment created.', 'تم إنشاء الموعد.'));
    this.load(true, true);
  }

  patientCreated(): void {
    this.message.set(this.t('Patient saved successfully.', 'تم حفظ المريض بنجاح.'));
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
    if (!this.selected() || this.appointmentActionPending()) return;
    this.appointmentActionPending.set(true);
    this.api.action(this.selected()!.id, action).subscribe({
      next: () => this.refresh(this.t('Appointment updated.', 'تم تحديث الموعد.')),
      error: () => {
        this.appointmentActionPending.set(false);
        this.error.set(this.t('The appointment could not be updated.', 'تعذر تحديث الموعد.'));
      },
    });
  }

  async cancel() {
    const reason = prompt(this.t('Cancellation reason', 'سبب الإلغاء'));
    if (!reason) return;

    const confirmed = await this.confirmDialog.ask({
      title: this.t('Cancel Appointment', 'إلغاء الموعد'),
      message: this.t(
        'Are you sure you want to cancel this appointment?',
        'هل تريد بالتأكيد إلغاء هذا الموعد الطبي؟',
      ),
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
    this.load(true);
    this.api.appointment(id).subscribe({
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
