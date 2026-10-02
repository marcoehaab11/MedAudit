import { CommonModule, DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { DentalApiService, PatientDentalChart, ToothChartSummary } from '../dental/dental-api.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from '../dental/dental-appearance';
import { FinanceApiService, PatientBalance } from '../finance/finance-api.service';
import { money } from '../finance/finance-ui';
import { PrescriptionApiService, PrescriptionList } from '../prescriptions/prescription-api.service';
import { prescriptionStatus } from '../prescriptions/prescription-labels';
import { Treatment, TreatmentApiService, TreatmentPlanList } from '../treatments/treatment-api.service';
import { planStatus, treatmentStatus } from '../treatments/treatment-labels';
import { CrmApiService, PatientCrm } from '../crm/crm-api.service';
import { activityType } from '../crm/crm-labels';
import { PatientApiService, PatientDetails } from './patient-api.service';

@Component({
  selector: 'app-patient-dossier-modal',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="dossier-backdrop" (click)="close.emit()">
      <div class="dossier-modal-window" (click)="$event.stopPropagation()">
        <!-- Top Toolbar (Non-printable) -->
        <header class="dossier-toolbar no-print">
          <div class="toolbar-info">
            <span class="dossier-icon">📑</span>
            <div>
              <h3>{{ t('Comprehensive Patient Dossier & Medical Record', 'الملف الطبي الشامل للمريض') }}</h3>
              <p class="subtitle">{{ patient()?.firstName }} {{ patient()?.middleName || '' }} {{ patient()?.lastName }} ({{ patient()?.patientNumber }})</p>
            </div>
          </div>

          <div class="toolbar-actions">
            <button type="button" class="btn-tool btn-run" (click)="runReport()" [disabled]="loading()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-icon">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              <span>{{ loading() ? t('Compiling Data…', 'جارٍ تجميع البيانات…') : t('Run / Refresh Data', 'تشغيل وتحديث البيانات') }}</span>
            </button>

            <button type="button" class="btn-tool btn-print" (click)="printDocument()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="tool-icon">
                <polyline points="6 9 6 2 18 2 18 9"/>
                <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                <rect x="6" y="14" width="12" height="8"/>
              </svg>
              <span>{{ t('Download PDF / Print', 'تحميل PDF / طباعة') }}</span>
            </button>

            <button type="button" class="btn-close" (click)="close.emit()" [attr.aria-label]="t('Close', 'إغلاق')">✕</button>
          </div>
        </header>

        <!-- Printable Document Area -->
        <main class="dossier-document-body" id="patient-dossier-print">
          <!-- Document Header -->
          <section class="doc-header">
            <div class="clinic-brand-block">
              <div class="clinic-logo-emblem">🦷</div>
              <div>
                <h1 class="clinic-name">{{ tenantName() }}</h1>
                <p class="clinic-tagline">{{ t('Comprehensive Dental & Oral Healthcare Center', 'مركز طب وجراحة الفم والأسنان المتكامل') }}</p>
              </div>
            </div>

            <div class="doc-meta-block">
              <div class="meta-tag">{{ t('OFFICIAL MEDICAL DOSSIER', 'تقرير طبي شامل معتمد') }}</div>
              <div class="meta-row">
                <span class="meta-label">{{ t('Document Ref:', 'مرجع التقرير:') }}</span>
                <strong class="meta-val mono">MED-{{ patient()?.patientNumber }}-{{ generatedAt() | date: 'yyMMddHHmm' }}</strong>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ t('Generated On:', 'تاريخ الإصدار:') }}</span>
                <span class="meta-val">{{ generatedAt() | date: 'dd/MM/yyyy hh:mm a' }}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">{{ t('Status:', 'الحالة:') }}</span>
                <span class="meta-val badge-doc" [class.badge-active]="patient()?.status === 1">
                  {{ patient()?.status === 1 ? t('Active Patient', 'مريض نشط') : t('Archived', 'مؤرشف') }}
                </span>
              </div>
            </div>
          </section>

          <!-- Status / Loading Overlay inside doc -->
          @if (loading()) {
            <div class="doc-loading no-print">
              <div class="spinner"></div>
              <p>{{ t('Gathering patient records from all clinical modules…', 'جارٍ تجميع سجلات المريض من كافة الأقسام الطبية…') }}</p>
            </div>
          }

          <!-- SECTION 1: Patient Demographics -->
          <section class="doc-section">
            <div class="section-title-bar">
              <span class="sec-num">1</span>
              <h2>{{ t('Patient Demographics & Identification', 'بيانات المريض الأساسية والهوية') }}</h2>
            </div>

            <div class="info-grid-3">
              <div class="info-cell">
                <span class="lbl">{{ t('Full Name', 'الاسم الكامل') }}</span>
                <strong class="val highlight-name">{{ patient()?.firstName }} {{ patient()?.middleName || '' }} {{ patient()?.lastName }}</strong>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Patient Number', 'الرقم الطبي') }}</span>
                <strong class="val mono">{{ patient()?.patientNumber }}</strong>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Gender', 'النوع') }}</span>
                <span class="val">{{ genderText(patient()?.gender) }}</span>
              </div>

              <div class="info-cell">
                <span class="lbl">{{ t('Date of Birth', 'تاريخ الميلاد') }}</span>
                <span class="val">{{ (patient()?.dateOfBirth | date: 'dd/MM/yyyy') || '—' }} ({{ calculateAge(patient()?.dateOfBirth) }})</span>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Primary Phone', 'رقم الهاتف') }}</span>
                <strong class="val dir-ltr">{{ patient()?.phone || '—' }}</strong>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Alternative Phone', 'هاتف بديل') }}</span>
                <span class="val dir-ltr">{{ patient()?.alternatePhone || '—' }}</span>
              </div>

              <div class="info-cell">
                <span class="lbl">{{ t('Email Address', 'البريد الإلكتروني') }}</span>
                <span class="val">{{ patient()?.email || '—' }}</span>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Nationality', 'الجنسية') }}</span>
                <span class="val">{{ patient()?.nationality || '—' }}</span>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Occupation', 'المهنة') }}</span>
                <span class="val">{{ patient()?.occupation || '—' }}</span>
              </div>

              <div class="info-cell span-2">
                <span class="lbl">{{ t('Residential Address', 'العنوان السكني') }}</span>
                <span class="val">{{ formatAddress() }}</span>
              </div>
              <div class="info-cell">
                <span class="lbl">{{ t('Emergency Contact', 'جهة اتصال للطوارئ') }}</span>
                <span class="val">{{ patient()?.emergencyContactName || '—' }} <small *ngIf="patient()?.emergencyContactPhone">({{ patient()?.emergencyContactPhone }})</small></span>
              </div>
            </div>
          </section>

          <!-- SECTION 2: Medical History & Alerts -->
          <section class="doc-section">
            <div class="section-title-bar sec-medical">
              <span class="sec-num">2</span>
              <h2>{{ t('Medical History & Health Alerts', 'السجل الطبي والتحذيرات الصحية') }}</h2>
            </div>

            <div class="medical-dossier-grid">
              <!-- Allergies with high priority red tag -->
              <div class="med-block alert-block">
                <h3>⚠️ {{ t('Known Allergies & Sensitivities', 'الحساسية والتحسس الدوائي') }}</h3>
                <div class="tag-cloud">
                  @for (a of patient()?.allergies || []; track a.id) {
                    <span class="allergy-tag">⛔ {{ a.name }}</span>
                  } @empty {
                    <span class="empty-state-tag">✓ {{ t('No known allergies recorded', 'لا توجد حساسية مسجلة') }}</span>
                  }
                </div>
              </div>

              <!-- Medical Conditions -->
              <div class="med-block">
                <h3>📋 {{ t('Systemic & Chronic Conditions', 'الأمراض والحالات المزمنة') }}</h3>
                <div class="tag-cloud">
                  @for (c of patient()?.medicalConditions || []; track c.id) {
                    <span class="condition-tag">🔹 {{ c.name }}</span>
                  } @empty {
                    <span class="empty-state-tag">{{ t('No chronic conditions recorded', 'لا توجد أمراض مزمنة مسجلة') }}</span>
                  }
                </div>
              </div>

              <!-- Current Regular Medications -->
              <div class="med-block">
                <h3>💊 {{ t('Regular / Current Medications', 'الأدوية الحالية المستمرة') }}</h3>
                <ul class="clean-list">
                  @for (m of patient()?.medications || []; track m.id) {
                    <li>
                      <strong>{{ m.name }}</strong>
                      <span class="sub" *ngIf="m.dosage">({{ m.dosage }})</span>
                    </li>
                  } @empty {
                    <li class="empty-li">{{ t('No continuous medications listed', 'لا توجد أدوية منتظمة مسجلة') }}</li>
                  }
                </ul>
              </div>

              <!-- Previous Surgeries -->
              <div class="med-block">
                <h3>🏥 {{ t('Previous Surgeries & Hospitalizations', 'العمليات الجراحية السابقة') }}</h3>
                <ul class="clean-list">
                  @for (s of patient()?.surgeries || []; track s.id) {
                    <li>
                      <strong>{{ s.procedure }}</strong>
                      <span class="sub" *ngIf="s.procedureDate">({{ s.procedureDate | date: 'dd/MM/yyyy' }})</span>
                    </li>
                  } @empty {
                    <li class="empty-li">{{ t('No past surgeries recorded', 'لا توجد عمليات سابقة مسجلة') }}</li>
                  }
                </ul>
              </div>
            </div>

            <!-- Medical & Administrative Notes -->
            <div class="notes-dossier-box" *ngIf="patient()?.medicalNotes || patient()?.notes">
              <div class="note-col" *ngIf="patient()?.medicalNotes">
                <h4>🩺 {{ t('Confidential Clinical Notes', 'ملاحظات الطبيب السرية') }}</h4>
                <p>{{ patient()?.medicalNotes }}</p>
              </div>
              <div class="note-col" *ngIf="patient()?.notes">
                <h4>📝 {{ t('Administrative Notes', 'ملاحظات إدارية') }}</h4>
                <p>{{ patient()?.notes }}</p>
              </div>
            </div>
          </section>

          <!-- SECTION 3: Dental Chart & Odontogram Findings -->
          <section class="doc-section">
            <div class="section-title-bar">
              <span class="sec-num">3</span>
              <h2>{{ t('Dental Chart & Clinical Examinations', 'المخطط السني والفحوصات الإكلينيكية') }}</h2>
            </div>

            <div class="dental-dossier-layout">
              <div class="dental-stat-summary">
                <div class="stat-badge">
                  <strong class="stat-number">{{ affectedTeethCount() }}</strong>
                  <span class="stat-lbl">{{ t('Teeth with Clinical Records', 'أسنان مسجل بها إجراءات/ملاحظات') }}</span>
                </div>
                <div class="stat-badge">
                  <strong class="stat-number">{{ dentalChart()?.recentExaminations?.length || 0 }}</strong>
                  <span class="stat-lbl">{{ t('Documented Examinations', 'فحوصات إكلينيكية موثقة') }}</span>
                </div>
              </div>

              @if (recordedTeeth().length) {
                <div class="table-wrap">
                  <div class="table-responsive"><table class="dossier-table">
                    <thead>
                      <tr>
                        <th style="width: 15%;">{{ t('Tooth (FDI)', 'رقم السن') }}</th>
                        <th style="width: 40%;">{{ t('Findings / Diagnostics', 'التشخيص والملاحظات') }}</th>
                        <th style="width: 45%;">{{ t('Dental Procedures', 'الإجراءات المنفذة') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (tooth of recordedTeeth(); track tooth.toothNumber) {
                        <tr>
                          <td><span class="tooth-pill">#{{ tooth.toothNumber }}</span></td>
                          <td>
                            @for (f of tooth.findings; track f) {
                              <span class="mini-tag tag-finding">{{ findingName(f) }}</span>
                            } @empty {
                              <span class="dash">—</span>
                            }
                          </td>
                          <td>
                            @for (p of tooth.procedures; track p) {
                              <span class="mini-tag tag-proc">{{ procedureName(p) }}</span>
                            } @empty {
                              <span class="dash">—</span>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table></div>
                </div>
              } @else {
                <p class="empty-doc-hint">{{ t('No specific tooth-level pathology or odontogram findings recorded yet.', 'لا توجد ملاحظات سنية أو تشخيصات مسجلة على الأسنان حالياً.') }}</p>
              }

              <!-- Recent Examinations -->
              @if (dentalChart()?.recentExaminations?.length) {
                <div class="doc-sub-block">
                  <h4>{{ t('Clinical Examinations History', 'سجل الفحوصات الإكلينيكية') }}</h4>
                  <div class="table-responsive"><table class="dossier-table">
                    <thead>
                      <tr>
                        <th>{{ t('Date', 'التاريخ') }}</th>
                        <th>{{ t('Doctor', 'الطبيب الفاحص') }}</th>
                        <th>{{ t('Status', 'الحالة') }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (exam of dentalChart()!.recentExaminations; track exam.id) {
                        <tr>
                          <td>{{ exam.createdAt | date: 'dd/MM/yyyy' }}</td>
                          <td><strong>{{ exam.doctorName }}</strong></td>
                          <td>{{ exam.status === 2 ? t('Completed', 'مكتمل') : t('Draft', 'مسودة') }}</td>
                        </tr>
                      }
                    </tbody>
                  </table></div>
                </div>
              }
            </div>
          </section>

          <!-- SECTION 4: Treatment Plans & Procedures -->
          <section class="doc-section">
            <div class="section-title-bar">
              <span class="sec-num">4</span>
              <h2>{{ t('Treatment Plans & Performed Procedures', 'الخطط العلاجية والإجراءات المنفذة') }}</h2>
            </div>

            @if (treatmentPlans().length) {
              <div class="table-wrap">
                <div class="table-responsive"><table class="dossier-table">
                  <thead>
                    <tr>
                      <th>{{ t('Title / Plan', 'عنوان الخطة') }}</th>
                      <th>{{ t('Doctor', 'الطبيب') }}</th>
                      <th>{{ t('Status', 'الحالة') }}</th>
                      <th>{{ t('Date', 'التاريخ') }}</th>
                      <th class="text-end">{{ t('Total', 'الإجمالي') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (plan of treatmentPlans(); track plan.id) {
                      <tr>
                        <td><strong>{{ plan.title }}</strong></td>
                        <td>{{ plan.doctorName }}</td>
                        <td><span class="badge-status">{{ formatPlanStatus(plan.status) }}</span></td>
                        <td>{{ plan.createdAt | date: 'dd/MM/yyyy' }}</td>
                        <td class="text-end font-bold">{{ plan.total }}</td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              </div>
            } @else {
              <p class="empty-doc-hint">{{ t('No treatment plans recorded for this patient.', 'لا توجد خطط علاجية مسجلة بعد لهذا المريض.') }}</p>
            }

            <!-- Recent Treatments Log -->
            @if (treatments().length) {
              <div class="doc-sub-block">
                <h4>{{ t('Completed & In-Progress Treatments Log', 'سجل الإجراءات والعلاجات المنفذة') }}</h4>
                <div class="table-responsive"><table class="dossier-table">
                  <thead>
                    <tr>
                      <th>{{ t('Procedure', 'الإجراء') }}</th>
                      <th>{{ t('Teeth', 'الأسنان') }}</th>
                      <th>{{ t('Doctor', 'الطبيب') }}</th>
                      <th>{{ t('Status', 'الحالة') }}</th>
                      <th>{{ t('Date', 'تاريخ الإنشاء') }}</th>
                      <th class="text-end">{{ t('Price', 'السعر') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (tr of treatments(); track tr.id) {
                      <tr>
                        <td><strong>{{ tr.treatmentName }}</strong></td>
                        <td>{{ formatTeethList(tr.toothNumbers) }}</td>
                        <td>{{ tr.doctorName }}</td>
                        <td>{{ formatTreatmentStatus(tr.status) }}</td>
                        <td>{{ tr.createdAt | date: 'dd/MM/yyyy' }}</td>
                        <td class="text-end font-bold">{{ tr.price }}</td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              </div>
            }
          </section>

          <!-- SECTION 5: Prescriptions & Medications -->
          <section class="doc-section">
            <div class="section-title-bar">
              <span class="sec-num">5</span>
              <h2>{{ t('Prescriptions & Dispensed Medications', 'الوصفات والروشتات الطبية الصادرة') }}</h2>
            </div>

            @if (prescriptions().length) {
              <div class="table-wrap">
                <div class="table-responsive"><table class="dossier-table">
                  <thead>
                    <tr>
                      <th>{{ t('Rx #', 'رقم الروشتة') }}</th>
                      <th>{{ t('Issue Date', 'تاريخ الإصدار') }}</th>
                      <th>{{ t('Doctor', 'الطبيب المعالج') }}</th>
                      <th>{{ t('Status', 'الحالة') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (rx of prescriptions(); track rx.id) {
                      <tr>
                        <td><strong class="mono">{{ rx.prescriptionNumber }}</strong></td>
                        <td>{{ (rx.issuedAt || rx.createdAt) | date: 'dd/MM/yyyy' }}</td>
                        <td>{{ rx.doctorName }}</td>
                        <td><span class="badge-status">{{ formatRxStatus(rx.status) }}</span></td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              </div>
            } @else {
              <p class="empty-doc-hint">{{ t('No prescriptions issued for this patient.', 'لا توجد وصفات طبية مسجلة بعد لهذا المريض.') }}</p>
            }
          </section>

          <!-- SECTION 6: CRM & Patient Communication -->
          <section class="doc-section" *ngIf="crmData()?.recentActivities?.length || crmData()?.recentFollowUps?.length">
            <div class="section-title-bar">
              <span class="sec-num">6</span>
              <h2>{{ t('CRM Communications & Follow-ups', 'سجل التواصل والمتابعات') }}</h2>
            </div>

            <div class="crm-dossier-summary">
              @if (crmData()?.recentActivities?.length) {
                <div class="table-responsive"><table class="dossier-table">
                  <thead>
                    <tr>
                      <th>{{ t('Date', 'التاريخ') }}</th>
                      <th>{{ t('Type', 'النوع') }}</th>
                      <th>{{ t('Subject', 'الموضوع') }}</th>
                      <th>{{ t('Details / Notes', 'التفاصيل والملاحظات') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (act of crmData()!.recentActivities.slice(0, 5); track act.id) {
                      <tr>
                        <td>{{ act.occurredAt | date: 'dd/MM/yyyy' }}</td>
                        <td>{{ formatActivityType(act.type) }}</td>
                        <td><strong>{{ act.subject || '—' }}</strong></td>
                        <td>{{ act.notes || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table></div>
              }
            </div>
          </section>

          <!-- SECTION 7: Financial Summary & Account Balance -->
          <section class="doc-section">
            <div class="section-title-bar">
              <span class="sec-num">7</span>
              <h2>{{ t('Financial Account & Billing Summary', 'الملخص المالي وموقف الحساب') }}</h2>
            </div>

            <div class="financial-dossier-cards">
              <div class="fin-card">
                <span class="fin-lbl">{{ t('Total Billed Treatments', 'إجمالي قيمة العلاجات') }}</span>
                <strong class="fin-amount">{{ formatMoney(finance()?.totalRevenue || 0) }}</strong>
              </div>
              <div class="fin-card fin-paid">
                <span class="fin-lbl">{{ t('Total Payments Received', 'إجمالي المدفوعات') }}</span>
                <strong class="fin-amount">{{ formatMoney(finance()?.totalPaid || 0) }}</strong>
              </div>
              <div class="fin-card" [class.fin-due]="(finance()?.outstanding || 0) > 0">
                <span class="fin-lbl">{{ t('Outstanding Balance Due', 'المبلغ المتبقي المستحق') }}</span>
                <strong class="fin-amount">{{ formatMoney(finance()?.outstanding || 0) }}</strong>
              </div>
            </div>
          </section>

          <!-- Official Sign-off Footer -->
          <footer class="doc-footer">
            <div class="footer-declaration">
              <p>
                {{
                  t(
                    'This document is an official medical dossier generated from the clinic electronic medical records system. All clinical records and medical history documented herein are verified.',
                    'هذا المستند يمثل ملفاً طبياً شاملاً ومعتمداً تم استخراجه من السجلات الطبية الإلكترونية للعيادة، وجميع البيانات الطبية المذكورة أعلاه موثقة بالنظام.'
                  )
                }}
              </p>
            </div>

            <div class="footer-sign-grid">
              <div class="sign-box">
                <span class="sign-title">{{ t('Attending Doctor / Physician', 'الطبيب المعالج / المسؤول') }}</span>
                <div class="sign-line"></div>
                <small class="sign-sub">{{ t('Signature & License ID', 'التوقيع ورقم الترخيص') }}</small>
              </div>

              <div class="stamp-box">
                <span class="stamp-title">{{ t('Official Clinic Stamp', 'ختم المركز الطبي') }}</span>
                <div class="stamp-area"></div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  `,
  styleUrl: './patients.scss',
})
export class PatientDossierModalComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId!: string;
  @Output() close = new EventEmitter<void>();

  private readonly patientApi = inject(PatientApiService);
  private readonly dentalApi = inject(DentalApiService);
  private readonly treatmentApi = inject(TreatmentApiService);
  private readonly rxApi = inject(PrescriptionApiService);
  private readonly crmApi = inject(CrmApiService);
  private readonly financeApi = inject(FinanceApiService);
  private readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);

  readonly patient = signal<PatientDetails | null>(null);
  readonly dentalChart = signal<PatientDentalChart | null>(null);
  readonly treatmentPlans = signal<TreatmentPlanList[]>([]);
  readonly treatments = signal<Treatment[]>([]);
  readonly prescriptions = signal<PrescriptionList[]>([]);
  readonly crmData = signal<PatientCrm | null>(null);
  readonly finance = signal<PatientBalance | null>(null);

  readonly loading = signal(true);
  readonly generatedAt = signal<Date>(new Date());

  ngOnInit() {
    this.runReport();
  }

  ngOnChanges() {
    if (this.patientId) {
      this.runReport();
    }
  }

  runReport(): void {
    if (!this.patientId) return;
    this.loading.set(true);
    this.generatedAt.set(new Date());

    forkJoin({
      patient: this.patientApi.patient(this.patientId).pipe(catchError(() => of(null))),
      dental: this.dentalApi.chart(this.patientId).pipe(catchError(() => of(null))),
      plans: this.treatmentApi.plans({ patientId: this.patientId, pageSize: '50' }).pipe(catchError(() => of({ items: [] as TreatmentPlanList[], page: 1, pageSize: 50, totalCount: 0, totalPages: 1 }))),
      treatments: this.treatmentApi.treatments({ patientId: this.patientId, pageSize: '50' }).pipe(catchError(() => of({ items: [] as Treatment[], page: 1, pageSize: 50, totalCount: 0, totalPages: 1 }))),
      prescriptions: this.rxApi.prescriptions({ patientId: this.patientId, pageSize: '50' }).pipe(catchError(() => of({ items: [] as PrescriptionList[], page: 1, pageSize: 50, totalCount: 0, totalPages: 1 }))),
      crm: this.crmApi.patient(this.patientId).pipe(catchError(() => of(null))),
      finance: this.auth.hasPermission('Finance.View')
        ? this.financeApi.patientBalance(this.patientId).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: (res) => {
        if (res.patient) this.patient.set(res.patient);
        this.dentalChart.set(res.dental);
        this.treatmentPlans.set(res.plans.items ?? []);
        this.treatments.set(res.treatments.items ?? []);
        this.prescriptions.set(res.prescriptions.items ?? []);
        this.crmData.set(res.crm);
        this.finance.set(res.finance);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  printDocument(): void {
    window.print();
  }

  tenantName(): string {
    const saved = localStorage.getItem('display_name');
    return saved || (this.i18n.language() === 'ar' ? 'عيادة الأسنان المتطورة' : 'Advanced Dental Clinic');
  }

  findingName(code: number): string {
    const item = FINDING_APPEARANCE[code];
    return item ? (this.i18n.language() === 'ar' ? item.ar : item.en) : String(code);
  }

  procedureName(code: number): string {
    const item = PROCEDURE_APPEARANCE[code];
    return item ? (this.i18n.language() === 'ar' ? item.ar : item.en) : String(code);
  }

  formatTeethList(teeth?: number[]): string {
    if (!teeth || !teeth.length) return '—';
    return teeth.map((t) => '#' + t).join(', ');
  }

  affectedTeethCount(): number {
    return (
      this.dentalChart()?.teeth.filter(
        (x) => x.findings.length || x.procedures.length || x.hasEndodonticRecord,
      ).length ?? 0
    );
  }

  recordedTeeth(): ToothChartSummary[] {
    return (
      this.dentalChart()?.teeth.filter(
        (x) => x.findings.length || x.procedures.length || x.hasEndodonticRecord,
      ) ?? []
    );
  }

  calculateAge(dob?: string | null): string {
    if (!dob) return '—';
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return '—';
    const diffMs = Date.now() - birthDate.getTime();
    const ageDate = new Date(diffMs);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);
    return `${age} ${this.t('years', 'سنة')}`;
  }

  formatAddress(): string {
    const p = this.patient();
    if (!p) return '—';
    const parts = [p.address, p.city, p.country].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
  }

  formatMoney(val: number): string {
    return money(val, this.finance()?.currency || 'USD', this.i18n.language());
  }

  formatPlanStatus(s: number): string {
    return planStatus(s, this.i18n.language() === 'ar');
  }

  formatTreatmentStatus(s: number): string {
    return treatmentStatus(s, this.i18n.language() === 'ar');
  }

  formatRxStatus(s: number): string {
    return prescriptionStatus(s, this.i18n.language() === 'ar');
  }

  formatActivityType(t: number): string {
    return activityType(t, this.i18n.language() === 'ar');
  }

  genderText(g?: number): string {
    return g === 1
      ? this.t('Female', 'أنثى')
      : g === 2
        ? this.t('Male', 'ذكر')
        : g === 3
          ? this.t('Other', 'آخر')
          : this.t('Not specified', 'غير محدد');
  }

  t(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


