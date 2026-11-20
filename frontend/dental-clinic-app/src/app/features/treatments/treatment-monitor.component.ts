import { DatePipe } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { EMPTY, Subscription, expand, forkJoin, reduce, timer } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { Treatment, TreatmentApiService } from './treatment-api.service';

@Component({
  selector: 'app-treatment-monitor',
  imports: [DatePipe],
  styleUrl: '../../shared/clinical-register.scss',
  template: `
    <header class="workspace-page-head">
      <div><h1>{{ t('Treatment plans', 'خطط العلاج') }}</h1>
      <p class="page-description">{{ t('Track ongoing and completed patient treatments.', 'متابعة العلاجات الجارية والمكتملة للمرضى.') }}</p></div>
    </header>
    @if (error()) {
      <div class="alert error" role="alert">{{ t('Could not load treatments.', 'تعذر تحميل العلاجات.') }}
        <button type="button" class="button" (click)="load()">{{ t('Try again', 'إعادة المحاولة') }}</button>
      </div>
    }
    @if (loading()) {
      <p role="status">{{ t('Loading treatments…', 'جارٍ تحميل العلاجات…') }}</p>
    } @else {
      <div class="register-sections">
        @for (section of sections(); track section.kind) {
          <section class="register-section" [attr.data-kind]="section.kind" [attr.aria-labelledby]="'register-' + section.kind">
            <h2 [id]="'register-' + section.kind"><span class="register-dot" aria-hidden="true"></span>{{ section.title }}</h2>
            @for (item of section.items; track item.id) {
              <article class="register-row">
                <strong><bdi>{{ item.patientName }}</bdi></strong>
                <span><bdi>{{ item.patientNumber || '—' }}</bdi></span>
                <span><strong><bdi>{{ item.treatmentName }}</bdi></strong>
                  @if (item.toothNumbers.length) {
                    <small>{{ t('Tooth', 'السن') }} <bdi dir="ltr">{{ item.toothNumbers.join(', ') }}</bdi></small>
                  }
                </span>
                <time>{{ (item.completedAt || item.startedAt || item.createdAt) | date:'dd/MM/yyyy' }}</time>
                <span class="register-status">{{ section.status }}</span>
              </article>
            } @empty {
              <p class="register-state">{{ t('No treatments in this section.', 'لا توجد علاجات في هذا القسم.') }}</p>
            }
          </section>
        }
      </div>
    }
  `,
})
export class TreatmentMonitorComponent {
  private readonly api = inject(TreatmentApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private request?: Subscription;
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly ongoing = signal<Treatment[]>([]);
  readonly completed = signal<Treatment[]>([]);
  readonly sections = computed(() => [
    { kind: 'ongoing', title: this.t('Ongoing treatments', 'العلاجات الجارية'), status: this.t('In progress', 'قيد التنفيذ'), items: this.ongoing() },
    { kind: 'completed', title: this.t('Completed treatments', 'العلاجات المكتملة'), status: this.t('Completed', 'تمت'), items: this.completed() },
  ]);

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    timer(30_000, 30_000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (document.visibilityState === 'visible') this.load(true);
    });
  }

  load(quiet = false): void {
    if (quiet && this.request && !this.request.closed) return;
    this.request?.unsubscribe();
    if (!quiet) this.loading.set(true);
    const patientId = this.route.snapshot.queryParamMap.get('patientId');
    const read = (status: number) => {
      const get = (page: number) => this.api.treatments({
        status: String(status), page: String(page), pageSize: '100', ...(patientId ? { patientId } : {}),
      });
      return get(1).pipe(
        expand(page => page.page < page.totalPages ? get(page.page + 1) : EMPTY),
        reduce((items, page) => items.concat(page.items), [] as Treatment[]),
      );
    };
    this.request = forkJoin({ ongoing: read(3), completed: read(4) })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: result => {
          const all = [...result.ongoing, ...result.completed];
          const components = new Set(all.filter(x => x.parentTreatmentId)
            .map(x => x.parentTreatmentId + ':' + x.catalogItemId));
          const visible = (items: Treatment[]) => items
            .filter(item => !item.isClinicalFlowContainer || !components.has(item.id + ':' + item.catalogItemId))
            .sort((a, b) => Date.parse(b.completedAt || b.startedAt || b.createdAt) -
              Date.parse(a.completedAt || a.startedAt || a.createdAt));
          this.ongoing.set(visible(result.ongoing));
          this.completed.set(visible(result.completed));
          this.loading.set(false);
          this.error.set(false);
        },
        error: response => {
          if (!quiet || [401, 403].includes(response.status)) {
            this.ongoing.set([]);
            this.completed.set([]);
          }
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
