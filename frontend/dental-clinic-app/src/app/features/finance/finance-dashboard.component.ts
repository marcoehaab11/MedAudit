import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, FinanceSummary } from './finance-api.service';
import { FinanceNavComponent } from './finance-nav.component';
import { categoryTitle, financePeriods, money } from './finance-ui';

@Component({
  selector: 'app-finance-dashboard',
  imports: [FormsModule, FinanceNavComponent],
  templateUrl: './finance-dashboard.component.html',
  styleUrl: './finance-dashboard.component.scss',
})
export class FinanceDashboardComponent {
  private readonly api = inject(FinanceApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  protected readonly data = signal<FinanceSummary | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly periods = computed(() => financePeriods(this.i18n.language() === 'ar'));
  protected period = 3;
  protected from = '';
  protected to = '';

  constructor() {
    this.load();
  }

  protected changePeriod(period: number): void {
    this.period = period;
    if (period === 5) {
      this.request?.unsubscribe();
      this.data.set(null);
      this.failed.set(false);
      this.loading.set(false);
      return;
    }
    this.load();
  }

  protected load(): void {
    const custom = this.period === 5;
    if (custom && (!this.from || !this.to || this.from > this.to)) return;
    this.request?.unsubscribe();
    this.data.set(null);
    this.failed.set(false);
    this.loading.set(true);
    this.request = this.api.dashboard(this.period, custom ? this.from : '', custom ? this.to : '')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          this.data.set(summary);
          this.loading.set(false);
        },
        error: () => {
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  protected cards(summary: FinanceSummary) {
    return [
      { label: this.t('Revenue', 'الإيرادات'), value: summary.revenue, description: '', icon: 'M3 21h18M5 17v-4m5 4V9m5 8v-6m5 6V5M3 10l6-5 5 2 6-5' },
      { label: this.t('Payments received', 'المدفوعات المستلمة'), value: summary.payments, description: this.t('Collected during the period', 'تم تحصيلها خلال الفترة'), icon: 'M20 8V5H5a2 2 0 0 0 0 4h15v11H5a2 2 0 0 1-2-2V7m18 5h-6v5h6m-3-2.5h.01' },
      { label: this.t('Outstanding', 'المستحق'), value: summary.outstanding, description: this.t('Uncollected revenue for the period', 'إيرادات الفترة التي لم تُحصّل بعد'), icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM12 6v10m2-8h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3h-3' },
      { label: this.t('Expenses', 'المصروفات'), value: summary.expenses, description: this.t('During the selected period', 'خلال الفترة المحددة'), icon: 'M3 6h18v12H3zM8 12h.01m8 0h.01m-2 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
      { label: this.t('Doctor compensation', 'مستحقات الأطباء'), value: summary.doctorCompensation, description: this.t('Recorded for the period', 'المستحقات المسجلة خلال الفترة'), icon: 'M5 3H3v5a5 5 0 0 0 10 0V3h-2m-3 10v2a5 5 0 0 0 10 0v-1m2-2a2 2 0 1 1-4 0 2 2 0 0 1 4 0z' },
      { label: this.t('Net profit', 'صافي الربح'), value: summary.netProfit, description: this.t('After expenses and doctor compensation', 'بعد المصروفات ومستحقات الأطباء'), icon: 'M12 2l3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1zM12 7v10m2-8h-3a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3h-3' },
      { label: this.t('Treasury balance', 'رصيد الخزنة'), value: null, description: this.t('Balance unavailable in the ledger', 'الرصيد غير متاح في السجل المالي'), icon: 'M2 9l10-6 10 6H2zm2 12h16M6 11v7m4-7v7m4-7v7m4-7v7' },
      { label: this.t('Overdue patient balances', 'مستحقات مرضى متأخرة'), value: null, description: this.t('Payment due dates are unavailable', 'مواعيد استحقاق السداد غير متاحة'), icon: 'M7 3v4m10-4v4M3 10h18m0 0V5H3v15h8m10-3a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm-4-2v2l1 1' },
    ];
  }

  protected categoryGroups(summary: FinanceSummary) {
    return [
      { label: this.t('Revenue by category', 'الإيرادات حسب التصنيف'), total: summary.revenue, rows: summary.revenueByCategory, empty: this.t('No revenue in this period.', 'لا توجد إيرادات في هذه الفترة.') },
      { label: this.t('Expenses by category', 'المصروفات حسب التصنيف'), total: summary.expenses, rows: summary.expensesByCategory, empty: this.t('No expenses in this period.', 'لا توجد مصروفات في هذه الفترة.') },
    ];
  }

  protected share(value: number, total: number): number {
    return total > 0 ? Math.min(1, Math.max(0, value / total)) : 0;
  }

  protected percent(value: number, signDisplay: Intl.NumberFormatOptions['signDisplay'] = 'auto'): string {
    return new Intl.NumberFormat(this.locale(), { style: 'percent', maximumFractionDigits: 1, signDisplay }).format(value);
  }

  protected comparisonDates(from: string, to: string): string {
    const dates = new Intl.DateTimeFormat(this.locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return dates.formatRange(new Date(from), new Date(to));
  }

  protected format(value: number, currency: string): string {
    return money(value, currency, this.i18n.language());
  }

  protected categoryName(name: string): string {
    return categoryTitle(name, this.i18n.language());
  }

  private locale(): string {
    return this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB';
  }

  protected t(en: string, ar: string): string {
    return this.i18n.language() === 'ar' ? ar : en;
  }
}
