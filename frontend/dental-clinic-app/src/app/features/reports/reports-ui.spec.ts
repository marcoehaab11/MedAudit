import { describe, expect, it } from 'vitest';
import { ReportFilter, ReportPeriod } from './reports-api.service';

describe('Reports UI & Filter Logic', () => {
  it('defaults filter period to ThisMonth', () => {
    const filter: ReportFilter = { period: ReportPeriod.ThisMonth };
    expect(filter.period).toBe(ReportPeriod.ThisMonth);
    expect(filter.from).toBeUndefined();
    expect(filter.to).toBeUndefined();
  });

  it('supports custom date range filters', () => {
    const filter: ReportFilter = {
      period: ReportPeriod.Custom,
      from: '2026-08-01',
      to: '2026-08-15',
      doctorId: 'd-123',
    };
    expect(filter.period).toBe(ReportPeriod.Custom);
    expect(filter.from).toBe('2026-08-01');
    expect(filter.to).toBe('2026-08-15');
    expect(filter.doctorId).toBe('d-123');
  });
});
