# 17 — Deployment Architecture

## 1. بيئات التشغيل

```
Local  → Development  → Staging  → Production
```
- **Local**: Docker Compose (API + PostgreSQL + Redis + Object Storage محاكاة/MinIO).
- **Development/Staging**: بيئة سحابية مطابقة للإنتاج بمقياس أصغر، تُستخدم لاختبار Migrations والتكامل قبل الإطلاق.
- **Production**: نشر مُدار (Managed) بأعلى وثوقية.

## 2. الوحدة القابلة للنشر (Deployable Unit)

بما أننا نبدأ بـ Modular Monolith (راجع [00-architecture-overview.md](./00-architecture-overview.md)):
- **حاوية API واحدة (Containerized)** تحتوي كل الوحدات (Commerce, Booking, POS, Accounting, CRM...)، خلف API Gateway/Load Balancer.
- **Workers منفصلون** (نفس الكود، نمط تشغيل مختلف) لـ: Outbox Relay، مهام مجدولة، معالجة Webhooks الصادرة — لفصل الحمل الخلفي عن زمن استجابة الـ API.
- **POS Sync Endpoint** يعمل ضمن نفس الـ API لكن يُراقَب بمؤشرات أداء مستقلة لحساسيته لدى المستخدم النهائي في نقطة البيع.

## 3. الشبكة والعزل

```
Internet
   │
   ▼
CDN / WAF
   │
   ▼
Load Balancer (TLS termination)
   │
   ▼
API Gateway (auth, rate limit, routing)
   │
   ▼
Application Containers (auto-scaled)
   │
   ▼
Private Network
   ├── PostgreSQL (Primary + Read Replicas)
   ├── Redis
   ├── Queue
   └── Object Storage (private buckets, signed URLs only)
```
قاعدة البيانات وRedis والطابور **لا تُعرَّض مباشرة على الإنترنت العام** — الوصول فقط من داخل الشبكة الخاصة (VPC) للحاويات المصرَّح لها.

## 4. التوسّع (Scaling)

- الـ API Containers: أفقي (Horizontal Autoscaling) بناءً على CPU/عدد الطلبات.
- PostgreSQL: عمودي أولًا (Vertical) + Read Replicas للاستعلامات الثقيلة (تقارير، AI Analytics) لتخفيف الحمل عن قاعدة الكتابة الأساسية.
- Redis: للحمل الخفيف الحالي (Cache/Locks) عقدة واحدة تكفي بمرحلة MVP، مع خطة Cluster عند الحاجة.

## 5. النشر المستمر (CI/CD)

```
Pull Request → CI (lint, tests, migration dry-run) → Merge → Build Image
   → Deploy to Staging (auto) → Smoke Tests → Manual Approval → Deploy to Production
```
- كل Migration تُشغَّل تلقائيًا كخطوة منفصلة **قبل** تبديل الإصدار الجديد من الحاويات (Blue/Green أو Rolling)، وتكون Idempotent وقابلة للتراجع (Backward-compatible لخطوة واحدة على الأقل، أي: لا تُحذَف عمود يستخدمه الإصدار القديم قبل نشره بالكامل).
- Feature Flags تُستخدم لفصل نشر الكود عن تفعيل الميزة، خصوصًا للتغييرات الحساسة (محاسبة، دفع).

## 6. تعدد المستأجرين على مستوى البنية التحتية

في MVP: **قاعدة بيانات واحدة مشتركة** مع عزل منطقي عبر `store_id` + RLS (راجع 03/15) — الأبسط تشغيليًا وكلفة. عند الحاجة لعزل أقوى لعميل مؤسسي كبير (Enterprise)، يُدعَم لاحقًا نمط **Database-per-tenant** اختياري دون تغيير نموذج البيانات نفسه (نفس Schema يُستنسخ لقاعدة بيانات مستقلة لهذا العميل تحديدًا).
