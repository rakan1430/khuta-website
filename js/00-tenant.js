/* ============================================================
   00) هوية النسخة (Tenant) — يُحمَّل قبل كل شيء
   ------------------------------------------------------------
   نفس الكود يخدم أكثر من موقع. الموقع يعرف "من هو" من عنوان الرابط الذي
   فُتح منه، ثم يختار من هنا: اسمه، وقاعدة بياناته، والأقسام التي تظهر فيه.

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

const TENANTS = {
    /* النسخة الأصلية: منصة القدرات العامة للطلاب */
    khuta: {
        id: "khuta",
        brandAr: "خُطى",
        brandEn: "Khuta",
        taglineAr: "",
        taglineEn: "",
        supabaseUrl: "https://squhkiwjwwyrgufkaujf.supabase.co",
        supabaseKey: "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84",
        features: {
            gat: true,          // الحاسبة والجدول والتخصصات — كل ما يخص القدرات
            community: true,    // المجتمع ولوحة الصدارة وغرفة المذاكرة
            school: false,      // أقسام المدرسة (إدارة، مدرّسون، فصول)
            guestMode: true,    // الدخول كضيف بلا حساب
        },
    },

    /* نسخة مدارس المتقدمة — منصة مدرسية تُفتح على السبورة الذكية في الفصل */
    motaqadima: {
        id: "motaqadima",
        brandAr: "خُطى",
        brandEn: "Khuta",
        taglineAr: "نسخة خاصة لمدارس المتقدمة",
        taglineEn: "Al-Motaqadima Schools Edition",
        schoolName: "مدارس المتقدمة — فرع الملقا",
        supabaseUrl: "https://gwbhwshxvlagmoonhfha.supabase.co",
        supabaseKey: "sb_publishable_ZKiYq12OrHtyQC56nZR_Lg_OqJuynBH",
        features: {
            gat: false,
            community: true,
            school: true,
            // المدرسة منصة رسمية: لا أحد يدخل بلا هوية، فالإدارة تحتاج أن
            // تعرف من رفع ماذا ومن دخل الاختبار. لذلك لا وضع ضيف هنا.
            guestMode: false,
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

    // على جهاز التطوير فقط نسمح بتبديل النسخة من الرابط (?tenant=motaqadima)
    // حتى نختبر النسختين بلا نشر. ممنوع على المواقع الحقيقية كي لا يفتح أحد
    // نسخة المدرسة من عنوان خُطى فيظن أنها منصته.
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "";
    if(isLocal){
        const q = new URLSearchParams(location.search).get("tenant");
        if(q && TENANTS[q]) return q;
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

if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", applyTenantChrome);
} else {
    applyTenantChrome();
}
