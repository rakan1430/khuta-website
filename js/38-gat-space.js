/* ============================================================
   38) مساحة القدرات — تدريب المعلّم لطلابه (المرحلة ٣)
   ------------------------------------------------------------
   قرارات المالك:
   • المعلّم يرسل لطلابه اختبارات قدرات وملفات وروابط فيديو — **تدريب بلا درجات**.
   • الطالب يعيد الاختبار متى شاء ويرى محاولاته السابقة.
   • المحتوى لطلاب المدرسة فقط — لا يصل طلاب خُطى العامّين.
   • المعلّم يرى **عدد المختبرين فقط** — بلا أسماء ولا درجات. وهذا مفروض في
     القاعدة لا هنا: سياسات exam_attempts تحجب محاولات التدريب عن الطاقم كلّه،
     والعدد من practice_takers (sql/PHASE3_GAT_SPACE.sql).

   الاختبارات: المنشئ نفسه بنوع «تدريب» (setExamWorkKind('practice')).
   الملفات والروابط: جدولا المعلّم نفساهما بـspace='gat' — فصلاحيات الطالب
   (يرى ما شاركه معلّمو فصله) هي نفسها بلا سطر جديد.
   ============================================================ */

function gatL(ar, en){ return currentLang === "ar" ? ar : en; }

function renderGatTab(){
    if(!schoolCtx || !sb) return;
    if(typeof setExamWorkKind === "function") setExamWorkKind("practice");   // ينقل المنشئ ويحمّل الاختبارات
    renderGatForms();
    loadGatResources();
}

function renderGatForms(){
    const box = document.getElementById("sgat-forms");
    if(!box) return;
    if(schoolCtx.role === "student"){ box.innerHTML = ""; return; }
    box.innerHTML = `
    <details class="exq-import">
        <summary>${gatL("أضف فيديو أو رابطاً", "Add a video or link")}</summary>
        <div class="input-row" style="margin-top:10px;">
            <div class="form-group"><label>${gatL("العنوان", "Title")}</label>
                <input type="text" id="gat-link-label" maxlength="80" placeholder="${gatL("شرح التناظر اللفظي", "Verbal analogy explained")}"></div>
            <div class="form-group"><label>${gatL("الرابط", "Link")}</label>
                <input type="url" id="gat-link-url" dir="ltr" placeholder="https://youtu.be/…"></div>
        </div>
        <button type="button" id="gat-link-submit" class="btn acc-btn" onclick="addGatLink()"><i class="fa-solid fa-plus"></i> ${gatL("أضف", "Add")}</button>
    </details>
    <details class="exq-import">
        <summary>${gatL("أضف ملفاً", "Add a file")}</summary>
        <p class="hint" style="margin:10px 0;">${gatL("ما ألّفته أنت أو ما يحق لك مشاركته. يصل طلاب فصولك فقط.",
            "Your own material or what you may share. Only your classes see it.")}</p>
        <div class="input-row">
            <div class="form-group"><label>${gatL("العنوان", "Title")}</label>
                <input type="text" id="gat-file-title" maxlength="120"></div>
            <div class="form-group"><label>${gatL("الملف (PDF أو صورة)", "File (PDF or image)")}</label>
                <input type="file" id="gat-file-input" accept="application/pdf,image/*"></div>
        </div>
        <button type="button" id="gat-file-submit" class="btn acc-btn" onclick="uploadGatFile()"><i class="fa-solid fa-upload"></i> ${gatL("ارفع", "Upload")}</button>
    </details>`;
}

