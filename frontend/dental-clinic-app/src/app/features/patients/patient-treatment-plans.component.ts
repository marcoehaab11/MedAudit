import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnChanges, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subscription, expand, forkJoin, from, map, mergeMap, of, reduce, toArray } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { DentalApiService, PatientDentalChart } from '../dental/dental-api.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from '../dental/dental-appearance';
import { DentalChartComponent } from '../dental/dental-chart.component';
import { PatientTreatmentSummaryComponent } from '../treatments/patient-treatment-summary.component';
import { Page, TreatmentApiService } from '../treatments/treatment-api.service';
import { treatmentStatus } from '../treatments/treatment-labels';

const groups = [
  { id: 'completed', en: 'Completed treatments', ar: 'الإجراءات المكتملة', icon: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM7 12l3 3 7-7' },
  { id: 'ongoing', en: 'Ongoing treatments', ar: 'الإجراءات الجارية', icon: 'M20 7a9 9 0 0 0-15 0L3 10m0-6v6h6m12 4-2 3a9 9 0 0 1-15 0m11-3h6v6' },
  { id: 'planned', en: 'Planned treatments', ar: 'الإجراءات المخطط لها', icon: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2' },
] as const;

function groupFor(status: number) {
  switch (status) {
    case 4: return 'completed';
    case 3: return 'ongoing';
    case 1:
    case 2: return 'planned';
    default: return null;
  }
}

interface ProcedureCard {
  id: string;
  name: string;
  teeth: number[];
  status: number;
}

@Component({
  selector: 'app-patient-treatment-plans',
  imports: [NgTemplateOutlet, DentalChartComponent, PatientTreatmentSummaryComponent],
  templateUrl: './patient-treatment-plans.component.html',
  styleUrl: './patient-treatment-plans.component.scss',
})
export class PatientTreatmentPlansComponent implements OnChanges {
  readonly patientId = input.required<string>();
  readonly auth = inject(AuthService);
  private readonly i18n = inject(LocalizationService);
  private readonly api = inject(TreatmentApiService);
  private readonly dental = inject(DentalApiService);
  private readonly destroyRef = inject(DestroyRef);
  private overviewRequest?: Subscription;
  private chartRequest?: Subscription;

  readonly groups = groups;
  readonly loading = signal(false);
  readonly failed = signal(false);
  readonly procedures = signal<ProcedureCard[]>([]);
  readonly unstartedPlanItems = signal<ProcedureCard[]>([]);
  readonly cards = computed(() => {
    const cards: Record<(typeof groups)[number]['id'], ProcedureCard[]> = {
      completed: [], ongoing: [], planned: [],
    };
    for (const item of this.procedures()) {
      const group = groupFor(item.status);
      if (group) cards[group].push(item);
    }
    cards.planned.push(...this.unstartedPlanItems());
    return cards;
  });

  readonly canReadTreatments = computed(() => this.auth.hasPermission('Treatments.View'));
  readonly canReadPlans = computed(() => this.auth.hasPermission('TreatmentPlans.View'));
  readonly chart = signal<PatientDentalChart | null>(null);
  readonly chartLoading = signal(false);
  readonly chartFailed = signal(false);
  readonly chartOpen = signal(false);
  readonly updateOpen = signal(false);
  readonly selected = signal(0);
  readonly selectedTooth = computed(() =>
    this.chart()?.teeth.find(tooth => tooth.toothNumber === this.selected()));
  readonly selectedPlannedItems = computed(() =>
    this.unstartedPlanItems().filter(item => item.teeth.includes(this.selected())));
  readonly plannedToothNumbers = computed(() =>
    [...new Set(this.unstartedPlanItems().flatMap(item => item.teeth))]);

  ngOnChanges(): void {
    this.chartRequest?.unsubscribe();
    this.chart.set(null);
    this.selected.set(0);
    this.load();
  }

  load(): void {
    this.overviewRequest?.unsubscribe();
    this.loading.set(true);
    this.failed.set(false);
    const patientId = this.patientId();
    const treatments = this.canReadTreatments()
      ? this.allPages(page => this.api.treatments({ patientId, page, pageSize: '100' }))
      : of([]);
    const plans = this.canReadPlans()
      ? this.allPages(page => this.api.plans({ patientId, page, pageSize: '100' })).pipe(
          mergeMap(items => from(items.filter(item => [1, 2, 3, 5].includes(item.status)))),
          mergeMap(item => this.api.plan(item.id), 6),
          toArray(),
        )
      : of([]);

    this.overviewRequest = forkJoin({ treatments, plans }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ treatments, plans }) => {
          const active = treatments.filter(item => item.patientId === patientId && groupFor(item.status));
          const linkedPlanItems = new Set(active.map(item => item.treatmentPlanItemId));
          const representedContainers = new Set(active
            .filter(item => item.parentTreatmentId)
            .map(item => `${item.parentTreatmentId}:${item.catalogItemId}`));
          this.procedures.set(active
            .filter(item => !item.isClinicalFlowContainer
              || !representedContainers.has(`${item.id}:${item.catalogItemId}`))
            .map(item => ({ id: item.id, name: item.treatmentName, teeth: item.toothNumbers, status: item.status })));
          this.unstartedPlanItems.set(plans
            .filter(plan => plan.patientId === patientId && [1, 2, 3, 5].includes(plan.status))
            .flatMap(plan => plan.items.filter(item => !linkedPlanItems.has(item.id))
              .map(item => ({
                id: item.id,
                name: item.treatmentName,
                teeth: item.toothNumber ? [item.toothNumber] : [],
                status: 1,
              }))));
          this.loading.set(false);
        },
        error: () => {
          this.procedures.set([]);
          this.unstartedPlanItems.set([]);
          this.failed.set(true);
          this.loading.set(false);
        },
      });
  }

  private allPages<T>(get: (page: string) => Observable<Page<T>>): Observable<T[]> {
    return get('1').pipe(
      expand(page => page.page < page.totalPages ? get(String(page.page + 1)) : EMPTY),
      reduce((items, page) => items.concat(page.items), [] as T[]),
    );
  }

  openChart(dialog: HTMLDialogElement): void {
    this.chartOpen.set(true);
    dialog.showModal();
    this.loadChart();
  }

  closeChart(): void {
    this.chartOpen.set(false);
    this.chartRequest?.unsubscribe();
    this.chart.set(null);
    this.selected.set(0);
  }

  loadChart(): void {
    this.chartRequest?.unsubscribe();
    this.chartLoading.set(true);
    this.chartFailed.set(false);
    const id = this.patientId();
    this.chartRequest = this.dental.chart(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: chart => {
        this.chart.set(chart.patientId === id ? chart : null);
        this.chartFailed.set(chart.patientId !== id);
        this.chartLoading.set(false);
      },
      error: () => {
        this.chart.set(null);
        this.chartFailed.set(true);
        this.chartLoading.set(false);
      },
    });
  }

  openUpdate(dialog: HTMLDialogElement): void {
    this.updateOpen.set(true);
    dialog.showModal();
  }

  closeUpdate(): void {
    this.updateOpen.set(false);
    this.load();
  }

  toothLocation(number: number): string {
    const side = Math.floor(number / 10);
    const en = ['Upper Right', 'Upper Left', 'Lower Left', 'Lower Right'][side - 1];
    const ar = ['علوي يمين', 'علوي يسار', 'سفلي يسار', 'سفلي يمين'][side - 1];
    return en ? `${this.t(en, ar)} ${number % 10}` : '';
  }

  groupFor = groupFor;
  statusLabel(status: number): string {
    return treatmentStatus(status, this.i18n.language() === 'ar');
  }

  readonly findingLabels = FINDING_APPEARANCE;
  readonly procedureLabels = PROCEDURE_APPEARANCE;

  t(en: string, ar: string): string {
    return this.i18n.language() === 'ar' ? ar : en;
  }
}
