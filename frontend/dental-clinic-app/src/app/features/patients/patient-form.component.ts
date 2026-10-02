import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import { PatientApiService, PatientProfile } from './patient-api.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { TagInputComponent, TagSuggestion } from '../../shared/tag-input/tag-input.component';
import { DateInputComponent } from '../../shared/date-input/date-input.component';

export const COMMON_ALLERGIES: TagSuggestion[] = [
  { en: 'Penicillin', ar: 'بنسلين' },
  { en: 'Local Anesthesia', ar: 'بنج موضعي' },
  { en: 'Latex', ar: 'لاتكس' },
  { en: 'Sulfa Drugs', ar: 'سلفا' },
  { en: 'Aspirin', ar: 'أسبرين' },
  { en: 'Antibiotics', ar: 'مضادات حيوية' },
  { en: 'Iodine', ar: 'يود' },
];

export const COMMON_CONDITIONS: TagSuggestion[] = [
  { en: 'Diabetes', ar: 'مرض السكري' },
  { en: 'Hypertension', ar: 'ضغط دم مرتفع' },
  { en: 'Heart Disease', ar: 'أمراض القلب' },
  { en: 'Bleeding Disorder', ar: 'سيولة / نزيف دم' },
  { en: 'Asthma', ar: 'حساسية صدرية / ربو' },
  { en: 'Hepatitis / Liver', ar: 'أمراض الكبد' },
  { en: 'Kidney Disease', ar: 'أمراض الكلى' },
  { en: 'Thyroid Disorder', ar: 'غدة درقية' },
  { en: 'Epilepsy', ar: 'صرع / تشنجات' },
];

export const COMMON_MEDICATIONS: TagSuggestion[] = [
  { en: 'Aspirin', ar: 'أسبرين' },
  { en: 'Blood Thinners', ar: 'مسيلات دم' },
  { en: 'Insulin', ar: 'أنسولين' },
  { en: 'Metformin', ar: 'ميتفورمين' },
  { en: 'BP Medications', ar: 'أدوية ضغط دم' },
  { en: 'Corticosteroids', ar: 'كورتيزون' },
  { en: 'Thyroid Meds', ar: 'علاج الغدة' },
];

