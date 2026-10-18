import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ExaminationComponent } from './examination.component';

describe('ExaminationComponent', () => {
  beforeEach(async () => {
    try { window.localStorage.removeItem('medaudit.language'); } catch {}
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
  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    for (const r of http.match('/api/patients/p1/dental')) r.flush({ patientId: 'p1', teeth: [], recentExaminations: [] });
    for (const r of http.match(r => r.url === '/api/treatments' && r.method === 'GET')) r.flush({ items: [], totalPages: 1 });
    http.verify();
  });

  it('carries different chart procedures into treatment and updates only the changed tooth', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'fill', type: 1, name: 'Regular filling', code: 'F', defaultPrice: 100, isActive: true }, { id: 'implant', type: 3, name: 'Implant', code: 'I', defaultPrice: 700, isActive: true }, { id: 'extract', type: 2, name: 'Extraction', code: 'E', defaultPrice: 200, isActive: true }]);
    c.examination.set({ ...c.examination()!, findings: [{ ...examination().findings[0], toothNumber: 35, type: 15 }, examination().findings[0]] });
    expect(c.toothService(35)).toMatchObject({ catalogId: 'implant', price: 700 });
    expect(c.toothService(36)).toMatchObject({ catalogId: 'fill', price: 100 });
    c.examination.set({ ...c.examination()!, findings: [{ ...examination().findings[0], toothNumber: 35, type: 15 }, { ...examination().findings[0], type: 14 }] });
    expect(c.toothService(36)).toMatchObject({ catalogId: 'extract', price: 200 });
    expect(c.toothService(35).catalogId).toBe('implant');
  });
  it('does not guess an ambiguous clinic service or replace a saved treatment', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'a', type: 1, name: 'Composite', code: 'A', defaultPrice: 100, isActive: true }, { id: 'b', type: 1, name: 'Amalgam', code: 'B', defaultPrice: 200, isActive: true }]);
    expect(c.toothService(36).catalogId).toBe('');
    Object.assign(c.toothService(36), { catalogId: 'b', treatmentId: 'saved', price: 200 });
    c.examination.set({ ...c.examination()!, findings: [{ ...examination().findings[0], type: 14 }] });
    expect(c.toothService(36)).toMatchObject({ catalogId: 'b', treatmentId: 'saved', price: 200 });
  });
  it('keeps diagnosis editing on the chart and financial fields after prescription', () => {
    const fixture = TestBed.createComponent(ExaminationComponent), c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'f', type: 1, name: 'Regular filling', code: 'F', defaultPrice: 100, isActive: true }]);
    c.treatmentTeeth = [36]; c.step.set(3); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.diagnoses-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('.quick-add-finding-row')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('اختر الإجراء أو الخدمة');
    expect(fixture.nativeElement.textContent).not.toContain('سعر الخدمة');
    c.step.set(5); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('سعر الخدمة');
    expect(c.findingOptions.map(x => x.id)).toEqual([2,4,8,10,11,9,14,15]);
  });
  it('shows the persisted remaining work immediately when opening the next visit', () => {
    const fixture = TestBed.createComponent(ExaminationComponent); const c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    http.expectOne(r => r.url === '/api/treatments' && r.params.get('page') === '1').flush({ items: [], totalPages: 2 });
    http.expectOne(r => r.url === '/api/treatments' && r.params.get('page') === '2').flush({ items: [{ id: 'prior', treatmentName: 'Root canal', toothNumbers: [36], status: 3, notes: 'Remaining: crown after healing', price: 500 }], totalPages: 2 });
    flushAuxiliary(http); fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.continuing-work');
    expect(panel.textContent).toContain('Remaining: crown after healing');
    expect(panel.querySelector('a').getAttribute('href')).toBe('/treatments/prior');
    expect(c.treatmentTeeth).toEqual([]);
  });
  it('shows the canal editor only for the selected root canal service and keeps unsaved values when hidden', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent); const c = fixture.componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }, { id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 400, isActive: true }]);
    c.selectedTeeth = [26]; c.treatmentTeeth = [26]; c.step.set(3);
    c.toothService(26).catalogId = 'rct'; c.selectToothService(26); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.canal-card')).toHaveLength(4);
    await fixture.whenStable();
    c.rootCanalFor(26).canals[0].lengthMm = 21;
    c.step.set(2); fixture.detectChanges();
    let serviceSelect = fixture.nativeElement.querySelector('.chart-service-settings select') as HTMLSelectElement;
    serviceSelect.value = 'fill'; serviceSelect.dispatchEvent(new Event('change')); await fixture.whenStable();
    c.step.set(3); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-root-canal-editor')).toBeNull();
    c.step.set(2); fixture.detectChanges();
    serviceSelect = fixture.nativeElement.querySelector('.chart-service-settings select') as HTMLSelectElement;
    serviceSelect.value = 'rct'; serviceSelect.dispatchEvent(new Event('change')); await fixture.whenStable();
    c.step.set(3); fixture.detectChanges();
    expect(c.rootCanalFor(26).canals[0].lengthMm).toBe(21);
    expect(c.toothService(26).status).toBe('in_progress');
  });
  it('saves the root canal stage and measurements without creating a treatment or charging again', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }]);
    c.toothService(26).catalogId = 'rct'; c.toothService(26).treatmentId = 'existing-root'; c.rootCanalFor(26).stage = 3;
    Object.assign(c.rootCanalFor(26).canals[0], { lengthMm: 21.5, finalFileSize: '25/.06' });
    const pending = c.saveRootCanal(26);
    const request = http.expectOne('/api/examinations/e1/endodontic');
    expect(request.request.body).toMatchObject({ toothNumber: 26, stage: 3, canals: [{ name: 'MB', lengthMm: 21.5, finalFileSize: '25/.06' }, { name: 'MB2', lengthMm: null }, { name: 'DB', lengthMm: null }, { name: 'P', lengthMm: null }] });
    request.flush(null); await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush(examination()); await pending;
    http.expectNone(r => r.url === '/api/treatments' && r.method === 'POST');
    expect(c.savingRootCanal()).toBe(false);
  });
  it('resumes a previous root canal in the new examination using the same treatment and prior measurements', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }]);
    const previous = { id: 'old-record', toothId: 't26', toothNumber: 26, treatmentId: 'prior', examinationId: 'old-visit', stage: 3, notes: 'Next: obturation', canals: [{ id: 'mb', name: 'MB', lengthMm: 21, finalFileSize: '25' }], createdAt: '2026-10-10', createdBy: 'u1' };
    c.patientChart.set({ patientId: 'p1', patientName: '', patientNumber: '', teeth: [], recentExaminations: [], endodonticRecords: [previous] });
    const treatment = { id: 'prior', patientId: 'p1', patientName: '', doctorProfileId: 'doc-1', doctorName: '', catalogItemId: 'rct', type: 4, treatmentName: 'RCT', status: 3, toothNumbers: [26], price: 1000, version: 'v1', createdAt: '' };
    const resume = c.resumeRootCanal(treatment); http.expectOne('/api/treatments/prior').flush(treatment); await resume;
    expect(c.rootCanalFor(26).stage).toBe(3); expect(c.rootCanalFor(26).canals[0].lengthMm).toBe(21);
    c.rootCanalFor(26).stage = 4;
    const save = c.executeToothService(26);
    const request = http.expectOne('/api/examinations/e1/endodontic');
    expect(request.request.body).toMatchObject({ toothNumber: 26, stage: 4, treatmentId: 'prior' }); request.flush(null);
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/examinations/e1').flush(examination());
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/prior').flush(treatment);
    await save; flushAuxiliary(http);
    http.expectNone(r => r.url === '/api/treatments' && r.method === 'POST');
    http.expectNone(r => r.url.includes('old-visit') || r.url.includes('old-record'));
    expect(previous.stage).toBe(3);
  });
  it('keeps entered measurements when linking a newly created root canal treatment', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }]);
    c.selectedTeeth = [26]; c.treatmentTeeth = [26]; c.toothService(26).catalogId = 'rct'; c.selectToothService(26);
    c.rootCanalFor(26).stage = 3; c.rootCanalFor(26).canals[0].lengthMm = 22;
    const pending = c.executeToothService(26); http.expectOne('/api/treatments').flush({ id: 'new-root' });
    await Promise.resolve(); await Promise.resolve();
    const record = http.expectOne('/api/examinations/e1/endodontic'); expect(record.request.body).toMatchObject({ treatmentId: 'new-root', stage: 3, canals: [{ name: 'MB', lengthMm: 22 }, {}, {}, {}] }); record.flush(null);
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/examinations/e1').flush(examination());
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/new-root').flush({ id: 'new-root', status: 1, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/new-root/start').flush(null);
    await pending; flushAuxiliary(http);
  });
  it('groups quick-booking slots into morning and evening only and paginates cards', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const slots = Array.from({ length: 12 }, (_, i) => ({ startAt: 's' + i, endAt: 'e' + i, localDate: '2026-10-18', localStartTime: i === 0 ? '09:00' : '13:00', localEndTime: '14:00', timeZone: 'Africa/Cairo' }));
    c.availableSlots.set(slots);
    expect(c.slotPeriods().morning).toHaveLength(1); expect(c.slotPeriods().evening).toHaveLength(11);
    expect(c.slotPeriods()).not.toHaveProperty('afternoon');
    expect(c.followUpSlots('evening')).toHaveLength(9); c.changeFollowUpPage('evening', 1);
    expect(c.followUpSlots('evening')).toHaveLength(2);
    c.availableSlots.set(slots.slice(1)); expect(c.slotPeriods().morning).toEqual([]);
  });
  it('offers implants per tooth and orthodontics only as a whole-mouth service', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'implant', type: 3, code: 'IMPL-01', name: 'Dental Implant', defaultPrice: 8000, isActive: true }, { id: 'ortho', type: 6, code: 'ORTHO-01', name: 'Orthodontic Treatment', defaultPrice: 15000, isActive: true }]);
    expect(c.toothServiceCatalog(36).map(x => x.id)).toEqual(['implant']);
    expect(c.toothServiceCatalog(0).map(x => x.id)).toEqual(['ortho']);
  });
  it('stores the filling class for that tooth before executing its service', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 100, isActive: true }]);
    c.selectedTeeth = [24]; c.treatmentTeeth = [24]; Object.assign(c.toothService(24), { catalogId: 'fill', price: 100, cariesClass: 2 });
    const pending = c.executeToothService(24);
    http.expectOne('/api/examinations/e1').flush(examination());
    await Promise.resolve(); await Promise.resolve();
    const finding = http.expectOne('/api/examinations/e1/findings'); expect(finding.request.body).toMatchObject({ toothNumber: 24, type: 2, cariesClass: 2 }); finding.flush(null);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush({ ...examination(), version: 'v2', findings: [...examination().findings, { ...examination().findings[0], id: 'f24', toothNumber: 24, cariesClass: 2 }] });
    await Promise.resolve(); await Promise.resolve();
    const create = http.expectOne('/api/treatments'); expect(create.request.body.notes).toContain('Class II'); expect(create.request.body.toothNumbers).toEqual([24]); create.flush({ id: 'filling' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/filling').flush({ id: 'filling', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/filling/complete').flush(null);
    await pending; flushAuxiliary(http); expect(c.examination()!.findings.find(f => f.toothNumber === 24)!.cariesClass).toBe(2);
  });
  it('records whole-mouth diagnosis in one request and keeps it out of individual tooth selection', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const pending = c.recordWholeMouthFinding(12);
    const create = http.expectOne('/api/examinations/e1/findings'); expect(create.request.body.type).toBe(12); create.flush(null);
    await Promise.resolve(); await Promise.resolve();
    const globals = Array.from({ length: 32 }, (_, index) => ({ ...examination().findings[0], id: 'global' + index, toothNumber: (Math.floor(index / 8) + 1) * 10 + index % 8 + 1, type: 12 }));
    http.expectOne('/api/examinations/e1').flush({ ...examination(), version: 'v2', findings: [...examination().findings, ...globals] });
    await pending;
    expect(c.displayedFindings().filter(f => f.type === 12)).toHaveLength(1);
    expect(c.surveyTeeth()).toEqual([36]);
  });
  it('keeps a different service and price for each tooth in the same visit', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.catalog.set([{ id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 100, isActive: true }, { id: 'crown', type: 5, name: 'Crown', code: 'C', defaultPrice: 500, isActive: true }]);
    c.selectedTeeth = [24, 36]; c.treatmentTeeth = [24, 36]; c.step.set(3);
    c.toothService(24).catalogId = 'fill'; c.selectToothService(24);
    c.toothService(36).catalogId = 'crown'; c.selectToothService(36);
    fixture.detectChanges(); expect(fixture.nativeElement.querySelectorAll('[data-tooth]').length).toBe(2);
    const pending = c.executeToothService(24);
    const create = http.expectOne('/api/treatments'); expect(create.request.body).toMatchObject({ catalogItemId: 'fill', toothNumbers: [24], price: 100 }); create.flush({ id: 'tr24' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/tr24').flush({ id: 'tr24', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/tr24/complete').flush(null);
    await pending; flushAuxiliary(http);
    expect(c.treatmentTeeth).toEqual([36]); expect(c.toothService(36)).toMatchObject({ catalogId: 'crown', price: 500 });
    expect(c.examination()!.findings).toHaveLength(1);
  });
  it('resumes an already-created service without posting another treatment', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.selectedTeeth = [36]; c.treatmentTeeth = [36];
    Object.assign(c.toothService(36), { catalogId: 'cat-1', price: 100, treatmentId: 'existing' });
    const pending = c.executeToothService(36);
    http.expectNone(r => r.method === 'POST' && r.url === '/api/treatments');
    http.expectOne('/api/treatments/existing').flush({ id: 'existing', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/existing/complete').flush(null);
    await pending; flushAuxiliary(http); expect(c.treatmentTeeth).toEqual([]);
  });
  it('bills a whole-mouth service once without requiring selected teeth', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.wholeMouthTreatment = true;
    c.catalog.set([{ id: 'cat-1', type: 6, name: 'Scaling & polishing', code: 'SP', defaultPrice: 400, isActive: true }]);
    Object.assign(c.toothService(0), { catalogId: 'cat-1', price: 400 });
    const pending = c.executeToothService(0);
    const create = http.expectOne('/api/treatments'); expect(create.request.body.toothNumbers).toHaveLength(32); expect(create.request.body.price).toBe(400); create.flush({ id: 'whole' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/whole').flush({ id: 'whole', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/whole/complete').flush(null);
    await pending; flushAuxiliary(http); expect(c.wholeMouthTreatment).toBe(false);
  });
  it('does not carry diagnosed teeth into the next quick diagnosis', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.onSelectedTeethChange([24]);
    c.chooseFindingType(2);
    const first = http.expectOne('/api/examinations/e1/findings');
    expect(first.request.body).toMatchObject({ toothNumber: 24, type: 2 });
    first.flush(null);
    await Promise.resolve(); await Promise.resolve();
    const caries = { ...examination().findings[0], id: 'f24', toothNumber: 24, type: 2 };
    const updated = { ...examination(), version: 'v2', findings: [...examination().findings, caries] };
    http.expectOne('/api/examinations/e1').flush(updated);
    await Promise.resolve(); await Promise.resolve();
    expect(c.selectedTeeth).toEqual([]);
    c.onSelectedTeethChange([25]);
    c.chooseFindingType(3);
    const second = http.expectOne('/api/examinations/e1/findings');
    expect(second.request.body).toMatchObject({ toothNumber: 25, type: 3 });
    second.flush(null);
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/examinations/e1').flush({ ...updated, version: 'v3', findings: [...updated.findings, { ...caries, id: 'f25', toothNumber: 25, type: 3 }] });
    await Promise.resolve(); await Promise.resolve();
    expect(c.examination()!.findings.find(f => f.id === 'f24')!.type).toBe(2);
    expect(c.selectedTeeth).toEqual([]);
  });

  it('shows previous patient chart in a new visit without copying findings into the draft', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush({ ...examination(), findings: [], procedures: [], endodonticRecords: [] });
    for (const request of http.match('/api/patients/p1/dental')) request.flush({ patientId: 'p1', teeth: [{ toothId: 't24', toothNumber: 24, findings: [2], procedures: [4], hasEndodonticRecord: true, treatmentProgress: [{ id: 'tr1', name: 'Root canal', type: 4, status: 4 }] }], recentExaminations: [] });
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    expect(c.chartTeeth().find(t => t.toothNumber === 24)).toMatchObject({ findings: [2], procedures: [4], hasEndodonticRecord: true });
    expect(c.surveyTeeth()).toContain(24);
    expect(c.examination()!.findings).toEqual([]);
    expect(c.treatmentTeeth).toEqual([]);
  });

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
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('مخطط الأسنان');
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
    expect(c.error()).toContain('اختر الأسنان');
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
    buttons.find(x => x.textContent?.includes('مفقود'))!.click();
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
    expect(fixture.componentInstance.error()).toContain('تم تغيير');
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
    expect(component.paymentErrorModal().message).toContain('يتجاوز');
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
    http.expectOne('/api/appointments/a1/start').flush(null);
    await pending;
    expect(component.appointment()?.status).toBe(4);
    expect(component.examination()).toBeNull();
    http.expectNone(request => request.url === '/api/appointments/a1/examination' && request.method === 'POST');
  });

  it('stops the start flow and shows a failed session start', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    component.appointment.update(value => value ? { ...value, status: 2 } : value);
    const pending = component.checkInAndStart();
    http.expectOne('/api/appointments/a1/start').flush({ detail: 'Session start failed' }, { status: 409, statusText: 'Conflict' });
    await pending;
    expect(component.error()).toContain('Session start failed');
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
  for (const r of http.match('/api/patients/p1/dental')) r.flush({ patientId: 'p1', teeth: [], recentExaminations: [] });
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
    r.flush([{ id: 'cat-1', type: 3, name: 'Implant', code: 'IM', defaultPrice: 8000, isActive: true }]);
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

