/* ============================================================
   31) نهاية السنة الدراسية
   ------------------------------------------------------------
   قرار المالك ونصّه: «آخر السنة الدراسية سيكون بشكل تلقائي ترقية
   جماعية، ولكن لدى المدير القدرة على تحديد بعض الطلاب»، و«بيانات العام
   الماضي أريد أن تُمسح، ولكن ليس بشكل فوري بل بعد مرور أسبوع من بدء
   السنة الدراسية التالية، ولكن من جهة واجهة الطالب فلن يراها — ستُحذف
   فوراً».

   ⚠️ وهذا أخطر زرّ في المنصّة كلّها: يغيّر مرحلة كل طالب، ويُخرج صفّاً
   كاملاً من المدرسة، ويبدأ عدّاد حذفٍ لا رجعة فيه. فالواجهة هنا مبنيّة
   على قاعدة واحدة: **لا يضغط المدير حتى يقرأ بالضبط ما سيحدث بالأرقام**
   — كم يُرقَّى، وكم يتخرّج، وكم يبقى، ومتى يُحذف ما أُرشف.

   ⚠️ ولا يُحسب شيء هنا: الترقية كلّها عبارةٌ واحدة في قاعدة البيانات.
   ولو قُسّمت على نداءات من المتصفّح لانقطع الاتصال يوماً في منتصفها،
   فبقيت المدرسة نصفَ مُرقّاة بلا أن يعرف أحد.
   ============================================================ */

let yearStatus = null;
let yearHoldBack = new Set();
let yearStudents = [];

function yrLabel(ar, en){ return currentLang === "ar" ? ar : en; }

const GRADE_NEXT = { "1": "2", "2": "3" };

function yrGradeText(g){
    return (typeof gradeText === "function") ? gradeText(g) : String(g || "");
}

function yrDate(iso){
    if(!iso) return "—";
    try{
        return new Date(iso).toLocaleDateString(
            currentLang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
            { dateStyle: "long" });
    }catch(e){ return "—"; }
}

