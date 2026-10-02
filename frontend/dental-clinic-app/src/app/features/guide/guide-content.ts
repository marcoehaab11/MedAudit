export interface GuideText { en: string; ar: string }

export interface GuideStep {
  title: GuideText;
  detail: GuideText;
  path?: string;
  permission?: string;
}

export interface GuideTopic {
  id: string;
  group: 'start' | 'reception' | 'clinical' | 'management';
  icon: string;
  title: GuideText;
  summary: GuideText;
  steps: GuideStep[];
  permission?: string;
}

export const GUIDE_TOPICS: GuideTopic[] = [
  {
    id: 'start', group: 'start', icon: '✦',
    title: { en: 'Start using Planora', ar: 'ابدأ استخدام Planora' },
    summary: { en: 'The shortest path from clinic setup to the first patient visit.', ar: 'أقصر طريق من إعداد العيادة إلى أول زيارة لمريض.' },
    steps: [
      { title: { en: 'Complete clinic details', ar: 'كمّل بيانات العيادة' }, detail: { en: 'Add the clinic name, contact details, location and working hours in Settings.', ar: 'أضف اسم العيادة وبيانات التواصل والعنوان ومواعيد العمل من الإعدادات.' }, path: '/settings', permission: 'Settings.ClinicProfile' },
      { title: { en: 'Add doctors and their schedules', ar: 'أضف الأطباء ومواعيدهم' }, detail: { en: 'Create doctor profiles and set their working schedules.', ar: 'أنشئ ملفات الأطباء وحدد مواعيد عملهم.' }, path: '/doctors', permission: 'Doctors.View' },
      { title: { en: 'Add bookable services', ar: 'أضف الخدمات القابلة للحجز' }, detail: { en: 'Set service names, durations and prices in the treatment catalog.', ar: 'حدد أسماء الخدمات ومدتها وأسعارها في دليل العلاجات.' }, path: '/treatment-catalog', permission: 'Treatments.View' },
      { title: { en: 'Share the booking page', ar: 'انشر صفحة الحجز' }, detail: { en: 'Review the public clinic page, enable online booking, and share its link or QR code.', ar: 'راجع صفحة العيادة العامة، فعّل الحجز الإلكتروني، وشارك الرابط أو رمز QR.' }, path: '/online-booking' },
      { title: { en: 'Follow the first request', ar: 'تابع أول طلب' }, detail: { en: 'Assign an incoming request to a team member, contact the patient and update its status.', ar: 'أسند الطلب الوارد لموظف، تواصل مع المريض، وحدّث حالة المتابعة.' }, path: '/online-booking', permission: 'Appointments.View' },
    ],
  },
  {
    id: 'patients', group: 'reception', icon: '◌',
    title: { en: 'Patients and records', ar: 'المرضى والملفات' },
    summary: { en: 'Register a patient and find their history in one place.', ar: 'سجّل المريض واعثر على تاريخه من مكان واحد.' },
    permission: 'Patients.View',
    steps: [
      { title: { en: 'Find the patient first', ar: 'ابحث عن المريض أولاً' }, detail: { en: 'Search by name or phone before creating another record to avoid duplicates.', ar: 'ابحث بالاسم أو الهاتف قبل إنشاء ملف جديد لتجنب التكرار.' }, path: '/patients' },
      { title: { en: 'Create or update the record', ar: 'أنشئ أو حدّث الملف' }, detail: { en: 'Keep contact information, medical notes and visit details current.', ar: 'حدّث بيانات التواصل والملاحظات الطبية وتفاصيل الزيارات.' }, path: '/patients/create', permission: 'Patients.Create' },
      { title: { en: 'Open the patient history', ar: 'افتح تاريخ المريض' }, detail: { en: 'Select a patient to review appointments, treatment and related records.', ar: 'اختر المريض لمراجعة مواعيده والعلاجات والسجلات المرتبطة.' }, path: '/patients' },
    ],
  },
  {
    id: 'appointments', group: 'reception', icon: '▦',
    title: { en: 'Appointments', ar: 'المواعيد' },
    summary: { en: 'Book, confirm and follow each visit through its status.', ar: 'احجز الزيارة وأكدها وتابع حالتها.' },
    permission: 'Appointments.View',
    steps: [
      { title: { en: 'Check availability', ar: 'راجع المواعيد المتاحة' }, detail: { en: 'Open the schedule and choose the doctor and date before booking.', ar: 'افتح جدول المواعيد واختر الطبيب والتاريخ قبل الحجز.' }, path: '/appointments' },
      { title: { en: 'Create an appointment', ar: 'أنشئ موعدًا' }, detail: { en: 'Choose the patient, doctor and available slot; add notes the team should know.', ar: 'اختر المريض والطبيب والموعد المتاح، وأضف الملاحظات المهمة للفريق.' }, path: '/appointments/create', permission: 'Appointments.Create' },
      { title: { en: 'Update the visit status', ar: 'حدّث حالة الزيارة' }, detail: { en: 'Confirm the booking, check the patient in, or record cancellation and no-show from the schedule.', ar: 'أكد الحجز، سجل حضور المريض، أو سجّل الإلغاء وعدم الحضور من الجدول.' }, path: '/appointments' },
    ],
  },
  {
    id: 'booking', group: 'reception', icon: '⌁',
    title: { en: 'Online booking and WhatsApp', ar: 'الحجز الإلكتروني وواتساب' },
    summary: { en: 'Share the patient page and handle incoming requests.', ar: 'شارك صفحة المريض وتابع الطلبات الواردة.' },
    steps: [
      { title: { en: 'Set up the public page', ar: 'جهّز الصفحة العامة' }, detail: { en: 'Add the clinic description, logo, contact details and working hours, then enable booking.', ar: 'أضف وصف العيادة وشعارها وبيانات التواصل ومواعيد العمل، ثم فعّل الحجز.' }, path: '/online-booking' },
      { title: { en: 'Share the link or QR', ar: 'شارك الرابط أو QR' }, detail: { en: 'Copy the clinic link or download its QR code. Use the Google link button for Google Business Profile.', ar: 'انسخ رابط العيادة أو نزّل رمز QR. استخدم زر رابط جوجل لملف النشاط التجاري.' }, path: '/online-booking' },
      { title: { en: 'Handle new requests', ar: 'تابع الطلبات الجديدة' }, detail: { en: 'Assign a team member, add follow-up notes and contact the patient. Overdue requests appear in the summary.', ar: 'أسند الطلب لموظف وأضف ملاحظات المتابعة وتواصل مع المريض. الطلبات المتأخرة تظهر في الملخص.' }, path: '/online-booking', permission: 'Appointments.View' },
      { title: { en: 'Use WhatsApp Web', ar: 'استخدم واتساب ويب' }, detail: { en: 'Open the prepared message, scan the WhatsApp Web QR if asked, review it and press Send.', ar: 'افتح الرسالة الجاهزة، امسح QR الخاص بواتساب ويب عند الحاجة، راجع الرسالة واضغط إرسال.' }, path: '/online-booking', permission: 'Appointments.View' },
    ],
  },
  {
    id: 'clinical', group: 'clinical', icon: '✚',
    title: { en: 'Clinical visit and dental chart', ar: 'الزيارة الطبية وخريطة الأسنان' },
    summary: { en: 'Document examination findings and the next treatment step.', ar: 'وثّق نتائج الكشف وخطوة العلاج التالية.' },
    permission: 'Appointments.View',
    steps: [
      { title: { en: 'Open today’s appointment', ar: 'افتح موعد اليوم' }, detail: { en: 'Find the appointment in the schedule and open its patient visit.', ar: 'ابحث عن الموعد في الجدول وافتح زيارة المريض.' }, path: '/appointments' },
      { title: { en: 'Record the examination', ar: 'سجّل الكشف' }, detail: { en: 'Document findings and use the dental chart to mark the relevant teeth and surfaces.', ar: 'وثّق النتائج واستخدم خريطة الأسنان لتحديد الأسنان والأسطح المعنية.' }, path: '/appointments' },
      { title: { en: 'Plan the next treatment', ar: 'خطط للعلاج التالي' }, detail: { en: 'Create a treatment plan and connect the next visit to the patient record.', ar: 'أنشئ خطة علاج واربط الزيارة التالية بملف المريض.' }, path: '/treatment-plans', permission: 'TreatmentPlans.View' },
    ],
  },
  {
    id: 'settings', group: 'management', icon: '⚙',
    title: { en: 'Clinic settings and team', ar: 'إعدادات العيادة والفريق' },
    summary: { en: 'Keep the clinic profile, opening hours and access up to date.', ar: 'حدّث بيانات العيادة ومواعيدها وصلاحيات الفريق.' },
    steps: [
      { title: { en: 'Update clinic details', ar: 'حدّث بيانات العيادة' }, detail: { en: 'Review the public name, phones, address, logo and working hours.', ar: 'راجع الاسم المعروض والهواتف والعنوان والشعار ومواعيد العمل.' }, path: '/settings', permission: 'Settings.ClinicProfile' },
      { title: { en: 'Manage access', ar: 'نظّم الصلاحيات' }, detail: { en: 'Add staff and give each person only the permissions needed for their work.', ar: 'أضف الموظفين وحدد لكل شخص الصلاحيات اللازمة لعمله.' }, path: '/users', permission: 'Users.View' },
      { title: { en: 'Review booking requests', ar: 'راجع طلبات الحجز' }, detail: { en: 'Check owner assignments, pending requests and the clinic booking link.', ar: 'راجع المسؤول عن كل طلب، والطلبات المعلقة، ورابط حجز العيادة.' }, path: '/online-booking' },
    ],
  },
  {
    id: 'reports', group: 'management', icon: '▥',
    title: { en: 'Reports and performance', ar: 'التقارير والأداء' },
    summary: { en: 'Read clinic activity and booking results.', ar: 'افهم نشاط العيادة ونتائج الحجز.' },
    permission: 'Reports.View',
    steps: [
      { title: { en: 'Open analytics', ar: 'افتح التحليلات' }, detail: { en: 'Use reports to review appointments, patients and financial activity.', ar: 'استخدم التقارير لمراجعة المواعيد والمرضى والنشاط المالي.' }, path: '/reports' },
      { title: { en: 'Measure online booking', ar: 'قِس نتائج الحجز الإلكتروني' }, detail: { en: 'Check visits, bookings, requests and their QR, Google or social sources on Online Booking.', ar: 'راجع الزيارات والحجوزات والطلبات ومصادرها من QR وجوجل والسوشيال في صفحة الحجز.' }, path: '/online-booking' },
    ],
  },
];
