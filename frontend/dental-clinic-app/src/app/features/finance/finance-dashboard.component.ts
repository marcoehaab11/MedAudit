import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, FinanceSummary } from './finance-api.service';
import { financePeriods, money, categoryTitle } from './finance-ui';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-finance-nav',
  imports: [RouterLink, RouterLinkActive],
  template: `<nav class="finance-nav" [attr.aria-label]="t('Finance navigation', 'أقسام المالية')">
    <a routerLink="/finance" [routerLinkActiveOptions]="{ exact: true }" routerLinkActive="active">
      {{ t('Dashboard', 'لوحة المالية') }}
    </a>
    <a routerLink="/finance/revenue" routerLinkActive="active">
      {{ t('Revenue', 'الإيرادات') }}
    </a>
    <a routerLink="/finance/payments" routerLinkActive="active">
      {{ t('Payments', 'المدفوعات') }}
    </a>
    <a routerLink="/finance/expenses" routerLinkActive="active">
      {{ t('Expenses', 'المصروفات') }}
    </a>
    <a routerLink="/finance/categories" routerLinkActive="active">
      {{ t('Categories', 'التصنيفات') }}
    </a>
  </nav>`,
})
export class FinanceNavComponent {
  readonly i18n = inject(LocalizationService);
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

@Component({
  styleUrl: './finance.scss',
  selector: 'app-finance-dashboard',
  imports: [FormsModule, FinanceNavComponent],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Financial operations', 'العمليات المالية') }}</p>
        <h1>{{ t('Finance dashboard', 'لوحة المالية') }}</h1>
      </div>
    </section>
    <app-finance-nav />
    <section class="panel finance-filters">
      <label>
        {{ t('Period', 'الفترة') }}
        <select [(ngModel)]="period" (change)="load()">
          @for (p of periods(); track p.value) {
            <option [ngValue]="p.value">{{ p.label }}</option>
          }
        </select>
      </label>
      @if (period === 5) {
        <label>{{ t('From', 'من') }} <input type="date" [(ngModel)]="from" /></label>
        <label>{{ t('To', 'إلى') }} <input type="date" [(ngModel)]="to" /></label>
        <button class="btn-filter" (click)="load()">{{ t('Apply', 'تطبيق') }}</button>
      }
    </section>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state" role="status">{{ t('Loading finance…', 'جاري تحميل البيانات المالية…') }}</div>
    } @else if (data()) {
      <section class="metric-grid">
        @for (c of cards(); track c.label) {
          <article class="panel metric">
            <span>{{ c.label }}</span>
            <strong [class.amount-negative]="c.value < 0">{{ format(c.value) }}</strong>
          </article>
        }
      </section>
      <div class="detail-grid">
        <section class="panel">
          <h2>{{ t('Revenue by category', 'الإيرادات حسب التصنيف') }}</h2>
          @for (x of data()!.revenueByCategory; track x.name) {
            <div class="summary-row">
              <span>{{ getCategoryName(x.name) }}</span>
              <strong>{{ format(x.amount) }}</strong>
            </div>
          } @empty {
            <p>{{ t('No revenue in this period.', 'لا توجد إيرادات في هذه الفترة.') }}</p>
          }
        </section>
        <section class="panel">
          <h2>{{ t('Expenses by category', 'المصروفات حسب التصنيف') }}</h2>
          @for (x of data()!.expensesByCategory; track x.name) {
            <div class="summary-row">
              <span>{{ getCategoryName(x.name) }}</span>
              <strong>{{ format(x.amount) }}</strong>
            </div>
          } @empty {
            <p>{{ t('No expenses in this period.', 'لا توجد مصروفات في هذه الفترة.') }}</p>
          }
        </section>
      </div>
      <p style="color: var(--muted); font-size: 0.85rem; margin-top: 1rem;">
        {{ t('Clinic timezone', 'النطاق الزمني للعيادة') }}: {{ data()!.timeZone }}
      </p>
    }`,
})
export class FinanceDashboardComponent {
  private api = inject(FinanceApiService);
  readonly i18n = inject(LocalizationService);
  data = signal<FinanceSummary | null>(null);
  loading = signal(true);
  error = signal('');
  period = 3;
  from = '';
  to = '';
  constructor() {
    this.load();
  }
  periods() {
    return financePeriods(this.i18n.language() === 'ar');
  }
  load() {
    this.loading.set(true);
    this.api.dashboard(this.period, this.from, this.to).subscribe({
      next: (x) => {
        this.data.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Finance could not be loaded.', 'تعذر تحميل البيانات المالية.'));
        this.loading.set(false);
      },
    });
  }
  cards() {
    const x = this.data()!;
    return [
      { label: this.t('Revenue', 'الإيرادات'), value: x.revenue },
      { label: this.t('Payments received', 'المدفوعات المستلمة'), value: x.payments },
      { label: this.t('Outstanding', 'المستحق'), value: x.outstanding },
      { label: this.t('Expenses', 'المصروفات'), value: x.expenses },
      { label: this.t('Doctor compensation', 'مستحقات الأطباء'), value: x.doctorCompensation },
      { label: this.t('Net profit', 'صافي الربح'), value: x.netProfit },
    ];
  }
  format(v: number) {
    return money(v, this.data()!.currency, this.i18n.language());
  }
  getCategoryName(name: string) {
    return categoryTitle(name, this.i18n.language());
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

