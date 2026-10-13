import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ExaminationComponent } from './examination.component';

describe('ExaminationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExaminationComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ appointmentId: 'a1' }) } },
        },
      ],
    }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('loads the examination and initializes the 5-step clinical flow', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.steps).toHaveLength(5);
    expect(component.steps[0].number).toBe(1);
    expect(component.steps[1].number).toBe(2);
    expect(component.steps[2].number).toBe(3);
    expect(component.steps[3].number).toBe(4);
    expect(component.steps[4].number).toBe(5);
    component.setStep(2);
    flushAuxiliary(http);
    component.selected = 36;
    fixture.detectChanges();
    expect(component.selectedFindings()).toHaveLength(1);
    expect(component.selectedProcedures()).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Dental Chart');
  }, 15000);

  it('sends the current version and reloads after adding a finding', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.componentInstance.selected = 36;
    const saving = fixture.componentInstance.addFinding();
    const request = http.expectOne('/api/examinations/e1/findings');
    expect(request.request.body.version).toBe('00000000-0000-0000-0000-000000000001');
    expect(request.request.body.toothNumber).toBe(36);
    request.flush({});
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush(examination());
    await saving;
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
  });

  it('starts with no selected tooth and blocks treatment until selection', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    expect(c.selected).toBe(0);
    expect(c.selectedTeeth).toEqual([]);
    c.selectedCatalogId = 'cat-1';
    c.recordTreatmentExecution();
    http.expectNone('/api/treatments');
    expect(c.error()).toContain('Select teeth');
  });

  it('saves classification on multiple teeth using the latest examination version', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.onSelectedTeethChange([24, 25]);
    c.findingForm.controls.cariesClass.setValue(2);
    const saving = c.addFinding();
    const first = http.expectOne('/api/examinations/e1/findings');
    expect(first.request.body).toMatchObject({ toothNumber: 24, type: 2, cariesClass: 2, surfaces: [] });
    first.flush(null);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush({ ...examination(), version: 'v2' });
    await Promise.resolve(); await Promise.resolve();
    const second = http.expectOne('/api/examinations/e1/findings');
    expect(second.request.body).toMatchObject({ toothNumber: 25, version: 'v2', cariesClass: 2 });
    second.flush(null);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush({ ...examination(), version: 'v3' });
    await saving;
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    expect(c.savingFinding()).toBe(false);
  });

  it('shows classes only for caries and clears class when finding changes', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.setStep(2); flushAuxiliary(http);
    c.onSelectedTeethChange([36]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[formControlName="cariesClass"]')).toBeTruthy();
    c.findingForm.controls.cariesClass.setValue(6);
    c.findingForm.controls.type.setValue(3);
    fixture.detectChanges();
    expect(c.findingForm.controls.cariesClass.value).toBeNull();
    expect(fixture.nativeElement.querySelector('[formControlName="cariesClass"]')).toBeNull();
  });

  it('records missing through the chart menu without turning it into healthy', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.setStep(2); flushAuxiliary(http);
    c.onSelectedTeethChange([36]);
    fixture.detectChanges();
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.chart-quick-findings button'));
    buttons.find(x => x.textContent?.includes('Missing'))!.click();
    const req = http.expectOne('/api/examinations/e1/findings');
    expect(req.request.body).toMatchObject({ toothNumber: 36, type: 4, cariesClass: null, surfaces: [] });
    req.flush(null);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush(examination());
    await Promise.resolve(); await Promise.resolve();
    flushAuxiliary(http);
    c.setStep(3); flushAuxiliary(http);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-dental-chart')).toBeNull();
  });

  it('resolves doctor profile from appointment and exposes availability failures', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.appointment.set(null);
    c.loadAvailabilitySlots('2026-10-20');
    http.expectOne('/api/appointments/a1').flush({ id: 'a1', doctorProfileId: 'doc-1' });
    const req = http.expectOne(r => r.url === '/api/appointments/availability');
    expect(req.request.params.get('doctorProfileId')).toBe('doc-1');
    req.flush({}, { status: 500, statusText: 'Server Error' });
    expect(c.loadingSlots()).toBe(false);
    expect(c.bookingError()).toContain('server error');
  });

  it("uses the doctor preferred duration for follow-up", () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.appointment.set(null);
    c.loadAvailabilitySlots('2026-10-20');
    http.expectOne('/api/appointments/a1').flush({ id: 'a1', doctorProfileId: 'doc-1', durationMinutes: 30, suggestedDurationMinutes: 20 });
    const req = http.expectOne(r => r.url === '/api/appointments/availability');
    expect(req.request.params.get('durationMinutes')).toBe('20');
    req.flush([]);
    c.changeFollowUpDuration(40);
    const changed = http.expectOne(r => r.url === '/api/appointments/availability');
    expect(changed.request.params.get('durationMinutes')).toBe('40');
    changed.flush([]);
  });

  it('ignores stale slot responses after the follow-up date changes', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.loadAvailabilitySlots('2026-10-20');
    const old = http.expectOne(r => r.url === '/api/appointments/availability');
    c.loadAvailabilitySlots('2026-10-21');
    const current = http.expectOne(r => r.url === '/api/appointments/availability');
    current.flush([]);
    old.flush([{ localDate: '2026-10-20', localStartTime: '09:00' }]);
    expect(c.availableSlots()).toEqual([]);
    expect(c.suggestedFollowUpDate).toBe('2026-10-21');
  });

  it('limits treatment to today teeth while preserving surveyed teeth', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.selectedTeeth = [24, 25, 36];
    c.treatmentUnitPrice = 100;
    c.toggleTreatmentTooth(25);
    expect(c.treatmentTeeth).toEqual([25]);
    expect(c.selectedTeeth).toEqual([24, 25, 36]);
    expect(c.treatmentPrice).toBe(100);
    c.toggleTreatmentTooth(36);
    expect(c.treatmentPrice).toBe(200);
    c.toggleTreatmentTooth(25);
    expect(c.treatmentTeeth).toEqual([36]);
  });

  it('offers only common allowed classes when anterior and posterior teeth are selected', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.selectedTeeth = [11]; expect(c.availableCariesClasses()).toEqual([3, 4, 5, 6]);
    c.selectedTeeth = [36]; expect(c.availableCariesClasses()).toEqual([6, 1, 2, 5]);
    c.selectedTeeth = [11, 36]; expect(c.availableCariesClasses()).toEqual([5, 6]);
    c.findingTargetTeeth = [11]; expect(c.availableCariesClasses()).toEqual([3, 4, 5, 6]);
  });

  it('saves caries immediately then updates its classification without creating a duplicate', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.setStep(2); flushAuxiliary(http);
    c.chooseToothFinding({ toothNumber: 24, type: 2 });
    const create = http.expectOne('/api/examinations/e1/findings');
    expect(create.request.body).toMatchObject({ toothNumber: 24, type: 2, cariesClass: null });
    create.flush(null);
    await Promise.resolve(); await Promise.resolve();
    const finding = { ...examination().findings[0], id: 'f24', toothNumber: 24, surfaces: [], notes: '' };
    const updated = { ...examination(), version: 'v2', findings: [...examination().findings, finding] };
    http.expectOne('/api/examinations/e1').flush(updated);
    await Promise.resolve(); await Promise.resolve();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('button[aria-label*="#24"] .planora-art')!.innerHTML).toContain('#fb923c');
    c.findingForm.controls.cariesClass.setValue(2);
    const save = c.addFinding();
    const update = http.expectOne('/api/examinations/e1/findings/f24');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toMatchObject({ toothNumber: 24, cariesClass: 2, version: 'v2' });
    http.expectNone(r => r.url === '/api/examinations/e1/findings' && r.method === 'POST');
    update.flush(null);
    await Promise.resolve(); await Promise.resolve();
    const classified = { ...updated, version: 'v3', findings: updated.findings.map(x => x.id === 'f24' ? { ...x, cariesClass: 2 } : x) };
    http.expectOne('/api/examinations/e1').flush(classified);
    await save;
    http.expectOne('/api/appointments/a1/examination').flush(classified); flushAuxiliary(http);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Class II');
    expect(c.examination()!.findings).toHaveLength(2);
    expect(c.findingEditorOpen).toBe(false);
  });

  it('quick diagnosis in treatment step applies only to today teeth', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.selectedTeeth = [24, 25, 36]; c.treatmentTeeth = [25];
    c.quickAddFinding(8);
    const request = http.expectOne('/api/examinations/e1/findings');
    expect(request.request.body.toothNumber).toBe(25);
    expect(request.request.body.type).toBe(8);
    request.flush({}, { status: 409, statusText: 'Conflict' });
  });

  it('shows actionable conflict feedback after a stale draft write', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.componentInstance.saveNotes();
    http.expectOne('/api/examinations/e1').flush({}, { status: 409, statusText: 'Conflict' });
    expect(fixture.componentInstance.error()).toContain('changed');
  });

  it('opens medical alert modal automatically when patient has allergies or conditions', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    
    const patientReq = http.expectOne('/api/patients/p1');
    patientReq.flush({
      id: 'p1',
      patientNumber: 'P-1',
      firstName: 'Mona',
      lastName: 'Hassan',
      allergies: [{ id: 'al1', name: 'Penicillin' }],
      medicalConditions: [{ id: 'mc1', name: 'Diabetes' }],
      medications: [],
    });
    const apptReq = http.match('/api/appointments/a1');
    if (apptReq.length) apptReq[0].flush({ id: 'a1', status: 4, patientId: 'p1' });
    const balReq = http.match('/api/finance/patients/p1/balance');
    if (balReq.length) balReq[0].flush({ patientId: 'p1', totalBilled: 0, totalPaid: 0, outstanding: 0 });

    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.hasMedicalAlerts()).toBe(true);
    expect(component.totalAlertsCount()).toBe(2);
    expect(component.showMedicalAlertModal()).toBe(true);

    component.closeMedicalAlertModal();
    expect(component.showMedicalAlertModal()).toBe(false);

    component.openMedicalAlertModal();
    expect(component.showMedicalAlertModal()).toBe(true);
  });

  it('records treatment with In Progress status (بدأ العلاج ولسه هنكمل) and calls start action', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.setStep(3);
    flushAuxiliary(http);
    component.selectedTeeth = [24, 25];
    component.treatmentTeeth = [24, 25];
    component.selectedCatalogId = 'cat-1';
    component.clinicalStatus = 'in_progress';
    component.remainingWorkDescription = 'Crown fitting';

    component.recordTreatmentExecution();

    const createReq = http.expectOne('/api/treatments');
    expect(createReq.request.body.toothNumbers).toEqual([24, 25]);
    expect(createReq.request.body.notes).toContain('Crown fitting');
    createReq.flush({ id: 'tr-123' });

    const getReq = http.expectOne('/api/treatments/tr-123');
    getReq.flush({ id: 'tr-123', version: 'v1' });

    const actionReq = http.expectOne('/api/treatments/tr-123/start');
    expect(actionReq.request.method).toBe('POST');
    actionReq.flush({});

    flushAuxiliary(http);
  });

  it('loads availability slots and books appointment directly in Step 5', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.setStep(5);
    flushAuxiliary(http);

    const availReq = http.match((req) => req.url.includes('/api/appointments/availability'));
    if (availReq.length) {
      availReq[0].flush([
        {
          startAt: '2026-09-10T09:00:00Z',
          endAt: '2026-09-10T09:30:00Z',
          localDate: '2026-09-10',
          localStartTime: '09:00',
          localEndTime: '09:30',
          timeZone: 'UTC',
        },
      ]);
    }

    expect(component.availableSlots().length).toBeGreaterThanOrEqual(1);
    expect(component.selectedSlot()).toBeNull();
    component.selectedSlot.set(component.availableSlots()[0]);

    component.suggestedFollowUpNotes = 'Crown fitting';
    component.bookAppointmentNow();

    const bookReq = http.expectOne('/api/appointments');
    expect(bookReq.request.body.patientId).toBe('p1');
    expect(bookReq.request.body.time.startTime).toBe('09:00');
    expect(bookReq.request.body.notes).toBe('Crown fitting');
    bookReq.flush({ id: 'new-appt-1' });

    expect(component.bookedAppointment()).toBeTruthy();
    expect(component.bookedAppointment()?.id).toBe('new-appt-1');
  });

  it('triggers paymentErrorModal with clear Arabic message when payment collection fails', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.setStep(5);
    flushAuxiliary(http);

    const availReq = http.match((req) => req.url.includes('/api/appointments/availability'));
    for (const r of availReq) {
      r.flush([]);
    }

    component.paymentAmount = 500;
    const promise = component.recordPayment();

    http.expectOne('/api/finance/patients/p1/balance').flush({ outstanding: 500 });
    await Promise.resolve();
    await Promise.resolve();

    // Revenues check
    const revReq = http.expectOne((req) => req.url.includes('/api/finance/revenue'));
    revReq.flush({ items: [{ id: 'rev1', outstanding: 500 }], totalPages: 1 });

    // Allow async microtasks to advance to next HTTP request
    await Promise.resolve();
    await Promise.resolve();

    // Direct payment fails with 409
    const payReq = http.expectOne('/api/finance/payments');
    payReq.flush({ detail: 'Payment exceeds the outstanding revenue amount.' }, { status: 409, statusText: 'Conflict' });

    await promise;
    flushAuxiliary(http);

    expect(component.paymentErrorModal().isOpen).toBe(true);
    expect(component.paymentErrorModal().title).toBeTruthy();
    expect(component.paymentErrorModal().message).toContain('Payment exceeds');
  });

  it('starts a reception appointment without creating a clinical record', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const component = fixture.componentInstance;
    component.auth.permissions.set(['Examination.View', 'Appointments.Start', 'Appointments.CheckIn']);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne('/api/appointments/a1').flush({ id: 'a1', status: 2, patientId: 'p1' });
    flushAuxiliary(http);
    const pending = component.checkInAndStart();
    http.expectOne('/api/appointments/a1/check-in').flush(null);
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/appointments/a1/start').flush(null);
    await pending;
    expect(component.appointment()?.status).toBe(4);
    expect(component.examination()).toBeNull();
    http.expectNone(request => request.url === '/api/appointments/a1/examination' && request.method === 'POST');
  });

  it('stops the start flow and shows a failed check-in', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    component.appointment.update(value => value ? { ...value, status: 2 } : value);
    const pending = component.checkInAndStart();
    http.expectOne('/api/appointments/a1/check-in').flush({ detail: 'Check-in failed' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(component.error()).toContain('Check-in failed');
    http.expectNone('/api/appointments/a1/start');
  });

  it('uses the posted balance once and refreshes it after a recorded payment', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    component.balance.set({ patientId: 'p1', totalRevenue: 500, totalPaid: 0, outstanding: 500, currency: 'EGP' });
    component.executedTreatments.set([{ price: 500 } as any]);
    expect(component.totalDue()).toBe(500);
    component.paymentAmount = 200;
    const pending = component.recordPayment();
    http.expectOne('/api/finance/patients/p1/balance').flush({ outstanding: 500 });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(request => request.url.includes('/api/finance/revenue')).flush({ items: [{ id: 'rev1', outstanding: 500 }], totalPages: 1 });
    await Promise.resolve();
    await Promise.resolve();
    const payment = http.expectOne('/api/finance/payments');
    expect(payment.request.body.revenueId).toBe('rev1');
    expect(payment.request.body.amount).toBe(200);
    payment.flush({ id: 'pay1' });
    await pending;
    http.expectOne('/api/finance/patients/p1/balance').flush({ outstanding: 300 });
    expect(component.totalDue()).toBe(300);
    expect(component.paymentRecorded()).toBe(200);
    expect(component.paymentAmount).toBe(0);
  });

  it('allows selecting medications from presets and auto-fills dosage and instructions', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.setStep(4);
    flushAuxiliary(http);
    fixture.detectChanges();

    // Check that dental presets are available
    expect(component.quickDentalPresets.length).toBeGreaterThan(0);
    const augmentin = component.quickDentalPresets[0];

    // Click quick preset chip
    component.addMedicationPreset(augmentin);
    fixture.detectChanges();

    // The first row should now have the preset data
    const expectedName = component.t(augmentin.nameEn || augmentin.name, augmentin.nameAr || augmentin.name);
    expect(component.prescriptionItems[0].medicationName).toBe(expectedName);
    expect(component.prescriptionItems[0].dose).toBe(augmentin.dose);
    expect(component.prescriptionItems[0].frequency).toBe(augmentin.frequency);
    expect(component.prescriptionItems[0].duration).toBe(augmentin.duration);
    expect(component.prescriptionItems[0].instructions).toBe(augmentin.instructions);
  });
});

