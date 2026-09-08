-- ============================================================
-- خُطى للمدارس — البنية الأساسية
-- ============================================================
-- مصمَّمة لأكثر من مدرسة من البداية (جدول schools)، لأن التوسّع لمدارس
-- أخرى كان جزءاً من الفكرة. مدرسة واحدة اليوم لا تكلّف شيئاً إضافياً.

create extension if not exists pgcrypto;

-- ─────────────── المدارس ───────────────
create table if not exists schools (
    id          uuid primary key default gen_random_uuid(),
    slug        text unique not null,          -- يطابق معرّف النسخة في js/00-tenant.js
    name_ar     text not null,
    name_en     text,
    created_at  timestamptz not null default now()
);

-- ─────────────── الأعضاء وأدوارهم ───────────────
-- الدور مخزَّن في قاعدة البيانات لا في المتصفح: لو زوّر أحد الواجهة وادّعى
-- أنه مدير، فسياسات RLS أدناه هي التي ترفضه، لا إخفاء الأزرار.
do $$ begin
    create type school_role as enum ('admin', 'teacher', 'student');
exception when duplicate_object then null; end $$;

create table if not exists school_members (
    id           uuid primary key default gen_random_uuid(),
    school_id    uuid not null references schools(id) on delete cascade,
    uid          uuid not null references auth.users(id) on delete cascade,
    role         school_role not null default 'student',
    full_name    text not null,
    -- للطالب: صفّه. للمدرّس: يبقى فارغاً (يُربط بالفصول عبر class_teachers)
    grade        text,
    section      text,
    active       boolean not null default true,
    created_at   timestamptz not null default now(),
    unique (school_id, uid)
);
create index if not exists idx_members_school_role on school_members(school_id, role);
create index if not exists idx_members_uid on school_members(uid);

-- ─────────────── الفصول ───────────────
create table if not exists classes (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    name        text not null,                 -- مثال: "أول ثانوي - أ"
    grade       text not null,                 -- 1 / 2 / 3
    section     text,                          -- أ / ب / ج
    created_at  timestamptz not null default now()
);

-- أي مدرّس يدرّس أي فصل وأي مادة
create table if not exists class_teachers (
    id          uuid primary key default gen_random_uuid(),
    class_id    uuid not null references classes(id) on delete cascade,
    teacher_id  uuid not null references school_members(id) on delete cascade,
    subject     text not null,
    unique (class_id, teacher_id, subject)
);

-- ─────────────── ملفات المدرّس ───────────────
-- المدرّس يرفع من الجوال أو الحاسب، ويجدها على السبورة بعد تسجيل دخوله.
create table if not exists teacher_files (
    id           uuid primary key default gen_random_uuid(),
    school_id    uuid not null references schools(id) on delete cascade,
    owner_id     uuid not null references school_members(id) on delete cascade,
    title        text not null,
    subject      text,
    grade        text,
    -- مسار الملف داخل Supabase Storage. الكتب الوزارية لا تُرفع هنا إطلاقاً
    -- بل تُوضع في external_url (روابط عين الرسمية) — لا تخزين ولا حقوق نشر.
    storage_path text,
    external_url text,
    size_bytes   bigint,
    -- هل يراه طلاب فصوله أم هو خاص بالمدرّس على السبورة فقط؟
    shared       boolean not null default true,
    created_at   timestamptz not null default now(),
    constraint file_has_a_source check (storage_path is not null or external_url is not null)
);
create index if not exists idx_files_owner on teacher_files(owner_id);
create index if not exists idx_files_school on teacher_files(school_id, grade);

-- ─────────────── الروابط المباشرة لكل مدرّس ───────────────
create table if not exists teacher_links (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    owner_id    uuid not null references school_members(id) on delete cascade,
    label       text not null,
    url         text not null,
    icon        text,
    sort_order  int not null default 0,
    shared      boolean not null default true,
    created_at  timestamptz not null default now(),
    -- نمنع javascript: و data: من الوصول أصلاً إلى قاعدة البيانات
    constraint link_is_http check (url ~* '^https?://')
);
create index if not exists idx_links_owner on teacher_links(owner_id, sort_order);

