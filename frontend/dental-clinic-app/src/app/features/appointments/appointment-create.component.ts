import { Component, DestroyRef, inject, OnInit, signal, computed, ViewChild } from "@angular/core";
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { combineLatest, debounceTime, distinctUntilChanged, firstValueFrom, startWith } from "rxjs";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { LocalizationService } from "../../core/localization.service";
import { parseApiError } from "../../core/error-util";
import { DoctorApiService, DoctorListItem } from "../doctors/doctor-api.service";
import { PatientApiService, PatientListItem } from "../patients/patient-api.service";
import { COMMON_ALLERGIES, COMMON_CONDITIONS, COMMON_MEDICATIONS } from "../patients/patient-form.component";
import { AppointmentApiService, AvailabilitySlot } from "./appointment-api.service";
import { appointmentType } from "./appointment-labels";
import { TreatmentApiService, TreatmentPlanList, Treatment } from "../treatments/treatment-api.service";

import { PatientSelectComponent } from "../../shared/patient-select.component";
import { DoctorSelectComponent } from "../../shared/doctor-select.component";
import { PhoneInputComponent } from "../../shared/phone-input/phone-input.component";
import { TagInputComponent } from "../../shared/tag-input/tag-input.component";
import { DateInputComponent } from "../../shared/date-input/date-input.component";

