import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { SettingsApiService, TenantSettings } from '../../core/settings-api.service';

interface BookingRequest {
  id: string;
  bookingReference: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string | null;
  notes: string | null;
  doctorName: string;
  startAt: string;
  createdAt: string;
  status: string;
  contactedAt: string | null;
}

interface BookingInquiry {
  id: string;
  patientName: string;
  phone: string;
  email: string | null;
  message: string | null;
  createdAt: string;
  contactedAt: string | null;
}

@Component({
  selector: 'app-online-booking-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './online-booking-page.component.html',
  styleUrl: './online-booking-page.component.scss',
})
export class OnlineBookingPageComponent implements OnInit {
  private readonly api = inject(SettingsApiService);
  private readonly http = inject(HttpClient);
  protected readonly auth = inject(AuthService);
  protected readonly settings = signal<TenantSettings | null>(null);
  protected readonly requests = signal<BookingRequest[]>([]);
  protected readonly inquiries = signal<BookingInquiry[]>([]);
  protected readonly inquiryTotal = signal(0);
  protected readonly inquiryPage = signal(1);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly saving = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly profile = { name: '', arabicName: '', description: '', arabicDescription: '',
    phone: '', email: '', website: '', address: '', arabicAddress: '', city: '', country: '',
    secondaryPhone: '', taxNumber: '', logoReference: '', faviconReference: '' };

  protected get bookingUrl(): string {
    const slug = this.settings()?.slug;
    if (!slug) return '';
    const url = new URL(window.location.href);
    const originalHost = url.hostname;
    const baseHost = originalHost.replace(/^(app|admin)\./, '');
    const local = baseHost === 'localhost' || baseHost === '127.0.0.1';
    url.hostname = `book.${local ? 'localhost' : baseHost}`;
    if (local && (originalHost === 'localhost' || originalHost === '127.0.0.1' || !url.port)) url.port = '8080';
    url.pathname = `/book/${encodeURIComponent(slug)}`;
    url.search = '';
    url.hash = '';
    return url.href;
  }

  protected get qrUrl(): string {
    return this.settings() ? `/api/public/clinics/${encodeURIComponent(this.settings()!.slug)}/qr` : '';
  }

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: s => { this.settings.set(s); this.fillProfile(s); },
      error: () => this.error.set('Could not load online booking settings.'),
    });
    if (this.auth.hasPermission('Appointments.View')) { this.loadRequests(); this.loadInquiries(); }
  }

  protected loadRequests(page = 1): void {
    this.http.get<{ items: BookingRequest[]; total: number; page: number }>(
      '/api/online-booking/requests', { params: { page } },
    ).subscribe({
      next: result => { this.requests.set(result.items); this.total.set(result.total); this.page.set(result.page); },
      error: () => this.error.set('Could not load booking requests.'),
    });
  }

  protected loadInquiries(page = 1): void {
    this.http.get<{ items: BookingInquiry[]; total: number; page: number }>(
      '/api/online-booking/inquiries', { params: { page } },
    ).subscribe({
      next: result => { this.inquiries.set(result.items); this.inquiryTotal.set(result.total); this.inquiryPage.set(result.page); },
      error: () => this.error.set('Could not load callback requests.'),
    });
  }

  protected saveProfile(): void {
    const current = this.settings();
    if (!current) return;
    this.saving.set(true); this.message.set(''); this.error.set('');
    this.api.updateClinicProfile({ ...this.profile, version: current.version }).subscribe({
      next: updated => { this.settings.set(updated); this.fillProfile(updated); this.saving.set(false); this.message.set('Public booking page updated.'); },
      error: err => { this.saving.set(false); this.error.set(err?.error?.error || 'Could not save clinic details.'); },
    });
  }

  protected setBookingEnabled(enabled: boolean): void {
    const s = this.settings();
    if (!s) return;
    this.saving.set(true); this.error.set(''); this.message.set('');
    this.api.updateAppointmentSettings({
      defaultAppointmentDurationMinutes: s.defaultAppointmentDurationMinutes,
      minimumBookingNoticeHours: s.minimumBookingNoticeHours,
      maxBookingHorizonDays: s.maxBookingHorizonDays,
      cancellationNoticeHours: s.cancellationNoticeHours,
      allowSameDayBooking: s.allowSameDayBooking,
      publicBookingEnabled: enabled,
      publicBookingHorizonDays: s.publicBookingHorizonDays,
      publicPriceVisibility: s.publicPriceVisibility,
      version: s.version,
    }).subscribe({
      next: updated => { this.settings.set(updated); this.saving.set(false); this.message.set(enabled ? 'Online booking is now live.' : 'Online booking is paused.'); },
      error: () => { this.saving.set(false); this.error.set('Could not change booking availability.'); },
    });
  }

  protected markContacted(request: BookingRequest): void {
    this.http.post<void>(`/api/online-booking/requests/${request.id}/contacted`, {}).subscribe({
      next: () => this.loadRequests(this.page()),
      error: () => this.error.set('Could not mark this patient as contacted.'),
    });
  }

  protected markInquiryContacted(inquiry: BookingInquiry): void {
    this.http.post<void>(`/api/online-booking/inquiries/${inquiry.id}/contacted`, {}).subscribe({
      next: () => this.loadInquiries(this.inquiryPage()),
      error: () => this.error.set('Could not mark this callback request as contacted.'),
    });
  }

  protected async copyLink(): Promise<void> {
    try { await navigator.clipboard.writeText(this.bookingUrl); this.message.set('Booking link copied.'); }
    catch { this.error.set('Copy failed. Select and copy the link below.'); }
  }

  protected downloadQr(): void {
    this.http.get(this.qrUrl, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `${this.settings()?.slug || 'clinic'}-booking-qr.svg`;
        link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.error.set('Could not download QR code. Enable online booking first.'),
    });
  }

  private fillProfile(s: TenantSettings): void {
    Object.assign(this.profile, {
      name: s.clinicName, arabicName: s.arabicName || '', description: s.description || '',
      arabicDescription: s.arabicDescription || '', phone: s.phone, email: s.email,
      website: s.website || '', address: s.address, arabicAddress: s.arabicAddress || '',
      city: s.city, country: s.country, secondaryPhone: s.secondaryPhone || '',
      taxNumber: s.taxNumber || '', logoReference: s.logoReference || '',
      faviconReference: s.faviconReference || '',
    });
  }
}
