import { Component, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { Treatment, TreatmentApiService, TreatmentPlanList } from './treatment-api.service';
@Component({
  selector: 'app-patient-treatment-summary',
  imports: [RouterLink],
  template: `<section class="panel">
    <div class="summary-head">
      <h2>{{ t('Treatment summary', 'ملخص العلاج') }}</h2>
      <span
        ><a [routerLink]="['/treatment-plans']" [queryParams]="{ patientId }">{{
          t('Plans', 'الخطط')
        }}</a>
        ·
        <a [routerLink]="['/treatments']" [queryParams]="{ patientId }">{{
          t('Treatments', 'العلاجات')
        }}</a></span
      >
    </div>
    @if (loading()) {
      <p>{{ t('Loading…', 'جارٍ التحميل…') }}</p>
    } @else if (!plans().length && !treatments().length) {
      <p>{{ t('No treatment activity yet.', 'لا يوجد نشاط علاجي بعد.') }}</p>
    } @else {
      <div class="treatment-summary-grid">
        <div>
          <strong>{{ activePlans().length }}</strong
          ><span>{{ t('Active plans', 'خطط نشطة') }}</span>
        </div>
        <div>
          <strong>{{ treatments().length }}</strong
          ><span>{{ t('Recent treatments', 'علاجات حديثة') }}</span>
        </div>
        <div>
          <strong>{{ completedTreatments().length }}</strong
          ><span>{{ t('Completed treatments', 'علاجات مكتملة') }}</span>
        </div>
      </div>
      @for (plan of activePlans().slice(0, 3); track plan.id) {
        <p>
          <a [routerLink]="['/treatment-plans', plan.id]">{{ plan.title }}</a> · {{ plan.total }}
        </p>
      }
    }
  </section>`,
})
export class PatientTreatmentSummaryComponent {
  @Input({ required: true }) patientId = '';
  private readonly api = inject(TreatmentApiService);
  readonly i18n = inject(LocalizationService);
  readonly plans = signal<TreatmentPlanList[]>([]);
  readonly treatments = signal<Treatment[]>([]);
  readonly loading = signal(true);
  ngOnInit() {
    this.api.plans({ patientId: this.patientId, pageSize: '5' }).subscribe((x) => {
      this.plans.set(x.items);
      this.done();
    });
    this.api.treatments({ patientId: this.patientId, pageSize: '5' }).subscribe((x) => {
      this.treatments.set(x.items);
      this.done();
    });
  }
  private count = 0;
  activePlans() {
    return this.plans().filter((x) => [1, 2, 3, 5].includes(x.status));
  }
  completedTreatments() {
    return this.treatments().filter((x) => x.status === 4);
  }
  done() {
    if (++this.count === 2) this.loading.set(false);
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
