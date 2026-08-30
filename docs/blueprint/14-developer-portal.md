# 14 — Developer Portal Specification

## 1. الهدف

بوابة مستقلة (`Developer Portal` في [00-architecture-overview.md](./00-architecture-overview.md)) يسجّل فيها مطوّرو التطبيقات الخارجية (Third-party) لبناء تطبيقات على منصة ليلتي، منفصلة عن لوحة تحكم التاجر.

## 2. الوظائف الأساسية

1. **تسجيل مطوّر/شركة**: حساب مستقل عن `auth.users` التشغيلي للتجار (أو نفس الجدول بدور `Developer` — راجع [04-roles-permissions-matrix.md](./04-roles-permissions-matrix.md)).
2. **إنشاء تطبيق (App)**: اسم، وصف، أيقونة، `redirect_uris` لـ OAuth، الصلاحيات (Scopes) المطلوبة.
3. **إدارة الإصدارات**: كل نسخة (`integrations.app_versions`) لها `manifest` يوضّح: نقاط النهاية المستخدمة، الأحداث المشترك بها، شاشات الإعداد (Configuration UI) إن وُجدت.
4. **بيئة اختبار (Sandbox)**: متجر تجريبي مُوفَّر تلقائيًا لكل مطوّر لاختبار التطبيق دون بيانات حقيقية، يعمل على `sandbox.api.laylaty.com` (راجع `servers` في [`api/openapi.yaml`](../../api/openapi.yaml)).
5. **مفاتيح API**: توليد/تدوير (Rotate) `client_id`/`client_secret` لتدفق OAuth.
6. **سجل تسليم الأحداث**: عرض `integrations.webhook_deliveries` بالحالة والمحاولات لأغراض التصحيح (Debugging) الذاتي دون فتح تذكرة دعم.
7. **تقديم للمراجعة**: إرسال التطبيق لفريق ليلتي للاعتماد قبل ظهوره في App Marketplace العام (راجع [13-app-marketplace.md](./13-app-marketplace.md)).

## 3. تدفق OAuth للتثبيت (Authorization Code Flow)

```
1. Merchant clicks "Install App" in Store Marketplace
2. Redirect → GET /oauth/authorize?client_id=...&scope=orders.read+customers.read&redirect_uri=...
3. Merchant approves scopes explicitly
4. Redirect back with ?code=...
5. App backend: POST /oauth/token { code, client_id, client_secret }
   → access_token (short-lived) + refresh_token
6. integrations.installations row created (status=active)
7. integrations.credentials stores encrypted refresh_token
```

## 4. حدود الاستخدام (Rate Limits)

كل تطبيق مثبَّت يخضع لحدود معدل طلبات مستقلة عن حدود الواجهة البشرية (Dashboard)، لمنع تطبيق واحد سيئ التصميم من التأثير على أداء المنصة لبقية المتاجر:
```
X-RateLimit-Limit: 600 (per minute per installation)
X-RateLimit-Remaining: 594
X-RateLimit-Reset: 1735500060
```

## 5. التوثيق

المرجع الآلي المُولَّد من [`api/openapi.yaml`](../../api/openapi.yaml) يُنشر داخل البوابة (عبر أداة مثل Redoc/Swagger UI) مباشرة، بحيث يبقى التوثيق متزامنًا مع الـ API الفعلي دون صيانة يدوية مزدوجة.
