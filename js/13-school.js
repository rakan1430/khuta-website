/* ============================================================
   13) نسخة المدارس — العضوية والأدوار وطلبات الحسابات
   ------------------------------------------------------------
   يُحمَّل في كل النسخ لكنه لا يفعل شيئاً إطلاقاً إلا إن كانت النسخة مدرسة
   (hasFeature("school")). كل دالة هنا تبدأ بهذا الفحص، فوجود الملف لا يؤثر
   على خُطى بأي شكل.

   الفكرة الأساسية: الدور يأتي من قاعدة البيانات لا من المتصفح. ما نخزّنه هنا
   نسخة للعرض فقط — إخفاء زر لا يحمي شيئاً، سياسات RLS هي التي تحمي. لو زوّر
   أحد schoolCtx.role في أدوات المطوّر فستظهر له أزرار لا تعمل، ولن يقرأ ولا
   يكتب صفاً واحداً لا يملكه.
   ============================================================ */

let schoolCtx = null;      // { schoolId, memberId, role, fullName, grade, section }
let schoolIdCache = null;

/* معرّف المدرسة يُقرأ قبل تسجيل الدخول (لنعرف لأي مدرسة يُرسَل الطلب).
   عبر دالة SECURITY DEFINER لأن جدول schools نفسه محمي بـRLS. */
async function getSchoolId(){
    if(schoolIdCache) return schoolIdCache;
    if(!sb || !hasFeature("school")) return null;
    try{
        const { data } = await sb.rpc("school_id_by_slug", { p_slug: TENANT.id });
        schoolIdCache = data || null;
    }catch(e){ console.warn("[خُطى] تعذّر تحديد المدرسة:", e); }
    return schoolIdCache;
}

/* يُستدعى بعد كل تسجيل دخول ناجح. يحدد: هل هذا الشخص عضو في المدرسة؟ وبأي دور؟ */
async function loadSchoolContext(){
    if(!hasFeature("school") || !sb) return null;
    schoolCtx = null;
    try{
        const { data: { user } } = await sb.auth.getUser();
        if(!user || user.is_anonymous) return null;
        const { data, error } = await sb
            .from("school_members")
            .select("id, school_id, role, full_name, grade, section")
            .eq("uid", user.id)
            .eq("active", true)
            .maybeSingle();
        if(error) throw error;
        if(!data) return null;
        schoolCtx = {
            schoolId: data.school_id, memberId: data.id, role: data.role,
            fullName: data.full_name, grade: data.grade, section: data.section,
        };
    }catch(e){ console.warn("[خُطى] تعذّر تحميل عضوية المدرسة:", e); }
    return schoolCtx;
}

/* ============================================================
   بوابة الدخول: لا أحد يدخل بلا عضوية
   ------------------------------------------------------------
   حالة حقيقية يجب التعامل معها: شخص يسجّل دخوله بحساب Google صحيح تماماً،
   لكنه ليس عضواً في المدرسة. هو مُسجَّل دخول من ناحية Supabase، ولو تركناه
   لرأى واجهة فارغة بلا تفسير. نعرض له شاشة واضحة وزر تقديم طلب.
   ============================================================ */
function showSchoolGate(){
    const gate = document.getElementById("school-gate-overlay");
    if(gate) gate.style.display = "flex";
    const login = document.getElementById("login-overlay");
    if(login) login.style.display = "none";
}

function hideSchoolGate(){
    const gate = document.getElementById("school-gate-overlay");
    if(gate) gate.style.display = "none";
}

async function schoolGateSignOut(){
    hideSchoolGate();
    if(sb){ try{ await sb.auth.signOut(); }catch(e){} }
    clearSession && clearSession();
    location.reload();
}

/* ============================================================
   نموذج طلب حساب — لمن لا حساب له
   ============================================================ */
function openAccountRequest(){
    const ov = document.getElementById("account-request-overlay");
    if(!ov) return;
    ov.style.display = "flex";
    const done = document.getElementById("areq-done");
    const form = document.getElementById("areq-form");
    if(done) done.style.display = "none";
    if(form) form.style.display = "block";

    // تفريغ الحقول عند كل فتح. ليس ترتيباً شكلياً: حقل الفخ بالذات لو بقي
    // ممتلئاً من محاولة سابقة (أو ملأه الإكمال التلقائي للمتصفح) لصار كل
    // إرسال لاحق يُرفض بصمت ولا يفهم صاحبه لماذا لا يصل طلبه أبداً.
    ["areq-name","areq-section","areq-contact","areq-note","areq-trap"].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = "";
    });
    const roleEl = document.getElementById("areq-role");
    if(roleEl) roleEl.value = "student";
    onRequestRoleChange();
}

function closeAccountRequest(){
    const ov = document.getElementById("account-request-overlay");
    if(ov) ov.style.display = "none";
}

// حقول الصف تخصّ الطالب وحده — إظهارها للمدرّس يربك ويجمع بيانات لا لزوم لها
function onRequestRoleChange(){
    const role = (document.getElementById("areq-role") || {}).value;
    const box = document.getElementById("areq-student-fields");
    if(box) box.style.display = role === "student" ? "block" : "none";
}

