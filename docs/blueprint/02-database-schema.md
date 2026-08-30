# 02 — PostgreSQL Schema التنفيذي

الملف التنفيذي الكامل: [`db/schema.sql`](../../db/schema.sql). هذا المستند يشرح القواعد الحاكمة للتصميم.

## 1. تسمية الـ Schemas

نستخدم Postgres Schemas (namespaces) كحدود منطقية تطابق الوحدات المعمارية في [00-architecture-overview.md](./00-architecture-overview.md):

`auth · platform · catalog · sales · inventory · booking · pos · accounting · crm · logistics · integrations · notifications`

هذا يسمح بمنح صلاحيات قاعدة بيانات (`GRANT`) مستقلة لكل Schema عند فصل أي وحدة إلى خدمة مستقلة لاحقًا.

## 2. قواعد عامة على كل جدول

1. **المفتاح الأساسي**: `uuid primary key default gen_random_uuid()` — لا نستخدم `serial/bigint` تسلسلي لأنه يسرّب معلومات الحجم (عدد الطلبات مثلًا) ويصعّب الدمج بين بيئات.
2. **العزل متعدد المستأجرين**: أي جدول "تشغيلي" (Operational) يحمل عمود `store_id uuid not null references platform.stores(id)`. الجداول الفرعية (مثل `order_items`) تُعزل بشكل غير مباشر عبر الجدول الأب (`order_id → orders.store_id`) لتفادي تكرار العمود وربطه.
3. **الطوابع الزمنية**: `created_at timestamptz not null default now()`، وتضاف `updated_at` للجداول القابلة للتعديل المتكرر (orders، products...).
4. **الحالات (Status/Enum)**: نستخدم `text` مع `check (... in (...))` بدل `enum` النوعي في Postgres لسهولة التعديل دون `ALTER TYPE` مكلف عبر migrations متكررة.
5. **الحقول المرنة**: `jsonb` تُستخدم فقط للبيانات شبه المهيكلة وغير القابلة للاستعلام العلائقي المتكرر (`metadata`, `attributes`, `payload`, `manifest`). أي حقل يُستعلم عنه أو يُفلتر به بكثرة يجب أن يكون عمودًا صريحًا.
6. **الفهارس**: كل عمود `store_id` مفهرس (راجع نهاية `schema.sql`)، لأن كل استعلام تقريبًا يمر بفلترة على المتجر (مباشرة أو عبر RLS).
7. **لا حذف فعلي (Soft Delete)** على: `orders`, `invoices`, `payments`, `journal_entries`, `audit_logs`. تُستخدم حالة (`status = 'cancelled'/'void'`) بدل `DELETE`.

## 3. Migrations

- نستخدم أداة migrations إصدارية (مثل `sqlx`, `Prisma Migrate`, أو `supabase migration`) — لا تعديلات يدوية مباشرة على قاعدة الإنتاج.
- كل migration يجب أن تكون Idempotent (`create table if not exists`, `add column if not exists`) لتفادي فشل الإعادة في CI.
- ملف `db/schema.sql` الحالي هو **Migration 0001 (Baseline)**. أي تعديل لاحق يُضاف كملف migration جديد، لا يُعدَّل هذا الملف مباشرة بعد نشره على أي بيئة مشتركة.

## 4. الفرق بين `catalog.services` والحجز

`catalog.services` يمثل **تعريف** الخدمة القابلة للبيع (مدتها، نوع المورد المطلوب لها). أما **تنفيذ** الحجز الفعلي (وقت محدد، مورد محدد) فهو في `booking.bookings` و`booking.booking_items`. هذا الفصل يسمح ببيع نفس الخدمة عبر قنوات مختلفة (متجر إلكتروني، POS، تطبيق جوال) بينما يبقى محرك التوفر (Availability) مصدرًا وحيدًا للحقيقة.

## 5. أنواع مرجعية متعددة الأشكال (Polymorphic References)

حقول مثل `sales.order_items.item_type/item_id` و`catalog.package_items.item_type/item_id` و`catalog.prices.priceable_type/priceable_id` هي مراجع متعددة الأشكال (لا تدعمها Foreign Keys مباشرة في Postgres). القاعدة:
- التحقق من صحة الإشارة يتم في طبقة التطبيق (Service Layer) عند الكتابة.
- تُضاف قيود `CHECK` تحصر القيم الممكنة لـ `*_type`.
- عند الحاجة لضمان تكامل مرجعي صارم، تُستخدم Triggers للتحقق (`BEFORE INSERT/UPDATE`) بدل الاعتماد الكامل على التطبيق.
