import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LocalizationService } from '../../core/localization.service';
import { AppointmentApiService, AppointmentDetails, AppointmentItem } from '../appointments/appointment-api.service';
import { DentalApiService, ExaminationDetails } from '../dental/dental-api.service';
import { FINDING_APPEARANCE } from '../dental/dental-appearance';
import { FinanceApiService, PatientBalance, Payment, Revenue } from '../finance/finance-api.service';
import { Prescription, PrescriptionApiService, PrescriptionList } from '../prescriptions/prescription-api.service';
import { Treatment, TreatmentApiService } from '../treatments/treatment-api.service';
import { PatientApiService, PatientDetails } from './patient-api.service';

export interface VisitHistoryStageData {
  appointment: AppointmentItem | AppointmentDetails;
  examination?: ExaminationDetails | null;
  treatments: Treatment[];
  prescriptions: (Prescription | PrescriptionList)[];
  revenues: Revenue[];
  payments: Payment[];
}

@Component({
  selector: 'app-patient-visit-history-sheet',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="sheet-backdrop" (click)="close.emit()">
      <div class="sheet-modal-window" (click)="$event.stopPropagation()">
        <!-- Non-printable Top Bar -->
        <header class="sheet-top-toolbar no-print">
          <div class="toolbar-title-group">
            <span class="sheet-icon">📑</span>
            <div>
              <h3>{{ t('Comprehensive 5-Stage Patient Visit History Sheet', 'ورقة السجل الطبي والزيارات السابقة (المراحل الـ 5)') }}</h3>
              <p class="subtitle">
                {{ patient()?.firstName }} {{ patient()?.lastName }} · 
                <span class="mono">{{ patient()?.patientNumber }}</span>
                @if (visits().length) {
                  · <span class="badge-count">{{ visits().length }} {{ t('Visits Recorded', 'زيارة مسجلة') }}</span>
                }
              </p>
            </div>
          </div>

          <div class="toolbar-btn-group">
            <button type="button" class="btn-tool btn-refresh" (click)="loadAllData()" [disabled]="loading()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>{{ loading() ? t('Loading…', 'جاري التحميل…') : t('Refresh', 'تحديث') }}</span>
            </button>

            <button type="button" class="btn-tool btn-print" (click)="printSheet()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="icon-svg">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span>{{ t('Print Sheet', 'طباعة الورقة') }}</span>
            </button>

            <button type="button" class="btn-close" (click)="close.emit()" [attr.aria-label]="t('Close', 'إغلاق')">✕</button>
          </div>
        </header>

        <!-- Printable Unified One-Sheet Document -->
        <main class="sheet-document-body" id="patient-visit-history-print">
          <!-- Sheet Header (Clinic & Patient Info) -->
          <header class="sheet-doc-header">
            <div class="clinic-info-bar">
              <div class="brand-badge">🦷</div>
              <div>
                <h2>{{ t('Patient Medical & Clinical Visits History Sheet', 'سجل الفحص الطبي وتاريخ الزيارات السريرية للمريض') }}</h2>
                <p>{{ t('Unified 5-Stage Comprehensive Record for Clinical Review', 'ورقة السجل الشامل الموحد للمراجعة السريرية المباشرة (5 مراحل)') }}</p>
              </div>
            </div>

            <div class="doc-date-meta">
              <div class="meta-item">
                <span class="lbl">{{ t('Generated On:', 'تاريخ التقرير:') }}</span>
                <strong>{{ now | date: 'dd/MM/yyyy · hh:mm a' }}</strong>
              </div>
              <div class="meta-item">
                <span class="lbl">{{ t('Patient File:', 'رقم الملف:') }}</span>
                <strong class="mono highlight">{{ patient()?.patientNumber }}</strong>
              </div>
            </div>
          </header>

          <!-- Patient Summary & Medical Alerts Banner -->
          <section class="patient-summary-card">
            <div class="summary-top-row">
              <div class="patient-main-info">
                <span class="patient-avatar">👤</span>
                <div>
                  <h3 class="patient-fullname">{{ patient()?.firstName }} {{ patient()?.middleName || '' }} {{ patient()?.lastName }}</h3>
                  <div class="patient-sub-details">
                    <span>{{ genderLabel(patient()?.gender) }}</span>
                    <span>·</span>
                    <span>{{ calculateAge(patient()?.dateOfBirth) }} {{ t('years old', 'سنة') }} ({{ (patient()?.dateOfBirth | date: 'dd/MM/yyyy') || '—' }})</span>
                    <span>·</span>
                    <span class="phone-dir">📞 {{ patient()?.phone || '—' }}</span>
                  </div>
                </div>
              </div>

              <!-- Quick Financial & Clinical Metrics -->
              <div class="quick-metrics-grid">
                <div class="metric-pill">
                  <span class="m-lbl">{{ t('Total Visits', 'إجمالي الزيارات') }}</span>
                  <strong class="m-val">{{ visits().length }}</strong>
                </div>
                <div class="metric-pill">
                  <span class="m-lbl">{{ t('Procedures Done', 'الإجراءات المنفذة') }}</span>
                  <strong class="m-val success">{{ totalCompletedTreatments() }}</strong>
                </div>
                <div class="metric-pill">
                  <span class="m-lbl">{{ t('Total Invoiced', 'إجمالي الفواتير') }}</span>
                  <strong class="m-val">{{ balance()?.totalRevenue || 0 }} EGP</strong>
                </div>
                <div class="metric-pill" [class.danger-pill]="(balance()?.outstanding || 0) > 0">
                  <span class="m-lbl">{{ t('Outstanding Balance', 'المتبقي المستحق') }}</span>
                  <strong class="m-val">{{ balance()?.outstanding || 0 }} EGP</strong>
                </div>
              </div>
            </div>

            <!-- Medical Alerts Highlights Strip -->
            <div class="medical-alerts-strip">
              <div class="alert-box allergy-alert">
                <span class="alert-title">⚠️ {{ t('Allergies & Sensitivities:', 'الحساسية والمحاذير:') }}</span>
                @if (patient()?.allergies?.length) {
                  <div class="alert-chips">
                    @for (a of patient()!.allergies; track a.id) {
                      <span class="chip chip-danger">{{ a.name }}</span>
                    }
                  </div>
                } @else {
                  <span class="empty-txt">{{ t('No known allergies recorded', 'لا توجد حساسية مسجلة') }}</span>
                }
              </div>

              <div class="alert-box condition-alert">
                <span class="alert-title">🩺 {{ t('Chronic Conditions:', 'الأمراض المزمنة:') }}</span>
                @if (patient()?.medicalConditions?.length) {
                  <div class="alert-chips">
                    @for (c of patient()!.medicalConditions; track c.id) {
                      <span class="chip chip-warning">{{ c.name }}</span>
                    }
                  </div>
                } @else {
                  <span class="empty-txt">{{ t('No chronic conditions recorded', 'لا توجد أمراض مزمنة مسجلة') }}</span>
                }
              </div>

              <div class="alert-box medication-alert">
                <span class="alert-title">💊 {{ t('Regular Medications:', 'الأدوية المستمرة:') }}</span>
                @if (patient()?.medications?.length) {
                  <div class="alert-chips">
                    @for (m of patient()!.medications; track m.id) {
                      <span class="chip chip-info">{{ m.name }} @if (m.dosage) { <small>({{ m.dosage }})</small> }</span>
                    }
                  </div>
                } @else {
                  <span class="empty-txt">{{ t('No regular medications recorded', 'لا توجد أدوية منتظمة مسجلة') }}</span>
                }
              </div>
            </div>
          </section>

          <!-- Loading State -->
          @if (loading()) {
            <div class="sheet-loading-block no-print">
              <div class="loading-spinner"></div>
              <p>{{ t('Retrieving all previous 5-stage clinical visits…', 'جاري تجميع وتحميل كافة الزيارات والمراحل الـ 5 السابقة…') }}</p>
            </div>
          }

          <!-- VISITS TIMELINE & 5-STAGE RECORD CARDS -->
          @if (!loading() && visits().length > 0) {
            <div class="visits-stream-container">
              @for (v of visits(); track v.appointment.id; let idx = $index) {
                <article class="visit-card-sheet">
                  <!-- Visit Header Band -->
                  <header class="visit-card-header">
                    <div class="visit-badge-order">
                      <span class="order-num">#{{ visits().length - idx }}</span>
                      <div class="visit-datetime">
                        <h4>{{ v.appointment.startAt | date: 'EEEE, dd/MM/yyyy' }}</h4>
                        <span class="time-stamp">⏰ {{ v.appointment.startAt | date: 'hh:mm a' }} · ({{ v.appointment.durationMinutes }} {{ t('min', 'دقيقة') }})</span>
                      </div>
                    </div>

                    <div class="visit-meta-badges">
                      <span class="doc-badge">👨‍⚕️ {{ v.appointment.doctorName }}</span>
                      <span class="type-badge">{{ appointmentTypeLabel(v.appointment.type) }}</span>
                      <span class="status-badge" [class.status-completed]="v.appointment.status === 5">
                        {{ appointmentStatusLabel(v.appointment.status) }}
                      </span>
                    </div>
                  </header>

                  <!-- 5 STAGES UNIFIED GRID -->
                  <div class="five-stages-wrapper">
                    <!-- STAGE 1: Intake & Notes -->
                    <section class="stage-section stage-1">
                      <div class="stage-header">
                        <span class="stage-badge">1</span>
                        <h5>📋 {{ t('1. Intake & Chief Complaint', '1. استقبال المريض والشكوى الأولية') }}</h5>
                      </div>
                      <div class="stage-body">
                        @if (v.examination?.notes || (v.appointment && 'notes' in v.appointment && v.appointment.notes)) {
                          <div class="complaint-text">
                            <strong>{{ t('Notes / Chief Complaint:', 'الشكوى والملاحظات:') }}</strong>
                            <p>{{ v.examination?.notes || (v.appointment && 'notes' in v.appointment ? v.appointment.notes : '') }}</p>
                          </div>
                        } @else {
                          <p class="empty-stage-txt">{{ t('No specific chief complaint notes recorded.', 'لا توجد ملاحظات شكوى مدونة لهذه الزيارة.') }}</p>
                        }
                      </div>
                    </section>

                    <!-- STAGE 2: Dental Chart & Findings -->
                    <section class="stage-section stage-2">
                      <div class="stage-header">
                        <span class="stage-badge">2</span>
                        <h5>🦷 {{ t('2. Dental Chart & Findings', '2. مخطط الأسنان والتشخيص') }}</h5>
                      </div>
                      <div class="stage-body">
                        @if (v.examination && (v.examination.findings.length > 0 || v.examination.endodonticRecords.length > 0)) {
                          <div class="findings-list">
                            @for (f of v.examination.findings; track f.id) {
                              <div class="finding-item">
                                <span class="tooth-pill">#{{ f.toothNumber }}</span>
                                <span class="finding-name">{{ findingName(f.type) }}</span>
                                @if (f.notes) {
                                  <span class="finding-notes">({{ f.notes }})</span>
                                }
                              </div>
                            }
                            @for (endo of v.examination.endodonticRecords; track endo.id) {
                              <div class="finding-item endo-item">
                                <span class="tooth-pill">#{{ endo.toothNumber }}</span>
                                <span class="finding-name">🔬 {{ t('Endodontic Root Canal', 'علاج جذور') }}:</span>
                                <span class="endo-canals">
                                  @for (c of endo.canals; track c.id) {
                                    <small>{{ c.name }}: {{ c.lengthMm }}mm</small>
                                  }
                                </span>
                              </div>
                            }
                          </div>
                        } @else {
                          <p class="empty-stage-txt">{{ t('No findings or chart records recorded in this visit.', 'لم يتم تسجيل نتائج تشخيص في هذا الموعد.') }}</p>
                        }
                      </div>
                    </section>

                    <!-- STAGE 3: Executed Procedures & Treatments -->
                    <section class="stage-section stage-3">
                      <div class="stage-header">
                        <span class="stage-badge">3</span>
                        <h5>🛠️ {{ t('3. Executed Procedures & Treatments', '3. الإجراءات والعلاجات المنفذة') }}</h5>
                      </div>
                      <div class="stage-body">
                        @if (v.treatments.length > 0) {
                          <table class="stage-mini-table">
                            <thead>
                              <tr>
                                <th>{{ t('Procedure', 'الإجراء / العلاج') }}</th>
                                <th>{{ t('Tooth', 'السن') }}</th>
                                <th>{{ t('Price', 'المبلغ') }}</th>
                                <th>{{ t('Status', 'الحالة') }}</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (tr of v.treatments; track tr.id) {
                                <tr>
                                  <td><strong>{{ tr.treatmentName }}</strong> @if (tr.notes) { <small>({{ tr.notes }})</small> }</td>
                                  <td><span class="tooth-tag">{{ tr.toothNumbers && tr.toothNumbers.length ? '#' + tr.toothNumbers.join(', #') : '—' }}</span></td>
                                  <td><strong>{{ tr.price }} EGP</strong></td>
                                  <td><span class="badge-mini-done">✓ {{ t('Completed', 'مكتمل') }}</span></td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        } @else {
                          <p class="empty-stage-txt">{{ t('No treatments executed in this visit.', 'لا توجد إجراءات علاجية منفذة في هذه الزيارة.') }}</p>
                        }
                      </div>
                    </section>

                    <!-- STAGE 4: Prescription & Medications -->
                    <section class="stage-section stage-4">
                      <div class="stage-header">
                        <span class="stage-badge">4</span>
                        <h5>💊 {{ t('4. Prescription & Medicines', '4. الروشتة والأدوية المصروفة') }}</h5>
                      </div>
                      <div class="stage-body">
                        @if (v.prescriptions.length > 0) {
                          @for (rx of v.prescriptions; track rx.id) {
                            <div class="rx-block">
                              <div class="rx-head">
                                <span class="rx-num">📋 Rx #{{ rx.prescriptionNumber }}</span>
                                <span class="rx-date">{{ (rx.issuedAt || rx.createdAt) | date: 'dd/MM/yyyy' }}</span>
                              </div>
                              @if ('items' in rx && rx.items && rx.items.length) {
                                <ul class="rx-meds-list">
                                  @for (item of rx.items; track item.id) {
                                    <li>
                                      <strong>{{ item.medicationName }}</strong>
                                      <span>— {{ item.dose }} · {{ item.frequency }} · {{ item.duration }}</span>
                                      @if (item.instructions) { <small>({{ item.instructions }})</small> }
                                    </li>
                                  }
                                </ul>
                              }
                            </div>
                          }
                        } @else {
                          <p class="empty-stage-txt">{{ t('No prescriptions issued in this visit.', 'لم يتم إصدار روشتة في هذه الزيارة.') }}</p>
                        }
                      </div>
                    </section>

                    <!-- STAGE 5: Billing & Payments -->
                    <section class="stage-section stage-5">
                      <div class="stage-header">
                        <span class="stage-badge">5</span>
                        <h5>💳 {{ t('5. Billing & Payments', '5. المحاسبة والمدفوعات') }}</h5>
                      </div>
                      <div class="stage-body">
                        <div class="billing-summary-row">
                          <div class="bill-stat">
                            <span class="b-lbl">{{ t('Visit Charges:', 'إجمالي الخدمات:') }}</span>
                            <strong class="b-val">{{ calculateVisitBilled(v) }} EGP</strong>
                          </div>
                          <div class="bill-stat">
                            <span class="b-lbl">{{ t('Paid Amount:', 'المدفوع:') }}</span>
                            <strong class="b-val text-success">{{ calculateVisitPaid(v) }} EGP</strong>
                          </div>
                          <div class="bill-stat">
                            <span class="b-lbl">{{ t('Visit Balance:', 'متبقي الزيارة:') }}</span>
                            <strong class="b-val" [class.text-danger]="(calculateVisitBilled(v) - calculateVisitPaid(v)) > 0">
                              {{ calculateVisitBilled(v) - calculateVisitPaid(v) }} EGP
                            </strong>
                          </div>
                        </div>

                        @if (v.payments.length > 0) {
                          <div class="payments-mini-list">
                            @for (p of v.payments; track p.id) {
                              <span class="payment-pill">
                                💰 {{ p.amount }} EGP ({{ paymentMethodLabel(p.paymentMethod) }})
                              </span>
                            }
                          </div>
                        }
                      </div>
                    </section>
                  </div>
                </article>
              }
            </div>
          } @else if (!loading() && visits().length === 0) {
            <div class="empty-visits-hero">
              <div class="empty-hero-icon">📋</div>
              <h3>{{ t('No Previous Clinical Visits Found', 'لا توجد زيارات أو كشوفات سابقة مسجلة لهذا المريض') }}</h3>
              <p>{{ t('All upcoming and completed visits will automatically generate their 5-stage records here.', 'أي زيارات سابقة أو مكتملة ستظهر بسجلها الكامل بمراحلها الخمس هنا تلقائياً.') }}</p>
            </div>
          }
        </main>
      </div>
    </div>
  `,
  styles: [`
    .sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.72);
      backdrop-filter: blur(4px);
      z-index: 1200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.18s ease-out;
    }

    .sheet-modal-window {
      background: #ffffff;
      width: 100%;
      max-width: 1100px;
      max-height: 92vh;
      border-radius: 1rem;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      overflow: hidden;
    }

    .sheet-top-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1.4rem;
      background: #0f172a;
      color: #ffffff;
      gap: 1rem;
      border-bottom: 1px solid #1e293b;

      .toolbar-title-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .sheet-icon {
          font-size: 1.6rem;
        }

        h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: #f8fafc;
        }

        .subtitle {
          margin: 0.15rem 0 0;
          font-size: 0.82rem;
          color: #94a3b8;
        }

        .badge-count {
          background: #3b82f6;
          color: #ffffff;
          padding: 0.1rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 700;
        }
      }

      .toolbar-btn-group {
        display: flex;
        align-items: center;
        gap: 0.6rem;

        .btn-tool {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.45rem 0.85rem;
          border-radius: 0.45rem;
          font-size: 0.84rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;

          .icon-svg {
            width: 1rem;
            height: 1rem;
          }

          &.btn-refresh {
            background: #334155;
            color: #f8fafc;
            &:hover:not(:disabled) { background: #475569; }
          }

          &.btn-print {
            background: #2563eb;
            color: #ffffff;
            &:hover { background: #1d4ed8; }
          }
        }

        .btn-close {
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.35rem 0.6rem;
          border-radius: 0.35rem;
          &:hover { color: #ffffff; background: #334155; }
        }
      }
    }

    .sheet-document-body {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      background: #f8fafc;
    }

    .sheet-doc-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 1rem;
      border-bottom: 2px solid #e2e8f0;
      margin-bottom: 1.2rem;
      background: #ffffff;
      padding: 1rem 1.25rem;
      border-radius: 0.65rem;
      border: 1px solid #e2e8f0;

      .clinic-info-bar {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .brand-badge {
          font-size: 1.8rem;
          width: 3rem;
          height: 3rem;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eff6ff;
          border-radius: 0.6rem;
          border: 1px solid #bfdbfe;
        }

        h2 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
        }

        p {
          margin: 0.15rem 0 0;
          font-size: 0.82rem;
          color: #64748b;
        }
      }

      .doc-date-meta {
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        font-size: 0.82rem;

        .lbl { color: #64748b; margin-inline-end: 0.4rem; }
        .mono { font-family: monospace; font-size: 0.95rem; }
        .highlight { color: #2563eb; }
      }
    }

    .patient-summary-card {
      background: #ffffff;
      border-radius: 0.65rem;
      border: 1px solid #e2e8f0;
      padding: 1.1rem 1.25rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

      .summary-top-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        margin-bottom: 1rem;

        .patient-main-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;

          .patient-avatar {
            font-size: 1.6rem;
            width: 2.8rem;
            height: 2.8rem;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
            border-radius: 9999px;
          }

          .patient-fullname {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 800;
            color: #0f172a;
          }

          .patient-sub-details {
            display: flex;
            align-items: center;
            gap: 0.4rem;
            font-size: 0.84rem;
            color: #64748b;
            margin-top: 0.2rem;
          }
        }

        .quick-metrics-grid {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;

          .metric-pill {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 0.5rem;
            padding: 0.45rem 0.75rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 90px;

            .m-lbl { font-size: 0.72rem; color: #64748b; font-weight: 600; }
            .m-val { font-size: 0.95rem; font-weight: 800; color: #0f172a; }
            .m-val.success { color: #16a34a; }

            &.danger-pill {
              background: #fff1f2;
              border-color: #fecdd3;
              .m-val { color: #dc2626; }
            }
          }
        }
      }

      .medical-alerts-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        padding-top: 0.85rem;
        border-top: 1px dashed #e2e8f0;

        @media (max-width: 768px) {
          grid-template-columns: 1fr;
        }

        .alert-box {
          background: #f8fafc;
          border-radius: 0.5rem;
          padding: 0.65rem 0.85rem;
          border: 1px solid #e2e8f0;
          font-size: 0.82rem;

          .alert-title {
            display: block;
            font-weight: 750;
            margin-bottom: 0.35rem;
          }

          &.allergy-alert {
            background: #fff1f2;
            border-color: #fecdd3;
            .alert-title { color: #9f1239; }
          }

          &.condition-alert {
            background: #fefce8;
            border-color: #fef08a;
            .alert-title { color: #854d0e; }
          }

          &.medication-alert {
            background: #f0f9ff;
            border-color: #bae6fd;
            .alert-title { color: #075985; }
          }

          .alert-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.3rem;

            .chip {
              padding: 0.15rem 0.45rem;
              border-radius: 0.35rem;
              font-size: 0.75rem;
              font-weight: 700;

              &.chip-danger { background: #fee2e2; color: #991b1b; }
              &.chip-warning { background: #fef3c7; color: #92400e; }
              &.chip-info { background: #e0f2fe; color: #0369a1; }
            }
          }

          .empty-txt {
            color: #94a3b8;
            font-style: italic;
          }
        }
      }
    }

    .sheet-loading-block {
      text-align: center;
      padding: 3rem 1rem;
      color: #64748b;

      .loading-spinner {
        width: 2.2rem;
        height: 2.2rem;
        border: 3px solid #e2e8f0;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 0.75rem;
      }
    }

    .visits-stream-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .visit-card-sheet {
      background: #ffffff;
      border-radius: 0.75rem;
      border: 1.5px solid #cbd5e1;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      page-break-inside: avoid;

      .visit-card-header {
        background: #f1f5f9;
        padding: 0.75rem 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1.5px solid #cbd5e1;
        gap: 1rem;
        flex-wrap: wrap;

        .visit-badge-order {
          display: flex;
          align-items: center;
          gap: 0.75rem;

          .order-num {
            background: #0f172a;
            color: #ffffff;
            font-weight: 800;
            font-size: 0.85rem;
            padding: 0.25rem 0.6rem;
            border-radius: 0.4rem;
          }

          .visit-datetime {
            h4 {
              margin: 0;
              font-size: 0.98rem;
              font-weight: 800;
              color: #0f172a;
            }
            .time-stamp {
              font-size: 0.8rem;
              color: #64748b;
            }
          }
        }

        .visit-meta-badges {
          display: flex;
          align-items: center;
          gap: 0.5rem;

          .doc-badge {
            background: #ffffff;
            border: 1px solid #cbd5e1;
            padding: 0.2rem 0.55rem;
            border-radius: 0.35rem;
            font-size: 0.8rem;
            font-weight: 700;
            color: #334155;
          }

          .type-badge {
            background: #e2e8f0;
            color: #334155;
            padding: 0.2rem 0.55rem;
            border-radius: 0.35rem;
            font-size: 0.8rem;
            font-weight: 600;
          }

          .status-badge {
            background: #fef3c7;
            color: #92400e;
            padding: 0.2rem 0.55rem;
            border-radius: 0.35rem;
            font-size: 0.8rem;
            font-weight: 700;

            &.status-completed {
              background: #dcfce7;
              color: #166534;
            }
          }
        }
      }

      .five-stages-wrapper {
        display: flex;
        flex-direction: column;

        .stage-section {
          padding: 0.85rem 1.25rem;
          border-bottom: 1px solid #f1f5f9;

          &:last-child {
            border-bottom: none;
          }

          .stage-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;

            .stage-badge {
              width: 1.35rem;
              height: 1.35rem;
              border-radius: 50%;
              background: #0284c7;
              color: #ffffff;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 0.72rem;
              font-weight: 800;
            }

            h5 {
              margin: 0;
              font-size: 0.88rem;
              font-weight: 800;
              color: #1e293b;
            }
          }

          &.stage-1 .stage-badge { background: #0284c7; }
          &.stage-2 .stage-badge { background: #8b5cf6; }
          &.stage-3 .stage-badge { background: #ea580c; }
          &.stage-4 .stage-badge { background: #16a34a; }
          &.stage-5 .stage-badge { background: #059669; }

          .stage-body {
            font-size: 0.85rem;
            color: #334155;

            .empty-stage-txt {
              margin: 0;
              color: #94a3b8;
              font-style: italic;
              font-size: 0.82rem;
            }

            .complaint-text {
              background: #f8fafc;
              border-radius: 0.4rem;
              padding: 0.5rem 0.75rem;
              border-inline-start: 3px solid #0284c7;

              strong { font-size: 0.8rem; color: #475569; display: block; margin-bottom: 0.2rem; }
              p { margin: 0; white-space: pre-wrap; color: #0f172a; line-height: 1.45; }
            }

            .findings-list {
              display: flex;
              flex-wrap: wrap;
              gap: 0.45rem;

              .finding-item {
                background: #f5f3ff;
                border: 1px solid #ddd6fe;
                padding: 0.3rem 0.6rem;
                border-radius: 0.4rem;
                display: flex;
                align-items: center;
                gap: 0.35rem;
                font-size: 0.8rem;

                .tooth-pill {
                  background: #7c3aed;
                  color: #ffffff;
                  font-weight: 800;
                  padding: 0.1rem 0.35rem;
                  border-radius: 0.25rem;
                  font-size: 0.72rem;
                }

                .finding-name { font-weight: 700; color: #5b21b6; }
                .finding-notes { color: #6d28d9; }

                &.endo-item {
                  background: #fdf2f8;
                  border-color: #fbcfe8;
                  .tooth-pill { background: #db2777; }
                  .finding-name { color: #9d174d; }
                  .endo-canals small {
                    background: #fce7f3;
                    padding: 0.1rem 0.3rem;
                    border-radius: 0.2rem;
                    margin-inline-start: 0.25rem;
                  }
                }
              }
            }

            .stage-mini-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.82rem;

              th {
                text-align: inherit;
                padding: 0.35rem 0.6rem;
                background: #f8fafc;
                color: #64748b;
                font-weight: 700;
                border-bottom: 1px solid #e2e8f0;
              }

              td {
                padding: 0.4rem 0.6rem;
                border-bottom: 1px solid #f1f5f9;
                color: #1e293b;
              }

              .tooth-tag {
                background: #ffedd5;
                color: #c2410c;
                font-weight: 750;
                padding: 0.15rem 0.45rem;
                border-radius: 0.25rem;
                font-size: 0.78rem;
              }

              .badge-mini-done {
                background: #dcfce7;
                color: #15803d;
                font-weight: 750;
                padding: 0.15rem 0.45rem;
                border-radius: 0.25rem;
                font-size: 0.75rem;
              }
            }

            .rx-block {
              background: #f0fdf4;
              border: 1px solid #bbf7d0;
              border-radius: 0.4rem;
              padding: 0.5rem 0.75rem;
              margin-bottom: 0.35rem;

              .rx-head {
                display: flex;
                justify-content: space-between;
                font-size: 0.78rem;
                color: #166534;
                font-weight: 750;
                margin-bottom: 0.3rem;
              }

              .rx-meds-list {
                margin: 0;
                padding-inline-start: 1.1rem;
                li {
                  margin-bottom: 0.2rem;
                  color: #14532d;
                  strong { color: #0f172a; }
                }
              }
            }

            .billing-summary-row {
              display: flex;
              align-items: center;
              gap: 1.5rem;
              flex-wrap: wrap;
              margin-bottom: 0.4rem;

              .bill-stat {
                display: flex;
                align-items: center;
                gap: 0.35rem;
                font-size: 0.84rem;

                .b-lbl { color: #64748b; }
                .b-val { font-size: 0.92rem; font-weight: 800; color: #0f172a; }
              }
            }

            .payments-mini-list {
              display: flex;
              flex-wrap: wrap;
              gap: 0.35rem;

              .payment-pill {
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                color: #065f46;
                padding: 0.15rem 0.45rem;
                border-radius: 0.25rem;
                font-size: 0.78rem;
                font-weight: 700;
              }
            }
          }
        }
      }
    }

    .empty-visits-hero {
      text-align: center;
      padding: 3.5rem 1rem;
      background: #ffffff;
      border-radius: 0.75rem;
      border: 1px dashed #cbd5e1;

      .empty-hero-icon {
        font-size: 2.5rem;
        margin-bottom: 0.6rem;
      }

      h3 {
        margin: 0 0 0.4rem;
        font-size: 1.1rem;
        font-weight: 800;
        color: #1e293b;
      }

      p {
        margin: 0;
        font-size: 0.86rem;
        color: #64748b;
      }
    }

    @media print {
      .no-print { display: none !important; }
      .sheet-backdrop {
        position: static !important;
        background: none !important;
        padding: 0 !important;
      }
      .sheet-modal-window {
        max-width: 100% !important;
        max-height: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
      }
      .sheet-document-body {
        padding: 0 !important;
        background: #ffffff !important;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class PatientVisitHistorySheetComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId!: string;
  @Output() close = new EventEmitter<void>();

  private readonly patientApi = inject(PatientApiService);
  private readonly appointmentApi = inject(AppointmentApiService);
  private readonly dentalApi = inject(DentalApiService);
  private readonly treatmentApi = inject(TreatmentApiService);
  private readonly rxApi = inject(PrescriptionApiService);
  private readonly financeApi = inject(FinanceApiService);
  readonly i18n = inject(LocalizationService);

  readonly patient = signal<PatientDetails | null>(null);
  readonly balance = signal<PatientBalance | null>(null);
  readonly visits = signal<VisitHistoryStageData[]>([]);
  readonly loading = signal(true);
  readonly now = new Date();

  ngOnInit() {
    if (this.patientId) {
      this.loadAllData();
    }
  }

  ngOnChanges() {
    if (this.patientId) {
      this.loadAllData();
    }
  }

  loadAllData() {
    this.loading.set(true);

    forkJoin({
      patient: this.patientApi.patient(this.patientId).pipe(catchError(() => of(null))),
      balance: this.financeApi.patientBalance(this.patientId).pipe(catchError(() => of(null))),
      appointmentsRes: this.appointmentApi
        .appointments({
          from: '2000-01-01',
          to: '2099-12-31',
        })
        .pipe(catchError(() => of({ page: { items: [], page: 1, pageSize: 250, totalCount: 0, totalPages: 1 }, timeZone: 'UTC' }))),
      treatmentsRes: this.treatmentApi.treatments({ patientId: this.patientId }).pipe(catchError(() => of({ items: [] }))),
      prescriptionsRes: this.rxApi.prescriptions({ patientId: this.patientId }).pipe(catchError(() => of({ items: [] }))),
      revenuesRes: this.financeApi.revenues({ patientId: this.patientId }).pipe(catchError(() => of({ items: [] }))),
      paymentsRes: this.financeApi.payments({ patientId: this.patientId }).pipe(catchError(() => of({ items: [] }))),
    }).subscribe({
      next: async (res) => {
        if (res.patient) {
          this.patient.set(res.patient);
        }
        if (res.balance) {
          this.balance.set(res.balance);
        }

        const patientAppointments = (res.appointmentsRes.page?.items || [])
          .filter((a) => a.patientId === this.patientId)
          .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

        const allTreatments = res.treatmentsRes?.items || [];
        const allPrescriptions = res.prescriptionsRes?.items || [];
        const allRevenues = res.revenuesRes?.items || [];
        const allPayments = res.paymentsRes?.items || [];

        // Build 5-stage records for each appointment
        const stageDataList: VisitHistoryStageData[] = [];

        for (const appt of patientAppointments) {
          // Fetch examination if available
          let exam: ExaminationDetails | null = null;
          try {
            exam = await new Promise((resolve) => {
              this.dentalApi.byAppointment(appt.id).subscribe({
                next: (e: ExaminationDetails) => resolve(e),
                error: () => resolve(null),
              });
            });
          } catch {
            exam = null;
          }

          const apptDateStr = new Date(appt.startAt).toISOString().split('T')[0];

          // Match treatments for this appointment by date
          const apptTreatments = allTreatments.filter((t) => {
            const tDateStr = new Date(t.completedAt || t.createdAt).toISOString().split('T')[0];
            return tDateStr === apptDateStr;
          });

          // Match prescriptions (by date)
          const apptPrescriptions = allPrescriptions.filter((rx) => {
            const rxDateStr = new Date(rx.issuedAt || rx.createdAt).toISOString().split('T')[0];
            return rxDateStr === apptDateStr;
          });

          // Match revenues & payments
          const apptRevenues = allRevenues.filter((r) => {
            const rDateStr = new Date(r.occurredAt).toISOString().split('T')[0];
            return rDateStr === apptDateStr;
          });

          const apptPayments = allPayments.filter((p) => {
            const pDateStr = new Date(p.paidAt || p.createdAt).toISOString().split('T')[0];
            return pDateStr === apptDateStr;
          });

          stageDataList.push({
            appointment: appt,
            examination: exam,
            treatments: apptTreatments,
            prescriptions: apptPrescriptions,
            revenues: apptRevenues,
            payments: apptPayments,
          });
        }

        this.visits.set(stageDataList);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  calculateVisitBilled(v: VisitHistoryStageData): number {
    if (v.treatments && v.treatments.length > 0) {
      return v.treatments.reduce((sum, t) => sum + (t.price || 0), 0);
    }
    if (v.revenues && v.revenues.length > 0) {
      return v.revenues.reduce((sum, r) => sum + (r.amount || 0), 0);
    }
    return 0;
  }

  calculateVisitPaid(v: VisitHistoryStageData): number {
    if (v.payments && v.payments.length > 0) {
      return v.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    }
    return 0;
  }

  totalCompletedTreatments(): number {
    return this.visits().reduce((sum, v) => sum + (v.treatments?.length || 0), 0);
  }

  findingName(type: number): string {
    const item = FINDING_APPEARANCE[type as keyof typeof FINDING_APPEARANCE];
    if (!item) return this.t('Finding', 'نتيجة فحص');
    return this.i18n.language() === 'ar' ? item.ar : item.en;
  }

  appointmentTypeLabel(type: number): string {
    switch (type) {
      case 1: return this.t('Consultation', 'استشارة');
      case 2: return this.t('Regular Checkup', 'فحص دوري');
      case 3: return this.t('Treatment / Procedure', 'علاج / إجراء');
      case 4: return this.t('Follow-up', 'متابعة');
      case 5: return this.t('Emergency', 'طوارئ');
      case 6: return this.t('Surgery', 'جراحة');
      default: return this.t('Visit', 'زيارة');
    }
  }

  appointmentStatusLabel(status: number): string {
    switch (status) {
      case 1: return this.t('Scheduled', 'مجدول');
      case 2: return this.t('Confirmed', 'مؤكد');
      case 3: return this.t('Checked In', 'حاضر بالعيادة');
      case 4: return this.t('In Progress', 'جاري الكشف');
      case 5: return this.t('Completed', 'مكتمل ومغلق');
      case 6: return this.t('Cancelled', 'ملغي');
      case 7: return this.t('No Show', 'لم يحضر');
      default: return '';
    }
  }

  paymentMethodLabel(method: number): string {
    switch (method) {
      case 1: return this.t('Cash', 'نقداً');
      case 2: return this.t('Credit Card', 'بطاقة ائتمان');
      case 3: return this.t('Bank Transfer', 'تحويل بنكي');
      case 4: return this.t('Insurance', 'تأمين');
      default: return this.t('Payment', 'دفع');
    }
  }

  genderLabel(gender?: number): string {
    if (gender === 1) return this.t('Male', 'ذكر');
    if (gender === 2) return this.t('Female', 'أنثى');
    return this.t('Other', 'غير محدد');
  }

  calculateAge(dob?: string): number {
    if (!dob) return 0;
    const diff = Date.now() - new Date(dob).getTime();
    return Math.abs(new Date(diff).getUTCFullYear() - 1970);
  }

  printSheet() {
    window.print();
  }

  t(en: string, ar: string): string {
    return this.i18n.language() === 'ar' ? ar : en;
  }
}