import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { PrescriptionApiService, PrescriptionList } from './prescription-api.service';
import { prescriptionStatus } from './prescription-labels';
@Component({
  selector: 'app-prescriptions-page',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  template: `<section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Clinical documents', 'المستندات السريرية') }}</p>
        <h1>{{ t('Prescriptions', 'الوصفات الطبية') }}</h1>
      </div>
      @if (auth.hasPermission('Prescriptions.Create')) {
        <a class="button primary" routerLink="/prescriptions/create">{{
          t('New prescription', 'وصفة جديدة')
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
        <div class="state">{{ t('Loading prescriptions…', 'جارٍ تحميل الوصفات…') }}</div>
      } @else if (!items().length) {
        <div class="state">
          <strong>{{ t('No prescriptions', 'لا توجد وصفات') }}</strong>
        </div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('Number', 'الرقم') }}</th>
                <th>{{ t('Patient', 'المريض') }}</th>
                <th>{{ t('Doctor', 'الطبيب') }}</th>
                <th>{{ t('Date', 'التاريخ') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (x of items(); track x.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/prescriptions', x.id]">{{ x.prescriptionNumber }}</a>
                  </td>
                  <td>{{ x.patientName }}</td>
                  <td>{{ x.doctorName }}</td>
                  <td>{{ x.issuedAt || x.createdAt | date: 'mediumDate' }}</td>
                  <td>
                    <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>`,
  styleUrl: './prescriptions.scss',
})
export class PrescriptionsPageComponent {
  private readonly api = inject(PrescriptionApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<PrescriptionList[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly statuses = [1, 2, 3];
  readonly filters = inject(FormBuilder).nonNullable.group({ patientId: '', status: '' });
  constructor() {
    const patient = inject(ActivatedRoute).snapshot.queryParamMap.get('patientId');
    if (patient) this.filters.controls.patientId.setValue(patient);
    this.load();
  }
  load() {
    this.loading.set(true);
    const f = this.filters.getRawValue();
    this.api.prescriptions(Object.fromEntries(Object.entries(f).filter(([, v]) => v))).subscribe({
      next: (x) => {
        this.items.set(x.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Prescriptions could not be loaded.', 'تعذر تحميل الوصفات.'));
        this.loading.set(false);
      },
    });
  }
  status(x: number) {
    return prescriptionStatus(x, this.i18n.language() === 'ar');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
