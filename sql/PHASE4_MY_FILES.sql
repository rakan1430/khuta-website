-- ============================================================
--  المرحلة ٤ — «ملفاتي» لطلاب خُطى (٢٤ سبتمبر ٢٠٢٦)
--  ------------------------------------------------------------
--  قرارات المالك:
--  • ٣٠ ميجا للطالب، **لا تُتجاوز**.
--  • لحسابات Google فقط (معتمد نهائياً).
--  • PDF وصور فقط. **لا روابط مشاركة إطلاقاً** — لا يراه إلا صاحبه.
--  • خانة «ملفات من خُطى» يرفعها المالك بعد فحصها (بلا شعارات لأحد).
--
--  ⚠️ كل قيد هنا في القاعدة/المخزن نفسه لا في الواجهة: من يتجاوز الواجهة
--  بطلبٍ يدوي يصطدم بالسياسة ذاتها.
-- ============================================================

-- حساب Google حقيقي: لا مجهول، ولا حساب «اسم مستخدم وكلمة مرور»
create or replace function is_google_account()
returns boolean language sql stable set search_path = public as $$
    select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
       and (coalesce(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::jsonb) ? 'google'
            or auth.jwt() -> 'app_metadata' ->> 'provider' = 'google');
$$;
grant execute on function is_google_account() to authenticated;
revoke all on function is_google_account() from anon;

-- ─────────── ١) المخزن الخاص ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('my-files', 'my-files', false, 10485760,
        array['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

create or replace function my_files_used(p_uid uuid)
returns bigint language sql stable security definer set search_path = public, storage as $$
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0)::bigint
      from storage.objects o
     where o.bucket_id = 'my-files' and split_part(o.name, '/', 1) = p_uid::text;
$$;
revoke all on function my_files_used(uuid) from public, anon, authenticated;

-- ٣٠ ميجا بالضبط: المستعمل + الملف الجديد. ومخزن Supabase يعيد فحص سياسة
-- الإدراج عند اكتمال الرفع ومعه حجم الملف (metadata.size) — فهناك يُحسم.
-- و٢٠٠ ملف كحدّ للعدد.
create or replace function my_files_has_room(p_incoming bigint)
returns boolean language sql stable security definer set search_path = public, storage as $$
    select auth.uid() is not null
       and my_files_used(auth.uid()) + greatest(coalesce(p_incoming, 0), 0) <= 31457280
       and (select count(*) from storage.objects o
             where o.bucket_id = 'my-files' and split_part(o.name, '/', 1) = auth.uid()::text) < 200;
$$;
revoke all on function my_files_has_room(bigint) from public, anon;
grant execute on function my_files_has_room(bigint) to authenticated;

drop policy if exists my_files_insert on storage.objects;
create policy my_files_insert on storage.objects for insert to authenticated with check (
    bucket_id = 'my-files'
    and split_part(name, '/', 1) = auth.uid()::text
    and is_google_account()
    and my_files_has_room(coalesce((metadata ->> 'size')::bigint, 0)));
-- صاحبه وحده يقرأ ويحذف. لا سياسة تحديث: لا استبدال لملف قائم.
drop policy if exists my_files_select on storage.objects;
create policy my_files_select on storage.objects for select to authenticated using (
    bucket_id = 'my-files' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists my_files_delete on storage.objects;
create policy my_files_delete on storage.objects for delete to authenticated using (
    bucket_id = 'my-files' and split_part(name, '/', 1) = auth.uid()::text);

-- أسماء الملفات كما يراها صاحبها (مفتاح المخزن لا يقبل العربية والرموز)
create table if not exists my_files (
    path        text primary key,
    uid         uuid not null default auth.uid(),
    title       text not null check (length(trim(title)) between 1 and 120),
    created_at  timestamptz not null default now(),
    check (split_part(path, '/', 1) = uid::text)
);
alter table my_files enable row level security;
revoke all on my_files from anon;
grant select, insert, update, delete on my_files to authenticated;
drop policy if exists my_files_own on my_files;
create policy my_files_own on my_files for all to authenticated
    using (uid = auth.uid())
    with check (uid = auth.uid() and is_google_account());

-- قائمتي: من المخزن نفسه (الحجم الحقيقي) مع الاسم المعروض
create or replace function my_files_list()
returns table(path text, title text, size bigint, mime text, created_at timestamptz)
language sql stable security definer set search_path = public, storage as $$
    select o.name, coalesce(t.title, split_part(o.name, '/', 2)),
           (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype', o.created_at
      from storage.objects o left join my_files t on t.path = o.name
     where o.bucket_id = 'my-files' and auth.uid() is not null
       and split_part(o.name, '/', 1) = auth.uid()::text
     order by o.created_at desc;
$$;
revoke all on function my_files_list() from public, anon;
grant execute on function my_files_list() to authenticated;

create or replace function my_files_status()
returns jsonb language sql stable security definer set search_path = public, storage as $$
    select jsonb_build_object(
        'google', is_google_account(),
        'used', case when auth.uid() is null then 0 else my_files_used(auth.uid()) end,
        'limit', 31457280,
        'count', (select count(*) from storage.objects o
                   where o.bucket_id = 'my-files' and split_part(o.name, '/', 1) = auth.uid()::text));
$$;
revoke all on function my_files_status() from public, anon;
grant execute on function my_files_status() to authenticated;

-- ─────────── ٢) «ملفات من خُطى» — يرفعها المالك بعد فحصها ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('khuta-files', 'khuta-files', false, 20971520,
        array['application/pdf','image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                               allowed_mime_types = excluded.allowed_mime_types;

create table if not exists khuta_files (
    id          uuid primary key default gen_random_uuid(),
    path        text not null unique,
    title       text not null check (length(trim(title)) between 2 and 160),
    description text check (description is null or length(description) <= 400),
    created_by  uuid default auth.uid(),
    created_at  timestamptz not null default now()
);
alter table khuta_files enable row level security;
revoke all on khuta_files from anon;
grant select, insert, update, delete on khuta_files to authenticated;
drop policy if exists khuta_files_read on khuta_files;
create policy khuta_files_read on khuta_files for select to authenticated
    using (is_google_account() or is_app_admin());
drop policy if exists khuta_files_admin on khuta_files;
create policy khuta_files_admin on khuta_files for all to authenticated
    using (is_app_admin() and google_verified())
    with check (is_app_admin() and google_verified());

drop policy if exists khuta_files_obj_select on storage.objects;
create policy khuta_files_obj_select on storage.objects for select to authenticated using (
    bucket_id = 'khuta-files' and (is_google_account() or is_app_admin())
    and exists (select 1 from khuta_files k where k.path = objects.name));
drop policy if exists khuta_files_obj_insert on storage.objects;
create policy khuta_files_obj_insert on storage.objects for insert to authenticated with check (
    bucket_id = 'khuta-files' and is_app_admin() and google_verified());
drop policy if exists khuta_files_obj_delete on storage.objects;
create policy khuta_files_obj_delete on storage.objects for delete to authenticated using (
    bucket_id = 'khuta-files' and is_app_admin() and google_verified());
