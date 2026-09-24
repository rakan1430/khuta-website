/* ============================================================
   14) نسخة المدارس — ملفات المدرّس وروابطه والجدول والاختبارات
   ------------------------------------------------------------
   كل دالة هنا تتحقق من hasFeature("school") أولاً، فوجود الملف لا يؤثر على
   خُطى بأي شكل.

   ⚠️ الصلاحيات كلها في قاعدة البيانات (RLS). ما هنا واجهة فقط: إخفاء زر لا
   يمنع أحداً، لكن سياسة RLS تمنعه فعلاً. مُتحقَّق عملياً — المدرّس لا يكتب
   جدول فصل لا يدرّسه، والطالب لا يعدّل جدوله ولا يقرأ ملاحظات غيره.
   ============================================================ */

const MAX_TEACHER_LINKS = 9;   // مطابق للمُشغِّل في قاعدة البيانات
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const WEEKDAYS_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const WEEKDAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function weekdayName(i){ return (currentLang === "ar" ? WEEKDAYS_AR : WEEKDAYS_EN)[i] || ""; }

/* schoolBusy نُقلت إلى js/13-school.js: هذا الملف يُحمَّل عند الحاجة على
   الجوّال، وjs/20-entry.js (يُحمَّل دائماً) يستعملها. */

/* ============================================================
   ملفات المدرّس
   ============================================================ */
async function loadTeacherFiles(){
    const box = document.getElementById("tfiles-list");
    if(!box || !schoolCtx || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        // الطالب يرى ملفات مدرّسيه؛ المدرّس يرى ملفاته. الفلترة في RLS لا هنا،
        // فلا نضيف شرط المالك حتى يرى كلٌّ ما يحق له.
        const { data, error } = await sb
            .from("teacher_files")
            .select("id, title, subject, grade, storage_path, external_url, size_bytes, shared, owner_id, short_code, created_at")
            .eq("space", "general")   // ملفات مساحة القدرات في تبويبها (js/38)
            .order("created_at", { ascending:false })
            .limit(200);
        if(error) throw error;
        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا توجد ملفات بعد.':'No files yet.'}</p>`;
            return;
        }
        box.innerHTML = renderSchoolList(data, f => {
            const mine = f.owner_id === schoolCtx.memberId;
            const size = f.size_bytes ? ` · ${Math.max(1, Math.round(f.size_bytes/1024))} KB` : "";
            const meta = [f.subject, f.grade ? gradeLabel(f.grade) : null].filter(Boolean).map(escapeHtml).join(" · ");
            return `
            <div class="sfile-row">
                <div class="sfile-main">
                    <i class="fa-solid ${f.external_url ? "fa-link" : "fa-file-pdf"}"></i>
                    <div>
                        <b>${escapeHtml(f.title)}</b>
                        <div class="card-sub">${meta}${escapeHtml(size)}${f.shared ? "" : (currentLang==='ar'?' · خاص بي':' · private')}${mine ? "" : schoolSourceLine(f.owner_id)}</div>
                    </div>
                </div>
                <div class="sfile-actions">
                    <button type="button" class="btn btn-sm" onclick="openTeacherFile('${escapeHtml(f.id)}')">
                        <i class="fa-solid fa-up-right-from-square"></i> ${currentLang==='ar'?'فتح':'Open'}</button>
                    ${mine && f.short_code ? `<button type="button" class="btn btn-outline btn-sm" title="${currentLang==='ar'?'نسخ الرابط المميّز':'Copy share link'}"
                        onclick="copyFileLink('${escapeHtml(f.short_code)}')"><i class="fa-solid fa-link"></i></button>` : ""}
                    ${mine ? `<button type="button" class="btn btn-outline btn-sm" onclick="deleteTeacherFile('${escapeHtml(f.id)}')">
                        <i class="fa-solid fa-trash"></i></button>` : ""}
                </div>
            </div>`;
        });
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الملفات:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الملفات.':'Could not load files.'}</p>`;
    }
}

function gradeLabel(g){
    return (typeof gradeName === "function") ? gradeName(g) : String(g || "");
}

/* الملف في مخزن خاص، فلا يُفتح برابط ثابت. ننشئ رابطاً موقَّعاً قصير العمر
   عند الطلب — ولو سُرّب فسينتهي خلال دقائق ولا يفتح لغير من يملك الصلاحية. */
async function openTeacherFile(id){
    if(!sb || !schoolCtx) return;
    try{
        const { data, error } = await sb.from("teacher_files")
            .select("storage_path, external_url").eq("id", id).maybeSingle();
        if(error) throw error;
        if(!data){ showToast(currentLang==='ar'?'الملف غير متاح':'File unavailable'); return; }
        if(data.external_url){ window.open(data.external_url, "_blank", "noopener"); return; }
        const { data: signed, error: sErr } = await sb.storage
            .from("teacher-files").createSignedUrl(data.storage_path, 300);
        if(sErr) throw sErr;
        window.open(signed.signedUrl, "_blank", "noopener");
    }catch(e){
        console.error("[خُطى] تعذّر فتح الملف:", e);
        showSchoolError(e, currentLang==='ar'?'فتح الملف':'opening the file');
    }
}

