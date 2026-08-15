import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, Page, Revenue } from './finance-api.service';
import { money } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';
@Component({
  selector: 'app-revenue-page',
  imports: [FormsModule, RouterLink, FinanceNavComponent],
  template: `<section class="page-head">
      <h1>{{ t('Revenue', 'الإيرادات') }}</h1>
    </section>
    <app-finance-nav />
    <section class="panel finance-filters">
      <input [(ngModel)]="search" [placeholder]="t('Search description', 'بحث في الوصف')" /><input
        type="date"
        [(ngModel)]="from"
      /><input type="date" [(ngModel)]="to" /><button (click)="page = 1; load()">
        {{ t('Search', 'بحث') }}
      </button>
    </section>
    @if (loading()) {
      <div class="state">{{ t('Loading…', 'جاري التحميل…') }}</div>
    } @else {
      <section class="panel">
        <table class="finance-table">
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
                <td>{{ x.occurredAt.slice(0, 10) }}</td>
                <td>{{ x.patientName || '—' }}</td>
                <td>{{ x.treatmentName || '—' }}</td>
                <td>{{ x.categoryName }}</td>
                <td>{{ format(x.amount, x.currency) }}</td>
                <td>{{ format(x.paid, x.currency) }}</td>
                <td>{{ format(x.outstanding, x.currency) }}</td>
                <td>
                  @if (x.outstanding > 0) {
                    <a
                      [routerLink]="['/finance/payments/create']"
                      [queryParams]="{ revenueId: x.id }"
                      >{{ t('Pay', 'دفع') }}</a
                    >
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">{{ t('No revenue found.', 'لا توجد إيرادات.') }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="pagination">
          <button [disabled]="page === 1" (click)="page = page - 1; load()">‹</button
          ><span>{{ page }} / {{ data()?.totalPages || 1 }}</span
          ><button [disabled]="page >= (data()?.totalPages || 1)" (click)="page = page + 1; load()">
            ›
          </button>
        </div>
      </section>
    }`,
  styleUrl: './finance.scss',
})
export class RevenuePageComponent {
  private api = inject(FinanceApiService);
  private route = inject(ActivatedRoute);
  i18n = inject(LocalizationService);
  data = signal<Page<Revenue> | null>(null);
  loading = signal(true);
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
        error: () => this.loading.set(false),
      });
  }
  format(v: number, c: string) {
    return money(v, c, this.i18n.language());
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
