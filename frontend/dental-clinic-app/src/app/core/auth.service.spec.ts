import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthService, LoginResponse } from './auth.service';
import { authInterceptor } from './auth.interceptor';

const verified: LoginResponse = { expiresAt: '2026-10-22T00:00:00Z', userId: 'real-user', displayName: 'Verified Name', roles: ['Receptionist'], permissions: ['Patients.View'], tenantId: 'real-clinic', tenantName: 'Real Clinic', clinics: [] };
describe('server verified authentication', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()] }));
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); localStorage.clear(); });
  it('ignores browser supplied identity, role and token and loads the server session', () => {
    localStorage.setItem('access_token', 'forged'); localStorage.setItem('user_id', 'someone-else'); localStorage.setItem('roles', '["PlatformAdmin"]');
    const auth = TestBed.inject(AuthService); const http = TestBed.inject(HttpTestingController);
    expect(auth.authenticated()).toBe(false); expect(auth.userId()).toBe(''); expect(auth.roles()).toEqual([]);
    auth.restoreSession().subscribe();
    const request = http.expectOne('/api/auth/session');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush(verified);
    expect(auth.userId()).toBe('real-user'); expect(auth.roles()).toEqual(['Receptionist']);
    expect(localStorage.getItem('user_id')).toBeNull(); expect(localStorage.getItem('access_token')).toBeNull();
  });
  it('clears all in-memory identity when the server rejects the session', () => {
    const auth = TestBed.inject(AuthService); auth.authenticated.set(true); auth.userId.set('old-user');
    auth.restoreSession().subscribe(valid => expect(valid).toBe(false));
    TestBed.inject(HttpTestingController).expectOne('/api/auth/session').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.authenticated()).toBe(false); expect(auth.userId()).toBe('');
  });
  it('signs out through the server before clearing the displayed session', () => {
    const auth = TestBed.inject(AuthService); auth.authenticated.set(true); auth.userId.set('real-user');
    auth.logout().subscribe();
    const request = TestBed.inject(HttpTestingController).expectOne('/api/auth/logout');
    expect(request.request.method).toBe('POST'); expect(request.request.headers.get('X-App-Request')).toBe('1');
    expect(auth.authenticated()).toBe(true);
    request.flush(null); expect(auth.authenticated()).toBe(false); expect(auth.userId()).toBe('');
  });
});
