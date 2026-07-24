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
    }
}catch(e){ console.error("[خُطى] تعذّر تهيئة Supabase:", e); }

/* ⚠️ إصلاح خلل توقيت مهم: يجب تسجيل مستمع onAuthStateChange فوراً بعد
   إنشاء عميل Supabase مباشرة، وليس لاحقاً داخل window.onload. السبب: عميل
   Supabase يبدأ بمعالجة رابط استرجاع كلمة المرور (الموجود في الرابط الذي
   وصل بالإيميل) فور إنشائه، وقد يُطلق حدث PASSWORD_RECOVERY قبل أن نصل
   لتسجيل المستمع إن أخّرناه — هذا بالضبط ما كان يجعل رابط الاسترجاع يعمل
   أحياناً ولا يعمل أحياناً أخرى حسب سرعة تحميل الصفحة أو الجهاز. */
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
const FEATURE_EXAM_SIMULATOR = false;   // قسم الاختبارات المحاكية
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

/* اختياري: رابط JSON خارجي (مثلاً مستضاف على GitHub) يحوي مصفوفة جامعات محدّثة.
   إن ضبطته، سيحاول التطبيق جلبه عند التشغيل ودمجه فوق القائمة المدمجة أدناه —
   هذه هي الطريقة العملية لتحديث بيانات الجامعات دون إعادة نشر كل الكود. */
const REMOTE_UNIVERSITIES_URL = "https://raw.githubusercontent.com/rakan1430/my-website-data/refs/heads/main/%D8%A7%D9%84%D8%AC%D8%A7%D9%85%D8%B9%D8%A7%D8%AA%20%D9%88%D8%AA%D8%AE%D8%B5%D9%8A%D8%B5%D9%87%D8%A7.json";

/* ============================================================
   ⭐ هيكل تحديث تجميعات المصادر (إيهاب / المنصف / المفكر / المعاصر / أينشتاين)
   ------------------------------------------------------------
   هذا هو الملف الوحيد الذي تحتاج تعديله على GitHub عندما يتغيّر أي مصدر
   (يُضاف قسم، يُحذف بنك، إلخ). كل رقم أدناه موضّح بجانبه بالضبط ماذا
   يتحكم فيه. الأرقام هنا تُستخدم في **كل** حسابات الجدول اليومي وأيضاً
   في "الحساب الذكي" (تقدير الوقت اللازم لكل مصدر) — لا تحتاج لتعديل أي
   مكان آخر في الكود، كل شيء يقرأ من هنا تلقائياً.

   لتفعيل التحديث من GitHub بدل الكود مباشرة:
   1) أنشئ ملف باسم content.json بنفس الشكل بالضبط (بدون كلمة const، وبعلامات
      تنصيص مزدوجة حول كل اسم حقل، بصيغة JSON قياسية)
   2) ارفعه على GitHub في مستودع عام (Public repo)
   3) افتح الملف على GitHub واضغط زر "Raw"، انسخ الرابط من شريط العنوان
   4) الصق هذا الرابط في REMOTE_CONTENT_URL أدناه (بين علامتي التنصيص)
   5) احفظ ونشر — من هذه اللحظة، أي تعديل تحفظه في ملف GitHub ينعكس
      فوراً على كل من يفتح الموقع، دون الحاجة لتعديل أو رفع الكود مجدداً.
   ============================================================ */
const REMOTE_CONTENT_URL = "https://raw.githubusercontent.com/rakan1430/my-website-data/refs/heads/main/%D8%A7%D9%84%D8%AF%D9%88%D8%B1%D8%A7%D8%AA%20%D9%88%D8%AD%D8%B3%D8%A8%D8%AA%D9%87%D8%A7.json";

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

/* ============================================================
   1) بيانات الجامعات
   ------------------------------------------------------------
   ⚠️ مصدر البيانات: تجميع من الصفحات الرسمية لبعض الجامعات (uqu.edu.sa،
   kau.edu.sa، kkux.kku.edu.sa) بالإضافة إلى تقارير صحفية ومصادر تعليمية متعددة،
   وليست تغذية مباشرة من "قياس" أو وزارة التعليم. بعض الجامعات (كجامعة الملك
   عبدالعزيز) غيّرت شروطها مؤخراً (إضافة STEP اعتباراً من العام الجامعي
   1448-1449هـ)، مما يؤكد أن هذه الشروط تتغير سنوياً.
   القيمة step تكون: true = مطلوب لعموم برامج البكالوريوس المنتظم،
   "partial" = مطلوب لبرامج/كليات معينة فقط (غالباً الطب والتمريض واللغات
   والهندسة الإنجليزية)، false = لم نجد ما يفيد اشتراطه حالياً.
   استخدم REMOTE_UNIVERSITIES_URL أدناه لتحديث هذه البيانات دون تعديل الكود.
   ============================================================ */
const DATA_LAST_UPDATED = "13 يوليو 2026";
const DATA_DISCLAIMER_AR = "هذه الأوزان ومتطلبات STEP مجمّعة من مصادر متعددة (مواقع جامعات رسمية وتقارير تعليمية) وقد لا تعكس آخر تحديث للجامعة، والقبول الفعلي يختلف أحياناً بين الكليات داخل الجامعة نفسها. تحقق دائماً من بوابة القبول الموحد أو موقع الجامعة قبل اتخاذ أي قرار.";
const DATA_DISCLAIMER_EN = "These weights and STEP requirements are aggregated from multiple sources (official university pages and education reports) and may not reflect the latest policy; actual admission often varies between colleges within the same university. Always verify with the unified admission portal or the university's official site before deciding.";

/* قائمة عامة تقريبية للتخصصات التي غالباً تشترط STEP والتي غالباً لا تشترطه —
   نمط عام شائع عبر أغلب الجامعات السعودية، وليست قائمة رسمية لكل جامعة على
   حدة (ذلك يتطلب مراجعة دليل قبول كل جامعة كل عام). تُعرض كمرجع تقريبي فقط. */
const DEFAULT_STEP_MAJORS = {
    yes: {
        ar: ["الطب البشري","طب الأسنان","الصيدلة","الهندسة (المسارات/البرامج الإنجليزية)","علوم الحاسب (في بعض الجامعات)","اللغات والترجمة"],
        en: ["Medicine","Dentistry","Pharmacy","Engineering (English-taught tracks)","Computer Science (at some universities)","Languages & Translation"],
    },
    no: {
        ar: ["الشريعة والدراسات الإسلامية","الآداب واللغة العربية","العلوم الإدارية (غالباً)","التربية (غالباً)","العلوم الاجتماعية"],
        en: ["Sharia & Islamic Studies","Arabic Language & Literature","Business Administration (usually)","Education (usually)","Social Sciences"],
    }
};

/* ============================================================
   ⭐ قسم الجامعات — دليلك الكامل لإضافة جامعة جديدة أو تعديل موزونة قائمة
   ------------------------------------------------------------
   ملاحظة: منذ آخر تحديث، أصبحت الجامعات تُدار بشكل أساسي من جدول
   Supabase (Table Editor) — راجع SUPABASE_SETUP.sql. القائمة أدناه هي
   فقط "نسخة احتياطية" يستخدمها التطبيق إن تعذّر الوصول لـ Supabase.
   يمكنك أيضاً استخدام REMOTE_UNIVERSITIES_URL (ملف JSON على GitHub) كطريقة
   بديلة إن فضّلت ذلك على Supabase — كلاهما يعمل، اختر ما يريحك أكثر.

   === لإضافة جامعة جديدة بالكامل ===
   انسخ أي سطر كامل (من { id: إلى },) والصقه، ثم عدّل:
   - id: معرّف فريد بالإنجليزية بدون مسافات (مثال: "new_uni")
   - name / nameEn: اسم الجامعة بالعربي والإنجليزي
   - city: المدينة
   - type: "public" (حكومية) أو "private" (خاصة)

   === لتعديل وزن الموزونة لجامعة معينة (القسم الأهم) ===
   ابحث عن الجامعة بالاسم، وعدّل قيم weights:
   - high: وزن الثانوية (%) — مثال: 30
   - qat: وزن القدرات (%) — مثال: 30
   - tah: وزن التحصيلي (%) — مثال: 40
   - step: (اختياري) وزن STEP بالنسبة المئوية إن كانت الجامعة تخصص له وزناً
     رقمياً ضمن المعادلة (مثال: جامعة الملك عبدالعزيز التي تعطيه 10%)
   ⚠️ يجب أن يكون مجموع high + qat + tah (+ step إن وُجد) = 100 بالضبط

   === لتحديد هل الجامعة تشترط STEP أو لا (حقل step الرئيسي، خارج weights) ===
   - step: true → إجباري لكل برامج البكالوريوس، يُقفل الخيار على الطالب تلقائياً
   - step: "partial" → إجباري لبعض الكليات فقط (كالطب) وليس كل الجامعة
   - step: false → لا يوجد ما يفيد اشتراطه حالياً
   - stepMin: (اختياري) الحد الأدنى التقريبي المطلوب في STEP إن كان معروفاً

   === لتحديد مستوى التنافسية (يظهر كأعمدة ملوّنة في تفاصيل الجامعة) ===
   - comp: رقم من 1 (أقل تنافسية) إلى 5 (الأعلى تنافسية كالطب)

   === لكتابة ملاحظة توضيحية تظهر للطالب أسفل تفاصيل الجامعة ===
   - note / noteEn: أي نص حر بالعربي والإنجليزي (مثال: تفاصيل كلية معينة)
   ============================================================ */
const UNIVERSITIES = [
    { id:"ksu", name:"جامعة الملك سعود", nameEn:"King Saud University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:5,
      note:"الوزن العام لأغلب الكليات العلمية. بعض الكليات (كالطب والهندسة وبرامج اللغة الإنجليزية) قد تشترط درجة معينة في STEP أو IELTS/TOEFL، وتضيف كليات كالطب مقابلة شخصية.",
      noteEn:"General weighting for most scientific colleges. Some colleges (Medicine, Engineering, English-taught programs) may require a STEP/IELTS/TOEFL score, and Medicine typically adds a personal interview." },
    { id:"kau", name:"جامعة الملك عبدالعزيز", nameEn:"King Abdulaziz University", city:"جدة", cityEn:"Jeddah", type:"public",
      weights:{high:30, qat:30, tah:30, step:10}, step:true, stepMin:60, comp:4,
      note:"⚡ حدّثت الجامعة رسمياً معايير القبول اعتباراً من العام الجامعي 1448-1449هـ لتصبح: 30% ثانوية + 30% قدرات + 30% تحصيلي + 10% STEP، لبرامج البكالوريوس انتظام والسنة التأهيلية والدبلوم الصباحي. راجع الموقع الرسمي لتأكيد سريان هذا القرار على دفعتك.",
      noteEn:"The university officially updated its admission formula starting the 1448-1449H academic year to: 30% high-school + 30% Qudrat + 30% Tahsili + 10% STEP, for regular bachelor's, foundation-year and morning diploma programs. Verify on the official site that this applies to your intake." },
    { id:"kfupm", name:"جامعة الملك فهد للبترول والمعادن", nameEn:"King Fahd University of Petroleum & Minerals", city:"الظهران", cityEn:"Dhahran", type:"public",
      weights:{high:10, qat:50, tah:40}, step:true, stepMin:55, comp:5,
      note:"يُشترط اجتياز اختبار STEP (أو ما يعادله من IELTS/TOEFL/Duolingo) كشرط أساسي للتقديم بغض النظر عن الموزونة. مسار القبول الأساسي يعتمد غالباً على القدرات والتحصيلي فقط (50%/50%) دون الثانوية.",
      noteEn:"STEP (or equivalent IELTS/TOEFL/Duolingo) is a mandatory admission gate regardless of the weighted score. The basic admission track often uses Qudrat/Tahsili only (50%/50%)." },
    { id:"imamu", name:"جامعة الإمام محمد بن سعود الإسلامية", nameEn:"Imam Mohammad Ibn Saud Islamic University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"الوزن العام لمعظم الكليات. مسار اللغات والترجمة يشترط تقريباً 55 درجة في STEP وفق مصادر تعليمية (يُنصح بالتأكيد من الجامعة).",
      noteEn:"General weighting for most colleges. The Languages & Translation track reportedly requires around 55 in STEP per education sources (verify with the university)." },
    { id:"uqu", name:"جامعة أم القرى", nameEn:"Umm Al-Qura University", city:"مكة المكرمة", cityEn:"Mecca", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"✅ مؤكد من الموقع الرسمي للجامعة: يُشترط اجتياز STEP بدرجة 60 فأعلى للقبول في التخصصات الطبية تحديداً؛ باقي الكليات لا تشترطه عادة.",
      noteEn:"✅ Confirmed on the official university site: STEP score of 60+ is required specifically for medical-college admission; other colleges generally don't require it." },
    { id:"kku", name:"جامعة الملك خالد", nameEn:"King Khalid University", city:"أبها", cityEn:"Abha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:true, comp:3,
      note:"تشترط الجامعة اجتياز اختبار تحديد مستوى اللغة الإنجليزية ضمن شروط القبول (STEP أو ما يعادله)، ويُلغى ترشيح من لا يحضره — مذكور في دليل القبول الرسمي ومركز STEP التابع للجامعة (KKUx).",
      noteEn:"The university requires an English proficiency test (STEP or equivalent) as an admission condition — noted in the official admission guide and the university's own STEP training center (KKUx)." },
    { id:"qu", name:"جامعة القصيم", nameEn:"Qassim University", city:"بريدة", cityEn:"Buraidah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. بعض الكليات الصحية والهندسية قد تضيف شرط STEP.", noteEn:"General weighting. Some health/engineering colleges may add a STEP requirement." },
    { id:"pnu", name:"جامعة الأميرة نورة بنت عبدالرحمن", nameEn:"Princess Nourah bint Abdulrahman University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"جامعة نسائية بالكامل. كلية اللغات تشترط وفق مصادر تعليمية حوالي 83 درجة في STEP؛ التخصصات الأخرى غالباً لا تشترطه.",
      noteEn:"Women-only university. The College of Languages reportedly requires around 83 in STEP per education sources; other majors generally don't require it." },
    { id:"kfu", name:"جامعة الملك فيصل", nameEn:"King Faisal University", city:"الأحساء", cityEn:"Al-Ahsa", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية والإنجليزية غالباً تضيف شرط لغة.", noteEn:"General weighting. Health and English-taught colleges often add a language requirement." },
    { id:"ksauhs", name:"جامعة الملك سعود بن عبدالعزيز للعلوم الصحية", nameEn:"King Saud bin Abdulaziz University for Health Sciences", city:"الرياض / جدة / الأحساء", cityEn:"Riyadh / Jeddah / Al-Ahsa", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:5,
      note:"✅ مؤكد من الموقع الرسمي للجامعة (ksau-hs.edu.sa): 30% ثانوية + 30% قدرات + 40% تحصيلي. جامعة صحية متخصصة (طب، تمريض، علوم صحية) بالكامل تقريباً باللغة الإنجليزية، وتُضاف مقابلة شخصية للبرامج التي تتطلب ذلك، وقد تُطلب درجة لغة إنجليزية لبعض البرامج.",
      noteEn:"✅ Confirmed on the official university site (ksau-hs.edu.sa): 30% high-school + 30% Qudrat + 40% Tahsili. A specialized health-sciences university taught almost entirely in English; a personal interview is added for programs that require it, and some programs may require an English score." },
    { id:"taibah", name:"جامعة طيبة", nameEn:"Taibah University", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"iumadinah", name:"الجامعة الإسلامية بالمدينة المنورة", nameEn:"Islamic University of Madinah", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"بعض الكليات الشرعية قد تتطلب اختباراً في التلاوة والحفظ أو مقابلة إضافية بدل STEP.", noteEn:"Some Sharia colleges may require a Quran recitation/memorization test or an interview instead of STEP." },
    { id:"jazanu", name:"جامعة جازان", nameEn:"Jazan University", city:"جازان", cityEn:"Jazan", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"najranu", name:"جامعة نجران", nameEn:"Najran University", city:"نجران", cityEn:"Najran", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"tabuku", name:"جامعة تبوك", nameEn:"University of Tabuk", city:"تبوك", cityEn:"Tabuk", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"hailu", name:"جامعة حائل", nameEn:"University of Hail", city:"حائل", cityEn:"Hail", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"bau", name:"جامعة الباحة", nameEn:"Al Baha University", city:"الباحة", cityEn:"Al Baha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"nbu", name:"جامعة الحدود الشمالية", nameEn:"Northern Border University", city:"عرعر", cityEn:"Arar", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"su", name:"جامعة شقراء", nameEn:"Shaqra University", city:"شقراء", cityEn:"Shaqra", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"mu", name:"جامعة المجمعة", nameEn:"Majmaah University", city:"المجمعة", cityEn:"Majmaah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"iau", name:"جامعة الإمام عبدالرحمن بن فيصل", nameEn:"Imam Abdulrahman Bin Faisal University", city:"الدمام", cityEn:"Dammam", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"تضم كليات صحية (كالطب) قد تعتمد أوزاناً مختلفة وتشترط STEP وتضيف مقابلة شخصية.", noteEn:"Includes health colleges (e.g. Medicine) that may use different weights, require STEP, and add an interview." },
    { id:"tu", name:"جامعة الطائف", nameEn:"Taif University", city:"الطائف", cityEn:"Taif", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"الوزن العام. قسم اللغة الإنجليزية يشترط وفق مصادر تعليمية حوالي 40 درجة في STEP.", noteEn:"General weighting. The English department reportedly requires around 40 in STEP per education sources." },
    { id:"ju", name:"جامعة الجوف", nameEn:"Jouf University", city:"سكاكا", cityEn:"Sakaka", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"bu", name:"جامعة بيشة", nameEn:"University of Bisha", city:"بيشة", cityEn:"Bisha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"psau", name:"جامعة الأمير سطام بن عبدالعزيز", nameEn:"Prince Sattam Bin Abdulaziz University", city:"الخرج", cityEn:"Al-Kharj", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"الوزن العام. كلية الطب تشترط وفق مصادر تعليمية حوالي 70 درجة في STEP، وطب الأسنان حوالي 65.", noteEn:"General weighting. The College of Medicine reportedly requires around 70 in STEP, and Dentistry around 65, per education sources." },
    { id:"uj", name:"جامعة جدة", nameEn:"University of Jeddah", city:"جدة", cityEn:"Jeddah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4, note:"الوزن العام. الكليات الصحية والهندسية قد تضيف شرط لغة.", noteEn:"General weighting. Health/engineering colleges may add a language requirement." },
    { id:"pmu_madinah", name:"جامعة الأمير مقرن بن عبدالعزيز", nameEn:"Prince Mugrin University", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"جامعة حديثة نسبياً — الوزن العام المعتاد.", noteEn:"Relatively new public university — standard general weighting." },
    { id:"alfaisal", name:"جامعة الفيصل", nameEn:"Alfaisal University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:true, comp:4,
      note:"جامعة خاصة بنظام قبول مستقل (SAT/STEP + مقابلة)، الدراسة باللغة الإنجليزية بالكامل غالباً. لا تنطبق صيغة الموزونة الموحدة مباشرة.",
      noteEn:"Private university with an independent admission system (SAT/STEP + interview), mostly English-taught. The unified weighted formula does not directly apply." },
    { id:"effat", name:"جامعة أفق (عفت)", nameEn:"Effat University", city:"جدة", cityEn:"Jeddah", type:"private",
      weights:null, step:true, comp:3,
      note:"جامعة خاصة للطالبات، تتطلب عادة اختبار لغة إنجليزية ومقابلة ضمن نظام قبول مستقل.",
      noteEn:"Private women's university, typically requires an English test and interview under its own admission system." },
    { id:"psu_riyadh", name:"جامعة الأمير سلطان", nameEn:"Prince Sultan University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:true, comp:3,
      note:"جامعة خاصة بنظام قبول مستقل يعتمد اختبار قبول داخلي ومقابلة.", noteEn:"Private university with its own entrance exam and interview." },
    { id:"dau", name:"جامعة دار العلوم", nameEn:"Dar Al Uloom University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:"partial", comp:2,
      note:"جامعة خاصة بنظام قبول مستقل، يُفضل مراجعة الموقع الرسمي للتفاصيل.", noteEn:"Private university with its own admission system — check the official website for details." },
];

/* ============================================================
   2) الترجمة (عربي / إنجليزي)
   ============================================================ */
const I18N = {
ar:{
"login.tagline":"رفيقك الذكي في رحلة القدرات",
"login.google":"المتابعة بحساب Google","login.apple":"المتابعة بحساب Apple","login.or":"أو","login.guest":"المتابعة كضيف بدون حساب",
"login.first":"الاسم الأول","login.firstPh":"مثال: راكان",
"login.last":"اللقب","login.lastPh":"مثال: الحربي",
"login.next":"التالي: تخصيص خطتي",
"setup.title":"تخصيص مسارات مذاكرة القدرات",
"setup.subtitle":"اختر مصادرك المفضلة، وسنبني لك جدولاً محسوباً بدقة",
"setup.verbalTitle":"القسم اللفظي",
"setup.verbalDesc":"دورة إيهاب (215 قسم) هي مسارك الوحيد والمعتمد للفظي.",
"setup.foundTitle":"القسم الكمي — التأسيس",
"setup.foundMoasser":"كتاب المعاصر 10","setup.foundMoasserDesc":"تحدي 30 يوماً، 8 صفحات يومياً تقريباً",
"setup.foundEinstein":"أينشتاين","setup.foundEinsteinDesc":"57 مقطع فيديو (ساعة/مقطع تقريباً)",
"setup.einsteinWarning":"دورة أينشتاين تُعد قديمة نسبياً وسيصدر إصدار جديد قريباً — لا نرشحها كخيار أول حالياً، استخدمها فقط إن كنت تفضّلها تحديداً.",
"setup.einsteinReviewOnly":"أريد مقاطع مراجعة التأسيس فقط (9 مقاطع) بدل الدورة الكاملة",
"setup.foundSkip":"تخطي التأسيس","setup.foundSkipDesc":"انتقال مباشر لمرحلة التدريب",
"setup.trainTitle":"القسم الكمي — التدريب (اختر ما يناسبك)",
"setup.monsif":"المنصف","setup.mufakkirSec":"المفكر (أقسام)","setup.mufakkirRep":"المفكر (الأكثر تكراراً)",
"setup.mufakkirRepDesc":"814 سؤال — ملخص سريع للإنجاز","setup.mufakkirRepSuffix":"سؤال — ملخص سريع للإنجاز","setup.moasserTrain":"تدريب المعاصر",
"setup.bank":"بنك","setup.section":"قسم","setup.q":"سؤال","setup.day":"يوم",
"setup.nightReview":"إضافة كتيّب «مراجعة ليلة الامتحان» من المعاصر إلى الجدول",
"setup.customVerbalEnable":"أضف مصدراً لفظياً مخصصاً (إضافي، اختياري)",
"setup.customQuantEnable":"أضف مصدراً كمياً مخصصاً (إضافي، اختياري)",
"setup.customName":"اسم المصدر (اختياري)","setup.customNamePh":"مثال: ملزمة الأستاذ فهد",
"setup.customOrigin":"من أين حصلت عليه؟ (اختياري)","setup.customOriginPh":"مثال: تيليجرام، تويتر...",
"setup.customUnit":"وحدة العد","setup.unitSection":"قسم","setup.unitBank":"بنك","setup.unitQuestion":"سؤال","setup.unitPage":"صفحة",
"setup.customTotal":"إجمالي العدد",
"setup.customQper":"عدد الأسئلة لكل وحدة (اختياري، للتوضيح فقط)","setup.customQperPh":"مثال: 10-12 سؤال",
"setup.customReportNote":"سيصل اسم هذا المصدر تلقائياً للمطوّر (دون أي بيانات شخصية أخرى) ليقيّم إضافته للتطبيق مستقبلاً إن كتبه عدة طلاب.",
"setup.intensity":"إيقاع الخطة",
"setup.compact":"مضغوطة","setup.balanced":"متوازنة","setup.relaxed":"مريحة","setup.custom":"مخصصة",
"setup.days":"مدة الخطة (بالأيام)","setup.examDate":"أو حدّد تاريخ اختبارك مباشرة (اختياري)",
"setup.dailyTime":"وقت المذاكرة اليومي","setup.hours":"ساعة","setup.minutes":"دقيقة",
"setup.breaksTitle":"إعدادات الاستراحة الذكية","setup.breaksDesc":"كل ساعة مذاكرة متواصلة، تبدأ استراحة تلقائية بالمدة التي تحددها هنا (ثابتة طوال جلساتك).",
"setup.sectionOrderTitle":"ترتيب الجلسة","setup.sectionOrderDesc":"يُقسَّم وقتك اليومي بين الكمي واللفظي تلقائياً — اختر أيهما تبدأ به دائماً، وسينتقل المؤقت للآخر تلقائياً عند انتهاء وقت الأول.",
"setup.startVerbal":"أبدأ باللفظي","setup.startQuant":"أبدأ بالكمي",
"setup.autoBreakLen":"مدة الاستراحة التلقائية (1-25 دقيقة)","setup.shortBreakCount":"عدد استراحات الـ5 دقائق المسموحة بالجلسة (0-3)",
"setup.build":"إنشاء الجدول ودخول التطبيق",
"alert.title":"أحسنت! انتهت الجلسة 🎯",
"alert.msg":"لقد أتممت جلسة تركيز رائعة. خذ نفساً عميقاً — استحققت استراحة قصيرة.",
"alert.continue":"متابعة",
"brand.tag":"رفيق القدرات",
"nav.dashboard":"الخطة والجدول","nav.calculator":"حساب الموزونة","nav.links":"الروابط المباشرة","nav.profile":"الملف الشخصي",
"nav.account":"الحساب والمزامنة","nav.specialties":"دليل التخصصات","nav.community":"المجتمع",
"nav.examSim":"اختبارات محاكية","nav.examSimShort":"اختبارات","nav.tutors":"مدرّسون خصوصيون","nav.tutorsShort":"مدرّسون",
"examsim.title":"اختبارات محاكية","examsim.sub":"تدرّب بنمط مطابق تماماً لاختبار قياس الفعلي — بوقت أو بدون وقت.","examsim.full":"اختبار قدرات كامل","examsim.verbalOnly":"لفظي فقط","examsim.quantOnly":"كمي فقط","examsim.timed":"بوقت (كالاختبار الحقيقي)","examsim.untimed":"بدون وقت","examsim.start":"ابدأ الاختبار",
"tutors.title":"مدرّسون خصوصيون","tutors.sub":"مُقيَّمون من طلاب حقيقيين — بالتواصل معنا فقط يُضاف أي مدرّس","tutors.add":"إضافة مدرّس",
"nav.tahsili":"التحصيلي","nav.step":"ستيب (STEP)","nav.soon":"قريباً",
"nav.dashboardShort":"الجدول","nav.calcShort":"الموزونة","nav.linksShort":"المصادر","nav.profileShort":"الملف",
"nav.specialtiesShort":"التخصصات","nav.communityShort":"المجتمع",
"progress.eyebrow":"مسار التقدم","progress.title":"أنت في الطريق الصحيح 🚀",
"progress.dayOf":"اليوم الحالي","progress.totalDays":"إجمالي الأيام","progress.remaining":"أيام متبقية","progress.tasksDone":"مهام مكتملة",
"table.title":"جدول مهامك المخصص","table.sub":"تُحسب الكميات تلقائياً بناءً على مدة خطتك","table.reset":"إعادة ضبط الخطة","table.editSources":"تعديل المصادر والخطة","table.freshStart":"بدء من جديد بالكامل",
"dash.customize":"تخصيص لوحتك","dash.customizeTitle":"تخصيص لوحتك","dash.customizeDesc":"اختر البطاقات التي تريد رؤيتها، ورتّبها من صفحة اللوحة نفسها بأسهم أعلى/أسفل.","dash.resetDefault":"إعادة الضبط الافتراضي","dash.done":"تم",
"dash.communityDesc":"نظرة سريعة — تفاصيل أكثر في صفحة المجتمع الكاملة","dash.openCommunity":"فتح صفحة المجتمع",
"table.path":"المسار","table.qty":"الكمية اليومية","table.status":"الحالة","table.progress":"نسبة الإنجاز","table.action":"إجراء",
"table.addTask":"إضافة مهمة يدوية",
"status.notStarted":"لم يبدأ ⏳","status.inProgress":"قيد التقدم 🔄","status.done":"مكتمل ✅",
"timer.eyebrow":"وضع التركيز العميق","timer.title":"التزم بجلستك 🔒",
"timer.desc":"سيصدر تنبيه هادئ عند انتهاء الوقت. اختر مدة الجلسة أو استخدم مدتك المحفوظة.",
"timer.desc2":"حالة مهامك اليوم تُحدَّث تلقائياً حسب التزامك بالجلسة — لا حاجة لتحديدها يدوياً.",
"timer.customH":"ساعات","timer.customM":"دقائق","timer.minutesLeft":"دقيقة متبقية",
"timer.planSession":"جلسة الخطة","timer.customSession":"مدة مخصصة (لا تقل عن جلستك الأساسية)","timer.break":"استراحة 5د",
"timer.pause":"إيقاف مؤقت","timer.resume":"استئناف","timer.stop":"إيقاف",
"timer.autoBreakLabel":"استراحة تلقائية 🍵","timer.shortBreakLabel":"استراحتك 🍵","timer.transitionBreakLabel":"استراحة الانتقال 🔄","timer.skipTransition":"تخطّي والبدء الآن","timer.mainSessionLabel":"دقيقة متبقية",
"timer.pauseWarn5":"⏸️ توقفت أكثر من 5 دقائق — أكمل جلستك قريباً وإلا سيُعتبر يومك غير مكتمل.",
"timer.pauseWarn10":"💔 توقفت 10 دقائق — انتهت الجلسة، ستحتاج لإعادة حصة اليوم من جديد.",
"timer.sessionComplete":"🎉 أحسنت! أكملت جلستك بالكامل — كل مهامك اليوم أصبحت مكتملة.",
"timer.sessionFailed":"لم تكتمل الجلسة اليوم بسبب توقف طويل — أعد المحاولة عندما تكون جاهزاً.",
"timer.shortBreakUsedUp":"استنفدت عدد استراحات الـ5 دقائق المسموحة لهذه الجلسة.",
"timer.customTooShort":"لا يمكن أن تكون المدة المخصصة أقل من جلستك الأساسية ({base} دقيقة).",
"timer.minRequired":"الحد الأدنى: {base} دقيقة (جلستك الأساسية)",
"calc.title":"حاسبة الموزونة","calc.sub":"مطابقة لصيغ أغلب الجامعات السعودية — راجع بوابة القبول الموحد للتأكيد",
"calc.modeWeighted":"حاسبة الموزونة","calc.modeGpa":"حاسبة المعدل التراكمي",
"gpa.title":"حاسبة المعدل التراكمي للثانوي","gpa.sub":"أضف موادك ودرجاتها وعدد ساعاتها المعتمدة لحساب معدلك المرجّح",
"gpa.subject":"المادة","gpa.score":"الدرجة (من 100)","gpa.hours":"عدد الساعات","gpa.addSubject":"إضافة مادة","gpa.calc":"احسب المعدل","gpa.yourAvg":"معدلك المرجّح",
"gpa.autoDisclaimer":"التعبئة التلقائية أدناه تقديرية بناءً على نظام المسارات العام — الحصص قد تختلف قليلاً حسب مدرستك، فعدّلها إن لزم لتطابق كشف درجاتك الفعلي في نظام نور.",
"gpa.grade":"الصف الدراسي","gpa.grade1":"أول ثانوي (السنة المشتركة)","gpa.grade2":"ثاني ثانوي","gpa.grade3":"ثالث ثانوي",
"gpa.semester":"الفصل الدراسي","gpa.sem1":"الفصل الأول","gpa.sem2":"الفصل الثاني","gpa.sem3":"الفصل الثالث",
"gpa.track":"المسار","gpa.trackGeneral":"المسار العام","gpa.trackSharia":"المسار الشرعي","gpa.trackBusiness":"مسار إدارة الأعمال","gpa.trackHealth":"مسار الصحة والحياة","gpa.trackCs":"مسار الحاسب والهندسة",
"gpa.autofill":"تعبئة موادي تلقائياً",
"gpa.saveYear":"حفظ هذا كمعدل السنة المحددة أعلاه",
"gpa.finalTitle":"النسبة النهائية للثانوية","gpa.finalSub":"تُحسب من معدلات السنوات الثلاث المحفوظة، مرجّحة حسب وزن كل سنة (20% + 40% + 40% افتراضياً)",
"gpa.year1":"أول ثانوي","gpa.year2":"ثاني ثانوي","gpa.year3":"ثالث ثانوي",
"gpa.calcFinal":"احسب النسبة النهائية","gpa.finalResultLabel":"نسبتك النهائية في الثانوية",
"gpa.quickTitle":"إدخال سريع (إن كانت نسبك جاهزة)","gpa.quickSub":"تعرف نسبتك في كل سنة مسبقاً؟ أدخلها مباشرة هنا بدل حاسبة المواد أعلاه","gpa.quickSave":"حفظ النسب الثلاث دفعة واحدة",
"calc.uniLabel":"اختر جامعتك","calc.high":"نسبة الثانوية (%)","calc.qat":"درجة القدرات","calc.tah":"درجة التحصيلي",
"calc.includeStep":"تضمين درجة STEP","calc.weightsNote":"الأوزان (يمكنك تعديلها يدوياً) — يجب أن يكون مجموعها 100%",
"calc.wHigh":"وزن الثانوية","calc.wQat":"وزن القدرات","calc.wTah":"وزن التحصيلي","calc.wStep":"وزن STEP",
"calc.calc":"احسب الموزونة","calc.yourScore":"نسبتك الموزونة",
"calc.stepRequired":"يتطلب STEP","calc.stepNotRequired":"لا يتطلب STEP","calc.stepMaybe":"قد يتطلب STEP لبعض البرامج",
"calc.weightsError":"⚠️ مجموع الأوزان يجب أن يكون 100% (المجموع الحالي: {sum}%)",
"calc.lastUpdated":"آخر تحديث للبيانات",
"links.title":"مصادرك بضغطة واحدة","links.sub":"روابط مباشرة ومحدثة لكل مصدر تعتمده في خطتك",
"links.ehab":"دورة إيهاب (اللفظي)","links.monsif":"المنصف (بنوك الكمي)","links.moasser":"المعاصر","links.mufakkir":"المفكر",
"contact.title":"تواصل معنا","contact.sub":"للاستفسارات والشكاوى والمتابعة",
"contact.whatsapp":"واتساب للاستفسارات والشكاوى","contact.tiktok":"تابعنا على تيك توك","contact.tiktokSub":"آخر التحديثات والدعم",
"contact.telegram":"قناتنا على تيليجرام","contact.telegramSub":"إعلانات وتحديثات فورية",
"contact.support":"ادعم استمرار الموقع",
"profile.title":"الملف الشخصي","profile.noGoal":"لم تحدد جامعة الهدف بعد",
"profile.first":"الاسم الأول","profile.last":"اللقب","profile.birth":"تاريخ الميلاد",
"profile.gender":"الجنس","profile.male":"طالب","profile.female":"طالبة",
"profile.track":"المسار الدراسي","profile.science":"علمي","profile.admin":"إداري","profile.humanities":"شرعي/أدبي",
"profile.goalUni":"جامعة الهدف","profile.goalScore":"النسبة المستهدفة (%)","profile.examDate":"تاريخ اختبارك","profile.save":"حفظ التعديلات",
"profile.noneOption":"غير محدد",
"badges.title":"أوسمتك وإنجازاتك","badges.sub":"تحفيزية بحتة — لا علاقة لها بنسبة تقدمك الفعلية في الخطة",
"shield.title":"دروع حماية السلسلة","shield.sub":"يحمي درع سلسلتك تلقائياً أول يوم تفوّته — لديك:","shield.buy":"اشترِ (100 XP)",
"theme.title":"لون التطبيق","theme.sub":"اختر اللون الذي يناسب ذوقك",
"theme.fontSizeLabel":"حجم الخط","theme.fontSmall":"صغير","theme.fontMedium":"متوسط (افتراضي)","theme.fontLarge":"كبير",
"lang.title":"لغة الموقع","lang.sub":"اختر لغة عرض الموقع",
"stats.title":"إحصائياتك","stats.sub":"نظرة عامة على مذاكرتك الفعلية حتى الآن",
"stats.totalHours":"إجمالي الساعات","stats.totalLessons":"دروس/بنوك منجزة","stats.commitRate":"نسبة الالتزام","stats.pace":"متوسط الوقت لكل درس",
"feedback.title":"ملاحظاتك تصلني مباشرة",
"feedback.sub":"اكتب اقتراحك أو المشكلة التي واجهتك — تُرسل بضغطة واحدة دون أي خطوات إضافية",
"feedback.placeholder":"مثال: أتمنى إضافة...","feedback.send":"إرسال الملاحظة",
"feedback.empty":"اكتب ملاحظتك أولاً قبل الإرسال","feedback.opened":"تم فتح تطبيق البريد — أكمل الإرسال من هناك",
"feedback.error":"تعذر الإرسال، حاول مرة أخرى أو راسلنا مباشرة","feedback.successTitle":"وصلتنا ملاحظتك! 🎉","feedback.successMsg":"شكراً لك، سنأخذها بعين الاعتبار.",
"footer.builtWith":"صُنع بعناية لطلاب المملكة",
"footer.by":"بواسطة",
"toast.saved":"تم الحفظ بنجاح ✅","toast.taskAdded":"تمت إضافة المهمة","toast.taskRemoved":"تم حذف المهمة",
"toast.planReady":"خطتك جاهزة! بالتوفيق 🚀",
"welcome":"أهلاً بك يا {name} 🚀",
"streak.label":"يوم متتالي 🔥",
"days.day":"يوم",
"account.title":"الحساب والمزامنة","account.sub":"استخدم خُطى كضيف تماماً بدون حساب — أنشئ حساباً فقط إن أردت حفظ تقدمك ونقله لجهاز آخر",
"account.username":"اسم المستخدم","account.password":"كلمة المرور","account.password2":"تأكيد كلمة المرور",
"account.signin":"تسجيل الدخول","account.signup":"إنشاء حساب جديد","account.createBtn":"إنشاء الحساب",
"account.note":"لا نطلب بريدك الإلكتروني — فقط اسم مستخدم وكلمة مرور يخصّانك أنت.",
"account.syncNow":"مزامنة الآن","account.signout":"تسجيل الخروج",
"account.changePass":"تغيير كلمة المرور","account.newPass":"كلمة المرور الجديدة","account.newPass2":"تأكيد كلمة المرور الجديدة","account.savePass":"حفظ كلمة المرور الجديدة",
"account.linkEmail":"ربط بريد لاسترجاع كلمة المرور","account.linkEmailDesc":"اربط بريدك الحقيقي مرة واحدة لتتمكّن من استرجاع كلمة المرور مستقبلاً إن نسيتها. سنرسل رابط تأكيد لهذا البريد — لن يكون فعّالاً إلا بعد الضغط عليه.","account.realEmail":"بريدك الإلكتروني الحقيقي","account.sendLink":"إرسال رابط التأكيد",
"account.forgotPass":"نسيت كلمة المرور؟","account.forgotPassDesc":"يعمل فقط إن كنت قد ربطت بريداً حقيقياً بحسابك سابقاً من الملف الشخصي. أدخله هنا وسنرسل لك رابط إعادة تعيين كلمة المرور.","account.sendResetLink":"إرسال رابط إعادة التعيين",
"account.setNewPassTitle":"عيّن كلمة مرور جديدة","account.setNewPassDesc":"وصلت هنا عبر رابط إعادة تعيين كلمة المرور — اكتب كلمة مرورك الجديدة.",
"account.noRecoveryNote":"⚠️ تذكير: حسابات اسم المستخدم لا تدعم استرجاع كلمة مرور منسية (لا نطلب بريدك الحقيقي أبداً) — احفظها في مكان آمن. بياناتك المحلية على جهازك تبقى آمنة دائماً بغض النظر.",
"spec.title":"دليل التخصصات الذكي","spec.sub":"نظرة عامة تعريفية — راجع مواقع الجامعات لتفاصيل كل كلية بدقة","spec.search":"ابحث عن تخصص...",
"room.title":"غرفة المذاكرة","room.sub":"لست وحدك — بدون شات، فقط إحساس بالرفقة","room.studying":"طالب يذاكر الآن معك",
"lb.title":"لوحة الصدارة الأسبوعية","lb.sub":"اختياري بالكامل — شارك نقاطك التحفيزية إن أردت","lb.share":"شارِك اسمي ونقاطي في لوحة الصدارة",
"forum.title":"حائط الأسئلة السريعة","forum.sub":"اسأل، وأجب على زملائك","forum.placeholder":"اكتب سؤالك هنا...",
"tpl.title":"قوالب الخطط من الطلاب","tpl.sub":"استفد من خطط طلاب آخرين، أو شارك خطتك الحالية ليستفيد منها غيرك",
"tpl.publish":"نشر خطتي الحالية كقالب","tpl.formTitle":"عنوان القالب","tpl.formTitlePh":"مثال: خطة مكثفة لمدة 30 يوماً",
"tpl.previewLabel":"معاينة تفاصيل خطتك (تُنقل تلقائياً لمن يستخدم القالب)",
"tpl.formDesc":"ملاحظات إضافية (اختياري) — أي تفاصيل يدوية تريد إضافتها","tpl.confirmPublish":"نشر",
"bot.title":"مساعد خُطى للأسئلة الشائعة","bot.disclaimer":"إجابات جاهزة مبرمجة مسبقاً وليست ذكاءً اصطناعياً حقيقياً","bot.placeholder":"اكتب سؤالك...",
},
en:{
"login.tagline":"Your smart companion for the Qudrat journey",
"login.google":"Continue with Google","login.apple":"Continue with Apple","login.or":"or","login.guest":"Continue as guest, no account",
"login.first":"First name","login.firstPh":"e.g. Rakan",
"login.last":"Last name","login.lastPh":"e.g. Alharbi",
"login.next":"Next: customize my plan",
"setup.title":"Customize your Qudrat study tracks",
"setup.subtitle":"Pick your preferred sources and we'll build a precisely calculated schedule",
"setup.verbalTitle":"Verbal Section",
"setup.verbalDesc":"Ehab's course (215 sections) is your only track for Verbal.",
"setup.foundTitle":"Quantitative — Foundation",
"setup.foundMoasser":"Al-Moaasir Book 10","setup.foundMoasserDesc":"30-day challenge, ~8 pages a day",
"setup.foundEinstein":"Einstein","setup.foundEinsteinDesc":"57 video lectures (~1 hour each)",
"setup.einsteinWarning":"Einstein's course is somewhat dated and a refreshed version is coming soon — not our top recommendation right now, use it only if you specifically prefer it.",
"setup.einsteinReviewOnly":"I want the foundation review videos only (9 videos) instead of the full course",
"setup.foundSkip":"Skip foundation","setup.foundSkipDesc":"Go straight to training",
"setup.trainTitle":"Quantitative — Training (pick what suits you)",
"setup.monsif":"Al-Monsif","setup.mufakkirSec":"Al-Mufakkir (sections)","setup.mufakkirRep":"Al-Mufakkir (most repeated)",
"setup.mufakkirRepDesc":"814 questions — a fast-track summary","setup.mufakkirRepSuffix":"questions — a fast-track summary","setup.moasserTrain":"Al-Moaasir training",
"setup.bank":"bank","setup.section":"section","setup.q":"question","setup.day":"day",
"setup.nightReview":"Add Al-Moaasir's \"exam-eve review\" booklet to the schedule",
"setup.customVerbalEnable":"Add a custom verbal source (extra, optional)",
"setup.customQuantEnable":"Add a custom quant source (extra, optional)",
"setup.customName":"Source name (optional)","setup.customNamePh":"e.g. Mr. Fahad's handout",
"setup.customOrigin":"Where did you get it? (optional)","setup.customOriginPh":"e.g. Telegram, Twitter...",
"setup.customUnit":"Counting unit","setup.unitSection":"section","setup.unitBank":"bank","setup.unitQuestion":"question","setup.unitPage":"page",
"setup.customTotal":"Total count",
"setup.customQper":"Questions per unit (optional, for reference only)","setup.customQperPh":"e.g. 10-12 questions",
"setup.customReportNote":"This source's name will be sent to the developer automatically (no other personal data) to help evaluate adding it officially if several students enter it.",
"setup.intensity":"Plan pace",
"setup.compact":"Compact","setup.balanced":"Balanced","setup.relaxed":"Relaxed","setup.custom":"Custom",
"setup.days":"Plan duration (days)","setup.examDate":"Or set your exam date directly (optional)",
"setup.dailyTime":"Daily study time","setup.hours":"hr","setup.minutes":"min",
"setup.breaksTitle":"Smart Break Settings","setup.breaksDesc":"Every hour of continuous study, an automatic break starts at the duration you set here (fixed across all your sessions).",
"setup.sectionOrderTitle":"Session Order","setup.sectionOrderDesc":"Your daily time splits automatically between Quant and Verbal — pick which one you always start with; the timer switches to the other automatically when the first finishes.",
"setup.startVerbal":"Start with Verbal","setup.startQuant":"Start with Quant",
"setup.autoBreakLen":"Auto-break duration (1-25 min)","setup.shortBreakCount":"5-min breaks allowed per session (0-3)",
"setup.build":"Build schedule & enter the app",
"alert.title":"Nicely done! Session complete 🎯",
"alert.msg":"You finished a great focus session. Take a deep breath — you've earned a short break.",
"alert.continue":"Continue",
"brand.tag":"QUDRAT COMPANION",
"nav.dashboard":"Plan & Schedule","nav.calculator":"Weighted Score","nav.links":"Quick Links","nav.profile":"Profile",
"nav.account":"Account & Sync","nav.specialties":"Specialty Guide","nav.community":"Community",
"nav.examSim":"Exam Simulator","nav.examSimShort":"Exams","nav.tutors":"Private Tutors","nav.tutorsShort":"Tutors",
"examsim.title":"Exam Simulator","examsim.sub":"Practice in a format that exactly matches the real Qiyas exam — timed or untimed.","examsim.full":"Full Qudrat exam","examsim.verbalOnly":"Verbal only","examsim.quantOnly":"Quant only","examsim.timed":"Timed (like the real exam)","examsim.untimed":"Untimed","examsim.start":"Start exam",
"tutors.title":"Private Tutors","tutors.sub":"Rated by real students — tutors are only added by contacting us","tutors.add":"Add tutor",
"nav.tahsili":"Tahsili","nav.step":"STEP","nav.soon":"Soon",
"nav.dashboardShort":"Schedule","nav.calcShort":"Score","nav.linksShort":"Sources","nav.profileShort":"Profile",
"nav.specialtiesShort":"Majors","nav.communityShort":"Community",
"progress.eyebrow":"Progress path","progress.title":"You're on track 🚀",
"progress.dayOf":"Current day","progress.totalDays":"Total days","progress.remaining":"Days left","progress.tasksDone":"Tasks done",
"table.title":"Your custom task schedule","table.sub":"Quantities are calculated automatically from your plan length","table.reset":"Reset plan","table.editSources":"Edit sources & plan","table.freshStart":"Start completely fresh",
"dash.customize":"Customize dashboard","dash.customizeTitle":"Customize Your Dashboard","dash.customizeDesc":"Choose which cards to show, and reorder them from the dashboard page using the up/down arrows.","dash.resetDefault":"Reset to default","dash.done":"Done",
"dash.communityDesc":"Quick glance — more detail on the full Community page","dash.openCommunity":"Open Community page",
"table.path":"Track","table.qty":"Daily amount","table.status":"Status","table.progress":"Progress","table.action":"Action",
"table.addTask":"Add manual task",
"status.notStarted":"Not started ⏳","status.inProgress":"In progress 🔄","status.done":"Done ✅",
"timer.eyebrow":"Deep focus mode","timer.title":"Commit to your session 🔒",
"timer.desc":"A gentle chime plays when time is up. Pick a session length or use your saved duration.",
"timer.desc2":"Today's task status updates automatically based on your commitment — no need to set it manually.",
"timer.customH":"Hours","timer.customM":"Minutes","timer.minutesLeft":"minutes left",
"timer.planSession":"Plan session","timer.customSession":"Custom session (can't be less than your base session)","timer.break":"5-min break",
"timer.pause":"Pause","timer.resume":"Resume","timer.stop":"Stop",
"timer.autoBreakLabel":"Auto break 🍵","timer.shortBreakLabel":"Your break 🍵","timer.transitionBreakLabel":"Transition break 🔄","timer.skipTransition":"Skip & start now","timer.mainSessionLabel":"minutes left",
"timer.pauseWarn5":"⏸️ You've been paused over 5 minutes — resume soon or today will count as incomplete.",
"timer.pauseWarn10":"💔 Paused for 10 minutes — session ended, you'll need to redo today's session.",
"timer.sessionComplete":"🎉 Well done! You completed your full session — all of today's tasks are now done.",
"timer.sessionFailed":"Today's session didn't complete due to a long pause — try again when you're ready.",
"timer.shortBreakUsedUp":"You've used up your allowed 5-minute breaks for this session.",
"timer.customTooShort":"Custom duration can't be less than your base session ({base} min).",
"timer.minRequired":"Minimum: {base} min (your base session)",
"calc.title":"Weighted Score Calculator","calc.sub":"Matches most Saudi university formulas — verify on the unified admission portal",
"calc.modeWeighted":"Weighted Score","calc.modeGpa":"GPA Calculator",
"gpa.title":"High School GPA Calculator","gpa.sub":"Add your subjects, scores and credit hours to compute a weighted average",
"gpa.subject":"Subject","gpa.score":"Score (out of 100)","gpa.hours":"Credit hours","gpa.addSubject":"Add subject","gpa.calc":"Calculate","gpa.yourAvg":"Your weighted average",
"gpa.autoDisclaimer":"The auto-fill below is an estimate based on the general Pathways system — hours may vary slightly by school, so adjust them to match your actual Noor system record.",
"gpa.grade":"Grade","gpa.grade1":"1st Secondary (Common Year)","gpa.grade2":"2nd Secondary","gpa.grade3":"3rd Secondary",
"gpa.semester":"Semester","gpa.sem1":"Semester 1","gpa.sem2":"Semester 2","gpa.sem3":"Semester 3",
"gpa.track":"Track","gpa.trackGeneral":"General Track","gpa.trackSharia":"Sharia Track","gpa.trackBusiness":"Business Track","gpa.trackHealth":"Health & Life Track","gpa.trackCs":"Computer Science & Engineering Track",
"gpa.autofill":"Auto-fill my subjects",
"gpa.saveYear":"Save this as the selected year's average",
"gpa.finalTitle":"Final High-School Percentage","gpa.finalSub":"Computed from the three saved year averages, weighted by year (20% + 40% + 40% by default)",
"gpa.year1":"1st Secondary","gpa.year2":"2nd Secondary","gpa.year3":"3rd Secondary",
"gpa.calcFinal":"Calculate final percentage","gpa.finalResultLabel":"Your final high-school percentage",
"gpa.quickTitle":"Quick Entry (if your percentages are ready)","gpa.quickSub":"Already know your percentage for each year? Enter it directly here instead of the subject calculator above","gpa.quickSave":"Save all three percentages at once",
"calc.uniLabel":"Choose your university","calc.high":"High-school % (%)","calc.qat":"Qudrat (GAT) score","calc.tah":"Tahsili score",
"calc.includeStep":"Include STEP score","calc.weightsNote":"Weights (editable) — must total 100%",
"calc.wHigh":"High-school weight","calc.wQat":"Qudrat weight","calc.wTah":"Tahsili weight","calc.wStep":"STEP weight",
"calc.calc":"Calculate","calc.yourScore":"Your weighted score",
"calc.stepRequired":"STEP required","calc.stepNotRequired":"STEP not required","calc.stepMaybe":"May be required for some programs",
"calc.weightsError":"⚠️ Weights must total 100% (current total: {sum}%)",
"calc.lastUpdated":"Data last updated",
"links.title":"Your sources, one tap away","links.sub":"Direct, up-to-date links for every source in your plan",
"links.ehab":"Ehab's course (Verbal)","links.monsif":"Al-Monsif (Quant banks)","links.moasser":"Al-Moaasir","links.mufakkir":"Al-Mufakkir",
"contact.title":"Contact us","contact.sub":"For questions and complaints",
"contact.whatsapp":"WhatsApp for questions & complaints","contact.tiktok":"Follow us on TikTok","contact.tiktokSub":"Latest updates & support",
"contact.telegram":"Our Telegram channel","contact.telegramSub":"Instant announcements & updates",
"contact.support":"Support the site",
"profile.title":"Profile","profile.noGoal":"No target university set yet",
"profile.first":"First name","profile.last":"Last name","profile.birth":"Date of birth",
"profile.gender":"Gender","profile.male":"Male","profile.female":"Female",
"profile.track":"Track","profile.science":"Science","profile.admin":"Business","profile.humanities":"Sharia/Humanities",
"profile.goalUni":"Target university","profile.goalScore":"Target score (%)","profile.examDate":"Your exam date","profile.save":"Save changes",
"profile.noneOption":"Not set",
"badges.title":"Your Badges & Achievements","badges.sub":"Purely motivational — unrelated to your actual plan progress",
"shield.title":"Streak Shields","shield.sub":"A shield auto-protects your streak the first day you miss — you have:","shield.buy":"Buy (100 XP)",
"theme.title":"App color","theme.sub":"Pick the color that suits you",
"theme.fontSizeLabel":"Font size","theme.fontSmall":"Small","theme.fontMedium":"Medium (default)","theme.fontLarge":"Large",
"lang.title":"Site Language","lang.sub":"Choose the display language",
"stats.title":"Your Stats","stats.sub":"An overview of your actual studying so far",
"stats.totalHours":"Total Hours","stats.totalLessons":"Lessons/banks done","stats.commitRate":"Commitment rate","stats.pace":"Avg. time per lesson",
"feedback.title":"Your feedback reaches me directly",
"feedback.sub":"Write your suggestion or issue — sent with one tap, no extra steps",
"feedback.placeholder":"e.g. I'd love to see...","feedback.send":"Send feedback",
"feedback.empty":"Write your note before sending","feedback.opened":"Your mail app has opened — finish sending from there",
"feedback.error":"Couldn't send — try again or email us directly","feedback.successTitle":"Got your feedback! 🎉","feedback.successMsg":"Thank you — we'll take it into account.",
"footer.builtWith":"Crafted with care for students across the Kingdom",
"footer.by":"By",
"toast.saved":"Saved successfully ✅","toast.taskAdded":"Task added","toast.taskRemoved":"Task removed",
"toast.planReady":"Your plan is ready! Good luck 🚀",
"welcome":"Welcome, {name} 🚀",
"streak.label":"day streak 🔥",
"days.day":"day",
"account.title":"Account & Sync","account.sub":"Use Khuta fully as a guest, no account needed — only create one to save & carry your progress to another device",
"account.username":"Username","account.password":"Password","account.password2":"Confirm password",
"account.signin":"Sign in","account.signup":"Create new account","account.createBtn":"Create account",
"account.note":"We never ask for your email — just a username and password of your own.",
"account.syncNow":"Sync now","account.signout":"Sign out",
"account.changePass":"Change password","account.newPass":"New password","account.newPass2":"Confirm new password","account.savePass":"Save new password",
"account.linkEmail":"Link email for password recovery","account.linkEmailDesc":"Link your real email once so you can recover your password later if forgotten. We'll send a confirmation link to it — it only takes effect once clicked.","account.realEmail":"Your real email","account.sendLink":"Send confirmation link",
"account.forgotPass":"Forgot password?","account.forgotPassDesc":"Only works if you previously linked a real email to your account from Profile. Enter it here and we'll send a password reset link.","account.sendResetLink":"Send reset link",
"account.setNewPassTitle":"Set a new password","account.setNewPassDesc":"You arrived here via a password reset link — enter your new password.",
"account.noRecoveryNote":"⚠️ Reminder: username accounts don't support forgotten-password recovery (we never ask for your real email) — save it somewhere safe. Your local data on this device stays safe regardless.",
"spec.title":"Smart Specialty Guide","spec.sub":"A general overview — check university sites for exact college details","spec.search":"Search a major...",
"room.title":"Study Room","room.sub":"You're not alone — no chat, just a sense of company","room.studying":"student(s) studying with you now",
"lb.title":"Weekly Leaderboard","lb.sub":"Fully optional — share your motivational points if you'd like","lb.share":"Share my name & points on the leaderboard",
"forum.title":"Quick Questions Wall","forum.sub":"Ask, and help your classmates","forum.placeholder":"Write your question here...",
"tpl.title":"Student Plan Templates","tpl.sub":"Benefit from other students' plans, or share your current one",
"tpl.publish":"Publish my current plan as a template","tpl.formTitle":"Template title","tpl.formTitlePh":"e.g. Intensive 30-day plan",
"tpl.previewLabel":"Preview of your plan details (auto-transfers to anyone who uses this template)",
"tpl.formDesc":"Extra notes (optional) — any manual details you'd like to add","tpl.confirmPublish":"Publish",
"bot.title":"Khuta FAQ Assistant","bot.disclaimer":"Pre-programmed answers, not real AI","bot.placeholder":"Type your question...",
}
};

let currentLang = localStorage.getItem("khuta_lang") || "ar";

function t(key, vars){
    let str = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.ar[key]) || key;
    if(vars){ Object.keys(vars).forEach(k => { str = str.replace("{"+k+"}", vars[k]); }); }
    return str;
}

function applyI18n(){
    document.documentElement.lang = currentLang === "ar" ? "ar" : "en";
    document.documentElement.dir = currentLang === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("lang-en", currentLang === "en");

    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
        el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph")));
    });

    document.getElementById("lang-ar-btn").classList.toggle("active", currentLang === "ar");
    document.getElementById("lang-en-btn").classList.toggle("active", currentLang === "en");

    populateUniSelects();
    buildScheduleTable();
    renderProgress();
    updateWelcomeText();
    applyContentNumbers();
    renderGamification();
    renderBadges();
    updateShortBreakLabel();
}

