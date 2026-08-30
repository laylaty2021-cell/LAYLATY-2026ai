# Laylaty Technical Blueprint v1

هذا المجلد هو المرجع التقني الموحّد لمنصة **ليلتي (Laylaty)** — منصة تجارة وحجوزات متعددة المستأجرين (Multi-Tenant) متخصصة في قطاع المناسبات (قاعات، تصوير، نقل، ضيافة، ...) وتُشبه من حيث الفكرة العامة سلة/زد لكنها مبنية حول **الخدمات والموارد والوقت** بدل المنتجات والكمية فقط.

الهدف من هذا المستند: أن يبدأ كل مبرمج من نفس الأساس، بدل أن يبني كل واحد جزءًا بطريقته الخاصة.

## القرار المعماري النهائي

نبدأ بـ **Modular Monolith + Event-Driven Architecture** بدل Microservices الكاملة منذ اليوم الأول، لتقليل التعقيد والتكلفة في مرحلة MVP مع الحفاظ على حدود وحدات (Modules) واضحة تسمح لاحقًا بفصل أي خدمة تحتاج توسّعًا مستقلًا (مثال متوقع أولًا: Payment Service ثم POS Service).

```
                    LAYLATY
                       │
                 API GATEWAY
                       │
               APPLICATION CORE
                       │
 ┌─────────┬──────────┼──────────┬───────────┐
 │         │          │          │           │
Commerce  Booking    POS     Accounting     CRM
 │         │          │          │           │
 └─────────┴──────────┼──────────┴───────────┘
                       │
                 EVENT BUS
                       │
              INTEGRATION HUB
                       │
        ┌──────────────┼──────────────┐
        │              │              │
    Payments       Logistics       Marketing
        │              │              │
    Providers        Carriers       Apps
                       │
                 APP MARKETPLACE
                       │
                DEVELOPER PORTAL
```

## فهرس المستندات

| # | المستند | الموضوع |
|---|---------|---------|
| 00 | [00-architecture-overview.md](./00-architecture-overview.md) | البنية التقنية العامة والقرار المعماري |
| 01 | [01-erd.md](./01-erd.md) | ERD كامل لجميع الجداول (Schemas منطقية) |
| 02 | [02-database-schema.md](./02-database-schema.md) | PostgreSQL Schema التنفيذي |
| 03 | [03-rls-policies.md](./03-rls-policies.md) | Row-Level Security لكل جدول |
| 04 | [04-roles-permissions-matrix.md](./04-roles-permissions-matrix.md) | مصفوفة الأدوار والصلاحيات (RBAC) |
| 05 | [05-rest-api.md](./05-rest-api.md) | REST API الكامل |
| 06 | [../../api/openapi.yaml](../../api/openapi.yaml) | OpenAPI Specification |
| 07 | [07-webhooks.md](./07-webhooks.md) | Webhook Specification |
| 08 | [08-payment-adapter.md](./08-payment-adapter.md) | Payment Adapter Specification |
| 09 | [09-pos-offline-sync.md](./09-pos-offline-sync.md) | POS Offline / Sync Specification |
| 10 | [10-accounting-engine.md](./10-accounting-engine.md) | Accounting Engine Specification |
| 11 | [11-booking-engine.md](./11-booking-engine.md) | Booking Engine Specification |
| 12 | [12-inventory-engine.md](./12-inventory-engine.md) | Inventory Engine Specification |
| 13 | [13-app-marketplace.md](./13-app-marketplace.md) | App Marketplace Specification |
| 14 | [14-developer-portal.md](./14-developer-portal.md) | Developer Portal Specification |
| 15 | [15-multi-tenant-security.md](./15-multi-tenant-security.md) | Multi-tenant Security Model |
| 16 | [16-event-bus-outbox.md](./16-event-bus-outbox.md) | Event Bus / Outbox / Queue |
| 17 | [17-deployment-architecture.md](./17-deployment-architecture.md) | Deployment Architecture |
| 18 | [18-backup-dr.md](./18-backup-dr.md) | Backup & Disaster Recovery |
| 19 | [19-monitoring-observability.md](./19-monitoring-observability.md) | Monitoring & Observability |
| 20 | [20-roadmap-mvp-v1-v2.md](./20-roadmap-mvp-v1-v2.md) | خارطة التنفيذ MVP → V1 → V2 |

## الملفات التنفيذية المرافقة

- [`db/schema.sql`](../../db/schema.sql) — سكربت PostgreSQL كامل قابل للتنفيذ ينشئ كل الـ Schemas والجداول الأساسية (يتضمن قيد `EXCLUDE` لمنع الحجز المزدوج، مُختبَر فعليًا).
- [`db/rls_policies.sql`](../../db/rls_policies.sql) — سياسات RLS الفعلية لكل جدول تشغيلي.
- [`db/roles.sql`](../../db/roles.sql) — أدوار قاعدة البيانات: `laylaty_app` (مقيَّد بـ RLS، يستخدمه الـ API لكل طلب) و`laylaty_service` (BYPASSRLS، لعمليات التهيئة الموثوقة فقط — راجع [15-multi-tenant-security.md](./15-multi-tenant-security.md) القسم 2).
- [`db/seed_permissions.sql`](../../db/seed_permissions.sql) — كتالوج الصلاحيات العام المطابق لمصفوفة [04](./04-roles-permissions-matrix.md).
- [`db/auth_uid_selfhosted.sql`](../../db/auth_uid_selfhosted.sql) — بديل `auth.uid()` عند النشر بدون Supabase.
- [`api/openapi.yaml`](../../api/openapi.yaml) — مواصفة OpenAPI 3.0 لأهم الموارد (Stores, Products, Orders, Bookings, Payments, Customers, Webhooks).
- **[`services/api`](../../services/api)** — أول شريحة MVP عاملة فعليًا فوق هذه الملفات (وليست توثيقًا فقط): Identity & Access، Stores، Catalog، Booking، Orders، Payments — مع 10 اختبارات تكامل حقيقية ضد Postgres فعلي تثبت أن RLS والـ Idempotency ومنع الحجز المزدوج تعمل كما هو موصوف أعلاه.

## مبادئ حاكمة (تنطبق على كل مستند لاحق)

1. **Multi-Tenant من الأساس**: كل جدول تشغيلي يحمل `store_id`، ولا نعتمد على طبقة التطبيق وحدها — الحماية مطبّقة أيضًا داخل قاعدة البيانات عبر RLS.
2. **لا حذف فعلي للبيانات الحساسة** (Soft Delete + Audit Log) في الطلبات، الفواتير، القيود المحاسبية، السجلات المالية.
3. **Idempotency إلزامي** في كل عملية دفع أو مزامنة POS.
4. **الأحداث (Events) هي لغة التكامل** بين الوحدات الداخلية والتطبيقات الخارجية عبر Event Bus وWebhooks.
5. **الخدمات والموارد قبل المنتجات**: نموذج البيانات مبني ليخدم `Service → Resource → Time → Location → Availability → Price` بنفس قوة `Product → Variant → Stock → Price`.
