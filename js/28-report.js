/* ============================================================
   28) تقرير الفصل — الورقة التي يحملها المدير معه
   ------------------------------------------------------------
   طلب المالك: تقرير مطبوع للمدير. والمقصود ورقة، لا شاشة: مدير المدرسة
   يدخل اجتماعاً بورقة في يده، لا بجوّالٍ يمرّره على الحاضرين.

   ⚠️ وقبل هذا كان في الموقع عطلٌ يجعل التقرير مستحيلاً أصلاً، وقد قِستُه
   لا خمّنته: سياسات exam_attempts تعرف المعلّم صاحب الاختبار والطالب
   نفسه — ولا تعرف المدير إطلاقاً. فكان يفتح "النتائج" على اختبار أدّاه
   طلابه فيقرأ "لم يؤدِّ أحد هذا الاختبار بعد". كذبةٌ مطمئنة، وهي في عرضٍ
   أمام مدير مدرسة أسوأ من زرٍّ مفقود. أُضيفت سياسة attempts_admin_read.

   ⚠️ والأرقام تُحسب في قاعدة البيانات لا هنا: التقرير وثيقة تُوقَّع
   ضمناً باسم المنصة، ومن حسبها في المتصفّح احتمل أن يطبع المدير رقماً لا
   وجود له في البيانات. الدالّة school_class_report تُرجع أرقاماً جاهزة.

   ⚠️ والأسماء حقيقية لا ألقاباً — عن قصد. الألقاب وُضعت لما يقرؤه
   الغرباء على الإنترنت، وهذه ورقة داخلية بين المعلّم والإدارة. ولهذا
   أيضاً لا تحمل بريداً ولا رقم هوية: ما يُطبَع يُنسى على طاولة يوماً.
   ============================================================ */

let classReport = null;

function crLabel(ar, en){ return currentLang === "ar" ? ar : en; }

