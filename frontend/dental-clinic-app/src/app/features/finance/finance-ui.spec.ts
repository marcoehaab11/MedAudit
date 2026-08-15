import {
  canViewPatientFinance,
  dashboardValues,
  financeFilters,
  financePeriods,
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
});
