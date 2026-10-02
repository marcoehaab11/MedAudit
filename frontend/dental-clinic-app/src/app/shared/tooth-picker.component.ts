import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { LocalizationService } from '../core/localization.service';

@Component({
  selector: 'app-tooth-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="tooth-picker-container">
      <!-- Trigger Bar -->
      <div class="picker-trigger-row">
        <button
          type="button"
          class="btn-open-chart"
          [class.has-selection]="selectedTeeth.length > 0"
          (click)="openModal()"
        >
          <span class="btn-icon">🦷</span>
          <span class="btn-text">
            @if (selectedTeeth.length === 0) {
              {{ t('Select Teeth from Dental Chart…', 'اختر السن أو الأسنان من مخطط الأسنان…') }}
            } @else if (selectedTeeth.length === 1) {
              {{ t('Tooth #' + selectedTeeth[0] + ' Selected', 'تم تحديد السن #' + selectedTeeth[0]) }}
            } @else {
              {{ t(selectedTeeth.length + ' Teeth Selected: [' + selectedTeeth.join(', ') + ']', 'تم تحديد ' + selectedTeeth.length + ' أسنان: [' + selectedTeeth.join(', ') + ']') }}
            }
          </span>
          <span class="btn-chevron">⛶</span>
        </button>

        @if (selectedTeeth.length > 0) {
          <button type="button" class="btn-clear-teeth" (click)="clearAll()" [title]="t('Clear all', 'مسح الكل')">
            ✕ {{ t('Clear', 'مسح') }}
          </button>
        }
      </div>

      <!-- Selected Teeth Chips Preview -->
      @if (selectedTeeth.length > 0) {
        <div class="selected-teeth-chips-wrap">
          <span class="chips-label">{{ t('Targeted Teeth:', 'الأسنان المستهدفة:') }}</span>
          <div class="chips-list">
            @for (tooth of selectedTeeth; track tooth) {
              <span class="tooth-chip">
                <span class="chip-num">#{{ tooth }}</span>
                <span class="chip-name">{{ getToothName(tooth) }}</span>
                <button type="button" class="chip-remove" (click)="removeTooth(tooth)" [title]="t('Remove', 'حذف')">✕</button>
              </span>
            }
          </div>
        </div>
      }

      <!-- Interactive Dental Chart Modal -->
      @if (isOpen()) {
        <div class="chart-modal-backdrop" (click)="closeModal()">
          <div class="chart-modal-dialog" (click)="$event.stopPropagation()">
            <!-- Header -->
            <div class="dialog-header">
              <div class="dialog-title-wrap">
                <span class="dialog-icon">🦷</span>
                <div>
                  <h3>{{ t('Interactive Dental Chart Selector', 'مخطط الأسنان التفاعلي - اختيار الأسنان') }}</h3>
                  <p class="dialog-subtitle">
                    {{ t('Click on one or multiple teeth (FDI notation) to include in the treatment plan.', 'انقر على سن واحد أو عدة أسنان (ترقيم FDI) لتضمينها في خطة العلاج.') }}
                  </p>
                </div>
              </div>
              <button type="button" class="btn-close-dialog" (click)="closeModal()" aria-label="Close">✕</button>
            </div>

            <!-- Quick Action Toolbar -->
            <div class="dialog-toolbar">
              <div class="quick-preset-btns">
                <button type="button" class="btn-quick" (click)="selectUpperJaw()">
                  {{ t('Upper Arch (18-28)', 'الفك العلوي (18-28)') }}
                </button>
                <button type="button" class="btn-quick" (click)="selectLowerJaw()">
                  {{ t('Lower Arch (48-38)', 'الفك السفلي (48-38)') }}
                </button>
                <button type="button" class="btn-quick" (click)="selectAnterior()">
                  {{ t('Anterior / Smile', 'الأسنان الأمامية') }}
                </button>
              </div>

              @if (tempSelection().length > 0) {
                <button type="button" class="btn-quick-clear" (click)="tempSelection.set([])">
                  ✕ {{ t('Clear Selection', 'إلغاء التحديد') }}
                </button>
              }
            </div>

            <!-- Visual Dental Arch Grid -->
            <div class="dental-chart-board">
              <!-- UPPER JAW -->
              <div class="jaw-section upper-jaw">
                <div class="jaw-label">
                  <span>{{ t('Upper Right (Quadrant 1)', 'علوي يمين (الربع 1)') }}</span>
                  <span class="jaw-title-pill">{{ t('MAXILLARY / UPPER JAW', 'الفك العلوي') }}</span>
                  <span>{{ t('Upper Left (Quadrant 2)', 'علوي يسار (الربع 2)') }}</span>
                </div>

                <div class="arch-teeth-row">
                  <!-- Quad 1 (18 down to 11) -->
                  <div class="quadrant-group quad-1">
                    <span class="quadrant-badge">Q1 · {{ t('Upper right', 'علوي يمين') }}</span>
                    @for (num of upperRight; track num) {
                      <button
                        type="button"
                        class="tooth-cell"
                        [class.is-selected]="isToothSelected(num)"
                        (click)="toggleTooth(num)"
                      >
                        <span [class]="'tooth-crown upper type-' + getToothType(num)"></span>
                        <strong class="tooth-number">{{ num }}</strong>
                        <span class="tooth-type-hint">{{ getToothShortLabel(num) }}</span>
                        @if (isToothSelected(num)) {
                          <span class="tooth-check">✓</span>
                        }
                      </button>
                    }
                  </div>

                  <div class="quadrant-divider-vertical"></div>

                  <!-- Quad 2 (21 to 28) -->
                  <div class="quadrant-group quad-2">
                    <span class="quadrant-badge">Q2 · {{ t('Upper left', 'علوي يسار') }}</span>
                    @for (num of upperLeft; track num) {
                      <button
                        type="button"
                        class="tooth-cell"
                        [class.is-selected]="isToothSelected(num)"
                        (click)="toggleTooth(num)"
                      >
                        <span [class]="'tooth-crown upper type-' + getToothType(num)"></span>
                        <strong class="tooth-number">{{ num }}</strong>
                        <span class="tooth-type-hint">{{ getToothShortLabel(num) }}</span>
                        @if (isToothSelected(num)) {
                          <span class="tooth-check">✓</span>
                        }
                      </button>
                    }
                  </div>
                </div>
              </div>

              <!-- ARCH DIVIDER LINE -->
              <div class="midline-divider">
                <span class="mid-line-text">{{ t('Occlusal Plane / Midline', 'مستوى الإطباق / خط الوسط') }}</span>
              </div>

              <!-- LOWER JAW -->
              <div class="jaw-section lower-jaw">
                <div class="arch-teeth-row">
                  <!-- Quad 4 (48 down to 41) -->
                  <div class="quadrant-group quad-4">
                    <span class="quadrant-badge">Q4 · {{ t('Lower right', 'سفلي يمين') }}</span>
                    @for (num of lowerRight; track num) {
                      <button
                        type="button"
                        class="tooth-cell"
                        [class.is-selected]="isToothSelected(num)"
                        (click)="toggleTooth(num)"
                      >
                        <span [class]="'tooth-crown lower type-' + getToothType(num)"></span>
                        <strong class="tooth-number">{{ num }}</strong>
                        <span class="tooth-type-hint">{{ getToothShortLabel(num) }}</span>
                        @if (isToothSelected(num)) {
                          <span class="tooth-check">✓</span>
                        }
                      </button>
                    }
                  </div>

                  <div class="quadrant-divider-vertical"></div>

                  <!-- Quad 3 (31 to 38) -->
                  <div class="quadrant-group quad-3">
                    <span class="quadrant-badge">Q3 · {{ t('Lower left', 'سفلي يسار') }}</span>
                    @for (num of lowerLeft; track num) {
                      <button
                        type="button"
                        class="tooth-cell"
                        [class.is-selected]="isToothSelected(num)"
                        (click)="toggleTooth(num)"
                      >
                        <span [class]="'tooth-crown lower type-' + getToothType(num)"></span>
                        <strong class="tooth-number">{{ num }}</strong>
                        <span class="tooth-type-hint">{{ getToothShortLabel(num) }}</span>
                        @if (isToothSelected(num)) {
                          <span class="tooth-check">✓</span>
                        }
                      </button>
                    }
                  </div>
                </div>

                <div class="jaw-label lower-label">
                  <span>{{ t('Lower Right (Quadrant 4)', 'سفلي يمين (الربع 4)') }}</span>
                  <span class="jaw-title-pill">{{ t('MANDIBULAR / LOWER JAW', 'الفك السفلي') }}</span>
                  <span>{{ t('Lower Left (Quadrant 3)', 'سفلي يسار (الربع 3)') }}</span>
                </div>
              </div>
            </div>

            <!-- Footer Summary & Actions -->
            <div class="dialog-footer">
              <div class="footer-selection-summary">
                <strong>{{ tempSelection().length }}</strong>
                <span>{{ t('teeth currently selected:', 'أسنان محددة حالياً:') }}</span>
                <span class="summary-chips-preview">
                  @if (tempSelection().length === 0) {
                    <em>{{ t('No teeth selected (will apply as general procedure)', 'لم يتم تحديد أسنان (إجراء عام)') }}</em>
                  } @else {
                    {{ tempSelection().join(', ') }}
                  }
                </span>
              </div>

              <div class="footer-actions">
                <button type="button" class="btn-dialog-cancel" (click)="closeModal()">
                  {{ t('Cancel', 'إلغاء') }}
                </button>
                <button type="button" class="btn-dialog-apply" (click)="applySelection()">
                  {{ t('Confirm Selection', 'تأكيد الاختيار') }} ({{ tempSelection().length }})
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .tooth-picker-container {
      display: flex;
      flex-direction: column;
      gap: 0.45rem;
      width: 100%;
    }

    .picker-trigger-row {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .btn-open-chart {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.65rem;
      width: 100%;
      height: 42px;
      padding: 0 1rem;
      background: #ffffff;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      font-weight: 650;
      color: #334155;
      transition: all 0.15s ease;

      &:hover {
        border-color: #0284c7;
        background: #f0f9ff;
        color: #0369a1;
      }

      &.has-selection {
        background: #f0f9ff;
        border-color: #0284c7;
        color: #0369a1;
        font-weight: 750;
      }

      .btn-icon {
        font-size: 1.15rem;
      }

      .btn-text {
        flex: 1;
        text-align: start;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .btn-chevron {
        font-size: 0.95rem;
        color: #0284c7;
      }
    }

    .btn-clear-teeth {
      height: 42px;
      padding: 0 0.85rem;
      border-radius: 8px;
      background: #fff1f2;
      border: 1.5px solid #fecdd3;
      color: #e11d48;
      font-weight: 700;
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s ease;

      &:hover {
        background: #ffe4e6;
        border-color: #fda4af;
      }
    }

    .selected-teeth-chips-wrap {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 0.4rem 0.65rem;

      .chips-label {
        font-size: 0.78rem;
        font-weight: 750;
        color: #64748b;
      }

      .chips-list {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        flex-wrap: wrap;
      }

      .tooth-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        background: #e0f2fe;
        border: 1px solid #7dd3fc;
        color: #0369a1;
        padding: 0.15rem 0.5rem;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 750;

        .chip-num {
          background: #0284c7;
          color: #ffffff;
          padding: 0.05rem 0.3rem;
          border-radius: 4px;
          font-size: 0.75rem;
        }

        .chip-name {
          font-size: 0.72rem;
          color: #0f172a;
          font-weight: 600;
        }

        .chip-remove {
          background: transparent;
          border: none;
          color: #ef4444;
          font-size: 0.85rem;
          font-weight: 800;
          cursor: pointer;
          padding: 0 0.15rem;
          line-height: 1;

          &:hover {
            color: #b91c1c;
          }
        }
      }
    }

    // Modal Backdrop & Dialog
    .chart-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      z-index: 9999;
      display: grid;
      place-items: center;
      padding: 1rem;
      animation: fadeIn 0.15s ease-out;
    }

    .chart-modal-dialog {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 900px;
      max-height: 94vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.4);
      border: 1px solid #cbd5e1;
      overflow: hidden;
      animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.15rem 1.5rem;
      border-block-end: 1px solid #e2e8f0;
      background: linear-gradient(135deg, #f8fafc 0%, #f0f7ff 100%);

      .dialog-title-wrap {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .dialog-icon {
          font-size: 1.6rem;
          background: #e0f2fe;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          border: 1px solid #bae6fd;
        }

        h3 {
          margin: 0;
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a;
        }

        .dialog-subtitle {
          margin: 0.15rem 0 0;
          font-size: 0.8rem;
          color: #64748b;
        }
      }

      .btn-close-dialog {
        background: #ffffff;
        border: 1.5px solid #cbd5e1;
        width: 34px;
        height: 34px;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        color: #64748b;
        display: grid;
        place-items: center;
        transition: all 0.15s ease;

        &:hover {
          background: #fee2e2;
          border-color: #fca5a5;
          color: #ef4444;
        }
      }
    }

    .dialog-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.65rem 1.5rem;
      background: #f8fafc;
      border-block-end: 1px solid #e2e8f0;
      gap: 0.75rem;
      flex-wrap: wrap;

      .quick-preset-btns {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;

        .btn-quick {
          height: 32px;
          padding: 0 0.75rem;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #334155;
          cursor: pointer;
          transition: all 0.15s ease;

          &:hover {
            border-color: #0284c7;
            background: #e0f2fe;
            color: #0369a1;
          }
        }
      }

      .btn-quick-clear {
        height: 32px;
        padding: 0 0.75rem;
        background: #fff1f2;
        border: 1px solid #fecdd3;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 750;
        color: #e11d48;
        cursor: pointer;

        &:hover {
          background: #ffe4e6;
        }
      }
    }

    .dental-chart-board {
      padding: 1.25rem 1.5rem;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      background: #f1f5f9;
    }

    .jaw-section {
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 12px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;

      .jaw-label {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.76rem;
        font-weight: 750;
        color: #64748b;

        .jaw-title-pill {
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.15rem 0.65rem;
          border-radius: 999px;
          font-size: 0.72rem;
          letter-spacing: 0.5px;
          border: 1px solid #bae6fd;
        }
      }
    }

    .arch-teeth-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      overflow-x: auto;
      padding-block: 0.25rem;
    }

    .quadrant-group {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      position: relative;
      padding: 1.45rem 0.45rem 0.45rem;
      border: 1px solid #dbe7ec;
      border-radius: 10px;
      background: #f8fafc;

    }
    .quadrant-badge {
      position: absolute;
      inset-block-start: 0.4rem;
      inset-inline-start: 0.55rem;
      color: #0f766e;
      font-size: 0.66rem;
      font-weight: 850;
      letter-spacing: 0.05em;
    }

    .quadrant-divider-vertical {
      width: 2px;
      height: 70px;
      background: #0284c7;
      border-radius: 999px;
      margin-inline: 0.25rem;
    }

    .midline-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      margin-block: -0.25rem;

      &::before {
        content: '';
        position: absolute;
        width: 100%;
        height: 1.5px;
        background: #cbd5e1;
        z-index: 1;
      }

      .mid-line-text {
        position: relative;
        z-index: 2;
        background: #f1f5f9;
        padding: 0.1rem 0.75rem;
        font-size: 0.7rem;
        font-weight: 800;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .tooth-cell {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.2rem;
      width: 44px;
      min-width: 44px;
      height: 76px;
      background: #f8fafc;
      border: 1.5px solid #cbd5e1;
      border-radius: 8px;
      cursor: pointer;
      padding: 0.35rem 0.15rem;
      transition: all 0.15s ease;

      &:hover {
        background: #e0f2fe;
        border-color: #0284c7;
        transform: translateY(-2px);
      }

      &.is-selected {
        background: #0284c7;
        border-color: #0369a1;
        box-shadow: 0 4px 10px rgba(2, 132, 199, 0.35);
        transform: translateY(-2px);

        .tooth-number {
          color: #ffffff;
        }

        .tooth-type-hint {
          color: #e0f2fe;
        }

        .tooth-crown {
          background: #ffffff;
          border-color: #ffffff;
        }
      }

      .tooth-crown {
        position: relative;
        width: 22px;
        height: 24px;
        border-radius: 42% 42% 32% 32%;
        background: #f1f5f9;
        border: 1.5px solid #94a3b8;
        transition: all 0.15s ease;

        &::after {
          content: '';
          position: absolute;
          inset: 25% 22%;
          border: 1px solid rgba(100, 116, 139, 0.4);
          border-radius: 50%;
        }

        &.type-incisor { width: 16px; border-radius: 25% 25% 38% 38%; }
        &.type-canine { width: 18px; clip-path: polygon(50% 0, 100% 34%, 84% 100%, 16% 100%, 0 34%); }
        &.type-premolar { width: 20px; border-radius: 38% 38% 32% 32%; }
        &.type-molar { width: 25px; border-radius: 34% 34% 28% 28%; }

        &.lower {
          transform: rotate(180deg);
        }
      }

      .tooth-number {
        font-size: 0.85rem;
        font-weight: 850;
        color: #0f172a;
        line-height: 1;
      }

      .tooth-type-hint {
        font-size: 0.62rem;
        color: #64748b;
        font-weight: 700;
        text-transform: uppercase;
      }

      .tooth-check {
        position: absolute;
        top: 2px;
        inset-inline-end: 2px;
        background: #ffffff;
        color: #0284c7;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        font-size: 0.65rem;
        font-weight: 900;
        display: grid;
        place-items: center;
      }
    }

    .dialog-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.5rem;
      border-block-start: 1px solid #e2e8f0;
      background: #ffffff;
      gap: 1rem;
      flex-wrap: wrap;

      .footer-selection-summary {
        display: flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.86rem;
        color: #334155;

        strong {
          color: #0284c7;
          font-size: 1.1rem;
          font-weight: 850;
        }

        .summary-chips-preview {
          font-weight: 750;
          color: #0f172a;
        }
      }

      .footer-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;

        .btn-dialog-cancel {
          height: 38px;
          padding: 0 1.1rem;
          border: 1.5px solid #cbd5e1;
          background: #ffffff;
          color: #475569;
          border-radius: 8px;
          font-weight: 700;
          font-size: 0.85rem;
          cursor: pointer;

          &:hover {
            background: #f8fafc;
          }
        }

        .btn-dialog-apply {
          height: 38px;
          padding: 0 1.4rem;
          border: none;
          background: #0284c7;
          color: #ffffff;
          border-radius: 8px;
          font-weight: 750;
          font-size: 0.88rem;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);

          &:hover {
            background: #0369a1;
          }
        }
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes scaleUp {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    @media (max-width: 768px) {
      .tooth-cell {
        width: 36px;
        min-width: 36px;
        height: 68px;

        .tooth-crown {
          width: 18px;
          height: 20px;
        }

        .tooth-number {
          font-size: 0.75rem;
        }
      }

      .dialog-header {
        padding: 0.85rem 1rem;
      }

      .dialog-toolbar {
        padding: 0.5rem 1rem;
      }

      .dental-chart-board {
        padding: 0.75rem;
      }
    }
  `],
})
export class ToothPickerComponent {
  private readonly i18n = inject(LocalizationService);

  @Input() selectedTeeth: number[] = [];
  @Output() readonly selectedTeethChange = new EventEmitter<number[]>();

  readonly isOpen = signal(false);
  readonly tempSelection = signal<number[]>([]);

  // FDI Quadrants
  readonly upperRight = [18, 17, 16, 15, 14, 13, 12, 11];
  readonly upperLeft  = [21, 22, 23, 24, 25, 26, 27, 28];
  readonly lowerRight = [48, 47, 46, 45, 44, 43, 42, 41];
  readonly lowerLeft  = [31, 32, 33, 34, 35, 36, 37, 38];

  openModal() {
    this.tempSelection.set([...this.selectedTeeth]);
    this.isOpen.set(true);
  }

  closeModal() {
    this.isOpen.set(false);
  }

  isToothSelected(num: number): boolean {
    return this.tempSelection().includes(num);
  }

  toggleTooth(num: number) {
    if (this.tempSelection().includes(num)) {
      this.tempSelection.update((arr) => arr.filter((x) => x !== num));
    } else {
      this.tempSelection.update((arr) => [...arr, num].sort((a, b) => a - b));
    }
  }

  selectUpperJaw() {
    const allUpper = [...this.upperRight, ...this.upperLeft];
    const hasAll = allUpper.every((x) => this.tempSelection().includes(x));
    if (hasAll) {
      this.tempSelection.update((arr) => arr.filter((x) => !allUpper.includes(x)));
    } else {
      const merged = Array.from(new Set([...this.tempSelection(), ...allUpper])).sort((a, b) => a - b);
      this.tempSelection.set(merged);
    }
  }

  selectLowerJaw() {
    const allLower = [...this.lowerRight, ...this.lowerLeft];
    const hasAll = allLower.every((x) => this.tempSelection().includes(x));
    if (hasAll) {
      this.tempSelection.update((arr) => arr.filter((x) => !allLower.includes(x)));
    } else {
      const merged = Array.from(new Set([...this.tempSelection(), ...allLower])).sort((a, b) => a - b);
      this.tempSelection.set(merged);
    }
  }

  selectAnterior() {
    const anterior = [13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33];
    const hasAll = anterior.every((x) => this.tempSelection().includes(x));
    if (hasAll) {
      this.tempSelection.update((arr) => arr.filter((x) => !anterior.includes(x)));
    } else {
      const merged = Array.from(new Set([...this.tempSelection(), ...anterior])).sort((a, b) => a - b);
      this.tempSelection.set(merged);
    }
  }

  applySelection() {
    this.selectedTeeth = [...this.tempSelection()].sort((a, b) => a - b);
    this.selectedTeethChange.emit(this.selectedTeeth);
    this.isOpen.set(false);
  }

  removeTooth(num: number) {
    this.selectedTeeth = this.selectedTeeth.filter((x) => x !== num);
    this.selectedTeethChange.emit(this.selectedTeeth);
  }

  clearAll() {
    this.selectedTeeth = [];
    this.selectedTeethChange.emit([]);
  }

  getToothShortLabel(num: number): string {
    const lastDigit = num % 10;
    if (lastDigit === 1) return 'CI'; // Central Incisor
    if (lastDigit === 2) return 'LI'; // Lateral Incisor
    if (lastDigit === 3) return 'C';  // Canine
    if (lastDigit === 4) return 'P1'; // 1st Premolar
    if (lastDigit === 5) return 'P2'; // 2nd Premolar
    if (lastDigit === 6) return 'M1'; // 1st Molar
    if (lastDigit === 7) return 'M2'; // 2nd Molar
    if (lastDigit === 8) return 'M3'; // 3rd Molar / Wisdom
    return '';
  }

  getToothType(num: number): string {
    const lastDigit = num % 10;
    return lastDigit <= 2 ? 'incisor' : lastDigit === 3 ? 'canine' : lastDigit <= 5 ? 'premolar' : 'molar';
  }

  getToothName(num: number): string {
    const isAr = this.i18n.language() === 'ar';
    const lastDigit = num % 10;
    const names: Record<number, { en: string; ar: string }> = {
      1: { en: 'Central Incisor', ar: 'قاطع مركزي' },
      2: { en: 'Lateral Incisor', ar: 'قاطع جانبي' },
      3: { en: 'Canine', ar: 'ناب' },
      4: { en: '1st Premolar', ar: 'ضاحك أول' },
      5: { en: '2nd Premolar', ar: 'ضاحك ثانٍ' },
      6: { en: '1st Molar', ar: 'ضرس أول' },
      7: { en: '2nd Molar', ar: 'ضرس ثانٍ' },
      8: { en: 'Wisdom Tooth', ar: 'ضرس عقل' },
    };
    const item = names[lastDigit];
    return item ? (isAr ? item.ar : item.en) : '';
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

