/* ============================================================
   36) السجلّ — الدرجات الرسمية من نور، وسجلّ المادة، وملف الطالب
   ------------------------------------------------------------
   قرارات المالك (المرحلة ١):
   • المعلّم يرى طلابه في مادته: واجباتهم واختباراتهم على المنصّة،
     ودرجاتهم الرسمية في مادته.
   • درجات الفترات والنهائي تُستورد من ملف تصدير نور (كالغياب) وتُعرض
     **كما هي** — لا نحسب درجة ولا متوسطاً ولا تقديراً. ولذلك لا ترى هنا
     «معدّلاً» في أي مكان: الأرقام أرقام نور، ونتائج المنصّة «٥ من ٦».
   • ملف الطالب تراه الإدارة كاملاً في أي وقت، ووليّ الأمر من رابطه،
     ويُسجَّل من اطّلع على ملف كل طالب (student_file في القاعدة).

   ⚠️ كل القراءة عبر دوال في القاعدة (sql/PHASE1_HOMEWORK_GRADES.sql §٦–٨):
   جدول الدرجات مغلق أمام القراءة المباشرة لأي أحد، كي لا يتجاوز أحدٌ
   سجلّ الاطّلاع بقراءة الجدول بنفسه.
   ============================================================ */

function recL(ar, en){ return currentLang === "ar" ? ar : en; }

const TERM_LABELS = {
    t1:    ["الفصل الدراسي الأول", "Term 1"],
    t2:    ["الفصل الدراسي الثاني", "Term 2"],
    t3:    ["الفصل الدراسي الثالث", "Term 3"],
    final: ["نهاية العام", "End of year"],
};
function termName(t){ const x = TERM_LABELS[t]; return x ? recL(x[0], x[1]) : String(t || ""); }

/** السنة الهجرية الحالية — افتراضٌ يعدّله المدير إن شاء. */
function currentHijriYear(){
    try{
        return new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year:"numeric" })
            .format(new Date()).replace(/\D/g, "");
    }catch(e){ return ""; }
}

function recDate(iso, withTime){
    if(!iso) return "";
    try{
        return new Date(iso).toLocaleString(khutaLocale(),
            withTime ? { dateStyle:"medium", timeStyle:"short" } : { day:"numeric", month:"short" });
    }catch(e){ return ""; }
}

/** أعمدة نور كما هي: «العنوان: القيمة» — بلا أي تحويل. */
function officialItemsHtml(items){
    const list = Array.isArray(items) ? items : [];
    if(!list.length) return `<span class="card-sub">—</span>`;
    return `<div class="og-items">${list.map(it => `
        <span class="og-item"><small>${escapeHtml(it.label || "")}</small><b>${escapeHtml(it.value || "—")}</b></span>`).join("")}</div>`;
}

