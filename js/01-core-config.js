/* ============================================================
   خُطى — app.js
   ملاحظة للمطوّر: عدّل الاسم أدناه ليظهر في العلامة المائية أسفل الصفحة
   ============================================================ */
/* ============================================================
   الحساب السحابي (Supabase) — تسجيل دخول باسم مستخدم/كلمة مرور + مزامنة
   ------------------------------------------------------------
   إعداد لازم لمرة واحدة في لوحة Supabase (SQL Editor) — راجع ملف
   SUPABASE_SETUP.sql المرفق مع هذا التسليم، وفعّل أيضاً:
   Authentication → Providers → Anonymous Sign-ins (تفعيل) — يلزم لعمل
   ميزات المجتمع (لوحة الصدارة، غرفة المذاكرة، الحائط) حتى للزوار بدون حساب.
   ============================================================ */
/* تأتي من js/00-tenant.js حسب العنوان الذي فُتح منه الموقع: خُطى لها قاعدتها،
   وكل مدرسة لها قاعدتها المنفصلة تماماً. لا تكتب العناوين هنا مباشرة. */
const SUPABASE_URL = TENANT.supabaseUrl;
const SUPABASE_ANON_KEY = TENANT.supabaseKey;
const USERNAME_EMAIL_DOMAIN = "gmail.com"; // نُستخدم كنطاق بريد وهمي داخلي فقط (الطالب لن يراه ولا نرسل له بريداً حقيقياً أبداً).
// لماذا gmail.com تحديداً؟ Supabase يتحقق من أن نطاق البريد له سجلات DNS/MX حقيقية (وليس فقط
// شكل النص)، فأي نطاق وهمي غير مسجّل فعلياً (مثل khuta.local أو khuta-users.com) سيُرفض
// برسالة "invalid" — gmail.com نطاق حقيقي مضمون القبول، ولأننا نضيف بادئة "khuta." لاسم
// المستخدم (انظر usernameToEmail أدناه) فاحتمال تعارضه مع بريد Gmail حقيقي لأي شخص شبه معدوم،
// وعلى أي حال لن نرسل له أي بريد فعلي أبداً (تأكيد البريد معطّل).

/* ============================================================
   مهلة لكل طلب إلى Supabase — علاج «جارٍ التحميل… للأبد»
   ------------------------------------------------------------
   وصف المالك (٢٤ سبتمبر): «بعض الخيارات تعلق على جارٍ التحميل، ولا تعمل إلا
   بإعادة تحميل الصفحة أو تغيير المتصفح، وكأن الموقع كلّه يتجمّد».

   السبب: طلبٌ لا يعود أبداً — لا نجاح ولا خطأ. أشهر مصادره سفاري الآيباد
   والآيفون بعد رجوع التبويب من الخلفية أو استيقاظ الجهاز: أول اتصال يعلق
   على مقبس ميّت. ولأن كل طلب ينتظر جلسة الدخول، يعلق تجديد الجلسة فتعلق
   خلفه كل الطلبات = «الموقع كلّه تجمّد». وكل شاشاتنا تعالج الخطأ برسالة،
   لكنها لا تستطيع معالجة ما لا يعود.

   فالآن لكل طلب حدّ، ثم خطأ حقيقي تعرضه الشاشة («الاتصال بطيء… أعد
   المحاولة») بدل الانتظار الأبدي:
   • القراءة (GET): ١٠ ثوانٍ للمحاولة — ومكتبة Supabase نفسها تعيد القراءة
     ٣ مرات بعد ١ ثم ٢ ثم ٤ ثوانٍ على اتصال جديد، وأغلب التعليق يزول هناك.
     (كانت لي إعادة إضافية فوقها فصارت ٨ محاولات — أُزيلت.)
   • الكتابة ونداءات الدوال: ٢٠ ثانية مرة واحدة، بلا إعادة: قد تكون وصلت
     الخادم فعلاً، وإعادتها تكرّر الفعل (تسليم، رفع درجات…).
   ⚠️ رفع الملفات مستثنى: ملف كبير على شبكة بطيئة قد يحتاج أكثر بحق.
   ============================================================ */
const SB_READ_TIMEOUT_MS = 10000;
const SB_WRITE_TIMEOUT_MS = 20000;

