import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppointmentCreateComponent } from './appointment-create.component';

describe('AppointmentCreateComponent', () => {
  beforeEach(async () => {
    try { window.localStorage.removeItem('medaudit.language'); } catch {}
    await TestBed.configureTestingModule({
      imports: [AppointmentCreateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    flushOngoingTreatments(http);
    http.verify();
  });

  it('defaults to 60 minutes and follows the selected doctor preference', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushLookups(http);
    expect(component.form.controls.durationMinutes.value).toBe(60);
    component.form.controls.doctorProfileId.setValue('d1');
    expect(component.form.controls.durationMinutes.value).toBe(45);
    component.form.controls.doctorProfileId.setValue('');
    expect(component.form.controls.durationMinutes.value).toBe(60);
  });

  it('uses server availability in the creation flow', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushLookups(http);
    component.form.patchValue({
      patientId: 'p1',
      doctorProfileId: 'd1',
      date: '2026-08-17',
      durationMinutes: 30,
    });
    flushOngoingTreatments(http);
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
    const dateParts = (fixture.nativeElement as HTMLElement).querySelectorAll('app-date-input[formControlName="date"] .date-part');
    expect(Array.from(dateParts).map(part => part.classList.contains('day') ? 'day' : part.classList.contains('month') ? 'month' : 'year')).toEqual(['day', 'month', 'year']);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="availability-slots"]')
        ?.textContent,
    ).toContain('09:00');
  });

  it('shows conflict feedback and refreshes availability after a 409', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushLookups(http);
    component.form.patchValue({
      patientId: 'p1',
      doctorProfileId: 'd1',
      date: '2026-08-17',
      durationMinutes: 30,
    });
    flushOngoingTreatments(http);
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

    expect(component.error()).toContain('تم حجز هذا الموعد');
    expect(component.slots()).toEqual([]);
  });

  it('groups available slots into periods and supports 12h/24h formatting', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushLookups(http);

    component.slots.set([
      {
        startAt: '2026-08-17T06:00:00Z',
        endAt: '2026-08-17T06:30:00Z',
        localDate: '2026-08-17',
        localStartTime: '09:30:00',
        localEndTime: '10:00:00',
        timeZone: 'Africa/Cairo',
      },
      {
        startAt: '2026-08-17T11:00:00Z',
        endAt: '2026-08-17T11:30:00Z',
        localDate: '2026-08-17',
        localStartTime: '14:00:00',
        localEndTime: '14:30:00',
        timeZone: 'Africa/Cairo',
      },
      {
        startAt: '2026-08-17T16:00:00Z',
        endAt: '2026-08-17T16:30:00Z',
        localDate: '2026-08-17',
        localStartTime: '19:00:00',
        localEndTime: '19:30:00',
        timeZone: 'Africa/Cairo',
      },
    ]);

    expect(component.slotPeriods().morning).toHaveLength(1);
    expect(component.slotPeriods().evening).toHaveLength(2);

    component.timeFormat.set('12h');
    expect(component.i18n.language()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(component.formatTime('09:30:00')).toContain('ص');
    component.i18n.toggle();
    expect(component.i18n.language()).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(component.formatTime('09:30:00')).toContain('AM');
    expect(component.formatTime('14:00:00')).toContain('PM');

    component.timeFormat.set('24h');
    expect(component.formatTime('14:00:00')).toBe('14:00');
  });

  it('alerts when selected patient has ongoing treatment plans and pre-fills notes', () => {
    const fixture = TestBed.createComponent(AppointmentCreateComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    flushLookups(http);

    component.form.controls.patientId.setValue('p1');
    http.expectOne((r) => r.url === '/api/treatment-plans').flush({
      items: [
        {
          id: 'plan-1',
          patientName: 'Mona Hassan',
          doctorName: 'Dr Sara',
          title: 'Dental Implant Tooth #25',
          status: 1,
          total: 8000,
          createdAt: '',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    http.expectOne((r) => r.url === '/api/treatments').flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    fixture.detectChanges();

    expect(component.activeTreatmentPlans()).toHaveLength(1);
    expect(component.remainingTreatmentsSummary()).toContain('Dental Implant Tooth #25');

    component.applyPlanToNotes(component.activeTreatmentPlans()[0]);
    expect(component.form.controls.notes.value).toContain('Dental Implant Tooth #25');
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
  http.expectOne((r) => r.url === '/api/doctors/lookup').flush([
    { id: 'd1', displayName: 'Dr Sara', specialization: 'General', consultationDurationMinutes: 45 },
  ]);
}

function flushOngoingTreatments(http: HttpTestingController): void {
  http.match((r) => r.url === '/api/treatment-plans').forEach((r) => r.flush({ items: [], totalCount: 0 }));
  http.match((r) => r.url === '/api/treatments').forEach((r) => r.flush({ items: [], totalCount: 0 }));
}