async function submitAccountRequest(){
    if(!sb){ showToast(currentLang==='ar' ? "الخدمة غير متاحة حالياً" : "Service unavailable"); return; }

    const nameEl = document.getElementById("areq-name");
    const name = (nameEl.value || "").trim();
    if(name.length < 3){
        showToast(currentLang==='ar' ? "اكتب اسمك الكامل" : "Enter your full name");
        nameEl.focus(); return;
    }
    // فخ للسيل الآلي: حقل مخفي بصرياً لا يملؤه إنسان أبداً
    const trap = document.getElementById("areq-trap");
    if(trap && trap.value){ closeAccountRequest(); return; }

    const schoolId = await getSchoolId();
    if(!schoolId){
        showToast(currentLang==='ar' ? "تعذّر تحديد المدرسة — حدّث الصفحة" : "Could not identify the school");
        return;
    }

    const role = document.getElementById("areq-role").value;
    const payload = {
        school_id: schoolId,
        full_name: name,
        role_wanted: role === "teacher" ? "teacher" : "student",
        grade: role === "student" ? (document.getElementById("areq-grade").value || null) : null,
        section: role === "student" ? ((document.getElementById("areq-section").value || "").trim() || null) : null,
        contact: (document.getElementById("areq-contact").value || "").trim() || null,
        note: (document.getElementById("areq-note").value || "").trim() || null,
    };

    const btn = document.getElementById("areq-submit");
    if(btn){ btn.disabled = true; btn.style.opacity = ".6"; }
    try{
        const { error } = await sb.from("account_requests").insert(payload);
        if(error) throw error;
        document.getElementById("areq-form").style.display = "none";
        document.getElementById("areq-done").style.display = "block";
    }catch(e){
        console.error("[خُطى] تعذّر إرسال الطلب:", e);
        showToast(currentLang==='ar' ? "تعذّر إرسال الطلب، حاول مرة أخرى" : "Could not send the request");
    }finally{
        if(btn){ btn.disabled = false; btn.style.opacity = ""; }
    }
}

/* ============================================================
   لوحة الإدارة — صندوق الطلبات وإدارة الأعضاء
   ============================================================ */
function schoolRoleLabel(role){
    const ar = { admin:"إدارة", teacher:"مدرّس", student:"طالب" };
    const en = { admin:"Admin", teacher:"Teacher", student:"Student" };
    return (currentLang==='ar' ? ar : en)[role] || role;
}

async function loadAccountRequests(){
    const box = document.getElementById("admin-requests-list");
    if(!box || !schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb
            .from("account_requests")
            .select("id, full_name, role_wanted, grade, section, contact, note, status, created_at")
            .eq("school_id", schoolCtx.schoolId)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(100);
        if(error) throw error;

        const count = (data || []).length;
        const badge = document.getElementById("admin-requests-count");
        if(badge){
            badge.textContent = count;
            badge.style.display = count ? "inline-flex" : "none";
        }
        if(!count){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا توجد طلبات جديدة.':'No new requests.'}</p>`;
            return;
        }
        box.innerHTML = data.map(r => {
            const when = new Date(r.created_at).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US');
            const cls = r.grade ? `${escapeHtml(r.grade)}${r.section ? " / " + escapeHtml(r.section) : ""}` : "—";
            return `
            <div class="areq-card">
                <div class="areq-head">
                    <div>
                        <b>${escapeHtml(r.full_name)}</b>
                        <span class="pill">${escapeHtml(schoolRoleLabel(r.role_wanted))}</span>
                    </div>
                    <span class="card-sub">${escapeHtml(when)}</span>
                </div>
                <div class="card-sub">${currentLang==='ar'?'الصف':'Class'}: ${cls}
                    ${r.contact ? ` · ${currentLang==='ar'?'للتواصل':'Contact'}: ${escapeHtml(r.contact)}` : ""}</div>
                ${r.note ? `<div class="uni-note" style="margin-top:6px;">${escapeHtml(r.note)}</div>` : ""}
                <div class="areq-actions">
                    <button type="button" class="btn btn-sm" onclick="approveRequest('${escapeHtml(r.id)}')">
                        <i class="fa-solid fa-check"></i> ${currentLang==='ar'?'قبول':'Approve'}</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="rejectRequest('${escapeHtml(r.id)}')">
                        <i class="fa-solid fa-xmark"></i> ${currentLang==='ar'?'رفض':'Reject'}</button>
                </div>
            </div>`;
        }).join("");
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الطلبات:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الطلبات.':'Could not load requests.'}</p>`;
    }
}

/* القبول لا يُنشئ حساب دخول — هذا مقصود ومهم:
   إنشاء مستخدم في Supabase يتطلب صلاحية إدارية لا يجوز أن تكون في المتصفح
   إطلاقاً. الإدارة تنشئ الحساب من لوحة Supabase (أو نضيف دالة Netlify لاحقاً)،
   وهذه الخطوة تسجّل الموافقة وتحدّد الدور والصف مسبقاً. */
