export interface ClinicalAppearance {
  en: string;
  ar: string;
  cssClass: string;
  symbol: string;
}
export const QUICK_TOOTH_FINDING_TYPES = [2, 8, 14, 15, 9];
export const SELECTABLE_FINDING_TYPES = [2, 4, 8, 10, 11, 9, 14, 15, 17];

export const FINDING_APPEARANCE: Record<number, ClinicalAppearance> = {
  1: { en: 'Healthy', ar: 'سليم', cssClass: 'healthy', symbol: '✓' },
  2: { en: 'Regular filling', ar: 'حشو عادي', cssClass: 'caries', symbol: 'C' },
  3: { en: 'Fracture', ar: 'كسر', cssClass: 'fracture', symbol: '!' },
  4: { en: 'Missing', ar: 'مفقود', cssClass: 'missing', symbol: '×' },
  5: { en: 'Sensitivity', ar: 'حساسية', cssClass: 'sensitivity', symbol: 'S' },
  6: { en: 'Infection', ar: 'عدوى', cssClass: 'infection', symbol: 'I' },
  8: { en: 'Root canal treatment', ar: 'حشو عصب', cssClass: 'root-canal', symbol: 'R' },
  9: { en: 'Crown', ar: 'كراون', cssClass: 'crown', symbol: 'Cr' },
  10: { en: 'Root canal + crown', ar: 'علاج جذور وكراون', cssClass: 'root-canal-crown', symbol: 'R+Cr' },
  11: { en: 'Root canal + post + crown', ar: 'علاج جذور + دعامة + كراون', cssClass: 'root-canal-crown', symbol: 'R+P+Cr' },
  12: { en: 'Scaling & polishing (whole mouth)', ar: 'تنظيف جير وتلميع الأسنان — الفم بالكامل', cssClass: 'healthy', symbol: 'SP' },
  13: { en: 'Whitening (whole mouth)', ar: 'تبييض الأسنان — الفم بالكامل', cssClass: 'healthy', symbol: 'W' },
  17: { en: 'Root canal + post and core', ar: 'علاج جذور + دعامة + حشو داخلي', cssClass: 'root-canal-crown', symbol: 'R+P' },
  16: { en: 'Orthodontics (whole mouth)', ar: 'تقويم — الفم بالكامل', cssClass: 'healthy', symbol: 'Or' },
  18: { en: 'Removable dentures', ar: 'الأطقم المتحركة', cssClass: 'healthy', symbol: 'D' },
  14: { en: 'Extraction', ar: 'خلع', cssClass: 'extraction', symbol: 'E' },
  15: { en: 'Implant', ar: 'زراعة', cssClass: 'implant', symbol: 'I' },
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

