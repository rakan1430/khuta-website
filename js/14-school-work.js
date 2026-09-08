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

function schoolBusy(btn, on){
    if(!btn) return;
    btn.disabled = on;
    btn.style.opacity = on ? ".6" : "";
}

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
            .select("id, title, subject, grade, storage_path, external_url, size_bytes, shared, owner_id, created_at")
            .order("created_at", { ascending:false })
            .limit(200);
        if(error) throw error;
        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا توجد ملفات بعد.':'No files yet.'}</p>`;
            return;
        }
        box.innerHTML = data.map(f => {
            const mine = f.owner_id === schoolCtx.memberId;
            const size = f.size_bytes ? ` · ${Math.max(1, Math.round(f.size_bytes/1024))} KB` : "";
            const meta = [f.subject, f.grade ? gradeLabel(f.grade) : null].filter(Boolean).map(escapeHtml).join(" · ");
            return `
            <div class="sfile-row">
                <div class="sfile-main">
                    <i class="fa-solid ${f.external_url ? "fa-link" : "fa-file-pdf"}"></i>
                    <div>
                        <b>${escapeHtml(f.title)}</b>
                        <div class="card-sub">${meta}${escapeHtml(size)}${f.shared ? "" : (currentLang==='ar'?' · خاص بي':' · private')}</div>
                    </div>
                </div>
                <div class="sfile-actions">
                    <button type="button" class="btn btn-sm" onclick="openTeacherFile('${escapeHtml(f.id)}')">
                        <i class="fa-solid fa-up-right-from-square"></i> ${currentLang==='ar'?'فتح':'Open'}</button>
                    ${mine ? `<button type="button" class="btn btn-outline btn-sm" onclick="deleteTeacherFile('${escapeHtml(f.id)}')">
                        <i class="fa-solid fa-trash"></i></button>` : ""}
                </div>
            </div>`;
        }).join("");
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الملفات:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الملفات.':'Could not load files.'}</p>`;
    }
}

