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

  it('sends the current version and reloads after adding a finding', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.componentInstance.selected = 36;
    fixture.componentInstance.addFinding();
    const request = http.expectOne('/api/examinations/e1/findings');
    expect(request.request.body.version).toBe('00000000-0000-0000-0000-000000000001');
    expect(request.request.body.toothNumber).toBe(36);
    request.flush({});
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
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
    expect(component.selectedSlot()).toBeTruthy();

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

    // Revenues check
    const revReq = http.expectOne((req) => req.url.includes('/api/finance/revenue'));
    revReq.flush({ items: [] });

    // Allow async microtasks to advance to next HTTP request
    await Promise.resolve();
    await Promise.resolve();

    // Direct payment fails with 409
    const payReq = http.expectOne('/api/finance/payments');
    payReq.flush({ detail: 'Payment exceeds the outstanding revenue amount.' }, { status: 409, statusText: 'Conflict' });

    await promise;

    expect(component.paymentErrorModal().isOpen).toBe(true);
    expect(component.paymentErrorModal().title).toBeTruthy();
    expect(component.paymentErrorModal().message).toContain('Payment exceeds');
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

