export function appointmentStatus(value: number, language: 'en' | 'ar'): string {
  const labels =
    language === 'en'
      ? ['Scheduled', 'Confirmed', 'Checked in', 'In progress', 'Completed', 'Cancelled', 'No-show']
      : ['مجدول', 'مؤكد', 'تم تسجيل الحضور', 'قيد التنفيذ', 'مكتمل', 'ملغي', 'لم يحضر'];
  return labels[value - 1] ?? '—';
}

export function appointmentType(value: number, language: 'en' | 'ar'): string {
  const labels =
    language === 'en'
      ? ['New patient', 'Follow-up', 'Consultation', 'Treatment', 'Emergency', 'Other']
      : ['مريض جديد', 'متابعة', 'استشارة', 'علاج', 'طوارئ', 'أخرى'];
  return labels[value - 1] ?? '—';
}
