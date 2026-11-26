import { input, output, OnChanges } from '@angular/core';
import {
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
  computed,
  ViewChild,
} from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, tap, debounceTime, startWith } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { parseApiError } from '../../core/error-util';
import { DoctorApiService, DoctorListItem } from '../doctors/doctor-api.service';
import { PatientCreateDialogComponent } from '../patients/patient-create-dialog.component';
import { AppointmentApiService, AvailabilitySlot } from './appointment-api.service';
import { appointmentType, bookableAppointmentTypes } from './appointment-labels';
import {
  TreatmentApiService,
  TreatmentPlanList,
  Treatment,
} from '../treatments/treatment-api.service';

import { PatientSelectComponent } from '../../shared/patient-select.component';
import { DoctorSelectComponent } from '../../shared/doctor-select.component';
import { DateInputComponent } from '../../shared/date-input/date-input.component';

@Component({
  styleUrls: ['./appointments.scss', './appointment-create.component.scss'],
  selector: 'app-appointment-create',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    PatientSelectComponent,
    DoctorSelectComponent,
    DateInputComponent,
    PatientCreateDialogComponent,
  ],
  templateUrl: './appointment-create.component.html',
})
export class AppointmentCreateComponent implements OnInit, OnChanges {
  private readonly api = inject(AppointmentApiService);
  private readonly doctorApi = inject(DoctorApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly cancelRoute = this.route.snapshot.queryParamMap.get('from') === 'dashboard' ? '/dashboard' : '/appointments';
  readonly embedded = input(false);
  readonly rooms = signal<import('./appointment-api.service').ClinicRoom[]>([]);
  readonly initialDate = input('');
  readonly created = output<void>();
  readonly cancelled = output<void>();

  ngOnChanges(): void {
    if (this.initialDate()) this.form.controls.date.setValue(this.initialDate());
  }
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(LocalizationService);
  readonly doctors = signal<DoctorListItem[]>([]);
  readonly slots = signal<AvailabilitySlot[]>([]);
  readonly selectedSlot = signal<AvailabilitySlot | null>(null);
  readonly timeFormat = signal<'12h' | '24h'>('12h');
  readonly selectedPeriod = signal<'all' | 'morning' | 'evening'>('all');
  private readonly slotsPerPage = 18;

  get bookingStep(): number {
    if (this.form.controls.patientId.invalid) return 1;
    if (this.form.controls.doctorProfileId.invalid) return 2;
    return this.selectedSlot() ? 4 : 3;
  }

  getSlotPeriod(slot: AvailabilitySlot): 'morning' | 'evening' {
    return Number(slot.localStartTime.slice(0, 2)) < 12 ? 'morning' : 'evening';
  }
  readonly slotPeriods = computed(() => ({
    morning: this.slots().filter((slot) => this.getSlotPeriod(slot) === 'morning'),
    evening: this.slots().filter((slot) => this.getSlotPeriod(slot) === 'evening'),
    total: this.slots().length,
  }));
  readonly slotPage = signal(0);
  readonly filteredSlots = computed(() => {
    const filter = this.selectedPeriod();
    const slots = filter === 'all' ? this.slots() : this.slotPeriods()[filter];
    return [...slots].sort((a, b) =>
      a.localStartTime.localeCompare(b.localStartTime) || a.startAt.localeCompare(b.startAt),
    );
  });
  readonly slotPageCount = computed(() => Math.ceil(this.filteredSlots().length / this.slotsPerPage));
  readonly activeSlotPage = computed(() =>
    Math.max(0, Math.min(this.slotPage(), this.slotPageCount() - 1)),
  );
  readonly pagedSlots = computed(() =>
    this.filteredSlots().slice(this.activeSlotPage() * this.slotsPerPage, (this.activeSlotPage() + 1) * this.slotsPerPage),
  );
  readonly slotsLoading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly availabilityError = signal('');
  private availabilityRequestId = 0;
  readonly types = bookableAppointmentTypes;
  readonly form = inject(FormBuilder).nonNullable.group({
    patientId: ['', Validators.required],
    doctorProfileId: ['', Validators.required],
    date: [this.today(), Validators.required],
    durationMinutes: [60, [Validators.required, Validators.min(5)]],
    isEmergency: [false],
    type: [1, Validators.required],
    roomId: '',
    notes: ['', [Validators.maxLength(2000)]],
  });
  private readonly treatmentApi = inject(TreatmentApiService);

  readonly activeTreatmentPlans = signal<TreatmentPlanList[]>([]);
  readonly activeTreatments = signal<Treatment[]>([]);
  readonly loadingTreatments = signal(false);

  @ViewChild('patientSelect') patientSelectComp?: PatientSelectComponent;
  @ViewChild(DoctorSelectComponent) doctorSelectComp?: DoctorSelectComponent;

  constructor() {
    this.api.rooms().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rooms => this.rooms.set(rooms),
      error: () => {},
    });
    const qDate = this.route.snapshot.queryParamMap.get('date');
    if (qDate) {
      this.form.controls.date.setValue(qDate);
    }
    const qDoctor = this.route.snapshot.queryParamMap.get('doctorProfileId');
    if (qDoctor) {
      this.form.controls.doctorProfileId.setValue(qDoctor);
    }
    const qPatient = this.route.snapshot.queryParamMap.get('patientId');
    if (qPatient) {
      this.form.controls.patientId.setValue(qPatient);
    }
    const qNotes = this.route.snapshot.queryParamMap.get('notes');
    if (qNotes) {
      this.form.controls.notes.setValue(qNotes);
    }
  }

  ngOnInit() {
    const fc = this.form.controls;
    fc.doctorProfileId.valueChanges
      .pipe(startWith(fc.doctorProfileId.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((id) => {
        if (!id) {
          fc.durationMinutes.setValue(60);
          return;
        }
        this.doctorApi.listAll().subscribe((doctors) => {
          if (fc.doctorProfileId.value !== id) return;
          fc.durationMinutes.setValue(
            doctors.find((d) => d.id === id)?.consultationDurationMinutes || 60,
          );
        });
      });
    // Auto-load availability when doctor, date, duration, or emergency mode changes
    combineLatest([
      fc.doctorProfileId.valueChanges.pipe(startWith(fc.doctorProfileId.value)),
      fc.date.valueChanges.pipe(startWith(fc.date.value)),
      fc.durationMinutes.valueChanges.pipe(startWith(fc.durationMinutes.value)),
      fc.isEmergency.valueChanges.pipe(startWith(fc.isEmergency.value)),
    ])
      .pipe(
        tap(() => {
          ++this.availabilityRequestId;
          this.selectedSlot.set(null);
          this.slots.set([]);
          this.availabilityError.set('');
        }),
        debounceTime(150),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.loadAvailability());

    fc.patientId.valueChanges
      .pipe(startWith(fc.patientId.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((patientId) => {
        if (patientId) {
          this.loadPatientOngoingTreatments(patientId);
        } else {
          this.activeTreatmentPlans.set([]);
          this.activeTreatments.set([]);
        }
      });
  }

  loadPatientOngoingTreatments(patientId: string) {
    this.loadingTreatments.set(true);
    this.treatmentApi.plans({ patientId, pageSize: '20' }).subscribe({
      next: (res) => {
        const active = (res.items || []).filter((p) => p.status === 1);
        this.activeTreatmentPlans.set(active);
        this.loadingTreatments.set(false);
      },
      error: () => this.loadingTreatments.set(false),
    });

    this.treatmentApi.treatments({ patientId, pageSize: '20' }).subscribe({
      next: (res) => {
        const active = (res.items || []).filter(
          (t) => t.status === 3 || t.status === 1 || t.status === 2,
        );
        this.activeTreatments.set(active);
      },
      error: () => {},
    });
  }

  remainingTreatmentsSummary(): string {
    const plans = this.activeTreatmentPlans();
    if (plans.length > 0) {
      return plans.map((p) => `${p.title} (${p.total} EGP)`).join(' · ');
    }
    const treatments = this.activeTreatments();
    if (treatments.length > 0) {
      return treatments
        .map(
          (t) =>
            `${t.treatmentName}${t.toothNumbers?.length ? ' (#' + t.toothNumbers.join(', #') + ')' : ''}`,
        )
        .join(' · ');
    }
    return '';
  }

  applyPlanToNotes(plan: TreatmentPlanList) {
    const prev = this.form.controls.notes.value || '';
    const text = this.t(
      `Session for treatment plan: ${plan.title}`,
      `جلسة متابعة لاستكمال خطة العلاج: ${plan.title}`,
    );
    this.form.controls.notes.setValue(prev ? `${prev}\n${text}` : text);
    this.form.controls.type.setValue(2);
  }

  selectCreatedPatient(id: string): void {
    this.patientSelectComp?.loadPatients();
    this.form.controls.type.setValue(1);
    this.form.controls.patientId.setValue(id);
  }

  enableEmergency() {
    this.form.controls.isEmergency.setValue(true);
  }

  loadAvailability(keepError = false) {
    const requestId = ++this.availabilityRequestId;
    this.availabilityError.set('');
    this.selectedSlot.set(null);
    if (!keepError) {
      this.error.set('');
    }
    const x = this.form.getRawValue();
    if (!x.doctorProfileId || !x.date) {
      this.slots.set([]);
      this.slotsLoading.set(false);
      return;
    }
    this.slotsLoading.set(true);
    this.api
      .availability(x.doctorProfileId, x.date, x.durationMinutes, x.isEmergency)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          if (requestId !== this.availabilityRequestId) return;
          this.slotPage.set(0);
          this.slots.set(s);
          if (!this.filteredSlots().length) this.selectedPeriod.set('all');
          this.slotsLoading.set(false);
        },
        error: (err) => {
          if (requestId !== this.availabilityRequestId) return;
          this.slots.set([]);
          this.slotsLoading.set(false);
          this.availabilityError.set(
            parseApiError(
              err,
              this.t('Availability could not be loaded.', 'تعذر تحميل الأوقات المتاحة.'),
            ),
          );
        },
      });
  }

  save() {
    if (this.saving() || this.slotsLoading()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.selectedSlot()) {
      if (!this.selectedSlot()) {
        this.error.set(
          this.t('Please choose an available appointment slot.', 'يرجى اختيار وقت متاح للموعد.'),
        );
      }
      return;
    }
    this.saving.set(true);
    this.error.set('');
    const x = this.form.getRawValue();
    this.api
      .create({
        patientId: x.patientId,
        doctorProfileId: x.doctorProfileId,
        type: x.type,
        useEmergencyAvailability: x.isEmergency || undefined,
        time: {
          date: x.date,
          startTime: this.selectedSlot()!.localStartTime,
          durationMinutes: x.durationMinutes,
        },
        notes: x.notes || undefined,
        roomId: x.roomId || undefined,
      })
      .subscribe({
        next: () => {
          if (this.embedded()) {
            this.saving.set(false);
            this.created.emit();
          } else {
            void this.router.navigate(['/appointments'], {
              queryParams: { date: x.date },
              state: { message: this.t('Appointment created.', 'تم إنشاء الموعد.') },
            });
          }
        },
        error: (e: any) => {
          this.saving.set(false);
          const conflictMsg =
            e?.status === 409
              ? this.t(
                  'This slot was just booked or is unavailable. Please choose another slot.',
                  'تم حجز هذا الموعد للتو أو أصبح غير متاح. يرجى اختيار موعد آخر.',
                )
              : parseApiError(e, this.t('Appointment could not be created.', 'تعذر إنشاء الموعد.'));
          this.error.set(conflictMsg);
          this.loadAvailability(true);
        },
      });
  }

  formatTime(timeStr: string, format: '12h' | '24h' = this.timeFormat()): string {
    if (!timeStr) return '';
    const clean = timeStr.slice(0, 5);
    if (format === '24h') return clean;
    const [hStr, mStr] = clean.split(':');
    const hour = parseInt(hStr, 10);
    const min = mStr || '00';
    const isAr = this.i18n.language() === 'ar';
    const isPm = hour >= 12;
    const period = isPm ? (isAr ? 'م' : 'PM') : isAr ? 'ص' : 'AM';
    const h12 = hour % 12 || 12;
    return `${String(h12).padStart(2, '0')}:${min} ${period}`;
  }

  formatSlotRange(slot: AvailabilitySlot, format: '12h' | '24h' = this.timeFormat()): string {
    return `${this.formatTime(slot.localStartTime, format)} – ${this.formatTime(slot.localEndTime, format)}`;
  }

  shortTime(x: string) {
    return x.slice(0, 5);
  }

  typeLabel(x: number) {
    return appointmentType(x, this.i18n.language());
  }

  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }

  today() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
