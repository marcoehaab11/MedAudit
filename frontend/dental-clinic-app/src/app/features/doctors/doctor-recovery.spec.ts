import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { DoctorDetailsComponent } from './doctor-details.component';
import { DoctorFormComponent } from './doctor-form.component';

const doctor = {id:'d1',clinicUserId:'u1',displayName:'Dr. Sara',email:'sara@example.test',specialization:'Dentistry',consultationDurationMinutes:30,status:1,accountStatus:2,canManageSchedule:true,canManageCompensation:false};
const period = {dayOfWeek:1,startTime:'09:00',endTime:'17:00',slotDurationMinutes:30,breaks:[]};

describe('Doctor management recovery', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[DoctorDetailsComponent,DoctorFormComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([]),{provide:ActivatedRoute,useValue:{snapshot:{paramMap:convertToParamMap({id:'d1'})}}}]}).compileComponents();
  });
  afterEach(()=>TestBed.inject(HttpTestingController).verify());

  it('keeps edited periods and the profile visible after a rejected save and prevents duplicate submits',()=>{
    const fixture=TestBed.createComponent(DoctorDetailsComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    http.expectOne('/api/doctors/d1').flush(doctor);http.expectOne('/api/doctors/d1/schedule').flush([period]);
    c.tab.set('schedule');c.periods()[0].startTime='10:00';c.saveSchedule();c.saveSchedule();
    const request=http.expectOne('/api/doctors/d1/schedule');expect(request.request.body.periods[0].startTime).toBe('10:00');request.flush({}, {status:403,statusText:'Forbidden'});
    fixture.detectChanges();
    expect(c.error()).toBe('');expect(c.operationError()).not.toBe('');expect(c.periods()[0].startTime).toBe('10:00');expect(c.savingSchedule()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('#doctor-section')).toBeTruthy();
  });

  it('does not create a compensation rule while its existing history could not be loaded',()=>{
    const fixture=TestBed.createComponent(DoctorDetailsComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    http.expectOne('/api/doctors/d1').flush({...doctor,canManageCompensation:true});http.expectOne('/api/doctors/d1/schedule').flush([]);http.expectOne('/api/doctors/d1/compensation').flush({}, {status:503,statusText:'Unavailable'});
    c.compForm.patchValue({effectiveFrom:'2026-11-11',fixedAmount:100});c.saveCompensation();
    http.expectNone(r=>r.method==='POST');expect(c.compensationError()).not.toBe('');expect(c.compForm.controls.fixedAmount.value).toBe(100);
  });

  it('keeps an unloaded edit profile out of the form and recovers without submitting blank data',()=>{
    const fixture=TestBed.createComponent(DoctorFormComponent),http=TestBed.inject(HttpTestingController),c=fixture.componentInstance;
    http.expectOne('/api/doctors/d1').flush({}, {status:503,statusText:'Unavailable'});fixture.detectChanges();c.save();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();http.expectNone(r=>r.method==='PUT');
    c.loadDoctor();http.expectOne('/api/doctors/d1').flush(doctor);expect(c.loadError()).toBe('');expect(c.form.controls.displayName.value).toBe('Dr. Sara');
  });
});
