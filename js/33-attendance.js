/* ============================================================
   33) الغياب — عرضٌ لملفّ نور لا تحضيرٌ في المنصّة
   ------------------------------------------------------------
   رفض المالك التحضير في المنصّة: «هو فقط منصّة مساعِدة للمدرسة والطالب».
   ثم وافق على العرض: «الاستيراد والغياب — الفكرة التي اقترحتها أنت
   ممتازة ووافقتك فيها بشدّة، عن طريق الهوية ولكن بطريقة مشفّرة».

   وهو محقّ في الرفض الأول: التحضير هنا يعني معلّماً يُدخل الغياب مرّتين
   كل حصّة، ثم يختلف الرقمان فلا يُصدَّق أيّهما. ونور هو السجلّ الرسمي.

   ⚠️ وتنسيق ملفّ نور يختلف بين المدارس والإصدارات، فلا نفترض ترتيب
   أعمدة. المدير يشير إلى العمود بنفسه — وهي طريقة الاستيراد الجماعي
   نفسها التي جرّبها ووافق عليها، ولا تنكسر حين يتغيّر الملف.

   ⚠️ وقراءة الملف هنا فقط لعرضه على المدير. والبصمة تُحسب في الخادم،
   ولا يغادر رقم الهوية المتصفّح إلا إلى الدالّة التي تحوّله وترميه.
   ============================================================ */

let attRows = [];        // صفوف الملف الخام
let attHeaders = [];
let attMap = {};         // { national_id: 2, absent: 5, ... }
let attFileName = "";

function attLabel(ar, en){ return currentLang === "ar" ? ar : en; }

const ATT_FIELDS = [
    { key:"national_id", ar:"رقم الهوية", en:"National ID", required:true },
    { key:"absent",      ar:"أيام الغياب", en:"Absent days", required:true },
    { key:"late",        ar:"أيام التأخّر", en:"Late days", required:false },
    { key:"excused",     ar:"غياب بعذر",   en:"Excused days", required:false },
];

const ATT_HINTS = {
    national_id: ["هوية","الهوية","رقم الهوية","السجل","السجل المدني","id","identity","national"],
    absent:      ["غياب","الغياب","غائب","أيام الغياب","ايام الغياب","absent","absence"],
    late:        ["تأخر","التأخر","تاخر","متأخر","late","tardy"],
    excused:     ["عذر","بعذر","مبرر","مأذون","excused","authorised","authorized"],
};

function attGuessColumns(headers){
    const map = {};
    const used = new Set();
    ATT_FIELDS.forEach(f => {
        const hints = ATT_HINTS[f.key] || [];
        for(let i = 0; i < headers.length; i++){
            if(used.has(i)) continue;
            const h = String(headers[i] || "").toLowerCase();
            if(!h) continue;
            if(hints.some(x => h.includes(x))){ map[f.key] = i; used.add(i); break; }
        }
    });
    return map;
}

/* ⚠️ يُعاد استعمال قارئ ملفّ الاستيراد نفسه (js/25-import.js) بدل كتابة
   قارئ ثانٍ: قارئان يتباعدان مع الوقت، فيقبل أحدهما ملفاً يرفضه الآخر
   ولا يفهم المدير لماذا. */
async function onAttendanceFilePicked(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    attFileName = file.name || "";
    const status = document.getElementById("att-status");
    const setStatus = (t, bad) => {
        if(!status) return;
        status.textContent = t;
        status.style.color = bad ? "var(--rose)" : "";
    };

    setStatus(attLabel("جارٍ قراءة الملف…","Reading…"));
    try{
        if(typeof readImportFile !== "function") throw new Error("NO_READER");
        const rows = await readImportFile(file);
        if(!rows || rows.length < 2) throw new Error("EMPTY");

        attHeaders = rows[0].map(h => String(h == null ? "" : h).trim());
        attRows = rows.slice(1).filter(r => r.some(c => String(c == null ? "" : c).trim() !== ""));
        attMap = attGuessColumns(attHeaders);

        setStatus(attLabel(
            `${attFileName} — ${attRows.length} صفاً`,
            `${attFileName} — ${attRows.length} rows`));
        renderAttendanceMapper();
    }catch(e){
        console.error("[خُطى] تعذّرت قراءة ملف الغياب:", e);
        setStatus(attLabel("تعذّرت قراءة الملف. تأكّد أنه Excel أو CSV وفيه صف عناوين.",
                           "Could not read the file."), true);
        cancelAttendance();
    }
}

