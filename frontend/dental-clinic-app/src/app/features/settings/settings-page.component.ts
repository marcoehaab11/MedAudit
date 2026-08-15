import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  SettingsApiService,
  TenantSettings,
  ClinicHours,
  ClinicHoliday,
  UserPreference
} from '../../core/settings-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings-page.component.html',
  styleUrls: ['./settings-page.component.scss']
})
export class SettingsPageComponent implements OnInit {
  private api = inject(SettingsApiService);
  loc = inject(LocalizationService);
  auth = inject(AuthService);

  activeTab = signal<'profile' | 'branding' | 'hours' | 'holidays' | 'modules' | 'preferences'>('profile');
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  settings = signal<TenantSettings | null>(null);
  hours = signal<ClinicHours[]>([]);
  holidays = signal<ClinicHoliday[]>([]);
  userPreference = signal<UserPreference | null>(null);

  // Form Models
  profileForm = signal<any>({});
  brandingForm = signal<any>({});
  modulesForm = signal<any>({});
  prefForm = signal<any>({});

  // Holiday Modal
  showHolidayModal = signal<boolean>(false);
  editingHoliday = signal<ClinicHoliday | null>(null);
  holidayName = signal<string>('');
  holidayArabicName = signal<string>('');
  holidayStartDate = signal<string>('');
  holidayEndDate = signal<string>('');
  holidayReason = signal<string>('');
  holidayIsFullDay = signal<boolean>(true);

  ngOnInit() {
    this.loadAllSettings();
  }

