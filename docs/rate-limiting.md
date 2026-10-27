# حماية الطلبات — تقرير التنفيذ

تم تطبيق تحديد عدد الطلبات على API ولوحة إدارة المنصة. هذا يعني السماح بعدد محدد من الطلبات خلال مدة، ثم رفض الزائد مؤقتاً.
العدادات مشتركة في Redis، وهو مخزن سريع خارج ذاكرة التطبيق. هوية المتصل هي رقم المستخدم الموثوق بعد دخوله، وإلا عنوان IP؛ لا نثق برقم مستخدم يرسله العميل.
البريد المقدم للدخول واستعادة كلمة السر وإعادة التأكيد له عداد إضافي مستقل. نخزن بصمة HMAC، أي قيمة مشتقة بمفتاح سري، بدلاً من البريد أو عنوان IP نفسه في اسم العداد.

## الإعداد والتشغيل

- أُنشئ المفتاح `RATE_LIMIT_KEY_SECRET` تلقائياً في `.env` المحلي. لا تنشر قيمته أو تضفه إلى Git.
- لا تحتاج حساباً أو مفتاحاً من Upstash. Redis الموجود في Docker مستخدم بالفعل، ولا توجد حزم جديدة أو ترقيات.
- عند نقل التطبيق لخادم آخر، أضف `RATE_LIMIT_KEY_SECRET` إلى ملف `.env` الخاص بذلك الخادم. يجب أن يكون هو نفسه لنسخ API ولوحة الإدارة؛ لا تغيّره عند كل تشغيل لأن تغييره يبدأ عدادات جديدة.
- لإنشاء قيمة جديدة عند أول إعداد فقط، شغّل PowerShell: `[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))` وانسخ الناتج إلى قيمة المفتاح. لا تنشر الناتج.
- Docker يمرر القيمة إلى إعداد `RateLimiting__KeySecret` تلقائياً. عند التشغيل خارج Docker يجب تمرير هذا الإعداد و`ConnectionStrings__Redis` من بيئة التشغيل.
- Nginx عنوانه الخاص `172.30.74.10` والنفق الاختياري عنوانه `172.30.74.11`، داخل `172.30.74.0/24`. تأكد أن الشبكة لا تتعارض مع شبكات الخادم. عند تغييرها، عدّل القيم المتطابقة في Compose وNginx.
- لا يُقبل عنوان Cloudflare إلا من حاوية النفق، ولا يقبل الخادمان بيانات العنوان المحوّلة إلا من Nginx. أي وسيط خارجي إضافي يحتاج ضبطاً صريحاً.
- لوجود تغيير في شبكة Docker، النشر على تشغيل قائم يحتاج إعادة إنشاء الشبكة مع توقف قصير: `docker compose down` ثم `docker compose up --build -d`. لا تستخدم `down -v`؛ الخيار `-v` يحذف وحدات تخزين البيانات.
- إذا كنت تستخدم ملف النفق الاختياري، احتفظ بتفعيله عند إعادة التشغيل: `docker compose --profile tunnel up --build -d`.
- لم أوقف أو أعد تشغيل خدماتك، ولم أنشر التغييرات على الموقع الحي.

## الحدود المطبقة

| العملية | الحد |
|---|---|
| حاجز عام قبل فحص محتوى الطلب | 600 طلب/دقيقة لكل مستخدم موثوق، وإلا IP |
| الدخول، API ولوحة الإدارة معاً | 10 محاولات/15 دقيقة لكل بريد؛ و30/15 دقيقة لكل متصل |
| إنشاء عيادة | 5/ساعة لكل متصل |
| استعادة كلمة السر أو إعادة رسالة التأكيد | لكل عملية: 3/ساعة لكل بريد؛ و10/ساعة لكل متصل |
| تأكيد البريد، تعيين كلمة السر برابط، قبول الدعوة | لكل عملية: 10/15 دقيقة لكل متصل |
| فحص الدعوة | 30/15 دقيقة لكل متصل |
| تغيير العيادة الحالية | 30/15 دقيقة لكل مستخدم |
| إنشاء حجز أو استفسار اتصال | لكل عملية: 5/ساعة لكل متصل |
| تأكيد/إلغاء/تغيير وقت الحجز | لكل عملية: 10/ساعة لكل متصل |
| تسجيل زيارة صفحة الحجز | 30/دقيقة لكل متصل |
| القراءة العامة | 120/دقيقة مشتركة لكل متصل |
| القراءة المعتادة بعد الدخول | 300/دقيقة مشتركة لكل مستخدم |
| الكتابة المعتادة | 120/دقيقة مشتركة لكل مستخدم |
| حسابات وصلاحيات وفروع | 30/ساعة مشتركة لكل مستخدم |
| إنشاء حساب أو دعوة | 10/ساعة مشتركة لكل مستخدم |
| حسابات إدارة المنصة الجديدة | 10/ساعة لكل مدير |
| تعديلات إدارة المنصة الأخرى | 30/ساعة مشتركة لكل مدير |
| إرسال بريد تجريبي وإعادة محاولة إرساله | 5/ساعة مشتركة لكل مدير |
| التقارير وتوليد مستندات الوصفات | 30/دقيقة مشتركة لكل مستخدم |
| تصدير التقارير والنسخ الاحتياطي والاستعادة | 5/15 دقيقة مشتركة لكل مستخدم |
| فحوصات حياة/جاهزية الخادم | 120/دقيقة لكل IP في كل عملية خادم، مستقلة عن Redis |
| بوابة API عبر Nginx | 30/ثانية لكل IP، وسماح مؤقت بـ20 طلباً إضافياً |
| الصفحات والملفات عبر Nginx | 100/ثانية لكل IP، وسماح مؤقت بـ200 طلب إضافي |

