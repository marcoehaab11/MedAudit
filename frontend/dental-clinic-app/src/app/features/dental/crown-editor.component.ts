import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrownDraft } from './root-canal';
@Component({selector:'app-crown-editor',imports:[FormsModule],template:`
<section class="crown-editor" [attr.dir]="english ? 'ltr':'rtl'">
  <fieldset [disabled]="disabled"><div class="crown-meta" dir="ltr">
    <label>Crown type<input [(ngModel)]="draft.type" (ngModelChange)="changed.emit()" list="crown-types" maxlength="100" placeholder="Select crown type"/><datalist id="crown-types"><option>Crown</option><option>Overlay</option><option>Inlay</option><option>Onlay</option><option>Veneer</option></datalist></label>
    <label>Material<input [(ngModel)]="draft.material" (ngModelChange)="changed.emit()" list="crown-materials" maxlength="100" placeholder="Select material"/><datalist id="crown-materials"><option>Zirconia</option><option>E.max</option><option>PFM</option><option>Metal</option><option>Resin</option></datalist></label>
    <label>Shade<input [(ngModel)]="draft.shade" (ngModelChange)="changed.emit()" list="crown-shades" maxlength="50" placeholder="Select shade"/><datalist id="crown-shades">@for(s of shades;track s){<option>{{s}}</option>}</datalist></label>
    <label>Laboratory<input [(ngModel)]="draft.laboratory" (ngModelChange)="changed.emit()" maxlength="100" placeholder="Laboratory name"/></label>
  </div>
  <h4>{{ english ? 'Treatment steps' : 'خطوات العلاج' }}</h4>
  <div class="crown-workspace"><ol dir="ltr" aria-label="Crown treatment steps">@for(step of steps;track step;let index=$index){<li [class.current]="draft.step===index+1" [class.done]="draft.completed[index]"><button type="button" [disabled]="disabled || index+1>draft.step && !draft.completed[index]" (click)="draft.step=index+1;changed.emit()"><b>{{ draft.completed[index]?'✓':index+1 }}</b><span>{{step}}</span></button></li>}</ol>
  <section class="crown-step"><h5 dir="ltr">{{draft.step}}. {{steps[draft.step-1]}}</h5>
    @if(draft.step===3){<label class="check"><input type="checkbox" [(ngModel)]="draft.temporary" (ngModelChange)="changed.emit()"/>{{english?'Temporary crown placed':'تم تركيب كراون مؤقت'}}</label><small>{{english?'This step is optional. Skip it if not needed.':'الخطوة دي اختيارية؛ يمكن تخطيها لو مش مطلوبة.'}}</small>}
    @else {<label class="check"><input type="checkbox" [(ngModel)]="draft.completed[draft.step-1]" (ngModelChange)="changed.emit()"/>{{english?'Step completed today':'تم تنفيذ هذه الخطوة اليوم'}}</label>}
    <label>{{english?'Date':'التاريخ'}}<input type="date" [ngModel]="draft.dates[draft.step-1] || today()" (ngModelChange)="draft.dates[draft.step-1]=$event;changed.emit()"/></label>
    <label>{{english?'Notes (optional)':'ملاحظات (اختياري)'}}<textarea [(ngModel)]="draft.notes[draft.step-1]" (ngModelChange)="changed.emit()" maxlength="2000" rows="3"></textarea></label>
    @if(error){<p role="alert">{{english?'Enter crown details and complete the current step first.':'أدخل بيانات الكراون وأكد تنفيذ الخطوة الحالية أولًا.'}}</p>}
    <button type="button" class="next" (click)="advance()">{{draft.step===5?(english?'Save final cementation':'حفظ التركيب النهائي'):(english?'Save and continue to next step':'حفظ والانتقال للخطوة التالية')}}</button>
  </section></div></fieldset>
</section>`,styles:[`
:host{display:block}fieldset{border:0;padding:0;min-width:0}h4{font-size:15px;margin:16px 0}label{display:grid;min-width:0;gap:7px;font-size:12px;color:#49616e}input,textarea{min-width:0;max-width:100%;width:100%;box-sizing:border-box;padding:10px;border:1px solid #dce7e5;border-radius:8px;font:inherit;background:white}input:focus-visible,textarea:focus-visible,button:focus-visible{outline:2px solid #087f74;outline-offset:2px}.crown-meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;padding:16px;border:1px solid #e3ece9;border-radius:12px;background:white}.crown-workspace{display:grid;grid-template-columns:230px minmax(0,1fr);gap:18px;padding:16px;border:1px solid #e3ece9;border-radius:12px;background:white;direction:ltr}ol{list-style:none;padding:0;margin:0;display:grid;gap:8px;align-content:start}li button{display:flex;align-items:center;gap:12px;background:transparent;border:0;color:#6d8390;text-align:left;padding:8px 0;width:100%;cursor:pointer}li b{display:grid;place-items:center;width:30px;height:30px;border:1px solid #dce6e4;border-radius:50%;flex-shrink:0}li.current b,li.done b{color:white;background:#078778;border-color:#078778}li.current span{color:#163b44;font-weight:650}.crown-step{display:grid;gap:14px;direction:inherit;min-width:0}.crown-step h5{font-size:16px;margin:0;padding-bottom:12px;border-bottom:1px solid #edf2ef}.check{display:flex;align-items:center;gap:10px}.check input{width:18px;height:18px;accent-color:#078778}.next{padding:12px 18px;border:0;border-radius:9px;background:#087f74;color:white;cursor:pointer}p[role=alert]{color:#b42c44;font-size:12px}small{color:#748895}@media(max-width:750px){.crown-meta,.crown-workspace{padding:10px;gap:10px}.crown-meta{grid-template-columns:repeat(2,minmax(0,1fr))}.crown-workspace{grid-template-columns:minmax(0,1fr)}ol{display:flex;overflow-x:auto}li{min-width:145px}li button{font-size:11px}}`]
})
export class CrownEditorComponent {
 @Input({required:true}) draft!:CrownDraft; @Input() english=false; @Input() disabled=false;
 @Output() changed=new EventEmitter<void>(); @Output() finished=new EventEmitter<void>();
 readonly shades=['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','C4','D2','D3','D4'];
 readonly steps=['Preparation','Impression / Scan','Temporary crown (optional)','Try-in (seat & check)','Final cementation']; error=false;
 today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 advance(){
  if(this.disabled)return;
  const i=this.draft.step-1;
  this.error=(i===4 && ![this.draft.type,this.draft.material,this.draft.shade,this.draft.laboratory].every(v=>!!v.trim())) || i!==2&&!this.draft.completed[i];
  if(this.error)return;
  if(i===4&&this.draft.completed.some((done,index)=>index!==2&&!done)){this.error=true;return;}
  this.draft.completed[i]=true;this.draft.dates[i] ||= this.today();
  if(i===4)this.finished.emit();else {this.draft.step++;this.changed.emit();}
 }
}
