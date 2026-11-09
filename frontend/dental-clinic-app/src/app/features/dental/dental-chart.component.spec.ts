import { TestBed } from '@angular/core/testing';
import { LocalizationService } from '../../core/localization.service';
import { DentalChartComponent } from './dental-chart.component';

describe('DentalChartComponent', () => {
  it('offers exactly the requested five tooth services in order', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    expect(fixture.componentInstance.quickFindingTypes).toEqual([2,8,14,15,9]);
  });

  it('allows selecting an extracted tooth with completed history and a future implant plan without changing either', () => {
    const fixture=TestBed.createComponent(DentalChartComponent),c=fixture.componentInstance;
    const records=[{id:'extraction',name:'Extraction',type:2,status:4,completedAt:'2026-10-19T10:00:00Z'},{id:'implant-plan',name:'Implant',type:3,status:1}];
    fixture.componentRef.setInput('teeth',[{toothId:'t36',toothNumber:36,findings:[4],procedures:[2],treatmentProgress:records}]);
    fixture.detectChanges();
    const tooth=fixture.nativeElement.querySelector('button[aria-label*="#36"]') as HTMLButtonElement;
    expect(tooth.disabled).toBe(false);expect(c.toothState(36)).toBe('extracted');expect(c.completedWork(36)).toBe(true);expect(c.pendingWork(36)).toBe(true);
    tooth.click();expect(c.selectedNumber).toBe(36);expect(c.find(36)!.treatmentProgress).toEqual(records);
  });

  beforeEach(async () => {
    try { window.localStorage.removeItem('medaudit.language'); } catch {}
    await TestBed.configureTestingModule({ imports: [DentalChartComponent] }).compileComponents();
  });

  it('keeps planned implants as teeth and replaces completed implants with a screw', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[15],procedures:[3],treatmentProgress:[{id:'i',name:'Implant',type:3,status:3}]}]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.implant-screw')).toBeNull();
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[15],procedures:[],treatmentProgress:[{id:'i',name:'Implant',type:3,status:4,completedAt:'2026-10-19T10:00:00Z'}]}]);
    fixture.detectChanges();
    const tooth=fixture.nativeElement.querySelector('button[aria-label*="#36"]');
    expect(tooth.querySelector('.implant-screw')).not.toBeNull(); expect(tooth.classList.contains('implanting')).toBe(true);
    expect(tooth.classList.contains('missing')).toBe(false);
  });
  it('animates newly completed extraction and leaves an empty tooth position', () => {
    const fixture=TestBed.createComponent(DentalChartComponent);
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[14],procedures:[]}]); fixture.detectChanges();
    expect(fixture.componentInstance.isMissing(fixture.componentInstance.find(36))).toBe(false);
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[14],procedures:[],treatmentProgress:[{id:'e',name:'Extraction',type:2,status:4}]}]); fixture.detectChanges();
    const tooth=fixture.nativeElement.querySelector('button[aria-label*="#36"]');
    expect(tooth.classList.contains('extracting')).toBe(true); expect(tooth.classList.contains('missing')).toBe(true);
    expect(tooth.textContent).toContain('تم الخلع');
  });
  it('restores the screw after reopening without replaying historical animation and respects later extraction', () => {
    const fixture=TestBed.createComponent(DentalChartComponent);
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[4],procedures:[2,3],treatmentProgress:[{id:'i',name:'Implant',type:3,status:4,completedAt:'2026-10-19T10:00:00Z'}]}]); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.implant-screw')).not.toBeNull(); expect(fixture.componentInstance.animatedTeeth()).toEqual({});
    fixture.componentRef.setInput('teeth', [{toothId:'t36',toothNumber:36,findings:[4],procedures:[2,3],treatmentProgress:[{id:'i',name:'Implant',type:3,status:4,completedAt:'2026-10-19T10:00:00Z'},{id:'e',name:'Extraction',type:2,status:4,completedAt:'2026-10-20T10:00:00Z'}]}]); fixture.detectChanges();
    expect(fixture.componentInstance.toothState(36)).toBe('extracted'); expect(fixture.nativeElement.querySelector('.implant-screw')).toBeNull();
  });

  it('keeps the lower-jaw diagnosis menu inside the viewport without a close option', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.componentInstance.showQuickFindings = true;
    fixture.detectChanges();
    const tooth = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label*="#36"]')!;
    tooth.getBoundingClientRect = () => ({ top: window.innerHeight - 120, bottom: window.innerHeight - 20, left: 20, right: 80, width: 60, height: 100, x: 20, y: window.innerHeight - 120, toJSON: () => ({}) });
    tooth.dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    const menu = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.tooth-problem-menu')!;
    expect(parseFloat(menu.style.bottom)).toBeGreaterThan(0);
    expect(parseFloat(menu.style.maxHeight)).toBeLessThanOrEqual(window.innerHeight - 16);
    expect(menu.textContent).not.toContain('إغلاق'); expect(menu.textContent).not.toContain('Close');
  });
  it('shows both completed and pending work on the same tooth', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.componentInstance.teeth = [{ toothId: 't36', toothNumber: 36, findings: [10], procedures: [4], hasEndodonticRecord: true, treatmentProgress: [{ id: 'root', name: 'Root canal', type: 4, status: 4 }, { id: 'crown', name: 'Crown', type: 5, status: 1 }] }];
    fixture.detectChanges();
    const tooth = (fixture.nativeElement as HTMLElement).querySelector('button[aria-label*="#36"]')!;
    expect(tooth.textContent).toContain('✓');
    expect(tooth.textContent).toContain('◷');
  });

  it('renders the permanent FDI chart as visual selectable teeth', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.detectChanges();
    const teeth = (fixture.nativeElement as HTMLElement).querySelectorAll('button.planora-tooth');
    expect(teeth.length).toBe(32);
    expect(teeth[0].querySelector('.tooth-anatomy')).not.toBeNull();
    (Array.from(teeth).find((x) => x.getAttribute('aria-label')?.includes('36')) as HTMLButtonElement).click();
    expect(fixture.componentInstance.selectedNumber).toBe(36);
  }, 15000);

  it('selects a tooth through keyboard-friendly FDI search and rejects invalid numbers', () => {
    const component = TestBed.createComponent(DentalChartComponent).componentInstance;
    component.query = '48';
    component.search();
    expect(component.selectedNumber).toBe(48);
    expect(component.searchError).toBe(false);
    component.query = '55';
    component.search();
    expect(component.searchError).toBe(true);
  });

  it('renders Arabic text and respects the global RTL direction', () => {
    TestBed.inject(LocalizationService).set('ar');
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('مخطط الأسنان');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('shows tooth names and a hover problem menu with independent root canal and crown choices', () => {
    TestBed.inject(LocalizationService).set('en');
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.componentInstance.showQuickFindings = true;
    fixture.detectChanges();
    const tooth = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label*="#36"]')!;
    tooth.focus(); fixture.detectChanges();
    const menu = (fixture.nativeElement as HTMLElement).querySelector('.tooth-problem-menu')!;
    expect(menu.textContent).toContain('Root canal');
    expect(menu.textContent).toContain('Crown');
    expect(menu.textContent).toContain('Lower Left 6');
    expect(fixture.nativeElement.textContent).not.toContain('3D Studio');
    expect(fixture.nativeElement.textContent).not.toContain('Odontogram');
  });

  it('colors caries outside and root canal inside independently', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.componentInstance.teeth = [{ toothId: 't36', toothNumber: 36, findings: [2, 10], procedures: [], hasEndodonticRecord: false }];
    fixture.detectChanges();
    const art = (fixture.nativeElement as HTMLElement).querySelector('button[aria-label*="#36"] .planora-art')!;
    expect(art.innerHTML).toContain('#fb923c');
    expect(art.innerHTML).toContain('#9333ea');
    expect(art.innerHTML).toContain('#eab308');
  });

  it('does not treat completed whole-mouth cleaning as completion of an untreated filling',()=>{
    const fixture=TestBed.createComponent(DentalChartComponent),c=fixture.componentInstance;
    fixture.componentRef.setInput('teeth',[{toothId:'t36',toothNumber:36,findings:[2,12],procedures:[],hasEndodonticRecord:false,treatmentProgress:[{id:'clean',name:'Scaling and polishing',type:6,status:4}]}]);fixture.detectChanges();
    expect(c.completedWork(36)).toBe(false);expect(c.pendingWork(36)).toBe(true);
  });
  it('highlights a newly completed tooth while preserving its completed marker',()=>{
    const fixture=TestBed.createComponent(DentalChartComponent);
    fixture.componentRef.setInput('teeth',[{toothId:'t36',toothNumber:36,findings:[2],procedures:[],hasEndodonticRecord:false,treatmentProgress:[{id:'done',name:'Filling',type:1,status:4}]}]);
    fixture.componentRef.setInput('completedHighlights',[36]);fixture.detectChanges();
    const tooth=fixture.nativeElement.querySelector('button[aria-label*="#36"]');expect(tooth.classList.contains('completion-highlight')).toBe(true);expect(tooth.textContent).toContain('✓');
  });
  it('supports multi-tooth selection and quick jaw selectors', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    const component = fixture.componentInstance;
    component.multiSelect = true;
    component.selectedTeeth = [21];
    fixture.detectChanges();

    component.choose(22);
    expect(component.selectedTeeth).toEqual([21, 22]);

    // Toggling tooth removes it
    component.choose(21);
    expect(component.selectedTeeth).toEqual([22]);

    component.choose(22);
    expect(component.selectedTeeth).toEqual([]);

    // Quick select upper jaw
    component.selectAllUpper();
    expect(component.selectedTeeth.length).toBe(16);
    expect(component.selectedTeeth).toContain(11);
    expect(component.selectedTeeth).toContain(28);

    // Clear selection leaves no implicitly selected tooth
    component.clearSelection();
    expect(component.selectedTeeth.length).toBe(0);
    expect(component.selectedNumber).toBe(0);
  });
});

