/* ============================================================
   إرسال الاختبار: لفصول، أو لمراحل، أو لطلاب بأعيانهم
   ------------------------------------------------------------
   طلب المالك: "يمكنه إرفاق الاختبار الإلكتروني على فصل، فصول محددة، أو
   مراحل دراسية محددة" — وأضفنا الطلاب بأعيانهم مع بحث، لأن حالة "اختبار
   تعويضي لثلاثة طلاب غابوا" تتكرّر كل أسبوع ولا يغطّيها الفصل ولا المرحلة.

   جدول exam_assignments يقبل واحداً من ثلاثة في كل صف (فصل أو مرحلة أو
   طالب)، وقيدٌ في قاعدة البيانات يفرض ألّا يجتمع اثنان في صف واحد.

   ⚠️ الإرسال فعل حسّاس: يشترط إثبات Google في السياسات، فالدخول السريع على
   السبورة لا يكفيه. وهذا مقصود — لا نريد أن يرسل طالبٌ اختباراً باسم معلّمه.
   ============================================================ */

let examSendTarget = null;      // معرّف الاختبار الجاري إرساله
let examSendMode = "classes";   // classes | grades | students
let examSendPicked = { classes:new Set(), grades:new Set(), students:new Set() };
let examStudentsCache = [];

const SCHOOL_GRADES = [
    { value:"1", ar:"أول ثانوي",   en:"Grade 10" },
    { value:"2", ar:"ثاني ثانوي",  en:"Grade 11" },
    { value:"3", ar:"ثالث ثانوي",  en:"Grade 12" },
];
function gradeText(v){
    const g = SCHOOL_GRADES.find(x => x.value === String(v));
    return g ? (currentLang==='ar' ? g.ar : g.en) : String(v || "");
}

async function openExamSend(examId){
    if(!sb || !schoolCtx) return;
    examSendTarget = examId;
    examSendMode = "classes";
    examSendPicked = { classes:new Set(), grades:new Set(), students:new Set() };

    const modal = document.getElementById("exam-send-modal");
    if(!modal) return;
    modal.style.display = "flex";

    resetExamSendSettings();
    if(!schoolClasses.length) await loadSchoolClasses();
    await loadExamStudents();
    await loadExamSendSettings(examId);
    renderExamSend();
}

/* ============================================================
   إعدادات الإرسال: الموعد، وكشف الإجابات، والمؤقّت
   ------------------------------------------------------------
   ⚠️ ولماذا هنا لا في بناء الاختبار؟ لأن الموعد صفةُ الإرسال لا صفةُ
   الاختبار: نفس الاختبار قد يُرسل لفصلٍ اليوم ولفصلٍ غاب أسبوعاً بعده،
   ولكلٍّ موعده. ولهذا يسكن due_at في exam_assignments لا في teacher_exams.

   ⚠️ وأما timed و reveal_mode فصفتا الاختبار نفسه — فإن أُعيد إرساله
   بإعدادٍ مختلف، غلب الأخيرُ على الجميع. ولهذا نقرأ الإعداد الحالي
   ونعرضه للمعلّم بدل أن نُصفّره عند كل فتح، كي يرى ما سيغيّره.

   ⚠️ والافتراض «بعد موعد التسليم» عن قصد: «فور التسليم» يعني أن أول
   مسلِّم في الصف يصوّر الإجابات ويرسلها لبقيّة زملائه قبل أن يبدأوا.
   ============================================================ */

function resetExamSendSettings(){
    const due = document.getElementById("exam-send-due");
    if(due) due.value = "";
    const reveal = document.getElementById("exam-send-reveal");
    if(reveal) reveal.value = "after_due";
    const timed = document.getElementById("exam-send-timed");
    if(timed) timed.checked = false;
    const dur = document.getElementById("exam-send-duration");
    if(dur) dur.value = "30";
    toggleExamSendTimer(false);
}

function toggleExamSendTimer(on){
    const wrap = document.getElementById("exam-send-duration-wrap");
    if(wrap) wrap.style.display = on ? "block" : "none";
}

