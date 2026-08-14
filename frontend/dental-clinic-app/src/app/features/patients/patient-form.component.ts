import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { PatientApiService, PatientProfile } from './patient-api.service';

@Component({
  selector: 'app-patient-form',
  imports: [ReactiveFormsModule, RouterLink],
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
            <label
              >{{ t('First name', 'الاسم الأول') }} *<input
                formControlName="firstName"
                maxlength="100" /></label
            ><label
              >{{ t('Middle name', 'الاسم الأوسط')
              }}<input formControlName="middleName" maxlength="100" /></label
            ><label
              >{{ t('Last name', 'اسم العائلة') }} *<input
                formControlName="lastName"
                maxlength="100"
            /></label>
            <label
              >{{ t('Gender', 'النوع') }} *<select formControlName="gender">
                <option [ngValue]="1">{{ t('Female', 'أنثى') }}</option>
                <option [ngValue]="2">{{ t('Male', 'ذكر') }}</option>
                <option [ngValue]="3">{{ t('Other', 'آخر') }}</option>
                <option [ngValue]="0">{{ t('Not specified', 'غير محدد') }}</option>
              </select></label
            ><label
              >{{ t('Date of birth', 'تاريخ الميلاد') }} *<input
                type="date"
                formControlName="dateOfBirth"
                [max]="today" /></label
            ><label
              >{{ t('Marital status', 'الحالة الاجتماعية')
              }}<select formControlName="maritalStatus">
                <option value="">{{ t('Not specified', 'غير محددة') }}</option>
                <option value="1">{{ t('Single', 'أعزب') }}</option>
                <option value="2">{{ t('Married', 'متزوج') }}</option>
                <option value="3">{{ t('Divorced', 'مطلق') }}</option>
                <option value="4">{{ t('Widowed', 'أرمل') }}</option>
              </select></label
            >
            <label>{{ t('Nationality', 'الجنسية') }}<input formControlName="nationality" /></label
            ><label>{{ t('Occupation', 'المهنة') }}<input formControlName="occupation" /></label>
          </div>
        </section>
        <section class="panel">
          <h2>{{ t('Contact', 'بيانات الاتصال') }}</h2>
          <div class="form-grid">
            <label>{{ t('Phone', 'الهاتف') }} *<input type="tel" formControlName="phone" /></label
            ><label
              >{{ t('Alternate phone', 'هاتف بديل')
              }}<input type="tel" formControlName="alternatePhone" /></label
            ><label>Email<input type="email" formControlName="email" /></label
            ><label>{{ t('Address', 'العنوان') }}<input formControlName="address" /></label
            ><label>{{ t('City', 'المدينة') }}<input formControlName="city" /></label
            ><label>{{ t('Country', 'الدولة') }}<input formControlName="country" /></label>
          </div>
        </section>
        <section class="panel">
          <h2>{{ t('Emergency contact', 'جهة اتصال للطوارئ') }}</h2>
          <div class="form-grid">
            <label>{{ t('Name', 'الاسم') }}<input formControlName="emergencyContactName" /></label
            ><label
              >{{ t('Phone', 'الهاتف') }}<input type="tel" formControlName="emergencyContactPhone"
            /></label>
          </div>
        </section>
        <section class="panel">
          <h2>{{ t('Administrative notes', 'ملاحظات إدارية') }}</h2>
          <label
            ><span class="sr-only">{{ t('Notes', 'الملاحظات') }}</span
            ><textarea rows="4" maxlength="2000" formControlName="notes"></textarea>
          </label>
        </section>
        @if (form.invalid && form.touched) {
          <div class="alert error">
            {{
              t(
                'Complete all required fields with valid values.',
                'أكمل الحقول المطلوبة بقيم صحيحة.'
              )
            }}
          </div>
        }
        <div class="form-actions">
          <a class="button" routerLink="/patients">{{ t('Cancel', 'إلغاء') }}</a
          ><button class="primary" [disabled]="saving()">
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save patient', 'حفظ المريض') }}
          </button>
        </div>
      </form>
    }`,
  styleUrl: './patients.scss',
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
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.t('Patient not found or access denied.', 'المريض غير موجود أو الوصول مرفوض.'),
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
        error: () => this.saveFailed(),
      });
    } else {
      this.api.create(profile).subscribe({
        next: (result) => this.saved(result.id),
        error: () => this.saveFailed(),
      });
    }
  }
  private saved(id: string): void {
    void this.router.navigate(['/patients', id], {
      state: { success: this.t('Patient saved successfully.', 'تم حفظ المريض بنجاح.') },
    });
  }
  private saveFailed(): void {
    this.saving.set(false);
    this.error.set(
      this.t(
        'The patient could not be saved. Check the form and your permissions.',
        'تعذر حفظ المريض. تحقق من البيانات والصلاحيات.',
      ),
    );
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
