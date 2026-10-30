import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, HostListener, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, CanDeactivateFn, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ImplantFieldComponent } from './implant-field.component';
import { DentalChartComponent } from './dental-chart.component';
import { ImplantData, ImplantField, followupDate } from './implant-fields';
import { bleachingFields, instructionTemplates, pocketFields, scalingAssessment, scalingFinal, vitaShades } from './clinical-workflow-fields';

interface ClinicalVisit {id:string;appointmentId:string;doctorProfileId:string;doctorUserId:string;date:string;performed:boolean;data:any;revisions?:any[];correctedAt?:string;instructionApprovals?:{text:string;language:string;preparedAt:string}[];}
interface ClinicalRecord {kind:'scaling'|'bleaching';plan:any;visits:ClinicalVisit[];baselineLocked?:boolean;}
interface ClinicalDetails {treatmentId:string;patientId:string;doctorProfileId:string;version:string;workflowJson:string|null;}
@Component({selector:'app-clinical-workflow',standalone:true,imports:[FormsModule,ImplantFieldComponent,DentalChartComponent],templateUrl:'./clinical-workflow.component.html',styleUrl:'./clinical-workflow.scss'})
export class ClinicalWorkflowComponent implements OnInit {
 private readonly http=inject(HttpClient);private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);readonly auth=inject(AuthService);
 readonly loading=signal(true);readonly saving=signal(false);readonly error=signal('');readonly saved=signal('');readonly files=signal<any[]>([]);
 readonly id=this.route.snapshot.paramMap.get('id')!;readonly appointmentId=this.route.snapshot.queryParamMap.get('appointmentId')??'';
 kind:'scaling'|'bleaching'=this.route.snapshot.queryParamMap.get('kind')==='bleaching'?'bleaching':'scaling';
 record:ClinicalRecord={kind:this.kind,plan:{plannedSessions:1,products:[]},visits:[]};details!:ClinicalDetails;patient:any={};appointment:any={};treatment:any={};
 data:any={};sessionId:string=crypto.randomUUID();step=0;historical=false;selectedTooth=16;primary=false;pocket:any={tooth:16};
 readonly sites=['MB','B','DB','ML','L','DL'];readonly shades=vitaShades;readonly pocketFields=pocketFields;readonly bleachingFields=bleachingFields;
 readonly bleachingSessionFields=bleachingFields.filter(field=>field.key==='durationMinutes'||field.key==='shadeAfter');
 preview=false;consent=false;productName='';productConcentrations='';previewText='';pendingDelete:number|null=null;
 private timer?:ReturnType<typeof setTimeout>;private queue:Promise<void>=Promise.resolve();private signature='';private urls:string[]=[];private leaving=false;private pendingSaves=0;
 constructor(){inject(DestroyRef).onDestroy(()=>{if(this.timer)clearTimeout(this.timer);this.urls.forEach(url=>URL.revokeObjectURL(url));});}
 get readonly(){return this.historical || !this.auth.hasPermission('Dental.Edit') || !this.auth.hasPermission('Examination.Edit') || this.treatment.status===4 || this.treatment.status===5;}
 get plan(){return this.record.plan;}
 get completed(){return this.record.visits.filter(v=>v.performed).length;}
 get baselineLocked(){return !!this.record.baselineLocked || this.record.visits.some(v=>v.performed || v.correctedAt || v.revisions?.some(r=>r.performed));}
 get currentVisit(){return this.record.visits.find(v=>v.appointmentId===this.appointmentId);}
 get instructionApprovals(){return this.record.visits.find(v=>v.id===this.sessionId)?.instructionApprovals??[];}
 get visibleSteps(){return this.data.pocketMapping==='yes'?[0,1,2]:[0,2];}
 get fields():ImplantField[]{return (this.step===0?scalingAssessment:scalingFinal).filter(f=>!f.when || this.data[f.when[0]]===f.when[1]);}
 get scopeTeeth(){return ['UR','UL','LL','LR'].flatMap((quadrant,q)=>Array.from({length:8},(_,i)=>{const angle=(q===0?Math.PI:q===1?1.5*Math.PI:q===2?0:.5*Math.PI)+(i+.5)/8*Math.PI/2;return {id:quadrant+i,x:100+67*Math.cos(angle),y:83+65*Math.sin(angle),selected:(this.data.quadrants??[]).includes(quadrant)};}));}
 get pockets():any[]{return this.data.pockets??=[];}
 get concentrations():string[]{return this.plan.products?.find((p:any)=>p.name===this.data.brand)?.concentrations??[];}
 get mapped(){return this.pockets.map(p=>({toothId:String(p.tooth),toothNumber:p.tooth,findings:[],procedures:[],hasEndodonticRecord:false,treatmentProgress:[{id:String(p.tooth),name:'Pocket mapping',type:6,status:4}]}));}
 get maxDepth(){return this.maximum(this.pocket);}
 get age(){const birth=new Date(this.patient.dateOfBirth);if(!Number.isFinite(birth.getTime()))return null;const today=new Date();let value=today.getFullYear()-birth.getFullYear();if(today.getMonth()<birth.getMonth() || today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate())value--;return value;}
 photoDate(fileId:string,value:string){this.data.photoDates??={};this.data.photoDates[fileId]=value;this.changed();}
 maximum(p:any){const values=this.sites.map(s=>p[s]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number);return values.length?Math.max(...values):null;}
 depthColor(p:any){const max=this.maximum(p);return max===null?'#9aa8b2':max<=3?'#1baf7b':max<=5?'#efa900':'#d83f55';}
 async ngOnInit(){try{
  if(!this.appointmentId)throw new Error('افتح الخدمة من زيارة المريض لاستكمالها.');
  const [details,treatment,appointment]=await Promise.all([firstValueFrom(this.http.get<ClinicalDetails>(`/api/treatments/${this.id}/clinical-workflow`)),firstValueFrom(this.http.get<any>(`/api/treatments/${this.id}`)),firstValueFrom(this.http.get<any>(`/api/appointments/${this.appointmentId}`))]);
  this.details=details;this.treatment=treatment;this.appointment=appointment;
  this.patient=await firstValueFrom(this.http.get<any>(`/api/patients/${details.patientId}`));
  if(appointment.patientId!==details.patientId)throw new Error('الزيارة لا تخص هذا المريض.');
  if(details.workflowJson){this.record=JSON.parse(details.workflowJson);this.kind=this.record.kind;}
  this.plan.products??=[];this.plan.plannedSessions??=1;this.loadCurrent();
  this.files.set(await firstValueFrom(this.http.get<any[]>(`/api/treatments/${this.id}/clinical-files`)));
  for(const file of this.files())await this.loadPhoto(file);
 }catch(error){this.fail(error);}finally{this.loading.set(false);}}
 loadCurrent(){this.historical=false;const visit=this.currentVisit;this.sessionId=visit?.id??crypto.randomUUID();this.data=structuredClone(visit?.data??{});this.data.instructionsLanguage??='ar';this.step=Math.min(2,Math.max(0,Number(this.data.uiStep??0)));this.signature=this.serialize();this.saved.set(visit?'تم استرجاع بيانات هذه الزيارة':'');}
 openHistory(id:string){if(!this.canLeave())return;const visit=this.record.visits.find(v=>v.id===id);if(!visit)return;this.historical=visit.appointmentId!==this.appointmentId;this.sessionId=visit.id;this.data=structuredClone(visit.data);this.step=0;this.signature=this.serialize();}
 changed(){if(this.readonly)return;this.saved.set('تعديلات غير محفوظة');if(this.timer)clearTimeout(this.timer);this.timer=setTimeout(()=>void this.save(false),800);}
 serialize(){return JSON.stringify({plan:this.plan,data:this.data,sessionId:this.sessionId});}
 canLeave(){if(this.leaving || !this.details || this.loading())return true;return !this.saving() && (this.serialize()===this.signature&&!(this.step===1&&this.pocketDirty()) || confirm('توجد تعديلات أو قياسات غير محفوظة. هل تريد المغادرة؟'));}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.details && (this.saving() || this.serialize()!==this.signature || this.step===1&&this.pocketDirty())){event.preventDefault();event.returnValue='';}}
 async back(){if(this.canLeave()){this.leaving=true;await this.router.navigate(['/appointments',this.appointmentId,'visit']);}}
 async save(performed=false):Promise<boolean>{
  if(this.readonly || !this.details)return false;if(this.timer){clearTimeout(this.timer);this.timer=undefined;}
  const data=structuredClone(this.data);data.uiStep=this.step;const plan=structuredClone(this.plan);
  if(data.scope!=='quadrants')delete data.quadrants;if(data.pocketMapping!=='yes')delete data.pockets;if(data.polishing!=='yes')delete data.polishingMaterial;
  const snapshot=this.serialize();let ok=false;this.pendingSaves++;this.saving.set(true);this.error.set('');
  const run=this.queue.then(async()=>{try{
   const result=await firstValueFrom(this.http.put<ClinicalDetails>(`/api/treatments/${this.id}/clinical-workflow`,{version:this.details.version,kind:this.kind,plan,sessionId:this.sessionId,appointmentId:this.appointmentId,data,performed:performed||!!this.currentVisit?.performed}));
   this.details=result;const stored:ClinicalRecord=JSON.parse(result.workflowJson!);this.record.visits=stored.visits;this.record.baselineLocked=stored.baselineLocked;this.signature=snapshot;this.saved.set(performed?'تم تسجيل الجلسة المنفذة وحفظها':'تم الحفظ');ok=true;
  }catch(error){this.fail(error);}});this.queue=run.catch(()=>{});await run;this.pendingSaves--;this.saving.set(this.pendingSaves>0);return ok;
 }
 async next(){
  if(this.step===0){for(const key of ['scope','calculus','gingivalStatus','pocketMapping'])if(!this.data[key]){this.error.set('أكمل نطاق التنظيف وكمية الجير وحالة اللثة وسؤال الجيوب.');return;}
   if(this.data.scope==='quadrants'&&!this.data.quadrants?.length){this.error.set('اختر ربعًا واحدًا على الأقل.');return;}}
  if(this.step===1 && this.pocketDirty()){this.error.set('احفظ بيانات السن الحالي قبل الانتقال للخطوة التالية.');return;}
  if(this.step===1 && !this.pockets.length){this.error.set('احفظ قياسات سن واحد على الأقل، أو غيّر اختيار الجيوب في التقييم.');return;}
  if(await this.save()){this.step=this.step===0&&this.data.pocketMapping==='yes'?1:2;this.changed();}
 }
 async previous(){if(this.step===1&&this.pocketDirty()&&!confirm('قياسات السن الحالي لم تحفظ. الرجوع دون حفظها؟'))return;if(await this.save()){this.step=this.step===2&&this.data.pocketMapping==='yes'?1:0;this.changed();}}
 async complete(){if(this.kind==='bleaching'&&this.completed!==Number(this.plan.plannedSessions)){this.error.set('يجب تسجيل وحفظ كل الجلسات المخططة قبل إكمال التبييض.');return;}
  if(!await this.save(this.kind==='scaling'))return;this.saving.set(true);
  try{await firstValueFrom(this.http.post(`/api/treatments/${this.id}/complete`,{version:this.details.version}));this.treatment.status=4;this.saved.set('تم إكمال العلاج وحفظ بياناته.');}catch(error){this.fail(error);}finally{this.saving.set(false);}}
 changePlanned(delta:number){this.plan.plannedSessions=Math.min(200,Math.max(1,this.completed,Number(this.plan.plannedSessions)+delta));this.changed();}
 async correctSession(){if(!this.currentVisit?.performed||this.readonly||this.saving())return;const reason=prompt('سبب تصحيح تسجيل الجلسة المنفذة؟ سيظل السجل محفوظًا ولن تُحذف بياناتها.');if(reason===null)return;if(reason.trim().length<5){this.error.set('اكتب سبب التصحيح في خمسة أحرف على الأقل.');return;}
  if(!await this.save())return;this.saving.set(true);try{const result=await firstValueFrom(this.http.post<ClinicalDetails>(`/api/treatments/${this.id}/clinical-workflow/sessions/${this.sessionId}/correct`,{version:this.details.version,reason}));this.details=result;this.record.visits=JSON.parse(result.workflowJson!).visits;this.saved.set('تم تصحيح العدد مع الاحتفاظ ببيانات الجلسة وسبب التصحيح.');}catch(error){this.fail(error);}finally{this.saving.set(false);}}
 addProduct(){const name=this.productName.trim();const concentrations=this.productConcentrations.split(',').map(v=>v.trim()).filter(Boolean);if(!name||!concentrations.length){this.error.set('أدخل المنتج والتركيزات المدونة عليه مفصولة بفواصل.');return;}
  this.plan.products=this.plan.products.filter((p:any)=>p.name!==name);this.plan.products.push({name,concentrations});this.data.brand=name;this.data.concentration='';this.productName='';this.productConcentrations='';this.changed();}
 recallChanged(){const date=new Intl.DateTimeFormat('en-CA',{timeZone:this.appointment.timeZone??'UTC',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(this.appointment.startAt));this.data.recallDate=followupDate(date,this.data.recall);if(this.data.recall==='none')this.data.recallDate='';this.changed();}
 chooseTooth(tooth:number){if(this.readonly){this.selectedTooth=tooth;this.pocket=structuredClone(this.pockets.find(p=>p.tooth===tooth)??{tooth});return;}
  if(this.pocketDirty()&&!confirm('قياسات السن الحالي لم تُحفظ. الانتقال إلى سن آخر؟'))return;this.selectedTooth=tooth;this.pocket=structuredClone(this.pockets.find(p=>p.tooth===tooth)??{tooth});}
 pocketDirty(){return JSON.stringify(this.pocket)!==JSON.stringify(this.pockets.find(p=>p.tooth===this.pocket.tooth)??{tooth:this.pocket.tooth});}
 async saveTooth(){const values=this.sites.map(s=>this.pocket[s]).filter(v=>v!==null&&v!==undefined&&v!=='');if(!values.length||values.some(v=>!Number.isFinite(Number(v))||Number(v)<=0||Number(v)>20)){this.error.set('سجّل قياسًا واحدًا على الأقل أكبر من صفر وحتى ٢٠ مم. اترك غير المقاس فارغًا.');return;}
  if(this.pocket.treatment&&!this.pocket.treatmentStatus){this.error.set('حدد حالة علاج الجيب: مخطط أم تم اليوم.');return;}
  const previous=structuredClone(this.pockets);this.data.pockets=[...this.pockets.filter(p=>p.tooth!==this.pocket.tooth),structuredClone(this.pocket)];if(!await this.save()){this.data.pockets=previous;return;}this.saved.set('تم حفظ قياسات السن.');}
 async deleteTooth(tooth?:number){if(!confirm(tooth?'حذف قياسات هذا السن من الزيارة الحالية؟':'حذف كل قياسات الزيارة الحالية؟'))return;const previous=structuredClone(this.pockets);this.data.pockets=tooth?this.pockets.filter(p=>p.tooth!==tooth):[];if(!await this.save())this.data.pockets=previous;else this.pocket={tooth:this.selectedTooth};}
 instructionsEdited(){this.data.instructionsStatus='draft';this.consent=false;this.changed();}
 templateChanged(value='standard'){if(!value)return;if(this.data.instructionsText&&!confirm('استبدال التعليمات الحالية بنص النموذج؟'))return;this.data.instructionsTemplate=value;this.data.instructionsText=instructionTemplates[this.kind][this.data.instructionsLanguage==='en'?'en':'ar'];this.instructionsEdited();}
 showPreview(){this.previewText=this.data.instructionsText??'';this.preview=true;}
 print(){const frame=document.createElement('iframe');frame.style.display='none';document.body.appendChild(frame);const doc=frame.contentDocument!;doc.open();doc.write('<!doctype html><html><head><title>Planora — Patient instructions</title></head><body></body></html>');doc.close();doc.body.dir=this.data.instructionsLanguage==='en'?'ltr':'rtl';const heading=doc.createElement('h1');heading.textContent='Planora — '+(this.patient.firstName??'');const text=doc.createElement('pre');text.style.whiteSpace='pre-wrap';text.textContent=this.data.instructionsText??'';doc.body.append(heading,text);frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),1000);}
 async whatsapp(){if(!this.consent||!this.data.instructionsText?.trim()){this.error.set('اعتمد نص التعليمات وأكد موافقة المريض أولًا.');return;}const phone=String(this.patient.phone??'').replace(/[^0-9]/g,'');if(!phone){this.error.set('لا يوجد رقم للمريض.');return;}
  if(!confirm('فتح WhatsApp لإرسال التعليمات النصية فقط إلى المريض بعد مراجعتك؟'))return;
  const popup=window.open('about:blank','_blank');if(!popup){this.error.set('اسمح بفتح نافذة WhatsApp.');return;}
  this.data.instructionsStatus='manual-handoff';if(!await this.save()){popup.close();return;}popup.opener=null;popup.location.href='https://wa.me/'+phone+'?text='+encodeURIComponent(this.data.instructionsText);this.saved.set('تم فتح الإرسال اليدوي؛ لا يتوفر تأكيد إرسال أو وصول.');}
 get sessionFiles(){return this.files().filter(f=>f.sessionId===this.sessionId);}
 async loadPhoto(file:any){const blob=await firstValueFrom(this.http.get(`/api/treatments/${this.id}/clinical-files/${file.id}`,{responseType:'blob'}));file.preview=URL.createObjectURL(blob);this.urls.push(file.preview);this.files.update(v=>[...v]);}
 async upload(event:Event,category:string){const input=event.target as HTMLInputElement;if(!input.files?.length||this.readonly)return;if(!await this.save())return;this.saving.set(true);
  try{for(const file of Array.from(input.files)){if(file.size>10_000_000)throw new Error('الحد الأقصى للصورة ١٠ ميجابايت.');const form=new FormData();form.append('file',file);form.append('sessionId',this.sessionId);form.append('category',category);const result=await firstValueFrom(this.http.post<any>(`/api/treatments/${this.id}/clinical-files`,form));this.files.update(v=>[...v,result]);await this.loadPhoto(result);}}catch(error){this.fail(error);}finally{this.saving.set(false);input.value='';}}
 async removePhoto(file:any){if(!confirm('حذف هذه الصورة من جلسة العلاج؟'))return;try{await firstValueFrom(this.http.delete(`/api/treatments/${this.id}/clinical-files/${file.id}`));this.files.update(v=>v.filter(f=>f.id!==file.id));}catch(error){this.fail(error);}}
 private fail(error:unknown){this.error.set(error instanceof HttpErrorResponse?(error.error?.detail??'تعذر الحفظ. راجع الصلاحيات والبيانات وحاول مجددًا.'):error instanceof Error?error.message:'تعذر تنفيذ الطلب.');}
}
export const clinicalWorkflowLeaveGuard:CanDeactivateFn<ClinicalWorkflowComponent>=component=>component.canLeave();
