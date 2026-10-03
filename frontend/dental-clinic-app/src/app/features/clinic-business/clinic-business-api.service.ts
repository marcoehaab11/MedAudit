import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface LabVendor { id: string; name: string; phone?: string; notes?: string }
export interface LabCase { id: string; vendorId: string; patientId: string; treatmentId?: string; statementId?: string; workType: string; teeth?: string; material?: string; shade?: string; instructions?: string; dueAt: string; cost: number; status: number; remakeCount: number; lastUpdateNote?: string }
export interface LabStatement { id: string; vendorId: string; reference: string; createdAt: string }
export interface LabStatementDetail { statement: LabStatement; cases: { labCase: LabCase; paid: number; outstanding: number }[]; payments: { id: string; caseId: string; amount: number; reference?: string; paidAt: string }[]; total: number; paid: number }
export interface Payer { id: string; name: string; kind: number; contractNumber?: string }
export interface Policy { id: string; patientId: string; payerId: string; memberNumber: string; expiresAt?: string; referralNumber?: string }
export interface Claim { id: string; patientInsuranceId: string; patientId: string; treatmentId: string; batchId?: string; requestedAmount: number; patientShare: number; approvedAmount?: number; status: number; approvalNumber?: string; externalClaimNumber?: string; notes?: string }
export interface Batch { id: string; payerId: string; reference: string; createdAt: string }
export interface BatchDetail { batch: Batch; claims: { claim: Claim; paid: number; outstanding: number }[]; payments: { claimId: string; amount: number; reference?: string; paidAt: string }[]; requested: number; paid: number }
export interface Activity { id: string; action: string; actorName?: string; details?: string; occurredAt: string }
export interface ClaimDetail { claim: Claim; settlements: { id: string; amount: number; reference?: string; paidAt: string }[]; paid: number; outstanding: number }
export interface InsuranceSummary { outstanding: number; currency: string }
export interface ClinicDocument { id: string; fileName: string; contentType: string; uploadedAt: string }
export interface Allocation { itemId: string; amount: number }

@Injectable({ providedIn: 'root' })
export class ClinicBusinessApi {
  private readonly http = inject(HttpClient);
  vendors() { return this.http.get<LabVendor[]>('/api/lab/vendors'); }
  addVendor(value: { name: string; phone?: string; notes?: string }) { return this.http.post<{ id: string }>('/api/lab/vendors', value); }
  cases(patientId?: string) { return this.http.get<LabCase[]>('/api/lab/cases', { params: patientId ? { patientId } : {} }); }
  addCase(value: object) { return this.http.post<{ id: string }>('/api/lab/cases', value); }
  caseStatus(id: string, status: number, note?: string) { return this.http.post<void>(`/api/lab/cases/${id}/status`, { status, note }); }
  statements() { return this.http.get<LabStatement[]>('/api/lab/statements'); }
  addStatement(vendorId: string, caseIds: string[], reference?: string) { return this.http.post<{ id: string }>('/api/lab/statements', { vendorId, caseIds, reference }); }
  statement(id: string) { return this.http.get<LabStatementDetail>(`/api/lab/statements/${id}`); }
  settleStatement(id: string, allocations: Allocation[], reference?: string) { return this.http.post<void>(`/api/lab/statements/${id}/payments`, { batchId: null, allocations, reference }); }
  caseHistory(id: string) { return this.http.get<Activity[]>(`/api/lab/cases/${id}/history`); }
  caseDocuments(id: string) { return this.http.get<ClinicDocument[]>(`/api/lab/cases/${id}/documents`); }
  uploadCaseDocument(id: string, file: File) { const body = new FormData(); body.append('file', file); return this.http.post<{ id: string }>(`/api/lab/cases/${id}/documents`, body); }
  downloadCaseDocument(id: string) { return this.http.get(`/api/lab/documents/${id}`, { responseType: 'blob' }); }
  payers() { return this.http.get<Payer[]>('/api/insurance/payers'); }
  addPayer(value: { name: string; kind: number; contractNumber?: string }) { return this.http.post<{ id: string }>('/api/insurance/payers', value); }
  policies(patientId?: string) { return this.http.get<Policy[]>('/api/insurance/policies', { params: patientId ? { patientId } : {} }); }
  addPolicy(value: object) { return this.http.post<{ id: string }>('/api/insurance/policies', value); }
  claims(patientId?: string) { return this.http.get<Claim[]>('/api/insurance/claims', { params: patientId ? { patientId } : {} }); }
  insuranceSummary() { return this.http.get<InsuranceSummary>('/api/insurance/summary'); }
  claim(id: string) { return this.http.get<ClaimDetail>(`/api/insurance/claims/${id}`); }
  addClaim(value: object) { return this.http.post<{ id: string }>('/api/insurance/claims', value); }
  claimStatus(id: string, value: object) { return this.http.post<void>(`/api/insurance/claims/${id}/status`, value); }
  claimHistory(id: string) { return this.http.get<Activity[]>(`/api/insurance/claims/${id}/history`); }
  claimDocuments(id: string) { return this.http.get<ClinicDocument[]>(`/api/insurance/claims/${id}/documents`); }
  uploadClaimDocument(id: string, file: File) { const body = new FormData(); body.append('file', file); return this.http.post<{ id: string }>(`/api/insurance/claims/${id}/documents`, body); }
  downloadClaimDocument(id: string) { return this.http.get(`/api/insurance/documents/${id}`, { responseType: 'blob' }); }
  batches() { return this.http.get<Batch[]>('/api/insurance/batches'); }
  addBatch(payerId: string, claimIds: string[], reference?: string) { return this.http.post<{ id: string }>('/api/insurance/batches', { payerId, claimIds, reference }); }
  batch(id: string) { return this.http.get<BatchDetail>(`/api/insurance/batches/${id}`); }
  settleClaims(batchId: string | null, allocations: Allocation[], reference?: string) { return this.http.post<void>('/api/insurance/settlements', { batchId, allocations, reference }); }
}
