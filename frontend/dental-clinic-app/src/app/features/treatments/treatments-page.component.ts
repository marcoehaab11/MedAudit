import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
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

          <h1>{{ t('Treatments & Procedures', 'العلاجات والإجراءات المنفذة') }}</h1>
        </div>
      </section>

      <form class="panel filters workspace-filters" [formGroup]="filters" (ngSubmit)="load()" [attr.aria-label]="t('Treatment filters', 'تصفية العلاجات')">
        <div class="patient-filter-box">
          <app-patient-select
            formControlName="patientId"
            [placeholder]="t('Filter by patient (name or phone)…', 'تصفية حسب المريض (الاسم أو الهاتف)…')"
          />
        </div>

        <label class="workspace-filter-field"><span>{{ t('Tooth # (FDI)', 'رقم السن') }}</span><input
          class="tooth-filter-input"
          type="number"
          formControlName="toothNumber"
          [placeholder]="t('Tooth # (FDI)', 'رقم السن')"
        /></label>

        <label class="workspace-filter-field"><span>{{ t('Status', 'الحالة') }}</span><select formControlName="status">
          <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
          @for (x of statuses; track x) {
            <option [value]="x">{{ status(x) }}</option>
          }
        </select></label>

        <div class="filter-actions">
          <button type="submit" [disabled]="loading()">{{ t('Apply filters', 'تطبيق التصفية') }}</button>
          <button type="button" class="filter-reset" [disabled]="loading()" (click)="resetFilters()">
            {{ t('Reset', 'إعادة ضبط') }}
          </button>
        </div>
      </form>

      <section class="panel table-panel workspace-results" [attr.aria-busy]="loading()">
        <header class="workspace-results-head">
          <h2>{{ t('Treatment results', 'نتائج العلاجات') }}</h2>
          <span role="status">
            @if (!loading() && !error()) {
              {{ t('Results', 'النتائج') }} ({{ items().length }})
            }
          </span>
        </header>
        @if (loading()) {
          <div class="state" role="status">{{ t('Loading treatments…', 'جارٍ تحميل العلاجات…') }}</div>
        } @else if (error()) {
          <div class="state" role="alert">
            <strong>{{ error() }}</strong>
            <button type="button" (click)="load()">{{ t('Try again', 'حاول مرة أخرى') }}</button>
          </div>
        } @else if (!items().length) {
          <div class="empty-data-state">
            <strong>{{ t('No treatments found', 'لا توجد علاجات مسجلة') }}</strong>
            <p>{{ t('Try changing the filters or select a different patient.', 'جرّب تعديل الفلاتر أو اختيار مريض آخر.') }}</p>
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
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
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

  resetFilters() {
    this.filters.reset();
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.error.set('');
    this.loading.set(true);
    const filters = Object.fromEntries(Object.entries(this.filters.getRawValue()).filter(([, value]) => value));
    this.request = this.api.allTreatments(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
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


