-- ============================================================
--  المرحلة ٠ — الأساس لتعدّد المدارس (٢٣ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  ⚠️ قاعدة البيانات واحدة لرابط المعاينة وللإنتاج معاً: كل ما هنا
--  **إضافي** ولا يكسر واجهة khutaa.netlify.app المنشورة حالياً:
--    • جداول وأعمدة ودوالّ جديدة فقط.
--    • رموز المراحل الموجودة ('1','2','3') تبقى صالحة كما هي، والمدرسة
--      الحالية تُزرَع بها حرفياً — فقوائم «أول/ثاني/ثالث ثانوي» الثابتة في
--      الواجهة القديمة تبقى مطابقة.
--    • الحدود (طلاب/تخزين/ذكاء) فارغة افتراضياً = بلا حد = السلوك الحالي.
--  والدالّتان المُعاد كتابتهما (import_school_students, promote_school_year)
--  تحتفظان بتوقيعهما ونتيجتهما للمدرسة الحالية حرفياً.
-- ============================================================

-- ─────────────── ١) مراحل كل مدرسة ───────────────
-- كانت «أول/ثاني/ثالث ثانوي» مكتوبة في الكود. مدرسة متوسطة أو مجمّع
-- تعليمي كانت ستتعطّل. الرمز (code) معرّف ثابت داخلي لا يراه المدير،
-- والاسم (label) هو ما يُعرض ويُعدَّل.
create table if not exists school_grades (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    code        text not null,
    label_ar    text not null,
    label_en    text,
    sort_order  int  not null default 0,
    created_at  timestamptz not null default now(),
    unique (school_id, code)
);
create index if not exists idx_school_grades_school on school_grades(school_id, sort_order);
alter table school_grades enable row level security;

drop policy if exists grades_read on school_grades;
create policy grades_read on school_grades for select to authenticated
    using (my_member_id(school_id) is not null or is_app_admin());
drop policy if exists grades_write_admin on school_grades;
create policy grades_write_admin on school_grades for all to authenticated
    using (is_school_admin(school_id) and google_verified())
    with check (is_school_admin(school_id) and google_verified());

-- الرمز يُولَّد تلقائياً، ولا يتغيّر بعد إنشائه، ولا تُحذف مرحلة فيها أحد:
-- الرمز مخزَّن في school_members.grade وclasses.grade وexam_assignments.grade،
-- فتغييره أو حذفه يُيتّم طلاباً وفصولاً بصمت.
create or replace function trg_school_grade_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'INSERT' then
        if new.code is null or btrim(new.code) = '' then
            select coalesce(max(code::int), 0) + 1 into new.code
              from school_grades where school_id = new.school_id and code ~ '^[0-9]+$';
            new.code := new.code::text;
        end if;
        return new;
    elsif tg_op = 'UPDATE' then
        if new.code <> old.code or new.school_id <> old.school_id then
            raise exception 'GRADE_CODE_IMMUTABLE';
        end if;
        return new;
    else
        -- ⚠️ pg_trigger_depth() = 1 أي حذف مباشر من المدير. حذف المدرسة كلها
        -- يحذف مراحلها تتابعياً (cascade) من داخل مُطلِق آخر، فيكون العمق ٢ —
        -- ولولا هذا الشرط لمنعت مراحلُها حذفَ المدرسة نفسها.
        if pg_trigger_depth() = 1 and (
               exists (select 1 from school_members where school_id = old.school_id and grade = old.code and active)
            or exists (select 1 from classes where school_id = old.school_id and grade = old.code)) then
            raise exception 'GRADE_IN_USE';
        end if;
        return old;
    end if;
end $$;
revoke all on function trg_school_grade_guard() from public, anon;

drop trigger if exists school_grade_guard on school_grades;
create trigger school_grade_guard before insert or update or delete on school_grades
    for each row execute function trg_school_grade_guard();

-- ─────────────── ٢) مواد كل مدرسة ───────────────
create table if not exists school_subjects (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    name_ar     text not null,
    name_en     text,
    sort_order  int  not null default 0,
    active      boolean not null default true,
    created_at  timestamptz not null default now(),
    unique (school_id, name_ar)
);
create index if not exists idx_school_subjects_school on school_subjects(school_id, sort_order);
alter table school_subjects enable row level security;