async function loadExamSendSettings(examId){
    if(!sb || !examId) return;
    try{
        const { data, error } = await sb.from("teacher_exams")
            .select("timed, duration_min, reveal_mode").eq("id", examId).maybeSingle();
        if(error) throw error;
        if(!data) return;
        const reveal = document.getElementById("exam-send-reveal");
        if(reveal && data.reveal_mode) reveal.value = data.reveal_mode;
        const timed = document.getElementById("exam-send-timed");
        if(timed) timed.checked = !!data.timed;
        const dur = document.getElementById("exam-send-duration");
        if(dur && data.duration_min) dur.value = String(data.duration_min);
        toggleExamSendTimer(!!data.timed);
    }catch(e){
        // لا نُفشل الإرسال لأجل إعدادٍ لم يُقرأ — تبقى القيم الافتراضية
        console.warn("[خُطى] تعذّر قراءة إعدادات الاختبار:", e);
    }
}

/** ما أدخله المعلّم، أو خطأً مفهوماً إن كان الإدخال غير صالح. */
function readExamSendSettings(){
    const dueEl = document.getElementById("exam-send-due");
    const raw = (dueEl && dueEl.value || "").trim();
    let dueAt = null;
    if(raw){
        /* ⚠️ datetime-local بلا منطقة زمنية، وnew Date يقرؤه بتوقيت متصفّح
           المعلّم — وهو المطلوب: المعلّم في الرياض يكتب توقيت الرياض. */
        const d = new Date(raw);
        if(isNaN(d.getTime())){
            return { error: currentLang==='ar' ? 'موعد التسليم غير صالح' : 'Invalid due date' };
        }
        dueAt = d.toISOString();
    }

    const timed = !!(document.getElementById("exam-send-timed") || {}).checked;
    let duration = null;
    if(timed){
        duration = parseInt((document.getElementById("exam-send-duration") || {}).value, 10);
        if(!duration || duration < 1 || duration > 300){
            return { error: currentLang==='ar'
                ? 'اكتب مدّة بين ١ و٣٠٠ دقيقة، أو أطفئ المؤقّت'
                : 'Enter 1–300 minutes, or turn the timer off' };
        }
    }

    const revealEl = document.getElementById("exam-send-reveal");
    let reveal = (revealEl && revealEl.value) || "after_due";
    if(!["after_due","immediately","never"].includes(reveal)) reveal = "after_due";

    return { dueAt, timed, duration, reveal };
}

function closeExamSend(){
    examSendTarget = null;
    const modal = document.getElementById("exam-send-modal");
    if(modal) modal.style.display = "none";
    const search = document.getElementById("exam-send-search");
    if(search) search.value = "";
}

function setExamSendMode(mode){
    examSendMode = mode;
    renderExamSend();
}

async function loadExamStudents(){
    if(!sb || !schoolCtx) return;
    try{
        // ⚠️ السياسات تقصر ما يراه المعلّم على طلاب فصوله — فما يعود هنا هو
        // ما يحقّ له استهدافه، لا كل طلاب المدرسة.
        const { data, error } = await sb.from("school_members")
            .select("id, full_name, grade, section")
            .eq("role", "student").eq("active", true)
            .order("full_name").limit(1000);
        if(error) throw error;
        examStudentsCache = data || [];
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الطلاب:", e);
        examStudentsCache = [];
    }
}

function toggleExamPick(kind, value){
    const set = examSendPicked[kind];
    if(set.has(value)) set.delete(value); else set.add(value);
    renderExamSend();
}

function examSendTotalPicked(){
    return examSendPicked.classes.size + examSendPicked.grades.size + examSendPicked.students.size;
}

