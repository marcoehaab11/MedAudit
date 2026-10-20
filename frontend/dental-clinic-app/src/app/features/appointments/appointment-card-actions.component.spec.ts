import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/auth.service';
import { AppointmentCardActionsComponent } from './appointment-card-actions.component';
describe('AppointmentCardActionsComponent',()=>{
  beforeEach(async()=>{await TestBed.configureTestingModule({imports:[AppointmentCardActionsComponent],providers:[provideRouter([]),{provide:AuthService,useValue:{hasPermission:()=>true}}]}).compileComponents();vi.useFakeTimers();vi.setSystemTime(new Date('2030-01-02T10:00:00Z'));});
  afterEach(()=>vi.useRealTimers());
  const item=(status:number,date='2030-01-02')=>({id:'a1',patientId:'p1',patientName:'Patient',doctorProfileId:'d1',doctorName:'Doctor',type:1,status,startAt:date+'T12:00:00Z',endAt:date+'T13:00:00Z',durationMinutes:60,timeZone:'Africa/Cairo'});
  it('shows attendance only after booking confirmation on the appointment day',()=>{
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(2));f.detectChanges();
    expect(Array.from(f.nativeElement.querySelectorAll('.primary-actions button')).map((b:any)=>b.textContent.trim())).toEqual(['حضر','لم يحضر']);
    expect(f.nativeElement.querySelector('.primary-actions a')).toBeNull();expect(f.nativeElement.querySelector('.secondary-actions button').textContent).toContain('إلغاء');
    const listener=vi.fn();f.componentInstance.action.subscribe(listener);f.nativeElement.querySelector('.primary-actions button').click();expect(listener).toHaveBeenCalledWith('check-in');
  });
  it('offers confirm and cancel before the appointment without attendance buttons',()=>{
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(1,'2030-01-03'));f.detectChanges();
    expect(Array.from(f.nativeElement.querySelectorAll('.primary-actions button')).map((b:any)=>b.textContent.trim())).toEqual(['تأكيد الحجز','إلغاء الحجز']);
  });
  it('opens checked-in visits and continues started visits without another start action',()=>{
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(3));f.detectChanges();
    expect(f.nativeElement.querySelector('.primary-actions a').textContent).toContain('فتح الزيارة');expect(f.nativeElement.querySelector('.primary-actions a').getAttribute('href')).toBe('/appointments/a1/visit');
    f.componentRef.setInput('appointment',item(4));f.detectChanges();expect(f.nativeElement.querySelector('.primary-actions a').textContent).toContain('متابعة الزيارة');expect(f.nativeElement.querySelector('button')).toBeNull();
  });
  it('requires confirmation first even on the appointment day',()=>{
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(1));f.detectChanges();
    expect(Array.from(f.nativeElement.querySelectorAll('.primary-actions button')).map((b:any)=>b.textContent.trim())).toEqual(['تأكيد الحجز','إلغاء الحجز']);
    expect(f.nativeElement.textContent).not.toContain('لم يحضر');
  });
  it('lets reception start and end the visit in place without navigation links',()=>{
    TestBed.inject(AuthService).hasPermission=(permission:string)=>permission!=='Examination.Create';
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(3));f.detectChanges();
    const listener=vi.fn();f.componentInstance.action.subscribe(listener);
    expect(f.nativeElement.querySelector('.primary-actions button').textContent).toContain('بدء الزيارة');
    f.nativeElement.querySelector('.primary-actions button').click();expect(listener).toHaveBeenCalledWith('start');
    expect(f.nativeElement.querySelector('a')).toBeNull();
    f.componentRef.setInput('appointment',item(4));f.detectChanges();
    expect(f.nativeElement.querySelectorAll('button').length).toBe(1);expect(f.nativeElement.textContent).toContain('إنهاء الزيارة');
    f.nativeElement.querySelector('button').click();expect(listener).toHaveBeenCalledWith('complete');expect(f.nativeElement.querySelector('a')).toBeNull();
  });
  it('keeps no-show recorded and offers a new appointment with the same patient and doctor',()=>{
    const f=TestBed.createComponent(AppointmentCardActionsComponent);f.componentRef.setInput('appointment',item(7));f.detectChanges();
    expect(f.nativeElement.textContent).toContain('سجل المواعيد');const href=f.nativeElement.querySelector('a').getAttribute('href');expect(href).toContain('/appointments/create?');expect(href).toContain('patientId=p1');expect(href).toContain('doctorProfileId=d1');expect(f.nativeElement.querySelector('button')).toBeNull();
  });
});
