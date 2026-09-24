-- ============================================================
--  المرحلة ١ — الواجبات، وقاعدة بيانات المعلّم، والدرجات الرسمية (٢٤ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  ⚠️ القاعدة واحدة للمعاينة والإنتاج: كل ما هنا إضافي، إلا الإصلاح الأمني
--  في (٠) فهو سحبُ صلاحية لم تستعملها الواجهة قط.
-- ============================================================

-- ─────────────── ٠) إصلاح أمني: الطالب كان يستطيع كتابة درجته بنفسه ───────────────
-- سياستا attempts_student_write (INSERT) وattempts_student_update (UPDATE)
-- مع منح Supabase الافتراضي كانتا تسمحان لأي طالب — من وحدة تحكّم المتصفّح،
-- بسطر واحد — أن يُدرج محاولة بـscore = total، أو يعدّل درجة محاولته بعد
-- التصحيح. تحقّقتُ: has_column_privilege('authenticated','exam_attempts',
-- 'score','UPDATE') = true.
--
-- والواجهة لم تكتب في الجدول مباشرةً قط: التسليم كلّه عبر
-- submit_exam_attempt، وهي SECURITY DEFINER تصحّح في القاعدة وتكتب بصلاحية
-- مالكها — فلا تحتاج أيّاً من السياستين. ظهر هذا الآن لأن المرحلة ١ تعرض
-- هذه الدرجات للمعلّم والإدارة وولي الأمر كسجلّ.
drop policy if exists attempts_student_write  on exam_attempts;
drop policy if exists attempts_student_update on exam_attempts;
revoke insert, update, delete on exam_attempts from authenticated, anon;

-- ─────────────── ١) الواجب نوعٌ من الاختبار — نفس المحرّك ───────────────
-- قرار المالك: الواجب إلكتروني بأسئلة اختيارات، والحل المشروح يظهر بعد
-- انتهاء المدة **كاملة** لا بعد تسليم الطالب (لئلا يخبر زملاءه)، ومن فاته
-- يرى الحل بعدها، وترتيب الأسئلة والخيارات يُخلط لكل طالب، والتسليم
-- المتأخر خيار بيد المعلّم **مطفأ افتراضياً**.
--
-- late_days: مهلة التأخير بعد الموعد (٠ = لا تأخير). الحلّ يُكشف بعد
-- انتهاء المهلة لا الموعد — وإلا رأى المتأخّرُ الحلّ ثم سلّم.
alter table teacher_exams
    add column if not exists kind text not null default 'exam',
    add column if not exists subject_id uuid references school_subjects(id) on delete set null,
    add column if not exists shuffle boolean not null default false,
    add column if not exists late_days int not null default 0;
do $$ begin
    alter table teacher_exams add constraint teacher_exams_kind_chk check (kind in ('exam', 'homework'));
exception when duplicate_object then null; end $$;
do $$ begin
    alter table teacher_exams add constraint teacher_exams_late_days_chk check (late_days between 0 and 14);
exception when duplicate_object then null; end $$;

-- ⚠️ القراءة المباشرة لهذا الجدول صارت بالأعمدة المسمّاة منذ إصلاح ٢٢
-- سبتمبر (questions محجوب). فكل عمود جديد يحتاج منحاً صريحاً وإلا فشلت
-- القوائم التي تطلبه.
grant select (kind, subject_id, shuffle, late_days) on teacher_exams to authenticated;

alter table exam_attempts add column if not exists late boolean not null default false;

-- الواجب يكشف حلّه بعد الموعد دائماً — «فور التسليم» يعني أن أول مسلِّم
-- يخبر الباقين، و«أبداً» يلغي فائدة الواجب نفسها.
create or replace function trg_homework_reveal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.kind = 'homework' then new.reveal_mode := 'after_due'; end if;
    if new.kind <> 'homework' then new.late_days := 0; end if;
    return new;
end $$;
revoke all on function trg_homework_reveal() from public, anon, authenticated;
drop trigger if exists homework_reveal on teacher_exams;
create trigger homework_reveal before insert or update on teacher_exams
    for each row execute function trg_homework_reveal();

-- واجب بلا موعد لا معنى له: الموعد هو ما يحكم كشف الحلّ وقبول التسليم.
create or replace function trg_homework_needs_due()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.due_at is null and exists (select 1 from teacher_exams where id = new.exam_id and kind = 'homework') then
        raise exception 'HOMEWORK_NEEDS_DUE';
    end if;
    return new;
