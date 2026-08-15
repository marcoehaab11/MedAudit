import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { InventoryPageComponent } from './inventory-page.component';
import { InventoryApiService } from '../../core/inventory-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { of, throwError } from 'rxjs';

describe('InventoryPageComponent', () => {
  let component: InventoryPageComponent;
  let fixture: ComponentFixture<InventoryPageComponent>;
  let apiMock: any;
  let authMock: any;

  beforeEach(async () => {
    apiMock = {
      getSummary: vi.fn().mockReturnValue(
        of({ totalItems: 5, lowStockCount: 1, outOfStockCount: 0, totalStockValuation: 1500 })
      ),
      getCategories: vi.fn().mockReturnValue(of([])),
      getSuppliers: vi.fn().mockReturnValue(of([])),
      getItems: vi.fn().mockReturnValue(
        of([
          {
            id: 'item-1',
            name: 'Composite Resin A2',
            sku: 'COMP-A2',
            categoryId: 'cat-1',
            categoryName: 'Consumables',
            unitOfMeasure: 'Syringe',
            isActive: true,
            minimumStockLevel: 2,
            reorderLevel: 5,
            currentCost: 150,
            currentStock: 10,
            totalValue: 1500,
            isLowStock: false,
            isOutOfStock: false,
            createdAt: '2026-08-15T00:00:00Z',
            updatedAt: '2026-08-15T00:00:00Z',
          },
        ])
      ),
      getMovements: vi.fn().mockReturnValue(of([])),
      receiveStock: vi.fn().mockReturnValue(of({ id: 'mov-1' })),
      issueStock: vi.fn().mockReturnValue(of({ id: 'mov-2' })),
      adjustStock: vi.fn().mockReturnValue(of({ id: 'mov-3' })),
    };

    authMock = {
      hasPermission: vi.fn().mockReturnValue(true),
    };

    await TestBed.configureTestingModule({
      imports: [InventoryPageComponent],
      providers: [
        { provide: InventoryApiService, useValue: apiMock },
        { provide: AuthService, useValue: authMock },
        LocalizationService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InventoryPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load inventory summary and items', () => {
    expect(component).toBeTruthy();
    expect(component.summary()?.totalItems).toBe(5);
    expect(component.items().length).toBe(1);
    expect(component.items()[0].sku).toBe('COMP-A2');
  });

  it('handles 409 Conflict gracefully on stock issue', () => {
    apiMock.issueStock.mockReturnValue(
      throwError(() => ({ status: 409, error: { error: 'Insufficient stock balance.' } }))
    );

    component.targetItem.set(component.items()[0]);
    component.showMovementModal.set('issue');
    component.submitMovement();

    expect(component.errorMessage()).toBe('Insufficient stock balance.');
  });
});
