import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface InventoryCategory {
  id: string;
  name: string;
  arabicName?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  arabicName?: string | null;
  sku: string;
  categoryId: string;
  categoryName: string;
  unitOfMeasure: string;
  isActive: boolean;
  minimumStockLevel: number;
  reorderLevel: number;
  currentCost: number;
  currentStock: number;
  totalValue: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  description?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  movementType: number;
  quantity: number;
  unitCost?: number | null;
  totalCost?: number | null;
  occurredAt: string;
  reference: string;
  supplierId?: string | null;
  supplierName?: string | null;
  createdByUserId: string;
  notes?: string | null;
}

export interface InventorySummary {
  totalItems: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockValuation: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/inventory';

  getSummary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${this.baseUrl}/summary`);
  }

  getCategories(): Observable<InventoryCategory[]> {
    return this.http.get<InventoryCategory[]>(`${this.baseUrl}/categories`);
  }

  saveCategory(id: string | null, payload: any): Observable<{ id: string }> {
    return id
      ? this.http.put<{ id: string }>(`${this.baseUrl}/categories/${id}`, payload)
      : this.http.post<{ id: string }>(`${this.baseUrl}/categories`, payload);
  }

  getSuppliers(): Observable<Supplier[]> {
    return this.http.get<Supplier[]>(`${this.baseUrl}/suppliers`);
  }

  saveSupplier(id: string | null, payload: any): Observable<{ id: string }> {
    return id
      ? this.http.put<{ id: string }>(`${this.baseUrl}/suppliers/${id}`, payload)
      : this.http.post<{ id: string }>(`${this.baseUrl}/suppliers`, payload);
  }

  getItems(search?: string, categoryId?: string, lowStockOnly?: boolean): Observable<InventoryItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    if (categoryId) params = params.set('categoryId', categoryId);
    if (lowStockOnly) params = params.set('lowStockOnly', 'true');
    return this.http.get<InventoryItem[]>(`${this.baseUrl}/items`, { params });
  }

  getItemById(id: string): Observable<InventoryItem> {
    return this.http.get<InventoryItem>(`${this.baseUrl}/items/${id}`);
  }

  saveItem(id: string | null, payload: any): Observable<{ id: string }> {
    return id
      ? this.http.put<{ id: string }>(`${this.baseUrl}/items/${id}`, payload)
      : this.http.post<{ id: string }>(`${this.baseUrl}/items`, payload);
  }

  getMovements(itemId?: string, take: number = 50): Observable<StockMovement[]> {
    let params = new HttpParams().set('take', take.toString());
    if (itemId) params = params.set('itemId', itemId);
    return this.http.get<StockMovement[]>(`${this.baseUrl}/movements`, { params });
  }

  receiveStock(payload: {
    itemId: string;
    quantity: number;
    unitCost?: number;
    supplierId?: string;
    reference: string;
    notes?: string;
    postExpenseToFinance: boolean;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/receive`, payload);
  }

  issueStock(payload: {
    itemId: string;
    quantity: number;
    reference: string;
    notes?: string;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/issue`, payload);
  }

  adjustStock(payload: {
    itemId: string;
    movementType: number;
    quantity: number;
    reasonReference: string;
    notes?: string;
  }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.baseUrl}/adjust`, payload);
  }
}
