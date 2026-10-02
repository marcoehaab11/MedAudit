import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, CrmUser } from './crm-api.service';
import { followUpType } from './crm-labels';
import { validFollowUp } from './crm-ui';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { PatientSelectComponent } from '../../shared/patient-select.component';

@Component({
  styleUrl: './crm.scss',
  selector: 'app-follow-up-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, PatientSelectComponent, DateInputComponent],
  template: `
    <div class="crm-form-page">
      <a class="back-link" routerLink="/crm/follow-ups">
        ← {{ t('Back to follow-ups', 'العودة لقائمة المتابعات') }}
      </a>

      <header class="form-page-header">
        <div class="header-icon-wrap">📞</div>
        <div>
          <p class="eyebrow">{{ t('Patient CRM', 'العلاقات والمتابعة السريرية') }}</p>
          <h1>{{ t('Create New Follow-up', 'إنشاء متابعة جديدة للمريض') }}</h1>
          <p class="header-desc">{{ t('Schedule reminders for checkups, lab results, post-op care, or payments.', 'جدولة تذكيرات للكشوفات الدورية، نتائج المعامل، رعاية ما بعد الجراحة أو السداد.') }}</p>
        </div>
      </header>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      <form class="panel crm-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="section-title-bar">
          <h3>{{ t('Follow-up Information', 'بيانات المتابعة الأساسية') }}</h3>
        </div>

        <div class="crm-inputs-grid">
          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Patient', 'المريض') }} <strong class="req">*</strong></span>
            </label>
            <app-patient-select
              formControlName="patientId"
              [allowClear]="false"
              [isInvalid]="form.controls.patientId.touched && form.controls.patientId.invalid"
            />
            @if (form.controls.patientId.touched && form.controls.patientId.invalid) {
              <span class="field-error">{{ t('Patient is required.', 'المريض مطلوب.') }}</span>
            }
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Assigned to Staff / Doctor', 'الموظف / الطبيب المسؤول') }} <strong class="req">*</strong></span>
            </label>
            <select class="form-input" formControlName="assignedToUserId">
              <option value="">{{ t('Select staff member…', 'اختر المسؤول…') }}</option>
              @for (x of users(); track x.id) {
                <option [value]="x.id">{{ x.displayName }}</option>
              }
            </select>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Follow-up Type', 'نوع المتابعة') }} <strong class="req">*</strong></span>
            </label>
            <select class="form-input" formControlName="type">
              @for (x of types; track x) {
                <option [value]="x">{{ type(x) }}</option>
              }
            </select>
          </div>

          <div class="field-item date-time-group">
            <div class="sub-field">
              <label class="field-label">
                <span>{{ t('Due Date', 'تاريخ الاستحقاق') }} <strong class="req">*</strong></span>
              </label>
              <app-date-input formControlName="dueDate"></app-date-input>
            </div>
            <div class="sub-field">
              <label class="field-label">
                <span>{{ t('Due Time', 'الوقت') }} <strong class="req">*</strong></span>
              </label>
              <input class="form-input" type="time" formControlName="dueTime" />
            </div>
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Follow-up Subject / Title', 'عنوان / موضوع المتابعة') }} <strong class="req">*</strong></span>
            </label>
            <input
              class="form-input"
              formControlName="title"
              [placeholder]="t('e.g. Post-extraction checkup, crown fitting reminder, routine 6-month cleaning…', 'مثال: الاطمئنان بعد خلع الضرس، تذكير بموعد تركيب الطربوش، كشف دوري…')"
            />
            @if (form.controls.title.touched && form.controls.title.invalid) {
              <span class="field-error">{{ t('Title is required.', 'عنوان المتابعة مطلوب.') }}</span>
            }
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Notes & Patient Communication Summary', 'ملاحظات وتفاصيل المكالمة / التذكير') }}</span>
            </label>
            <textarea
              class="form-textarea"
              rows="3"
              formControlName="notes"
              [placeholder]="t('Any clinical notes, patient preferences, or specific instructions for the follow-up…', 'أي توجيهات طبية، تفضيلات المريض في التواصل، أو نقاط للمناقشة معه…')"
            ></textarea>
          </div>
        </div>

        <!-- Optional Clinical Links Box -->
        <div class="clinical-links-box">
          <div class="links-title">
            <span>🔗 {{ t('Link to Clinical Records (Optional)', 'ربط بسجلات سريرية سابقة (اختياري)') }}</span>
          </div>
          <div class="links-grid">
            <div class="field-item">
              <label class="field-label-sm">{{ t('Appointment ID', 'رقم الموعد') }}</label>
              <input class="form-input-sm" formControlName="relatedAppointmentId" [placeholder]="t('Optional ID', 'اختياري')" />
            </div>
            <div class="field-item">
              <label class="field-label-sm">{{ t('Treatment Plan ID', 'رقم خطة العلاج') }}</label>
              <input class="form-input-sm" formControlName="relatedTreatmentPlanId" [placeholder]="t('Optional ID', 'اختياري')" />
            </div>
            <div class="field-item">
              <label class="field-label-sm">{{ t('Treatment ID', 'رقم الإجراء العلاجي') }}</label>
              <input class="form-input-sm" formControlName="relatedTreatmentId" [placeholder]="t('Optional ID', 'اختياري')" />
            </div>
            <div class="field-item">
              <label class="field-label-sm">{{ t('Prescription ID', 'رقم الوصفة الطبية') }}</label>
              <input class="form-input-sm" formControlName="relatedPrescriptionId" [placeholder]="t('Optional ID', 'اختياري')" />
            </div>
          </div>
        </div>

        <div class="form-bottom-actions">
          <a class="button btn-cancel" routerLink="/crm/follow-ups">{{ t('Cancel', 'إلغاء') }}</a>
          <button class="button primary btn-submit-main" [disabled]="form.invalid || saving()">
            {{ saving() ? t('Creating Follow-up…', 'جارٍ الحفظ والإنشاء…') : t('Create Follow-up', 'حفظ وإنشاء المتابعة') }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class FollowUpFormComponent {
  private readonly api = inject(CrmApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly users = signal<CrmUser[]>([]);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly types = [1, 2, 3, 4, 5, 6, 7, 8];

  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: [
      inject(ActivatedRoute).snapshot.queryParamMap.get('patientId') ?? '',
      Validators.required,
    ],
    assignedToUserId: ['', Validators.required],
    type: [8, Validators.required],
    dueDate: [new Date(Date.now() + 86400000).toISOString().slice(0, 10), Validators.required],
    dueTime: ['10:00', Validators.required],
    title: ['', Validators.required],
    notes: '',
    relatedAppointmentId: '',
    relatedTreatmentPlanId: '',
    relatedTreatmentId: '',
    relatedPrescriptionId: '',
  });

  constructor() {
    this.api.users().subscribe((x) => {
      this.users.set(x);
      if (x.length === 1) this.form.controls.assignedToUserId.setValue(x[0].id);
    });
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const x = this.form.getRawValue();
    if (!validFollowUp({ ...x, type: Number(x.type) })) return;
    this.saving.set(true);
    this.api
      .create({
        ...x,
        type: Number(x.type),
        notes: x.notes || undefined,
        relatedAppointmentId: x.relatedAppointmentId || undefined,
        relatedTreatmentPlanId: x.relatedTreatmentPlanId || undefined,
        relatedTreatmentId: x.relatedTreatmentId || undefined,
        relatedPrescriptionId: x.relatedPrescriptionId || undefined,
      })
      .subscribe({
        next: (r) =>
          this.router.navigate(['/crm/follow-ups', r.id], {
            state: { message: this.t('Follow-up created successfully.', 'تم إنشاء المتابعة بنجاح.') },
          }),
        error: () => {
          this.error.set(this.t('Follow-up could not be created. Please verify fields.', 'تعذر إنشاء المتابعة. يرجى مراجعة الحقول.'));
          this.saving.set(false);
        },
      });
  }

  type(x: number) {
    return followUpType(x, this.i18n.language() === 'ar');
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