function gradeLabel(g){
    const ar = { "1":"أول ثانوي", "2":"ثاني ثانوي", "3":"ثالث ثانوي" };
    const en = { "1":"Grade 10", "2":"Grade 11", "3":"Grade 12" };
    return (currentLang==='ar' ? ar : en)[g] || g;
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
        showToast(currentLang==='ar'?'تعذّر فتح الملف':'Could not open the file');
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

    const btn = document.getElementById("tfile-submit");
    schoolBusy(btn, true);
    try{
        let storagePath = null, size = null;
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
        showToast(currentLang==='ar'?'تم الرفع ✅':'Uploaded ✅');
        loadTeacherFiles();
    }catch(e){
        console.error("[خُطى] تعذّر الرفع:", e);
        showToast(currentLang==='ar'?'تعذّر الرفع — تحقق من نوع الملف وحجمه':'Upload failed — check file type and size');
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
        showToast(currentLang==='ar'?'تعذّر الحذف':'Delete failed');
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
        box.innerHTML = data.map(l => `
            <div class="slink-row">
                <a class="slink-open" href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid ${escapeHtml(l.icon || "fa-link")}"></i>
                    <span>${escapeHtml(l.label)}</span>
                </a>
                ${l.owner_id === schoolCtx.memberId ? `
                <button type="button" class="btn btn-ghost btn-sm" onclick="deleteTeacherLink('${escapeHtml(l.id)}')" aria-label="${currentLang==='ar'?'حذف':'Delete'}">
                    <i class="fa-solid fa-trash"></i></button>` : ""}
            </div>`).join("");
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
        showToast(currentLang==='ar'?'تعذّر الحذف':'Delete failed');
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

    ["tt-class","exam-class"].forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        const prev = sel.value;
        sel.textContent = "";
        schoolClasses.forEach(c => {
            const o = document.createElement("option");
            o.value = c.id; o.textContent = c.name;
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

function renderTimetable(rows, notes){
    const box = document.getElementById("tt-grid");
    if(!box) return;
    const canEdit = schoolCtx && schoolCtx.role !== "student";
    const byDay = {};
    rows.forEach(r => { (byDay[r.weekday] = byDay[r.weekday] || []).push(r); });
    const notesByDate = {};
    notes.forEach(n => { (notesByDate[n.on_date] = notesByDate[n.on_date] || []).push(n); });

    box.innerHTML = SCHOOL_DAYS.map(wd => {
        const iso = dateOfWeekday(wd);
        const dayNotes = notesByDate[iso] || [];
        const highlight = dayNotes.find(n => n.kind === "highlight");
        const periods = (byDay[wd] || []).sort((a,b) => a.period_no - b.period_no);
        return `
        <div class="tt-day${highlight ? " is-marked" : ""}"${highlight && highlight.color ? ` style="border-color:${escapeHtml(highlight.color)};"` : ""}>
            <div class="tt-day-head">
                <b>${escapeHtml(weekdayName(wd))}</b>
                <button type="button" class="btn btn-ghost btn-sm" onclick="openDayNote('${escapeHtml(iso)}')" title="${currentLang==='ar'?'ملاحظاتي':'My notes'}">
                    <i class="fa-solid fa-note-sticky"></i>${dayNotes.length ? ` <span class="pill">${dayNotes.length}</span>` : ""}
                </button>
            </div>
            ${periods.length ? periods.map(p => `
                <div class="tt-period">
                    <span class="tt-no">${escapeHtml(String(p.period_no))}</span>
                    <span class="tt-subject">${escapeHtml(p.subject)}</span>
                    ${p.room ? `<span class="card-sub">${escapeHtml(p.room)}</span>` : ""}
                    ${canEdit ? `<button type="button" class="btn btn-ghost btn-sm" onclick="deletePeriod('${escapeHtml(p.id)}')" aria-label="${currentLang==='ar'?'حذف':'Delete'}"><i class="fa-solid fa-xmark"></i></button>` : ""}
                </div>`).join("")
              : `<p class="card-sub" style="padding:6px 2px;">${currentLang==='ar'?'لا حصص':'No periods'}</p>`}
            ${dayNotes.filter(n => n.kind !== "highlight").map(n => `
                <div class="tt-note">
                    <i class="fa-solid ${n.kind === "reminder" ? "fa-bell" : "fa-pen"}"></i>
                    <span>${escapeHtml(n.text || "")}</span>
                    <button type="button" class="btn btn-ghost btn-sm" onclick="deleteDayNote('${escapeHtml(n.id)}')" aria-label="${currentLang==='ar'?'حذف':'Delete'}"><i class="fa-solid fa-xmark"></i></button>
                </div>`).join("")}
        </div>`;
    }).join("");
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
        showToast(currentLang==='ar'?'تعذّر الحذف':'Delete failed');
    }
}

/* ── ملاحظات اليوم (خاصة بصاحبها) ── */
async function loadDayNotes(){
    if(!sb || !schoolCtx) return [];
    try{
        const { data, error } = await sb.from("day_notes")
            .select("id, on_date, kind, text, color").limit(300);
        if(error) throw error;
        return data || [];
    }catch(e){ console.warn("[خُطى] تعذّر تحميل الملاحظات:", e); return []; }
}

let dayNoteDate = null;
function openDayNote(iso){
    dayNoteDate = iso;
    const ov = document.getElementById("day-note-overlay");
    if(!ov) return;
    const title = document.getElementById("dnote-date");
    if(title) title.textContent = iso;
    const txt = document.getElementById("dnote-text");
    if(txt) txt.value = "";
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
            kind,
            text: kind === "highlight" ? (txt || null) : txt,
            color: kind === "highlight" ? "#C9A227" : null,
        });
        if(error) throw error;
        closeDayNote();
        showToast(currentLang==='ar'?'حُفظت ✅':'Saved ✅');
        loadTimetable();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ الملاحظة:", e);
        showToast(currentLang==='ar'?'تعذّر الحفظ':'Could not save');
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
async function loadTeacherExams(){
    const box = document.getElementById("sexams-list");
    if(!box || !schoolCtx || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb.from("teacher_exams")
            .select("id, title, subject, grade, questions, published, owner_id, created_at")
            .order("created_at", { ascending:false }).limit(100);
        if(error) throw error;
        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا توجد اختبارات بعد.':'No exams yet.'}</p>`;
            return;
        }
        box.innerHTML = data.map(x => {
            const n = Array.isArray(x.questions) ? x.questions.length : 0;
            const mine = x.owner_id === schoolCtx.memberId;
            return `
            <div class="sfile-row">
                <div class="sfile-main">
                    <i class="fa-solid fa-clipboard-question"></i>
                    <div>
                        <b>${escapeHtml(x.title)}</b>
                        <div class="card-sub">${escapeHtml(x.subject || "")} · ${n} ${currentLang==='ar'?'سؤالاً':'questions'}
                            ${x.published ? `· <span style="color:var(--teal-text); font-weight:700;">${currentLang==='ar'?'منشور':'published'}</span>`
                                          : `· ${currentLang==='ar'?'مسودة':'draft'}`}</div>
                    </div>
                </div>
                ${mine ? `<div class="sfile-actions">
                    ${!x.published ? `<button type="button" class="btn btn-sm" onclick="publishExam('${escapeHtml(x.id)}')">
                        <i class="fa-solid fa-paper-plane"></i> ${currentLang==='ar'?'إرسال للفصل':'Send to class'}</button>` : ""}
                    <button type="button" class="btn btn-outline btn-sm" onclick="deleteExam('${escapeHtml(x.id)}')"><i class="fa-solid fa-trash"></i></button>
                </div>` : ""}
            </div>`;
        }).join("");
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الاختبارات:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الاختبارات.':'Could not load exams.'}</p>`;
    }
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

async function createExam(){
    if(!sb || !schoolCtx || schoolCtx.role === "student") return;
    const title = (document.getElementById("exam-title").value || "").trim();
    if(title.length < 2){ showToast(currentLang==='ar'?'اكتب عنوان الاختبار':'Enter a title'); return; }
    const { questions, problems } = parseExamQuestions(document.getElementById("exam-raw").value);
    const errBox = document.getElementById("exam-parse-errors");
    if(errBox){
        errBox.innerHTML = problems.length
            ? `<b>${currentLang==='ar'?'أسطر لم تُقبل:':'Rejected lines:'}</b><br>` + problems.map(escapeHtml).join("<br>")
            : "";
        errBox.style.display = problems.length ? "block" : "none";
    }
    if(!questions.length){ showToast(currentLang==='ar'?'لم يُقبل أي سؤال':'No valid questions'); return; }

    const btn = document.getElementById("exam-create");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("teacher_exams").insert({
            school_id: schoolCtx.schoolId,
            owner_id: schoolCtx.memberId,
            title,
            subject: (document.getElementById("exam-subject").value || "").trim() || null,
            grade: document.getElementById("exam-grade").value || null,
            questions,
            published: false,
        });
        if(error) throw error;
        document.getElementById("exam-title").value = "";
        document.getElementById("exam-raw").value = "";
        showToast(currentLang==='ar' ? `حُفظ ${questions.length} سؤالاً ✅` : `Saved ${questions.length} questions ✅`);
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر إنشاء الاختبار:", e);
        showToast(currentLang==='ar'?'تعذّر الحفظ':'Could not save');
    }finally{ schoolBusy(btn, false); }
}

/* النشر = إسناد الاختبار لفصل + وضع الطلاب في طابور الإشعارات.
   البريد نفسه يرسله خادم مُجدوَل، لا المتصفح. */
async function publishExam(id){
    if(!sb || !schoolCtx) return;
    if(!schoolClasses.length) await loadSchoolClasses();
    const sel = document.getElementById("exam-class");
    let classId = sel && sel.value;
    if(!classId && schoolClasses.length === 1) classId = schoolClasses[0].id;
    if(!classId){ showToast(currentLang==='ar'?'اختر الفصل أولاً':'Pick a class first'); return; }
    if(!confirm(currentLang==='ar' ? "إرسال الاختبار لهذا الفصل الآن؟" : "Send this exam to the class now?")) return;

    try{
        const { error: aErr } = await sb.from("exam_assignments").insert({ exam_id:id, class_id:classId });
        if(aErr && aErr.code !== "23505") throw aErr;   // 23505 = مُسنَد مسبقاً، ليس خطأً
        const { error: pErr } = await sb.from("teacher_exams").update({ published:true }).eq("id", id);
        if(pErr) throw pErr;

        // طابور البريد. الإسناد نجح أصلاً والطلاب يرون الاختبار في الموقع،
        // فلا نُفشل العملية كلها لو تعثّر الطابور — نخبر المدرّس فقط.
        let queued = 0, mailFailed = false;
        try{
            const { data, error } = await sb.rpc("enqueue_exam_notifications", { p_exam:id, p_class:classId });
            if(error) throw error;
            queued = data || 0;
        }catch(e){ mailFailed = true; console.warn("[خُطى] تعذّر وضع الإشعارات في الطابور:", e); }

        showToast(mailFailed
            ? (currentLang==='ar' ? 'أُرسل للفصل ✅ (تعذّر جدولة البريد)' : 'Sent ✅ (email queue failed)')
            : (currentLang==='ar' ? `أُرسل للفصل ✅ وسيصل إشعار بريدي لـ${queued} طالباً` : `Sent ✅ — ${queued} students will be emailed`));
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر إرسال الاختبار:", e);
        showToast(currentLang==='ar'?'تعذّر الإرسال':'Could not send');
    }
}

async function deleteExam(id){
    if(!sb || !schoolCtx) return;
    if(!confirm(currentLang==='ar' ? "حذف هذا الاختبار ومحاولات الطلاب عليه؟" : "Delete this exam and its attempts?")) return;
    try{
        const { error } = await sb.from("teacher_exams").delete().eq("id", id);
        if(error) throw error;
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الاختبار:", e);
        showToast(currentLang==='ar'?'تعذّر الحذف':'Delete failed');
    }
}

/* يُستدعى عند فتح قسم المدرسة — يحمّل ما يخصّ الدور الحالي فقط */
async function loadSchoolWorkspace(){
    if(!hasFeature("school") || !schoolCtx) return;
    await loadSchoolClasses();
    loadTeacherFiles();
    loadTeacherLinks();
    loadTimetable();
    loadTeacherExams();
}

/* ملاحظة ترتيب: صرف أحداث المصادقة كان هنا حين كان هذا آخر ملف، ثم انتقل
   إلى js/15-demo.js لأنه صار الأخير. القاعدة ثابتة: الصرف في آخر ملف. */