  loadAllSettings() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getSettings().subscribe({
      next: (s) => {
        this.settings.set(s);
        this.initForms(s);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || 'Failed to load clinic settings.');
        this.loading.set(false);
      }
    });

    this.api.getClinicHours().subscribe({
      next: (h) => this.hours.set(h)
    });

    this.api.getClinicHolidays().subscribe({
      next: (list) => this.holidays.set(list)
    });

    this.api.getUserPreferences().subscribe({
      next: (p) => {
        this.userPreference.set(p);
        this.prefForm.set({ ...p });
      }
    });
  }

  initForms(s: TenantSettings) {
    this.profileForm.set({
      name: s.clinicName,
      arabicName: s.arabicName || '',
      phone: s.phone,
      secondaryPhone: s.secondaryPhone || '',
      email: s.email,
      website: s.website || '',
      address: s.address,
      arabicAddress: s.arabicAddress || '',
      city: s.city,
      country: s.country,
      taxNumber: s.taxNumber || '',
      description: s.description || '',
      arabicDescription: s.arabicDescription || '',
      logoReference: s.logoReference || '',
      faviconReference: s.faviconReference || ''
    });

    this.brandingForm.set({
      primaryColor: s.primaryColor,
      secondaryColor: s.secondaryColor,
      accentColor: s.accentColor,
      defaultLanguage: s.defaultLanguage,
      supportedLanguages: s.supportedLanguages,
      rtlEnabled: s.rtlEnabled,
      timeZone: s.timeZone,
      currency: s.currency,
      currencySymbol: s.currencySymbol,
      decimalPrecision: s.decimalPrecision,
      symbolPosition: s.symbolPosition
    });

    this.modulesForm.set({
      defaultAppointmentDurationMinutes: s.defaultAppointmentDurationMinutes,
      minimumBookingNoticeHours: s.minimumBookingNoticeHours,
      maxBookingHorizonDays: s.maxBookingHorizonDays,
      cancellationNoticeHours: s.cancellationNoticeHours,
      allowSameDayBooking: s.allowSameDayBooking,
      publicBookingEnabled: s.publicBookingEnabled,
      publicBookingHorizonDays: s.publicBookingHorizonDays,
      publicPriceVisibility: s.publicPriceVisibility,

      prescriptionPrefix: s.prescriptionPrefix,
      defaultPrescriptionLanguage: s.defaultPrescriptionLanguage,
      defaultInstructionsLanguage: s.defaultInstructionsLanguage,
      showClinicHeaderOnPdf: s.showClinicHeaderOnPdf,
      showDoctorSignatureOnPdf: s.showDoctorSignatureOnPdf,
      enableQrCodeOnPrint: s.enableQrCodeOnPrint,

      appointmentsNotificationEnabled: s.appointmentsNotificationEnabled,
      prescriptionsNotificationEnabled: s.prescriptionsNotificationEnabled,
      publicBookingNotificationEnabled: s.publicBookingNotificationEnabled,
      inAppNotificationsEnabled: s.inAppNotificationsEnabled,
      emailNotificationsEnabled: s.emailNotificationsEnabled,
      smsNotificationsEnabled: s.smsNotificationsEnabled,
      whatsAppNotificationsEnabled: s.whatsAppNotificationsEnabled,

      allowNegativeStock: s.allowNegativeStock,
      requireSupplierOnReceipt: s.requireSupplierOnReceipt,
      requireReasonOnAdjustment: s.requireReasonOnAdjustment,

      pharmacyModuleEnabled: s.pharmacyModuleEnabled,
      allowPartialDispensing: s.allowPartialDispensing,
      requirePharmacistRoleForDispensing: s.requirePharmacistRoleForDispensing,
      requireReversalReason: s.requireReversalReason,

      defaultPaymentMethod: s.defaultPaymentMethod,
      financialPeriodStartMonth: s.financialPeriodStartMonth,
      receiptPrefix: s.receiptPrefix,
      expensePrefix: s.expensePrefix
    });
  }

  saveProfile() {
    const s = this.settings();
    if (!s) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.updateClinicProfile({
      ...this.profileForm(),
      version: s.version
    }).subscribe({
      next: (res) => {
        this.settings.set(res);
        this.successMessage.set('Clinic profile updated successfully.');
        this.loading.set(false);
      },
      error: (err) => this.handleError(err)
    });
  }

  saveBranding() {
    const s = this.settings();
    if (!s) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.updateBranding({
      ...this.brandingForm(),
      version: s.version
    }).subscribe({
      next: (res) => {
        this.settings.set(res);
        this.successMessage.set('Branding settings updated successfully.');
        this.loading.set(false);
      },
      error: (err) => this.handleError(err)
    });
  }

  saveModules() {
    const s = this.settings();
    if (!s) return;

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.updateAppointmentSettings({
      ...this.modulesForm(),
      version: s.version
    }).subscribe({
      next: (res) => {
        this.settings.set(res);
        this.successMessage.set('Module settings updated successfully.');
        this.loading.set(false);
      },
      error: (err) => this.handleError(err)
    });
  }

  saveUserPreferences() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.updateUserPreferences(this.prefForm()).subscribe({
      next: (res) => {
        this.userPreference.set(res);
        this.successMessage.set('User preferences updated successfully.');
        this.loading.set(false);
      },
      error: (err) => this.handleError(err)
    });
  }

  openHolidayModal(h?: ClinicHoliday) {
    if (h) {
      this.editingHoliday.set(h);
      this.holidayName.set(h.name);
      this.holidayArabicName.set(h.arabicName || '');
      this.holidayStartDate.set(h.startDate);
      this.holidayEndDate.set(h.endDate);
      this.holidayReason.set(h.reason || '');
      this.holidayIsFullDay.set(h.isFullDay);
    } else {
      this.editingHoliday.set(null);
      this.holidayName.set('');
      this.holidayArabicName.set('');
      this.holidayStartDate.set('');
      this.holidayEndDate.set('');
      this.holidayReason.set('');
      this.holidayIsFullDay.set(true);
    }
    this.showHolidayModal.set(true);
  }

  closeHolidayModal() {
    this.showHolidayModal.set(false);
  }

  submitHoliday() {
    if (!this.holidayName().trim() || !this.holidayStartDate() || !this.holidayEndDate()) return;

    this.loading.set(true);
    const payload = {
      name: this.holidayName().trim(),
      arabicName: this.holidayArabicName().trim() || null,
      startDate: this.holidayStartDate(),
      endDate: this.holidayEndDate(),
      reason: this.holidayReason().trim() || null,
      isFullDay: this.holidayIsFullDay(),
      isActive: true
    };

    const h = this.editingHoliday();
    const req = h ? this.api.updateHoliday(h.id, payload) : this.api.createHoliday(payload);

    req.subscribe({
      next: () => {
        this.successMessage.set('Holiday saved successfully.');
        this.closeHolidayModal();
        this.loadAllSettings();
      },
      error: (err) => this.handleError(err)
    });
  }

  deleteHoliday(id: string) {
    if (!confirm('Are you sure you want to delete this holiday?')) return;

    this.loading.set(true);
    this.api.deleteHoliday(id).subscribe({
      next: () => {
        this.successMessage.set('Holiday deleted successfully.');
        this.loadAllSettings();
      },
      error: (err) => this.handleError(err)
    });
  }

  getDayName(day: number): string {
    const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return this.loc.language() === 'ar' ? daysAr[day] : daysEn[day];
  }

  private handleError(err: any) {
    this.loading.set(false);
    if (err?.status === 409) {
      this.errorMessage.set('Settings were modified by another user. Please refresh and try again.');
    } else {
      this.errorMessage.set(err?.error?.error || 'An error occurred while saving settings.');
    }
  }
}
