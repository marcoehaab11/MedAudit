import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { Category, Expense, FinanceApiService, Page } from './finance-api.service';
import { categoryTitle, localizeCategory, money } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-expenses-page',
  standalone: true,
  imports: [FormsModule, RouterLink, FinanceNavComponent, DatePipe],
  template: `
    <section class="page-head">
      <div>
        <p class="eyebrow" style="color: var(--muted); font-weight: 700; font-size: 0.85rem; margin: 0 0 0.25rem;">{{ t('Expenses & Operational Costs', 'المصروفات والتكاليف التشغيلية') }}</p>
        <h1>{{ t('Expenses', 'المصروفات') }}</h1>
      </div>
      <a class="button primary" routerLink="/finance/expenses/create">
        + {{ t('New expense', 'تسجيل مصروف جديد') }}
      </a>
    </section>

    <app-finance-nav />

    @if (loading()) {
      <div class="state">{{ t('Loading expenses…', 'جاري تحميل المصروفات…') }}</div>
    } @else {
      <section class="panel table-panel">
        <div class="table-responsive"><table class="finance-table">
          <thead>
            <tr>
              <th>{{ t('Date', 'التاريخ') }}</th>
              <th>{{ t('Category', 'التصنيف') }}</th>
              <th>{{ t('Description', 'الوصف / البيان') }}</th>
              <th>{{ t('Vendor / Beneficiary', 'المورد / الجهة المستفيدة') }}</th>
              <th>{{ t('Amount', 'المبلغ') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of data()?.items; track x.id) {
              <tr>
                <td>{{ x.expenseDate | date: 'dd/MM/yyyy' }}</td>
                <td><strong>{{ getCategoryName(x.categoryName) }}</strong></td>
                <td>{{ x.description }}</td>
                <td>{{ x.vendorName || '—' }}</td>
                <td class="amount-negative">{{ format(x.amount, x.currency) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
                  {{ t('No expenses recorded.', 'لا توجد مصروفات مسجلة.') }}
                </td>
              </tr>
            }
          </tbody>
        </table></div>
      </section>
    }
  `,
})
export class ExpensesPageComponent {
  private api = inject(FinanceApiService);
  i18n = inject(LocalizationService);
  data = signal<Page<Expense> | null>(null);
  loading = signal(true);

