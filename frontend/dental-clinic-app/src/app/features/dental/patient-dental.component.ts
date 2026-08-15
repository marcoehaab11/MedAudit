import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from './dental-appearance';
import { DentalApiService, PatientDentalChart } from './dental-api.service';
import { DentalChartComponent } from './dental-chart.component';

@Component({
  selector: 'app-patient-dental',
  imports: [RouterLink, DatePipe, DentalChartComponent],
  styleUrl: './dental.scss',
  template: ` <a class="back" [routerLink]="['/patients', patientId]"
      >← {{ t('Back to patient', 'العودة إلى المريض') }}</a
    >
    @if (loading()) {
      <div class="loading" role="status">
        {{ t('Loading dental chart…', 'جارٍ تحميل مخطط الأسنان…') }}
      </div>
    } @else if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    } @else if (chart()) {
      <header class="dental-head">
        <div>
          <p>{{ chart()!.patientNumber }}</p>
          <h1>{{ chart()!.patientName }}</h1>
        </div>
        <span>{{ t('Current dental record', 'السجل الحالي للأسنان') }}</span>
      </header>
      <div class="dental-workspace">
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
      <section class="history-panel">
        <h2>{{ t('Recent examinations', 'الفحوصات الحديثة') }}</h2>
        @for (item of chart()!.recentExaminations; track item.id) {
          <article>
            <div>
              <strong>{{ item.doctorName }}</strong
              ><small>{{ item.createdAt | date: 'medium' }}</small>
            </div>
            <span>{{ item.status === 2 ? t('Completed', 'مكتمل') : t('Draft', 'مسودة') }}</span>
          </article>
        } @empty {
          <p>{{ t('No examinations yet.', 'لا توجد فحوصات بعد.') }}</p>
        }
      </section>
    }`,
})
export class PatientDentalComponent {
  private readonly api = inject(DentalApiService);
  private readonly i18n = inject(LocalizationService);
  readonly patientId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly chart = signal<PatientDentalChart | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  selected = 11;
  constructor() {
    this.api.chart(this.patientId).subscribe({
      next: (x) => {
        this.chart.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.t(
            'Dental record is unavailable or access is denied.',
            'سجل الأسنان غير متاح أو الوصول مرفوض.',
          ),
        );
        this.loading.set(false);
      },
    });
  }
  selectedTooth() {
    return this.chart()?.teeth.find((x) => x.toothNumber === this.selected);
  }
  labelFinding(v: number) {
    const x = FINDING_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }
  labelProcedure(v: number) {
    const x = PROCEDURE_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
