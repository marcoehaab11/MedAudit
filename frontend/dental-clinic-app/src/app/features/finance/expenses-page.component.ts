import { Component, inject, signal } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { Category, Expense, FinanceApiService, Page } from './finance-api.service';
import { money } from './finance-ui';
import { FinanceNavComponent } from './finance-dashboard.component';
@Component({
  selector: 'app-expenses-page',
  imports: [FormsModule, RouterLink, FinanceNavComponent],
  template: `<section class="page-head">
      <h1>{{ t('Expenses', 'المصروفات') }}</h1>
      <a class="button primary" routerLink="/finance/expenses/create">{{
        t('New expense', 'مصروف جديد')
      }}</a>
    </section>
    <app-finance-nav />
    @if (loading()) {
      <div class="state">{{ t('Loading…', 'جاري التحميل…') }}</div>
    } @else {
      <section class="panel">
        <table class="finance-table">
          <thead>
            <tr>
              <th>{{ t('Date', 'التاريخ') }}</th>
              <th>{{ t('Category', 'التصنيف') }}</th>
              <th>{{ t('Description', 'الوصف') }}</th>
              <th>{{ t('Vendor', 'المورد') }}</th>
              <th>{{ t('Amount', 'المبلغ') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of data()?.items; track x.id) {
              <tr>
                <td>{{ x.expenseDate.slice(0, 10) }}</td>
                <td>{{ x.categoryName }}</td>
                <td>{{ x.description }}</td>
                <td>{{ x.vendorName || '—' }}</td>
                <td>{{ format(x.amount, x.currency) }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="5">{{ t('No expenses found.', 'لا توجد مصروفات.') }}</td>
              </tr>
            }
          </tbody>
        </table>
      </section>
    }`,
  styleUrl: './finance.scss',
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
  format(v: number, c: string) {
    return money(v, c, this.i18n.language());
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
@Component({
  selector: 'app-expense-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: `<a routerLink="/finance/expenses">{{ t('Back to expenses', 'العودة للمصروفات') }}</a>
    <section class="page-head">
      <h1>{{ t('New expense', 'مصروف جديد') }}</h1>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <form class="panel finance-form" [formGroup]="form" (ngSubmit)="save()">
      <label
        >{{ t('Category', 'التصنيف')
        }}<select formControlName="categoryId">
          <option value="">—</option>
          @for (x of categories(); track x.id) {
            <option [value]="x.id">{{ x.name }}</option>
          }
        </select></label
      ><label
        >{{ t('Amount', 'المبلغ')
        }}<input type="number" min="0.01" step="0.01" formControlName="amount" /></label
      ><label>{{ t('Date', 'التاريخ') }}<input type="date" formControlName="expenseDate" /></label
      ><label>{{ t('Time', 'الوقت') }}<input type="time" formControlName="expenseTime" /></label
      ><label class="wide"
        >{{ t('Description', 'الوصف') }}<input formControlName="description" /></label
      ><label>{{ t('Vendor', 'المورد') }}<input formControlName="vendorName" /></label
      ><label>{{ t('Reference', 'المرجع') }}<input formControlName="reference" /></label
      ><label class="wide"
        >{{ t('Notes', 'ملاحظات') }}<textarea formControlName="notes"></textarea></label
      ><button class="primary" [disabled]="form.invalid || saving()">
        {{ t('Save expense', 'حفظ المصروف') }}
      </button>
    </form>`,
  styleUrl: './finance.scss',
})
export class ExpenseFormComponent {
  private api = inject(FinanceApiService);
  private router = inject(Router);
  i18n = inject(LocalizationService);
  categories = signal<Category[]>([]);
  error = signal('');
  saving = signal(false);
  form = inject(FormBuilder).nonNullable.group({
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
