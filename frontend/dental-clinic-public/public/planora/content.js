// بيانات تجريبية قابلة للتغيير قبل الإطلاق
window.PLANORA_CONTENT = {
  contactEmail: 'hello@planora.example',
  contactCity: 'القاهرة، مصر',
  patient: { name: 'سارة أحمد', id: 'PL-2048' },
  appointment: { title: 'جلسة متابعة', time: 'اليوم · ١١:٣٠ ص' },
  toothExamples: {
    11: { treatment: 'cleaning', status: 'completed', surfaces: [], note: 'تنظيف ومراجعة دورية' },
    14: { treatment: 'implant', status: 'planned', surfaces: [], note: 'زرعة مخططة بعد مراجعة الأشعة' },
    16: { treatment: 'filling', status: 'existing', surfaces: ['O', 'M'], note: 'حشو قديم على السطح الإطباقي والإنسي' },
    24: { treatment: 'crown', status: 'planned', surfaces: [], note: 'تاج مخطط بعد التجهيز' },
    28: { treatment: 'extraction', status: 'rejected', surfaces: [], note: 'خيار الخلع غير معتمد في المثال' },
    35: { treatment: 'bridge', status: 'completed', surfaces: [], note: 'جسر مكتمل ويحتاج مراجعة دورية' },
    36: { treatment: 'root-canal', status: 'progress', surfaces: [], note: 'علاج عصب جارٍ · المرحلة الأولى' },
    46: { treatment: 'filling', status: 'completed', surfaces: ['O', 'D'], note: 'حشو مكتمل على السطح الإطباقي والبعيد' }
  }
};
