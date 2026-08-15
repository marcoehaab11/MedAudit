import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { Category, FinanceApiService } from './finance-api.service';
import { FinanceNavComponent } from './finance-dashboard.component';
@Component({
  selector: 'app-categories-page',
  imports: [ReactiveFormsModule, FinanceNavComponent],
  template: `<section class="page-head">
      <h1>{{ t('Financial categories', 'التصنيفات المالية') }}</h1>
    </section>
    <app-finance-nav />
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <form class="panel finance-form" [formGroup]="form" (ngSubmit)="save()">
      <label>{{ t('Name', 'الاسم') }}<input formControlName="name" /></label
      ><label>{{ t('Code', 'الرمز') }}<input formControlName="code" /></label
      ><label
        >{{ t('Type', 'النوع')
        }}<select formControlName="type">
          <option [value]="1">{{ t('Revenue', 'إيراد') }}</option>
          <option [value]="2">{{ t('Expense', 'مصروف') }}</option>
        </select></label
      ><label
        >{{ t('Parent', 'الأصل')
        }}<select formControlName="parentId">
          <option value="">—</option>
          @for (x of possibleParents(); track x.id) {
            <option [value]="x.id">{{ x.name }}</option>
          }
        </select></label
      ><button class="primary" [disabled]="form.invalid">
        {{ editing() ? t('Update', 'تحديث') : t('Create', 'إنشاء') }}
      </button>
      @if (editing()) {
        <button type="button" (click)="reset()">{{ t('Cancel', 'إلغاء') }}</button>
      }
    </form>
    <section class="panel">
      <table class="finance-table">
        <thead>
          <tr>
            <th>{{ t('Name', 'الاسم') }}</th>
            <th>{{ t('Code', 'الرمز') }}</th>
            <th>{{ t('Type', 'النوع') }}</th>
            <th>{{ t('Status', 'الحالة') }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (x of items(); track x.id) {
            <tr>
              <td>{{ x.name }}</td>
              <td>{{ x.code }}</td>
              <td>{{ x.type === 1 ? t('Revenue', 'إيراد') : t('Expense', 'مصروف') }}</td>
              <td>{{ x.isActive ? t('Active', 'نشط') : t('Inactive', 'غير نشط') }}</td>
              <td class="finance-actions">
                <button (click)="edit(x)">{{ t('Edit', 'تعديل') }}</button
                ><button (click)="status(x)">
                  {{ x.isActive ? t('Deactivate', 'تعطيل') : t('Activate', 'تفعيل') }}
                </button>
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">{{ t('No categories.', 'لا توجد تصنيفات.') }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>`,
  styleUrl: './finance.scss',
})
export class CategoriesPageComponent {
  private api = inject(FinanceApiService);
  i18n = inject(LocalizationService);
  items = signal<Category[]>([]);
  editing = signal<Category | null>(null);
  error = signal('');
  message = signal('');
  form = inject(FormBuilder).nonNullable.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    type: [1, Validators.required],
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
  possibleParents() {
    return this.items().filter(
      (x) => x.type === +this.form.controls.type.value && x.id !== this.editing()?.id,
    );
  }
  edit(x: Category) {
    this.editing.set(x);
    this.form.setValue({ name: x.name, code: x.code, type: x.type, parentId: x.parentId || '' });
  }
  reset() {
    this.editing.set(null);
    this.form.reset({ name: '', code: '', type: 1, parentId: '' });
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
        this.message.set(this.t('Category saved.', 'تم حفظ التصنيف.'));
        this.reset();
        this.load();
      },
      error: (e: any) =>
        this.error.set(
          e.status === 409
            ? this.t(
                'Code is already used or the category changed.',
                'الرمز مستخدم أو تغير التصنيف.',
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
            ? this.t('Referenced categories cannot be deactivated.', 'لا يمكن تعطيل تصنيف مستخدم.')
            : this.t('Status change failed.', 'فشل تغيير الحالة.'),
        ),
    });
  }
  t(e: string, a: string) {
    return this.i18n.language() === 'en' ? e : a;
  }
}
