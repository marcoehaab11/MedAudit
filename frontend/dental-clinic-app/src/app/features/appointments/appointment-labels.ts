export const bookableAppointmentTypes = [1, 2] as const;

export function appointmentBookingState(status: number): string {
  if (status === 1) return 'unconfirmed';
  if (status === 2) return 'confirmed';
  if (status === 6) return 'cancelled';
  if (status === 7) return 'no-show';
  return 'attended';
}

export function appointmentBookingStatus(status: number, language: 'en' | 'ar'): string {
  if (status === 1) return language === 'en' ? 'Unconfirmed' : 'غير مؤكد';
  if (status === 3) return language === 'en' ? 'Attended' : 'حضر';
  return appointmentStatus(status, language);
}

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

