-- ============================================================
--  المرحلة ٧ — من يقرأ صورة السؤال = من يقرأ السؤال نفسه
--  ------------------------------------------------------------
--  (٢٤ سبتمبر) أثناء تحسين عرض صور الاختبارات وفق دليل المالك.
--
--  ما كان: سياسة exam_images_select تسمح لأي عضو نشِط في المدرسة بقراءة
--  أي صورة في مجلّد مدرسته. والمسار عشوائي (UUID) فلا يُخمَّن — لكنه
--  **يُسرَد**: sb.storage.from('exam-images').list('<مدرسة>/<معلّم>')
--  يعيد أسماء كل الصور لأن السرد نفسه SELECT على storage.objects. فكان
--  الطالب يقدر يسرد مجلّد معلّمه ويوقّع صور **شرح الحل** (رسم المعلّم
--  بخطّ يده غالباً = الحلّ نفسه) قبل أن يسلّم — بينما get_exam_for_student
--  يحذف explanation عمداً كي لا يصله قبل التسليم. أي: الخادم يخفي الشرح
--  من السطر، والمخزن يكشفه من الملفّ.
--
--  الإصلاح (قاعدة الدليل الخامسة): شرط الملفّ يُشتقّ من شرط السطر نفسه،
--  لا يُكتب بمعزل عنه:
--    • المعلّم والمدير في المدرسة: كما كان (يبنون الاختبارات ويراجعونها).
--    • الطالب: الصورة مقروءة فقط إن كانت في سؤال/خيار من اختبار يصله فعلاً
--      عبر get_exam_for_student (منشور، غير مؤرشف، مُسنَد إليه)، أو يصله
--      عبر get_exam_review (may_review_exam). وصورة **الشرح** لا تُقرأ إلا
--      عبر الثاني — أي بعد التسليم تماماً كالشرح النصّي.
--  فأيّ تغيير مستقبلي في «من يرى الاختبار» ينتقل للصور تلقائياً، لأنها
--  تنادي الدوالّ نفسها لا نسخةً من شروطها.
--
--  آمن على الإنتاج المشترك: لا جدول ولا عمود؛ دالّة جديدة + استبدال سياسة
--  القراءة وحدها. الرفع والحذف كما هما.
-- ============================================================

create or replace function public.exam_image_readable(p_name text)
returns boolean
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare v_school uuid; v_role school_role; v_p jsonb;
begin
    if p_name is null or p_name !~ '^[0-9a-f-]{36}/' then return false; end if;
    v_school := split_part(p_name, '/', 1)::uuid;

    select m.role into v_role from school_members m
     where m.school_id = v_school and m.uid = auth.uid() and m.active limit 1;
    if v_role is null then return false; end if;
    if v_role in ('admin', 'teacher') then return true; end if;

    v_p := jsonb_build_object('p', p_name);
    return exists (
        select 1 from teacher_exams e
         where e.school_id = v_school
           and (
                -- صورة سؤال أو خيار: كما يراها get_exam_for_student قبل التسليم…
                (jsonb_path_exists(coalesce(e.questions, '[]'::jsonb),
                     '$[*] ? (@.image == $p || @.choices[*].image == $p)', v_p)
                 and ((e.published and e.archived_at is null and exam_is_assigned_to_me(e.id, v_school))
                      or may_review_exam(e.id)))
                -- …وصورة الشرح: كما يراها get_exam_review بعده فقط
             or (jsonb_path_exists(coalesce(e.questions, '[]'::jsonb),
                     '$[*].explanation.image ? (@ == $p)', v_p)
                 and may_review_exam(e.id))
           )
    );
end $function$;

revoke all on function public.exam_image_readable(text) from public, anon;
grant execute on function public.exam_image_readable(text) to authenticated;

drop policy if exists exam_images_select on storage.objects;
create policy exam_images_select on storage.objects for select to authenticated
    using (bucket_id = 'exam-images' and public.exam_image_readable(name));
