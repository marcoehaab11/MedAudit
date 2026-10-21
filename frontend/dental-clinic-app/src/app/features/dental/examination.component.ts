import { ExtractionDraft, ExtractionEditorComponent } from './extraction-editor.component';
import { CommonModule } from '@angular/common';
import { afterNextRender, Component, computed, ElementRef, HostListener, inject, Injector, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, switchMap, of } from 'rxjs';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { AuthService } from '../../core/auth.service';
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
import { FINDING_APPEARANCE, SELECTABLE_FINDING_TYPES, PROCEDURE_APPEARANCE, SURFACES } from './dental-appearance';
import { DentalApiService, ExaminationDetails, ToothChartSummary, PatientDentalChart, EndodonticRecord } from './dental-api.service';
import { RootCanalEditorComponent } from './root-canal-editor.component';
import { RootCanalDraft, rootCanalDraft, rootCanalStages, serializeWorkflow, workflowFor } from './root-canal';
import { DentalChartComponent } from './dental-chart.component';
import { allowedCariesClasses, toothName } from './tooth-labels';
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

interface ToothServiceDraft {
  catalogId: string;
  tierId: string;
  price: number;
  cariesClass: number | null;
  fillingMaterial?: string;
  extraction?: ExtractionDraft;
  notes: string;
  remaining: string;
  status: 'completed' | 'in_progress';
  treatmentId?: string;
  treatmentType?: number;
  treatmentName?: string;
  confirmedCompleted?: boolean;
}

