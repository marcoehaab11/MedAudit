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
export function money(value: number, currency: string, language: string) {
  return new Intl.NumberFormat(language === 'ar' ? 'ar' : 'en', {
    style: 'currency',
    currency,
  }).format(value);
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
