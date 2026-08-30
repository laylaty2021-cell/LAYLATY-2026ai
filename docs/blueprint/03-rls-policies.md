# 03 — Row-Level Security لكل جدول

الملف التنفيذي: [`db/rls_policies.sql`](../../db/rls_policies.sql).

## 1. المبدأ

```
authenticated user
       ↓
store_membership
       ↓
store_id
       ↓
RLS
       ↓
allowed rows
```

الـ API (طبقة التطبيق) هي **خط الدفاع الأول**، لكن لا نعتمد عليها وحدها. Postgres RLS هو **خط الدفاع الثاني** المستقل: حتى لو كان هناك خطأ برمجي في الـ API يسمح بتمرير `store_id` خاطئ، فإن قاعدة البيانات نفسها تمنع القراءة/الكتابة على صفوف لا يملك المستخدم عضوية فيها.

مثال:
```
User A → Store 100
User B → Store 200
```
إذا حاول `User A` الوصول إلى بيانات `Store 200`، فإن استعلامه يعود بصفر صفوف — بغضّ النظر عمّا يفعله كود التطبيق.

## 2. الآلية

1. **`platform.current_user_store_ids()`**: دالة `SECURITY DEFINER` تُرجع كل `store_id` التي يملك فيها المستخدم الحالي (`auth.uid()`) عضوية نشطة (`memberships.status = 'active'`).
2. **`platform.has_permission(store_id, permission_code, branch_id)`**: تتحقق أن دور المستخدم في هذا المتجر (وهذا الفرع إن وُجد) يملك الصلاحية المطلوبة — تُستخدم في `WITH CHECK` للعمليات الحساسة (دفع، استرجاع، قيود محاسبية).
3. كل جدول تشغيلي:
   ```sql
   alter table <schema>.<table> enable row level security;
   alter table <schema>.<table> force row level security; -- حتى مالك الجدول لا يتجاوز RLS
   create policy <table>_isolation on <schema>.<table>
       using (store_id in (select platform.current_user_store_ids()));
   ```
4. الجداول الفرعية بدون `store_id` مباشر (`order_items`, `variants`) تُعزل عبر `EXISTS`/`IN` مرورًا بالجدول الأب.
5. جداول لا تملك أي Policy صريحة (مثل `integrations.credentials`) تكون **Default-Deny** تلقائيًا لأي دور غير الدور الموثوق للخادم (Service Role الذي يملك `BYPASSRLS` أو دور مخصص بصلاحية صريحة).

## 3. من يملك تجاوز RLS؟

- **Service Role** (يُستخدم فقط من الباك-إند الموثوق، وليس من متصفح العميل) — يُستخدم للعمليات النظامية: قراءة `integrations.credentials`، كتابة `platform.audit_logs`، معالجات الـ Webhooks.
- **لا يوجد** أي دور "Admin عام" يتجاوز RLS من واجهة العميل. لوحة إدارة المنصة (Admin Panel) تستخدم مسارات API خاصة تمر عبر تحقق صلاحيات منفصل (Platform Ops)، وليس اتصالًا مباشرًا بقاعدة البيانات بامتياز `BYPASSRLS`.

## 4. الأداء

- `current_user_store_ids()` تُنفَّذ لكل صف نظريًا، لذا:
  - تُعلَّم الدالة `STABLE` (وليس `VOLATILE`) ليستفيد المخطِّط من التخزين المؤقت داخل نفس الاستعلام.
  - يُفهرس عمود `store_id` في كل جدول (منفَّذ في نهاية `schema.sql`).
  - عند القياس، إن ظهرت كلفة إضافية ملحوظة على جداول عالية الحركة (`pos_transactions`, `stock_movements`)، يُستبدل الاستدعاء بـ `= ANY(current_setting('request.jwt.claims')::jsonb->'store_ids')` (تمرير قائمة المتاجر داخل الـ JWT مباشرة) لتفادي الاستعلام الفرعي.

## 5. اعتماد على Supabase (`auth.uid()`)

`platform.current_user_store_ids()` و`platform.has_permission()` تستدعيان `auth.uid()` — وهي دالة توفّرها Supabase (طبقة GoTrue) أصلًا داخل مشروع Supabase، وليست دالة Postgres قياسية. تم اختبار كل من `db/schema.sql` و`db/rls_policies.sql` فعليًا (تنفيذ كامل بدون أخطاء، 64 جدولًا و33 Policy) على نسخة Postgres عادية بعد إضافة دالة بديلة مؤقتة فقط لأغراض التحقق المحلي:

```sql
create or replace function auth.uid() returns uuid
language sql stable as $$ select null::uuid $$;
```

عند النشر الفعلي على Supabase، هذه الدالة موجودة تلقائيًا ولا حاجة لأي استبدال. عند النشر على Postgres مُدار ذاتيًا (بدون Supabase)، يجب توفير مكافئ حقيقي لها يقرأ هوية المستخدم من الـ JWT الحالي (مثال: `current_setting('request.jwt.claim.sub', true)::uuid`) بدل الدالة الوهمية أعلاه.

## 6. الاختبار الإلزامي

كل Pull Request يضيف جدولًا تشغيليًا جديدًا يجب أن يتضمن:
1. Policy عزل مطابقة للنمط أعلاه.
2. اختبار تكامل (integration test) يحاول الوصول من `User A` إلى بيانات `Store B` ويتحقق من إرجاع صفر نتائج.
