import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import {
  CatalogItem,
  ParsedCatalogItem,
  PriceTier,
  Treatment,
  TreatmentApiService,
  TreatmentPlanList,
  parseCatalogItem,
} from './treatment-api.service';
import { planStatus, treatmentStatus } from './treatment-labels';
import { money } from '../finance/finance-ui';
import { DoctorSelectComponent } from '../../shared/doctor-select.component';
import { ToothPickerComponent } from '../../shared/tooth-picker.component';
import { DoctorApiService } from '../doctors/doctor-api.service';

interface CategoryOption {
  type: number | null;
  nameEn: string;
  nameAr: string;
  icon: string;
}

@Component({
  styleUrl: './treatments.scss',
  selector: 'app-patient-treatment-summary',
  standalone: true,
  imports: [CommonModule, RouterLink, ReactiveFormsModule, DoctorSelectComponent, ToothPickerComponent],
  template: `
    <section class="panel treatment-summary-panel">
      <div class="summary-head">
        <div>
          <h2>{{ t('Treatment summary', 'ملخص العلاج') }}</h2>
          <p class="section-desc">
            {{ t('Treatment plans, active dental procedures, and completed treatments.', 'الخطط العلاجية وإجراءات الأسنان النشطة والمكتملة.') }}
          </p>
        </div>
        <div class="summary-actions">
          <a class="button" [routerLink]="['/treatment-plans']" [queryParams]="{ patientId }">
            {{ t('All plans', 'كل الخطط') }}
          </a>
          <a class="button" [routerLink]="['/treatments']" [queryParams]="{ patientId }">
            {{ t('All treatments', 'كل العلاجات') }}
          </a>
          <button
            type="button"
            class="button primary"
            [class.active-toggle]="showInlineForm()"
            (click)="toggleInlineForm()"
          >
            {{ showInlineForm() ? '▲ ' + t('Close Form', 'إغلاق النموذج') : '+ ' + t('New plan', 'خطة علاج جديدة') }}
          </button>
        </div>
      </div>

      <!-- Success Notification Card -->
      @if (success()) {
        <div class="alert-box-modern success" style="margin-block: 0.85rem;">
          <span class="alert-icon">✅</span>
          <div class="alert-content">
            <strong>{{ t('Success', 'تم بنجاح') }}</strong>
            <p>{{ success() }}</p>
          </div>
          <button type="button" class="btn-close-alert" (click)="success.set('')">✕</button>
        </div>
      }
      @if (loadError()) {
        <div class="alert error" role="alert">{{ loadError() }}</div>
      }

      <!-- ── Inline Expandable Treatment Plan Creation Form ── -->
      @if (showInlineForm()) {
        <div class="inline-creation-panel">
          <div class="inline-panel-header">
            <div class="header-left">
              <span class="panel-icon">📋</span>
              <div>
                <h4>{{ t('New Treatment Plan', 'خطة علاج جديدة') }}</h4>
                <p class="panel-sub">{{ t('Categorize procedure, select price tier, and choose teeth from the dental chart.', 'اختر نوع العلاج، حدد السعر المناسب، واختر الأسنان من مخطط الأسنان.') }}</p>
              </div>
            </div>
            <div class="header-right-tools">
              <button type="button" class="btn-popup-switch" (click)="openCreateModal()" [title]="t('Open in modal popup', 'فتح في نافذة منبثقة')">
                ⛶ {{ t('Popup', 'نافذة منبثقة') }}
              </button>
              <button type="button" class="btn-inline-close" (click)="toggleInlineForm()" [title]="t('Close', 'إغلاق')">✕</button>
            </div>
          </div>

          <form [formGroup]="planForm" (ngSubmit)="savePlan()">
            <!-- Error Notification Card -->
            @if (modalError()) {
              <div class="alert-box-modern error" style="margin-bottom: 1rem;">
                <span class="alert-icon">⚠️</span>
                <div class="alert-content">
                  <strong>{{ t('Action Failed', 'تعذر إتمام العملية') }}</strong>
                  <p>{{ modalError() }}</p>
                </div>
                <button type="button" class="btn-close-alert" (click)="modalError.set('')">✕</button>
              </div>
            }

            <div class="inline-form-grid-2">
              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
                  <app-doctor-select
                    formControlName="doctorProfileId"
                    [allowClear]="false"
                    [isInvalid]="planForm.controls.doctorProfileId.touched && planForm.controls.doctorProfileId.invalid"
                  />
                  @if (planForm.controls.doctorProfileId.touched && planForm.controls.doctorProfileId.invalid) {
                    <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
                  }
                </label>
              </div>

              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Plan Title', 'عنوان الخطة') }} <strong class="req">*</strong></span>
                  <input
                    class="form-input"
                    formControlName="title"
                    maxlength="250"
                    [placeholder]="t('e.g. Comprehensive Dental Plan, Root Canal & Filling…', 'مثال: خطة علاج شاملة، حشو عصب وتجميل…')"
                    [class.invalid]="planForm.controls.title.touched && planForm.controls.title.invalid"
                  />
                  @if (planForm.controls.title.touched && planForm.controls.title.invalid) {
                    <span class="field-error">{{ t('Plan title is required.', 'عنوان الخطة مطلوب.') }}</span>
                  }
                </label>
              </div>
            </div>

            <!-- Treatment Item Builder Container -->
            <div class="treatment-item-builder-box" style="margin-block: 1rem;">
              <div class="box-legend">
                <span>🛠️ {{ t('Procedure Details & Dental Chart Selection', 'تفاصيل الإجراء واختيار الأسنان') }}</span>
                <span class="step-badge">{{ t('Step-by-Step Selection', 'تحديد تدريجي دقيق') }}</span>
              </div>

              <!-- Step 1: Category Selection Pills -->
              <div class="wizard-step-section">
                <label class="input-lbl">
                  <strong>{{ t('1. Select Treatment Category / Type', '1. اختر نوع العلاج أولاً') }}</strong>
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

              <!-- Step 2: Procedure Dropdown (Filtered by Category) -->
              <div class="wizard-step-section">
                <label class="input-lbl">
                  <strong>{{ t('2. Select Procedure from Catalog', '2. اختر الإجراء الطبي من القائمة') }} <strong class="req">*</strong></strong>
                </label>
                <select
                  class="form-input select-styled"
                  formControlName="catalogItemId"
                  (change)="onCatalogItemChange()"
                  [class.invalid]="planForm.controls.catalogItemId.touched && planForm.controls.catalogItemId.invalid"
                >
                  <option value="">{{ t('— Choose procedure from catalog —', '— اختر الإجراء الطبي من الكتالوج —') }}</option>
                  @for (x of filteredCatalog(); track x.id) {
                    <option [value]="x.id">{{ getItemDisplayName(x) }} — ({{ x.defaultPrice }} {{ t('EGP', 'ج.م') }})</option>
                  }
                </select>
                @if (planForm.controls.catalogItemId.touched && planForm.controls.catalogItemId.invalid) {
                  <span class="field-error">{{ t('Procedure item is required.', 'يرجى اختيار الإجراء العلاجي.') }}</span>
                }
              </div>

              <!-- Step 3: Price Tier Selection (if tiers available) -->
              @if (currentParsedItem() && currentParsedItem()!.priceTiers.length > 0) {
                <div class="wizard-step-section price-tiers-section">
                  <label class="input-lbl">
                    <strong>{{ t('3. Select Price Tier / Pricing Option', '3. اختر السعر / الشريحة المناسبة') }}</strong>
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
              <div class="wizard-step-section">
                <label class="input-lbl">
                  <strong>{{ t('4. Target Teeth (Dental Chart)', '4. تحديد السن أو الأسنان من مخطط الأسنان') }}</strong>
                  <small class="lbl-hint">{{ t('(Optional - Click to pick single or multiple teeth)', '(اختياري - يمكنك اختيار سن واحد أو عدة أسنان معاً)') }}</small>
                </label>
                <app-tooth-picker
                  [selectedTeeth]="selectedTeeth()"
                  (selectedTeethChange)="onTeethChange($event)"
                />
              </div>

              <!-- Step 5: Quantity & Discounts -->
              <div class="treatment-grid-3" style="margin-block-start: 0.5rem;">
                <div class="field-item">
                  <label class="input-lbl">{{ t('Quantity per Tooth', 'الكمية لكل سن') }} <strong class="req">*</strong></label>
                  <input class="form-input" type="number" min="1" max="100" formControlName="quantity" />
                </div>
                <div class="field-item">
                  <label class="input-lbl">{{ t('Item Discount', 'خصم البند') }}</label>
                  <input class="form-input" type="number" min="0" step="0.01" formControlName="itemDiscount" />
                </div>
                <div class="field-item">
                  <label class="input-lbl">{{ t('Plan Total Discount', 'خصم الخطة الإجمالي') }}</label>
                  <input class="form-input" type="number" min="0" step="0.01" formControlName="discountAmount" />
                </div>
              </div>
            </div>

            <!-- Dynamic Estimated Total Card -->
            <div class="estimated-total-highlight-card" style="margin-block-end: 1rem;">
              <div class="calc-details">
                <span class="calc-label">{{ t('Live Estimated Total', 'الإجمالي التقديري المحسوب') }}</span>
                <span class="calc-breakdown">
                  {{ currentUnitPrice() }} {{ t('EGP', 'ج.م') }} × {{ selectedTeeth().length > 0 ? selectedTeeth().length + ' ' + t('teeth', 'أسنان') : '1' }} × {{ planForm.controls.quantity.value || 1 }}
                </span>
              </div>
              <div class="calc-amount">
                <strong>{{ calculateTotal() }}</strong>
                <span class="currency-tag">{{ t('EGP', 'ج.م') }}</span>
              </div>
            </div>

            <div class="form-field-group">
              <label class="field-label">
                <span>{{ t('Notes & Clinical Recommendations', 'ملاحظات وتوصيات إكلينيكية') }}</span>
                <textarea class="form-textarea" rows="2" formControlName="notes" [placeholder]="t('Add any clinical notes or instructions for this plan…', 'أضف أي ملاحظات خاصة بالخطة…')"></textarea>
              </label>
            </div>

            <div class="inline-form-footer">
              <button type="button" class="button btn-cancel" (click)="toggleInlineForm()">{{ t('Cancel', 'إلغاء') }}</button>
              <button type="submit" class="button primary btn-save" [disabled]="saving()">
                {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Treatment Plan', 'حفظ خطة العلاج') }}
              </button>
            </div>
          </form>
        </div>
      }

      @if (loading()) {
        <div class="summary-loading">
          <p>{{ t('Loading treatment data…', 'جارٍ تحميل بيانات العلاج…') }}</p>
        </div>
      } @else if (!plans().length && !treatments().length) {
        <div class="empty-summary-box">
          <p>{{ t('No treatment activity or plans recorded yet for this patient.', 'لا توجد خطط أو أنشطة علاجية مسجلة بعد لهذا المريض.') }}</p>
          <button type="button" class="button primary" (click)="toggleInlineForm()">
            + {{ t('Start treatment plan', 'بدء خطة علاج') }}
          </button>
        </div>
      } @else {
        <div class="treatment-summary-grid">
          <div>
            <strong>{{ plans().length }}</strong>
            <span>{{ t('All plans', 'إجمالي الخطط') }}</span>
          </div>
          <div>
            <strong>{{ activePlans().length }}</strong>
            <span>{{ t('Active plans', 'خطط نشطة') }}</span>
          </div>
          <div>
            <strong>{{ treatments().length }}</strong>
            <span>{{ t('Recent treatments', 'علاجات مسجلة') }}</span>
          </div>
        </div>

        <!-- Treatment Plans List -->
        @if (plans().length) {
          <div class="summary-section-block">
            <div class="summary-section-header">
              <span class="sec-title">📋 {{ t('Treatment Plans', 'خطط العلاج') }} ({{ plans().length }})</span>
              <a class="view-all-link" [routerLink]="['/treatment-plans']" [queryParams]="{ patientId }">{{ t('View all plans →', 'عرض كل الخطط ←') }}</a>
            </div>
            <div class="summary-cards-list">
              @for (plan of plans().slice(0, 5); track plan.id) {
                <div class="summary-card-item">
                  <div>
                    <a class="item-title-link" [routerLink]="['/treatment-plans', plan.id]">{{ plan.title }}</a>
                    <small class="item-sub">{{ plan.doctorName }} · {{ plan.createdAt ? (plan.createdAt | date: 'dd/MM/yyyy') : '' }}</small>
                  </div>
                  <div class="plan-card-end">
                    <strong class="item-value">{{ formatMoney(plan.total) }}</strong>
                    <span class="badge status-{{ plan.status }}">{{ getPlanStatusName(plan.status) }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- Executed / Recorded Treatments List -->
        @if (treatments().length) {
          <div class="summary-section-block" style="margin-top: 1.15rem;">
            <div class="summary-section-header">
              <span class="sec-title">🦷 {{ t('Recorded Treatments & Procedures', 'الإجراءات والعلاجات المنفذة') }} ({{ treatments().length }})</span>
              <a class="view-all-link" [routerLink]="['/treatments']" [queryParams]="{ patientId }">{{ t('View all treatments →', 'عرض كل العلاجات ←') }}</a>
            </div>
            <div class="summary-cards-list">
              @for (item of treatments().slice(0, 5); track item.id) {
                <div class="summary-card-item">
                  <div>
                    <a class="item-title-link" [routerLink]="['/treatments', item.id]">{{ item.treatmentName }}</a>
                    <small class="item-sub">
                      <span>{{ item.doctorName }}</span>
                      <span> · </span>
                      <span>{{ item.createdAt ? (item.createdAt | date: 'dd/MM/yyyy') : '' }}</span>
                      @if (item.toothNumbers?.length) {
                        <span> · </span>
                        <span class="teeth-tag">{{ t('Tooth', 'السن') }}: #{{ item.toothNumbers.join(', #') }}</span>
                      }
                    </small>
                  </div>
                  <div class="plan-card-end">
                    <strong class="item-value">{{ formatMoney(item.price) }}</strong>
                    <span class="badge status-{{ item.status }}">{{ getTreatmentStatusName(item.status) }}</span>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </section>

    <!-- Create Treatment Plan Popup Modal (Secondary Option) -->
    @if (showCreateModal()) {
      <div class="modal-backdrop" (click)="closeCreateModal()">
        <div class="modal-card modal-treatment-card" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-title-wrap">
              <span class="modal-badge-icon">📋</span>
              <div>
                <h3>{{ t('New Treatment Plan', 'إنشاء خطة علاج جديدة') }}</h3>
                <p class="modal-subtitle">{{ t('Define dental procedures, teeth numbers, and estimated costs.', 'تحديد الإجراءات الطبية والأسنان والتكلفة المقدرة للمريض.') }}</p>
              </div>
            </div>
            <button type="button" class="close-btn" (click)="closeCreateModal()" aria-label="Close">✕</button>
          </div>

          <form [formGroup]="planForm" (ngSubmit)="savePlan()">
            <div class="modal-body">
              @if (modalError()) {
                <div class="alert-box-modern error" style="margin-bottom: 0.85rem;">
                  <span class="alert-icon">⚠️</span>
                  <div class="alert-content">
                    <strong>{{ t('Action Failed', 'تعذر إتمام العملية') }}</strong>
                    <p>{{ modalError() }}</p>
                  </div>
                  <button type="button" class="btn-close-alert" (click)="modalError.set('')">✕</button>
                </div>
              }

              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Doctor', 'الطبيب المعالج') }} <strong class="req">*</strong></span>
                  <app-doctor-select
                    formControlName="doctorProfileId"
                    [allowClear]="false"
                    [isInvalid]="planForm.controls.doctorProfileId.touched && planForm.controls.doctorProfileId.invalid"
                  />
                  @if (planForm.controls.doctorProfileId.touched && planForm.controls.doctorProfileId.invalid) {
                    <span class="field-error">{{ t('Doctor is required.', 'الطبيب مطلوب.') }}</span>
                  }
                </label>
              </div>

              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Plan Title', 'عنوان الخطة') }} <strong class="req">*</strong></span>
                  <input
                    class="form-input"
                    formControlName="title"
                    maxlength="250"
                    [placeholder]="t('e.g. Comprehensive Dental Rehabilitation', 'مثال: خطة علاج وتأهيل شامل')"
                    [class.invalid]="planForm.controls.title.touched && planForm.controls.title.invalid"
                  />
                  @if (planForm.controls.title.touched && planForm.controls.title.invalid) {
                    <span class="field-error">{{ t('Plan title is required.', 'عنوان الخطة مطلوب.') }}</span>
                  }
                </label>
              </div>

              <!-- Modal Treatment Item Selection Box -->
              <div class="treatment-item-builder-box">
                <div class="box-legend">
                  <span>🛠️ {{ t('Procedure & Dental Chart Selection', 'الإجراء الطبي ومخطط الأسنان') }}</span>
                </div>

                <!-- Category Pills -->
                <div class="wizard-step-section">
                  <label class="input-lbl"><strong>{{ t('1. Category / Type', '1. نوع العلاج') }}</strong></label>
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

                <!-- Procedure Dropdown -->
                <div class="wizard-step-section">
                  <label class="input-lbl"><strong>{{ t('2. Procedure', '2. الإجراء الطبي') }} <strong class="req">*</strong></strong></label>
                  <select
                    class="form-input select-styled"
                    formControlName="catalogItemId"
                    (change)="onCatalogItemChange()"
                    [class.invalid]="planForm.controls.catalogItemId.touched && planForm.controls.catalogItemId.invalid"
                  >
                    <option value="">{{ t('— Choose procedure —', '— اختر الإجراء الطبي —') }}</option>
                    @for (x of filteredCatalog(); track x.id) {
                      <option [value]="x.id">{{ getItemDisplayName(x) }} — ({{ x.defaultPrice }} {{ t('EGP', 'ج.م') }})</option>
                    }
                  </select>
                </div>

                <!-- Price Tiers -->
                @if (currentParsedItem() && currentParsedItem()!.priceTiers.length > 0) {
                  <div class="wizard-step-section price-tiers-section">
                    <label class="input-lbl"><strong>{{ t('3. Price Tier', '3. الشريحة السعرية') }}</strong></label>
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

                <!-- Teeth Picker -->
                <div class="wizard-step-section">
                  <label class="input-lbl"><strong>{{ t('4. Target Teeth (FDI)', '4. الأسنان المستهدفة (ترقيم FDI)') }}</strong></label>
                  <app-tooth-picker
                    [selectedTeeth]="selectedTeeth()"
                    (selectedTeethChange)="onTeethChange($event)"
                  />
                </div>

                <div class="treatment-grid-3">
                  <div class="field-item">
                    <label class="input-lbl">{{ t('Quantity', 'الكمية') }} <strong class="req">*</strong></label>
                    <input class="form-input" type="number" min="1" max="100" formControlName="quantity" />
                  </div>
                  <div class="field-item">
                    <label class="input-lbl">{{ t('Item discount', 'خصم البند') }}</label>
                    <input class="form-input" type="number" min="0" step="0.01" formControlName="itemDiscount" />
                  </div>
                  <div class="field-item">
                    <label class="input-lbl">{{ t('Plan discount', 'خصم الخطة') }}</label>
                    <input class="form-input" type="number" min="0" step="0.01" formControlName="discountAmount" />
                  </div>
                </div>
              </div>

              <!-- Estimated Total Card -->
              <div class="estimated-total-highlight-card">
                <div class="calc-details">
                  <span class="calc-label">{{ t('Live Estimated Total', 'الإجمالي التقديري المحسوب') }}</span>
                  <span class="calc-breakdown">
                    {{ currentUnitPrice() }} {{ t('EGP', 'ج.م') }} × {{ selectedTeeth().length > 0 ? selectedTeeth().length + ' ' + t('teeth', 'أسنان') : '1' }} × {{ planForm.controls.quantity.value || 1 }}
                  </span>
                </div>
                <div class="calc-amount">
                  <strong>{{ calculateTotal() }}</strong>
                  <span class="currency-tag">{{ t('EGP', 'ج.م') }}</span>
                </div>
              </div>

              <div class="form-field-group">
                <label class="field-label">
                  <span>{{ t('Notes & Clinical Recommendations', 'ملاحظات وتوصيات إكلينيكية') }}</span>
                  <textarea class="form-textarea" rows="3" formControlName="notes" [placeholder]="t('Add any notes for this patient…', 'أضف أي ملاحظات خاصة بالخطة…')"></textarea>
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="button btn-cancel" (click)="closeCreateModal()">{{ t('Cancel', 'إلغاء') }}</button>
              <button type="submit" class="button primary btn-save" [disabled]="saving() || planForm.invalid">
                {{ saving() ? t('Saving…', 'جارٍ الحفظ…') : t('Save Treatment Plan', 'حفظ خطة العلاج') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class PatientTreatmentSummaryComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId = '';
  private readonly api = inject(TreatmentApiService);
  private readonly doctorService = inject(DoctorApiService);
  readonly i18n = inject(LocalizationService);

  readonly plans = signal<TreatmentPlanList[]>([]);
  readonly treatments = signal<Treatment[]>([]);
  readonly catalog = signal<CatalogItem[]>([]);
  readonly defaultDoctorId = signal<string>('');
  readonly loading = signal(true);
  readonly showInlineForm = signal(false);
  readonly showCreateModal = signal(false);
  readonly saving = signal(false);
  readonly modalError = signal('');
  readonly success = signal('');
  readonly loadError = signal('');

  // Category & Tooth Picker State
  readonly selectedType = signal<number | null>(null);
  readonly selectedPriceTier = signal<string>('base');
  readonly selectedTeeth = signal<number[]>([]);
  readonly currentParsedItem = signal<ParsedCatalogItem | null>(null);

  private count = 0;

  readonly categories: CategoryOption[] = [
    { type: null, nameEn: 'All Procedures', nameAr: 'جميع الإجراءات', icon: '✨' },
    { type: 1, nameEn: 'Fillings', nameAr: 'حشو عادي / تجميلي', icon: '🦷' },
    { type: 4, nameEn: 'Root Canal', nameAr: 'حشو عصب وعلاج جذور', icon: '⚡' },
    { type: 2, nameEn: 'Extractions', nameAr: 'خلع أسنان', icon: '🩸' },
    { type: 3, nameEn: 'Dental Implants', nameAr: 'زراعة أسنان', icon: '🔩' },
    { type: 5, nameEn: 'Crowns & Bridges', nameAr: 'تركيبات وتيجان', icon: '👑' },
    { type: 6, nameEn: 'Ortho & Cleaning', nameAr: 'تقويم وتنظيف جير', icon: '✨' },
  ];

  readonly planForm = inject(FormBuilder).nonNullable.group({
    doctorProfileId: ['', Validators.required],
    title: ['', Validators.required],
    notes: '',
    discountAmount: 0,
    catalogItemId: ['', Validators.required],
    quantity: 1,
    itemDiscount: 0,
  });

  ngOnInit() {
    this.fetchData();
    this.api.catalog().subscribe((x) => this.catalog.set(x));
    this.doctorService.listAll().subscribe((docs) => {
      if (docs && docs.length > 0) {
        this.defaultDoctorId.set(docs[0].id);
        if (!this.planForm.controls.doctorProfileId.value) {
          this.planForm.patchValue({ doctorProfileId: docs[0].id });
        }
      }
    });
  }

  ngOnChanges() {
    if (this.patientId) {
      this.fetchData();
    }
  }

  fetchData() {
    this.count = 0;
    this.loading.set(true);
    this.loadError.set('');
    this.api.plans({ patientId: this.patientId, pageSize: '10' }).subscribe({
      next: (x) => {
        this.plans.set(x.items ?? []);
        this.done();
      },
      error: () => {
        this.plans.set([]);
        this.loadError.set(this.t('Treatment plans could not be loaded. Check your access permission.', 'تعذر تحميل خطط العلاج. تحقق من صلاحية عرض الخطط.'));
        this.done();
      },
    });
    this.api.treatments({ patientId: this.patientId, pageSize: '10' }).subscribe({
      next: (x) => {
        this.treatments.set(x.items ?? []);
        this.done();
      },
      error: () => {
        this.treatments.set([]);
        if (!this.loadError()) this.loadError.set(this.t('Treatment history could not be loaded. Check your access permission.', 'تعذر تحميل سجل العلاجات. تحقق من صلاحية عرض العلاجات.'));
        this.done();
      },
    });
  }

  activePlans() {
    return this.plans().filter((x) => [1, 2, 3, 5].includes(x.status));
  }

  completedTreatments() {
    return this.treatments().filter((x) => x.status === 4);
  }

  done() {
    if (++this.count >= 2) this.loading.set(false);
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
      const currentId = this.planForm.controls.catalogItemId.value;
      if (!available.some((x) => x.id === currentId)) {
        this.planForm.patchValue({ catalogItemId: available[0].id });
        this.onCatalogItemChange();
      }
    }
  }

  onCatalogItemChange() {
    const itemId = this.planForm.controls.catalogItemId.value;
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
    if (!parsed) return 0;
    const tier = parsed.priceTiers.find((t) => t.id === this.selectedPriceTier());
    return tier ? tier.price : parsed.defaultPrice;
  }

  calculateTotal(): number {
    const unitPrice = this.currentUnitPrice();
    const teethCount = Math.max(1, this.selectedTeeth().length);
    const qty = this.planForm.controls.quantity.value || 1;
    const itemDiscount = this.planForm.controls.itemDiscount.value || 0;
    const planDiscount = this.planForm.controls.discountAmount.value || 0;
    const subtotal = Math.max(0, (unitPrice * teethCount * qty) - itemDiscount);
    return Math.max(0, subtotal - planDiscount);
  }

  toggleInlineForm() {
    if (this.showInlineForm()) {
      this.showInlineForm.set(false);
    } else {
      this.modalError.set('');
      this.planForm.reset({
        doctorProfileId: this.defaultDoctorId() || '',
        title: this.t('Treatment Plan', 'خطة علاج أسنان'),
        notes: '',
        discountAmount: 0,
        catalogItemId: '',
        quantity: 1,
        itemDiscount: 0,
      });
      this.selectedTeeth.set([]);
      this.selectedType.set(null);
      this.currentParsedItem.set(null);
      this.selectedPriceTier.set('base');
      this.showInlineForm.set(true);
    }
  }

  openCreateModal() {
    this.showInlineForm.set(false);
    this.modalError.set('');
    this.planForm.reset({
      doctorProfileId: this.defaultDoctorId() || '',
      title: this.t('Treatment Plan', 'خطة علاج أسنان'),
      notes: '',
      discountAmount: 0,
      catalogItemId: '',
      quantity: 1,
      itemDiscount: 0,
    });
    this.selectedTeeth.set([]);
    this.selectedType.set(null);
    this.currentParsedItem.set(null);
    this.selectedPriceTier.set('base');
    this.showCreateModal.set(true);
  }

  closeCreateModal() {
    this.showCreateModal.set(false);
  }

  savePlan() {
    this.planForm.markAllAsTouched();
    const v = this.planForm.getRawValue();
    if (this.planForm.invalid) {
      if (!v.doctorProfileId) {
        this.modalError.set(this.t('Please select an attending doctor.', 'يرجى اختيار الطبيب المعالج.'));
      } else if (!v.catalogItemId) {
        this.modalError.set(this.t('Please select a treatment procedure from the catalog.', 'يرجى اختيار الإجراء الطبي من الكتالوج.'));
      } else if (!v.title) {
        this.modalError.set(this.t('Please enter a title for the treatment plan.', 'يرجى إدخال عنوان لخطة العلاج.'));
      } else {
        this.modalError.set(this.t('Please complete all required fields.', 'يرجى إكمال جميع الحقول المطلوبة.'));
      }
      return;
    }

    this.saving.set(true);
    this.modalError.set('');
    this.success.set('');
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

    this.api
      .createPlan({
        patientId: this.patientId,
        doctorProfileId: v.doctorProfileId,
        title: v.title,
        notes: v.notes || undefined,
        discountAmount: Number(v.discountAmount) || 0,
        items,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.showInlineForm.set(false);
          this.selectedTeeth.set([]);
          this.success.set(this.t('Treatment plan created successfully.', 'تم إنشاء وحفظ خطة العلاج بنجاح.'));
          this.fetchData();
        },
        error: (err) => {
          this.saving.set(false);
          this.modalError.set(
            parseApiError(err, this.t('Failed to create treatment plan. Please check fields.', 'تعذر حفظ خطة العلاج. يرجى مراجعة الحقول.')),
          );
        },
      });
  }

  getPlanStatusName(status: number): string {
    return planStatus(status, this.i18n.language() === 'ar');
  }

  getTreatmentStatusName(status: number): string {
    return treatmentStatus(status, this.i18n.language() === 'ar');
  }

  formatMoney(val: number): string {
    return money(val, 'EGP', this.i18n.language());
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