function khutaFetchWithTimeout(input, init){
    init = init || {};
    const body = init.body;
    const isUpload = (typeof Blob !== "undefined" && body instanceof Blob)
        || (typeof FormData !== "undefined" && body instanceof FormData)
        || (typeof ArrayBuffer !== "undefined" && (body instanceof ArrayBuffer || ArrayBuffer.isView(body)));
    if(isUpload || typeof AbortController === "undefined") return fetch(input, init);

    const method = String(init.method || (input && input.method) || "GET").toUpperCase();
    const limit = (method === "GET" || method === "HEAD") ? SB_READ_TIMEOUT_MS : SB_WRITE_TIMEOUT_MS;
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, limit);
    // إن ألغى المستدعي طلبه بنفسه، نحترم ذلك
    const outer = init.signal;
    if(outer){
        if(outer.aborted) ctrl.abort();
        else outer.addEventListener("abort", () => ctrl.abort(), { once:true });
    }
    return fetch(input, Object.assign({}, init, { signal: ctrl.signal }))
        .then(res => { clearTimeout(timer); return res; })
        .catch(err => {
            clearTimeout(timer);
            if(timedOut){
                console.warn("[خُطى] طلب علق فقُطع بعد " + (limit / 1000) + " ث:", String((input && input.url) || input).split("?")[0]);
                throw Object.assign(new Error("REQUEST_TIMEOUT"), { name:"TimeoutError", timedOut:true });
            }
            throw err;
        });
}

let sb = null;
try{
    if(window.supabase && typeof window.supabase.createClient === "function"){
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { fetch: khutaFetchWithTimeout },
        });
    } else {
        // مكتبة Supabase لم تُحمَّل أصلاً. الموقع سيعمل كضيف (كل شيء محلي) لكن
        // الحساب والمزامنة والمجتمع ستُعطَّل. السبب الأرجح: بصمة integrity في
        // index.html لم تعد تطابق الملف على cdn.jsdelivr.net (يحدث عند ترقية
        // رقم النسخة دون توليد بصمة جديدة) — أو انقطاع الشبكة عن الـCDN.
        console.error("[خُطى] مكتبة Supabase لم تُحمَّل — تحقّق من وسم integrity في index.html. الموقع يعمل الآن بوضع الضيف فقط.");
    }
}catch(e){ console.error("[خُطى] تعذّر تهيئة Supabase:", e); }

/* ⚠️ إصلاح خلل توقيت مهم: يجب تسجيل مستمع onAuthStateChange فوراً بعد
   إنشاء عميل Supabase مباشرة، وليس لاحقاً داخل window.onload. السبب: عميل
   Supabase يبدأ بمعالجة رابط استرجاع كلمة المرور (الموجود في الرابط الذي
   وصل بالإيميل) فور إنشائه، وقد يُطلق حدث PASSWORD_RECOVERY قبل أن نصل
   لتسجيل المستمع إن أخّرناه — هذا بالضبط ما كان يجعل رابط الاسترجاع يعمل
   أحياناً ولا يعمل أحياناً أخرى حسب سرعة تحميل الصفحة أو الجهاز. */
// ⚠️ موضع هذا التعريف مقصود: يجب أن يسبق استدعاءه أدناه في نفس الملف.
// كان معرّفاً في قسم الحساب السحابي ويُستدعى هنا اعتماداً على رفع تعريفات
// الدوال داخل ملف واحد — وهذا الرفع لا يعبر حدود ملفات <script> المنفصلة،
// فنقلناه هنا عند تقسيم app.js. الاستدعاء نفسه لم يتحرك إطلاقاً كي يبقى
// توقيت تسجيل مستمع onAuthStateChange كما هو تماماً (انظر الشرح فوقه).
// ⚠️ يمنع ازدواجية معالجة نفس حدث تسجيل الدخول بين signInWithCreds/signUpWithCreds
// والمستمع العام أدناه. مُعرَّف هنا تحديداً وليس مع بقية كود الحساب: المستمع
// أدناه يقرأه، والمستمع يُسجَّل في هذا الملف الأول — فلو بقي التعريف في ملف
// لاحق لكان في "المنطقة الميتة" (TDZ) لحظة إطلاق أول حدث. انظر شرح الطابور أدناه.
let manualAuthInProgress = false;

