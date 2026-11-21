import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { TreatmentApiService, TreatmentPlanList } from './treatment-api.service';
import { planStatus } from './treatment-labels';

import { PatientSelectComponent } from '../../shared/patient-select.component';

@Component({
  styleUrl: './treatments.scss',
  selector: 'app-treatment-plans-page',
  imports: [RouterLink, DatePipe, ReactiveFormsModule, PatientSelectComponent],
  template: `<div class="workspace-records plan-directory">
    <section class="workspace-page-head">
      <div>

        <h1>{{ t('Treatment plans', 'خطط العلاج') }}</h1>
        <p class="page-description">
          {{
            t(
              'Review planned care, its status and estimated totals.',
              'مراجعة العلاج المخطط وحالته والتكلفة المقدرة.'
            )
          }}
        </p>
      </div>
      @if (auth.hasPermission('TreatmentPlans.Create')) {
        <a class="button primary" routerLink="/treatment-plans/create">{{
          t('New plan', 'خطة جديدة')
        }}</a>
      }
    </section>
    <form
      class="panel workspace-filters"
      [formGroup]="filters"
      (ngSubmit)="load()"
      [attr.aria-label]="t('Plan filters', 'تصفية الخطط')"
    >
      <div class="workspace-filter-field">
        <span>{{ t('Patient', 'المريض') }}</span>
        <app-patient-select formControlName="patientId" />
      </div>
      <label class="workspace-filter-field"
        ><span>{{ t('Plan status', 'حالة الخطة') }}</span
        ><select formControlName="status">
          <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
          @for (x of statuses; track x) {
            <option [value]="x">{{ status(x) }}</option>
          }
        </select></label
      >
      <div class="filter-actions">
        <button type="submit" [disabled]="loading()">
          {{ t('Apply filters', 'تطبيق التصفية') }}</button
        ><button type="button" class="filter-reset" [disabled]="loading()" (click)="resetFilters()">
          {{ t('Reset', 'إعادة ضبط') }}
        </button>
      </div>
    </form>
    <section class="panel table-panel workspace-results" [attr.aria-busy]="loading()">
      <header class="workspace-results-head">
        <h2>{{ t('Plan directory', 'دليل خطط العلاج') }}</h2>
        <span role="status">
          @if (!loading() && !error()) {
            {{ t('Results', 'النتائج') }} ({{ items().length }})
          }
        </span>
      </header>
      @if (loading()) {
        <div class="state" role="status">{{ t('Loading plans…', 'جارٍ تحميل الخطط…') }}</div>
      } @else if (error()) {
        <div class="state" role="alert">
          <strong>{{ error() }}</strong>
          <button type="button" (click)="load()">{{ t('Try again', 'حاول مرة أخرى') }}</button>
        </div>
      } @else if (!items().length) {
        <div class="state">
          <strong>{{ t('No treatment plans', 'لا توجد خطط علاج') }}</strong>
          <p>{{ t('Try changing the filters or select a different patient.', 'جرّب تعديل الفلاتر أو اختيار مريض آخر.') }}</p>
        </div>
      } @else {
        <div class="table-scroll">
          <div class="table-responsive">
            <table>
              <caption class="sr-only">
                {{
                  t('Treatment plan results', 'نتائج خطط العلاج')
                }}
              </caption>
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
                    <td>{{ x.createdAt | date: 'dd/MM/yyyy' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
  </div>`,
})
export class TreatmentPlansPageComponent {
  private readonly api = inject(TreatmentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
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
  resetFilters() {
    this.filters.reset({ patientId: '', status: '' });
    this.load();
  }
  load(): void {
    this.request?.unsubscribe();
    this.error.set('');
    this.loading.set(true);
    const filters = Object.fromEntries(Object.entries(this.filters.getRawValue()).filter(([, value]) => value));
    this.request = this.api.allPlans(filters).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.items.set([]);
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
