/* ============================================================
   40) لوحة المرشد الطلابي (المرحلة ٥)
   ------------------------------------------------------------
   قرار المالك: ضعف الفصل **حسب المادة** (الرياضيات مثلاً) — لا حسب مهارات
   القدرات، فالقدرات في خُطى تنظيم وقت لا دروس مقسّمة.

   • يراها المدير، ومن يضع عليه المدير علامة «مرشد» (is_counselor).
   • المصدر: واجبات المنصة واختباراتها فقط (الدرجة من المجموع). درجات نور
     الرسمية **لا يُحسب منها شيء** — تُعرض كما هي في ملف الطالب. والتدريب
     (مساحة القدرات) خارجها: «بلا درجات».
   • ⚠️ حدّ أدنى للبيانات قبل أي حكم: خلية فيها أقل من ٥ تسليمات تُكتب
     «بيانات قليلة» لا نسبة — كي لا يُوصف فصلٌ بالضعف من واجب واحد.
   • القاعدة تُرجع الأرقام الخام لكل (طالب، مادة) (counselor_overview)،
     والتجميع هنا — فتتغيّر الحدود دون المساس بالقاعدة.
   ============================================================ */

const CNS_WEAK = 50;          // أقل من هذا: ضعف
const CNS_WATCH = 65;         // أقل من هذا: يحتاج متابعة
const CNS_MIN_CELL = 5;       // أقل تسليمات لخلية فصل×مادة قبل الحكم
const CNS_MIN_STUDENT = 2;    // أقل تسليمات لطالب في مادة قبل الحكم
const CNS_MISSED_FLAG = 2;    // أعمال فائتة تستدعي المتابعة

function cnsL(ar, en){ return currentLang === "ar" ? ar : en; }
let cnsData = null, cnsAllowed = false;
let cnsSeq = 0;   // كل فحص يحمل رقمه؛ وحده الأحدث يحقّ له أن يُظهر التبويب

/** يُظهر التبويب لمن يحقّ له فقط — والقاعدة تفرض الحقّ على أي حال.
 *  ⚠️ فحصان متداخلان (تبدّل الحساب أثناء انتظار الخادم) كان أقدمهما يعود
 *  آخراً فيُظهر التبويب لمن لا يحقّ له — كشفه فحص تبديل الأدوار. فنتجاهل
 *  أي ردّ ليس للفحص الأحدث. */
async function initCounselorAccess(){
    const seq = ++cnsSeq;
    const nav = document.getElementById("nav-counselor");
    const apply = on => { if(seq !== cnsSeq) return; cnsAllowed = on; if(nav) nav.style.display = on ? "" : "none"; };
    // الطالب ومن لا مدرسة له: يُخفى فوراً. والطاقم: يبقى كما هو حتى يردّ الخادم (بلا وميض)
    if(!schoolCtx || !sb || schoolCtx.role === "student"){ apply(false); return; }
    if(schoolCtx.role === "admin"){ apply(true); return; }
    const ctxAtStart = schoolCtx;
    try{
        const { data, error } = await sb.rpc("is_school_counselor", { p_school: schoolCtx.schoolId });
        if(error) throw error;
        if(schoolCtx === ctxAtStart) apply(data === true);
    }catch(e){ console.warn("[خُطى] تعذّر فحص صلاحية المرشد:", e); }
}

async function renderCounselorTab(){
    const box = document.getElementById("cns-body");
    if(!box || !sb || !schoolCtx) return;
    box.innerHTML = `<p class="card-sub">${cnsL("جارٍ التحميل…", "Loading…")}</p>`;
    try{
        const { data, error } = await sb.rpc("counselor_overview", { p_school: schoolCtx.schoolId });
        if(error) throw error;
        cnsData = data || {};
        renderCounselorBody();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل لوحة المرشد:", e);
        const raw = (e && e.message) || "";
        box.innerHTML = `<p class="card-sub">${escapeHtml(/NOT_ALLOWED/.test(raw)
            ? cnsL("هذه اللوحة للمرشد الطلابي والإدارة.", "For the counselor and admin only.")
            : (typeof schoolError === "function" ? schoolError(e, cnsL("تحميل اللوحة", "loading")) : cnsL("تعذّر التحميل.", "Could not load.")))}</p>`;
    }
}

function cnsBand(pct){
    if(pct === null || pct === undefined) return "none";
    return pct < CNS_WEAK ? "weak" : pct < CNS_WATCH ? "watch" : "ok";
}