/* ⚠️⚠️ درس من خلل حقيقي وقع في الإنتاج بعد تقسيم app.js إلى ملفات:
   جسم المستمع أدناه يستدعي دوالّ ومتغيّرات مُعرَّفة في ملفات لاحقة
   (getSession، setSession، renderAccountUI، finishLoginBoot…). حين كان
   التطبيق ملفاً واحداً كان رفع التعريفات يغطّي ذلك دائماً. بعد التقسيم صار
   بإمكان حدث مصادقة أن يصل قبل تنفيذ تلك الملفات، فيرتفع خطأ
   "manualAuthInProgress is not defined" ويسقط معالجة تسجيل الدخول بالكامل —
   وهذا ما رُصد فعلياً في سجل أخطاء الطلاب.

   الحل: نبقي التسجيل مبكراً كما هو (كي لا نفوّت PASSWORD_RECOVERY أبداً)،
   لكن نؤجّل *المعالجة* حتى اكتمال تحميل كل الملفات: أي حدث يصل قبل الجاهزية
   يُحفَظ في طابور ويُعالَج فور اكتمالها (انظر flushPendingAuthEvents، تُستدعى
   من نهاية آخر ملف). حدث PASSWORD_RECOVERY وحده يُعالَج فوراً لأنه لا يحتاج
   سوى عناصر DOM موجودة أصلاً. */
let __authHandlersReady = false;
let __pendingAuthEvents = [];

function initOAuthListener(){
    if(!sb) return;
    /* ⚠️ المستمع لا يُنتظَر ولا ينتظر: مكتبة Supabase تنتظر كل مستمع قبل أن
       تُكمل عملها على الجلسة (رجوع التبويب، تجديد الرمز، تبويب آخر)، وتوصي
       نصّاً بألّا يُستدعى Supabase من داخله. معالجتنا تستدعيه (user_data)،
       فنؤجّلها لدورة لاحقة بـsetTimeout — لا تمسك الجلسة ولا تعلق عليها. */
    sb.auth.onAuthStateChange((event, session) => {
        if(event === "PASSWORD_RECOVERY"){
            document.getElementById("login-overlay").style.display = "none";
            document.getElementById("password-recovery-overlay").style.display = "flex";
            return;
        }
        if(!__authHandlersReady){
            __pendingAuthEvents.push({ event, session });
            return;
        }
        setTimeout(() => {
            handleAuthStateEvent(event, session)
                .catch(e => console.error("[خُطى] تعذّرت معالجة حدث مصادقة:", e));
        }, 0);
    });
}

// يُستدعى من نهاية آخر ملف سكربت، بعد ضمان تنفيذ كل التعريفات
async function flushPendingAuthEvents(){
    __authHandlersReady = true;
    const queued = __pendingAuthEvents;
    __pendingAuthEvents = [];
    for(const item of queued){
        try{ await handleAuthStateEvent(item.event, item.session); }
        catch(e){ console.error("[خُطى] تعذّرت معالجة حدث مصادقة مؤجَّل:", e); }
    }
}

async function handleAuthStateEvent(event, session){
        // ⚠️ إصلاح خلل حرج: sb.auth.signInWithPassword (تسجيل الدخول باسم مستخدم)
        // يُطلق أيضاً حدث SIGNED_IN هذا بالضبط، وكان هذا المستمع يعالجه بشكل
        // مستقل ومتزامن مع معالجة signInWithCreds الخاصة به لنفس الحدث —
        // سباق حقيقي بين مسارين، وهو ما كان يُعيد الطالب لشاشة الدخول بعد
        // نجاح الدخول بلحظة تقريباً. الآن نتجاهل هذا الحدث تماماً إن كان هناك
        // مسار تسجيل دخول يدوي (signInWithCreds/signUpWithCreds) يُعالجه بالفعل.
        if(manualAuthInProgress) return;
        if(event !== "SIGNED_IN" || !session || !session.user) return;
        const existing = getSession();
        if(existing && existing.uid === session.user.id) return; // جلسة معروفة أصلاً
        if(session.user.is_anonymous) return; // تجاهل الدخول المجهول التلقائي للمجتمع

        const uid = session.user.id;
        const { data: row } = await sb.from("user_data").select("data, username").eq("id", uid).maybeSingle();
        if(row){
            setSession({ uid, username: row.username });
            if(row.data) await resolveAccountDataConflict(row.data);
        } else {
            const displayName = session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name);
            const username = displayName || (currentLang==='ar' ? "طالب" : "Student") + "_" + uid.slice(0,5);
            await sb.from("user_data").insert({ id: uid, username, data: collectLocalSnapshot() });
            setSession({ uid, username });
            recordPendingReferral(uid);
        }
        document.getElementById("login-overlay").style.display = "none";
        updateWelcomeText();
        renderAccountUI();
        checkAdminStatus();
        showToast(currentLang==='ar' ? "أهلاً بك 👋" : "Welcome 👋");
        finishLoginBoot();
}

