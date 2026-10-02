import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import {
  CatalogItem,
  ParsedCatalogItem,
  PlanItem,
  PriceTier,
  TreatmentApiService,
  parseCatalogItem,
} from './treatment-api.service';
import { Observable } from 'rxjs';
import { planPrice } from './treatment-labels';

import { PatientSelectComponent } from '../../shared/patient-select.component';
import { DoctorSelectComponent } from '../../shared/doctor-select.component';
import { ToothPickerComponent } from '../../shared/tooth-picker.component';

interface CategoryOption {
  type: number | null;
  nameEn: string;
  nameAr: string;
  icon: string;
}

@Component({
  styleUrl: './treatments.scss',
  selector: 'app-treatment-plan-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PatientSelectComponent, DoctorSelectComponent, ToothPickerComponent],
  template: `
    <div class="treatment-plan-form-page">
      <a class="back-link" routerLink="/treatment-plans">
        ← {{ t('Back to treatment plans', 'العودة لخطط العلاج') }}
      </a>

      <header class="form-page-header">
        <div class="header-icon-wrap">📋</div>
        <div>
          <p class="eyebrow">{{ t('Treatment Planning', 'التخطيط العلاجي السريري') }}</p>
          <h1>{{ id ? t('Edit Treatment Plan', 'تعديل خطة العلاج') : t('Create New Treatment Plan', 'إنشاء خطة علاج جديدة') }}</h1>
          <p class="header-desc">{{ t('Define clinical objectives, dental procedures, tooth numbers, and cost estimates.', 'تحديد الأهداف العلاجية والإجراءات المطلوبة وأرقام الأسنان والتكلفة المقدرة.') }}</p>
        </div>
      </header>

      @if (error()) {
        <div class="alert-box-modern error" style="margin-block-end: 1.25rem;">
          <span class="alert-icon">⚠️</span>
          <div class="alert-content">
            <strong>{{ t('Attention Required', 'تنبيه') }}</strong>
            <p>{{ error() }}</p>
          </div>
          <button type="button" class="btn-close-alert" (click)="error.set('')">✕</button>
        </div>
      }

      @if (loading()) {
        <div class="loading-state">{{ t('Loading treatment plan…', 'جارٍ تحميل بيانات خطة العلاج…') }}</div>
      } @else {
        <form class="panel form-section-panel" [formGroup]="form" (ngSubmit)="save()">
          <div class="section-title-bar">
            <h3>{{ t('Plan Information', 'البيانات الأساسية للخطة') }}</h3>
          </div>

          @if (!id) {
            <div class="main-info-grid">
              <div class="field-item">
                <label class="field-label">
                  <span>{{ t('Patient', 'المريض') }} <strong class="req">*</strong></span>
                  <app-patient-select
                    formControlName="patientId"
                    [allowClear]="false"
                    [isInvalid]="form.controls.patientId.touched && form.controls.patientId.invalid"
                  />
                  @if (form.controls.patientId.touched && form.controls.patientId.invalid) {
                    <span class="field-error">{{ t('Patient is required.', 'المريض مطلوب.') }}</span>
                  }
                </label>
              </div>

              <div class="field-item">
                <label class="field-label">
                  <span>{{ t('Attending Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
                  <app-doctor-select
                    formControlName="doctorProfileId"
                    [allowClear]="false"
                    [isInvalid]="form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid"
                  />
                  @if (form.controls.doctorProfileId.touched && form.controls.doctorProfileId.invalid) {
                    <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
                  }
                </label>
              </div>
            </div>
          }

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Plan Title', 'عنوان الخطة العلاجية') }} <strong class="req">*</strong></span>
              <input
                class="form-input"
                formControlName="title"
                maxlength="250"
                [placeholder]="t('e.g. Comprehensive Smile Rehabilitation, Root Canal Treatment…', 'مثال: خطة تأهيل شاملة للأسنان، علاج جذور وتركيبات…')"
                [class.invalid]="form.controls.title.touched && form.controls.title.invalid"
              />
              @if (form.controls.title.touched && form.controls.title.invalid) {
                <span class="field-error">{{ t('Plan title is required.', 'عنوان الخطة مطلوب.') }}</span>
              }
            </label>
          </div>

          <div class="field-item">
            <label class="field-label">
              <span>{{ t('Clinical Notes & Instructions', 'ملاحظات وتوصيات إكلينيكية') }}</span>
              <textarea
                class="form-textarea"
                formControlName="notes"
                rows="3"
                maxlength="4000"
                [placeholder]="t('Diagnosis notes, sequence of procedures, patient medical considerations…', 'ملاحظات التشخيص، ترتيب الجلسات، أو أي محاذير طبية خاصة بالمريض…')"
              ></textarea>
            </label>
          </div>

          <!-- Existing Items List (when editing) -->
          @if (id && planItems().length) {
            <div class="existing-items-block">
              <h4>{{ t('Current Treatment Items', 'البنود العلاجية الحالية في الخطة') }}</h4>
              <div class="items-cards-list">
                @for (item of planItems(); track item.id) {
                  <div class="item-view-card">
                    <div class="item-info">
                      <strong class="item-title">{{ item.treatmentName }}</strong>
                      <span class="item-meta">
                        {{ item.toothNumber ? t('Tooth #' + item.toothNumber, 'السن #' + item.toothNumber) : t('General', 'عام') }} · 
                        {{ item.quantity }} × {{ item.unitPrice }} = <strong>{{ item.total }} {{ t('EGP', 'ج.م') }}</strong>
                      </span>
                    </div>
                    <button type="button" class="btn-remove-item" (click)="removeItem(item.id)">
                      ✕ {{ t('Remove', 'حذف') }}
                    </button>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Treatment Item Builder Box -->
          <div class="item-builder-container" style="margin-block-start: 1.5rem;">
            <div class="builder-legend">
              <span class="builder-pill">🛠️</span>
              <div>
                <strong>{{ id ? t('Add New Procedure / Treatment Item', 'إضافة بند علاجي جديد للخطة') : t('Primary Treatment Procedure', 'الإجراء العلاجي الأساسي') }}</strong>
                @if (!id) { <span class="req">*</span> }
                <p class="legend-sub">{{ t('Select category, choose procedure and price tier, and specify teeth from the dental chart.', 'اختر النوع، حدد السعر المناسب، وحدد الأسنان من مخطط الأسنان.') }}</p>
              </div>
            </div>

            <!-- Step 1: Category Filter Pills -->
            <div class="wizard-step-section" style="margin-block: 0.75rem;">
              <label class="input-lbl">
                <strong>{{ t('1. Select Category / Type', '1. اختر نوع العلاج أولاً') }}</strong>
              </label>
              <div class="category-pills-bar">
                @for (cat of categories; track cat.type) {
                  <button
                    type="button"
                    class="btn-cat-pill"
                    [class.active]="selectedType() === cat.type"
                    (click)="onCategorySelect(cat.type)"
                  >
                    <span class="cat-icon">{{ cat.icon }}</span>
                    <span>{{ t(cat.nameEn, cat.nameAr) }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Step 2: Procedure Dropdown -->
            <div class="wizard-step-section" style="margin-block-end: 0.75rem;">
              <label class="input-lbl">
                <strong>{{ t('2. Select Procedure from Catalog', '2. اختر الإجراء الطبي من الكتالوج') }} @if (!id) { <strong class="req">*</strong> }</strong>
              </label>
              <select
                class="form-input select-styled"
                formControlName="catalogItemId"
                (change)="onCatalogItemChange()"
                [class.invalid]="form.controls.catalogItemId.touched && form.controls.catalogItemId.invalid"
              >
                <option value="">{{ t('— Choose procedure from catalog —', '— اختر الإجراء الطبي من الكتالوج —') }}</option>
                @for (x of filteredCatalog(); track x.id) {
                  <option [value]="x.id">{{ getItemDisplayName(x) }} — ({{ x.defaultPrice }} {{ t('EGP', 'ج.م') }})</option>
                }
              </select>
              @if (!id && form.controls.catalogItemId.touched && form.controls.catalogItemId.invalid) {
                <span class="field-error">{{ t('Treatment item is required.', 'يرجى اختيار الإجراء الطبي.') }}</span>
              }
            </div>

            <!-- Step 3: Price Tier Selection -->
            @if (currentParsedItem() && currentParsedItem()!.priceTiers.length > 0) {
              <div class="wizard-step-section price-tiers-section" style="margin-block-end: 0.75rem;">
                <label class="input-lbl">
                  <strong>{{ t('3. Select Price Tier / Pricing Option', '3. اختر السعر / الشريحة السعرية') }}</strong>
                </label>
                <div class="price-tiers-grid">
                  @for (tier of currentParsedItem()!.priceTiers; track tier.id) {
                    <div
                      class="tier-select-card"
                      [class.active]="selectedPriceTier() === tier.id"
                      (click)="selectTier(tier.id)"
                    >
                      <div class="tier-card-header">
                        <span class="tier-radio-dot"></span>
                        <strong class="tier-title">{{ t(tier.nameEn, tier.nameAr) }}</strong>
                      </div>
                      <div class="tier-price-val">{{ tier.price }} {{ t('EGP', 'ج.م') }}</div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Step 4: Tooth Selector from Interactive Dental Chart -->
            <div class="wizard-step-section" style="margin-block-end: 0.75rem;">
              <label class="input-lbl">
                <strong>{{ t('4. Target Teeth (Dental Chart)', '4. تحديد السن أو الأسنان من مخطط الأسنان') }}</strong>
                <small class="lbl-hint">{{ t('(Click to pick single or multiple teeth from chart)', '(انقر لاختيار سن واحد أو عدة أسنان من المخطط)') }}</small>
              </label>
              <app-tooth-picker
                [selectedTeeth]="selectedTeeth()"
                (selectedTeethChange)="onTeethChange($event)"
              />
            </div>

            <div class="treatment-grid-3">
              <div class="field-item">
                <label class="field-label">
                  <span>{{ t('Quantity per Tooth', 'الكمية لكل سن') }} <strong class="req">*</strong></span>
                  <input class="form-input" type="number" min="1" max="100" formControlName="quantity" />
                </label>
              </div>

              <div class="field-item">
                <label class="field-label">
                  <span>{{ t('Item Discount', 'خصم البند') }}</span>
                  <input class="form-input" type="number" min="0" step="0.01" formControlName="itemDiscount" />
                </label>
              </div>

              <div class="field-item">
                <label class="field-label">
                  <span>{{ t('Overall Plan Discount', 'خصم الخطة الإجمالي') }}</span>
                  <input class="form-input" type="number" min="0" step="0.01" formControlName="discountAmount" />
                </label>
              </div>
            </div>

            <!-- Estimated Total Live Highlight Card -->
            <div class="estimated-total-highlight-card" style="margin-block: 1rem;">
              <div class="calc-details">
                <span class="calc-label">{{ t('Live Estimated Total', 'الإجمالي التقديري المحسوب') }}</span>
                <span class="calc-breakdown">
                  {{ currentUnitPrice() }} {{ t('EGP', 'ج.م') }} × {{ selectedTeeth().length > 0 ? selectedTeeth().length + ' ' + t('teeth', 'أسنان') : '1' }} × {{ form.controls.quantity.value || 1 }}
                </span>
              </div>
              <div class="calc-amount">
                <strong>{{ calculateTotal() }}</strong>
                <span class="currency-tag">{{ t('EGP', 'ج.م') }}</span>
              </div>
            </div>

            @if (id) {
              <div class="add-item-action-row" style="margin-block-start: 0.75rem;">
                <button
                  type="button"
                  class="button primary sm"
                  (click)="addItem()"
                  [disabled]="!form.controls.catalogItemId.value"
                >
                  + {{ t('Add this item / teeth to plan', 'إضافة هذا البند والأسنان إلى الخطة') }}
                </button>
              </div>
            }
          </div>

          <div class="form-bottom-actions">
            <a class="button btn-cancel" routerLink="/treatment-plans">{{ t('Cancel', 'إلغاء') }}</a>
            <button class="button primary btn-submit-main" [disabled]="saving()">
              {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Treatment Plan', 'حفظ خطة العلاج') }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class TreatmentPlanFormComponent {
  private readonly api = inject(TreatmentApiService);
  private readonly router = inject(Router);
  readonly i18n = inject(LocalizationService);
  private readonly route = inject(ActivatedRoute);
  readonly id = this.route.snapshot.paramMap.get('id');

  readonly catalog = signal<CatalogItem[]>([]);
  readonly planItems = signal<PlanItem[]>([]);
  readonly loading = signal(!!this.id);
  readonly saving = signal(false);
  readonly error = signal('');

  // Category & Tooth Picker State
  readonly selectedType = signal<number | null>(null);
  readonly selectedPriceTier = signal<string>('base');
  readonly selectedTeeth = signal<number[]>([]);
  readonly currentParsedItem = signal<ParsedCatalogItem | null>(null);

  readonly categories: CategoryOption[] = [
    { type: null, nameEn: 'All Procedures', nameAr: 'جميع الإجراءات', icon: '✨' },
    { type: 1, nameEn: 'Fillings', nameAr: 'حشو عادي / تجميلي', icon: '🦷' },
    { type: 4, nameEn: 'Root Canal', nameAr: 'حشو عصب وعلاج جذور', icon: '⚡' },
    { type: 2, nameEn: 'Extractions', nameAr: 'خلع أسنان', icon: '🩸' },
    { type: 3, nameEn: 'Dental Implants', nameAr: 'زراعة أسنان', icon: '🔩' },
    { type: 5, nameEn: 'Crowns & Bridges', nameAr: 'تركيبات وتيجان', icon: '👑' },
    { type: 6, nameEn: 'Ortho & Cleaning', nameAr: 'تقويم وتنظيف جير', icon: '✨' },
  ];

  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: [this.route.snapshot.queryParamMap.get('patientId') ?? '', Validators.required],
    doctorProfileId: [this.route.snapshot.queryParamMap.get('doctorProfileId') ?? '', Validators.required],
    title: [this.route.snapshot.queryParamMap.get('title') ?? (this.i18n.language() === 'ar' ? 'خطة علاج جديدة' : 'New Treatment Plan'), Validators.required],
    notes: '',
    discountAmount: 0,
    catalogItemId: ['', Validators.required],
    quantity: 1,
    itemDiscount: 0,
    version: '',
  });

  constructor() {
    this.api.catalog().subscribe((x) => this.catalog.set(x));
    if (this.id) {
      this.form.controls.catalogItemId.clearValidators();
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
        error: (err) => {
          this.error.set(
            parseApiError(err, this.t('Plan not found.', 'الخطة غير موجودة.')),
          );
          this.loading.set(false);
        },
      });
    }
  }

  filteredCatalog(): CatalogItem[] {
    const t = this.selectedType();
    if (t === null) return this.catalog();
    return this.catalog().filter((x) => x.type === t);
  }

  getItemDisplayName(item: CatalogItem): string {
    const parsed = parseCatalogItem(item);
    return this.i18n.language() === 'ar' ? parsed.nameAr : parsed.nameEn;
  }

  onCategorySelect(type: number | null) {
    this.selectedType.set(type);
    const available = this.filteredCatalog();
    if (available.length > 0) {
      const currentId = this.form.controls.catalogItemId.value;
      if (!available.some((x) => x.id === currentId)) {
        this.form.patchValue({ catalogItemId: available[0].id });
        this.onCatalogItemChange();
      }
    }
  }

  onCatalogItemChange() {
    const itemId = this.form.controls.catalogItemId.value;
    const item = this.catalog().find((x) => x.id === itemId);
    if (item) {
      const parsed = parseCatalogItem(item);
      this.currentParsedItem.set(parsed);
      if (parsed.priceTiers && parsed.priceTiers.length > 0) {
        this.selectedPriceTier.set(parsed.priceTiers[0].id);
      } else {
        this.selectedPriceTier.set('base');
      }
    } else {
      this.currentParsedItem.set(null);
      this.selectedPriceTier.set('base');
    }
  }

  selectTier(tierId: string) {
    this.selectedPriceTier.set(tierId);
  }

  onTeethChange(teeth: number[]) {
    this.selectedTeeth.set(teeth);
  }

  currentUnitPrice(): number {
    const parsed = this.currentParsedItem();
    if (!parsed) {
      const item = this.catalog().find((x) => x.id === this.form.controls.catalogItemId.value);
      return item ? item.defaultPrice : 0;
    }
    const tier = parsed.priceTiers.find((t) => t.id === this.selectedPriceTier());
    return tier ? tier.price : parsed.defaultPrice;
  }

  calculateTotal(): number {
    const unitPrice = this.currentUnitPrice();
    const teethCount = Math.max(1, this.selectedTeeth().length);
    const qty = this.form.controls.quantity.value || 1;
    const itemDiscount = this.form.controls.itemDiscount.value || 0;
    const planDiscount = this.form.controls.discountAmount.value || 0;
    const subtotal = Math.max(0, (unitPrice * teethCount * qty) - itemDiscount);
    return Math.max(0, subtotal - planDiscount);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || (!this.id && !this.form.controls.catalogItemId.value)) return;
    this.saving.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    const unitPrice = this.currentUnitPrice();
    const qty = Number(v.quantity) || 1;
    const itemDiscount = Number(v.itemDiscount) || 0;
    const teeth = this.selectedTeeth();

    const items = teeth.length > 0
      ? teeth.map((tooth) => ({
          catalogItemId: v.catalogItemId,
          toothNumber: tooth,
          quantity: qty,
          unitPrice: unitPrice > 0 ? unitPrice : undefined,
          discountAmount: teeth.length > 1 ? Math.round((itemDiscount / teeth.length) * 100) / 100 : itemDiscount,
        }))
      : [{
          catalogItemId: v.catalogItemId,
          toothNumber: undefined,
          quantity: qty,
          unitPrice: unitPrice > 0 ? unitPrice : undefined,
          discountAmount: itemDiscount,
        }];

    const request: Observable<void | { id: string }> = this.id
      ? this.api.updatePlan(this.id, {
          title: v.title,
          notes: v.notes || undefined,
          discountAmount: Number(v.discountAmount) || 0,
          version: v.version,
        })
      : this.api.createPlan({
          patientId: v.patientId,
          doctorProfileId: v.doctorProfileId,
          title: v.title,
          notes: v.notes || undefined,
          discountAmount: Number(v.discountAmount) || 0,
          items,
        });

    request.subscribe({
      next: (x) =>
        this.router.navigate(['/treatment-plans', this.id ?? (x as { id: string }).id], {
          state: { message: this.t('Plan saved successfully.', 'تم حفظ خطة العلاج بنجاح.') },
        }),
      error: (err) => {
        this.saving.set(false);
        this.error.set(
          parseApiError(
            err,
            this.t(
              'The treatment plan could not be saved. Verify fields or version conflict.',
              'تعذر حفظ خطة العلاج. تحقق من البيانات أو تعارض الإصدار.',
            ),
          ),
        );
      },
    });
  }

  addItem() {
    if (!this.id || !this.form.controls.catalogItemId.value) return;
    const v = this.form.getRawValue();
    const unitPrice = this.currentUnitPrice();
    const qty = Number(v.quantity) || 1;
    const itemDiscount = Number(v.itemDiscount) || 0;
    const teeth = this.selectedTeeth();

    const toothNumber = teeth.length > 0 ? teeth[0] : undefined;

    this.api
      .addPlanItem(
        this.id,
        {
          catalogItemId: v.catalogItemId,
          toothNumber: toothNumber,
          quantity: qty,
          discountAmount: itemDiscount,
        },
        v.version,
      )
      .subscribe({
        next: () => {
          this.selectedTeeth.set([]);
          this.reload();
        },
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

