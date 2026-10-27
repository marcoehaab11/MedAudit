# تقرير حماية الهوية والجلسات

تم التنفيذ محلياً بعد الموافقة. لم أنشر التغييرات على الموقع الحي ولم أغيّر بيانات عيادتك. أبقيت ASP.NET Core Identity لإدارة الحسابات وكلمات السر، دون نقل الحسابات إلى خدمة أخرى.

## ما تغير

- المتصفح لا يستعمل localStorage لإثبات الهوية أو الدور أو الصلاحيات. يجلب البيانات من `/api/auth/session` بعد التحقق.
- ملف الجلسة Cookie يحمل مرجعاً محمياً فقط، وبيانات الجلسة الفعلية محفوظة في Redis. علامة HttpOnly تمنع JavaScript من قراءة الملف. الجلسة 12 ساعة دون تمديد تلقائي.
- كل طلب خاص يعيد فحص الحساب وبصمة أمان كلمة السر والعضوية والعيادة والاشتراك. الأدوار والصلاحيات مصدرها قاعدة البيانات.
- جلسة مدير المنصة منفصلة؛ إزالة صلاحية المدير تمنع طلبه التالي حتى لو احتفظ بملف الجلسة القديم.
- الخروج يحذف الجلسة من الخادم. نسخة محفوظة من ملفها لا تعيد الدخول. تغيير كلمة السر يغيّر بصمة الأمان، فيُرفض استخدام الجلسات القديمة.
- كل مسار خادم خاص افتراضياً إلا الاستثناءات العامة المحددة. الإعدادات تطلب الدخول صراحةً.
- Nginx يسأل الخادم عن جلسة وصلاحية الصفحة قبل إرسال صفحات العيادة. حراس Angular والروابط المخفية مجرد تحسين للعرض.
- التعديلات عبر API تتطلب `X-App-Request: 1`، الذي يضيفه التطبيق تلقائياً لمنع نماذج من مواقع أخرى. العلامة ليست هوية أو كلمة سر؛ التحقق من الجلسة والصلاحية يظل مطلوباً. لا توجد سياسة تسمح للمواقع الأخرى بإرسال هذه الطلبات عبر المتصفح.
- خروج المدير يستخدم POST ونموذج ASP.NET المحمي. فتح رابط GET لا ينهي الجلسة.
- عرض اسم المريض وهاتفه في تأكيد الحجز يتطلب رمز إدارة صحيحاً ومتطابقاً مع الحجز. الرقم المرجعي وحده لا يكفي.

## الاستثناءات العامة التي وافقت عليها

- صفحات الموقع العام: `/`، `/register`، `/confirm-email`، `/book/{clinicSlug}`، وصفحة تأكيد الحجز التي لا تعرض التفاصيل دون السر.
- شاشات العيادة: `/login`، `/forgot-password`، `/reset-password`، `/accept-invitation`. دخول المنصة: `/Account/Login`.
- POST `/api/auth/login`، `/api/auth/forgot-password`، `/api/auth/reset-password`، `/api/auth/invitations/inspect` و`/api/auth/invitations/accept`.
- POST `/api/public/clinics/register`، `/api/public/clinics/confirm` و`/api/public/clinics/resend`.
- GET `/api/public/clinics/customers`، `/api/public/clinics/logos/{id}`، `/api/public/clinics/{slug}` وملحقاته `/qr` و`/doctors` و`/services` و`/availability`.
- POST `/api/public/clinics/{slug}/visits` و`/bookings` و`/inquiries`.
- `/api/public/bookings/manage/{managementToken}` وقراءة أوقاته وعمليات التأكيد والإلغاء وتغيير الوقت: لا تحتاج حساب موظف، لكنها تتطلب سر الرابط الذي يراجعه الخادم.
- GET `/api/public/bookings/confirmation/{reference}` يتطلب `manage` الصحيح والمتطابق، وإلا يرجع 404 دون بيانات المريض.
- `/health/live` و`/health/ready` والملفات الثابتة اللازمة للعرض.

لا توجد إجراءات Next.js منفصلة؛ الإجراءات هنا API ونماذج Razor Pages. العامل الخلفي لا يستقبل طلبات الإنترنت.

