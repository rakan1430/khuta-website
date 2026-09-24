/* ============================================================
   34) إعداد المدرسة — روابط الانضمام، والمراحل، والمواد (للمدير)
   ------------------------------------------------------------
   الأساس لتعدّد المدارس: لكل مدرسة مراحلها (ثانوي، متوسط، ابتدائي، أو ما
   تحدّده) وموادّها، ورابطا انضمام خاصّان بها. التخزين في school_grades
   وschool_subjects (sql/PHASE0_FOUNDATION.sql)، والكتابة تحرسها سياسات
   RLS: مدير المدرسة نفسها وبدخول Google — لا هذا الملف.

   ⚠️ ترتيب المراحل ليس شكلياً: promote_school_year ترقّي كل مرحلة للتي
   تليها في هذا الترتيب، وتُخرّج الأخيرة. ولذلك يُقال للمدير صراحةً.
   ============================================================ */

let schoolSlugCache = null;

function ssLabel(ar, en){ return currentLang === "ar" ? ar : en; }

async function mySchoolSlug(){
    if(schoolSlugCache) return schoolSlugCache;
    if(!sb || !schoolCtx) return null;
    try{
        const { data, error } = await sb.from("schools").select("slug").eq("id", schoolCtx.schoolId).maybeSingle();
        if(error) throw error;
        schoolSlugCache = (data && data.slug) || null;
    }catch(e){ console.warn("[خُطى] تعذّر قراءة معرّف المدرسة:", e); }
    return schoolSlugCache;
}

/** رابط الانضمام لمدرسة بعينها — يُستعمل هنا وفي لوحة المالك. */
function schoolJoinLink(slug, role){
    return `${location.origin}/?school=${encodeURIComponent(slug)}&apply=${role}`;
}

async function copySchoolLink(url){
    try{
        await navigator.clipboard.writeText(url);
        showToast(ssLabel("نُسخ الرابط ✅", "Link copied ✅"));
    }catch(e){
        // المتصفّحات تمنع النسخ خارج HTTPS أو بلا إذن — نعرض الرابط ليُنسخ يدوياً
        prompt(ssLabel("انسخ الرابط:", "Copy the link:"), url);
    }
}

function joinLinksHtml(slug){
    if(!slug) return "";
    const row = (role, ar, en) => {
        const url = schoolJoinLink(slug, role);
        return `<div class="member-row">
            <div style="min-width:0;">
                <b>${ssLabel(ar, en)}</b>
                <div class="card-sub" style="direction:ltr; text-align:start; font-family:'IBM Plex Mono',monospace; font-size:12px; overflow-wrap:anywhere;">${escapeHtml(url)}</div>
            </div>
            <button type="button" class="btn btn-outline btn-sm" data-copy="${escapeHtml(url)}" onclick="copySchoolLink(this.dataset.copy)">
                <i class="fa-solid fa-copy"></i> ${ssLabel("نسخ", "Copy")}</button>
        </div>`;
    };
    return row("student", "رابط انضمام الطلاب", "Student join link")
         + row("teacher", "رابط انضمام المعلّمين", "Teacher join link");
}

const ssOpenSecs = new Set();   // أقسام الإعداد التي فتحها المدير (تبقى مفتوحة بعد إعادة الرسم)

