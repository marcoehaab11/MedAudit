import { Component, Input, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { PrescriptionApiService, PrescriptionList } from './prescription-api.service';
import { prescriptionStatus } from './prescription-labels';
@Component({
  selector: 'app-patient-prescription-summary',
  imports: [RouterLink],
  template: `<section class="panel">
    <div class="summary-head">
      <h2>{{ t('Recent prescriptions', 'أحدث الوصفات') }}</h2>
      <a routerLink="/prescriptions" [queryParams]="{ patientId }">{{
        t('View all', 'عرض الكل')
      }}</a>
    </div>
    @if (loading()) {
      <p>{{ t('Loading…', 'جارٍ التحميل…') }}</p>
    } @else {
      @for (x of items(); track x.id) {
        <p>
          <a [routerLink]="['/prescriptions', x.id]">{{ x.prescriptionNumber }}</a> ·
          {{ x.doctorName }} · {{ status(x.status) }}
        </p>
      } @empty {
        <p>{{ t('No prescriptions yet.', 'لا توجد وصفات بعد.') }}</p>
      }
    }
  </section>`,
})
export class PatientPrescriptionSummaryComponent {
  @Input({ required: true }) patientId = '';
  private readonly api = inject(PrescriptionApiService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<PrescriptionList[]>([]);
  readonly loading = signal(true);
  ngOnInit() {
    this.api.prescriptions({ patientId: this.patientId, pageSize: '5' }).subscribe((x) => {
      this.items.set(x.items);
      this.loading.set(false);
    });
  }
  status(x: number) {
    return prescriptionStatus(x, this.i18n.language() === 'ar');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
