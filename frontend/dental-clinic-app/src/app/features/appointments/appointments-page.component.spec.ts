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
    const date = component.dateControl.value;
    http
      .expectOne((r) => r.url === '/api/doctors')
      .flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
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

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.appointment-card')?.textContent,
    ).toContain('Mona Hassan');
  });

  it('renders Arabic labels when localization switches to Arabic', () => {
    const fixture = TestBed.createComponent(AppointmentsPageComponent);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne((r) => r.url === '/api/doctors')
      .flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
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
});
