import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, Input, OnChanges, OnInit, computed, inject, signal } from '@angular/core';
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
@Component({selector:'app-patient-clinical-history',standalone:true,imports:[NgTemplateOutlet],template:`
  <section class="clinical-history" [attr.aria-label]="t('Patient Medical History','التاريخ الطبي الزمني للمريض')">
    <header><div><h2>{{t('Patient Medical History','التاريخ الطبي الزمني للمريض')}}</h2><p>{{t('Visit dates and recorded procedures','تواريخ الزيارات والإجراءات المسجلة')}}</p></div>
      <button type="button" (click)="load()" [disabled]="loading()">{{t('Refresh','تحديث')}}</button></header>
    @if (error()) { <p role="alert">{{error()}}</p> }
    @if (history(); as record) {
      <div class="first-examination"><strong>{{t('First Examination','أول كشف')}}</strong>
        @if(record.firstExaminationAt){<span>{{record.firstExaminationDate}} · {{t(record.firstExaminationDayEn||'',record.firstExaminationDayAr||'')}} · {{record.firstExaminationTime}}</span>}
        @else {<span>{{t('No examination has been recorded yet.','لم يُسجّل كشف حتى الآن.')}}</span>}
        <small>{{record.timeZone}}</small>
      </div>
      @if(record.uncertainLegacyRecords){<p class="legacy-note">{{t('Some older records lack verified step times. Their original records remain available; no steps or times have been invented.','بعض السجلات القديمة لا تحتوي توثيقًا مؤكدًا للخطوات وتوقيتها. سجلاتها الأصلية محفوظة، ولم تُفترض لها خطوات أو أوقات.')}}</p>}
      <ng-template #eventsTable let-events>
        <div class="history-table"><table><thead><tr><th>{{t('Date','التاريخ')}}</th><th>{{t('Day','اليوم')}}</th><th>{{t('Time','الساعة')}}</th><th>{{t('Procedure','الإجراء')}}</th><th>{{t('Executed Step','الخطوة المنفذة')}}</th></tr></thead><tbody>
        @for(event of events;track event.id){<tr [class.corrected]="event.corrected"><td>{{event.date||'—'}}</td><td>{{t(event.dayEn||'—',event.dayAr||'—')}}</td><td>{{event.time||t('Not recorded','غير مسجل')}}</td><td>{{event.procedureName}} @if(event.toothNumbers.length){<small>#{{event.toothNumbers.join(', #')}}</small>}</td><td>{{t(event.stepEn,event.stepAr)}} @if(event.corrected){<strong>{{t('Corrected record','تم تصحيح تسجيله')}}</strong>}</td></tr>}
        @empty{<tr><td colspan="5">{{t('No executed steps have been recorded.','لا توجد خطوات منفذة مسجلة حتى الآن.')}}</td></tr>}
      </tbody></table></div>
      </ng-template>
      @if (visitLayout && visitGroups().length) {
        <div class="visit-timeline">
          @for (visit of visitGroups(); track visit.key) {
            <details class="visit">
              <summary class="visit-summary">
                <div class="visit-date">
                  <span>{{ visit.appointmentId ? t('Visit', 'زيارة') : t('Record', 'سجل') }}</span>
                  <strong>{{ visit.date || t('Date not recorded', 'التاريخ غير مسجل') }}</strong>
                </div>
                <div class="visit-procedures">
                  @for (name of visit.procedures.slice(0, 4); track name) {
                    <span><bdi>{{ name }}</bdi></span>
                  }
                  @if (visit.procedures.length > 4) {
                    <span>+{{ visit.procedures.length - 4 }}</span>
                  }
                </div>
                <span class="visit-expand">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"
                    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </svg>
                  <span>{{ t('Details', 'التفاصيل') }}</span>
                </span>
              </summary>
              <ng-container *ngTemplateOutlet="eventsTable; context: { $implicit: visit.events }" />
            </details>
          }
        </div>
      } @else {
        <ng-container *ngTemplateOutlet="eventsTable; context: { $implicit: record.items }" />
      }
      <footer><button type="button" [disabled]="loading()||record.page===1" (click)="load(record.page-1)">{{t('Newer','الأحدث')}}</button><span>{{record.page}} / {{pages()}} · {{record.totalCount}} {{t('events','حدث')}}</span><button type="button" [disabled]="loading()||record.page>=pages()" (click)="load(record.page+1)">{{t('Older','الأقدم')}}</button></footer>
    } @else if(loading()){<p role="status">{{t('Loading clinical history…','جارٍ تحميل التاريخ الطبي…')}}</p>}
  </section>`,styles:`
  :host{display:block}.clinical-history{background:white;border:1px solid #dce8e5;border-radius:14px;padding:20px;margin:16px 0;color:#173d3c}header,footer,.first-examination{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}h2{font-size:1.2rem;margin:0}p,small{color:#607777}button{border:1px solid #bfd9d4;border-radius:8px;background:#eef8f6;color:#08796e;padding:9px 14px;cursor:pointer}button:disabled{opacity:.5;cursor:default}.first-examination{background:#eff9f7;padding:14px;border-radius:10px}.history-table{overflow-x:auto;margin:18px 0}table{width:100%;border-collapse:collapse;text-align:start;font-size:.9rem}th,td{padding:12px;border-bottom:1px solid #e6efed;text-align:start;vertical-align:top}td small,td strong{display:block;margin-top:4px}.legacy-note{font-size:.85rem}.corrected{color:#7f6662;background:#fff8f5}@media print{button{display:none}.history-table{overflow:visible}.clinical-history{break-inside:auto}tr{break-inside:avoid}}

  .visit-timeline { display: grid; gap: .65rem; margin-block: 1rem; padding-inline-start: .75rem; border-inline-start: 1px solid #b6dbd6; }
  .visit { position: relative; min-inline-size: 0; border: 1px solid #dbe9e8; border-radius: 12px; background: #f7fbfb; }
  .visit::before { content: ''; position: absolute; inset-inline-start: -1.06rem; inset-block-start: 1.45rem; width: .5rem; height: .5rem; background: white; border: 2px solid #148474; border-radius: 50%; }
  .visit[open] { background: #fff; }
  .visit-summary { display: grid; grid-template-columns: minmax(7rem, auto) 1fr auto; align-items: center; gap: .75rem; padding: .65rem .8rem; cursor: pointer; list-style: none; }
  .visit-summary::-webkit-details-marker { display: none; }
  .visit-summary:hover, .visit[open] .visit-summary { background: #eaf7f4; border-radius: 11px; }
  .visit-summary:focus-visible { outline: 2px solid #087f74; outline-offset: 2px; }
  .visit-date { display: grid; gap: .15rem; }
  .visit-date span { justify-self: start; background: #def2ec; color: #096655; padding: .1rem .45rem; border-radius: 999px; font-size: .75rem; font-weight: 700; }
  .visit-date strong { font-size: .9rem; }
  .visit-procedures { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem .6rem; font-size: .86rem; overflow-wrap: anywhere; }
  .visit-procedures span + span { border-inline-start: 1px solid #c8ddda; padding-inline-start: .6rem; }
  .visit-expand { display: inline-flex; align-items: center; gap: .35rem; min-block-size: 34px; padding-inline: .45rem; color: #087363; background: #e1f4ef; border-radius: 8px; font-size: .82rem; }
  .visit-expand svg { width: 1.12rem; height: 1.12rem; }
  .visit .history-table { margin: 0; }
  @media (max-width: 640px) {
    .clinical-history { padding: .75rem; }
    .visit-summary { grid-template-columns: minmax(0, 1fr) auto; }
    .visit-date { grid-column: 1; }
    .visit-procedures { grid-column: 1 / -1; grid-row: 2; }
    .visit-expand { grid-column: 2; grid-row: 1; }
  }
`})
export class PatientClinicalHistoryComponent implements OnChanges,OnInit {
  @Input({required:true}) patientId='';
  @Input() visitLayout = false;
  private readonly http=inject(HttpClient);private readonly auth=inject(AuthService);private readonly i18n=inject(LocalizationService);private readonly destroyRef=inject(DestroyRef);
  readonly history=signal<PatientClinicalHistory|null>(null);readonly error=signal('');readonly loading=signal(false);
  readonly visitGroups = computed(() => {
    const visits = new Map<string, {
      key: string;
      appointmentId?: string;
      date?: string;
      events: ClinicalHistoryEvent[];
      procedures: Set<string>;
    }>();
    for (const event of this.history()?.items ?? []) {
      const key = event.appointmentId ? 'visit:' + event.appointmentId : 'record:' + event.id;
      let visit = visits.get(key);
      if (!visit) {
        visit = { key, appointmentId: event.appointmentId, date: event.date, events: [], procedures: new Set() };
        visits.set(key, visit);
      }
      visit.events.push(event);
      visit.procedures.add(event.step === 'examination'
        ? this.t('Examination', 'الكشف')
        : event.procedureName);
    }
    return [...visits.values()].map(visit => ({ ...visit, procedures: [...visit.procedures] }));
  });

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
