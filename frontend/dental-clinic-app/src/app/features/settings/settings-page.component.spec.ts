import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SettingsPageComponent } from './settings-page.component';
import { SettingsApiService } from '../../core/settings-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';

describe('SettingsPageComponent', () => {
  let component: SettingsPageComponent;
  let fixture: ComponentFixture<SettingsPageComponent>;

  const mockSettings = {
    tenantId: 't-123',
    clinicName: 'MedDentist Clinic',
    arabicName: 'عيادة ميدي دنتست',
    slug: 'med-dentist',
    phone: '+201000',
    email: 'admin@med.com',
    address: '123 Main St',
    city: 'Cairo',
    country: 'Egypt',
    description: 'Dental Care',
    primaryColor: '#1e40af',
    secondaryColor: '#0284c7',
    accentColor: '#f59e0b',
    defaultLanguage: 'en',
    supportedLanguages: 'en,ar',
    rtlEnabled: false,
    timeZone: 'UTC',
    currency: 'USD',
    currencySymbol: '$',
    decimalPrecision: 2,
    symbolPosition: 'Before',
    publicBookingEnabled: true,
    publicBookingHorizonDays: 30,
    publicPriceVisibility: true,
    defaultAppointmentDurationMinutes: 30,
    minimumBookingNoticeHours: 2,
    maxBookingHorizonDays: 90,
    cancellationNoticeHours: 24,
    allowSameDayBooking: true,
    prescriptionPrefix: 'RX-',
    defaultPrescriptionLanguage: 'en',
    defaultInstructionsLanguage: 'en',
    showClinicHeaderOnPdf: true,
    showDoctorSignatureOnPdf: true,
    enableQrCodeOnPrint: true,
    appointmentsNotificationEnabled: true,
    prescriptionsNotificationEnabled: true,
    publicBookingNotificationEnabled: true,
    inAppNotificationsEnabled: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    whatsAppNotificationsEnabled: false,
    allowNegativeStock: false,
    requireSupplierOnReceipt: false,
    requireReasonOnAdjustment: true,
    pharmacyModuleEnabled: true,
    allowPartialDispensing: true,
    requirePharmacistRoleForDispensing: false,
    requireReversalReason: true,
    defaultPaymentMethod: 'Cash',
    financialPeriodStartMonth: 1,
    receiptPrefix: 'REC-',
    expensePrefix: 'EXP-',
    version: '00000000-0000-0000-0000-000000000001'
  };

  const mockSettingsApi = {
    getSettings: vi.fn().mockReturnValue(of(mockSettings)),
    getClinicHours: vi.fn().mockReturnValue(of([])),
    getClinicHolidays: vi.fn().mockReturnValue(of([])),
    getUserPreferences: vi.fn().mockReturnValue(of({ language: 'en', theme: 'Light', dateFormat: 'YYYY-MM-DD', timeFormat: '24h', startOfWeek: 0, defaultCalendarView: 'timeGridWeek' }))
  };

  const mockLocalizationService = {
    language: signal('en'),
    direction: signal('ltr')
  };

  const mockAuthService = {
    hasPermission: vi.fn().mockReturnValue(true)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPageComponent],
      providers: [
        { provide: SettingsApiService, useValue: mockSettingsApi },
        { provide: LocalizationService, useValue: mockLocalizationService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load settings', () => {
    expect(component).toBeTruthy();
    expect(mockSettingsApi.getSettings).toHaveBeenCalled();
  });
});
