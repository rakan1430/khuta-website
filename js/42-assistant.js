/* ============================================================
   42) المساعد الحيّ — يتحكّم في الصفحة لا يكتفي بالكلام
   ------------------------------------------------------------
   طلب المالك (٢٦ سبتمبر): «يكون له مساعدة حقيقية في الصفحة ليس مجرد زر
   خامد في زاوية الصفحة… القدرة على المساعدة في اختبارات سريعة على
   السبورة، أو تغيير الوضع الداكن أو الفاتح بشكل حي، أو فتح أي قائمة،
   أو شرح ميزة معينة للطالب أو المعلم بشكل حي على الموقع».
   وبلاغه قبلها: المساعد يرفض طلبات المعلّم والمدير («كيف أرسل اختباراً»،
   «صُغ سؤال اختيار من متعدد»، «اشرح المسألة على السبورة») ويرفض فتح
   أقسام المدرسة — سببه في الخادم (gemini-proxy.js، نمط assistant).

   كيف يعمل:
   ١) أوامر فورية محلية (astLocalIntent): «فعّل الوضع الداكن»، «افتح
      الواجبات»، «اشرح لي هذه الصفحة»، «كيف أرسل اختباراً؟» — تُنفَّذ
      بلا ذكاء اصطناعي: لحظية، ولا تستهلك من حصّة المستخدم، وتعمل حتى للضيف.
   ٢) غير ذلك يذهب للخادم بسياق الصفحة (الدور والقسم المفتوح والأقسام
      الظاهرة)، فيرجع نصّاً + «أفعالاً» من قائمة بيضاء (astRunAction).
   ٣) الأفعال: فتح قسم، مظهر، جولة حيّة تظلّل الأزرار الحقيقية، شرح على
      السبورة، اختبار سريع على السبورة، أسئلة جاهزة لمنشئ الاختبار.

   ⚠️ الأمان: المتصفح لا يثق بما يرجع من النموذج — كل فعل يُتحقّق منه هنا
   (قسم ظاهر لهذا المستخدم فعلاً، قيمة من قائمة معروفة، أسئلة سليمة
   البنية). ولا فعل يحفظ أو يرسل أو يحذف شيئاً: الأسئلة تدخل المسودّة
   فقط، والمعلّم يراجع ويحفظ ويرسل بيده.
   ============================================================ */

const AST_ACCENTS = { gold:"", green:"accent-green", purple:"accent-purple", blue:"accent-blue",
                      rose:"accent-rose", teal:"accent-teal2", amber:"accent-amber", indigo:"accent-indigo" };

/* أسماء الأقسام وما يقوله الناس عنها (بعد تطبيع normalizeArabic). الأطول أولاً
   في المطابقة كي لا تبتلع «الجدول» عبارة «الجدول الدراسي». */
const AST_TABS = {
    dashboard:       { ar:"الرئيسية",        en:"Home",            words:["الرئيسيه","الصفحه الرئيسيه","الخطه والجدول","خطتي","home","dashboard"] },
    calculator:      { ar:"حساب الموزونة",   en:"Weighted score",  words:["الموزونه","حاسبه الموزونه","حساب الموزونه","المعدل","calculator"] },
    links:           { ar:"الروابط المباشرة", en:"Links",           words:["الروابط","روابط الدورات","links"] },
    specialties:     { ar:"دليل التخصصات",   en:"Majors guide",    words:["التخصصات","دليل التخصصات","majors"] },
    community:       { ar:"المجتمع",          en:"Community",       words:["المجتمع","community"] },
    examsim:         { ar:"محاكي الاختبار",  en:"Exam simulator",  words:["المحاكي","محاكي الاختبار"] },
    tutors:          { ar:"المدرّسون الخصوصيون", en:"Tutors",       words:["مدرسين خصوصيين","المدرسون الخصوصيون","tutors"] },
    myfiles:         { ar:"ملفاتي",           en:"My files",        words:["ملفاتي","my files"] },
    profile:         { ar:"الملف الشخصي",    en:"Profile",         words:["الملف الشخصي","حسابي","بروفايلي","profile"] },
    settings:        { ar:"الإعدادات",        en:"Settings",        words:["الاعدادات","اعدادات","settings"] },
    schoolwork:      { ar:"منصة المدرسة",    en:"School platform", words:["منصه المدرسه","منصه","ملفات المعلم","ملفات المدرسه"] },
    schoolexams:     { ar:"الاختبارات",       en:"Exams",           words:["الاختبارات","اختباراتي","الاختبار","exams"] },
    schoolhw:        { ar:"الواجبات",         en:"Homework",        words:["الواجبات","واجباتي","الواجب","homework"] },
    schoolrecord:    { ar:"السجلّ",           en:"Record",          words:["السجل","درجاتي","الدرجات","record","grades"] },
    schoollib:       { ar:"المكتبة",          en:"Library",         words:["المكتبه","الكتب","كتبي","library"] },
    schoolgat:       { ar:"مساحة القدرات",   en:"GAT space",       words:["مساحه القدرات","القدرات"] },
    schoolcounselor: { ar:"لوحة المرشد",     en:"Counselor",       words:["لوحه المرشد","المرشد"] },
    schooltt:        { ar:"الجدول الدراسي",  en:"Timetable",       words:["الجدول الدراسي","جدول الحصص","الحصص","timetable"] },
    schooladmin:     { ar:"إدارة المدرسة",   en:"School admin",    words:["اداره المدرسه","لوحه الاداره","الاداره"] },
};
const AST_EXTRA = {
    board:        { ar:"السبورة الذكية",   en:"Smart board",  words:["السبوره","board"] },
    pad:          { ar:"دفتر السبورة",     en:"Board pad",    words:["الدفتر","دفتري"] },
    exam_builder: { ar:"منشئ الاختبار",    en:"Exam builder", words:["منشئ الاختبار"] },
    hw_builder:   { ar:"منشئ الواجب",      en:"Homework builder", words:["منشئ الواجب"] },
    plan_setup:   { ar:"تخصيص الخطة",      en:"Plan setup",   words:["تخصيص الخطه"] },
    routine:      { ar:"الروتين الأسبوعي", en:"Weekly routine", words:["الروتين"] },
};

function astT(ar, en){ return (typeof currentLang !== "undefined" && currentLang === "en") ? en : ar; }
function astName(key){ const t = AST_TABS[key] || AST_EXTRA[key]; return t ? astT(t.ar, t.en) : key; }

/* ---------- سياق الصفحة (يُرسل للخادم بعد تنقيته هناك) ---------- */
function astCurrentTab(){
    const v = document.querySelector(".view-section.active");
    return v ? v.id.replace(/^view-/, "") : null;
}
/** الأقسام الظاهرة لهذا المستخدم فعلاً — من عناصر القائمة نفسها لا من افتراض. */
function astVisibleTabs(){
    const seen = new Set();
    document.querySelectorAll(".nav-item[data-tab]").forEach(el => {
        // display المحسوب للعنصر نفسه: القائمة الجانبية المخفية على الجوال
        // لا تجعل أبناءها display:none، فيبقى هذا صحيحاً على كل الشاشات
        if(getComputedStyle(el).display !== "none" && !el.hidden) seen.add(el.dataset.tab);
    });
    return [...seen].filter(t => AST_TABS[t]);
}
function astRole(){
    if(typeof schoolCtx !== "undefined" && schoolCtx && ["student","teacher","admin"].includes(schoolCtx.role)) return schoolCtx.role;
    if(typeof isAdmin !== "undefined" && isAdmin) return "owner";
    return "khuta";
}
function astIsStaff(){ const r = astRole(); return r === "teacher" || r === "admin"; }
function astBoardOpen(){
    const ov = document.getElementById("khuta-board-overlay");
    return !!(ov && ov.style.display !== "none" && ov.classList.contains("lab-open"));
}
function astContext(){
    return {
        role: astRole(),
        tab: astCurrentTab(),
        tabs: astVisibleTabs(),
        theme: document.body.classList.contains("dark-mode") ? "dark" : "light",
        lang: (typeof currentLang !== "undefined" && currentLang === "en") ? "en" : "ar",
        counselor: !!document.querySelector('#nav-counselor') && getComputedStyle(document.getElementById("nav-counselor")).display !== "none",
        boardOpen: astBoardOpen(),
    };
}

/* ============================================================
   الأوامر الفورية المحلية — بلا ذكاء اصطناعي
   ============================================================ */
/* ⚠️ تطبيع خاص لا normalizeArabic: تلك مُعرّفة مرّتين (js/12 ثم js/27 التي
   تغلبها لأنها تُحمَّل بعدها)، ونسخة js/27 تحذف المسافات — فتصير «فعّل الوضع
   الداكن» كلمة واحدة ولا تُطابَق أي كلمة. هنا نحتاج الكلمات منفصلة. */
