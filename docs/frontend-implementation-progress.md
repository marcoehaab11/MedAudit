# Frontend implementation progress

Updated: 12 November 2026. Batches 1–6 cover the clinic shell, shared page system, patient intake and booking, the remaining clinic families, public pages, and platform layout. See `frontend-release-verification.md` for exact evidence and limits.

## الدفعة الثالثة — الأطباء وخطط العلاج

- توحيد القوائم والتفاصيل ونماذج الإضافة والتعديل مع التصميم السابق، وإعادة استخدام التنسيق من `shared/styles/_workspace-records.scss`.
- إضافة تسميات واضحة للفلاتر، وإعادة ضبطها، وفصل فشل التحميل عن النتائج الفارغة. إضافة التنقل بين صفحات خطط العلاج باستخدام واجهة API الحالية.
- تحسين تبويبات ملف الطبيب، والجدول الأسبوعي وتسميات حقول العمل والاستراحات، وعرض المستحقات حسب الصلاحية الحالية.
- إبقاء ملف الطبيب وتعديلات فترات العمل ظاهرين عند رفض الحفظ، ومنع إرسال حفظ الجدول أو المستحقات مرتين أثناء انتظار الرد.
- منع إنشاء قاعدة مستحقات قبل تحميل سجل القواعد الحالي بنجاح، حتى لا يُفسّر فشل الطلب على أنه سجل فارغ.
- إخفاء نماذج التعديل إذا لم تُحمّل بيانات الطبيب أو الخطة، مع إعادة المحاولة بدل عرض نموذج فارغ قابل للحفظ.
- تحويل خيارات حساب الطبيب وشرائح السعر إلى أزرار أصلية، وتحسين مكوّني اختيار المريض والطبيب للتحكم بلوحة المفاتيح وتسميات قارئ الشاشة واستعادة التركيز بعد الاختيار.
- تصفية أزرار انتقال حالة الخطة وفق الصلاحيات الموجودة في خدمة الخادم، ومنع تكرار الإرسال، وإتاحة إعادة تحميل النسخة الأحدث بعد تعارض الإصدار.
- تحسين تباين الإجمالي التقديري وتفاف أزرار الهاتف. لم تُغيّر معادلات الأسعار أو الخصومات أو قواعد انتقال الحالات أو عقود الخادم.

### التحقق وحدود التغطية

- نجح `npm run build`؛ الحزمة الأولية **406.64 kB**. تحذير `features/dental/dental.scss` السابق ما زال موجودًا عند 110.71 kB مقابل حد التحذير 80 kB، ولم يُعدّل الملف.
- نجح تشغيل **36 اختبارًا في 8 ملفات**: اختبارات الهيكل، ولوحة التحكم، وملف المريض، وقائمة المواعيد ونموذج إنشائها، واختبارات استعادة الأطباء والخطط وتسميات/حسابات العلاج.
- فحص المتصفح لهذه الدفعة موجود في `tmp/frontend-plans-qa/verify.mjs` ويستخدم بناء الإنتاج وبيانات API محلية تجريبية. يغطي القوائم والنماذج والتفاصيل، والعربية والإنجليزية، وعروض 1440 و1024 و768 و390 و320 بكسل، والتصفية والترقيم وإعادة المحاولة، والاحتفاظ بالقيم بعد رفض الحفظ، وتعارض الإصدار، واختيار المريض والطبيب والسعر بلوحة المفاتيح، والإجراءات الظاهرة لدور العرض فقط. نجح التشغيل الكامل على النسخة النهائية دون استثناءات متصفح أو طلبات شبكة فاشلة أو مسارات API غير متوقعة؛ النتائج و33 صورة محفوظة في `tmp/frontend-plans-qa/result.json` والمجلد نفسه. فُحصت الصور النهائية، ونجح `git diff --check` للملفات المتأثرة.
- تأكيدات الأرشفة والتنشيط، وإنشاء حساب جديد فعلي، وإضافة/حذف بنود الخطة على الخادم الحقيقي، والتحقق السريري/المحاسبي الكامل، والتوافق مع Safari على جهاز حقيقي لم تُختبر بهذه البيانات المحلية. قواعدها الأصلية باقية، ولا تعني فحوص الواجهة اعتماد التكامل الحقيقي.
- نسخة التراجع قبل هذه الدفعة في `tmp/frontend-checkpoints/20261111-doctors-plans/`؛ تشمل أيضًا مكوّني الاختيار وسجل التقدم السابق. الملفات الجديدة هي تنسيق السجلات المشترك واختبارا `doctor-recovery.spec.ts` و`treatment-plan-recovery.spec.ts`. أعد الملفات المحددة من النسخة عند الحاجة بدل إعادة ضبط Git.

