import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ImplantDetails } from './implant-api.service';
import { emptyImplantWorkflow } from './implant-fields';
import { ImplantWorkflowComponent } from './implant-workflow.component';

describe('Implant workflow persistence',()=>{
  beforeEach(async()=>{
    await TestBed.configureTestingModule({imports:[ImplantWorkflowComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),
      {provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({patientId:'p1',tooth:'36'}),queryParamMap:convertToParamMap({appointmentId:'a1',treatmentId:'t1'})}}},
      {provide:AuthService,useValue:{hasPermission:()=>true}}]}).compileComponents();
  });
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  async function load(completedStep=0) {
    const fixture=TestBed.createComponent(ImplantWorkflowComponent); fixture.detectChanges();
    const http=TestBed.inject(HttpTestingController);
    const record:ImplantDetails={id:'i1',patientId:'p1',patientName:'Test patient',patientNumber:'TEST-1',toothNumber:36,doctorProfileId:'d1',doctorName:'Doctor',treatmentId:'t1',workflow:emptyImplantWorkflow(),completedStep,version:'v1'};
    http.expectOne('/api/patients/p1/implants').flush([record]); await fixture.whenStable();
    http.expectOne('/api/implants/i1/files').flush([]); await fixture.whenStable(); fixture.detectChanges();
    return {fixture,c:fixture.componentInstance,http,record};
  }
  it('does not advance until the server confirms that the stage was saved',async()=>{
    const {fixture,c,http,record}=await load(); c.workflow.planning={imaging:'cbct',timing:'delayed',graft:'no'};
    const saving=c.save(true); const request=http.expectOne('/api/implants/i1');
    expect(request.request.body.completeStep).toBe(1); expect(c.step).toBe(0); expect(c.busy()).toBe(true);
    request.flush({...record,workflow:c.workflow,completedStep:1,version:'v2'}); await saving;fixture.detectChanges();
    expect(c.step).toBe(1);expect(c.record()?.version).toBe('v2');expect(fixture.nativeElement.textContent).toContain('زراعة الغرسة');
  });
  it('retains the entered data and current stage when saving fails',async()=>{
    const {c,http}=await load();c.workflow.planning={imaging:'cbct',timing:'delayed',graft:'no'};
    const saving=c.save(true);http.expectOne('/api/implants/i1').flush({detail:'Appointment unavailable'},{status:409,statusText:'Conflict'});await saving;
    expect(c.step).toBe(0);expect(c.workflow.planning['imaging']).toBe('cbct');expect(c.error()).toContain('تغيّر السجل');
  });
  it('saves continuing healing visits without marking healing complete',async()=>{
    const {c,http,record}=await load(2);c.data['date']='2026-12-21';Object.assign(c.data,{healingType:'submerged',status:'normal',softTissue:'healthy',mobility:'none',pain:'none',boneLevel:'stable',bleeding:'no',suppuration:'no',radiograph:'xray',nextPlan:'continue'});
    const saving=c.save(true);const request=http.expectOne('/api/implants/i1');expect(request.request.body.completeStep).toBeUndefined();
    request.flush({...record,workflow:c.workflow,version:'v2'});await saving;expect(c.step).toBe(2);expect(c.visits.length).toBe(1);
    c.addVisit();expect(c.visits.length).toBe(2);expect(c.visits[0]['date']).toBe('2026-12-21');
  });
  it('blocks temporary crown completion and an appointment before the visit',async()=>{
    const {c,http}=await load(5);Object.assign(c.data,{date:'2027-05-22',retention:'screw',seating:'temporary',occlusion:'satisfactory',stability:'stable'});
    await c.save(true);expect(c.error()).toContain('تركيب نهائي');http.expectNone('/api/implants/i1');
    c.next['send']=true;c.next['date']='2027-05-21';c.next['time']='10:00';await c.save();expect(c.error()).toContain('بعد تاريخ الزيارة');http.expectNone('/api/implants/i1');
  });
  it('renders all seven forms without dropping their headings or photo upload controls',async()=>{
    const {c,fixture}=await load(7);
    for(let step=0;step<7;step++){
      const buttons=fixture.nativeElement.querySelectorAll(step<4?'.phase-steps button':'.restoration-steps button');
      (buttons[step<4?step:step-3] as HTMLButtonElement).click();await fixture.whenStable();fixture.detectChanges();
      expect(c.step).toBe(step);expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain(c.stages[step].en);
      if(step>0)expect(fixture.nativeElement.querySelector('input[type=file]')).not.toBeNull();
    }
  });
});
