import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { parseApiError } from '../../core/error-util';
import { Medication, PrescriptionApiService } from './prescription-api.service';
import { medicationForm } from './prescription-labels';

export interface MedicationMetadata {
  nameAr?: string;
  nameEn?: string;
  defaultDose?: string;
  defaultFrequency?: string;
  defaultDuration?: string;
  defaultRoute?: string;
  defaultInstructions?: string;
  category?: string;
  clinicalNotes?: string;
}

export function parseMedicationNotes(notes?: string): MedicationMetadata {
  if (!notes) return {};
  try {
    if (notes.startsWith('{') && notes.endsWith('}')) {
      return JSON.parse(notes) as MedicationMetadata;
    }
  } catch {
    // fallback
  }
  return { clinicalNotes: notes };
}

export function serializeMedicationNotes(meta: MedicationMetadata): string {
  return JSON.stringify(meta);
}

@Component({
  selector: 'app-medication-catalog-page',
  standalone: true,
  imports: [RouterLink, FormsModule, ReactiveFormsModule],
  styleUrl: './prescriptions.scss',
  template: `
    <div class="medication-catalog-container">
      <!-- Top Breadcrumb & Page Header -->
      <header class="catalog-page-header">
        <div class="header-left">
          <div class="breadcrumb-trail">
            <a routerLink="/prescriptions">{{ t('Prescriptions', 'الوصفات والروشتات') }}</a>
            <span class="sep">/</span>
            <span class="current">{{ t('Medications Catalog & Dosages', 'دليل وجدول الأدوية والجرعات') }}</span>
          </div>
          <h1>💊 {{ t('Medications & Dosages Catalog', 'دليل وجدول الأدوية والجرعات الافتراضية') }}</h1>
          <p class="header-desc">
            {{
              t(
                'Manage medications directory with bilingual names, generic active ingredients, and default dosage regimens for instant 1-click prescription autofill.',
                'إدارة جدول ودليل الأدوية باللغتين العربية والإنجليزية، وتحديد الجرعات والتكرار والتعليمات الافتراضية ليتم إدراجها تلقائياً بضغطة زر عند كتابة الروشتة.'
              )
            }}
          </p>
        </div>

        <div class="header-actions">
          <button type="button" class="button secondary btn-seed" (click)="seedCoreMedications()" [disabled]="saving()">
            ✨ {{ t('Load Core Dental Medications', 'استيراد الأدوية الأساسية لطب الأسنان') }}
          </button>
          <button type="button" class="button primary btn-add-medication" (click)="openAddModal()">
            + {{ t('Add New Medication', 'إضافة دواء جديد') }}
          </button>
        </div>
      </header>

      <!-- Feedback Alerts -->
      @if (successMessage()) {
        <div class="alert success" role="alert">
          <span class="alert-icon">✅</span>
          <span>{{ successMessage() }}</span>
          <button class="alert-close" (click)="successMessage.set('')">✕</button>
        </div>
      }

      @if (errorMessage()) {
        <div class="alert error" role="alert">
          <span class="alert-icon">⚠️</span>
          <span>{{ errorMessage() }}</span>
          <button class="alert-close" (click)="errorMessage.set('')">✕</button>
        </div>
      }

      <!-- Metric Stats Bar -->
      <div class="catalog-stats-grid">
        <div class="stat-card">
          <span class="stat-icon">💊</span>
          <div>
            <span class="stat-num">{{ medications().length }}</span>
            <span class="stat-label">{{ t('Total Registered Drugs', 'إجمالي الأدوية المسجلة') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✨</span>
          <div>
            <span class="stat-num">{{ activeCount() }}</span>
            <span class="stat-label">{{ t('Active in Prescriptions', 'أدوية مفعلة في الروشتات') }}</span>
          </div>
        </div>
        <div class="stat-card">
          <span class="stat-icon">⚡</span>
          <div>
            <span class="stat-num">{{ autoFillReadyCount() }}</span>
            <span class="stat-label">{{ t('Auto-fill Ready', 'جاهزة للتعبئة الفورية بالجرعات') }}</span>
          </div>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="catalog-toolbar panel">
        <div class="toolbar-search-wrap">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            class="search-input"
            [(ngModel)]="searchQuery"
            (ngModelChange)="onFilterChanged()"
            [placeholder]="t('Search by brand name, Arabic name, or generic active ingredient…', 'ابحث بالاسم التجاري، الاسم بالعربي، أو المادة الفعالة…')"
          />
          @if (searchQuery) {
            <button class="clear-search-btn" (click)="searchQuery = ''; onFilterChanged()">✕</button>
          }
        </div>

        <div class="toolbar-filters">
          <select class="filter-select" [(ngModel)]="selectedFormFilter" (ngModelChange)="onFilterChanged()">
            <option [ngValue]="-1">{{ t('All Forms (الكل)', 'جميع الأشكال الصيدلية') }}</option>
            <option [ngValue]="1">💊 {{ t('Tablets (أقراص)', 'أقراص') }}</option>
            <option [ngValue]="2">💊 {{ t('Capsules (كبسولات)', 'كبسولات') }}</option>
            <option [ngValue]="3">🧪 {{ t('Syrup (شراب)', 'شراب') }}</option>
            <option [ngValue]="6">✨ {{ t('Mouthwash (مضمضة فموية)', 'مضمضة فموية') }}</option>
            <option [ngValue]="5">🩹 {{ t('Topical Gel (جل موضعي)', 'جل موضعي للثة') }}</option>
            <option [ngValue]="7">💉 {{ t('Injections (حقن)', 'حقن') }}</option>
            <option [ngValue]="8">📦 {{ t('Other (أخرى)', 'أخرى') }}</option>
          </select>

          <label class="active-only-toggle">
            <input type="checkbox" [(ngModel)]="includeInactive" (ngModelChange)="loadMedications()" />
            <span>{{ t('Show Inactive', 'عرض المعطل أيضاً') }}</span>
          </label>
        </div>
      </div>

      <!-- Main Medications Table -->
      <div class="panel catalog-table-panel">
        @if (loading()) {
          <div class="table-loading-state">
            <div class="spinner"></div>
            <p>{{ t('Loading medications catalog…', 'جارٍ تحميل جدول الأدوية…') }}</p>
          </div>
        } @else if (filteredMedications().length === 0) {
          <div class="empty-catalog-state">
            <div class="empty-icon">💊</div>
            <h3>{{ t('No medications found', 'لم يتم العثور على أدوية مطابقة') }}</h3>
            <p>{{ t('You can add medications manually or load the core dental medications directory.', 'يمكنك إضافة دواء جديد يدوياً أو استيراد الأدوية الأساسية لطب الأسنان بضغطة زر.') }}</p>
            <div class="empty-actions">
              <button class="button secondary" (click)="seedCoreMedications()">✨ {{ t('Load Core Medications', 'استيراد الأدوية الأساسية') }}</button>
              <button class="button primary" (click)="openAddModal()">+ {{ t('Add First Medication', 'إضافة أول دواء') }}</button>
            </div>
          </div>
        } @else {
          <div class="table-responsive">
            <table class="catalog-table">
              <thead>
                <tr>
                  <th style="width: 45px;">#</th>
                  <th>{{ t('Medication Name (AR / EN)', 'اسم الدواء (عربي / إنجليزي)') }}</th>
                  <th>{{ t('Generic Active Ingredient', 'المادة الفعالة') }}</th>
                  <th>{{ t('Form & Strength', 'النوع والتركيز') }}</th>
                  <th>{{ t('Default Dosage & Frequency', 'الجرعة والتكرار الافتراضي') }}</th>
                  <th>{{ t('Default Duration', 'المدة') }}</th>
                  <th>{{ t('Instructions & Notes', 'تعليمات الاستخدام') }}</th>
                  <th style="width: 90px;">{{ t('Status', 'الحالة') }}</th>
                  <th style="width: 140px; text-align: center;">{{ t('Actions', 'الإجراءات') }}</th>
                </tr>
              </thead>
              <tbody>
                @for (m of filteredMedications(); track m.id; let idx = $index) {
                  @let meta = getMedMeta(m);
                  <tr [class.inactive-row]="!m.isActive">
                    <td><span class="row-num">{{ idx + 1 }}</span></td>
                    
                    <!-- Names -->
                    <td>
                      <div class="med-name-cell">
                        <strong class="med-primary-name">{{ meta.nameAr || m.name }}</strong>
                        @if (meta.nameEn && meta.nameEn !== meta.nameAr) {
                          <span class="med-secondary-name">{{ meta.nameEn }}</span>
                        } @else if (m.name && m.name !== meta.nameAr) {
                          <span class="med-secondary-name">{{ m.name }}</span>
                        }
                      </div>
                    </td>

                    <!-- Generic Name -->
                    <td>
                      @if (m.genericName) {
                        <span class="generic-badge">{{ m.genericName }}</span>
                      } @else {
                        <span class="dim-dash">—</span>
                      }
                    </td>

                    <!-- Form & Strength -->
                    <td>
                      <div class="form-strength-wrap">
                        <span class="form-pill form-{{ m.form || 1 }}">
                          {{ getFormName(m.form) }}
                        </span>
                        @if (m.strength) {
                          <span class="strength-tag">{{ m.strength }}</span>
                        }
                      </div>
                    </td>

                    <!-- Default Dosage & Frequency -->
                    <td>
                      <div class="dosage-cell-wrap">
                        <strong class="dose-text">{{ meta.defaultDose || '1' }}</strong>
                        <span class="freq-text">{{ meta.defaultFrequency || t('As prescribed', 'حسب الإرشاد') }}</span>
                      </div>
                    </td>

                    <!-- Duration -->
                    <td>
                      @if (meta.defaultDuration) {
                        <span class="duration-badge">⏱️ {{ meta.defaultDuration }}</span>
                      } @else {
                        <span class="dim-dash">—</span>
                      }
                    </td>

                    <!-- Instructions -->
                    <td>
                      <p class="instructions-snippet" [title]="meta.defaultInstructions || ''">
                        {{ meta.defaultInstructions || '—' }}
                      </p>
                    </td>

                    <!-- Status -->
                    <td>
                      @if (m.isActive) {
                        <span class="status-badge active">{{ t('Active', 'مفعل') }}</span>
                      } @else {
                        <span class="status-badge inactive">{{ t('Inactive', 'معطل') }}</span>
                      }
                    </td>

                    <!-- Actions -->
                    <td>
                      <div class="actions-cell">
                        <button type="button" class="btn-action edit" (click)="openEditModal(m)" [title]="t('Edit Medication', 'تعديل الدواء')">
                          ✏️ {{ t('Edit', 'تعديل') }}
                        </button>
                        <button type="button" class="btn-action delete" (click)="deleteMedication(m)" [title]="t('Delete / Deactivate', 'حذف أو تعطيل')">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <!-- ── Add / Edit Medication Modal ── -->
      @if (showModal()) {
        <div class="modal-backdrop" (click)="closeModal()">
          <div class="modal-card modal-medication-card" (click)="$event.stopPropagation()">
            
            <header class="modal-header">
              <div class="header-title-wrap">
                <span class="modal-badge-icon">💊</span>
                <div>
                  <h3>{{ editingId() ? t('Edit Medication Details', 'تعديل بيانات الدواء والجرعات') : t('Add New Medication', 'إضافة دواء جديد للدليل') }}</h3>
                  <p class="modal-subtitle">
                    {{ t('Define bilingual names, form, and auto-prescribe dosage rules.', 'تحديد المسميات بالعربي والإنجليزي، والشكل الصيدلي، وإعدادات التعبئة التلقائية للروشتة.') }}
                  </p>
                </div>
              </div>
              <button type="button" class="close-btn" (click)="closeModal()" aria-label="Close">✕</button>
            </header>

            <form [formGroup]="form" (ngSubmit)="saveMedication()" class="catalog-modal-form">
              <div class="modal-body">
                
                @if (modalError()) {
                  <div class="alert error">
                    <span class="alert-icon">⚠️</span>
                    <span>{{ modalError() }}</span>
                  </div>
                }

                <!-- Quick Presets Bar -->
                @if (!editingId()) {
                  <div class="quick-presets-box">
                    <span class="preset-title">⚡ {{ t('Quick Presets:', 'نماذج سريعة شائعة:') }}</span>
                    <div class="presets-chips">
                      <button type="button" class="preset-chip" (click)="applyPreset('augmentin')">💊 أوجمنتين 1 جم (Augmentin)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('flagyl')">🩹 فلاجيل 500 (Flagyl)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('cataflam')">⚡ كتافلام 50 (Cataflam)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('brufen')">🩺 بروفين 600 (Brufen)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('panadol')">🧊 بنادول إكسترا (Panadol)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('hexitol')">✨ غسول هكستول (Mouthwash)</button>
                      <button type="button" class="preset-chip" (click)="applyPreset('gengigel')">🌿 جينجيجل للثة (Gengigel)</button>
                    </div>
                  </div>
                }

                <!-- Section 1: Drug Identification & Names -->
                <div class="modal-section-card">
                  <div class="section-card-title">
                    <span class="sec-num">1</span>
                    <strong>{{ t('Medication Names & Formulation', 'البيانات الأساسية والمسميات') }}</strong>
                  </div>

                  <div class="form-grid-2">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Name in Arabic', 'اسم الدواء بالعربي') }}</span>
                        <span class="lang-tag ar">AR</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input text-ar"
                        formControlName="nameAr"
                        [placeholder]="t('e.g. أوجمنتين 1 جم', 'مثال: أوجمنتين 1 جم أو كتافلام 50 مجم')"
                        [class.invalid]="form.controls.nameAr.touched && form.controls.nameAr.invalid"
                      />
                      @if (form.controls.nameAr.touched && form.controls.nameAr.invalid) {
                        <span class="field-error-msg">{{ t('Arabic name is required.', 'الاسم بالعربي مطلوب.') }}</span>
                      }
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Name in English', 'اسم الدواء بالإنجليزي (Commercial)') }}</span>
                        <span class="lang-tag en">EN</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input text-en"
                        formControlName="nameEn"
                        [placeholder]="t('e.g. Augmentin 1g or Cataflam 50mg', 'مثال: Augmentin 1g')"
                        [class.invalid]="form.controls.nameEn.touched && form.controls.nameEn.invalid"
                      />
                      @if (form.controls.nameEn.touched && form.controls.nameEn.invalid) {
                        <span class="field-error-msg">{{ t('English name is required.', 'الاسم بالإنجليزي مطلوب.') }}</span>
                      }
                    </div>
                  </div>

                  <div class="form-grid-3">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Generic Active Ingredient', 'المادة الفعالة (Generic)') }}</span>
                      </label>
                      <input
                        type="text"
                        class="form-input text-en"
                        formControlName="genericName"
                        [placeholder]="t('e.g. Amoxicillin / Clavulanic acid', 'مثال: Amoxicillin + Clavulanate')"
                      />
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Strength / Concentration', 'التركيز') }}</span>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="strength"
                        [placeholder]="t('e.g. 1000mg, 500mg, 0.12%', 'مثال: 1000 مجم / 500mg / 0.12%')"
                      />
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Form / Category', 'الشكل الصيدلي') }}</span>
                      </label>
                      <select class="form-select" formControlName="form">
                        <option [ngValue]="1">💊 {{ t('Tablets (أقراص)', 'أقراص') }}</option>
                        <option [ngValue]="2">💊 {{ t('Capsules (كبسولات)', 'كبسولات') }}</option>
                        <option [ngValue]="3">🧪 {{ t('Syrup (شراب)', 'شراب') }}</option>
                        <option [ngValue]="6">✨ {{ t('Mouthwash (مضمضة فموية)', 'مضمضة فموية') }}</option>
                        <option [ngValue]="5">🩹 {{ t('Topical Gel (جل موضعي)', 'جل موضعي للثة') }}</option>
                        <option [ngValue]="4">🧴 {{ t('Cream (كريم)', 'كريم') }}</option>
                        <option [ngValue]="7">💉 {{ t('Injections (حقن)', 'حقن') }}</option>
                        <option [ngValue]="8">📦 {{ t('Other (أخرى)', 'أخرى') }}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <!-- Section 2: Default Dosage & Auto-Prescribe Regimen -->
                <div class="modal-section-card">
                  <div class="section-card-title flex-between">
                    <div class="title-with-num">
                      <span class="sec-num">2</span>
                      <div>
                        <strong>{{ t('Default Dosage & Auto-fill Regimen', 'الجرعة والتكرار الافتراضي للروشتة') }}</strong>
                        <p class="section-hint">{{ t('These fields will be automatically filled into the prescription when this medicine is selected.', 'سيتم ملء هذه الحقول تلقائياً في الروشتة فور اختيار الطبيب لهذا الدواء.') }}</p>
                      </div>
                    </div>
                  </div>

                  <div class="form-grid-3">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Default Dose', 'الجرعة الافتراضية') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="defaultDose"
                        [placeholder]="t('e.g. قرص واحد (1 Tablet)', 'مثال: قرص واحد')"
                        [class.invalid]="form.controls.defaultDose.touched && form.controls.defaultDose.invalid"
                      />
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Default Frequency', 'التكرار الافتراضي') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="defaultFrequency"
                        [placeholder]="t('e.g. كل 12 ساعة بعد الأكل', 'مثال: كل 12 ساعة بعد الأكل أو 3 مرات يومياً')"
                        [class.invalid]="form.controls.defaultFrequency.touched && form.controls.defaultFrequency.invalid"
                      />
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Default Duration', 'المدة الافتراضية') }}</span>
                        <strong class="req">*</strong>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="defaultDuration"
                        [placeholder]="t('e.g. 7 أيام / 5 أيام', 'مثال: 5 أيام أو أسبوع')"
                        [class.invalid]="form.controls.defaultDuration.touched && form.controls.defaultDuration.invalid"
                      />
                    </div>
                  </div>

                  <div class="form-grid-2">
                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Route of Administration', 'طريقة الاستخدام') }}</span>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="defaultRoute"
                        [placeholder]="t('e.g. فموي (Oral) / موضعي (Topical)', 'مثال: فموي (Oral) أو مضمضة')"
                      />
                    </div>

                    <div class="field-item">
                      <label class="input-lbl">
                        <span>{{ t('Therapeutic Category', 'التصنيف الدوائي') }}</span>
                      </label>
                      <input
                        type="text"
                        class="form-input"
                        formControlName="category"
                        [placeholder]="t('e.g. Antibiotic, Analgesic, Anti-inflammatory', 'مثال: مضاد حيوي، مسكن ومضاد التهاب')"
                      />
                    </div>
                  </div>

                  <div class="field-item">
                    <label class="input-lbl">
                      <span>{{ t('Instructions & Patient Precautions', 'تعليمات الاستخدام والاحتياطات للمريض') }}</span>
                      <strong class="req">*</strong>
                    </label>
                    <input
                      type="text"
                      class="form-input"
                      formControlName="defaultInstructions"
                      [placeholder]="t('e.g. يؤخذ بعد الأكل مباشرة مع شرب كمية كافية من الماء', 'مثال: يؤخذ بعد الأكل مباشرة مع شرب كمية وفيرة من الماء، أو عدم بلع المضمضة')"
                      [class.invalid]="form.controls.defaultInstructions.touched && form.controls.defaultInstructions.invalid"
                    />
                  </div>
                </div>

                <!-- Section 3: Clinical Notes & Visibility -->
                <div class="modal-section-card">
                  <div class="section-card-title">
                    <span class="sec-num">3</span>
                    <strong>{{ t('Clinical Notes & Status', 'الملاحظات السريرية وحالة التفعيل') }}</strong>
                  </div>

                  <div class="field-item">
                    <label class="input-lbl">{{ t('Additional Clinical Notes / Warnings', 'ملاحظات إضافية أو تحذيرات طبية') }}</label>
                    <textarea
                      class="form-textarea"
                      rows="2"
                      formControlName="clinicalNotes"
                      [placeholder]="t('Contraindications, pregnancy alerts, renal dose adjustments…', 'موانع الاستخدام، تحذيرات الحمل، أو تعليمات خاصة…')"
                    ></textarea>
                  </div>

                  <div class="status-toggle-box">
                    <label class="custom-toggle-label">
                      <input type="checkbox" formControlName="isActive" class="toggle-checkbox" />
                      <span class="toggle-switch-visual"></span>
                      <div class="toggle-texts">
                        <strong>{{ t('Active in Prescriptions List', 'مفعل ومتاح للاختيار في الروشتات') }}</strong>
                        <small>{{ t('Doctors can instantly select this drug when writing prescriptions.', 'يظهر للأطباء عند تحرير الروشتات الطبية مع التعبئة التلقائية.') }}</small>
                      </div>
                    </label>
                  </div>
                </div>

              </div>

              <!-- Modal Footer -->
              <div class="modal-footer">
                <button type="button" class="btn-secondary-action" (click)="closeModal()">
                  {{ t('Cancel', 'إلغاء') }}
                </button>
                <button type="submit" class="btn-primary-action" [disabled]="saving() || form.invalid">
                  @if (saving()) {
                    <span class="btn-spinner"></span>
                    {{ t('Saving…', 'جارٍ الحفظ…') }}
                  } @else {
                    {{ editingId() ? t('Save Changes', 'حفظ التعديلات') : t('Save Medication', 'حفظ الدواء في الدليل') }}
                  }
                </button>
              </div>
            </form>

          </div>
        </div>
      }
    </div>
  `,
})
export class MedicationCatalogPageComponent implements OnInit {
  private readonly api = inject(PrescriptionApiService);
  private readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);

  readonly medications = signal<Medication[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showModal = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly modalError = signal('');
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  searchQuery = '';
  selectedFormFilter = -1;
  includeInactive = false;

  readonly form = this.fb.group({
    nameAr: ['', Validators.required],
    nameEn: ['', Validators.required],
    genericName: [''],
    strength: [''],
    form: [1, Validators.required],
    defaultDose: ['قرص واحد (1 Tab)', Validators.required],
    defaultFrequency: ['كل 12 ساعة بعد الأكل (Every 12 hrs)', Validators.required],
    defaultDuration: ['7 أيام (7 Days)', Validators.required],
    defaultRoute: ['فموي (Oral)'],
    defaultInstructions: ['يؤخذ بعد الأكل مع شرب كمية وفيرة من الماء', Validators.required],
    category: ['Antibiotic (مضاد حيوي)'],
    clinicalNotes: [''],
    isActive: [true],
  });

  ngOnInit() {
    this.loadMedications();
  }

  loadMedications() {
    this.loading.set(true);
    this.errorMessage.set('');
    this.api.medications('', undefined, this.includeInactive, 1, 100).subscribe({
      next: (res) => {
        this.medications.set(res.items ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err, this.t('Failed to load medications.', 'تعذر تحميل قائمة الأدوية.')));
        this.loading.set(false);
      },
    });
  }

  onFilterChanged() {
    // triggers signal re-computation in filteredMedications()
  }

  filteredMedications(): Medication[] {
    let list = this.medications();
    if (this.selectedFormFilter !== -1) {
      list = list.filter((m) => (m.form ?? 1) === this.selectedFormFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      list = list.filter((m) => {
        const meta = this.getMedMeta(m);
        return (
          m.name.toLowerCase().includes(q) ||
          (m.genericName && m.genericName.toLowerCase().includes(q)) ||
          (m.strength && m.strength.toLowerCase().includes(q)) ||
          (meta.nameAr && meta.nameAr.toLowerCase().includes(q)) ||
          (meta.nameEn && meta.nameEn.toLowerCase().includes(q)) ||
          (meta.category && meta.category.toLowerCase().includes(q))
        );
      });
    }
    return list;
  }

  activeCount(): number {
    return this.medications().filter((m) => m.isActive).length;
  }

  autoFillReadyCount(): number {
    return this.medications().filter((m) => {
      const meta = this.getMedMeta(m);
      return meta.defaultDose && meta.defaultFrequency;
    }).length;
  }

  getMedMeta(m: Medication): MedicationMetadata {
    return parseMedicationNotes(m.notes);
  }

  getFormName(f?: number): string {
    return medicationForm(f, this.i18n.language() === 'ar');
  }

  openAddModal() {
    this.editingId.set(null);
    this.modalError.set('');
    this.form.reset({
      nameAr: '',
      nameEn: '',
      genericName: '',
      strength: '',
      form: 1,
      defaultDose: 'قرص واحد (1 Tab)',
      defaultFrequency: 'كل 12 ساعة بعد الأكل (Every 12 hrs)',
      defaultDuration: '7 أيام (7 Days)',
      defaultRoute: 'فموي (Oral)',
      defaultInstructions: 'يؤخذ بعد الأكل مع شرب كمية وفيرة من الماء',
      category: 'Antibiotic (مضاد حيوي)',
      clinicalNotes: '',
      isActive: true,
    });
    this.showModal.set(true);
  }

  openEditModal(m: Medication) {
    this.editingId.set(m.id);
    this.modalError.set('');
    const meta = this.getMedMeta(m);

    this.form.setValue({
      nameAr: meta.nameAr || m.name,
      nameEn: meta.nameEn || m.name,
      genericName: m.genericName || '',
      strength: m.strength || '',
      form: m.form ?? 1,
      defaultDose: meta.defaultDose || '1',
      defaultFrequency: meta.defaultFrequency || 'Every 8 hours',
      defaultDuration: meta.defaultDuration || '5 days',
      defaultRoute: meta.defaultRoute || 'Oral',
      defaultInstructions: meta.defaultInstructions || 'After meals',
      category: meta.category || '',
      clinicalNotes: meta.clinicalNotes || '',
      isActive: m.isActive,
    });
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  applyPreset(presetKey: string) {
    const presets: Record<string, Partial<typeof this.form.value>> = {
      augmentin: {
        nameAr: 'أوجمنتين 1 جم',
        nameEn: 'Augmentin 1g',
        genericName: 'Amoxicillin + Clavulanic Acid',
        strength: '1000 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 12 ساعة بعد الأكل (Twice Daily)',
        defaultDuration: '7 أيام (7 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'يؤخذ بعد الطعام مباشرة مع كوب ماء وفير',
        category: 'Antibiotic (مضاد حيوي واسع المجال)',
      },
      flagyl: {
        nameAr: 'فلاجيل 500 مجم',
        nameEn: 'Flagyl 500mg',
        genericName: 'Metronidazole',
        strength: '500 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (3 times daily)',
        defaultDuration: '5-7 أيام (5-7 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'لعلاج التهابات وخراجات اللثة والأسنان اللاهوائية بعد الأكل',
        category: 'Antiprotozoal / Antibiotic (مضاد للعدوى اللاهوائية)',
      },
      cataflam: {
        nameAr: 'كتافلام 50 مجم',
        nameEn: 'Cataflam 50mg',
        genericName: 'Diclofenac Potassium',
        strength: '50 mg',
        form: 1,
        defaultDose: 'قرص واحد عند اللزوم (1 Tab PRN)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (Max 3/day)',
        defaultDuration: '3-5 أيام (3-5 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن سريع ومضاد للالتهاب بعد الأكل (لا يؤخذ على معدة فارغة)',
        category: 'NSAID / Analgesic (مسكن ومضاد للالتهاب والتورم)',
      },
      brufen: {
        nameAr: 'بروفين 600 مجم',
        nameEn: 'Brufen 600mg',
        genericName: 'Ibuprofen',
        strength: '600 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (Every 8 hrs)',
        defaultDuration: '5 أيام (5 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن قوي لآلام الأسنان وتورم اللثة بعد الأكل مباشرة',
        category: 'NSAID (مسكن للألم ومضاد للالتهاب)',
      },
      panadol: {
        nameAr: 'بنادول إكسترا',
        nameEn: 'Panadol Extra',
        genericName: 'Paracetamol + Caffeine',
        strength: '500mg / 65mg',
        form: 1,
        defaultDose: '1 - 2 قرص عند اللزوم',
        defaultFrequency: 'كل 6 - 8 ساعات (عند الحاجة)',
        defaultDuration: '3 - 5 أيام',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن آمن للألم وخافض للحرارة عند الشعور بالألم',
        category: 'Analgesic / Antipyretic (مسكن آمن وخافض حرارة)',
      },
      hexitol: {
        nameAr: 'غسول فم هكستول',
        nameEn: 'Hexitol Mouthwash',
        genericName: 'Chlorhexidine Gluconate',
        strength: '0.12%',
        form: 6,
        defaultDose: '15 مل مضمضة (15ml)',
        defaultFrequency: 'مرتين يومياً (صباحاً ومساءً)',
        defaultDuration: '10 - 14 يوماً',
        defaultRoute: 'مضمضة فموية (Oral Rinse)',
        defaultInstructions: 'مضمضة لمدة دقيقة كاملة بعد تنظيف الأسنان دون بلع، ولا يشرب بعدها لمدة 30 دقيقة',
        category: 'Antiseptic Mouthwash (مطهّر ومضاد للبكتيريا الفموية)',
      },
      gengigel: {
        nameAr: 'جينجيجل جل للثة',
        nameEn: 'Gengigel Gingival Gel',
        genericName: 'Hyaluronic Acid',
        strength: '0.2%',
        form: 5,
        defaultDose: 'طبقة رقيقة على اللثة الملتهبة',
        defaultFrequency: '3 - 4 مرات يومياً بعد الوجبات',
        defaultDuration: '7 - 10 أيام',
        defaultRoute: 'جل موضعي للثة (Topical Gel)',
        defaultInstructions: 'يوضع بأصبع نظيف أو قطنة على موضع الجرح أو اللثة الملتهبة بعد تنظيف الفم',
        category: 'Gingival Healing Gel (ملتئم ومرمم لأنسجة اللثة)',
      },
    };

    const target = presets[presetKey];
    if (target) {
      this.form.patchValue(target);
    }
  }

  saveMedication() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.saving.set(true);
    this.modalError.set('');

    const v = this.form.getRawValue();
    const meta: MedicationMetadata = {
      nameAr: v.nameAr?.trim(),
      nameEn: v.nameEn?.trim(),
      defaultDose: v.defaultDose?.trim(),
      defaultFrequency: v.defaultFrequency?.trim(),
      defaultDuration: v.defaultDuration?.trim(),
      defaultRoute: v.defaultRoute?.trim(),
      defaultInstructions: v.defaultInstructions?.trim(),
      category: v.category?.trim(),
      clinicalNotes: v.clinicalNotes?.trim(),
    };

    // Primary name stored is the bilingual compound or English name
    const primaryName = `${v.nameEn?.trim() || ''} (${v.nameAr?.trim() || ''})`.trim() || v.nameAr?.trim() || 'Medication';

    const payload = {
      name: primaryName,
      genericName: v.genericName?.trim() || undefined,
      strength: v.strength?.trim() || undefined,
      form: Number(v.form) || 1,
      notes: serializeMedicationNotes(meta),
      isActive: v.isActive ?? true,
    };

    const id = this.editingId();
    const handleSuccess = () => {
      this.saving.set(false);
      this.showModal.set(false);
      this.successMessage.set(
        id
          ? this.t('Medication updated successfully.', 'تم تحديث بيانات الدواء والجرعات بنجاح.')
          : this.t('Medication added to catalog successfully.', 'تمت إضافة الدواء إلى الدليل بنجاح.')
      );
      this.loadMedications();
    };
    const handleError = (err: unknown) => {
      this.saving.set(false);
      this.modalError.set(parseApiError(err, this.t('Failed to save medication.', 'تعذر حفظ الدواء. يرجى مراجعة البيانات.')));
    };

    if (id) {
      this.api.updateMedication(id, payload).subscribe({
        next: handleSuccess,
        error: handleError,
      });
    } else {
      this.api.createMedication(payload).subscribe({
        next: handleSuccess,
        error: handleError,
      });
    }
  }

  deleteMedication(m: Medication) {
    const meta = this.getMedMeta(m);
    const displayName = meta.nameAr || m.name;
    if (!confirm(this.t(`Are you sure you want to deactivate / remove "${displayName}"?`, `هل أنت متأكد من رغبتك في حذف أو تعطيل "${displayName}"؟`))) {
      return;
    }

    this.api.deleteMedication(m.id).subscribe({
      next: () => {
        this.successMessage.set(this.t('Medication deactivated successfully.', 'تم تعطيل / حذف الدواء بنجاح.'));
        this.loadMedications();
      },
      error: (err) => {
        this.errorMessage.set(parseApiError(err, this.t('Failed to deactivate medication.', 'تعذر حذف الدواء.')));
      },
    });
  }

  seedCoreMedications() {
    if (
      this.medications().length > 0 &&
      !confirm(
        this.t(
          'Load core dental medications directory (Augmentin, Flagyl, Cataflam, Brufen, Panadol, Mouthwash, Gel)?',
          'هل تريد استيراد الأدوية الأساسية لطب الأسنان بجرعاتها وتعليماتها الافتراضية؟'
        )
      )
    ) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set('');

    const coreDrugs: Array<{
      nameAr: string;
      nameEn: string;
      genericName: string;
      strength: string;
      form: number;
      defaultDose: string;
      defaultFrequency: string;
      defaultDuration: string;
      defaultRoute: string;
      defaultInstructions: string;
      category: string;
    }> = [
      {
        nameAr: 'أوجمنتين 1 جم',
        nameEn: 'Augmentin 1g',
        genericName: 'Amoxicillin + Clavulanic Acid',
        strength: '1000 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 12 ساعة بعد الأكل (Twice Daily)',
        defaultDuration: '7 أيام (7 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'يؤخذ بعد الطعام مباشرة مع كوب ماء وفير',
        category: 'Antibiotic (مضاد حيوي واسع المجال)',
      },
      {
        nameAr: 'فلاجيل 500 مجم',
        nameEn: 'Flagyl 500mg',
        genericName: 'Metronidazole',
        strength: '500 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (3 times daily)',
        defaultDuration: '5-7 أيام (5-7 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'لعلاج التهابات وخراجات اللثة والأسنان اللاهوائية بعد الأكل',
        category: 'Antiprotozoal / Antibiotic (مضاد للعدوى اللاهوائية)',
      },
      {
        nameAr: 'كتافلام 50 مجم',
        nameEn: 'Cataflam 50mg',
        genericName: 'Diclofenac Potassium',
        strength: '50 mg',
        form: 1,
        defaultDose: 'قرص واحد عند اللزوم (1 Tab PRN)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (Max 3/day)',
        defaultDuration: '3-5 أيام (3-5 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن سريع ومضاد للالتهاب بعد الأكل (لا يؤخذ على معدة فارغة)',
        category: 'NSAID / Analgesic (مسكن ومضاد للالتهاب والتورم)',
      },
      {
        nameAr: 'بروفين 600 مجم',
        nameEn: 'Brufen 600mg',
        genericName: 'Ibuprofen',
        strength: '600 mg',
        form: 1,
        defaultDose: 'قرص واحد (1 Tab)',
        defaultFrequency: 'كل 8 ساعات بعد الأكل (Every 8 hrs)',
        defaultDuration: '5 أيام (5 Days)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن قوي لآلام الأسنان وتورم اللثة بعد الأكل مباشرة',
        category: 'NSAID (مسكن للألم ومضاد للالتهاب)',
      },
      {
        nameAr: 'بنادول إكسترا',
        nameEn: 'Panadol Extra',
        genericName: 'Paracetamol + Caffeine',
        strength: '500mg / 65mg',
        form: 1,
        defaultDose: '1 - 2 قرص عند اللزوم',
        defaultFrequency: 'كل 6 - 8 ساعات (عند الحاجة)',
        defaultDuration: '3 - 5 أيام',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مسكن آمن للألم وخافض للحرارة عند الشعور بالألم',
        category: 'Analgesic / Antipyretic (مسكن آمن وخافض حرارة)',
      },
      {
        nameAr: 'غسول فم هكستول',
        nameEn: 'Hexitol Mouthwash',
        genericName: 'Chlorhexidine Gluconate',
        strength: '0.12%',
        form: 6,
        defaultDose: '15 مل مضمضة (15ml)',
        defaultFrequency: 'مرتين يومياً (صباحاً ومساءً)',
        defaultDuration: '10 - 14 يوماً',
        defaultRoute: 'مضمضة فموية (Oral Rinse)',
        defaultInstructions: 'مضمضة لمدة دقيقة كاملة بعد تنظيف الأسنان دون بلع، ولا يشرب بعدها لمدة 30 دقيقة',
        category: 'Antiseptic Mouthwash (مطهّر ومضاد للبكتيريا الفموية)',
      },
      {
        nameAr: 'جينجيجل جل للثة',
        nameEn: 'Gengigel Gingival Gel',
        genericName: 'Hyaluronic Acid',
        strength: '0.2%',
        form: 5,
        defaultDose: 'طبقة رقيقة على اللثة الملتهبة',
        defaultFrequency: '3 - 4 مرات يومياً بعد الوجبات',
        defaultDuration: '7 - 10 أيام',
        defaultRoute: 'جل موضعي للثة (Topical Gel)',
        defaultInstructions: 'يوضع بأصبع نظيف أو قطنة على موضع الجرح أو اللثة الملتهبة بعد تنظيف الفم',
        category: 'Gingival Healing Gel (ملتئم ومرمم لأنسجة اللثة)',
      },
      {
        nameAr: 'أوسكال 500 مجم',
        nameEn: 'Oscal 500mg + D3',
        genericName: 'Calcium Carbonate + Vitamin D3',
        strength: '500mg / 200IU',
        form: 1,
        defaultDose: 'قرص واحد يومياً (1 Tab)',
        defaultFrequency: 'مرة واحدة يومياً بعد وجبة الغداء',
        defaultDuration: '30 يوماً (1 Month)',
        defaultRoute: 'فموي (Oral)',
        defaultInstructions: 'مكمل غذائي داعم لصحة عظام الفك والأسنان بعد الأكل',
        category: 'Supplement / Bone Health (مكمل غذائي لصحة العظام)',
      },
    ];

    let pending = coreDrugs.length;
    let completed = 0;

    coreDrugs.forEach((d) => {
      const meta: MedicationMetadata = {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        defaultDose: d.defaultDose,
        defaultFrequency: d.defaultFrequency,
        defaultDuration: d.defaultDuration,
        defaultRoute: d.defaultRoute,
        defaultInstructions: d.defaultInstructions,
        category: d.category,
      };

      const payload = {
        name: `${d.nameEn} (${d.nameAr})`,
        genericName: d.genericName,
        strength: d.strength,
        form: d.form,
        notes: serializeMedicationNotes(meta),
        isActive: true,
      };

      this.api.createMedication(payload).subscribe({
        next: () => {
          completed++;
          if (completed >= pending) {
            this.saving.set(false);
            this.successMessage.set(this.t('Core dental medications imported successfully!', 'تم استيراد كافة أدوية طب الأسنان الأساسية والجرعات الافتراضية بنجاح!'));
            this.loadMedications();
          }
        },
        error: () => {
          completed++;
          if (completed >= pending) {
            this.saving.set(false);
            this.loadMedications();
          }
        },
      });
    });
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

