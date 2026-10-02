export const paymentMethod = (value: number, ar = false) =>
  ({
    1: ar ? 'نقدي' : 'Cash',
    2: ar ? 'بطاقة' : 'Card',
    3: ar ? 'تحويل بنكي' : 'Bank transfer',
    4: ar ? 'أخرى' : 'Other',
  })[value] ?? '—';
export const financePeriods = (ar = false) => [
  { value: 1, label: ar ? 'اليوم' : 'Today' },
  { value: 2, label: ar ? 'هذا الأسبوع' : 'This week' },
  { value: 3, label: ar ? 'هذا الشهر' : 'This month' },
  { value: 4, label: ar ? 'هذه السنة' : 'This year' },
  { value: 5, label: ar ? 'مخصص' : 'Custom range' },
];
export function money(value: number, currency: string = 'EGP', language: string = 'ar') {
  const safeCurrency = currency && currency.trim().length >= 2 ? currency.trim().toUpperCase() : 'EGP';
  const num = Number(value) || 0;
  const formattedNumber = num.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (language === 'ar') {
    let symbol = 'ج.م';
    if (safeCurrency === 'EGP') symbol = 'ج.م';
    else if (safeCurrency === 'SAR') symbol = 'ر.س';
    else if (safeCurrency === 'AED') symbol = 'د.إ';
    else if (safeCurrency === 'KWD') symbol = 'د.ك';
    else if (safeCurrency === 'QAR') symbol = 'ر.ق';
    else if (safeCurrency === 'BHD') symbol = 'د.ب';
    else if (safeCurrency === 'OMR') symbol = 'ر.ع';
    else if (safeCurrency === 'JOD') symbol = 'د.أ';
    else if (safeCurrency === 'IQD') symbol = 'د.ع';
    else if (safeCurrency === 'USD') symbol = '$';
    else if (safeCurrency === 'EUR') symbol = '€';
    else if (safeCurrency === 'GBP') symbol = '£';
    else symbol = safeCurrency;

    return `${formattedNumber} ${symbol}`;
  } else {
    let symbol = safeCurrency;
    if (safeCurrency === 'USD') symbol = '$';
    else if (safeCurrency === 'EUR') symbol = '€';
    else if (safeCurrency === 'GBP') symbol = '£';
    return `${symbol} ${formattedNumber}`;
  }
}
export function paymentError(status: number, ar = false) {
  return status === 409
    ? ar
      ? 'تجاوزت الدفعة الرصيد المستحق أو تغير السجل.'
      : 'Payment exceeds the outstanding balance or the record changed.'
    : ar
      ? 'تعذر حفظ الدفعة.'
      : 'Payment could not be saved.';
}
export const dashboardValues = (x: {
  revenue: number;
  payments: number;
  outstanding: number;
  expenses: number;
  doctorCompensation: number;
  netProfit: number;
}) => [x.revenue, x.payments, x.outstanding, x.expenses, x.doctorCompensation, x.netProfit];
export function financeFilters(values: Record<string, string>, page: number) {
  return Object.fromEntries(
    Object.entries({ page: String(Math.max(1, page)), ...values }).filter(([, v]) => v !== ''),
  );
}
export const validPayment = (amount: number, outstanding: number, revenueId: string) =>
  Boolean(revenueId) && amount > 0 && amount <= outstanding;
export const validExpense = (amount: number, categoryId: string, description: string) =>
  amount > 0 && Boolean(categoryId) && Boolean(description.trim());
export const canViewPatientFinance = (permissions: string[]) =>
  permissions.includes('Finance.View');
export const validCategory = (name: string, code: string, type: number) =>
  Boolean(name.trim() && code.trim()) && (type === 1 || type === 2);

export interface CategoryPreset {
  nameAr: string;
  nameEn: string;
  code: string;
  type: number; // 1 = Revenue, 2 = Expense
  descriptionAr?: string;
  descriptionEn?: string;
}