initOAuthListener();

const APP_OWNER_NAME = "rakan/mashal"; // ضع اسمك هنا بين علامتي التنصيص، مثال: "سونيا"
const APP_OWNER_EMAIL = "sonyaloy9@gmail.com";

/* نموذج الملاحظات — أرسل مباشرة دون فتح تطبيق بريد:
   1) اذهب إلى https://formspree.io وسجّل مجاناً ببريدك sonyaloy9@gmail.com
   2) أنشئ "Form" جديد، وسيعطيك رابطاً مثل: https://formspree.io/f/xxxxabcd
   3) الصق الرابط كاملاً هنا بين علامتي التنصيص. بعدها كل ملاحظة يكتبها أي
      طالب تُرسل لبريدك تلقائياً وفورياً دون أي خطوة إضافية من الطالب.
   إن تركته فارغاً، سيستخدم التطبيق تلقائياً رابط mailto كحل احتياطي فقط. */
const FEEDBACK_ENDPOINT = "https://formspree.io/f/xjgnbgjl";

/* روابط التواصل والدعاية — تظهر في صفحة الروابط أسفل بطاقة "تواصل معنا" */
const APP_WHATSAPP_NUMBER = "0534005676"; // رقم واتساب للاستفسارات والشكاوى
const APP_TIKTOK_URL = "https://www.tiktok.com/@khuta_location?is_from_webapp=1&sender_device=pc"; // رابط تيك توك خُطى
const APP_TELEGRAM_URL = "https://t.me/khuta54"; // رابط قناة تيليجرام خُطى
/* رابط دعم الموقع (اختياري) — اتركه فارغاً ليبقى مخفياً. أسهل طريقتين
   عمليتين لطالب سعودي بدون بوابة دفع رسمية:
   1) صفحة "Ko-fi" أو "Buy Me a Coffee" مجانية (تسجيل بدقيقتين، تدعم Apple Pay وبطاقات) — الصق رابطها هنا مباشرة
   2) أو رقم STC Pay/آيبان تعرضه يدوياً بدل رابط — عدّل initContactLinks لعرض نص بدل رابط إن فضّلت هذا
   يظهر بتصميم هادئ أسفل صفحة الروابط، لا يُفرض على أحد. */
const APP_SUPPORT_URL = "";

/* ============================================================
   أعلام تفعيل القسمين الجديدين — كلاهما مطفأ افتراضياً تماماً ولا يظهر
   أي أثر لهما في الواجهة (لا رابط، لا قسم) طالما false. لتفعيل أي منهما:
   غيّر القيمة إلى true هنا وأعد النشر، لا حاجة لأي تعديل آخر.
   ============================================================ */
const FEATURE_EXAM_SIMULATOR = true;    // قسم الاختبارات المحاكية — مفعَّل دائماً
const FEATURE_TUTORS_DIRECTORY = false; // قسم المدرّسين الخصوصيين

/* نظام المشرفين — لم يعد مقتصراً على معرّف واحد ثابت في الكود. الصلاحية
   تُتحقَّق الآن من جدول app_admins في Supabase، الذي تديره بنفسك من Table
   Editor (أضف/احذف صفوفاً لمنح/سحب الصلاحية من أي حساب Google تريده،
   دون الحاجة لتعديل الكود أو إعادة النشر إطلاقاً). */
let isAdmin = false;
async function checkAdminStatus(){
    if(!sb){ isAdmin = false; return false; }
    try{
        const { data: userData } = await sb.auth.getUser();
        const uid = userData && userData.user && userData.user.id;
        if(!uid){ isAdmin = false; return false; }
        const { data } = await sb.from("app_admins").select("uid").eq("uid", uid).maybeSingle();
        isAdmin = !!data;
    }catch(e){ isAdmin = false; }
    renderAdminTools();
    return isAdmin;
}

