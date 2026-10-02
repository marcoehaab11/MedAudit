import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { Treatment, TreatmentApiService } from './treatment-api.service';
import { treatmentStatus } from './treatment-labels';
import { PatientSelectComponent } from '../../shared/patient-select.component';

@Component({
  styleUrl: './treatments.scss',
  selector: 'app-treatments-page',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, PatientSelectComponent],
  template: `
    <div class="treatments-page-wrapper">
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ t('Clinical Execution & Records', 'سجلات التنفيذ العلاجي') }}</p>
          <h1>{{ t('Treatments & Procedures', 'العلاجات والإجراءات المنفذة') }}</h1>
        </div>
      </section>

      <section class="panel filters" [formGroup]="filters">
        <div class="patient-filter-box">
          <app-patient-select
            formControlName="patientId"
            [placeholder]="t('Filter by patient (name or phone)…', 'تصفية حسب المريض (الاسم أو الهاتف)…')"
          />
        </div>

        <input
          class="tooth-filter-input"
          type="number"
          formControlName="toothNumber"
          [placeholder]="t('Tooth # (FDI)', 'رقم السن')"
        />

        <select formControlName="status">
          <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
          @for (x of statuses; track x) {
            <option [value]="x">{{ status(x) }}</option>
          }
        </select>

        <button type="button" class="btn-filter" (click)="load()">
          🔍 {{ t('Filter', 'تصفية') }}
        </button>
      </section>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      <section class="panel table-panel">
        @if (loading()) {
          <div class="state">{{ t('Loading executed treatments…', 'جارٍ تحميل قائمة العلاجات…') }}</div>
        } @else if (!items().length) {
          <div class="empty-data-state">
            <div class="empty-icon">🦷</div>
            <strong>{{ t('No treatments found', 'لا توجد علاجات مسجلة') }}</strong>
            <p>{{ t('Executed clinical dental procedures and treatments will appear here.', 'ستظهر هنا جميع الإجراءات العلاجية المنفذة للمرضى.') }}</p>
          </div>
        } @else {
          <div class="table-scroll">
            <div class="table-responsive"><table class="modern-table">
              <thead>
                <tr>
                  <th>{{ t('Treatment Procedure', 'الإجراء العلاجي') }}</th>
                  <th>{{ t('Patient', 'المريض') }}</th>
                  <th>{{ t('Attending Doctor', 'الطبيب المعالج') }}</th>
                  <th>{{ t('Tooth / Teeth', 'الأسنان') }}</th>
                  <th>{{ t('Status', 'الحالة') }}</th>
                  <th>{{ t('Price', 'السعر') }}</th>
                  <th>{{ t('Execution Date', 'تاريخ التنفيذ') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (x of items(); track x.id) {
                  <tr>
                    <td>
                      <a class="item-link-bold" [routerLink]="['/treatments', x.id]">{{ x.treatmentName }}</a>
                    </td>
                    <td>
                      <strong class="patient-cell-name">{{ x.patientName }}</strong>
                    </td>
                    <td>
                      <span class="doctor-cell-name">{{ x.doctorName }}</span>
                    </td>
                    <td>
                      @if (x.toothNumbers?.length) {
                        <div class="teeth-badges-wrap">
                          @for (tooth of x.toothNumbers; track tooth) {
                            <span class="tooth-pill">#{{ tooth }}</span>
                          }
                        </div>
                      } @else {
                        <span class="dimmed-text">—</span>
                      }
                    </td>
                    <td>
                      <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
                    </td>
                    <td>
                      <strong class="price-cell-val">{{ x.price }}</strong>
                    </td>
                    <td>
                      <span class="date-cell-val">{{ x.createdAt | date: 'dd/MM/yyyy' }}</span>
                    </td>
                  </tr>
                }
              </tbody>
            </table></div>
          </div>
        }
      </section>
    </div>
  `,
})
export class TreatmentsPageComponent {
  private readonly api = inject(TreatmentApiService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<Treatment[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly statuses = [1, 2, 3, 4, 5];

  readonly filters = inject(FormBuilder).nonNullable.group({
    patientId: '',
    toothNumber: '',
    status: '',
  });

  constructor() {
    const patientId = inject(ActivatedRoute).snapshot.queryParamMap.get('patientId');
    if (patientId) this.filters.controls.patientId.setValue(patientId);
    this.load();
  }

  load() {
    this.loading.set(true);
    const f = this.filters.getRawValue();
    this.api.treatments(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).subscribe({
      next: (x) => {
        this.items.set(x.items ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Treatments could not be loaded.', 'تعذر تحميل العلاجات.'));
        this.loading.set(false);
      },
    });
  }

  status(x: number) {
    return treatmentStatus(x, this.i18n.language() === 'ar');
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


