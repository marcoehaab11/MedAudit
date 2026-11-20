import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, timer } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { DoctorApiService, DoctorLookupItem } from '../doctors/doctor-api.service';
import { Page, Prescription, PrescriptionApiService, PrescriptionList } from './prescription-api.service';

@Component({
  selector: 'app-prescriptions-page',
  imports: [DatePipe, ReactiveFormsModule, WorkspaceDialogComponent],
  styleUrl: '../../shared/clinical-register.scss',
  template: `
    <header class="workspace-page-head"><div>
      <h1>{{ t('Prescriptions', 'الروشتات') }}</h1>
      <p class="page-description">{{ t('Medical prescriptions archive', 'أرشيف الروشتات الطبية') }}</p>
    </div></header>

    <form class="panel workspace-filters register-filter" [formGroup]="filters" (ngSubmit)="applyFilters()">
      <label class="workspace-filter-field"><span>{{ t('Patient name or number', 'اسم المريض أو رقمه') }}</span>
        <input type="search" formControlName="search" maxlength="100" />
      </label>
      <label class="workspace-filter-field"><span>{{ t('Doctor', 'الطبيب') }}</span>
        <select formControlName="doctorProfileId">
          <option value="">{{ t('All doctors', 'كل الأطباء') }}</option>
          @for (doctor of doctors(); track doctor.id) { <option [value]="doctor.id">{{ doctor.displayName }}</option> }
        </select>
      </label>
      <label class="workspace-filter-field"><span>{{ t('From', 'من تاريخ') }}</span><input type="date" formControlName="from" /></label>
      <label class="workspace-filter-field"><span>{{ t('To', 'إلى تاريخ') }}</span><input type="date" formControlName="to" /></label>
      <button class="button primary" type="submit">{{ t('Search', 'بحث') }}</button>
    </form>
    @if (doctorError()) { <p role="status">{{ t('Doctor options could not be loaded.', 'تعذر تحميل خيارات الأطباء.') }}</p> }
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}
        <button class="button" type="button" (click)="load()">{{ t('Refresh', 'تحديث') }}</button>
      </div>
    }
    <section class="register-section" [attr.aria-label]="t('Issued prescriptions', 'الروشتات الصادرة')" [attr.aria-busy]="loading()">
      @if (loading()) {
        <p class="register-state" role="status">{{ t('Loading prescriptions…', 'جارٍ تحميل الروشتات…') }}</p>
      } @else {
        @for (item of result()?.items ?? []; track item.id) {
          <article class="register-row">
            <strong><bdi>{{ item.patientName }}</bdi></strong>
            <span><bdi>{{ item.patientNumber || '—' }}</bdi></span>
            <time>{{ item.issuedAt | date:'dd/MM/yyyy' }}</time>
            <span><bdi>{{ item.doctorName }}</bdi></span>
            <button class="button" type="button" aria-haspopup="dialog"
              [attr.aria-label]="t('View details', 'عرض التفاصيل') + ' · ' + item.patientName + ' · ' + item.prescriptionNumber"
              (click)="open(item.id, details)">{{ t('View details', 'عرض التفاصيل') }}</button>
          </article>
        } @empty {
          <p class="register-state">{{ t('No issued prescriptions found.', 'لا توجد روشتات صادرة مطابقة.') }}</p>
        }
      }
    </section>
    @if ((result()?.totalPages ?? 0) > 1) {
      <nav class="register-pagination" [attr.aria-label]="t('Prescription pages', 'صفحات الروشتات')">
        <button class="button" type="button" [disabled]="loading() || page() === 1"
          (click)="load(page() - 1)">{{ t('Previous', 'السابق') }}</button>
        <bdi>{{ page() }} / {{ result()!.totalPages }}</bdi>
        <button class="button" type="button" [disabled]="loading() || page() >= result()!.totalPages"
          (click)="load(page() + 1)">{{ t('Next', 'التالي') }}</button>
      </nav>
    }
    <app-workspace-dialog #details [title]="t('Prescription details', 'تفاصيل الروشتة')"
      [closeLabel]="t('Close', 'إغلاق')" (closed)="closeDetails()">
      <div class="rx-details">
        @if (detailLoading()) {
          <p role="status">{{ t('Loading prescription…', 'جارٍ تحميل الروشتة…') }}</p>
        } @else if (detailError()) {
          <p role="alert">{{ t('Could not load this prescription.', 'تعذر تحميل هذه الروشتة.') }}</p>
        } @else if (selected(); as record) {
          <strong><bdi>{{ record.patientName }}</bdi></strong>
          <p><bdi>{{ record.patientNumber || '—' }}</bdi> · {{ record.issuedAt | date:'dd/MM/yyyy' }} · <bdi>{{ record.doctorName }}</bdi></p>
          <h3>{{ t('Medications', 'الأدوية') }}</h3>
          <ul role="list" class="rx-medications">
            @for (item of record.items; track item.id) {
              <li>
                <strong><bdi>{{ item.medicationName }}</bdi></strong>
                <dl>
                  @if (item.strength) { <div><dt>{{ t('Strength', 'التركيز') }}</dt><dd><bdi>{{ item.strength }}</bdi></dd></div> }
                  @if (item.dose) { <div><dt>{{ t('Dose', 'الجرعة') }}</dt><dd><bdi>{{ item.dose }}</bdi></dd></div> }
                  @if (item.frequency) { <div><dt>{{ t('Frequency', 'عدد مرات الاستخدام') }}</dt><dd><bdi>{{ item.frequency }}</bdi></dd></div> }
                  @if (item.duration) { <div><dt>{{ t('Duration', 'مدة العلاج') }}</dt><dd><bdi>{{ item.duration }}</bdi></dd></div> }
                  @if (item.route) { <div><dt>{{ t('Route', 'طريقة الاستخدام') }}</dt><dd><bdi>{{ item.route }}</bdi></dd></div> }
                  @if (item.instructions) { <div><dt>{{ t('Instructions', 'التعليمات') }}</dt><dd><bdi>{{ item.instructions }}</bdi></dd></div> }
                </dl>
              </li>
            } @empty { <li>{{ t('No recorded medications.', 'لا توجد أدوية مسجلة.') }}</li> }
          </ul>
          @if (record.notes) { <p><bdi>{{ record.notes }}</bdi></p> }
        }
      </div>
    </app-workspace-dialog>
  `,
})
export class PrescriptionsPageComponent {
  private readonly api = inject(PrescriptionApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private detailRequest?: Subscription;
  private activeFilters: Record<string, string> = {};
  readonly filters = inject(FormBuilder).nonNullable.group({ search: '', doctorProfileId: '', from: '', to: '' });
  readonly result = signal<Page<PrescriptionList> | null>(null);
  readonly page = signal(1);
  readonly doctors = signal<DoctorLookupItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly doctorError = signal(false);
  readonly selected = signal<Prescription | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal(false);

  constructor() {
    inject(DoctorApiService).listAll().pipe(takeUntilDestroyed()).subscribe({
      next: doctors => this.doctors.set(doctors),
      error: () => this.doctorError.set(true),
    });
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(() => this.load(1));
    timer(30_000, 30_000).pipe(takeUntilDestroyed()).subscribe(() => {
      if (document.visibilityState === 'visible') this.load(this.page(), true);
    });
  }

  applyFilters(): void {
    const filters = this.filters.getRawValue();
    if (filters.from && filters.to && filters.from > filters.to) {
      this.error.set(this.t('Choose an end date on or after the start date.', 'اختر تاريخ نهاية في يوم البداية أو بعده.'));
      return;
    }
    this.activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => value.trim()));
    this.load(1);
  }

  load(page = this.page(), quiet = false): void {
    if (quiet && this.request && !this.request.closed) return;
    this.request?.unsubscribe();
    if (!quiet) this.loading.set(true);
    const patientId = this.route.snapshot.queryParamMap.get('patientId');
    this.request = this.api.prescriptions({
      ...this.activeFilters, issuedOnly: 'true', page: String(page), pageSize: '25', ...(patientId ? { patientId } : {}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        if (page > Math.max(1, result.totalPages)) { this.load(Math.max(1, result.totalPages)); return; }
        this.result.set(result);
        this.page.set(page);
        this.error.set('');
        this.loading.set(false);
      },
      error: response => {
        if (!quiet || [401, 403].includes(response.status)) this.result.set(null);
        this.error.set(this.t('Could not load prescriptions.', 'تعذر تحميل الروشتات.'));
        this.loading.set(false);
      },
    });
  }

  open(id: string, dialog: WorkspaceDialogComponent): void {
    this.closeDetails();
    this.detailLoading.set(true);
    dialog.open();
    this.detailRequest = this.api.prescription(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: record => {
        this.selected.set(record.id === id && record.issuedAt ? record : null);
        this.detailError.set(!this.selected());
        this.detailLoading.set(false);
      },
      error: () => { this.detailError.set(true); this.detailLoading.set(false); },
    });
  }

  closeDetails(): void {
    this.detailRequest?.unsubscribe();
    this.selected.set(null);
    this.detailError.set(false);
    this.detailLoading.set(false);
  }

  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
