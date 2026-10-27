import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { ImplantApiService, ImplantDetails, ImplantFile } from './implant-api.service';
import { ImplantFieldComponent } from './implant-field.component';
import { ImplantIconComponent } from './implant-icon.component';
import { toothName } from './tooth-labels';
import { emptyImplantWorkflow, followupDate, ImplantData, ImplantWorkflow, implantStages, implantValidation, visibleImplantFields, implantGroups } from './implant-fields';

@Component({selector:'app-implant-workflow',standalone:true,imports:[FormsModule,RouterLink,ImplantFieldComponent,ImplantIconComponent],templateUrl:'./implant-workflow.component.html',styleUrl:'./implant-workflow.scss'})
export class ImplantWorkflowComponent implements OnInit {
  private readonly api=inject(ImplantApiService); private readonly route=inject(ActivatedRoute); readonly auth=inject(AuthService);
  readonly record=signal<ImplantDetails|null>(null); readonly busy=signal(false); readonly error=signal(''); readonly success=signal('');
  readonly files=signal<ImplantFile[]>([]); readonly loading=signal(true); readonly stages=implantStages;
  readonly phaseNames=[{en:'Planning',ar:'التقييم والتخطيط'},{en:'Implant Placement',ar:'زراعة الغرسة'},{en:'Healing',ar:'مرحلة الالتئام'},{en:'Prosthetic Restoration',ar:'الترميم النهائي'}];
  workflow:ImplantWorkflow=emptyImplantWorkflow(); step=0; visitIndex=0;
  readonly patientId=this.route.snapshot.paramMap.get('patientId')!;
  readonly sourceAppointmentId=this.route.snapshot.queryParamMap.get('appointmentId');
  readonly tooth=Number(this.route.snapshot.paramMap.get('tooth'));
  get toothDescription() { return toothName(this.tooth,'en'); }
  private readonly objectUrls:string[]=[];
  constructor() { inject(DestroyRef).onDestroy(()=>this.objectUrls.forEach(url=>URL.revokeObjectURL(url))); }
  get canEdit() { return this.auth.hasPermission('Dental.Edit') && this.auth.hasPermission('Examination.Edit'); }
  get canComplete() { return this.step!==6 || this.auth.hasPermission('Treatments.Complete'); }
  get phase() { return Math.min(this.step,3); }
  get data():ImplantData {
    if(this.step===2 || this.step===6) return this.visits[this.visitIndex] ?? {};
    return this.workflow[implantStages[this.step].key] as ImplantData;
  }
  get visits():ImplantData[] { return this.step===2 ? this.workflow.healingVisits : this.workflow.followupVisits; }
  get fields() { return visibleImplantFields(this.step,this.data); }
  get groups() { return implantGroups(this.step,this.data); }
  get dateField() { return this.fields.find(f=>f.key==='date'); }
  get section() { return this.stages[this.step].key + (this.step===2 || this.step===6 ? ':'+this.data['id'] : ''); }
  get sectionFiles() { return this.files().filter(file=>file.section===this.section); }
  get next():ImplantData { if (!this.data['next'] || typeof this.data['next'] !== 'object' || Array.isArray(this.data['next'])) this.data['next']={}; return this.data['next'] as ImplantData; }
  get appointmentStep() { return [1,2,5,6].includes(this.step); }
  get intervals() { return this.step===6 ? [{id:'1m',label:'1 month',ar:'شهر'},{id:'3m',label:'3 months',ar:'٣ أشهر'},{id:'6m',label:'6 months',ar:'٦ أشهر'},{id:'custom',label:'Custom',ar:'تحديد يدوي'}] : [{id:'1w',label:'1 week',ar:'أسبوع'},{id:'2w',label:'2 weeks',ar:'أسبوعان'},{id:'1m',label:'1 month',ar:'شهر'},...(this.step===2?[]:[{id:'3m',label:'3 months',ar:'٣ أشهر'}]),{id:'custom',label:'Custom',ar:'تحديد يدوي'}]; }
  async ngOnInit() {
    try {
      if(!/^[1-4][1-8]$/.test(String(this.tooth))) throw new Error('رقم السن غير صحيح.');
      const treatmentId=this.route.snapshot.queryParamMap.get('treatmentId') ?? undefined;
      const records=await firstValueFrom(this.api.list(this.patientId));
      let record=records.find(r=>r.toothNumber===this.tooth && (!treatmentId || r.treatmentId===treatmentId));
      if(!record) {
        const appointmentId=this.route.snapshot.queryParamMap.get('appointmentId');
        if(!appointmentId || !this.canEdit) throw new Error('ابدأ خطة الزراعة من خدمة الزراعة داخل زيارة المريض.');
        record=await firstValueFrom(this.api.create(this.patientId,this.tooth,appointmentId,treatmentId));
      }
      this.accept(record); this.open(Math.min(record.completedStep,6));
      const files=await firstValueFrom(this.api.files(record.id)); this.files.set(files);
      for(const file of files) if(file.contentType.startsWith('image/')) await this.preview(file);
    } catch(error) { this.fail(error); } finally { this.loading.set(false); }
  }
  private accept(record:ImplantDetails) { this.record.set(record); this.workflow={...emptyImplantWorkflow(),...record.workflow}; }
  open(step:number) {
    if(this.busy() || step<0 || step>Math.min(this.record()?.completedStep ?? 0,6)) return;
    this.step=step; this.visitIndex=0;
    if((step===2 || step===6) && !this.visits.length) this.addVisit();
    else if(step===2 || step===6) this.visitIndex=this.visits.length-1;
    this.success.set('');
  }
  addVisit() { if(!this.canEdit || this.busy() || this.visits.length>=100) return; this.visits.push({id:crypto.randomUUID()}); this.visitIndex=this.visits.length-1; }
  intervalChanged(value:string) { this.next['interval']=value; if(value!=='custom') this.next['date']=followupDate(String(this.data['date']??''),value); }
  refreshDate() { const interval=String(this.next['interval']??'custom'); if(interval!=='custom') this.intervalChanged(interval); }
  async save(advance=false) {
    const record=this.record(); if(!record || this.busy() || !this.canEdit) return;
    this.error.set(''); this.success.set('');
    if(advance) {
      const visits=this.step===2 || this.step===6 ? this.visits : [this.data];
      for(const data of visits) { const invalid=implantValidation(this.step,data); if(invalid) { this.error.set('أكمل الحقل: '+invalid); return; } }
      if(this.step===5 && this.data['seating']!=='final') { this.error.set('احفظ التجربة أو التركيبة المؤقتة كمسودة. يلزم تركيب نهائي للانتقال للمتابعة.'); return; }
    }
    if(this.appointmentStep && this.next['send']===true && (!this.next['date'] || !this.next['time'] || !this.data['date'] || String(this.next['date'])<=String(this.data['date']))) { this.error.set('اختر تاريخ متابعة بعد تاريخ الزيارة وحدد الساعة قبل إرسال الموعد للاستقبال.'); return; }
    const continueHealing=advance && this.step===2 && this.data['nextPlan']!=='prosthetic';
    const completeStep=advance && !continueHealing ? this.step+1 : undefined;
    this.busy.set(true);
    try {
      const result=await firstValueFrom(this.api.save(record,this.workflow,completeStep)); this.accept(result);
      this.success.set(continueHealing ? 'تم حفظ زيارة الالتئام. يمكنك إضافة زيارة جديدة لاحقًا.' : advance && this.step===6 ? 'تم حفظ المتابعة وإكمال خطة الزراعة.' : 'تم الحفظ بنجاح.');
      if(advance && !continueHealing && this.step<6) { this.busy.set(false); this.open(this.step+1); this.success.set('تم حفظ المرحلة السابقة بنجاح.'); }
    } catch(error) { this.fail(error); } finally { this.busy.set(false); }
  }
  async upload(event:Event) {
    const input=event.target as HTMLInputElement; const record=this.record(); if(!record || !input.files?.length || this.busy()) return;
    this.busy.set(true); this.error.set(''); const section=this.section;
    try {
      this.accept(await firstValueFrom(this.api.save(record,this.workflow)));
      for(const file of Array.from(input.files)) { if(file.size>10_000_000) throw new Error('حجم كل ملف يجب أن يكون أقل من ١٠ ميجابايت.'); const uploaded=await firstValueFrom(this.api.upload(record.id,section,file)); this.files.update(files=>[...files,uploaded]); if(uploaded.contentType.startsWith('image/')) await this.preview(uploaded); }
    }
    catch(error) { this.fail(error); } finally { this.busy.set(false); input.value=''; }
  }
  private async preview(file:ImplantFile) { const blob=await firstValueFrom(this.api.blob(this.record()!.id,file.id)); file.preview=URL.createObjectURL(blob); this.objectUrls.push(file.preview); this.files.update(files=>[...files]); }
  async download(file:ImplantFile) { try { const blob=await firstValueFrom(this.api.blob(this.record()!.id,file.id)); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=file.fileName; a.click(); URL.revokeObjectURL(url); } catch(error) { this.fail(error); } }
  async remove(file:ImplantFile) { if(this.busy()) return; this.busy.set(true); try { await firstValueFrom(this.api.remove(this.record()!.id,file.id)); this.files.update(files=>files.filter(f=>f.id!==file.id)); } catch(error) { this.fail(error); } finally { this.busy.set(false); } }
  private fail(error:unknown) { this.error.set(error instanceof HttpErrorResponse ? error.status===409 ? 'تغيّر السجل أو الموعد غير متاح. أعد تحميل الصفحة إذا تغيّر السجل، أو اختر موعدًا آخر. '+(error.error?.detail??'') : error.error?.detail ?? 'تعذر تنفيذ الطلب. راجع صلاحياتك واتصالك ثم حاول مجددًا.' : error instanceof Error ? error.message : 'تعذر الحفظ.'); }
}
