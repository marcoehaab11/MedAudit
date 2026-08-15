import { Component, Input, OnChanges, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DentalApiService, PatientDentalChart } from './dental-api.service';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-patient-dental-summary',
  imports: [RouterLink],
  styleUrl: './dental.scss',
  template: ` <section class="panel dental-summary">
    <div>
      <h2>{{ t('Dental', 'الأسنان') }}</h2>
      <p>{{ t('Current status and recent examinations', 'الحالة الحالية والفحوصات الحديثة') }}</p>
    </div>
    @if (chart()) {
      <div class="summary-numbers">
        <span
          ><strong>{{ affected() }}</strong
          >{{ t('teeth with records', 'أسنان لها سجلات') }}</span
        >
        <span
          ><strong>{{ chart()!.recentExaminations.length }}</strong
          >{{ t('recent examinations', 'فحوصات حديثة') }}</span
        >
      </div>
      @if (chart()!.recentExaminations.length) {
        <ul>
          @for (item of chart()!.recentExaminations.slice(0, 3); track item.id) {
            <li>
              <strong>{{ item.doctorName }}</strong> ·
              {{ item.status === 2 ? t('Completed', 'مكتمل') : t('Draft', 'مسودة') }}
            </li>
          }
        </ul>
      }
    }
    <a class="button" [routerLink]="['/patients', patientId, 'dental']">{{
      t('Open dental chart', 'فتح مخطط الأسنان')
    }}</a>
  </section>`,
})
export class PatientDentalSummaryComponent implements OnChanges {
  @Input({ required: true }) patientId!: string;
  readonly chart = signal<PatientDentalChart | null>(null);
  constructor(
    private readonly api: DentalApiService,
    private readonly i18n: LocalizationService,
  ) {}
  ngOnChanges() {
    if (this.patientId)
      this.api
        .chart(this.patientId)
        .subscribe({ next: (x) => this.chart.set(x), error: () => this.chart.set(null) });
  }
  affected() {
    return (
      this.chart()?.teeth.filter(
        (x) => x.findings.length || x.procedures.length || x.hasEndodonticRecord,
      ).length ?? 0
    );
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
