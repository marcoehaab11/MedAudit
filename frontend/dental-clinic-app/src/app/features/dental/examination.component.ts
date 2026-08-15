import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LocalizationService } from '../../core/localization.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE, SURFACES } from './dental-appearance';
import { DentalApiService, ExaminationDetails, ToothChartSummary } from './dental-api.service';
import { DentalChartComponent } from './dental-chart.component';

@Component({
  selector: 'app-examination',
  imports: [RouterLink, ReactiveFormsModule, DentalChartComponent],
  styleUrl: './dental.scss',
  template: ` <a class="back" routerLink="/appointments"
      >← {{ t('Back to appointments', 'العودة إلى المواعيد') }}</a
    >
    @if (loading()) {
      <div class="loading" role="status">{{ t('Opening examination…', 'جارٍ فتح الفحص…') }}</div>
    } @else if (error() && !examination()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    } @else if (examination()) {
      <header class="dental-head">
        <div>
          <p>{{ examination()!.patientNumber }} · {{ examination()!.doctorName }}</p>
          <h1>{{ t('Clinical examination', 'الفحص السريري') }}</h1>
          <strong>{{ examination()!.patientName }}</strong>
        </div>
        <span class="exam-status">{{
          examination()!.status === 1
            ? t('Draft', 'مسودة')
            : t('Completed · read only', 'مكتمل · للقراءة فقط')
        }}</span>
      </header>
      @if (error()) {
        <div class="alert error" role="alert">
          {{ error() }}
          <button type="button" (click)="load()">{{ t('Reload', 'إعادة التحميل') }}</button>
        </div>
      }
      @if (success()) {
        <div class="alert success" role="status">{{ success() }}</div>
      }
      <div class="dental-workspace exam">
        <app-dental-chart [teeth]="chartTeeth()" [(selectedNumber)]="selected" />
        <aside class="tooth-details">
          <h2>{{ t('Selected tooth', 'السن المختار') }} {{ selected }}</h2>
          <nav class="clinical-tabs">
            @for (item of tabs; track item.id) {
              <button type="button" [class.active]="tab() === item.id" (click)="tab.set(item.id)">
                {{ t(item.en, item.ar) }}
              </button>
            }
          </nav>
          @switch (tab()) {
            @case ('findings') {
              <div class="record-stack">
                @for (item of selectedFindings(); track item.id) {
                  <article>
                    <div>
                      <strong>{{ findingLabel(item.type) }}</strong
                      ><small>{{ surfaceLabels(item.surfaces) }}</small>
                      <p>{{ item.notes || '—' }}</p>
                    </div>
                    @if (examination()!.canEdit) {
                      <button type="button" class="danger-link" (click)="removeFinding(item.id)">
                        {{ t('Remove', 'حذف') }}
                      </button>
                    }
                  </article>
                } @empty {
                  <p>{{ t('No findings for this tooth.', 'لا توجد نتائج لهذا السن.') }}</p>
                }
              </div>
              @if (examination()!.canEdit) {
                <form [formGroup]="findingForm" (ngSubmit)="addFinding()" class="clinical-form">
                  <label
                    >{{ t('Finding', 'النتيجة')
                    }}<select formControlName="type">
                      @for (item of findingOptions; track item.id) {
                        <option [value]="item.id">{{ t(item.en, item.ar) }}</option>
                      }
                    </select></label
                  >
                  <fieldset>
                    <legend>{{ t('Surfaces', 'الأسطح') }}</legend>
                    @for (surface of surfaces; track surface[0]) {
                      <label
                        ><input
                          type="checkbox"
                          [checked]="hasSurface('finding', surface[0])"
                          (change)="toggleSurface('finding', surface[0])"
                        />{{ t(surface[1], surface[2]) }}</label
                      >
                    }
                  </fieldset>
                  <label
                    >{{ t('Tooth-specific notes', 'ملاحظات السن')
                    }}<textarea formControlName="notes" maxlength="2000"></textarea></label
                  ><button class="primary">{{ t('Add finding', 'إضافة نتيجة') }}</button>
                </form>
              }
            }
            @case ('procedures') {
              <div class="record-stack">
                @for (item of selectedProcedures(); track item.id) {
                  <article>
                    <div>
                      <strong>{{ procedureLabel(item.type) }}</strong
                      ><small>{{ surfaceLabels(item.surfaces) }}</small>
                      <p>{{ item.notes || '—' }}</p>
                    </div>
                    @if (examination()!.canEdit) {
                      <button type="button" class="danger-link" (click)="removeProcedure(item.id)">
                        {{ t('Remove', 'حذف') }}
                      </button>
                    }
                  </article>
                } @empty {
                  <p>{{ t('No procedures for this tooth.', 'لا توجد إجراءات لهذا السن.') }}</p>
                }
              </div>
              @if (examination()!.canEdit) {
                <form [formGroup]="procedureForm" (ngSubmit)="addProcedure()" class="clinical-form">
                  <label
                    >{{ t('Procedure', 'الإجراء')
                    }}<select formControlName="type">
                      @for (item of procedureOptions; track item.id) {
                        <option [value]="item.id">{{ t(item.en, item.ar) }}</option>
                      }
                    </select></label
                  >
                  <fieldset>
                    <legend>{{ t('Surfaces', 'الأسطح') }}</legend>
                    @for (surface of surfaces; track surface[0]) {
                      <label
                        ><input
                          type="checkbox"
                          [checked]="hasSurface('procedure', surface[0])"
                          (change)="toggleSurface('procedure', surface[0])"
                        />{{ t(surface[1], surface[2]) }}</label
                      >
                    }
                  </fieldset>
                  <label
                    >{{ t('Procedure notes', 'ملاحظات الإجراء')
                    }}<textarea formControlName="notes" maxlength="2000"></textarea></label
                  ><button class="primary">{{ t('Record procedure', 'تسجيل الإجراء') }}</button>
                </form>
              }
            }
            @case ('endodontic') {
              <div class="record-stack">
                @for (item of selectedEndodontic(); track item.id) {
                  <article>
                    <div>
                      <strong>{{ t('Root canal record', 'سجل علاج الجذور') }}</strong>
                      @for (canal of item.canals; track canal.id) {
                        <p>
                          <b>{{ canal.name }}</b> · {{ canal.lengthMm }} mm
                          <small>{{ canal.notes }}</small>
                        </p>
                      }
                      <p>{{ item.notes }}</p>
                    </div>
                    @if (examination()!.canEdit) {
                      <button type="button" class="danger-link" (click)="removeEndodontic(item.id)">
                        {{ t('Remove', 'حذف') }}
                      </button>
                    }
                  </article>
                } @empty {
                  <p>
                    {{
                      t('No endodontic data for this tooth.', 'لا توجد بيانات علاج جذور لهذا السن.')
                    }}
                  </p>
                }
              </div>
              @if (examination()!.canEdit) {
                <form [formGroup]="endoForm" (ngSubmit)="addEndodontic()" class="clinical-form">
                  <label
                    >{{
                      t(
                        'Canals — one per line (name:length)',
                        'القنوات — قناة بكل سطر (الاسم:الطول)'
                      )
                    }}<textarea
                      formControlName="canals"
                      placeholder="MB:21&#10;ML:20&#10;D:19"
                    ></textarea>
                  </label>
                  <label
                    >{{ t('Endodontic notes', 'ملاحظات علاج الجذور')
                    }}<textarea formControlName="notes" maxlength="2000"></textarea></label
                  ><button class="primary">
                    {{ t('Add endodontic record', 'إضافة سجل جذور') }}
                  </button>
                </form>
              }
            }
            @case ('notes') {
              <form [formGroup]="notesForm" (ngSubmit)="saveNotes()" class="clinical-form">
                <label
                  >{{ t('Examination notes', 'ملاحظات الفحص') }}
                  <textarea
                    rows="10"
                    formControlName="notes"
                    maxlength="4000"
                    [readonly]="!examination()!.canEdit"
                  ></textarea>
                </label>
                @if (examination()!.canEdit) {
                  <button class="primary">
                    {{ t('Save draft notes', 'حفظ ملاحظات المسودة') }}
                  </button>
                }
              </form>
            }
          }
        </aside>
      </div>
      @if (examination()!.canComplete) {
        <footer class="exam-actions">
          <p>
            {{
              t(
                'Completion locks this examination and its clinical history.',
                'إكمال الفحص يقفل السجل السريري ولا يسمح بتعديله.'
              )
            }}
          </p>
          <button type="button" class="complete" (click)="complete()">
            {{ t('Complete examination', 'إكمال الفحص') }}
          </button>
        </footer>
      }
    }`,
})
export class ExaminationComponent {
  private readonly api = inject(DentalApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);
  readonly appointmentId = inject(ActivatedRoute).snapshot.paramMap.get('appointmentId')!;
  readonly examination = signal<ExaminationDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  selected = 11;
  readonly tab = signal<'findings' | 'procedures' | 'endodontic' | 'notes'>('findings');
  readonly tabs = [
    { id: 'findings' as const, en: 'Findings', ar: 'النتائج' },
    { id: 'procedures' as const, en: 'Procedures', ar: 'الإجراءات' },
    { id: 'endodontic' as const, en: 'Endodontic', ar: 'علاج الجذور' },
    { id: 'notes' as const, en: 'Notes', ar: 'الملاحظات' },
  ];
  readonly surfaces = SURFACES;
  readonly findingOptions = Object.entries(FINDING_APPEARANCE).map(([id, x]) => ({
    id: +id,
    ...x,
  }));
  readonly procedureOptions = Object.entries(PROCEDURE_APPEARANCE).map(([id, x]) => ({
    id: +id,
    ...x,
  }));
  readonly findingForm = this.fb.nonNullable.group({
    type: 2,
    surfaces: [[] as number[]],
    notes: '',
  });
  readonly procedureForm = this.fb.nonNullable.group({
    type: 1,
    surfaces: [[] as number[]],
    notes: '',
  });
  readonly endoForm = this.fb.nonNullable.group({ canals: ['', Validators.required], notes: '' });
  readonly notesForm = this.fb.nonNullable.group({ notes: '' });
  selectedFindings() {
    return this.examination()?.findings.filter((x) => x.toothNumber === this.selected) ?? [];
  }
  selectedProcedures() {
    return this.examination()?.procedures.filter((x) => x.toothNumber === this.selected) ?? [];
  }
  selectedEndodontic() {
    return (
      this.examination()?.endodonticRecords.filter((x) => x.toothNumber === this.selected) ?? []
    );
  }
  readonly chartTeeth = computed<ToothChartSummary[]>(() =>
    Array.from({ length: 4 }, (_, q) => Array.from({ length: 8 }, (_, i) => (q + 1) * 10 + i + 1))
      .flat()
      .map((number) => ({
        toothId: `tooth-${number}`,
        toothNumber: number,
        findings: [
          ...new Set(
            (this.examination()?.findings ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        procedures: [
          ...new Set(
            (this.examination()?.procedures ?? [])
              .filter((x) => x.toothNumber === number)
              .map((x) => x.type),
          ),
        ],
        hasEndodonticRecord: (this.examination()?.endodonticRecords ?? []).some(
          (x) => x.toothNumber === number,
        ),
      })),
  );
  constructor() {
    this.load();
  }
  load() {
    this.error.set('');
    this.api.byAppointment(this.appointmentId).subscribe({
      next: (x) => this.set(x),
      error: (e) => {
        if (e.status === 404) this.create();
        else this.fail(e);
      },
    });
  }
  private create() {
    this.api.create(this.appointmentId).subscribe({
      next: (x) =>
        this.api
          .examination(x.id)
          .subscribe({ next: (e) => this.set(e), error: (e) => this.fail(e) }),
      error: (e) => this.fail(e),
    });
  }
  private set(x: ExaminationDetails) {
    this.examination.set(x);
    this.notesForm.setValue({ notes: x.notes ?? '' });
    this.loading.set(false);
  }
  addFinding() {
    const e = this.examination();
    if (!e) return;
    const v = this.findingForm.getRawValue();
    this.mutate(
      this.api.addFinding(e.id, {
        toothNumber: this.selected,
        type: +v.type,
        surfaces: v.surfaces,
        notes: v.notes || undefined,
        version: e.version,
      }),
    );
  }
  removeFinding(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeFinding(e.id, id, e.version));
  }
  addProcedure() {
    const e = this.examination();
    if (!e) return;
    const v = this.procedureForm.getRawValue();
    this.mutate(
      this.api.addProcedure(e.id, {
        toothNumber: this.selected,
        type: +v.type,
        surfaces: v.surfaces,
        notes: v.notes || undefined,
        version: e.version,
      }),
    );
  }
  removeProcedure(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeProcedure(e.id, id, e.version));
  }
  addEndodontic() {
    const e = this.examination();
    if (!e || this.endoForm.invalid) return;
    try {
      const v = this.endoForm.getRawValue();
      const canals = v.canals
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const [name, length] = line.split(':');
          if (!name || !length || !Number(length)) throw new Error();
          return { name: name.trim(), lengthMm: Number(length) };
        });
      this.mutate(
        this.api.addEndodontic(e.id, {
          toothNumber: this.selected,
          notes: v.notes || undefined,
          canals,
          version: e.version,
        }),
      );
    } catch {
      this.error.set(this.t('Use canal lines such as MB:21.', 'استخدم سطور قنوات مثل MB:21.'));
    }
  }
  removeEndodontic(id: string) {
    const e = this.examination();
    if (e) this.mutate(this.api.removeEndodontic(e.id, id, e.version));
  }
  saveNotes() {
    const e = this.examination();
    if (e)
      this.mutate(
        this.api.notes(e.id, this.notesForm.getRawValue().notes, e.version),
        this.t('Draft saved.', 'تم حفظ المسودة.'),
      );
  }
  complete() {
    const e = this.examination();
    if (!e || !confirm(this.t('Complete and lock this examination?', 'إكمال وقفل هذا الفحص؟')))
      return;
    this.mutate(
      this.api.complete(e.id, e.version),
      this.t('Examination completed.', 'تم إكمال الفحص.'),
    );
  }
  toggleSurface(kind: 'finding' | 'procedure', value: number) {
    const control = (kind === 'finding' ? this.findingForm : this.procedureForm).controls.surfaces;
    let next = control.value.includes(value)
      ? control.value.filter((x) => x !== value)
      : [...control.value, value];
    if (value === 1 && next.includes(1)) next = [1];
    else if (value !== 1) next = next.filter((x) => x !== 1);
    control.setValue(next);
  }
  hasSurface(kind: 'finding' | 'procedure', value: number) {
    return (
      kind === 'finding' ? this.findingForm : this.procedureForm
    ).controls.surfaces.value.includes(value);
  }
  surfaceLabels(values: number[]) {
    return (
      values
        .map((v) => {
          const x = SURFACES.find((s) => s[0] === v)!;
          return this.t(x[1], x[2]);
        })
        .join(', ') || this.t('No surface', 'بدون سطح')
    );
  }
  findingLabel(v: number) {
    const x = FINDING_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }
  procedureLabel(v: number) {
    const x = PROCEDURE_APPEARANCE[v];
    return this.t(x.en, x.ar);
  }
  private mutate(
    request: {
      subscribe: (x: { next: () => void; error: (e: HttpErrorResponse) => void }) => unknown;
    },
    message = '',
  ) {
    this.error.set('');
    request.subscribe({
      next: () => {
        this.success.set(message);
        this.load();
      },
      error: (e) => this.fail(e),
    });
  }
  private fail(e: HttpErrorResponse) {
    this.loading.set(false);
    this.error.set(
      e.status === 409
        ? this.t(
            'This examination changed or is locked. Reload before continuing.',
            'تم تغيير هذا الفحص أو قفله. أعد التحميل قبل المتابعة.',
          )
        : this.t(
            'The clinical request was rejected or access was denied.',
            'تم رفض الطلب السريري أو الوصول غير مسموح.',
          ),
    );
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
