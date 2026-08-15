import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TenantSettings {
  tenantId: string;
  clinicName: string;
  arabicName?: string | null;
  slug: string;
  phone: string;
  secondaryPhone?: string | null;
  email: string;
  website?: string | null;
  address: string;
  arabicAddress?: string | null;
  city: string;
  country: string;
  taxNumber?: string | null;
  logoReference?: string | null;
  faviconReference?: string | null;
  description: string;
  arabicDescription?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  defaultLanguage: string;
  supportedLanguages: string;
  rtlEnabled: boolean;
  timeZone: string;
  currency: string;
  currencySymbol: string;
  decimalPrecision: number;
  symbolPosition: string;
  publicBookingEnabled: boolean;
  publicBookingHorizonDays: number;
  publicPriceVisibility: boolean;
  defaultAppointmentDurationMinutes: number;
  minimumBookingNoticeHours: number;
  maxBookingHorizonDays: number;
  cancellationNoticeHours: number;
  allowSameDayBooking: boolean;
  prescriptionPrefix: string;
  defaultPrescriptionLanguage: string;
  defaultInstructionsLanguage: string;
  showClinicHeaderOnPdf: boolean;
  showDoctorSignatureOnPdf: boolean;
  enableQrCodeOnPrint: boolean;
  appointmentsNotificationEnabled: boolean;
  prescriptionsNotificationEnabled: boolean;
  publicBookingNotificationEnabled: boolean;
  inAppNotificationsEnabled: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  whatsAppNotificationsEnabled: boolean;
  allowNegativeStock: boolean;
  requireSupplierOnReceipt: boolean;
  requireReasonOnAdjustment: boolean;
  pharmacyModuleEnabled: boolean;
  allowPartialDispensing: boolean;
  requirePharmacistRoleForDispensing: boolean;
  requireReversalReason: boolean;
  defaultPaymentMethod: string;
  financialPeriodStartMonth: number;
  receiptPrefix: string;
  expensePrefix: string;
  version: string;
}

export interface ClinicHours {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  isOpen: boolean;
  periods: ClinicHourPeriod[];
}

export interface ClinicHourPeriod {
  startTime: string; // "08:00"
  endTime: string;   // "17:00"
  periodType: number; // 1=Work, 2=Break
}

export interface ClinicHoliday {
  id: string;
  name: string;
  arabicName?: string | null;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  isFullDay: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface UserPreference {
  language: string;
  theme: string;
  dateFormat: string;
  timeFormat: string;
  startOfWeek: number;
  defaultCalendarView: string;
}

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/settings';

  getSettings(): Observable<TenantSettings> {
    return this.http.get<TenantSettings>(`${this.baseUrl}`);
  }

  updateClinicProfile(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/clinic-profile`, payload);
  }

  updateBranding(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/branding`, payload);
  }

  updateTimezoneCurrency(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/timezone-currency`, payload);
  }

  updateAppointmentSettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/appointments`, payload);
  }

  updatePrescriptionSettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/prescriptions`, payload);
  }

  updateNotificationSettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/notifications`, payload);
  }

  updateInventorySettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/inventory`, payload);
  }

  updatePharmacySettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/pharmacy`, payload);
  }

  updateFinanceSettings(payload: any): Observable<TenantSettings> {
    return this.http.put<TenantSettings>(`${this.baseUrl}/finance`, payload);
  }

  getClinicHours(): Observable<ClinicHours[]> {
    return this.http.get<ClinicHours[]>(`${this.baseUrl}/hours`);
  }

  updateClinicHours(hours: ClinicHours[]): Observable<ClinicHours[]> {
    return this.http.put<ClinicHours[]>(`${this.baseUrl}/hours`, { hours });
  }

  getClinicHolidays(): Observable<ClinicHoliday[]> {
    return this.http.get<ClinicHoliday[]>(`${this.baseUrl}/holidays`);
  }

  createHoliday(payload: any): Observable<ClinicHoliday> {
    return this.http.post<ClinicHoliday>(`${this.baseUrl}/holidays`, payload);
  }

  updateHoliday(id: string, payload: any): Observable<ClinicHoliday> {
    return this.http.put<ClinicHoliday>(`${this.baseUrl}/holidays/${id}`, payload);
  }

  deleteHoliday(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/holidays/${id}`);
  }

  getUserPreferences(): Observable<UserPreference> {
    return this.http.get<UserPreference>(`${this.baseUrl}/user-preferences`);
  }

  updateUserPreferences(payload: any): Observable<UserPreference> {
    return this.http.put<UserPreference>(`${this.baseUrl}/user-preferences`, payload);
  }
}