function flushAuxiliary(http: HttpTestingController) {
  const patientReq = http.match('/api/patients/p1');
  for (const r of patientReq) {
    r.flush({
      id: 'p1',
      patientNumber: 'P-1',
      firstName: 'Mona',
      lastName: 'Hassan',
      allergies: [],
      medicalConditions: [],
      medications: [],
    });
  }
  const apptReq = http.match('/api/appointments/a1');
  for (const r of apptReq) {
    r.flush({ id: 'a1', status: 4, patientId: 'p1', doctorProfileId: 'doc-1' });
  }
  const balReq = http.match('/api/finance/patients/p1/balance');
  for (const r of balReq) {
    r.flush({ patientId: 'p1', totalBilled: 0, totalPaid: 0, outstanding: 0 });
  }
  const catReq = http.match('/api/treatment-catalog?includeInactive=false');
  for (const r of catReq) {
    r.flush([{ id: 'cat-1', name: 'Implant', defaultPrice: 8000, active: true }]);
  }
  const trReq = http.match((req) => req.url.includes('/api/treatments') && req.method === 'GET');
  for (const r of trReq) {
    r.flush({ page: { items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 1 } });
  }
  const plansReq = http.match((req) => req.url.includes('/api/treatment-plans') && req.method === 'GET');
  for (const r of plansReq) {
    r.flush({ page: { items: [], page: 1, pageSize: 50, totalCount: 0, totalPages: 1 } });
  }
  const medReq = http.match((req) => req.url.includes('/api/medications') && req.method === 'GET');
  for (const r of medReq) {
    r.flush({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 1 });
  }
}