  constructor() {
    this.api.expenses({ page: 1 }).subscribe({
      next: (x) => {
        this.data.set(x);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

@Component({
  styleUrl: './finance.scss',
  selector: 'app-expense-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DateInputComponent],
  template: `
    <div class="finance-form-page">
      <a class="back-link" routerLink="/finance/expenses">
        ← {{ t('Back to expenses', 'العودة لقائمة المصروفات') }}
      </a>

      <section class="page-head">
        <div>
          <p class="eyebrow" style="color: var(--muted); font-weight: 700; font-size: 0.85rem; margin: 0 0 0.25rem;">{{ t('Expense Recording', 'تسجيل مدفوعات وتكاليف') }}</p>
          <h1>{{ t('Record New Expense', 'تسجيل مصروف جديد') }}</h1>
        </div>
      </section>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      <!-- Common Dental Expense Suggestions -->
      <div class="category-presets-box">
        <div class="presets-header">
          <span>⚡ {{ t('Quick Expense Presets', 'أمثلة ومصروفات شائعة للعيادة') }}</span>
          <small style="color: var(--muted);">{{ t('Click to autofill description & category', 'اضغط للاختيار السريع') }}</small>
        </div>
        <div class="presets-chips">
          @for (s of suggestions; track s.descAr) {
            <button
              type="button"
              class="chip-preset expense"
              (click)="applySuggestion(s)"
            >
              <span>💸</span>
              <span>{{ i18n.language() === 'ar' ? s.descAr : s.descEn }}</span>
            </button>
          }
        </div>
      </div>

      <form class="finance-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Expense Category', 'التصنيف المالي للمصروف') }} <strong class="req">*</strong></span>
            </label>
            <select class="form-input" formControlName="categoryId">
              <option value="">{{ t('Select category…', 'اختر التصنيف…') }}</option>
              @for (x of categories(); track x.id) {
                <option [value]="x.id">{{ getCategoryDisplayName(x) }}</option>
              }
            </select>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Amount', 'المبلغ') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" type="number" min="0.01" step="0.01" formControlName="amount" [placeholder]="t('0.00', '0.00')" />
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Date', 'التاريخ') }} <strong class="req">*</strong></span>
            </label>
            <app-date-input formControlName="expenseDate"></app-date-input>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Time', 'الوقت') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" type="time" formControlName="expenseTime" />
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Description / Details', 'بيان / وصف المصروف بالتفصيل') }} <strong class="req">*</strong></span>
            </label>
            <input class="form-input" formControlName="description" [placeholder]="t('e.g. Dental materials & filling supplies, Lab invoice…', 'مثال: مستلزمات حشو وعلاج جذور، فاتورة معمل تركيبات، إيجار العيادة…')" />
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Vendor / Supplier', 'المورد / الجهة المستلمة') }}</span>
            </label>
            <input class="form-input" formControlName="vendorName" [placeholder]="t('e.g. Dental Supply Co., Lab Center…', 'مثال: شركة توريدات الأسنان، معمل الأندلس…')" />
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Invoice / Reference #', 'رقم الفاتورة / المرجع') }}</span>
            </label>
            <input class="form-input" formControlName="reference" [placeholder]="t('e.g. INV-2026-001', 'مثال: INV-2026-001')" />
          </div>

          <div class="field-item wide">
            <label class="field-label">
              <span>{{ t('Notes', 'ملاحظات إضافية') }}</span>
            </label>
            <textarea class="form-textarea" rows="3" formControlName="notes" [placeholder]="t('Add any notes…', 'أضف أي ملاحظات أو تفاصيل…')"></textarea>
          </div>
        </div>

        <div class="form-actions">
          <a class="button btn-cancel" routerLink="/finance/expenses">{{ t('Cancel', 'إلغاء') }}</a>
          <button class="button primary btn-submit" [disabled]="form.invalid || saving()">
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Expense', 'حفظ وتسجيل المصروف') }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ExpenseFormComponent {
  private api = inject(FinanceApiService);
  private router = inject(Router);
  i18n = inject(LocalizationService);
  categories = signal<Category[]>([]);
  error = signal('');
  saving = signal(false);

  readonly suggestions = [
    { descAr: 'خامات ومستلزمات أسنان وحشو', descEn: 'Dental supplies & fillings', code: 'MATERIALS' },
    { descAr: 'فاتورة معامل وتركيبات أسنان', descEn: 'Dental Lab Prosthetics invoice', code: 'LAB' },
    { descAr: 'إيجار العيادة الشهري', descEn: 'Monthly Clinic Rent', code: 'RENT' },
    { descAr: 'رواتب التمريض والموظفين', descEn: 'Staff & Nursing salaries', code: 'SALARIES' },
    { descAr: 'فاتورة كهرباء ومرافق', descEn: 'Electricity & Utilities bill', code: 'ELECTRICITY' },
    { descAr: 'فاتورة مياه وغاز', descEn: 'Water & Gas bill', code: 'WATER' },
    { descAr: 'فاتورة الإنترنت والاتصالات', descEn: 'Internet & Communications bill', code: 'INTERNET' },
    { descAr: 'صيانة جهاز الأسنان ومعدات', descEn: 'Dental unit maintenance', code: 'MAINTENANCE' },
    { descAr: 'مستلزمات تعقيم ونظافة', descEn: 'Sterilization & sanitizers', code: 'STERILIZATION' },
    { descAr: 'حملة إعلانية وتسويق', descEn: 'Marketing & advertising', code: 'MARKETING' },
    { descAr: 'مصروفات نثرية وإدارية', descEn: 'Petty cash & administrative', code: 'ADMINISTRATIVE' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    categoryId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    description: ['', Validators.required],
    vendorName: '',
    reference: '',
    expenseDate: [new Date().toISOString().slice(0, 10), Validators.required],
    expenseTime: ['09:00', Validators.required],
    notes: '',
  });

  constructor() {
    this.api.categories(false, 2).subscribe((x) => this.categories.set(x));
  }

  getCategoryDisplayName(x: Category) {
    return localizeCategory(x, this.i18n.language());
  }

  applySuggestion(s: { descAr: string; descEn: string; code: string }) {
    const isAr = this.i18n.language() === 'ar';
    const currentCats = this.categories();
    const matched = currentCats.find(
      (c) => c.code.toUpperCase() === s.code.toUpperCase() ||
             c.name.toUpperCase().includes(s.code.toUpperCase())
    );
    this.form.patchValue({
      description: isAr ? s.descAr : s.descEn,
      categoryId: matched ? matched.id : this.form.controls.categoryId.value,
    });
  }

  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.api.createExpense(this.form.getRawValue()).subscribe({
      next: () => this.router.navigate(['/finance/expenses']),
      error: (e) => {
        this.error.set(
          e.status === 409
            ? this.t('The record changed.', 'تغير السجل.')
            : this.t('Expense could not be saved.', 'تعذر حفظ المصروف.'),
        );
        this.saving.set(false);
      },
    });
  }

  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}


