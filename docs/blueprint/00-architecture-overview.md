# 00 — البنية التقنية العامة (Architecture Overview)

## 1. الطبقات

```
Frontend
├── Merchant Dashboard      # لوحة تحكم التاجر
├── POS                     # نقطة البيع
├── Customer Storefront     # واجهة العميل النهائي
├── Admin Panel             # لوحة إدارة المنصة (Laylaty Ops)
└── Developer Portal        # بوابة المطورين والتطبيقات

Backend
├── API Gateway
├── Identity & Access
├── Store Service
├── Catalog Service
├── Order Service
├── Booking Service
├── Payment Service
├── Inventory Service
├── POS Service
├── Accounting Service
├── CRM Service
├── Logistics Service
├── Integration Service
└── Notification Service

Infrastructure
├── PostgreSQL / Supabase
├── Redis
├── Queue / Event Bus
├── Object Storage
├── Secrets Manager
└── Monitoring
```

## 2. القرار المعماري: Modular Monolith أولًا

لا نبني Microservices كاملة منذ اليوم الأول. نبدأ بـ **Modular Monolith + Event-Driven Architecture**:

- تطبيق واحد قابل للنشر (Deployable Unit واحد أو قليل جدًا)، لكن الكود مقسّم داخليًا إلى وحدات (Modules) بحدود صريحة تطابق أسماء الـ Services أعلاه.
- كل وحدة تتواصل مع غيرها عبر **واجهات داخلية محددة (Module API)** وليس عبر الوصول المباشر لجداول وحدة أخرى.
- التكامل غير المتزامن (مثل: تحديث المخزون بعد الدفع، إرسال إشعار بعد تأكيد حجز) يمر عبر **Event Bus داخلي (In-Process ثم Outbox)**، بحيث يسهل لاحقًا سحب أي وحدة إلى خدمة مستقلة دون تغيير منطق الأعمال.

### معايير فصل وحدة إلى خدمة مستقلة (لاحقًا)
وحدة تُفصل إلى Microservice مستقل فقط عند توفر واحد أو أكثر من:
1. حِمل مختلف تمامًا عن باقي النظام (مثال: Payment Service يحتاج SLA أعلى ووثوقية أعلى من Marketing).
2. حاجة لغة/بيئة تشغيل مختلفة (مثال: محرك تسعير أو AI بلغة مختلفة).
3. فريق مستقل يملك دورة نشر مستقلة.
4. متطلبات أمنية/امتثال إضافية (PCI-DSS للدفع مثلًا).

الترتيب المتوقع للفصل: **Payment Service → POS Service (Edge/Sync) → Notification Service → Integration Service**.

## 3. القرار المعماري النهائي (خريطة الوحدات)

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

- **Commerce** = Catalog + Order + Inventory
- **Booking** = Resource Engine + Calendar Engine + Booking Engine
- **POS** = Registers/Terminals + Offline Sync
- **Accounting** = Journal/Ledger + Tax + Expenses
- **CRM** = Customers + Notes + Events
- **Integration Hub** = Payment Adapters + Carrier Adapters + Marketing Apps + Webhooks
- **App Marketplace / Developer Portal** = طبقة تطبيقات الطرف الثالث فوق Integration Hub

## 4. المكدس التقني المقترح

| الطبقة | التقنية المقترحة | السبب |
|---|---|---|
| قاعدة البيانات | PostgreSQL (عبر Supabase أو مُدار ذاتيًا) | دعم RLS أصلي، JSONB، Extensions قوية (pg_cron, pgvector لاحقًا لـ AI) |
| ذاكرة تخزين مؤقت | Redis | جلسات، Rate limiting، أقفال الحجز المؤقتة (Booking Hold)، طوابير خفيفة |
| طابور/أحداث | Queue (مثل SQS/RabbitMQ) + Outbox Pattern | ضمان تسليم الأحداث حتى عند فشل جزئي |
| تخزين ملفات | Object Storage (S3-compatible) | صور المنتجات، عقود، فواتير PDF |
| أسرار | Secrets Manager | مفاتيح بوابات الدفع، بيانات اعتماد التطبيقات المثبتة |
| مراقبة | Prometheus/Grafana + Sentry + Logs مركزية | راجع 19-monitoring-observability.md |

## 5. مرجع سريع لبقية المستندات

هذا المستند هو نقطة الدخول المعمارية فقط. التفاصيل التنفيذية (الجداول، RLS، الحالات، الـ API) موزّعة على بقية ملفات هذا المجلد كما هو مذكور في [README.md](./README.md).
