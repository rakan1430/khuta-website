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
