import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PublicBookingApiService,
  PublicBookingConfirmationDto,
  PublicAvailabilitySlotDto,
} from '../../core/public-booking-api.service';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.scss'],
})
export class BookingConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicBookingApiService);

  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmation = signal<PublicBookingConfirmationDto | null>(null);
  protected readonly managementToken = signal('');
  protected readonly actionBusy = signal(false);
  protected readonly actionMessage = signal('');
  protected readonly slots = signal<PublicAvailabilitySlotDto[]>([]);
  protected selectedDate = '';
  protected selectedStartAt = '';
  protected cancelReason = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const ref = params.get('reference') || '';
      this.managementToken.set(this.route.snapshot.queryParamMap.get('manage') || '');
      if (ref) {
        if (this.managementToken()) this.loadManagedBooking();
        else this.loadConfirmation(ref);
      }
    });
  }

  protected loadManagedAvailability(): void {
    if (!this.selectedDate || !this.managementToken()) return;
    this.api.getManagedAvailability(this.managementToken(), this.selectedDate).subscribe({
      next: slots => this.slots.set(slots),
      error: err => this.actionMessage.set(err?.error?.title || 'Could not load available times.'),
    });
  }

  protected confirm(): void { this.runAction(this.api.confirmBooking(this.managementToken()), 'Appointment confirmed.'); }
  protected cancel(): void {
    if (!window.confirm('Cancel this appointment?')) return;
    this.runAction(this.api.cancelBooking(this.managementToken(), this.cancelReason), 'Appointment cancelled.');
  }
  protected reschedule(): void {
    if (!this.selectedStartAt) return;
    this.runAction(this.api.rescheduleBooking(this.managementToken(), this.selectedStartAt), 'Appointment updated.');
  }

  private loadManagedBooking(): void {
    this.api.getManagedBooking(this.managementToken()).subscribe({
      next: data => { this.confirmation.set(data); this.loading.set(false); },
      error: () => { this.error.set('This private booking link is invalid.'); this.loading.set(false); },
    });
  }

  private runAction(request: import('rxjs').Observable<PublicBookingConfirmationDto>, message: string): void {
    this.actionBusy.set(true); this.actionMessage.set('');
    request.subscribe({
      next: data => { this.confirmation.set(data); this.actionBusy.set(false); this.actionMessage.set(message); this.slots.set([]); },
      error: err => { this.actionBusy.set(false); this.actionMessage.set(err?.error?.title || 'Could not update the appointment. Please call the clinic.'); },
    });
  }

  private loadConfirmation(ref: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getBookingConfirmation(ref).subscribe({
      next: (data) => {
        this.confirmation.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Booking reference not found or invalid.');
        this.loading.set(false);
      },
    });
  }
}