end $$;
revoke all on function trg_homework_needs_due() from public, anon, authenticated;
drop trigger if exists homework_needs_due on exam_assignments;
create trigger homework_needs_due before insert or update of due_at on exam_assignments
    for each row execute function trg_homework_needs_due();

-- متى يُغلق الواجب لهذا الطالب: الموعد + مهلة التأخير. null = لا موعد.
create or replace function my_exam_close(p_exam uuid, p_school uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
    select my_exam_due(p_exam, p_school) + make_interval(days => coalesce(e.late_days, 0))
      from teacher_exams e where e.id = p_exam;
$$;
revoke all on function my_exam_close(uuid, uuid) from public, anon, authenticated;

-- ─────────────── ٢) ما يصل الطالب: مخلوطاً إن طلب المعلّم ───────────────
-- الخلط حتمي لكل طالب (md5 للاختبار+الطالب+الموضع): يعيد فتح الواجب
-- فيجد الترتيب نفسه. وكل سؤال يحمل رقمه الأصلي i وكل خيار رقمه الأصلي
-- ci — والطالب يُرسل إجاباته بهما، فالتصحيح والمراجعة لا يتغيّران.
--
-- ⚠️ p_client: الواجهة المنشورة على khutaa.netlify.app (قبل المرحلة ١) تُرسل
-- الإجابة بموضع السؤال على الشاشة لا برقمه الأصلي. والقاعدة مشتركة، فلو
-- خُلط واجبٌ أنشئ على رابط المعاينة ثم فتحه طالبٌ من الموقع الحيّ لصُحّح
-- على غير أسئلته بصمت. لذلك لا خلط إلا لواجهة تعلن أنها تفهمه (p_client=2).
-- والخلط ليس حاجزاً أمنياً (لا إجابات فيه) بل عائقاً للنقل بين الزملاء.
drop function if exists public.get_exam_for_student(uuid);
create or replace function public.get_exam_for_student(p_exam uuid, p_client int default 1)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
declare e teacher_exams%rowtype; v_me uuid; v_q jsonb; v_prev exam_attempts%rowtype;
        v_due timestamptz; v_close timestamptz; v_shuffle boolean;
begin
    select * into e from teacher_exams where id = p_exam;
    if e.id is null then raise exception 'EXAM_NOT_FOUND'; end if;

    v_me := my_member_id(e.school_id);
    if v_me is null then raise exception 'NOT_IN_SCHOOL'; end if;
    if not e.published then raise exception 'NOT_PUBLISHED'; end if;
    if e.archived_at is not null then raise exception 'ARCHIVED_YEAR'; end if;
    if not exam_is_assigned_to_me(p_exam, e.school_id) then raise exception 'NOT_ASSIGNED'; end if;

    v_shuffle := e.shuffle and coalesce(p_client, 1) >= 2;

    -- ⚠️ 'correct' و'explanation' يُحذفان: كلاهما يكشف الإجابة (sql/EXAM_FUNCTIONS.sql)
    select coalesce(jsonb_agg(
               (q.value - 'correct' - 'explanation' - 'choices')
               || jsonb_build_object('i', q.ordinality - 1, 'choices', (
                    select coalesce(jsonb_agg(
                               (case when jsonb_typeof(c.v) = 'object' then c.v
                                     else jsonb_build_object('text', c.v) end)
                               || jsonb_build_object('ci', c.n - 1)
                               order by case when v_shuffle then md5(e.id::text || v_me::text || (q.ordinality - 1)::text || ':' || (c.n - 1)::text) end,
                                        c.n), '[]'::jsonb)
                      from jsonb_array_elements(coalesce(q.value -> 'choices', '[]'::jsonb)) with ordinality c(v, n)))
               order by case when v_shuffle then md5(e.id::text || v_me::text || (q.ordinality - 1)::text) end,
                        q.ordinality), '[]'::jsonb)
      into v_q
      from jsonb_array_elements(coalesce(e.questions, '[]'::jsonb)) with ordinality q(value, ordinality);

    select * into v_prev from exam_attempts
     where exam_id = p_exam and student_id = v_me
     order by created_at desc limit 1;

    v_due := my_exam_due(p_exam, e.school_id);
    v_close := v_due + make_interval(days => coalesce(e.late_days, 0));

    return jsonb_build_object(
        'id', e.id, 'title', e.title, 'subject', e.subject,
        'kind', e.kind, 'late_days', e.late_days,
        'timed', e.timed,
        'duration_min', case when e.timed then e.duration_min else null end,
        'due_at', v_due,
        'close_at', case when e.kind = 'homework' then v_close end,
        'past_due', v_due is not null and now() > v_due,
        'closed', e.kind = 'homework' and v_close is not null and now() > v_close,
        'owner_id', e.owner_id,
        'questions', v_q,
        'can_review', may_review_exam(p_exam),
        'attempt', case when v_prev.id is null then null else jsonb_build_object(
            'score', v_prev.score, 'total', v_prev.total, 'late', v_prev.late,
            'finished_at', v_prev.finished_at) end
    );
