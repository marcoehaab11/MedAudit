import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  PharmacyApiService,
  PharmacyDashboardSummary,
  PharmacyDispensingSummary,
  PharmacyDispensingDetail,
  PrescriptionReadyForDispensing,
  MedicationCatalogPharmacy
} from '../../core/pharmacy-api.service';
import { InventoryApiService, InventoryItem } from '../../core/inventory-api.service';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-pharmacy-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pharmacy-page.component.html',
  styleUrls: ['./pharmacy-page.component.scss']
})
export class PharmacyPageComponent implements OnInit {
  private api = inject(PharmacyApiService);
  private inventoryApi = inject(InventoryApiService);
  loc = inject(LocalizationService);
  auth = inject(AuthService);

  activeTab = signal<'dashboard' | 'prescriptions' | 'dispensings' | 'catalog'>('dashboard');
  loading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  summary = signal<PharmacyDashboardSummary | null>(null);
  prescriptions = signal<PrescriptionReadyForDispensing[]>([]);
  dispensings = signal<PharmacyDispensingSummary[]>([]);
  catalog = signal<MedicationCatalogPharmacy[]>([]);
  inventoryItems = signal<InventoryItem[]>([]);

  // Search & Filters
  searchQuery = signal<string>('');

  // Selected Detail Modals
  selectedDispensingDetail = signal<PharmacyDispensingDetail | null>(null);
  selectedPrescriptionDetail = signal<PrescriptionReadyForDispensing | null>(null);

  // Dispensing Form State
  dispenseItemsForm = signal<{ prescriptionItemId: string; inventoryItemId: string; quantityToDispense: number; maxQuantity: number; medicationName: string }[]>([]);
  dispenseNotes = signal<string>('');

  // Reversal Form State
  showReversalModal = signal<boolean>(false);
  reversalReason = signal<string>('');

  // Inventory Mapping Modal
  showMappingModal = signal<boolean>(false);
  editingMedication = signal<MedicationCatalogPharmacy | null>(null);
  selectedInventoryItemId = signal<string>('');
  barcodeInput = signal<string>('');
  manufacturerInput = signal<string>('');
  reorderLevelInput = signal<number | null>(null);

  ngOnInit() {
    this.loadAllData();
  }

  loadAllData() {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.getDashboardSummary().subscribe({
      next: (sum) => this.summary.set(sum),
      error: (err) => this.errorMessage.set(err?.error?.error || 'Failed to load pharmacy dashboard.')
    });

    this.api.getPrescriptionsReadyForDispensing().subscribe({
      next: (res) => this.prescriptions.set(res.items),
      error: (err) => this.errorMessage.set(err?.error?.error || 'Failed to load prescriptions.')
    });

    this.api.getDispensings().subscribe({
      next: (res) => {
        this.dispensings.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || 'Failed to load dispensing history.');
        this.loading.set(false);
      }
    });

    this.api.getMedicationCatalog().subscribe({
      next: (items) => this.catalog.set(items)
    });