drop policy if exists subjects_read on school_subjects;
create policy subjects_read on school_subjects for select to authenticated
    using (my_member_id(school_id) is not null or is_app_admin());
drop policy if exists subjects_write_admin on school_subjects;
create policy subjects_write_admin on school_subjects for all to authenticated
    using (is_school_admin(school_id) and google_verified())
    with check (is_school_admin(school_id) and google_verified());

-- ─────────────── ٣) المعلّم ↔ المادة ↔ الفصل ───────────────
-- class_teachers كان يحمل المادة نصاً حرّاً يكتبه المدير («رياضيات»،
-- «الرياضيات»، «رياضيات ١»…) فلا يمكن تجميع درجات مادة واحدة منه.
-- subject_id يربطه بمادة المدرسة. والنصّ يبقى لتوافق الواجهة المنشورة.
alter table class_teachers
    add column if not exists subject_id uuid references school_subjects(id) on delete set null;
create index if not exists idx_class_teachers_subject on class_teachers(subject_id);

-- ─────────────── ٤) البذر ───────────────
-- مراحل افتراضية حسب نوع المدرسة. 'custom' = بلا بذر (يضيفها المدير).
create or replace function seed_school_grades(p_school uuid, p_stage text default 'secondary')
returns void language plpgsql security definer set search_path = public as $$
begin
    if exists (select 1 from school_grades where school_id = p_school) then return; end if;
    if p_stage = 'secondary' then
        insert into school_grades (school_id, code, label_ar, label_en, sort_order) values
            (p_school, '1', 'أول ثانوي',  'Grade 10', 1),
            (p_school, '2', 'ثاني ثانوي', 'Grade 11', 2),
            (p_school, '3', 'ثالث ثانوي', 'Grade 12', 3);
    elsif p_stage = 'middle' then
        insert into school_grades (school_id, code, label_ar, label_en, sort_order) values
            (p_school, '1', 'أول متوسط',  'Grade 7', 1),
            (p_school, '2', 'ثاني متوسط', 'Grade 8', 2),
            (p_school, '3', 'ثالث متوسط', 'Grade 9', 3);
    elsif p_stage = 'primary' then
        insert into school_grades (school_id, code, label_ar, label_en, sort_order) values
            (p_school, '1', 'أول ابتدائي',  'Grade 1', 1),
            (p_school, '2', 'ثاني ابتدائي', 'Grade 2', 2),
            (p_school, '3', 'ثالث ابتدائي', 'Grade 3', 3),
            (p_school, '4', 'رابع ابتدائي', 'Grade 4', 4),
            (p_school, '5', 'خامس ابتدائي', 'Grade 5', 5),
            (p_school, '6', 'سادس ابتدائي', 'Grade 6', 6);
    end if;
end $$;
revoke all on function seed_school_grades(uuid, text) from public, anon, authenticated;