end $function$;
revoke all on function public.get_exam_for_student(uuid, int) from public, anon;
grant execute on function public.get_exam_for_student(uuid, int) to authenticated;

-- ─────────────── ٣) التسليم: الواجب يُغلق بعد مهلته ───────────────
-- الاختبار كما كان حرفياً (لا يفرض موعداً). الواجب: بعد الموعد يُرفض ما لم
-- يسمح المعلّم بمهلة، وفي المهلة يُقبل ويُعلَّم «متأخراً».
create or replace function public.submit_exam_attempt(p_exam uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare e teacher_exams%rowtype; v_me uuid; v_total int; v_score int := 0;
        v_i int; v_correct int; v_given int; v_detail jsonb := '[]'::jsonb;
        v_due timestamptz; v_late boolean := false;
begin
    select * into e from teacher_exams where id = p_exam;
    if e.id is null then raise exception 'EXAM_NOT_FOUND'; end if;

    v_me := my_member_id(e.school_id);
    if v_me is null then raise exception 'NOT_IN_SCHOOL'; end if;
    if not e.published then raise exception 'NOT_PUBLISHED'; end if;
    if e.archived_at is not null then raise exception 'ARCHIVED_YEAR'; end if;
    if not exam_is_assigned_to_me(p_exam, e.school_id) then raise exception 'NOT_ASSIGNED'; end if;

    -- محاولة واحدة: لولا هذا لأعاد الطالب المحاولة حتى يصيب كل شيء
    if exists (select 1 from exam_attempts where exam_id = p_exam and student_id = v_me) then
        raise exception 'ALREADY_SUBMITTED';
    end if;

    if e.kind = 'homework' then
        v_due := my_exam_due(p_exam, e.school_id);
        if v_due is not null and now() > v_due then
            if now() > v_due + make_interval(days => coalesce(e.late_days, 0)) then
                raise exception 'PAST_DUE';
            end if;
            v_late := true;
        end if;
    end if;

    v_total := jsonb_array_length(coalesce(e.questions, '[]'::jsonb));

    for v_i in 0 .. greatest(v_total - 1, 0) loop
        v_correct := nullif(e.questions -> v_i ->> 'correct', '')::int;
        v_given   := nullif(p_answers   ->> v_i::text, '')::int;
        if v_correct is not null and v_given is not null and v_given = v_correct then
            v_score := v_score + 1;
        end if;
        v_detail := v_detail || jsonb_build_object(
            'i', v_i, 'given', v_given, 'correct', v_correct,
            'ok', (v_given is not null and v_given = v_correct));
    end loop;

    insert into exam_attempts (exam_id, student_id, score, total, answers, started_at, finished_at, late)
    values (p_exam, v_me, v_score, v_total, coalesce(p_answers, '{}'::jsonb), now(), now(), v_late);

    -- ⚠️ تفصيل الإجابات الصحيحة لا يُعاد للواجب: الحلّ يُكشف بعد المهلة وحدها
    return jsonb_build_object('score', v_score, 'total', v_total, 'late', v_late,
        'detail', case when e.kind = 'homework' then null else v_detail end);
end $function$;

-- ─────────────── ٤) متى تُفتح المراجعة ───────────────
-- الاختبار كما كان. الواجب: بعد انتهاء المهلة (الموعد + التأخير) — ولمن
-- لم يسلّم أيضاً، فيتعلّم من الحلّ (قرار المالك).
create or replace function public.may_review_exam(p_exam uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $function$
declare e teacher_exams%rowtype; v_me uuid; v_due timestamptz; v_has boolean;
begin
    select * into e from teacher_exams where id = p_exam;
    if e.id is null then return false; end if;
    v_me := my_member_id(e.school_id);
    if v_me is null then return false; end if;

    v_has := exists (select 1 from exam_attempts where exam_id = p_exam and student_id = v_me);

    if e.kind = 'homework' then
        if not exam_is_assigned_to_me(p_exam, e.school_id) then return false; end if;
        v_due := my_exam_due(p_exam, e.school_id);
        return v_due is not null
           and now() >= v_due + make_interval(days => coalesce(e.late_days, 0));
    end if;

    -- لا مراجعة قبل التسليم أصلاً: وإلا فُتحت الإجابات لمن لم يجب بعد
    if not v_has then return false; end if;
    if e.reveal_mode = 'never' then return false; end if;
    if e.reveal_mode = 'immediately' then return true; end if;

    v_due := my_exam_due(p_exam, e.school_id);
    -- بلا موعد محدَّد لا انتظار له معنى — تُكشف بعد التسليم
    return v_due is null or now() >= v_due;
end $function$;

-- ─────────────── ٥) قائمة ما أُسند للطالب بحالته ───────────────
-- الموعد يختلف بين فصل وآخر (يسكن exam_assignments)، فلا تستطيع القائمة
-- حسابه من الجدول: نداء واحد يُرجع لكل عمل موعده ومهلته ومحاولته وهل
-- تُفتح مراجعته — بدل فتح كل واجب لمعرفة حالته.
create or replace function my_assigned_work(p_school uuid)
returns table(exam_id uuid, kind text, due_at timestamptz, close_at timestamptz,
              done boolean, score numeric, total int, late boolean, can_review boolean)
