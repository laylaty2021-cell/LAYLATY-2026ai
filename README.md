# LAYLATY-2026ai

منصة **ليلتي (Laylaty)** — تجارة وحجوزات متعددة المستأجرين (Multi-Tenant) لقطاع المناسبات.

## المرجع التقني

📘 **[Laylaty Technical Blueprint v1](./docs/blueprint/README.md)** — المواصفة التنفيذية الكاملة (البنية المعمارية، ERD، RLS، الأدوار والصلاحيات، REST API/OpenAPI، Webhooks، محركات الدفع/الحجز/المخزون/المحاسبة، App Marketplace، الأمان، البنية التحتية، وخارطة MVP → V1 → V2).

الملفات التنفيذية القابلة للتشغيل مباشرة:
- [`db/schema.sql`](./db/schema.sql) — سكربت PostgreSQL كامل (تم اختباره فعليًا).
- [`db/rls_policies.sql`](./db/rls_policies.sql) — سياسات Row-Level Security (تم اختبارها فعليًا).
- [`db/roles.sql`](./db/roles.sql) — أدوار قاعدة البيانات (`laylaty_app` المقيّد بـ RLS، و`laylaty_service` الموثوق لعمليات التهيئة).
- [`api/openapi.yaml`](./api/openapi.yaml) — مواصفة OpenAPI 3.0 لأهم الموارد.

## تطبيق MVP

**[`services/api`](./services/api)** — أول شريحة عاملة فعليًا من الـ MVP (Identity & Access، المتاجر، الكاتالوج، الحجوزات، الطلبات، الدفع)، مبنية مباشرة فوق `db/schema.sql` و`db/rls_policies.sql` — وليست مجرد توثيق. تحتوي 10 اختبارات تكامل حقيقية (Postgres فعلي، بلا Mocking) تثبت أن العزل متعدد المستأجرين، وIdempotency الدفع، ومنع الحجز المزدوج تعمل فعلاً كما هو موثّق. راجع [`services/api/README.md`](./services/api/README.md) للتشغيل والاختبار.
