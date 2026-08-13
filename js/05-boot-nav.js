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
        hideLoadingScreen().then(() => showIntroIfFirstVisit(() => {
            enterApp();
            renderConnectionStatus();  // شريط "بلا إنترنت" يظهر فوراً إن فُتح الموقع دون اتصال
            maybeAnnounceInstallOnce(); // دعوة التثبيت — مرة واحدة لكل متصفح، بعد استقرار الواجهة
        }));
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
    if(tabId === "profile"){ renderProfileStats(); renderMistakeBank(); }
    if(tabId === "settings") renderSettings();
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
    renderThemeModeButtons(); // زر الرأس وأزرار الإعدادات يعبّران عن نفس الحالة
}

/* ============================================================
   6) قسم الإعدادات
   ------------------------------------------------------------
   تفضيلات الطالب كانت موزّعة داخل "الملف الشخصي" بين بطاقات لا تجمعها فكرة
   واحدة (لون، لغة، حساب، خصوصية) — نُقلت كلها هنا مجمّعة حسب الغرض، مع
   إضافات يتوقّعها الطالب في أي موقع مذاكرة: الوضع الليلي كخيار صريح، تثبيت
   التطبيق، حالة الاتصال، نسخة النظام، ونسخة احتياطية من بياناته.
   ============================================================ */

// نسخة النظام المعروضة في الإعدادات — ارفعها يدوياً مع كل إصدار ملموس.
// تُكتَب أيضاً داخل ملف النسخة الاحتياطية لمعرفة أي إصدار أنتجها.
const APP_VERSION = "1.4.0";

/* ---------- المظهر ---------- */
function setThemeMode(mode){
    const isDark = mode === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem("khuta_theme", isDark ? "dark" : "light");
    applyThemeChrome(isDark);
    renderThemeModeButtons();
}

function renderThemeModeButtons(){
    const isDark = document.body.classList.contains("dark-mode");
    const light = document.getElementById("settings-mode-light-btn");
    const dark = document.getElementById("settings-mode-dark-btn");
    if(light) light.classList.toggle("active", !isDark);
    if(dark) dark.classList.toggle("active", isDark);
}

/* ---------- التثبيت كتطبيق (PWA) ---------- */

// ⚠️ المتصفح يطلق beforeinstallprompt مرة واحدة فقط وفي لحظة يختارها هو. إن لم
// نلتقطه ونحتفظ به، ضاعت إمكانية فتح نافذة التثبيت الأصلية نهائياً حتى إعادة
// تحميل الصفحة — لذلك يُسجَّل المستمع هنا عند أعلى مستوى للملف وليس داخل
// window.onload (الذي يعمل متأخراً بعد اكتمال كل الموارد).
let deferredInstallPrompt = null;
const INSTALL_ANNOUNCED_KEY = "khuta_install_announced";

window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // نمنع شريط المتصفح التلقائي، ونعرض دعوتنا في وقتنا نحن
    deferredInstallPrompt = e;
    renderInstallState();
});

window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    localStorage.setItem(INSTALL_ANNOUNCED_KEY, "1"); // لا معنى لدعوة التثبيت بعد التثبيت
    hideInstallBanner();
    renderInstallState();
    showToast(labT("تم تثبيت خُطى على جهازك 🎉","Khuta is now installed on your device 🎉"));
});

// التطبيق مفتوح فعلاً كتطبيق مثبَّت (وليس في تبويب متصفح عادي)
function isRunningAsInstalledApp(){
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
        || window.navigator.standalone === true; // صيغة iOS القديمة
}

// iOS لا يدعم beforeinstallprompt إطلاقاً في أي متصفح عليه (كلها تستخدم محرّك
// Safari نفسه) — التثبيت هناك يدوي بالكامل عبر "إضافة إلى الشاشة الرئيسية"
function isIosDevice(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS الحديث
}

