-- ============================================================
--  دوالّ تسليم اختبار المدرسة ومراجعته
--  ------------------------------------------------------------
--  ⚠️ (٢٤ سبتمبر) الشكل الحالي لـget_exam_for_student وsubmit_exam_attempt
--  وmay_review_exam في sql/PHASE1_HOMEWORK_GRADES.sql §٢–٤ (الواجبات والخلط
--  والمهلة). ما هنا تاريخها قبل المرحلة ١.
--
--  ⚠️ لماذا هذا الملف أُنشئ متأخراً (٢٠٢٦-٠٩-٢٢)؟
--  الدوالّ الثلاث أدناه كُتبت مباشرة على قاعدة البيانات الحية في جلسة
--  سابقة، ولم تُحفَظ يوماً في المستودع — فلم يكن أحد (لا أنا ولا نسخة
--  لاحقة مني) يقدر يعرف شكلها الفعلي إلا بقراءتها حيّة من Supabase. وهذا
--  بالضبط ما كشف عنه إضافة حقل "شرح الحل" (explanation) لكل سؤال: كدت
--  أعدّل get_exam_review بالتخمين خوفاً من كسر إخفاء الإجابة الصحيحة، ثم
--  تبيّن بعد قراءتها فعلياً أنها لا تحتاج أي تعديل (تدمج q.value كاملاً
--  بعد التسليم أصلاً)، بينما العطل الحقيقي كان في get_exam_for_student:
--  كانت تحذف 'correct' فقط ولا تحذف 'explanation' — فكان شرح الحل يصل
--  الطالب **قبل** إرسال إجابته عبر تبويب Network في المتصفح مباشرة.
--
--  فمن الآن: أي تعديل على هذه الدوالّ يُحدَّث في هذا الملف أولاً، ثم يُطبَّق
--  على القاعدة الحية بـsupabase MCP، تماماً كما تُطبَّق تعديلات
--  SCHOOL_SCHEMA.sql. النسخة أدناه مطابقة حرفياً لما هو منشور على الإنتاج
--  وقت كتابة هذا الملف.
-- ============================================================

-- ============================================================
--  ثغرة أخطر اكتُشفت أثناء نفس المراجعة: teacher_exams.questions كان
--  مقروءاً مباشرة من الجدول لكل من يملك صفّاً مسموحاً به بسياسات RLS —
--  والسياسات صحيحة صفّياً (exams_owner_all للمعلّم، exams_student_read
--  للطالب) لكنها لا تُقيّد الأعمدة إطلاقاً. فمنح Supabase الافتراضي
--  (grant select على كل الجدول) كان يعني: أي طالب أُسند إليه اختبار
--  منشور يقرأ عمود questions **كاملاً بإجاباته الصحيحة** بمجرد فتح تبويب
--  الاختبارات — عبر js/14-school-work.js (loadTeacherExams) الذي كان
--  يطلب هذا العمود فقط ليحسب عدد الأسئلة (questions.length)، فيصل معه
--  محتواه بالكامل دون أن تحتاج الواجهة له أصلاً. لا اختراق مطلوب: مجرد
--  استخدام عادي للتطبيق يضع الإجابات في استجابة الشبكة وذاكرة المتصفح.
--
--  الإصلاح جزءان لا غنى عن أيّهما:
--  (١) عمود مولَّد (question_count) يحمل العدد وحده — كل ما احتاجته
--      الواجهة فعلياً — فلا حاجة لقراءة questions من هذا المسار بتاتاً.
--  (٢) سحب صلاحية SELECT الجدولية عن authenticated وanon، ثم منحها من
--      جديد على كل الأعمدة **ما عدا questions** صراحة. لاحظ أن سحب عمود
--      questions وحده بـ‎revoke select (questions)‎ لا يكفي: تحقّقتُ عملياً
--      أنه يبقى مقروءاً طالما المنح الجدولي الأصلي قائماً (المنح الجدولي
--      يغطّي كل عمود، والسحب العمودي وحده لا يتغلّب عليه) — فكان لا بد من
--      سحب المنح الجدولي كاملاً أولاً.
--
--  ولا يتأثر شيء آخر: get_exam_for_student/get_exam_review/submit_exam_attempt
--  تعمل SECURITY DEFINER بصلاحية مالك الدالّة لا المستخدم المُنادي، فتقرأ
--  questions من داخلها بلا أي عائق. وsaveExamDraft في js/18-exam-builder.js
--  يكتب (INSERT) لا يقرأ، وصلاحية INSERT منفصلة تماماً عن SELECT.
-- ============================================================
alter table teacher_exams add column if not exists question_count int
    generated always as (jsonb_array_length(coalesce(questions, '[]'::jsonb))) stored;

revoke select on teacher_exams from authenticated, anon;

grant select (id, school_id, owner_id, title, subject, grade, duration_min,
              timed, published, reveal_mode, archived_at, created_at, question_count)
  on teacher_exams to authenticated;