@Component({
  styleUrl: './patients.scss',
  selector: 'app-patient-form',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, PhoneInputComponent, TagInputComponent, DateInputComponent],
  template: ` <a class="back" routerLink="/patients"
      >← {{ t('Back to patients', 'العودة إلى المرضى') }}</a
    >
    <section class="page-head">
      <div>
        <p class="eyebrow">
          {{ id ? t('Patient profile', 'ملف المريض') : t('New registration', 'تسجيل جديد') }}
        </p>
        <h1>{{ id ? t('Edit patient', 'تعديل المريض') : t('Add patient', 'إضافة مريض') }}</h1>
      </div>
    </section>
    @if (loading()) {
      <div class="loading" role="status">{{ t('Loading patient…', 'جارٍ تحميل المريض…') }}</div>
    } @else {
      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }
      <form class="patient-form" [formGroup]="form" (ngSubmit)="save()">
        <section class="panel">
          <h2>{{ t('Identity', 'البيانات الشخصية') }}</h2>
          <div class="form-grid">
            <label>
              <span>{{ t('First name', 'الاسم الأول') }} <strong class="req">*</strong></span>
              <input
                formControlName="firstName"
                maxlength="100"
                [class.invalid]="form.controls.firstName.touched && form.controls.firstName.invalid"
              />
              @if (form.controls.firstName.touched && form.controls.firstName.invalid) {
                <span class="field-error">{{ t('First name is required.', 'الاسم الأول مطلوب.') }}</span>
              }
            </label>
            <label>
              <span>{{ t('Second name (Middle)', 'الاسم الثاني (الأوسط)') }}</span>
              <input formControlName="middleName" maxlength="100" />
            </label>
            <label>
              <span>{{ t('Third name (Family)', 'الاسم الثالث (العائلة)') }} <strong class="req">*</strong></span>
              <input
                formControlName="lastName"
                maxlength="100"
                [class.invalid]="form.controls.lastName.touched && form.controls.lastName.invalid"
              />
              @if (form.controls.lastName.touched && form.controls.lastName.invalid) {
                <span class="field-error">{{ t('Third/family name is required.', 'الاسم الثالث (العائلة) مطلوب.') }}</span>
              }
            </label>
            <label>
              <span>{{ t('Gender', 'النوع') }} <strong class="req">*</strong></span>
              <select formControlName="gender">
                <option [ngValue]="1">{{ t('Female', 'أنثى') }}</option>
                <option [ngValue]="2">{{ t('Male', 'ذكر') }}</option>
                <option [ngValue]="3">{{ t('Other', 'آخر') }}</option>
                <option [ngValue]="0">{{ t('Not specified', 'غير محدد') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('Date of birth', 'تاريخ الميلاد') }} <strong class="req">*</strong></span>
              <app-date-input
                formControlName="dateOfBirth"
                [max]="today"
                [isInvalid]="form.controls.dateOfBirth.touched && form.controls.dateOfBirth.invalid"
              ></app-date-input>
              @if (form.controls.dateOfBirth.touched && form.controls.dateOfBirth.invalid) {
                <span class="field-error">{{ t('Date of birth is required.', 'تاريخ الميلاد مطلوب.') }}</span>
              }
            </label>
            <label>
              <span>{{ t('Marital status', 'الحالة الاجتماعية') }}</span>
              <select formControlName="maritalStatus">
                <option value="">{{ t('Not specified', 'غير محددة') }}</option>
                <option value="1">{{ t('Single', 'أعزب') }}</option>
                <option value="2">{{ t('Married', 'متزوج') }}</option>
                <option value="3">{{ t('Divorced', 'مطلق') }}</option>
                <option value="4">{{ t('Widowed', 'أرمل') }}</option>
              </select>
            </label>
            <label>
              <span>{{ t('Nationality', 'الجنسية') }}</span>
              <input formControlName="nationality" />
            </label>
            <label>
              <span>{{ t('Occupation', 'المهنة') }}</span>
              <input formControlName="occupation" />
            </label>
          </div>
        </section>
        <section class="panel">
          <h2>{{ t('Contact', 'بيانات الاتصال') }}</h2>
          <div class="form-grid">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">{{ t('Phone', 'الهاتف') }} <strong class="req" style="color: #dc2626;">*</strong></span>
              <app-phone-input
                formControlName="phone"
                [class.invalid]="form.controls.phone.touched && form.controls.phone.invalid"
              ></app-phone-input>
              @if (form.controls.phone.touched && form.controls.phone.errors?.['required']) {
                <span class="field-error">{{ t('Phone number is required.', 'رقم الهاتف مطلوب.') }}</span>
              }
              @if (form.controls.phone.touched && form.controls.phone.errors?.['invalidPhone']) {
                <span class="field-error">{{ t('Phone number is invalid.', 'رقم الهاتف غير صحيح.') }}</span>
              }
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">{{ t('Alternate phone', 'هاتف بديل') }}</span>
              <app-phone-input
                formControlName="alternatePhone"
                [class.invalid]="form.controls.alternatePhone.touched && form.controls.alternatePhone.invalid"
              ></app-phone-input>
              @if (form.controls.alternatePhone.touched && form.controls.alternatePhone.errors?.['invalidPhone']) {
                <span class="field-error">{{ t('Phone number is invalid.', 'رقم الهاتف غير صحيح.') }}</span>
              }
            </div>
            <label>
              <span>Email</span>
              <input
                type="email"
                formControlName="email"
                [class.invalid]="form.controls.email.touched && form.controls.email.invalid"
              />
              @if (form.controls.email.touched && form.controls.email.invalid) {
                <span class="field-error">{{ t('Please enter a valid email address.', 'يرجى إدخال بريد إلكتروني صحيح.') }}</span>
              }
            </label>
            <label>
              <span>{{ t('Address', 'العنوان') }}</span>
              <input formControlName="address" />
            </label>
            <label>
              <span>{{ t('City', 'المدينة') }}</span>
              <input formControlName="city" />
            </label>
            <label>
              <span>{{ t('Country', 'الدولة') }}</span>
              <input formControlName="country" />
            </label>
          </div>
        </section>
        <section class="panel">
          <h2>{{ t('Emergency contact', 'جهة اتصال للطوارئ') }}</h2>
          <div class="form-grid">
            <label>
              <span>{{ t('Name', 'الاسم') }}</span>
              <input formControlName="emergencyContactName" />
            </label>
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <span style="font-size: 0.85rem; font-weight: 600; color: #475569;">{{ t('Phone', 'الهاتف') }}</span>
              <app-phone-input
                formControlName="emergencyContactPhone"
                [class.invalid]="form.controls.emergencyContactPhone.touched && form.controls.emergencyContactPhone.invalid"
              ></app-phone-input>
              @if (form.controls.emergencyContactPhone.touched && form.controls.emergencyContactPhone.errors?.['invalidPhone']) {
                <span class="field-error">{{ t('Phone number is invalid.', 'رقم الهاتف غير صحيح.') }}</span>
              }
            </div>
          </div>
        </section>
        
        <!-- Medical Alerts & Health History Panel -->
        <section class="panel medical-alerts-panel">
          <h2>🏥 {{ t('Medical Alerts & Health Background (Optional)', 'التنبيهات الطبية والتاريخ الصحي (اختياري)') }}</h2>
          <p class="section-desc" style="color: var(--muted); font-size: 0.88rem; margin: -0.5rem 0 1.25rem;">
            {{ t('Record allergies, chronic conditions, and current medications to alert doctors during clinical examination.', 'سجل الحساسية، الأمراض المزمنة، والأدوية الحالية لتنبيه الطبيب تلقائياً أثناء الكشف السريري.') }}
          </p>

          <div class="medical-fields-stack">
            <!-- 1. Allergies -->
            <div class="med-field-group">
              <label class="field-label-danger">
                <span class="label-title">⚠️ {{ t('Allergies & Sensitivities', 'الحساسية والتحسس') }}</span>
                <app-tag-input
                  [(tags)]="allergies"
                  theme="danger"
                  [placeholder]="t('Type an allergy and press Enter, or choose from suggestions below…', 'اكتب الحساسية واضغط Enter، أو اختر من الاقتراحات أدناه…')"
                  [suggestions]="allergySuggestions"
                ></app-tag-input>
              </label>
            </div>

            <!-- 2. Chronic Conditions -->
            <div class="med-field-group">
              <label class="field-label-warning">
                <span class="label-title">🩺 {{ t('Chronic Medical Conditions', 'الأمراض والحالات المزمنة') }}</span>
                <app-tag-input
                  [(tags)]="conditions"
                  theme="warning"
                  [placeholder]="t('Type a condition and press Enter, or choose from suggestions below…', 'اكتب الحالة واضغط Enter، أو اختر من الاقتراحات أدناه…')"
                  [suggestions]="conditionSuggestions"
                ></app-tag-input>
              </label>
            </div>

            <!-- 3. Current Medications -->
            <div class="med-field-group">
              <label class="field-label-info">
                <span class="label-title">💊 {{ t('Current Patient Medications', 'الأدوية والعلاجات الحالية') }}</span>
                <app-tag-input
                  [(tags)]="medications"
                  theme="info"
                  [placeholder]="t('Type a medication and press Enter, or choose from suggestions below…', 'اكتب الدواء واضغط Enter، أو اختر من الاقتراحات أدناه…')"
                  [suggestions]="medicationSuggestions"
                ></app-tag-input>
              </label>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2>{{ t('Administrative notes', 'ملاحظات إدارية') }}</h2>
          <div class="notes-field">
            <label>
              <span class="field-label">{{ t('Notes', 'الملاحظات') }}</span>
              <textarea
                rows="4"
                maxlength="2000"
                formControlName="notes"
                [placeholder]="t('Enter any non-medical administrative notes regarding this patient…', 'اكتب أي ملاحظات إدارية خاصة بالمريض (المواعيد المفضلة، تفضيلات التواصل، إلخ)…')"
              ></textarea>
            </label>
          </div>
        </section>
        @if (form.invalid && form.touched) {
          <div class="alert error">
            {{
              t(
                'Please complete all required fields correctly before saving.',
                'يرجى إكمال جميع الحقول المطلوبة بشكل صحيح قبل الحفظ.'
              )
            }}
          </div>
        }
        <div class="form-actions">
          <a class="button" routerLink="/patients">{{ t('Cancel', 'إلغاء') }}</a>
          <button class="primary" [disabled]="saving()">
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save patient', 'حفظ المريض') }}
          </button>
        </div>
      </form>
    }`,
})
export class PatientFormComponent {
  private readonly api = inject(PatientApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly today = new Date().toISOString().slice(0, 10);
  readonly loading = signal(!!this.id);
  readonly saving = signal(false);
  readonly error = signal('');
  allergies: string[] = [];
  conditions: string[] = [];
  medications: string[] = [];
  readonly allergySuggestions = COMMON_ALLERGIES;
  readonly conditionSuggestions = COMMON_CONDITIONS;
  readonly medicationSuggestions = COMMON_MEDICATIONS;
  readonly form = inject(FormBuilder).nonNullable.group({
    firstName: ['', Validators.required],
    middleName: '',
    lastName: ['', Validators.required],
    gender: 0,
    dateOfBirth: ['', Validators.required],
    phone: ['', Validators.required],
    alternatePhone: '',
    email: ['', Validators.email],
    address: '',
    city: '',
    country: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    nationality: '',
    occupation: '',
    maritalStatus: '',
    notes: '',
  });
  constructor() {
    if (this.id)
      this.api.patient(this.id).subscribe({
        next: (p) => {
          this.form.patchValue({
            ...p,
            middleName: p.middleName ?? '',
            alternatePhone: p.alternatePhone ?? '',
            email: p.email ?? '',
            address: p.address ?? '',
            city: p.city ?? '',
            country: p.country ?? '',
            emergencyContactName: p.emergencyContactName ?? '',
            emergencyContactPhone: p.emergencyContactPhone ?? '',
            nationality: p.nationality ?? '',
            occupation: p.occupation ?? '',
            maritalStatus: p.maritalStatus?.toString() ?? '',
            notes: p.notes ?? '',
          });
          this.allergies = (p.allergies ?? []).map((x) => x.name);
          this.conditions = (p.medicalConditions ?? []).map((x) => x.name);
          this.medications = (p.medications ?? []).map((x) => x.name);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            parseApiError(err, this.t('Patient not found or access denied.', 'المريض غير موجود أو الوصول مرفوض.'))
          );
          this.loading.set(false);
        },
      });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    const profile: PatientProfile = {
      ...value,
      middleName: value.middleName || null,
      alternatePhone: value.alternatePhone || null,
      email: value.email || null,
      address: value.address || null,
      city: value.city || null,
      country: value.country || null,
      emergencyContactName: value.emergencyContactName || null,
      emergencyContactPhone: value.emergencyContactPhone || null,
      nationality: value.nationality || null,
      occupation: value.occupation || null,
      maritalStatus: value.maritalStatus ? Number(value.maritalStatus) : null,
      notes: value.notes || null,
    };
    if (this.id) {
      this.api.update(this.id, profile).subscribe({
        next: () => this.saved(this.id!),
        error: (err) => this.saveFailed(err),
      });
    } else {
      this.api.create(profile).subscribe({
        next: async (result) => {
          const patientId = result.id;
          const calls: Promise<unknown>[] = [];

          for (const name of this.allergies) {
            calls.push(firstValueFrom(this.api.addText(patientId, 'allergies', { name })).catch(() => {}));
          }

          for (const name of this.conditions) {
            calls.push(firstValueFrom(this.api.addText(patientId, 'conditions', { name })).catch(() => {}));
          }

          for (const name of this.medications) {
            calls.push(firstValueFrom(this.api.addMedication(patientId, { name })).catch(() => {}));
          }

          if (calls.length > 0) {
            await Promise.all(calls);
          }

          this.saved(patientId);
        },
        error: (err) => this.saveFailed(err),
      });
    }
  }
  private saved(id: string): void {
    void this.router.navigate(['/patients', id], {
      state: { success: this.t('Patient saved successfully.', 'تم حفظ المريض بنجاح.') },
    });
  }
  private saveFailed(err: unknown): void {
    this.saving.set(false);
    this.error.set(
      parseApiError(
        err,
        this.t(
          'The patient could not be saved. Check the form and your permissions.',
          'تعذر حفظ المريض. تحقق من البيانات والصلاحيات.'
        )
      )
    );
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