/* تجميع مجموعة صفوف (طالب، مادة): المتوسط موزون بعدد التسليمات، ونسبة التسليم */
function cnsAggregate(rows){
    let a = 0, d = 0, m = 0, weighted = 0;
    rows.forEach(r => {
        a += r.a; d += r.d; m += r.m;
        if(r.p !== null && r.p !== undefined) weighted += Number(r.p) * r.d;
    });
    return { a, d, m, pct: d ? Math.round(weighted / d) : null, rate: a ? Math.round(d * 100 / a) : null };
}

function renderCounselorBody(){
    const box = document.getElementById("cns-body");
    const D = cnsData || {};
    const students = D.students || [], ss = D.ss || [];
    const byStudent = new Map(students.map(s => [s.id, s]));
    const subjName = new Map((D.subjects || []).map(s => [s.id, currentLang === "ar" ? s.name : (s.name_en || s.name)]));
    const prevG = (document.getElementById("cns-grade") || {}).value || "";
    const prevS = (document.getElementById("cns-subject") || {}).value || "";

    if(!ss.length){
        box.innerHTML = `<div class="uni-note"><b>${cnsL("لا بيانات بعد", "No data yet")}</b>
            <p style="margin:6px 0 0;">${cnsL("تمتلئ اللوحة حين يرسل المعلّمون واجبات واختبارات مربوطة بمادة ويسلّمها الطلاب.",
                "The dashboard fills as teachers send subject homework and exams.")}</p></div>`;
        return;
    }

    const rows = ss.filter(r => {
        const st = byStudent.get(r.st);
        return st && (!prevG || String(st.grade) === prevG) && (!prevS || r.sub === prevS);
    });
    const usedSubjects = [...new Set(ss.map(r => r.sub))].filter(id => subjName.has(id));
    const shownSubjects = usedSubjects.filter(id => !prevS || id === prevS);
    const classes = (D.classes || []).filter(c => !prevG || String(c.grade) === prevG);
    const grades = (typeof schoolGradesList === "function") ? schoolGradesList() : [];

    // ١) الفصل × المادة
    const cell = (classId, subId) => cnsAggregate(rows.filter(r => r.sub === subId && (byStudent.get(r.st) || {}).class === classId));
    const heat = classes.map(c => {
        const cells = shownSubjects.map(sub => {
            const g = cell(c.id, sub);
            if(!g.a) return `<td class="cns-cell none">—</td>`;
            if(g.d < CNS_MIN_CELL) return `<td class="cns-cell none" title="${cnsL(`${g.d} تسليمات فقط`, `${g.d} submissions`)}">${cnsL("بيانات قليلة", "little data")}</td>`;
            return `<td class="cns-cell ${cnsBand(g.pct)}" title="${cnsL(`سلّم ${g.d} من ${g.a} · فائت ${g.m}`, `${g.d}/${g.a} in · ${g.m} missed`)}">
                <b>${g.pct}%</b><small>${cnsL("تسليم", "in")} ${g.rate}%</small></td>`;
        }).join("");
        return `<tr><th>${escapeHtml(c.name || "")}</th>${cells}</tr>`;
    }).join("");

    // ٢) المواد على مستوى المدرسة (أو المرحلة المختارة)
    const subjRank = shownSubjects.map(sub => ({ sub, g: cnsAggregate(rows.filter(r => r.sub === sub)) }))
        .filter(x => x.g.d >= CNS_MIN_CELL).sort((x, y) => x.g.pct - y.g.pct);

    // ٣) طلاب يحتاجون متابعة
    const perStudent = new Map();
    rows.forEach(r => {
        if(!perStudent.has(r.st)) perStudent.set(r.st, { weak: [], missed: 0 });
        const p = perStudent.get(r.st);
        p.missed += r.m;
        if(r.d >= CNS_MIN_STUDENT && r.p !== null && r.p < CNS_WEAK) p.weak.push({ sub: r.sub, pct: Number(r.p) });
    });
    const attention = [...perStudent.entries()]
        .filter(([, p]) => p.weak.length || p.missed >= CNS_MISSED_FLAG)
        .map(([id, p]) => ({ st: byStudent.get(id), ...p }))
        .filter(x => x.st)
        .sort((x, y) => (y.weak.length - x.weak.length) || (y.missed - x.missed));
    const className = new Map((D.classes || []).map(c => [c.id, c.name]));

    box.innerHTML = `
    <div class="input-row">
        <div class="form-group"><label>${cnsL("المرحلة", "Grade")}</label>
            <select id="cns-grade" onchange="renderCounselorBody()"><option value="">${cnsL("كل المراحل", "All grades")}</option>
                ${grades.map(g => `<option value="${escapeHtml(g.code)}" ${prevG === String(g.code) ? "selected" : ""}>${escapeHtml(gradeName(g.code))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${cnsL("المادة", "Subject")}</label>
            <select id="cns-subject" onchange="renderCounselorBody()"><option value="">${cnsL("كل المواد", "All subjects")}</option>
                ${usedSubjects.map(id => `<option value="${escapeHtml(id)}" ${prevS === id ? "selected" : ""}>${escapeHtml(subjName.get(id))}</option>`).join("")}</select></div>
    </div>
    <p class="hint">${cnsL(
        `من واجبات المنصة واختباراتها فقط — درجات نور لا تدخل هنا (تُعرض كما هي في ملف الطالب)، والتدريب خارجها. الأحمر أقل من ${CNS_WEAK}٪، والأصفر أقل من ${CNS_WATCH}٪.`,
        `From platform homework and exams only — Noor grades aren't used; practice is excluded. Red < ${CNS_WEAK}%, amber < ${CNS_WATCH}%.`)}</p>

    <h3 style="margin:14px 0 8px;">${cnsL("الفصول حسب المادة", "Classes by subject")}</h3>
    ${classes.length && shownSubjects.length ? `<div class="rec-scroll"><table class="report-table cns-heat">
        <thead><tr><th>${cnsL("الفصل", "Class")}</th>${shownSubjects.map(id => `<th>${escapeHtml(subjName.get(id))}</th>`).join("")}</tr></thead>
        <tbody>${heat}</tbody></table></div>` : `<p class="card-sub">${cnsL("لا فصول في هذا الاختيار.", "No classes here.")}</p>`}

    <h3 style="margin:18px 0 8px;">${cnsL("المواد الأضعف", "Weakest subjects")}</h3>
    ${subjRank.length ? subjRank.map(x => `<div class="cns-subj ${cnsBand(x.g.pct)}">
        <b>${escapeHtml(subjName.get(x.sub))}</b>
        <span>${x.g.pct}% · ${cnsL(`تسليم ${x.g.rate}%`, `${x.g.rate}% in`)} · ${cnsL(`فائت ${x.g.m}`, `${x.g.m} missed`)}</span></div>`).join("")
      : `<p class="card-sub">${cnsL("لا مادة فيها بيانات كافية بعد.", "Not enough data yet.")}</p>`}

    <h3 style="margin:18px 0 8px;">${cnsL("طلاب يحتاجون متابعة", "Students needing attention")} <span class="pill">${attention.length}</span></h3>
    ${attention.length ? attention.slice(0, 100).map(x => `<div class="member-row cns-student">
        <div><button type="button" class="linklike" onclick="openStudentFile('${escapeHtml(x.st.id)}')">${escapeHtml(x.st.name || "")}</button>
            <span class="card-sub"> · ${escapeHtml(className.get(x.st.class) || gradeName(x.st.grade))}</span>
            <div class="cns-chips">${x.weak.sort((a, b) => a.pct - b.pct).map(w =>
                `<span class="cns-chip weak">${escapeHtml(subjName.get(w.sub) || "")} ${w.pct}%</span>`).join("")}
                ${x.missed ? `<span class="cns-chip watch">${cnsL(`فائت ${x.missed}`, `${x.missed} missed`)}</span>` : ""}
                ${x.st.absent ? `<span class="cns-chip">${cnsL(`غياب ${escapeHtml(String(x.st.absent))} يوم`, `${escapeHtml(String(x.st.absent))} days absent`)}</span>` : ""}</div></div>
        </div>`).join("") : `<p class="card-sub">${cnsL("لا أحد تحت الحدّ الآن.", "Nobody below the threshold.")}</p>`}
    <p class="hint" style="margin-top:12px;">${cnsL("فتح ملف الطالب يُسجَّل في سجلّ الاطّلاع كبقية الطاقم.", "Opening a student's file is logged like any staff view.")}</p>`;
}

/* تعيين المرشد من قائمة الأعضاء (الإدارة) — السياسة تشترط مديراً بإثبات Google */
async function toggleCounselor(memberId, on){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    try{
        const { error } = await sb.from("school_members").update({ is_counselor: !!on }).eq("id", memberId);
        if(error) throw error;
        showToast(on ? cnsL("صار مرشداً ✅", "Now a counselor ✅") : cnsL("أُلغيت صفة المرشد", "Counselor removed"));
        if(typeof loadSchoolMembers === "function") loadSchoolMembers();
    }catch(e){
        console.error("[خُطى] تعذّر تعيين المرشد:", e);
        showSchoolError(e, cnsL("تعيين المرشد", "setting the counselor"));
    }
}
