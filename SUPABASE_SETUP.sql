-- ============================================================
-- خُطى — إعداد قاعدة البيانات على Supabase (مرة واحدة فقط)
-- ============================================================
-- كيف تُشغّل هذا الملف:
-- 1) ادخل إلى لوحة مشروعك على supabase.com
-- 2) من القائمة الجانبية اختر "SQL Editor"
-- 3) اضغط "New query"، الصق كل محتوى هذا الملف، ثم اضغط "Run"
-- 4) بعدها اذهب إلى Authentication → Providers → فعّل "Anonymous Sign-ins"
--    (ضروري لعمل لوحة الصدارة وغرفة المذاكرة والحائط حتى بدون تسجيل دخول)
-- ============================================================

-- ---------- 0) جدول الجامعات — عدّله بسهولة من "Table Editor" في Supabase
--    (واجهة أشبه بإكسل/Google Sheets، بدون أي كود أو GitHub) ----------
create table if not exists public.universities (
  id text primary key,
  name text not null,
  name_en text not null,
  city text not null,
  city_en text,
  type text not null default 'public',
  weight_high integer,
  weight_qat integer,
  weight_tah integer,
  weight_step integer,
  step text not null default 'partial', -- اكتب هنا: true أو false أو partial
  step_min integer,
  comp integer not null default 3,      -- من 1 إلى 5: مستوى التنافسية
  note text,
  note_en text,
  sort_order integer not null default 0
);

-- يضيف العمود إن كان الجدول موجوداً من قبل بدونه (تشغيل آمن دائماً)
alter table public.universities add column if not exists city_en text;

alter table public.universities enable row level security;

drop policy if exists "Anyone can read universities" on public.universities;
create policy "Anyone can read universities" on public.universities
  for select using (true);

-- ---------- 1) جدول تقدم كل حساب (خاص، لا يراه إلا صاحبه) ----------
create table if not exists public.user_data (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "Users can view own data" on public.user_data;
create policy "Users can view own data" on public.user_data
  for select using (auth.uid() = id);

drop policy if exists "Users can insert own data" on public.user_data;
create policy "Users can insert own data" on public.user_data
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own data" on public.user_data;
create policy "Users can update own data" on public.user_data
  for update using (auth.uid() = id);

-- ---------- 2) لوحة الصدارة (عامة، اختيارية للطالب) ----------
create table if not exists public.leaderboard (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text not null,
  xp integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

drop policy if exists "Anyone can read leaderboard" on public.leaderboard;
create policy "Anyone can read leaderboard" on public.leaderboard
  for select using (true);

drop policy if exists "Users can upsert own leaderboard row" on public.leaderboard;
create policy "Users can upsert own leaderboard row" on public.leaderboard
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own leaderboard row" on public.leaderboard;
create policy "Users can update own leaderboard row" on public.leaderboard
  for update using (auth.uid() = id);

drop policy if exists "Users can delete own leaderboard row" on public.leaderboard;
create policy "Users can delete own leaderboard row" on public.leaderboard
  for delete using (auth.uid() = id);

-- ---------- 3) غرفة المذاكرة (عدّاد حضور حي) ----------
create table if not exists public.study_presence (
  id uuid references auth.users(id) on delete cascade primary key,
  last_seen timestamptz not null default now()
);

alter table public.study_presence enable row level security;

drop policy if exists "Anyone can read presence" on public.study_presence;
create policy "Anyone can read presence" on public.study_presence
  for select using (true);

drop policy if exists "Users can upsert own presence" on public.study_presence;
create policy "Users can upsert own presence" on public.study_presence
  for insert with check (auth.uid() = id);

drop policy if exists "Users can update own presence" on public.study_presence;
create policy "Users can update own presence" on public.study_presence
  for update using (auth.uid() = id);