function astNorm(s){
    return String(s || "").toLowerCase()
        .replace(/[ً-ٰٟ]/g, "")   // التشكيل والشدّة
        .replace(/ـ/g, "")
        .replace(/[إأآٱ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[؟?!.،,:؛"'«»()]/g, " ")
        .replace(/\s+/g, " ").trim();
}

function astFindTarget(text){
    const all = [];
    for(const [k, v] of Object.entries(AST_TABS)) v.words.forEach(w => all.push([astNorm(w), k]));
    for(const [k, v] of Object.entries(AST_EXTRA)) v.words.forEach(w => all.push([astNorm(w), k]));
    all.sort((a, b) => b[0].length - a[0].length);
    const hit = all.find(([w]) => (" " + text + " ").includes(" " + w + " ") || text.includes(w));
    return hit ? hit[1] : null;
}

/** يعيد { reply, actions } لأمر معروف، أو null ليذهب السؤال للذكاء الاصطناعي. */
function astLocalIntent(raw){
    const t = astNorm(raw);
    if(!t || t.length > 70) return null;          // الطويل سؤال حقيقي لا أمر
    const staff = astIsStaff();
    // مطابقة بالكلمات كاملة لا بأجزائها: «خل» داخل «داخل»، و«فاتح» داخل
    // «الفاتحه» — المطابقة الجزئية كانت ستقلب المظهر لمن يسأل عن سورة الفاتحة
    const tokens = t.split(" ");
    const has = list => tokens.some(tok => list.includes(tok));
    const wantsHow = has(["كيف","طريقه","خطوات","how"]);

    // المظهر: كلمة لون + كلمة «وضع/مظهر» صريحة (أو كلمة اللون وحدها)
    const themeCtx = has(["الوضع","وضع","المظهر","مظهر","الثيم","ثيم","الشاشه","الخلفيه","الموقع","theme","mode"]);
    const darkW = has(["داكن","الداكن","ليلي","الليلي","مظلم","المظلم","dark"]);
    const lightW = has(["فاتح","الفاتح","نهاري","النهاري","light"]);
    if(darkW && !lightW && (themeCtx || tokens.length === 1))
        return { reply: astT("تمّ — فعّلت الوضع الداكن 🌙", "Done — dark mode is on 🌙"), actions:[{ type:"theme", value:"dark" }] };
    if(lightW && !darkW && (themeCtx || tokens.length === 1))
        return { reply: astT("تمّ — رجّعت الوضع الفاتح ☀️", "Done — light mode is on ☀️"), actions:[{ type:"theme", value:"light" }] };
    if(has(["بدل","اقلب","toggle"]) && themeCtx && tokens.length <= 4){
        const dark = !document.body.classList.contains("dark-mode");
        return { reply: dark ? astT("تمّ — الوضع الداكن 🌙","Dark mode 🌙") : astT("تمّ — الوضع الفاتح ☀️","Light mode ☀️"),
                 actions:[{ type:"theme", value: dark ? "dark" : "light" }] };
    }
    // حجم الخط
    const fontW = has(["الخط","خط","font","text"]);
    if(fontW && has(["كبر","اكبر","تكبير","bigger","larger"]))
        return { reply: astT("كبّرت الخط 🔎", "Font enlarged 🔎"), actions:[{ type:"font", value:"large" }] };
    if(fontW && has(["صغر","اصغر","تصغير","smaller"]))
        return { reply: astT("صغّرت الخط", "Font reduced"), actions:[{ type:"font", value:"small" }] };
    // اللغة: لا بدّ من كلمة «اللغة/الواجهة» — «حوّل النص للإنجليزي» طلب ترجمة لا أمر
    const langCtx = has(["اللغه","لغه","الواجهه","language"]);
    if(langCtx && has(["انجليزي","الانجليزي","الانجليزيه","بالانجليزي","للانجليزي","english"]))
        return { reply: "Switched to English ✓", actions:[{ type:"lang", value:"en" }] };
    if(langCtx && has(["عربي","العربي","العربيه","بالعربي","للعربي","arabic"]))
        return { reply: "حوّلت الواجهة للعربية ✓", actions:[{ type:"lang", value:"ar" }] };

    // شرح الصفحة الحالية
    if((has(["اشرح","عرفني","وضح","فهمني","وش","ايش","شنو","explain"]) &&
        /(هذه|هذي|هاذي|هذا|ذي) (الصفحه|القسم)|(الصفحه|القسم) (هذه|هذي|الحاليه)|this page/.test(t)) ||
       /^(اشرح|اشرح لي) (الصفحه|القسم)$/.test(t))
        return { reply: astT("تمام، خذ جولة سريعة على الصفحة 👇", "Sure — here's a quick tour of this page 👇"), actions:[{ type:"tour", target:"page" }] };

    // «كيف…» لميزات المعلّم — شرح مختصر ثابت + جولة حيّة
    if(staff && wantsHow){
        if(/(ارسل|ابعث|انشر|وزع|send)/.test(t) && /(اختبار|اختبارات|exam|test)/.test(t))
            return { reply: astT(
                "بثلاث خطوات:\n1. من **الاختبارات** احفظ اختبارك.\n2. في القائمة أسفله اضغط **إرسال** بجانبه.\n3. اختر الفصول أو المراحل أو طلاباً بأعيانهم، وحدّد موعد التسليم ومتى تظهر الإجابات، ثم **إرسال**.\nشغّلت لك جولة توريك الأزرار نفسها 👇",
                "Three steps:\n1. In **Exams**, save your exam.\n2. In the list below it, press **Send**.\n3. Pick classes, grades or specific students, set the due date and answer reveal, then **Send**.\nHere's a live tour 👇"),
                actions:[{ type:"tour", target:"exam_send" }] };
        if(/(ملف|ورقه|صوره|pdf)/.test(t) && /(اسئله|اختبار)/.test(t))
            return { reply: astT("ارفع صورة ورقة العمل أو ملف PDF، وأنا أستخرج أسئلتها أو أولّد أسئلة من شرحها — ثم تراجعها قبل الحفظ. هذه الجولة توريك المكان 👇",
                                 "Upload a worksheet photo or PDF and I'll extract or generate questions — you review before saving. Tour 👇"),
                     actions:[{ type:"tour", target:"exam_from_file" }] };
        if(/(انشئ|اسوي|اعمل|اصمم|اضيف|اجهز|ابني|create|make)/.test(t) && /(اختبار|exam|test)/.test(t))
            return { reply: astT("هذه جولة حيّة على منشئ الاختبار خطوة بخطوة 👇 — ولو تبي أصيغ لك الأسئلة نفسها قل: «صُغ لي ٥ أسئلة عن …».",
                                 "Here's a live tour of the exam builder 👇 — or ask me to draft the questions."),
                     actions:[{ type:"tour", target:"exam_create" }] };
        if(/(واجب|homework)/.test(t))
            return { reply: astT("الواجب مثل الاختبار لكن بموعد تسليم إلزامي ومهلة تأخير اختيارية، والحلّ النموذجي يظهر بعد الموعد. خذ الجولة 👇",
                                 "Homework works like an exam with a due date, optional late window and a model solution after the deadline. Tour 👇"),
                     actions:[{ type:"tour", target:"homework" }] };
    }

    // «افتح… / ودّني… / وين…»
    const openVerb = /^(افتح|افتحلي|افتح لي|ودني|وديني|خذني|روح|روحني|انتقل|اذهب|اعرض|open|go to|show)(\s|$)/.test(t)
                  || /^وين (القى|الاقي|احصل)?\s*/.test(t);
    if(openVerb){
        const rest = t.replace(/^(افتح لي|افتحلي|افتح|ودني|وديني|خذني|روحني|روح|انتقل|اذهب|اعرض|open|go to|show|وين)\s*(القى|الاقي|احصل)?\s*(لي|الى|على|ل)?\s*/, "");
        // الطويل («افتح لي درس الكسور في المكتبة وشرحه») طلب مركّب للذكاء لا أمر فتح
        const target = rest.split(" ").length <= 4 ? astFindTarget(rest) : null;
        // قسم غير ظاهر لهذا الحساب: نترك الذكاء يجيب (قد يقصد شيئاً آخر بالكلمة)
        if(target && (!AST_TABS[target] || astVisibleTabs().includes(target)))
            return { reply: astT(`تمّ — فتحت لك «${astName(target)}» 📍`, `Opened “${astName(target)}” 📍`), actions:[{ type:"open", target }] };
    }
    return null;
}

/* ============================================================
   منفّذ الأفعال — القائمة البيضاء الوحيدة لما يقدر المساعد فعله
   ============================================================ */
function astNarrow(){ return window.innerWidth < 760; }
function astHidePanel(){
    const p = document.getElementById("chatbot-panel");
    if(p && p.style.display !== "none" && !p.classList.contains("panel-closing") && typeof toggleChatbot === "function") toggleChatbot();
}

async function astEnsureSchoolCode(){
    if(typeof ensureExamDraft === "function") return true;
    if(typeof khutaLoadGroup === "function"){
        try{ await khutaLoadGroup("school"); }catch(e){ console.error("[خُطى] تعذّر تحميل ملفات المدرسة:", e); }
    }
    return typeof ensureExamDraft === "function";
}

function astFlash(el){
    if(!el) return;
    el.classList.remove("ast-flash");
    void el.offsetWidth;
    el.classList.add("ast-flash");
    setTimeout(() => el.classList.remove("ast-flash"), 2200);
}

/** ينفّذ فعلاً واحداً بعد التحقق منه. يعيد { ok, label } لشارة الإنجاز تحت الرد. */
async function astRunAction(a, opts){
    if(!a || typeof a !== "object") return { ok:false };
    const silentPanel = opts && opts.keepPanel;
    switch(a.type){
    case "theme":
        if(a.value !== "dark" && a.value !== "light") return { ok:false };
        setThemeMode(a.value);
        return { ok:true, label: a.value === "dark" ? astT("الوضع الداكن","Dark mode") : astT("الوضع الفاتح","Light mode"), icon: a.value === "dark" ? "fa-moon" : "fa-sun" };
    case "font":
        if(!["small","medium","large"].includes(a.value)) return { ok:false };
        setFontSize(a.value);
        return { ok:true, label: astT("حجم الخط","Font size"), icon:"fa-text-height" };
    case "accent":
        if(!(a.value in AST_ACCENTS) || typeof setAccent !== "function") return { ok:false };
        setAccent(AST_ACCENTS[a.value]);
        return { ok:true, label: astT("لون الواجهة","Accent colour"), icon:"fa-palette" };
    case "lang":
        if(a.value !== "ar" && a.value !== "en") return { ok:false };
        setLang(a.value);
        return { ok:true, label: a.value === "en" ? "English" : "العربية", icon:"fa-language" };
    case "open":
        return astOpen(a.target, silentPanel);
    case "tour":
        return astTour(a.target);
    case "board":{
        const q = typeof a.question === "string" ? a.question.trim().slice(0, 1500) : "";
        if(!q) return { ok:false };
        astHidePanel();
        openKhutaBoard("ai", true);
        setTimeout(() => boardExplain(q), 120);
        return { ok:true, label: astT("الشرح على السبورة","Explaining on the board"), icon:"fa-chalkboard-user" };
    }
    case "quiz":{
        const quiz = astCleanQuiz(a);
        if(!quiz) return { ok:false };
        if(opts && opts.card) opts.card(quiz);
        if(a.start === true){ astHidePanel(); astQuizOpen(quiz); }
        return { ok:true, label: a.start ? astT("اختبار سريع على السبورة","Quick quiz on the board") : astT(`${quiz.questions.length} أسئلة جاهزة`, `${quiz.questions.length} questions ready`), icon:"fa-list-check" };
    }
    }
    return { ok:false };
}

function astOpen(target, keepPanel){
    if(AST_TABS[target]){
        if(!astVisibleTabs().includes(target)) return { ok:false, label: astT(`«${astName(target)}» غير متاح لحسابك`, `“${astName(target)}” not available`) };
        if(astBoardOpen() && typeof closeKhutaBoard === "function") closeKhutaBoard();
        switchTab(target);
        if(astNarrow() && !keepPanel) setTimeout(astHidePanel, 700);
        setTimeout(() => astFlash(document.querySelector(`#view-${target} .card`)), 350);
        return { ok:true, label: astName(target), icon:"fa-location-arrow" };
    }
    switch(target){
    case "board": astHidePanel(); openKhutaBoard("ai", true); return { ok:true, label: astName(target), icon:"fa-chalkboard-user" };
    case "pad":   astHidePanel(); openKhutaBoard("pad", true); return { ok:true, label: astName(target), icon:"fa-pen" };
    case "plan_setup": if(typeof openSetupOverlay !== "function") return { ok:false }; astHidePanel(); openSetupOverlay(); return { ok:true, label: astName(target), icon:"fa-sliders" };
    case "routine":    if(typeof openSetupOverlay !== "function") return { ok:false }; astHidePanel(); openSetupOverlay("routine"); return { ok:true, label: astName(target), icon:"fa-calendar-week" };
    case "exam_builder":
    case "hw_builder":{
        const tab = target === "hw_builder" ? "schoolhw" : "schoolexams";
        if(!astIsStaff() || !astVisibleTabs().includes(tab)) return { ok:false, label: astT("منشئ الاختبار للمعلّم والإدارة فقط","Builder is for staff only") };
        if(astBoardOpen() && typeof closeKhutaBoard === "function") closeKhutaBoard();
        switchTab(tab);
        if(astNarrow()) setTimeout(astHidePanel, 500);
        setTimeout(() => {
            const w = document.getElementById("exam-builder-wrap");
            if(w){ w.scrollIntoView({ behavior:"smooth", block:"start" }); astFlash(w); }
        }, 400);
        return { ok:true, label: astName(target), icon:"fa-clipboard-question" };
    }
    }
    return { ok:false };
}

/* ============================================================
   الجولات الحيّة — تظليل الأزرار الحقيقية خطوة بخطوة
   كل خطوة: sel (محدّدات بالترتيب، أول ظاهر يُعتمد) + نصّ. الخطوة التي لا
   يظهر عنصرها لهذا المستخدم أو هذه الشاشة تُتخطّى بصمت.
   ============================================================ */
const AST_TOURS = {
    exam_create: { tab:"schoolexams", staff:true, steps:[
        { sel:["#exam-title"], ar:["العنوان والمادة","اكتب عنوان الاختبار، ثم اختر المادة والصف والمدة إن أردت."], en:["Title & subject","Name the exam, then pick subject, grade and optional duration."] },
        { sel:["#exam-shuffle"], ar:["خلط الأسئلة","فعّلها ليأخذ كل طالب ترتيباً مختلفاً للأسئلة والخيارات — يصعّب الغش."], en:["Shuffle","Each student gets a different order — harder to copy."] },
        { sel:[".exq-import summary","#exam-ai-file"], ar:["من ملف إلى أسئلة","ارفع صورة ورقة عمل أو PDF، والذكاء الاصطناعي يستخرج أسئلتها أو يولّد أسئلة من الشرح."], en:["File → questions","Upload a worksheet or PDF; AI extracts or generates questions."] },
        { sel:["#exam-builder .exq-card","#exam-builder"], ar:["بطاقة السؤال","اكتب السؤال والخيارات واضغط الدائرة بجانب الإجابة الصحيحة. لكل سؤال وخيار صورة، ولكل سؤال شرح للحل: نص أو صورة أو رسم بيدك."], en:["Question card","Type the question and choices, mark the right one. Add images and a written, image or hand-drawn explanation."] },
        { sel:["#exam-builder-wrap button[onclick='addExamQuestion()']"], ar:["سؤال جديد","أضف ما شئت من الأسئلة — أو اطلب مني: «صُغ لي ٥ أسئلة عن …» وأضعها هنا جاهزة."], en:["Add question","Add as many as you like — or ask me to draft them."] },
        { sel:["#exam-save"], ar:["احفظ","الحفظ لا يرسل شيئاً للطلاب — الإرسال خطوة مستقلة من القائمة أسفل."], en:["Save","Saving doesn't send anything — sending is a separate step below."] },
    ]},
    exam_send: { tab:"schoolexams", staff:true, steps:[
        { sel:["#exam-save"], ar:["١) احفظ الاختبار","بعد كتابة الأسئلة اضغط هنا — يظهر اختبارك في القائمة أسفل."], en:["1) Save","After writing the questions, save — it appears in the list below."] },
        { sel:["#sexams-list button[onclick^='openExamSend']","#sexams-list"], ar:["٢) زر «إرسال»","بجانب كل اختبار محفوظ زر إرسال. اضغطه لتختار من يستلمه."], en:["2) Send","Each saved exam has a Send button."] },
        { sel:["#sexams-list"], ar:["٣) اختر المستلمين والموعد","في نافذة الإرسال: فصول أو مراحل أو طلاب بأعيانهم، ثم موعد التسليم، ومتى تظهر الإجابات، ومؤقّت اختياري يسلّم تلقائياً."], en:["3) Recipients & timing","Choose classes, grades or students, due date, answer reveal and optional timer."] },
        { sel:["#sexams-list button[onclick^='openSchoolExamResults']","#sexams-list"], ar:["٤) النتائج","بعد أن يحلّ الطلاب: زر النتائج يعرض أفضل درجة لكل طالب وكل محاولاته."], en:["4) Results","See each student's best score and attempts."] },
    ]},
    exam_from_file: { tab:"schoolexams", staff:true, steps:[
        { sel:["#exam-ai-file"], ar:["ارفع الملف","صورة أو PDF حتى ٤ ميجا: ورقة عمل، أو صفحة كتاب، أو ملخص."], en:["Upload","Image or PDF up to 4 MB."] },
        { sel:["#exam-ai-convert-btn"], ar:["استخراج بالذكاء الاصطناعي","إن كانت في الملف أسئلة جاهزة تُستخرج كما هي، وإلا تُولَّد أسئلة من المحتوى."], en:["Extract with AI","Existing questions are extracted; otherwise generated."] },
        { sel:["#exam-builder"], ar:["راجع قبل الحفظ","تنزل الأسئلة هنا بطاقات قابلة للتعديل — راجعها ثم احفظ."], en:["Review","Questions land here as editable cards."] },
    ]},
    homework: { tab:"schoolhw", staff:true, steps:[
        { sel:["#exam-title"], ar:["عنوان الواجب","نفس منشئ الاختبار — يُصحَّح تلقائياً."], en:["Homework title","Same builder, auto-graded."] },
        { sel:["#exam-late-days"], ar:["التسليم المتأخر","اسمح بمهلة بعد الموعد (يوم إلى أسبوع) أو امنعها."], en:["Late window","Allow a grace period or not."] },
        { sel:["#exam-save"], ar:["احفظ ثم أرسل","بعد الحفظ أرسله من القائمة أسفل وحدّد موعد التسليم. الحلّ النموذجي يظهر للطلاب بعد الموعد."], en:["Save, then send","Send from the list and set the due date."] },
        { sel:["#shw-list"], ar:["واجباتك","هنا واجباتك المحفوظة والمرسلة ونتائجها."], en:["Your homework","Saved and sent homework with results."] },
    ]},
    school_files: { tab:"schoolwork", steps:[
        { sel:["#tfile-title"], ar:["ارفع ملفاً","عنوان ومادة وصف، ثم اختر الملف (٢٥ ميجا) أو الصق رابطاً."], en:["Upload a file","Title, subject, grade, then a file or link."] },
        { sel:["#tfile-shared"], ar:["لمن يظهر؟","بالعلامة يظهر لطلاب فصولك، وبدونها يبقى لك على السبورة."], en:["Visibility","Checked: your classes see it."] },
        { sel:["#tfiles-list"], ar:["ملفاتك","تفتحها من أي جهاز — حتى سبورة الفصل."], en:["Your files","Open from any device."] },
        { sel:["#tlink-label"], ar:["الروابط المباشرة","أي رابط تفتحه بضغطة أمام الفصل."], en:["Direct links","Any link, one tap away."] },
        { sel:["#card-quick"], ar:["الدخول السريع على السبورة","كلمة مرور قصيرة تدخل بها من جهاز الفصل دون بريدك."], en:["Quick board login","A short password for the classroom device."] },
    ]},
    record: { tab:"schoolrecord", steps:[
        { sel:["#rec-controls"], ar:["اختر الفصل والمادة","يتغيّر الكشف حسب اختيارك."], en:["Pick class & subject",""] },
        { sel:["#rec-book"], ar:["الكشف","واجبات واختبارات المنصة لكل طالب، والدرجات الرسمية من نور بجانبها."], en:["Gradebook","Platform work plus official Noor grades."] },
    ]},
    library: { tab:"schoollib", steps:[
        { sel:["#lib-editor"], ar:["أضف للمكتبة","كتاب برابط منصة عين، أو PDF بعارض ورسم، أو درس بشرح وفيديو واختبار قصير."], en:["Add","Books, PDFs, lessons."] },
        { sel:["#lib-filters"], ar:["تصفية","حسب المادة والصف — والطالب يرى صفّه تلقائياً."], en:["Filters",""] },
        { sel:["#lib-list"], ar:["المحتوى","كل ما في المكتبة هنا."], en:["Content",""] },
    ]},
    gat_space: { tab:"schoolgat", steps:[
        { sel:["#sgat-tests"], ar:["اختبارات التدريب","بلا درجات، يعيدها الطالب متى شاء — تُنشر لكل طلاب المدرسة."], en:["Practice tests","Ungraded, retake any time."] },
        { sel:["#sgat-forms"], ar:["شروح وملفات","مراجع القدرات في مكان واحد."], en:["Resources",""] },
        { sel:["#sgat-links"], ar:["فيديو وروابط",""], en:["Videos & links",""] },
    ]},
    timetable: { tab:"schooltt", steps:[
        { sel:["#tt-class"], ar:["الفصل","اختر الفصل لعرض جدوله."], en:["Class",""] },
        { sel:["#tt-add"], ar:["إضافة حصة","اليوم والحصة والمادة والقاعة."], en:["Add period",""] },
        { sel:["#tt-grid"], ar:["الجدول","اضغط أيقونة الملاحظة على أي يوم لتضيف تذكيراً."], en:["Timetable","Tap the note icon to add a reminder."] },
    ]},
    admin_overview: { tab:"schooladmin", admin:true, steps:[
        { sel:["#admin-requests-list"], ar:["طلبات الحسابات","طلبات الانضمام بانتظار قرارك."], en:["Account requests",""] },
        { sel:["#card-setup"], ar:["إعداد المدرسة","روابط الانضمام الخاصة بمدرستكم، والمراحل والمواد."], en:["School setup",""] },
        { sel:["#card-classes"], ar:["الفصول","أضف الفصول بمرحلتها وشعبتها."], en:["Classes",""] },
        { sel:["#admin-import-card"], ar:["استيراد الطلاب","من ملف Excel أو كشف نور دفعة واحدة."], en:["Import students",""] },
        { sel:["#card-attendance"], ar:["الغياب من نور","يظهر بجانب درجات الطلاب."], en:["Attendance",""] },
        { sel:["#card-official"], ar:["الدرجات الرسمية","كشف الفترة أو النهائي من نور."], en:["Official grades",""] },
        { sel:["#card-school-msgs"], ar:["رسائل البريد","رسالة لطلاب مدرستكم الآن أو في موعد تختاره."], en:["Email messages",""] },
        { sel:["#card-members"], ar:["المدرّسون والطلاب","إيقاف عضو يمنع دخوله فوراً ويبقي بياناته."], en:["Members",""] },
    ]},
    school_messages: { tab:"schooladmin", admin:true, steps:[
        { sel:["#smsg-subject"], ar:["العنوان والنص","نصّ عادي يصل بريد طلاب مدرستكم وحدهم."], en:["Subject & body",""] },
        { sel:["#smsg-when"], ar:["الجدولة","اختر موعداً لترسل تلقائياً، أو اتركه فارغاً وأرسلها بنفسك."], en:["Schedule",""] },
        { sel:["#smsg-save"], ar:["احفظ","ثم من القائمة: تجربة لنفسك أو إرسال الآن. الحدّ ٣ رسائل يومياً."], en:["Save","Then test or send now. Max 3/day."] },
    ]},
    student_work: { tab:"schoolexams", steps:[
        { sel:["#sexams-list"], ar:["اختباراتك","كل اختبار أرسله معلّموك هنا بموعده. اضغطه لتبدأ."], en:["Your exams",""] },
        { sel:["[data-tab='schoolhw']"], ar:["الواجبات","واجباتك ومواعيد تسليمها."], en:["Homework",""] },
        { sel:["[data-tab='schoolrecord']"], ar:["السجلّ","درجاتك وأعمالك."], en:["Record",""] },
    ]},
    appearance: { tab:"settings", steps:[
        { sel:["#settings-mode-dark-btn","#settings-mode-light-btn"], ar:["داكن أو فاتح","أو قل لي: «فعّل الوضع الداكن» وأغيّره فوراً."], en:["Dark or light","Or just ask me."] },
        { sel:[".theme-swatch"], ar:["لون الواجهة",""], en:["Accent colour",""] },
        { sel:["#fontsize-medium-btn","#fontsize-large-btn"], ar:["حجم الخط",""], en:["Font size",""] },
    ]},
    board_tools: { open:"board", steps:[
        { sel:[".board-tab[data-tab='ai']"], ar:["الشرح خطوة بخطوة","اكتب أي مسألة ويشرحها المعلّم الذكي سطراً سطراً."], en:["Step-by-step",""] },
        { sel:[".board-tab[data-tab='pad']"], ar:["دفتري","اكتب وارسم بيدك ملء الشاشة: ألوان وممحاة وتراجع وحفظ."], en:["Pad",""] },
        { sel:[".board-tab[data-tab='file']"], ar:["اشرح ملفي","ارفع ملفاً دراسياً ويُشرح لك كاملاً."], en:["Explain my file",""] },
    ]},
    study_session: { tab:"dashboard", steps:[
        { sel:["#btn-plan-session"], ar:["ابدأ جلستك","المؤقّت يقسم وقتك بين الكمي واللفظي تلقائياً."], en:["Start a session",""] },
        { sel:["#btn-customize-dashboard"], ar:["خصّص لوحتك",""], en:["Customize",""] },
    ]},
};
// القسم ← الجولة المخصّصة له (وما سواه تُبنى جولته من عناوين بطاقاته)
const AST_TAB_TOUR = { schoolexams:"exam_create", schoolhw:"homework", schoolwork:"school_files", schoolrecord:"record",
                       schoollib:"library", schoolgat:"gat_space", schooltt:"timetable", schooladmin:"admin_overview", settings:"appearance" };

function astVisible(el){
    if(!el) return false;
    if(el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
}
/** يفتح ما يخفي العنصر: بطاقة مطويّة أو <details> مغلق. */
function astReveal(el){
    for(let n = el; n && n !== document.body; n = n.parentElement){
        if(n.tagName === "DETAILS" && !n.open) n.open = true;
        if(n.classList && n.classList.contains("is-collapsed") && typeof setCardCollapsed === "function") setCardCollapsed(n, false);
    }
}
function astPick(sels){
    for(const s of sels){
        let list;
        try{ list = document.querySelectorAll(s); }catch(e){ continue; }
        for(const el of list){ astReveal(el); if(astVisible(el)) return el; }
    }
    return null;
}

/** جولة الصفحة الحالية: المخصّصة إن وُجدت، وإلا من عناوين بطاقات القسم نفسه. */
function astPageSteps(){
    const tab = astCurrentTab();
    const own = AST_TAB_TOUR[tab] && AST_TOURS[AST_TAB_TOUR[tab]];
    if(own && (!own.staff || astIsStaff()) && (!own.admin || ["admin","owner"].includes(astRole()))) return own.steps;
    const view = document.getElementById("view-" + tab);
    if(!view) return [];
    const steps = [];
    view.querySelectorAll(".card").forEach(card => {
        if(steps.length >= 6 || !astVisible(card)) return;
        const h = card.querySelector("h2, h3");
        if(!h || !h.textContent.trim()) return;
        const sub = card.querySelector(".card-sub, .hint, p");
        const title = h.textContent.trim().slice(0, 60);
        const text = sub && astVisible(sub) ? sub.textContent.trim().slice(0, 220) : "";
        if(!card.id) card.id = "ast-card-" + Math.random().toString(36).slice(2, 8);
        steps.push({ sel:["#" + card.id], ar:[title, text], en:[title, text] });
    });
    return steps;
}

let astTourState = null;
function astTour(key){
    let steps, def = null;
    if(key === "page") steps = astPageSteps();
    else{
        def = AST_TOURS[key];
        if(!def) return { ok:false };
        if(def.staff && !astIsStaff()) return { ok:false, label: astT("هذه الجولة للمعلّم والإدارة","This tour is for staff") };
        if(def.admin && !["admin","owner"].includes(astRole())) return { ok:false, label: astT("هذه الجولة للإدارة","This tour is for admins") };
        if(def.tab && !astVisibleTabs().includes(def.tab)) return { ok:false, label: astT("القسم غير متاح لحسابك","Section not available") };
        steps = def.steps;
    }
    astHidePanel();
    if(def && def.tab){
        if(astBoardOpen()) closeKhutaBoard();
        if(astCurrentTab() !== def.tab) switchTab(def.tab);
    }
    if(def && def.open === "board" && !astBoardOpen()) openKhutaBoard("ai", false);
    astTourState = { steps, i:0 };
    setTimeout(() => astTourStep(0), def ? 520 : 200);
    return { ok:true, label: astT("جولة حيّة","Live tour"), icon:"fa-route" };
}

function astTourEnd(){
    document.getElementById("ast-tour")?.remove();
    window.removeEventListener("scroll", astTourOnScroll, true);
    window.removeEventListener("resize", astTourOnScroll);
    astTourState = null;
}

/** ينتظر حتى يستقرّ العنصر بعد التمرير الناعم — القياس قبل ذلك يضع البقعة
    في مكانه القديم (رأيناه فعلاً: البقعة بعيدة عن زر «حفظ الاختبار»). */
function astWaitStill(el){
    return new Promise(resolve => {
        let last = null, still = 0;
        const t0 = performance.now();
        const tick = () => {
            const top = el.getBoundingClientRect().top;
            still = (last !== null && Math.abs(top - last) < 0.5) ? still + 1 : 0;
            last = top;
            if(still >= 4 || performance.now() - t0 > 1500) resolve();
            else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
}

function astTourStep(i){
    if(!astTourState) return;
    const steps = astTourState.steps;
    // تخطّي الخطوات غير الظاهرة لهذا المستخدم أو هذه الشاشة، في الاتجاهين
    const dir = i >= astTourState.i ? 1 : -1;
    let el = null;
    while(i >= 0 && i < steps.length && !(el = astPick(steps[i].sel))) i += dir;
    if(!el){
        if(i >= steps.length || i < 0){
            const shown = document.getElementById("ast-tour");
            astTourEnd();
            if(!shown && typeof showToast === "function") showToast(astT("لا شيء ظاهراً أشرحه هنا الآن","Nothing visible to explain here"));
        }
        return;
    }
    astTourState.i = i;
    astTourState.el = el;
    el.scrollIntoView({ behavior:"smooth", block:"center" });
    astWaitStill(el).then(() => { if(astTourState && astTourState.el === el) astTourDraw(el, i); });
}

/** ما تغطّيه الأشرطة المثبّتة أسفل الشاشة (شريط الجوال، شريط العرض التجريبي). */
function astBottomInset(){
    let inset = 0;
    document.querySelectorAll(".mobile-nav, .demo-bar").forEach(b => {
        if(getComputedStyle(b).display === "none") return;
        const r = b.getBoundingClientRect();
        if(r.height && r.top < window.innerHeight) inset = Math.max(inset, window.innerHeight - r.top);
    });
    return inset;
}

let astTourRaf = 0;
function astTourOnScroll(){
    cancelAnimationFrame(astTourRaf);
    astTourRaf = requestAnimationFrame(astTourPlace);
}

/** يضع البقعة على العنصر والبطاقة بجانبه — يُعاد مع كل تمرير أو تغيير حجم. */
function astTourPlace(){
    const ov = document.getElementById("ast-tour");
    if(!ov || !astTourState || !astTourState.el) return;
    const el = astTourState.el, r = el.getBoundingClientRect(), pad = 8;
    const spot = ov.querySelector(".ast-spot"), card = ov.querySelector(".ast-tour-card");
    Object.assign(spot.style, { top: (r.top - pad)+"px", left: (r.left - pad)+"px", width: (r.width + pad*2)+"px", height: (r.height + pad*2)+"px" });
    // البطاقة أسفل الهدف إن اتّسع، وإلا أعلاه — فوق الأشرطة السفلية دائماً
    const cr = card.getBoundingClientRect();
    const bottom = window.innerHeight - astBottomInset() - 12;
    let ct = r.bottom + 14;
    if(ct + cr.height > bottom) ct = r.top - cr.height - 14;
    ct = Math.max(12, Math.min(ct, bottom - cr.height));
    const cl = Math.max(12, Math.min(r.left, window.innerWidth - cr.width - 12));
    card.style.top = ct + "px";
    card.style.left = cl + "px";
}

function astTourDraw(el, i){
    if(!astTourState) return;
    const steps = astTourState.steps, s = steps[i];
    const [title, text] = (typeof currentLang !== "undefined" && currentLang === "en" && s.en && s.en[0]) ? s.en : s.ar;
    let ov = document.getElementById("ast-tour");
    if(!ov){
        ov = document.createElement("div");
        ov.id = "ast-tour";
        ov.className = "onboarding-overlay ast-tour";
        ov.innerHTML = `<div class="onboarding-spotlight ast-spot"></div>
            <div class="onboarding-card ast-tour-card" role="dialog" aria-live="polite"></div>`;
        document.body.appendChild(ov);
        window.addEventListener("scroll", astTourOnScroll, { capture:true, passive:true });
        window.addEventListener("resize", astTourOnScroll);
    }
    const last = i >= steps.length - 1;
    const card = ov.querySelector(".ast-tour-card");
    card.innerHTML = `
        <span class="ai-guide-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${astT("مساعدك يشرح","Your assistant")}</span>
        <span class="onboarding-step-count">${i + 1} / ${steps.length}</span>
        <b>${escapeHtml(title || "")}</b>
        ${text ? `<p>${escapeHtml(text)}</p>` : ""}
        <div class="ast-tour-btns">
            <button type="button" class="btn-ghost" onclick="astTourEnd()">${astT("إغلاق","Close")}</button>
            <span style="display:flex; gap:6px;">
                ${i > 0 ? `<button type="button" class="btn btn-sm btn-outline" onclick="astTourStep(${i - 1})">${astT("السابق","Back")}</button>` : ""}
                <button type="button" class="btn btn-sm" onclick="${last ? "astTourEnd()" : `astTourStep(${i + 1})`}">${last ? astT("تمّ 👍","Done 👍") : astT("التالي","Next")}</button>
            </span>
        </div>`;
    astTourPlace();
    card.querySelector(".btn:not(.btn-outline)")?.focus({ preventScroll:true });
}
document.addEventListener("keydown", e => {
    if(!astTourState) return;
    if(e.key === "Escape") astTourEnd();
    else if(e.key === "ArrowLeft" || e.key === "ArrowRight"){
        const rtl = document.documentElement.dir === "rtl";
        const next = (e.key === "ArrowLeft") === rtl;
        astTourStep(astTourState.i + (next ? 1 : -1));
    }
});

/* ============================================================
   الاختبار السريع على السبورة
   ------------------------------------------------------------
   للمعلّم أمام الفصل: سؤال كبير، أربعة خيارات، مؤقّت، «اكشف الإجابة».
   وللطالب وحده: يختار فيرى الصواب فوراً، وتُحسب درجته.
   لا يُحفظ شيء ولا يُرسل — عرض فقط. وللمعلّم زرّ ينقل الأسئلة للمنشئ.
   ============================================================ */
function astCleanQuiz(a){
    const qs = (Array.isArray(a.questions) ? a.questions : []).slice(0, 15).map(q => {
        if(!q || typeof q.q !== "string" || !q.q.trim() || !Array.isArray(q.choices)) return null;
        const choices = q.choices.filter(c => typeof c === "string" && c.trim()).slice(0, 6).map(c => c.trim().slice(0, 300));
        if(choices.length < 2 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct >= choices.length) return null;
        return { q: q.q.trim().slice(0, 1200), choices, correct: q.correct, why: typeof q.why === "string" ? q.why.trim().slice(0, 500) : "" };
    }).filter(Boolean);
    if(!qs.length) return null;
    const title = typeof a.title === "string" && a.title.trim() ? a.title.trim().slice(0, 80) : astT("اختبار سريع","Quick quiz");
    return { title, questions: qs };
}

const AST_LETTERS_AR = ["أ","ب","ج","د","هـ","و"];
let astQuiz = null;

function astQuizOpen(quiz){
    astQuizClose(true);
    const ov = document.createElement("div");
    ov.id = "ast-quiz";
    ov.className = "ast-quiz";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    document.body.appendChild(ov);
    document.body.style.overflow = "hidden";
    astQuiz = { quiz, i:0, score:0, answered:false, timer:null, left:0, seconds: astQuiz && astQuiz.seconds !== undefined ? astQuiz.seconds : 30 };
    requestAnimationFrame(() => ov.classList.add("open"));
    astQuizRender();
}
function astQuizClose(silent){
    const ov = document.getElementById("ast-quiz");
    if(astQuiz) clearInterval(astQuiz.timer);
    if(!ov) return;
    if(document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if(silent){ ov.remove(); }
    else{ ov.classList.remove("open"); setTimeout(() => ov.remove(), 300); }
    document.body.style.overflow = "";
}

function astQuizRender(){
    const st = astQuiz, ov = document.getElementById("ast-quiz");
    if(!st || !ov) return;
    clearInterval(st.timer);
    const n = st.quiz.questions.length;
    const head = `
        <div class="astq-head">
            <b class="astq-title"><i class="fa-solid fa-chalkboard-user"></i> ${escapeHtml(st.quiz.title)}</b>
            <span class="astq-tools">
                <label class="astq-timer-pick" title="${astT("وقت كل سؤال","Time per question")}">
                    <i class="fa-regular fa-clock"></i>
                    <select onchange="astQuizSetTimer(this.value)" aria-label="${astT("وقت كل سؤال","Time per question")}">
                        ${[0,15,30,60].map(s => `<option value="${s}" ${s===st.seconds?"selected":""}>${s ? s + astT(" ث"," s") : astT("بلا وقت","No timer")}</option>`).join("")}
                    </select>
                </label>
                <button type="button" class="astq-icon" onclick="astQuizFullscreen()" title="${astT("ملء الشاشة","Fullscreen")}" aria-label="${astT("ملء الشاشة","Fullscreen")}"><i class="fa-solid fa-expand"></i></button>
                <button type="button" class="astq-icon" onclick="astQuizClose()" title="${astT("إغلاق","Close")}" aria-label="${astT("إغلاق","Close")}"><i class="fa-solid fa-xmark"></i></button>
            </span>
        </div>`;

    if(st.i >= n){
        const pct = Math.round(st.score / n * 100);
        ov.innerHTML = `<div class="astq-board">${head}
            <div class="astq-end">
                <div class="astq-end-emoji">${pct === 100 ? "🏆" : pct >= 60 ? "👏" : "💪"}</div>
                <div class="astq-end-score">${st.score} / ${n}</div>
                <p>${pct === 100 ? astT("علامة كاملة! ممتاز","Perfect score!") : pct >= 60 ? astT("أداء جميل","Nice work") : astT("نراجعها مرة ثانية؟","Want another go?")}</p>
                <div class="astq-end-btns">
                    <button type="button" class="btn" onclick="astQuizRestart()"><i class="fa-solid fa-rotate-right"></i> ${astT("أعد الاختبار","Restart")}</button>
                    ${astIsStaff() ? `<button type="button" class="btn btn-outline astq-light-btn" onclick="astQuizToBuilder()"><i class="fa-solid fa-clipboard-question"></i> ${astT("أرسلها كاختبار لفصلي","Send as an exam")}</button>` : ""}
                    <button type="button" class="btn btn-outline astq-light-btn" onclick="astQuizClose()">${astT("إغلاق","Close")}</button>
                </div>
            </div></div>`;
        if(pct === 100) astConfetti(ov);
        return;
    }

    const q = st.quiz.questions[st.i];
    st.answered = false;
    const letters = currentLang === "en" ? ["A","B","C","D","E","F"] : AST_LETTERS_AR;
    ov.innerHTML = `<div class="astq-board">${head}
        <div class="astq-progress"><span style="width:${(st.i / n) * 100}%"></span></div>
        <div class="astq-meta"><span>${astT("سؤال","Question")} ${st.i + 1} / ${n}</span>
            <span class="astq-clock" id="astq-clock" ${st.seconds ? "" : "hidden"}></span></div>
        <div class="astq-q">${escapeHtml(q.q)}</div>
        <div class="astq-choices">
            ${q.choices.map((c, k) => `<button type="button" class="astq-choice" data-k="${k}" onclick="astQuizPick(${k})">
                <span class="astq-letter">${letters[k]}</span><span class="astq-ctext">${escapeHtml(c)}</span></button>`).join("")}
        </div>
        <div class="astq-why" id="astq-why" hidden></div>
        <div class="astq-foot">
            <button type="button" class="btn btn-outline astq-light-btn" id="astq-reveal" onclick="astQuizReveal(null)"><i class="fa-solid fa-eye"></i> ${astT("اكشف الإجابة","Reveal answer")}</button>
            <button type="button" class="btn" id="astq-next" onclick="astQuizNext()" hidden>${st.i === n - 1 ? astT("النتيجة","Results") : astT("التالي","Next")} <i class="fa-solid fa-arrow-left rtl-flip"></i></button>
        </div></div>`;
    if(st.seconds){
        st.left = st.seconds;
        astQuizTick();
        st.timer = setInterval(() => { st.left--; astQuizTick(); if(st.left <= 0){ clearInterval(st.timer); astQuizReveal(null); } }, 1000);
    }
}
function astQuizTick(){
    const c = document.getElementById("astq-clock");
    if(!c || !astQuiz) return;
    c.textContent = astQuiz.left + astT(" ث"," s");
    c.classList.toggle("low", astQuiz.left <= 5);
}
function astQuizSetTimer(v){
    if(!astQuiz) return;
    astQuiz.seconds = parseInt(v, 10) || 0;
    if(!astQuiz.answered) astQuizRender();
}
function astQuizPick(k){ if(astQuiz && !astQuiz.answered) astQuizReveal(k); }
function astQuizReveal(picked){
    const st = astQuiz;
    if(!st || st.answered) return;
    st.answered = true;
    clearInterval(st.timer);
    const q = st.quiz.questions[st.i];
    if(picked === q.correct) st.score++;
    document.querySelectorAll("#ast-quiz .astq-choice").forEach(b => {
        const k = +b.dataset.k;
        b.disabled = true;
        if(k === q.correct) b.classList.add("right");
        else if(k === picked) b.classList.add("wrong");
        else b.classList.add("dim");
    });
    const why = document.getElementById("astq-why");
    if(why && q.why){ why.textContent = "💡 " + q.why; why.hidden = false; }
    document.getElementById("astq-reveal").hidden = true;
    const next = document.getElementById("astq-next");
    next.hidden = false; next.focus({ preventScroll:true });
}
function astQuizNext(){ if(astQuiz){ astQuiz.i++; astQuizRender(); } }
function astQuizRestart(){ if(astQuiz){ astQuiz.i = 0; astQuiz.score = 0; astQuizRender(); } }
function astQuizFullscreen(){
    const ov = document.getElementById("ast-quiz");
    if(!ov) return;
    if(document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if(ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
}
function astQuizToBuilder(){ if(astQuiz){ const q = astQuiz.quiz; astQuizClose(); astAddToBuilder(q); } }
document.addEventListener("keydown", e => {
    if(!astQuiz || !document.getElementById("ast-quiz")) return;
    if(e.key === "Escape"){ astQuizClose(); return; }
    if(e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const map = { "1":0, "2":1, "3":2, "4":3, "أ":0, "ب":1, "ج":2, "د":3, "a":0, "b":1, "c":2, "d":3 };
    if(!astQuiz.answered && e.key in map){ const k = map[e.key]; if(k < (astQuiz.quiz.questions[astQuiz.i] || {choices:[]}).choices.length) astQuizPick(k); }
    else if(astQuiz.answered && (e.key === "Enter" || e.key === " ")){ e.preventDefault(); astQuizNext(); }
});

function astConfetti(host){
    const box = document.createElement("div");
    box.className = "astq-confetti";
    const colors = ["#FFD98A","#B9F2DC","#C9B8FF","#FF9FB2","#9FD4FF"];
    for(let k = 0; k < 60; k++){
        const p = document.createElement("i");
        p.style.left = Math.random() * 100 + "%";
        p.style.background = colors[k % colors.length];
        p.style.animationDelay = (Math.random() * 0.6) + "s";
        p.style.animationDuration = (1.6 + Math.random() * 1.2) + "s";
        box.appendChild(p);
    }
    host.appendChild(box);
    setTimeout(() => box.remove(), 3500);
}

/** يضع الأسئلة في مسودّة منشئ الاختبار — لا حفظ ولا إرسال. */
async function astAddToBuilder(quiz){
    if(!astIsStaff()){ showToast(astT("منشئ الاختبار للمعلّم والإدارة","The builder is for staff")); return; }
    if(!(await astEnsureSchoolCode())){ showToast(astT("تعذّر فتح منشئ الاختبار — تحقّق من الاتصال","Couldn't open the builder")); return; }
    if(astBoardOpen()) closeKhutaBoard();
    astHidePanel();
    switchTab("schoolexams");
    const d = ensureExamDraft();
    const max = (typeof MAX_EXAM_QUESTIONS === "number" ? MAX_EXAM_QUESTIONS : 100);
    const imported = quiz.questions.map(q => ({
        id: "q" + Math.random().toString(36).slice(2, 9),
        text: q.q, image: null,
        choices: q.choices.map(t => ({ text: t, image: null })),
        correct: q.correct,
        explanation: q.why ? { type:"text", text: q.why, image: null } : null,
    }));
    const onlyEmpty = d.questions.length === 1 && !d.questions[0].text.trim() && !d.questions[0].image
                      && d.questions[0].choices.every(c => !c.text.trim() && !c.image);
    d.questions = (onlyEmpty ? imported : d.questions.concat(imported)).slice(0, max);
    renderExamBuilder();
    const title = document.getElementById("exam-title");
    if(title && !title.value.trim()) title.value = quiz.title;
    setTimeout(() => {
        const w = document.getElementById("exam-builder");
        if(w){ w.scrollIntoView({ behavior:"smooth", block:"start" }); astFlash(w); }
    }, 350);
    showToast(astT(`أُضيفت ${imported.length} أسئلة للمسودّة — راجعها ثم احفظ وأرسل ✅`, `${imported.length} questions added — review, save, then send ✅`));
}

function astQuizAsText(quiz){
    return quiz.questions.map(q => [q.q, ...q.choices, String(q.correct + 1)].map(s => s.replace(/\|/g, "/")).join(" | ")).join("\n");
}

/* ============================================================
   واجهة المحادثة: رسائل غنيّة، شارات الإنجاز، بطاقات الأسئلة، اقتراحات
   ============================================================ */
function astFormat(text){
    // تهريب أولاً ثم تنسيق محدود (**غامق**) — لا HTML من النموذج أبداً
    return escapeHtml(String(text || "")).replace(/\*\*([^*\n]{1,200})\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
}

function astAddBotMessage(reply){
    const box = document.getElementById("chatbot-messages");
    const div = document.createElement("div");
    div.className = "chatbot-msg bot ast-msg";
    div.innerHTML = `<div class="ast-text">${astFormat(reply)}</div>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
}
function astAddPills(msg, results){
    const ok = results.filter(r => r && r.label);
    if(!ok.length) return;
    const row = document.createElement("div");
    row.className = "ast-pills";
    row.innerHTML = ok.map(r => `<span class="ast-pill ${r.ok ? "" : "fail"}"><i class="fa-solid ${r.ok ? (r.icon || "fa-check") : "fa-circle-exclamation"}"></i> ${escapeHtml(r.label)}</span>`).join("");
    msg.appendChild(row);
}
function astQuizCard(msg, quiz){
    const card = document.createElement("div");
    card.className = "ast-quiz-card";
    const letters = currentLang === "en" ? ["A","B","C","D","E","F"] : AST_LETTERS_AR;
    card.innerHTML = `
        <b><i class="fa-solid fa-list-check"></i> ${escapeHtml(quiz.title)} · ${quiz.questions.length} ${astT("أسئلة","questions")}</b>
        <ol>${quiz.questions.map(q => `<li>${escapeHtml(q.q)}<div class="ast-qc">${q.choices.map((c, k) =>
            `<span class="${k === q.correct ? "ok" : ""}">${letters[k]}) ${escapeHtml(c)}</span>`).join("")}</div></li>`).join("")}</ol>
        <div class="ast-quiz-btns">
            <button type="button" class="btn btn-sm" data-act="play"><i class="fa-solid fa-play"></i> ${astT("اعرضها على السبورة","Present on board")}</button>
            ${astIsStaff() ? `<button type="button" class="btn btn-sm btn-outline" data-act="builder"><i class="fa-solid fa-clipboard-question"></i> ${astT("أضفها لمنشئ الاختبار","Add to exam builder")}</button>` : ""}
            <button type="button" class="btn btn-sm btn-ghost" data-act="copy" title="${astT("نسخ بصيغة الاستيراد السريع","Copy in quick-import format")}"><i class="fa-regular fa-copy"></i></button>
        </div>`;
    card.querySelector('[data-act="play"]').onclick = () => { astHidePanel(); astQuizOpen(quiz); };
    const b = card.querySelector('[data-act="builder"]');
    if(b) b.onclick = () => astAddToBuilder(quiz);
    card.querySelector('[data-act="copy"]').onclick = () => {
        const txt = astQuizAsText(quiz);
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
            .then(() => showToast(astT("نُسخت — الصقها في «استيراد سريع بلصق نصّي»","Copied — paste into quick import")))
            .catch(() => showToast(astT("تعذّر النسخ","Copy failed")));
    };
    msg.appendChild(card);
    const box = document.getElementById("chatbot-messages");
    box.scrollTop = box.scrollHeight;
}

/** ينفّذ أفعال رد واحد بالترتيب ويضع شاراتها تحت الرسالة. */
async function astExecute(msg, actions){
    const list = (Array.isArray(actions) ? actions : []).slice(0, 3);
    const results = [];
    for(const a of list){
        try{ results.push(await astRunAction(a, { card: q => astQuizCard(msg, q) })); }
        catch(e){ console.error("[خُطى] تعذّر تنفيذ فعل المساعد:", a, e); results.push({ ok:false }); }
    }
    astAddPills(msg, results);
    astRenderChips();
}

/* ---------- الاقتراحات: حسب الدور والقسم المفتوح ---------- */
let astModelChips = null;
function astChip(label, how){ return { label, how }; }
function astRenderChips(){
    const box = document.getElementById("chatbot-suggestions");
    if(!box) return;
    const dark = document.body.classList.contains("dark-mode");
    const role = astRole(), tab = astCurrentTab();
    const chips = [];
    if(astModelChips && astModelChips.length){
        astModelChips.slice(0, 3).forEach(c => chips.push(astChip(c, { ask:c })));
    }else{
        chips.push(astChip(astT("🧭 اشرح لي هذه الصفحة","🧭 Explain this page"), { ask: astT("اشرح لي هذه الصفحة","explain this page") }));
        if(role === "teacher" || role === "admin"){
            if(tab === "schoolexams" || tab === "schoolhw") chips.push(astChip(astT("كيف أرسل اختباراً؟","How do I send an exam?"), { ask: astT("كيف أرسل اختبار للطلاب","how do I send an exam") }));
            chips.push(astChip(astT("✍️ صُغ لي أسئلة اختيار من متعدد","✍️ Draft MCQs"), { fill: astT("صُغ لي ٥ أسئلة اختيار من متعدد لمادة ","Draft 5 multiple-choice questions on ") }));
            chips.push(astChip(astT("⚡ اختبار سريع على السبورة","⚡ Quick board quiz"), { fill: astT("سوّ اختبار سريع على السبورة للفصل عن ","Run a quick board quiz for my class on ") }));
            chips.push(astChip(astT("🧑‍🏫 اشرح مسألة على السبورة","🧑‍🏫 Explain on the board"), { fill: astT("اشرح هذه المسألة على السبورة للطلاب: ","Explain this on the board: ") }));
            if(role === "admin" && tab !== "schooladmin") chips.push(astChip(astT("افتح إدارة المدرسة","Open school admin"), { ask: astT("افتح إدارة المدرسة","open school admin") }));
        }else if(role === "student"){
            chips.push(astChip(astT("وين واجباتي؟","Where's my homework?"), { ask: astT("افتح الواجبات","open homework") }));
            chips.push(astChip(astT("⚡ اختبرني بسرعة","⚡ Quiz me"), { fill: astT("اختبرني ٥ أسئلة في ","Quiz me with 5 questions on ") }));
            chips.push(astChip(astT("اشرح لي درساً","Explain a lesson"), { fill: astT("اشرح لي درس ","Explain the lesson ") }));
        }else{
            chips.push(astChip(astT("⚡ اختبرني ٥ أسئلة كمي","⚡ 5 quant questions"), { ask: astT("اختبرني ٥ أسئلة قدرات كمي على السبورة","quiz me with 5 GAT quant questions on the board") }));
            chips.push(astChip(astT("كيف أحسب موزونتي؟","My weighted score?"), { ask: astT("كيف أحسب موزونتي؟","How do I calculate my weighted score?") }));
        }
    }
    chips.push(astChip(dark ? astT("☀️ الوضع الفاتح","☀️ Light mode") : astT("🌙 الوضع الداكن","🌙 Dark mode"), { ask: dark ? astT("فعّل الوضع الفاتح","light mode") : astT("فعّل الوضع الداكن","dark mode") }));
    box.innerHTML = "";
    chips.slice(0, 5).forEach(c => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = c.label;
        b.onclick = () => {
            const input = document.getElementById("chatbot-input");
            if(c.how.fill){ input.value = c.how.fill; input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
            else{ input.value = c.how.ask; sendChatbotMessage(); }
        };
        box.appendChild(b);
    });
}

function astUpdateHeader(){
    const el = document.getElementById("ast-where");
    const tab = astCurrentTab();
    if(el) el.textContent = tab && AST_TABS[tab] ? astT("أنت في: ","You're in: ") + astName(tab) : "";
    const input = document.getElementById("chatbot-input");
    if(input) input.placeholder = astPlaceholder();
}

/** النصّ الباهت في خانة الكتابة: أمثلة مما يملكه هذا المستخدم فعلاً.
    ⚠️ كان ثابتاً للجميع «افتح الواجبات…» — وطالب خُطى لا واجبات عنده
    (ملاحظة المالك ٢٦ سبتمبر). الأمثلة الآن تُبنى من الأقسام الظاهرة له. */
function astPlaceholder(){
    const role = astRole(), tabs = astVisibleTabs();
    const ex = [];
    if(role === "teacher" || role === "admin"){
        ex.push(astT("صُغ ٥ أسئلة عن…", "draft 5 questions on…"));
        if(tabs.includes("schoolexams")) ex.push(astT("افتح الاختبارات", "open exams"));
    }else if(role === "student"){
        ex.push(astT("اشرح لي درس…", "explain the lesson…"));
        if(tabs.includes("schoolhw")) ex.push(astT("افتح الواجبات", "open homework"));
    }else{
        ex.push(astT("حلّ لي سؤال كمي…", "solve a quant question…"));
        if(tabs.includes("calculator")) ex.push(astT("افتح حساب الموزونة", "open the calculator"));
    }
    ex.push(document.body.classList.contains("dark-mode") ? astT("الوضع الفاتح", "light mode") : astT("الوضع الداكن", "dark mode"));
    return astT("اسألني أو اطلب: ", "Ask, or say: ") + ex.join(astT("، ", ", ")) + "…";
}

/* ============================================================
   نقطة الدخول: رسالة المستخدم
   ============================================================ */
async function astHandleMessage(text){
    astModelChips = null;
    // ١) أمر فوري محلي
    const local = astLocalIntent(text);
    if(local){
        const msg = astAddBotMessage(local.reply);
        await astExecute(msg, local.actions);
        return;
    }
    // ٢) الذكاء الاصطناعي بسياق الصفحة
    addChatbotMessage("...", "bot typing-indicator");
    try{
        chatHistory.push({ role:"user", parts:[{ text }] });
        const raw = await callGeminiProxy("assistant", { history: chatHistory.slice(-10), context: astContext() });
        removeTypingIndicator();
        let data;
        try{ data = extractJson(raw); }
        catch(e){ data = { reply: raw, actions: [] }; }
        const reply = typeof data.reply === "string" && data.reply.trim() ? data.reply.trim() : astT("تمّ ✓","Done ✓");
        chatHistory.push({ role:"model", parts:[{ text: reply }] });
        persistCurrentConversation();
        astModelChips = (Array.isArray(data.chips) ? data.chips : []).filter(c => typeof c === "string" && c.trim() && c.length <= 60).slice(0, 3);
        const msg = astAddBotMessage(reply);
        await astExecute(msg, data.actions);
    }catch(e){
        removeTypingIndicator();
        // الرسالة التي لم يُجب عنها لا تبقى في السجل (وإلا تكرّر المستخدم مرتين)
        const last = chatHistory[chatHistory.length - 1];
        if(last && last.role === "user" && last.parts[0].text === text) chatHistory.pop();
        const limitMsg = getAiLimitErrorMessage(e);
        if(limitMsg){
            if(e.code === "AUTH_REQUIRED") addChatbotAuthPrompt(limitMsg);
            else addChatbotMessage(limitMsg, "bot");
            return;
        }
        geminiLastFailAt = Date.now();
        console.error("[خُطى] المساعد غير متاح مؤقتاً:", e);
        answerLocally(text, true);
    }
}

/* ---------- الإدخال الصوتي (عربي/إنجليزي) — إن دعمه المتصفح ---------- */
let astRec = null;
function astInitVoice(){
    const btn = document.getElementById("ast-mic");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!btn) return;
    if(!SR){ btn.hidden = true; return; }
    btn.hidden = false;
    btn.title = astT("تحدّث بصوتك", "Speak");
    btn.setAttribute("aria-label", btn.title);
    btn.onclick = () => {
        if(astRec){ astRec.stop(); return; }
        const rec = new SR();
        rec.lang = currentLang === "en" ? "en-US" : "ar-SA";
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        const input = document.getElementById("chatbot-input");
        let finalText = "";
        rec.onresult = ev => {
            let interim = "";
            for(let k = ev.resultIndex; k < ev.results.length; k++){
                if(ev.results[k].isFinal) finalText += ev.results[k][0].transcript;
                else interim += ev.results[k][0].transcript;
            }
            input.value = (finalText + interim).trim();
        };
        rec.onerror = ev => {
            if(ev.error === "not-allowed" || ev.error === "service-not-allowed") showToast(astT("اسمح للموقع باستخدام الميكروفون من إعدادات المتصفح","Allow microphone access in your browser"));
        };
        rec.onend = () => {
            astRec = null;
            btn.classList.remove("listening");
            if(input.value.trim()) sendChatbotMessage();
        };
        astRec = rec;
        btn.classList.add("listening");
        try{ rec.start(); }catch(e){ astRec = null; btn.classList.remove("listening"); }
    };
}

/* ---------- لمسة «حيّة» للزر: يقترح جولة عند أول زيارة لقسم ---------- */
const AST_NUDGE_KEY = "khuta_ast_nudged";
function astNudgeSeen(){ try{ return JSON.parse(localStorage.getItem(AST_NUDGE_KEY) || "{}"); }catch(e){ return {}; } }
function astNudgeMark(tab){ try{ const s = astNudgeSeen(); s[tab] = 1; localStorage.setItem(AST_NUDGE_KEY, JSON.stringify(s)); }catch(e){} }
function astMaybeNudge(tab){
    const role = astRole();
    if(role === "khuta" || role === "owner") return;                 // لطالب خُطى جولته التعريفية الخاصة
    const tour = AST_TAB_TOUR[tab] && AST_TOURS[AST_TAB_TOUR[tab]];
    if(!tour || (tour.staff && !astIsStaff()) || (tour.admin && role !== "admin")) return;
    if(!astVisibleTabs().includes(tab)) return;                      // قسم لا يراه أصلاً
    const seen = astNudgeSeen();
    if(seen.__off || seen[tab]) return;
    const fab = document.getElementById("chatbot-fab");
    const panel = document.getElementById("chatbot-panel");
    if(!fab || getComputedStyle(fab).display === "none" || (panel && panel.style.display !== "none")) return;
    if(document.getElementById("ast-tour") || document.getElementById("onboarding-overlay")) return;
    astNudgeMark(tab);
    document.getElementById("ast-nudge")?.remove();
    const n = document.createElement("div");
    n.id = "ast-nudge";
    n.className = "ast-nudge";
    n.innerHTML = `<span>${astT(`أول مرة في «${astName(tab)}»؟ أوريك كيف تستخدمها 👀`, `First time in “${astName(tab)}”? Want a quick tour? 👀`)}</span>
        <span class="ast-nudge-btns">
            <button type="button" class="btn btn-sm" data-a="go">${astT("أرني","Show me")}</button>
            <button type="button" class="btn-ghost" data-a="no">${astT("لاحقاً","Later")}</button>
            <button type="button" class="btn-ghost" data-a="off" title="${astT("لا تقترح الجولات مرة ثانية","Don't suggest tours again")}">${astT("لا تقترح","Never")}</button>
        </span>`;
    n.querySelector('[data-a="go"]').onclick = () => { n.remove(); astTour(AST_TAB_TOUR[tab]); };
    n.querySelector('[data-a="no"]').onclick = () => n.remove();
    n.querySelector('[data-a="off"]').onclick = () => { try{ const s = astNudgeSeen(); s.__off = 1; localStorage.setItem(AST_NUDGE_KEY, JSON.stringify(s)); }catch(e){} n.remove(); };
    document.body.appendChild(n);
    setTimeout(() => n.classList.add("show"), 30);
    setTimeout(() => { n.classList.remove("show"); setTimeout(() => n.remove(), 400); }, 9000);
}

/* يلتقط كل انتقال بين الأقسام: يحدّث رأس المحادثة واقتراحاتها، ويقترح جولة */
(function astHookTabs(){
    const wrap = () => {
        if(typeof switchTab !== "function" || switchTab.__ast) return;
        const orig = switchTab;
        const wrapped = function(tabId){
            const r = orig.apply(this, arguments);
            try{
                astUpdateHeader();
                if(!astModelChips) astRenderChips();
                clearTimeout(window.__astNudgeT);
                window.__astNudgeT = setTimeout(() => astMaybeNudge(tabId), 1400);
            }catch(e){ /* المساعد لا يجوز أن يُسقط التنقّل */ }
            return r;
        };
        wrapped.__ast = true;
        window.switchTab = wrapped;
    };
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", wrap);
    else wrap();
})();

// Ctrl/⌘ + K: افتح المساعد واكتب فوراً
document.addEventListener("keydown", e => {
    if((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K" || e.key === "ك")){
        const fab = document.getElementById("chatbot-fab");
        if(!fab || getComputedStyle(fab).display === "none") return;
        e.preventDefault();
        const panel = document.getElementById("chatbot-panel");
        if(panel.style.display === "none" || panel.classList.contains("panel-closing")) toggleChatbot();
        setTimeout(() => document.getElementById("chatbot-input")?.focus(), 60);
    }
});

document.addEventListener("DOMContentLoaded", () => { try{ astInitVoice(); }catch(e){} });
