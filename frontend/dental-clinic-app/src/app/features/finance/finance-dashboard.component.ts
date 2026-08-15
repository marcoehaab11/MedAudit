import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, FinanceSummary } from './finance-api.service';
import { financePeriods, money } from './finance-ui';
@Component({
  selector: 'app-finance-dashboard',
  imports: [RouterLink, FormsModule],
  template: ` <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Financial operations', 'العمليات المالية') }}</p>
        <h1>{{ t('Finance dashboard', 'لوحة المالية') }}</h1>
      </div>
    </section>
    <nav class="finance-nav">
      <a routerLink="/finance">Dashboard</a><a routerLink="/finance/revenue">Revenue</a
      ><a routerLink="/finance/payments">Payments</a><a routerLink="/finance/expenses">Expenses</a
      ><a routerLink="/finance/categories">Categories</a>
    </nav>
    <section class="panel finance-filters">
      <label
        >{{ t('Period', 'الفترة')
        }}<select [(ngModel)]="period" (change)="load()">
          @for (p of periods(); track p.value) {
            <option [ngValue]="p.value">{{ p.label }}</option>
          }
        </select></label
      >
      @if (period === 5) {
        <label>{{ t('From', 'من') }}<input type="date" [(ngModel)]="from" /></label
        ><label>{{ t('To', 'إلى') }}<input type="date" [(ngModel)]="to" /></label
        ><button (click)="load()">{{ t('Apply', 'تطبيق') }}</button>
      }
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading finance…', 'جاري تحميل المالية…') }}</div>
    } @else if (data()) {
      <section class="metric-grid">
        @for (c of cards(); track c.label) {
          <article class="panel metric">
            <span>{{ c.label }}</span
            ><strong [class.amount-negative]="c.value < 0">{{ format(c.value) }}</strong>
          </article>
        }
      </section>
      <div class="detail-grid">
        <section class="panel">
          <h2>{{ t('Revenue by category', 'الإيراد حسب التصنيف') }}</h2>
          @for (x of data()!.revenueByCategory; track x.name) {
            <div class="summary-row">
              <span>{{ x.name }}</span
              ><strong>{{ format(x.amount) }}</strong>
            </div>
          } @empty {
            <p>{{ t('No revenue in this period.', 'لا توجد إيرادات في هذه الفترة.') }}</p>
          }
        </section>
        <section class="panel">
          <h2>{{ t('Expenses by category', 'المصروفات حسب التصنيف') }}</h2>
          @for (x of data()!.expensesByCategory; track x.name) {
            <div class="summary-row">
              <span>{{ x.name }}</span
              ><strong>{{ format(x.amount) }}</strong>
            </div>
          } @empty {
            <p>{{ t('No expenses in this period.', 'لا توجد مصروفات في هذه الفترة.') }}</p>
          }
        </section>
      </div>
      <p>{{ t('Clinic timezone', 'توقيت العيادة') }}: {{ data()!.timeZone }}</p>
    }`,
  styleUrl: './finance.scss',
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
      { label: this.t('Revenue', 'الإيراد'), value: x.revenue },
      { label: this.t('Payments received', 'المدفوعات المستلمة'), value: x.payments },
      { label: this.t('Outstanding', 'المستحق'), value: x.outstanding },
      { label: this.t('Expenses', 'المصروفات'), value: x.expenses },
      { label: this.t('Doctor compensation', 'تكلفة الأطباء'), value: x.doctorCompensation },
      { label: this.t('Net profit', 'صافي الربح'), value: x.netProfit },
    ];
  }
  format(v: number) {
    return money(v, this.data()!.currency, this.i18n.language());
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
@Component({
  selector: 'app-finance-nav',
  imports: [RouterLink],
  template: `<nav class="finance-nav">
    <a routerLink="/finance">Dashboard</a><a routerLink="/finance/revenue">Revenue</a
    ><a routerLink="/finance/payments">Payments</a><a routerLink="/finance/expenses">Expenses</a
    ><a routerLink="/finance/categories">Categories</a>
  </nav>`,
  styleUrl: './finance.scss',
})
export class FinanceNavComponent {}