الطلبات الناجحة والفاشلة تُحسب. تبدأ المدة مع أول طلب مسموح؛ المحاولات المرفوضة لا تعيد بدء مهلة الحد المحدد.
رمز HTTP 429 يعني «طلبات أكثر من المسموح». يتضمن الرد `Retry-After`، وهي مدة الانتظار بالثواني، ورسالة عربية وإنجليزية. بوابة Nginx قد ترفض الطفرات السريعة بمدة انتظار ثانية واحدة.
تعطل Redis يوقف العمليات المحمية برسالة واضحة ورمز HTTP 503، أي أن الخدمة غير متاحة مؤقتاً. فحوصات الحياة مستقلة حتى لا يؤدي تعطل Redis إلى إعادة تشغيل الخادم؛ تبقى محمية بحد محلي وبوابة Nginx.

## اختبار يدوي آمن

بعد تشغيل النسخة المعدلة مع Redis:

1. افتح شاشة دخول العيادة في نافذة خاصة حتى لا تحمل جلسة مستخدم مسجل.
2. أدخل `rate-limit-check@example.invalid` وكلمة سر غير صحيحة من 12 حرفاً على الأقل. لا تحتاج لإنشاء هذا الحساب.
3. اضغط «تسجيل الدخول» 11 مرة، وانتظر انتهاء الطلب بين كل ضغطة، بمعدل مرة كل ثانية أو ثانيتين، لتتم كلها خلال دقيقة.
4. أول 10 محاولات تُظهر خطأ البريد/كلمة السر. في المحاولة 11 تظهر رسالة «طلبات كثيرة جدًا. انتظر … ثانية ثم حاول مرة أخرى». تكون المدة قرابة 900 ثانية ناقص الوقت المنقضي منذ أول محاولة.
5. في أدوات المتصفح، تبويب Network، أي سجل الطلبات، سيكون رد طلب login هو 429 ومعه `Retry-After`.
6. أعد تحميل الصفحة وحاول مرة أخرى: يستمر الحظر. بعد انتهاء المدة يعود رد بيانات الدخول غير الصحيحة المعتاد.

لا تختبر بإنشاء حجوزات أو حسابات حقيقية متكررة، ولا تضغط إعادة إرسال بريد للتجربة؛ اختبار الدخول أعلاه كافٍ ولا يرسل رسائل.

## التحقق الآلي

- بناء الواجهتين نجح. واجهة العيادة لها تحذير سابق عن حجم ملف تنسيق الأسنان؛ لم أعدّل هذا الملف.
- اختبارات .NET الوحدوية: 213 ناجحة في التشغيل الكامل، بما فيها الحماية الجديدة.
- اختبارات تنبيه الانتظار: 3 ناجحة لكل واجهة، و3 اختبارات تسجيل عامة ناجحة، و3 اختبارات بنية الخادم ناجحة.
- فحص إعداد Nginx نجح باستخدام نسخة اختبار محلية، وفحص `docker compose config --quiet` نجح.
- اختبار Redis الحقيقي مكتوب في `RedisRequestLimitTests.cs`، ويشغل حاوية Redis معزولة لا تستخدم قاعدة بياناتك. لا يمكن تشغيله حالياً لأن محرك Docker غير متاح. بعد تشغيل Docker: `dotnet test tests/DentalClinic.IntegrationTests --configuration Release --filter FullyQualifiedName~RedisRequestLimitTests`.
- لم تُختبر تغييرات الشبكة على الاستضافة الحية. لم تُشغّل مجموعة اختبارات قواعد البيانات الكاملة لأنها تحتاج Docker أيضاً.

## الملفات التي تغيرت وأسبابها

