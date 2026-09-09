/* ============================================================
   25) الاستيراد الجماعي للطلاب من ملف المدرسة
   ------------------------------------------------------------
   لماذا هذا أهم ما في هذه الدفعة؟

   لأن إضافة الطلاب واحداً واحداً تعني ٦٠٠ طالب × ٤٠ ثانية = ست ساعات
   ونصف من الكتابة المتواصلة بلا خطأ واحد. وأول سؤال في أي عرض مدرسي هو
   "كيف ندخل طلابنا؟" — والصمت هنا يُنهي الاجتماع قبل أن يبدأ.

   ⚠️ ولا أعرف صيغة ملف نور بالضبط، ولن أدّعي معرفتها: أسماء الأعمدة
   تختلف بين الإصدارات والتقارير. فلا نخمّن — بل نعرض على المدير أول
   صفوف ملفه ونسأله: أيّ عمود هو الاسم؟ وأيّه الهوية؟ ويُحفظ اختياره
   فلا يُسأل مرة أخرى، ويستطيع تغييره متى أخطأ.

   ⚠️ ورقم الهوية لا يُحفظ في أي مكان: يخرج من هذا الملف إلى دالة الخادم
   التي تحوّله إلى بصمة وترمي الرقم. انظر netlify/functions/school-import.js.
   ============================================================ */

const IMPORT_MAP_KEY = "khuta_import_map";
const IMPORT_FIELDS = [
    { key: "name",        ar: "اسم الطالب",   en: "Student name", required: true },
    { key: "national_id", ar: "رقم الهوية",   en: "National ID",  required: true },
    { key: "grade",       ar: "المرحلة",      en: "Grade",        required: false },
    { key: "section",     ar: "الشعبة",       en: "Section",      required: false },
    { key: "email",       ar: "البريد",       en: "Email",        required: false },
];

let importRows = [];      // كل صفوف الملف (مصفوفات نصّية)
let importHeaders = [];   // أسماء الأعمدة كما جاءت
let importMap = {};       // { name: 2, national_id: 0, ... }

function impLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/* ---------- قراءة الملف ---------- */

/** يفصل سطر CSV مع احترام علامات الاقتباس (الأسماء العربية قد تحوي فواصل). */
function parseCsvLine(line, sep){
    const out = [];
    let cur = "", inQ = false;
    for(let i = 0; i < line.length; i++){
        const ch = line[i];
        if(ch === '"'){
            if(inQ && line[i + 1] === '"'){ cur += '"'; i++; }
            else inQ = !inQ;
        }else if(ch === sep && !inQ){
            out.push(cur); cur = "";
        }else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
}

function parseCsv(text){
    // ⚠️ علامة ترتيب البايتات التي يضعها Excel تلتصق باسم أول عمود فتفسده
    if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim());
    if(!lines.length) return [];
    // Excel العربي يحفظ بالفاصلة المنقوطة غالباً — نستنتج الفاصل من أول سطر
    const first = lines[0];
    const counts = { ",": (first.match(/,/g) || []).length,
                     ";": (first.match(/;/g) || []).length,
                     "\t": (first.match(/\t/g) || []).length };
    const sep = Object.keys(counts).reduce((a, b) => counts[a] >= counts[b] ? a : b);
    return lines.map(l => parseCsvLine(l, sep));
}

/** يحمّل قارئ Excel عند الحاجة فقط — لا يُثقل صفحة كل طالب بمكتبة لا يفتحها. */
function loadXlsxLib(){
    if(window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
        s.onload = () => window.XLSX ? resolve(window.XLSX) : reject(new Error("XLSX_NOT_LOADED"));
        s.onerror = () => reject(new Error("XLSX_LOAD_FAILED"));
        document.head.appendChild(s);
    });
}

async function readImportFile(file){
    const name = (file.name || "").toLowerCase();
    if(name.endsWith(".csv") || name.endsWith(".txt")){
        return parseCsv(await file.text());
    }
    const XLSX = await loadXlsxLib();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" })
        .map(r => r.map(c => String(c == null ? "" : c).trim()));
}

/* ---------- تخمين الأعمدة ---------- */