function applyContentNumbers(){
    const c = getContent();
    const set = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
    set("setup-verbal-desc", currentLang === "ar"
        ? `دورة إيهاب (${c.ehab.totalSections} قسم) هي مسارك الوحيد والمعتمد للفظي.`
        : `Ehab's course (${c.ehab.totalSections} sections) is your only track for Verbal.`);
    set("cnt-monsif-banks", c.monsif.totalBanks);
    set("cnt-monsif-qrange", c.monsif.questionsPerBankLabel);
    set("cnt-mufakkir-sections", c.mufakkirSections.total);
    set("cnt-mufakkir-qper", c.mufakkirSections.questionsPerSectionLabel);
    set("cnt-mufakkir-rep", c.mufakkirRepeated.total);
    set("cnt-moasser-banks", c.moasserTraining.totalBanks);
    set("cnt-moasser-qrange", c.moasserTraining.questionsPerBankLabel);
    set("content-updated-label", (currentLang === "ar" ? "آخر تحديث للتجميعات: " : "Tracks last updated: ") + c.lastUpdated);
}

function setLang(lang){
    currentLang = lang;
    localStorage.setItem("khuta_lang", lang);
    applyI18n();
}

/* ============================================================
   3) أدوات عامة
   ============================================================ */
function showToast(msg){
    const toast = document.getElementById("toast");
    document.getElementById("toast-text").textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    // مدة أطول للرسائل الأطول حتى يتسنى قراءتها فعلياً قبل اختفائها
    const duration = Math.max(5000, Math.min(9000, msg.length * 80));
    showToast._t = setTimeout(() => toast.classList.remove("show"), duration);
}

function uniName(u){ return currentLang === "ar" ? u.name : u.nameEn; }
function uniNote(u){ return currentLang === "ar" ? u.note : u.noteEn; }
function uniCity(u){ return (currentLang === "ar" || !u.cityEn) ? u.city : u.cityEn; }

function getUniversitiesList(){
    // يدمج قائمة الجامعات المدمجة مع أي بيانات خارجية محدّثة تم جلبها (إن وجدت)
    return window.__REMOTE_UNIS__ && window.__REMOTE_UNIS__.length ? window.__REMOTE_UNIS__ : UNIVERSITIES;
}

async function tryLoadUniversitiesFromSupabase(){
    if(!sb) return;
    try{
        const { data, error } = await sb.from("universities").select("*").order("sort_order");
        if(error || !data || !data.length) return;
        window.__REMOTE_UNIS__ = data.map(row => ({
            id: row.id, name: row.name, nameEn: row.name_en, city: row.city, cityEn: row.city_en, type: row.type,
            weights: row.weight_high == null ? null : {
                high: row.weight_high, qat: row.weight_qat, tah: row.weight_tah,
                ...(row.weight_step != null ? { step: row.weight_step } : {})
            },
            step: row.step === "true" ? true : row.step === "false" ? false : "partial",
            stepMin: row.step_min, comp: row.comp, note: row.note, noteEn: row.note_en,
        }));
        populateUniSelects();
    }catch(e){ console.error("[خُطى] تعذّر جلب الجامعات من Supabase:", e); }
}

