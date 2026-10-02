import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { PrescriptionApiService, PrescriptionList } from './prescription-api.service';
import { prescriptionStatus } from './prescription-labels';
import { PatientSelectComponent } from '../../shared/patient-select.component';

@Component({
  styleUrl: './prescriptions.scss',
  selector: 'app-prescriptions-page',
  standalone: true,
  imports: [RouterLink, DatePipe, ReactiveFormsModule, PatientSelectComponent],
  template: `
    <div class="prescriptions-page-wrapper">
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ t('Clinical Documents', 'المستندات السريرية والدوائية') }}</p>
          <h1>{{ t('Prescriptions', 'الوصفات الطبية') }}</h1>
        </div>
        @if (auth.hasPermission('Prescriptions.Create')) {
          <a class="button primary" routerLink="/prescriptions/create">
            + {{ t('New prescription', 'وصفة طبية جديدة') }}
          </a>
        }
      </section>

      <section class="panel filters" [formGroup]="filters">
        <div class="patient-filter-box">
          <app-patient-select
            formControlName="patientId"
            [placeholder]="t('Filter by patient (name or phone)…', 'تصفية حسب المريض (الاسم أو الهاتف)…')"
          />
        </div>

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
          <div class="state">{{ t('Loading prescriptions…', 'جارٍ تحميل الوصفات الطبية…') }}</div>
        } @else if (!items().length) {
          <div class="empty-data-state">
            <div class="empty-icon">💊</div>
            <strong>{{ t('No prescriptions found', 'لا توجد وصفات طبية') }}</strong>
            <p>{{ t('Issued and draft prescriptions will appear here.', 'ستظهر هنا جميع الوصفات الطبية المحفوظة أو الصادرة للمرضى.') }}</p>
            @if (auth.hasPermission('Prescriptions.Create')) {
              <a class="button primary" style="margin-top: 0.5rem;" routerLink="/prescriptions/create">
                + {{ t('Create first prescription', 'إنشاء أول وصفة') }}
              </a>
            }
          </div>
        } @else {
          <div class="table-scroll">
            <div class="table-responsive"><table class="modern-table">
              <thead>
                <tr>
                  <th>{{ t('Rx Number', 'رقم الوصفة') }}</th>
                  <th>{{ t('Patient', 'المريض') }}</th>
                  <th>{{ t('Doctor', 'الطبيب المعالج') }}</th>
                  <th>{{ t('Date', 'تاريخ الإنشاء') }}</th>
                  <th>{{ t('Status', 'حالة الصرف') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (x of items(); track x.id) {
                  <tr>
                    <td>
                      <a class="item-link-bold rx-number-badge" [routerLink]="['/prescriptions', x.id]">
                        {{ x.prescriptionNumber }}
                      </a>
                    </td>
                    <td>
                      <strong class="patient-cell-name">{{ x.patientName }}</strong>
                    </td>
                    <td>
                      <span class="doctor-cell-name">{{ x.doctorName }}</span>
                    </td>
                    <td>
                      <span class="date-cell-val">{{ x.issuedAt || x.createdAt | date: 'dd/MM/yyyy' }}</span>
                    </td>
                    <td>
                      <span class="badge status-{{ x.status }}">{{ status(x.status) }}</span>
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
export class PrescriptionsPageComponent {
  private readonly api = inject(PrescriptionApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<PrescriptionList[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly statuses = [1, 2, 3];

  readonly filters = inject(FormBuilder).nonNullable.group({
    patientId: '',
    status: '',
  });

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
        this.items.set(x.items ?? []);
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


