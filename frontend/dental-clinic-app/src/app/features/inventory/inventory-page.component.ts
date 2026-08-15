import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApiService, InventoryItem, InventoryCategory, Supplier, StockMovement, InventorySummary } from '../../core/inventory-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-inventory-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory-page.component.html',
  styleUrls: ['./inventory-page.component.scss']
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
        this.errorMessage.set(err?.error?.error || 'Failed to load inventory items.');
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
        this.errorMessage.set(err?.error?.error || 'Failed to load stock movements.');
        this.loading.set(false);
      }
    });
  }

  setTab(tab: 'items' | 'categories' | 'suppliers' | 'movements') {
    this.activeTab.set(tab);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (tab === 'items') this.loadItems();
    if (tab === 'movements') this.loadMovements();
  }

  openReceiveModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementCost.set(item.currentCost);
    this.movementSupplierId.set(item.supplierId || '');
    this.movementRef.set(`PO-${Date.now().toString().slice(-6)}`);
    this.movementNotes.set('');
    this.movementPostExpense.set(false);
    this.showMovementModal.set('receive');
  }

  openIssueModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementRef.set(`USAGE-${Date.now().toString().slice(-6)}`);
    this.movementNotes.set('');
    this.showMovementModal.set('issue');
  }

  openAdjustModal(item: InventoryItem) {
    this.targetItem.set(item);
    this.movementQty.set(1);
    this.movementAdjustType.set(4);
    this.movementRef.set(`ADJ-${Date.now().toString().slice(-6)}`);
    this.movementNotes.set('');
    this.showMovementModal.set('adjust');
  }

  closeMovementModal() {
    this.showMovementModal.set(null);
    this.targetItem.set(null);
  }

  submitMovement() {
    const item = this.targetItem();
    const mode = this.showMovementModal();
    if (!item || !mode) return;

    this.loading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

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
          this.successMessage.set('Stock received successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.error?.error || 'Failed to receive stock.');
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
          this.successMessage.set('Stock issued successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          // Handles 409 Conflict cleanly
          this.errorMessage.set(err?.status === 409 ? (err.error?.error || 'Insufficient stock balance.') : 'Failed to issue stock.');
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
          this.successMessage.set('Stock adjusted successfully.');
          this.closeMovementModal();
          this.loadAllData();
        },
        error: (err) => {
          this.errorMessage.set(err?.status === 409 ? (err.error?.error || 'Insufficient stock for adjustment.') : 'Failed to adjust stock.');
          this.loading.set(false);
        }
      });
    }
  }

  getMovementTypeName(type: number): string {
    switch (type) {
      case 1: return 'Opening Balance';
      case 2: return 'Receipt';
      case 3: return 'Issue';
      case 4: return 'Adjustment (+)';
      case 5: return 'Adjustment (-)';
      case 6: return 'Return';
      default: return 'Movement';
    }
  }
}
