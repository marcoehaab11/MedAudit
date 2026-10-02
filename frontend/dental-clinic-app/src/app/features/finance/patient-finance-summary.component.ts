import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { FinanceApiService, PatientBalance, Payment, Revenue } from './finance-api.service';
import { money, paymentMethod } from './finance-ui';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-patient-finance-summary',
  standalone: true,
  imports: [CommonModule, RouterLink, DatePipe, ReactiveFormsModule, DateInputComponent],
  template: `
    @if (auth.hasPermission('Finance.View')) {
      <section class="panel patient-finance-panel">
        <div class="page-head">
          <div class="title-with-icon">
            <span class="head-icon">💳</span>
            <div>
              <h2>{{ t('Financial Summary & Payments', 'الملخص المالي وسجل التحصيل') }}</h2>
              <p class="head-sub">{{ t('Track treatment plan revenues, payments, and outstanding dues.', 'متابعة تكلفة خطط العلاج والمدفوعات والمبالغ المستحقة على المريض.') }}</p>
            </div>
          </div>

          <div class="head-actions">
            @if (auth.hasPermission('Finance.Payments.Create') && data() && data()!.outstanding > 0) {
              <button type="button" class="btn-record-payment" (click)="openPaymentModal()">
                + {{ t('Record Payment', 'تسجيل دفعة / تحصيل') }}
              </button>
            }
            <a class="btn-link-finance" [routerLink]="['/finance/revenue']" [queryParams]="{ patientId: patientId() }">
              {{ t('Full Finance Ledger', 'كشف الحساب التفصيلي') }} →
            </a>
          </div>
        </div>

        @if (loading()) {
          <div class="summary-loading">
            <p>{{ t('Loading financial ledger…', 'جارٍ تحميل البيانات المالية…') }}</p>
          </div>
        } @else if (data()) {
          <!-- Financial Metrics Grid -->
          <div class="metric-grid finance-metric-cards">
            <div class="metric-card revenue-card">
              <span class="m-label">{{ t('Total Treatment Cost', 'إجمالي تكلفة العلاج') }}</span>
              <strong class="m-value">{{ format(data()!.totalRevenue) }}</strong>
              <small class="m-sub">{{ t('Sum of treatment plans & services', 'مجموع خطط العلاج والخدمات') }}</small>
            </div>

            <div class="metric-card paid-card">
              <span class="m-label">{{ t('Total Paid', 'إجمالي المدفوع') }}</span>
              <strong class="m-value">{{ format(data()!.totalPaid) }}</strong>
              <small class="m-sub">{{ payments().length }} {{ t('payments recorded', 'سندات قبض مسجلة') }}</small>
            </div>

            <div class="metric-card outstanding-card" [class.has-debt]="data()!.outstanding > 0">
              <span class="m-label">{{ t('Outstanding Balance', 'المتبقي المستحق') }}</span>
              <strong class="m-value">{{ format(data()!.outstanding) }}</strong>
              <small class="m-sub">
                {{ data()!.outstanding > 0 ? t('Pending collection', 'مستحق التحصيل من المريض') : t('Fully settled', 'تم سداد الحساب بالكامل') }}
              </small>
            </div>
          </div>

          <!-- Payments History Ledger -->
          <div class="payments-ledger-section" style="margin-block-start: 1.5rem;">
            <div class="section-title-row">
              <h3>
                <span>🧾</span>
                {{ t('Payment History / Ledger', 'سجل المدفوعات والتحصيلات') }}
                @if (payments().length) {
                  <span class="count-badge">{{ payments().length }}</span>
                }
              </h3>

              @if (auth.hasPermission('Finance.Payments.Create')) {
                <button type="button" class="button primary sm" (click)="openPaymentModal()">
                  + {{ t('New Payment', 'سند قبض جديد') }}
                </button>
              }
            </div>

            @if (loadingPayments()) {
              <p class="ledger-loading">{{ t('Loading payment history…', 'جارٍ تحميل السجل…') }}</p>
            } @else if (payments().length === 0) {
              <div class="empty-payments-box">
                <p>{{ t('No payments recorded yet for this patient.', 'لا توجد سندات قبض أو مدفوعات مسجلة بعد لهذا المريض.') }}</p>
                @if (data()!.outstanding > 0 && auth.hasPermission('Finance.Payments.Create')) {
                  <button type="button" class="button primary sm" (click)="openPaymentModal()">
                    {{ t('Collect First Payment', 'تحصيل دفعة أولى') }}
                  </button>
                }
              </div>
            } @else {
              <div class="table-responsive">
                <table class="table payments-table">
                  <thead>
                    <tr>
                      <th>{{ t('Date & Time', 'التاريخ والوقت') }}</th>
                      <th>{{ t('Amount', 'المبلغ') }}</th>
                      <th>{{ t('Method', 'طريقة الدفع') }}</th>
                      <th>{{ t('Receipt / Reference', 'رقم الإيصال / المرجع') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of payments(); track p.id) {
                      <tr>
                        <td>
                          <strong>{{ p.paidAt | date: 'dd/MM/yyyy' }}</strong>
                          <small class="text-muted">{{ p.paidAt | date: 'hh:mm a' }}</small>
                        </td>
                        <td>
                          <strong class="paid-amount-tag">+ {{ format(p.amount) }}</strong>
                        </td>
                        <td>
                          <span class="badge method-badge method-{{ p.paymentMethod }}">
                            {{ getMethodName(p.paymentMethod) }}
                          </span>
                        </td>
                        <td>
                          <span class="ref-code">{{ p.reference || '—' }}</span>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }

        <!-- Record Payment Modal Dialog -->
        @if (showPaymentModal()) {
          <div class="modal-backdrop" (click)="closePaymentModal()">
            <div class="modal-card modal-payment-card" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <div class="header-title-wrap">
                  <span class="modal-badge-icon">💵</span>
                  <div>
                    <h3>{{ t('Record Payment Receipt', 'تسجيل سند قبض / دفعة نقدية') }}</h3>
                    <p class="modal-sub">{{ t('Collect payment from patient towards treatment plan balance.', 'تحصيل دفعة من المريض وتخفيض الرصيد المستحق.') }}</p>
                  </div>
                </div>
                <button type="button" class="btn-close" (click)="closePaymentModal()">✕</button>
              </div>

              @if (modalError()) {
                <div class="alert-box-modern error" style="margin: 0.75rem 1.25rem 0;">
                  <span class="alert-icon">⚠️</span>
                  <div class="alert-content">
                    <p>{{ modalError() }}</p>
                  </div>
                </div>
              }

              <form class="modal-body-form" [formGroup]="paymentForm" (ngSubmit)="submitPayment()">
                <div class="field-item">
                  <label class="field-label">
                    <span>{{ t('Payment For (Treatment / Service)', 'دفعة لحساب (خطة علاج / خدمة)') }}</span>
                    <select class="form-input select-styled" formControlName="revenueId" (change)="onRevenueChange()">
                      <option value="">{{ t('General Payment (Total Balance)', 'دفعة عامة (الرصيد الإجمالي)') }}</option>
                      @for (r of unpaidRevenues(); track r.id) {
                        <option [value]="r.id">
                          {{ r.treatmentName || r.categoryName || t('Other Revenue', 'إيراد آخر') }} ({{ t('Outstanding: ', 'المتبقي: ') }} {{ format(r.outstanding) }})
                        </option>
                      }
                    </select>
                  </label>
                </div>

                <div class="form-grid-2">
                  <div class="field-item">
                    <label class="field-label">
                      <span>{{ t('Amount (EGP)', 'المبلغ المحصل (ج.م)') }} <strong class="req">*</strong></span>
                      <input
                        class="form-input text-lg font-bold"
                        type="number"
                        min="1"
                        step="0.01"
                        formControlName="amount"
                        [class.invalid]="paymentForm.controls.amount.touched && paymentForm.controls.amount.invalid"
                      />
                    </label>
                  </div>

                  <div class="field-item">
                    <label class="field-label">
                      <span>{{ t('Payment Method', 'طريقة الدفع') }} <strong class="req">*</strong></span>
                      <select class="form-input select-styled" formControlName="paymentMethod">
                        <option [ngValue]="1">{{ t('Cash', 'نقدي (كاش)') }}</option>
                        <option [ngValue]="2">{{ t('Card / Visa', 'بطاقة بنكية / فيزا') }}</option>
                        <option [ngValue]="3">{{ t('Bank Transfer / InstaPay', 'تحويل بنكي / إنستاباي') }}</option>
                        <option [ngValue]="4">{{ t('Other / E-Wallet', 'محفظة إلكترونية / أخرى') }}</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div class="form-grid-2">
                  <div class="field-item">
                    <label class="field-label">
                      <span>{{ t('Payment Date', 'تاريخ التحصيل') }} <strong class="req">*</strong></span>
                      <app-date-input formControlName="paidDate"></app-date-input>
                    </label>
                  </div>

                  <div class="field-item">
                    <label class="field-label">
                      <span>{{ t('Receipt / Reference No.', 'رقم الإيصال / المرجع') }}</span>
                      <input
                        class="form-input"
                        formControlName="reference"
                        [placeholder]="t('e.g. REC-2026-001', 'مثال: REC-2026-001')"
                      />
                    </label>
                  </div>
                </div>

                <div class="field-item">
                  <label class="field-label">
                    <span>{{ t('Notes', 'ملاحظات التحصيل') }}</span>
                    <textarea
                      class="form-textarea"
                      rows="2"
                      formControlName="notes"
                      [placeholder]="t('Optional remarks or installment details…', 'ملاحظات إضافية أو تفاصيل القسط…')"
                    ></textarea>
                  </label>
                </div>

                <div class="modal-footer-actions">
                  <button type="button" class="button btn-cancel" (click)="closePaymentModal()">
                    {{ t('Cancel', 'إلغاء') }}
                  </button>
                  <button type="submit" class="button primary btn-save" [disabled]="savingPayment()">
                    {{ savingPayment() ? t('Recording…', 'جارٍ التسجيل…') : t('Confirm & Save Payment', 'تأكيد وحفظ الدفعة') }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        }
      </section>
    }
  `,
})
export class PatientFinanceSummaryComponent {
  private readonly api = inject(FinanceApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly fb = inject(FormBuilder);

  patientId = input.required<string>();
  data = signal<PatientBalance | null>(null);
  payments = signal<Payment[]>([]);
  loading = signal(true);
  loadingPayments = signal(true);

  unpaidRevenues = signal<Revenue[]>([]);

  // Modal State
  showPaymentModal = signal(false);
  savingPayment = signal(false);
  modalError = signal('');

  readonly paymentForm = this.fb.nonNullable.group({
    revenueId: [''],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    paymentMethod: [1, Validators.required],
    paidDate: [new Date().toISOString().substring(0, 10), Validators.required],
    paidTime: [new Date().toTimeString().substring(0, 5)],
    reference: '',
    notes: '',
  });

  ngOnInit() {
    this.refreshAll();
  }

  refreshAll() {
    if (this.auth.hasPermission('Finance.View')) {
      this.api.patientBalance(this.patientId()).subscribe({
        next: (x) => {
          this.data.set(x);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });

      this.loadingPayments.set(true);
      this.api.payments({ patientId: this.patientId(), pageSize: 20 }).subscribe({
        next: (res) => {
          this.payments.set(res.items ?? []);
          this.loadingPayments.set(false);
        },
        error: () => {
          this.payments.set([]);
          this.loadingPayments.set(false);
        },
      });

      this.api.revenues({ patientId: this.patientId(), pageSize: 50 }).subscribe({
        next: (res) => {
          this.unpaidRevenues.set((res.items ?? []).filter(x => x.outstanding > 0));
        }
      });
    }
  }

  onRevenueChange() {
    const revId = this.paymentForm.controls.revenueId.value;
    const rev = this.unpaidRevenues().find(x => x.id === revId);
    if (rev) {
      this.paymentForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(rev.outstanding)]);
      this.paymentForm.controls.amount.setValue(rev.outstanding);
    } else {
      const outstanding = this.data()?.outstanding ?? 0;
      this.paymentForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(outstanding > 0 ? outstanding : 9999999)]);
      this.paymentForm.controls.amount.setValue(outstanding > 0 ? outstanding : 0);
    }
    this.paymentForm.controls.amount.updateValueAndValidity();
  }

  openPaymentModal() {
    const revenues = this.unpaidRevenues();
    const revId = revenues.length === 1 ? revenues[0].id : '';
    const amt = revenues.length === 1 ? revenues[0].outstanding : (this.data()?.outstanding ?? 0);
    
    this.paymentForm.patchValue({
      revenueId: revId,
      amount: amt > 0 ? amt : 0,
      paymentMethod: 1,
      paidDate: new Date().toISOString().substring(0, 10),
      paidTime: new Date().toTimeString().substring(0, 5),
      reference: '',
      notes: '',
    });
    
    if (revenues.length === 1) {
      this.paymentForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(amt)]);
    } else {
      const maxAmt = (this.data()?.outstanding ?? 0) > 0 ? this.data()!.outstanding : 9999999;
      this.paymentForm.controls.amount.setValidators([Validators.required, Validators.min(0.01), Validators.max(maxAmt)]);
    }
    this.paymentForm.controls.amount.updateValueAndValidity();
    
    this.modalError.set('');
    this.showPaymentModal.set(true);
  }

  closePaymentModal() {
    this.showPaymentModal.set(false);
  }

  async submitPayment() {
    this.paymentForm.markAllAsTouched();
    if (this.paymentForm.invalid) return;

    this.savingPayment.set(true);
    this.modalError.set('');

    const v = this.paymentForm.getRawValue();
    let amountToPay = Number(v.amount);
    
    // Check total outstanding first
    const totalOut = this.data()?.outstanding || 0;
    if (amountToPay <= 0 || amountToPay > totalOut) {
      this.savingPayment.set(false);
      this.modalError.set(
        this.t(
          'Payment amount cannot exceed the total outstanding balance.',
          'لا يمكن أن يتجاوز مبلغ الدفع إجمالي الرصيد المستحق.'
        )
      );
      return;
    }

    try {
      const { firstValueFrom } = await import('rxjs');

      if (v.revenueId) {
        // Single revenue payment
        const payload = {
          revenueId: v.revenueId,
          patientId: this.patientId(),
          treatmentId: this.unpaidRevenues().find(x => x.id === v.revenueId)?.treatmentId,
          amount: amountToPay,
          paymentMethod: Number(v.paymentMethod),
          paidDate: v.paidDate,
          paidTime: v.paidTime || '12:00',
          reference: v.reference || undefined,
          notes: v.notes || undefined,
        };
        await firstValueFrom(this.api.createPayment(payload));
      } else {
        // General payment: distribute over all unpaid revenues
        for (const r of this.unpaidRevenues()) {
          if (amountToPay <= 0) break;
          
          const payForThis = Math.min(amountToPay, r.outstanding);
          
          const payload = {
            revenueId: r.id,
            patientId: this.patientId(),
            treatmentId: r.treatmentId,
            amount: payForThis,
            paymentMethod: Number(v.paymentMethod),
            paidDate: v.paidDate,
            paidTime: v.paidTime || '12:00',
            reference: v.reference || undefined,
            notes: v.notes || undefined,
          };
          
          await firstValueFrom(this.api.createPayment(payload));
          amountToPay -= payForThis;
        }
      }

      this.savingPayment.set(false);
      this.closePaymentModal();
      this.refreshAll();
    } catch (err) {
      this.savingPayment.set(false);
      this.modalError.set(
        parseApiError(
          err,
          this.t(
            'Payment could not be recorded. Verify the amount does not exceed the outstanding balance.',
            'تعذر تسجيل الدفعة. تأكد من أن المبلغ لا يتجاوز الرصيد المستحق.'
          ),
        ),
      );
    }
  }

  getMethodName(method: number): string {
    return paymentMethod(method, this.i18n.language() === 'ar');
  }

  format(v: number) {
    return money(v, this.data()?.currency ?? 'EGP', this.i18n.language());
  }

  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}