## الدفعة الثانية — لوحة التحكم وملف المريض

- توحيد رأس لوحة التحكم والإجراءات السريعة، مع بقاء قوائم العمل المهمة قبل الجدول والمؤشرات.
- إعادة استخدام تنسيق فلاتر المواعيد في لوحة التحكم من `shared/styles/_workspace-calendar.scss` بدل نسختين منفصلتين.
- فصل تعذّر التحميل عن الحالة الفارغة في الجدول وقوائم المرضى والمواعيد القادمة؛ البيانات غير المتاحة لا تظهر على أنها صفر.
- إزالة الرابط المتداخل داخل زر الموعد؛ زر التفاصيل ورابط فتح الزيارة أصبحا عنصرين مستقلين.
- تنظيم هوية المريض وحالاته وإجراءات الحجز والتعديل وأدوات الملف، مع إبقاء الأرشفة داخل «إجراءات أخرى» وتأكيدها السابق.
- إبقاء التنبيه الطبي التلقائي، وإضافة ملخص واضح لإعادة مراجعته.
- تحسين اختيار أقسام الملف ودعم العربية والهاتف؛ إضافة تسميات دائمة لحقول السجل الطبي وأسماء لأزرار الحذف.
- فصل خطأ حفظ الملاحظات عن خطأ تحميل الملف، حتى يبقى النص غير المحفوظ والملف ظاهرين بعد رفض الحفظ، وإضافة إعادة المحاولة لتحميل الملف.
- تسمية خانات اليوم والشهر والسنة في مكوّن التاريخ المشترك، وإتاحة زر التقويم بلوحة المفاتيح؛ منطق التواريخ والتحقق منها لم يتغير.

### التحقق من الدفعة الثانية

- نجح `npm run build`؛ حجم الحزمة الأولية 406.63 kB. ما زال تحذير حجم `features/dental/dental.scss` السابق موجودًا، ولم يُعدَّل الملف في هذه الدفعة.
- نجح أمر الاختبارات الموجّه لأربعة ملفات: `app.spec.ts` و`dashboard-page.component.spec.ts` و`patient-details.component.spec.ts` و`appointments-page.component.spec.ts`: **16 اختبارًا ناجحًا**.
- نجح فحص `tmp/frontend-care-qa/verify.mjs` باستخدام Chrome وواجهات API محلية ببيانات تجريبية: العربية والإنجليزية، وعروض 1440 و1024 و768 و390 و320 بكسل، وتفاصيل الموعد، وحالات الفشل والفراغ وإعادة المحاولة، وتسميات الحقول، والاحتفاظ بالملاحظات بعد رفض الحفظ، والتنبيه الطبي التلقائي، وإخفاء الإجراءات وفق الصلاحيات.
- أُعيد فحص `tmp/frontend-shell-qa/verify.mjs` بعد استخراج التنسيق المشترك؛ نجحت فحوص القائمة الجانبية والمرضى والمواعيد دون أخطاء متصفح أو طلبات غير متوقعة.
- الصور والنتائج محفوظة في `tmp/frontend-care-qa/`؛ فحص `git diff --check` للملفات المتأثرة ناجح.

التحقق تم ببيانات محلية تجريبية، وليس اتصالًا بالخادم الحقيقي. الملخصات السريرية والمالية المضمّنة في نظرة المريض العامة، وتحرير إجراءات الأسنان، والطباعة والتصدير، وتوافق Safari على جهاز حقيقي لم تُختبر في هذه الدفعة. لا تعني هذه النتائج اكتمال مراجعة كل صفحات التطبيق.

نسخة ما قبل التعديل موجودة في `tmp/frontend-checkpoints/20261111-dashboard-patient/` مع المسارات الأصلية للملفات. الملفات الجديدة في هذه الدفعة هي ملف تنسيق التقويم المشترك واختبارات لوحة التحكم؛ لا تستخدم إعادة ضبط Git للتراجع، لأنها قد تزيل تعديلات سابقة للمستخدم.