create or replace function seed_school_subjects(p_school uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
    insert into school_subjects (school_id, name_ar, name_en, sort_order)
    select p_school, v.ar, v.en, v.n from (values
        ('الرياضيات',              'Mathematics',          1),
        ('الفيزياء',               'Physics',              2),
        ('الكيمياء',               'Chemistry',            3),
        ('الأحياء',                'Biology',              4),
        ('علم البيئة',             'Environmental Science',5),
        ('اللغة العربية',          'Arabic',               6),
        ('اللغة الإنجليزية',       'English',              7),
        ('الدراسات الإسلامية',     'Islamic Studies',      8),
        ('الدراسات الاجتماعية',    'Social Studies',       9),
        ('الحاسب وتقنية المعلومات','Computer Science',    10),
        ('التفكير الناقد',         'Critical Thinking',   11),
        ('التربية البدنية',        'Physical Education',  12)
    ) as v(ar, en, n)
    on conflict (school_id, name_ar) do nothing;
end $$;
revoke all on function seed_school_subjects(uuid) from public, anon, authenticated;

-- المدرسة الحالية: نفس الرموز الثلاثة حرفياً + المواد الافتراضية + أي مادة
-- كتبها المدير سابقاً نصاً في class_teachers، ثم ربط الإسنادات القائمة بها.
do $$
declare s record;
begin
    for s in select id from schools loop
        perform seed_school_grades(s.id, 'secondary');
        perform seed_school_subjects(s.id);
        insert into school_subjects (school_id, name_ar, sort_order)
        select distinct c.school_id, btrim(ct.subject), 100
          from class_teachers ct join classes c on c.id = ct.class_id
         where c.school_id = s.id and nullif(btrim(ct.subject), '') is not null
        on conflict (school_id, name_ar) do nothing;
    end loop;

    update class_teachers ct set subject_id = ss.id
      from classes c, school_subjects ss
     where c.id = ct.class_id and ss.school_id = c.school_id
       and ss.name_ar = btrim(ct.subject) and ct.subject_id is null;
end $$;

-- ─────────────── ٥) قراءة الإعدادات ───────────────
-- قائمة المراحل مرتّبة، مع احتياط: مدرسة بلا مراحل تُعامل كثانوية
-- (هكذا كانت كل الدوالّ تعاملها قبل اليوم) — فلا تنكسر مدرسة نُسي ضبطها.
create or replace function school_grade_list(p_school uuid)
returns table(code text, label_ar text, label_en text, sort_order int)
language sql stable security definer set search_path = public as $$
    select g.code, g.label_ar, g.label_en, g.sort_order
      from school_grades g where g.school_id = p_school
    union all
    select d.code, d.label_ar, d.label_en, d.sort_order
      from (values ('1','أول ثانوي','Grade 10',1),('2','ثاني ثانوي','Grade 11',2),('3','ثالث ثانوي','Grade 12',3))
           as d(code, label_ar, label_en, sort_order)
     where not exists (select 1 from school_grades where school_id = p_school)
$$;
revoke all on function school_grade_list(uuid) from public, anon, authenticated;

-- ما تحتاجه الواجهة لرسم القوائم. يُقرأ أيضاً في نموذج طلب الانضمام، أي
-- قبل أن يصير الشخص عضواً — فلا يُشترط العضوية، بل حساب مسجَّل فقط.
-- أسماء المراحل والمواد ليست سرّاً.
create or replace function school_settings(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object(
        'grades', coalesce((select jsonb_agg(jsonb_build_object(
                    'code', code, 'label_ar', label_ar, 'label_en', label_en, 'sort', sort_order)
                    order by sort_order, code) from school_grade_list(p_school)), '[]'::jsonb),
        'subjects', coalesce((select jsonb_agg(jsonb_build_object(
                    'id', id, 'name_ar', name_ar, 'name_en', name_en, 'sort', sort_order, 'active', active)
                    order by sort_order, name_ar) from school_subjects where school_id = p_school), '[]'::jsonb)
    );
$$;
revoke all on function school_settings(uuid) from public, anon;
grant execute on function school_settings(uuid) to authenticated;

-- ما يدرّسه المعلّم الحالي: فصل + مادة. أساس «قاعدة بيانات المعلّم».
create or replace function my_teaching(p_school uuid)
returns table(class_id uuid, class_name text, grade text, section text,
              subject_id uuid, subject_name text)
language sql stable security definer set search_path = public as $$
    select c.id, c.name, c.grade, c.section, ct.subject_id,
           coalesce(ss.name_ar, ct.subject)
      from class_teachers ct
      join classes c on c.id = ct.class_id
      join school_members m on m.id = ct.teacher_id
      left join school_subjects ss on ss.id = ct.subject_id
     where m.school_id = p_school and m.uid = auth.uid() and m.active;
$$;
revoke all on function my_teaching(uuid) from public, anon;
grant execute on function my_teaching(uuid) to authenticated;

-- ─────────────── ٦) الترقية السنوية حسب مراحل المدرسة ───────────────
-- كانت: ثالث يتخرّج، ٢←٣، ١←٢ — مكتوبة حرفياً. الآن: آخر مرحلة في
-- الترتيب تتخرّج، وكل مرحلة تصعد للتي بعدها. للمدرسة الحالية النتيجة مطابقة.
--
-- ⚠️ الترقية في عبارة UPDATE واحدة: كل صفّ يُقرأ من لقطة ما قبل التعديل،
-- فلا يصعد طالبٌ مرحلتين (المشكلة التي كتبها التعليق القديم: «جرّبتها»).
-- والتخرّج قبلها في عبارة مستقلّة، فمن صعد للتوّ للأخيرة لا يتخرّج معهم.
create or replace function public.promote_school_year(p_school uuid, p_year_label text default null, p_hold_back uuid[] default '{}'::uuid[])
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
    v_promoted int; v_graduated int; v_held int; v_archived int;
    v_purge timestamptz;
