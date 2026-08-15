export interface ClinicalAppearance {
  en: string;
  ar: string;
  cssClass: string;
  symbol: string;
}
export const FINDING_APPEARANCE: Record<number, ClinicalAppearance> = {
  1: { en: 'Healthy', ar: 'سليم', cssClass: 'healthy', symbol: '✓' },
  2: { en: 'Caries', ar: 'تسوس', cssClass: 'caries', symbol: 'C' },
  3: { en: 'Fracture', ar: 'كسر', cssClass: 'fracture', symbol: '!' },
  4: { en: 'Missing', ar: 'مفقود', cssClass: 'missing', symbol: '×' },
  5: { en: 'Sensitivity', ar: 'حساسية', cssClass: 'sensitivity', symbol: 'S' },
  6: { en: 'Infection', ar: 'عدوى', cssClass: 'infection', symbol: 'I' },
  7: { en: 'Other', ar: 'أخرى', cssClass: 'other', symbol: '•' },
};
export const PROCEDURE_APPEARANCE: Record<number, ClinicalAppearance> = {
  1: { en: 'Filling', ar: 'حشو', cssClass: 'filling', symbol: 'F' },
  2: { en: 'Extraction', ar: 'خلع', cssClass: 'extraction', symbol: 'E' },
  3: { en: 'Implant', ar: 'زراعة', cssClass: 'implant', symbol: 'I' },
  4: { en: 'Root canal', ar: 'علاج جذور', cssClass: 'root-canal', symbol: 'R' },
  5: { en: 'Crown', ar: 'تاج', cssClass: 'crown', symbol: 'Cr' },
  6: { en: 'Other', ar: 'أخرى', cssClass: 'other', symbol: '•' },
};
export const SURFACES = [
  [1, 'Whole tooth', 'السن بالكامل'],
  [2, 'Mesial', 'أنسي'],
  [3, 'Distal', 'بعيد'],
  [4, 'Occlusal', 'إطباقي'],
  [5, 'Buccal', 'شدقي'],
  [6, 'Lingual', 'لساني'],
  [7, 'Palatal', 'حنكي'],
  [8, 'Incisal', 'قاطعي'],
  [9, 'Cervical', 'عنقي'],
  [10, 'Root', 'جذر'],
] as const;
