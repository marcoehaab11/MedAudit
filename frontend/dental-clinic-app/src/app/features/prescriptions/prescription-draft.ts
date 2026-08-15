import { PrescriptionItemInput } from './prescription-api.service';

export type DraftPrescriptionItem = PrescriptionItemInput & {
  id?: string;
  medicationName?: string;
};

export const newDraftItem = (sortOrder: number): DraftPrescriptionItem => ({
  medicationId: '',
  medicationName: '',
  dose: '',
  frequency: '',
  duration: '',
  route: '',
  instructions: '',
  quantity: undefined,
  sortOrder,
});

export const reorderDraftItems = (
  items: DraftPrescriptionItem[],
  index: number,
  direction: number,
) => {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const reordered = items.map((item) => ({ ...item }));
  [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
  return reordered.map((item, position) => ({ ...item, sortOrder: position + 1 }));
};

export const removeDraftItem = (items: DraftPrescriptionItem[], index: number) =>
  items
    .filter((_, position) => position !== index)
    .map((item, position) => ({ ...item, sortOrder: position + 1 }));

export const isCompleteDraftItem = (item: DraftPrescriptionItem) =>
  !!(
    (item.medicationId || item.medicationName?.trim()) &&
    item.dose.trim() &&
    item.frequency.trim() &&
    item.duration.trim() &&
    item.instructions.trim()
  );

export const isPrescriptionReadOnly = (status: number) => status !== 1;