@Component({
  styleUrl: "./appointments.scss",
  selector: "app-appointment-create",
  imports: [FormsModule, ReactiveFormsModule, RouterLink, PatientSelectComponent, DoctorSelectComponent, PhoneInputComponent, TagInputComponent, DateInputComponent],
  template: `
    <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Scheduling', 'الجدولة') }}</p>
        <h1>{{ t('New appointment', 'موعد جديد') }}</h1>
      </div>
      <a class="button secondary" routerLink="/appointments">{{ t('Back to calendar', 'العودة للتقويم') }}</a>
    </section>

    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }

    <ol class="steps">
      <li [class.done]="form.controls.patientId.valid">1. {{ t('Patient', 'المريض') }}</li>
      <li [class.done]="form.controls.doctorProfileId.valid">2. {{ t('Doctor', 'الطبيب') }}</li>
      <li [class.done]="selectedSlot()">3. {{ t('Time slot', 'الوقت') }}</li>
      <li [class.done]="form.valid && selectedSlot()">4. {{ t('Confirm', 'التأكيد') }}</li>
    </ol>

    <form class="panel appointment-form" [formGroup]="form" (ngSubmit)="save()">
      <fieldset>
        <legend>1. {{ t('Choose patient', 'اختيار مريض') }} <strong class="req">*</strong></legend>
        <div>
          <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
            <app-patient-select
              #patientSelect
              style="flex: 1"
              formControlName="patientId"
              [allowClear]="false"
              [isInvalid]="form.controls.patientId.touched && form.controls.patientId.invalid"
            ></app-patient-select>
            <button type="button" class="button outline" (click)="openNewPatientModal()" style="white-space: nowrap;">
              + {{ t('New Patient', 'مريض جديد') }}
            </button>
          </div>
          @if (form.controls.patientId.touched && form.controls.patientId.invalid) {
            <span class="field-error" style="display: block; color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem;">
              {{ t('Please select a patient.', 'يرجى اختيار مريض.') }}
            </span>
          }

          @if (activeTreatmentPlans().length > 0 || activeTreatments().length > 0) {
            <div class="patient-ongoing-treatment-alert">
              <div class="alert-icon">📋</div>
              <div class="alert-content">
                <div class="alert-title-row">
                  <strong class="alert-title">
                    ⚠️ {{ t('Patient Has Ongoing Treatment / Incomplete Work!', 'تنبيه: المريض لديه خطة علاج جارية / عمل غير مكتمل!') }}
                  </strong>
                  <span class="alert-badge">{{ activeTreatmentPlans().length || activeTreatments().length }} {{ t('active item(s)', 'علاج نشط') }}</span>
                </div>
                <p class="alert-detail">
                  {{ t('Incomplete Treatment:', 'العمل والعلاج المتبقي:') }}
                  <span class="highlight-work">{{ remainingTreatmentsSummary() }}</span>
                </p>
                <div class="alert-btn-row">
                  @for (plan of activeTreatmentPlans(); track plan.id) {
                    <button type="button" class="btn-use-plan-reason" (click)="applyPlanToNotes(plan)">
                      ✓ {{ t('Set as Appointment Reason:', 'اعتماد كسبب للموعد:') }} {{ plan.title }}
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      </fieldset>

      <fieldset>
        <legend>2. {{ t('Choose doctor', 'اختيار طبيب') }} <strong class="req">*</strong></legend>
        <div>
          <app-doctor-select
            formControlName="doctorProfileId"
            [allowClear]="false"
            [isInvalid]="form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid"
          ></app-doctor-select>
          @if (form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid) {
            <span class="field-error" style="display: block; color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem;">
              {{ t('Please select a doctor.', 'يرجى اختيار طبيب.') }}
            </span>
          }
        </div>
      </fieldset>

      <fieldset class="timing">
        <legend>3. {{ t('Date and duration', 'التاريخ والمدة') }}</legend>
        <label>
          {{ t('Date', 'التاريخ') }}
          <input type="date" formControlName="date" />
        </label>
        <label>
          {{ t('Duration', 'المدة') }}
          <select formControlName="durationMinutes">
            <option [ngValue]="15">15 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="30">30 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="45">45 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="60">60 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="90">90 {{ t('minutes', 'دقيقة') }}</option>
            <option [ngValue]="120">120 {{ t('minutes', 'دقيقة') }}</option>
          </select>
        </label>
        <div class="emergency-toggle-wrap" style="grid-column: 1 / -1; margin-top: 0.5rem;">
          <label class="emergency-checkbox-label" style="display: inline-flex; align-items: center; gap: 0.65rem; padding: 0.5rem 0.85rem; border-radius: var(--radius-md); background: #fff5f5; border: 1.5px solid #fecdd3; cursor: pointer; color: #be123c; font-weight: 700; font-size: 0.88rem;">
            <input type="checkbox" formControlName="isEmergency" (change)="onEmergencyToggle()" style="width: 18px; height: 18px; cursor: pointer; accent-color: #e11d48; margin: 0;" />
            <span>🚨 {{ t('Emergency appointment (unlock all 24/7 hours)', 'حجز موعد طوارئ (فتح جميع الأوقات على مدار 24 ساعة)') }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="slots-fieldset">
        <legend class="slots-legend">
          <span>4. {{ t('Available slots', 'الأوقات المتاحة') }}</span>
          @if (slots().length > 0) {
            <span class="slots-total-pill">
              {{ slots().length }} {{ t('slots', 'موعد') }}
            </span>
          }
        </legend>

        @if (form.controls.isEmergency.value) {
          <div class="alert" style="background: #fff1f2; color: #9f1239; border-color: #fecdd3; font-weight: 600; font-size: 0.86rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🚨 {{ t('Emergency mode active: All 24-hour slots are unlocked for this day.', 'نمط الطوارئ مفعّل: تظهر جميع الأوقات على مدار الـ 24 ساعة لهذا اليوم.') }}</span>
          </div>
        }

        @if (slotsLoading()) {
          <div class="state-loading">
            <span class="loading-spinner" aria-hidden="true"></span>
            <span>{{ t('Checking availability…', 'جارٍ التحقق من المواعيد…') }}</span>
          </div>
        } @else if (!form.controls.doctorProfileId.value) {
          <div class="slots-empty-notice">
            <span class="empty-icon">👨‍⚕️</span>
            <p>{{ t('Please select a doctor to view available appointment slots.', 'يرجى اختيار الطبيب أولاً لعرض المواعيد المتاحة.') }}</p>
          </div>
        } @else if (!slots().length) {
          <div class="state-warning" style="display: flex; flex-direction: column; align-items: center; gap: 0.85rem; padding: 1.5rem; border-radius: var(--radius-md); background: #fff7ed; border: 1px solid #ffedd5; text-align: center;">
            <p style="margin: 0; color: #9a3412; font-weight: 600; font-size: 0.9rem;">
              {{
                t(
                  'No regular doctor working hours on this date.',
                  'لا توجد أوقات دوام مسجلة للطبيب المختار في هذا اليوم.'
                )
              }}
            </p>
            <button
              type="button"
              class="button primary"
              style="background: linear-gradient(135deg, #e11d48 0%, #be123c 100%); border: none; box-shadow: 0 4px 12px rgba(225, 29, 72, 0.3); font-weight: 700;"
              (click)="enableEmergency()"
            >
              🚨 {{ t('Unlock 24/7 Emergency Slots for this Date', 'فتح مواعيد الطوارئ على مدار اليوم لهذا التاريخ') }}
            </button>
          </div>
        } @else {
          <!-- Selected Slot Confirmation Banner -->
          @if (selectedSlot(); as sel) {
            <div class="selected-slot-banner">
              <div class="banner-badge">✓</div>
              <div class="banner-details">
                <div class="banner-title">{{ t('Selected Slot', 'الموعد المختار') }}</div>
                <div class="banner-time">
                  {{ formatSlotRange(sel) }}
                  <span class="banner-duration">({{ form.controls.durationMinutes.value }} {{ t('minutes', 'دقيقة') }})</span>
                </div>
              </div>
              <button
                type="button"
                class="banner-clear-btn"
                (click)="selectedSlot.set(null)"
                [title]="t('Choose another slot', 'اختيار وقت آخر')"
              >
                ✕ {{ t('Change', 'تغيير') }}
              </button>
            </div>
          }

          <!-- Toolbar: Period tabs + 12h/24h Toggle -->
          <div class="slots-toolbar">
            <div class="period-filter-tabs">
              <button
                type="button"
                class="period-tab"
                [class.active]="selectedPeriod() === 'all'"
                (click)="selectedPeriod.set('all')"
              >
                <span>{{ t('All Slots', 'جميع الأوقات') }}</span>
                <span class="tab-count">{{ slotPeriods().total }}</span>
              </button>

              @if (slotPeriods().morning.length > 0) {
                <button
                  type="button"
                  class="period-tab"
                  [class.active]="selectedPeriod() === 'morning'"
                  (click)="selectedPeriod.set('morning')"
                >
                  <span>🌅 {{ t('Morning', 'الصباح') }}</span>
                  <span class="tab-count">{{ slotPeriods().morning.length }}</span>
                </button>
              }

              @if (slotPeriods().afternoon.length > 0) {
                <button
                  type="button"
                  class="period-tab"
                  [class.active]="selectedPeriod() === 'afternoon'"
                  (click)="selectedPeriod.set('afternoon')"
                >
                  <span>☀️ {{ t('Afternoon', 'بعد الظهر') }}</span>
                  <span class="tab-count">{{ slotPeriods().afternoon.length }}</span>
                </button>
              }

              @if (slotPeriods().evening.length > 0) {
                <button
                  type="button"
                  class="period-tab"
                  [class.active]="selectedPeriod() === 'evening'"
                  (click)="selectedPeriod.set('evening')"
                >
                  <span>🌙 {{ t('Evening', 'المساء') }}</span>
                  <span class="tab-count">{{ slotPeriods().evening.length }}</span>
                </button>
              }

              @if (slotPeriods().night.length > 0) {
                <button
                  type="button"
                  class="period-tab"
                  [class.active]="selectedPeriod() === 'night'"
                  (click)="selectedPeriod.set('night')"
                >
                  <span>🌌 {{ t('Night', 'الليل') }}</span>
                  <span class="tab-count">{{ slotPeriods().night.length }}</span>
                </button>
              }
            </div>

            <div class="time-format-toggle" role="group">
              <button
                type="button"
                [class.active]="timeFormat() === '12h'"
                (click)="timeFormat.set('12h')"
              >
                12h
              </button>
              <button
                type="button"
                [class.active]="timeFormat() === '24h'"
                (click)="timeFormat.set('24h')"
              >
                24h
              </button>
            </div>
          </div>

          <!-- Grouped Period Sections & Slots -->
          <div class="slots-container" data-testid="availability-slots">
            @for (period of filteredPeriods(); track period.key) {
              <div class="period-section">
                <div class="period-section-header">
                  <div class="period-title-wrap">
                    <span class="period-icon">{{ period.icon }}</span>
                    <span class="period-name">{{ period.label }}</span>
                    <span class="period-range-note">({{ period.range }})</span>
                  </div>
                  <span class="period-badge">{{ period.slots.length }} {{ t('available', 'متاح') }}</span>
                </div>

                <div class="slot-cards-grid">
                  @for (slot of period.slots; track slot.startAt) {
                    <button
                      type="button"
                      class="slot-card"
                      [class.selected]="selectedSlot()?.startAt === slot.startAt"
                      (click)="selectedSlot.set(slot)"
                    >
                      <div class="slot-card-primary">
                        <span class="slot-time">{{ formatTime(slot.localStartTime) }}</span>
                        @if (selectedSlot()?.startAt === slot.startAt) {
                          <span class="slot-check-icon" aria-hidden="true">✓</span>
                        }
                      </div>
                      <div class="slot-card-secondary">
                        {{ t('to', 'إلى') }} {{ formatTime(slot.localEndTime) }}
                      </div>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        }
      </fieldset>

      <fieldset>
        <legend>5. {{ t('Appointment details', 'تفاصيل الموعد') }}</legend>
        <label>
          {{ t('Type', 'النوع') }}
          <select formControlName="type">
            @for (x of types; track x) {
              <option [ngValue]="x">{{ typeLabel(x) }}</option>
            }
          </select>
        </label>
        <label>
          {{ t('Notes', 'ملاحظات') }}
          <textarea formControlName="notes" maxlength="2000"></textarea>
        </label>
      </fieldset>

      @if (form.invalid && form.touched) {
        <div class="alert error">
          {{ t('Please complete all required steps and choose an appointment slot.', 'يرجى إكمال جميع الخطوات المطلوبة واختيار وقت الموعد.') }}
        </div>
      }

      <div class="form-actions">
        <a class="button" routerLink="/appointments">{{ t('Cancel', 'إلغاء') }}</a>
        <button class="primary" [disabled]="saving()">
          {{ saving() ? t('Creating…', 'جارٍ الإنشاء…') : t('Confirm appointment', 'تأكيد الموعد') }}
        </button>
      </div>
    </form>

    <!-- Quick Add Patient Modal -->
    @if (showNewPatientModal()) {
      <div class="modal-overlay" (click)="showNewPatientModal.set(false)">
        <div class="modal-content new-patient-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h2>{{ t('Quick Add Patient', 'إضافة مريض سريعاً') }}</h2>
            <button type="button" class="close-btn" (click)="showNewPatientModal.set(false)">&times;</button>
          </div>
          <div class="modal-body">
            @if (patientError()) {
              <div class="alert error">{{ patientError() }}</div>
            }
            <form [formGroup]="patientForm" (ngSubmit)="saveNewPatient()" class="quick-patient-form">
              <label>
                <span>{{ t('First name', 'الاسم الأول') }} <strong class="req">*</strong></span>
                <input formControlName="firstName" maxlength="100" />
              </label>
              <label>
                <span>{{ t('Second name (Middle)', 'الاسم الثاني (الأوسط)') }}</span>
                <input formControlName="middleName" maxlength="100" />
              </label>
              <label>
                <span>{{ t('Third name (Family)', 'الاسم الثالث (العائلة)') }} <strong class="req">*</strong></span>
                <input formControlName="lastName" maxlength="100" />
              </label>
              <label>
                <span>{{ t('Gender', 'النوع') }} <strong class="req">*</strong></span>
                <select formControlName="gender">
                  <option [ngValue]="1">{{ t('Female', 'أنثى') }}</option>
                  <option [ngValue]="2">{{ t('Male', 'ذكر') }}</option>
                </select>
              </label>
              <label>
                <span>{{ t('Date of birth', 'تاريخ الميلاد') }} <strong class="req">*</strong></span>
                <app-date-input
                  formControlName="dateOfBirth"
                  [max]="today()"
                  [isInvalid]="patientForm.controls.dateOfBirth.touched && patientForm.controls.dateOfBirth.invalid"
                ></app-date-input>
                @if (patientForm.controls.dateOfBirth.touched && patientForm.controls.dateOfBirth.invalid) {
                  <span class="field-error" style="display: block; color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Date of birth is required.', 'تاريخ الميلاد مطلوب.') }}
                  </span>
                }
              </label>
              <div style="grid-column: 1 / -1; display: flex; flex-direction: column; gap: 0.25rem;">
                <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">{{ t('Phone', 'رقم الهاتف') }} <strong class="req" style="color: #dc2626;">*</strong></span>
                <app-phone-input 
                  formControlName="phone" 
                  [placeholder]="t('e.g. +2010...', 'مثال: +2010...')"
                  [class.invalid]="patientForm.controls.phone.touched && patientForm.controls.phone.invalid"
                ></app-phone-input>
                @if (patientForm.controls.phone.touched && patientForm.controls.phone.errors?.['required']) {
                  <span class="field-error" style="display: block; color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Phone number is required.', 'رقم الهاتف مطلوب.') }}
                  </span>
                }
                @if (patientForm.controls.phone.touched && patientForm.controls.phone.errors?.['invalidPhone']) {
                  <span class="field-error" style="display: block; color: #dc2626; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Phone number is invalid.', 'رقم الهاتف غير صحيح.') }}
                  </span>
                }
              </div>

              <!-- Medical Alerts & Background Section -->
              <div class="medical-section-divider" style="grid-column: 1 / -1; margin-top: 0.25rem; padding-top: 0.75rem; border-top: 1.5px dashed #e2e8f0;">
                <h3 style="margin: 0 0 0.5rem; font-size: 0.92rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                  <span>🏥</span> {{ t('Medical Alerts & Health Background (Optional)', 'التنبيهات الطبية والتاريخ الصحي (اختياري)') }}
                </h3>
              </div>

              <label style="grid-column: 1 / -1;">
                <span style="display: flex; align-items: center; gap: 0.35rem; color: #dc2626; font-weight: 750;">
                  <span>⚠️</span> {{ t('Allergies & Sensitivities', 'الحساسية والتحسس') }}
                </span>
                <app-tag-input
                  [(tags)]="patientAllergies"
                  theme="danger"
                  [placeholder]="t('Type an allergy and press Enter, or choose below…', 'اكتب الحساسية واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="allergySuggestions"
                ></app-tag-input>
              </label>

              <label style="grid-column: 1 / -1;">
                <span style="display: flex; align-items: center; gap: 0.35rem; color: #d97706; font-weight: 750;">
                  <span>🩺</span> {{ t('Chronic Medical Conditions', 'الأمراض والحالات المزمنة') }}
                </span>
                <app-tag-input
                  [(tags)]="patientConditions"
                  theme="warning"
                  [placeholder]="t('Type a condition and press Enter, or choose below…', 'اكتب الحالة واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="conditionSuggestions"
                ></app-tag-input>
              </label>

              <label style="grid-column: 1 / -1;">
                <span style="display: flex; align-items: center; gap: 0.35rem; color: #0284c7; font-weight: 750;">
                  <span>💊</span> {{ t('Current Patient Medications', 'الأدوية والعلاجات الحالية') }}
                </span>
                <app-tag-input
                  [(tags)]="patientMedications"
                  theme="info"
                  [placeholder]="t('Type a medication and press Enter, or choose below…', 'اكتب الدواء واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="medicationSuggestions"
                ></app-tag-input>
              </label>

              <div class="form-actions" style="grid-column: 1 / -1; margin-top: 0.75rem;">
                <button type="button" class="button secondary" (click)="showNewPatientModal.set(false)">{{ t('Cancel', 'إلغاء') }}</button>
                <button type="submit" class="button primary" [disabled]="patientSaving()">
                  {{ patientSaving() ? t('Saving...', 'جاري الحفظ...') : t('Save Patient', 'حفظ المريض') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }
  `,
})
export class AppointmentCreateComponent implements OnInit {
  private readonly api = inject(AppointmentApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly doctorApi = inject(DoctorApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(LocalizationService);
  readonly patients = signal<PatientListItem[]>([]);
  readonly doctors = signal<DoctorListItem[]>([]);
  readonly slots = signal<AvailabilitySlot[]>([]);
  readonly selectedSlot = signal<AvailabilitySlot | null>(null);
  readonly timeFormat = signal<'12h' | '24h'>('12h');
  readonly selectedPeriod = signal<'all' | 'morning' | 'afternoon' | 'evening' | 'night'>('all');
  readonly patientsLoading = signal(true);

  getSlotPeriod(slot: AvailabilitySlot): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = parseInt(slot.localStartTime.slice(0, 2), 10);
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 24) return 'evening';
    return 'night';
  }

