import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { parseApiError } from '../../core/error-util';
import { DoctorApiService, DoctorCandidate, DoctorProfileInput } from './doctor-api.service';
import { UserApiService, RoleSummary } from '../users/user-api.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { concatMap } from 'rxjs/operators';
import { of, throwError } from 'rxjs';

@Component({
  styleUrl: './doctors.scss',
  selector: 'app-doctor-form',
  imports: [ReactiveFormsModule, RouterLink, PhoneInputComponent],
  template: `
    <a class="back" routerLink="/doctors">← {{ t('Back to doctors', 'العودة إلى الأطباء') }}</a>
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
          <!-- Modern Mode Selector -->
          <div class="mode-selector-section">
            <span class="mode-selector-label">{{ t('Doctor Account Mode', 'طريقة إضافة حساب الطبيب') }} <strong class="req">*</strong></span>
            <div class="mode-cards-grid">
              <div
                class="mode-card"
                role="button"
                tabindex="0"
                [class.active]="mode() === 'new'"
                (click)="setMode('new')"
                (keydown.enter)="setMode('new')"
                (keydown.space)="setMode('new')"
              >
                <div class="mode-card-icon">👤➕</div>
                <div class="mode-card-content">
                  <strong class="mode-card-title">{{ t('Create new user account', 'إنشاء حساب مستخدم جديد') }}</strong>
                  <span class="mode-card-desc">{{ t('Register login credentials with email & password for this doctor', 'تسجيل حساب دخول جديد بالبريد الإلكتروني وكلمة المرور') }}</span>
                </div>
                <div class="mode-card-radio">
                  <span class="radio-indicator"></span>
                </div>
              </div>

              <div
                class="mode-card"
                role="button"
                tabindex="0"
                [class.active]="mode() === 'existing'"
                (click)="setMode('existing')"
                (keydown.enter)="setMode('existing')"
                (keydown.space)="setMode('existing')"
              >
                <div class="mode-card-icon">👥🔗</div>
                <div class="mode-card-content">
                  <strong class="mode-card-title">{{ t('Select existing user', 'ربط بمستخدم حالي') }}</strong>
                  <span class="mode-card-desc">{{ t('Link this profile to an already registered user in the clinic', 'ربط هذا الملف بمستخدم مسجل مسبقاً في النظام') }}</span>
                </div>
                <div class="mode-card-radio">
                  <span class="radio-indicator"></span>
                </div>
              </div>
            </div>
          </div>

          @if (mode() === 'existing') {
            <label>
              <span>{{ t('Select Doctor User Account', 'اختر حساب المستخدم (الطبيب)') }} <strong class="req">*</strong></span>
              <select
                formControlName="clinicUserId"
                [class.invalid]="form.controls.clinicUserId.touched && form.controls.clinicUserId.invalid"
              >
                <option value="">{{ t('Select user account…', 'اختر حساب المستخدم…') }}</option>
                @for (c of candidates(); track c.clinicUserId) {
                  <option [value]="c.clinicUserId">{{ c.displayName }} ({{ c.email }}) {{ c.phone ? '— ' + c.phone : '' }}</option>
                }
              </select>
              @if (form.controls.clinicUserId.touched && form.controls.clinicUserId.invalid) {
                <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                  {{ t('Please select an eligible doctor user.', 'يرجى اختيار حساب الطبيب.') }}
                </span>
              }
            </label>
            @if (!candidates().length) {
              <div class="hint-card">
                <div class="hint-icon">ℹ️</div>
                <div class="hint-text">
                  <strong>{{ t('No existing eligible users found.', 'لا يوجد مستخدمين حاليين مؤهلين.') }}</strong>
                  <p>{{ t('You must create a new user account for this doctor.', 'يرجى اختيار "إنشاء حساب مستخدم جديد".') }}</p>
                </div>
              </div>
            }
          } @else {
            <div class="form-grid" formGroupName="newUser">
              <label>
                <span>{{ t('Full Name', 'الاسم الكامل') }} <strong class="req">*</strong></span>
                <input
                  formControlName="displayName"
                  [placeholder]="t('e.g. Dr. Ahmed Ali', 'مثال: د. أحمد علي')"
                  [class.invalid]="form.controls.newUser.controls.displayName.touched && form.controls.newUser.controls.displayName.invalid"
                />
                @if (form.controls.newUser.controls.displayName.touched && form.controls.newUser.controls.displayName.invalid) {
                  <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Full Name is required.', 'الاسم الكامل مطلوب.') }}
                  </span>
                }
              </label>

              <label>
                <span>{{ t('Email', 'البريد الإلكتروني') }} <strong class="req">*</strong></span>
                <input
                  type="email"
                  formControlName="email"
                  [placeholder]="t('e.g. doctor@clinic.com', 'مثال: doctor@clinic.com')"
                  [class.invalid]="form.controls.newUser.controls.email.touched && form.controls.newUser.controls.email.invalid"
                />
                @if (form.controls.newUser.controls.email.touched && form.controls.newUser.controls.email.invalid) {
                  <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('A valid email is required.', 'مطلوب بريد إلكتروني صحيح.') }}
                  </span>
                }
              </label>

              <label>
                <span>{{ t('Phone', 'رقم الهاتف') }} <strong class="req">*</strong></span>
                <app-phone-input
                  formControlName="phone"
                  [placeholder]="t('e.g. 01012345678', 'مثال: 01012345678')"
                  [class.invalid]="form.controls.newUser.controls.phone.touched && form.controls.newUser.controls.phone.invalid"
                ></app-phone-input>
                @if (form.controls.newUser.controls.phone.touched && form.controls.newUser.controls.phone.errors?.['required']) {
                  <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Phone number is required.', 'رقم الهاتف مطلوب.') }}
                  </span>
                }
                @if (form.controls.newUser.controls.phone.touched && form.controls.newUser.controls.phone.errors?.['invalidPhone']) {
                  <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Phone number must have at least 10 digits.', 'رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل.') }}
                  </span>
                }
              </label>

              <label>
                <span>{{ t('Password', 'كلمة المرور') }} <strong class="req">*</strong></span>
                <input
                  type="password"
                  formControlName="password"
                  [placeholder]="t('At least 6 characters', '6 أحرف أو أرقام على الأقل')"
                  [class.invalid]="form.controls.newUser.controls.password.touched && form.controls.newUser.controls.password.invalid"
                />
                @if (form.controls.newUser.controls.password.touched && form.controls.newUser.controls.password.invalid) {
                  <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                    {{ t('Password must be at least 6 characters.', 'كلمة المرور يجب أن تكون 6 خانات على الأقل.') }}
                  </span>
                }
              </label>
            </div>
            <hr style="margin: 2rem 0; border: none; border-top: 1px solid #e2e8f0;">
          }
        } @else {
          <!-- Edit Mode: Doctor Name & Phone -->
          <div class="form-grid">
            <label>
              <span>{{ t('Doctor Name', 'اسم الطبيب') }} <strong class="req">*</strong></span>
              <input
                formControlName="displayName"
                maxlength="200"
                [placeholder]="t('e.g. Dr. Ahmed Ali', 'مثال: د. أحمد علي')"
                [class.invalid]="form.controls.displayName.touched && form.controls.displayName.invalid"
              />
              @if (form.controls.displayName.touched && form.controls.displayName.invalid) {
                <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                  {{ t('Doctor name is required.', 'اسم الطبيب مطلوب.') }}
                </span>
              }
            </label>

            <div>
              <label>
                <span>{{ t('Phone', 'رقم الهاتف') }}</span>
                <app-phone-input
                  formControlName="phone"
                  [placeholder]="t('e.g. 01012345678', 'مثال: 01012345678')"
                ></app-phone-input>
              </label>
            </div>
          </div>
          <hr style="margin: 1.5rem 0; border: none; border-top: 1px solid #e2e8f0;">
        }

        <div class="form-grid">
          <label>
            <span>{{ t('Specialization', 'التخصص') }} <strong class="req">*</strong></span>
            <input
              formControlName="specialization"
              maxlength="100"
              [placeholder]="t('e.g. Orthodontics', 'مثال: تقويم الأسنان')"
              [class.invalid]="form.controls.specialization.touched && form.controls.specialization.invalid"
            />
            @if (form.controls.specialization.touched && form.controls.specialization.invalid) {
              <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                {{ t('Specialization is required.', 'التخصص مطلوب.') }}
              </span>
            }
          </label>

          <label>
            <span>{{ t('License number', 'رقم الترخيص') }}</span>
            <input
              formControlName="licenseNumber"
              maxlength="100"
              [placeholder]="t('e.g. LIC-12345 (optional)', 'مثال: LIC-12345 (اختياري)')"
            />
          </label>

          <label>
            <span>{{ t('Consultation duration (minutes)', 'مدة الاستشارة بالدقائق') }} <strong class="req">*</strong></span>
            <input
              type="number"
              min="5"
              max="480"
              formControlName="consultationDurationMinutes"
              [class.invalid]="form.controls.consultationDurationMinutes.touched && form.controls.consultationDurationMinutes.invalid"
            />
            @if (form.controls.consultationDurationMinutes.touched && form.controls.consultationDurationMinutes.invalid) {
              <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                {{ t('Duration must be between 5 and 480 minutes.', 'المدة يجب أن تكون بين 5 و 480 دقيقة.') }}
              </span>
            }
          </label>
        </div>

        <label>
          <span>{{ t('Biography', 'نبذة') }}</span>
          <textarea rows="5" maxlength="2000" formControlName="bio" [placeholder]="t('Optional bio...', 'نبذة اختيارية...')"></textarea>
        </label>
        
        @if (form.invalid && form.touched) {
          <div class="alert error" style="margin-top: 1rem;">
            <strong>{{ t('Please correct the following errors before saving:', 'يرجى تصحيح الأخطاء التالية قبل الحفظ:') }}</strong>
            <ul style="margin: 0.5rem 0 0 1.25rem; padding: 0; font-size: 0.88rem;">
              @if (id && form.controls.displayName.invalid) {
                <li>{{ t('Doctor Name is required.', 'اسم الطبيب مطلوب.') }}</li>
              }
              @if (mode() === 'new' && !id) {
                @if (form.controls.newUser.controls.displayName.invalid) {
                  <li>{{ t('Full Name is required.', 'الاسم الكامل مطلوب.') }}</li>
                }
                @if (form.controls.newUser.controls.email.invalid) {
                  <li>{{ t('A valid Email is required.', 'بريد إلكتروني صحيح مطلوب.') }}</li>
                }
                @if (form.controls.newUser.controls.phone.invalid) {
                  <li>{{ t('Phone number is required and must have at least 10 digits.', 'رقم الهاتف مطلوب ويجب أن يحتوي على 10 أرقام على الأقل.') }}</li>
                }
                @if (form.controls.newUser.controls.password.invalid) {
                  <li>{{ t('Password must be at least 6 characters.', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.') }}</li>
                }
              }
              @if (mode() === 'existing' && !id && form.controls.clinicUserId.invalid) {
                <li>{{ t('Please select an existing user account.', 'يرجى اختيار حساب مستخدم موجود.') }}</li>
              }
              @if (form.controls.specialization.invalid) {
                <li>{{ t('Specialization is required.', 'التخصص مطلوب.') }}</li>
              }
              @if (form.controls.consultationDurationMinutes.invalid) {
                <li>{{ t('Duration must be between 5 and 480 minutes.', 'المدة يجب أن تكون بين 5 و 480 دقيقة.') }}</li>
              }
            </ul>
          </div>
        }

        @if (error()) {
          <div class="alert error" style="margin-top: 1rem;">
            ⚠️ {{ error() }}
          </div>
        }

        <div class="form-actions" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            @if (id) {
              <button type="button" class="danger" (click)="deleteDoctor()" [disabled]="saving()" style="background: #dc2626; color: white; border: none; border-radius: var(--radius-md); padding: 0.5rem 1rem; cursor: pointer; font-weight: 600;">
                🗑️ {{ t('Delete Doctor (Soft Delete)', 'حذف الطبيب (أرشفة)') }}
              </button>
            }
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <a class="button" [routerLink]="id ? ['/doctors', id] : '/doctors'">{{ t('Cancel', 'إلغاء') }}</a>
            <button class="primary" [disabled]="saving()">
              {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save doctor', 'حفظ الطبيب') }}
            </button>
          </div>
        </div>
      </form>
    }
  `,
})
export class DoctorFormComponent {
  private api = inject(DoctorApiService);
  private userApi = inject(UserApiService);
  private auth = inject(AuthService);
  private router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  
  readonly candidates = signal<DoctorCandidate[]>([]);
  readonly mode = signal<'new' | 'existing'>('new');
  readonly doctorRoleId = signal<string | null>(null);
  
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  
  readonly form = inject(FormBuilder).nonNullable.group({
    clinicUserId: [''],
    displayName: ['', [Validators.maxLength(200)]],
    phone: [''],
    newUser: inject(FormBuilder).nonNullable.group({
      displayName: ['', [Validators.required, Validators.maxLength(200)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      phone: ['', [Validators.required]],
    }),
    specialization: ['', Validators.required],
    licenseNumber: ['', [Validators.maxLength(100)]],
    bio: '',
    consultationDurationMinutes: [
      30,
      [Validators.required, Validators.min(5), Validators.max(480)],
    ],
  });

  constructor() {
    this.updateModeValidators();
    
    if (this.id) {
      this.api.doctor(this.id).subscribe({
        next: (d) => {
          this.form.patchValue({
            displayName: d.displayName,
            phone: d.phone ?? '',
            specialization: d.specialization,
            licenseNumber: d.licenseNumber ?? '',
            consultationDurationMinutes: d.consultationDurationMinutes,
            bio: d.bio ?? '',
          });
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(parseApiError(err, this.t('Doctor not found or access denied.', 'الطبيب غير موجود أو الوصول مرفوض.')));
          this.loading.set(false);
        },
      });
    } else {
      this.userApi.roles().subscribe({
        next: (roles) => {
          const docRole = roles.find(r => r.name === 'Doctor' || r.name === 'طبيب');
          if (docRole) this.doctorRoleId.set(docRole.id);
        }
      });
      
      this.api.candidates().subscribe({
        next: (x) => {
          this.candidates.set(x);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(parseApiError(err, this.t('Eligible users could not be loaded.', 'تعذر تحميل المستخدمين المؤهلين.')));
          this.loading.set(false);
        },
      });
    }
  }

  setMode(m: 'new' | 'existing') {
    this.mode.set(m);
    this.updateModeValidators();
  }
  
  private updateModeValidators() {
    const isEdit = !!this.id;
    const isNew = this.mode() === 'new' && !isEdit;
    const clinicUserCtrl = this.form.controls.clinicUserId;
    const displayNameCtrl = this.form.controls.displayName;
    const newGroup = this.form.controls.newUser;

    if (isEdit) {
      displayNameCtrl.setValidators([Validators.required, Validators.maxLength(200)]);
      clinicUserCtrl.clearValidators();
      newGroup.controls.displayName.clearValidators();
      newGroup.controls.email.clearValidators();
      newGroup.controls.password.clearValidators();
      newGroup.controls.phone.clearValidators();
    } else if (isNew) {
      displayNameCtrl.clearValidators();
      clinicUserCtrl.clearValidators();
      clinicUserCtrl.setValue('');
      newGroup.controls.displayName.setValidators([Validators.required, Validators.maxLength(200)]);
      newGroup.controls.email.setValidators([Validators.required, Validators.email, Validators.maxLength(256)]);
      newGroup.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
      newGroup.controls.phone.setValidators([Validators.required]);
    } else {
      displayNameCtrl.clearValidators();
      clinicUserCtrl.setValidators([Validators.required]);
      newGroup.controls.displayName.clearValidators();
      newGroup.controls.email.clearValidators();
      newGroup.controls.password.clearValidators();
      newGroup.controls.phone.clearValidators();
    }

    displayNameCtrl.updateValueAndValidity({ emitEvent: false });
    clinicUserCtrl.updateValueAndValidity({ emitEvent: false });
    newGroup.controls.displayName.updateValueAndValidity({ emitEvent: false });
    newGroup.controls.email.updateValueAndValidity({ emitEvent: false });
    newGroup.controls.password.updateValueAndValidity({ emitEvent: false });
    newGroup.controls.phone.updateValueAndValidity({ emitEvent: false });
  }

  save() {
    this.updateModeValidators();
    this.form.markAllAsTouched();
    this.form.controls.newUser.markAllAsTouched();

    if (this.form.invalid) {
      this.error.set(
        this.t(
          'Please complete all required fields correctly (marked in red).',
          'يرجى إكمال جميع الحقول المطلوبة بشكل صحيح (الموضحة باللون الأحمر).'
        )
      );
      return;
    }

    this.saving.set(true);
    this.error.set('');
    
    const x = this.form.getRawValue();
    
    const createDoctorValue: DoctorProfileInput = {
      displayName: this.id ? x.displayName.trim() : undefined,
      phone: this.id ? (x.phone || null) : undefined,
      specialization: x.specialization,
      licenseNumber: x.licenseNumber?.trim() || null,
      bio: x.bio || null,
      consultationDurationMinutes: x.consultationDurationMinutes,
    };

    if (this.id) {
      this.api.update(this.id, createDoctorValue).subscribe({
        next: () => {
          if (createDoctorValue.displayName) {
            this.api.doctor(this.id!).subscribe({
              next: (d) => {
                if (d.clinicUserId === this.auth.userId()) {
                  this.auth.setDisplayName(createDoctorValue.displayName!);
                }
              },
              error: () => {},
            });
          }
          this.api.invalidateCache();
          this.done(this.id!);
        },
        error: (err) => this.failed(err),
      });
    } else if (this.mode() === 'new') {
      const roleId = this.doctorRoleId();
      if (!roleId) {
        this.failed(new Error(this.t('Doctor role not found in the system.', 'دور الطبيب غير موجود في النظام.')));
        return;
      }
      
      // 1. Create User -> 2. Create Doctor
      this.userApi.createUser({
        displayName: x.newUser.displayName,
        email: x.newUser.email,
        password: x.newUser.password,
        phone: x.newUser.phone || undefined,
        roleIds: [roleId]
      }).pipe(
        concatMap(res => {
          createDoctorValue.clinicUserId = res.id;
          return this.api.create(createDoctorValue);
        })
      ).subscribe({
        next: (r) => this.done(r.id),
        error: (err) => this.failed(err)
      });
    } else {
      // Existing user mode
      createDoctorValue.clinicUserId = x.clinicUserId;
      this.api.create(createDoctorValue).subscribe({
        next: (r) => this.done(r.id),
        error: (err) => this.failed(err),
      });
    }
  }

  deleteDoctor() {
    if (!this.id) return;
    const msg = this.t(
      'Are you sure you want to delete/archive this doctor? All past financial records and patient treatment history will remain intact, but new appointments cannot be booked for this doctor.',
      'هل أنت متأكد من حذف / أرشفة هذا الطبيب؟ ستبقى جميع السجلات المالية والطبية السابقة محفوظة، ولكن لن يمكن حجز مواعيد جديدة لهذا الطبيب.'
    );
    if (!confirm(msg)) return;

    this.saving.set(true);
    this.error.set('');
    this.api.delete(this.id).subscribe({
      next: () => {
        void this.router.navigate(['/doctors'], {
          state: { success: this.t('Doctor profile archived successfully.', 'تمت أرشفة وحذف الطبيب بنجاح.') }
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(parseApiError(err, this.t('Could not delete doctor profile.', 'تعذر حذف ملف الطبيب.')));
      }
    });
  }
  
  done(id: string) {
    void this.router.navigate(['/doctors', id], {
      state: { success: this.t('Doctor profile saved.', 'تم حفظ ملف الطبيب.') },
    });
  }
  failed(err: unknown) {
    this.saving.set(false);
    const msg = parseApiError(err, this.t('The doctor profile could not be saved.', 'تعذر حفظ ملف الطبيب.'));
    this.error.set(msg);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
