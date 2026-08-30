# 11 — Booking Engine Specification

## 1. الخدمات بدل المنتجات — الفرق الجوهري

في منصات التجارة التقليدية (سلة/زد):
```
Product → Quantity → Price
```
ليلتي تحتاج:
```
Service → Resource → Time → Location → Availability → Price
```
مثال — مصور:
```
Photography
Date: 20/10
Duration: 6 Hours
Location: Hall
Photographer: Ahmed
Price: 3,500
```

## 2. Resource Engine — محرك موارد عام

```
Resource
 ├── Hall
 ├── Vehicle
 ├── Photographer
 ├── Makeup Artist
 ├── Room
 ├── Equipment
 └── Staff
```
نفس محرك الحجز (Booking Engine) يخدم كل هذه الأنواع لأن الجدول `booking.resources` عام (`type` + `metadata jsonb` مرن لكل نوع)، وليس جدولًا منفصلًا لكل نوع مورد. إضافة نوع مورد جديد لا يتطلب Migration في قاعدة البيانات، فقط قيمة جديدة في `type` وواجهة عرض مناسبة في الواجهة الأمامية.

## 3. Calendar Engine

```
Resource
      ↓
Calendar
      ↓
Availability Rules
      ↓
Bookings
      ↓
Blocked Time
```
مثال:
```
المصورة سارة
09:00–13:00 Available
13:00–15:00 Booked
15:00–20:00 Available
```

### حساب التوفر الفعلي (خوارزمية)
لحساب فتحات التوفر لمورد في مدى زمني معيّن:
1. ابدأ من `booking.availability` (القواعد العامة: أيام أسبوعية أو تواريخ محددة).
2. اطرح منها كل `booking.booking_items` النشطة (`bookings.status NOT IN (CANCELLED, EXPIRED)`) لنفس المورد ضمن نفس المدى، مع إضافة `buffer_before_minutes`/`buffer_after_minutes` من `booking.booking_rules`.
3. اطرح `min_notice_minutes` (لا يمكن الحجز قبل المدة الدنيا المطلوبة من الآن).
4. النتيجة: فتحات (Slots) قابلة للحجز فعليًا، تُرجَع عبر `GET /v1/stores/{store_id}/resources/{id}/availability`.

## 4. دورة حياة الحجز

```
DRAFT → HOLD → PENDING_PAYMENT → CONFIRMED → CHECKED_IN → COMPLETED
```
مسارات بديلة:
```
HOLD → EXPIRED                          -- لم يُكمل الدفع خلال المهلة
CONFIRMED → CANCELLED → REFUND          -- إلغاء بعد التأكيد
```

- **HOLD**: قفل مؤقت للفتحة الزمنية (عادة 10–15 دقيقة، قابل للتهيئة لكل متجر) لمنع حجز نفس المورد من عميل آخر أثناء إتمام الدفع. يُنفَّذ عبر قفل قصير الأمد في Redis + تسجيل الحالة في `bookings.status = HOLD`، وتُشغَّل مهمة مجدولة (Scheduled Job) تحرّر أي `HOLD` منتهي الصلاحية تلقائيًا إلى `EXPIRED`.
- **منع الحجز المزدوج (Double Booking)**: بالإضافة لمنطق التطبيق، `booking.booking_items.time_range` (عمود `tstzrange`) يُستخدم مع قيد `EXCLUDE USING gist` لمنع تداخل فترتين على نفس المورد على مستوى قاعدة البيانات — خط دفاع ثانٍ مطابق لفلسفة RLS.

## 5. الحزم (Packages) والحجوزات المركّبة

باقة زفاف قد تضم: قاعة + مصور + نقل، كل عنصر له مورد ومدة زمنية مختلفة. `catalog.packages` + `catalog.package_items` تُترجَم عند الحجز إلى عدة `booking.booking_items` مرتبطة بنفس `booking_id` واحد، بحيث تُدار كوحدة واحدة (تأكيد/إلغاء الكل معًا) مع إمكانية عرض تفاصيل كل عنصر على حدة للعميل.
