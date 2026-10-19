import { TestBed } from '@angular/core/testing';
import { ExtractionEditorComponent, ExtractionDraft } from './extraction-editor.component';
describe('Extraction editor', () => {
  it('shows tooth direction only for impacted teeth and clears it on condition change', () => {
    const fixture = TestBed.createComponent(ExtractionEditorComponent);
    const draft: ExtractionDraft = { type: 'Simple Extraction', condition: 'Normal', direction: null };
    fixture.componentRef.setInput('draft', draft); fixture.componentRef.setInput('tooth', 38); fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.direction-group')).toBeNull();
    (el.querySelector('input[value="Impacted"]') as HTMLInputElement).click(); fixture.detectChanges();
    expect(el.querySelector('.direction-group')?.textContent).toContain('اتجاه الضرس');
    (el.querySelector('input[value="Horizontal"]') as HTMLInputElement).click(); expect(draft.direction).toBe('Horizontal');
    (el.querySelector('input[value="Root Remnant"]') as HTMLInputElement).click(); fixture.detectChanges();
    expect(draft.direction).toBeNull(); expect(el.querySelector('.direction-group')).toBeNull();
    (el.querySelector('input[value="Surgical Extraction"]') as HTMLInputElement).click();
    expect(draft.type).toBe('Surgical Extraction'); expect(draft.condition).toBe('Root Remnant');
  });
});
