import { PatientClinicalHistoryComponent } from './patient-clinical-history.component';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { PatientApiService, PatientDetails } from './patient-api.service';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { PatientDentalSummaryComponent } from '../dental/patient-dental-summary.component';
import { PatientTreatmentSummaryComponent } from '../treatments/patient-treatment-summary.component';
import { PatientPrescriptionSummaryComponent } from '../prescriptions/patient-prescription-summary.component';
import { PatientCrmSummaryComponent } from '../crm/patient-crm-summary.component';
import { PatientFinanceSummaryComponent } from '../finance/patient-finance-summary.component';
import { PatientDossierModalComponent } from './patient-dossier-modal.component';
import { PatientVisitHistorySheetComponent } from './patient-visit-history-sheet.component';
import { MedicalAlertModalComponent } from '../../shared/medical-alert-modal/medical-alert-modal.component';
import { TreatmentApiService } from '../treatments/treatment-api.service';
import { AuthService } from '../../core/auth.service';

type Tab = 'timeline' | 'overview' | 'contact' | 'medical' | 'notes';
@Component({
  selector: 'app-patient-details',
  standalone: true,
  imports: [
    PatientClinicalHistoryComponent,
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    DateInputComponent,
    PatientDentalSummaryComponent,
    PatientTreatmentSummaryComponent,
    PatientPrescriptionSummaryComponent,
    PatientCrmSummaryComponent,
    PatientFinanceSummaryComponent,
    PatientDossierModalComponent,
    PatientVisitHistorySheetComponent,
    MedicalAlertModalComponent,
  ],
  template: ` <div class="patient-details-page">
    <a class="back" routerLink="/patients"
      ><span aria-hidden="true">{{ i18n.language() === 'ar' ? '→' : '←' }}</span>
      {{ t('Back to patients', 'العودة إلى المرضى') }}</a
    >
    @if (loading()) {
      <div class="loading" role="status">{{ t('Loading patient…', 'جارٍ تحميل المريض…') }}</div>
    } @else if (error()) {
      <div class="panel patient-load-error" role="alert">
        <h1>{{ t('Patient file unavailable', 'تعذر عرض ملف المريض') }}</h1>
        <p>{{ error() }}</p>
        <button type="button" (click)="load()">{{ t('Try again', 'حاول مرة أخرى') }}</button>
      </div>
    } @else if (patient()) {
      <header class="workspace-page-head patient-profile-header">
        <div class="patient-identity">
          <div class="patient-avatar" aria-hidden="true">
            {{ patient()!.firstName.charAt(0) }}{{ patient()!.lastName.charAt(0) }}
          </div>
          <div class="patient-identity-copy">

            <h1>
              {{ patient()!.firstName }} {{ patient()!.middleName }} {{ patient()!.lastName }}
            </h1>
            <div class="patient-contact-line">
              <bdi>{{ patient()!.phone }}</bdi
              ><span aria-hidden="true">·</span
              ><bdi>{{ patient()!.email || t('No email recorded', 'لا يوجد بريد مسجل') }}</bdi>
            </div>
            <div class="patient-statuses">
              <span class="badge clinical-lifecycle-badge {{ patientClinicalStatus() }}">
                @if (patientClinicalStatus() === 'in_treatment') {
                  {{ t('Under treatment', 'قيد العلاج') }}
                } @else if (patientClinicalStatus() === 'completed') {
                  {{ t('Treatment completed', 'مكتمل العلاج') }}
                } @else {
                  {{ t('New patient', 'مريض جديد') }}
                }
              </span>
              <span class="badge status-{{ patient()!.status }}">{{
                patient()!.status === 1 ? t('Active', 'نشط') : t('Archived', 'مؤرشف')
              }}</span>
            </div>
          </div>
        </div>
        <div class="patient-primary-actions">
          @if (patient()!.status === 1 && auth.hasPermission('Appointments.Create')) {
            <a
              class="button primary"
              routerLink="/appointments/create"
              [queryParams]="{ patientId: id }"
              >{{ t('Book appointment', 'حجز موعد') }}</a
            >
          }
          @if (patient()!.status === 1 && auth.hasPermission('Patients.Edit')) {
            <a class="button" [routerLink]="['/patients', id, 'edit']">{{
              t('Edit patient', 'تعديل بيانات المريض')
            }}</a>
          }
        </div>
      </header>
      @if (auth.hasPermission('Patients.ViewMedicalHistory') && hasMedicalAlerts()) {
        <section
          class="patient-alert-summary"
          [attr.aria-label]="t('Medical alerts', 'التنبيهات الطبية')"
        >
          <div>
            <strong
              >{{ totalAlertsCount() }}
              {{ t('medical alerts to review', 'تنبيهات طبية للمراجعة') }}</strong
            >
            <p>
              {{
                t(
                  'Review recorded allergies, conditions and medications before care.',
                  'راجع الحساسية والحالات المرضية والأدوية المسجلة قبل العلاج.'
                )
              }}
            </p>
          </div>
          <button type="button" (click)="openMedicalAlertModal()">
            {{ t('Review alerts', 'مراجعة التنبيهات') }}
          </button>
        </section>
      }
      <nav class="patient-tools" [attr.aria-label]="t('Patient tools', 'أدوات ملف المريض')">
        @if (auth.hasPermission('Patients.ViewMedicalHistory')) {
          <button type="button" (click)="showVisitHistorySheet.set(true)">
            {{ t('Past visits', 'الزيارات السابقة') }}
          </button>
        }
        <button type="button" (click)="showDossierModal.set(true)">
          {{ t('Full dossier & PDF', 'الملف الشامل و PDF') }}
        </button>
        @if (
          auth.hasPermission('Lab.View') ||
          auth.hasPermission('Insurance.View') ||
          (patient()!.status === 1 && auth.hasPermission('Patients.Archive'))
        ) {
          <details class="patient-more-actions">
            <summary>{{ t('More actions', 'إجراءات أخرى') }}</summary>
            <div>
              @if (auth.hasPermission('Lab.View')) {
                <a class="button" routerLink="/lab" [queryParams]="{ patientId: id }">{{
                  t('Lab cases', 'طلبات المعمل')
                }}</a>
              }
              @if (auth.hasPermission('Insurance.View')) {
                <a class="button" routerLink="/insurance" [queryParams]="{ patientId: id }">{{
                  t('Insurance claims', 'مطالبات التأمين')
                }}</a>
              }
              @if (patient()!.status === 1 && auth.hasPermission('Patients.Archive')) {
                <button class="danger" type="button" (click)="archive()">
                  {{ t('Archive patient', 'أرشفة المريض') }}
                </button>
              }
            </div>
          </details>
        }
      </nav>
      @if (transferHistory() && auth.hasPermission('Patients.ViewMedicalHistory')) {
        <section
          class="alert"
          style="background:#eaf7f6;border:1px solid #b8e5e0;color:#174a4a;margin:14px 0;padding:16px;border-radius:12px"
        >
          <strong
            >{{ t('Transferred from', 'تم النقل من') }} {{ transferHistory().sourceBranch }}</strong
          >
          <p>
            {{
              t(
                'Previous clinical history is read-only. Old visits and payments remain in the original branch.',
                'التاريخ الطبي السابق للقراءة فقط. الزيارات والدفعات القديمة باقية في الفرع الأصلي.'
              )
            }}
          </p>
          <details>
            <summary>{{ t('View previous clinical history', 'عرض التاريخ الطبي السابق') }}</summary>
            @if (transferHistory().medicalNotes) {
              <p>
                <strong>{{ t('Medical notes', 'ملاحظات طبية') }}:</strong>
                {{ transferHistory().medicalNotes }}
              </p>
            }
            <p>
              {{ t('Allergies', 'الحساسية') }}: {{ transferHistory().allergies?.length || 0 }} ·
              {{ t('Past visits', 'الزيارات السابقة') }}:
              {{ transferHistory().appointments?.length || 0 }} · {{ t('Treatments', 'العلاجات') }}:
              {{ transferHistory().treatments?.length || 0 }}
            </p>
            @for (item of transferHistory().allergies || []; track item.id) {
              <p>⚠ {{ item.name }} — {{ item.notes }}</p>
            }
            @for (item of transferHistory().treatments || []; track item.id) {
              <p>{{ t('Treatment', 'علاج') }}: {{ item.treatmentName }} — {{ item.notes }}</p>
            }
          </details>
        </section>
      }
      @if (showVisitHistorySheet()) {
        <app-patient-visit-history-sheet
          [patientId]="id"
          (close)="showVisitHistorySheet.set(false)"
        />
      }
      @if (showDossierModal()) {
        <app-patient-dossier-modal [patientId]="id" (close)="showDossierModal.set(false)" />
      }
      @if (showMedicalAlertModal() && patient()) {
        <app-medical-alert-modal
          [patientName]="
            patient()!.firstName +
            ' ' +
            (patient()!.middleName ? patient()!.middleName + ' ' : '') +
            patient()!.lastName
          "
          [patientNumber]="patient()!.patientNumber"
          [gender]="patient()!.gender"
          [phone]="patient()!.phone"
          [allergies]="patientAllergies()"
          [conditions]="patientConditions()"
          [medications]="patientMedications()"
          (close)="closeMedicalAlertModal()"
        />
      }
      @if (success()) {
        <div class="alert success" role="status">{{ success() }}</div>
      }
      @if (operationError()) {
        <div class="alert error" role="alert">{{ operationError() }}</div>
      }
      <nav
        class="tabs patient-section-nav"
        [attr.aria-label]="t('Patient sections', 'أقسام ملف المريض')"
      >
        @for (item of tabs; track item.id) {
          @if (
            !['medical', 'timeline'].includes(item.id) ||
            auth.hasPermission('Patients.ViewMedicalHistory')
          ) {
            <button
              type="button"
              [class.active]="tab() === item.id"
              [attr.aria-pressed]="tab() === item.id"
              aria-controls="patient-section"
              [attr.data-section]="item.id"
              (click)="tab.set(item.id)"
            >
              {{ t(item.en, item.ar) }}
            </button>
          }
        }
      </nav>
      <section id="patient-section" class="patient-section" [attr.aria-label]="sectionTitle()">
        @switch (tab()) {
          @case ('timeline') {
            @if (patient()!.canViewMedicalInformation) {
              <app-patient-clinical-history [patientId]="id" />
            }
          }
          @case ('overview') {
            <div class="detail-grid">
              <section class="panel">
                <h2>{{ t('Personal information', 'البيانات الشخصية') }}</h2>
                <dl>
                  <div>
                    <dt>{{ t('Date of birth', 'تاريخ الميلاد') }}</dt>
                    <dd>{{ patient()!.dateOfBirth | date: 'dd/MM/yyyy' }}</dd>
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
                    <dd>{{ patient()!.createdAt | date: 'dd/MM/yyyy hh:mm a' }}</dd>
                  </div>
                  <div>
                    <dt>{{ t('Last updated', 'آخر تحديث') }}</dt>
                    <dd>{{ patient()!.updatedAt | date: 'dd/MM/yyyy hh:mm a' }}</dd>
                  </div>
                </dl>
              </section>
            </div>
            @if (auth.hasPermission('Dental.View')) {
              <app-patient-dental-summary [patientId]="id" />
            }
            @if (auth.hasPermission('Treatments.View')) {
              <app-patient-treatment-summary [patientId]="id" />
            }
            @if (auth.hasPermission('Prescriptions.View')) {
              <app-patient-prescription-summary [patientId]="id" />
            }
            @if (auth.hasPermission('CRM.View')) {
              <app-patient-crm-summary [patientId]="id" />
            }
            @if (auth.hasPermission('Finance.View')) {
              <app-patient-finance-summary [patientId]="id" />
            }
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
                    <dt>{{ t('Email', 'البريد الإلكتروني') }}</dt>
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
                          <button
                            type="button"
                            (click)="removeText('allergies', item.id)"
                            [attr.aria-label]="t('Remove allergy: ', 'حذف الحساسية: ') + item.name"
                          >
                            ×
                          </button>
                        }
                      </span>
                    } @empty {
                      <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                    }
                  </div>
                  @if (canEdit()) {
                    <form [formGroup]="allergyForm" (ngSubmit)="addText('allergies')">
                      <label class="workspace-filter-field"
                        ><span>{{ t('Allergy name', 'اسم الحساسية') }}</span>
                        <input
                          formControlName="name"
                          [placeholder]="t('Allergy name', 'اسم الحساسية')" /></label
                      ><button class="primary">{{ t('Add', 'إضافة') }}</button>
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
                          <button
                            type="button"
                            (click)="removeText('conditions', item.id)"
                            [attr.aria-label]="t('Remove condition: ', 'حذف الحالة: ') + item.name"
                          >
                            ×
                          </button>
                        }
                      </span>
                    } @empty {
                      <em>{{ t('None recorded', 'لا توجد بيانات') }}</em>
                    }
                  </div>
                  @if (canEdit()) {
                    <form [formGroup]="conditionForm" (ngSubmit)="addText('conditions')">
                      <label class="workspace-filter-field"
                        ><span>{{ t('Condition name', 'اسم الحالة') }}</span>
                        <input
                          formControlName="name"
                          [placeholder]="t('Condition name', 'اسم الحالة')" /></label
                      ><button class="primary">{{ t('Add', 'إضافة') }}</button>
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
                          <button
                            class="icon"
                            type="button"
                            (click)="removeMedication(item.id)"
                            [attr.aria-label]="t('Remove medication: ', 'حذف الدواء: ') + item.name"
                          >
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
                      <label class="workspace-filter-field"
                        ><span>{{ t('Medication name', 'اسم الدواء') }}</span
                        ><input
                          formControlName="name"
                          [placeholder]="t('Medication', 'اسم الدواء')" /></label
                      ><label class="workspace-filter-field"
                        ><span>{{ t('Dosage', 'الجرعة') }}</span
                        ><input
                          formControlName="dosage"
                          [placeholder]="t('Dosage', 'الجرعة')" /></label
                      ><button class="primary">{{ t('Add', 'إضافة') }}</button>
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
                          <button
                            class="icon"
                            type="button"
                            (click)="removeSurgery(item.id)"
                            [attr.aria-label]="
                              t('Remove surgery: ', 'حذف العملية: ') + item.procedure
                            "
                          >
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
                      <label class="workspace-filter-field"
                        ><span>{{ t('Procedure', 'اسم العملية') }}</span
                        ><input
                          formControlName="procedure"
                          [placeholder]="t('Procedure', 'اسم العملية')"
                      /></label>
                      <div class="workspace-filter-field">
                        <span>{{ t('Procedure date', 'تاريخ العملية') }}</span
                        ><app-date-input
                          [label]="t('Procedure date', 'تاريخ العملية')"
                          formControlName="procedureDate"
                        ></app-date-input>
                      </div>
                      <button class="primary">
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
                      <label class="workspace-filter-field"
                        ><span>{{ t('Medical notes', 'الملاحظات الطبية') }}</span
                        ><textarea
                          rows="8"
                          formControlName="medicalNotes"
                          maxlength="4000"
                        ></textarea></label
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
      </section>
    }
  </div>`,
  styleUrl: './patients.scss',
})
export class PatientDetailsComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(PatientApiService);
  private readonly http = inject(HttpClient);
  private readonly treatmentApi = inject(TreatmentApiService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly i18n = inject(LocalizationService);
  readonly patient = signal<PatientDetails | null>(null);
  readonly transferHistory = signal<any | null>(null);
  readonly patientClinicalStatus = signal<'new' | 'in_treatment' | 'completed'>('new');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly operationError = signal('');
  readonly success = signal(history.state?.success ?? '');
  readonly showVisitHistorySheet = signal(false);
  readonly showDossierModal = signal(false);
  readonly showMedicalAlertModal = signal(false);
  private alertModalAutoShown = false;
  readonly tab = signal<Tab>(
    this.auth.hasPermission('Patients.ViewMedicalHistory') ? 'timeline' : 'overview',
  );
  readonly tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'timeline', en: 'Medical timeline', ar: 'التاريخ الطبي الزمني' },
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

  sectionTitle(): string {
    const section = this.tabs.find((item) => item.id === this.tab())!;
    return this.t(section.en, section.ar);
  }

  hasMedicalAlerts(): boolean {
    const p = this.patient();
    if (!p) return false;
    return (
      (p.allergies?.length ?? 0) > 0 ||
      (p.medicalConditions?.length ?? 0) > 0 ||
      (p.medications?.length ?? 0) > 0
    );
  }

  totalAlertsCount(): number {
    const p = this.patient();
    if (!p) return 0;
    return (
      (p.allergies?.length ?? 0) + (p.medicalConditions?.length ?? 0) + (p.medications?.length ?? 0)
    );
  }

  patientAllergies(): string[] {
    return (this.patient()?.allergies ?? []).map((x) => x.name);
  }

  patientConditions(): string[] {
    return (this.patient()?.medicalConditions ?? []).map((x) => x.name);
  }

  patientMedications(): string[] {
    return (this.patient()?.medications ?? []).map(
      (x) => x.name + (x.dosage ? ` (${x.dosage})` : ''),
    );
  }

  openMedicalAlertModal(): void {
    this.showMedicalAlertModal.set(true);
  }

  closeMedicalAlertModal(): void {
    this.showMedicalAlertModal.set(false);
  }

  constructor() {
    this.load();
    if (this.auth.hasPermission('Patients.ViewMedicalHistory')) {
      this.http
        .get<any>(`/api/branches/patients/${this.id}/transfer-history`)
        .subscribe({ next: (value) => this.transferHistory.set(value) });
    }
  }
  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.operationError.set('');
    this.api.patient(this.id).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.notesForm.setValue({ medicalNotes: p.medicalNotes ?? '' });
        this.loading.set(false);

        if (!this.alertModalAutoShown && this.hasMedicalAlerts()) {
          this.alertModalAutoShown = true;
          this.showMedicalAlertModal.set(true);
        }

        this.treatmentApi.treatments({ patientId: this.id }).subscribe({
          next: (res) => {
            const items = res.items || [];
            if (items.some((t) => t.status === 3 || t.status === 1 || t.status === 2)) {
              this.patientClinicalStatus.set('in_treatment');
            } else if (items.some((t) => t.status === 4)) {
              this.patientClinicalStatus.set('completed');
            } else {
              this.patientClinicalStatus.set('new');
            }
          },
          error: () => {},
        });
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
    this.operationError.set(
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
