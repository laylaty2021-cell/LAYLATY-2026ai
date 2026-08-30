# 12 — Inventory Engine Specification

## 1. لا تعديل مباشر على الرصيد

المخزون لا يُعدَّل هكذا:
```
stock = stock - 1
```
بل نسجل حركة (`inventory.stock_movements`) لكل تغيير، والرصيد الحالي (`inventory.stock`) هو **نتيجة مُشتقّة** (أو مُخزَّنة ومُحدَّثة داخل نفس المعاملة مع الحركة، وليس مصدر الحقيقة الوحيد).

أنواع الحركات:
```
PURCHASE     -- شراء/توريد جديد
SALE         -- بيع
RETURN       -- إرجاع من عميل
TRANSFER     -- نقل بين مستودعات/فروع
ADJUSTMENT   -- تسوية يدوية (جرد)
DAMAGE       -- تالف
RESERVATION  -- حجز كمية لطلب لم يُشحن بعد
RELEASE      -- تحرير حجز (إلغاء الطلب قبل الشحن)
```
هذا يمنح تتبعًا كاملًا لتاريخ كل قطعة/كمية — أساسي للتدقيق المحاسبي وتسويات الجرد.

## 2. المخزون المتاح مقابل المحجوز

```
Available = 100
Reserved  = 20
Available to Sell = 80
```

- `inventory.stock.available_qty` = الكمية الفعلية في المستودع.
- `inventory.stock.reserved_qty` = مجموع `inventory_reservations.status = 'ACTIVE'` لنفس المتغير (Variant).
- **Available to Sell = available_qty − reserved_qty**، وهي القيمة المعروضة للعميل في المتجر الإلكتروني، وليست `available_qty` مباشرة.

## 3. دورة الحجز أثناء الطلب

```
Order created (PENDING_PAYMENT)
   → inventory_reservations row created (status=ACTIVE, expires_at = now()+30min)
Order paid
   → reservation.status = CONSUMED
   → stock_movement(type=SALE, quantity=-N)
Order cancelled / reservation expired
   → reservation.status = RELEASED / EXPIRED
   → stock_movement(type=RELEASE) إن كانت الكمية قد خُصمت مسبقًا
```
مهمة مجدولة تحرّر الحجوزات منتهية الصلاحية (`expires_at < now() AND status='ACTIVE'`) تلقائيًا، لتفادي "حجز أبدي" لسلة متروكة.

## 4. تعدد المستودعات والفروع

```
inventory.warehouses.branch_id
```
يسمح بربط مستودع بفرع محدد. الطلب يُخصَم أولًا من مستودع الفرع الذي أُنشئ منه الطلب (POS) أو من المستودع الافتراضي للمتجر الإلكتروني، مع إمكانية التحويل اليدوي (`TRANSFER`) بين المستودعات عند نفاد الكمية في فرع معيّن.

## 5. تنبيهات المخزون المنخفض

حدث `inventory.low_stock` (راجع [07-webhooks.md](./07-webhooks.md)) يُطلَق عندما `available_qty - reserved_qty <= reorder_threshold` (حد يُهيَّأ لكل متغير/مستودع)، ويُستهلك من Notification Engine ومن تطبيقات AI Inventory Forecast المحتملة في App Marketplace.

## 6. الفرق بين مخزون منتج وحجز مورد

المخزون (`inventory.*`) يخص **المنتجات المادية القابلة للعدّ** (Quantity-based). الموارد القابلة للحجز (قاعة، مصور، مركبة) لا تُدار عبر هذا المحرك بل عبر [Booking Engine](./11-booking-engine.md) — الفرق الجوهري: المخزون يُستهلك (Consumable)، بينما المورد يُشغَل لفترة زمنية ثم يعود متاحًا (Reusable/Time-based).
