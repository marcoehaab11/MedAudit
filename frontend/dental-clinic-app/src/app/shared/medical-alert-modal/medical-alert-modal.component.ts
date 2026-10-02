import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-medical-alert-modal',
  standalone: true,
  template: `
    <div class="modal-overlay alert-modal-overlay" (click)="close.emit()">
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
          <button type="button" class="close-alert-btn" (click)="close.emit()">&times;</button>
        </div>

        <div class="patient-banner-mini">
          <div class="p-info">
            @if (patientNumber) {
              <span class="p-code">{{ patientNumber }}</span>
            }
            <strong class="p-name">👤 {{ patientName }}</strong>
          </div>
          <div class="p-meta">
            @if (gender !== undefined && gender !== null) {
              <span>{{ gender === 1 ? t('Female', 'أنثى') : gender === 2 ? t('Male', 'ذكر') : '' }}</span>
            }
            @if (phone) {
              <span>📞 {{ phone }}</span>
            }
          </div>
        </div>

        <div class="alert-modal-body">
          @if (allergies.length > 0) {
            <div class="modal-alert-card allergies">
              <div class="card-head">
                <div class="card-title">
                  <span class="icon">⚠️</span>
                  <strong>{{ t('Allergies & Sensitivities', 'الحساسية والمحاذير') }}</strong>
                </div>
                <span class="badge-count">{{ allergies.length }}</span>
              </div>
              <div class="tags-container">
                @for (item of allergies; track item) {
                  <span class="popup-tag danger">
                    <span class="tag-icon">⚠️</span>
                    <span class="tag-label">{{ item }}</span>
                  </span>
                }
              </div>
            </div>
          }

          @if (conditions.length > 0) {
            <div class="modal-alert-card conditions">
              <div class="card-head">
                <div class="card-title">
                  <span class="icon">🩺</span>
                  <strong>{{ t('Chronic Medical Conditions', 'الأمراض والحالات المزمنة') }}</strong>
                </div>
                <span class="badge-count">{{ conditions.length }}</span>
              </div>
              <div class="tags-container">
                @for (item of conditions; track item) {
                  <span class="popup-tag warning">
                    <span class="tag-icon">🩺</span>
                    <span class="tag-label">{{ item }}</span>
                  </span>
                }
              </div>
            </div>
          }

          @if (medications.length > 0) {
            <div class="modal-alert-card medications">
              <div class="card-head">
                <div class="card-title">
                  <span class="icon">💊</span>
                  <strong>{{ t('Current Patient Medications', 'الأدوية والعلاجات الحالية') }}</strong>
                </div>
                <span class="badge-count">{{ medications.length }}</span>
              </div>
              <div class="tags-container">
                @for (item of medications; track item) {
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
          <button type="button" class="btn-confirm-alert" (click)="close.emit()">
            <span>✓ {{ t('I Understand & Acknowledge — Continue', 'تم الاطلاع وتأكيد الحذر — متابعة') }}</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay.alert-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(6px);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      animation: modalFadeIn 0.2s ease-out;
    }

    .modal-content.medical-alert-modal {
      background: #ffffff;
      border-radius: 18px;
      width: 100%;
      max-width: 620px;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 45px rgba(225, 29, 72, 0.22), 0 8px 24px rgba(0, 0, 0, 0.18);
      border: 2px solid #fecdd3;
      display: flex;
      flex-direction: column;
      animation: modalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);

      .alert-modal-head {
        display: flex;
        align-items: flex-start;
        gap: 0.85rem;
        padding: 1.25rem 1.35rem 1rem;
        background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
        border-bottom: 1.5px solid #fecdd3;
        position: relative;

        .head-badge {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e11d48;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.35rem;
          box-shadow: 0 4px 12px rgba(225, 29, 72, 0.35);
          flex-shrink: 0;

          .pulse-icon {
            animation: alertPulse 1.2s infinite ease-in-out;
          }
        }

        .head-titles {
          flex: 1;

          .head-main-title {
            margin: 0 0 0.25rem;
            font-size: 1.15rem;
            font-weight: 900;
            color: #9f1239;
            letter-spacing: -0.3px;
          }

          .head-sub-title {
            margin: 0;
            font-size: 0.82rem;
            font-weight: 600;
            color: #be123c;
            line-height: 1.4;
          }
        }

        .close-alert-btn {
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid #fecdd3;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          font-size: 1.25rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #9f1239;
          transition: all 0.15s ease;

          &:hover {
            background: #f43f5e;
            color: #ffffff;
            border-color: #f43f5e;
            transform: rotate(90deg);
          }
        }
      }

      .patient-banner-mini {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.65rem 1.35rem;
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-size: 0.86rem;
        flex-wrap: wrap;

        .p-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;

          .p-code {
            background: #e2e8f0;
            color: #475569;
            font-size: 0.75rem;
            font-weight: 750;
            padding: 0.15rem 0.45rem;
            border-radius: 6px;
          }

          .p-name {
            color: #0f172a;
            font-weight: 800;
          }
        }

        .p-meta {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          color: #64748b;
          font-size: 0.8rem;
          font-weight: 600;
        }
      }

      .alert-modal-body {
        padding: 1.25rem 1.35rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;

        .modal-alert-card {
          border-radius: 12px;
          padding: 0.95rem 1.15rem;
          border: 1.5px solid;

          &.allergies {
            background: #fff5f5;
            border-color: #fca5a5;

            .card-head {
              color: #991b1b;
              .badge-count { background: #fee2e2; color: #b91c1c; }
            }
          }

          &.conditions {
            background: #fffbeb;
            border-color: #fde68a;

            .card-head {
              color: #92400e;
              .badge-count { background: #fef3c7; color: #b45309; }
            }
          }

          &.medications {
            background: #f0f9ff;
            border-color: #bae6fd;

            .card-head {
              color: #075985;
              .badge-count { background: #e0f2fe; color: #0284c7; }
            }
          }

          .card-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 0.65rem;

            .card-title {
              display: flex;
              align-items: center;
              gap: 0.45rem;
              font-size: 0.92rem;
              font-weight: 800;

              .icon { font-size: 1.1rem; }
            }

            .badge-count {
              font-size: 0.74rem;
              font-weight: 800;
              padding: 0.15rem 0.5rem;
              border-radius: 999px;
            }
          }

          .tags-container {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;

            .popup-tag {
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
              padding: 0.3rem 0.75rem;
              border-radius: 9999px;
              font-size: 0.84rem;
              font-weight: 750;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);

              &.danger {
                background: #fef2f2;
                color: #b91c1c;
                border: 1.5px solid #f87171;
              }

              &.warning {
                background: #fffbeb;
                color: #92400e;
                border: 1.5px solid #f59e0b;
              }

              &.info {
                background: #f0f9ff;
                color: #0369a1;
                border: 1.5px solid #38bdf8;
              }

              .tag-icon { font-size: 0.85rem; }
            }
          }
        }

        .alert-safety-notice {
          display: flex;
          align-items: flex-start;
          gap: 0.65rem;
          padding: 0.85rem 1rem;
          background: #fef2f2;
          border: 1.5px dashed #f87171;
          border-radius: 10px;

          .notice-icon {
            font-size: 1.15rem;
            color: #dc2626;
            flex-shrink: 0;
            margin-top: 0.1rem;
          }

          p {
            margin: 0;
            font-size: 0.82rem;
            font-weight: 700;
            color: #991b1b;
            line-height: 1.45;
          }
        }
      }

      .alert-modal-actions {
        padding: 1rem 1.35rem 1.25rem;
        border-top: 1px solid #f1f5f9;
        background: #fafafa;
        display: flex;
        justify-content: stretch;

        .btn-confirm-alert {
          width: 100%;
          height: 44px;
          background: linear-gradient(135deg, #e11d48 0%, #be123c 100%);
          color: #ffffff;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          box-shadow: 0 4px 14px rgba(225, 29, 72, 0.35);
          transition: all 0.18s ease;

          &:hover {
            background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
            transform: translateY(-1px);
            box-shadow: 0 6px 18px rgba(225, 29, 72, 0.45);
          }

          &:active {
            transform: translateY(0);
          }
        }
      }
    }

    @keyframes alertPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.18); }
    }

    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes modalSlideUp {
      from {
        opacity: 0;
        transform: translateY(20px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }
  `]
})
export class MedicalAlertModalComponent {
  private readonly i18n = inject(LocalizationService);

  @Input({ required: true }) patientName!: string;
  @Input() patientNumber = '';
  @Input() gender?: number;
  @Input() phone?: string;
  @Input() allergies: string[] = [];
  @Input() conditions: string[] = [];
  @Input() medications: string[] = [];

  @Output() close = new EventEmitter<void>();

  t(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
