import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { CrmApiService, CrmDashboard } from './crm-api.service';
@Component({
  selector: 'app-crm-dashboard',
  imports: [RouterLink],
  template: `<section class="page-head">
      <div>
        <p class="eyebrow">{{ t('Patient relationships', 'علاقات المرضى') }}</p>
        <h1>{{ t('CRM dashboard', 'لوحة إدارة العلاقات') }}</h1>
      </div>
      <a class="button primary" routerLink="/crm/follow-ups/create">{{
        t('New follow-up', 'متابعة جديدة')
      }}</a>
    </section>
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading CRM…', 'جارٍ تحميل إدارة العلاقات…') }}</div>
    } @else if (data()) {
      <section class="metric-grid">
        @for (card of cards(); track card.label) {
          <a class="metric panel" [routerLink]="card.link"
            ><span>{{ card.label }}</span
            ><strong>{{ card.value }}</strong></a
          >
        }
      </section>
      <section class="panel">
        <h2>{{ t("Today's work", 'عمل اليوم') }}</h2>
        <p>{{ t('Timezone', 'المنطقة الزمنية') }}: {{ data()!.timeZone }}</p>
        <a routerLink="/crm/follow-ups" [queryParams]="{ dueFrom: today, dueTo: today }">{{
          t("Open today's follow-ups", 'فتح متابعات اليوم')
        }}</a>
      </section>
    }`,
  styleUrl: './crm.scss',
})
export class CrmDashboardComponent {
  private readonly api = inject(CrmApiService);
  readonly i18n = inject(LocalizationService);
  readonly data = signal<CrmDashboard | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly today = new Date().toISOString().slice(0, 10);
  constructor() {
    this.api.dashboard().subscribe({
      next: (x) => {
        this.data.set(x);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.t('CRM could not be loaded.', 'تعذر تحميل إدارة العلاقات.'));
        this.loading.set(false);
      },
    });
  }
  cards() {
    const x = this.data()!;
    return [
      { label: this.t('New today', 'جدد اليوم'), value: x.newPatientsToday, link: '/patients' },
      {
        label: this.t('New this week', 'جدد هذا الأسبوع'),
        value: x.newPatientsThisWeek,
        link: '/patients',
      },
      { label: this.t('Pending', 'معلقة'), value: x.pendingFollowUps, link: '/crm/follow-ups' },
      {
        label: this.t('Overdue', 'متأخرة'),
        value: x.overdueFollowUps,
        link: '/crm/follow-ups?overdue=true',
      },
      {
        label: this.t('Completed', 'مكتملة'),
        value: x.completedFollowUps,
        link: '/crm/follow-ups?status=3',
      },
      {
        label: this.t('Due today', 'مستحقة اليوم'),
        value: x.todayFollowUps,
        link: '/crm/follow-ups',
      },
    ];
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
