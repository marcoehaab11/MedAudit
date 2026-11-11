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
    http.expectOne(r => r.url === '/api/appointments').flush(empty);
    http.expectOne(r => r.url === '/api/patients').flush({ items: [], totalCount: 0 });
    http.expectOne(r => r.url === '/api/reports/dashboard').flush({ completedTreatments: 2, prescriptionsIssued: 1 });
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
    http.expectOne(r => r.url === '/api/appointments').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(r => r.url === '/api/patients').flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(r => r.url === '/api/reports/dashboard').flush({ completedTreatments: 2, prescriptionsIssued: 1 });
    http.expectOne(r => r.url === '/api/doctors').flush({ items: [] });
    http.expectOne(r => r.url === '/api/appointments').flush(empty);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.kpi-number')?.textContent?.trim()).toBe('—');
    expect(root.textContent).toContain('Recent patients could not be loaded');
    expect(root.textContent).toContain('Upcoming visits could not be loaded');
  });
});
