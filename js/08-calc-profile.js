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

    // نبني الخيارات عبر DOM لا عبر innerHTML: أسماء الجامعات قد تأتي من ملف
    // JSON خارجي على GitHub، وبناؤها كنص HTML يجعل أي محتوى فيه قابلاً للتنفيذ.
    const fillSelect = (sel, firstLabel, firstValue, labelFor) => {
        sel.textContent = "";
        const first = document.createElement("option");
        first.value = firstValue;
        first.textContent = firstLabel;
        sel.appendChild(first);
        list.forEach(u => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = labelFor(u);
            sel.appendChild(opt);
        });
    };
    fillSelect(calcSel, currentLang==='ar'?'مخصص (أدخل الأوزان يدوياً)':'Custom (enter weights manually)', "custom",
        u => `${uniName(u)} — ${uniCity(u)}`);
    fillSelect(goalSel, t("profile.noneOption"), "", u => uniName(u));

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
                <h3 style="font-size:17px;">${escapeHtml(uniName(uni))}</h3>
                <div class="card-sub">${escapeHtml(uniCity(uni))} · ${uni.type === "private" ? (currentLang==='ar'?'جامعة خاصة':'Private') : (currentLang==='ar'?'جامعة حكومية':'Public')}</div>
            </div>
            <span class="pill ${stepPillClass}"><i class="fa-solid fa-language"></i> ${stepPillText}</span>
        </div>
        ${uni.weights ? `
        <div class="uni-weights-row">
            <div class="weight-chip"><b>${escapeHtml(uni.weights.high)}%</b><span>${t("calc.wHigh")}</span></div>
            <div class="weight-chip"><b>${escapeHtml(uni.weights.qat)}%</b><span>${t("calc.wQat")}</span></div>
            <div class="weight-chip"><b>${escapeHtml(uni.weights.tah)}%</b><span>${t("calc.wTah")}</span></div>
        </div>` : `<div class="uni-note" style="margin-top:8px;">${currentLang==='ar'?'هذه الجامعة تعتمد نظام قبول خاص بها؛ عدّل الأوزان يدوياً إن رغبت بتقدير تقريبي فقط.':'This university uses its own admission system; adjust weights manually only for a rough estimate.'}</div>`}
        <div>
            <div class="card-sub" style="margin-bottom:4px;">${currentLang==='ar'?'مستوى التنافسية المتوقع':'Expected competitiveness'}</div>
            <div class="competitiveness-bar">${[1,2,3,4,5].map(n => `<span class="${n<=compFilled?'on':''}"></span>`).join("")}</div>
        </div>
        <div class="uni-note">${escapeHtml(uniNote(uni) || "")}</div>

        <button type="button" class="btn btn-ghost btn-sm" style="padding:8px 4px; margin-top:6px;" onclick="toggleStepMajorsPanel(this)">
            <i class="fa-solid fa-chevron-down"></i> ${currentLang==='ar' ? 'عرض التخصصات التي تتطلب STEP والتي لا تتطلبه' : 'Show majors that require / don\'t require STEP'}
        </button>
        <div class="uni-note" style="display:none; margin-top:10px;" id="step-majors-panel">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px;">
                <div>
                    <b style="color:var(--rose); font-size:12px;">${currentLang==='ar' ? 'غالباً تتطلب STEP' : 'Usually require STEP'}</b>
                    <ul style="margin:6px 0 0; padding-inline-start:18px; font-size:12px; line-height:1.9;">${majorsYes.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
                </div>
                <div>
                    <b style="color:var(--teal); font-size:12px;">${currentLang==='ar' ? 'غالباً لا تتطلبه' : 'Usually don\'t require it'}</b>
                    <ul style="margin:6px 0 0; padding-inline-start:18px; font-size:12px; line-height:1.9;">${majorsNo.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
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

