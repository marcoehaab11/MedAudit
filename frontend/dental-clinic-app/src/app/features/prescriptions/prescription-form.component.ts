import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { parseApiError } from '../../core/error-util';
import { LocalizationService } from '../../core/localization.service';
import { DoctorSelectComponent } from '../../shared/doctor-select.component';
import { PatientSelectComponent } from '../../shared/patient-select.component';
import {
  isCompleteDraftItem,
  DraftPrescriptionItem,
  removeDraftItem,
  reorderDraftItems,
} from './prescription-draft';
import {
  Medication,
  PrescriptionApiService,
  PrescriptionItem,
  PrescriptionItemInput,
} from './prescription-api.service';

import { parseMedicationNotes } from './medication-catalog-page.component';

@Component({
  styleUrl: './prescriptions.scss',
  selector: 'app-prescription-form',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    PatientSelectComponent,
    DoctorSelectComponent,
  ],
  template: `
    <div class="prescription-form-page">
      <a class="back-link" routerLink="/prescriptions">
        ← {{ t('Back to prescriptions', 'العودة لقائمة الروشتات') }}
      </a>

      @if (loading()) {
        <div class="state">{{ t('Loading prescription details…', 'جارٍ تحميل بيانات الروشتة…') }}</div>
      } @else {
        <!-- Page Header -->
        <header class="form-page-header">
          <div class="header-icon-wrap">💊</div>
          <div>
            <p class="eyebrow">{{ id ? t('Prescription Edit', 'تعديل الوصفة') : t('Clinical Prescription', 'الوصفات الطبية السريرية') }}</p>
            <h1>{{ id ? t('Edit Prescription', 'تعديل الوصفة الطبية') : t('Write New Prescription', 'تحرير روشتة طبية جديدة') }}</h1>
            <p class="header-desc">{{ t('Select patient, attending doctor, and add prescribed medications with clear dosage instructions.', 'حدد المريض والطبيب المعالج، ثم أضف الأدوية والجرعات وتعليمات الاستخدام بدقة.') }}</p>
          </div>
        </header>

        @if (error()) {
          <div class="alert error" role="alert">
            <span class="alert-icon">⚠️</span>
            <span>{{ error() }}</span>
          </div>
        }

        <!-- ── Section 1: Patient & Doctor Info ── -->
        <form class="panel form-section-panel main-details-panel" [formGroup]="form" (ngSubmit)="id ? saveHeader() : create()">
          <div class="section-title-bar">
            <h3>{{ t('Prescription Header Information', 'بيانات الوصفة الأساسية') }}</h3>
          </div>

          <div class="main-info-grid">
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
                <span>{{ t('Attending Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
              </label>
              <app-doctor-select
                formControlName="doctorProfileId"
                [allowClear]="false"
                [isInvalid]="form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid"
              />
              @if (form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid) {
                <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
              }
            </div>
          </div>

          <!-- Prescription Notes -->
          <div class="field-item notes-field-wrap">
            <label class="field-label">
              <span>{{ t('General Prescription Notes / Instructions', 'ملاحظات وإرشادات عامة للمريض') }}</span>
            </label>
            <textarea
              class="form-textarea"
              rows="2"
              formControlName="notes"
              [placeholder]="t('e.g. Take medicines after meals, avoid cold drinks, review in 7 days…', 'مثال: تناول الأدوية بانتظام بعد الأكل، تجنب المشروبات الباردة، المراجعة بعد أسبوع…')"
            ></textarea>
          </div>

          @if (id) {
            <div class="form-actions-inline">
              <button type="submit" class="button primary" [disabled]="saving()">
                {{ t('Save Prescription Header', 'حفظ بيانات الوصفة الأساسية') }}
              </button>
            </div>
          }
        </form>

        <!-- ── Section 2: Medication Items List ── -->
        <section class="panel form-section-panel meds-section-panel">
          <div class="meds-header-bar">
            <div class="title-with-badge">
              <h3>{{ t('Prescribed Medications', 'قائمة الأدوية الموصوفة') }}</h3>
              <span class="count-pill">{{ rows().length }} {{ t('items', 'أدوية') }}</span>
            </div>
            <div class="header-side-actions">
              <a routerLink="/medications-catalog" target="_blank" class="catalog-link-btn" [title]="t('Manage Medications & Dosages Directory', 'إدارة جدول ودليل الأدوية والجرعات')">
                📚 {{ t('Medications Directory', 'دليل وجدول الأدوية') }}
              </a>
              <button type="button" class="btn-add-item" (click)="addRow()">
                + {{ t('Add Medication', 'إضافة دواء') }}
              </button>
            </div>
          </div>

          <!-- Quick Presets Bar -->
          @if (medications().length > 0) {
            <div class="rx-quick-chips-bar">
              <span class="chip-bar-label">⚡ {{ t('Quick Pick:', 'إضافة سريعة:') }}</span>
              <div class="chips-scroll">
                @for (m of medications().slice(0, 8); track m.id) {
                  <button type="button" class="rx-quick-chip" (click)="addMedicationPreset(m)">
                    + {{ getMedDisplayName(m) }}
                  </button>
                }
              </div>
            </div>
          }

          <div class="med-cards-container">
            @for (row of rows(); track $index; let index = $index) {
              <article class="med-draft-card">
                <!-- Card Header -->
                <div class="med-card-top-bar">
                  <div class="med-top-title-group">
                    <span class="med-index-badge">#{{ index + 1 }}</span>
                    @if (row.medicationId) {
                      <span class="autofill-badge">⚡ {{ t('Auto-filled from Catalog', 'تم التعبئة تلقائياً من الدليل') }}</span>
                    }
                  </div>
                  <div class="card-reorder-actions">
                    <button
                      type="button"
                      class="btn-arrow"
                      (click)="move(index, -1)"
                      [disabled]="index === 0"
                      [title]="t('Move up', 'تحريك لأعلى')"
                    >↑</button>
                    <button
                      type="button"
                      class="btn-arrow"
                      (click)="move(index, 1)"
                      [disabled]="index === rows().length - 1"
                      [title]="t('Move down', 'تحريك لأسفل')"
                    >↓</button>
                    @if (rows().length > 1 || id) {
                      <button
                        class="btn-delete"
                        type="button"
                        (click)="remove(index)"
                        [title]="t('Remove medication', 'إزالة الدواء')"
                      >
                        ✕ {{ t('Remove', 'حذف') }}
                      </button>
                    }
                  </div>
                </div>

                <!-- Primary Row: Name / Select, Dose, Frequency, Duration -->
                <div class="med-grid-row-1">
                  <div class="input-cell med-name-cell">
                    <label class="cell-label">
                      {{ t('Medication (Select from Catalog or Type)', 'الدواء (اختر من الدليل أو اكتب)') }} <strong class="req">*</strong>
                    </label>
                    <div class="med-select-hybrid-wrap">
                      <select
                        class="cell-select-dropdown"
                        [ngModel]="row.medicationId"
                        (ngModelChange)="onMedDropdownChange(row, $event)"
                      >
                        <option value="">{{ t('— Choose from registered medications… —', '— اختر من دليل الأدوية المسجلة للتعبئة الفورية —') }}</option>
                        @for (m of medications(); track m.id) {
                          <option [value]="m.id">{{ getMedDisplayName(m) }}</option>
                        }
                      </select>
                      <input
                        class="cell-input"
                        [attr.list]="'med-datalist-' + index"
                        [(ngModel)]="row.medicationName"
                        (input)="onMedNameTyped(row)"
                        (change)="onMedNameTyped(row)"
                        [placeholder]="t('Type or search medication name…', 'اكتب أو ابحث عن اسم الدواء…')"
                      />
                      <datalist [id]="'med-datalist-' + index">
                        @for (m of medications(); track m.id) {
                          <option [value]="getMedDisplayName(m)">{{ m.genericName ? '(' + m.genericName + ')' : '' }}</option>
                        }
                      </datalist>
                    </div>
                  </div>

                  <div class="input-cell">
                    <label class="cell-label">
                      {{ t('Dose', 'الجرعة') }} <strong class="req">*</strong>
                    </label>
                    <input
                      class="cell-input"
                      [(ngModel)]="row.dose"
                      [placeholder]="t('e.g. 1 tablet / 5ml', 'مثال: قرص واحد / 5 مل')"
                    />
                  </div>

                  <div class="input-cell">
                    <label class="cell-label">
                      {{ t('Frequency', 'التكرار') }} <strong class="req">*</strong>
                    </label>
                    <input
                      class="cell-input"
                      [(ngModel)]="row.frequency"
                      [placeholder]="t('e.g. Every 8 hours / 3 times daily', 'مثال: كل 8 ساعات / 3 مرات يومياً')"
                    />
                  </div>

                  <div class="input-cell">
                    <label class="cell-label">
                      {{ t('Duration', 'المدة') }} <strong class="req">*</strong>
                    </label>
                    <input
                      class="cell-input"
                      [(ngModel)]="row.duration"
                      [placeholder]="t('e.g. 5 days / 1 week', 'مثال: 5 أيام / أسبوع')"
                    />
                  </div>
                </div>

                <!-- Secondary Row: Instructions, Route, Quantity -->
                <div class="med-grid-row-2">
                  <div class="input-cell instructions-cell">
                    <label class="cell-label">
                      {{ t('Instructions & Precautions', 'تعليمات الاستخدام') }} <strong class="req">*</strong>
                    </label>
                    <input
                      class="cell-input"
                      [(ngModel)]="row.instructions"
                      [placeholder]="t('e.g. Take with a full glass of water after food', 'مثال: يؤخذ بعد الأكل مع كوب ماء كامل')"
                    />
                  </div>

                  <div class="input-cell">
                    <label class="cell-label">{{ t('Route', 'طريقة الاستخدام') }}</label>
                    <input
                      class="cell-input"
                      [(ngModel)]="row.route"
                      [placeholder]="t('e.g. Oral / Topical', 'مثال: فموي / موضعي')"
                    />
                  </div>

                  <div class="input-cell qty-cell">
                    <label class="cell-label">{{ t('Quantity', 'الكمية') }}</label>
                    <input
                      class="cell-input"
                      type="number"
                      min="1"
                      [(ngModel)]="row.quantity"
                      [placeholder]="t('1 pack', '1 عبوة')"
                    />
                  </div>
                </div>

                @if (id) {
                  <div class="item-save-row">
                    <button type="button" class="button primary sm" (click)="saveItem(row)">
                      {{ t('Save this item', 'حفظ هذا البند') }}
                    </button>
                  </div>
                }
              </article>
            }
          </div>

          @if (error()) {
            <div class="alert error" role="alert" style="margin-top: 1rem;">
              <span class="alert-icon">⚠️</span>
              <span>{{ error() }}</span>
            </div>
          }

          <!-- Bottom Footer Action Bar -->
          <div class="form-bottom-actions">
            <div class="actions-start">
              <button type="button" class="btn-add-another" (click)="addRow()">
                + {{ t('Add Another Medication', 'إضافة دواء آخر') }}
              </button>
            </div>

            <div class="actions-end">
              <a class="button btn-cancel" routerLink="/prescriptions">{{ t('Cancel', 'إلغاء') }}</a>
              @if (!id) {
                <button
                  type="button"
                  class="button primary btn-submit-main"
                  [disabled]="saving()"
                  (click)="create()"
                >
                  {{ saving() ? t('Creating Prescription…', 'جارٍ الحفظ والإنشاء…') : t('Save & Create Prescription', 'حفظ وإنشاء الوصفة الطبية') }}
                </button>
              }
            </div>
          </div>
        </section>
      }
    </div>
  `,
})
export class PrescriptionFormComponent {
  private readonly api = inject(PrescriptionApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(LocalizationService);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly loading = signal(!!this.id);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly medications = signal<Medication[]>([]);
  readonly rows = signal<DraftPrescriptionItem[]>([]);

  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: [this.route.snapshot.queryParamMap.get('patientId') ?? '', Validators.required],
    doctorProfileId: [
      this.route.snapshot.queryParamMap.get('doctorProfileId') ?? '',
      Validators.required,
    ],
    appointmentId: this.route.snapshot.queryParamMap.get('appointmentId') ?? '',
    examinationId: this.route.snapshot.queryParamMap.get('examinationId') ?? '',
    treatmentId: this.route.snapshot.queryParamMap.get('treatmentId') ?? '',
    notes: '',
    version: '',
  });

  constructor() {
    this.loadMedicationsCatalog();
    if (this.id) {
      this.reload();
    } else {
      this.addRow();
      this.loading.set(false);
    }
  }

  loadMedicationsCatalog() {
    this.api.medications('', undefined, false, 1, 100).subscribe((x) => this.medications.set(x.items ?? []));
  }

  getMedDisplayName(m: Medication): string {
    const meta = parseMedicationNotes(m.notes);
    if (meta.nameAr && meta.nameEn && meta.nameAr !== meta.nameEn) {
      return `${meta.nameAr} (${meta.nameEn})`;
    }
    return meta.nameAr || meta.nameEn || m.name;
  }

  onMedDropdownChange(row: DraftPrescriptionItem, medId: string) {
    if (!medId) return;
    const found = this.medications().find((m) => m.id === medId);
    if (found) {
      this.applyMedicationToRow(row, found);
    }
  }

  onMedNameTyped(row: DraftPrescriptionItem) {
    if (!row.medicationName) return;
    const typed = row.medicationName.trim().toLowerCase();
    const found = this.medications().find(
      (m) => {
        const meta = parseMedicationNotes(m.notes);
        return (
          m.name.toLowerCase() === typed ||
          `${m.name} ${m.strength || ''}`.trim().toLowerCase() === typed ||
          (meta.nameAr && meta.nameAr.toLowerCase() === typed) ||
          (meta.nameEn && meta.nameEn.toLowerCase() === typed) ||
          `${meta.nameAr || ''} (${meta.nameEn || ''})`.trim().toLowerCase() === typed
        );
      },
    );
    if (found) {
      this.applyMedicationToRow(row, found);
    }
  }

  applyMedicationToRow(row: DraftPrescriptionItem, found: Medication) {
    const meta = parseMedicationNotes(found.notes);
    row.medicationId = found.id;
    row.medicationName = this.getMedDisplayName(found);
    row.genericName = found.genericName;
    row.strength = found.strength;
    row.form = found.form;
    if (meta.defaultDose) row.dose = meta.defaultDose;
    if (meta.defaultFrequency) row.frequency = meta.defaultFrequency;
    if (meta.defaultDuration) row.duration = meta.defaultDuration;
    if (meta.defaultRoute) row.route = meta.defaultRoute;
    if (meta.defaultInstructions) row.instructions = meta.defaultInstructions;
  }

  addMedicationPreset(m: Medication) {
    const isAr = this.i18n.language() === 'ar';
    const meta = parseMedicationNotes(m.notes);
    const item: DraftPrescriptionItem = {
      medicationId: m.id,
      medicationName: this.getMedDisplayName(m),
      genericName: m.genericName,
      strength: m.strength,
      form: m.form,
      dose: meta.defaultDose || (isAr ? 'قرص واحد' : '1 tablet'),
      frequency: meta.defaultFrequency || (isAr ? 'كل 8 ساعات' : 'Every 8 hours'),
      duration: meta.defaultDuration || (isAr ? '5 أيام' : '5 days'),
      route: meta.defaultRoute || (isAr ? 'فموي' : 'Oral'),
      instructions: meta.defaultInstructions || (isAr ? 'بعد الأكل' : 'After meals'),
      quantity: 1,
      sortOrder: this.rows().length + 1,
    };
    // If first row is empty, replace it, otherwise append
    if (this.rows().length === 1 && !this.rows()[0].medicationName) {
      this.rows.set([item]);
    } else {
      this.rows.update((x) => [...x, item]);
    }
  }

  addRow() {
    const isAr = this.i18n.language() === 'ar';
    const item: DraftPrescriptionItem = {
      medicationId: '',
      medicationName: '',
      dose: isAr ? 'قرص واحد' : '1 tablet',
      frequency: isAr ? 'كل 8 ساعات (3 مرات يومياً)' : 'Every 8 hours (3 times/day)',
      duration: isAr ? '5 أيام' : '5 days',
      route: isAr ? 'فموي' : 'Oral',
      instructions: isAr ? 'بعد الأكل' : 'After meals',
      quantity: 1,
      sortOrder: this.rows().length + 1,
    };
    this.rows.update((x) => [...x, item]);
  }

  move(index: number, direction: number) {
    this.rows.update((items) => reorderDraftItems(items, index, direction));
  }

  remove(index: number) {
    const row = this.rows()[index];
    if (row.id && this.id) {
      if (!confirm(this.t('Remove this medication item?', 'إزالة بند الدواء؟'))) return;
      this.api
        .removeItem(this.id, row.id, this.form.controls.version.value)
        .subscribe({
          next: () => this.reload(),
          error: (err) => this.conflict(err),
        });
    } else {
      this.rows.update((items) => removeDraftItem(items, index));
    }
  }

  create() {
    this.form.markAllAsTouched();
    this.error.set('');

    if (this.form.invalid) {
      if (!this.form.controls.patientId.value) {
        this.error.set(this.t('Please select a patient.', 'يرجى اختيار المريض أولاً.'));
        return;
      }
      if (!this.form.controls.doctorProfileId.value) {
        this.error.set(this.t('Please select the attending doctor.', 'يرجى اختيار الطبيب المعالج.'));
        return;
      }
      this.error.set(this.t('Please complete the required prescription fields.', 'يرجى إكمال الحقول الإلزامية.'));
      return;
    }

    if (!this.rows().length) {
      this.error.set(this.t('Please add at least one medication to the prescription.', 'يرجى إضافة دواء واحد على الأقل للروشتة.'));
      return;
    }

    for (let i = 0; i < this.rows().length; i++) {
      const r = this.rows()[i];
      if (!this.valid(r, i + 1)) return;
    }

    this.saving.set(true);
    this.error.set('');
    const h = this.header();
    const sanitizedItems = this.rows().map((row, idx) => this.sanitizeItem(row, idx));

    this.api.create({ ...h, items: sanitizedItems }).subscribe({
      next: (x) =>
        this.router.navigate(['/prescriptions', x.id], {
          state: { message: this.t('Prescription draft created successfully.', 'تم إنشاء مسودة الوصفة الطبية بنجاح.') },
        }),
      error: (err) => {
        this.error.set(
          parseApiError(err, this.t('Prescription could not be created.', 'تعذر إنشاء الوصفة الطبية. يرجى مراجعة البيانات.')),
        );
        this.saving.set(false);
      },
    });
  }

  saveHeader() {
    this.form.markAllAsTouched();
    if (!this.id || this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    this.api
      .update(this.id, { ...this.header(), version: this.form.controls.version.value })
      .subscribe({
        next: () => this.reload(),
        error: (err) => this.conflict(err),
      });
  }

  saveItem(row: DraftPrescriptionItem) {
    if (!this.id || !this.valid(row)) return;
    this.saving.set(true);
    this.error.set('');
    const sanitized = this.sanitizeItem(row, row.sortOrder - 1);
    const call = row.id
      ? this.api.updateItem(this.id, { ...sanitized, id: row.id } as PrescriptionItem, this.form.controls.version.value)
      : this.api.addItem(this.id, sanitized, this.form.controls.version.value);
    call.subscribe({
      next: () => this.reload(),
      error: (err) => this.conflict(err),
    });
  }

  private sanitizeItem(row: DraftPrescriptionItem, index: number): PrescriptionItemInput {
    return {
      medicationId: row.medicationId && row.medicationId.trim() ? row.medicationId.trim() : undefined,
      medicationName: row.medicationName?.trim() || undefined,
      genericName: row.genericName?.trim() || undefined,
      strength: row.strength?.trim() || undefined,
      form: row.form != null ? Number(row.form) : undefined,
      dose: (row.dose || '').trim(),
      frequency: (row.frequency || '').trim(),
      duration: (row.duration || '').trim(),
      route: row.route?.trim() || undefined,
      instructions: (row.instructions || '').trim(),
      quantity: row.quantity != null && !isNaN(Number(row.quantity)) && Number(row.quantity) > 0 ? Number(row.quantity) : undefined,
      sortOrder: index + 1,
    };
  }

  private reload() {
    this.api.prescription(this.id!).subscribe({
      next: (x) => {
        this.form.setValue({
          patientId: x.patientId,
          doctorProfileId: x.doctorProfileId,
          appointmentId: x.appointmentId ?? '',
          examinationId: x.examinationId ?? '',
          treatmentId: x.treatmentId ?? '',
          notes: x.notes ?? '',
          version: x.version,
        });
        this.rows.set(x.items.map((v) => ({ ...v })));
        this.loading.set(false);
        this.saving.set(false);
      },
      error: () => {
        this.error.set(
          this.t('Draft not found or access denied.', 'المسودة غير موجودة أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }

  private header() {
    const v = this.form.getRawValue();
    return {
      patientId: v.patientId.trim(),
      doctorProfileId: v.doctorProfileId.trim(),
      appointmentId: v.appointmentId?.trim() ? v.appointmentId.trim() : undefined,
      examinationId: v.examinationId?.trim() ? v.examinationId.trim() : undefined,
      treatmentId: v.treatmentId?.trim() ? v.treatmentId.trim() : undefined,
      notes: v.notes?.trim() ? v.notes.trim() : undefined,
    };
  }

  private valid(x: DraftPrescriptionItem, index?: number) {
    const prefix = index ? `(#${index}) ` : '';
    if (!x.medicationName?.trim() && !x.medicationId) {
      this.error.set(this.t(`${prefix}Please enter or select a medication name.`, `${prefix}يرجى كتابة أو اختيار اسم الدواء.`));
      return false;
    }
    if (!x.dose?.trim()) {
      this.error.set(this.t(`${prefix}Please specify the dose for "${x.medicationName || 'medication'}".`, `${prefix}يرجى إدخال الجرعة للدواء "${x.medicationName || 'الدواء'}".`));
      return false;
    }
    if (!x.frequency?.trim()) {
      this.error.set(this.t(`${prefix}Please specify the frequency for "${x.medicationName || 'medication'}".`, `${prefix}يرجى إدخال تكرار الجرعة للدواء.`));
      return false;
    }
    if (!x.duration?.trim()) {
      this.error.set(this.t(`${prefix}Please specify the duration for "${x.medicationName || 'medication'}".`, `${prefix}يرجى إدخال مدة تناول الدواء.`));
      return false;
    }
    if (!x.instructions?.trim()) {
      this.error.set(this.t(`${prefix}Please specify instructions for "${x.medicationName || 'medication'}".`, `${prefix}يرجى إدخال تعليمات الاستخدام للدواء.`));
      return false;
    }
    return true;
  }

  private conflict(err?: unknown) {
    this.error.set(
      parseApiError(
        err,
        this.t(
          'The draft changed or the operation was rejected. Reload and try again.',
          'تغيرت المسودة أو رُفضت العملية. أعد التحميل وحاول مجددًا.',
        ),
      ),
    );
    this.saving.set(false);
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

