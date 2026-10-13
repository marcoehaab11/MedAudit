import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { LocalizationService } from '../../core/localization.service';
import { ToothChartSummary } from './dental-api.service';
import { FINDING_APPEARANCE } from './dental-appearance';
import { ArtRecord, renderPlanoraTooth } from './planora-dental-art';
import { toothName } from './tooth-labels';

@Component({
  selector: 'app-dental-chart', imports: [FormsModule], styleUrl: './dental-chart.scss',
  template: `<section class="chart-panel" aria-labelledby="chart-title">
    <header class="chart-header"><div><h2 id="chart-title">{{ t('Dental Chart', 'مخطط الأسنان') }}</h2>
      <p>{{ t('Patient right appears on the left of this chart.', 'يمين المريض يظهر على يسار المخطط.') }}</p></div>
      <form (ngSubmit)="search()"><label>{{ t('Find tooth', 'بحث برقم السن') }} <input name="tooth" [(ngModel)]="query" maxlength="2" /></label><button>{{ t('Find', 'بحث') }}</button></form>
    </header>
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
    @if (searchError) { <p role="alert">{{ t('Enter a valid FDI number.', 'أدخل رقم سن صحيحًا.') }}</p> }
    <div class="chart-body planora-chart">
      @for (jaw of jaws; track jaw.labelEn) {
        <div class="planora-jaw-label">{{ t(jaw.labelEn, jaw.labelAr) }}</div>
        <div class="planora-chart-scroll" (scroll)="menuTooth = 0"><div class="planora-jaw" [class.planora-upper]="!jaw.lower" [class.planora-lower]="jaw.lower">
          @for (number of jaw.teeth; track number) {
            <div class="tooth-container" (mouseenter)="openMenu(number, $event)" (mouseleave)="closeMenu(number)">
              <button type="button" class="planora-tooth" [class.selected]="isSelectedTooth(number)" [class.missing]="isMissing(find(number))"
                [attr.aria-pressed]="isSelectedTooth(number)" [attr.aria-label]="name(number) + ' #' + number" [title]="name(number) + ' #' + number"
                [style.--tooth-accent]="planoraAccent(number)" (focus)="openMenu(number, $event)" (keydown.escape)="menuTooth = 0" (click)="choose(number, $event)">
                <span class="planora-marker"></span><span class="planora-art" [innerHTML]="planoraArt(number, jaw.lower)"></span>
                <span class="planora-number">{{ name(number, true) }}</span><small>#{{ number }}</small>
              </button>
              @if (showQuickFindings && menuTooth === number) {
                <div class="tooth-problem-menu" [style.top.px]="menuTop" [style.left.px]="menuLeft" (keydown.escape)="menuTooth = 0" role="group" [attr.aria-label]="name(number)">
                  <strong>{{ name(number) }} #{{ number }}</strong>
                  @for (type of quickFindingTypes; track type) {
                    <button type="button" [disabled]="savingFinding" (click)="toothFindingSelected.emit({ toothNumber: number, type: type }); menuTooth = 0">{{ t(findingAppearance[type].en, findingAppearance[type].ar) }}</button>
                  }
                  <button type="button" (click)="menuTooth = 0">{{ t('Close', 'إغلاق') }}</button>
                </div>
              }
            </div>
          }
        </div></div>
      }
    </div>
    <div class="chart-legend"><span>{{ t('Orange: caries · Purple: root canal · Gold: crown · Missing: hidden tooth', 'برتقالي: تسوس · بنفسجي: علاج جذور · ذهبي: كراون · فقد: سن مخفي') }}</span></div>
  </section>`,
})
export class DentalChartComponent {
  @Input() teeth: ToothChartSummary[] = [];
  @Input() selectedNumber = 0;
  @Input() multiSelect = false;
  @Input() selectedTeeth: number[] = [];
  @Input() showQuickFindings = false;
  @Input() savingFinding = false;
  @Output() readonly selectedNumberChange = new EventEmitter<number>();
  @Output() readonly selectedTeethChange = new EventEmitter<number[]>();
  @Output() readonly findingSelected = new EventEmitter<number>();
  @Output() readonly toothFindingSelected = new EventEmitter<{ toothNumber: number; type: number }>();
  readonly findingAppearance = FINDING_APPEARANCE;
  readonly quickFindingTypes = [2, 3, 4, 5, 8, 9, 10];
  readonly jaws = [
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
  name(number: number, short = false) { return toothName(number, this.i18n.language(), short); }
  find(number: number) { return this.teeth.find(x => x.toothNumber === number); }
  openMenu(number: number, event?: Event) {
    if (!this.showQuickFindings || this.savingFinding) return;
    this.menuTooth = number;
    const element = event?.currentTarget as HTMLElement | undefined;
    if (element) { const rect = element.getBoundingClientRect(); this.menuLeft = Math.max(8, Math.min(rect.left, window.innerWidth - 220)); this.menuTop = Math.max(8, Math.min(rect.bottom, window.innerHeight - 340)); }
  }
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
  isMissing(tooth?: ToothChartSummary) { return !!tooth?.findings.includes(4) && !tooth.procedures.includes(3); }
  isCaries(tooth?: ToothChartSummary) { return !!tooth?.findings.includes(2); }
  isEndo(tooth?: ToothChartSummary) { return !!tooth && (tooth.hasEndodonticRecord || tooth.procedures.includes(4) || tooth.findings.some(x => [8,10].includes(x))); }
  isCrown(tooth?: ToothChartSummary) { return !!tooth && (tooth.procedures.includes(5) || tooth.findings.some(x => [9,10].includes(x))); }
  planoraArt(number: number, lower: boolean): SafeHtml {
    const tooth = this.find(number);
    const record: ArtRecord = { treatment: tooth?.procedures.includes(3) ? 'implant' : this.isCrown(tooth) ? 'crown' : this.isEndo(tooth) ? 'root-canal' : tooth?.procedures.includes(1) ? 'filling' : 'none',
      status: tooth?.findings.some(x => [8,9,10].includes(x)) ? 'planned' : 'existing', surfaces: ['O'], caries: this.isCaries(tooth), endo: this.isEndo(tooth), crown: this.isCrown(tooth) };
    const key = JSON.stringify([number, lower, record]);
    let art = this.artCache.get(key);
    if (!art) { art = this.sanitizer.bypassSecurityTrustHtml(renderPlanoraTooth(number, record, lower)); this.artCache.set(key, art); }
    return art;
  }
  planoraAccent(number: number) { const tooth = this.find(number); return this.isMissing(tooth) ? '#94a3b8' : this.isCaries(tooth) ? '#fb923c' : this.isEndo(tooth) ? '#9333ea' : this.isCrown(tooth) ? '#eab308' : tooth?.findings.includes(3) ? '#f43f5e' : tooth?.findings.includes(5) ? '#06b6d4' : tooth?.procedures.some(x => [1,3].includes(x)) ? '#10b9c5' : '#d4dcde'; }
}
