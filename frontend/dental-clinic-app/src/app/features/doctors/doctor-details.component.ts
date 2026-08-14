import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import {
  Compensation,
  DoctorApiService,
  DoctorDetails,
  SchedulePeriod,
} from './doctor-api.service';

type Tab = 'profile' | 'account' | 'schedule' | 'compensation';
@Component({
  selector: 'app-doctor-details',
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FormsModule],
  template: `
    <a class="back" routerLink="/doctors">← {{ t('Back to doctors', 'العودة إلى الأطباء') }}</a>
    @if (loading()) {
      <div class="state">{{ t('Loading doctor…', 'جارٍ تحميل الطبيب…') }}</div>
    } @else if (error()) {
      <div class="alert error">{{ error() }}</div>
    } @else if (doctor()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ doctor()!.specialization }}</p>
          <h1>{{ doctor()!.displayName }}</h1>
          <p>{{ doctor()!.email }} · {{ doctor()!.phone || '—' }}</p>
        </div>
        <div class="head-actions">
          <span class="badge status-{{ doctor()!.status }}">{{ status(doctor()!.status) }}</span>
          @if (auth.hasPermission('Doctors.Edit') && doctor()!.status !== 3) {
            <a class="button" [routerLink]="['/doctors', id, 'edit']">{{ t('Edit', 'تعديل') }}</a>
          }
          @if (auth.hasPermission('Doctors.Archive') && doctor()!.status !== 3) {
            <button class="danger" (click)="archive()">{{ t('Archive', 'أرشفة') }}</button>
          }
        </div>
      </section>
      @if (success()) {
        <div class="alert success">{{ success() }}</div>
      }
      <nav class="tabs">
        @for (x of tabs; track x.id) {
          @if (x.id !== 'compensation' || doctor()!.canManageCompensation) {
            <button type="button" [class.active]="tab() === x.id" (click)="tab.set(x.id)">
              {{ t(x.en, x.ar) }}
            </button>
          }
        }
      </nav>
      @switch (tab()) {
        @case ('profile') {
          <div class="detail-grid">
            <section class="panel">
              <h2>{{ t('Professional profile', 'الملف المهني') }}</h2>
              <dl>
                <div>
                  <dt>{{ t('Specialization', 'التخصص') }}</dt>
                  <dd>{{ doctor()!.specialization }}</dd>
                </div>
                <div>
                  <dt>{{ t('License number', 'رقم الترخيص') }}</dt>
                  <dd class="number">{{ doctor()!.licenseNumber }}</dd>
                </div>
                <div>
                  <dt>{{ t('Consultation duration', 'مدة الاستشارة') }}</dt>
                  <dd>{{ doctor()!.consultationDurationMinutes }} {{ t('minutes', 'دقيقة') }}</dd>
                </div>
              </dl>
            </section>
            <section class="panel">
              <h2>{{ t('Biography', 'نبذة') }}</h2>
              <p class="pre">
                {{ doctor()!.bio || t('No biography recorded.', 'لا توجد نبذة مسجلة.') }}
              </p>
            </section>
          </div>
        }
        @case ('account') {
          <section class="panel">
            <h2>{{ t('Linked clinic account', 'حساب العيادة المرتبط') }}</h2>
            <dl>
              <div>
                <dt>{{ t('Name', 'الاسم') }}</dt>
                <dd>{{ doctor()!.displayName }}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{{ doctor()!.email }}</dd>
              </div>
              <div>
                <dt>{{ t('Account status', 'حالة الحساب') }}</dt>
                <dd>
                  {{
                    doctor()!.accountStatus === 2
                      ? t('Active', 'نشط')
                      : doctor()!.accountStatus === 1
                        ? t('Invited', 'مدعو')
                        : t('Inactive', 'غير نشط')
                  }}
                </dd>
              </div>
              <div>
                <dt>{{ t('Profile created', 'إنشاء الملف') }}</dt>
                <dd>{{ doctor()!.createdAt | date: 'medium' }}</dd>
              </div>
            </dl>
            @if (auth.hasPermission('Doctors.Edit') && doctor()!.status !== 3) {
              <div class="inline-actions">
                @if (doctor()!.status === 1) {
                  <button class="danger" (click)="setActive(false)">
                    {{ t('Deactivate doctor', 'إلغاء تنشيط الطبيب') }}
                  </button>
                } @else {
                  <button class="primary" (click)="setActive(true)">
                    {{ t('Activate doctor', 'تنشيط الطبيب') }}
                  </button>
                }
              </div>
            }
          </section>
        }
        @case ('schedule') {
          <section class="panel">
            <div class="section-head">
              <div>
                <h2>{{ t('Weekly schedule', 'الجدول الأسبوعي') }}</h2>
                <p>
                  {{
                    t(
                      'Recurring working periods only; no appointment booking is created.',
                      'فترات عمل أسبوعية متكررة فقط؛ لا يتم إنشاء حجوزات.'
                    )
                  }}
                </p>
              </div>
              @if (doctor()!.canManageSchedule && doctor()!.status !== 3) {
                <button type="button" (click)="addPeriod()">
                  {{ t('Add period', 'إضافة فترة') }}
                </button>
              }
            </div>
            @if (scheduleLoading()) {
              <div class="state">{{ t('Loading schedule…', 'جارٍ تحميل الجدول…') }}</div>
            } @else if (!periods().length) {
              <div class="state">
                {{ t('No working periods configured.', 'لا توجد فترات عمل محددة.') }}
              </div>
            } @else {
              <div class="schedule-list">
                @for (p of periods(); track $index; let i = $index) {
                  <article>
                    <select [(ngModel)]="p.dayOfWeek" [disabled]="!doctor()!.canManageSchedule">
                      <option [ngValue]="0">{{ t('Sunday', 'الأحد') }}</option>
                      <option [ngValue]="1">{{ t('Monday', 'الاثنين') }}</option>
                      <option [ngValue]="2">{{ t('Tuesday', 'الثلاثاء') }}</option>
                      <option [ngValue]="3">{{ t('Wednesday', 'الأربعاء') }}</option>
                      <option [ngValue]="4">{{ t('Thursday', 'الخميس') }}</option>
                      <option [ngValue]="5">{{ t('Friday', 'الجمعة') }}</option>
                      <option [ngValue]="6">{{ t('Saturday', 'السبت') }}</option></select
                    ><input
                      type="time"
                      [(ngModel)]="p.startTime"
                      [disabled]="!doctor()!.canManageSchedule"
                    /><span>→</span
                    ><input
                      type="time"
                      [(ngModel)]="p.endTime"
                      [disabled]="!doctor()!.canManageSchedule"
                    /><label
                      >{{ t('Slot', 'الموعد')
                      }}<input
                        type="number"
                        min="5"
                        [(ngModel)]="p.slotDurationMinutes"
                        [disabled]="!doctor()!.canManageSchedule"
                    /></label>
                    @if (doctor()!.canManageSchedule) {
                      <button class="icon danger" (click)="removePeriod(i)">×</button>
                    }
                    <div class="breaks">
                      @for (b of p.breaks; track $index; let j = $index) {
                        <span>{{ t('Break', 'استراحة') }}</span
                        ><input type="time" [(ngModel)]="b.startTime" /><span>→</span
                        ><input type="time" [(ngModel)]="b.endTime" /><button
                          class="icon"
                          (click)="removeBreak(i, j)"
                        >
                          ×
                        </button>
                      }
                      @if (doctor()!.canManageSchedule) {
                        <button (click)="addBreak(i)">{{ t('Add break', 'إضافة استراحة') }}</button>
                      }
                    </div>
                  </article>
                }
              </div>
            }
            @if (doctor()!.canManageSchedule && doctor()!.status !== 3) {
              <div class="form-actions">
                <button class="primary" (click)="saveSchedule()">
                  {{ t('Save schedule', 'حفظ الجدول') }}
                </button>
              </div>
            }
          </section>
        }
        @case ('compensation') {
          @if (doctor()!.canManageCompensation) {
            <div class="detail-grid">
              <section class="panel">
                <h2>{{ t('Compensation history', 'سجل التعويض') }}</h2>
                @if (!compensations().length) {
                  <p>{{ t('No compensation rules recorded.', 'لا توجد قواعد تعويض مسجلة.') }}</p>
                } @else {
                  <div class="history">
                    @for (c of compensations(); track c.id) {
                      <article>
                        <strong>{{ compType(c.compensationType) }}</strong
                        ><span
                          >{{ c.effectiveFrom }} →
                          {{ c.effectiveTo || t('Current', 'الحالي') }}</span
                        ><small>
                          @if (c.fixedAmount) {
                            {{ c.fixedAmount | number: '1.0-2' }}
                          }
                          @if (c.percentage) {
                            · {{ c.percentage }}%
                          }
                        </small>
                      </article>
                    }
                  </div>
                }
              </section>
              <section class="panel">
                <h2>
                  {{
                    compensations().length
                      ? t('Create successor rule', 'إنشاء قاعدة لاحقة')
                      : t('Create compensation rule', 'إنشاء قاعدة تعويض')
                  }}
                </h2>
                <form class="form" [formGroup]="compForm" (ngSubmit)="saveCompensation()">
                  <label
                    >{{ t('Type', 'النوع')
                    }}<select formControlName="compensationType">
                      <option [ngValue]="1">{{ t('Fixed salary', 'راتب ثابت') }}</option>
                      <option [ngValue]="2">{{ t('Percentage', 'نسبة') }}</option>
                      <option [ngValue]="3">{{ t('Fixed + percentage', 'ثابت + نسبة') }}</option>
                    </select></label
                  ><label
                    >{{ t('Fixed amount', 'المبلغ الثابت')
                    }}<input type="number" min="0" formControlName="fixedAmount" /></label
                  ><label
                    >{{ t('Percentage', 'النسبة')
                    }}<input type="number" min="0" max="100" formControlName="percentage" /></label
                  ><label
                    >{{ t('Effective from', 'ساري من')
                    }}<input type="date" formControlName="effectiveFrom" /></label
                  ><label
                    >{{ t('Effective to (optional)', 'ساري حتى (اختياري)')
                    }}<input type="date" formControlName="effectiveTo" /></label
                  ><button class="primary" [disabled]="compForm.invalid">
                    {{ t('Save new historical rule', 'حفظ قاعدة تاريخية جديدة') }}
                  </button>
                </form>
              </section>
            </div>
          }
        }
      }
    }
  `,
  styleUrl: './doctors.scss',
})
export class DoctorDetailsComponent {
  private api = inject(DoctorApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly doctor = signal<DoctorDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal(history.state.success ?? '');
  readonly tab = signal<Tab>('profile');
  readonly periods = signal<SchedulePeriod[]>([]);
  readonly compensations = signal<Compensation[]>([]);
  readonly scheduleLoading = signal(true);
  readonly tabs: { id: Tab; en: string; ar: string }[] = [
    { id: 'profile', en: 'Profile', ar: 'الملف' },
    { id: 'account', en: 'Account', ar: 'الحساب' },
    { id: 'schedule', en: 'Schedule', ar: 'الجدول' },
    { id: 'compensation', en: 'Compensation', ar: 'التعويض' },
  ];
  readonly compForm = inject(FormBuilder).nonNullable.group({
    compensationType: 1,
    fixedAmount: 0,
    percentage: 0,
    effectiveFrom: ['', Validators.required],
    effectiveTo: '',
  });
  constructor() {
    this.load();
  }
  load() {
    this.api.doctor(this.id).subscribe({
      next: (d) => {
        this.doctor.set(d);
        this.loading.set(false);
        this.loadSchedule();
        if (d.canManageCompensation) this.loadCompensation();
      },
      error: () => {
        this.error.set(
          this.t('Doctor not found or access denied.', 'الطبيب غير موجود أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  loadSchedule() {
    this.api.schedule(this.id).subscribe({
      next: (x) => {
        this.periods.set(x);
        this.scheduleLoading.set(false);
      },
      error: () => this.scheduleLoading.set(false),
    });
  }
  loadCompensation() {
    this.api
      .compensation(this.id)
      .subscribe({ next: (x) => this.compensations.set(x), error: () => this.failed() });
  }
  setActive(active: boolean) {
    if (
      !confirm(
        this.t(
          active ? 'Activate this doctor?' : 'Deactivate this doctor?',
          active ? 'تنشيط هذا الطبيب؟' : 'إلغاء تنشيط هذا الطبيب؟',
        ),
      )
    )
      return;
    this.api.status(this.id, active).subscribe({
      next: () => {
        this.success.set(this.t('Doctor status updated.', 'تم تحديث حالة الطبيب.'));
        this.load();
      },
      error: () => this.failed(),
    });
  }
  archive() {
    if (
      !confirm(
        this.t(
          'Archive this doctor profile? This cannot be reversed.',
          'أرشفة ملف الطبيب؟ لا يمكن التراجع عن ذلك.',
        ),
      )
    )
      return;
    this.api.archive(this.id).subscribe({
      next: () => {
        this.success.set(this.t('Doctor archived.', 'تمت أرشفة الطبيب.'));
        this.load();
      },
      error: () => this.failed(),
    });
  }
  addPeriod() {
    this.periods.update((x) => [
      ...x,
      { dayOfWeek: 1, startTime: '09:00', endTime: '17:00', slotDurationMinutes: 30, breaks: [] },
    ]);
  }
  removePeriod(i: number) {
    this.periods.update((x) => x.filter((_, index) => index !== i));
  }
  addBreak(i: number) {
    this.periods.update((x) =>
      x.map((p, index) =>
        index === i ? { ...p, breaks: [...p.breaks, { startTime: '13:00', endTime: '14:00' }] } : p,
      ),
    );
  }
  removeBreak(i: number, j: number) {
    this.periods.update((x) =>
      x.map((p, index) =>
        index === i ? { ...p, breaks: p.breaks.filter((_, bi) => bi !== j) } : p,
      ),
    );
  }
  saveSchedule() {
    this.api.saveSchedule(this.id, this.periods()).subscribe({
      next: () => {
        this.success.set(this.t('Schedule saved.', 'تم حفظ الجدول.'));
        this.loadSchedule();
      },
      error: () => this.failed(),
    });
  }
  saveCompensation() {
    if (this.compForm.invalid) return;
    const x = this.compForm.getRawValue();
    const value = {
      compensationType: x.compensationType,
      fixedAmount: x.fixedAmount || undefined,
      percentage: x.percentage || undefined,
      effectiveFrom: x.effectiveFrom,
      effectiveTo: x.effectiveTo || undefined,
    };
    const request = this.compensations().length
      ? this.api.changeCompensation(this.id, value)
      : this.api.createCompensation(this.id, value);
    request.subscribe({
      next: () => {
        this.success.set(
          this.t('Historical compensation rule saved.', 'تم حفظ قاعدة التعويض التاريخية.'),
        );
        this.compForm.reset({
          compensationType: 1,
          fixedAmount: 0,
          percentage: 0,
          effectiveFrom: '',
          effectiveTo: '',
        });
        this.loadCompensation();
      },
      error: () => this.failed(),
    });
  }
  failed() {
    this.error.set(
      this.t(
        'The change was rejected. Check values and permissions.',
        'تم رفض التغيير. تحقق من القيم والصلاحيات.',
      ),
    );
  }
  status(x: number) {
    return x === 1
      ? this.t('Active', 'نشط')
      : x === 2
        ? this.t('Inactive', 'غير نشط')
        : this.t('Archived', 'مؤرشف');
  }
  compType(x: number) {
    return x === 1
      ? this.t('Fixed salary', 'راتب ثابت')
      : x === 2
        ? this.t('Percentage', 'نسبة')
        : this.t('Fixed + percentage', 'ثابت + نسبة');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
