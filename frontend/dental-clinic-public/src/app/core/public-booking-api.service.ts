import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PublicClinicDto {
  tenantId: string;
  name: string;
  slug: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  timeZone: string;
  currency: string;
  logoReference?: string;
  publicBookingEnabled: boolean;
  publicBookingHorizonDays: number;
  publicPriceVisibility: boolean;
}

export interface PublicDoctorDto {
  doctorProfileId: string;
  displayName: string;
  specialization: string;
  bio?: string;
  consultationDurationMinutes: number;
}

export interface PublicServiceDto {
  id: string;
  name: string;
  code: string;
  description?: string;
  durationMinutes: number;
  price?: number;
}

export interface PublicAvailabilitySlotDto {
  startAt: string;
  endAt: string;
  date: string;
  startTime: string;
  endTime: string;
  timeZone: string;
}

export interface PublicBookingRequest {
  clinicSlug: string;
  doctorProfileId: string;
  serviceId: string;
  startAt: string;
  durationMinutes: number;
  patientName: string;
  patientPhone: string;
  patientEmail?: string;
  patientDateOfBirth?: string;
  patientNotes?: string;
  idempotencyKey?: string;
}

export interface PublicBookingConfirmationDto {
  bookingReference: string;
  clinicName: string;
  doctorName: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  patientName: string;
  patientPhone: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class PublicBookingApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/public';

  getClinicBySlug(slug: string): Observable<PublicClinicDto> {
    return this.http.get<PublicClinicDto>(`${this.baseUrl}/clinics/${slug}`);
  }

  getDoctors(slug: string): Observable<PublicDoctorDto[]> {
    return this.http.get<PublicDoctorDto[]>(`${this.baseUrl}/clinics/${slug}/doctors`);
  }

  getServices(slug: string): Observable<PublicServiceDto[]> {
    return this.http.get<PublicServiceDto[]>(`${this.baseUrl}/clinics/${slug}/services`);
  }

  getAvailability(
    slug: string,
    doctorId: string,
    date: string,
    serviceId?: string,
  ): Observable<PublicAvailabilitySlotDto[]> {
    let url = `${this.baseUrl}/clinics/${slug}/availability?doctorId=${doctorId}&date=${date}`;
    if (serviceId) {
      url += `&serviceId=${serviceId}`;
    }
    return this.http.get<PublicAvailabilitySlotDto[]>(url);
  }

  createBooking(
    slug: string,
    request: PublicBookingRequest,
  ): Observable<PublicBookingConfirmationDto> {
    return this.http.post<PublicBookingConfirmationDto>(
      `${this.baseUrl}/clinics/${slug}/bookings`,
      request,
    );
  }

  getBookingConfirmation(reference: string): Observable<PublicBookingConfirmationDto> {
    return this.http.get<PublicBookingConfirmationDto>(
      `${this.baseUrl}/bookings/confirmation/${reference}`,
    );
  }
}