  readonly slotPeriods = computed(() => {
    const list = this.slots();
    const morning: AvailabilitySlot[] = [];
    const afternoon: AvailabilitySlot[] = [];
    const evening: AvailabilitySlot[] = [];
    const night: AvailabilitySlot[] = [];

    for (const s of list) {
      const p = this.getSlotPeriod(s);
      if (p === 'morning') morning.push(s);
      else if (p === 'afternoon') afternoon.push(s);
      else if (p === 'evening') evening.push(s);
      else night.push(s);
    }

    return {
      morning,
      afternoon,
      evening,
      night,
      total: list.length,
    };
  });

  readonly filteredPeriods = computed(() => {
    const p = this.slotPeriods();
    const filter = this.selectedPeriod();
    const groups: {
      key: 'morning' | 'afternoon' | 'evening' | 'night';
      label: string;
      icon: string;
      range: string;
      slots: AvailabilitySlot[];
    }[] = [
      {
        key: 'morning',
        label: this.t('Morning', 'الفترة الصباحية'),
        icon: '🌅',
        range: this.t('06:00 AM – 12:00 PM', '06:00 ص – 12:00 م'),
        slots: p.morning,
      },
      {
        key: 'afternoon',
        label: this.t('Afternoon', 'فترة بعد الظهر'),
        icon: '☀️',
        range: this.t('12:00 PM – 05:00 PM', '12:00 م – 05:00 م'),
        slots: p.afternoon,
      },
      {
        key: 'evening',
        label: this.t('Evening', 'الفترة المسائية'),
        icon: '🌙',
        range: this.t('05:00 PM – 12:00 AM', '05:00 م – 12:00 ص'),
        slots: p.evening,
      },
      {
        key: 'night',
        label: this.t('Late Night', 'الفترة الليلية'),
        icon: '🌌',
        range: this.t('12:00 AM – 06:00 AM', '12:00 ص – 06:00 ص'),
        slots: p.night,
      },
    ];

    return groups.filter((g) => g.slots.length > 0 && (filter === 'all' || filter === g.key));
  });
  readonly slotsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly types = [1, 2, 3, 4, 5, 6];
  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: ['', Validators.required],
    doctorProfileId: ['', Validators.required],
    date: [this.today(), Validators.required],
    durationMinutes: [30, [Validators.required, Validators.min(5)]],
    isEmergency: [false],
    type: [3, Validators.required],
    notes: ['', [Validators.maxLength(2000)]],
  });
  readonly showNewPatientModal = signal(false);
  readonly patientSaving = signal(false);
  readonly patientError = signal('');
  patientAllergies: string[] = [];
  patientConditions: string[] = [];
  patientMedications: string[] = [];
  readonly allergySuggestions = COMMON_ALLERGIES;
  readonly conditionSuggestions = COMMON_CONDITIONS;
  readonly medicationSuggestions = COMMON_MEDICATIONS;
  readonly patientForm = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    middleName: [''],
    lastName: ['', Validators.required],
    gender: [1, Validators.required],
    dateOfBirth: ['', Validators.required],
    phone: ['', Validators.required],
  });

  private readonly treatmentApi = inject(TreatmentApiService);

  readonly activeTreatmentPlans = signal<TreatmentPlanList[]>([]);
  readonly activeTreatments = signal<Treatment[]>([]);
  readonly loadingTreatments = signal(false);

  @ViewChild('patientSelect') patientSelectComp!: PatientSelectComponent;

  constructor() {
    const qDate = this.route.snapshot.queryParamMap.get('date');
    if (qDate) {
      this.form.controls.date.setValue(qDate);
    }
    const qDoctor = this.route.snapshot.queryParamMap.get('doctorProfileId');
    if (qDoctor) {
      this.form.controls.doctorProfileId.setValue(qDoctor);
    }
    const qPatient = this.route.snapshot.queryParamMap.get('patientId');
    if (qPatient) {
      this.form.controls.patientId.setValue(qPatient);
    }
    const qNotes = this.route.snapshot.queryParamMap.get('notes');
    if (qNotes) {
      this.form.controls.notes.setValue(qNotes);
    }
  }

  ngOnInit() {
    const fc = this.form.controls;
    // Auto-load availability when doctor, date, duration, or emergency mode changes
    combineLatest([
      fc.doctorProfileId.valueChanges.pipe(startWith(fc.doctorProfileId.value)),
      fc.date.valueChanges.pipe(startWith(fc.date.value)),
      fc.durationMinutes.valueChanges.pipe(startWith(fc.durationMinutes.value)),
      fc.isEmergency.valueChanges.pipe(startWith(fc.isEmergency.value)),
    ])
      .pipe(
        debounceTime(150),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadAvailability());

    fc.patientId.valueChanges
      .pipe(
        startWith(fc.patientId.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((patientId) => {
        if (patientId) {
          this.loadPatientOngoingTreatments(patientId);
        } else {
          this.activeTreatmentPlans.set([]);
          this.activeTreatments.set([]);
        }
      });
  }

  loadPatientOngoingTreatments(patientId: string) {
    this.loadingTreatments.set(true);
    this.treatmentApi.plans({ patientId, pageSize: '20' }).subscribe({
      next: (res) => {
        const active = (res.items || []).filter((p) => p.status === 1);
        this.activeTreatmentPlans.set(active);
        this.loadingTreatments.set(false);
        if (active.length > 0) {
          this.form.controls.type.setValue(4);
        }
      },
      error: () => this.loadingTreatments.set(false),
    });

    this.treatmentApi.treatments({ patientId, pageSize: '20' }).subscribe({
      next: (res) => {
        const active = (res.items || []).filter((t) => t.status === 3 || t.status === 1 || t.status === 2);
        this.activeTreatments.set(active);
        if (active.length > 0) {
          this.form.controls.type.setValue(4);
        } else if (!this.activeTreatmentPlans().length && this.form.controls.type.value === 1) {
          this.form.controls.type.setValue(2);
        }
      },
      error: () => {},
    });
  }


  remainingTreatmentsSummary(): string {
    const plans = this.activeTreatmentPlans();
    if (plans.length > 0) {
      return plans.map((p) => `${p.title} (${p.total} EGP)`).join(' · ');
    }
    const treatments = this.activeTreatments();
    if (treatments.length > 0) {
      return treatments.map((t) => `${t.treatmentName}${t.toothNumbers?.length ? ' (#' + t.toothNumbers.join(', #') + ')' : ''}`).join(' · ');
    }
    return '';
  }

  applyPlanToNotes(plan: TreatmentPlanList) {
    const prev = this.form.controls.notes.value || '';
    const text = this.t(
      `Session for treatment plan: ${plan.title}`,
      `جلسة متابعة لاستكمال خطة العلاج: ${plan.title}`,
    );
    this.form.controls.notes.setValue(prev ? `${prev}\n${text}` : text);
    this.form.controls.type.setValue(2);
  }


  openNewPatientModal() {
    this.patientForm.reset({ gender: 1, dateOfBirth: '' });
    this.patientAllergies = [];
    this.patientConditions = [];
    this.patientMedications = [];
    this.patientError.set('');
    this.showNewPatientModal.set(true);
  }

  saveNewPatient() {
    this.patientForm.markAllAsTouched();
    if (this.patientForm.invalid) return;

    this.patientSaving.set(true);
    this.patientError.set('');
    const raw = this.patientForm.getRawValue();
    const val = {
      ...raw,
      middleName: raw.middleName.trim() || null,
    };

    this.patientApi.create(val).subscribe({
      next: async (newId) => {
        const patientId = newId.id;
        const calls: Promise<unknown>[] = [];

        for (const name of this.patientAllergies) {
          calls.push(firstValueFrom(this.patientApi.addText(patientId, 'allergies', { name })).catch(() => {}));
        }

        for (const name of this.patientConditions) {
          calls.push(firstValueFrom(this.patientApi.addText(patientId, 'conditions', { name })).catch(() => {}));
        }

        for (const name of this.patientMedications) {
          calls.push(firstValueFrom(this.patientApi.addMedication(patientId, { name })).catch(() => {}));
        }

        if (calls.length > 0) {
          await Promise.all(calls);
        }

        this.patientSaving.set(false);
        this.showNewPatientModal.set(false);
        this.patientApi.invalidateCache();

        if (this.patientSelectComp) {
          this.patientSelectComp.loadPatients();
        }

        this.form.controls.patientId.setValue(patientId);
      },
      error: (e) => {
        this.patientSaving.set(false);
        this.patientError.set(parseApiError(e, this.t('Could not save patient', 'فشل حفظ بيانات المريض')));
      },
    });
  }

  onEmergencyToggle() {
    if (this.form.controls.isEmergency.value) {
      this.form.controls.type.setValue(5);
    }
  }

  enableEmergency() {
    this.form.controls.isEmergency.setValue(true);
    this.form.controls.type.setValue(5);
  }

  loadAvailability(keepError = false) {
    this.selectedSlot.set(null);
    if (!keepError) {
      this.error.set('');
    }
    const x = this.form.getRawValue();
    if (!x.doctorProfileId || !x.date) {
      this.slots.set([]);
      this.slotsLoading.set(false);
      return;
    }
    this.slotsLoading.set(true);
    this.api.availability(x.doctorProfileId, x.date, x.durationMinutes, x.isEmergency).subscribe({
      next: (s) => {
        this.slots.set(s);
        this.slotsLoading.set(false);
      },
      error: (err) => {
        this.slots.set([]);
        this.slotsLoading.set(false);
        this.error.set(
          parseApiError(err, this.t('Availability could not be loaded.', 'تعذر تحميل الأوقات المتاحة.'))
        );
      },
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedSlot()) {
      if (!this.selectedSlot()) {
        this.error.set(this.t('Please choose an available appointment slot.', 'يرجى اختيار وقت متاح للموعد.'));
      }
      return;
    }
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
        error: (e: any) => {
          this.saving.set(false);
          const conflictMsg =
            e?.status === 409
              ? this.t(
                  'This slot was just booked or is unavailable. Please choose another slot.',
                  'تم حجز هذا الموعد للتو أو أصبح غير متاح. يرجى اختيار موعد آخر.',
                )
              : parseApiError(e, this.t('Appointment could not be created.', 'تعذر إنشاء الموعد.'));
          this.error.set(conflictMsg);
          this.loadAvailability(true);
        },
      });
  }

  formatTime(timeStr: string, format: '12h' | '24h' = this.timeFormat()): string {
    if (!timeStr) return '';
    const clean = timeStr.slice(0, 5);
    if (format === '24h') return clean;
    const [hStr, mStr] = clean.split(':');
    const hour = parseInt(hStr, 10);
    const min = mStr || '00';
    const isAr = this.i18n.language() === 'ar';
    const isPm = hour >= 12;
    const period = isPm ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');
    const h12 = hour % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${min} ${period}`;
  }

  formatSlotRange(slot: AvailabilitySlot, format: '12h' | '24h' = this.timeFormat()): string {
    return `${this.formatTime(slot.localStartTime, format)} – ${this.formatTime(slot.localEndTime, format)}`;
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

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