/** جدول الدرجات الرسمية مجمّعاً بالسنة والفصل. */
function officialGradesHtml(rows){
    const list = Array.isArray(rows) ? rows : [];
    if(!list.length) return `<p class="card-sub">${recL("لم تُرفع درجات رسمية بعد.", "No official grades uploaded yet.")}</p>`;
    const groups = new Map();
    list.forEach(r => {
        const k = `${r.year}|${r.term}`;
        if(!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
    });
    return [...groups.entries()].map(([k, rs]) => {
        const [year, term] = k.split("|");
        return `<div class="og-group">
            <div class="og-group-head">${escapeHtml(termName(term))} · ${escapeHtml(year)}</div>
            ${rs.map(r => `<div class="og-row">
                <b class="og-subject">${escapeHtml((currentLang === "ar" ? r.subject : (r.subject_en || r.subject))
                    || recL("كشف شامل", "All subjects"))}</b>
                ${officialItemsHtml(r.items)}
            </div>`).join("")}
        </div>`;
    }).join("");
}

/** نتيجة عمل على المنصّة كما هي: الدرجة من المجموع، أو حالته. */
function workResultHtml(w, assigned){
    if(w && w.total !== null && w.total !== undefined && w.score !== null && w.score !== undefined){
        return `<span class="rec-score">${escapeHtml(String(Number(w.score)))} / ${escapeHtml(String(w.total))}</span>${
            w.late ? ` <span class="se-late-note">${recL("متأخر", "late")}</span>` : ""}`;
    }
    if(assigned === false) return "";
    const due = w && w.due_at ? new Date(w.due_at).getTime() : null;
    const close = due !== null ? due + (Number(w.late_days) || 0) * 864e5 : null;
    if(close !== null && close < Date.now())
        return `<span style="color:var(--rose); font-weight:700;">${recL("لم يسلّم", "missing")}</span>`;
    return `<span class="card-sub">${recL("لم يُسلَّم بعد", "pending")}</span>`;
}

function kindIcon(kind){
    return kind === "homework" ? "fa-book-open-reader" : "fa-clipboard-question";
}

/* ============================================================
   الإدارة: رفع الدرجات الرسمية من ملف نور
   ============================================================ */
let ogRows = [], ogHeaders = [], ogIdCol = null, ogPicked = new Set(), ogFileName = "";
let ogBatches = [];

const OG_ID_HINTS = ["هوية", "الهوية", "السجل المدني", "السجل", "national", "identity", "id"];
/* أعمدة لا تُعدّ درجات: الاسم والترقيم والفصل — تُستبعد افتراضياً ويستطيع
   المدير إعادتها */
/* ⚠️ «الفصل» مطابقةً تامة لا احتواءً: «الفصل الدراسي الأول» عمود درجات */
const OG_SKIP_EXACT = ["م", "#", "ت", "تسلسل", "الرقم التسلسلي", "الفصل", "الصف", "الشعبة", "الجنسية", "المرحلة"];
const OG_SKIP_CONTAINS = ["اسم", "name"];

function ogGuess(headers){
    let id = null;
    headers.forEach((h, i) => {
        const x = String(h || "").toLowerCase();
        if(id === null && OG_ID_HINTS.some(k => x.includes(k))) id = i;
    });
    const picked = new Set();
    headers.forEach((h, i) => {
        if(i === id) return;
        const x = String(h || "").trim().toLowerCase();
        if(!x) return;
        if(OG_SKIP_EXACT.includes(x) || OG_SKIP_CONTAINS.some(k => x.includes(k))) return;
        picked.add(i);
    });
    return { id, picked };
}

async function onOfficialFilePicked(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    ogFileName = file.name || "";
    const status = document.getElementById("og-status");
    const setStatus = (t, bad) => { if(status){ status.textContent = t; status.style.color = bad ? "var(--rose)" : ""; } };
    setStatus(recL("جارٍ قراءة الملف…", "Reading…"));
    try{
        if(typeof readImportFile !== "function") throw new Error("NO_READER");
        const rows = await readImportFile(file);
        if(!rows || rows.length < 2) throw new Error("EMPTY");
        ogHeaders = rows[0].map(h => String(h == null ? "" : h).trim());
        ogRows = rows.slice(1).filter(r => r.some(c => String(c == null ? "" : c).trim() !== ""));
        const g = ogGuess(ogHeaders);
        ogIdCol = g.id; ogPicked = g.picked;
        setStatus(recL(`${ogFileName} — ${ogRows.length} صفاً`, `${ogFileName} — ${ogRows.length} rows`));
        renderOfficialMapper();
    }catch(e){
        console.error("[خُطى] تعذّرت قراءة ملف الدرجات:", e);
        setStatus(recL("تعذّرت قراءة الملف. تأكّد أنه Excel أو CSV وفيه صف عناوين.", "Could not read the file."), true);
        cancelOfficialGrades();
    }
}

function setOfficialIdCol(v){ ogIdCol = v === "" ? null : Number(v); ogPicked.delete(ogIdCol); renderOfficialMapper(); }
function toggleOfficialCol(i, on){ if(on) ogPicked.add(i); else ogPicked.delete(i); renderOfficialMapper(); }

function ogCell(row, i){ return String(row[i] == null ? "" : row[i]).trim(); }

function renderOfficialMapper(){
    const box = document.getElementById("og-mapper");
    if(!box) return;
    if(!ogRows.length){ box.innerHTML = ""; return; }
    /* نحفظ ما اختاره المدير قبل إعادة الرسم */
    const keep = id => (document.getElementById(id) || {}).value;
    const prevTerm = keep("og-term"), prevYear = keep("og-year"), prevSubject = keep("og-subject");

    const cols = [...ogPicked].sort((a, b) => a - b);
    const missing = ogIdCol === null ? recL("حدّد عمود رقم الهوية", "Pick the ID column")
                  : (!cols.length ? recL("اختر عموداً واحداً على الأقل من أعمدة الدرجات", "Pick at least one grade column") : "");
    const preview = ogRows.slice(0, 5);
    const subjects = (typeof schoolSubjectsList === "function") ? schoolSubjectsList(false) : [];

    box.innerHTML = `
    <div class="input-row" style="margin-top:14px;">
        <div class="form-group"><label>${recL("الفترة", "Term")}</label>
            <select id="og-term">${Object.keys(TERM_LABELS).map(t => `<option value="${t}">${escapeHtml(termName(t))}</option>`).join("")}</select></div>
        <div class="form-group"><label>${recL("العام الدراسي (هجري)", "School year")}</label>
            <input type="text" id="og-year" maxlength="20" value="${escapeHtml(currentHijriYear())}"></div>
    </div>
    <div class="form-group"><label>${recL("المادة", "Subject")}</label>
        <select id="og-subject">
            <option value="">${recL("كشف شامل — كل عمود مادة", "Multi-subject sheet — one column per subject")}</option>
            ${subjects.map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(subjectName(s))}</option>`).join("")}
        </select>
        <p class="hint">${recL("كشف مادة واحدة (أعمدته: مشاركة، واجبات، نهائي…) يظهر لمعلّم المادة. والكشف الشامل يظهر للإدارة والطالب ووليّ أمره.",
            "A single-subject sheet is shown to that subject's teacher; a multi-subject sheet to admin, student and parent.")}</p>
    </div>
    <div class="form-group"><label>${recL("عمود رقم الهوية", "ID column")} *</label>
        <select onchange="setOfficialIdCol(this.value)">
            <option value="">${recL("— اختر —", "— choose —")}</option>
            ${ogHeaders.map((h, i) => `<option value="${i}" ${ogIdCol === i ? "selected" : ""}>${escapeHtml(h || `#${i + 1}`)}</option>`).join("")}
        </select></div>
    <div class="form-group"><label>${recL("الأعمدة التي تُعرض (كما هي في نور)", "Columns to show (as in Noor)")}</label>
        <div class="og-cols">${ogHeaders.map((h, i) => i === ogIdCol ? "" : `
            <label class="og-col"><input type="checkbox" ${ogPicked.has(i) ? "checked" : ""}
                onchange="toggleOfficialCol(${i}, this.checked)"> ${escapeHtml(h || `#${i + 1}`)}</label>`).join("")}</div>
    </div>
    ${missing ? `<p class="hint" style="color:var(--rose);">${escapeHtml(missing)}</p>` : `
    <div class="imp-preview">
        <table class="report-table">
            <thead><tr><th>${recL("الهوية", "ID")}</th>${cols.map(i => `<th>${escapeHtml(ogHeaders[i] || `#${i + 1}`)}</th>`).join("")}</tr></thead>
            <tbody>${preview.map(r => `<tr><td>${escapeHtml(attMaskIdSafe(ogCell(r, ogIdCol)))}</td>${
                cols.map(i => `<td>${escapeHtml(ogCell(r, i))}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
        <p class="hint">${recL(`معاينة أول ${preview.length} من ${ogRows.length}. تُحفظ القيم كما تراها تماماً، وأرقام الهوية لا تُحفظ إطلاقاً.`,
            `Preview of ${preview.length} of ${ogRows.length}. Values are stored exactly as shown; IDs are never stored.`)}</p>
    </div>`}
    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
        <button type="button" id="og-submit" class="btn acc-btn" style="flex:1; min-width:150px;"
                onclick="submitOfficialGrades()" ${missing ? "disabled" : ""}>
            <i class="fa-solid fa-upload"></i> ${recL("رفع الدرجات", "Upload grades")}</button>
        <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:120px;"
                onclick="cancelOfficialGrades()">${recL("إلغاء", "Cancel")}</button>
    </div>`;
    const setv = (id, v) => { const el = document.getElementById(id); if(el && v !== undefined) el.value = v; };
    setv("og-term", prevTerm || undefined);
    setv("og-year", prevYear);
    setv("og-subject", prevSubject);
}

/* نفس إخفاء الهوية في معاينة الغياب — ومحلّي هنا كي لا نعتمد على ترتيب تحميل الملفات */
function attMaskIdSafe(v){
    const digits = String(v || "").replace(/\D/g, "");
    return digits.length < 4 ? "—" : "•••• " + digits.slice(-4);
}

function cancelOfficialGrades(){
    ogRows = []; ogHeaders = []; ogIdCol = null; ogPicked = new Set(); ogFileName = "";
    const box = document.getElementById("og-mapper"); if(box) box.innerHTML = "";
    const f = document.getElementById("og-file"); if(f) f.value = "";
}

async function submitOfficialGrades(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin" || !ogRows.length || ogIdCol === null) return;
    const btn = document.getElementById("og-submit");
    schoolBusy(btn, true);
    try{
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        if(!token) throw new Error("NO_SESSION");
        const cols = [...ogPicked].sort((a, b) => a - b);
        const year = ((document.getElementById("og-year") || {}).value || "").trim();
        if(!year) throw Object.assign(new Error("BAD_YEAR"), { code:"BAD_YEAR" });
        const body = {
            accessToken: token,
            term: (document.getElementById("og-term") || {}).value,
            year,
            subjectId: (document.getElementById("og-subject") || {}).value || null,
            source: ogFileName,
            rows: ogRows.map(r => ({
                national_id: ogCell(r, ogIdCol),
                items: cols.map(i => ({ label: ogHeaders[i] || `#${i + 1}`, value: ogCell(r, i) })),
            })),
        };
        const res = await fetch("/.netlify/functions/school-grades", {
            method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw Object.assign(new Error(data.error || "FAILED"), { code: data.error });
        renderOfficialResult(data);
        loadOfficialBatches();
    }catch(e){
        console.error("[خُطى] تعذّر رفع الدرجات:", e);
        showToast(officialError(e));
    }finally{ schoolBusy(btn, false); }
}

function officialError(e){
    const code = (e && e.code) || (e && e.message) || "";
    if(/NEEDS_GOOGLE/.test(code))  return recL("رفع الدرجات يتطلّب تأكيد هويتك بحساب Google.", "Requires Google sign-in.");
    if(/NOT_ADMIN/.test(code))     return recL("هذا الإجراء لإدارة المدرسة.", "Admins only.");
    if(/TOO_MANY_ROWS/.test(code)) return recL("الملف كبير جداً — ٢٠٠٠ صف كحدٍّ أقصى.", "Too many rows.");
    if(/BAD_YEAR/.test(code))      return recL("اكتب العام الدراسي.", "Enter the school year.");
    if(/BAD_SUBJECT/.test(code))   return recL("المادة غير موجودة في مدرستك.", "Unknown subject.");
    if(/NO_ROWS/.test(code))       return recL("الملف فارغ.", "Empty file.");
    if(/NO_SESSION/.test(code))    return recL("سجّل الدخول أولاً.", "Sign in first.");
    return recL("تعذّر رفع الدرجات.", "Upload failed.");
}

function renderOfficialResult(out){
    const box = document.getElementById("og-mapper");
    if(!box) return;
    const saved = Number(out.saved) || 0, unmatched = Number(out.unmatched) || 0, badId = Number(out.badId) || 0;
    box.innerHTML = `
    <div class="imp-result" style="margin-top:14px;">
        <div class="leave-facts">
            <div><b>${saved}</b><span>${recL("طالباً حُفظت درجاته", "students saved")}</span></div>
            ${unmatched ? `<div><b>${unmatched}</b><span>${recL("لم يُطابق أي طالب", "unmatched")}</span></div>` : ""}
            ${badId ? `<div><b>${badId}</b><span>${recL("صفاً بلا رقم هوية صالح", "invalid ID")}</span></div>` : ""}
        </div>
        ${(unmatched || badId) ? `<p class="leave-note">${recL(
            "الصفوف التي لم تُطابق تعني طلاباً في ملفّ نور لم يُستوردوا إلى المنصّة بعد — استوردهم أولاً ثم أعد رفع الملف (الرفع المتكرر يصحّح ولا يكرّر).",
            "Unmatched rows are students not imported yet. Re-uploading corrects, never duplicates.")}</p>` : ""}
        <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:12px;"
                onclick="cancelOfficialGrades()">${recL("تمّ", "Done")}</button>
    </div>`;
    const f = document.getElementById("og-file"); if(f) f.value = "";
    ogRows = []; ogHeaders = []; ogIdCol = null; ogPicked = new Set();
}

async function loadOfficialBatches(){
    const box = document.getElementById("og-batches");
    if(!box || !sb || !schoolCtx || schoolCtx.role !== "admin") return;
    try{
        const { data, error } = await sb.rpc("official_grade_batches", { p_school: schoolCtx.schoolId });
        if(error) throw error;
        ogBatches = data || [];
        box.innerHTML = ogBatches.length ? `
            <div class="exq-toolbar" style="margin-top:16px;"><b>${recL("ما رُفع", "Uploaded")}</b></div>
            ${ogBatches.map((b, i) => `<div class="member-row">
                <div><b>${escapeHtml(b.subject_name || recL("كشف شامل", "All subjects"))}</b>
                    <span class="card-sub"> · ${escapeHtml(termName(b.term))} ${escapeHtml(b.year_label)} · ${b.students} ${recL("طالباً", "students")} · ${escapeHtml(recDate(b.uploaded_at))}</span></div>
                <button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose);" onclick="deleteOfficialBatch(${i})">
                    <i class="fa-solid fa-trash"></i></button>
            </div>`).join("")}` : "";
    }catch(e){ console.warn("[خُطى] تعذّر جلب دفعات الدرجات:", e); }
}

async function deleteOfficialBatch(i){
    const b = ogBatches[i];
    if(!b || !sb || !schoolCtx) return;
    if(!confirm(recL(`حذف درجات «${b.subject_name || "الكشف الشامل"}» — ${termName(b.term)} ${b.year_label} لـ${b.students} طالباً؟`,
                     "Delete this upload?"))) return;
    try{
        const { error } = await sb.rpc("delete_official_grades", {
            p_school: schoolCtx.schoolId, p_year: b.year_label, p_term: b.term, p_subject: b.subject_id });
        if(error) throw error;
        loadOfficialBatches();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الدفعة:", e);
        showSchoolError(e, recL("الحذف", "the delete"));
    }
}

/* ============================================================
   تبويب «السجلّ»
   المعلّم: سجلّ المادة لفصلٍ من فصوله. الإدارة: أي فصل وأي مادة.
   الطالب: سجلّه هو (أعماله ودرجاته الرسمية).
   ============================================================ */
let recTeaching = null;

async function renderRecordTab(){
    if(!schoolCtx || !sb) return;
    const controls = document.getElementById("rec-controls");
    const book = document.getElementById("rec-book");
    if(!controls || !book) return;

    if(schoolCtx.role === "student"){ controls.innerHTML = ""; return renderMyRecord(book); }

    if(schoolCtx.role === "admin"){
        if(typeof loadSchoolClasses === "function" && (typeof schoolClasses === "undefined" || !schoolClasses.length)){
            try{ await loadSchoolClasses(); }catch(e){}
        }
        const classes = (typeof schoolClasses !== "undefined" ? schoolClasses : []) || [];
        const prevC = (document.getElementById("rec-class") || {}).value, prevS = (document.getElementById("rec-subject") || {}).value;
        controls.innerHTML = `<div class="input-row">
            <div class="form-group"><label>${recL("الفصل", "Class")}</label>
                <select id="rec-class" onchange="loadRecordBook()">${classes.map(c =>
                    `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name || "")}</option>`).join("")}</select></div>
            <div class="form-group"><label>${recL("المادة", "Subject")}</label>
                <select id="rec-subject" onchange="loadRecordBook()">${schoolSubjectsList(false).map(s =>
                    `<option value="${escapeHtml(s.id)}">${escapeHtml(subjectName(s))}</option>`).join("")}</select></div>
        </div>`;
        if(prevC) document.getElementById("rec-class").value = prevC;
        if(prevS) document.getElementById("rec-subject").value = prevS;
        if(!classes.length){ book.innerHTML = `<p class="card-sub">${recL("لا فصول بعد.", "No classes yet.")}</p>`; return; }
        return loadRecordBook();
    }

    // المعلّم: أزواج (فصل، مادة) من إسناد الإدارة
    if(recTeaching === null){
        try{
            const { data, error } = await sb.rpc("my_teaching", { p_school: schoolCtx.schoolId });
            if(error) throw error;
            recTeaching = data || [];
        }catch(e){ recTeaching = []; console.warn("[خُطى] تعذّر جلب فصولي:", e); }
    }
    if(!recTeaching.length){
        controls.innerHTML = "";
        book.innerHTML = `<p class="card-sub">${recL("لم تُسنِد لك الإدارة فصلاً ومادة بعد — يظهر سجلّ طلابك هنا بعد الإسناد.",
            "The school hasn't assigned you a class and subject yet.")}</p>`;
        return;
    }
    const prev = (document.getElementById("rec-pick") || {}).value;
    controls.innerHTML = `<div class="form-group"><label>${recL("الفصل والمادة", "Class & subject")}</label>
        <select id="rec-pick" onchange="loadRecordBook()">${recTeaching.map(r =>
            `<option value="${escapeHtml(r.class_id)}|${escapeHtml(r.subject_id || "")}">${escapeHtml(r.class_name || "")} — ${
                escapeHtml(r.subject_name || recL("بلا مادة", "no subject"))}</option>`).join("")}</select></div>`;
    if(prev) document.getElementById("rec-pick").value = prev;
    return loadRecordBook();
}