begin
    if not is_school_admin(p_school) then raise exception 'NOT_ALLOWED'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;

    v_purge := now() + interval '7 days';
    v_held := coalesce(array_length(p_hold_back, 1), 0);

    /* أرشفة عمل السنة المنتهية — يختفي عن الطالب في هذه اللحظة */
    with a as (update teacher_exams set archived_at = now()
                where school_id = p_school and archived_at is null returning 1)
    select count(*) into v_archived from a;
    update teacher_files set archived_at = now() where school_id = p_school and archived_at is null;
    update teacher_links set archived_at = now() where school_id = p_school and archived_at is null;

    /* آخر مرحلة تتخرّج: تخرج من منصّة المدرسة ويبقى حسابها في خُطى.
       ⚠️ لا نمسّ auth.users ولا user_data — قرار المالك. */
    with ordered as (
        select code, lead(code) over (order by sort_order, code) as next_code
          from school_grade_list(p_school)
    ), g as (
        update school_members m set active = false
          from ordered o
         where m.school_id = p_school and m.role = 'student' and m.active
           and m.grade = o.code and o.next_code is null
           and not (m.id = any(p_hold_back))
        returning 1)
    select count(*) into v_graduated from g;

    with ordered as (
        select code, lead(code) over (order by sort_order, code) as next_code
          from school_grade_list(p_school)
    ), p as (
        update school_members m set grade = o.next_code
          from ordered o
         where m.school_id = p_school and m.role = 'student' and m.active
           and m.grade = o.code and o.next_code is not null
           and not (m.id = any(p_hold_back))
        returning 1)
    select count(*) into v_promoted from p;

    update schools
       set year_label = coalesce(nullif(trim(p_year_label), ''), year_label),
           year_started_at = now(),
           archive_purge_at = v_purge
     where id = p_school;

    return jsonb_build_object(
        'archived', v_archived, 'promoted', v_promoted,
        'graduated', v_graduated, 'held_back', v_held,
        'purge_at', v_purge
    );
end $function$;

-- ============================================================
--  الجزء (ب): حدود كل مدرسة + لوحة المالك
-- ============================================================

-- ─────────────── ٧) الحدود ───────────────
-- فارغ = بلا حد (السلوك الحالي). يضبطها المالك وحده من لوحته.
alter table schools
    add column if not exists max_students        int check (max_students is null or max_students >= 0),
    add column if not exists storage_limit_mb    int check (storage_limit_mb is null or storage_limit_mb >= 0),
    add column if not exists ai_daily_per_member int check (ai_daily_per_member is null or ai_daily_per_member >= 0);