function setAttColumn(key, value){
    if(value === "") delete attMap[key]; else attMap[key] = Number(value);
    renderAttendanceMapper();
}

function attCell(row, key){
    const i = attMap[key];
    if(i === undefined) return "";
    return String(row[i] == null ? "" : row[i]).trim();
}

/** يخفي أرقام الهوية في المعاينة — تُعرض على شاشة في مكتب مفتوح. */
function attMaskId(v){
    const digits = String(v || "").replace(/\D/g, "");
    if(digits.length < 4) return "—";
    return "•••• " + digits.slice(-4);
}

function renderAttendanceMapper(){
    const box = document.getElementById("att-mapper");
    if(!box) return;
    if(!attRows.length){ box.innerHTML = ""; return; }

    const missing = ATT_FIELDS.filter(f => f.required && attMap[f.key] === undefined);
    const preview = attRows.slice(0, 5);

    box.innerHTML = `
    <div class="form-group" style="margin-top:14px;">
        <label>${attLabel("تاريخ الكشف","Report date")}</label>
        <input type="date" id="att-as-of" value="${new Date().toISOString().slice(0,10)}">
        <p class="hint">${attLabel(
            "التاريخ الذي يمثّله الملف. ورفعُ ملفٍ بالتاريخ نفسه يصحّح السابق ولا يُضاعفه.",
            "Re-uploading for the same date corrects the previous one.")}</p>
    </div>

    <div class="imp-map">
        ${ATT_FIELDS.map(f => `
        <div class="form-group">
            <label>${currentLang === "ar" ? f.ar : f.en}${f.required ? " *" : ""}</label>
            <select onchange="setAttColumn('${f.key}', this.value)">
                <option value="">${attLabel("— لا يوجد —","— none —")}</option>
                ${attHeaders.map((h, i) => `
                    <option value="${i}" ${attMap[f.key] === i ? "selected" : ""}>${escapeHtml(h || `#${i + 1}`)}</option>`).join("")}
            </select>
        </div>`).join("")}
    </div>

    ${missing.length ? `<p class="hint" style="color:var(--rose);">${attLabel(
        "حدّد عمود: ","Pick a column for: ")}${missing.map(f => currentLang === "ar" ? f.ar : f.en).join("، ")}</p>` : `
    <div class="imp-preview">
        <table class="report-table">
            <thead><tr>
                <th>${attLabel("الهوية","ID")}</th>
                <th class="cr-num">${attLabel("غياب","Absent")}</th>
                <th class="cr-num">${attLabel("تأخّر","Late")}</th>
                <th class="cr-num">${attLabel("بعذر","Excused")}</th>
            </tr></thead>
            <tbody>${preview.map(r => `
                <tr>
                    <td>${escapeHtml(attMaskId(attCell(r, "national_id")))}</td>
                    <td class="cr-num">${escapeHtml(attCell(r, "absent") || "0")}</td>
                    <td class="cr-num">${escapeHtml(attCell(r, "late") || "0")}</td>
                    <td class="cr-num">${escapeHtml(attCell(r, "excused") || "0")}</td>
                </tr>`).join("")}</tbody>
        </table>
        <p class="hint">${attLabel(
            `معاينة أول ${preview.length} من ${attRows.length}. أرقام الهوية مخفيّة هنا، ولا تُحفظ في الموقع إطلاقاً.`,
            `Preview of ${preview.length} of ${attRows.length}. IDs are masked and never stored.`)}</p>
    </div>`}

    <div style="display:flex; gap:10px; margin-top:12px; flex-wrap:wrap;">
        <button type="button" id="att-submit" class="btn acc-btn" style="flex:1; min-width:150px;"
                onclick="submitAttendance()" ${missing.length ? "disabled" : ""}>
            <i class="fa-solid fa-upload"></i> ${attLabel("رفع الغياب","Upload")}</button>
        <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:120px;"
                onclick="cancelAttendance()">${attLabel("إلغاء","Cancel")}</button>
    </div>`;
}

function cancelAttendance(){
    attRows = []; attHeaders = []; attMap = {}; attFileName = "";
    const box = document.getElementById("att-mapper");
    if(box) box.innerHTML = "";
    const f = document.getElementById("att-file");
    if(f) f.value = "";
}

async function submitAttendance(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin" || !attRows.length) return;
    const btn = document.getElementById("att-submit");
    if(typeof schoolBusy === "function") schoolBusy(btn, true);

    try{
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        if(!token) throw new Error("NO_SESSION");

        const asOf = (document.getElementById("att-as-of") || {}).value || null;
        const rows = attRows.map(r => ({
            national_id: attCell(r, "national_id"),
            absent:      attCell(r, "absent"),
            late:        attCell(r, "late"),
            excused:     attCell(r, "excused"),
        }));

        const res = await fetch("/.netlify/functions/school-attendance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: token, asOf, rows }),
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw Object.assign(new Error(data.error || "FAILED"), { code: data.error });

        renderAttendanceResult(data);
    }catch(e){
        console.error("[خُطى] تعذّر رفع الغياب:", e);
        showToast(attendanceError(e));
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
    }
}

function attendanceError(e){
    const code = (e && e.code) || (e && e.message) || "";
    if(/NEEDS_GOOGLE/.test(code))
        return attLabel("رفع الغياب يتطلّب تأكيد هويتك بحساب Google.", "Requires Google sign-in.");
    if(/NOT_ADMIN/.test(code))     return attLabel("هذا الإجراء لإدارة المدرسة.", "Admins only.");
    if(/TOO_MANY_ROWS/.test(code)) return attLabel("الملف كبير جداً — ٢٠٠٠ صف كحدٍّ أقصى.", "Too many rows.");
    if(/NO_ROWS/.test(code))       return attLabel("الملف فارغ.", "Empty file.");
    if(/NO_SESSION/.test(code))    return attLabel("سجّل الدخول أولاً.", "Sign in first.");
    return attLabel("تعذّر رفع الغياب.", "Upload failed.");
}

/* ⚠️ الصفوف التي لم تُطابق ليست تفصيلاً يُبتلع: طالبٌ في ملفّ نور ولم
   يُستورد إلى المنصّة بعد. ومن لا يرى الرقم يظنّ الغياب مكتملاً وهو
   ناقص، ثم يُبنى عليه تقريرٌ ناقص لا يعرف أحد نقصانه. */
function renderAttendanceResult(out){
    const box = document.getElementById("att-mapper");
    if(!box) return;
    const saved = Number(out.saved) || 0;
    const unmatched = Number(out.unmatched) || 0;
    const badId = Number(out.badId) || 0;

    box.innerHTML = `
    <div class="imp-result" style="margin-top:14px;">
        <div class="leave-facts">
            <div><b>${saved}</b><span>${attLabel("طالباً حُدِّث غيابه","students updated")}</span></div>
            ${unmatched ? `<div><b>${unmatched}</b><span>${attLabel("لم يُطابق أي طالب","unmatched")}</span></div>` : ""}
            ${badId ? `<div><b>${badId}</b><span>${attLabel("صفاً بلا رقم هوية صالح","invalid ID")}</span></div>` : ""}
        </div>
        ${(unmatched || badId) ? `<p class="leave-note">${attLabel(
            "الصفوف التي لم تُطابق تعني طلاباً في ملفّ نور لم يُستوردوا إلى المنصّة بعد — استوردهم أولاً ثم أعد رفع الملف.",
            "Unmatched rows are students who aren't imported into the platform yet.")}</p>` : ""}
        <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:12px;"
                onclick="cancelAttendance()">${attLabel("تمّ","Done")}</button>
    </div>`;
    const f = document.getElementById("att-file");
    if(f) f.value = "";
    attRows = []; attHeaders = []; attMap = {};
}