/* ============================================================
   📂 بيانات الموقع القابلة للتحديث من GitHub
   ------------------------------------------------------------
   كل ملفات البيانات في مستودع rakan1430/my-website-data. أي تعديل يُحفظ هناك
   يظهر على الموقع مباشرة عند أول تحديث للصفحة — بلا لمس الكود وبلا إعادة نشر.
   هذا مقصود: الشخص الذي يحدّث البيانات ليس مبرمجاً.

   ما الذي يحمي الموقع إذاً من ملف مكسور أو خاطئ؟ طبقتان، كلتاهما تلقائيتان:
     1) فحص آلي على GitHub نفسه (.github/workflows في مستودع البيانات) يرفض أي
        حفظ فيه خطأ صياغة أو حقل ناقص أو أوزان لا تساوي 100.
     2) فحص ثانٍ هنا في المتصفح قبل استعمال أي بيانات (validateRemote* أدناه):
        أي ملف لا يجتاز الفحص يُتجاهَل بالكامل ويستمر الموقع بالبيانات المدمجة
        في الكود. لا شاشة بيضاء ولا حسابات خاطئة مهما كان الملف سيئاً.
   وأي نص يأتي من هذه الملفات يُهرَّب قبل عرضه، فلا يمكن أن يتحوّل إلى كود.
   ============================================================ */
const REMOTE_DATA_BASE = "https://raw.githubusercontent.com/rakan1430/my-website-data/main/";

/* أسماء الملفات بالعربية مُرمَّزة (encodeURIComponent) لأن الروابط لا تقبل
   المسافات والحروف العربية كما هي. لا تعدّلها يدوياً — إن غيّرت اسم ملف على
   GitHub، غيّر الاسم العربي في السطر المناسب أدناه وسيُرمَّز تلقائياً. */
const REMOTE_UNIVERSITIES_URL = REMOTE_DATA_BASE + encodeURIComponent("الجامعات وتخصيصها.json");

/* ============================================================
   ⭐ هيكل تحديث تجميعات المصادر (إيهاب / المنصف / المفكر / المعاصر / أينشتاين)
   ------------------------------------------------------------
   هذا هو الملف الوحيد الذي تحتاج تعديله على GitHub عندما يتغيّر أي مصدر
   (يُضاف قسم، يُحذف بنك، إلخ). كل رقم أدناه موضّح بجانبه بالضبط ماذا
   يتحكم فيه. الأرقام هنا تُستخدم في **كل** حسابات الجدول اليومي وأيضاً
   في "الحساب الذكي" (تقدير الوقت اللازم لكل مصدر) — لا تحتاج لتعديل أي
   مكان آخر في الكود، كل شيء يقرأ من هنا تلقائياً.

   الأرقام أدناه نسخة احتياطية فقط. المصدر الحيّ هو ملف "الدورات وحسبتها.json"
   في مستودع my-website-data: عدّله واحفظه، ويظهر التغيير على الموقع مباشرة.
   الأرقام هنا تُستعمل فقط لو تعذّر جلب الملف أو كان محتواه غير صالح.
   ============================================================ */
const REMOTE_CONTENT_URL = REMOTE_DATA_BASE + encodeURIComponent("الدورات وحسبتها.json");

const CONTENT_CONFIG = {
    // تاريخ آخر مرة حدّثت فيها هذا الملف — لعرضه للطالب فقط، لا يؤثر على أي حساب
    lastUpdated: "18 يوليو 2026",

    ehab: {
        totalSections: 215,          // إجمالي عدد أقسام دورة إيهاب اللفظية — غيّره إن أضافوا/حذفوا أقساماً
        minutesPerSection: 7,        // الوقت التقريبي بالدقائق لإنهاء القسم الواحد — يُستخدم في "الحساب الذكي" لتقدير مدة الجلسة
    },
    monsif: {
        totalBanks: 120,             // إجمالي عدد بنوك المنصف الكمية
        questionsPerBankLabel: "48-50", // نص فقط يظهر للطالب (وصف عدد الأسئلة تقريبياً)، لا يدخل في الحسابات
        minutesPerBank: 50,          // الوقت التقريبي بالدقائق لإنهاء البنك الواحد — يُستخدم في الحساب الذكي
    },
    mufakkirSections: {
        total: 90,                   // إجمالي أقسام المفكر
        questionsPerSectionLabel: "11", // نص وصفي فقط لعدد الأسئلة بالقسم، لا يدخل في الحسابات
        minutesPerSection: 30,       // الوقت التقريبي بالدقائق لإنهاء قسم المفكر الواحد
    },
    mufakkirRepeated: {
        total: 814,                  // إجمالي أسئلة "الأكثر تكراراً" في المفكر
        minutesPer10Questions: 30,   // الوقت التقريبي لإنهاء كل 10 أسئلة من هذه القائمة
    },
    moasserFoundation: {
        days: 30,                    // عدد أيام "تحدي" كتاب المعاصر للتأسيس (كما هو معلن من المعاصر نفسه)
        pagesPerDay: 8,               // عدد صفحات التحدي اليومي المعلن من المعاصر
        edition: "الإصدار 2026",      // نص وصفي فقط لإصدار الكتاب الحالي
    },
    moasserTraining: {
        totalBanks: 120,              // إجمالي بنوك تدريب المعاصر
        questionsPerBankLabel: "43-47", // نص وصفي فقط لعدد الأسئلة بالبنك
        minutesPerBank: 50,           // الوقت التقريبي بالدقائق لإنهاء بنك تدريب المعاصر الواحد (نفس وقت المنصف تقريباً)
    },
    einstein: {
        totalVideos: 57,              // إجمالي عدد مقاطع دورة أينشتاين الكاملة للتأسيس الكمي
        reviewVideos: 9,               // عدد مقاطع "مراجعة التأسيس فقط" (زُبدة الدورة لمن يريد اختصاراً)
        minutesPerVideo: 60,           // مدة المقطع الواحد بالدقائق (كل المقاطع بنفس المدة تقريباً)
        outdatedNotice: true,          // اتركه true لإظهار تنبيه "دورة قديمة نسبياً" للطالب، أو غيّره false لإخفاء التنبيه عند صدور نسخة جديدة
    },
};

