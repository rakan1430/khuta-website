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
const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84";
const USERNAME_EMAIL_DOMAIN = "gmail.com"; // نُستخدم كنطاق بريد وهمي داخلي فقط (الطالب لن يراه ولا نرسل له بريداً حقيقياً أبداً).
// لماذا gmail.com تحديداً؟ Supabase يتحقق من أن نطاق البريد له سجلات DNS/MX حقيقية (وليس فقط
// شكل النص)، فأي نطاق وهمي غير مسجّل فعلياً (مثل khuta.local أو khuta-users.com) سيُرفض
// برسالة "invalid" — gmail.com نطاق حقيقي مضمون القبول، ولأننا نضيف بادئة "khuta." لاسم
// المستخدم (انظر usernameToEmail أدناه) فاحتمال تعارضه مع بريد Gmail حقيقي لأي شخص شبه معدوم،
// وعلى أي حال لن نرسل له أي بريد فعلي أبداً (تأكيد البريد معطّل).

let sb = null;
try{
    if(window.supabase && typeof window.supabase.createClient === "function"){
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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
    sb.auth.onAuthStateChange(async (event, session) => {
        if(event === "PASSWORD_RECOVERY"){
            document.getElementById("login-overlay").style.display = "none";
            document.getElementById("password-recovery-overlay").style.display = "flex";
            return;
        }
        if(!__authHandlersReady){
            __pendingAuthEvents.push({ event, session });
            return;
        }
        await handleAuthStateEvent(event, session);
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
   📌 إصدار بيانات GitHub المثبَّت  (اقرأ هذا قبل تحديث أي ملف بيانات)
   ------------------------------------------------------------
   بيانات الجامعات والدورات تُجلب من مستودع rakan1430/my-website-data على
   GitHub. كنّا نجلبها سابقاً من "آخر نسخة" (refs/heads/main)، أي أن أي تعديل
   على GitHub كان ينعكس على الموقع فوراً. هذا مريح، لكنه يعني أيضاً أن أي
   تعديل خاطئ — أو أي شخص يحصل على صلاحية الكتابة في ذلك المستودع — يغيّر ما
   يراه كل الطلاب مباشرة دون مراجعة.

   لذلك أصبحنا نثبّت الجلب على "لقطة" محدّدة من المستودع (رقم الالتزام/commit
   أدناه). الموقع سيقرأ دائماً هذه اللقطة بالذات.

   ⚠️ الأثر المهم: تعديل ملفات JSON على GitHub لن يظهر في الموقع تلقائياً بعد
   الآن. لتحديث البيانات صار عليك خطوتان:
     1) عدّل الملف على GitHub في my-website-data واحفظه كالمعتاد.
     2) افتح صفحة المستودع، انسخ رقم آخر commit (سلسلة 40 حرفاً)، والصقه في
        REMOTE_DATA_REF أدناه بدل الرقم الحالي، ثم احفظ — سينشر Netlify تلقائياً.
   الرقم الحالي يقابل لقطة المستودع بتاريخ التثبيت.
   ============================================================ */
const REMOTE_DATA_REF = "1fed7bb8084b51add83ab0b085f66b9fdaabdcae";
const REMOTE_DATA_BASE = `https://raw.githubusercontent.com/rakan1430/my-website-data/${REMOTE_DATA_REF}/`;

/* اختياري: رابط JSON خارجي (مستضاف على GitHub) يحوي مصفوفة جامعات محدّثة.
   إن ضبطته، سيحاول التطبيق جلبه عند التشغيل ودمجه فوق القائمة المدمجة أدناه.
   لتحديثه: عدّل الملف على GitHub ثم حدّث REMOTE_DATA_REF أعلاه. */
const REMOTE_UNIVERSITIES_URL = REMOTE_DATA_BASE + "%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D8%A7%D8%AA%20%D9%88%D8%AA%D8%AE%D8%B5%D9%8A%D8%B5%D9%87%D8%A7.json";

/* ============================================================
   ⭐ هيكل تحديث تجميعات المصادر (إيهاب / المنصف / المفكر / المعاصر / أينشتاين)
   ------------------------------------------------------------
   هذا هو الملف الوحيد الذي تحتاج تعديله على GitHub عندما يتغيّر أي مصدر
   (يُضاف قسم، يُحذف بنك، إلخ). كل رقم أدناه موضّح بجانبه بالضبط ماذا
   يتحكم فيه. الأرقام هنا تُستخدم في **كل** حسابات الجدول اليومي وأيضاً
   في "الحساب الذكي" (تقدير الوقت اللازم لكل مصدر) — لا تحتاج لتعديل أي
   مكان آخر في الكود، كل شيء يقرأ من هنا تلقائياً.

   لتحديث هذه الأرقام من GitHub بدل تعديل الكود هنا:
   1) عدّل ملف "الدورات وحسبتها.json" في مستودع my-website-data واحفظه.
   2) حدّث REMOTE_DATA_REF في الأعلى برقم آخر commit — بدون هذه الخطوة الثانية
      سيبقى الموقع يقرأ اللقطة القديمة ولن تظهر تعديلاتك.
   ============================================================ */
const REMOTE_CONTENT_URL = REMOTE_DATA_BASE + "%D8%A7%D9%84%D8%AF%D9%88%D8%B1%D8%A7%D8%AA%20%D9%88%D8%AD%D8%B3%D8%A8%D8%AA%D9%87%D8%A7.json";

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

async function tryLoadRemoteContent(){
    if(!REMOTE_CONTENT_URL) return;
    try{
        const res = await fetch(REMOTE_CONTENT_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(json && typeof json === "object"){
            window.__REMOTE_CONTENT__ = Object.assign({}, CONTENT_CONFIG, json);
            buildScheduleTable();
            applyContentNumbers();
        }
    }catch(e){ /* تجاهل بصمت — نستمر بالأرقام المدمجة محلياً */ }
}

