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
let yearCodeSentTo = null;      // بعد إرسال الرمز: البريد المقنَّع — تظهر خانة الرمز
let yearCodeResendAt = 0;

function yrLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/* المراحل مرتّبة كما ترتّبها قاعدة البيانات حرفياً (sort_order ثم code) —
   فما يعرضه هذا الملخّص هو ما ستفعله promote_school_year بالضبط. كانت
   هنا «١←٢، ٢←٣، ٣ يتخرّج» ثابتة، فمدرسة ابتدائية تُرقّي الصف الثالث
   إلى التخرّج في الملخّص بينما القاعدة ترقّيه للرابع. */
function yrGrades(){
    const list = (typeof schoolGradesList === "function") ? schoolGradesList() : [];
    return [...list].sort((a, b) => ((a.sort || 0) - (b.sort || 0)) || String(a.code).localeCompare(String(b.code)));
}

/** المرحلة التالية، أو null للمتخرّج، أو undefined لمرحلة غير معروفة (لا تُمسّ). */
function yrNextGrade(code){
    if(code === null || code === undefined || code === "") return undefined;
    const list = yrGrades();
    const i = list.findIndex(g => String(g.code) === String(code));
    if(i < 0) return undefined;
    return i === list.length - 1 ? null : list[i + 1].code;
}

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
            ${yrGrades().map(g => `
                <div class="year-grade">
                    <b>${Number(by[g.code]) || 0}</b>
                    <span>${escapeHtml(yrGradeText(g.code))}</span>
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
    yearCodeSentTo = null;
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
        const next = yrNextGrade(s.grade);
        if(next === null) graduated++;
        else if(next) promoted++;
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
        <p class="card-sub" style="margin-bottom:14px;">${(() => {
            const g = yrGrades(); const last = g.length ? escapeHtml(yrGradeText(g[g.length - 1].code)) : "";
            return yrLabel(
                `كل طالب يصعد مرحلةً، و${last} يتخرّج. حدّد من تريد إبقاءه في مرحلته.`,
                `Every student moves up a grade; ${last} graduates. Tick anyone who should stay.`);
        })()}</p>

        <div class="form-group">
            <label for="year-label-input">${yrLabel("اسم السنة الجديدة","New year label")}</label>
            <input type="text" id="year-label-input" maxlength="24"
                   placeholder="${yrLabel("مثال: ١٤٤٩ أو 2026/2027","e.g. 2026/2027")}"
                   value="${escapeHtml(labelNow)}">
        </div>

        <div class="pick-list" style="max-height:34vh;">
            ${yearStudents.length ? yearStudents.map(s => {
                const held = yearHoldBack.has(s.id);
                const next = yrNextGrade(s.grade);
                const dest = held ? yrLabel("يبقى في مرحلته","stays")
                    : next === null ? yrLabel("يتخرّج ويخرج من المنصّة","graduates")
                    : next ? `${yrGradeText(s.grade)} ← ${yrGradeText(next)}`
                    : yrLabel("بلا مرحلة معروفة — لا يتغيّر","no known grade — unchanged");
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

        <!-- ⚠️ طبقة الأمان: رمز من بريد المدير، تتحقّق منه قاعدة البيانات نفسها -->
        <div class="year-code">
            ${yearCodeSentTo ? `
            <p class="hint" style="margin:0 0 8px;">${yrLabel(
                `أُرسل رمز من ٦ أرقام إلى ${escapeHtml(yearCodeSentTo)} — صالح ١٠ دقائق ولمرة واحدة.`,
                `A 6-digit code was sent to ${escapeHtml(yearCodeSentTo)} — valid 10 minutes, once.`)}</p>
            <div class="form-group"><label for="year-code-input">${yrLabel("رمز التحقق","Verification code")}</label>
                <input type="text" id="year-code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" dir="ltr"
                       placeholder="••••••" style="letter-spacing:6px; font-size:20px; text-align:center;"></div>` : `
            <p class="hint" style="margin:0 0 8px;">${yrLabel(
                "لن تُنفَّذ الترقية إلا برمز تحقق يُرسل إلى بريدك الإداري.",
                "Promotion needs a code sent to your admin email.")}</p>`}
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
            ${yearCodeSentTo ? `
            <button type="button" id="year-confirm" class="btn btn-danger-outline btn-outline" style="flex:1; min-width:150px;"
                    onclick="confirmYearPromotion()">
                <i class="fa-solid fa-lock-open"></i> ${yrLabel("تأكيد الترقية بالرمز","Confirm with code")}</button>
            <button type="button" id="year-resend" class="btn btn-ghost btn-sm" onclick="sendYearCode()">
                ${yrLabel("أعد إرسال الرمز","Resend code")}</button>` : `
            <button type="button" id="year-send-code" class="btn btn-outline" style="flex:1; min-width:150px;"
                    onclick="sendYearCode()">
                <i class="fa-solid fa-envelope"></i> ${yrLabel("أرسل رمز التحقق إلى بريدي","Email me a code")}</button>`}
            <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:120px;"
                    onclick="closeYearModal()">${yrLabel("إلغاء","Cancel")}</button>
        </div>
    </div>`;
}

async function sendYearCode(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    if(Date.now() < yearCodeResendAt){
        showToast(yrLabel("انتظر دقيقة قبل طلب رمز جديد.", "Wait a minute before requesting another code."));
        return;
    }
    const btn = document.getElementById("year-send-code") || document.getElementById("year-resend");
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    // نحفظ ما كتبه المدير قبل إعادة الرسم
    const label = ((document.getElementById("year-label-input") || {}).value || "");
    try{
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        if(!token) throw Object.assign(new Error("NO_SESSION"), { code:"NO_SESSION" });
        const res = await fetch("/.netlify/functions/sensitive-code", {
            method:"POST", headers:{ "Content-Type":"application/json" },
            body: JSON.stringify({ accessToken: token, action: "promote_year" }),
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw Object.assign(new Error(data.error || "FAILED"), { code: data.error });
        yearCodeSentTo = data.sentTo || yrLabel("بريدك", "your email");
        yearCodeResendAt = Date.now() + 60000;
        renderYearPromotion();
        const li = document.getElementById("year-label-input"); if(li) li.value = label;
        const ci = document.getElementById("year-code-input"); if(ci) ci.focus();
    }catch(e){
        console.error("[خُطى] تعذّر إرسال رمز التحقق:", e);
        showToast(yearCodeError(e.code || e.message));
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
    }
}

function yearCodeError(code){
    const c = String(code || "");
    if(/NEEDS_GOOGLE/.test(c))   return yrLabel("يتطلّب تأكيد هويتك بحساب Google.", "Requires Google sign-in.");
    if(/NOT_ADMIN/.test(c))      return yrLabel("هذا الإجراء لإدارة المدرسة.", "Admins only.");
    if(/CODE_TOO_SOON/.test(c))  return yrLabel("أُرسل رمز قبل أقل من دقيقة — انتظر قليلاً.", "Wait a minute.");
    if(/CODE_TOO_MANY/.test(c))  return yrLabel("طلبات رموز كثيرة خلال ساعة — حاول لاحقاً.", "Too many codes this hour.");
    if(/CODE_INVALID/.test(c))   return yrLabel("الرمز غير صحيح. تحقّق منه في بريدك (٥ محاولات ثم يُقفل).", "Wrong code (5 tries, then locked).");
    if(/CODE_LOCKED/.test(c))    return yrLabel("أُقفل الرمز بعد ٥ محاولات خاطئة — اطلب رمزاً جديداً.", "Code locked — request a new one.");
    if(/CODE_MISSING/.test(c))   return yrLabel("انتهت صلاحية الرمز أو استُعمل — اطلب رمزاً جديداً.", "Code expired or used — request a new one.");
    if(/MAIL/.test(c))           return yrLabel("تعذّر إرسال البريد الآن — حاول بعد قليل.", "Could not send the email.");
    if(/NO_SESSION/.test(c))     return yrLabel("سجّل الدخول أولاً.", "Sign in first.");
    return yrLabel("تعذّر إرسال الرمز.", "Could not send the code.");
}

async function confirmYearPromotion(){
    if(!sb || !schoolCtx) return;
    const out = yearOutcome();
    const label = ((document.getElementById("year-label-input") || {}).value || "").trim();
    const code = ((document.getElementById("year-code-input") || {}).value || "").replace(/\D/g, "");
    if(code.length !== 6){ showToast(yrLabel("اكتب الرمز المكوّن من ٦ أرقام من بريدك.", "Enter the 6-digit code.")); return; }

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
            p_code: code,
        });
        if(error) throw error;
        // رمز خاطئ/منتهٍ: يُرجَع خطأً لا استثناءً (كي يُحسب في عدّاد المحاولات)
        if(data && data.error){ showToast(yearCodeError(data.error)); return; }
        yearCodeSentTo = null;
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
