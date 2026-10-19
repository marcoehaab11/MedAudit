import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { DoctorVisitQueueComponent } from './doctor-visit-queue.component';

describe('DoctorVisitQueueComponent',()=>{
  beforeEach(async()=>{
    vi.useFakeTimers();
    await TestBed.configureTestingModule({imports:[DoctorVisitQueueComponent],providers:[provideHttpClient(),provideHttpClientTesting(),provideRouter([])]}).compileComponents();
  });
  afterEach(()=>{TestBed.inject(HttpTestingController).verify();vi.useRealTimers();});
  const item=(id:string,status:number)=>({id,status,patientId:'p',patientName:'Patient '+id,doctorProfileId:'d',doctorName:'Doctor',type:1,startAt:'2026-10-19T09:00:00Z',endAt:'2026-10-19T10:00:00Z',durationMinutes:60,timeZone:'Africa/Cairo'});
  it('links arrived and started visits directly without offering or posting another start action',()=>{
    const fixture=TestBed.createComponent(DoctorVisitQueueComponent),http=TestBed.inject(HttpTestingController);
    fixture.detectChanges();vi.advanceTimersByTime(0);
    const request=http.expectOne(r=>r.url==='/api/appointments');expect(request.request.params.get('from')).toBe(request.request.params.get('to'));
    request.flush({page:{items:[item('arrived',3),item('started',4),item('booked',1),item('finished',5)],totalPages:1}});fixture.detectChanges();
    expect(fixture.componentInstance.items().map(x=>x.id)).toEqual(['arrived','started']);
    expect(Array.from(fixture.nativeElement.querySelectorAll('article a')).map((a:any)=>a.getAttribute('href'))).toEqual(['/appointments/arrived/visit','/appointments/started/visit']);
    http.expectNone(r=>r.method==='POST');fixture.destroy();
  });
  it('refreshes the queue automatically, removes completed visits and stops polling on destroy',()=>{
    const fixture=TestBed.createComponent(DoctorVisitQueueComponent),http=TestBed.inject(HttpTestingController);fixture.detectChanges();vi.advanceTimersByTime(0);
    http.expectOne(r=>r.url==='/api/appointments').flush({page:{items:[item('a',3)],totalPages:1}});
    vi.advanceTimersByTime(10000);http.expectOne(r=>r.url==='/api/appointments').flush({page:{items:[item('a',5),item('b',4)],totalPages:1}});
    expect(fixture.componentInstance.items().map(x=>x.id)).toEqual(['b']);fixture.destroy();vi.advanceTimersByTime(10000);http.expectNone(r=>r.url==='/api/appointments');
  });
  it('keeps the last queue visible on refresh failure and supports retry',()=>{
    const fixture=TestBed.createComponent(DoctorVisitQueueComponent),http=TestBed.inject(HttpTestingController);fixture.detectChanges();vi.advanceTimersByTime(0);
    http.expectOne(r=>r.url==='/api/appointments').flush({page:{items:[item('a',4)],totalPages:1}});
    fixture.componentInstance.refresh();http.expectOne(r=>r.url==='/api/appointments').flush({}, {status:503,statusText:'Unavailable'});
    expect(fixture.componentInstance.items()).toHaveLength(1);expect(fixture.componentInstance.error()).toBeTruthy();
    fixture.componentInstance.refresh();http.expectOne(r=>r.url==='/api/appointments').flush({page:{items:[],totalPages:1}});
    expect(fixture.componentInstance.error()).toBe('');fixture.destroy();
  });
});