-- ---------- 0.5) حسابات المطوّرين/المشرفين — أضف/احذف صفوفاً هنا من Table Editor لمنح صلاحيات إضافية ----------
create table if not exists public.app_admins (
  uid uuid primary key,
  name text,
  added_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;

-- القراءة مقيَّدة: كل حساب يستطيع التحقق من صلاحيته هو فقط (وهذا كل ما يحتاجه
-- التطبيق فعلياً)، وليس رؤية قائمة كل المشرفين وأسمائهم ومعرّفاتهم — تصلّب أمني
-- بسيط لا يقلّل من أي وظيفة، لأن الموقع لا يستعلم إلا عن الحساب الحالي فقط.
drop policy if exists "Anyone can check admin status" on public.app_admins;
create policy "Users can check their own admin status" on public.app_admins
  for select using (auth.uid() = uid);

-- لا نزرع UID افتراضياً هنا (سبق أن أخطأنا في تخمينه من لقطة شاشة) — أضف
-- حسابك بنفسك من Table Editor: افتح جدول app_admins → Insert row → الصق
-- UID حسابك من Authentication → Users (عمود UID) → احفظ.

-- ---------- 4) حائط الأسئلة السريعة (منتدى مصغّر) ----------
create table if not exists public.forum_posts (
  id bigint generated always as identity primary key,
  author_name text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table public.forum_posts enable row level security;

drop policy if exists "Anyone can read forum posts" on public.forum_posts;
create policy "Anyone can read forum posts" on public.forum_posts
  for select using (true);

drop policy if exists "Signed-in (even anonymous) can post" on public.forum_posts;
create policy "Signed-in (even anonymous) can post" on public.forum_posts
  for insert with check (auth.uid() is not null);

-- فقط حساب المطوّر (المُسجَّل عبر Google) يستطيع حذف أي رسالة من الحائط —
-- إن غيّرت حسابك، بدّل المعرّف هنا وفي DEV_USER_ID داخل app.js معاً.
drop policy if exists "Only the developer can delete forum posts" on public.forum_posts;
drop policy if exists "Admins can delete forum posts" on public.forum_posts;
create policy "Admins can delete forum posts" on public.forum_posts
  for delete using (exists (select 1 from public.app_admins where uid = auth.uid()));

-- ---------- تعبئة الجامعات الأولية (يمكنك تعديل أي قيمة لاحقاً من Table Editor) ----------
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('ksu', 'جامعة الملك سعود', 'King Saud University', 'الرياض', 'Riyadh', 'public', 30, 30, 40, NULL, 'partial', NULL, 5, 'الوزن العام لأغلب الكليات العلمية. بعض الكليات (كالطب والهندسة وبرامج اللغة الإنجليزية) قد تشترط درجة معينة في STEP أو IELTS/TOEFL، وتضيف كليات كالطب مقابلة شخصية.', 'General weighting for most scientific colleges. Some colleges (Medicine, Engineering, English-taught programs) may require a STEP/IELTS/TOEFL score, and Medicine typically adds a personal interview.', 0) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('kau', 'جامعة الملك عبدالعزيز', 'King Abdulaziz University', 'جدة', 'Jeddah', 'public', 30, 30, 30, 10, 'true', 60, 4, '⚡ حدّثت الجامعة رسمياً معايير القبول اعتباراً من العام الجامعي 1448-1449هـ لتصبح: 30% ثانوية + 30% قدرات + 30% تحصيلي + 10% STEP، لبرامج البكالوريوس انتظام والسنة التأهيلية والدبلوم الصباحي. راجع الموقع الرسمي لتأكيد سريان هذا القرار على دفعتك.', 'The university officially updated its admission formula starting the 1448-1449H academic year to: 30% high-school + 30% Qudrat + 30% Tahsili + 10% STEP, for regular bachelor''s, foundation-year and morning diploma programs. Verify on the official site that this applies to your intake.', 1) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('kfupm', 'جامعة الملك فهد للبترول والمعادن', 'King Fahd University of Petroleum & Minerals', 'الظهران', 'Dhahran', 'public', 10, 50, 40, NULL, 'true', 55, 5, 'يُشترط اجتياز اختبار STEP (أو ما يعادله من IELTS/TOEFL/Duolingo) كشرط أساسي للتقديم بغض النظر عن الموزونة. مسار القبول الأساسي يعتمد غالباً على القدرات والتحصيلي فقط (50%/50%) دون الثانوية.', 'STEP (or equivalent IELTS/TOEFL/Duolingo) is a mandatory admission gate regardless of the weighted score. The basic admission track often uses Qudrat/Tahsili only (50%/50%).', 2) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('imamu', 'جامعة الإمام محمد بن سعود الإسلامية', 'Imam Mohammad Ibn Saud Islamic University', 'الرياض', 'Riyadh', 'public', 30, 30, 40, NULL, 'partial', NULL, 4, 'الوزن العام لمعظم الكليات. مسار اللغات والترجمة يشترط تقريباً 55 درجة في STEP وفق مصادر تعليمية (يُنصح بالتأكيد من الجامعة).', 'General weighting for most colleges. The Languages & Translation track reportedly requires around 55 in STEP per education sources (verify with the university).', 3) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('uqu', 'جامعة أم القرى', 'Umm Al-Qura University', 'مكة المكرمة', 'Mecca', 'public', 30, 30, 40, NULL, 'partial', NULL, 4, '✅ مؤكد من الموقع الرسمي للجامعة: يُشترط اجتياز STEP بدرجة 60 فأعلى للقبول في التخصصات الطبية تحديداً؛ باقي الكليات لا تشترطه عادة.', '✅ Confirmed on the official university site: STEP score of 60+ is required specifically for medical-college admission; other colleges generally don''t require it.', 4) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('kku', 'جامعة الملك خالد', 'King Khalid University', 'أبها', 'Abha', 'public', 30, 30, 40, NULL, 'true', NULL, 3, 'تشترط الجامعة اجتياز اختبار تحديد مستوى اللغة الإنجليزية ضمن شروط القبول (STEP أو ما يعادله)، ويُلغى ترشيح من لا يحضره — مذكور في دليل القبول الرسمي ومركز STEP التابع للجامعة (KKUx).', 'The university requires an English proficiency test (STEP or equivalent) as an admission condition — noted in the official admission guide and the university''s own STEP training center (KKUx).', 5) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('qu', 'جامعة القصيم', 'Qassim University', 'بريدة', 'Buraidah', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. بعض الكليات الصحية والهندسية قد تضيف شرط STEP.', 'General weighting. Some health/engineering colleges may add a STEP requirement.', 6) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('pnu', 'جامعة الأميرة نورة بنت عبدالرحمن', 'Princess Nourah bint Abdulrahman University', 'الرياض', 'Riyadh', 'public', 30, 30, 40, NULL, 'partial', NULL, 4, 'جامعة نسائية بالكامل. كلية اللغات تشترط وفق مصادر تعليمية حوالي 83 درجة في STEP؛ التخصصات الأخرى غالباً لا تشترطه.', 'Women-only university. The College of Languages reportedly requires around 83 in STEP per education sources; other majors generally don''t require it.', 7) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('kfu', 'جامعة الملك فيصل', 'King Faisal University', 'الأحساء', 'Al-Ahsa', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية والإنجليزية غالباً تضيف شرط لغة.', 'General weighting. Health and English-taught colleges often add a language requirement.', 8) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('ksauhs', 'جامعة الملك سعود بن عبدالعزيز للعلوم الصحية', 'King Saud bin Abdulaziz University for Health Sciences', 'الرياض / جدة / الأحساء', 'Riyadh / Jeddah / Al-Ahsa', 'public', 30, 30, 40, NULL, 'partial', NULL, 5, '✅ مؤكد من الموقع الرسمي للجامعة (ksau-hs.edu.sa): 30% ثانوية + 30% قدرات + 40% تحصيلي. جامعة صحية متخصصة (طب، تمريض، علوم صحية) بالكامل تقريباً باللغة الإنجليزية، وتُضاف مقابلة شخصية للبرامج التي تتطلب ذلك، وقد تُطلب درجة لغة إنجليزية لبعض البرامج.', '✅ Confirmed on the official university site (ksau-hs.edu.sa): 30% high-school + 30% Qudrat + 40% Tahsili. A specialized health-sciences university taught almost entirely in English; a personal interview is added for programs that require it, and some programs may require an English score.', 9) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('taibah', 'جامعة طيبة', 'Taibah University', 'المدينة المنورة', 'Madinah', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 10) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('iumadinah', 'الجامعة الإسلامية بالمدينة المنورة', 'Islamic University of Madinah', 'المدينة المنورة', 'Madinah', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'بعض الكليات الشرعية قد تتطلب اختباراً في التلاوة والحفظ أو مقابلة إضافية بدل STEP.', 'Some Sharia colleges may require a Quran recitation/memorization test or an interview instead of STEP.', 11) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('jazanu', 'جامعة جازان', 'Jazan University', 'جازان', 'Jazan', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 12) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('najranu', 'جامعة نجران', 'Najran University', 'نجران', 'Najran', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 13) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('tabuku', 'جامعة تبوك', 'University of Tabuk', 'تبوك', 'Tabuk', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 14) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('hailu', 'جامعة حائل', 'University of Hail', 'حائل', 'Hail', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 15) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('bau', 'جامعة الباحة', 'Al Baha University', 'الباحة', 'Al Baha', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 16) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('nbu', 'جامعة الحدود الشمالية', 'Northern Border University', 'عرعر', 'Arar', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 17) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('su', 'جامعة شقراء', 'Shaqra University', 'شقراء', 'Shaqra', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 18) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('mu', 'جامعة المجمعة', 'Majmaah University', 'المجمعة', 'Majmaah', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 19) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('iau', 'جامعة الإمام عبدالرحمن بن فيصل', 'Imam Abdulrahman Bin Faisal University', 'الدمام', 'Dammam', 'public', 30, 30, 40, NULL, 'partial', NULL, 4, 'تضم كليات صحية (كالطب) قد تعتمد أوزاناً مختلفة وتشترط STEP وتضيف مقابلة شخصية.', 'Includes health colleges (e.g. Medicine) that may use different weights, require STEP, and add an interview.', 20) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('tu', 'جامعة الطائف', 'Taif University', 'الطائف', 'Taif', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. قسم اللغة الإنجليزية يشترط وفق مصادر تعليمية حوالي 40 درجة في STEP.', 'General weighting. The English department reportedly requires around 40 in STEP per education sources.', 21) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('ju', 'جامعة الجوف', 'Jouf University', 'سكاكا', 'Sakaka', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 22) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('bu', 'جامعة بيشة', 'University of Bisha', 'بيشة', 'Bisha', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'الوزن العام. الكليات الصحية قد تضيف شرط لغة.', 'General weighting. Health colleges may add a language requirement.', 23) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('psau', 'جامعة الأمير سطام بن عبدالعزيز', 'Prince Sattam Bin Abdulaziz University', 'الخرج', 'Al-Kharj', 'public', 30, 30, 40, NULL, 'partial', NULL, 3, 'الوزن العام. كلية الطب تشترط وفق مصادر تعليمية حوالي 70 درجة في STEP، وطب الأسنان حوالي 65.', 'General weighting. The College of Medicine reportedly requires around 70 in STEP, and Dentistry around 65, per education sources.', 24) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('uj', 'جامعة جدة', 'University of Jeddah', 'جدة', 'Jeddah', 'public', 30, 30, 40, NULL, 'partial', NULL, 4, 'الوزن العام. الكليات الصحية والهندسية قد تضيف شرط لغة.', 'General weighting. Health/engineering colleges may add a language requirement.', 25) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('pmu_madinah', 'جامعة الأمير مقرن بن عبدالعزيز', 'Prince Mugrin University', 'المدينة المنورة', 'Madinah', 'public', 30, 30, 40, NULL, 'partial', NULL, 2, 'جامعة حديثة نسبياً — الوزن العام المعتاد.', 'Relatively new public university — standard general weighting.', 26) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('alfaisal', 'جامعة الفيصل', 'Alfaisal University', 'الرياض', 'Riyadh', 'private', NULL, NULL, NULL, NULL, 'true', NULL, 4, 'جامعة خاصة بنظام قبول مستقل (SAT/STEP + مقابلة)، الدراسة باللغة الإنجليزية بالكامل غالباً. لا تنطبق صيغة الموزونة الموحدة مباشرة.', 'Private university with an independent admission system (SAT/STEP + interview), mostly English-taught. The unified weighted formula does not directly apply.', 27) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('effat', 'جامعة أفق (عفت)', 'Effat University', 'جدة', 'Jeddah', 'private', NULL, NULL, NULL, NULL, 'true', NULL, 3, 'جامعة خاصة للطالبات، تتطلب عادة اختبار لغة إنجليزية ومقابلة ضمن نظام قبول مستقل.', 'Private women''s university, typically requires an English test and interview under its own admission system.', 28) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('psu_riyadh', 'جامعة الأمير سلطان', 'Prince Sultan University', 'الرياض', 'Riyadh', 'private', NULL, NULL, NULL, NULL, 'true', NULL, 3, 'جامعة خاصة بنظام قبول مستقل يعتمد اختبار قبول داخلي ومقابلة.', 'Private university with its own entrance exam and interview.', 29) on conflict (id) do nothing;
insert into public.universities (id, name, name_en, city, city_en, type, weight_high, weight_qat, weight_tah, weight_step, step, step_min, comp, note, note_en, sort_order) values ('dau', 'جامعة دار العلوم', 'Dar Al Uloom University', 'الرياض', 'Riyadh', 'private', NULL, NULL, NULL, NULL, 'partial', NULL, 2, 'جامعة خاصة بنظام قبول مستقل، يُفضل مراجعة الموقع الرسمي للتفاصيل.', 'Private university with its own admission system — check the official website for details.', 30) on conflict (id) do nothing;

-- ---------- تحديث city_en لمن كان قد شغّل نسخة سابقة من هذا الملف قبل إضافة هذا العمود ----------
update public.universities set city_en = 'Riyadh' where id = 'ksu' and city_en is null;
update public.universities set city_en = 'Jeddah' where id = 'kau' and city_en is null;
update public.universities set city_en = 'Dhahran' where id = 'kfupm' and city_en is null;
update public.universities set city_en = 'Riyadh' where id = 'imamu' and city_en is null;
update public.universities set city_en = 'Mecca' where id = 'uqu' and city_en is null;
update public.universities set city_en = 'Abha' where id = 'kku' and city_en is null;
update public.universities set city_en = 'Buraidah' where id = 'qu' and city_en is null;
update public.universities set city_en = 'Riyadh' where id = 'pnu' and city_en is null;
update public.universities set city_en = 'Al-Ahsa' where id = 'kfu' and city_en is null;
update public.universities set city_en = 'Riyadh / Jeddah / Al-Ahsa' where id = 'ksauhs' and city_en is null;
update public.universities set city_en = 'Madinah' where id = 'taibah' and city_en is null;
update public.universities set city_en = 'Madinah' where id = 'iumadinah' and city_en is null;
update public.universities set city_en = 'Jazan' where id = 'jazanu' and city_en is null;
update public.universities set city_en = 'Najran' where id = 'najranu' and city_en is null;
update public.universities set city_en = 'Tabuk' where id = 'tabuku' and city_en is null;
update public.universities set city_en = 'Hail' where id = 'hailu' and city_en is null;
update public.universities set city_en = 'Al Baha' where id = 'bau' and city_en is null;
update public.universities set city_en = 'Arar' where id = 'nbu' and city_en is null;
update public.universities set city_en = 'Shaqra' where id = 'su' and city_en is null;
update public.universities set city_en = 'Majmaah' where id = 'mu' and city_en is null;
update public.universities set city_en = 'Dammam' where id = 'iau' and city_en is null;
update public.universities set city_en = 'Taif' where id = 'tu' and city_en is null;
update public.universities set city_en = 'Sakaka' where id = 'ju' and city_en is null;
update public.universities set city_en = 'Bisha' where id = 'bu' and city_en is null;
update public.universities set city_en = 'Al-Kharj' where id = 'psau' and city_en is null;
update public.universities set city_en = 'Jeddah' where id = 'uj' and city_en is null;
update public.universities set city_en = 'Madinah' where id = 'pmu_madinah' and city_en is null;
update public.universities set city_en = 'Riyadh' where id = 'alfaisal' and city_en is null;
update public.universities set city_en = 'Jeddah' where id = 'effat' and city_en is null;
update public.universities set city_en = 'Riyadh' where id = 'psu_riyadh' and city_en is null;
update public.universities set city_en = 'Riyadh' where id = 'dau' and city_en is null;

-- ---------- 5) قوالب الخطط المشتركة من الطلاب ----------
create table if not exists public.plan_templates (
  id bigint generated always as identity primary key,
  author_id uuid references auth.users(id) on delete cascade,
  author_name text not null,
  title text not null,
  description text,
  config jsonb not null,
  plan_days integer,
  session_minutes integer,
  sources_summary text,
  created_at timestamptz not null default now()
);

alter table public.plan_templates add column if not exists session_minutes integer;
alter table public.plan_templates add column if not exists sources_summary text;

alter table public.plan_templates enable row level security;

drop policy if exists "Anyone can read templates" on public.plan_templates;
create policy "Anyone can read templates" on public.plan_templates
  for select using (true);

drop policy if exists "Signed-in can publish templates" on public.plan_templates;
create policy "Signed-in can publish templates" on public.plan_templates
  for insert with check (auth.uid() = author_id);

drop policy if exists "Authors can delete own templates" on public.plan_templates;
create policy "Authors can delete own templates" on public.plan_templates
  for delete using (auth.uid() = author_id);

drop policy if exists "Admins can delete any template" on public.plan_templates;
create policy "Admins can delete any template" on public.plan_templates
  for delete using (exists (select 1 from public.app_admins where uid = auth.uid()));

-- ---------- 7) المدرّسون الخصوصيون (قسم جديد خلف علم تفعيل FEATURE_TUTORS_DIRECTORY) ----------
create table if not exists public.tutors (
  id bigint generated always as identity primary key,
  name text not null,
  phone text,
  location text,
  mode text default 'online', -- 'online' أو 'in_person'
  notes text,
  created_at timestamptz not null default now()
);

