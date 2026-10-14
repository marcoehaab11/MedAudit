import { TestBed } from '@angular/core/testing';
import { LocalizationService } from '../../core/localization.service';
import { DentalChartComponent } from './dental-chart.component';

describe('DentalChartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DentalChartComponent] }).compileComponents();
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

