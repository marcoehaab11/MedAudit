import { NgTemplateOutlet } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LocalizationService } from '../../core/localization.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from './dental-appearance';
import { ToothChartSummary } from './dental-api.service';
import { ArtRecord, renderPlanoraTooth } from './planora-dental-art';

@Component({
  styleUrl: './dental-chart.scss',
  selector: 'app-dental-chart',
  imports: [FormsModule, NgTemplateOutlet],
  template: `
    <!-- Global 3D Dental Gradients and Filters Definition -->
    <svg class="dental-chart-defs" aria-hidden="true" width="0" height="0" style="position: absolute; width: 0; height: 0; overflow: hidden;">
      <defs>
        <!-- Enamel 3D Linear Gradients -->
        <linearGradient id="dentalCrownUpper" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#e2eeeb"/>
          <stop offset="25%" stop-color="#f4faf9"/>
          <stop offset="60%" stop-color="#ffffff"/>
          <stop offset="90%" stop-color="#edf6f4"/>
          <stop offset="100%" stop-color="#cbe3df"/>
        </linearGradient>

        <linearGradient id="dentalCrownLower" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#e2eeeb"/>
          <stop offset="25%" stop-color="#f4faf9"/>
          <stop offset="60%" stop-color="#ffffff"/>
          <stop offset="90%" stop-color="#edf6f4"/>
          <stop offset="100%" stop-color="#cbe3df"/>
        </linearGradient>

        <!-- Natural Bone/Ivory Root Gradients -->
        <linearGradient id="rootIvory" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#dfd2bc"/>
          <stop offset="50%" stop-color="#e8dfce"/>
          <stop offset="100%" stop-color="#f3ebd9"/>
        </linearGradient>

        <linearGradient id="rootIvoryLower" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#dfd2bc"/>
          <stop offset="50%" stop-color="#e8dfce"/>
          <stop offset="100%" stop-color="#f3ebd9"/>
        </linearGradient>

        <linearGradient id="dentalRootUpper" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#abc8c4"/>
          <stop offset="45%" stop-color="#c4deda"/>
          <stop offset="85%" stop-color="#d9ece8"/>
          <stop offset="100%" stop-color="#eaf5f3"/>
        </linearGradient>

        <linearGradient id="dentalRootLower" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stop-color="#abc8c4"/>
          <stop offset="45%" stop-color="#c4deda"/>
          <stop offset="85%" stop-color="#d9ece8"/>
          <stop offset="100%" stop-color="#eaf5f3"/>
        </linearGradient>

        <!-- Realistic Enamel Crown for Dark Theme -->
        <linearGradient id="enamelCrown" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="50%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>

        <!-- Specular Cusp Highlight (3D Gloss) -->
        <radialGradient id="dentalCuspShine" cx="35%" cy="30%" r="65%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
          <stop offset="60%" stop-color="#ffffff" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>

        <!-- Clinical Colors Matching Reference Image -->
        <!-- Purple Crown -->
        <linearGradient id="crownPurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#c084fc"/>
          <stop offset="50%" stop-color="#a855f7"/>
          <stop offset="100%" stop-color="#7e22ce"/>
        </linearGradient>

        <!-- Cyan Restoration / Filling -->
        <linearGradient id="fillingCyan" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#7dd3fc"/>
          <stop offset="60%" stop-color="#38bdf8"/>
          <stop offset="100%" stop-color="#0284c7"/>
        </linearGradient>

        <!-- Yellow Inlay -->
        <linearGradient id="fillingYellow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="50%" stop-color="#facc15"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>

        <!-- Silver / Amalgam -->
        <linearGradient id="dentalFillingMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#cbd5e1"/>
          <stop offset="50%" stop-color="#94a3b8"/>
          <stop offset="100%" stop-color="#64748b"/>
        </linearGradient>

        <!-- Gold Crown -->
        <linearGradient id="dentalGoldCrown" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fde047"/>
          <stop offset="50%" stop-color="#eab308"/>
          <stop offset="100%" stop-color="#ca8a04"/>
        </linearGradient>

        <!-- Titanium Implant Screw -->
        <linearGradient id="titaniumScrew" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#334155"/>
          <stop offset="35%" stop-color="#94a3b8"/>
          <stop offset="70%" stop-color="#cbd5e1"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>

        <radialGradient id="dentalCariesPit" cx="45%" cy="45%" r="55%">
          <stop offset="0%" stop-color="#5c1d11"/>
          <stop offset="60%" stop-color="#991b1b"/>
          <stop offset="100%" stop-color="#ef4444" stop-opacity="0.9"/>
        </radialGradient>
      </defs>
    </svg>

    <section class="chart-panel" aria-labelledby="chart-title">
      <div class="chart-header">
        <div class="chart-header-info">
          <div class="chart-header-icon">🦷</div>
          <div>
            <h2 id="chart-title">{{ t('Dental Chart', 'مخطط الأسنان السريري') }}</h2>
            <p>{{ t('Permanent Dentition · FDI Notation · 3D Odontogram', 'الأسنان الدائمة · الترقيم الدولي FDI · العرض السريري ثلاثي الأبعاد') }}</p>
          </div>
        </div>

        <div class="chart-header-actions">
          <!-- Dual-Mode Segmented Switcher -->
          <div class="view-mode-pill-group" role="tablist" [attr.aria-label]="t('View Mode', 'وضع العرض')">
            <button type="button" class="view-pill-btn" [class.active]="planoraMode" (click)="planoraMode = true" [attr.aria-pressed]="planoraMode">
              <span class="pill-icon">🦷</span><span class="pill-text">Planora</span>
            </button>
            <button
              type="button"
              class="view-pill-btn"
              [class.active]="!planoraMode && is3dMode"
              (click)="set3dMode(true)"
              [attr.aria-pressed]="is3dMode"
              [title]="t('Clinical 5-Row 3D Odontogram', 'مخطط 3D السريري خماسي الصفوف')"
            >
              <span class="pill-icon">🧊</span>
              <span class="pill-text">{{ t('3D Odontogram', 'مخطط 3D السريري') }}</span>
            </button>
            <button
              type="button"
              class="view-pill-btn"
              [class.active]="!planoraMode && !is3dMode"
              (click)="set3dMode(false)"
              [attr.aria-pressed]="!is3dMode"
              [title]="t('High-Definition 3D Dental Studio', 'مخطط الاستوديو ثلاثي الأبعاد')"
            >
              <span class="pill-icon">🦷</span>
              <span class="pill-text">{{ t('3D Studio Chart', 'مخطط الاستوديو 3D') }}</span>
            </button>
          </div>


          <form (ngSubmit)="search()">
            <label for="tooth-search">{{ t('Find', 'بحث') }}</label>
            <input
              id="tooth-search"
              name="tooth"
              inputmode="numeric"
              [(ngModel)]="query"
              placeholder="36"
              maxlength="2"
            />
            <button type="submit">{{ t('Go', 'اذهب') }}</button>
          </form>
        </div>
      </div>

      @if (multiSelect) {
        <div class="chart-multi-bar">
          <div class="multi-info">
            <span class="multi-badge">🎯 {{ selectedTeeth.length }} {{ t('teeth', 'أسنان') }}</span>
            <span class="multi-teeth-list">#{{ selectedTeeth.join(', #') }}</span>
          </div>
          <div class="multi-actions">
            <button type="button" class="btn-multi-chip" (click)="selectAllUpper()">{{ t('All Upper', 'الفك العلوي') }}</button>
            <button type="button" class="btn-multi-chip" (click)="selectAllLower()">{{ t('All Lower', 'الفك السفلي') }}</button>
            @if (selectedTeeth.length > 1) {
              <button type="button" class="btn-multi-chip clear" (click)="clearSelection()">{{ t('Reset', 'إعادة ضبط') }}</button>
            }
          </div>
        </div>
      }

      @if (searchError) {
        <p class="inline-error" role="alert">
          {{ t('Enter a permanent FDI tooth number.', 'أدخل رقم سن دائم صحيح بنظام FDI.') }}
        </p>
      }

      <div class="chart-body">
        @if (planoraMode) {
          <div class="planora-chart" role="group" [attr.aria-label]="t('Permanent teeth in Planora view', 'الأسنان الدائمة بعرض Planora')">
            <div class="planora-jaw-label">{{ t('Upper jaw', 'الفك العلوي') }}</div>
            <div class="planora-chart-scroll" tabindex="0" [attr.aria-label]="t('Scroll to view all teeth', 'مرر أفقيًا لرؤية كل الأسنان')">
              <div class="planora-jaw planora-upper">
                @for (number of planoraUpperTeeth; track number) {
                  <button type="button" class="planora-tooth" [class.selected]="isSelectedTooth(number)" [class.missing]="isMissing(find(number))" [attr.aria-pressed]="isSelectedTooth(number)" [attr.aria-label]="t('Tooth ', 'السن ') + number" [style.--tooth-accent]="planoraAccent(number)" (click)="choose(number)">
                    <span class="planora-marker" aria-hidden="true"></span>
                    <span class="planora-art" [innerHTML]="planoraArt(number, false)"></span>
                    <span class="planora-number">{{ number % 10 }}</span>
                  </button>
                }
              </div>
              <div class="planora-jaw planora-lower">
                @for (number of planoraLowerTeeth; track number) {
                  <button type="button" class="planora-tooth" [class.selected]="isSelectedTooth(number)" [class.missing]="isMissing(find(number))" [attr.aria-pressed]="isSelectedTooth(number)" [attr.aria-label]="t('Tooth ', 'السن ') + number" [style.--tooth-accent]="planoraAccent(number)" (click)="choose(number)">
                    <span class="planora-marker" aria-hidden="true"></span>
                    <span class="planora-number">{{ number % 10 }}</span>
                    <span class="planora-art" [innerHTML]="planoraArt(number, true)"></span>
                  </button>
                }
              </div>
            </div>
            <div class="planora-jaw-label">{{ t('Lower jaw', 'الفك السفلي') }}</div>
          </div>
        } @else {
        <!-- ════════════════════════════════════════════════════════════════ -->
        <!-- 3D ODONTOGRAM VIEW (MATCHING USER REFERENCE IMAGE)                -->
        <!-- ════════════════════════════════════════════════════════════════ -->
        @if (is3dMode) {
          <div class="odontogram-clinical-box" role="group" [attr.aria-label]="t('3D Odontogram Chart', 'مخطط الأسنان 3D')">
            <!-- UPPER ARCH (BUCCAL ROW + OCCLUSAL ROW) -->
            <div class="odontogram-arch-wrapper upper">
              <div class="arch-label-pill">{{ t('Maxillary Arch / Upper Jaw', 'الفك العلوي') }}</div>

              <!-- Scalloped Periodontal Gingival Line Overlay -->
              <svg class="gingival-wave upper" viewBox="0 0 1000 24" preserveAspectRatio="none">
                <path d="M 0 12 Q 31 6, 62 12 T 124 12 T 186 12 T 248 12 T 310 12 T 372 12 T 434 12 T 496 12 T 558 12 T 620 12 T 682 12 T 744 12 T 806 12 T 868 12 T 930 12 T 1000 12" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="0" y1="17" x2="1000" y2="17" stroke="#ef4444" stroke-width="1.2" stroke-opacity="0.8"/>
              </svg>

              <div class="odontogram-teeth-row">
                <!-- Q1 Right (18 to 11) -->
                <div class="odontogram-quadrant right">
                  @for (number of upperRightTeeth; track number) {
                    <ng-container *ngTemplateOutlet="odontogramToothCol; context: { $implicit: number, lower: false }"></ng-container>
                  }
                </div>

                <!-- Midline Gap -->
                <div class="odontogram-midline"></div>

                <!-- Q2 Left (21 to 28) -->
                <div class="odontogram-quadrant left">
                  @for (number of upperLeftTeeth; track number) {
                    <ng-container *ngTemplateOutlet="odontogramToothCol; context: { $implicit: number, lower: false }"></ng-container>
                  }
                </div>
              </div>
            </div>

            <!-- CENTER FDI NUMBERS BAR (UPPER 18..28 OVER LOWER 48..38) -->
            <div class="odontogram-numbers-bar">
              <div class="numbers-row upper-row">
                <div class="numbers-group right">
                  @for (number of upperRightTeeth; track number) {
                    <span class="num-chip" [class.selected]="isSelectedTooth(number)" (click)="choose(number)">{{ number }}</span>
                  }
                </div>
                <div class="midline-mark"></div>
                <div class="numbers-group left">
                  @for (number of upperLeftTeeth; track number) {
                    <span class="num-chip" [class.selected]="isSelectedTooth(number)" (click)="choose(number)">{{ number }}</span>
                  }
                </div>
              </div>

              <div class="center-line-divider">
                <span>{{ t('OCCLUSAL PLANE · مستوى الإطباق', 'مستوى الإطباق السريري · OCCLUSAL PLANE') }}</span>
              </div>

              <div class="numbers-row lower-row">
                <div class="numbers-group right">
                  @for (number of lowerRightTeeth; track number) {
                    <span class="num-chip" [class.selected]="isSelectedTooth(number)" (click)="choose(number)">{{ number }}</span>
                  }
                </div>
                <div class="midline-mark"></div>
                <div class="numbers-group left">
                  @for (number of lowerLeftTeeth; track number) {
                    <span class="num-chip" [class.selected]="isSelectedTooth(number)" (click)="choose(number)">{{ number }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- LOWER ARCH (OCCLUSAL ROW + BUCCAL ROW) -->
            <div class="odontogram-arch-wrapper lower">
              <!-- Scalloped Periodontal Gingival Line Overlay -->
              <svg class="gingival-wave lower" viewBox="0 0 1000 24" preserveAspectRatio="none">
                <path d="M 0 12 Q 31 18, 62 12 T 124 12 T 186 12 T 248 12 T 310 12 T 372 12 T 434 12 T 496 12 T 558 12 T 620 12 T 682 12 T 744 12 T 806 12 T 868 12 T 930 12 T 1000 12" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round"/>
                <line x1="0" y1="7" x2="1000" y2="7" stroke="#ef4444" stroke-width="1.2" stroke-opacity="0.8"/>
              </svg>

              <div class="odontogram-teeth-row">
                <!-- Q4 Right (48 to 41) -->
                <div class="odontogram-quadrant right">
                  @for (number of lowerRightTeeth; track number) {
                    <ng-container *ngTemplateOutlet="odontogramToothCol; context: { $implicit: number, lower: true }"></ng-container>
                  }
                </div>

                <!-- Midline Gap -->
                <div class="odontogram-midline"></div>

                <!-- Q3 Left (31 to 38) -->
                <div class="odontogram-quadrant left">
                  @for (number of lowerLeftTeeth; track number) {
                    <ng-container *ngTemplateOutlet="odontogramToothCol; context: { $implicit: number, lower: true }"></ng-container>
                  }
                </div>
              </div>

              <div class="arch-label-pill">{{ t('Mandibular Arch / Lower Jaw', 'الفك السفلي') }}</div>
            </div>
          </div>
        } @else {
          <!-- ════════════════════════════════════════════════════════════════ -->
          <!-- 3D DENTAL STUDIO VIEW (LIGHT LUXURY CLINICAL THEME)              -->
          <!-- ════════════════════════════════════════════════════════════════ -->
          <div class="dentition-studio" role="group" [attr.aria-label]="t('Permanent teeth', 'الأسنان الدائمة')">
            <!-- Maxillary Arch (Upper Jaw) -->
            <div class="studio-arch maxillary">
              <div class="studio-arch-header">
                <div class="quadrant-badge right">
                  <span class="q-tag">Q1</span>
                  <span class="q-name">{{ t('Upper Right', 'علوي يمين') }}</span>
                </div>
                <div class="arch-title-pill">
                  <span class="arch-arrow">▲</span>
                  <span class="arch-name">{{ t('Maxillary Arch / Upper Jaw', 'الفك العلوي (الأسنان العلوية)') }}</span>
                </div>
                <div class="quadrant-badge left">
                  <span class="q-tag">Q2</span>
                  <span class="q-name">{{ t('Upper Left', 'علوي يسار') }}</span>
                </div>
              </div>

              <div class="studio-teeth-row">
                <!-- Q1 Right (18 to 11) -->
                <div class="studio-quadrant right">
                  @for (number of upperRightTeeth; track number) {
                    <ng-container *ngTemplateOutlet="studioToothButton; context: { $implicit: number, lower: false }"></ng-container>
                  }
                </div>

                <div class="studio-arch-midline"></div>

                <!-- Q2 Left (21 to 28) -->
                <div class="studio-quadrant left">
                  @for (number of upperLeftTeeth; track number) {
                    <ng-container *ngTemplateOutlet="studioToothButton; context: { $implicit: number, lower: false }"></ng-container>
                  }
                </div>
              </div>
            </div>

            <!-- Occlusal Plane Divider -->
            <div class="studio-occlusal-bar">
              <div class="occlusal-line"></div>
              <div class="occlusal-chip">
                <span class="pulse-dot"></span>
                <span>{{ t('Occlusal Plane', 'مستوى الإطباق السريري') }}</span>
              </div>
              <div class="occlusal-line"></div>
            </div>

            <!-- Mandibular Arch (Lower Jaw) -->
            <div class="studio-arch mandibular">
              <div class="studio-teeth-row">
                <!-- Q4 Right (48 to 41) -->
                <div class="studio-quadrant right">
                  @for (number of lowerRightTeeth; track number) {
                    <ng-container *ngTemplateOutlet="studioToothButton; context: { $implicit: number, lower: true }"></ng-container>
                  }
                </div>

                <div class="studio-arch-midline"></div>

                <!-- Q3 Left (31 to 38) -->
                <div class="studio-quadrant left">
                  @for (number of lowerLeftTeeth; track number) {
                    <ng-container *ngTemplateOutlet="studioToothButton; context: { $implicit: number, lower: true }"></ng-container>
                  }
                </div>
              </div>

              <div class="studio-arch-header lower-header">
                <div class="quadrant-badge right">
                  <span class="q-tag">Q4</span>
                  <span class="q-name">{{ t('Lower Right', 'سفلي يمين') }}</span>
                </div>
                <div class="arch-title-pill lower-pill">
                  <span class="arch-arrow">▼</span>
                  <span class="arch-name">{{ t('Mandibular Arch / Lower Jaw', 'الفك السفلي (الأسنان السفلية)') }}</span>
                </div>
                <div class="quadrant-badge left">
                  <span class="q-tag">Q3</span>
                  <span class="q-name">{{ t('Lower Left', 'سفلي يسار') }}</span>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Clinical Legend -->
        }
        <div class="chart-legend" [class.dark-legend]="!planoraMode && is3dMode">
          <span class="legend-item"><span class="legend-dot dot-caries"></span>{{ t('Caries', 'تسوس') }}</span>
          <span class="legend-item"><span class="legend-dot dot-healthy"></span>{{ t('Healthy', 'سليم') }}</span>
          <span class="legend-item"><span class="legend-dot dot-fracture"></span>{{ t('Fracture', 'كسر') }}</span>
          <span class="legend-item"><span class="legend-dot dot-missing"></span>{{ t('Missing (Dashed)', 'مفقود') }}</span>
          <span class="legend-item"><span class="legend-dot dot-filling"></span>{{ t('Filling (Cyan/Yellow)', 'حشو') }}</span>
          <span class="legend-item"><span class="legend-dot dot-endo"></span>{{ t('Endo (Root Canal)', 'علاج جذور') }}</span>
          <span class="legend-item"><span class="legend-dot dot-implant"></span>{{ t('Implant (Titanium)', 'زراعة') }}</span>
          <span class="legend-item"><span class="legend-dot dot-crown"></span>{{ t('Crown (Purple)', 'تركيبة / تاج') }}</span>
        </div>
      </div>

      <!-- ════════════════════════════════════════════════════════════════ -->
      <!-- TEMPLATES                                                        -->
      <!-- ════════════════════════════════════════════════════════════════ -->

      <!-- Odontogram Tooth Column Template (Upper & Lower) -->
      <ng-template #odontogramToothCol let-number let-lower="lower">
        @let tooth = find(number);
        @let isSelected = isSelectedTooth(number);
        @let anatomy = getToothAnatomy(number);
        @let implant = isImplant(tooth);
        @let crown = isCrown(tooth);
        @let filling = isFilling(tooth);
        @let endo = isEndo(tooth);
        @let missing = isMissing(tooth) && !implant;
        @let caries = isCaries(tooth);

        <button
          type="button"
          class="tooth odontogram-tooth-btn"
          [class.selected]="isSelected"
          [class.upper-tooth]="!lower"
          [class.lower-tooth]="lower"
          [class.is-missing]="missing"
          [class.has-records]="!!tooth && (!!tooth.findings.length || !!tooth.procedures.length || tooth.hasEndodonticRecord)"
          (click)="choose(number)"
          [attr.aria-pressed]="isSelected"
          [title]="'#' + number + ' - ' + (isArabic() ? anatomy.nameAr : anatomy.nameEn) + ' (' + (isArabic() ? anatomy.codeAr : anatomy.codeEn) + ')'"
        >
          <!-- UPPER JAW: Buccal on top, Occlusal below, FDI on bottom -->
          @if (!lower) {
            <div class="tooth-shape buccal-view" [class]="'type-' + anatomy.category + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="odontogramBuccalSvg; context: { number: number, category: anatomy.category, lower: false, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries }"></ng-container>
            </div>

            <div class="occlusal-view" [class]="'type-' + anatomy.category + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="odontogramOcclusalSvg; context: { number: number, category: anatomy.category, lower: false, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries }"></ng-container>
            </div>

            <span class="tooth-fdi-label"><strong>{{ number }}</strong></span>
          } @else {
            <!-- LOWER JAW: FDI on top, Occlusal in middle, Buccal on bottom -->
            <span class="tooth-fdi-label"><strong>{{ number }}</strong></span>

            <div class="occlusal-view" [class]="'type-' + anatomy.category + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="odontogramOcclusalSvg; context: { number: number, category: anatomy.category, lower: true, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries }"></ng-container>
            </div>

            <div class="tooth-shape buccal-view" [class]="'type-' + anatomy.category + ' lower' + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="odontogramBuccalSvg; context: { number: number, category: anatomy.category, lower: true, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries }"></ng-container>
            </div>
          }

          <!-- Corner Clinical Badges -->
          <span class="markers" aria-hidden="true">
            @for (finding of tooth?.findings?.slice(0, 2) ?? []; track finding) {
              <b class="{{ findingAppearance[finding].cssClass }}">{{ findingAppearance[finding].symbol }}</b>
            }
            @for (procedure of tooth?.procedures?.slice(0, 1) ?? []; track procedure) {
              <b class="{{ procedureAppearance[procedure].cssClass }}">{{ procedureAppearance[procedure].symbol }}</b>
            }
            @if (tooth?.hasEndodonticRecord) {
              <b class="root-canal">R</b>
            }
          </span>
        </button>
      </ng-template>

      <!-- Buccal SVG Model Template (Matching media_1788463186399.webp) -->
      <ng-template #odontogramBuccalSvg let-number="number" let-category="category" let-lower="lower" let-tooth="tooth" let-implant="implant" let-crown="crown" let-filling="filling" let-endo="endo" let-missing="missing" let-caries="caries">
        <svg viewBox="0 0 34 76" class="buccal-svg-model" [class.is-dashed]="missing">
          <!-- ════ UPPER BUCCAL (Roots UP, Crown DOWN) ════ -->
          @if (!lower) {
            <!-- 1. MISSING TOOTH (Dashed Outline) -->
            @if (missing) {
              <path d="M 17 6 C 15 16, 15 36, 17 48 M 8 10 C 10 20, 12 36, 13 48 M 26 10 C 24 20, 22 36, 21 48" fill="none" stroke="#64748b" stroke-dasharray="2.5 2" stroke-width="1"/>
              <path d="M 6 48 C 3 50, 2 58, 3 66 C 4 72, 8 75, 17 75.5 C 26 75, 30 72, 31 66 C 32 58, 31 50, 28 48 Z" fill="none" stroke="#64748b" stroke-dasharray="2.5 2" stroke-width="1"/>
            }
            <!-- 2. IMPLANT (Titanium Screw Post + Crown) -->
            @else if (implant) {
              <!-- Titanium Threaded Screw Post pointing UP -->
              <rect x="12" y="8" width="10" height="40" rx="3" fill="url(#titaniumScrew)" stroke="#1e293b" stroke-width="0.8"/>
              <line x1="12" y1="14" x2="22" y2="14" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="20" x2="22" y2="20" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="26" x2="22" y2="26" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="32" x2="22" y2="32" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="38" x2="22" y2="38" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="44" x2="22" y2="44" stroke="#0f172a" stroke-width="1.2"/>
              <!-- Crown down -->
              <path d="M 6 48 C 3 50, 1.5 58, 2.5 66 C 3.5 71, 7.5 75, 12.5 75.5 C 15.5 76, 18.5 76, 21.5 75.5 C 26.5 74.5, 30.5 70, 31.5 65 C 32.5 57, 31 50, 28 48 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
            }
            <!-- 3. NORMAL UPPER TOOTH (Roots Up, Crown Down) -->
            @else {
              <!-- Roots -->
              @if (category === 'molar') {
                <path d="M 17 4 C 15 14, 15 36, 17 48 C 19 36, 19 14, 17 4 Z" fill="url(#rootIvory)"/>
                <path d="M 8 7 C 10 16, 12 34, 13 48 C 10 48, 8 36, 6 18 C 5 12, 6 7, 8 7 Z" fill="url(#rootIvory)"/>
                <path d="M 26 7 C 24 16, 22 34, 21 48 C 24 48, 26 36, 28 18 C 29 12, 28 7, 26 7 Z" fill="url(#rootIvory)"/>
                @if (endo) {
                  <path d="M 17 6 L 17 46 M 8 10 L 12 46 M 26 10 L 22 46" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              } @else if (category === 'premolar') {
                <path d="M 17 6 C 14 16, 13 34, 11 48 C 14 47, 20 47, 23 48 C 21 34, 20 16, 17 6 Z" fill="url(#rootIvory)"/>
                @if (endo) {
                  <path d="M 17 8 L 17 46" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              } @else if (category === 'canine') {
                <path d="M 17 2 C 14 14, 13 34, 12 48 C 15 47, 19 47, 22 48 C 21 34, 20 14, 17 2 Z" fill="url(#rootIvory)"/>
                @if (endo) {
                  <path d="M 17 4 L 17 46" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              } @else {
                <path d="M 17 6 C 14 16, 13 32, 12 48 C 15 47, 19 47, 22 48 C 21 32, 20 16, 17 6 Z" fill="url(#rootIvory)"/>
                @if (endo) {
                  <path d="M 17 8 L 17 46" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              }

              <!-- Crown -->
              @if (category === 'molar') {
                <path d="M 6 48 C 3 50, 1.5 58, 2.5 66 C 3.5 71, 7.5 75, 12.5 75.5 C 15.5 76, 18.5 76, 21.5 75.5 C 26.5 74.5, 30.5 70, 31.5 65 C 32.5 57, 31 50, 28 48 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              } @else if (category === 'canine') {
                <path d="M 8 48 C 5 50, 4 58, 5 66 C 7 72, 14 76, 17 77 C 20 76, 27 72, 29 66 C 30 58, 29 50, 26 48 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              } @else {
                <path d="M 8 48 C 5 50, 4 58, 5 66 C 5 70, 7 74, 8 74.5 L 26 74.5 C 27 74, 29 70, 29 66 C 30 58, 29 50, 26 48 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              }

              <!-- Clinical Overlays -->
              @if (filling && !crown) {
                <path d="M 3 58 C 3 67, 8 74, 14 75 L 14 58 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries && !crown) {
                <ellipse cx="17" cy="62" rx="3.5" ry="3" fill="url(#dentalCariesPit)"/>
              }
            }
          }

          <!-- ════ LOWER BUCCAL (Crown UP, Roots DOWN) ════ -->
          @else {
            <!-- 1. MISSING TOOTH (Dashed Outline) -->
            @if (missing) {
              <path d="M 6 28 C 3 26, 2 18, 3 10 C 4 4, 8 1, 17 0.5 C 26 1, 30 4, 31 10 C 32 18, 31 26, 28 28 Z" fill="none" stroke="#64748b" stroke-dasharray="2.5 2" stroke-width="1"/>
              <path d="M 7 28 C 8 36, 7 56, 9 72 M 27 28 C 26 36, 27 56, 25 72" fill="none" stroke="#64748b" stroke-dasharray="2.5 2" stroke-width="1"/>
            }
            <!-- 2. IMPLANT (Crown Up + Titanium Screw Post Down) -->
            @else if (implant) {
              <!-- Crown Up -->
              <path d="M 6 28 C 3 26, 1.5 18, 2.5 10 C 3.5 5, 7.5 3, 12.5 2.5 C 15.5 2, 18.5 2, 21.5 2.5 C 26.5 3, 30.5 6, 31.5 11 C 32.5 19, 31 26, 28 28 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              <!-- Titanium screw down -->
              <rect x="12" y="28" width="10" height="42" rx="3" fill="url(#titaniumScrew)" stroke="#1e293b" stroke-width="0.8"/>
              <line x1="12" y1="34" x2="22" y2="34" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="40" x2="22" y2="40" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="46" x2="22" y2="46" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="52" x2="22" y2="52" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="58" x2="22" y2="58" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="12" y1="64" x2="22" y2="64" stroke="#0f172a" stroke-width="1.2"/>
            }
            <!-- 3. NORMAL LOWER TOOTH (Crown Up, Roots Down) -->
            @else {
              <!-- Crown -->
              @if (category === 'molar') {
                <path d="M 6 28 C 3 26, 1.5 18, 2.5 10 C 3.5 5, 7.5 3, 12.5 2.5 C 15.5 2, 18.5 2, 21.5 2.5 C 26.5 3, 30.5 6, 31.5 11 C 32.5 19, 31 26, 28 28 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              } @else if (category === 'canine') {
                <path d="M 8 28 C 5 26, 4 18, 5 10 C 7 4, 14 0, 17 0 C 20 0, 27 4, 29 10 C 30 18, 29 26, 26 28 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              } @else {
                <path d="M 8 28 C 5 26, 4 18, 5 10 C 5 6, 7 2, 8 1.5 L 26 1.5 C 27 2, 29 6, 29 10 C 30 18, 29 26, 26 28 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#enamelCrown)'" stroke="#475569" stroke-width="0.8"/>
              }

              <!-- Overlays on crown -->
              @if (filling && !crown) {
                <path d="M 3 10 C 3 19, 8 26, 14 27 L 14 10 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries && !crown) {
                <ellipse cx="17" cy="14" rx="3.5" ry="3" fill="url(#dentalCariesPit)"/>
              }

              <!-- Roots Down -->
              @if (category === 'molar') {
                <path d="M 7 28 C 8 36, 7 56, 9 72 C 11 72, 13 60, 14 28 Z" fill="url(#rootIvoryLower)"/>
                <path d="M 18 28 C 19 60, 21 72, 23 72 C 25 60, 24 36, 25 28 Z" fill="url(#rootIvoryLower)"/>
                @if (endo) {
                  <path d="M 10 28 L 10 68 M 22 28 L 22 68" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              } @else if (category === 'canine') {
                <path d="M 11 28 C 13 40, 15 60, 17 76 C 19 60, 21 40, 23 28 Z" fill="url(#rootIvoryLower)"/>
                @if (endo) {
                  <path d="M 17 28 L 17 72" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              } @else {
                <path d="M 10 28 C 12 40, 15 56, 17 72 C 19 56, 22 40, 24 28 Z" fill="url(#rootIvoryLower)"/>
                @if (endo) {
                  <path d="M 17 28 L 17 68" stroke="#38bdf8" stroke-width="1.8" stroke-linecap="round"/>
                }
              }
            }
          }
        </svg>
      </ng-template>

      <!-- Occlusal SVG Model Template (Matching media_1788463186399.webp) -->
      <ng-template #odontogramOcclusalSvg let-number="number" let-category="category" let-lower="lower" let-tooth="tooth" let-implant="implant" let-crown="crown" let-filling="filling" let-endo="endo" let-missing="missing" let-caries="caries">
        <svg viewBox="0 0 34 34" class="occlusal-svg-model">
          <!-- 1. MISSING TOOTH (Dashed Outline) -->
          @if (missing) {
            <rect x="3" y="3" width="28" height="28" rx="8" fill="none" stroke="#64748b" stroke-dasharray="2 2" stroke-width="1"/>
          }
          <!-- 2. CROWN (Purple Occlusal Table) -->
          @else if (crown) {
            <rect x="3" y="3" width="28" height="28" rx="8" fill="url(#crownPurple)" stroke="#6b21a8" stroke-width="0.8"/>
            <circle cx="17" cy="17" r="4" fill="#581c87" opacity="0.6"/>
          }
          <!-- 3. NORMAL / RESTORED OCCLUSAL SURFACE -->
          @else {
            @if (category === 'molar') {
              <rect x="3" y="3" width="28" height="28" rx="8" fill="url(#enamelCrown)" stroke="#475569" stroke-width="0.8"/>
              <!-- Restorations -->
              @if (filling) {
                <path d="M 3 17 L 17 17 L 17 31 L 3 31 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries) {
                <ellipse cx="17" cy="17" rx="3.5" ry="3.5" fill="url(#dentalCariesPit)"/>
              }
              <!-- Fissures -->
              <path d="M 8 17 L 26 17 M 17 8 L 17 26" stroke="#475569" stroke-width="0.8" stroke-linecap="round"/>
            } @else if (category === 'premolar') {
              <ellipse cx="17" cy="17" rx="14" ry="11" fill="url(#enamelCrown)" stroke="#475569" stroke-width="0.8"/>
              @if (filling) {
                <path d="M 8 14 L 26 14 L 26 20 L 8 20 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries) {
                <circle cx="17" cy="17" r="3" fill="url(#dentalCariesPit)"/>
              }
              <line x1="9" y1="17" x2="25" y2="17" stroke="#475569" stroke-width="0.8"/>
            } @else if (category === 'canine') {
              <path d="M 17 4 L 28 17 L 17 30 L 6 17 Z" fill="url(#enamelCrown)" stroke="#475569" stroke-width="0.8"/>
              @if (filling) {
                <circle cx="17" cy="17" r="5" fill="url(#fillingCyan)"/>
              }
              @if (caries) {
                <circle cx="17" cy="17" r="3" fill="url(#dentalCariesPit)"/>
              }
            } @else {
              <!-- Incisor -->
              <ellipse cx="17" cy="17" rx="13" ry="7" fill="url(#enamelCrown)" stroke="#475569" stroke-width="0.8"/>
              @if (filling) {
                <path d="M 20 10 C 27 12, 27 22, 20 24 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries) {
                <circle cx="17" cy="17" r="2.5" fill="url(#dentalCariesPit)"/>
              }
            }
          }
        </svg>
      </ng-template>

      <!-- 3D Studio Tooth Button Template -->
      <ng-template #studioToothButton let-number let-lower="lower">
        @let tooth = find(number);
        @let isSelected = isSelectedTooth(number);
        @let anatomy = getToothAnatomy(number);
        @let implant = isImplant(tooth);
        @let crown = isCrown(tooth);
        @let filling = isFilling(tooth);
        @let endo = isEndo(tooth);
        @let missing = isMissing(tooth) && !implant;
        @let caries = isCaries(tooth);
        @let fracture = isFracture(tooth);

        <button
          type="button"
          class="tooth studio-tooth-btn"
          [class.selected]="isSelected"
          [class.upper-tooth]="!lower"
          [class.lower-tooth]="lower"
          [class.is-missing]="missing"
          [class.has-records]="!!tooth && (!!tooth.findings.length || !!tooth.procedures.length || tooth.hasEndodonticRecord)"
          (click)="choose(number)"
          [attr.aria-pressed]="isSelected"
          [attr.aria-label]="t('Tooth', 'السن') + ' ' + number + ' ' + (isArabic() ? anatomy.nameAr : anatomy.nameEn)"
          [title]="'#' + number + ' - ' + (isArabic() ? anatomy.nameAr : anatomy.nameEn) + ' (' + (isArabic() ? anatomy.codeAr : anatomy.codeEn) + ')'"
        >
          @if (!lower) {
            <!-- UPPER TOOTH: Number on Top, 3D Anatomy in Middle, Anatomical Code at Bottom -->
            <span class="tooth-fdi-label"><strong>{{ number }}</strong></span>

            <div class="tooth-shape" [class]="'tooth-shape type-' + anatomy.category + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="studioToothSvg; context: { number: number, category: anatomy.category, lower: false, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries, fracture: fracture }"></ng-container>
            </div>

            <span class="tooth-anatomy-label">{{ isArabic() ? anatomy.codeAr : anatomy.codeEn }}</span>
          } @else {
            <!-- LOWER TOOTH: Anatomical Code on Top, 3D Anatomy in Middle, Number at Bottom -->
            <span class="tooth-anatomy-label">{{ isArabic() ? anatomy.codeAr : anatomy.codeEn }}</span>

            <div class="tooth-shape" [class]="'tooth-shape type-' + anatomy.category + ' lower' + (missing ? ' missing' : '')">
              <ng-container *ngTemplateOutlet="studioToothSvg; context: { number: number, category: anatomy.category, lower: true, tooth: tooth, implant: implant, crown: crown, filling: filling, endo: endo, missing: missing, caries: caries, fracture: fracture }"></ng-container>
            </div>

            <span class="tooth-fdi-label"><strong>{{ number }}</strong></span>
          }

          <!-- Corner Clinical Badges -->
          <span class="markers" aria-hidden="true">
            @for (finding of tooth?.findings?.slice(0, 2) ?? []; track finding) {
              <b class="{{ findingAppearance[finding].cssClass }}">{{ findingAppearance[finding].symbol }}</b>
            }
            @for (procedure of tooth?.procedures?.slice(0, 1) ?? []; track procedure) {
              <b class="{{ procedureAppearance[procedure].cssClass }}">{{ procedureAppearance[procedure].symbol }}</b>
            }
            @if (tooth?.hasEndodonticRecord) {
              <b class="root-canal">R</b>
            }
          </span>
        </button>
      </ng-template>

      <!-- High-Fidelity 3D Studio Anatomical SVG Model Template -->
      <ng-template #studioToothSvg let-number="number" let-category="category" let-lower="lower" let-tooth="tooth" let-implant="implant" let-crown="crown" let-filling="filling" let-endo="endo" let-missing="missing" let-caries="caries" let-fracture="fracture">
        <svg viewBox="0 0 38 64" class="studio-3d-svg" [class.svg-missing]="missing">
          <!-- ════ UPPER TOOTH (Roots UP, Crown DOWN) ════ -->
          @if (!lower) {
            <!-- 1. MISSING TOOTH (Architectural dashed wireframe) -->
            @if (missing) {
              <path d="M 19 4 C 17 12, 17 20, 19 26 M 9 8 C 11 16, 13 22, 14 26 M 29 8 C 27 16, 25 22, 24 26" fill="none" stroke="#94a3b8" stroke-dasharray="2.5 2" stroke-width="1.2"/>
              <path d="M 7 26 C 4 28, 2 37, 3 46 C 4 52, 9 57, 19 57.5 C 29 57.5, 34 52, 35 46 C 36 37, 34 28, 31 26 Z" fill="none" stroke="#94a3b8" stroke-dasharray="2.5 2" stroke-width="1.2"/>
            }
            <!-- 2. IMPLANT (Titanium Screw Post + Crown) -->
            @else if (implant) {
              <rect x="14" y="4" width="10" height="22" rx="3" fill="url(#titaniumScrew)" stroke="#1e293b" stroke-width="0.8"/>
              <line x1="14" y1="9" x2="24" y2="9" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="14" y1="14" x2="24" y2="14" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="14" y1="19" x2="24" y2="19" stroke="#0f172a" stroke-width="1.2"/>
              <polygon points="12,26 26,26 23,22 15,22" fill="#64748b"/>
              <path d="M 7 26 C 4 28, 2 37, 3 46 C 4 52, 9 57, 19 57.5 C 29 57.5, 34 52, 35 46 C 36 37, 34 28, 31 26 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownUpper)'" stroke="#0284c7" stroke-width="1.2"/>
            }
            <!-- 3. NATURAL TOOTH -->
            @else {
              <!-- Upper Roots -->
              @if (category === 'molar') {
                <path d="M 19 3 C 17 8, 17 18, 19 26 C 21 18, 21 8, 19 3 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                <path d="M 9 5 C 11 11, 13 18, 14 26 C 11.5 26, 9.5 19, 7 13 C 6.5 10, 7.5 7, 9 5 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                <path d="M 29 5 C 27 11, 25 18, 24 26 C 26.5 26, 28.5 19, 31 13 C 31.5 10, 30.5 7, 29 5 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 5 L 19 24 M 10 9 L 13 24 M 28 9 L 25 24" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              } @else if (category === 'premolar') {
                <path d="M 19 4 C 16 11, 15 18, 13 26 C 16 25, 22 25, 25 26 C 23 18, 22 11, 19 4 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 6 L 19 24" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              } @else if (category === 'canine') {
                <path d="M 19 2 C 16 9, 15 18, 14 26 C 17 25, 21 25, 24 26 C 23 18, 22 9, 19 2 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 4 L 19 24" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              } @else {
                <path d="M 19 3 C 16 10, 15 18, 14 26 C 17 25, 21 25, 24 26 C 23 18, 22 10, 19 3 Z" fill="url(#rootIvory)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 5 L 19 24" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              }

              <!-- Cervical Margin -->
              <path d="M 7 26 C 13 24.5, 25 24.5, 31 26" stroke="#c2b49e" stroke-width="1" fill="none"/>

              <!-- Upper Crown -->
              @if (category === 'molar') {
                <path d="M 7 26 C 4 28, 2 37, 3 46 C 4 52, 9 57, 14.5 57.5 C 17.5 58, 20.5 58, 23.5 57.5 C 29 56.5, 34 51, 35 45 C 36 36, 34 28, 31 26 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownUpper)'" stroke="#64748b" stroke-width="1.2"/>
                <!-- 3D Specular Cusp Highlights -->
                <ellipse cx="11" cy="35" rx="4" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="27" cy="35" rx="4" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="12" cy="48" rx="3.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="26" cy="48" rx="3.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <!-- Fissure Grooves -->
                <path d="M 12 42 C 16 43.5, 22 43.5, 26 42 M 19 34 C 19 40, 19 46, 19 52" stroke="#64748b" stroke-width="1.2" stroke-linecap="round" fill="none"/>
              } @else if (category === 'premolar') {
                <path d="M 9 26 C 6 28, 5 37, 6 45 C 7 52, 12 56.5, 19 57 C 26 56.5, 31 52, 32 45 C 33 37, 32 28, 29 26 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownUpper)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="35" rx="5" ry="4" fill="url(#dentalCuspShine)"/>
                <ellipse cx="19" cy="49" rx="4.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <path d="M 13 42 C 16 43, 22 43, 25 42" stroke="#64748b" stroke-width="1.2" stroke-linecap="round" fill="none"/>
              } @else if (category === 'canine') {
                <path d="M 10 26 C 7 28, 6 37, 7 44 C 9 51, 16 57, 19 58.5 C 22 57, 29 51, 31 44 C 32 37, 31 28, 28 26 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownUpper)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="38" rx="5" ry="8" fill="url(#dentalCuspShine)"/>
                <line x1="19" y1="26" x2="19" y2="56" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="1 1"/>
              } @else {
                <path d="M 8 26 C 5 28, 4 38, 5 48 C 5 53, 7 57, 8 57.5 L 30 57.5 C 31 57, 33 53, 33 48 C 34 38, 33 28, 30 26 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownUpper)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="39" rx="7" ry="8" fill="url(#dentalCuspShine)"/>
                <line x1="8" y1="57.5" x2="30" y2="57.5" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
              }

              <!-- Restorations / Caries Overlays -->
              @if (filling && !crown) {
                <path d="M 4 38 C 4 47, 9 54, 15 55 L 15 38 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries && !crown) {
                <ellipse cx="19" cy="42" rx="3.5" ry="3" fill="url(#dentalCariesPit)"/>
              }
              @if (fracture) {
                <path d="M 14 28 L 18 39 L 16 48 L 20 56" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" fill="none"/>
              }
            }
          }

          <!-- ════ LOWER TOOTH (Crown UP, Roots DOWN) ════ -->
          @else {
            <!-- 1. MISSING TOOTH (Architectural dashed wireframe) -->
            @if (missing) {
              <path d="M 7 38 C 4 36, 2 27, 3 18 C 4 12, 9 7, 19 6.5 C 29 6.5, 34 12, 35 18 C 36 27, 34 36, 31 38 Z" fill="none" stroke="#94a3b8" stroke-dasharray="2.5 2" stroke-width="1.2"/>
              <path d="M 9 38 C 10 46, 8 55, 11 60 M 29 38 C 28 46, 30 55, 27 60" fill="none" stroke="#94a3b8" stroke-dasharray="2.5 2" stroke-width="1.2"/>
            }
            <!-- 2. IMPLANT (Crown Up + Titanium Screw Post Down) -->
            @else if (implant) {
              <path d="M 7 38 C 4 36, 2 27, 3 18 C 4 12, 9 7, 19 6.5 C 29 6.5, 34 12, 35 18 C 36 27, 34 36, 31 38 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownLower)'" stroke="#0284c7" stroke-width="1.2"/>
              <polygon points="12,38 26,38 23,42 15,42" fill="#64748b"/>
              <rect x="14" y="42" width="10" height="20" rx="3" fill="url(#titaniumScrew)" stroke="#1e293b" stroke-width="0.8"/>
              <line x1="14" y1="46" x2="24" y2="46" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="14" y1="51" x2="24" y2="51" stroke="#0f172a" stroke-width="1.2"/>
              <line x1="14" y1="56" x2="24" y2="56" stroke="#0f172a" stroke-width="1.2"/>
            }
            <!-- 3. NATURAL LOWER TOOTH -->
            @else {
              <!-- Lower Crown -->
              @if (category === 'molar') {
                <path d="M 7 38 C 4 36, 2 27, 3 18 C 4 12, 9 7, 14.5 6.5 C 17.5 6, 20.5 6, 23.5 6.5 C 29 7.5, 34 13, 35 19 C 36 28, 34 36, 31 38 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownLower)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="11" cy="16" rx="4" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="27" cy="16" rx="4" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="12" cy="28" rx="3.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <ellipse cx="26" cy="28" rx="3.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <path d="M 12 22 C 16 20.5, 22 20.5, 26 22 M 19 12 C 19 18, 19 24, 19 30" stroke="#64748b" stroke-width="1.2" stroke-linecap="round" fill="none"/>
              } @else if (category === 'premolar') {
                <path d="M 9 38 C 6 36, 5 27, 6 19 C 7 12, 12 7.5, 19 7 C 26 7.5, 31 12, 32 19 C 33 27, 32 36, 29 38 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownLower)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="15" rx="5" ry="4" fill="url(#dentalCuspShine)"/>
                <ellipse cx="19" cy="29" rx="4.5" ry="3.5" fill="url(#dentalCuspShine)"/>
                <path d="M 13 22 C 16 21, 22 21, 25 22" stroke="#64748b" stroke-width="1.2" stroke-linecap="round" fill="none"/>
              } @else if (category === 'canine') {
                <path d="M 10 38 C 7 36, 6 27, 7 20 C 9 13, 16 7, 19 5.5 C 22 7, 29 13, 31 20 C 32 27, 31 36, 28 38 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownLower)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="22" rx="5" ry="8" fill="url(#dentalCuspShine)"/>
                <line x1="19" y1="8" x2="19" y2="38" stroke="#94a3b8" stroke-width="0.8" stroke-dasharray="1 1"/>
              } @else {
                <path d="M 8 38 C 5 36, 4 26, 5 16 C 5 11, 7 7, 8 6.5 L 30 6.5 C 31 7, 33 11, 33 16 C 34 26, 33 36, 30 38 Z" [attr.fill]="crown ? 'url(#crownPurple)' : 'url(#dentalCrownLower)'" stroke="#64748b" stroke-width="1.2"/>
                <ellipse cx="19" cy="21" rx="7" ry="8" fill="url(#dentalCuspShine)"/>
                <line x1="8" y1="6.5" x2="30" y2="6.5" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"/>
              }

              <!-- Overlays on Lower Crown -->
              @if (filling && !crown) {
                <path d="M 4 16 C 4 25, 9 32, 15 33 L 15 16 Z" fill="url(#fillingCyan)"/>
              }
              @if (caries && !crown) {
                <ellipse cx="19" cy="22" rx="3.5" ry="3" fill="url(#dentalCariesPit)"/>
              }
              @if (fracture) {
                <path d="M 14 10 L 18 21 L 16 30 L 20 38" stroke="#ef4444" stroke-width="1.8" stroke-linecap="round" fill="none"/>
              }

              <!-- Cervical Margin -->
              <path d="M 7 38 C 13 39.5, 25 39.5, 31 38" stroke="#c2b49e" stroke-width="1" fill="none"/>

              <!-- Lower Roots pointing DOWN -->
              @if (category === 'molar') {
                <path d="M 8 38 C 9 46, 8 55, 11 61 C 13 61, 15 52, 16 38 Z" fill="url(#rootIvoryLower)" stroke="#c2b49e" stroke-width="0.8"/>
                <path d="M 22 38 C 23 52, 25 61, 27 61 C 30 55, 29 46, 30 38 Z" fill="url(#rootIvoryLower)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 12 38 L 12 56 M 26 38 L 26 56" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              } @else if (category === 'canine') {
                <path d="M 13 38 C 15 48, 17 58, 19 62 C 21 58, 23 48, 25 38 Z" fill="url(#rootIvoryLower)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 38 L 19 58" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              } @else {
                <path d="M 13 38 C 15 46, 17 54, 19 60 C 21 54, 23 46, 25 38 Z" fill="url(#rootIvoryLower)" stroke="#c2b49e" stroke-width="0.8"/>
                @if (endo) {
                  <path d="M 19 38 L 19 56" stroke="#0284c7" stroke-width="1.6" stroke-linecap="round"/>
                }
              }
            }
          }
        </svg>
      </ng-template>

    </section>`,

})
export class DentalChartComponent {
  @Input() teeth: ToothChartSummary[] = [];
  @Input() selectedNumber = 11;
  @Output() readonly selectedNumberChange = new EventEmitter<number>();
  @Input() multiSelect = false;
  @Input() selectedTeeth: number[] = [];
  @Output() readonly selectedTeethChange = new EventEmitter<number[]>();

