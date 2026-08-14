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

