import { TestBed } from '@angular/core/testing';
import { LocalizationService } from '../../core/localization.service';
import { DentalChartComponent } from './dental-chart.component';

describe('DentalChartComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DentalChartComponent] }).compileComponents();
  });

  it('renders the permanent FDI chart as visual selectable teeth', () => {
    const fixture = TestBed.createComponent(DentalChartComponent);
    fixture.detectChanges();
    const teeth = (fixture.nativeElement as HTMLElement).querySelectorAll('button.planora-tooth');
    expect(teeth.length).toBe(32);
    expect(teeth[0].querySelector('.tooth-anatomy')).not.toBeNull();
    (Array.from(teeth).find((x) => x.getAttribute('aria-label')?.includes('36')) as HTMLButtonElement).click();
    expect(fixture.componentInstance.selectedNumber).toBe(36);
  });

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

    // Quick select upper jaw
    component.selectAllUpper();
    expect(component.selectedTeeth.length).toBe(16);
    expect(component.selectedTeeth).toContain(11);
    expect(component.selectedTeeth).toContain(28);

    // Clear selection resets to the single active tooth
    component.clearSelection();
    expect(component.selectedTeeth.length).toBe(1);
  });
});