async function uploadTeacherFile(){
    if(!sb || !schoolCtx) return;
    const titleEl = document.getElementById("tfile-title");
    const fileEl  = document.getElementById("tfile-input");
    const urlEl   = document.getElementById("tfile-url");
    const title = (titleEl.value || "").trim();
    const url   = (urlEl.value || "").trim();
    const file  = fileEl.files && fileEl.files[0];

    if(title.length < 2){ showToast(currentLang==='ar'?'اكتب عنواناً للملف':'Enter a title'); titleEl.focus(); return; }
    if(!file && !url){ showToast(currentLang==='ar'?'اختر ملفاً أو الصق رابطاً':'Pick a file or paste a link'); return; }
    if(url && !/^https?:\/\//i.test(url)){
        showToast(currentLang==='ar'?'الرابط يجب أن يبدأ بـ https://':'Link must start with https://'); return;
    }
    if(file && file.size > MAX_FILE_BYTES){
        showToast(currentLang==='ar' ? `الملف أكبر من ${Math.round(MAX_FILE_BYTES/1048576)} ميجا` : `File exceeds ${Math.round(MAX_FILE_BYTES/1048576)} MB`);
        return;
    }

    if(file && typeof schoolStorageAllows === "function" && !(await schoolStorageAllows(file.size))) return;

    const btn = document.getElementById("tfile-submit");
    schoolBusy(btn, true);
    let storagePath = null;
    try{
        let size = null;
        if(file){
            // اسم آمن: نُبقي الامتداد فقط ونولّد بقيته. اسم الملف الأصلي قد
            // يحوي مسارات (../) أو حروفاً تكسر المسار داخل المخزن.
            const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
            const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
            storagePath = `${schoolCtx.schoolId}/${schoolCtx.memberId}/${rand}.${ext}`;
            const { error: upErr } = await sb.storage.from("teacher-files")
                .upload(storagePath, file, { upsert:false, contentType: file.type || undefined });
            if(upErr) throw upErr;
            size = file.size;
        }
        const { error } = await sb.from("teacher_files").insert({
            school_id: schoolCtx.schoolId,
            owner_id: schoolCtx.memberId,
            title,
            subject: (document.getElementById("tfile-subject").value || "").trim() || null,
            grade: document.getElementById("tfile-grade").value || null,
            storage_path: storagePath,
            external_url: storagePath ? null : url,
            size_bytes: size,
            shared: document.getElementById("tfile-shared").checked,
        });
        if(error) throw error;
        titleEl.value = ""; urlEl.value = ""; fileEl.value = "";
        document.getElementById("tfile-subject").value = "";
        storagePath = null;   // صار له سجلّ — لم يعد يتيماً
        showToast(currentLang==='ar'?'تم الرفع ✅':'Uploaded ✅');
        loadTeacherFiles();
    }catch(e){
        console.error("[خُطى] تعذّر الرفع:", e);
        /* رُفع الملف ثم فشل حفظ سجلّه: يبقى في المخزن بلا سجلّ يشير إليه،
           يأكل من مساحة المدرسة ولا يراه أحد ولا يُحذف أبداً. نحذفه. */
        if(storagePath){
            try{ await sb.storage.from("teacher-files").remove([storagePath]); }catch(err){}
        }
        showSchoolError(e, currentLang==='ar'?'رفع الملف':'the upload');
    }finally{ schoolBusy(btn, false); }
}

async function deleteTeacherFile(id){
    if(!sb || !schoolCtx) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا الملف نهائياً؟" : "Delete this file permanently?")) return;
    try{
        const { data } = await sb.from("teacher_files").select("storage_path").eq("id", id).maybeSingle();
        const { error } = await sb.from("teacher_files").delete().eq("id", id);
        if(error) throw error;
        // نحذف من المخزن بعد نجاح حذف الصف. لو فشل هذا يبقى ملف يتيم لا يراه
        // أحد (سياسة القراءة تعتمد وجود الصف) — مقبول، والعكس أسوأ بكثير.
        if(data && data.storage_path){
            try{ await sb.storage.from("teacher-files").remove([data.storage_path]); }catch(e){}
        }
        showToast(currentLang==='ar'?'تم الحذف':'Deleted');
        loadTeacherFiles();
    }catch(e){
        console.error("[خُطى] تعذّر الحذف:", e);
        showSchoolError(e, currentLang==='ar'?'الحذف':'the delete');
    }
}

/* ============================================================
   الروابط المباشرة — 9 كحد أقصى لكل مدرّس
   ============================================================ */
async function loadTeacherLinks(){
    const box = document.getElementById("tlinks-list");
    if(!box || !schoolCtx || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb.from("teacher_links")
            .select("id, label, url, icon, sort_order, shared, owner_id")
            .eq("space", "general")   // روابط مساحة القدرات في تبويبها، ولها حدّها (js/38)
            .order("sort_order").limit(200);
        if(error) throw error;

        const mine = (data || []).filter(l => l.owner_id === schoolCtx.memberId).length;
        const counter = document.getElementById("tlinks-count");
        if(counter) counter.textContent = `${mine} / ${MAX_TEACHER_LINKS}`;
        const addBtn = document.getElementById("tlink-submit");
        if(addBtn && schoolCtx.role !== "student"){
            const full = mine >= MAX_TEACHER_LINKS;
            addBtn.disabled = full;
            addBtn.style.opacity = full ? ".5" : "";
            addBtn.title = full ? (currentLang==='ar'?'وصلت للحد الأقصى (9 روابط)':'Limit reached (9 links)') : "";
        }

        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا توجد روابط بعد.':'No links yet.'}</p>`;
            return;
        }
        box.innerHTML = renderSchoolList(data, l => `
            <div class="slink-row">
                <a class="slink-open" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid ${escapeHtml(l.icon || "fa-link")}"></i>
                    <span>${escapeHtml(l.label)}${l.owner_id === schoolCtx.memberId ? "" :
                        (schoolStaffName(l.owner_id) ? `<small class="card-sub" style="display:block;">${
                            currentLang==='ar'?'من':'from'} ${escapeHtml(schoolStaffName(l.owner_id))}</small>` : "")}</span>
                </a>
                ${l.owner_id === schoolCtx.memberId ? `
                <button type="button" class="btn btn-ghost btn-sm" onclick="deleteTeacherLink('${escapeHtml(l.id)}')" aria-label="${currentLang==='ar'?'حذف':'Delete'}">
                    <i class="fa-solid fa-trash"></i></button>` : ""}
            </div>`);
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الروابط:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الروابط.':'Could not load links.'}</p>`;
    }
}

