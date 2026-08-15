import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, CrmUser } from './crm-api.service';
import { followUpType } from './crm-labels';
import { validFollowUp } from './crm-ui';
@Component({
  selector: 'app-follow-up-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `<a class="back" routerLink="/crm/follow-ups"
      >← {{ t('Back to follow-ups', 'العودة للمتابعات') }}</a
    >
    <section class="page-head">
      <h1>{{ t('Create follow-up', 'إنشاء متابعة') }}</h1>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <form class="panel crm-form" [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <label>{{ t('Patient ID', 'رقم المريض') }}<input formControlName="patientId" /></label
        ><label
          >{{ t('Assigned to', 'مسند إلى')
          }}<select formControlName="assignedToUserId">
            <option value="">{{ t('Select user', 'اختر مستخدمًا') }}</option>
            @for (x of users(); track x.id) {
              <option [value]="x.id">{{ x.displayName }}</option>
            }
          </select></label
        ><label
          >{{ t('Type', 'النوع')
          }}<select formControlName="type">
            @for (x of types; track x) {
              <option [value]="x">{{ type(x) }}</option>
            }
          </select></label
        ><label
          >{{ t('Due date', 'تاريخ الاستحقاق')
          }}<input type="date" formControlName="dueDate" /></label
        ><label
          >{{ t('Due time', 'وقت الاستحقاق')
          }}<input type="time" formControlName="dueTime" /></label
        ><label class="wide">{{ t('Title', 'العنوان') }}<input formControlName="title" /></label
        ><label
          >{{ t('Appointment ID (optional)', 'رقم الموعد (اختياري)')
          }}<input formControlName="relatedAppointmentId" /></label
        ><label
          >{{ t('Treatment plan ID (optional)', 'رقم خطة العلاج (اختياري)')
          }}<input formControlName="relatedTreatmentPlanId" /></label
        ><label
          >{{ t('Treatment ID (optional)', 'رقم العلاج (اختياري)')
          }}<input formControlName="relatedTreatmentId" /></label
        ><label
          >{{ t('Prescription ID (optional)', 'رقم الوصفة (اختياري)')
          }}<input formControlName="relatedPrescriptionId" /></label
        ><label class="wide"
          >{{ t('Notes', 'ملاحظات') }}<textarea rows="4" formControlName="notes"></textarea>
        </label>
      </div>
      <button class="primary" [disabled]="form.invalid || saving()">
        {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Create follow-up', 'إنشاء المتابعة') }}
      </button>
    </form>`,
  styleUrl: './crm.scss',
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
    dueDate: ['', Validators.required],
    dueTime: ['09:00', Validators.required],
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
            state: { message: this.t('Follow-up created.', 'تم إنشاء المتابعة.') },
          }),
        error: () => {
          this.error.set(this.t('Follow-up could not be created.', 'تعذر إنشاء المتابعة.'));
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
