import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { Treatment, TreatmentApiService } from './treatment-api.service';
import { treatmentStatus } from './treatment-labels';
@Component({
  selector: 'app-treatments-page',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: `<section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinical execution', 'التنفيذ العلاجي') }}</p>
        <h1>{{ t('Treatments', 'العلاجات') }}</h1>
      </div>
    </section>
    <section class="panel filters" [formGroup]="filters">
      <input formControlName="patientId" [placeholder]="t('Patient ID', 'رقم المريض')" /><input
        type="number"
        formControlName="toothNumber"
        [placeholder]="t('Tooth FDI', 'رقم السن FDI')"
      /><select formControlName="status">
        <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
        @for (x of statuses; track x) {
          <option [value]="x">{{ status(x) }}</option>
        }</select
      ><button (click)="load()">{{ t('Filter', 'تصفية') }}</button>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <section class="panel table-panel">
      @if (loading()) {
        <div class="state">{{ t('Loading treatments…', 'جارٍ تحميل العلاجات…') }}</div>
      } @else if (!items().length) {
        <div class="state">
          <strong>{{ t('No treatments', 'لا توجد علاجات') }}</strong>
          <p>{{ t('Executed care will appear here.', 'ستظهر الرعاية المنفذة هنا.') }}</p>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('Treatment', 'العلاج') }}</th>
                <th>{{ t('Patient', 'المريض') }}</th>
                <th>{{ t('Doctor', 'الطبيب') }}</th>
                <th>{{ t('Teeth', 'الأسنان') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
                <th>{{ t('Price', 'السعر') }}</th>
                <th>{{ t('Created', 'أُنشئ') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (x of items(); track x.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/treatments', x.id]">{{ x.treatmentName }}</a>
                  </td>
                  <td>{{ x.patientName }}</td>
                  <td>{{ x.doctorName }}</td>
                  <td>{{ x.toothNumbers.join(', ') || '—' }}</td>
                  <td>
                    <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
                  </td>
                  <td>{{ x.price }}</td>
                  <td>{{ x.createdAt | date: 'mediumDate' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>`,
  styleUrl: './treatments.scss',
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
        this.items.set(x.items);
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