function renderInstallState(){
    const btn = document.getElementById("settings-install-btn");
    const hint = document.getElementById("settings-install-hint");
    if(!btn || !hint) return;

    if(isRunningAsInstalledApp()){
        btn.style.display = "none";
        hint.textContent = labT("✅ أنت تستخدم خُطى كتطبيق مثبَّت على جهازك بالفعل.",
                                "✅ You're already using Khuta as an installed app.");
        return;
    }
    if(deferredInstallPrompt){
        btn.style.display = "";
        hint.textContent = labT("لا يستهلك مساحة تُذكر، وتقدر تحذفه في أي وقت كأي تطبيق.",
                                "It takes almost no space, and you can remove it any time like any app.");
        return;
    }
    // لا نافذة تثبيت متاحة: iOS (لا يدعمها) أو متصفح لم يُطلق الحدث بعد
    btn.style.display = "none";
    hint.textContent = isIosDevice()
        ? labT("على الآيفون/الآيباد: افتح خُطى في Safari، ثم زر المشاركة ⬆️ → «إضافة إلى الشاشة الرئيسية».",
               "On iPhone/iPad: open Khuta in Safari, then Share ⬆️ → \"Add to Home Screen\".")
        : labT("متصفحك لم يُتِح التثبيت بعد. جرّب فتح خُطى في Chrome أو Edge، وتصفّح الموقع دقيقة ثم عد هنا.",
               "Your browser hasn't offered installation yet. Try Chrome or Edge, browse for a minute, then come back.");
}

async function installKhutaApp(){
    if(!deferredInstallPrompt){ renderInstallState(); return; }
    const promptEvent = deferredInstallPrompt;
    // الحدث صالح لاستعمال واحد فقط — نُسقطه فوراً كي لا يُستدعى prompt() مرتين
    deferredInstallPrompt = null;
    try{
        promptEvent.prompt();
        await promptEvent.userChoice; // ننتظر قرار الطالب لتحديث الحالة بدقة
    }catch(e){
        console.error("[خُطى] تعذّر فتح نافذة التثبيت:", e);
    }
    renderInstallState();
}

/* ---------- إعلان التثبيت لمرة واحدة فقط (لكل الطلاب) ---------- */

// يظهر مرة واحدة لكل متصفح ولا يعود أبداً بعد إغلاقه أو استخدامه. لا يعتمد على
// beforeinstallprompt عمداً كي يصل لطلاب iOS أيضاً (لا يُطلَق الحدث عندهم إطلاقاً).
function maybeAnnounceInstallOnce(){
    if(localStorage.getItem(INSTALL_ANNOUNCED_KEY) === "1") return;
    if(isRunningAsInstalledApp()){
        localStorage.setItem(INSTALL_ANNOUNCED_KEY, "1"); // مثبَّت أصلاً — لا داعي لإخباره
        return;
    }
    // نؤخّرها كي لا تزاحم شاشة التحميل ولا ترحيب أول زيارة
    setTimeout(() => {
        const bar = document.getElementById("install-banner");
        if(!bar || localStorage.getItem(INSTALL_ANNOUNCED_KEY) === "1") return;
        bar.style.display = "flex";
        requestAnimationFrame(() => bar.classList.add("show"));
    }, 4000);
}

function hideInstallBanner(){
    const bar = document.getElementById("install-banner");
    if(!bar) return;
    bar.classList.remove("show");
    setTimeout(() => { bar.style.display = "none"; }, 320);
}

// الإغلاق والاستخدام كلاهما يُعلَّم كـ"شوهد" — الوعد للطالب أنها لمرة واحدة
function dismissInstallBanner(){
    localStorage.setItem(INSTALL_ANNOUNCED_KEY, "1");
    hideInstallBanner();
}

function openInstallFromBanner(){
    dismissInstallBanner();
    switchTab("settings");
    setTimeout(() => {
        const box = document.getElementById("settings-install-box");
        if(box) box.scrollIntoView({ behavior:"smooth", block:"center" });
    }, 350);
}

/* ---------- حالة الاتصال ---------- */
function renderConnectionStatus(){
    const online = navigator.onLine;

    const pill = document.getElementById("settings-conn-status");
    if(pill){
        pill.textContent = online ? labT("متصل","Online") : labT("غير متصل","Offline");
        pill.classList.toggle("is-offline", !online);
    }
    const bar = document.getElementById("offline-bar");
    if(bar) bar.style.display = online ? "none" : "flex";
}

window.addEventListener("online",  renderConnectionStatus);
window.addEventListener("offline", renderConnectionStatus);

/* ---------- النسخة الاحتياطية ---------- */

// ⚠️ مفاتيح مستثناة عمداً من النسخ والاستعادة: هي رابط هذا المتصفح بحساب
// بعينه، لا "تقدّم مذاكرة". استعادتها على جهاز آخر تجعل واجهة الموقع تظن أن
// المستخدم هو صاحب النسخة بينما جلسة Supabase الحقيقية لشخص آخر — تعارض
// مربك بلا فائدة. (رموز الدخول الفعلية ليست بهذه البادئة أصلاً فلا تُصدَّر.)
const BACKUP_EXCLUDED_KEYS = ["khuta_session", "khuta_last_sync"];