| الملف | السبب |
|---|---|
| [src/DentalClinic.Infrastructure/Security/RequestLimitStore.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Security/RequestLimitStore.cs) | حفظ وفحص العدّادات في Redis بخطوة واحدة؛ الطلب المرفوض لا يمدد مدة الحظر. |
| [src/DentalClinic.Infrastructure/Security/RequestLimitPolicy.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Security/RequestLimitPolicy.cs) | اختيار حدود كل نوع من العمليات مع حد افتراضي للمسارات الجديدة. |
| [src/DentalClinic.Infrastructure/Security/RequestLimitMiddleware.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Security/RequestLimitMiddleware.cs) | تطبيق الحدود قبل العمليات؛ تحديد المستخدم؛ حماية البريد ببصمة سرية؛ وإرجاع 429 أو 503 ورسالة ومدة انتظار. |
| [src/DentalClinic.Infrastructure/Security/RequestProtectionExtensions.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Infrastructure/Security/RequestProtectionExtensions.cs) | تسجيل الحماية وقصر الثقة في بيانات عنوان المستخدم على الخادم الوسيط المحدد. |
| [src/DentalClinic.Api/Program.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Program.cs) | تشغيل الحماية المشتركة لكل طلب بدلاً من العدادات القديمة في الذاكرة. |
| [src/DentalClinic.PlatformAdmin/Program.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.PlatformAdmin/Program.cs) | تشغيل نفس الحماية في لوحة إدارة المنصة. |
| [src/DentalClinic.Api/Endpoints/IdentityEndpoints.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/IdentityEndpoints.cs) | إزالة ربط الحدود القديمة بعد استبدالها بالحماية المشتركة. |
| [src/DentalClinic.Api/Endpoints/OnboardingEndpoints.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/OnboardingEndpoints.cs) | إزالة ربط الحدود القديمة للتسجيل واستعادة كلمة السر بعد استبدالها. |
| [src/DentalClinic.Api/Endpoints/PublicBookingEndpoints.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/PublicBookingEndpoints.cs) | إزالة ربط الحدود القديمة للحجز بعد استبدالها. |
| [src/DentalClinic.Api/Endpoints/ReportEndpoints.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/src/DentalClinic.Api/Endpoints/ReportEndpoints.cs) | استبدال الحصة المشتركة لكل عيادة بحصة التصدير لكل مستخدم. |
| [deploy/nginx.conf](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/deploy/nginx.conf) | تغطية الملفات والصفحات بحدود، إرجاع 429، منع تزييف عنوان المستخدم، وإزالة مهلة مكررة رفضها فحص Nginx. |
| [docker-compose.yml](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/docker-compose.yml) | تمرير المفتاح السري للخدمتين وتثبيت عنوان Nginx وعنوان النفق داخل شبكة Docker الخاصة. |
| [.env](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/.env) | إنشاء RATE_LIMIT_KEY_SECRET عشوائي محلياً؛ الملف خاص وغير مضاف إلى Git. |
| [.env.example](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/.env.example) | توثيق المفتاح المطلوب دون تخزين قيمته السرية. |
| [frontend/dental-clinic-app/src/app/app.config.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/app.config.ts) | تفعيل تنبيه الحماية في جميع طلبات واجهة العيادة. |
| [frontend/dental-clinic-public/src/app/app.config.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/app.config.ts) | تفعيل تنبيه الحماية في جميع طلبات الواجهة العامة. |
| [frontend/dental-clinic-app/src/app/core/request-limit.interceptor.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/request-limit.interceptor.ts) | عرض رسالة الانتظار الفعلية بالعربية أو الإنجليزية دون إخفاء خطأ الطلب. |
| [frontend/dental-clinic-public/src/app/core/request-limit.interceptor.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/core/request-limit.interceptor.ts) | عرض نفس التنبيه في الموقع العام، بما يشمل الحجز وطلبات الاتصال. |
| [frontend/dental-clinic-app/src/app/features/auth/login.component.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/features/auth/login.component.ts) | تمييز تجاوز الحد عن خطأ كلمة السر في شاشة الدخول. |
| [frontend/dental-clinic-app/src/app/features/auth/password-recovery.component.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/features/auth/password-recovery.component.ts) | عرض مدة الانتظار من الخادم بدلاً من اقتراح الانتظار دقيقة ثابتة. |
| [frontend/dental-clinic-public/src/app/features/registration/clinic-registration.component.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/features/registration/clinic-registration.component.ts) | عرض رسالة الحظر الفعلية في التسجيل وإعادة إرسال التأكيد. |
| [frontend/dental-clinic-app/src/app/core/request-limit.interceptor.spec.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-app/src/app/core/request-limit.interceptor.spec.ts) | اختبارات التنبيه ومدة الانتظار وعدم التأثير على الأخطاء الأخرى. |
| [frontend/dental-clinic-public/src/app/core/request-limit.interceptor.spec.ts](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/frontend/dental-clinic-public/src/app/core/request-limit.interceptor.spec.ts) | اختبارات نفس التنبيه في الموقع العام. |
| [tests/DentalClinic.UnitTests/RequestProtectionTests.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/tests/DentalClinic.UnitTests/RequestProtectionTests.cs) | اختبارات اختيار الحدود، الحسابات والعناوين، انتهاء المهلة، سلامة محتوى الطلب، والثقة في الخادم الوسيط. |
| [tests/DentalClinic.IntegrationTests/RedisRequestLimitTests.cs](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/tests/DentalClinic.IntegrationTests/RedisRequestLimitTests.cs) | اختبار Redis حقيقي داخل حاوية منفصلة: التزامن بين خادمين، انتهاء العدادات وعدم تمديد الحظر. |
| [docs/rate-limiting.md](C:/Users/Marco%20Ehab/Documents/ChatGPT/MedDentist/docs/rate-limiting.md) | هذا التقرير: الإعداد والتجربة وجرد جميع المسارات والملفات. |

## جرد واجهات API

GET يقرأ البيانات؛ POST ينفذ إجراء؛ PUT يغيّر بيانات؛ DELETE يحذفها. القيم بين الأقواس مثل `{id:guid}` تتغير حسب السجل. «بحساب» يعني أن الخادم يطلب تسجيل الدخول والصلاحيات؛ الحماية لا تُلغِي هذه الشروط. HIGH = مرتفع، MEDIUM = متوسط، LOW = منخفض.

