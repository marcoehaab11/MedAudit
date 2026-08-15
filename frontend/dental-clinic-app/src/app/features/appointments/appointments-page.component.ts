import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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

@Component({
  selector: 'app-appointments-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinic schedule', 'جدول العيادة') }}</p>
        <h1>{{ t('Appointments', 'المواعيد') }}</h1>
      </div>
      @if (auth.hasPermission('Appointments.Create')) {
        <a class="button primary" routerLink="/appointments/create">{{
          t('New appointment', 'موعد جديد')
        }}</a>
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
          {{ t('Day', 'يوم') }}</button
        ><button type="button" [class.active]="view() === 'week'" (click)="setView('week')">
          {{ t('Week', 'أسبوع') }}
        </button>
      </div>
      <div class="date-nav">
        <button type="button" (click)="move(-1)" aria-label="Previous">‹</button
        ><input type="date" [formControl]="dateControl" (change)="load()" /><button
          type="button"
          (click)="move(1)"
          aria-label="Next"
        >
          ›
        </button>
      </div>
      <select [formControl]="doctorControl" (change)="load()">
        <option value="">{{ t('All doctors', 'كل الأطباء') }}</option>
        @for (d of doctors(); track d.id) {
          <option [value]="d.id">{{ d.displayName }}</option>
        }
      </select>
      <select [formControl]="statusControl" (change)="load()">
        <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
        @for (s of statuses; track s) {
          <option [value]="s">{{ statusLabel(s) }}</option>
        }
      </select>
      <select [formControl]="typeControl" (change)="load()">
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
          </div>
        } @else {
          @for (day of days(); track day) {
            <section class="calendar-day">
              <h2>{{ dayLabel(day) }}</h2>
              <div class="appointment-stack">
                @for (item of itemsFor(day); track item.id) {
                  <button
                    type="button"
                    class="appointment-card status-{{ item.status }}"
                    (click)="open(item)"
                  >
                    <time
                      >{{ time(item.startAt, item.timeZone) }}–{{
                        time(item.endAt, item.timeZone)
                      }}</time
                    ><strong>{{ item.patientName }}</strong
                    ><span>{{ item.doctorName }} · {{ typeLabel(item.type) }}</span
                    ><small>{{ statusLabel(item.status) }}</small>
                  </button>
                }
              </div>
            </section>
          }
        }
      </section>
      @if (selected()) {
        <aside class="panel details">
          <button class="close" type="button" (click)="selected.set(null)">×</button>
          <p class="eyebrow">{{ statusLabel(selected()!.status) }}</p>
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
              <dt>{{ t('Type', 'النوع') }}</dt>
              <dd>{{ typeLabel(selected()!.type) }}</dd>
            </div>
          </dl>
          @if (selected()!.notes) {
            <p>{{ selected()!.notes }}</p>
          }
          <div class="actions">
            @if (selected()!.status === 4 && auth.hasPermission('Examination.View')) {
              <a class="button" [routerLink]="['/appointments', selected()!.id, 'examination']">{{
                t('Open examination', 'فتح الفحص')
              }}</a>
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
                >{{ t('Create prescription', 'إنشاء وصفة') }}</a
              >
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
            @if (selected()!.status === 4 && auth.hasPermission('Appointments.Complete')) {
              <button (click)="action('complete')">{{ t('Complete', 'إكمال') }}</button>
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
                /><input
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
    </div>`,
  styleUrl: './appointments.scss',
})
export class AppointmentsPageComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly doctorApi = inject(DoctorApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly view = signal<'day' | 'week'>('day');
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
  private readonly fb = inject(FormBuilder);
  readonly dateControl = this.fb.nonNullable.control(this.iso(new Date()));
  readonly doctorControl = this.fb.nonNullable.control('');
  readonly statusControl = this.fb.nonNullable.control('');
  readonly typeControl = this.fb.nonNullable.control('');
  readonly rescheduleForm = this.fb.nonNullable.group({
    date: '',
    startTime: '',
    durationMinutes: 30,
  });
  readonly days = computed(() => {
    const start = this.parseDate(this.dateControl.value);
    return Array.from({ length: this.view() === 'day' ? 1 : 7 }, (_, i) =>
      this.iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)),
    );
  });
  constructor() {
    if (history.state?.message) this.message.set(history.state.message as string);
    this.doctorApi.doctors('', '1', '', 1).subscribe((x) => this.doctors.set(x.items));
    this.load();
  }
  load() {
    this.loading.set(true);
    this.error.set('');
    const days = this.days();
    this.api
      .appointments({
        from: days[0],
        to: days.at(-1)!,
        doctorProfileId: this.doctorControl.value,
        status: this.statusControl.value,
        type: this.typeControl.value,
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
  move(direction: number) {
    const d = this.parseDate(this.dateControl.value);
    d.setDate(d.getDate() + direction * (this.view() === 'day' ? 1 : 7));
    this.dateControl.setValue(this.iso(d));
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
  cancel() {
    const reason = prompt(this.t('Cancellation reason', 'سبب الإلغاء'));
    if (!reason || !confirm(this.t('Cancel this appointment?', 'هل تريد إلغاء هذا الموعد؟')))
      return;
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
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(value));
    const part = (type: string) => parts.find((x) => x.type === type)!.value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  time(value: string, zone: string) {
    return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(value));
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
