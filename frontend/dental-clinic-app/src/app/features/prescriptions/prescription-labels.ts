export const prescriptionStatus = (value: number, ar = false) =>
  (ar ? ['', 'مسودة', 'صادرة', 'ملغاة'] : ['', 'Draft', 'Issued', 'Cancelled'])[value] ?? '—';
export const prescriptionActions = (status: number) =>
  status === 1 ? ['issue', 'cancel'] : status === 2 ? ['cancel'] : [];
export const medicationForm = (value?: number, ar = false) =>
  (ar
    ? ['', 'قرص', 'كبسولة', 'شراب', 'كريم', 'جل', 'غسول فم', 'حقن', 'أخرى']
    : ['', 'Tablet', 'Capsule', 'Syrup', 'Cream', 'Gel', 'Mouthwash', 'Injection', 'Other'])[
    value ?? 0
  ] ?? '—';