async function loadGatResources(){
    const filesBox = document.getElementById("sgat-files");
    const linksBox = document.getElementById("sgat-links");
    if(!filesBox || !linksBox) return;
    const loading = `<p class="card-sub">${gatL("جارٍ التحميل…", "Loading…")}</p>`;
    filesBox.innerHTML = loading; linksBox.innerHTML = loading;
    const [files, links] = await Promise.all([
        sb.from("teacher_files").select("id, title, external_url, size_bytes, owner_id, created_at")
            .eq("space", "gat").order("created_at", { ascending:false }).limit(200),
        sb.from("teacher_links").select("id, label, url, owner_id, created_at")
            .eq("space", "gat").order("created_at", { ascending:false }).limit(200),
    ]);
    const mineOrFrom = ownerId => ownerId === schoolCtx.memberId ? "" : schoolSourceLine(ownerId);

    if(files.error){ filesBox.innerHTML = `<p class="card-sub">${escapeHtml(schoolError(files.error, gatL("تحميل الملفات", "loading files")))}</p>`; }
    else filesBox.innerHTML = (files.data || []).length ? renderSchoolList(files.data, f => `
        <div class="sfile-row">
            <div class="sfile-main"><i class="fa-solid fa-file-pdf"></i>
                <div><b>${escapeHtml(f.title)}</b><div class="card-sub">${f.size_bytes ? Math.max(1, Math.round(f.size_bytes / 1024)) + " KB" : ""}${mineOrFrom(f.owner_id)}</div></div></div>
            <div class="sfile-actions">
                <button type="button" class="btn btn-sm" onclick="openTeacherFile('${escapeHtml(f.id)}')"><i class="fa-solid fa-up-right-from-square"></i> ${gatL("فتح", "Open")}</button>
                ${f.owner_id === schoolCtx.memberId ? `<button type="button" class="btn btn-outline btn-sm" onclick="deleteGatFile('${escapeHtml(f.id)}')"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
        </div>`) : `<p class="card-sub">${gatL("لا ملفات بعد.", "No files yet.")}</p>`;

    if(links.error){ linksBox.innerHTML = `<p class="card-sub">${escapeHtml(schoolError(links.error, gatL("تحميل الروابط", "loading links")))}</p>`; }
    else linksBox.innerHTML = (links.data || []).length ? renderSchoolList(links.data, l => `
        <div class="slink-row">
            <a class="slink-open" href="${/^https?:\/\//i.test(l.url) ? escapeHtml(l.url) : "#"}" target="_blank" rel="noopener noreferrer">
                <i class="fa-solid fa-circle-play"></i>
                <span>${escapeHtml(l.label)}${l.owner_id === schoolCtx.memberId ? "" : (schoolStaffName(l.owner_id)
                    ? `<small class="card-sub" style="display:block;">${gatL("من", "from")} ${escapeHtml(schoolStaffName(l.owner_id))}</small>` : "")}</span>
            </a>
            ${l.owner_id === schoolCtx.memberId ? `<button type="button" class="btn btn-ghost btn-sm" onclick="deleteGatLink('${escapeHtml(l.id)}')" aria-label="${gatL("حذف", "Delete")}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>`) : `<p class="card-sub">${gatL("لا روابط بعد.", "No links yet.")}</p>`;
}

async function addGatLink(){
    const labelEl = document.getElementById("gat-link-label"), urlEl = document.getElementById("gat-link-url");
    const label = (labelEl.value || "").trim();
    let url = (urlEl.value || "").trim();
    if(label.length < 2){ showToast(gatL("اكتب عنواناً", "Enter a title")); return; }
    if(url && !/^[a-z]+:/i.test(url)) url = "https://" + url;
    if(!/^https:\/\/[^\s<>"]+$/i.test(url)){ showToast(gatL("الرابط يجب أن يبدأ بـ https://", "Link must start with https://")); return; }
    const btn = document.getElementById("gat-link-submit");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("teacher_links").insert({
            school_id: schoolCtx.schoolId, owner_id: schoolCtx.memberId,
            label, url, icon: "fa-circle-play", shared: true, space: "gat",
        });
        if(error) throw error;
        labelEl.value = ""; urlEl.value = "";
        loadGatResources();
    }catch(e){
        console.error("[خُطى] تعذّرت إضافة الرابط:", e);
        showToast(/LINKS_LIMIT_REACHED/.test((e && e.message) || "")
            ? gatL("وصلت للحد الأقصى: ٤٠ رابطاً في مساحة القدرات. احذف رابطاً قديماً.", "Limit reached (40).")
            : schoolError(e, gatL("إضافة الرابط", "adding the link")));
    }finally{ schoolBusy(btn, false); }
}

async function uploadGatFile(){
    const titleEl = document.getElementById("gat-file-title"), fileEl = document.getElementById("gat-file-input");
    const title = (titleEl.value || "").trim();
    const file = fileEl.files && fileEl.files[0];
    if(title.length < 2){ showToast(gatL("اكتب عنواناً للملف", "Enter a title")); return; }
    if(!file){ showToast(gatL("اختر ملفاً", "Pick a file")); return; }
    if(!/^(application\/pdf|image\/)/.test(file.type || "")){ showToast(gatL("PDF أو صورة فقط", "PDF or image only")); return; }
    const max = (typeof MAX_FILE_BYTES !== "undefined") ? MAX_FILE_BYTES : 10 * 1048576;
    if(file.size > max){ showToast(gatL(`الملف أكبر من ${Math.round(max / 1048576)} ميجا`, "File too large")); return; }
    if(typeof schoolStorageAllows === "function" && !(await schoolStorageAllows(file.size))) return;

    const btn = document.getElementById("gat-file-submit");
    schoolBusy(btn, true);
    let storagePath = null;
    try{
        const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
        const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        storagePath = `${schoolCtx.schoolId}/${schoolCtx.memberId}/${rand}.${ext}`;
        const { error: upErr } = await sb.storage.from("teacher-files")
            .upload(storagePath, file, { upsert:false, contentType: file.type || undefined });
        if(upErr) throw upErr;
        const { error } = await sb.from("teacher_files").insert({
            school_id: schoolCtx.schoolId, owner_id: schoolCtx.memberId, title,
            storage_path: storagePath, size_bytes: file.size, shared: true, space: "gat",
        });
        if(error) throw error;
        storagePath = null;
        titleEl.value = ""; fileEl.value = "";
        showToast(gatL("تم الرفع ✅", "Uploaded ✅"));
        loadGatResources();
    }catch(e){
        console.error("[خُطى] تعذّر رفع ملف القدرات:", e);
        // لا ملف يتيم في المخزن إن فشل حفظ سجلّه (نفس مبدأ uploadTeacherFile)
        if(storagePath){ try{ await sb.storage.from("teacher-files").remove([storagePath]); }catch(err){} }
        showSchoolError(e, gatL("رفع الملف", "the upload"));
    }finally{ schoolBusy(btn, false); }
}

async function deleteGatFile(id){
    if(!confirm(gatL("حذف هذا الملف نهائياً؟", "Delete this file?"))) return;
    try{
        const { data } = await sb.from("teacher_files").select("storage_path").eq("id", id).maybeSingle();
        const { error } = await sb.from("teacher_files").delete().eq("id", id);
        if(error) throw error;
        if(data && data.storage_path){ try{ await sb.storage.from("teacher-files").remove([data.storage_path]); }catch(e){} }
        loadGatResources();
    }catch(e){ console.error("[خُطى] تعذّر الحذف:", e); showSchoolError(e, gatL("الحذف", "the delete")); }
}

async function deleteGatLink(id){
    if(!confirm(gatL("حذف هذا الرابط؟", "Delete this link?"))) return;
    try{
        const { error } = await sb.from("teacher_links").delete().eq("id", id);
        if(error) throw error;
        loadGatResources();
    }catch(e){ console.error("[خُطى] تعذّر الحذف:", e); showSchoolError(e, gatL("الحذف", "the delete")); }
}

/* اختبار التدريب لا يُرسل لفصول: نشره = وصوله لكل طلاب المدرسة (exam_is_assigned_to_me
   في القاعدة تعدّ التدريب المنشور مُسنَداً للجميع — sql/PHASE6_FIXES.sql). */
async function publishPractice(id, on){
    if(!sb || !schoolCtx) return;
    if(on && !confirm(gatL("سيصل هذا التدريب لكل طلاب المدرسة. أنشره؟", "Publish to every student in the school?"))) return;
    try{
        const { error } = await sb.from("teacher_exams").update({ published: !!on }).eq("id", id);
        if(error) throw error;
        showToast(on ? gatL("نُشر لكل طلاب المدرسة ✅", "Published ✅") : gatL("أُوقف النشر", "Unpublished"));
        if(typeof loadTeacherExams === "function") loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر نشر التدريب:", e);
        showSchoolError(e, gatL("النشر", "publishing"));
    }
}
