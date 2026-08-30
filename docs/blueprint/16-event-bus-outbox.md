# 16 — Event Bus / Outbox / Queue

## 1. لماذا Outbox Pattern

في Modular Monolith، تحديث قاعدة البيانات (مثلًا: `order.status = PAID`) ونشر حدث (`order.paid`) يجب أن يحدثا **معًا أو لا يحدث أي منهما** — وإلا نخاطر بحالة يُحدَّث فيها الطلب دون إشعار العميل، أو العكس (إشعار بحدث لم يُثبَّت فعليًا).

الحل: **Transactional Outbox**.

```
BEGIN TRANSACTION
  UPDATE sales.orders SET status = 'PAID' WHERE id = ...
  INSERT INTO event_outbox (event_type, payload, status='PENDING')
COMMIT
```

عملية خلفية منفصلة (Outbox Relay/Publisher) تقرأ الصفوف `PENDING` من `event_outbox` وتنشرها فعليًا إلى الطابور (Queue/Event Bus)، ثم تُعلِّمها `PUBLISHED`. إن فشل النشر، تبقى الصفوف `PENDING` وتُعاد المحاولة — لا فقدان لأي حدث حتى عند تعطل الطابور نفسه.

## 2. جدول Outbox

```
event_outbox
 id (PK)
 store_id
 event_type
 payload (jsonb)
 status        -- PENDING | PUBLISHED | FAILED
 created_at
 published_at
```

## 3. من المستهلك (Consumers)؟

```
Event Bus
   │
   ├── Notification Engine        (order.paid → إرسال إشعار)
   ├── Accounting Service         (order.completed → إنشاء قيد إيراد)
   ├── Inventory Service          (order.paid → تحويل حجز لاستهلاك فعلي)
   ├── Integration Hub            (كل الأحداث المشترك بها من تطبيقات → Webhook صادر، راجع 07)
   └── Analytics/AI Pipeline      (تلقيم بيانات لتحليلات AI Business Assistant)
```

## 4. داخل الـ Monolith اليوم، خدمات مستقلة غدًا

في المرحلة الحالية (Modular Monolith)، ناقل الأحداث قد يكون طابورًا داخل نفس العملية (In-process event emitter) يكتب أيضًا لجدول `event_outbox` لضمان الاسترجاع عند الفشل. عند فصل أي وحدة إلى Microservice مستقل، تُستبدل آلية الاستهلاك الداخلية بطابور خارجي فعلي (SQS/RabbitMQ/Kafka) دون تغيير **عقد الحدث نفسه** (Event Schema) — وهذا هو سبب أهمية توحيد صيغة الحدث منذ البداية (راجع [07-webhooks.md](./07-webhooks.md), القسم 1).

## 5. الترتيب والمعالجة المتكررة (At-least-once + Idempotent Consumers)

نموذج التسليم هو **At-least-once** (قد يصل نفس الحدث أكثر من مرة نتيجة إعادة محاولة). لذلك:
- كل مستهلك (Consumer) يجب أن يكون **Idempotent**: يتحقق من `event.id` قبل تنفيذ أي تأثير جانبي غير قابل للتكرار الآمن (مثال: لا تُرسَل نفس رسالة SMS مرتين).
- الترتيب مضمون فقط ضمن نفس مفتاح التقسيم (Partition Key = `store_id` أو `store_id+resource_id` للأحداث عالية الحساسية كالحجوزات).

## 6. مهام مجدولة (Scheduled Jobs) كمصدر أحداث إضافي

بعض الأحداث لا تنتج من فعل مستخدم مباشر بل من الزمن نفسه:
```
booking.hold_expired      -- مهمة كل دقيقة تفحص HOLD منتهي الصلاحية
inventory.reservation_expired
fiscal_period.auto_close  -- اختياري حسب سياسة كل متجر
```
تُنفَّذ عبر Scheduler (مثل `pg_cron` داخل Postgres أو Worker مستقل)، وتنتج نفس نوع الأحداث في `event_outbox` بلا فرق عن الأحداث الناتجة من طلب API.