/* تخمينٌ أوّلي يوفّر على المدير العمل في الحالة الشائعة — ويبقى قابلاً
   للتصحيح دائماً، فالتخمين اقتراح لا قرار. */
const IMPORT_HINTS = {
    name:        ["اسم", "الاسم", "الطالب", "اسم الطالب", "name", "student"],
    national_id: ["هوية", "الهوية", "رقم الهوية", "السجل", "id", "identity", "national"],
    grade:       ["صف", "الصف", "مرحلة", "المرحلة", "grade", "level"],
    section:     ["شعبة", "الشعبة", "فصل", "الفصل", "section", "class"],
    email:       ["بريد", "البريد", "ايميل", "إيميل", "email", "mail"],
};

function guessColumns(headers){
    const map = {};
    const used = new Set();
    IMPORT_FIELDS.forEach(f => {
        const hints = IMPORT_HINTS[f.key] || [];
        for(let i = 0; i < headers.length; i++){
            if(used.has(i)) continue;
            const h = String(headers[i] || "").toLowerCase();
            if(!h) continue;
            if(hints.some(x => h.includes(x))){ map[f.key] = i; used.add(i); break; }
        }
    });
    return map;
}

/* ---------- الواجهة ---------- */

async function onImportFilePicked(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    const status = document.getElementById("imp-status");
    const setStatus = (t, bad) => {
        if(!status) return;
        status.textContent = t;
        status.style.color = bad ? "var(--rose)" : "var(--text-3)";
    };
    setStatus(impLabel("جارٍ قراءة الملف…", "Reading…"));

    try{
        const rows = await readImportFile(file);
        if(rows.length < 2){
            setStatus(impLabel("الملف لا يحوي صفوفاً كافية — يلزم سطر عناوين وسطر بيانات على الأقل.",
                               "Not enough rows — need a header row and at least one data row."), true);
            return;
        }
        importHeaders = rows[0];
        importRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));

        // خريطة محفوظة من مرة سابقة؟ نستعملها، وإلا خمّنّا
        let saved = null;
        try{ saved = JSON.parse(localStorage.getItem(IMPORT_MAP_KEY) || "null"); }catch(e){}
        const savedFits = saved && IMPORT_FIELDS.every(f =>
            saved[f.key] === undefined || saved[f.key] < importHeaders.length);
        importMap = savedFits ? saved : guessColumns(importHeaders);

        setStatus(impLabel(`قُرئ ${importRows.length} صفاً. راجِع ربط الأعمدة ثم اضغط "استيراد".`,
                           `${importRows.length} rows read. Check the column mapping, then import.`));
        renderImportMapper();
    }catch(e){
        console.error("[خُطى] تعذّر قراءة الملف:", e);
        setStatus(/XLSX/.test(String(e && e.message))
            ? impLabel("تعذّر تحميل قارئ ملفات Excel — تحقّق من الاتصال، أو احفظ الملف بصيغة CSV.",
                       "Couldn't load the Excel reader — check your connection or save the file as CSV.")
            : impLabel("تعذّرت قراءة الملف. تأكّد أنه CSV أو Excel.",
                       "Could not read the file. Make sure it's CSV or Excel."), true);
    }finally{
        ev.target.value = "";   // كي يقبل نفس الملف مرة أخرى بعد تصحيحه
    }
}

function renderImportMapper(){
    const box = document.getElementById("imp-mapper");
    if(!box) return;
    if(!importRows.length){ box.innerHTML = ""; return; }

    const options = (sel) => `<option value="">${impLabel("— لا شيء —", "— none —")}</option>` +
        importHeaders.map((h, i) =>
            `<option value="${i}"${String(sel) === String(i) ? " selected" : ""}>${
                escapeHtml(String(h || `${impLabel("عمود", "Column")} ${i + 1}`))}</option>`).join("");

    box.innerHTML = `
        <div class="imp-map-grid">
            ${IMPORT_FIELDS.map(f => `
                <div class="form-group">
                    <label>${impLabel(f.ar, f.en)}${f.required ? ' <span style="color:var(--rose);">*</span>' : ""}</label>
                    <select onchange="setImportColumn('${f.key}', this.value)">${options(importMap[f.key])}</select>
                </div>`).join("")}
        </div>
        <div id="imp-preview"></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-top:14px;">
            <button type="button" id="imp-submit" class="btn acc-btn" onclick="submitImport()">
                <i class="fa-solid fa-file-import"></i> ${impLabel("استيراد الطلاب", "Import students")}</button>
            <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="cancelImport()">
                ${impLabel("إلغاء", "Cancel")}</button>
        </div>
        <div id="imp-result" style="margin-top:14px;"></div>`;
    renderImportPreview();
}

