import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EndodonticRecord } from './dental-api.service';
import { RootCanalDraft, ROOT_CANAL_STAGES } from './root-canal';

@Component({
  selector: 'app-root-canal-editor',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="root-canal-card">
      <h4>{{ english ? 'Root canal details' : 'تفاصيل حشو العصب' }}</h4>
      @for (record of previous; track record.id) {
        <details class="previous-session" [open]="$first">
          <summary>{{ english ? 'Previous session' : 'الجلسة السابقة' }} · {{ (record.updatedAt || record.createdAt) | date:'dd/MM/yyyy' }} · {{ stageName(record.stage) }}</summary>
          <div class="previous-canals">@for (canal of record.canals; track canal.id) {
            <span><b>{{ canal.name }}</b> · {{ canal.lengthMm ?? '—' }} mm · {{ canal.finalFileSize || '—' }}</span>
          }</div>
          @if (record.notes) { <p class="clinical-notes">{{ record.notes }}</p> }
        </details>
      }
      <fieldset [disabled]="disabled">
        @if (draft.stage === 6) {
          <p class="completed-stage" dir="ltr">✓ Root canal stages completed</p>
        } @else {
          <h5 class="current-stage" dir="ltr">{{ currentStage.number }}- {{ currentStage.en }}</h5>
          @if (currentStage.value === 2) {
            <div class="canal-grid" dir="ltr">
              @for (canal of draft.canals; track canal.name) {
                <div class="canal-card">
                  <strong>{{ canal.name }}</strong>
                  <label>Working length (mm)<input type="number" min="0.01" max="50" step="0.01" [(ngModel)]="canal.lengthMm" /></label>
                  <label>Final file size<input type="text" maxlength="50" [(ngModel)]="canal.finalFileSize" /></label>
                </div>
              }
            </div>
            @if (measurementError) { <p role="alert" class="stage-error">{{ english ? 'Enter the working length (0–50 mm) and final file size for each canal.' : 'أدخل طول العمل (أكبر من صفر وحتى 50 مم) ومقاس الملف النهائي لكل قناة.' }}</p> }
            <button type="button" class="complete-stage" (click)="completeStage()">{{ english ? 'Done ✓' : 'تمام ✓' }}</button>
          } @else {
            <label class="stage-check"><input type="checkbox" [checked]="false" (change)="completeStage($event)" />{{ english ? 'Completed' : 'تم' }}</label>
          }
        }
        @if (draft.stage !== 1) { <button type="button" class="previous-stage" (click)="previousStage()">{{ english ? 'Previous step' : 'الخطوة السابقة' }}</button> }
        <label>{{ english ? 'Session notes / remaining work' : 'ملاحظات الجلسة / العمل المتبقي' }}<textarea [(ngModel)]="draft.notes" maxlength="2000" rows="3"></textarea></label>
        @if (canSave) {
          <button type="button" (click)="save.emit()">{{ english ? 'Save session progress (no new charge)' : 'حفظ تقدم الجلسة — بدون إضافة تكلفة' }}</button>
        } @else { <small>{{ english ? 'These details are saved when you record the procedure below.' : 'تُحفظ التفاصيل مع تسجيل الإجراء بالزر الموجود بالأسفل.' }}</small> }
      </fieldset>
    </section>`,
  styles: [`
    .root-canal-card{border:1px solid #b9dedb;border-radius:12px;background:#f2fbfa;padding:16px;margin-top:16px}
    h4{margin:0 0 12px}fieldset{border:0;padding:0;display:grid;gap:14px;min-width:0}
    label{display:grid;gap:6px}input,select,textarea{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd5e1;border-radius:7px;background:white}
    .canal-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:12px}
    .canal-card{background:white;border:1px solid #d8e5e8;border-radius:10px;padding:12px;display:grid;gap:10px;text-align:center;font-size:.8rem}
    .canal-card strong{justify-self:center;background:#dbefeb;border-radius:20px;padding:4px 10px;color:#165a50}
    .current-stage{margin:0;font-size:1rem;text-align:start}.stage-check{display:flex;align-items:center;gap:8px}.stage-check input{width:18px;height:18px;cursor:pointer}.completed-stage{color:#16825f;font-weight:700}.stage-error{color:#b42318;margin:0}.previous-stage{background:white;color:#436174;border:1px solid #ccdadd;justify-self:start}.stage-strip{display:flex;flex-wrap:wrap;gap:6px;font-size:.75rem}.stage-strip span{padding:6px;border-radius:6px;background:#edf1f5}.stage-strip .current{background:#d9ecfc;color:#174a79;font-weight:700}
    .previous-session{background:white;padding:10px;margin-bottom:14px;border:1px solid #d8e5e8;border-radius:8px}summary{cursor:pointer;font-weight:600}.previous-canals{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}.clinical-notes{white-space:pre-wrap}
    button{padding:10px;border:0;border-radius:8px;background:#168a82;color:white;font-weight:700;cursor:pointer}
  `],
})
export class RootCanalEditorComponent {
  @Input({ required: true }) draft!: RootCanalDraft;
  @Input() previous: EndodonticRecord[] = [];
  @Input() disabled = false;
  @Input() canSave = false;
  @Input() english = false;
  @Output() save = new EventEmitter<void>();
  readonly stages = ROOT_CANAL_STAGES;
  measurementError = false;
  get currentStage() { return this.stages.find(s => s.value === this.draft.stage) ?? this.stages[1]; }
  completeStage(event?: Event) {
    if (event?.target) (event.target as HTMLInputElement).checked = false;
    if (this.disabled || this.draft.stage === 6) return;
    this.measurementError = this.currentStage.value === 2 && (!this.draft.canals.length || this.draft.canals.some(c => c.lengthMm === null || !Number.isFinite(c.lengthMm) || c.lengthMm <= 0 || c.lengthMm > 50 || !c.finalFileSize.trim() || c.finalFileSize.length > 50));
    if (this.measurementError) return;
    const index = this.stages.findIndex(s => s.value === this.currentStage.value);
    this.draft.stage = this.stages[index + 1]?.value ?? 6;
    if (this.canSave) this.save.emit();
  }
  previousStage() {
    if (this.disabled) return;
    const index = this.draft.stage === 6 ? this.stages.length : this.stages.findIndex(s => s.value === this.currentStage.value);
    this.draft.stage = this.stages[Math.max(0, index - 1)].value;
    this.measurementError = false;
  }
  stageName(value?: number | null) {
    if (value === 6) return 'Root canal stages completed';
    const stage = this.stages.find(s => s.value === (value === 3 ? 2 : value));
    return stage ? stage.number + '- ' + stage.en : this.english ? 'Stage not recorded' : 'المرحلة غير مسجلة';
  }
}
