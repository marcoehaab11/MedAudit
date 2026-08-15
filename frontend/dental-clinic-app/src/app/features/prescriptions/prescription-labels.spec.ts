import { describe, expect, it } from 'vitest';
import { medicationForm, prescriptionActions, prescriptionStatus } from './prescription-labels';

describe('prescription labels', () => {
  it('labels every prescription status in English', () => {
    expect(Array.from({ length: 3 }, (_, index) => prescriptionStatus(index + 1))).toEqual([
      'Draft',
      'Issued',
      'Cancelled',
    ]);
  });

  it('labels every supported medication form', () => {
    expect(Array.from({ length: 8 }, (_, index) => medicationForm(index + 1))).toEqual([
      'Tablet',
      'Capsule',
      'Syrup',
      'Cream',
      'Gel',
      'Mouthwash',
      'Injection',
      'Other',
    ]);
  });

  it('provides Arabic and safe fallback labels', () => {
    expect(prescriptionStatus(2, true)).not.toBe('Issued');
    expect(medicationForm(1, true)).not.toBe('Tablet');
    expect(prescriptionStatus(99)).toBe('—');
  });

  it('exposes only valid lifecycle actions', () => {
    expect(prescriptionActions(1)).toEqual(['issue', 'cancel']);
    expect(prescriptionActions(2)).toEqual(['cancel']);
    expect(prescriptionActions(3)).toEqual([]);
  });
});
