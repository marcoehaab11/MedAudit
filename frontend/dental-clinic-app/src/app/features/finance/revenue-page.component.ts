import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, RevenuePage, RevenueServiceTotal } from './finance-api.service';
import { FinanceNavComponent } from './finance-nav.component';
import { categoryTitle, money } from './finance-ui';

@Component({
  selector: 'app-revenue-page',
  imports: [FormsModule, RouterLink, FinanceNavComponent, DatePipe],
  templateUrl: './revenue-page.component.html',
  styleUrl: './revenue-page.component.scss',
  host: { '(window:focus)': 'refreshOnFocus()' },
})
export class RevenuePageComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(FinanceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(LocalizationService);
  private readonly requests = new Subject<void>();
  private readonly serviceDialog = viewChild.required<ElementRef<HTMLDialogElement>>('serviceDialog');

  protected readonly data = signal<RevenuePage | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly metrics = [
    { key: 'revenue', en: 'Total revenue', ar: 'إجمالي الإيرادات', icon: 'revenue' },
    { key: 'paid', en: 'Total paid', ar: 'إجمالي المدفوع', icon: 'paid' },
    { key: 'outstanding', en: 'Total outstanding', ar: 'إجمالي المستحق', icon: 'outstanding' },
    { key: 'count', en: 'Transactions', ar: 'عدد المعاملات', icon: 'count' },
  ] as const;
  protected readonly serviceGroups = computed(() => {
    const groups = new Map<string, { currency: string; services: RevenueServiceTotal[]; total: number }>();
    for (const service of this.data()?.summary?.services ?? []) {
      let group = groups.get(service.currency);
      if (!group) {
        group = { currency: service.currency, services: [], total: 0 };
        groups.set(service.currency, group);
      }
      group.services.push(service);
      group.total += service.revenue;
    }
    return [...groups.values()];
  });

  protected page = 1;
  protected search = '';
  protected from = '';
  protected to = '';
  private applied = { search: '', from: '', to: '' };

  constructor() {
    this.requests.pipe(
      switchMap(() => this.api.revenues({
        ...this.applied,
        page: this.page,
        includeSummary: true,
        patientId: this.route.snapshot.queryParamMap.get('patientId') || '',
        treatmentId: this.route.snapshot.queryParamMap.get('treatmentId') || '',
      }).pipe(
        map((data) => ({ data, error: false })),
        catchError(() => of({ data: null, error: true })),
      )),
      takeUntilDestroyed(),
    ).subscribe(({ data, error }) => {
      if (data && this.page > Math.max(1, data.totalPages)) {
        this.changePage(Math.max(1, data.totalPages));
        return;
      }
      this.data.set(data);
      this.loadError.set(error);
      this.loading.set(false);
    });
    this.load();
  }

  protected applyFilters() {
    this.applied = { search: this.search, from: this.from, to: this.to };
    this.changePage(1);
  }

  protected changePage(page: number) {
    this.page = page;
    this.load();
  }

  protected load() {
    this.loadError.set(false);
    this.loading.set(true);
    this.requests.next();
  }

  protected refreshOnFocus() {
    if (!this.loading() && !this.serviceDialog().nativeElement.open && !this.loadError()) {
      this.requests.next();
    }
  }

  protected openServices() {
    this.serviceDialog().nativeElement.showModal();
  }

  protected category(type: number | undefined, fallback?: string) {
    switch (type) {
      case 1: return this.t('Fillings and restorations', 'الحشوات والترميمات');
      case 2: return this.t('Extraction and surgery', 'الخلع والجراحة');
      case 3: return this.t('Implants', 'زراعة الأسنان');
      case 4: return this.t('Root canal', 'علاج العصب');
      case 5: return this.t('Crowns', 'التيجان');
      case 6: return this.t('Other services', 'خدمات أخرى');
      default: return categoryTitle(fallback, this.i18n.language());
    }
  }

  protected format(value: number, currency: string) {
    return money(value, currency, this.i18n.language());
  }

  protected formatCount(value: number) {
    return value.toLocaleString(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-US');
  }

  protected t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
