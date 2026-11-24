
import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of, Subject, switchMap } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { Category, DueExpense, Expense, FinanceApiService, FixedExpenseSchedule, Page } from './finance-api.service';
import { categoryTitle, localizeCategory, money } from './finance-ui';
import { FinanceNavComponent } from './finance-nav.component';

@Component({
  selector: 'app-expenses-page',
  imports: [RouterLink, FinanceNavComponent, DatePipe, ReactiveFormsModule],
  templateUrl: './expenses-page.component.html',
  styleUrl: './expenses-page.component.scss',
  host: { '(window:focus)': 'refreshOnFocus()' },
})
export class ExpensesPageComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(FinanceApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('fixedDialog');
  private readonly reload = new Subject<void>();
  private readonly loadFixed = new Subject<void>();

  protected readonly paid = signal<Page<Expense> | null>(null);
  protected readonly due = signal<Page<DueExpense> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly schedules = signal<FixedExpenseSchedule[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly loadingFixed = signal(false);
  protected readonly fixedLoadError = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly saved = signal(false);
  protected paidPage = 1;
  protected duePage = 1;
  protected readonly fixedForm = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(500)]],
    categoryId: ['', Validators.required],
    beneficiary: ['', [Validators.required, Validators.maxLength(200)]],
    monthlyAmount: [0, [Validators.required, Validators.min(0.01)]],
    dueDay: [1, [Validators.required, Validators.min(1), Validators.max(31)]],
    startsOn: ['', Validators.required],
  });

  constructor() {
    this.reload.pipe(
      switchMap(() => this.api.expenseLedger(this.paidPage, this.duePage).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(result => {
      if (result && (this.paidPage > Math.max(1, result.paid.totalPages) ||
                     this.duePage > Math.max(1, result.due.totalPages))) {
        this.paidPage = Math.min(this.paidPage, Math.max(1, result.paid.totalPages));
        this.duePage = Math.min(this.duePage, Math.max(1, result.due.totalPages));
        this.loadExpenses();
        return;
      }
      this.paid.set(result?.paid ?? null);
      this.due.set(result?.due ?? null);
      this.loadError.set(!result);
      this.loading.set(false);
    });
    this.loadFixed.pipe(
      switchMap(() => forkJoin({
        schedules: this.api.fixedExpenses(),
        categories: this.api.categories(false, 2),
      }).pipe(catchError(() => of(null)))),
      takeUntilDestroyed(),
    ).subscribe(result => {
      this.schedules.set(result?.schedules ?? []);
      this.categories.set(result?.categories ?? []);
      this.fixedLoadError.set(!result);
      this.loadingFixed.set(false);
    });
    this.loadExpenses();
  }

  protected loadExpenses() {
    this.loading.set(true);
    this.loadError.set(false);
    this.reload.next();
  }

  protected refreshOnFocus() {
    if (!this.loading() && !this.loadError() && !this.dialog().nativeElement.open) this.reload.next();
  }

  protected changePage(kind: 'paid' | 'due', page: number) {
    if (kind === 'paid') this.paidPage = page;
    else this.duePage = page;
    this.loadExpenses();
  }

  protected openFixed() {
    this.saveError.set('');
    this.saved.set(false);
    this.refreshFixed();
    this.dialog().nativeElement.showModal();
  }

  protected refreshFixed() {
    this.loadingFixed.set(true);
    this.fixedLoadError.set(false);
    this.loadFixed.next();
  }

  protected saveFixed() {
    if (this.fixedForm.invalid || this.saving()) return;
    this.saving.set(true);
    this.saved.set(false);
    this.saveError.set('');
    const input = this.fixedForm.getRawValue();
    this.api.createFixedExpense({ ...input, name: input.name.trim(), beneficiary: input.beneficiary.trim() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        this.fixedForm.reset();
        this.duePage = 1;
        this.refreshFixed();
        this.loadExpenses();
      },
      error: (error) => {
        this.saving.set(false);
        this.saveError.set(error.status === 409
          ? this.t('A fixed expense already uses this name.', 'يوجد مصروف ثابت بهذا الاسم.')
          : this.t('Could not save the fixed expense. Check the fields and try again.', 'تعذر حفظ المصروف الثابت. راجع البيانات وحاول مرة أخرى.'));
      },
    });
  }

  protected category(name: string) { return categoryTitle(name, this.i18n.language()); }
  protected categoryOption(item: Category) { return localizeCategory(item, this.i18n.language()); }
  protected format(amount: number, currency: string) { return money(amount, currency, this.i18n.language()); }
  protected number(value: number) { return value.toLocaleString(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-US'); }
  protected t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
}
