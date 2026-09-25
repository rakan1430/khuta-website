-- ============================================================
--  المرحلة ٨ — رسائل البريد: لمن تصل، ومن يرسلها
--  ------------------------------------------------------------
--  طلب المالك (٢٥ سبتمبر): في لوحة رسائل البريد خانةٌ يختار بها أن تصل
--  «لطلاب منصّة المدرسة فقط» أو «لطلاب خُطى فقط» أو «للكل». ولإدارة المدرسة
--  لوحةٌ ترسل **لطلاب مدرستها وحدهم** ولا ترى غير ذلك، ويمكن جدولتها لتُرسل
--  تلقائياً. والمالك يرى الفئتين ويدير وصول الرسائل لكل طالب.
--
--  القواعد (مكانها هنا لا في الواجهة ولا في الدالّة — مصدر واحد):
--   • رسالة من خُطى (origin=owner) = تسويقية: لا تصل إلا من وافق صراحةً
--     (user_data.marketing_consent) — طالب مدرسة أو غيره سواء.
--   • رسالة من إدارة المدرسة (origin=school) = مدرسية كإشعار الاختبار: تصل
--     كل طالب نشِط في تلك المدرسة، إلا من أوقفها (رابط الإلغاء في الرسالة
--     نفسها، أو المالك).
--   • «طلاب خُطى» = من ليس عضواً نشِطاً في أي مدرسة.
--   • حساب مجهول أو بريد مصطنع (khuta.*@gmail.com) لا يُراسَل أبداً.
--
--  آمن على الإنتاج المشترك: أعمدة جديدة بقيم افتراضية تطابق سلوك الواجهة
--  المنشورة حرفياً (audience=all, origin=owner, html)، وجدول جديد، ودوالّ
--  جديدة، وسياسات إضافية لإدارة المدرسة لا تمسّ سياسة المالك.
-- ============================================================

-- ─────────────── ١) أعمدة الرسالة ───────────────
alter table marketing_messages
    add column if not exists audience text not null default 'all',
    add column if not exists school_id uuid references schools(id) on delete cascade,
    add column if not exists origin text not null default 'owner',
    add column if not exists body_format text not null default 'html',
    add column if not exists created_by uuid default auth.uid(),
    add column if not exists sending_started_at timestamptz,
    add column if not exists send_result jsonb;

alter table marketing_messages drop constraint if exists mm_audience_chk;
alter table marketing_messages add constraint mm_audience_chk check (audience in ('all', 'khuta', 'school'));
alter table marketing_messages drop constraint if exists mm_origin_chk;
alter table marketing_messages add constraint mm_origin_chk check (origin in ('owner', 'school'));
alter table marketing_messages drop constraint if exists mm_format_chk;
alter table marketing_messages add constraint mm_format_chk check (body_format in ('html', 'text'));
-- رسالة المدرسة: لطلابها فقط، ونصّ عادي فقط (لا HTML يحمل رابط تصيّد باسم خُطى)
alter table marketing_messages drop constraint if exists mm_school_shape_chk;
alter table marketing_messages add constraint mm_school_shape_chk
    check (origin <> 'school' or (school_id is not null and audience = 'school' and body_format = 'text'));

create index if not exists mm_due_idx on marketing_messages (send_after)
    where sent_at is null and sending_started_at is null;
create index if not exists mm_school_idx on marketing_messages (school_id, created_at desc);

-- ─────────────── ٢) من أوقف الرسائل ───────────────
-- scope: school = رسائل إدارة المدرسة · khuta = رسائل خُطى
-- source: self = الطالب نفسه (رابط الإلغاء) · owner = المالك من لوحته.
-- ⚠️ المالك لا يرفع إيقافاً وضعه الطالب بنفسه — موافقته لا تُستعاد إلا منه.
create table if not exists notify_optouts (
    uid uuid not null,
    scope text not null check (scope in ('school', 'khuta')),
    source text not null check (source in ('self', 'owner')),
    created_at timestamptz not null default now(),
    primary key (uid, scope)
);
alter table notify_optouts enable row level security;
revoke all on notify_optouts from anon, authenticated;

