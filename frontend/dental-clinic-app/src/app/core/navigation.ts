/** Presentation metadata only. Route guards remain the authority for access. */
export interface NavigationItem {
  path: string;
  en: string;
  ar: string;
  permission?: string;
  icon: string;
  exact?: boolean;
}
export interface NavigationGroup {
  id: string;
  en: string;
  ar: string;
  defaultOpen: boolean;
  items: readonly NavigationItem[];
}
export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: 'overview',
    en: 'Overview',
    ar: 'نظرة عامة',
    defaultOpen: true,
    items: [
      {
        path: '/dashboard',
        en: 'Dashboard',
        ar: 'لوحة التحكم',
        icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
        exact: true,
      },
    ],
  },
  {
    id: 'daily',
    en: 'Daily work',
    ar: 'العمل اليومي',
    defaultOpen: true,
    items: [
      {
        path: '/appointments',
        en: 'Appointments',
        ar: 'المواعيد',
        icon: 'M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2',
        permission: 'Appointments.View',
      },
      {
        path: '/patients',
        en: 'Patients',
        ar: 'المرضى',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
        permission: 'Patients.View',
      },
      {
        path: '/doctors',
        en: 'Doctors',
        ar: 'الأطباء',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M16 11l2 2 4-4',
        permission: 'Doctors.View',
      },
    ],
  },
  {
    id: 'clinical',
    en: 'Clinical',
    ar: 'العلاج والمتابعة',
    defaultOpen: false,
    items: [
      {
        path: '/treatment-plans',
        en: 'Treatment plans',
        ar: 'خطط العلاج',
        icon: 'M8 2h8v4H8z M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2 M8 11h8 M8 16h8',
        permission: 'TreatmentPlans.View',
      },
      {
        path: '/treatments',
        en: 'Treatments',
        ar: 'العلاجات',
        icon: 'M2 12h4l3-9 6 18 3-9h4',
        permission: 'Treatments.View',
      },
      {
        path: '/prescriptions',
        en: 'Prescriptions',
        ar: 'الوصفات',
        icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h8',
        permission: 'Prescriptions.View',
      },
      {
        path: '/treatment-catalog',
        en: 'Treatment catalog',
        ar: 'أنواع العلاجات والأسعار',
        icon: 'M4 4h6v16H4z M14 4h6v16h-6z M7 8h0 M17 8h0',
        permission: 'TreatmentCatalog.View',
      },
      {
        path: '/medications-catalog',
        en: 'Medication catalog',
        ar: 'دليل الأدوية',
        icon: 'M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7 M8.5 8.5l7 7',
        permission: 'Prescriptions.View',
      },
    ],
  },
  {
    id: 'finance',
    en: 'Finance',
    ar: 'المالية',
    defaultOpen: false,
    items: [
      {
        path: '/finance',
        en: 'Overview',
        ar: 'نظرة عامة',
        icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
        permission: 'Finance.View',
        exact: true,
      },
      {
        path: '/finance/revenue',
        en: 'Revenue',
        ar: 'الإيرادات',
        icon: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
        permission: 'Finance.Revenue.View',
      },
      {
        path: '/finance/payments',
        en: 'Payments',
        ar: 'المدفوعات',
        icon: 'M3 4h18v16H3z M3 10h18 M7 15h4',
        permission: 'Finance.Payments.View',
      },
      {
        path: '/finance/expenses',
        en: 'Expenses',
        ar: 'المصروفات',
        icon: 'M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1 M8 8h6 M8 12h8 M8 16h5',
        permission: 'Finance.Expenses.View',
      },
      {
        path: '/finance/categories',
        en: 'Categories',
        ar: 'التصنيفات',
        icon: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
        permission: 'Finance.Categories.View',
      },
      {
        path: '/finance/my-dues',
        en: 'My dues',
        ar: 'مستحقاتي',
        icon: 'M12 2v20 M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
        permission: 'Finance.View',
      },
    ],
  },
  {
    id: 'relationships',
    en: 'Relationships',
    ar: 'علاقات المرضى',
    defaultOpen: false,
    items: [
      {
        path: '/crm',
        en: 'CRM overview',
        ar: 'إدارة علاقات المرضى',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
        permission: 'CRM.View',
        exact: true,
      },
      {
        path: '/crm/follow-ups',
        en: 'Follow-ups',
        ar: 'المتابعات',
        icon: 'M8 3v4 M16 3v4 M4 11h16 M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1 M8 16l2 2 5-5',
        permission: 'CRM.View',
      },
    ],
  },
  {
    id: 'operations',
    en: 'Operations',
    ar: 'العمليات',
    defaultOpen: false,
    items: [
      {
        path: '/lab',
        en: 'Dental labs',
        ar: 'المعامل',
        icon: 'M9 3h6 M10 3v6l-6 10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2L14 9V3 M8 15h8',
        permission: 'Lab.View',
      },
      {
        path: '/insurance',
        en: 'Insurance',
        ar: 'التأمينات',
        icon: 'M12 2l9 4v6c0 5-9 10-9 10S3 17 3 12V6z M8 12l3 3 5-6',
        permission: 'Insurance.View',
      },
      {
        path: '/inventory',
        en: 'Inventory',
        ar: 'المخزون',
        icon: 'M12 2l9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10 M7.5 4.5l9 5',
        permission: 'Inventory.View',
      },
      {
        path: '/online-booking',
        en: 'Online booking',
        ar: 'الحجز الإلكتروني',
        icon: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M2 12h20 M12 2c5 5 5 15 0 20-5-5-5-15 0-20',
        permission: 'Settings.PublicBooking',
      },
      {
        path: '/notifications',
        en: 'Notifications',
        ar: 'الإشعارات',
        icon: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21h4',
        permission: 'Notifications.View',
      },
    ],
  },
  {
    id: 'insights',
    en: 'Insights',
    ar: 'التحليلات',
    defaultOpen: false,
    items: [
      {
        path: '/reports',
        en: 'Reports',
        ar: 'التقارير',
        icon: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
        permission: 'Reports.View',
      },
    ],
  },
  {
    id: 'administration',
    en: 'Administration',
    ar: 'الإدارة',
    defaultOpen: false,
    items: [
      {
        path: '/users',
        en: 'Users',
        ar: 'المستخدمون',
        icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75',
        permission: 'Users.View',
      },
      {
        path: '/branches',
        en: 'Branches',
        ar: 'الفروع',
        icon: 'M12 3v7 M5 14v-4h14v4 M2 14h6v7H2z M9 2h6v5H9z M16 14h6v7h-6z',
        permission: 'Settings.View',
      },
      {
        path: '/settings',
        en: 'Settings',
        ar: 'الإعدادات',
        icon: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',
        permission: 'Settings.View',
      },
      {
        path: '/backup',
        en: 'Backup',
        ar: 'نسخة احتياطية',
        icon: 'M12 3v12 M8 11l4 4 4-4 M4 16v5h16v-5',
        permission: 'Backup.Create',
      },
    ],
  },
  {
    id: 'help',
    en: 'Help',
    ar: 'المساعدة',
    defaultOpen: true,
    items: [
      {
        path: '/guide',
        en: 'Guide & help',
        ar: 'الدليل والمساعدة',
        icon: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0 M9.5 9a2.5 2.5 0 1 1 4.3 1.7c-1.1 1-1.8 1.4-1.8 3.3 M12 17h.01',
      },
    ],
  },
];