async function tryLoadRemoteUniversities(){
    if(!REMOTE_UNIVERSITIES_URL) return;
    try{
        const res = await fetch(REMOTE_UNIVERSITIES_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(Array.isArray(json) && json.length){
            window.__REMOTE_UNIS__ = json;
            populateUniSelects();
        }
    }catch(e){ /* تجاهل بصمت — نستمر بالبيانات المدمجة محلياً */ }
}

/* ============================================================
   4) الساعة والتاريخ الحيّان
   ============================================================ */
setInterval(() => {
    const now = new Date();
    const locale = currentLang === "ar" ? "ar-SA" : "en-US";
    document.getElementById("live-clock").textContent = now.toLocaleTimeString(locale, {hour:"2-digit", minute:"2-digit", second:"2-digit"});
    document.getElementById("live-date").textContent = now.toLocaleDateString(locale, { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}, 1000);

/* ============================================================
   5) تسجيل الدخول والتخصيص
   ============================================================ */
window.onload = () => {
    applyI18n();
    ensureTaskStatusFreshToday();
    tryLoadUniversitiesFromSupabase();
    tryLoadRemoteUniversities();
    tryLoadRemoteContent();
    tryLoadRemoteCurriculum();
    tryLoadRemoteSpecialties();
    checkDevPanel();
    initContactLinks();
    checkAbandonedSession();
    renderGamification();
    checkBadges();
    restoreSession();
    checkAdminStatus();
    renderAccountUI();
    checkExamReminder();

    if(localStorage.getItem("khuta_theme") === "dark"){
        document.body.classList.add("dark-mode");
    }
    setAccent(localStorage.getItem("khuta_accent") || "");
    setFontSize(localStorage.getItem("khuta_fontsize") || "medium");
    if(localStorage.getItem("khuta_sidebar_collapsed") === "1"){
        document.getElementById("app-container").classList.add("sidebar-collapsed");
    }

    const session = getSession();
    const name = localStorage.getItem("khuta_name");
    if(!session && !name){
        document.getElementById("login-overlay").style.display = "flex";
    } else {
        updateWelcomeText();
        loadProfileForm();
        finishLoginBoot();
    }
};

function updateWelcomeText(){
    const name = localStorage.getItem("khuta_name");
    if(name) document.getElementById("welcome-text").textContent = t("welcome", {name});
}

/* ============================================================
   بدء من جديد بالكامل — يمسح كل ما يخص "الخطة الحالية" فقط (المصادر،
   الجدول، مسار التقدم، السلسلة)، ويحافظ عمداً على كل ما هو "إنجاز شخصي
   دائم" للطالب: نقاط الخبرة (XP)، الأوسمة/التروفيات، عدد الدروس المُنجزة
   مدى الحياة، دروع الحماية، الإحصائيات الكلية، ملفه الشخصي، ومشاركاته في
   المجتمع (حائط الأسئلة والقوالب — هذه أصلاً مخزَّنة في Supabase وليس
   محلياً، فلا يمسها هذا التصفير إطلاقاً بغض النظر).
   ============================================================ */
function confirmFreshStart(){
    if(!confirm(currentLang==='ar'
        ? "⚠️ سيُعاد ضبط جدولك ومصادرك ومسار تقدمك وسلسلتك بالكامل من الصفر — كأنك تبدأ اليوم الأول. نقاط الـXP وأوسمتك وإحصائياتك ومشاركاتك في المجتمع ستبقى محفوظة كما هي. هذا الإجراء لا يمكن التراجع عنه. متابعة؟"
        : "⚠️ Your schedule, sources, progress path, and streak will fully reset — as if starting day one. Your XP, badges, stats, and community posts stay intact. This can't be undone. Continue?")) return;
    performFreshStart();
}
function performFreshStart(){
    const todayStr = new Date().toDateString();
    const keysToWipe = [
        "khuta_config", "khuta_plan_days", "khuta_plan_start", "khuta_session_minutes",
        "khuta_task_status", "khuta_task_status_date", "khuta_xp_awarded_today",
        "khuta_completed_dates", "khuta_missed_days_count", "khuta_redday_tracking_start",
        "khuta_today_scale", "khuta_streak", "khuta_streak_last",
        "khuta_checkin_verbal", "khuta_checkin_quant", "khuta_quant_share",
        "khuta_last_session_minutes", "khuta_custom_tasks", "khuta_start_section",
        "khuta_session_active", "khuta_exam_date", "khuta_dev_day_offset",
        "khuta_autobreak_minutes", "khuta_short_break_limit",
        "khuta_exam_reminder_shown_" + todayStr, "khuta_short_break_used_" + todayStr,
        "khuta_nightowl_count", "khuta_earlybird_count",
    ];
    keysToWipe.forEach(k => localStorage.removeItem(k));
    // نُبقي عمداً: khuta_xp, khuta_badges, khuta_lifetime_*_done, khuta_shields,
    // khuta_total_minutes, khuta_daily_minutes_log, بيانات الملف الشخصي، تفضيلات اللغة/الثيم
    showToast(currentLang==='ar' ? "🔄 بدأنا من جديد — لنبنِ خطتك من الصفر" : "🔄 Starting fresh — let's build your plan from scratch");
    debouncedSync();
    // ⚠️ نتجنّب location.reload() هنا عمداً: كان أحياناً يُظهر شاشة تسجيل الدخول
    // خطأً بسبب توقيت فحص جلسة الحساب عند التحميل من جديد. بدلاً من ذلك نحدّث
    // الواجهة مباشرة وننتقل لمعالج تخصيص الخطة دون أي إعادة تحميل للصفحة إطلاقاً.
    document.querySelectorAll(".overlay-screen").forEach(el => { el.style.display = "none"; });
    buildScheduleTable();
    renderProgress();
    renderGamification();
    renderBadges();
    switchTab("dashboard");
    setTimeout(() => { document.getElementById("setup-overlay").style.display = "flex"; restoreSetupForm(); }, 500);
}

function openSetupOverlay(){
    document.getElementById("setup-overlay").style.display = "flex";
    restoreSetupForm();
}

function toggleSelection(element, type){
    // يُستخدم الآن لبطاقات الاختيار الفردي (radio) فقط
    element.parentElement.querySelectorAll(".path-card").forEach(sib => sib.classList.remove("selected"));
    element.classList.add("selected");
    const input = element.querySelector("input");
    if(input && input.name === "quant_found"){
        const warn = document.getElementById("einstein-warning");
        if(warn) warn.style.display = input.value === "einstein" ? "block" : "none";
    }
}

// بطاقات الاختيار المتعدد (checkbox): الاعتماد الكامل على حالة الـ checkbox
// نفسها (التي يُبدّلها المتصفح تلقائياً عند الضغط على الـ label) بدل تبديلها
// يدوياً — هذا يمنع "التبديل المزدوج" الذي كان يُلغي الضغطة.
function syncCheckboxCard(inputEl){
    inputEl.closest(".path-card").classList.toggle("selected", inputEl.checked);
}

function toggleCustomSourceFields(kind){
    const enabled = document.getElementById(`custom_${kind}_enable`).checked;
    document.getElementById(`custom-${kind}-fields`).style.display = enabled ? "block" : "none";
}

function unitLabel(unit, count){
    const n = Number(count) || 0;
    const dict = {
        section: { ar: n === 1 ? "قسم" : "أقسام", en: "section(s)" },
        bank:    { ar: n === 1 ? "بنك" : "بنوك",  en: "bank(s)" },
        question:{ ar: "سؤال", en: "question(s)" },
        page:    { ar: n === 1 ? "صفحة" : "صفحات", en: "page(s)" },
    };
    const entry = dict[unit] || dict.section;
    return currentLang === "ar" ? entry.ar : entry.en;
}

function readCustomSourceForm(prefix){
    const enabled = document.getElementById(`custom_${prefix === "cv" ? "verbal" : "quant"}_enable`).checked;
    if(!enabled) return null;
    const total = parseInt(document.getElementById(`${prefix}-total`).value) || 0;
    if(total <= 0) return null;
    return {
        name: document.getElementById(`${prefix}-name`).value.trim(),
        origin: document.getElementById(`${prefix}-origin`).value.trim(),
        unit: document.getElementById(`${prefix}-unit`).value,
        total,
        qper: document.getElementById(`${prefix}-qper`).value.trim(),
    };
}

function restoreSetupForm(){
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    if(!config || Object.keys(config).length === 0) return;

    if(config.found){
        document.querySelectorAll('input[name="quant_found"]').forEach(r => {
            r.checked = (r.value === config.found);
            r.closest(".path-card").classList.toggle("selected", r.checked);
        });
        document.getElementById("einstein-warning").style.display = config.found === "einstein" ? "block" : "none";
    }
    document.getElementById("einstein_review_only").checked = !!config.einsteinReviewOnly;
    const map = { train_monsif:"tMonsif", train_mufakkir_sec:"tMufSec", train_mufakkir_rep:"tMufRep", train_moasser:"tMoasser" };
    Object.keys(map).forEach(inputId => {
        const el = document.getElementById(inputId);
        if(!el) return;
        el.checked = !!config[map[inputId]];
        el.closest(".path-card").classList.toggle("selected", el.checked);
    });
    document.getElementById("night_review").checked = !!config.nightRev;

    if(config.customVerbal){
        document.getElementById("custom_verbal_enable").checked = true;
        document.getElementById("cv-name").value = config.customVerbal.name || "";
        document.getElementById("cv-origin").value = config.customVerbal.origin || "";
        document.getElementById("cv-unit").value = config.customVerbal.unit || "section";
        document.getElementById("cv-total").value = config.customVerbal.total || "";
        document.getElementById("cv-qper").value = config.customVerbal.qper || "";
        toggleCustomSourceFields("verbal");
    }
    if(config.customQuant){
        document.getElementById("custom_quant_enable").checked = true;
        document.getElementById("cq-name").value = config.customQuant.name || "";
        document.getElementById("cq-origin").value = config.customQuant.origin || "";
        document.getElementById("cq-unit").value = config.customQuant.unit || "bank";
        document.getElementById("cq-total").value = config.customQuant.total || "";
        document.getElementById("cq-qper").value = config.customQuant.qper || "";
        toggleCustomSourceFields("quant");
    }

    const days = localStorage.getItem("khuta_plan_days");
    if(days) document.getElementById("plan-days").value = days;
    const examDate = localStorage.getItem("khuta_exam_date");
    if(examDate) document.getElementById("exam-date").value = examDate;
    const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes"));
    if(sessionMinutes){
        document.getElementById("plan-hours").value = Math.floor(sessionMinutes / 60);
        document.getElementById("plan-minutes").value = sessionMinutes % 60;
    }
    const autoBreak = localStorage.getItem("khuta_autobreak_minutes");
    if(autoBreak) document.getElementById("auto-break-minutes").value = autoBreak;
    const shortBreakLimit = localStorage.getItem("khuta_short_break_limit");
    if(shortBreakLimit != null) document.getElementById("short-break-limit").value = shortBreakLimit;
    const startSection = localStorage.getItem("khuta_start_section");
    if(startSection){
        document.querySelectorAll('input[name="start_section"]').forEach(r => {
            r.checked = (r.value === startSection);
            r.closest(".path-card").classList.toggle("selected", r.checked);
        });
    }
}

function setDaysFromExamDate(){
    const val = document.getElementById("exam-date").value;
    if(!val) return;
    const examDate = new Date(val);
    const today = new Date();
    today.setHours(0,0,0,0);
    examDate.setHours(0,0,0,0);
    const days = Math.round((examDate - today) / 86400000);
    if(days < 3){
        showToast(currentLang === "ar" ? "اختر تاريخاً بعد اليوم بثلاثة أيام على الأقل" : "Pick a date at least 3 days from today");
        return;
    }
    document.getElementById("plan-days").value = days;
    document.querySelectorAll("#intensity-row .intensity-chip").forEach(c => c.classList.remove("selected"));
    localStorage.setItem("khuta_exam_date", val);
    updateExamCountdownWidget();
}

/* ---------- ودجة العد التنازلي الصغيرة في الرأس ---------- */
function updateExamCountdownWidget(){
    const widget = document.getElementById("exam-countdown-widget");
    if(!widget) return;
    const examDateStr = localStorage.getItem("khuta_exam_date");
    if(!examDateStr){ widget.style.display = "none"; return; }
    const examDate = new Date(examDateStr); examDate.setHours(0,0,0,0);
    const today = khutaNow(); today.setHours(0,0,0,0);
    const daysLeft = Math.round((examDate - today) / 86400000);
    const valueEl = document.getElementById("exam-countdown-value");
    if(daysLeft < 0){ widget.style.display = "none"; return; }
    widget.style.display = "flex";
    if(daysLeft === 0){
        valueEl.textContent = currentLang==='ar' ? "اليوم! 🌟" : "Today! 🌟";
    } else {
        valueEl.textContent = currentLang==='ar' ? `${daysLeft} يوم متبقٍ` : `${daysLeft} days left`;
    }
    widget.title = currentLang==='ar' ? "الأيام المتبقية حتى اختبارك" : "Days remaining until your exam";
}

function setExamDateFromProfile(){
    const val = document.getElementById("prof-exam-date").value;
    if(!val) return;
    localStorage.setItem("khuta_exam_date", val);
    updateExamCountdownWidget();
    showToast(currentLang==='ar' ? "📅 تم تحديث تاريخ اختبارك" : "📅 Exam date updated");
}

/* ---------- تذكير العد التنازلي للاختبار ---------- */
/* ============================================================
   27) نظام تذكيرات الاختبار الذكي — رسائل مختلفة حسب التزامك الفعلي
   بجدولك، وليس رسالة ثابتة واحدة. يعتمد على khuta_missed_days_count
   (المتاح أصلاً) كمقياس واقعي لمدى التزامك.
   ============================================================ */
function checkExamReminder(){
    const examDateStr = localStorage.getItem("khuta_exam_date");
    if(!examDateStr || !localStorage.getItem("khuta_plan_days")) return;
    const examDate = new Date(examDateStr);
    const today = khutaNow();
    today.setHours(0,0,0,0);
    examDate.setHours(0,0,0,0);
    const daysLeft = Math.round((examDate - today) / 86400000);

    const shownKey = "khuta_exam_reminder_shown_" + khutaNow().toDateString();
    if(localStorage.getItem(shownKey)) return; // مرة واحدة فقط في اليوم
    if(daysLeft < 0 || daysLeft > 20) return;

    const missed = getMissedDaysCount();
    const ar = currentLang === "ar";

    if(daysLeft === 0){
        showExamReminderModal(ar?"🌟 اليوم يوم اختبارك!":"🌟 Today's the day!",
            ar?"بالتوفيق — أنت جاهز تماماً. ثق بنفسك وبكل الجهد الذي بذلته طوال هذه المدة.":"Good luck — you're fully ready. Trust yourself and everything you've put into this.");
    } else if(daysLeft === 20 || daysLeft === 15){
        showExamReminderModal(ar?`⏳ باقي ${daysLeft} يوماً`:`⏳ ${daysLeft} days left`,
            ar?"استمر بخطتك بثبات — كل يوم تُنجزه الآن يقرّبك أكثر من هدفك.":"Keep steady with your plan — every day you complete now brings you closer to your goal.");
    } else if(daysLeft === 10){
        if(missed <= 2){
            showExamReminderModal(ar?"💪 باقي 10 أيام — أنت على المسار الصحيح":"💪 10 days left — you're on track",
                ar?"التزامك بخطتك ممتاز حتى الآن. استمر بنفس الوتيرة ولا تتراخَ في الأيام الأخيرة.":"Your commitment so far is excellent. Keep the same pace and don't ease off in these final days.");
        } else {
            showExamReminderModal(ar?"⚠️ باقي 10 أيام — تأخرت عن خطتك":"⚠️ 10 days left — you've fallen behind",
                ar?`فاتتك ${missed} أيام من خطتك حتى الآن. أقترح ضغط جدولك المتبقي ليتناسب مع الوقت الحقيقي المتاح — هل تريد ذلك؟`:`You've missed ${missed} days of your plan so far. I suggest compressing your remaining schedule to fit the real time left — want me to do that?`,
                true);
        }
    } else if(daysLeft === 5){
        if(missed === 0){
            showExamReminderModal(ar?"🎉 باقي 5 أيام — أنجزت كل شيء!":"🎉 5 days left — you've done it all!",
                ar?"أتممت خطتك بالكامل. حان وقت مذاكرة التسريبات والمراجعة السريعة العامة بدل الدروس الجديدة.":"You've completed your full plan. Time for leaked-question practice and a fast general review instead of new material.");
        } else if(missed <= 4){
            showExamReminderModal(ar?"🔥 باقي 5 أيام — اضغط على نفسك الآن":"🔥 5 days left — push hard now",
                ar?`تبقّى القليل من خطتك (فاتتك ${missed} أيام). بإمكانك تعويضها في الأيام الأخيرة — هل تريد جدولاً مضغوطاً جداً لإنجاز الباقي بأسرع وقت؟`:`Just a little of your plan remains (${missed} missed days). You can still catch up — want a very compressed schedule to finish what's left as fast as possible?`,
                true);
        } else {
            showExamReminderModal(ar?"😟 باقي 5 أيام فقط — لم تلتزم بخطتك":"😟 Only 5 days left — you haven't kept up",
                ar?`فاتتك ${missed} يوماً من خطتك، وهذا على الأغلب سيؤثر على نتيجتك. لا يزال بإمكانك تحسين الموقف بجدول مضغوط جداً للأيام المتبقية — هل تريد ذلك؟`:`You've missed ${missed} days of your plan, which will likely affect your score. You can still improve things with a very compressed schedule for the remaining days — want that?`,
                true);
        }
    }
    localStorage.setItem(shownKey, "1");
}

function showExamReminderModal(title, message, offerIntensify){
    const overlay = document.createElement("div");
    overlay.className = "overlay-screen";
    overlay.style.zIndex = "4800";
    overlay.innerHTML = `
        <div class="wizard-card" style="max-width:440px; text-align:center;">
            <h2 style="margin-bottom:12px;">${title}</h2>
            <p class="card-sub" style="margin-bottom:20px; line-height:1.9;">${escapeHtml(message)}</p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${offerIntensify ? `<button type="button" class="btn" onclick="generateIntensifiedSchedule(); this.closest('.overlay-screen').remove();">${currentLang==='ar'?'نعم، اضغط جدولي':'Yes, compress my schedule'}</button>` : ""}
                <button type="button" class="btn ${offerIntensify?'btn-ghost':''}" onclick="this.closest('.overlay-screen').remove()">${offerIntensify ? (currentLang==='ar'?'لا، سأكمل بنفس الوتيرة':"No, I'll continue at my own pace") : (currentLang==='ar'?'متابعة':'Continue')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

/* ضغط الجدول: يعيد استخدام آلية "الأيام الفائتة" الموجودة أصلاً (التي
   تقلّل مقام حساب الكمية اليومية) بحيث يصبح المقام = الأيام الحقيقية
   المتبقية فقط حتى الاختبار، مهما كان طول الخطة الأصلي. */
function generateIntensifiedSchedule(){
    const examDateStr = localStorage.getItem("khuta_exam_date");
    const totalPlanDays = parseInt(localStorage.getItem("khuta_plan_days")) || 45;
    if(!examDateStr) return;
    const examDate = new Date(examDateStr); examDate.setHours(0,0,0,0);
    const today = khutaNow(); today.setHours(0,0,0,0);
    const daysLeft = Math.max(1, Math.round((examDate - today) / 86400000));
    const neededMissedValue = Math.max(0, totalPlanDays - daysLeft);
    localStorage.setItem("khuta_missed_days_count", neededMissedValue);
    buildScheduleTable();
    renderProgress();
    showToast(currentLang==='ar'
        ? `🧠 تم ضغط جدولك ليتناسب مع ${daysLeft} يوماً المتبقية فعلياً حتى اختبارك.`
        : `🧠 Your schedule was compressed to fit the ${daysLeft} real days remaining until your exam.`);
}

function setIntensity(days, el){
    document.querySelectorAll("#intensity-row .intensity-chip").forEach(c => c.classList.remove("selected"));
    el.classList.add("selected");
    const daysInput = document.getElementById("plan-days");
    if(days === "custom"){ daysInput.focus(); return; }
    daysInput.value = days;
}

function finalizeSetup(){
    const days = parseInt(document.getElementById("plan-days").value) || 45;
    const hours = parseInt(document.getElementById("plan-hours").value) || 0;
    const minutes = parseInt(document.getElementById("plan-minutes").value) || 0;

    localStorage.setItem("khuta_plan_days", days);
    localStorage.setItem("khuta_session_minutes", (hours * 60) + minutes);
    localStorage.setItem("khuta_autobreak_minutes", document.getElementById("auto-break-minutes").value || 10);
    localStorage.setItem("khuta_short_break_limit", document.getElementById("short-break-limit").value || 0);
    localStorage.setItem("khuta_start_section", document.querySelector('input[name="start_section"]:checked').value);
    if(!localStorage.getItem("khuta_plan_start")){
        localStorage.setItem("khuta_plan_start", new Date().toISOString());
    }

    const found = document.querySelector('input[name="quant_found"]:checked').value;
    const einsteinReviewOnly = document.getElementById("einstein_review_only").checked;
    const customVerbal = readCustomSourceForm("cv");
    const customQuant = readCustomSourceForm("cq");
    const config = {
        found,
        einsteinReviewOnly,
        tMonsif: document.getElementById("train_monsif").checked,
        tMufSec: document.getElementById("train_mufakkir_sec").checked,
        tMufRep: document.getElementById("train_mufakkir_rep").checked,
        tMoasser: document.getElementById("train_moasser").checked,
        nightRev: document.getElementById("night_review").checked,
        customVerbal,
        customQuant,
    };
    localStorage.setItem("khuta_config", JSON.stringify(config));

    if(customVerbal && customVerbal.name) reportCustomSource("verbal", customVerbal);
    if(customQuant && customQuant.name) reportCustomSource("quant", customQuant);

    document.getElementById("setup-overlay").style.display = "none";
    buildScheduleTable();
    renderProgress();
    switchTab("dashboard");
    showToast(t("toast.planReady"));
    debouncedSync();
}

/* ============================================================
   6) التنقل بين الأقسام
   ============================================================ */
function switchTab(tabId, element){
    document.querySelectorAll(".view-section").forEach(el => el.classList.remove("active"));
    document.getElementById("view-" + tabId).classList.add("active");
    document.querySelectorAll(".nav-item, .mobile-nav-item").forEach(el => el.classList.remove("active"));
    document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(el => el.classList.add("active"));
    window.scrollTo({top:0, behavior:"smooth"});
    if(tabId === "community") initCommunityIfNeeded();
    if(tabId === "specialties") renderSpecialties();
    if(tabId === "profile") renderProfileStats();
    if(tabId === "tutors") renderTutors();
}

function setAccent(accent){
    document.body.classList.remove("accent-green", "accent-purple", "accent-blue", "accent-rose", "accent-teal2", "accent-amber", "accent-indigo");
    if(accent) document.body.classList.add(accent);
    localStorage.setItem("khuta_accent", accent);
    document.querySelectorAll(".theme-swatch").forEach(sw => {
        const active = sw.dataset.accent === accent;
        sw.classList.toggle("active", active);
        sw.querySelector("i").style.display = active ? "block" : "none";
    });
}

function setFontSize(size){
    document.documentElement.classList.remove("fontsize-small", "fontsize-medium", "fontsize-large");
    if(size !== "medium") document.documentElement.classList.add("fontsize-" + size);
    localStorage.setItem("khuta_fontsize", size);
    ["small","medium","large"].forEach(s => {
        const btn = document.getElementById("fontsize-" + s + "-btn");
        if(btn) btn.classList.toggle("active", s === size);
    });
}

function toggleSidebar(){
    const container = document.getElementById("app-container");
    const collapsed = container.classList.toggle("sidebar-collapsed");
    localStorage.setItem("khuta_sidebar_collapsed", collapsed ? "1" : "0");
}

function toggleTheme(){
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("khuta_theme", isDark ? "dark" : "light");
}

/* ============================================================
   7) بناء الجدول والمهام
   ============================================================ */
function getTaskStatuses(){
    try{ return JSON.parse(localStorage.getItem("khuta_task_status")) || {}; }catch(e){ return {}; }
}
/* حالة المهام يومية فقط — إن بدأ يوم تقويمي جديد، تُصفَّر كل الحالات تلقائياً
   حتى لا يظهر "مكتمل" من أمس وأنت لم تبدأ اليوم بعد. */
function ensureTaskStatusFreshToday(){
    const key = "khuta_task_status_date";
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem(key);
    if(lastDate !== today){
        // إن كان هناك يوم "سابق" مسجَّل ولم يُكتمل، يُحتسب يوماً فائتاً — يُستخدم
        // لاحقاً لتوزيع محتواه على الأيام القادمة تلقائياً (بدل أن يبقى الطالب متأخراً للأبد)
        if(lastDate && localStorage.getItem("khuta_plan_start") && !getCompletedDates().includes(lastDate)){
            localStorage.setItem("khuta_missed_days_count", getMissedDaysCount() + 1);
        }
        localStorage.setItem("khuta_task_status", JSON.stringify({}));
        localStorage.setItem("khuta_xp_awarded", JSON.stringify({}));
        localStorage.setItem(key, today);
    }
}
function setTaskStatus(id, status){
    const statuses = getTaskStatuses();
    statuses[id] = status;
    localStorage.setItem("khuta_task_status", JSON.stringify(statuses));
    renderProgress();
}
function statusProgress(status){
    if(status === "done") return 100;
    if(status === "inprogress") return 50;
    return 0;
}

function buildScheduleTable(){
    const tbody = document.getElementById("schedule-body");
    if(!tbody) return;
    tbody.innerHTML = "";

    const days = parseInt(localStorage.getItem("khuta_plan_days")) || 45;
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}

    // إن اختار الطالب اليوم مدة مخصصة أطول من جلسته الأساسية، تُكبَّر كمية اليوم تناسبياً
    let todayScale = 1;
    try{
        const saved = JSON.parse(localStorage.getItem("khuta_today_scale"));
        if(saved && saved.date === new Date().toDateString()) todayScale = saved.scale;
    }catch(e){}
    // الأيام التي فاتت الطالب توزَّع محتواها تلقائياً على الأيام المتبقية بدل أن يتراكم عليه
    const effectiveDays = Math.max(1, days - getMissedDaysCount());
    function dailyQty(total){ return Math.max(1, Math.ceil((total / effectiveDays) * todayScale)); }

    const tasks = [];
    const content = getContent();
    const ehabTotal = content.ehab.totalSections;
    const ehabDaily = dailyQty(ehabTotal);
    tasks.push({ id:"verbal", icon:"fa-comments",
        title: currentLang === "ar" ? "اللفظي (إيهاب)" : "Verbal (Ehab)",
        qty: currentLang === "ar" ? `دراسة وحل ${ehabDaily} ${ehabDaily===1?"قسم":"أقسام"} كاملة يومياً (من أصل ${ehabTotal})` : `Study & solve ${ehabDaily} full section(s) daily (of ${ehabTotal})` });

    if(config.found === "moasser"){
        const f = content.moasserFoundation;
        const pagesDaily = dailyQty(f.days * f.pagesPerDay);
        tasks.push({ id:"found", icon:"fa-layer-group",
            title: currentLang === "ar" ? "تأسيس كمي (المعاصر)" : "Quant foundation (Al-Moaasir)",
            qty: currentLang === "ar" ? `مذاكرة ${pagesDaily} صفحة يومياً من كتاب التأسيس` : `Study ${pagesDaily} page(s) daily from the foundation book` });
    }
    if(config.found === "einstein"){
        const e = content.einstein;
        const totalVideos = config.einsteinReviewOnly ? e.reviewVideos : e.totalVideos;
        const videosDaily = dailyQty(totalVideos);
        const label = config.einsteinReviewOnly
            ? (currentLang === "ar" ? "تأسيس كمي (أينشتاين — مراجعة فقط)" : "Quant foundation (Einstein — review only)")
            : (currentLang === "ar" ? "تأسيس كمي (أينشتاين)" : "Quant foundation (Einstein)");
        tasks.push({ id:"foundEinstein", icon:"fa-layer-group",
            title: label,
            qty: currentLang === "ar" ? `مشاهدة ${videosDaily} مقطع يومياً (من أصل ${totalVideos})` : `Watch ${videosDaily} video(s) daily (of ${totalVideos})` });
    }
    if(config.tMonsif){
        const total = content.monsif.totalBanks;
        const q = dailyQty(total);
        tasks.push({ id:"monsif", icon:"fa-database",
            title: currentLang === "ar" ? "تدريب (المنصف)" : "Training (Al-Monsif)",
            qty: currentLang === "ar" ? `حل ${q} ${q===1?"بنك":"بنوك"} تدريبية يومياً (من أصل ${total})` : `Solve ${q} training bank(s) daily (of ${total})` });
    }
    if(config.tMufSec){
        const total = content.mufakkirSections.total;
        const q = dailyQty(total);
        tasks.push({ id:"mufsec", icon:"fa-brain",
            title: currentLang === "ar" ? "تدريب (أقسام المفكر)" : "Training (Al-Mufakkir sections)",
            qty: currentLang === "ar" ? `حل ${q} ${q===1?"قسم":"أقسام"} يومياً (من أصل ${total})` : `Solve ${q} section(s) daily (of ${total})` });
    }
    if(config.tMufRep){
        const total = content.mufakkirRepeated.total;
        const q = dailyQty(total);
        tasks.push({ id:"mufrep", icon:"fa-fire",
            title: currentLang === "ar" ? "تدريب (تكرارات المفكر)" : "Training (Al-Mufakkir repeats)",
            qty: currentLang === "ar" ? `حل ${q} سؤال يومياً من الأكثر تكراراً (من أصل ${total})` : `Solve ${q} most-repeated question(s) daily (of ${total})` });
    }
    if(config.tMoasser){
        const total = content.moasserTraining.totalBanks;
        const q = dailyQty(total);
        tasks.push({ id:"moassertrain", icon:"fa-book-open",
            title: currentLang === "ar" ? "تدريب (بنوك المعاصر)" : "Training (Al-Moaasir banks)",
            qty: currentLang === "ar" ? `حل ${q} ${q===1?"بنك":"بنوك"} تدريبية يومياً (من أصل ${total})` : `Solve ${q} training bank(s) daily (of ${total})` });
    }
    if(config.nightRev){
        tasks.push({ id:"nightrev", icon:"fa-moon",
            title: currentLang === "ar" ? "مراجعة ليلة الامتحان" : "Exam-eve review",
            qty: currentLang === "ar" ? "مراجعة جزء من كتيّب ليلة الامتحان (المعاصر)" : "Review a portion of the exam-eve booklet (Al-Moaasir)" });
    }

    if(config.customVerbal && config.customVerbal.total){
        const cv = config.customVerbal;
        const q = dailyQty(cv.total);
        const label = cv.name || (currentLang === "ar" ? "مصدر لفظي مخصص" : "Custom verbal source");
        tasks.push({ id:"customVerbal", icon:"fa-star",
            title: currentLang === "ar" ? `لفظي — ${label}` : `Verbal — ${label}`,
            qty: currentLang === "ar" ? `حل ${q} ${unitLabel(cv.unit, q)} يومياً (من أصل ${cv.total})` : `Solve ${q} ${unitLabel(cv.unit, q)} daily (of ${cv.total})` });
    }
    if(config.customQuant && config.customQuant.total){
        const cq = config.customQuant;
        const q = dailyQty(cq.total);
        const label = cq.name || (currentLang === "ar" ? "مصدر كمي مخصص" : "Custom quant source");
        tasks.push({ id:"customQuant", icon:"fa-star",
            title: currentLang === "ar" ? `كمي — ${label}` : `Quant — ${label}`,
            qty: currentLang === "ar" ? `حل ${q} ${unitLabel(cq.unit, q)} يومياً (من أصل ${cq.total})` : `Solve ${q} ${unitLabel(cq.unit, q)} daily (of ${cq.total})` });
    }

    const customTasks = getCustomTasks();
    customTasks.forEach(ct => tasks.push(ct));

    const mobileList = document.getElementById("schedule-body-mobile");
    if(tasks.length === 0){
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-note"><i class="fa-solid fa-inbox" style="font-size:26px; margin-bottom:8px; display:block;"></i>${currentLang==='ar'?'لا توجد مهام بعد':'No tasks yet'}</div></td></tr>`;
        if(mobileList) mobileList.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد مهام بعد':'No tasks yet'}</div>`;
        return;
    }

    const statuses = getTaskStatuses();
    tasks.forEach(task => appendTaskRow(task, statuses[task.id] || "notstarted"));
    if(mobileList){
        mobileList.innerHTML = "";
        tasks.forEach(task => appendMobileTaskCard(task, statuses[task.id] || "notstarted"));
    }

    const scaleNote = document.getElementById("today-scale-note");
    if(scaleNote){
        const missed = getMissedDaysCount();
        if(todayScale > 1.001 && missed > 0){
            scaleNote.style.display = "block";
            scaleNote.textContent = currentLang==='ar'
                ? `⚡ اخترت جلسة أطول اليوم (×${todayScale.toFixed(2)})، مع توزيع ${missed} يوم فائت على الأيام المتبقية — لذا سيتم زيادة دروسك اليوم.`
                : `⚡ Longer session today (×${todayScale.toFixed(2)}), plus ${missed} missed day(s) redistributed across remaining days — today's lessons are increased.`;
        } else if(todayScale > 1.001){
            scaleNote.style.display = "block";
            scaleNote.textContent = currentLang==='ar'
                ? `⚡ اخترت جلسة أطول اليوم (×${todayScale.toFixed(2)}) — لذا سيتم زيادة دروسك اليوم لتنجز أكثر، لهذا اليوم فقط.`
                : `⚡ You picked a longer session today (×${todayScale.toFixed(2)}) — today's lessons are increased so you get more done, just for today.`;
        } else if(missed > 0){
            scaleNote.style.display = "block";
            scaleNote.textContent = currentLang==='ar'
                ? `📅 فاتك ${missed} يوم — تم توزيع محتواه تلقائياً على الأيام المتبقية من خطتك، فزادت كمية كل يوم قليلاً حتى تعوّض دون ضغط.`
                : `📅 You missed ${missed} day(s) — their content was auto-redistributed across your remaining days, slightly increasing each day's amount so you catch up without pressure.`;
        } else {
            scaleNote.style.display = "none";
        }
    }
}

function appendTaskRow(task, status){
    const tr = document.createElement("tr");
    tr.dataset.taskId = task.id;
    const pct = statusProgress(status);
    const isCustom = task.custom === true;

    tr.innerHTML = `
        <td data-label="${currentLang==='ar'?'المسار':'Track'}">
            <div class="task-path-cell">
                <div class="ic"><i class="fa-solid ${task.icon || 'fa-pen'}"></i></div>
                <input type="text" class="task-input" value="${escapeHtml(task.title)}" style="font-weight:700;" ${isCustom ? "" : "readonly"} onchange="renameCustomTask('${task.id}', this.value)">
            </div>
        </td>
        <td data-label="${currentLang==='ar'?'الكمية اليومية':'Daily amount'}"><input type="text" class="task-input" value="${escapeHtml(task.qty)}" ${isCustom ? "" : "readonly"} onchange="requalifyCustomTask('${task.id}', this.value)"></td>
        <td data-label="${currentLang==='ar'?'الحالة':'Status'}">
            <span class="status-badge status-${status}"></span>
        </td>
        <td data-label="${currentLang==='ar'?'نسبة الإنجاز':'Progress'}">
            <div class="mini-progress"><div style="width:${pct}%; background:${pct===100 ? 'linear-gradient(90deg, var(--teal), #38B897)' : pct===50 ? 'linear-gradient(90deg, var(--gold), var(--gold-soft))' : 'var(--border)'};"></div></div>
            <div class="progress-pct">${pct}%</div>
        </td>
        <td data-label="${currentLang==='ar'?'إجراء':'Action'}">
            <div class="row-actions">
                <div class="icon-action" onclick="removeTaskRow('${task.id}')" title="حذف"><i class="fa-solid fa-trash"></i></div>
            </div>
        </td>
    `;
    renderStatusBadge(tr.querySelector(".status-badge"), status);
    document.getElementById("schedule-body").appendChild(tr);
}

/* بطاقة مهمة مبسّطة ومضغوطة للهاتف تحديداً — عناصر HTML حقيقية منفصلة
   عن الجدول، وليست تحويلاً بواسطة CSS لصفوف جدول (وهو ما كان يسبّب
   مشاكل تكرار الفيض خارج الشاشة رغم عدة محاولات إصلاح). للمهام
   المخصَّصة القابلة للتعديل، التعديل هنا عبر نافذة تعديل بسيطة (prompt)
   بدل حقول إدخال مباشرة، لإبقاء التصميم صغيراً وآمناً قدر الإمكان. */
function appendMobileTaskCard(task, status){
    const pct = statusProgress(status);
    const isCustom = task.custom === true;
    const card = document.createElement("div");
    card.className = "mobile-task-card";
    card.dataset.taskId = task.id;
    card.innerHTML = `
        <div class="mobile-task-card-head">
            <div class="ic"><i class="fa-solid ${task.icon || 'fa-pen'}"></i></div>
            <div class="mobile-task-card-title">${escapeHtml(task.title)}</div>
            ${isCustom ? `<div class="icon-action" style="width:24px;height:24px;font-size:10px;flex-shrink:0;" onclick="editMobileCustomTask('${task.id}')"><i class="fa-solid fa-pen"></i></div>` : ""}
        </div>
        <div class="mobile-task-card-qty">${escapeHtml(task.qty)}</div>
        <div class="mobile-task-card-foot">
            <span class="status-badge status-${status}"></span>
            <div style="display:flex; align-items:center; gap:8px;">
                <div class="mini-progress"><div style="width:${pct}%; background:${pct===100 ? 'linear-gradient(90deg, var(--teal), #38B897)' : pct===50 ? 'linear-gradient(90deg, var(--gold), var(--gold-soft))' : 'var(--border)'};"></div></div>
                <span class="progress-pct">${pct}%</span>
                <div class="icon-action" onclick="removeTaskRow('${task.id}')" title="حذف"><i class="fa-solid fa-trash"></i></div>
            </div>
        </div>
    `;
    renderStatusBadge(card.querySelector(".status-badge"), status);
    document.getElementById("schedule-body-mobile").appendChild(card);
}

function editMobileCustomTask(id){
    const list = getCustomTasks();
    const item = list.find(x => x.id === id);
    if(!item) return;
    const newTitle = prompt(currentLang==='ar' ? "اسم المهمة:" : "Task name:", item.title);
    if(newTitle === null) return;
    const newQty = prompt(currentLang==='ar' ? "الوصف/الكمية:" : "Description/amount:", item.qty);
    if(newQty === null) return;
    item.title = newTitle;
    item.qty = newQty;
    saveCustomTasks(list);
    buildScheduleTable();
}

function escapeHtml(str){
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function renderStatusBadge(el, status){
    if(!el) return;
    el.className = "status-badge status-" + status;
    el.innerHTML = status === "done" ? `<i class="fa-solid fa-circle-check"></i> ${t("status.done")}`
        : status === "inprogress" ? `<i class="fa-solid fa-rotate"></i> ${t("status.inProgress")}`
        : `<i class="fa-regular fa-circle"></i> ${t("status.notStarted")}`;
}

/* ============================================================
   XP والمستويات — تحفيزية بحتة، منفصلة تماماً عن نسبة التقدم الفعلية
   ============================================================ */
const XP_LEVELS = [
    { min:0,   ar:"مستكشف",         en:"Explorer" },
    { min:50,  ar:"مبتدئ القدرات",   en:"Qudrat Beginner" },
    { min:150, ar:"مجتهد",          en:"Diligent" },
    { min:300, ar:"متمرّس",         en:"Skilled" },
    { min:600, ar:"محترف",          en:"Professional" },
    { min:1000,ar:"خبير قدرات 🏆",   en:"Qudrat Expert 🏆" },
];

function getXP(){ return parseInt(localStorage.getItem("khuta_xp")) || 0; }
function setXP(v){ localStorage.setItem("khuta_xp", Math.max(0, v)); }
function getAwardedTasks(){ try{ return JSON.parse(localStorage.getItem("khuta_xp_awarded")) || {}; }catch(e){ return {}; } }

function awardXP(amount, taskId){
    const awarded = getAwardedTasks();
    if(taskId){ if(awarded[taskId]) return; awarded[taskId] = true; localStorage.setItem("khuta_xp_awarded", JSON.stringify(awarded)); }
    setXP(getXP() + amount);
    renderGamification();
    checkBadges();
}
function revokeXP(taskId){
    const awarded = getAwardedTasks();
    if(!awarded[taskId]) return;
    delete awarded[taskId];
    localStorage.setItem("khuta_xp_awarded", JSON.stringify(awarded));
    setXP(getXP() - 10);
    renderGamification();
}

function currentLevel(xp){
    let lvl = XP_LEVELS[0];
    for(const l of XP_LEVELS){ if(xp >= l.min) lvl = l; }
    return lvl;
}

const SHIELD_COST = 100; // تكلفة الدرع الواحد بنقاط الخبرة

function getShieldCount(){ return parseInt(localStorage.getItem("khuta_shields")) || 0; }

function buyStreakShield(){
    if(getXP() < SHIELD_COST){
        showToast(currentLang==='ar' ? `تحتاج ${SHIELD_COST} XP على الأقل لشراء درع` : `You need at least ${SHIELD_COST} XP to buy a shield`);
        return;
    }
    setXP(getXP() - SHIELD_COST);
    localStorage.setItem("khuta_shields", getShieldCount() + 1);
    showToast(currentLang==='ar' ? "🛡️ اشتريت درعاً — سيحمي سلسلتك تلقائياً أول مرة تفوّت فيها يوماً" : "🛡️ Shield purchased — it'll auto-protect your streak the first day you miss");
    renderGamification();
    renderShieldUI();
    debouncedSync();
}

function renderShieldUI(){
    const el = document.getElementById("shield-count-display");
    if(el) el.textContent = getShieldCount();
}

function updateStreak(){
    const today = new Date().toDateString();
    const last = localStorage.getItem("khuta_streak_last");
    let streak = parseInt(localStorage.getItem("khuta_streak")) || 0;
    if(last === today) return; // already counted today
    if(last){
        const diffDays = Math.round((new Date(today) - new Date(last)) / 86400000);
        if(diffDays === 1){
            streak = streak + 1;
        } else if(diffDays === 2 && getShieldCount() > 0){
            // فوّت يوماً واحداً بالضبط ولديه درع — يُستهلك تلقائياً لحماية السلسلة
            localStorage.setItem("khuta_shields", getShieldCount() - 1);
            streak = streak + 1;
            showToast(currentLang==='ar' ? "🛡️ استُخدم درعك تلقائياً لحماية سلسلتك من الانكسار!" : "🛡️ Your shield was auto-used to protect your streak!");
        } else {
            streak = 1;
        }
    } else {
        streak = 1;
    }
    localStorage.setItem("khuta_streak", streak);
    localStorage.setItem("khuta_streak_last", today);
}

const BADGES = [
    { id:"first_step", cond:() => getDoneTaskCount() >= 1, icon:"fa-shoe-prints", ar:"أول خطوة", en:"First Step" },
    { id:"week_streak", cond:() => (parseInt(localStorage.getItem("khuta_streak"))||0) >= 7, icon:"fa-fire", ar:"أسبوع كامل", en:"Full Week" },
    { id:"quant_beast", cond:() => getLifetimeCount("quant") >= 50, icon:"fa-brain", ar:"وحش الكمي", en:"Quant Beast" },
    { id:"verbal_master", cond:() => getLifetimeCount("verbal") >= 50, icon:"fa-comments", ar:"سيد اللفظي", en:"Verbal Master" },
    { id:"level_up", cond:() => getXP() >= 300, icon:"fa-medal", ar:"متمرّس", en:"Skilled" },
    // ⭐ إنجازات سرّية — لا تظهر في الشبكة إطلاقاً حتى تُكتشف بالصدفة، تحفيزاً للاستكشاف
    { id:"night_owl", secret:true, cond:() => (parseInt(localStorage.getItem("khuta_nightowl_count"))||0) >= 3,
      icon:"fa-moon", ar:"بومة الليل 🦉", en:"Night Owl 🦉" },
    { id:"the_addict", secret:true, cond:() => localStorage.getItem("khuta_addict_unlocked") === "1",
      icon:"fa-fire-flame-curved", ar:"المدمن 🔥", en:"The Addict 🔥" },
    { id:"early_bird", secret:true, cond:() => (parseInt(localStorage.getItem("khuta_earlybird_count"))||0) >= 3,
      icon:"fa-sun", ar:"الطائر المبكر 🌅", en:"Early Bird 🌅" },
    { id:"weekend_warrior", secret:true, cond:() => localStorage.getItem("khuta_weekend_warrior_unlocked") === "1",
      icon:"fa-shield-halved", ar:"محارب نهاية الأسبوع 🛡️", en:"Weekend Warrior 🛡️" },
    { id:"hundred_hours", cond:() => (parseInt(localStorage.getItem("khuta_total_minutes"))||0) >= 6000,
      icon:"fa-hourglass-half", ar:"أول 100 ساعة ⏳", en:"First 100 Hours ⏳" },
    { id:"five_hundred_lessons", cond:() => (getLifetimeCount("quant") + getLifetimeCount("verbal")) >= 500,
      icon:"fa-layer-group", ar:"أول 500 درس 📚", en:"First 500 Lessons 📚" },
];

/* تتبّع الشروط الزمنية للإنجازات السرّية — تُستدعى عند بدء كل جلسة رئيسية */
function trackSecretAchievementTriggers(){
    const now = new Date();
    const hour = now.getHours();
    if(hour >= 0 && hour < 4){
        const key = "khuta_nightowl_count";
        localStorage.setItem(key, (parseInt(localStorage.getItem(key))||0) + 1);
    } else if(hour >= 4 && hour < 7){
        const key = "khuta_earlybird_count";
        localStorage.setItem(key, (parseInt(localStorage.getItem(key))||0) + 1);
    }
    // نهاية الأسبوع السعودية: الجمعة (5) والسبت (6)
    const day = now.getDay();
    if(day === 5 || day === 6){
        const weekKey = "khuta_weekend_days_" + getIsoWeekLabel(now);
        let days = [];
        try{ days = JSON.parse(localStorage.getItem(weekKey)) || []; }catch(e){}
        if(!days.includes(day)) days.push(day);
        localStorage.setItem(weekKey, JSON.stringify(days));
        if(days.includes(5) && days.includes(6)) localStorage.setItem("khuta_weekend_warrior_unlocked", "1");
    }
}
function getIsoWeekLabel(d){
    const onejan = new Date(d.getFullYear(), 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return d.getFullYear() + "-W" + week;
}

function getDoneTaskCount(kind){
    const statuses = getTaskStatuses();
    const ids = Object.keys(statuses).filter(id => statuses[id] === "done");
    if(!kind) return ids.length;
    if(kind === "quant") return ids.filter(id => ["found","foundEinstein","monsif","mufsec","mufrep","moassertrain","customQuant"].includes(id)).length;
    if(kind === "verbal") return ids.filter(id => ["verbal","customVerbal"].includes(id)).length;
    return ids.length;
}

function getEarnedBadges(){ try{ return JSON.parse(localStorage.getItem("khuta_badges")) || []; }catch(e){ return []; } }

function checkBadges(){
    const earned = getEarnedBadges();
    let changed = false;
    BADGES.forEach(b => {
        if(!earned.includes(b.id) && b.cond()){
            earned.push(b.id);
            changed = true;
            showToast((currentLang === "ar" ? "🏅 وسام جديد: " : "🏅 New badge: ") + (currentLang === "ar" ? b.ar : b.en));
        }
    });
    if(changed) localStorage.setItem("khuta_badges", JSON.stringify(earned));
    renderBadges();
}

function renderGamification(){
    const xp = getXP();
    const lvl = currentLevel(xp);
    const streak = parseInt(localStorage.getItem("khuta_streak")) || 0;
    const xpEl = document.getElementById("xp-widget-value");
    const lvlEl = document.getElementById("xp-widget-level");
    const streakEl = document.getElementById("streak-widget-value");
    if(xpEl) xpEl.textContent = xp + " XP";
    if(lvlEl) lvlEl.textContent = currentLang === "ar" ? lvl.ar : lvl.en;
    if(streakEl) streakEl.textContent = streak;
    renderShieldUI();
}

function renderBadges(){
    const grid = document.getElementById("badges-grid");
    if(grid){
        const earned = getEarnedBadges();
        const visible = BADGES.filter(b => !b.secret || earned.includes(b.id));
        grid.innerHTML = visible.map(b => `
            <div class="badge-chip ${earned.includes(b.id) ? "earned" : "locked"}" title="${currentLang==='ar'?b.ar:b.en}">
                <i class="fa-solid ${b.icon}"></i>
                <span>${currentLang==='ar'?b.ar:b.en}</span>
            </div>`).join("");
    }
    renderDashboardBadges();
}

function getCustomTasks(){
    try{ return JSON.parse(localStorage.getItem("khuta_custom_tasks")) || []; }catch(e){ return []; }
}
function saveCustomTasks(list){ localStorage.setItem("khuta_custom_tasks", JSON.stringify(list)); }

function addCustomTask(){
    const list = getCustomTasks();
    const id = "custom_" + Date.now();
    list.push({ id, icon:"fa-pen", title: currentLang==="ar" ? "مهمة إضافية" : "Extra task", qty: currentLang==="ar" ? "اكتب التفاصيل هنا..." : "Write details here...", custom:true });
    saveCustomTasks(list);
    buildScheduleTable();
    showToast(t("toast.taskAdded"));
}
function renameCustomTask(id, value){
    const list = getCustomTasks();
    const item = list.find(x => x.id === id);
    if(item){ item.title = value; saveCustomTasks(list); }
}
function requalifyCustomTask(id, value){
    const list = getCustomTasks();
    const item = list.find(x => x.id === id);
    if(item){ item.qty = value; saveCustomTasks(list); }
}
function removeTaskRow(id){
    if(id.startsWith("custom_")){
        saveCustomTasks(getCustomTasks().filter(x => x.id !== id));
    }
    const statuses = getTaskStatuses();
    delete statuses[id];
    localStorage.setItem("khuta_task_status", JSON.stringify(statuses));
    const desktopRow = document.querySelector(`#schedule-body tr[data-task-id="${id}"]`);
    if(desktopRow) desktopRow.remove();
    const mobileCard = document.querySelector(`#schedule-body-mobile .mobile-task-card[data-task-id="${id}"]`);
    if(mobileCard) mobileCard.remove();
    renderProgress();
    showToast(t("toast.taskRemoved"));
}

/* ============================================================
   8) مسار التقدم (العنصر المميز) + الملخص
   ============================================================ */
function renderProgress(){
    const totalDays = parseInt(localStorage.getItem("khuta_plan_days")) || 0;
    const startStr = localStorage.getItem("khuta_plan_start");
    let currentDay = 0;
    if(startStr && totalDays){
        const start = new Date(startStr);
        const today = khutaNow();
        const diffDays = Math.floor((today.setHours(0,0,0,0) - start.setHours(0,0,0,0)) / 86400000) + 1;
        currentDay = Math.max(1, Math.min(diffDays, totalDays));
    }
    const dayPct = totalDays ? Math.round((currentDay / totalDays) * 100) : 0;
    const remaining = Math.max(0, totalDays - currentDay);

    document.getElementById("stat-day").textContent = currentDay;
    document.getElementById("stat-total").textContent = totalDays;
    document.getElementById("stat-remaining").textContent = remaining;

    // نسبة إنجاز المهام
    const rows = document.querySelectorAll("#schedule-body tr[data-task-id]");
    const statuses = getTaskStatuses();
    let taskPct = 0;
    if(rows.length){
        let sum = 0;
        rows.forEach(r => sum += statusProgress(statuses[r.dataset.taskId] || "notstarted"));
        taskPct = Math.round(sum / rows.length);
    }
    document.getElementById("stat-tasks").textContent = taskPct + "%";

    // حلقة التقدم العلوية: متوسط تقدم الأيام وتقدم المهام
    const ringPct = totalDays ? Math.round((dayPct + taskPct) / 2) : taskPct;
    const circle = document.getElementById("progress-ring-circle");
    const circumference = 188.5;
    circle.style.strokeDashoffset = circumference - (circumference * ringPct / 100);
    document.getElementById("progress-ring-val").textContent = ringPct + "%";

    // مسار الأيام (نقاط) — الأيام الفائتة تظهر بلون مختلف (أحمر خفيف)
    const path = document.getElementById("progress-path");
    path.innerHTML = "";
    updateProgressTitle();
    if(!totalDays){
        path.innerHTML = `<div class="empty-note">${currentLang==='ar'?'أنشئ خطتك لعرض مسار التقدم':'Build your plan to see the progress path'}</div>`;
        return;
    }
    const completedDates = getCompletedDates();
    const trackingStart = getRedDayTrackingStart();
    const planStart = startStr ? new Date(startStr) : null;
    const maxShow = 60; // لتفادي رسم مئات النقاط في الخطط الطويلة جداً
    const step = totalDays > maxShow ? Math.ceil(totalDays / maxShow) : 1;
    for(let d = 1; d <= totalDays; d += step){
        const node = document.createElement("div");
        let missed = false;
        if(d < currentDay && planStart){
            const dayDate = new Date(planStart);
            dayDate.setDate(planStart.getDate() + (d - 1));
            if(dayDate >= trackingStart){
                missed = !completedDates.includes(dayDate.toDateString());
            }
        }
        node.className = "pp-node" + (d < currentDay ? (missed ? " missed" : " done") : "") + (d === currentDay ? " today" : "");
        node.innerHTML = `<div class="pp-dot"></div><div class="pp-label">${d}</div>`;
        path.appendChild(node);
        if(d + step <= totalDays){
            const line = document.createElement("div");
            line.className = "pp-line" + (d < currentDay ? (missed ? " missed" : " done") : "");
            path.appendChild(line);
        }
    }
}

/* الرسالة التحفيزية تتغيّر حسب مدى التزامك الأخير — وليست جملة ثابتة دائماً */
function updateProgressTitle(){
    const el = document.getElementById("progress-title");
    if(!el) return;
    const missed = getMissedDaysCount();
    let msg;
    if(missed === 0){
        msg = currentLang==='ar' ? "أنت في الطريق الصحيح 🚀" : "You're on track 🚀";
    } else if(missed <= 2){
        msg = currentLang==='ar' ? "تعثرت قليلاً — أكمل اليوم وعُد لمسارك 💪" : "A small stumble — finish today and get back on track 💪";
    } else {
        msg = currentLang==='ar' ? "ابتعدت عن مسارك — لا بأس، ابدأ من اليوم 🌱" : "You've drifted from your plan — that's okay, start again today 🌱";
    }
    el.textContent = msg;
}

/* ============================================================
   9) وضع التركيز — جلسة رئيسية + استراحات ذكية + حالة تلقائية للمهام
   ------------------------------------------------------------
   لا مزيد من تحديد "مكتمل/قيد التقدم" يدوياً: تصبح كل مهام اليوم "قيد
   التقدم" تلقائياً عند بدء الجلسة، و"مكتمل" فقط إذا أنهيتها بالكامل
   دون توقف مبالغ فيه، أو "غير مكتمل" إن توقفت أكثر من 10 دقائق إجمالاً.
   ============================================================ */
const AUTO_BREAK_TRIGGER_SEC = 3600; // كل ساعة مذاكرة فعلية متواصلة (وليس كل ساعة تقويمية) تُشغّل استراحة تلقائية
const PAUSE_WARN_MS = 5 * 60 * 1000;   // بعد 5 دقائق إيقاف مؤقت → تحذير
const PAUSE_FAIL_MS = 10 * 60 * 1000;  // بعد 10 دقائق إيقاف مؤقت → فشل الجلسة

let mainInterval = null;
let mainRemaining = 0;      // ثوانٍ متبقية من الجلسة الرئيسية
let lastMainTickTs = null;  // آخر وقت حقيقي (Date.now()) رصدنا فيه دورة — لمقاومة إبطاء التبويبات الخلفية
let mainTotal = 0;
let elapsedSinceBreak = 0;  // ثوانٍ مذاكرة فعلية منذ آخر استراحة (يُصفَّر بعد كل استراحة تلقائية)
let sessionPaused = false;
let pauseStartTs = null;
let inAutoBreak = false;
let inPhaseTransitionBreak = false;
let breakInterval = null;
let breakRemaining = 0;
let breakTotal = 0;

// تقسيم الجلسة الرئيسية إلى مرحلتين (القسم الأول ثم الثاني) مع انتقال تلقائي بينهما
let sessionPhase = 1;
let phaseRemaining = 0;
let firstSection = "verbal";
let secondSection = "quant";
let secondSectionSeconds = 0;

const TIMER_CIRC = 2 * Math.PI * 110; // 691.15..

function getPlanSessionMinutes(){
    return parseInt(localStorage.getItem("khuta_session_minutes")) || 90;
}
/* تقسيم الوقت اليومي بين الكمي واللفظي — يُعدَّله النظام الذكي تلقائياً
   بمرور الوقت حسب أداء الطالب الفعلي (انظر قسم 25). قبل وجود أي تعديل
   تكيّفي محفوظ، لا نفترض 50/50 عشوائياً، بل نحسب توزيعاً ابتدائياً بسيطاً
   بناءً على الحمل التقديري لكل قسم (كمية × وقت الوحدة من CONTENT_CONFIG). */
function getQuantShare(){
    const saved = parseFloat(localStorage.getItem("khuta_quant_share"));
    if(saved && saved > 0 && saved < 1) return saved;
    try{
        const verbalInfo = getSectionPrimaryInfo("verbal");
        const quantInfo = getSectionPrimaryInfo("quant");
        if(verbalInfo && quantInfo && verbalInfo.qty && quantInfo.qty){
            const verbalLoad = verbalInfo.qty * verbalInfo.minutesPerUnit;
            const quantLoad = quantInfo.qty * quantInfo.minutesPerUnit;
            const total = verbalLoad + quantLoad;
            if(total > 0) return Math.max(0.25, Math.min(0.75, quantLoad / total));
        }
    }catch(e){ /* أي مصدر غير محدَّد بعد — نرجع للافتراضي أدناه بأمان */ }
    return 0.5;
}
/* ⚠️ إصلاح خطأ حرج: كانت كل دالة من الاثنتين تحدّد حداً أدنى بمعزل عن
   الأخرى (Math.max(5, ...)) بحيث يمكن أن يتجاوز مجموعهما إجمالي وقت
   الجلسة الفعلي عند اختيار مدة يومية صغيرة (مثال: 7 دقائق → 5+5=10
   دقيقة، أي زيادة 3 دقائق كاملة عن الإجمالي!). هذا كان يكسر تزامن المؤقت
   تماماً مع أي رقم لا "يُقسم بسهولة" — وليس له علاقة بكون الرقم زوجياً
   أو فردياً كما بدا للوهلة الأولى، بل بمجموع القسمين يتجاوز الكل.
   الإصلاح: نحسب نصيب الكمي أولاً، ثم نصيب اللفظي = الباقي بالضبط —
   هذا يضمن رياضياً أن المجموع = الإجمالي دائماً، لأي رقم مهما كان. */
function getQuantMinutes(){
    const total = getPlanSessionMinutes();
    const raw = Math.round(total * getQuantShare());
    // على الأقل دقيقة واحدة لكل قسم إن سمح الإجمالي بذلك، ولا نتجاوز الإجمالي أبداً
    return Math.min(Math.max(0, total - 1), Math.max(1, raw));
}
function getVerbalMinutes(){ return getPlanSessionMinutes() - getQuantMinutes(); }
function getStartSection(){ return localStorage.getItem("khuta_start_section") || "verbal"; }
function sectionLabel(section){
    return section === "quant" ? (currentLang==='ar' ? "الكمي" : "Quant") : (currentLang==='ar' ? "اللفظي" : "Verbal");
}
function getCustomMinutes(){
    const h = parseInt(document.getElementById("custom-hours").value) || 0;
    const m = parseInt(document.getElementById("custom-minutes").value) || 0;
    return Math.max(1, h * 60 + m);
}
function getAutoBreakMinutes(){
    return parseInt(localStorage.getItem("khuta_autobreak_minutes")) || 10;
}
function getShortBreakLimit(){
    return parseInt(localStorage.getItem("khuta_short_break_limit")) || 0;
}
function getShortBreakUsedToday(){
    const key = "khuta_short_break_used_" + new Date().toDateString();
    return parseInt(localStorage.getItem(key)) || 0;
}
function incShortBreakUsedToday(){
    const key = "khuta_short_break_used_" + new Date().toDateString();
    localStorage.setItem(key, getShortBreakUsedToday() + 1);
    updateShortBreakLabel();
}
function updateShortBreakLabel(){
    const el = document.getElementById("short-break-label");
    if(!el) return;
    const left = Math.max(0, getShortBreakLimit() - getShortBreakUsedToday());
    el.textContent = (currentLang==='ar' ? "استراحة 5د" : "5-min break") + ` (${left})`;
    document.getElementById("btn-short-break").disabled = left <= 0 || inAutoBreak || shortBreakActive || Date.now() < shortBreakCooldownUntil;
}

/* الحد الأدنى للمدة المخصصة = جلستك الأساسية بالضبط، ولا يمكن النزول عنه */
function enforceCustomMinimum(){
    const base = getPlanSessionMinutes();
    const hEl = document.getElementById("custom-hours");
    const mEl = document.getElementById("custom-minutes");
    let total = (parseInt(hEl.value)||0) * 60 + (parseInt(mEl.value)||0);
    if(total < base){
        hEl.value = Math.floor(base / 60);
        mEl.value = base % 60;
        showToast(t("timer.customTooShort", {base}));
    }
    updateCustomMinHint();
}
function updateCustomMinHint(){
    const base = getPlanSessionMinutes();
    const hint = document.getElementById("custom-min-hint");
    if(hint) hint.textContent = t("timer.minRequired", {base});
}

/* ---------- بدء الجلسة الرئيسية ---------- */
function startMainSession(minutes){
    const base = getPlanSessionMinutes();
    if(minutes < base){ minutes = base; showToast(t("timer.customTooShort", {base})); }

    clearInterval(mainInterval); clearInterval(breakInterval);
    mainTotal = minutes * 60;
    mainRemaining = mainTotal;
    elapsedSinceBreak = 0;
    sessionPaused = false;
    pauseStartTs = null;
    inAutoBreak = false;

    // إن كانت المدة أطول من الجلسة الأساسية، كبّر كميات اليوم تناسبياً
    const scale = minutes / base;
    if(scale > 1.001){
        localStorage.setItem("khuta_today_scale", JSON.stringify({ date:new Date().toDateString(), scale }));
    } else {
        localStorage.removeItem("khuta_today_scale");
    }
    buildScheduleTable();

    // تقسيم الجلسة لمرحلتين: القسم الذي يبدأ به الطالب دائماً، ثم الآخر تلقائياً
    firstSection = getStartSection();
    secondSection = firstSection === "quant" ? "verbal" : "quant";
    const firstMinutes = (firstSection === "quant" ? getQuantMinutes() : getVerbalMinutes()) * scale;
    const secondMinutes = (secondSection === "quant" ? getQuantMinutes() : getVerbalMinutes()) * scale;
    sessionPhase = 1;
    phaseRemaining = Math.round(firstMinutes * 60);
    secondSectionSeconds = Math.round(secondMinutes * 60);
    lastMainTickTs = Date.now();
    localStorage.setItem("khuta_last_session_minutes", JSON.stringify({
        quant: Math.round(firstSection === "quant" ? firstMinutes : secondMinutes),
        verbal: Math.round(firstSection === "verbal" ? firstMinutes : secondMinutes),
    }));

    setAllTodayTasksStatus("inprogress");
    localStorage.setItem("khuta_session_active", new Date().toDateString());
    trackSecretAchievementTriggers();

    document.getElementById("btn-plan-session").disabled = true;
    document.getElementById("btn-custom-session").disabled = true;
    document.getElementById("pause-btn").disabled = false;
    document.getElementById("pause-warning").style.display = "none";
    updateShortBreakLabel();
    requestFocusFullscreen();
    requestNotificationPermission();

    updateMainDisplay();
    mainInterval = setInterval(mainTick, 1000);
}

function mainTick(){
    if(sessionPaused){
        const pausedMs = Date.now() - pauseStartTs;
        const warnBox = document.getElementById("pause-warning");
        if(pausedMs >= PAUSE_FAIL_MS){
            failMainSession();
        } else if(pausedMs >= PAUSE_WARN_MS){
            warnBox.style.display = "block";
            warnBox.textContent = t("timer.pauseWarn5");
        }
        return;
    }
    if(inAutoBreak) return; // العدّاد أثناء الاستراحة تديره breakTick بشكل مستقل
    if(inPhaseTransitionBreak) return; // نفس الأمر أثناء استراحة الانتقال بين القسمين

    // مقاومة "إبطاء المتصفح للتبويبات الخلفية": بدل إنقاص ثانية واحدة فقط في كل
    // دورة (قد تتأخر الدورة نفسها ثوانٍ عدة إن كان التبويب في الخلفية)، نحسب
    // الفرق الزمني الحقيقي منذ آخر دورة عبر Date.now() وننقص بقدره بالضبط —
    // هذا يمنع العدّاد من التخلّف عن الوقت الفعلي المنقضي.
    const now = Date.now();
    const deltaSec = lastMainTickTs ? Math.max(1, Math.round((now - lastMainTickTs) / 1000)) : 1;
    lastMainTickTs = now;

    mainRemaining = Math.max(0, mainRemaining - deltaSec);
    elapsedSinceBreak += deltaSec;
    phaseRemaining -= deltaSec;

    if(sessionPhase === 1 && phaseRemaining <= 0 && mainRemaining > 0){
        startPhaseTransitionBreak(phaseRemaining); // نُمرّر أي تجاوز طفيف بدل تجاهله
        return;
    }

    updateMainDisplay();
    if(elapsedSinceBreak >= AUTO_BREAK_TRIGGER_SEC && mainRemaining > 0){
        startAutoBreak();
        return;
    }
    if(mainRemaining <= 0){
        completeMainSession();
    }
}

function updateMainDisplay(){
    // نعرض وقت القسم الحالي فقط (وليس إجمالي الجلسة) — بهذا يظهر التقسيم فعلياً
    // للطالب: يشاهد عداداً كاملاً لكل قسم على حدة بدل عداد واحد متواصل لا يبدو مقسّماً
    const minutesLeft = Math.max(0, Math.ceil(phaseRemaining / 60));
    document.getElementById("timer-display").textContent = String(minutesLeft).padStart(2, "0");
    const currentSection = sessionPhase === 1 ? firstSection : secondSection;
    document.getElementById("timer-sublabel").textContent = sectionLabel(currentSection) + " — " + t("timer.mainSessionLabel");
    const upNextEl = document.getElementById("timer-upnext");
    if(upNextEl){
        if(sessionPhase === 1){
            const secondMin = Math.round(secondSectionSeconds / 60);
            upNextEl.textContent = currentLang==='ar'
                ? `بعدها: ${sectionLabel(secondSection)} (${secondMin} دقيقة)`
                : `Then: ${sectionLabel(secondSection)} (${secondMin} min)`;
        } else {
            upNextEl.textContent = currentLang==='ar' ? "آخر قسم في الجلسة" : "Final section of the session";
        }
    }
    const ring = document.getElementById("timer-ring-fg");
    const phaseTotal = sessionPhase === 1 ? (mainTotal - secondSectionSeconds) : secondSectionSeconds;
    const progress = phaseTotal ? (phaseRemaining / phaseTotal) : 0;
    ring.style.strokeDasharray = TIMER_CIRC;
    ring.style.strokeDashoffset = TIMER_CIRC * (1 - progress);
}

/* ---------- عدّاد استراحة عام (مقاوم لإبطاء التبويبات الخلفية) — يستخدمه كل من
   الاستراحة التلقائية واستراحة الـ5 دقائق لتفادي تكرار نفس المنطق مرتين ---------- */
function startBreakCountdown(seconds, onComplete){
    clearInterval(breakInterval);
    breakTotal = seconds;
    breakRemaining = seconds;
    lastBreakTickTs = Date.now();
    updateBreakDisplay();
    breakInterval = setInterval(() => {
        const now = Date.now();
        const deltaSec = lastBreakTickTs ? Math.max(1, Math.round((now - lastBreakTickTs) / 1000)) : 1;
        lastBreakTickTs = now;
        breakRemaining = Math.max(0, breakRemaining - deltaSec);
        updateBreakDisplay();
        if(breakRemaining <= 0){
            clearInterval(breakInterval);
            onComplete();
        }
    }, 1000);
}

let lastBreakTickTs = null;
/* ---------- استراحة الانتقال بين القسمين (3 دقائق تلقائية، مع خيار تخطٍ) ---------- */
const PHASE_TRANSITION_BREAK_SEC = 3 * 60;
function startPhaseTransitionBreak(overshootSec){
    inPhaseTransitionBreak = true;
    sessionPhase = 2;
    phaseRemaining = secondSectionSeconds + (overshootSec || 0); // نُرحّل أي تجاوز طفيف بدل تجاهله
    playTransitionChime();
    const transitionMsg = currentLang==='ar'
        ? `🔄 انتهى وقت ${sectionLabel(firstSection)} — استراحة 3 دقائق قبل بدء ${sectionLabel(secondSection)} تلقائياً`
        : `🔄 ${sectionLabel(firstSection)} time is up — a 3-minute break before ${sectionLabel(secondSection)} starts automatically`;
    showToast(transitionMsg);
    notifyIfHidden(t("brand.tag"), transitionMsg);
    document.getElementById("timer-sublabel").textContent = t("timer.transitionBreakLabel");
    const skipBtn = document.getElementById("btn-skip-transition");
    if(skipBtn) skipBtn.style.display = "inline-flex";
    startBreakCountdown(PHASE_TRANSITION_BREAK_SEC, () => {
        inPhaseTransitionBreak = false;
        if(skipBtn) skipBtn.style.display = "none";
        lastMainTickTs = Date.now();
        updateMainDisplay();
    });
}
function skipPhaseTransitionBreak(){
    if(!inPhaseTransitionBreak) return;
    clearInterval(breakInterval);
    inPhaseTransitionBreak = false;
    const skipBtn = document.getElementById("btn-skip-transition");
    if(skipBtn) skipBtn.style.display = "none";
    lastMainTickTs = Date.now();
    updateMainDisplay();
    showToast(currentLang==='ar' ? `▶️ بدأ ${sectionLabel(secondSection)} الآن` : `▶️ ${sectionLabel(secondSection)} started now`);
}

/* ---------- الاستراحة التلقائية كل ساعة ---------- */
function startAutoBreak(){
    inAutoBreak = true;
    document.getElementById("timer-sublabel").textContent = t("timer.autoBreakLabel");
    playChime();
    startBreakCountdown(getAutoBreakMinutes() * 60, () => {
        inAutoBreak = false;
        elapsedSinceBreak = 0;
        lastMainTickTs = Date.now();
        playChime();
        updateMainDisplay();
        notifyIfHidden(t("brand.tag"), currentLang==='ar' ? "🍵 انتهت الاستراحة — وقت العودة للمذاكرة!" : "🍵 Break's over — time to get back to studying!");
    });
}
function updateBreakDisplay(){
    const minutesLeft = Math.max(0, Math.ceil(breakRemaining / 60));
    document.getElementById("timer-display").textContent = String(minutesLeft).padStart(2, "0");
    const ring = document.getElementById("timer-ring-fg");
    const progress = breakTotal ? (breakRemaining / breakTotal) : 0;
    ring.style.strokeDasharray = TIMER_CIRC;
    ring.style.strokeDashoffset = TIMER_CIRC * (1 - progress);
}

/* ---------- استراحة الـ5 دقائق المحدودة العدد ---------- */
let shortBreakActive = false;
let shortBreakCooldownUntil = 0;
const SHORT_BREAK_COOLDOWN_MS = 60 * 1000; // دقيقة واحدة فاصلة قبل إمكانية تفعيل استراحة قصيرة أخرى

function useShortBreak(){
    if(shortBreakActive){
        showToast(currentLang==='ar' ? "استراحتك الحالية لا تزال جارية" : "Your current break is still running");
        return;
    }
    if(Date.now() < shortBreakCooldownUntil){
        showToast(currentLang==='ar' ? "انتظر قليلاً قبل تفعيل استراحة أخرى" : "Wait a moment before starting another break");
        return;
    }
    const left = getShortBreakLimit() - getShortBreakUsedToday();
    if(left <= 0){ showToast(t("timer.shortBreakUsedUp")); return; }
    incShortBreakUsedToday();
    shortBreakActive = true;

    const wasMainSessionRunning = !!mainInterval;
    if(wasMainSessionRunning){
        // نوقف عدّاد الجلسة الرئيسية مؤقتاً فقط (الوقت المتبقي يبقى محفوظاً كما هو)
        clearInterval(mainInterval); mainInterval = null;
        document.getElementById("pause-btn").disabled = true;
    }
    inAutoBreak = false; sessionPaused = false;
    // ملاحظة: هذه استراحة اختيارية يفعّلها الطالب بنفسه، وليست "تلقائية" —
    // لذا تحمل تسمية مختلفة عن استراحة الساعة التلقائية
    document.getElementById("timer-sublabel").textContent = t("timer.shortBreakLabel");
    updateShortBreakLabel();

    startBreakCountdown(5 * 60, () => {
        shortBreakActive = false;
        shortBreakCooldownUntil = Date.now() + SHORT_BREAK_COOLDOWN_MS;
        playChime();
        if(wasMainSessionRunning && mainRemaining > 0){
            // استئناف الجلسة الرئيسية تلقائياً من حيث توقفت بالضبط
            document.getElementById("pause-btn").disabled = false;
            lastMainTickTs = Date.now();
            updateMainDisplay();
            mainInterval = setInterval(mainTick, 1000);
            notifyIfHidden(t("brand.tag"), currentLang==='ar' ? "🍵 انتهت استراحتك القصيرة — استُؤنفت جلستك تلقائياً." : "🍵 Your short break ended — your session resumed automatically.");
        } else {
            resetTimerDisplay();
        }
        updateShortBreakLabel();
    });
}

/* ---------- الإيقاف المؤقت (للظروف الطارئة الحقيقية فقط) ---------- */
function togglePauseSession(){
    if(!mainInterval) return;
    sessionPaused = !sessionPaused;
    const btn = document.getElementById("pause-btn");
    if(sessionPaused){
        pauseStartTs = Date.now();
        btn.innerHTML = '<i class="fa-solid fa-play"></i> <span>' + t("timer.resume") + "</span>";
    } else {
        pauseStartTs = null;
        lastMainTickTs = Date.now();
        document.getElementById("pause-warning").style.display = "none";
        btn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>' + t("timer.pause") + "</span>";
    }
}

/* ---------- نهاية الجلسة: نجاح أو فشل ---------- */
/* ---------- سجل الإحصائيات — يُحدَّث عند كل جلسة مكتملة ---------- */
function getCompletedDates(){
    try{ return JSON.parse(localStorage.getItem("khuta_completed_dates")) || []; }catch(e){ return []; }
}
/* أول مرة تعمل فيها هذه الميزة على جهاز الطالب، نُثبّت "نقطة بداية" التتبّع
   عند تاريخ اليوم — هذا يمنع اعتبار أيام سابقة (قبل وجود هذه الميزة أصلاً،
   أو قبل تسجيل أي بيانات إكمال) على أنها "فائتة" بالخطأ بأثر رجعي. */
function getRedDayTrackingStart(){
    let start = localStorage.getItem("khuta_redday_tracking_start");
    if(!start){
        start = new Date().toDateString();
        localStorage.setItem("khuta_redday_tracking_start", start);
    }
    return new Date(start);
}
function getMissedDaysCount(){ return parseInt(localStorage.getItem("khuta_missed_days_count")) || 0; }

function recordSessionCompletion(minutesStudied){
    const today = new Date().toDateString();
    // إجمالي الدقائق مدى الحياة
    const totalMin = parseInt(localStorage.getItem("khuta_total_minutes")) || 0;
    localStorage.setItem("khuta_total_minutes", totalMin + minutesStudied);
    // تواريخ الإكمال (لحساب الأيام الفائتة، نسبة الالتزام، ولون مسار التقدم)
    const dates = getCompletedDates();
    if(!dates.includes(today)){ dates.push(today); localStorage.setItem("khuta_completed_dates", JSON.stringify(dates)); }
    // سجل الدقائق اليومية (لمقارنة هذا الأسبوع بالأسبوع الماضي)
    let dailyLog = {};
    try{ dailyLog = JSON.parse(localStorage.getItem("khuta_daily_minutes_log")) || {}; }catch(e){}
    dailyLog[today] = (dailyLog[today] || 0) + minutesStudied;
    localStorage.setItem("khuta_daily_minutes_log", JSON.stringify(dailyLog));
}


function completeMainSession(){
    clearInterval(mainInterval); mainInterval = null;
    localStorage.removeItem("khuta_session_active");
    localStorage.removeItem("khuta_today_scale");
    setAllTodayTasksStatus("done");
    buildScheduleTable();
    updateStreak();
    recordSessionCompletion(Math.round(mainTotal / 60));
    // XP: +10 ثابتة لكل يوم يُكمَّل بالكامل (وليس لكل مهمة على حدة)، مرة واحدة فقط في اليوم
    const today = new Date().toDateString();
    if(localStorage.getItem("khuta_xp_awarded_today") !== today){
        setXP(getXP() + 10);
        localStorage.setItem("khuta_xp_awarded_today", today);
    }
    if(mainTotal >= 3 * 3600) localStorage.setItem("khuta_addict_unlocked", "1");
    renderGamification();
    checkBadges();
    exitFocusFullscreen();
    resetTimerDisplay();
    playChime();
    document.getElementById("alert-title").textContent = t("alert.title");
    document.getElementById("alert-msg").textContent = t("timer.sessionComplete");
    document.getElementById("alert-overlay").style.display = "flex";
    notifyIfHidden(t("alert.title"), t("timer.sessionComplete"));
    debouncedSync();
    if(document.getElementById("lb-share-toggle") && document.getElementById("lb-share-toggle").checked) upsertLeaderboardRow();
    maybeAskCheckin();
}

function failMainSession(){
    clearInterval(mainInterval); mainInterval = null;
    localStorage.removeItem("khuta_session_active");
    localStorage.removeItem("khuta_today_scale");
    setAllTodayTasksStatus("notstarted");
    buildScheduleTable();
    exitFocusFullscreen();
    resetTimerDisplay();
    document.getElementById("alert-title").textContent = currentLang==='ar' ? "الجلسة لم تكتمل 💔" : "Session incomplete 💔";
    document.getElementById("alert-msg").textContent = t("timer.sessionFailed");
    document.getElementById("alert-overlay").style.display = "flex";
    showToast(t("timer.pauseWarn10"));
}

function resetTimerDisplay(){
    document.getElementById("timer-display").textContent = "00";
    document.getElementById("timer-sublabel").textContent = t("timer.minutesLeft");
    document.getElementById("timer-upnext").textContent = "";
    document.getElementById("timer-ring-fg").style.strokeDashoffset = TIMER_CIRC;
    document.getElementById("pause-warning").style.display = "none";
    document.getElementById("btn-plan-session").disabled = false;
    document.getElementById("btn-custom-session").disabled = false;
    document.getElementById("pause-btn").disabled = true;
    document.getElementById("pause-btn").innerHTML = '<i class="fa-solid fa-pause"></i> <span>' + t("timer.pause") + "</span>";
    updateShortBreakLabel();
    sessionPaused = false; inAutoBreak = false;
}

const QUANT_TASK_IDS = ["found","foundEinstein","monsif","mufsec","mufrep","moassertrain","customQuant"];
const VERBAL_TASK_IDS = ["verbal","customVerbal"];

function bumpLifetimeCounter(taskId){
    const kind = QUANT_TASK_IDS.includes(taskId) ? "quant" : VERBAL_TASK_IDS.includes(taskId) ? "verbal" : null;
    if(!kind) return;
    const key = "khuta_lifetime_" + kind + "_done";
    localStorage.setItem(key, (parseInt(localStorage.getItem(key)) || 0) + 1);
}
function getLifetimeCount(kind){
    return parseInt(localStorage.getItem("khuta_lifetime_" + kind + "_done")) || 0;
}

/* ---------- ربط كل مهام اليوم بحالة واحدة تلقائياً ---------- */
function setAllTodayTasksStatus(status){
    const statuses = getTaskStatuses();
    const rows = document.querySelectorAll("#schedule-body tr[data-task-id]");
    const prevMap = {};
    rows.forEach(row => {
        const id = row.dataset.taskId;
        prevMap[id] = statuses[id] || "notstarted";
        statuses[id] = status;
    });
    // نحفظ الحالات أولاً حتى تكون awardXP/checkBadges قادرة على قراءة الحالة المحدَّثة فوراً
    localStorage.setItem("khuta_task_status", JSON.stringify(statuses));
    const pct = statusProgress(status);
    const barColor = pct===100 ? "linear-gradient(90deg, var(--teal), #38B897)" : pct===50 ? "linear-gradient(90deg, var(--gold), var(--gold-soft))" : "var(--border)";

    rows.forEach(row => {
        const id = row.dataset.taskId;
        const prev = prevMap[id];
        if(status === "done" && prev !== "done"){ bumpLifetimeCounter(id); }
        const badge = row.querySelector(".status-badge");
        if(badge) renderStatusBadge(badge, status);
        const bar = row.querySelector(".mini-progress > div");
        const label = row.querySelector(".progress-pct");
        if(bar){ bar.style.width = pct + "%"; bar.style.background = barColor; }
        if(label) label.textContent = pct + "%";

        // نحدّث بطاقة الهاتف المقابلة مباشرة أيضاً (لا تُعاد بناؤها تلقائياً هنا)
        const mobileCard = document.querySelector(`#schedule-body-mobile .mobile-task-card[data-task-id="${id}"]`);
        if(mobileCard){
            const mBadge = mobileCard.querySelector(".status-badge");
            if(mBadge) renderStatusBadge(mBadge, status);
            const mBar = mobileCard.querySelector(".mini-progress > div");
            const mLabel = mobileCard.querySelector(".progress-pct");
            if(mBar){ mBar.style.width = pct + "%"; mBar.style.background = barColor; }
            if(mLabel) mLabel.textContent = pct + "%";
        }
    });
    renderProgress();
}

/* ---------- إشعارات المتصفح — تنبّه الطالب حتى لو كان في تبويب/تطبيق آخر ---------- */
function requestNotificationPermission(){
    if(!("Notification" in window)) return;
    if(Notification.permission === "default"){
        Notification.requestPermission();
    }
}
/* يُرسل إشعاراً حقيقياً فقط إن مُنحت الصلاحية، وفقط إن كان التبويب غير ظاهر
   حالياً (لا داعي لإزعاج الطالب بإشعار وهو ينظر للصفحة أصلاً) */
function notifyIfHidden(title, body){
    try{
        if(!("Notification" in window) || Notification.permission !== "granted") return;
        if(!document.hidden) return;
        new Notification(title, { body, icon: "/icon-192.png", tag: "khuta-timer" });
    }catch(e){ /* بعض المتصفحات تمنع الإشعارات في سياقات معينة — تجاهل بصمت */ }
}

/* ---------- التركيز بملء الشاشة (أفضل جهد — المتصفح قد يمنعه أحياناً) ---------- */
function requestFocusFullscreen(){
    try{
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        if(req) req.call(el).catch(() => {});
    }catch(e){ /* تجاهل — بعض المتصفحات تمنعه دون تفاعل مباشر */ }
}
function exitFocusFullscreen(){
    try{
        if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
    }catch(e){}
}

/* استعادة حالة جلسة مقطوعة (بإغلاق التبويب أو تحديث الصفحة) عند فتح التطبيق
   من جديد. لا يمكن معرفة كم من الوقت تبقّى فعلياً بعد الانقطاع، لذا نُعامل
   أي جلسة "نشطة" وُجدت عند الإقلاع (سواء من اليوم نفسه أو يوم سابق) كجلسة
   منقطعة: نصفّر حالة مهام اليوم بأمان ونطلب من الطالب بدء جلسة جديدة. */
function checkAbandonedSession(){
    const active = localStorage.getItem("khuta_session_active");
    if(!active) return;
    localStorage.removeItem("khuta_session_active");
    localStorage.removeItem("khuta_today_scale");
    if(active === new Date().toDateString()){
        // انقطاع في نفس اليوم — على الأغلب تحديث/إغلاق للصفحة أثناء الجلسة
        const statuses = getTaskStatuses();
        let hadInProgress = false;
        Object.keys(statuses).forEach(id => { if(statuses[id] === "inprogress"){ statuses[id] = "notstarted"; hadInProgress = true; } });
        if(hadInProgress){
            localStorage.setItem("khuta_task_status", JSON.stringify(statuses));
            showToast(currentLang==='ar'
                ? "⚠️ انقطعت جلستك السابقة (تحديث/إغلاق الصفحة) — ابدأ جلسة جديدة لإكمال يومك."
                : "⚠️ Your previous session was interrupted (page refresh/close) — start a new session to complete today.");
        }
    }
}

/* صوت نهاية الجلسة/الاستراحة: نغمة صاعدة هادئة (أرجيجو) بدل صوت التنبيه الحاد */
function playChime(){
    try{
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 — لحن هادئ
        const now = ctx.currentTime;
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const start = now + i * 0.18;
            const end = start + 0.9;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(end + 0.05);
        });
    }catch(e){ /* بيئة بلا صوت — تجاهل بصمت */ }
}

/* نغمة تنبيه مميّزة للانتقال بين القسمين تحديداً — مختلفة تماماً عن نغمة
   نهاية الجلسة الهادئة، حتى يميّزها الطالب بوضوح ويعرف أن هذا انتقال قسم */
function playTransitionChime(){
    try{
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const pattern = [880, 660, 880, 660]; // نمط تنبيه أوضح وأكثر بروزاً
        const now = ctx.currentTime;
        pattern.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            const start = now + i * 0.22;
            const end = start + 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, end);
            osc.connect(gain).connect(ctx.destination);
            osc.start(start);
            osc.stop(end + 0.05);
        });
    }catch(e){ /* بيئة بلا صوت — تجاهل بصمت */ }
}

