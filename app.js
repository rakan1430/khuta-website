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
"setup.verbalTitle":"القسم اللفظي","setup.skipVerbal":"أذاكر الكمي فقط — تخطَّ اللفظي بالكامل من خطتي",
"setup.restDay":"يوم راحة أسبوعي (اختياري)","setup.restDayNone":"بدون يوم راحة — أذاكر يومياً","setup.restFri":"الجمعة","setup.restSat":"السبت","setup.restSun":"الأحد","setup.restMon":"الاثنين","setup.restTue":"الثلاثاء","setup.restWed":"الأربعاء","setup.restThu":"الخميس",
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
"wiz.welcomeTitle":"أهلاً بك يا بطل في خُطى!","wiz.welcomeDesc":"بخطوات بسيطة ومتتالية، بنينلك خطة مذاكرة كاملة مخصصة لك تماماً — مصادرك، وقتك، وحتى روتين أسبوعك. تقدر تتنقل بين الخطوات بحرية، وتترك أي شي على الوضع الافتراضي إذا ما كنت متأكداً.",
"wiz.plansTitle":"خططك المحفوظة","wiz.plansDesc":"إذا عندك خطة محفوظة تبي ترجع لها، فعّلها من هنا مباشرة. أو أكمل الخطوات التالية لبناء/تعديل خطتك الحالية.",
"wiz.verbalTitle":"مصدرك للفظي","wiz.verbalDesc":"هذا مسارك المعتمد للقسم اللفظي",
"wiz.foundTitle":"مصدرك لتأسيس الكمي","wiz.foundDesc":"اختر من أين تبدأ أساسياتك في القسم الكمي",
"wiz.trainTitle":"مصادر تدريبك الكمي","wiz.trainDesc":"اختر بنكاً واحداً أو أكثر — يمكنك الجمع بينها",
"wiz.extraTitle":"إعدادات إضافية","wiz.extraDesc":"مراجعة ليلة الامتحان، وترتيب جلستك اليومية",
"wiz.paceTitle":"إيقاع خطتك","wiz.paceDesc":"مدة الخطة، وقتك اليومي، ويوم راحتك الأسبوعي إن أردت","wiz.showPreview":"إظهار التفاصيل",
"wiz.routineTitle":"روتينك الأسبوعي","wiz.routineDesc":"حدّد إيقاع كل يوم، وأضف أي تواريخ سفر أو ظروف مستثناة",
"wiz.breaksTitle":"استراحتك الذكية","wiz.breaksDesc":"كل ساعة مذاكرة متواصلة، تبدأ استراحة تلقائية بالمدة التي تحددها",
"wiz.confirmTitle":"خطتك جاهزة!","wiz.confirmDesc":"اكتب اسماً لحفظ هذه الخطة (اختياري)، ثم ابدأ رحلتك",
"wiz.next":"التالي","wiz.prev":"السابق","wiz.skip":"تخطّي",
"alert.title":"أحسنت! انتهت الجلسة 🎯",
"alert.msg":"لقد أتممت جلسة تركيز رائعة. خذ نفساً عميقاً — استحققت استراحة قصيرة.",
"alert.continue":"متابعة",
"intro.skip":"تخطّي والبدء الآن",
"brand.tag":"رفيق القدرات",
"nav.dashboard":"الخطة والجدول","nav.calculator":"حساب الموزونة","nav.links":"الروابط المباشرة","nav.profile":"الملف الشخصي",
"nav.account":"الحساب والمزامنة","nav.specialties":"دليل التخصصات","nav.community":"المجتمع",
"nav.board":"السبورة الذكية","nav.boardShort":"السبورة",
"nav.examSim":"اختبارات محاكية","nav.examSimShort":"اختبارات","nav.tutors":"مدرّسون خصوصيون","nav.tutorsShort":"مدرّسون",
"examsim.title":"اختبارات محاكية","examsim.sub":"تدرّب بنمط مطابق تماماً لاختبار قياس الفعلي — بوقت أو بدون وقت.","examsim.full":"اختبار قدرات كامل","examsim.verbalOnly":"لفظي فقط","examsim.quantOnly":"كمي فقط","examsim.timed":"بوقت (كالاختبار الحقيقي)","examsim.untimed":"بدون وقت","examsim.start":"ابدأ الاختبار",
"examsim.exit":"خروج","examsim.questionsNav":"الأسئلة","examsim.answered":"مُجاب","examsim.current":"الحالي","examsim.unanswered":"غير مُجاب","examsim.submit":"إنهاء وتصحيح","examsim.prev":"السابق","examsim.next":"التالي","examsim.resultsTitle":"نتيجتك","examsim.review":"مراجعة الإجابات",
"tutors.title":"مدرّسون خصوصيون","tutors.sub":"مُقيَّمون من طلاب حقيقيين — بالتواصل معنا فقط يُضاف أي مدرّس","tutors.add":"إضافة مدرّس",
"nav.tahsili":"التحصيلي","nav.step":"ستيب (STEP)","nav.soon":"قريباً",
"nav.dashboardShort":"الجدول","nav.calcShort":"الموزونة","nav.linksShort":"المصادر","nav.profileShort":"الملف",
"nav.specialtiesShort":"التخصصات","nav.communityShort":"المجتمع",
"progress.eyebrow":"مسار التقدم","progress.title":"أنت في الطريق الصحيح 🚀",
"progress.dayOf":"اليوم الحالي","progress.totalDays":"إجمالي الأيام","progress.remaining":"أيام متبقية","progress.tasksDone":"مهام مكتملة",
"table.title":"جدول مهامك المخصص","table.sub":"تُحسب الكميات تلقائياً بناءً على مدة خطتك","table.reset":"إعادة ضبط الخطة","table.editSources":"تعديل المصادر والخطة","table.freshStart":"بدء من جديد بالكامل","table.postponeToday":"تأجيل اليوم",
"dash.customize":"تخصيص لوحتك","dash.customizeTitle":"تخصيص لوحتك","dash.customizeDesc":"اختر البطاقات التي تريد رؤيتها، ورتّبها من صفحة اللوحة نفسها بأسهم أعلى/أسفل.","dash.resetDefault":"إعادة الضبط الافتراضي","dash.done":"تم",
"deepreport.title":"تقريرك الأسبوعي المتعمّق","deepreport.sub":"تحليل حقيقي من بيانات مذاكرتك الفعلية — ليس تقديراً.",
"overview.totalXp":"إجمالي نقاط الخبرة","overview.today":"اليوم","overview.streakDays":"يوم متتالي","overview.studyHours":"ساعة مذاكرة","overview.tasksToday":"إنجاز اليوم","overview.activityTitle":"نشاطك اليومي","overview.activitySub":"كل مربع يمثّل يوماً — كلما اغمّق اللون زادت دقائق مذاكرتك فيه","overview.less":"أقل","overview.more":"أكثر","overview.questsTitle":"مهام اليوم","overview.questsSub":"لمحة سريعة — عدّلها من جدولك الكامل أدناه","overview.leaderboardTitle":"لوحة الصدارة",
"notif.title":"الإشعارات","notif.clearAll":"مسح الكل",
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
"profile.title":"الملف الشخصي","profile.noGoal":"لم تحدد جامعة الهدف بعد","profile.choosePreset":"أو اختر صورة جاهزة",
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
"account.note":"اسم مستخدم وكلمة مرور فقط تكفي للبدء — البريد اختياري ولاسترجاع كلمة المرور فقط.",
"account.realEmailOptional":"بريدك الإلكتروني (اختياري)","account.emailOptionalNote":"أدخله لتفعيل استرجاع كلمة المرور المنسية فوراً. اتركه فارغاً إن كنت تفضّل عدم مشاركة بريدك — لن نطلبه إلا برضاك.",
"account.syncNow":"مزامنة الآن","account.signout":"تسجيل الخروج",
"account.changePass":"تغيير كلمة المرور","account.newPass":"كلمة المرور الجديدة","account.newPass2":"تأكيد كلمة المرور الجديدة","account.savePass":"حفظ كلمة المرور الجديدة",
"account.linkEmail":"ربط بريد لاسترجاع كلمة المرور","account.linkEmailDesc":"اربط بريدك الحقيقي مرة واحدة لتتمكّن من استرجاع كلمة المرور مستقبلاً إن نسيتها. سنرسل رابط تأكيد لهذا البريد — لن يكون فعّالاً إلا بعد الضغط عليه.","account.realEmail":"بريدك الإلكتروني الحقيقي","account.sendLink":"إرسال رابط التأكيد",
"account.forgotPass":"نسيت كلمة المرور؟","account.forgotPassDesc":"اكتب اسم مستخدمك. يعمل هذا فقط إن كنت قد ربطت بريداً حقيقياً بحسابك (عند التسجيل أو لاحقاً من الملف الشخصي).","account.sendResetLink":"إرسال رابط إعادة التعيين",
"account.setNewPassTitle":"عيّن كلمة مرور جديدة","account.setNewPassDesc":"وصلت هنا عبر رابط إعادة تعيين كلمة المرور — اكتب كلمة مرورك الجديدة.",
"referral.title":"ادعُ صديقاً","referral.desc":"كل صديق ينضم عبر رابطك يمنحك ويمنحه 50 XP.","referral.share":"مشاركة رابط الدعوة",
"mistakebank.title":"بنك أخطائك الشخصية","mistakebank.desc":"ليست أخطاء القدرات — بل أنماطك الشخصية التي تعطّل تقدّمك، نكتشفها من سلوكك الفعلي بمرور الوقت.",
"account.marketingConsent":"أوافق على استقبال رسائل تذكيرية أحياناً على بريدي (ليست يومية، ويمكنك إيقافها متى شئت)","account.termsAgree":"بإنشائك حساباً فأنت توافق على","account.and":"و",
"legal.termsLink":"شروط الاستخدام","legal.privacyLink":"سياسة الخصوصية",
"privacy.title":"الخصوصية والرسائل","privacy.desc":"تحكّم كامل بما يصلك وبما نحفظه عنك.","privacy.noEmailNote":"لم تربط بريداً بحسابك بعد — اربطه أعلاه لتفعيل هذا الخيار.",
"consent.title":"نرسل لك أحياناً؟","consent.body":"عندك بريد مرتبط بحسابك — تحب نرسل لك أحياناً رسالة تذكيرية بسيطة تشجّعك ترجع تذاكر؟ (ليست يومية إطلاقاً، وتقدر توقفها متى شئت من ملفك الشخصي)","consent.yes":"نعم، أرسلوا لي","consent.no":"لا، شكراً",
"push.title":"التذكير اليومي","push.desc":"إشعار حقيقي يصلك حتى لو أغلقت الموقع تماماً، إن لم تكمل جلستك اليوم.","push.enable":"فعّل التذكير اليومي",
"focus.exit":"خروج من وضع التركيز","focus.title":"وضع التركيز","focus.subtitle":"ركّز الآن، وكن فخوراً لاحقاً.","focus.todayTasks":"مهام اليوم","focus.xpPoints":"نقاط XP",
"focus.idle":"جاهز للبدء","focus.paused":"متوقف مؤقتاً","focus.inSession":"في جلسة تركيز","focus.onBreak":"في استراحة","focus.start":"ابدأ التركيز","focus.skip":"تخطّي",
"focus.themeNight":"ليل نجمي","focus.themeForest":"غابة هادئة","focus.themeSunset":"غروب الشمس","focus.themeDesk":"مكتب وقهوة","focus.themeOcean":"محيط هادئ","focus.themeDawn":"فجر دافئ",
"account.noRecoveryNote":"💡 إن نسيت كلمة مرورك مستقبلاً، الاسترجاع يعمل فقط إن ربطت بريداً حقيقياً (بالأسفل، إن لم تفعل عند التسجيل).",
"spec.title":"دليل التخصصات الذكي","spec.sub":"نظرة عامة تعريفية — راجع مواقع الجامعات لتفاصيل كل كلية بدقة","spec.search":"ابحث عن تخصص...",
"room.title":"غرفة المذاكرة","room.sub":"لست وحدك — بدون شات، فقط إحساس بالرفقة","room.studying":"طالب يذاكر الآن معك",
"lb.title":"لوحة الصدارة الأسبوعية","lb.sub":"اختياري بالكامل — شارك نقاطك التحفيزية إن أردت","lb.share":"شارِك اسمي ونقاطي في لوحة الصدارة",
"forum.title":"حائط الأسئلة السريعة","forum.sub":"اسأل، وأجب على زملائك","forum.placeholder":"اكتب سؤالك هنا...",
"tpl.title":"قوالب الخطط من الطلاب","tpl.sub":"استفد من خطط طلاب آخرين، أو شارك خطتك الحالية ليستفيد منها غيرك",
"tpl.publish":"نشر خطتي الحالية كقالب","tpl.formTitle":"عنوان القالب","tpl.formTitlePh":"مثال: خطة مكثفة لمدة 30 يوماً",
"tpl.previewLabel":"معاينة تفاصيل خطتك (تُنقل تلقائياً لمن يستخدم القالب)",
"tpl.formDesc":"ملاحظات إضافية (اختياري) — أي تفاصيل يدوية تريد إضافتها","tpl.confirmPublish":"نشر",
"bot.title":"مساعدك الذكي","bot.disclaimer":"مدعوم بالذكاء الاصطناعي 🤖","bot.placeholder":"اكتب سؤالك...",
"fab.title":"اسأل مساعدك","fab.subtitle":"ذكاء اصطناعي حقيقي",
},
en:{
"login.tagline":"Your smart companion for the Qudrat journey",
"login.google":"Continue with Google","login.apple":"Continue with Apple","login.or":"or","login.guest":"Continue as guest, no account",
"login.first":"First name","login.firstPh":"e.g. Rakan",
"login.last":"Last name","login.lastPh":"e.g. Alharbi",
"login.next":"Next: customize my plan",
"setup.title":"Customize your Qudrat study tracks",
"setup.subtitle":"Pick your preferred sources and we'll build a precisely calculated schedule",
"setup.verbalTitle":"Verbal Section","setup.skipVerbal":"I only study Quant — skip Verbal entirely from my plan",
"setup.restDay":"Weekly rest day (optional)","setup.restDayNone":"No rest day — study every day","setup.restFri":"Friday","setup.restSat":"Saturday","setup.restSun":"Sunday","setup.restMon":"Monday","setup.restTue":"Tuesday","setup.restWed":"Wednesday","setup.restThu":"Thursday",
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
"wiz.welcomeTitle":"Welcome to Khuta, champ!","wiz.welcomeDesc":"In a few simple steps, we'll build you a complete study plan — your sources, your time, even your weekly routine. Move freely between steps, and leave anything on default if you're not sure.",
"wiz.plansTitle":"Your saved plans","wiz.plansDesc":"If you have a saved plan you'd like to return to, activate it right here. Or continue through the steps to build/edit your current plan.",
"wiz.verbalTitle":"Your Verbal source","wiz.verbalDesc":"This is your approved track for the Verbal section",
"wiz.foundTitle":"Your Quant foundation source","wiz.foundDesc":"Choose where you'll build your Quant fundamentals",
"wiz.trainTitle":"Your Quant training sources","wiz.trainDesc":"Pick one or more banks — you can combine them",
"wiz.extraTitle":"Extra settings","wiz.extraDesc":"Exam-eve review, and your daily session order",
"wiz.paceTitle":"Your plan's pace","wiz.paceDesc":"Plan length, daily time, and a weekly rest day if you'd like","wiz.showPreview":"Show details",
"wiz.routineTitle":"Your weekly routine","wiz.routineDesc":"Set the rhythm of each day, and add any travel or excused dates",
"wiz.breaksTitle":"Smart breaks","wiz.breaksDesc":"Every continuous study hour triggers an automatic break of the length you set",
"wiz.confirmTitle":"Your plan is ready!","wiz.confirmDesc":"Name this plan to save it (optional), then start your journey",
"wiz.next":"Next","wiz.prev":"Previous","wiz.skip":"Skip",
"alert.title":"Nicely done! Session complete 🎯",
"alert.msg":"You finished a great focus session. Take a deep breath — you've earned a short break.",
"alert.continue":"Continue",
"intro.skip":"Skip & start now",
"brand.tag":"QUDRAT COMPANION",
"nav.dashboard":"Plan & Schedule","nav.calculator":"Weighted Score","nav.links":"Quick Links","nav.profile":"Profile",
"nav.account":"Account & Sync","nav.specialties":"Specialty Guide","nav.community":"Community",
"nav.board":"Smart Board","nav.boardShort":"Board",
"nav.examSim":"Exam Simulator","nav.examSimShort":"Exams","nav.tutors":"Private Tutors","nav.tutorsShort":"Tutors",
"examsim.title":"Exam Simulator","examsim.sub":"Practice in a format that exactly matches the real Qiyas exam — timed or untimed.","examsim.full":"Full Qudrat exam","examsim.verbalOnly":"Verbal only","examsim.quantOnly":"Quant only","examsim.timed":"Timed (like the real exam)","examsim.untimed":"Untimed","examsim.start":"Start exam",
"examsim.exit":"Exit","examsim.questionsNav":"Questions","examsim.answered":"Answered","examsim.current":"Current","examsim.unanswered":"Unanswered","examsim.submit":"Finish & grade","examsim.prev":"Previous","examsim.next":"Next","examsim.resultsTitle":"Your results","examsim.review":"Review answers",
"tutors.title":"Private Tutors","tutors.sub":"Rated by real students — tutors are only added by contacting us","tutors.add":"Add tutor",
"nav.tahsili":"Tahsili","nav.step":"STEP","nav.soon":"Soon",
"nav.dashboardShort":"Schedule","nav.calcShort":"Score","nav.linksShort":"Sources","nav.profileShort":"Profile",
"nav.specialtiesShort":"Majors","nav.communityShort":"Community",
"progress.eyebrow":"Progress path","progress.title":"You're on track 🚀",
"progress.dayOf":"Current day","progress.totalDays":"Total days","progress.remaining":"Days left","progress.tasksDone":"Tasks done",
"table.title":"Your custom task schedule","table.sub":"Quantities are calculated automatically from your plan length","table.reset":"Reset plan","table.editSources":"Edit sources & plan","table.freshStart":"Start completely fresh","table.postponeToday":"Postpone today",
"dash.customize":"Customize dashboard","dash.customizeTitle":"Customize Your Dashboard","dash.customizeDesc":"Choose which cards to show, and reorder them from the dashboard page using the up/down arrows.","dash.resetDefault":"Reset to default","dash.done":"Done",
"deepreport.title":"Your Deep Weekly Report","deepreport.sub":"Real analysis from your actual study data — not an estimate.",
"overview.totalXp":"Total XP","overview.today":"today","overview.streakDays":"day streak","overview.studyHours":"study hours","overview.tasksToday":"today's progress","overview.activityTitle":"Your daily activity","overview.activitySub":"Each square is a day — darker means more study minutes that day","overview.less":"Less","overview.more":"More","overview.questsTitle":"Today's tasks","overview.questsSub":"Quick glance — edit from your full schedule below","overview.leaderboardTitle":"Leaderboard",
"notif.title":"Notifications","notif.clearAll":"Clear all",
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
"profile.title":"Profile","profile.noGoal":"No target university set yet","profile.choosePreset":"Or choose a preset avatar",
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
"account.note":"A username and password are enough to start — email is optional, for password recovery only.",
"account.realEmailOptional":"Your email (optional)","account.emailOptionalNote":"Add it to enable forgotten-password recovery right away. Leave it blank if you'd rather not share it — we'll never require it.",
"account.syncNow":"Sync now","account.signout":"Sign out",
"account.changePass":"Change password","account.newPass":"New password","account.newPass2":"Confirm new password","account.savePass":"Save new password",
"account.linkEmail":"Link email for password recovery","account.linkEmailDesc":"Link your real email once so you can recover your password later if forgotten. We'll send a confirmation link to it — it only takes effect once clicked.","account.realEmail":"Your real email","account.sendLink":"Send confirmation link",
"account.forgotPass":"Forgot password?","account.forgotPassDesc":"Enter your username. This only works if you've linked a real email to your account (at signup or later from Profile).","account.sendResetLink":"Send reset link",
"account.setNewPassTitle":"Set a new password","account.setNewPassDesc":"You arrived here via a password reset link — enter your new password.",
"referral.title":"Invite a friend","referral.desc":"Every friend who joins via your link gives you both 50 XP.","referral.share":"Share invite link",
"mistakebank.title":"Your Personal Mistake Bank","mistakebank.desc":"Not GAT question mistakes — your own patterns that derail your progress, discovered from your actual behavior over time.",
"account.marketingConsent":"I agree to receive occasional reminder emails (not daily, and you can stop them anytime)","account.termsAgree":"By creating an account you agree to our","account.and":"and",
"legal.termsLink":"Terms of Use","legal.privacyLink":"Privacy Policy",
"privacy.title":"Privacy & Emails","privacy.desc":"Full control over what reaches you and what we store.","privacy.noEmailNote":"You haven't linked an email yet — link one above to enable this option.",
"consent.title":"Send you occasional emails?","consent.body":"You have an email linked — would you like an occasional gentle reminder to get back to studying? (Never daily, and you can stop anytime from your profile)","consent.yes":"Yes, please","consent.no":"No thanks",
"push.title":"Daily reminder","push.desc":"A real notification even if you've fully closed the site, if you haven't completed today's session.","push.enable":"Enable daily reminder",
"focus.exit":"Exit focus mode","focus.title":"Focus Mode","focus.subtitle":"Focus now, be proud later.","focus.todayTasks":"Today's tasks","focus.xpPoints":"XP Points",
"focus.idle":"Ready to start","focus.paused":"Paused","focus.inSession":"In a focus session","focus.onBreak":"On a break","focus.start":"Start focusing","focus.skip":"Skip",
"focus.themeNight":"Starry night","focus.themeForest":"Calm forest","focus.themeSunset":"Sunset","focus.themeDesk":"Desk & coffee","focus.themeOcean":"Calm ocean","focus.themeDawn":"Warm dawn",
"account.noRecoveryNote":"💡 If you forget your password later, recovery only works if you've linked a real email (below, if you skipped it at signup).",
"spec.title":"Smart Specialty Guide","spec.sub":"A general overview — check university sites for exact college details","spec.search":"Search a major...",
"room.title":"Study Room","room.sub":"You're not alone — no chat, just a sense of company","room.studying":"student(s) studying with you now",
"lb.title":"Weekly Leaderboard","lb.sub":"Fully optional — share your motivational points if you'd like","lb.share":"Share my name & points on the leaderboard",
"forum.title":"Quick Questions Wall","forum.sub":"Ask, and help your classmates","forum.placeholder":"Write your question here...",
"tpl.title":"Student Plan Templates","tpl.sub":"Benefit from other students' plans, or share your current one",
"tpl.publish":"Publish my current plan as a template","tpl.formTitle":"Template title","tpl.formTitlePh":"e.g. Intensive 30-day plan",
"tpl.previewLabel":"Preview of your plan details (auto-transfers to anyone who uses this template)",
"tpl.formDesc":"Extra notes (optional) — any manual details you'd like to add","tpl.confirmPublish":"Publish",
"bot.title":"Your smart assistant","bot.disclaimer":"Powered by AI 🤖","bot.placeholder":"Type your question...",
"fab.title":"Ask your assistant","fab.subtitle":"Real AI, ask anything",
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
    renderHeaderMiniAvatar();
    renderNotificationBell();
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
/* ============================================================
   تفاعلات دقيقة (Micro Interactions) — اهتزاز خفيف عند الخطأ، صوت رضا عند
   الإنجاز، Confetti عند الأهداف الكبيرة. كلها تتحقق من الدعم أولاً ولا
   تكسر شيئاً على جهاز أو متصفح لا يدعمها (iOS Safari مثلاً لا يدعم
   الاهتزاز إطلاقاً — يتجاهلها بصمت بدل أي خطأ).
   ============================================================ */
function hapticError(){
    if(navigator.vibrate) try{ navigator.vibrate(45); }catch(e){}
}
function hapticSuccess(){
    if(navigator.vibrate) try{ navigator.vibrate([25,40,25]); }catch(e){}
}

let __khutaAudioCtx = null;
// نغمة رضا قصيرة نولّدها برمجياً (Web Audio API) بدل ملف صوتي خارجي — لا
// حاجة لاستضافة أي أصل صوتي، وتعمل فوراً بلا تحميل
function playCompletionSound(){
    try{
        if(!__khutaAudioCtx) __khutaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = __khutaAudioCtx;
        if(ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        [523.25, 659.25].forEach((freq, i) => { // مي-صول: نغمتان قصيرتان صاعدتان، رضا لا إلحاح
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i*0.09);
            gain.gain.linearRampToValueAtTime(0.12, now + i*0.09 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i*0.09 + 0.22);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i*0.09); osc.stop(now + i*0.09 + 0.25);
        });
    }catch(e){ /* بعض المتصفحات تمنع الصوت قبل أول تفاعل مباشر من المستخدم — نتجاهل بصمت */ }
}

// Confetti خفيف بلا أي مكتبة خارجية — جسيمات CSS بسيطة تتساقط وتدور، تُزال
// نفسها تلقائياً بعد انتهاء الحركة
function triggerConfetti(){
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // نحترم تفضيل تقليل الحركة
    const colors = ["#C9962E","#1C8A72","#D6455A","#2E6BE0","#E8C77E"];
    const container = document.createElement("div");
    container.className = "confetti-container";
    for(let i = 0; i < 60; i++){
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = (Math.random()*100) + "%";
        piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = (Math.random()*0.4) + "s";
        piece.style.animationDuration = (2.2 + Math.random()*1.2) + "s";
        piece.style.setProperty("--drift", (Math.random()*140 - 70) + "px");
        container.appendChild(piece);
    }
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 3800);
}

function showToast(msg){
    const toast = document.getElementById("toast");
    document.getElementById("toast-text").textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    // مدة أطول للرسائل الأطول حتى يتسنى قراءتها فعلياً قبل اختفائها
    const duration = Math.max(5000, Math.min(9000, msg.length * 80));
    showToast._t = setTimeout(() => toast.classList.remove("show"), duration);
}

/* ============================================================
   38) مركز الإشعارات — سجلّ دائم (30 إشعاراً كحد أقصى) يظهر عبر
   جرس أعلى الصفحة، بالإضافة لعرض الإشعار فوراً كـ toast من الأسفل
   ============================================================ */
const NOTIFICATIONS_MAX = 30;
function getNotifications(){
    try{ return JSON.parse(localStorage.getItem("khuta_notifications")) || []; }catch(e){ return []; }
}
function pushNotification(titleAr, titleEn, bodyAr, bodyEn, icon){
    const list = getNotifications();
    list.unshift({
        id: Date.now() + "-" + Math.random().toString(36).slice(2,7),
        titleAr, titleEn, bodyAr, bodyEn,
        icon: icon || "fa-bell",
        ts: Date.now(),
        read: false,
    });
    localStorage.setItem("khuta_notifications", JSON.stringify(list.slice(0, NOTIFICATIONS_MAX)));
    renderNotificationBell();
    showToast(currentLang==='ar' ? titleAr : titleEn);
}
function markAllNotificationsRead(){
    const list = getNotifications();
    list.forEach(n => n.read = true);
    localStorage.setItem("khuta_notifications", JSON.stringify(list));
    renderNotificationBell();
}
function clearAllNotifications(){
    localStorage.setItem("khuta_notifications", "[]");
    renderNotificationBell();
    toggleNotificationPanel(false);
}
function timeAgoLabel(ts){
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if(diffMin < 1) return currentLang==='ar' ? "الآن" : "now";
    if(diffMin < 60) return currentLang==='ar' ? `قبل ${diffMin} د` : `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if(diffH < 24) return currentLang==='ar' ? `قبل ${diffH} س` : `${diffH}h ago`;
    const diffD = Math.round(diffH / 24);
    return currentLang==='ar' ? `قبل ${diffD} يوم` : `${diffD}d ago`;
}
function renderNotificationBell(){
    const badge = document.getElementById("notif-bell-badge");
    const focusBadge = document.getElementById("focus-header-bell-badge");
    const list = getNotifications();
    const unread = list.filter(n => !n.read).length;
    if(badge){
        badge.style.display = unread > 0 ? "flex" : "none";
        badge.textContent = unread > 9 ? "9+" : unread;
    }
    if(focusBadge){
        focusBadge.style.display = unread > 0 ? "flex" : "none";
        focusBadge.textContent = unread > 9 ? "9+" : unread;
    }
    const panelList = document.getElementById("notif-panel-list");
    if(!panelList) return;
    if(!list.length){
        panelList.innerHTML = `<div class="empty-note" style="padding:24px 10px;">${currentLang==='ar'?'لا توجد إشعارات بعد':'No notifications yet'}</div>`;
        return;
    }
    panelList.innerHTML = list.map(n => `
        <div class="notif-row ${n.read?'':'unread'}">
            <div class="notif-row-icon"><i class="fa-solid ${n.icon}"></i></div>
            <div class="notif-row-body">
                <b>${escapeHtml(currentLang==='ar'?n.titleAr:n.titleEn)}</b>
                <p>${escapeHtml(currentLang==='ar'?n.bodyAr:n.bodyEn)}</p>
                <span>${timeAgoLabel(n.ts)}</span>
            </div>
        </div>`).join("");
}
function toggleNotificationPanel(forceState){
    const panel = document.getElementById("notif-panel");
    const isOpen = panel.style.display !== "none" && !panel.classList.contains("panel-closing");
    const show = forceState !== undefined ? forceState : !isOpen;
    // اللوحة مثبَّتة أصلاً بجانب جرس رأس الصفحة الرئيسي — لكن ذلك الرأس يختفي
    // خلف طبقة وضع التركيز الكامل (z-index أعلى بكثير)، فإن فُتحت من هناك
    // نعيد وضعها فعلياً بجانب جرس وضع التركيز العائم بدل أن تظهر خلف كل شيء
    const overlay = document.getElementById("focus-mode-overlay");
    const inFocusMode = overlay && overlay.style.display !== "none";
    const focusBell = document.getElementById("focus-header-bell");
    // نحفظ مكان اللوحة الأصلي (بجانب جرس الرأس الرئيسي) لإعادتها إليه لاحقاً
    if(!panel.__homeParent) panel.__homeParent = panel.parentElement;
    if(show && inFocusMode && focusBell){
        // إصلاح جذري: الرأس الرئيسي عليه backdrop-filter، وهذا يجعله "حاوية
        // احتواء" لأي عنصر position:fixed بداخله ويحبس اللوحة داخل سياق تراصّ
        // يقع تحت طبقة وضع التركيز (z-index:7000) — فتُفتح اللوحة لكنها لا
        // تُرى أبداً. الحل: نقل اللوحة فعلياً داخل طبقة وضع التركيز نفسها.
        overlay.appendChild(panel);
        const r = focusBell.getBoundingClientRect();
        panel.style.position = "fixed";
        panel.style.top = (r.bottom + 12) + "px";
        panel.style.insetInlineEnd = (window.innerWidth - r.right) + "px";
        panel.style.zIndex = "7500";
    } else if(!show || !inFocusMode){
        // ملاحظة: عند الإغلاق لا نعيد اللوحة لمكانها الأصلي فوراً — مؤقّت
        // الإغلاق أدناه يتكفّل بذلك بعد انتهاء أنيميشن الاختفاء، وإلا قفزت
        // اللوحة بصرياً لموضع الرأس الرئيسي في منتصف الحركة
        if(!inFocusMode && panel.parentElement === panel.__homeParent){
            panel.style.position = "";
            panel.style.top = "";
            panel.style.insetInlineEnd = "";
            panel.style.zIndex = "";
        }
    }
    // إظهار/إخفاء بأنيميشن انسيابي بدل الظهور والاختفاء اللحظيين
    clearTimeout(panel.__closeTimer);
    if(show){
        panel.classList.remove("panel-closing");
        panel.style.display = "flex";
        markAllNotificationsRead();
    } else if(panel.style.display !== "none"){
        panel.classList.add("panel-closing");
        panel.__closeTimer = setTimeout(() => {
            panel.style.display = "none";
            panel.classList.remove("panel-closing");
            if(panel.__homeParent && panel.parentElement !== panel.__homeParent){
                panel.__homeParent.appendChild(panel);
                panel.style.position = ""; panel.style.top = "";
                panel.style.insetInlineEnd = ""; panel.style.zIndex = "";
            }
        }, 260);
    }
}
document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".notif-bell-wrap");
    const panel = document.getElementById("notif-panel");
    const focusBell = document.getElementById("focus-header-bell");
    if(!wrap || !panel || panel.style.display === "none") return;
    // كان هذا المستمع يغلق اللوحة فور فتحها من جرس وضع التركيز، لأن ذلك الجرس
    // ليس داخل .notif-bell-wrap — نستثنيه هو واللوحة نفسها (بعد نقلها) صراحةً
    if(wrap.contains(e.target)) return;
    if(focusBell && focusBell.contains(e.target)) return;
    if(panel.contains(e.target)) return;
    toggleNotificationPanel(false);
});

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
    const timeStr = now.toLocaleTimeString(locale, {hour:"2-digit", minute:"2-digit", second:"2-digit"});
    const dateStr = now.toLocaleDateString(locale, { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    document.getElementById("live-clock").textContent = timeStr;
    document.getElementById("live-date").textContent = dateStr;
    const focusClock = document.getElementById("focus-header-clock");
    const focusDate = document.getElementById("focus-header-date");
    // في وضع التركيز الكامل: ساعات ودقائق فقط (بلا ثوانٍ) لتوفير المساحة وتقليل التشتيت
    if(focusClock) focusClock.textContent = now.toLocaleTimeString(locale, {hour:"2-digit", minute:"2-digit"});
    if(focusDate) focusDate.textContent = dateStr;
}, 1000);

// عبارات تتناوب أسفل حلقة التحميل بينما البيانات الحقيقية لا تزال تُجلَب —
// لمسة بصرية بحتة، لا صلة لها بالتقدّم الفعلي (الحلقة نفسها هي التي تعكسه)
const LOADING_CAPTIONS_AR = ["نجهّز رحلتك…", "نرتب جدولك…", "نحضّر بياناتك…", "على وشك الجاهزية…"];
const LOADING_CAPTIONS_EN = ["Getting your journey ready…", "Setting up your schedule…", "Fetching your data…", "Almost there…"];
let loadingCaptionTimer = null;
function startLoadingCaptionRotation(){
    const el = document.getElementById("loading-caption");
    if(!el) return;
    const list = currentLang === "ar" ? LOADING_CAPTIONS_AR : LOADING_CAPTIONS_EN;
    let i = 0;
    loadingCaptionTimer = setInterval(() => {
        i = (i + 1) % list.length;
        el.style.opacity = "0";
        setTimeout(() => { el.textContent = list[i]; el.style.opacity = "1"; }, 220);
    }, 1600);
}

// يحدّث حلقة التحميل لتعكس نسبة البيانات المكتملة فعلياً (loaded/total) —
// وليست حركة دورانية عشوائية بلا معنى
const LOADING_RING_CIRCUMFERENCE = 263.9; // 2π×42، نفس نصف قطر الدائرة في index.html
function updateLoadingProgress(loaded, total){
    const arc = document.getElementById("loading-ring-arc");
    if(!arc || !total) return;
    const fraction = Math.min(1, loaded / total);
    arc.style.strokeDashoffset = String(LOADING_RING_CIRCUMFERENCE * (1 - fraction));
}

/* ============================================================
   5) تسجيل الدخول والتخصيص
   ============================================================ */
window.onload = () => {
    captureReferralParam();
    logSiteVisit();
    applyI18n();
    ensureTaskStatusFreshToday();
    initIdleDetection();
    startLoadingCaptionRotation();
    // نؤخّرها عمداً كي لا تزاحم بدء الصفحة ولا الجولة التعريفية للمستخدم الجديد
    setTimeout(maybeAskForMarketingConsent, 6000);

    // ⚠️ تحسين مهم: كل دوال جلب البيانات أدناه كانت تُستدعى وتُترَك (fire-and-
    // forget) بينما تختفي شاشة التحميل فوراً تقريباً بلا انتظارها — فيدخل
    // الطالب أحياناً قبل اكتمال قوائم الجامعات/إلخ. الآن نجمعها في مصفوفة
    // ونعرض شاشة التحميل حتى تكتمل فعلياً (كل دالة أدناه تتعامل مع فشلها
    // داخلياً وتسقط برفق لبيانات محلية احتياطية، فلا يوجد خطر تعليق إلى
    // الأبد — ومؤقّت الأمان في index.html يبقى شبكة أمان أخيرة أصلاً).
    const coreDataLoaders = [
        tryLoadUniversitiesFromSupabase(),
        tryLoadRemoteUniversities(),
        tryLoadRemoteContent(),
        tryLoadRemoteCurriculum(),
        tryLoadRemoteSpecialties(),
        tryLoadRemoteExamQuestions(),
        // بنك الأسئلة المشترك (مساهمات الطلاب المُتحقَّق منها) — ينتظره التحميل
        // أيضاً كي لا يبدأ الطالب اختباراً محاكياً قبل وصول الأسئلة المشتركة
        // فيراها ناقصة. الدالة تبتلع أخطاءها داخلياً فلا تُفشل بقية التحميل.
        loadSharedExamQuestions(),
    ];
    let loadedCount = 0;
    updateLoadingProgress(0, coreDataLoaders.length);
    coreDataLoaders.forEach(p => p.then(() => updateLoadingProgress(++loadedCount, coreDataLoaders.length)));

    checkDevPanel();
    initContactLinks();
    checkAbandonedSession();
    renderGamification();
    checkBadges();
    restoreSession();
    checkAdminStatus();
    renderAccountUI();
    checkAndClaimReferralRewards();
    checkExamReminder();

    applyThemeChrome(localStorage.getItem("khuta_theme") === "dark");
    if(localStorage.getItem("khuta_theme") === "dark"){
        document.body.classList.add("dark-mode");
    }
    setAccent(localStorage.getItem("khuta_accent") || "");
    setFontSize(localStorage.getItem("khuta_fontsize") || "medium");
    if(localStorage.getItem("khuta_sidebar_collapsed") === null){
        // مستخدم جديد لم يختر بعد — الافتراضي على الكمبيوتر: مطوية (تظهر بالتمرير أو الضغط)
        if(window.innerWidth >= 993) document.getElementById("app-container").classList.add("sidebar-collapsed");
    } else if(localStorage.getItem("khuta_sidebar_collapsed") === "1"){
        document.getElementById("app-container").classList.add("sidebar-collapsed");
    }

    function enterApp(){
        const session = getSession();
        const name = localStorage.getItem("khuta_name");
        if(!session && !name){
            document.getElementById("login-overlay").style.display = "flex";
        } else {
            document.getElementById("login-overlay").style.display = "none";
            updateWelcomeText();
            loadProfileForm();
            finishLoginBoot();
        }
    }

    // ننتظر اكتمال كل التحميلات الأساسية فعلياً قبل إخفاء شاشة التحميل — لكن
    // بحد أقصى فعلي (وليس Promise.all بلا سقف): fetch() بلا AbortController
    // قد يعلق إلى الأبد إن لم يستجب الخادم إطلاقاً (لا يرفض حتى بعد فشله)،
    // فبدون هذا السباق الزمني يبقى الطالب خلف شاشة تحميل قد تُخفى بصرياً
    // بمؤقّت الأمان المستقل في index.html لكن دون أن يدخل التطبيق فعلياً أبداً
    // (منطق enterApp/الترحيب معلَّق خلف Promise.all نفسها) — تحقّقنا من هذا
    // فعلياً بمحاكاة انقطاع شبكة كامل قبل اعتماد هذا الإصلاح.
    const CORE_DATA_TIMEOUT_MS = 8000;
    const coreDataTimeout = new Promise(resolve => setTimeout(resolve, CORE_DATA_TIMEOUT_MS));
    Promise.race([Promise.all(coreDataLoaders), coreDataTimeout]).then(() => {
        hideLoadingScreen().then(() => showIntroIfFirstVisit(enterApp));
    });
};

// يخفي شاشة التحميل بعد ضمان مدة عرض دنيا بسيطة (كي لا تومض بسرعة مزعجة
// على اتصال سريع جداً)، ويلغي مؤقّت الأمان المستقل لأننا لسنا بحاجته الآن.
// يُرجع Promise يكتمل بعد انتهاء انتقال الإخفاء البصري فعلياً — يستخدمه
// window.onload لمعرفة متى يظهر ترحيب أول زيارة (إن وُجد) بدل تراكب الشاشتين
function hideLoadingScreen(){
    clearTimeout(window.__loadingScreenSafetyTimer);
    clearInterval(loadingCaptionTimer);
    const el = document.getElementById("app-loading-screen");
    if(!el) return Promise.resolve();
    const MIN_DISPLAY_MS = 900;
    const elapsed = Date.now() - (window.__loadingScreenShownAt || 0);
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
    const FADE_MS = 500; // مطابق لمدة transition في CSS (#app-loading-screen)
    return new Promise(resolve => {
        setTimeout(() => {
            el.classList.add("hidden");
            setTimeout(resolve, FADE_MS);
        }, remaining);
    });
}

/* ============================================================
   ترحيب أول زيارة — يظهر مرة واحدة فقط لكل متصفح (localStorage flag)،
   بعد اختفاء شاشة التحميل مباشرة وقبل شاشة الدخول. أقصى مدة 10 ثوانٍ ثم
   ينتقل تلقائياً، أو تخطٍّ فوري بالضغط على الزر — لا يحبس الطالب أبداً
   ============================================================ */
const INTRO_SEEN_KEY = "khuta_intro_seen";
const INTRO_MAX_SECONDS = 10;
let introFinishFn = null;

function dismissIntro(){
    if(introFinishFn) introFinishFn();
}

function showIntroIfFirstVisit(onDone){
    if(localStorage.getItem(INTRO_SEEN_KEY)){ onDone(); return; }
    localStorage.setItem(INTRO_SEEN_KEY, "1"); // يُعلَّم كمُشاهَد فوراً — لن يظهر مجدداً حتى لو أُغلقت الصفحة أثناءه
    const overlay = document.getElementById("intro-overlay");
    if(!overlay){ onDone(); return; }

    const lines = currentLang === "ar" ? [
        "رفيقك الذكي في رحلة اختبار القدرات 🎯",
        "📅 جدول مذاكرة يبنيه لك النظام تلقائياً حسب مصادرك ووقتك",
        "🧮 حاسبة موزونة دقيقة لأكثر من 30 جامعة سعودية",
        "🤝 تذاكر مع مجتمع طلاب مثلك، ومساعد ذكاء اصطناعي يشرح لك خطوة بخطوة",
    ] : [
        "Your smart companion for the GAT journey 🎯",
        "📅 A study schedule the system builds for you automatically",
        "🧮 An accurate weighted-score calculator for 30+ Saudi universities",
        "🤝 Study alongside a community of students, with an AI that explains step by step",
    ];
    lines.forEach((text, i) => {
        const el = document.getElementById("intro-line-" + i);
        if(el) el.textContent = text;
    });

    overlay.style.display = "flex";
    let seconds = INTRO_MAX_SECONDS;
    const countEl = document.getElementById("intro-skip-count");
    const tick = setInterval(() => {
        seconds--;
        if(countEl) countEl.textContent = String(Math.max(seconds, 0));
        if(seconds <= 0) finish();
    }, 1000);

    let finished = false;
    function finish(){
        if(finished) return;
        finished = true;
        clearInterval(tick);
        introFinishFn = null;
        overlay.classList.add("hidden");
        setTimeout(() => { overlay.style.display = "none"; onDone(); }, 450);
    }
    introFinishFn = finish;
}

function updateWelcomeText(){
    const name = localStorage.getItem("khuta_name");
    if(name){
        const greeting = t("welcome", {name});
        document.getElementById("welcome-text").textContent = greeting;
        const focusName = document.getElementById("focus-header-name");
        if(focusName) focusName.textContent = greeting;
    }
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
        "khuta_completed_dates", "khuta_missed_days_count", "khuta_postponed_dates", "khuta_redday_tracking_start",
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
    // khuta_total_minutes, khuta_daily_minutes_log, khuta_daily_xp_log، بيانات الملف الشخصي، تفضيلات اللغة/الثيم
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

/* ============================================================
   المعالج التدريجي لتخصيص الخطة — تنقّل بالخطوات بأنيميشن، مع دعم
   القفز المباشر لخطوة معيّنة (مثال: اختصار "خططي وروتيني" في اللوحة)
   ============================================================ */
const WIZ_STEPS = ["welcome","plans","verbal","found","train","extra","pace","routine","breaks","confirm"];
let wizCurrentIndex = 0;

function openSetupOverlay(jumpToKey){
    document.getElementById("setup-overlay").style.display = "flex";
    restoreSetupForm();
    const targetIndex = jumpToKey ? Math.max(0, WIZ_STEPS.indexOf(jumpToKey)) : 0;
    goToWizStep(targetIndex);
}

function closeSetupOverlayIfAllowed(){
    // لا نسمح بإغلاق المعالج قبل بناء أول خطة على الإطلاق (لا يوجد جدول
    // بعد لعرضه) — لكن نسمح به بحرية عند التعديل على خطة موجودة أصلاً
    if(!localStorage.getItem("khuta_plan_days")){
        showToast(currentLang==='ar' ? "أكمل الخطوات لإنشاء خطتك أولاً 🙂" : "Finish the steps to create your plan first 🙂");
        goToWizStep(WIZ_STEPS.length - 1);
        return;
    }
    document.getElementById("setup-overlay").style.display = "none";
}

function goToWizStep(indexOrKey){
    const index = typeof indexOrKey === "number" ? indexOrKey : WIZ_STEPS.indexOf(indexOrKey);
    if(index < 0 || index >= WIZ_STEPS.length) return;
    wizCurrentIndex = index;
    const key = WIZ_STEPS[index];

    document.querySelectorAll(".wiz-step").forEach(el => el.classList.toggle("active", el.dataset.key === key));
    document.getElementById("wiz-viewport").scrollTop = 0;

    // خطوتا الخطط/الروتين تعرضان بيانات حيّة من التخزين المحلي — نُحدّثهما
    // فور الدخول إليهما (بدل الاعتماد على تهيئة واحدة عند فتح نافذة منفصلة
    // كما كان سابقاً في النافذة القديمة المستقلة)
    if(key === "plans" && typeof renderSavedPlansList === "function") renderSavedPlansList();
    if(key === "routine" && typeof renderRoutineEditor === "function"){
        renderRoutineEditor();
        renderExcludedDates();
        updateRoutinePressure();
    }
    if(key === "pace") renderPacePreview(); // لا تأثير إن كانت الصندوق مطويّة أصلاً (انظر الحارس داخل الدالة)

    renderWizProgress();
}

function renderWizProgress(){
    const total = WIZ_STEPS.length;
    const pct = Math.round((wizCurrentIndex / (total - 1)) * 100);
    const fill = document.getElementById("wiz-progress-fill");
    if(fill) fill.style.width = pct + "%";

    const dotsBox = document.getElementById("wiz-dots");
    if(dotsBox){
        dotsBox.innerHTML = WIZ_STEPS.map((k, i) => {
            const cls = i === wizCurrentIndex ? "current" : (i < wizCurrentIndex ? "done" : "");
            return `<button type="button" class="wiz-dot ${cls}" onclick="goToWizStep(${i})" aria-label="step ${i+1}"></button>`;
        }).join("");
    }

    const counter = document.getElementById("wiz-step-counter");
    if(counter) counter.textContent = currentLang === "ar"
        ? `الخطوة ${wizCurrentIndex + 1} من ${total}`
        : `Step ${wizCurrentIndex + 1} of ${total}`;

    const prevBtn = document.getElementById("wiz-prev-btn");
    const skipBtn = document.getElementById("wiz-skip-btn");
    const nextBtn = document.getElementById("wiz-next-btn");
    const isFirst = wizCurrentIndex === 0;
    const isLast = wizCurrentIndex === total - 1;
    if(prevBtn) prevBtn.classList.toggle("wiz-hidden", isFirst);
    if(skipBtn) skipBtn.classList.toggle("wiz-hidden", isLast);
    if(nextBtn) nextBtn.style.display = isLast ? "none" : "";
}

function wizNext(){ if(wizCurrentIndex < WIZ_STEPS.length - 1) goToWizStep(wizCurrentIndex + 1); }
function wizPrev(){ if(wizCurrentIndex > 0) goToWizStep(wizCurrentIndex - 1); }
function wizSkip(){ wizNext(); }

// الزر الأخير في المعالج: يبني الجدول عبر finalizeSetup() الأصلية دون أي
// تعديل على منطقها، ثم — إن كتب الطالب اسماً — يحفظ لقطة الخطة بهذا الاسم
// بالضبط بنفس آلية "خططي المحفوظة" الحالية (إعادة استخدام كاملة، لا تكرار).
function finalizeSetupFromWizard(){
    const planName = (document.getElementById("wiz-final-plan-name").value || "").trim();
    // نتحقق قبل finalizeSetup() لأنها ستكتب قيماً جديدة فوق أي خطة سابقة —
    // وجود خطة مسبقة هنا يعني هذا تعديل لخطة قائمة لا إنشاءً أول لمرة
    const isReEdit = !!localStorage.getItem("khuta_plan_start");
    finalizeSetup();
    if(isReEdit) logBehaviorEvent("plan_edit");
    if(planName && typeof saveCurrentPlanAs === "function"){
        const nameInput = document.getElementById("plan-name-input");
        if(nameInput){
            nameInput.value = planName;
            saveCurrentPlanAs();
        }
    }
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
    document.getElementById("skip_verbal_entirely").checked = !!config.skipVerbal;
    toggleSkipVerbalUI();
    document.getElementById("rest-day-select").value = (config.restDay === null || config.restDay === undefined) ? "" : String(config.restDay);
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
    renderPacePreview();
}

/* ============================================================
   معاينة إيقاع الخطة — يحسب فعلياً (لا تقريباً عشوائياً) كم يوماً سيحتاجه
   الطالب لإنهاء كل مصادره المختارة بمعدل الساعات اليومية التي اختارها،
   بإعادة استخدام نفس بيانات content.json التي يعتمدها buildScheduleTable
   نفسه — حتى لا يتضارب رقمان مختلفان لنفس الحساب في مكانين من الموقع.
   مخفية افتراضياً، تظهر فقط عند ضغط الطالب "إظهار التفاصيل" صراحة.
   ============================================================ */
function estimateTotalPlanMinutes(){
    const content = getContent();
    let totalMinutes = 0;
    const breakdown = [];
    function add(labelAr, labelEn, units, minutesPerUnit, approx){
        if(!units || !minutesPerUnit) return;
        const minutes = Math.round(units * minutesPerUnit);
        totalMinutes += minutes;
        breakdown.push({ labelAr, labelEn, minutes, approx: !!approx });
    }

    const skipVerbalEl = document.getElementById("skip_verbal_entirely");
    if(!(skipVerbalEl && skipVerbalEl.checked)){
        add("اللفظي (إيهاب)","Verbal (Ehab)", content.ehab.totalSections, content.ehab.minutesPerSection);
    }
    const foundRadio = document.querySelector('input[name="quant_found"]:checked');
    const found = foundRadio ? foundRadio.value : null;
    if(found === "moasser"){
        const f = content.moasserFoundation;
        // ملاحظة: لا يوفّر content.json وقتاً بالدقيقة لكل صفحة (المصدر
        // مبني على "صفحات/يوم" لا "دقائق")، فنقدّرها بمعدل معقول (5 د/صفحة)
        // — نُعلم الطالب بوضوح أن هذا الرقم تحديداً تقريبي في الواجهة
        add("تأسيس كمي (المعاصر)","Quant foundation (Al-Moaasir)", f.days * f.pagesPerDay, 5, true);
    }
    if(found === "einstein"){
        const e = content.einstein;
        const reviewOnlyEl = document.getElementById("einstein_review_only");
        const totalVideos = (reviewOnlyEl && reviewOnlyEl.checked) ? e.reviewVideos : e.totalVideos;
        add("تأسيس كمي (أينشتاين)","Quant foundation (Einstein)", totalVideos, e.minutesPerVideo);
    }
    if(document.getElementById("train_monsif")?.checked){
        add("تدريب (المنصف)","Training (Al-Monsif)", content.monsif.totalBanks, content.monsif.minutesPerBank);
    }
    if(document.getElementById("train_mufakkir_sec")?.checked){
        add("تدريب أقسام (المفكر)","Training sections (Al-Mufakkir)", content.mufakkirSections.total, content.mufakkirSections.minutesPerSection);
    }
    if(document.getElementById("train_mufakkir_rep")?.checked){
        add("متكرر (المفكر)","Repeated (Al-Mufakkir)", content.mufakkirRepeated.total / 10, content.mufakkirRepeated.minutesPer10Questions);
    }
    if(document.getElementById("train_moasser")?.checked){
        add("تدريب (المعاصر)","Training (Al-Moaasir)", content.moasserTraining.totalBanks, content.moasserTraining.minutesPerBank);
    }
    return { totalMinutes, breakdown };
}

function togglePacePreview(){
    const box = document.getElementById("pace-preview-box");
    const btn = document.getElementById("pace-preview-toggle-btn");
    const isOpen = box.classList.toggle("open");
    btn.innerHTML = isOpen
        ? `<i class="fa-solid fa-chevron-up"></i> ${labT("إخفاء التفاصيل","Hide details")}`
        : `<i class="fa-solid fa-chevron-down"></i> ${labT("إظهار التفاصيل","Show details")}`;
    if(isOpen) renderPacePreview();
}

function renderPacePreview(){
    const box = document.getElementById("pace-preview-box");
    if(!box || !box.classList.contains("open")) return; // لا داعي للحساب إن كانت مطويّة أصلاً

    const hours = parseInt(document.getElementById("plan-hours").value) || 0;
    const minutes = parseInt(document.getElementById("plan-minutes").value) || 0;
    const dailyMinutes = hours * 60 + minutes;
    const availableDays = parseInt(document.getElementById("plan-days").value) || 0;

    if(dailyMinutes <= 0){
        box.innerHTML = `<p class="pace-preview-note">${labT("حدّد وقتك اليومي أولاً لنعرض لك التقدير","Set your daily time first to see the estimate")}</p>`;
        return;
    }

    const { totalMinutes, breakdown } = estimateTotalPlanMinutes();
    if(totalMinutes === 0){
        box.innerHTML = `<p class="pace-preview-note">${labT("اختر مصدراً واحداً على الأقل من الخطوات السابقة لنعرض لك التقدير","Pick at least one source from earlier steps to see the estimate")}</p>`;
        return;
    }

    const neededDays = Math.max(1, Math.ceil(totalMinutes / dailyMinutes));
    const buffer = availableDays - neededDays;
    const hasApprox = breakdown.some(b => b.approx);

    let bufferHtml;
    if(availableDays <= 0){
        bufferHtml = "";
    } else if(buffer >= 0){
        bufferHtml = `<div class="pace-preview-stat good"><b>${buffer}</b><span>${labT("يوم احتياطي للظروف","buffer day(s) for emergencies")}</span></div>`;
    } else {
        bufferHtml = `<div class="pace-preview-stat warn"><b>${Math.abs(buffer)}-</b><span>${labT("يوم — وقتك اليومي الحالي غير كافٍ لإنهاء كل شيء بالمدة المختارة","day(s) short — your current daily time won't finish everything in the chosen duration")}</span></div>`;
    }

    box.innerHTML = `
        <div class="pace-preview-stats">
            <div class="pace-preview-stat"><b>${neededDays}</b><span>${labT("يوماً لإنهاء كل مصادرك بهذا المعدل","day(s) to finish everything at this pace")}</span></div>
            <div class="pace-preview-stat"><b>${breakdown.length}</b><span>${labT("مساراً دراسياً ستنجزه كاملاً","study track(s) you'll fully complete")}</span></div>
            ${bufferHtml}
        </div>
        <div class="pace-preview-breakdown">
            ${breakdown.map(b => `<div class="pace-preview-row"><span>${labT(b.labelAr, b.labelEn)}${b.approx ? " *" : ""}</span><b>${Math.round(b.minutes/60*10)/10} ${labT("ساعة","hr")}</b></div>`).join("")}
        </div>
        ${hasApprox ? `<p class="pace-preview-note">* ${labT("تقدير تقريبي (لا يوفّر المصدر وقتاً دقيقاً بالدقيقة)","approximate estimate (source doesn't provide exact per-minute timing)")}</p>` : ""}
    `;
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
    pushNotification(title, title, message, message, "fa-hourglass-half");
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
    renderPacePreview();
}

function toggleSkipVerbalUI(){
    const skip = document.getElementById("skip_verbal_entirely").checked;
    document.getElementById("verbal-section-fields").style.display = skip ? "none" : "block";
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
    const skipVerbal = document.getElementById("skip_verbal_entirely").checked;
    const restDayVal = document.getElementById("rest-day-select").value;
    const customVerbal = readCustomSourceForm("cv");
    const customQuant = readCustomSourceForm("cq");
    const config = {
        found,
        einsteinReviewOnly,
        skipVerbal,
        restDay: restDayVal === "" ? null : parseInt(restDayVal),
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
    setTimeout(startOnboardingTour, 700);
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
    if(tabId === "profile"){ renderProfileStats(); renderMistakeBank(); renderPrivacyCard(); }
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
    // فئة انتقالية مؤقتة: أثناءها تبقى القائمة داخل تدفّق الشبكة (وليست عائمة
    // مثبَّتة) كي يُحرَّك عرضها بسلاسة من/إلى الصفر، وبعد انتهاء الحركة تعود
    // قواعد "العائمة عند الطي" للعمل كالمعتاد. لا نلمس grid-template-columns
    // بأي انتقال إطلاقاً (درس الحوادث السابقة الموثَّقة).
    container.classList.add("sidebar-animating");
    clearTimeout(window.__khutaSidebarAnimT);
    window.__khutaSidebarAnimT = setTimeout(() => container.classList.remove("sidebar-animating"), 460);
    const collapsed = container.classList.toggle("sidebar-collapsed");
    localStorage.setItem("khuta_sidebar_collapsed", collapsed ? "1" : "0");
}

function applyThemeChrome(isDark){
    // لون شريط حالة المتصفح (theme-color) + خلفية عنصر html نفسه — كانا
    // ثابتين على الذهبي/الأبيض فيظهران كحواف فاتحة غريبة حول الصفحة على الهاتف
    const meta = document.getElementById("meta-theme-color");
    if(meta) meta.setAttribute("content", isDark ? "#0A0920" : "#F2EDE3");
    document.documentElement.style.background = isDark ? "#0A0920" : "#F2EDE3";
}

function toggleTheme(){
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    localStorage.setItem("khuta_theme", isDark ? "dark" : "light");
    applyThemeChrome(isDark);
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
        // — باستثناء إن كان ذلك اليوم بالذات هو يوم راحته الأسبوعي المُختار
        let config = {};
        try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
        const lastDateWasRestDay = lastDate && config.restDay !== null && config.restDay !== undefined && new Date(lastDate).getDay() === config.restDay;
        // يوم أُجِّل عمداً بزر "تأجيل اليوم" يُحتسب فائتاً فوراً عند الضغط
        // (ليس عند بداية الغد) — نستثنيه هنا كي لا يُحتسب مرتين
        const lastDateWasPostponed = lastDate && getPostponedDates().includes(lastDate);
        if(lastDate && localStorage.getItem("khuta_plan_start") && !getCompletedDates().includes(lastDate) && !lastDateWasRestDay && !lastDateWasPostponed){
            localStorage.setItem("khuta_missed_days_count", getMissedDaysCount() + 1);
            logBehaviorEvent("missed_day", { date: lastDate });
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

    if(isTodayRestDay()){
        const restMsg = currentLang==='ar'
            ? "اليوم يوم راحتك الأسبوعي 🌙 — استمتع بيومك، وسيستأنف جدولك غداً تلقائياً"
            : "Today is your weekly rest day 🌙 — enjoy it, your schedule resumes automatically tomorrow";
        tbody.innerHTML = `<tr><td colspan="5"><div class="empty-note"><i class="fa-solid fa-mug-hot" style="font-size:26px; margin-bottom:8px; display:block; color:var(--gold);"></i>${restMsg}</div></td></tr>`;
        const mobileListEl = document.getElementById("schedule-body-mobile");
        if(mobileListEl) mobileListEl.innerHTML = `<div class="empty-note"><i class="fa-solid fa-mug-hot" style="font-size:22px; margin-bottom:6px; display:block; color:var(--gold);"></i>${restMsg}</div>`;
        return;
    }

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
    // + إن اختار الطالب يوم راحة أسبوعياً، تُستبعد أيامه من حساب "أيام المذاكرة الفعلية"
    // منذ البداية (وليس فقط عند تفويتها) — فتزداد كمية اليوم الفعلي تناسبياً تلقائياً
    const effectiveDays = Math.max(1, days - getMissedDaysCount() - getRestDaysInPlanCount(config.restDay, days));
    function dailyQty(total){ return Math.max(1, Math.ceil((total / effectiveDays) * todayScale)); }

    const tasks = [];
    const content = getContent();
    if(!config.skipVerbal){
        const ehabTotal = content.ehab.totalSections;
        const ehabDaily = dailyQty(ehabTotal);
        tasks.push({ id:"verbal", icon:"fa-comments",
            title: currentLang === "ar" ? "اللفظي (إيهاب)" : "Verbal (Ehab)",
            qty: currentLang === "ar" ? `دراسة وحل ${ehabDaily} ${ehabDaily===1?"قسم":"أقسام"} كاملة يومياً (من أصل ${ehabTotal})` : `Study & solve ${ehabDaily} full section(s) daily (of ${ehabTotal})` });
    }

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
                <div class="icon-action ${getTaskNotes()[task.id] ? 'has-note' : ''}" onclick="editTaskNote('${task.id}')" title="${currentLang==='ar'?'ملاحظة سريعة':'Quick note'}"><i class="fa-solid fa-note-sticky"></i></div>
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
                <div class="icon-action ${getTaskNotes()[task.id] ? 'has-note' : ''}" onclick="editTaskNote('${task.id}')" title="ملاحظة"><i class="fa-solid fa-note-sticky"></i></div>
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
    playCompletionSound();
    hapticSuccess();
    // سجل XP اليومي — لعرض "+X اليوم" بصدق في بطاقة اللوحة، بنفس أسلوب سجل الدقائق اليومي
    const today = new Date().toDateString();
    let xpLog = {};
    try{ xpLog = JSON.parse(localStorage.getItem("khuta_daily_xp_log")) || {}; }catch(e){}
    xpLog[today] = (xpLog[today] || 0) + amount;
    localStorage.setItem("khuta_daily_xp_log", JSON.stringify(xpLog));
    renderGamification();
    checkBadges();
}
function getTodayXP(){
    let xpLog = {};
    try{ xpLog = JSON.parse(localStorage.getItem("khuta_daily_xp_log")) || {}; }catch(e){}
    return xpLog[new Date().toDateString()] || 0;
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
        // إن كان الفرق يومين بالضبط، وكان اليوم الذي بينهما هو يوم راحته الأسبوعي
        // المُختار، فلا تنكسر السلسلة — يوم الراحة لا يُحسب فجوة إطلاقاً
        let restDayConfig = null;
        try{ const c = JSON.parse(localStorage.getItem("khuta_config")) || {}; restDayConfig = (c.restDay === null || c.restDay === undefined) ? null : c.restDay; }catch(e){}
        const skippedDayWasRest = diffDays === 2 && restDayConfig !== null && (() => {
            const between = new Date(last); between.setDate(between.getDate() + 1);
            return between.getDay() === restDayConfig;
        })();
        if(diffDays === 1 || skippedDayWasRest){
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
    if(streak > 0 && streak % 7 === 0){
        pushNotification(
            "🔥 سلسلة رائعة!", "🔥 Great streak!",
            `حافظت على مذاكرتك ${streak} يوماً متتالياً — استمر!`, `You've kept a ${streak}-day streak — keep going!`,
            "fa-fire"
        );
    }
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
    const newlyEarned = [];
    BADGES.forEach(b => {
        if(!earned.includes(b.id) && b.cond()){
            earned.push(b.id);
            changed = true;
            newlyEarned.push(b);
        }
    });
    if(changed) localStorage.setItem("khuta_badges", JSON.stringify(earned));
    newlyEarned.forEach((b, i) => {
        setTimeout(() => celebrateBadgeUnlock(b), i * 1600);
        pushNotification(
            "🏅 وسام جديد!", "🏅 New badge!",
            `فتحت وسام "${currentLang==='ar'?b.ar:b.en}"`, `You unlocked the "${b.en}" badge`,
            "fa-award"
        );
    });
    renderBadges();
}

function celebrateBadgeUnlock(badge){
    triggerConfetti();
    const overlay = document.createElement("div");
    overlay.className = "badge-celebrate-overlay";
    overlay.onclick = () => overlay.remove();
    overlay.innerHTML = `
        <div class="badge-celebrate-card">
            <div class="badge-celebrate-burst"></div>
            <div class="badge-celebrate-icon"><i class="fa-solid ${badge.icon}"></i></div>
            <b>${currentLang==='ar' ? "🏅 وسام جديد!" : "🏅 New badge!"}</b>
            <span>${currentLang==='ar' ? badge.ar : badge.en}</span>
        </div>`;
    document.body.appendChild(overlay);
    setTimeout(() => { if(overlay.isConnected) overlay.remove(); }, 3800);
}

/* عدّاد أرقام متحرّك بسيط — يجعل تغيّر XP/السلسلة إحساساً حياً بدل قفزة فجائية */
function animateNumberTo(el, newValue, suffix){
    suffix = suffix || "";
    if(!el) return;
    const current = parseInt(el.textContent);
    if(isNaN(current) || current === newValue){ el.textContent = newValue + suffix; return; }
    const duration = 500, start = performance.now(), from = current;
    function step(now){
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        const value = Math.round(from + (newValue - from) * eased);
        el.textContent = value + suffix;
        if(progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function renderGamification(){
    const xp = getXP();
    const lvl = currentLevel(xp);
    const streak = parseInt(localStorage.getItem("khuta_streak")) || 0;
    const xpEl = document.getElementById("xp-widget-value");
    const lvlEl = document.getElementById("xp-widget-level");
    const streakEl = document.getElementById("streak-widget-value");
    if(xpEl) animateNumberTo(xpEl, xp, " XP");
    if(lvlEl) lvlEl.textContent = currentLang === "ar" ? lvl.ar : lvl.en;
    if(streakEl) animateNumberTo(streakEl, streak);
    const focusXpEl = document.getElementById("focus-header-xp");
    const focusStreakEl = document.getElementById("focus-header-streak");
    if(focusXpEl) focusXpEl.textContent = xp + " XP";
    if(focusStreakEl) focusStreakEl.textContent = streak;
    const levelBadge = document.getElementById("header-mini-level-badge");
    if(levelBadge){
        const icon = xp >= 1000 ? "fa-crown" : xp >= 600 ? "fa-medal" : xp >= 300 ? "fa-bolt" : "fa-star";
        levelBadge.innerHTML = `<i class="fa-solid ${icon}"></i>`;
        levelBadge.title = currentLang === "ar" ? lvl.ar : lvl.en;
    }
    renderShieldUI();
    renderDashboardOverview();
}

/* ============================================================
   37) لوحة التحكم — قسم "نظرة عامة" — بطاقة XP، إحصائيات سريعة،
   خريطة النشاط الحرارية، لمحة المهام، ولوحة الصدارة المصغّرة.
   كل رقم هنا مأخوذ من بيانات حقيقية موجودة أصلاً في التطبيق —
   لا أرقام وهمية أو تجميلية.
   ============================================================ */
function renderDashboardOverview(){
    if(!document.getElementById("ov-xp-total")) return; // القسم غير موجود بعد في DOM (تحميل مبكر جداً)

    const xp = getXP();
    const lvl = currentLevel(xp);
    const todayXP = getTodayXP();

    document.getElementById("ov-xp-total").textContent = xp;
    const todayBadge = document.getElementById("ov-xp-today-badge");
    if(todayXP > 0){
        todayBadge.style.display = "";
        document.getElementById("ov-xp-today").textContent = todayXP;
    } else {
        todayBadge.style.display = "none";
    }

    const lvlIdx = XP_LEVELS.indexOf(lvl);
    const nextLvl = XP_LEVELS[lvlIdx + 1];
    document.getElementById("ov-xp-level-name").textContent = currentLang==='ar' ? lvl.ar : lvl.en;
    if(nextLvl){
        const range = nextLvl.min - lvl.min;
        const progress = range ? Math.min(100, Math.round(((xp - lvl.min) / range) * 100)) : 100;
        document.getElementById("ov-xp-progress-fill").style.width = progress + "%";
        document.getElementById("ov-xp-next-label").textContent = currentLang==='ar'
            ? `التالي: ${nextLvl.min - xp} XP` : `Next: ${nextLvl.min - xp} XP`;
    } else {
        document.getElementById("ov-xp-progress-fill").style.width = "100%";
        document.getElementById("ov-xp-next-label").textContent = currentLang==='ar' ? "أعلى مستوى! 🏆" : "Max level! 🏆";
    }

    document.getElementById("ov-stat-streak").textContent = parseInt(localStorage.getItem("khuta_streak")) || 0;
    const totalMin = parseInt(localStorage.getItem("khuta_total_minutes")) || 0;
    document.getElementById("ov-stat-hours").textContent = Math.round(totalMin / 60);
    const statTasksEl = document.getElementById("stat-tasks");
    document.getElementById("ov-stat-tasks").textContent = statTasksEl ? statTasksEl.textContent : "0%";

    renderActivityHeatmap();
    renderQuestsGlance();
    renderMiniLeaderboard();
}

function renderActivityHeatmap(){
    const grid = document.getElementById("ov-heatmap-grid");
    const scroll = document.getElementById("ov-heatmap-grid") ? document.querySelector(".ov-heatmap-scroll") : null;
    if(!grid) return;
    let dailyLog = {};
    try{ dailyLog = JSON.parse(localStorage.getItem("khuta_daily_minutes_log")) || {}; }catch(e){}

    const daysToShow = 112; // 16 أسبوعاً كاملة
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - (daysToShow - 1));
    const startDow = startDate.getDay();

    const cells = [];
    for(let i = 0; i < startDow; i++){
        cells.push(`<div class="ov-heat-cell" style="visibility:hidden;"></div>`);
    }
    for(let i = 0; i < daysToShow; i++){
        const d = new Date(startDate); d.setDate(d.getDate() + i);
        const mins = dailyLog[d.toDateString()] || 0;
        let level = 0;
        if(mins > 0) level = 1;
        if(mins >= 30) level = 2;
        if(mins >= 60) level = 3;
        if(mins >= 120) level = 4;
        const dateLabel = d.toLocaleDateString(currentLang==='ar' ? 'ar-SA' : 'en-US', {month:'short', day:'numeric'});
        const minLabel = currentLang==='ar' ? `${mins} دقيقة` : `${mins} min`;
        cells.push(`<div class="ov-heat-cell" data-level="${level}" title="${dateLabel} — ${minLabel}"></div>`);
    }
    grid.innerHTML = cells.join("");
    if(scroll) scroll.scrollLeft = scroll.scrollWidth; // إظهار اليوم الحالي فوراً بدل بداية السجل القديمة

    const streak = parseInt(localStorage.getItem("khuta_streak")) || 0;
    const noteEl = document.getElementById("ov-heatmap-streak-note");
    if(noteEl) noteEl.textContent = streak > 0 ? (currentLang==='ar' ? `🔥 سلسلة ${streak} يوم` : `🔥 ${streak}-day streak`) : "";
}

/* لمحة سريعة عن مهام اليوم — تُقرأ مباشرة من جدول اليوم الحقيقي (نفس الصفوف
   المعروضة في "جدول مهامك")، وليست قائمة موازية مصطنعة بمكافآت وهمية */
function renderQuestsGlance(){
    const box = document.getElementById("ov-quests-list");
    if(!box) return;
    const rows = document.querySelectorAll("#schedule-body tr[data-task-id]");
    const statuses = getTaskStatuses();
    if(!rows.length){
        box.innerHTML = `<div class="empty-note" style="padding:10px 0;">${currentLang==='ar'?'لا توجد مهام اليوم بعد':'No tasks yet today'}</div>`;
        return;
    }
    box.innerHTML = Array.from(rows).map(row => {
        const id = row.dataset.taskId;
        const status = statuses[id] || "notstarted";
        const titleInput = row.querySelector(".task-path-cell .task-input");
        const title = titleInput ? titleInput.value : id;
        return `<div class="ov-quest-row ${status==='done'?'done':status==='inprogress'?'inprogress':''}">
            <div class="ov-quest-check"><i class="fa-solid fa-check"></i></div>
            <div class="ov-quest-title">${escapeHtml(title)}</div>
        </div>`;
    }).join("");
}

/* أعلى 3 في لوحة الصدارة الحقيقية (Supabase) — نفس مصدر بيانات صفحة
   المجتمع الكاملة، فقط عرض مختصر هنا */
async function renderMiniLeaderboard(){
    const box = document.getElementById("ov-leaderboard-mini");
    if(!box) return;
    if(!sb){ box.innerHTML = `<div class="empty-note" style="padding:6px 0;">${currentLang==='ar'?'غير متاح حالياً':'Unavailable right now'}</div>`; return; }
    const { data, error } = await sb.from("leaderboard").select("display_name, xp").order("xp", { ascending:false }).limit(3);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note" style="padding:6px 0;">${currentLang==='ar'?'كن أول من ينضم!':'Be the first to join!'}</div>`;
        return;
    }
    box.innerHTML = data.map((row, i) => `
        <div class="ov-lb-mini-row">
            <span class="ov-lb-mini-rank ${i<3?'top':''}">#${i+1}</span>
            <span class="ov-lb-mini-name">${escapeHtml(row.display_name)}</span>
            <span class="ov-lb-mini-xp">${row.xp} XP</span>
        </div>`).join("");
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
    renderDashboardOverview();

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
    let restDayConfig = null;
    try{ const c = JSON.parse(localStorage.getItem("khuta_config")) || {}; restDayConfig = (c.restDay === null || c.restDay === undefined) ? null : c.restDay; }catch(e){}
    const maxShow = 60; // لتفادي رسم مئات النقاط في الخطط الطويلة جداً
    const step = totalDays > maxShow ? Math.ceil(totalDays / maxShow) : 1;
    for(let d = 1; d <= totalDays; d += step){
        const node = document.createElement("div");
        let missed = false;
        if(d < currentDay && planStart){
            const dayDate = new Date(planStart);
            dayDate.setDate(planStart.getDate() + (d - 1));
            const isRestDay = restDayConfig !== null && dayDate.getDay() === restDayConfig;
            if(dayDate >= trackingStart && !isRestDay){
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
    const labelText = (currentLang==='ar' ? "استراحة 5د" : "5-min break") + ` (${left})`;
    el.textContent = labelText;
    const disabled = left <= 0 || inAutoBreak || shortBreakActive || Date.now() < shortBreakCooldownUntil;
    document.getElementById("btn-short-break").disabled = disabled;
    // مزامنة زر الاستراحة داخل وضع التركيز الكامل بنفس الحالة تماماً
    const focusLabel = document.getElementById("focus-short-break-label");
    const focusBtn = document.getElementById("focus-short-break-btn");
    if(focusLabel) focusLabel.textContent = labelText;
    if(focusBtn) focusBtn.disabled = disabled;
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

    // نختار نصيحة جديدة عشوائياً مرة واحدة لكل جلسة (لا تتغير مع كل فتح/إغلاق لوضع التركيز
    // خلال نفس الجلسة، بل فقط عند بدء جلسة جديدة فعلياً)
    currentFocusQuote = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
    openFocusMode(); // افتراضياً، بدء أي جلسة يفتح وضع التركيز الكامل مباشرة

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

    // مزامنة وضع التركيز الكامل بنفس القيم بالضبط — مصدر واحد للحقيقة
    if(document.getElementById("focus-mode-overlay").style.display !== "none"){
        document.getElementById("focus-timer-display").textContent = String(minutesLeft).padStart(2, "0");
        document.getElementById("focus-timer-sublabel").textContent = sectionLabel(currentSection);
        const focusRing = document.getElementById("focus-timer-ring-fg");
        focusRing.style.strokeDasharray = TIMER_CIRC;
        focusRing.style.strokeDashoffset = TIMER_CIRC * (1 - progress);
        document.getElementById("focus-xp-value").textContent = getXP() + " XP";

        // مزامنة الحبة والزر — نفس حالة زر لوحة التحكم بالضبط، دون أي منطق مستقل
        const pauseBtn = document.getElementById("pause-btn");
        const sessionActive = !pauseBtn.disabled;
        const pill = document.getElementById("focus-session-pill");
        const pillText = document.getElementById("focus-session-pill-text");
        const startPauseBtn = document.getElementById("focus-start-pause-btn");
        const startPauseLabel = document.getElementById("focus-start-pause-label");
        startPauseBtn.style.display = "";
        pill.classList.toggle("active", sessionActive);
        if(sessionActive){
            const isPaused = pauseBtn.innerHTML.includes("fa-play");
            pillText.textContent = isPaused ? t("focus.paused") : t("focus.inSession");
            startPauseLabel.textContent = isPaused ? t("timer.resume") : t("timer.pause");
            startPauseBtn.querySelector("i").className = isPaused ? "fa-solid fa-play" : "fa-solid fa-pause";
        } else {
            pillText.textContent = t("focus.idle");
            startPauseLabel.textContent = t("focus.start");
            startPauseBtn.querySelector("i").className = "fa-solid fa-play";
        }
        const skipTransitionBtn = document.getElementById("btn-skip-transition");
        document.getElementById("focus-skip-btn").style.display = (skipTransitionBtn && skipTransitionBtn.style.display !== "none") ? "" : "none";
    }
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

    // مزامنة استراحة الـ5 دقائق مع وضع التركيز الكامل أيضاً — نفس أسلوب مزامنة
    // الجلسة الرئيسية بالضبط، وإلا يبقى عداد وضع التركيز عالقاً على آخر رقم للجلسة
    if(document.getElementById("focus-mode-overlay").style.display !== "none"){
        document.getElementById("focus-timer-display").textContent = String(minutesLeft).padStart(2, "0");
        const focusRing = document.getElementById("focus-timer-ring-fg");
        focusRing.style.strokeDasharray = TIMER_CIRC;
        focusRing.style.strokeDashoffset = TIMER_CIRC * (1 - progress);
        const pill = document.getElementById("focus-session-pill");
        const pillText = document.getElementById("focus-session-pill-text");
        if(pill && pillText){
            pill.classList.add("active");
            pillText.textContent = t("focus.onBreak");
        }
        document.getElementById("focus-start-pause-btn").style.display = "none";
    }
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
    const focusSublabel = document.getElementById("focus-timer-sublabel");
    if(focusSublabel) focusSublabel.textContent = t("timer.shortBreakLabel");
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
        logBehaviorEvent("timer_pause");
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
function getPostponedDates(){
    try{ return JSON.parse(localStorage.getItem("khuta_postponed_dates")) || []; }catch(e){ return []; }
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

/* ============================================================
   تنبيه تأجيل حقيقي — بدل تأجيل فوري بلا تفكير، نحسب فعلياً (بنفس منطق
   effectiveDays المعتمد في buildScheduleTable) كم دقيقة إضافية سيحتاجها
   كل يوم متبقٍ لو أُجِّل اليوم، ونعرضها قبل التأكيد لا بعده.
   ============================================================ */
function estimatePostponeImpact(){
    const days = parseInt(localStorage.getItem("khuta_plan_days")) || 45;
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    const sessionMinutes = parseInt(localStorage.getItem("khuta_session_minutes")) || 90;
    const restDaysCount = getRestDaysInPlanCount(config.restDay, days);
    const currentEffectiveDays = Math.max(1, days - getMissedDaysCount() - restDaysCount);
    const newEffectiveDays = Math.max(1, currentEffectiveDays - 1);
    const extraMinutes = Math.round(sessionMinutes * (currentEffectiveDays / newEffectiveDays - 1));
    return { extraMinutes, currentEffectiveDays, newEffectiveDays };
}

function postponeToday(){
    if(!localStorage.getItem("khuta_plan_start")){
        showToast(labT("لا توجد خطة نشطة بعد لتأجيلها","No active plan to postpone yet"));
        return;
    }
    const todayStr = new Date().toDateString();
    if(getPostponedDates().includes(todayStr) || getCompletedDates().includes(todayStr)){
        showToast(labT("اليوم مُسجَّل بالفعل","Today is already recorded"));
        return;
    }

    const impact = estimatePostponeImpact();
    const msg = impact.extraMinutes > 0
        ? labT(`إذا أجّلت هذه المهمة (تأجيل اليوم كاملاً)، فستصبح كل يوم متبقٍ زيادة بـ~${impact.extraMinutes} دقيقة تقريباً حتى تعوّض. هل ما زلت تريد التأجيل؟`,
               `If you postpone this (skip today entirely), each remaining day grows by ~${impact.extraMinutes} minutes to catch up. Still want to postpone?`)
        : labT("هل تريد تأجيل مهام اليوم كاملة لتوزيعها على الأيام المتبقية؟","Postpone today's tasks entirely to redistribute across remaining days?");
    if(!confirm(msg)) return;

    const postponed = getPostponedDates();
    postponed.push(todayStr);
    localStorage.setItem("khuta_postponed_dates", JSON.stringify(postponed));
    localStorage.setItem("khuta_missed_days_count", getMissedDaysCount() + 1);
    logBehaviorEvent("postpone_today", { extraMinutes: impact.extraMinutes });

    buildScheduleTable();
    renderProgress();
    showToast(labT("📅 تم تأجيل اليوم — وُزِّع محتواه تلقائياً على الأيام المتبقية","📅 Today postponed — its content was redistributed across your remaining days"));
}

/* ============================================================
   سجل الأحداث السلوكية — بنية مشتركة تغذّي كلاً من "اكتشاف الوهم" (كشف
   الخمول أثناء التركيز) و"بنك الأخطاء الشخصية" (اكتشاف أنماط تعطّل تقدّم
   الطالب: تأجيل متكرر، تعديل خطة متكرر، إيقاف مؤقّت متكرر...). محلي بالكامل
   (localStorage) عمداً — يعمل حتى للضيوف بلا حساب، متّسقاً مع فلسفة الموقع.
   ============================================================ */
const BEHAVIOR_LOG_KEY = "khuta_behavior_log";
const MAX_BEHAVIOR_EVENTS = 600; // كافٍ لاكتشاف أنماط على مدى أشهر بلا تضخّم لا نهائي

function logBehaviorEvent(type, meta){
    try{
        const log = JSON.parse(localStorage.getItem(BEHAVIOR_LOG_KEY) || "[]");
        log.push({ type, ts: new Date().toISOString(), meta: meta || {} });
        while(log.length > MAX_BEHAVIOR_EVENTS) log.shift();
        localStorage.setItem(BEHAVIOR_LOG_KEY, JSON.stringify(log));
    }catch(e){ console.error("[خُطى] تعذّر تسجيل حدث سلوكي:", e); }
}
function getBehaviorLog(){
    try{ return JSON.parse(localStorage.getItem(BEHAVIOR_LOG_KEY) || "[]"); }catch(e){ return []; }
}

/* ============================================================
   اكتشاف الوهم — تحقّق ودّي عند خمول حقيقي أثناء جلسة نشطة فقط (لا حركة
   فأرة/لمس/كتابة/تمرير)، وليس بفاصل زمني أعمى يقاطع تركيزاً حقيقياً. إن لم
   يستجب الطالب خلال مهلة قصيرة، نوقف عدّ الوقت تلقائياً بدل تركه "وهمياً"
   — الهدف تقليل الوقت الوهمي المحتسب، لا المراقبة أو المحاسبة.
   ============================================================ */
let lastActivityTs = Date.now();
let idleCheckInterval = null;
let lastIdleCheckinAt = 0;
let idleCheckinTimeoutId = null;
const IDLE_THRESHOLD_MS = 8 * 60 * 1000;         // 8 دقائق خمول حقيقي قبل السؤال
const IDLE_CHECKIN_COOLDOWN_MS = 15 * 60 * 1000; // لا تكرار للسؤال خلال 15 دقيقة من آخر واحد
const IDLE_RESPONSE_WINDOW_MS = 45 * 1000;       // مهلة الرد قبل اعتبارها "غير مؤكَّدة"

function markActivity(){ lastActivityTs = Date.now(); }
function initIdleDetection(){
    ["mousemove","keydown","touchstart","scroll","click"].forEach(evt => {
        document.addEventListener(evt, markActivity, { passive:true });
    });
    if(!idleCheckInterval) idleCheckInterval = setInterval(checkForIdle, 60 * 1000);
}
function checkForIdle(){
    if(document.hidden) return; // التبويب غير ظاهر أصلاً — ليست الحالة التي نحتاج نسأل عنها (Page Visibility تكفي هنا)
    if(typeof mainInterval === "undefined" || !mainInterval || sessionPaused) return; // لا جلسة نشطة الآن
    if(document.getElementById("idle-checkin-modal")) return; // سؤال ظاهر بالفعل
    if(Date.now() - lastIdleCheckinAt < IDLE_CHECKIN_COOLDOWN_MS) return;
    if(Date.now() - lastActivityTs < IDLE_THRESHOLD_MS) return;
    showIdleCheckin();
}
function showIdleCheckin(){
    lastIdleCheckinAt = Date.now();
    const modal = document.createElement("div");
    modal.id = "idle-checkin-modal";
    modal.className = "idle-checkin-modal";
    modal.innerHTML = `
        <div class="idle-checkin-card">
            <div class="idle-checkin-icon">👋</div>
            <b>${currentLang==='ar' ? 'لسه معانا؟' : 'Still with us?'}</b>
            <p>${currentLang==='ar' ? 'ما لاحظنا أي تفاعل لفترة — بس نتأكد إنك لسه تذاكر، مو نتجسس عليك 😄' : "We noticed no activity for a while — just checking you're still studying, not spying on you 😄"}</p>
            <button type="button" class="btn" onclick="confirmStillHere()">${currentLang==='ar'?'أيوه، أكمل 💪':"Yes, continuing 💪"}</button>
        </div>`;
    document.body.appendChild(modal);
    logBehaviorEvent("idle_checkin_shown");
    idleCheckinTimeoutId = setTimeout(() => {
        if(document.getElementById("idle-checkin-modal")) resolveIdleAsAway();
    }, IDLE_RESPONSE_WINDOW_MS);
}
function confirmStillHere(){
    clearTimeout(idleCheckinTimeoutId);
    document.getElementById("idle-checkin-modal")?.remove();
    markActivity();
    logBehaviorEvent("idle_confirmed");
}
function resolveIdleAsAway(){
    document.getElementById("idle-checkin-modal")?.remove();
    logBehaviorEvent("idle_ignored");
    // نوقف عدّ الوقت تلقائياً بدل تركه محتسباً بلا تأكيد فعلي من الطالب —
    // هذا صلب الميزة: تقليل الوقت الوهمي، لا مجرد تسجيله
    if(typeof mainInterval !== "undefined" && mainInterval && !sessionPaused){
        togglePauseSession();
        showToast(currentLang==='ar' ? "⏸️ أوقفنا العدّاد مؤقتاً — ارجع واضغط استمرار متى جاهز" : "⏸️ Paused the timer — resume whenever you're ready");
    }
}

/* ============================================================
   بنك الأخطاء الشخصية — يكتشف أنماطاً بقواعد صريحة وواضحة من سجل الأحداث
   السلوكية (لا ذكاء اصطناعي هنا، حساب وإحصاء فقط — أرخص وأدق وأسهل تفسيراً
   وأكثر موثوقية من ترك نموذج لغوي "يكتشف" الأنماط من بيانات خام)
   ============================================================ */
const MISTAKE_EVENT_LABELS = {
    missed_day:      { ar:"تفويت يوم كامل من الخطة", en:"missing a full plan day" },
    postpone_today:  { ar:"تأجيل اليوم عمداً", en:"deliberately postponing the day" },
    plan_edit:       { ar:"تعديل الخطة", en:"editing the plan" },
    timer_pause:     { ar:"إيقاف المؤقّت مؤقتاً", en:"pausing the timer" },
    idle_ignored:    { ar:"الانشغال عن المذاكرة أثناء الجلسة", en:"drifting away during a session" },
};
const MISTAKE_DAY_NAMES_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const MISTAKE_DAY_NAMES_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MISTAKE_TRACKED_TYPES = ["missed_day","postpone_today","plan_edit","timer_pause","idle_ignored"];

function computeMistakeBankInsights(){
    const relevant = getBehaviorLog().filter(e => MISTAKE_TRACKED_TYPES.includes(e.type));
    if(relevant.length === 0) return { ready:false };

    const firstTs = new Date(relevant[0].ts).getTime();
    const daysSinceFirst = (Date.now() - firstTs) / 86400000;
    // حد أدنى مقصود: لا نستنتج أنماطاً من بيانات قليلة جداً أو فترة قصيرة
    // جداً — استنتاج مبكر خاطئ أسوأ من عدم الاستنتاج إطلاقاً
    if(relevant.length < 6 || daysSinceFirst < 10) return { ready:false };

    const insights = [];
    const counts = {};
    relevant.forEach(e => { counts[e.type] = (counts[e.type]||0) + 1; });
    const topType = Object.keys(counts).sort((a,b) => counts[b]-counts[a])[0];
    const topCount = counts[topType];
    const label = MISTAKE_EVENT_LABELS[topType];
    const suggestions = {
        plan_edit:      { ar:"جرّب تلتزم بخطة واحدة أسبوعاً كاملاً قبل تعديلها.", en:"Try committing to one plan for a full week before adjusting it." },
        missed_day:     { ar:"خطوة صغيرة يومياً أفضل من يوم مثالي نادر — جرّب تقلّل حجم المهمة اليومية بدل تفويتها كاملة.", en:"A small daily step beats a rare perfect day — try shrinking the daily task instead of skipping it entirely." },
        postpone_today: { ar:"قبل الضغط على تأجيل، جرّب تذاكر 10 دقائق فقط أولاً — غالباً تكمل أكثر مما تتوقع.", en:"Before hitting postpone, try studying for just 10 minutes first — you'll often do more than expected." },
        idle_ignored:   { ar:"جرّب تفعّل وضع عدم الإزعاج على جوالك أثناء الجلسة القادمة.", en:"Try enabling Do Not Disturb on your phone during your next session." },
        timer_pause:    { ar:"جرّب تقسّم الجلسة لفترات أقصر مع استراحات مجدولة بدل إيقافها يدوياً.", en:"Try shorter sessions with scheduled breaks instead of pausing manually." },
    };
    insights.push({
        icon:"🔁",
        titleAr:`أكثر شيء يتكرر معك: ${label.ar}`, titleEn:`Your most frequent pattern: ${label.en}`,
        bodyAr:`حصل ${topCount} مرة خلال متابعتنا — أكثر من أي نمط آخر.`, bodyEn:`Happened ${topCount} times — more than any other pattern.`,
        suggestionAr:suggestions[topType].ar, suggestionEn:suggestions[topType].en,
    });

    const topEvents = relevant.filter(e => e.type === topType);
    if(topEvents.length >= 4){
        const dayCounts = new Array(7).fill(0);
        topEvents.forEach(e => { dayCounts[new Date(e.ts).getDay()]++; });
        const maxDay = dayCounts.indexOf(Math.max(...dayCounts));
        const maxDayShare = dayCounts[maxDay] / topEvents.length;
        if(maxDayShare >= 0.4){
            insights.push({
                icon:"📅",
                titleAr:`يوم ${MISTAKE_DAY_NAMES_AR[maxDay]} تحديداً`, titleEn:`Specifically on ${MISTAKE_DAY_NAMES_EN[maxDay]}`,
                bodyAr:`${Math.round(maxDayShare*100)}% من "${label.ar}" يحصل يوم ${MISTAKE_DAY_NAMES_AR[maxDay]} بالذات.`,
                bodyEn:`${Math.round(maxDayShare*100)}% of "${label.en}" happens specifically on ${MISTAKE_DAY_NAMES_EN[maxDay]}.`,
                suggestionAr:`جهّز خطة أخف عمداً ليوم ${MISTAKE_DAY_NAMES_AR[maxDay]} بدل محاولة نفس الحمل المعتاد.`,
                suggestionEn:`Plan a lighter load specifically for ${MISTAKE_DAY_NAMES_EN[maxDay]}.`,
            });
        }
    }

    const editEvents = relevant.filter(e => e.type === "plan_edit").sort((a,b) => new Date(a.ts)-new Date(b.ts));
    if(editEvents.length >= 3){
        const intervals = [];
        for(let i=1;i<editEvents.length;i++) intervals.push((new Date(editEvents[i].ts) - new Date(editEvents[i-1].ts)) / 86400000);
        const avgInterval = intervals.reduce((a,b)=>a+b,0) / intervals.length;
        if(avgInterval < 4){
            insights.push({
                icon:"🔄",
                titleAr:"تعديل الخطة بوتيرة سريعة", titleEn:"Editing your plan quickly",
                bodyAr:`تعدّل خطتك كل ${avgInterval.toFixed(1)} يوم تقريباً — أسرع من أن تعطي أي خطة فرصة حقيقية.`,
                bodyEn:`You edit your plan roughly every ${avgInterval.toFixed(1)} days.`,
                suggestionAr:"التزم بخطة واحدة أسبوعاً كاملاً على الأقل قبل أي تعديل، حتى لو شعرت أنها غير مثالية.",
                suggestionEn:"Commit to one plan for at least a week before adjusting, even if it feels imperfect.",
            });
        }
    }

    if(daysSinceFirst >= 14){
        const midpoint = firstTs + (Date.now() - firstTs) / 2;
        const firstHalf = relevant.filter(e => new Date(e.ts).getTime() < midpoint).length;
        const secondHalf = relevant.length - firstHalf;
        if(secondHalf > firstHalf * 1.6 && secondHalf >= 4){
            insights.push({
                icon:"📉",
                titleAr:"التزامك يقلّ مع الوقت", titleEn:"Your consistency drops over time",
                bodyAr:"عدد الأنماط المعطِّلة في النصف الثاني من متابعتنا أكبر بوضوح من النصف الأول.",
                bodyEn:"Disruptive patterns increased notably in the second half of our tracking window.",
                suggestionAr:"جرّب تقلّل حجم الخطة بعد الأسبوعين الأولين بدل الاستمرار بنفس الوتيرة الأولى المتحمّسة.",
                suggestionEn:"Consider tapering the plan's intensity after the first couple of weeks.",
            });
        }
    }

    return { ready:true, insights: insights.slice(0, 3) }; // أفضل 3 رؤى كحد أقصى — لا نُغرق الطالب بتقرير طويل
}

function renderMistakeBank(){
    const box = document.getElementById("mistake-bank-content");
    if(!box) return;
    const result = computeMistakeBankInsights();
    if(!result.ready){
        box.innerHTML = `<div class="mistake-bank-empty">🧠 ${currentLang==='ar'
            ? `لسه نجمع بيانات كافية لاكتشاف أنماطك — استمر أسبوعين على الأقل من الاستخدام المنتظم وارجع هنا.`
            : `Still gathering enough data to spot your patterns — keep using the app regularly for at least two weeks and check back.`}</div>`;
        return;
    }
    box.innerHTML = result.insights.map(ins => `
        <div class="mistake-insight">
            <span class="mistake-insight-icon">${ins.icon}</span>
            <div class="mistake-insight-body">
                <b>${currentLang==='ar' ? ins.titleAr : ins.titleEn}</b>
                <p>${currentLang==='ar' ? ins.bodyAr : ins.bodyEn}<span class="mistake-suggestion">💡 ${currentLang==='ar' ? ins.suggestionAr : ins.suggestionEn}</span></p>
            </div>
        </div>`).join("");
}


/* يحسب كم مرة سيقع يوم الراحة الأسبوعي المختار ضمن مدة الخطة كاملة، بدءاً من
   تاريخ بدء الخطة — يُستخدم لتوسيع كمية الأيام الفعلية للمذاكرة تلقائياً منذ
   البداية، لا فقط عند تفويت يوم راحة بالفعل */
function getRestDaysInPlanCount(restDay, totalDays){
    if(restDay === null || restDay === undefined || restDay === "") return 0;
    const startStr = localStorage.getItem("khuta_plan_start");
    if(!startStr) return 0;
    const start = new Date(startStr);
    let count = 0;
    for(let i = 0; i < totalDays; i++){
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        if(d.getDay() === restDay) count++;
    }
    return count;
}

/* هل اليوم الحالي هو يوم الراحة الأسبوعي المُفعَّل في خطة الطالب؟ */
function isTodayRestDay(){
    let config = {};
    try{ config = JSON.parse(localStorage.getItem("khuta_config")) || {}; }catch(e){}
    if(config.restDay === null || config.restDay === undefined) return false;
    return new Date().getDay() === config.restDay;
}

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
    currentFocusQuote = null;
    localStorage.removeItem("khuta_session_active");
    localStorage.removeItem("khuta_today_scale");
    setAllTodayTasksStatus("done");
    buildScheduleTable();
    updateStreak();
    recordSessionCompletion(Math.round(mainTotal / 60));
    // XP: +10 ثابتة لكل يوم يُكمَّل بالكامل (وليس لكل مهمة على حدة)، مرة واحدة فقط في اليوم
    const today = new Date().toDateString();
    if(localStorage.getItem("khuta_xp_awarded_today") !== today){
        awardXP(10);
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
    currentFocusQuote = null;
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
    // مزامنة وضع التركيز الكامل بنفس القيم — نفس المصدر الواحد للحقيقة
    if(document.getElementById("focus-mode-overlay").style.display !== "none"){
        document.getElementById("focus-timer-display").textContent = "00";
        document.getElementById("focus-timer-sublabel").textContent = t("timer.minutesLeft");
        document.getElementById("focus-timer-ring-fg").style.strokeDashoffset = TIMER_CIRC;
        document.getElementById("focus-start-pause-btn").style.display = "";
    }
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
            pushNotification(
                "⚠️ انقطعت جلستك",
                "⚠️ Your session was interrupted",
                "انقطعت جلستك السابقة (تحديث/إغلاق الصفحة) — ابدأ جلسة جديدة لإكمال يومك.",
                "Your previous session was interrupted (page refresh/close) — start a new session to complete today.",
                "fa-triangle-exclamation"
            );
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
    refreshDeepReportButton();
    applyEquippedFrame(); // إعادة التطبيق عند كل زيارة للصفحة — لم تكن تُستدعى إلا مرة واحدة عند التحميل الأول

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
    // ملاحظة: بطاقات "نظرة عامة" (overview-*) موجودة في قسم ثابت التخطيط أعلى
    // اللوحة (#dash-overview)، وليست جزءاً من كومة #dashboard-cards القابلة
    // لإعادة الترتيب بالأسهم — لذا reorderable:false لها تحديداً، حتى لا تُنتزع
    // من مكانها الأصلي عند "إعادة الضبط الافتراضي"
    //
    // تبسيط أول تجربة (بطلب مراجعة تقنية خارجية): بطاقات الخريطة الحرارية
    // ولوحة الصدارة ومسار التقدم غير مفيدة فعلياً في اليوم الأول (لا نشاط
    // بعد لعرضه) وتزيد كثافة الشاشة على طالب جديد أنهى للتو معالج إنشاء
    // الخطة — أصبحت مخفية افتراضياً وتُكتشف تدريجياً عبر "تخصيص لوحتك"
    // (الجولة التعريفية تذكرها صراحة). هذا لا يمسّ أي مستخدم خصّص لوحته من
    // قبل بأي شكل — انظر applyDashboardCardVisibility أدناه: نُفضّل دائماً
    // الاختيار المحفوظ فعلياً للمستخدم على القيمة الافتراضية.
    { id: "dash-card-overview-hero", labelAr: "نظرة سريعة (XP والإحصائيات)", labelEn: "Quick overview (XP & stats)", defaultVisible: true, reorderable: false },
    { id: "dash-card-overview-heatmap", labelAr: "خريطة النشاط اليومي", labelEn: "Daily activity heatmap", defaultVisible: false, reorderable: false },
    { id: "dash-card-overview-quests", labelAr: "لمحة مهام اليوم", labelEn: "Today's tasks glance", defaultVisible: true, reorderable: false },
    { id: "dash-card-overview-leaderboard", labelAr: "لوحة الصدارة المصغّرة", labelEn: "Mini leaderboard", defaultVisible: false, reorderable: false },
    { id: "dash-card-progress", labelAr: "مسار التقدم", labelEn: "Progress Path", defaultVisible: false, reorderable: false },
    { id: "dash-card-table", labelAr: "جدول المهام", labelEn: "Task Table", defaultVisible: true, reorderable: true },
    { id: "dash-card-timer", labelAr: "وضع التركيز (المؤقت)", labelEn: "Focus Mode (Timer)", defaultVisible: true, reorderable: true },
    { id: "dash-card-badges", labelAr: "الأوسمة والتروفيات", labelEn: "Badges & Trophies", defaultVisible: false, reorderable: true },
    { id: "dash-card-community", labelAr: "المجتمع", labelEn: "Community", defaultVisible: false, reorderable: true },
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
    DASHBOARD_CARDS.filter(c => c.reorderable).forEach(c => {
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

/* ============================================================
   30) تتبّع الأخطاء البرمجية الحقيقية — بدون أي بيانات شخصية، مع تحديد
   لعدد التسجيلات لكل جلسة حتى لا تُغرق الجدول عند تكرار نفس الخطأ.
   ============================================================ */
const loggedErrorMessages = new Set();
let errorLogCountThisSession = 0;
const MAX_ERROR_LOGS_PER_SESSION = 15;

function logClientError(message, stackSummary){
    if(!sb) return;
    // "Script error." رسالة أمان عامة يضعها المتصفح لأي خطأ من سكربت خارجي (CDN
    // مثلاً) بدون تفاصيل حقيقية — لا قيمة تشخيصية لها، تسجيلها مجرد إزعاج بصري
    if(String(message).trim() === "Script error." || String(message).trim() === "Script error") return;
    if(errorLogCountThisSession >= MAX_ERROR_LOGS_PER_SESSION) return;
    const key = String(message).slice(0, 150);
    if(loggedErrorMessages.has(key)) return; // نفس الخطأ لا يُسجَّل مرتين في نفس الجلسة
    loggedErrorMessages.add(key);
    errorLogCountThisSession++;
    sb.from("error_logs").insert({
        message: String(message).slice(0, 500),
        stack_summary: stackSummary ? String(stackSummary).slice(0, 800) : null,
        page_url: location.pathname,
        user_agent: navigator.userAgent.slice(0, 200),
    }).then(() => {}, () => {}); // فشل تسجيل الخطأ نفسه لا يجب أن يُنشئ خطأً آخر
}

window.addEventListener("error", (event) => {
    logClientError(event.message, event.error && event.error.stack);
});
window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    logClientError(
        reason && reason.message ? reason.message : String(reason),
        reason && reason.stack
    );
});

function applyFeatureFlags(){
    document.getElementById("nav-exam-simulator").style.display = FEATURE_EXAM_SIMULATOR ? "" : "none";
    document.getElementById("mobile-nav-exam-simulator").style.display = FEATURE_EXAM_SIMULATOR ? "" : "none";
    document.getElementById("nav-tutors").style.display = FEATURE_TUTORS_DIRECTORY ? "" : "none";
    document.getElementById("mobile-nav-tutors").style.display = FEATURE_TUTORS_DIRECTORY ? "" : "none";
}

/* ---------- محرّك الاختبارات المحاكية — يطابق منصة قياس الفعلية بنيوياً:
   5 أقسام بمؤقّت مستقل 24 دقيقة لكل قسم، تقدّم أحادي الاتجاه (لا رجوع لقسم
   أُنهي)، لوحة أسئلة تعرض القسم الحالي فقط، تعليمات + معادلات مرجعية. ---------- */
let examState = null;
let examTimerInterval = null;
const EXAM_SECTION_COUNT = 5;
const EXAM_SECTION_SECONDS = Math.round(120 * 60 / EXAM_SECTION_COUNT); // 1440 ثانية = 24 دقيقة تماماً كالاختبار الحقيقي

// توزيع مجموعتي كمي/لفظي على عدد أقسام معطى بالتساوي قدر الإمكان (الفروقات
// تذهب للأقسام الأولى) — معمَّمة عن منطق "full" الأصلي لتخدم أيضاً الاختبار
// المولَّد من ملفات الطالب بأي حجم بنك أسئلة
function splitIntoSections(quantPool, verbalPool, sectionCount){
    const qPerSection = Math.floor(quantPool.length / sectionCount);
    const vPerSection = Math.floor(verbalPool.length / sectionCount);
    let qRemainder = quantPool.length - qPerSection * sectionCount;
    let vRemainder = verbalPool.length - vPerSection * sectionCount;
    const sections = [];
    let qIdx = 0, vIdx = 0;
    for(let s = 0; s < sectionCount; s++){
        const qCount = qPerSection + (qRemainder > 0 ? 1 : 0); if(qRemainder > 0) qRemainder--;
        const vCount = vPerSection + (vRemainder > 0 ? 1 : 0); if(vRemainder > 0) vRemainder--;
        sections.push({ quant: quantPool.slice(qIdx, qIdx + qCount), verbal: verbalPool.slice(vIdx, vIdx + vCount) });
        qIdx += qCount; vIdx += vCount;
    }
    return sections;
}

// يبني examState الكامل من هيكل {sections:[{quant,verbal}...]} جاهز —
// نقطة دخول موحّدة يستخدمها كل من الاختبار القياسي والمولَّد من الملفات
function buildSectionedExamState(built, type, timed, fromFiles){
    const questions = [];
    built.sections.forEach((sec, sIdx) => {
        sec.quant.forEach(q => questions.push({ ...q, type:"quant", sectionIndex:sIdx }));
        sec.verbal.forEach(q => questions.push({ ...q, type:"verbal", sectionIndex:sIdx }));
    });
    const sectionCount = built.sections.length;
    return {
        type, timed, fromFiles: !!fromFiles,
        questions,
        sectionCount,
        currentSection: 0,
        finishedSections: new Set(),
        sectionSecondsTotal: timed ? EXAM_SECTION_SECONDS : 0,
        sectionRemainingSeconds: timed ? EXAM_SECTION_SECONDS : 0,
        currentIndex: 0,
        answers: {},
        marked: {},
        visited: {},
        multiSection: sectionCount > 1,
        scaledDown: !!built.scaledDown,
        fontStep: 0, // -1/0/+1 لأزرار A- A A+
    };
}

function startExamSimulation(){
    const type = document.querySelector('input[name="examsim_type"]:checked').value;
    const timed = document.querySelector('input[name="examsim_timed"]:checked').value === "timed" && type === "full";

    // على الهاتف: نُعلم الطالب أن تجربة الاختبار أفضل بكثير على الكمبيوتر
    // (شاشة أكبر، أقرب لواجهة قياس الفعلية) قبل البدء — مرة واحدة فقط لكل
    // جلسة متصفح كي لا يتكرر الإزعاج مع كل محاولة اختبار
    if(window.innerWidth <= 900 && !sessionStorage.getItem("khuta_mobile_exam_notice_shown")){
        sessionStorage.setItem("khuta_mobile_exam_notice_shown", "1");
        const proceed = confirm(currentLang==='ar'
            ? "💻 تجربة الاختبار المحاكي أفضل بكثير على الكمبيوتر (شاشة أكبر، أقرب لواجهة الاختبار الحقيقي).\n\nتقدر تكمل على الهاتف الآن إن أردت — هيّأنا لك عرضاً أوسع يناسبه.\n\nتبي تكمل على الهاتف؟"
            : "💻 The exam simulator works much better on a computer (bigger screen, closer to the real exam interface).\n\nYou can still continue on mobile now — we've widened the layout for it.\n\nContinue on mobile?");
        if(!proceed) return;
    }

    const built = buildExamQuestionSet(type);
    const questions = [];
    built.sections.forEach(sec => { questions.push(...sec.quant, ...sec.verbal); });
    if(questions.length === 0){
        showToast(currentLang==='ar' ? "لا توجد أسئلة متاحة بعد في هذا القسم" : "No questions available in this section yet");
        return;
    }

    examState = buildSectionedExamState(built, type, timed, false);

    if(built.scaledDown){
        showToast(currentLang==='ar'
            ? `⚠️ بنك الأسئلة الحالي صغير (تجريبي) — هذا اختبار مصغّر من ${examState.questions.length} سؤال بدل 120`
            : `⚠️ Current question bank is small (sample) — this is a scaled-down exam of ${examState.questions.length} questions instead of 120`);
    }

    openExamOverlay();
}

// نقطة دخول موحّدة لفتح واجهة الاختبار وبدء أول قسم — يستدعيها كل من
// startExamSimulation وstartCustomExam بعد تجهيز examState بالكامل
function openExamOverlay(){
    document.getElementById("exam-mode-overlay").style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("exam-user-name").textContent =
        localStorage.getItem("khuta_name") || (currentLang==='ar' ? "ضيف" : "Guest");
    setExamFontSize(examState.fontStep || 0);
    beginCurrentSection(true);
}

function beginCurrentSection(isFirst){
    examState.currentIndex = examState.questions.findIndex(q => q.sectionIndex === examState.currentSection);
    if(examState.currentIndex === -1) examState.currentIndex = 0;
    document.getElementById("exam-timer-block").style.display = examState.timed ? "block" : "none";
    if(examState.timed){
        if(!isFirst) examState.sectionRemainingSeconds = examState.sectionSecondsTotal;
        startExamSectionTimer();
    }
    renderExamQuestion();
    renderExamPalette();
    renderExamStats();
}

function startExamSectionTimer(){
    clearInterval(examTimerInterval);
    examTimerInterval = setInterval(() => {
        examState.sectionRemainingSeconds--;
        if(examState.sectionRemainingSeconds <= 0){
            clearInterval(examTimerInterval);
            examState.sectionRemainingSeconds = 0;
            updateExamTimerDisplay();
            showToast(currentLang==='ar' ? "⏰ انتهى وقت هذا القسم" : "⏰ This section's time is up");
            finishCurrentSection(true);
            return;
        }
        updateExamTimerDisplay();
    }, 1000);
    updateExamTimerDisplay();
}

function updateExamTimerDisplay(){
    const m = Math.floor(examState.sectionRemainingSeconds / 60);
    const s = examState.sectionRemainingSeconds % 60;
    document.getElementById("exam-timer-display").textContent = `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
    document.getElementById("exam-timer-block").classList.toggle("low-time", examState.sectionRemainingSeconds < 180);
}

// إنهاء القسم الحالي: تأكيد (إلا إن كان تلقائياً بسبب انتهاء الوقت)، ثم
// قفل القسم نهائياً (لا عودة إليه) والانتقال للتالي، أو تسليم الاختبار
// كاملاً إن كان هذا آخر قسم — تماماً كقاعدة "لن يستطيع الإجابة على أي
// أسئلة بعد انتهاء الزمن المحدد" في تعليمات الاختبار الحقيقي
function confirmFinishSection(){ finishCurrentSection(false); }
function finishCurrentSection(auto){
    if(!examState) return;
    const isLast = examState.currentSection >= examState.sectionCount - 1;
    if(!auto){
        const msg = isLast
            ? (currentLang==='ar' ? "هذا آخر قسم — إنهاؤه سيُسلّم الاختبار كاملاً للتصحيح. متأكد؟" : "This is the last section — finishing it submits the whole exam. Are you sure?")
            : (currentLang==='ar' ? "بعد إنهاء هذا القسم لن تقدر ترجع له إطلاقاً. متأكد؟" : "Once you finish this section you can't return to it. Are you sure?");
        if(!confirm(msg)) return;
    }
    clearInterval(examTimerInterval);
    examState.finishedSections.add(examState.currentSection);
    if(isLast){
        submitExam();
        return;
    }
    examState.currentSection++;
    beginCurrentSection(false);
    showToast(currentLang==='ar' ? `📍 بدأ القسم ${examState.currentSection + 1} من ${examState.sectionCount}` : `📍 Section ${examState.currentSection + 1} of ${examState.sectionCount} started`);
}

function goToExamQuestion(index){
    if(!examState) return;
    if(index < 0 || index >= examState.questions.length) return;
    const q = examState.questions[index];
    if(q.sectionIndex !== examState.currentSection) return; // لا تنقّل خارج القسم المُقفل الحالي
    examState.currentIndex = index;
    renderExamQuestion();
    renderExamPalette();
}

function renderExamQuestion(){
    const q = examState.questions[examState.currentIndex];
    examState.visited[q.id] = true;
    const localTotal = examState.questions.filter(x => x.sectionIndex === examState.currentSection).length;
    const localIndex = examState.questions.filter(x => x.sectionIndex === examState.currentSection).indexOf(q) + 1;

    document.getElementById("exam-question-number").textContent = currentLang==='ar'
        ? `رقم السؤال ${localIndex}` : `Question No. ${localIndex}`;
    document.getElementById("exam-section-label").textContent = currentLang==='ar'
        ? `القسم الحالي: ${examState.currentSection + 1} / ${examState.sectionCount}`
        : `Current section: ${examState.currentSection + 1} / ${examState.sectionCount}`;
    document.getElementById("exam-total-label").textContent = currentLang==='ar'
        ? `مجموع الأسئلة: ${examState.questions.length}` : `Total questions: ${examState.questions.length}`;
    document.getElementById("exam-question-text").textContent = q.text;

    const selected = examState.answers[q.id];
    const letters = ["أ","ب","ج","د"];
    document.getElementById("exam-choices").innerHTML = q.choices.map((choice, i) => `
        <div class="exam-choice ${selected===i?'selected':''}" onclick="selectExamAnswer(${i})">
            <span>${escapeHtml(choice)}</span>
            <span class="choice-letter">${letters[i]}</span>
        </div>`).join("");

    const markbox = document.getElementById("exam-mark-checkbox");
    if(markbox) markbox.checked = !!examState.marked[q.id];

    const saveBtn = document.getElementById("exam-save-next-btn");
    if(saveBtn){
        const isLastInSection = localIndex >= localTotal;
        saveBtn.innerHTML = isLastInSection
            ? (currentLang==='ar' ? "حفظ" : "Save")
            : (currentLang==='ar' ? "حفظ والتالي" : "Save & Next");
    }

    if(examState.reviewMode) renderExamReviewChoices();
    renderExamStats();
}

function selectExamAnswer(choiceIndex){
    if(examState.reviewMode) return;
    const q = examState.questions[examState.currentIndex];
    examState.answers[q.id] = choiceIndex;
    renderExamQuestion();
    renderExamPalette();
}

// "حفظ والتالي": يحفظ (الإجابة محفوظة فعلاً فور الاختيار) وينتقل للسؤال
// التالي داخل نفس القسم؛ في آخر سؤال بالقسم يبقى مكانه (يستخدم "إنهاء
// القسم" صراحة للتقدّم، مطابقةً لسلوك المنصة الحقيقية)
function examSaveAndNext(){
    const sectionQs = examState.questions.filter(q => q.sectionIndex === examState.currentSection);
    const localIdx = sectionQs.findIndex(q => q.id === examState.questions[examState.currentIndex].id);
    if(localIdx < sectionQs.length - 1){
        const nextGlobalIndex = examState.questions.indexOf(sectionQs[localIdx + 1]);
        goToExamQuestion(nextGlobalIndex);
    } else {
        showToast(currentLang==='ar' ? "آخر سؤال في القسم — اضغط «إنهاء القسم» للمتابعة" : "Last question in this section — press \"Finish Section\" to continue");
    }
}

function toggleMarkCurrentQuestion(){
    const q = examState.questions[examState.currentIndex];
    const checked = document.getElementById("exam-mark-checkbox").checked;
    if(checked) examState.marked[q.id] = true; else delete examState.marked[q.id];
    renderExamPalette();
}

// لوحة الأسئلة: تعرض أسئلة القسم الحالي فقط (بترقيم محلي 1..ن) مطابقةً
// تماماً لمنصة قياس أثناء المحاولة الحية — أما أثناء المراجعة بعد التسليم
// فتُعرض كل الأسئلة عبر كل الأقسام بحرية تنقّل كاملة وتلوين صحيح/خاطئ
function renderExamPalette(){
    const grid = document.getElementById("exam-palette-grid");
    if(!grid || !examState) return;

    if(examState.reviewMode){
        grid.innerHTML = examState.questions.map((q, globalIndex) => {
            const isCorrect = examState.answers[q.id] === q.correct;
            const isCurrent = globalIndex === examState.currentIndex;
            const cls = ["exam-palette-item", isCorrect ? "answered" : "incorrect-flag"];
            if(isCurrent) cls.push("current");
            return `<div class="${cls.join(' ')}" onclick="goToReviewQuestion(${globalIndex})">${globalIndex+1}</div>`;
        }).join("");
        return;
    }

    const sectionQs = examState.questions.filter(q => q.sectionIndex === examState.currentSection);
    grid.innerHTML = sectionQs.map((q, i) => {
        const globalIndex = examState.questions.indexOf(q);
        const answered = examState.answers[q.id] !== undefined;
        const isCurrent = globalIndex === examState.currentIndex;
        const marked = !!examState.marked[q.id];
        const cls = ["exam-palette-item"];
        if(marked) cls.push("marked");
        else if(answered) cls.push("answered");
        if(isCurrent) cls.push("current");
        return `<div class="${cls.join(' ')}" onclick="goToExamQuestion(${globalIndex})">${i+1}</div>`;
    }).join("");
}

// شبكة الإحصاءات الأربعة أعلى لوحة الأسئلة — العمود الأول عدّاد خاص بالقسم
// الحالي (كم بقي منه بلا إجابة)، والثلاثة الباقية إحصاء عالمي عبر كل
// الاختبار (مجاب / تمت زيارته بلا إجابة / لم تُزَر بعد) وتجمع دوماً لمجموع
// الأسئلة الكلي — يطابق أرقام لقطة الشاشة الحقيقية بنيوياً
function renderExamStats(){
    const box = document.getElementById("exam-stats-grid");
    if(!box || !examState) return;
    const sectionQs = examState.questions.filter(q => q.sectionIndex === examState.currentSection);
    const answeredInSection = sectionQs.filter(q => examState.answers[q.id] !== undefined).length;
    const remainingInSection = sectionQs.length - answeredInSection;

    let answeredGlobal = 0, visitedNotAnsweredGlobal = 0, notVisitedGlobal = 0;
    examState.questions.forEach(q => {
        if(examState.answers[q.id] !== undefined) answeredGlobal++;
        else if(examState.visited[q.id]) visitedNotAnsweredGlobal++;
        else notVisitedGlobal++;
    });

    const L = (ar, en) => currentLang==='ar' ? ar : en;
    box.innerHTML = `
        <div class="exam-stat-box orange"><b>${remainingInSection}</b><span>${L('باقي من القسم','left in section')}</span></div>
        <div class="exam-stat-box teal"><b>${answeredGlobal}</b><span>${L('تمت الاجابة','answered')}</span></div>
        <div class="exam-stat-box blue"><b>${visitedNotAnsweredGlobal}</b><span>${L('تمت زيارته','visited')}</span></div>
        <div class="exam-stat-box neutral"><b>${notVisitedGlobal}</b><span>${L('لم تتم زيارته','not visited')}</span></div>`;
}

function setExamFontSize(delta){
    if(!examState) return;
    if(delta === 0) examState.fontStep = 0;
    else examState.fontStep = Math.max(-1, Math.min(1, (examState.fontStep || 0) + delta));
    const area = document.getElementById("exam-question-area");
    if(area) area.className = "exam-question-area" + (examState.fontStep ? " font-" + (examState.fontStep > 0 ? "lg" : "sm") : "");
}

/* ---------- نافذتا التعليمات والمعادلات ---------- */
const EXAM_INSTRUCTIONS_TEXT = {
    exam: [
        "الغش أو الشروع فيه أو محاولة ذلك، أو الإخلال بسير الاختبارات، يعرّضك لاتخاذ الإجراء النظامي.",
        "يُمنع اصطحاب الهاتف المحمول أثناء الاختبار لأي غرض، وإخراجه يعرّضك لاتخاذ الإجراء النظامي.",
        "على الطالب إنهاء القسم الواحد خلال الوقت المحدد (24 دقيقة) ولن يستطيع الإجابة على أي أسئلة بعد انتهاء الزمن المحدد.",
        "نظام الاختبارات يحسب للطالب الدرجة الأعلى في محاولاته.",
        "لا يُسمح باستخدام جهاز الحاسب الآلي للغش بأي شكل من الأشكال في الاختبار.",
        "جميع قواعد الاختبارات التقليدية تنطبق على الاختبارات الإلكترونية.",
    ],
    section: [
        "هذا القسم يحتوي على مزيج من الأسئلة الكمية واللفظية بترتيب عشوائي.",
        "بمجرد الضغط على «إنهاء القسم» أو انتهاء وقته، لن تستطيع العودة إليه أو تعديل إجاباتك فيه إطلاقاً.",
        "يمكنك التنقل بحرية بين أسئلة هذا القسم فقط عبر لوحة الأسئلة الجانبية طوال مدته.",
        "استخدم «تمييز السؤال للمراجعة» لوضع علامة على أي سؤال تريد العودة إليه قبل إنهاء القسم — لن يظهر هذا الخيار بعد إنهائه.",
    ],
};
function openExamInstructionsModal(kind){
    const title = document.getElementById("exam-instructions-title");
    const body = document.getElementById("exam-instructions-body");
    title.textContent = kind === "section"
        ? (currentLang==='ar' ? "تعليمات القسم" : "Section Instructions")
        : (currentLang==='ar' ? "تعليمات الاختبار" : "Exam Instructions");
    const items = EXAM_INSTRUCTIONS_TEXT[kind] || EXAM_INSTRUCTIONS_TEXT.exam;
    body.innerHTML = "<ol>" + items.map(t => `<li>${escapeHtml(t)}</li>`).join("") + "</ol>";
    document.getElementById("exam-instructions-modal").style.display = "flex";
}
function closeExamInfoModal(id){ document.getElementById(id).style.display = "none"; }

const EXAM_FORMULAS = [
    { title:"المثلث القائم", body:"جا = مقابل ÷ وتر · جتا = مجاور ÷ وتر · ظا = مقابل ÷ مجاور" },
    { title:"مجموع زوايا المثلث", body:"مجموع زوايا المثلث = ١٨٠°" },
    { title:"مساحة المثلث", body:"المساحة = ½ × القاعدة × الارتفاع" },
    { title:"مساحة الدائرة ومحيطها", body:"المساحة = ط × نق² · المحيط = ٢ × ط × نق (ط ≈ ٣.١٤)" },
    { title:"المستطيل", body:"المساحة = الطول × العرض · المحيط = ٢ × (الطول + العرض)" },
    { title:"مثلث قائم الزاوية (فيثاغورس)", body:"(الوتر)² = (الضلع الأول)² + (الضلع الثاني)²" },
    { title:"حجم المكعب", body:"الحجم = الطول × العرض × الارتفاع" },
    { title:"حجم الأسطوانة", body:"الحجم = ط × نق² × الارتفاع" },
    { title:"المتوازي الأضلاع", body:"المساحة = القاعدة × الارتفاع · مجموع زوايا أي شكل رباعي = ٣٦٠°" },
    { title:"شبه المنحرف", body:"المساحة = ½ × (القاعدة الصغرى + القاعدة الكبرى) × الارتفاع" },
    { title:"تشابه المضلعات", body:"نسبة تشابه المساحتين = (نسبة تشابه الضلعين)²" },
    { title:"تشابه المجسمات", body:"نسبة تشابه الحجمين = (نسبة تشابه الضلعين)³" },
    { title:"مقياس الرسم في الخرائط", body:"مثال ١ : ١٠٠٠٠ يعني أن كل وحدة على الخريطة تمثّل ١٠٠٠٠ وحدة من نفس النوع على الطبيعة" },
];
function openExamFormulasModal(){
    const grid = document.getElementById("exam-formulas-grid");
    grid.innerHTML = EXAM_FORMULAS.map(f => `
        <div class="exam-formula-box"><b>${escapeHtml(f.title)}</b><span>${escapeHtml(f.body)}</span></div>`).join("");
    document.getElementById("exam-formulas-modal").style.display = "flex";
}

function confirmExitExam(){
    if(!confirm(currentLang==='ar' ? "الخروج الآن سيُفقد كل إجاباتك في هذه المحاولة. متأكد؟" : "Exiting now will lose all your answers in this attempt. Are you sure?")) return;
    clearInterval(examTimerInterval);
    document.getElementById("exam-mode-overlay").style.display = "none";
    document.body.style.overflow = "";
    examState = null;
}

// إبقاء هذه الدالة لأزرار قديمة محتملة تستدعيها؛ في الواجهة الجديدة
// "إنهاء القسم" في آخر قسم هو ما يُسلّم الاختبار فعلياً (انظر finishCurrentSection)
function confirmSubmitExam(){ confirmFinishSection(); }

function submitExam(){
    clearInterval(examTimerInterval);
    let correctCount = 0, quantCorrect = 0, quantTotal = 0, verbalCorrect = 0, verbalTotal = 0;
    examState.questions.forEach(q => {
        const isCorrect = examState.answers[q.id] === q.correct;
        if(isCorrect) correctCount++;
        if(q.type === "quant"){ quantTotal++; if(isCorrect) quantCorrect++; }
        else { verbalTotal++; if(isCorrect) verbalCorrect++; }
    });
    const total = examState.questions.length;
    const pct = total ? Math.round((correctCount / total) * 100) : 0;

    examState.finished = true;
    examState.score = { correctCount, total, pct, quantCorrect, quantTotal, verbalCorrect, verbalTotal };

    document.getElementById("exam-mode-overlay").style.display = "none";
    const box = document.getElementById("exam-results-content");
    box.innerHTML = `
        <div style="font-size:52px; font-weight:800; color:var(--gold); font-family:var(--font-mono); margin:10px 0;">${pct}%</div>
        <p class="card-sub" style="margin-bottom:18px;">${correctCount} / ${total} ${currentLang==='ar'?'إجابة صحيحة':'correct answers'}</p>
        <div style="display:flex; gap:12px;">
            ${quantTotal>0 ? `<div style="flex:1; background:var(--bg-alt); border-radius:12px; padding:14px;"><b style="font-size:18px; color:var(--teal);">${quantCorrect}/${quantTotal}</b><div class="card-sub" style="font-size:11.5px;">${currentLang==='ar'?'كمي':'Quant'}</div></div>` : ""}
            ${verbalTotal>0 ? `<div style="flex:1; background:var(--bg-alt); border-radius:12px; padding:14px;"><b style="font-size:18px; color:var(--gold);">${verbalCorrect}/${verbalTotal}</b><div class="card-sub" style="font-size:11.5px;">${currentLang==='ar'?'لفظي':'Verbal'}</div></div>` : ""}
        </div>`;
    document.getElementById("exam-results-overlay").style.display = "flex";
    document.body.style.overflow = "hidden";

    const xpEarned = Math.round(pct / 5); // مكافأة بسيطة تحفيزية، لا تُبالغ في القيمة
    awardXP(xpEarned);
    recordExamAttempt(examState); // سجل الاختبارات السابقة: الدرجة + الأسئلة الخاطئة

    // بريد النتيجة: فقط للاختبار الكامل (لا لفظي/كمي منفرد)، وفقط لو كان
    // هناك حساب فعلي — الخادم نفسه يتحقق أن البريد المرتبط حقيقي فعلاً،
    // هذا مجرد تفادٍ لاستدعاء شبكي عديم الفائدة لضيف بلا حساب أصلاً
    if(examState.type === "full" && sb) sendExamScoreEmail(examState.score);
}

function closeExamResults(){
    document.getElementById("exam-results-overlay").style.display = "none";
    document.body.style.overflow = "";
}

function reviewExamAnswers(){
    document.getElementById("exam-results-overlay").style.display = "none";
    document.getElementById("exam-mode-overlay").style.display = "flex";
    document.body.style.overflow = "hidden";
    document.getElementById("exam-timer-block").style.display = "none";
    examState.reviewMode = true;
    examState.currentSection = 0;
    // في وضع المراجعة تُفتح كل الأقسام للتصفح الحر (لا قفل بعد التسليم)
    examState.finishedSections = new Set();
    goToReviewQuestion(0);
}
// أثناء المراجعة نتجاوز قفل "نفس القسم فقط" في goToExamQuestion العادية
function goToReviewQuestion(index){
    if(!examState || index < 0 || index >= examState.questions.length) return;
    examState.currentSection = examState.questions[index].sectionIndex;
    examState.currentIndex = index;
    renderExamQuestion();
    renderExamPalette();
}

function renderExamReviewChoices(){
    const q = examState.questions[examState.currentIndex];
    const selected = examState.answers[q.id];
    document.querySelectorAll("#exam-choices .exam-choice").forEach((el, i) => {
        el.classList.remove("selected");
        el.onclick = null;
        if(i === q.correct) el.classList.add("correct");
        else if(i === selected) el.classList.add("incorrect");
    });
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

function getTaskNotes(){
    try{ return JSON.parse(localStorage.getItem("khuta_task_notes")) || {}; }catch(e){ return {}; }
}
function editTaskNote(id){
    const notes = getTaskNotes();
    const current = notes[id] || "";
    const updated = prompt(currentLang==='ar' ? "ملاحظتك السريعة على هذه المهمة (تُمسح بترك الحقل فارغاً):" : "Your quick note for this task (leave empty to clear):", current);
    if(updated === null) return; // إلغاء
    if(updated.trim() === ""){ delete notes[id]; } else { notes[id] = updated.trim(); }
    localStorage.setItem("khuta_task_notes", JSON.stringify(notes));
    buildScheduleTable();
    debouncedSync();
}

/* شرح مبسّط بالعربية لأكثر أنماط الأخطاء البرمجية شيوعاً — ليست ترجمة حرفية،
   بل توضيح لما يعنيه الخطأ عملياً وهل يستحق قلقاً حقيقياً أم لا */
function explainErrorInArabic(message){
    const m = String(message).toLowerCase();
    if(m.includes("is not defined")) return "دالة أو متغيّر غير معرَّف في الكود — خطأ برمجي حقيقي يحتاج مراجعة.";
    if(m.includes("cannot read propert") && (m.includes("null") || m.includes("undefined"))) return "الكود حاول قراءة قيمة من عنصر غير موجود (عادة عنصر HTML لم يُحمَّل بعد أو أُزيل).";
    if(m.includes("is not a function")) return "الكود حاول استدعاء شيء ليس دالة فعلياً — خطأ برمجي يحتاج مراجعة.";
    if(m.includes("failed to fetch") || m.includes("networkerror")) return "مشكلة اتصال بالإنترنت أو بالخادم — غالباً مؤقتة وتخص جهاز الطالب نفسه، ليست بالضرورة خللاً في الموقع.";
    if(m.includes("quotaexceeded")) return "مساحة التخزين المحلي في متصفح الطالب ممتلئة — نادر ولا علاقة له بالموقع.";
    if(m.includes("unexpected token") || m.includes("syntaxerror")) return "خطأ في صياغة الكود نفسه — يحتاج مراجعة عاجلة، نادراً ما يحدث من كود مكتمل الاختبار.";
    if(m.includes("not authorized") || m.includes("permission")) return "محاولة وصول لبيانات بدون صلاحية كافية — تحقّق من إعدادات RLS في Supabase.";
    return "خطأ غير مصنَّف — راجع التفاصيل الكاملة أدناه، أو أرسلها لي إن لم يتضح السبب.";
}

async function openErrorLogsPanel(){
    if(!isAdmin || !sb) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("error-logs-overlay").style.display = "flex";
    const list = document.getElementById("error-logs-list");
    list.innerHTML = `<div class="empty-note">جارٍ التحميل...</div>`;
    const { data, error } = await sb.from("error_logs").select("*").order("created_at", { ascending:false }).limit(50);
    if(error || !data || data.length === 0){
        list.innerHTML = `<div class="empty-note">لا توجد أخطاء مسجَّلة 🎉</div>`;
        return;
    }
    list.innerHTML = data.map(e => `
        <div style="padding:10px 12px; background:var(--bg-alt); border-radius:10px; border:1px solid var(--border); font-size:12px;">
            <b style="color:var(--rose);">${escapeHtml(e.message || "")}</b>
            <div style="color:var(--gold); margin-top:6px; font-weight:600;">💡 ${explainErrorInArabic(e.message)}</div>
            <div style="color:var(--text-3); margin-top:4px;">${escapeHtml(e.page_url || "")} · ${new Date(e.created_at).toLocaleString("ar-SA")}</div>
            ${e.stack_summary ? `<div style="color:var(--text-3); margin-top:4px; font-family:var(--font-mono); font-size:10.5px; white-space:pre-wrap; word-break:break-word;">${escapeHtml(e.stack_summary.slice(0,300))}</div>` : ""}
        </div>`).join("");
}

async function clearErrorLogs(){
    if(!isAdmin || !sb) return;
    if(!confirm("مسح كل سجل الأخطاء؟")) return;
    await sb.from("error_logs").delete().gte("id", 0);
    openErrorLogsPanel();
}

async function openAnalyticsPanel(){
    if(!isAdmin || !sb) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("analytics-overlay").style.display = "flex";
    const box = document.getElementById("analytics-content");
    box.innerHTML = `<div class="empty-note">جارٍ التحميل...</div>`;
    const { data, error } = await sb.rpc("get_admin_analytics");
    if(error || !data){
        box.innerHTML = `<div class="empty-note">تعذّر التحميل — تأكد من تشغيل SUPABASE_SETUP.sql المحدَّث</div>`;
        console.error(error);
        return;
    }
    const rows = [
        ["إجمالي الحسابات المسجَّلة", data.total_users],
        ["نشِطون هذا الأسبوع", data.active_this_week],
        ["مشاركون في لوحة الصدارة", data.leaderboard_entries],
        ["رسائل حائط الأسئلة", data.forum_posts],
        ["قوالب خطط منشورة", data.templates_published],
        ["تقارير مصادر مخصَّصة", data.source_reports],
    ];
    box.innerHTML = rows.map(([label, val]) => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:var(--bg-alt); border-radius:12px;">
            <span style="font-size:13.5px; color:var(--text-2);">${label}</span>
            <b style="font-size:20px; color:var(--gold);">${val ?? 0}</b>
        </div>`).join("");
}

/* ============================================================
   31) نظام دعوة الأصدقاء
   ============================================================ */
const REFERRAL_XP_REWARD = 50;

function captureReferralParam(){
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if(ref && ref.length > 10){ // فحص بسيط أنه يشبه UID فعلي
        localStorage.setItem("khuta_pending_referral", ref);
        localStorage.setItem("khuta_pending_referral_ts", Date.now().toString());
    }
}

async function recordPendingReferral(newUid){
    if(!sb) return;
    const referrerId = localStorage.getItem("khuta_pending_referral");
    const capturedAt = parseInt(localStorage.getItem("khuta_pending_referral_ts")) || 0;
    const REFERRAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 ساعة — قيمة قديمة أكثر من هذا تُعتبر ملغاة تلقائياً
    if(!referrerId || Date.now() - capturedAt > REFERRAL_EXPIRY_MS){
        localStorage.removeItem("khuta_pending_referral");
        localStorage.removeItem("khuta_pending_referral_ts");
        return;
    }
    if(referrerId === newUid) return; // لا يمكن دعوة نفسك
    try{
        const { error } = await sb.from("referrals").insert({ referrer_id: referrerId, referred_id: newUid });
        if(!error){
            awardXP(REFERRAL_XP_REWARD);
            showToast(currentLang==='ar' ? `🎁 +${REFERRAL_XP_REWARD} XP لانضمامك عبر دعوة صديق!` : `🎁 +${REFERRAL_XP_REWARD} XP for joining via a friend's invite!`);
        }
    }catch(e){ /* فشل تسجيل الدعوة ليس خطأً حرجاً — نتجاهله بصمت */ }
    localStorage.removeItem("khuta_pending_referral");
    localStorage.removeItem("khuta_pending_referral_ts");
}

async function checkAndClaimReferralRewards(){
    if(!sb) return;
    const session = getSession();
    if(!session) return;
    const { data, error } = await sb.from("referrals").select("id").eq("referrer_id", session.uid).eq("referrer_rewarded", false);
    if(error || !data || data.length === 0) return;
    let claimed = 0;
    for(const row of data){
        const { error: updateError } = await sb.from("referrals").update({ referrer_rewarded:true }).eq("id", row.id).eq("referrer_id", session.uid);
        if(!updateError) claimed++;
    }
    if(claimed > 0){
        awardXP(REFERRAL_XP_REWARD * claimed);
        showToast(currentLang==='ar'
            ? `🎉 انضم ${claimed} صديق عبر دعوتك — حصلت على ${REFERRAL_XP_REWARD * claimed} XP!`
            : `🎉 ${claimed} friend(s) joined via your invite — you earned ${REFERRAL_XP_REWARD * claimed} XP!`);
    }
}

function getReferralLink(){
    const session = getSession();
    if(!session) return null;
    return location.origin + location.pathname + "?ref=" + session.uid;
}

async function shareReferralLink(){
    const link = getReferralLink();
    if(!link){ showToast(currentLang==='ar' ? "سجّل دخولك أولاً لمشاركة رابط الدعوة" : "Sign in first to share your invite link"); return; }
    const shareText = currentLang==='ar'
        ? `جرّب خُطى — رفيقك الذكي لمذاكرة القدرات 🚀\n${link}`
        : `Try Khuta — your smart GAT study companion 🚀\n${link}`;
    if(navigator.share){
        try{ await navigator.share({ text: shareText }); return; }catch(e){ /* ألغى المستخدم المشاركة */ return; }
    }
    try{
        await navigator.clipboard.writeText(shareText);
        showToast(currentLang==='ar' ? "📋 نُسخ رابط الدعوة" : "📋 Invite link copied");
    }catch(e){
        prompt(currentLang==='ar' ? "انسخ رابط دعوتك:" : "Copy your invite link:", link);
    }
}

/* ============================================================
   32) الجولة التعريفية للمستخدم الجديد — تظهر مرة واحدة فقط بعد إكمال
   الإعداد لأول مرة، تسلّط الضوء على أهم الميزات التي قد لا يكتشفها
   الطالب بنفسه.
   ============================================================ */
const ONBOARDING_STEPS = [
    {
        id: "dash-card-overview-quests",
        titleAr: "مهام اليوم — نقطة البداية اليومية", titleEn: "Today's tasks — your daily starting point",
        textAr: "هذه القائمة تُبنى تلقائياً من خطتك: كمية محددة من كل مصدر (إيهاب، المنصف، المعاصر...) موزّعة على أيام خطتك بالتساوي. أنجزت مهمة؟ علّم عليها ✓ وتكسب XP فوراً. لو تأخّرت يوماً، الموقع يعيد توزيع الباقي عليك تلقائياً — لا تحتاج تحسب شيئاً بنفسك أبداً.",
        textEn: "This list is built automatically from your plan: a specific amount from each source, spread evenly across your plan's days. Check ✓ a task and earn XP instantly. Fall behind a day, and the site automatically redistributes what's left — you never have to calculate anything yourself.",
    },
    {
        id: "btn-plan-session",
        titleAr: "ابدأ جلستك من هنا", titleEn: "Start your session here",
        textAr: "المؤقت يقسّم وقتك تلقائياً بين اللفظي والكمي، ويتعلّم من أدائك مع الوقت ليُعدّل التوزيع بنفسه. استراحة تلقائية كل ساعة مذاكرة متواصلة، وعدد محدود من استراحات الخمس دقائق تختارها بنفسك.",
        textEn: "The timer auto-splits your time between verbal and quant, and learns from your pace over time to rebalance itself. Automatic breaks every hour of continuous study, plus a limited number of 5-minute breaks you control.",
    },
    {
        id: "chatbot-fab",
        titleAr: "مساعدك الذكي — متاح دائماً", titleEn: "Your AI assistant — always available",
        textAr: "علقت بسؤال كمي أو لفظي؟ اسأله وسيشرحه خطوة بخطوة على سبورة تفاعلية. أو اسأله أي شيء عن الموقع نفسه (\"كيف أحسب موزونتي؟\"، \"وين ألقى دليل التخصصات؟\") وسينقلك للمكان بنفسه مباشرة — جرّب واكتشف حتى الأوسمة السرّية 👀",
        textEn: "Stuck on a quant or verbal question? Ask, and it'll explain step-by-step on an interactive board. Or ask anything about the site itself (\"how do I calculate my weighted score?\") and it'll take you straight there — even the secret badges are worth asking about 👀",
    },
    {
        id: "btn-customize-dashboard",
        titleAr: "خصّص لوحتك", titleEn: "Customize your dashboard",
        textAr: "بدأناك بأبسط لوحة ممكنة. من هنا تقدر تفعّل خريطة النشاط، لوحة الصدارة، مسار التقدم، الأوسمة، أو المجتمع، أو تخفي ما لا تحتاجه.",
        textEn: "We started you with the simplest possible dashboard. From here you can turn on the activity heatmap, leaderboard, progress path, badges, or community — or hide what you don't need.",
    },
    {
        selector: '[data-tab="calculator"]',
        titleAr: "حاسبة الموزونة", titleEn: "Weighted score calculator",
        textAr: "احسب نسبتك الموزونة لأكثر من 30 جامعة سعودية، مع توضيح إن كان STEP مطلوباً لجامعتك أو تخصصك تحديداً.",
        textEn: "Calculate your weighted score for 30+ Saudi universities, with clarity on whether STEP is required for your specific university or major.",
    },
    {
        selector: '[data-tab="links"]',
        titleAr: "روابط كل مصادرك", titleEn: "All your source links",
        textAr: "روابط مباشرة لكل الدورات (إيهاب، المنصف، المعاصر، المفكر) في مكان واحد، بدل البحث عنها كل مرة.",
        textEn: "Direct links to every course (Ehab, Monsif, Moasser, Mufakkir) in one place, instead of searching for them each time.",
    },
    {
        selector: '[data-tab="specialties"]',
        titleAr: "دليل التخصصات", titleEn: "Specialty guide",
        textAr: "أكثر من 20 تخصصاً جامعياً مع وصف كل واحد ومساره الوظيفي والجامعات التي توفره — مفيد إن كنت لم تحسم تخصصك بعد.",
        textEn: "20+ university majors with descriptions, career paths, and which universities offer them — useful if you haven't decided on a major yet.",
    },
    {
        selector: '[data-tab="community"]',
        titleAr: "لست وحدك", titleEn: "You're not alone",
        textAr: "شاهد كم طالباً يذاكر الآن معك، شارك في لوحة الصدارة الأسبوعية، أو اطرح سؤالاً سريعاً على حائط الأسئلة.",
        textEn: "See how many students are studying right now with you, join the weekly leaderboard, or ask a quick question on the community wall.",
    },
];

function shouldShowOnboardingTour(){
    return !localStorage.getItem("khuta_onboarding_done") && !!localStorage.getItem("khuta_plan_days");
}

function startOnboardingTour(){
    if(!shouldShowOnboardingTour()) return;
    if(isLoginOverlayVisible()){ setTimeout(startOnboardingTour, 1000); return; } // انتظر حتى تُغلق شاشة الدخول أولاً
    localStorage.setItem("khuta_onboarding_done", "1"); // نُعلّم فوراً حتى لا تتكرر حتى لو أُغلقت الصفحة منتصف الجولة
    runOnboardingStep(0);
}

function isLoginOverlayVisible(){
    const el = document.getElementById("login-overlay");
    if(!el) return false;
    const display = el.style.display || getComputedStyle(el).display;
    return display !== "none";
}

function runOnboardingStep(index){
    document.getElementById("onboarding-overlay")?.remove();
    if(index >= ONBOARDING_STEPS.length) return;
    if(isLoginOverlayVisible()) return; // ظهرت شاشة الدخول أثناء الجولة (تجديد جلسة مثلاً) — نتوقف بأمان
    const step = ONBOARDING_STEPS[index];
    let target = step.id ? document.getElementById(step.id) : null;
    if((!target || target.offsetParent === null) && step.selector){
        target = Array.from(document.querySelectorAll(step.selector)).find(el => el.offsetParent !== null);
    }
    if((!target || target.offsetParent === null) && step.fallbackId) target = document.getElementById(step.fallbackId);
    if(!target || target.offsetParent === null){ runOnboardingStep(index + 1); return; } // العنصر غير ظاهر في هذا الجهاز — تخطَّ الخطوة

    const rect = target.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.id = "onboarding-overlay";
    overlay.className = "onboarding-overlay";
    const pad = 8;
    const isLast = index === ONBOARDING_STEPS.length - 1;
    overlay.innerHTML = `
        <div class="onboarding-spotlight" style="top:${rect.top - pad}px; left:${rect.left - pad}px; width:${rect.width + pad*2}px; height:${rect.height + pad*2}px;"></div>
        <div class="onboarding-card" id="onboarding-card-el">
            <span class="onboarding-step-count">${index + 1} / ${ONBOARDING_STEPS.length}</span>
            <b>${currentLang==='ar' ? step.titleAr : step.titleEn}</b>
            <p>${currentLang==='ar' ? step.textAr : step.textEn}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; gap:8px;">
                <button type="button" class="btn-ghost" style="font-size:12px;" onclick="document.getElementById('onboarding-overlay').remove()">${currentLang==='ar'?'تخطّي':'Skip'}</button>
                <button type="button" class="btn btn-sm" onclick="runOnboardingStep(${index + 1})">${isLast ? (currentLang==='ar'?'إنهاء':'Done') : (currentLang==='ar'?'التالي':'Next')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // ⚠️ إصلاح مهم: كنا نحسب موضع البطاقة العلوي بافتراض ارتفاع ثابت
    // (180px) قبل حتى إدراجها في الصفحة — قد يختلف الارتفاع الفعلي حسب
    // طول النص، فتخرج البطاقة جزئياً عن الشاشة أسفلاً أو حتى أعلاها على
    // الهاتف تحديداً. الآن نقيس البطاقة بعد إدراجها الفعلي، ونُبقيها ضمن
    // حدود الشاشة الآمنة (مع مراعاة حواف الهاتف ذات النتوء) في كل الاتجاهات.
    const card = document.getElementById("onboarding-card-el");
    const cardRect = card.getBoundingClientRect();
    const safeTop = 16, safeBottom = 30, safeSide = 14; // safeBottom أكبر عمداً ليحسب هامش المنطقة الآمنة (شريط الإيماءة/الشريط السفلي) على الهواتف الحديثة
    let top = rect.bottom + 16;
    if(top + cardRect.height > window.innerHeight - safeBottom){
        top = rect.top - cardRect.height - 16; // لا مكان أسفل الهدف — نضعها أعلاه بدلاً
    }
    top = Math.max(safeTop, Math.min(top, window.innerHeight - cardRect.height - safeBottom));
    const left = Math.max(safeSide, Math.min(rect.left, window.innerWidth - cardRect.width - safeSide));
    card.style.top = top + "px";
    card.style.left = left + "px";
}

/* ============================================================
   دليل الموقع بالذكاء الاصطناعي — تنفيذ وسم [[NAVIGATE:key]] الذي قد
   يضيفه مساعد خُطى في نهاية ردّه. يعيد استخدام نفس نمط "بقعة ضوء + بطاقة"
   من الجولة التعريفية أعلاه، لكن كخطوة واحدة مستهدفة بدل جولة كاملة.
   ============================================================ */
// يستخرج وسوم [[NAVIGATE:key]] من نص رد الذكاء، وينفّذ أول واحد صالح منها
// فقط، ويعيد النص بعد حذف الوسم منه (النص المعروض للطالب لا يجب أن يحوي
// صياغة تقنية داخلية كهذه)
function extractNavigateTag(replyText){
    const re = /\[\[NAVIGATE:([a-z_]+)\]\]/gi;
    let cleaned = replyText, matchedKey = null;
    const m = re.exec(replyText);
    if(m && NAV_TARGETS[m[1]]){ matchedKey = m[1]; }
    cleaned = replyText.replace(/\s*\[\[NAVIGATE:[a-z_]+\]\]\s*/gi, " ").trim();
    return { cleaned, key: matchedKey };
}

function aiGuideNavigate(key){
    const cfg = NAV_TARGETS[key];
    if(!cfg) return;

    if(cfg.type === "action"){
        if(typeof window[cfg.action] === "function") window[cfg.action]();
        return;
    }

    // نوع "tab": نبدّل القسم أولاً، ثم — إن كان هناك عنصر محدد — نظلّله
    // ببطاقة تعريفية صغيرة؛ وإلا نكتفي بالانتقال نفسه (واضح بذاته)
    switchTab(cfg.tab);
    if(!cfg.elementId){ showToast(currentLang==='ar' ? `📍 ${cfg.titleAr}` : `📍 Navigated`); return; }

    setTimeout(() => {
        const target = document.getElementById(cfg.elementId);
        if(!target || target.offsetParent === null){
            showToast(currentLang==='ar' ? `📍 ${cfg.titleAr}` : `📍 Navigated`);
            return;
        }
        document.getElementById("onboarding-overlay")?.remove();
        const rect = target.getBoundingClientRect();
        const overlay = document.createElement("div");
        overlay.id = "onboarding-overlay";
        overlay.className = "onboarding-overlay";
        const pad = 8;
        overlay.innerHTML = `
            <div class="onboarding-spotlight" style="top:${rect.top - pad}px; left:${rect.left - pad}px; width:${rect.width + pad*2}px; height:${rect.height + pad*2}px;"></div>
            <div class="onboarding-card ai-guide-card" id="onboarding-card-el">
                <span class="ai-guide-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${currentLang==='ar'?'مساعدك دلّك هنا':'Your assistant guided you here'}</span>
                <b>${currentLang==='ar' ? cfg.titleAr : (cfg.titleEn || cfg.titleAr)}</b>
                <p>${currentLang==='ar' ? cfg.textAr : (cfg.textEn || cfg.textAr)}</p>
                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                    <button type="button" class="btn btn-sm" onclick="document.getElementById('onboarding-overlay').remove()">${currentLang==='ar'?'فهمت 👍':'Got it 👍'}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        // نفس إصلاح القياس بعد الإدراج الفعلي بدل افتراض ارتفاع ثابت (انظر runOnboardingStep)
        const card = document.getElementById("onboarding-card-el");
        const cardRect = card.getBoundingClientRect();
        const safeTop = 16, safeBottom = 30, safeSide = 14; // safeBottom أكبر عمداً ليحسب هامش المنطقة الآمنة (شريط الإيماءة/الشريط السفلي) على الهواتف الحديثة
        let top = rect.bottom + 16;
        if(top + cardRect.height > window.innerHeight - safeBottom) top = rect.top - cardRect.height - 16;
        top = Math.max(safeTop, Math.min(top, window.innerHeight - cardRect.height - safeBottom));
        const left = Math.max(safeSide, Math.min(rect.left, window.innerWidth - cardRect.width - safeSide));
        card.style.top = top + "px";
        card.style.left = left + "px";
        clearTimeout(window.__aiGuideAutoT);
        window.__aiGuideAutoT = setTimeout(() => overlay.remove(), 7000);
    }, 260); // مهلة قصيرة كي يكتمل تبديل القسم وتُقاس أبعاد العنصر بدقة
}

/* ============================================================
   33) إشعارات Push الحقيقية — تصل حتى لو أُغلق الموقع تماماً.
   المفتاح هنا "عام" بطبيعته (VAPID public key) ولا يُشكّل أي خطر أمني
   ظهوره في الكود — هذا هو الاستخدام الصحيح والمُتوقَّع له. المفتاح
   الخاص (Private) موجود فقط في متغيّر بيئة على Netlify، لا يصل هنا إطلاقاً.
   ============================================================ */
const VAPID_PUBLIC_KEY = "BMWllR59gW0Z5EHMNv1CQxEKzGjvoNY8SEznutD9Du1KVVGohKA8lu9Z8Rx7tnBSfW2ZypVGiXIcPdBRE-id9gA";

function urlBase64ToUint8Array(base64String){
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPushNotifications(){
    if(!("serviceWorker" in navigator) || !("PushManager" in window)){
        showToast(currentLang==='ar' ? "متصفحك لا يدعم إشعارات Push" : "Your browser doesn't support push notifications");
        return;
    }
    const session = getSession();
    if(!session || !sb){
        showToast(currentLang==='ar' ? "سجّل دخولك أولاً لتفعيل الإشعارات" : "Sign in first to enable notifications");
        return;
    }
    try{
        const permission = await Notification.requestPermission();
        if(permission !== "granted"){
            showToast(currentLang==='ar' ? "لم تُمنح صلاحية الإشعارات" : "Notification permission not granted");
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const { error } = await sb.from("push_subscriptions").upsert({
            user_id: session.uid,
            endpoint: subscription.endpoint,
            subscription: subscription.toJSON(),
        }, { onConflict: "endpoint" });
        if(error){ console.error("[خُطى] تعذّر حفظ اشتراك الإشعارات:", error); return; }
        localStorage.setItem("khuta_push_enabled", "1");
        showToast(currentLang==='ar' ? "🔔 فُعِّلت إشعاراتك اليومية" : "🔔 Your daily reminders are on");
    }catch(e){
        console.error("[خُطى] تعذّر تفعيل إشعارات Push:", e);
        showToast(currentLang==='ar' ? "تعذّر تفعيل الإشعارات" : "Couldn't enable notifications");
    }
}

async function openLiveUsersPanel(){
    if(!isAdmin) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("live-users-overlay").style.display = "flex";
    if(!presenceChannel) await startPresenceHeartbeat(); // نضمن اتصال قناة الحضور حتى لو لم يزر المشرف صفحة المجتمع
    const count = presenceChannel ? Object.keys(presenceChannel.presenceState()).length || 1 : 1;
    document.getElementById("live-users-count").textContent = count;
}
function closeLiveUsersPanel(){
    document.getElementById("live-users-overlay").style.display = "none";
}

/* ============================================================
   34) متجر إطارات الصورة الشخصية — يُصرف بها XP بدل الادّخار فقط
   ============================================================ */
const AVATAR_FRAMES = [
    { id:"none", nameAr:"بلا إطار (افتراضي)", nameEn:"No frame (default)", cost:0, cls:"" },
    { id:"silver", nameAr:"حلقة فضية", nameEn:"Silver ring", cost:40, cls:"frame-silver" },
    { id:"fire", nameAr:"حلقة نارية", nameEn:"Fire ring", cost:80, cls:"frame-fire" },
    { id:"diamond", nameAr:"حلقة ماسية", nameEn:"Diamond ring", cost:150, cls:"frame-diamond" },
    { id:"royal", nameAr:"التاج الملكي", nameEn:"Royal crown", cost:300, cls:"frame-royal" },
];

function getOwnedFrames(){
    try{ return JSON.parse(localStorage.getItem("khuta_owned_frames")) || ["none"]; }catch(e){ return ["none"]; }
}
function getEquippedFrame(){ return localStorage.getItem("khuta_equipped_frame") || "none"; }

function applyEquippedFrame(){
    const wrap = document.getElementById("avatar-wrap");
    if(!wrap) return;
    AVATAR_FRAMES.forEach(f => { if(f.cls) wrap.classList.remove(f.cls); });
    const equipped = AVATAR_FRAMES.find(f => f.id === getEquippedFrame());
    if(equipped && equipped.cls) wrap.classList.add(equipped.cls);
}

function renderFrameShop(){
    const box = document.getElementById("frame-shop-list");
    if(!box) return;
    const owned = getOwnedFrames();
    const equipped = getEquippedFrame();
    box.innerHTML = AVATAR_FRAMES.map(f => `
        <button type="button" class="path-card ${equipped===f.id?'selected':''}" style="padding:10px 12px; cursor:pointer;" onclick="${owned.includes(f.id) ? `equipFrame('${f.id}')` : `purchaseFrame('${f.id}')`}">
            <b style="font-size:12px; display:block; color:var(--text-1);">${currentLang==='ar'?f.nameAr:f.nameEn}</b>
            <span style="font-size:11px; color:var(--text-3);">${owned.includes(f.id) ? (equipped===f.id ? (currentLang==='ar'?'مُفعَّل ✓':'Equipped ✓') : (currentLang==='ar'?'تفعيل':'Equip')) : `${f.cost} XP`}</span>
        </button>`).join("");
    applyEquippedFrame();
}

function purchaseFrame(id){
    const frame = AVATAR_FRAMES.find(f => f.id === id);
    if(!frame) return;
    const owned = getOwnedFrames();
    if(owned.includes(id)){ equipFrame(id); return; }
    if(getXP() < frame.cost){
        showToast(currentLang==='ar' ? `تحتاج ${frame.cost} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${frame.cost} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `شراء "${frame.nameAr}" مقابل ${frame.cost} XP؟` : `Buy "${frame.nameEn}" for ${frame.cost} XP?`)) return;
    setXP(getXP() - frame.cost);
    owned.push(id);
    localStorage.setItem("khuta_owned_frames", JSON.stringify(owned));
    equipFrame(id);
    showToast(currentLang==='ar' ? "🖼️ تم الشراء والتفعيل" : "🖼️ Purchased and equipped");
}

function equipFrame(id){
    localStorage.setItem("khuta_equipped_frame", id);
    renderFrameShop();
    debouncedSync();
}

/* ============================================================
   34) التقرير الأسبوعي المتعمّق — يُصرف بها XP مرة واحدة فقط (فتح دائم)،
   يُبنى بالكامل من بيانات حقيقية موجودة أصلاً: سجل الدقائق اليومية،
   ملاحظات المهام السريعة، وتواريخ الإكمال. لا بيانات مُلفَّقة أو مُقدَّرة.
   ============================================================ */
const DEEP_REPORT_COST = 60;
const DAY_NAMES_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const DAY_NAMES_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isDeepReportUnlocked(){ return localStorage.getItem("khuta_deep_report_unlocked") === "1"; }

function refreshDeepReportButton(){
    const btn = document.getElementById("btn-deep-report");
    if(!btn) return;
    if(isDeepReportUnlocked()){
        btn.innerHTML = `<i class="fa-solid fa-chart-column"></i> ${currentLang==='ar'?'عرض التقرير المتعمّق':'View deep report'}`;
    } else {
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> ${currentLang==='ar'?`فتح التقرير المتعمّق (${DEEP_REPORT_COST} XP)`:`Unlock deep report (${DEEP_REPORT_COST} XP)`}`;
    }
}

function handleDeepReportClick(){
    if(isDeepReportUnlocked()){ showDeepReport(); return; }
    if(getXP() < DEEP_REPORT_COST){
        showToast(currentLang==='ar' ? `تحتاج ${DEEP_REPORT_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${DEEP_REPORT_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `فتح التقرير المتعمّق نهائياً مقابل ${DEEP_REPORT_COST} XP؟` : `Permanently unlock the deep report for ${DEEP_REPORT_COST} XP?`)) return;
    setXP(getXP() - DEEP_REPORT_COST);
    localStorage.setItem("khuta_deep_report_unlocked", "1");
    refreshDeepReportButton();
    showDeepReport();
}

function showDeepReport(){
    let dailyLog = {};
    try{ dailyLog = JSON.parse(localStorage.getItem("khuta_daily_minutes_log")) || {}; }catch(e){}
    const dayNames = currentLang==='ar' ? DAY_NAMES_AR : DAY_NAMES_EN;

    // مقارنة 4 أسابيع فعلية
    const weeks = [0,0,0,0];
    const dayTotals = [0,0,0,0,0,0,0];
    const dayCounts = [0,0,0,0,0,0,0];
    for(let i = 0; i < 28; i++){
        const d = new Date(); d.setDate(d.getDate() - i);
        const mins = dailyLog[d.toDateString()] || 0;
        weeks[Math.floor(i/7)] += mins;
        if(mins > 0){ dayTotals[d.getDay()] += mins; dayCounts[d.getDay()]++; }
    }
    const dayAverages = dayTotals.map((t,i) => dayCounts[i] > 0 ? Math.round(t / dayCounts[i]) : 0);
    const maxAvg = Math.max(...dayAverages, 1);
    const bestDayIdx = dayAverages.indexOf(Math.max(...dayAverages));
    const hasEnoughData = Object.keys(dailyLog).length >= 3;

    // آخر 7 أيام كأعمدة (لمحة سريعة، أوضح بصرياً من متوسطات كل التاريخ)
    const last7 = [];
    for(let i = 6; i >= 0; i--){
        const d = new Date(); d.setDate(d.getDate() - i);
        last7.push({ label: dayNames[d.getDay()], mins: dailyLog[d.toDateString()] || 0 });
    }
    const maxBar = Math.max(...last7.map(d => d.mins), 1);
    const barsHtml = last7.map(d => `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1;">
            <div style="width:100%; height:70px; display:flex; align-items:flex-end;">
                <div style="width:100%; height:${Math.max(4, (d.mins/maxBar)*100)}%; background:linear-gradient(180deg, var(--gold), var(--gold-soft)); border-radius:4px 4px 0 0;"></div>
            </div>
            <span style="font-size:9.5px; color:var(--text-3);">${d.label}</span>
        </div>`).join("");

    const notes = getTaskNotes();
    const noteEntries = Object.values(notes);

    const box = document.getElementById("deep-report-content");
    if(!hasEnoughData){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'تحتاج بضعة أيام إضافية من المذاكرة الفعلية حتى يصبح لدينا بيانات كافية لتقرير حقيقي.':'You need a few more days of real study data before we can build a genuine report.'}</div>`;
    } else {
        const weekBars = weeks.map((w,i) => {
            const label = i===0 ? (currentLang==='ar'?'هذا الأسبوع':'This week') : (currentLang==='ar'?`منذ ${i+1} أسابيع`:`${i+1} weeks ago`);
            const maxW = Math.max(...weeks, 1);
            return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span style="width:90px; font-size:11px; color:var(--text-3);">${label}</span>
                <div class="mini-progress" style="flex:1;"><div style="width:${Math.max(3,(w/maxW)*100)}%; background:var(--gold);"></div></div>
                <span style="width:50px; font-size:11px; text-align:end;">${(w/60).toFixed(1)} ${currentLang==='ar'?'س':'h'}</span>
            </div>`;
        }).join("");

        const dayBars = dayAverages.map((avg,i) => `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <span style="width:70px; font-size:11px; color:${i===bestDayIdx?'var(--gold)':'var(--text-3)'}; font-weight:${i===bestDayIdx?'700':'400'};">${dayNames[i]}</span>
                <div class="mini-progress" style="flex:1;"><div style="width:${Math.max(3,(avg/maxAvg)*100)}%; background:${i===bestDayIdx?'var(--gold)':'var(--border)'};"></div></div>
                <span style="width:40px; font-size:11px; text-align:end;">${avg} ${currentLang==='ar'?'د':'m'}</span>
            </div>`).join("");

        box.innerHTML = `
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'آخر 7 أيام':'Last 7 days'}</b>
                <div style="display:flex; gap:4px;">${barsHtml}</div>
            </div>
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'مقارنة آخر 4 أسابيع':'Last 4 weeks compared'}</b>
                ${weekBars}
            </div>
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'متوسط دقائق المذاكرة حسب يوم الأسبوع (كل التاريخ)':'Average study minutes by day of week (all-time)'}</b>
                ${dayBars}
                <p class="hint" style="margin-top:8px;">${currentLang==='ar'?`أفضل يوم لديك تاريخياً هو ${dayNames[bestDayIdx]}.`:`Your historically strongest day is ${dayNames[bestDayIdx]}.`}</p>
            </div>
            ${noteEntries.length ? `
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'📝 نقاط وضعت عليها ملاحظات':'📝 Points you flagged with notes'}</b>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${noteEntries.slice(0,5).map(n => `<div style="font-size:12px; color:var(--text-2); background:var(--bg-alt); padding:8px 10px; border-radius:8px;">${escapeHtml(n)}</div>`).join("")}
                </div>
            </div>` : ""}`;
    }
    document.getElementById("deep-report-overlay").style.display = "flex";
}

const PRESET_AVATARS = [
    { id:"rocket", icon:"fa-rocket", color:"#C9962E" },
    { id:"book", icon:"fa-book-open", color:"#1C8A72" },
    { id:"star", icon:"fa-star", color:"#C4436B" },
    { id:"bolt", icon:"fa-bolt", color:"#4F46C7" },
    { id:"brain", icon:"fa-brain", color:"#D97B1F" },
    { id:"crown", icon:"fa-crown", color:"#948CE0" },
    { id:"owl", icon:"fa-kiwi-bird", color:"#38B897" },
    { id:"target", icon:"fa-bullseye", color:"#E06B93" },
];

function deleteAvatar(){
    if(!confirm(currentLang==='ar' ? "حذف صورتك الشخصية؟" : "Delete your profile photo?")) return;
    localStorage.removeItem("khuta_avatar");
    localStorage.removeItem("khuta_avatar_preset");
    renderAvatarDisplay();
    debouncedSync();
}

function togglePresetAvatars(){
    const row = document.getElementById("preset-avatars-row");
    const opening = row.style.display === "none";
    row.style.display = opening ? "flex" : "none";
    if(opening){
        row.innerHTML = PRESET_AVATARS.map(p => `
            <button type="button" onclick="choosePresetAvatar('${p.id}')" style="width:52px; height:52px; border-radius:50%; border:2px solid var(--border); background:${p.color}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer;">
                <i class="fa-solid ${p.icon}"></i>
            </button>`).join("");
    }
}

function choosePresetAvatar(id){
    const preset = PRESET_AVATARS.find(p => p.id === id);
    if(!preset) return;
    localStorage.setItem("khuta_avatar_preset", id);
    localStorage.removeItem("khuta_avatar"); // الصورة المرفوعة والرمز الجاهز لا يجتمعان معاً
    renderAvatarDisplay();
    debouncedSync();
    showToast(currentLang==='ar' ? "✅ تم اختيار الصورة" : "✅ Avatar selected");
}

function renderAvatarDisplay(){
    const img = document.getElementById("avatar-img");
    const placeholder = document.getElementById("avatar-placeholder");
    const deleteBtn = document.getElementById("avatar-delete-btn");
    const uploaded = localStorage.getItem("khuta_avatar");
    const presetId = localStorage.getItem("khuta_avatar_preset");
    const preset = PRESET_AVATARS.find(p => p.id === presetId);

    if(uploaded){
        img.src = uploaded; img.style.display = "block";
        placeholder.style.display = "none";
        deleteBtn.style.display = "flex";
    } else if(preset){
        img.style.display = "none";
        placeholder.style.display = "flex";
        placeholder.style.background = preset.color;
        placeholder.style.color = "#fff";
        placeholder.style.borderColor = preset.color;
        placeholder.innerHTML = `<i class="fa-solid ${preset.icon}"></i>`;
        deleteBtn.style.display = "flex";
    } else {
        img.style.display = "none";
        placeholder.style.display = "flex";
        placeholder.style.background = "var(--bg-alt)";
        placeholder.style.color = "var(--text-3)";
        placeholder.style.borderColor = "var(--border)";
        placeholder.innerHTML = '<i class="fa-solid fa-user"></i>';
        deleteBtn.style.display = "none";
    }
    renderHeaderMiniAvatar();
}

/* نسخة مصغّرة من نفس منطق الأفاتار، للعرض في رأس الصفحة القابل للنقر للانتقال للملف الشخصي */
function renderHeaderMiniAvatar(){
    const el = document.getElementById("header-mini-avatar");
    const focusEl = document.getElementById("focus-header-avatar");
    if(!el && !focusEl) return;
    const uploaded = localStorage.getItem("khuta_avatar");
    const presetId = localStorage.getItem("khuta_avatar_preset");
    const preset = PRESET_AVATARS.find(p => p.id === presetId);
    let html;
    if(uploaded){
        html = `<img src="${uploaded}" style="width:100%;height:100%;object-fit:cover;">`;
    } else if(preset){
        html = `<div style="width:100%;height:100%;background:${preset.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;"><i class="fa-solid ${preset.icon}"></i></div>`;
    } else {
        html = `<div style="width:100%;height:100%;background:var(--bg-alt);color:var(--text-3);display:flex;align-items:center;justify-content:center;font-size:18px;"><i class="fa-solid fa-user"></i></div>`;
    }
    if(el) el.innerHTML = html;
    if(focusEl) focusEl.innerHTML = html;
}

function logSiteVisit(){
    if(!sb) return;
    const isGuest = !getSession();
    sb.from("site_visits").insert({ is_guest: isGuest }).then(() => {}, () => {}); // فشل التسجيل ليس حرجاً، تجاهل بصمت
}

let visitStatsPollTimer = null;
/* ============================================================
   لوحة إدارة رسائل البريد — للمشرفين فقط. الكتابة والقراءة تمر عبر Supabase
   مباشرة (محمية بـRLS)، والإرسال الفعلي عبر send-email.js التي تتحقق من
   صلاحية المشرف على الخادم مستقلةً — لا تكفي إخفاء الزر في الواجهة وحده.
   ============================================================ */
async function openCampaignPanel(){
    if(!isAdmin) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("campaign-overlay").style.display = "flex";
    switchCampaignTab("list", document.querySelector(".campaign-tab"));
    await renderCampaignList();
}

function switchCampaignTab(pane, btn){
    document.querySelectorAll(".campaign-pane").forEach(p => p.style.display = "none");
    document.querySelectorAll(".campaign-tab").forEach(b => b.classList.remove("active"));
    document.getElementById("campaign-pane-" + pane).style.display = "block";
    if(btn) btn.classList.add("active");
    if(pane === "list") renderCampaignList();
    if(pane === "log") renderCampaignLog();
}

function onCampaignModeChange(){
    const mode = document.getElementById("campaign-mode").value;
    document.getElementById("campaign-inactive-group").style.display = mode === "behavior" ? "block" : "none";
}

async function renderCampaignList(){
    const box = document.getElementById("campaign-list");
    if(!sb){ box.innerHTML = "<p class='hint'>الاتصال بقاعدة البيانات غير متاح</p>"; return; }
    box.innerHTML = "<p class='hint'>جاري التحميل…</p>";
    try{
        const { data, error } = await sb.from("marketing_messages").select("*").order("created_at", { ascending:false });
        if(error) throw error;
        if(!data || data.length === 0){ box.innerHTML = "<p class='hint'>لا توجد رسائل بعد — أنشئ واحدة من تبويب \"رسالة جديدة\"</p>"; return; }
        box.innerHTML = data.map(m => {
            const modeLabel = m.send_mode === "behavior" ? `ذكي (غاب ${m.inactive_days || 5} أيام)` : "جماعي";
            const statusLabel = m.sent_at ? `أُرسلت ${new Date(m.sent_at).toLocaleDateString("ar-SA")}`
                : (m.send_after && new Date(m.send_after) > new Date()) ? `مجدولة بعد ${new Date(m.send_after).toLocaleDateString("ar-SA")}`
                : "جاهزة";
            return `<div class="campaign-row">
                <div class="campaign-row-main">
                    <b>${escapeHtml(m.subject)}</b>
                    <span class="campaign-meta">${modeLabel} · ${escapeHtml(m.occasion || "عام")} · ${statusLabel} · ${m.active ? "مفعّلة" : "معطّلة"}</span>
                </div>
                <div class="campaign-row-actions">
                    <button type="button" class="btn btn-sm" onclick="sendCampaignNow(${m.id})">إرسال الآن</button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="toggleCampaignActive(${m.id}, ${!m.active})">${m.active ? "تعطيل" : "تفعيل"}</button>
                </div>
            </div>`;
        }).join("");
    }catch(e){
        box.innerHTML = "<p class='hint'>تعذّر تحميل الرسائل: " + escapeHtml(String(e.message || e)) + "</p>";
    }
}

async function renderCampaignLog(){
    const box = document.getElementById("campaign-log-list");
    if(!sb) return;
    box.innerHTML = "<p class='hint'>جاري التحميل…</p>";
    try{
        const { data, error } = await sb.from("email_campaign_log").select("*").order("sent_at", { ascending:false }).limit(60);
        if(error) throw error;
        if(!data || data.length === 0){ box.innerHTML = "<p class='hint'>لم تُرسل أي رسالة بعد</p>"; return; }
        box.innerHTML = data.map(l => `<div class="campaign-row">
            <div class="campaign-row-main">
                <b>${escapeHtml(l.recipient_email)}</b>
                <span class="campaign-meta">${new Date(l.sent_at).toLocaleString("ar-SA")} · ${l.status === "sent" ? "✅ نجحت" : "❌ فشلت"}${l.is_test ? " · تجريبية" : ""}</span>
            </div>
        </div>`).join("");
    }catch(e){
        box.innerHTML = "<p class='hint'>تعذّر تحميل السجل: " + escapeHtml(String(e.message || e)) + "</p>";
    }
}

async function saveCampaignMessage(){
    if(!isAdmin || !sb) return;
    const subject = document.getElementById("campaign-subject").value.trim();
    const bodyHtml = document.getElementById("campaign-body").value.trim();
    if(!subject || !bodyHtml){ showToast("العنوان والمحتوى مطلوبان"); return; }
    const sendAfterVal = document.getElementById("campaign-send-after").value;
    try{
        const { error } = await sb.from("marketing_messages").insert({
            subject, body_html: bodyHtml,
            occasion: document.getElementById("campaign-occasion").value.trim() || "عام",
            send_mode: document.getElementById("campaign-mode").value,
            inactive_days: parseInt(document.getElementById("campaign-inactive-days").value) || 5,
            send_after: sendAfterVal ? new Date(sendAfterVal).toISOString() : null,
            active: true,
        });
        if(error) throw error;
        showToast("✅ حُفظت الرسالة");
        document.getElementById("campaign-subject").value = "";
        document.getElementById("campaign-body").value = "";
        switchCampaignTab("list", document.querySelector(".campaign-tab"));
    }catch(e){
        showToast("تعذّر الحفظ: " + (e.message || e));
    }
}

async function toggleCampaignActive(id, newState){
    if(!isAdmin || !sb) return;
    try{
        const { error } = await sb.from("marketing_messages").update({ active: newState }).eq("id", id);
        if(error) throw error;
        renderCampaignList();
    }catch(e){ showToast("تعذّر التحديث: " + (e.message || e)); }
}

// نداء موحّد للمسارات الإدارية في send-email.js (تتحقق من صلاحيتك على الخادم)
async function callAdminEmail(type, extra){
    const { data } = await sb.auth.getSession();
    const accessToken = data && data.session && data.session.access_token;
    if(!accessToken){ showToast("سجّل دخولك أولاً"); return null; }
    const res = await fetch("/.netlify/functions/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, accessToken, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if(!res.ok){ showToast("فشل: " + (json.error || res.status)); return null; }
    return json;
}

async function sendCampaignTest(){
    if(!isAdmin) return;
    const subject = document.getElementById("campaign-subject").value.trim();
    const bodyHtml = document.getElementById("campaign-body").value.trim();
    const emailsRaw = document.getElementById("campaign-test-emails").value.trim();
    if(!subject || !bodyHtml){ showToast("اكتب العنوان والمحتوى أولاً"); return; }
    if(!emailsRaw){ showToast("أدخل بريداً تجريبياً واحداً على الأقل"); return; }
    const testEmails = emailsRaw.split(",").map(s => s.trim()).filter(Boolean);
    showToast("⏳ جاري الإرسال التجريبي…");
    const result = await callAdminEmail("adminTest", { subject, bodyHtml, testEmails });
    if(result){
        const okCount = (result.results || []).filter(r => r.ok).length;
        showToast(`🧪 أُرسلت تجريبياً: ${okCount} من ${testEmails.length}`);
    }
}

async function sendCampaignNow(messageId){
    if(!isAdmin || !sb) return;
    try{
        const { data, error } = await sb.from("marketing_messages").select("*").eq("id", messageId).single();
        if(error) throw error;
        const modeLabel = data.send_mode === "behavior" ? `الطلاب الغائبين ${data.inactive_days || 5} أيام فأكثر` : "كل الطلاب الموافقين";
        if(!confirm(`سترسل "${data.subject}" إلى ${modeLabel}.\n\nهذه رسالة حقيقية ستصل طلاباً فعليين. متأكد؟`)) return;
        showToast("⏳ جاري الإرسال…");
        const result = await callAdminEmail("adminSendCampaign", {
            subject: data.subject, bodyHtml: data.body_html, messageId: data.id,
            message: { send_mode: data.send_mode, inactive_days: data.inactive_days },
        });
        if(result){
            if(result.sent === 0 && result.note){ showToast("ℹ️ " + result.note); }
            else{
                showToast(`✅ أُرسلت لـ${result.sent} طالب${result.failed ? ` (فشل ${result.failed})` : ""}`);
                if(data.send_mode === "broadcast"){
                    await sb.from("marketing_messages").update({ sent_at: new Date().toISOString() }).eq("id", messageId);
                }
                renderCampaignList();
            }
        }
    }catch(e){ showToast("تعذّر الإرسال: " + (e.message || e)); }
}

async function openVisitStatsPanel(){
    if(!isAdmin || !sb) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("visit-stats-overlay").style.display = "flex";
    await refreshVisitStats();
    clearInterval(visitStatsPollTimer);
    visitStatsPollTimer = setInterval(refreshVisitStats, 5000);
}
function closeVisitStatsPanel(){
    document.getElementById("visit-stats-overlay").style.display = "none";
    clearInterval(visitStatsPollTimer);
}
async function refreshVisitStats(){
    const { data, error } = await sb.rpc("get_visit_stats");
    if(error || !data) return;
    document.getElementById("visit-today-count").textContent = data.today_count ?? 0;
    document.getElementById("visit-last-time").textContent = data.last_visit
        ? new Date(data.last_visit).toLocaleString("ar-SA")
        : (currentLang==='ar' ? "لا توجد زيارات بعد" : "No visits yet");
}

/* ============================================================
   35) حل تعارض البيانات بين تقدّم ضيف محلي وحساب له بيانات محفوظة —
   يظهر فقط عند وجود تعارض حقيقي (كلاهما لديه تقدّم فعلي)، وليس أبداً
   لزائر جديد بلا أي تقدّم.
   ============================================================ */
function hasMeaningfulLocalProgress(){
    return !!localStorage.getItem("khuta_plan_days");
}
function snapshotHasMeaningfulProgress(snap){
    return !!(snap && snap.khuta_plan_days);
}

function resolveAccountDataConflict(remoteSnapshot){
    return new Promise((resolve) => {
        const guestHasProgress = hasMeaningfulLocalProgress();
        const accountHasProgress = snapshotHasMeaningfulProgress(remoteSnapshot);

        if(!guestHasProgress || !accountHasProgress){
            // لا تعارض حقيقياً — إن كان للحساب بيانات، طبّقها مباشرة؛ وإلا أبقِ تقدّم الضيف كما هو
            if(accountHasProgress) applyRemoteSnapshot(remoteSnapshot);
            resolve();
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "overlay-screen";
        overlay.style.zIndex = "4900";
        overlay.innerHTML = `
            <div class="wizard-card" style="max-width:440px; text-align:center;">
                <h2 style="margin-bottom:8px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i> ${currentLang==='ar'?'لديك تقدّمان مختلفان':'You have two different progress records'}</h2>
                <p class="card-sub" style="margin-bottom:20px; line-height:1.9;">${currentLang==='ar'
                    ? "ذاكرت كضيف على هذا الجهاز، ولحسابك أيضاً بيانات محفوظة من قبل. أيهما تريد الاحتفاظ به؟ (الخيار الآخر سيُفقَد نهائياً)"
                    : "You've been studying as a guest on this device, and your account also has previously saved data. Which do you want to keep? (The other will be lost permanently)"}</p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" class="btn" id="keep-guest-btn">${currentLang==='ar'?'الاحتفاظ بتقدّمي الحالي (كضيف)':'Keep my current progress (as guest)'}</button>
                    <button type="button" class="btn btn-outline" id="load-account-btn">${currentLang==='ar'?'تحميل بيانات حسابي المحفوظة':"Load my account's saved data"}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#keep-guest-btn").onclick = () => {
            // نُبقي كل شيء محلياً كما هو، لكن نرفع نسخة الضيف الحالية لتصبح بيانات الحساب من الآن فصاعداً
            overlay.remove();
            debouncedSync();
            resolve();
        };
        overlay.querySelector("#load-account-btn").onclick = () => {
            applyRemoteSnapshot(remoteSnapshot);
            overlay.remove();
            resolve();
        };
    });
}

const FOCUS_QUOTES = [
    { ar:"النجاح هو محصلة تحضير، واجتهاد، وتعلّم من الفشل.", en:"Success is where preparation and opportunity meet.", authorAr:"كولن باول", authorEn:"Colin Powell" },
    { ar:"لا تنتظر اللحظة المثالية، خذ اللحظة واجعلها مثالية.", en:"Don't wait for the perfect moment, take the moment and make it perfect.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"كل دقيقة تركيز الآن، خطوة أقرب لجامعتك.", en:"Every focused minute now is a step closer to your university.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"من جدّ وجد، ومن زرع حصد.", en:"Whoever strives, finds; whoever sows, reaps.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"العلم في الصغر كالنقش على الحجر.", en:"Learning in youth is like carving into stone — it lasts.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"لست بحاجة لأن تكون رائعاً لتبدأ، لكن عليك أن تبدأ لتصبح رائعاً.", en:"You don't have to be great to start, but you have to start to be great.", authorAr:"زيغ زيغلر", authorEn:"Zig Ziglar" },
    { ar:"الفرق بين المستحيل والممكن يكمن في إصرار الإنسان.", en:"The difference between impossible and possible lies in a person's determination.", authorAr:"توماس أديسون", authorEn:"Thomas Edison" },
    { ar:"لا يهم مدى بطء تقدّمك، طالما أنك لا تتوقف.", en:"It does not matter how slowly you go, as long as you do not stop.", authorAr:"كونفوشيوس", authorEn:"Confucius" },
    { ar:"العقل الذي ينفتح على فكرة جديدة لن يعود لحجمه القديم أبداً.", en:"A mind stretched by a new idea never returns to its original size.", authorAr:"أوليفر هولمز", authorEn:"Oliver Wendell Holmes" },
    { ar:"لا تقس يومك بالمحصول الذي تجنيه، بل بالبذور التي تزرعها.", en:"Don't judge each day by the harvest you reap, but by the seeds you plant.", authorAr:"روبرت لويس ستيفنسون", authorEn:"Robert Louis Stevenson" },
    { ar:"التميّز ليس فعلاً، بل عادة.", en:"Excellence is not an act, but a habit.", authorAr:"أرسطو", authorEn:"Aristotle" },
    { ar:"ابدأ من حيث أنت، استخدم ما لديك، وافعل ما تستطيع.", en:"Start where you are, use what you have, do what you can.", authorAr:"آرثر آش", authorEn:"Arthur Ashe" },
    { ar:"الطريق إلى النجاح دائماً قيد الإنشاء.", en:"The road to success is always under construction.", authorAr:"ليلي توملين", authorEn:"Lily Tomlin" },
    { ar:"لا يوجد مصعد للنجاح، عليك أخذ السلالم.", en:"There's no elevator to success — you have to take the stairs.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"ثق بنفسك، وستعرف كيف تعيش.", en:"Trust yourself, and you will know how to live.", authorAr:"غوته", authorEn:"Goethe" },
    { ar:"من سار على الدرب وصل.", en:"Whoever walks the path arrives.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"النجاح هو أن تنتقل من فشل إلى فشل دون أن تفقد الحماس.", en:"Success is walking from failure to failure with no loss of enthusiasm.", authorAr:"ونستون تشرشل", authorEn:"Winston Churchill" },
    { ar:"لن تكسب المعركة إن لم تخض القتال.", en:"You can't win the battle if you don't fight it.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الإصرار هو الطريق السحري للنجاح.", en:"Persistence is the magic word for success.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"ركّز على الرحلة، لا الوجهة فقط — كل جلسة اليوم تبني غدك.", en:"Focus on the journey, not just the destination — every session today builds your tomorrow.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"العمل الجاد يتغلّب على الموهبة حين لا تعمل الموهبة بجد.", en:"Hard work beats talent when talent doesn't work hard.", authorAr:"تيم نوتك", authorEn:"Tim Notke" },
    { ar:"كل خبير كان يوماً مبتدئاً.", en:"Every expert was once a beginner.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الصبر مفتاح الفرج.", en:"Patience is the key to relief.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"لا تقارن بدايتك بمنتصف رحلة غيرك.", en:"Don't compare your beginning to someone else's middle.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الوقت الذي تستمتع فيه بإضاعته ليس وقتاً ضائعاً — لكن وقت المذاكرة استثمار لا يضيع أبداً.", en:"Time you enjoy wasting isn't wasted time — but study time is an investment that never is.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"من يرد الحياة يستجب لها.", en:"Whoever wants life must answer its call.", authorAr:"أبو القاسم الشابي", authorEn:"Abu al-Qasim al-Shabbi" },
    { ar:"النجاح رحلة، لا وجهة.", en:"Success is a journey, not a destination.", authorAr:"آرثر آش", authorEn:"Arthur Ashe" },
    { ar:"من يخطط لهدفه يقترب منه كل يوم، ومن لا يخطط يبقى في مكانه.", en:"Those who plan for their goal move closer daily; those who don't stay in place.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"القراءة اليوم، القيادة غداً.", en:"Reading today, leading tomorrow.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"أعظم إنجاز هو ألا تفشل أبداً، بل أن تنهض في كل مرة تسقط فيها.", en:"Our greatest glory is not in never failing, but in rising every time we fall.", authorAr:"كونفوشيوس", authorEn:"Confucius" },
    { ar:"العقول العظيمة تناقش الأفكار، والعقول المتوسطة تناقش الأحداث.", en:"Great minds discuss ideas; average minds discuss events.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"من طلب العلا سهر الليالي.", en:"Whoever seeks greatness stays up through the nights.", authorAr:"المتنبي", authorEn:"Al-Mutanabbi" },
];

/* يُعيد توجيه الزر داخل وضع التركيز لنفس أزرار لوحة التحكم تماماً —
   لا تكرار لمنطق الجلسة، فقط "نقرة بالنيابة" لتفادي أي احتمال تعارض حالة */
function focusModeStartOrPause(){
    const pauseBtn = document.getElementById("pause-btn");
    if(pauseBtn.disabled){
        document.getElementById("btn-plan-session").click();
    } else {
        pauseBtn.click();
    }
}

function toggleFocusThemePicker(){
    const picker = document.getElementById("focus-theme-picker");
    picker.style.display = "";  // التحكم بالظهور صار عبر فئة .open (انزلاق جانبي بأنيميشن)
    picker.classList.toggle("open");
}

/* ============================================================
   39) خلفية وضع التركيز الحية — كانفس متحرك ذاتياً باستمرار
   (كتل ضوئية متوهجة تنجرف ببطء + نجوم متلألئة لثيمات مختارة)،
   وتتفاعل بخفة مع موضع الماوس (parallax) دون أن تتوقف الحركة
   الذاتية أبداً حتى مع سكون الماوس تماماً.
   ============================================================ */
const FOCUS_THEME_PRESETS = {
    night:  { base:["#0d0620","#1a0f35","#120a28"], stars:true, blobs:[
        {x:0.3,y:0.3,r:260,color:"124,92,191",drift:22,speed:0.00018,phase:0},
        {x:0.7,y:0.25,r:220,color:"201,150,46",drift:18,speed:0.00022,phase:2},
        {x:0.5,y:0.72,r:300,color:"70,40,130",drift:26,speed:0.00015,phase:4},
        {x:0.18,y:0.7,r:180,color:"94,92,191",drift:20,speed:0.0002,phase:1},
    ]},
    forest: { base:["#0a1f16","#0d2a1c","#081810"], stars:false, blobs:[
        {x:0.3,y:0.28,r:260,color:"94,214,183",drift:20,speed:0.0002,phase:0},
        {x:0.72,y:0.6,r:240,color:"46,120,80",drift:24,speed:0.00017,phase:3},
        {x:0.5,y:0.2,r:200,color:"150,214,120",drift:18,speed:0.00023,phase:1},
    ]},
    sunset: { base:["#2a1030","#5a1f35","#7a3020"], stars:false, blobs:[
        {x:0.5,y:0.55,r:300,color:"253,187,110",drift:16,speed:0.0002,phase:0},
        {x:0.25,y:0.3,r:220,color:"161,58,74",drift:22,speed:0.00018,phase:2},
        {x:0.75,y:0.35,r:200,color:"217,113,63",drift:18,speed:0.00021,phase:4},
    ]},
    desk:   { base:["#1a1408","#241a0a","#0d0904"], stars:false, blobs:[
        {x:0.5,y:0.35,r:280,color:"255,233,176",drift:14,speed:0.00019,phase:0},
        {x:0.7,y:0.6,r:200,color:"201,150,46",drift:18,speed:0.00022,phase:2},
    ]},
    ocean:  { base:["#050a1a","#0a1a33","#123152"], stars:true, blobs:[
        {x:0.5,y:0.25,r:260,color:"220,232,255",drift:16,speed:0.0002,phase:0},
        {x:0.3,y:0.62,r:240,color:"127,166,242",drift:22,speed:0.00017,phase:3},
        {x:0.72,y:0.72,r:220,color:"46,107,224",drift:20,speed:0.00019,phase:1},
    ]},
    dawn:   { base:["#2a1735","#4a2050","#8a4a6a"], stars:false, blobs:[
        {x:0.5,y:0.7,r:300,color:"255,217,194",drift:16,speed:0.0002,phase:0},
        {x:0.25,y:0.35,r:220,color:"224,147,171",drift:20,speed:0.00021,phase:2},
        {x:0.75,y:0.3,r:200,color:"180,155,224",drift:18,speed:0.00023,phase:4},
    ]},
};

let focusCanvasCtx = null;
let focusCanvasAnimId = null;
let focusLastFrameTime = null;
let focusMouseX = 0.5, focusMouseY = 0.5;
let focusMouseXSmooth = 0.5, focusMouseYSmooth = 0.5;
let focusStars = [];

function resizeFocusCanvas(){
    const canvas = document.getElementById("focus-canvas-bg");
    if(!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
function handleFocusMouseMove(e){
    focusMouseX = e.clientX / window.innerWidth;
    focusMouseY = e.clientY / window.innerHeight;
    const glow = document.getElementById("focus-cursor-glow");
    if(glow){
        glow.style.opacity = "1";
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
}
function handleFocusMouseLeave(){
    const glow = document.getElementById("focus-cursor-glow");
    if(glow) glow.style.opacity = "0";
}
function generateFocusStars(){
    focusStars = [];
    for(let i = 0; i < 55; i++){
        // انجراف ذاتي بطيء جداً بحدود ~0.1px/ثانية لكل نجمة، بزاوية عشوائية —
        // يجعل الخلفية "حيّة" مع الوقت بدل السكون التام (يبقى غير محسوس
        // خلال ثوانٍ قليلة لكنه واضح على مدى جلسة تركيز كاملة)
        const angle = Math.random() * Math.PI * 2;
        const speedPxPerSec = 0.05 + Math.random() * 0.1;
        focusStars.push({
            x:Math.random(), y:Math.random(), r:Math.random()*1.3+0.4,
            phase:Math.random()*Math.PI*2, speed:Math.random()*0.001+0.0006,
            vx: Math.cos(angle) * speedPxPerSec, vy: Math.sin(angle) * speedPxPerSec,
        });
    }
}
function renderFocusCanvasFrame(time){
    const canvas = document.getElementById("focus-canvas-bg");
    const overlay = document.getElementById("focus-mode-overlay");
    if(!canvas || !focusCanvasCtx || !overlay) return;
    const ctx = focusCanvasCtx;
    const w = canvas.width, h = canvas.height;
    const theme = FOCUS_THEME_PRESETS[overlay.dataset.bgTheme] || FOCUS_THEME_PRESETS.night;

    // دلتا الوقت بين الإطارين بالثواني — أساس حساب الانجراف البطيء جداً
    // للنجوم بوحدة px/ثانية حقيقية بمعزل عن معدل تحديث الشاشة (fps)
    const dt = focusLastFrameTime ? Math.min((time - focusLastFrameTime) / 1000, 0.25) : 0;
    focusLastFrameTime = time;

    focusMouseXSmooth += (focusMouseX - focusMouseXSmooth) * 0.03;
    focusMouseYSmooth += (focusMouseY - focusMouseYSmooth) * 0.03;
    const parallaxX = (focusMouseXSmooth - 0.5) * 60;
    const parallaxY = (focusMouseYSmooth - 0.5) * 40;

    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, theme.base[0]);
    baseGrad.addColorStop(0.5, theme.base[1]);
    baseGrad.addColorStop(1, theme.base[2]);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    if(theme.stars){
        focusStars.forEach(s => {
            // انجراف بطيء جداً مع التفاف حول الحواف — px/ثانية محوَّلة لنسبة
            // من أبعاد الكانفس الفعلية بما أن إحداثيات النجوم مخزَّنة كنسبة (0-1)
            if(dt > 0){
                s.x += (s.vx * dt) / w;
                s.y += (s.vy * dt) / h;
                if(s.x < -0.02) s.x += 1.04; else if(s.x > 1.02) s.x -= 1.04;
                if(s.y < -0.02) s.y += 1.04; else if(s.y > 1.02) s.y -= 1.04;
            }
            const twinkle = Math.max(0, 0.4 + Math.sin(time * s.speed + s.phase) * 0.35);
            ctx.beginPath();
            ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
            ctx.fill();
        });
    }

    theme.blobs.forEach((b, i) => {
        const driftX = Math.sin(time * b.speed + b.phase) * b.drift;
        const driftY = Math.cos(time * b.speed * 0.8 + b.phase) * b.drift * 0.6;
        const depthFactor = 0.5 + (i % 3) * 0.3;
        const x = b.x * w + driftX + parallaxX * depthFactor;
        const y = b.y * h + driftY + parallaxY * depthFactor;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        grad.addColorStop(0, `rgba(${b.color},0.32)`);
        grad.addColorStop(1, `rgba(${b.color},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    });
}
/* محرّك الحلقة منفصل تماماً عن دالة الرسم — يعتمد على علم boolean صريح
   (وليس على قراءة overlay.style.display في كل إطار)، لتفادي أي هشاشة إن
   لمس كود آخر تلك الخاصية لأي سبب مستقبلاً */
let focusCanvasActive = false;
function focusCanvasTick(time){
    if(!focusCanvasActive){ focusCanvasAnimId = null; return; }
    renderFocusCanvasFrame(time);
    focusCanvasAnimId = requestAnimationFrame(focusCanvasTick);
}
function startFocusCanvasBg(){
    if(window.innerWidth <= 700) return; // للكمبيوتر فقط — الهاتف يستخدم الخلفية الثابتة الخفيفة
    const canvas = document.getElementById("focus-canvas-bg");
    if(!canvas) return;
    focusCanvasCtx = canvas.getContext("2d");
    resizeFocusCanvas();
    generateFocusStars();
    focusLastFrameTime = null; // نتفادى قفزة دلتا-وقت ضخمة عند إعادة تشغيل الحلقة بعد إيقاف مؤقّت
    document.getElementById("focus-mode-overlay").addEventListener("mousemove", handleFocusMouseMove);
    document.getElementById("focus-mode-overlay").addEventListener("mouseleave", handleFocusMouseLeave);
    focusCanvasActive = true;
    if(!focusCanvasAnimId) focusCanvasAnimId = requestAnimationFrame(focusCanvasTick);
}
function stopFocusCanvasBg(){
    focusCanvasActive = false;
    if(focusCanvasAnimId){ cancelAnimationFrame(focusCanvasAnimId); focusCanvasAnimId = null; }
    document.getElementById("focus-mode-overlay").removeEventListener("mousemove", handleFocusMouseMove);
    document.getElementById("focus-mode-overlay").removeEventListener("mouseleave", handleFocusMouseLeave);
    const glow = document.getElementById("focus-cursor-glow");
    if(glow) glow.style.opacity = "0";
}
// انعكاس الكرة الزجاجية يتبع الفأرة فعلياً: نحوّل موضع الفأرة داخل مربّع
// الكرة إلى إزاحة صغيرة (px) عبر متغيّرين CSS مخصَّصين يقرأهما ::after في
// تعريف .focus-timer-ring-wrap — بلا أي رسم Canvas إضافي، مجرّد CSS حي
function handleOrbShineMove(e){
    const wrap = document.getElementById("focus-timer-ring-wrap");
    if(!wrap) return;
    const r = wrap.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return;
    const relX = (e.clientX - r.left) / r.width - 0.5;  // -0.5..0.5
    const relY = (e.clientY - r.top) / r.height - 0.5;
    const maxOffsetPx = 26;
    wrap.style.setProperty("--shine-x", (relX * maxOffsetPx * 2).toFixed(1) + "px");
    wrap.style.setProperty("--shine-y", (relY * maxOffsetPx * 2).toFixed(1) + "px");
    wrap.classList.add("shine-tracking");
}
function resetOrbShine(){
    const wrap = document.getElementById("focus-timer-ring-wrap");
    if(!wrap) return;
    wrap.style.removeProperty("--shine-x");
    wrap.style.removeProperty("--shine-y");
    wrap.classList.remove("shine-tracking");
}
window.addEventListener("resize", resizeFocusCanvas);
document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".focus-theme-picker-wrap");
    const picker = document.getElementById("focus-theme-picker");
    if(wrap && picker && picker.style.display !== "none" && !wrap.contains(e.target)){
        picker.style.display = "none";
    }
});
function setFocusBgTheme(theme){
    document.getElementById("focus-mode-overlay").dataset.bgTheme = theme;
    localStorage.setItem("khuta_focus_bg_theme", theme);
    document.querySelectorAll(".focus-theme-swatch").forEach(el => el.classList.toggle("active", el.dataset.theme === theme));
    const _picker = document.getElementById("focus-theme-picker");
    _picker.style.display = ""; _picker.classList.remove("open");
}

let currentFocusQuote = null;

function openFocusMode(){
    const overlay = document.getElementById("focus-mode-overlay");
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const savedTheme = localStorage.getItem("khuta_focus_bg_theme") || "night";
    overlay.dataset.bgTheme = savedTheme;
    document.querySelectorAll(".focus-theme-swatch").forEach(el => el.classList.toggle("active", el.dataset.theme === savedTheme));
    startFocusCanvasBg();

    // تحديث فوري لكل بيانات الشريط العائم (الصورة، الاسم، XP، السلسلة،
    // الإشعارات) عند فتح وضع التركيز — لا ننتظر التحديث الدوري التالي
    renderHeaderMiniAvatar();
    updateWelcomeText();
    renderGamification();
    renderNotificationBell();

    // نصيحة ثابتة طوال الجلسة الحالية — تُختار مرة واحدة عند بدء الجلسة (startMainSession)،
    // وهنا فقط نعرضها؛ إن فُتح وضع التركيز دون جلسة نشطة بعد، نختار واحدة بشكل استثنائي
    if(!currentFocusQuote) currentFocusQuote = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
    document.getElementById("focus-quote-text").textContent = `"${currentLang==='ar' ? currentFocusQuote.ar : currentFocusQuote.en}"`;
    document.getElementById("focus-quote-author").textContent = "— " + (currentLang==='ar' ? currentFocusQuote.authorAr : currentFocusQuote.authorEn);

    const taskCard = document.getElementById("focus-task-card");
    const rows = document.querySelectorAll("#schedule-body tr[data-task-id]");
    if(rows.length){
        const statuses = getTaskStatuses();
        taskCard.style.display = "block";
        document.getElementById("focus-task-count").textContent = rows.length;
        document.getElementById("focus-task-list").innerHTML = Array.from(rows).map(row => {
            const id = row.dataset.taskId;
            const status = statuses[id] || "notstarted";
            const titleInput = row.querySelector(".task-path-cell .task-input");
            const title = titleInput ? titleInput.value : id;
            return `<div class="focus-task-row ${status==='done'?'done':status==='inprogress'?'inprogress':''}">
                <div class="ftr-check"><i class="fa-solid fa-check"></i></div>
                <span>${escapeHtml(title)}</span>
            </div>`;
        }).join("");
    } else {
        taskCard.style.display = "none";
    }
    updateMainDisplay(); // مزامنة فورية عند الفتح، دون انتظار التحديث التالي كل ثانية
}

function closeFocusMode(){
    document.getElementById("focus-mode-overlay").style.display = "none";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    stopFocusCanvasBg();
}

function shuffleArray(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* يبني مجموعة أسئلة الاختبار — يتكيّف تلقائياً مع حجم بنك الأسئلة الفعلي
   المتاح (حالياً أمثلة قليلة فقط)، فلا يُكرر نفس السؤال أبداً داخل اختبار واحد */
function buildExamQuestionSet(examType){
    const pool = getExamQuestions();
    const quantPool = shuffleArray(pool.quant || []);
    const verbalPool = shuffleArray(pool.verbal || []);

    if(examType === "verbal"){
        return { sections:[{ quant:[], verbal:verbalPool }], scaledDown: false };
    }
    if(examType === "quant"){
        return { sections:[{ quant:quantPool, verbal:[] }], scaledDown: false };
    }

    // "full": توزيع عشوائي 65/55 أو 55/65 — يتحدَّد مرة واحدة لكل محاولة اختبار
    const quantFirst = Math.random() < 0.5;
    let targetQuant = quantFirst ? 65 : 55;
    let targetVerbal = quantFirst ? 55 : 65;

    // تكيّف مع حجم البنك الفعلي المتاح حالياً — لا تكرار لنفس السؤال إطلاقاً
    const availableQuant = Math.min(targetQuant, quantPool.length);
    const availableVerbal = Math.min(targetVerbal, verbalPool.length);
    const scaledDown = (availableQuant < targetQuant) || (availableVerbal < targetVerbal);

    const sections = splitIntoSections(quantPool.slice(0, availableQuant), verbalPool.slice(0, availableVerbal), EXAM_SECTION_COUNT);
    return { sections, scaledDown, quantFirst };
}

function loadProfileForm(){
    document.getElementById("prof-name").value = localStorage.getItem("khuta_name") || "";
    document.getElementById("prof-last").value = localStorage.getItem("khuta_last") || "";
    document.getElementById("prof-birth").value = localStorage.getItem("khuta_birth") || "";
    document.getElementById("prof-gender").value = localStorage.getItem("khuta_gender") || "male";
    document.getElementById("prof-track").value = localStorage.getItem("khuta_track") || "science";
    document.getElementById("prof-goal-score").value = localStorage.getItem("khuta_goal_score") || "";
    document.getElementById("prof-exam-date").value = localStorage.getItem("khuta_exam_date") || "";

    renderAvatarDisplay();
    updateProfileHeader();
    renderFrameShop();
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
        localStorage.removeItem("khuta_avatar_preset"); // الصورة المرفوعة والرمز الجاهز لا يجتمعان معاً
        renderAvatarDisplay();
        debouncedSync();
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
    const username = document.getElementById("forgot-username-input").value.trim();
    if(!username){
        showToast(currentLang==='ar' ? "أدخل اسم المستخدم" : "Enter your username");
        return;
    }
    const resolvedEmail = await resolveUsernameEmail(username);
    // إن كان البريد المُحلَّل مطابقاً تماماً للبريد المصطنع، فهذا يعني أن
    // هذا الحساب لم يربط بريداً حقيقياً بعد (لا فرق هنا بين "حساب غير
    // موجود" و"حساب موجود بلا بريد مرتبط" — عمداً، لعدم كشف أي حساب فعلي)
    if(resolvedEmail === usernameToEmail(username)){
        document.getElementById("forgot-username-input").value = "";
        document.getElementById("forgot-password-form").style.display = "none";
        showToast(currentLang==='ar'
            ? "📧 إن وُجد هذا الحساب وربط بريداً حقيقياً من قبل، وصلته رسالة إعادة التعيين. إن لم يصلك شيء، سجّل الدخول واربط بريداً من ملفك الشخصي أولاً."
            : "📧 If this account exists and previously linked a real email, a reset message was sent. If nothing arrives, sign in and link an email from your profile first.");
        return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(resolvedEmail, { redirectTo: window.location.href.split("#")[0] });
    document.getElementById("forgot-username-input").value = "";
    document.getElementById("forgot-password-form").style.display = "none";
    showToast(currentLang==='ar'
        ? "📧 وصلتك رسالة إعادة تعيين كلمة المرور على بريدك المرتبط."
        : "📧 A password reset message was sent to your linked email.");
    if(error) console.error("[خُطى] استجابة resetPasswordForEmail:", error);
}

function loginScreenSignIn(){
    if(loginSignupMode){
        signUpWithCreds("login-username", "login-password", "login-password2", true, "login-email");
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
        setTimeout(startOnboardingTour, 900);
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
    });
}

function usernameToEmail(username){
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    return `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

// يحدّد البريد الفعلي المرتبط باسم مستخدم عبر جدول username_lookup (يُزامَن
// تلقائياً من الخادم — انظر SUPABASE_MIGRATION_password_recovery.sql).
// نرجع للبريد المصطنع فقط إن لم يوجد صف بعد (حساب أُنشئ قبل هذا الإصلاح
// ولم يُسجَّل دخول أو يُحدَّث منذ تشغيل الترحيل) — يحافظ هذا على عمل تسجيل
// الدخول لكل الحسابات القديمة بلا استثناء، مع تفعيل الاسترجاع الحقيقي
// تلقائياً لأي حساب دخل جدول username_lookup (كل حساب جديد، وأي حساب قديم
// بعد أول تسجيل دخول ناجح له بفضل تعبئة الترحيل الرجعية)
async function resolveUsernameEmail(username){
    if(!sb) return usernameToEmail(username);
    try{
        // مطابقة غير حساسة لحالة الأحرف عمداً: user_data.username يُخزَّن
        // بحالة الأحرف الأصلية كما كتبها الطالب، لكن تسجيل الدخول كان دائماً
        // غير حساس لحالة الأحرف ضمنياً (usernameToEmail تصغّر الأحرف قبل بناء
        // البريد المصطنع) — .ilike تحافظ على هذا السلوك بالضبط فلا ينكسر
        // الدخول لأي حساب قائم بسبب اختلاف طفيف في حالة الأحرف
        const { data } = await sb.from("username_lookup").select("email").ilike("username", username.trim()).maybeSingle();
        if(data && data.email) return data.email;
    }catch(e){ /* الجدول قد لا يكون منشأً بعد على مواقع لم تُشغّل الترحيل — نتجاهل بصمت */ }
    return usernameToEmail(username);
}

function getSession(){ try{ return JSON.parse(localStorage.getItem("khuta_session")) || null; }catch(e){ return null; } }

// يرسل نتيجة الاختبار الكامل بالبريد — فقط إن كان هناك جلسة Supabase حقيقية
// (يتحقق الخادم من كون البريد المرتبط حقيقياً فعلاً، هذا مجرد استدعاء أولي)
/* ============================================================
   نظام الموافقة على الرسائل + المستندات القانونية
   ------------------------------------------------------------
   الموافقة تُحفظ في user_data (المزامَن مع الحساب) لا في localStorage فقط —
   حتى تبقى صحيحة عبر أجهزة الطالب كلها، ولأن الوظيفة المجدولة على الخادم
   ستحتاج قراءتها لاحقاً لتقرير من يستحق رسالة تذكيرية.
   ============================================================ */
async function updateMarketingConsent(consented){
    try{
        localStorage.setItem("khuta_marketing_consent", consented ? "1" : "0");
        localStorage.setItem("khuta_consent_asked", "1");
        const session = getSession();
        if(sb && session && session.uid){
            await sb.from("user_data").update({ marketing_consent: !!consented }).eq("id", session.uid);
        }
        showToast(consented
            ? labT("👍 تمام — نرسل لك أحياناً تذكيراً بسيطاً","👍 Got it — we'll send occasional reminders")
            : labT("✅ ما راح نرسل لك أي رسائل تذكيرية","✅ We won't send you any reminder emails"));
    }catch(e){
        console.error("[خُطى] تعذّر حفظ تفضيل الرسائل:", e);
    }
}

function respondToConsentPrompt(consented){
    document.getElementById("consent-prompt-modal").style.display = "none";
    document.body.style.overflow = "";
    updateMarketingConsent(consented);
}

// يسأل الحسابات القائمة (التي لديها بريد حقيقي مرتبط) مرة واحدة فقط
async function maybeAskForMarketingConsent(){
    try{
        if(localStorage.getItem("khuta_consent_asked") === "1") return; // سُئل من قبل، لا نكرر أبداً
        const session = getSession();
        if(!sb || !session || !session.username) return;
        const { data } = await sb.auth.getUser();
        const email = data && data.user && data.user.email;
        if(!email) return;
        // لا نسأل إلا من ربط بريداً حقيقياً فعلاً — سؤال من لا بريد له بلا معنى
        const clean = session.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
        if(email.toLowerCase() === `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`) return;
        document.getElementById("consent-prompt-modal").style.display = "flex";
        document.body.style.overflow = "hidden";
    }catch(e){ /* لا نُزعج الطالب بأي خطأ هنا — الميزة ثانوية بالكامل */ }
}

function renderPrivacyCard(){
    const row = document.getElementById("profile-marketing-row");
    const note = document.getElementById("profile-marketing-note");
    const box = document.getElementById("profile-marketing-consent");
    if(!row || !box) return;
    const session = getSession();
    if(!session){
        row.style.display = "none";
        note.style.display = "block";
        note.textContent = labT("سجّل دخولك أولاً للتحكم بتفضيلات الرسائل.","Sign in first to manage email preferences.");
        return;
    }
    row.style.display = "flex";
    note.style.display = "none";
    box.checked = localStorage.getItem("khuta_marketing_consent") === "1";
}

const LEGAL_DOCS = {
    terms: {
        titleAr: "شروط الاستخدام", titleEn: "Terms of Use",
        bodyAr: `
            <h3>١. طبيعة الخدمة</h3>
            <p>خُطى أداة مساعدة لتنظيم مذاكرة اختبار القدرات العامة (GAT). التطبيق <b>غير تابع لهيئة تقويم التعليم والتدريب (قياس)</b> ولا لأي جهة رسمية، ولا يمثّلها بأي شكل.</p>
            <h3>٢. دقة المحتوى</h3>
            <p>بيانات الجامعات وأوزان النسب الموزونة ومتطلبات القبول تقريبية وقد تتغيّر. <b>تحقّق دائماً من الموقع الرسمي للجامعة</b> قبل اتخاذ أي قرار فعلي. الاختبارات المحاكية والأسئلة هي للتدريب فقط ولا تعكس الاختبار الحقيقي حرفياً.</p>
            <h3>٣. الذكاء الاصطناعي</h3>
            <p>المساعد الذكي أداة مساعدة قد تُخطئ. لا تعتمد على إجاباته وحدها في قرار مصيري، وراجع دائماً مصادرك الدراسية الأساسية.</p>
            <h3>٤. حسابك</h3>
            <p>أنت مسؤول عن الحفاظ على كلمة مرورك. التطبيق يعمل كاملاً بدون حساب (كضيف)، والحساب اختياري لمزامنة تقدّمك بين أجهزتك فقط.</p>
            <h3>٥. الاستخدام المقبول</h3>
            <p>يُمنع استخدام التطبيق لأي غرض غير قانوني، أو محاولة تعطيله، أو إساءة استخدام مواردة (مثل الإكثار المتعمّد من طلبات الذكاء الاصطناعي).</p>
            <h3>٦. التغييرات</h3>
            <p>قد تُحدَّث هذه الشروط مع تطوّر التطبيق. استمرارك في الاستخدام يعني موافقتك على النسخة المحدّثة.</p>`,
        bodyEn: `
            <h3>1. Nature of the service</h3>
            <p>Khuta is a study-organization tool for the Saudi GAT exam. It is <b>not affiliated with Qiyas (ETEC)</b> or any official body.</p>
            <h3>2. Content accuracy</h3>
            <p>University data, weighted-score formulas, and admission requirements are approximate and subject to change. <b>Always verify with the university's official website.</b> Practice exams are for training only.</p>
            <h3>3. AI assistant</h3>
            <p>The AI assistant may make mistakes. Don't rely on it alone for important decisions.</p>
            <h3>4. Your account</h3>
            <p>You are responsible for your password. The app works fully without an account; accounts are optional and only sync progress across devices.</p>
            <h3>5. Acceptable use</h3>
            <p>Don't use the app for unlawful purposes, attempt to disrupt it, or abuse its resources.</p>
            <h3>6. Changes</h3>
            <p>These terms may be updated as the app evolves.</p>`,
    },
    privacy: {
        titleAr: "سياسة الخصوصية", titleEn: "Privacy Policy",
        bodyAr: `
            <h3>ما الذي نجمعه فعلاً؟</h3>
            <p><b>إن استخدمت التطبيق كضيف (بدون حساب):</b> لا نجمع عنك شيئاً إطلاقاً على خوادمنا. كل بياناتك (خطتك، تقدّمك، ملاحظاتك) محفوظة <b>داخل متصفحك أنت فقط</b> ولا تغادر جهازك.</p>
            <p><b>إن أنشأت حساباً:</b> نحفظ اسم المستخدم، وكلمة مرور مشفّرة (لا نراها إطلاقاً)، وبيانات تقدّمك الدراسي (خطتك، ساعات مذاكرتك، نقاط الخبرة، نتائج اختباراتك) لمزامنتها بين أجهزتك.</p>
            <p><b>البريد الإلكتروني اختياري بالكامل.</b> نستخدمه فقط لاسترجاع كلمة المرور، ولإرسال نتيجة اختبارك المحاكي، وللرسائل التذكيرية <b>إن وافقت عليها صراحةً فقط</b>.</p>
            <h3>ما الذي لا نجمعه أبداً</h3>
            <p>لا نجمع اسمك الحقيقي، ولا رقم هويتك، ولا رقم جوالك، ولا موقعك الجغرافي، ولا نبيع بياناتك لأي جهة إطلاقاً.</p>
            <h3>خدمات خارجية نستخدمها</h3>
            <p>Supabase (تخزين الحسابات والبيانات)، Netlify (استضافة الموقع)، Google Gemini (المساعد الذكي — تُرسَل أسئلتك له لتوليد الإجابة)، Brevo (إرسال البريد فقط لمن ربط بريده).</p>
            <h3>حقوقك</h3>
            <p>تقدر تحذف حسابك وكل بياناته في أي وقت من ملفك الشخصي. تقدر توقف الرسائل التذكيرية في أي لحظة. تقدر تستخدم التطبيق كاملاً بدون أي حساب من الأساس.</p>`,
        bodyEn: `
            <h3>What we actually collect</h3>
            <p><b>As a guest (no account):</b> nothing at all reaches our servers. All your data stays in your own browser.</p>
            <p><b>With an account:</b> username, an encrypted password (never visible to us), and your study progress, to sync across your devices.</p>
            <p><b>Email is fully optional</b> — used only for password recovery, exam results, and reminders <b>only if you explicitly consent</b>.</p>
            <h3>What we never collect</h3>
            <p>No real name, national ID, phone number, or location. We never sell your data.</p>
            <h3>Third-party services</h3>
            <p>Supabase (accounts/data), Netlify (hosting), Google Gemini (AI assistant), Brevo (email delivery only).</p>
            <h3>Your rights</h3>
            <p>Delete your account and all data anytime from your profile. Stop reminder emails anytime. Use the app fully without an account.</p>`,
    },
};

function openLegalModal(kind){
    const doc = LEGAL_DOCS[kind];
    if(!doc) return;
    document.getElementById("legal-modal-title").textContent = currentLang==='ar' ? doc.titleAr : doc.titleEn;
    document.getElementById("legal-modal-body").innerHTML = currentLang==='ar' ? doc.bodyAr : doc.bodyEn;
    labOverlayOpen("legal-modal");
}
function closeLegalModal(){ labOverlayClose("legal-modal"); }

async function sendExamScoreEmail(score){
    try{
        if(!sb) return;
        const { data } = await sb.auth.getSession();
        const accessToken = data && data.session && data.session.access_token;
        if(!accessToken) return; // ضيف بلا حساب فعلي
        const session = getSession();
        await fetch("/.netlify/functions/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "examScore",
                accessToken,
                username: session ? session.username : null,
                score: score.correctCount, total: score.total,
                examTypeLabel: "full",
            }),
        });
    }catch(e){
        console.error("[خُطى] تعذّر إرسال بريد النتيجة (لا يؤثر على تجربة الطالب):", e);
    }
}

let manualAuthInProgress = false; // يمنع ازدواجية معالجة نفس حدث تسجيل الدخول بين signInWithCreds/signUpWithCreds والمستمع العام

function setSession(s){
    localStorage.setItem("khuta_session", JSON.stringify(s));
    // شبكة أمان: تأكد أن khuta_name معبّأ دائماً أيضاً — إن اختفت الجلسة لأي
    // سبب مستقبلاً، يبقى الطالب "معروفاً" محلياً بدل أن يُعامَل كزائر جديد بالكامل
    if(!localStorage.getItem("khuta_name") && s.username) localStorage.setItem("khuta_name", s.username);
}
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
async function signUpAccount(){ return signUpWithCreds("acc-username", "acc-password", "acc-password2", false, "acc-email"); }

async function signUpWithCreds(userId, passId, pass2Id, fromLoginScreen, emailId){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable right now"); return; }
    const username = document.getElementById(userId).value.trim();
    const pass = document.getElementById(passId).value;
    const pass2 = document.getElementById(pass2Id).value;
    const realEmailInput = emailId ? document.getElementById(emailId) : null;
    const realEmail = realEmailInput ? realEmailInput.value.trim() : "";
    if(username.length < 3){ hapticError(); showToast(currentLang==='ar' ? "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" : "Username must be at least 3 characters"); return; }
    if(pass.length < 6){ hapticError(); showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(pass !== pass2){ hapticError(); showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    if(realEmail && !realEmail.includes("@")){ showToast(currentLang==='ar' ? "البريد المدخل غير صالح — اتركه فارغاً إن أردت المتابعة بدونه" : "Invalid email — leave it blank to continue without one"); return; }

    setAccountBusy(true);
    manualAuthInProgress = true;
    // إن أدخل الطالب بريداً حقيقياً، يصبح هو هوية الحساب الفعلية في Supabase
    // منذ التسجيل (فيعمل استرجاع كلمة المرور فوراً بلا خطوة إضافية لاحقاً).
    // إن تركه فارغاً، السلوك القديم تماماً بلا أي تغيير: بريد مصطنع داخلي،
    // ولا يُطلب بريد حقيقي إطلاقاً — نفس فلسفة الخصوصية الأصلية للموقع.
    const email = realEmail || usernameToEmail(username);
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if(error){
        manualAuthInProgress = false;
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
        // نلتقط موافقة الرسائل من نفس النموذج (غير مفعّلة افتراضياً — موافقة
        // حقيقية لا مفروضة)، ونعتبر الطالب "سُئل" فلا تظهر له نافذة السؤال لاحقاً
        const consentBox = document.getElementById(fromLoginScreen ? "login-marketing-consent" : "acc-marketing-consent");
        const consented = !!(consentBox && consentBox.checked && realEmail);
        localStorage.setItem("khuta_marketing_consent", consented ? "1" : "0");
        localStorage.setItem("khuta_consent_asked", "1");
        await sb.from("user_data").insert({ id: uid, username, data: collectLocalSnapshot(), marketing_consent: consented });
        setSession({ uid, username });
        recordPendingReferral(uid);
    }
    setAccountBusy(false);

    if(!data.session){
        // Supabase لم يُرجع جلسة فورية — يعني "Confirm email" لا يزال مفعّلاً، وهذا الحساب
        // لن يعمل لتسجيل الدخول لاحقاً لأن بريد التأكيد يذهب لعنوان وهمي لا يملكه الطالب.
        manualAuthInProgress = false;
        showToast(currentLang==='ar'
            ? "⚠️ تم إنشاء الحساب لكنه غير مفعّل — يتطلب Supabase تأكيد بريد لن يصل أبداً. اذهب لإعدادات Supabase وأطفئ 'Confirm email' ثم أعد المحاولة."
            : "⚠️ Account created but not activated — Supabase still requires email confirmation you'll never receive. Go to Supabase settings and turn off 'Confirm email', then try again.");
        return;
    }

    showToast(currentLang==='ar' ? "🎉 تم إنشاء حسابك وتسجيل دخولك" : "🎉 Account created and signed in");
    if(fromLoginScreen){ document.getElementById("login-overlay").style.display = "none"; }
    renderAccountUI();
    finishLoginBoot();
    manualAuthInProgress = false;
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
    manualAuthInProgress = true;
    const email = await resolveUsernameEmail(username);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setAccountBusy(false);

    if(error){
        manualAuthInProgress = false;
        console.error("[خُطى] خطأ Supabase الكامل عند تسجيل الدخول:", error);
        if(/confirm/i.test(error.message)){
            showToast(currentLang==='ar'
                ? "⚠️ هذا الحساب لم يُفعَّل بعد (يتطلب تأكيد بريد لن يصلك أبداً) — اذهب لإعدادات Supabase وأطفئ 'Confirm email'، ثم أنشئ الحساب من جديد."
                : "⚠️ This account was never confirmed (needs a confirmation email you'll never receive) — go to Supabase settings and turn off 'Confirm email', then create the account again.");
            return;
        }
        registerFailedAttempt(username);
        hapticError();
        showToast(currentLang==='ar' ? `بيانات الدخول غير صحيحة (${error.message})` : `Invalid username or password (${error.message})`);
        return;
    }
    clearFailedAttempts(username);
    const uid = data.user.id;
    setSession({ uid, username });

    const { data: row } = await sb.from("user_data").select("data, username").eq("id", uid).maybeSingle();
    if(row && row.data){
        await resolveAccountDataConflict(row.data);
    }
    // ⚠️ لم نعد نُعيد تحميل الصفحة إطلاقاً بعد الآن — كانت هذه المقامرة على
    // توقيت حفظ Supabase لجلسته الداخلية في التخزين هي السبب الجذري الحقيقي
    // لعودة الطالب لشاشة الدخول رغم دخوله الناجح. بدلاً من ذلك، نُكمل كل شيء
    // في نفس الصفحة مباشرة (بنفس أسلوب إنشاء الحساب الذي كان يعمل بثبات دائماً)
    if(fromLoginScreen){ document.getElementById("login-overlay").style.display = "none"; }
    updateWelcomeText();
    loadProfileForm();
    renderAccountUI();
    checkAdminStatus();
    renderGamification();
    checkBadges();
    finishLoginBoot();
    manualAuthInProgress = false;
    showToast(currentLang==='ar' ? "أهلاً بعودتك 👋" : "Welcome back 👋");
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
    // لا نكتفي بمسح الجلسة فقط — يجب مسح الاسم المحلي أيضاً، وإلا فحص "هل يوجد
    // اسم؟" عند الإقلاع التالي سيظنّ خطأً أن هناك مستخدماً "ضيفاً" شرعياً ويتخطى
    // شاشة الدخول رغم أن الشخص خرج من حسابه فعلياً للتو
    localStorage.removeItem("khuta_name");
    showToast(currentLang==='ar' ? "تم تسجيل الخروج — بياناتك المحلية باقية على هذا الجهاز" : "Signed out — your local data stays on this device");
    renderAccountUI();
    document.getElementById("login-overlay").style.display = "flex";
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
    const session = getSession();

    // ⚠️ إعادة تصميم كاملة: khuta_session (تعرّفنا المحلي على الطالب) أصبح
    // الآن مصدر الحقيقة الوحيد لقرار "هل يبقى الطالب مسجَّل الدخول من منظور
    // الواجهة" — لم يعد فحص جلسة Supabase الداخلية قادراً على إجباره على
    // الخروج تلقائياً بعد الآن. كنا نعتمد على أن جلسة Supabase "تُثبت" ذاتها
    // دائماً عبر التخزين المحلي، لكن اتضح أن هذا لا يحدث بثبات لكل الحالات
    // (خصوصاً بعد إغلاق المتصفح وإعادة فتحه) — فكان الطالب يُعاد لشاشة
    // الدخول رغم بقاء تعرّفنا المحلي عليه سليماً تماماً. الآن: إن كان
    // khuta_session موجوداً، يبقى الطالب مسجَّل الدخول من منظوره هو، بغض
    // النظر عن حالة Supabase الداخلية، ونحاول فقط تجديد الجلسة بصمت في
    // الخلفية دون أي تأثير مرئي على تجربته.
    if(session){
        renderAccountUI();
        const { data } = await sb.auth.getSession();
        if(!data || !data.session){
            // نحاول تجديداً صامتاً؛ إن فشل، يبقى الطالب مسجَّلاً محلياً على أي حال،
            // وستُستأنف المزامنة تلقائياً بمجرد نجاح أي محاولة تالية
            try{ await sb.auth.refreshSession(); }catch(e){ /* فشل صامت — لا يؤثر على تجربة الطالب */ }
        }
        return;
    }

    // لا جلسة محلية إطلاقاً (ضيف حقيقي) — دخول مجهول صامت لازم لميزات المجتمع
    const { data } = await sb.auth.getSession();
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
          outlook:"حاجة دائمة لا تنقطع، مع نمو ملحوظ في تخصصات الجراحة الدقيقة والأورام والطب الجيني.",
          branches:["الطب الباطني","الجراحة","طب الأطفال","النساء والولادة","الطب النفسي","طب الطوارئ"],
          universities:["جامعة الملك سعود","جامعة الملك عبدالعزيز","جامعة الملك سعود بن عبدالعزيز للعلوم الصحية","جامعة الملك فيصل"]},
      en:{name:"Medicine", desc:"Diagnosing and treating illness, 6 years + internship.", career:"General practitioner or specialist after training.", note:"One of the most competitive majors; STEP is required at most universities.",
          outlook:"Demand never stops, with notable growth in precision surgery, oncology, and genetic medicine.",
          branches:["Internal Medicine","Surgery","Pediatrics","OB/GYN","Psychiatry","Emergency Medicine"],
          universities:["King Saud University","King Abdulaziz University","KSAU-HS","King Faisal University"]} },
    { id:"dentistry", icon:"fa-tooth", track:"science",
      ar:{name:"طب الأسنان", desc:"دراسة صحة الفم والأسنان وعلاجها جراحياً وتحفظياً.", career:"طبيب أسنان عام أو أخصائي.", note:"تنافسية عالية، غالباً تتطلب STEP.",
          outlook:"مستقر مع توسع القطاع الخاص والتقنيات الحديثة لتقويم وزراعة الأسنان."},
      en:{name:"Dentistry", desc:"Oral and dental health, surgical and conservative treatment.", career:"General or specialist dentist.", note:"Highly competitive, usually requires STEP.",
          outlook:"Stable field, growing with private-sector expansion and modern orthodontic/implant technology."} },
    { id:"pharmacy", icon:"fa-pills", track:"science",
      ar:{name:"الصيدلة", desc:"دراسة الأدوية وتركيبها وتأثيرها العلاجي.", career:"صيدلي في مستشفى، صيدلية، أو صناعة دوائية.", note:"تنافسية عالية جداً.",
          outlook:"نمو في أبحاث الدواء والتصنيع المحلي للقاحات والأدوية."},
      en:{name:"Pharmacy", desc:"Study of drugs, formulation, and therapeutic effects.", career:"Pharmacist in hospitals, pharmacies, or the pharma industry.", note:"Very competitive.",
          outlook:"Growth in drug research and local manufacturing of vaccines and medicines."} },
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
      ar:{name:"المحاسبة", desc:"القياس والتقارير المالية والمراجعة.", career:"محاسب قانوني، مراجع داخلي، محلل مالي.", note:"طلب ثابت في كل القطاعات تقريباً.",
          outlook:"تخصص جوهري لا تخلو منه أي شركة، مع ضرورة متزايدة للإلمام بالأنظمة المحاسبية الرقمية."},
      en:{name:"Accounting", desc:"Financial measurement, reporting, and auditing.", career:"Certified accountant, internal auditor, financial analyst.", note:"Steady demand across nearly all sectors.",
          outlook:"A core function every company needs, with growing importance placed on digital accounting systems."} },
    { id:"finance", icon:"fa-chart-line", track:"admin",
      ar:{name:"التمويل والاستثمار", desc:"الأسواق المالية، إدارة المحافظ، والتحليل المالي.", career:"محلل مالي، مستشار استثمار.", note:"مرتبط بقطاع البنوك والأسواق المالية المتنامي.",
          outlook:"نمو قوي في التقنية المالية (FinTech)، التحليل المالي، وإدارة المخاطر."},
      en:{name:"Finance & Investment", desc:"Financial markets, portfolio management, analysis.", career:"Financial analyst, investment advisor.", note:"Tied to the growing banking and capital-markets sector.",
          outlook:"Strong growth in FinTech, financial analysis, and risk management."} },
    { id:"law", icon:"fa-scale-balanced", track:"humanities",
      ar:{name:"القانون", desc:"دراسة الأنظمة القانونية والتشريعات.", career:"محامٍ، مستشار قانوني، قاضٍ (بعد مسار مختص).", note:"يتطلب اجتياز اختبار الرخصة القانونية للممارسة.",
          outlook:"واعد جداً في القوانين التجارية، الأمن السيبراني، حماية البيانات، والملكية الفكرية.",
          branches:["القانون التجاري","القانون الجنائي","القانون الدولي","التحكيم التجاري"],
          universities:["جامعة الملك سعود","جامعة الإمام محمد بن سعود","جامعة الملك عبدالعزيز"]},
      en:{name:"Law", desc:"Study of legal systems and legislation.", career:"Lawyer, legal consultant, judge (via a specialized path).", note:"Requires passing the legal licensing exam to practice.",
          outlook:"Very promising in commercial law, cybersecurity, data protection, and intellectual property.",
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
      ar:{name:"اللغة الإنجليزية والترجمة", desc:"إتقان اللغة الإنجليزية وأصول الترجمة.", career:"مترجم، تدريس، إعلام، علاقات دولية.", note:"غالباً تتطلب درجة STEP مرتفعة نسبياً.",
          outlook:"تركيز متزايد على الترجمة الفورية، الترجمة القانونية والطبية، وحتى تدريب نماذج الذكاء الاصطناعي اللغوية."},
      en:{name:"English & Translation", desc:"English fluency and translation principles.", career:"Translator, teaching, media, international relations.", note:"Usually requires a relatively high STEP score.",
          outlook:"Growing focus on simultaneous interpretation, legal/medical translation, and even training AI language models."} },
    { id:"nursing", icon:"fa-user-nurse", track:"science",
      ar:{name:"التمريض", desc:"الرعاية الصحية للمرضى في مختلف الأقسام الطبية.", career:"ممرض/ة في مستشفيات حكومية وخاصة.", note:"طلب سوقي مرتفع ومستقر."},
      en:{name:"Nursing", desc:"Patient care across medical departments.", career:"Nurse in public and private hospitals.", note:"High and steady market demand."} },
    { id:"architecture", icon:"fa-building", track:"science",
      ar:{name:"العمارة", desc:"تصميم المباني من الناحية الجمالية والوظيفية.", career:"مهندس معماري، مصمم داخلي، مخطط عمراني.", note:"يتطلب موهبة تصميمية إلى جانب الأساس الهندسي."},
      en:{name:"Architecture", desc:"Designing buildings aesthetically and functionally.", career:"Architect, interior designer, urban planner.", note:"Requires design talent alongside engineering fundamentals."} },
    { id:"psychology", icon:"fa-brain", track:"humanities",
      ar:{name:"علم النفس", desc:"دراسة السلوك الإنساني والعمليات النفسية.", career:"أخصائي نفسي (بعد ترخيص)، موارد بشرية، بحث علمي.", note:"يحتاج غالباً دراسات عليا للممارسة الإكلينيكية.",
          outlook:"ارتفاع ملحوظ في الوعي بالصحة النفسية وجودة الحياة وبيئة العمل، وطلب متزايد على علم النفس التنظيمي في الشركات."},
      en:{name:"Psychology", desc:"Study of human behavior and mental processes.", career:"Licensed psychologist, HR, research.", note:"Clinical practice usually requires graduate studies.",
          outlook:"Rising awareness of mental health and workplace well-being, with growing demand for organizational psychology in companies."} },
    { id:"industrial_eng", icon:"fa-industry", track:"science",
      ar:{name:"الهندسة الصناعية", desc:"تحسين العمليات الإنتاجية وسلاسل الإمداد وإدارة الجودة.", career:"مهندس عمليات، مستشار سلاسل إمداد.", note:"مطلوبة في القطاع الصناعي واللوجستي المتنامي.",
          outlook:"طلب كبير في إدارة العمليات، اللوجستيات، وتوجيه المشاريع مع التحول نحو المصانع الذكية."},
      en:{name:"Industrial Engineering", desc:"Optimizing production processes, supply chains, and quality.", career:"Process engineer, supply-chain consultant.", note:"In demand across the growing industrial and logistics sector.",
          outlook:"High demand in operations management, logistics, and project leadership amid the shift toward smart factories."} },
    { id:"petroleum_eng", icon:"fa-oil-well", track:"science",
      ar:{name:"هندسة البترول", desc:"استكشاف واستخراج النفط والغاز.", career:"مهندس حفر، مهندس مكامن.", note:"مرتبطة تاريخياً بأرامكو وقطاع الطاقة."},
      en:{name:"Petroleum Engineering", desc:"Oil and gas exploration and extraction.", career:"Drilling engineer, reservoir engineer.", note:"Historically tied to Aramco and the energy sector."} },
    { id:"media", icon:"fa-video", track:"humanities",
      ar:{name:"الإعلام والاتصال", desc:"الصحافة، الإعلام الرقمي، والعلاقات العامة.", career:"صحفي، منتج محتوى، مسؤول علاقات عامة.", note:"تطوّر كثيراً مع نمو الإعلام الرقمي ووسائل التواصل.",
          outlook:"الاعتماد المتزايد على المهارات الفردية والإنتاج الرقمي والمنصات الحديثة بدل الإعلام التقليدي وحده."},
      en:{name:"Media & Communication", desc:"Journalism, digital media, and public relations.", career:"Journalist, content producer, PR officer.", note:"Growing rapidly alongside digital media and social platforms.",
          outlook:"Increasing reliance on individual skills, digital production, and modern platforms rather than traditional media alone."} },
    { id:"veterinary", icon:"fa-paw", track:"science",
      ar:{name:"الطب البيطري", desc:"تشخيص وعلاج أمراض الحيوانات.", career:"طبيب بيطري في عيادات أو قطاع الثروة الحيوانية.", note:"تخصص متوسط التنافسية نسبياً."},
      en:{name:"Veterinary Medicine", desc:"Diagnosing and treating animal illnesses.", career:"Veterinarian in clinics or the livestock sector.", note:"Moderately competitive."} },

    { id:"ai_ml", icon:"fa-robot", track:"science",
      ar:{name:"الذكاء الاصطناعي وتعلم الآلة", desc:"بناء الأنظمة الذكية، تحليل البيانات الضخمة، والتعلم الآلي.", career:"مهندس ذكاء اصطناعي، مطوّر نماذج تعلم آلي، باحث.", note:"من أسرع التخصصات نمواً عالمياً ومحلياً.",
          outlook:"المحرك الأساسي لكافة التكنولوجيا القادمة — روبوتات، تحليل تنبؤي، وأتمتة."},
      en:{name:"AI & Machine Learning", desc:"Building intelligent systems, big-data analysis, and machine learning.", career:"AI engineer, ML model developer, researcher.", note:"One of the fastest-growing fields globally and locally.",
          outlook:"The core driver of all upcoming technology — robotics, predictive analytics, and automation."} },
    { id:"cybersecurity", icon:"fa-shield-halved", track:"science",
      ar:{name:"الأمن السيبراني", desc:"حماية الأنظمة، الشبكات، والبيانات من الهجمات الرقمية.", career:"محلل أمن معلومات، مختبر اختراق، مستشار أمني.", note:"طلب سوقي مرتفع جداً حالياً.",
          outlook:"طلب حاد ومستمر لا يستغني عنه أي قطاع حكومي أو خاص."},
      en:{name:"Cybersecurity", desc:"Protecting systems, networks, and data from digital attacks.", career:"Security analyst, penetration tester, security consultant.", note:"Very high current market demand.",
          outlook:"Sharp, continuous demand that no government or private sector can do without."} },
    { id:"data_science", icon:"fa-database", track:"science",
      ar:{name:"علوم البيانات وتحليلها", desc:"استخراج المعرفة والأنماط من الكميات الهائلة من البيانات.", career:"محلل بيانات، عالم بيانات، مستشار تحليلات.", note:"طلب متنامٍ بسرعة مع تحول الشركات للقرارات المبنية على بيانات.",
          outlook:"عصب اتخاذ القرار في الشركات، التسويق، والتخطيط الاستراتيجي."},
      en:{name:"Data Science & Analytics", desc:"Extracting knowledge and patterns from massive amounts of data.", career:"Data analyst, data scientist, analytics consultant.", note:"Rapidly growing demand as companies shift to data-driven decisions.",
          outlook:"The backbone of decision-making in companies, marketing, and strategic planning."} },
    { id:"cloud_computing", icon:"fa-cloud", track:"science",
      ar:{name:"الحوسبة السحابية وشبكات الحاسب", desc:"إدارة السيرفرات والبنية التحتية الرقمية.", career:"مهندس سحابة، مدير شبكات، مهندس DevOps.", note:"نمو متزايد مع تحوّل الشركات للسحابة.",
          outlook:"نمو متزايد مع تحول معظم الشركات من السيرفرات المحلية إلى السحابة."},
      en:{name:"Cloud Computing & Networking", desc:"Managing servers and digital infrastructure.", career:"Cloud engineer, network administrator, DevOps engineer.", note:"Growing demand as companies migrate to the cloud.",
          outlook:"Increasing growth as most companies shift from local servers to the cloud."} },
    { id:"electrical_eng", icon:"fa-bolt", track:"science",
      ar:{name:"الهندسة الكهربائية والإلكترونية", desc:"الطاقة، الدوائر الإلكترونية، والأنظمة المدمجة.", career:"مهندس كهرباء، مهندس أنظمة مدمجة.", note:"تخصص هندسي أساسي وواسع التطبيقات.",
          outlook:"واعد جداً مع التوجه نحو الطاقة المتجددة، السيارات الكهربائية، وإنترنت الأشياء."},
      en:{name:"Electrical & Electronics Engineering", desc:"Power, electronic circuits, and embedded systems.", career:"Electrical engineer, embedded systems engineer.", note:"A core, broadly-applicable engineering field.",
          outlook:"Very promising with the shift toward renewable energy, electric vehicles, and IoT."} },
    { id:"mechanical_eng", icon:"fa-gears", track:"science",
      ar:{name:"الهندسة الميكانيكية والأتمتة", desc:"المحركات، التصنيع، التكييف، والروبوتات.", career:"مهندس ميكانيكي، مهندس تصنيع، مهندس روبوتات.", note:"تخصص تقليدي يتجدّد مع الأتمتة.",
          outlook:"التحول نحو المصانع الذكية والتصنيع الرقمي المتقدم."},
      en:{name:"Mechanical Engineering & Automation", desc:"Engines, manufacturing, HVAC, and robotics.", career:"Mechanical engineer, manufacturing engineer, robotics engineer.", note:"A traditional field being renewed by automation.",
          outlook:"Shift toward smart factories and advanced digital manufacturing."} },
    { id:"chemical_eng", icon:"fa-flask", track:"science",
      ar:{name:"الهندسة الكيميائية وهندسة المواد", desc:"تكرير الموارد، المواد المتقدمة، والبتروكيماويات.", career:"مهندس كيميائي، مهندس مواد، باحث بتروكيماويات.", note:"مرتبط بقطاع الطاقة والصناعة الثقيلة في السعودية.",
          outlook:"التركيز على أبحاث البطاريات، الهيدروجين الأخضر، والمواد المتقدمة."},
      en:{name:"Chemical & Materials Engineering", desc:"Resource refining, advanced materials, and petrochemicals.", career:"Chemical engineer, materials engineer, petrochemical researcher.", note:"Tied to Saudi Arabia's energy and heavy-industry sector.",
          outlook:"Focus on battery research, green hydrogen, and advanced materials."} },
    { id:"applied_medical", icon:"fa-stethoscope", track:"science",
      ar:{name:"العلوم الطبية التطبيقية", desc:"الأشعة، المختبرات، العلاج الطبيعي، والتخدير.", career:"أخصائي أشعة، فني مختبر، أخصائي علاج طبيعي.", note:"طلب مستقر في المستشفيات والمراكز الطبية.",
          outlook:"طلب مرتقب لزيادة الاستثمار في المستشفيات والمراكز التأهيلية."},
      en:{name:"Applied Medical Sciences", desc:"Radiology, lab sciences, physical therapy, and anesthesia technology.", career:"Radiology tech, lab technician, physical therapist.", note:"Steady demand across hospitals and medical centers.",
          outlook:"Anticipated demand growth as investment in hospitals and rehab centers increases."} },
    { id:"health_informatics", icon:"fa-hospital-user", track:"science",
      ar:{name:"الإدارة والمعلوماتية الصحية", desc:"إدارة المستشفيات والسجلات الطبية والذكاء الاصطناعي الطبي.", career:"مدير معلومات صحية، محلل نظم طبية.", note:"تخصص يجمع بين الصحة والتقنية.",
          outlook:"من أكثر التخصصات نمواً لربط القطاع الصحي بالتحول الرقمي."},
      en:{name:"Health Informatics & Management", desc:"Hospital administration, medical records, and medical AI.", career:"Health information manager, medical systems analyst.", note:"Combines healthcare with technology.",
          outlook:"One of the fastest-growing fields, connecting healthcare to digital transformation."} },
    { id:"supply_chain", icon:"fa-truck-fast", track:"admin",
      ar:{name:"سلاسل الإمداد والخدمات اللوجستية", desc:"إدارة حركة البضائع والتخزين والتوزيع.", career:"مدير لوجستيات، مخطط سلسلة إمداد.", note:"مرتبط بنمو التجارة الإلكترونية في السعودية.",
          outlook:"طلب مرتفع جداً بسبب التوسع في التجارة الإلكترونية والمراكز اللوجستية العالمية."},
      en:{name:"Supply Chain & Logistics", desc:"Managing the movement, storage, and distribution of goods.", career:"Logistics manager, supply-chain planner.", note:"Tied to the growth of e-commerce in Saudi Arabia.",
          outlook:"Very high demand due to e-commerce expansion and global logistics hubs."} },
    { id:"digital_marketing", icon:"fa-bullhorn", track:"admin",
      ar:{name:"التسويق الرقمي والتجارة الإلكترونية", desc:"الاستراتيجيات التسويقية وتحليل سلوك المستهلك الرقمي.", career:"أخصائي تسويق رقمي، مدير تجارة إلكترونية.", note:"من أكثر المهارات المطلوبة حالياً في سوق العمل.",
          outlook:"التحول الكامل نحو التسويق المبني على البيانات والمحتوى الرقمي."},
      en:{name:"Digital Marketing & E-commerce", desc:"Marketing strategy and digital consumer-behavior analysis.", career:"Digital marketing specialist, e-commerce manager.", note:"One of the most in-demand skill sets in today's job market.",
          outlook:"A full shift toward data-driven marketing and digital content."} },
    { id:"mis", icon:"fa-diagram-project", track:"admin",
      ar:{name:"نظم المعلومات الإدارية", desc:"الجسر الفاصل بين الإدارة وحلول تقنية المعلومات.", career:"محلل أعمال، مستشار نظم معلومات.", note:"مزيج بين الإدارة والتقنية.",
          outlook:"طلب ممتاز لمساعدة الشركات على اختيار وتطبيق التكنولوجيا المناسبة."},
      en:{name:"Management Information Systems", desc:"The bridge between management and IT solutions.", career:"Business analyst, IT systems consultant.", note:"A blend of management and technology.",
          outlook:"Excellent demand helping companies choose and implement the right technology."} },
    { id:"ui_ux_design", icon:"fa-pen-ruler", track:"humanities",
      ar:{name:"تصميم تجربة وواجهة المستخدم (UI/UX)", desc:"تصميم كيفية تفاعل المستخدم مع التطبيقات والمواقع.", career:"مصمم UI/UX، باحث تجربة مستخدم.", note:"يحتاج غالباً معرض أعمال (Portfolio) قوياً.",
          outlook:"طلب استثنائي في جميع شركات التقنية والشركات الناشئة."},
      en:{name:"UI/UX Design", desc:"Designing how users interact with apps and websites.", career:"UI/UX designer, user researcher.", note:"Usually requires a strong portfolio.",
          outlook:"Exceptional demand across all tech companies and startups."} },
    { id:"graphic_design", icon:"fa-palette", track:"humanities",
      ar:{name:"التصميم الجرافيكي والوسائط المتعددة", desc:"الهويات البصرية والرسوم المتحركة (Motion Graphics).", career:"مصمم جرافيك، فنان موشن جرافيك.", note:"يحتاج معرض أعمال قوياً ومهارة فنية مستمرة التطوير.",
          outlook:"مستمر ومطلوب في صناعة الإعلانات والترفيه والألعاب."},
      en:{name:"Graphic Design & Motion Graphics", desc:"Visual identities and motion graphics.", career:"Graphic designer, motion graphics artist.", note:"Requires a strong portfolio and continuously developing artistic skill.",
          outlook:"Ongoing demand in advertising, entertainment, and gaming."} },
    { id:"interior_design", icon:"fa-couch", track:"humanities",
      ar:{name:"التصميم الداخلي", desc:"استغلال المساحات الداخلية والتنسيق الجمالي.", career:"مصمم داخلي، مستشار ديكور.", note:"مختلف عن الهندسة المعمارية — يركّز على المساحات الداخلية تحديداً.",
          outlook:"مرتبط بالنمو العقاري وتطوير قطاعات الضيافة والسياحة."},
      en:{name:"Interior Design", desc:"Utilizing interior spaces and aesthetic coordination.", career:"Interior designer, decor consultant.", note:"Distinct from architecture — focuses specifically on interior spaces.",
          outlook:"Tied to real-estate growth and the development of hospitality and tourism."} },
    { id:"physics", icon:"fa-atom", track:"science",
      ar:{name:"الفيزياء والفيزياء الطبية والتطبيقية", desc:"دراسة المادة والطاقة والتطبيقات الطبية.", career:"باحث فيزياء، فيزيائي طبي، مهندس تطبيقي.", note:"أساس علمي قوي يفتح أبواباً بحثية وصناعية متعددة.",
          outlook:"مجالات الطاقة، الأبحاث النووية، والتصوير الطبي."},
      en:{name:"Physics & Applied/Medical Physics", desc:"Study of matter, energy, and medical applications.", career:"Physics researcher, medical physicist, applied engineer.", note:"A strong scientific foundation opening many research and industrial doors.",
          outlook:"Energy fields, nuclear research, and medical imaging."} },
    { id:"chemistry", icon:"fa-vial", track:"science",
      ar:{name:"الكيمياء والكيمياء الصناعية", desc:"تحليل المواد والتصنيع الكيميائي.", career:"كيميائي صناعي، باحث مختبرات، مراقب جودة.", note:"مرتبط بالقطاعات الصناعية والدوائية في السعودية.",
          outlook:"القطاعات الصناعية، الدوائية، والبتروكيميائية."},
      en:{name:"Chemistry & Industrial Chemistry", desc:"Material analysis and chemical manufacturing.", career:"Industrial chemist, lab researcher, quality controller.", note:"Tied to Saudi Arabia's industrial and pharmaceutical sectors.",
          outlook:"Industrial, pharmaceutical, and petrochemical sectors."} },
    { id:"biotechnology", icon:"fa-dna", track:"science",
      ar:{name:"التكنولوجيا الحيوية والأحياء الدقيقة", desc:"تعديل الجينات واللقاحات والأبحاث الحيوية.", career:"باحث تقنية حيوية، أخصائي مختبرات وراثية.", note:"مجال بحثي متنامٍ بقوة عالمياً.",
          outlook:"نمو هائل في الطب الحديث والتصنيع الغذائي والزراعي."},
      en:{name:"Biotechnology & Microbiology", desc:"Gene editing, vaccines, and biological research.", career:"Biotech researcher, genetics lab specialist.", note:"A rapidly-growing research field worldwide.",
          outlook:"Huge growth in modern medicine and food/agricultural manufacturing."} },
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
            ${d.outlook ? `<div style="margin-bottom:14px; padding:12px 14px; background:var(--bg-alt); border-radius:12px; border-inline-start:3px solid var(--gold);"><b style="font-size:12.5px; color:var(--text-1);"><i class="fa-solid fa-arrow-trend-up" style="color:var(--gold);"></i> ${currentLang==='ar'?'مستقبل التخصص:':'Career outlook:'}</b><p style="font-size:12.5px; color:var(--text-2); line-height:1.8; margin-top:6px;">${d.outlook}</p></div>` : ""}
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
    const { data, error } = await sb.from("leaderboard").select("id, display_name, xp").order("xp", { ascending:false }).limit(10);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا يوجد طلاب مشاركون بعد — كن أول من ينضم!':'No participants yet — be the first to join!'}</div>`;
        return;
    }
    box.innerHTML = data.map((row, i) => `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 6px; border-bottom:1px solid var(--border);">
            <b style="width:24px; color:${i<3?'var(--gold)':'var(--text-3)'};">#${i+1}</b>
            <span style="flex:1; font-weight:600;">${getPrestigeFlair(row.xp)}${escapeHtml(row.display_name)}</span>
            <span style="font-family:var(--font-mono); color:var(--gold); font-weight:700;">${row.xp} XP</span>
            ${isAdmin ? `<div class="icon-action" style="width:26px; height:26px; font-size:10px;" title="${currentLang==='ar'?'إزالة من لوحة الصدارة':'Remove from leaderboard'}" onclick="removeLeaderboardEntry('${row.id}')"><i class="fa-solid fa-ban"></i></div>` : ""}
        </div>`).join("");
}

/* رمز مكانة بسيط بجانب الاسم حسب مستوى XP — يمنح رقم XP قيمة اجتماعية
   ظاهرة فعلياً في لوحة الصدارة، وليس مجرد رقم بلا أثر */
function getPrestigeFlair(xp){
    if(xp >= 1000) return '<i class="fa-solid fa-crown" style="color:var(--gold); margin-inline-end:4px;" title="خبير قدرات"></i>';
    if(xp >= 600) return '<i class="fa-solid fa-star" style="color:var(--gold); margin-inline-end:4px;" title="محترف"></i>';
    if(xp >= 300) return '<i class="fa-solid fa-bolt" style="color:var(--teal); margin-inline-end:4px;" title="متمرّس"></i>';
    return '';
}

async function removeLeaderboardEntry(id){
    if(!isAdmin || !sb) return;
    if(!confirm(currentLang==='ar' ? "إزالة هذا الطالب نهائياً من لوحة الصدارة؟" : "Permanently remove this student from the leaderboard?")) return;
    const { error } = await sb.from("leaderboard").delete().eq("id", id);
    if(error){ showToast(currentLang==='ar'?'تعذّرت الإزالة':'Could not remove'); return; }
    showToast(currentLang==='ar' ? "🚫 أُزيل من لوحة الصدارة" : "🚫 Removed from leaderboard");
    refreshLeaderboard();
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
                const liveEl = document.getElementById("live-users-count");
                if(liveEl) liveEl.textContent = count;
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
const PIN_FORUM_COST = 30;
const PIN_TEMPLATE_COST = 50;

async function refreshForum(){
    const box = document.getElementById("forum-list");
    if(!box || !sb) return;
    const { data, error } = await sb.from("forum_posts").select("id, author_name, message, created_at, pinned_until").order("created_at", { ascending:false }).limit(20);
    if(error || !data || !data.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد أسئلة بعد — ابدأ أنت!':'No questions yet — be the first!'}</div>`;
        return;
    }
    const now = Date.now();
    const sorted = [...data].sort((a,b) => {
        const aPinned = a.pinned_until && new Date(a.pinned_until).getTime() > now;
        const bPinned = b.pinned_until && new Date(b.pinned_until).getTime() > now;
        if(aPinned && !bPinned) return -1;
        if(!aPinned && bPinned) return 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    box.innerHTML = sorted.map(row => {
        const isPinned = row.pinned_until && new Date(row.pinned_until).getTime() > now;
        return `
        <div class="${isPinned ? 'pinned-template-glow' : ''}" style="padding:10px 10px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; gap:10px; align-items:flex-start; ${isPinned ? 'border-radius:12px; margin-bottom:6px;' : ''}">
            <div style="flex:1;">
                ${isPinned ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700;"><i class="fa-solid fa-thumbtack"></i> ${currentLang==='ar'?'مثبَّت':'Pinned'}</span><br>` : ""}
                <div style="font-size:13.5px;">${escapeHtml(row.message)}</div>
                <div style="font-size:11px; color:var(--text-3); margin-top:4px;">${escapeHtml(row.author_name)} · ${new Date(row.created_at).toLocaleDateString(currentLang==='ar'?"ar-SA":"en-US")}</div>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                ${!isPinned ? `<button type="button" class="icon-action" title="${currentLang==='ar'?`تثبيت (${PIN_FORUM_COST} XP)`:`Pin (${PIN_FORUM_COST} XP)`}" onclick="pinForumPostWithXP(${row.id})"><i class="fa-solid fa-thumbtack"></i></button>` : ""}
                ${isAdmin ? `<button type="button" class="icon-action" title="${currentLang==='ar'?'حذف (صلاحية مشرف)':'Delete (admin)'}" onclick="deleteForumMessage(${row.id})"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
        </div>`;
    }).join("");
}

async function pinForumPostWithXP(id){
    if(!sb) return;
    if(getXP() < PIN_FORUM_COST){
        showToast(currentLang==='ar' ? `تحتاج ${PIN_FORUM_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${PIN_FORUM_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `تثبيت هذه الرسالة لأعلى القائمة لـ3 أيام مقابل ${PIN_FORUM_COST} XP؟` : `Pin this message to the top for 3 days for ${PIN_FORUM_COST} XP?`)) return;
    const { error } = await sb.rpc("pin_forum_post", { post_id: id, days: 3 });
    if(error){ showToast(currentLang==='ar'?'تعذّر التثبيت':'Could not pin'); console.error(error); return; }
    setXP(getXP() - PIN_FORUM_COST);
    showToast(currentLang==='ar' ? "📌 تم التثبيت لـ3 أيام" : "📌 Pinned for 3 days");
    refreshForum();
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
    const { error } = await sb.from("forum_posts").insert({ author_name: name, author_id: uid, message: msg });
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
    const { data: templates, error } = await sb.from("plan_templates").select("*").order("created_at", { ascending:false }).limit(30);
    if(error || !templates || !templates.length){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'لا توجد قوالب بعد — كن أول من يشارك!':'No templates yet — be the first to share!'}</div>`;
        return;
    }
    const now = Date.now();
    const { data: allRatings } = await sb.from("template_ratings").select("template_id, vote, comment, rater_id");
    const likesMap = {};
    templates.forEach(tpl => {
        const ratings = (allRatings || []).filter(r => r.template_id === tpl.id);
        likesMap[tpl.id] = ratings.filter(r => r.vote === "like").length;
    });

    // ترتيب القوالب: المثبَّت أولاً دائماً، ثم الأكثر إعجاباً، ثم الأحدث
    templates.sort((a,b) => {
        const aPinned = a.pinned_until && new Date(a.pinned_until).getTime() > now;
        const bPinned = b.pinned_until && new Date(b.pinned_until).getTime() > now;
        if(aPinned && !bPinned) return -1;
        if(!aPinned && bPinned) return 1;
        const likeDiff = likesMap[b.id] - likesMap[a.id];
        if(likeDiff !== 0) return likeDiff;
        return new Date(b.created_at) - new Date(a.created_at);
    });
    const topTemplates = templates.slice(0, 15); // نعرض أفضل 15 بعد الترتيب

    function getPopularityGlowClass(likes){
        if(likes >= 15) return "trending-glow-hot";
        if(likes >= 6) return "trending-glow-warm";
        return "";
    }

    box.innerHTML = topTemplates.map(tpl => {
        const ratings = (allRatings || []).filter(r => r.template_id === tpl.id);
        const likes = likesMap[tpl.id];
        const dislikes = ratings.filter(r => r.vote === "dislike").length;
        const comments = ratings.filter(r => r.comment).slice(0, 2);
        const isPinned = tpl.pinned_until && new Date(tpl.pinned_until).getTime() > now;
        const glowClass = isPinned ? "pinned-template-glow" : getPopularityGlowClass(likes);
        return `
        <div class="${glowClass}" style="padding:16px; border-radius:16px; background:var(--bg-alt); border:1px solid var(--border); margin-bottom:12px;">
            ${isPinned ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700; display:block; margin-bottom:6px;"><i class="fa-solid fa-thumbtack"></i> ${currentLang==='ar'?'مثبَّت':'Pinned'}</span>` : (glowClass ? `<span style="font-size:10.5px; color:var(--gold); font-weight:700; display:block; margin-bottom:6px;"><i class="fa-solid fa-fire"></i> ${currentLang==='ar'?'الأكثر إعجاباً':'Highly rated'}</span>` : "")}
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
                <div>
                    <b style="font-size:14.5px;">${escapeHtml(tpl.title)}</b>
                    <div style="font-size:11px; color:var(--text-3); margin-top:2px;">${escapeHtml(tpl.author_name)} · ${tpl.plan_days ? tpl.plan_days + (currentLang==='ar'?' يوم':' days') : ""}${tpl.session_minutes ? ' · ' + (tpl.session_minutes/60).toFixed(1) + (currentLang==='ar'?' ساعة/يوم':' hr/day') : ""}</div>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" class="btn btn-sm" onclick="useTemplate(${tpl.id})"><i class="fa-solid fa-download"></i> ${currentLang==='ar'?'استخدم':'Use'}</button>
                    ${!isPinned ? `<div class="icon-action" title="${currentLang==='ar'?`تثبيت (${PIN_TEMPLATE_COST} XP)`:`Pin (${PIN_TEMPLATE_COST} XP)`}" onclick="pinTemplateWithXP(${tpl.id})"><i class="fa-solid fa-thumbtack"></i></div>` : ""}
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

async function pinTemplateWithXP(id){
    if(!sb) return;
    if(getXP() < PIN_TEMPLATE_COST){
        showToast(currentLang==='ar' ? `تحتاج ${PIN_TEMPLATE_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${PIN_TEMPLATE_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `تثبيت هذا القالب لأعلى القائمة لـ5 أيام مقابل ${PIN_TEMPLATE_COST} XP؟` : `Pin this template to the top for 5 days for ${PIN_TEMPLATE_COST} XP?`)) return;
    const { error } = await sb.rpc("pin_template", { template_id: id, days: 5 });
    if(error){ showToast(currentLang==='ar'?'تعذّر التثبيت':'Could not pin'); console.error(error); return; }
    setXP(getXP() - PIN_TEMPLATE_COST);
    showToast(currentLang==='ar' ? "📌 تم التثبيت لـ5 أيام" : "📌 Pinned for 5 days");
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

/* ============================================================
   36) بنك أسئلة الاختبار المحاكي
   ------------------------------------------------------------
   ⚠️ الأسئلة أدناه أمثلة توضيحية فقط لاختبار عمل النظام — وليست الأسئلة
   الحقيقية. لإضافة البنك الحقيقي: ارفع ملفاً بنفس اسم/بنية exam-questions.json
   (المرفق كمرجع) على نفس مستودع GitHub الذي تستخدمه للجامعات والدورات،
   وضع رابطه الخام في REMOTE_EXAM_QUESTIONS_URL أدناه — سيحل محل هذه
   الأمثلة تلقائياً دون أي تعديل آخر على الكود.
   ============================================================ */
const REMOTE_EXAM_QUESTIONS_URL = "";

const EXAM_QUESTIONS_LOCAL = {
    quant: [
        { id:"q001", text:"إذا كان س + 5 = 12، فما قيمة س؟", choices:["5","6","7","8"], correct:2, source:"دورة إيهاب — الوحدة 3 (المعادلات)" },
        { id:"q002", text:"ما ناتج 15% من 200؟", choices:["20","25","30","35"], correct:2, source:"دورة المعاصر — التأسيس، النسبة المئوية" },
        { id:"q003", text:"متوالية حسابية حدها الأول 3 وأساسها 4، فما الحد السادس؟", choices:["19","21","23","27"], correct:2, source:"دورة أينشتاين — المتتاليات" },
        { id:"q004", text:"مستطيل طوله 12 وعرضه 5، فما محيطه؟", choices:["17","34","60","68"], correct:1, source:"دورة المنصف — الهندسة" },
        { id:"q005", text:"إذا كانت سرعة سيارة 80 كم/س، فكم تقطع خلال 45 دقيقة؟", choices:["40 كم","50 كم","60 كم","70 كم"], correct:2, source:"دورة إيهاب — الوحدة 5 (السرعة والزمن)" },
        { id:"q006", text:"ما هو ناتج (2)^5؟", choices:["16","32","64","10"], correct:1, source:"دورة المعاصر — الأسس" },
    ],
    verbal: [
        { id:"v001", text:"اختر الكلمة الأقرب معنى لكلمة (السَّخِيّ):", choices:["البخيل","الكريم","الشجاع","الحكيم"], correct:1, source:"دورة إيهاب — المفردات، الوحدة 2" },
        { id:"v002", text:"أكمل التناظر: (طبيب : مستشفى) كـ (معلم : ــــــ)", choices:["كتاب","مدرسة","طالب","سبورة"], correct:1, source:"دورة أينشتاين — التناظر اللفظي" },
        { id:"v003", text:"اختر الكلمة الشاذة التي لا تنتمي لبقية الكلمات:", choices:["تفاح","برتقال","خيار","عنب"], correct:2, source:"دورة المنصف — إكمال المتشابهات" },
        { id:"v004", text:"ما مضاد كلمة (اليقظة)؟", choices:["النشاط","الغفلة","الحذر","الفطنة"], correct:1, source:"دورة إيهاب — المفردات، الوحدة 4" },
        { id:"v005", text:"أكمل الجملة بالكلمة المناسبة: \"سعى الطالب إلى ــــــ أهدافه رغم الصعوبات.\"", choices:["إهمال","تحقيق","نسيان","تأجيل"], correct:1, source:"دورة المعاصر — استيعاب المقروء" },
        { id:"v006", text:"اختر الكلمة الأقرب لمعنى (المُثابرة):", choices:["الكسل","الإصرار","التردد","الاستسلام"], correct:1, source:"دورة أينشتاين — المفردات" },
        { id:"v007", text:"أكمل التناظر: (قلم : كتابة) كـ (مفتاح : ــــــ)", choices:["باب","فتح","قفل","بيت"], correct:1, source:"دورة إيهاب — التناظر اللفظي، الوحدة 6" },
    ],
};

// يدمج بنك الأسئلة المشترك (shared_exam_questions في Supabase — يُبنى
// تلقائياً من أسئلة صالحة استخرجها الذكاء الاصطناعي من ملفات طلاب سابقين،
// انظر gemini-proxy.js) فوق المصدر الأساسي (البعيد إن وُجد، وإلا المحلي)
function getExamQuestions(){
    const base = window.__REMOTE_EXAM_QUESTIONS__ || EXAM_QUESTIONS_LOCAL;
    const shared = window.__SHARED_EXAM_QUESTIONS__;
    if(!shared || (!shared.quant.length && !shared.verbal.length)) return base;
    return {
        quant: [...(base.quant || []), ...shared.quant],
        verbal: [...(base.verbal || []), ...shared.verbal],
    };
}

async function tryLoadRemoteExamQuestions(){
    if(!REMOTE_EXAM_QUESTIONS_URL) return;
    try{
        const res = await fetch(REMOTE_EXAM_QUESTIONS_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(json && (json.quant || json.verbal)){
            window.__REMOTE_EXAM_QUESTIONS__ = json;
        }
    }catch(e){ /* تجاهل بصمت — نستمر بالأمثلة المدمجة محلياً */ }
}

// يحمّل بنك الأسئلة المشترك من Supabase (قراءة عامة، لا حاجة لحساب) —
// يكبر تلقائياً بمرور الوقت كلما ولّد طلاب أكثر أسئلة صالحة من ملفاتهم
// الخاصة، فيصبح الاختبار القياسي (بلا رفع ملفات) أغنى تدريجياً بدل بقائه
// عالقاً على 13 سؤالاً توضيحياً فقط
async function loadSharedExamQuestions(){
    if(!sb) return;
    try{
        const { data, error } = await sb.from("shared_exam_questions")
            .select("id,section,text,choices,correct,explain,source_note")
            .limit(1000);
        if(error || !data) return;
        const quant = [], verbal = [];
        data.forEach(row => {
            const q = {
                id: "shared_" + row.id,
                text: row.text,
                choices: row.choices,
                correct: row.correct,
                explain: row.explain || "",
                source: row.source_note || (currentLang==='ar' ? "من مساهمات الطلاب 🤝" : "From student contributions 🤝"),
            };
            if(row.section === "quant") quant.push(q);
            else if(row.section === "verbal") verbal.push(q);
        });
        window.__SHARED_EXAM_QUESTIONS__ = { quant, verbal };
    }catch(e){ console.error("[خُطى] تعذّر تحميل بنك الأسئلة المشترك:", e); }
}

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
   الاتصال المباشر بـGoogle. راجع تعليمات الإعداد المرفقة لضبط المتغيّر.

   ⚠️ إصلاح أمني ثانٍ (بعد مراجعة تقنية خارجية): الموديل وكل تعليمات النظام
   (الهوية، الأدوار، قواعد JSON...) كانت مكتوبة هنا في app.js وتُرسَل مع كل
   طلب — يعني أي شخص يستدعي gemini-proxy.js مباشرة (بدون فتح الموقع) يقدر
   يرسل تعليمات نظام خاصة به بالكامل متجاوزاً كل قيود خُطى. الآن جميع هذه
   الثوابت (الهوية، الأدوار الثلاثة، قواعد كل نمط) موجودة فقط داخل
   netlify/functions/gemini-proxy.js نفسها — المتصفح لا يرسل ولا يقدر
   إرسال أي تعليمات نظام إطلاقاً، فقط "mode" من قائمة محدودة ثابتة. */

// سجلّ القوائم التي يقدر مساعد خُطى ينقل الطالب إليها فعلياً داخل الموقع
// (تفعيل بصري حقيقي: تبديل تبويب أو فتح نافذة + تظليل تعريفي عند الحاجة)
// — إعداد واجهة بحتة، لا علاقة له بتعليمات النظام (تلك أصبحت في الخادم)
const NAV_TARGETS = {
    dashboard:            { type:"tab", tab:"dashboard", titleAr:"لوحتك الرئيسية", textAr:"هنا جدولك اليومي ونشاطك ومسار تقدّمك." },
    session:              { type:"tab", tab:"dashboard", elementId:"btn-plan-session", titleAr:"ابدأ جلستك", textAr:"من هنا تبدأ جلسة تركيز — يقسم المؤقت وقتك تلقائياً بين الكمي واللفظي." },
    customize_dashboard:  { type:"tab", tab:"dashboard", elementId:"btn-customize-dashboard", titleAr:"خصّص لوحتك", textAr:"أضف أو أخفِ البطاقات التي تناسبك من هنا." },
    calculator:           { type:"tab", tab:"calculator", titleAr:"حاسبة الموزونة", textAr:"احسب نسبتك الموزونة لأكثر من 30 جامعة سعودية." },
    links:                { type:"tab", tab:"links", titleAr:"الروابط المباشرة", textAr:"كل روابط مصادرك (إيهاب، المنصف، المعاصر، المفكر) في مكان واحد." },
    specialties:          { type:"tab", tab:"specialties", titleAr:"دليل التخصصات", textAr:"تصفّح أكثر من 20 تخصصاً جامعياً بتفاصيلها ومسارها الوظيفي." },
    community:            { type:"tab", tab:"community", titleAr:"المجتمع", textAr:"شاهد من يذاكر معك الآن، أو شارك بلوحة الصدارة الأسبوعية." },
    profile:              { type:"tab", tab:"profile", titleAr:"ملفك الشخصي", textAr:"إدارة حسابك، درع حماية السلسلة، وأوسمتك." },
    plan_setup:           { type:"action", action:"openSetupOverlay" },
    routine:              { type:"action", action:"openSetupOverlayRoutine" },
    board:                { type:"action", action:"openKhutaBoardFull" },
};
function openSetupOverlayRoutine(){ openSetupOverlay("routine"); }
function openKhutaBoardFull(){ openKhutaBoard("ai", true); }

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
    const opening = panel.style.display === "none" || panel.classList.contains("panel-closing");
    clearTimeout(panel.__closeT);
    if(opening){
        panel.classList.remove("panel-closing");
        panel.style.display = "flex";
    } else {
        // إغلاق متدرّج بأنيميشن بدل الاختفاء اللحظي
        panel.classList.add("panel-closing");
        panel.__closeT = setTimeout(() => { panel.style.display = "none"; panel.classList.remove("panel-closing"); }, 260);
    }
    if(opening && !panel.dataset.inited){
        panel.dataset.inited = "1";
        addChatbotMessage(currentLang==='ar' ? "أهلاً يا بطل! 👋 أقدر أحل وأشرح لك أي سؤال كمي أو لفظي، أو أدلّك على أي شي في خُطى — بس قلّي وش تبي." : "Hey champ! 👋 I can solve and explain any Quant or Verbal question, or guide you to anything in Khuta — just tell me what you need.", "bot");
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
    // مع كل رد للمساعد على سؤال فعلي: نعرض زر فتح السبورة ليشرحه المعلّم خطوة بخطوة
    if(who === "bot" && window.__lastChatUserMsg){
        const q = window.__lastChatUserMsg;
        const link = document.createElement("button");
        link.type = "button";
        link.className = "chatbot-msg-board-link";
        link.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i> ' + (currentLang==='ar' ? 'اشرحها على السبورة' : 'Explain on the board');
        link.onclick = () => explainLastOnBoard(q);
        div.appendChild(document.createElement("br"));
        div.appendChild(link);
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function askChatbot(text){
    document.getElementById("chatbot-input").value = text;
    sendChatbotMessage();
}

let chatHistory = [];
// بدل تعطيل Gemini نهائياً طوال الجلسة بعد أول فشل (كان يجبر الطالب على
// إعادة تحميل الصفحة ليعمل الذكاء الاصطناعي مجدداً حتى لو كان الفشل عارضاً
// وقتياً كبطء شبكة أو استيقاظ بطيء لخادم الدالة الوسيطة على Netlify)، نستخدم
// فترة تهدئة قصيرة: نعيد المحاولة تلقائياً بعد 30 ثانية من آخر فشل
let geminiLastFailAt = 0;
const GEMINI_RETRY_COOLDOWN_MS = 30000;
function isGeminiWorking(){ return (Date.now() - geminiLastFailAt) > GEMINI_RETRY_COOLDOWN_MS; }

async function sendChatbotMessage(){
    /* يُحفظ نص سؤال الطالب ليستعمله زر "اشرحها على السبورة" أسفل رد المساعد */
    const input = document.getElementById("chatbot-input");
    const text = input.value.trim();
    if(!text) return;
    window.__lastChatUserMsg = text;
    addChatbotMessage(text, "user");
    input.value = "";

    if(isGeminiWorking()){
        addChatbotMessage("...", "bot typing-indicator");
        try{
            const reply = await askGemini(text);
            removeTypingIndicator();
            // إن ضمّن الرد وسم توجيه بصري، نفّذه ونعرض النص بعد إزالة الوسم
            // منه فقط (الطالب لا يحتاج يرى الصياغة التقنية الداخلية)
            const { cleaned, key } = extractNavigateTag(reply);
            addChatbotMessage(cleaned, "bot");
            if(key) aiGuideNavigate(key);
            return;
        }catch(e){
            removeTypingIndicator();
            geminiLastFailAt = Date.now(); // نتحوّل للمساعد المحلي مؤقتاً، ونعيد محاولة Gemini تلقائياً بعد فترة التهدئة
            console.error("[خُطى] الذكاء الاصطناعي غير متاح مؤقتاً — تفاصيل الخطأ للمطوّر (تحقق من GEMINI_API_KEY ونشر gemini-proxy.js على Netlify):", e);
            answerLocally(text, true);
            return;
        }
    }
    answerLocally(text, false);
}

function answerLocally(text, viaFallback){
    const lower = normalizeArabic(text);
    // مطابقة صارمة أولاً (الكلمة المفتاحية كاملة)، ثم مطابقة بجذر الكلمة (أول
    // 4 أحرف على الأقل) لتغطية اختلاف اللواحق العربية— مثال: "موزونتي" تُطابق
    // كلمة "موزونة" رغم اختلاف اللاحقة، لأن نفس الجذر الأول موجود في الجملة
    let match = FAQ_BOT.find(f => f.kw.some(k => lower.includes(normalizeArabic(k))));
    if(!match){
        match = FAQ_BOT.find(f => f.kw.some(k => {
            const nk = normalizeArabic(k);
            return nk.length >= 4 && lower.includes(nk.slice(0, Math.max(4, nk.length - 2)));
        }));
    }
    setTimeout(() => {
        if(match){
            addChatbotMessage(currentLang==='ar' ? match.ar : match.en, "bot");
        } else if(viaFallback){
            // نوضّح بصراحة أن هذا تعطّل مؤقت بالذكاء الاصطناعي، لا قصوراً دائماً
            // في المساعد — حتى لا يظن الطالب أن الميزة غير موجودة أصلاً
            addChatbotMessage(currentLang==='ar'
                ? "😕 مساعدك الذكي غير متاح مؤقتاً الآن (مشكلة اتصال). جرّب ترسل سؤالك مرة ثانية بعد قليل، أو تواصل معنا مباشرة عبر واتساب من صفحة الروابط."
                : "😕 Your smart assistant is temporarily unavailable (connection issue). Try sending your question again shortly, or reach us directly via WhatsApp from the Links page.", "bot");
        } else {
            addChatbotMessage(currentLang==='ar'
                ? "ما عندي إجابة جاهزة لهذا السؤال تحديداً. جرّب صياغة أخرى، أو تواصل معنا مباشرة عبر واتساب من صفحة الروابط."
                : "I don't have a ready answer for that specific question. Try rephrasing, or reach us directly via WhatsApp from the Links page.", "bot");
        }
    }, 250);
}
// تطبيع بسيط للعربية: توحيد أشكال الألف والهمزة والتاء المربوطة/الألف
// المقصورة، وحذف التشكيل — يرفع دقة المطابقة بين صياغات الطالب المختلفة
function normalizeArabic(s){
    return String(s).toLowerCase()
        .replace(/[\u064B-\u065F]/g, "")           // التشكيل
        .replace(/[إأآا]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .trim();
}

function removeTypingIndicator(){
    const el = document.querySelector(".typing-indicator");
    if(el) el.remove();
}

// نداء موحّد آمن للدالة الوسيطة — يرسل حصراً "mode" (من قائمة محدودة يتحقق
// منها الخادم) والبيانات الفعلية اللازمة لذلك النمط. لا "model" ولا
// "system_instruction" يُرسَلان من المتصفح إطلاقاً بعد الآن (انظر الشرح
// الأمني أعلى الملف) — كلاهما مضبوطان صلباً داخل gemini-proxy.js نفسها.
async function callGeminiProxy(mode, extraFields){
    const res = await fetch("/.netlify/functions/gemini-proxy", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ mode, ...extraFields })
    });
    if(!res.ok){
        const errBody = await res.text().catch(() => "");
        console.error("[خُطى] الدالة الوسيطة رفضت الطلب — الحالة:", res.status, "التفاصيل:", errBody);
        throw new Error("Gemini proxy HTTP " + res.status);
    }
    const json = await res.json();
    const reply = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
    if(!reply) throw new Error("Empty Gemini response");
    return reply;
}

async function askGemini(userText){
    chatHistory.push({ role:"user", parts:[{ text:userText }] });
    const reply = await callGeminiProxy("chat", { history: chatHistory.slice(-10) });
    chatHistory.push({ role:"model", parts:[{ text: reply }] });
    persistCurrentConversation(); // كل تبادل ناجح مع Gemini يُحفَظ تلقائياً — انظر القسم 42 أدناه
    return reply;
}

/* ============================================================
   42) سجل محادثات المساعد الذكي — حفظ تلقائي، عنوان يولّده Gemini،
   استكمال أو حذف من تبويب "محادثاتي" داخل السبورة الذكية
   ------------------------------------------------------------
   نطاق الحفظ: محادثات Gemini الحقيقية فقط (chatHistory يُملأ حصراً من
   askGemini الناجحة) — ردود المساعد المحلي الاحتياطي عند تعطّل الاتصال
   لا تُحسب "محادثة مع الذكاء الاصطناعي" فلا تُحفَظ.
   ============================================================ */
const CHAT_CONVERSATIONS_KEY = "khuta_chat_conversations";
const MAX_SAVED_CONVERSATIONS = 30;      // حد أقصى لعدد المحادثات المحفوظة
const MAX_MESSAGES_PER_CONVERSATION = 60; // حد أقصى لطول كل محادثة عند الحفظ (يقصّ الأقدم عند الحاجة)
let currentConversationId = null; // null = محادثة لم تُحفظ بعد (ستُنشأ عند أول رد ناجح)

function getChatConversations(){
    try{ return JSON.parse(localStorage.getItem(CHAT_CONVERSATIONS_KEY) || "[]"); }catch(e){ return []; }
}
function saveChatConversations(list){
    try{ localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(list)); }
    catch(e){ console.error("[خُطى] تعذّر حفظ سجل المحادثات (قد تكون مساحة التخزين ممتلئة):", e); }
}

function persistCurrentConversation(){
    const list = getChatConversations();
    let conv = list.find(c => c.id === currentConversationId);
    if(!conv){
        conv = { id: "conv_" + Date.now().toString(36) + Math.random().toString(36).slice(2,6), title: null, messages: [], createdAt: new Date().toISOString() };
        currentConversationId = conv.id;
        list.unshift(conv);
    }
    conv.messages = chatHistory.slice(-MAX_MESSAGES_PER_CONVERSATION);
    conv.updatedAt = new Date().toISOString();
    while(list.length > MAX_SAVED_CONVERSATIONS) list.pop(); // نحذف الأقدم تحديثاً عند تجاوز الحد
    saveChatConversations(list);
    if(!conv.title && chatHistory.length >= 2) generateConversationTitle(conv.id);
    if(document.getElementById("board-tab-chats")?.classList.contains("active")) renderSavedConversationsList();
}

async function generateConversationTitle(convId){
    const list = getChatConversations();
    const conv = list.find(c => c.id === convId);
    if(!conv || conv.title) return;
    try{
        const firstExchange = conv.messages.slice(0, 4)
            .map(m => (m.role === "user" ? "الطالب: " : "المساعد: ") + (m.parts[0] && m.parts[0].text || ""))
            .join("\n");
        const rawTitle = await callGeminiProxy("title", { text: firstExchange });
        const cleanTitle = rawTitle.trim().replace(/^["'«»]+|["'«»]+$/g, "").replace(/\.$/, "").slice(0, 60);
        // نعيد قراءة القائمة (لا نعتمد على `list`/`conv` الملتقطتين قبل النداء
        // غير المتزامن، تحسّباً لأي تعديل آخر طرأ على السجل أثناء الانتظار)
        const freshList = getChatConversations();
        const freshConv = freshList.find(c => c.id === convId);
        if(freshConv && !freshConv.title){
            freshConv.title = cleanTitle || (currentLang==='ar' ? "محادثة بلا عنوان" : "Untitled conversation");
            saveChatConversations(freshList);
            renderSavedConversationsList();
        }
    }catch(e){
        console.error("[خُطى] تعذّر توليد عنوان المحادثة (ليست مشكلة حرجة، ستبقى بلا عنوان):", e);
    }
}

function renderSavedConversationsList(){
    const box = document.getElementById("chat-history-list");
    if(!box) return;
    const list = getChatConversations();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub" style="padding:8px 2px;">${labT("لا محادثات محفوظة بعد — أول محادثة حقيقية مع مساعدك ستُحفَظ هنا تلقائياً","No saved conversations yet — your first real exchange with your assistant will be saved here automatically")}</div>`;
        return;
    }
    box.innerHTML = list.map(c => {
        const dateStr = new Date(c.updatedAt || c.createdAt).toLocaleDateString(currentLang==='ar' ? 'ar-SA' : 'en-US', { day:"numeric", month:"short" });
        const title = c.title || labT("محادثة بلا عنوان بعد…","Untitled conversation…");
        return `
        <div class="chat-history-row ${c.id===currentConversationId?'active':''}">
            <button type="button" class="chat-history-open" onclick="openSavedConversation('${c.id}')">
                <b>${escapeHtml(title)}</b>
                <span>${dateStr} · ${c.messages.length} ${labT("رسالة","messages")}</span>
            </button>
            <button type="button" class="btn-ghost chat-history-del" onclick="deleteSavedConversation('${c.id}')" title="${labT("حذف","Delete")}"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join("");
}

function openSavedConversation(id){
    const conv = getChatConversations().find(c => c.id === id);
    if(!conv) return;
    currentConversationId = conv.id;
    chatHistory = conv.messages.slice();
    const box = document.getElementById("chatbot-messages");
    box.innerHTML = "";
    chatHistory.forEach(m => {
        const text = m.parts && m.parts[0] && m.parts[0].text || "";
        addChatbotMessage(text, m.role === "user" ? "user" : "bot");
    });
    closeKhutaBoard();
    const panel = document.getElementById("chatbot-panel");
    if(panel.style.display === "none" || panel.classList.contains("panel-closing")) toggleChatbot();
    renderSavedConversationsList();
    showToast(labT("📂 تابع من حيث توقفت","📂 Continuing where you left off"));
}

function deleteSavedConversation(id){
    if(!confirm(labT("حذف هذه المحادثة نهائياً؟ لا يمكن التراجع.","Delete this conversation permanently? This can't be undone."))) return;
    saveChatConversations(getChatConversations().filter(c => c.id !== id));
    if(currentConversationId === id){ currentConversationId = null; chatHistory = []; }
    renderSavedConversationsList();
}

function startNewConversation(){
    currentConversationId = null;
    chatHistory = [];
    const box = document.getElementById("chatbot-messages");
    box.innerHTML = "";
    closeKhutaBoard();
    const panel = document.getElementById("chatbot-panel");
    if(panel.style.display === "none" || panel.classList.contains("panel-closing")) toggleChatbot();
    addChatbotMessage(currentLang==='ar'
        ? "أهلاً يا بطل! 👋 محادثة جديدة — قلّي وش تبي."
        : "Hey champ! 👋 New conversation — tell me what you need.", "bot");
    renderSavedConversationsList();
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

/* ============================================================
   40) مختبر خُطى — الميزات الذكية الجديدة
   أ) سبورة يشرح عليها Gemini خطوة بخطوة (من داخل شات المساعد)
   ب) دفتر الطالب: رسم + كتابة، حفظ لوحات متعددة، إرسالها للذكاء ليحلّها
   ج) توليد اختبار محاكي كامل من ملفات الطالب (كمي/لفظي) عبر Gemini
   د) سجل الاختبارات السابقة: الدرجة + الأسئلة الخاطئة بمراجعة تفصيلية
   هـ) خطط متعددة بأسماء: حفظ/تبديل/حذف لقطات كاملة للخطة
   و) الروتين الأسبوعي (عادي/أخف/إجازة) + تواريخ مستثناة + مؤشر الضغط
   — كل النوافذ تفتح وتُغلق بأنيميشن انسيابي، لا ظهور/اختفاء مفاجئ
   ============================================================ */

/* ---------- أدوات مشتركة ---------- */
function labT(ar, en){ return currentLang === "ar" ? ar : en; }

// فتح/إغلاق أي نافذة من نوافذ المختبر بأنيميشن موحّد (فئة .lab-open + إغلاق متدرّج)
function labOverlayOpen(id){
    const el = document.getElementById(id);
    // يُلغي مؤقّت الإغلاق المعلّق من نداء إغلاق سابق سريع (فتح←إغلاق←فتح خلال
    // أقل من 380ms) — بدونه كانت النافذة تُغلَق قسراً رغم إعادة فتحها للتو
    clearTimeout(el.__closeT);
    el.style.display = "flex";
    // إجبار المتصفح على تثبيت حالة البداية قبل إضافة فئة الفتح كي يعمل الانتقال
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("lab-open")));
    document.body.style.overflow = "hidden";
}
function labOverlayClose(id){
    const el = document.getElementById(id);
    el.classList.remove("lab-open");
    clearTimeout(el.__closeT);
    el.__closeT = setTimeout(() => { el.style.display = "none"; }, 380);
    document.body.style.overflow = "";
}
// يلتقط JSON من رد النموذج حتى لو لفّه بأسوار ```json أو كلام زائد
function extractJson(text){
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let raw = fenced ? fenced[1] : text;
    const first = raw.indexOf("{"); const last = raw.lastIndexOf("}");
    if(first === -1 || last === -1) throw new Error("no json braces");
    return JSON.parse(raw.slice(first, last + 1));
}

/* ============================================================
   أ + ب) السبورة الذكية ودفتر الطالب — نافذة واحدة بتبويبين
   ============================================================ */
let boardState = { steps:[], idx:0, playing:false, playTimer:null, typeTimer:null };

function openKhutaBoard(tab, fullMode){
    labOverlayOpen("khuta-board-overlay");
    document.querySelector(".board-window").classList.toggle("full-mode", !!fullMode);
    switchBoardTab(tab || "ai");
    initStudentCanvas(); // آمنة الاستدعاء المتكرر — تُهيّئ مستمعي الرسم مرة واحدة فقط
    renderSavedBoardsList();
    // في الوضع الكامل تُعرض اللوحتان معاً على الكمبيوتر، فنقيس مساحة الرسم
    // فور الفتح (بعد إطارين لضمان اكتمال التخطيط)، لا فقط عند تبديل تبويب
    if(fullMode) requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas));
}
function closeKhutaBoard(){
    stopBoardPlayback();
    labOverlayClose("khuta-board-overlay");
}
function switchBoardTab(tab){
    document.querySelectorAll(".board-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    document.getElementById("board-tab-ai").classList.toggle("active", tab === "ai");
    document.getElementById("board-tab-pad").classList.toggle("active", tab === "pad");
    document.getElementById("board-tab-chats").classList.toggle("active", tab === "chats");
    // في الوضع الكامل، السبورة والدفتر يُعرضان جنباً إلى جنب دوماً — لكن
    // تبويب "محادثاتي" يستثني نفسه من هذا التقسيم ويأخذ العرض كاملاً وحده،
    // مطابقةً لفئة .showing-chats في CSS
    document.querySelector(".board-window").classList.toggle("showing-chats", tab === "chats");
    if(tab === "chats") renderSavedConversationsList();
    // إصلاح جذري: كانت مساحة الرسم تُقاس مرة واحدة فقط عند فتح النافذة، وغالباً
    // بينما تبويب "دفتري" لا يزال display:none (لأن التبويب الافتراضي هو
    // السبورة) — فتُقرأ أبعاد صندوق صفرية وتسقط اللوحة لحجم احتياطي صغير
    // (300×240)، تاركةً مساحة واسعة غير قابلة للرسم عليها إطلاقاً. الآن نعيد
    // القياس في كل مرة تصبح فيها لوحة "دفتري" ظاهرة فعلياً.
    if(tab === "pad") requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas));
}

/* ---------- السبورة التي يتحكم بها Gemini ---------- */
async function boardExplain(questionText){
    const q = (questionText || document.getElementById("board-ai-input").value).trim();
    if(!q){ showToast(labT("اكتب السؤال أو المفهوم أولاً", "Type the question or concept first")); return; }
    document.getElementById("board-ai-input").value = q;
    stopBoardPlayback();
    const surface = document.getElementById("board-surface");
    surface.innerHTML = `<div class="board-loading"><span class="board-chalk-dot"></span>${labT("المعلّم يحضّر الشرح…","Teacher is preparing…")}</div>`;
    setBoardControlsEnabled(false);
    try{
        const reply = await callGeminiProxy("board", { text: q });
        let data;
        try{ data = extractJson(reply); }
        catch(e){
            // خطة بديلة: نعرض الرد نصاً عادياً على السبورة بدل الفشل الكامل
            data = { title: labT("شرح","Explanation"), steps: [{ say:"", write: reply.split("\n").filter(l=>l.trim()).slice(0,8), mark:"none" }], answer:"" };
        }
        if(!Array.isArray(data.steps) || data.steps.length === 0) throw new Error("bad steps");
        boardState.steps = data.steps;
        boardState.answer = data.answer || "";
        boardState.title = data.title || "";
        boardState.idx = 0;
        surface.innerHTML = `<div class="board-title">${escapeHtml(boardState.title)}</div><div id="board-steps-area"></div>`;
        setBoardControlsEnabled(true);
        playBoardFromStart();
    }catch(e){
        console.error("[خُطى] فشل شرح السبورة:", e);
        surface.innerHTML = `<div class="board-loading">😕 ${labT("تعذّر الوصول للذكاء الاصطناعي الآن — جرّب بعد قليل","Couldn't reach the AI right now — try again shortly")}</div>`;
    }
}

function playBoardFromStart(){
    document.getElementById("board-steps-area").innerHTML = "";
    boardState.idx = 0;
    boardState.playing = true;
    updateBoardPlayBtn();
    renderNextBoardStep();
}
function renderNextBoardStep(){
    if(!boardState.playing) return;
    if(boardState.idx >= boardState.steps.length){ renderBoardAnswer(); return; }
    const step = boardState.steps[boardState.idx];
    const area = document.getElementById("board-steps-area");
    const wrap = document.createElement("div");
    wrap.className = "board-step";
    if(step.say) wrap.innerHTML += `<div class="board-say">🧑‍🏫 ${escapeHtml(step.say)}</div>`;
    const linesBox = document.createElement("div");
    linesBox.className = "board-lines" + (step.mark === "box" ? " mark-box" : "") + (step.mark === "underline" ? " mark-underline" : "");
    wrap.appendChild(linesBox);
    area.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("shown"));
    // كتابة الأسطر حرفاً حرفاً كطباشير حقيقي
    const lines = (step.write || []).map(String);
    let li = 0, ci = 0;
    const lineEls = lines.map(() => { const d = document.createElement("div"); d.className = "board-chalk-line"; linesBox.appendChild(d); return d; });
    clearInterval(boardState.typeTimer);
    boardState.typeTimer = setInterval(() => {
        if(li >= lines.length){
            clearInterval(boardState.typeTimer);
            boardState.idx++;
            boardState.playTimer = setTimeout(renderNextBoardStep, 900);
            return;
        }
        lineEls[li].textContent = lines[li].slice(0, ++ci);
        if(ci >= lines[li].length){ li++; ci = 0; }
        area.parentElement.scrollTop = area.parentElement.scrollHeight;
    }, 28);
}
function renderBoardAnswer(){
    boardState.playing = false;
    updateBoardPlayBtn();
    if(!boardState.answer) return;
    const area = document.getElementById("board-steps-area");
    const d = document.createElement("div");
    d.className = "board-answer";
    d.innerHTML = `✅ ${escapeHtml(boardState.answer)}`;
    area.appendChild(d);
    requestAnimationFrame(() => d.classList.add("shown"));
    area.parentElement.scrollTop = area.parentElement.scrollHeight;
}
function toggleBoardPlayback(){
    if(boardState.steps.length === 0) return;
    if(boardState.playing){ stopBoardPlayback(); }
    else{
        // إن كان الشرح انتهى نعيده من البداية، وإلا نكمل من حيث توقفنا
        if(boardState.idx >= boardState.steps.length) playBoardFromStart();
        else { boardState.playing = true; updateBoardPlayBtn(); renderNextBoardStep(); }
    }
}
function stopBoardPlayback(){
    boardState.playing = false;
    clearInterval(boardState.typeTimer);
    clearTimeout(boardState.playTimer);
    updateBoardPlayBtn();
}
function updateBoardPlayBtn(){
    const b = document.getElementById("board-play-btn");
    if(b) b.innerHTML = boardState.playing
        ? `<i class="fa-solid fa-pause"></i> ${labT("إيقاف","Pause")}`
        : `<i class="fa-solid fa-play"></i> ${labT("تشغيل","Play")}`;
}
function setBoardControlsEnabled(on){
    ["board-play-btn","board-replay-btn"].forEach(id => { const b=document.getElementById(id); if(b) b.disabled = !on; });
}
// يُستدعى من زر "اشرحها على السبورة" أسفل ردود المساعد
function explainLastOnBoard(text){
    openKhutaBoard("ai");
    boardExplain(text);
}

/* ---------- دفتر الطالب: رسم + كتابة + حفظ + إرسال للذكاء ---------- */
let padState = { inited:false, drawing:false, strokes:[], current:null, color:"#FFFFFF", size:3, erase:false };

// مستقلة عن initStudentCanvas عمداً كي يمكن استدعاؤها من الخارج (عند تبديل
// التبويب إلى "دفتري"، وعند فتح النافذة مباشرة في الوضع الكامل) وليس فقط
// مرة واحدة عند أول فتح للنافذة — هذا هو إصلاح خلل "لا يمكن الرسم إلا في
// مساحة صغيرة": القياس السابق كان يحدث أحياناً بينما اللوحة لا تزال
// display:none فتُقرأ أبعاد صفرية وتسقط لحجم احتياطي 300×240 صغير.
function resizePadCanvas(){
    const canvas = document.getElementById("student-pad-canvas");
    if(!canvas) return;
    const box = canvas.parentElement.getBoundingClientRect();
    // لا نقيس إن كانت اللوحة غير ظاهرة فعلياً بعد (أبعاد صفرية) — نتجنّب
    // تجميد اللوحة على الحجم الاحتياطي الصغير؛ سيُعاد استدعاؤنا لاحقاً
    // عند تبديل التبويب أو فتح الوضع الكامل فور ظهورها.
    if(box.width < 10 || box.height < 10) return;
    canvas.width = Math.round(box.width - 4);
    canvas.height = Math.round(box.height - 4);
    redrawPad(); // نعيد رسم كل الخطوط المحفوظة بعد تغيّر الأبعاد
}

function initStudentCanvas(){
    if(padState.inited) return;
    padState.inited = true;
    const canvas = document.getElementById("student-pad-canvas");
    const ctx = canvas.getContext("2d");
    window.addEventListener("resize", () => { if(document.getElementById("khuta-board-overlay").style.display !== "none") resizePadCanvas(); });
    requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas)); // إن كان "دفتري" هو التبويب الظاهر فوراً
    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const down = (e) => {
        padState.drawing = true;
        padState.current = { color: padState.erase ? "__erase__" : padState.color, size: padState.erase ? 22 : padState.size, pts: [pos(e)] };
        e.preventDefault();
    };
    const move = (e) => {
        if(!padState.drawing) return;
        padState.current.pts.push(pos(e));
        drawStroke(ctx, padState.current, true);
        e.preventDefault();
    };
    const up = () => {
        if(!padState.drawing) return;
        padState.drawing = false;
        if(padState.current && padState.current.pts.length > 1) padState.strokes.push(padState.current);
        padState.current = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("touchstart", down, {passive:false});
    canvas.addEventListener("touchmove", move, {passive:false});
    window.addEventListener("touchend", up);
}
function drawStroke(ctx, s, lastSegOnly){
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = s.size;
    ctx.globalCompositeOperation = s.color === "__erase__" ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color === "__erase__" ? "rgba(0,0,0,1)" : s.color;
    const pts = s.pts;
    ctx.beginPath();
    const from = lastSegOnly ? Math.max(0, pts.length - 2) : 0;
    ctx.moveTo(pts[from].x, pts[from].y);
    for(let i = from + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
}
function redrawPad(){
    const canvas = document.getElementById("student-pad-canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    padState.strokes.forEach(s => drawStroke(ctx, s, false));
}
function padSetColor(c, btn){
    padState.color = c; padState.erase = false;
    document.querySelectorAll(".pad-color").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("pad-eraser-btn").classList.remove("active");
}
function padToggleEraser(btn){
    padState.erase = !padState.erase;
    btn.classList.toggle("active", padState.erase);
}
function padUndo(){ padState.strokes.pop(); redrawPad(); }
function padClear(){ padState.strokes = []; redrawPad(); }

const PAD_STORE_KEY = "khuta_student_boards";
function getSavedBoards(){ try{ return JSON.parse(localStorage.getItem(PAD_STORE_KEY) || "[]"); }catch(e){ return []; } }
function saveCurrentBoard(){
    const name = (document.getElementById("pad-name-input").value || "").trim() || labT("لوحة بدون اسم","Untitled board");
    const canvas = document.getElementById("student-pad-canvas");
    // نصغّر الصورة المحفوظة (جودة 0.75) حتى لا نستهلك مساحة التخزين المحلي
    const img = padState.strokes.length ? canvas.toDataURL("image/jpeg", 0.75) : "";
    const list = getSavedBoards();
    list.unshift({ id: Date.now().toString(36), name, date: new Date().toISOString(), img, text: document.getElementById("pad-text-input").value || "" });
    while(list.length > 12) list.pop();
    try{ localStorage.setItem(PAD_STORE_KEY, JSON.stringify(list)); }
    catch(e){ showToast(labT("مساحة التخزين ممتلئة — احذف لوحات قديمة","Storage full — delete old boards")); return; }
    showToast(labT("💾 حُفظت اللوحة: ","💾 Saved: ") + name);
    document.getElementById("pad-name-input").value = "";
    renderSavedBoardsList();
}
function renderSavedBoardsList(){
    const box = document.getElementById("pad-saved-list");
    if(!box) return;
    const list = getSavedBoards();
    if(list.length === 0){ box.innerHTML = `<div class="card-sub" style="padding:6px 2px;">${labT("لا لوحات محفوظة بعد","No saved boards yet")}</div>`; return; }
    box.innerHTML = list.map(b => `
        <div class="pad-saved-row">
            <button type="button" class="pad-saved-open" onclick="openSavedBoard('${b.id}')" title="${labT("فتح","Open")}">
                <b>${escapeHtml(b.name)}</b>
                <span>${new Date(b.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US')}</span>
            </button>
            <button type="button" class="btn-ghost pad-saved-del" onclick="deleteSavedBoard('${b.id}')" title="${labT("حذف","Delete")}"><i class="fa-solid fa-trash"></i></button>
        </div>`).join("");
}
function openSavedBoard(id){
    const b = getSavedBoards().find(x => x.id === id);
    if(!b) return;
    document.getElementById("pad-text-input").value = b.text || "";
    padState.strokes = [];
    redrawPad();
    if(b.img){
        const canvas = document.getElementById("student-pad-canvas");
        const ctx = canvas.getContext("2d");
        const im = new Image();
        im.onload = () => { ctx.drawImage(im, 0, 0, canvas.width, canvas.height); };
        im.src = b.img;
    }
    showToast(labT("📂 فُتحت: ","📂 Opened: ") + b.name);
}
function deleteSavedBoard(id){
    const list = getSavedBoards().filter(x => x.id !== id);
    localStorage.setItem(PAD_STORE_KEY, JSON.stringify(list));
    renderSavedBoardsList();
}
async function sendPadToAI(){
    const rawText = document.getElementById("pad-text-input").value.trim();
    const hasDrawing = padState.strokes.length > 0;
    if(!rawText && !hasDrawing){ showToast(labT("اكتب أو ارسم شيئاً أولاً","Write or draw something first")); return; }
    const out = document.getElementById("pad-ai-answer");
    out.style.display = "block";
    out.innerHTML = `<span class="board-chalk-dot"></span>${labT("الذكاء يحلّل دفترك…","AI is analyzing your pad…")}`;

    let text = rawText ? (labT("ما كتبه الطالب: ","Student wrote: ") + rawText) : "";
    let image = null;
    if(hasDrawing){
        // نرسل الرسم كصورة — Gemini Flash يدعم الرؤية، والوسيط يبنيها ضمن الطلب.
        // نرسم فوق خلفية داكنة أولاً لأن الشفاف يتحول أسودَ في JPEG فيختفي الحبر الداكن
        const src = document.getElementById("student-pad-canvas");
        const tmp = document.createElement("canvas");
        tmp.width = src.width; tmp.height = src.height;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = "#1a1440"; tctx.fillRect(0,0,tmp.width,tmp.height);
        tctx.drawImage(src, 0, 0);
        const dataUrl = tmp.toDataURL("image/jpeg", 0.8);
        image = dataUrl.split(",")[1]; // Base64 فقط، بلا بادئة data:URL
        if(!text) text = labT("حلّل الرسم المرفق وحُلّه.","Analyze the attached drawing and solve it.");
    }
    try{
        const reply = await callGeminiProxy("pad", { text, image });
        out.innerHTML = `<b>🧑‍🏫 ${labT("حل المعلّم:","Teacher's solution:")}</b><div class="pad-ai-text">${escapeHtml(reply).replace(/\n/g,"<br>")}</div>`;
    }catch(e){
        console.error("[خُطى] فشل تحليل الدفتر:", e);
        out.innerHTML = hasDrawing && !rawText
            ? labT("😕 تعذّر إرسال الرسم — جرّب كتابة المسألة نصاً في خانة الكتابة","😕 Couldn't send the drawing — try typing the problem instead")
            : labT("😕 تعذّر الوصول للذكاء الاصطناعي الآن — جرّب بعد قليل","😕 Couldn't reach the AI — try again shortly");
    }
}

/* ============================================================
   ج) توليد اختبار محاكي من ملفات الطالب (كمي/لفظي)
   ============================================================ */
let customExamFiles = { quant:"", verbal:"" };

async function readStudyFile(input, kind){
    const file = input.files && input.files[0];
    const label = document.getElementById("customexam-" + kind + "-name");
    if(!file){ customExamFiles[kind] = ""; label.textContent = ""; return; }
    label.textContent = "⏳ " + file.name;
    try{
        let text = "";
        if(/\.pdf$/i.test(file.name)){
            text = await extractPdfText(file);
        } else {
            text = await file.text();
        }
        // نقصّ النص لحد آمن يناسب حجم الطلب — كافٍ جداً لتوليد أسئلة متنوعة
        customExamFiles[kind] = text.slice(0, 16000);
        label.textContent = "✅ " + file.name + ` (${Math.min(text.length,16000).toLocaleString()} ${labT("حرف","chars")})`;
    }catch(e){
        console.error("[خُطى] فشل قراءة الملف:", e);
        customExamFiles[kind] = "";
        label.textContent = "❌ " + labT("تعذّرت القراءة — جرّب ملف txt أو pdf نصّي (غير مصوَّر)","Read failed — try a text-based txt/pdf");
    }
}
// تحميل pdf.js كسولاً من CDN عند أول حاجة فقط
let pdfjsReady = null;
function loadPdfJs(){
    if(pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve(window.pdfjsLib);
        };
        s.onerror = () => reject(new Error("pdfjs load failed"));
        document.head.appendChild(s);
    });
    return pdfjsReady;
}
async function extractPdfText(file){
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let all = "";
    const maxPages = Math.min(doc.numPages, 40);
    for(let p = 1; p <= maxPages && all.length < 20000; p++){
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        all += tc.items.map(i => i.str).join(" ") + "\n";
    }
    if(all.trim().length < 60) throw new Error("pdf has no extractable text (scanned?)");
    return all;
}

async function generateCustomExam(){
    const qCount = parseInt(document.getElementById("customexam-qcount").value) || 10;
    const hasQ = !!customExamFiles.quant, hasV = !!customExamFiles.verbal;
    if(!hasQ && !hasV){ showToast(labT("ارفع ملفاً واحداً على الأقل (كمي أو لفظي)","Upload at least one file")); return; }
    const btn = document.getElementById("customexam-generate-btn");
    const status = document.getElementById("customexam-status");
    btn.disabled = true;
    status.innerHTML = `<span class="board-chalk-dot"></span>${labT("الذكاء يقرأ ملفاتك ويؤلّف الأسئلة… (قد يستغرق حتى دقيقة)","AI is reading your files and writing questions…")}`;
    const pool = { quant:[], verbal:[] };
    try{
        const jobs = [];
        if(hasQ) jobs.push(["quant", customExamFiles.quant]);
        if(hasV) jobs.push(["verbal", customExamFiles.verbal]);
        for(const [kind, content] of jobs){
            const label = kind === "quant" ? "كمية (رياضيات/حساب/هندسة/تحليل)" : "لفظية (استيعاب/تناظر/إكمال/معنى)";
            const reply = await callGeminiProxy("exam",
                { text: `ولّد ${qCount} سؤالاً من نوع أسئلة القدرات ال${label} من هذا المحتوى:\n\n${content}`, section: kind });
            const data = extractJson(reply);
            const valid = (data.questions || []).filter(q =>
                q && typeof q.text === "string" && Array.isArray(q.choices) && q.choices.length === 4 &&
                Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
            ).map((q, i) => ({
                id: "cf_" + kind + "_" + i + "_" + Date.now().toString(36),
                text: q.text, choices: q.choices.map(String), correct: q.correct,
                explain: typeof q.explain === "string" ? q.explain : "",
                source: labT("مولَّد من ملفك 📄","Generated from your file 📄"),
            }));
            pool[kind] = valid;
        }
        const total = pool.quant.length + pool.verbal.length;
        if(total === 0) throw new Error("no valid questions");
        localStorage.setItem("khuta_custom_exam_pool", JSON.stringify(pool));
        status.innerHTML = `✅ ${labT(`جاهز! تولّد ${total} سؤالاً (${pool.quant.length} كمي، ${pool.verbal.length} لفظي)`, `Ready! ${total} questions generated`)}`;
        document.getElementById("customexam-start-btn").style.display = "inline-flex";
    }catch(e){
        console.error("[خُطى] فشل توليد الاختبار:", e);
        status.textContent = labT("😕 تعذّر التوليد — تأكد أن الملف نصّي واضح وجرّب مجدداً","😕 Generation failed — make sure the file is clear text and retry");
    }
    btn.disabled = false;
}
function startCustomExam(){
    let pool = null;
    try{ pool = JSON.parse(localStorage.getItem("khuta_custom_exam_pool") || "null"); }catch(e){}
    const quantPool = shuffleArray(pool && pool.quant || []);
    const verbalPool = shuffleArray(pool && pool.verbal || []);
    const totalQ = quantPool.length + verbalPool.length;
    if(totalQ === 0){
        showToast(labT("ولّد الاختبار من ملفاتك أولاً","Generate the exam from your files first")); return;
    }
    // نفس بنية "5 أقسام" الحقيقية إن كان البنك كبيراً بما يكفي ليكون لها معنى
    // (على الأقل ~3 أسئلة لكل قسم)، وإلا قسم واحد فقط لتفادي أقسام شبه فارغة
    const sectionCount = totalQ >= 15 ? EXAM_SECTION_COUNT : 1;
    const sections = splitIntoSections(quantPool, verbalPool, sectionCount);
    examState = buildSectionedExamState({ sections, scaledDown:false }, "custom", false, true);
    openExamOverlay();
}

/* ============================================================
   د) سجل الاختبارات السابقة
   ============================================================ */
const EXAM_HISTORY_KEY = "khuta_exam_history";
function getExamHistory(){ try{ return JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || "[]"); }catch(e){ return []; } }
function recordExamAttempt(state){
    if(!state || !state.score) return;
    const wrong = state.questions
        .filter(q => state.answers[q.id] !== q.correct)
        .map(q => ({
            text: q.text, choices: q.choices, correct: q.correct,
            chosen: (q.id in state.answers) ? state.answers[q.id] : null,
            type: q.type, explain: q.explain || "", source: q.source || "",
        }));
    const list = getExamHistory();
    list.unshift({
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        type: state.type,
        fromFiles: !!state.fromFiles,
        score: state.score,
        wrong,
    });
    while(list.length > 30) list.pop();
    try{ localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(list)); }catch(e){ /* التخزين ممتلئ — نتجاهل بصمت */ }
    renderExamHistory();
}
function examTypeLabel(a){
    if(a.fromFiles || a.type === "custom") return labT("من ملفاتك 📄","From your files 📄");
    return a.type === "full" ? labT("قدرات كامل","Full GAT") : a.type === "quant" ? labT("كمي","Quant") : labT("لفظي","Verbal");
}
function renderExamHistory(){
    const box = document.getElementById("exam-history-list");
    if(!box) return;
    const list = getExamHistory();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub">${labT("لم تختبر بعد — أول اختبار لك سيُسجَّل هنا تلقائياً","No attempts yet — your first exam will be recorded here")}</div>`;
        return;
    }
    box.innerHTML = list.map(a => `
        <div class="examhist-row" id="examhist-${a.id}">
            <button type="button" class="examhist-head" onclick="toggleExamHistRow('${a.id}')">
                <span class="examhist-pct" style="color:${a.score.pct >= 70 ? 'var(--teal)' : a.score.pct >= 50 ? 'var(--gold)' : 'var(--rose)'}">${a.score.pct}%</span>
                <span class="examhist-meta">
                    <b>${examTypeLabel(a)}</b>
                    <span>${new Date(a.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US', {weekday:"short", day:"numeric", month:"short"})} · ${a.score.correctCount}/${a.score.total} · ${labT("أخطاء:","Wrong:")} ${a.wrong.length}</span>
                </span>
                <i class="fa-solid fa-chevron-down examhist-chev"></i>
            </button>
            <div class="examhist-body">
                <div class="examhist-body-inner">
                    ${a.wrong.length === 0
                        ? `<div class="card-sub">🎉 ${labT("لا أخطاء في هذه المحاولة!","No mistakes this attempt!")}</div>`
                        : a.wrong.map(w => `
                        <div class="examhist-q">
                            <div class="examhist-qtext">${escapeHtml(w.text)}</div>
                            <div class="examhist-qrow wrong">✗ ${labT("إجابتك:","Your answer:")} ${w.chosen === null ? labT("(لم تُجب)","(unanswered)") : escapeHtml(String(w.choices[w.chosen]))}</div>
                            <div class="examhist-qrow right">✓ ${labT("الصحيحة:","Correct:")} ${escapeHtml(String(w.choices[w.correct]))}</div>
                            ${w.explain ? `<div class="examhist-qrow expl">💡 ${escapeHtml(w.explain)}</div>` : ""}
                        </div>`).join("")}
                    <button type="button" class="btn-ghost examhist-del" onclick="deleteExamAttempt('${a.id}')"><i class="fa-solid fa-trash"></i> ${labT("حذف المحاولة","Delete attempt")}</button>
                </div>
            </div>
        </div>`).join("");
}
function toggleExamHistRow(id){
    document.getElementById("examhist-" + id).classList.toggle("open");
}
function deleteExamAttempt(id){
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(getExamHistory().filter(a => a.id !== id)));
    renderExamHistory();
}

/* ============================================================
   هـ) خطط متعددة بأسماء (لقطات كاملة) + و) الروتين الأسبوعي
   ============================================================ */
// نفس مجموعة مفاتيح الخطة المعتمدة في "البدء من جديد" — هي تعريف "الخطة" الرسمي في التطبيق
const PLAN_SNAPSHOT_KEYS = [
    "khuta_config", "khuta_plan_days", "khuta_plan_start", "khuta_session_minutes",
    "khuta_task_status", "khuta_task_status_date", "khuta_xp_awarded_today",
    "khuta_completed_dates", "khuta_missed_days_count", "khuta_postponed_dates", "khuta_redday_tracking_start",
    "khuta_today_scale", "khuta_streak", "khuta_streak_last",
    "khuta_checkin_verbal", "khuta_checkin_quant", "khuta_quant_share",
    "khuta_last_session_minutes", "khuta_custom_tasks", "khuta_start_section",
    "khuta_exam_date", "khuta_autobreak_minutes", "khuta_short_break_limit",
    "khuta_week_routine", "khuta_excluded_dates",
];
const PLANS_STORE_KEY = "khuta_saved_plans";
function getSavedPlans(){ try{ return JSON.parse(localStorage.getItem(PLANS_STORE_KEY) || "[]"); }catch(e){ return []; } }

// ملاحظة: openPlansOverlay()/closePlansOverlay() القديمتان أُزيلتا — نافذتهما
// المستقلة دُمجت بالكامل داخل خطوتي "الخطط المحفوظة" و"الروتين الأسبوعي"
// ضمن المعالج التدريجي (انظر openSetupOverlay وgoToWizStep أعلى الملف).

function saveCurrentPlanAs(){
    const name = (document.getElementById("plan-name-input").value || "").trim();
    if(!name){ showToast(labT("اكتب اسماً للخطة أولاً","Name the plan first")); return; }
    const snapshot = {};
    PLAN_SNAPSHOT_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if(v !== null) snapshot[k] = v;
    });
    const list = getSavedPlans().filter(p => p.name !== name); // نفس الاسم = تحديث
    list.unshift({ id: Date.now().toString(36), name, date: new Date().toISOString(), snapshot });
    while(list.length > 8) list.pop();
    try{ localStorage.setItem(PLANS_STORE_KEY, JSON.stringify(list)); }
    catch(e){ showToast(labT("مساحة التخزين ممتلئة","Storage full")); return; }
    document.getElementById("plan-name-input").value = "";
    showToast(labT("💾 حُفظت الخطة: ","💾 Plan saved: ") + name);
    renderSavedPlansList();
}
function applySavedPlan(id){
    const p = getSavedPlans().find(x => x.id === id);
    if(!p) return;
    // نمسح مفاتيح الخطة الحالية ثم نكتب اللقطة — دون أي location.reload
    // (الدرس الموثَّق: إعادة التحميل كانت تُظهر شاشة الدخول خطأً أحياناً)
    PLAN_SNAPSHOT_KEYS.forEach(k => localStorage.removeItem(k));
    Object.entries(p.snapshot).forEach(([k, v]) => localStorage.setItem(k, v));
    // نفس تسلسل إعادة البناء المجرَّب في "البدء من جديد"
    buildScheduleTable();
    renderProgress();
    renderGamification();
    renderBadges();
    switchTab("dashboard");
    renderRoutineEditor();
    renderExcludedDates();
    updateRoutinePressure();
    // إغلاق مباشر للمعالج التدريجي نفسه (وليس النافذة المنفصلة القديمة التي
    // حُذفت بعد دمج "خططي والروتين" داخل المعالج) — آمن دائماً هنا لأن
    // الخطة أصبحت فعّالة للتو (khuta_plan_days مضبوط من اللقطة أعلاه)
    document.getElementById("setup-overlay").style.display = "none";
    showToast(labT("📚 انتقلت للخطة: ","📚 Switched to plan: ") + p.name);
}
function deleteSavedPlan(id){
    localStorage.setItem(PLANS_STORE_KEY, JSON.stringify(getSavedPlans().filter(p => p.id !== id)));
    renderSavedPlansList();
}
function renderSavedPlansList(){
    const box = document.getElementById("plans-saved-list");
    if(!box) return;
    const list = getSavedPlans();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub">${labT("لا خطط محفوظة بعد — احفظ خطتك الحالية باسم لتعود لها متى شئت","No saved plans yet")}</div>`;
        return;
    }
    box.innerHTML = list.map(p => `
        <div class="plan-row">
            <div class="plan-row-info">
                <b>${escapeHtml(p.name)}</b>
                <span>${new Date(p.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US')} · ${p.snapshot.khuta_plan_days ? p.snapshot.khuta_plan_days + " " + labT("يوم","days") : ""}</span>
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="applySavedPlan('${p.id}')">${labT("تفعيل","Activate")}</button>
            <button type="button" class="btn-ghost pad-saved-del" onclick="deleteSavedPlan('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>`).join("");
}

/* ---------- الروتين الأسبوعي + التواريخ المستثناة + مؤشر الضغط ---------- */
const ROUTINE_KEY = "khuta_week_routine";       // مصفوفة 7 قيم: 0=عادي، 1=أخف، 2=إجازة (الفهرس 0=الأحد)
const EXCLUDED_KEY = "khuta_excluded_dates";     // مصفوفة تواريخ YYYY-MM-DD (سفر/ظروف)
function getWeekRoutine(){
    try{
        const r = JSON.parse(localStorage.getItem(ROUTINE_KEY) || "null");
        if(Array.isArray(r) && r.length === 7) return r;
    }catch(e){}
    return [0,0,0,0,0,0,0];
}
function getExcludedDates(){ try{ return JSON.parse(localStorage.getItem(EXCLUDED_KEY) || "[]"); }catch(e){ return []; } }

function renderRoutineEditor(){
    const box = document.getElementById("routine-days-grid");
    if(!box) return;
    const routine = getWeekRoutine();
    const days = currentLang === "ar"
        ? ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]
        : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const modes = [
        { v:0, label: labT("عادي","Normal"),  cls:"mode-normal" },
        { v:1, label: labT("أخف","Lighter"),  cls:"mode-light" },
        { v:2, label: labT("إجازة","Off"),    cls:"mode-off" },
    ];
    box.innerHTML = days.map((d, i) => `
        <div class="routine-day">
            <div class="routine-day-name">${d}</div>
            <div class="routine-day-modes">
                ${modes.map(m => `<button type="button" class="routine-mode ${m.cls} ${routine[i]===m.v?'active':''}" onclick="setRoutineDay(${i},${m.v})">${m.label}</button>`).join("")}
            </div>
        </div>`).join("");
}
function setRoutineDay(dayIdx, mode){
    const r = getWeekRoutine();
    r[dayIdx] = mode;
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(r));
    renderRoutineEditor();
    updateRoutinePressure();
    updateTodayRoutinePill();
}
function addExcludedDate(){
    const val = document.getElementById("excluded-date-input").value;
    if(!val) return;
    const list = getExcludedDates();
    if(!list.includes(val)) list.push(val);
    list.sort();
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(list));
    document.getElementById("excluded-date-input").value = "";
    renderExcludedDates();
    updateRoutinePressure();
}
function removeExcludedDate(d){
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(getExcludedDates().filter(x => x !== d)));
    renderExcludedDates();
    updateRoutinePressure();
}
function renderExcludedDates(){
    const box = document.getElementById("excluded-dates-list");
    if(!box) return;
    const list = getExcludedDates();
    box.innerHTML = list.length === 0
        ? `<span class="card-sub">${labT("لا تواريخ مستثناة","No excluded dates")}</span>`
        : list.map(d => `<span class="excluded-chip">${d} <button type="button" onclick="removeExcludedDate('${d}')" aria-label="حذف">×</button></span>`).join("");
}
/* مؤشر الضغط: يقارن أيام الخطة المتبقية بأيام المذاكرة الفعلية المتاحة حتى
   موعد الاختبار (بعد خصم أيام الإجازة الأسبوعية والتواريخ المستثناة،
   واحتساب "الأخف" نصف يوم) — ويخبر الطالب بصراحة: مضغوط / متوازن / مرتاح */
function computeRoutinePressure(){
    const routine = getWeekRoutine();
    const excluded = new Set(getExcludedDates());
    const planDays = parseInt(localStorage.getItem("khuta_plan_days") || "0");
    const startStr = localStorage.getItem("khuta_plan_start");
    const examStr = localStorage.getItem("khuta_exam_date");
    const now = (typeof khutaNow === "function") ? khutaNow() : new Date();
    let daysDone = 0;
    if(startStr){
        daysDone = Math.max(0, Math.floor((now - new Date(startStr)) / 86400000));
    }
    const remainingPlanDays = Math.max(0, planDays - daysDone);
    if(!examStr || !planDays){
        return { ok:false, remainingPlanDays };
    }
    const exam = new Date(examStr + "T00:00:00");
    let effective = 0, calendar = 0;
    const cur = new Date(now); cur.setHours(0,0,0,0);
    while(cur < exam && calendar < 400){
        const iso = cur.toISOString().slice(0,10);
        const mode = excluded.has(iso) ? 2 : routine[cur.getDay()];
        if(mode === 0) effective += 1;
        else if(mode === 1) effective += 0.5;
        cur.setDate(cur.getDate() + 1);
        calendar++;
    }
    effective = Math.round(effective * 2) / 2;
    // كم يوماً من أيام الأسبوع السبعة إجازة كاملة في الروتين الثابت نفسه
    // (بمعزل عن التواريخ المستثناة المؤقتة) — يُستخدم لرسائل الحالات القصوى
    const offDaysInRoutine = routine.filter(m => m === 2).length;

    let level, msg;
    if(offDaysInRoutine === 7){
        // الحالة القصوى: كل أيام الأسبوع إجازة في الروتين الثابت — رسالة
        // ساخنة صريحة بدل رسالة "مضغوط" العامة، لأن الرقم وحده (0 فعلياً)
        // لا يوصل حجم المفارقة بنفس وضوح جملة مباشرة
        level = "tight";
        msg = labT("🤨 خطتك كلها إجازة! سبعة أيام إجازة في نفس الأسبوع؟ يعطيك العافية بس... متى بالضبط ناوي تذاكر؟ رجّع يوماً واحداً على الأقل عادي.",
                   "🤨 Your whole week is off?! Seven vacation days in the same week — respect the hustle, but... when exactly do you plan to study? Bring back at least one normal day.");
    } else if(remainingPlanDays === 0){
        level = "ok"; msg = labT("خطتك مكتملة تقريباً 🎉","Plan nearly complete 🎉");
    } else if(offDaysInRoutine >= 4){
        // أغلب الأسبوع إجازة (4 أيام فأكثر من 7) — تنبيه واضح لكن أهدأ من
        // الحالة القصوى أعلاه، بغضّ النظر عن نتيجة حساب الأيام الفعلية
        level = "tight";
        msg = labT(`⚠️ ${offDaysInRoutine} من أيام أسبوعك إجازة — هذا كثير. تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} فعلياً؛ فكّر تحوّل بعضها لـ"أخف" بدل الإجازة الكاملة`,
                   `⚠️ ${offDaysInRoutine} of your 7 days are off — that's a lot. You need ${remainingPlanDays} study days but only have ${effective}; consider switching some to "Lighter" instead of fully off`);
    } else if(effective < remainingPlanDays){
        level = "tight";
        msg = labT(`مضغوط: تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} فعلياً قبل الاختبار — قلّل الإجازات أو خفّف أقل`,
                   `Tight: need ${remainingPlanDays} study days but only ${effective} available`);
    }
    else if(effective > remainingPlanDays * 1.6){
        level = "loose";
        msg = labT(`مرتاح جداً: تحتاج ${remainingPlanDays} يوماً ولديك ${effective} — لا بأس، لكن لا تخفف أكثر من اللازم`,
                   `Very relaxed: need ${remainingPlanDays}, have ${effective}`);
    }
    else{
        level = "ok";
        msg = labT(`متوازن: تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} متاحة قبل الاختبار 👌`,
                   `Balanced: need ${remainingPlanDays}, have ${effective} 👌`);
    }
    return { ok:true, level, msg, needed: remainingPlanDays, available: effective };
}
function updateRoutinePressure(){
    const box = document.getElementById("routine-pressure");
    if(!box) return;
    const p = computeRoutinePressure();
    if(!p.ok){
        box.className = "routine-pressure";
        box.innerHTML = labT("حدّد موعد اختبارك وخطتك أولاً ليظهر مؤشر الضغط هنا","Set your exam date and plan first to see the pressure meter");
        return;
    }
    box.className = "routine-pressure level-" + p.level;
    const fill = Math.min(100, Math.round((p.needed / Math.max(p.available, 0.5)) * 100));
    box.innerHTML = `
        <div class="routine-pressure-msg">${p.msg}</div>
        <div class="routine-pressure-bar"><div style="width:${fill}%"></div></div>`;
}
// شارة صغيرة على لوحة اليوم حين يكون اليوم "أخف" أو "إجازة" حسب روتينك
function updateTodayRoutinePill(){
    const pill = document.getElementById("today-routine-pill");
    if(!pill) return;
    const now = (typeof khutaNow === "function") ? khutaNow() : new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const mode = getExcludedDates().includes(iso) ? 2 : getWeekRoutine()[now.getDay()];
    if(mode === 0){ pill.style.display = "none"; return; }
    pill.style.display = "inline-flex";
    pill.textContent = mode === 2 ? labT("🏖️ اليوم إجازة حسب روتينك","🏖️ Off day per your routine")
                                  : labT("🍃 اليوم أخف حسب روتينك","🍃 Lighter day per your routine");
}

/* ---------- تهيئة الوحدة عند الإقلاع ---------- */
window.addEventListener("load", () => {
    // متأخرة قليلاً بعد إقلاع التطبيق الأساسي
    setTimeout(() => {
        renderExamHistory();
        updateTodayRoutinePill();
        const pool = localStorage.getItem("khuta_custom_exam_pool");
        if(pool){ const b = document.getElementById("customexam-start-btn"); if(b) b.style.display = "inline-flex"; }
    }, 400);
});

/* ============================================================
   41) الوصولية — دعم لوحة المفاتيح لكل العناصر القابلة للنقر المبنية على
   div/span (قوائم التنقّل، رقائق الاختيار، عيّنات الألوان) بدل <button>
   ------------------------------------------------------------
   هذه العناصر أُضيف لها role="button" و tabindex="0" في HTML (بدل تحويلها
   فعلياً إلى <button> تفادياً لأي كسر بصري في تنسيقاتها الحالية القائمة
   على div/span) — هذا المستمع الوحيد يفعّل تشغيلها بمفتاحي Enter/Space
   كأي زر حقيقي، لأي عنصر كهذا حالياً أو يُضاف مستقبلاً بنفس النمط، دون
   حاجة لتكرار معالج لكل عنصر على حدة.
   ============================================================ */
document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    const el = e.target;
    if(el && el.getAttribute && el.getAttribute("role") === "button" && el.hasAttribute("onclick")){
        e.preventDefault(); // تفادي تمرير الصفحة عند الضغط على مسطرة المسافة
        el.click();
    }
});
