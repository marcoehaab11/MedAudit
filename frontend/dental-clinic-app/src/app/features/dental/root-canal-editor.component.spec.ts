import { TestBed } from '@angular/core/testing';
import { RootCanalEditorComponent } from './root-canal-editor.component';
import { rootCanalDraft } from './root-canal';

describe('Sequential root canal editor', () => {
  function create(stage = 1) {
    const fixture = TestBed.createComponent(RootCanalEditorComponent);
    const c = fixture.componentInstance;
    c.draft = rootCanalDraft(26); c.draft.stage = stage;
    c.english = false; fixture.detectChanges();
    return { fixture, c, el: fixture.nativeElement as HTMLElement };
  }
  it('shows four English steps one at a time and only displays measurements in step two', () => {
    const {fixture,c,el} = create();
    expect(el.textContent).toContain('1- Access cavity');
    expect(el.querySelector('.canal-grid')).toBeNull();
    (el.querySelector('.stage-check input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(el.textContent).toContain('2- Working length and final file size');
    expect(el.querySelectorAll('.canal-card')).toHaveLength(4);
    (el.querySelector('.complete-stage') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(c.draft.stage).toBe(2); expect(el.querySelector('[role=alert]')).not.toBeNull();
    for (const canal of c.draft.canals) { canal.lengthMm = 21; canal.finalFileSize = '25/.06'; }
    (el.querySelector('.complete-stage') as HTMLButtonElement).click(); fixture.detectChanges();
    expect(el.textContent).toContain('3- Obturation'); expect(el.querySelector('.canal-grid')).toBeNull();
    (el.querySelector('.stage-check input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(el.textContent).toContain('4- Composite filling');
    expect((el.querySelector('.stage-check input') as HTMLInputElement).checked).toBe(false);
    (el.querySelector('.stage-check input') as HTMLInputElement).click(); fixture.detectChanges();
    expect(c.draft.stage).toBe(6); expect(el.textContent).toContain('Root canal stages completed');
    expect(el.querySelector('.canal-grid')).toBeNull();
    for (let i=0; i<3; i++) { (el.querySelector('.previous-stage') as HTMLButtonElement).click(); fixture.detectChanges(); }
    expect(el.textContent).toContain('2- Working length and final file size');
    expect(c.draft.canals.every(x=>x.lengthMm===21&&x.finalFileSize==='25/.06')).toBe(true);
  });
  it('resumes legacy cleaning/shaping at step two without changing its stored value until confirmed', () => {
    const {c,el} = create(3);
    expect(el.textContent).toContain('2- Working length and final file size');
    expect(c.draft.stage).toBe(3);
    expect(c.stageName(4)).toBe('3- Obturation');
    expect(c.stageName(5)).toBe('4- Composite filling');
  });
  it('saves progression for an existing treatment and respects disabled state', () => {
    const {c} = create(); c.canSave = true; let saves=0; c.save.subscribe(()=>saves++);
    c.disabled = true; c.completeStage(); expect(c.draft.stage).toBe(1); expect(saves).toBe(0);
    c.disabled = false; c.completeStage(); expect(c.draft.stage).toBe(2); expect(saves).toBe(1);
    c.draft.stage=5; c.completeStage(); expect(c.draft.stage).toBe(6); expect(saves).toBe(2);
  });
  it('restores completed progress without restarting access cavity', () => {
    const {el}=create(6); expect(el.textContent).toContain('Root canal stages completed');
    expect(el.querySelector('.stage-check')).toBeNull();
  });
});
