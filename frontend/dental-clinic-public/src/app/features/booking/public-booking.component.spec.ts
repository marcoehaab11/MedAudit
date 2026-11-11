import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PublicBookingComponent } from './public-booking.component';

describe('Public booking recovery', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[PublicBookingComponent],providers:[provideRouter([]),provideHttpClient(),provideHttpClientTesting()]}).compileComponents();
  });
  afterEach(()=>TestBed.inject(HttpTestingController).verify());
  function setup() {
    const c=TestBed.createComponent(PublicBookingComponent).componentInstance as any;
    c.clinicSlug.set('garden'); c.selectedDoctorId.set('d1'); c.selectedServiceId.set('s1'); c.selectedDate.set('2026-11-12');
    c.doctors.set([{doctorProfileId:'d1',displayName:'Doctor',consultationDurationMinutes:30}]);
    c.services.set([{id:'s1',name:'Consultation',durationMinutes:30}]);
    return c;
  }
  it('discards availability for an older date and clears the selected slot before refresh', () => {
    const c=setup(), http=TestBed.inject(HttpTestingController);
    c.fetchAvailability(); const old=http.expectOne(r=>r.url.includes('availability'));
    c.onDateChange('2026-11-13'); const fresh=http.expectOne(r=>r.url.includes('availability'));
    const slot={startAt:'2026-11-13T09:00:00Z',endAt:'2026-11-13T09:30:00Z',date:'2026-11-13',startTime:'11:00',endTime:'11:30',timeZone:'Africa/Cairo'};
    fresh.flush([slot]); old.flush([]); expect(c.slots()).toEqual([slot]);
    c.selectSlot(slot); c.fetchAvailability(); expect(c.selectedSlot()).toBeNull();
    http.expectOne(r=>r.url.includes('availability')).flush([]);
  });
  it('sends one booking while pending and retains patient details after rejection', () => {
    const c=setup(), http=TestBed.inject(HttpTestingController);
    c.selectedSlot.set({startAt:'2026-11-12T09:00:00Z'});c.patientName='Mona Hassan';c.patientPhone='01000000001';
    c.submitBooking();c.submitBooking();
    http.expectOne(r=>r.method==='POST').flush({}, {status:503,statusText:'Unavailable'});
    expect(c.submitting()).toBe(false);expect(c.patientName).toBe('Mona Hassan');expect(c.error()).toBeTruthy();
  });
  it('shows lookup failures instead of claiming there are no doctors and supports retry', () => {
    const c=setup(), http=TestBed.inject(HttpTestingController);
    c.loadDoctorsAndServices('garden');
    http.expectOne(r=>r.url.endsWith('/services')).flush([]);
    http.expectOne(r=>r.url.endsWith('/doctors')).flush({}, {status:503,statusText:'Unavailable'});
    expect(c.lookupError()).toBeTruthy(); expect(c.loading()).toBe(false);
    c.loadDoctorsAndServices('garden'); expect(c.lookupError()).toBe('');
    http.expectOne(r=>r.url.endsWith('/services')).flush([]);
    http.expectOne(r=>r.url.endsWith('/doctors')).flush([]);
    expect(c.loading()).toBe(false); expect(c.lookupError()).toBe('');
  });

});
