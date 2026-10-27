import { describe, expect, it } from 'vitest';
import { emptyImplantWorkflow, followupDate, implantValidation, visibleImplantFields } from './implant-fields';
describe('Implant workflow clinical decisions',()=>{
  it('starts without invented clinical findings or sample patient data',()=>{
    const workflow=emptyImplantWorkflow(); expect(workflow.planning).toEqual({}); expect(workflow.healingVisits).toEqual([]);
    expect(implantValidation(0,workflow.planning)).toBe('التصوير الشعاعي');
  });
  it('allows an optional guide and requires the planning decisions',()=>{
    expect(implantValidation(0,{imaging:'cbct',timing:'delayed',graft:'no'})).toBeNull();
  });
  it('requires graft details only when grafting is selected',()=>{
    expect(visibleImplantFields(1,{}).some(f=>f.key==='graftMaterial')).toBe(false);
    expect(visibleImplantFields(1,{graftEnabled:true}).some(f=>f.key==='graftMaterial' && f.required)).toBe(true);
    expect(visibleImplantFields(5,{retention:'screw'}).some(f=>f.key==='cement')).toBe(false);
    expect(visibleImplantFields(5,{retention:'cement'}).some(f=>f.key==='cement' && f.required)).toBe(true);
  });
  it('uses calendar months and clamps to the end of a shorter month',()=>{
    expect(followupDate('2027-01-31','1m')).toBe('2027-02-28');
    expect(followupDate('2028-01-31','1m')).toBe('2028-02-29');
    expect(followupDate('2026-12-21','2w')).toBe('2027-01-04');
    expect(followupDate('2026-10-21','3m')).toBe('2027-01-21');
  });
});
