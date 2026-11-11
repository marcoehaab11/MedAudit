import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { PagedPatients, PatientApiService } from './patient-api.service';

@Component({
  styleUrl: './patients.scss',

  selector: 'app-patients-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: ` <section class="workspace-page-head">
      <div>

        <h1>{{ t('Patients', 'المرضى') }}</h1>
        <p class="page-description">
          {{ t('Find a patient and continue their care.', 'ابحث عن مريض وتابع رعايته.') }}
        </p>
      </div>
      @if (auth.hasPermission('Patients.Create')) {
        <a class="button primary" routerLink="/patients/create">{{
          t('Add patient', 'إضافة مريض')
        }}</a>
      }
    </section>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    <form
      class="panel filters workspace-filters"
      [formGroup]="filters"
      (ngSubmit)="load(1)"
      [attr.aria-label]="t('Patient filters', 'عوامل تصفية المرضى')"
    >
      <label class="workspace-filter-field filter-search">
        <span>{{ t('Search patients', 'البحث عن مريض') }}</span>
        <input
          formControlName="search"
          type="search"
          [placeholder]="
            t('Name, patient number, phone or email', 'الاسم أو رقم المريض أو الهاتف أو البريد')
          "
        />
      </label>
      <label class="workspace-filter-field">
        <span>{{ t('Patient status', 'حالة المريض') }}</span>
        <select formControlName="status">
          <option value="">{{ t('Active', 'نشط') }}</option>
          <option value="2">{{ t('Archived', 'المؤرشفون') }}</option>
        </select>
      </label>
      <label class="workspace-filter-field">
        <span>{{ t('Gender', 'النوع') }}</span>
        <select formControlName="gender">
          <option value="">{{ t('All genders', 'كل الأنواع') }}</option>
          <option value="1">{{ t('Female', 'أنثى') }}</option>
          <option value="2">{{ t('Male', 'ذكر') }}</option>
          <option value="3">{{ t('Other', 'آخر') }}</option>
        </select>
      </label>
      <label class="workspace-filter-field">
        <span>{{ t('Sort by', 'الترتيب حسب') }}</span>
        <select formControlName="sortBy">
          <option value="1">{{ t('Newest', 'الأحدث') }}</option>
          <option value="2">{{ t('Name', 'الاسم') }}</option>
          <option value="3">{{ t('Patient number', 'رقم المريض') }}</option>
        </select>
      </label>
      <div class="filter-actions">
        <button type="submit" [disabled]="loading()">
          {{ t('Apply filters', 'تطبيق التصفية') }}
        </button>
        <button class="filter-reset" type="button" (click)="resetFilters()" [disabled]="loading()">
          {{ t('Reset', 'إعادة ضبط') }}
        </button>
      </div>
    </form>
    <section class="panel table-panel workspace-results" [attr.aria-busy]="loading()">
      <header class="workspace-results-head">
        <h2>{{ t('Patient directory', 'دليل المرضى') }}</h2>
        <span role="status">
          @if (!loading() && !error() && result(); as patients) {
            {{ patients.totalCount }} {{ t('patients', 'مريض') }}
          }
        </span>
      </header>
      @if (loading()) {
        <div class="loading" role="status">{{ t('Loading patients…', 'جارٍ تحميل المرضى…') }}</div>
      } @else if (error()) {
        <div class="empty">
          <strong>{{ t('Patient directory unavailable', 'تعذر عرض دليل المرضى') }}</strong>
          <p>{{ t('Try loading the directory again.', 'حاول تحميل الدليل مرة أخرى.') }}</p>
          <button type="button" (click)="load(1)">{{ t('Try again', 'حاول مرة أخرى') }}</button>
        </div>
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
          <div class="table-responsive">
            <table>
              <caption class="sr-only">
                {{
                  t('Patient directory results', 'نتائج دليل المرضى')
                }}
              </caption>
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
                    <td>{{ patient.createdAt | date: 'dd/MM/yyyy' }}</td>
                    <td>
                      <a [routerLink]="['/patients', patient.id]">{{ t('View', 'عرض') }}</a>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <nav class="pagination" [attr.aria-label]="t('Patient pages', 'صفحات المرضى')">
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
})
export class PatientsPageComponent {
  readonly auth = inject(AuthService);
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
  resetFilters(): void {
    this.filters.reset({ search: '', status: '', gender: '', sortBy: '1' });
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
