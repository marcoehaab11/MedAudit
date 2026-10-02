import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { parseApiError } from '../../core/error-util';
import { LocalizationService } from '../../core/localization.service';
import { AppointmentApiService, AppointmentDetails, AvailabilitySlot } from '../appointments/appointment-api.service';
import { PatientApiService, PatientDetails } from '../patients/patient-api.service';
import { COMMON_ALLERGIES, COMMON_CONDITIONS, COMMON_MEDICATIONS } from '../patients/patient-form.component';
import {
  CatalogItem,
  Treatment,
  TreatmentApiService,
  TreatmentPlanList,
  PlanItemInput,
  parseCatalogItem,
  ParsedCatalogItem,
  PriceTier,
} from '../treatments/treatment-api.service';
import { Medication, PrescriptionApiService } from '../prescriptions/prescription-api.service';
import { MedicationMetadata, parseMedicationNotes } from '../prescriptions/medication-catalog-page.component';
import { FinanceApiService, PatientBalance } from '../finance/finance-api.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE, SURFACES } from './dental-appearance';
import { DentalApiService, ExaminationDetails, ToothChartSummary } from './dental-api.service';
import { DentalChartComponent } from './dental-chart.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog.service';
import { TagInputComponent } from '../../shared/tag-input/tag-input.component';
import { PatientVisitHistorySheetComponent } from '../patients/patient-visit-history-sheet.component';

export interface DentalMedicationPreset {
  id?: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  genericName?: string;
  strength?: string;
  form?: number;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  category?: string;
}

export const CORE_DENTAL_MEDICATIONS: DentalMedicationPreset[] = [
  {
    name: 'أوجمنتين 1 جم (Augmentin 1g)',
    nameAr: 'أوجمنتين 1 جم',
    nameEn: 'Augmentin 1g',
    genericName: 'Amoxicillin + Clavulanic Acid',
    strength: '1000 mg',
    form: 1,
    dose: '1 قرص',
    frequency: 'كل 12 ساعة بعد الأكل',
    duration: '7 أيام',
    instructions: 'يؤخذ بعد الطعام مباشرة مع كوب ماء وفير',
    category: 'مضاد حيوي واسع المجال',
  },
  {
    name: 'فلاجيل 500 مجم (Flagyl 500mg)',
    nameAr: 'فلاجيل 500 مجم',
    nameEn: 'Flagyl 500mg',
    genericName: 'Metronidazole',
    strength: '500 mg',
    form: 1,
    dose: '1 قرص',
    frequency: 'كل 8 ساعات بعد الأكل',
    duration: '5-7 أيام',
    instructions: 'لعلاج التهابات وخراجات اللثة والأسنان اللاهوائية بعد الأكل',
    category: 'مضاد للعدوى اللاهوائية',
  },
  {
    name: 'كتافلام 50 مجم (Cataflam 50mg)',
    nameAr: 'كتافلام 50 مجم',
    nameEn: 'Cataflam 50mg',
    genericName: 'Diclofenac Potassium',
    strength: '50 mg',
    form: 1,
    dose: '1 قرص عند اللزوم',
    frequency: 'كل 8 ساعات بعد الأكل',
    duration: '3-5 أيام',
    instructions: 'مسكن سريع ومضاد للالتهاب بعد الأكل (لا يؤخذ على معدة فارغة)',
    category: 'مسكن ومضاد للالتهاب',
  },
  {
    name: 'بروفين 600 مجم (Brufen 600mg)',
    nameAr: 'بروفين 600 مجم',
    nameEn: 'Brufen 600mg',
    genericName: 'Ibuprofen',
    strength: '600 mg',
    form: 1,
    dose: '1 قرص',
    frequency: 'كل 8 ساعات بعد الأكل',
    duration: '3-5 أيام',
    instructions: 'مسكن ومضاد للتورم والالتهاب بعد الأكل',
    category: 'مسكن ومضاد للالتهاب',
  },
  {
    name: 'بنادول إكسترا (Panadol Extra)',
    nameAr: 'بنادول إكسترا',
    nameEn: 'Panadol Extra',
    genericName: 'Paracetamol + Caffeine',
    strength: '500mg / 65mg',
    form: 1,
    dose: '1-2 قرص عند اللزوم',
    frequency: 'كل 6-8 ساعات',
    duration: '3-5 أيام',
    instructions: 'مسكن آمن للألم وخافض للحرارة عند الشعور بالألم',
    category: 'مسكن وخافض حرارة',
  },
  {
    name: 'دالاسين سي 300 مجم (Dalacin C 300mg)',
    nameAr: 'دالاسين سي 300 مجم',
    nameEn: 'Dalacin C 300mg',
    genericName: 'Clindamycin',
    strength: '300 mg',
    form: 1,
    dose: '1 كبسولة',
    frequency: 'كل 8 ساعات',
    duration: '5-7 أيام',
    instructions: 'مضاد حيوي فعال - بديل لمرضى حساسية البنسلين',
    category: 'مضاد حيوي (بديل حساسية البنسلين)',
  },
  {
    name: 'غسول فم هكستول (Hexitol Mouthwash)',
    nameAr: 'غسول فم هكستول',
    nameEn: 'Hexitol Mouthwash',
    genericName: 'Chlorhexidine Gluconate',
    strength: '0.12%',
    form: 6,
    dose: '15 مل مضمضة',
    frequency: 'مرتين يومياً',
    duration: '7-10 أيام',
    instructions: 'مضمضة لمدة دقيقة كاملة وبصقها، تجنب الشرب بعدها لمدة 30 دقيقة',
    category: 'مطهّر ومضاد للبكتيريا الفموية',
  },
  {
    name: 'جينجيجل جل للثة (Gengigel Oral Gel)',
    nameAr: 'جينجيجل جل للثة',
    nameEn: 'Gengigel Oral Gel',
    genericName: 'Hyaluronic Acid',
    strength: '0.2%',
    form: 5,
    dose: 'كمية صغيرة بدهان موضعي',
    frequency: '3-4 مرات يومياً',
    duration: '7-10 أيام',
    instructions: 'دهان موضعي برفق على اللثة بعد تنظيف الفم لسرعة التئام الجروح',
    category: 'جل مرمم وملتئم للثة',
  },
  {
    name: 'ألفاكيموتريبسين (Alphintern)',
    nameAr: 'ألفاكيموتريبسين',
    nameEn: 'Alphintern',
    genericName: 'Chymotrypsin + Trypsin',
    strength: '300 MCU',
    form: 1,
    dose: '1-2 قرص',
    frequency: '3 مرات يومياً قبل الأكل بساعة',
    duration: '5-7 أيام',
    instructions: 'يؤخذ قبل الأكل بساعة أو بعده بساعتين لعلاج التورم والارتشاح',
    category: 'مضاد للتورم والارتشاح',
  },
  {
    name: 'أموكسيل 500 مجم (Amoxil 500mg)',
    nameAr: 'أموكسيل 500 مجم',
    nameEn: 'Amoxil 500mg',
    genericName: 'Amoxicillin',
    strength: '500 mg',
    form: 1,
    dose: '1 كبسولة',
    frequency: 'كل 8 ساعات',
    duration: '7 أيام',
    instructions: 'مضاد حيوي بعد الأكل بانتظام حتى اكتمال الجرعة',
    category: 'مضاد حيوي',
  },
];

export interface PrescribedMedicineRow {
  medicationId?: string;
  medicationName: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  isCustom?: boolean;
}