let recBook = null;

async function loadRecordBook(){
    const book = document.getElementById("rec-book");
    if(!book || !sb) return;
    let classId, subjectId;
    const pick = document.getElementById("rec-pick");
    if(pick){ [classId, subjectId] = pick.value.split("|"); }
    else{ classId = (document.getElementById("rec-class") || {}).value; subjectId = (document.getElementById("rec-subject") || {}).value; }
    if(!classId) return;
    book.innerHTML = `<p class="card-sub">${recL("جارٍ التحميل…", "Loading…")}</p>`;
    try{
        const { data, error } = await sb.rpc("teacher_class_book", { p_class: classId, p_subject: subjectId || null });
        if(error) throw error;
        recBook = data;
        book.innerHTML = renderClassBook(data);
    }catch(e){
        console.error("[خُطى] تعذّر تحميل السجلّ:", e);
        book.innerHTML = `<p class="card-sub">${escapeHtml(recordError(e))}</p>`;
    }
}

function recordError(e){
    const raw = [e && e.message, e && e.details].filter(Boolean).join(" ");
    if(/NOT_ALLOWED/.test(raw)) return recL("لا تملك الاطّلاع على هذا — يرى المعلّم طلاب فصوله في مادته فقط.", "Not allowed.");
    if(/STUDENT_NOT_FOUND|CLASS_NOT_FOUND/.test(raw)) return recL("لم نجده — ربما حُذف.", "Not found.");
    return (typeof schoolError === "function") ? schoolError(e, recL("التحميل", "loading")) : recL("تعذّر التحميل.", "Could not load.");
}

