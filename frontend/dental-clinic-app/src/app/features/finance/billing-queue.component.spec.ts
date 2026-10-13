import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { BillingQueueComponent } from './billing-queue.component';

describe('Reception billing queue', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({ imports: [BillingQueueComponent], providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])] }).compileComponents();
  });
  afterEach(() => { TestBed.inject(HttpTestingController).verify(); vi.useRealTimers(); });
  it('opens payment directly and refreshes the queue without opening a patient file', () => {
    const fixture = TestBed.createComponent(BillingQueueComponent);
    TestBed.inject(AuthService).permissions.set(['Finance.Payments.Create']);
    const http = TestBed.inject(HttpTestingController);
    vi.advanceTimersByTime(1);
    http.expectOne('/api/finance/billing-queue').flush([{ revenueId: 'r1', patientId: 'p1', patientName: 'Mona', treatmentName: 'Completed filling', outstanding: 600, currency: 'EGP', occurredAt: '2026-10-13T08:00:00Z' }]);
    fixture.detectChanges();
    const link = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(link.getAttribute('href')).toContain('/finance/payments/create?');
    expect(link.getAttribute('href')).toContain('revenueId=r1');
    expect(fixture.nativeElement.textContent).toContain('Mona');
    vi.advanceTimersByTime(15000);
    http.expectOne('/api/finance/billing-queue').flush([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a')).toBeNull();
    fixture.destroy();
  });
});
