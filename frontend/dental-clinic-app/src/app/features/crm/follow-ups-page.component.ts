import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, FollowUpList } from './crm-api.service';
import { clinicDate, followUpStatus, followUpType } from './crm-labels';
import { followUpFilters } from './crm-ui';
@Component({
  selector: 'app-follow-ups-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `<section class="page-head">
      <div>
        <p class="eyebrow">CRM</p>
        <h1>{{ t('Follow-ups', 'المتابعات') }}</h1>
      </div>
      <a class="button primary" routerLink="/crm/follow-ups/create">{{
        t('New follow-up', 'متابعة جديدة')
      }}</a>
    </section>
    <form class="panel filters" [formGroup]="filters" (ngSubmit)="load(1)">
      <input formControlName="search" [placeholder]="t('Search', 'بحث')" /><select
        formControlName="status"
      >
        <option value="">{{ t('All statuses', 'كل الحالات') }}</option>
        @for (x of statuses; track x) {
          <option [value]="x">{{ status(x) }}</option>
        }</select
      ><select formControlName="type">
        <option value="">{{ t('All types', 'كل الأنواع') }}</option>
        @for (x of types; track x) {
          <option [value]="x">{{ type(x) }}</option>
        }</select
      ><input
        formControlName="assignedToUserId"
        [placeholder]="t('Assigned user ID', 'المستخدم المسؤول')"
      /><input type="date" formControlName="dueFrom" /><input
        type="date"
        formControlName="dueTo"
      /><label
        ><input type="checkbox" formControlName="overdue" />{{
          t('Overdue only', 'المتأخرة فقط')
        }}</label
      ><select formControlName="sortBy">
        <option value="1">{{ t('Sort by due date', 'ترتيب حسب الاستحقاق') }}</option>
        <option value="2">{{ t('Sort by created date', 'ترتيب حسب الإنشاء') }}</option>
        <option value="3">{{ t('Sort by patient', 'ترتيب حسب المريض') }}</option>
        <option value="4">{{ t('Sort by status', 'ترتيب حسب الحالة') }}</option></select
      ><label
        ><input type="checkbox" formControlName="descending" />{{
          t('Descending', 'تنازلي')
        }}</label
      ><button>{{ t('Filter', 'تصفية') }}</button>
    </form>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    <section class="panel table-panel">
      @if (loading()) {
        <div class="state">{{ t('Loading follow-ups…', 'جارٍ تحميل المتابعات…') }}</div>
      } @else if (!items().length) {
        <div class="state">{{ t('No follow-ups found.', 'لا توجد متابعات.') }}</div>
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>{{ t('Patient', 'المريض') }}</th>
                <th>{{ t('Follow-up', 'المتابعة') }}</th>
                <th>{{ t('Type', 'النوع') }}</th>
                <th>{{ t('Assigned', 'المسؤول') }}</th>
                <th>{{ t('Due', 'الاستحقاق') }}</th>
                <th>{{ t('Status', 'الحالة') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (x of items(); track x.id) {
                <tr [class.overdue]="x.isOverdue">
                  <td>{{ x.patientName }}</td>
                  <td>
                    <a [routerLink]="['/crm/follow-ups', x.id]">{{ x.title }}</a>
                  </td>
                  <td>{{ type(x.type) }}</td>
                  <td>{{ x.assignedToName }}</td>
                  <td>{{ date(x.dueAt, x.timeZone) }}</td>
                  <td>
                    <span class="badge status-{{ x.status }}">{{
                      x.isOverdue ? t('Overdue', 'متأخرة') : status(x.status)
                    }}</span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="pager">
          <button [disabled]="page() === 1" (click)="load(page() - 1)">‹</button
          ><span>{{ page() }} / {{ pages() }}</span
          ><button [disabled]="page() >= pages()" (click)="load(page() + 1)">›</button>
        </div>
      }
    </section>`,
  styleUrl: './crm.scss',
})
export class FollowUpsPageComponent {
  private readonly api = inject(CrmApiService);
  readonly i18n = inject(LocalizationService);
  readonly items = signal<FollowUpList[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly statuses = [1, 2, 3, 4];
  readonly types = [1, 2, 3, 4, 5, 6, 7, 8];
  readonly filters = inject(FormBuilder).nonNullable.group({
    search: '',
    status: '',
    type: '',
    assignedToUserId: '',
    dueFrom: '',
    dueTo: '',
    overdue: false,
    sortBy: '1',
    descending: false,
  });
  constructor() {
    const q = inject(ActivatedRoute).snapshot.queryParamMap;
    Object.keys(this.filters.controls).forEach((k) => {
      const v = q.get(k);
      if (v !== null)
        (this.filters.controls as any)[k].setValue(
          k === 'overdue' || k === 'descending' ? v === 'true' : v,
        );
    });
    this.load();
  }
  load(page = this.page()) {
    this.loading.set(true);
    const raw = this.filters.getRawValue();
    const filters = followUpFilters(raw, page);
    this.api.followUps(filters).subscribe({
      next: (x) => {
        this.items.set(x.items);
        this.page.set(x.page);
        this.pages.set(x.totalPages || 1);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('Follow-ups could not be loaded.', 'تعذر تحميل المتابعات.'));
        this.loading.set(false);
      },
    });
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