-- التخزين الفعلي من الدلوين معاً. المسار دائماً ‎<school>/<member>/…‎ في
-- كليهما (مفروض أصلاً في سياسات الرفع)، فالجزء الأول هو المدرسة.
create or replace function school_storage_bytes(p_school uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
    select coalesce(sum((o.metadata->>'size')::bigint), 0)
      from storage.objects o
     where o.bucket_id in ('teacher-files', 'exam-images')
       and split_part(o.name, '/', 1) = p_school::text;
$$;
revoke all on function school_storage_bytes(uuid) from public, anon, authenticated;

-- تُستدعى من سياسة الرفع نفسها (بصلاحية المستخدم)، فيلزم منحها لـauthenticated.
-- ⚠️ حدّ ناعم: يُمنع الرفع متى بلغ المستعمَلُ الحدّ، فقد يتجاوزه آخر ملف
-- بحجمه (٢٥ ميجا كحد أقصى). حجم الملف الجديد غير معروف وقت تقييم السياسة.
create or replace function school_storage_has_room(p_school_text text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_limit int;
begin
    if p_school_text is null or p_school_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        return false;
    end if;
    select storage_limit_mb into v_limit from schools where id = p_school_text::uuid;
    if v_limit is null then return true; end if;
    return school_storage_bytes(p_school_text::uuid) < v_limit::bigint * 1024 * 1024;
end $$;
revoke all on function school_storage_has_room(text) from public, anon;
grant execute on function school_storage_has_room(text) to authenticated;

-- للواجهة: كم استُعمل من كم — قبل أن يرفع المعلّم ملفاً فيُرفض بعد انتظاره.
create or replace function school_storage_status(p_school uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if my_member_id(p_school) is null and not is_app_admin() then raise exception 'NOT_IN_SCHOOL'; end if;
    return jsonb_build_object(
        'used_bytes', school_storage_bytes(p_school),
        'limit_mb',   (select storage_limit_mb from schools where id = p_school));
end $$;
revoke all on function school_storage_status(uuid) from public, anon;
grant execute on function school_storage_status(uuid) to authenticated;

-- سياستا الرفع كما هما حرفياً + شرط المساحة
drop policy if exists exam_images_insert on storage.objects;
create policy exam_images_insert on storage.objects for insert to authenticated
    with check ((bucket_id = 'exam-images') and google_verified() and (exists (
        select 1 from school_members m
         where m.uid = auth.uid() and m.active
           and m.role = any (array['teacher'::school_role, 'admin'::school_role])
           and (m.school_id)::text = split_part(objects.name, '/', 1)
           and (m.id)::text = split_part(objects.name, '/', 2)))
        and school_storage_has_room(split_part(objects.name, '/', 1)));

drop policy if exists school_files_insert on storage.objects;
create policy school_files_insert on storage.objects for insert to authenticated
    with check ((bucket_id = 'teacher-files') and google_verified() and (exists (
        select 1 from school_members m
         where m.uid = auth.uid() and m.active
           and m.role = any (array['teacher'::school_role, 'admin'::school_role])
           and (m.school_id)::text = split_part(objects.name, '/', 1)
           and (m.id)::text = split_part(objects.name, '/', 2)))
        and school_storage_has_room(split_part(objects.name, '/', 1)));

-- حدّ الطلاب: مُطلِق واحد يحرس كل طرق الإضافة (يدوي، قبول طلب، استيراد،
-- إعادة تفعيل). القفل الاستشاري يمنع طلبين متزامنين من تجاوز الحد معاً.
create or replace function trg_school_student_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max int; v_n int;
begin
    if new.role <> 'student' or not new.active then return new; end if;
    if tg_op = 'UPDATE' and old.role = 'student' and old.active and old.school_id = new.school_id then
        return new;
    end if;
    select max_students into v_max from schools where id = new.school_id;
    if v_max is null then return new; end if;
    perform pg_advisory_xact_lock(hashtext('student_limit:' || new.school_id::text));
    select count(*) into v_n from school_members
     where school_id = new.school_id and role = 'student' and active and id <> new.id;
    if v_n >= v_max then raise exception 'STUDENT_LIMIT'; end if;
    return new;
end $$;
revoke all on function trg_school_student_limit() from public, anon, authenticated;

drop trigger if exists school_student_limit on school_members;
create trigger school_student_limit before insert or update of role, active, school_id on school_members
    for each row execute function trg_school_student_limit();

revoke all on function trg_school_grade_guard() from authenticated;

-- الاستيراد الجماعي: (١) المرحلة تُقبل إن كانت من مراحل المدرسة لا '1','2','3'
-- الثابتة. (٢) بلوغ حد الطلاب يتخطّى الصفّ ويذكر السبب بدل إسقاط الملف كله —
-- الإدراج ذرّي، و‎raise‎ واحد من المُطلِق كان سيُلغي كل الصفوف السابقة.
create or replace function public.import_school_students(p_admin_member uuid, p_school uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
    r            jsonb;
    v_name       text;
    v_hash       text;
    v_last4      text;
    v_grade      text;
    v_section    text;
    v_email      text;
    v_grade_code text;
    v_existing   uuid;
    n_added      int := 0;
    n_updated    int := 0;
    n_skipped    int := 0;
    v_errors     jsonb := '[]'::jsonb;
    v_idx        int := 0;
begin
    if not exists (
        select 1 from school_members
        where id = p_admin_member and school_id = p_school
          and role = 'admin' and active
    ) then
        raise exception 'NOT_ADMIN';
    end if;

    if jsonb_typeof(p_rows) <> 'array' then raise exception 'BAD_ROWS'; end if;
    if jsonb_array_length(p_rows) > 2000 then raise exception 'TOO_MANY_ROWS'; end if;

    for r in select * from jsonb_array_elements(p_rows) loop
        v_idx := v_idx + 1;

        v_name    := btrim(coalesce(r->>'name', ''));
        v_hash    := lower(btrim(coalesce(r->>'id_hash', '')));
        v_last4   := btrim(coalesce(r->>'id_last4', ''));
        v_grade   := nullif(btrim(coalesce(r->>'grade', '')), '');
        v_section := nullif(btrim(coalesce(r->>'section', '')), '');
        v_email   := lower(nullif(btrim(coalesce(r->>'email', '')), ''));

        if length(v_name) < 2 then
            n_skipped := n_skipped + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'BAD_NAME');
            continue;
        end if;
        if v_hash !~ '^[0-9a-f]{64}$' then
            n_skipped := n_skipped + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'BAD_ID', 'name', v_name);
            continue;
        end if;
        -- المرحلة بالرمز أو باسمها كما تكتبه المدرسة («أول متوسط»). ما لا يطابق يُترك فارغاً.
        if v_grade is not null then
            select g.code into v_grade_code from school_grade_list(p_school) g
             where g.code = v_grade or btrim(g.label_ar) = v_grade
             order by (g.code = v_grade) desc limit 1;
            v_grade := v_grade_code;
        end if;
        if v_email is not null and position('@' in v_email) = 0 then v_email := null; end if;

        select id into v_existing from school_members
         where school_id = p_school and national_id_hash = v_hash limit 1;

        if v_existing is null and v_email is not null then
            select id into v_existing from school_members
             where school_id = p_school and lower(email) = v_email
               and national_id_hash is null limit 1;
        end if;

        begin
            if v_existing is not null then
                update school_members set
                    national_id_hash  = v_hash,
                    national_id_last4 = nullif(v_last4, ''),
                    full_name = v_name,
                    grade     = coalesce(v_grade, grade),
                    section   = coalesce(norm_section(v_section), section),
                    email     = coalesce(v_email, email),
                    active    = true
                where id = v_existing;
                n_updated := n_updated + 1;
            else
                insert into school_members
                    (school_id, national_id_hash, national_id_last4, full_name, grade, section, email, role, active)
                values
                    (p_school, v_hash, nullif(v_last4, ''), v_name, v_grade, norm_section(v_section), v_email, 'student', true);
                n_added := n_added + 1;
            end if;
        exception when raise_exception then
            if sqlerrm <> 'STUDENT_LIMIT' then raise; end if;
            n_skipped := n_skipped + 1;
            v_errors := v_errors || jsonb_build_object('row', v_idx, 'reason', 'STUDENT_LIMIT', 'name', v_name);
        end;
    end loop;

    return jsonb_build_object(
        'added', n_added, 'updated', n_updated, 'skipped', n_skipped,
        'errors', v_errors);
end $function$;

-- ⚠️ لا تُنادى إلا من الخادم (netlify/functions/school-import.js بمفتاح الخدمة، بعد
-- التحقق من أن المستدعي مدير بإثبات Google). p_admin_member يمرّره الخادم لا المتصفّح.
-- (create or replace يُبقي صلاحيات الدالّة كما كانت؛ كتبناها هنا صراحةً كي لا يظنّ
-- قارئ الملف — أو مدقّق — أنها مفتوحة. نبّه عليه تدقيق خارجي ٢٤ سبتمبر.)
revoke all on function public.import_school_students(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_school_students(uuid, uuid, jsonb) to service_role;

-- حدّ الذكاء الاصطناعي اليومي لعضو مدرسة. تقرؤه gemini-proxy.js بمفتاح
-- الخدمة وحده — لا حاجة لأي مستخدم أن يناديها.
create or replace function ai_daily_limit_for(p_uid uuid)
returns int language sql stable security definer set search_path = public as $$
    select s.ai_daily_per_member
      from school_members m join schools s on s.id = m.school_id
     where m.uid = p_uid and m.active and s.ai_daily_per_member is not null
     order by s.ai_daily_per_member desc
     limit 1;
$$;
revoke all on function ai_daily_limit_for(uuid) from public, anon, authenticated;
grant execute on function ai_daily_limit_for(uuid) to service_role;

-- ─────────────── ٨) لوحة المالك ───────────────
-- كلها محصورة في is_app_admin() (جدول app_admins)، والتعديل يشترط دخول
-- Google خلال ١٢ ساعة كبقية العمليات الحسّاسة.
--
-- ⚠️ البريد لا يُضاف مديراً لمدرسة وهو عضو نشط في أخرى: my_school_membership
-- تُرجع عضوية واحدة للحساب، فكان سيدخل إحدى المدرستين عشوائياً بلا تفسير.

create or replace function owner_list_schools()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'name_ar', s.name_ar, 'name_en', s.name_en,
        'created_at', s.created_at,
        'max_students', s.max_students, 'storage_limit_mb', s.storage_limit_mb,
        'ai_daily_per_member', s.ai_daily_per_member,
        'students', (select count(*) from school_members m where m.school_id = s.id and m.role = 'student' and m.active),
        'teachers', (select count(*) from school_members m where m.school_id = s.id and m.role = 'teacher' and m.active),
        'admins', coalesce((select jsonb_agg(jsonb_build_object(
                        'name', m.full_name, 'email', m.email, 'linked', m.uid is not null)
                        order by m.created_at)
                    from school_members m where m.school_id = s.id and m.role = 'admin' and m.active), '[]'::jsonb),
        'storage_bytes', school_storage_bytes(s.id),
        'ai_today', (select coalesce(sum(q.day_count), 0) from ai_usage_quota q
                       join school_members m on m.uid = q.user_id
                      where m.school_id = s.id and m.active
                        and q.day_date = (now() at time zone 'utc')::date)
    ) order by s.created_at) from schools s), '[]'::jsonb);