function renderClassBook(d){
    const students = (d && d.students) || [];
    const works = (d && d.works) || [];
    if(!students.length) return `<p class="card-sub">${recL("لا طلاب في هذا الفصل بعد.", "No students in this class.")}</p>`;
    const cells = new Map(((d && d.cells) || []).map(c => [`${c.w}|${c.st}`, c]));
    const official = new Map();
    ((d && d.official) || []).forEach(o => { if(!official.has(o.st)) official.set(o.st, []); official.get(o.st).push(o); });
    const workById = new Map(works.map(w => [w.id, w]));

    const head = works.map(w => {
        const done = students.filter(s => { const c = cells.get(`${w.id}|${s.id}`); return c && c.total !== null && c.total !== undefined; }).length;
        const assigned = students.filter(s => { const c = cells.get(`${w.id}|${s.id}`); return c && c.assigned; }).length;
        return `<th class="rec-work"><i class="fa-solid ${kindIcon(w.kind)}"></i> ${escapeHtml(w.title || "")}
            <small>${w.due_at ? escapeHtml(recDate(w.due_at)) + " · " : ""}${recL(`سلّم ${done} من ${assigned}`, `${done}/${assigned} in`)}</small></th>`;
    }).join("");

    const body = students.map(s => `<tr>
        <th class="rec-student"><button type="button" class="linklike" onclick="openStudentFile('${escapeHtml(s.id)}')">${escapeHtml(s.name || "")}</button></th>
        ${works.map(w => {
            const c = cells.get(`${w.id}|${s.id}`);
            return `<td>${workResultHtml(c ? Object.assign({ due_at: workById.get(w.id).due_at }, c) : null, c ? c.assigned : false)}</td>`;
        }).join("")}
        <td>${(official.get(s.id) || []).map(o => `<div class="og-mini"><small>${escapeHtml(termName(o.term))} ${escapeHtml(o.year)}</small>${officialItemsHtml(o.items)}</div>`).join("") || "—"}</td>
    </tr>`).join("");

    return `<p class="hint" style="margin-bottom:8px;">${recL(
        "النتائج كما هي (الدرجة من المجموع)، والدرجات الرسمية كما رُفعت من نور — بلا معدّلات. اضغط اسم الطالب لملفه.",
        "Results as-is; official grades exactly as uploaded from Noor. Tap a name for the student's file.")}</p>
    <div class="rec-scroll"><table class="report-table rec-table">
        <thead><tr><th class="rec-student">${recL("الطالب", "Student")}</th>${head}<th>${recL("الدرجات الرسمية (نور)", "Official (Noor)")}</th></tr></thead>
        <tbody>${body}</tbody>
    </table></div>
    ${works.length ? "" : `<p class="card-sub" style="margin-top:8px;">${recL("لم تُرسَل واجبات أو اختبارات في هذه المادة لهذا الفصل بعد.", "No work sent to this class in this subject yet.")}</p>`}`;
}

