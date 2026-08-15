import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { TreatmentApiService, TreatmentPlanList } from './treatment-api.service';
import { planStatus } from './treatment-labels';

@Component({
  selector: 'app-treatment-plans-page',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinical planning', 'التخطيط العلاجي') }}</p>
        <h1>{{ t('Treatment plans', 'خطط العلاج') }}</h1>
      </div>
      @if (auth.hasPermission('TreatmentPlans.Create')) {
        <a class="button primary" routerLink="/treatment-plans/create">{{
          t('New plan', 'خطة جديدة')
        }}</a>
      }
    </section>
    <section class="panel filters" [formGroup]="filters">
      <input formControlName="patientId" [placeholder]="t('Patient ID', 'رقم المريض')" /><select
        formControlName="status"
      >
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
        <div class="state">{{ t('Loading plans…', 'جارٍ تحميل الخطط…') }}</div>
      } @else if (!items().length) {
        <div class="state">
          <strong>{{ t('No treatment plans', 'لا توجد خطط علاج') }}</strong>
          <p>{{ t('Create the first plan for a patient.', 'أنشئ أول خطة علاج لمريض.') }}</p>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('Plan', 'الخطة') }}</th>
                <th>{{ t('Patient', 'المريض') }}</th>
                <th>{{ t('Doctor', 'الطبيب') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
                <th>{{ t('Total', 'الإجمالي') }}</th>
                <th>{{ t('Created', 'أُنشئت') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (x of items(); track x.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/treatment-plans', x.id]">{{ x.title }}</a>
                  </td>
                  <td>{{ x.patientName }}</td>
                  <td>{{ x.doctorName }}</td>
                  <td>
                    <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
                  </td>
                  <td>{{ x.total }}</td>
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
export class TreatmentPlansPageComponent {
  private readonly api = inject(TreatmentApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<TreatmentPlanList[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly statuses = [1, 2, 3, 4, 5, 6, 7];
  readonly filters = inject(FormBuilder).nonNullable.group({ patientId: '', status: '' });
  constructor() {
    const patientId = inject(ActivatedRoute).snapshot.queryParamMap.get('patientId');
    if (patientId) this.filters.controls.patientId.setValue(patientId);
    this.load();
  }
  load() {
    this.loading.set(true);
    const f = this.filters.getRawValue();
    this.api.plans(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).subscribe({
      next: (x) => {
        this.items.set(x.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Plans could not be loaded.', 'تعذر تحميل الخطط.'));
        this.loading.set(false);
      },
    });
  }
  status(x: number) {
    return planStatus(x, this.i18n.language() === 'ar');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
