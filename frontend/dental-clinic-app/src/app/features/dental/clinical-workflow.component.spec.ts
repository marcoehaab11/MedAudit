import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ClinicalWorkflowComponent } from './clinical-workflow.component';
import { DentalChartComponent } from './dental-chart.component';

describe('Scaling and bleaching clinical sessions',()=>{
 async function load(kind:'scaling'|'bleaching',workflowJson:string|null=null){
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({imports:[ClinicalWorkflowComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
   {provide:AuthService,useValue:{hasPermission:()=>true}},
   {provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({id:'t1'}),queryParamMap:convertToParamMap({appointmentId:'a1',kind})}}}]}).compileComponents();
  const fixture=TestBed.createComponent(ClinicalWorkflowComponent);const c=fixture.componentInstance;const http=TestBed.inject(HttpTestingController);fixture.detectChanges();
  const details={treatmentId:'t1',patientId:'p1',doctorProfileId:'d1',version:'v1',workflowJson};
  http.expectOne('/api/treatments/t1/clinical-workflow').flush(details);
  http.expectOne('/api/treatments/t1').flush({id:'t1',status:3,treatmentName:kind});
  http.expectOne('/api/appointments/a1').flush({id:'a1',patientId:'p1',startAt:'2026-10-29T10:00:00Z',timeZone:'Africa/Cairo'});
  for(let i=0;i<5;i++)await Promise.resolve();http.expectOne('/api/patients/p1').flush({firstName:'Test',lastName:'Patient',patientNumber:'TEST',phone:'+201000000000'});
  for(let i=0;i<5;i++)await Promise.resolve();http.expectOne('/api/treatments/t1/clinical-files').flush([]);await fixture.whenStable();fixture.detectChanges();
  return {fixture,c,http,details};
 }
 afterEach(()=>TestBed.inject(HttpTestingController).verify());
 it('skips pocket mapping only when explicitly chosen and blocks empty quadrant selection',async()=>{
  const {c,http}=await load('scaling');Object.assign(c.data,{scope:'quadrants',quadrants:[],calculus:'mild',gingivalStatus:'healthy',pocketMapping:'no'});
  await c.next();expect(c.error()).toContain('ربع');http.expectNone('/api/treatments/t1/clinical-workflow');
  c.data.quadrants=['UR'];expect(c.visibleSteps).toEqual([0,2]);c.data.pocketMapping='yes';expect(c.visibleSteps).toEqual([0,1,2]);
 });
 it('does not increase completed sessions until the server confirms a performed session',async()=>{
  const {c,http,details}=await load('bleaching');const saving=c.save(true);await Promise.resolve();
  const request=http.expectOne('/api/treatments/t1/clinical-workflow');expect(request.request.body.performed).toBe(true);expect(c.completed).toBe(0);
  const visit={id:c.sessionId,appointmentId:'a1',performed:true,data:request.request.body.data};
  request.flush({...details,version:'v2',workflowJson:JSON.stringify({kind:'bleaching',plan:c.plan,visits:[visit]})});await saving;
  expect(c.completed).toBe(1);expect(c.details.version).toBe('v2');
 });
 it('does not complete bleaching early or increase the counter on reopening an old session',async()=>{
  const workflow={kind:'bleaching',plan:{plannedSessions:2,products:[],baselineShade:'A3'},visits:[{id:'old',appointmentId:'earlier',date:'2026-10-20',performed:true,data:{shadeAfter:'A2'}}]};
  const {c,http}=await load('bleaching',JSON.stringify(workflow));expect(c.completed).toBe(1);expect(c.plan.baselineShade).toBe('A3');
  await c.complete();http.expectNone('/api/treatments/t1/complete');expect(c.error()).toContain('كل الجلسات');
  c.openHistory('old');expect(c.readonly).toBe(true);expect(c.data.shadeAfter).toBe('A2');c.loadCurrent();expect(c.completed).toBe(1);
 });
 it('keeps data after a failed save and never treats it as a completed session',async()=>{
  const {c,http}=await load('bleaching');c.data.brand='Custom';const saving=c.save(true);await Promise.resolve();
  http.expectOne('/api/treatments/t1/clinical-workflow').flush({detail:'Check the concentration'},{status:400,statusText:'Bad request'});await saving;
  expect(c.completed).toBe(0);expect(c.data.brand).toBe('Custom');expect(c.error()).toContain('concentration');
 });
 it('keeps the baseline locked after all sessions are corrected and requires approval of changed instructions',async()=>{
  const workflow={kind:'bleaching',baselineLocked:true,plan:{plannedSessions:2,products:[],baselineShade:'A3'},visits:[{id:'corrected',appointmentId:'a1',performed:false,correctedAt:'2026-10-29T12:00:00Z',data:{instructionsText:'Old instructions',instructionsStatus:'manual-handoff'}}]};
  const {c,fixture}=await load('bleaching',JSON.stringify(workflow));expect(c.completed).toBe(0);expect(c.baselineLocked).toBe(true);
  expect(fixture.nativeElement.querySelector('.bleaching-grid select').disabled).toBe(true);
  c.consent=true;c.data.instructionsText='Reviewed text changed';c.instructionsEdited();
  expect(c.data.instructionsStatus).toBe('draft');expect(c.consent).toBe(false);
 });
 it('renders the one-page bleaching layout, template dropdown, and exactly three bottom actions',async()=>{
  const {fixture}=await load('bleaching');const root=fixture.nativeElement as HTMLElement;
  expect(root.querySelector('.clinical-stepper')).toBeNull();expect(root.querySelectorAll('footer button')).toHaveLength(3);
  expect(root.querySelector('select[aria-label="نموذج التعليمات"]')?.textContent).toContain('Standard Bleaching Instructions');
  expect(root.querySelector('.bleaching-sensitivity textarea')).not.toBeNull();
  expect(root.querySelector('button[aria-label="تسجيل جلسة تبييض منفذة"]')).not.toBeNull();
 });
 it('shows the saved approved instructions and their time independently from the edited draft',async()=>{
  const workflow={kind:'bleaching',plan:{plannedSessions:2,products:[]},visits:[{id:'session',appointmentId:'a1',performed:false,data:{instructionsText:'New draft',instructionsLanguage:'ar'},instructionApprovals:[{text:'Approved copy',language:'en',preparedAt:'2026-10-29T12:00:00Z'}]}]};
  const {fixture,c}=await load('bleaching',JSON.stringify(workflow));expect(c.data.instructionsText).toBe('New draft');
  const history=fixture.nativeElement.querySelector('.approved-instructions');expect(history.textContent).toContain('Approved copy');expect(history.textContent).toContain('2026-10-29T12:00:00Z');
  expect(history.textContent).toContain('لا يتوفر تأكيد إرسال أو وصول');
 });
 it('shows only concentrations configured for the selected product',async()=>{
  const {c}=await load('bleaching');c.plan.products=[{name:'Product A',concentrations:['Label A']},{name:'Product B',concentrations:['Label B']}];
  c.data.brand='Product A';expect(c.concentrations).toEqual(['Label A']);c.data.brand='Product B';expect(c.concentrations).toEqual(['Label B']);
 });
 it('keeps unmeasured pocket sites blank and requires explicit planned/performed treatment status',async()=>{
  const {c,http}=await load('scaling');c.pocket={tooth:16,MB:4,B:null,treatment:'chlorhexidine'};
  expect(c.maxDepth).toBe(4);await c.saveTooth();http.expectNone('/api/treatments/t1/clinical-workflow');expect(c.error()).toContain('حالة');expect(c.pocket.B).toBeNull();
 });
 it('uses primary FDI tooth numbers and the existing chart interaction for primary pocket mapping',async()=>{
  const {fixture}=await load('scaling');
  const chart=TestBed.createComponent(DentalChartComponent);chart.componentRef.setInput('primaryTeeth',true);chart.componentRef.setInput('showSearch',false);chart.detectChanges();
  const buttons=Array.from(chart.nativeElement.querySelectorAll('.planora-tooth')) as HTMLButtonElement[];expect(buttons).toHaveLength(20);
  let selected=0;chart.componentInstance.selectedNumberChange.subscribe(value=>selected=value);
  buttons.find(button=>button.getAttribute('aria-label')?.includes('#85'))!.click();expect(selected).toBe(85);fixture.detectChanges();
 });
});