language sql stable security definer set search_path = public as $$
    select e.id, e.kind, my_exam_due(e.id, p_school), my_exam_close(e.id, p_school),
           a.id is not null, a.score, a.total, coalesce(a.late, false), may_review_exam(e.id)
      from teacher_exams e
      left join lateral (
          select x.id, x.score, x.total, x.late from exam_attempts x
           where x.exam_id = e.id and x.student_id = my_member_id(p_school)
           order by x.created_at desc limit 1) a on true
     where e.school_id = p_school and e.published and e.archived_at is null
       and my_member_id(p_school) is not null
       and exam_is_assigned_to_me(e.id, p_school);
$$;
revoke all on function my_assigned_work(uuid) from public, anon;
grant execute on function my_assigned_work(uuid) to authenticated;
-- ─────────────── ٦) الدرجات الرسمية من ملف نور ───────────────
-- قرار المالك: تُستورد من ملف تصدير نور (مثل الغياب) وتُعرض **كما هي**:
-- لا حساب ولا متوسّط ولا تقدير من عندنا. فكل صفّ يحفظ أعمدة الملف التي
-- اختارها المدير بعناوينها ونصوصها حرفياً (items = [{label, value}]).
-- والهوية تُطابَق ببصمتها في الخادم ولا تُخزَّن (netlify/functions/school-grades.js).
create table if not exists official_grades (
    id           uuid primary key default gen_random_uuid(),
    school_id    uuid not null references schools(id) on delete cascade,
    student_id   uuid not null references school_members(id) on delete cascade,
    year_label   text not null check (length(year_label) between 1 and 20),
    term         text not null check (term in ('t1','t2','t3','final')),
    -- null = كشف شامل لعدة مواد (كل عمود مادة)
    subject_id   uuid references school_subjects(id) on delete restrict,
    subject_key  text generated always as (coalesce(subject_id::text, '*')) stored,
    items        jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
    source_name  text,
    uploaded_by  uuid references school_members(id) on delete set null,
    created_at   timestamptz not null default now(),
    unique (student_id, year_label, term, subject_key)
);
create index if not exists official_grades_school_idx on official_grades (school_id, year_label, term);
alter table official_grades enable row level security;
-- ⚠️ بلا سياسات عمداً: لا قراءة ولا كتابة مباشرة لأحد. كل قراءة تمرّ بدالة
-- تتحقق من الحق — ومنها ما يسجّل الاطّلاع (student_file).
revoke all on official_grades from anon, authenticated;