-- ─────────────── ٣) حارس الأعمدة التي يملكها الخادم ───────────────
-- إدارة المدرسة تكتب العنوان والنص والموعد فقط. حالة الإرسال ونتيجته ومن
-- كتبها لا تُكتب من المتصفّح. وحدّ ٣ رسائل للمدرسة في اليوم.
-- ⚠️ ليست SECURITY DEFINER عمداً: current_user يجب أن يبقى دور المُنادي.
create or replace function trg_marketing_messages_guard()
returns trigger language plpgsql set search_path to 'public' as $function$
begin
    if current_user in ('authenticated', 'anon') and not is_app_admin() then
        if tg_op = 'INSERT' then
            new.created_by := auth.uid();
            new.sent_at := null; new.sending_started_at := null; new.send_result := null;
            if (select count(*) from marketing_messages
                 where school_id = new.school_id and created_at > now() - interval '1 day') >= 3 then
                raise exception 'SCHOOL_DAILY_LIMIT';
            end if;
        else
            new.created_by := old.created_by; new.origin := old.origin; new.school_id := old.school_id;
            new.sent_at := old.sent_at; new.sending_started_at := old.sending_started_at;
            new.send_result := old.send_result;
        end if;
        if char_length(coalesce(new.subject, '')) > 150 or char_length(coalesce(new.body_html, '')) > 4000 then
            raise exception 'MESSAGE_TOO_LONG';
        end if;
    end if;
    return new;
end $function$;

drop trigger if exists trg_marketing_messages_guard on marketing_messages;
create trigger trg_marketing_messages_guard before insert or update on marketing_messages
    for each row execute function trg_marketing_messages_guard();
revoke all on function trg_marketing_messages_guard() from public, anon, authenticated;

-- ─────────────── ٤) سياسات إدارة المدرسة (بجانب سياسة المالك القائمة) ───────────────
drop policy if exists mm_school_read on marketing_messages;
create policy mm_school_read on marketing_messages for select to authenticated
    using (origin = 'school' and school_id is not null and is_school_admin(school_id));

drop policy if exists mm_school_insert on marketing_messages;
create policy mm_school_insert on marketing_messages for insert to authenticated
    with check (origin = 'school' and audience = 'school' and body_format = 'text'
                and school_id is not null and is_school_admin(school_id) and google_verified()
                and send_mode = 'broadcast');

-- تعديل وحذف ما لم يبدأ إرساله فقط
drop policy if exists mm_school_update on marketing_messages;
create policy mm_school_update on marketing_messages for update to authenticated
    using (origin = 'school' and is_school_admin(school_id) and sent_at is null and sending_started_at is null)
    with check (origin = 'school' and audience = 'school' and body_format = 'text'
                and is_school_admin(school_id) and google_verified() and send_mode = 'broadcast');

drop policy if exists mm_school_delete on marketing_messages;
create policy mm_school_delete on marketing_messages for delete to authenticated
    using (origin = 'school' and is_school_admin(school_id) and sent_at is null and sending_started_at is null);

-- سجل الإرسال: إدارة المدرسة ترى سجل رسائل مدرستها فقط
drop policy if exists campaign_log_school_read on email_campaign_log;
create policy campaign_log_school_read on email_campaign_log for select to authenticated
    using (exists (select 1 from marketing_messages m
                    where m.id = email_campaign_log.message_id and m.origin = 'school'
                      and is_school_admin(m.school_id)));

revoke all on marketing_messages, email_campaign_log from anon;

-- ─────────────── ٥) من يستلم — القاعدة كلها في مكان واحد ───────────────
create or replace function campaign_pool(p_audience text, p_school uuid, p_origin text,
                                         p_mode text default 'broadcast', p_days int default 5)
returns table(uid uuid, email text, name text)
language sql stable security definer set search_path to 'public', 'auth' as $function$
    with school_pool as (
        select sm.uid, coalesce(nullif(sm.full_name, ''), ud.username) as name, ud.updated_at
          from school_members sm
          left join user_data ud on ud.id = sm.uid
         where p_audience in ('school', 'all')
           and sm.active and sm.role = 'student' and sm.uid is not null
           and (p_school is null or sm.school_id = p_school)
           and (p_origin = 'school' or coalesce(ud.marketing_consent, false))
           and not exists (select 1 from notify_optouts o where o.uid = sm.uid
                            and o.scope = case when p_origin = 'school' then 'school' else 'khuta' end)
    ),
    khuta_pool as (
        select ud.id as uid, ud.username as name, ud.updated_at
          from user_data ud
         where p_audience in ('khuta', 'all') and p_origin = 'owner'
           and coalesce(ud.marketing_consent, false)
           and not exists (select 1 from school_members sm where sm.uid = ud.id and sm.active)
           and not exists (select 1 from notify_optouts o where o.uid = ud.id and o.scope = 'khuta')
    ),
    pool as (
        select * from school_pool union all select * from khuta_pool
    )
    select distinct on (u.id) u.id, u.email::text, p.name
      from pool p
      join auth.users u on u.id = p.uid
     where u.email is not null and u.email <> ''
       and u.email !~* '^khuta\..*@gmail\.com$'
       and coalesce(u.is_anonymous, false) = false
       and (p_mode <> 'behavior'
            or (p.updated_at is not null and p.updated_at <= now() - make_interval(days => coalesce(p_days, 5))))
     order by u.id;
$function$;

