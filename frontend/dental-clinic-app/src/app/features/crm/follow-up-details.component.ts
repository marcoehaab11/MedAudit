import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, CrmUser, FollowUp } from './crm-api.service';
import { clinicDate, followUpActions, followUpStatus, followUpType } from './crm-labels';
import { isCrmConflict } from './crm-ui';
@Component({
  selector: 'app-follow-up-details',
  imports: [FormsModule, RouterLink],
  template: `<a class="back" routerLink="/crm/follow-ups"
      >← {{ t('Back to follow-ups', 'العودة للمتابعات') }}</a
    >
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading follow-up…', 'جارٍ تحميل المتابعة…') }}</div>
    } @else if (item()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ type(item()!.type) }}</p>
          <h1>{{ item()!.title }}</h1>
          <p>{{ item()!.patientName }} · {{ item()!.assignedToName }}</p>
        </div>
        <div class="head-actions">
          @if (auth.hasPermission('CRM.AssignFollowUp') && item()!.status < 3) {
            <select [(ngModel)]="assignee">
              @for (user of users(); track user.id) {
                <option [value]="user.id">{{ user.displayName }}</option>
              }
            </select>
            <button (click)="assign()">{{ t('Assign', 'إسناد') }}</button>
          }
          @for (a of actions(); track a) {
            <button [class.danger]="a === 'cancel'" (click)="action(a)">
              {{ actionLabel(a) }}
            </button>
          }
        </div>
      </section>
      <section class="panel">
        <dl class="detail-grid">
          <div>
            <dt>{{ t('Status', 'الحالة') }}</dt>
            <dd>
              <span class="badge">{{
                item()!.isOverdue ? t('Overdue', 'متأخرة') : status(item()!.status)
              }}</span>
            </dd>
          </div>
          <div>
            <dt>{{ t('Due', 'الاستحقاق') }}</dt>
            <dd>{{ date(item()!.dueAt, item()!.timeZone) }} ({{ item()!.timeZone }})</dd>
          </div>
          <div>
            <dt>{{ t('Patient', 'المريض') }}</dt>
            <dd>
              <a [routerLink]="['/patients', item()!.patientId]">{{ item()!.patientName }}</a>
            </dd>
          </div>
          <div>
            <dt>{{ t('Assigned', 'المسؤول') }}</dt>
            <dd>{{ item()!.assignedToName }}</dd>
          </div>
        </dl>
        <h2>{{ t('Notes', 'الملاحظات') }}</h2>
        <p>{{ item()!.notes || '—' }}</p>
        <div class="relations">
          @if (item()!.relatedAppointmentId) {
            <a [routerLink]="['/appointments']">{{ t('Related appointment', 'الموعد المرتبط') }}</a>
          }
          @if (item()!.relatedTreatmentPlanId) {
            <a [routerLink]="['/treatment-plans', item()!.relatedTreatmentPlanId]">{{
              t('Related treatment plan', 'خطة العلاج المرتبطة')
            }}</a>
          }
          @if (item()!.relatedTreatmentId) {
            <a [routerLink]="['/treatments', item()!.relatedTreatmentId]">{{
              t('Related treatment', 'العلاج المرتبط')
            }}</a>
          }
          @if (item()!.relatedPrescriptionId) {
            <a [routerLink]="['/prescriptions', item()!.relatedPrescriptionId]">{{
              t('Related prescription', 'الوصفة المرتبطة')
            }}</a>
          }
        </div>
      </section>
    }`,
  styleUrl: './crm.scss',
})
export class FollowUpDetailsComponent {
  private readonly api = inject(CrmApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly item = signal<FollowUp | null>(null);
  readonly users = signal<CrmUser[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal(history.state.message ?? '');
  assignee = '';
  constructor() {
    if (this.auth.hasPermission('CRM.AssignFollowUp'))
      this.api.users().subscribe((users) => this.users.set(users));
    this.load();
  }
  load() {
    this.api.followUp(this.id).subscribe({
      next: (x) => {
        this.item.set(x);
        this.assignee = x.assignedToUserId;
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.t('Follow-up not found or access denied.', 'المتابعة غير موجودة أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  assign() {
    if (!this.assignee || this.assignee === this.item()!.assignedToUserId) return;
    this.api.assign(this.id, this.assignee, this.item()!.version).subscribe({
      next: () => {
        this.message.set(this.t('Follow-up assigned.', 'تم إسناد المتابعة.'));
        this.load();
      },
      error: (error) =>
        this.error.set(
          isCrmConflict(error.status)
            ? this.t(
                'The follow-up changed. Reload and retry.',
                'تغيرت المتابعة. أعد التحميل وحاول مجددًا.',
              )
            : this.t('Assignment failed.', 'فشل الإسناد.'),
        ),
    });
  }
  actions() {
    return followUpActions(this.item()?.status ?? 0).filter((x) =>
      this.auth.hasPermission(
        x === 'complete'
          ? 'CRM.CompleteFollowUp'
          : x === 'cancel'
            ? 'CRM.CancelFollowUp'
            : 'CRM.EditFollowUp',
      ),
    );
  }
  action(x: string) {
    if (!confirm(this.t('Apply this status change?', 'تطبيق تغيير الحالة؟'))) return;
    this.api.action(this.id, x as any, this.item()!.version).subscribe({
      next: () => {
        this.message.set(this.t('Follow-up updated.', 'تم تحديث المتابعة.'));
        this.load();
      },
      error: (e) =>
        this.error.set(
          isCrmConflict(e.status)
            ? this.t('The follow-up changed or is terminal.', 'تغيرت المتابعة أو أصبحت نهائية.')
            : this.t('Status change failed.', 'فشل تغيير الحالة.'),
        ),
    });
  }
  actionLabel(x: string) {
    return x === 'start'
      ? this.t('Start', 'بدء')
      : x === 'complete'
        ? this.t('Complete', 'إكمال')
        : this.t('Cancel', 'إلغاء');
  }
  status(x: number) {
    return followUpStatus(x, this.i18n.language() === 'ar');
  }
  type(x: number) {
    return followUpType(x, this.i18n.language() === 'ar');
  }
  date(value: string, zone: string) {
    return clinicDate(value, zone, this.i18n.language());
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
