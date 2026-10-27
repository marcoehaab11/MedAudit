import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { ClinicRegistrationComponent } from './clinic-registration.component';

describe('ClinicRegistrationComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ClinicRegistrationComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }).compileComponents();
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('submits clinic details and consent, then waits for email verification', () => {
    const fixture = TestBed.createComponent(ClinicRegistrationComponent);
    const component = fixture.componentInstance;
    component.form.setValue({ clinicName: 'Smile', ownerName: 'Sara', email: 'sara@example.com', phone: '01012345678', address: 'Street', city: 'Cairo', country: 'Egypt', password: 'Password123', confirmPassword: 'Password123', showcaseConsent: false });
    component.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/public/clinics/register');
    expect(request.request.body.showcaseConsent).toBe(false);
    expect(request.request.body.logoBase64).toBeNull();
    request.flush({}, { status: 202, statusText: 'Accepted' });
    fixture.detectChanges();
    expect(component.submitted()).toBe(true);
    expect(component.confirmed()).toBe(false);
    expect(component.form.controls.password.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('راجع إيميلك');
  });

  it('rejects mismatched passwords before sending registration', () => {
    const component = TestBed.createComponent(ClinicRegistrationComponent).componentInstance;
    component.form.setValue({ clinicName: 'Smile', ownerName: 'Sara', email: 'sara@example.com', phone: '01012345678', address: 'Street', city: 'Cairo', country: 'Egypt', password: 'Password123', confirmPassword: 'Different123', showcaseConsent: false });
    component.submit();
    expect(component.error()).toContain('غير متطابقتين');
    TestBed.inject(HttpTestingController).expectNone('/api/public/clinics/register');
  });
  it('activates the email token and uses the configured clinic login URL', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { routeConfig: { path: 'confirm-email' }, queryParamMap: convertToParamMap({ id: 'registration-id', token: 'email-token' }) } } });
    const component = TestBed.createComponent(ClinicRegistrationComponent).componentInstance;
    expect(component.confirming).toBe(true);
    component.confirm();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/public/clinics/confirm');
    expect(request.request.body).toEqual({ id: 'registration-id', token: 'email-token' });
    request.flush({ confirmed: true, loginUrl: 'https://clinic.planora.example/login' });
    expect(component.confirmed()).toBe(true);
    expect(component.loginUrl()).toBe('https://clinic.planora.example/login');
  });

});
