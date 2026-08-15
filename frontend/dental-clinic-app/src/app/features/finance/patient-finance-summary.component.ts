import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, PatientBalance } from './finance-api.service';
import { money } from './finance-ui';
@Component({
  selector: 'app-patient-finance-summary',
  imports: [RouterLink],
  template: `@if (auth.hasPermission('Finance.View')) {
    <section class="panel">
      <div class="page-head">
        <h2>{{ t('Financial summary', 'الملخص المالي') }}</h2>
        <a [routerLink]="['/finance/revenue']" [queryParams]="{ patientId: patientId() }">{{
          t('Open finance', 'فتح المالية')
        }}</a>
      </div>
      @if (loading()) {
        <p>{{ t('Loading…', 'جاري التحميل…') }}</p>
      } @else if (data()) {
        <div class="metric-grid">
          <div class="metric">
            <span>{{ t('Revenue', 'الإيراد') }}</span
            ><strong>{{ format(data()!.totalRevenue) }}</strong>
          </div>
          <div class="metric">
            <span>{{ t('Paid', 'المدفوع') }}</span
            ><strong>{{ format(data()!.totalPaid) }}</strong>
          </div>
          <div class="metric">
            <span>{{ t('Outstanding', 'المستحق') }}</span
            ><strong>{{ format(data()!.outstanding) }}</strong>
          </div>
        </div>
      }
    </section>
  }`,
  styleUrl: './finance.scss',
})
export class PatientFinanceSummaryComponent {
  private api = inject(FinanceApiService);
  auth = inject(AuthService);
  i18n = inject(LocalizationService);
  patientId = input.required<string>();
  data = signal<PatientBalance | null>(null);
  loading = signal(true);
  ngOnInit() {
    if (this.auth.hasPermission('Finance.View'))
      this.api.patientBalance(this.patientId()).subscribe({
        next: (x) => {
          this.data.set(x);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
  format(v: number) {
    return money(v, this.data()!.currency, this.i18n.language());
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