    this.inventoryApi.getItems().subscribe({
      next: (items) => this.inventoryItems.set(items)
    });
  }

  openDispenseModal(rx: PrescriptionReadyForDispensing) {
    this.selectedPrescriptionDetail.set(rx);
    const formItems = rx.items.map(item => ({
      prescriptionItemId: item.prescriptionItemId,
      inventoryItemId: item.mappedInventoryItemId || '',
      quantityToDispense: item.remainingQuantity > 0 ? item.remainingQuantity : 1,
      maxQuantity: item.remainingQuantity,
      medicationName: item.medicationName
    }));
    this.dispenseItemsForm.set(formItems);
    this.dispenseNotes.set('');
  }

  closeDispenseModal() {
    this.selectedPrescriptionDetail.set(null);
  }

  submitDispense() {
    const rx = this.selectedPrescriptionDetail();
    if (!rx) return;

    const validItems = this.dispenseItemsForm().filter(i => i.inventoryItemId && i.quantityToDispense > 0);
    if (validItems.length === 0) {
      this.errorMessage.set('Please select an inventory item and enter a quantity to dispense for at least one medication.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.api.dispensePrescription(
      rx.prescriptionId,
      validItems.map(i => ({
        prescriptionItemId: i.prescriptionItemId,
        inventoryItemId: i.inventoryItemId,
        quantityToDispense: i.quantityToDispense
      })),
      this.dispenseNotes()
    ).subscribe({
      next: (detail) => {
        this.successMessage.set(`Dispensing #${detail.dispensingNumber} created successfully.`);
        this.closeDispenseModal();
        this.loadAllData();
      },
      error: (err) => {
        this.loading.set(false);
        if (err.status === 409) {
          this.errorMessage.set(err.error?.error || 'Dispensing failed due to a stock or concurrency conflict.');
        } else {
          this.errorMessage.set(err.error?.error || 'Failed to submit dispensing.');
        }
      }
    });
  }

  viewDispensingDetail(id: string) {
    this.loading.set(true);
    this.api.getDispensingById(id).subscribe({
      next: (detail) => {
        this.selectedDispensingDetail.set(detail);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.error || 'Failed to load dispensing details.');
        this.loading.set(false);
      }
    });
  }

  closeDetailModal() {
    this.selectedDispensingDetail.set(null);
  }

  openReversalModal() {
    this.reversalReason.set('');
    this.showReversalModal.set(true);
  }

  closeReversalModal() {
    this.showReversalModal.set(false);
  }

  submitReversal() {
    const detail = this.selectedDispensingDetail();
    if (!detail || !this.reversalReason().trim()) return;

    this.loading.set(true);
    this.api.reverseDispensing(detail.id, this.reversalReason().trim()).subscribe({
      next: (updated) => {
        this.successMessage.set(`Dispensing #${updated.dispensingNumber} has been reversed and stock returned.`);
        this.selectedDispensingDetail.set(updated);
        this.showReversalModal.set(false);
        this.loadAllData();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.error || 'Failed to reverse dispensing.');
      }
    });
  }

  openMappingModal(med: MedicationCatalogPharmacy) {
    this.editingMedication.set(med);
    this.selectedInventoryItemId.set(med.inventoryItemId || '');
    this.barcodeInput.set(med.barcode || '');
    this.manufacturerInput.set(med.manufacturer || '');
    this.reorderLevelInput.set(med.reorderLevel || null);
    this.showMappingModal.set(true);
  }

  closeMappingModal() {
    this.showMappingModal.set(false);
    this.editingMedication.set(null);
  }

  submitMapping() {
    const med = this.editingMedication();
    if (!med) return;

    this.loading.set(true);
    this.api.updateInventoryMapping(
      med.id,
      this.selectedInventoryItemId() || null,
      this.barcodeInput() || null,
      this.manufacturerInput() || null,
      this.reorderLevelInput()
    ).subscribe({
      next: () => {
        this.successMessage.set(`Inventory mapping for '${med.name}' updated.`);
        this.closeMappingModal();
        this.loadAllData();
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMessage.set(err?.error?.error || 'Failed to update inventory mapping.');
      }
    });
  }

  getStatusBadgeClass(status: number): string {
    switch (status) {
      case 1: return 'badge-warning'; // PartiallyDispensed
      case 2: return 'badge-success'; // FullyDispensed
      case 3: return 'badge-danger';  // Reversed
      default: return 'badge-secondary';
    }
  }

  getStatusText(status: number): string {
    switch (status) {
      case 1: return this.loc.language() === 'ar' ? 'صرف جزئي' : 'Partially Dispensed';
      case 2: return this.loc.language() === 'ar' ? 'صرف كامل' : 'Fully Dispensed';
      case 3: return this.loc.language() === 'ar' ? 'مسترجع' : 'Reversed';
      default: return 'Unknown';
    }
  }
}
