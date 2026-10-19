import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RootCanalEditorComponent } from './root-canal-editor.component';
import { rootCanalDraft } from './root-canal';

describe('Sequential root canal editor', () => {
  function create(stage = 1, mode?: 'post-core' | 'post-core-crown') {
    const fixture = TestBed.createComponent(RootCanalEditorComponent);
    const c = fixture.componentInstance;
    c.draft = rootCanalDraft(26); c.draft.stage = stage; c.draft.restorationType = mode;
    c.english = false; fixture.detectChanges();
    return { fixture, c, el: fixture.nativeElement as HTMLElement };
  }
  it('shows a compact read-only note with the current canal lengths and file sizes in obturation only', () => {
    const fixture=TestBed.createComponent(RootCanalEditorComponent);
    const draft={stage:4,notes:'Clinical session note',canals:[{name:'P',lengthMm:23,finalFileSize:'30'},{name:'MB',lengthMm:21.5,finalFileSize:'25/.06'}]};
    fixture.componentRef.setInput('draft',draft);fixture.detectChanges();
    const note=fixture.nativeElement.querySelector('.obturation-note') as HTMLElement;
    expect(note.getAttribute('dir')).toBe('ltr');
    expect(note.textContent).toContain('Canal P: length 23mm · MAF 30');
    expect(note.textContent).toContain('Canal MB: length 21.5mm · MAF 25/.06');
    expect(note.querySelector('input,textarea,select,button')).toBeNull();
    expect(draft.notes).toBe('Clinical session note');
    fixture.componentRef.setInput('draft',{...draft,stage:2});fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.obturation-note')).toBeNull();
  });

  it('shows the current workflow left to right with the existing English stage names', () => {
    const fixture=TestBed.createComponent(RootCanalEditorComponent);
    fixture.componentRef.setInput('draft',{stage:2,restorationType:'crown',notes:'',canals:[{name:'Canal 1',lengthMm:20,finalFileSize:'25'}]});
    fixture.detectChanges();
    const timeline=fixture.nativeElement.querySelector('.root-stage-timeline') as HTMLOListElement;
    expect(timeline.getAttribute('dir')).toBe('ltr');
    expect(Array.from(timeline.querySelectorAll('.timeline-label')).map(x=>x.textContent?.trim())).toEqual(['Access cavity','Working length and final file size','Obturation','Crown']);
    expect(timeline.querySelectorAll('.done').length).toBe(1);expect(timeline.querySelector('[aria-current="step"]')?.textContent).toContain('Working length');
    expect(timeline.querySelectorAll('button').length).toBe(0);
  });
  it('shows all five post-and-crown steps as complete after the saved workflow finishes', () => {
    const fixture=TestBed.createComponent(RootCanalEditorComponent);
    fixture.componentRef.setInput('draft',{stage:6,restorationType:'post-core-crown',notes:'',canals:[]});fixture.detectChanges();
    const timeline=fixture.nativeElement.querySelector('.root-stage-timeline');
    expect(timeline.querySelectorAll('li').length).toBe(5);expect(timeline.querySelectorAll('.done').length).toBe(5);
    expect(timeline.textContent).toContain('Post and core');expect(timeline.textContent).toContain('Crown');
    expect(timeline.querySelector('[aria-current]')).toBeNull();
  });

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
  it('uses post and core with a required post type and adds crown only for the crown workflow', () => {
    const {fixture,c,el}=create(7, 'post-core-crown');
    expect(el.textContent).toContain('4- Post and core');
    expect(el.textContent).toContain('Canal'); expect(el.querySelectorAll('select')[1].textContent).toContain('MB2'); expect(el.textContent).toContain('Fiber post'); expect(el.textContent).toContain('Metal post'); expect(el.textContent).toContain('Custom post');
    c.completeStage(); expect(c.draft.stage).toBe(7); expect(c.postError).toBe(true);
    c.draft.postType='fiber'; c.completeStage(); expect(c.draft.stage).toBe(7); c.draft.postCanal='MB'; c.completeStage(); expect(c.draft.stage).toBe(8);
    expect(c.currentStage.en).toBe('Crown'); expect(c.currentStage.number).toBe(5);
    c.completeStage(); expect(c.draft.stage).toBe(6);
    c.draft.restorationType='post-core'; c.draft.stage=7; c.completeStage(); expect(c.draft.stage).toBe(6);
  });
  it('debounces measurement edits into one automatic save even before a treatment exists', () => {
    vi.useFakeTimers();
    try {
      const {c}=create(2); let changes=0; c.changed.subscribe(()=>changes++);
      c.draft.canals[0].lengthMm=2; c.scheduleSave(); vi.advanceTimersByTime(300);
      c.draft.canals[0].lengthMm=21; c.scheduleSave(); vi.advanceTimersByTime(599); expect(changes).toBe(0);
      vi.advanceTimersByTime(1); expect(changes).toBe(1); expect(c.canSave).toBe(false);
    } finally { vi.useRealTimers(); }
  });
  it('restores completed progress without restarting access cavity', () => {
    const {el}=create(6); expect(el.textContent).toContain('Root canal stages completed');
    expect(el.querySelector('.stage-check')).toBeNull();
  });
});
