import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { PagedPatients, PatientApiService } from './patient-api.service';

@Component({
  selector: 'app-patients-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Patient registry', 'سجل المرضى') }}</p>
        <h1>{{ t('Patients', 'المرضى') }}</h1>
      </div>
      <a class="button primary" routerLink="/patients/create">{{
        t('Add patient', 'إضافة مريض')
      }}</a>
    </section>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    <form class="panel filters" [formGroup]="filters" (ngSubmit)="load(1)">
      <label class="search"
        ><span class="sr-only">{{ t('Search patients', 'البحث عن المرضى') }}</span
        ><input
          formControlName="search"
          [placeholder]="
            t('Search name, number, phone, or email', 'ابحث بالاسم أو الرقم أو الهاتف أو البريد')
          "
      /></label>
      <select formControlName="status" [attr.aria-label]="t('Status', 'الحالة')">
        <option value="">{{ t('Active patients', 'المرضى النشطون') }}</option>
        <option value="2">{{ t('Archived', 'المؤرشفون') }}</option>
      </select>
      <select formControlName="gender" [attr.aria-label]="t('Gender', 'النوع')">
        <option value="">{{ t('All genders', 'كل الأنواع') }}</option>
        <option value="1">{{ t('Female', 'أنثى') }}</option>
        <option value="2">{{ t('Male', 'ذكر') }}</option>
        <option value="3">{{ t('Other', 'آخر') }}</option>
      </select>
      <select formControlName="sortBy" [attr.aria-label]="t('Sort', 'الترتيب')">
        <option value="1">{{ t('Newest', 'الأحدث') }}</option>
        <option value="2">{{ t('Name', 'الاسم') }}</option>
        <option value="3">{{ t('Patient number', 'رقم المريض') }}</option>
      </select>
      <button>{{ t('Apply', 'تطبيق') }}</button>
    </form>
    <section class="panel table-panel">
      @if (loading()) {
        <div class="loading" role="status">{{ t('Loading patients…', 'جارٍ تحميل المرضى…') }}</div>
      } @else if (!result()?.items?.length) {
        <div class="empty">
          <strong>{{ t('No patients found', 'لا يوجد مرضى') }}</strong>
          <p>
            {{
              t(
                'Add the first patient or adjust your filters.',
                'أضف أول مريض أو عدّل عوامل البحث.'
              )
            }}
          </p>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('Patient', 'المريض') }}</th>
                <th>{{ t('Number', 'الرقم') }}</th>
                <th>{{ t('Phone', 'الهاتف') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
                <th>{{ t('Registered', 'تاريخ التسجيل') }}</th>
                <th>
                  <span class="sr-only">{{ t('Actions', 'الإجراءات') }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (patient of result()!.items; track patient.id) {
                <tr>
                  <td>
                    <strong>{{ patient.fullName }}</strong
                    ><small>{{ patient.email || '—' }}</small>
                  </td>
                  <td>
                    <span class="number">{{ patient.patientNumber }}</span>
                  </td>
                  <td>{{ patient.phone }}</td>
                  <td>
                    <span class="badge status-{{ patient.status }}">{{
                      patient.status === 1 ? t('Active', 'نشط') : t('Archived', 'مؤرشف')
                    }}</span>
                  </td>
                  <td>{{ patient.createdAt | date: 'mediumDate' }}</td>
                  <td>
                    <a [routerLink]="['/patients', patient.id]">{{ t('View', 'عرض') }}</a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <nav class="pagination">
          <button type="button" [disabled]="result()!.page <= 1" (click)="load(result()!.page - 1)">
            {{ t('Previous', 'السابق') }}</button
          ><span>{{ result()!.page }} / {{ result()!.totalPages || 1 }}</span
          ><button
            type="button"
            [disabled]="result()!.page >= result()!.totalPages"
            (click)="load(result()!.page + 1)"
          >
            {{ t('Next', 'التالي') }}
          </button>
        </nav>
      }
    </section>`,
  styleUrl: './patients.scss',
})
export class PatientsPageComponent {
  private readonly api = inject(PatientApiService);
  readonly i18n = inject(LocalizationService);
  readonly result = signal<PagedPatients | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filters = inject(FormBuilder).nonNullable.group({
    search: '',
    status: '',
    gender: '',
    sortBy: '1',
  });
  constructor() {
    this.load(1);
  }
  load(page: number): void {
    this.loading.set(true);
    this.error.set('');
    const value = this.filters.getRawValue();
    this.api.patients({ ...value, page, descending: value.sortBy === '1' }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Patients could not be loaded.', 'تعذر تحميل المرضى.'));
        this.loading.set(false);
      },
    });
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
