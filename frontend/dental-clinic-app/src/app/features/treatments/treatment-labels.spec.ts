import { describe, expect, it } from 'vitest';
import {
  planActions,
  planPrice,
  planStatus,
  treatmentActions,
  treatmentStatus,
} from './treatment-labels';

describe('treatment labels', () => {
  it('labels every treatment plan state in English', () => {
    expect(Array.from({ length: 7 }, (_, index) => planStatus(index + 1))).toEqual([
      'Draft',
      'Proposed',
      'Accepted',
      'Rejected',
      'In progress',
      'Completed',
      'Cancelled',
    ]);
  });

  it('labels every execution state in English', () => {
    expect(Array.from({ length: 5 }, (_, index) => treatmentStatus(index + 1))).toEqual([
      'Planned',
      'Scheduled',
      'In progress',
      'Completed',
      'Cancelled',
    ]);
  });

  it('provides Arabic and safe fallback labels', () => {
    expect(planStatus(3, true)).toBe('مقبولة');
    expect(treatmentStatus(4, true)).toBe('مكتمل');
    expect(planStatus(99)).toBe('—');
  });

  it('calculates pricing and both discount levels', () => {
    expect(planPrice(500, 2, 50, 100)).toEqual({ subtotal: 950, total: 850 });
  });

  it('exposes only valid plan status actions', () => {
    expect(planActions(1)).toEqual(['propose', 'cancel']);
    expect(planActions(2)).toEqual(['accept', 'reject', 'cancel']);
    expect(planActions(6)).toEqual([]);
  });

  it('keeps completed execution action-free', () => {
    expect(treatmentActions(3)).toEqual(['complete', 'cancel']);
    expect(treatmentActions(4)).toEqual([]);
  });
});
