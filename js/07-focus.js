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


