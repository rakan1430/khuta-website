/* ============================================================
   00) هوية النسخة (Tenant) — يُحمَّل قبل كل شيء
   ------------------------------------------------------------
   منصة واحدة وقاعدة بيانات واحدة. ما يختلف بين العنوانين هو المدخل فقط:
   خُطى مدخل الطلاب العام، وبوابة المدرسة مدخل تقديم المعلمين ودخول الإدارة.

   ⚠️ أقسام المدرسة لا تظهر بالعنوان إطلاقاً — بل لمن أضافته إدارة المدرسة
   في قاعدة البيانات، أياً كان العنوان الذي دخل منه. مستخدم خُطى العادي لا
   يرى منها شيئاً (مُتحقَّق: صفر صفوف في كل جداول المدرسة).

   لماذا هكذا ولماذا لا ننسخ المشروع؟
   لأن نسخة ثانية من 16 ألف سطر تعني إصلاح كل خلل مرتين، وخلال أسابيع
   تفترق النسختان فيصير كل تعديل مخاطرة. هنا: إصلاح واحد يخدم الجميع.

   ➕ لإضافة مدرسة جديدة لاحقاً:
      1) أنشئ موقعاً جديداً على Netlify من نفس هذا المستودع.
      2) أضف كتلة جديدة في TENANTS أدناه بنفس الشكل.
      3) اربطها بعنوانها في HOSTNAME_MAP.
      لا حاجة لتعديل أي ملف آخر إطلاقاً.

   ⚠️ مفاتيح Supabase أدناه من نوع "publishable" — معلنة بطبيعتها ومصمَّمة
   لتوضع في كود المتصفح. الحماية الحقيقية في سياسات RLS داخل قاعدة البيانات،
   لا في إخفاء المفتاح. لا تضع هنا أبداً مفتاح service_role.
   ============================================================ */

const SUPABASE_SHARED = {
    url: "https://squhkiwjwwyrgufkaujf.supabase.co",
    key: "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84",
};

const TENANTS = {
    /* المنصة كما يراها أي زائر: خُطى للقدرات، بلا أي أثر للمدرسة */
    khuta: {
        id: "khuta",
        brandAr: "خُطى", brandEn: "Khuta",
        taglineAr: "", taglineEn: "",
        supabaseUrl: SUPABASE_SHARED.url,
        supabaseKey: SUPABASE_SHARED.key,
        features: {
            gat: true, community: true, guestMode: true, passwordAuth: true, ai: true,
            // ⚠️ ليست ميزة نسخة بعد اليوم: أقسام المدرسة تظهر لمن أضافته
            // الإدارة فقط، ويحدَّد ذلك بعد تسجيل الدخول من عضويته في
            // قاعدة البيانات — لا من عنوان الموقع. انظر js/13-school.js.
            school: false,
        },
    },

    /* بوابة المدرسة: نفس المنصة ونفس القاعدة، لكنها مدخل مخصّص —
       منه يقدّم المعلم طلبه، ومنه تدخل الإدارة بحسابها. */
    motaqadima: {
        id: "motaqadima",
        brandAr: "خُطى", brandEn: "Khuta",
        taglineAr: "بوابة مدارس المتقدمة",
        taglineEn: "Al-Motaqadima Schools Portal",
        schoolSlug: "motaqadima",
        schoolName: "مدارس المتقدمة — فرع الملقا",
        supabaseUrl: SUPABASE_SHARED.url,
        supabaseKey: SUPABASE_SHARED.key,
        features: {
            gat: false, community: false, school: false,
            guestMode: false, passwordAuth: true, ai: false,
            portal: true,   // شاشة البوابة: تقديم معلم + دخول إدارة
        },
    },
};

/* أي عنوان يقود إلى أي نسخة. المفتاح جزء من اسم النطاق (مطابقة احتواء). */
const HOSTNAME_MAP = [
    ["motaqadima", "motaqadima"],
    ["madares", "motaqadima"],
];

function detectTenantId(){
    const host = (location.hostname || "").toLowerCase();

    // تبديل النسخة من الرابط (?tenant=motaqadima) مسموح في موضعين فقط:
    // جهاز التطوير، وروابط المعاينة من Netlify. وروابط المعاينة تُعرف بوجود
    // "--" في اسم النطاق، وهي علامة لا توجد في العنوان الحقيقي لأي موقع.
    //
    // ممنوع على المواقع الحقيقية عمداً: لولا ذلك لفتح أي شخص نسخة المدرسة من
    // عنوان خُطى فظنّها منصته، أو العكس.
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    const isPreview = host.endsWith(".netlify.app") && host.includes("--");
    if(isLocal || isPreview){
        const params = new URLSearchParams(location.search);
        const q = params.get("tenant");
        if(q && TENANTS[q]) return q;
        // وضع العرض التجريبي يخصّ المدارس، فيكفي ?demo=1 بلا تحديد النسخة —
        // رابط أقصر يسهل كتابته على شاشة أمام الحضور.
        if(params.get("demo") === "1") return "motaqadima";
    }

    for(const [needle, id] of HOSTNAME_MAP){
        if(host.includes(needle)) return id;
    }
    return "khuta";
}

