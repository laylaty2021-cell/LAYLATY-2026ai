# LAYLATY-2026ai

منصة **ليلتي (Laylaty)** — تجارة وحجوزات متعددة المستأجرين (Multi-Tenant) لقطاع المناسبات.

## المرجع التقني

📘 **[Laylaty Technical Blueprint v1](./docs/blueprint/README.md)** — المواصفة التنفيذية الكاملة (البنية المعمارية، ERD، RLS، الأدوار والصلاحيات، REST API/OpenAPI، Webhooks، محركات الدفع/الحجز/المخزون/المحاسبة، App Marketplace، الأمان، البنية التحتية، وخارطة MVP → V1 → V2).

الملفات التنفيذية القابلة للتشغيل مباشرة:
- [`db/schema.sql`](./db/schema.sql) — سكربت PostgreSQL كامل (تم اختباره فعليًا).
- [`db/rls_policies.sql`](./db/rls_policies.sql) — سياسات Row-Level Security (تم اختبارها فعليًا).
- [`api/openapi.yaml`](./api/openapi.yaml) — مواصفة OpenAPI 3.0 لأهم الموارد.