create or replace function apply_official_grades(p_school uuid, p_admin uuid, p_year text, p_term text,
                                                 p_subject uuid, p_source text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; v_student uuid; v_items jsonb; v_saved int := 0; v_unmatched int := 0;
begin
    if p_term not in ('t1','t2','t3','final') then raise exception 'BAD_TERM'; end if;
    if coalesce(length(trim(p_year)), 0) not between 1 and 20 then raise exception 'BAD_YEAR'; end if;
    if p_subject is not null and not exists (select 1 from school_subjects where id = p_subject and school_id = p_school)
        then raise exception 'BAD_SUBJECT'; end if;

    for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
        select id into v_student from school_members
         where school_id = p_school and role = 'student' and active and national_id_hash = (r ->> 'hash');
        if v_student is null then v_unmatched := v_unmatched + 1; continue; end if;

        -- نصوص قصيرة كما في الملف، ٣٠ عموداً كحدّ أقصى
        select coalesce(jsonb_agg(jsonb_build_object('label', left(x ->> 'label', 60), 'value', left(x ->> 'value', 40))
                                  order by n), '[]'::jsonb)
          into v_items
          from jsonb_array_elements(coalesce(r -> 'items', '[]'::jsonb)) with ordinality t(x, n)
         where n <= 30 and coalesce(x ->> 'label', '') <> '';

        insert into official_grades (school_id, student_id, year_label, term, subject_id, items, source_name, uploaded_by)
        values (p_school, v_student, trim(p_year), p_term, p_subject, v_items, left(p_source, 120), p_admin)
        on conflict (student_id, year_label, term, subject_key) do update
            set items = excluded.items, source_name = excluded.source_name,
                uploaded_by = excluded.uploaded_by, created_at = now();
        v_saved := v_saved + 1;
    end loop;
    return jsonb_build_object('saved', v_saved, 'unmatched', v_unmatched);
end $$;
revoke all on function apply_official_grades(uuid, uuid, text, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function apply_official_grades(uuid, uuid, text, text, uuid, text, jsonb) to service_role;

-- دفعات الرفع للمدير: ليرى ما رُفع ويحذف دفعةً رُفعت خطأً
create or replace function official_grade_batches(p_school uuid)
returns table(year_label text, term text, subject_id uuid, subject_name text, students int, uploaded_at timestamptz)
language sql stable security definer set search_path = public as $$
    select g.year_label, g.term, g.subject_id, s.name_ar, count(*)::int, max(g.created_at)
      from official_grades g left join school_subjects s on s.id = g.subject_id
     where g.school_id = p_school and is_school_admin(p_school)
     group by g.year_label, g.term, g.subject_id, s.name_ar
     order by max(g.created_at) desc;
$$;
revoke all on function official_grade_batches(uuid) from public, anon;
grant execute on function official_grade_batches(uuid) to authenticated;

create or replace function delete_official_grades(p_school uuid, p_year text, p_term text, p_subject uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
    if not is_school_admin(p_school) then raise exception 'NOT_ADMIN'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    delete from official_grades
     where school_id = p_school and year_label = p_year and term = p_term
       and subject_key = coalesce(p_subject::text, '*');
    get diagnostics n = row_count;
    return n;
end $$;
revoke all on function delete_official_grades(uuid, text, text, uuid) from public, anon;
grant execute on function delete_official_grades(uuid, text, text, uuid) to authenticated;

-- الطالب يرى درجاته الرسمية
create or replace function my_official_grades(p_school uuid)
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'year', g.year_label, 'term', g.term, 'subject', s.name_ar,
               'subject_en', s.name_en, 'items', g.items, 'at', g.created_at)
             order by g.year_label desc, g.term desc, s.sort_order nulls first), '[]'::jsonb)
      from official_grades g left join school_subjects s on s.id = g.subject_id
     where g.student_id = my_member_id(p_school);
$$;
revoke all on function my_official_grades(uuid) from public, anon;
grant execute on function my_official_grades(uuid) to authenticated;

-- ─────────────── ٧) سجلّ الطالب: للمعلّم والإدارة، مع سجلّ الاطّلاع ───────────────
-- قرار المالك: المعلّم يرى طلابه في مادته (درجاتهم وواجباتهم واختباراتهم)،
-- والإدارة ترى الملف كاملاً، ويُسجَّل من اطّلع على ملف كل طالب.
create table if not exists student_file_access (
    id           uuid primary key default gen_random_uuid(),
    school_id    uuid not null references schools(id) on delete cascade,
    student_id   uuid not null references school_members(id) on delete cascade,
    viewer_id    uuid references school_members(id) on delete set null,
    viewer_name  text,          -- يبقى الاسم لو حُذف الحساب لاحقاً
    viewer_role  text,
    viewed_at    timestamptz not null default now()
);
create index if not exists student_file_access_idx on student_file_access (student_id, viewed_at desc);
alter table student_file_access enable row level security;
revoke all on student_file_access from anon, authenticated;