async function renderSchoolSettingsAdmin(){
    const box = document.getElementById("school-settings-admin");
    if(!box || !schoolCtx || schoolCtx.role !== "admin") return;
    const slug = await mySchoolSlug();
    const grades = schoolGradesList();
    const subjects = schoolSubjectsList(true);

    /* ⚠️ الأقسام الثلاثة مطويّة افتراضياً (قول المالك: «المواد كثيرة ومرصوصة ولا
       يحتاج أن يراها المدير في كل مرة»). ونحفظ ما فتحه المدير عبر إعادة الرسم —
       كل تعديل مادة يعيد رسم البطاقة، ولو طُويت عند كل تعديل لكان أسوأ من قبل. */
    box.querySelectorAll("details.ss-sec[open]").forEach(d => ssOpenSecs.add(d.dataset.sec));
    box.querySelectorAll("details.ss-sec:not([open])").forEach(d => ssOpenSecs.delete(d.dataset.sec));
    const openAttr = sec => ssOpenSecs.has(sec) ? "open" : "";
    const count = n => `<span class="pill">${n}</span>`;

    box.innerHTML = `
        <details class="ss-sec" data-sec="links" ${openAttr("links")}>
        <summary class="ss-head"><i class="fa-solid fa-link"></i> ${ssLabel("روابط الانضمام", "Join links")}</summary>
        <p class="hint" style="margin-bottom:8px;">${ssLabel(
            "وزّعها على طلاب مدرستك ومعلّميها. من يفتحها يرسل طلب انضمام يصلك هنا.",
            "Share them with your students and teachers. Requests arrive here.")}</p>
        ${joinLinksHtml(slug)}
        </details>

        <details class="ss-sec" data-sec="grades" ${openAttr("grades")}>
        <summary class="ss-head"><i class="fa-solid fa-layer-group"></i> ${ssLabel("المراحل", "Grades")} ${count(grades.length)}</summary>
        <p class="hint" style="margin-bottom:8px;">${ssLabel(
            "الترتيب يحدّد الترقية آخر السنة: كل مرحلة تصعد للتي تليها، والأخيرة تتخرّج.",
            "Order drives the year-end promotion: each grade moves to the next; the last graduates.")}</p>
        <div id="ss-grades">${grades.map((g, i) => `
            <div class="member-row">
                <input type="text" class="ss-input" maxlength="40" value="${escapeHtml(g.label_ar)}"
                       aria-label="${ssLabel("اسم المرحلة", "Grade name")}"
                       data-code="${escapeHtml(g.code)}" onchange="renameSchoolGrade(this.dataset.code, this.value)">
                <div class="sfile-actions">
                    <button type="button" class="btn-ghost btn-sm" title="${ssLabel("أعلى", "Up")}" ${i === 0 ? "disabled" : ""}
                            data-code="${escapeHtml(g.code)}" onclick="moveSchoolGrade(this.dataset.code, -1)"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="btn-ghost btn-sm" title="${ssLabel("أسفل", "Down")}" ${i === grades.length - 1 ? "disabled" : ""}
                            data-code="${escapeHtml(g.code)}" onclick="moveSchoolGrade(this.dataset.code, 1)"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="btn-ghost btn-sm" title="${ssLabel("حذف", "Delete")}"
                            data-code="${escapeHtml(g.code)}" onclick="deleteSchoolGrade(this.dataset.code)"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join("")}</div>
        <div class="input-row" style="grid-template-columns:1fr auto; margin-top:8px;">
            <input type="text" id="ss-new-grade" maxlength="40" placeholder="${ssLabel("مرحلة جديدة، مثل: رابع ابتدائي", "New grade")}">
            <button type="button" class="btn btn-sm acc-btn" onclick="addSchoolGrade()"><i class="fa-solid fa-plus"></i> ${ssLabel("إضافة", "Add")}</button>
        </div>
        </details>

        <details class="ss-sec" data-sec="subjects" ${openAttr("subjects")}>
        <summary class="ss-head"><i class="fa-solid fa-book"></i> ${ssLabel("المواد", "Subjects")} ${count(subjects.length)}</summary>
        <p class="hint" style="margin-bottom:8px;">${ssLabel(
            "منها يُختار ما يدرّسه كل معلّم في كل فصل. المادة المُعطَّلة تختفي من القوائم ويبقى ما سبق ربطه بها.",
            "Teachers are assigned subjects from this list. Disabled subjects disappear from lists but keep past links.")}</p>
        <div id="ss-subjects">${subjects.length ? subjects.map(s => `
            <div class="member-row${s.active ? "" : " is-off"}">
                <input type="text" class="ss-input" maxlength="60" value="${escapeHtml(s.name_ar)}"
                       aria-label="${ssLabel("اسم المادة", "Subject name")}"
                       data-id="${escapeHtml(s.id)}" onchange="renameSchoolSubject(this.dataset.id, this.value)">
                <div class="sfile-actions">
                    <button type="button" class="btn-ghost btn-sm" data-id="${escapeHtml(s.id)}"
                            onclick="toggleSchoolSubject(this.dataset.id, ${s.active ? "false" : "true"})">
                        ${s.active ? ssLabel("تعطيل", "Disable") : ssLabel("تفعيل", "Enable")}</button>
                    <button type="button" class="btn-ghost btn-sm" title="${ssLabel("حذف", "Delete")}"
                            data-id="${escapeHtml(s.id)}" onclick="deleteSchoolSubject(this.dataset.id)"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`).join("") : `<p class="card-sub">${ssLabel("لا مواد بعد.", "No subjects yet.")}</p>`}</div>
        <div class="input-row" style="grid-template-columns:1fr auto; margin-top:8px;">
            <input type="text" id="ss-new-subject" maxlength="60" placeholder="${ssLabel("مادة جديدة، مثل: الكيمياء", "New subject")}">
            <button type="button" class="btn btn-sm acc-btn" onclick="addSchoolSubject()"><i class="fa-solid fa-plus"></i> ${ssLabel("إضافة", "Add")}</button>
        </div>
        </details>`;
}

/** بعد أي تعديل: تُعاد قراءة الإعدادات من القاعدة، فتتحدّث كل القوائم معاً. */
async function reloadSchoolSettingsAdmin(){
    if(schoolCtx) await loadSchoolSettings(schoolCtx.schoolId);
    renderSchoolSettingsAdmin();
    if(typeof loadAdminClasses === "function") loadAdminClasses();
}

/* ---------- المراحل ---------- */

async function addSchoolGrade(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    const el = document.getElementById("ss-new-grade");
    const label = ((el && el.value) || "").trim();
    if(label.length < 2){ showToast(ssLabel("اكتب اسم المرحلة", "Enter the grade name")); return; }
    const maxSort = schoolGradesList().reduce((m, g) => Math.max(m, g.sort || 0), 0);
    try{
        // الرمز لا يُرسل: يولّده المُطلِق في القاعدة (trg_school_grade_guard)
        const { error } = await sb.from("school_grades").insert({
            school_id: schoolCtx.schoolId, label_ar: label, sort_order: maxSort + 1,
        });
        if(error) throw error;
        if(el) el.value = "";
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("إضافة المرحلة", "adding the grade")); }
}

async function renameSchoolGrade(code, value){
    if(!sb || !schoolCtx) return;
    const label = (value || "").trim();
    if(label.length < 2){ showToast(ssLabel("اسم المرحلة قصير جداً", "Name too short")); renderSchoolSettingsAdmin(); return; }
    try{
        const { error } = await sb.from("school_grades").update({ label_ar: label })
            .eq("school_id", schoolCtx.schoolId).eq("code", code);
        if(error) throw error;
        await reloadSchoolSettingsAdmin();
        showToast(ssLabel("حُفظ ✅", "Saved ✅"));
    }catch(e){ showSchoolError(e, ssLabel("تعديل المرحلة", "renaming the grade")); }
}

async function moveSchoolGrade(code, dir){
    if(!sb || !schoolCtx) return;
    const list = schoolGradesList();
    const i = list.findIndex(g => g.code === code);
    const j = i + dir;
    if(i < 0 || j < 0 || j >= list.length) return;
    /* ⚠️ نعيد ترقيم الكل بدل تبديل قيمتين: مراحل بنفس sort_order (من
       إدخال قديم) كانت ستبقى متساوية بعد التبديل فلا يتغيّر شيء. */
    const reordered = [...list];
    [reordered[i], reordered[j]] = [reordered[j], reordered[i]];
    try{
        for(let k = 0; k < reordered.length; k++){
            const { error } = await sb.from("school_grades").update({ sort_order: k + 1 })
                .eq("school_id", schoolCtx.schoolId).eq("code", reordered[k].code);
            if(error) throw error;
        }
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("ترتيب المراحل", "reordering grades")); }
}

async function deleteSchoolGrade(code){
    if(!sb || !schoolCtx) return;
    if(!confirm(ssLabel("حذف هذه المرحلة؟ لا يمكن حذف مرحلة فيها طلاب أو فصول.",
                        "Delete this grade? A grade with students or classes can't be deleted."))) return;
    try{
        const { error } = await sb.from("school_grades").delete()
            .eq("school_id", schoolCtx.schoolId).eq("code", code);
        if(error) throw error;
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("حذف المرحلة", "deleting the grade")); }
}

/* ---------- المواد ---------- */

async function addSchoolSubject(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    const el = document.getElementById("ss-new-subject");
    const name = ((el && el.value) || "").trim();
    if(name.length < 2){ showToast(ssLabel("اكتب اسم المادة", "Enter the subject name")); return; }
    const maxSort = schoolSubjectsList(true).reduce((m, s) => Math.max(m, s.sort || 0), 0);
    try{
        const { error } = await sb.from("school_subjects").insert({
            school_id: schoolCtx.schoolId, name_ar: name, sort_order: maxSort + 1,
        });
        if(error) throw error;
        if(el) el.value = "";
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("إضافة المادة", "adding the subject")); }
}

async function renameSchoolSubject(id, value){
    if(!sb || !schoolCtx) return;
    const name = (value || "").trim();
    if(name.length < 2){ showToast(ssLabel("اسم المادة قصير جداً", "Name too short")); renderSchoolSettingsAdmin(); return; }
    try{
        const { error } = await sb.from("school_subjects").update({ name_ar: name }).eq("id", id);
        if(error) throw error;
        await reloadSchoolSettingsAdmin();
        showToast(ssLabel("حُفظ ✅", "Saved ✅"));
    }catch(e){ showSchoolError(e, ssLabel("تعديل المادة", "renaming the subject")); }
}

async function toggleSchoolSubject(id, active){
    if(!sb || !schoolCtx) return;
    try{
        const { error } = await sb.from("school_subjects").update({ active }).eq("id", id);
        if(error) throw error;
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("تعديل المادة", "updating the subject")); }
}

async function deleteSchoolSubject(id){
    if(!sb || !schoolCtx) return;
    if(!confirm(ssLabel(
        "حذف المادة نهائياً؟ الأفضل غالباً «تعطيل» — الحذف يفكّ ربطها بإسنادات المعلّمين (يبقى اسمها مكتوباً فيها).",
        "Delete permanently? Disabling is usually better.")) ) return;
    try{
        const { error } = await sb.from("school_subjects").delete().eq("id", id);
        if(error) throw error;
        await reloadSchoolSettingsAdmin();
    }catch(e){ showSchoolError(e, ssLabel("حذف المادة", "deleting the subject")); }
}
