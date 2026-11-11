import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { DoctorApiService, PagedDoctors, DoctorListItem } from './doctor-api.service';

@Component({
  styleUrl: './doctors.scss',

  selector: 'app-doctors-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `<div class="workspace-records doctor-directory">
    <section class="workspace-page-head">
      <div>

        <h1>{{ t('Doctors', 'الأطباء') }}</h1>
        <p class="page-description">
          {{
            t(
              'Manage the clinical team and their working schedules.',
              'إدارة الفريق الطبي ومواعيد عمله.'
            )
          }}
        </p>
      </div>
      @if (auth.hasPermission('Doctors.Create')) {
        <a class="button primary" routerLink="/doctors/create">{{
          t('Create doctor profile', 'إنشاء ملف طبيب')
        }}</a>
      }
    </section>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    @if (success()) {
      <div class="alert success" role="status">{{ success() }}</div>
    }
    <form
      class="panel workspace-filters"
      [formGroup]="filters"
      (ngSubmit)="load(1)"
      [attr.aria-label]="t('Doctor filters', 'تصفية الأطباء')"
    >
      <label class="workspace-filter-field"
        ><span>{{ t('Search doctors', 'البحث عن طبيب') }}</span
        ><input
          type="search"
          formControlName="search"
          [placeholder]="t('Name, email or phone', 'الاسم أو البريد أو الهاتف')"
      /></label>
      <label class="workspace-filter-field"
        ><span>{{ t('Specialization', 'التخصص') }}</span
        ><input
          formControlName="specialization"
          [placeholder]="t('All specializations', 'كل التخصصات')"
      /></label>
      <label class="workspace-filter-field"
        ><span>{{ t('Status', 'الحالة') }}</span
        ><select formControlName="status">
          <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
          <option value="1">{{ t('Active', 'نشط') }}</option>
          <option value="2">{{ t('Inactive', 'غير نشط') }}</option>
          <option value="3">{{ t('Archived', 'مؤرشف') }}</option>
        </select></label
      >
      <div class="filter-actions">
        <button type="submit" [disabled]="loading()">
          {{ t('Apply filters', 'تطبيق التصفية') }}</button
        ><button type="button" class="filter-reset" (click)="resetFilters()" [disabled]="loading()">
          {{ t('Reset', 'إعادة ضبط') }}
        </button>
      </div>
    </form>
    <section class="panel table-panel workspace-results" [attr.aria-busy]="loading()">
      <header class="workspace-results-head">
        <h2>{{ t('Doctor directory', 'دليل الأطباء') }}</h2>
        <span role="status">
          @if (!loading() && !loadError()) {
            {{ result()?.totalCount ?? 0 }} {{ t('doctors', 'طبيب') }}
          }
        </span>
      </header>
      @if (loading()) {
        <div class="state">{{ t('Loading doctors…', 'جارٍ تحميل الأطباء…') }}</div>
      } @else if (loadError()) {
        <div class="state" role="alert">
          <strong>{{ loadError() }}</strong
          ><button type="button" (click)="load(1)">{{ t('Try again', 'حاول مرة أخرى') }}</button>
        </div>
      } @else if (!result()?.items?.length) {
        <div class="state">
          <strong>{{ t('No doctors found', 'لا يوجد أطباء') }}</strong>
          <p>
            {{
              t(
                'Assign the Doctor role to a clinic user, then create their profile.',
                'عيّن دور الطبيب لمستخدم العيادة ثم أنشئ ملفه.'
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
                  t('Doctor directory results', 'نتائج دليل الأطباء')
                }}
              </caption>
              <thead>
                <tr>
                  <th>{{ t('Doctor', 'الطبيب') }}</th>
                  <th>{{ t('Specialization', 'التخصص') }}</th>
                  <th>{{ t('License', 'الترخيص') }}</th>
                  <th>{{ t('Status', 'الحالة') }}</th>
                  <th>{{ t('Created', 'تاريخ الإنشاء') }}</th>
                  <th>
                    <span class="sr-only">{{ t('Actions', 'الإجراءات') }}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (d of result()!.items; track d.id) {
                  <tr>
                    <td>
                      <strong>{{ d.displayName }}</strong
                      ><small>{{ d.email }}</small>
                    </td>
                    <td>{{ d.specialization }}</td>
                    <td class="number">{{ d.licenseNumber || '—' }}</td>
                    <td>
                      <span class="badge status-{{ d.status }}">{{ status(d.status) }}</span>
                    </td>
                    <td>{{ d.createdAt | date: 'dd/MM/yyyy' }}</td>
                    <td>
                      <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <a [routerLink]="['/doctors', d.id]">{{ t('Manage', 'إدارة') }}</a>
                        @if (auth.hasPermission('Doctors.Archive') && d.status === 3) {
                          <span>·</span>
                          <button
                            type="button"
                            class="button-link"
                            style="background: none; border: none; padding: 0; color: #0284c7; cursor: pointer; font-weight: 600; text-decoration: underline; font-family: inherit; font-size: inherit;"
                            (click)="restore(d)"
                          >
                            {{ t('Restore', 'استرجاع') }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
        <nav class="pagination" [attr.aria-label]="t('Doctor pages', 'صفحات الأطباء')">
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
    </section>
  </div>`,
})
export class DoctorsPageComponent {
  private api = inject(DoctorApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly result = signal<PagedDoctors | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly loadError = signal('');
  readonly success = signal('');
  readonly filters = inject(FormBuilder).nonNullable.group({
    search: '',
    specialization: '',
    status: '',
  });
  constructor() {
    this.load(1);
  }
  resetFilters() {
    this.filters.reset({ search: '', specialization: '', status: '' });
    this.load(1);
  }
  load(page: number) {
    this.loadError.set('');
    this.error.set('');
    this.loading.set(true);
    const x = this.filters.getRawValue();
    this.api.doctors(x.search, x.status, x.specialization, page).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(this.t('Doctors could not be loaded.', 'تعذر تحميل الأطباء.'));
        this.loading.set(false);
      },
    });
  }
  status(x: number) {
    return x === 1
      ? this.t('Active', 'نشط')
      : x === 2
        ? this.t('Inactive', 'غير نشط')
        : this.t('Archived', 'مؤرشف');
  }
  restore(d: DoctorListItem) {
    if (
      !confirm(
        this.t(
          `Are you sure you want to restore ${d.displayName}? They will become active and available for appointments.`,
          `هل أنت متأكد من استرجاع الطبيب ${d.displayName}؟ سيصبح نشطاً ومتاحاً لحجز المواعيد.`,
        ),
      )
    )
      return;

    this.api.restore(d.id).subscribe({
      next: () => {
        this.success.set(
          this.t(
            `Dr. ${d.displayName} restored successfully.`,
            `تم استرجاع الطبيب ${d.displayName} بنجاح وأصبح متاحاً للمواعيد.`,
          ),
        );
        this.load(this.result()?.page || 1);
      },
      error: () => {
        this.error.set(this.t('Could not restore doctor.', 'تعذر استرجاع الطبيب.'));
      },
    });
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