export const FINANCIAL_CATEGORY_PRESETS: CategoryPreset[] = [
  // الحاجات العايزة فلوس (المصروفات والتكاليف)
  { nameAr: 'خامات ومستلزمات طبية', nameEn: 'Dental Materials & Supplies', code: 'MATERIALS', type: 2 },
  { nameAr: 'معامل وتركيبات أسنان', nameEn: 'Dental Lab & Prosthetics', code: 'LAB', type: 2 },
  { nameAr: 'إيجار العيادة', nameEn: 'Clinic Rent', code: 'RENT', type: 2 },
  { nameAr: 'رواتب الموظفين والتمريض', nameEn: 'Staff & Nursing Salaries', code: 'SALARIES', type: 2 },
  { nameAr: 'مستحقات وأتعاب الأطباء', nameEn: 'Doctor Compensation', code: 'DOCTOR_COMPENSATION', type: 2 },
  { nameAr: 'كهرباء ومرافق', nameEn: 'Electricity & Utilities', code: 'ELECTRICITY', type: 2 },
  { nameAr: 'مياه وغاز', nameEn: 'Water & Gas', code: 'WATER', type: 2 },
  { nameAr: 'إنترنت واتصالات', nameEn: 'Internet & Telecom', code: 'INTERNET', type: 2 },
  { nameAr: 'صيانة الأجهزة والمعدات', nameEn: 'Equipment Maintenance', code: 'MAINTENANCE', type: 2 },
  { nameAr: 'أدوات تعقيم ومكافحة عدوى', nameEn: 'Sterilization & Infection Control', code: 'STERILIZATION', type: 2 },
  { nameAr: 'تسويق ودعاية وإعلانات', nameEn: 'Marketing & Ads', code: 'MARKETING', type: 2 },
  { nameAr: 'مصاريف إدارية ونثرية', nameEn: 'Administrative & Petty Cash', code: 'ADMINISTRATIVE', type: 2 },
  { nameAr: 'تخلص من النفايات الطبية', nameEn: 'Medical Waste Disposal', code: 'WASTE_DISPOSAL', type: 2 },
  { nameAr: 'مصروفات تشغيلية أخرى', nameEn: 'Other Operating Expenses', code: 'OTHER_EXPENSE', type: 2 },
  // الإيرادات (الدخل)
  { nameAr: 'إيرادات العلاج والخدمات', nameEn: 'Treatment Revenue', code: 'TREATMENT_REVENUE', type: 1 },
  { nameAr: 'إيرادات الكشف والاستشارات', nameEn: 'Consultation Revenue', code: 'CONSULTATION_REVENUE', type: 1 },
  { nameAr: 'إيرادات أخرى', nameEn: 'Other Revenue', code: 'OTHER_REVENUE', type: 1 },
];

const CATEGORY_AR_MAP: Record<string, string> = {
  // Expense Codes & Names (الحاجات العايزة فلوس)
  RENT: 'إيجار العيادة',
  'CLINIC RENT': 'إيجار العيادة',
  ELECTRICITY: 'كهرباء ومرافق',
  'ELECTRICITY & UTILITIES': 'كهرباء ومرافق',
  GAS: 'غاز',
  WATER: 'مياه',
  'WATER & GAS': 'مياه وغاز',
  INTERNET: 'إنترنت واتصالات',
  'INTERNET & TELECOM': 'إنترنت واتصالات',
  MATERIALS: 'خامات ومستلزمات طبية',
  'DENTAL MATERIALS & SUPPLIES': 'خامات ومستلزمات طبية',
  MAINTENANCE: 'صيانة الأجهزة والمعدات',
  'EQUIPMENT MAINTENANCE': 'صيانة الأجهزة والمعدات',
  MARKETING: 'تسويق ودعاية وإعلانات',
  'MARKETING & ADS': 'تسويق ودعاية وإعلانات',
  ADMINISTRATIVE: 'مصاريف إدارية ونثرية',
  'ADMINISTRATIVE & PETTY CASH': 'مصاريف إدارية ونثرية',
  SALARIES: 'رواتب الموظفين والتمريض',
  'STAFF & NURSING SALARIES': 'رواتب الموظفين والتمريض',
  DOCTOR_COMPENSATION: 'مستحقات وأتعاب الأطباء',
  'DOCTOR COMPENSATION': 'مستحقات وأتعاب الأطباء',
  LAB: 'معامل وتركيبات أسنان',
  LABORATORY: 'معامل وتركيبات أسنان',
  'DENTAL LAB': 'معامل وتركيبات أسنان',
  'DENTAL LAB & PROSTHETICS': 'معامل وتركيبات أسنان',
  STERILIZATION: 'أدوات تعقيم ومكافحة عدوى',
  'STERILIZATION & INFECTION CONTROL': 'أدوات تعقيم ومكافحة عدوى',
  EQUIPMENT: 'أجهزة ومعدات',
  WASTE_DISPOSAL: 'تخلص من النفايات الطبية',
  'MEDICAL WASTE DISPOSAL': 'تخلص من النفايات الطبية',
  OTHER: 'مصروفات أخرى',
  OTHER_EXPENSE: 'مصروفات أخرى',
  'OTHER EXPENSE': 'مصروفات أخرى',
  'OTHER OPERATING EXPENSES': 'مصروفات تشغيلية أخرى',

  // Revenue Codes & Names
  TREATMENT_REVENUE: 'إيرادات العلاج والخدمات',
  'TREATMENT REVENUE': 'إيرادات العلاج والخدمات',
  CONSULTATION_REVENUE: 'إيرادات الكشف والاستشارات',
  'CONSULTATION REVENUE': 'إيرادات الكشف والاستشارات',
  OTHER_REVENUE: 'إيرادات أخرى',
  'OTHER REVENUE': 'إيرادات أخرى',
  GENERAL_REVENUE: 'إيرادات عامة',
};

export function categoryTitle(nameOrCode: string | null | undefined, language: string = 'ar'): string {
  if (!nameOrCode) return '—';
  if (language !== 'ar') return nameOrCode;
  const key = nameOrCode.trim().toUpperCase();
  return CATEGORY_AR_MAP[key] || CATEGORY_AR_MAP[nameOrCode.trim()] || nameOrCode;
}

export function localizeCategory(category: { name: string; code?: string } | null | undefined, language: string = 'ar'): string {
  if (!category) return '—';
  if (language !== 'ar') return category.name;
  if (category.code && CATEGORY_AR_MAP[category.code.trim().toUpperCase()]) {
    return CATEGORY_AR_MAP[category.code.trim().toUpperCase()];
  }
  return categoryTitle(category.name, language);
}

