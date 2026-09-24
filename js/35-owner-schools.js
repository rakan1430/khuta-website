/* ============================================================
   35) لوحة المالك — إدارة المدارس
   ------------------------------------------------------------
   طلب المالك: «كل شي سيكون ظاهر لي في لوحة التحكم لإنشاء مدرسة جديدة
   وتعيين مديرها، أو حدود كل مدرسة في التخزين واستخدام الذكاء الاصطناعي».

   تُفتح من «أدوات المشرف» (جدول app_admins). والحماية في القاعدة لا هنا:
   كل دالّة owner_* تبدأ بـis_app_admin()، والتعديل يشترط دخول Google.
   فحتى لو استدعى أحدٌ هذه الدوالّ من وحدة التحكّم يُرفض — NOT_OWNER.

   الحدود فارغة = بلا حد. والذكاء الاصطناعي حدٌّ يومي **لكل عضو** في
   المدرسة، يحلّ محلّ الحد الافتراضي (١٠) لكل استخدامه في خُطى كلها.
   ============================================================ */

let ownerSchools = [];

function owLabel(ar, en){ return currentLang === "ar" ? ar : en; }

function ownerError(e){
    const raw = [e && e.message, e && e.details, e && e.hint].filter(Boolean).join(" | ");
    const map = [
        ["NOT_OWNER",             "هذه اللوحة للمالك وحده.", "Owner only."],
        ["BAD_SLUG",              "المعرّف في الرابط: حروف إنجليزية صغيرة وأرقام وشرطة فقط، من ٣ إلى ٤٠ حرفاً.", "Slug: lowercase letters, digits and dashes, 3–40 chars."],
        ["SLUG_TAKEN",            "هذا المعرّف مستعمل لمدرسة أخرى — اختر غيره.", "This slug is taken."],
        ["BAD_NAME",              "اسم المدرسة قصير جداً.", "School name too short."],
        ["BAD_EMAIL",             "بريد المدير غير صحيح.", "Invalid admin email."],
        ["BAD_STAGE",             "نوع المدرسة غير معروف.", "Unknown school type."],
        ["BAD_LIMIT",             "الحدود أرقام موجبة، أو اتركها فارغة لتكون بلا حد.", "Limits must be positive, or empty for none."],
        ["EMAIL_IN_OTHER_SCHOOL", "هذا البريد عضو نشط في مدرسة أخرى. الحساب الواحد يتبع مدرسة واحدة — استعمل بريداً آخر أو أوقف عضويته هناك.", "This email is active in another school."],
        ["NOT_FOUND",             "المدرسة غير موجودة — حدّث القائمة.", "School not found."],
    ];
    for(const [code, ar, en] of map){ if(raw.includes(code)) return owLabel(ar, en); }
    return (typeof schoolError === "function") ? schoolError(e, owLabel("العملية", "the action")) : owLabel("تعذّرت العملية.", "Failed.");
}

