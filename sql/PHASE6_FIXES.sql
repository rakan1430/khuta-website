-- ============================================================
--  إصلاحات ملاحظات المالك بعد المراحل ٠–٥ (٢٤ سبتمبر ٢٠٢٦)
-- ============================================================

-- ─────────── ١) مساحة القدرات: تصل لكل طلاب المدرسة دون استثناء ───────────
-- قول المالك: «ستصل لكل طلاب المدرسة دون استثناء لأن هذه ليست مواد مدرسية بل
-- قدرات». فاختبار التدريب المنشور يُعدّ مُسنَداً لكل طالب في مدرسته — بلا
-- اختيار فصول ولا مراحل. (العدّ والدرجات تبقى كما في المرحلة ٣: عدد فقط.)
create or replace function exam_is_assigned_to_me(p_exam uuid, p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from exam_assignments a
        where a.exam_id = p_exam
          and (
               a.class_id in (select my_class_ids(p_school))
            or a.student_id = my_member_id(p_school)
            or (a.grade is not null and a.grade = (
                    select m.grade from school_members m
                    where m.id = my_member_id(p_school)))
          )
    ) or exists (
        select 1 from teacher_exams e
         where e.id = p_exam and e.school_id = p_school and e.kind = 'practice'
           and my_member_id(p_school) is not null
    );
$$;

-- وملفات القدرات وروابطها كذلك: لكل طالب في المدرسة (لا طلاب فصول المعلّم وحدهم)
drop policy if exists files_student_read on teacher_files;
create policy files_student_read on teacher_files for select to authenticated using (
    shared and my_role(school_id) = 'student'::school_role
    and (
        (space = 'gat')
        or (((grade is null) or (grade = my_grade(school_id)))
            and (member_is_admin(owner_id) or teacher_teaches_my_class(owner_id, school_id)))
    ));
drop policy if exists links_student_read on teacher_links;
create policy links_student_read on teacher_links for select to authenticated using (
    shared and my_role(school_id) = 'student'::school_role
    and (space = 'gat' or member_is_admin(owner_id) or teacher_teaches_my_class(owner_id, school_id)));

-- ─────────── ٢) المكتبة: أي رابط، وكتب PDF يرفعها المعلّم أو الإدارة ───────────
-- قول المالك: «اجعله يمكن وضع أي رابط وأنا سأعطي المدرسة التعليمات». فيبقى
-- الشرط الوحيد https (لا javascript: ولا روابط محلية).
alter table school_books drop constraint if exists school_books_ein_url_check;
alter table school_books add constraint school_books_ein_url_check
    check (ein_url is null or ein_url ~* '^https://[^\s<>"]+$');

-- وكتاب PDF يرفعه المعلّم أو الإدارة (ملازمه وكتبه هو)، حدّ ٢ لكل رافع.
-- الطالب يشاهده ويرسم فوقه للحل دون حفظ (في الواجهة) — لا تنزيل له في الواجهة.
alter table school_books add column if not exists pdf_path text;
alter table school_books add column if not exists pdf_size bigint;

create or replace function trg_school_book_pdf_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if tg_op = 'INSERT' then
        new.created_by := coalesce(my_member_id(new.school_id), new.created_by);
    end if;
    if new.pdf_path is not null then
        if split_part(new.pdf_path, '/', 1) <> new.school_id::text then raise exception 'PDF_PATH_INVALID'; end if;
        if (select count(*) from school_books b
             where b.created_by = new.created_by and b.pdf_path is not null and b.id <> new.id) >= 2 then
            raise exception 'PDF_BOOK_LIMIT';
        end if;
    end if;
    return new;
