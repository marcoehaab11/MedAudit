import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApiService, InventoryItem, InventoryCategory, Supplier, StockMovement, InventorySummary } from '../../core/inventory-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  styleUrl: './inventory-page.component.scss',
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-page.component.html',
})
export class InventoryPageComponent implements OnInit {
  private api = inject(InventoryApiService);
  loc = inject(LocalizationService);
  auth = inject(AuthService);

  activeTab = signal<'items' | 'categories' | 'suppliers' | 'movements'>('items');
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  summary = signal<InventorySummary | null>(null);
  items = signal<InventoryItem[]>([]);
  categories = signal<InventoryCategory[]>([]);
  suppliers = signal<Supplier[]>([]);
  movements = signal<StockMovement[]>([]);

  // Filter signals
  searchQuery = signal<string>('');
  selectedCategory = signal<string>('');
  lowStockFilter = signal<boolean>(false);

  // Dialog states
  showItemModal = signal<boolean>(false);
  editingItem = signal<Partial<InventoryItem> | null>(null);

  showMovementModal = signal<'receive' | 'issue' | 'adjust' | null>(null);
  targetItem = signal<InventoryItem | null>(null);

  // Movement Form Fields
  movementQty = signal<number>(1);
  movementCost = signal<number>(0);
  movementSupplierId = signal<string>('');
  movementRef = signal<string>('');
  movementNotes = signal<string>('');
  movementPostExpense = signal<boolean>(false);
  movementAdjustType = signal<number>(4); // 4: AdjustmentIncrease, 5: AdjustmentDecrease

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getSummary().subscribe({
      next: (sum) => this.summary.set(sum),
      error: () => {}
    });

    this.api.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {}
    });

    this.api.getSuppliers().subscribe({
      next: (sups) => this.suppliers.set(sups),
      error: () => {}
    });

    this.loadItems();
  }

  loadItems() {
    this.loading.set(true);
    this.api.getItems(this.searchQuery(), this.selectedCategory(), this.lowStockFilter()).subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || (this.loc.language() === 'ar' ? 'تعذر تحميل أصناف المخزون.' : 'Failed to load inventory items.'));
        this.loading.set(false);
      }
    });
  }

  loadMovements() {
    this.loading.set(true);
    this.api.getMovements(undefined, 50).subscribe({
      next: (data) => {
        this.movements.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || (this.loc.language() === 'ar' ? 'تعذر تحميل سجل الحركات.' : 'Failed to load stock movements.'));
        this.loading.set(false);
      }
    });
  }

  setTab(tab: 'items' | 'categories' | 'suppliers' | 'movements') {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (tab === 'movements') {
      this.loadMovements();
    } else if (tab === 'items') {
      this.loadItems();
    }
  }

  openReceiveModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementCost.set(item.currentCost || 0);
    this.movementSupplierId.set(item.supplierId || '');
    this.movementRef.set('');
    this.movementNotes.set('');
    this.movementPostExpense.set(true);
    this.showMovementModal.set('receive');
  }

  openIssueModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementRef.set('');
    this.movementNotes.set('');
    this.showMovementModal.set('issue');
  }

  openAdjustModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementAdjustType.set(4);
    this.movementRef.set('');
    this.movementNotes.set('');
    this.showMovementModal.set('adjust');
  }

  closeMovementModal() {
    this.showMovementModal.set(null);
    this.targetItem.set(null);
  }

  submitMovement() {
    const item = this.targetItem();
    if (!item) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const mode = this.showMovementModal();

    if (mode === 'receive') {
      this.api.receiveStock({
        itemId: item.id,
        quantity: this.movementQty(),
        unitCost: this.movementCost(),
        supplierId: this.movementSupplierId() || undefined,
        reference: this.movementRef(),
        notes: this.movementNotes(),
        postExpenseToFinance: this.movementPostExpense()
      }).subscribe({
        next: () => {
          this.successMessage.set(this.loc.language() === 'ar' ? 'تم توريد واستلام المخزون بنجاح.' : 'Stock received successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || (this.loc.language() === 'ar' ? 'فشل في توريد المخزون.' : 'Failed to receive stock.'));
          this.loading.set(false);
        }
      });
    } else if (mode === 'issue') {
      this.api.issueStock({
        itemId: item.id,
        quantity: this.movementQty(),
        reference: this.movementRef(),
        notes: this.movementNotes()
      }).subscribe({
        next: () => {
          this.successMessage.set(this.loc.language() === 'ar' ? 'تم صرف المخزون بنجاح.' : 'Stock issued successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.status === 409 ? (err.error?.error || (this.loc.language() === 'ar' ? 'رصيد المخزون غير كافٍ.' : 'Insufficient stock balance.')) : (this.loc.language() === 'ar' ? 'فشل في صرف المخزون.' : 'Failed to issue stock.'));
          this.loading.set(false);
        }
      });
    } else if (mode === 'adjust') {
      this.api.adjustStock({
        itemId: item.id,
        movementType: Number(this.movementAdjustType()),
        quantity: this.movementQty(),
        reasonReference: this.movementRef(),
        notes: this.movementNotes()
      }).subscribe({
        next: () => {
          this.successMessage.set(this.loc.language() === 'ar' ? 'تم تعديل جرد المخزون بنجاح.' : 'Stock adjusted successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.status === 409 ? (err.error?.error || (this.loc.language() === 'ar' ? 'رصيد المخزون لا يسمح بالتخفيض.' : 'Insufficient stock for adjustment.')) : (this.loc.language() === 'ar' ? 'فشل في تعديل المخزون.' : 'Failed to adjust stock.'));
          this.loading.set(false);
        }
      });
    }
  }

  getMovementTypeName(type: number): string {
    const isAr = this.loc.language() === 'ar';
    switch (type) {
      case 1: return isAr ? 'رصيد افتتاحي' : 'Opening Balance';
      case 2: return isAr ? 'توريد / استلام' : 'Receipt';
      case 3: return isAr ? 'صرف عيادة' : 'Issue';
      case 4: return isAr ? 'تسوية بالزيادة (+)' : 'Adjustment (+)';
      case 5: return isAr ? 'تسوية بالنقص (-)' : 'Adjustment (-)';
      case 6: return isAr ? 'مرتجع' : 'Return';
      default: return isAr ? 'حركة مخزون' : 'Movement';
    }
  }
}