-- هل الطالب مُسنَد إليه هذا العمل؟ (نسخة exam_is_assigned_to_me لطالبٍ بعينه)
create or replace function work_assigned_to(p_exam uuid, p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (
        select 1 from exam_assignments a
         where a.exam_id = p_exam
           and (a.student_id = p_student
             or a.class_id in (select cs.class_id from class_students cs where cs.student_id = p_student)
             or (a.grade is not null and a.grade = (select m.grade from school_members m where m.id = p_student))));
$$;
create or replace function work_due_for(p_exam uuid, p_student uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
    select max(a.due_at) from exam_assignments a
     where a.exam_id = p_exam
       and (a.student_id = p_student
         or a.class_id in (select cs.class_id from class_students cs where cs.student_id = p_student)
         or (a.grade is not null and a.grade = (select m.grade from school_members m where m.id = p_student)));
$$;
revoke all on function work_assigned_to(uuid, uuid) from public, anon, authenticated;
revoke all on function work_due_for(uuid, uuid) from public, anon, authenticated;

-- أعمال طالبٍ على المنصة (واجبات واختبارات) بدرجتها كما هي: الدرجة من المجموع
create or replace function student_works(p_student uuid, p_subjects uuid[], p_owner uuid)
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(w order by (w ->> 'sort') desc), '[]'::jsonb) from (
        select jsonb_build_object(
            'id', e.id, 'title', e.title, 'kind', e.kind,
            'subject', coalesce(s.name_ar, e.subject),
            'due_at', work_due_for(e.id, p_student),
            'late_days', e.late_days,
            'score', at.score, 'total', at.total, 'late', at.late, 'done_at', at.finished_at,
            'sort', coalesce(at.finished_at, work_due_for(e.id, p_student), e.created_at)) as w
          from teacher_exams e
          left join school_subjects s on s.id = e.subject_id
          left join lateral (select x.score, x.total, x.late, x.finished_at from exam_attempts x
                              where x.exam_id = e.id and x.student_id = p_student
                              order by x.created_at desc limit 1) at on true
         where e.school_id = (select school_id from school_members where id = p_student)
           and e.published and e.archived_at is null
           and (p_subjects is null or e.subject_id = any(p_subjects) or e.owner_id = p_owner)
           and work_assigned_to(e.id, p_student)
    ) q;
$$;
revoke all on function student_works(uuid, uuid[], uuid) from public, anon, authenticated;

create or replace function student_official(p_student uuid, p_subjects uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object(
               'year', g.year_label, 'term', g.term, 'subject', s.name_ar, 'subject_en', s.name_en,
               'items', g.items, 'at', g.created_at)
             order by g.year_label desc, g.term desc, s.sort_order nulls first), '[]'::jsonb)
      from official_grades g left join school_subjects s on s.id = g.subject_id
     where g.student_id = p_student
       and (p_subjects is null or g.subject_id = any(p_subjects));
$$;
revoke all on function student_official(uuid, uuid[]) from public, anon, authenticated;

create or replace function student_access_log(p_student uuid, p_limit int)
returns jsonb language sql stable security definer set search_path = public as $$
    select coalesce(jsonb_agg(jsonb_build_object('name', l.viewer_name, 'role', l.viewer_role, 'at', l.viewed_at)
                              order by l.viewed_at desc), '[]'::jsonb)
      from (select * from student_file_access where student_id = p_student
             order by viewed_at desc limit p_limit) l;
$$;
revoke all on function student_access_log(uuid, int) from public, anon, authenticated;

