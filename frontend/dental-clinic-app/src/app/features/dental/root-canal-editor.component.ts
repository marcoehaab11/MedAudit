import { DatePipe } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EndodonticRecord } from './dental-api.service';
import { RootCanalDraft, rootCanalStages } from './root-canal';

@Component({
  selector: 'app-root-canal-editor',
  imports: [FormsModule, DatePipe],
  template: `
    <section class="root-canal-card">
      <h4>{{ english ? 'Root canal details' : 'تفاصيل حشو العصب' }}</h4>
      @for (record of previous; track record.id) {
        <details class="previous-session" [open]="$first">
          <summary>{{ english ? 'Previous session' : 'الجلسة السابقة' }} · {{ (record.updatedAt || record.createdAt) | date:'dd/MM/yyyy' }} · {{ stageName(record.stage, record.restorationType ?? undefined) }}</summary>
          <div class="previous-canals">@for (canal of record.canals; track canal.id) {
            <span><b>{{ canal.name }}</b> · {{ canal.lengthMm ?? '—' }} mm · {{ canal.finalFileSize || '—' }}</span>
          }</div>
          @if (record.postType) { <p dir="ltr">Post and core · {{ record.postType === 'fiber' ? 'Fiber post' : record.postType === 'metal' ? 'Metal post' : 'Custom post' }} @if (record.postCanal) { · {{ record.postCanal }} }</p> }
          @if (record.notes) { <p class="clinical-notes">{{ record.notes }}</p> }
        </details>
      }
      @if (saveState || pendingSave) { <p class="auto-save-status" role="status">{{ pendingSave ? (english ? 'Saving…' : 'جارٍ الحفظ التلقائي…') : saveState }} @if (saveFailed) { <button type="button" (click)="changed.emit()">{{ english ? 'Retry' : 'إعادة المحاولة' }}</button> }</p> }
      <ol class="root-stage-timeline" dir="ltr" [attr.aria-label]="english ? 'Root canal treatment steps' : 'خطوات علاج حشو العصب'">
        @for (stage of stages; track stage.value; let index = $index) {
          <li [class.active]="draft.stage !== 6 && currentStage.value === stage.value"
              [class.done]="draft.stage === 6 || index < currentStageIndex"
              [attr.aria-current]="draft.stage !== 6 && currentStage.value === stage.value ? 'step' : null">
            <span class="timeline-number" aria-hidden="true">{{ draft.stage === 6 || index < currentStageIndex ? '✓' : stage.number }}</span>
            <span class="timeline-label">{{ stage.en }}</span>
          </li>
        }
      </ol>
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
                  <label>Working length (mm)<input type="number" min="0.01" max="50" step="0.01" [(ngModel)]="canal.lengthMm" (ngModelChange)="scheduleSave()" /></label>
                  <label>Final file size<input type="text" maxlength="50" [(ngModel)]="canal.finalFileSize" (ngModelChange)="scheduleSave()" /></label>
                </div>
              }
            </div>
            @if (measurementError) { <p role="alert" class="stage-error">{{ english ? 'Enter the working length (0–50 mm) and final file size for each canal.' : 'أدخل طول العمل (أكبر من صفر وحتى 50 مم) ومقاس الملف النهائي لكل قناة.' }}</p> }
            <button type="button" class="complete-stage" (click)="completeStage()">{{ english ? 'Done ✓' : 'تمام ✓' }}</button>
          } @else {
            @if (currentStage.value === 7) {
              <label dir="ltr">Type of post
                <select [(ngModel)]="draft.postType" (ngModelChange)="scheduleSave()">
                  <option [ngValue]="null">Select type of post…</option>
                  <option value="fiber">Fiber post</option><option value="metal">Metal post</option><option value="custom">Custom post</option>
                </select>
              </label>
              <label dir="ltr">Canal
                <select [(ngModel)]="draft.postCanal" (ngModelChange)="scheduleSave()">
                  <option [ngValue]="null">Select canal…</option>
                  @for (canal of draft.canals; track canal.name) { <option [value]="canal.name">{{ canal.name }}</option> }
                </select>
              </label>
              @if (postError) { <p class="stage-error" role="alert">Select type of post and canal</p> }
            }
            <label class="stage-check"><input type="checkbox" [checked]="false" (change)="completeStage($event)" />{{ english ? 'Completed' : 'تم' }}</label>
          }
        }
        @if (draft.stage !== 1) { <button type="button" class="previous-stage" (click)="previousStage()">{{ english ? 'Previous step' : 'الخطوة السابقة' }}</button> }
        <label>{{ english ? 'Session notes / remaining work' : 'ملاحظات الجلسة / العمل المتبقي' }}<textarea [(ngModel)]="draft.notes" (ngModelChange)="scheduleSave()" maxlength="2000" rows="3"></textarea></label>
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
  `],
})
export class RootCanalEditorComponent implements OnDestroy {
  @Input({ required: true }) draft!: RootCanalDraft;
  @Input() previous: EndodonticRecord[] = [];
  @Input() disabled = false;
  @Input() canSave = false;
  @Input() english = false;
  @Output() save = new EventEmitter<void>();
  @Input() saveState = '';
  @Input() saveFailed = false;
  @Output() changed = new EventEmitter<void>();
  private saveTimer?: ReturnType<typeof setTimeout>;
  postError = false;
  pendingSave = false;
  get currentStageIndex() { return this.stages.findIndex(stage => stage.value === this.currentStage.value); }
  get stages() { return rootCanalStages(this.draft.restorationType); }
  scheduleSave() {
    if (this.disabled) return;
    this.pendingSave = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => { this.saveTimer = undefined; this.pendingSave = false; this.changed.emit(); }, 600);
  }
  ngOnDestroy() { if (this.saveTimer) { clearTimeout(this.saveTimer); this.changed.emit(); } }

  measurementError = false;
  get currentStage() { return this.stages.find(s => s.value === this.draft.stage) ?? (this.draft.stage === 5 ? this.stages[3] : this.stages[1]); }
  completeStage(event?: Event) {
    if (event?.target) (event.target as HTMLInputElement).checked = false;
    if (this.disabled || this.draft.stage === 6) return;
    this.measurementError = this.currentStage.value === 2 && (!this.draft.canals.length || this.draft.canals.some(c => c.lengthMm === null || !Number.isFinite(c.lengthMm) || c.lengthMm <= 0 || c.lengthMm > 50 || !c.finalFileSize.trim() || c.finalFileSize.length > 50));
    if (this.measurementError) return;
    this.postError = this.currentStage.value === 7 && (!this.draft.postType || !this.draft.canals.some(c => c.name === this.draft.postCanal));
    if (this.postError) return;
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = undefined; this.pendingSave = false; }
    const index = this.stages.findIndex(s => s.value === this.currentStage.value);
    this.draft.stage = this.stages[index + 1]?.value ?? 6;
    if (this.canSave) this.save.emit(); else this.changed.emit();
  }
  previousStage() {
    if (this.disabled) return;
    const index = this.draft.stage === 6 ? this.stages.length : this.stages.findIndex(s => s.value === this.currentStage.value);
    this.draft.stage = this.stages[Math.max(0, index - 1)].value;
    this.measurementError = false; this.postError = false; this.changed.emit();
  }
  stageName(value?: number | null, mode = this.draft.restorationType) {
    if (value === 6) return 'Root canal stages completed';
    const stages = rootCanalStages(mode);
    const stage = stages.find(s => s.value === (value === 3 ? 2 : value)) ?? (value === 5 ? stages[3] : undefined);
    return stage ? stage.number + '- ' + stage.en : this.english ? 'Stage not recorded' : 'المرحلة غير مسجلة';
  }
}
