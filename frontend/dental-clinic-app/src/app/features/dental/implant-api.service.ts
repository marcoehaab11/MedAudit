import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ImplantWorkflow } from './implant-fields';
export interface ImplantDetails { id:string; patientId:string; patientName:string; patientNumber:string; patientAge?:number; toothNumber:number; doctorProfileId:string; doctorName:string; treatmentId?:string; workflow:ImplantWorkflow; completedStep:number; version:string; }
export interface ImplantFile { id:string; section:string; fileName:string; contentType:string; preview?:string; }
@Injectable({providedIn:'root'})
export class ImplantApiService {
  private readonly http = inject(HttpClient);
  list(patientId:string) { return this.http.get<ImplantDetails[]>(`/api/patients/${patientId}/implants`); }
  create(patientId:string,toothNumber:number,appointmentId:string,treatmentId?:string) { return this.http.post<ImplantDetails>(`/api/patients/${patientId}/implants`,{toothNumber,appointmentId,treatmentId}); }
  save(record:ImplantDetails,workflow:ImplantWorkflow,completeStep?:number,confirmedVisitId?:string,confirmedVisitStage?:number,appointmentId?:string) { return this.http.put<ImplantDetails>(`/api/implants/${record.id}`,{version:record.version,workflow,completeStep,confirmedVisitId,confirmedVisitStage,appointmentId}); }
  files(id:string) { return this.http.get<ImplantFile[]>(`/api/implants/${id}/files`); }
  upload(id:string,section:string,file:File) { const form = new FormData(); form.append('section',section); form.append('file',file); return this.http.post<ImplantFile>(`/api/implants/${id}/files`,form); }
  blob(id:string,fileId:string) { return this.http.get(`/api/implants/${id}/files/${fileId}`,{responseType:'blob'}); }
  remove(id:string,fileId:string) { return this.http.delete(`/api/implants/${id}/files/${fileId}`); }
}