function ensureReportOverlay(){
    let ov = document.getElementById("class-report-overlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.id = "class-report-overlay";
    ov.className = "report-overlay";
    ov.style.display = "none";
    document.body.appendChild(ov);
    return ov;
}

async function openClassReport(classId){
    if(!sb || !schoolCtx) return;
    const ov = ensureReportOverlay();
    ov.innerHTML = `<div class="report-loading">${crLabel("جارٍ تجهيز التقرير…","Preparing…")}</div>`;
    ov.style.display = "block";
    document.body.style.overflow = "hidden";

    try{
        const { data, error } = await sb.rpc("school_class_report", { p_class: classId });
        if(error) throw error;
        classReport = data;
        renderClassReport();
    }catch(e){
        console.error("[خُطى] تعذّر تجهيز التقرير:", e);
        ov.innerHTML = `<div class="report-loading">${escapeHtml(classReportError(e))}
            <button type="button" class="btn btn-outline btn-sm acc-btn" style="margin-top:16px;"
                    onclick="closeClassReport()">${crLabel("إغلاق","Close")}</button></div>`;
    }
}

function classReportError(e){
    const raw = [e && e.message, e && e.hint, e && e.details].filter(Boolean).join(" | ");
    if(/NOT_ALLOWED/i.test(raw))
        return crLabel("هذا التقرير لإدارة المدرسة ولمعلّم الفصل وحدهما.",
                       "This report is for the school admin and the class teacher only.");
    if(/CLASS_NOT_FOUND/i.test(raw))
        return crLabel("لم نجد هذا الفصل — ربما حُذف.","Class not found — it may have been deleted.");
    return (typeof schoolError === "function")
        ? schoolError(e, crLabel("تجهيز التقرير","preparing the report"))
        : crLabel("تعذّر تجهيز التقرير.","Could not prepare the report.");
}

function closeClassReport(){
    const ov = document.getElementById("class-report-overlay");
    if(ov){ ov.style.display = "none"; ov.innerHTML = ""; }
    document.body.style.overflow = "";
    classReport = null;
}

/* ⚠️ نقيس بالتسليم لا بالمتوسّط وحده: صفٌّ متوسّطه ٩٠٪ وقد سلّم ثلثه فقط
   ليس صفّاً ممتازاً — بل صفٌّ لم نعرف عن ثلثيه شيئاً. والمتوسّط وحده
   يُخفي هذا تماماً، وهو أوّل ما يسأل عنه مدير المدرسة. */
function crRate(sum){
    const exp = Number(sum && sum.expected) || 0;
    if(!exp) return null;
    return Math.round((Number(sum.submitted) || 0) * 100 / exp);
}

/* ⚠️ التقويم ميلادي صراحةً. و"ar-SA" وحدها تُعطي هجرياً افتراضاً —
   رأيتُها في أول ورقة طبعتُها: "٢٧ ربيع الأول ١٤٤٨". والمعلّم أدخل موعد
   التسليم بالميلادي من حقل التاريخ، والسنة الدراسية ميلادية، فعرضُ
   الهجري يجعل الورقة تناقض ما أُدخِل — ولا يستطيع أحد مقارنة تاريخين. */
const CAL_AR = "ar-SA-u-ca-gregory-nu-latn";

function crDate(iso, withTime){
    if(!iso) return "—";
    try{
        return new Date(iso).toLocaleString(currentLang === "ar" ? CAL_AR : "en-GB",
            withTime ? { dateStyle:"long", timeStyle:"short" } : { dateStyle:"medium" });
    }catch(e){ return "—"; }
}

/** لون النسبة — ويبقى مقروءاً بعد الطباعة بالأبيض والأسود، فالنصّ معه. */
function crBand(p){
    if(p == null) return { cls:"cr-none", text: crLabel("لم يسلّم","none") };
    if(p >= 80)   return { cls:"cr-good", text: p + "%" };
    if(p >= 50)   return { cls:"cr-mid",  text: p + "%" };
    return          { cls:"cr-low",  text: p + "%" };
}

/** خانة الغياب — ولا تُخلط «صفر غياب» بـ«لا كشف لهذا الطالب». */
function crAbsentCell(att){
    if(!att) return `<span class="cr-none">—</span>`;
    const n = Number(att.absent) || 0;
    const late = Number(att.late) || 0;
    const cls = n >= 10 ? "cr-low" : n >= 5 ? "cr-mid" : "";
    return `<span class="${cls}">${n}</span>` +
        (late ? `<small style="color:var(--text-3);"> +${late}${crLabel("ت","L")}</small>` : "");
}

function renderClassReport(){
    const ov = ensureReportOverlay();
    const r = classReport || {};
    const cls = r.class || {};
    const sum = r.summary || {};
    const students = Array.isArray(r.students) ? r.students : [];
    const exams = Array.isArray(r.exams) ? r.exams : [];
    const teachers = Array.isArray(r.teachers) ? r.teachers : [];
    const rate = crRate(sum);
    const gradeName = (typeof gradeText === "function") ? gradeText(cls.grade) : (cls.grade || "");
    /* ⚠️ عمود الغياب يظهر فقط إن رُفع كشف نور. وعمودٌ فارغ في ورقةٍ
       مطبوعة يُقرأ «صفر غياب» لا «لا بيانات» — وهو خطأ يُبنى عليه قرار. */
    const anyAttendance = students.some(s => s.attendance);

    ov.innerHTML = `
    <div class="report-toolbar no-print">
        <button type="button" class="btn acc-btn" onclick="printClassReport()">
            <i class="fa-solid fa-print"></i> ${crLabel("طباعة أو حفظ PDF","Print or save PDF")}</button>
        <button type="button" class="btn btn-outline acc-btn" onclick="closeClassReport()">
            <i class="fa-solid fa-xmark"></i> ${crLabel("إغلاق","Close")}</button>
    </div>

    <div class="report-page" id="class-report-page">
        <header class="report-head">
            <div>
                <h1>${escapeHtml(r.school || "")}</h1>
                <p class="report-sub">${crLabel("تقرير أداء الفصل","Class performance report")}</p>
            </div>
            <div class="report-meta">
                <b>${escapeHtml(cls.name || "")}</b>
                <span>${escapeHtml(gradeName)}${cls.section ? " · " + crLabel("شعبة ","Section ") + escapeHtml(cls.section) : ""}</span>
                <span>${crLabel("أُنشئ في","Generated")} ${crDate(r.generated_at, true)}</span>
            </div>
        </header>

        ${teachers.length ? `<p class="report-teachers">${crLabel("معلّمو الفصل","Class teachers")}:
            ${teachers.map(t => escapeHtml(t)).join("، ")}</p>` : ""}

        <div class="report-tiles">
            <div class="report-tile"><b>${Number(sum.students) || 0}</b><span>${crLabel("طالب","students")}</span></div>
            <div class="report-tile"><b>${Number(sum.exams) || 0}</b><span>${crLabel("اختبار","exams")}</span></div>
            <div class="report-tile"><b>${rate == null ? "—" : rate + "%"}</b><span>${crLabel("نسبة التسليم","submitted")}</span></div>
            <div class="report-tile"><b>${sum.avg_pct == null ? "—" : sum.avg_pct + "%"}</b><span>${crLabel("متوسّط الصف","class average")}</span></div>
        </div>
        ${rate != null && rate < 100 ? `<p class="report-note">${crLabel(
            `لم تصل ${Number(sum.expected) - Number(sum.submitted)} محاولة من أصل ${sum.expected} — والمتوسّط أعلاه محسوب على ما سُلِّم وحده.`,
            `${Number(sum.expected) - Number(sum.submitted)} of ${sum.expected} attempts are missing — the average above covers only what was submitted.`)}</p>` : ""}

        <h2 class="report-h2">${crLabel("الطلاب","Students")}</h2>
        ${students.length ? `
        <table class="report-table">
            <thead><tr>
                <th class="cr-num">#</th>
                <th>${crLabel("الاسم","Name")}</th>
                <th class="cr-num">${crLabel("مطلوب","Assigned")}</th>
                <th class="cr-num">${crLabel("سُلّم","Done")}</th>
                <th class="cr-num">${crLabel("المتوسّط","Average")}</th>
                ${anyAttendance ? `<th class="cr-num">${crLabel("غياب","Absent")}</th>` : ""}
                <th>${crLabel("آخر نشاط","Last activity")}</th>
            </tr></thead>
            <tbody>${students.map((s, i) => {
                const band = crBand(s.avg_pct == null ? null : Number(s.avg_pct));
                const behind = Number(s.done) < Number(s.assigned);
                return `<tr class="${behind ? "cr-behind" : ""}">
                    <td class="cr-num">${i + 1}</td>
                    <td>${escapeHtml(s.name || "")}</td>
                    <td class="cr-num">${Number(s.assigned) || 0}</td>
                    <td class="cr-num">${Number(s.done) || 0}</td>
                    <td class="cr-num ${band.cls}">${band.text}</td>
                    ${anyAttendance ? `<td class="cr-num">${crAbsentCell(s.attendance)}</td>` : ""}
                    <td>${crDate(s.last_at)}</td>
                </tr>`;
            }).join("")}</tbody>
        </table>` : `<p class="report-empty">${crLabel(
            "لا طلاب في هذا الفصل بعد. أضِفهم من إدارة المدرسة أو استوردهم دفعةً واحدة.",
            "No students in this class yet.")}</p>`}

        <h2 class="report-h2">${crLabel("الاختبارات","Exams")}</h2>
        ${exams.length ? `
        <table class="report-table">
            <thead><tr>
                <th>${crLabel("الاختبار","Exam")}</th>
                <th>${crLabel("المادة","Subject")}</th>
                <th>${crLabel("المعلّم","Teacher")}</th>
                <th class="cr-num">${crLabel("سلّموا","Submitted")}</th>
                <th class="cr-num">${crLabel("المتوسّط","Average")}</th>
            </tr></thead>
            <tbody>${exams.map(x => {
                const band = crBand(x.avg_pct == null ? null : Number(x.avg_pct));
                return `<tr>
                    <td>${escapeHtml(x.title || "")}</td>
                    <td>${escapeHtml(x.subject || "—")}</td>
                    <td>${escapeHtml(x.teacher || "—")}</td>
                    <td class="cr-num">${Number(x.done) || 0} / ${Number(x.of) || 0}</td>
                    <td class="cr-num ${band.cls}">${band.text}</td>
                </tr>`;
            }).join("")}</tbody>
        </table>` : `<p class="report-empty">${crLabel(
            "لم يصل هذا الفصل أي اختبار بعد.",
            "No exams have reached this class yet.")}</p>`}

        <footer class="report-foot">
            <span>${crLabel("منصّة خُطى","Khuta")} · ${escapeHtml(r.school || "")}</span>
            <span>${crDate(r.generated_at, true)}</span>
        </footer>
    </div>`;
}

/* ⚠️ نضع صنفاً على <html> قبل الطباعة ونرفعه بعدها.
   والسبب أن قواعد @media print تُخفي كل ما في الصفحة سوى التقرير، ولو
   بقي الصنف بعد الإغلاق طُبعت أي صفحة أخرى فارغةً — وهو عطلٌ لا يظهر
   إلا لمن يطبع، أي للمدير وحده. */
function printClassReport(){
    document.documentElement.classList.add("printing-report");
    const clear = () => document.documentElement.classList.remove("printing-report");
    window.addEventListener("afterprint", clear, { once:true });
    /* بعض المتصفّحات لا تُطلق afterprint إطلاقاً — فمهلةٌ احتياطية */
    setTimeout(clear, 60000);
    window.print();
}