  readonly upperQuadrants = [
    { id: 1, en: 'Upper right', ar: 'علوي يمين', teeth: [18, 17, 16, 15, 14, 13, 12, 11] },
    { id: 2, en: 'Upper left', ar: 'علوي يسار', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  ];
  readonly lowerQuadrants = [
    { id: 4, en: 'Lower right', ar: 'سفلي يمين', teeth: [48, 47, 46, 45, 44, 43, 42, 41] },
    { id: 3, en: 'Lower left', ar: 'سفلي يسار', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
  ];
  readonly findingAppearance = FINDING_APPEARANCE;
  readonly procedureAppearance = PROCEDURE_APPEARANCE;
  query = '';
  searchError = false;

  constructor(private readonly i18n: LocalizationService, private readonly sanitizer: DomSanitizer) {}

  find(number: number) {
    return this.teeth.find((x) => x.toothNumber === number);
  }

  choose(number: number) {
    this.searchError = false;
    this.selectedNumber = number;
    this.selectedNumberChange.emit(number);

    if (this.multiSelect) {
      const list = [...this.selectedTeeth];
      const index = list.indexOf(number);
      if (index > -1) {
        if (list.length > 1) {
          list.splice(index, 1);
        }
      } else {
        list.push(number);
        list.sort((a, b) => a - b);
      }
      this.selectedTeeth = list;
      this.selectedTeethChange.emit(list);
    }
  }

  selectAllUpper() {
    const upperTeeth = this.upperQuadrants.flatMap((q) => q.teeth);
    this.selectedTeeth = Array.from(new Set([...this.selectedTeeth, ...upperTeeth])).sort((a, b) => a - b);
    this.selectedTeethChange.emit(this.selectedTeeth);
  }

  selectAllLower() {
    const lowerTeeth = this.lowerQuadrants.flatMap((q) => q.teeth);
    this.selectedTeeth = Array.from(new Set([...this.selectedTeeth, ...lowerTeeth])).sort((a, b) => a - b);
    this.selectedTeethChange.emit(this.selectedTeeth);
  }

  clearSelection() {
    this.selectedTeeth = [this.selectedNumber];
    this.selectedTeethChange.emit(this.selectedTeeth);
  }

  search() {
    const value = Number(this.query);
    if (![...this.upperQuadrants, ...this.lowerQuadrants].flatMap((x) => x.teeth).includes(value)) {
      this.searchError = true;
      return;
    }
    this.choose(value);
  }

  isArabic(): boolean {
    return this.i18n.language() !== 'en';
  }

  getToothAnatomy(num: number): ToothAnatomyInfo {
    const digit = num % 10;
    const isMolar = digit >= 6;
    const isPremolar = digit === 4 || digit === 5;
    const isCanine = digit === 3;

    let codeEn = '';
    let codeAr = '';
    let nameEn = '';
    let nameAr = '';

    switch (digit) {
      case 1:
        codeEn = 'CI';
        codeAr = 'ق1';
        nameEn = 'Central Incisor';
        nameAr = 'قاطع مركزي';
        break;
      case 2:
        codeEn = 'LI';
        codeAr = 'ق2';
        nameEn = 'Lateral Incisor';
        nameAr = 'قاطع جانبي';
        break;
      case 3:
        codeEn = 'C';
        codeAr = 'ناب';
        nameEn = 'Canine';
        nameAr = 'ناب';
        break;
      case 4:
        codeEn = 'PM1';
        codeAr = 'ض1';
        nameEn = '1st Premolar';
        nameAr = 'ضاحك أول';
        break;
      case 5:
        codeEn = 'PM2';
        codeAr = 'ض2';
        nameEn = '2nd Premolar';
        nameAr = 'ضاحك ثانٍ';
        break;
      case 6:
        codeEn = 'M1';
        codeAr = 'ط1';
        nameEn = '1st Molar';
        nameAr = 'ضرس أول';
        break;
      case 7:
        codeEn = 'M2';
        codeAr = 'ط2';
        nameEn = '2nd Molar';
        nameAr = 'ضرس ثانٍ';
        break;
      case 8:
        codeEn = 'M3';
        codeAr = 'عقل';
        nameEn = '3rd Molar (Wisdom)';
        nameAr = 'ضرس العقل';
        break;
    }

    const category = isMolar ? 'molar' : isPremolar ? 'premolar' : isCanine ? 'canine' : 'incisor';
    return { digit, category, codeEn, codeAr, nameEn, nameAr };
  }

  isCaries(tooth?: ToothChartSummary): boolean {
    return !!tooth?.findings?.includes(2);
  }

  isFilling(tooth?: ToothChartSummary): boolean {
    return !!tooth?.procedures?.includes(1);
  }

  isEndo(tooth?: ToothChartSummary): boolean {
    return !!tooth?.hasEndodonticRecord || !!tooth?.procedures?.includes(4);
  }

  isMissing(tooth?: ToothChartSummary): boolean {
    return !!tooth?.findings?.includes(4);
  }

  isFracture(tooth?: ToothChartSummary): boolean {
    return !!tooth?.findings?.includes(3);
  }

  isImplant(tooth?: ToothChartSummary): boolean {
    return !!tooth?.procedures?.includes(3);
  }

  isCrown(tooth?: ToothChartSummary): boolean {
    return !!tooth?.procedures?.includes(5);
  }

  planoraMode = true;
  is3dMode = true;
  readonly planoraUpperTeeth = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  readonly planoraLowerTeeth = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
  private readonly planoraArtCache = new Map<string, SafeHtml>();

  private planoraRecord(number: number): ArtRecord {
    const tooth = this.find(number);
    const treatment: ArtRecord['treatment'] = this.isImplant(tooth) ? 'implant'
      : this.isCrown(tooth) ? 'crown'
      : this.isEndo(tooth) ? 'root-canal'
      : this.isFilling(tooth) ? 'filling'
      : 'none';
    return { treatment, status: 'existing', surfaces: treatment === 'filling' ? ['O'] : [] };
  }

  planoraArt(number: number, lower: boolean): SafeHtml {
    const record = this.planoraRecord(number);
    const key = `${number}-${lower}-${record.treatment}-${record.status}`;
    let art = this.planoraArtCache.get(key);
    if (!art) {
      art = this.sanitizer.bypassSecurityTrustHtml(renderPlanoraTooth(number, record, lower));
      this.planoraArtCache.set(key, art);
    }
    return art;
  }

  planoraAccent(number: number): string {
    const tooth = this.find(number);
    if (this.isMissing(tooth)) return '#94a3b8';
    if (this.isCaries(tooth)) return '#ef4444';
    if (this.isFracture(tooth)) return '#f59e0b';
    return this.planoraRecord(number).treatment === 'none' ? '#d4dcde' : '#10b9c5';
  }

  toggle3dMode() {
    this.is3dMode = !this.is3dMode;
  }

  set3dMode(val: boolean) {
    this.planoraMode = false;
    this.is3dMode = val;
  }

  isSelectedTooth(num: number): boolean {
    return this.multiSelect ? this.selectedTeeth.includes(num) : this.selectedNumber === num;
  }


  readonly upperRightTeeth = [18, 17, 16, 15, 14, 13, 12, 11];
  readonly upperLeftTeeth = [21, 22, 23, 24, 25, 26, 27, 28];
  readonly lowerRightTeeth = [48, 47, 46, 45, 44, 43, 42, 41];
  readonly lowerLeftTeeth = [31, 32, 33, 34, 35, 36, 37, 38];

  toothType(number: number) {
    const digit = number % 10;
    return digit <= 2 ? 'incisor' : digit === 3 ? 'canine' : digit <= 5 ? 'premolar' : 'molar';
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


export interface ToothAnatomyInfo {
  digit: number;
  category: 'molar' | 'premolar' | 'canine' | 'incisor';
  codeEn: string;
  codeAr: string;
  nameEn: string;
  nameAr: string;
}
