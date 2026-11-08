import { EndodonticRecord } from './dental-api.service';

// Persisted values 3/4/5 belong to the original five-stage workflow.
// Keep those values stable; legacy cleaning/shaping (3) resumes at step 2.
export const ROOT_CANAL_STAGES = [
  { value: 1, number: 1, en: 'Access cavity' },
  { value: 2, number: 2, en: 'Working length and final file size' },
  { value: 4, number: 3, en: 'Obturation' },
  { value: 5, number: 4, en: 'Core build-up' },
  { value: 9, number: 5, en: 'Next procedures — Post / Crown' },
];

export type RestorationType = 'composite' | 'post-core' | 'post-core-crown' | 'crown' | 'crown-only';
export function rootCanalStages(mode: RestorationType = 'composite') {
  if (mode === 'crown-only') return [{value:8,number:1,en:'Crown'}];
  return [...ROOT_CANAL_STAGES, ...(['post-core','post-core-crown'].includes(mode) ? [{value:7,number:6,en:'Post'}] : []), ...(['crown','post-core-crown'].includes(mode) ? [{value:8,number:7,en:'Crown'}] : [])].map((step,index)=>({...step,number:index+1}));
}
export interface CrownDraft { type:string; material:string; shade:string; laboratory:string; step:number; completed:boolean[]; dates:string[]; notes:string[]; temporary:boolean; }
export interface RootStepProgress {completed:boolean;completedAt?:string;recordedAt?:string;visitDate?:string;appointmentId?:string;doctorUserId?:string;legacyImported?:boolean;details?:unknown;}
export interface ClinicalWorkflow { version:1; flowVersion?:2;revision?:string;progress?:Record<string,RootStepProgress>;billingCatalogIds?:Record<string,string>;decisionsMade?:boolean;postDone?:boolean;temporaryRequested?:boolean;finalMaterial:string|null; needsPost:boolean; postSize:string; needsCrown:boolean; obturationDone:boolean; crown:CrownDraft; unselectedCanals?:RootCanalDraft['canals']; }
export function workflowFor(draft:RootCanalDraft):ClinicalWorkflow {
  const flow=draft.workflow ??= {version:1,flowVersion:2,progress:{},billingCatalogIds:{},decisionsMade:false,postDone:false,finalMaterial:draft.stage===6?'composite':null,needsPost:['post-core','post-core-crown'].includes(draft.restorationType??''),postSize:'',needsCrown:['crown','post-core-crown','crown-only'].includes(draft.restorationType??''),obturationDone:[5,6,7,8,9].includes(draft.stage),crown:{type:'',material:'',shade:'',laboratory:'',step:1,completed:Array(5).fill(draft.stage===6),dates:Array(5).fill(''),notes:Array(5).fill(''),temporary:false}};
  flow.progress??={};flow.billingCatalogIds??={};return flow;
}
export function serializeWorkflow(draft:RootCanalDraft) { return JSON.stringify({...workflowFor(draft),unselectedCanals:draft.canals.filter(c=>c.enabled===false)}); }
export interface RootCanalDraft {
  workflow?:ClinicalWorkflow;
  restorationType?: RestorationType;
  postType?: 'fiber' | 'metal' | 'custom' | null;
  postCanal?: string | null;
  stage: number;
  notes: string;
  canals: { name: string; lengthMm: number | null; finalFileSize: string; notes?: string; enabled?:boolean }[];
}

// Clinic-provided templates. Existing extra canals are preserved when resuming.
export function rootCanalNames(tooth: number): string[] {
  const quadrant = Math.floor(tooth / 10), position = tooth % 10;
  if (quadrant < 1 || quadrant > 4 || position < 1 || position > 8) return [];
  if (position <= 3) return ['Canal 1'];
  const upper = quadrant <= 2;
  if (position <= 5) return upper ? ['B', 'P'] : ['B', 'L'];
  return upper ? position === 8 ? ['MB', 'DB', 'P'] : ['MB', 'MB2', 'DB', 'P'] : ['MB', 'ML', 'DB', 'DL'];
}

export function rootCanalDraft(tooth: number, record?: EndodonticRecord): RootCanalDraft {
  let workflow:ClinicalWorkflow|undefined;
  try { const parsed=record?.workflowJson ? JSON.parse(record.workflowJson) : undefined; if(parsed?.version===1)workflow=parsed; } catch {}
  const names = workflow ? [...(record?.canals.map(c=>c.name) ?? []),...(workflow.unselectedCanals?.map(c=>c.name) ?? [])] : rootCanalNames(tooth);
  for (const canal of record?.canals ?? []) if (!names.some(name => name.toLowerCase() === canal.name.toLowerCase())) names.push(canal.name);
  return { workflow,restorationType:record?.restorationType ?? undefined,postType:record?.postType ?? null,postCanal:record?.postCanal ?? null,stage:record?.stage===7 ? 4 : record?.stage ?? 1,notes:record?.notes ?? '',canals:names.map(name=>{
    const saved=record?.canals.find(c=>c.name.toLowerCase()===name.toLowerCase());
    const hidden=workflow?.unselectedCanals?.find(c=>c.name===name);
    return {name,lengthMm:saved?.lengthMm ?? hidden?.lengthMm ?? null,finalFileSize:saved?.finalFileSize ?? hidden?.finalFileSize ?? '',notes:saved?.notes ?? hidden?.notes,enabled:!hidden};
  }) };
}
