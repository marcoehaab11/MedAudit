import { Component, Input, OnChanges, OnInit, inject, signal } from '@angular/core';
import { DentalApiService, PatientDentalChart } from './dental-api.service';
import { LocalizationService } from '../../core/localization.service';
import { DentalChartComponent } from './dental-chart.component';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from './dental-appearance';

@Component({
  styleUrl: './dental.scss',
  selector: 'app-patient-dental-summary',
  imports: [DentalChartComponent],
  template: `
    <section class="panel dental-summary-panel">
      <div class="summary-head">
        <div class="head-info">
          <div class="icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2C6.5 2 4 6.5 4 10c0 4 2 7 3.5 10 .8 1.6 1.8 2 2.5 2 .8 0 1.2-.5 2-2 .8 1.5 1.2 2 2 2 .7 0 1.7-.4 2.5-2 1.5-3 3.5-6 3.5-10 0-3.5-2.5-8-8-8z"/>
            </svg>
          </div>
          <div>
            <h2>{{ t('Dental Chart & Records', 'المخطط السني والفحوصات') }}</h2>
            <p class="section-desc">
              {{ t('Odontogram findings, procedures history, and clinical examinations.', 'المخطط السني التفاعلي، تشخيص حالة الأسنان، وسجلات الفحص الإكلينيكي.') }}
            </p>
          </div>
        </div>
        <div class="summary-actions">
          <button type="button" class="button primary" (click)="showChartModal.set(true)">
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            <span>{{ t('Open dental chart', 'فتح مخطط الأسنان') }}</span>
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="summary-loading">
          <p>{{ t('Loading dental data…', 'جارٍ تحميل بيانات الأسنان…') }}</p>
        </div>
      } @else {
        <div class="dental-summary-grid">
          <div class="metric-card">
            <div class="metric-icon tooth-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2C6.5 2 4 6.5 4 10c0 4 2 7 3.5 10 .8 1.6 1.8 2 2.5 2 .8 0 1.2-.5 2-2 .8 1.5 1.2 2 2 2 .7 0 1.7-.4 2.5-2 1.5-3 3.5-6 3.5-10 0-3.5-2.5-8-8-8z"/>
              </svg>
            </div>
            <div class="metric-details">
              <strong>{{ affected() }}</strong>
              <span>{{ t('Teeth with records', 'أسنان بها ملاحظات وسجلات') }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon exam-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                <path d="m9 14 2 2 4-4"/>
              </svg>
            </div>
            <div class="metric-details">
              <strong>{{ chart()?.recentExaminations?.length || 0 }}</strong>
              <span>{{ t('Clinical examinations', 'فحوصات طبية مسجلة') }}</span>
            </div>
          </div>

          <div class="metric-card">
            <div class="metric-icon chart-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
            </div>
            <div class="metric-details">
              <strong>{{ affected() > 0 || (chart()?.recentExaminations?.length || 0) > 0 ? t('Active Chart', 'سجل نشط') : t('Standard', 'سليم / جديد') }}</strong>
              <span>{{ t('Chart status', 'حالة السجل الطبي') }}</span>
            </div>
          </div>
        </div>

        @if (chart()?.recentExaminations?.length) {
          <div class="recent-exams-strip">
            <span class="strip-label">{{ t('Recent examinations:', 'آخر الفحوصات الإكلينيكية:') }}</span>
            <div class="exam-items">
              @for (item of chart()!.recentExaminations.slice(0, 3); track item.id) {
                <div class="exam-item">
                  <span class="doctor">👨‍⚕️ {{ item.doctorName }}</span>
                  <span class="status-pill" [class.completed]="item.status === 2">
                    {{ item.status === 2 ? t('Completed', 'مكتمل') : t('Draft', 'مسودة') }}
                  </span>
                </div>
              }
            </div>
          </div>
        }
      }
    </section>

    <!-- Dental Chart Modal -->
    @if (showChartModal() && chart()) {
      <div class="chart-modal-overlay" (click)="showChartModal.set(false)">
        <div class="chart-modal-content" (click)="$event.stopPropagation()">
          <div class="chart-modal-header">
            <div>
              <h2>{{ t('Dental Chart', 'مخطط الأسنان') }}</h2>
              <p>{{ chart()!.patientName }}</p>
            </div>
            <button type="button" class="close-btn" (click)="showChartModal.set(false)">&times;</button>
          </div>
          <div class="chart-modal-body dental-workspace">
            <app-dental-chart [teeth]="chart()!.teeth" [(selectedNumber)]="selected" />
            <aside class="tooth-details">
              <h2>{{ t('Tooth', 'السن') }} {{ selected }}</h2>
              @let tooth = selectedTooth();
              <section>
                <h3>{{ t('Current findings', 'النتائج الحالية') }}</h3>
                @for (item of tooth?.findings ?? []; track item) {
                  <span class="clinical-tag">{{ labelFinding(item) }}</span>
                } @empty {
                  <p>{{ t('No completed findings.', 'لا توجد نتائج مكتملة.') }}</p>
                }
              </section>
              <section>
                <h3>{{ t('Procedure history', 'سجل الإجراءات') }}</h3>
                @for (item of tooth?.procedures ?? []; track item) {
                  <span class="clinical-tag">{{ labelProcedure(item) }}</span>
                } @empty {
                  <p>{{ t('No completed procedures.', 'لا توجد إجراءات مكتملة.') }}</p>
                }
              </section>
              @if (tooth?.hasEndodonticRecord) {
                <p class="endo-flag">
                  R · {{ t('Endodontic record available', 'يوجد سجل علاج جذور') }}
                </p>
              }
            </aside>
          </div>
        </div>
      </div>
    }
  `,
})
export class PatientDentalSummaryComponent implements OnInit, OnChanges {
  @Input({ required: true }) patientId!: string;
  private readonly api = inject(DentalApiService);
  readonly i18n = inject(LocalizationService);
  readonly chart = signal<PatientDentalChart | null>(null);
  readonly loading = signal(true);
  readonly showChartModal = signal(false);
  selected = 11;

  ngOnInit() {
    this.fetchData();
  }

  ngOnChanges() {
    if (this.patientId) {
      this.fetchData();
    }
  }

  fetchData() {
    this.loading.set(true);
    this.api.chart(this.patientId).subscribe({
      next: (x) => {
        this.chart.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.chart.set(null);
        this.loading.set(false);
      },
    });
  }

  affected() {
    return (
      this.chart()?.teeth.filter(
        (x) => x.findings.length || x.procedures.length || x.hasEndodonticRecord,
      ).length ?? 0
    );
  }

  selectedTooth() {
    return this.chart()?.teeth.find((x) => x.toothNumber === this.selected);
  }

  labelFinding(val: number) {
    const it = FINDING_APPEARANCE[val];
    if (!it) return val.toString();
    return this.i18n.language() === 'ar' ? it.ar : it.en;
  }

  labelProcedure(val: number) {
    const it = PROCEDURE_APPEARANCE[val];
    if (!it) return val.toString();
    return this.i18n.language() === 'ar' ? it.ar : it.en;
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

