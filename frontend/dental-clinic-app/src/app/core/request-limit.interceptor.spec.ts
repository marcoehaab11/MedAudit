import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { requestLimitInterceptor } from './request-limit.interceptor';

describe('requestLimitInterceptor', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  let previousLanguage: string;
  beforeEach(() => {
    previousLanguage = document.documentElement.lang;
    TestBed.configureTestingModule({ providers: [provideHttpClient(withInterceptors([requestLimitInterceptor])), provideHttpClientTesting()] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    requests.verify();
    document.getElementById('request-limit-notice')?.remove();
    document.documentElement.lang = previousLanguage;
  });
  it('shows the actual Arabic waiting time and preserves the 429 error', () => {
    document.documentElement.lang = 'ar';
    let status = 0;
    http.post('/api/auth/login', {}).subscribe({ error: error => status = error.status });
    requests.expectOne('/api/auth/login').flush({}, { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '900' } });
    const notice = document.getElementById('request-limit-notice');
    expect(notice?.textContent).toContain('900');
    expect(notice?.textContent).toContain('انتظر');
    expect(notice?.getAttribute('role')).toBe('alert');
    expect(status).toBe(429);
    notice?.querySelector('button')?.click();
    expect(document.getElementById('request-limit-notice')).toBeNull();
  });
  it('shows a clear message when Redis protection is unavailable', () => {
    http.get('/api/patients').subscribe({ error: () => {} });
    requests.expectOne('/api/patients').flush({ code: 'rate_limit_unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    expect(document.getElementById('request-limit-notice')?.textContent).toContain('30');
  });
  it('does not show a rate-limit message for an ordinary validation failure', () => {
    http.post('/api/patients', {}).subscribe({ error: () => {} });
    requests.expectOne('/api/patients').flush({}, { status: 400, statusText: 'Bad Request' });
    expect(document.getElementById('request-limit-notice')).toBeNull();
  });
});
