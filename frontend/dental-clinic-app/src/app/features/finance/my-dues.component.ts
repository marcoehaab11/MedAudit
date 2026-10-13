import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FinanceApiService, DoctorDues } from './finance-api.service';
import { LocalizationService } from '../../core/localization.service';
import { money } from './finance-ui';

@Component({selector: 'app-my-dues', imports: [RouterLink], template: `
  <section class="panel"><a routerLink="/dashboard">{{ t('Overview', 'نظرة عامة') }}</a>
    <h1>{{ t('My recorded compensation', 'مستحقاتي المسجلة') }}</h1>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    @if (data(); as value) { @for (balance of value.byCurrency || []; track balance.currency) { <h2>{{ format(balance.total, balance.currency) }}</h2> } @empty { <h2>{{ format(value.total, value.currency) }}</h2> }<p>{{ value.treatmentCount }} {{ t('procedures with recorded compensation', 'إجراءات لها مستحقات مسجلة') }}</p>
      <p>{{ t('Total recorded compensation. Transfers to the doctor are not tracked here.', 'إجمالي المستحقات المسجلة. التحويلات المدفوعة للدكتور لا يتم تسجيلها في هذه الصفحة.') }}</p>
    } @else if (!error()) { <p>{{ t('Loading…', 'جارٍ التحميل…') }}</p> }
  </section>`, styles: [`.panel { padding: 1.5rem; background: white; border: 1px solid #e2e8f0; border-radius: .75rem; }`]})
export class MyDuesComponent {
  private readonly api = inject(FinanceApiService);
  private readonly i18n = inject(LocalizationService);
  readonly data = signal<DoctorDues | null>(null);
  readonly error = signal('');
  constructor() { this.api.myDues().subscribe({ next: value => this.data.set(value), error: () => this.error.set(this.t('Could not load your compensation.', 'تعذر تحميل مستحقاتك.')) }); }
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  format(value: number, currency: string) { return money(value, currency, this.i18n.language()); }
}