const TENANT = TENANTS[detectTenantId()] || TENANTS.khuta;

/* اختصار للأقسام: hasFeature("school") — أوضح من قراءة الكائن في كل مكان */
function hasFeature(name){ return !!(TENANT.features && TENANT.features[name]); }

/* نضع هوية النسخة على <html> ليستطيع CSS تغيير الشكل دون أي جافاسكربت،
   ونضبط عنوان التبويب واسم التطبيق مبكراً قبل رسم الصفحة. */
(function applyTenantIdentity(){
    try{
        document.documentElement.setAttribute("data-tenant", TENANT.id);
        const full = TENANT.taglineAr ? `${TENANT.brandAr} — ${TENANT.taglineAr}` : TENANT.brandAr;
        document.title = full;
    }catch(e){ /* لا شيء حرج هنا — الموقع يعمل بلا هذه اللمسة */ }
})();

/* لمسات الهوية التي تحتاج DOM جاهزاً. الشكل والتصميم يبقيان كما هما تماماً —
   نغيّر النصّ فقط ونُظهر/نخفي ما لا يخصّ هذه النسخة. */
function applyTenantChrome(){
    try{
        // سطر التعريف تحت الشعار في شاشة الدخول.
        // نستبدل قيمة المفتاح داخل قاموس الترجمة نفسه بدل تعديل النص مباشرة:
        // لو كتبنا النص في العنصر لأعاده أول تبديل لغة إلى نصّ خُطى. بهذه
        // الطريقة يبقى تبديل اللغة يعمل ويعرض السطر الصحيح لكل نسخة.
        if(TENANT.taglineAr && typeof I18N !== "undefined"){
            if(I18N.ar) I18N.ar["login.tagline"] = TENANT.taglineAr;
            if(I18N.en) I18N.en["login.tagline"] = TENANT.taglineEn || TENANT.taglineAr;
            const tagline = document.querySelector('[data-i18n="login.tagline"]');
            if(tagline) tagline.textContent = currentLangIsEn() ? I18N.en["login.tagline"] : I18N.ar["login.tagline"];
        }
        // بلا وضع ضيف: نُخفي الزر ونُظهر بديله (طلب حساب من المدرسة)
        const guestBtns = document.querySelectorAll(".guest-cta");
        const needAccount = !TENANT.features || !TENANT.features.guestMode;
        guestBtns.forEach(b => { b.style.display = needAccount ? "none" : ""; });
        document.querySelectorAll("[data-tenant-only]").forEach(el => {
            el.style.display = el.getAttribute("data-tenant-only") === TENANT.id ? "" : "none";
        });
        // عناصر تخصّ ميزة بعينها: تختفي في النسخ التي لا تملكها.
        // مثال: حاسبة الموزونة ودليل التخصصات لا معنى لهما داخل مدرسة.
        document.querySelectorAll("[data-feature]").forEach(el => {
            if(!hasFeature(el.getAttribute("data-feature"))) el.style.display = "none";
        });
    }catch(e){ console.warn("[خُطى] تعذّر تطبيق هوية النسخة:", e); }
}

// currentLang يُعرَّف في ملف لاحق، فنقرأه بحذر تفادياً لخطأ ترتيب التحميل
function currentLangIsEn(){
    try{ return typeof currentLang !== "undefined" && currentLang === "en"; }
    catch(e){ return false; }
}

/* ⚠️ التوقيت هنا حسّاس، وقد أخطأنا فيه فعلاً:
   كل ملفات السكربت تحمل defer، ومعناه أنها تُنفَّذ بعد انتهاء تحليل الصفحة —
   أي أن document.readyState يكون "interactive" لا "loading" لحظة تنفيذ هذا
   الملف. فحص "loading" كان يفشل دائماً، فتُستدعى الدالة فوراً وهذا الملف هو
   الأول، أي قبل تعريف I18N في js/03-i18n.js. النتيجة: سطر التعريف تحت الشعار
   يبقى نصّ خُطى في نسخة المدرسة (اكتُشف بالصورة لا بالاختبار).

   الصحيح: ننتظر DOMContentLoaded دائماً ما لم يكن التحميل قد اكتمل فعلاً،
   لأن هذا الحدث لا يقع إلا بعد تنفيذ كل ملفات defer. */
if(document.readyState === "complete"){
    applyTenantChrome();
} else {
    document.addEventListener("DOMContentLoaded", applyTenantChrome);
}