end $$;
revoke all on function trg_school_book_pdf_limit() from public, anon, authenticated;
drop trigger if exists trg_school_book_pdf_limit on school_books;
create trigger trg_school_book_pdf_limit before insert or update on school_books
    for each row execute function trg_school_book_pdf_limit();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('school-books', 'school-books', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

-- المسار: <المدرسة>/<العضو>/<رمز>.pdf — يرفع الطاقم في مجلّده، بحدود مساحة المدرسة
drop policy if exists school_books_obj_insert on storage.objects;
create policy school_books_obj_insert on storage.objects for insert to authenticated with check (
    bucket_id = 'school-books' and google_verified()
    and exists (select 1 from school_members m
                 where m.uid = auth.uid() and m.active and m.role in ('teacher','admin')
                   and m.school_id::text = split_part(name, '/', 1) and m.id::text = split_part(name, '/', 2))
    and school_storage_has_room(split_part(name, '/', 1)));
-- يقرؤه أي عضو في المدرسة ما دام كتاباً مسجّلاً
drop policy if exists school_books_obj_select on storage.objects;
create policy school_books_obj_select on storage.objects for select to authenticated using (
    bucket_id = 'school-books'
    and exists (select 1 from school_books b where b.pdf_path = objects.name
                  and my_member_id(b.school_id) is not null));
drop policy if exists school_books_obj_delete on storage.objects;
create policy school_books_obj_delete on storage.objects for delete to authenticated using (
    bucket_id = 'school-books' and google_verified()
    and exists (select 1 from school_members m
                 where m.uid = auth.uid() and m.active and m.school_id::text = split_part(name, '/', 1)
                   and (m.id::text = split_part(name, '/', 2) or m.role = 'admin')));

-- مساحة المدرسة تحسب الكتب أيضاً
create or replace function school_storage_bytes(p_school uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
    select coalesce(sum((o.metadata->>'size')::bigint), 0)
      from storage.objects o
     where o.bucket_id in ('teacher-files', 'exam-images', 'school-books')
       and split_part(o.name, '/', 1) = p_school::text;
$$;

-- ─────────── ٣) ترقية السنة برمز تحقق من البريد — مفروض في القاعدة ───────────
-- قول المالك: «الأزرار التي تقوم بإجراء حساس … عليها طبقة أمان إضافية: أن يرسل
-- النظام رسالة تأكيد برمز تحقق لإيميل الإداري يكتبه لتأكيد الإجراء».
--
-- ⚠️ الرمز في القاعدة لا في الواجهة: الدالّة القديمة promote_school_year(3 معاملات)
-- أُعيدت تسميتها ولم تعد قابلة للنداء من المتصفّح، وحلّت محلّها دالّة تشترط رمزاً
-- صالحاً (١٠ دقائق، ٥ محاولات، مرة واحدة). فحتى من يستدعي القاعدة مباشرةً —
-- أو زرّ الموقع المنشور القديم — لا يرقّي بلا رمز.
-- والرمز نفسه لا يُخزَّن: بصمته sha256(الرمز:معرّف العضو). يولّده ويرسله
-- netlify/functions/sensitive-code.js بمفتاح الخدمة.
create table if not exists sensitive_action_codes (
    id          uuid primary key default gen_random_uuid(),
    member_id   uuid not null references school_members(id) on delete cascade,
    school_id   uuid not null references schools(id) on delete cascade,
    action      text not null check (action in ('promote_year')),
    code_hash   text not null,
    attempts    int  not null default 0,
    created_at  timestamptz not null default now(),
    expires_at  timestamptz not null default now() + interval '10 minutes',
    used_at     timestamptz
);
create index if not exists sensitive_action_codes_idx on sensitive_action_codes (member_id, action, created_at desc);
alter table sensitive_action_codes enable row level security;
revoke all on sensitive_action_codes from anon, authenticated;

-- يُنادى من الخادم وحده: يُبطل الرموز السابقة ويحفظ بصمة الجديد، بحدود إرسال
create or replace function issue_sensitive_code(p_member uuid, p_school uuid, p_action text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_last timestamptz; v_hour int;
begin
    if not exists (select 1 from school_members where id = p_member and school_id = p_school
                    and role = 'admin' and active) then raise exception 'NOT_ADMIN'; end if;
    select max(created_at), count(*) filter (where created_at > now() - interval '1 hour')
      into v_last, v_hour
      from sensitive_action_codes where member_id = p_member and action = p_action;
    if v_last is not null and v_last > now() - interval '60 seconds' then raise exception 'CODE_TOO_SOON'; end if;
    if coalesce(v_hour, 0) >= 5 then raise exception 'CODE_TOO_MANY'; end if;
    update sensitive_action_codes set used_at = coalesce(used_at, now())
     where member_id = p_member and action = p_action and used_at is null;
    insert into sensitive_action_codes (member_id, school_id, action, code_hash)
    values (p_member, p_school, p_action, p_hash);
    return jsonb_build_object('ok', true, 'expires_in', 600);
end $$;
revoke all on function issue_sensitive_code(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function issue_sensitive_code(uuid, uuid, text, text) to service_role;

-- يتحقّق من الرمز ويستهلكه (مرة واحدة). المحاولات الخاطئة تُعدّ وتُقفل بعد ٥.
-- ⚠️ يُرجع حالةً ولا يرفع خطأً: رفع الخطأ يتراجع عن كل ما قبله — ومنه زيادة عدّاد
-- المحاولات — فيصير حدّ الخمس محاولات بلا أثر (خمّن ما شئت). كشفته قبل التطبيق.
create or replace function consume_sensitive_code(p_school uuid, p_action text, p_code text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare v_me uuid; c sensitive_action_codes%rowtype;
begin
    v_me := my_member_id(p_school);
    if v_me is null then return 'NOT_ALLOWED'; end if;
    select * into c from sensitive_action_codes
     where member_id = v_me and action = p_action and used_at is null and expires_at > now()
     order by created_at desc limit 1;
    if c.id is null then return 'CODE_MISSING'; end if;
    if c.attempts >= 5 then return 'CODE_LOCKED'; end if;
    if encode(digest(coalesce(regexp_replace(p_code, '\D', '', 'g'), '') || ':' || v_me::text, 'sha256'), 'hex') <> c.code_hash then
        update sensitive_action_codes set attempts = attempts + 1 where id = c.id;
        return 'CODE_INVALID';
    end if;
    update sensitive_action_codes set used_at = now() where id = c.id;
    return 'ok';
end $$;
revoke all on function consume_sensitive_code(uuid, text, text) from public, anon, authenticated;

-- الدالّة القديمة (بلا رمز) تُعاد تسميتها وتُغلق أمام المتصفّح؛ والجديدة تشترط الرمز.
do $$ begin
    if exists (select 1 from pg_proc where proname = 'promote_school_year'
                 and pronamespace = 'public'::regnamespace and pronargs = 3) then
        alter function promote_school_year(uuid, text, uuid[]) rename to promote_school_year_core;
    end if;
end $$;
revoke all on function promote_school_year_core(uuid, text, uuid[]) from public, anon, authenticated;

create or replace function promote_school_year(p_school uuid, p_year_label text, p_hold_back uuid[], p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v text;
begin
    if not is_school_admin(p_school) then raise exception 'NOT_ALLOWED'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    v := consume_sensitive_code(p_school, 'promote_year', p_code);
    if v <> 'ok' then return jsonb_build_object('error', v); end if;   -- بلا رفع: يبقى عدّاد المحاولات
    return promote_school_year_core(p_school, p_year_label, coalesce(p_hold_back, '{}'));
end $$;
revoke all on function promote_school_year(uuid, text, uuid[], text) from public, anon;
grant execute on function promote_school_year(uuid, text, uuid[], text) to authenticated;
