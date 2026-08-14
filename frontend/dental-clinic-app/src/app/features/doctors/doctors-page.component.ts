import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DoctorApiService, PagedDoctors } from './doctor-api.service';

@Component({
  selector: 'app-doctors-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinical team', 'الفريق الطبي') }}</p>
        <h1>{{ t('Doctors', 'الأطباء') }}</h1>
      </div>
      <a class="button primary" routerLink="/doctors/create">{{
        t('Create doctor profile', 'إنشاء ملف طبيب')
      }}</a>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <form class="panel filters" [formGroup]="filters" (ngSubmit)="load(1)">
      <input
        formControlName="search"
        [placeholder]="t('Search name, email, phone', 'ابحث بالاسم أو البريد أو الهاتف')"
      /><input
        formControlName="specialization"
        [placeholder]="t('Specialization', 'التخصص')"
      /><select formControlName="status">
        <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
        <option value="1">{{ t('Active', 'نشط') }}</option>
        <option value="2">{{ t('Inactive', 'غير نشط') }}</option>
        <option value="3">{{ t('Archived', 'مؤرشف') }}</option></select
      ><button>{{ t('Apply', 'تطبيق') }}</button>
    </form>
    <section class="panel table-panel">
      @if (loading()) {
        <div class="state">{{ t('Loading doctors…', 'جارٍ تحميل الأطباء…') }}</div>
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
          <table>
            <thead>
              <tr>
                <th>{{ t('Doctor', 'الطبيب') }}</th>
                <th>{{ t('Specialization', 'التخصص') }}</th>
                <th>{{ t('License', 'الترخيص') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
                <th>{{ t('Created', 'تاريخ الإنشاء') }}</th>
                <th></th>
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
                  <td class="number">{{ d.licenseNumber }}</td>
                  <td>
                    <span class="badge status-{{ d.status }}">{{ status(d.status) }}</span>
                  </td>
                  <td>{{ d.createdAt | date: 'mediumDate' }}</td>
                  <td>
                    <a [routerLink]="['/doctors', d.id]">{{ t('Manage', 'إدارة') }}</a>
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
  styleUrl: './doctors.scss',
})
export class DoctorsPageComponent {
  private api = inject(DoctorApiService);
  readonly i18n = inject(LocalizationService);
  readonly result = signal<PagedDoctors | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly filters = inject(FormBuilder).nonNullable.group({
    search: '',
    specialization: '',
    status: '',
  });
  constructor() {
    this.load(1);
  }
  load(page: number) {
    this.loading.set(true);
    const x = this.filters.getRawValue();
    this.api.doctors(x.search, x.status, x.specialization, page).subscribe({
      next: (r) => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Doctors could not be loaded.', 'تعذر تحميل الأطباء.'));
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
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