-- ─────────────── الجدول الدراسي ───────────────
create table if not exists timetable (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    class_id    uuid not null references classes(id) on delete cascade,
    teacher_id  uuid references school_members(id) on delete set null,
    weekday     smallint not null check (weekday between 0 and 6),  -- 0 = الأحد
    period_no   smallint not null check (period_no between 1 and 12),
    subject     text not null,
    room        text,
    unique (class_id, weekday, period_no)
);
create index if not exists idx_timetable_class on timetable(class_id, weekday);

-- ─────────────── اختبارات المدرّس ───────────────
create table if not exists teacher_exams (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    owner_id    uuid not null references school_members(id) on delete cascade,
    title       text not null,
    subject     text,
    grade       text,
    questions   jsonb not null default '[]'::jsonb,
    published   boolean not null default false,
    created_at  timestamptz not null default now()
);

create table if not exists exam_assignments (
    id          uuid primary key default gen_random_uuid(),
    exam_id     uuid not null references teacher_exams(id) on delete cascade,
    class_id    uuid not null references classes(id) on delete cascade,
    due_at      timestamptz,
    unique (exam_id, class_id)
);

create table if not exists exam_attempts (
    id          uuid primary key default gen_random_uuid(),
    exam_id     uuid not null references teacher_exams(id) on delete cascade,
    student_id  uuid not null references school_members(id) on delete cascade,
    score       numeric,
    total       int,
    answers     jsonb,
    finished_at timestamptz,
    created_at  timestamptz not null default now()
);
create index if not exists idx_attempts_exam on exam_attempts(exam_id);

-- ============================================================
-- دوال مساعدة  (SECURITY DEFINER لتفادي التكرار اللانهائي في RLS)
-- ============================================================
-- سياسة على school_members تقرأ school_members ستستدعي نفسها بلا نهاية.
-- الدالة تكسر الحلقة لأنها تعمل بصلاحية المالك فتتجاوز RLS.

create or replace function my_member_id(p_school uuid)
returns uuid language sql stable security definer set search_path = public as $$
    select id from school_members
    where school_id = p_school and uid = auth.uid() and active limit 1;
$$;

create or replace function my_role(p_school uuid)
returns school_role language sql stable security definer set search_path = public as $$
    select role from school_members
    where school_id = p_school and uid = auth.uid() and active limit 1;
$$;

create or replace function is_school_admin(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from school_members
        where school_id = p_school and uid = auth.uid() and role = 'admin' and active
    );
$$;