async function addTeacherLink(){
    if(!sb || !schoolCtx) return;
    const labelEl = document.getElementById("tlink-label");
    const urlEl = document.getElementById("tlink-url");
    const label = (labelEl.value || "").trim();
    let url = (urlEl.value || "").trim();
    if(label.length < 2){ showToast(currentLang==='ar'?'اكتب اسماً للرابط':'Enter a name'); labelEl.focus(); return; }
    // تسهيل شائع: من يلصق "example.com" يقصد https — لكن ما عدا ذلك يُرفض
    if(url && !/^[a-z]+:/i.test(url)) url = "https://" + url;
    if(!/^https?:\/\/.+/i.test(url)){
        showToast(currentLang==='ar'?'الرابط يجب أن يبدأ بـ http:// أو https://':'Link must start with http:// or https://');
        urlEl.focus(); return;
    }

    const btn = document.getElementById("tlink-submit");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("teacher_links").insert({
            school_id: schoolCtx.schoolId,
            owner_id: schoolCtx.memberId,
            label, url,
            icon: (document.getElementById("tlink-icon").value || "").trim() || null,
            shared: document.getElementById("tlink-shared").checked,
        });
        if(error) throw error;
        labelEl.value = ""; urlEl.value = "";
        showToast(currentLang==='ar'?'أُضيف الرابط ✅':'Link added ✅');
        loadTeacherLinks();
    }catch(e){
        // المُشغِّل في القاعدة يرفع LINKS_LIMIT_REACHED — نترجمه لرسالة مفهومة
        const limit = e && (e.message || "").includes("LINKS_LIMIT_REACHED");
        console.error("[خُطى] تعذّرت إضافة الرابط:", e);
        showToast(limit
            ? (currentLang==='ar' ? `وصلت للحد الأقصى: ${MAX_TEACHER_LINKS} روابط. احذف رابطاً لإضافة آخر.` : `Limit reached: ${MAX_TEACHER_LINKS} links.`)
            : (currentLang==='ar' ? 'تعذّرت إضافة الرابط' : 'Could not add the link'));
    }finally{ schoolBusy(btn, false); }
}

async function deleteTeacherLink(id){
    if(!sb || !schoolCtx) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا الرابط؟" : "Delete this link?")) return;
    try{
        const { error } = await sb.from("teacher_links").delete().eq("id", id);
        if(error) throw error;
        loadTeacherLinks();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الرابط:", e);
        showSchoolError(e, currentLang==='ar'?'الحذف':'the delete');
    }
}

/* ============================================================
   الجدول الدراسي
   ------------------------------------------------------------
   الإدارة والمدرّس يبنيانه. الطالب يقرأه فقط — لكنه يضيف فوقه ملاحظاته
   الخاصة (تذكير، تمييز يوم، توضيح) وهي ملكه وحده لا يراها غيره.
   ============================================================ */
let schoolClasses = [];

async function loadSchoolClasses(){
    if(!sb || !schoolCtx) return [];
    try{
        const { data, error } = await sb.from("classes")
            .select("id, name, grade, section").order("grade").order("section").limit(200);
        if(error) throw error;
        schoolClasses = data || [];
    }catch(e){ console.warn("[خُطى] تعذّر تحميل الفصول:", e); schoolClasses = []; }

    /* ⚠️ حالة "لا فصول" كانت تُنتج قائمة فارغة تماماً بلا أي تفسير — يضغط
       المعلّم "إضافة حصة" فلا يحدث شيء ولا يفهم لماذا. وهذا ما وصفه المالك
       بأن اختيار الفصل "معطّل". الآن تقول القائمة سبب فراغها. */
    ["tt-class","exam-class"].forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        const prev = sel.value;
        sel.textContent = "";
        if(!schoolClasses.length){
            const o = document.createElement("option");
            o.value = "";
            o.textContent = currentLang==='ar'
                ? "— لا فصول بعد، تنشئها الإدارة —"
                : "— no classes yet, the admin creates them —";
            sel.appendChild(o);
            sel.disabled = true;
            return;
        }
        sel.disabled = false;
        schoolClasses.forEach(c => {
            const o = document.createElement("option");
            o.value = c.id;
            // الاسم وحده يلتبس حين تتشابه الأسماء بين المراحل
            o.textContent = c.section ? `${c.name} (${c.section})` : c.name;
            sel.appendChild(o);
        });
        if(prev) sel.value = prev;
    });
    return schoolClasses;
}

async function loadTimetable(){
    const box = document.getElementById("tt-grid");
    if(!box || !schoolCtx || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        if(!schoolClasses.length) await loadSchoolClasses();
        const sel = document.getElementById("tt-class");
        let classId = sel && sel.value;
        // الطالب لا يختار فصلاً — جدوله هو جدول صفّه
        if(schoolCtx.role === "student" && schoolClasses.length){
            const own = schoolClasses.find(c => c.grade === schoolCtx.grade &&
                (!c.section || !schoolCtx.section || c.section === schoolCtx.section));
            if(own) classId = own.id;
        }
        if(!classId){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا يوجد فصل محدَّد بعد.':'No class selected yet.'}</p>`;
            return;
        }

        const [{ data: rows, error }, notes] = await Promise.all([
            sb.from("timetable").select("id, weekday, period_no, subject, room, class_id")
              .eq("class_id", classId).order("weekday").order("period_no").limit(500),
            loadDayNotes(),
        ]);
        if(error) throw error;
        renderTimetable(rows || [], notes || []);
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الجدول:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الجدول.':'Could not load the timetable.'}</p>`;
    }
}

// أيام الدراسة في السعودية: الأحد إلى الخميس (0..4)
const SCHOOL_DAYS = [0,1,2,3,4];

function dateOfWeekday(wd){
    // تاريخ هذا اليوم في الأسبوع الحالي — نحتاجه لربط الملاحظات بيوم بعينه
    const now = new Date();
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay() + wd);
    return d.toISOString().slice(0,10);
}

/* شبكة الجدول: الحصص صفوف والأيام أعمدة — الشكل الذي يعرفه أي طالب أو
   معلّم في مدرسة سعودية، لا قائمة أيام متتابعة. أيام الدراسة الأحد إلى
   الخميس، والحصص مرقّمة من 1 إلى آخر حصة مستعملة فعلاً (لا نرسم حصصاً
   فارغة إلى 8 بلا داعٍ). */
