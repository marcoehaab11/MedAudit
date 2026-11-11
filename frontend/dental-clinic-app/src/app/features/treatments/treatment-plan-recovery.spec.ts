import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { TreatmentPlanDetailsComponent } from './treatment-plan-details.component';
import { TreatmentPlanFormComponent } from './treatment-plan-form.component';

const plan={id:'p1',patientId:'patient-1',patientName:'Mona',doctorProfileId:'d1',doctorName:'Dr. Sara',title:'Care plan',notes:'Keep this note',status:1,subtotal:100,total:90,discountAmount:10,version:'v1',items:[]};
describe('Treatment plan recovery and permissions',()=>{
  beforeEach(async()=>{await TestBed.configureTestingModule({imports:[TreatmentPlanDetailsComponent,TreatmentPlanFormComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({id:'p1'}),queryParamMap:convertToParamMap({})}}}]}).compileComponents();});
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  it('does not expose or dispatch transitions without the matching permission',()=>{
    const fixture=TestBed.createComponent(TreatmentPlanDetailsComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    TestBed.inject(AuthService).permissions.set(['TreatmentPlans.View']);http.expectOne('/api/treatment-plans/p1').flush(plan);expect(c.actions()).toEqual([]);c.action('propose');http.expectNone(r=>r.method==='POST');
  });
  it('prevents duplicate transitions and offers recovery after an optimistic version conflict',()=>{
    const fixture=TestBed.createComponent(TreatmentPlanDetailsComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    TestBed.inject(AuthService).permissions.set(['TreatmentPlans.View','TreatmentPlans.Propose']);http.expectOne('/api/treatment-plans/p1').flush(plan);
    c.action('propose');c.action('propose');const request=http.expectOne('/api/treatment-plans/p1/propose');expect(request.request.body.version).toBe('v1');request.flush({}, {status:409,statusText:'Conflict'});fixture.detectChanges();
    expect(c.pendingAction()).toBeNull();expect(c.versionConflict()).toBe(true);expect((fixture.nativeElement as HTMLElement).querySelector('.conflict-recovery button')).toBeTruthy();expect(c.plan()?.title).toBe('Care plan');
    c.load();http.expectOne('/api/treatment-plans/p1').flush({...plan,version:'v2'});expect(c.plan()?.version).toBe('v2');expect(c.versionConflict()).toBe(false);
  });
  it('hides an unloaded edit form and preserves the fetched values after retry',()=>{
    const fixture=TestBed.createComponent(TreatmentPlanFormComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    http.expectOne(r=>r.url==='/api/treatment-catalog').flush([]);http.expectOne('/api/treatment-plans/p1').flush({}, {status:503,statusText:'Unavailable'});fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();c.save();http.expectNone(r=>r.method==='PUT');
    c.loadPlan();http.expectOne('/api/treatment-plans/p1').flush(plan);expect(c.form.controls.notes.value).toBe('Keep this note');expect(c.form.controls.version.value).toBe('v1');expect(c.loadError()).toBe('');
  });
});