alter table public.tutors enable row level security;

drop policy if exists "Anyone can view tutors" on public.tutors;
create policy "Anyone can view tutors" on public.tutors
  for select using (true);

drop policy if exists "Admins can add tutors" on public.tutors;
create policy "Admins can add tutors" on public.tutors
  for insert with check (exists (select 1 from public.app_admins where uid = auth.uid()));

drop policy if exists "Admins can delete tutors" on public.tutors;
create policy "Admins can delete tutors" on public.tutors
  for delete using (exists (select 1 from public.app_admins where uid = auth.uid()));

drop policy if exists "Admins can update tutors" on public.tutors;
create policy "Admins can update tutors" on public.tutors
  for update using (exists (select 1 from public.app_admins where uid = auth.uid()));

-- ---------- 6) تقييمات القوالب (إعجاب/عدم إعجاب + تعليق) ----------
create table if not exists public.template_ratings (
  id bigint generated always as identity primary key,
  template_id bigint references public.plan_templates(id) on delete cascade,
  rater_id uuid references auth.users(id) on delete cascade,
  vote text not null,
  comment text,
  created_at timestamptz not null default now(),
  unique(template_id, rater_id)
);

alter table public.template_ratings enable row level security;

drop policy if exists "Anyone can read ratings" on public.template_ratings;
create policy "Anyone can read ratings" on public.template_ratings
  for select using (true);

drop policy if exists "Signed-in can rate" on public.template_ratings;
create policy "Signed-in can rate" on public.template_ratings
  for insert with check (auth.uid() = rater_id);

drop policy if exists "Users can update own rating" on public.template_ratings;
create policy "Users can update own rating" on public.template_ratings
  for update using (auth.uid() = rater_id);

-- ---------- 7) تقارير المصادر المخصصة (بدل/بجانب الإيميل — راجعها من Table Editor) ----------
create table if not exists public.custom_source_reports (
  id bigint generated always as identity primary key,
  kind text not null,
  source_name text not null,
  origin text,
  unit text,
  total integer,
  qper text,
  reporter_name text,
  created_at timestamptz not null default now()
);

alter table public.custom_source_reports enable row level security;

drop policy if exists "Anyone can submit a source report" on public.custom_source_reports;
create policy "Anyone can submit a source report" on public.custom_source_reports
  for insert with check (true);

-- ============================================================
-- انتهى. لا حاجة لأي إعداد آخر — التطبيق سيتعامل مع كل شيء تلقائياً.
-- ============================================================