-- ملف الطالب — يُسجِّل الاطّلاع، فهو volatile عمداً.
-- الإدارة: كل شيء + سجلّ الاطّلاع. المعلّم: ما يخصّ موادّه لهذا الطالب فقط.
create or replace function student_file(p_student uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare m school_members%rowtype; v_me school_members%rowtype; v_role text; v_subjects uuid[]; v_class text;
begin
    select * into m from school_members where id = p_student and role = 'student';
    if m.id is null then raise exception 'STUDENT_NOT_FOUND'; end if;
    select * into v_me from school_members where school_id = m.school_id and uid = auth.uid() and active limit 1;
    if v_me.id is null then raise exception 'NOT_ALLOWED'; end if;

    if v_me.role = 'admin' then
        v_role := 'admin';
    elsif v_me.role = 'teacher' and exists (
            select 1 from class_teachers ct join class_students cs on cs.class_id = ct.class_id
             where ct.teacher_id = v_me.id and cs.student_id = m.id) then
        v_role := 'teacher';
        v_subjects := array(select distinct ct.subject_id from class_teachers ct
                              join class_students cs on cs.class_id = ct.class_id
                             where ct.teacher_id = v_me.id and cs.student_id = m.id and ct.subject_id is not null);
    else
        raise exception 'NOT_ALLOWED';
    end if;

    -- لا نُغرق السجلّ: فتحٌ متكرر من الشخص نفسه خلال ١٠ دقائق يُسجَّل مرة
    if not exists (select 1 from student_file_access
                    where student_id = m.id and viewer_id = v_me.id and viewed_at > now() - interval '10 minutes') then
        insert into student_file_access (school_id, student_id, viewer_id, viewer_name, viewer_role)
        values (m.school_id, m.id, v_me.id, v_me.full_name, v_role);
    end if;

    select c.name into v_class from class_students cs join classes c on c.id = cs.class_id
     where cs.student_id = m.id order by c.name limit 1;

    return jsonb_build_object(
        'student', jsonb_build_object('id', m.id, 'name', m.full_name, 'grade', m.grade,
                                      'section', m.section, 'class', v_class, 'active', m.active),
        'viewer_role', v_role,
        'attendance', latest_attendance(m.id),
        'works', student_works(m.id, case when v_role = 'admin' then null else v_subjects end, v_me.id),
        'official', student_official(m.id, case when v_role = 'admin' then null else coalesce(v_subjects, '{}') end),
        'access_log', case when v_role = 'admin' then student_access_log(m.id, 30) end
    );
end $$;
revoke all on function student_file(uuid) from public, anon;
grant execute on function student_file(uuid) to authenticated;

-- سجلّ المادة للمعلّم: طلاب الفصل × أعمال المادة، ودرجاتهم الرسمية فيها.
-- عرضٌ لقائمة الفصل لا فتحٌ لملف طالب، فلا يُسجَّل اطّلاعاً (فتح الملف يُسجَّل).
create or replace function teacher_class_book(p_class uuid, p_subject uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c classes%rowtype; v_me uuid; v_admin boolean;
        v_students jsonb; v_works jsonb; v_cells jsonb; v_official jsonb;
begin
    select * into c from classes where id = p_class;
    if c.id is null then raise exception 'CLASS_NOT_FOUND'; end if;
    v_me := my_member_id(c.school_id);
    v_admin := is_school_admin(c.school_id);
    if v_me is null or not (v_admin or exists (
            select 1 from class_teachers ct where ct.class_id = p_class and ct.teacher_id = v_me
               and ct.subject_id is not distinct from p_subject)) then
        raise exception 'NOT_ALLOWED';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'name', m.full_name, 'section', m.section)
                              order by m.full_name), '[]'::jsonb)
      into v_students
      from class_students cs join school_members m on m.id = cs.student_id
     where cs.class_id = p_class and m.active and m.role = 'student';

    -- آخر ٤٠ عملاً في المادة أُسند لأحد طلاب الفصل
    with ws as (
        select e.id, e.title, e.kind, e.created_at, e.late_days from teacher_exams e
         where e.school_id = c.school_id and e.published and e.archived_at is null
           and (e.subject_id = p_subject or (p_subject is null and e.owner_id = v_me))
           and exists (select 1 from class_students cs where cs.class_id = p_class and work_assigned_to(e.id, cs.student_id))
         order by e.created_at desc limit 40)
    select coalesce(jsonb_agg(jsonb_build_object('id', ws.id, 'title', ws.title, 'kind', ws.kind,
               'due_at', (select max(a.due_at) from exam_assignments a where a.exam_id = ws.id))
             order by ws.created_at), '[]'::jsonb),
           coalesce((select jsonb_agg(jsonb_build_object('w', ws2.id, 'st', cs.student_id,
                        'assigned', work_assigned_to(ws2.id, cs.student_id),
                        'score', at.score, 'total', at.total, 'late', at.late))
                       from ws ws2 cross join class_students cs
                       left join lateral (select x.score, x.total, x.late from exam_attempts x
                                           where x.exam_id = ws2.id and x.student_id = cs.student_id
                                           order by x.created_at desc limit 1) at on true
                      where cs.class_id = p_class), '[]'::jsonb)
      into v_works, v_cells
      from ws;

    select coalesce(jsonb_agg(jsonb_build_object('st', g.student_id, 'year', g.year_label, 'term', g.term, 'items', g.items)
                              order by g.year_label desc, g.term desc), '[]'::jsonb)
      into v_official
      from official_grades g join class_students cs on cs.student_id = g.student_id and cs.class_id = p_class
     where p_subject is not null and g.subject_id = p_subject;

    return jsonb_build_object('class', jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade, 'section', c.section),
                              'subject', (select jsonb_build_object('id', s.id, 'name', s.name_ar, 'name_en', s.name_en)
                                            from school_subjects s where s.id = p_subject),
                              'students', v_students, 'works', v_works, 'cells', v_cells, 'official', v_official);