-- anon بلا أي عمود عمداً: RLS يمنعه صفّياً على أي حال (my_member_id/my_role
-- تحتاج auth.uid() حقيقياً)، وهذا تحصين إضافي لا اعتماد جديد عليه.

-- ─────────────── ما يصل الطالب قبل التسليم — بلا الإجابة الصحيحة ولا شرحها ───────────────
create or replace function public.get_exam_for_student(p_exam uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare e teacher_exams%rowtype; v_me uuid; v_q jsonb; v_prev exam_attempts%rowtype; v_due timestamptz;
begin
    select * into e from teacher_exams where id = p_exam;
    if e.id is null then raise exception 'EXAM_NOT_FOUND'; end if;

    v_me := my_member_id(e.school_id);
    if v_me is null then raise exception 'NOT_IN_SCHOOL'; end if;
    if not e.published then raise exception 'NOT_PUBLISHED'; end if;
    if e.archived_at is not null then raise exception 'ARCHIVED_YEAR'; end if;
    if not exam_is_assigned_to_me(p_exam, e.school_id) then raise exception 'NOT_ASSIGNED'; end if;

    -- ⚠️ 'correct' و'explanation' كلاهما يُحذَف هنا عمداً: كلاهما يكشف
    -- الإجابة الصحيحة (الثاني بقوة أقل لكن كافية للغش) — انظر الشرح أعلى الملف.
    select coalesce(jsonb_agg(
               (q.value - 'correct' - 'explanation') || jsonb_build_object('i', q.ordinality - 1)
               order by q.ordinality), '[]'::jsonb)
      into v_q
      from jsonb_array_elements(coalesce(e.questions, '[]'::jsonb)) with ordinality q(value, ordinality);

    select * into v_prev from exam_attempts
     where exam_id = p_exam and student_id = v_me
     order by created_at desc limit 1;

    v_due := my_exam_due(p_exam, e.school_id);

    return jsonb_build_object(
        'id', e.id, 'title', e.title, 'subject', e.subject,
        'timed', e.timed,
        'duration_min', case when e.timed then e.duration_min else null end,
        'due_at', v_due,
        'owner_id', e.owner_id,
        'questions', v_q,
        'can_review', may_review_exam(p_exam),
        'attempt', case when v_prev.id is null then null else jsonb_build_object(
            'score', v_prev.score, 'total', v_prev.total,
            'finished_at', v_prev.finished_at) end
    );
end $function$;

-- ─────────────── التصحيح وتسجيل المحاولة (مرة واحدة فقط لكل طالب) ───────────────
create or replace function public.submit_exam_attempt(p_exam uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare e teacher_exams%rowtype; v_me uuid; v_total int; v_score int := 0;
        v_i int; v_correct int; v_given int; v_detail jsonb := '[]'::jsonb;
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

    insert into exam_attempts (exam_id, student_id, score, total, answers, started_at, finished_at)
    values (p_exam, v_me, v_score, v_total, coalesce(p_answers, '{}'::jsonb), now(), now());

    return jsonb_build_object('score', v_score, 'total', v_total, 'detail', v_detail);
end $function$;

-- ─────────────── المراجعة بعد التسليم — تُعيد السؤال كاملاً (بما فيه correct وexplanation) ───────────────
-- ⚠️ لا تحتاج حذف أي حقل: q.value كاملاً هنا مقصود ومطلوب، لأن may_review_exam
-- أدناه هو الحارس الوحيد — ولا يسمح بالنداء أصلاً إلا بعد التسليم (أو بعد
-- موعد التسليم، بحسب إعداد المعلّم). فأي حقل يضيفه المعلّم مستقبلاً لكل
-- سؤال (كـexplanation اليوم) يصل الطالب هنا تلقائياً بلا حاجة لتعديل هذه
-- الدالّة كل مرة — العكس تماماً من get_exam_for_student أعلاه.
create or replace function public.get_exam_review(p_exam uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare e teacher_exams%rowtype; v_me uuid; v_att exam_attempts%rowtype; v_q jsonb;
begin
    if not may_review_exam(p_exam) then raise exception 'REVIEW_NOT_ALLOWED'; end if;

    select * into e from teacher_exams where id = p_exam;
    v_me := my_member_id(e.school_id);
    select * into v_att from exam_attempts
     where exam_id = p_exam and student_id = v_me
     order by created_at desc limit 1;

    select coalesce(jsonb_agg(q.value || jsonb_build_object(
               'i', q.ordinality - 1,
               'given', nullif(v_att.answers ->> (q.ordinality - 1)::text, '')::int
           ) order by q.ordinality), '[]'::jsonb)
      into v_q
      from jsonb_array_elements(coalesce(e.questions, '[]'::jsonb)) with ordinality q(value, ordinality);

    return jsonb_build_object(
        'id', e.id, 'title', e.title, 'subject', e.subject,
        'score', v_att.score, 'total', v_att.total,
        'questions', v_q);
end $function$;
