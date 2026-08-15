export const planStatus = (value: number, ar = false) =>
  (ar
    ? ['', 'مسودة', 'مقترحة', 'مقبولة', 'مرفوضة', 'قيد التنفيذ', 'مكتملة', 'ملغاة'][value]
    : ['', 'Draft', 'Proposed', 'Accepted', 'Rejected', 'In progress', 'Completed', 'Cancelled'][
        value
      ]) ?? '—';
export const treatmentStatus = (value: number, ar = false) =>
  (ar
    ? ['', 'مخطط', 'مجدول', 'قيد التنفيذ', 'مكتمل', 'ملغى'][value]
    : ['', 'Planned', 'Scheduled', 'In progress', 'Completed', 'Cancelled'][value]) ?? '—';

export const planActions = (status: number) =>
  status === 1
    ? ['propose', 'cancel']
    : status === 2
      ? ['accept', 'reject', 'cancel']
      : status === 3
        ? ['start', 'cancel']
        : status === 5
          ? ['complete']
          : [];
export const treatmentActions = (status: number) =>
  status === 1 || status === 2 ? ['start', 'cancel'] : status === 3 ? ['complete', 'cancel'] : [];
export const planPrice = (
  unitPrice: number,
  quantity: number,
  itemDiscount: number,
  planDiscount: number,
) => {
  const subtotal = unitPrice * quantity - itemDiscount;
  return { subtotal, total: subtotal - planDiscount };
};
