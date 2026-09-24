-- ============================================================
--  المرحلة ٥ — لوحة المرشد الطلابي (٢٤ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  قرار المالك: ضعف الفصل **حسب المادة** (الرياضيات مثلاً) لا حسب مهارات
--  القدرات، ويأتي آخراً لأنه يحتاج بيانات فعلية متراكمة.
--
--  • المرشد: علامة is_counselor على عضو من الطاقم يضعها المدير (لا دور
--    جديد — إضافة قيمة لنوع الدور تكسر الواجهة المنشورة التي لا تعرفها).
--  • المصدر: واجبات المنصة واختباراتها فقط (الدرجة من المجموع). درجات نور
--    الرسمية لا يُحسب منها شيء (قرار المرحلة ١ باقٍ). والتدريب خارجها (بلا درجات).
--  • الدالّة تُرجع الأرقام الخام لكل (طالب، مادة)؛ والتجميع والحكم في الواجهة
--    مع حدّ أدنى للبيانات — كي لا يُحكم على فصلٍ بواجب واحد.
-- ============================================================

alter table school_members add column if not exists is_counselor boolean not null default false;
alter table school_members drop constraint if exists school_members_counselor_staff;
alter table school_members add constraint school_members_counselor_staff
    check (not is_counselor or role <> 'student');

create or replace function is_school_counselor(p_school uuid)
returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from school_members m
                    where m.school_id = p_school and m.uid = auth.uid() and m.active
                      and (m.role = 'admin' or m.is_counselor));
$$;
revoke all on function is_school_counselor(uuid) from public, anon;
grant execute on function is_school_counselor(uuid) to authenticated;

create or replace function counselor_overview(p_school uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
    if not is_school_counselor(p_school) then raise exception 'NOT_ALLOWED'; end if;

    with st as (
        select m.id, m.full_name, m.grade, m.section,
               (select cs.class_id from class_students cs join classes c on c.id = cs.class_id
                 where cs.student_id = m.id order by c.name limit 1) as class_id
          from school_members m
         where m.school_id = p_school and m.role = 'student' and m.active),
    ex as (
        select e.id, e.subject_id, e.late_days from teacher_exams e
         where e.school_id = p_school and e.published and e.archived_at is null
           and e.kind <> 'practice' and e.subject_id is not null),
    pairs as (
        select distinct ex.id as exam_id, ex.subject_id, ex.late_days, st.id as student_id
          from ex join exam_assignments a on a.exam_id = ex.id
          join st on (a.student_id = st.id
                   or (a.grade is not null and a.grade = st.grade)
                   or a.class_id in (select cs.class_id from class_students cs where cs.student_id = st.id))),
    res as (
        select p.*, at.score, at.total, work_due_for(p.exam_id, p.student_id) as due
          from pairs p
          left join lateral (select x.score, x.total from exam_attempts x
                              where x.exam_id = p.exam_id and x.student_id = p.student_id
                              order by x.created_at desc limit 1) at on true),
    ss as (
        select student_id, subject_id,
               count(*) as assigned,
               count(total) as done,
               count(*) filter (where total is null and due is not null
                                  and now() > due + make_interval(days => coalesce(late_days, 0))) as missed,
               round(avg(case when total > 0 then score * 100.0 / total end)) as pct
          from res group by student_id, subject_id)
    select jsonb_build_object(
        'students', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', id, 'name', full_name, 'grade', grade, 'section', section, 'class', class_id,
                        'absent', latest_attendance(id) ->> 'absent')), '[]'::jsonb) from st),
        'classes',  (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'grade', c.grade)
                        order by c.grade, c.name), '[]'::jsonb) from classes c where c.school_id = p_school),
        'subjects', (select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name_ar, 'name_en', s.name_en)
                        order by s.sort_order), '[]'::jsonb) from school_subjects s where s.school_id = p_school),
        'ss',       (select coalesce(jsonb_agg(jsonb_build_object(
                        'st', student_id, 'sub', subject_id, 'a', assigned, 'd', done, 'm', missed, 'p', pct)), '[]'::jsonb) from ss),
        'generated_at', now())
      into v;
    return v;
end $$;
revoke all on function counselor_overview(uuid) from public, anon;
grant execute on function counselor_overview(uuid) to authenticated;

-- ملف الطالب: المرشد يراه كاملاً كالإدارة (بلا سجلّ الاطّلاع — للإدارة وحدها)، واطّلاعه يُسجَّل
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
    elsif v_me.is_counselor then
        v_role := 'counselor';        -- المرشد: الملف كاملاً (كل المواد)، واطّلاعه يُسجَّل
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
        'works', student_works(m.id, case when v_role in ('admin','counselor') then null else v_subjects end, v_me.id),
        'official', student_official(m.id, case when v_role in ('admin','counselor') then null else coalesce(v_subjects, '{}') end),
        'access_log', case when v_role = 'admin' then student_access_log(m.id, 30) end
    );
end $$;
revoke all on function student_file(uuid) from public, anon;
grant execute on function student_file(uuid) to authenticated;