end $$;
revoke all on function owner_list_schools() from public, anon;
grant execute on function owner_list_schools() to authenticated;

create or replace function owner_email_elsewhere(p_email text, p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from school_members
                    where lower(email) = lower(p_email) and active
                      and (p_school is null or school_id <> p_school));
$$;
revoke all on function owner_email_elsewhere(text, uuid) from public, anon, authenticated;

create or replace function owner_create_school(p_slug text, p_name_ar text, p_name_en text,
                                               p_stage text, p_admin_email text, p_admin_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
    v_id uuid;
    v_slug text := lower(btrim(coalesce(p_slug, '')));
    v_email text := lower(btrim(coalesce(p_admin_email, '')));
    v_stage text := coalesce(nullif(btrim(p_stage), ''), 'secondary');
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    if v_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'BAD_SLUG'; end if;
    if exists (select 1 from schools where slug = v_slug) then raise exception 'SLUG_TAKEN'; end if;
    if length(btrim(coalesce(p_name_ar, ''))) < 3 then raise exception 'BAD_NAME'; end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
    if v_stage not in ('secondary', 'middle', 'primary', 'custom') then raise exception 'BAD_STAGE'; end if;
    if owner_email_elsewhere(v_email, null) then raise exception 'EMAIL_IN_OTHER_SCHOOL'; end if;

    insert into schools (slug, name_ar, name_en)
    values (v_slug, btrim(p_name_ar), nullif(btrim(coalesce(p_name_en, '')), ''))
    returning id into v_id;

    perform seed_school_grades(v_id, v_stage);
    perform seed_school_subjects(v_id);

    insert into school_members (school_id, email, role, full_name, active)
    values (v_id, v_email, 'admin',
            coalesce(nullif(btrim(coalesce(p_admin_name, '')), ''), split_part(v_email, '@', 1)), true);
    return v_id;
end $$;
revoke all on function owner_create_school(text, text, text, text, text, text) from public, anon;
grant execute on function owner_create_school(text, text, text, text, text, text) to authenticated;

create or replace function owner_update_school(p_school uuid, p_name_ar text, p_name_en text,
                                               p_max_students int, p_storage_limit_mb int, p_ai_daily_per_member int)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    if length(btrim(coalesce(p_name_ar, ''))) < 3 then raise exception 'BAD_NAME'; end if;
    if coalesce(p_max_students, 0) < 0 or coalesce(p_storage_limit_mb, 0) < 0
       or coalesce(p_ai_daily_per_member, 0) < 0 then raise exception 'BAD_LIMIT'; end if;
    update schools set
        name_ar = btrim(p_name_ar),
        name_en = nullif(btrim(coalesce(p_name_en, '')), ''),
        max_students = p_max_students,
        storage_limit_mb = p_storage_limit_mb,
        ai_daily_per_member = p_ai_daily_per_member
     where id = p_school;
    if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function owner_update_school(uuid, text, text, int, int, int) from public, anon;
grant execute on function owner_update_school(uuid, text, text, int, int, int) to authenticated;

create or replace function owner_set_school_admin(p_school uuid, p_email text, p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_id uuid;
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    if not exists (select 1 from schools where id = p_school) then raise exception 'NOT_FOUND'; end if;
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'BAD_EMAIL'; end if;
    if owner_email_elsewhere(v_email, p_school) then raise exception 'EMAIL_IN_OTHER_SCHOOL'; end if;

    insert into school_members (school_id, email, role, full_name, active)
    values (p_school, v_email, 'admin',
            coalesce(nullif(btrim(coalesce(p_name, '')), ''), split_part(v_email, '@', 1)), true)
    on conflict (school_id, email) do update
        set role = 'admin', active = true,
            full_name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), school_members.full_name)
    returning id into v_id;
    return v_id;