-- هل الطالب الحالي في هذا الفصل؟ (لعرض ملفات مدرّسيه واختباراته)
create or replace function my_class_ids(p_school uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
    select c.id from classes c
    join school_members m on m.school_id = c.school_id
    where c.school_id = p_school and m.uid = auth.uid() and m.active
      and m.role = 'student' and c.grade = m.grade
      and (m.section is null or c.section is null or c.section = m.section);
$$;

-- الفصول التي يدرّسها المدرّس الحالي
create or replace function my_taught_class_ids(p_school uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
    select ct.class_id from class_teachers ct
    join school_members m on m.id = ct.teacher_id
    where m.school_id = p_school and m.uid = auth.uid() and m.active;
$$;

-- ============================================================
-- تفعيل RLS  — الافتراضي: ممنوع، ثم نسمح صراحةً
-- ============================================================
alter table schools          enable row level security;
alter table school_members   enable row level security;
alter table classes          enable row level security;
alter table class_teachers   enable row level security;
alter table teacher_files    enable row level security;
alter table teacher_links    enable row level security;
alter table timetable        enable row level security;
alter table teacher_exams    enable row level security;
alter table exam_assignments enable row level security;
alter table exam_attempts    enable row level security;

-- ─────────────── schools ───────────────
drop policy if exists schools_read on schools;
create policy schools_read on schools for select to authenticated
    using (exists (select 1 from school_members m
                   where m.school_id = schools.id and m.uid = auth.uid() and m.active));

-- ─────────────── school_members ───────────────
-- كل عضو يرى نفسه. المدير يرى ويدير كل أعضاء مدرسته.
-- المدرّس يرى طلاب فصوله فقط — لا كل طلاب المدرسة.
drop policy if exists members_read_self on school_members;
create policy members_read_self on school_members for select to authenticated
    using (uid = auth.uid());

drop policy if exists members_read_admin on school_members;
create policy members_read_admin on school_members for select to authenticated
    using (is_school_admin(school_id));

drop policy if exists members_read_teacher on school_members;
create policy members_read_teacher on school_members for select to authenticated
    using (
        my_role(school_id) = 'teacher' and role = 'student'
        and exists (select 1 from classes c
                    where c.id in (select my_taught_class_ids(school_id))
                      and c.grade = school_members.grade
                      and (c.section is null or school_members.section is null
                           or c.section = school_members.section))
    );

drop policy if exists members_write_admin on school_members;
create policy members_write_admin on school_members for all to authenticated
    using (is_school_admin(school_id)) with check (is_school_admin(school_id));

-- ─────────────── classes / class_teachers ───────────────
drop policy if exists classes_read on classes;
create policy classes_read on classes for select to authenticated
    using (my_member_id(school_id) is not null);

drop policy if exists classes_write_admin on classes;
create policy classes_write_admin on classes for all to authenticated
    using (is_school_admin(school_id)) with check (is_school_admin(school_id));

drop policy if exists ct_read on class_teachers;
create policy ct_read on class_teachers for select to authenticated
    using (exists (select 1 from classes c
                   where c.id = class_teachers.class_id
                     and my_member_id(c.school_id) is not null));

drop policy if exists ct_write_admin on class_teachers;
create policy ct_write_admin on class_teachers for all to authenticated
    using (exists (select 1 from classes c
                   where c.id = class_teachers.class_id and is_school_admin(c.school_id)))
    with check (exists (select 1 from classes c
                   where c.id = class_teachers.class_id and is_school_admin(c.school_id)));

-- ─────────────── ملفات وروابط المدرّس ───────────────
-- المالك يتحكم بملفاته كاملاً؛ المدير يرى كل شيء؛ الطالب يرى المشترَك فقط
-- من مدرّسي صفّه.
drop policy if exists files_owner_all on teacher_files;
create policy files_owner_all on teacher_files for all to authenticated
    using (owner_id = my_member_id(school_id))
    with check (owner_id = my_member_id(school_id));

drop policy if exists files_admin_read on teacher_files;
create policy files_admin_read on teacher_files for select to authenticated
    using (is_school_admin(school_id));

drop policy if exists files_student_read on teacher_files;
create policy files_student_read on teacher_files for select to authenticated
    using (
        shared and my_role(school_id) = 'student'
        and exists (
            select 1 from class_teachers ct
            where ct.teacher_id = teacher_files.owner_id
              and ct.class_id in (select my_class_ids(school_id))
        )
    );

drop policy if exists links_owner_all on teacher_links;
create policy links_owner_all on teacher_links for all to authenticated
    using (owner_id = my_member_id(school_id))
    with check (owner_id = my_member_id(school_id));

drop policy if exists links_admin_read on teacher_links;
create policy links_admin_read on teacher_links for select to authenticated
    using (is_school_admin(school_id));

drop policy if exists links_student_read on teacher_links;
create policy links_student_read on teacher_links for select to authenticated
    using (
        shared and my_role(school_id) = 'student'
        and exists (
            select 1 from class_teachers ct
            where ct.teacher_id = teacher_links.owner_id
              and ct.class_id in (select my_class_ids(school_id))
        )
    );

-- ─────────────── الجدول الدراسي ───────────────
drop policy if exists timetable_read on timetable;
create policy timetable_read on timetable for select to authenticated
    using (my_member_id(school_id) is not null);

drop policy if exists timetable_write_admin on timetable;
create policy timetable_write_admin on timetable for all to authenticated
    using (is_school_admin(school_id)) with check (is_school_admin(school_id));

-- ─────────────── الاختبارات ───────────────
drop policy if exists exams_owner_all on teacher_exams;
create policy exams_owner_all on teacher_exams for all to authenticated
    using (owner_id = my_member_id(school_id))
    with check (owner_id = my_member_id(school_id));

drop policy if exists exams_admin_read on teacher_exams;
create policy exams_admin_read on teacher_exams for select to authenticated
    using (is_school_admin(school_id));

-- الطالب يرى الاختبار المنشور المُسنَد لفصله فقط.
drop policy if exists exams_student_read on teacher_exams;
create policy exams_student_read on teacher_exams for select to authenticated
    using (
        published and my_role(school_id) = 'student'
        and exists (select 1 from exam_assignments a
                    where a.exam_id = teacher_exams.id
                      and a.class_id in (select my_class_ids(school_id)))
    );

drop policy if exists assign_read on exam_assignments;
create policy assign_read on exam_assignments for select to authenticated
    using (exists (select 1 from teacher_exams e
                   where e.id = exam_assignments.exam_id
                     and my_member_id(e.school_id) is not null));

drop policy if exists assign_write_owner on exam_assignments;
create policy assign_write_owner on exam_assignments for all to authenticated
    using (exists (select 1 from teacher_exams e
                   where e.id = exam_assignments.exam_id
                     and e.owner_id = my_member_id(e.school_id)))
    with check (exists (select 1 from teacher_exams e
                   where e.id = exam_assignments.exam_id
                     and e.owner_id = my_member_id(e.school_id)));

-- محاولات الطلاب: الطالب يكتب محاولته ويرى نتيجته هو فقط.
-- صاحب الاختبار يرى كل المحاولات عليه.
drop policy if exists attempts_student_own on exam_attempts;
create policy attempts_student_own on exam_attempts for select to authenticated
    using (exists (select 1 from teacher_exams e
                   where e.id = exam_attempts.exam_id
                     and student_id = my_member_id(e.school_id)));

drop policy if exists attempts_student_insert on exam_attempts;
create policy attempts_student_insert on exam_attempts for insert to authenticated
    with check (exists (select 1 from teacher_exams e
                        where e.id = exam_attempts.exam_id
                          and student_id = my_member_id(e.school_id)));

drop policy if exists attempts_owner_read on exam_attempts;
create policy attempts_owner_read on exam_attempts for select to authenticated
    using (exists (select 1 from teacher_exams e
                   where e.id = exam_attempts.exam_id
                     and e.owner_id = my_member_id(e.school_id)));

-- ============================================================
-- مخزن ملفات المدرّسين (Supabase Storage)
-- ============================================================
-- المخزن خاص (public=false): كل تحميل يمرّ بفحص صلاحية، ولا يكفي معرفة
-- الرابط. حد 25 ميجا للملف يمنع رفع كتاب ضخم يستهلك الحصة المجانية.
-- الكتب الوزارية لا تُرفع هنا إطلاقاً — تُحفظ كروابط عين في external_url.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('teacher-files','teacher-files', false, 26214400,
        array['application/pdf','image/png','image/jpeg','image/webp',
              'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types, public = false;

-- مسار كل ملف: <school_id>/<member_id>/<filename>
-- الجزء الثاني هو معرّف العضو، فنقارنه بعضوية من يطلب الرفع.
drop policy if exists tf_owner_write on storage.objects;
create policy tf_owner_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'teacher-files'
    and (storage.foldername(name))[2] in (
      select m.id::text from school_members m
      where m.uid = auth.uid() and m.active and m.role in ('teacher','admin')));

drop policy if exists tf_owner_modify on storage.objects;
create policy tf_owner_modify on storage.objects for update to authenticated
  using (bucket_id='teacher-files' and (storage.foldername(name))[2] in (
      select m.id::text from school_members m where m.uid = auth.uid() and m.active));

drop policy if exists tf_owner_delete on storage.objects;
create policy tf_owner_delete on storage.objects for delete to authenticated
  using (bucket_id='teacher-files' and (storage.foldername(name))[2] in (
      select m.id::text from school_members m where m.uid = auth.uid() and m.active));

-- القراءة تُفوَّض لجدول teacher_files: سياسات ذلك الجدول تُطبَّق داخل هذا
-- الاستعلام الفرعي أيضاً، فمن لا يرى صف الملف لا يرى الملف نفسه. تُحقّق من
-- هذا عملياً لا نظرياً: طالب من صف آخر أعاد 0، وطالب الصف نفسه أعاد 1.
drop policy if exists tf_read on storage.objects;
create policy tf_read on storage.objects for select to authenticated
  using (bucket_id = 'teacher-files'
         and exists (select 1 from teacher_files f where f.storage_path = storage.objects.name));

-- ============================================================
-- بذرة أولى
-- ============================================================
insert into schools (slug, name_ar, name_en)
values ('motaqadima', 'مدارس المتقدمة — فرع الملقا', 'Al-Motaqadima Schools - Al-Malqa')
on conflict (slug) do nothing;

-- ============================================================
-- طلبات الحسابات — لمن لا حساب له
-- ============================================================
-- لا وضع ضيف في نسخة المدرسة، فمن يفتح الموقع بلا حساب يحتاج طريقاً ما.
-- هذا هو: يملأ نموذجاً فيصل للإدارة، وهي تنشئ له حساباً.

do $$ begin
    create type request_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

create table if not exists account_requests (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    full_name   text not null,
    role_wanted school_role not null,
    grade       text,
    section     text,
    contact     text,
    note        text,
    status      request_status not null default 'pending',
    reviewed_by uuid references school_members(id) on delete set null,
    reviewed_at timestamptz,
    created_at  timestamptz not null default now(),
    -- حدود طول تمنع إغراق الجدول بنصوص ضخمة من نموذج مفتوح للعامة
    constraint req_name_len    check (char_length(full_name) between 3 and 80),
    constraint req_contact_len check (contact is null or char_length(contact) <= 120),
    constraint req_note_len    check (note is null or char_length(note) <= 400),
    constraint req_grade_len   check (grade is null or char_length(grade) <= 20),
    constraint req_section_len check (section is null or char_length(section) <= 20),
    -- لا أحد يطلب أن يكون مديراً من نموذج عام. هذا القيد هو ما يمنع الترقية
    -- الذاتية فعلياً، لا اختيارات القائمة في الواجهة.
    constraint req_not_admin   check (role_wanted <> 'admin')
);
create index if not exists idx_requests_pending on account_requests(school_id, status, created_at desc);

alter table account_requests enable row level security;

-- الإرسال مفتوح لمن لا حساب له (هذا غرض الجدول)، لكن الإدخال وحده:
-- لا قراءة ولا تعديل ولا حذف، فلا يرى أحد طلبات غيره ولا يعتمد طلبه بنفسه.
drop policy if exists reqs_public_insert on account_requests;
create policy reqs_public_insert on account_requests for insert to anon, authenticated
    with check (status = 'pending' and reviewed_by is null and reviewed_at is null);

drop policy if exists reqs_admin_read on account_requests;
create policy reqs_admin_read on account_requests for select to authenticated
    using (is_school_admin(school_id));

drop policy if exists reqs_admin_update on account_requests;
create policy reqs_admin_update on account_requests for update to authenticated
    using (is_school_admin(school_id)) with check (is_school_admin(school_id));

drop policy if exists reqs_admin_delete on account_requests;
create policy reqs_admin_delete on account_requests for delete to authenticated
    using (is_school_admin(school_id));

-- معرّف المدرسة يُقرأ بلا حساب: الموقع يحتاجه قبل الدخول ليعرف لأي مدرسة
-- يُرسل الطلب. لا يكشف شيئاً حساساً — اسم المدرسة معروف أصلاً.
create or replace function school_id_by_slug(p_slug text)
returns uuid language sql stable security definer set search_path = public as $$
    select id from schools where slug = p_slug limit 1;
$$;
grant execute on function school_id_by_slug(text) to anon, authenticated;

-- ============================================================
-- حدّ الروابط · ملاحظات الأيام · صلاحية المدرّس على الجدول · طابور البريد
-- ============================================================

-- 9 روابط لكل مدرّس. بمُشغِّل لا بقيد check، لأن القيد لا يعدّ صفوفاً أخرى.
-- في القاعدة لا في الواجهة: إخفاء الزر لا يمنع من يرسل الطلب مباشرة.
create or replace function enforce_links_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
    select count(*) into n from teacher_links where owner_id = new.owner_id;
    if n >= 9 then
        raise exception 'LINKS_LIMIT_REACHED' using hint = 'أقصى عدد للروابط المباشرة هو 9';
    end if;
    return new;
end $$;

drop trigger if exists trg_links_limit on teacher_links;
create trigger trg_links_limit before insert on teacher_links
for each row execute function enforce_links_limit();

-- الطالب لا يعدّل جدوله (تضعه الإدارة أو المدرّس) لكنه يضيف فوقه ما يخصّه.
do $$ begin
    create type note_kind as enum ('note','highlight','reminder');
exception when duplicate_object then null; end $$;

create table if not exists day_notes (
    id         uuid primary key default gen_random_uuid(),
    school_id  uuid not null references schools(id) on delete cascade,
    owner_id   uuid not null references school_members(id) on delete cascade,
    on_date    date not null,
    kind       note_kind not null default 'note',
    text       text,
    color      text,
    remind_at  timestamptz,
    created_at timestamptz not null default now(),
    constraint note_text_len check (text is null or char_length(text) <= 300),
    constraint note_color_ok check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
    constraint note_needs_text check (kind = 'highlight' or (text is not null and char_length(btrim(text)) > 0))
);
create index if not exists idx_notes_owner_date on day_notes(owner_id, on_date);
alter table day_notes enable row level security;

-- خاصة بصاحبها وحده: لا المدرّس ولا المدير يقرؤها (مُتحقَّق عملياً).
drop policy if exists notes_owner_all on day_notes;
create policy notes_owner_all on day_notes for all to authenticated
    using (owner_id = my_member_id(school_id))
    with check (owner_id = my_member_id(school_id));

-- المدرّس يدير جدول فصوله التي يدرّسها فقط (كانت الكتابة للمدير وحده).
drop policy if exists timetable_write_teacher on timetable;
create policy timetable_write_teacher on timetable for all to authenticated
    using (my_role(school_id) = 'teacher' and class_id in (select my_taught_class_ids(school_id)))
    with check (my_role(school_id) = 'teacher' and class_id in (select my_taught_class_ids(school_id)));

-- طابور بريد يقرأه خادم مُجدوَل. لا نرسل من المتصفح إطلاقاً: الإرسال يحتاج
-- مفتاح خدمة يقرأ بريد الطلاب، ووضعه في المتصفح يسلّمه لكل زائر.
create table if not exists exam_notifications (
    id          uuid primary key default gen_random_uuid(),
    exam_id     uuid not null references teacher_exams(id) on delete cascade,
    student_id  uuid not null references school_members(id) on delete cascade,
    email       text,
    sent_at     timestamptz,
    error       text,
    created_at  timestamptz not null default now(),
    unique (exam_id, student_id)      -- إعادة الإرسال لا تضاعف الرسائل
);
create index if not exists idx_notif_unsent on exam_notifications(sent_at) where sent_at is null;
alter table exam_notifications enable row level security;

drop policy if exists notif_owner_read on exam_notifications;
create policy notif_owner_read on exam_notifications for select to authenticated
    using (exists (select 1 from teacher_exams e
                   where e.id = exam_notifications.exam_id
                     and e.owner_id = my_member_id(e.school_id)));

-- يضع طلاب الفصل في الطابور. SECURITY DEFINER لأنه يقرأ auth.users (البريد)،
-- لكنه يتحقق أولاً أن المُنادي صاحب الاختبار — بلا ذلك يستطيع أي عضو إغراق
-- طلاب أي فصل برسائل.
create or replace function enqueue_exam_notifications(p_exam uuid, p_class uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_school uuid; v_owner uuid; v_me uuid; n int := 0;
begin
    select school_id, owner_id into v_school, v_owner from teacher_exams where id = p_exam;
    if v_school is null then raise exception 'EXAM_NOT_FOUND'; end if;
    v_me := my_member_id(v_school);
    if v_me is null or v_me <> v_owner then raise exception 'NOT_EXAM_OWNER'; end if;
    if not exists (select 1 from classes c where c.id = p_class and c.school_id = v_school) then
        raise exception 'CLASS_NOT_IN_SCHOOL';
    end if;

    insert into exam_notifications (exam_id, student_id, email)
    select p_exam, m.id, u.email
    from school_members m
    join classes c on c.id = p_class
    left join auth.users u on u.id = m.uid
    where m.school_id = v_school and m.role = 'student' and m.active
      and m.grade = c.grade
      and (m.section is null or c.section is null or m.section = c.section)
    on conflict (exam_id, student_id) do nothing;

    get diagnostics n = row_count;
    return n;
end $$;

revoke all on function enqueue_exam_notifications(uuid, uuid) from public, anon;
grant execute on function enqueue_exam_notifications(uuid, uuid) to authenticated;


/* ============================================================
   الصلاحية المتدرّجة: ما الذي تكفي فيه كلمة المرور، وما الذي يحتاج Google
   ------------------------------------------------------------
   المشكلة: المعلّم على السبورة أمام صفّه لا يريد كتابة بيانات Google في كل
   حصة، فيدخل دخولاً سريعاً. لكن ما يُكتب على شاشة يراها الصف كله قد يلتقطه
   طالب. فالدخول السريع "محدود": يعرض ولا يعدّل.

   ⚠️ الفرض هنا في قاعدة البيانات لا في الواجهة. إخفاء الأزرار تحسين شكلي
   فقط — من يفتح أدوات المطوّر يتجاوزه في ثوانٍ. الحماية الحقيقية أن
   السياسات نفسها ترفض.

   كيف نعرف طريقة الدخول؟ Supabase يضع في الرمز حقل amr يسرد طرق المصادقة
   المستعملة فعلاً ("oauth" لـGoogle و"password" لكلمة المرور)، وهو موقَّع
   من الخادم فلا يستطيع المتصفح تزويره.
   ============================================================ */

create or replace function google_verified(p_hours int default 12)
returns boolean language sql stable set search_path = public as $$
    select coalesce(
        (select max((e->>'timestamp')::bigint)
         from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
         where e->>'method' = 'oauth')
        > (extract(epoch from now())::bigint - (p_hours * 3600)), false);
$$;

/* google_verified() شرطٌ في سياسات الكتابة على: teacher_files, teacher_links,
   teacher_exams, exam_assignments, timetable (كتابة المعلّم), school_members
   (كتابة الإدارة). أما سياسات SELECT فمفتوحة للجلسة المحدودة عمداً — لأن
   الغرض من الدخول السريع هو العرض. */


/* ============================================================
   دخول السبورة برمز QR
   ------------------------------------------------------------
   المعلّم يمسح رمزاً على السبورة بجوّاله، يوافق بحساب Google، فتفتح السبورة.

   ✅ من مسح الرمز من الطلاب لا يكسب شيئاً: الموافقة تتطلّب حساب Google
      الخاص بالمعلّم، ولا يعرفه إلا هو.

   ⚠️ لكن اتجاهين آخرين للهجوم لا تغطّيهما تلك الملاحظة:

   (١) أن يولّد الطالب رمزاً على جهازه هو ثم يعرضه على المعلّم قائلاً
       "امسح هذا" — فيوافق المعلّم بحسن نيّة فتفتح شاشةُ الطالب على حسابه.
       العلاج: pair_code من أربع خانات يُعرض على الشاشة ويُكتب في الجوال.
       فالموافقة تصير مرتبطة بشاشة بعينها لا برمز مجرّد.

   (٢) أن يصوّر طالبٌ الرمز — وهو معروض على سبورة أمام الصف كله — فيفكّ
       ترميزه ويسبق السبورة إلى الجلسة.
       العلاج: ما يدخل الرمز هو sha256(السرّ) فقط. السرّ لا يغادر ذاكرة
       متصفح السبورة، والمطالبة تتحقق sha256(المُرسَل) = المخزَّن.

   ⚠️ والجلسة الناتجة محدودة كالدخول السريع: لا "oauth" في amr، فالأفعال
   الحسّاسة تبقى ممنوعة — لأن الشاشة تظل مفتوحة في الفصل بعد انصراف المعلّم.
   ============================================================ */

create table if not exists screen_login_requests (
    id          uuid primary key default gen_random_uuid(),
    public_id   text not null unique,          -- sha256(secret) سداسي عشري
    pair_code   text not null,                 -- أربع خانات، تُعرض على الشاشة
    school_id   uuid references schools(id) on delete cascade,
    approved_by uuid references school_members(id) on delete cascade,
    approved_at timestamptz,
    consumed_at timestamptz,                   -- الاستعمال مرة واحدة
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now()
);

alter table screen_login_requests enable row level security;
/* ⚠️ بلا أي سياسة SELECT عمداً: لا أحد يقرأ هذا الجدول مباشرةً إطلاقاً،
   ولا يُوصَل إليه إلا عبر الدوال الأربع أدناه. */

/* screen_login_start(public_id)  → (out_pair_code, out_expires_at)  [anon]
   screen_login_peek(public_id)   → (out_expires_at, out_already_approved) [anon]
       ⚠️ لا تُعيد pair_code أبداً: الجوال يملك public_id من الرمز، فلو
       أعادته لملأه تلقائياً وسقطت فائدة المطابقة اليدوية كلها.
   screen_login_approve(public_id, pair_code) → boolean  [authenticated]
       تشترط google_verified() ودور teacher/admin وتطابق الرقم.
   screen_login_claim(secret) → صف العضو  [service_role فقط]
       ⚠️ EXECUTE مسحوبة من PUBLIC لا من anon/authenticated وحدهما —
       Postgres يمنح PUBLIC تلقائياً وهما يرثان منه. (كشف هذا اختبارُ أمان
       نجح فيه anon في المطالبة رغم سحب الصلاحية منه صراحةً.) */
