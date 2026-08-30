# 04 — مصفوفة الأدوار والصلاحيات (RBAC)

## 1. النموذج

لا نربط الصلاحيات بالدور فقط (Role-only)، بل:

```
Role + Permission + Store + Branch
```

- **Role**: مجموعة صلاحيات مُسمّاة (قابلة للتخصيص لكل متجر بخلاف الأدوار النظامية).
- **Permission**: صلاحية ذرية بصيغة `resource.action` (مثل `orders.create`).
- **Store**: كل عضوية (`membership`) مرتبطة بمتجر واحد بالضبط.
- **Branch**: تقييد اختياري، `branch_id = NULL` يعني "كل الفروع".

## 2. الأدوار النظامية الافتراضية

| الدور | الوصف |
|---|---|
| Owner | صلاحيات كاملة على المتجر بلا استثناء |
| Administrator | كل الصلاحيات التشغيلية، بدون حذف المتجر أو نقل الملكية |
| Manager | إدارة يومية: طلبات، حجوزات، مخزون، فريق العمل بدون محاسبة كاملة |
| Accountant | محاسبة، تقارير مالية، مصروفات — بدون تعديل الكاتالوج أو الطلبات |
| Cashier | نقطة بيع: إنشاء طلبات ودفعات، طلب استرجاع (بدون اعتماده) |
| Sales | كاتالوج + عملاء + طلبات، بدون محاسبة أو إعدادات النظام |
| Inventory Manager | مخزون، مستودعات، حركات مخزون |
| Booking Manager | موارد، توفر، حجوزات |
| Marketing | حملات، إشعارات تسويقية، عروض/خصومات |
| Support | عرض الطلبات والعملاء، بدون تعديل مالي |
| Driver | عرض الرحلات المسندة إليه فقط، تحديث حالتها |
| Developer | إدارة تطبيقات المتجر المثبتة، مفاتيح API، Webhooks |

## 3. مصفوفة أمثلة (صلاحيات ذرية)

| الصلاحية | Owner | Administrator | Manager | Accountant | Cashier | Sales | Inventory Manager | Booking Manager | Driver |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `orders.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `orders.cancel` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `payments.create` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `refund.request` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `refund.approve` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `accounting.write` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `accounting.delete` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `inventory.adjust` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `bookings.confirm` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `trips.update_status` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (مُسندة فقط) |
| `apps.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> ملاحظة: `accounting.delete` غير ممنوحة لأي دور افتراضيًا — القيود المحاسبية تُعكَس بقيد عكسي (Reversal Entry) وليس بالحذف. راجع [10-accounting-engine.md](./10-accounting-engine.md).

## 4. Branch Scope

```
Ahmed
 ↓
Store A
 ↓
Branch Medina
```

`Ahmed` لا يرى بيانات `Branch Jeddah` إلا إذا مُنح عضوية إضافية بـ `branch_id = NULL` (كل الفروع) أو عضوية صريحة على `Branch Jeddah`.

قاعدة التحقق في الـ API (بالإضافة إلى RLS):
```
IF request.branch_id NOT IN user.accessible_branch_ids(store_id):
    reject 403
```

## 5. تخصيص الأدوار لكل متجر

التاجر يستطيع:
- إنشاء أدوار مخصصة (`platform.roles.store_id = <store>`, `is_system = false`).
- تعديل صلاحيات الأدوار النظامية داخل حدود ما يسمح به Owner فقط (لا يمكن لأي دور منح صلاحية لا يملكها هو نفسه — **مبدأ عدم تصعيد الصلاحيات - No Privilege Escalation**).

## 6. علاقة هذا المستند بـ RLS

`platform.has_permission()` في [`db/rls_policies.sql`](../../db/rls_policies.sql) يقرأ مباشرة من `role_permissions` و`permissions`، أي أن هذه المصفوفة ليست وثيقة توضيحية فقط، بل **البيانات المرجعية الفعلية** التي تُدرَج كـ Seed Data عند تهيئة أي متجر جديد.
