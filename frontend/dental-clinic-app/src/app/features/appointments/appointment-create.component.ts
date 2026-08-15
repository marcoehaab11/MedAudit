import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DoctorApiService, DoctorListItem } from '../doctors/doctor-api.service';
import { PatientApiService, PatientListItem } from '../patients/patient-api.service';
import { AppointmentApiService, AvailabilitySlot } from './appointment-api.service';
import { appointmentType } from './appointment-labels';

@Component({
  selector: 'app-appointment-create',
  imports: [ReactiveFormsModule, RouterLink],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Scheduling', 'الجدولة') }}</p>
        <h1>{{ t('New appointment', 'موعد جديد') }}</h1>
      </div>
      <a routerLink="/appointments">{{ t('Back to calendar', 'العودة للتقويم') }}</a>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <ol class="steps">
      <li [class.done]="form.controls.patientId.valid">{{ t('Patient', 'المريض') }}</li>
      <li [class.done]="form.controls.doctorProfileId.valid">{{ t('Doctor', 'الطبيب') }}</li>
      <li [class.done]="selectedSlot()">{{ t('Available time', 'الوقت المتاح') }}</li>
      <li>{{ t('Details', 'التفاصيل') }}</li>
    </ol>
    <form class="panel appointment-form" [formGroup]="form" (ngSubmit)="save()">
      <fieldset>
        <legend>1. {{ t('Choose patient', 'اختر المريض') }}</legend>
        <select formControlName="patientId">
          <option value="">{{ t('Select patient', 'اختر مريضًا') }}</option>
          @for (p of patients(); track p.id) {
            <option [value]="p.id">{{ p.fullName }} · {{ p.patientNumber }}</option>
          }
        </select>
      </fieldset>
      <fieldset>
        <legend>2. {{ t('Choose doctor', 'اختر الطبيب') }}</legend>
        <select formControlName="doctorProfileId" (change)="loadAvailability()">
          <option value="">{{ t('Select doctor', 'اختر طبيبًا') }}</option>
          @for (d of doctors(); track d.id) {
            <option [value]="d.id">{{ d.displayName }} · {{ d.specialization }}</option>
          }
        </select>
      </fieldset>
      <fieldset class="timing">
        <legend>3. {{ t('Date and duration', 'التاريخ والمدة') }}</legend>
        <label
          >{{ t('Date', 'التاريخ')
          }}<input type="date" formControlName="date" (change)="loadAvailability()" /></label
        ><label
          >{{ t('Duration', 'المدة')
          }}<select formControlName="durationMinutes" (change)="loadAvailability()">
            <option [ngValue]="30">30 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="60">60 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="90">90 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="120">120 {{ t('minutes', 'دقيقة') }}</option>
          </select></label
        >
      </fieldset>
      <fieldset>
        <legend>4. {{ t('Available slots', 'الأوقات المتاحة') }}</legend>
        @if (slotsLoading()) {
          <div class="state">{{ t('Checking availability…', 'جارٍ التحقق من المواعيد…') }}</div>
        } @else if (!form.controls.doctorProfileId.value) {
          <p class="muted">{{ t('Choose a doctor first.', 'اختر الطبيب أولًا.') }}</p>
        } @else if (!slots().length) {
          <div class="state">
            {{ t('No slots available for this date.', 'لا توجد أوقات متاحة في هذا التاريخ.') }}
          </div>
        } @else {
          <div class="slots" data-testid="availability-slots">
            @for (slot of slots(); track slot.startAt) {
              <button
                type="button"
                [class.selected]="selectedSlot()?.startAt === slot.startAt"
                (click)="selectedSlot.set(slot)"
              >
                {{ shortTime(slot.localStartTime) }}–{{ shortTime(slot.localEndTime) }}
              </button>
            }
          </div>
        }
      </fieldset>
      <fieldset>
        <legend>5. {{ t('Appointment details', 'تفاصيل الموعد') }}</legend>
        <label
          >{{ t('Type', 'النوع')
          }}<select formControlName="type">
            @for (x of types; track x) {
              <option [ngValue]="x">{{ typeLabel(x) }}</option>
            }
          </select></label
        ><label
          >{{ t('Notes', 'ملاحظات') }}<textarea formControlName="notes" maxlength="2000"></textarea>
        </label>
      </fieldset>
      <button class="primary" [disabled]="form.invalid || !selectedSlot() || saving()">
        {{ saving() ? t('Creating…', 'جارٍ الإنشاء…') : t('Confirm appointment', 'تأكيد الموعد') }}
      </button>
    </form>`,
  styleUrl: './appointments.scss',
})
export class AppointmentCreateComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly doctorApi = inject(DoctorApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly patients = signal<PatientListItem[]>([]);
  readonly doctors = signal<DoctorListItem[]>([]);
  readonly slots = signal<AvailabilitySlot[]>([]);
  readonly selectedSlot = signal<AvailabilitySlot | null>(null);
  readonly slotsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly types = [1, 2, 3, 4, 5, 6];
  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: ['', Validators.required],
    doctorProfileId: ['', Validators.required],
    date: [this.today(), Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(5)]],
    type: [3, Validators.required],
    notes: ['', [Validators.maxLength(2000)]],
  });
  constructor() {
    this.patientApi
      .patients({ search: '', status: '1', gender: '', page: 1, sortBy: 'name', descending: false })
      .subscribe((x) => this.patients.set(x.items));
    this.doctorApi.doctors('', '1', '', 1).subscribe((x) => this.doctors.set(x.items));
  }
  loadAvailability() {
    this.selectedSlot.set(null);
    const x = this.form.getRawValue();
    if (!x.doctorProfileId || !x.date) return;
    this.slotsLoading.set(true);
    this.api.availability(x.doctorProfileId, x.date, x.durationMinutes).subscribe({
      next: (s) => {
        this.slots.set(s);
        this.slotsLoading.set(false);
      },
      error: () => {
        this.error.set(this.t('Availability could not be loaded.', 'تعذر تحميل الأوقات المتاحة.'));
        this.slotsLoading.set(false);
      },
    });
  }
  save() {
    if (this.form.invalid || !this.selectedSlot()) return;
    this.saving.set(true);
    this.error.set('');
    const x = this.form.getRawValue();
    this.api
      .create({
        patientId: x.patientId,
        doctorProfileId: x.doctorProfileId,
        type: x.type,
        time: {
          date: x.date,
          startTime: this.selectedSlot()!.localStartTime,
          durationMinutes: x.durationMinutes,
        },
        notes: x.notes || undefined,
      })
      .subscribe({
        next: () =>
          this.router.navigate(['/appointments'], {
            state: { message: this.t('Appointment created.', 'تم إنشاء الموعد.') },
          }),
        error: (e: HttpErrorResponse) => {
          this.saving.set(false);
          if (e.status === 409) {
            this.error.set(
              this.t(
                'That slot was just booked. Availability has been refreshed.',
                'تم حجز هذا الوقت للتو. تم تحديث الأوقات المتاحة.',
              ),
            );
            this.loadAvailability();
          } else this.error.set(this.t('Appointment could not be created.', 'تعذر إنشاء الموعد.'));
        },
      });
  }
  shortTime(x: string) {
    return x.slice(0, 5);
  }
  typeLabel(x: number) {
    return appointmentType(x, this.i18n.language());
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
  private today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
