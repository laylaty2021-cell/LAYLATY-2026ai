# 10 — Accounting Engine Specification

## 1. المبدأ: قيد مزدوج (Double-Entry) لكل متجر مستقل

كل متجر يملك دليل حسابات مستقل (`accounting.accounts`, `store_id`-scoped) وفترات مالية مستقلة (`accounting.fiscal_periods`). لا مشاركة بيانات محاسبية بين المتاجر حتى لو كانا يتبعان نفس التاجر (Merchant) — كل `store` كيان محاسبي منفصل.

## 2. القيد اليومي (Journal Entry)

```
journal_entries
 ├── journal_lines (account_id, debit, credit)
```

**قاعدة ثابتة (Invariant)**: `SUM(debit) = SUM(credit)` لكل `journal_entry`، مفروضة بـ:
1. قيد `CHECK (debit >= 0 and credit >= 0)` و`CHECK (not (debit>0 and credit>0))` على مستوى السطر (منفَّذ في `db/schema.sql`).
2. تحقق على مستوى التطبيق (Service Layer) قبل الإدراج: رفض أي قيد لا يتوازن، ضمن معاملة قاعدة بيانات واحدة (Transaction) تضمن إدراج كل الأسطر معًا أو لا شيء.

## 3. مصدر القيود (Reference)

كل قيد يحمل `reference_type` و`reference_id` يربطه بالمصدر التشغيلي:
```
order.completed        → قيد إيراد + ضريبة
payment.captured       → قيد نقدية/بنك مقابل ذمم عملاء
refund.completed       → قيد عكسي جزئي أو كامل
expense.recorded       → قيد مصروف
```
هذا يسمح بالتتبع الكامل: من أي عملية تشغيلية نشأ كل قيد، وبالعكس أي القيود ناتجة عن طلب معيّن.

## 4. لا حذف — فقط عكس (Reversal)

`accounting.delete` **غير ممنوحة لأي دور** (راجع [04-roles-permissions-matrix.md](./04-roles-permissions-matrix.md)). تصحيح خطأ محاسبي يتم بإنشاء **قيد عكسي جديد** يشير إلى القيد الأصلي (`reference_type = 'reversal_of'`, `reference_id = original_entry_id`)، بحيث يبقى السجل التاريخي كاملًا للتدقيق (Audit).

## 5. الفترات المالية

`accounting.fiscal_periods.status ∈ {open, closed}`. إغلاق فترة يمنع إضافة/تعديل قيود بتاريخ ضمنها إلا عبر دور Owner بصلاحية استثنائية موثّقة في Audit Log. القيود بعد الإغلاق تُسجَّل في الفترة الحالية المفتوحة كتسوية (Adjustment) مع إشارة للفترة المتأثرة.

## 6. الضرائب

`accounting.tax_transactions` يسجّل كل ضريبة محسوبة من أي مصدر (`order`, `invoice`, `expense`) بمعدلها (`rate`) ومبلغها (`amount`) بشكل منفصل عن القيد المحاسبي نفسه، لتسهيل توليد إقرارات ضريبة القيمة المضافة (VAT Return) دون الحاجة لتحليل `journal_lines`.

## 7. AI محاسبي (حدود صارمة)

كما ورد في المخطط المعماري: يمكن لـ AI Business Assistant الإجابة على أسئلة تحليلية مثل "ما المصروفات الأعلى هذا الشهر؟" بقراءة `expenses`/`journal_entries` **للقراءة فقط**. **لا يُسمح لأي مكوّن AI بإنشاء أو تعديل قيد محاسبي مباشرة** بدون: (أ) قاعدة عمل صريحة مبرمجة تُنتج القيد بمنطق حتمي، و(ب) اعتماد بشري صريح (Approval) قبل الترحيل النهائي. راجع [12-ai-platform مضمّن ضمن 13-app-marketplace.md](./13-app-marketplace.md) لحدود صلاحيات تطبيقات AI.

## 8. تقارير أساسية مطلوبة في MVP

- ميزان المراجعة (Trial Balance) لكل فترة.
- قائمة الدخل (Revenue - Expenses) لكل فرع/متجر.
- تقرير الضريبة القابل للتصدير (CSV/PDF) لتقديمه للهيئة المختصة.