function closeAlert(){
    document.getElementById("alert-overlay").style.display = "none";
}

/* ============================================================
   25) النظام الذكي التكيّفي — يتعلّم سرعتك الحقيقية ويعدّل توزيع
   الوقت بين الكمي واللفظي تلقائياً بناءً على إجاباتك المتكررة.
   ------------------------------------------------------------
   يُسأل الطالب بشكل شبه عشوائي (وليس كل مرة) بعد إتمام الجلسة عن كل
   قسم: "كان الوقت مناسباً / احتجت أطول / أنجزت أسرع". إن تكرر نفس
   الاتجاه (أطول أو أسرع) 3 مرات متتالية، يُعاد توزيع الوقت تلقائياً
   بين الكمي واللفظي (مع تثبيت إجمالي الوقت اليومي كما اختاره الطالب).
   إن أجاب "مناسب"، تقل وتيرة الأسئلة القادمة لهذا القسم كثيراً.
   ============================================================ */
function getCheckinState(section){
    try{ return JSON.parse(localStorage.getItem("khuta_checkin_" + section)) || { streak:0, direction:null, relaxed:false, paceHistory:[] }; }
    catch(e){ return { streak:0, direction:null, relaxed:false, paceHistory:[] }; }
}
function saveCheckinState(section, state){ localStorage.setItem("khuta_checkin_" + section, JSON.stringify(state)); }