function renderExamSend(){
    const box = document.getElementById("exam-send-body");
    if(!box) return;

    ["classes","grades","students"].forEach(m => {
        const tab = document.getElementById("exam-send-tab-" + m);
        if(tab) tab.classList.toggle("is-active", examSendMode === m);
    });
    const searchWrap = document.getElementById("exam-send-search-wrap");
    if(searchWrap) searchWrap.style.display = examSendMode === "students" ? "block" : "none";

    let html = "";
    if(examSendMode === "classes"){
        html = schoolClasses.length
            ? schoolClasses.map(c => pickRow("classes", c.id,
                `${escapeHtml(c.name)}`,
                `${gradeText(c.grade)}${c.section ? " · " + escapeHtml(c.section) : ""}`)).join("")
            : `<p class="card-sub">${currentLang==='ar' ? 'لا فصول مسندة إليك بعد. تسندها الإدارة.' : 'No classes assigned to you yet.'}</p>`;
    }else if(examSendMode === "grades"){
        html = SCHOOL_GRADES.map(g => pickRow("grades", g.value,
            currentLang==='ar' ? g.ar : g.en,
            currentLang==='ar' ? 'كل طلاب هذه المرحلة' : 'All students in this grade')).join("");
    }else{
        const q = ((document.getElementById("exam-send-search") || {}).value || "").trim().toLowerCase();
        const list = q
            ? examStudentsCache.filter(s => (s.full_name || "").toLowerCase().includes(q))
            : examStudentsCache;
        html = list.length
            ? list.slice(0, 200).map(s => pickRow("students", s.id,
                escapeHtml(s.full_name),
                `${gradeText(s.grade)}${s.section ? " · " + escapeHtml(s.section) : ""}`)).join("")
            : `<p class="card-sub">${q
                ? (currentLang==='ar' ? 'لا طالب بهذا الاسم.' : 'No student by that name.')
                : (currentLang==='ar' ? 'لا يظهر لك طلاب — تأكد من إسناد فصولك.' : 'No students visible to you.')}</p>`;
        if(list.length > 200){
            html += `<p class="hint">${currentLang==='ar' ? `يُعرض أول ٢٠٠ من ${list.length}. اكتب في البحث للتضييق.` : `Showing 200 of ${list.length}. Use search.`}</p>`;
        }
    }
    box.innerHTML = html;

    const summary = document.getElementById("exam-send-summary");
    if(summary){
        const n = examSendTotalPicked();
        summary.textContent = n
            ? (currentLang==='ar' ? `المحدَّد: ${n}` : `${n} selected`)
            : (currentLang==='ar' ? 'لم تحدّد شيئاً بعد' : 'Nothing selected yet');
    }
    const btn = document.getElementById("exam-send-confirm");
    if(btn) btn.disabled = examSendTotalPicked() === 0;
}

/** يضبط موعد التسليم على كل ما اختاره المعلّم الآن — جديداً كان أو قديماً. */
async function updateAssignmentDue(dueAt){
    const jobs = [];
    if(examSendPicked.classes.size)
        jobs.push(sb.from("exam_assignments").update({ due_at:dueAt })
            .eq("exam_id", examSendTarget).in("class_id", [...examSendPicked.classes]));
    if(examSendPicked.grades.size)
        jobs.push(sb.from("exam_assignments").update({ due_at:dueAt })
            .eq("exam_id", examSendTarget).in("grade", [...examSendPicked.grades]));
    if(examSendPicked.students.size)
        jobs.push(sb.from("exam_assignments").update({ due_at:dueAt })
            .eq("exam_id", examSendTarget).in("student_id", [...examSendPicked.students]));
    const results = await Promise.all(jobs);
    const bad = results.find(r => r && r.error);
    if(bad) throw bad.error;
}

function pickRow(kind, value, title, sub){
    const on = examSendPicked[kind].has(value);
    return `
    <button type="button" class="pick-row ${on ? 'is-on' : ''}" onclick="toggleExamPick('${kind}', '${escapeHtml(String(value))}')">
        <i class="fa-${on ? 'solid fa-square-check' : 'regular fa-square'}"></i>
        <span class="pick-main"><b>${title}</b><small>${sub}</small></span>
    </button>`;
}

/* ⚠️ الإرسال يكتب صفوف الإسناد أولاً ثم ينشر ثم يجدول البريد.
   ولا نعتبر التعارض 23505 خطأً: إعادة الإرسال لنفس الفصل أمر طبيعي.

   ⚠️ لكن تجاهل 23505 وحده كان يُسقط الإرسال كلّه صامتاً. الإدخال في
   PostgreSQL ذرّة واحدة: لو أرسل المعلّم لفصلٍ سبق أن أرسل له وفصلٍ جديد
   معه، رفع الصفُّ القديم 23505 فتراجعت العملية بأكملها — بما فيها الفصل
   الجديد — ورأى المعلّم "أُرسل ✅" وطلاب الفصل الجديد لا اختبار عندهم.
   فالآن نقرأ الموجود ونُدخل الجديد وحده، ثم نُحدّث الموعد على الجميع. */
