import { Component, Input, OnChanges, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import { Medication, PrescriptionApiService, PrescriptionList } from './prescription-api.service';
import { prescriptionStatus } from './prescription-labels';
import { DoctorSelectComponent } from '../../shared/doctor-select.component';

import { parseMedicationNotes } from './medication-catalog-page.component';

interface DraftItem {
  medicationId: string;
  medicationName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number;
}

@Component({
  styleUrl: './prescriptions.scss',
  selector: 'app-patient-prescription-summary',
  standalone: true,
  imports: [RouterLink, FormsModule, ReactiveFormsModule, DoctorSelectComponent],
  template: `
    <section class="panel prescription-summary-panel">
      <div class="summary-head">
        <div>
          <h2>{{ t('Recent prescriptions', 'أحدث الوصفات الطبية') }}</h2>
          <p class="section-desc">
            {{ t('Medications prescribed to this patient and dispensing statuses.', 'الأدوية الموصوفة للمريض وحالات الصرف.') }}
          </p>
        </div>
        <div class="summary-actions">
          <a class="button" routerLink="/prescriptions" [queryParams]="{ patientId }">
            {{ t('View all', 'عرض الكل') }}
          </a>
          <button
            type="button"
            class="button primary"
            [class.active-toggle]="showInlineForm()"
            (click)="toggleInlineForm()"
          >
            {{ showInlineForm() ? '▲ ' + t('Close Form', 'إغلاق النموذج') : '+ ' + t('New prescription', 'وصفة طبية جديدة') }}
          </button>
        </div>
      </div>

      @if (success()) {
        <div class="alert success" style="margin-block: 0.75rem;">{{ success() }}</div>
      }

      <!-- ── Inline Expandable Prescription Creation Form ── -->
      @if (showInlineForm()) {
        <div class="inline-creation-panel">
          <div class="inline-panel-header">
            <div class="header-left">
              <span class="panel-icon">💊</span>
              <div>
                <h4>{{ t('New Prescription', 'تحرير وصفة طبية جديدة') }}</h4>
                <p class="panel-sub">{{ t('Prescribe medications, dosages, and instructions directly in-place.', 'إضافة الأدوية والجرعات والتعليمات العلاجية للمريض مباشرة.') }}</p>
              </div>
            </div>
            <div class="header-right-tools">
              <button type="button" class="btn-popup-switch" (click)="openCreateModal()" [title]="t('Open in modal popup', 'فتح في نافذة منبثقة')">
                ⛶ {{ t('Popup', 'نافذة منبثقة') }}
              </button>
              <button type="button" class="btn-inline-close" (click)="toggleInlineForm()" [title]="t('Close', 'إغلاق')">✕</button>
            </div>
          </div>

          <form [formGroup]="form" (ngSubmit)="savePrescription()">
            @if (modalError()) {
              <div class="alert error" style="margin-bottom: 0.85rem;">{{ modalError() }}</div>
            }

            <!-- Doctor Select Field -->
            <div class="form-field-group" style="margin-bottom: 0.85rem;">
              <label class="field-label">
                <span>{{ t('Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
                <app-doctor-select
                  formControlName="doctorProfileId"
                  [allowClear]="false"
                  [isInvalid]="form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid"
                />
                @if (form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid) {
                  <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
                }
              </label>
            </div>

            <!-- Medications List Container -->
            <div class="medications-builder-container">
              <div class="builder-header">
                <div class="builder-title">
                  <strong>{{ t('Prescribed Medications', 'الأدوية الموصوفة') }} <span class="req">*</span></strong>
                  <span class="meds-count-badge">{{ rows().length }} {{ t('items', 'أدوية') }}</span>
                </div>
                <button type="button" class="btn-add-med" (click)="addRow()">
                  + {{ t('Add Medication', 'إضافة دواء') }}
                </button>
              </div>

              <!-- Quick Presets Bar -->
              @if (medications().length > 0) {
                <div class="rx-quick-chips-bar" style="margin-block-end: 0.75rem;">
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

              <div class="medication-cards-stack">
                @for (row of rows(); track $index; let i = $index) {
                  <div class="med-draft-card">
                    <div class="med-card-top">
                      <div class="med-card-num">
                        <span class="num-pill">#{{ i + 1 }}</span>
                        <span class="med-title-text">{{ row.medicationName || t('Medication', 'دواء') }}</span>
                        @if (row.medicationId) {
                          <span class="autofill-badge">⚡ {{ t('Auto-filled', 'تعبئة تلقائية') }}</span>
                        }
                      </div>
                      @if (rows().length > 1) {
                        <button type="button" class="btn-remove-med" (click)="removeRow(i)" [title]="t('Remove medication', 'حذف الدواء')">
                          ✕ {{ t('Remove', 'حذف') }}
                        </button>
                      }
                    </div>

                    <div class="med-inputs-grid-top">
                      <div class="field-item select-med-col">
                        <label class="input-lbl">{{ t('Select from Catalog', 'اختر من دليل الأدوية') }}</label>
                        <select class="form-input" [(ngModel)]="row.medicationId" [ngModelOptions]="{standalone: true}" (ngModelChange)="onMedSelect(row)">
                          <option value="">{{ t('— Choose Registered Medication —', '— اختر الدواء للتعبئة الفورية —') }}</option>
                          @for (m of medications(); track m.id) {
                            <option [value]="m.id">{{ getMedDisplayName(m) }}</option>
                          }
                        </select>
                      </div>

                      <div class="field-item name-med-col">
                        <label class="input-lbl">{{ t('Medication Name', 'اسم الدواء') }}</label>
                        <input
                          class="form-input"
                          [attr.list]="'inline-patient-med-list-' + i"
                          [(ngModel)]="row.medicationName"
                          [ngModelOptions]="{standalone: true}"
                          (input)="onMedNameTyped(row)"
                          [placeholder]="t('e.g. Augmentin 1g / أوجمنتين', 'مثال: أوجمنتين 1 جم')"
                        />
                        <datalist [id]="'inline-patient-med-list-' + i">
                          @for (m of medications(); track m.id) {
                            <option [value]="getMedDisplayName(m)">{{ m.genericName ? '(' + m.genericName + ')' : '' }}</option>
                          }
                        </datalist>
                      </div>

                      <div class="field-item dose-med-col">
                        <label class="input-lbl">{{ t('Dose', 'الجرعة') }}</label>
                        <input class="form-input" [(ngModel)]="row.dose" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 1 tablet', 'مثال: قرص واحد')" />
                      </div>
                    </div>

                    <div class="med-inputs-grid-bottom">
                      <div class="field-item">
                        <label class="input-lbl">{{ t('Frequency', 'التكرار') }}</label>
                        <input class="form-input" [(ngModel)]="row.frequency" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 3 times daily', 'مثال: 3 مرات يومياً')" />
                      </div>

                      <div class="field-item">
                        <label class="input-lbl">{{ t('Duration', 'المدة') }}</label>
                        <input class="form-input" [(ngModel)]="row.duration" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 5 days', 'مثال: 5 أيام')" />
                      </div>

                      <div class="field-item instructions-col">
                        <label class="input-lbl">{{ t('Instructions', 'تعليمات الاستخدام') }}</label>
                        <input class="form-input" [(ngModel)]="row.instructions" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. After meals with water', 'مثال: بعد الأكل مع ماء وفير')" />
                      </div>

                      <div class="field-item qty-col">
                        <label class="input-lbl">{{ t('Quantity', 'الكمية') }}</label>
                        <input class="form-input" type="number" min="1" [(ngModel)]="row.quantity" [ngModelOptions]="{standalone: true}" />
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>

            <!-- Prescription Notes -->
            <div class="form-field-group" style="margin-top: 0.85rem;">
              <label class="field-label">
                <span>{{ t('Prescription Notes / Advice', 'ملاحظات وتوجيهات الروشتة') }}</span>
                <textarea class="form-textarea" rows="2" formControlName="notes" [placeholder]="t('Special doctor notes, allergy precautions, or dietary advice…', 'أي نصائح إضافية، محاذير حساسية أو تعليمات غذائية للمريض…')"></textarea>
              </label>
            </div>

            <div class="inline-form-footer">
              <button type="button" class="button btn-cancel" (click)="toggleInlineForm()">{{ t('Cancel', 'إلغاء') }}</button>
              <button type="submit" class="button primary btn-save" [disabled]="saving() || form.invalid || !rows().length">
                {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Prescription', 'حفظ وطباعة الوصفة الطبية') }}
              </button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="summary-loading">
          <p>{{ t('Loading prescriptions…', 'جارٍ تحميل الوصفات…') }}</p>
        </div>
      } @else if (!items().length) {
        <div class="empty-summary-box">
          <p>{{ t('No prescriptions recorded yet for this patient.', 'لا توجد وصفات مسجلة بعد لهذا المريض.') }}</p>
          <button type="button" class="button primary" (click)="toggleInlineForm()">
            + {{ t('Create first prescription', 'إنشاء أول وصفة') }}
          </button>
        </div>
      } @else {
        <div class="summary-cards-list">
          @for (x of items(); track x.id) {
            <div class="summary-card-item">
              <div>
                <a class="item-title-link" [routerLink]="['/prescriptions', x.id]">{{ x.prescriptionNumber }}</a>
                <small class="item-sub">{{ x.doctorName }}</small>
              </div>
              <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
            </div>
          }
        </div>
      }
    </section>

    <!-- Create Prescription Popup Modal (Secondary Option) -->
    @if (showCreateModal()) {
      <div class="modal-backdrop" (click)="closeCreateModal()">
        <div class="modal-card modal-prescription-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-title-wrap">
              <span class="modal-badge-icon">💊</span>
              <div>
                <h3>{{ t('New Prescription', 'إنشاء وصفة طبية جديدة') }}</h3>
                <p class="modal-subtitle">{{ t('Prescribe medications and dosage instructions for the patient.', 'إضافة الأدوية والجرعات والتعليمات العلاجية للمريض.') }}</p>
              </div>
            </div>
            <button type="button" class="close-btn" (click)="closeCreateModal()" aria-label="Close">✕</button>
          </div>

          <form [formGroup]="form" (ngSubmit)="savePrescription()">
            <div class="modal-body">
              @if (modalError()) {
                <div class="alert error">{{ modalError() }}</div>
              }

              <!-- Doctor Select Field -->
              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
                  <app-doctor-select
                    formControlName="doctorProfileId"
                    [allowClear]="false"
                    [isInvalid]="form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid"
                  />
                  @if (form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid) {
                    <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
                  }
                </label>
              </div>

              <!-- Medications List Container -->
              <div class="medications-builder-container">
                <div class="builder-header">
                  <div class="builder-title">
                    <strong>{{ t('Prescribed Medications', 'الأدوية الموصوفة') }} <span class="req">*</span></strong>
                    <span class="meds-count-badge">{{ rows().length }} {{ t('items', 'أدوية') }}</span>
                  </div>
                  <button type="button" class="btn-add-med" (click)="addRow()">
                    + {{ t('Add Medication', 'إضافة دواء') }}
                  </button>
                </div>

                <!-- Quick Presets Bar -->
                @if (medications().length > 0) {
                  <div class="rx-quick-chips-bar" style="margin-block-end: 0.75rem;">
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

                <div class="medication-cards-stack">
                  @for (row of rows(); track $index; let i = $index) {
                    <div class="med-draft-card">
                      <div class="med-card-top">
                        <div class="med-card-num">
                          <span class="num-pill">#{{ i + 1 }}</span>
                          <span class="med-title-text">{{ row.medicationName || t('Medication', 'دواء') }}</span>
                          @if (row.medicationId) {
                            <span class="autofill-badge">⚡ {{ t('Auto-filled', 'تعبئة تلقائية') }}</span>
                          }
                        </div>
                        @if (rows().length > 1) {
                          <button type="button" class="btn-remove-med" (click)="removeRow(i)" [title]="t('Remove medication', 'حذف الدواء')">
                            ✕ {{ t('Remove', 'حذف') }}
                          </button>
                        }
                      </div>

                      <div class="med-inputs-grid-top">
                        <div class="field-item select-med-col">
                          <label class="input-lbl">{{ t('Select from Catalog', 'اختر من دليل الأدوية') }}</label>
                          <select class="form-input" [(ngModel)]="row.medicationId" [ngModelOptions]="{standalone: true}" (ngModelChange)="onMedSelect(row)">
                            <option value="">{{ t('— Choose Registered Medication —', '— اختر الدواء للتعبئة الفورية —') }}</option>
                            @for (m of medications(); track m.id) {
                              <option [value]="m.id">{{ getMedDisplayName(m) }}</option>
                            }
                          </select>
                        </div>

                        <div class="field-item name-med-col">
                          <label class="input-lbl">{{ t('Medication Name', 'اسم الدواء') }}</label>
                          <input
                            class="form-input"
                            [attr.list]="'patient-med-list-' + i"
                            [(ngModel)]="row.medicationName"
                            [ngModelOptions]="{standalone: true}"
                            (input)="onMedNameTyped(row)"
                            [placeholder]="t('e.g. Augmentin 1g / أوجمنتين', 'مثال: أوجمنتين 1 جم')"
                          />
                          <datalist [id]="'patient-med-list-' + i">
                            @for (m of medications(); track m.id) {
                              <option [value]="getMedDisplayName(m)">{{ m.genericName ? '(' + m.genericName + ')' : '' }}</option>
                            }
                          </datalist>
                        </div>

                        <div class="field-item dose-med-col">
                          <label class="input-lbl">{{ t('Dose', 'الجرعة') }}</label>
                          <input class="form-input" [(ngModel)]="row.dose" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 1 tablet', 'مثال: قرص واحد')" />
                        </div>
                      </div>

                      <div class="med-inputs-grid-bottom">
                        <div class="field-item">
                          <label class="input-lbl">{{ t('Frequency', 'التكرار') }}</label>
                          <input class="form-input" [(ngModel)]="row.frequency" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 3 times daily', 'مثال: 3 مرات يومياً')" />
                        </div>

                        <div class="field-item">
                          <label class="input-lbl">{{ t('Duration', 'المدة') }}</label>
                          <input class="form-input" [(ngModel)]="row.duration" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. 5 days', 'مثال: 5 أيام')" />
                        </div>

                        <div class="field-item instructions-col">
                          <label class="input-lbl">{{ t('Instructions', 'تعليمات الاستخدام') }}</label>
                          <input class="form-input" [(ngModel)]="row.instructions" [ngModelOptions]="{standalone: true}" [placeholder]="t('e.g. After meals with water', 'مثال: بعد الأكل مع ماء وفير')" />
                        </div>

                        <div class="field-item qty-col">
                          <label class="input-lbl">{{ t('Quantity', 'الكمية') }}</label>
                          <input class="form-input" type="number" min="1" [(ngModel)]="row.quantity" [ngModelOptions]="{standalone: true}" />
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Prescription Notes -->
              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Prescription Notes / Advice', 'ملاحظات وتوجيهات الروشتة') }}</span>
                  <textarea class="form-textarea" rows="2" formControlName="notes" [placeholder]="t('Special doctor notes, allergy precautions, or dietary advice…', 'أي نصائح إضافية، محاذير حساسية أو تعليمات غذائية للمريض…')"></textarea>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="button btn-cancel" (click)="closeCreateModal()">{{ t('Cancel', 'إلغاء') }}</button>
              <button type="submit" class="button primary btn-save" [disabled]="saving() || form.invalid || !rows().length">
                {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Prescription', 'حفظ وطباعة الوصفة الطبية') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PatientPrescriptionSummaryComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId = '';
  private readonly api = inject(PrescriptionApiService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<PrescriptionList[]>([]);
  readonly medications = signal<Medication[]>([]);
  readonly loading = signal(true);
  readonly showInlineForm = signal(false);
  readonly showCreateModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly success = signal('');

  readonly rows = signal<DraftItem[]>([]);

  readonly form = inject(FormBuilder).nonNullable.group({
    doctorProfileId: ['', Validators.required],
    notes: '',
  });

  ngOnInit() {
    this.fetchData();
    this.api.medications('', undefined, false, 1, 100).subscribe((x) => this.medications.set(x.items ?? []));
  }

  ngOnChanges() {
    if (this.patientId) {
      this.fetchData();
    }
  }

  getMedDisplayName(m: Medication): string {
    const meta = parseMedicationNotes(m.notes);
    if (meta.nameAr && meta.nameEn && meta.nameAr !== meta.nameEn) {
      return `${meta.nameAr} (${meta.nameEn})`;
    }
    return meta.nameAr || meta.nameEn || `${m.name} ${m.strength || ''}`.trim();
  }

  fetchData() {
    this.loading.set(true);
    this.api.prescriptions({ patientId: this.patientId, pageSize: '5' }).subscribe({
      next: (x) => {
        this.items.set(x.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  toggleInlineForm() {
    if (this.showInlineForm()) {
      this.showInlineForm.set(false);
    } else {
      this.modalError.set('');
      this.form.reset({
        doctorProfileId: '',
        notes: '',
      });
      this.rows.set([
        {
          medicationId: '',
          medicationName: '',
          dose: this.t('1 tablet', 'قرص واحد'),
          frequency: this.t('Every 8 hours (3 times/day)', 'كل 8 ساعات (3 مرات يومياً)'),
          duration: this.t('5 days', 'لمدة 5 أيام'),
          instructions: this.t('After meals', 'بعد الطعام'),
          quantity: 1,
        },
      ]);
      this.showInlineForm.set(true);
    }
  }

  openCreateModal() {
    this.showInlineForm.set(false);
    this.modalError.set('');
    this.form.reset({
      doctorProfileId: '',
      notes: '',
    });
    this.rows.set([
      {
        medicationId: '',
        medicationName: '',
        dose: this.t('1 tablet', 'قرص واحد'),
        frequency: this.t('Every 8 hours (3 times/day)', 'كل 8 ساعات (3 مرات يومياً)'),
        duration: this.t('5 days', 'لمدة 5 أيام'),
        instructions: this.t('After meals', 'بعد الطعام'),
        quantity: 1,
      },
    ]);
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  addRow() {
    this.rows.update((arr) => [
      ...arr,
      {
        medicationId: '',
        medicationName: '',
        dose: this.t('1 tablet', 'قرص واحد'),
        frequency: this.t('Twice daily', 'مرتين يومياً'),
        duration: this.t('5 days', 'لمدة 5 أيام'),
        instructions: this.t('After meals', 'بعد الطعام'),
        quantity: 1,
      },
    ]);
  }

  addMedicationPreset(m: Medication) {
    const meta = parseMedicationNotes(m.notes);
    const item: DraftItem = {
      medicationId: m.id,
      medicationName: this.getMedDisplayName(m),
      dose: meta.defaultDose || this.t('1 tablet', 'قرص واحد'),
      frequency: meta.defaultFrequency || this.t('Every 8 hours', 'كل 8 ساعات'),
      duration: meta.defaultDuration || this.t('5 days', 'لمدة 5 أيام'),
      instructions: meta.defaultInstructions || this.t('After meals', 'بعد الطعام'),
      quantity: 1,
    };
    if (this.rows().length === 1 && !this.rows()[0].medicationName) {
      this.rows.set([item]);
    } else {
      this.rows.update((arr) => [...arr, item]);
    }
  }

  removeRow(index: number) {
    this.rows.update((arr) => arr.filter((_, i) => i !== index));
  }

  onMedSelect(row: DraftItem) {
    const med = this.medications().find((m) => m.id === row.medicationId);
    if (med) {
      this.applyMedicationToRow(row, med);
    }
  }

  onMedNameTyped(row: DraftItem) {
    if (!row.medicationName) return;
    const typed = row.medicationName.trim().toLowerCase();
    const found = this.medications().find((m) => {
      const meta = parseMedicationNotes(m.notes);
      return (
        m.name.toLowerCase() === typed ||
        `${m.name} ${m.strength || ''}`.trim().toLowerCase() === typed ||
        (meta.nameAr && meta.nameAr.toLowerCase() === typed) ||
        (meta.nameEn && meta.nameEn.toLowerCase() === typed) ||
        `${meta.nameAr || ''} (${meta.nameEn || ''})`.trim().toLowerCase() === typed
      );
    });
    if (found) {
      this.applyMedicationToRow(row, found);
    }
  }

  applyMedicationToRow(row: DraftItem, med: Medication) {
    const meta = parseMedicationNotes(med.notes);
    row.medicationId = med.id;
    row.medicationName = this.getMedDisplayName(med);
    if (meta.defaultDose) row.dose = meta.defaultDose;
    if (meta.defaultFrequency) row.frequency = meta.defaultFrequency;
    if (meta.defaultDuration) row.duration = meta.defaultDuration;
    if (meta.defaultInstructions) row.instructions = meta.defaultInstructions;
  }

  savePrescription() {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.rows().length) return;

    this.saving.set(true);
    this.modalError.set('');
    this.success.set('');
    const v = this.form.getRawValue();

    const items = this.rows().map((r, idx) => ({
      medicationId: r.medicationId || undefined,
      medicationName: r.medicationName || this.t('Prescribed Medicine', 'دواء موصوف'),
      dose: r.dose || '1',
      frequency: r.frequency || 'Daily',
      duration: r.duration || '5 days',
      instructions: r.instructions || '',
      quantity: Number(r.quantity) || 1,
      sortOrder: idx + 1,
    }));

    this.api
      .create({
        patientId: this.patientId,
        doctorProfileId: v.doctorProfileId,
        notes: v.notes || undefined,
        items,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.showInlineForm.set(false);
          this.success.set(this.t('Prescription created successfully.', 'تم إنشاء الوصفة الطبية بنجاح.'));
          this.fetchData();
        },
        error: (err) => {
          this.saving.set(false);
          this.modalError.set(
            parseApiError(err, this.t('Failed to create prescription. Please check the fields.', 'تعذر حفظ الوصفة الطبية. يرجى مراجعة البيانات.')),
          );
        },
      });
  }

  status(x: number) {
    return prescriptionStatus(x, this.i18n.language() === 'ar');
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

