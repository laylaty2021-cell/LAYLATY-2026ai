# 13 — App Marketplace Specification

## 1. Capability Engine — التوصية حسب نوع النشاط

```
Business Type
       ↓
Capability Engine
       ↓
Recommended Modules
       ↓
Recommended Apps
       ↓
Store Marketplace
```

عند إنشاء متجر، `business_type` (المسجَّل في `platform.stores`) يُحدَّد من قائمة معروفة (قاعة، نقل، ورد، تصوير...)، ويستخدمه Capability Engine (قاعدة قواعد بسيطة Rule-based في MVP، قابلة للتطور لاحقًا) لاقتراح الوحدات والتطبيقات الأنسب:

| نوع النشاط | الوحدات المقترحة |
|---|---|
| قاعة (Hall) | Booking, CRM, POS, Accounting, Payments, Marketing |
| نقل (Transportation) | Fleet, Drivers, Tracking, Booking, Payments, Accounting |
| ورد (Florist) | Catalog, Inventory, POS, Delivery, Payments, Marketing |

هذه التوصيات تظهر في شاشة الإعداد الأولي (Onboarding) ولوحة الـ Marketplace كفلترة افتراضية، وليست قيدًا صارمًا — يمكن للتاجر تصفح كل التطبيقات المتاحة.

## 2. نموذج التطبيق (App)

```
integrations.apps          -- تعريف التطبيق (اسم، مطوّر، حالة اعتماد)
integrations.app_versions  -- كل نسخة تحمل manifest (jsonb): الصلاحيات المطلوبة، نقاط النهاية، Webhooks المشترك بها
integrations.installations -- تثبيت تطبيق على متجر معيّن
integrations.credentials   -- بيانات اعتماد خاصة بكل تثبيت (OAuth tokens، API keys) — لا تُقرأ إلا من الخادم (راجع RLS في 03)
integrations.permissions   -- الصلاحيات الممنوحة فعليًا لهذا التطبيق (Scopes)
```

## 3. دورة حياة التطبيق

```
draft → submitted → (مراجعة يدوية/آلية من فريق ليلتي) → approved | rejected
approved → يمكن تثبيته من أي متجر
suspended → يُزال من نتائج البحث، التثبيتات القائمة تستمر بتنبيه للتاجر
```

## 4. نموذج الصلاحيات (Scoped Permissions)

عند التثبيت، يعرض النظام للتاجر بوضوح الصلاحيات المطلوبة (مثال: `orders.read`, `customers.read`, `webhooks.receive:order.*`)، والتاجر يوافق صراحة. أي تطبيق:
- لا يصل إلا للبيانات ضمن الـ Scopes الممنوحة (يُطبَّق عبر نفس آلية RLS + `platform.has_permission` الموسّعة لتشمل هوية "تطبيق" وليس فقط "مستخدم بشري").
- لا يمكنه توسيع صلاحياته دون طلب موافقة جديدة (نسخة جديدة تطلب Scope إضافي تتطلب إعادة موافقة صريحة من التاجر، وليس تفعيلًا صامتًا).

## 5. AI Marketplace (تطبيقات AI كحالة خاصة)

تطبيقات AI (`AI Marketing`, `AI Customer Support`, `AI Sales Assistant`, `AI Accounting Analyst`, `AI Inventory Forecast`, `AI Booking Optimizer`) تُعامَل كتطبيقات عادية من حيث النموذج (نفس `apps`/`installations`/`permissions`)، مع قيد إضافي: أي صلاحية كتابة (Write Scope) على بيانات حساسة (محاسبة، مدفوعات) تتطلب أن يمر كل تنفيذ فعلي عبر قاعدة عمل مبرمجة صراحة + اعتماد بشري — لا كتابة مباشرة "حرة" من نموذج الذكاء الاصطناعي. راجع القسم 7 في [10-accounting-engine.md](./10-accounting-engine.md).

## 6. الفوترة (Billing) بين المنصة والمطورين

خارج نطاق MVP الأول، لكن النموذج يُصمَّم ليتوسع لاحقًا إلى:
```
Free apps → بدون فوترة
Paid apps → اشتراك شهري / عمولة لكل معاملة، تُحصَّل عبر Payment Adapter (راجع 08) وتُوزَّع بين المنصة والمطوّر
```
