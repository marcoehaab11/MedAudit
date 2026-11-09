import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { ExaminationComponent } from './examination.component';

describe('ExaminationComponent', () => {
  beforeEach(async () => {
    TestBed.resetTestingModule();
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
    for (const r of http.match('/api/patients/p1')) r.flush({ id: 'p1', allergies: [], medicalConditions: [], medications: [] });
    for (const r of http.match('/api/patients/p1/dental')) r.flush({ patientId: 'p1', teeth: [], recentExaminations: [] });
    for (const r of http.match(r => r.url === '/api/treatments' && r.method === 'GET')) r.flush({ items: [], totalPages: 1 });
    http.verify();
  });

  it('shows only this visit completed flow procedures in accounting and keeps the parent in follow-up',()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    const base={patientId:'p1',patientName:'Patient',doctorProfileId:'doc',doctorName:'Doctor',treatmentName:'Procedure',toothNumbers:[26],price:200,createdAt:'',version:'v'};
    c.executedTreatments.set([{...base,id:'flow',type:4,status:3,isClinicalFlowContainer:true},{...base,id:'old-root',type:4,status:4,parentTreatmentId:'flow',appointmentId:'old-visit'},{...base,id:'current-core',type:1,status:4,parentTreatmentId:'flow',appointmentId:'a1'},{...base,id:'planned-post',type:6,status:1,parentTreatmentId:'flow'}]);
    expect(c.billableTreatments().map(t=>t.id)).toEqual(['current-core']);expect(c.todayProceduresTotal()).toBe(200);
    expect(c.getUnfinishedTreatments().map(t=>t.id)).toEqual(['flow']);
  });
  it('starts an independent root procedure without copying an older record and keeps that record unchanged', () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);
    const old={id:'old-record',toothId:'t26',toothNumber:26,treatmentId:'old-root',stage:4,restorationType:'composite' as const,notes:'Old clinical data',canals:[{id:'p',name:'P',lengthMm:23,finalFileSize:'30'}],createdAt:'',createdBy:'u1'};
    c.examination.set({...c.examination()!,endodonticRecords:[old]});
    Object.assign(c.toothService(26),{catalogId:'rct',treatmentId:'old-root',treatmentType:4,newExecutionId:'old-key'});
    expect(c.rootCanalFor(26).notes).toBe('Old clinical data');
    c.startNewToothProcedure(26);c.toothService(26).catalogId='rct';c.selectToothService(26);
    expect(c.toothService(26).treatmentId).toBeUndefined();expect(c.toothService(26).newExecutionId).toBeUndefined();
    expect(c.rootCanalFor(26).stage).toBe(1);expect(c.rootCanalFor(26).notes).not.toBe('Old clinical data');
    expect(c.examination()!.endodonticRecords[0]).toEqual(old);expect(c.treatmentTeeth).toContain(26);
  });
  it('offers filling, root canal and implant independently of the old diagnosis and invoices only completed current visit work', () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'fill',type:1,name:'Filling',code:'F',defaultPrice:100,isActive:true},{id:'root',type:4,name:'RCT',code:'R',defaultPrice:1000,isActive:true},{id:'implant',type:3,name:'Implant',code:'I',defaultPrice:3000,isActive:true}]);
    c.treatmentTeeth=[36];c.step.set(3);fixture.detectChanges();
    const select=fixture.nativeElement.querySelector('[data-tooth="36"] select') as HTMLSelectElement;
    expect(Array.from(select.options).map(x=>x.value)).toEqual(['','fill','root','implant']);
    c.executedTreatments.set([{id:'planned',status:1,type:1,appointmentId:'a1',price:100},{id:'started',status:3,type:1,appointmentId:'a1',price:100},{id:'old',status:4,type:1,appointmentId:'old',price:100},{id:'first',status:4,type:1,appointmentId:'a1',price:100},{id:'repeat',status:4,type:1,appointmentId:'a1',price:100}] as any);
    expect(c.billableTreatments().map(x=>x.id)).toEqual(['first','repeat']);expect(c.todayProceduresTotal()).toBe(200);
  });
  it('retries a failed save with the same execution ID and uses a fresh ID for a deliberate repeat', async () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    const choose=()=>{c.catalog.set([{id:'fill',type:1,name:'Filling',code:'F',defaultPrice:100,isActive:true}]);c.selectedTeeth=[36];c.treatmentTeeth=[36];Object.assign(c.toothService(36),{catalogId:'fill',cariesClass:2,price:100});};
    choose();let saving=c.executeToothService(36);let post=http.expectOne('/api/treatments');const key=post.request.body.newExecutionId;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);post.flush({message:'Connection lost'}, {status:500,statusText:'Error'});await saving;flushAuxiliary(http);
    choose();saving=c.executeToothService(36);post=http.expectOne('/api/treatments');expect(post.request.body.newExecutionId).toBe(key);post.flush({id:'first'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/first').flush({id:'first',status:2,version:'v1'});
    await Promise.resolve();await Promise.resolve();const complete=http.expectOne('/api/treatments/first/complete');expect(complete.request.body.appointmentId).toBe('a1');complete.flush(null);
    await saving;flushAuxiliary(http);expect(c.availableTreatmentTeeth()).toContain(36);
    choose();saving=c.executeToothService(36);post=http.expectOne('/api/treatments');expect(post.request.body.newExecutionId).not.toBe(key);
    post.flush({message:'Connection lost'}, {status:500,statusText:'Error'});await saving;flushAuxiliary(http);
  });
  it.each([{type:12,id:'scale',name:'Scaling',kind:'scaling'},{type:13,id:'white',name:'Whitening',kind:'bleaching'},{type:16,id:'ortho',name:'Orthodontics',kind:null},{type:18,id:'denture',name:'Removable dentures',kind:null}])('starts $name from the procedure page without selecting a tooth and opens only its existing page',async({type,id,name,kind})=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.examination.set({...c.examination()!,findings:[]});c.catalog.set([{id,type:6,name,code:id,defaultPrice:100,isActive:true}]);c.selectedTeeth=[];c.treatmentTeeth=[];c.step.set(3);
    const navigate=vi.spyOn(TestBed.inject(Router),'navigate').mockResolvedValue(true);
    c.toggleWholeMouthProcedure(type);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.whole-mouth-panel')).not.toBeNull();expect(c.treatmentRowKeys()).toContain(-type);
    expect(fixture.nativeElement.querySelector('[data-tooth="-'+type+'"] .btn-execute-procedure-modern').textContent).toContain('ابدأ العلاج');
    http.expectNone('/api/examinations/e1/findings');const saving=c.executeToothService(-type);
    const create=http.expectOne('/api/treatments');expect(create.request.body.toothNumbers).toEqual([]);expect(create.request.body.catalogItemId).toBe(id);create.flush({id:'work-'+id});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/work-'+id).flush({id:'work-'+id,status:2,version:'v1'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/work-'+id+'/start').flush(null);
    await saving;flushAuxiliary(http);http.expectNone('/api/treatments/work-'+id+'/complete');
    if(kind)expect(navigate).toHaveBeenCalledWith(['/treatments','work-'+id,'clinical'],{queryParams:{appointmentId:'a1',kind}});
    else expect(navigate).toHaveBeenCalledWith(['/treatments','work-'+id],{queryParams:{appointmentId:'a1'}});
    expect(c.selectedTeeth).toEqual([]);expect(c.treatmentTeeth).toEqual([]);
  });
  it('records caries removal only and never completes a composite filling just because it was the default material',async()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'fill',type:1,name:'Filling',code:'F',defaultPrice:100,isActive:true}]);c.selectedTeeth=[36];c.treatmentTeeth=[36];
    Object.assign(c.toothService(36),{catalogId:'fill',cariesClass:2,cariesRemoved:true,fillingMaterial:'Composite',status:'completed'});
    const saving=c.executeToothService(36);const create=http.expectOne('/api/treatments');expect(create.request.body.executedStep).toBe('caries-removal');create.flush({id:'prep'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/prep').flush({id:'prep',status:2,version:'v1'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/prep/start').flush(null);await saving;flushAuxiliary(http);
    http.expectNone('/api/treatments/prep/complete');expect(c.recentlyCompletedTeeth()).not.toContain(36);
  });
  it('never routes a root canal service into whole-mouth scaling merely because its name contains cleaning',()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'root',type:4,name:'Root canal cleaning',code:'RCT',defaultPrice:900,isActive:true},{id:'scale',type:6,name:'Scaling and cleaning',code:'SCALE',defaultPrice:100,isActive:true}]);
    expect(c.toothServiceCatalog(-12).map(x=>x.id)).toEqual(['scale']);expect(c.toothServiceCatalog(36).map(x=>x.id)).toContain('root');
  });
  it('blocks ending a visit while clinical progress has an unresolved save error',async()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);c.rootCanalAutoErrors.set([26]);
    await c.completeVisit();expect(c.step()).toBe(3);http.expectNone(r=>r.url.endsWith('/complete')&&r.method==='POST');
  });

  it('keeps six reception steps and saves the existing clinical notes without adding intake fields', () => {
    const fixture = TestBed.createComponent(ExaminationComponent), c = fixture.componentInstance, http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.showMedicalAlertModal.set(false); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.visit-stepper-nav .step-node').length).toBe(6);
    expect(el.querySelector('.intake-workspace')).not.toBeNull();
    expect(el.querySelector('.intake-history-item summary')?.textContent).toContain('الحساسيات');
    c.notesForm.setValue({ notes: 'Existing clinical complaint' });
    (el.querySelector('.intake-complaint-panel') as HTMLFormElement).dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne(r => r.url === '/api/examinations/e1' && r.method === 'PUT');
    expect(request.request.body).toEqual({ notes: 'Existing clinical complaint', version: examination().version }); request.flush(null);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
  });
  it('approves the doctor price before prescription using the current treatment version', async () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const work={id:'pending',patientId:'p1',patientName:'Patient',doctorProfileId:'d1',doctorName:'Doctor',treatmentName:'Filling',type:1,toothNumbers:[24],appointmentId:'a1',status:4,price:200,priceConfirmed:false,createdAt:'',version:'old'};
    c.executedTreatments.set([work]); c.step.set(4); fixture.detectChanges();
    expect(c.hasPendingVisitPrices()).toBe(true); expect(c.steps[3].ar).toContain('الحساب'); expect(c.steps[4].ar).toContain('الروشتة');
    c.visitPrices['pending']=450; const pending=c.confirmVisitPrice(work);
    http.expectOne('/api/treatments/pending').flush({...work,version:'current'});
    await Promise.resolve(); await Promise.resolve();
    const approve=http.expectOne('/api/treatments/pending/price'); expect(approve.request.body).toEqual({price:450,version:'current'}); approve.flush(null);
    await pending; flushAuxiliary(http);
    expect(c.success()).toContain('اعتماد السعر'); http.expectNone(r=>r.method==='POST'&&r.url==='/api/treatments');
  });
  it('sends unfinished visit prices back to accounting instead of ending the visit', async () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.executedTreatments.set([{id:'pending',patientId:'p1',patientName:'Patient',doctorProfileId:'d1',doctorName:'Doctor',treatmentName:'Filling',type:1,toothNumbers:[24],appointmentId:'a1',status:4,price:200,priceConfirmed:false,createdAt:'',version:'v'}]);
    await c.completeVisit(); expect(c.step()).toBe(4); flushAuxiliary(http);
    http.expectNone(r=>r.url.endsWith('/complete')&&r.method==='POST');
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
  it('keeps a tooth root canal service when a later whole-mouth orthodontic finding exists', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }]);
    c.examination.set({ ...c.examination()!, findings: [{ ...examination().findings[0], type: 8 }, { ...examination().findings[0], id: 'ortho', type: 16 }] });
    expect(c.toothService(36).catalogId).toBe('rct');
  });
  it('preserves chart root-and-crown intent when the billing service has a different name', () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'root',type:4,name:'حشو عصب وعلاج جذور',code:'RCT',defaultPrice:1500,isActive:true}]);
    c.examination.set({...c.examination()!,endodonticRecords:[],findings:[{...examination().findings[0],toothNumber:46,type:10}]});
    c.treatmentTeeth=[46];c.step.set(3);fixture.detectChanges();
    expect(c.toothService(46).catalogId).toBe('root');
    expect(c.treatmentSummaryLabels(46)).toEqual(['علاج جذور وكراون']);
    expect(c.rootCanalFor(46).restorationType).toBe('crown');
    expect(fixture.nativeElement.querySelector('.selected-treatment-badge').textContent).toContain('كراون');
    c.toothService(46).treatmentName='Generic root canal';
    expect(c.treatmentSummaryLabels(46)).toEqual(['علاج جذور وكراون']);
  });
  it('keeps the chart restoration variant independent of catalogue wording for every root option', () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'root',type:4,name:'Root canal post and crown',code:'RCT',defaultPrice:1500,isActive:true}]);
    for(const [type,mode] of [[8,'composite'],[10,'crown'],[11,'post-core-crown'],[17,'post-core']] as const){
      c.examination.set({...c.examination()!,endodonticRecords:[],findings:[{...examination().findings[0],toothNumber:46,type}]});
      c.toothService(46);expect(c.rootCanalFor(46).restorationType).toBe(mode);
      expect(c.treatmentSummaryLabels(46)).toEqual([c.findingLabel(type)]);
    }
  });

  it('opens combined root canal details with a single differently named clinic root service', () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{id:'root',type:4,name:'حشو عصب',code:'RCT',defaultPrice:1500,isActive:true}]);
    c.examination.set({...c.examination()!,findings:[{...examination().findings[0],toothNumber:45,type:10},{...examination().findings[0],id:'f46',toothNumber:46,type:10}]});
    c.treatmentTeeth=[45,46];c.step.set(3);fixture.detectChanges();
    expect(c.toothService(45).catalogId).toBe('root');expect(c.toothService(46).catalogId).toBe('root');
    expect(fixture.nativeElement.querySelectorAll('app-root-canal-editor').length).toBe(2);
    expect(fixture.nativeElement.textContent).not.toContain('حدد الخدمة من مخطط الأسنان');
  });
  it('offers a usable per-tooth service choice when the clinic has multiple matching services', () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'a',type:4,name:'Anterior RCT',code:'A',defaultPrice:900,isActive:true},{id:'b',type:4,name:'Molar RCT',code:'B',defaultPrice:1500,isActive:true},{id:'f',type:1,name:'Filling',code:'F',defaultPrice:200,isActive:true}]);
    c.examination.set({...c.examination()!,findings:[{...examination().findings[0],type:10}]});c.treatmentTeeth=[36];c.step.set(3);fixture.detectChanges();
    const select=fixture.nativeElement.querySelector('[data-tooth="36"] select') as HTMLSelectElement;
    expect(Array.from(select.options).map(x=>x.value)).toEqual(['','a','b','f']);
    select.value='b';select.dispatchEvent(new Event('change'));fixture.detectChanges();
    expect(c.toothService(36).catalogId).toBe('b');expect(fixture.nativeElement.querySelector('app-root-canal-editor')).not.toBeNull();
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
  it('keeps diagnosis editing on the chart and places accounting before prescription', () => {
    const fixture = TestBed.createComponent(ExaminationComponent), c = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'f', type: 1, name: 'Regular filling', code: 'F', defaultPrice: 100, isActive: true }]);
    c.treatmentTeeth = [36]; c.step.set(3); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.diagnoses-section')).toBeNull();
    expect(fixture.nativeElement.querySelector('.quick-add-finding-row')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('اختر الإجراء أو الخدمة');
    expect(fixture.nativeElement.textContent).not.toContain('سعر الخدمة');
    c.step.set(4); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('سعر الخدمة');
    expect(c.findingOptions.map(x => x.id)).toEqual([2,4,8,10,11,9,14,15,17]);
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
    expect(panel.querySelector('a').getAttribute('href')).toBe('/treatments/prior?appointmentId=a1');
    expect(c.treatmentTeeth).toEqual([]);
  });
  it('shows the canal editor only for the selected root canal service and keeps unsaved values when hidden', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent); const c = fixture.componentInstance; const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'rct', type: 4, name: 'RCT', code: 'RCT', defaultPrice: 1000, isActive: true }, { id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 400, isActive: true }]);
    c.selectedTeeth = [26]; c.treatmentTeeth = [26]; c.step.set(3);
    c.toothService(26).catalogId = 'rct'; c.selectToothService(26); c.rootCanalFor(26).stage = 2; fixture.detectChanges();
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
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);
    Object.assign(c.toothService(26),{catalogId:'rct',treatmentId:'existing-root'});Object.assign(c.rootCanalFor(26).canals[0],{lengthMm:21.5,finalFileSize:'25/.06'});
    const pending=c.saveRootCanal(26);const request=await rootFlowResponse(http,26,2,'existing-root');
    expect(request.request.body.treatmentId).toBe('existing-root');expect(request.request.body.canals[0]).toMatchObject({name:'MB',lengthMm:21.5,finalFileSize:'25/.06'});
    await pending;flushAuxiliary(http);http.expectNone(r=>r.url==='/api/treatments'&&r.method==='POST');expect(c.savingRootCanal()).toBe(false);
  });
  it('automatically saves measurements before recording a treatment and serializes later edits', async () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);c.toothService(26).catalogId='rct';
    const draft=c.rootCanalFor(26);draft.stage=2;draft.canals[0].lengthMm=21;
    const first=c.autoSaveRootCanal(26);const firstRequest=http.expectOne('/api/examinations/e1/root-flow/26');expect(firstRequest.request.body.treatmentId).toBeUndefined();
    draft.canals[0].lengthMm=22;const second=c.autoSaveRootCanal(26);http.expectNone('/api/examinations/e1/root-flow/26');
    firstRequest.flush({treatmentId:'new-root',stage:2,examinationVersion:'v2',workflowJson:JSON.stringify({...JSON.parse(firstRequest.request.body.workflowJson),flowVersion:2,revision:'r1'})});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/examinations/e1').flush({...examination(),version:'v2'});await first;await Promise.resolve();await Promise.resolve();
    const update=await rootFlowResponse(http,26,2,'new-root');expect(update.request.body.version).toBe('v2');expect(update.request.body.treatmentId).toBe('new-root');expect(update.request.body.canals[0].lengthMm).toBe(22);
    await second;flushAuxiliary(http);expect(c.rootCanalAutoErrors()).toEqual([]);http.expectNone(r=>r.url==='/api/treatments'&&r.method==='POST');
  });
  it('automatically completes the existing root canal after the fourth step without a new charge', async () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);c.treatmentTeeth=[36];
    Object.assign(c.toothService(36),{catalogId:'rct',treatmentId:'existing-root',treatmentType:4,status:'in_progress'});
    const pending=c.saveRootCanal(36);await rootFlowResponse(http,36,6,'existing-root');await pending;flushAuxiliary(http);
    expect(c.toothService(36).status).toBe('completed');http.expectNone(r=>r.url.endsWith('/complete')&&r.method==='POST');
    expect(c.availableTreatmentTeeth()).toContain(36);
  });
  it('opens saved root canal from the continuation button inside the visit instead of linking to treatments', async () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    const treatment={id:'prior',patientId:'p1',patientName:'Patient',doctorProfileId:'doc',doctorName:'Doctor',catalogItemId:'rct',type:4,treatmentName:'RCT',status:3,toothNumbers:[26],price:1000,version:'v',createdAt:''};
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);
    c.patientChart.set({patientId:'p1',patientName:'Patient',patientNumber:'P1',teeth:[],recentExaminations:[],endodonticRecords:[{id:'record',toothId:'t26',toothNumber:26,treatmentId:'prior',stage:4,restorationType:'crown',notes:'Saved note',canals:[{id:'p',name:'P',lengthMm:23,finalFileSize:'30'}],createdAt:'',createdBy:'u1'}]});
    c.executedTreatments.set([treatment]);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.continuing-work a[href="/treatments/prior"]')).toBeNull();
    fixture.nativeElement.querySelector('.resume-saved-treatment').click();
    http.expectOne('/api/treatments/prior').flush(treatment);await fixture.whenStable();fixture.detectChanges();
    expect(c.step()).toBe(3);expect(c.treatmentTeeth).toContain(26);expect(c.toothService(26).treatmentId).toBe('prior');
    expect(c.rootCanalFor(26)).toMatchObject({stage:4,restorationType:'crown',notes:'Saved note'});
    expect(c.rootCanalFor(26).canals.find(x=>x.name==='P')).toMatchObject({lengthMm:23,finalFileSize:'30'});
    expect(fixture.nativeElement.querySelector('[data-tooth="26"] .current-stage').textContent).toContain('Obturation');
    http.expectNone(r=>r.url==='/api/treatments'&&r.method==='POST');
  });

  it('resumes a previous root canal in the new examination using the same treatment and prior measurements', async () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);
    const previous={id:'old-record',toothId:'t26',toothNumber:26,treatmentId:'prior',examinationId:'old-visit',stage:3,notes:'Continue',canals:[{id:'mb',name:'MB',lengthMm:21,finalFileSize:'25'}],createdAt:'2026-10-10',createdBy:'u1'};
    c.patientChart.set({patientId:'p1',patientName:'',patientNumber:'',teeth:[],recentExaminations:[],endodonticRecords:[previous]});
    const treatment={id:'prior',patientId:'p1',patientName:'',doctorProfileId:'doc-1',doctorName:'',catalogItemId:'rct',type:4,treatmentName:'RCT',status:3,toothNumbers:[26],price:1000,version:'v1',createdAt:''};
    const resume=c.resumeRootCanal(treatment);http.expectOne('/api/treatments/prior').flush(treatment);await resume;expect(c.rootCanalFor(26).canals[0].lengthMm).toBe(21);
    const pending=c.executeToothService(26);const request=await rootFlowResponse(http,26,4,'prior');expect(request.request.body.treatmentId).toBe('prior');await pending;flushAuxiliary(http);
    http.expectNone(r=>r.url.includes('old-visit')||r.url.includes('old-record'));expect(previous.stage).toBe(3);
  });
  it('keeps entered measurements when linking a newly created root canal treatment', async () => {
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'rct',type:4,name:'RCT',code:'RCT',defaultPrice:1000,isActive:true}]);c.selectedTeeth=[26];c.treatmentTeeth=[26];c.toothService(26).catalogId='rct';
    c.rootCanalFor(26).canals[0].lengthMm=22;const pending=c.executeToothService(26);const request=await rootFlowResponse(http,26,2,'new-root');
    expect(request.request.body.canals[0].lengthMm).toBe(22);expect(request.request.body.treatmentId).toBeUndefined();await pending;flushAuxiliary(http);
    expect(c.rootCanalFor(26).canals[0].lengthMm).toBe(22);expect(c.toothService(26).treatmentId).toBe('new-root');http.expectNone(r=>r.url==='/api/treatments'&&r.method==='POST');
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
  it('saves extraction details for the selected tooth and validates impacted direction', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'extract', type: 2, name: 'Extraction', code: 'E', defaultPrice: 100, isActive: true }]);
    c.treatmentTeeth = [36]; Object.assign(c.toothService(36), { catalogId: 'extract', price: 100, notes: 'Clinical note' });
    Object.assign(c.extractionFor(36), { type: 'Surgical Extraction', condition: 'Impacted', direction: null });
    await c.executeToothService(36); expect(c.error()).toContain('اتجاه الضرس'); http.expectNone('/api/treatments');
    c.extractionFor(36).direction = 'Horizontal';
    const pending = c.executeToothService(36);
    const create = http.expectOne('/api/treatments'); expect(create.request.body.toothNumbers).toEqual([36]);
    expect(create.request.body.notes).toContain('Surgical Extraction — Impacted — Horizontal');
    expect(create.request.body.notes).toContain('Clinical note'); create.flush({ id: 'extraction' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/extraction').flush({ id: 'extraction', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/extraction/complete').flush(null);
    await pending; flushAuxiliary(http);
    c.toothService(36).catalogId = 'extract'; Object.assign(c.extractionFor(36), { condition: 'Normal', direction: 'Horizontal' });
    expect(c.extractionSummary(36)).not.toContain('Horizontal');
  });
  it('carries each whole-mouth finding into its own procedure and bills it once', async()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'clean',code:'SCALE',name:'Scaling and polishing',type:6,defaultPrice:200,isActive:true},{id:'white',code:'WHITE',name:'Whitening',type:6,defaultPrice:500,isActive:true},{id:'ortho',code:'ORTHO',name:'Orthodontics',type:6,defaultPrice:1000,isActive:true},{id:'dentures',code:'DENTURE',name:'Removable dentures',type:6,defaultPrice:1500,isActive:true}]);
    c.examination.set({...examination(),findings:[12,13,16,18].map(type=>({...examination().findings[0],type,toothNumber:11}))});
    expect(c.treatmentRowKeys()).toEqual([-12,-13,-16,-18]);
    expect(c.toothService(-12).catalogId).toBe('clean');expect(c.toothService(-13).catalogId).toBe('white');expect(c.toothService(-16).catalogId).toBe('ortho');
    expect(c.toothService(-18).catalogId).toBe('dentures');
    expect(c.sidebarToothFindings()).toEqual([]);
    expect(c.matchingToothServices(-13).map(x=>x.id)).toEqual(['white']);
    const pending=c.executeToothService(-12,false);const create=http.expectOne('/api/treatments');expect(create.request.body.toothNumbers.length).toBe(0);expect(create.request.body.price).toBe(200);create.flush({id:'clean-work'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/clean-work').flush({id:'clean-work',status:2,version:'v1'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/clean-work/start').flush(null);
    await pending;flushAuxiliary(http);expect(c.treatmentRowKeys()).toEqual([-13,-16,-18]);expect(c.recentlyCompletedTeeth()).toEqual([]);
  });
  it('allows another procedure on a completed tooth without deleting its history',()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.treatmentTeeth=[36];c.selectedTeeth=[36];c.executedTreatments.set([{id:'done',appointmentId:'a1',toothNumbers:[36],status:4} as any]);
    expect(c.surveyTeeth()).toContain(36);expect(c.availableTreatmentTeeth()).toContain(36);
    c.treatmentTeeth=[];c.toggleTreatmentTooth(36);expect(c.treatmentTeeth).toEqual([36]);
    c.step.set(3);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.today-teeth-picker').textContent).toContain('#36');
  });
  it('allows previously completed teeth in a new visit after history is reloaded',()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.treatmentTeeth=[36];c.selectedTeeth=[36];c.loadTreatmentHistory('p1');
    http.expectOne(r=>r.url==='/api/treatments' && r.method==='GET').flush({items:[{id:'previous-done',appointmentId:'previous-visit',toothNumbers:[36],status:4,completedAt:'2026-08-16T10:00:00Z'}],totalPages:1});
    expect(c.recentlyCompletedTeeth()).toEqual([]);expect(c.surveyTeeth()).toContain(36);
    expect(c.availableTreatmentTeeth()).toContain(36);expect(c.treatmentTeeth).toContain(36);
    c.step.set(3);fixture.detectChanges();expect(fixture.nativeElement.querySelector('.today-teeth-picker').textContent).toContain('#36');
  });
  it('keeps teeth available regardless of completed, unfinished or cancelled history',()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.patientChart.set({patientId:'p1',patientName:'Mona',patientNumber:'P-1',recentExaminations:[],teeth:[{toothId:'t36',toothNumber:36,findings:[2],procedures:[1],hasEndodonticRecord:false,treatmentProgress:[{id:'done',name:'Filling',type:1,status:4,completedAt:'2026-08-16T10:00:00Z'}]}]});
    expect(c.availableTreatmentTeeth()).toContain(36);
    c.executedTreatments.set([{id:'unfinished',appointmentId:'previous-visit',toothNumbers:[36],status:3} as any]);
    expect(c.availableTreatmentTeeth()).toContain(36);
    c.executedTreatments.set([{id:'cancelled',appointmentId:'previous-visit',toothNumbers:[36],status:5} as any]);
    expect(c.availableTreatmentTeeth()).toContain(36);
  });
  it('allows a new diagnosis after completion without reviving older copied findings or whole-mouth work',()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.executedTreatments.set([{id:'done',appointmentId:'previous-visit',toothNumbers:[36],status:4,completedAt:'2026-08-16T10:00:00Z'} as any]);
    c.examination.update(exam=>({...exam!,findings:exam!.findings.map(f=>({...f,createdAt:'2026-08-15T10:00:00Z'}))}));
    expect(c.availableTreatmentTeeth()).toContain(36);
    c.examination.update(exam=>({...exam!,findings:exam!.findings.map(f=>({...f,createdAt:'2026-08-17T10:00:00Z'}))}));
    expect(c.availableTreatmentTeeth()).toContain(36);
    c.executedTreatments.set([{id:'mouth',appointmentId:'previous-visit',toothNumbers:Array.from({length:4},(_,q)=>Array.from({length:8},(_,i)=>(q+1)*10+i+1)).flat(),status:4} as any]);
    c.patientChart.set({patientId:'p1',patientName:'Mona',patientNumber:'P-1',recentExaminations:[],teeth:[{toothId:'t36',toothNumber:36,findings:[2],procedures:[],hasEndodonticRecord:false,treatmentProgress:[{id:'mouth',name:'Scaling',type:6,status:4}]}]});
    expect(c.availableTreatmentTeeth()).toContain(36);
  });
  it('hides treatment status for extraction and keeps caries choices on the chart only',()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'extract',code:'E',name:'Extraction',type:2,defaultPrice:100,isActive:true}]);
    c.examination.set({...examination(),findings:[{...examination().findings[0],type:14}]});c.treatmentTeeth=[36];c.step.set(3);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-extraction-editor')).not.toBeNull();expect(fixture.nativeElement.textContent).not.toContain('حالة العلاج');expect(fixture.nativeElement.textContent).not.toContain('اختيار نوع التسوس');
  });
  it('requires a valid filling class and material and keeps each tooth draft independent', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent), c = fixture.componentInstance, http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{id:'fill',type:1,name:'Filling',code:'F',defaultPrice:100,isActive:true}]);
    c.examination.set({...examination(),findings:[24,36].map(toothNumber=>({...examination().findings[0],id:'f'+toothNumber,toothNumber,type:2,cariesClass:null}))});
    c.treatmentTeeth=[24,36]; c.step.set(3);
    await c.executeToothService(24); expect(c.error()).toContain('كلاس الحشو'); http.expectNone('/api/treatments');
    Object.assign(c.toothService(24),{cariesClass:6,fillingMaterial:'Amalgam'});
    expect(c.toothService(36).cariesClass).toBeNull(); expect(c.toothService(36).fillingMaterial).toBe('Composite');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[data-tooth="24"] .filling-class-grid input')).toHaveLength(6);
    expect(fixture.nativeElement.querySelectorAll('[data-tooth="24"] .filling-material-grid input')).toHaveLength(4);
    c.toothService(24).fillingMaterial='invalid'; await c.executeToothService(24); http.expectNone('/api/treatments');
  });
  it('records temporary filling as unfinished even if the draft was marked complete and restores it next visit',async()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'fill',code:'F',name:'Filling',type:1,defaultPrice:100,isActive:true}]);
    c.selectedTeeth=[36];c.treatmentTeeth=[36];Object.assign(c.toothService(36),{catalogId:'fill',cariesClass:2,fillingMaterial:'Temporary',status:'completed'});
    const saving=c.executeToothService(36);const create=http.expectOne('/api/treatments');
    expect(create.request.body.notes).toContain('Filling material: Temporary');expect(create.request.body.notes).toContain('متبقي:');create.flush({id:'temporary'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/temporary').flush({id:'temporary',status:2,version:'v1'});
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/temporary/start').flush(null);http.expectNone('/api/treatments/temporary/complete');
    await saving;flushAuxiliary(http);expect(c.recentlyCompletedTeeth()).not.toContain(36);
    c.executedTreatments.set([{id:'temporary',appointmentId:'earlier-visit',catalogItemId:'fill',type:1,treatmentName:'Filling',toothNumbers:[36],price:100,status:3,notes:'Filling material: Temporary · Class II · (متبقي: حشو دائم)'} as any]);
    expect(c.availableTreatmentTeeth()).toContain(36);
    expect(c.toothService(36).treatmentId).toBeUndefined();
    const resume=c.resumeFilling(c.executedTreatments()[0]);http.expectOne('/api/treatments/temporary').flush({...c.executedTreatments()[0],patientId:'p1',version:'v1'});await resume;
    expect(c.toothService(36)).toMatchObject({treatmentId:'temporary',fillingMaterial:'Temporary',cariesClass:2,status:'in_progress',price:100});
  });
  it('replaces temporary material and completes the same saved filling without creating or charging another treatment',async()=>{
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'fill',code:'F',name:'Filling',type:1,defaultPrice:500,isActive:true}]);
    const original={id:'temporary',patientId:'p1',appointmentId:'earlier-visit',catalogItemId:'fill',type:1,treatmentName:'Filling',toothNumbers:[36],price:100,status:3,notes:'Filling material: Temporary · Class II · (متبقي: حشو دائم)',version:'v1'};
    c.executedTreatments.set([original as any]);c.selectedTeeth=[36];c.treatmentTeeth=[36];
    expect(c.toothService(36).treatmentId).toBeUndefined();
    const opening=c.resumeFilling(original as any);http.expectOne('/api/treatments/temporary').flush(original);await opening;
    c.step.set(3);fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.filling-editor input[type=radio]:disabled')).toBeNull();
    expect(c.toothService(36).treatmentId).toBe('temporary');c.toothService(36).fillingMaterial='Composite';c.fillingMaterialChanged(36);
    const saving=c.executeToothService(36);http.expectOne('/api/treatments/temporary').flush(original);
    await Promise.resolve();await Promise.resolve();const update=http.expectOne(r=>r.method==='PUT' && r.url==='/api/treatments/temporary');
    expect(update.request.body.notes).toContain('Filling material: Composite');expect(update.request.body.notes).not.toContain('Temporary');expect(update.request.body).not.toHaveProperty('price');update.flush(null);
    await Promise.resolve();await Promise.resolve();http.expectOne('/api/treatments/temporary').flush({...original,notes:'Filling material: Composite · Class II',version:'v2'});
    await Promise.resolve();await Promise.resolve();const complete=http.expectOne('/api/treatments/temporary/complete');expect(complete.request.body.version).toBe('v2');complete.flush(null);
    http.expectNone(r=>r.method==='POST' && r.url==='/api/treatments');await saving;flushAuxiliary(http);expect(c.recentlyCompletedTeeth()).toContain(36);
  });
  it('routes a standalone crown through a crown-only workflow and retains pending root restorations',()=>{
    const c=TestBed.createComponent(ExaminationComponent).componentInstance,http=TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());flushAuxiliary(http);
    c.catalog.set([{id:'crown',code:'C',name:'Crown',type:5,defaultPrice:500,isActive:true}]);
    c.examination.set({...examination(),findings:[{...examination().findings[0],type:9}]});c.treatmentTeeth=[36];
    expect(c.toothServiceIsRootCanal(36)).toBe(true);const crown=c.rootCanalFor(36);expect(crown.restorationType).toBe('crown-only');expect(crown.stage).toBe(8);expect(crown.canals).toEqual([]);expect(c.validRootCanal(36)).toBe(true);
  });
  it('uses the chart filling classification without rewriting it from procedures', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.catalog.set([{ id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 100, isActive: true }]);
    c.selectedTeeth = [24]; c.treatmentTeeth = [24]; Object.assign(c.toothService(24), { catalogId: 'fill', price: 100, cariesClass: 2, fillingMaterial: 'Glass Ionomer' });
    c.examination.set({...examination(),findings:[{...examination().findings[0],toothNumber:24,cariesClass:2}]});
    c.toothService(24).fillingMaterial = 'Glass Ionomer';
    const pending = c.executeToothService(24);
    http.expectNone(r=>r.url==='/api/examinations/e1/findings');
    const create = http.expectOne('/api/treatments'); expect(create.request.body.notes).toContain('Class II'); expect(create.request.body.notes).toContain('Filling material: Glass Ionomer'); expect(create.request.body.toothNumbers).toEqual([24]); create.flush({ id: 'filling' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/filling').flush({ id: 'filling', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/filling/complete').flush(null);
    await pending; flushAuxiliary(http); expect(c.examination()!.findings.find(f => f.toothNumber === 24)!.cariesClass).toBe(2);
    expect(c.treatmentTeeth).not.toContain(24);expect(c.selectedTeeth).not.toContain(24);expect(c.availableTreatmentTeeth()).toContain(24);expect(c.recentlyCompletedTeeth()).toContain(24);
  });
  it.each([12, 13, 16])('records whole-mouth diagnosis %s in one request and keeps it out of individual tooth selection', async (type) => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const pending = c.recordWholeMouthFinding(type);
    const create = http.expectOne('/api/examinations/e1/findings'); expect(create.request.body.type).toBe(type); create.flush(null);
    await Promise.resolve(); await Promise.resolve();
    const globals = Array.from({ length: 32 }, (_, index) => ({ ...examination().findings[0], id: 'global' + index, toothNumber: (Math.floor(index / 8) + 1) * 10 + index % 8 + 1, type }));
    http.expectOne('/api/examinations/e1').flush({ ...examination(), version: 'v2', findings: [...examination().findings, ...globals] });
    await pending;
    expect(c.displayedFindings().filter(f => f.type === type)).toHaveLength(1);
    expect(c.surveyTeeth()).toEqual([36]);
  });
  it('keeps a different service and price for each tooth in the same visit', async () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.catalog.set([{ id: 'fill', type: 1, name: 'Filling', code: 'F', defaultPrice: 100, isActive: true }, { id: 'crown', type: 5, name: 'Crown', code: 'C', defaultPrice: 500, isActive: true }]);
    c.selectedTeeth = [24, 36]; c.treatmentTeeth = [24, 36]; c.step.set(3);
    c.toothService(24).catalogId = 'fill'; c.selectToothService(24); c.toothService(24).cariesClass = 1;
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
  it('starts a whole-mouth service without tooth associations or an automatic completed charge', async () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.wholeMouthTreatment = true;
    c.catalog.set([{ id: 'cat-1', type: 6, name: 'Scaling & polishing', code: 'SP', defaultPrice: 400, isActive: true }]);
    Object.assign(c.toothService(0), { catalogId: 'cat-1', price: 400 });
    const pending = c.executeToothService(0,false);
    const create = http.expectOne('/api/treatments'); expect(create.request.body.toothNumbers).toHaveLength(0); expect(create.request.body.price).toBe(400); create.flush({ id: 'whole' });
    await Promise.resolve(); await Promise.resolve();
    http.expectOne('/api/treatments/whole').flush({ id: 'whole', status: 2, version: 'v1' });
    await Promise.resolve(); await Promise.resolve(); http.expectOne('/api/treatments/whole/start').flush(null);
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

  it('loads the examination and initializes the 6-step clinical flow', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.steps).toHaveLength(6);
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
    buttons.find(x => x.textContent?.includes('خلع'))!.click();
    const req = http.expectOne('/api/examinations/e1/findings');
    expect(req.request.body).toMatchObject({ toothNumber: 36, type: 14, cariesClass: null, surfaces: [] });
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

  it('offers all six classes for every tooth and mixed selections', () => {
    const fixture = TestBed.createComponent(ExaminationComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination());
    flushAuxiliary(http);
    const c = fixture.componentInstance;
    c.selectedTeeth = [11]; expect(c.availableCariesClasses()).toEqual([1, 2, 3, 4, 5, 6]);
    c.selectedTeeth = [36]; expect(c.availableCariesClasses()).toEqual([1, 2, 3, 4, 5, 6]);
    c.selectedTeeth = [11, 36]; expect(c.availableCariesClasses()).toEqual([1, 2, 3, 4, 5, 6]);
    c.findingTargetTeeth = [11]; expect(c.availableCariesClasses()).toEqual([1, 2, 3, 4, 5, 6]);
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

  it('refreshes reception medical changes on returning to an already open doctor visit', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    expect(c.hasMedicalAlerts()).toBe(false);
    c.refreshMedicalHistoryOnFocus();
    http.expectOne('/api/patients/p1').flush({ id: 'p1', canViewMedicalInformation: true, allergies: [{name:'Latex'}], medicalConditions: [{name:'Diabetes'}], medications: [] });
    expect(c.patientAllergies).toEqual(['Latex']); expect(c.patientConditions).toEqual(['Diabetes']);
    expect(c.showMedicalAlertModal()).toBe(true);
    c.closeMedicalAlertModal();
    c.refreshMedicalHistoryOnFocus();
    http.expectOne('/api/patients/p1').flush({ id: 'p1', allergies: [{name:'Latex'}], medicalConditions: [{name:'Diabetes'}], medications: [] });
    expect(c.showMedicalAlertModal()).toBe(false);
    c.loadPatient('p1');
    http.expectOne('/api/patients/p1').flush({ id: 'p1', allergies: [{name:'Penicillin'}], medicalConditions: [{name:'Diabetes'}], medications: [] });
    expect(c.patientAllergies).toEqual(['Penicillin']); expect(c.showMedicalAlertModal()).toBe(true);
  });

  it('reports failed medical refresh without erasing the previous warnings and allows retry', () => {
    const c = TestBed.createComponent(ExaminationComponent).componentInstance;
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/appointments/a1/examination').flush(examination()); flushAuxiliary(http);
    c.patientAllergies = ['Latex'];
    c.refreshMedicalHistoryOnFocus();
    http.expectOne('/api/patients/p1').flush({}, {status:503,statusText:'Unavailable'});
    expect(c.medicalHistoryError()).toContain('تعذر تحديث'); expect(c.patientAllergies).toEqual(['Latex']);
    c.refreshMedicalHistoryOnFocus();
    http.expectOne('/api/patients/p1').flush({id:'p1',canViewMedicalInformation:false,allergies:[],medicalConditions:[],medications:[]});
    expect(c.medicalHistoryError()).toContain('صلاحية');
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
    component.setStep(6);
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
    component.setStep(6);
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

  it('opens a checked-in patient for the doctor without requiring another start click', async () => {
    const fixture=TestBed.createComponent(ExaminationComponent),c=fixture.componentInstance,http=TestBed.inject(HttpTestingController);
    const auth=(c as any).auth;const original=auth.hasPermission;auth.hasPermission=(permission:string)=>['Appointments.Start','Examination.Create'].includes(permission);
    http.expectOne('/api/appointments/a1/examination').flush({}, {status:404,statusText:'Not found'});
    http.expectOne('/api/appointments/a1').flush({id:'a1',patientId:'p1',status:3});
    http.expectOne('/api/appointments/a1/start').flush(null);
    await Promise.resolve();await Promise.resolve();
    http.expectOne(r=>r.method==='POST'&&r.url==='/api/appointments/a1/examination').flush({id:'e1'});
    http.expectOne('/api/examinations/e1').flush(examination());flushAuxiliary(http);
    expect(c.examination()?.id).toBe('e1');expect(c.startingGate()).toBe(false);auth.hasPermission=original;
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
    component.setStep(5);
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


async function rootFlowResponse(http:HttpTestingController,tooth:number,stage:number,treatmentId:string){
 const request=http.expectOne(`/api/examinations/e1/root-flow/${tooth}`);
 request.flush({treatmentId,stage,examinationVersion:'v2',workflowJson:JSON.stringify({...JSON.parse(request.request.body.workflowJson),flowVersion:2,revision:'saved-revision'})});
 await Promise.resolve();await Promise.resolve();http.expectOne('/api/examinations/e1').flush({...examination(),version:'v2'});return request;
}