-- مستلمو رسالة محفوظة — للخادم وحده (service_role)
create or replace function campaign_recipients(p_message bigint)
returns table(uid uuid, email text, name text)
language sql stable security definer set search_path to 'public' as $function$
    select r.* from marketing_messages m,
           campaign_pool(m.audience, m.school_id, m.origin, m.send_mode, m.inactive_days) r
     where m.id = p_message;
$function$;

revoke all on function campaign_pool(text, uuid, text, text, int) from public, anon, authenticated;
revoke all on function campaign_recipients(bigint) from public, anon, authenticated;
grant execute on function campaign_recipients(bigint) to service_role;

-- ─────────────── ٦) أرقام الوصول قبل الإرسال ───────────────
-- المالك: كل الفئات وكل مدرسة. إدارة المدرسة: مدرستها فقط.
create or replace function campaign_audience_counts(p_school uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $function$
begin
    if is_app_admin() then
        return jsonb_build_object(
            'role', 'owner',
            'khuta', (select count(*) from campaign_pool('khuta', null, 'owner')),
            'school', (select count(*) from campaign_pool('school', null, 'owner')),
            'all', (select count(*) from campaign_pool('all', null, 'owner')),
            'schools', coalesce((select jsonb_agg(jsonb_build_object(
                    'id', s.id, 'name', s.name_ar,
                    'students', (select count(*) from school_members sm
                                  where sm.school_id = s.id and sm.active and sm.role = 'student'),
                    'reach_owner', (select count(*) from campaign_pool('school', s.id, 'owner')),
                    'reach_school', (select count(*) from campaign_pool('school', s.id, 'school')))
                    order by s.name_ar) from schools s), '[]'::jsonb));
    end if;
    if p_school is not null and is_school_admin(p_school) then
        return jsonb_build_object(
            'role', 'school',
            'students', (select count(*) from school_members sm
                          where sm.school_id = p_school and sm.active and sm.role = 'student'),
            'reach', (select count(*) from campaign_pool('school', p_school, 'school')));
    end if;
    raise exception 'NOT_ALLOWED';
end $function$;

-- ─────────────── ٧) المالك يدير وصول الرسائل لكل طالب ───────────────
create or replace function notify_people(p_query text default '')
returns table(uid uuid, name text, email text, grp text, consent boolean,
              stop_school text, stop_khuta text)
language plpgsql stable security definer set search_path to 'public', 'auth' as $function$
declare q text := '%' || coalesce(nullif(trim(p_query), ''), '') || '%';
begin
    if not is_app_admin() then raise exception 'NOT_ALLOWED'; end if;
    return query
    select u.id,
           coalesce(nullif(sm.full_name, ''), ud.username, '')::text,
           u.email::text,
           coalesce(s.name_ar, 'خُطى')::text,
           coalesce(ud.marketing_consent, false),
           (select o.source from notify_optouts o where o.uid = u.id and o.scope = 'school'),
           (select o.source from notify_optouts o where o.uid = u.id and o.scope = 'khuta')
      from auth.users u
      left join user_data ud on ud.id = u.id
      left join lateral (select * from school_members x where x.uid = u.id and x.active
                          order by x.created_at limit 1) sm on true
      left join schools s on s.id = sm.school_id
     where coalesce(u.is_anonymous, false) = false
       and u.email is not null and u.email !~* '^khuta\..*@gmail\.com$'
       and (coalesce(sm.role::text, 'student') = 'student')
       and (u.email ilike q or ud.username ilike q or sm.full_name ilike q or s.name_ar ilike q)
     order by s.name_ar nulls first, 2
     limit 60;
end $function$;

create or replace function set_notify_optout(p_uid uuid, p_scope text, p_stop boolean)
returns text language plpgsql security definer set search_path to 'public' as $function$
declare v_src text;
begin
    if not is_app_admin() then raise exception 'NOT_ALLOWED'; end if;
    if p_scope not in ('school', 'khuta') then raise exception 'BAD_SCOPE'; end if;
    select source into v_src from notify_optouts where uid = p_uid and scope = p_scope;
    if p_stop then
        if v_src is null then
            insert into notify_optouts (uid, scope, source) values (p_uid, p_scope, 'owner');
        end if;
        return 'stopped';
    end if;
    if v_src = 'self' then return 'self_optout'; end if;   -- قرار الطالب نفسه لا يُلغى من فوقه
    delete from notify_optouts where uid = p_uid and scope = p_scope and source = 'owner';
    return 'resumed';
end $function$;

revoke all on function campaign_audience_counts(uuid), notify_people(text), set_notify_optout(uuid, text, boolean)
    from public, anon;
grant execute on function campaign_audience_counts(uuid), notify_people(text), set_notify_optout(uuid, text, boolean)
    to authenticated;
