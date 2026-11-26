import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { DashboardPageComponent } from './dashboard-page.component';

const empty = { page: { items: [], page: 1, pageSize: 250, totalCount: 0, totalPages: 0 }, timeZone: 'UTC' };

describe('DashboardPageComponent data states', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    TestBed.inject(AuthService).permissions.set(['Patients.View', 'Appointments.View', 'Reports.View', 'Doctors.View']);
    TestBed.inject(LocalizationService).set('en');
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('distinguishes schedule failure from an empty schedule and recovers on retry', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/appointments' && r.params.get('from') === r.params.get('to')).flush(empty);
    http.expectOne(r => r.url === '/api/appointments').flush(empty);
    http.expectOne(r => r.url === '/api/patients').flush({ items: [], totalCount: 0 });
    http.expectOne(r => r.url === '/api/reports/dashboard').flush({ revenue: 0, currency: 'EGP' });
    http.expectOne(r => r.url === '/api/doctors').flush({ items: [] });
    http.expectOne(r => r.url === '/api/appointments').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.calendar [role="alert"]')?.textContent).toContain('Schedule could not be loaded');
    expect(root.querySelector('.calendar')?.textContent).not.toContain('No appointments');
    root.querySelector<HTMLButtonElement>('.calendar .state button')!.click();
    http.expectOne(r => r.url === '/api/appointments').flush(empty);
    fixture.detectChanges();
    expect(root.querySelector('.calendar [role="alert"]')).toBeNull();
    expect(root.querySelector('.calendar')?.textContent).toContain('No appointments');
  });

  it('does not display zero patients or no upcoming visits when those requests fail', () => {
    const fixture = TestBed.createComponent(DashboardPageComponent);
    const http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne(r => r.url === '/api/appointments' && r.params.get('from') === r.params.get('to')).flush(empty);
    http.expectOne(r => r.url === '/api/appointments').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(r => r.url === '/api/patients').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(r => r.url === '/api/reports/dashboard').flush({ revenue: 0, currency: 'EGP' });
    http.expectOne(r => r.url === '/api/doctors').flush({ items: [] });
    http.expectOne(r => r.url === '/api/appointments').flush(empty);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.kpi-number')?.textContent?.trim()).toBe('—');
    expect(root.textContent).toContain('Recent patients could not be loaded');
    expect(root.textContent).toContain('Upcoming visits could not be loaded');
  });

  it('updates the shared drawer, filtered schedule, and waiting count after check-in and cancellation', () => {
    TestBed.inject(AuthService).permissions.update((permissions) => [...permissions, 'Appointments.CheckIn', 'Appointments.Cancel']);
    const fixture = TestBed.createComponent(DashboardPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const date = fixture.componentInstance.selectedDate();
    const appointment = {
      id: 'a1', patientId: 'p1', patientName: 'Mona Hassan', doctorProfileId: 'd1', doctorName: 'Dr Sara',
      type: 1, status: 2, startAt: `${date}T09:00:00Z`, endAt: `${date}T09:30:00Z`,
      durationMinutes: 30, timeZone: 'UTC',
    };
    const result = { ...empty, page: { ...empty.page, totalCount: 1, totalPages: 1, items: [appointment] } };
    fixture.detectChanges();
    const schedule = (r: { url: string }) => r.url === '/api/appointments';
    http.expectOne((r) => schedule(r) && r.params.get('from') === date).flush(result);
    http.expectOne(schedule).flush(empty);
    http.expectOne((r) => r.url === '/api/patients').flush({ items: [], totalCount: 0 });
    http.expectOne((r) => r.url === '/api/reports/dashboard').flush({ revenue: 0, currency: 'EGP' });
    http.expectOne((r) => r.url === '/api/doctors').flush({ items: [{ id: 'd1', displayName: 'Dr Sara' }] });
    http.expectOne(schedule).flush(result);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const row = root.querySelector<HTMLElement>('.schedule-row')!;
    expect(row.dataset['bookingState']).toBe('confirmed');
    const [doctorFilter, statusFilter, typeFilter] = root.querySelectorAll<HTMLSelectElement>('.calendar-toolbar select');
    for (const [filter, value] of [[doctorFilter, 'd1'], [statusFilter, '2'], [typeFilter, '1']] as const) {
      filter.value = value;
      filter.dispatchEvent(new Event('change'));
      http.expectOne(schedule).flush(result);
    }
    fixture.detectChanges();
    const drawer = root.querySelector<HTMLDialogElement>('app-appointment-details-drawer dialog')!;
    drawer.showModal ??= () => { drawer.open = true; };
    root.querySelector<HTMLElement>('.schedule-row .schedule-patient')!.click();
    http.expectOne('/api/appointments/a1').flush(appointment);
    fixture.detectChanges();
    expect(drawer.open).toBe(true);
    expect(drawer.textContent).toContain('New patient');
    drawer.querySelector<HTMLButtonElement>('app-appointment-card-actions button')!.click();
    http.expectOne('/api/appointments/a1/check-in').flush(null);

    http.expectOne((r) => schedule(r) && r.params.get('status') === '2' &&
      r.params.get('type') === '1' && r.params.get('doctorProfileId') === 'd1' &&
      r.params.get('from') === date && r.params.get('to') === date).flush(empty);
    const arrived = { ...appointment, status: 3 };
    http.expectOne((r) => schedule(r) && !r.params.has('status')).flush({
      ...result, page: { ...result.page, items: [arrived] },
    });
    http.expectOne('/api/appointments/a1').flush(arrived);
    fixture.detectChanges();
    expect(drawer.open).toBe(true);
    expect(drawer.querySelector('.booking-badge')?.textContent).toBe('Attended');
    expect(root.querySelector('.schedule-row')).toBeNull();
    expect(root.querySelector('.kpi-waiting .kpi-number')?.textContent?.trim()).toBe('1');
    expect(root.querySelector('.kpi-appointments .kpi-number')?.textContent?.trim()).toBe('1');

    drawer.querySelector<HTMLButtonElement>('app-appointment-card-actions details button')!.click();
    fixture.detectChanges();
    const reason = drawer.querySelector<HTMLTextAreaElement>('textarea')!;
    reason.value = 'Patient requested cancellation.';
    reason.dispatchEvent(new Event('input'));
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    drawer.querySelector('form.cancel-form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    const cancellation = http.expectOne('/api/appointments/a1/cancel');
    expect(cancellation.request.body).toEqual({ reason: 'Patient requested cancellation.' });
    cancellation.flush(null);
    const cancelled = { ...appointment, status: 6 };
    http.expectOne((r) => schedule(r) && r.params.has('status')).flush(empty);
    http.expectOne((r) => schedule(r) && !r.params.has('status')).flush({
      ...result, page: { ...result.page, items: [cancelled] },
    });
    http.expectOne('/api/appointments/a1').flush(cancelled);
    fixture.detectChanges();
    expect(drawer.open).toBe(true);
    expect(drawer.querySelector('.booking-badge')?.textContent).toBe('Cancelled');
    expect(root.querySelector('.kpi-waiting .kpi-number')?.textContent?.trim()).toBe('0');
  });
});