## الإعداد والنشر

لا تحتاج مفاتيح خارجية جديدة أو تعديلاً جديداً في `.env`. استخدمت Redis ومجلد مفاتيح Data Protection الموجودين بالفعل. لم أضف أو أرفع إصدار حزمة؛ أزلت فقط حزمة قبول JWT التي لم تعد مستخدمة.

انشر API والواجهتين ولوحة الإدارة وNginx معاً. المستخدمون الحاليون سيحتاجون تسجيل الدخول مجدداً، لأن رموز المتصفح القديمة لم تعد مقبولة. لا توجد تعديلات على جداول الحسابات ولا حاجة لترحيل كلمات السر.

بعد توفر Docker استخدم `docker compose up --build -d`، أو `docker compose --profile tunnel up --build -d` إذا كنت تستخدم النفق. حافظ على شبكة الخوادم الموثوقة من المهمة السابقة. لا تُظهر حاوية Angular مباشرة للإنترنت خارج Nginx.

الإنتاج يجب أن يستخدم HTTPS كما تشترط تعليمات المشروع؛ ملف الجلسة يأخذ Secure عند وصول الطلب عبر HTTPS، مع استمرار دعم HTTP محلياً. حافظ على Redis ومفاتيح Data Protection خاصة ومشتركة بين نسخ الخادم.

أوقفت التخزين دون اتصال للصفحات الخاصة، وأضفت بديلاً لعامل التخزين القديم لإلغائه. أعد تحميل علامات التبويب القديمة بعد نشر النسخة؛ الرموز القديمة لا تستطيع جلب بيانات خاصة. تعطل مخزن الجلسات يوقف الطلبات الخاصة بدلاً من قبول هوية غير متحقق منها.

## ثلاثة اختبارات بنفسك

1. **بعد الخروج:** اضغط خروج، ثم اكتب `/patients` مباشرة في عنوان العيادة. يجب الانتقال إلى `/login` قبل ظهور بيانات المرضى. طلب API خاص دون جلسة يرجع 401، أي تحتاج الدخول. نسخة ملف الجلسة القديمة تبقى مرفوضة بعد الخروج.
2. **حساب عادي وعنوان الإدارة:** في نافذة خاصة ادخل بحساب موظف، ثم افتح `https://admin.medaudit.online/admin/clinics` أو عنوان الإدارة المحلي. يجب ظهور `/Account/Login` دون بيانات الإدارة. بيانات الموظف لا تسمح بالدخول الإداري. داخل واجهة العيادة، `/users` يرجع 403 لمن لا يملك Users.View، أي ليست لديه صلاحية.
3. **تغيير رقمك في أدوات المتصفح:** افتح Application ثم Local Storage. أضف `user_id` برقم آخر و`roles` بقيمة `["PlatformAdmin"]` وصلاحيات مزيفة، ثم أعد التحميل. تظهر هويتك وصلاحياتك الحقيقية، وتُحذف القيم القديمة. لا تظهر بيانات شخص آخر ولا تُفتح الإدارة. تعديل ملف الجلسة المحمي نفسه يرفضه ولا يمنحك هوية بديلة.

## نتائج التحقق

