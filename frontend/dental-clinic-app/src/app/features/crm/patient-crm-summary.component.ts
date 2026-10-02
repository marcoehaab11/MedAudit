import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { DateInputComponent } from '../../shared/date-input/date-input.component';
import { CrmApiService, PatientCrm } from './crm-api.service';
import { activityType, clinicDate, crmTimeline } from './crm-labels';
@Component({
  styleUrl: './crm.scss',

  selector: 'app-patient-crm-summary',
  imports: [ReactiveFormsModule, RouterLink, DateInputComponent],
  template: `@if (data()) {
    <section class="panel crm-summary-panel">
      <div class="summary-head">
        <div>
          <h2>{{ t('CRM & follow-ups', 'العلاقات والمتابعات') }}</h2>
          <p class="section-desc">
            {{ t('Track patient touchpoints, activities, and pending follow-ups.', 'متابعة سجل التواصل والأنشطة والمتابعات المعلقة.') }}
          </p>
        </div>
        <div class="summary-actions">
          @if (data()!.isNew) {
            <span class="badge status-1">{{ t('New patient', 'مريض جديد') }}</span>
          } @else {
            <span class="badge status-3" style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">{{ t('Ongoing patient', 'مريض مستمر / متابعة') }}</span>
          }
          <span class="badge status-2">{{ data()!.pendingFollowUps }} {{ t('open follow-ups', 'متابعات مفتوحة') }}</span>
          <a class="button primary" [routerLink]="['/crm/follow-ups/create']" [queryParams]="{ patientId: patientId() }">
            + {{ t('Create follow-up', 'إنشاء متابعة') }}
          </a>
        </div>
      </div>

      <div class="crm-content-grid">
        <!-- Timeline Section -->
        <div class="timeline-box">
          <h3 class="box-title">{{ t('Recent activities', 'سجل التواصل والنشاط') }}</h3>
          @if (!timeline().length) {
            <div class="empty-state">
              <p>{{ t('No activities recorded yet for this patient.', 'لا توجد أنشطة مسجلة بعد لهذا المريض.') }}</p>
            </div>
          } @else {
            <div class="timeline">
              @for (x of timeline(); track x.id) {
                <article class="timeline-item">
                  <div class="timeline-dot"></div>
                  <div class="timeline-body">
                    <div class="timeline-header">
                      <strong class="timeline-title">
                        @if (x.kind === 'activity') {
                          <span style="color: #0284c7;">{{ activity(x.type!) }}</span>
                          <span style="font-size: 0.8em; color: #64748b; margin-inline-start: 4px;">
                            @if (x.direction === 1) { (↑ {{ t('Outbound', 'صادر') }}) }
                            @if (x.direction === 2) { (↓ {{ t('Inbound', 'وارد') }}) }
                          </span>
                          @if (x.label) { <span> - {{ x.label }}</span> }
                        } @else {
                          <span style="color: #16a34a;">{{ t('Follow-up', 'متابعة') }}</span> - {{ x.label }}
                        }
                      </strong>
                      <time class="timeline-time">{{ date(x.occurredAt) }}</time>
                    </div>
                    @if (x.detail) {
                      <p class="timeline-detail">{{ x.detail }}</p>
                    }
                    <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 4px;">
                      {{ t('By:', 'بواسطة:') }} <strong>{{ x.userName || '—' }}</strong>
                    </div>
                  </div>
                </article>
              }
            </div>
          }
        </div>

        <!-- Record Communication Form -->
        <div class="record-box">
          <h3 class="box-title">{{ t('Record communication', 'تسجيل تواصل جديد') }}</h3>
          <form class="activity-form-styled" [formGroup]="form" (ngSubmit)="add()">
            <div class="activity-grid">
              <label>
                <span>{{ t('Type', 'النوع') }}</span>
                <select formControlName="type">
                  @for (x of types; track x) {
                    <option [value]="x">{{ activity(x) }}</option>
                  }
                </select>
              </label>
              <label>
                <span>{{ t('Direction', 'الاتجاه') }}</span>
                <select formControlName="direction">
                  <option value="1">{{ t('Outbound', 'صادر') }}</option>
                  <option value="2">{{ t('Inbound', 'وارد') }}</option>
                </select>
              </label>
              <label class="subject-col">
                <span>{{ t('Subject', 'الموضوع') }}</span>
                <input formControlName="subject" [placeholder]="t('e.g. Appointment reminder', 'مثال: تذكير بموعد')" />
              </label>
              <label>
                <span>{{ t('Date', 'التاريخ') }}</span>
                <app-date-input formControlName="occurredDate"></app-date-input>
              </label>
              <label>
                <span>{{ t('Time', 'الوقت') }}</span>
                <input type="time" formControlName="occurredTime" />
              </label>
            </div>
            <label class="notes-label">
              <span>{{ t('Notes', 'الملاحظات') }}</span>
              <textarea formControlName="notes" rows="2" [placeholder]="t('Summary of conversation or inquiry…', 'ملخص المكالمة أو الاستفسار…')"></textarea>
            </label>
            <div class="form-actions-row">
              <button class="primary" [disabled]="form.invalid">
                + {{ t('Add activity', 'إضافة النشاط') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  }`,

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