async function confirmExamSend(){
    if(!sb || !schoolCtx || !examSendTarget) return;
    const wanted = [];
    examSendPicked.classes.forEach(id  => wanted.push({ exam_id:examSendTarget, class_id:id }));
    examSendPicked.grades.forEach(g    => wanted.push({ exam_id:examSendTarget, grade:g }));
    examSendPicked.students.forEach(id => wanted.push({ exam_id:examSendTarget, student_id:id }));
    if(!wanted.length) return;

    const settings = readExamSendSettings();
    if(settings.error){ showToast(settings.error); return; }

    const btn = document.getElementById("exam-send-confirm");
    schoolBusy(btn, true);
    try{
        const { data: existing, error: exErr } = await sb.from("exam_assignments")
            .select("class_id, grade, student_id").eq("exam_id", examSendTarget);
        if(exErr) throw exErr;
        const seen = new Set((existing || []).map(r => `${r.class_id || ""}|${r.grade || ""}|${r.student_id || ""}`));
        const fresh = wanted.filter(r =>
            !seen.has(`${r.class_id || ""}|${r.grade || ""}|${r.student_id || ""}`));

        if(fresh.length){
            const { error } = await sb.from("exam_assignments")
                .insert(fresh.map(r => ({ ...r, due_at: settings.dueAt })));
            if(error && error.code !== "23505") throw error;
        }
        /* الموعد يُصحَّح على الصفوف القديمة أيضاً — وإلا بقي موعد إرسالٍ
           سابق يحكم كشفَ الإجابات لفصلٍ أُعيد إليه الاختبار بموعد جديد */
        await updateAssignmentDue(settings.dueAt);

        const { error: pErr } = await sb.from("teacher_exams").update({
            published: true,
            timed: settings.timed,
            duration_min: settings.timed ? settings.duration : null,
            reveal_mode: settings.reveal,
        }).eq("id", examSendTarget);
        if(pErr) throw pErr;

        // البريد لا يُفشل الإرسال: الطلاب يرون الاختبار في الموقع على أي حال
        let queued = 0, mailFailed = false;
        for(const classId of examSendPicked.classes){
            try{
                const { data, error: nErr } = await sb.rpc("enqueue_exam_notifications", {
                    p_exam: examSendTarget, p_class: classId,
                });
                if(nErr) throw nErr;
                queued += (data || 0);
            }catch(e){ mailFailed = true; console.warn("[خُطى] تعذّر جدولة البريد لفصل:", e); }
        }

        closeExamSend();
        showToast(mailFailed
            ? (currentLang==='ar' ? 'أُرسل ✅ (تعذّرت جدولة بعض الرسائل)' : 'Sent ✅ (some emails not queued)')
            : (currentLang==='ar'
                ? `أُرسل ✅${queued ? ` وسيصل إشعار بريدي لـ${queued} طالباً` : ''}`
                : `Sent ✅${queued ? ` — ${queued} students emailed` : ''}`));
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر إرسال الاختبار:", e);
        const raw = (e && e.message) || "";
        showToast(/google|amr|policy|row-level/i.test(raw)
            ? (currentLang==='ar' ? 'الإرسال يتطلّب تأكيد هويتك بحساب Google.' : 'Sending requires Google confirmation.')
            : (currentLang==='ar' ? 'تعذّر الإرسال' : 'Could not send'));
    }finally{ schoolBusy(btn, false); }
}

/* ============================================================
   نتائج الطلاب — يراها المعلّم مرتّبة لكل اختبار
   طلب المالك: "يرى المعلّم كل نتائج الطلاب ومحاولاتهم السابقة".
   ============================================================ */

