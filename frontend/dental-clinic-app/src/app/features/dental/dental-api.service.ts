import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

export interface ToothChartSummary {
  toothId: string;
  toothNumber: number;
  findings: number[];
  procedures: number[];
  hasEndodonticRecord: boolean;
  lastRecordedAt?: string;
  treatmentProgress?: { id: string; name: string; type: number; status: number; completedAt?: string }[];
}
export interface ExaminationHistoryItem {
  id: string;
  appointmentId: string;
  status: number;
  doctorName: string;
  createdAt: string;
  completedAt?: string;
}
export interface PatientDentalChart {
  patientId: string;
  patientName: string;
  patientNumber: string;
  teeth: ToothChartSummary[];
  recentExaminations: ExaminationHistoryItem[];
  endodonticRecords?: EndodonticRecord[];
}
export interface DentalFinding {
  id: string;
  toothId: string;
  toothNumber: number;
  type: number;
  surfaces: number[];
  cariesClass?: number | null;
  notes?: string;
  createdAt: string;
  createdBy: string;
}
export interface DentalProcedure extends Omit<DentalFinding, 'type'> {
  type: number;
}
export interface EndodonticCanal {
  id: string;
  name: string;
  lengthMm: number | null;
  finalFileSize?: string;
  notes?: string;
}
export interface EndodonticRecord {
  stage?: number | null;
  treatmentId?: string;
  examinationId?: string;
  updatedAt?: string;
  id: string;
  toothId: string;
  toothNumber: number;
  notes?: string;
  canals: EndodonticCanal[];
  createdAt: string;
  createdBy: string;
}
export interface ExaminationDetails {
  id: string;
  patientId: string;
  patientName: string;
  patientNumber: string;
  appointmentId: string;
  appointmentStatus: number;
  doctorUserId: string;
  doctorProfileId?: string;
  doctorName: string;
  status: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  version: string;
  canEdit: boolean;
  canComplete: boolean;
  findings: DentalFinding[];
  procedures: DentalProcedure[];
  endodonticRecords: EndodonticRecord[];
}
export interface DentalRecordRequest {
  toothNumber: number;
  type: number;
  surfaces: number[];
  cariesClass?: number | null;
  notes?: string;
  version: string;
}
export interface EndodonticRequest {
  toothNumber: number;
  notes?: string;
  stage?: number;
  treatmentId?: string;
  canals: { name: string; lengthMm: number | null; finalFileSize?: string; notes?: string }[];
  version: string;
}

@Injectable({ providedIn: 'root' })
export class DentalApiService {
  private readonly http = inject(HttpClient);
  chart(patientId: string) {
    return this.http.get<PatientDentalChart>(`/api/patients/${patientId}/dental`);
  }
  history(patientId: string, take = 20) {
    return this.http.get<ExaminationHistoryItem[]>(`/api/patients/${patientId}/examinations`, {
      params: { take },
    });
  }
  examination(id: string) {
    return this.http.get<ExaminationDetails>(`/api/examinations/${id}`);
  }
  byAppointment(id: string) {
    return this.http.get<ExaminationDetails>(`/api/appointments/${id}/examination`);
  }
  create(appointmentId: string) {
    return this.http.post<{ id: string }>(`/api/appointments/${appointmentId}/examination`, {});
  }
  notes(id: string, notes: string, version: string) {
    return this.http.put<void>(`/api/examinations/${id}`, { notes, version });
  }
  addFinding(id: string, request: DentalRecordRequest) {
    return this.http.post<void>(`/api/examinations/${id}/findings`, request);
  }
  updateFinding(id: string, itemId: string, request: DentalRecordRequest) {
    return this.http.put<void>(`/api/examinations/${id}/findings/${itemId}`, request);
  }
  removeFinding(id: string, itemId: string, version: string) {
    return this.http.delete<void>(`/api/examinations/${id}/findings/${itemId}`, {
      body: { version },
    });
  }
  addProcedure(id: string, request: DentalRecordRequest) {
    return this.http.post<void>(`/api/examinations/${id}/procedures`, request);
  }
  removeProcedure(id: string, itemId: string, version: string) {
    return this.http.delete<void>(`/api/examinations/${id}/procedures/${itemId}`, {
      body: { version },
    });
  }
  addEndodontic(id: string, request: EndodonticRequest) {
    return this.http.post<void>(`/api/examinations/${id}/endodontic`, request);
  }
  updateEndodontic(id: string, itemId: string, request: EndodonticRequest) {
    return this.http.put<void>(`/api/examinations/${id}/endodontic/${itemId}`, request);
  }
  removeEndodontic(id: string, itemId: string, version: string) {
    return this.http.delete<void>(`/api/examinations/${id}/endodontic/${itemId}`, {
      body: { version },
    });
  }
  complete(id: string, version: string) {
    return this.http.post<void>(`/api/examinations/${id}/complete`, { version });
  }
}

