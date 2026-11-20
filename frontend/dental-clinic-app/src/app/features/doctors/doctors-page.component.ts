import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { DoctorApiService, DoctorDirectoryItem, DoctorFinancialDetails } from './doctor-api.service';
import { DoctorDues } from '../finance/finance-api.service';
import { money } from '../finance/finance-ui';

@Component({
  selector: 'app-doctors-page',
  imports: [FormsModule, WorkspaceDialogComponent],
  styleUrl: './doctor-directory.scss',
  template: `
    <header class="workspace-page-head">
      <div><h1>{{ t('Doctors', 'الأطباء') }}</h1>
        <p class="page-description">{{ t('Clinic directory and monthly visit statistics.', 'دليل الأطباء وإحصائيات الزيارات الشهرية') }}</p>
      </div>
      @if (ready()) { <span class="doctor-count">{{ t('Total doctors', 'إجمالي الأطباء') }} <strong>{{ doctors().length }}</strong></span> }
    </header>

    <div class="panel workspace-filters doctor-filters">
      <label class="workspace-filter-field"><span>{{ t('Name, specialty or phone', 'الاسم أو التخصص أو الهاتف') }}</span>
        <input type="search" [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </label>
      <label class="workspace-filter-field"><span>{{ t('Specialty', 'التخصص') }}</span>
        <select [ngModel]="specialty()" (ngModelChange)="specialty.set($event)">
          <option value="">{{ t('All specialties', 'كل التخصصات') }}</option>
          @for (item of specialties(); track item) { <option [value]="item">{{ item }}</option> }
        </select>
      </label>
      <label class="workspace-filter-field"><span>{{ t('Working day', 'يوم العمل') }}</span>
        <select [ngModel]="day()" (ngModelChange)="day.set($event)">
          <option value="">{{ t('All days', 'كل الأيام') }}</option>
          @for (day of workDays; track day) { <option [value]="day">{{ dayLabel(day) }}</option> }
        </select>
      </label>
      <label class="workspace-filter-field"><span>{{ t('Month', 'الشهر') }}</span>
        <input type="month" [ngModel]="month()" (ngModelChange)="changeMonth($event)" />
      </label>
    </div>

    @if (error()) {
      <div class="alert error" role="alert">{{ t('Could not load the doctor directory.', 'تعذر تحميل دليل الأطباء.') }}
        <button class="button" type="button" (click)="load()">{{ t('Try again', 'إعادة المحاولة') }}</button>
      </div>
    }
    @if (loading()) {
      <p role="status">{{ t('Loading doctors…', 'جارٍ تحميل الأطباء…') }}</p>
    } @else {
      <div class="doctor-grid">
        @for (doctor of filtered(); track doctor.id) {
          <article class="doctor-card">
            <header>
              <div class="doctor-avatar" aria-hidden="true">{{ initials(doctor.displayName) }}</div>
              <div class="doctor-identity">
                <h2><bdi>{{ doctor.displayName }}</bdi></h2>
                <p><bdi>{{ doctor.specialization }}</bdi></p>
                <span class="doctor-status" [class.active]="doctor.accountStatus === 2">{{ status(doctor.accountStatus) }}</span>
              </div>
            </header>
            <dl class="doctor-contact">
              <div><dt>{{ t('Phone', 'الهاتف') }}</dt><dd><bdi>{{ doctor.phone || '—' }}</bdi></dd></div>
              <div><dt>{{ t('Working days', 'أيام العمل') }}</dt><dd>{{ workingDays(doctor) }}</dd></div>
            </dl>
            <dl class="doctor-activity">
              <div><dt>{{ t('New patients', 'مرضى جدد') }}</dt><dd>{{ doctor.newPatients }}</dd></div>
              <div><dt>{{ t('Follow-ups', 'زيارات متابعة') }}</dt><dd>{{ doctor.followUps }}</dd></div>
              <div><dt>{{ t('Total visits', 'إجمالي الزيارات') }}</dt><dd>{{ doctor.totalVisits }}</dd></div>
            </dl>
            @if (doctor.dues; as dues) {
              <footer class="doctor-dues">
                <div>
                  <span>{{ t('Current dues', 'المستحقات الحالية') }}</span>
                  @for (amount of dueAmounts(dues); track amount.currency) {
                    <strong><bdi>{{ formatMoney(amount.total, amount.currency) }}</bdi></strong>
                  }
                </div>
                <button class="button" type="button" aria-haspopup="dialog"
                  [attr.aria-label]="t('Dues details', 'تفاصيل المستحقات') + ' · ' + doctor.displayName"
                  (click)="open(doctor, dialog)">{{ t('Dues details', 'تفاصيل المستحقات') }}</button>
              </footer>
            }
          </article>
        } @empty {
          <p class="panel">{{ t('No doctors match these filters.', 'لا يوجد أطباء مطابقون للفلاتر.') }}</p>
        }
      </div>
    }
    <app-workspace-dialog #dialog width="30rem" [title]="t('Doctor dues details', 'تفاصيل مستحقات الطبيب')"
      [closeLabel]="t('Close', 'إغلاق')" (closed)="clearDetails()">
      @if (detailLoading()) {
        <p role="status">{{ t('Loading account details…', 'جارٍ تحميل تفاصيل الحساب…') }}</p>
      } @else if (detailError()) {
        <p role="alert">{{ t('Could not load this doctor’s financial details.', 'تعذر تحميل مستحقات هذا الطبيب.') }}</p>
      } @else if (detail(); as record) {
        <div class="doctor-details">
          <h3><bdi>{{ record.displayName }}</bdi></h3>
          <p><bdi>{{ record.specialization }}</bdi></p>
          <dl>
            <div class="doctor-dues">
              <dt>{{ t('Current dues', 'المستحقات الحالية') }}</dt>
              <dd>
                @for (amount of dueAmounts(record.dues); track amount.currency) {
                  <strong><bdi>{{ formatMoney(amount.total, amount.currency) }}</bdi></strong>
                }
              </dd>
            </div>
            <div><dt>{{ t('Treatments with commission recorded', 'علاجات مسجّل لها مستحقات') }}</dt><dd>{{ record.dues.treatmentCount }}</dd></div>
            @if (record.percentage != null) {
              <div><dt>{{ t('Current commission', 'العمولة الحالية') }}</dt><dd><bdi>{{ record.percentage }}%</bdi></dd></div>
              <div><dt>{{ t('Commission basis', 'طريقة حساب العمولة') }}</dt>
                <dd>{{ record.commissionBasis === 1 ? t('Amount paid', 'المبلغ المدفوع') : t('Treatment value', 'قيمة العلاج') }}</dd></div>
            }
          </dl>
        </div>
      }
    </app-workspace-dialog>
  `,
})
export class DoctorsPageComponent {
  private readonly api = inject(DoctorApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private detailRequest?: Subscription;
  readonly month = signal('');
  readonly search = signal('');
  readonly specialty = signal('');
  readonly day = signal('');
  readonly doctors = signal<DoctorDirectoryItem[]>([]);
  readonly loading = signal(true);
  readonly ready = signal(false);
  readonly error = signal(false);
  readonly detail = signal<DoctorFinancialDetails | null>(null);
  readonly detailLoading = signal(false);
  readonly detailError = signal(false);
  readonly workDays = [6, 0, 1, 2, 3, 4, 5];
  readonly specialties = computed(() => [...new Set(this.doctors().map(x => x.specialization))].sort());
  readonly filtered = computed(() => {
    const term = this.search().trim().toLocaleLowerCase();
    return this.doctors().filter(x =>
      (!this.specialty() || x.specialization === this.specialty()) &&
      (!this.day() || x.workingDays.includes(Number(this.day()))) &&
      (!term || [x.displayName, x.specialization, x.phone ?? ''].some(value => value.toLocaleLowerCase().includes(term))));
  });

  constructor() {
    this.load();
    timer(30_000, 30_000).pipe(takeUntilDestroyed()).subscribe(() => {
      if (document.visibilityState === 'visible') this.load(true);
    });
  }

  changeMonth(month: string): void {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    this.month.set(month);
    this.load();
  }

  load(quiet = false): void {
    if (quiet && this.request && !this.request.closed) return;
    this.request?.unsubscribe();
    if (!quiet) this.loading.set(true);
    this.request = this.api.directory(this.month()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.month.set(result.month);
        this.doctors.set(result.items);
        this.loading.set(false);
        this.ready.set(true);
        this.error.set(false);
      },
      error: response => {
        if (!quiet || [401, 403].includes(response.status)) {
          this.doctors.set([]);
          this.ready.set(false);
        }
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  open(doctor: DoctorDirectoryItem, dialog: WorkspaceDialogComponent): void {
    this.clearDetails();
    this.detailLoading.set(true);
    dialog.open();
    this.detailRequest = this.api.dues(doctor.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: result => {
        this.detail.set(result.id === doctor.id ? result : null);
        this.detailError.set(!this.detail());
        this.detailLoading.set(false);
      },
      error: () => { this.detailError.set(true); this.detailLoading.set(false); },
    });
  }

  clearDetails(): void {
    this.detailRequest?.unsubscribe();
    this.detail.set(null);
    this.detailError.set(false);
    this.detailLoading.set(false);
  }

  status(status: number): string {
    if (status === 2) return this.t('Active', 'نشط');
    if (status === 1) return this.t('Invited', 'الدعوة معلّقة');
    return this.t('Inactive', 'غير نشط');
  }

  initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join(''); }
  dayLabel(day: number): string {
    return this.t(
      ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][day],
    );
  }
  workingDays(doctor: DoctorDirectoryItem): string {
    return this.workDays.filter(day => doctor.workingDays.includes(day)).map(day => this.dayLabel(day)).join(this.t(', ', '، '))
      || this.t('No days set', 'لم تُحدد أيام العمل');
  }
  dueAmounts(dues: DoctorDues) { return dues.byCurrency?.length ? dues.byCurrency : [dues]; }
  formatMoney(value: number, currency: string): string { return money(value, currency, this.i18n.language()); }
  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
