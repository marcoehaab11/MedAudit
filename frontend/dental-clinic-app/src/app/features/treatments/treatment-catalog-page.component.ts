import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import {
  CatalogItemInput,
  ParsedCatalogItem,
  PriceTier,
  TreatmentApiService,
  parseCatalogItem,
} from './treatment-api.service';

interface DefaultTreatmentSeed {
  nameEn: string;
  nameAr: string;
  code: string;
  type: number;
  defaultPrice: number;
  description: string;
  priceTiers: PriceTier[];
}

const DEFAULT_PROCEDURES: DefaultTreatmentSeed[] = [
  {
    nameEn: 'Regular Composite Filling',
    nameAr: 'حشو عادي / كمبوزيت',
    code: 'FILL-REG',
    type: 1, // Filling
    defaultPrice: 400,
    description: 'ترميم وتجميل الأسنان بحشو الكمبوزيت التجميلي',
    priceTiers: [
      { id: '1', nameEn: 'Single Surface (Class I)', nameAr: 'حشو سطح واحد', price: 400 },
      { id: '2', nameEn: 'Two Surfaces (Class II)', nameAr: 'حشو سطحين', price: 600 },
      { id: '3', nameEn: 'Three Surfaces / Tooth Build-up', nameAr: 'حشو ثلاث أسطح / بناء سن', price: 800 },
    ],
  },
  {
    nameEn: 'Root Canal Treatment (RCT)',
    nameAr: 'حشو عصب وعلاج جذور',
    code: 'RCT-01',
    type: 4, // RootCanal
    defaultPrice: 1000,
    description: 'علاج وحشو جذور الأسنان بأحدث أجهزة الروتاري',
    priceTiers: [
      { id: '1', nameEn: 'Anterior Tooth (1 Canal)', nameAr: 'سنة أمامية (قناة واحدة)', price: 1000 },
      { id: '2', nameEn: 'Premolar (2 Canals)', nameAr: 'ضاحك (قناتين)', price: 1500 },
      { id: '3', nameEn: 'Molar (3-4 Canals)', nameAr: 'ضرس خلفي (3-4 قنوات)', price: 2000 },
      { id: '4', nameEn: 'Root Canal Re-treatment', nameAr: 'إعادة علاج عصب سابق', price: 2500 },
    ],
  },
  {
    nameEn: 'Tooth Extraction',
    nameAr: 'خلع أسنان',
    code: 'EXT-01',
    type: 2, // Extraction
    defaultPrice: 300,
    description: 'خلع الأسنان البسيط والجراحي بأحدث الوسائل',
    priceTiers: [
      { id: '1', nameEn: 'Simple / Deciduous Tooth', nameAr: 'خلع بسيط / أسنان أطفال', price: 300 },
      { id: '2', nameEn: 'Permanent Molar Extraction', nameAr: 'خلع ضرس دائم عادي', price: 500 },
      { id: '3', nameEn: 'Surgical Extraction / Root Tip', nameAr: 'خلع جراحي / جذور متبقية', price: 1200 },
      { id: '4', nameEn: 'Impacted Wisdom Tooth Surgery', nameAr: 'خلع ضرس عقل مدفون جراحياً', price: 2000 },
    ],
  },
  {
    nameEn: 'Dental Implant',
    nameAr: 'زراعة أسنان',
    code: 'IMPL-01',
    type: 3, // Implant
    defaultPrice: 8000,
    description: 'زراعة الأسنان الفورية والتقليدية بأفضل الخامات العالمية',
    priceTiers: [
      { id: '1', nameEn: 'Korean Dental Implant (Standard)', nameAr: 'زرعة أسنان كوري معتمدة', price: 8000 },
      { id: '2', nameEn: 'German Dental Implant (Advanced)', nameAr: 'زرعة أسنان ألماني متقدمة', price: 12000 },
      { id: '3', nameEn: 'Swiss Premium Implant (Straumann)', nameAr: 'زرعة أسنان سويسري فاخرة', price: 16000 },
      { id: '4', nameEn: 'Bone Grafting / Sinus Lift', nameAr: 'زراعة عظم / رفع جيب فكي إضافي', price: 3000 },
    ],
  },
  {
    nameEn: 'Orthodontic Treatment',
    nameAr: 'تقويم الأسنان',
    code: 'ORTHO-01',
    type: 6, // Other (Orthodontics)
    defaultPrice: 15000,
    description: 'علاج وتعديل اصطفاف الأسنان والفكين',
    priceTiers: [
      { id: '1', nameEn: 'Traditional Metal Braces', nameAr: 'تقويم معدني تقليدي شامل', price: 15000 },
      { id: '2', nameEn: 'Ceramic / Aesthetic Braces', nameAr: 'تقويم سيراميك شفاف تجميلي', price: 22000 },
      { id: '3', nameEn: 'Clear Invisible Aligners', nameAr: 'تقويم شفاف غير مرئي (Aligners)', price: 30000 },
      { id: '4', nameEn: 'Orthodontic Retainer', nameAr: 'مثبت تقويم نهائي (Retainer)', price: 1500 },
    ],
  },
  {
    nameEn: 'Scaling & Polishing (Teeth Cleaning)',
    nameAr: 'تنظيف جير وتلميع الأسنان',
    code: 'SCALE-01',
    type: 6, // Other (Preventive)
    defaultPrice: 400,
    description: 'إزالة الجير والرواسب وتلميع الأسنان بالموجات فوق الصوتية',
    priceTiers: [
      { id: '1', nameEn: 'Routine Scaling & Polishing', nameAr: 'تنظيف وتلميع روتيني لكامل الفم', price: 400 },
      { id: '2', nameEn: 'Deep Periodontal Scaling', nameAr: 'تنظيف جير عميق وعلاج لثة', price: 800 },
      { id: '3', nameEn: 'Full Mouth Debridement & Stain Removal', nameAr: 'إزالة تصبغات عنيدة وتلميع شامل', price: 1200 },
    ],
  },
];