/* سجلّ الطالب لنفسه */
async function renderMyRecord(book){
    book.innerHTML = `<p class="card-sub">${recL("جارٍ التحميل…", "Loading…")}</p>`;
    try{
        const [work, exams, official] = await Promise.all([
            sb.rpc("my_assigned_work", { p_school: schoolCtx.schoolId }),
            sb.from("teacher_exams").select("id, title, subject, kind").limit(200),
            sb.rpc("my_official_grades", { p_school: schoolCtx.schoolId }),
        ]);
        if(work.error) throw work.error;
        const titles = new Map(((exams && exams.data) || []).map(x => [x.id, x]));
        const rows = (work.data || []).map(w => Object.assign({}, titles.get(w.exam_id) || {}, w))
            .sort((a, b) => new Date(b.due_at || 0) - new Date(a.due_at || 0));
        book.innerHTML = `
            <h3 style="margin:4px 0 10px;">${recL("درجاتي الرسمية (من نور)", "My official grades (Noor)")}</h3>
            ${officialGradesHtml(official && official.data)}
            <h3 style="margin:18px 0 10px;">${recL("واجباتي واختباراتي", "My homework & exams")}</h3>
            ${worksListHtml(rows)}`;
    }catch(e){
        console.error("[خُطى] تعذّر تحميل سجلّي:", e);
        book.innerHTML = `<p class="card-sub">${escapeHtml(recordError(e))}</p>`;
    }
}

