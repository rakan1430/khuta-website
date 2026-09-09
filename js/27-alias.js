/* ============================================================
   27) الاسم المستعار — للجميع، لا لطلاب المدرسة وحدهم
   ------------------------------------------------------------
   المشكلة كما وجدتُها في الفحص: سياسة القراءة على جدول لوحة المتصدّرين
   هي `true` حرفياً — أي أن **أي شخص في العالم** يقرأ أسماء من فيها.
   وطالب المدرسة يدخلها باسمه الحقيقي الذي أدخلته إدارة مدرسته، بلا أن
   يختار ذلك أصلاً.

   ⚠️ ولاحظ المالك ما هو أوسع: «لو تفكر فيها في كل الجهتين هم قاصرون،
   طلاب ثانوية». وهو محق — طالب خُطى العادي قاصرٌ أيضاً، والفرق الوحيد
   أنه "اختار" إظهار اسمه، وهو اختيار لا يفهم عواقبه في السادسة عشرة.

   فالقاعدة: **الاسم المستعار هو الافتراضي للجميع**، ومن أراد اسمه
   الحقيقي أظهره بخيار واعٍ. وهذا يحمي الجميع **ويُلغي استثناءً** — ونحن
   اتفقنا أن كل استثناء في هذا الموقع صار مصدر أعطال.

   ⚠️ واللقب من توليد النظام وحده — لا يكتبه الطالب إطلاقاً.
   وهذا قرار المالك ونصّه: «لن يكون لدى الطالب الحرية في كتابة الاسم
   المستعار الذي يريده، وإنما سيكون يتم إنشاؤه من النظام، ولدى الطالب
   القدرة على ضغط زر غيّره إذا لم يعجبه — **لتجنّب مشكلات كتابة اسم غير
   لائق**».

   وهو محق: خانة كتابة حرّة في منصّة مدرسية تعني أن أحدهم سيكتب فيها ما
   لا يليق يوماً، وأن على أحدٍ أن يراقبها. والمولّد يُلغي المشكلة من
   أصلها بدل أن يحاول ملاحقتها.

   ⚠️ ويبقى فحص انتحال الصفة رغم ذلك — دفاعاً لا واجهةً: من يفتح أدوات
   المطوّر يستطيع تعديل ما في التخزين مباشرةً. انظر أيضاً الفحص في قاعدة
   البيانات، وهو الحاجز الحقيقي.
   ============================================================ */

const ALIAS_KEY = "khuta_alias";            // يُزامَن تلقائياً (كل مفاتيح khuta_)
const ALIAS_SHOW_REAL_KEY = "khuta_alias_show_real";

/* أسماء عربية محايدة، لا تحمل انتماءً ولا تفاضلاً */
const ALIAS_NOUNS = ["صقر","نجم","قمر","سهم","فجر","شعاع","بحر","جبل","نسر","مهر",
                     "رعد","شراع","برق","غيث","ربيع","نور","سراج","بدر","حسام","مرجان"];
const ALIAS_ADJS  = ["مثابر","طموح","هادئ","نشيط","صبور","مجتهد","متألق","ساطع","شامخ",
                     "يقظ","حازم","دؤوب","واثق","ماهر","بارع","لامع"];

/* ============================================================
   توحيد شكل النص قبل أي مقارنة
   ------------------------------------------------------------
   ⚠️ هذه الخطوة هي التي تجعل الحجب يعمل فعلاً. بدونها تُخترق أي قائمة
   مهما طالت: يكتب "مـ__دير" أو "م.د.ي.ر" أو يستبدل الياء الفارسية
   بالعربية — فتمرّ كلها. ولاحظها المالك حين طلب أن يُكشف "حتى غير
   الواضح منها".
   ============================================================ */
