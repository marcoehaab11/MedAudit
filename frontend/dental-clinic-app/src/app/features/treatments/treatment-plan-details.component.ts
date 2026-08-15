import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { TreatmentApiService, TreatmentPlan } from './treatment-api.service';
import { planStatus } from './treatment-labels';
@Component({
  selector: 'app-treatment-plan-details',
  imports: [RouterLink, DatePipe],
  template: `<a class="back" routerLink="/treatment-plans"
      >← {{ t('Back to plans', 'العودة للخطط') }}</a
    >
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading plan…', 'جارٍ تحميل الخطة…') }}</div>
    } @else if (plan()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ status(plan()!.status) }}</p>
          <h1>{{ plan()!.title }}</h1>
          <p>{{ plan()!.patientName }} · {{ plan()!.doctorName }}</p>
        </div>
        <div class="head-actions">
          @if (plan()!.status === 1 && auth.hasPermission('TreatmentPlans.Edit')) {
            <a class="button" [routerLink]="['/treatment-plans', id, 'edit']">{{
              t('Edit', 'تعديل')
            }}</a>
          }
          @for (a of actions(); track a) {
            <button [class.danger]="a === 'cancel' || a === 'reject'" (click)="action(a)">
              {{ label(a) }}
            </button>
          }
        </div>
      </section>
      <section class="panel">
        <table>
          <thead>
            <tr>
              <th>{{ t('Treatment', 'العلاج') }}</th>
              <th>{{ t('Tooth', 'السن') }}</th>
              <th>{{ t('Qty', 'الكمية') }}</th>
              <th>{{ t('Unit price', 'سعر الوحدة') }}</th>
              <th>{{ t('Discount', 'الخصم') }}</th>
              <th>{{ t('Total', 'الإجمالي') }}</th>
            </tr>
          </thead>
          <tbody>
            @for (x of plan()!.items; track x.id) {
              <tr>
                <td>{{ x.treatmentName }}</td>
                <td>{{ x.toothNumber || '—' }}</td>
                <td>{{ x.quantity }}</td>
                <td>{{ x.unitPrice }}</td>
                <td>{{ x.discountAmount }}</td>
                <td>{{ x.total }}</td>
              </tr>
            }
          </tbody>
        </table>
        <div class="totals">
          <span>{{ t('Subtotal', 'المجموع') }}: {{ plan()!.subtotal }}</span
          ><span>{{ t('Discount', 'الخصم') }}: {{ plan()!.discountAmount }}</span
          ><strong>{{ t('Total', 'الإجمالي') }}: {{ plan()!.total }}</strong>
        </div>
      </section>
      <section class="panel">
        <h2>{{ t('Notes', 'ملاحظات') }}</h2>
        <p>{{ plan()!.notes || '—' }}</p>
        <small>{{ t('Last updated', 'آخر تحديث') }} {{ plan()!.updatedAt | date: 'medium' }}</small>
      </section>
    }`,
  styleUrl: './treatments.scss',
})
export class TreatmentPlanDetailsComponent {
  private readonly api = inject(TreatmentApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly plan = signal<TreatmentPlan | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal(history.state.message ?? '');
  constructor() {
    this.load();
  }
  load() {
    this.api.plan(this.id).subscribe({
      next: (x) => {
        this.plan.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.t('Plan not found or access denied.', 'الخطة غير موجودة أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  actions() {
    const s = this.plan()?.status;
    return s === 1
      ? ['propose', 'cancel']
      : s === 2
        ? ['accept', 'reject', 'cancel']
        : s === 3
          ? ['start', 'cancel']
          : s === 5
            ? ['complete']
            : [];
  }
  action(a: string) {
    if (
      (a === 'cancel' || a === 'reject') &&
      !confirm(this.t('Confirm this status change?', 'هل تؤكد تغيير الحالة؟'))
    )
      return;
    this.api.planAction(this.id, a, this.plan()!.version).subscribe({
      next: () => {
        this.message.set(this.t('Plan status updated.', 'تم تحديث حالة الخطة.'));
        this.load();
      },
      error: (e) =>
        this.error.set(
          e.status === 409
            ? this.t(
                'The plan changed. Reload and try again.',
                'تغيرت الخطة. أعد التحميل وحاول مجددًا.',
              )
            : this.t('Status change failed.', 'فشل تغيير الحالة.'),
        ),
    });
  }
  status(x: number) {
    return planStatus(x, this.i18n.language() === 'ar');
  }
  label(a: string) {
    const labels: Record<string, [string, string]> = {
      propose: ['Propose', 'اقتراح'],
      accept: ['Accept', 'قبول'],
      reject: ['Reject', 'رفض'],
      cancel: ['Cancel', 'إلغاء'],
      start: ['Start', 'بدء'],
      complete: ['Complete', 'إكمال'],
    };
    const value = labels[a];
    return this.t(value[0], value[1]);
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