function shouldAskCheckin(section){
    const state = getCheckinState(section);
    if(state.streak > 0 && state.streak < 3) return true; // نتابع نفس النمط للتأكد خلال 3 إجابات متتالية
    if(state.relaxed) return Math.random() < 0.22; // نادر جداً بعد الاستقرار
    return Math.random() < 0.4; // شبه عشوائي في الحالة العادية
}

/* ---------- المصدر الأساسي لكل قسم — يُستخدم لحساب الوتيرة الحقيقية دقيقة/وحدة ---------- */
function getSectionPrimaryInfo(section){
    const content = getContent();
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    const days = parseInt(localStorage.getItem("khuta_plan_days")) || 45;
    const baseQty = total => Math.max(1, Math.ceil(total / days));

    if(section === "verbal"){
        return { qty: baseQty(content.ehab.totalSections), minutesPerUnit: content.ehab.minutesPerSection, unit: currentLang==='ar'?"قسم":"section" };
    }
    if(config.tMonsif) return { qty: baseQty(content.monsif.totalBanks), minutesPerUnit: content.monsif.minutesPerBank, unit: currentLang==='ar'?"بنك":"bank" };
    if(config.tMufSec) return { qty: baseQty(content.mufakkirSections.total), minutesPerUnit: content.mufakkirSections.minutesPerSection, unit: currentLang==='ar'?"قسم":"section" };
    if(config.tMufRep) return { qty: baseQty(content.mufakkirRepeated.total), minutesPerUnit: content.mufakkirRepeated.minutesPer10Questions/10, unit: currentLang==='ar'?"سؤال":"question" };
    if(config.tMoasser) return { qty: baseQty(content.moasserTraining.totalBanks), minutesPerUnit: content.moasserTraining.minutesPerBank, unit: currentLang==='ar'?"بنك":"bank" };
    if(config.found === "einstein"){
        const e = content.einstein;
        const total = config.einsteinReviewOnly ? e.reviewVideos : e.totalVideos;
        return { qty: baseQty(total), minutesPerUnit: e.minutesPerVideo, unit: currentLang==='ar'?"مقطع":"video" };
    }
    return null; // لا يوجد مصدر كمي كافٍ لحساب الوتيرة (نادر — مثلاً لم يختر أي تدريب كمي)
}

/* الدقائق الفعلية المخصَّصة لكل قسم في آخر جلسة — تُحفظ وقت البدء لأن
   khuta_today_scale يُمسح قبل وصولنا هنا */
function getSectionMinutesToday(section){
    try{
        const cached = JSON.parse(localStorage.getItem("khuta_last_session_minutes"));
        if(cached && typeof cached[section] === "number") return cached[section];
    }catch(e){}
    return section === "quant" ? getQuantMinutes() : getVerbalMinutes();
}

function maybeAskCheckin(){
    setTimeout(() => {
        const toAsk = ["verbal","quant"].filter(s => getSectionPrimaryInfo(s) && shouldAskCheckin(s));
        if(toAsk.length) askNextCheckinQuestion(toAsk, 0);
    }, 1400);
}

function askNextCheckinQuestion(sections, idx){
    if(idx >= sections.length) return;
    const section = sections[idx];
    const info = getSectionPrimaryInfo(section);
    if(!info){ askNextCheckinQuestion(sections, idx + 1); return; }
    const overlay = document.createElement("div");
    overlay.className = "overlay-screen";
    overlay.style.zIndex = "4500";
    overlay.dataset.sections = JSON.stringify(sections);
    overlay.dataset.idx = idx;
    overlay.innerHTML = `
        <div class="wizard-card" style="max-width:420px; text-align:center;">
            <h2 style="margin-bottom:6px;">${currentLang==='ar' ? `كم ${info.unit} أنجزت في ${sectionLabel(section)} اليوم؟` : `How many ${info.unit}s did you finish in ${sectionLabel(section)} today?`}</h2>
            <p class="card-sub" style="margin-bottom:16px;">${currentLang==='ar' ? `المتوقع تقريباً حسب جدولك: ${info.qty} ${info.unit}` : `Roughly expected per your schedule: ${info.qty} ${info.unit}(s)`}</p>
            <input type="number" min="0" step="0.5" id="checkin-input" class="task-input" style="text-align:center; font-size:20px; font-weight:800; margin-bottom:16px;" placeholder="${info.qty}">
            <div style="display:flex; gap:10px;">
                <button type="button" class="btn" style="flex:1;" onclick="answerCheckin('${section}', this)">${currentLang==='ar'?'تأكيد':'Confirm'}</button>
                <button type="button" class="btn-ghost" onclick="this.closest('.overlay-screen').remove()">${currentLang==='ar'?'تخطّي':'Skip'}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
}

function answerCheckin(section, btnEl){
    const overlay = btnEl.closest(".overlay-screen");
    const sections = JSON.parse(overlay.dataset.sections);
    const idx = parseInt(overlay.dataset.idx);
    const actualQty = parseFloat(document.getElementById("checkin-input").value);
    overlay.remove();

    const info = getSectionPrimaryInfo(section);
    const minutesToday = getSectionMinutesToday(section);
    if(!info || isNaN(actualQty) || actualQty <= 0 || minutesToday <= 0){ askNextCheckinQuestion(sections, idx + 1); return; }

    const actualPace = minutesToday / actualQty; // دقيقة فعلية لكل وحدة
    const expectedPace = info.minutesPerUnit;
    let direction;
    if(actualPace > expectedPace * 1.15) direction = "slower";
    else if(actualPace < expectedPace * 0.85) direction = "faster";
    else direction = "ontrack";

    const state = getCheckinState(section);
    if(direction === "ontrack"){
        state.streak = 0; state.direction = null; state.relaxed = true; state.paceHistory = [];
    } else {
        state.relaxed = false;
        state.direction === direction ? (state.streak = (state.streak||0) + 1) : (state.streak = 1);
        state.direction = direction;
        state.paceHistory = (state.paceHistory || []).concat([actualPace]).slice(-3);
        if(state.streak >= 3){
            adjustScheduleFromPace(section, state.paceHistory);
            state.streak = 0; state.direction = null; state.paceHistory = [];
        }
    }
    saveCheckinState(section, state);
    askNextCheckinQuestion(sections, idx + 1);
}

/* إعادة توزيع الوقت الفعلية — تعتمد على متوسط الوتيرة الحقيقية المُقاسة
   (دقيقة/وحدة) لكلا القسمين، مع تثبيت إجمالي الوقت اليومي كما هو تماماً. */
function adjustScheduleFromPace(section, paceHistory){
    const other = section === "quant" ? "verbal" : "quant";
    const info = getSectionPrimaryInfo(section);
    const otherInfo = getSectionPrimaryInfo(other);
    if(!info || !otherInfo) return;

    const avgPace = paceHistory.reduce((a,b) => a+b, 0) / paceHistory.length;
    const otherState = getCheckinState(other);
    const otherAvgPace = (otherState.paceHistory && otherState.paceHistory.length)
        ? otherState.paceHistory.reduce((a,b) => a+b, 0) / otherState.paceHistory.length
        : otherInfo.minutesPerUnit; // إن لم يكن للقسم الآخر بيانات فعلية بعد، نستخدم التقدير الافتراضي

    const need = avgPace * info.qty;
    const otherNeed = otherAvgPace * otherInfo.qty;
    const total = need + otherNeed;
    if(total <= 0) return;

    const MIN = 0.25, MAX = 0.75;
    let rawShare = section === "quant" ? need / total : otherNeed / total;
    const clampedShare = Math.max(MIN, Math.min(MAX, rawShare));
    localStorage.setItem("khuta_quant_share", clampedShare);

    if(rawShare >= MAX || rawShare <= MIN){
        showToast(currentLang==='ar'
            ? "⚠️ لاحظنا أنك تحتاج وقتاً إضافياً باستمرار في القسمين معاً — فكّر بزيادة وقت مذاكرتك اليومي الإجمالي من إعدادات الخطة."
            : "⚠️ You consistently need more time overall — consider increasing your total daily study time in plan settings.");
    } else {
        showToast(currentLang==='ar'
            ? "🧠 عدّلنا جدولك تلقائياً بناءً على سرعتك الفعلية — سيتغيّر توزيع الوقت بين الكمي واللفظي من الجلسة القادمة."
            : "🧠 We auto-adjusted your schedule based on your real pace — the Quant/Verbal split will change starting next session.");
    }
}


/* ============================================================
   10) حاسبة الموزونة
   ============================================================ */
function populateUniSelects(){
    const list = getUniversitiesList();
    const calcSel = document.getElementById("calc-uni");
    const goalSel = document.getElementById("prof-goal-uni");
    if(!calcSel || !goalSel) return;

    const calcPrev = calcSel.value;
    const goalPrev = goalSel.value;

    calcSel.innerHTML = `<option value="custom">${currentLang==='ar'?'مخصص (أدخل الأوزان يدوياً)':'Custom (enter weights manually)'}</option>` +
        list.map(u => `<option value="${u.id}">${uniName(u)} — ${uniCity(u)}</option>`).join("");
    goalSel.innerHTML = `<option value="">${t("profile.noneOption")}</option>` +
        list.map(u => `<option value="${u.id}">${uniName(u)}</option>`).join("");

    if(calcPrev) calcSel.value = calcPrev;
    if(goalPrev) goalSel.value = goalPrev;
    onUniChange();
}

function onUniChange(){
    const id = document.getElementById("calc-uni").value;
    const box = document.getElementById("uni-detail");
    const list = getUniversitiesList();
    const uni = list.find(u => u.id === id);

    if(!uni){
        box.classList.remove("show");
        return;
    }

    if(uni.weights){
        document.getElementById("w-high").value = uni.weights.high;
        document.getElementById("w-qat").value = uni.weights.qat;
        document.getElementById("w-tah").value = uni.weights.tah;
    }

    const stepCheckbox = document.getElementById("include-step");
    const stepWeightInput = document.getElementById("w-step");
    const gateNote = document.getElementById("step-gate-note");
    const hasNumericStepWeight = uni.weights && typeof uni.weights.step === "number";

    if(uni.step === true){
        // STEP إجباري لهذه الجامعة — لا خيار للطالب بإلغائه
        stepCheckbox.checked = true;
        stepCheckbox.disabled = true;
        stepWeightInput.readOnly = true;
        if(hasNumericStepWeight){
            stepWeightInput.value = uni.weights.step;
            gateNote.style.display = "none";
        } else {
            stepWeightInput.value = 0;
            gateNote.style.display = "block";
            gateNote.textContent = currentLang === "ar"
                ? `⚠️ STEP هنا شرط اجتياز إجباري (حد أدنى تقريبي${uni.stepMin ? " نحو " + uni.stepMin : ""}) وليس له وزن ضمن النسبة المئوية — يُشترط اجتيازه بغضّ النظر عن قيمته في الحساب.`
                : `⚠️ STEP here is a mandatory pass/fail gate (approximate minimum${uni.stepMin ? " around " + uni.stepMin : ""}), not a percentage in the formula — you must pass it regardless of the calculated score.`;
        }
    } else {
        stepCheckbox.disabled = false;
        stepWeightInput.readOnly = false;
        gateNote.style.display = "none";
        if(hasNumericStepWeight){
            stepCheckbox.checked = true;
            stepWeightInput.value = uni.weights.step;
        } else {
            stepCheckbox.checked = false;
        }
    }
    onStepToggle();

    const stepPillClass = uni.step === true ? "pill-yes" : uni.step === "partial" ? "pill-maybe" : "pill-no";
    const stepPillText = uni.step === true ? t("calc.stepRequired") : uni.step === "partial" ? t("calc.stepMaybe") : t("calc.stepNotRequired");
    const compFilled = uni.comp || 3;
    const majorsYes = (uni.stepMajorsYes && uni.stepMajorsYes[currentLang]) || DEFAULT_STEP_MAJORS.yes[currentLang];
    const majorsNo = (uni.stepMajorsNo && uni.stepMajorsNo[currentLang]) || DEFAULT_STEP_MAJORS.no[currentLang];

    box.innerHTML = `
        <div class="uni-detail-head">
            <div>
                <h3 style="font-size:17px;">${uniName(uni)}</h3>
                <div class="card-sub">${uniCity(uni)} · ${uni.type === "private" ? (currentLang==='ar'?'جامعة خاصة':'Private') : (currentLang==='ar'?'جامعة حكومية':'Public')}</div>
            </div>
            <span class="pill ${stepPillClass}"><i class="fa-solid fa-language"></i> ${stepPillText}</span>
        </div>
        ${uni.weights ? `
        <div class="uni-weights-row">
            <div class="weight-chip"><b>${uni.weights.high}%</b><span>${t("calc.wHigh")}</span></div>
            <div class="weight-chip"><b>${uni.weights.qat}%</b><span>${t("calc.wQat")}</span></div>
            <div class="weight-chip"><b>${uni.weights.tah}%</b><span>${t("calc.wTah")}</span></div>
        </div>` : `<div class="uni-note" style="margin-top:8px;">${currentLang==='ar'?'هذه الجامعة تعتمد نظام قبول خاص بها؛ عدّل الأوزان يدوياً إن رغبت بتقدير تقريبي فقط.':'This university uses its own admission system; adjust weights manually only for a rough estimate.'}</div>`}
        <div>
            <div class="card-sub" style="margin-bottom:4px;">${currentLang==='ar'?'مستوى التنافسية المتوقع':'Expected competitiveness'}</div>
            <div class="competitiveness-bar">${[1,2,3,4,5].map(n => `<span class="${n<=compFilled?'on':''}"></span>`).join("")}</div>
        </div>
        <div class="uni-note">${uniNote(uni)}</div>

        <button type="button" class="btn btn-ghost btn-sm" style="padding:8px 4px; margin-top:6px;" onclick="toggleStepMajorsPanel(this)">
            <i class="fa-solid fa-chevron-down"></i> ${currentLang==='ar' ? 'عرض التخصصات التي تتطلب STEP والتي لا تتطلبه' : 'Show majors that require / don\'t require STEP'}
        </button>
        <div class="uni-note" style="display:none; margin-top:10px;" id="step-majors-panel">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                    <b style="color:var(--rose); font-size:12px;">${currentLang==='ar' ? 'غالباً تتطلب STEP' : 'Usually require STEP'}</b>
                    <ul style="margin:6px 0 0; padding-inline-start:18px; font-size:12px; line-height:1.9;">${majorsYes.map(m => `<li>${m}</li>`).join("")}</ul>
                </div>
                <div>
                    <b style="color:var(--teal); font-size:12px;">${currentLang==='ar' ? 'غالباً لا تتطلبه' : 'Usually don\'t require it'}</b>
                    <ul style="margin:6px 0 0; padding-inline-start:18px; font-size:12px; line-height:1.9;">${majorsNo.map(m => `<li>${m}</li>`).join("")}</ul>
                </div>
            </div>
            <p style="opacity:.7; font-size:10.5px; margin-top:10px;">${currentLang==='ar' ? 'قائمة عامة تقريبية شائعة عبر أغلب الجامعات، وليست خاصة بكل كلية في هذه الجامعة تحديداً — تحقق من كليتك.' : 'A general common pattern across most universities, not specific to every college here — verify with your college.'}</p>
        </div>

        <div class="uni-note" style="opacity:.7; font-size:11.5px; margin-top:10px;"><i class="fa-solid fa-clock-rotate-left"></i> ${t("calc.lastUpdated")}: ${DATA_LAST_UPDATED}</div>
        <div class="uni-note" style="opacity:.65; font-size:11px; margin-top:6px; border-top:1px dashed var(--border); padding-top:8px;"><i class="fa-solid fa-triangle-exclamation"></i> ${currentLang==='ar' ? DATA_DISCLAIMER_AR : DATA_DISCLAIMER_EN}</div>
    `;
    box.classList.add("show");
}

function toggleStepMajorsPanel(btn){
    const panel = btn.nextElementSibling;
    const isHidden = panel.style.display === "none" || !panel.style.display;
    panel.style.display = isHidden ? "block" : "none";
    const icon = btn.querySelector("i");
    icon.classList.toggle("fa-chevron-down", !isHidden);
    icon.classList.toggle("fa-chevron-up", isHidden);
}

function onStepToggle(){
    const checked = document.getElementById("include-step").checked;
    document.getElementById("s-step").style.display = checked ? "block" : "none";
    document.getElementById("w-step-group").style.display = checked ? "block" : "none";
    if(checked){
        // إعادة توزيع تلقائية بسيطة لتبقى النسب منطقية عند التفعيل الأول
        document.getElementById("w-step").value = document.getElementById("w-step").value || 0;
    }
}

function calcScore(){
    const h = parseFloat(document.getElementById("s-high").value) || 0;
    const q = parseFloat(document.getElementById("s-qat").value) || 0;
    const tScore = parseFloat(document.getElementById("s-tah").value) || 0;
    const wh = parseFloat(document.getElementById("w-high").value) || 0;
    const wq = parseFloat(document.getElementById("w-qat").value) || 0;
    const wt = parseFloat(document.getElementById("w-tah").value) || 0;

    const stepOn = document.getElementById("include-step").checked;
    const stepScore = stepOn ? (parseFloat(document.getElementById("s-step").value) || 0) : 0;
    const wStep = stepOn ? (parseFloat(document.getElementById("w-step").value) || 0) : 0;

    const totalWeight = wh + wq + wt + wStep;
    if(Math.round(totalWeight) !== 100){
        showToast(t("calc.weightsError", {sum: totalWeight}));
        return;
    }

    const score = ((h * wh) + (q * wq) + (tScore * wt) + (stepScore * wStep)) / 100;
    const box = document.getElementById("calc-result-box");
    box.style.display = "block";
    document.getElementById("calc-result").textContent = score.toFixed(2) + "%";

    const id = document.getElementById("calc-uni").value;
    const uni = getUniversitiesList().find(u => u.id === id);
    const compEl = document.getElementById("calc-competitiveness");
    if(uni){
        const bands = {5:90, 4:85, 3:78, 2:72, 1:65};
        const threshold = bands[uni.comp] || 75;
        let msg = "";
        if(score >= threshold){
            msg = currentLang==='ar'
                ? `🎉 نسبتك ضمن النطاق التنافسي التقديري لـ${uniName(uni)} (بحسب أدائها في الأعوام الأخيرة)`
                : `🎉 Your score is within the estimated competitive range for ${uniName(uni)} (based on recent years)`;
        } else {
            msg = currentLang==='ar'
                ? `قد تحتاج لرفع نسبتك للمنافسة على التخصصات الأكثر طلباً في ${uniName(uni)}، مع وجود فرص جيدة في تخصصات أخرى داخل نفس الجامعة`
                : `You may need a higher score for the most competitive majors at ${uniName(uni)} — other majors there may still be within reach`;
        }
        const isGateOnly = uni.step === true && !(uni.weights && typeof uni.weights.step === "number");
        if(isGateOnly && stepScore > 0){
            const min = uni.stepMin || 0;
            const passed = !min || stepScore >= min;
            msg += currentLang === "ar"
                ? (passed ? ` — ✅ درجتك في STEP (${stepScore}) تجتاز الحد الأدنى التقريبي${min ? " ("+min+")" : ""}.` : ` — ⚠️ درجتك في STEP (${stepScore}) أقل من الحد الأدنى التقريبي المطلوب (${min})، تحقق من الشرط الفعلي لدى الجامعة.`)
                : (passed ? ` — ✅ Your STEP score (${stepScore}) meets the approximate minimum${min ? " ("+min+")" : ""}.` : ` — ⚠️ Your STEP score (${stepScore}) is below the approximate required minimum (${min}); verify the exact requirement with the university.`);
        }
        compEl.textContent = msg;
    } else {
        compEl.textContent = "";
    }
    if(typeof box.scrollIntoView === "function"){
        box.scrollIntoView({behavior:"smooth", block:"center"});
    }
}

/* ============================================================
   11) الملف الشخصي
   ============================================================ */
function renderProfileStats(){
    const el = document.getElementById("stat-total-hours");
    if(!el) return; // العنصر غير موجود إن لم تفتح صفحة الملف الشخصي بعد

    const totalMin = parseInt(localStorage.getItem("khuta_total_minutes")) || 0;
    document.getElementById("stat-total-hours").textContent = (totalMin / 60).toFixed(1);

    const totalLessons = getLifetimeCount("quant") + getLifetimeCount("verbal");
    document.getElementById("stat-total-lessons").textContent = totalLessons;

    // نسبة الالتزام = الأيام المكتملة ÷ الأيام التي مرّت منذ بداية الخطة
    const startStr = localStorage.getItem("khuta_plan_start");
    let commitRate = 0;
    if(startStr){
        const start = new Date(startStr); start.setHours(0,0,0,0);
        const today = new Date(); today.setHours(0,0,0,0);
        const daysPassed = Math.max(1, Math.floor((today - start) / 86400000) + 1);
        commitRate = Math.min(100, Math.round((getCompletedDates().length / daysPassed) * 100));
    }
    document.getElementById("stat-commit-rate").textContent = commitRate + "%";

    // متوسط الوقت الفعلي لكل درس/بنك
    const paceEl = document.getElementById("stat-pace");
    if(totalLessons > 0){
        const avgMin = totalMin / totalLessons;
        paceEl.textContent = avgMin.toFixed(1) + " " + (currentLang==='ar' ? "د" : "min");
    } else {
        paceEl.textContent = "—";
    }

    // مقارنة هذا الأسبوع بالأسبوع الماضي
    let dailyLog = {};
    try{ dailyLog = JSON.parse(localStorage.getItem("khuta_daily_minutes_log")) || {}; }catch(e){}
    let thisWeek = 0, lastWeek = 0;
    for(let i = 0; i < 14; i++){
        const d = new Date(); d.setDate(d.getDate() - i);
        const mins = dailyLog[d.toDateString()] || 0;
        if(i < 7) thisWeek += mins; else lastWeek += mins;
    }
    const compareEl = document.getElementById("stat-week-compare");
    if(compareEl){
        const thisH = (thisWeek/60).toFixed(1), lastH = (lastWeek/60).toFixed(1);
        let changeText;
        if(lastWeek > 0){
            const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
            const sign = pct >= 0 ? "+" : "";
            changeText = currentLang==='ar' ? `تحسنك: ${sign}${pct}%` : `Your change: ${sign}${pct}%`;
        } else {
            changeText = currentLang==='ar' ? "لا توجد بيانات كافية للمقارنة بعد" : "Not enough data to compare yet";
        }
        compareEl.innerHTML = currentLang==='ar'
            ? `<b>${currentLang==='ar'?'الأسبوع الماضي':'Last week'}:</b> ${lastH} ${currentLang==='ar'?'ساعة':'hours'}<br><b>${currentLang==='ar'?'هذا الأسبوع':'This week'}:</b> ${thisH} ${currentLang==='ar'?'ساعة':'hours'}<br><b style="color:var(--gold);">${changeText}</b>`
            : `<b>Last week:</b> ${lastH} hours<br><b>This week:</b> ${thisH} hours<br><b style="color:var(--gold);">${changeText}</b>`;
    }
}


function renderAdminTools(){
    const btn = document.getElementById("admin-tools-btn");
    if(btn) btn.style.display = isAdmin ? "" : "none";
}

/* "الوقت الحالي" حسب المشرف — يسمح بمحاكاة أي يوم في الخطة لاختبار
   التذكيرات ومسار التقدم دون انتظار مرور الوقت الحقيقي فعلياً.
   ⚠️ نطاق محدود بصدق: يُطبَّق فقط على حساب يوم الخطة الحالي وتذكيرات
   الاختبار (أكثر الحسابات حساسية للاختبار)، وليس كل استخدام لـ Date()
   في الملف بأكمله. */
function khutaNow(){
    const offsetDays = isAdmin ? (parseInt(localStorage.getItem("khuta_dev_day_offset")) || 0) : 0;
    return offsetDays ? new Date(Date.now() + offsetDays * 86400000) : new Date();
}

function adminSetXP(){
    if(!isAdmin) return;
    const v = parseInt(document.getElementById("admin-xp-input").value);
    if(isNaN(v)) return;
    setXP(v);
    renderGamification();
    showToast("✅ XP = " + v);
}
function adminSetStreak(){
    if(!isAdmin) return;
    const v = parseInt(document.getElementById("admin-streak-input").value);
    if(isNaN(v)) return;
    localStorage.setItem("khuta_streak", v);
    localStorage.setItem("khuta_streak_last", new Date().toDateString());
    renderGamification();
    showToast("✅ Streak = " + v);
}
function adminJumpToDay(){
    if(!isAdmin) return;
    const targetDay = parseInt(document.getElementById("admin-day-input").value);
    const totalDays = parseInt(localStorage.getItem("khuta_plan_days")) || 0;
    const planStart = localStorage.getItem("khuta_plan_start");
    if(isNaN(targetDay) || !planStart || !totalDays) { showToast("أنشئ خطة أولاً"); return; }
    const start = new Date(planStart); start.setHours(0,0,0,0);
    const today = new Date(); today.setHours(0,0,0,0);
    const realDaysPassed = Math.floor((today - start) / 86400000) + 1;
    const offset = targetDay - realDaysPassed;
    localStorage.setItem("khuta_dev_day_offset", offset);
    renderProgress();
    checkExamReminder();
    showToast(`🕐 محاكاة اليوم ${targetDay} من الخطة`);
}
function adminResetDay(){
    if(!isAdmin) return;
    localStorage.removeItem("khuta_dev_day_offset");
    renderProgress();
    showToast("↩️ عدت لليوم الحقيقي");
}
function adminStartFreeTimer(){
    if(!isAdmin) return;
    const mins = parseFloat(document.getElementById("admin-timer-input").value);
    if(isNaN(mins) || mins <= 0) return;
    document.getElementById("admin-overlay").style.display = "none";
    switchTab("dashboard");
    // مؤقّت حر بدون أي قيود حد أدنى — للاختبار فقط
    clearInterval(mainInterval); clearInterval(breakInterval);
    mainTotal = Math.round(mins * 60);
    mainRemaining = mainTotal;
    elapsedSinceBreak = 0; sessionPaused = false; pauseStartTs = null; inAutoBreak = false;
    firstSection = getStartSection(); secondSection = firstSection === "quant" ? "verbal" : "quant";
    sessionPhase = 1; phaseRemaining = mainTotal; secondSectionSeconds = 0; // مرحلة واحدة فقط لتبسيط الاختبار الحر
    lastMainTickTs = Date.now();
    document.getElementById("btn-plan-session").disabled = true;
    document.getElementById("btn-custom-session").disabled = true;
    document.getElementById("pause-btn").disabled = false;
    updateMainDisplay();
    mainInterval = setInterval(mainTick, 1000);
    showToast(`🧪 مؤقّت اختبار حر: ${mins} دقيقة`);
}


/* ============================================================
   26) تخصيص لوحة التحكم — إظهار/إخفاء بطاقات، بجانب الترتيب بالأسهم
   الموجود مسبقاً في initDashboardReorder/moveDashCard
   ============================================================ */
const DASHBOARD_CARDS = [
    { id: "dash-card-progress", labelAr: "مسار التقدم", labelEn: "Progress Path", defaultVisible: true },
    { id: "dash-card-table", labelAr: "جدول المهام", labelEn: "Task Table", defaultVisible: true },
    { id: "dash-card-timer", labelAr: "وضع التركيز (المؤقت)", labelEn: "Focus Mode (Timer)", defaultVisible: true },
    { id: "dash-card-badges", labelAr: "الأوسمة والتروفيات", labelEn: "Badges & Trophies", defaultVisible: false },
    { id: "dash-card-community", labelAr: "المجتمع", labelEn: "Community", defaultVisible: false },
];

function getDashboardCardVisibility(){
    try{ return JSON.parse(localStorage.getItem("khuta_dashboard_visible")) || {}; }catch(e){ return {}; }
}

function applyDashboardCardVisibility(){
    const saved = getDashboardCardVisibility();
    DASHBOARD_CARDS.forEach(c => {
        const el = document.getElementById(c.id);
        if(!el) return;
        const visible = Object.prototype.hasOwnProperty.call(saved, c.id) ? saved[c.id] : c.defaultVisible;
        el.style.display = visible ? "" : "none";
    });
    const badgesCard = document.getElementById("dash-card-badges");
    if(badgesCard && badgesCard.style.display !== "none") renderDashboardBadges();
    const communityCard = document.getElementById("dash-card-community");
    if(communityCard && communityCard.style.display !== "none") initCommunityIfNeeded();
}

function toggleDashboardCustomizer(){
    const panel = document.getElementById("dashboard-customizer-panel");
    const opening = panel.style.display === "none";
    panel.style.display = opening ? "block" : "none";
    if(opening) populateDashboardCustomizerList();
}

function populateDashboardCustomizerList(){
    const list = document.getElementById("dashboard-customizer-list");
    const saved = getDashboardCardVisibility();
    list.innerHTML = DASHBOARD_CARDS.map(c => {
        const visible = Object.prototype.hasOwnProperty.call(saved, c.id) ? saved[c.id] : c.defaultVisible;
        return `
        <label class="path-card ${visible ? 'selected' : ''}" style="cursor:pointer; display:flex; align-items:center; gap:10px; padding:12px 14px;" onclick="toggleDashboardCardCheckbox(this, '${c.id}')">
            <input type="checkbox" ${visible ? "checked" : ""} style="width:18px; height:18px;">
            <span>${currentLang==='ar' ? c.labelAr : c.labelEn}</span>
        </label>`;
    }).join("");
}

function toggleDashboardCardCheckbox(labelEl, cardId){
    const checkbox = labelEl.querySelector("input");
    const visible = checkbox.checked;
    labelEl.classList.toggle("selected", visible);
    const saved = getDashboardCardVisibility();
    saved[cardId] = visible;
    localStorage.setItem("khuta_dashboard_visible", JSON.stringify(saved));
    applyDashboardCardVisibility();
    if(visible) initDashboardReorder();
}

function resetDashboardCustomization(){
    localStorage.removeItem("khuta_dashboard_visible");
    localStorage.removeItem("khuta_dashboard_order");
    const container = document.getElementById("dashboard-cards");
    DASHBOARD_CARDS.forEach(c => {
        const el = document.getElementById(c.id);
        if(el) container.appendChild(el); // يعيد الترتيب الافتراضي (ترتيب ظهورها في HTML)
    });
    applyDashboardCardVisibility();
    populateDashboardCustomizerList(); // تحديث حالة الـcheckboxes المعروضة فوراً في نفس اللوحة
    showToast(currentLang==='ar' ? "↩️ عادت اللوحة لوضعها الافتراضي" : "↩️ Dashboard reset to default");
}

function renderDashboardBadges(){
    const grid = document.getElementById("badges-grid-dashboard");
    if(!grid) return;
    const earned = getEarnedBadges();
    const visible = BADGES.filter(b => !b.secret || earned.includes(b.id));
    grid.innerHTML = visible.map(b => `
        <div class="badge-chip ${earned.includes(b.id) ? "earned" : "locked"}" title="${currentLang==='ar'?b.ar:b.en}">
            <i class="fa-solid ${b.icon}"></i>
            <span>${currentLang==='ar'?b.ar:b.en}</span>
        </div>`).join("");
}

/* ============================================================
   28) القسمان الجديدان — خلف علمي تفعيل (FEATURE_EXAM_SIMULATOR /
   FEATURE_TUTORS_DIRECTORY أعلى الملف). طالما الأعلام false لا يظهر أي
   أثر لهما في الواجهة إطلاقاً — لا رابط قائمة، لا قسم يمكن الوصول إليه.
   ============================================================ */
/* ============================================================
   29) قفل تمرير الخلفية أثناء فتح أي نافذة منبثقة — هذا كان سبب شعور
   نوافذ مثل معالج الإعداد بأنها "غير ثابتة" على الهاتف: النافذة نفسها
   position:fixed فعلاً، لكن الصفحة خلفها كانت تبقى قابلة للتمرير، فيبدو
   وكأن كل شيء يتحرك معاً. نراقب كل نوافذ .overlay-screen مركزياً بدل
   البحث عن كل مكان يفتح/يغلق نافذة يدوياً في الكود (كثيرة ومتفرقة).
   ============================================================ */
function initOverlayScrollLock(){
    const overlays = document.querySelectorAll(".overlay-screen");
    const updateLock = () => {
        const anyOpen = Array.from(document.querySelectorAll(".overlay-screen")).some(el => {
            const display = el.style.display || getComputedStyle(el).display;
            return display !== "none";
        });
        document.body.style.overflow = anyOpen ? "hidden" : "";
    };
    const observer = new MutationObserver(updateLock);
    overlays.forEach(el => observer.observe(el, { attributes:true, attributeFilter:["style"] }));
    // النوافذ المُنشأة ديناميكياً لاحقاً (كنافذة تذكير الاختبار) تُضاف تلقائياً هنا أيضاً
    const bodyObserver = new MutationObserver((mutations) => {
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if(node.nodeType === 1 && node.classList && node.classList.contains("overlay-screen")){
                    observer.observe(node, { attributes:true, attributeFilter:["style"] });
                    updateLock();
                }
            });
        });
    });
    bodyObserver.observe(document.body, { childList:true });
    updateLock();
}

function applyFeatureFlags(){
    document.getElementById("nav-exam-simulator").style.display = FEATURE_EXAM_SIMULATOR ? "" : "none";
    document.getElementById("mobile-nav-exam-simulator").style.display = FEATURE_EXAM_SIMULATOR ? "" : "none";
    document.getElementById("nav-tutors").style.display = FEATURE_TUTORS_DIRECTORY ? "" : "none";
    document.getElementById("mobile-nav-tutors").style.display = FEATURE_TUTORS_DIRECTORY ? "" : "none";
}

/* ---------- الاختبارات المحاكية — أساس فقط، التفاصيل الكاملة (استخراج
   الأسئلة من PDF، التوزيع، التصحيح) ستُبنى لاحقاً كما اتُّفق ---------- */
function startExamSimulation(){
    const type = document.querySelector('input[name="examsim_type"]:checked').value;
    const timed = document.querySelector('input[name="examsim_timed"]:checked').value;
    showToast(currentLang==='ar'
        ? `🚧 قاعدة الاختبارات المحاكية جاهزة (${type} / ${timed}) — بنك الأسئلة قيد الإعداد وسيُفعَّل قريباً`
        : `🚧 Exam simulator foundation ready (${type} / ${timed}) — question bank coming soon`);
}

/* ---------- المدرّسون الخصوصيون — قائمة حقيقية مدعومة بـSupabase.
   الإضافة/الحذف حصراً للمشرف؛ التقييم والتعليق متاحان لأي طالب. ---------- */
async function renderTutors(){
    const grid = document.getElementById("tutors-grid");
    const addBtn = document.getElementById("tutors-admin-add-btn");
    if(addBtn) addBtn.style.display = isAdmin ? "" : "none";
    if(!grid) return;
    if(!sb){ grid.innerHTML = `<div class="empty-note">${currentLang==='ar'?'الخدمة غير متاحة حالياً':'Service unavailable right now'}</div>`; return; }
    const { data, error } = await sb.from("tutors").select("*").order("created_at", { ascending:false });
    if(error || !data || data.length === 0){
        grid.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا يوجد مدرّسون مُدرَجون بعد':'No tutors listed yet'}</div>`;
        return;
    }
    grid.innerHTML = data.map(tt => `
        <div class="link-card" style="cursor:default; align-items:flex-start; text-align:start;">
            <div style="display:flex; align-items:center; gap:10px; width:100%;">
                <div class="ic"><i class="fa-solid fa-chalkboard-user"></i></div>
                <div style="flex:1; min-width:0;">
                    <b style="display:block;">${escapeHtml(tt.name)}</b>
                    <small>${tt.mode==='online' ? (currentLang==='ar'?'عن بُعد':'Online') : (currentLang==='ar'?'حضوري':'In-person')} ${tt.location ? '· '+escapeHtml(tt.location) : ''}</small>
                </div>
                ${isAdmin ? `<div class="icon-action" onclick="deleteTutor(${tt.id})" title="حذف"><i class="fa-solid fa-trash"></i></div>` : ""}
            </div>
            ${tt.notes ? `<p style="font-size:12.5px; color:var(--text-2); margin-top:8px;">${escapeHtml(tt.notes)}</p>` : ""}
            ${tt.phone ? `<a href="https://wa.me/${tt.phone.replace(/[^0-9]/g,'')}" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="margin-top:10px; width:100%;"><i class="fa-brands fa-whatsapp"></i> ${currentLang==='ar'?'تواصل':'Contact'}</a>` : ""}
        </div>`).join("");
}

