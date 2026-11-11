import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { FinanceApiService, Page, Revenue } from './finance-api.service';
import { categoryTitle, money } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-revenue-page',
  standalone: true,
  imports: [FormsModule, RouterLink, FinanceNavComponent, DatePipe],
  template: `
    <section class="page-head">
      <h1>{{ t('Revenue', 'الإيرادات') }}</h1>
    </section>

    <app-finance-nav />

    <section class="panel finance-filters">
      <label class="workspace-filter-field"><span>{{ t('Search description…', 'بحث في الوصف أو الملاحظات…') }}</span><input
        class="filter-search-input"
        [(ngModel)]="search"
        [placeholder]="t('Search description…', 'بحث في الوصف أو الملاحظات…')"
      /></label>
      <label class="workspace-filter-field"><span>{{ t('From date', 'من تاريخ') }}</span><input
        class="filter-date-input"
        type="date"
        [(ngModel)]="from"
        [title]="t('From date', 'من تاريخ')"
      /></label>
      <label class="workspace-filter-field"><span>{{ t('To date', 'إلى تاريخ') }}</span><input
        class="filter-date-input"
        type="date"
        [(ngModel)]="to"
        [title]="t('To date', 'إلى تاريخ')"
      /></label>
      <button type="button" class="btn-filter" (click)="page = 1; load()">
        🔍 {{ t('Search', 'بحث وتصفية') }}
      </button>
    </section>

    @if (loadError()) { <div class="alert error" role="alert"><p>{{ loadError() }}</p><button type="button" (click)="load()">{{ t('Try again', 'إعادة المحاولة') }}</button></div> }
    @if (loading()) {
      <div class="state">{{ t('Loading revenue records…', 'جاري تحميل سجلات الإيرادات…') }}</div>
    } @else if (!loadError()) {
      <section class="panel table-panel">
        <div class="table-responsive"><table class="finance-table">
          <thead>
            <tr>
              <th>{{ t('Date', 'التاريخ') }}</th>
              <th>{{ t('Patient', 'المريض') }}</th>
              <th>{{ t('Treatment', 'العلاج') }}</th>
              <th>{{ t('Category', 'التصنيف') }}</th>
              <th>{{ t('Revenue', 'الإيراد') }}</th>
              <th>{{ t('Paid', 'المدفوع') }}</th>
              <th>{{ t('Outstanding', 'المستحق') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (x of data()?.items; track x.id) {
              <tr>
                <td>{{ x.occurredAt | date: 'dd/MM/yyyy' }}</td>
                <td><strong>{{ x.patientName || '—' }}</strong></td>
                <td>{{ x.treatmentName || '—' }}</td>
                <td>{{ getCategoryName(x.categoryName) }}</td>
                <td class="amount-neutral">{{ format(x.amount, x.currency) }}</td>
                <td class="amount-positive">{{ format(x.paid, x.currency) }}</td>
                <td [class.amount-negative]="x.outstanding > 0">{{ format(x.outstanding, x.currency) }}</td>
                <td>
                  @if (x.outstanding > 0 && auth.hasPermission('Finance.Payments.Create')) {
                    <a
                      class="button sm primary"
                      [routerLink]="['/finance/payments/create']"
                      [queryParams]="{ revenueId: x.id }"
                    >
                      💳 {{ t('Pay', 'تسجيل دفعة') }}
                    </a>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
                  {{ t('No revenue records found.', 'لا توجد سجلات إيرادات.') }}
                </td>
              </tr>
            }
          </tbody>
        </table></div>

        <div class="pagination">
          <button [disabled]="page === 1" (click)="page = page - 1; load()">‹</button>
          <span>{{ page }} / {{ data()?.totalPages || 1 }}</span>
          <button [disabled]="page >= (data()?.totalPages || 1)" (click)="page = page + 1; load()">›</button>
        </div>
      </section>
    }
  `,
})
export class RevenuePageComponent {
  readonly auth = inject(AuthService);
  private api = inject(FinanceApiService);
  private route = inject(ActivatedRoute);
  i18n = inject(LocalizationService);
  data = signal<Page<Revenue> | null>(null);
  loading = signal(true);
  loadError = signal('');
  page = 1;
  search = '';
  from = '';
  to = '';
  patientId = this.route.snapshot.queryParamMap.get('patientId') || '';
  treatmentId = this.route.snapshot.queryParamMap.get('treatmentId') || '';

  constructor() {
    this.load();
  }

  load() {
    this.loadError.set('');
    this.loading.set(true);
    this.loading.set(true);
    this.api
      .revenues({
        page: this.page,
        search: this.search,
        from: this.from,
        to: this.to,
        patientId: this.patientId,
        treatmentId: this.treatmentId,
      })
      .subscribe({
        next: (x) => {
          this.data.set(x);
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.loadError.set(this.t('Could not load these records. Please try again.', 'تعذر تحميل السجلات. يرجى إعادة المحاولة.')); },
      });
  }

  getCategoryName(name: string) {
    return categoryTitle(name, this.i18n.language());
  }

  format(v: number, c: string) {
    return money(v, c, this.i18n.language());
  }

  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}


