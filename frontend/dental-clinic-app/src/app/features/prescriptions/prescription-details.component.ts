import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { SettingsApiService, TenantSettings } from '../../core/settings-api.service';
import { DoctorApiService, DoctorDetails } from '../doctors/doctor-api.service';
import { Prescription, PrescriptionApiService } from './prescription-api.service';
import { medicationForm, prescriptionActions, prescriptionStatus } from './prescription-labels';

@Component({
  styleUrl: './prescriptions.scss',
  selector: 'app-prescription-details',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="prescription-details-container">
      @if (item()) {
        <a class="back-link no-print" [routerLink]="['/patients', item()!.patientId]">
          ← {{ t('Back to patient', 'العودة لملف المريض') }}
        </a>
      } @else {
        <a class="back-link no-print" routerLink="/prescriptions">
          ← {{ t('Back to prescriptions', 'العودة لقائمة الروشتات') }}
        </a>
      }

      @if (message()) {
        <div class="alert success no-print">{{ message() }}</div>
      }
      @if (error()) {
        <div class="alert error no-print">{{ error() }}</div>
      }

      @if (loading()) {
        <div class="state no-print">{{ t('Loading prescription…', 'جارٍ تحميل الوصفة الطبية…') }}</div>
      } @else if (item()) {
        <!-- Screen Actions Header -->
        <section class="page-head rx-screen-head no-print">
          <div>
            <p class="eyebrow">{{ status(item()!.status) }}</p>
            <h1>{{ item()!.prescriptionNumber }}</h1>
            <p class="head-sub">
              <strong>{{ item()!.patientName }}</strong> · {{ item()!.doctorName }} ·
              {{ item()!.issuedAt || item()!.createdAt | date: 'dd/MM/yyyy' }}
            </p>
          </div>
          <div class="head-actions">
            @if (item()!.status === 1 && auth.hasPermission('Prescriptions.Edit')) {
              <a class="button secondary" [routerLink]="['/prescriptions', id, 'edit']">
                ✏️ {{ t('Edit draft', 'تعديل المسودة') }}
              </a>
            }
            @for (a of actions(); track a) {
              <button
                type="button"
                class="button"
                [class.primary]="a === 'issue'"
                [class.danger]="a === 'cancel'"
                (click)="openConfirmModal(a)"
              >
                {{ a === 'issue' ? '✓ ' + t('Issue Prescription', 'إصدار الوصفة') : '✕ ' + t('Cancel', 'إلغاء') }}
              </button>
            }
            @if (item()!.issuedAt) {
              @if (auth.hasPermission('Prescriptions.Print')) {
                <button type="button" class="button primary" (click)="triggerPrint()">
                  🖨️ {{ t('Print Prescription', 'طباعة الروشتة') }}
                </button>
              }
              @if (auth.hasPermission('Prescriptions.Download')) {
                <button type="button" class="button secondary" (click)="document(false)">
                  📥 {{ t('Download PDF', 'تنزيل PDF') }}
                </button>
              }
            }
          </div>
        </section>

        <!-- ── Official Medical Prescription Sheet (Rendered for Screen & Print) ── -->
        <div class="official-rx-paper-wrap">
          <article class="prescription-official-sheet">
            <!-- 1. Top Clinic & Doctor Header -->
            <header class="rx-header">
              <div class="rx-clinic-branding">
                <div class="rx-logo-icon">🦷</div>
                <div class="rx-clinic-info">
                  <h2 class="rx-clinic-name">{{ clinic()?.arabicName || clinic()?.clinicName || 'Dental Clinic' }}</h2>
                  @if (clinic()?.arabicName && clinic()?.clinicName) {
                    <span class="rx-clinic-name-en">{{ clinic()?.clinicName }}</span>
                  }
                  <p class="rx-clinic-meta">
                    <span>📍 {{ clinic()?.address || 'Clinic Address' }}{{ clinic()?.city ? ', ' + clinic()?.city : '' }}</span>
                    <span>📞 {{ clinic()?.phone || 'Phone' }}</span>
                    @if (clinic()?.email) {
                      <span>✉️ {{ clinic()?.email }}</span>
                    }
                  </p>
                </div>
              </div>

              <div class="rx-doctor-branding">
                <p class="dr-title">{{ t('Attending Physician', 'الطبيب المعالج') }}</p>
                <h3 class="dr-name">Dr. {{ item()!.doctorName }}</h3>
                <p class="dr-spec">{{ doctor()?.specialization || t('Specialist Dental Surgeon', 'أخصائي جراحة وطب الأسنان') }}</p>
                @if (doctor()?.licenseNumber) {
                  <p class="dr-license">{{ t('License No.', 'رقم الترخيص') }}: <strong>{{ doctor()?.licenseNumber }}</strong></p>
                }
              </div>
            </header>

            <div class="rx-header-divider"></div>

            <!-- 2. Patient & Prescription Meta Bar -->
            <section class="rx-patient-bar">
              <div class="rx-patient-col">
                <span class="meta-label">{{ t('Patient Name', 'اسم المريض') }}:</span>
                <strong class="meta-val patient-name-val">{{ item()!.patientName }}</strong>
              </div>
              <div class="rx-meta-col">
                <span class="meta-label">{{ t('Date', 'التاريخ') }}:</span>
                <span class="meta-val">{{ (item()!.issuedAt || item()!.createdAt) | date: 'dd/MM/yyyy hh:mm a' }}</span>
              </div>
              <div class="rx-meta-col">
                <span class="meta-label">{{ t('Rx Number', 'رقم الروشتة') }}:</span>
                <strong class="meta-val rx-num-highlight">{{ item()!.prescriptionNumber }}</strong>
              </div>
              <div class="rx-meta-col no-print">
                <span class="meta-label">{{ t('Status', 'الحالة') }}:</span>
                <span class="rx-status-tag status-{{ item()!.status }}">{{ status(item()!.status) }}</span>
              </div>
            </section>

            <!-- 3. Medications Rx Table Section -->
            <section class="rx-medications-section">
              <div class="rx-symbol-bar">
                <span class="rx-symbol">℞</span>
                <span class="rx-title-text">{{ t('Prescribed Medications & Treatment Regimen', 'الأدوية الموصوفة والجرعات العلاجية') }}</span>
              </div>

              <div class="table-responsive"><table class="rx-items-table">
                <thead>
                  <tr>
                    <th class="col-num">#</th>
                    <th class="col-med">{{ t('Medication & Strength', 'الدواء والتركيز') }}</th>
                    <th class="col-dose">{{ t('Dose', 'الجرعة') }}</th>
                    <th class="col-freq">{{ t('Frequency', 'التكرار') }}</th>
                    <th class="col-dur">{{ t('Duration', 'المدة') }}</th>
                    <th class="col-inst">{{ t('Instructions & Precautions', 'تعليمات الاستخدام') }}</th>
                    <th class="col-qty">{{ t('Qty', 'الكمية') }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (x of item()!.items; track x.id; let idx = $index) {
                    <tr>
                      <td class="col-num"><span class="rx-item-idx">{{ idx + 1 }}</span></td>
                      <td class="col-med">
                        <strong class="med-name">{{ x.medicationName }}</strong>
                        @if (x.strength) {
                          <span class="med-strength">{{ x.strength }}</span>
                        }
                        @if (x.form) {
                          <span class="med-form-pill">{{ formLabel(x.form) }}</span>
                        }
                        @if (x.genericName) {
                          <small class="med-generic">({{ x.genericName }})</small>
                        }
                      </td>
                      <td class="col-dose"><strong>{{ x.dose }}</strong></td>
                      <td class="col-freq">{{ x.frequency }}</td>
                      <td class="col-dur">{{ x.duration }}</td>
                      <td class="col-inst">
                        <span class="inst-text">{{ x.instructions }}</span>
                        @if (x.route) {
                          <small class="route-tag">[{{ x.route }}]</small>
                        }
                      </td>
                      <td class="col-qty">{{ x.quantity ? x.quantity : '—' }}</td>
                    </tr>
                  }
                </tbody>
              </table></div>
            </section>

            <!-- 4. Notes & Clinical Instructions -->
            @if (item()!.notes) {
              <section class="rx-notes-section">
                <h4>📝 {{ t('Doctor Advice & Instructions', 'ملاحظات وإرشادات الطبيب للمريض') }}</h4>
                <p class="rx-notes-content">{{ item()!.notes }}</p>
              </section>
            }

            <!-- 5. Footer: Verification QR & Doctor Signature -->
            <footer class="rx-footer">
              <div class="rx-verification-block">
                @if (qrData()) {
                  <div class="qr-box">
                    <img [src]="qrData()" [alt]="t('Secure QR', 'رمز QR')" />
                  </div>
                }
                <div class="qr-info">
                  <span class="qr-title">🔒 {{ t('Official Verified Prescription', 'روشتة طبية معتمدة وموثقة') }}</span>
                  <small>{{ t('Scan QR code to securely verify prescription authenticity.', 'امسح رمز الاستجابة السريعة للتحقق الرقمي من صحة ومطابقة الروشتة.') }}</small>
                </div>
              </div>

              <div class="rx-signature-block">
                <p class="sig-title">{{ t('Doctor Signature & Stamp', 'توقيع وختم الطبيب') }}</p>
                <div class="sig-line"></div>
                <p class="sig-doctor-name">Dr. {{ item()!.doctorName }}</p>
              </div>
            </footer>
          </article>
        </div>
      }

      <!-- ── Modern Confirmation Action Modal ── -->
      @if (confirmModal()) {
        <div class="modal-backdrop" (click)="closeConfirmModal()">
          <div class="modal-card action-confirm-dialog" (click)="$event.stopPropagation()">
            <div class="dialog-icon-wrap" [class.danger]="confirmModal()!.isDanger" [class.primary]="!confirmModal()!.isDanger">
              <span>{{ confirmModal()!.isDanger ? '⚠️' : '💊' }}</span>
            </div>

            <div class="dialog-content">
              <h3>{{ confirmModal()!.title }}</h3>
              <p>{{ confirmModal()!.message }}</p>
            </div>

            <div class="dialog-actions">
              <button type="button" class="btn btn-secondary" (click)="closeConfirmModal()">
                {{ t('Go back / Cancel', 'تراجع / إلغاء') }}
              </button>
              <button
                type="button"
                class="btn"
                [class.btn-primary]="!confirmModal()!.isDanger"
                [class.btn-danger]="confirmModal()!.isDanger"
                [disabled]="processing()"
                (click)="executeAction()"
              >
                {{ processing() ? t('Processing…', 'جارٍ التنفيذ…') : confirmModal()!.confirmLabel }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PrescriptionDetailsComponent {
  private readonly api = inject(PrescriptionApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly doctorApi = inject(DoctorApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;

  readonly item = signal<Prescription | null>(null);
  readonly clinic = signal<TenantSettings | null>(null);
  readonly doctor = signal<DoctorDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal(history.state.message ?? '');
  readonly qrData = signal('');
  readonly processing = signal(false);

  readonly confirmModal = signal<{
    type: 'issue' | 'cancel';
    title: string;
    message: string;
    confirmLabel: string;
    isDanger: boolean;
  } | null>(null);

  constructor() {
    this.load();
    this.loadClinic();
  }

  load() {
    this.api.prescription(this.id).subscribe({
      next: (x) => {
        this.item.set(x);
        this.loading.set(false);
        if (x.doctorProfileId) {
          this.loadDoctor(x.doctorProfileId);
        }
        if (x.issuedAt) {
          this.api
            .qr(this.id)
            .subscribe((svg) => this.qrData.set(`data:image/svg+xml;base64,${btoa(svg)}`));
        }
      },
      error: () => {
        this.error.set(
          this.t('Prescription not found or access denied.', 'الوصفة غير موجودة أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }

  loadClinic() {
    this.settingsApi.getSettings().subscribe({
      next: (settings) => this.clinic.set(settings),
      error: () => {},
    });
  }

  loadDoctor(doctorProfileId: string) {
    this.doctorApi.doctor(doctorProfileId).subscribe({
      next: (d) => this.doctor.set(d),
      error: () => {},
    });
  }

  actions() {
    return prescriptionActions(this.item()?.status ?? 0).filter((x) =>
      this.auth.hasPermission(x === 'issue' ? 'Prescriptions.Issue' : 'Prescriptions.Cancel'),
    );
  }

  openConfirmModal(value: string) {
    if (value === 'issue') {
      this.confirmModal.set({
        type: 'issue',
        title: this.t('Issue Prescription?', 'هل تريد اعتماد وإصدار هذه الوصفة الطبية؟'),
        message: this.t(
          'Once issued, this prescription becomes an immutable official medical document with an active verification QR code ready for patient dispensing.',
          'بمجرد الإصدار، ستتحول هذه الوصفة إلى مستند طبي رسمي معتمد غير قابل للتعديل ومزود برمز QR للتحقق والصرف الفوري.',
        ),
        confirmLabel: this.t('Yes, Issue Prescription', 'نعم، إصدار الوصفة الطبية'),
        isDanger: false,
      });
    } else if (value === 'cancel') {
      this.confirmModal.set({
        type: 'cancel',
        title: this.t('Cancel Prescription?', 'هل أنت متأكد من إلغاء هذه الوصفة الطبية؟'),
        message: this.t(
          'This action will void the prescription and mark it as cancelled in the patient clinical record.',
          'سيؤدي هذا الإجراء إلى إبطال الوصفة الطبية وتحديدها كملغاة في السجل السريري للمريض.',
        ),
        confirmLabel: this.t('Yes, Cancel Prescription', 'نعم، إلغاء الوصفة الطبية'),
        isDanger: true,
      });
    }
  }

  closeConfirmModal() {
    this.confirmModal.set(null);
  }

  executeAction() {
    const modal = this.confirmModal();
    if (!modal || !this.item()) return;
    this.processing.set(true);

    this.api.action(this.id, modal.type, this.item()!.version).subscribe({
      next: () => {
        this.processing.set(false);
        this.closeConfirmModal();
        this.message.set(
          modal.type === 'issue'
            ? this.t('Prescription issued successfully.', 'تم إصدار الوصفة الطبية وتوثيقها بنجاح.')
            : this.t('Prescription cancelled.', 'تم إلغاء الوصفة الطبية.'),
        );
        this.load();
      },
      error: (e) => {
        this.processing.set(false);
        this.closeConfirmModal();
        this.error.set(
          e.status === 409
            ? this.t('The prescription changed or is no longer editable.', 'تغيرت الوصفة أو لم تعد قابلة للتعديل.')
            : this.t('Operation failed. Please try again.', 'فشلت العملية. يرجى المحاولة مرة أخرى.'),
        );
      },
    });
  }

  triggerPrint() {
    window.print();
  }

  document(print: boolean) {
    if (print) {
      window.print();
      return;
    }
    this.api.document(this.id, false).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.item()!.prescriptionNumber}.pdf`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      },
      error: () => {
        // Fallback: trigger print dialog to save as PDF
        window.print();
      },
    });
  }

  status(x: number) {
    return prescriptionStatus(x, this.i18n.language() === 'ar');
  }

  formLabel(x?: number) {
    return medicationForm(x, this.i18n.language() === 'ar');
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