function worksListHtml(rows){
    if(!rows.length) return `<p class="card-sub">${recL("لا شيء بعد.", "Nothing yet.")}</p>`;
    return `<div class="rec-scroll"><table class="report-table">
        <thead><tr><th>${recL("العمل", "Work")}</th><th>${recL("المادة", "Subject")}</th><th>${recL("الموعد", "Due")}</th><th>${recL("النتيجة", "Result")}</th></tr></thead>
        <tbody>${rows.map(w => `<tr>
            <td><i class="fa-solid ${kindIcon(w.kind)}"></i> ${escapeHtml(w.title || "")}</td>
            <td>${escapeHtml(w.subject || "")}</td>
            <td>${escapeHtml(recDate(w.due_at))}</td>
            <td>${workResultHtml(w, true)}</td>
        </tr>`).join("")}</tbody>
    </table></div>`;
}

/* ============================================================
   ملف الطالب — للإدارة (كاملاً) وللمعلّم (موادّه). فتحه يُسجَّل.
   ============================================================ */
function ensureStudentFileModal(){
    let m = document.getElementById("student-file-modal");
    if(m) return m;
    m = document.createElement("div");
    m.id = "student-file-modal";
    m.className = "overlay-screen";
    m.style.display = "none";
    m.innerHTML = `<div class="wizard-card" style="max-width:720px; width:100%;">
        <div id="student-file-body"></div>
        <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:14px;"
                onclick="closeStudentFile()">${recL("إغلاق", "Close")}</button>
    </div>`;
    document.body.appendChild(m);
    return m;
}