function normalizeArabic(s){
    return String(s || "")
        .replace(/[ً-ْٰ]/g, "")     // التشكيل
        .replace(/ـ/g, "")                    // التطويل: مـديـر ← مدير
        .replace(/[أإآٱا]/g, "ا")
        .replace(/[ةه]/g, "ه")
        .replace(/[ىيیئ]/g, "ي")
        .replace(/[كک]/g, "ك")
        .replace(/[ؤو]/g, "و")
        // أرقام تُستعمل بديلاً عن حروف (الكتابة "المعرّبة")
        .replace(/[3٣]/g, "ع").replace(/[7٧]/g, "ح")
        .replace(/[9٩]/g, "ص").replace(/[2٢]/g, "ء")
        .replace(/[^\p{L}]/gu, "")                 // نقاط ومسافات وشرطات وأرقام
        .toLowerCase();
}

/* انتحال الصفة — وهو ما طلبه المالك صراحةً. القائمة قصيرة عمداً: التوحيد
   أعلاه هو ما يعطيها قوّتها، لا طولها. */
const ALIAS_BLOCKED = [
    "مدير","مديره","معلم","معلمه","استاذ","استاذه","اداره","مشرف","مشرفه",
    "وكيل","وكيله","رئيس","موجه","موجهه","المدرسه","رسمي","الدعم","دعمفني",
    "خطي","خطىرسمي","ادمن","المشرفالعام",
    "admin","administrator","teacher","principal","moderator","official",
    "support","staff","khuta","system","root",
];

function aliasProblem(name){
    const raw = String(name || "").trim();
    if(raw.length < 2)  return "SHORT";
    if(raw.length > 24) return "LONG";
    if(/https?:|www\.|@/i.test(raw)) return "LINK";
    if(/\d{7,}/.test(raw)) return "PHONE";           // رقم جوال داخل اللقب
    const norm = normalizeArabic(raw);
    if(!norm) return "EMPTY";
    if(ALIAS_BLOCKED.some(b => norm.includes(normalizeArabic(b)))) return "IMPERSONATION";
    return null;
}

/* تبقى للسجلّ ولتشخيص الحالات المرفوضة في وحدة التحكّم — لا تُعرض في
   الواجهة بعد إلغاء الكتابة اليدوية. */
function aliasProblemText(code){
    const ar = {
        SHORT: "اللقب قصير جداً — حرفان على الأقل.",
        LONG: "اللقب طويل — ٢٤ حرفاً كحد أقصى.",
        LINK: "لا يمكن أن يحوي اللقب رابطاً أو بريداً.",
        PHONE: "لا تضع رقم جوالك في اللقب — يراه كل من يفتح اللوحة.",
        EMPTY: "اكتب لقباً بحروف.",
        IMPERSONATION: "هذا اللقب يوهم بصفة رسمية (مدير، معلّم، دعم…) — اختر غيره.",
    };
    const en = {
        SHORT: "Too short — at least 2 characters.",
        LONG: "Too long — 24 characters max.",
        LINK: "A nickname can't contain a link or email.",
        PHONE: "Don't put your phone number in a nickname — everyone can see it.",
        EMPTY: "Use letters.",
        IMPERSONATION: "This looks like an official role (admin, teacher, support) — pick another.",
    };
    return (currentLang === "ar" ? ar : en)[code] || "";
}

/* ---------- التوليد ---------- */

function generateAlias(){
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const n = Math.floor(Math.random() * 90) + 10;      // رقمان يمنعان التكرار
    return `${pick(ALIAS_NOUNS)} ${pick(ALIAS_ADJS)} ${n}`;
}

/** اللقب الحالي — يُولَّد ويُحفظ عند أول طلب، فلا يُترك أحد بلا لقب. */
function getPublicAlias(){
    let a = null;
    try{ a = localStorage.getItem(ALIAS_KEY); }catch(e){}
    if(a && !aliasProblem(a)) return a;
    a = generateAlias();
    try{ localStorage.setItem(ALIAS_KEY, a); }catch(e){}
    return a;
}

