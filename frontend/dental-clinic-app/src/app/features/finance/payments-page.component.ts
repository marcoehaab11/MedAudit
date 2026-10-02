import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { FinanceApiService, Page, Payment, Revenue } from './finance-api.service';
import { money, paymentError, paymentMethod } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-payments-page',
  standalone: true,
  imports: [FormsModule, RouterLink, FinanceNavComponent, DatePipe],
  template: `
    <section class="page-head">
      <h1>{{ t('Payments', 'المدفوعات') }}</h1>
      <a class="button primary" routerLink="/finance/payments/create">
        + {{ t('Record payment', 'تسجيل دفعة جديدة') }}
      </a>
    </section>

    <app-finance-nav />

    <section class="panel finance-filters">
      <input
        class="filter-date-input"
        type="date"
        [(ngModel)]="from"
        [title]="t('From date', 'من تاريخ')"
      />
      <input
        class="filter-date-input"
        type="date"
        [(ngModel)]="to"
        [title]="t('To date', 'إلى تاريخ')"
      />
      <button type="button" class="btn-filter" (click)="load()">
        🔍 {{ t('Apply Filter', 'تطبيق التصفية') }}
      </button>
    </section>

    @if (loading()) {
      <div class="state">{{ t('Loading payments…', 'جاري تحميل المدفوعات…') }}</div>
    } @else {
      <section class="panel table-panel">
        <div class="table-responsive"><table class="finance-table">
          <thead>
            <tr>
              <th>{{ t('Payment Date', 'تاريخ السداد') }}</th>
              <th>{{ t('Patient', 'المريض') }}</th>
              <th>{{ t('Amount Paid', 'المبلغ المدفوع') }}</th>
              <th>{{ t('Payment Method', 'طريقة الدفع') }}</th>
              <th>{{ t('Reference', 'المرجع') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of data()?.items; track x.id) {
              <tr>
                <td>{{ x.paidAt | date: 'dd/MM/yyyy' }}</td>
                <td><strong>{{ x.patientName || '—' }}</strong></td>
                <td class="amount-positive">{{ format(x.amount, x.currency) }}</td>
                <td>
                  <span class="badge status-1">{{ method(x.paymentMethod) }}</span>
                </td>
                <td>{{ x.reference || '—' }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
                  {{ t('No payments recorded.', 'لا توجد مدفوعات مسجلة.') }}
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      </section>
    }
  `,
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
  styleUrl: './finance.scss',
  selector: 'app-payment-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DateInputComponent],
  template: `
    <div class="finance-form-page">
      <a class="back-link" routerLink="/finance/payments">
        ← {{ t('Back to payments', 'العودة للمدفوعات') }}
      </a>

      <section class="page-head">
        <h1>{{ t('Record Payment', 'تسجيل دفعة مالية') }}</h1>
      </section>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      @if (revenue()) {
        <section class="panel" style="background: linear-gradient(135deg, #f8fafc 0%, #f0f7ff 100%); border: 1.5px solid #bae6fd;">
          <div class="summary-row">
            <span>{{ t('Patient', 'المريض') }}:</span>
            <strong>{{ revenue()!.patientName || '—' }}</strong>
          </div>
          <div class="summary-row">
            <span>{{ t('Outstanding Balance', 'المبلغ المستحق المتبقي') }}:</span>
            <strong style="color: #0c2875; font-size: 1.25rem;">{{ format(revenue()!.outstanding, revenue()!.currency) }}</strong>
          </div>
        </section>
      }

      <form class="finance-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Revenue ID', 'رقم الإيراد المرتبط') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" formControlName="revenueId" (blur)="loadRevenue()" [placeholder]="t('Enter or paste revenue ID…', 'أدخل رقم الإيراد…')" />
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Payment Amount', 'المبلغ المدفوع') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" type="number" min="0.01" step="0.01" formControlName="amount" />
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Payment Method', 'طريقة الدفع') }} <strong class="req">*</strong></span>
            </label>
            <select class="form-input" formControlName="paymentMethod">
              <option [value]="1">{{ t('Cash', 'نقدي (كاش)') }}</option>
              <option [value]="2">{{ t('Card / POS', 'بطاقة بنكية / فيزا') }}</option>
              <option [value]="3">{{ t('Bank transfer', 'تحويل بنكي') }}</option>
              <option [value]="4">{{ t('Other', 'طريقة أخرى') }}</option>
            </select>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Date', 'التاريخ') }} <strong class="req">*</strong></span>
            </label>
            <app-date-input formControlName="paidDate"></app-date-input>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Time', 'الوقت') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" type="time" formControlName="paidTime" />
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Receipt / Reference Number', 'رقم الإيصال / المرجع') }}</span>
            </label>
            <input class="form-input" formControlName="reference" [placeholder]="t('e.g. REC-2026-001', 'مثال: REC-2026-001')" />
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Notes', 'ملاحظات') }}</span>
            </label>
            <textarea class="form-textarea" rows="2" formControlName="notes" [placeholder]="t('Add any notes…', 'أي ملاحظات إضافية…')"></textarea>
          </div>
        </div>

        <div class="form-actions">
          <a class="button btn-cancel" routerLink="/finance/payments">{{ t('Cancel', 'إلغاء') }}</a>
          <button class="button primary btn-submit" [disabled]="form.invalid || saving()">
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Payment', 'حفظ وتسجيل الدفعة') }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class PaymentFormComponent {
  private api = inject(FinanceApiService);
  private router = inject(Router);
  i18n = inject(LocalizationService);
  revenue = signal<Revenue | null>(null);
  error = signal('');
  saving = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
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


