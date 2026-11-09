import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, Input, OnChanges, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { timer } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';

export interface ClinicalHistoryEvent {
  id:string;treatmentId?:string;appointmentId?:string;toothNumbers:number[];procedureName:string;
  step:string;stepEn:string;stepAr:string;performedAt?:string;date?:string;dayEn?:string;dayAr?:string;time?:string;corrected:boolean;
}
export interface PatientClinicalHistory {
  firstExaminationAt?:string;firstExaminationDate?:string;firstExaminationDayEn?:string;firstExaminationDayAr?:string;
  firstExaminationTime?:string;timeZone:string;items:ClinicalHistoryEvent[];page:number;pageSize:number;totalCount:number;uncertainLegacyRecords:number;
}
@Component({selector:'app-patient-clinical-history',standalone:true,template:`
  <section class="clinical-history" aria-label="Patient Medical History">
    <header><div><h2>{{t('Patient Medical History','التاريخ الطبي الزمني للمريض')}}</h2><p>{{t('Executed and saved steps only. Pending plans are separate.','الخطوات المنفذة والمحفوظة فقط. الخطط المستقبلية منفصلة عن هذا السجل.')}}</p></div>
      <button type="button" (click)="load()" [disabled]="loading()">{{t('Refresh','تحديث')}}</button></header>
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (history(); as record) {
      <div class="first-examination"><strong>{{t('First Examination','أول كشف')}}</strong>
        @if(record.firstExaminationAt){<span>{{record.firstExaminationDate}} · {{t(record.firstExaminationDayEn||'',record.firstExaminationDayAr||'')}} · {{record.firstExaminationTime}}</span>}
        @else {<span>{{t('No examination has been recorded yet.','لم يُسجّل كشف حتى الآن.')}}</span>}
        <small>{{record.timeZone}}</small>
      </div>
      @if(record.uncertainLegacyRecords){<p class="legacy-note">{{t('Some older records lack verified step times. Their original records remain available; no steps or times have been invented.','بعض السجلات القديمة لا تحتوي توثيقًا مؤكدًا للخطوات وتوقيتها. سجلاتها الأصلية محفوظة، ولم تُفترض لها خطوات أو أوقات.')}}</p>}
      <div class="history-table"><table><thead><tr><th>{{t('Date','التاريخ')}}</th><th>{{t('Day','اليوم')}}</th><th>{{t('Time','الساعة')}}</th><th>{{t('Procedure','الإجراء')}}</th><th>{{t('Executed Step','الخطوة المنفذة')}}</th></tr></thead><tbody>
        @for(event of record.items;track event.id){<tr [class.corrected]="event.corrected"><td>{{event.date||'—'}}</td><td>{{t(event.dayEn||'—',event.dayAr||'—')}}</td><td>{{event.time||t('Not recorded','غير مسجل')}}</td><td>{{event.procedureName}} @if(event.toothNumbers.length){<small>#{{event.toothNumbers.join(', #')}}</small>}</td><td>{{t(event.stepEn,event.stepAr)}} @if(event.corrected){<strong>{{t('Corrected record','تم تصحيح تسجيله')}}</strong>}</td></tr>}
        @empty{<tr><td colspan="5">{{t('No executed steps have been recorded.','لا توجد خطوات منفذة مسجلة حتى الآن.')}}</td></tr>}
      </tbody></table></div>
      <footer><button type="button" [disabled]="loading()||record.page===1" (click)="load(record.page-1)">{{t('Newer','الأحدث')}}</button><span>{{record.page}} / {{pages()}} · {{record.totalCount}} {{t('events','حدث')}}</span><button type="button" [disabled]="loading()||record.page>=pages()" (click)="load(record.page+1)">{{t('Older','الأقدم')}}</button></footer>
    } @else if(loading()){<p role="status">{{t('Loading clinical history…','جارٍ تحميل التاريخ الطبي…')}}</p>}
  </section>`,styles:`
  :host{display:block}.clinical-history{background:white;border:1px solid #dce8e5;border-radius:14px;padding:20px;margin:16px 0;color:#173d3c}header,footer,.first-examination{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}h2{font-size:1.2rem;margin:0}p,small{color:#607777}button{border:1px solid #bfd9d4;border-radius:8px;background:#eef8f6;color:#08796e;padding:9px 14px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.first-examination{background:#eff9f7;padding:14px;border-radius:10px}.history-table{overflow-x:auto;margin:18px 0}table{width:100%;border-collapse:collapse;text-align:start;font-size:.9rem}th,td{padding:12px;border-bottom:1px solid #e6efed;text-align:start;vertical-align:top}td small,td strong{display:block;margin-top:4px}.legacy-note{font-size:.85rem}.corrected{color:#7f6662;background:#fff8f5}@media print{button{display:none}.history-table{overflow:visible}.clinical-history{break-inside:auto}tr{break-inside:avoid}}
`})
export class PatientClinicalHistoryComponent implements OnChanges,OnInit {
  @Input({required:true}) patientId='';
  private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly i18n=inject(LocalizationService);private readonly destroyRef=inject(DestroyRef);
  readonly history=signal<PatientClinicalHistory|null>(null);readonly error=signal('');readonly loading=signal(false);
  t(en:string,ar:string){return this.i18n.language()==='ar'?ar:en;}
  ngOnChanges(){this.history.set(null);this.loading.set(false);this.load(1);}
  ngOnInit(){timer(30000,30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(()=>{if(document.visibilityState==='visible')this.load(this.history()?.page??1,true);});}
  pages(){const record=this.history();return Math.max(1,Math.ceil((record?.totalCount??0)/(record?.pageSize??100)));}
  load(page=this.history()?.page??1,quiet=false){
    if(!this.patientId||this.loading())return;
    if(!this.auth.hasPermission('Patients.ViewMedicalHistory')||!this.auth.hasPermission('Dental.View')){this.history.set(null);this.error.set(this.t('Your role does not allow clinical history access.','صلاحياتك لا تسمح بعرض التاريخ الطبي السريري.'));return;}
    this.loading.set(true);this.error.set('');const patientId=this.patientId;
    this.http.get<PatientClinicalHistory>(`/api/patients/${patientId}/clinical-history`,{params:{page:String(page),pageSize:'100'}}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:record=>{if(this.patientId!==patientId)return;this.history.set(record);this.loading.set(false);},
      error:failure=>{if(this.patientId!==patientId)return;if(failure.status===401||failure.status===403)this.history.set(null);this.error.set(this.t('Could not load clinical history. Please retry.','تعذر تحميل التاريخ الطبي. أعد المحاولة.'));this.loading.set(false);}
    });
  }
}
