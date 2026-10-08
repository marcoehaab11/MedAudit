import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { AppointmentsPageComponent } from './appointments-page.component';

describe('AppointmentsPageComponent', () => {
  beforeEach(async () => {
    localStorage.setItem('access_token', 'test');
    localStorage.setItem(
      'permissions',
      JSON.stringify(['Appointments.View', 'Appointments.Create']),
    );
    await TestBed.configureTestingModule({
      imports: [AppointmentsPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders appointments returned by the calendar query', () => {
    const fixture = TestBed.createComponent(AppointmentsPageComponent);
    const http = TestBed.inject(HttpTestingController);
    const component = fixture.componentInstance;
    const date = component.selectedDate();
    http.expectOne((r) => r.url === '/api/doctors/lookup').flush([]);
    http
      .expectOne((r) => r.url === '/api/appointments')
      .flush({
        page: {
          items: [
            {
              id: 'a1',
              patientId: 'p1',
              patientName: 'Mona Hassan',
              doctorProfileId: 'd1',
              doctorName: 'Dr Sara',
              type: 3,
              status: 1,
              startAt: `${date}T09:00:00Z`,
              endAt: `${date}T09:30:00Z`,
              durationMinutes: 30,
              timeZone: 'UTC',
            },
          ],
          page: 1,
          pageSize: 100,
          totalCount: 1,
          totalPages: 1,
        },
        timeZone: 'UTC',
      });
    fixture.detectChanges();

    const card = (fixture.nativeElement as HTMLElement).querySelector(
      '.timeline-card',
    ) as HTMLElement;
    expect(card.style.width).toBe('90px');
    expect(card.style.getPropertyValue('inset-inline-start')).toBe('300px');
    expect(card.textContent).toContain('Dr Sara');

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.appointment-card')?.textContent,
    ).toContain('Mona Hassan');
  });

  it('renders Arabic labels when localization switches to Arabic', () => {
    const fixture = TestBed.createComponent(AppointmentsPageComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((r) => r.url === '/api/doctors/lookup').flush([]);
    http
      .expectOne((r) => r.url === '/api/appointments')
      .flush({
        page: { items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 },
        timeZone: 'UTC',
      });
    TestBed.inject(LocalizationService).set('ar');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'المواعيد',
    );
    expect(document.documentElement.dir).toBe('rtl');
  });
  it('cancels the previous day request when navigating', () => {
    const fixture = TestBed.createComponent(AppointmentsPageComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/doctors/lookup').flush([]);
    const oldRequest = http.expectOne((r) => r.url === '/api/appointments');
    fixture.componentInstance.move(1);
    expect(oldRequest.cancelled).toBe(true);
    http
      .expectOne((r) => r.url === '/api/appointments')
      .flush({
        page: { items: [], page: 1, pageSize: 250, totalCount: 0, totalPages: 0 },
        timeZone: 'UTC',
      });
  });

  it('loads subsequent pages before presenting the calendar', () => {
    const fixture = TestBed.createComponent(AppointmentsPageComponent);
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/doctors/lookup').flush([]);
    http
      .expectOne((r) => r.url === '/api/appointments')
      .flush({
        page: { items: [], page: 1, pageSize: 250, totalCount: 251, totalPages: 2 },
        timeZone: 'UTC',
      });
    expect(fixture.componentInstance.loading()).toBe(true);
    http
      .expectOne((r) => r.url === '/api/appointments' && r.params.get('page') === '2')
      .flush({
        page: { items: [], page: 2, pageSize: 250, totalCount: 251, totalPages: 2 },
        timeZone: 'UTC',
      });
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
