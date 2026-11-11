import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PaymentsPageComponent } from './payments-page.component';
import { RevenuePageComponent } from './revenue-page.component';
import { ExpensesPageComponent } from './expenses-page.component';

for (const [component, path, retry] of [
  [PaymentsPageComponent, '/api/finance/payments', 'load'],
  [RevenuePageComponent, '/api/finance/revenue', 'load'],
  [ExpensesPageComponent, '/api/finance/expenses', 'loadExpenses'],
] as const) {
  describe(component.name + ' recovery', () => {
    it('distinguishes a failed ledger request from an empty ledger and can retry', async () => {
      await TestBed.configureTestingModule({
        imports: [component],
        providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
      }).compileComponents();
      const fixture = TestBed.createComponent(component as any),
        c = fixture.componentInstance as any;
      const http = TestBed.inject(HttpTestingController);
      http.expectOne((r) => r.url === path).flush({}, { status: 503, statusText: 'Unavailable' });
      fixture.detectChanges();
      expect(c.loadError()).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[role=alert]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('table')).toBeNull();
      c[retry]();
      expect(c.loading()).toBe(true);
      expect(c.loadError()).toBe('');
      http
        .expectOne((r) => r.url === path)
        .flush({ items: [], page: 1, totalPages: 1, totalCount: 0 });
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('table')).toBeTruthy();
      http.verify();
    });
  });
}
