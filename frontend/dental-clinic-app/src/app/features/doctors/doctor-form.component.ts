import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DoctorApiService, DoctorCandidate, DoctorProfileInput } from './doctor-api.service';

@Component({
  selector: 'app-doctor-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `<a class="back" routerLink="/doctors"
      >← {{ t('Back to doctors', 'العودة إلى الأطباء') }}</a
    >
    <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Administrative profile', 'الملف الإداري') }}</p>
        <h1>
          {{ id ? t('Edit doctor', 'تعديل الطبيب') : t('Create doctor profile', 'إنشاء ملف طبيب') }}
        </h1>
      </div>
    </section>
    @if (loading()) {
      <div class="state">{{ t('Loading…', 'جارٍ التحميل…') }}</div>
    } @else {
      @if (error()) {
        <div class="alert error">{{ error() }}</div>
      }
      <form class="panel form" [formGroup]="form" (ngSubmit)="save()">
        @if (!id) {
          <label
            >{{ t('Clinic user with Doctor role', 'مستخدم العيادة بدور طبيب') }} *<select
              formControlName="clinicUserId"
            >
              <option value="">{{ t('Select user', 'اختر المستخدم') }}</option>
              @for (c of candidates(); track c.clinicUserId) {
                <option [value]="c.clinicUserId">{{ c.displayName }} — {{ c.email }}</option>
              }
            </select></label
          >
          @if (!candidates().length) {
            <p class="hint">
              {{
                t(
                  'No eligible users. Invite a user and assign the Doctor role first.',
                  'لا يوجد مستخدم مؤهل. ادعُ مستخدمًا وعيّن له دور الطبيب أولاً.'
                )
              }}
              <a routerLink="/users">{{ t('Manage users', 'إدارة المستخدمين') }}</a>
            </p>
          }
        }
        <div class="form-grid">
          <label
            >{{ t('Specialization', 'التخصص') }} *<input
              formControlName="specialization"
              maxlength="150" /></label
          ><label
            >{{ t('License number', 'رقم الترخيص') }} *<input
              formControlName="licenseNumber"
              maxlength="100" /></label
          ><label
            >{{ t('Consultation duration (minutes)', 'مدة الاستشارة بالدقائق') }} *<input
              type="number"
              min="5"
              max="480"
              formControlName="consultationDurationMinutes"
          /></label>
        </div>
        <label
          >{{ t('Biography', 'نبذة')
          }}<textarea rows="6" maxlength="2000" formControlName="bio"></textarea>
        </label>
        <div class="form-actions">
          <a class="button" routerLink="/doctors">{{ t('Cancel', 'إلغاء') }}</a
          ><button class="primary" [disabled]="saving() || form.invalid">
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save doctor', 'حفظ الطبيب') }}
          </button>
        </div>
      </form>
    }`,
  styleUrl: './doctors.scss',
})
export class DoctorFormComponent {
  private api = inject(DoctorApiService);
  private router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly candidates = signal<DoctorCandidate[]>([]);
  readonly loading = signal(!!this.id);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    clinicUserId: ['', Validators.required],
    specialization: ['', Validators.required],
    licenseNumber: ['', Validators.required],
    bio: '',
    consultationDurationMinutes: [
      30,
      [Validators.required, Validators.min(5), Validators.max(480)],
    ],
  });
  constructor() {
    if (this.id) {
      this.form.controls.clinicUserId.clearValidators();
      this.api.doctor(this.id).subscribe({
        next: (d) => {
          this.form.patchValue({ ...d, bio: d.bio ?? '' });
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.t('Doctor not found or access denied.', 'الطبيب غير موجود أو الوصول مرفوض.'),
          );
          this.loading.set(false);
        },
      });
    } else {
      this.api.candidates().subscribe({
        next: (x) => {
          this.candidates.set(x);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(
            this.t('Eligible users could not be loaded.', 'تعذر تحميل المستخدمين المؤهلين.'),
          );
          this.loading.set(false);
        },
      });
    }
  }
  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const x = this.form.getRawValue();
    const value: DoctorProfileInput = {
      clinicUserId: x.clinicUserId,
      specialization: x.specialization,
      licenseNumber: x.licenseNumber,
      bio: x.bio || null,
      consultationDurationMinutes: x.consultationDurationMinutes,
    };
    if (this.id)
      this.api
        .update(this.id, value)
        .subscribe({ next: () => this.done(this.id!), error: () => this.failed() });
    else
      this.api
        .create(value)
        .subscribe({ next: (r) => this.done(r.id), error: () => this.failed() });
  }
  done(id: string) {
    void this.router.navigate(['/doctors', id], {
      state: { success: this.t('Doctor profile saved.', 'تم حفظ ملف الطبيب.') },
    });
  }
  failed() {
    this.saving.set(false);
    this.error.set(this.t('The doctor profile could not be saved.', 'تعذر حفظ ملف الطبيب.'));
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