function collectBackupData(){
    const data = {};
    for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(!k || !k.startsWith("khuta_")) continue;
        if(BACKUP_EXCLUDED_KEYS.includes(k)) continue;
        data[k] = localStorage.getItem(k);
    }
    return data;
}

function exportKhutaBackup(){
    const data = collectBackupData();
    const payload = {
        app: "khuta",
        version: APP_VERSION,
        exportedAt: new Date().toISOString(),
        data,
    };
    let url;
    try{
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `khuta-backup-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }catch(e){
        console.error("[خُطى] تعذّر إنشاء النسخة الاحتياطية:", e);
        showToast(labT("تعذّر إنشاء النسخة الاحتياطية على هذا المتصفح","Couldn't create the backup in this browser"));
        return;
    }finally{
        if(url) setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    showToast(labT(`تم تنزيل نسخة احتياطية (${Object.keys(data).length} عنصراً) 💾`,
                   `Backup downloaded (${Object.keys(data).length} items) 💾`));
}

function importKhutaBackup(event){
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = ""; // كي يعمل اختيار الملف نفسه مرة أخرى لو احتاج الطالب
    if(!file) return;

    const reader = new FileReader();
    reader.onerror = () => showToast(labT("تعذّرت قراءة الملف","Couldn't read the file"));
    reader.onload = () => {
        let payload;
        try{ payload = JSON.parse(reader.result); }
        catch(e){ showToast(labT("الملف غير صالح — تأكد أنه ملف النسخة الاحتياطية نفسه","Invalid file — make sure it's the backup file")); return; }

        if(!payload || payload.app !== "khuta" || !payload.data || typeof payload.data !== "object" || Array.isArray(payload.data)){
            showToast(labT("هذا ليس ملف نسخة احتياطية من خُطى","This isn't a Khuta backup file"));
            return;
        }

        // لا نثق بمحتوى الملف: نقبل فقط مفاتيح خُطى النصية، ونتجاهل أي شيء آخر
        // قد يكون مدسوساً فيه (مفاتيح خارج نطاقنا، أو قيماً غير نصية)
        const entries = Object.entries(payload.data).filter(([k, v]) =>
            typeof k === "string" && k.startsWith("khuta_") &&
            !BACKUP_EXCLUDED_KEYS.includes(k) && typeof v === "string"
        );
        if(entries.length === 0){
            showToast(labT("الملف لا يحتوي بيانات خُطى صالحة","The file has no valid Khuta data"));
            return;
        }

        const when = payload.exportedAt ? new Date(payload.exportedAt).toLocaleDateString(currentLang==='ar'?"ar-SA":"en-US") : "—";
        const ok = confirm(labT(
            `استعادة نسخة بتاريخ ${when} (${entries.length} عنصراً).\n\nسيستبدل هذا تقدّمك الحالي على هذا الجهاز. متأكد؟`,
            `Restore backup from ${when} (${entries.length} items).\n\nThis replaces your current progress on this device. Continue?`
        ));
        if(!ok) return;

        try{
            // نمسح مفاتيح خُطى الحالية أولاً (عدا المستثناة) كي لا تبقى بقايا خطة
            // قديمة مختلطة بالمستعادة — الاستعادة يجب أن تعطي الحالة نفسها تماماً
            const stale = [];
            for(let i = 0; i < localStorage.length; i++){
                const k = localStorage.key(i);
                if(k && k.startsWith("khuta_") && !BACKUP_EXCLUDED_KEYS.includes(k)) stale.push(k);
            }
            stale.forEach(k => localStorage.removeItem(k));
            entries.forEach(([k, v]) => localStorage.setItem(k, v));
        }catch(e){
            console.error("[خُطى] تعذّرت الاستعادة:", e);
            showToast(labT("تعذّرت الاستعادة — قد تكون مساحة التخزين ممتلئة","Restore failed — storage may be full"));
            return;
        }

        showToast(labT("تمت الاستعادة ✅ — سنعيد تحميل الصفحة","Restored ✅ — reloading"));
        setTimeout(() => location.reload(), 1200);
    };
    reader.readAsText(file);
}

/* ---------- رسم القسم بالكامل ---------- */
function renderSettings(){
    renderThemeModeButtons();
    renderInstallState();
    renderConnectionStatus();
    renderPrivacyCard();   // بطاقة الخصوصية انتقلت من الملف الشخصي إلى هنا
    renderAccountUI();     // وكذلك بطاقة الحساب والمزامنة
    const ver = document.getElementById("settings-version");
    if(ver) ver.textContent = "v" + APP_VERSION;
}