end $$;
revoke all on function owner_set_school_admin(uuid, text, text) from public, anon;
grant execute on function owner_set_school_admin(uuid, text, text) to authenticated;

-- ============================================================
--  الجزء (ج): روابط الانضمام لكل مدرسة
-- ============================================================
-- ⚠️ توافق خلفي ضروري: روابط ‎?apply=‎ الموزّعة سابقاً (بلا ‎?school=‎) كانت
-- تعمل لأن المدرسة واحدة فقط. أول مدرسة ثانية تُنشأ — ولو للتجربة على رابط
-- المعاينة، فالقاعدة واحدة مع الإنتاج — كانت ستكسر تلك الروابط على الموقع
-- الحيّ فوراً («تعذّر تحديد المدرسة»). فبلا slug نعود للمدرسة الأقدم: كل
-- الروابط القديمة وُزّعت لها. أما slug مكتوب ولا يطابق فلا نخمّن أبداً —
-- خطأ إملائي لا يجوز أن يرسل طلب طالب لمدرسة أخرى.
create or replace function public.school_for_request(p_slug text default null)
returns uuid language plpgsql stable security definer set search_path to 'public' as $function$
declare v_id uuid;
begin
    if p_slug is not null and btrim(p_slug) <> '' then
        select id into v_id from schools where slug = lower(btrim(p_slug)) limit 1;
        return v_id;
    end if;
    select id into v_id from schools order by created_at, id limit 1;
    return v_id;
end $function$;

-- اسم المدرسة لنموذج الطلب: مع تعدّد المدارس يجب أن يرى المتقدّم لأي مدرسة
-- يُرسل طلبه. الاسم ليس سرّاً، لكنه لحساب مسجَّل فقط (النموذج يشترطه أصلاً).
create or replace function school_request_info(p_slug text default null)
returns jsonb language sql stable security definer set search_path = public as $$
    select jsonb_build_object('id', s.id, 'slug', s.slug, 'name_ar', s.name_ar, 'name_en', s.name_en)
      from schools s where s.id = school_for_request(p_slug);
$$;
revoke all on function school_request_info(text) from public, anon;
grant execute on function school_request_info(text) to authenticated;