## Delivered in batch 1

- Central permission-aware navigation metadata, task groups, current-route semantics, and automatic opening of the active group.
- Account-scoped desktop collapse preference; accessible labels in the rail; expand and sign-out remain available.
- Unified LTR/RTL shell geometry, mobile modal drawer with background isolation, scroll lock, focus containment/restoration, Escape and backdrop close.
- Shared opt-in page-header, labeled-filter, results-header, focus, and reduced-motion patterns.
- Patient directory visible labels, result count, reset action, distinct error/empty states, retry and contained table scrolling.
- Appointment calendar visible filter labels, localized period controls, pressed state on view toggles, loading/feedback semantics.

## Scope and rollback

No application routes, API contracts, clinical rules, or authorization guards changed. Public and platform admin implementation has not started. The shared shell affects clinic pages. Dashboard and patient-file work is covered in batch 2; doctors and treatment plans are covered in batch 3. The other feature families still need their planned passes.

Before editing, the affected files were copied into `tmp/frontend-checkpoints/20261111-shell-pilot/`, retaining their repository-relative paths. `base-commit.txt` records the original HEAD. Restore only selected files from that checkpoint if needed; a Git reset would discard earlier user work. New navigation metadata is in `frontend/dental-clinic-app/src/app/core/navigation.ts`.

## Verification

Detailed local browser evidence is under `tmp/frontend-shell-qa/`. This harness serves the production build against synthetic local API fixtures and never connects to the real backend. Screenshots and test results establish only the documented pilot coverage. Live backend flows, clinical editors, real-device Safari, and whole-site accessibility certification remain untested.

Fresh checks for this batch:

- `npm run build` in `frontend/dental-clinic-app`: passed. Initial bundle 406.63 kB, below its existing 500 kB warning budget. An unchanged `features/dental/dental.scss` still warns at 110.71 kB against its 80 kB warning budget.
- `npm test -- --watch=false --include=src/app/app.spec.ts --include=src/app/features/appointments/appointments-page.component.spec.ts`: 2 files, 10 tests passed. Covers shell permissions/collapse/mobile state and existing appointment regressions.
- `node tmp/frontend-shell-qa/verify.mjs`: passed against the final production build in headless Chrome. Checks include English/Arabic, widths 1440/1024/768/390/320, page overflow, permission visibility, active link, collapse persistence and labels, filter submit/reset, drawer focus entry/wrap/restore, Escape close, group toggles, RTL geometry, patient empty/error/retry, view switching, and reduced-motion preference. No browser exceptions, failed network requests, or unexpected fixture API routes.
- Inspected the final desktop, collapsed, mobile, and RTL screenshots of the pilot. Twelve final captures and `result.json` are retained in `tmp/frontend-shell-qa/`.
- `git diff --check` on the affected source files: passed.

## Clinic route inventory

Create/edit/detail variants remain explicit so a completed list page does not imply its forms or details are complete. Redirects/fallbacks are listed for traceability.