function openAddTutorForm(){
    if(!isAdmin) return;
    const name = prompt(currentLang==='ar' ? "اسم المدرّس:" : "Tutor name:");
    if(!name) return;
    const phone = prompt(currentLang==='ar' ? "رقم الهاتف (واتساب):" : "Phone (WhatsApp):") || "";
    const location = prompt(currentLang==='ar' ? "الموقع:" : "Location:") || "";
    const mode = confirm(currentLang==='ar' ? "هل يدرّس عن بُعد؟ (إلغاء = حضوري)" : "Teaches online? (Cancel = in-person)") ? "online" : "in_person";
    const notes = prompt(currentLang==='ar' ? "ملاحظات إضافية (اختياري):" : "Additional notes (optional):") || "";
    addTutor({ name, phone, location, mode, notes });
}

async function addTutor(tutor){
    if(!sb || !isAdmin) return;
    const { error } = await sb.from("tutors").insert(tutor);
    if(error){ showToast(currentLang==='ar'?'تعذّرت الإضافة':'Could not add'); console.error(error); return; }
    showToast(currentLang==='ar' ? "✅ أُضيف المدرّس" : "✅ Tutor added");
    renderTutors();
}

async function deleteTutor(id){
    if(!sb || !isAdmin) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا المدرّس؟" : "Delete this tutor?")) return;
    const { error } = await sb.from("tutors").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّر الحذف':'Could not delete'); return; }
    renderTutors();
}

function loadProfileForm(){
    document.getElementById("prof-name").value = localStorage.getItem("khuta_name") || "";
    document.getElementById("prof-last").value = localStorage.getItem("khuta_last") || "";
    document.getElementById("prof-birth").value = localStorage.getItem("khuta_birth") || "";
    document.getElementById("prof-gender").value = localStorage.getItem("khuta_gender") || "male";
    document.getElementById("prof-track").value = localStorage.getItem("khuta_track") || "science";
    document.getElementById("prof-goal-score").value = localStorage.getItem("khuta_goal_score") || "";
    document.getElementById("prof-exam-date").value = localStorage.getItem("khuta_exam_date") || "";

    const avatar = localStorage.getItem("khuta_avatar");
    if(avatar){
        document.getElementById("avatar-img").src = avatar;
        document.getElementById("avatar-img").style.display = "block";
        document.getElementById("avatar-placeholder").style.display = "none";
    }
    updateProfileHeader();
}

function updateProfileHeader(){
    const name = localStorage.getItem("khuta_name") || "";
    const last = localStorage.getItem("khuta_last") || "";
    document.getElementById("profile-display-name").textContent = `${name} ${last}`.trim() || "—";

    const goalId = localStorage.getItem("khuta_goal_uni");
    const uni = getUniversitiesList().find(u => u.id === goalId);
    const goalScore = localStorage.getItem("khuta_goal_score");
    const goalEl = document.getElementById("profile-display-goal");
    if(uni){
        goalEl.textContent = (currentLang==='ar' ? "الهدف: " : "Target: ") + uniName(uni) + (goalScore ? ` (${goalScore}%)` : "");
    } else {
        goalEl.textContent = t("profile.noGoal");
    }
}

function handleAvatarUpload(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        localStorage.setItem("khuta_avatar", ev.target.result);
        document.getElementById("avatar-img").src = ev.target.result;
        document.getElementById("avatar-img").style.display = "block";
        document.getElementById("avatar-placeholder").style.display = "none";
    };
    reader.readAsDataURL(file);
}

function saveProfile(e){
    e.preventDefault();
    localStorage.setItem("khuta_name", document.getElementById("prof-name").value.trim());
    localStorage.setItem("khuta_last", document.getElementById("prof-last").value.trim());
    localStorage.setItem("khuta_birth", document.getElementById("prof-birth").value);
    localStorage.setItem("khuta_gender", document.getElementById("prof-gender").value);
    localStorage.setItem("khuta_track", document.getElementById("prof-track").value);
    localStorage.setItem("khuta_goal_uni", document.getElementById("prof-goal-uni").value);
    localStorage.setItem("khuta_goal_score", document.getElementById("prof-goal-score").value);

    updateWelcomeText();
    updateProfileHeader();
    showToast(t("toast.saved"));
    debouncedSync();
    return false;
}

/* ============================================================
   12) نموذج الملاحظات — إرسال مباشر وبسيط
   ------------------------------------------------------------
   يحاول أولاً عبر fetch (الطريقة الحديثة الموصى بها من Formspree).
   إن فشلت لأي سبب (شبكة، CORS، فتح الملف مباشرة بدون سيرفر محلي...)
   يلجأ تلقائياً لطريقة احتياطية قديمة وموثوقة: نموذج مخفي يُرسل داخل
   iframe مخفي، وهي طريقة لا تتأثر بقيود CORS إطلاقاً.
   ⚠️ تذكير: أول رسالة يُرسلها أي أحد يجب أن "تُفعّل" النموذج — افتح بريد
   sonyaloy9@gmail.com (وتحقق من الأرشيف/Spam) وابحث عن رسالة من Formspree
   واضغط رابط التأكيد فيها. قبل هذه الخطوة لن تصل أي رسائل مهما كان الكود.
   ============================================================ */
async function sendFeedback(){
    const textEl = document.getElementById("feedback-text");
    const text = textEl.value.trim();
    if(!text){ showToast(t("feedback.empty")); return; }

    const btn = document.getElementById("feedback-send-btn");
    const name = `${localStorage.getItem("khuta_name")||""} ${localStorage.getItem("khuta_last")||""}`.trim() || "طالب خُطى";

    if(!FEEDBACK_ENDPOINT){
        const subject = encodeURIComponent("ملاحظة على تطبيق خُطى من " + name);
        const body = encodeURIComponent(text + "\n\n---\nمرسلة عبر تطبيق خُطى");
        window.location.href = `mailto:${APP_OWNER_EMAIL}?subject=${subject}&body=${body}`;
        showToast(t("feedback.opened"));
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (currentLang==='ar' ? 'جارٍ الإرسال...' : 'Sending...');

    const payload = { name, message: text, app: "خُطى — ملاحظة طالب", _subject: "ملاحظة جديدة من تطبيق خُطى" };
    let success = false;

    try{
        const formData = new FormData();
        Object.keys(payload).forEach(k => formData.append(k, payload[k]));
        const res = await fetch(FEEDBACK_ENDPOINT, { method:"POST", headers:{ "Accept":"application/json" }, body: formData });
        if(res.ok){
            success = true;
        } else {
            const bodyText = await res.text().catch(() => "");
            console.error("[خُطى] Formspree رفض الطلب — الحالة:", res.status, "التفاصيل:", bodyText);
        }
    }catch(err){
        console.error("[خُطى] فشل fetch إلى Formspree (على الأغلب CORS أو تشغيل الملف مباشرة بدون سيرفر):", err);
    }

    if(!success){
        try{
            await submitViaHiddenIframe(FEEDBACK_ENDPOINT, payload);
            success = true; // لا يمكن قراءة استجابة الـ iframe لتأكيد النجاح فعلياً، نفترض النجاح
            console.warn("[خُطى] تم الإرسال عبر الطريقة الاحتياطية (iframe) — لا يمكن تأكيد الوصول برمجياً، تحقق من بريدك.");
        }catch(err2){
            console.error("[خُطى] فشلت الطريقة الاحتياطية أيضاً:", err2);
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>' + t("feedback.send") + "</span>";

    if(success){
        textEl.value = "";
        showFeedbackSuccess();
    } else {
        showToast(t("feedback.error"));
    }
}

/* إرسال نموذج مخفي داخل iframe مخفي — لا يخضع لقيود CORS لأنه ليس طلب fetch،
   يُستخدم فقط كحل احتياطي إن فشل fetch. */
function submitViaHiddenIframe(url, fields){
    return new Promise((resolve) => {
        const iframeName = "khuta-hidden-frame-" + Date.now();
        const iframe = document.createElement("iframe");
        iframe.name = iframeName;
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        const form = document.createElement("form");
        form.action = url;
        form.method = "POST";
        form.target = iframeName;
        Object.keys(fields).forEach(key => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = fields[key];
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();

        setTimeout(() => {
            form.remove();
            iframe.remove();
            resolve(true);
        }, 1200);
    });
}

/* تقرير صامت للمطوّر عند إضافة الطالب مصدراً مخصصاً (لفظياً أو كمياً) وكتب
   اسمه — يساعدك على ملاحظة تكرار نفس المصدر بين طلاب مختلفين لتقييم إضافته
   رسمياً للتطبيق. لا يُرسل شيئاً إن ترك الطالب اسم المصدر فارغاً. */
async function reportCustomSource(kind, data){
    if(!data || !data.name) return;
    const name = `${localStorage.getItem("khuta_name")||""} ${localStorage.getItem("khuta_last")||""}`.trim() || "طالب خُطى";
    // تخزين منظّم في Supabase (راجعه من Table Editor → custom_source_reports)
    if(sb){
        try{
            await sb.from("custom_source_reports").insert({
                kind, source_name: data.name, origin: data.origin || null,
                unit: data.unit, total: data.total, qper: data.qper || null, reporter_name: name,
            });
        }catch(e){ /* تجاهل بصمت — البريد أدناه هو النسخة الاحتياطية */ }
    }
    if(!FEEDBACK_ENDPOINT) return;
    const payload = {
        name,
        app: "خُطى — تقرير مصدر مخصص",
        _subject: `مصدر ${kind === "verbal" ? "لفظي" : "كمي"} مخصص جديد: ${data.name}`,
        message: `القسم: ${kind === "verbal" ? "لفظي" : "كمي"}\nاسم المصدر: ${data.name}\nمصدره (من أين): ${data.origin || "لم يُذكر"}\nوحدة العد: ${data.unit}\nالإجمالي: ${data.total}\nملاحظة الأسئلة لكل وحدة: ${data.qper || "—"}`
    };
    try{
        const formData = new FormData();
        Object.keys(payload).forEach(k => formData.append(k, payload[k]));
        await fetch(FEEDBACK_ENDPOINT, { method:"POST", headers:{ "Accept":"application/json" }, body: formData });
    }catch(err){
        try{ await submitViaHiddenIframe(FEEDBACK_ENDPOINT, payload); }catch(e2){ /* تجاهل — تقرير غير حرج */ }
    }
}

function showFeedbackSuccess(){
    const box = document.getElementById("feedback-success");
    box.style.display = "flex";
    setTimeout(() => { box.style.display = "none"; }, 4000);
}

function initContactLinks(){
    const digits = APP_WHATSAPP_NUMBER.replace(/\D/g, "");
    const intl = digits.startsWith("966") ? digits : "966" + digits.replace(/^0/, "");
    const waLink = document.getElementById("whatsapp-link");
    if(waLink){
        waLink.href = `https://wa.me/${intl}`;
        document.getElementById("whatsapp-number-display").textContent = APP_WHATSAPP_NUMBER;
    }
    const tkLink = document.getElementById("tiktok-link");
    if(tkLink && APP_TIKTOK_URL){
        tkLink.href = APP_TIKTOK_URL;
        tkLink.style.display = "";
    }
    const tgLink = document.getElementById("telegram-link");
    if(tgLink && APP_TELEGRAM_URL){
        tgLink.href = APP_TELEGRAM_URL;
        tgLink.style.display = "";
    }
    const supportLink = document.getElementById("support-link");
    if(supportLink && APP_SUPPORT_URL){
        supportLink.href = APP_SUPPORT_URL;
        supportLink.style.display = "inline-block";
    }
}

/* ============================================================
   14) لوحة المطوّر — محلية فقط، مخفية خلف رابط سرّي
   ------------------------------------------------------------
   ⚠️ صادقة بوضوح: بما أن كل بيانات الطلاب مخزّنة محلياً في متصفح كل طالب
   (localStorage) ولا يوجد خادم مركزي، فهذه اللوحة لا تعرض إلا بيانات
   الجهاز الحالي الذي تفتح منه — لا يمكن لأي صفحة أن "ترى" بيانات أجهزة
   طلاب آخرين. للاطلاع على ملاحظات الطلاب والمصادر المخصصة عبر الجميع،
   المصدر الحقيقي الموحد هو بريدك المرتبط بـ Formspree.
   الوصول: أضف #khuta-dev-2026 في نهاية رابط الصفحة. غيّر هذا النص
   السرّي إلى أي شيء تريده في DEV_PANEL_HASH أدناه.
   ============================================================ */
const DEV_PANEL_HASH = "#khuta-dev-2026";

function checkDevPanel(){
    if(window.location.hash === DEV_PANEL_HASH){
        const box = document.getElementById("dev-data-box");
        const dump = {};
        Object.keys(localStorage).filter(k => k.startsWith("khuta_")).forEach(k => {
            try{ dump[k] = JSON.parse(localStorage.getItem(k)); }catch(e){ dump[k] = localStorage.getItem(k); }
        });
        box.textContent = JSON.stringify(dump, null, 2);
        document.getElementById("dev-overlay").style.display = "flex";
    }
}

function copyDevData(){
    const text = document.getElementById("dev-data-box").textContent;
    if(navigator.clipboard){
        navigator.clipboard.writeText(text).then(() => showToast("تم نسخ البيانات ✅"));
    }
}

function clearAllLocalData(){
    if(!confirm("سيُحذف كل شيء مخزّن في هذا الجهاز (الاسم، الخطة، الملف الشخصي...) نهائياً. متابعة؟")) return;
    Object.keys(localStorage).filter(k => k.startsWith("khuta_")).forEach(k => localStorage.removeItem(k));
    showToast("تم مسح بيانات هذا الجهاز");
    setTimeout(() => window.location.reload(), 800);
}

/* ============================================================
   16) الحساب السحابي — تسجيل دخول، تسجيل خروج، مزامنة
   ------------------------------------------------------------
   الفكرة: الطالب يستخدم التطبيق كضيف بشكل طبيعي بالكامل (localStorage
   فقط، بدون حساب). إن أراد حفظ تقدمه ونقله لجهاز آخر، ينشئ "حساباً"
   باسم مستخدم وكلمة مرور فقط. داخلياً نحوّل اسم المستخدم إلى بريد وهمي
   (username@khuta.local) ونستخدم نظام Supabase Auth الحقيقي والآمن
   (تشفير كلمات المرور وجلسات JWT مُدارة من Supabase نفسها) — هذا أأمن
   بكثير من بناء نظام تحقق مخصص من الصفر.
   ============================================================ */
let signupMode = false;
function toggleSignupMode(){
    signupMode = !signupMode;
    document.getElementById("acc-password2-group").style.display = signupMode ? "block" : "none";
    document.getElementById("signup-toggle-label").textContent = signupMode
        ? (currentLang==='ar' ? "لدي حساب بالفعل" : "I already have an account")
        : t("account.signup");
    const signInBtn = document.querySelector('[onclick="signInAccount()"]');
    if(signInBtn){
        signInBtn.setAttribute("onclick", signupMode ? "signUpAccount()" : "signInAccount()");
        signInBtn.querySelector("span").textContent = signupMode ? t("account.createBtn") : t("account.signin");
    }
}

let loginSignupMode = false;
function toggleLoginSignupMode(){
    loginSignupMode = !loginSignupMode;
    document.getElementById("login-password2-group").style.display = loginSignupMode ? "block" : "none";
    document.getElementById("login-signup-toggle-label").textContent = loginSignupMode
        ? (currentLang==='ar' ? "لدي حساب بالفعل" : "I already have an account")
        : t("account.signup");
}
async function completePasswordRecovery(){
    if(!sb) return;
    const p1 = document.getElementById("recovery-new-pass-1").value;
    const p2 = document.getElementById("recovery-new-pass-2").value;
    if(p1.length < 6){ showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(p1 !== p2){ showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){
        console.error("[خُطى] تعذّر تعيين كلمة المرور الجديدة:", error);
        showToast(currentLang==='ar' ? "تعذّر حفظ كلمة المرور" : "Couldn't save the password");
        return;
    }
    document.getElementById("password-recovery-overlay").style.display = "none";
    showToast(currentLang==='ar' ? "✅ تم تعيين كلمة مرورك الجديدة" : "✅ Your new password is set");
    location.reload();
}

function toggleForgotPasswordForm(){
    const box = document.getElementById("forgot-password-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function sendPasswordReset(){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable"); return; }
    const email = document.getElementById("forgot-email-input").value.trim();
    if(!email || !email.includes("@")){
        showToast(currentLang==='ar' ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email address");
        return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split("#")[0] });
    // نعرض نفس الرسالة سواء وُجد الحساب أم لا (ممارسة أمان قياسية — لا نكشف
    // للزائر أي بريد مرتبط بحساب فعلي وأيها ليس كذلك)
    document.getElementById("forgot-email-input").value = "";
    document.getElementById("forgot-password-form").style.display = "none";
    showToast(currentLang==='ar'
        ? "📧 إن كان هذا البريد مرتبطاً بحساب، وصلته رسالة إعادة تعيين كلمة المرور."
        : "📧 If this email is linked to an account, a password reset message was sent to it.");
    if(error) console.error("[خُطى] استجابة resetPasswordForEmail:", error);
}

function loginScreenSignIn(){
    if(loginSignupMode){
        signUpWithCreds("login-username", "login-password", "login-password2", true);
    } else {
        signInWithCreds("login-username", "login-password", true);
    }
}

function continueAsGuest(){
    document.getElementById("login-overlay").style.display = "none";
    if(!localStorage.getItem("khuta_name")) localStorage.setItem("khuta_name", currentLang === "ar" ? "ضيف" : "Guest");
    updateWelcomeText();
    if(!localStorage.getItem("khuta_plan_days")){
        document.getElementById("setup-overlay").style.display = "flex";
    }
}

async function signInWithGoogle(){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable"); return; }
    const { error } = await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.href.split("#")[0] } });
    if(error) showToast(currentLang==='ar' ? "تعذّر الدخول عبر Google — تأكد أن المزوّد مفعّل في Supabase" : "Google sign-in failed — check the provider is enabled in Supabase");
}
function finishLoginBoot(){
    if(!localStorage.getItem("khuta_plan_days")){
        document.getElementById("setup-overlay").style.display = "flex";
    } else {
        buildScheduleTable();
        renderProgress();
    }
    updateShortBreakLabel();
    updateCustomMinHint();
    initDashboardReorder();
    applyDashboardCardVisibility();
    updateExamCountdownWidget();
    applyFeatureFlags();
    initOverlayScrollLock();
}

/* التقاط نجاح تسجيل الدخول عبر Google/Apple عند العودة من صفحة المزوّد */
function initOAuthListener(){
    if(!sb) return;
    sb.auth.onAuthStateChange(async (event, session) => {
        if(event === "PASSWORD_RECOVERY"){
            document.getElementById("login-overlay").style.display = "none";
            document.getElementById("password-recovery-overlay").style.display = "flex";
            return;
        }
        if(event !== "SIGNED_IN" || !session || !session.user) return;
        const existing = getSession();
        if(existing && existing.uid === session.user.id) return; // جلسة معروفة أصلاً
        if(session.user.is_anonymous) return; // تجاهل الدخول المجهول التلقائي للمجتمع

        const uid = session.user.id;
        const { data: row } = await sb.from("user_data").select("data, username").eq("id", uid).maybeSingle();
        if(row){
            setSession({ uid, username: row.username });
            if(row.data) applyRemoteSnapshot(row.data);
        } else {
            const displayName = session.user.user_metadata && (session.user.user_metadata.full_name || session.user.user_metadata.name);
            const username = displayName || (currentLang==='ar' ? "طالب" : "Student") + "_" + uid.slice(0,5);
            await sb.from("user_data").insert({ id: uid, username, data: collectLocalSnapshot() });
            setSession({ uid, username });
        }
        document.getElementById("login-overlay").style.display = "none";
        updateWelcomeText();
        renderAccountUI();
        checkAdminStatus();
        showToast(currentLang==='ar' ? "أهلاً بك 👋" : "Welcome 👋");
        finishLoginBoot();
    });
}

function usernameToEmail(username){
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    return `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

function getSession(){ try{ return JSON.parse(localStorage.getItem("khuta_session")) || null; }catch(e){ return null; } }
function setSession(s){ localStorage.setItem("khuta_session", JSON.stringify(s)); }
function clearSession(){ localStorage.removeItem("khuta_session"); }

/* ---------- القفل التصاعدي ضد محاولات التخمين ---------- */
function getLockState(username){
    try{ return JSON.parse(localStorage.getItem("khuta_lock_" + username)) || { fails:0, lockUntil:0, lastAttempt:0 }; }
    catch(e){ return { fails:0, lockUntil:0, lastAttempt:0 }; }
}
function saveLockState(username, state){ localStorage.setItem("khuta_lock_" + username, JSON.stringify(state)); }

function lockDurationMs(fails){
    // 3 محاولات فاشلة → دقيقة، ثم 5 دقائق، ثم 30 دقيقة، وتبقى 30 دقيقة كحد أقصى بعدها
    if(fails < 3) return 0;
    if(fails === 3) return 60 * 1000;
    if(fails === 4) return 5 * 60 * 1000;
    return 30 * 60 * 1000;
}

function checkLock(username){
    const state = getLockState(username);
    const now = Date.now();
    // تصفير تلقائي كامل بعد مرور 24 ساعة على آخر محاولة
    if(state.lastAttempt && (now - state.lastAttempt) > 24 * 60 * 60 * 1000){
        saveLockState(username, { fails:0, lockUntil:0, lastAttempt:0 });
        return { locked:false };
    }
    if(state.lockUntil && now < state.lockUntil){
        return { locked:true, remainingMs: state.lockUntil - now };
    }
    return { locked:false };
}

function registerFailedAttempt(username){
    const state = getLockState(username);
    state.fails = (state.fails || 0) + 1;
    state.lastAttempt = Date.now();
    const dur = lockDurationMs(state.fails);
    if(dur > 0) state.lockUntil = Date.now() + dur;
    saveLockState(username, state);
    return state;
}
function clearFailedAttempts(username){
    saveLockState(username, { fails:0, lockUntil:0, lastAttempt:0 });
}

function formatDuration(ms){
    const totalSec = Math.ceil(ms / 1000);
    if(totalSec < 60) return totalSec + (currentLang==='ar' ? " ثانية" : "s");
    const min = Math.ceil(totalSec / 60);
    return min + (currentLang==='ar' ? " دقيقة" : "m");
}

/* ---------- التسجيل ---------- */
async function signUpAccount(){ return signUpWithCreds("acc-username", "acc-password", "acc-password2", false); }

async function signUpWithCreds(userId, passId, pass2Id, fromLoginScreen){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable right now"); return; }
    const username = document.getElementById(userId).value.trim();
    const pass = document.getElementById(passId).value;
    const pass2 = document.getElementById(pass2Id).value;
    if(username.length < 3){ showToast(currentLang==='ar' ? "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" : "Username must be at least 3 characters"); return; }
    if(pass.length < 6){ showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(pass !== pass2){ showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }

    setAccountBusy(true);
    const email = usernameToEmail(username);
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if(error){
        setAccountBusy(false);
        console.error("[خُطى] خطأ Supabase الكامل عند التسجيل (أرسل هذا للمطوّر إن استمرت المشكلة):", error);
        const msg = /already|registered/i.test(error.message) ? (currentLang==='ar'?"اسم المستخدم مُستخدم بالفعل":"Username already taken")
            : /rate limit/i.test(error.message) ? (currentLang==='ar'?"محاولات كثيرة جداً من هذا الجهاز، حاول بعد قليل (أو تأكد أن Confirm email مُعطّل في Supabase)":"Too many attempts from this device — wait a bit (or make sure Confirm Email is disabled in Supabase)")
            : `${error.message} (كود: ${error.status || "؟"}) — افتح Console (F12) للتفاصيل الكاملة`;
        showToast((currentLang==='ar'?"تعذّر إنشاء الحساب: ":"Sign-up failed: ") + msg);
        return;
    }
    const uid = data.user && data.user.id;
    if(uid){
        await sb.from("user_data").insert({ id: uid, username, data: collectLocalSnapshot() });
        setSession({ uid, username });
    }
    setAccountBusy(false);

    if(!data.session){
        // Supabase لم يُرجع جلسة فورية — يعني "Confirm email" لا يزال مفعّلاً، وهذا الحساب
        // لن يعمل لتسجيل الدخول لاحقاً لأن بريد التأكيد يذهب لعنوان وهمي لا يملكه الطالب.
        showToast(currentLang==='ar'
            ? "⚠️ تم إنشاء الحساب لكنه غير مفعّل — يتطلب Supabase تأكيد بريد لن يصل أبداً. اذهب لإعدادات Supabase وأطفئ 'Confirm email' ثم أعد المحاولة."
            : "⚠️ Account created but not activated — Supabase still requires email confirmation you'll never receive. Go to Supabase settings and turn off 'Confirm email', then try again.");
        return;
    }

    showToast(currentLang==='ar' ? "🎉 تم إنشاء حسابك وتسجيل دخولك" : "🎉 Account created and signed in");
    if(fromLoginScreen){ document.getElementById("login-overlay").style.display = "none"; }
    renderAccountUI();
    finishLoginBoot();
}

/* ---------- تسجيل الدخول ---------- */
async function signInAccount(){ return signInWithCreds("acc-username", "acc-password", false); }

async function signInWithCreds(userId, passId, fromLoginScreen){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable right now"); return; }
    const username = document.getElementById(userId).value.trim();
    const pass = document.getElementById(passId).value;
    if(!username || !pass) return;

    const lock = checkLock(username);
    if(lock.locked){
        showToast((currentLang==='ar' ? "⏳ محاولات كثيرة، حاول بعد " : "⏳ Too many attempts, try again in ") + formatDuration(lock.remainingMs));
        return;
    }

    setAccountBusy(true);
    const email = usernameToEmail(username);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setAccountBusy(false);

    if(error){
        console.error("[خُطى] خطأ Supabase الكامل عند تسجيل الدخول:", error);
        if(/confirm/i.test(error.message)){
            showToast(currentLang==='ar'
                ? "⚠️ هذا الحساب لم يُفعَّل بعد (يتطلب تأكيد بريد لن يصلك أبداً) — اذهب لإعدادات Supabase وأطفئ 'Confirm email'، ثم أنشئ الحساب من جديد."
                : "⚠️ This account was never confirmed (needs a confirmation email you'll never receive) — go to Supabase settings and turn off 'Confirm email', then create the account again.");
            return;
        }
        registerFailedAttempt(username);
        showToast(currentLang==='ar' ? `بيانات الدخول غير صحيحة (${error.message})` : `Invalid username or password (${error.message})`);
        return;
    }
    clearFailedAttempts(username);
    const uid = data.user.id;
    setSession({ uid, username });

    const { data: row } = await sb.from("user_data").select("data, username").eq("id", uid).maybeSingle();
    if(row && row.data){
        applyRemoteSnapshot(row.data);
    }
    showToast(currentLang==='ar' ? "أهلاً بعودتك 👋" : "Welcome back 👋");
    location.reload();
}

function toggleRecoveryEmailForm(){
    const box = document.getElementById("recovery-email-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function linkRecoveryEmail(){
    if(!sb) return;
    const email = document.getElementById("recovery-email-input").value.trim();
    if(!email || !email.includes("@")){
        showToast(currentLang==='ar' ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email address");
        return;
    }
    const { error } = await sb.auth.updateUser({ email });
    if(error){
        console.error("[خُطى] تعذّر ربط البريد:", error);
        showToast(currentLang==='ar' ? "تعذّر إرسال رابط التأكيد" : "Couldn't send the confirmation link");
        return;
    }
    document.getElementById("recovery-email-form").style.display = "none";
    document.getElementById("recovery-email-input").value = "";
    showToast(currentLang==='ar'
        ? "📧 أرسلنا رابط تأكيد لبريدك — اضغط عليه لتفعيل استرجاع كلمة المرور"
        : "📧 Confirmation link sent to your email — click it to activate password recovery");
}

function toggleChangePasswordForm(){
    const box = document.getElementById("change-password-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function changePassword(){
    if(!sb) return;
    const p1 = document.getElementById("new-pass-1").value;
    const p2 = document.getElementById("new-pass-2").value;
    if(p1.length < 6){ showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(p1 !== p2){ showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){
        console.error("[خُطى] تعذّر تغيير كلمة المرور:", error);
        showToast(currentLang==='ar' ? "تعذّر تغيير كلمة المرور" : "Couldn't change password");
        return;
    }
    document.getElementById("new-pass-1").value = "";
    document.getElementById("new-pass-2").value = "";
    document.getElementById("change-password-form").style.display = "none";
    showToast(currentLang==='ar' ? "✅ تم تغيير كلمة المرور" : "✅ Password changed");
}

function signOutAccount(){
    if(sb) sb.auth.signOut();
    clearSession();
    showToast(currentLang==='ar' ? "تم تسجيل الخروج — بياناتك المحلية باقية على هذا الجهاز" : "Signed out — your local data stays on this device");
    renderAccountUI();
}

/* ---------- المزامنة ---------- */
function collectLocalSnapshot(){
    const snap = {};
    Object.keys(localStorage).filter(k => k.startsWith("khuta_") && k !== "khuta_session").forEach(k => {
        snap[k] = localStorage.getItem(k);
    });
    return snap;
}
function applyRemoteSnapshot(snap){
    Object.keys(snap).forEach(k => localStorage.setItem(k, snap[k]));
}

async function syncNow(showMsg){
    const session = getSession();
    if(!sb || !session) return;
    const { error } = await sb.from("user_data")
        .update({ data: collectLocalSnapshot(), updated_at: new Date().toISOString() })
        .eq("id", session.uid);
    if(!error){
        localStorage.setItem("khuta_last_sync", new Date().toISOString());
        if(showMsg) showToast(currentLang==='ar' ? "✅ تمت المزامنة" : "✅ Synced");
        renderAccountUI();
        if(document.getElementById("lb-share-toggle") && document.getElementById("lb-share-toggle").checked){
            upsertLeaderboardRow();
        }
    } else if(showMsg){
        showToast(currentLang==='ar' ? "تعذّرت المزامنة" : "Sync failed");
    }
}

let syncDebounceTimer = null;
function debouncedSync(){
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => syncNow(false), 2500);
}

function setAccountBusy(busy){
    document.querySelectorAll(".acc-btn").forEach(b => b.disabled = busy);
}

function renderAccountUI(){
    const session = getSession();
    const guestBox = document.getElementById("account-guest-box");
    const inBox = document.getElementById("account-signedin-box");
    if(!guestBox || !inBox) return;
    if(session){
        guestBox.style.display = "none";
        inBox.style.display = "block";
        document.getElementById("acc-current-username").textContent = session.username;
        const last = localStorage.getItem("khuta_last_sync");
        document.getElementById("acc-last-sync").textContent = last
            ? (currentLang==='ar' ? "آخر مزامنة: " : "Last synced: ") + new Date(last).toLocaleString(currentLang==='ar'?"ar-SA":"en-US")
            : (currentLang==='ar' ? "لم تتم المزامنة بعد" : "Not synced yet");
        updateAccountAuthButtonsVisibility();
    } else {
        guestBox.style.display = "block";
        inBox.style.display = "none";
    }
}

/* حسابات Google لا تملك "كلمة مرور" ندير نحن استرجاعها (Google تدير ذلك
   بالكامل بنفسها)، ولديها أصلاً بريد حقيقي مؤكَّد — فلا داعي لعرض زري
   "تغيير كلمة المرور" و"ربط بريد للاسترجاع" لهذا النوع من الحسابات. */
async function updateAccountAuthButtonsVisibility(){
    if(!sb) return;
    try{
        const { data: userData } = await sb.auth.getUser();
        const provider = userData && userData.user && userData.user.app_metadata && userData.user.app_metadata.provider;
        const isPasswordAccount = provider !== "google";
        const changePassBtn = document.querySelector('[onclick="toggleChangePasswordForm()"]');
        const linkEmailBtn = document.querySelector('[onclick="toggleRecoveryEmailForm()"]');
        if(changePassBtn) changePassBtn.style.display = isPasswordAccount ? "" : "none";
        if(linkEmailBtn) linkEmailBtn.style.display = isPasswordAccount ? "" : "none";
    }catch(e){ /* تجاهل بصمت — الأزرار تبقى بحالتها الافتراضية */ }
}

/* استرجاع الجلسة تلقائياً عند فتح التطبيق (إن كان قد سجّل دخوله سابقاً) */
async function restoreSession(){
    if(!sb) return;
    const { data } = await sb.auth.getSession();
    const session = getSession();
    if(data && data.session && session){
        renderAccountUI();
    } else if(!data || !data.session){
        clearSession();
    }
    // دخول مجهول تلقائي وصامت لكل زائر (لازم لميزات المجتمع)، لا يؤثر على الضيوف إطلاقاً
    if(!data || !data.session){
        try{ await sb.auth.signInAnonymously(); }catch(e){ /* المزوّد غير مفعّل، تجاهل بصمت */ }
    }
}

/* ============================================================
   18) دليل التخصصات — قاعدة بيانات مصغّرة تعريفية
   ============================================================ */
const SPECIALTIES = [
    { id:"medicine", icon:"fa-user-doctor", track:"science",
      ar:{name:"الطب البشري", desc:"دراسة تشخيص وعلاج الأمراض، 6 سنوات + امتياز.", career:"طبيب عام أو أخصائي بعد التدريب.", note:"من أعلى التخصصات تنافسية؛ يتطلب STEP في أغلب الجامعات.",
          branches:["الطب الباطني","الجراحة","طب الأطفال","النساء والولادة","الطب النفسي","طب الطوارئ"],
          universities:["جامعة الملك سعود","جامعة الملك عبدالعزيز","جامعة الملك سعود بن عبدالعزيز للعلوم الصحية","جامعة الملك فيصل"]},
      en:{name:"Medicine", desc:"Diagnosing and treating illness, 6 years + internship.", career:"General practitioner or specialist after training.", note:"One of the most competitive majors; STEP is required at most universities.",
          branches:["Internal Medicine","Surgery","Pediatrics","OB/GYN","Psychiatry","Emergency Medicine"],
          universities:["King Saud University","King Abdulaziz University","KSAU-HS","King Faisal University"]} },
    { id:"dentistry", icon:"fa-tooth", track:"science",
      ar:{name:"طب الأسنان", desc:"دراسة صحة الفم والأسنان وعلاجها جراحياً وتحفظياً.", career:"طبيب أسنان عام أو أخصائي.", note:"تنافسية عالية، غالباً تتطلب STEP."},
      en:{name:"Dentistry", desc:"Oral and dental health, surgical and conservative treatment.", career:"General or specialist dentist.", note:"Highly competitive, usually requires STEP."} },
    { id:"pharmacy", icon:"fa-pills", track:"science",
      ar:{name:"الصيدلة", desc:"دراسة الأدوية وتركيبها وتأثيرها العلاجي.", career:"صيدلي في مستشفى، صيدلية، أو صناعة دوائية.", note:"تنافسية عالية جداً."},
      en:{name:"Pharmacy", desc:"Study of drugs, formulation, and therapeutic effects.", career:"Pharmacist in hospitals, pharmacies, or the pharma industry.", note:"Very competitive."} },
    { id:"engineering_cs", icon:"fa-microchip", track:"science",
      ar:{name:"هندسة/علوم الحاسب", desc:"برمجة، خوارزميات، أنظمة، وذكاء اصطناعي.", career:"مطوّر برمجيات، مهندس بيانات، أمن سيبراني.", note:"طلب سوقي مرتفع جداً حالياً.",
          branches:["الذكاء الاصطناعي وتعلم الآلة","أمن المعلومات","هندسة البرمجيات","علم البيانات","الشبكات وأنظمة التشغيل"],
          universities:["جامعة الملك فهد للبترول والمعادن","جامعة الملك سعود","جامعة الملك عبدالعزيز","جامعة الأميرة نورة"]},
      en:{name:"Computer Science/Engineering", desc:"Programming, algorithms, systems, and AI.", career:"Software developer, data engineer, cybersecurity.", note:"Very high market demand currently.",
          branches:["AI & Machine Learning","Cybersecurity","Software Engineering","Data Science","Networks & OS"],
          universities:["KFUPM","King Saud University","King Abdulaziz University","Princess Nourah University"]} },
    { id:"engineering_civil", icon:"fa-drafting-compass", track:"science",
      ar:{name:"الهندسة المدنية", desc:"تصميم وإنشاء الطرق والمباني والبنية التحتية.", career:"مهندس مواقع، استشاري إنشائي.", note:"طلب مستقر مرتبط بمشاريع البنية التحتية."},
      en:{name:"Civil Engineering", desc:"Designing roads, buildings, and infrastructure.", career:"Site engineer, structural consultant.", note:"Steady demand tied to infrastructure projects."} },
    { id:"business", icon:"fa-briefcase", track:"admin",
      ar:{name:"إدارة الأعمال", desc:"إدارة، تسويق، موارد بشرية، وريادة أعمال.", career:"مدير مشروع، مسوّق، رائد أعمال.", note:"تخصص واسع بفرص متنوعة.",
          branches:["التسويق","الموارد البشرية","إدارة المشاريع","ريادة الأعمال","الأعمال الدولية"],
          universities:["جامعة الملك سعود","جامعة الملك فهد للبترول والمعادن","جامعة الإمام محمد بن سعود"]},
      en:{name:"Business Administration", desc:"Management, marketing, HR, entrepreneurship.", career:"Project manager, marketer, entrepreneur.", note:"Broad field with diverse opportunities.",
          branches:["Marketing","HR","Project Management","Entrepreneurship","International Business"],
          universities:["King Saud University","KFUPM","Imam Mohammad Ibn Saud University"]} },
    { id:"accounting", icon:"fa-calculator", track:"admin",
      ar:{name:"المحاسبة", desc:"القياس والتقارير المالية والمراجعة.", career:"محاسب قانوني، مراجع داخلي، محلل مالي.", note:"طلب ثابت في كل القطاعات تقريباً."},
      en:{name:"Accounting", desc:"Financial measurement, reporting, and auditing.", career:"Certified accountant, internal auditor, financial analyst.", note:"Steady demand across nearly all sectors."} },
    { id:"finance", icon:"fa-chart-line", track:"admin",
      ar:{name:"التمويل والاستثمار", desc:"الأسواق المالية، إدارة المحافظ، والتحليل المالي.", career:"محلل مالي، مستشار استثمار.", note:"مرتبط بقطاع البنوك والأسواق المالية المتنامي."},
      en:{name:"Finance & Investment", desc:"Financial markets, portfolio management, analysis.", career:"Financial analyst, investment advisor.", note:"Tied to the growing banking and capital-markets sector."} },
    { id:"law", icon:"fa-scale-balanced", track:"humanities",
      ar:{name:"القانون", desc:"دراسة الأنظمة القانونية والتشريعات.", career:"محامٍ، مستشار قانوني، قاضٍ (بعد مسار مختص).", note:"يتطلب اجتياز اختبار الرخصة القانونية للممارسة.",
          branches:["القانون التجاري","القانون الجنائي","القانون الدولي","التحكيم التجاري"],
          universities:["جامعة الملك سعود","جامعة الإمام محمد بن سعود","جامعة الملك عبدالعزيز"]},
      en:{name:"Law", desc:"Study of legal systems and legislation.", career:"Lawyer, legal consultant, judge (via a specialized path).", note:"Requires passing the legal licensing exam to practice.",
          branches:["Commercial Law","Criminal Law","International Law","Commercial Arbitration"],
          universities:["King Saud University","Imam Mohammad Ibn Saud University","King Abdulaziz University"]} },
    { id:"sharia", icon:"fa-mosque", track:"humanities",
      ar:{name:"الشريعة والدراسات الإسلامية", desc:"الفقه، أصول الفقه، والدراسات الشرعية.", career:"قاضٍ شرعي، إمام وخطيب، باحث شرعي، تدريس.", note:"عادة لا تتطلب STEP؛ بعض الكليات تشترط اختبار تلاوة/حفظ."},
      en:{name:"Sharia & Islamic Studies", desc:"Islamic jurisprudence and its foundations.", career:"Sharia judge, imam, researcher, teaching.", note:"Usually no STEP requirement; some colleges require a recitation/memorization test."} },
    { id:"education", icon:"fa-chalkboard-user", track:"humanities",
      ar:{name:"التربية وطرق التدريس", desc:"إعداد معلمين لمختلف المراحل الدراسية.", career:"معلم، مشرف تربوي، أخصائي مناهج.", note:"طلب مستقر مرتبط بوزارة التعليم."},
      en:{name:"Education", desc:"Preparing teachers for various school stages.", career:"Teacher, educational supervisor, curriculum specialist.", note:"Steady demand tied to the Ministry of Education."} },
    { id:"arabic", icon:"fa-feather", track:"humanities",
      ar:{name:"اللغة العربية وآدابها", desc:"النحو، الأدب، البلاغة، واللسانيات.", career:"تدريس، تحرير، إعلام، ترجمة.", note:"عادة لا تتطلب STEP."},
      en:{name:"Arabic Language & Literature", desc:"Grammar, literature, rhetoric, and linguistics.", career:"Teaching, editing, media, translation.", note:"Usually no STEP requirement."} },
    { id:"english_translation", icon:"fa-language", track:"humanities",
      ar:{name:"اللغة الإنجليزية والترجمة", desc:"إتقان اللغة الإنجليزية وأصول الترجمة.", career:"مترجم، تدريس، إعلام، علاقات دولية.", note:"غالباً تتطلب درجة STEP مرتفعة نسبياً."},
      en:{name:"English & Translation", desc:"English fluency and translation principles.", career:"Translator, teaching, media, international relations.", note:"Usually requires a relatively high STEP score."} },
    { id:"nursing", icon:"fa-user-nurse", track:"science",
      ar:{name:"التمريض", desc:"الرعاية الصحية للمرضى في مختلف الأقسام الطبية.", career:"ممرض/ة في مستشفيات حكومية وخاصة.", note:"طلب سوقي مرتفع ومستقر."},
      en:{name:"Nursing", desc:"Patient care across medical departments.", career:"Nurse in public and private hospitals.", note:"High and steady market demand."} },
    { id:"architecture", icon:"fa-building", track:"science",
      ar:{name:"العمارة", desc:"تصميم المباني من الناحية الجمالية والوظيفية.", career:"مهندس معماري، مصمم داخلي، مخطط عمراني.", note:"يتطلب موهبة تصميمية إلى جانب الأساس الهندسي."},
      en:{name:"Architecture", desc:"Designing buildings aesthetically and functionally.", career:"Architect, interior designer, urban planner.", note:"Requires design talent alongside engineering fundamentals."} },
    { id:"psychology", icon:"fa-brain", track:"humanities",
      ar:{name:"علم النفس", desc:"دراسة السلوك الإنساني والعمليات النفسية.", career:"أخصائي نفسي (بعد ترخيص)، موارد بشرية، بحث علمي.", note:"يحتاج غالباً دراسات عليا للممارسة الإكلينيكية."},
      en:{name:"Psychology", desc:"Study of human behavior and mental processes.", career:"Licensed psychologist, HR, research.", note:"Clinical practice usually requires graduate studies."} },
    { id:"industrial_eng", icon:"fa-industry", track:"science",
      ar:{name:"الهندسة الصناعية", desc:"تحسين العمليات الإنتاجية وسلاسل الإمداد وإدارة الجودة.", career:"مهندس عمليات، مستشار سلاسل إمداد.", note:"مطلوبة في القطاع الصناعي واللوجستي المتنامي."},
      en:{name:"Industrial Engineering", desc:"Optimizing production processes, supply chains, and quality.", career:"Process engineer, supply-chain consultant.", note:"In demand across the growing industrial and logistics sector."} },
    { id:"petroleum_eng", icon:"fa-oil-well", track:"science",
      ar:{name:"هندسة البترول", desc:"استكشاف واستخراج النفط والغاز.", career:"مهندس حفر، مهندس مكامن.", note:"مرتبطة تاريخياً بأرامكو وقطاع الطاقة."},
      en:{name:"Petroleum Engineering", desc:"Oil and gas exploration and extraction.", career:"Drilling engineer, reservoir engineer.", note:"Historically tied to Aramco and the energy sector."} },
    { id:"media", icon:"fa-video", track:"humanities",
      ar:{name:"الإعلام والاتصال", desc:"الصحافة، الإعلام الرقمي، والعلاقات العامة.", career:"صحفي، منتج محتوى، مسؤول علاقات عامة.", note:"تطوّر كثيراً مع نمو الإعلام الرقمي ووسائل التواصل."},
      en:{name:"Media & Communication", desc:"Journalism, digital media, and public relations.", career:"Journalist, content producer, PR officer.", note:"Growing rapidly alongside digital media and social platforms."} },
    { id:"veterinary", icon:"fa-paw", track:"science",
      ar:{name:"الطب البيطري", desc:"تشخيص وعلاج أمراض الحيوانات.", career:"طبيب بيطري في عيادات أو قطاع الثروة الحيوانية.", note:"تخصص متوسط التنافسية نسبياً."},
      en:{name:"Veterinary Medicine", desc:"Diagnosing and treating animal illnesses.", career:"Veterinarian in clinics or the livestock sector.", note:"Moderately competitive."} },
];

function renderSpecialties(){
    const grid = document.getElementById("specialties-grid");
    if(!grid) return;
    const list = getSpecialties();
    const q = (document.getElementById("spec-search").value || "").trim().toLowerCase();
    const filtered = list.filter(s => !q || (s.ar.name||"").toLowerCase().includes(q) || (s.en.name||"").toLowerCase().includes(q));
    if(!filtered.length){
        grid.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد نتائج':'No results'}</div>`;
        return;
    }
    grid.innerHTML = filtered.map((s, i) => {
        const d = s[currentLang] || s.ar;
        return `
        <div class="link-card" style="cursor:pointer; align-items:flex-start; text-align:start;" onclick="openSpecialtyDetail('${s.id}')">
            <div class="ic"><i class="fa-solid ${s.icon}"></i></div>
            <b>${d.name}</b>
            <div style="font-size:12.5px; color:var(--text-2); line-height:1.8; margin-top:4px;">${d.desc}</div>
            <div style="font-size:11.5px; color:var(--teal); margin-top:6px;"><i class="fa-solid fa-arrow-trend-up"></i> ${d.career}</div>
            <div style="font-size:10.5px; color:var(--gold); margin-top:8px; font-weight:700;">${currentLang==='ar'?'اضغط لعرض التفاصيل الكاملة':'Tap for full details'} <i class="fa-solid fa-chevron-left rtl-flip"></i></div>
        </div>`;
    }).join("");
}