function renderTimetable(rows, notes){
    const box = document.getElementById("tt-grid");
    if(!box) return;
    const canEdit = schoolCtx && schoolCtx.role !== "student";

    const byCell = {};
    let maxPeriod = 0;
    rows.forEach(r => {
        byCell[r.weekday + ":" + r.period_no] = r;
        if(r.period_no > maxPeriod) maxPeriod = r.period_no;
    });
    if(!maxPeriod) maxPeriod = 6;

    const notesByDate = {};
    notes.forEach(n => { (notesByDate[n.on_date] = notesByDate[n.on_date] || []).push(n); });

    const todayWd = new Date().getDay();

    // رأس الجدول: خانة الحصة ثم الأيام
    let head = `<div class="tt-cell tt-corner">${currentLang==='ar'?'الحصة':'Period'}</div>`;
    SCHOOL_DAYS.forEach(wd => {
        const iso = dateOfWeekday(wd);
        // ملاحظات اليوم كله وحدها هنا — ملاحظات الحصص تظهر على الحصص نفسها
        const dayNotes = (notesByDate[iso] || []).filter(n => n.period_no === null || n.period_no === undefined);
        const mark = dayNotes.find(n => n.kind === "highlight");
        head += `
        <div class="tt-cell tt-dayhead${mark ? " is-marked" : ""}${wd === todayWd ? " is-today" : ""}"
             ${mark && mark.color ? `style="background:${escapeHtml(mark.color)}; color:#fff;"` : ""}>
            <span class="tt-dayname">${escapeHtml(weekdayName(wd))}</span>
            <button type="button" class="tt-notebtn" onclick="openDayNote('${escapeHtml(iso)}')"
                    title="${currentLang==='ar'?'ملاحظاتي على هذا اليوم':'My notes'}">
                <i class="fa-solid fa-note-sticky"></i>${dayNotes.length ? `<b>${dayNotes.length}</b>` : ""}
            </button>
        </div>`;
    });

    let body = "";
    for(let p = 1; p <= maxPeriod; p++){
        body += `<div class="tt-cell tt-periodno">${p}</div>`;
        SCHOOL_DAYS.forEach(wd => {
            const cell = byCell[wd + ":" + p];
            if(!cell){
                body += `<div class="tt-cell tt-empty${wd === todayWd ? " is-today" : ""}"></div>`;
                return;
            }
            /* ⚠️ الملاحظة على الحصّة نفسها لا على اليوم كله.
               وصف المالك: «علامة التمييز والملاحظة لا يمكن وضعها على الحصص
               ذاتها بل فقط على الأيام، وهذا غير جيد». وهو محق — من يريد
               تذكير "تسليم الواجب" يريده على حصة الرياضيات لا على الأربعاء. */
            const iso = dateOfWeekday(wd);
            const slotNotes = (notesByDate[iso] || []).filter(n => Number(n.period_no) === p);
            const slotMark = slotNotes.find(n => n.kind === "highlight" && n.color);
            body += `
            <div class="tt-cell tt-slot${wd === todayWd ? " is-today" : ""}${slotMark ? " is-marked" : ""}"
                 ${slotMark ? `style="box-shadow: inset 4px 0 0 ${escapeHtml(slotMark.color)};"` : ""}>
                <span class="tt-subj">${escapeHtml(cell.subject)}</span>
                ${cell.room ? `<span class="tt-room">${escapeHtml(cell.room)}</span>` : ""}
                <button type="button" class="tt-notebtn tt-slot-note" onclick="openDayNote('${escapeHtml(iso)}', ${p})"
                        title="${currentLang==='ar'?'ملاحظة على هذه الحصة':'Note on this period'}">
                    <i class="fa-solid fa-note-sticky"></i>${slotNotes.length ? `<b>${slotNotes.length}</b>` : ""}
                </button>
                ${canEdit ? `<button type="button" class="tt-del" onclick="deletePeriod('${escapeHtml(cell.id)}')"
                        aria-label="${currentLang==='ar'?'حذف':'Delete'}"><i class="fa-solid fa-xmark"></i></button>` : ""}
            </div>`;
        });
    }

    // ملاحظات الأيام أسفل الشبكة: مكانها الطبيعي، وتُبقي الشبكة نظيفة
    const allNotes = notes.filter(n => n.kind !== "highlight");
    const notesHtml = allNotes.length ? `
        <div class="tt-notes">
            <div class="card-sub" style="margin-bottom:8px;">
                <i class="fa-solid fa-note-sticky"></i>
                ${currentLang==='ar'?'ملاحظاتي (لا يراها غيري)':'My notes (private to me)'}
            </div>
            ${allNotes.map(n => `
                <div class="tt-note">
                    <i class="fa-solid ${n.kind === "reminder" ? "fa-bell" : "fa-pen"}"></i>
                    <span>${escapeHtml(n.text || "")}</span>
                    <span class="card-sub">${escapeHtml(n.on_date)}${n.period_no
                        ? ` · ${currentLang==='ar' ? `الحصة ${n.period_no}` : `Period ${n.period_no}`}` : ""}</span>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="deleteDayNote('${escapeHtml(n.id)}')"
                            aria-label="${currentLang==='ar'?'حذف':'Delete'}"><i class="fa-solid fa-xmark"></i></button>
                </div>`).join("")}
        </div>` : "";

    box.innerHTML = `<div class="tt-table" style="--tt-cols:${SCHOOL_DAYS.length + 1};">${head}${body}</div>${notesHtml}`;
}

async function addPeriod(){
    if(!sb || !schoolCtx || schoolCtx.role === "student") return;
    const classId = document.getElementById("tt-class").value;
    const subject = (document.getElementById("tt-subject").value || "").trim();
    if(!classId){ showToast(currentLang==='ar'?'اختر الفصل':'Pick a class'); return; }
    if(subject.length < 2){ showToast(currentLang==='ar'?'اكتب اسم المادة':'Enter the subject'); return; }
    const btn = document.getElementById("tt-add");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("timetable").insert({
            school_id: schoolCtx.schoolId,
            class_id: classId,
            teacher_id: schoolCtx.role === "teacher" ? schoolCtx.memberId : null,
            weekday: parseInt(document.getElementById("tt-weekday").value, 10),
            period_no: parseInt(document.getElementById("tt-period").value, 10),
            subject,
            room: (document.getElementById("tt-room").value || "").trim() || null,
        });
        if(error) throw error;
        document.getElementById("tt-subject").value = "";
        document.getElementById("tt-room").value = "";
        loadTimetable();
    }catch(e){
        const dup = e && (e.code === "23505" || (e.message||"").includes("duplicate"));
        console.error("[خُطى] تعذّرت إضافة الحصة:", e);
        showToast(dup
            ? (currentLang==='ar' ? 'هذه الحصة محجوزة في هذا اليوم — عدّل رقم الحصة' : 'That period is already taken')
            : (currentLang==='ar' ? 'تعذّرت الإضافة' : 'Could not add'));
    }finally{ schoolBusy(btn, false); }
}

async function deletePeriod(id){
    if(!sb || !schoolCtx || schoolCtx.role === "student") return;
    if(!confirm(currentLang==='ar' ? "حذف هذه الحصة؟" : "Delete this period?")) return;
    try{
        const { error } = await sb.from("timetable").delete().eq("id", id);
        if(error) throw error;
        loadTimetable();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الحصة:", e);
        showSchoolError(e, currentLang==='ar'?'الحذف':'the delete');
    }
}