| Route | Feature implementation status |
| --- | --- |
| `/treatments/:id/clinical` | Clinical focus/input/mobile pass applied; no clinical writes in browser QA |
| `/patients/:patientId/implants/:tooth` | Shared workspace UI pass applied; live server integration not verified |
| `/forgot-password` | Shared auth/input/mobile pass applied; outside authenticated shell |
| `/reset-password` | Shared auth/input/mobile pass applied; outside authenticated shell |
| `/login` | Shared auth/input/mobile pass applied; outside authenticated shell |
| `/accept-invitation` | Shared auth/input/mobile pass applied; outside authenticated shell |
| `/dashboard` | Batch 2 implemented and checked with local API fixtures |
| `/users` | Shared workspace UI pass applied; live server integration not verified |
| `/branches` | Shared workspace UI pass applied; live server integration not verified |
| `/users/:id` | Shared workspace UI pass applied; live server integration not verified |
| `/patients` | Pilot implemented; see browser evidence |
| `/patients/create` | Batch 4 implemented; loading/retry/save recovery and responsive fixture verification passed |
| `/patients/:id/edit` | Batch 4 implemented; loading/retry/save recovery and responsive fixture verification passed |
| `/patients/:id` | Batch 2 patient-file interface implemented; embedded summary/integration limits documented above |
| `/doctors` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/doctors/create` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/doctors/:id/edit` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/doctors/:id` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/appointments` | Pilot implemented; see browser evidence |
| `/appointments/create` | Batch 4 implemented; loading/retry/save recovery and responsive fixture verification passed |
| `/appointments/:appointmentId/examination` | Shared workspace UI pass applied; live server integration not verified |
| `/appointments/:appointmentId/visit` | Shared workspace UI pass applied; live server integration not verified |
| `/patients/:id/dental` | Shared workspace UI pass applied; live server integration not verified |
| `/treatment-plans` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/treatment-plans/create` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/treatment-plans/:id/edit` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/treatment-plans/:id` | Batch 3 interface implemented; local-fixture verification and integration limits above |
| `/treatments` | Shared workspace UI pass applied; live server integration not verified |
| `/treatment-catalog` | Shared workspace UI pass applied; live server integration not verified |
| `/treatments/catalog` | Redirect/fallback; target feature tracked separately |
| `/treatments/:id` | Shared workspace UI pass applied; live server integration not verified |
| `/medications-catalog` | Shared workspace UI pass applied; live server integration not verified |
| `/medications` | Redirect/fallback; target feature tracked separately |
| `/prescriptions` | Shared workspace UI pass applied; live server integration not verified |
| `/prescriptions/create` | Shared workspace UI pass applied; live server integration not verified |
| `/prescriptions/:id/edit` | Shared workspace UI pass applied; live server integration not verified |
| `/prescriptions/:id` | Shared workspace UI pass applied; live server integration not verified |
| `/crm` | Shared workspace UI pass applied; live server integration not verified |
| `/crm/follow-ups` | Shared workspace UI pass applied; live server integration not verified |
| `/crm/follow-ups/create` | Shared workspace UI pass applied; live server integration not verified |
| `/crm/follow-ups/:id` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/my-dues` | Shared workspace UI pass applied; live server integration not verified |
| `/finance` | Shared workspace UI pass applied; live server integration not verified |
| `/lab` | Shared workspace UI pass applied; live server integration not verified |
| `/insurance` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/revenue` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/payments` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/payments/create` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/expenses` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/expenses/create` | Shared workspace UI pass applied; live server integration not verified |
| `/finance/categories` | Shared workspace UI pass applied; live server integration not verified |
| `/reports` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/financial` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/revenue` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/expenses` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/profit` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/patients` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/appointments` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/doctors` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/treatments` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/prescriptions` | Shared workspace UI pass applied; live server integration not verified |
| `/reports/crm` | Shared workspace UI pass applied; live server integration not verified |
| `/notifications` | Shared workspace UI pass applied; live server integration not verified |
| `/inventory` | Shared workspace UI pass applied; live server integration not verified |
| `/online-booking` | Shared workspace UI pass applied; live server integration not verified |
| `/guide` | Shared workspace UI pass applied; live server integration not verified |
| `/settings` | Shared workspace UI pass applied; live server integration not verified |
| `/backup` | Shared workspace UI pass applied; live server integration not verified |
| `/access-denied` | Shared workspace UI pass applied; live server integration not verified |
| `/` | Redirect/fallback; target feature tracked separately |
| `/**` | Redirect/fallback; target feature tracked separately |

## Public route inventory

| Route | Status |
| --- | --- |
| `/register` | Shared UI pass applied; see release verification for runtime coverage |
| `/confirm-email` | Shared UI pass applied; see release verification for runtime coverage |
| `/book/:clinicSlug` | Shared UI pass applied; see release verification for runtime coverage |
| `/book/confirmation/:reference` | Shared UI pass applied; see release verification for runtime coverage |
| `/` | Shared UI pass applied; see release verification for runtime coverage |

## Platform admin page inventory

| Page | Status |
| --- | --- |
| `Account/Login.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Account/Logout.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Clinics/Create.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Clinics/Details.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Clinics/Edit.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Clinics/Index.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Email.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Operations.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Admin/Registrations.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Error.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Index.cshtml` | Shared UI pass applied; see release verification for runtime coverage |
| `Privacy.cshtml` | Shared UI pass applied; see release verification for runtime coverage |

Pharmacy components exist without a direct route in the current clinic route file. Determine their intended integration before exposing a new destination.


## الدفعة الرابعة — بيانات المريض وحجز الموعد