async function openSchoolExamResults(examId){
    if(!sb || !schoolCtx) return;
    const modal = document.getElementById("exam-results-modal");
    const body = document.getElementById("exam-results-body");
    const head = document.getElementById("exam-results-title");
    if(!modal || !body) return;
    modal.style.display = "flex";
    // العنوان يُقرأ من الذاكرة لا من السمة، ويُوضَع كنصّ لا كـHTML
    const title = (typeof teacherExamTitles !== "undefined" && teacherExamTitles.get(examId)) || "";
    if(head) head.textContent = title || (currentLang==='ar' ? 'النتائج' : 'Results');
    body.innerHTML = `<p class="card-sub">${currentLang==='ar' ? 'جارٍ التحميل…' : 'Loading…'}</p>`;

    try{
        const { data, error } = await sb.from("exam_attempts")
            .select("id, student_id, score, total, started_at, finished_at, school_members!exam_attempts_student_id_fkey(full_name, grade, section)")
            .eq("exam_id", examId)
            .order("finished_at", { ascending:false, nullsFirst:false })
            .limit(500);
        if(error) throw error;

        if(!data || !data.length){
            body.innerHTML = `<p class="card-sub">${currentLang==='ar' ? 'لم يؤدِّ أحد هذا الاختبار بعد.' : 'Nobody has taken this exam yet.'}</p>`;
            return;
        }

        // نجمع محاولات كل طالب معاً — المالك طلب "محاولاتهم السابقة" لا آخر محاولة
        const byStudent = new Map();
        data.forEach(a => {
            const key = a.student_id;
            if(!byStudent.has(key)) byStudent.set(key, { info:a.school_members || {}, attempts:[] });
            byStudent.get(key).attempts.push(a);
        });

        const rows = [...byStudent.values()].map(s => {
            const done = s.attempts.filter(a => a.finished_at);
            const best = done.reduce((m, a) => {
                const p = pct(a);
                return (p != null && (m == null || p > m)) ? p : m;
            }, null);
            return { s, best, doneCount:done.length };
        }).sort((a, b) => (b.best ?? -1) - (a.best ?? -1));

        body.innerHTML = `
            <div class="res-summary">
                ${currentLang==='ar'
                    ? `${rows.length} طالباً · ${data.length} محاولة`
                    : `${rows.length} students · ${data.length} attempts`}
            </div>
            ${rows.map(r => `
                <div class="res-row">
                    <div class="res-who">
                        <b>${escapeHtml(r.s.info.full_name || (currentLang==='ar'?'طالب':'Student'))}</b>
                        <small>${gradeText(r.s.info.grade)}${r.s.info.section ? " · " + escapeHtml(r.s.info.section) : ""}</small>
                    </div>
                    <div class="res-score ${scoreClass(r.best)}">
                        ${r.best == null ? (currentLang==='ar' ? 'لم يُنهِ' : 'Unfinished') : r.best + "%"}
                    </div>
                    <div class="res-attempts">
                        ${r.s.attempts.map(a => attemptChip(a)).join("")}
                    </div>
                </div>`).join("")}`;
    }catch(e){
        console.error("[خُطى] تعذّر تحميل النتائج:", e);
        body.innerHTML = `<p class="card-sub">${currentLang==='ar' ? 'تعذّر تحميل النتائج.' : 'Could not load results.'}</p>`;
    }
}

function pct(a){
    if(!a.finished_at || !a.total) return null;
    return Math.round((Number(a.score) / Number(a.total)) * 100);
}

function scoreClass(p){
    if(p == null) return "res-none";
    return p >= 80 ? "res-good" : p >= 50 ? "res-mid" : "res-low";
}

function attemptChip(a){
    const p = pct(a);
    const when = a.finished_at || a.started_at;
    const date = when ? new Date(when).toLocaleDateString(currentLang==='ar' ? "ar-SA" : "en-GB",
        { day:"numeric", month:"short" }) : "";
    return `<span class="res-chip ${scoreClass(p)}" title="${escapeHtml(date)}">
        ${p == null ? "—" : p + "%"}<small>${escapeHtml(date)}</small></span>`;
}

function closeSchoolExamResults(){
    const modal = document.getElementById("exam-results-modal");
    if(modal) modal.style.display = "none";
}