async function approveRequest(id){
    if(!schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    if(!confirm(currentLang==='ar' ? "قبول هذا الطلب؟" : "Approve this request?")) return;
    try{
        const { error } = await sb.from("account_requests")
            .update({ status:"approved", reviewed_by: schoolCtx.memberId, reviewed_at: new Date().toISOString() })
            .eq("id", id);
        if(error) throw error;
        showToast(currentLang==='ar' ? "تم القبول ✅" : "Approved ✅");
        loadAccountRequests();
    }catch(e){
        console.error("[خُطى] تعذّر قبول الطلب:", e);
        showToast(currentLang==='ar' ? "تعذّر تنفيذ العملية" : "Action failed");
    }
}

async function rejectRequest(id){
    if(!schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    if(!confirm(currentLang==='ar' ? "رفض هذا الطلب؟" : "Reject this request?")) return;
    try{
        const { error } = await sb.from("account_requests")
            .update({ status:"rejected", reviewed_by: schoolCtx.memberId, reviewed_at: new Date().toISOString() })
            .eq("id", id);
        if(error) throw error;
        showToast(currentLang==='ar' ? "تم الرفض" : "Rejected");
        loadAccountRequests();
    }catch(e){
        console.error("[خُطى] تعذّر رفض الطلب:", e);
        showToast(currentLang==='ar' ? "تعذّر تنفيذ العملية" : "Action failed");
    }
}

async function loadSchoolMembers(){
    const box = document.getElementById("admin-members-list");
    if(!box || !schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb
            .from("school_members")
            .select("id, full_name, role, grade, section, active")
            .eq("school_id", schoolCtx.schoolId)
            .order("role").order("full_name")
            .limit(500);
        if(error) throw error;
        if(!data || !data.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'لا يوجد أعضاء بعد.':'No members yet.'}</p>`;
            return;
        }
        box.innerHTML = data.map(m => `
            <div class="member-row${m.active ? "" : " is-off"}">
                <div>
                    <b>${escapeHtml(m.full_name)}</b>
                    <span class="pill">${escapeHtml(schoolRoleLabel(m.role))}</span>
                    ${m.grade ? `<span class="card-sub"> · ${escapeHtml(m.grade)}${m.section ? "/" + escapeHtml(m.section) : ""}</span>` : ""}
                </div>
                <button type="button" class="btn btn-ghost btn-sm" onclick="toggleMemberActive('${escapeHtml(m.id)}', ${m.active ? "false" : "true"})">
                    ${m.active ? (currentLang==='ar'?'إيقاف':'Disable') : (currentLang==='ar'?'تفعيل':'Enable')}
                </button>
            </div>`).join("");
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الأعضاء:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الأعضاء.':'Could not load members.'}</p>`;
    }
}

/* الإيقاف بدل الحذف: حذف العضو يحذف معه ملفاته واختباراته ومحاولات طلابه
   (سلسلة on delete cascade). الإيقاف يمنع الدخول فوراً ويُبقي السجل. */
async function toggleMemberActive(id, makeActive){
    if(!schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    if(id === schoolCtx.memberId && !makeActive){
        showToast(currentLang==='ar' ? "لا يمكنك إيقاف حسابك أنت" : "You cannot disable your own account");
        return;
    }
    try{
        const { error } = await sb.from("school_members").update({ active: makeActive }).eq("id", id);
        if(error) throw error;
        loadSchoolMembers();
    }catch(e){
        console.error("[خُطى] تعذّر تعديل العضو:", e);
        showToast(currentLang==='ar' ? "تعذّر تنفيذ العملية" : "Action failed");
    }
}

/* ============================================================
   إظهار الأقسام حسب الدور
   ============================================================ */
function applySchoolRoleUI(){
    if(!hasFeature("school")) return;
    const role = schoolCtx ? schoolCtx.role : null;
    document.querySelectorAll("[data-school-role]").forEach(el => {
        const allowed = (el.getAttribute("data-school-role") || "").split(/[\s,]+/).filter(Boolean);
        el.style.display = (role && allowed.includes(role)) ? "" : "none";
    });
    if(schoolCtx){
        const label = `${schoolCtx.fullName} — ${schoolRoleLabel(schoolCtx.role)}`;
        ["school-who","school-who-2"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = label;
        });
    }
    if(role === "admin"){ loadAccountRequests(); loadSchoolMembers(); }
    if(typeof loadSchoolWorkspace === "function") loadSchoolWorkspace();
}

/* يُستدعى من مسار الإقلاع بعد اكتمال تسجيل الدخول */
async function initSchoolAfterLogin(){
    if(!hasFeature("school")) return;
    const ctx = await loadSchoolContext();
    if(!ctx){ showSchoolGate(); return; }
    hideSchoolGate();
    applySchoolRoleUI();
}

/* ============================================================
   ملاحظة ترتيب: صرف أحداث المصادقة كان هنا حين كان هذا آخر ملف، ثم انتقل
   إلى js/14-school-work.js لأنه صار الأخير. القاعدة ثابتة: الصرف في آخر ملف.
   ============================================================ */