@Component({
  styleUrl: './dental.scss',
  selector: 'app-examination',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, ReactiveFormsModule, DentalChartComponent, DateInputComponent, TagInputComponent, PatientVisitHistorySheetComponent, RootCanalEditorComponent, ExtractionEditorComponent],
  template: `
    <div class="clinical-visit-container" [attr.dir]="t('ltr', 'rtl')" [class.intake-redesign]="!!examination() && examination()!.status !== 2 && !loading()">
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
        } @else if (appointment()!.status === 4 && !auth.hasPermission('Examination.Create')) {
          <section class="step-card intake-start-gate">
            <h2>{{ t('Session started', 'الجلسة بدأت') }}</h2>
            <p>{{ appointment()!.patientName }} · {{ appointment()!.doctorName }}</p>
            <p>{{ t('The doctor can now open and record the examination.', 'الطبيب يقدر دلوقتي يفتح ويسجل الفحص.') }}</p>
            <a class="button" routerLink="/appointments">{{ t('Back to appointments', 'العودة للمواعيد') }}</a>
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
                [disabled]="startingGate() || !auth.hasPermission('Appointments.Start')"
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
            <div class="patient-avatar">{{ examination()!.patientName.slice(0, 1) }}</div>
            <div class="patient-info">
              <span class="patient-code">{{ examination()!.patientNumber }}</span>
              <h1 class="patient-name">{{ examination()!.patientName }}</h1>
              <p class="patient-meta">
                <span>{{ examination()!.doctorName }}</span>
                @if (patient()?.phone) {
                  <span dir="ltr">{{ patient()!.phone }}</span>
                }
                @if (patient()?.gender !== undefined) {
                  <span>{{ patient()!.gender === 1 ? t('Male', 'ذكر') : t('Female', 'أنثى') }}</span>
                }
                @if (patientAge() !== null) { <span>{{ patientAge() }} {{ t('years', 'سنة') }}</span> }
              </p>
            </div>
          </div>
          @if (examination()) {
            <button type="button" class="intake-history-shortcut" (click)="showVisitHistorySheet.set(true)">
              <span class="intake-icon">↺</span>{{ t('Patient visit history', 'تاريخ زيارات المريض') }} <span aria-hidden="true">‹</span>
            </button>
          }
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
                <span class="pill-badge-action">{{ t('Review', 'مراجعة') }} ‹</span>
                @if (examination()) { <span class="intake-alert-preview">@for (item of patientAllergies.slice(0, 1); track item) { <span>{{ item }}</span> } @for (item of patientConditions.slice(0, 1); track item) { <span>{{ item }}</span> }</span> }
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
          @if (examination()) { <a class="intake-brand" routerLink="/dashboard"><svg viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M8 3C1 2 2 13 5 19L8 31C10 37 13 30 14 24C15 19 17 19 18 24C19 30 22 37 24 31L27 19C30 13 31 2 24 3C20 2 19 6 16 6C13 6 12 2 8 3Z" stroke="currentColor" stroke-width="2.3"/></svg>Planora</a> }

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
                  <span class="step-title">{{ t(s.en, s.ar).slice(3) }}</span>
                </div>
              </button>
            }
          </div>
          @if (examination()) { <a class="intake-close" routerLink="/appointments">{{ t('Close', 'إغلاق') }} <span aria-hidden="true">×</span></a> }
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

        @if (medicalHistoryError()) {
          <p class="alert" role="alert">{{ medicalHistoryError() }} <button type="button" (click)="refreshPatientMedicalHistory(examination()!.patientId)">{{ t('Retry', 'إعادة المحاولة') }}</button></p>
        }
        @if (treatmentHistoryError()) {
          <p class="alert" role="alert">{{ treatmentHistoryError() }} <button type="button" (click)="loadTreatments(examination()!.patientId)">{{ t('Retry', 'إعادة المحاولة') }}</button></p>
        }
        @if (getUnfinishedTreatments().length > 0) {
          <section class="step-card continuing-work" aria-label="Ongoing patient treatment">
            <h2>{{ t('Where treatment stopped — work to continue', 'آخر ما وصل إليه العلاج — المطلوب استكماله') }}</h2>
            @for (work of getUnfinishedTreatments(); track work.id) {
              <article>
                <strong>{{ work.treatmentName }}</strong>
                <span>{{ work.status === 3 ? t('In progress', 'قيد العلاج') : work.status === 2 ? t('Scheduled', 'مجدول') : t('Planned', 'مخطط') }}</span>
                <p>@for (number of work.toothNumbers; track number) { <span>#{{ number }} · {{ toothLabel(number) }} </span> }</p>
                @if (work.notes) { <p class="remaining-work-notes">{{ work.notes }}</p> }
                @if ([4,5].includes(work.type) && work.toothNumbers.length === 1 && examination()!.canEdit) {
                  <button type="button" class="resume-saved-treatment" [disabled]="savingTreatment() || savingRootCanal()" (click)="resumeRootCanal(work)">{{ t('Open existing treatment', 'فتح العلاج المسجل واستكماله') }} ←</button>
                } @else {
                  <a [routerLink]="['/treatments', work.id]">{{ t('Open existing treatment', 'فتح العلاج المسجل واستكماله') }} ←</a>
                }
              </article>
            }
          </section>
        }
        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 1: INTAKE & CHIEF COMPLAINT (الاستقبال والشكوى)            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 1) {
          <section class="intake-workspace" aria-label="{{ t('Patient reception', 'استقبال المريض') }}">
            <div class="intake-medical-panel intake-panel">
              <header class="intake-panel-heading">
                <span class="intake-icon" aria-hidden="true">♡</span>
                <div><h2>{{ t('General medical history', 'التاريخ الطبي العام') }}</h2><p>{{ t('Review the patient’s recorded medical information.', 'راجع بيانات المريض الطبية المسجلة، وافتح القسم لتعديلها.') }}</p></div>
              </header>
              <div class="intake-history-list">
                <details class="intake-history-item allergies" [open]="intakeMedicalEditing">
                  <summary><span class="history-symbol" aria-hidden="true">✧</span><strong>{{ t('Allergies', 'الحساسيات') }}</strong><span class="history-tags">@for (item of patientAllergies; track item) { <span>{{ item }}</span> } @empty { <small>{{ t('None recorded', 'لا توجد بيانات مسجلة') }}</small> }</span><span class="history-chevron" aria-hidden="true">⌄</span></summary>
                  <div class="history-editor"><app-tag-input [tags]="patientAllergies" (tagsChange)="onAllergiesChange($event)" theme="danger" [placeholder]="t('Type an allergy and press Enter…', 'اكتب الحساسية واضغط Enter…')" [suggestions]="allergySuggestions" /></div>
                </details>
                <details class="intake-history-item conditions" [open]="intakeMedicalEditing">
                  <summary><span class="history-symbol" aria-hidden="true">♡</span><strong>{{ t('Chronic conditions', 'الأمراض المزمنة') }}</strong><span class="history-tags">@for (item of patientConditions; track item) { <span>{{ item }}</span> } @empty { <small>{{ t('None recorded', 'لا توجد بيانات مسجلة') }}</small> }</span><span class="history-chevron" aria-hidden="true">⌄</span></summary>
                  <div class="history-editor"><app-tag-input [tags]="patientConditions" (tagsChange)="onConditionsChange($event)" theme="warning" [placeholder]="t('Type a condition and press Enter…', 'اكتب الحالة واضغط Enter…')" [suggestions]="conditionSuggestions" /></div>
                </details>
                <details class="intake-history-item medications" [open]="intakeMedicalEditing">
                  <summary><span class="history-symbol" aria-hidden="true">◈</span><strong>{{ t('Current medications', 'الأدوية الحالية') }}</strong><span class="history-tags">@for (item of patientMedications; track item) { <span>{{ item }}</span> } @empty { <small>{{ t('None recorded', 'لا توجد بيانات مسجلة') }}</small> }</span><span class="history-chevron" aria-hidden="true">⌄</span></summary>
                  <div class="history-editor"><app-tag-input [tags]="patientMedications" (tagsChange)="onMedicationsChange($event)" theme="info" [placeholder]="t('Type a medication and press Enter…', 'اكتب الدواء واضغط Enter…')" [suggestions]="medicationSuggestions" /></div>
                </details>
                <details class="intake-history-item">
                  <summary><span class="history-symbol" aria-hidden="true">⌁</span><strong>{{ t('Surgical history', 'التاريخ الجراحي') }}</strong><span class="history-tags"><small>{{ patient()?.surgeries?.length ? patient()!.surgeries.length + ' ' + t('record(s)', 'سجل') : t('None recorded', 'لا توجد بيانات مسجلة') }}</small></span><span class="history-chevron" aria-hidden="true">⌄</span></summary>
                  <div class="history-readonly">@for (surgery of patient()?.surgeries ?? []; track surgery.id) { <p><strong>{{ surgery.procedure }}</strong> @if (surgery.procedureDate) { <span>{{ surgery.procedureDate }}</span> } @if (surgery.notes) { <span>{{ surgery.notes }}</span> }</p> } @empty { <p>{{ t('No surgical history recorded.', 'لا يوجد تاريخ جراحي مسجل.') }}</p> }</div>
                </details>
                @if (patient()?.medicalNotes) { <details class="intake-history-item"><summary><span class="history-symbol" aria-hidden="true">≡</span><strong>{{ t('Other medical notes', 'ملاحظات طبية أخرى') }}</strong><span class="history-chevron" aria-hidden="true">⌄</span></summary><p class="history-readonly">{{ patient()!.medicalNotes }}</p></details> }
              </div>
              <button type="button" class="intake-edit-all" (click)="intakeMedicalEditing = !intakeMedicalEditing">{{ intakeMedicalEditing ? t('Collapse sections', 'طي الأقسام') : t('Edit medical information', 'تعديل البيانات الطبية') }} <span aria-hidden="true">✎</span></button>
            </div>
            <div class="intake-visit-column">
              <form [formGroup]="notesForm" (ngSubmit)="saveNotes()" class="intake-panel intake-complaint-panel">
                <header class="intake-panel-heading"><span class="intake-icon" aria-hidden="true">≡</span><div><h2>{{ t('Chief complaint & visit notes', 'الشكوى الرئيسية وملاحظات الكشف') }}</h2><p>{{ t('Document the patient’s complaint, symptoms and clinical notes for this visit.', 'دوّن شكوى المريض والأعراض وملاحظاتك الخاصة بالزيارة.') }}</p></div></header>
                <label class="intake-complaint-field"><span class="sr-only">{{ t('Visit notes and chief complaint', 'شكوى المريض وملاحظات الكشف') }}</span><textarea formControlName="notes" [readonly]="!examination()!.canEdit" [placeholder]="t('Write the patient’s complaint and your clinical notes…', 'اكتب شكوى المريض وملاحظات الكشف هنا…')" rows="7"></textarea></label>
                <div class="intake-note-actions"><span>{{ t('Saved to this visit’s clinical record.', 'تُحفظ في السجل السريري لهذه الزيارة.') }}</span>@if (examination()!.canEdit) { <button type="submit" class="button secondary">{{ t('Save draft', 'حفظ المسودة') }}</button> }</div>
              </form>
              <section class="intake-panel intake-visit-context">
                <header class="intake-panel-heading"><span class="intake-icon" aria-hidden="true">↺</span><div><h2>{{ t('Patient record & previous visits', 'سجل المريض والزيارات السابقة') }}</h2><p>{{ t('Review previous treatment and where the patient’s care has reached.', 'راجع العلاجات السابقة وآخر ما وصل إليه علاج المريض.') }}</p></div></header>
                <button type="button" class="intake-record-link" (click)="showVisitHistorySheet.set(true)"><span>{{ t('Open patient visit history', 'فتح سجل زيارات المريض') }}</span><span aria-hidden="true">‹</span></button>
                @if (appointment() && appointment()!.status === 3 && auth.hasPermission('Appointments.Start')) { <button type="button" class="button secondary" (click)="startSession()">{{ t('Start visit timer', 'بدء وقت الجلسة الفعلي') }}</button> }
              </section>
            </div>
            <footer class="intake-bottom-bar"><a routerLink="/appointments" class="intake-cancel">{{ t('Close', 'إغلاق') }} <span aria-hidden="true">×</span></a><span class="intake-save-help">{{ t('Save your notes using Save draft.', 'احفظ ملاحظاتك من زر حفظ المسودة.') }}</span><button type="button" class="button primary" (click)="setStep(2)">{{ t('Continue to dental chart', 'متابعة إلى مخطط الأسنان') }} <span aria-hidden="true">←</span></button></footer>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 2: DENTAL CHART & FINDINGS (فحص مخطط الأسنان)              -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 2) {
          <section class="step-card chart-step-card">
            <div class="step-header-title"><h2>{{ t('2. Dental chart & findings', '2. فحص ومخطط الأسنان') }}</h2>
              <p>{{ t('Hover over or select a tooth to record a problem. Treatment for today is selected separately.', 'مرر على السن أو اضغط عليه لتسجيل المشكلة. أسنان علاج اليوم يتم اختيارها بشكل مستقل.') }}</p>
            </div>
            <div class="chart-side-layout">
            <div class="chart-drawing">
            <app-dental-chart [showHeading]="false" [showSearch]="false" [teeth]="chartTeeth()" [completedHighlights]="recentlyCompletedTeeth()" [multiSelect]="true" [selectedNumber]="selected" [selectedTeeth]="selectedTeeth"
              [showQuickFindings]="examination()!.canEdit" [savingFinding]="savingFinding()"
              (selectedNumberChange)="onSelectedToothChange($event)" (selectedTeethChange)="onSelectedTeethChange($event)"
              (findingSelected)="chooseFindingType($event)" (toothFindingSelected)="chooseToothFinding($event)" />
            </div>
            <aside class="chart-selection-sidebar">
            <section class="tooth-details selected-teeth-panel">
              <h3>{{ t('Selected teeth', 'الأسنان المختارة') }}</h3>
              @if (patientChartError()) { <p class="alert">{{ t('Could not load previous dental records.', 'تعذر تحميل سجل الأسنان السابق.') }} <button type="button" (click)="loadPatient(examination()!.patientId)">{{ t('Retry', 'إعادة المحاولة') }}</button></p> }
              @if (patientChart(); as previous) {
                <details><summary>{{ t('Previous patient dental records', 'سجل الأسنان من الجلسات السابقة') }}</summary>
                  @for (tooth of previous.teeth; track tooth.toothNumber) {
                    @if (tooth.findings.length || tooth.procedures.length) {
                      <p><strong>#{{ tooth.toothNumber }} · {{ toothLabel(tooth.toothNumber) }}</strong>
                      @for (type of tooth.findings; track type) { <span class="clinical-tag">{{ findingLabel(type) }}</span> }
                      @for (work of tooth.treatmentProgress ?? []; track work.id) { <span class="clinical-tag">{{ work.status === 4 ? '✓ ' : '◷ ' }}{{ work.name }} · {{ work.status === 4 ? t('Done', 'تم') : work.status === 3 ? t('In progress', 'قيد العلاج') : work.status === 5 ? t('Cancelled', 'ملغي') : t('Pending', 'لم يتم بعد') }}</span> }
                      </p>
                    }
                  }
                </details>
              }

              <div class="record-stack">
                @for (item of sidebarToothFindings(); track item.id) {
                  <article><div><strong>{{ isWholeMouthFinding(item.type) ? t('Whole mouth', 'الفم بالكامل') : '#' + item.toothNumber + ' · ' + toothLabel(item.toothNumber) }} · {{ findingLabel(item.type) }}</strong>
                    @if (item.cariesClass || item.surfaces.length) { <small>{{ findingDetailsLabel(item) }}</small> }
                    @if (item.notes) { <p>{{ item.notes }}</p> }
                  </div>
                    @if (examination()!.canEdit && item.type === 2) { <button type="button" [disabled]="savingFinding()" (click)="editCariesFinding(item)">{{ t('Edit classification', 'تعديل التصنيف') }}</button> }
                    @if (examination()!.canEdit) { <button type="button" class="danger-link" [disabled]="savingFinding()" (click)="removeFinding(item.id)">{{ t('Remove', 'حذف') }}</button> }
                  </article>
                } @empty { <p>{{ t('No findings recorded yet.', 'لا توجد نتائج مسجلة بعد.') }}</p> }
              </div>
              @if (examination()!.canEdit) {
                <details class="chart-service-settings"><summary>{{ t('Chart services', 'خدمات مخطط الأسنان') }}</summary>
                  @for (number of availableTreatmentTeeth(); track number) {
                    @let row = toothService(number);
                    <label>{{ number <= 0 ? wholeMouthLabel(number) : toothLabel(number) + ' · #' + number }}
                      <select [(ngModel)]="row.catalogId" (change)="selectToothService(number)" [disabled]="!!row.treatmentId">
                        <option value="">{{ t('Choose the clinic service', 'اختر خدمة العيادة') }}</option>
                        @for (item of toothServiceCatalog(number); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
                      </select>
                    </label>
                  }
                  <label><input type="checkbox" [(ngModel)]="wholeMouthTreatment" />{{ t('Whole-mouth service', 'خدمة للفم بالكامل') }}</label>
                  @if (wholeMouthTreatment) {
                    @let row = toothService(0);
                    <select [(ngModel)]="row.catalogId" (change)="selectToothService(0)">
                      <option value="">{{ t('Choose the clinic service', 'اختر خدمة العيادة') }}</option>
                      @for (item of toothServiceCatalog(0); track item.id) { <option [value]="item.id">{{ item.name }}</option> }
                    </select>
                  }
                </details>
              }
              @if (examination()!.canEdit && (selectedTeeth.length || findingTargetTeeth.length) && findingEditorOpen) {
                <form class="clinical-form" [formGroup]="findingForm" (ngSubmit)="addFinding()">
                  <p>{{ t('Record for:', 'تسجيل للأسنان:') }} {{ findingTeethLabel() }}</p>
                  <label>{{ t('Problem type', 'نوع المشكلة') }}<select formControlName="type">
                    @for (item of findingOptions; track item.id) { <option [value]="item.id">{{ t(item.en, item.ar) }}</option> }
                  </select></label>
                  @if (+findingForm.controls.type.value === 2) {
                    <label>{{ t('Choose caries type', 'اختيار نوع التسوس') }}<select formControlName="cariesClass">
                      <option [ngValue]="null">{{ t('Select class…', 'اختر التصنيف…') }}</option>
                      @for (value of availableCariesClasses(); track value) { <option [ngValue]="value">Class {{ ['I','II','III','IV','V','VI'][value - 1] }}</option> }
                    </select></label>
                  }
                  <label>{{ t('Notes', 'ملاحظات') }}<textarea formControlName="notes" maxlength="2000"></textarea></label>
                  <button class="primary" [disabled]="savingFinding()">{{ menuCariesRecords.size ? t('Save classification', 'حفظ التصنيف') : t('Record finding', 'تسجيل النتيجة') }}</button>
                </form>
              }
            </section>
            <section class="whole-mouth-panel">
              <h3>{{ t('Full mouth services', 'خدمات الفم بالكامل') }}</h3>
              <div class="whole-mouth-cards chart-quick-findings">
                @for (type of wholeMouthFindingTypes; track type) {
                  <button type="button" class="whole-mouth-card" [class.is-selected]="wholeMouthFinding(type)" [disabled]="!examination()!.canEdit || savingFinding()" (click)="toggleWholeMouthFinding(type)">
                    <span class="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                      @if (type === 16) { <rect x="3" y="6" width="18" height="12" rx="4"/><path d="M3 12h18M8 9v6m8-6v6"/> }
                      @else if (type === 18) { <path d="M3 10c0-7 18-7 18 0v4c0 8-18 8-18 0v-4Zm0 2c4 5 14 5 18 0M7 14v4m5-3v4m5-5v4"/> }
                      @else if (type === 13) { <path d="m9 3 2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Zm10 12 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/> }
                      @else { <path d="M12 5C9 2 4 3 4 8c0 4 3 6 3 10 0 5 3 3 3 0 0-5 4-5 4 0 0 3 3 5 3 0 0-4 3-6 3-10 0-5-5-6-8-3Z"/><path d="m17 2 1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z"/> }
                    </svg></span>
                    <span>{{ findingLabel(type).replace(' — الفم بالكامل', '').replace(' (whole mouth)', '') }}</span><span class="service-state" aria-hidden="true">{{ wholeMouthFinding(type) ? '✓' : '+' }}</span>
                  </button>
                }
              </div>
            </section>
            </aside></div>
            <div class="step-navigation"><button type="button" class="button secondary prev-btn" (click)="setStep(1)">{{ t('Previous', 'السابق') }}</button><button type="button" class="button primary next-btn" (click)="setStep(3)">{{ t('Next: procedures & treatment plan', 'التالي: الإجراءات وخطة العلاج') }} {{ t('→', '←') }}</button></div>
          </section>
        }

        @if (step() === 3) {
          <section class="step-card procedures-plan-card">
            <div class="step-header-title">
              <h2>{{ t('Medical procedures for this visit', 'الإجراءات الطبية للزيارة') }}</h2><p>{{ t('Select teeth to view and record their procedures.', 'اختر الأسنان لعرض وتسجيل الإجراءات الطبية.') }}</p>
            </div>

            <!-- Split-View: Interactive Chart (Left) + Tooth Procedure Action Card (Right) -->
            @if (recentlyCompletedTeeth().length) { <div class="completed-teeth-notice" role="status">✓ {{ t('Completed teeth:', 'تم علاج الأسنان:') }} {{ recentlyCompletedTeeth().join(', ') }} <button type="button" (click)="setStep(2)">{{ t('View in chart', 'عرض في المخطط') }}</button></div> }
            <div class="step3-selection-summary">
              <div class="chart-col">
                <div class="treatment-selection-heading">
                  <div><h3>{{ t('Teeth selected for treatment', 'الأسنان المحددة للعلاج') }}</h3><p>{{ t('Choose the teeth to treat during this visit.', 'اختر الأسنان التي ستعمل عليها خلال هذه الزيارة.') }}</p></div><span class="selection-count">{{ treatmentTeeth.length }} {{ t('selected', 'سن محدد') }}</span>
                  <button type="button" class="clear-treatment-selection" [disabled]="!treatmentTeeth.length || savingTreatment() || savingRootCanal()" (click)="treatmentTeeth = []">{{ t('Clear selection', 'إلغاء التحديد') }}</button>
                </div>
                <div class="today-teeth-picker">
                  @for (number of availableTreatmentTeeth(); track number) {
                    <button type="button" class="treatment-tooth-chip" [class.selected]="treatmentTeeth.includes(number)" [attr.aria-pressed]="treatmentTeeth.includes(number)" [disabled]="savingTreatment() || savingRootCanal() || !examination()!.canEdit" (click)="toggleTreatmentTooth(number)">
                      <span class="chip-tooth-icon" aria-hidden="true"><svg viewBox="0 0 32 36" fill="none"><path d="M16 5C12 2 5 2 4 9c-1 6 3 10 4 15 1 4 1 9 4 9 2 0 1-12 4-12s2 12 4 12c3 0 3-5 4-9 1-5 5-9 4-15-1-7-8-7-12-4Z" stroke="currentColor" stroke-width="2"/></svg></span><strong>#{{ number }}</strong><span class="tooth-chip-name" dir="ltr">{{ toothLabel(number) }}</span><span class="chip-service-label">{{ treatmentSummaryLabels(number).join(' · ') }}</span>
                      @if (treatmentTeeth.includes(number)) { <span class="tooth-chip-check" aria-hidden="true">✓</span> }
                    </button>
                  } @empty { <p>{{ t('Record findings in the examination first.', 'سجل الأسنان ونتائج الكشف الأول.') }}</p> }
                </div>
              </div>

              <!-- Right: Tooth Action Card -->
              <aside class="tooth-action-col">
                <div class="tooth-action-card">
                  <!-- Selected Tooth Header -->
                  <div class="selected-treatment-summary" [class.has-procedures]="treatmentRowKeys().length > 0">
                    @for (number of treatmentTeeth; track number) {
                      <div class="selected-treatment-tooth">
                        <span class="selection-tooth-icon" aria-hidden="true">
                          <svg viewBox="0 0 32 36" fill="none"><path d="M16 5C12 2 5 2 4 9c-1 6 3 10 4 15 1 4 1 9 4 9 2 0 1-12 4-12s2 12 4 12c3 0 3-5 4-9 1-5 5-9 4-15-1-7-8-7-12-4Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
                          <span>✓</span>
                        </span>
                        <div class="selected-treatment-title">
                          <strong dir="ltr">{{ toothLabel(number) }} · #{{ number }}</strong>
                          <p>{{ t('Tooth selected for treatment', 'السن المحدد للعلاج') }}</p>
                        </div>
                        <div class="selected-treatment-labels">
                          @for (label of treatmentSummaryLabels(number); track label) { <span class="selected-treatment-badge">{{ label }}</span> }
                        </div>
                      </div>
                    } @empty { <div class="procedure-empty-state"><span aria-hidden="true"><svg viewBox="0 0 32 32" width="36" height="36" fill="none"><path d="M7 7h18l4 10v9H3v-9L7 7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M3 17h8l2 4h6l2-4h8" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg></span><h3>{{ t('No procedures to display yet', 'لا توجد إجراءات لعرضها حالياً') }}</h3><p>{{ t('Select a tooth above to view and record its procedure for this visit.', 'اختر سنًا من الأعلى لعرض تفاصيل الإجراء الطبي وتسجيل ما تم تنفيذه خلال هذه الزيارة.') }}</p></div> }
                  </div>

                  <!-- 2. Procedure Execution with Clinical Status -->
                  <div class="tooth-section procedure-select-section">
                    @if (examination()!.canEdit) {

                      @for (number of treatmentRowKeys(); track number) {
                        @let row = toothService(number);
                        <section class="catalog-select-box tooth-service-row" [class.filling-procedure]="toothServiceIsFilling(number)" [class.regular-filling-card]="toothServiceIsFilling(number) || toothServiceIsExtraction(number)" tabindex="-1" [attr.data-tooth]="number">
                          <header class="procedure-row-heading"><h3>{{ number <= 0 ? wholeMouthLabel(number) : '#' + number + ' · ' + toothLabel(number) }}</h3>@if (number > 0) { <span>{{ treatmentSummaryLabels(number).join(' · ') }}</span> }</header>
                          @if (number <= 0 && !toothServiceCatalog(number).length) { <p>{{ t('Add or activate this whole-mouth service and its price in the clinic service list first.', 'أضف خدمة الفم بالكامل المطلوبة وسعرها أو فعّلها من قائمة خدمات العيادة أولًا.') }}</p> }
                          @if (!toothServiceIsRootCanal(number)) {
                          <fieldset [disabled]="savingTreatment() || !!row.treatmentId">
                            @if (!row.catalogId) {
                              @if (matchingToothServices(number).length) {
                                <label>{{ number <= 0 ? wholeMouthLabel(number) : t('Clinic service for', 'خدمة العيادة للسن') + ' ' + toothLabel(number) + ' · #' + number }}
                                  <select [(ngModel)]="row.catalogId" (change)="selectToothService(number)">
                                    <option value="">{{ t('Choose the matching clinic service…', 'اختر الخدمة المناسبة من خدمات العيادة…') }}</option>
                                    @for (item of matchingToothServices(number); track item.id) { <option [value]="item.id">{{ serviceDisplayName(item) }}</option> }
                                  </select>
                                </label>
                              } @else {
                                <p role="alert">{{ t('No matching active clinic service. Add or activate it in Treatment Types & Prices.', 'لا توجد خدمة مفعلة مناسبة لهذا الإجراء. أضفها أو فعّلها من أنواع العلاجات والأسعار.') }}</p>
                              }
                            }
                            @if (row.catalogId) {
                              @if (toothServiceIsExtraction(number)) {
                                <app-extraction-editor [draft]="extractionFor(number)" [tooth]="number" [english]="t('en','ar') === 'en'" [disabled]="savingTreatment() || !!row.treatmentId" />
                              }
                              @if (toothServiceIsFilling(number)) {
                                <section class="filling-editor">
                                  <fieldset class="filling-choices"><legend>{{ t('Filling class', 'كلاس الحشو') }} <span aria-hidden="true">*</span></legend>
                                    <div class="filling-class-grid">
                                      @for (value of cariesClasses; track value) {
                                        <label class="filling-option" [class.is-selected]="row.cariesClass === value">
                                          <input type="radio" [name]="'filling-class-' + number" [(ngModel)]="row.cariesClass" [value]="value" required />
                                          <svg viewBox="0 0 56 64" width="40" height="46" fill="none" aria-hidden="true"><path d="M6 50c9-8 35-8 44 0v12H6Z" fill="#fbe4df"/><path d="M28 12C19 6 9 10 10 22c1 9 6 14 7 25 1 10 5 10 7 0l2-10c1-4 3-4 4 0l2 10c2 10 6 10 7 0 1-11 6-16 7-25 1-12-9-16-18-10Z" fill="#fff" stroke="#96aaa8" stroke-width="1.4"/>
                                          @switch (value) {
                                            @case (1) { <path d="M21 11q7 7 14 0l-3 8h-8Z" fill="#159c85"/> }
                                            @case (2) { <path d="M14 17h8v12h-7Z" fill="#159c85"/> }
                                            @case (3) { <path d="M36 23h7v11h-8Z" fill="#159c85"/> }
                                            @case (4) { <path d="m36 10 8 5-2 9h-7Z" fill="#159c85"/> }
                                            @case (5) { <ellipse cx="28" cy="31" rx="6" ry="5" fill="#159c85"/> }
                                            @case (6) { <path d="m16 12 5-2 2 7h-7Zm20-2 5 2v5h-7Z" fill="#159c85"/> }
                                          }</svg>
                                          <span dir="ltr">Class {{ ['I','II','III','IV','V','VI'][value - 1] }}</span>
                                        </label>
                                      }
                                    </div>
                                  </fieldset>
                                  <fieldset class="filling-choices"><legend>{{ t('Filling material', 'نوع الحشو') }} <span aria-hidden="true">*</span></legend>
                                    <div class="filling-material-grid">@for (material of fillingMaterials; track material) {
                                      <label class="filling-option" [class.is-selected]="row.fillingMaterial === material"><input type="radio" [name]="'filling-material-' + number" [(ngModel)]="row.fillingMaterial" [value]="material" required /><span dir="ltr">{{ material }}</span></label>
                                    }</div>
                                  </fieldset>
                                </section>
                                <details class="filling-followup" [open]="row.status === 'in_progress'"><summary>{{ t('Treatment follow-up (optional)', 'متابعة العلاج (اختياري)') }}</summary>
                                  <label>{{ t('Treatment status', 'حالة العلاج') }}<select [(ngModel)]="row.status"><option value="completed">{{ t('Completed today', 'تم الانتهاء اليوم') }}</option><option value="in_progress">{{ t('In progress — continue next visit', 'بدأ العلاج ولسه هنكمل') }}</option></select></label>
                                  @if (row.status === 'in_progress') { <label>{{ t('Remaining work', 'العمل المتبقي') }}<input [(ngModel)]="row.remaining" maxlength="1000" /></label> }
                                </details>
                              }
                              @if (!toothServiceIsRootCanal(number)) {
                              @if (!toothServiceIsExtraction(number) && !toothServiceIsFilling(number)) { <label>{{ t('Treatment status', 'حالة العلاج') }}<select [(ngModel)]="row.status"><option value="completed">{{ t('Completed today', 'تم الانتهاء اليوم') }}</option><option value="in_progress">{{ t('In progress — continue next visit', 'بدأ العلاج ولسه هنكمل') }}</option></select></label>
                              @if (row.status === 'in_progress') { <label>{{ t('Remaining work', 'العمل المتبقي') }}<input [(ngModel)]="row.remaining" maxlength="1000" /></label> }
                              } <label class="procedure-notes">{{ (toothServiceIsExtraction(number) || toothServiceIsFilling(number)) ? t('Notes (optional)', 'ملاحظات (اختياري)') : t('Notes', 'ملاحظات') }}<textarea [(ngModel)]="row.notes" maxlength="2000"></textarea></label>
                              }
                            }
                          </fieldset>
                          }
                          @if (number > 0 && toothServiceIsRootCanal(number)) {
                            <app-root-canal-editor [draft]="rootCanalFor(number)" [previous]="previousRootCanals(number)" [saveState]="rootCanalAutoStatus()[number] || ''" [saveFailed]="rootCanalAutoErrors().includes(number)" (changed)="autoSaveRootCanal(number)" [canSave]="!!row.treatmentId" [english]="t('en','ar') === 'en'" [disabled]="savingTreatment() || savingRootCanal() || !!row.confirmedCompleted" (save)="saveRootCanal(number)" />
                            @if (row.treatmentId) {
                              <p>{{ row.treatmentName }} · {{ t('Existing treatment — no new charge', 'استكمال نفس العلاج — بدون تكلفة جديدة') }}</p>

                            }
                          }
                          @if (row.treatmentId && !toothServiceIsRootCanal(number)) { <p>{{ t('The service was created. Retry to finish it without creating a duplicate.', 'تم إنشاء الإجراء. إعادة المحاولة تستكمله من غير إنشاء فاتورة أو إجراء مكرر.') }}</p> }
                          @if (toothServiceIsRootCanal(number) && row.confirmedCompleted) {
                            <p class="clinical-tag">✓ {{ t('Treatment completed', 'العلاج مكتمل') }}</p>
                          } @else {
                          <button type="button" class="btn-execute-procedure-modern" [disabled]="!row.catalogId || savingTreatment() || savingRootCanal() || row.price < 0" (click)="executeToothService(number)">{{ savingTreatment() ? t('Saving…', 'جارٍ الحفظ…') : row.treatmentId && toothServiceIsRootCanal(number) ? t('Save & continue existing treatment', 'حفظ واستكمال نفس العلاج') : number <= 0 ? t('Record whole-mouth service', 'تسجيل خدمة الفم بالكامل') : t('Record this tooth service', 'تسجيل إجراء هذا السن') }}</button>
                          }
                        </section>
                      }

                    }
                  </div>
                </div>
              </aside>
            </div>

            <!-- Bottom Section: Executed Treatments Table & Active Treatment Plans -->
            <div class="procedures-single-layout" style="margin-top: 1.5rem;">
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

                        <th>{{ t('Status', 'الحالة') }}</th>
                        <th>{{ t('Created Date', 'تاريخ الإنشاء') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (plan of treatmentPlans(); track plan.id) {
                        <tr>
                          <td><strong>{{ plan.title }}</strong></td>

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
                {{ t('Next: Accounting →', 'التالي: الحساب ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 4: PRESCRIPTION & INSTRUCTIONS (الروشتة الطبية)            -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 4) {
          <section class="step-card accounting-card">
            <div class="step-header-title"><h2>{{ t('4. Accounting', '4. الحساب') }}</h2><p>{{ t('Approve each service price for reception before prescription.', 'حدد واعتمد سعر كل إجراء للريسبشن قبل الروشتة.') }}</p></div>
            <div class="panel-box">
              <h3>{{ t('Selected services — pricing', 'حساب الخدمات المحددة') }}</h3>
              @for (number of treatmentRowKeys(); track number) {
                @let row = toothService(number);
                @if (row.catalogId && !row.treatmentId) {
                  <section class="billing-service-price">
                    <strong>{{ number <= 0 ? t('Whole mouth', 'الفم بالكامل') : toothLabel(number) + ' · #' + number }}</strong>
                              <label>{{ t('Price category', 'فئة السعر') }}
                                <select [(ngModel)]="row.tierId" (change)="selectToothServiceTier(number)">
                                  @for (tier of toothServiceTiers(number); track tier.id) { <option [value]="tier.id">{{ t(tier.nameEn, tier.nameAr) }} — {{ tier.price }}</option> }
                                  <option value="custom">{{ t('Custom price', 'سعر مخصص') }}</option>
                                </select>
                              </label>
                              <label>{{ t('Service price', 'سعر الخدمة') }}<input type="number" min="0" [ngModel]="row.price" (ngModelChange)="row.price = +$event; row.tierId = 'custom'" /></label>
                    <button type="button" class="button primary" [disabled]="savingTreatment() || savingRootCanal() || !!savingVisitPrice() || row.price < 0 || !examination()!.canEdit" (click)="recordAndApproveService(number)">{{ t('Record service & approve price', 'تسجيل الإجراء واعتماد السعر') }}</button>
                  </section>
                }
              }
            </div>
            @for (item of executedTreatments(); track item.id) {
              @if (item.priceConfirmed === false && item.status !== 5) {
                <section class="billing-service-price">
                  <strong>{{ item.treatmentName }} · {{ treatmentPriceTeeth(item) }}</strong>
                  <label>{{ t('Price for reception', 'السعر للريسبشن') }}
                    <input type="number" min="0" step="0.01" [ngModel]="visitPrices[item.id] ?? item.price" (ngModelChange)="visitPrices[item.id] = +$event" [disabled]="!!savingVisitPrice()" />
                  </label>
                  <button type="button" class="button primary" [disabled]="!!savingVisitPrice() || !examination()!.canEdit" (click)="confirmVisitPrice(item)">{{ t('Approve price & send to reception', 'اعتماد السعر وإرساله للريسبشن') }}</button>
                </section>
              }
            }
              <!-- Executed Treatments List -->
              <div class="panel-box done-today-box">
                <div class="box-header">
                  <h3>⚡ {{ t('Visit services and charges', 'خدمات الزيارة والحساب') }}</h3>
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


            @if (hasPendingVisitPrices()) { <p role="status">{{ t('Approve the pending service prices to continue.', 'اعتمد أسعار الإجراءات المعلّقة للمتابعة.') }}</p> }
            <div class="step-footer-actions">
              <button type="button" class="button secondary" (click)="setStep(3)">{{ t('Previous: Procedures', 'السابق: الإجراءات') }}</button>
              <button type="button" class="button primary" [disabled]="hasPendingVisitPrices()" (click)="setStep(5)">{{ t('Next: Prescription', 'التالي: الروشتة') }}</button>
            </div>
          </section>
        }
        @if (step() === 5) {
          <section class="step-card rx-card">
            <div class="step-header-title">
              <h2>💊 {{ t('5. Medical Prescription & Patient Instructions', '5. الوصفة الطبية وتعليمات المريض') }}</h2>
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
              <button type="button" class="button secondary prev-btn" (click)="setStep(4)">
                {{ t('← Previous: Accounting', '⬅ السابق: الحساب') }}
              </button>
              <button type="button" class="button primary next-btn" (click)="setStep(6)">
                {{ t('Next: Payment & End →', 'التالي: السداد وإنهاء الجلسة ➔') }}
              </button>
            </div>
          </section>
        }

        <!-- ════════════════════════════════════════════════════════════════ -->
        <!--  STEP 5: BILLING & COMPLETE VISIT (الحساب وإنهاء الزيارة)         -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (step() === 6) {
          <section class="step-card checkout-card">
            <div class="step-header-title">
              <h2>💳 {{ t('6. Payment & End Visit', '6. السداد وإنهاء الجلسة') }}</h2>
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
                    <span>{{ t('Recorded Treatments Total:', 'إجمالي العلاجات المسجلة:') }}</span>
                    <strong>{{ todayProceduresTotal() }} EGP</strong>
                  </div>

                  @if (balance()) {
                    <div class="invoice-row">
                      <span>{{ t('Current Patient Outstanding:', 'الرصيد المستحق الحالي:') }}</span>
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

                  @if (paymentRecorded() > 0) {
                    <p role="status">{{ t('Payment recorded:', 'تم تسجيل سداد:') }} {{ paymentRecorded() }} EGP</p>
                  }
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
                      <app-date-input [ngModel]="suggestedFollowUpDate"
                        (ngModelChange)="loadAvailabilitySlots($event)"></app-date-input>
                    </label>

                    <label class="field-label">
                      <span>{{ t('Appointment duration (minutes)', 'مدة الموعد بالدقائق') }}</span>
                      <input type="number" min="5" max="480" step="5" [ngModel]="followUpDuration"
                        (ngModelChange)="changeFollowUpDuration($event)" />
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
                                @for (slot of followUpSlots('morning'); track slot.startAt) {
                                  <button
                                    type="button"
                                    class="btn-slot-chip"
                                    [class.active]="selectedSlot()?.startAt === slot.startAt"
                                    (click)="selectedSlot.set(slot)"
                                  >
                                    <strong>{{ formatSlotTime(slot.localStartTime) }}</strong><small>{{ t('Ends', 'ينتهي') }} {{ formatSlotTime(slot.localEndTime) }}</small>
                                  </button>
                                }
                              </div>
                              @if (slotPeriods().morning.length > 9) {
                                <div class="follow-up-slot-pager">
                                  <button type="button" [disabled]="followUpPage.morning === 0" (click)="changeFollowUpPage('morning', -1)">{{ t('Previous', 'السابق') }}</button>
                                  <span>{{ followUpPage.morning + 1 }} / {{ followUpPageCount('morning') }}</span>
                                  <button type="button" [disabled]="followUpPage.morning + 1 >= followUpPageCount('morning')" (click)="changeFollowUpPage('morning', 1)">{{ t('Next', 'التالي') }}</button>
                                </div>
                              }
                            </div>
                          }

                          @if (slotPeriods().evening.length > 0) {
                            <div class="period-row">
                              <span class="period-badge evening">🌙 {{ t('Evening', 'المساء') }}</span>
                              <div class="period-slots-chips">
                                @for (slot of followUpSlots('evening'); track slot.startAt) {
                                  <button
                                    type="button"
                                    class="btn-slot-chip"
                                    [class.active]="selectedSlot()?.startAt === slot.startAt"
                                    (click)="selectedSlot.set(slot)"
                                  >
                                    <strong>{{ formatSlotTime(slot.localStartTime) }}</strong><small>{{ t('Ends', 'ينتهي') }} {{ formatSlotTime(slot.localEndTime) }}</small>
                                  </button>
                                }
                              </div>
                              @if (slotPeriods().evening.length > 9) {
                                <div class="follow-up-slot-pager">
                                  <button type="button" [disabled]="followUpPage.evening === 0" (click)="changeFollowUpPage('evening', -1)">{{ t('Previous', 'السابق') }}</button>
                                  <span>{{ followUpPage.evening + 1 }} / {{ followUpPageCount('evening') }}</span>
                                  <button type="button" [disabled]="followUpPage.evening + 1 >= followUpPageCount('evening')" (click)="changeFollowUpPage('evening', 1)">{{ t('Next', 'التالي') }}</button>
                                </div>
                              }
                            </div>
                          }
                        </div>
                      } @else if (!bookingError()) {
                        <div class="empty-slots-warning">
                          <span>⚠️ {{ t('No available slots for this date and duration. Try another date or adjust the duration.', 'لا توجد مواعيد متاحة لهذا اليوم والمدة. جرب يومًا آخر أو مدة متوافقة مع جدول الطبيب.') }}</span>
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
              <button type="button" class="button secondary prev-btn" (click)="setStep(5)">
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
          <div class="modal-content medical-alert-modal" role="dialog" aria-modal="true" aria-labelledby="medical-alert-title" (click)="$event.stopPropagation()">
            <div class="alert-modal-head">
              <div class="head-badge">
                <span class="pulse-icon">!</span>
              </div>
              <div class="head-titles">
                <h2 id="medical-alert-title" class="head-main-title">{{ t('Important medical alert', 'تنبيه طبي مهم') }}</h2>
                <p class="head-sub-title">
                  {{ t('Review patient sensitivities, chronic illnesses, and medications before procedure.', 'يجب مراجعة الحساسية والأمراض المزمنة والأدوية قبل بدء الكشف أو التخدير أو الجراحة.') }}
                </p>
              </div>
              <button type="button" class="close-alert-btn" [attr.aria-label]="t('Close medical alert', 'إغلاق التنبيه الطبي')" (click)="closeMedicalAlertModal()">&times;</button>
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
              <button type="button" class="medical-details-button" (click)="closeMedicalAlertModal(); setStep(1); intakeMedicalEditing = true">{{ t('View medical details', 'عرض التفاصيل الطبية') }}</button>
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
  readonly auth = inject(AuthService);
  readonly paymentRecorded = signal(0);
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
  readonly treatmentHistoryError = signal('');
  readonly treatmentPlans = signal<TreatmentPlanList[]>([]);
  readonly showVisitHistorySheet = signal(false);
  readonly showMedicalAlertModal = signal(false);
  private medicalAlertSignature = '';
  private medicalHistoryLoading = false;
  readonly medicalHistoryError = signal('');

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
  intakeMedicalEditing = false;
  patientAge(): number | null {
    const birth = this.patient()?.dateOfBirth;
    if (!birth) return null;
    const date = new Date(birth + 'T00:00:00'); const today = new Date();
    if (!Number.isFinite(date.getTime())) return null;
    const years = today.getFullYear() - date.getFullYear() - (today.getMonth() < date.getMonth() || today.getMonth() === date.getMonth() && today.getDate() < date.getDate() ? 1 : 0);
    return years >= 0 && years <= 130 ? years : null;
  }
  readonly step = signal<number>(1);
  readonly steps = [
    { number: 1, icon: '📋', en: '1. Intake', ar: '1. الاستقبال والشكوى' },
    { number: 2, icon: '🦷', en: '2. Dental Chart', ar: '2. فحص ومخطط الأسنان' },
    { number: 3, icon: '🛠️', en: '3. Visit procedures', ar: '3. الإجراءات الطبية للزيارة' },
    { number: 4, icon: '💳', en: '4. Accounting', ar: '4. الحساب' },
    { number: 5, icon: '💊', en: '5. Prescription', ar: '5. الروشتة' },
    { number: 6, icon: '✓', en: '6. Payment & End', ar: '6. السداد والإنهاء' },
  ];

  // Dental Chart State
  selected = 0;
  selectedTeeth: number[] = [];
  treatmentTeeth: number[] = [];
  findingTargetTeeth: number[] = [];
  findingEditorOpen = true;
  readonly menuCariesRecords = new Map<number, string>();
  readonly savingFinding = signal(false);
  readonly quickFindingOptions = SELECTABLE_FINDING_TYPES.map(id => ({ id, ...FINDING_APPEARANCE[id] }));
  readonly cariesClasses = [1, 2, 3, 4, 5, 6];
  readonly fillingMaterials = ['Composite', 'Amalgam', 'Glass Ionomer', 'Temporary'];
  readonly tab = signal<'findings' | 'procedures' | 'endodontic' | 'notes'>('findings');
  readonly surfaces = SURFACES;
  readonly findingOptions = SELECTABLE_FINDING_TYPES.map(id => ({ id, ...FINDING_APPEARANCE[id] }));
  readonly procedureOptions = Object.entries(PROCEDURE_APPEARANCE).map(([id, x]) => ({
    id: +id,
    ...x,
  }));

  // Forms
  readonly findingForm = this.fb.nonNullable.group({
    type: 2,
    cariesClass: [null as number | null],
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
  followUpDuration = 60;
  private followUpDurationInitialized = false;
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

  followUpPage = { morning: 0, evening: 0 };
  followUpPageCount(period: 'morning' | 'evening') { return Math.ceil(this.slotPeriods()[period].length / 9); }
  followUpSlots(period: 'morning' | 'evening') {
    const page = Math.min(this.followUpPage[period], Math.max(0, this.followUpPageCount(period) - 1));
    return this.slotPeriods()[period].slice(page * 9, page * 9 + 9);
  }
  changeFollowUpPage(period: 'morning' | 'evening', offset: number) {
    this.followUpPage[period] = Math.max(0, Math.min(this.followUpPageCount(period) - 1, this.followUpPage[period] + offset));
  }

  readonly slotPeriods = computed(() => {
    const slots = this.availableSlots();
    const morning: AvailabilitySlot[] = [];
    const evening: AvailabilitySlot[] = [];

    for (const s of slots) {
      const h = parseInt(s.localStartTime.split(':')[0], 10);
      if (h < 12) {
        morning.push(s);
      } else {
        evening.push(s);
      }
    }
    return { morning, evening };
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

  readonly patientChart = signal<PatientDentalChart | null>(null);
  readonly patientChartError = signal(false);
  readonly chartTeeth = computed<ToothChartSummary[]>(() =>
    Array.from({ length: 4 }, (_, q) => Array.from({ length: 8 }, (_, i) => (q + 1) * 10 + i + 1))
      .flat()
      .map((number) => ({
        toothId: `tooth-${number}`,
        toothNumber: number,
        findings: [
          ...(this.patientChart()?.teeth.find(t => t.toothNumber === number)?.findings ?? []),
          ...new Set(
            (this.examination()?.findings ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        procedures: [
          ...(this.patientChart()?.teeth.find(t => t.toothNumber === number)?.procedures ?? []),
          ...new Set(
            (this.examination()?.procedures ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        treatmentProgress: this.patientChart()?.teeth.find(t => t.toothNumber === number)?.treatmentProgress,
        hasEndodonticRecord: !!this.patientChart()?.teeth.find(t => t.toothNumber === number)?.hasEndodonticRecord || (this.examination()?.endodonticRecords ?? []).some(
          (x) => x.toothNumber === number,
        ),
      })),
  );

  todayProceduresTotal = computed(() => {
    return this.executedTreatments().reduce((sum, tr) => sum + (tr.price || 0), 0);
  });

  totalDue = computed(() => {
    return this.balance()?.outstanding ?? 0;
  });

  constructor() {
    this.findingForm.controls.type.valueChanges.subscribe(type => {
      if (+type !== 2) {
        this.findingForm.controls.cariesClass.setValue(null);
        this.menuCariesRecords.clear();
      }
      this.findingForm.controls.surfaces.setValue([]);
    });
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
                    this.loadPatient(e.patientId);
      this.loadAppointment();
    }
    if (n === 4) { this.loadTreatments(e.patientId); this.loadBalance(e.patientId); }
    if (n === 5) {
      this.loadMedicationsCatalog();
    }
    if (n === 6) {
      this.loadBalance(e.patientId);
      this.loadTreatments(e.patientId);
                    this.loadPatient(e.patientId);
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
      next: (app) => this.setFollowUpAppointment(app),
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
        if (app.status === 3 && this.auth.hasPermission('Appointments.Start') && this.auth.hasPermission('Examination.Create')) {
          void this.checkInAndStart();
        } else if (app.status === 4 && this.auth.hasPermission('Examination.Create')) {
          this.create();
        } else {
          this.loadPatient(app.patientId);
          this.loadTreatments(app.patientId);
          this.loadBalance(app.patientId);
          this.loading.set(false);
        }
      },
      error: (error) => this.fail(error),
    });
  }

  async checkInAndStart() {
    const app = this.appointment();
    if (!app || this.startingGate()) return;
    this.startingGate.set(true);
    this.error.set('');
    try {
      if (app.status <= 3) {
        await firstValueFrom(this.appointmentApi.action(this.appointmentId, 'start'));
        this.appointment.update(x => x ? { ...x, status: 4 } : x);
      }
      this.success.set(this.t('Session started.', 'تم بدء الجلسة.'));
      if (this.auth.hasPermission('Examination.Create')) this.create();
      else this.loading.set(false);
    } catch (error) {
      this.error.set(parseApiError(error, this.t('Could not start session.', 'تعذر بدء الجلسة.')));
      this.loading.set(false);
    } finally {
      this.startingGate.set(false);
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

  private patientChartGeneration = 0;
  loadPatient(patientId: string) {
    const generation = ++this.patientChartGeneration;
    this.api.chart(patientId).subscribe({
      next: chart => { if (generation === this.patientChartGeneration) { this.patientChart.set(chart); this.patientChartError.set(false); } },
      error: () => { if (generation === this.patientChartGeneration) this.patientChartError.set(true); },
    });
    this.refreshPatientMedicalHistory(patientId);
  }

  @HostListener('window:focus')
  refreshMedicalHistoryOnFocus(): void {
    const patientId = this.examination()?.patientId ?? this.patient()?.id;
    if (patientId) this.refreshPatientMedicalHistory(patientId);
  }

  @HostListener('document:visibilitychange')
  refreshMedicalHistoryWhenVisible(): void {
    if (document.visibilityState === 'visible') this.refreshMedicalHistoryOnFocus();
  }

  refreshPatientMedicalHistory(patientId: string): void {
    // The reception may update this patient while the doctor keeps the visit open.
    if (this.medicalHistoryLoading) return;
    this.medicalHistoryLoading = true;
    this.patientApi.patient(patientId).subscribe({
      next: (p) => {
        this.patient.set(p);
        this.patientAllergies = (p.allergies ?? []).map((x) => x.name);
        this.patientConditions = (p.medicalConditions ?? []).map((x) => x.name);
        this.patientMedications = (p.medications ?? []).map((x) => x.name);

        this.medicalHistoryLoading = false;
        this.medicalHistoryError.set(p.canViewMedicalInformation === false
          ? this.t('Medical history is unavailable with this account. Check medical history permissions.', 'التاريخ الطبي غير متاح لهذا الحساب. راجع صلاحية الاطلاع على التاريخ الطبي.') : '');
        const signature = JSON.stringify([this.patientAllergies, this.patientConditions, this.patientMedications]);
        if (signature !== this.medicalAlertSignature && this.hasMedicalAlerts()) {
          this.showMedicalAlertModal.set(true);
        }
        this.medicalAlertSignature = signature;
      },
      error: () => {
        this.medicalHistoryLoading = false;
        this.medicalHistoryError.set(this.t('Could not refresh medical history. Previously loaded information may be outdated.', 'تعذر تحديث الحساسية والأمراض المزمنة. البيانات المعروضة قد تكون قديمة.'));
      },
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
    this.loadTreatmentHistory(patientId);
    this.treatmentApi.plans({ patientId, pageSize: '50' }).subscribe({
      next: (res) => this.treatmentPlans.set(res.items || []),
      error: () => {},
    });
  }

  loadTreatmentHistory(patientId: string, page = 1, previous: Treatment[] = []) {
    this.treatmentApi.treatments({ patientId, page: String(page) }).subscribe({
      next: res => {
        const items = [...previous, ...(res.items || [])];
        this.executedTreatments.set(items); this.treatmentHistoryError.set('');
        this.treatmentTeeth = this.treatmentTeeth.filter(number => this.availableTreatmentTeeth().includes(number));
        if (page < res.totalPages) this.loadTreatmentHistory(patientId, page + 1, items);
      },
      error: () => this.treatmentHistoryError.set(this.t('Could not load previous treatment progress.', 'تعذر تحميل تقدم العلاج السابق.')),
    });
  }


  loadBalance(patientId: string) {
    this.financeApi.patientBalance(patientId).subscribe({
      next: (b) => this.balance.set(b),
      error: (error) => this.error.set(parseApiError(error, this.t('Could not refresh patient balance.', 'تعذر تحديث رصيد المريض.'))),
    });
  }

  private create() {
    if (!this.auth.hasPermission('Examination.Create')) {
      this.loading.set(false);
      return;
    }
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
    this.loadTreatmentHistory(x.patientId);
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
      error: (error) => this.error.set(parseApiError(error, this.t('Could not start session.', 'تعذر بدء الجلسة.'))),
    });
  }

  selectedFindings() {
    return this.examination()?.findings.filter((x) => this.selectedTeeth.length ? this.selectedTeeth.includes(x.toothNumber) : x.toothNumber === this.selected) ?? [];
  }

  selectedProcedures() {
    return this.examination()?.procedures.filter((x) => x.toothNumber === this.selected) ?? [];
  }

  selectedEndodontic() {
    return (
      this.examination()?.endodonticRecords.filter((x) => x.toothNumber === this.selected) ?? []
    );
  }

  toothLabel(number: number) { return toothName(number, this.i18n.language()); }
  findingTeethLabel() { return (this.findingTargetTeeth.length ? this.findingTargetTeeth : this.selectedTeeth).map(n => '#' + n + ' ' + this.toothLabel(n)).join(', '); }
  availableCariesClasses() { return allowedCariesClasses(this.findingTargetTeeth.length ? this.findingTargetTeeth : this.selectedTeeth); }
  chooseToothFinding(event: { toothNumber: number; type: number }) {
    if (this.savingFinding()) return;
    if (!this.selectedTeeth.includes(event.toothNumber)) this.selectedTeeth = [...this.selectedTeeth, event.toothNumber].sort((a,b) => a-b);
    this.selected = event.toothNumber;
    this.findingTargetTeeth = [event.toothNumber];
    this.menuCariesRecords.clear();
    this.findingEditorOpen = event.type === 2;
    this.findingForm.controls.notes.setValue('');
    this.findingForm.controls.type.setValue(event.type);
    this.findingForm.controls.cariesClass.setValue(null);
    void this.addFinding(true);
  }
  readonly wholeMouthFindingTypes = [12, 13, 16, 18];
  sidebarToothFindings() { return this.displayedFindings().filter(item => !this.isWholeMouthFinding(item.type)); }
  wholeMouthFinding(type: number) { return this.examination()?.findings.find(item => item.type === type); }
  toggleWholeMouthFinding(type: number) {
    if (!this.examination()?.canEdit || this.savingFinding()) return;
    const item = this.wholeMouthFinding(type);
    if (item) this.removeFinding(item.id); else this.recordWholeMouthFinding(type);
  }
  isWholeMouthFinding(type: number) { return type === 12 || type === 13 || type === 16 || type === 18; }
  displayedFindings() {
    const seen = new Set<number>();
    return (this.examination()?.findings ?? []).filter(item => {
      if (!this.isWholeMouthFinding(item.type)) return true;
      if (seen.has(item.type)) return false;
      seen.add(item.type); return true;
    });
  }
  async recordWholeMouthFinding(type: number) {
    const exam = this.examination();
    if (!exam?.canEdit || !this.isWholeMouthFinding(type) || this.savingFinding()) return;
    this.savingFinding.set(true); this.error.set('');
    try {
      await firstValueFrom(this.api.addFinding(exam.id, { toothNumber: 11, type, surfaces: [], version: exam.version }));
      this.examination.set(await firstValueFrom(this.api.examination(exam.id)));
      this.success.set(this.t('Whole-mouth finding recorded.', 'تم تسجيل التشخيص للفم بالكامل.'));
    } catch (error) { if (error instanceof HttpErrorResponse) this.fail(error); else this.error.set(parseApiError(error, this.t('Could not save. Retry the request.', 'تعذر الحفظ. أعد المحاولة.'))); } finally { this.savingFinding.set(false); }
  }
  chooseFindingType(type: number) {
    this.findingTargetTeeth = this.selectedTeeth.length ? [...this.selectedTeeth] : (this.selected ? [this.selected] : []);
    this.menuCariesRecords.clear();
    this.findingEditorOpen = type === 2;
    this.findingForm.controls.notes.setValue('');
    this.findingForm.controls.cariesClass.setValue(null);
    this.tab.set('findings');
    this.findingForm.controls.type.setValue(type);
    void this.addFinding(true);
  }

  editCariesFinding(item: { id: string; toothNumber: number; cariesClass?: number | null; notes?: string }) {
    if (this.savingFinding()) return;
    if (!this.selectedTeeth.includes(item.toothNumber)) this.selectedTeeth = [...this.selectedTeeth, item.toothNumber];
    this.selected = item.toothNumber;
    this.findingTargetTeeth = [item.toothNumber];
    this.menuCariesRecords.clear();
    this.menuCariesRecords.set(item.toothNumber, item.id);
    this.findingForm.controls.type.setValue(2);
    this.findingForm.controls.cariesClass.setValue(item.cariesClass ?? null);
    this.findingForm.controls.notes.setValue(item.notes || '');
    this.findingEditorOpen = true;
  }

  async addFinding(autoSave = false) {
    const e = this.examination();
    const teeth = this.findingTargetTeeth.length ? [...this.findingTargetTeeth] : this.selectedTeeth.length ? [...this.selectedTeeth] : (this.selected ? [this.selected] : []);
    if (!e?.canEdit || !teeth.length || this.savingFinding()) return;
    const v = this.findingForm.getRawValue();
    if (!autoSave && +v.type === 2 && v.cariesClass && !allowedCariesClasses(teeth).includes(v.cariesClass)) {
      this.error.set(this.t('This class is not available for the selected teeth.', 'هذا التصنيف غير متاح للأسنان المحددة.'));
      return;
    }
    this.savingFinding.set(true);
    this.findingForm.disable({ emitEvent: false });
    const editingClassification = this.menuCariesRecords.size > 0;
    let version = e.version;
    let saved = 0;
    try {
      for (const toothNumber of teeth) {
        const findings = this.examination()?.findings || [];
        const existing = findings.filter(x => x.toothNumber === toothNumber && x.type === +v.type).at(-1);
        if (autoSave && existing) {
          if (+v.type === 2) {
            this.menuCariesRecords.set(toothNumber, existing.id);
            if (teeth.length === 1) {
              this.findingForm.controls.cariesClass.setValue(existing.cariesClass ?? null, { emitEvent: false });
              this.findingForm.controls.notes.setValue(existing.notes || '', { emitEvent: false });
            }
          }
          continue;
        }
        const editingId = +v.type === 2 && !autoSave ? this.menuCariesRecords.get(toothNumber) : undefined;
        const editing = findings.find(x => x.id === editingId);
        const oldIds = new Set(findings.map(x => x.id));
        const request = {
          toothNumber, type: +v.type, surfaces: editing?.surfaces || [],
          cariesClass: +v.type === 2 && !autoSave ? v.cariesClass : null,
          notes: autoSave ? undefined : (v.notes || (teeth.length > 1 ? editing?.notes : undefined)), version,
        };
        await firstValueFrom(editing ? this.api.updateFinding(e.id, editing.id, request) : this.api.addFinding(e.id, request));
        saved++;
        const updated = await firstValueFrom(this.api.examination(e.id));
        if (autoSave && +v.type === 2) {
          const created = updated.findings.find(x => x.toothNumber === toothNumber && x.type === 2 && !oldIds.has(x.id));
          if (created) this.menuCariesRecords.set(toothNumber, created.id);
        }
        this.examination.set(updated);
        version = updated.version;
      }
      this.selectedTeeth = this.selectedTeeth.filter(number => !teeth.includes(number));
      if (teeth.includes(this.selected)) this.selected = this.selectedTeeth[0] || 0;
      this.success.set(this.t('Finding added.', 'تم إضافة النتيجة.'));
      if (!autoSave) {
        this.findingForm.controls.notes.setValue('');
        this.findingForm.controls.cariesClass.setValue(null);
        this.menuCariesRecords.clear();
        if (editingClassification) this.findingEditorOpen = false;
        this.load();
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse) this.fail(err);
      else this.error.set(this.t('Could not save findings.', 'تعذر حفظ النتائج.'));
      if (saved) {
        this.error.set(this.t(`Saved ${saved} of ${teeth.length} teeth. Review before retrying.`, `تم حفظ ${saved} من ${teeth.length} أسنان. راجع النتائج قبل إعادة المحاولة.`));
        this.load();
      }
    } finally {
      this.findingForm.enable({ emitEvent: false });
      this.savingFinding.set(false);
    }
  }

  findingDetailsLabel(item: { surfaces: number[]; cariesClass?: number | null }) {
    return item.cariesClass ? 'Class ' + ['I', 'II', 'III', 'IV', 'V', 'VI'][item.cariesClass - 1] : this.surfaceLabels(item.surfaces);
  }

  removeFinding(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeFinding(e.id, id, e.version));
  }

  addProcedure() {
    const e = this.examination();
    if (!e || !this.selected) return;
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
    if (!e || !this.selected || this.endoForm.invalid) return;
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

  treatmentSummaryLabels(number: number): string[] {
    // Clinical intent comes from the chart; catalogue names describe pricing services.
    const current = (this.examination()?.findings ?? []).filter(item => item.toothNumber === number).map(item => item.type);
    const types = current.length ? current : this.patientChart()?.teeth.find(tooth => tooth.toothNumber === number)?.findings ?? [];
    const labels = [...new Set(types.filter(type => type !== 1 && !this.isWholeMouthFinding(type)).map(type => this.findingLabel(type)))];
    if (labels.length) return labels;
    const row = this.toothServices[number];
    if (row?.treatmentName) return [row.treatmentName];
    const service = row?.catalogId ? this.catalog().find(item => item.id === row.catalogId) : undefined;
    return service ? [this.serviceDisplayName(service)] : [];
  }

  selectedToothFindings() {
    return (this.examination()?.findings ?? []).filter(x => this.treatmentTeeth.includes(x.toothNumber));
  }

  getSelectedCatalogPrice(): number {
    const item = this.catalog().find((x) => x.id === this.selectedCatalogId);
    return item?.defaultPrice ?? 0;
  }

  quickAddFinding(type: number) {
    if (!this.treatmentTeeth.length) return;
    this.findingTargetTeeth = [...this.treatmentTeeth];
    this.selectedTeeth = [...new Set([...this.selectedTeeth, ...this.treatmentTeeth])];
    this.selected = this.treatmentTeeth[0];
    this.menuCariesRecords.clear();
    this.findingEditorOpen = type === 2;
    this.findingForm.controls.notes.setValue('');
    this.findingForm.controls.cariesClass.setValue(null);
    this.findingForm.controls.type.setValue(type);
    if (type === 2) {
      this.setStep(2);
      this.tab.set('findings');
    }
    void this.addFinding(true);
  }

  onSelectedToothChange(num: number) {
    this.selected = num;
    this.recalculateTreatmentPrice();
  }

  onSelectedTeethChange(teeth: number[]) {
    this.selectedTeeth = teeth;
    this.treatmentTeeth = this.treatmentTeeth.filter(number => this.surveyTeeth().includes(number));
    this.findingEditorOpen = true;
    this.menuCariesRecords.clear();
    this.findingTargetTeeth = [];
    this.findingForm.controls.cariesClass.setValue(null);
    if (!teeth.length) this.selected = 0;
    if (teeth.length > 0 && !teeth.includes(this.selected)) {
      this.selected = teeth[0];
    }
    this.recalculateTreatmentPrice();
  }

  selectedTeethLabel(): string {
    return this.selectedTeeth.length > 0 ? this.selectedTeeth.map((t) => '#' + t).join(', ') : this.t('No tooth selected', 'لم يتم اختيار سن');
  }

  surveyTeeth() { return [...new Set([...(this.patientChart()?.teeth.filter(t => t.findings.some(type => !this.isWholeMouthFinding(type)) || t.procedures.length).map(t => t.toothNumber) ?? []), ...this.selectedTeeth, ...(this.examination()?.findings ?? []).filter(x => !this.isWholeMouthFinding(x.type)).map(x => x.toothNumber)])].sort((a,b) => a-b); }
  readonly recentlyCompletedTeeth = signal<number[]>([]);
  availableTreatmentTeeth() {
    const completed = new Set([...this.recentlyCompletedTeeth(), ...(this.examination()?.endodonticRecords ?? []).filter(item => item.stage === 6).map(item => item.toothNumber), ...this.executedTreatments().filter(item => item.appointmentId === this.appointmentId && item.status === 4 && item.toothNumbers.length < 32).flatMap(item => item.toothNumbers)]);
    return this.surveyTeeth().filter(number => !completed.has(number));
  }
  private finishTooth(number: number) {
    this.recentlyCompletedTeeth.update(items => [...new Set([...items, number])]);
    this.treatmentTeeth = this.treatmentTeeth.filter(tooth => tooth !== number);
    this.selectedTeeth = this.selectedTeeth.filter(tooth => tooth !== number);
    this.findingTargetTeeth = this.findingTargetTeeth.filter(tooth => tooth !== number);
    if (this.selected === number) this.selected = 0;
  }
  toggleTreatmentTooth(number: number) {
    if (this.savingTreatment() || !this.availableTreatmentTeeth().includes(number)) return;
    this.treatmentTeeth = this.treatmentTeeth.includes(number) ? this.treatmentTeeth.filter(x => x !== number) : [...this.treatmentTeeth, number].sort((a,b) => a-b);
    this.recalculateTreatmentPrice();
  }
  treatmentTeethLabel() { return this.treatmentTeeth.length ? this.treatmentTeeth.map(n => '#' + n + ' ' + this.toothLabel(n)).join(', ') : this.t('No treatment teeth selected', 'لم يتم اختيار أسنان علاج اليوم'); }
  recalculateTreatmentPrice() {
    const count = this.treatmentTeeth.length;
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


  readonly visitPrices: Record<string, number> = {};
  readonly savingVisitPrice = signal('');
  hasPendingVisitPrices() { return this.executedTreatments().some(item => item.priceConfirmed === false && item.status !== 5); }
  treatmentPriceTeeth(item: Treatment) { return (item.toothNumbers ?? []).map(number => this.toothLabel(number) + ' · #' + number).join(', '); }
  async recordAndApproveService(number: number) {
    const row = this.toothService(number);
    await this.executeToothService(number);
    if (row.treatmentId && !this.error()) await this.confirmVisitPrice({id: row.treatmentId, price: row.price});
  }
  async confirmVisitPrice(item: Pick<Treatment, 'id' | 'price'>) {
    const price = this.visitPrices[item.id] ?? item.price;
    if (!this.examination()?.canEdit || this.savingVisitPrice() || !Number.isFinite(price) || price < 0) return;
    this.savingVisitPrice.set(item.id); this.error.set('');
    try {
      const current = await firstValueFrom(this.treatmentApi.treatment(item.id));
      if (current.priceConfirmed !== false) throw new Error(this.t('This price has already been approved. Reload the account.', 'تم اعتماد السعر بالفعل؛ حدّث الحساب.'));
      await firstValueFrom(this.treatmentApi.confirmTreatmentPrice(item.id, price, current.version));
      this.success.set(this.t('Price approved for reception.', 'تم اعتماد السعر للريسبشن.'));
      this.loadTreatments(this.examination()!.patientId); this.loadBalance(this.examination()!.patientId);
    } catch (error) { this.error.set(parseApiError(error, this.t('Could not approve the price.', 'تعذر اعتماد السعر.'))); }
    finally { this.savingVisitPrice.set(''); }
  }
  wholeMouthTreatment = false;
  readonly toothServices: Record<number, ToothServiceDraft> = {};
  private readonly serviceFindingTypes = new Map<number, number | undefined>();
  private readonly recordedWholeMouth = new Set<number>();
  wholeMouthLabel(number: number) { return number < 0 ? this.findingLabel(-number) : this.t('Whole-mouth service', 'خدمة للفم بالكامل'); }
  private wholeMouthMatches(item: CatalogItem, type: number) {
    const parsed = parseCatalogItem(item), text = [item.code, item.name, parsed.nameEn, parsed.nameAr].join(' ');
    return ({12:/scal|polish|clean|تنظيف|تنضيف|جير|تلميع/i,13:/whiten|bleach|تبيض|تبييض/i,16:/ortho|braces|aligner|retainer|تقويم/i,18:/denture|أطقم|اطقم|طقم/i} as Record<number,RegExp>)[type]?.test(text) ?? false;
  }
  treatmentRowKeys() {
    const globals = [...new Set((this.examination()?.findings ?? []).filter(f => this.isWholeMouthFinding(f.type)).map(f => -f.type))].filter(key => !this.recordedWholeMouth.has(key) && !this.executedTreatments().some(item => item.appointmentId === this.appointmentId && item.status !== 5 && item.toothNumbers.length === 32 && this.wholeMouthMatches({id:item.catalogItemId ?? '',code:'',name:item.treatmentName,type:item.type,defaultPrice:item.price,isActive:true}, -key)));
    return [...this.treatmentTeeth, ...globals, ...(this.wholeMouthTreatment && !globals.length ? [0] : [])];
  }
  toothClasses(number: number) { return allowedCariesClasses([number]); }
  toothService(number: number): ToothServiceDraft {
    const row = this.toothServices[number] ??= { catalogId: '', tierId: 'base', price: 0, cariesClass: this.examination()?.findings.filter(f => f.toothNumber === number && f.type === 2).at(-1)?.cariesClass ?? null, notes: '', remaining: '', status: 'completed', fillingMaterial: 'Composite' };
    const type = number < 0 ? -number : this.examination()?.findings.filter(f => f.toothNumber === number && !this.isWholeMouthFinding(f.type)).at(-1)?.type ?? this.patientChart()?.teeth.find(t => t.toothNumber === number)?.findings.filter(type => !this.isWholeMouthFinding(type)).at(-1);
    if (!row.treatmentId && this.serviceFindingTypes.has(number) && this.serviceFindingTypes.get(number) !== type) {
      row.catalogId = ''; row.price = 0; row.tierId = 'base'; row.status = 'completed';
      row.cariesClass = this.examination()?.findings.filter(f => f.toothNumber === number && f.type === 2).at(-1)?.cariesClass ?? null;
      row.fillingMaterial = 'Composite';
      this.rootCanalDrafts.delete(number);
    }
    this.serviceFindingTypes.set(number, type);
    if (!row.catalogId && type) {
      const treatmentType = ({2:1, 8:4, 9:5, 10:4, 11:4, 14:2, 15:3, 17:4, 12:6, 13:6, 16:6, 18:6} as Record<number, number>)[type];
      const candidates = this.toothServiceCatalog(number).filter(item => number < 0 || item.type === treatmentType);
      const appearance = FINDING_APPEARANCE[type];
      const exact = candidates.filter(item => { const parsed = parseCatalogItem(item); return [parsed.nameEn, parsed.nameAr, item.name].some(name => [appearance.en, appearance.ar].some(label => name.trim().toLowerCase() === label.toLowerCase())); });
      const item = exact.length === 1 ? exact[0] : candidates.length === 1 ? candidates[0] : undefined;
      if (item) {
        const tier = parseCatalogItem(item).priceTiers[0];
        row.catalogId = item.id; row.tierId = tier?.id ?? 'base'; row.price = tier?.price ?? item.defaultPrice ?? 0;
        if ([4,5].includes(item.type)) row.status = 'in_progress';
      }
    }
    return row;
  }
  serviceDisplayName(item: CatalogItem) { const parsed = parseCatalogItem(item); return this.t(parsed.nameEn || item.name, parsed.nameAr || item.name); }
  matchingToothServices(number: number) {
    if (number <= 0) return this.toothServiceCatalog(number);
    const type = this.examination()?.findings.filter(f => f.toothNumber === number && !this.isWholeMouthFinding(f.type)).at(-1)?.type
      ?? this.patientChart()?.teeth.find(t => t.toothNumber === number)?.findings.filter(type => !this.isWholeMouthFinding(type)).at(-1);
    const serviceType = ({2:1,8:4,9:5,10:4,11:4,14:2,15:3,17:4} as Record<number,number>)[type ?? 0];
    return this.toothServiceCatalog(number).filter(item => !serviceType || item.type === serviceType);
  }
  isWholeMouthService(item: CatalogItem) {
    const parsed = parseCatalogItem(item);
    return /denture|أطقم|اطقم|طقم|ortho|braces|aligner|retainer|\u062a\u0642\u0648\u064a\u0645|scal|polish|whiten|bleach|clean|تنظيف|تنضيف|جير|تلميع|تبييض|تبيض/i.test([item.code, parsed.nameEn, parsed.nameAr].join(' '));
  }
  toothServiceCatalog(number: number) { return this.catalog().filter(item => number <= 0 ? this.isWholeMouthService(item) && (number === 0 || this.wholeMouthMatches(item, -number)) : !this.isWholeMouthService(item)); }
  toothServiceTiers(number: number) {
    const item = this.catalog().find(item => item.id === this.toothService(number).catalogId);
    return item ? parseCatalogItem(item).priceTiers : [];
  }
  toothServiceIsExtraction(number: number) { return this.catalog().find(item => item.id === this.toothService(number).catalogId)?.type === 2; }
  extractionFor(number: number): ExtractionDraft { return this.toothService(number).extraction ??= { type: 'Simple Extraction', condition: 'Normal', direction: null }; }
  extractionSummary(number: number) {
    if (!this.toothServiceIsExtraction(number)) return '';
    const draft = this.extractionFor(number);
    return [draft.type, draft.condition, draft.condition === 'Impacted' ? draft.direction : null].filter(Boolean).join(' — ');
  }
  toothServiceIsFilling(number: number) { return this.catalog().find(item => item.id === this.toothService(number).catalogId)?.type === 1; }
  readonly savingRootCanal = signal(false);
  readonly rootCanalDrafts = new Map<number, { treatmentId?: string; draft: RootCanalDraft }>();
  toothServiceIsRootCanal(number: number) {
    const row = this.toothService(number);
    return number > 0 && [4,5].includes(row.treatmentType ?? this.catalog().find(item => item.id === row.catalogId)?.type ?? 0);
  }
  previousRootCanals(number: number): EndodonticRecord[] {
    const treatmentId = this.toothService(number).treatmentId;
    if (!treatmentId) return [];
    return (this.patientChart()?.endodonticRecords ?? []).filter(record => record.toothNumber === number && record.examinationId !== this.examination()?.id && (record.treatmentId === treatmentId || !record.treatmentId))
      .sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
  }
  rootCanalFor(number: number): RootCanalDraft {
    const treatmentId = this.toothService(number).treatmentId;
    const cached = this.rootCanalDrafts.get(number);
    if (cached && cached.treatmentId === treatmentId) return cached.draft;
    const crownOnly = (this.toothService(number).treatmentType ?? this.catalog().find(item=>item.id===this.toothService(number).catalogId)?.type) === 5;
    const record = this.examination()?.endodonticRecords.filter(record => (record.restorationType==='crown-only')===crownOnly && record.toothNumber === number && (!record.treatmentId || record.treatmentId === treatmentId)).at(-1) ?? this.previousRootCanals(number)[0];
    const draft = rootCanalDraft(number, record);
    if (crownOnly) { draft.restorationType = 'crown-only'; draft.canals = []; if (!record) draft.stage = 8; }
    if (!draft.restorationType) {
      const finding = this.examination()?.findings.filter(f => f.toothNumber === number && [8,10,11,17].includes(f.type)).at(-1)?.type ?? this.patientChart()?.teeth.find(t => t.toothNumber === number)?.findings.filter(type => [8,10,11,17].includes(type)).at(-1);
      const name = this.toothService(number).treatmentName ?? this.catalog().find(c => c.id === this.toothService(number).catalogId)?.name ?? '';
      draft.restorationType = finding === 11 ? 'post-core-crown' : finding === 17 ? 'post-core' : finding === 10 ? 'crown' : finding === 8 ? 'composite' : /post|دعامة|دعامه/i.test(name) ? /crown|كراون|تاج/i.test(name) ? 'post-core-crown' : 'post-core' : 'composite';
    }
    this.rootCanalDrafts.set(number, { treatmentId, draft });
    return draft;
  }
  validRootCanal(number: number) {
    const draft = this.rootCanalFor(number);
    const valid = draft.stage >= 1 && draft.stage <= 8 && (draft.restorationType==='crown-only' || draft.canals.some(c=>c.enabled!==false)) && draft.notes.length <= 2000 && draft.canals.every(c => (c.lengthMm === null || Number.isFinite(c.lengthMm) && c.lengthMm > 0 && c.lengthMm <= 50) && c.finalFileSize.length <= 50);
    if (!valid) this.error.set(this.t('Check the treatment stage and canal measurements (greater than 0 and at most 50 mm).', 'راجع المرحلة وقياسات القنوات؛ الطول أكبر من صفر وحتى 50 مم.'));
    return valid;
  }
  private readonly viewInjector = inject(Injector);
  private readonly viewHost: ElementRef<HTMLElement> = inject(ElementRef);
  async resumeRootCanal(work: Treatment) {
    const exam = this.examination();
    if (!exam?.canEdit || this.savingTreatment() || this.savingRootCanal()) return;
    this.savingRootCanal.set(true); this.error.set('');
    try {
      const treatment = await firstValueFrom(this.treatmentApi.treatment(work.id));
      if (treatment.patientId !== exam.patientId || ![4,5].includes(treatment.type) || treatment.toothNumbers.length !== 1 || ![1, 2, 3].includes(treatment.status) || !treatment.catalogItemId) throw new Error('Invalid treatment');
      if (!this.patientChart()) this.patientChart.set(await firstValueFrom(this.api.chart(exam.patientId)));
      if (!this.catalog().length) this.catalog.set((await firstValueFrom(this.treatmentApi.catalog())).filter(item => item.isActive));
      const number = treatment.toothNumbers[0];
      this.toothServices[number] = { catalogId: treatment.catalogItemId, treatmentId: treatment.id, treatmentType: treatment.type, treatmentName: treatment.treatmentName, tierId: 'base', price: treatment.price, cariesClass: null, status: 'in_progress', notes: treatment.notes ?? '', remaining: '' };
      if (!this.selectedTeeth.includes(number)) this.selectedTeeth = [...this.selectedTeeth, number];
      if (!this.treatmentTeeth.includes(number)) this.treatmentTeeth = [...this.treatmentTeeth, number];
      this.rootCanalDrafts.delete(number); this.rootCanalFor(number); this.step.set(3);
      afterNextRender(() => {
        const editor = this.viewHost.nativeElement.querySelector<HTMLElement>('.tooth-service-row[data-tooth="' + number + '"]');
        editor?.scrollIntoView?.({block: 'center', behavior: 'instant'});
        editor?.focus({preventScroll: true});
      }, {injector: this.viewInjector});
    } catch (error) { this.error.set(parseApiError(error, this.t('Could not open the saved root canal treatment.', 'تعذر فتح علاج العصب المسجل.'))); }
    finally { this.savingRootCanal.set(false); }
  }
  private rootCanalWrites: Promise<void> | null = null;
  readonly rootCanalAutoStatus = signal<Record<number, string>>({});
  readonly rootCanalAutoErrors = signal<number[]>([]);
  private persistRootCanal(number: number) {
    const write = this.rootCanalWrites ? this.rootCanalWrites.then(() => this.writeRootCanal(number)) : this.writeRootCanal(number);
    const settled = write.catch(() => {});
    this.rootCanalWrites = settled;
    void settled.then(() => { if (this.rootCanalWrites === settled) this.rootCanalWrites = null; });
    return write;
  }
  async autoSaveRootCanal(number: number) {
    if (!this.examination()?.canEdit || !this.toothServiceIsRootCanal(number) || this.toothService(number).confirmedCompleted) return;
    this.rootCanalAutoStatus.update(state => ({...state, [number]: this.t('Saving…', 'جارٍ الحفظ التلقائي…')}));
    try {
      await this.persistRootCanal(number);
      if (this.rootCanalFor(number).stage === 6 && this.toothService(number).treatmentId) { await this.syncRootCanalStatus(number); this.loadTreatments(this.examination()!.patientId); }
      this.rootCanalAutoErrors.update(items => items.filter(item => item !== number));
      this.rootCanalAutoStatus.update(state => ({...state, [number]: this.t('Saved automatically', 'تم الحفظ تلقائيًا')}));
    } catch {
      this.rootCanalAutoErrors.update(items => [...new Set([...items, number])]);
      this.rootCanalAutoStatus.update(state => ({...state, [number]: this.t('Not saved — retry', 'لم يتم الحفظ — أعد المحاولة')}));
    }
  }
  private async writeRootCanal(number: number) {
    const exam = this.examination()!;
    const row = this.toothService(number), draft = this.rootCanalFor(number);
    const existing = exam.endodonticRecords.find(record => record.toothNumber === number && (!record.treatmentId || record.treatmentId === row.treatmentId));
    const request = { workflowJson: serializeWorkflow(draft), restorationType: draft.restorationType, postType: workflowFor(draft).needsPost ? draft.postType : null, postCanal: workflowFor(draft).needsPost ? draft.postCanal : null, toothNumber: number, treatmentId: row.treatmentId, stage: draft.stage, notes: draft.notes || undefined, canals: draft.canals.filter(c=>c.enabled!==false).map(c => ({ ...c, finalFileSize: c.finalFileSize || undefined })), version: exam.version };
    await firstValueFrom(existing ? this.api.updateEndodontic(exam.id, existing.id, request) : this.api.addEndodontic(exam.id, request));
    this.examination.set(await firstValueFrom(this.api.examination(exam.id)));
    this.loadPatient(exam.patientId);
  }
  private applyRootCanalStatus(number: number) {
    const row = this.toothService(number), draft = this.rootCanalFor(number);
    row.status = draft.stage === 6 ? 'completed' : 'in_progress';
    const stage = rootCanalStages(draft.restorationType).find(item => item.value === (draft.stage === 3 ? 2 : draft.stage));
    row.remaining = draft.stage === 6 ? '' : stage?.en ?? 'Access cavity';
    return row.status === 'completed' ? 4 : 3;
  }
  private async syncRootCanalStatus(number: number) {
    const row = this.toothService(number), target = this.rootCanalFor(number).stage === 6 ? 4 : 3;
    const treatment = await firstValueFrom(this.treatmentApi.treatment(row.treatmentId!));
    if (treatment.status !== target) await firstValueFrom(this.treatmentApi.treatmentAction(treatment.id, target === 4 ? 'complete' : 'start', treatment.version));
    this.applyRootCanalStatus(number); row.confirmedCompleted = target === 4;
    if (target === 4) { this.finishTooth(number); this.loadPatient(this.examination()!.patientId); }
  }
  async saveRootCanal(number: number) {
    if (!this.examination()?.canEdit || !this.toothService(number).treatmentId || !this.toothServiceIsRootCanal(number) || this.savingTreatment() || this.savingRootCanal() || !this.validRootCanal(number)) return;
    this.savingRootCanal.set(true); this.error.set('');
    try { await this.persistRootCanal(number); await this.syncRootCanalStatus(number); this.loadTreatments(this.examination()!.patientId); this.success.set(this.t('Session progress saved without an additional charge.', 'تم حفظ تقدم الجلسة بدون إضافة تكلفة.')); }
    catch (error) { if (error instanceof HttpErrorResponse) this.fail(error); else this.error.set(parseApiError(error, this.t('Could not save root canal details.', 'تعذر حفظ تفاصيل حشو العصب.'))); }
    finally { this.savingRootCanal.set(false); }
  }
  selectToothService(number: number) {
    const row = this.toothService(number);
    const first = this.toothServiceTiers(number)[0];
    row.tierId = first?.id ?? 'base'; row.price = first?.price ?? 0;
    if (!this.toothServiceIsFilling(number)) row.cariesClass = null;
    if (this.toothServiceIsRootCanal(number)) row.status = 'in_progress';
  }
  selectToothServiceTier(number: number) {
    const row = this.toothService(number);
    const tier = this.toothServiceTiers(number).find(tier => tier.id === row.tierId);
    if (tier) row.price = tier.price;
  }
  async executeToothService(number: number) {
    const exam = this.examination();
    const row = this.toothService(number);
    if (!exam?.canEdit || this.savingTreatment() || this.savingRootCanal() || !row.catalogId || !Number.isFinite(row.price) || row.price < 0) return;
    if (number <= 0 ? !this.treatmentRowKeys().includes(number) : !this.treatmentTeeth.includes(number) || !this.surveyTeeth().includes(number)) return;
    if (!row.treatmentId && this.toothServiceIsFilling(number) && (!this.cariesClasses.includes(row.cariesClass ?? 0) || !this.fillingMaterials.includes(row.fillingMaterial ?? ''))) {
      this.error.set(this.t('Choose the filling class and material.', 'اختر كلاس الحشو ونوع الحشو.')); return;
    }
    if (this.toothServiceIsExtraction(number) && this.extractionFor(number).condition === 'Impacted' && !this.extractionFor(number).direction) {
      this.error.set(this.t('Choose the impacted tooth direction.', 'اختر اتجاه الضرس.')); return;
    }
    if (!row.treatmentId && !this.toothServiceCatalog(number).some(item => item.id === row.catalogId)) {
      this.error.set(this.t('Choose a service for the selected treatment scope.', 'اختر خدمة مناسبة لهذا السن أو للفم بالكامل.')); return;
    }
    if (this.toothServiceIsRootCanal(number)) {
      if (!this.validRootCanal(number)) return;
      this.applyRootCanalStatus(number);
    }
    this.savingTreatment.set(true); this.error.set('');
    try {
      const appointment = this.appointment() ?? await firstValueFrom(this.appointmentApi.appointment(this.appointmentId));
      this.appointment.set(appointment);
      if (!row.treatmentId) {
        const tier = this.toothServiceTiers(number).find(tier => tier.id === row.tierId);
        const notes = [this.toothServiceIsFilling(number) ? 'Filling material: ' + row.fillingMaterial : '', this.extractionSummary(number), this.toothServiceIsRootCanal(number) ? this.rootCanalFor(number).notes.trim() : row.notes.trim(), tier && row.tierId !== 'base' ? this.t(tier.nameEn, tier.nameAr) : '', this.toothServiceIsFilling(number) && row.cariesClass ? 'Class ' + ['I','II','III','IV','V','VI'][row.cariesClass - 1] : '', !this.toothServiceIsRootCanal(number) && row.status === 'in_progress' ? '(متبقي: ' + (row.remaining.trim() || 'استكمال العلاج') + ')' : '', number <= 0 ? this.t('Whole mouth — one service charge', 'الفم بالكامل — خدمة واحدة') : ''].filter(Boolean).join(' · ');
        const teeth = number <= 0 ? Array.from({ length: 4 }, (_, quadrant) => Array.from({ length: 8 }, (_, index) => (quadrant + 1) * 10 + index + 1)).flat() : [number];
        const created = await firstValueFrom(this.treatmentApi.createTreatment({ patientId: exam.patientId, doctorProfileId: appointment.doctorProfileId, appointmentId: this.appointmentId, catalogItemId: row.catalogId, toothNumbers: teeth, deferBilling: true, price: row.price, notes: notes || undefined }));
        row.treatmentId = created.id;
          const clinicalDraft = this.rootCanalDrafts.get(number);
          if (clinicalDraft) clinicalDraft.treatmentId = created.id;
      }
      if (this.toothServiceIsRootCanal(number)) await this.persistRootCanal(number);
      const treatment = await firstValueFrom(this.treatmentApi.treatment(row.treatmentId));
      const targetStatus = row.status === 'completed' ? 4 : 3;
      if (treatment.status !== targetStatus) await firstValueFrom(this.treatmentApi.treatmentAction(treatment.id, row.status === 'completed' ? 'complete' : 'start', treatment.version));
      if (number <= 0) { this.wholeMouthTreatment = false; if (number < 0) this.recordedWholeMouth.add(number); }
      else if (row.status === 'completed') this.finishTooth(number);
      else this.treatmentTeeth = this.treatmentTeeth.filter(tooth => tooth !== number);
      delete this.toothServices[number]; this.rootCanalDrafts.delete(number);
      this.success.set(this.t('Service recorded for ', 'تم تسجيل الخدمة لـ ') + (number <= 0 ? this.t('the whole mouth.', 'الفم بالكامل.') : '#' + number + ' · ' + this.toothLabel(number)));
    } catch (error) { if (error instanceof HttpErrorResponse) this.fail(error); else this.error.set(parseApiError(error, this.t('Could not save. Retry the request.', 'تعذر الحفظ. أعد المحاولة.'))); }
    finally {
      this.savingTreatment.set(false);
      this.loadTreatments(exam.patientId); this.loadPatient(exam.patientId); this.loadBalance(exam.patientId);
    }
  }

  recordTreatmentForSelectedTooth() {
    this.recordTreatmentExecution();
  }

  recordTreatmentExecution() {
    const e = this.examination();
    if (!e || !this.selectedCatalogId) return;
    if (!this.treatmentTeeth.length || this.treatmentTeeth.some(number => !this.surveyTeeth().includes(number))) {
      this.error.set(this.t('Select teeth before recording treatment.', 'اختر الأسنان قبل تسجيل العلاج.'));
      return;
    }

    this.savingTreatment.set(true);
    this.error.set('');

    const execute = (doctorProfileId: string) => {
      const teeth = [...this.treatmentTeeth];

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
                            `Procedure for ${this.treatmentTeethLabel()} completed and billed successfully (Finished).`,
                            `تم تسجيل وانتهاء إجراء ${this.treatmentTeethLabel()} وترحيل المبلغ للحساب بنجاح (خَلَصْ).`,
                          )
                        : this.t(
                            `Procedure for ${this.treatmentTeethLabel()} started (In Progress) and billed successfully.`,
                            `تم تسجيل بدء إجراء ${this.treatmentTeethLabel()} وترحيل المبلغ للحساب بنجاح (بدأ العلاج ولسه هنكمل).`,
                          );
                    this.success.set(msg);
                    this.treatmentToothNumber = null;
                    this.treatmentTeeth = [];
                    this.treatmentNotes = '';
                    this.remainingWorkDescription = '';
                    this.selectedCatalogId = '';
                    this.treatmentUnitPrice = 0;
                    this.treatmentPrice = 0;
                    this.currentParsedItem.set(null);
                    this.loadTreatments(e.patientId);
                    this.loadPatient(e.patientId);
                    this.loadBalance(e.patientId);
                    setTimeout(() => this.applyUnfinishedToFollowUpNotes(), 600);
                  },
                  error: (err) => {
                    this.savingTreatment.set(false);
                    this.fail(err);
                    this.loadTreatments(e.patientId);
                    this.loadPatient(e.patientId);
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
      (t) => t.status === 3 || t.status === 1 || t.status === 2,
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
    const dateStr = this.followUpLocalDate(d);
    this.suggestedFollowUpDate = dateStr;
    this.loadAvailabilitySlots(dateStr);
  }

  isFollowUpSelected(days: number): boolean {
    if (!this.suggestedFollowUpDate) return false;
    const d = new Date();
    d.setDate(d.getDate() + days);
    return this.suggestedFollowUpDate === this.followUpLocalDate(d);
  }

  followUpLocalDate(date: Date): string {
    return this.localDate(date.toISOString(), this.appointment()?.timeZone || 'Africa/Cairo');
  }

  private setFollowUpAppointment(app: AppointmentDetails) {
    this.appointment.set(app);
    if (this.followUpDurationInitialized) return;
    const duration = app.suggestedDurationMinutes;
    if (duration !== undefined && Number.isInteger(duration) && duration >= 5 && duration <= 480) {
      this.followUpDuration = duration;
      this.followUpDurationInitialized = true;
    }
  }

  changeFollowUpDuration(value: number) {
    this.followUpDurationInitialized = true;
    this.followUpDuration = Number(value);
    this.loadAvailabilitySlots();
  }

  private availabilityRequest = 0;

  loadAvailabilitySlots(dateStr?: string) {
    const requestId = ++this.availabilityRequest;
    const d = dateStr ?? this.suggestedFollowUpDate;
    this.suggestedFollowUpDate = d || '';
    this.followUpPage = { morning: 0, evening: 0 }; this.availableSlots.set([]);
    this.selectedSlot.set(null);
    this.bookedAppointment.set(null);
    this.bookingError.set('');
    this.loadingSlots.set(false);
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!Number.isInteger(this.followUpDuration) || this.followUpDuration < 5 || this.followUpDuration > 480) {
      this.bookingError.set(this.t('Duration must be between 5 and 480 minutes.', 'مدة الموعد يجب أن تكون من 5 إلى 480 دقيقة.'));
      return;
    }
    this.loadingSlots.set(true);
    const appointment = this.appointment();
    (appointment?.doctorProfileId ? of(appointment) : this.appointmentApi.appointment(this.appointmentId))
      .pipe(switchMap(app => {
        this.setFollowUpAppointment(app);
        if (!app.doctorProfileId) throw new Error(this.t('Doctor profile is unavailable.', 'ملف الطبيب غير متاح.'));
        return this.appointmentApi.availability(app.doctorProfileId, d, this.followUpDuration);
      })).subscribe({
        next: slots => {
          if (requestId !== this.availabilityRequest) return;
          this.followUpPage = { morning: 0, evening: 0 }; this.availableSlots.set(slots || []);
          this.loadingSlots.set(false);
        },
        error: err => {
          if (requestId !== this.availabilityRequest) return;
          this.loadingSlots.set(false);
          this.bookingError.set(parseApiError(err, this.t('Could not load appointment slots. Try again.', 'تعذر تحميل المواعيد. حاول مرة أخرى.')));
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

    const doctorId = app?.doctorProfileId || e.doctorProfileId;
    if (!doctorId) {
      this.bookingError.set(this.t('Doctor profile is unavailable. Reload appointment slots.', 'ملف الطبيب غير متاح. أعد تحميل المواعيد.'));
      return;
    }
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
        error: (err) => {
          this.bookingAppointment.set(false);
          this.bookingError.set(parseApiError(err,
            this.t(
              'Could not book this appointment slot. Please try another time.',
              'تعذر حجز هذا الموعد. يرجى تجربة وقت آخر.',
            )));

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
    if (!e || this.paymentAmount <= 0 || this.recordingPayment()) return;

    this.recordingPayment.set(true);
    let amountToPay = this.paymentAmount;
    const now = new Date();
    const todayDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const nowTime = new Date().toTimeString().slice(0, 5);

    try {
      // Read the posted balance before allocating a payment; never invent a charge on failure.
      const currentBalance = await firstValueFrom(this.financeApi.patientBalance(e.patientId));
      this.balance.set(currentBalance);
      if (amountToPay > currentBalance.outstanding) throw new Error(this.t('Payment exceeds the posted patient balance.', 'المبلغ أكبر من المستحق المرحل على المريض.'));
      const revenuePage = await firstValueFrom(this.financeApi.revenues({ patientId: e.patientId, pageSize: 100, page: 1 }));
      const revenues = [...revenuePage.items];
      for (let page = 2; page <= revenuePage.totalPages; page++) {
        const next = await firstValueFrom(this.financeApi.revenues({ patientId: e.patientId, pageSize: 100, page }));
        revenues.push(...next.items);
      }
      const unpaidList = revenues.filter(revenue => revenue.outstanding > 0);
      if (unpaidList.reduce((sum, revenue) => sum + revenue.outstanding, 0) < amountToPay) {
        throw new Error(this.t('Reload the posted charges before payment.', 'حدّث المستحقات المرحلة قبل السداد.'));
      }
      this.paymentRecorded.set(0);
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
          this.paymentRecorded.update(total => total + payForThis);
        }
      }

      this.recordingPayment.set(false);
      this.success.set(this.t('Payment recorded successfully.', 'تم تسجيل الدفعة بنجاح.'));
      this.paymentAmount = 0;
      this.loadBalance(e.patientId);
    } catch (err: any) {
      this.paymentAmount = amountToPay;
      this.loadBalance(e.patientId);
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
    if (this.hasPendingVisitPrices()) { this.error.set(this.t('Approve the service prices in Accounting first.', 'اعتمد أسعار الإجراءات في خطوة الحساب أولًا.')); this.setStep(4); return; }
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

