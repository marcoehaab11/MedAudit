import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RootCanalEditorComponent } from './root-canal-editor.component';
import { rootCanalDraft, serializeWorkflow, workflowFor } from './root-canal';
describe('Sequential clinical restoration editor',()=>{
 function create(stage=1){const fixture=TestBed.createComponent(RootCanalEditorComponent),c=fixture.componentInstance;c.draft=rootCanalDraft(26);c.draft.stage=stage;fixture.componentRef.setInput('draft',{...c.draft});fixture.detectChanges();return {fixture,c,el:fixture.nativeElement as HTMLElement};}
 it('keeps restoration choices independent when two teeth are open together',async()=>{
  const first=create(5),second=create(5);
  await first.fixture.whenStable();await second.fixture.whenStable();
  const temporary=Array.from(first.el.querySelectorAll('.restoration-options label')).find(label=>label.textContent?.includes('Temporary'))!.querySelector('input')!;
  const permanent=Array.from(second.el.querySelectorAll('.restoration-options label')).find(label=>label.textContent?.includes('Composite'))!.querySelector('input')!;
  temporary.click();temporary.dispatchEvent(new Event('change',{bubbles:true}));await first.fixture.whenStable();
  permanent.click();permanent.dispatchEvent(new Event('change',{bubbles:true}));await second.fixture.whenStable();
  expect(temporary.checked).toBe(true);expect(permanent.checked).toBe(true);
  expect(first.c.workflow.finalMaterial).toBe('temporary');expect(second.c.workflow.finalMaterial).toBe('composite');
 });
 it('selects template canals in access cavity, adds unique extra canals, and limits measurements to selected canals',()=>{
  const {c,fixture,el}=create();expect(el.querySelectorAll('.canal-option')).toHaveLength(4);c.toggleCanal(c.draft.canals[1]);c.newCanal='Extra';c.addCanal();c.newCanal='extra';c.addCanal();expect(c.draft.canals.filter(x=>x.name.toLowerCase()==='extra')).toHaveLength(1);
  c.completeStage();fixture.componentRef.setInput('draft',{...c.draft});fixture.detectChanges();expect(c.draft.stage).toBe(2);expect(el.querySelectorAll('.canal-card')).toHaveLength(4);expect(el.querySelector('.add-canal')).toBeNull();
  c.completeStage();expect(c.measurementError).toBe(true);for(const canal of c.selectedCanals){canal.lengthMm=21;canal.finalFileSize='30';}c.completeStage();expect(c.draft.stage).toBe(4);
 });
 it('keeps obturation separate from the later post procedure',()=>{
  const {c,fixture,el}=create(4);for(const canal of c.selectedCanals){canal.lengthMm=23;canal.finalFileSize='30';}fixture.componentRef.setInput('draft',{...c.draft});fixture.detectChanges();expect(el.querySelectorAll('.obturation-card input[readonly]')).toHaveLength(8);
  c.workflow.obturationDone=true;c.setPost(true);c.completeStage();expect(c.draft.stage).toBe(5);c.draft.stage=7;c.completeStage();expect(c.postError).toBe(true);c.draft.postCanal='MB';c.draft.postType='fiber';c.workflow.postSize='2';c.workflow.postDone=true;c.completeStage();expect(c.draft.stage).toBe(6);
 });
 it('keeps temporary restorations pending and completes only a permanent restoration without a crown',()=>{
  const {c}=create(5);c.workflow.finalMaterial='temporary';c.completeStage();expect(c.draft.stage).toBe(5);c.workflow.finalMaterial='glass-ionomer';c.completeStage();expect(c.draft.stage).toBe(9);expect(c.workflow.progress?.['core'].completed).toBe(true);c.completeStage();expect(c.draft.stage).toBe(6);
 });
 it('adds crown after final restoration and waits for all required crown steps',()=>{
  const {c}=create(5);c.setCrown(true);c.workflow.finalMaterial='composite';expect(c.stages.map(s=>s.en)).toEqual(['Access cavity','Working length and final file size','Obturation','Core build-up','Next procedures — Post / Crown','Crown']);c.completeStage();expect(c.draft.stage).toBe(9);c.completeStage();expect(c.draft.stage).toBe(8);c.finishCrown();expect(c.draft.stage).toBe(8);c.workflow.crown.completed=[true,true,false,true,true];c.finishCrown();expect(c.draft.stage).toBe(6);
 });
 it('resumes unselected canals, extra canals, temporary restoration and crown progress without losing measurements',()=>{
  const {c}=create(5);c.toggleCanal(c.draft.canals[1]);c.workflow.finalMaterial='temporary';c.workflow.crown.step=3;c.draft.canals[0].lengthMm=22;
  const restored=rootCanalDraft(26,{id:'r',toothId:'t',toothNumber:26,createdAt:'',createdBy:'u',stage:5,workflowJson:serializeWorkflow(c.draft),canals:c.selectedCanals.map((x,i)=>({...x,id:''+i}))});
  expect(restored.canals.find(x=>x.name==='MB2')?.enabled).toBe(false);expect(restored.canals.find(x=>x.name==='MB')?.lengthMm).toBe(22);expect(workflowFor(restored).finalMaterial).toBe('temporary');expect(workflowFor(restored).crown.step).toBe(3);
 });
 it('opens a standalone crown without root-canal numbering or canal fields',()=>{
  const {c,fixture,el}=create(8);c.draft.restorationType='crown-only';c.draft.canals=[];fixture.componentRef.setInput('draft',{...c.draft});fixture.detectChanges();expect(el.querySelector('.root-stage-timeline')).toBeNull();expect(el.querySelector('.current-stage')).toBeNull();expect(el.querySelector('app-crown-editor')).not.toBeNull();
 });
 it('retains legacy cleaning and completed visits and respects disabled progression',()=>{
  const {c,fixture,el}=create(3);expect(c.currentStage.value).toBe(2);expect(c.draft.stage).toBe(3);c.draft.stage=6;fixture.componentRef.setInput('draft',{...c.draft});fixture.detectChanges();expect(el.textContent).toContain('Treatment stages completed');c.previousStage();expect(c.draft.stage).toBe(9);c.disabled=true;c.workflow.finalMaterial='composite';c.completeStage();expect(c.draft.stage).toBe(9);
 });
 it('debounces measurement edits into a single autosave',()=>{vi.useFakeTimers();try{const {c}=create(2);let changes=0;c.changed.subscribe(()=>changes++);c.scheduleSave();vi.advanceTimersByTime(300);c.scheduleSave();vi.advanceTimersByTime(600);expect(changes).toBe(1);}finally{vi.useRealTimers();}});
});