| الطريقة والمسار | الوظيفة | الوصول | المخاطرة |
|---|---|---|---|
| `GET /api/appointments` | قراءة/بحث: المواعيد | بحساب | MEDIUM |
| `GET /api/appointments/availability` | قراءة/بحث: المواعيد | بحساب | MEDIUM |
| `GET /api/appointments/{id:guid}` | قراءة/بحث: المواعيد | بحساب | MEDIUM |
| `POST /api/appointments` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `PUT /api/appointments/{id:guid}/reschedule` | تعديل: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/confirm` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/cancel` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/check-in` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/start` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/complete` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `POST /api/appointments/{id:guid}/no-show` | إجراء/إنشاء: المواعيد | بحساب | HIGH |
| `GET /api/backups/modules` | قراءة/بحث: النسخ الاحتياطي | بحساب | MEDIUM |
| `POST /api/backups/export` | إجراء/إنشاء: النسخ الاحتياطي | بحساب | HIGH |
| `POST /api/backups/export-clinic` | إجراء/إنشاء: النسخ الاحتياطي | بحساب | HIGH |
| `GET /api/branches` | قراءة/بحث: الفروع | بحساب | MEDIUM |
| `GET /api/branches/summary` | قراءة/بحث: الفروع | بحساب | MEDIUM |
| `GET /api/branches/theme` | قراءة/بحث: الفروع | بحساب | MEDIUM |
| `PUT /api/branches/theme` | تعديل: الفروع | بحساب | HIGH |
| `POST /api/branches` | إجراء/إنشاء: الفروع | بحساب | HIGH |
| `PUT /api/branches/{branchId:guid}/status` | تعديل: الفروع | بحساب | HIGH |
| `POST /api/branches/{targetBranchId:guid}/staff/{sourceUserId:guid}/transfer` | إجراء/إنشاء: الفروع | بحساب | HIGH |
| `POST /api/branches/{targetBranchId:guid}/patients/{sourcePatientId:guid}/transfer` | إجراء/إنشاء: الفروع | بحساب | HIGH |
| `GET /api/branches/patients/{targetPatientId:guid}/transfer-history` | قراءة/بحث: الفروع | بحساب | MEDIUM |
| `GET /api/lab/vendors` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/lab/vendors` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/lab/cases` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/lab/cases` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `POST /api/lab/cases/{id:guid}/status` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/lab/statements` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/lab/statements` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/lab/statements/{id:guid}` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/lab/statements/{id:guid}/payments` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/lab/cases/{id:guid}/history` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/lab/cases/{id:guid}/documents` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/lab/cases/{id:guid}/documents` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/lab/documents/{id:guid}` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/insurance/payers` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/payers` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/insurance/policies` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/policies` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/insurance/claims` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/insurance/summary` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/insurance/claims/{id:guid}` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/claims` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `POST /api/insurance/claims/{id:guid}/status` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/insurance/claims/{id:guid}/history` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/insurance/claims/{id:guid}/documents` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/claims/{id:guid}/documents` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/insurance/documents/{id:guid}` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `GET /api/insurance/batches` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/batches` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/insurance/batches/{id:guid}` | قراءة/بحث: المعامل والتأمين | بحساب | MEDIUM |
| `POST /api/insurance/settlements` | إجراء/إنشاء: المعامل والتأمين | بحساب | HIGH |
| `GET /api/crm/dashboard` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `GET /api/crm/users` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `GET /api/crm/follow-ups` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `GET /api/crm/follow-ups/{id:guid}` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `POST /api/crm/follow-ups` | إجراء/إنشاء: متابعة المرضى | بحساب | HIGH |
| `PUT /api/crm/follow-ups/{id:guid}` | تعديل: متابعة المرضى | بحساب | HIGH |
| `POST /api/crm/follow-ups/{id:guid}/assign` | إجراء/إنشاء: متابعة المرضى | بحساب | HIGH |
| `POST /api/crm/follow-ups/{id:guid}/{action}` | إجراء/إنشاء: متابعة المرضى | بحساب | HIGH |
| `GET /api/crm/patients/{patientId:guid}` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `GET /api/crm/patients/{patientId:guid}/activities` | قراءة/بحث: متابعة المرضى | بحساب | MEDIUM |
| `POST /api/crm/activities` | إجراء/إنشاء: متابعة المرضى | بحساب | HIGH |
| `GET /api/patients/{patientId:guid}/dental` | قراءة/بحث: الفحوصات والسجل السني | بحساب | MEDIUM |
| `GET /api/patients/{patientId:guid}/examinations` | قراءة/بحث: الفحوصات والسجل السني | بحساب | MEDIUM |
| `GET /api/examinations/{id:guid}` | قراءة/بحث: الفحوصات والسجل السني | بحساب | MEDIUM |
| `GET /api/appointments/{appointmentId:guid}/examination` | قراءة/بحث: الفحوصات والسجل السني | بحساب | MEDIUM |
| `POST /api/appointments/{appointmentId:guid}/examination` | إجراء/إنشاء: الفحوصات والسجل السني | بحساب | HIGH |
| `PUT /api/examinations/{id:guid}` | تعديل: الفحوصات والسجل السني | بحساب | HIGH |
| `POST /api/examinations/{id:guid}/findings` | إجراء/إنشاء: الفحوصات والسجل السني | بحساب | HIGH |
| `PUT /api/examinations/{id:guid}/findings/{itemId:guid}` | تعديل: الفحوصات والسجل السني | بحساب | HIGH |
| `DELETE /api/examinations/{id:guid}/findings/{itemId:guid}` | حذف: الفحوصات والسجل السني | بحساب | HIGH |
| `POST /api/examinations/{id:guid}/procedures` | إجراء/إنشاء: الفحوصات والسجل السني | بحساب | HIGH |
| `PUT /api/examinations/{id:guid}/procedures/{itemId:guid}` | تعديل: الفحوصات والسجل السني | بحساب | HIGH |
| `DELETE /api/examinations/{id:guid}/procedures/{itemId:guid}` | حذف: الفحوصات والسجل السني | بحساب | HIGH |
| `POST /api/examinations/{id:guid}/endodontic` | إجراء/إنشاء: الفحوصات والسجل السني | بحساب | HIGH |
| `PUT /api/examinations/{id:guid}/endodontic/{itemId:guid}` | تعديل: الفحوصات والسجل السني | بحساب | HIGH |
| `DELETE /api/examinations/{id:guid}/endodontic/{itemId:guid}` | حذف: الفحوصات والسجل السني | بحساب | HIGH |
| `POST /api/examinations/{id:guid}/complete` | إجراء/إنشاء: الفحوصات والسجل السني | بحساب | HIGH |
| `GET /api/doctors/lookup` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `GET /api/doctors` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `GET /api/doctors/candidates` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `GET /api/doctors/{id:guid}` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `POST /api/doctors` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `PUT /api/doctors/{id:guid}` | تعديل: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/activate` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/deactivate` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/archive` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `DELETE /api/doctors/{id:guid}` | حذف: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/restore` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/unarchive` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `GET /api/doctors/{id:guid}/schedule` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `PUT /api/doctors/{id:guid}/schedule` | تعديل: الأطباء والجداول | بحساب | HIGH |
| `GET /api/doctors/{id:guid}/compensation` | قراءة/بحث: الأطباء والجداول | بحساب | MEDIUM |
| `POST /api/doctors/{id:guid}/compensation` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `POST /api/doctors/{id:guid}/compensation/change` | إجراء/إنشاء: الأطباء والجداول | بحساب | HIGH |
| `GET /api/finance/my-dues` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `GET /api/finance/billing-queue` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `GET /api/finance/dashboard` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `GET /api/finance/categories` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `POST /api/finance/categories` | إجراء/إنشاء: الحسابات المالية | بحساب | HIGH |
| `PUT /api/finance/categories/{id:guid}` | تعديل: الحسابات المالية | بحساب | HIGH |
| `POST /api/finance/categories/{id:guid}/status` | إجراء/إنشاء: الحسابات المالية | بحساب | HIGH |
| `GET /api/finance/revenue` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `GET /api/finance/revenue/{id:guid}` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `GET /api/finance/payments` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `POST /api/finance/payments` | إجراء/إنشاء: الحسابات المالية | بحساب | HIGH |
| `GET /api/finance/expenses` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `POST /api/finance/expenses` | إجراء/إنشاء: الحسابات المالية | بحساب | HIGH |
| `GET /api/finance/patients/{patientId:guid}/balance` | قراءة/بحث: الحسابات المالية | بحساب | MEDIUM |
| `POST /api/auth/login` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | عام | HIGH |
| `POST /api/auth/switch-clinic` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `GET /api/auth/clinics` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `POST /api/auth/invitations/inspect` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | عام | MEDIUM |
| `POST /api/auth/invitations/accept` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | عام | HIGH |
| `GET /api/auth/permissions` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `GET /api/users` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `GET /api/users/{id:guid}` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `POST /api/users` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `POST /api/users/invitations` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `PUT /api/users/{id:guid}` | تعديل: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `POST /api/users/{id:guid}/activate` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `POST /api/users/{id:guid}/deactivate` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `PUT /api/users/{id:guid}/roles` | تعديل: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `PUT /api/users/{id:guid}/permissions` | تعديل: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `GET /api/roles` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `GET /api/roles/permission-catalog` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `GET /api/roles/{id:guid}` | قراءة/بحث: الحسابات والصلاحيات والدعوات | بحساب | MEDIUM |
| `POST /api/roles` | إجراء/إنشاء: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `PUT /api/roles/{id:guid}` | تعديل: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `PUT /api/roles/{id:guid}/permissions` | تعديل: الحسابات والصلاحيات والدعوات | بحساب | HIGH |
| `GET /api/inventory/summary` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `GET /api/inventory/categories` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `POST /api/inventory/categories` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `PUT /api/inventory/categories/{id:guid}` | تعديل: المخزون | بحساب | HIGH |
| `GET /api/inventory/suppliers` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `POST /api/inventory/suppliers` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `PUT /api/inventory/suppliers/{id:guid}` | تعديل: المخزون | بحساب | HIGH |
| `GET /api/inventory/items` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `GET /api/inventory/items/{id:guid}` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `POST /api/inventory/items` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `PUT /api/inventory/items/{id:guid}` | تعديل: المخزون | بحساب | HIGH |
| `GET /api/inventory/movements` | قراءة/بحث: المخزون | بحساب | MEDIUM |
| `POST /api/inventory/receive` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `POST /api/inventory/issue` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `POST /api/inventory/adjust` | إجراء/إنشاء: المخزون | بحساب | HIGH |
| `GET /api/notifications` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `GET /api/notifications/unread-count` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `POST /api/notifications/{id:guid}/read` | إجراء/إنشاء: الإشعارات | بحساب | HIGH |
| `POST /api/notifications/read-all` | إجراء/إنشاء: الإشعارات | بحساب | HIGH |
| `GET /api/notifications/templates` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `POST /api/notifications/templates` | إجراء/إنشاء: الإشعارات | بحساب | HIGH |
| `GET /api/notifications/preferences` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `POST /api/notifications/preferences` | إجراء/إنشاء: الإشعارات | بحساب | HIGH |
| `GET /api/notifications/deliveries` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `GET /api/notifications/channels` | قراءة/بحث: الإشعارات | بحساب | MEDIUM |
| `POST /api/notifications/test-in-app` | إجراء/إنشاء: الإشعارات | بحساب | HIGH |
| `POST /api/public/clinics/register` | إجراء/إنشاء: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | HIGH |
| `POST /api/public/clinics/confirm` | إجراء/إنشاء: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | HIGH |
| `POST /api/public/clinics/resend` | إجراء/إنشاء: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | HIGH |
| `GET /api/public/clinics/customers` | قراءة/بحث: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | MEDIUM |
| `GET /api/public/clinics/logos/{id:guid}` | قراءة/بحث: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | MEDIUM |
| `POST /api/auth/forgot-password` | إجراء/إنشاء: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | HIGH |
| `POST /api/auth/reset-password` | إجراء/إنشاء: إنشاء العيادة وتأكيد البريد واستعادة كلمة السر | عام | HIGH |
| `GET /api/online-booking/staff` | قراءة/بحث: متابعة الحجز الإلكتروني | بحساب | MEDIUM |
| `GET /api/online-booking/summary` | قراءة/بحث: متابعة الحجز الإلكتروني | بحساب | MEDIUM |
| `GET /api/online-booking/requests` | قراءة/بحث: متابعة الحجز الإلكتروني | بحساب | MEDIUM |
| `GET /api/online-booking/inquiries` | قراءة/بحث: متابعة الحجز الإلكتروني | بحساب | MEDIUM |
| `POST /api/online-booking/inquiries/{id:guid}/contacted` | إجراء/إنشاء: متابعة الحجز الإلكتروني | بحساب | HIGH |
| `PUT /api/online-booking/inquiries/{id:guid}/follow-up` | تعديل: متابعة الحجز الإلكتروني | بحساب | HIGH |
| `PUT /api/online-booking/requests/{id:guid}/follow-up` | تعديل: متابعة الحجز الإلكتروني | بحساب | HIGH |
| `POST /api/online-booking/requests/{id:guid}/contacted` | إجراء/إنشاء: متابعة الحجز الإلكتروني | بحساب | HIGH |
| `GET /api/patients` | قراءة/بحث: ملفات المرضى | بحساب | MEDIUM |
| `GET /api/patients/{id:guid}` | قراءة/بحث: ملفات المرضى | بحساب | MEDIUM |
| `POST /api/patients` | إجراء/إنشاء: ملفات المرضى | بحساب | HIGH |
| `PUT /api/patients/{id:guid}` | تعديل: ملفات المرضى | بحساب | HIGH |
| `POST /api/patients/{id:guid}/archive` | إجراء/إنشاء: ملفات المرضى | بحساب | HIGH |
| `PUT /api/patients/{id:guid}/medical-notes` | تعديل: ملفات المرضى | بحساب | HIGH |
| `POST /api/patients/{id:guid}/medications` | إجراء/إنشاء: ملفات المرضى | بحساب | HIGH |
| `PUT /api/patients/{id:guid}/medications/{itemId:guid}` | تعديل: ملفات المرضى | بحساب | HIGH |
| `DELETE /api/patients/{id:guid}/medications/{itemId:guid}` | حذف: ملفات المرضى | بحساب | HIGH |
| `POST /api/patients/{id:guid}/surgeries` | إجراء/إنشاء: ملفات المرضى | بحساب | HIGH |
| `PUT /api/patients/{id:guid}/surgeries/{itemId:guid}` | تعديل: ملفات المرضى | بحساب | HIGH |
| `DELETE /api/patients/{id:guid}/surgeries/{itemId:guid}` | حذف: ملفات المرضى | بحساب | HIGH |
| `GET /api/pharmacy/dashboard` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `GET /api/pharmacy/dispensings` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `GET /api/pharmacy/dispensings/{id:guid}` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `GET /api/pharmacy/prescriptions` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `GET /api/pharmacy/prescriptions/{id:guid}` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `POST /api/pharmacy/prescriptions/{id:guid}/dispense` | إجراء/إنشاء: صرف الأدوية | بحساب | HIGH |
| `POST /api/pharmacy/dispensings/{id:guid}/reverse` | إجراء/إنشاء: صرف الأدوية | بحساب | HIGH |
| `GET /api/pharmacy/catalog` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `POST /api/pharmacy/catalog/{id:guid}/inventory-mapping` | إجراء/إنشاء: صرف الأدوية | بحساب | HIGH |
| `GET /api/pharmacy/patients/{patientId:guid}/history` | قراءة/بحث: صرف الأدوية | بحساب | MEDIUM |
| `GET /api/medications` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `POST /api/medications` | إجراء/إنشاء: الأدوية والوصفات | بحساب | HIGH |
| `PUT /api/medications/{id:guid}` | تعديل: الأدوية والوصفات | بحساب | HIGH |
| `DELETE /api/medications/{id:guid}` | حذف: الأدوية والوصفات | بحساب | HIGH |
| `GET /api/prescriptions` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `GET /api/prescriptions/{id:guid}` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `POST /api/prescriptions` | إجراء/إنشاء: الأدوية والوصفات | بحساب | HIGH |
| `PUT /api/prescriptions/{id:guid}` | تعديل: الأدوية والوصفات | بحساب | HIGH |
| `POST /api/prescriptions/{id:guid}/items` | إجراء/إنشاء: الأدوية والوصفات | بحساب | HIGH |
| `PUT /api/prescriptions/{id:guid}/items/{itemId:guid}` | تعديل: الأدوية والوصفات | بحساب | HIGH |
| `DELETE /api/prescriptions/{id:guid}/items/{itemId:guid}` | حذف: الأدوية والوصفات | بحساب | HIGH |
| `POST /api/prescriptions/{id:guid}/issue` | إجراء/إنشاء: الأدوية والوصفات | بحساب | HIGH |
| `POST /api/prescriptions/{id:guid}/cancel` | إجراء/إنشاء: الأدوية والوصفات | بحساب | HIGH |
| `GET /api/prescriptions/{id:guid}/document` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `GET /api/prescriptions/{id:guid}/print` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `GET /api/prescriptions/{id:guid}/qr` | قراءة/بحث: الأدوية والوصفات | بحساب | MEDIUM |
| `GET /api/public/clinics/{slug}/qr` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `GET /api/public/clinics/{slug}` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `POST /api/public/clinics/{slug}/visits` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `GET /api/public/clinics/{slug}/doctors` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `GET /api/public/clinics/{slug}/services` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `GET /api/public/clinics/{slug}/availability` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `POST /api/public/clinics/{slug}/bookings` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `POST /api/public/clinics/{slug}/inquiries` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `GET /api/public/bookings/confirmation/{reference}` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `GET /api/public/bookings/manage/{managementToken}` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `GET /api/public/bookings/manage/{managementToken}/availability` | قراءة/بحث: الحجز العام وطلبات الاتصال | عام | MEDIUM |
| `POST /api/public/bookings/manage/{managementToken}/confirm` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `POST /api/public/bookings/manage/{managementToken}/cancel` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `POST /api/public/bookings/manage/{managementToken}/reschedule` | إجراء/إنشاء: الحجز العام وطلبات الاتصال | عام | HIGH |
| `GET /api/reports/dashboard` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/financial` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/revenue` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/expenses` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/profit` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/patients` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/appointments` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/doctors` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/treatments` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/prescriptions` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/crm` | قراءة/بحث: التقارير والتصدير | بحساب | MEDIUM |
| `GET /api/reports/export/{reportType}` | قراءة/بحث: التقارير والتصدير | بحساب | HIGH |
| `GET /api/settings` | قراءة/بحث: الإعدادات | بحساب | MEDIUM |
| `PUT /api/settings/clinic-profile` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/branding` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/timezone-currency` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/appointments` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/prescriptions` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/notifications` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/inventory` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/pharmacy` | تعديل: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/finance` | تعديل: الإعدادات | بحساب | HIGH |
| `GET /api/settings/hours` | قراءة/بحث: الإعدادات | بحساب | MEDIUM |
| `PUT /api/settings/hours` | تعديل: الإعدادات | بحساب | HIGH |
| `GET /api/settings/holidays` | قراءة/بحث: الإعدادات | بحساب | MEDIUM |
| `POST /api/settings/holidays` | إجراء/إنشاء: الإعدادات | بحساب | HIGH |
| `PUT /api/settings/holidays/{id:guid}` | تعديل: الإعدادات | بحساب | HIGH |
| `DELETE /api/settings/holidays/{id:guid}` | حذف: الإعدادات | بحساب | HIGH |
| `GET /api/settings/user-preferences` | قراءة/بحث: الإعدادات | بحساب | MEDIUM |
| `PUT /api/settings/user-preferences` | تعديل: الإعدادات | بحساب | HIGH |
| `GET /api/treatment-catalog` | قراءة/بحث: العلاجات والخطط | بحساب | MEDIUM |
| `POST /api/treatment-catalog` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `PUT /api/treatment-catalog/{id:guid}` | تعديل: العلاجات والخطط | بحساب | HIGH |
| `DELETE /api/treatment-catalog/{id:guid}` | حذف: العلاجات والخطط | بحساب | HIGH |
| `GET /api/treatment-plans` | قراءة/بحث: العلاجات والخطط | بحساب | MEDIUM |
| `GET /api/treatment-plans/{id:guid}` | قراءة/بحث: العلاجات والخطط | بحساب | MEDIUM |
| `POST /api/treatment-plans` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `PUT /api/treatment-plans/{id:guid}` | تعديل: العلاجات والخطط | بحساب | HIGH |
| `POST /api/treatment-plans/{id:guid}/items` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `PUT /api/treatment-plans/{id:guid}/items/{itemId:guid}` | تعديل: العلاجات والخطط | بحساب | HIGH |
| `DELETE /api/treatment-plans/{id:guid}/items/{itemId:guid}` | حذف: العلاجات والخطط | بحساب | HIGH |
| `POST /api/treatment-plans/{id:guid}/{action:regex(^(propose|accept|reject|cancel|start|complete)$)}` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `GET /api/treatments` | قراءة/بحث: العلاجات والخطط | بحساب | MEDIUM |
| `GET /api/treatments/{id:guid}` | قراءة/بحث: العلاجات والخطط | بحساب | MEDIUM |
| `POST /api/treatments` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `POST /api/treatments/{id:guid}/price` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |
| `PUT /api/treatments/{id:guid}` | تعديل: العلاجات والخطط | بحساب | HIGH |
| `POST /api/treatments/{id:guid}/{action:regex(^(start|complete|cancel)$)}` | إجراء/إنشاء: العلاجات والخطط | بحساب | HIGH |

## صفحات إدارة المنصة والطلبات الأخرى

| المسار | الوظيفة | الوصول | المخاطرة |
|---|---|---|---|
| GET/POST `/Account/Login` | عرض الدخول/إرسال بيانات الدخول | عام | LOW للعرض؛ HIGH للإرسال |
| GET/POST `/Account/Logout` | الخروج | بحساب | MEDIUM |
| GET `/` و`/Index` | لوحة المنصة | بحساب | MEDIUM |
| GET `/Privacy` و`/Error` | معلومات ورسائل | بحساب | LOW |
| GET `/admin/clinics`؛ POST `handler=Status` | قراءة العيادات وتعديل حالتها | مدير | MEDIUM للقراءة؛ HIGH للتعديل |
| GET/POST `/admin/clinics/create` | نموذج وإنشاء عيادة وحساب | مدير | LOW لعرض النموذج؛ HIGH للإرسال |
| GET `/admin/clinics/{id}`؛ POST `handler=Status, Extend, UserAccess, Backup, PreviewRestore, Restore` | تفاصيل العيادة وتعديل الوصول والاشتراك والنسخ والاستعادة | مدير | MEDIUM للقراءة؛ HIGH للإجراءات |
| GET/POST `/admin/clinics/{id}/edit` | قراءة وتعديل العيادة | مدير | MEDIUM للقراءة؛ HIGH للتعديل |
| GET `/admin/registrations` و`handler=Logo`؛ POST `handler=Showcase` | مراجعة التسجيلات والشعارات ونشرها | مدير | MEDIUM للقراءة؛ HIGH للتعديل |
| GET/POST `/admin/email`؛ POST `handler=Test, Retry` | إعدادات البريد والإرسال وإعادة المحاولة | مدير | MEDIUM للقراءة؛ HIGH للتعديل/الإرسال |
| GET `/admin/operations` | حالة التشغيل | مدير | MEDIUM |
| GET `/health/live` و`/health/ready` في الخادمين | فحص الصحة والاعتماديات | عام | MEDIUM |
| الموقع العام: `/`, `/register`, `/confirm-email`, `/book/{clinicSlug}`, `/book/confirmation/{reference}` | تسليم شاشات المتصفح؛ البيانات والنماذج تمر بالـAPI أعلاه | عام | LOW للتسليم |
| موقع العيادة: جميع مسارات شاشات Angular، بما فيها الدخول واستعادة كلمة السر والدعوات والشاشات الداخلية | تسليم ملفات المتصفح؛ صلاحية البيانات تُفحص في API | عام لتسليم الملفات فقط | LOW للتسليم |
| ملفات JavaScript وCSS والصور، وبقية مسارات Angular التي تعيد صفحة التطبيق الرئيسية | ملفات ثابتة | عام | LOW |

`handler` اسم العملية التي يستقبلها نموذج إدارة المنصة في نفس عنوان الصفحة. العامل الخلفي لا يستقبل طلبات الإنترنت. لا توجد نقطة طلب AI مدفوعة فعالة؛ الإملاء الصوتي وSMS وWhatsApp مزودات غير مفعلة، بينما إرسال البريد موجود بالفعل.

## ما لا تغطيه هذه الحماية

لا يوجد مسار معروف داخل التطبيق تُرك بلا حد: العمليات الديناميكية لها Redis أو حد صحة مستقل، والملفات والصفحات لها حدود Nginx في نشر Docker المرفق. لا يمكنني تأكيد تطبيق هذه الإعدادات على خادم الإنتاج قبل نشرها والتحقق منه. تشغيل خوادم الملفات مباشرة خارج Nginx يتطلب حدوداً مقابلة في الاستضافة. حدود التطبيق لا تمنع هجوماً يغرق اتصال الإنترنت نفسه؛ ذلك يحتاج حماية مزود الاستضافة/Cloudflare.
