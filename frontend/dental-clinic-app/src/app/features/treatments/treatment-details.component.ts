import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { Treatment, TreatmentApiService } from './treatment-api.service';
import { treatmentStatus } from './treatment-labels';
@Component({
  selector: 'app-treatment-details',
  imports: [RouterLink, DatePipe],
  template: `<a class="back" routerLink="/treatments"
      >← {{ t('Back to treatments', 'العودة للعلاجات') }}</a
    >
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading treatment…', 'جارٍ تحميل العلاج…') }}</div>
    } @else if (item()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ status(item()!.status) }}</p>
          <h1>{{ item()!.treatmentName }}</h1>
          <p>{{ item()!.patientName }} · {{ item()!.doctorName }}</p>
        </div>
        <div class="head-actions">
          @for (a of actions(); track a) {
            <button [class.danger]="a === 'cancel'" (click)="action(a)">{{ label(a) }}</button>
          }
        </div>
      </section>
      <div class="detail-grid">
        <section class="panel">
          <h2>{{ t('Execution', 'التنفيذ') }}</h2>
          <dl>
            <div>
              <dt>{{ t('Teeth', 'الأسنان') }}</dt>
              <dd>{{ item()!.toothNumbers.join(', ') || '—' }}</dd>
            </div>
            <div>
              <dt>{{ t('Price snapshot', 'السعر المثبت') }}</dt>
              <dd>{{ item()!.price }}</dd>
            </div>
            <div>
              <dt>{{ t('Created', 'أُنشئ') }}</dt>
              <dd>{{ item()!.createdAt | date: 'medium' }}</dd>
            </div>
            <div>
              <dt>{{ t('Completed', 'اكتمل') }}</dt>
              <dd>{{ (item()!.completedAt | date: 'medium') || '—' }}</dd>
            </div>
          </dl>
        </section>
        <section class="panel">
          <h2>{{ t('Notes', 'ملاحظات') }}</h2>
          <p>{{ item()!.notes || '—' }}</p>
        </section>
      </div>
    }`,
  styleUrl: './treatments.scss',
})
export class TreatmentDetailsComponent {
  private readonly api = inject(TreatmentApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly item = signal<Treatment | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal('');
  constructor() {
    this.load();
  }
  load() {
    this.api.treatment(this.id).subscribe({
      next: (x) => {
        this.item.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.t('Treatment not found or access denied.', 'العلاج غير موجود أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  actions() {
    const s = this.item()?.status;
    return s === 1 || s === 2 ? ['start', 'cancel'] : s === 3 ? ['complete', 'cancel'] : [];
  }
  action(a: string) {
    if (a === 'cancel' && !confirm(this.t('Cancel this treatment?', 'هل تريد إلغاء هذا العلاج؟')))
      return;
    this.api.treatmentAction(this.id, a, this.item()!.version).subscribe({
      next: () => {
        this.message.set(this.t('Treatment updated.', 'تم تحديث العلاج.'));
        this.load();
      },
      error: (e) =>
        this.error.set(
          e.status === 409
            ? this.t(
                'The treatment changed or is immutable.',
                'تغير العلاج أو أصبح غير قابل للتعديل.',
              )
            : this.t('Update failed.', 'فشل التحديث.'),
        ),
    });
  }
  status(x: number) {
    return treatmentStatus(x, this.i18n.language() === 'ar');
  }
  label(a: string) {
    return a === 'start'
      ? this.t('Start', 'بدء')
      : a === 'complete'
        ? this.t('Complete', 'إكمال')
        : this.t('Cancel', 'إلغاء');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