- تنظيم بيانات المريض في أقسام مرتبطة بروابط واضحة، وتسميات مستقلة لحقول الهاتف والتاريخ والتنبيهات الطبية.
- منع حفظ نموذج تعديل لم تُحمّل بياناته، مع رسالة خطأ وإعادة محاولة. الاحتفاظ بالمدخلات بعد رفض الحفظ ومنع تكرار الإرسال.
- فصل فشل جلب الأوقات عن عدم وجود أوقات، وتجاهل الاستجابات القديمة بعد تغيير التاريخ أو الطبيب، وإلغاء اختيار الوقت القديم فورًا.
- إضافة مراجعة بيانات الحجز قبل الإرسال، وإعادة تحميل الأوقات بعد تعارض الحجز.
- استخدام نافذة `dialog` أصلية لإضافة المريض داخل الحجز، مع عزل الخلفية، وتركيز الحقول، والإغلاق بـEscape واستعادة التركيز، ومنع الإغلاق أثناء الحفظ.

## الدفعة الخامسة — بقية عائلات الصفحات

- توحيد العناوين، والفلاتر ذات التسميات الدائمة، ومناطق الجداول القابلة للتمرير، والأزرار، والتركيز، وعرض الهاتف وتقليل الحركة عبر `workspace-foundations`.
- تطبيق هذه الأسس على العلاج والروشتات والكتالوجات والمالية والتقارير وCRM والمعمل والتأمين والمخزون والحجز الإلكتروني والإدارة والمساعدة والنسخ الاحتياطي.
- تمييز فشل تحميل سجلات الإيرادات والمدفوعات والمصروفات عن السجلات الفارغة، مع إعادة المحاولة.
- إصلاح تمدد نماذج الروشتة والمتابعة والفروع وكتالوج الأدوية على الهاتف، دون إخفاء المحتوى بقص الصفحة.
- تحسين إتاحة مدخلات الشاشات السريرية والزراعة، وحقول تسجيل الدخول واستعادة كلمة المرور، دون تغيير قواعد العلاج أو الحسابات.

## الدفعة السادسة — الموقع العام والتسليم

- تحسين عرض الحجز العام والتسجيل والتأكيد على الهاتف، وتباين نصوص الحجز، وتسميات نموذج طلب التواصل.
- تحويل بطاقات اختيار الطبيب والخدمة إلى أزرار أصلية، وإظهار حالة الاختيار ومراحل الحجز لقارئ الشاشة.
- انتظار تحميل الأطباء والخدمات معًا، وعرض رسالة فشل وإعادة محاولة، ومنع الحجز المتكرر وتجاهل نتائج الأوقات القديمة.
- إضافة رابط تخطي المحتوى ومؤشر تركيز وأحجام مدخلات وجداول متسقة إلى تخطيط إدارة المنصة. تشغيل Razor محليًا لم يُتحقق منه بسبب عدم توافر SDK المطلوب.
- تجهيز الرفع في worktree مستقل مبني على أحدث `origin/main`؛ تغييرات الـBackend المحلية وإعدادات النشر خارج حزمة الرفع.

### التحقق النهائي وحدوده

- نجحت اختبارات الواجهة المحلية: **267 اختبارًا لتطبيق العيادة**، و**12 اختبارًا للموقع العام**. نجح البناء وهذه الاختبارات أيضًا في نسخة الرفع المعزولة المبنية على أحدث main.
- نجح بناء Angular للتطبيقين؛ تحذير حجم `dental.scss` السابق ما زال موجودًا. لم تُرفع الحدود لإخفائه.
- نجح فحص **38 وجهة إضافية** باللغتين وعروض 1440 و768 و390 و320، دون تمدد أفقي أو استثناءات JavaScript؛ هذه بيانات فارغة اصطناعية، وليست اختبارًا لكل عملية كتابة في كل صفحة.
- نجحت فحوص الأطباء والخطط واللوحة وملف المريض، وفحص نماذج المريض والحجز، وفحص مسارات الموقع العام ببيانات اصطناعية.
- لم تُستخدم بيانات مرضى حقيقية، ولم يُنفذ نشر على السيرفر أو تعديل لقاعدة البيانات. اختبارات الخادم المتكاملة والتشغيل الفعلي لإدارة المنصة لا تُستنتج من نتائج Angular.
- تفاصيل إعادة التشغيل والقيود وملفات الإثبات في `frontend-release-verification.md`.
