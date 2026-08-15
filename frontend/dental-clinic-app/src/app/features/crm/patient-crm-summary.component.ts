import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, PatientCrm } from './crm-api.service';
import { activityType, clinicDate, crmTimeline } from './crm-labels';
@Component({
  selector: 'app-patient-crm-summary',
  imports: [ReactiveFormsModule, RouterLink],
  template: `@if (data()) {
    <section class="panel">
      <div class="summary-head">
        <h2>{{ t('CRM & follow-ups', 'العلاقات والمتابعات') }}</h2>
        <span>
          @if (data()!.isNew) {
            <span class="badge">{{ t('New patient', 'مريض جديد') }}</span>
          }
          {{ data()!.pendingFollowUps }} {{ t('open', 'مفتوحة') }}</span
        >
      </div>
      <a [routerLink]="['/crm/follow-ups/create']" [queryParams]="{ patientId: patientId() }">{{
        t('Create follow-up', 'إنشاء متابعة')
      }}</a>
      <div class="timeline">
        @for (x of timeline(); track x.id) {
          <article>
            <time>{{ date(x.occurredAt) }}</time
            ><strong>{{ x.label }}</strong>
            <p>{{ x.detail || '—' }}</p>
          </article>
        }
      </div>
      <form class="activity-form" [formGroup]="form" (ngSubmit)="add()">
        <h3>{{ t('Record communication', 'تسجيل تواصل') }}</h3>
        <select formControlName="type">
          @for (x of types; track x) {
            <option [value]="x">{{ activity(x) }}</option>
          }</select
        ><select formControlName="direction">
          <option value="1">{{ t('Outbound', 'صادر') }}</option>
          <option value="2">{{ t('Inbound', 'وارد') }}</option></select
        ><input formControlName="subject" [placeholder]="t('Subject', 'الموضوع')" /><input
          type="date"
          formControlName="occurredDate"
        /><input type="time" formControlName="occurredTime" /><input
          formControlName="notes"
          [placeholder]="t('Concise notes', 'ملاحظات مختصرة')"
        /><button [disabled]="form.invalid">{{ t('Add activity', 'إضافة نشاط') }}</button>
      </form>
    </section>
  }`,
  styleUrl: './crm.scss',
})
export class PatientCrmSummaryComponent {
  readonly patientId = input.required<string>();
  private readonly api = inject(CrmApiService);
  readonly i18n = inject(LocalizationService);
  readonly data = signal<PatientCrm | null>(null);
  readonly types = [1, 2, 3, 4, 5];
  readonly form = inject(FormBuilder).nonNullable.group({
    type: 1,
    direction: 1,
    subject: '',
    notes: '',
    occurredDate: [new Date().toISOString().slice(0, 10), Validators.required],
    occurredTime: [new Date().toTimeString().slice(0, 5), Validators.required],
  });
  constructor() {
    setTimeout(() => this.load());
  }
  load() {
    this.api.patient(this.patientId()).subscribe((x) => this.data.set(x));
  }
  timeline() {
    const x = this.data();
    return x ? crmTimeline(x.recentActivities, x.recentFollowUps) : [];
  }
  add() {
    if (this.form.invalid) return;
    const x = this.form.getRawValue();
    this.api
      .createActivity({
        ...x,
        patientId: this.patientId(),
        type: Number(x.type),
        direction: Number(x.direction),
        subject: x.subject || undefined,
        notes: x.notes || undefined,
      })
      .subscribe(() => {
        this.form.controls.subject.setValue('');
        this.form.controls.notes.setValue('');
        this.load();
      });
  }
  activity(x: number) {
    return activityType(x, this.i18n.language() === 'ar');
  }
  date(value: string) {
    return clinicDate(value, this.data()?.timeZone ?? 'UTC', this.i18n.language());
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
