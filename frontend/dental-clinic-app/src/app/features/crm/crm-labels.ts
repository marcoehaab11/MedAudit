import { Activity, FollowUpList } from './crm-api.service';
export const followUpStatus = (value: number, ar = false) =>
  (ar
    ? ['', 'معلق', 'قيد التنفيذ', 'مكتمل', 'ملغى']
    : ['', 'Pending', 'In progress', 'Completed', 'Cancelled'])[value] ?? '—';
export const followUpType = (value: number, ar = false) =>
  (ar
    ? [
        '',
        'مريض جديد',
        'تذكير بموعد',
        'موعد فائت',
        'متابعة علاج',
        'متابعة خطة علاج',
        'بعد العلاج',
        'متابعة وصفة',
        'عامة',
      ]
    : [
        '',
        'New patient',
        'Appointment reminder',
        'Missed appointment',
        'Treatment follow-up',
        'Treatment plan follow-up',
        'Post-treatment',
        'Prescription follow-up',
        'General',
      ])[value] ?? '—';
export const activityType = (value: number, ar = false) =>
  (ar
    ? ['', 'مكالمة', 'واتساب', 'رسالة نصية', 'بريد إلكتروني', 'أخرى']
    : ['', 'Call', 'WhatsApp', 'SMS', 'Email', 'Other'])[value] ?? '—';
export const followUpActions = (status: number) =>
  status === 1 ? ['start', 'complete', 'cancel'] : status === 2 ? ['complete', 'cancel'] : [];
export const clinicDate = (value: string, timeZone: string, language = 'en') =>
  new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value));
export const crmTimeline = (activities: Activity[], followUps: FollowUpList[]) =>
  [
    ...activities.map((x) => ({
      id: x.id,
      occurredAt: x.occurredAt,
      kind: 'activity' as const,
      label: x.subject || activityType(x.type),
      detail: x.notes,
    })),
    ...followUps
      .filter((x) => x.status === 3)
      .map((x) => ({
        id: x.id,
        occurredAt: x.completedAt ?? x.createdAt,
        kind: 'follow-up' as const,
        label: x.title,
        detail: 'Completed follow-up',
      })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
