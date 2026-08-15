import { describe, expect, it } from 'vitest';
import {
  isCompleteDraftItem,
  isPrescriptionReadOnly,
  newDraftItem,
  removeDraftItem,
  reorderDraftItems,
} from './prescription-draft';

describe('prescription draft UI model', () => {
  it('creates a medication row without pricing or inventory concerns', () => {
    const item = newDraftItem(1);
    expect(item.sortOrder).toBe(1);
    expect(item).not.toHaveProperty('price');
    expect(item).not.toHaveProperty('stock');
  });

  it('requires medication and usable directions before creation', () => {
    const item = {
      ...newDraftItem(1),
      medicationName: 'Amoxicillin',
      dose: '500 mg',
      frequency: 'Every 8 hours',
      duration: '5 days',
      instructions: 'After meals',
    };
    expect(isCompleteDraftItem(item)).toBe(true);
    expect(isCompleteDraftItem({ ...item, frequency: ' ' })).toBe(false);
  });

  it('adds, reorders, and removes medication items with normalized order', () => {
    const first = { ...newDraftItem(1), medicationName: 'First' };
    const second = { ...newDraftItem(2), medicationName: 'Second' };
    const moved = reorderDraftItems([first, second], 1, -1);
    expect(moved.map((x) => [x.medicationName, x.sortOrder])).toEqual([
      ['Second', 1],
      ['First', 2],
    ]);
    expect(removeDraftItem(moved, 0).map((x) => x.sortOrder)).toEqual([1]);
  });

  it('keeps drafts editable and issued/cancelled prescriptions read-only', () => {
    expect(isPrescriptionReadOnly(1)).toBe(false);
    expect(isPrescriptionReadOnly(2)).toBe(true);
    expect(isPrescriptionReadOnly(3)).toBe(true);
  });
});
