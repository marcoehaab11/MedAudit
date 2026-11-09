import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth.service';
import { PatientClinicalHistoryComponent } from './patient-clinical-history.component';

describe('Patient clinical history',()=>{
  let allowed=true;
  beforeEach(async()=>{allowed=true;await TestBed.configureTestingModule({imports:[PatientClinicalHistoryComponent],providers:[provideHttpClient(),provideHttpClientTesting(),{provide:AuthService,useValue:{hasPermission:()=>allowed}}]}).compileComponents();});
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  const history={firstExaminationAt:'2026-11-09T22:15:00Z',firstExaminationDate:'2026-11-10',firstExaminationDayEn:'Tuesday',firstExaminationDayAr:'الثلاثاء',firstExaminationTime:'00:15:00',timeZone:'Africa/Cairo',page:1,pageSize:100,totalCount:1,uncertainLegacyRecords:0,
    items:[{id:'step1',toothNumbers:[36],procedureName:'Root Canal',step:'access',stepEn:'Access Cavity',stepAr:'فتح حجرة العصب',date:'2026-11-10',dayEn:'Tuesday',dayAr:'الثلاثاء',time:'00:15:05',corrected:false}]};
  it('renders clinic date, weekday and time and the performed step without showing a future stage',()=>{
    const fixture=TestBed.createComponent(PatientClinicalHistoryComponent);fixture.componentRef.setInput('patientId','p1');fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/patients/p1/clinical-history?page=1&pageSize=100').flush(history);fixture.detectChanges();
    const text=fixture.nativeElement.textContent;expect(text).toContain('2026-11-10');expect(text).toContain('الثلاثاء');expect(text).toContain('00:15:00');expect(text).toContain('فتح حجرة العصب');expect(text).not.toContain('Obturation');fixture.destroy();
  });
  it('does not query clinical records when the role lacks access',()=>{
    allowed=false;const fixture=TestBed.createComponent(PatientClinicalHistoryComponent);fixture.componentRef.setInput('patientId','p1');fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectNone(r=>r.url.includes('clinical-history'));expect(fixture.nativeElement.textContent).toContain('صلاحياتك');fixture.destroy();
  });
  it('clears previously loaded medical records if the server later refuses access',()=>{
    const fixture=TestBed.createComponent(PatientClinicalHistoryComponent);fixture.componentRef.setInput('patientId','p1');fixture.detectChanges();
    const http=TestBed.inject(HttpTestingController);http.expectOne('/api/patients/p1/clinical-history?page=1&pageSize=100').flush(history);fixture.detectChanges();expect(fixture.nativeElement.querySelector('table')).not.toBeNull();
    fixture.componentInstance.load();http.expectOne('/api/patients/p1/clinical-history?page=1&pageSize=100').flush(null,{status:403,statusText:'Forbidden'});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();expect(fixture.componentInstance.history()).toBeNull();fixture.destroy();
  });
  it('retains a corrected history entry visibly without presenting it as current execution',()=>{
    const fixture=TestBed.createComponent(PatientClinicalHistoryComponent);fixture.componentRef.setInput('patientId','p1');fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/patients/p1/clinical-history?page=1&pageSize=100').flush({...history,items:[{...history.items[0],corrected:true}]});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('tr.corrected').textContent).toContain('تم تصحيح تسجيله');fixture.destroy();
  });
});
