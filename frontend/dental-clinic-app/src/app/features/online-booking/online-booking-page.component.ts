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
  assignedToUserId: string | null;
  staffNotes: string | null;
  followUpAt: string | null;
}

interface BookingInquiry {
  id: string;
  patientName: string;
  phone: string;
  email: string | null;
  message: string | null;
  createdAt: string;
  contactedAt: string | null;
  status: string;
  assignedToUserId: string | null;
  staffNotes: string | null;
  followUpAt: string | null;
}

interface BookingSummary {
  visits30Days: number;
  sources: { source: string; count: number }[];
  bookingSources: { source: string; count: number }[];
  bookings30Days: number;
  inquiries30Days: number;
  awaitingContact: number;
  overdue: number;
  completed30Days: number;
  noShows30Days: number;
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
  protected readonly staff = signal<{ id: string; displayName: string }[]>([]);
  protected readonly summary = signal<BookingSummary | null>(null);
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
    if (this.auth.hasPermission('Appointments.View')) { this.loadRequests(); this.loadInquiries(); this.loadSummary(); this.loadStaff(); }
  }

  protected loadSummary(): void {
    this.http.get<BookingSummary>('/api/online-booking/summary').subscribe({ next: value => this.summary.set(value) });
  }

  private loadStaff(): void {
    this.http.get<{ id: string; displayName: string }[]>('/api/online-booking/staff').subscribe({ next: value => this.staff.set(value) });
  }

  protected whatsappLink(phone: string, name: string, startAt?: string): string {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    else if (digits.startsWith('0') && /egypt|مصر/i.test(this.settings()?.country || 'Egypt')) digits = `20${digits.slice(1)}`;
    const text = startAt
      ? `أهلاً ${name}، معك عيادة ${this.settings()?.clinicName || ''}. بخصوص موعدك يوم ${new Date(startAt).toLocaleString('ar-EG')}. هل الموعد مناسب لك؟`
      : `أهلاً ${name}، معك عيادة ${this.settings()?.clinicName || ''}. وصلنا طلب التواصل الخاص بك، ما الوقت المناسب للاتصال بك؟`;
    return `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(text)}`;
  }

  protected localDateTime(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  protected newDateIso(value: string): string { return new Date(value).toISOString(); }

  protected bookingCountForSource(source: string): number {
    return this.summary()?.bookingSources.find(item => item.source === source)?.count || 0;
  }

  protected saveInquiry(item: BookingInquiry): void {
    this.http.put<void>(`/api/online-booking/inquiries/${item.id}/follow-up`, {
      status: item.status, assignedToUserId: item.assignedToUserId || null,
      notes: item.staffNotes || null, followUpAt: item.followUpAt || null,
    }).subscribe({
      next: () => { this.message.set('Follow-up saved.'); this.loadInquiries(this.inquiryPage()); this.loadSummary(); },
      error: err => this.error.set(err?.error?.title || 'Could not save follow-up.'),
    });
  }

  protected saveRequest(item: BookingRequest): void {
    this.http.put<void>(`/api/online-booking/requests/${item.id}/follow-up`, {
      assignedToUserId: item.assignedToUserId || null,
      notes: item.staffNotes || null, followUpAt: item.followUpAt || null,
    }).subscribe({
      next: () => { this.message.set('Follow-up saved.'); this.loadRequests(this.page()); },
      error: err => this.error.set(err?.error?.title || 'Could not save follow-up.'),
    });
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
      next: () => { this.loadRequests(this.page()); this.loadSummary(); },
      error: () => this.error.set('Could not mark this patient as contacted.'),
    });
  }

  protected markInquiryContacted(inquiry: BookingInquiry): void {
    this.http.post<void>(`/api/online-booking/inquiries/${inquiry.id}/contacted`, {}).subscribe({
      next: () => { this.loadInquiries(this.inquiryPage()); this.loadSummary(); },
      error: () => this.error.set('Could not mark this callback request as contacted.'),
    });
  }

  protected async copyLink(): Promise<void> {
    try { await navigator.clipboard.writeText(this.bookingUrl); this.message.set('Booking link copied.'); }
    catch { this.error.set('Copy failed. Select and copy the link below.'); }
  }

  protected async copyGoogleLink(): Promise<void> {
    try { await navigator.clipboard.writeText(`${this.bookingUrl}?source=google`); this.message.set('Google booking link copied.'); }
    catch { this.error.set('Could not copy the Google link.'); }
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
