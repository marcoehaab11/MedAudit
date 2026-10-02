import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { Category, FinanceApiService } from './finance-api.service';
import { FinanceNavComponent } from './finance-dashboard.component';
import { FINANCIAL_CATEGORY_PRESETS, CategoryPreset, localizeCategory } from './finance-ui';

@Component({
  styleUrl: './finance.scss',
  selector: 'app-categories-page',
  standalone: true,
  imports: [ReactiveFormsModule, FinanceNavComponent],
  template: `
    <section class="page-head">
      <div>
        <p class="eyebrow" style="color: var(--muted); font-weight: 700; font-size: 0.85rem; margin: 0 0 0.25rem;">{{ t('Financial Structure', 'الهيكل المالي للعيادة') }}</p>
        <h1>{{ t('Financial Categories', 'التصنيفات المالية') }}</h1>
      </div>
    </section>

    <app-finance-nav />

    @if (message()) {
      <div class="alert success" role="status">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }

    <!-- Quick Presets for Expense / Revenue Categories -->
    <div class="category-presets-box">
      <div class="presets-header">
        <span>💡 {{ t('Quick Presets for Dental Clinics (Expenses & Revenues)', 'تصنيفات مقترحة جاهزة للعيادة (المصروفات والتكاليف والإيرادات)') }}</span>
        <small style="color: var(--muted);">{{ t('Click any category to auto-fill the form', 'اضغط على أي تصنيف لتعبئة النموذج تلقائياً') }}</small>
      </div>
      <div class="presets-chips">
        @for (p of presets; track p.code) {
          <button
            type="button"
            class="chip-preset"
            [class.expense]="p.type === 2"
            (click)="applyPreset(p)"
            [title]="p.type === 2 ? t('Expense Category', 'تصنيف مصروف / تكلفة') : t('Revenue Category', 'تصنيف إيراد')"
          >
            <span>{{ p.type === 2 ? '💸' : '💰' }}</span>
            <span>{{ i18n.language() === 'ar' ? p.nameAr : p.nameEn }}</span>
            <code style="font-size: 0.72rem; opacity: 0.75;">{{ p.code }}</code>
          </button>
        }
      </div>
    </div>

    <form class="panel finance-form" [formGroup]="form" (ngSubmit)="save()">
      <div class="form-grid">
        <div class="field-item">
          <label class="field-label">
            <span>{{ t('Category Name', 'اسم التصنيف') }} <strong class="req">*</strong></span>
          </label>
          <input class="form-input" formControlName="name" [placeholder]="t('e.g. Dental Materials, Staff Salaries, Clinic Rent…', 'مثال: خامات ومستلزمات طبية، معامل وتركيبات، إيجار العيادة…')" />
        </div>

        <div class="field-item">
          <label class="field-label">
            <span>{{ t('Category Code', 'رمز التصنيف') }} <strong class="req">*</strong></span>
          </label>
          <input class="form-input" formControlName="code" [placeholder]="t('e.g. MATERIALS, LAB, RENT', 'مثال: MATERIALS, LAB, RENT')" />
        </div>

        <div class="field-item">
          <label class="field-label">
            <span>{{ t('Type', 'نوع التصنيف') }} <strong class="req">*</strong></span>
          </label>
          <select class="form-input" formControlName="type">
            <option [value]="2">{{ t('Expense / Cost (Things that need money)', 'مصروف / تكلفة (الحاجات اللي عايزة فلوس)') }}</option>
            <option [value]="1">{{ t('Revenue (Income / Clinic earnings)', 'إيراد (الدخل ومتحصلات العيادة)') }}</option>
          </select>
        </div>

        <div class="field-item">
          <label class="field-label">
            <span>{{ t('Parent Category (Optional)', 'التصنيف الرئيسي (اختياري)') }}</span>
          </label>
          <select class="form-input" formControlName="parentId">
            <option value="">{{ t('None (Top-level)', 'بدون (تصنيف رئيسي مستقل)') }}</option>
            @for (x of possibleParents(); track x.id) {
              <option [value]="x.id">{{ displayName(x) }}</option>
            }
          </select>
        </div>
      </div>

      <div class="form-actions">
        @if (editing()) {
          <button type="button" class="button btn-cancel" (click)="reset()">{{ t('Cancel', 'إلغاء') }}</button>
        }
        <button class="button primary btn-submit" [disabled]="form.invalid">
          {{ editing() ? t('Update Category', 'تحديث التصنيف') : t('Create Category', 'إضافة وحفظ التصنيف') }}
        </button>
      </div>
    </form>

    <div class="type-filter-group">
      <button type="button" [class.active]="selectedTypeFilter() === 'ALL'" (click)="selectedTypeFilter.set('ALL')">
        {{ t('All Categories', 'جميع التصنيفات') }} ({{ items().length }})
      </button>
      <button type="button" [class.active]="selectedTypeFilter() === 'EXPENSE'" (click)="selectedTypeFilter.set('EXPENSE')">
        💸 {{ t('Expenses & Costs (Money out)', 'المصروفات والتكاليف') }} ({{ expenseCount() }})
      </button>
      <button type="button" [class.active]="selectedTypeFilter() === 'REVENUE'" (click)="selectedTypeFilter.set('REVENUE')">
        💰 {{ t('Revenue & Income (Money in)', 'الإيرادات والدخل') }} ({{ revenueCount() }})
      </button>
    </div>

    <section class="panel table-panel">
      <div class="table-responsive"><table class="finance-table">
        <thead>
          <tr>
            <th>{{ t('Name', 'الاسم') }}</th>
            <th>{{ t('Code', 'الرمز') }}</th>
            <th>{{ t('Type', 'النوع') }}</th>
            <th>{{ t('Status', 'الحالة') }}</th>
            <th style="text-align: end;">{{ t('Actions', 'الإجراءات') }}</th>
          </tr>
        </thead>
        <tbody>
          @for (x of filteredItems(); track x.id) {
            <tr>
              <td>
                <strong>{{ displayName(x) }}</strong>
                @if (i18n.language() === 'ar' && x.name !== displayName(x)) {
                  <small style="color: var(--muted); margin-inline-start: 0.5rem;">({{ x.name }})</small>
                }
              </td>
              <td><code>{{ x.code }}</code></td>
              <td>
                <span class="badge" [class.status-1]="x.type === 1" [class.status-2]="x.type === 2">
                  {{ x.type === 1 ? t('Revenue', 'إيراد') : t('Expense', 'مصروف') }}
                </span>
              </td>
              <td>
                <span class="badge" [class.status-1]="x.isActive" [class.status-0]="!x.isActive">
                  {{ x.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط') }}
                </span>
              </td>
              <td style="text-align: end;">
                <div class="finance-actions" style="justify-content: flex-end;">
                  <button type="button" class="button sm" (click)="edit(x)">✏️ {{ t('Edit', 'تعديل') }}</button>
                  <button
                    type="button"
                    class="button sm"
                    [class.danger]="x.isActive"
                    (click)="status(x)"
                  >
                    {{ x.isActive ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل') }}
                  </button>
                </div>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5" style="text-align: center; padding: 3rem 1rem; color: var(--muted);">
                {{ t('No categories found for the selected filter.', 'لا توجد تصنيفات معرفة مطابقة.') }}
              </td>
            </tr>
          }
        </tbody>
      </table></div>
    </section>
  `,
})
export class CategoriesPageComponent {
  private api = inject(FinanceApiService);
  i18n = inject(LocalizationService);
  items = signal<Category[]>([]);
  editing = signal<Category | null>(null);
  error = signal('');
  message = signal('');
  selectedTypeFilter = signal<'ALL' | 'EXPENSE' | 'REVENUE'>('ALL');
  readonly presets = FINANCIAL_CATEGORY_PRESETS;

  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    type: [2, Validators.required],
    parentId: '',
  });

  constructor() {
    this.load();
  }

  load() {
    this.api.categories(true).subscribe({
      next: (x) => this.items.set(x),
      error: () =>
        this.error.set(this.t('Categories could not be loaded.', 'تعذر تحميل التصنيفات.')),
    });
  }

  displayName(x: Category) {
    return localizeCategory(x, this.i18n.language());
  }

  expenseCount() {
    return this.items().filter((x) => x.type === 2).length;
  }

  revenueCount() {
    return this.items().filter((x) => x.type === 1).length;
  }

  filteredItems() {
    const filter = this.selectedTypeFilter();
    if (filter === 'EXPENSE') return this.items().filter((x) => x.type === 2);
    if (filter === 'REVENUE') return this.items().filter((x) => x.type === 1);
    return this.items();
  }

  possibleParents() {
    return this.items().filter(
      (x) => x.type === +this.form.controls.type.value && x.id !== this.editing()?.id,
    );
  }

  applyPreset(p: CategoryPreset) {
    const isAr = this.i18n.language() === 'ar';
    this.form.patchValue({
      name: isAr ? p.nameAr : p.nameEn,
      code: p.code,
      type: p.type,
      parentId: '',
    });
  }

  edit(x: Category) {
    this.editing.set(x);
    this.form.setValue({ name: x.name, code: x.code, type: x.type, parentId: x.parentId || '' });
  }

  reset() {
    this.editing.set(null);
    this.form.reset({ name: '', code: '', type: 2, parentId: '' });
  }

  save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const value = { ...v, type: +v.type, parentId: v.parentId || undefined };
    const request: Observable<unknown> = this.editing()
      ? this.api.updateCategory(this.editing()!, value)
      : this.api.createCategory(value);
    request.subscribe({
      next: () => {
        this.message.set(this.t('Category saved successfully.', 'تم حفظ التصنيف بنجاح.'));
        this.reset();
        this.load();
      },
      error: (e: any) =>
        this.error.set(
          e.status === 409
            ? this.t(
                'Code is already used or the category changed.',
                'الرمز مستخدم بالفعل أو تم تغيير التصنيف.',
              )
            : this.t('Category could not be saved.', 'تعذر حفظ التصنيف.'),
        ),
    });
  }

  status(x: Category) {
    if (!confirm(this.t('Change category status?', 'تغيير حالة التصنيف؟'))) return;
    this.api.categoryStatus(x, !x.isActive).subscribe({
      next: () => this.load(),
      error: (e) =>
        this.error.set(
          e.status === 409
            ? this.t('Referenced categories cannot be deactivated.', 'لا يمكن تعطيل تصنيف مستخدم في قيود سابقة.')
            : this.t('Status change failed.', 'فشل تغيير الحالة.'),
        ),
    });
  }

  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}


