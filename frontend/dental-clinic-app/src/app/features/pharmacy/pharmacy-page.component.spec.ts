import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PharmacyPageComponent } from './pharmacy-page.component';
import { PharmacyApiService } from '../../core/pharmacy-api.service';
import { InventoryApiService } from '../../core/inventory-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { of } from 'rxjs';
import { signal } from '@angular/core';

describe('PharmacyPageComponent', () => {
  let component: PharmacyPageComponent;
  let fixture: ComponentFixture<PharmacyPageComponent>;

  const mockPharmacyApi = {
    getDashboardSummary: vi.fn().mockReturnValue(of({
      waitingForDispensingCount: 2,
      partiallyDispensedCount: 1,
      fullyDispensedTodayCount: 5,
      dispensingCountToday: 6,
      lowStockMedicationCount: 0,
      recentActivity: []
    })),
    getPrescriptionsReadyForDispensing: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 })),
    getDispensings: vi.fn().mockReturnValue(of({ items: [], totalCount: 0, pageNumber: 1, pageSize: 20 })),
    getMedicationCatalog: vi.fn().mockReturnValue(of([]))
  };

  const mockInventoryApi = {
    getItems: vi.fn().mockReturnValue(of([]))
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
      imports: [PharmacyPageComponent],
      providers: [
        { provide: PharmacyApiService, useValue: mockPharmacyApi },
        { provide: InventoryApiService, useValue: mockInventoryApi },
        { provide: LocalizationService, useValue: mockLocalizationService },
        { provide: AuthService, useValue: mockAuthService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PharmacyPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the component and load dashboard data', () => {
    expect(component).toBeTruthy();
    expect(mockPharmacyApi.getDashboardSummary).toHaveBeenCalled();
  });
});
