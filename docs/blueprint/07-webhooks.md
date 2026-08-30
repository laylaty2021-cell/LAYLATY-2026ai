# 07 — Webhook Specification

## 1. الأحداث القياسية (Event Catalog)

```
order.created
order.paid
order.confirmed
order.cancelled
order.refunded
booking.created
booking.confirmed
booking.cancelled
booking.checked_in
payment.success
payment.failed
refund.completed
invoice.created
shipment.created
shipment.delivered
trip.started
trip.completed
inventory.low_stock
app.installed
app.uninstalled
```

كل حدث يحمل Payload بصيغة موحّدة:
```json
{
  "id": "evt_01H...",
  "type": "order.paid",
  "store_id": "uuid",
  "created_at": "2026-08-30T10:00:00Z",
  "data": { "...": "resource snapshot" }
}
```

## 2. التسجيل

`POST /v1/stores/{store_id}/webhooks` — يحدد `url` وقائمة `events`. يُنشأ `secret` عشوائي يُستخدم لتوقيع كل تسليم.

## 3. التوقيع والتحقق (HMAC)

كل طلب Webhook صادر يحمل Header:
```
X-Laylaty-Signature: t=1735500000,v1=<hmac_sha256_hex>
```
حيث `v1 = HMAC_SHA256(secret, "{t}.{raw_body}")`. المستقبل يجب أن:
1. يتحقق أن `t` ضمن نافذة زمنية معقولة (٥ دقائق) لمنع Replay.
2. يعيد حساب HMAC على `raw_body` الخام (قبل أي Parsing) ويقارنه بـ `v1`.

## 4. إعادة المحاولة (Retry Policy)

جدول `integrations.webhook_deliveries` يتتبع كل محاولة:
```
attempt 1 → فورًا
attempt 2 → بعد 1 دقيقة
attempt 3 → بعد 5 دقائق
attempt 4 → بعد 30 دقيقة
attempt 5 → بعد 4 ساعات
```
بعد 5 محاولات فاشلة (استجابة غير 2xx أو Timeout)، تُعلَّم الحالة `FAILED` ويُرسَل تنبيه للتاجر/المطوّر عبر Notification Engine، مع إمكانية إعادة المحاولة يدويًا من Developer Portal.

## 5. الترتيب والتكرار

- لا نضمن ترتيب التسليم بين أحداث مختلفة الأنواع، لكن نضمنه لنفس المورد (نفس `order_id` مثلًا) عبر معالجة تسلسلية لكل مفتاح Partition (`store_id + resource_id`) في طابور الأحداث.
- المستقبل يجب أن يتعامل مع الأحداث بشكل **Idempotent** (نفس `id` قد يصل أكثر من مرة) — يُنصح بتخزين آخر `evt_id` تمت معالجته لكل نوع.

## 6. علاقة بـ App Marketplace

تطبيقات الطرف الثالث المثبتة (`integrations.installations`) تشترك في الأحداث ضمن حدود الصلاحيات (`scopes`) التي وافق عليها التاجر عند التثبيت فقط — لا يستقبل أي تطبيق حدثًا يحتوي بيانات خارج الصلاحيات الممنوحة له (مثال: تطبيق تسويق لا يستقبل `payment.success` التفصيلي إن لم يطلب صلاحية `payments.read`).