@Component({
  selector: 'app-treatment-catalog-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="treatments-page-wrapper catalog-page">
      <!-- Page Header -->
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ t('Clinic Procedures & Pricing', 'إجراءات العيادة ولائحة الأسعار') }}</p>
          <h1>{{ t('Treatment Types & Pricing Catalog', 'جدول أنواع العلاجات والأسعار') }}</h1>
          <p class="sub-desc">{{ t('Manage clinical procedures, bilingual names, and multi-tier pricing options.', 'إدارة وتخصيص أنواع الإجراءات الطبية والأسماء باللغتين ومستويات الأسعار المتعددة.') }}</p>
        </div>

        <div class="head-actions">
          <button type="button" class="button" (click)="seedDefaults()" [disabled]="seeding()">
            ⚡ {{ seeding() ? t('Setting up defaults…', 'جارٍ إعداد الأساسيات…') : t('Load Core Treatments', 'استعادة العلاجات الأساسية') }}
          </button>
          <button type="button" class="button primary" (click)="openAddModal()">
            + {{ t('New Treatment', 'إضافة نوع علاج جديد') }}
          </button>
        </div>
      </section>

      <!-- Alert Messages -->
      @if (success()) {
        <div class="alert success" role="status">{{ success() }}</div>
      }
      @if (error()) {
        <div class="alert error" role="alert">{{ error() }}</div>
      }

      <!-- Search & Filters Toolbar -->
      <section class="panel filters catalog-filters">
        <div class="search-input-wrap">
          <input
            type="text"
            [(ngModel)]="searchQuery"
            (ngModelChange)="applyFilters()"
            [placeholder]="t('Search by English or Arabic name, or code…', 'بحث بالاسم الإنجليزي أو العربي أو الكود…')"
          />
        </div>

        <select [(ngModel)]="categoryFilter" (ngModelChange)="applyFilters()">
          <option value="all">{{ t('All Categories', 'كل الفئات والتخصصات') }}</option>
          <option value="1">{{ t('Fillings / حشو', 'حشو الأسنان') }}</option>
          <option value="2">{{ t('Extraction / خلع', 'خلع الأسنان') }}</option>
          <option value="3">{{ t('Implant / زراعة', 'زراعة الأسنان') }}</option>
          <option value="4">{{ t('Root Canal / عصب', 'علاج الجذور والعصب') }}</option>
          <option value="5">{{ t('Crown & Bridge / تركيبة', 'التيجان والتركيبات') }}</option>
          <option value="6">{{ t('Other / أخرى (تقويم / تنظيف)', 'أخرى (تقويم وتجميل وتنظيف)') }}</option>
        </select>

        <label class="checkbox-label">
          <input type="checkbox" [(ngModel)]="includeInactive" (ngModelChange)="loadCatalog()" />
          <span>{{ t('Show Inactive', 'عرض غير المفعل') }}</span>
        </label>
      </section>

      <!-- Treatments Catalog Table Panel -->
      <section class="panel table-panel">
        @if (loading()) {
          <div class="state-loading">{{ t('Loading treatment catalog…', 'جارٍ تحميل جدول العلاجات…') }}</div>
        } @else if (!filteredItems().length) {
          <div class="empty-data-state">
            <div class="empty-icon">🦷</div>
            <h3>{{ t('No treatments found', 'لا توجد علاجات مطابقة') }}</h3>
            <p>{{ t('Add custom treatment types or click "Load Core Treatments" to initialize default dental procedures.', 'أضف علاجات جديدة أو اضغط على "استعادة العلاجات الأساسية" لإدراج الإجراءات الافتراضية فوراً.') }}</p>
            <button type="button" class="button primary" (click)="seedDefaults()">
              ⚡ {{ t('Load Core Treatments (حشو، عصب، خلع، زراعة، تقويم، تنظيف)', 'إدراج العلاجات الأساسية الستة') }}
            </button>
          </div>
        } @else {
          <div class="table-scroll">
            <div class="table-responsive"><table class="catalog-table">
              <thead>
                <tr>
                  <th style="width: 120px;">{{ t('Code', 'الكود') }}</th>
                  <th style="width: 250px;">{{ t('Treatment Name (EN & AR)', 'اسم العلاج (إنجليزي وعربي)') }}</th>
                  <th style="width: 140px;">{{ t('Category', 'الفئة') }}</th>
                  <th>{{ t('Pricing Levels & Options', 'مستويات وخيارات الأسعار المتعددة') }}</th>
                  <th style="width: 120px;" class="text-end">{{ t('Base Price', 'السعر الأساسي') }}</th>
                  <th style="width: 100px;">{{ t('Status', 'الحالة') }}</th>
                  <th style="width: 140px;" class="text-end">{{ t('Actions', 'الإجراءات') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (item of filteredItems(); track item.id) {
                  <tr [class.inactive-row]="!item.isActive">
                    <td>
                      <span class="code-badge">{{ item.code }}</span>
                    </td>
                    <td>
                      <div class="treatment-name-col">
                        <strong class="name-en">{{ item.nameEn }}</strong>
                        <span class="name-ar">{{ item.nameAr }}</span>
                        <small class="desc-text" *ngIf="item.cleanDescription">{{ item.cleanDescription }}</small>
                      </div>
                    </td>
                    <td>
                      <span class="type-badge type-{{ item.type }}">
                        {{ typeLabel(item.type) }}
                      </span>
                    </td>
                    <td>
                      <div class="price-tiers-cloud">
                        @for (tier of item.priceTiers; track tier.id) {
                          <div class="price-tier-pill">
                            <span class="tier-name">{{ isArabic() ? tier.nameAr : tier.nameEn }}</span>
                            <strong class="tier-val">{{ tier.price }}</strong>
                          </div>
                        }
                      </div>
                    </td>
                    <td class="text-end">
                      <strong class="base-price-val">{{ item.defaultPrice }}</strong>
                    </td>
                    <td>
                      <span class="badge" [class.status-1]="item.isActive" [class.status-0]="!item.isActive">
                        {{ item.isActive ? t('Active', 'نشط') : t('Inactive', 'معطل') }}
                      </span>
                    </td>
                    <td class="text-end">
                      <div class="row-actions">
                        <button type="button" class="btn-action edit" (click)="openEditModal(item)" [title]="t('Edit Treatment', 'تعديل العلاج')">
                          ✏️ {{ t('Edit', 'تعديل') }}
                        </button>
                        <button type="button" class="btn-action delete" (click)="deleteItem(item)" [title]="t('Delete / Deactivate', 'حذف / تعطيل')">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table></div>
          </div>
        }
      </section>

      <!-- Add / Edit Treatment Modal -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card modal-catalog-card" (click)="$event.stopPropagation()">
            <!-- Modal Header -->
            <div class="modal-header">
              <div class="header-title-wrap">
                <span class="modal-badge-icon">🦷</span>
                <div>
                  <h3>{{ editingId() ? t('Edit Treatment Type', 'تعديل نوع الإجراء العلاجي') : t('Add New Treatment Type', 'إضافة نوع علاج وإجراء طبي جديد') }}</h3>
                  <p class="modal-subtitle">{{ t('Configure bilingual names, clinical category, and multi-tier pricing structure.', 'تحديد مسميات الإجراء باللغتين، الفئة الطبية، وجدول مستويات الأسعار المتعددة.') }}</p>
                </div>
              </div>
              <button type="button" class="close-btn" (click)="closeModal()" [attr.aria-label]="t('Close', 'إغلاق')">✕</button>
            </div>

            <!-- Modal Form -->
            <form [formGroup]="form" (ngSubmit)="save()" class="catalog-modal-form">
              <div class="modal-body">
                @if (modalError()) {
                  <div class="alert error" role="alert">
                    <span>⚠️ {{ modalError() }}</span>
                  </div>
                }

                <!-- Quick Presets for New Items -->
                @if (!editingId()) {
                  <div class="quick-presets-box">
                    <span class="preset-title">⚡ {{ t('Quick Presets & Templates:', 'نماذج جاهزة سريعة:') }}</span>
                    <div class="presets-chips">
                      <button type="button" class="preset-chip" (click)="applyPreset('filling')">
                        🦷 {{ t('Filling / حشو', 'حشو أسنان') }}
                      </button>
                      <button type="button" class="preset-chip" (click)="applyPreset('rct')">
                        ⚡ {{ t('Root Canal / عصب', 'حشو عصب وجذور') }}
                      </button>
                      <button type="button" class="preset-chip" (click)="applyPreset('extraction')">
                        🩹 {{ t('Extraction / خلع', 'خلع أسنان') }}
                      </button>
                      <button type="button" class="preset-chip" (click)="applyPreset('implant')">
                        🔩 {{ t('Implant / زراعة', 'زراعة أسنان') }}
                      </button>
                      <button type="button" class="preset-chip" (click)="applyPreset('cleaning')">
                        ✨ {{ t('Cleaning / تنظيف', 'تنظيف جير وتلميع') }}
                      </button>
                      <button type="button" class="preset-chip" (click)="applyPreset('ortho')">
                        📐 {{ t('Ortho / تقويم', 'تقويم أسنان') }}
                      </button>
                    </div>
                  </div>
                }

                <!-- Section 1: Basic Information -->
                <div class="modal-section-card">
                  <div class="section-card-title">
                    <span class="sec-num">1</span>
                    <span>{{ t('Basic Identification & Names', 'البيانات الأساسية والمسميات') }}</span>
                  </div>

                  <div class="form-grid-2">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Arabic Name', 'اسم العلاج بالعربي') }}</span>
                        <span class="lang-tag ar">AR</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input text-ar"
                        formControlName="nameAr"
                        [placeholder]="t('مثال: حشو كمبوزيت تجميلي', 'مثال: حشو كمبوزيت تجميلي')"
                        [class.invalid]="form.controls.nameAr.touched && form.controls.nameAr.invalid"
                      />
                      @if (form.controls.nameAr.touched && form.controls.nameAr.invalid) {
                        <small class="field-error-msg">{{ t('Arabic name is required.', 'الاسم بالعربي مطلوب.') }}</small>
                      }
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('English Name', 'اسم العلاج بالإنجليزي') }}</span>
                        <span class="lang-tag en">EN</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input text-en"
                        formControlName="nameEn"
                        [placeholder]="t('e.g. Composite Filling', 'مثال: Composite Filling')"
                        [class.invalid]="form.controls.nameEn.touched && form.controls.nameEn.invalid"
                      />
                      @if (form.controls.nameEn.touched && form.controls.nameEn.invalid) {
                        <small class="field-error-msg">{{ t('English name is required.', 'الاسم بالإنجليزي مطلوب.') }}</small>
                      }
                    </div>
                  </div>

                  <div class="form-grid-3">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Procedure Code', 'كود الإجراء') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input code-input mono"
                        formControlName="code"
                        maxlength="25"
                        [placeholder]="t('e.g. FILL-01', 'مثال: FILL-01')"
                        [class.invalid]="form.controls.code.touched && form.controls.code.invalid"
                      />
                      @if (form.controls.code.touched && form.controls.code.invalid) {
                        <small class="field-error-msg">{{ t('Code is required.', 'كود الإجراء مطلوب.') }}</small>
                      }
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Category / Specialty', 'الفئة والتخصص') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <select class="form-input form-select" formControlName="type">
                        <option [value]="1">🦷 {{ t('Filling (حشو)', 'حشو أسنان') }}</option>
                        <option [value]="4">⚡ {{ t('Root Canal (عصب)', 'علاج جذور وعصب') }}</option>
                        <option [value]="2">🩹 {{ t('Extraction (خلع)', 'خلع أسنان') }}</option>
                        <option [value]="3">🔩 {{ t('Implant (زراعة)', 'زراعة أسنان') }}</option>
                        <option [value]="5">👑 {{ t('Crown & Bridge (تركيبة)', 'تركيبات وتيجان') }}</option>
                        <option [value]="6">✨ {{ t('Other / Ortho / Cleaning (أخرى / تقويم / تنظيف)', 'أخرى (تقويم / تنظيف / تجميل)') }}</option>
                      </select>
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Base Default Price (EGP)', 'السعر الأساسي المبدئي (ج.م)') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <div class="currency-input-wrap">
                        <input
                          type="number"
                          min="0"
                          step="50"
                          class="form-input price-bold"
                          formControlName="defaultPrice"
                        />
                        <span class="currency-suffix">{{ t('EGP', 'ج.م') }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Section 2: Multi-Tier Pricing Dynamic Builder -->
                <div class="modal-section-card pricing-builder-card">
                  <div class="section-card-title flex-between">
                    <div class="title-with-num">
                      <span class="sec-num">2</span>
                      <div>
                        <span>{{ t('Multi-Tier Pricing Options', 'جدول مستويات وخيارات الأسعار المتعددة') }}</span>
                        <p class="section-hint">{{ t('Define different procedure options & price variations (e.g. 1 surface vs 2 surfaces, simple vs surgical).', 'أضف خيارات سعر مختلفة لنفس الإجراء (مثال: حشو سطح واحد / سطحين، خلع بسيط / جراحي، نوع الزرعة، إلخ).') }}</p>
                      </div>
                    </div>

                    <button type="button" class="btn-add-tier-action" (click)="addPriceTier()">
                      <span>+ {{ t('Add Price Option', 'إضافة مستوى سعر') }}</span>
                    </button>
                  </div>

                  <!-- Tiers Table -->
                  <div class="tiers-table-container">
                    <div class="tiers-table-header">
                      <span class="th-num">#</span>
                      <span class="th-name-ar">{{ t('Option Name (Arabic)', 'اسم الخيار بالعربي') }} <strong class="req">*</strong></span>
                      <span class="th-name-en">{{ t('Option Name (English)', 'اسم الخيار بالإنجليزي') }} <strong class="req">*</strong></span>
                      <span class="th-price">{{ t('Price (EGP)', 'السعر (ج.م)') }} <strong class="req">*</strong></span>
                      <span class="th-del">{{ t('Remove', 'حذف') }}</span>
                    </div>

                    <div class="tiers-rows-list" formArrayName="priceTiers">
                      @for (tierGroup of priceTiersArray.controls; track $index; let i = $index) {
                        <div class="tier-table-row" [formGroupName]="i">
                          <div class="tier-index-cell">
                            <span class="index-badge">{{ i + 1 }}</span>
                          </div>

                          <div class="tier-ar-cell">
                            <input
                              type="text"
                              class="form-input table-input text-ar"
                              formControlName="nameAr"
                              [placeholder]="t('مثال: سطح واحد (Class I)', 'مثال: سطح واحد (Class I)')"
                              [class.invalid]="tierGroup.get('nameAr')?.touched && tierGroup.get('nameAr')?.invalid"
                            />
                          </div>

                          <div class="tier-en-cell">
                            <input
                              type="text"
                              class="form-input table-input text-en"
                              formControlName="nameEn"
                              [placeholder]="t('e.g. Single Surface', 'مثال: Single Surface')"
                              [class.invalid]="tierGroup.get('nameEn')?.touched && tierGroup.get('nameEn')?.invalid"
                            />
                          </div>

                          <div class="tier-price-cell">
                            <div class="currency-input-wrap compact">
                              <input
                                type="number"
                                min="0"
                                step="50"
                                class="form-input table-input price-bold"
                                formControlName="price"
                                [placeholder]="t('Price', 'السعر')"
                                [class.invalid]="tierGroup.get('price')?.touched && tierGroup.get('price')?.invalid"
                              />
                              <span class="currency-suffix">ج.م</span>
                            </div>
                          </div>

                          <div class="tier-action-cell">
                            @if (priceTiersArray.length > 1) {
                              <button
                                type="button"
                                class="btn-del-tier-row"
                                (click)="removePriceTier(i)"
                                [title]="t('Remove Option', 'حذف هذا الخيار')"
                              >
                                🗑️
                              </button>
                            } @else {
                              <span class="del-disabled" [title]="t('At least one price tier is required', 'يلزم وجود مستوى سعر واحد على الأقل')">—</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                </div>

                <!-- Section 3: Clinical Description & Visibility -->
                <div class="modal-section-card">
                  <div class="section-card-title">
                    <span class="sec-num">3</span>
                    <span>{{ t('Clinical Notes & Visibility', 'الملاحظات الإكلينيكية وحالة التفعيل') }}</span>
                  </div>

                  <div class="form-grid-1">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Clinical Description / Materials Notes', 'وصف الإجراء أو ملاحظات الخامات والأدوات المستخدمة') }}</span>
                      </label>
                      <textarea
                        class="form-textarea"
                        rows="2"
                        formControlName="description"
                        [placeholder]="t('Add helpful clinical details, procedure steps, indications, or material recommendations…', 'أضف وصفاً توضيحياً للإجراء أو خطوات العلاج أو الخامات الموصى بها…')"
                      ></textarea>
                    </div>

                    <div class="status-toggle-box">
                      <label class="custom-toggle-label">
                        <input type="checkbox" formControlName="isActive" class="toggle-checkbox" />
                        <div class="toggle-switch-visual"></div>
                        <div class="toggle-texts">
                          <strong>{{ t('Active Procedure', 'إجراء مفعل ومتاح في العيادة') }}</strong>
                          <small>{{ t('When enabled, doctors can choose this treatment in dental charts and clinical treatment plans.', 'عند التفعيل، سيظهر هذا الإجراء في مخطط الأسنان وخطط العلاج للأطباء.') }}</small>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Modal Footer -->
              <div class="modal-footer">
                <button type="button" class="btn-secondary-action" (click)="closeModal()">
                  {{ t('Cancel', 'إلغاء') }}
                </button>
                <button
                  type="submit"
                  class="btn-primary-action"
                  [disabled]="saving() || form.invalid"
                >
                  @if (saving()) {
                    <span class="btn-spinner"></span>
                    <span>{{ t('Saving…', 'جارٍ الحفظ…') }}</span>
                  } @else {
                    <span>💾 {{ editingId() ? t('Update Treatment', 'حفظ التعديلات') : t('Save Treatment Type', 'حفظ نوع العلاج') }}</span>
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
  styleUrl: './treatments.scss',
})
export class TreatmentCatalogPageComponent implements OnInit {
  private readonly api = inject(TreatmentApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);

  readonly items = signal<ParsedCatalogItem[]>([]);
  readonly filteredItems = signal<ParsedCatalogItem[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly seeding = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly modalError = signal('');
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);

  searchQuery = '';
  categoryFilter = 'all';
  includeInactive = false;

  readonly form = this.fb.nonNullable.group({
    nameEn: ['', Validators.required],
    nameAr: ['', Validators.required],
    code: ['', Validators.required],
    type: [1, Validators.required],
    defaultPrice: [100, [Validators.required, Validators.min(0)]],
    description: [''],
    isActive: [true],
    priceTiers: this.fb.array<FormGroup>([]),
  });

  get priceTiersArray(): FormArray {
    return this.form.controls.priceTiers as FormArray;
  }

  ngOnInit() {
    this.loadCatalog();
  }

  loadCatalog() {
    this.loading.set(true);
    this.error.set('');
    this.api.catalog(this.includeInactive).subscribe({
      next: (data) => {
        const parsed = (data || []).map(parseCatalogItem);
        this.items.set(parsed);
        this.applyFilters();
        this.loading.set(false);

        // If completely empty and user has permissions, auto-seed defaults
        if (parsed.length === 0) {
          this.seedDefaults(true);
        }
      },
      error: (err: unknown) => {
        this.error.set(parseApiError(err, this.t('Failed to load treatment catalog.', 'تعذر تحميل جدول العلاجات.')));
        this.loading.set(false);
      },
    });
  }

  applyFilters() {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.categoryFilter;

    let res = this.items();
    if (cat !== 'all') {
      res = res.filter((x) => x.type === Number(cat));
    }

    if (q) {
      res = res.filter(
        (x) =>
          x.nameEn.toLowerCase().includes(q) ||
          x.nameAr.toLowerCase().includes(q) ||
          x.code.toLowerCase().includes(q) ||
          x.cleanDescription.toLowerCase().includes(q),
      );
    }

    this.filteredItems.set(res);
  }

  openAddModal() {
    this.editingId.set(null);
    this.modalError.set('');
    this.form.reset({
      nameEn: '',
      nameAr: '',
      code: '',
      type: 1,
      defaultPrice: 500,
      description: '',
      isActive: true,
    });
    this.priceTiersArray.clear();
    this.addPriceTier('Standard Base Price', 'السعر الأساسي', 500);
    this.showModal.set(true);
  }

  applyPreset(presetKey: 'filling' | 'rct' | 'extraction' | 'implant' | 'cleaning' | 'ortho') {
    const pMap: Record<string, DefaultTreatmentSeed> = {
      filling: DEFAULT_PROCEDURES[0],
      rct: DEFAULT_PROCEDURES[1],
      extraction: DEFAULT_PROCEDURES[2],
      implant: DEFAULT_PROCEDURES[3],
      ortho: DEFAULT_PROCEDURES[4],
      cleaning: DEFAULT_PROCEDURES[5],
    };

    const p = pMap[presetKey];
    if (!p) return;

    this.form.patchValue({
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      code: p.code,
      type: p.type,
      defaultPrice: p.defaultPrice,
      description: p.description,
      isActive: true,
    });

    this.priceTiersArray.clear();
    for (const tier of p.priceTiers) {
      this.addPriceTier(tier.nameEn, tier.nameAr, tier.price, tier.notes);
    }
  }

  openEditModal(item: ParsedCatalogItem) {
    this.editingId.set(item.id);
    this.modalError.set('');
    this.form.reset({
      nameEn: item.nameEn,
      nameAr: item.nameAr,
      code: item.code,
      type: item.type,
      defaultPrice: item.defaultPrice,
      description: item.cleanDescription,
      isActive: item.isActive,
    });

    this.priceTiersArray.clear();
    if (item.priceTiers && item.priceTiers.length) {
      for (const tier of item.priceTiers) {
        this.addPriceTier(tier.nameEn, tier.nameAr, tier.price, tier.notes);
      }
    } else {
      this.addPriceTier('Standard Price', 'السعر القياسي', item.defaultPrice);
    }

    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  addPriceTier(nameEn = '', nameAr = '', price = 0, notes = '') {
    const tierForm = this.fb.group({
      id: [String(Date.now() + Math.random())],
      nameEn: [nameEn, Validators.required],
      nameAr: [nameAr, Validators.required],
      price: [price, [Validators.required, Validators.min(0)]],
      notes: [notes],
    });
    this.priceTiersArray.push(tierForm);
  }

  removePriceTier(index: number) {
    if (this.priceTiersArray.length > 1) {
      this.priceTiersArray.removeAt(index);
    }
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.modalError.set('');
    this.success.set('');

    const v = this.form.getRawValue();
    const compoundName = `${v.nameEn.trim()} / ${v.nameAr.trim()}`;
    const priceTiers: PriceTier[] = (v.priceTiers as PriceTier[]).map((t, idx) => ({
      id: String(idx + 1),
      nameEn: (t.nameEn || '').trim(),
      nameAr: (t.nameAr || '').trim(),
      price: Number(t.price) || 0,
      notes: t.notes ? t.notes.trim() : undefined,
    }));

    // Store structured metadata in description payload
    const payloadDescription = JSON.stringify({
      nameEn: v.nameEn.trim(),
      nameAr: v.nameAr.trim(),
      description: v.description.trim(),
      priceTiers,
    });

    const catalogInput: CatalogItemInput = {
      type: Number(v.type),
      name: compoundName,
      code: v.code.trim().toUpperCase(),
      description: payloadDescription,
      defaultPrice: Number(v.defaultPrice) || 0,
      isActive: Boolean(v.isActive),
    };

    const editId = this.editingId();
    const req$: Observable<unknown> = editId
      ? this.api.updateCatalog(editId, catalogInput)
      : this.api.createCatalog(catalogInput);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.success.set(
          editId
            ? this.t('Treatment type updated successfully.', 'تم تحديث نوع العلاج بنجاح.')
            : this.t('Treatment type created successfully.', 'تمت إضافة نوع العلاج بنجاح.'),
        );
        this.loadCatalog();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.modalError.set(
          parseApiError(err, this.t('Failed to save treatment type.', 'تعذر حفظ نوع العلاج. يرجى مراجعة الحقول.')),
        );
      },
    });
  }

  deleteItem(item: ParsedCatalogItem) {
    const confirmMsg = this.t(
      `Are you sure you want to deactivate/delete treatment "${item.nameEn} / ${item.nameAr}"?`,
      `هل أنت متأكد من رغبتك في حذف/تعطيل علاج "${item.nameAr} / ${item.nameEn}"؟`,
    );

    if (!confirm(confirmMsg)) return;

    this.api.deleteCatalog(item.id).subscribe({
      next: () => {
        this.success.set(this.t('Treatment procedure removed.', 'تم حذف/تعطيل الإجراء العلاجي.'));
        this.loadCatalog();
      },
      error: (err: unknown) => {
        this.error.set(parseApiError(err, this.t('Failed to remove treatment.', 'تعذر حذف العلاج.')));
      },
    });
  }

  seedDefaults(silent = false) {
    if (this.seeding()) return;
    this.seeding.set(true);

    const existingCodes = new Set(this.items().map((x) => x.code.toUpperCase()));
    const missing = DEFAULT_PROCEDURES.filter((p) => !existingCodes.has(p.code.toUpperCase()));

    if (!missing.length) {
      this.seeding.set(false);
      if (!silent) {
        this.success.set(this.t('All core treatments are already in the catalog.', 'جميع العلاجات الأساسية متواجدة بالفعل بالجدول.'));
      }
      return;
    }

    let completed = 0;
    missing.forEach((p) => {
      const payloadDescription = JSON.stringify({
        nameEn: p.nameEn,
        nameAr: p.nameAr,
        description: p.description,
        priceTiers: p.priceTiers,
      });

      this.api
        .createCatalog({
          type: p.type,
          name: `${p.nameEn} / ${p.nameAr}`,
          code: p.code,
          description: payloadDescription,
          defaultPrice: p.defaultPrice,
          isActive: true,
        })
        .subscribe({
          next: () => {
            if (++completed === missing.length) {
              this.seeding.set(false);
              this.success.set(this.t('Core dental treatments initialized successfully!', 'تم إدراج وتجهيز العلاجات الأساسية الستة بنجاح!'));
              this.loadCatalog();
            }
          },
          error: () => {
            if (++completed === missing.length) {
              this.seeding.set(false);
              this.loadCatalog();
            }
          },
        });
    });
  }

  typeLabel(type: number): string {
    const ar = this.isArabic();
    switch (type) {
      case 1:
        return ar ? 'حشو أسنان' : 'Filling';
      case 2:
        return ar ? 'خلع أسنان' : 'Extraction';
      case 3:
        return ar ? 'زراعة أسنان' : 'Implant';
      case 4:
        return ar ? 'علاج عصب وجذور' : 'Root Canal';
      case 5:
        return ar ? 'تركيبات وتيجان' : 'Crown & Bridge';
      default:
        return ar ? 'أخرى (تقويم / تنظيف)' : 'Other / Preventive';
    }
  }

  isArabic(): boolean {
    return this.i18n.language() === 'ar';
  }

  t(en: string, ar: string): string {
    return this.isArabic() ? ar : en;
  }
}


