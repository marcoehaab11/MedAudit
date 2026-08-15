import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppointmentCreateComponent } from './appointment-create.component';

describe('AppointmentCreateComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppointmentCreateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('uses server availability in the creation flow', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    flushLookups(http);
    component.form.patchValue({
      patientId: 'p1',
      doctorProfileId: 'd1',
      date: '2026-08-17',
      durationMinutes: 30,
    });
    component.loadAvailability();
    http
      .expectOne((r) => r.url === '/api/appointments/availability')
      .flush([
        {
          startAt: '2026-08-17T06:00:00Z',
          endAt: '2026-08-17T06:30:00Z',
          localDate: '2026-08-17',
          localStartTime: '09:00:00',
          localEndTime: '09:30:00',
          timeZone: 'Africa/Cairo',
        },
      ]);
    fixture.detectChanges();

    expect(component.slots()).toHaveLength(1);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="availability-slots"]')
        ?.textContent,
    ).toContain('09:00');
  });

  it('shows conflict feedback and refreshes availability after a 409', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    flushLookups(http);
    component.form.patchValue({
      patientId: 'p1',
      doctorProfileId: 'd1',
      date: '2026-08-17',
      durationMinutes: 30,
    });
    const slot = {
      startAt: '2026-08-17T06:00:00Z',
      endAt: '2026-08-17T06:30:00Z',
      localDate: '2026-08-17',
      localStartTime: '09:00:00',
      localEndTime: '09:30:00',
      timeZone: 'Africa/Cairo',
    };
    component.selectedSlot.set(slot);
    component.save();
    http.expectOne('/api/appointments').flush({}, { status: 409, statusText: 'Conflict' });
    http.expectOne((r) => r.url === '/api/appointments/availability').flush([]);

    expect(component.error()).toContain('just booked');
    expect(component.slots()).toEqual([]);
  });
});

function flushLookups(http: HttpTestingController): void {
  http
    .expectOne((r) => r.url === '/api/patients')
    .flush({
      items: [
        {
          id: 'p1',
          patientNumber: 'P-000001',
          fullName: 'Mona Hassan',
          gender: 1,
          phone: '1',
          status: 1,
          createdAt: '',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
  http
    .expectOne((r) => r.url === '/api/doctors')
    .flush({
      items: [
        {
          id: 'd1',
          clinicUserId: 'u1',
          displayName: 'Dr Sara',
          email: 's@example.com',
          specialization: 'General',
          licenseNumber: 'L1',
          status: 1,
          createdAt: '',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
}
