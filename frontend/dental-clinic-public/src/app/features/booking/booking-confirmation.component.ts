import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  PublicBookingApiService,
  PublicBookingConfirmationDto,
} from '../../core/public-booking-api.service';

@Component({
  selector: 'app-booking-confirmation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './booking-confirmation.component.html',
  styleUrls: ['./booking-confirmation.component.scss'],
})
export class BookingConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicBookingApiService);

  protected readonly loading = signal<boolean>(true);
  protected readonly error = signal<string | null>(null);
  protected readonly confirmation = signal<PublicBookingConfirmationDto | null>(null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const ref = params.get('reference') || '';
      if (ref) {
        this.loadConfirmation(ref);
      }
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