function setImportColumn(key, value){
    if(value === "") delete importMap[key];
    else importMap[key] = parseInt(value, 10);
    try{ localStorage.setItem(IMPORT_MAP_KEY, JSON.stringify(importMap)); }catch(e){}
    renderImportPreview();
}

/** يعرض أول خمسة صفوف كما سيفهمها النظام — لا كما هي في الملف. */
function renderImportPreview(){
    const box = document.getElementById("imp-preview");
    if(!box) return;
    const missing = IMPORT_FIELDS.filter(f => f.required && importMap[f.key] === undefined);
    const btn = document.getElementById("imp-submit");
    if(btn){
        btn.disabled = missing.length > 0;
        btn.style.opacity = missing.length ? ".5" : "";
    }
    if(missing.length){
        box.innerHTML = `<p class="card-sub" style="color:var(--rose); margin-top:12px;">
            ${impLabel("اختر عمود", "Pick a column for")} ${missing.map(f => impLabel(f.ar, f.en)).join(impLabel(" و", " and "))}
            ${impLabel("قبل المتابعة.", "before continuing.")}</p>`;
        return;
    }

    const cell = (row, key) => {
        const i = importMap[key];
        return i === undefined ? "" : String(row[i] == null ? "" : row[i]).trim();
    };
    /* ⚠️ نعرض آخر أربعة أرقام من الهوية فقط — الشاشة أمام المدير، وقد
       تكون على سبورة أو مشاركة شاشة. لا داعي لعرض هوية أحد كاملة. */
    const maskId = (v) => {
        const d = String(v).replace(/[^0-9٠-٩۰-۹]/g, "");
        return d.length >= 4 ? "•••• " + d.slice(-4) : (d || "—");
    };

    box.innerHTML = `
        <p class="card-sub" style="margin-top:14px;">${impLabel(
            `معاينة أول ٥ صفوف كما سيفهمها النظام (من أصل ${importRows.length}):`,
            `Preview of the first 5 rows as the system reads them (of ${importRows.length}):`)}</p>
        <div style="overflow-x:auto;">
        <table class="imp-preview-table">
            <thead><tr>${IMPORT_FIELDS.map(f => `<th>${impLabel(f.ar, f.en)}</th>`).join("")}</tr></thead>
            <tbody>
                ${importRows.slice(0, 5).map(r => `<tr>
                    ${IMPORT_FIELDS.map(f => `<td>${escapeHtml(
                        f.key === "national_id" ? maskId(cell(r, f.key)) : (cell(r, f.key) || "—"))}</td>`).join("")}
                </tr>`).join("")}
            </tbody>
        </table></div>`;
}

function cancelImport(){
    importRows = []; importHeaders = []; importMap = {};
    const box = document.getElementById("imp-mapper");
    if(box) box.innerHTML = "";
    const st = document.getElementById("imp-status");
    if(st) st.textContent = "";
}

async function submitImport(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    if(!importRows.length) return;

    const btn = document.getElementById("imp-submit");
    const result = document.getElementById("imp-result");
    const cell = (row, key) => {
        const i = importMap[key];
        return i === undefined ? "" : String(row[i] == null ? "" : row[i]).trim();
    };
    const payload = importRows.map(r => ({
        name: cell(r, "name"),
        national_id: cell(r, "national_id"),
        grade: cell(r, "grade"),
        section: cell(r, "section"),
        email: cell(r, "email"),
    }));

    if(!confirm(impLabel(
        `سيُضاف أو يُحدَّث ${payload.length} طالباً. متابعة؟`,
        `${payload.length} students will be added or updated. Continue?`))) return;

    schoolBusy(btn, true);
    if(result) result.innerHTML = `<p class="card-sub">${impLabel("جارٍ الاستيراد…", "Importing…")}</p>`;
    try{
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        if(!token) throw new Error("NO_SESSION");

        const res = await fetch("/.netlify/functions/school-import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: token, rows: payload }),
        });
        const out = await res.json().catch(() => ({}));
        if(!res.ok) throw Object.assign(new Error(out.error || "IMPORT_FAILED"), { code: out.error });

        renderImportResult(out);
        if(typeof loadSchoolMembers === "function") loadSchoolMembers();
        if(typeof loadAdminClasses === "function") loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّر الاستيراد:", e);
        if(result) result.innerHTML = `<p class="card-sub" style="color:var(--rose);">${escapeHtml(importError(e))}</p>`;
    }finally{ schoolBusy(btn, false); }
}

