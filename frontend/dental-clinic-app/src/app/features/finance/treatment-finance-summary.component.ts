import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, Revenue } from './finance-api.service';
import { money } from './finance-ui';
@Component({
  selector: 'app-treatment-finance-summary',
  imports: [RouterLink],
  template: `@if (auth.hasPermission('Finance.Revenue.View')) {
    <section class="panel">
      <h2>{{ t('Financial status', 'الحالة المالية') }}</h2>
      @if (item()) {
        <div class="summary-row">
          <span>{{ t('Revenue', 'الإيراد') }}</span
          ><strong>{{ format(item()!.amount) }}</strong>
        </div>
        <div class="summary-row">
          <span>{{ t('Paid', 'المدفوع') }}</span
          ><strong>{{ format(item()!.paid) }}</strong>
        </div>
        <div class="summary-row">
          <span>{{ t('Outstanding', 'المستحق') }}</span
          ><strong>{{ format(item()!.outstanding) }}</strong>
        </div>
        <a [routerLink]="['/finance/revenue']" [queryParams]="{ treatmentId: treatmentId() }">{{
          t('Open in Finance', 'فتح في المالية')
        }}</a>
      } @else {
        <p>
          {{
            t(
              'Revenue is created when treatment is completed.',
              'يتم إنشاء الإيراد عند اكتمال العلاج.'
            )
          }}
        </p>
      }
    </section>
  }`,
  styleUrl: './finance.scss',
})
export class TreatmentFinanceSummaryComponent {
  private api = inject(FinanceApiService);
  auth = inject(AuthService);
  i18n = inject(LocalizationService);
  treatmentId = input.required<string>();
  item = signal<Revenue | null>(null);
  ngOnInit() {
    if (this.auth.hasPermission('Finance.Revenue.View'))
      this.api
        .revenues({ treatmentId: this.treatmentId(), page: 1 })
        .subscribe((x) => this.item.set(x.items[0] || null));
  }
  format(v: number) {
    return money(v, this.item()!.currency, this.i18n.language());
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