function examination() {
  return {
    id: 'e1',
    patientId: 'p1',
    patientName: 'Mona Hassan',
    patientNumber: 'P-1',
    appointmentId: 'a1',
    appointmentStatus: 4,
    doctorUserId: 'u1',
    doctorName: 'Dr Sara',
    status: 1,
    notes: 'draft',
    createdAt: '2026-08-17T06:00:00Z',
    updatedAt: '2026-08-17T06:00:00Z',
    version: '00000000-0000-0000-0000-000000000001',
    canEdit: true,
    canComplete: true,
    findings: [
      {
        id: 'f1',
        toothId: 't36',
        toothNumber: 36,
        type: 2,
        surfaces: [2, 4],
        notes: 'Caries',
        createdAt: '',
        createdBy: 'u1',
      },
    ],
    procedures: [
      {
        id: 'p1',
        toothId: 't36',
        toothNumber: 36,
        type: 1,
        surfaces: [2, 4],
        notes: 'Filling',
        createdAt: '',
        createdBy: 'u1',
      },
    ],
    endodonticRecords: [
      {
        id: 'r1',
        toothId: 't36',
        toothNumber: 36,
        notes: 'Endo',
        createdAt: '',
        createdBy: 'u1',
        canals: [{ id: 'c1', name: 'MB', lengthMm: 21 }],
      },
    ],
  };
}

