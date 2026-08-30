# 08 — Payment Adapter Specification

## 1. لماذا Adapter وليس ربط مباشر

```
Payment Service
       │
       ▼
Payment Adapter
       │
 ┌─────┼─────┐
 │     │     │
 P1    P2    P3
```

`Order Service` لا يعرف شيئًا عن مزود الدفع المحدد. كل مزود (مثل Moyasar، Tap، HyperPay، مدفوعات مخصصة) يطبّق واجهة موحّدة، وإضافة مزود جديد لا تتطلب تعديل منطق الطلبات.

## 2. الواجهة الموحّدة (Adapter Interface)

```ts
interface PaymentProviderAdapter {
  createPayment(input: CreatePaymentInput): Promise<PaymentResult>;
  authorize(paymentId: string): Promise<PaymentResult>;
  capture(paymentId: string, amount?: number): Promise<PaymentResult>;
  refund(paymentId: string, amount: number, reason: string): Promise<RefundResult>;
  getPayment(paymentId: string): Promise<PaymentResult>;
  handleWebhook(rawBody: Buffer, headers: Record<string, string>): Promise<PaymentWebhookEvent>;
}
```

كل مزود مسجَّل في Registry داخلي:
```
PaymentAdapterRegistry.register("moyasar", MoyasarAdapter);
PaymentAdapterRegistry.register("tap", TapAdapter);
```
ويُختار المزود الفعلي وقت التشغيل بناءً على إعداد المتجر (`store.payment_provider` أو منطق توجيه أكثر تعقيدًا لاحقًا مثل A/B بين مزودين).

## 3. دورة الدفع

```
INITIATED → PENDING → AUTHORIZED → CAPTURED
```
حالات بديلة: `FAILED`, `CANCELLED`, `REFUNDED`, `PARTIALLY_REFUNDED`.

- **INITIATED**: تم إنشاء سجل الدفع محليًا (`sales.payments`) بمفتاح `idempotency_key`، قبل أي اتصال بالمزود.
- **PENDING**: تم إرسال الطلب للمزود بانتظار تأكيده (تحويل بنكي، 3D-Secure...).
- **AUTHORIZED**: المبلغ محجوز لدى المزود لم يُحصَّل بعد (يُستخدم عند الحاجة لتأكيد لاحق، مثل حجز قاعة يتطلب موافقة إدارية قبل التحصيل النهائي).
- **CAPTURED**: تم تحصيل المبلغ فعليًا → يُطلق حدث `payment.success` ويُنقَل الطلب لـ `PAID`.

## 4. Idempotency (أهم نقطة في النظام)

كل طلب دفع يحمل `idempotency_key` (يُولَّد من العميل/الواجهة الأمامية مرة واحدة لكل محاولة دفع منطقية، وليس لكل HTTP request).

```
Request #1 → Payment Created (status=INITIATED, idempotency_key=K)
Request #2 → نفس idempotency_key=K
             ↓
             إرجاع نفس سجل الدفع الموجود (لا إنشاء جديد، لا اتصال ثانٍ بالمزود)
```

**التنفيذ**:
1. `sales.payments.idempotency_key` عمود **UNIQUE** (منفَّذ في `db/schema.sql`).
2. عند `INSERT` يفشل بسبب تعارض المفتاح الفريد → الخادم يقرأ السجل الموجود ويعيده بنفس استجابة النجاح (وليس خطأ 409)، **بشرط** أن جسم الطلب مطابق منطقيًا (نفس `order_id`, `amount`) وإلا يُرفض بـ `422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
3. لا يُستدعى المزود الخارجي (`createPayment`) إلا بعد نجاح الإدراج المحلي الأول لهذا المفتاح — منع استدعاء مضاعف حتى تحت تزامن عالٍ (Race Condition) عبر قيد قاعدة البيانات نفسه، وليس قفل تطبيقي فقط.

## 5. معالجة Webhooks الواردة من المزوّد

كل مزوّد يرسل تأكيد الدفع عبر Webhook خاص به (مسار منفصل عن Webhooks الصادرة من ليلتي، راجع 07). `handleWebhook()` في الـ Adapter مسؤول عن:
1. التحقق من التوقيع الخاص بالمزود.
2. تحويل الحدث الخام لصيغة داخلية موحّدة (`PaymentWebhookEvent`).
3. تحديث حالة الدفع بشكل **Idempotent** أيضًا (Webhook قد يصل مكررًا من المزود نفسه) — بالاعتماد على `external_reference` كمفتاح مطابقة.

## 6. الفشل الجزئي والتعويض (Compensation)

إن نجح الدفع لدى المزوّد لكن فشل تحديث النظام محليًا (انقطاع شبكة بعد الاستدعاء):
- تعمل مهمة دورية (Reconciliation Job) تقارن `sales.payments` بحالة `INITIATED/PENDING` القديمة (> N دقائق) باستعلام `getPayment()` من المزوّد مباشرة، وتحدّث الحالة الفعلية — بدل ترك الدفعة "معلّقة" للأبد.