/* ── ملاحظات اليوم (خاصة بصاحبها) ── */
async function loadDayNotes(){
    if(!sb || !schoolCtx) return [];
    try{
        const { data, error } = await sb.from("day_notes")
            .select("id, on_date, period_no, kind, text, color").limit(300);
        if(error) throw error;
        return data || [];
    }catch(e){ console.warn("[خُطى] تعذّر تحميل الملاحظات:", e); return []; }
}

let dayNoteDate = null;
let dayNotePeriod = null;   // رقم الحصة، أو null لملاحظة اليوم كله
/* ألوان التمييز — طلبها المالك صراحةً: «أن يكون للطالب القدرة على بعض
   التخصيص في جدوله، مثلاً وضع يوم محدّد بلون ويوم آخر بلون آخر». */
const DAY_NOTE_COLORS = [
    { c:"#C9A227", ar:"ذهبي",  en:"Gold"   },
    { c:"#2E6BE0", ar:"أزرق",  en:"Blue"   },
    { c:"#1E8449", ar:"أخضر",  en:"Green"  },
    { c:"#C0392B", ar:"أحمر",  en:"Red"    },
    { c:"#7C5CBF", ar:"بنفسجي",en:"Purple" },
];
let dayNoteColor = DAY_NOTE_COLORS[0].c;

function pickDayNoteColor(c){
    dayNoteColor = c;
    document.querySelectorAll("#dnote-colors .dnote-color")
        .forEach(el => el.classList.toggle("is-on", el.dataset.color === c));
}

function openDayNote(iso, periodNo){
    dayNoteDate = iso;
    dayNotePeriod = (periodNo === undefined || periodNo === null) ? null : Number(periodNo);
    const ov = document.getElementById("day-note-overlay");
    if(!ov) return;
    const title = document.getElementById("dnote-date");
    if(title){
        title.textContent = dayNotePeriod
            ? `${iso} — ${currentLang==='ar' ? `الحصة ${dayNotePeriod}` : `Period ${dayNotePeriod}`}`
            : iso;
    }
    const txt = document.getElementById("dnote-text");
    if(txt) txt.value = "";

    // شريط الألوان يُبنى مرة واحدة ويُعاد استعماله
    let colors = document.getElementById("dnote-colors");
    if(!colors){
        colors = document.createElement("div");
        colors.id = "dnote-colors";
        colors.className = "dnote-colors";
        colors.innerHTML = DAY_NOTE_COLORS.map(k =>
            `<button type="button" class="dnote-color" data-color="${k.c}" style="background:${k.c};"
                     title="${currentLang==='ar'?k.ar:k.en}" aria-label="${currentLang==='ar'?k.ar:k.en}"
                     onclick="pickDayNoteColor('${k.c}')"></button>`).join("");
        if(txt && txt.parentElement) txt.parentElement.insertBefore(colors, txt.nextSibling);
    }
    pickDayNoteColor(dayNoteColor);
    ov.style.display = "flex";
}
function closeDayNote(){
    const ov = document.getElementById("day-note-overlay");
    if(ov) ov.style.display = "none";
}

async function saveDayNote(kind){
    if(!sb || !schoolCtx || !dayNoteDate) return;
    const txt = (document.getElementById("dnote-text").value || "").trim();
    if(kind !== "highlight" && txt.length < 2){
        showToast(currentLang==='ar'?'اكتب الملاحظة':'Write the note'); return;
    }
    try{
        const { error } = await sb.from("day_notes").insert({
            school_id: schoolCtx.schoolId,
            owner_id: schoolCtx.memberId,
            on_date: dayNoteDate,
            period_no: dayNotePeriod,          // null = اليوم كله، كالسابق تماماً
            kind,
            text: kind === "highlight" ? (txt || null) : txt,
            color: kind === "highlight" ? dayNoteColor : null,
        });
        if(error) throw error;
        closeDayNote();
        showToast(currentLang==='ar'?'حُفظت ✅':'Saved ✅');
        loadTimetable();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ الملاحظة:", e);
        showSchoolError(e, currentLang==='ar'?'الحفظ':'the save');
    }
}

async function deleteDayNote(id){
    if(!sb || !schoolCtx) return;
    try{
        const { error } = await sb.from("day_notes").delete().eq("id", id);
        if(error) throw error;
        loadTimetable();
    }catch(e){ console.error("[خُطى] تعذّر حذف الملاحظة:", e); }
}

/* ============================================================
   اختبارات المدرّس
   ============================================================ */
/* ⚠️ عناوين الاختبارات يكتبها المعلّم، فلا تدخل داخل onclick إطلاقاً.
   السبب دقيق ويسهل الوقوع فيه: escapeHtml يحوّل ' إلى &#39;، لكن متصفّح
   HTML يفكّ هذا الترميز *قبل* أن يقرأ محرّك جافاسكربت السمة — فتعود '
   علامةً حقيقية تكسر النص وتُنفّذ ما بعدها. (مُثبَت عملياً باختبار متصفح:
   عنوان فيه ') نفّذ كود المهاجم.) فنمرّر المعرّف وحده ونقرأ العنوان من هنا. */
const teacherExamTitles = new Map();

