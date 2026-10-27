import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { BookingConfirmationComponent } from './booking-confirmation.component';
import { PublicBookingApiService } from '../../core/public-booking-api.service';

describe('private booking confirmation', () => {
  it('does not request patient details when the link contains only a reference', async () => {
    const api = { getBookingConfirmation: vi.fn(), getManagedBooking: vi.fn() };
    await TestBed.configureTestingModule({ imports: [BookingConfirmationComponent], providers: [
      { provide: PublicBookingApiService, useValue: api },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ reference: 'BK-reference' })), snapshot: { queryParamMap: convertToParamMap({}) } } },
    ] }).compileComponents();
    const fixture = TestBed.createComponent(BookingConfirmationComponent); fixture.detectChanges();
    expect(api.getBookingConfirmation).not.toHaveBeenCalled(); expect(api.getManagedBooking).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('private management link');
  });
});
