-- ============================================================
-- المرحلة ٩ — اسم المنصة لكل مدرسة + إشعار تحديث الشروط (٢٦ سبتمبر)
-- ------------------------------------------------------------
-- طلبا المالك:
--  ١) «اسم منصة المتقدمة ليس ثابتاً على كل المدارس… وفّر خياراً لي لاحقاً
--     في تغييره أو تحديده لكل مدرسة».
--  ٢) «مع تعديل الشروط يجب أن تصل رسالة لكل مستخدمي خُطى… حتى غير المفعّل
--     استقبال الرسائل التذكيرية… بيدي أنا أرسلها من أدوات المشرف».
-- ⚠️ كلها إضافات: القاعدة مشتركة مع الموقع الأساسي، ولا شيء هنا يغيّر ما
--    يستعمله الآن (عمود جديد اختياري، ودوالّ جديدة، وفرع جديد في
--    campaign_pool لا يُطلب إلا بجمهور 'service' الجديد).
-- ============================================================

-- ─────────────── ١) اسم المنصة لكل مدرسة ───────────────
alter table schools add column if not exists platform_name_ar text;
alter table schools add column if not exists platform_name_en text;
do $$ begin
    alter table schools add constraint schools_platform_name_len
        check (char_length(coalesce(platform_name_ar, '')) <= 40 and char_length(coalesce(platform_name_en, '')) <= 40);
exception when duplicate_object then null; end $$;

create or replace function owner_set_platform_name(p_school uuid, p_name_ar text, p_name_en text)
returns void language plpgsql security definer set search_path = public as $$
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    if char_length(btrim(coalesce(p_name_ar, ''))) > 40 or char_length(btrim(coalesce(p_name_en, ''))) > 40 then
        raise exception 'BAD_PLATFORM_NAME';
    end if;
    update schools set
        platform_name_ar = nullif(btrim(coalesce(p_name_ar, '')), ''),
        platform_name_en = nullif(btrim(coalesce(p_name_en, '')), '')
     where id = p_school;
    if not found then raise exception 'NOT_FOUND'; end if;
end $$;
revoke all on function owner_set_platform_name(uuid, text, text) from public, anon;
grant execute on function owner_set_platform_name(uuid, text, text) to authenticated;

-- نفس الدالّة بمفتاحين زائدين (الموقع الأساسي يتجاهلهما)
create or replace function owner_list_schools()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    return coalesce((select jsonb_agg(jsonb_build_object(
        'id', s.id, 'slug', s.slug, 'name_ar', s.name_ar, 'name_en', s.name_en,
        'platform_name_ar', s.platform_name_ar, 'platform_name_en', s.platform_name_en,
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

-- ─────────────── ٢) إشعار تحديث الشروط ───────────────
-- (أ) داخل الموقع: آخر إشعار منشور يقرؤه كل زائر (ضيفاً كان أو مسجّلاً)
--     فيظهر له مرة واحدة — وهذا ما يصل من لا بريد حقيقياً له: الضيوف
--     وحسابات اسم المستخدم (بريدها مصطنع khuta.…@gmail.com)، وهم الأغلبية.
create table if not exists site_notices (
    id           bigserial primary key,
    kind         text not null check (kind in ('terms')),
    version      text not null check (char_length(version) between 1 and 20),
    summary_ar   text not null check (char_length(summary_ar) between 1 and 1500),
    published_at timestamptz not null default now(),
    published_by uuid
);
alter table site_notices enable row level security;
drop policy if exists site_notices_read on site_notices;
create policy site_notices_read on site_notices for select to anon, authenticated using (true);
-- لا كتابة مباشرة لأحد: النشر عبر owner_publish_terms_notice فقط
revoke insert, update, delete on site_notices from anon, authenticated;

-- (ب) بالبريد: جمهور 'service' — كل مستخدم له بريد حقيقي، بلا شرط موافقة
--     التذكيرات ولا إيقافها. رسالة خدمة (تغيّرت شروط الخدمة) لا رسالة
--     تسويق — ولهذا لا يملكها إلا المالك، ولا تُكتب إلا عبر دالّة النشر.
alter table marketing_messages drop constraint if exists mm_audience_chk;
alter table marketing_messages add constraint mm_audience_chk
    check (audience = any (array['all', 'khuta', 'school', 'service']));
alter table marketing_messages drop constraint if exists mm_service_owner_chk;
alter table marketing_messages add constraint mm_service_owner_chk
    check (audience <> 'service' or origin = 'owner');

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
    -- إشعار الخدمة: كل حساب — طالب خُطى، طالب مدرسة، معلّم، إدارة
    service_pool as (
        select u.id as uid,
               coalesce((select nullif(sm.full_name, '') from school_members sm where sm.uid = u.id and sm.active limit 1),
                        (select ud.username from user_data ud where ud.id = u.id)) as name,
               null::timestamptz as updated_at
          from auth.users u
         where p_audience = 'service' and p_origin = 'owner'
    ),
    pool as (
        select * from school_pool union all select * from khuta_pool union all select * from service_pool
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
revoke all on function campaign_pool(text, uuid, text, text, int) from public, anon, authenticated;

-- ينشر الإشعار داخل الموقع، ويجهّز رسالة البريد (لا يرسلها — الإرسال زرّ المالك)
create or replace function owner_publish_terms_notice(p_version text, p_summary_ar text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
    v_notice bigint; v_msg bigint; v_html text;
    v_sum text := btrim(coalesce(p_summary_ar, ''));
    v_ver text := btrim(coalesce(p_version, ''));
begin
    if not is_app_admin() then raise exception 'NOT_OWNER'; end if;
    if not google_verified() then raise exception 'NEEDS_GOOGLE'; end if;
    if char_length(v_ver) not between 1 and 20 or char_length(v_sum) not between 10 and 1500 then
        raise exception 'BAD_INPUT';
    end if;
    insert into site_notices(kind, version, summary_ar, published_by)
         values ('terms', v_ver, v_sum, auth.uid()) returning id into v_notice;
    -- النصّ مُهرَّب هنا: لا HTML من المتصفّح يصل البريد
    v_html := '<div style="font-family:Tahoma,Arial,sans-serif; direction:rtl; text-align:right; max-width:560px; margin:auto; padding:20px; color:#2b2b2b; line-height:1.9;">'
           || '<div style="font-size:12px; color:#8a6212; font-weight:700; margin-bottom:10px;">إشعار من خُطى</div>'
           || '<h2 style="font-size:18px; margin:0 0 10px;">حدّثنا شروط الاستخدام وسياسة الخصوصية</h2>'
           || '<div style="font-size:15px;">' || replace(replace(replace(replace(v_sum, '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), E'\n', '<br>') || '</div>'
           || '<p style="font-size:14px; margin-top:16px;">تقرأ النصّ الكامل من داخل خُطى: <b>الإعدادات ← الخصوصية والرسائل</b>.</p>'
           || '<p style="font-size:13px; color:#666;">رقم النسخة: ' || replace(replace(v_ver, '<', ''), '>', '') || '</p></div>';
    insert into marketing_messages(subject, body_html, audience, origin, body_format, created_by, active)
         values ('تحديث شروط الاستخدام وسياسة الخصوصية — خُطى', v_html, 'service', 'owner', 'html', auth.uid(), true)
      returning id into v_msg;
    return jsonb_build_object('notice_id', v_notice, 'message_id', v_msg,
        'reach', (select count(*) from campaign_pool('service', null, 'owner')));
end $$;
revoke all on function owner_publish_terms_notice(text, text) from public, anon;
grant execute on function owner_publish_terms_notice(text, text) to authenticated;
