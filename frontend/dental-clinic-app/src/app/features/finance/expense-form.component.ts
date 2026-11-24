import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { Category, DueExpense, FinanceApiService } from './finance-api.service';
import { categoryTitle, localizeCategory, money } from './finance-ui';
import { FinanceNavComponent } from './finance-nav.component';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-expense-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DateInputComponent, FinanceNavComponent],
  template: `
    <app-finance-nav />
    <div class="finance-form-page">
      <a class="back-link" routerLink="/finance/expenses">
        ← {{ t('Back to expenses', 'العودة لقائمة المصروفات') }}
      </a>

      <section class="page-head">
        <div>

          <h1>{{ fixedDueId ? t('Record expense payment', 'تسجيل سداد مصروف') : t('Record New Expense', 'تسجيل مصروف جديد') }}</h1>
        </div>
      </section>

      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      @if (!fixedDueId) {
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
      }

      @if (loadingDue()) {
        <p class="state" role="status">{{ t('Loading the outstanding expense…', 'جاري تحميل المصروف المستحق…') }}</p>
      } @else if (!fixedDueId || fixedDue()) {
      <form class="finance-form" [formGroup]="form" (ngSubmit)="save()">
        <div class="form-grid">
          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Expense Category', 'التصنيف المالي للمصروف') }} <strong class="req">*</strong></span>
            </label>
            <select class="form-input" formControlName="categoryId">
              <option value="">{{ t('Select category…', 'اختر التصنيف…') }}</option>
              @if (fixedDue(); as due) {
                <option [value]="due.categoryId">{{ categoryTitle(due.categoryName, i18n.language()) }}</option>
              } @else {
                @for (x of categories(); track x.id) {
                  <option [value]="x.id">{{ getCategoryDisplayName(x) }}</option>
                }
              }
            </select>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Amount', 'المبلغ') }} <strong class="req">*</strong></span>
            </label>
            @if (fixedDue(); as due) {
              <bdi>{{ money(due.amount, due.currency, i18n.language()) }}</bdi>
            } @else {
              <input class="form-input" type="number" min="0.01" step="0.01" formControlName="amount" [placeholder]="t('0.00', '0.00')" />
            }
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
            {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : fixedDueId ? t('Record payment', 'تسجيل السداد') : t('Save Expense', 'حفظ وتسجيل المصروف') }}
          </button>
        </div>
      </form>
      }
    </div>
  `,
})
export class ExpenseFormComponent {
  private api = inject(FinanceApiService);
  private router = inject(Router);
  i18n = inject(LocalizationService);
  readonly fixedDueId = inject(ActivatedRoute).snapshot.queryParamMap.get('fixedDueId');
  readonly fixedDue = signal<DueExpense | null>(null);
  readonly loadingDue = signal(false);
  readonly money = money;
  readonly categoryTitle = categoryTitle;
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
    if (!this.fixedDueId) {
      this.api.categories(false, 2).subscribe((x) => this.categories.set(x));
      return;
    }
    this.loadingDue.set(true);
    this.api.fixedDueExpense(this.fixedDueId).subscribe({
      next: (due) => {
        this.fixedDue.set(due);
        this.form.patchValue({ categoryId: due.categoryId ?? '', amount: due.amount, description: due.description, vendorName: due.vendorName ?? '' });
        this.form.controls.categoryId.disable();
        this.form.controls.amount.disable();
        this.form.controls.description.disable();
        this.form.controls.vendorName.disable();
        this.loadingDue.set(false);
      },
      error: () => {
        this.error.set(this.t('This outstanding expense could not be loaded.', 'تعذر تحميل المصروف المستحق.'));
        this.loadingDue.set(false);
      },
    });
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
    if (this.form.invalid || this.saving() || (this.fixedDueId && !this.fixedDue())) return;
    this.saving.set(true);
    this.api.createExpense({ ...this.form.getRawValue(), fixedDueId: this.fixedDueId }).subscribe({
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