function ensureOwnerSchoolsOverlay(){
    let ov = document.getElementById("owner-schools-overlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.id = "owner-schools-overlay";
    ov.className = "overlay-screen";
    ov.style.display = "none";
    ov.style.zIndex = "5100";
    document.body.appendChild(ov);
    return ov;
}

async function openOwnerSchools(){
    if(typeof isAdmin !== "undefined" && !isAdmin) return;
    const admin = document.getElementById("admin-overlay");
    if(admin) admin.style.display = "none";
    const ov = ensureOwnerSchoolsOverlay();
    ov.style.display = "flex";
    ov.innerHTML = `<div class="wizard-card owner-card"><p class="card-sub">${owLabel("جارٍ التحميل…", "Loading…")}</p></div>`;
    await loadOwnerSchools();
}

function closeOwnerSchools(){
    const ov = document.getElementById("owner-schools-overlay");
    if(ov){ ov.style.display = "none"; ov.innerHTML = ""; }
}

async function loadOwnerSchools(){
    if(!sb) return;
    try{
        const { data, error } = await sb.rpc("owner_list_schools");
        if(error) throw error;
        ownerSchools = Array.isArray(data) ? data : [];
        renderOwnerSchools();
    }catch(e){
        const ov = ensureOwnerSchoolsOverlay();
        ov.innerHTML = `<div class="wizard-card owner-card">
            <p class="card-sub">${escapeHtml(ownerError(e))}</p>
            <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:14px;" onclick="closeOwnerSchools()">${owLabel("إغلاق", "Close")}</button>
        </div>`;
    }
}

function owMB(bytes){
    const mb = (Number(bytes) || 0) / 1048576;
    return mb < 10 ? mb.toFixed(1) : String(Math.round(mb));
}

/** «٣٠ / ١٠٠» أو «٣٠ / بلا حد» — مع تمييز ما تجاوز ٩٠٪. */
function owUsage(used, limit, unit){
    const u = `${used}${unit ? " " + unit : ""}`;
    if(limit === null || limit === undefined) return `${escapeHtml(u)} <span class="card-sub">/ ${owLabel("بلا حد", "no limit")}</span>`;
    const pct = limit > 0 ? Number(String(used).replace(/[^0-9.]/g, "")) / limit : 1;
    return `<span class="${pct >= 0.9 ? "ow-warn" : ""}">${escapeHtml(u)}</span> <span class="card-sub">/ ${escapeHtml(String(limit))}${unit ? " " + unit : ""}</span>`;
}

function renderOwnerSchools(){
    const ov = ensureOwnerSchoolsOverlay();
    const list = ownerSchools;
    ov.innerHTML = `
    <div class="wizard-card owner-card">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:6px;">
            <h2 style="margin:0;"><i class="fa-solid fa-school"></i> ${owLabel("إدارة المدارس", "Schools")}</h2>
            <button type="button" class="btn btn-outline btn-sm" onclick="closeOwnerSchools()">${owLabel("إغلاق", "Close")}</button>
        </div>
        <p class="card-sub" style="margin-bottom:16px;">${owLabel(
            "كل مدرسة على المنصّة، باستهلاكها وحدودها. الحدّ الفارغ = بلا حد.",
            "Every school on the platform with usage and limits. Empty limit = none.")}</p>

        ${list.map(s => ownerSchoolCard(s)).join("") || `<p class="card-sub">${owLabel("لا مدارس بعد.", "No schools yet.")}</p>`}

        <div class="owner-school">
            <h3 style="margin-bottom:10px;"><i class="fa-solid fa-plus"></i> ${owLabel("مدرسة جديدة", "New school")}</h3>
            <div class="input-row">
                <div class="form-group"><label>${owLabel("اسم المدرسة", "School name")}</label>
                    <input type="text" id="ow-new-name" maxlength="120" placeholder="${owLabel("مدارس … — فرع …", "School name")}"></div>
                <div class="form-group"><label>${owLabel("الاسم بالإنجليزية (اختياري)", "English name (optional)")}</label>
                    <input type="text" id="ow-new-name-en" maxlength="120" dir="ltr"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>${owLabel("المعرّف في الرابط", "Link slug")}</label>
                    <input type="text" id="ow-new-slug" maxlength="40" dir="ltr" placeholder="almalqa" oninput="owPreviewSlug()">
                    <p class="hint" id="ow-slug-preview" style="direction:ltr; text-align:start;"></p></div>
                <div class="form-group"><label>${owLabel("نوع المدرسة", "School type")}</label>
                    <select id="ow-new-stage">
                        <option value="secondary">${owLabel("ثانوي (٣ مراحل)", "Secondary (3 grades)")}</option>
                        <option value="middle">${owLabel("متوسط (٣ مراحل)", "Middle (3 grades)")}</option>
                        <option value="primary">${owLabel("ابتدائي (٦ مراحل)", "Primary (6 grades)")}</option>
                        <option value="custom">${owLabel("مخصّص (يضيف المدير مراحله)", "Custom")}</option>
                    </select></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>${owLabel("بريد المدير (Google)", "Admin email (Google)")}</label>
                    <input type="email" id="ow-new-admin-email" maxlength="120" dir="ltr" placeholder="admin@school.edu.sa"></div>
                <div class="form-group"><label>${owLabel("اسم المدير", "Admin name")}</label>
                    <input type="text" id="ow-new-admin-name" maxlength="80"></div>
            </div>
            <p class="hint">${owLabel(
                "يدخل المدير بحساب Google بهذا البريد نفسه فتظهر له لوحة المدرسة تلقائياً. وتُزرَع المراحل حسب النوع ومواد افتراضية يعدّلها المدير.",
                "The admin signs in with Google using this email and gets the school panel automatically.")}</p>
            <button type="button" id="ow-create-btn" class="btn acc-btn" style="margin-top:10px;" onclick="ownerCreateSchool()">
                <i class="fa-solid fa-plus"></i> ${owLabel("إنشاء المدرسة", "Create school")}</button>
        </div>
    </div>`;
    owPreviewSlug();
}

function ownerSchoolCard(s){
    const id = escapeHtml(s.id);
    const admins = (s.admins || []).map(a => `
        <div class="card-sub" style="direction:ltr; text-align:start;">
            ${escapeHtml(a.email || "")} — ${escapeHtml(a.name || "")}
            ${a.linked ? "✅" : `<span title="${owLabel("لم يسجّل دخوله بعد", "Not signed in yet")}">⏳</span>`}
        </div>`).join("") || `<p class="card-sub ow-warn">${owLabel("⚠️ بلا مدير", "⚠️ No admin")}</p>`;
    const slug = s.slug || "";
    return `
    <div class="owner-school">
        <div style="display:flex; justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div>
                <h3 style="margin:0;">${escapeHtml(s.name_ar || "")}</h3>
                <span class="card-sub" style="direction:ltr;">${escapeHtml(slug)}</span>
            </div>
        </div>

        <div class="owner-stats">
            <div><b>${owUsage(Number(s.students) || 0, s.max_students)}</b><span>${owLabel("طلاب", "students")}</span></div>
            <div><b>${Number(s.teachers) || 0}</b><span>${owLabel("معلّمون", "teachers")}</span></div>
            <div><b>${owUsage(owMB(s.storage_bytes), s.storage_limit_mb, owLabel("ميجا", "MB"))}</b><span>${owLabel("التخزين", "storage")}</span></div>
            <div><b>${Number(s.ai_today) || 0}</b><span>${owLabel("ذكاء اصطناعي اليوم", "AI today")}${
                s.ai_daily_per_member != null ? ` · ${owLabel("حدّ العضو", "per member")} ${escapeHtml(String(s.ai_daily_per_member))}` : ""}</span></div>
        </div>

        <details style="margin-top:10px;">
            <summary><b>${owLabel("المديرون وروابط الانضمام", "Admins & join links")}</b></summary>
            <div style="margin-top:8px;">${admins}</div>
            <div class="ow-add-admin">
                <input type="email" id="ow-admin-email-${id}" dir="ltr" placeholder="${owLabel("بريد مدير إضافي", "Additional admin email")}">
                <input type="text" id="ow-admin-name-${id}" placeholder="${owLabel("اسمه", "Name")}">
                <button type="button" class="btn btn-sm acc-btn" data-id="${id}" onclick="ownerAddAdmin(this.dataset.id)">${owLabel("إضافة", "Add")}</button>
            </div>
            <div style="margin-top:8px;">${(typeof joinLinksHtml === "function" && slug) ? joinLinksHtml(slug) : ""}</div>
        </details>

        <details style="margin-top:8px;">
            <summary><b>${owLabel("الاسم والحدود", "Name & limits")}</b></summary>
            <div class="input-row" style="margin-top:8px;">
                <div class="form-group"><label>${owLabel("الاسم", "Name")}</label>
                    <input type="text" id="ow-name-${id}" maxlength="120" value="${escapeHtml(s.name_ar || "")}"></div>
                <div class="form-group"><label>${owLabel("بالإنجليزية", "English")}</label>
                    <input type="text" id="ow-name-en-${id}" maxlength="120" dir="ltr" value="${escapeHtml(s.name_en || "")}"></div>
            </div>
            <div class="input-row">
                <div class="form-group"><label>${owLabel("أقصى عدد للطلاب", "Max students")}</label>
                    <input type="number" min="0" id="ow-max-${id}" value="${s.max_students ?? ""}" placeholder="${owLabel("بلا حد", "no limit")}"></div>
                <div class="form-group"><label>${owLabel("التخزين (ميجا)", "Storage (MB)")}</label>
                    <input type="number" min="0" id="ow-storage-${id}" value="${s.storage_limit_mb ?? ""}" placeholder="${owLabel("بلا حد", "no limit")}"></div>
                <div class="form-group"><label>${owLabel("ذكاء اصطناعي يومياً لكل عضو", "Daily AI per member")}</label>
                    <input type="number" min="0" id="ow-ai-${id}" value="${s.ai_daily_per_member ?? ""}" placeholder="${owLabel("الافتراضي ١٠", "default 10")}"></div>
            </div>
            <p class="hint">${owLabel(
                "حدّ الذكاء يحلّ محلّ الافتراضي لكل استخدام العضو في خُطى كلها (والأسبوعي خمسة أضعافه). وصفر = لا ذكاء اصطناعي لأعضائها.",
                "Replaces the default for all of the member's AI use (weekly = 5×). Zero disables AI for its members.")}</p>
            <button type="button" class="btn btn-sm acc-btn" data-id="${id}" onclick="ownerSaveSchool(this.dataset.id)">
                <i class="fa-solid fa-floppy-disk"></i> ${owLabel("حفظ", "Save")}</button>
        </details>
    </div>`;
}

function owPreviewSlug(){
    const el = document.getElementById("ow-new-slug");
    const out = document.getElementById("ow-slug-preview");
    if(!el || !out) return;
    const v = (el.value || "").trim().toLowerCase();
    out.textContent = v ? `${location.origin}/?school=${v}&apply=student` : "";
}

/** رقم موجب أو null (فارغ = بلا حد). NaN يُرفض صراحةً لا يتحوّل لصفر. */
function owIntOrNull(id){
    const el = document.getElementById(id);
    const raw = ((el && el.value) || "").trim();
    if(raw === "") return null;
    const n = Number(raw);
    return (Number.isInteger(n) && n >= 0) ? n : NaN;
}

async function ownerCreateSchool(){
    if(!sb) return;
    const v = id => ((document.getElementById(id) || {}).value || "").trim();
    const btn = document.getElementById("ow-create-btn");
    if(btn){ btn.disabled = true; btn.style.opacity = ".6"; }
    try{
        const { error } = await sb.rpc("owner_create_school", {
            p_slug: v("ow-new-slug").toLowerCase(), p_name_ar: v("ow-new-name"), p_name_en: v("ow-new-name-en"),
            p_stage: v("ow-new-stage"), p_admin_email: v("ow-new-admin-email"), p_admin_name: v("ow-new-admin-name"),
        });
        if(error) throw error;
        showToast(owLabel("أُنشئت المدرسة ✅", "School created ✅"));
        await loadOwnerSchools();
    }catch(e){
        console.error("[خُطى] تعذّر إنشاء المدرسة:", e);
        showToast(ownerError(e));
    }finally{ if(btn){ btn.disabled = false; btn.style.opacity = ""; } }
}

async function ownerSaveSchool(id){
    if(!sb) return;
    const max = owIntOrNull(`ow-max-${id}`), storage = owIntOrNull(`ow-storage-${id}`), ai = owIntOrNull(`ow-ai-${id}`);
    if([max, storage, ai].some(x => Number.isNaN(x))){
        showToast(owLabel("الحدود أرقام صحيحة موجبة، أو اتركها فارغة.", "Limits must be whole positive numbers, or empty."));
        return;
    }
    try{
        const { error } = await sb.rpc("owner_update_school", {
            p_school: id,
            p_name_ar: ((document.getElementById(`ow-name-${id}`) || {}).value || "").trim(),
            p_name_en: ((document.getElementById(`ow-name-en-${id}`) || {}).value || "").trim(),
            p_max_students: max, p_storage_limit_mb: storage, p_ai_daily_per_member: ai,
        });
        if(error) throw error;
        showToast(owLabel("حُفظ ✅", "Saved ✅"));
        await loadOwnerSchools();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ المدرسة:", e);
        showToast(ownerError(e));
    }
}

async function ownerAddAdmin(id){
    if(!sb) return;
    const email = ((document.getElementById(`ow-admin-email-${id}`) || {}).value || "").trim();
    const name  = ((document.getElementById(`ow-admin-name-${id}`) || {}).value || "").trim();
    try{
        const { error } = await sb.rpc("owner_set_school_admin", { p_school: id, p_email: email, p_name: name });
        if(error) throw error;
        showToast(owLabel("أُضيف المدير ✅", "Admin added ✅"));
        await loadOwnerSchools();
    }catch(e){
        console.error("[خُطى] تعذّر إضافة المدير:", e);
        showToast(ownerError(e));
    }
}
