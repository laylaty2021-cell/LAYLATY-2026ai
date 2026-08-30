# 19 — Monitoring & Observability

## 1. الركائز الثلاث

```
Metrics    → ما يحدث (أرقام عبر الزمن)
Logs       → لماذا حدث (تفاصيل حدث محدد)
Traces     → أين حدث (رحلة الطلب عبر الوحدات/الخدمات)
```

## 2. المقاييس الحرجة (Golden Signals + مقاييس خاصة بليلتي)

| الفئة | مقاييس |
|---|---|
| عامة (كل Endpoint) | Latency (p50/p95/p99), Error Rate, Throughput (RPS) |
| قاعدة البيانات | Connection pool usage, Query latency, Replication lag, RLS-heavy query cost |
| الدفع | معدل نجاح `capture()`, زمن استجابة كل Payment Provider, عدد `INITIATED` عالقة > 5 دقائق |
| الحجز | تعارضات الحجز المكتشفة (`EXCLUDE` violations), نسبة `HOLD → EXPIRED` (مؤشر على تجربة دفع بطيئة) |
| POS Sync | حجم الطابور غير المُزامَن لكل جهاز, نسبة `CONFLICT` من إجمالي المزامنات |
| الأحداث | حجم `event_outbox` بحالة `PENDING` (نمو غير طبيعي = مستهلك متعطل) |
| المخزون | معدل `low_stock` events, فرق `available_qty` المتوقع مقابل الفعلي بعد الجرد |

## 3. التنبيهات (Alerting) — أمثلة عتبات

```
API p99 latency > 1.5s لمدة 5 دقائق             → Warning
Error rate > 2% لمدة 5 دقائق                    → Critical
event_outbox PENDING count > 1000                → Critical (مستهلك معطل)
Payment provider error rate > 5%                 → Critical (تنبيه فوري لفريق الدفع)
Replication lag > 30s                             → Warning
```
كل تنبيه Critical يذهب لقناة استجابة فورية (On-call)، وWarning يُجمَّع في تقرير يومي.

## 4. التتبع الموزَّع (Distributed Tracing)

كل طلب يحمل `trace_id` مُولَّد عند دخوله API Gateway، يُمرَّر عبر كل استدعاء داخلي (حتى داخل الـ Monolith، بين استدعاءات الوحدات) وعبر أي حدث في `event_outbox` (`trace_id` يُخزَّن ضمن الـ payload)، بحيث يمكن ربط: طلب العميل → القيد المحاسبي الناتج → إشعار الدفع، بمعرّف واحد قابل للبحث.

## 5. السجلات (Logs)

- **Structured Logging** (JSON) لا نصوص حرة — كل سطر يحمل حقولًا ثابتة: `timestamp, level, store_id, user_id, trace_id, message`.
- **لا بيانات حساسة في السجلات**: أرقام بطاقات، كلمات مرور، Tokens كاملة — تُخفى جزئيًا (Masking) قبل الكتابة.
- مركزية السجلات في نظام واحد قابل للبحث (مثل ELK/Loki) مع فترة احتفاظ (Retention) لا تقل عن 90 يومًا للسجلات التشغيلية، وأطول للسجلات المتعلقة بالمحاسبة/الدفع تماشيًا مع [18-backup-dr.md](./18-backup-dr.md) ومتطلبات الامتثال.

## 6. لوحات مراقبة (Dashboards) الأساسية لكل متجر

بالإضافة لمراقبة المنصة ككل، كل تاجر يحصل على لوحة صحة تشغيلية مبسّطة ضمن Merchant Dashboard: حالة آخر مزامنة POS، حالة تسليم آخر Webhook، تنبيهات المخزون المنخفض — استهلاكًا مباشرًا لنفس بنية المراقبة دون الحاجة لأداة منفصلة.
