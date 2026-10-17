import { EndodonticRecord } from './dental-api.service';

export const ROOT_CANAL_STAGES = [
  { value: 1, en: 'Access opening', ar: 'فتح الحجرة' },
  { value: 2, en: 'Working length', ar: 'تحديد أطوال القنوات' },
  { value: 3, en: 'Cleaning & shaping', ar: 'تنظيف وتشكيل القنوات' },
  { value: 4, en: 'Obturation', ar: 'حشو القنوات' },
  { value: 5, en: 'Final restoration', ar: 'الترميم النهائي' },
];

export interface RootCanalDraft {
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
  return { stage: record?.stage ?? 1, notes: record?.notes ?? '', canals: names.map(name => {
    const saved = record?.canals.find(canal => canal.name.toLowerCase() === name.toLowerCase());
    return { name, lengthMm: saved?.lengthMm ?? null, finalFileSize: saved?.finalFileSize ?? '', notes: saved?.notes };
  }) };
}
