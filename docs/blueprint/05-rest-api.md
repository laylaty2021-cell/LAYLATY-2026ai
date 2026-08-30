# 05 — REST API الكامل

المواصفة الرسمية القابلة للتوليد (SDKs, Mock servers, Docs) هي [`api/openapi.yaml`](../../api/openapi.yaml). هذا المستند يشرح الاصطلاحات العامة وقائمة الموارد.

## 1. الاصطلاحات العامة

- **Base URL**: `https://api.laylaty.com/v1`
- **المصادقة**: `Authorization: Bearer <access_token>` (JWT صادر من Identity & Access، يحمل `sub` = user_id و`store_ids` claim).
- **تحديد المتجر**: كل طلب على مورد تشغيلي يمرّ عبر `store_id` في المسار: `/v1/stores/{store_id}/orders`. لا نعتمد على Header ضمني لتفادي غموض السياق.
- **الترقيم (Pagination)**: `?page[cursor]=...&page[size]=50` (Cursor-based، ليس Offset، لضمان الاستقرار مع البيانات المتغيرة بسرعة كـ POS).
- **الفرز والفلترة**: `?sort=-created_at&filter[status]=CONFIRMED`.
- **الأخطاء**: بصيغة موحّدة:
  ```json
  {
    "error": {
      "code": "ORDER_NOT_PAYABLE",
      "message": "Order status does not allow payment.",
      "details": { "current_status": "CANCELLED" }
    }
  }
  ```
- **Idempotency**: أي `POST` قد يُكرَّر (دفع، مزامنة POS) يجب أن يرسل `Idempotency-Key` Header. راجع [08-payment-adapter.md](./08-payment-adapter.md).
- **الإصدار (Versioning)**: عبر المسار `/v1/` — لا Breaking Changes داخل نفس الإصدار؛ تغييرات جذرية تُصدَر كـ `/v2/`.

## 2. قائمة الموارد الرئيسية

| المورد | المسار الأساسي | ملاحظات |
|---|---|---|
| Stores | `/v1/stores` | إنشاء/إدارة المتجر نفسه |
| Branches | `/v1/stores/{store_id}/branches` | |
| Memberships | `/v1/stores/{store_id}/memberships` | دعوة موظف، تعيين دور |
| Roles/Permissions | `/v1/stores/{store_id}/roles` | راجع 04 |
| Categories | `/v1/stores/{store_id}/categories` | |
| Products/Services/Packages | `/v1/stores/{store_id}/products` | `type` filter |
| Prices | `/v1/stores/{store_id}/products/{id}/prices` | |
| Carts | `/v1/stores/{store_id}/carts` | يستخدمها Storefront قبل تحويلها لطلب |
| Orders | `/v1/stores/{store_id}/orders` | دورة الحياة في 06 |
| Invoices | `/v1/stores/{store_id}/invoices` | |
| Payments | `/v1/stores/{store_id}/payments` | راجع 08 |
| Refunds | `/v1/stores/{store_id}/refunds` | |
| Warehouses/Stock | `/v1/stores/{store_id}/warehouses` | راجع 12 |
| Resources | `/v1/stores/{store_id}/resources` | راجع 11 |
| Availability | `/v1/stores/{store_id}/resources/{id}/availability` | |
| Bookings | `/v1/stores/{store_id}/bookings` | راجع 11 |
| Registers/Terminals | `/v1/stores/{store_id}/pos/registers` | راجع 09 |
| POS Sync | `/v1/stores/{store_id}/pos/sync` | Batch endpoint |
| Accounts/Journal | `/v1/stores/{store_id}/accounting/*` | راجع 10 |
| Customers | `/v1/stores/{store_id}/customers` | |
| Fulfillments/Trips | `/v1/stores/{store_id}/fulfillments` | راجع 07/09 من المخطط الأصلي (اللوجستيات) |
| Apps/Installations | `/v1/stores/{store_id}/apps` | راجع 13 |
| Webhooks | `/v1/stores/{store_id}/webhooks` | راجع 07 |
| Notifications Preferences | `/v1/stores/{store_id}/notifications/preferences` | |
| Audit Logs | `/v1/stores/{store_id}/audit-logs` | قراءة فقط |

## 3. أمثلة تدفقات

### إنشاء طلب حجز خدمة ثم دفعه
```
POST /v1/stores/{store_id}/bookings          → status: DRAFT
POST /v1/stores/{store_id}/bookings/{id}/hold → status: HOLD (يحجز الفتحة الزمنية مؤقتًا)
POST /v1/stores/{store_id}/orders             → ينشئ Order مرتبط بالحجز
POST /v1/stores/{store_id}/payments           → Idempotency-Key مطلوب
   → عند نجاح الدفع (Webhook من المزود): booking → CONFIRMED, order → PAID → CONFIRMED
```

### بيع POS Offline ثم مزامنة
```
[Offline] Local transaction created (device_id + local_transaction_id)
[Online]  POST /v1/stores/{store_id}/pos/sync
          body: [{ device_id, local_transaction_id, payload }, ...]
          → server upserts by (device_id, local_transaction_id) unique key
          → returns server_transaction_id per item + conflict list
```

## 4. صلاحيات كل مسار

كل Endpoint في `openapi.yaml` يحمل امتداد `x-required-permission` يشير إلى كود الصلاحية المطلوب من [04-roles-permissions-matrix.md](./04-roles-permissions-matrix.md)، ويُتحقق منها في الـ API Gateway **قبل** الوصول لقاعدة البيانات (حيث تُطبَّق RLS كخط دفاع ثانٍ).
