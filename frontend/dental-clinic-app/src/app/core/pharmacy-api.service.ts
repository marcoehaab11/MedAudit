import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PharmacyDashboardSummary {
  waitingForDispensingCount: number;
  partiallyDispensedCount: number;
  fullyDispensedTodayCount: number;
  dispensingCountToday: number;
  lowStockMedicationCount: number;
  recentActivity: PharmacyDispensingSummary[];
}

export interface PharmacyDispensingSummary {
  id: string;
  dispensingNumber: string;
  prescriptionId: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  status: number; // 1 = PartiallyDispensed, 2 = FullyDispensed, 3 = Reversed
  dispensedAt: string;
  dispensedByUserId: string;
  dispensedByUserName?: string | null;
  itemCount: number;
}

export interface PharmacyDispensingDetail {
  id: string;
  dispensingNumber: string;
  prescriptionId: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  status: number;
  dispensedAt: string;
  dispensedByUserId: string;
  dispensedByUserName?: string | null;
  notes?: string | null;
  version: string;
  items: PharmacyDispensingItemDetail[];
  reversal?: PharmacyDispensingReversal | null;
}

export interface PharmacyDispensingItemDetail {
  id: string;
  prescriptionItemId: string;
  medicationName: string;
  inventoryItemId: string;
  inventoryItemName: string;
  inventoryItemSku: string;
  quantityDispensed: number;
  unitCost?: number | null;
  totalCost?: number | null;
  stockMovementId: string;
}

export interface PharmacyDispensingReversal {
  id: string;
  reversedByUserId: string;
  reversedByUserName?: string | null;
  reversedAt: string;
  reason: string;
  stockMovementId: string;
}

export interface PrescriptionReadyForDispensing {
  prescriptionId: string;
  prescriptionNumber: string;
  patientId: string;
  patientName: string;
  doctorProfileId: string;
  doctorName: string;
  issuedAt: string;
  status: string;
  items: PrescriptionItemDispensingState[];
}

export interface PrescriptionItemDispensingState {
  prescriptionItemId: string;
  medicationId?: string | null;
  medicationName: string;
  genericName?: string | null;
  strength?: string | null;
  form?: number | null;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  prescribedQuantity?: number | null;
  totalDispensedQuantity: number;
  remainingQuantity: number;
  mappedInventoryItemId?: string | null;
  mappedInventoryItemName?: string | null;
  availableInventoryStock: number;
}

export interface MedicationCatalogPharmacy {
  id: string;
  name: string;
  genericName?: string | null;
  strength?: string | null;
  form?: number | null;
  notes?: string | null;
  barcode?: string | null;
  manufacturer?: string | null;
  reorderLevel?: number | null;
  inventoryItemId?: string | null;
  inventoryItemName?: string | null;
  inventoryItemSku?: string | null;
  availableStock?: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPharmacyHistoryItem {
  dispensingId: string;
  dispensingNumber: string;
  prescriptionId: string;
  prescriptionNumber: string;
  medicationName: string;
  quantityPrescribed: number;
  quantityDispensed: number;
  quantityRemaining: number;
  status: number;
  dispensedAt: string;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class PharmacyApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/pharmacy';

  getDashboardSummary(): Observable<PharmacyDashboardSummary> {
    return this.http.get<PharmacyDashboardSummary>(`${this.baseUrl}/dashboard`);
  }

  getDispensings(
    patientId?: string,
    prescriptionNumber?: string,
    medicationSearch?: string,
    pharmacistId?: string,
    fromDate?: string,
    toDate?: string,
    status?: number,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<PagedResult<PharmacyDispensingSummary>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (patientId) params = params.set('patientId', patientId);
    if (prescriptionNumber) params = params.set('prescriptionNumber', prescriptionNumber);
    if (medicationSearch) params = params.set('medicationSearch', medicationSearch);
    if (pharmacistId) params = params.set('pharmacistId', pharmacistId);
    if (fromDate) params = params.set('fromDate', fromDate);
    if (toDate) params = params.set('toDate', toDate);
    if (status !== undefined && status !== null) params = params.set('status', status.toString());

    return this.http.get<PagedResult<PharmacyDispensingSummary>>(`${this.baseUrl}/dispensings`, { params });
  }

  getDispensingById(id: string): Observable<PharmacyDispensingDetail> {
    return this.http.get<PharmacyDispensingDetail>(`${this.baseUrl}/dispensings/${id}`);
  }

  getPrescriptionsReadyForDispensing(
    search?: string,
    pageNumber: number = 1,
    pageSize: number = 20
  ): Observable<PagedResult<PrescriptionReadyForDispensing>> {
    let params = new HttpParams()
      .set('pageNumber', pageNumber.toString())
      .set('pageSize', pageSize.toString());

    if (search) params = params.set('search', search);

    return this.http.get<PagedResult<PrescriptionReadyForDispensing>>(`${this.baseUrl}/prescriptions`, { params });
  }

  getPrescriptionDispensingDetail(id: string): Observable<PrescriptionReadyForDispensing> {
    return this.http.get<PrescriptionReadyForDispensing>(`${this.baseUrl}/prescriptions/${id}`);
  }

  dispensePrescription(
    prescriptionId: string,
    items: { prescriptionItemId: string; inventoryItemId: string; quantityToDispense: number }[],
    notes?: string
  ): Observable<PharmacyDispensingDetail> {
    return this.http.post<PharmacyDispensingDetail>(`${this.baseUrl}/prescriptions/${prescriptionId}/dispense`, {
      items,
      notes
    });
  }

  reverseDispensing(dispensingId: string, reason: string): Observable<PharmacyDispensingDetail> {
    return this.http.post<PharmacyDispensingDetail>(`${this.baseUrl}/dispensings/${dispensingId}/reverse`, {
      reason
    });
  }

  getMedicationCatalog(search?: string, activeOnly?: boolean): Observable<MedicationCatalogPharmacy[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (activeOnly) params = params.set('activeOnly', 'true');
    return this.http.get<MedicationCatalogPharmacy[]>(`${this.baseUrl}/catalog`, { params });
  }

  updateInventoryMapping(
    medicationId: string,
    inventoryItemId?: string | null,
    barcode?: string | null,
    manufacturer?: string | null,
    reorderLevel?: number | null
  ): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/catalog/${medicationId}/inventory-mapping`, {
      inventoryItemId,
      barcode,
      manufacturer,
      reorderLevel
    });
  }

  getPatientPharmacyHistory(patientId: string): Observable<PatientPharmacyHistoryItem[]> {
    return this.http.get<PatientPharmacyHistoryItem[]>(`${this.baseUrl}/patients/${patientId}/history`);
  }
}
