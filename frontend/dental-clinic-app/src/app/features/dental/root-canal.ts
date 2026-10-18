import { EndodonticRecord } from './dental-api.service';

// Persisted values 3/4/5 belong to the original five-stage workflow.
// Keep those values stable; legacy cleaning/shaping (3) resumes at step 2.
export const ROOT_CANAL_STAGES = [
  { value: 1, number: 1, en: 'Access cavity' },
  { value: 2, number: 2, en: 'Working length and final file size' },
  { value: 4, number: 3, en: 'Obturation' },
  { value: 5, number: 4, en: 'Composite filling' },
];

export type RestorationType = 'composite' | 'post-core' | 'post-core-crown' | 'crown';
export function rootCanalStages(mode: RestorationType = 'composite') {
  return [...ROOT_CANAL_STAGES.slice(0, 3), ...(mode === 'composite' ? [ROOT_CANAL_STAGES[3]] : mode === 'crown' ? [{ value: 8, number: 4, en: 'Crown' }] : [{ value: 7, number: 4, en: 'Post and core' }, ...(mode === 'post-core-crown' ? [{ value: 8, number: 5, en: 'Crown' }] : [])])];
}
export interface RootCanalDraft {
  restorationType?: RestorationType;
  postType?: 'fiber' | 'metal' | 'custom' | null;
  postCanal?: string | null;
  stage: number;
  notes: string;
  canals: { name: string; lengthMm: number | null; finalFileSize: string; notes?: string }[];
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
  const names = rootCanalNames(tooth);
  for (const canal of record?.canals ?? []) if (!names.some(name => name.toLowerCase() === canal.name.toLowerCase())) names.push(canal.name);
  return { restorationType: record?.restorationType ?? undefined, postType: record?.postType ?? null, postCanal: record?.postCanal ?? null, stage: record?.stage ?? 1, notes: record?.notes ?? '', canals: names.map(name => {
    const saved = record?.canals.find(canal => canal.name.toLowerCase() === name.toLowerCase());
    return { name, lengthMm: saved?.lengthMm ?? null, finalFileSize: saved?.finalFileSize ?? '', notes: saved?.notes };
  }) };
}