function yrDaysLeft(iso){
    if(!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if(isNaN(ms)) return null;
    return Math.max(0, Math.ceil(ms / 86400000));
}

/** بطاقة حالة السنة في إدارة المدرسة. */
async function loadYearStatus(){
    const box = document.getElementById("year-status");
    if(!box || !sb || !schoolCtx || schoolCtx.role !== "admin") return;
    try{
        const { data, error } = await sb.rpc("school_year_status", { p_school: schoolCtx.schoolId });
        if(error) throw error;
        yearStatus = data;
        renderYearStatus();
    }catch(e){
        console.warn("[خُطى] تعذّر قراءة حالة السنة:", e);
        box.innerHTML = `<p class="card-sub">${yrLabel("تعذّر قراءة حالة السنة.","Could not read the year status.")}</p>`;
    }
}

function renderYearStatus(){
    const box = document.getElementById("year-status");
    if(!box) return;
    const s = yearStatus || {};
    const by = s.students_by_grade || {};
    const left = yrDaysLeft(s.archive_purge_at);

    box.innerHTML = `
        <div class="year-line">
            <span>${yrLabel("السنة الحالية","Current year")}</span>
            <b>${escapeHtml(s.year_label || yrLabel("لم تُسمَّ بعد","unnamed"))}</b>
            <span>${yrLabel("بدأت","started")} ${yrDate(s.year_started_at)}</span>
        </div>
        <div class="year-grades">
            ${["1","2","3"].map(g => `
                <div class="year-grade">
                    <b>${Number(by[g]) || 0}</b>
                    <span>${escapeHtml(yrGradeText(g))}</span>
                </div>`).join("")}
        </div>
        ${left === null ? "" : `
        <div class="year-purge ${left <= 2 ? "urgent" : ""}">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>${yrLabel(
                `بيانات العام الماضي (${Number(s.archived_exams) || 0} اختباراً) مخفيّة عن الطلاب الآن، وتُحذف نهائياً ${left === 0 ? "اليوم" : "بعد " + left + " يوم"}. صدّر ما تحتاجه قبل ذلك.`,
                `Last year's data (${Number(s.archived_exams) || 0} exams) is already hidden from students and will be deleted ${left === 0 ? "today" : "in " + left + " days"}.`)}</span>
        </div>`}`;
}

/* ---------- نافذة الترقية ---------- */

async function openYearPromotion(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    yearHoldBack = new Set();

    const m = ensureYearModal();
    m.style.display = "flex";
    m.innerHTML = `<div class="wizard-card" style="max-width:640px;">
        <p class="card-sub">${yrLabel("جارٍ تحضير القوائم…","Loading…")}</p></div>`;

    try{
        const { data, error } = await sb.from("school_members")
            .select("id, full_name, grade, section")
            .eq("school_id", schoolCtx.schoolId)
            .eq("role", "student").eq("active", true)
            .order("grade").order("full_name").limit(1000);
        if(error) throw error;
        yearStudents = data || [];
        renderYearPromotion();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الطلاب:", e);
        m.innerHTML = `<div class="wizard-card" style="max-width:520px;">
            <p class="card-sub">${yrLabel("تعذّر تحميل قائمة الطلاب.","Could not load students.")}</p>
            <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:14px;"
                    onclick="closeYearModal()">${yrLabel("إغلاق","Close")}</button></div>`;
    }
}

function ensureYearModal(){
    let m = document.getElementById("year-modal");
    if(m) return m;
    m = document.createElement("div");
    m.id = "year-modal";
    m.className = "overlay-screen";
    m.style.display = "none";
    document.body.appendChild(m);
    return m;
}

function closeYearModal(){
    const m = document.getElementById("year-modal");
    if(m){ m.style.display = "none"; m.innerHTML = ""; }
    yearHoldBack = new Set();
    yearStudents = [];
}

function toggleYearHold(id){
    if(yearHoldBack.has(id)) yearHoldBack.delete(id); else yearHoldBack.add(id);
    renderYearPromotion();
}

/** ما سيحدث بالأرقام — يُحسب من نفس القوائم المعروضة. */
function yearOutcome(){
    let promoted = 0, graduated = 0;
    yearStudents.forEach(s => {
        if(yearHoldBack.has(s.id)) return;
        if(s.grade === "3") graduated++;
        else if(GRADE_NEXT[s.grade]) promoted++;
    });
    return { promoted, graduated, held: yearHoldBack.size };
}

function renderYearPromotion(){
    const m = ensureYearModal();
    const out = yearOutcome();
    const labelNow = (yearStatus && yearStatus.year_label) || "";

    m.innerHTML = `<div class="wizard-card" style="max-width:640px;">
        <h3 style="margin-bottom:4px;"><i class="fa-solid fa-graduation-cap"></i>
            ${yrLabel("ترقية السنة الدراسية","Promote the school year")}</h3>
        <p class="card-sub" style="margin-bottom:14px;">${yrLabel(
            "كل طالب يصعد مرحلةً، وثالث ثانوي يتخرّج. حدّد من تريد إبقاءه في مرحلته.",
            "Every student moves up a grade; grade 12 graduates. Tick anyone who should stay.")}</p>

        <div class="form-group">
            <label for="year-label-input">${yrLabel("اسم السنة الجديدة","New year label")}</label>
            <input type="text" id="year-label-input" maxlength="24"
                   placeholder="${yrLabel("مثال: ١٤٤٩ أو 2026/2027","e.g. 2026/2027")}"
                   value="${escapeHtml(labelNow)}">
        </div>

        <div class="pick-list" style="max-height:34vh;">
            ${yearStudents.length ? yearStudents.map(s => {
                const held = yearHoldBack.has(s.id);
                const dest = held ? yrLabel("يبقى في مرحلته","stays")
                    : (s.grade === "3" ? yrLabel("يتخرّج ويخرج من المنصّة","graduates")
                                       : `${yrGradeText(s.grade)} ← ${yrGradeText(GRADE_NEXT[s.grade] || s.grade)}`);
                return `
                <button type="button" class="pick-row ${held ? "is-on" : ""}" onclick="toggleYearHold('${escapeHtml(s.id)}')">
                    <i class="fa-${held ? "solid fa-square-check" : "regular fa-square"}"></i>
                    <span class="pick-main"><b>${escapeHtml(s.full_name || "")}</b><small>${escapeHtml(dest)}</small></span>
                </button>`;
            }).join("") : `<p class="card-sub">${yrLabel("لا طلاب نشطين.","No active students.")}</p>`}
        </div>

        <!-- ⚠️ الأرقام قبل الزرّ لا بعده: هذا الفعل لا رجعة فيه -->
        <div class="year-summary">
            <div><b>${out.promoted}</b><span>${yrLabel("يُرقَّى","promoted")}</span></div>
            <div><b>${out.graduated}</b><span>${yrLabel("يتخرّج","graduates")}</span></div>
            <div><b>${out.held}</b><span>${yrLabel("يبقى","held back")}</span></div>
        </div>
        <p class="hint" style="margin-top:10px;">${yrLabel(
            "وتُخفى بيانات العام الماضي عن الطلاب فوراً، وتُحذف نهائياً بعد أسبوع. والمتخرّج يخرج من منصّة المدرسة ويبقى حسابه في خُطى.",
            "Last year's data is hidden from students immediately and permanently deleted after a week.")}</p>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
            <button type="button" id="year-confirm" class="btn acc-btn" style="flex:1; min-width:150px;"
                    onclick="confirmYearPromotion()">
                <i class="fa-solid fa-forward"></i> ${yrLabel("نفّذ الترقية","Promote")}</button>
            <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:120px;"
                    onclick="closeYearModal()">${yrLabel("إلغاء","Cancel")}</button>
        </div>
    </div>`;
}

async function confirmYearPromotion(){
    if(!sb || !schoolCtx) return;
    const out = yearOutcome();
    const label = ((document.getElementById("year-label-input") || {}).value || "").trim();

    /* ⚠️ تأكيدٌ يذكر الأرقام لا "هل أنت متأكد؟". من قرأ "٢١ يتخرّجون"
       يتوقّف إن كان الرقم خاطئاً — ومن قرأ "هل أنت متأكد" يضغط نعم. */
    if(!confirm(yrLabel(
        `سيُرقَّى ${out.promoted} طالباً، ويتخرّج ${out.graduated}، ويبقى ${out.held} في مرحلته.\n` +
        `وتُخفى بيانات العام الماضي فوراً وتُحذف نهائياً بعد أسبوع.\n\nهذا الإجراء لا رجعة فيه. أُنفّذه؟`,
        `${out.promoted} promoted, ${out.graduated} graduating, ${out.held} held back.\n` +
        `Last year's data is hidden now and deleted after a week.\n\nThis cannot be undone. Continue?`))) return;

    const btn = document.getElementById("year-confirm");
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    try{
        const { data, error } = await sb.rpc("promote_school_year", {
            p_school: schoolCtx.schoolId,
            p_year_label: label || null,
            p_hold_back: [...yearHoldBack],
        });
        if(error) throw error;
        closeYearModal();
        showToast(yrLabel(
            `تمّت الترقية: ${data.promoted} مُرقَّى، ${data.graduated} متخرّج.`,
            `Done: ${data.promoted} promoted, ${data.graduated} graduated.`));
        await loadYearStatus();
        if(typeof loadAdminClasses === "function") loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّرت الترقية:", e);
        showToast(yearPromotionError(e));
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
    }
}

function yearPromotionError(e){
    const raw = [e && e.message, e && e.details, e && e.hint].filter(Boolean).join(" | ");
    if(/NEEDS_GOOGLE/.test(raw))
        return yrLabel("الترقية تتطلّب تأكيد هويتك بحساب Google — سجّل الدخول به ثم أعد المحاولة.",
                       "Promotion requires a fresh Google sign-in.");
    if(/NOT_ALLOWED/.test(raw)) return yrLabel("هذا الإجراء لإدارة المدرسة.", "Admins only.");
    return yrLabel("تعذّرت الترقية — لم يتغيّر شيء.", "Promotion failed — nothing changed.");
}
