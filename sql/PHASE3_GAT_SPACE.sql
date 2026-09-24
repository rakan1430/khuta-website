-- ============================================================
--  المرحلة ٣ — مساحة القدرات للمعلّم (٢٤ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  قرارات المالك:
--  • المعلّم يرسل لطلابه اختبارات قدرات وملفات وروابط فيديو — **تدريب بلا درجات**.
--  • الطالب يعيد الاختبار متى شاء، ويرى محاولاته السابقة.
--  • المحتوى لطلاب المدرسة فقط (لا يصل طلاب خُطى العامّين).
--  • المعلّم يرى **عدد المختبرين فقط** — بلا أسماء ولا درجات.
--  • ❌ ملغاة: أن يجمع المالك محتوى المعلّمين لينشره لاحقاً (حقوق المحتوى).
--
--  التنفيذ: اختبار التدريب نوعٌ ثالث من teacher_exams (kind='practice') على
--  المحرّك نفسه. والملفات والروابط في جدوليها الحاليين بعمود space.
--  ⚠️ القاعدة واحدة للمعاينة والإنتاج: كل ما هنا إضافي/مُضيِّق، ولا اختبار
--  تدريب موجود قبل هذا فلا يتغيّر سلوك شيء قائم.
-- ============================================================

-- ─────────── ١) النوع الثالث: تدريب ───────────
alter table teacher_exams drop constraint if exists teacher_exams_kind_chk;
alter table teacher_exams add constraint teacher_exams_kind_chk check (kind in ('exam','homework','practice'));
alter table teacher_exams add column if not exists gat_section text
    check (gat_section is null or gat_section in ('verbal','quant','mixed'));
grant select (gat_section) on teacher_exams to authenticated;

-- التدريب يُراجَع فور كل محاولة (الغرض التعلّم لا التقييم)، ولا مهلة تأخير له
create or replace function trg_homework_reveal()
returns trigger language plpgsql security definer set search_path = public as $$
begin
    if new.kind = 'homework' then new.reveal_mode := 'after_due'; end if;
    if new.kind = 'practice' then new.reveal_mode := 'immediately'; end if;
    if new.kind <> 'homework' then new.late_days := 0; end if;
    if new.kind <> 'practice' then new.gat_section := null; end if;
    return new;
end $$;

-- ─────────── ٢) «بلا درجات» للطاقم: لا يقرأ المعلّم ولا الإدارة محاولات التدريب ───────────
drop policy if exists attempts_owner_read on exam_attempts;
create policy attempts_owner_read on exam_attempts for select to authenticated using (
    exists (select 1 from teacher_exams e where e.id = exam_attempts.exam_id
             and e.owner_id = my_member_id(e.school_id) and e.kind <> 'practice'));
drop policy if exists attempts_admin_read on exam_attempts;
create policy attempts_admin_read on exam_attempts for select to authenticated using (
    exists (select 1 from teacher_exams e where e.id = exam_attempts.exam_id
             and is_school_admin(e.school_id) and e.kind <> 'practice'));
-- (attempts_student_own باقية: الطالب يرى محاولاته هو)

-- عدد المختبرين فقط — لا أسماء ولا درجات ولا حتى عدد المحاولات
create or replace function practice_takers(p_school uuid)
returns table(exam_id uuid, takers int)
language sql stable security definer set search_path = public as $$
    select e.id, count(distinct a.student_id)::int
      from teacher_exams e left join exam_attempts a on a.exam_id = e.id
     where e.school_id = p_school and e.kind = 'practice'
       and (e.owner_id = my_member_id(p_school) or is_school_admin(p_school))
     group by e.id;
$$;
revoke all on function practice_takers(uuid) from public, anon;
grant execute on function practice_takers(uuid) to authenticated;

-- ─────────── ٣) إعادة المحاولة متى شاء ───────────
create or replace function submit_exam_attempt(p_exam uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
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

    -- التدريب يُعاد بلا حدّ؛ الاختبار والواجب مرة واحدة كما كانا
    if e.kind <> 'practice' and exists (select 1 from exam_attempts where exam_id = p_exam and student_id = v_me) then
        raise exception 'ALREADY_SUBMITTED';
    end if;
    -- حدٌّ معقول ضد الإغراق الآلي: ٣٠ محاولة في الساعة للتدريب الواحد
    if e.kind = 'practice' and (select count(*) from exam_attempts where exam_id = p_exam and student_id = v_me
                                   and created_at > now() - interval '1 hour') >= 30 then
        raise exception 'TOO_MANY_ATTEMPTS';
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

    return jsonb_build_object('score', v_score, 'total', v_total, 'late', v_late,
        'detail', case when e.kind = 'homework' then null else v_detail end);
end $$;

-- الطالب يرى محاولاته السابقة في التدريب (مفتاحان مضافان: gat_section و attempts)
create or replace function get_exam_for_student(p_exam uuid, p_client int default 1)
returns jsonb language plpgsql stable security definer set search_path = public as $$
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
        'kind', e.kind, 'late_days', e.late_days, 'gat_section', e.gat_section,
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
            'finished_at', v_prev.finished_at) end,
        'attempts', case when e.kind = 'practice' then (
            select coalesce(jsonb_agg(jsonb_build_object('score', x.score, 'total', x.total, 'at', x.finished_at)
                                      order by x.created_at desc), '[]'::jsonb)
              from exam_attempts x where x.exam_id = p_exam and x.student_id = v_me) end
    );
end $$;
revoke all on function get_exam_for_student(uuid, int) from public, anon;
grant execute on function get_exam_for_student(uuid, int) to authenticated;

-- ─────────── ٤) التدريب خارج السجلّ والملف وتقرير وليّ الأمر ───────────
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
           and e.published and e.archived_at is null and e.kind <> 'practice'
           and (p_subjects is null or e.subject_id = any(p_subjects) or e.owner_id = p_owner)
           and work_assigned_to(e.id, p_student)
    ) q;
$$;
revoke all on function student_works(uuid, uuid[], uuid) from public, anon, authenticated;

-- سجلّ المادة للمعلّم: بلا اختبارات التدريب
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
           and e.kind <> 'practice'
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

-- تقرير وليّ الأمر: بلا اختبارات التدريب (تدريب بلا درجات)
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
     where e.published and e.archived_at is null and e.kind <> 'practice';

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

-- ─────────── ٥) ملفات وروابط مساحة القدرات ───────────
-- نفس الجدولين ونفس صلاحياتهما (الطالب يرى ما شاركه معلّمو فصله) — مع عمود space.
alter table teacher_files add column if not exists space text not null default 'general'
    check (space in ('general','gat'));
alter table teacher_links add column if not exists space text not null default 'general'
    check (space in ('general','gat'));

-- حدّ الروابط لكل مساحة على حدة: ٩ للروابط العامة كما كانت، و٤٠ لروابط فيديو القدرات
create or replace function enforce_links_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
    select count(*) into n from teacher_links
     where owner_id = new.owner_id and space = coalesce(new.space, 'general');
    if coalesce(new.space, 'general') = 'general' and n >= 9 then raise exception 'LINKS_LIMIT_REACHED'; end if;
    if new.space = 'gat' and n >= 40 then raise exception 'LINKS_LIMIT_REACHED'; end if;
    return new;
end $$;
revoke all on function enforce_links_limit() from public, anon, authenticated;
