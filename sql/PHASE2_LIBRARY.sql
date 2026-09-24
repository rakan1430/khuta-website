-- ============================================================
--  المرحلة ٢ — مكتبة الكتب والدروس (٢٤ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  قرارات المالك:
--  • ⚖️ لا تُرفع نسخة الكتاب الوزاري على تخزين خُطى (شروط منصة عين: «يُمنع
--    إعادة النشر»). الكتاب هنا **رابط منصة عين** فقط — قيدٌ في القاعدة نفسها
--    لا في الواجهة وحدها.
--  • خُطى تحمل ما حوله: دروس الكتاب، ورابط فيديو لكل درس، واختبار لكل درس،
--    وملفات المعلّم.
--  • الكتاب ملك **المدرسة** لا المعلّم: يبقى لمن يخلفه وللسنة القادمة. فلا
--    مالك له؛ يعدّله كل معلّم يدرّس مادته، والإدارة. (created_by للتاريخ فقط.)
--  ⚠️ إضافي بالكامل: جدولان جديدان، لا يمسّان شيئاً قائماً.
-- ============================================================

create table if not exists school_books (
    id          uuid primary key default gen_random_uuid(),
    school_id   uuid not null references schools(id) on delete cascade,
    subject_id  uuid not null references school_subjects(id) on delete restrict,
    grade       text not null,
    term        text not null default 'all' check (term in ('t1','t2','t3','all')),
    title       text not null check (length(trim(title)) between 2 and 160),
    -- رابط منصة عين (أو بوابات الوزارة) — لا رابط لملف مرفوع عندنا
    ein_url     text check (ein_url is null or ein_url ~* '^https://([a-z0-9-]+\.)*(ien\.edu\.sa|moe\.gov\.sa)(/|$)'),
    sort_order  int not null default 0,
    created_by  uuid references school_members(id) on delete set null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now()
);
create index if not exists school_books_idx on school_books (school_id, grade, subject_id, sort_order);

create table if not exists school_lessons (
    id          uuid primary key default gen_random_uuid(),
    book_id     uuid not null references school_books(id) on delete cascade,
    school_id   uuid not null references schools(id) on delete cascade,
    title       text not null check (length(trim(title)) between 1 and 160),
    pages       text check (pages is null or length(pages) <= 40),
    video_url   text check (video_url is null or video_url ~* '^https://[^\s<>"]+$'),
    exam_id     uuid references teacher_exams(id) on delete set null,
    file_id     uuid references teacher_files(id) on delete set null,
    sort_order  int not null default 0,
    created_by  uuid references school_members(id) on delete set null,
    created_at  timestamptz not null default now()
);
create index if not exists school_lessons_idx on school_lessons (book_id, sort_order);

-- هل يحقّ لي تعديل كتب هذه المادة؟ الإدارة، أو معلّمٌ أُسندت له المادة في أي فصل.
create or replace function can_edit_subject_books(p_school uuid, p_subject uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select is_school_admin(p_school) or exists (
        select 1 from class_teachers ct join school_members m on m.id = ct.teacher_id
         where m.school_id = p_school and m.uid = auth.uid() and m.active and m.role = 'teacher'
           and ct.subject_id = p_subject);
$$;
revoke all on function can_edit_subject_books(uuid, uuid) from public, anon;
grant execute on function can_edit_subject_books(uuid, uuid) to authenticated;

-- الدرس يرث مدرسته من كتابه (لا يُوثق بما يرسله المتصفّح)، والاختبار والملف
-- المربوطان يجب أن يكونا من المدرسة نفسها.
create or replace function trg_school_lesson_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    select b.school_id into new.school_id from school_books b where b.id = new.book_id;
    if new.school_id is null then raise exception 'BOOK_NOT_FOUND'; end if;
    if new.exam_id is not null and not exists (select 1 from teacher_exams e where e.id = new.exam_id and e.school_id = new.school_id)
        then raise exception 'EXAM_NOT_IN_SCHOOL'; end if;
    if new.file_id is not null and not exists (select 1 from teacher_files f where f.id = new.file_id and f.school_id = new.school_id)
        then raise exception 'FILE_NOT_IN_SCHOOL'; end if;
    return new;
end $$;
drop trigger if exists trg_school_lesson_guard on school_lessons;
create trigger trg_school_lesson_guard before insert or update on school_lessons
    for each row execute function trg_school_lesson_guard();

create or replace function trg_school_book_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists trg_school_book_touch on school_books;
create trigger trg_school_book_touch before update on school_books
    for each row execute function trg_school_book_touch();

alter table school_books enable row level security;
alter table school_lessons enable row level security;
revoke all on school_books, school_lessons from anon;
grant select, insert, update, delete on school_books, school_lessons to authenticated;

-- القراءة: كل عضو فعّال في المدرسة (روابط منهج عامة أصلاً)
drop policy if exists books_read on school_books;
create policy books_read on school_books for select to authenticated
    using (my_member_id(school_id) is not null);
drop policy if exists lessons_read on school_lessons;
create policy lessons_read on school_lessons for select to authenticated
    using (my_member_id(school_id) is not null);

-- الكتابة: من يدرّس المادة أو الإدارة، وبإثبات Google (كبقية أفعال المعلّم)
drop policy if exists books_write on school_books;
create policy books_write on school_books for all to authenticated
    using (can_edit_subject_books(school_id, subject_id) and google_verified())
    with check (can_edit_subject_books(school_id, subject_id) and google_verified());
drop policy if exists lessons_write on school_lessons;
create policy lessons_write on school_lessons for all to authenticated
    using (google_verified() and exists (select 1 from school_books b where b.id = book_id
                                          and can_edit_subject_books(b.school_id, b.subject_id)))
    with check (google_verified() and exists (select 1 from school_books b where b.id = book_id
                                               and can_edit_subject_books(b.school_id, b.subject_id)));