function getContent(){
    return window.__REMOTE_CONTENT__ || CONTENT_CONFIG;
}

/* ============================================================
   🛡️ فحص البيانات القادمة من GitHub قبل استعمالها
   ------------------------------------------------------------
   القاعدة: لا نثق بأي ملف خارجي. الملف يُستعمل فقط إن اجتاز الفحص كاملاً،
   وإلا يُتجاهل ونستمر بالبيانات المدمجة في الكود. النتيجة: مهما أخطأ من
   يحدّث البيانات، لا يمكنه كسر الموقع ولا إظهار حسابات خاطئة للطلاب.
   ============================================================ */
const isPosNum = v => typeof v === "number" && isFinite(v) && v > 0;
const isText = v => typeof v === "string" && v.trim().length > 0;

// يسجّل سبب الرفض في الطرفية فقط — ليعرف من يصلح الملف أين المشكلة بالضبط
function rejectRemote(file, why){
    console.warn(`[خُطى] تم تجاهل "${file}" من GitHub والاستمرار بالبيانات المدمجة. السبب: ${why}`);
    return false;
}

// أرقام الدورات: كل مفتاح موجود يجب أن تكون أرقامه موجبة، وإلا انهارت
// حسابات الجدول اليومي (قسمة على صفر أو كميات سالبة)
function validateRemoteContent(json){
    if(!json || typeof json !== "object" || Array.isArray(json))
        return rejectRemote("الدورات وحسبتها.json", "الملف ليس كائن JSON صالحاً");
    const numericFields = {
        ehab: ["totalSections", "minutesPerSection"],
        monsif: ["totalBanks", "minutesPerBank"],
        mufakkirSections: ["total", "minutesPerSection"],
        mufakkirRepeated: ["total", "minutesPer10Questions"],
        moasserFoundation: ["days", "pagesPerDay"],
        moasserTraining: ["totalBanks", "minutesPerBank"],
        einstein: ["totalVideos", "minutesPerVideo"],
    };
    for(const [group, fields] of Object.entries(numericFields)){
        if(json[group] === undefined) continue;            // مفتاح غائب = نأخذ المدمج، لا بأس
        if(typeof json[group] !== "object" || json[group] === null)
            return rejectRemote("الدورات وحسبتها.json", `القسم "${group}" ليس كائناً`);
        for(const f of fields){
            if(json[group][f] !== undefined && !isPosNum(json[group][f]))
                return rejectRemote("الدورات وحسبتها.json", `"${group}.${f}" يجب أن يكون رقماً أكبر من صفر`);
        }
    }
    return true;
}

async function tryLoadRemoteContent(){
    if(!REMOTE_CONTENT_URL) return;
    try{
        const res = await fetch(REMOTE_CONTENT_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(!validateRemoteContent(json)) return;
        window.__REMOTE_CONTENT__ = Object.assign({}, CONTENT_CONFIG, json);
        buildScheduleTable();
        applyContentNumbers();
    }catch(e){
        console.warn("[خُطى] تعذّر قراءة \"الدورات وحسبتها.json\" (خطأ صياغة JSON غالباً) — نستمر بالأرقام المدمجة.", e);
    }
}

