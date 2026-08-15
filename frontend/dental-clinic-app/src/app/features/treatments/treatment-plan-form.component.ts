import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CatalogItem, PlanItem, TreatmentApiService } from './treatment-api.service';
import { Observable } from 'rxjs';
import { planPrice } from './treatment-labels';

@Component({
  selector: 'app-treatment-plan-form',
  imports: [ReactiveFormsModule, RouterLink],
  template: ` <a class="back" routerLink="/treatment-plans"
      >← {{ t('Back to plans', 'العودة للخطط') }}</a
    >
    <section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Treatment plan', 'خطة العلاج') }}</p>
        <h1>{{ id ? t('Edit plan', 'تعديل الخطة') : t('Create plan', 'إنشاء خطة') }}</h1>
      </div>
    </section>
    @if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading…', 'جارٍ التحميل…') }}</div>
    } @else {
      <form class="panel plan-form" [formGroup]="form" (ngSubmit)="save()">
        @if (!id) {
          <label>{{ t('Patient ID', 'رقم المريض') }}<input formControlName="patientId" /></label
          ><label
            >{{ t('Doctor profile ID', 'رقم ملف الطبيب') }}<input formControlName="doctorProfileId"
          /></label>
        }
        <label>{{ t('Title', 'العنوان') }}<input formControlName="title" maxlength="250" /></label
        ><label
          >{{ t('Notes', 'ملاحظات')
          }}<textarea formControlName="notes" rows="4" maxlength="4000"></textarea></label
        ><label
          >{{ t('Plan discount', 'خصم الخطة')
          }}<input type="number" min="0" step="0.01" formControlName="discountAmount"
        /></label>
        @if (true) {
          @if (id) {
            <div class="record-list">
              @for (item of planItems(); track item.id) {
                <div>
                  <span
                    ><strong>{{ item.treatmentName }}</strong
                    ><small
                      >{{ item.toothNumber || '—' }} · {{ item.quantity }} × {{ item.unitPrice }} =
                      {{ item.total }}</small
                    ></span
                  ><button type="button" class="danger" (click)="removeItem(item.id)">
                    {{ t('Remove', 'إزالة') }}
                  </button>
                </div>
              }
            </div>
          }
          <fieldset>
            <legend>
              {{
                id
                  ? t('Add treatment item', 'إضافة بند علاجي')
                  : t('First treatment item', 'أول بند علاجي')
              }}
            </legend>
            <label
              >{{ t('Catalog treatment', 'العلاج من الكتالوج')
              }}<select formControlName="catalogItemId">
                <option value="">{{ t('Select treatment', 'اختر العلاج') }}</option>
                @for (x of catalog(); track x.id) {
                  <option [value]="x.id">{{ x.name }} — {{ x.defaultPrice }}</option>
                }
              </select></label
            ><label
              >{{ t('Tooth (FDI, optional)', 'السن (FDI، اختياري)')
              }}<input type="number" formControlName="toothNumber" /></label
            ><label
              >{{ t('Quantity', 'الكمية')
              }}<input type="number" min="1" max="100" formControlName="quantity" /></label
            ><label
              >{{ t('Item discount', 'خصم البند')
              }}<input type="number" min="0" step="0.01" formControlName="itemDiscount"
            /></label>
          </fieldset>
          <div class="totals">
            <span>{{ t('Unit price', 'سعر الوحدة') }}: {{ selectedPrice() }}</span>
            <span>{{ t('Subtotal', 'المجموع') }}: {{ preview().subtotal }}</span>
            <strong>{{ t('Total', 'الإجمالي') }}: {{ preview().total }}</strong>
          </div>
          @if (id) {
            <button
              type="button"
              (click)="addItem()"
              [disabled]="!form.controls.catalogItemId.value"
            >
              {{ t('Add item', 'إضافة البند') }}
            </button>
          }
        }
        <button class="primary" [disabled]="form.invalid || saving()">
          {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save plan', 'حفظ الخطة') }}
        </button>
      </form>
    }`,
  styleUrl: './treatments.scss',
})
export class TreatmentPlanFormComponent {
  private readonly api = inject(TreatmentApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');
  readonly catalog = signal<CatalogItem[]>([]);
  readonly planItems = signal<PlanItem[]>([]);
  readonly loading = signal(!!this.id);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: ['', Validators.required],
    doctorProfileId: ['', Validators.required],
    title: ['', Validators.required],
    notes: '',
    discountAmount: 0,
    catalogItemId: '',
    toothNumber: null as number | null,
    quantity: 1,
    itemDiscount: 0,
    version: '',
  });
  constructor() {
    this.api.catalog().subscribe((x) => this.catalog.set(x));
    if (this.id)
      this.api.plan(this.id).subscribe({
        next: (x) => {
          this.form.patchValue({
            patientId: x.patientId,
            doctorProfileId: x.doctorProfileId,
            title: x.title,
            notes: x.notes ?? '',
            discountAmount: x.discountAmount,
            version: x.version,
          });
          this.planItems.set(x.items);
          this.form.controls.patientId.disable();
          this.form.controls.doctorProfileId.disable();
          this.loading.set(false);
        },
        error: () => {
          this.error.set(this.t('Plan not found.', 'الخطة غير موجودة.'));
          this.loading.set(false);
        },
      });
  }
  save() {
    if (this.form.invalid || (!this.id && !this.form.controls.catalogItemId.value)) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const request: Observable<void | { id: string }> = this.id
      ? this.api.updatePlan(this.id, {
          title: v.title,
          notes: v.notes || undefined,
          discountAmount: v.discountAmount,
          version: v.version,
        })
      : this.api.createPlan({
          patientId: v.patientId,
          doctorProfileId: v.doctorProfileId,
          title: v.title,
          notes: v.notes || undefined,
          discountAmount: v.discountAmount,
          items: [
            {
              catalogItemId: v.catalogItemId,
              toothNumber: v.toothNumber ?? undefined,
              quantity: v.quantity,
              discountAmount: v.itemDiscount,
            },
          ],
        });
    request.subscribe({
      next: (x) =>
        this.router.navigate(['/treatment-plans', this.id ?? (x as { id: string }).id], {
          state: { message: this.t('Plan saved.', 'تم حفظ الخطة.') },
        }),
      error: () => {
        this.error.set(
          this.t(
            'The plan could not be saved. Check IDs, prices, and permissions.',
            'تعذر حفظ الخطة. تحقق من المعرفات والأسعار والصلاحيات.',
          ),
        );
        this.saving.set(false);
      },
    });
  }
  selectedPrice() {
    return (
      this.catalog().find((x) => x.id === this.form.controls.catalogItemId.value)?.defaultPrice ?? 0
    );
  }
  preview() {
    return planPrice(
      this.selectedPrice(),
      this.form.controls.quantity.value,
      this.form.controls.itemDiscount.value,
      this.form.controls.discountAmount.value,
    );
  }
  addItem() {
    if (!this.id || !this.form.controls.catalogItemId.value) return;
    const v = this.form.getRawValue();
    this.api
      .addPlanItem(
        this.id,
        {
          catalogItemId: v.catalogItemId,
          toothNumber: v.toothNumber ?? undefined,
          quantity: v.quantity,
          discountAmount: v.itemDiscount,
        },
        v.version,
      )
      .subscribe({
        next: () => this.reload(),
        error: () =>
          this.error.set(
            this.t(
              'The item could not be added. Reload and try again.',
              'تعذر إضافة البند. أعد التحميل وحاول مجددًا.',
            ),
          ),
      });
  }
  removeItem(itemId: string) {
    if (!this.id || !confirm(this.t('Remove this draft item?', 'إزالة هذا البند من المسودة؟')))
      return;
    this.api.removePlanItem(this.id, itemId, this.form.controls.version.value).subscribe({
      next: () => this.reload(),
      error: () => this.error.set(this.t('The item could not be removed.', 'تعذر إزالة البند.')),
    });
  }
  private reload() {
    this.api.plan(this.id!).subscribe((x) => {
      this.planItems.set(x.items);
      this.form.controls.version.setValue(x.version);
    });
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
