import { describe, it, expect } from 'vitest';
import {
  canViewPatientFinance,
  categoryTitle,
  dashboardValues,
  FINANCIAL_CATEGORY_PRESETS,
  financeFilters,
  financePeriods,
  localizeCategory,
  money,
  paymentError,
  paymentMethod,
  validCategory,
  validExpense,
  validPayment,
} from './finance-ui';
describe('finance UI', () => {
  it('maps dashboard aggregates', () =>
    expect(
      dashboardValues({
        revenue: 10,
        payments: 8,
        outstanding: 2,
        expenses: 3,
        doctorCompensation: 1,
        netProfit: 6,
      }),
    ).toEqual([10, 8, 2, 3, 1, 6]));
  it('localizes date ranges and payment methods', () => {
    expect(financePeriods(true)[0].label).toBe('اليوم');
    expect(paymentMethod(3, false)).toBe('Bank transfer');
  });
  it('sends active server filters and safe pagination', () =>
    expect(financeFilters({ from: '2026-08-01', to: '', search: 'care' }, 0)).toEqual({
      page: '1',
      from: '2026-08-01',
      search: 'care',
    }));
  it('validates payment against outstanding', () => {
    expect(validPayment(50, 100, 'r')).toBe(true);
    expect(validPayment(101, 100, 'r')).toBe(false);
  });
  it('validates expense and category drafts', () => {
    expect(validExpense(10, 'c', 'Rent')).toBe(true);
    expect(validExpense(0, 'c', 'Rent')).toBe(false);
    expect(validCategory('Rent', 'RENT', 2)).toBe(true);
  });
  it('hides patient finance without permission', () => {
    expect(canViewPatientFinance([])).toBe(false);
    expect(canViewPatientFinance(['Finance.View'])).toBe(true);
  });
  it('formats tenant currency without assuming EGP', () =>
    expect(money(12.5, 'USD', 'en')).toContain('$'));
  it('maps HTTP 409 in Arabic and English', () => {
    expect(paymentError(409, false)).toContain('outstanding');
    expect(paymentError(409, true)).toContain('الرصيد');
  });
  it('localizes financial categories and expense types in Arabic', () => {
    expect(categoryTitle('RENT', 'ar')).toBe('إيجار العيادة');
    expect(categoryTitle('MATERIALS', 'ar')).toBe('خامات ومستلزمات طبية');
    expect(categoryTitle('LAB', 'ar')).toBe('معامل وتركيبات أسنان');
    expect(categoryTitle('SALARIES', 'ar')).toBe('رواتب الموظفين والتمريض');
    expect(categoryTitle('DOCTOR_COMPENSATION', 'ar')).toBe('مستحقات وأتعاب الأطباء');
    expect(categoryTitle('ELECTRICITY', 'ar')).toBe('كهرباء ومرافق');
    expect(categoryTitle('OTHER_EXPENSE', 'ar')).toBe('مصروفات أخرى');
    expect(categoryTitle('TREATMENT_REVENUE', 'ar')).toBe('إيرادات العلاج والخدمات');
    expect(categoryTitle('Rent', 'en')).toBe('Rent');
    expect(localizeCategory({ name: 'Rent', code: 'RENT' }, 'ar')).toBe('إيجار العيادة');
    expect(localizeCategory({ name: 'Clinic Rent', code: 'RENT' }, 'en')).toBe('Clinic Rent');
  });
  it('provides clinic category presets for expenses and revenues', () => {
    expect(FINANCIAL_CATEGORY_PRESETS.length).toBeGreaterThan(10);
    const expensePresets = FINANCIAL_CATEGORY_PRESETS.filter((x) => x.type === 2);
    expect(expensePresets.some((x) => x.code === 'MATERIALS')).toBe(true);
    expect(expensePresets.some((x) => x.code === 'LAB')).toBe(true);
    expect(expensePresets.some((x) => x.code === 'RENT')).toBe(true);
  });
});


