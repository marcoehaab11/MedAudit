import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EndodonticRecord } from './dental-api.service';
import { RootCanalDraft, rootCanalStages, workflowFor } from './root-canal';
import { CrownEditorComponent } from './crown-editor.component';
@Component({selector:'app-root-canal-editor',imports:[FormsModule,DatePipe,CrownEditorComponent],template:`
<section class="root-canal-card"><h4>{{ standalone ? (english?'Crown details':'تفاصيل الكراون') : (english?'Root canal details':'تفاصيل حشو العصب') }}</h4>
@for(record of previous;track record.id){<details class="previous-session"><summary>{{english?'Previous session':'الجلسة السابقة'}} · {{(record.updatedAt || record.createdAt)|date:'dd/MM/yyyy'}} · {{stageName(record.stage,record.restorationType ?? undefined)}}</summary><div class="previous-canals">@for(canal of record.canals;track canal.id){<span>{{canal.name}} · {{canal.lengthMm ?? '—'}} mm · {{canal.finalFileSize || '—'}}</span>}</div><p class="clinical-notes">{{record.notes}}</p></details>}
@if(saveState || pendingSave){<p class="auto-save-status" role="status">{{pendingSave?(english?'Saving…':'جارٍ الحفظ التلقائي…'):saveState}} @if(saveFailed){<button type="button" (click)="changed.emit()">{{english?'Retry':'إعادة المحاولة'}}</button>}</p>}
@if(!standalone){<ol class="root-stage-timeline" dir="ltr" [attr.aria-label]="english?'Root canal treatment steps':'خطوات علاج حشو العصب'">@for(stage of stages;track stage.value;let index=$index){<li [class.active]="draft.stage!==6 && currentStage.value===stage.value" [class.done]="draft.stage===6 || index < currentStageIndex" [attr.aria-current]="draft.stage!==6 && currentStage.value===stage.value?'step':null"><span class="timeline-number">{{draft.stage===6 || index < currentStageIndex?'✓':stage.number}}</span><span class="timeline-label">{{stage.en}}</span></li>}</ol>}
<fieldset [disabled]="disabled">
@if(draft.stage===6){<p class="completed-stage">✓ {{standalone?(english?'Crown completed':'تم الانتهاء من الكراون'):'Treatment stages completed'}}</p>}
@else {
@if(!standalone){<h5 class="current-stage" dir="ltr">{{currentStage.number}}- {{currentStage.en}}</h5>}
@if(currentStage.value===1){
 <strong>{{english?'Canals (optional selection)':'القنوات'}}</strong><div class="canal-options" dir="ltr">@for(canal of draft.canals;track canal.name){<label class="canal-option" [class.active]="canal.enabled!==false"><svg width="28" height="32" viewBox="0 0 32 36" fill="none" aria-hidden="true"><path d="M16 5C12 2 5 2 4 9c-1 6 3 10 4 15 1 4 1 9 4 9 2 0 1-12 4-12s2 12 4 12c3 0 3-5 4-9 1-5 5-9 4-15-1-7-8-7-12-4Z" fill="white" stroke="#8ba6a1" stroke-width="1.5"/><path d="M16 9v11m0-7-3 11m3-11 3 11" stroke="#087f74" stroke-width="2"/></svg><span>{{canal.name}}</span><input type="checkbox" [checked]="canal.enabled!==false" (change)="toggleCanal(canal)"/></label>}</div>
 <div class="add-canal"><input [attr.aria-label]="english?'New canal name':'اسم القناة الإضافية'" [(ngModel)]="newCanal" maxlength="50"/><button type="button" (click)="addCanal()">+ {{english?'Add canal':'إضافة قناة'}}</button></div>
}
@if(currentStage.value===2){<div class="canal-grid" dir="ltr">@for(canal of selectedCanals;track canal.name){<div class="canal-card"><strong>{{canal.name}}</strong><label>Working length (mm)<input type="number" min="0.01" max="50" step="0.01" [(ngModel)]="canal.lengthMm" (ngModelChange)="scheduleSave()"/></label><label>Final file size<input maxlength="50" [(ngModel)]="canal.finalFileSize" (ngModelChange)="scheduleSave()"/></label></div>}</div>}
@if(currentStage.value===4){
 <div class="obturation-grid" dir="ltr">@for(canal of selectedCanals;track canal.name){<div class="obturation-card"><strong>{{canal.name}}</strong><label>Master size<input [value]="canal.finalFileSize || '—'" readonly/></label><label>Length (mm)<input [value]="canal.lengthMm ?? '—'" readonly/></label></div>}</div>
 <button type="button" class="obturation-button" [class.done]="workflow.obturationDone" [attr.aria-pressed]="workflow.obturationDone" (click)="toggleObturation()">{{workflow.obturationDone ? 'Obturation done' : 'Obturation'}}</button>
 <section class="clinical-option"><div class="choice-toggle"><strong>Post recommendation</strong><div><button type="button" [class.active]="!workflow.needsPost" (click)="setPost(false)">{{english?'No':'لا'}}</button><button type="button" [class.active]="workflow.needsPost" (click)="setPost(true)">{{english?'Yes':'نعم'}}</button></div></div>
 @if(workflow.needsPost){<div class="post-fields" dir="ltr"><label>Post canal<select [(ngModel)]="draft.postCanal" (ngModelChange)="scheduleSave()"><option [ngValue]="null">Select canal</option>@for(canal of selectedCanals;track canal.name){<option [value]="canal.name">{{canal.name}}</option>}</select></label><label>Post type<select [(ngModel)]="draft.postType" (ngModelChange)="scheduleSave()"><option [ngValue]="null">Select type</option><option value="fiber">Fiber post</option><option value="metal">Metal post</option><option value="custom">Custom post</option></select></label><label>Post size<input [(ngModel)]="workflow.postSize" maxlength="50" (ngModelChange)="scheduleSave()"/></label></div>}</section>
}
@if(currentStage.value===5){
 <div class="restoration-options">@for(material of materials;track material.value){<label [class.active]="workflow.finalMaterial===material.value"><input type="radio" name="final-restoration" [value]="material.value" [(ngModel)]="workflow.finalMaterial" (ngModelChange)="scheduleSave()"/><span>{{material.label}}</span></label>}</div>
 @if(workflow.finalMaterial==='temporary'){<p class="stage-warning">{{english?'Temporary filling — treatment remains unfinished. Continue at the next visit.':'حشو مؤقت — العلاج لسه غير مكتمل، وهنكمل من نفس المرحلة في الزيارة الجاية.'}}</p>}
 <section class="clinical-option"><div class="choice-toggle"><strong>Crown recommendation</strong><div><button type="button" [class.active]="!workflow.needsCrown" (click)="setCrown(false)">{{english?'No':'لا'}}</button><button type="button" [class.active]="workflow.needsCrown" (click)="setCrown(true)">{{english?'Yes':'نعم'}}</button></div></div></section>
}
@if(currentStage.value===8){<app-crown-editor [draft]="workflow.crown" [english]="english" [disabled]="disabled" (changed)="scheduleSave()" (finished)="finishCrown()"/>}
@if(measurementError || postError || stageError){<p role="alert" class="stage-error">{{stageError || (postError?(english?'Select the post canal, type and size.':'حدد قناة الدعامة ونوعها ومقاسها.'):(english?'Enter valid working lengths and final file sizes for the selected canals.':'أدخل أطوال العمل ومقاسات الملفات للقنوات المختارة.'))}}</p>}
}
<label>{{english?'Session notes / remaining work':'ملاحظات الجلسة / العمل المتبقي'}}<textarea [(ngModel)]="draft.notes" (ngModelChange)="scheduleSave()" maxlength="2000" rows="3"></textarea></label>
<div class="stage-actions">@if(!standalone && draft.stage!==1){<button type="button" class="previous-stage" (click)="previousStage()">{{english?'Previous step':'الخطوة السابقة'}}</button>}
@if(draft.stage!==6 && currentStage.value!==8){<button type="button" class="complete-stage" (click)="completeStage()">{{english?'Save this stage and continue':'حفظ هذه المرحلة والانتقال للخطوة التالية'}}</button>}
@if(canSave){<button type="button" (click)="save.emit()">{{english?'Save and exit':'حفظ والخروج'}}</button>} @else{<small>{{english?'Progress is saved automatically; record the procedure below to link it to the treatment.':'التقدم يُحفظ تلقائيًا؛ سجل الإجراء بالزر الموجود بالأسفل لربطه بالعلاج.'}}</small>}</div>
</fieldset></section>`,
  styles: [`
    .canal-options{display:flex;flex-wrap:wrap;gap:10px}.canal-option{display:flex;align-items:center;gap:12px;border:1px solid #d8e5e3;border-radius:10px;background:white;padding:14px 20px;cursor:pointer}.canal-option.active{background:#e4f5f0;border-color:#219b86}.canal-option input{width:18px;height:18px;accent-color:#087f74}.add-canal{display:flex;gap:8px;flex-wrap:wrap}.add-canal input{width:150px}.obturation-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.obturation-card{display:grid;grid-template-columns:55px 1fr 1fr;gap:10px;align-items:center;background:white;border:1px solid #dce8e5;padding:12px;border-radius:10px;font-size:12px}.obturation-card input{background:#f5f8f7;color:#516b77}.clinical-option{padding:14px;background:white;border:1px solid #dce8e5;border-radius:10px;display:grid;gap:12px}.choice-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px}.choice-toggle div{display:flex;gap:6px}.choice-toggle button{padding:8px 18px;background:#eef4f2;color:#426b63}.choice-toggle button.active{background:#087f74;color:white}.post-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.restoration-options{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;direction:ltr}.restoration-options label{display:flex;align-items:center;gap:10px;background:white;border:1px solid #dce8e5;border-radius:10px;padding:18px 12px;font-size:13px;cursor:pointer}.restoration-options label.active{background:#e4f5f0;border-color:#219b86}.restoration-options input{width:18px;height:18px;accent-color:#087f74}.stage-warning{padding:12px;background:#fff8e9;border:1px solid #f0dfb1;border-radius:9px;color:#8b6417;font-size:13px}@media(max-width:650px){.obturation-grid{grid-template-columns:1fr}.restoration-options,.post-fields{grid-template-columns:repeat(2,minmax(0,1fr))}.obturation-card{grid-template-columns:45px 1fr 1fr}}

    .stage-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.stage-actions small{flex-basis:100%;font-size:12px;color:#6c838d}.stage-check input{accent-color:#087f74}.root-canal-card{border:1px solid #b9dedb;border-radius:12px;background:#f2fbfa;padding:16px;margin-top:16px}
    h4{margin:0 0 12px}fieldset{border:0;padding:0;display:grid;gap:14px;min-width:0}
    label{display:grid;gap:6px}input,select,textarea{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:7px;background:white}
    .obturation-note{display:grid;gap:4px;justify-self:left;max-width:100%;padding:8px 10px;border-inline-start:2px solid #b8d9d0;border-radius:4px;background:#ffffff80;color:#5c737d;font-size:.75rem;line-height:1.6;text-align:left;overflow-wrap:anywhere}
    .obturation-note strong{font-size:.73rem;color:#43665f;font-weight:650}
    .canal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px}
    .canal-card{background:white;border:1px solid #d8e5e8;border-radius:10px;padding:12px;display:grid;gap:10px;text-align:center;font-size:.8rem}
    .canal-card strong{justify-self:center;background:#dbefeb;border-radius:20px;padding:4px 10px;color:#165a50}
    .current-stage{margin:0;font-size:1rem;text-align:start}.stage-check{display:flex;align-items:center;gap:8px}.stage-check input{width:18px;height:18px;cursor:pointer}.completed-stage{color:#16825f;font-weight:700}.stage-error{color:#b42318;margin:0}.previous-stage{background:white;color:#436174;border:1px solid #ccdadd;justify-self:start}
    .previous-session{background:white;padding:10px;margin-bottom:14px;border:1px solid #d8e5e8;border-radius:8px}summary{cursor:pointer;font-weight:600}.previous-canals{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}.clinical-notes{white-space:pre-wrap}
    .root-stage-timeline{display:flex;direction:ltr;list-style:none;padding:8px 0 18px;margin:0 0 16px;overflow-x:auto;gap:0;scrollbar-width:thin;border-bottom:1px solid #dcebe7}
    .root-stage-timeline li{flex:1 0 110px;position:relative;display:flex;align-items:center;flex-direction:column;gap:9px;text-align:center;min-width:0;padding:0 8px;color:#8a98a5}
    .root-stage-timeline li::before{content:'';position:absolute;height:2px;background:#dce5e9;top:16px;left:calc(-50% + 17px);right:calc(50% + 17px)}
    .root-stage-timeline li:first-child::before{display:none}
    .timeline-number{position:relative;z-index:1;display:grid;place-items:center;box-sizing:border-box;width:34px;height:34px;border:1px solid #dce5e9;border-radius:50%;background:#f5f8fa;font-size:.8rem;font-weight:750;flex-shrink:0}
    .timeline-label{max-width:155px;line-height:1.55;font-size:.73rem;font-weight:600;overflow-wrap:break-word}
    .root-stage-timeline li.active{color:#137b70}.root-stage-timeline li.active .timeline-number{border-color:#168a82;background:#168a82;color:white;box-shadow:0 0 0 4px #168a8212}
    .root-stage-timeline li.done{color:#278375}.root-stage-timeline li.done .timeline-number{background:#e0f3eb;border-color:#9bd3bd;color:#167e64}
    .root-stage-timeline li.done::before,.root-stage-timeline li.active::before{background:#57af9b}
    @media(max-width:600px){.root-stage-timeline li{flex-basis:105px}.root-canal-card{padding:12px}}
    button{padding:10px;border:0;border-radius:8px;background:#168a82;color:white;font-weight:700;cursor:pointer}
    .obturation-button{justify-self:start;min-width:170px;padding:12px 22px;background:#087f74;color:white;transition:background-color .15s,color .15s}
    .obturation-button.done{background:#e2e5e8;color:#4b5563}
    .obturation-button:focus-visible{outline:3px solid #54b8a6;outline-offset:3px}
    .obturation-button:disabled{cursor:not-allowed;opacity:.65}
  `],
})
export class RootCanalEditorComponent implements OnDestroy {
 @Input({required:true}) draft!:RootCanalDraft; @Input() previous:EndodonticRecord[]=[]; @Input() disabled=false; @Input() canSave=false; @Input() english=false;
 @Input() saveState=''; @Input() saveFailed=false; @Output() save=new EventEmitter<void>(); @Output() changed=new EventEmitter<void>();
 private saveTimer?:ReturnType<typeof setTimeout>; pendingSave=false;measurementError=false;postError=false;stageError='';newCanal='';
 readonly materials=[{value:'amalgam',label:'Amalgam'},{value:'composite',label:'Composite'},{value:'glass-ionomer',label:'Glass Ionomer'},{value:'temporary',label:'Temporary filling'}];
 get standalone(){return this.draft.restorationType==='crown-only';}
 get workflow(){return workflowFor(this.draft);}
 get selectedCanals(){return this.draft.canals.filter(c=>c.enabled!==false);}
 get stages(){return rootCanalStages(this.draft.restorationType);}
 get currentStage(){return this.stages.find(s=>s.value===this.draft.stage) ?? this.stages.find(s=>s.value===(this.draft.stage===7?4:2)) ?? this.stages[0];}
 get currentStageIndex(){return this.stages.findIndex(s=>s.value===this.currentStage.value);}
 scheduleSave(){if(this.disabled)return;this.pendingSave=true;if(this.saveTimer)clearTimeout(this.saveTimer);this.saveTimer=setTimeout(()=>{this.saveTimer=undefined;this.pendingSave=false;this.changed.emit();},600);}
 toggleObturation(){if(this.disabled)return;this.workflow.obturationDone=!this.workflow.obturationDone;this.stageError='';this.scheduleSave();}
 ngOnDestroy(){if(this.saveTimer){clearTimeout(this.saveTimer);this.changed.emit();}}
 private persist(){if(this.saveTimer)clearTimeout(this.saveTimer);this.saveTimer=undefined;this.pendingSave=false;if(this.canSave)this.save.emit();else this.changed.emit();}
 toggleCanal(c:RootCanalDraft['canals'][number]){if(this.disabled)return;c.enabled=c.enabled===false;if(c.enabled===false&&this.draft.postCanal===c.name)this.draft.postCanal=null;this.scheduleSave();}
 addCanal(){if(this.disabled)return;const name=this.newCanal.trim();if(!name || this.draft.canals.some(c=>c.name.toLowerCase()===name.toLowerCase())){this.stageError=this.english?'Enter a unique canal name.':'اكتب اسم قناة مختلف.';return;}this.draft.canals.push({name,lengthMm:null,finalFileSize:'',enabled:true});this.newCanal='';this.stageError='';this.scheduleSave();}
 setPost(value:boolean){if(this.disabled)return;this.workflow.needsPost=value;this.updateMode();this.scheduleSave();}
 setCrown(value:boolean){if(this.disabled)return;this.workflow.needsCrown=value;this.updateMode();this.scheduleSave();}
 private updateMode(){if(this.standalone)return;this.draft.restorationType=this.workflow.needsPost?(this.workflow.needsCrown?'post-core-crown':'post-core'):(this.workflow.needsCrown?'crown':'composite');}
 completeStage(event?:Event){
  if(event?.target)(event.target as HTMLInputElement).checked=false;
  if(this.disabled||this.draft.stage===6)return;this.stageError='';this.measurementError=false;this.postError=false;
  const current=this.currentStage.value;
  if(current===1&&!this.selectedCanals.length){this.stageError=this.english?'Select at least one canal.':'اختر قناة واحدة على الأقل.';return;}
  if(current===2){this.measurementError=!this.selectedCanals.length||this.selectedCanals.some(c=>c.lengthMm===null||!Number.isFinite(c.lengthMm)||c.lengthMm<=0||c.lengthMm>50||!c.finalFileSize.trim());if(this.measurementError)return;}
  if(current===4){if(!this.workflow.obturationDone){this.stageError=this.english?'Confirm obturation is done.':'أكد إتمام حشو القنوات.';return;}this.postError=this.workflow.needsPost&&(!this.draft.postType||!this.selectedCanals.some(c=>c.name===this.draft.postCanal)||!this.workflow.postSize.trim());if(this.postError)return;}
  if(current===5){if(!this.workflow.finalMaterial){this.stageError=this.english?'Choose a restoration material.':'اختر مادة الترميم.';return;}if(this.workflow.finalMaterial==='temporary'){this.draft.stage=5;this.persist();return;}}
  if(current===8)return;
  const index=this.currentStageIndex;this.draft.stage=this.stages[index+1]?.value ?? 6;this.persist();
 }
 finishCrown(){if(this.disabled)return;if(this.workflow.crown.completed.some((done,index)=>index!==2&&!done)){this.stageError=this.english?'Complete the crown steps first.':'أكمل خطوات الكراون أولًا.';return;}if(!this.standalone&&(!this.workflow.finalMaterial||this.workflow.finalMaterial==='temporary')){this.draft.stage=5;this.stageError=this.english?'A permanent restoration is still required.':'الترميم الدائم لسه مطلوب.';return;}this.draft.stage=6;this.persist();}
 previousStage(){if(this.disabled)return;const index=this.draft.stage===6?this.stages.length:this.currentStageIndex;this.draft.stage=this.stages[Math.max(0,index-1)].value;this.measurementError=false;this.postError=false;this.stageError='';this.changed.emit();}
 stageName(value?:number|null,mode=this.draft.restorationType){if(value===6)return 'Treatment stages completed';const stage=rootCanalStages(mode).find(s=>s.value===(value===3?2:value===7?4:value));return stage?stage.number+'- '+stage.en:this.english?'Stage not recorded':'المرحلة غير مسجلة';}
}