function openSpecialtyDetail(id){
    const s = getSpecialties().find(x => x.id === id);
    if(!s) return;
    const d = s[currentLang] || s.ar;
    const branches = d.branches || [];
    const unis = d.universities || [];
    const overlay = document.createElement("div");
    overlay.className = "overlay-screen";
    overlay.style.zIndex = "4000";
    overlay.onclick = (e) => { if(e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="wizard-card" style="max-width:560px; text-align:start;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <div class="ic" style="width:48px; height:48px; border-radius:14px; background:linear-gradient(135deg,var(--gold),#B0812A); color:#fff; display:flex; align-items:center; justify-content:center; font-size:20px;"><i class="fa-solid ${s.icon}"></i></div>
                    <h2 style="font-size:19px;">${d.name}</h2>
                </div>
                <button type="button" class="btn-ghost" onclick="this.closest('.overlay-screen').remove()"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:13.5px; color:var(--text-2); line-height:1.9; margin-bottom:14px;">${d.desc}</p>
            <div class="uni-note" style="margin-bottom:10px;"><b style="color:var(--teal);">${currentLang==='ar'?'المسار الوظيفي: ':'Career path: '}</b>${d.career}</div>
            ${branches.length ? `<div style="margin-bottom:14px;"><b style="font-size:13px; color:var(--gold);">${currentLang==='ar'?'يتفرّع منه:':'Branches into:'}</b>
                <ul style="margin:8px 0 0; padding-inline-start:20px; font-size:13px; line-height:2;">${branches.map(b=>`<li>${b}</li>`).join("")}</ul></div>` : ""}
            ${unis.length ? `<div style="margin-bottom:14px;"><b style="font-size:13px; color:var(--gold);">${currentLang==='ar'?'متوفر في جامعات مثل:':'Offered at universities such as:'}</b>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:8px;">${unis.map(u=>`<span class="pill pill-maybe">${u}</span>`).join("")}</div></div>` : ""}
            <div class="uni-note" style="opacity:.7; font-size:11px;">${d.note || ""}</div>
        </div>`;
    document.body.appendChild(overlay);
}

/* ============================================================
   19) المجتمع — لوحة الصدارة / غرفة المذاكرة / حائط الأسئلة
   ------------------------------------------------------------
   جميعها تعتمد على Supabase مباشرة (قراءة عامة، كتابة لمن سجّل دخوله
   حتى لو "مجهولاً" عبر anonymous sign-in). تُهيّأ تلقائياً عند فتح
   صفحة "المجتمع" لتفادي استهلاك الشبكة قبل الحاجة.
   ============================================================ */
let communityInitialized = false;
async function initCommunityIfNeeded(){
    if(communityInitialized || !sb) return;
    communityInitialized = true;
    const shared = localStorage.getItem("khuta_lb_share") === "1";
    const toggle = document.getElementById("lb-share-toggle");
    if(toggle) toggle.checked = shared;
    await refreshLeaderboard();
    await refreshForum();
    await refreshTemplates();
    startPresenceHeartbeat();
}

/* ---------- لوحة الصدارة ---------- */
async function onLeaderboardToggle(){
    const on = document.getElementById("lb-share-toggle").checked;
    localStorage.setItem("khuta_lb_share", on ? "1" : "0");
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    if(on){
        await upsertLeaderboardRow();
    } else {
        await sb.from("leaderboard").delete().eq("id", uid);
    }
    refreshLeaderboard();
}

async function upsertLeaderboardRow(){
    if(!sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    const session = getSession();
    const displayName = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب مجهول":"Anonymous student"));
    await sb.from("leaderboard").upsert({ id: uid, display_name: displayName, xp: getXP(), updated_at: new Date().toISOString() });
}

async function refreshLeaderboard(){
    const box = document.getElementById("leaderboard-list");
    if(!box || !sb) return;
    const { data, error } = await sb.from("leaderboard").select("display_name, xp").order("xp", { ascending:false }).limit(10);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا يوجد طلاب مشاركون بعد — كن أول من ينضم!':'No participants yet — be the first to join!'}</div>`;
        return;
    }
    box.innerHTML = data.map((row, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 6px; border-bottom:1px solid var(--border);">
            <b style="width:24px; color:${i<3?'var(--gold)':'var(--text-3)'};">#${i+1}</b>
            <span style="flex:1; font-weight:600;">${escapeHtml(row.display_name)}</span>
            <span style="font-family:var(--font-mono); color:var(--gold); font-weight:700;">${row.xp} XP</span>
        </div>`).join("");
}

/* ---------- غرفة المذاكرة (حضور حي) ---------- */
/* ---------- غرفة المذاكرة — Realtime Presence (بث لحظي عبر WebSocket) ----------
   بديل أسرع وأخف من الاستطلاع الدوري (polling): يعتمد على ميزة Presence
   المدمجة في Supabase، فيتحدّث العدّاد فوراً عند دخول/خروج أي طالب دون أي
   طلبات متكررة كل 25 ثانية. يتطلب أن يكون Realtime مفعّلاً على مشروعك
   (مفعَّل افتراضياً لكل مشاريع Supabase الجديدة — لا حاجة لإعداد إضافي عادة). */
let presenceChannel = null;
async function startPresenceHeartbeat(){
    if(!sb) return;
    const el = document.getElementById("room-count");
    const dashEl = document.getElementById("dash-room-count");
    try{
        const { data: userData } = await sb.auth.getUser();
        const uid = userData && userData.user && userData.user.id;
        if(!uid) return;
        presenceChannel = sb.channel("khuta-study-room", { config: { presence: { key: uid } } });
        presenceChannel
            .on("presence", { event: "sync" }, () => {
                const state = presenceChannel.presenceState();
                const count = Object.keys(state).length || 1;
                if(el) el.textContent = count;
                if(dashEl) dashEl.textContent = count;
            })
            .subscribe(async (status) => {
                if(status === "SUBSCRIBED"){
                    await presenceChannel.track({ online_at: new Date().toISOString() });
                }
            });
    }catch(e){
        // فشل صامت مع بديل ثابت — الميزة الرئيسية للموقع لا تعتمد على هذا العدّاد
        console.error("[خُطى] تعذّر تفعيل الحضور اللحظي (Realtime):", e);
        if(el) el.textContent = "1";
        if(dashEl) dashEl.textContent = "1";
    }
}

/* ---------- حائط الأسئلة السريعة ---------- */
async function refreshForum(){
    const box = document.getElementById("forum-list");
    if(!box || !sb) return;
    const { data, error } = await sb.from("forum_posts").select("id, author_name, message, created_at").order("created_at", { ascending:false }).limit(20);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد أسئلة بعد — ابدأ أنت!':'No questions yet — be the first!'}</div>`;
        return;
    }
    box.innerHTML = data.map(row => `
        <div style="padding:10px 6px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
            <div style="flex:1;">
                <div style="font-size:13.5px;">${escapeHtml(row.message)}</div>
                <div style="font-size:11px; color:var(--text-3); margin-top:4px;">${escapeHtml(row.author_name)} · ${new Date(row.created_at).toLocaleDateString(currentLang==='ar'?"ar-SA":"en-US")}</div>
            </div>
            ${isAdmin ? `<button type="button" class="icon-action" style="flex-shrink:0;" title="${currentLang==='ar'?'حذف (صلاحية مشرف)':'Delete (admin)'}" onclick="deleteForumMessage(${row.id})"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>`).join("");
}
async function deleteForumMessage(id){
    if(!sb) return;
    if(!confirm(currentLang==='ar' ? "حذف هذه الرسالة نهائياً؟" : "Permanently delete this message?")) return;
    const { error } = await sb.from("forum_posts").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّر الحذف':'Could not delete'); return; }
    showToast(currentLang==='ar' ? "🗑️ تم الحذف" : "🗑️ Deleted");
    refreshForum();
}

async function postForumMessage(){
    const input = document.getElementById("forum-input");
    const msg = input.value.trim();
    if(!msg || !sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    const session = getSession();
    const name = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب":"Student"));
    const { error } = await sb.from("forum_posts").insert({ author_name: name, message: msg });
    if(!error){ input.value = ""; refreshForum(); }
    else showToast(currentLang==='ar'?'تعذّر النشر':'Could not post');
}

/* ملخّص مقروء لخطة الطالب الحالية — يُستخدم في معاينة النشر وفي بطاقات القوالب */
function getConfigSummary(config, planDays, sessionMinutes){
    const content = getContent();
    const lines = [];
    const verbalLabel = config.customVerbal && config.customVerbal.name
        ? `${currentLang==='ar'?'اللفظي: ':'Verbal: '}${config.customVerbal.name} + ${currentLang==='ar'?'إيهاب':'Ehab'}`
        : `${currentLang==='ar'?'اللفظي: ':'Verbal: '}${currentLang==='ar'?'إيهاب':"Ehab's course"}`;
    lines.push(verbalLabel);

    const quantParts = [];
    if(config.found === "moasser") quantParts.push(currentLang==='ar'?'تأسيس المعاصر':'Al-Moaasir foundation');
    if(config.found === "einstein") quantParts.push(currentLang==='ar'?'تأسيس أينشتاين':'Einstein foundation');
    if(config.tMonsif) quantParts.push(currentLang==='ar'?'المنصف':'Al-Monsif');
    if(config.tMufSec) quantParts.push(currentLang==='ar'?'أقسام المفكر':'Al-Mufakkir sections');
    if(config.tMufRep) quantParts.push(currentLang==='ar'?'تكرارات المفكر':'Al-Mufakkir repeats');
    if(config.tMoasser) quantParts.push(currentLang==='ar'?'بنوك المعاصر':'Al-Moaasir banks');
    if(config.customQuant && config.customQuant.name) quantParts.push(config.customQuant.name);
    lines.push((currentLang==='ar'?'الكمي: ':'Quant: ') + (quantParts.length ? quantParts.join(" + ") : (currentLang==='ar'?'لا شيء':'None')));

    if(planDays) lines.push((currentLang==='ar'?'مدة الخطة: ':'Plan length: ') + planDays + (currentLang==='ar'?' يوم':' days'));
    if(sessionMinutes) lines.push((currentLang==='ar'?'المذاكرة اليومية: ':'Daily study: ') + (sessionMinutes/60).toFixed(1) + (currentLang==='ar'?' ساعة':' hr'));
    return lines;
}

/* ---------- قوالب الخطط المشتركة من الطلاب ---------- */
function openPublishTemplateForm(){
    const box = document.getElementById("publish-template-form");
    const opening = box.style.display === "none";
    box.style.display = opening ? "block" : "none";
    if(opening){
        let config = {};
        try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
        const planDays = parseInt(localStorage.getItem("khuta_plan_days")) || 0;
        const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes")) || 0;
        const summary = getConfigSummary(config, planDays, sessionMinutes);
        document.getElementById("tpl-preview").innerHTML = summary.map(l => `<div>• ${l}</div>`).join("");
    }
}

async function publishTemplate(){
    if(!sb) return;
    const title = document.getElementById("tpl-title").value.trim();
    const desc = document.getElementById("tpl-desc").value.trim();
    if(!title){ showToast(currentLang==='ar' ? "اكتب عنواناً للقالب" : "Give your template a title"); return; }
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    const session = getSession();
    const authorName = (session && session.username) || (localStorage.getItem("khuta_name") || (currentLang==='ar'?"طالب":"Student"));
    const planDays = parseInt(localStorage.getItem("khuta_plan_days")) || null;
    const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes")) || null;
    const sourcesSummary = getConfigSummary(config, planDays, sessionMinutes).join(" | ");
    const { error } = await sb.from("plan_templates").insert({
        author_id: uid, author_name: authorName, title, description: desc,
        config, plan_days: planDays, session_minutes: sessionMinutes, sources_summary: sourcesSummary,
    });
    if(error){ showToast(currentLang==='ar'?'تعذّر النشر':'Could not publish'); return; }
    document.getElementById("tpl-title").value = "";
    document.getElementById("tpl-desc").value = "";
    document.getElementById("publish-template-form").style.display = "none";
    showToast(currentLang==='ar' ? "🎉 تم نشر خطتك كقالب" : "🎉 Your plan is now published as a template");
    refreshTemplates();
}

async function refreshTemplates(){
    const box = document.getElementById("templates-list");
    if(!box || !sb) return;
    const { data: templates, error } = await sb.from("plan_templates").select("*").order("created_at", { ascending:false }).limit(15);
    if(error || !templates || !templates.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد قوالب بعد — كن أول من يشارك!':'No templates yet — be the first to share!'}</div>`;
        return;
    }
    const { data: allRatings } = await sb.from("template_ratings").select("template_id, vote, comment, rater_id");
    box.innerHTML = templates.map(tpl => {
        const ratings = (allRatings || []).filter(r => r.template_id === tpl.id);
        const likes = ratings.filter(r => r.vote === "like").length;
        const dislikes = ratings.filter(r => r.vote === "dislike").length;
        const comments = ratings.filter(r => r.comment).slice(0, 2);
        return `
        <div style="padding:16px; border-radius:16px; background:var(--bg-alt); border:1px solid var(--border); margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <b style="font-size:14.5px;">${escapeHtml(tpl.title)}</b>
                    <div style="font-size:11px; color:var(--text-3); margin-top:2px;">${escapeHtml(tpl.author_name)} · ${tpl.plan_days ? tpl.plan_days + (currentLang==='ar'?' يوم':' days') : ""}${tpl.session_minutes ? ' · ' + (tpl.session_minutes/60).toFixed(1) + (currentLang==='ar'?' ساعة/يوم':' hr/day') : ""}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="btn btn-sm" onclick="useTemplate(${tpl.id})"><i class="fa-solid fa-download"></i> ${currentLang==='ar'?'استخدم':'Use'}</button>
                    ${isAdmin ? `<button type="button" class="icon-action" title="${currentLang==='ar'?'حذف (صلاحية مشرف)':'Delete (admin)'}" onclick="deleteTemplate(${tpl.id})"><i class="fa-solid fa-trash"></i></button>` : ""}
                </div>
            </div>
            ${tpl.sources_summary ? `<div style="font-size:12px; color:var(--text-2); margin-top:8px; line-height:1.9; background:var(--surface); border-radius:10px; padding:8px 12px;">${escapeHtml(tpl.sources_summary).split(" | ").map(l => `• ${l}`).join("<br>")}</div>` : ""}
            ${tpl.description ? `<p style="font-size:12.5px; color:var(--text-2); margin-top:8px; line-height:1.7;">${escapeHtml(tpl.description)}</p>` : ""}
            <div style="display:flex; align-items:center; gap:14px; margin-top:10px;">
                <button type="button" class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="rateTemplate(${tpl.id},'like')"><i class="fa-solid fa-thumbs-up" style="color:var(--teal);"></i> ${likes}</button>
                <button type="button" class="btn-ghost" style="padding:4px 8px; font-size:12px;" onclick="rateTemplate(${tpl.id},'dislike')"><i class="fa-solid fa-thumbs-down" style="color:var(--rose);"></i> ${dislikes}</button>
            </div>
            ${comments.length ? `<div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:8px;">${comments.map(c=>`<div style="font-size:11.5px; color:var(--text-3); margin-top:4px;">💬 ${escapeHtml(c.comment)}</div>`).join("")}</div>` : ""}
        </div>`;
    }).join("");
}

async function deleteTemplate(id){
    if(!sb) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا القالب نهائياً؟" : "Permanently delete this template?")) return;
    const { error } = await sb.from("plan_templates").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّر الحذف':'Could not delete'); return; }
    showToast(currentLang==='ar' ? "🗑️ تم الحذف" : "🗑️ Deleted");
    refreshTemplates();
}

function useTemplate(templateId){
    if(!confirm(currentLang==='ar' ? "سيستبدل هذا خطتك الحالية بهذا القالب. متابعة؟" : "This will replace your current plan with this template. Continue?")) return;
    applyTemplate(templateId);
}

async function applyTemplate(templateId){
    const { data: tpl, error } = await sb.from("plan_templates").select("*").eq("id", templateId).maybeSingle();
    if(error || !tpl) return;
    localStorage.setItem("khuta_config", JSON.stringify(tpl.config));
    if(tpl.plan_days) localStorage.setItem("khuta_plan_days", tpl.plan_days);
    if(tpl.session_minutes) localStorage.setItem("khuta_session_minutes", tpl.session_minutes);
    localStorage.setItem("khuta_plan_start", new Date().toISOString());
    buildScheduleTable();
    renderProgress();
    switchTab("dashboard");
    showToast(currentLang==='ar' ? "✅ تم تطبيق القالب على جدولك" : "✅ Template applied to your schedule");
    debouncedSync();
}

async function rateTemplate(templateId, vote){
    if(!sb) return;
    const { data: userData } = await sb.auth.getUser();
    const uid = userData && userData.user && userData.user.id;
    if(!uid) return;
    let comment = null;
    if(vote === "dislike"){
        comment = prompt(currentLang==='ar' ? "(اختياري) ما الذي لم يعجبك في هذه الخطة؟" : "(optional) What didn't you like about this plan?");
    }
    await sb.from("template_ratings").upsert({ template_id: templateId, rater_id: uid, vote, comment: comment || null }, { onConflict: "template_id,rater_id" });
    refreshTemplates();
}


/* رابط JSON اختياري على GitHub لتعديل مواد/حصص/مسارات المعدل التراكمي
   بالكامل دون لمس الكود. الشكل المتوقع للملف:
   {
     "termsPerYear": {"1":2, "2":3, "3":3},
     "tracks": ["general","sharia","business","health","cs"],
     "trackLabels": {"general":{"ar":"المسار العام","en":"General Track"}, ...},
     "subjects": {
        "1": [{"ar":"لغة عربية","en":"Arabic","h":5}, ...],
        "general": [...], "sharia": [...], "business": [...], "health": [...], "cs": [...]
     }
   }
   ارفع هذا الملف على GitHub (repo عام)، انسخ رابط "Raw"، والصقه أدناه. */
const REMOTE_CURRICULUM_URL = "";

function getCurriculum(){ return window.__REMOTE_CURRICULUM__ || SAUDI_CURRICULUM_DEFAULT; }
function getCurriculumTracks(){ return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.tracks) || ["general","sharia","business","health","cs"]; }
function getTermsForYear(year){ return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.termsPerYear && window.__REMOTE_CURRICULUM_META__.termsPerYear[year]) || 3; }

async function tryLoadRemoteCurriculum(){
    if(!REMOTE_CURRICULUM_URL) return;
    try{
        const res = await fetch(REMOTE_CURRICULUM_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(json && json.subjects){
            window.__REMOTE_CURRICULUM__ = json.subjects;
            window.__REMOTE_CURRICULUM_META__ = { termsPerYear: json.termsPerYear, tracks: json.tracks, trackLabels: json.trackLabels };
            populateGpaTrackOptions();
            populateGpaSemesterOptions();
        }
    }catch(e){ console.error("[خُطى] تعذّر جلب منهج المعدل من GitHub:", e); }
}

/* رابط JSON اختياري لإضافة/توسيع دليل التخصصات دون لمس الكود. الشكل:
   [{"id":"...", "icon":"fa-...", "track":"science",
     "ar":{"name":"...","desc":"...","career":"...","note":"...","branches":["...","..."],"universities":["..."]},
     "en":{...}}, ...]
   يمكنك إما استبدال القائمة كاملة أو (الأفضل) نسخ التنسيق وإضافة تخصصات جديدة. */
const REMOTE_SPECIALTIES_URL = "";

async function tryLoadRemoteSpecialties(){
    if(!REMOTE_SPECIALTIES_URL) return;
    try{
        const res = await fetch(REMOTE_SPECIALTIES_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(Array.isArray(json) && json.length){
            window.__REMOTE_SPECIALTIES__ = json;
            renderSpecialties();
        }
    }catch(e){ console.error("[خُطى] تعذّر جلب دليل التخصصات من GitHub:", e); }
}
function getSpecialties(){ return window.__REMOTE_SPECIALTIES__ || SPECIALTIES; }

/* ============================================================
   24) ترتيب بطاقات لوحة التحكم — تحريك بسيط بالأسهم بدل السحب والإفلات
   ============================================================ */
function initDashboardReorder(){
    const container = document.getElementById("dashboard-cards");
    if(!container) return;

    // حقن أزرار تحريك صغيرة في زاوية كل بطاقة
    container.querySelectorAll(":scope > .card").forEach(card => {
        if(card.querySelector(".reorder-controls")) return;
        const ctrl = document.createElement("div");
        ctrl.className = "reorder-controls";
        ctrl.innerHTML = `
            <button type="button" title="${currentLang==='ar'?'تحريك للأعلى':'Move up'}" onclick="moveDashCard('${card.id}',-1)"><i class="fa-solid fa-chevron-up"></i></button>
            <button type="button" title="${currentLang==='ar'?'تحريك للأسفل':'Move down'}" onclick="moveDashCard('${card.id}',1)"><i class="fa-solid fa-chevron-down"></i></button>
        `;
        card.style.position = "relative";
        card.appendChild(ctrl);
    });

    // استرجاع الترتيب المحفوظ
    let order = [];
    try{ order = JSON.parse(localStorage.getItem("khuta_dashboard_order")) || []; }catch(e){}
    if(order.length){
        order.forEach(id => {
            const el = document.getElementById(id);
            if(el) container.appendChild(el);
        });
    }
}

function moveDashCard(id, direction){
    const container = document.getElementById("dashboard-cards");
    const card = document.getElementById(id);
    if(!container || !card) return;
    const cards = Array.from(container.querySelectorAll(":scope > .card"));
    const idx = cards.indexOf(card);
    const targetIdx = idx + direction;
    if(targetIdx < 0 || targetIdx >= cards.length) return;
    if(direction < 0){
        container.insertBefore(card, cards[targetIdx]);
    } else {
        container.insertBefore(cards[targetIdx], card);
    }
    const newOrder = Array.from(container.querySelectorAll(":scope > .card")).map(c => c.id);
    localStorage.setItem("khuta_dashboard_order", JSON.stringify(newOrder));
}

/* ============================================================
   23) حاسبة المعدل التراكمي للثانوي (GPA)
   ============================================================ */
function setCalcMode(mode){
    document.getElementById("calc-mode-weighted").classList.toggle("selected", mode === "weighted");
    document.getElementById("calc-mode-gpa").classList.toggle("selected", mode === "gpa");
    document.getElementById("weighted-calc-view").style.display = mode === "weighted" ? "block" : "none";
    document.getElementById("gpa-calc-view").style.display = mode === "gpa" ? "block" : "none";
    if(mode === "gpa"){
        if(!document.getElementById("gpa-body").children.length){ addGpaRow(); addGpaRow(); addGpaRow(); }
        renderSavedYearAverages();
    }
}

/* بيانات تقديرية عن مواد نظام المسارات — مبنية على الهيكل العام المعلن من
   وزارة التعليم (سنة أولى مشتركة + مسارات تخصصية للسنتين الثانية والثالثة)،
   وليست نسخة حرفية من كشف درجات أي مدرسة. الحصص افتراضية وقابلة للتعديل. */
const SAUDI_CURRICULUM_DEFAULT = {
    "1": [ // السنة الأولى المشتركة — نفس المواد لكل الطلاب تقريباً
        { ar:"لغة عربية", en:"Arabic", h:5 }, { ar:"دراسات إسلامية", en:"Islamic Studies", h:4 },
        { ar:"رياضيات", en:"Math", h:5 }, { ar:"علوم عامة", en:"General Science", h:4 },
        { ar:"لغة إنجليزية", en:"English", h:4 }, { ar:"دراسات اجتماعية", en:"Social Studies", h:2 },
        { ar:"تفكير ناقد", en:"Critical Thinking", h:2 }, { ar:"مهارات رقمية", en:"Digital Skills", h:2 },
        { ar:"تربية بدنية", en:"PE", h:2 },
    ],
    general: [ { ar:"لغة عربية", en:"Arabic", h:4 }, { ar:"دراسات إسلامية", en:"Islamic Studies", h:3 },
        { ar:"رياضيات", en:"Math", h:4 }, { ar:"إنجليزي", en:"English", h:3 }, { ar:"مقرر مجال اختياري", en:"Elective", h:3 } ],
    sharia: [ { ar:"فقه وأصوله", en:"Fiqh", h:4 }, { ar:"تفسير", en:"Tafsir", h:3 },
        { ar:"حديث ومصطلح", en:"Hadith", h:3 }, { ar:"لغة عربية", en:"Arabic", h:4 }, { ar:"قانون", en:"Law", h:2 } ],
    business: [ { ar:"مبادئ إدارة الأعمال", en:"Business Fundamentals", h:4 }, { ar:"محاسبة", en:"Accounting", h:3 },
        { ar:"اقتصاد", en:"Economics", h:3 }, { ar:"قانون", en:"Law", h:2 }, { ar:"رياضيات مالية", en:"Financial Math", h:3 } ],
    health: [ { ar:"مقدمة في العلوم الصحية", en:"Intro to Health Sciences", h:4 }, { ar:"أحياء", en:"Biology", h:4 },
        { ar:"كيمياء", en:"Chemistry", h:4 }, { ar:"أنظمة جسم الإنسان", en:"Human Body Systems", h:3 }, { ar:"تصميم هندسي", en:"Engineering Design", h:2 } ],
    cs: [ { ar:"برمجة", en:"Programming", h:4 }, { ar:"رياضيات متقدمة", en:"Advanced Math", h:4 },
        { ar:"فيزياء", en:"Physics", h:3 }, { ar:"تصميم هندسي", en:"Engineering Design", h:2 }, { ar:"أمن سيبراني", en:"Cybersecurity", h:2 } ],
};

function populateGpaTrackOptions(){
    const sel = document.getElementById("gpa-track");
    if(!sel) return;
    const tracks = getCurriculumTracks();
    const labels = (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.trackLabels) || {
        general:{ar:"المسار العام",en:"General Track"}, sharia:{ar:"المسار الشرعي",en:"Sharia Track"},
        business:{ar:"مسار إدارة الأعمال",en:"Business Track"}, health:{ar:"مسار الصحة والحياة",en:"Health & Life Track"},
        cs:{ar:"مسار الحاسب والهندسة",en:"Computer Science & Engineering Track"},
    };
    const prev = sel.value;
    sel.innerHTML = tracks.map(tr => `<option value="${tr}">${(labels[tr] && labels[tr][currentLang]) || tr}</option>`).join("");
    if(tracks.includes(prev)) sel.value = prev;
}

function populateGpaSemesterOptions(){
    const gradeSel = document.getElementById("gpa-grade");
    const semSel = document.getElementById("gpa-semester");
    if(!gradeSel || !semSel) return;
    const grade = gradeSel.value || "1";
    const count = getTermsForYear(grade);
    const prev = semSel.value;
    let opts = "";
    for(let i = 1; i <= count; i++){
        const labelKey = "gpa.sem" + i;
        opts += `<option value="${i}">${I18N[currentLang][labelKey] || ((currentLang==='ar'?"الفصل ":"Semester ") + i)}</option>`;
    }
    semSel.innerHTML = opts;
    if(Number(prev) <= count) semSel.value = prev;
}

function onGpaGradeChange(){
    const grade = document.getElementById("gpa-grade").value;
    document.getElementById("gpa-track-group").style.display = grade === "1" ? "none" : "block";
    populateGpaSemesterOptions();
}

function autofillGpaSubjects(){
    const grade = document.getElementById("gpa-grade").value;
    const track = document.getElementById("gpa-track").value;
    const curriculum = getCurriculum();
    const subjects = grade === "1" ? curriculum["1"] : curriculum[track];
    if(!subjects || !subjects.length){
        showToast(currentLang==='ar' ? "لا توجد بيانات لهذا الاختيار" : "No data for this selection");
        return;
    }
    document.getElementById("gpa-body").innerHTML = "";
    subjects.forEach(s => {
        addGpaRow();
        const rows = document.querySelectorAll("#gpa-body tr");
        const row = rows[rows.length - 1];
        const id = row.dataset.rowId;
        document.getElementById(`${id}-name`).value = currentLang === "ar" ? s.ar : s.en;
        document.getElementById(`${id}-hours`).value = s.h;
    });
    showToast(currentLang==='ar' ? "تمت التعبئة — أدخل درجاتك وعدّل الحصص إن اختلفت" : "Filled in — enter your scores and adjust hours if they differ");
}

let gpaRowId = 0;
function addGpaRow(){
    const id = "gpa_" + (gpaRowId++);
    const tr = document.createElement("tr");
    tr.dataset.rowId = id;
    tr.innerHTML = `
        <td><input type="text" class="task-input" placeholder="${currentLang==='ar'?'مثال: رياضيات':'e.g. Math'}" id="${id}-name"></td>
        <td><input type="number" class="task-input" min="0" max="100" placeholder="95" id="${id}-score"></td>
        <td><input type="number" class="task-input" min="1" max="10" value="3" id="${id}-hours"></td>
        <td><div class="row-actions"><div class="icon-action" onclick="this.closest('tr').remove()"><i class="fa-solid fa-trash"></i></div></div></td>
    `;
    document.getElementById("gpa-body").appendChild(tr);
}

function calcGpa(){
    const rows = document.querySelectorAll("#gpa-body tr");
    let totalWeighted = 0, totalHours = 0;
    rows.forEach(row => {
        const id = row.dataset.rowId;
        const score = parseFloat(document.getElementById(`${id}-score`).value);
        const hours = parseFloat(document.getElementById(`${id}-hours`).value) || 0;
        if(!isNaN(score) && hours > 0){ totalWeighted += score * hours; totalHours += hours; }
    });
    if(totalHours === 0){ showToast(currentLang==='ar' ? "أضف درجة وساعات معتمدة لمادة واحدة على الأقل" : "Add a score and credit hours for at least one subject"); return; }
    const avg = totalWeighted / totalHours;
    document.getElementById("gpa-result-box").style.display = "block";
    document.getElementById("gpa-result").textContent = avg.toFixed(2) + "%";

    const bands = currentLang === "ar"
        ? [[95,"ممتاز مرتفع"],[90,"ممتاز"],[85,"جيد جداً مرتفع"],[80,"جيد جداً"],[75,"جيد مرتفع"],[65,"جيد"],[50,"مقبول"],[0,"ضعيف"]]
        : [[95,"Excellent+"],[90,"Excellent"],[85,"Very Good+"],[80,"Very Good"],[75,"Good+"],[65,"Good"],[50,"Pass"],[0,"Weak"]];
    const grade = bands.find(b => avg >= b[0])[1];
    document.getElementById("gpa-grade-result").textContent = (currentLang==='ar' ? "التقدير: " : "Grade: ") + grade;
}

function quickSaveYearAverages(){
    const y1 = parseFloat(document.getElementById("quick-y1").value);
    const y2 = parseFloat(document.getElementById("quick-y2").value);
    const y3 = parseFloat(document.getElementById("quick-y3").value);
    const entries = { "1": y1, "2": y2, "3": y3 };
    const valid = Object.entries(entries).filter(([, v]) => !isNaN(v) && v >= 0 && v <= 100);
    if(!valid.length){
        showToast(currentLang==='ar' ? "أدخل نسبة واحدة على الأقل بين 0 و100" : "Enter at least one percentage between 0 and 100");
        return;
    }
    const saved = getSavedYearAverages();
    valid.forEach(([year, v]) => { saved[year] = v; });
    localStorage.setItem("khuta_year_averages", JSON.stringify(saved));
    renderSavedYearAverages();
    debouncedSync();
    showToast(currentLang==='ar' ? `✅ تم حفظ ${valid.length} من نسب السنوات` : `✅ Saved ${valid.length} year percentage(s)`);
}


/* الافتراضي 20% / 40% / 40% حسب نظام المسارات الحالي، وقابل للتحديث عبر
   REMOTE_CURRICULUM_URL (أضف "yearWeights": {"1":20,"2":40,"3":40} لملف
   JSON على GitHub) لأن هذه النسب تتغير من عام لآخر كما تعرف. */
function getYearWeights(){
    return (window.__REMOTE_CURRICULUM_META__ && window.__REMOTE_CURRICULUM_META__.yearWeights) || { "1":20, "2":40, "3":40 };
}

function getSavedYearAverages(){
    try{ return JSON.parse(localStorage.getItem("khuta_year_averages")) || {}; }catch(e){ return {}; }
}

function saveYearAverage(){
    const grade = document.getElementById("gpa-grade").value;
    const resultText = document.getElementById("gpa-result").textContent;
    const avg = parseFloat(resultText);
    if(isNaN(avg)){ showToast(currentLang==='ar' ? "احسب المعدل أولاً" : "Calculate the average first"); return; }
    const saved = getSavedYearAverages();
    saved[grade] = avg;
    localStorage.setItem("khuta_year_averages", JSON.stringify(saved));
    showToast(currentLang==='ar' ? `✅ تم حفظ معدل ${gradeLabelAr(grade)}` : `✅ Saved Year ${grade} average`);
    renderSavedYearAverages();
    debouncedSync();
}

function gradeLabelAr(grade){
    return grade === "1" ? "أول ثانوي" : grade === "2" ? "ثاني ثانوي" : "ثالث ثانوي";
}

function renderSavedYearAverages(){
    const saved = getSavedYearAverages();
    const y1 = document.getElementById("gpa-y1-display");
    if(!y1) return;
    document.getElementById("gpa-y1-display").textContent = saved["1"] != null ? saved["1"].toFixed(2) + "%" : "—";
    document.getElementById("gpa-y2-display").textContent = saved["2"] != null ? saved["2"].toFixed(2) + "%" : "—";
    document.getElementById("gpa-y3-display").textContent = saved["3"] != null ? saved["3"].toFixed(2) + "%" : "—";
}

function calcFinalHighSchoolPct(){
    const saved = getSavedYearAverages();
    const weights = getYearWeights();
    const missing = ["1","2","3"].filter(y => saved[y] == null);
    if(missing.length){
        showToast(currentLang==='ar'
            ? `أكمل حفظ معدل ${missing.map(gradeLabelAr).join(" و")} أولاً`
            : `Save the average for ${missing.join(", ")} first`);
        return;
    }
    const final = (saved["1"] * weights["1"] + saved["2"] * weights["2"] + saved["3"] * weights["3"]) / 100;
    document.getElementById("gpa-final-box").style.display = "block";
    document.getElementById("gpa-final-result").textContent = final.toFixed(2) + "%";
}

/* ============================================================
   الذكاء الاصطناعي الحقيقي لمساعد الأسئلة الشائعة (اختياري)
   ------------------------------------------------------------
   كيف تحصل على مفتاح مجاني من Gemini (Google):
   1) اذهب إلى https://aistudio.google.com/apikey
   2) سجّل دخولك بحساب Google، اضغط "Create API key"
   3) انسخ المفتاح كاملاً (زر "Copy key") والصقه هنا بين علامتي التنصيص
   الباقة المجانية كافية لتطبيق طلابي عادي.
   ✅ تصحيح مني: قلت لك سابقاً إن المفتاح الذي يبدأ بـ"AQ." شكله خاطئ —
   هذا كان خطأً مني. صور شاشتك من صفحة "API key details" في Google AI
   Studio تؤكد أن "AQ.Ab8..." هو فعلاً الشكل الحالي الصحيح لمفاتيح Gemini
   (شكل المفاتيح تغيّر). اعتذر عن الالتباس — أي مفتاح نسخته من هناك بزر
   "Copy key" صحيح ويعمل.
   ⚠️ بما أنك عرضت عدة مفاتيح في المحادثة، لم أضع أياً منها هنا حفاظاً على
   نظافة الكود المُسلَّم — الصق أنت مفتاحاً واحداً تختاره (يفضَّل مشروع
   واحد واضح الاسم، واحذف الباقي من aistudio.google.com/apikey لتنظيف
   حسابك، ليس ضرورياً لكنه أنظف).
   تأكد أيضاً أن "Generative Language API" مُفعّلة على نفس المشروع الذي
   أخذت منه المفتاح، من Google Cloud Console → APIs & Services → Library.
   ⚠️ تحذير أمني صادق (لا يزال قائماً): أي مفتاح توضعه هنا يظهر لأي شخص
   يفتح "عرض مصدر الصفحة" في متصفحه، لأن هذا كود يعمل في متصفح الطالب
   مباشرة (client-side). بما أن موقعك يُرفع عبر Netlify Drop (رفع يدوي
   وليس من GitHub)، فلا يوجد خطر إضافي من مستودع عام — الخطر الوحيد هو
   نفسه: أي زائر لموقعك يقدر يرى المفتاح عبر أدوات المطوّر. مقبول لتطبيق
   طلابي بسيط على الخطة المجانية.
   ============================================================ */
/* ⚠️ لم يعد مفتاح Gemini يُكتب هنا إطلاقاً — كان ظاهراً لأي شخص يفتح "عرض
   مصدر الصفحة"، وهذه كانت أكبر ثغرة أمنية في الموقع. المفتاح الآن يعيش فقط
   كمتغيّر بيئة سرّي على خوادم Netlify (GEMINI_API_KEY)، ولا يصل للمتصفح
   إطلاقاً — الطلبات تمر عبر netlify/functions/gemini-proxy.js بدلاً من
   الاتصال المباشر بـGoogle. راجع تعليمات الإعداد المرفقة لضبط المتغيّر. */
const GEMINI_MODEL = "gemini-flash-latest"; // مطابق تماماً لمثال "Copy cURL quickstart" في Google AI Studio
const GEMINI_SYSTEM_PROMPT = `أنت "مساعد خُطى"، مساعد ذكي شامل لطلاب اختبار القدرات المعرفية (GAT) السعودي داخل تطبيق خُطى. لك دوران أساسيان:

【الدور الأول: حل وشرح أسئلة القدرات】
أنت قادر تماماً على حل وشرح أي سؤال كمي (رياضي) أو لفظي من نمط اختبار القدرات السعودي:
- كمي: نسب وتناسب، جبر، هندسة، إحصاء ووصف بيانات، تشابه وترتيب، تتابعات عددية، مقارنات كمية.
- لفظي: تناظر لفظي، إكمال جمل، خطأ سياقي، استيعاب مقروء، معنى المفردات في سياقها.
عند حل سؤال: اشرح خطوة بخطوة بوضوح، أعط الإجابة النهائية بجرأة، ولا تتهرب من حل أي سؤال رياضي أو لفظي يطرحه الطالب مهما كان مستواه.

【الدور الثاني: خبير كامل بتطبيق خُطى نفسه】
معرفتك التفصيلية بالتطبيق:
- اللفظي: دورة إيهاب فقط (215 قسم، ~7 دقائق للقسم).
- الكمي تأسيس: كتاب المعاصر 10 (تحدي 30 يوم، 8 صفحات/يوم) أو أينشتاين (57 مقطع فيديو، ساعة/مقطع، مع نسخة مراجعة مختصرة 9 مقاطع فقط — ملاحظة: أينشتاين دورة قديمة نسبياً).
- الكمي تدريب: المنصف (120 بنك، ~50 دقيقة/بنك)، المفكر أقسام (90 قسم، ~30 دقيقة/قسم) وأكثر تكراراً (814 سؤال)، بنوك المعاصر (120 بنك).
- حاسبة الموزونة: تجمع (نسبة الثانوية × وزنها) + (درجة القدرات × وزنها) + (درجة التحصيلي × وزنها) + (درجة STEP × وزنها إن انطبق) = النسبة الموزونة من 100. الأوزان تختلف باختلاف الجامعة (مثال: جامعة الملك فهد تعتمد 10% ثانوية/50% قدرات/40% تحصيلي مع STEP كشرط اجتياز إجباري وليس له وزن رقمي؛ جامعة الملك عبدالعزيز تعتمد 30/30/30 + 10% STEP). التطبيق يحتوي أكثر من 30 جامعة سعودية بأوزانها ومتطلبات STEP كاملة، ويقفل STEP تلقائياً إن كان إجبارياً للجامعة المختارة.
- حاسبة المعدل التراكمي: معدل السنة = مجموع (درجة المادة × حصصها) ÷ مجموع الحصص. المعدل النهائي للثانوية = (معدل أول ثانوي × 20%) + (معدل ثاني ثانوي × 40%) + (معدل ثالث ثانوي × 40%).
- دليل التخصصات: أكثر من 20 تخصصاً سعودياً بوصف كل تخصص، مساره الوظيفي، تفرّعاته، والجامعات التي توفره — يفتح بالضغط على أي تخصص.
- المؤقّت الذكي: يقسّم وقت الطالب اليومي تلقائياً بين الكمي واللفظي (يبدأ بما يختاره الطالب)، ثم ينتقل تلقائياً للقسم الآخر عند انتهاء وقته. استراحة تلقائية كل ساعة مذاكرة متواصلة، بالإضافة لعدد محدود من استراحات الخمس دقائق يختاره الطالب. النظام الذكي يسأل الطالب أحياناً كم أنجز فعلياً، ويعيد توزيع الوقت بين الكمي واللفظي تلقائياً إذا تكرر نفس النمط 3 مرات.
- المجتمع: لوحة صدارة أسبوعية اختيارية، غرفة مذاكرة حية، حائط أسئلة سريع، وقوالب خطط يشاركها الطلاب فيما بينهم.
- التحفيز: XP (+10 لكل يوم يُكمله الطالب بالكامل)، مستويات من "مستكشف" حتى "خبير قدرات"، سلسلة أيام متتالية (Streak)، دروع حماية السلسلة (تُشترى بـXP)، أوسمة عادية وأخرى سرّية تُكتشف بالصدفة.
- حساب اختياري: الطالب يستخدم التطبيق بالكامل كضيف بدون أي حساب؛ الحساب (اسم مستخدم/كلمة مرور أو Google) فقط لمزامنة التقدم بين أجهزة متعددة.

أجب بإيجاز ووضوح بالعربية الفصحى المبسطة (أو الإنجليزية إن سُئلت بها)، وكن داعماً ومشجعاً. عند الأسئلة عن الجامعات أو التخصصات، اذكر أن البيانات تقريبية وتحقّق من الموقع الرسمي عند اتخاذ قرار فعلي.`;

/* ============================================================
   21) مساعد الأسئلة الشائعة — مطابقة كلمات مفتاحية بسيطة، وليس ذكاءً اصطناعياً
   ============================================================ */
const FAQ_BOT = [
    { kw:["ايهاب","إيهاب","لفظي"], ar:"دورة إيهاب هي مسارك الوحيد المعتمد للفظي في التطبيق — 215 قسم، كل قسم فيه 13-14 سؤال تقريباً.", en:"Ehab's course is your only Verbal track — 215 sections, ~13-14 questions each." },
    { kw:["تأسيس","معاصر"], ar:"كتاب المعاصر 10 للتأسيس الكمي: تحدي 30 يوماً بمعدل 8 صفحات يومياً تقريباً قبل الانتقال للتدريب.", en:"Al-Moaasir Book 10 for Quant foundation: a 30-day challenge, ~8 pages/day, before moving to training." },
    { kw:["منصف"], ar:"المنصف بنك تدريبي كمي: 120 بنكاً، كل بنك فيه 48-50 سؤالاً تقريباً، ويحتاج نحو 50 دقيقة لإنهائه.", en:"Al-Monsif is a Quant training bank: 120 banks, ~48-50 questions each, roughly 50 minutes to finish." },
    { kw:["مفكر"], ar:"المفكر: 90 قسماً (11 سؤال لكل قسم، نحو 30 دقيقة للقسم)، بالإضافة لقائمة الأكثر تكراراً (814 سؤالاً) لمن يريد الاختصار.", en:"Al-Mufakkir: 90 sections (11 questions each, ~30 min/section), plus a 'most repeated' list of 814 questions for a faster track." },
    { kw:["اينشتاين","أينشتاين","einstein"], ar:"أينشتاين مصدر كمي للتأسيس: 57 مقطع فيديو (ساعة تقريباً لكل مقطع)، وفيه أيضاً 9 مقاطع مراجعة سريعة فقط. ملاحظة: هذه الدورة قديمة نسبياً وسيصدر إصدار جديد قريباً، فلا نرشحها حالياً كخيار أول.", en:"Einstein is a Quant foundation source: 57 video lectures (~1 hour each), plus a 9-video quick-review-only subset. Note: this course is somewhat dated and a refreshed version is coming soon, so it's not currently our top recommendation." },
    { kw:["ستيب","step"], ar:"STEP اختبار كفاءة اللغة الإنجليزية من قياس. بعض الجامعات تشترطه إجبارياً لكل البرامج (كفهد وخالد وعبدالعزيز)، وبعضها لبرامج معينة فقط. راجع حاسبة الموزونة لمعرفة حالة جامعتك بالتحديد — التطبيق يفعّله تلقائياً ويمنعك من إلغائه إن كان إجبارياً لجامعتك.", en:"STEP is Qiyas's English proficiency test. Some universities require it for all programs (e.g. KFUPM, KKU, KAU), others only for specific programs. Check the Weighted Score calculator — the app auto-locks it on when it's mandatory for your university." },
    { kw:["موزونة","نسبة الموزونة"], ar:"استخدم قسم 'حساب الموزونة' من القائمة الجانبية — اختر جامعتك وستُعبّأ الأوزان تلقائياً، ثم أدخل درجاتك. الأوزان قابلة للتعديل اليدوي أيضاً.", en:"Use the 'Weighted Score' section from the sidebar — pick your university and the weights auto-fill, then enter your scores. Weights are also manually editable." },
    { kw:["جامعة","جامعات","اي جامعة","افضل جامعة"], ar:"يحتوي التطبيق على أكثر من 30 جامعة سعودية (حكومية وخاصة) مع أوزانها ومتطلبات STEP. اختر جامعتك من قائمة 'حساب الموزونة'، واضغط زر 'عرض التخصصات التي تتطلب STEP' لمزيد من التفاصيل.", en:"The app includes 30+ Saudi universities (public and private) with their weights and STEP requirements. Pick yours from the 'Weighted Score' list, and tap 'Show majors that require STEP' for more detail." },
    { kw:["تخصص","تخصصات","دليل التخصصات"], ar:"افتح 'دليل التخصصات' من القائمة الجانبية — اضغط على أي تخصص لرؤية تفرّعاته، مساره الوظيفي، والجامعات التي توفره.", en:"Open 'Specialty Guide' from the sidebar — tap any major to see its branches, career path, and which universities offer it." },
    { kw:["معدل","gpa","نسبة الثانوية","نسبة ثانوي"], ar:"حاسبة المعدل التراكمي والنسبة الثانوية موجودة داخل قسم 'حساب الموزونة' (زر 'حاسبة المعدل التراكمي' أعلى الصفحة). المعدل النهائي = (معدل أول ثانوي × 20%) + (معدل ثاني ثانوي × 40%) + (معدل ثالث ثانوي × 40%).", en:"The GPA/high-school-percentage calculator is inside 'Weighted Score' (the 'GPA Calculator' button at the top). Final GPA = (Year 1 avg × 20%) + (Year 2 avg × 40%) + (Year 3 avg × 40%)." },
    { kw:["وقت","مذاكرة","جدول","كم ساعة"], ar:"لا يوجد عدد ساعات 'صحيح' واحد — حدّد وقتك اليومي في شاشة تخصيص الخطة وسيوزّع التطبيق المنهج تلقائياً حسب مدة خطتك.", en:"There's no single 'correct' number of hours — set your daily time in the plan setup and the app distributes the material over your plan length automatically." },
    { kw:["استراحة","استراحه","راحة"], ar:"عند تفعيل جلسة تزيد عن ساعة، يبدأ التطبيق استراحات تلقائية بالمدة التي تحددها (1-25 دقيقة). ولديك أيضاً استراحات 5 دقائق قصيرة بعدد محدود تختاره أنت لكل جلسة.", en:"For sessions longer than an hour, the app triggers automatic breaks at the duration you set (1-25 min). You also get short 5-minute breaks, limited to a count you choose per session." },
    { kw:["ايقاف مؤقت","توقف","بوز","pause"], ar:"زر الإيقاف المؤقت للظروف الطارئة فقط. إن تجاوزت 5 دقائق يحذّرك التطبيق، وإن وصلت 10 دقائق يُعتبر يومك غير مكتمل وتنكسر سلسلة مذاكرتك (Streak) — التزم بجلساتك قدر الإمكان.", en:"The pause button is for real emergencies only. Past 5 minutes you'll get a warning; at 10 minutes the day counts as incomplete and your streak breaks — stick to your sessions as much as possible." },
    { kw:["حساب","تسجيل الدخول","مزامنة","دخول"], ar:"يمكنك استخدام التطبيق كضيف بدون حساب إطلاقاً. لحفظ تقدمك ونقله لجهاز آخر، أنشئ حساباً باسم مستخدم وكلمة مرور فقط (أو Google) من الملف الشخصي.", en:"You can use the app fully as a guest, no account needed. To save and carry your progress to another device, create an account with just a username and password (or Google) from Profile." },
    { kw:["مجتمع","صدارة","غرفة مذاكرة","حائط"], ar:"قسم 'المجتمع' فيه لوحة صدارة أسبوعية اختيارية، غرفة مذاكرة تعرض عدد الطلاب المذاكرين معك الآن، وحائط أسئلة سريع.", en:"The 'Community' section has an optional weekly leaderboard, a study room showing how many students are studying with you right now, and a quick questions wall." },
    { kw:["قلق","توتر","خايف","خوف"], ar:"طبيعي جداً أن تشعر بالقلق قبل اختبار مهم. جرّب تقسيم مذاكرتك لجلسات قصيرة مع فواصل راحة (استخدم مؤقّت التركيز في الصفحة الرئيسية)، وتذكّر أن التحضير المتدرج أهم من الكمال.", en:"It's completely normal to feel anxious before an important test. Try short focused sessions with breaks (use the focus timer on the dashboard), and remember steady preparation matters more than perfection." },
    { kw:["xp","نقاط","مستوى","مستويات"], ar:"نقاط الخبرة (XP) تحفيزية فقط ومنفصلة عن نسبة تقدمك الفعلية — تحصل عليها عند إنهاء المهام، وترتفع مستوياتك من 'مستكشف' حتى 'خبير قدرات 🏆'.", en:"XP is purely motivational and separate from your actual progress percentage — you earn it by finishing tasks, leveling up from 'Explorer' to 'Qudrat Expert 🏆'." },
    { kw:["درع","حماية السلسلة","shield"], ar:"يمكنك شراء 'درع' بـ100 نقطة خبرة من صفحة الملف الشخصي — يحمي سلسلة مذاكرتك تلقائياً أول يوم تفوّته دون قصد.", en:"You can buy a 'shield' with 100 XP from your Profile page — it auto-protects your streak the first day you accidentally miss." },
    { kw:["كمي اولا","لفظي اولا","ترتيب الجلسة","تبديل"], ar:"تختار في شاشة تخصيص الخطة أي قسم تبدأ به دائماً (كمي أو لفظي)، وعند تشغيل المؤقت ينتقل تلقائياً للقسم الآخر عند انتهاء وقت الأول مع تنبيه بسيط.", en:"In plan setup you choose which section you always start with (Quant or Verbal) — the timer automatically switches to the other one when the first finishes, with a simple notification." },
    { kw:["يتعلم","ذكاء الجدول","تعديل تلقائي"], ar:"بعد كل جلسة، قد يسألك التطبيق أحياناً هل كان وقت القسم مناسباً — وبعد 3 إجابات متكررة بنفس الاتجاه، يعيد توزيع وقتك تلقائياً بين الكمي واللفظي ليناسب سرعتك الحقيقية.", en:"After some sessions, the app may ask if the section's time felt right — after 3 consistent answers in the same direction, it auto-rebalances your Quant/Verbal time split to match your real pace." },
    { kw:["قالب","قوالب","خطة طالب اخر"], ar:"في قسم 'المجتمع' يمكنك نشر خطتك الحالية كقالب ليستفيد منه غيرك، أو تصفح قوالب طلاب آخرين واستخدامها مباشرة، مع إمكانية تقييمها 👍👎.", en:"In the 'Community' section you can publish your current plan as a template for others, or browse and use other students' templates, with 👍👎 ratings." },
];

function toggleChatbot(){
    const panel = document.getElementById("chatbot-panel");
    const opening = panel.style.display === "none";
    panel.style.display = opening ? "flex" : "none";
    if(opening && !panel.dataset.inited){
        panel.dataset.inited = "1";
        addChatbotMessage(currentLang==='ar' ? "أهلاً! أنا مساعد الأسئلة الشائعة لتطبيق خُطى. اسألني عن إيهاب، المنصف، المفكر، المعاصر، أو STEP." : "Hi! I'm Khuta's FAQ assistant. Ask me about Ehab, Al-Monsif, Al-Mufakkir, Al-Moaasir, or STEP.", "bot");
        renderChatbotSuggestions();
    }
}

function renderChatbotSuggestions(){
    const box = document.getElementById("chatbot-suggestions");
    const picks = currentLang === "ar" ? ["كم قسم في إيهاب؟","ما هو STEP؟","كيف أحسب موزونتي؟"] : ["How many Ehab sections?","What is STEP?","How do I calculate my score?"];
    box.innerHTML = picks.map(p => `<button type="button" onclick="askChatbot('${p.replace(/'/g,"\\'")}')">${p}</button>`).join("");
}

function addChatbotMessage(text, who){
    const box = document.getElementById("chatbot-messages");
    const div = document.createElement("div");
    div.className = "chatbot-msg " + who;
    div.textContent = text;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function askChatbot(text){
    document.getElementById("chatbot-input").value = text;
    sendChatbotMessage();
}

let chatHistory = [];
let geminiWorking = true; // يُطفأ تلقائياً بعد أول فشل حتى لا نكرر محاولات بطيئة فاشلة كل رسالة
async function sendChatbotMessage(){
    const input = document.getElementById("chatbot-input");
    const text = input.value.trim();
    if(!text) return;
    addChatbotMessage(text, "user");
    input.value = "";

    if(geminiWorking){
        addChatbotMessage("...", "bot typing-indicator");
        try{
            const reply = await askGemini(text);
            removeTypingIndicator();
            addChatbotMessage(reply, "bot");
            return;
        }catch(e){
            removeTypingIndicator();
            geminiWorking = false; // نتوقف عن محاولة Gemini لبقية الجلسة، وننتقل للمساعد المحلي فوراً
            console.error("[خُطى] Gemini غير متاح، التحويل للمساعد المحلي:", e);
        }
    }
    answerLocally(text);
}

function answerLocally(text){
    const lower = text.toLowerCase();
    const match = FAQ_BOT.find(f => f.kw.some(k => lower.includes(k.toLowerCase())));
    setTimeout(() => {
        if(match){
            addChatbotMessage(currentLang==='ar' ? match.ar : match.en, "bot");
        } else {
            addChatbotMessage(currentLang==='ar'
                ? "ما عندي إجابة جاهزة لهذا السؤال تحديداً. جرّب صياغة أخرى، أو تواصل معنا مباشرة عبر واتساب من صفحة الروابط."
                : "I don't have a ready answer for that specific question. Try rephrasing, or reach us directly via WhatsApp from the Links page.", "bot");
        }
    }, 250);
}

function removeTypingIndicator(){
    const el = document.querySelector(".typing-indicator");
    if(el) el.remove();
}

async function askGemini(userText){
    chatHistory.push({ role:"user", parts:[{ text:userText }] });
    // نتصل بالدالة الوسيطة على خوادمنا بدل الاتصال المباشر بـGoogle — المفتاح
    // الحقيقي لا يغادر الخادم إطلاقاً، فلا يظهر أبداً في متصفح الطالب
    const res = await fetch("/.netlify/functions/gemini-proxy", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({
            model: GEMINI_MODEL,
            system_instruction: { parts:[{ text: GEMINI_SYSTEM_PROMPT }] },
            contents: chatHistory.slice(-10),
        })
    });
    if(!res.ok){
        const errBody = await res.text().catch(() => "");
        console.error("[خُطى] الدالة الوسيطة رفضت الطلب — الحالة:", res.status, "التفاصيل:", errBody);
        throw new Error("Gemini proxy HTTP " + res.status);
    }
    const json = await res.json();
    const reply = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
    if(!reply) throw new Error("Empty Gemini response");
    chatHistory.push({ role:"model", parts:[{ text: reply }] });
    return reply;
}

/* ============================================================
   22) العلامة المائية
   ============================================================ */
(function initWatermark(){
    const slot = document.getElementById("owner-name-slot");
    if(slot && APP_OWNER_NAME) slot.textContent = APP_OWNER_NAME;
})();

/* تسجيل الـ Service Worker لتفعيل تثبيت الموقع كتطبيق (PWA) على الجوال/سطح
   المكتب — فشل صامت تماماً في أي متصفح لا يدعمه، لا يؤثر على عمل الموقع */
if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { /* تجاهل بصمت */ });
    });
}