- بناء .NET ناجح دون أخطاء أو تحذيرات. بناء الواجهتين ناجح؛ تحذير حجم تنسيق الأسنان يتعلق بملف لم أعدله.
- 213 اختباراً وحدوياً و3 اختبارات بنية للخادم نجحت.
- 10 اختبارات HTTP للجلسات نجحت باستخدام إجراءات التطبيق الحقيقية وPostgreSQL محلي جديد ومعزول. شملت إبطال نسخة الجلسة بعد الخروج، تجاهل الهوية والدور المزيفين، منع الموظف من الإدارة، سحب صلاحية المدير، تغيير بصمة كلمة السر، تغيير الصلاحيات، انتهاء الاشتراك، حماية التعديلات، سر الحجز، وفحص صلاحية الصفحة.
- في اختبارات HTTP كان مخزن تذاكر الجلسة داخل الذاكرة؛ بقيت نفس آلية Cookie والإبطال وفحوص قاعدة البيانات. أضفت اختبار Redis حقيقياً منفصلاً، لكنه يحتاج Docker غير المتاح حالياً.
- 13 اختباراً لواجهة الحساب والمواعيد والتنبيه وإطار التطبيق نجحت. 67 اختباراً للحساب والتنبيه والفحص السريري نجحت في تشغيل موجه، و7 اختبارات للحجز والتسجيل والتنبيه العامة نجحت.
- 7 فحوص Nginx محلية نجحت باستخدام بديل لخدمة قرار الصلاحية: التحويل للدخول، صفحة الدخول، قبول الجلسة المسموحة، رفض الصفحة غير المصرح بها، رفض ملف مزيف، منع تزييف عنوان الصفحة، وإلغاء عامل التخزين القديم. فحص الإعداد و`docker compose config --quiet` نجحا.
- الفحص العام للواجهات كشف اختبارات أخرى غير مكتملة: ActivatedRoute غائب من تجهيز اختبار الإعدادات، وgetChannels غائب من بديل خدمة الإشعارات، واختبار الترويسة العامة يبحث عن عنصر قديم. لم أغير تلك الشاشات أو الاختبارات. اختبار سريري تجاوز المهلة أثناء الفحص المتزامن ثم نجح ضمن ملفه منفرداً.
- بعد تشغيل Docker: `dotnet test tests/DentalClinic.IntegrationTests --configuration Release --filter FullyQualifiedName~RedisRequestLimitTests` لاختبار Redis، وفلتر `FullyQualifiedName~VerifiedSessionTests` لاختبارات الجلسات. يمكن تمرير `AUTH_TEST_POSTGRES` لخادم PostgreSQL اختباري معزول؛ تُنشأ قواعد جديدة بأسماء session_test_ بدلاً من استخدام قاعدة التطبيق.
- أوقفت قاعدة الاختبار المحلية. منع الفحص الآلي حذف مجلدها المؤقت `tmp/auth-session-postgres-data`، فتركته دون تشغيل. بقي مساعدا الاختبار المؤقتان أيضاً، وهما ليسا جزءاً من نشر التطبيق.

## كل ملفات المشروع التي تغيرت وأسبابها

