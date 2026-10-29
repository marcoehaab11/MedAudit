import { Component, DestroyRef, EventEmitter, inject, Input, OnChanges, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LocalizationService } from '../../core/localization.service';
import { ToothChartSummary } from './dental-api.service';
import { FINDING_APPEARANCE, QUICK_TOOTH_FINDING_TYPES } from './dental-appearance';
import { ArtRecord, renderPlanoraTooth } from './planora-dental-art';
import { toothName } from './tooth-labels';

@Component({
  host: { '(document:click)': 'dismissMenu($event)' },
  selector: 'app-dental-chart', imports: [FormsModule], styleUrl: './dental-chart.scss',
  template: `<section class="chart-panel" [attr.aria-labelledby]="showHeading ? 'chart-title' : null" [attr.aria-label]="showHeading ? null : t('Dental chart', 'مخطط الأسنان')">
    @if (showHeading) { <header class="chart-header"><div><h2 id="chart-title">{{ t('Dental Chart', 'مخطط الأسنان') }}</h2>
      <p>{{ t('Patient right appears on the left of this chart.', 'يمين المريض يظهر على يسار المخطط.') }}</p></div>
      @if (showSearch) { <form (ngSubmit)="search()"><label>{{ t('Find tooth', 'بحث برقم السن') }} <input name="tooth" [(ngModel)]="query" maxlength="2" /></label><button>{{ t('Find', 'بحث') }}</button></form> }
    </header> }
    @if (multiSelect) {
      <div class="chart-multi-bar"><span>{{ selectedTeeth.length }} {{ t('teeth selected', 'أسنان محددة') }}</span>
        <div class="multi-actions"><button type="button" (click)="selectAllUpper()">{{ t('All upper', 'الفك العلوي') }}</button>
        <button type="button" (click)="selectAllLower()">{{ t('All lower', 'الفك السفلي') }}</button>
        <button type="button" (click)="clearSelection()">{{ t('Clear selection', 'مسح التحديد') }}</button></div></div>
    }
    @if (showQuickFindings && selectedTeeth.length) {
      <div class="chart-quick-findings"><span>{{ t('Apply to selected teeth:', 'تسجيل للأسنان المحددة:') }}</span>
        @for (type of quickFindingTypes; track type) { <button type="button" [disabled]="savingFinding" (click)="findingSelected.emit(type)">{{ t(findingAppearance[type].en, findingAppearance[type].ar) }}</button> }
      </div>
    }
    @if (showSearch && searchError) { <p role="alert">{{ t('Enter a valid FDI number.', 'أدخل رقم سن صحيحًا.') }}</p> }
    <div class="chart-body planora-chart">
      @for (jaw of jaws; track jaw.labelEn) {
        <div class="planora-jaw-label">{{ t(jaw.labelEn, jaw.labelAr) }}</div>
        <div class="planora-chart-scroll" (scroll)="menuTooth = 0"><div class="planora-jaw" [class.planora-upper]="!jaw.lower" [class.planora-lower]="jaw.lower">
          @for (number of jaw.teeth; track number) {
            <div class="tooth-container" (mouseenter)="openMenu(number, $event)" (mouseleave)="closeMenu(number)">
              <button type="button" class="planora-tooth" [class.selected]="isSelectedTooth(number)" [class.missing]="isMissing(find(number))" [class.completion-highlight]="completedHighlights.includes(number)" [class.implanted]="toothState(number) === 'implant'"
                [class.extracting]="animatedTeeth()[number] === 'extracted'" [class.implanting]="animatedTeeth()[number] === 'implant'"
                [attr.aria-pressed]="isSelectedTooth(number)" [attr.aria-label]="name(number) + ' #' + number" [title]="name(number) + ' #' + number"
                [style.--tooth-accent]="planoraAccent(number)" (focus)="openMenu(number, $event)" (keydown.escape)="menuTooth = 0" (click)="choose(number, $event)">
                <span class="planora-marker"></span><span class="planora-art" [innerHTML]="planoraArt(number, jaw.lower)"></span>
                <span class="planora-number">#{{ number }}</span>
                @if (toothState(number) === 'implant') { <span class="restoration-label">{{ t('Implant', 'زراعة') }}</span> }
                @if (toothState(number) === 'extracted') { <span class="restoration-label">{{ t('Extracted', 'تم الخلع') }}</span> }
                @if (completedWork(number)) { <small [title]="t('Completed treatment recorded', 'يوجد علاج تم')">✓</small> }
                @if (pendingWork(number)) { <small [title]="t('Pending or ongoing treatment / findings to review', 'علاج متبقي أو تشخيصات للمراجعة')">◷</small> }
              </button>
              @if (showQuickFindings && menuTooth === number) {
                <div class="tooth-problem-menu" [style.top.px]="menuBottom === null ? menuTop : null" [style.bottom.px]="menuBottom" [style.left.px]="menuLeft" [style.max-height.px]="menuMaxHeight" (keydown.escape)="menuTooth = 0" role="group" [attr.aria-label]="name(number)">
                  <strong>{{ name(number) }} #{{ number }}</strong>
                  @for (type of quickFindingTypes; track type) {
                    <button type="button" [disabled]="savingFinding" (click)="toothFindingSelected.emit({ toothNumber: number, type: type }); menuTooth = 0">{{ t(findingAppearance[type].en, findingAppearance[type].ar) }}</button>
                  }
                </div>
              }
            </div>
          }
        </div></div>
      }
    </div>
    <div class="chart-legend"><span>{{ t('Orange: caries · Purple: root canal · Gold: crown · Missing: hidden tooth', 'برتقالي: تسوس · بنفسجي: علاج جذور · ذهبي: كراون · فقد: سن مخفي') }}</span><span>{{ t('Screw: completed implant · ✓ Completed · ◷ Pending', 'مسمار: زراعة منفذة · ✓ علاج تم · ◷ علاج متبقي') }}</span></div>
  </section>`,
})
export class DentalChartComponent implements OnChanges {
  @Input() teeth: ToothChartSummary[] = [];
  @Input() showSearch = true;
  @Input() showHeading = true;
  @Input() primaryTeeth = false;
  @Input() selectedNumber = 0;
  @Input() completedHighlights: number[] = [];
  @Input() multiSelect = false;
  @Input() selectedTeeth: number[] = [];
  @Input() showQuickFindings = false;
  @Input() savingFinding = false;
  @Output() readonly selectedNumberChange = new EventEmitter<number>();
  @Output() readonly selectedTeethChange = new EventEmitter<number[]>();
  @Output() readonly findingSelected = new EventEmitter<number>();
  @Output() readonly toothFindingSelected = new EventEmitter<{ toothNumber: number; type: number }>();
  readonly findingAppearance = FINDING_APPEARANCE;
  readonly quickFindingTypes = QUICK_TOOTH_FINDING_TYPES;
  get jaws() { return this.primaryTeeth ? [
    { labelEn:'Upper primary arch',labelAr:'الفك العلوي — أسنان لبنية',lower:false,teeth:[55,54,53,52,51,61,62,63,64,65] },
    { labelEn:'Lower primary arch',labelAr:'الفك السفلي — أسنان لبنية',lower:true,teeth:[85,84,83,82,81,71,72,73,74,75] },
  ] : this.permanentJaws; }
  private readonly permanentJaws = [
    { labelEn: 'Upper jaw', labelAr: 'الفك العلوي', lower: false, teeth: [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28] },
    { labelEn: 'Lower jaw', labelAr: 'الفك السفلي', lower: true, teeth: [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38] },
  ];
  query = '';
  searchError = false;
  menuTooth = 0;
  menuTop = 120;
  menuLeft = 16;
  private readonly artCache = new Map<string, SafeHtml>();
  constructor(private readonly i18n: LocalizationService, private readonly sanitizer: DomSanitizer) {}
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  name(number: number, short = false) { return number>=51 ? 'Primary '+toothName(number-40,this.i18n.language(),short) : toothName(number, this.i18n.language(), short); }
  private individualWork(number: number) {
    return (this.find(number)?.treatmentProgress ?? []).filter(work => !(work.type === 6 && /denture|أطقم|اطقم|scal|polish|whiten|bleach|clean|ortho|braces|aligner|retainer|تنظيف|تنضيف|جير|تلميع|تبييض|تبيض|تقويم/i.test(work.name)));
  }
  pendingWork(number: number) { const tooth = this.find(number), work = this.individualWork(number); return work.some(t => [1,2,3].includes(t.status)) || (!work.some(t => t.status !== 5) && !!tooth?.findings.some(type => ![1,12,13,16,18].includes(type))); }
  completedWork(number: number) { return this.individualWork(number).some(t => t.status === 4); }
  find(number: number) { return this.teeth.find(x => x.toothNumber === number); }
  menuBottom: number | null = null;
  menuMaxHeight = 320;
  openMenu(number: number, event?: Event) {
    if (!this.showQuickFindings || this.savingFinding) return;
    this.menuTooth = number;
    const element = event?.currentTarget as HTMLElement | undefined;
    if (element) {
      const rect = element.getBoundingClientRect();
      const height = Math.min(window.innerHeight - 16, this.quickFindingTypes.length * 38 + 48);
      this.menuLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 232));
      const below = Math.max(1, window.innerHeight - rect.bottom - 8);
      const above = Math.max(1, rect.top - 8);
      const fitsBelow = below >= height || below >= above;
      this.menuBottom = fitsBelow ? null : Math.max(8, window.innerHeight - rect.top);
      this.menuTop = Math.max(8, rect.bottom);
      this.menuMaxHeight = Math.min(fitsBelow ? below : above, window.innerHeight - 16);
    }
  }
  dismissMenu(event: Event) { if (!(event.target instanceof Element) || !event.target.closest('.planora-tooth, .tooth-problem-menu')) this.menuTooth = 0; }
  closeMenu(number: number) { if (this.menuTooth === number) this.menuTooth = 0; }
  choose(number: number, event?: Event) {
    if (this.savingFinding) return;
    this.searchError = false;
    if (this.multiSelect) {
      this.selectedTeeth = this.selectedTeeth.includes(number) ? this.selectedTeeth.filter(x => x !== number) : [...this.selectedTeeth, number].sort((a,b) => a-b);
      this.selectedNumber = this.selectedTeeth.includes(number) ? number : (this.selectedTeeth[0] || 0);
      this.selectedTeethChange.emit(this.selectedTeeth);
    } else this.selectedNumber = number;
    this.selectedNumberChange.emit(this.selectedNumber);
    this.openMenu(number, event);
  }
  selectAllUpper() { this.selectJaw(0); }
  selectAllLower() { this.selectJaw(1); }
  private selectJaw(index: number) {
    if (this.savingFinding) return;
    this.selectedTeeth = [...new Set([...this.selectedTeeth, ...this.jaws[index].teeth])].sort((a,b) => a-b);
    this.selectedNumber = this.selectedTeeth[0];
    this.selectedNumberChange.emit(this.selectedNumber); this.selectedTeethChange.emit(this.selectedTeeth);
  }
  clearSelection() {
    if (this.savingFinding) return;
    this.selectedTeeth = []; this.selectedNumber = 0; this.menuTooth = 0;
    this.selectedNumberChange.emit(0); this.selectedTeethChange.emit([]);
  }
  search() { const number = Number(this.query); if (!this.jaws.some(j => j.teeth.includes(number))) { this.searchError = true; return; } this.choose(number); }
  isSelectedTooth(number: number) { return this.multiSelect ? this.selectedTeeth.includes(number) : this.selectedNumber === number; }
  readonly animatedTeeth = signal<Record<number, string>>({});
  private previousStates = new Map<number, string>();
  private initialized = false;
  private readonly animationTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private readonly destroyRef = inject(DestroyRef);
  ngOnChanges(): void {
    for (const jaw of this.jaws) for (const number of jaw.teeth) {
      const state = this.toothState(number);
      if (this.initialized && state !== this.previousStates.get(number) && ['implant','extracted'].includes(state)) {
        clearTimeout(this.animationTimers.get(number));
        this.animatedTeeth.update(value => ({...value, [number]: state}));
        this.animationTimers.set(number, setTimeout(() => {
          this.animatedTeeth.update(value => { const next = {...value}; delete next[number]; return next; });
          this.animationTimers.delete(number);
        }, 900));
      }
      this.previousStates.set(number, state);
    }
    if (!this.initialized) this.destroyRef.onDestroy(() => { for (const timer of this.animationTimers.values()) clearTimeout(timer); });
    this.initialized = true;
  }
  toothState(number: number): string {
    const tooth = this.find(number);
    const completed = tooth?.treatmentProgress?.filter(t => t.status === 4 && [2,3].includes(t.type))
      .sort((a,b) => (Date.parse(b.completedAt ?? '') || 0) - (Date.parse(a.completedAt ?? '') || 0));
    if (completed?.length) return completed[0].type === 3 ? 'implant' : 'extracted';
    if (tooth?.procedures.includes(3) && !tooth.treatmentProgress?.some(t => t.type === 3 && t.status !== 5)) return 'implant';
    if (tooth?.procedures.includes(2) && !tooth.treatmentProgress?.some(t => t.type === 2 && t.status !== 5)) return 'extracted';
    return tooth?.findings.includes(4) ? 'missing' : 'tooth';
  }
  isMissing(tooth?: ToothChartSummary) { return !!tooth && ['missing','extracted'].includes(this.toothState(tooth.toothNumber)); }
  isCaries(tooth?: ToothChartSummary) { return !!tooth?.findings.includes(2); }
  isEndo(tooth?: ToothChartSummary) { return !!tooth && (tooth.hasEndodonticRecord || tooth.procedures.includes(4) || tooth.findings.some(x => [8,10,11,17].includes(x))); }
  isCrown(tooth?: ToothChartSummary) { return !!tooth && (tooth.procedures.includes(5) || tooth.findings.some(x => [9,10,11].includes(x))); }
  planoraArt(number: number, lower: boolean): SafeHtml {
    const tooth = this.find(number);
    if (this.toothState(number) === 'implant') {
      const key = 'implant-' + lower;
      let art = this.artCache.get(key);
      if (!art) {
        art = this.sanitizer.bypassSecurityTrustHtml(`<svg class="tooth-anatomy implant-screw" viewBox="0 0 42 98" aria-hidden="true"><g${lower ? '' : ' transform="translate(0 98) scale(1 -1)"'}><path d="M12 8 H30 V18 H12 Z" fill="#d7e3ea" stroke="#647d8d" stroke-width="1.5"/><path d="M15 20 H27 L25 77 Q21 88 17 77 Z" fill="#a8bbc8" stroke="#526e80" stroke-width="1.5"/><path d="M14 27 L28 32 M14 36 L28 41 M15 45 L27 50 M15 54 L27 59 M16 63 L26 68 M17 72 L25 76" stroke="#edf5f8" stroke-width="3"/><path d="M18 22 V73" stroke="#fff" opacity=".45" stroke-width="2"/></g></svg><svg class="tooth-surface" viewBox="0 0 42 42" aria-hidden="true"><circle cx="21" cy="21" r="12" fill="#d7e3ea" stroke="#647d8d" stroke-width="2"/><path d="M17 14 H25 L29 21 L25 28 H17 L13 21 Z" fill="#7893a5"/></svg>`);
        this.artCache.set(key, art);
      }
      return art;
    }
    const record: ArtRecord = { treatment: tooth?.procedures.includes(3) ? 'implant' : this.isCrown(tooth) ? 'crown' : this.isEndo(tooth) ? 'root-canal' : tooth?.procedures.includes(1) ? 'filling' : 'none',
      status: tooth?.findings.some(x => [8,9,10,11,17].includes(x)) ? 'planned' : 'existing', surfaces: ['O'], caries: this.isCaries(tooth), endo: this.isEndo(tooth), crown: this.isCrown(tooth) };
    const key = JSON.stringify([number, lower, record]);
    let art = this.artCache.get(key);
    if (!art) { const artNumber=number>=51?number-40+(number%10>=4?2:0):number;art = this.sanitizer.bypassSecurityTrustHtml(renderPlanoraTooth(artNumber, record, lower)); this.artCache.set(key, art); }
    return art;
  }
  planoraAccent(number: number) { const tooth = this.find(number); return this.isMissing(tooth) ? '#94a3b8' : this.isCaries(tooth) ? '#fb923c' : this.isEndo(tooth) ? '#9333ea' : this.isCrown(tooth) ? '#eab308' : tooth?.findings.some(x => [3,14].includes(x)) ? '#f43f5e' : tooth?.findings.includes(15) ? '#10b9c5' : tooth?.findings.includes(5) ? '#06b6d4' : tooth?.procedures.some(x => [1,3].includes(x)) ? '#10b9c5' : '#d4dcde'; }
}