function importError(e){
    const raw = (e && (e.code || e.message)) || "";
    if(/NEEDS_GOOGLE/.test(raw)) return impLabel(
        "الاستيراد الجماعي يتطلّب تأكيد هويتك بحساب Google — لأنه يضيف مئات الحسابات دفعة واحدة.",
        "Bulk import requires confirming with Google — it creates hundreds of accounts at once.");
    if(/NOT_ADMIN/.test(raw))      return impLabel("هذه العملية للإدارة فقط.", "Admins only.");
    if(/TOO_MANY_ROWS/.test(raw))  return impLabel("الملف أكبر من ٢٠٠٠ صف — قسّمه إلى ملفين.", "File exceeds 2000 rows — split it.");
    if(/NOT_CONFIGURED/.test(raw)) return impLabel("خدمة الاستيراد غير مهيّأة على الخادم — أبلغ مطوّر الموقع.", "Import service not configured.");
    if(/NO_SESSION/.test(raw))     return impLabel("انتهت جلستك — حدّث الصفحة وسجّل دخولك.", "Session expired — refresh and sign in.");
    return impLabel("تعذّر الاستيراد. التفاصيل في سجلّ المتصفح (F12).", "Import failed. Details in the browser console.");
}

function renderImportResult(out){
    const box = document.getElementById("imp-result");
    if(!box) return;
    const errs = Array.isArray(out.errors) ? out.errors : [];
    const reason = (r) => ({
        BAD_ID:   impLabel("رقم هوية غير صالح", "invalid national ID"),
        BAD_NAME: impLabel("اسم ناقص", "missing name"),
    })[r] || r;

    box.innerHTML = `
        <div class="imp-result-grid">
            <div class="imp-stat ok"><b>${out.added || 0}</b><small>${impLabel("أُضيف", "added")}</small></div>
            <div class="imp-stat"><b>${out.updated || 0}</b><small>${impLabel("حُدِّث", "updated")}</small></div>
            <div class="imp-stat ${out.skipped ? "warn" : ""}"><b>${out.skipped || 0}</b><small>${impLabel("تُخطّي", "skipped")}</small></div>
        </div>
        ${errs.length ? `
            <details style="margin-top:12px;">
                <summary class="card-sub" style="cursor:pointer;">${impLabel(
                    `عرض الصفوف المتخطّاة (${errs.length})`, `Show skipped rows (${errs.length})`)}</summary>
                <ul style="margin:10px 0 0; padding-inline-start:20px; font-size:13px; line-height:2;">
                    ${errs.slice(0, 60).map(e => `<li>${impLabel("الصف", "Row")} ${e.row}${
                        e.name ? ` — ${escapeHtml(e.name)}` : ""}: ${escapeHtml(reason(e.reason))}</li>`).join("")}
                </ul>
                ${errs.length > 60 ? `<p class="card-sub">${impLabel("…وغيرها", "…and more")}</p>` : ""}
            </details>` : ""}`;
    cancelImportKeepResult();
}

/** ينظّف حالة الملف ويُبقي التقرير معروضاً أمام المدير. */
function cancelImportKeepResult(){
    importRows = []; importHeaders = [];
    const mapper = document.getElementById("imp-mapper");
    if(!mapper) return;
    mapper.querySelectorAll(".imp-map-grid, #imp-preview, #imp-submit").forEach(el => el.remove());
    const st = document.getElementById("imp-status");
    if(st) st.textContent = impLabel("تمّ. اسحب ملفاً آخر لاستيراد دفعة جديدة.", "Done. Drop another file to import again.");
}
