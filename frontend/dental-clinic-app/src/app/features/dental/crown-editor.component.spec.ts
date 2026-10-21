import { CrownEditorComponent } from './crown-editor.component';
import { rootCanalDraft, workflowFor } from './root-canal';
describe('Crown workflow',()=>{
 function create(){const c=new CrownEditorComponent();c.draft=workflowFor(rootCanalDraft(26)).crown;return c;}
 it('requires real details and confirmation before advancing',()=>{const c=create();c.advance();expect(c.draft.step).toBe(1);expect(c.error).toBe(true);Object.assign(c.draft,{type:'Full crown',material:'Zirconia',shade:'A2',laboratory:'Test laboratory'});c.advance();expect(c.draft.step).toBe(1);c.draft.completed[0]=true;c.advance();expect(c.draft.step).toBe(2);expect(c.draft.dates[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);});
 it('allows skipping the optional temporary crown and completes only after cementation',()=>{const c=create();Object.assign(c.draft,{type:'Full crown',material:'Zirconia',shade:'A2',laboratory:'Test laboratory'});let finished=0;c.finished.subscribe(()=>finished++);for(let i=0;i<5;i++){if(i!==2)c.draft.completed[i]=true;c.advance();if(i<4)expect(finished).toBe(0);}expect(finished).toBe(1);expect(c.draft.temporary).toBe(false);});
 it('does not finish if a required prior step is incomplete',()=>{const c=create();Object.assign(c.draft,{type:'Full crown',material:'Zirconia',shade:'A2',laboratory:'Test laboratory',step:5,completed:[true,false,true,true,true]});let finished=0;c.finished.subscribe(()=>finished++);c.advance();expect(finished).toBe(0);expect(c.error).toBe(true);});
});