| الملف | السبب |
|---|---|
| [src/DentalClinic.Infrastructure/Identity/ServerSessionStore.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/ServerSessionStore.cs>) | حفظ الجلسة في Redis وحذفها عند الخروج، حتى لا تعمل نسخة قديمة من ملف الجلسة. |
| [src/DentalClinic.Infrastructure/Identity/VerifiedSessionEvents.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/VerifiedSessionEvents.cs>) | مراجعة الحساب وبصمة أمان كلمة السر والعضوية والاشتراك والأدوار من قاعدة البيانات مع كل طلب. |
| [src/DentalClinic.Infrastructure/Identity/VerifiedSessionExtensions.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/VerifiedSessionExtensions.cs>) | ربط جلسات ASP.NET القياسية بمخزن الخادم والتحقق المشترك. |
| [src/DentalClinic.Infrastructure/Identity/ClinicSessionService.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/ClinicSessionService.cs>) | بدء الجلسة وقراءة هويتها الموثوقة وإبطال الجلسة القديمة عند تبديل الفرع. |
| [src/DentalClinic.Infrastructure/Identity/ClinicPageAccess.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/ClinicPageAccess.cs>) | تحديد صلاحيات الصفحات على الخادم ورفض الصفحات غير المعروفة افتراضياً. |
| [src/DentalClinic.Infrastructure/Identity/SessionSecurityMiddleware.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/SessionSecurityMiddleware.cs>) | منع حفظ الردود الخاصة، وحماية التعديلات من المواقع الأخرى، ورفض العمل دون مخزن جلسات متاح. |
| [src/DentalClinic.Infrastructure/Identity/ClinicAdminIdentityService.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/ClinicAdminIdentityService.cs>) | رفض حساب المدير والحساب المقفول عند دخول العيادة. |
| [src/DentalClinic.Infrastructure/Identity/JwtAccessTokenIssuer.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Identity/JwtAccessTokenIssuer.cs>) | إزالة مفتاح التوقيع الافتراضي المعروف من المصدر القديم، رغم توقف الدخول عن استخدامه. |
| [src/DentalClinic.Api/Extensions/AuthenticationExtensions.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Extensions/AuthenticationExtensions.cs>) | استبدال قبول رموز المتصفح بجلسة محمية وجعل التحقق مطلوباً افتراضياً. |
| [src/DentalClinic.Api/Program.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Program.cs>) | تشغيل حماية الجلسات مع إبقاء حدود الطلبات السابقة. |
| [src/DentalClinic.Api/Endpoints/IdentityEndpoints.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/IdentityEndpoints.cs>) | إضافة قراءة الجلسة والخروج وفحص الصفحات، وقصر الاستثناء العام على عمليات محددة. |
| [src/DentalClinic.Api/Endpoints/SettingsEndpoints.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/SettingsEndpoints.cs>) | اشتراط الدخول صراحةً لكل طلبات الإعدادات. |
| [src/DentalClinic.Api/Endpoints/PublicBookingEndpoints.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/PublicBookingEndpoints.cs>) | اشتراط رمز الإدارة الصحيح والمتطابق قبل إظهار تفاصيل المريض بالحجز. |
| [src/DentalClinic.Api/DentalClinic.Api.csproj](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/DentalClinic.Api.csproj>) | إزالة حزمة قبول JWT غير المستخدمة والسماح لاختبارات المشروع بفحص تعريفات API الداخلية. |
| [src/DentalClinic.Application/Identity/AuthenticationService.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Application/Identity/AuthenticationService.cs>) | التوقف عن إصدار رمز متصفح، مع إبقاء التحقق من كلمة السر والعضويات. |
| [src/DentalClinic.Application/Identity/Models/UserModels.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Application/Identity/Models/UserModels.cs>) | حذف رمز الدخول من نتيجة تسجيل الدخول. |
| [src/DentalClinic.PlatformAdmin/Program.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.PlatformAdmin/Program.cs>) | جلسة إدارة منفصلة وفحص المدير من قاعدة البيانات لكل طلب وقاعدة حماية افتراضية. |
| [src/DentalClinic.PlatformAdmin/Pages/Account/Login.cshtml.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.PlatformAdmin/Pages/Account/Login.cshtml.cs>) | استخدام مدير الدخول القياسي في Identity بدلاً من بناء هوية يدوية. |
| [src/DentalClinic.PlatformAdmin/Pages/Account/Logout.cshtml.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.PlatformAdmin/Pages/Account/Logout.cshtml.cs>) | الخروج بطلب POST محمي، وعدم تسجيل الخروج بمجرد فتح رابط. |
| [src/DentalClinic.PlatformAdmin/Pages/Shared/_Layout.cshtml](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.PlatformAdmin/Pages/Shared/_Layout.cshtml>) | تحويل زر الخروج إلى نموذج آمن دون إعادة تصميم الشاشة. |
| [frontend/dental-clinic-app/src/app/core/auth.service.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/auth.service.ts>) | جلب الهوية من الخادم، وتجاهل القيم المحلية وتنفيذ الخروج الفعلي على الخادم. |
| [frontend/dental-clinic-app/src/app/core/auth.interceptor.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/auth.interceptor.ts>) | إيقاف إرسال الرموز المحلية، وإضافة علامة طلب التطبيق ومسح الحالة عند رفض الجلسة. |
| [frontend/dental-clinic-app/src/app/core/auth.guard.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/auth.guard.ts>) | التحقق من الجلسة على الخادم قبل فتح المسار. |
| [frontend/dental-clinic-app/src/app/app.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/app.ts>) | انتظار نجاح الخروج وإعلام علامات التبويب الأخرى بتغير الجلسة. |
| [frontend/dental-clinic-app/src/app/app.config.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/app.config.ts>) | استعادة الجلسة عند بدء التطبيق وإلغاء عامل التخزين دون اتصال القديم. |
| [frontend/dental-clinic-app/src/app/core/request-limit.interceptor.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/request-limit.interceptor.ts>) | عرض رسالة واضحة عند تعذر التحقق من الجلسة أيضاً. |
| [frontend/dental-clinic-app/src/app/features/auth/login.component.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/features/auth/login.component.ts>) | تمييز تعطل خدمة التحقق عن خطأ كلمة السر. |
| [frontend/dental-clinic-app/src/app/features/patients/patient-dossier-modal.component.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/features/patients/patient-dossier-modal.component.ts>) | استخدام اسم العيادة القادم من الخادم في الطباعة بدلاً من التخزين المحلي. |
| [frontend/dental-clinic-app/angular.json](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/angular.json>) | إيقاف توليد عامل التخزين دون اتصال لصفحات العيادة الخاصة. |
| [frontend/dental-clinic-app/nginx.conf](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/nginx.conf>) | عدم تحويل ملف ثابت غير موجود إلى صفحة تطبيق قد تتجاوز فحص الصفحات. |
| [frontend/dental-clinic-public/src/app/core/request-limit.interceptor.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/core/request-limit.interceptor.ts>) | إضافة علامة الطلب للنماذج العامة وإظهار رسالة تعذر التحقق. |
| [frontend/dental-clinic-public/src/app/features/booking/booking-confirmation.component.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/features/booking/booking-confirmation.component.ts>) | عدم طلب تفاصيل المريض برقم الحجز وحده. |
| [frontend/dental-clinic-public/src/app/features/booking/booking-confirmation.component.spec.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/features/booking/booking-confirmation.component.spec.ts>) | اختبار عدم طلب البيانات دون سر إدارة الحجز. |
| [frontend/dental-clinic-app/src/app/core/auth.service.spec.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/auth.service.spec.ts>) | اختبار تجاهل الهوية المزيفة واستعادة الجلسة والخروج عبر الخادم. |
| [frontend/dental-clinic-app/src/app/features/appointments/appointments-page.component.spec.ts](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/features/appointments/appointments-page.component.spec.ts>) | تهيئة حالة موثوقة في الاختبار بدلاً من كتابة بيانات دخول في التخزين المحلي. |
| [tests/DentalClinic.IntegrationTests/VerifiedSessionTests.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/tests/DentalClinic.IntegrationTests/VerifiedSessionTests.cs>) | عشرة اختبارات HTTP فعلية على تعريفات التطبيق وقاعدة بيانات معزولة. |
| [tests/DentalClinic.IntegrationTests/RedisRequestLimitTests.cs](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/tests/DentalClinic.IntegrationTests/RedisRequestLimitTests.cs>) | اختبار إبطال مرجع الجلسة عبر عميلين مختلفين لـRedis. |
| [tests/DentalClinic.IntegrationTests/DentalClinic.IntegrationTests.csproj](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/tests/DentalClinic.IntegrationTests/DentalClinic.IntegrationTests.csproj>) | ربط الاختبارات بتعريفات API الحقيقية بدلاً من نسخ الحماية. |
| [deploy/nginx.conf](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/deploy/nginx.conf>) | فحص هوية وصلاحية الصفحة قبل تسليمها، ورفض تجاوزات الملفات الثابتة وإلغاء عامل التخزين القديم. |
| [README.md](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/README.md>) | تحديث وصف آلية الدخول والإشارة للتقرير الجديد. |
| [docs/authentication-hardening.md](<C:/Users/Marco Ehab/Documents/ChatGPT/MedDentist/docs/authentication-hardening.md>) | هذا التقرير وقائمة الملفات وخطوات الاختبار والتشغيل. |

## ما لا يزال خارج التأكيد

لم أنشر النسخة على الاستضافة الحية، ولم أشغل اختبار الجلسات على Redis الحقيقي بسبب غياب Docker. حماية تسليم ملفات Angular تعتمد على بوابة Nginx المرفقة. الصفحات العامة بقيت مفتوحة عمداً، وروابط المريض الخاصة تعتمد على سر الرابط؛ من يملكه يستطيع استعماله. هذه مهمة حماية الهوية والجلسات، وليست شهادة شاملة بخلو التطبيق كله من مشكلات الأمان.