function regenerateAlias(){
    let a = generateAlias();
    try{ localStorage.setItem(ALIAS_KEY, a); }catch(e){}
    renderAliasBox();
    return a;
}

/** هل اختار صاحب الحساب إظهار اسمه الحقيقي بوعي؟ */
function aliasShowsRealName(){
    try{ return localStorage.getItem(ALIAS_SHOW_REAL_KEY) === "1"; }catch(e){ return false; }
}

/* ============================================================
   ⚠️ الاسم المعروض علناً — نقطة واحدة لا أربع
   ------------------------------------------------------------
   كان الاسم يُبنى في أربعة مواضع متفرّقة بنفس السطر المكرّر
   (لوحة المتصدّرين، ومشاركة المجتمع، ومشاركة الخطة…). ومعنى التكرار أن
   أي إصلاح للخصوصية يجب أن يُطبَّق أربع مرات — ومن ينسى واحدة يسرّب اسماً.
   الآن: دالة واحدة، ومن أضاف موضعاً خامساً استعملها.
   ============================================================ */
function publicDisplayName(){
    if(aliasShowsRealName()){
        const session = (typeof getSession === "function") ? getSession() : null;
        const real = (session && session.username) ||
                     (function(){ try{ return localStorage.getItem("khuta_name"); }catch(e){ return null; } })();
        if(real) return real;
    }
    return getPublicAlias();
}

/* ---------- الواجهة في الملف الشخصي ---------- */

function renderAliasBox(){
    const box = document.getElementById("alias-box");
    if(!box) return;
    const alias = getPublicAlias();
    const showReal = aliasShowsRealName();
    const ar = currentLang === "ar";

    box.innerHTML = `
        <div class="alias-current">
            <span class="alias-label">${ar ? "لقبك العلني" : "Your public nickname"}</span>
            <b id="alias-value">${escapeHtml(alias)}</b>
            <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="regenerateAlias()">
                <i class="fa-solid fa-rotate"></i> ${ar ? "غيّره" : "Change"}</button>
        </div>
        <p class="hint" style="margin-top:10px;">${ar
            ? "الألقاب من توليد النظام. اضغط \"غيّره\" حتى يعجبك واحد."
            : "Nicknames are system-generated. Press \"Change\" until one suits you."}</p>
        <label class="consent-row" style="margin-top:6px;">
            <input type="checkbox" id="alias-show-real" ${showReal ? "checked" : ""} onchange="toggleShowRealName(this.checked)">
            <span>${ar ? "أظهر اسمي الحقيقي بدل اللقب" : "Show my real name instead"}</span>
        </label>
        <p class="hint" style="margin-top:6px;">${ar
            ? "لوحة المتصدّرين والمجتمع يقرأهما أي شخص على الإنترنت — لهذا اللقب هو الافتراضي. ومعلّموك وإدارة مدرستك يرون اسمك الحقيقي دائماً في منصة المدرسة."
            : "The leaderboard and community are readable by anyone online — that's why a nickname is the default. Your teachers and school admin always see your real name inside the school platform."}</p>`;
}

function toggleShowRealName(on){
    try{ localStorage.setItem(ALIAS_SHOW_REAL_KEY, on ? "1" : "0"); }catch(e){}
    renderAliasBox();
    refreshPublicName();
}

/** يحدّث السجلّ العلني فوراً — وإلا بقي الاسم القديم معروضاً للناس. */
async function refreshPublicName(){
    if(typeof sb === "undefined" || !sb) return;
    const session = (typeof getSession === "function") ? getSession() : null;
    if(!session || !session.uid) return;
    try{
        await sb.from("leaderboard")
            .update({ display_name: publicDisplayName() })
            .eq("id", session.uid);
    }catch(e){ console.warn("[خُطى] تعذّر تحديث الاسم في لوحة المتصدّرين:", e); }
}