async function openStudentFile(studentId){
    if(!sb || !studentId) return;
    const m = ensureStudentFileModal();
    const body = document.getElementById("student-file-body");
    m.style.display = "flex";
    body.innerHTML = `<p class="card-sub">${recL("جارٍ فتح الملف…", "Opening…")}</p>`;
    try{
        const { data, error } = await sb.rpc("student_file", { p_student: studentId });
        if(error) throw error;
        body.innerHTML = renderStudentFile(data);
    }catch(e){
        console.error("[خُطى] تعذّر فتح ملف الطالب:", e);
        body.innerHTML = `<p class="card-sub">${escapeHtml(recordError(e))}</p>`;
    }
}

function closeStudentFile(){
    const m = document.getElementById("student-file-modal");
    if(m) m.style.display = "none";
}

function renderStudentFile(d){
    const s = (d && d.student) || {};
    const att = d && d.attendance;
    const isAdmin = d && d.viewer_role === "admin";
    const roleName = r => r === "admin" ? recL("الإدارة", "Admin") : r === "teacher" ? recL("معلّم", "Teacher")
                        : r === "counselor" ? recL("مرشد", "Counselor") : String(r || "");
    return `
        <h3 style="margin-bottom:2px;"><i class="fa-solid fa-id-card"></i> ${escapeHtml(s.name || "")}</h3>
        <p class="card-sub">${escapeHtml(gradeName(s.grade))}${s.section ? " / " + escapeHtml(s.section) : ""}${s.class ? " · " + escapeHtml(s.class) : ""}</p>
        ${d && d.viewer_role === "counselor" ? `<p class="hint">${recL("اطّلاعك على الملف يُسجَّل لدى الإدارة.", "Your view is logged for the school.")}</p>` : ""}
        ${isAdmin || (d && d.viewer_role === "counselor") ? "" : `<p class="hint">${recL("تظهر لك موادّك فقط. واطّلاعك على الملف يُسجَّل لدى الإدارة.",
            "Only your subjects are shown. Your view is logged for the school.")}</p>`}

        ${att ? `<div class="leave-facts" style="margin:12px 0;">
            <div><b>${escapeHtml(String(att.absent))}</b><span>${recL("غياب", "absent")}</span></div>
            <div><b>${escapeHtml(String(att.late))}</b><span>${recL("تأخّر", "late")}</span></div>
            <div><b>${escapeHtml(String(att.excused))}</b><span>${recL("بعذر", "excused")}</span></div>
        </div><p class="hint">${recL("الغياب من نور حتى", "Attendance from Noor as of")} ${escapeHtml(recDate(att.as_of))}</p>` : ""}

        <h4 style="margin:16px 0 8px;">${recL("الدرجات الرسمية (نور)", "Official grades (Noor)")}</h4>
        ${officialGradesHtml(d && d.official)}

        <h4 style="margin:16px 0 8px;">${recL("الواجبات والاختبارات على المنصّة", "Homework & exams")}</h4>
        ${worksListHtml((d && d.works) || [])}

        ${isAdmin ? `<h4 style="margin:16px 0 8px;"><i class="fa-solid fa-eye"></i> ${recL("من اطّلع على هذا الملف", "Who viewed this file")}</h4>
        ${((d.access_log) || []).length ? `<div class="rec-log">${d.access_log.map(l => `<div class="member-row">
            <span><b>${escapeHtml(l.name || recL("عضو محذوف", "removed member"))}</b> <span class="pill">${escapeHtml(roleName(l.role))}</span></span>
            <span class="card-sub">${escapeHtml(recDate(l.at, true))}</span></div>`).join("")}</div>`
          : `<p class="card-sub">${recL("لا أحد بعد.", "Nobody yet.")}</p>`}` : ""}`;
}