end $$;
revoke all on function teacher_class_book(uuid, uuid) from public, anon;
grant execute on function teacher_class_book(uuid, uuid) to authenticated;

-- ─────────────── ٨) تقرير وليّ الأمر: الواجبات والدرجات الرسمية وسجلّ الاطّلاع ───────────────
-- مفاتيح مضافة فقط (kind وlate في exams، وofficial وaccess_log) — صفحة وليّ
-- الأمر المنشورة حالياً تتجاهل ما لا تعرفه فلا تنكسر.
create or replace function parent_child_report(p_member uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m school_members%rowtype; v_school text; v_class text; v_exams jsonb; v_sum jsonb;
begin
    select * into m from school_members where id = p_member and active and role = 'student';
    if m.id is null then raise exception 'STUDENT_NOT_FOUND'; end if;

    select coalesce(name_ar, name_en) into v_school from schools where id = m.school_id;
    select c.name into v_class from class_students cs join classes c on c.id = cs.class_id
     where cs.student_id = m.id limit 1;

    with assigned as (
        select distinct a.exam_id from exam_assignments a
         where a.student_id = m.id
            or (a.grade is not null and a.grade = m.grade)
            or a.class_id in (select cs.class_id from class_students cs where cs.student_id = m.id)
    ),
    best as (
        select s.exam_id,
               max(case when at.finished_at is not null and at.total > 0
                        then round(at.score::numeric * 100 / at.total) end) as pct,
               max(at.finished_at) as done_at,
               bool_or(coalesce(at.late, false)) as late
          from assigned s
          left join exam_attempts at on at.exam_id = s.exam_id and at.student_id = m.id
         group by s.exam_id
    )
    select
        coalesce(jsonb_agg(jsonb_build_object(
            'title', e.title, 'subject', e.subject, 'kind', e.kind, 'late', b.late,
            'teacher', (select t.full_name from school_members t where t.id = e.owner_id),
            'due_at', my_due.due_at, 'pct', b.pct, 'done_at', b.done_at
        ) order by coalesce(b.done_at, my_due.due_at) desc nulls last), '[]'::jsonb),
        jsonb_build_object('assigned', count(*), 'done', count(b.pct), 'avg_pct', round(avg(b.pct)))
      into v_exams, v_sum
      from best b
      join teacher_exams e on e.id = b.exam_id
      left join lateral (
          select max(a.due_at) as due_at from exam_assignments a
           where a.exam_id = b.exam_id
             and (a.student_id = m.id
               or (a.grade is not null and a.grade = m.grade)
               or a.class_id in (select cs.class_id from class_students cs where cs.student_id = m.id))
      ) my_due on true
     where e.published and e.archived_at is null;

    return jsonb_build_object(
        'student', jsonb_build_object('name', m.full_name, 'grade', m.grade,
                                      'section', m.section, 'class', v_class),
        'school', v_school, 'generated_at', now(),
        'attendance', latest_attendance(m.id),
        'summary', coalesce(v_sum, jsonb_build_object('assigned',0,'done',0,'avg_pct',null)),
        'exams', coalesce(v_exams, '[]'::jsonb),
        'official', student_official(m.id, null),
        'access_log', student_access_log(m.id, 20)
    );
end $$;
revoke all on function parent_child_report(uuid) from public, anon, authenticated;
grant execute on function parent_child_report(uuid) to service_role;
