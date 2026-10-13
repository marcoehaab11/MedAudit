import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { timer, of, switchMap, catchError } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, BillingQueueItem } from './finance-api.service';
import { money } from './finance-ui';

@Component({
  selector: 'app-billing-queue', imports: [RouterLink],
  template: `<section class="billing-panel"><h2>{{ t('Complete invoices', 'إكمال الفاتورة') }}</h2>
    <p>{{ t('Completed procedures waiting for payment.', 'الإجراءات المكتملة التي تنتظر تسجيل الدفعة.') }}</p>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (loading()) { <p>{{ t('Loading…', 'جارٍ التحميل…') }}</p> }
    @for (item of items(); track item.revenueId) {
      <article><div><strong>{{ item.patientName }} @if (item.patientNumber) { · {{ item.patientNumber }} }</strong><p>{{ item.treatmentName }} · {{ format(item.outstanding, item.currency) }}</p></div>
        @if (auth.hasPermission('Finance.Payments.Create')) { <a [routerLink]="['/finance/payments/create']" [queryParams]="{revenueId: item.revenueId, returnTo: '/dashboard'}">{{ t('Complete invoice', 'إكمال الفاتورة') }}</a> }
      </article>
    } @empty { @if (!loading() && !error()) { <p>{{ t('No invoices waiting for completion.', 'لا توجد فواتير تنتظر الإكمال.') }}</p> } }
  </section>`,
  styles: [`.billing-panel { margin: 1rem 0; padding: 1rem; background: white; border: 1px solid #cbd5e1; border-radius: .75rem; } article { display:flex; align-items:center; justify-content:space-between; gap:1rem; border-top:1px solid #e2e8f0; padding:.75rem 0; } a { padding:.5rem; border-radius:.4rem; background:#0284c7; color:white; }`],
})
export class BillingQueueComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(FinanceApiService);
  private readonly i18n = inject(LocalizationService);
  readonly items = signal<BillingQueueItem[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    timer(0, 15000).pipe(switchMap(() => this.api.billingQueue().pipe(catchError(() => {
      this.error.set(this.t('Could not refresh invoices.', 'تعذر تحديث الفواتير.')); return of(null);
    }))), takeUntilDestroyed(inject(DestroyRef))).subscribe(items => {
      this.loading.set(false);
      if (items) { this.items.set(items); this.error.set(''); }
    });
  }
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  format(amount: number, currency: string) { return money(amount, currency, this.i18n.language()); }
}