async function loadTeacherExams(){
    /* الاختبارات والواجبات جدول واحد (kind)، ولكلٍّ تبويبه وقائمته */
    const kind = (typeof examWorkKind !== "undefined" && ["homework","practice"].includes(examWorkKind)) ? examWorkKind : "exam";
    const hw = kind === "homework", pr = kind === "practice";
    const box = document.getElementById(hw ? "shw-list" : pr ? "sgat-tests" : "sexams-list");
    if(!box || !schoolCtx || !sb) return;
    const ar = currentLang === 'ar';
    box.innerHTML = `<p class="card-sub">${ar?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        // ⚠️ questions لا يُقرأ هنا عمداً منذ ٢٠٢٦-٠٩-٢٢: كان يصل هذا الاستعلامَ
        // كاملاً (بإجاباته الصحيحة وشروحها) لكل طالب فور فتح تبويب الاختبارات
        // — قبل أن يضغط "ابدأ الاختبار" أصلاً، عبر استجابة الشبكة العادية بلا
        // حاجة لأي اختراق. سُحبت صلاحية قراءته مباشرة من قاعدة البيانات
        // (انظر sql/EXAM_FUNCTIONS.sql)، وlength وحده هو ما احتجناه أصلاً —
        // فجاء question_count عمود مولَّد بدلاً منه.
        const { data, error } = await sb.from("teacher_exams")
            .select("id, title, subject, grade, question_count, published, owner_id, created_at, kind, late_days, shuffle, gat_section")
            .eq("kind", kind)
            .order("created_at", { ascending:false }).limit(100);
        if(error) throw error;
        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${hw ? (ar?'لا توجد واجبات بعد.':'No homework yet.')
                                                  : pr ? (ar?'لا توجد اختبارات تدريب بعد.':'No practice tests yet.')
                                                    : (ar?'لا توجد اختبارات بعد.':'No exams yet.')}</p>`;
            return;
        }
        data.forEach(x => teacherExamTitles.set(x.id, x.title));

        /* ⚠️ ما سلّمه الطالب لا يُعرض له "ابدأ الاختبار" بعد اليوم.
           وصف المالك: "عند انتهاء الطالب من الاختبار لا يبقى لديه مكتوباً
           ابدأ الاختبار… بل يبقى بزر إظهار النتيجة". وهو محق — الزرّ نفسه
           يوحي بأن المحاولة متاحة، ثم يُرفض عند الضغط. الوعد الكاذب أسوأ
           من المنع الصريح.
           والحالة كلها (الموعد الخاص بفصله، المهلة، التسليم، المراجعة) من
           my_assigned_work بنداء واحد — الموعد يختلف بين فصل وآخر فلا يُحسب
           من هنا. */
        const myWork = new Map();
        if(schoolCtx.role === "student"){
            try{
                const { data: w, error: we } = await sb.rpc("my_assigned_work", { p_school: schoolCtx.schoolId });
                if(we) throw we;
                (w || []).forEach(a => myWork.set(a.exam_id, a));
            }catch(e){ console.warn("[خُطى] تعذّر جلب حالة أعمالي:", e); }
        }
        /* التدريب: الطاقم يرى عدد المختبرين فقط (practice_takers) — لا أسماء ولا درجات */
        const takers = new Map();
        if(pr && schoolCtx.role !== "student"){
            try{
                const { data: tk, error: te } = await sb.rpc("practice_takers", { p_school: schoolCtx.schoolId });
                if(te) throw te;
                (tk || []).forEach(t => takers.set(t.exam_id, t.takers));
            }catch(e){ console.warn("[خُطى] تعذّر جلب عدد المختبرين:", e); }
        }
        const rows = hw && schoolCtx.role === "student"
            ? sortHomeworkForStudent(data, myWork) : data;

        box.innerHTML = renderSchoolList(rows, x => {
            const n = x.question_count || 0;
            const mine = x.owner_id === schoolCtx.memberId;
            /* ⚠️ خطأ أدخلتُه أنا في الدفعة السابقة: جعلتُ زرّ "ابدأ الاختبار"
               يظهر لكل من ليس مالك الاختبار — فظهر للإدارة على اختبارات
               المعلّمين. ووصفه المالك بدقة: "كيف المعلم يقوم باختبار معلم
               آخر؟". الاختبار يؤدّيه الطالب وحده. */
            const iAmStudent = schoolCtx.role === "student";
            /* والإدارة تدير اختبارات معلّميها كلها — وهذا ما طلبه المالك:
               "الإدارة فقط هي ما يظهر لها جميع اختبارات المعلمين ويمكنها
               التحكم بها كما تريد". (وصلاحيات القراءة في قاعدة البيانات
               تطابق هذا أصلاً: المعلّم لا يرى إلا اختباراته هو.) */
            const iCanManage = mine || schoolCtx.role === "admin";
            const w = myWork.get(x.id);
            const extras = [
                pr && x.gat_section ? gatSectionName(x.gat_section) : "",
                x.shuffle && !iAmStudent ? (ar?'مخلوط':'shuffled') : "",
                hw && !iAmStudent && x.late_days ? (ar?`تأخير حتى ${x.late_days} يوم`:`late up to ${x.late_days}d`) : "",
            ].filter(Boolean).map(t => ` · ${t}`).join("");
            return `
            <div class="sfile-row">
                <div class="sfile-main">
                    <i class="fa-solid ${hw ? 'fa-book-open-reader' : pr ? 'fa-brain' : 'fa-clipboard-question'}"></i>
                    <div>
                        <b>${escapeHtml(x.title)}</b>
                        <div class="card-sub">${escapeHtml(x.subject || "")} · ${n} ${ar?'سؤالاً':'questions'}
                            ${iAmStudent ? "" : (x.published ? `· <span style="color:var(--teal-text); font-weight:700;">${ar?'منشور':'published'}</span>`
                                          : `· ${ar?'مسودة':'draft'}`)}${extras}${schoolSourceLine(x.owner_id)}</div>
                        ${iAmStudent && w && w.due_at ? `<div class="card-sub">${workDueLine(w)}</div>` : ""}
                    </div>
                </div>
                ${iAmStudent ? (pr ? practiceActions(x, w) : studentWorkActions(x, w, hw)) : ""}
                ${iCanManage ? `<div class="sfile-actions">
                    <button type="button" class="btn btn-sm" onclick="openExamSend('${escapeHtml(x.id)}')">
                        <i class="fa-solid fa-paper-plane"></i> ${x.published
                            ? (ar?'إرسال لمزيد':'Send to more')
                            : (ar?'إرسال':'Send')}</button>
                    ${pr ? `<span class="pill" title="${ar?'بلا أسماء ولا درجات — تدريب':'No names or scores — practice'}">
                        <i class="fa-solid fa-users"></i> ${ar ? `اختبره ${takers.get(x.id) || 0} طالباً` : `${takers.get(x.id) || 0} took it`}</span>`
                    : `<button type="button" class="btn btn-outline btn-sm" onclick="openSchoolExamResults('${escapeHtml(x.id)}')">
                        <i class="fa-solid fa-chart-simple"></i> ${ar?'النتائج':'Results'}</button>`}
                    <button type="button" class="btn btn-outline btn-sm" onclick="deleteExam('${escapeHtml(x.id)}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ""}
            </div>`;
        });
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الاختبارات:", e);
        box.innerHTML = `<p class="card-sub">${hw ? (ar?'تعذّر تحميل الواجبات.':'Could not load homework.')
                                                : (ar?'تعذّر تحميل الاختبارات.':'Could not load exams.')}</p>`;
    }
}

function gatSectionName(s){
    const ar = currentLang === 'ar';
    return s === "verbal" ? (ar ? "لفظي" : "Verbal") : s === "quant" ? (ar ? "كمّي" : "Quant") : (ar ? "مختلط" : "Mixed");
}

/* التدريب للطالب: يبدأ أو يعيد متى شاء — نتيجته له وحده */
function practiceActions(x, w){
    const ar = currentLang === 'ar';
    const id = escapeHtml(x.id);
    const last = w && w.done && w.total ? `<span class="pill">${ar ? "آخر محاولة" : "Last"}: ${escapeHtml(String(Number(w.score)))} / ${escapeHtml(String(w.total))}</span>` : "";
    return `<div class="sfile-actions">${last}
        <button type="button" class="btn btn-sm acc-btn" onclick="openStudentExam('${id}')">
            <i class="fa-solid ${w && w.done ? 'fa-rotate-right' : 'fa-play'}"></i> ${w && w.done ? (ar ? 'تدرّب مجدداً' : 'Practice again') : (ar ? 'ابدأ التدريب' : 'Start')}</button>
    </div>`;
}

/* الواجبات للطالب: ما لم يُسلَّم وموعده أقرب أولاً، ثم المُسلَّم، ثم الفائت. */
function sortHomeworkForStudent(rows, work){
    const rank = x => {
        const w = work.get(x.id);
        if(!w) return [3, 0];
        if(w.done) return [1, -new Date(w.due_at || 0).getTime()];
        if(workClosed(w)) return [2, -new Date(w.due_at || 0).getTime()];
        return [0, new Date(w.due_at || 8.64e15).getTime()];
    };
    return [...rows].sort((a, b) => {
        const ra = rank(a), rb = rank(b);
        return ra[0] - rb[0] || ra[1] - rb[1];
    });
}

/* المهلة تُغلق التسليم في الواجب وحده؛ الاختبار سلوكه القديم لم يتغيّر */
function workClosed(w){
    if(!w || w.kind !== "homework") return false;
    const end = w.close_at || w.due_at;
    return !!(end && new Date(end).getTime() < Date.now());
}

/** سطر الموعد وحالته للطالب — ميلادي صراحةً مثل seDueText. */
function workDueLine(w){
    const ar = currentLang === 'ar';
    let when = "";
    try{
        when = new Date(w.due_at).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-US",
            { dateStyle: "medium", timeStyle: "short" });
    }catch(e){}
    const left = new Date(w.due_at).getTime() - Date.now();
    let state = "";
    if(w.done) state = w.late ? `<span class="se-late-note">${ar?'سُلِّم متأخراً':'late'}</span>` : "";
    else if(workClosed(w)) state = `<span style="color:var(--rose); font-weight:700;">${ar?'فات الموعد':'missed'}</span>`;
    else if(left < 0 && w.kind === "homework") state = `<span class="se-late-note">${ar?'متأخر — ما زال يُقبل':'late — still accepted'}</span>`;
    else if(left < 86400000) state = `<span style="color:var(--gold-text); font-weight:700;">${ar?'ينتهي اليوم':'due today'}</span>`;
    return `<i class="fa-regular fa-clock"></i> ${ar?'التسليم':'Due'}: ${escapeHtml(when)} ${state}`;
}

function studentWorkActions(x, w, hw){
    const ar = currentLang === 'ar';
    const id = escapeHtml(x.id);
    if(w && w.done){
        const pct = w.total ? Math.round((Number(w.score) / w.total) * 100) : 0;
        return `<div class="sfile-actions">
            <span class="pill" style="background:var(--teal-soft, rgba(30,132,73,.15)); color:var(--teal-text);">${pct}%</span>
            <button type="button" class="btn btn-outline btn-sm" onclick="openStudentExam('${id}')">
                <i class="fa-solid fa-chart-simple"></i> ${ar?'إظهار النتيجة':'Show result'}</button>
        </div>`;
    }
    if(hw && w && workClosed(w)){
        return w.can_review ? `<div class="sfile-actions">
            <button type="button" class="btn btn-outline btn-sm" onclick="openStudentExam('${id}')">
                <i class="fa-solid fa-lightbulb"></i> ${ar?'الحلّ':'Solution'}</button>
        </div>` : "";
    }
    return `<div class="sfile-actions">
        <button type="button" class="btn btn-sm acc-btn" onclick="openStudentExam('${id}')">
            <i class="fa-solid fa-pen-to-square"></i> ${hw ? (ar?'ابدأ الواجب':'Start') : (ar?'ابدأ الاختبار':'Start')}</button>
    </div>`;
}

/* المدرّس يلصق أسئلته بصيغة بسيطة، سطر لكل سؤال:
   نص السؤال | خيار1 | خيار2 | خيار3 | خيار4 | رقم الإجابة (يبدأ من 1)
   اخترنا "يبدأ من 1" هنا عمداً خلافاً للتخزين الداخلي: من يكتب بيده يعدّ من
   واحد، والخطأ في هذا الرقم يعني احتساب إجابة الطالب الصحيحة خاطئة. */
function parseExamQuestions(raw){
    const out = [], problems = [];
    (raw || "").split("\n").forEach((line, i) => {
        const t = line.trim();
        if(!t) return;
        const parts = t.split("|").map(x => x.trim());
        if(parts.length < 4){ problems.push(`${i+1}: ${currentLang==='ar'?'يحتاج سؤالاً وخيارين على الأقل ورقم الإجابة':'needs question, 2+ choices and answer number'}`); return; }
        const answer = parseInt(parts[parts.length-1], 10);
        const choices = parts.slice(1, -1).filter(Boolean);
        if(!parts[0]){ problems.push(`${i+1}: ${currentLang==='ar'?'نص السؤال فارغ':'empty question'}`); return; }
        if(choices.length < 2){ problems.push(`${i+1}: ${currentLang==='ar'?'يحتاج خيارين على الأقل':'needs 2+ choices'}`); return; }
        if(!Number.isInteger(answer) || answer < 1 || answer > choices.length){
            problems.push(`${i+1}: ${currentLang==='ar'?`رقم الإجابة يجب أن يكون بين 1 و${choices.length}`:`answer must be 1..${choices.length}`}`); return;
        }
        out.push({ id:`e${i+1}`, text:parts[0], choices, correct: answer - 1 });
    });
    return { questions: out, problems };
}

/* ⚠️ حُذفت من هنا دالّتان ميّتتان: createExam و publishExam.
   كانتا من نموذج الاختبارات القديم قبل المنشئ المرئي، ولم يعد يستدعيهما
   شيء، وكانتا تشيران إلى عنصرَي exam-create و exam-class المحذوفين من
   الصفحة. كودٌ ميت يشير إلى واجهة ميتة: لا يُنتج خطأً، لكنه يضلّل من يقرأ
   الملف بعدنا فيظن أن هناك مسارين للحفظ والإرسال. البديل الحيّ:
   saveExamDraft في js/18-exam-builder.js و openExamSend في js/19-exam-send.js.
   (كشفه تدقيق آلي يقارن ما يستدعيه HTML بما هو معرَّف فعلاً.) */

async function deleteExam(id){
    if(!sb || !schoolCtx) return;
    if(!confirm(currentLang==='ar' ? "حذفه مع محاولات الطلاب عليه؟" : "Delete it and its attempts?")) return;
    try{
        const { error } = await sb.from("teacher_exams").delete().eq("id", id);
        if(error) throw error;
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الاختبار:", e);
        showSchoolError(e, currentLang==='ar'?'الحذف':'the delete');
    }
}


/* ============================================================
   الرابط المميّز للملف
   ------------------------------------------------------------
   ⚠️ الرمز اختصار لا مفتاح: من يفتح الرابط يخضع لسياسات teacher_files
   كاملةً. فلو أعطى المعلّم الرابط لمن لا يحق له، لم يفتح له شيء. الرابط
   يوفّر البحث فقط، ولا يمنح صلاحية إطلاقاً.
   ============================================================ */
function fileShareUrl(code){
    return `${location.origin}${location.pathname}?f=${encodeURIComponent(code)}`;
}

async function copyFileLink(code){
    const url = fileShareUrl(code);
    try{
        await navigator.clipboard.writeText(url);
        showToast(currentLang==='ar' ? 'نُسخ الرابط ✅' : 'Link copied ✅');
    }catch(e){
        // النسخ يفشل بلا HTTPS أو بلا إذن — نعرضه ليُنسخ يدوياً بدل صمت محيّر
        window.prompt(currentLang==='ar' ? 'انسخ الرابط:' : 'Copy the link:', url);
    }
}

/** يفتح الملف مباشرة إن فُتح الموقع برابط مميّز. */
async function openFileFromShortCode(){
    let code = null;
    try{ code = new URLSearchParams(location.search).get("f"); }catch(e){ return; }
    if(!code || !/^[a-z2-9]{4,16}$/i.test(code)) return;
    if(!sb) return;

    try{
        const { data, error } = await sb.rpc("file_by_short_code", { p_code: code.toLowerCase() });
        if(error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if(!row){
            // الرمز الخاطئ والملف الممنوع يبدوان واحداً عمداً: لا نكشف وجود
            // ملف لمن لا يحق له رؤيته.
            showToast(currentLang==='ar' ? 'الملف غير متاح لحسابك' : 'File not available for your account');
            return;
        }
        if(row.external_url){ window.open(row.external_url, "_blank", "noopener"); return; }
        const { data: signed, error: sErr } = await sb.storage
            .from("teacher-files").createSignedUrl(row.storage_path, 300);
        if(sErr) throw sErr;
        window.open(signed.signedUrl, "_blank", "noopener");
    }catch(e){
        console.error("[خُطى] تعذّر فتح الملف بالرابط المميّز:", e);
        showToast(currentLang==='ar' ? 'تعذّر فتح الملف' : 'Could not open the file');
    }
}

/* يُستدعى عند فتح قسم المدرسة — يحمّل ما يخصّ الدور الحالي فقط.

   ⚠️⚠️ هنا كان العطل الذي أفرغ كل شيء بعد كل تحديث للصفحة، وهو أخطر ما
   وُجد حتى الآن: كان الشرط `!hasFeature("school")`، وقيمتها **false** على
   الرابط العادي منذ أن وحّدنا المنصّتين — بل التعليق في js/00-tenant.js
   يقول صراحةً "ليست ميزة نسخة بعد اليوم"، ومع ذلك بقي الشرط هنا يقرؤها.

   فكانت هذه الدالة تخرج فوراً في كل مرة، فلا تُحمَّل ملفات ولا روابط ولا
   جدول ولا اختبارات. والذي خدع الجميع أن الإضافة كانت "تعمل": لأن
   uploadTeacherFile تستدعي loadTeacherFiles مباشرةً بلا هذا الشرط، فيظهر
   الملف فور رفعه — ثم يختفي عند أول تحديث لأن مسار الإقلاع يمرّ من هنا.

   والبيانات لم تُفقد قط: فحصُ قاعدة البيانات أظهر الملفات والروابط
   والاختبارات كلها سليمة محفوظة. العطل كان في القراءة لا في الكتابة.

   ➡️ الشرط الصحيح هو العضوية وحدها: من كان عضواً حمّلنا له مساحته. */
async function loadSchoolWorkspace(){
    if(!schoolCtx) return;
    await loadSchoolClasses();
    // ⚠️ الأسماء أولاً بـawait: القوائم تكتب "من: فلان" وهي ترسم، فلو جاءت
    // الأسماء بعدها ظهر الطالب أمام ملفات بلا مصدر — وهي الشكوى نفسها.
    if(typeof loadSchoolStaffNames === "function") await loadSchoolStaffNames();
    loadTeacherFiles();
    loadTeacherLinks();
    loadTimetable();
    loadTeacherExams();
    // المنشئ المرئي يبدأ بسؤال فارغ جاهز — بطاقة فارغة أوضح من زر وحيد
    if(schoolCtx.role !== "student" && typeof renderExamBuilder === "function"){
        try{ renderExamBuilder(); }catch(e){ console.warn("[خُطى] تعذّر رسم منشئ الاختبارات:", e); }
    }
    openFileFromShortCode();
}

/* ملاحظة ترتيب: صرف أحداث المصادقة كان هنا حين كان هذا آخر ملف، ثم انتقل
   إلى js/15-demo.js لأنه صار الأخير. القاعدة ثابتة: الصرف في آخر ملف. */
