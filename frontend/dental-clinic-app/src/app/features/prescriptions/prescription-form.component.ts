import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { Medication, PrescriptionApiService, PrescriptionItem } from './prescription-api.service';
import { medicationForm } from './prescription-labels';
import {
  DraftPrescriptionItem,
  isCompleteDraftItem,
  newDraftItem,
  removeDraftItem,
  reorderDraftItems,
} from './prescription-draft';
@Component({
  selector: 'app-prescription-form',
  imports: [FormsModule, ReactiveFormsModule, RouterLink],
  template: `<a class="back" routerLink="/prescriptions"
      >← {{ t('Back to prescriptions', 'العودة للوصفات') }}</a
    >
    <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Prescription', 'وصفة طبية') }}</p>
        <h1>
          {{ id ? t('Edit draft', 'تعديل المسودة') : t('Create prescription', 'إنشاء وصفة') }}
        </h1>
      </div>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading…', 'جارٍ التحميل…') }}</div>
    } @else {
      <form class="panel prescription-form" [formGroup]="form" (ngSubmit)="saveHeader()">
        <div class="header-grid">
          <label>{{ t('Patient ID', 'رقم المريض') }}<input formControlName="patientId" /></label
          ><label
            >{{ t('Doctor profile ID', 'رقم ملف الطبيب')
            }}<input formControlName="doctorProfileId" /></label
          ><label
            >{{ t('Appointment ID (optional)', 'رقم الموعد (اختياري)')
            }}<input formControlName="appointmentId" /></label
          ><label
            >{{ t('Examination ID (optional)', 'رقم الفحص (اختياري)')
            }}<input formControlName="examinationId" /></label
          ><label
            >{{ t('Treatment ID (optional)', 'رقم العلاج (اختياري)')
            }}<input formControlName="treatmentId"
          /></label>
        </div>
        <label
          >{{ t('Notes', 'ملاحظات') }}<textarea rows="3" formControlName="notes"></textarea>
        </label>
        @if (id) {
          <button class="primary" [disabled]="form.invalid || saving()">
            {{ t('Save draft header', 'حفظ بيانات المسودة') }}
          </button>
        }
      </form>
      <section class="panel">
        <div class="summary-head">
          <h2>{{ t('Medication items', 'بنود الدواء') }}</h2>
          <button type="button" (click)="addRow()">{{ t('Add medication', 'إضافة دواء') }}</button>
        </div>
        <label
          >{{ t('Search medication catalog', 'بحث في كتالوج الأدوية')
          }}<input [(ngModel)]="search" (ngModelChange)="searchMedications()"
        /></label>
        @for (row of rows(); track row.id || $index; let index = $index) {
          <article class="medication-row">
            <div class="row-head">
              <strong
                >{{ index + 1 }}.
                {{ row.medicationName || t('New medication', 'دواء جديد') }}</strong
              ><span
                ><button type="button" (click)="move(index, -1)" [disabled]="index === 0">↑</button
                ><button
                  type="button"
                  (click)="move(index, 1)"
                  [disabled]="index === rows().length - 1"
                >
                  ↓</button
                ><button class="danger" type="button" (click)="remove(index)">
                  {{ t('Remove', 'إزالة') }}
                </button></span
              >
            </div>
            <div class="item-grid">
              <label
                >{{ t('Catalog medication', 'دواء من الكتالوج')
                }}<select [(ngModel)]="row.medicationId" (ngModelChange)="choose(row)">
                  <option value="">{{ t('Manual entry', 'إدخال يدوي') }}</option>
                  @for (m of medications(); track m.id) {
                    <option [value]="m.id">
                      {{ m.name }} {{ m.strength || '' }} · {{ formLabel(m.form) }}
                    </option>
                  }
                </select></label
              ><label
                >{{ t('Medication name', 'اسم الدواء')
                }}<input [(ngModel)]="row.medicationName" [disabled]="!!row.medicationId" /></label
              ><label
                >{{ t('Generic name', 'الاسم العلمي')
                }}<input [(ngModel)]="row.genericName" [disabled]="!!row.medicationId" /></label
              ><label
                >{{ t('Strength', 'التركيز')
                }}<input [(ngModel)]="row.strength" [disabled]="!!row.medicationId" /></label
              ><label>{{ t('Dose', 'الجرعة') }}<input [(ngModel)]="row.dose" /></label
              ><label>{{ t('Frequency', 'التكرار') }}<input [(ngModel)]="row.frequency" /></label
              ><label>{{ t('Duration', 'المدة') }}<input [(ngModel)]="row.duration" /></label
              ><label>{{ t('Route', 'طريقة الاستخدام') }}<input [(ngModel)]="row.route" /></label
              ><label
                >{{ t('Quantity', 'الكمية')
                }}<input type="number" [(ngModel)]="row.quantity" /></label
              ><label class="wide"
                >{{ t('Instructions', 'التعليمات') }}<input [(ngModel)]="row.instructions"
              /></label>
            </div>
            @if (id) {
              <button type="button" class="primary" (click)="saveItem(row)">
                {{ t('Save item', 'حفظ البند') }}
              </button>
            }
          </article>
        }
        @if (!id) {
          <button
            type="button"
            class="primary"
            [disabled]="form.invalid || !rows().length || saving()"
            (click)="create()"
          >
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Create draft', 'إنشاء المسودة') }}
          </button>
        }
      </section>
    }`,
  styleUrl: './prescriptions.scss',
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
  search = '';
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
    this.searchMedications();
    if (this.id) this.reload();
    else {
      this.addRow();
      this.loading.set(false);
    }
  }
  searchMedications() {
    this.api.medications(this.search).subscribe((x) => this.medications.set(x.items));
  }
  addRow() {
    this.rows.update((x) => [...x, newDraftItem(x.length + 1)]);
  }
  choose(row: DraftPrescriptionItem) {
    const m = this.medications().find((x) => x.id === row.medicationId);
    if (m) {
      row.medicationName = m.name;
      row.genericName = m.genericName;
      row.strength = m.strength;
      row.form = m.form;
    }
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
        .subscribe({ next: () => this.reload(), error: () => this.conflict() });
    } else this.rows.update((items) => removeDraftItem(items, index));
  }
  create() {
    if (this.form.invalid || !this.validRows()) return;
    this.saving.set(true);
    const h = this.header();
    this.api.create({ ...h, items: this.rows() }).subscribe({
      next: (x) =>
        this.router.navigate(['/prescriptions', x.id], {
          state: { message: this.t('Prescription draft created.', 'تم إنشاء مسودة الوصفة.') },
        }),
      error: () => {
        this.error.set(this.t('Prescription could not be created.', 'تعذر إنشاء الوصفة.'));
        this.saving.set(false);
      },
    });
  }
  saveHeader() {
    if (!this.id || this.form.invalid) return;
    this.saving.set(true);
    this.api
      .update(this.id, { ...this.header(), version: this.form.controls.version.value })
      .subscribe({ next: () => this.reload(), error: () => this.conflict() });
  }
  saveItem(row: DraftPrescriptionItem) {
    if (!this.id || !this.valid(row)) return;
    const call = row.id
      ? this.api.updateItem(this.id, row as PrescriptionItem, this.form.controls.version.value)
      : this.api.addItem(this.id, row, this.form.controls.version.value);
    call.subscribe({ next: () => this.reload(), error: () => this.conflict() });
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
      patientId: v.patientId,
      doctorProfileId: v.doctorProfileId,
      appointmentId: v.appointmentId || undefined,
      examinationId: v.examinationId || undefined,
      treatmentId: v.treatmentId || undefined,
      notes: v.notes || undefined,
    };
  }
  private validRows() {
    return this.rows().length > 0 && this.rows().every((x) => this.valid(x));
  }
  private valid(x: DraftPrescriptionItem) {
    if (!isCompleteDraftItem(x)) {
      this.error.set(
        this.t(
          'Complete medication, dose, frequency, duration, and instructions.',
          'أكمل الدواء والجرعة والتكرار والمدة والتعليمات.',
        ),
      );
      return false;
    }
    return true;
  }
  private conflict() {
    this.error.set(
      this.t(
        'The draft changed or the operation was rejected. Reload and try again.',
        'تغيرت المسودة أو رُفضت العملية. أعد التحميل وحاول مجددًا.',
      ),
    );
    this.saving.set(false);
  }
  formLabel(x?: number) {
    return medicationForm(x, this.i18n.language() === 'ar');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
