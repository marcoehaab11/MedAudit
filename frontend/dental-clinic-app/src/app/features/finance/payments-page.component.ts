import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { FinanceApiService, Page, Payment, Revenue } from './finance-api.service';
import { money, paymentError, paymentMethod } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';
@Component({
  selector: 'app-payments-page',
  imports: [FormsModule, RouterLink, FinanceNavComponent],
  template: `<section class="page-head">
      <h1>{{ t('Payments', 'المدفوعات') }}</h1>
      <a class="button primary" routerLink="/finance/payments/create">{{
        t('Record payment', 'تسجيل دفعة')
      }}</a>
    </section>
    <app-finance-nav />
    <section class="panel finance-filters">
      <input type="date" [(ngModel)]="from" /><input type="date" [(ngModel)]="to" /><button
        (click)="load()"
      >
        {{ t('Apply', 'تطبيق') }}
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
              <th>{{ t('Amount', 'المبلغ') }}</th>
              <th>{{ t('Method', 'الطريقة') }}</th>
              <th>{{ t('Reference', 'المرجع') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of data()?.items; track x.id) {
              <tr>
                <td>{{ x.paidAt.slice(0, 10) }}</td>
                <td>{{ x.patientName || '—' }}</td>
                <td>{{ format(x.amount, x.currency) }}</td>
                <td>{{ method(x.paymentMethod) }}</td>
                <td>{{ x.reference || '—' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">{{ t('No payments found.', 'لا توجد مدفوعات.') }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }`,
  styleUrl: './finance.scss',
})
export class PaymentsPageComponent {
  private api = inject(FinanceApiService);
  i18n = inject(LocalizationService);
  data = signal<Page<Payment> | null>(null);
  loading = signal(true);
  from = '';
  to = '';
  constructor() {
    this.load();
  }
  load() {
    this.api.payments({ from: this.from, to: this.to, page: 1 }).subscribe({
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
  method(v: number) {
    return paymentMethod(v, this.i18n.language() === 'ar');
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
@Component({
  selector: 'app-payment-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `<a routerLink="/finance/payments">{{ t('Back to payments', 'العودة للمدفوعات') }}</a>
    <section class="page-head">
      <h1>{{ t('Record payment', 'تسجيل دفعة') }}</h1>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (revenue()) {
      <section class="panel">
        <div class="summary-row">
          <span>{{ t('Patient', 'المريض') }}</span
          ><strong>{{ revenue()!.patientName || '—' }}</strong>
        </div>
        <div class="summary-row">
          <span>{{ t('Outstanding', 'المستحق') }}</span
          ><strong>{{ format(revenue()!.outstanding, revenue()!.currency) }}</strong>
        </div>
      </section>
    }
    <form class="panel finance-form" [formGroup]="form" (ngSubmit)="save()">
      <label class="wide"
        >{{ t('Revenue ID', 'رقم الإيراد')
        }}<input formControlName="revenueId" (blur)="loadRevenue()" /></label
      ><label
        >{{ t('Amount', 'المبلغ')
        }}<input type="number" min="0.01" step="0.01" formControlName="amount" /></label
      ><label
        >{{ t('Method', 'الطريقة')
        }}<select formControlName="paymentMethod">
          <option [value]="1">{{ t('Cash', 'نقدي') }}</option>
          <option [value]="2">{{ t('Card', 'بطاقة') }}</option>
          <option [value]="3">{{ t('Bank transfer', 'تحويل بنكي') }}</option>
          <option [value]="4">{{ t('Other', 'أخرى') }}</option>
        </select></label
      ><label>{{ t('Date', 'التاريخ') }}<input type="date" formControlName="paidDate" /></label
      ><label>{{ t('Time', 'الوقت') }}<input type="time" formControlName="paidTime" /></label
      ><label>{{ t('Reference', 'المرجع') }}<input formControlName="reference" /></label
      ><label class="wide"
        >{{ t('Notes', 'ملاحظات') }}<textarea formControlName="notes"></textarea></label
      ><button class="primary" [disabled]="form.invalid || saving()">
        {{ t('Save payment', 'حفظ الدفعة') }}
      </button>
    </form>`,
  styleUrl: './finance.scss',
})
export class PaymentFormComponent {
  private api = inject(FinanceApiService);
  private router = inject(Router);
  i18n = inject(LocalizationService);
  revenue = signal<Revenue | null>(null);
  error = signal('');
  saving = signal(false);
  form = inject(FormBuilder).nonNullable.group({
    revenueId: [
      inject(ActivatedRoute).snapshot.queryParamMap.get('revenueId') || '',
      Validators.required,
    ],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: [1, Validators.required],
    paidDate: [new Date().toISOString().slice(0, 10), Validators.required],
    paidTime: ['09:00', Validators.required],
    reference: '',
    notes: '',
  });
  constructor() {
    if (this.form.controls.revenueId.value) this.loadRevenue();
  }
  loadRevenue() {
    const id = this.form.controls.revenueId.value;
    if (!id) return;
    this.api.revenue(id).subscribe({
      next: (x) => {
        this.revenue.set(x);
        this.form.controls.amount.setValidators([
          Validators.required,
          Validators.min(0.01),
          Validators.max(x.outstanding),
        ]);
        this.form.controls.amount.setValue(x.outstanding);
      },
      error: () => this.error.set(this.t('Revenue not found.', 'الإيراد غير موجود.')),
    });
  }
  save() {
    if (this.form.invalid || !this.revenue()) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    this.api
      .createPayment({
        ...v,
        patientId: this.revenue()!.patientId,
        treatmentId: this.revenue()!.treatmentId,
      })
      .subscribe({
        next: () => this.router.navigate(['/finance/payments']),
        error: (e) => {
          this.error.set(paymentError(e.status, this.i18n.language() === 'ar'));
          this.saving.set(false);
        },
      });
  }
  format(v: number, c: string) {
    return money(v, c, this.i18n.language());
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
