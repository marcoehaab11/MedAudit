import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  PublicBookingApiService,
  PublicClinicDto,
  PublicDoctorDto,
  PublicServiceDto,
  PublicAvailabilitySlotDto,
  PublicBookingRequest,
} from '../../core/public-booking-api.service';

@Component({
  selector: 'app-public-booking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-booking.component.html',
  styleUrls: ['./public-booking.component.scss'],
})
export class PublicBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(PublicBookingApiService);

  protected readonly clinicSlug = signal<string>('');
  protected readonly clinic = signal<PublicClinicDto | null>(null);
  protected readonly doctors = signal<PublicDoctorDto[]>([]);
  protected readonly services = signal<PublicServiceDto[]>([]);
  protected readonly slots = signal<PublicAvailabilitySlotDto[]>([]);

  protected readonly step = signal<number>(1);
  protected readonly loading = signal<boolean>(true);
  protected readonly loadingSlots = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);
  protected readonly error = signal<string | null>(null);

  protected readonly selectedDoctorId = signal<string>('');
  protected readonly selectedServiceId = signal<string>('');
  protected readonly selectedDate = signal<string>('');
  protected readonly selectedSlot = signal<PublicAvailabilitySlotDto | null>(null);

  protected patientName = '';
  protected patientPhone = '';
  protected patientEmail = '';
  protected patientDateOfBirth = '';
  protected patientNotes = '';

  protected readonly selectedDoctor = computed(() =>
    this.doctors().find((d) => d.doctorProfileId === this.selectedDoctorId()),
  );

  protected readonly selectedService = computed(() =>
    this.services().find((s) => s.id === this.selectedServiceId()),
  );

  protected readonly minDate = computed(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  protected readonly maxDate = computed(() => {
    const horizonDays = this.clinic()?.publicBookingHorizonDays || 30;
    const max = new Date();
    max.setDate(max.getDate() + horizonDays);
    return max.toISOString().split('T')[0];
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('clinicSlug') || '';
      this.clinicSlug.set(slug);
      if (slug) {
        this.loadClinicData(slug);
      }
    });

    const todayStr = new Date().toISOString().split('T')[0];
    this.selectedDate.set(todayStr);
  }

  protected loadClinicData(slug: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.api.getClinicBySlug(slug).subscribe({
      next: (clinic) => {
        this.clinic.set(clinic);
        this.loadDoctorsAndServices(slug);
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 404) {
          this.error.set('Clinic not found or invalid public booking link.');
        } else if (err.status === 400 || err.error?.title) {
          this.error.set(
            err.error?.title || 'Public booking is currently disabled for this clinic.',
          );
        } else {
          this.error.set('Failed to load clinic information. Please try again later.');
        }
      },
    });
  }

  private loadDoctorsAndServices(slug: string): void {
    this.api.getDoctors(slug).subscribe({
      next: (docs) => {
        this.doctors.set(docs);
        if (docs.length > 0) {
          this.selectedDoctorId.set(docs[0].doctorProfileId);
        }
      },
    });

    this.api.getServices(slug).subscribe({
      next: (svcs) => {
        this.services.set(svcs);
        if (svcs.length > 0) {
          this.selectedServiceId.set(svcs[0].id);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected selectDoctor(doctorId: string): void {
    this.selectedDoctorId.set(doctorId);
    this.selectedSlot.set(null);
    if (this.step() === 3) {
      this.fetchAvailability();
    }
  }

  protected selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
    this.selectedSlot.set(null);
    if (this.step() === 3) {
      this.fetchAvailability();
    }
  }

  protected onDateChange(dateValue: string): void {
    this.selectedDate.set(dateValue);
    this.selectedSlot.set(null);
    this.fetchAvailability();
  }

  protected fetchAvailability(): void {
    const slug = this.clinicSlug();
    const docId = this.selectedDoctorId();
    const date = this.selectedDate();
    const svcId = this.selectedServiceId();

    if (!slug || !docId || !date) return;

    this.loadingSlots.set(true);
    this.slots.set([]);
    this.error.set(null);

    this.api.getAvailability(slug, docId, date, svcId).subscribe({
      next: (slots) => {
        this.slots.set(slots);
        this.loadingSlots.set(false);
      },
      error: (err) => {
        this.loadingSlots.set(false);
        this.error.set(
          err.error?.title || 'Could not fetch availability slots for the selected date.',
        );
      },
    });
  }

  protected goToStep(nextStep: number): void {
    if (nextStep === 3) {
      this.fetchAvailability();
    }
    this.step.set(nextStep);
  }

  protected selectSlot(slot: PublicAvailabilitySlotDto): void {
    this.selectedSlot.set(slot);
  }

  protected submitBooking(): void {
    const slot = this.selectedSlot();
    const doc = this.selectedDoctor();
    const svc = this.selectedService();

    if (!slot || !doc || !svc) {
      this.error.set('Please select a doctor, service, and available time slot.');
      return;
    }

    if (!this.patientName.trim() || !this.patientPhone.trim()) {
      this.error.set('Please fill in your full name and phone number.');
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const idempotencyKey = `pub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const payload: PublicBookingRequest = {
      clinicSlug: this.clinicSlug(),
      doctorProfileId: doc.doctorProfileId,
      serviceId: svc.id,
      startAt: slot.startAt,
      durationMinutes: svc.durationMinutes || doc.consultationDurationMinutes,
      patientName: this.patientName.trim(),
      patientPhone: this.patientPhone.trim(),
      patientEmail: this.patientEmail.trim() || undefined,
      patientDateOfBirth: this.patientDateOfBirth || undefined,
      patientNotes: this.patientNotes.trim() || undefined,
      idempotencyKey,
    };

    this.api.createBooking(this.clinicSlug(), payload).subscribe({
      next: (confirmation) => {
        this.submitting.set(false);
        this.router.navigate(['/book/confirmation', confirmation.bookingReference]);
      },
      error: (err) => {
        this.submitting.set(false);
        if (err.status === 409) {
          this.error.set(
            'That time slot was just booked by someone else. Please select another slot.',
          );
          this.fetchAvailability();
          this.step.set(3);
        } else if (err.error?.title) {
          this.error.set(err.error.title);
        } else {
          this.error.set('Failed to submit booking. Please verify your details and try again.');
        }
      },
    });
  }
}
