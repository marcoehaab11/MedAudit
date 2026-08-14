import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { PatientApiService, PatientDetails } from './patient-api.service';

type Tab = 'overview' | 'contact' | 'medical' | 'notes';
@Component({
  selector: 'app-patient-details',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: ` <a class="back" routerLink="/patients"
      >← {{ t('Back to patients', 'العودة إلى المرضى') }}</a
    >
    @if (loading()) {
      <div class="loading" role="status">{{ t('Loading patient…', 'جارٍ تحميل المريض…') }}</div>
    } @else if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    } @else if (patient()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ patient()!.patientNumber }}</p>
          <h1>{{ patient()!.firstName }} {{ patient()!.middleName }} {{ patient()!.lastName }}</h1>
          <p>{{ patient()!.phone }} · {{ patient()!.email || t('No email', 'لا يوجد بريد') }}</p>
        </div>
        <div class="head-actions">
          <span class="badge status-{{ patient()!.status }}">{{
            patient()!.status === 1 ? t('Active', 'نشط') : t('Archived', 'مؤرشف')
          }}</span>
          @if (patient()!.status === 1) {
            <a class="button" [routerLink]="['/patients', id, 'edit']">{{ t('Edit', 'تعديل') }}</a
            ><button class="danger" type="button" (click)="archive()">
              {{ t('Archive', 'أرشفة') }}
            </button>
          }
        </div>
      </section>
      @if (success()) {
        <div class="alert success" role="status">{{ success() }}</div>
      }
      <nav class="tabs" [attr.aria-label]="t('Patient sections', 'أقسام ملف المريض')">
        @for (item of tabs; track item.id) {
          <button type="button" [class.active]="tab() === item.id" (click)="tab.set(item.id)">
            {{ t(item.en, item.ar) }}
          </button>
        }
      </nav>
      @switch (tab()) {
        @case ('overview') {
          <div class="detail-grid">
            <section class="panel">
              <h2>{{ t('Personal information', 'البيانات الشخصية') }}</h2>
              <dl>
                <div>
                  <dt>{{ t('Date of birth', 'تاريخ الميلاد') }}</dt>
                  <dd>{{ patient()!.dateOfBirth | date: 'mediumDate' }}</dd>
                </div>
                <div>
                  <dt>{{ t('Gender', 'النوع') }}</dt>
                  <dd>{{ gender(patient()!.gender) }}</dd>
                </div>
                <div>
                  <dt>{{ t('Nationality', 'الجنسية') }}</dt>
                  <dd>{{ patient()!.nationality || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('Occupation', 'المهنة') }}</dt>
                  <dd>{{ patient()!.occupation || '—' }}</dd>
                </div>
              </dl>
            </section>
            <section class="panel">
              <h2>{{ t('Registration', 'التسجيل') }}</h2>
              <dl>
                <div>
                  <dt>{{ t('Patient number', 'رقم المريض') }}</dt>
                  <dd class="number">{{ patient()!.patientNumber }}</dd>
                </div>
                <div>
                  <dt>{{ t('Created', 'تاريخ الإنشاء') }}</dt>
                  <dd>{{ patient()!.createdAt | date: 'medium' }}</dd>
                </div>
                <div>
                  <dt>{{ t('Last updated', 'آخر تحديث') }}</dt>
                  <dd>{{ patient()!.updatedAt | date: 'medium' }}</dd>
                </div>
              </dl>
            </section>
          </div>
        }
        @case ('contact') {
          <div class="detail-grid">
            <section class="panel">
              <h2>{{ t('Contact', 'بيانات الاتصال') }}</h2>
              <dl>
                <div>
                  <dt>{{ t('Phone', 'الهاتف') }}</dt>
                  <dd>{{ patient()!.phone }}</dd>
                </div>
                <div>
                  <dt>{{ t('Alternate phone', 'هاتف بديل') }}</dt>
                  <dd>{{ patient()!.alternatePhone || '—' }}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{{ patient()!.email || '—' }}</dd>
                </div>
                <div>
                  <dt>{{ t('Address', 'العنوان') }}</dt>
                  <dd>
                    {{ patient()!.address || '—' }}, {{ patient()!.city || '—' }},
                    {{ patient()!.country || '—' }}
                  </dd>
                </div>
              </dl>
            </section>
            <section class="panel">
              <h2>{{ t('Emergency contact', 'جهة اتصال للطوارئ') }}</h2>
              <p>
                <strong>{{ patient()!.emergencyContactName || '—' }}</strong>
              </p>
              <p>{{ patient()!.emergencyContactPhone || '—' }}</p>
            </section>
          </div>
        }
        @case ('medical') {
          @if (!patient()!.canViewMedicalInformation) {
            <div class="panel restricted">
              <strong>{{ t('Medical history is restricted', 'السجل الطبي مقيّد') }}</strong>
              <p>
                {{
                  t(
                    'Your role does not include permission to view clinical history.',
                    'دورك لا يتضمن صلاحية عرض السجل الطبي.'
                  )
                }}
              </p>
            </div>
          } @else {
            <div class="medical-grid">
              <section class="panel">
                <h2>{{ t('Allergies', 'الحساسية') }}</h2>
                <div class="chips">
                  @for (item of patient()!.allergies; track item.id) {
                    <span
                      >{{ item.name }}
                      @if (canEdit()) {
                        <button type="button" (click)="removeText('allergies', item.id)">×</button>
                      }
                    </span>
                  } @empty {
                    <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                  }
                </div>
                @if (canEdit()) {
                  <form [formGroup]="allergyForm" (ngSubmit)="addText('allergies')">
                    <input
                      formControlName="name"
                      [placeholder]="t('Allergy name', 'اسم الحساسية')"
                    /><button class="primary">{{ t('Add', 'إضافة') }}</button>
                  </form>
                }
              </section>
              <section class="panel">
                <h2>{{ t('Medical conditions', 'الحالات المرضية') }}</h2>
                <div class="chips">
                  @for (item of patient()!.medicalConditions; track item.id) {
                    <span
                      >{{ item.name }}
                      @if (canEdit()) {
                        <button type="button" (click)="removeText('conditions', item.id)">×</button>
                      }
                    </span>
                  } @empty {
                    <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                  }
                </div>
                @if (canEdit()) {
                  <form [formGroup]="conditionForm" (ngSubmit)="addText('conditions')">
                    <input
                      formControlName="name"
                      [placeholder]="t('Condition name', 'اسم الحالة')"
                    /><button class="primary">{{ t('Add', 'إضافة') }}</button>
                  </form>
                }
              </section>
              <section class="panel">
                <h2>{{ t('Current medications', 'الأدوية الحالية') }}</h2>
                <div class="record-list">
                  @for (item of patient()!.medications; track item.id) {
                    <div>
                      <span
                        ><strong>{{ item.name }}</strong
                        ><small>{{ item.dosage || '—' }}</small></span
                      >
                      @if (canEdit()) {
                        <button class="icon" type="button" (click)="removeMedication(item.id)">
                          ×
                        </button>
                      }
                    </div>
                  } @empty {
                    <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                  }
                </div>
                @if (canEdit()) {
                  <form [formGroup]="medicationForm" (ngSubmit)="addMedication()">
                    <input
                      formControlName="name"
                      [placeholder]="t('Medication', 'اسم الدواء')"
                    /><input
                      formControlName="dosage"
                      [placeholder]="t('Dosage', 'الجرعة')"
                    /><button class="primary">{{ t('Add', 'إضافة') }}</button>
                  </form>
                }
              </section>
              <section class="panel">
                <h2>{{ t('Previous surgeries', 'العمليات السابقة') }}</h2>
                <div class="record-list">
                  @for (item of patient()!.surgeries; track item.id) {
                    <div>
                      <span
                        ><strong>{{ item.procedure }}</strong
                        ><small>{{ item.procedureDate || '—' }}</small></span
                      >
                      @if (canEdit()) {
                        <button class="icon" type="button" (click)="removeSurgery(item.id)">
                          ×
                        </button>
                      }
                    </div>
                  } @empty {
                    <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                  }
                </div>
                @if (canEdit()) {
                  <form [formGroup]="surgeryForm" (ngSubmit)="addSurgery()">
                    <input
                      formControlName="procedure"
                      [placeholder]="t('Procedure', 'اسم العملية')"
                    /><input type="date" formControlName="procedureDate" /><button class="primary">
                      {{ t('Add', 'إضافة') }}
                    </button>
                  </form>
                }
              </section>
            </div>
          }
        }
        @case ('notes') {
          <div class="detail-grid">
            <section class="panel">
              <h2>{{ t('Administrative notes', 'ملاحظات إدارية') }}</h2>
              <p class="pre">
                {{ patient()!.notes || t('No notes recorded.', 'لا توجد ملاحظات.') }}
              </p>
            </section>
            @if (patient()!.canViewMedicalInformation) {
              <section class="panel">
                <h2>{{ t('Medical notes', 'ملاحظات طبية') }}</h2>
                @if (canEdit()) {
                  <form [formGroup]="notesForm" (ngSubmit)="saveMedicalNotes()">
                    <textarea rows="8" formControlName="medicalNotes" maxlength="4000"></textarea
                    ><button class="primary">
                      {{ t('Save medical notes', 'حفظ الملاحظات الطبية') }}
                    </button>
                  </form>
                } @else {
                  <p class="pre">
                    {{ patient()!.medicalNotes || t('No notes recorded.', 'لا توجد ملاحظات.') }}
                  </p>
                }
              </section>
            }
          </div>
        }
      }
    }`,
  styleUrl: './patients.scss',
})
export class PatientDetailsComponent {
  private readonly api = inject(PatientApiService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly i18n = inject(LocalizationService);
  readonly patient = signal<PatientDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal(history.state.success ?? '');
  readonly tab = signal<Tab>('overview');
  readonly tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'overview', en: 'Overview', ar: 'نظرة عامة' },
    { id: 'contact', en: 'Contact', ar: 'الاتصال' },
    { id: 'medical', en: 'Medical history', ar: 'السجل الطبي' },
    { id: 'notes', en: 'Notes', ar: 'الملاحظات' },
  ];
  readonly allergyForm = inject(FormBuilder).nonNullable.group({ name: ['', Validators.required] });
  readonly conditionForm = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
  });
  readonly medicationForm = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    dosage: '',
  });
  readonly surgeryForm = inject(FormBuilder).nonNullable.group({
    procedure: ['', Validators.required],
    procedureDate: '',
  });
  readonly notesForm = inject(FormBuilder).nonNullable.group({ medicalNotes: '' });
  constructor() {
    this.load();
  }
  load(): void {
    this.api.patient(this.id).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.notesForm.setValue({ medicalNotes: p.medicalNotes ?? '' });
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
  archive(): void {
    if (
      !confirm(
        this.t(
          'Archive this patient? They will disappear from normal lists and cannot be edited.',
          'هل تريد أرشفة هذا المريض؟ سيختفي من القوائم العادية ولن يمكن تعديله.',
        ),
      )
    )
      return;
    this.api.archive(this.id).subscribe({
      next: () => {
        this.success.set(this.t('Patient archived.', 'تمت أرشفة المريض.'));
        this.load();
      },
      error: () => this.failed(),
    });
  }
  addText(kind: 'allergies' | 'conditions'): void {
    const form = kind === 'allergies' ? this.allergyForm : this.conditionForm;
    if (form.invalid) return;
    this.api.addText(this.id, kind, form.getRawValue()).subscribe({
      next: () => {
        form.reset();
        this.load();
      },
      error: () => this.failed(),
    });
  }
  removeText(kind: 'allergies' | 'conditions', itemId: string): void {
    this.api
      .removeText(this.id, kind, itemId)
      .subscribe({ next: () => this.load(), error: () => this.failed() });
  }
  addMedication(): void {
    if (this.medicationForm.invalid) return;
    const v = this.medicationForm.getRawValue();
    this.api.addMedication(this.id, { name: v.name, dosage: v.dosage || undefined }).subscribe({
      next: () => {
        this.medicationForm.reset();
        this.load();
      },
      error: () => this.failed(),
    });
  }
  removeMedication(itemId: string): void {
    this.api
      .removeMedication(this.id, itemId)
      .subscribe({ next: () => this.load(), error: () => this.failed() });
  }
  addSurgery(): void {
    if (this.surgeryForm.invalid) return;
    const v = this.surgeryForm.getRawValue();
    this.api
      .addSurgery(this.id, { procedure: v.procedure, procedureDate: v.procedureDate || undefined })
      .subscribe({
        next: () => {
          this.surgeryForm.reset();
          this.load();
        },
        error: () => this.failed(),
      });
  }
  removeSurgery(itemId: string): void {
    this.api
      .removeSurgery(this.id, itemId)
      .subscribe({ next: () => this.load(), error: () => this.failed() });
  }
  saveMedicalNotes(): void {
    this.api.updateMedicalNotes(this.id, this.notesForm.getRawValue().medicalNotes).subscribe({
      next: () => {
        this.success.set(this.t('Medical notes saved.', 'تم حفظ الملاحظات الطبية.'));
        this.load();
      },
      error: () => this.failed(),
    });
  }
  canEdit() {
    return this.patient()?.canEditMedicalInformation && this.patient()?.status === 1;
  }
  gender(value: number) {
    return value === 1
      ? this.t('Female', 'أنثى')
      : value === 2
        ? this.t('Male', 'ذكر')
        : value === 3
          ? this.t('Other', 'آخر')
          : this.t('Not specified', 'غير محدد');
  }
  failed() {
    this.error.set(
      this.t(
        'The change was rejected. Check your permissions.',
        'تم رفض التغيير. تحقق من صلاحياتك.',
      ),
    );
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
