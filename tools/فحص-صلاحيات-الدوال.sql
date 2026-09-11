-- ============================================================
--  فحص صلاحيات دوال قاعدة البيانات
--  ------------------------------------------------------------
--  الصقْه في محرّر SQL في Supabase وشغّله. يُفترض أن يعود **بلا صفوف**.
--
--  ⚠️ لماذا هذا الملف موجود؟
--  لأنني أدخلتُ ثغرة بهذا الشكل بالضبط في ٢٠٢٦-٠٩-١٠:
--  الدالّة latest_attendance كانت SECURITY DEFINER، و PostgreSQL يمنح
--  EXECUTE لـPUBLIC افتراضياً، و Supabase يفتح كل دالّة في المخطّط العام
--  على ‎/rest/v1/rpc/‎. فكانت سياسة attendance_read تمنع الغريب من قراءة
--  جدول الغياب (صفر صفوف)، بينما نداء واحد على
--  ‎/rest/v1/rpc/latest_attendance‎ بمعرّف أي طالب يُعيد غيابه كاملاً
--  **لضيفٍ مجهول لم يسجّل دخوله أصلاً**. بابٌ موصد بجانب نافذة مفتوحة.
--
--  وكنتُ قد كتبتُ التحذير نفسه بيدي على كل دالّة أخرى في الدفعة، ثم
--  نسيتُه على هذه وحدها لأنها "دالّة مساعِدة صغيرة". فالذاكرة ليست
--  حاجزاً — وهذا الاستعلام هو الحاجز.
--
--  ومتى يُشغَّل: بعد كل دفعة تُضيف دوالّ إلى قاعدة البيانات، وقبل أي
--  عرضٍ على مدرسة.
-- ============================================================

with intentionally_public(proname) as (
    values
        -- تربط حساباً جديداً بعضويّة مدرسة: تعمل قبل أن يصير عضواً
        ('link_my_school_account'),
        -- تُعيد عضويّة المُنادي هو (وتعيد لا شيء للضيف)
        ('my_school_membership'),
        -- مسار الدخول باسم المستخدم: يعمل قبل تسجيل الدخول بالضرورة.
        -- ولا يفرّق ردُّه بين "اسم غير موجود" و"كلمة مرور خاطئة".
        ('resolve_username_email'),
        -- بحثٌ عن مدرسة بالاسم المختصر في نموذج طلب الحساب
        ('school_for_request'),
        -- دخول السبورة برمز QR: السبورة غير مسجَّلة الدخول بطبيعتها
        ('screen_login_approve'),
        ('screen_login_peek'),
        ('screen_login_start')
)
select p.proname                              as "الدالّة",
       pg_get_function_arguments(p.oid)       as "الوسائط",
       '⚠️ ينادها ضيفٌ مجهول بلا قصد'         as "الملاحظة"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prosecdef                                   -- SECURITY DEFINER
  and has_function_privilege('anon', p.oid, 'execute')
  and p.proname not in (select proname from intentionally_public)
order by p.proname;

-- ============================================================
--  وفحصٌ ثانٍ: دوالّ المُطلِقات (triggers) لا تكون نقاط نهاية أبداً.
--  نداؤها مباشرةً يفشل بلا سياق مُطلِق، لكن لا معنى لعرضها أصلاً.
-- ============================================================
select p.proname as "دالّة مُطلِق معروضة على الإنترنت"
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prorettype = 'trigger'::regtype
  and (has_function_privilege('anon', p.oid, 'execute')
    or has_function_privilege('authenticated', p.oid, 'execute'))
order by p.proname;