@Component({
  styleUrl: './dental.scss',
  selector: 'app-examination',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DentalChartComponent, TagInputComponent, PatientVisitHistorySheetComponent],
  template: `
    <div class="clinical-visit-container">
      <!-- Top Navigation & Back -->
      <div class="visit-top-bar">
        <a class="back-link" routerLink="/appointments">
          ← {{ t('Back to appointments', 'العودة إلى المواعيد') }}
        </a>
        <div class="top-bar-right-actions" style="display: flex; align-items: center; gap: 0.6rem;">
          @if (patient()) {
            <button
              type="button"
              class="btn-sheet-history"
              (click)="showVisitHistorySheet.set(true)"
              style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.8rem; background: #0284c7; color: #fff; border: none; border-radius: 0.45rem; font-size: 0.84rem; font-weight: 750; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.1);"
            >
              <span>📑</span>
              <span>{{ t('Past Visits Sheet (5 Stages)', 'ورقة السجل والزيارات السابقة (5 مراحل)') }}</span>
            </button>
          }
          <div class="top-status-badge">
            @if (examination()?.status === 2) {
              <span class="badge-completed">✓ {{ t('Visit Completed · Locked', 'زيارة مكتملة · مقفلة') }}</span>
            } @else {
              <span class="badge-active">● {{ t('Active Clinical Visit', 'جلسة كشف نشطة') }}</span>
            }
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="loading-state" role="status">
          <span class="spinner"></span>
          <p>{{ t('Opening clinical session…', 'جارٍ فتح الجلسة السريرية…') }}</p>
        </div>
      } @else if (error() && !examination() && !appointment()) {
        <div class="alert-box error" role="alert">
          <span class="alert-icon">⚠️</span>
          <span>{{ error() }}</span>
          <button type="button" class="btn-sm" (click)="load()">{{ t('Retry', 'إعادة المحاولة') }}</button>
        </div>
      } @else if (!examination() && appointment()) {
        @if (appointment()!.status === 5) {
          <!-- Completed Appointment Summary Card -->
          <section class="step-card completed-visit-card">
            <header class="patient-visit-banner completed-banner">
              <div class="patient-profile-snippet">
                <div class="patient-avatar">👤</div>
                <div class="patient-info">
                  <h1 class="patient-name">{{ appointment()!.patientName }}</h1>
                  <p class="patient-meta">
                    <span>👨‍⚕️ {{ appointment()!.doctorName }}</span>
                    @if (patient()?.phone) {
                      <span>📞 {{ patient()!.phone }}</span>
                    }
                  </p>
                </div>
              </div>

              <div class="visit-quick-stats">
                <div class="stat-pill success">
                  <span class="pill-icon">✓</span>
                  <span class="pill-text">{{ t('Session Completed & Locked', 'جلسة فحص وموعد مكتمل') }}</span>
                </div>
                @if (balance()) {
                  <div class="stat-pill neutral">
                    <span class="pill-icon">💳</span>
                    <span class="pill-text">{{ balance()!.outstanding }} EGP</span>
                  </div>
                }
              </div>
            </header>

            <div class="completed-summary-body">
              <div class="summary-details-grid">
                <div class="info-item">
                  <span class="label">{{ t('Appointment Date & Time', 'تاريخ ووقت الموعد') }}</span>
                  <strong>{{ dayLabel(localDate(appointment()!.startAt, appointment()!.timeZone)) }} · {{ time(appointment()!.startAt, appointment()!.timeZone) }}</strong>
                </div>
                <div class="info-item">
                  <span class="label">{{ t('Duration', 'المدة') }}</span>
                  <strong>{{ appointment()!.durationMinutes }} {{ t('minutes', 'دقيقة') }}</strong>
                </div>
                <div class="info-item">
                  <span class="label">{{ t('Status', 'الحالة') }}</span>
                  <span class="status-badge status-badge-5">{{ statusLabel(5) }}</span>
                </div>
              </div>

              @if (appointment()!.notes) {
                <div class="appointment-notes-box">
                  <h4>{{ t('Visit Notes', 'ملاحظات الموعد والزيارة') }}</h4>
                  <p>{{ appointment()!.notes }}</p>
                </div>
              }

              <!-- Executed treatments for this patient -->
              <div class="completed-treatments-section">
                <h3>⚡ {{ t('Executed Treatments & Procedures', 'الإجراءات والعلاجات المسجلة للمريض') }}</h3>
                @if (executedTreatments().length > 0) {
                  <table class="simple-table">
                    <thead>
                      <tr>
                        <th>{{ t('Procedure', 'الإجراء') }}</th>
                        <th>{{ t('Tooth', 'السن') }}</th>
                        <th>{{ t('Price', 'المبلغ') }}</th>
                        <th>{{ t('Status', 'الحالة') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (tr of executedTreatments(); track tr.id) {
                        <tr>
                          <td><strong>{{ tr.treatmentName }}</strong> @if (tr.notes) { <br><small>{{ tr.notes }}</small> }</td>
                          <td><span class="tooth-table-pill">{{ tr.toothNumbers && tr.toothNumbers.length ? '#' + tr.toothNumbers.join(', #') : '—' }}</span></td>
                          <td><strong>{{ tr.price }} EGP</strong></td>
                          <td><span class="status-tag done">{{ t('Completed', 'مكتمل ومرحل') }}</span></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <p class="empty-hint">{{ t('No treatments recorded for this patient.', 'لا توجد إجراءات مسجلة لهذا المريض.') }}</p>
                }
              </div>

              <div class="completed-actions-row">
                <a class="button secondary" [routerLink]="['/patients', appointment()!.patientId]">
                  👤 {{ t('View Full Patient Profile & Medical Chart', 'الانتقال لملف المريض ومخطط الأسنان الشامل') }} ➔
                </a>
                <a class="button" routerLink="/appointments">
                  📅 {{ t('Back to Appointments Schedule', 'العودة لجدول المواعيد') }}
                </a>
              </div>
            </div>
          </section>
        } @else if (appointment()!.status === 6 || appointment()!.status === 7) {
          <!-- Cancelled / No-show notice -->
          <section class="step-card intake-start-gate">
            <div class="gate-icon">⚠️</div>
            <div class="gate-content">
              <h2>{{ appointment()!.status === 6 ? t('Appointment Cancelled', 'موعد ملغي') : t('Patient No-Show', 'المريض لم يحضر') }}</h2>
              <p class="patient-highlight">
                <strong>{{ appointment()!.patientName }}</strong> · 👨‍⚕️ {{ appointment()!.doctorName }}
              </p>
              <div class="gate-notice-box">
                <span class="status-badge status-badge-{{ appointment()!.status }}">
                  {{ statusLabel(appointment()!.status) }}
                </span>
                <p>{{ t('This appointment is no longer active.', 'هذا الموعد غير نشط.') }}</p>
              </div>
              <a class="button secondary" routerLink="/appointments">
                📅 {{ t('Back to Appointments Schedule', 'العودة لجدول المواعيد') }}
              </a>
            </div>
          </section>
        } @else {
          <!-- Active Start Visit Gate Card -->
          <section class="step-card intake-start-gate">
            <div class="gate-icon">🏥</div>
            <div class="gate-content">
              <h2>{{ t('Start Clinical Visit Session', 'بدء الجلسة السريرية للمريض') }}</h2>
              <p class="patient-highlight">
                <strong>{{ appointment()!.patientName }}</strong> · 👨‍⚕️ {{ appointment()!.doctorName }}
              </p>
              <div class="gate-notice-box">
                <span class="status-badge status-badge-{{ appointment()!.status }}">
                  {{ statusLabel(appointment()!.status) }}
                </span>
                <p>
                  @if (appointment()!.status === 1) {
                    {{ t('This appointment is scheduled. Click below to confirm check-in and start the clinical examination.', 'هذا الموعد مجدول. اضغط بالأسفل لتأكيد الحضور وبدء مراحل الكشف فوراً.') }}
                  } @else if (appointment()!.status === 2) {
                    {{ t('This appointment is confirmed. Click below to check-in the patient and open the clinical visit.', 'هذا الموعد مؤكد. اضغط بالأسفل لتسجيل حضور المريض وفتح مراحل الكشف السريري.') }}
                  } @else if (appointment()!.status === 3) {
                    {{ t('The patient is checked in. Click below to start the clinical session.', 'المريض مسجل حضور بالعيادة. اضغط لبدء الجلسة السريرية فوراً.') }}
                  } @else {
                    {{ t('Click below to initialize the clinical examination.', 'اضغط بالأسفل لبدء الجلسة السريرية.') }}
                  }
                </p>
              </div>
              <button
                type="button"
                class="button primary lg btn-checkin-start"
                [disabled]="startingGate()"
                (click)="checkInAndStart()"
              >
                @if (startingGate()) {
                  <span class="spinner-sm"></span> {{ t('Starting session…', 'جارٍ بدء الجلسة…') }}
                } @else {
                  ▶ {{ t('Check-in & Open Clinical Visit', 'تسجيل الحضور وفتح مراحل الكشف السريري') }} ➔
                }
              </button>
            </div>
          </section>
        }
      } @else if (examination()) {
        <!-- Patient Banner -->
        <header class="patient-visit-banner">
          <div class="patient-profile-snippet">
            <div class="patient-avatar">👤</div>
            <div class="patient-info">
              <span class="patient-code">{{ examination()!.patientNumber }}</span>
              <h1 class="patient-name">{{ examination()!.patientName }}</h1>
              <p class="patient-meta">
                <span>👨‍⚕️ {{ examination()!.doctorName }}</span>
                @if (patient()?.phone) {
                  <span>📞 {{ patient()!.phone }}</span>
                }
                @if (patient()?.gender !== undefined) {
                  <span>{{ patient()!.gender === 1 ? t('Male', 'ذكر') : t('Female', 'أنثى') }}</span>
                }
              </p>
            </div>
          </div>

          <div class="visit-quick-stats">
            @if (hasMedicalAlerts()) {
              <button
                type="button"
                class="stat-pill-btn danger"
                (click)="openMedicalAlertModal()"
                [title]="t('Click to review critical medical alerts', 'اضغط لمراجعة التنبيهات الطبية والتحذيرات')"
              >
                <span class="pill-icon pulse-alert">🚨</span>
                <span class="pill-text">{{ totalAlertsCount() }} {{ t('Medical Alerts', 'تنبيهات طبية حرجة') }}</span>
                <span class="pill-badge-action">⚠️ {{ t('Review', 'مراجعة') }}</span>
              </button>
            }
            @if (balance()) {
              <div class="stat-pill balance" [class.has-debt]="balance()!.outstanding > 0">
                <span class="pill-icon">💳</span>
                <span class="pill-text">
                  {{ t('Balance Due:', 'المستحق:') }} <strong>{{ balance()!.outstanding }} {{ balance()!.currency }}</strong>
                </span>
              </div>
            }
          </div>
        </header>

        <!-- Stepper Navigation Bar -->
        <nav class="visit-stepper-nav" aria-label="Visit Steps">
          <div class="stepper-track">
            @for (s of steps; track s.number) {
              <button
                type="button"
                class="step-node"
                [class.active]="step() === s.number"
                [class.completed]="step() > s.number || examination()!.status === 2"
                (click)="setStep(s.number)"
              >
                <span class="step-num">{{ s.number }}</span>
                <div class="step-label-wrap">
                  <span class="step-icon">{{ s.icon }}</span>
                  <span class="step-title">{{ t(s.en, s.ar) }}</span>
                </div>
              </button>
            }
          </div>
        </nav>

        @if (error()) {
          <div class="alert-box error" role="alert">
            <span class="alert-icon">⚠️</span>
            <span>{{ error() }}</span>
            <button type="button" class="btn-sm" (click)="error.set('')">✕</button>
          </div>
        }
        @if (success()) {
          <div class="alert-box success" role="status">
            <span class="alert-icon">✓</span>
            <span>{{ success() }}</span>
            <button type="button" class="btn-sm" (click)="success.set('')">✕</button>
          </div>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 1: INTAKE & CHIEF COMPLAINT (الاستقبال والشكوى)            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 1) {
          <section class="step-card intake-card">
            <div class="step-header-row">
              <div class="step-header-title">
                <h2>📋 {{ t('1. Intake & Chief Complaint', '1. استقبال المريض والشكوى الأولية') }}</h2>
                <p>{{ t('Review medical alerts and document current visit reasons and general clinical notes.', 'مراجعة التنبيهات الطبية وتدوين سبب الزيارة وملاحظات الجلسة العامة.') }}</p>
              </div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                @if (patient()) {
                  <button
                    type="button"
                    class="button secondary"
                    (click)="showVisitHistorySheet.set(true)"
                    style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.84rem; font-weight: 750;"
                  >
                    <span>📑</span>
                    <span>{{ t('Past Visits Sheet (5 Stages)', 'ورقة السجل والزيارات السابقة (5 مراحل)') }}</span>
                  </button>
                }
                @if (appointment() && appointment()!.status === 3) {
                  <button type="button" class="btn-start-session" (click)="startSession()">
                    ▶ {{ t('Start Visit Timer', 'بدء وقت الجلسة الفعلي') }}
                  </button>
                }
              </div>
            </div>

            <!-- Medical History Cards Grid with Multi-Select Tags -->
            <div class="medical-alerts-grid">
              <div class="alert-card allergies-box">
                <div class="alert-card-head">
                  <span class="head-icon">⚠️</span>
                  <h3>{{ t('Allergies & Sensitivities', 'الحساسية والمحاذير') }}</h3>
                </div>
                <app-tag-input
                  [tags]="patientAllergies"
                  (tagsChange)="onAllergiesChange($event)"
                  theme="danger"
                  [placeholder]="t('Type an allergy and press Enter, or choose below…', 'اكتب الحساسية واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="allergySuggestions"
                ></app-tag-input>
              </div>

              <div class="alert-card conditions-box">
                <div class="alert-card-head">
                  <span class="head-icon">🩺</span>
                  <h3>{{ t('Chronic Medical Conditions', 'الأمراض والحالات المزمنة') }}</h3>
                </div>
                <app-tag-input
                  [tags]="patientConditions"
                  (tagsChange)="onConditionsChange($event)"
                  theme="warning"
                  [placeholder]="t('Type a condition and press Enter, or choose below…', 'اكتب الحالة واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="conditionSuggestions"
                ></app-tag-input>
              </div>

              <div class="alert-card medications-box">
                <div class="alert-card-head">
                  <span class="head-icon">💊</span>
                  <h3>{{ t('Current Patient Medications', 'الأدوية المستمرة للمريض') }}</h3>
                </div>
                <app-tag-input
                  [tags]="patientMedications"
                  (tagsChange)="onMedicationsChange($event)"
                  theme="info"
                  [placeholder]="t('Type a medication and press Enter, or choose below…', 'اكتب الدواء واضغط Enter، أو اختر أدناه…')"
                  [suggestions]="medicationSuggestions"
                ></app-tag-input>
              </div>
            </div>

            <!-- Notes & Complaint Editor -->
            <form [formGroup]="notesForm" (ngSubmit)="saveNotes()" class="intake-form">
              <label class="field-label">
                <span>{{ t('Visit Notes & Chief Complaint', 'شكوى المريض وملاحظات الكشف') }}</span>
                <textarea
                  rows="5"
                  formControlName="notes"
                  [placeholder]="t('Type patient complaint, symptoms, or visit notes…', 'اكتب شكوى المريض، الأعراض، أو الملاحظات العامة…')"
                  [readonly]="!examination()!.canEdit"
                ></textarea>
              </label>

              @if (examination()!.canEdit) {
                <div class="form-actions-inline">
                  <button type="submit" class="button secondary">
                    💾 {{ t('Save Notes Draft', 'حفظ ملاحظات المسودة') }}
                  </button>
                </div>
              }
            </form>

            <div class="step-footer-actions">
              <div></div>
              <button type="button" class="button primary next-btn" (click)="setStep(2)">
                {{ t('Next: Dental Chart Examination →', 'التالي: فحص ومخطط الأسنان ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 2: DENTAL CHART & FINDINGS (فحص مخطط الأسنان)              -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 2) {
          <section class="step-card chart-step-card">
            <div class="step-header-title">
              <h2>🦷 {{ t('2. Dental Chart & Clinical Examination', '2. فحص ومخطط الأسنان السريري') }}</h2>
              <p>{{ t('Select a tooth on the interactive chart to record findings, caries, surfaces, or endodontic canal measurements.', 'اختر السن من المخطط التفاعلي لتسجيل النتائج، التسوس، الأسطح، أو قياسات علاج الجذور.') }}</p>
            </div>

            <div class="dental-workspace exam">
              <div class="chart-wrapper">
                <app-dental-chart [teeth]="chartTeeth()" [(selectedNumber)]="selected" />
              </div>

              <aside class="tooth-details">
                <div class="selected-tooth-header">
                  <span class="tooth-badge">#{{ selected }}</span>
                  <h3>{{ t('Selected Tooth', 'السن المختار') }} #{{ selected }}</h3>
                </div>

                <nav class="clinical-tabs">
                  @for (item of tabs; track item.id) {
                    <button
                      type="button"
                      [class.active]="tab() === item.id"
                      (click)="tab.set(item.id)"
                    >
                      {{ t(item.en, item.ar) }}
                    </button>
                  }
                </nav>

                @switch (tab()) {
                  @case ('findings') {
                    <div class="record-stack">
                      @for (item of selectedFindings(); track item.id) {
                        <article>
                          <div>
                            <strong>{{ findingLabel(item.type) }}</strong>
                            <small>{{ surfaceLabels(item.surfaces) }}</small>
                            <p>{{ item.notes || '—' }}</p>
                          </div>
                          @if (examination()!.canEdit) {
                            <button type="button" class="danger-link" (click)="removeFinding(item.id)">
                              {{ t('Remove', 'حذف') }}
                            </button>
                          }
                        </article>
                      } @empty {
                        <p class="empty-hint">{{ t('No findings recorded for tooth #' + selected + '.', 'لا توجد نتائج مسجلة للسن #' + selected + '.') }}</p>
                      }
                    </div>

                    @if (examination()!.canEdit) {
                      <form [formGroup]="findingForm" (ngSubmit)="addFinding()" class="clinical-form">
                        <label>
                          {{ t('Finding Type', 'نوع المشكلة / النتيجة') }}
                          <select formControlName="type">
                            @for (item of findingOptions; track item.id) {
                              <option [value]="item.id">{{ t(item.en, item.ar) }}</option>
                            }
                          </select>
                        </label>
                        <fieldset>
                          <legend>{{ t('Affected Surfaces', 'الأسطح المصابة') }}</legend>
                          @for (surface of surfaces; track surface[0]) {
                            <label>
                              <input
                                type="checkbox"
                                [checked]="hasSurface('finding', surface[0])"
                                (change)="toggleSurface('finding', surface[0])"
                              />{{ t(surface[1], surface[2]) }}
                            </label>
                          }
                        </fieldset>
                        <label>
                          {{ t('Tooth Notes', 'ملاحظات السن') }}
                          <textarea formControlName="notes" maxlength="2000"></textarea>
                        </label>
                        <button type="submit" class="primary">+ {{ t('Add Finding', 'إضافة نتيجة') }}</button>
                      </form>
                    }
                  }
                  @case ('procedures') {
                    <div class="record-stack">
                      @for (item of selectedProcedures(); track item.id) {
                        <article>
                          <div>
                            <strong>{{ procedureLabel(item.type) }}</strong>
                            <small>{{ surfaceLabels(item.surfaces) }}</small>
                            <p>{{ item.notes || '—' }}</p>
                          </div>
                          @if (examination()!.canEdit) {
                            <button type="button" class="danger-link" (click)="removeProcedure(item.id)">
                              {{ t('Remove', 'حذف') }}
                            </button>
                          }
                        </article>
                      } @empty {
                        <p class="empty-hint">{{ t('No procedures recorded for tooth #' + selected + '.', 'لا توجد إجراءات مسجلة للسن #' + selected + '.') }}</p>
                      }
                    </div>

                    @if (examination()!.canEdit) {
                      <form [formGroup]="procedureForm" (ngSubmit)="addProcedure()" class="clinical-form">
                        <label>
                          {{ t('Procedure Type', 'نوع الإجراء السريري') }}
                          <select formControlName="type">
                            @for (item of procedureOptions; track item.id) {
                              <option [value]="item.id">{{ t(item.en, item.ar) }}</option>
                            }
                          </select>
                        </label>
                        <fieldset>
                          <legend>{{ t('Surfaces', 'الأسطح') }}</legend>
                          @for (surface of surfaces; track surface[0]) {
                            <label>
                              <input
                                type="checkbox"
                                [checked]="hasSurface('procedure', surface[0])"
                                (change)="toggleSurface('procedure', surface[0])"
                              />{{ t(surface[1], surface[2]) }}
                            </label>
                          }
                        </fieldset>
                        <label>
                          {{ t('Procedure notes', 'ملاحظات الإجراء') }}
                          <textarea formControlName="notes" maxlength="2000"></textarea>
                        </label>
                        <button type="submit" class="primary">+ {{ t('Record Procedure', 'تسجيل الإجراء') }}</button>
                      </form>
                    }
                  }
                  @case ('endodontic') {
                    <div class="record-stack">
                      @for (item of selectedEndodontic(); track item.id) {
                        <article>
                          <div>
                            <strong>{{ t('Root canal record', 'سجل علاج الجذور') }}</strong>
                            @for (canal of item.canals; track canal.id) {
                              <p>
                                <b>{{ canal.name }}</b> · {{ canal.lengthMm }} mm
                                <small>{{ canal.notes }}</small>
                              </p>
                            }
                            <p>{{ item.notes }}</p>
                          </div>
                          @if (examination()!.canEdit) {
                            <button type="button" class="danger-link" (click)="removeEndodontic(item.id)">
                              {{ t('Remove', 'حذف') }}
                            </button>
                          }
                        </article>
                      } @empty {
                        <p class="empty-hint">{{ t('No endodontic records for tooth #' + selected + '.', 'لا توجد بيانات علاج جذور للسن #' + selected + '.') }}</p>
                      }
                    </div>

                    @if (examination()!.canEdit) {
                      <form [formGroup]="endoForm" (ngSubmit)="addEndodontic()" class="clinical-form">
                        <label>
                          {{ t('Canals — one per line (name:length)', 'القنوات — قناة بكل سطر (الاسم:الطول)') }}
                          <textarea
                            formControlName="canals"
                            placeholder="MB:21&#10;ML:20&#10;D:19"
                          ></textarea>
                        </label>
                        <label>
                          {{ t('Endodontic notes', 'ملاحظات علاج الجذور') }}
                          <textarea formControlName="notes" maxlength="2000"></textarea>
                        </label>
                        <button type="submit" class="primary">+ {{ t('Add Endodontic Record', 'إضافة سجل جذور') }}</button>
                      </form>
                    }
                  }
                  @case ('notes') {
                    <form [formGroup]="notesForm" (ngSubmit)="saveNotes()" class="clinical-form">
                      <label>
                        {{ t('General Examination Notes', 'ملاحظات الفحص العامة') }}
                        <textarea
                          rows="8"
                          formControlName="notes"
                          maxlength="4000"
                          [readonly]="!examination()!.canEdit"
                        ></textarea>
                      </label>
                      @if (examination()!.canEdit) {
                        <button type="submit" class="primary">💾 {{ t('Save Draft Notes', 'حفظ ملاحظات المسودة') }}</button>
                      }
                    </form>
                  }
                }
              </aside>
            </div>

            <div class="step-footer-actions">
              <button type="button" class="button secondary prev-btn" (click)="setStep(1)">
                {{ t('← Previous: Intake', '⬅ السابق: الاستقبال') }}
              </button>
              <button type="button" class="button primary next-btn" (click)="setStep(3)">
                {{ t('Next: Procedures & Treatment Plan →', 'التالي: الإجراءات وخطة العلاج ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 3: PROCEDURES & TREATMENT PLAN (الإجراءات وخطة العلاج)    -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 3) {
          <section class="step-card procedures-plan-card">
            <div class="step-header-title">
              <h2>🛠️ {{ t('3. Procedures Done Today & Treatment Planning', '3. الإجراءات المنفذة وخطة العلاج') }}</h2>
              <p>{{ t('Click a tooth on the dental chart to view its diagnosis and execute procedures directly without typing tooth numbers.', 'اضغط على أي سن من مخطط الأسنان لعرض تشخيصه وتسجيل الإجراء العلاجي مباشرة دون الحاجة لكتابة رقم السن.') }}</p>
            </div>

            <!-- Split-View: Interactive Chart (Left) + Tooth Procedure Action Card (Right) -->
            <div class="step3-split-layout">
              <!-- Left: Dental Chart -->
              <div class="chart-col">
                <div class="chart-wrapper">
                  <app-dental-chart
                    [teeth]="chartTeeth()"
                    [multiSelect]="true"
                    [(selectedNumber)]="selected"
                    [(selectedTeeth)]="selectedTeeth"
                    (selectedNumberChange)="onSelectedToothChange($event)"
                    (selectedTeethChange)="onSelectedTeethChange($event)"
                  />
                </div>
              </div>

              <!-- Right: Tooth Action Card -->
              <aside class="tooth-action-col">
                <div class="tooth-action-card">
                  <!-- Selected Tooth Header -->
                  <div class="selected-tooth-banner">
                    <span class="tooth-pill">
                      @if (selectedTeeth.length <= 1) {
                        🦷 #{{ selected }}
                      } @else {
                        🦷 {{ selectedTeeth.length }} {{ t('Teeth', 'أسنان') }}
                      }
                    </span>
                    <div class="tooth-title-group">
                      @if (selectedTeeth.length <= 1) {
                        <h3>{{ t('Selected Tooth', 'السن المحدد') }} #{{ selected }}</h3>
                      } @else {
                        <h3>{{ t('Selected Teeth', 'الأسنان المحددة') }} ({{ selectedTeeth.length }}): {{ selectedTeethLabel() }}</h3>
                      }
                      <p>{{ t('Click teeth on chart to multi-select or toggle', 'انقر على الأسنان في المخطط لتحديد أكثر من سن معاً') }}</p>
                    </div>
                  </div>

                  <!-- 1. Findings & Diagnoses for this Tooth -->
                  <div class="tooth-section diagnoses-section">
                    <div class="section-label">
                      <span>🔍 {{ t('Diagnoses & Findings for ' + selectedTeethLabel(), 'التشخيصات المسجلة للأسنان ' + selectedTeethLabel()) }}</span>
                    </div>

                    <div class="findings-chips-stack">
                      @for (f of selectedToothFindings(); track f.id) {
                        <div class="finding-chip-card">
                          <span class="dot-indicator"></span>
                          <strong class="finding-title">{{ findingLabel(f.type) }}</strong>
                          @if (f.surfaces?.length) {
                            <span class="surface-badge">{{ surfaceLabels(f.surfaces) }}</span>
                          }
                          @if (f.notes) {
                            <span class="finding-notes">({{ f.notes }})</span>
                          }
                          @if (examination()!.canEdit) {
                            <button type="button" class="btn-remove-finding-mini" (click)="removeFinding(f.id)" title="{{ t('Remove finding', 'حذف التشخيص') }}">×</button>
                          }
                        </div>
                      } @empty {
                        <div class="empty-findings-box">
                          <p>{{ t('No diagnosis recorded for this selection yet.', 'لا يوجد تشخيص مسجل لهذه الأسنان حتى الآن.') }}</p>
                        </div>
                      }
                    </div>

                    <!-- Quick Add Diagnosis shortcuts if needed -->
                    @if (examination()!.canEdit) {
                      <div class="quick-add-finding-row">
                        <span class="quick-hint">{{ t('Quick Add Diagnosis (Applies to all selected):', 'إضافة تشخيص سريع (يطبق على الأسنان المحددة):') }}</span>
                        <div class="quick-finding-buttons">
                          <button type="button" class="btn-quick-finding caries" (click)="quickAddFinding(2)">+ {{ t('Caries', 'تسوس') }}</button>
                          <button type="button" class="btn-quick-finding fracture" (click)="quickAddFinding(3)">+ {{ t('Fracture', 'كسر') }}</button>
                          <button type="button" class="btn-quick-finding endo" (click)="quickAddFinding(4)">+ {{ t('Endo', 'عصب') }}</button>
                          <button type="button" class="btn-quick-finding missing" (click)="quickAddFinding(1)">+ {{ t('Missing', 'مفقود') }}</button>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- 2. Procedure Execution with Clinical Status -->
                  <div class="tooth-section procedure-select-section">
                    @if (examination()!.canEdit) {
                      <div class="catalog-select-box">
                        <label class="field-label procedure-select-label">
                          <span class="label-text">
                            <span>🦷 {{ t('Select Procedure / Service', 'اختر الإجراء أو الخدمة الطبية') }}</span>
                            <strong class="required-star">*</strong>
                          </span>
                          <select [(ngModel)]="selectedCatalogId" (change)="onCatalogSelectionChange()" class="styled-select-modern">
                            <option value="">-- {{ t('Choose from Clinic Price List…', 'اختر من قائمة أسعار وخدمات العيادة…') }} --</option>
                            @for (item of catalog(); track item.id) {
                              <option [value]="item.id">{{ item.name }} ({{ item.defaultPrice }} EGP)</option>
                            }
                          </select>
                        </label>

                        <!-- Price Tiers / Options from Price List -->
                        @if (currentParsedItem() && currentParsedItem()!.priceTiers.length > 0) {
                          <div class="price-tier-selection-block">
                            <div class="tier-block-header">
                              <span class="tier-badge-icon">🏷️</span>
                              <span class="tier-block-title">{{ t('Choose Price Tier / Category from Price List:', 'اختر فئة وسعر الإجراء من قائمة الأسعار:') }}</span>
                            </div>
                            <div class="price-tiers-grid-modern">
                              @for (tier of currentParsedItem()!.priceTiers; track tier.id) {
                                <div
                                  class="tier-modern-card"
                                  [class.selected]="selectedPriceTierId() === tier.id"
                                  (click)="selectPriceTier(tier)"
                                >
                                  <div class="tier-card-left">
                                    <span class="tier-radio-indicator"></span>
                                    <span class="tier-name-label">{{ t(tier.nameEn, tier.nameAr) }}</span>
                                  </div>
                                  <div class="tier-price-pill">
                                    <strong class="price-number">{{ tier.price }}</strong>
                                    <span class="price-currency">{{ t('EGP', 'ج.م') }}</span>
                                  </div>
                                </div>
                              }
                            </div>
                          </div>
                        }

                        <!-- Modern Pricing & Calculation Card -->
                        <div class="modern-pricing-card">
                          <div class="pricing-inputs-grid">
                            <div class="price-input-group">
                              <label class="group-label">
                                <span>{{ t('Price per Tooth', 'سعر السن الواحد') }}</span>
                              </label>
                              <div class="input-with-adornment">
                                <input
                                  type="number"
                                  min="0"
                                  [ngModel]="treatmentUnitPrice"
                                  (ngModelChange)="onUnitPriceChange($event)"
                                  class="field-input"
                                  [placeholder]="t('Unit Price', 'السعر')"
                                />
                                <span class="input-currency-adornment">{{ t('EGP', 'ج.م') }}</span>
                              </div>
                            </div>

                            <div class="price-input-group">
                              <label class="group-label">
                                <span>{{ t('Total Calculated Price', 'إجمالي المبلغ المطلوب') }}</span>
                              </label>
                              <div class="input-with-adornment total-highlight">
                                <input
                                  type="number"
                                  min="0"
                                  [(ngModel)]="treatmentPrice"
                                  class="field-input total-input"
                                  [placeholder]="t('Total Price', 'الإجمالي')"
                                />
                                <span class="input-currency-adornment">{{ t('EGP', 'ج.م') }}</span>
                              </div>
                            </div>
                          </div>

                          @if (selectedTeeth.length > 1) {
                            <div class="calculation-formula-ribbon">
                              <div class="formula-chips">
                                <span class="chip-count">🦷 {{ selectedTeeth.length }} {{ t('teeth selected', 'أسنان محددة') }}</span>
                                <span class="chip-times">×</span>
                                <span class="chip-unit">{{ treatmentUnitPrice }} {{ t('EGP', 'ج.م') }}</span>
                                <span class="chip-equals">=</span>
                                <strong class="chip-result">{{ treatmentPrice }} {{ t('EGP', 'ج.م') }}</strong>
                              </div>
                              <span class="formula-teeth-list">({{ selectedTeethLabel() }})</span>
                            </div>
                          }
                        </div>

                        <!-- Clinical Treatment Status Selector (خَلَصْ vs بدأ العلاج ولسه هنكمل) -->
                        <div class="clinical-status-selector-box">
                          <span class="status-selector-label">🎯 {{ t('Treatment Clinical Status:', 'حالة العلاج السريرية لهذا الإجراء:') }}</span>
                          <div class="clinical-status-pills">
                            <button
                              type="button"
                              class="btn-status-pill completed"
                              [class.active]="clinicalStatus === 'completed'"
                              (click)="clinicalStatus = 'completed'"
                            >
                              <span class="status-dot"></span>
                              <span class="status-title">🟢 {{ t('Finished Today (Completed)', 'خَلَصْ (تم الانتهاء بالكامل اليوم)') }}</span>
                            </button>
                            <button
                              type="button"
                              class="btn-status-pill in-progress"
                              [class.active]="clinicalStatus === 'in_progress'"
                              (click)="clinicalStatus = 'in_progress'"
                            >
                              <span class="status-dot"></span>
                              <span class="status-title">🟡 {{ t('Started - Needs Next Visit', 'بدأ العلاج ولسه هنكمل (قيد المتابعة)') }}</span>
                            </button>
                          </div>

                          @if (clinicalStatus === 'in_progress') {
                            <div class="remaining-work-input-row">
                              <label class="group-label">
                                <span>⏳ {{ t('Remaining Work to be Completed Next:', 'العمل المتبقي لاستكمال العلاج في الموعد القادم:') }}</span>
                              </label>
                              <input
                                type="text"
                                [(ngModel)]="remainingWorkDescription"
                                class="field-input-remaining"
                                [placeholder]="t('e.g. Crown fitting / Final root canal filling', 'مثال: متبقي تركيب التاج النهائي أو حشو العصب النهائي')"
                              />
                            </div>
                          }
                        </div>

                        <!-- Procedure Notes -->
                        <div class="procedure-notes-group">
                          <label class="group-label">
                            <span>📝 {{ t('Procedure Notes & Description (Optional)', 'ملاحظات وتفاصيل الإجراء (اختياري)') }}</span>
                          </label>
                          <input
                            type="text"
                            [(ngModel)]="treatmentNotes"
                            class="field-input-notes"
                            [placeholder]="t('e.g. Tooth restored / Clinical notes', 'مثال: تفاصيل الإجراء أو المواد المستخدمة')"
                          />
                        </div>

                        <!-- Modern Execute Button -->
                        <button
                          type="button"
                          class="btn-execute-procedure-modern"
                          [class.in-progress-btn]="clinicalStatus === 'in_progress'"
                          [disabled]="!selectedCatalogId || savingTreatment()"
                          (click)="recordTreatmentForSelectedTooth()"
                        >
                          @if (savingTreatment()) {
                            <span class="spinner-sm"></span> {{ t('Saving & Billing to Patient Account…', 'جارٍ الترحيل والحفظ للحساب…') }}
                          } @else {
                            @if (clinicalStatus === 'completed') {
                              <span class="btn-icon">⚡</span>
                              <span class="btn-main-text">
                                {{ t('Execute & Bill for ' + selectedTeethLabel() + ' (Finished Today)', 'تنفيذ وترحيل إجراء ' + selectedTeethLabel() + ' — منجز بالكامل (خَلَصْ)') }}
                              </span>
                            } @else {
                              <span class="btn-icon">⏳</span>
                              <span class="btn-main-text">
                                {{ t('Start & Bill for ' + selectedTeethLabel() + ' (In Progress - To be continued)', 'بدء وترحيل إجراء ' + selectedTeethLabel() + ' — بدأ العلاج ولسه هنكمل') }}
                              </span>
                            }
                            @if (treatmentPrice > 0) {
                              <span class="btn-price-badge">({{ treatmentPrice }} {{ t('EGP', 'ج.م') }})</span>
                            }
                            <span class="btn-arrow">➔</span>
                          }
                        </button>
                      </div>
                    }
                  </div>
                </div>
              </aside>
            </div>

            <!-- Bottom Section: Executed Treatments Table & Active Treatment Plans -->
            <div class="procedures-single-layout" style="margin-top: 1.5rem;">
              <!-- Executed Treatments List -->
              <div class="panel-box done-today-box">
                <div class="box-header">
                  <h3>⚡ {{ t('Procedures Executed in Today Session (Billed)', 'الإجراءات المنفذة في جلسة اليوم (المفوترة والمرحلة للحساب)') }}</h3>
                  <span class="today-total-tag">{{ todayProceduresTotal() }} EGP</span>
                </div>

                <div class="executed-list-wrap">
                  @if (executedTreatments().length > 0) {
                    <table class="simple-table">
                      <thead>
                        <tr>
                          <th>{{ t('Procedure', 'الإجراء') }}</th>
                          <th>{{ t('Tooth', 'السن') }}</th>
                          <th>{{ t('Price', 'المبلغ') }}</th>
                          <th>{{ t('Status', 'الحالة') }}</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (tr of executedTreatments(); track tr.id) {
                          <tr>
                            <td><strong>{{ tr.treatmentName }}</strong> @if (tr.notes) { <br><small>{{ tr.notes }}</small> }</td>
                            <td><span class="tooth-table-pill">{{ tr.toothNumbers && tr.toothNumbers.length ? '#' + tr.toothNumbers.join(', #') : '—' }}</span></td>
                            <td><strong>{{ tr.price }} EGP</strong></td>
                            <td>
                              @if (tr.status === 4) {
                                <span class="status-tag done">✓ {{ t('Finished (Completed)', 'خَلَصْ (مكتمل بالكامل)') }}</span>
                              } @else if (tr.status === 3) {
                                <span class="status-tag active">⏳ {{ t('Started (In Progress)', 'بدأ العلاج ولسه هنكمل') }}</span>
                              } @else {
                                <span class="status-tag">{{ tr.status }}</span>
                              }
                            </td>
                          </tr>

                        }
                      </tbody>
                    </table>
                  } @else {
                    <p class="empty-hint">{{ t('No treatments recorded yet in this session. Select teeth and procedure above.', 'لم يتم تسجيل إجراءات في هذه الجلسة بعد. اختر الأسنان والإجراء بالأعلى للتنفيذ.') }}</p>
                  }
                </div>
              </div>

              <!-- Active Treatment Plans Table -->
              @if (treatmentPlans().length > 0) {
                <div class="active-plans-box">
                  <div class="box-header">
                    <h3>📋 {{ t('Patient Treatment Plans & Ongoing Work', 'خطط علاج المريض والجلسات المتبقية') }}</h3>
                    <span class="plans-count-badge">{{ treatmentPlans().length }} {{ t('plan(s)', 'خطة علاج') }}</span>
                  </div>
                  <table class="simple-table">
                    <thead>
                      <tr>
                        <th>{{ t('Plan Title', 'اسم الخطة') }}</th>
                        <th>{{ t('Total Cost', 'إجمالي التكلفة') }}</th>
                        <th>{{ t('Status', 'الحالة') }}</th>
                        <th>{{ t('Created Date', 'تاريخ الإنشاء') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (plan of treatmentPlans(); track plan.id) {
                        <tr>
                          <td><strong>{{ plan.title }}</strong></td>
                          <td><strong>{{ plan.total }} EGP</strong></td>
                          <td>
                            @if (plan.status === 1) {
                              <span class="status-tag active">⏳ {{ t('In Progress', 'جارية / قيد التنفيذ') }}</span>
                            } @else if (plan.status === 2) {
                              <span class="status-tag done">✓ {{ t('Completed', 'مكتملة') }}</span>
                            } @else {
                              <span class="status-tag">{{ plan.status }}</span>
                            }
                          </td>
                          <td>{{ plan.createdAt | date: 'dd/MM/yyyy' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>

            <div class="step-footer-actions">
              <button type="button" class="button secondary prev-btn" (click)="setStep(2)">
                {{ t('← Previous: Dental Chart', '⬅ السابق: مخطط الأسنان') }}
              </button>
              <button type="button" class="button primary next-btn" (click)="setStep(4)">
                {{ t('Next: Prescription & Rx →', 'التالي: الوصفة الطبية ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 4: PRESCRIPTION & INSTRUCTIONS (الروشتة الطبية)            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 4) {
          <section class="step-card rx-card">
            <div class="step-header-title">
              <h2>💊 {{ t('4. Medical Prescription & Patient Instructions', '4. الوصفة الطبية وتعليمات المريض') }}</h2>
              <p>{{ t('Prescribe medications with clear dosages, frequency, duration, and post-treatment precautions.', 'تحرير الأدوية والجرعات وتعليمات ما بعد العلاج للمريض.') }}</p>
            </div>

            <!-- Rx Form -->
            <div class="rx-builder-layout">
              <div class="rx-items-editor">
                <div class="rx-table-header">
                  <div class="rx-header-text">
                    <h3>{{ t('Prescribed Medications', 'قائمة الأدوية الموصوفة') }}</h3>
                    <p class="rx-header-sub">{{ t('Choose from the common medications list or type custom medications.', 'اختر من قائمة الأدوية الشائعة أو اكتب أي دواء مخصص مع تعبئة الجرعات تلقائياً.') }}</p>
                  </div>
                  <button type="button" class="button btn-add-med" (click)="addMedicineRow()">
                    + {{ t('Add Medication', 'إضافة دواء جديد') }}
                  </button>
                </div>

                <!-- Quick Presets Bar -->
                <div class="rx-quick-presets-panel">
                  <div class="quick-presets-header">
                    <span class="quick-presets-icon">⚡</span>
                    <span class="quick-presets-title">{{ t('Quick Add Common Dental Medications:', 'إضافة سريعة بالأدوية الشائعة لطب الأسنان:') }}</span>
                  </div>
                  <div class="quick-chips-wrapper">
                    @for (preset of quickDentalPresets; track preset.name) {
                      <button
                        type="button"
                        class="quick-med-chip"
                        (click)="addMedicationPreset(preset)"
                        [title]="preset.instructions"
                      >
                        <span class="chip-plus">+</span>
                        <span class="chip-name">{{ t(preset.nameEn || preset.name, preset.nameAr || preset.name) }}</span>
                        @if (preset.strength) {
                          <span class="chip-strength">({{ preset.strength }})</span>
                        }
                      </button>
                    }
                  </div>
                </div>

                @for (med of prescriptionItems; track $index) {
                  <div class="med-item-card">
                    <div class="med-card-header">
                      <div class="med-header-title-group">
                        <span class="med-index">#{{ $index + 1 }}</span>
                        @if (med.medicationName) {
                          <span class="med-selected-badge">{{ med.medicationName }}</span>
                        }
                      </div>
                      <button type="button" class="btn-remove-med" (click)="removeMedicineRow($index)" [title]="t('Remove', 'حذف')">✕</button>
                    </div>

                    <div class="med-fields-grid">
                      <div class="field-label med-name-field">
                        <div class="med-label-header">
                          <span>{{ t('Medication Name', 'اسم الدواء') }}</span>
                          @if (!med.isCustom) {
                            <button
                              type="button"
                              class="btn-toggle-med-mode"
                              (click)="toggleCustomMed(med, true)"
                              [title]="t('Type custom medication name', 'كتابة اسم دواء مخصص يدوياً')"
                            >
                              ✏️ {{ t('Type custom', 'كتابة يدوية') }}
                            </button>
                          } @else {
                            <button
                              type="button"
                              class="btn-toggle-med-mode"
                              (click)="toggleCustomMed(med, false)"
                              [title]="t('Choose from registered medications list', 'اختيار من قائمة الأدوية')"
                            >
                              📋 {{ t('Choose from list', 'اختر من القائمة') }}
                            </button>
                          }
                        </div>
                        
                        @if (!med.isCustom) {
                          <select
                            class="med-select-dropdown"
                            [ngModel]="med.medicationName"
                            (ngModelChange)="onMedDropdownSelect($index, $event)"
                            [title]="t('Choose from medications list', 'اختر من قائمة الأدوية للتعبئة الفورية')"
                          >
                            <option value="">{{ t('— Choose from medications list… —', '— اختر من قائمة الأدوية للتعبئة التلقائية —') }}</option>
                            <optgroup [label]="t('Common Dental Medications', 'أدوية الأسنان الشائعة')">
                              @for (item of quickDentalPresets; track item.name) {
                                <option [value]="t(item.nameEn || item.name, item.nameAr || item.name)">
                                  {{ t(item.nameEn || item.name, item.nameAr || item.name) }} {{ item.strength ? '(' + item.strength + ')' : '' }}
                                </option>
                              }
                            </optgroup>
                            @if (catalogMedications().length > 0) {
                              <optgroup [label]="t('Clinic Catalog Medications', 'دليل أدوية العيادة المسجلة')">
                                @for (item of catalogMedications(); track item.id) {
                                  <option [value]="getCatalogMedDisplayName(item)">
                                    {{ getCatalogMedDisplayName(item) }}
                                  </option>
                                }
                              </optgroup>
                            }
                            <option value="__custom__">✍️ {{ t('Other medication (type custom)…', 'دواء آخر (كتابة يدوية مخصصة)…') }}</option>
                          </select>
                        } @else {
                          <div class="med-input-with-datalist">
                            <input
                              type="text"
                              class="med-text-input"
                              [(ngModel)]="med.medicationName"
                              [attr.list]="'med-datalist-' + $index"
                              (input)="onMedNameInput($index)"
                              (change)="onMedNameInput($index)"
                              [placeholder]="t('Type medication name…', 'اكتب اسم الدواء…')"
                            />
                            <datalist [id]="'med-datalist-' + $index">
                              @for (item of allAvailableMedications(); track item.name) {
                                <option [value]="t(item.nameEn || item.name, item.nameAr || item.name)">
                                  {{ item.genericName ? '(' + item.genericName + ')' : '' }} {{ item.dose }}
                                </option>
                              }
                            </datalist>
                          </div>
                        }
                      </div>

                      <label class="field-label">
                        <span>{{ t('Dose', 'الجرعة') }}</span>
                        <input type="text" [(ngModel)]="med.dose" [placeholder]="t('e.g. 1 Tablet', 'مثال: 1 قرص')" />
                      </label>

                      <label class="field-label">
                        <span>{{ t('Frequency', 'التكرار') }}</span>
                        <input type="text" [(ngModel)]="med.frequency" [placeholder]="t('e.g. Every 12 hours', 'مثال: كل 12 ساعة')" />
                      </label>

                      <label class="field-label">
                        <span>{{ t('Duration', 'المدة') }}</span>
                        <input type="text" [(ngModel)]="med.duration" [placeholder]="t('e.g. 5 days', 'مثال: 5 أيام')" />
                      </label>
                    </div>

                    <label class="field-label instructions-field">
                      <span>{{ t('Instructions & Notes', 'تعليمات الاستخدام') }}</span>
                      <input type="text" [(ngModel)]="med.instructions" [placeholder]="t('e.g. Take after meals with a full glass of water', 'مثال: يؤخذ بعد الأكل مع كوب ماء كامل')" />
                    </label>
                  </div>
                }

                @if (prescriptionItems.length === 0) {
                  <p class="empty-hint">{{ t('No medications added yet. Click "+ Add Medication" above or pick a medication chip.', 'لم يتم إضافة أدوية بعد. اضغط على "+ إضافة دواء" أعلاه أو اختر من الأدوية الشائعة.') }}</p>
                }

                <!-- Post Care Instructions -->
                <div class="post-care-wrap">
                  <label class="field-label">
                    <span>{{ t('General Advice & Post-Care Instructions', 'نصائح وإرشادات عامة للمريض') }}</span>
                    <textarea
                      rows="3"
                      [(ngModel)]="prescriptionGeneralNotes"
                      [placeholder]="t('e.g. Avoid hard food on the treated side for 2 hours. Rinse with warm salt water.', 'مثال: تجنب المضغ على الجانب المعالج لمدة ساعتين. المضمضة بماء دافئ وملح.')"
                    ></textarea>
                  </label>
                </div>

                @if (prescriptionItems.length > 0) {
                  <div class="rx-save-row">
                    <button type="button" class="button primary" [disabled]="savingRx()" (click)="savePrescriptionDraft()">
                      💾 {{ t('Save Prescription to Patient Record', 'حفظ الروشتة في ملف المريض') }}
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="step-footer-actions">
              <button type="button" class="button secondary prev-btn" (click)="setStep(3)">
                {{ t('← Previous: Procedures', '⬅ السابق: الإجراءات') }}
              </button>
              <button type="button" class="button primary next-btn" (click)="setStep(5)">
                {{ t('Next: Checkout & Billing →', 'التالي: الحساب والإنهاء ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 5: BILLING & COMPLETE VISIT (الحساب وإنهاء الزيارة)         -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 5) {
          <section class="step-card checkout-card">
            <div class="step-header-title">
              <h2>💳 {{ t('5. Visit Summary, Billing & Checkout', '5. ملخص الزيارة، الحساب وإنهاء الجلسة') }}</h2>
              <p>{{ t('Review charges, post fees to patient account, collect payments, and finalize the clinical visit.', 'مراجعة التكاليف، ترحيل المستحقات لحساب المريض، تحصيل الدفعات، وإنهاء الزيارة السريرية رسمياً.') }}</p>
            </div>

            <!-- Reception Desk & Role Availability Banner -->
            <div class="reception-desk-banner">
              <div class="desk-badge">
                <span class="desk-icon">🛎️</span>
              </div>
              <div class="desk-details">
                <div class="desk-tag-row">
                  <span class="desk-tag role-tag">👤 {{ t('Reception Desk & Billing', 'صلاحية موظف الاستقبال والمحاسبة (Receptionist)') }}</span>
                  <span class="desk-tag status-tag">✓ {{ t('Checkout & Booking Enabled', 'جاهز لتحصيل المبالغ وحجز الموعد القادم') }}</span>
                </div>
                <h4>{{ t('Reception & Follow-up Scheduling Desk', 'مكتب الاستقبال، المحاسبة، وحجز موعد المتابعة') }}</h4>
                <p>{{ t('This stage is ready for the Receptionist or Doctor to collect visit payments, settle patient balance, book the follow-up appointment, and finalize the clinical session.', 'المرحلة الحالية مجهزة بالكامل لموظف الاستقبال (أو الطبيب) لتحصيل المدفوعات وتصفية الحساب وحجز الموعد القادم للمريض فوراً وقفل الجلسة.') }}</p>
              </div>
            </div>

            <div class="checkout-grid-layout">
              <!-- Financial Invoice Summary -->
              <div class="panel-box invoice-box">
                <div class="box-header">
                  <h3>🧾 {{ t('Financial Breakdown', 'تفاصيل الحساب المالي') }}</h3>
                </div>

                <div class="invoice-summary-list">
                  <div class="invoice-row">
                    <span>{{ t('Today Session Procedures Total:', 'إجمالي إجراءات جلسة اليوم:') }}</span>
                    <strong>{{ todayProceduresTotal() }} EGP</strong>
                  </div>

                  @if (balance()) {
                    <div class="invoice-row">
                      <span>{{ t('Previous Patient Outstanding:', 'الرصيد المستحق السابق:') }}</span>
                      <span>{{ balance()!.outstanding }} EGP</span>
                    </div>
                  }

                  <div class="invoice-row total-row">
                    <span>{{ t('Total Patient Balance Due:', 'المجموع المستحق على المريض:') }}</span>
                    <strong class="total-amount">{{ totalDue() }} EGP</strong>
                  </div>
                </div>

                <div class="billing-posting-notice">
                  <span class="notice-icon">ℹ️</span>
                  <div class="notice-body">
                    <strong>{{ t('Automatic Patient Billing:', 'الترحيل التلقائي لحساب المريض:') }}</strong>
                    <p>{{ t('All procedures and treatments recorded in this session are automatically posted as debts/charges to the patient balance.', 'جميع الإجراءات والعلاجات المنفذة في هذه الجلسة تُرحل كديون ومستحقات على حساب المريض في النظام المالي.') }}</p>
                  </div>
                </div>

                <!-- Immediate Payment Form -->
                <div class="payment-collector-wrap">
                  <h4>{{ t('Collect Payment Now (Optional)', 'تسجيل دفعة / سداد الآن (اختياري)') }}</h4>
                  <div class="payment-form-grid">
                    <label class="field-label">
                      <span>{{ t('Paid Amount (EGP)', 'المبلغ المدفوع (جنيه)') }}</span>
                      <input type="number" [(ngModel)]="paymentAmount" min="0" [max]="totalDue()" />
                    </label>

                    <label class="field-label">
                      <span>{{ t('Payment Method', 'طريقة الدفع') }}</span>
                      <select [(ngModel)]="paymentMethod">
                        <option [value]="1">{{ t('Cash', 'نقدي (كاش)') }}</option>
                        <option [value]="2">{{ t('Credit/Debit Card', 'بطاقة بنكية (فيزا / ماستركارد)') }}</option>
                        <option [value]="3">{{ t('Vodafone Cash / Digital', 'محفظة إلكترونية (فودافون كاش)') }}</option>
                        <option [value]="4">{{ t('Bank Transfer', 'تحويل بنكي') }}</option>
                      </select>
                    </label>
                  </div>

                  @if (paymentAmount > 0) {
                    <button
                      type="button"
                      class="button secondary btn-record-pay"
                      [disabled]="recordingPayment()"
                      (click)="recordPayment()"
                    >
                      @if (recordingPayment()) {
                        <span class="spinner-inline">⏳</span> {{ t('Recording Payment…', 'جاري تسجيل الدفعة…') }}
                      } @else {
                        💵 {{ t('Record Payment of ' + paymentAmount + ' EGP', 'تسجيل سداد مبلغ ' + paymentAmount + ' جنيه') }}
                      }
                    </button>
                  }
                </div>
              </div>

              <!-- Next Visit & Follow-up Recommendation -->
              <div class="panel-box follow-up-booking-box">
                <div class="box-header">
                  <h3>📅 {{ t('Schedule Next Visit / In-Place Booking', 'اقتراح وجدولة وحجز الموعد القادم للمريض') }}</h3>
                  @if (hasUnfinishedWork()) {
                    <span class="badge-pending-treatment">⏳ {{ t('Unfinished Treatment Detected', 'يوجد علاج قيد المتابعة والاستكمال') }}</span>
                  }
                </div>

                <div class="follow-up-content">
                  @if (hasUnfinishedWork()) {
                    <div class="unfinished-alert-card">
                      <div class="alert-icon-col">⚠️</div>
                      <div class="alert-info-col">
                        <strong>{{ t('Unfinished Clinical Work Detected:', 'تنبيه سريري: المريض لديه عمل علاجي لم ينتهِ بعد:') }}</strong>
                        <p class="unfinished-summary-text">{{ unfinishedWorkSummary() }}</p>
                      </div>
                      <button
                        type="button"
                        class="btn-use-unfinished-reason"
                        (click)="applyUnfinishedToFollowUpNotes()"
                      >
                        ✓ {{ t('Set as Appointment Reason', 'اعتماد كسبب للموعد') }}
                      </button>
                    </div>
                  }

                  <div class="quick-timing-suggestions">
                    <span class="timing-label">{{ t('Suggested Next Visit Date:', 'الموعد القادم المقترح:') }}</span>
                    <div class="timing-chips">
                      <button type="button" class="btn-time-chip" [class.selected]="isFollowUpSelected(7)" (click)="selectFollowUpDays(7)">
                        + {{ t('1 Week', 'بعد أسبوع') }}
                      </button>
                      <button type="button" class="btn-time-chip" [class.selected]="isFollowUpSelected(14)" (click)="selectFollowUpDays(14)">
                        + {{ t('2 Weeks', 'بعد أسبوعين') }}
                      </button>
                      <button type="button" class="btn-time-chip" [class.selected]="isFollowUpSelected(21)" (click)="selectFollowUpDays(21)">
                        + {{ t('3 Weeks', 'بعد 3 أسابيع') }}
                      </button>
                      <button type="button" class="btn-time-chip" [class.selected]="isFollowUpSelected(30)" (click)="selectFollowUpDays(30)">
                        + {{ t('1 Month', 'بعد شهر') }}
                      </button>
                    </div>
                  </div>

                  <div class="follow-up-inputs-grid">
                    <label class="field-label date-field">
                      <span>📅 {{ t('Appointment Date', 'تاريخ الموعد المقترح') }}</span>
                      <input
                        type="date"
                        [ngModel]="suggestedFollowUpDate"
                        (ngModelChange)="loadAvailabilitySlots($event)"
                        class="styled-date-input"
                      />
                    </label>

                    <label class="field-label notes-field">
                      <span>📝 {{ t('Visit Reason & Notes', 'سبب الزيارة والملاحظات') }}</span>
                      <input
                        type="text"
                        [(ngModel)]="suggestedFollowUpNotes"
                        class="styled-notes-input"
                        [placeholder]="t('e.g. Continue treatment / Crown fit', 'مثال: استكمال علاج السن أو تركيب التاج')"
                      />
                    </label>
                  </div>

                  <!-- Available Slots In-Place Section -->
                  @if (suggestedFollowUpDate) {
                    <div class="slots-selection-panel">
                      <div class="slots-panel-header">
                        <span class="slots-title">
                          ⏰ {{ t('Available Times for Doctor on', 'الأوقات المتاحة للحجز في يوم') }}
                          <strong>{{ suggestedFollowUpDate }}</strong>:
                        </span>
                        @if (loadingSlots()) {
                          <span class="spinner-sm"></span>
                        }
                      </div>

                      @if (loadingSlots()) {
                        <div class="slots-loading-hint">
                          <span class="spinner-sm"></span> {{ t('Checking doctor availability…', 'جارٍ فحص المواعيد المتاحة…') }}
                        </div>
                      } @else if (availableSlots().length > 0) {
                        <div class="slot-groups-vertical">
                          @if (slotPeriods().morning.length > 0) {
                            <div class="period-row">
                              <span class="period-badge morning">🌅 {{ t('Morning', 'الصباح') }}</span>
                              <div class="period-slots-chips">
                                @for (slot of slotPeriods().morning; track slot.startAt) {
                                  <button
                                    type="button"
                                    class="btn-slot-chip"
                                    [class.active]="selectedSlot()?.startAt === slot.startAt"
                                    (click)="selectedSlot.set(slot)"
                                  >
                                    {{ formatSlotTime(slot.localStartTime) }}
                                  </button>
                                }
                              </div>
                            </div>
                          }

                          @if (slotPeriods().afternoon.length > 0) {
                            <div class="period-row">
                              <span class="period-badge afternoon">☀️ {{ t('Afternoon', 'بعد الظهر') }}</span>
                              <div class="period-slots-chips">
                                @for (slot of slotPeriods().afternoon; track slot.startAt) {
                                  <button
                                    type="button"
                                    class="btn-slot-chip"
                                    [class.active]="selectedSlot()?.startAt === slot.startAt"
                                    (click)="selectedSlot.set(slot)"
                                  >
                                    {{ formatSlotTime(slot.localStartTime) }}
                                  </button>
                                }
                              </div>
                            </div>
                          }

                          @if (slotPeriods().evening.length > 0) {
                            <div class="period-row">
                              <span class="period-badge evening">🌙 {{ t('Evening', 'المساء') }}</span>
                              <div class="period-slots-chips">
                                @for (slot of slotPeriods().evening; track slot.startAt) {
                                  <button
                                    type="button"
                                    class="btn-slot-chip"
                                    [class.active]="selectedSlot()?.startAt === slot.startAt"
                                    (click)="selectedSlot.set(slot)"
                                  >
                                    {{ formatSlotTime(slot.localStartTime) }}
                                  </button>
                                }
                              </div>
                            </div>
                          }
                        </div>
                      } @else {
                        <div class="empty-slots-warning">
                          <span>⚠️ {{ t('No available appointment slots found on this date. Try another date.', 'لا توجد فترات حجز متاحة في هذا اليوم. جرب اختيار يوم آخر.') }}</span>
                        </div>
                      }

                      <!-- Book Confirmation Action -->
                      @if (selectedSlot() && !bookedAppointment()) {
                        <div class="slot-booking-action-bar">
                          <div class="selected-slot-pill">
                            <span>✓ {{ t('Selected Slot:', 'الموعد المحدد:') }}</span>
                            <strong>{{ suggestedFollowUpDate }} — {{ formatSlotTime(selectedSlot()!.localStartTime) }}</strong>
                          </div>

                          <button
                            type="button"
                            class="btn-book-instant"
                            [disabled]="bookingAppointment()"
                            (click)="bookAppointmentNow()"
                          >
                            @if (bookingAppointment()) {
                              <span class="spinner-sm"></span> {{ t('Confirming & Booking…', 'جارٍ تسجيل الحجز الفعلي…') }}
                            } @else {
                              🗓️ {{ t('Confirm & Book Appointment Now', 'تأكيد وحجز الموعد الفعلي الآن') }} ➔
                            }
                          </button>
                        </div>
                      }

                      @if (bookingError()) {
                        <div class="booking-err-alert">
                          {{ bookingError() }}
                        </div>
                      }

                      <!-- Booked Success Banner -->
                      @if (bookedAppointment()) {
                        <div class="booked-success-card">
                          <span class="check-success-icon">✓</span>
                          <div class="booked-info">
                            <strong>{{ t('Appointment Booked Successfully!', 'تم الحجز وتأكيد الموعد بنجاح!') }}</strong>
                            <p>
                              {{ t('Date:', 'التاريخ:') }} <strong>{{ bookedAppointment()!.date }}</strong> ·
                              {{ t('Time:', 'الوقت:') }} <strong>{{ bookedAppointment()!.time }}</strong>
                            </p>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Next Appointment & Final Complete -->
              <div class="panel-box complete-actions-box">
                <div class="box-header">
                  <h3>🏁 {{ t('Finalize & Complete Visit', 'إكمال وقفل الزيارة') }}</h3>
                </div>

                <div class="completion-checklist">
                  <div class="check-item">
                    <span class="check-icon">✓</span>
                    <span>{{ t('Clinical examination & dental chart documented', 'تم توثيق الفحص السريري ومخطط الأسنان') }}</span>
                  </div>
                  <div class="check-item">
                    <span class="check-icon">✓</span>
                    <span>{{ t('Procedures recorded and billed to patient', 'تم ترحيل العلاجات والإجراءات لحساب المريض') }}</span>
                  </div>
                  <div class="check-item">
                    <span class="check-icon">✓</span>
                    <span>{{ t('Prescription generated (if prescribed)', 'تم حفظ الروشتة الطبية للمريض') }}</span>
                  </div>
                </div>

                @if (examination()!.canComplete) {
                  <div class="final-cta-wrap">
                    <button type="button" class="button primary btn-complete-visit" (click)="completeVisit()">
                      ✓ {{ t('Complete Visit & Lock Session', 'إنهاء الزيارة واعتماد الفاتورة والسجل') }}
                    </button>
                    <p class="lock-notice">{{ t('Completing the visit marks appointment completed and locks clinical history.', 'إنهاء الزيارة يقفل الجلسة السريرية ويكمل الموعد في جدول المواعيد.') }}</p>
                  </div>
                } @else {
                  <div class="already-completed-box">
                    <span class="badge-completed">✓ {{ t('This visit is completed and locked.', 'هذه الزيارة مكتملة ومقفلة.') }}</span>
                  </div>
                }
              </div>
            </div>

            <div class="step-footer-actions">
              <button type="button" class="button secondary prev-btn" (click)="setStep(4)">
                {{ t('← Previous: Prescription', '⬅ السابق: الوصفة الطبية') }}
              </button>
              <div></div>
            </div>
          </section>
        }
      }

      @if (showVisitHistorySheet() && patient()) {
        <app-patient-visit-history-sheet
          [patientId]="patient()!.id"
          (close)="showVisitHistorySheet.set(false)"
        ></app-patient-visit-history-sheet>
      }

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!--  CRITICAL MEDICAL ALERT POPUP MODAL                              -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      @if (showMedicalAlertModal()) {
        <div class="modal-overlay alert-modal-overlay" (click)="closeMedicalAlertModal()">
          <div class="modal-content medical-alert-modal" (click)="$event.stopPropagation()">
            <div class="alert-modal-head">
              <div class="head-badge">
                <span class="pulse-icon">🚨</span>
              </div>
              <div class="head-titles">
                <h2 class="head-main-title">{{ t('CRITICAL MEDICAL ALERT', 'تنبيه طبي عاجل وهام!') }}</h2>
                <p class="head-sub-title">
                  {{ t('Review patient sensitivities, chronic illnesses, and medications before procedure.', 'يجب مراجعة الحساسية والأمراض المزمنة والأدوية قبل بدء الكشف أو التخدير أو الجراحة.') }}
                </p>
              </div>
              <button type="button" class="close-alert-btn" (click)="closeMedicalAlertModal()">&times;</button>
            </div>

            <div class="patient-banner-mini">
              <div class="p-info">
                <span class="p-code">{{ examination()?.patientNumber || patient()?.patientNumber }}</span>
                <strong class="p-name">👤 {{ examination()?.patientName || ((patient()?.firstName || '') + ' ' + (patient()?.lastName || '')) }}</strong>
              </div>
              <div class="p-meta">
                @if (patient()?.gender) {
                  <span>{{ patient()!.gender === 1 ? t('Male', 'ذكر') : t('Female', 'أنثى') }}</span>
                }
                @if (patient()?.phone) {
                  <span>📞 {{ patient()!.phone }}</span>
                }
              </div>
            </div>

            <div class="alert-modal-body">
              @if (patientAllergies.length > 0) {
                <div class="modal-alert-card allergies">
                  <div class="card-head">
                    <div class="card-title">
                      <span class="icon">⚠️</span>
                      <strong>{{ t('Allergies & Sensitivities', 'الحساسية والمحاذير') }}</strong>
                    </div>
                    <span class="badge-count">{{ patientAllergies.length }}</span>
                  </div>
                  <div class="tags-container">
                    @for (item of patientAllergies; track item) {
                      <span class="popup-tag danger">
                        <span class="tag-icon">⚠️</span>
                        <span class="tag-label">{{ item }}</span>
                      </span>
                    }
                  </div>
                </div>
              }

              @if (patientConditions.length > 0) {
                <div class="modal-alert-card conditions">
                  <div class="card-head">
                    <div class="card-title">
                      <span class="icon">🩺</span>
                      <strong>{{ t('Chronic Medical Conditions', 'الأمراض والحالات المزمنة') }}</strong>
                    </div>
                    <span class="badge-count">{{ patientConditions.length }}</span>
                  </div>
                  <div class="tags-container">
                    @for (item of patientConditions; track item) {
                      <span class="popup-tag warning">
                        <span class="tag-icon">🩺</span>
                        <span class="tag-label">{{ item }}</span>
                      </span>
                    }
                  </div>
                </div>
              }

              @if (patientMedications.length > 0) {
                <div class="modal-alert-card medications">
                  <div class="card-head">
                    <div class="card-title">
                      <span class="icon">💊</span>
                      <strong>{{ t('Current Patient Medications', 'الأدوية والعلاجات الحالية') }}</strong>
                    </div>
                    <span class="badge-count">{{ patientMedications.length }}</span>
                  </div>
                  <div class="tags-container">
                    @for (item of patientMedications; track item) {
                      <span class="popup-tag info">
                        <span class="tag-icon">💊</span>
                        <span class="tag-label">{{ item }}</span>
                      </span>
                    }
                  </div>
                </div>
              }

              <div class="alert-safety-notice">
                <span class="notice-icon">⚡</span>
                <p>
                  {{ t('Doctor Caution: Ensure local anesthesia choice (e.g. epinephrine/adrenaline precautions), bleeding management, and antibiotic prescriptions comply with the patient’s medical status.', 'تنبيه الطبيب المعالج: يرجى مراعاة ملاءمة نوع البنج الموضعي (مثل تجنب الأدرينالين مع مرضى القلب والضغط)، والاحتياط لسيولة الدم وموانع المضادات الحيوية قبل الشروع في الإجراء.') }}
                </p>
              </div>
            </div>

            <div class="alert-modal-actions">
              <button type="button" class="btn-confirm-alert" (click)="closeMedicalAlertModal()">
                <span>✓ {{ t('I Understand & Acknowledge — Continue Examination', 'تم الاطلاع وتأكيد الحذر — متابعة الكشف') }}</span>
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!--  PAYMENT & BILLING ERROR POPUP MODAL                             -->
      <!-- ════════════════════════════════════════════════════════════════ -->
      @if (paymentErrorModal().isOpen) {
        <div class="modal-overlay payment-error-modal-overlay" (click)="closePaymentErrorModal()">
          <div class="modal-content payment-error-modal" (click)="$event.stopPropagation()">
            <div class="payment-error-head">
              <div class="error-badge">
                <span class="error-icon">⚠️</span>
              </div>
              <div class="error-titles">
                <h3 class="error-main-title">{{ paymentErrorModal().title }}</h3>
                <p class="error-sub-title">
                  {{ t('Payment Transaction Notice', 'تنبيه بشأن عملية الدفع والتحصيل') }}
                </p>
              </div>
              <button type="button" class="close-error-btn" (click)="closePaymentErrorModal()" aria-label="Close">&times;</button>
            </div>

            <div class="payment-error-body">
              <div class="error-notice-card">
                <div class="notice-icon-box">❌</div>
                <div class="notice-text">
                  <p class="error-message-primary">{{ paymentErrorModal().message }}</p>
                  @if (paymentErrorModal().details) {
                    <p class="error-message-details">{{ paymentErrorModal().details }}</p>
                  }
                </div>
              </div>

              <div class="error-advice-box">
                <strong>💡 {{ t('What to do:', 'ماذا يمكنك أن تفعل:') }}</strong>
                <ul>
                  <li>{{ t('Verify that the entered payment amount does not exceed the total patient due balance.', 'تأكد من أن المبلغ المدفوع لا يتجاوز إجمالي الرصيد المستحق على المريض.') }}</li>
                  <li>{{ t('Ensure session procedures are recorded and billed before collecting full payment.', 'تأكد من ترحيل إجراءات وعلاجات الجلسة أولاً في حال كانت الدفعة تغطي علاجات اليوم.') }}</li>
                </ul>
              </div>
            </div>

            <div class="payment-error-actions">
              <button type="button" class="button primary btn-close-err-modal" (click)="closePaymentErrorModal()">
                {{ t('Understood & Correct Amount', 'حسناً، فهمت وتعديل المبلغ') }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ExaminationComponent {
  private readonly api = inject(DentalApiService);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly treatmentApi = inject(TreatmentApiService);
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly financeApi = inject(FinanceApiService);
  private readonly patientApi = inject(PatientApiService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly appointmentId = inject(ActivatedRoute).snapshot.paramMap.get('appointmentId')!;
  readonly examination = signal<ExaminationDetails | null>(null);
  readonly appointment = signal<AppointmentDetails | null>(null);
  readonly patient = signal<PatientDetails | null>(null);
  readonly balance = signal<PatientBalance | null>(null);
  readonly catalog = signal<CatalogItem[]>([]);
  readonly medications = signal<Medication[]>([]);
  readonly executedTreatments = signal<Treatment[]>([]);
  readonly treatmentPlans = signal<TreatmentPlanList[]>([]);
  readonly showVisitHistorySheet = signal(false);
  readonly showMedicalAlertModal = signal(false);
  private alertModalAutoShown = false;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly savingTreatment = signal(false);
  readonly savingPlan = signal(false);
  readonly savingRx = signal(false);
  readonly startingGate = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  patientAllergies: string[] = [];
  patientConditions: string[] = [];
  patientMedications: string[] = [];
  readonly allergySuggestions = COMMON_ALLERGIES;
  readonly conditionSuggestions = COMMON_CONDITIONS;
  readonly medicationSuggestions = COMMON_MEDICATIONS;

  // Stepper State
  readonly step = signal<number>(1);
  readonly steps = [
    { number: 1, icon: '📋', en: '1. Intake', ar: '1. الاستقبال والشكوى' },
    { number: 2, icon: '🦷', en: '2. Dental Chart', ar: '2. فحص ومخطط الأسنان' },
    { number: 3, icon: '🛠️', en: '3. Procedures', ar: '3. الإجراءات وخطة العلاج' },
    { number: 4, icon: '💊', en: '4. Prescription', ar: '4. الروشتة' },
    { number: 5, icon: '💳', en: '5. Billing & End', ar: '5. الحساب والإنهاء' },
  ];

  // Dental Chart State
  selected = 11;
  selectedTeeth: number[] = [11];
  readonly tab = signal<'findings' | 'procedures' | 'endodontic' | 'notes'>('findings');
  readonly tabs = [
    { id: 'findings' as const, en: 'Findings', ar: 'النتائج' },
    { id: 'procedures' as const, en: 'Procedures', ar: 'الإجراءات' },
    { id: 'endodontic' as const, en: 'Endodontic', ar: 'علاج الجذور' },
    { id: 'notes' as const, en: 'Notes', ar: 'الملاحظات' },
  ];
  readonly surfaces = SURFACES;
  readonly findingOptions = Object.entries(FINDING_APPEARANCE).map(([id, x]) => ({
    id: +id,
    ...x,
  }));
  readonly procedureOptions = Object.entries(PROCEDURE_APPEARANCE).map(([id, x]) => ({
    id: +id,
    ...x,
  }));

  // Forms
  readonly findingForm = this.fb.nonNullable.group({
    type: 2,
    surfaces: [[] as number[]],
    notes: '',
  });
  readonly procedureForm = this.fb.nonNullable.group({
    type: 1,
    surfaces: [[] as number[]],
    notes: '',
  });
  readonly endoForm = this.fb.nonNullable.group({ canals: ['', Validators.required], notes: '' });
  readonly notesForm = this.fb.nonNullable.group({ notes: '' });

  // Treatment & Clinical Progress state
  selectedCatalogId = '';
  treatmentToothNumber: number | null = null;
  treatmentUnitPrice = 0;
  treatmentPrice = 0;
  treatmentNotes = '';
  clinicalStatus: 'completed' | 'in_progress' = 'completed';
  remainingWorkDescription = '';
  readonly currentParsedItem = signal<ParsedCatalogItem | null>(null);
  readonly selectedPriceTierId = signal<string>('base');

  // Follow-up & In-Place Appointment Scheduling (Step 5)
  suggestedFollowUpDate = '';
  suggestedFollowUpNotes = '';
  followUpDuration = 30;
  readonly availableSlots = signal<AvailabilitySlot[]>([]);
  readonly loadingSlots = signal<boolean>(false);
  readonly selectedSlot = signal<AvailabilitySlot | null>(null);
  readonly bookingAppointment = signal<boolean>(false);
  readonly bookedAppointment = signal<{ id: string; date: string; time: string } | null>(null);
  readonly bookingError = signal<string>('');

  readonly recordingPayment = signal<boolean>(false);
  readonly paymentErrorModal = signal<{
    isOpen: boolean;
    title: string;
    message: string;
    details?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  closePaymentErrorModal() {
    this.paymentErrorModal.set({ isOpen: false, title: '', message: '' });
  }

  readonly slotPeriods = computed(() => {
    const slots = this.availableSlots();
    const morning: AvailabilitySlot[] = [];
    const afternoon: AvailabilitySlot[] = [];
    const evening: AvailabilitySlot[] = [];

    for (const s of slots) {
      const h = parseInt(s.localStartTime.split(':')[0], 10);
      if (h < 12) {
        morning.push(s);
      } else if (h < 17) {
        afternoon.push(s);
      } else {
        evening.push(s);
      }
    }
    return { morning, afternoon, evening };
  });


  // Prescription builder state
  catalogMedications = signal<Medication[]>([]);
  quickDentalPresets = CORE_DENTAL_MEDICATIONS;

  readonly allAvailableMedications = computed<DentalMedicationPreset[]>(() => {
    const list: DentalMedicationPreset[] = [...CORE_DENTAL_MEDICATIONS];
    for (const m of this.catalogMedications()) {
      const meta = parseMedicationNotes(m.notes);
      const name = this.getCatalogMedDisplayName(m);
      if (!list.some((x) => x.name.toLowerCase() === name.toLowerCase() || (x.id && x.id === m.id))) {
        list.push({
          id: m.id,
          name,
          nameAr: meta.nameAr || m.name,
          nameEn: meta.nameEn || m.name,
          genericName: m.genericName,
          strength: m.strength,
          form: m.form,
          dose: meta.defaultDose || (this.i18n.language() === 'ar' ? '1 قرص' : '1 Tablet'),
          frequency: meta.defaultFrequency || (this.i18n.language() === 'ar' ? 'كل 8 ساعات' : 'Every 8 hours'),
          duration: meta.defaultDuration || (this.i18n.language() === 'ar' ? '5 أيام' : '5 days'),
          instructions: meta.defaultInstructions || (this.i18n.language() === 'ar' ? 'بعد الأكل' : 'After meals'),
          category: meta.category,
        });
      }
    }
    return list;
  });

  prescriptionItems: PrescribedMedicineRow[] = [
    { medicationName: '', dose: '1 قرص', frequency: 'كل 8 ساعات', duration: '5 أيام', instructions: 'بعد الأكل' },
  ];
  prescriptionGeneralNotes = '';

  // Billing state
  paymentAmount = 0;
  paymentMethod = 1;

  readonly chartTeeth = computed<ToothChartSummary[]>(() =>
    Array.from({ length: 4 }, (_, q) => Array.from({ length: 8 }, (_, i) => (q + 1) * 10 + i + 1))
      .flat()
      .map((number) => ({
        toothId: `tooth-${number}`,
        toothNumber: number,
        findings: [
          ...new Set(
            (this.examination()?.findings ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        procedures: [
          ...new Set(
            (this.examination()?.procedures ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        hasEndodonticRecord: (this.examination()?.endodonticRecords ?? []).some(
          (x) => x.toothNumber === number,
        ),
      })),
  );

  todayProceduresTotal = computed(() => {
    return this.executedTreatments().reduce((sum, tr) => sum + (tr.price || 0), 0);
  });

  totalDue = computed(() => {
    const prev = this.balance()?.outstanding || 0;
    return prev + this.todayProceduresTotal();
  });

  constructor() {
    this.load();
  }

  setStep(n: number) {
    this.step.set(n);
    const e = this.examination();
    if (!e) return;
    if (n === 1) {
      this.loadPatient(e.patientId);
      this.loadAppointment();
    }
    if (n === 2) {
      this.loadAppointment();
    }
    if (n === 3) {
      this.loadTreatments(e.patientId);
      this.loadAppointment();
    }
    if (n === 4) {
      this.loadMedicationsCatalog();
    }
    if (n === 5) {
      this.loadBalance(e.patientId);
      this.loadTreatments(e.patientId);
      if (!this.suggestedFollowUpDate) {
        this.selectFollowUpDays(7);
      } else {
        this.loadAvailabilitySlots();
      }
      setTimeout(() => this.applyUnfinishedToFollowUpNotes(), 300);
    }
  }


  loadAppointment() {
    if (this.appointment()) return;
    this.appointmentApi.appointment(this.appointmentId).subscribe({
      next: (app) => this.appointment.set(app),
      error: () => {},
    });
  }

  load() {
    this.error.set('');
    this.api.byAppointment(this.appointmentId).subscribe({
      next: (x) => this.set(x),
      error: (e) => {
        if (e.status === 404) {
          this.handleUncreatedExamination();
        } else {
          this.fail(e);
        }
      },
    });
  }

  private handleUncreatedExamination() {
    this.appointmentApi.appointment(this.appointmentId).subscribe({
      next: (app) => {
        this.appointment.set(app);
        if (app.status === 4) {
          // InProgress -> create examination directly
          this.create();
        } else if (app.status === 3) {
          // CheckedIn -> start appointment then create
          this.appointmentApi.action(this.appointmentId, 'start').subscribe({
            next: () => this.create(),
            error: () => this.create(),
          });
        } else if (app.status === 1 || app.status === 2) {
          // Scheduled or Confirmed -> show intake gate
          this.loading.set(false);
        } else if (app.status === 5) {
          // Completed appointment -> load patient details, treatments, and balance for review
          this.loadPatient(app.patientId);
          this.loadTreatments(app.patientId);
          this.loadBalance(app.patientId);
          this.loading.set(false);
        } else {
          this.loading.set(false);
        }
      },
      error: () => {
        // Fallback for tests
        this.create();
      },
    });
  }

  checkInAndStart() {
    const app = this.appointment();
    if (!app) return;
    this.startingGate.set(true);

    if (app.status === 1) {
      this.appointmentApi.action(this.appointmentId, 'confirm').subscribe({
        next: () => {
          this.appointmentApi.action(this.appointmentId, 'check-in').subscribe({
            next: () => {
              this.appointmentApi.action(this.appointmentId, 'start').subscribe({
                next: () => {
                  this.startingGate.set(false);
                  this.create();
                },
                error: () => {
                  this.startingGate.set(false);
                  this.create();
                },
              });
            },
            error: () => {
              this.startingGate.set(false);
              this.create();
            },
          });
        },
        error: () => {
          this.startingGate.set(false);
          this.create();
        },
      });
    } else if (app.status === 2) {
      this.appointmentApi.action(this.appointmentId, 'check-in').subscribe({
        next: () => {
          this.appointmentApi.action(this.appointmentId, 'start').subscribe({
            next: () => {
              this.startingGate.set(false);
              this.create();
            },
            error: () => {
              this.startingGate.set(false);
              this.create();
            },
          });
        },
        error: () => {
          this.startingGate.set(false);
          this.create();
        },
      });
    } else {
      this.appointmentApi.action(this.appointmentId, 'start').subscribe({
        next: () => {
          this.startingGate.set(false);
          this.create();
        },
        error: () => {
          this.startingGate.set(false);
          this.create();
        },
      });
    }
  }

  statusLabel(status: number) {
    switch (status) {
      case 1: return this.t('Scheduled', 'مجدول');
      case 2: return this.t('Confirmed', 'مؤكد');
      case 3: return this.t('Checked In', 'حاضر بالعيادة');
      case 4: return this.t('In Progress', 'جاري الكشف');
      case 5: return this.t('Completed', 'مكتمل');
      case 6: return this.t('Cancelled', 'ملغي');
      case 7: return this.t('No Show', 'لم يحضر');
      default: return '';
    }
  }

  hasMedicalAlerts(): boolean {
    return (
      this.patientAllergies.length > 0 ||
      this.patientConditions.length > 0 ||
      this.patientMedications.length > 0
    );
  }

  totalAlertsCount(): number {
    return (
      this.patientAllergies.length +
      this.patientConditions.length +
      this.patientMedications.length
    );
  }

  closeMedicalAlertModal(): void {
    this.showMedicalAlertModal.set(false);
  }

  openMedicalAlertModal(): void {
    this.showMedicalAlertModal.set(true);
  }

  loadPatient(patientId: string) {
    if (this.patient()) return;
    this.patientApi.patient(patientId).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.patientAllergies = (p.allergies ?? []).map((x) => x.name);
        this.patientConditions = (p.medicalConditions ?? []).map((x) => x.name);
        this.patientMedications = (p.medications ?? []).map((x) => x.name);

        if (!this.alertModalAutoShown && this.hasMedicalAlerts()) {
          this.alertModalAutoShown = true;
          this.showMedicalAlertModal.set(true);
        }
      },
      error: () => {},
    });
  }

  onAllergiesChange(tags: string[]) {
    this.patientAllergies = tags;
    this.syncMedicalHistory('allergies', tags);
  }

  onConditionsChange(tags: string[]) {
    this.patientConditions = tags;
    this.syncMedicalHistory('conditions', tags);
  }

  onMedicationsChange(tags: string[]) {
    this.patientMedications = tags;
    this.syncMedicalHistory('medications', tags);
  }

  private async syncMedicalHistory(type: 'allergies' | 'conditions' | 'medications', tags: string[]) {
    const p = this.patient();
    if (!p) return;
    const patientId = p.id;

    if (type === 'allergies') {
      const existing = p.allergies ?? [];
      for (const tag of tags) {
        if (!existing.some((x) => x.name.trim().toLowerCase() === tag.trim().toLowerCase())) {
          try {
            const res = await firstValueFrom(this.patientApi.addText(patientId, 'allergies', { name: tag }));
            existing.push({ id: res.id, name: tag });
          } catch {}
        }
      }
      for (const ex of existing) {
        if (!tags.some((t) => t.trim().toLowerCase() === ex.name.trim().toLowerCase())) {
          try {
            await firstValueFrom(this.patientApi.removeText(patientId, 'allergies', ex.id));
          } catch {}
        }
      }
    } else if (type === 'conditions') {
      const existing = p.medicalConditions ?? [];
      for (const tag of tags) {
        if (!existing.some((x) => x.name.trim().toLowerCase() === tag.trim().toLowerCase())) {
          try {
            const res = await firstValueFrom(this.patientApi.addText(patientId, 'conditions', { name: tag }));
            existing.push({ id: res.id, name: tag });
          } catch {}
        }
      }
      for (const ex of existing) {
        if (!tags.some((t) => t.trim().toLowerCase() === ex.name.trim().toLowerCase())) {
          try {
            await firstValueFrom(this.patientApi.removeText(patientId, 'conditions', ex.id));
          } catch {}
        }
      }
    } else if (type === 'medications') {
      const existing = p.medications ?? [];
      for (const tag of tags) {
        if (!existing.some((x) => x.name.trim().toLowerCase() === tag.trim().toLowerCase())) {
          try {
            const res = await firstValueFrom(this.patientApi.addMedication(patientId, { name: tag }));
            existing.push({ id: res.id, name: tag });
          } catch {}
        }
      }
      for (const ex of existing) {
        if (!tags.some((t) => t.trim().toLowerCase() === ex.name.trim().toLowerCase())) {
          try {
            await firstValueFrom(this.patientApi.removeMedication(patientId, ex.id));
          } catch {}
        }
      }
    }
  }

  loadTreatments(patientId: string) {
    this.treatmentApi.catalog().subscribe({
      next: (c) => this.catalog.set(c.filter((x) => x.isActive)),
      error: () => {},
    });
    this.treatmentApi.treatments({ patientId }).subscribe({
      next: (res) => this.executedTreatments.set(res.items || []),
      error: () => {},
    });
    this.treatmentApi.plans({ patientId, pageSize: '50' }).subscribe({
      next: (res) => this.treatmentPlans.set(res.items || []),
      error: () => {},
    });
  }


  loadBalance(patientId: string) {
    this.financeApi.patientBalance(patientId).subscribe({
      next: (b) => this.balance.set(b),
      error: () => {},
    });
  }

  private create() {
    this.api.create(this.appointmentId).subscribe({
      next: (x) =>
        this.api
          .examination(x.id)
          .subscribe({
            next: (e) => this.set(e),
            error: (e) => this.fail(e),
          }),
      error: (e) => this.fail(e),
    });
  }

  private set(x: ExaminationDetails) {
    this.examination.set(x);
    this.notesForm.setValue({ notes: x.notes ?? '' });
    this.loadPatient(x.patientId);
    this.loadAppointment();
    this.loadBalance(x.patientId);
    this.loading.set(false);
  }

  startSession() {
    this.appointmentApi.action(this.appointmentId, 'start').subscribe({
      next: () => {
        this.success.set(this.t('Session started.', 'تم بدء الجلسة.'));
        this.load();
      },
      error: () => {},
    });
  }

  selectedFindings() {
    return this.examination()?.findings.filter((x) => x.toothNumber === this.selected) ?? [];
  }

  selectedProcedures() {
    return this.examination()?.procedures.filter((x) => x.toothNumber === this.selected) ?? [];
  }

  selectedEndodontic() {
    return (
      this.examination()?.endodonticRecords.filter((x) => x.toothNumber === this.selected) ?? []
    );
  }

  addFinding() {
    const e = this.examination();
    if (!e) return;
    const v = this.findingForm.getRawValue();
    this.mutate(
      this.api.addFinding(e.id, {
        toothNumber: this.selected,
        type: +v.type,
        surfaces: v.surfaces,
        notes: v.notes || undefined,
        version: e.version,
      }),
      this.t('Finding added.', 'تم إضافة النتيجة.'),
    );
  }

  removeFinding(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeFinding(e.id, id, e.version));
  }

  addProcedure() {
    const e = this.examination();
    if (!e) return;
    const v = this.procedureForm.getRawValue();
    this.mutate(
      this.api.addProcedure(e.id, {
        toothNumber: this.selected,
        type: +v.type,
        surfaces: v.surfaces,
        notes: v.notes || undefined,
        version: e.version,
      }),
      this.t('Procedure recorded.', 'تم تسجيل الإجراء.'),
    );
  }

  removeProcedure(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeProcedure(e.id, id, e.version));
  }

  addEndodontic() {
    const e = this.examination();
    if (!e || this.endoForm.invalid) return;
    try {
      const v = this.endoForm.getRawValue();
      const canals = v.canals
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [name, length] = line.split(':');
          if (!name || !length || !Number(length)) throw new Error();
          return { name: name.trim(), lengthMm: Number(length) };
        });
      this.mutate(
        this.api.addEndodontic(e.id, {
          toothNumber: this.selected,
          notes: v.notes || undefined,
          canals,
          version: e.version,
        }),
      );
    } catch {
      this.error.set(this.t('Use canal lines such as MB:21.', 'استخدم سطور قنوات مثل MB:21.'));
    }
  }

  removeEndodontic(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeEndodontic(e.id, id, e.version));
  }

  saveNotes() {
    const e = this.examination();
    if (e)
      this.mutate(
        this.api.notes(e.id, this.notesForm.getRawValue().notes, e.version),
        this.t('Draft saved.', 'تم حفظ المسودة.'),
      );
  }

  selectedToothFindings() {
    return (this.examination()?.findings ?? []).filter((f) => f.toothNumber === this.selected);
  }

  getSelectedCatalogPrice(): number {
    const item = this.catalog().find((x) => x.id === this.selectedCatalogId);
    return item?.defaultPrice ?? 0;
  }

  quickAddFinding(type: number) {
    const e = this.examination();
    if (!e || !e.canEdit) return;
    const teeth = this.selectedTeeth.length > 0 ? this.selectedTeeth : [this.selected];

    const addNext = (index: number, currentVersion: string) => {
      if (index >= teeth.length) {
        this.load();
        return;
      }
      this.api
        .addFinding(e.id, {
          toothNumber: teeth[index],
          type,
          surfaces: [],
          notes: undefined,
          version: currentVersion,
        })
        .subscribe({
          next: () => {
            this.api.examination(e.id).subscribe({
              next: (updatedExam) => {
                this.examination.set(updatedExam);
                addNext(index + 1, updatedExam.version);
              },
              error: () => this.load(),
            });
          },
          error: (err) => this.fail(err),
        });
    };

    addNext(0, e.version);
  }


  onSelectedToothChange(num: number) {
    this.selected = num;
    if (!this.selectedTeeth.includes(num)) {
      this.selectedTeeth = [num];
    }
    this.recalculateTreatmentPrice();
  }

  onSelectedTeethChange(teeth: number[]) {
    this.selectedTeeth = teeth;
    if (teeth.length > 0 && !teeth.includes(this.selected)) {
      this.selected = teeth[0];
    }
    this.recalculateTreatmentPrice();
  }

  selectedTeethLabel(): string {
    return this.selectedTeeth.length > 0 ? this.selectedTeeth.map((t) => '#' + t).join(', ') : '#' + this.selected;
  }

  recalculateTreatmentPrice() {
    const count = this.selectedTeeth.length || 1;
    this.treatmentPrice = (this.treatmentUnitPrice || 0) * count;
  }

  onCatalogSelectionChange() {
    const item = this.catalog().find((x) => x.id === this.selectedCatalogId);
    if (item) {
      const parsed = parseCatalogItem(item);
      this.currentParsedItem.set(parsed);
      if (parsed.priceTiers && parsed.priceTiers.length > 0) {
        const firstTier = parsed.priceTiers[0];
        this.selectedPriceTierId.set(firstTier.id);
        this.treatmentUnitPrice = firstTier.price;
        const tierName = this.i18n.language() === 'ar' ? firstTier.nameAr : firstTier.nameEn;
        if (!this.treatmentNotes) {
          this.treatmentNotes = tierName;
        }
      } else {
        this.selectedPriceTierId.set('base');
        this.treatmentUnitPrice = item.defaultPrice ?? 0;
      }
    } else {
      this.currentParsedItem.set(null);
      this.selectedPriceTierId.set('base');
      this.treatmentUnitPrice = 0;
    }
    this.recalculateTreatmentPrice();
  }

  selectPriceTier(tier: PriceTier) {
    this.selectedPriceTierId.set(tier.id);
    this.treatmentUnitPrice = tier.price;
    this.recalculateTreatmentPrice();
    const tierName = this.i18n.language() === 'ar' ? tier.nameAr : tier.nameEn;
    const parsed = this.currentParsedItem();
    if (parsed) {
      const wasPreviousTier = parsed.priceTiers.some(
        (t) => this.treatmentNotes === t.nameAr || this.treatmentNotes === t.nameEn,
      );
      if (!this.treatmentNotes || wasPreviousTier) {
        this.treatmentNotes = tierName;
      }
    }
  }


  onUnitPriceChange(newUnitPrice: number) {
    this.treatmentUnitPrice = Number(newUnitPrice) || 0;
    const parsed = this.currentParsedItem();
    const matchingTier = parsed?.priceTiers.find((t) => t.price === this.treatmentUnitPrice);
    if (matchingTier) {
      this.selectedPriceTierId.set(matchingTier.id);
    } else {
      this.selectedPriceTierId.set('custom');
    }
    this.recalculateTreatmentPrice();
  }


  recordTreatmentForSelectedTooth() {
    this.recordTreatmentExecution();
  }

  recordTreatmentExecution() {
    const e = this.examination();
    if (!e || !this.selectedCatalogId) return;

    this.savingTreatment.set(true);
    this.error.set('');

    const execute = (doctorProfileId: string) => {
      const teeth = this.selectedTeeth.length > 0 ? this.selectedTeeth : [this.selected];

      let fullNotes = this.treatmentNotes ? this.treatmentNotes.trim() : '';
      if (this.clinicalStatus === 'in_progress') {
        const remainingPart = this.remainingWorkDescription
          ? `(متبقي: ${this.remainingWorkDescription.trim()})`
          : '(بدأ العلاج ولسه هنكمل)';
        fullNotes = fullNotes ? `${fullNotes} · ${remainingPart}` : remainingPart;
      }

      this.treatmentApi
        .createTreatment({
          patientId: e.patientId,
          doctorProfileId: doctorProfileId,
          catalogItemId: this.selectedCatalogId,
          appointmentId: this.appointmentId,
          toothNumbers: teeth,
          notes: fullNotes || undefined,
          price: this.treatmentPrice,
        })
        .subscribe({
          next: (res: { id: string }) => {
            this.treatmentApi.treatment(res.id).subscribe({
              next: (tr: Treatment) => {
                const actionName = this.clinicalStatus === 'completed' ? 'complete' : 'start';
                this.treatmentApi.treatmentAction(res.id, actionName, tr.version).subscribe({
                  next: () => {
                    this.savingTreatment.set(false);
                    const msg =
                      this.clinicalStatus === 'completed'
                        ? this.t(
                            `Procedure for ${this.selectedTeethLabel()} completed and billed successfully (Finished).`,
                            `تم تسجيل وانتهاء إجراء ${this.selectedTeethLabel()} وترحيل المبلغ للحساب بنجاح (خَلَصْ).`,
                          )
                        : this.t(
                            `Procedure for ${this.selectedTeethLabel()} started (In Progress) and billed successfully.`,
                            `تم تسجيل بدء إجراء ${this.selectedTeethLabel()} وترحيل المبلغ للحساب بنجاح (بدأ العلاج ولسه هنكمل).`,
                          );
                    this.success.set(msg);
                    this.treatmentToothNumber = null;
                    this.treatmentNotes = '';
                    this.remainingWorkDescription = '';
                    this.selectedCatalogId = '';
                    this.treatmentUnitPrice = 0;
                    this.treatmentPrice = 0;
                    this.currentParsedItem.set(null);
                    this.loadTreatments(e.patientId);
                    this.loadBalance(e.patientId);
                    setTimeout(() => this.applyUnfinishedToFollowUpNotes(), 600);
                  },
                  error: (err) => {
                    this.savingTreatment.set(false);
                    this.fail(err);
                    this.loadTreatments(e.patientId);
                    this.loadBalance(e.patientId);
                  },
                });
              },
              error: (err) => {
                this.savingTreatment.set(false);
                this.fail(err);
              },
            });
          },
          error: (err) => {
            this.savingTreatment.set(false);
            this.fail(err);
          },
        });
    };

    if (this.appointment()?.doctorProfileId) {
      execute(this.appointment()!.doctorProfileId);
    } else {
      this.appointmentApi.appointment(this.appointmentId).subscribe({
        next: (app) => {
          this.appointment.set(app);
          execute(app.doctorProfileId);
        },
        error: (err) => {
          this.savingTreatment.set(false);
          this.fail(err);
        },
      });
    }
  }


  getUnfinishedTreatments(): Treatment[] {
    return this.executedTreatments().filter(
      (t) => t.status === 3 || t.status === 1 || t.status === 2,
    );
  }

  hasUnfinishedWork(): boolean {
    const hasUnfinishedTreatments = this.executedTreatments().some(
      (t) => t.status === 3 || t.status === 1,
    );
    const hasActivePlans = this.treatmentPlans().some((p) => p.status === 1);
    return hasUnfinishedTreatments || hasActivePlans;
  }

  unfinishedWorkSummary(): string {
    const parts: string[] = [];
    for (const t of this.getUnfinishedTreatments()) {
      const teethStr = t.toothNumbers?.length ? `(#${t.toothNumbers.join(', #')})` : '';
      const notes = t.notes ? `[${t.notes}]` : '';
      parts.push(`${t.treatmentName} ${teethStr} ${notes}`.trim());
    }
    for (const p of this.treatmentPlans().filter((x) => x.status === 1)) {
      parts.push(`خطة: ${p.title}`);
    }
    return parts.join(' · ');
  }

  applyUnfinishedToFollowUpNotes() {
    const summary = this.unfinishedWorkSummary();
    if (summary) {
      this.suggestedFollowUpNotes = `متابعة واستكمال: ${summary}`;
    }
  }

  selectFollowUpDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().slice(0, 10);
    this.suggestedFollowUpDate = dateStr;
    this.loadAvailabilitySlots(dateStr);
  }

  isFollowUpSelected(days: number): boolean {
    if (!this.suggestedFollowUpDate) return false;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return this.suggestedFollowUpDate === d.toISOString().slice(0, 10);
  }

  loadAvailabilitySlots(dateStr?: string) {
    const d = dateStr || this.suggestedFollowUpDate;
    if (!d) return;
    this.suggestedFollowUpDate = d;
    this.selectedSlot.set(null);
    this.bookedAppointment.set(null);
    this.bookingError.set('');

    const app = this.appointment();
    const e = this.examination();
    const doctorId = app?.doctorProfileId || e?.doctorUserId;
    if (!doctorId) return;

    this.loadingSlots.set(true);
    this.appointmentApi.availability(doctorId, d, this.followUpDuration).subscribe({
      next: (slots) => {
        this.availableSlots.set(slots || []);
        this.loadingSlots.set(false);
        if (slots && slots.length > 0) {
          this.selectedSlot.set(slots[0]);
        }
      },
      error: () => {
        this.loadingSlots.set(false);
        this.availableSlots.set([]);
      },
    });
  }

  formatSlotTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const isAr = this.i18n.language() === 'ar';
    const ampm = h >= 12 ? (isAr ? 'م' : 'PM') : (isAr ? 'ص' : 'AM');
    h = h % 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  bookAppointmentNow() {
    const e = this.examination();
    const app = this.appointment();
    const slot = this.selectedSlot();
    if (!e || !slot) return;

    const doctorId = app?.doctorProfileId || e.doctorUserId;
    const remaining = this.unfinishedWorkSummary();
    const note =
      this.suggestedFollowUpNotes ||
      (remaining ? `متابعة واستكمال: ${remaining}` : 'موعد متابعة سريرية');

    this.bookingAppointment.set(true);
    this.bookingError.set('');

    this.appointmentApi
      .create({
        patientId: e.patientId,
        doctorProfileId: doctorId,
        type: this.hasUnfinishedWork() ? 4 : 2,
        time: {
          date: slot.localDate,
          startTime: slot.localStartTime,
          durationMinutes: this.followUpDuration,
        },
        notes: note,
      })
      .subscribe({
        next: (res) => {
          this.bookingAppointment.set(false);
          this.bookedAppointment.set({
            id: res.id,
            date: slot.localDate,
            time: this.formatSlotTime(slot.localStartTime),
          });
          this.success.set(
            this.t(
              `Appointment booked successfully for ${slot.localDate} at ${this.formatSlotTime(slot.localStartTime)}!`,
              `تم حجز الموعد بنجاح ليوم ${slot.localDate} الساعة ${this.formatSlotTime(slot.localStartTime)}!`,
            ),
          );
        },
        error: () => {
          this.bookingAppointment.set(false);
          this.bookingError.set(
            this.t(
              'Could not book this appointment slot. Please try another time.',
              'تعذر حجز هذا الموعد. يرجى تجربة وقت آخر.',
            ),
          );
        },
      });
  }



  loadMedicationsCatalog() {
    this.prescriptionApi.medications('', undefined, false, 1, 100).subscribe({
      next: (x) => this.catalogMedications.set(x.items ?? []),
      error: () => {},
    });
  }

  getCatalogMedDisplayName(m: Medication): string {
    const meta = parseMedicationNotes(m.notes);
    if (meta.nameAr && meta.nameEn && meta.nameAr !== meta.nameEn) {
      return `${meta.nameAr} (${meta.nameEn})`;
    }
    return meta.nameAr || meta.nameEn || m.name;
  }

  toggleCustomMed(med: PrescribedMedicineRow, isCustom: boolean) {
    med.isCustom = isCustom;
  }

  addMedicineRow() {
    const isAr = this.i18n.language() === 'ar';
    this.prescriptionItems.push({
      medicationName: '',
      dose: isAr ? '1 قرص' : '1 Tablet',
      frequency: isAr ? 'كل 8 ساعات' : 'Every 8 hours',
      duration: isAr ? '5 أيام' : '5 days',
      instructions: isAr ? 'بعد الأكل' : 'After meals',
      isCustom: false,
    });
  }

  removeMedicineRow(index: number) {
    this.prescriptionItems.splice(index, 1);
  }

  addMedicationPreset(preset: DentalMedicationPreset) {
    const isAr = this.i18n.language() === 'ar';
    const localizedName = isAr ? (preset.nameAr || preset.name) : (preset.nameEn || preset.name);
    const newRow: PrescribedMedicineRow = {
      medicationId: preset.id,
      medicationName: localizedName,
      dose: preset.dose || (isAr ? '1 قرص' : '1 Tablet'),
      frequency: preset.frequency || (isAr ? 'كل 8 ساعات' : 'Every 8 hours'),
      duration: preset.duration || (isAr ? '5 أيام' : '5 days'),
      instructions: preset.instructions || (isAr ? 'بعد الأكل' : 'After meals'),
      isCustom: false,
    };

    if (this.prescriptionItems.length === 1 && !this.prescriptionItems[0].medicationName.trim()) {
      this.prescriptionItems[0] = newRow;
    } else {
      this.prescriptionItems.push(newRow);
    }
  }

  applyPresetToRow(row: PrescribedMedicineRow, preset: DentalMedicationPreset) {
    const isAr = this.i18n.language() === 'ar';
    row.medicationId = preset.id;
    row.medicationName = isAr ? (preset.nameAr || preset.name) : (preset.nameEn || preset.name);
    row.isCustom = false;
    if (preset.dose) row.dose = preset.dose;
    if (preset.frequency) row.frequency = preset.frequency;
    if (preset.duration) row.duration = preset.duration;
    if (preset.instructions) row.instructions = preset.instructions;
  }

  onMedDropdownSelect(index: number, selectedName: string) {
    if (!selectedName) return;
    const row = this.prescriptionItems[index];
    if (!row) return;

    if (selectedName === '__custom__') {
      row.isCustom = true;
      row.medicationName = '';
      return;
    }

    const isAr = this.i18n.language() === 'ar';
    let foundPreset: DentalMedicationPreset | undefined = this.allAvailableMedications().find(
      (p) =>
        p.name === selectedName ||
        p.nameAr === selectedName ||
        p.nameEn === selectedName ||
        this.t(p.nameEn || p.name, p.nameAr || p.name) === selectedName,
    );

    if (!foundPreset) {
      const m = this.catalogMedications().find((x) => this.getCatalogMedDisplayName(x) === selectedName);
      if (m) {
        const meta = parseMedicationNotes(m.notes);
        foundPreset = {
          id: m.id,
          name: this.getCatalogMedDisplayName(m),
          genericName: m.genericName,
          strength: m.strength,
          form: m.form,
          dose: meta.defaultDose || (isAr ? '1 قرص' : '1 Tablet'),
          frequency: meta.defaultFrequency || (isAr ? 'كل 8 ساعات' : 'Every 8 hours'),
          duration: meta.defaultDuration || (isAr ? '5 أيام' : '5 days'),
          instructions: meta.defaultInstructions || (isAr ? 'بعد الأكل' : 'After meals'),
        };
      }
    }

    if (foundPreset) {
      this.applyPresetToRow(row, foundPreset);
    } else {
      row.medicationName = selectedName;
    }
  }

  onMedNameInput(index: number) {
    const row = this.prescriptionItems[index];
    if (!row || !row.medicationName) return;
    const typed = row.medicationName.trim().toLowerCase();
    const found = this.allAvailableMedications().find(
      (p) =>
        p.name.toLowerCase() === typed ||
        (p.nameAr && p.nameAr.toLowerCase() === typed) ||
        (p.nameEn && p.nameEn.toLowerCase() === typed) ||
        (p.genericName && p.genericName.toLowerCase() === typed),
    );
    if (found) {
      if (!row.dose || row.dose === '1 قرص' || row.dose === '1 Tablet') row.dose = found.dose;
      if (!row.frequency || row.frequency === 'كل 8 ساعات' || row.frequency === 'Every 8 hours') row.frequency = found.frequency;
      if (!row.duration || row.duration === '5 أيام' || row.duration === '5 days') row.duration = found.duration;
      if (!row.instructions || row.instructions === 'بعد الأكل' || row.instructions === 'After meals') row.instructions = found.instructions;
      if (found.id) row.medicationId = found.id;
    }
  }

  savePrescriptionDraft() {
    const e = this.examination();
    const app = this.appointment();
    if (!e) return;

    const validItems = this.prescriptionItems.filter((x) => x.medicationName.trim());
    if (validItems.length === 0) {
      this.error.set(this.t('Please enter at least one medication.', 'يرجى إدخال دواء واحد على الأقل.'));
      return;
    }

    this.savingRx.set(true);
    const doctorId = app?.doctorProfileId || e.doctorUserId;

    this.prescriptionApi.create({
      patientId: e.patientId,
      doctorProfileId: doctorId,
      appointmentId: this.appointmentId,
      examinationId: e.id,
      notes: this.prescriptionGeneralNotes,
      items: validItems.map((item, idx) => ({
        medicationName: item.medicationName,
        dose: item.dose,
        frequency: item.frequency,
        duration: item.duration,
        instructions: item.instructions,
        sortOrder: idx + 1,
      })),
    }).subscribe({
      next: () => {
        this.savingRx.set(false);
        this.success.set(this.t('Prescription saved to patient record.', 'تم حفظ الروشتة في سجل المريض بنجاح.'));
      },
      error: () => {
        this.savingRx.set(false);
        this.error.set(this.t('Could not save prescription.', 'تعذر حفظ الروشتة.'));
      },
    });
  }

  async recordPayment() {
    const e = this.examination();
    if (!e || this.paymentAmount <= 0) return;

    this.recordingPayment.set(true);
    let amountToPay = this.paymentAmount;
    const todayDate = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toTimeString().slice(0, 5);

    try {
      // 1. Check for patient's existing unpaid revenues
      let unpaidList: any[] = [];
      try {
        const revRes = await firstValueFrom(this.financeApi.revenues({ patientId: e.patientId, pageSize: 50 }));
        unpaidList = (revRes?.items ?? []).filter((r: any) => (r.outstanding || 0) > 0);
      } catch {
        // If listing revenues fails (e.g. role restrictions), fallback gracefully to direct payment
      }

      if (unpaidList.length > 0) {
        for (const r of unpaidList) {
          if (amountToPay <= 0) break;
          const payForThis = Math.min(amountToPay, r.outstanding);
          await firstValueFrom(
            this.financeApi.createPayment({
              revenueId: r.id,
              patientId: e.patientId,
              treatmentId: r.treatmentId,
              amount: payForThis,
              paymentMethod: Number(this.paymentMethod),
              paidDate: todayDate,
              paidTime: nowTime,
              notes: `سداد أثناء جلسة الكشف #${this.appointmentId.slice(0, 8)}`,
            }),
          );
          amountToPay -= payForThis;
        }
      }

      // If any amount remains (or if patient has no specific unpaid revenues), post as patient payment
      if (amountToPay > 0) {
        await firstValueFrom(
          this.financeApi.createPayment({
            patientId: e.patientId,
            amount: amountToPay,
            paymentMethod: Number(this.paymentMethod),
            paidDate: todayDate,
            paidTime: nowTime,
            notes: `سداد دفعة أثناء جلسة الكشف #${this.appointmentId.slice(0, 8)}`,
          }),
        );
      }

      this.recordingPayment.set(false);
      this.success.set(this.t('Payment recorded successfully.', 'تم تسجيل الدفعة بنجاح.'));
      this.paymentAmount = 0;
      this.loadBalance(e.patientId);
    } catch (err: any) {
      this.recordingPayment.set(false);
      const rawError = parseApiError(err, this.t('Could not record payment.', 'تعذر تسجيل الدفعة.'));
      let arabicDesc = rawError;
      if (rawError.includes('exceeds the outstanding') || rawError.includes('Payment exceeds')) {
        arabicDesc = this.t(
          'Payment exceeds the patient outstanding balance.',
          'المبلغ المدفوع يتجاوز إجمالي الرصيد المستحق على هذا المريض.',
        );
      } else if (rawError.includes('posted revenue') || rawError.includes('required')) {
        arabicDesc = this.t(
          'A posted procedure or active balance is required to collect payment.',
          'يجب ترحيل إجراءات الجلسة أو وجود رصيد مستحق لتسجيل الدفعة.',
        );
      }
      this.paymentErrorModal.set({
        isOpen: true,
        title: this.t('Payment Collection Error', 'تعذر تسجيل الدفعة المالية'),
        message: arabicDesc,
        details: rawError !== arabicDesc ? rawError : undefined,
      });
    }
  }

  async completeVisit() {
    const e = this.examination();
    if (!e) return;

    const confirmed = await this.confirmDialog.ask({
      title: this.t('Complete Clinical Visit', 'إنهاء الزيارة وقفل الجلسة'),
      message: this.t(
        'Are you sure you want to finalize this clinical visit, lock examination records, and post billing to patient account?',
        'هل أنت متأكد من إنهاء الزيارة السريرية، قفل سجلات الفحص، واعتماد الفاتورة على حساب المريض؟',
      ),
      confirmText: this.t('Yes, Finalize & Complete', 'نعم، إنهاء وقفل الجلسة'),
      cancelText: this.t('Cancel', 'تراجع'),
      variant: 'success',
      icon: '✓',
    });

    if (!confirmed) return;

    this.api.complete(e.id, e.version).subscribe({
      next: () => {
        this.appointmentApi.action(this.appointmentId, 'complete').subscribe({
          next: () => {},
          error: () => {},
        });
        this.success.set(this.t('Visit completed and locked successfully.', 'تم إنهاء الجلسة السريرية وقفل السجل بنجاح.'));
        this.load();
      },
      error: (err) => this.fail(err),
    });
  }

  complete() {
    this.completeVisit();
  }

  toggleSurface(kind: 'finding' | 'procedure', value: number) {
    const control = (kind === 'finding' ? this.findingForm : this.procedureForm).controls.surfaces;
    let next = control.value.includes(value)
      ? control.value.filter((x) => x !== value)
      : [...control.value, value];
    if (value === 1 && next.includes(1)) next = [1];
    else if (value !== 1) next = next.filter((x) => x !== 1);
    control.setValue(next);
  }

  hasSurface(kind: 'finding' | 'procedure', value: number) {
    return (
      kind === 'finding' ? this.findingForm : this.procedureForm
    ).controls.surfaces.value.includes(value);
  }

  surfaceLabels(values: number[]) {
    return (
      values
        .map((v) => {
          const x = SURFACES.find((s) => s[0] === v)!;
          return this.t(x[1], x[2]);
        })
        .join(', ') || this.t('No surface', 'بدون سطح')
    );
  }

  findingLabel(v: number) {
    const x = FINDING_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }

  procedureLabel(v: number) {
    const x = PROCEDURE_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }

  private mutate(
    request: {
      subscribe: (x: { next: () => void; error: (e: HttpErrorResponse) => void }) => unknown;
    },
    message = '',
  ) {
    this.error.set('');
    request.subscribe({
      next: () => {
        this.success.set(message);
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }

  private fail(e: HttpErrorResponse) {
    this.loading.set(false);
    this.error.set(
      e.status === 409
        ? this.t(
            'This examination changed or is locked. Reload before continuing.',
            'تم تغيير هذا الفحص أو قفله. أعد التحميل قبل المتابعة.',
          )
        : this.t(
            'The clinical request was rejected or access was denied.',
            'تم رفض الطلب السريري أو الوصول غير مسموح.',
          ),
    );
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }

  localDate(value: string, zone?: string) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: zone || 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date(value));
      const y = parts.find((p) => p.type === 'year')?.value;
      const m = parts.find((p) => p.type === 'month')?.value;
      const d = parts.find((p) => p.type === 'day')?.value;
      return `${y}-${m}-${d}`;
    } catch {
      return value.slice(0, 10);
    }
  }

  time(value: string, zone?: string) {
    try {
      return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
        timeZone: zone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(value));
    } catch {
      const d = new Date(value);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }

  dayLabel(day: string) {
    try {
      const [y, m, d] = day.split('-').map(Number);
      return new Intl.DateTimeFormat(this.i18n.language() === 'ar' ? 'ar-EG' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      }).format(new Date(y, m - 1, d));
    } catch {
      return day;
    }
  }
}

