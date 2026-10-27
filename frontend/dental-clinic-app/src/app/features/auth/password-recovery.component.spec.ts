import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { PasswordRecoveryComponent } from './password-recovery.component';

describe('PasswordRecoveryComponent', () => {
  async function setup(reset: boolean) {
    await TestBed.configureTestingModule({ imports: [PasswordRecoveryComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), {
      provide: ActivatedRoute, useValue: { snapshot: { routeConfig: { path: reset ? 'reset-password' : 'forgot-password' }, queryParamMap: convertToParamMap(reset ? { token: 'reset-token', email: 'sara@example.com' } : {}) } },
    }] }).compileComponents();
    return TestBed.createComponent(PasswordRecoveryComponent).componentInstance;
  }
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('shows a generic response for password reset requests', async () => {
    const component = await setup(false);
    component.form.controls.email.setValue('sara@example.com');
    component.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/forgot-password');
    expect(request.request.body).toEqual({ email: 'sara@example.com' });
    request.flush({}, { status: 202, statusText: 'Accepted' });
    expect(component.done()).toBe(true);
  });

  it('passes the email token and matching new passwords to the reset endpoint', async () => {
    const component = await setup(true);
    component.form.patchValue({ password: 'Changed123', confirmPassword: 'Changed123' });
    component.submit();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/reset-password');
    expect(request.request.body.token).toBe('reset-token');
    expect(request.request.body.email).toBe('sara@example.com');
    request.flush({ reset: true });
    expect(component.done()).toBe(true);
    expect(component.form.controls.password.value).toBe('');
  });
});
