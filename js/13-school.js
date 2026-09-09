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
/* ⚠️ هنا كان العطل الذي أوقف الاختبار كلّه: الدالة كانت تشترط
   hasFeature("school") وتبحث بـTENANT.id — وقيمته على الرابط العادي "khuta"
   لا "motaqadima". فلا تجد مدرسة أبداً، فتظهر "تعذّر تحديد المدرسة" مهما
   فعل المستخدم، ولا يستطيع أحد تقديم طلب إطلاقاً.

   السبب الأعمق: كُتبت أيام كانت المدرسة نسخةً منفصلة لها عنوانها الخاص، ثم
   صرنا منصة واحدة ولم تُحدَّث معها. والدالة الجديدة في قاعدة البيانات تُرجع
   المدرسة الوحيدة حين لا يُمرَّر slug — وهو حال منصتنا اليوم. */
async function getSchoolId(){
    if(schoolIdCache) return schoolIdCache;
    if(!sb) return null;
    try{
        const slug = (typeof TENANT !== "undefined" && TENANT && TENANT.schoolSlug) ? TENANT.schoolSlug : null;
        const { data, error } = await sb.rpc("school_for_request", { p_slug: slug });
        if(error) throw error;
        schoolIdCache = data || null;
    }catch(e){ console.warn("[خُطى] تعذّر تحديد المدرسة:", e); }
    return schoolIdCache;
}

/* يُستدعى بعد كل تسجيل دخول ناجح — في خُطى نفسها، لا في نسخة منفصلة.
   يسأل قاعدة البيانات: هل هذا الحساب عضو في مدرسة؟ الغالبية العظمى من
   مستخدمي خُطى ليسوا كذلك، فيعود بصفر ولا يتغيّر شيء في تجربتهم إطلاقاً. */
async function loadSchoolContext(){
    if(!sb) return null;
    schoolCtx = null;
    try{
        const { data: { user } } = await sb.auth.getUser();
        if(!user || user.is_anonymous) return null;

        // الإدارة تضيف بريد Google قبل أن يسجّل صاحبه دخوله أصلاً. هذه
        // الدالة تربط الحساب بالسجل المطابق للبريد عند أول دخول، فيصبح
        // "أضافه المدير" أمراً واقعاً دون أي خطوة إضافية من الطالب.
        try{ await sb.rpc("link_my_school_account"); }catch(e){}

        const { data, error } = await sb.rpc("my_school_membership");
        if(error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if(!row) return null;
        schoolCtx = {
            schoolId: row.school_id, memberId: row.member_id, role: row.role,
            fullName: row.full_name, grade: row.grade, section: row.section,
            schoolName: row.school_name,
        };
    }catch(e){ console.warn("[خُطى] تعذّر تحميل عضوية المدرسة:", e); }
    return schoolCtx;
}

// هل هذا الحساب عضو مدرسة؟ تستعملها الواجهة لتقرر إظهار قسم المدرسة.
function isSchoolMember(){ return !!schoolCtx; }

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
    fillRequestIdentity();
}

/* ⚠️ البريد لا يُكتب باليد بل يُقرأ من حساب Google الذي دخل به صاحب الطلب.
   السبب ليس الراحة: الإدارة حين توافق تُنشئ العضوية على هذا البريد، ودالة
   link_my_school_account تربط الحساب بالعضوية حين يتطابق البريد. فحرفٌ واحد
   خاطئ في الكتابة اليدوية يعني موافقةً تبدو ناجحة تماماً، ثم لا يرى صاحبها
   شيئاً أبداً ولا أحد يعرف السبب. القراءة من الحساب تمنع هذا من أصله.

   ولهذا نشترط تسجيل الدخول أولاً — وهو ما طلبه المالك نصاً: "المفترض أن
   المعلم أو الطالب سيكون أولاً لديه إيميل Google على الموقع، بعدها يدخل
   على هذه الصفحة". */
async function fillRequestIdentity(){
    const emailEl = document.getElementById("areq-email");
    const warnEl  = document.getElementById("areq-signin-warn");
    const formEl  = document.getElementById("areq-fields");
    const btn     = document.getElementById("areq-submit");
    if(!emailEl) return;

    let user = null;
    try{
        if(sb){ const { data } = await sb.auth.getUser(); user = data && data.user; }
    }catch(e){ console.warn("[خُطى] تعذّر قراءة الحساب:", e); }

    const signedIn = !!(user && !user.is_anonymous && user.email);
    emailEl.value = signedIn ? user.email : "";
    if(warnEl) warnEl.style.display = signedIn ? "none" : "block";
    if(formEl) formEl.style.display = signedIn ? "block" : "none";
    if(btn){ btn.disabled = !signedIn; btn.style.opacity = signedIn ? "" : ".5"; }

    // الاسم المعروض في حساب Google بداية معقولة يوفّر على صاحب الطلب الكتابة
    const nameEl = document.getElementById("areq-name");
    if(signedIn && nameEl && !nameEl.value){
        const meta = user.user_metadata || {};
        nameEl.value = meta.full_name || meta.name || "";
    }
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

    // ⚠️ البريد من الحساب لا من الحقل: الحقل للعرض فقط ولا يُوثق به
    let email = null;
    try{
        const { data } = await sb.auth.getUser();
        email = data && data.user && !data.user.is_anonymous ? data.user.email : null;
    }catch(e){}
    if(!email){
        showToast(currentLang==='ar'
            ? "سجّل دخولك بحساب Google أولاً ثم أرسل الطلب"
            : "Sign in with Google first, then send the request");
        return;
    }

    const schoolId = await getSchoolId();
    if(!schoolId){
        showToast(currentLang==='ar' ? "تعذّر تحديد المدرسة — حدّث الصفحة" : "Could not identify the school");
        return;
    }

    const role = document.getElementById("areq-role").value;
    const payload = {
        school_id: schoolId,
        full_name: name,
        email,
        role_wanted: role === "teacher" ? "teacher" : "student",
        grade: role === "student" ? (document.getElementById("areq-grade").value || null) : null,
        section: role === "student" ? ((document.getElementById("areq-section").value || "").trim() || null) : null,
        contact: (document.getElementById("areq-contact").value || "").trim() || null,
        note: (document.getElementById("areq-note").value || "").trim() || null,
    };

    const btn = document.getElementById("areq-submit");
    if(btn){ btn.disabled = true; btn.style.opacity = ".6"; }
    try{
        // ⚠️ لا تُضِف ‎.select()‎ هنا أبداً. صاحب الطلب ليس إدارياً، فلا سياسة
        // قراءة تسمح له برؤية صفّه — و‎.select()‎ يجعل الإدراج يطلب الصفَّ بعد
        // كتابته فيُرفض كاملاً برسالة "new row violates row-level security"
        // تبدو كأن الإدراج نفسه ممنوع. (وقعتُ فيها في اختباري قبل أن أفهمها.)
        const { error } = await sb.from("account_requests").insert(payload);
        if(error) throw error;
        document.getElementById("areq-form").style.display = "none";
        document.getElementById("areq-done").style.display = "block";
    }catch(e){
        // ⚠️ كانت الرسالة هنا "حاول مرة أخرى" في كل الحالات — وهي أسوأ نصيحة
        // ممكنة لمن رُفض طلبه لأنه مُرسَل مسبقاً: يعيد الإرسال بلا نهاية.
        // schoolError يعرف أسباب حارس الطلبات ويقول لكلٍّ ما يفعله.
        showSchoolError(e, currentLang==='ar' ? "إرسال الطلب" : "sending the request");
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
            .select("id, full_name, email, role_wanted, grade, section, contact, note, status, created_at")
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
                <!-- ⚠️ البريد معروض عمداً: عليه تُنشأ العضوية، فيجب أن تراه
                     الإدارة قبل الموافقة لا بعدها. -->
                <div class="card-sub" style="direction:ltr; text-align:start; font-family:'IBM Plex Mono',monospace; font-size:12px;">
                    ${r.email ? escapeHtml(r.email) : (currentLang==='ar'?'⚠️ بلا بريد — لا يمكن قبوله':'⚠️ no email')}</div>
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
    if(!confirm(currentLang==='ar' ? "قبول هذا الطلب وإنشاء العضوية؟" : "Approve and create the membership?")) return;
    try{
        // ⚠️ دالة واحدة تُنشئ العضوية وتعلّم الطلب معاً. كان الكود هنا يعلّم
        // الطلب فقط بلا إنشاء عضوية، فتظهر "تم القبول ✅" ولا يصير صاحبه
        // عضواً أبداً — نجاح كاذب لا يشتكي منه شيء.
        const { error } = await sb.rpc("approve_account_request", { p_id: id });
        if(error) throw error;
        showToast(currentLang==='ar' ? "تم القبول وأُنشئت العضوية ✅" : "Approved, membership created ✅");
        loadAccountRequests();
        if(typeof loadSchoolMembers === "function") loadSchoolMembers();
    }catch(e){
        console.error("[خُطى] تعذّر قبول الطلب:", e);
        const raw = (e && e.message) || "";
        showToast(
            raw.includes("NEEDS_GOOGLE")          ? (currentLang==='ar' ? "أكّد هويتك بحساب Google أولاً" : "Confirm with Google first") :
            raw.includes("REQUEST_HAS_NO_EMAIL")  ? (currentLang==='ar' ? "الطلب بلا بريد — اطلب من صاحبه إعادة إرساله بعد تسجيل الدخول" : "Request has no email") :
            raw.includes("ALREADY_REVIEWED")      ? (currentLang==='ar' ? "هذا الطلب رُوجع من قبل" : "Already reviewed") :
            (currentLang==='ar' ? "تعذّر تنفيذ العملية" : "Action failed"));
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

const schoolMembersCache = new Map();

async function loadSchoolMembers(){
    const box = document.getElementById("admin-members-list");
    if(!box || !schoolCtx || schoolCtx.role !== "admin" || !sb) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb
            .from("school_members")
            .select("id, full_name, email, role, grade, section, active")
            .eq("school_id", schoolCtx.schoolId)
            .order("role").order("full_name")
            .limit(500);
        if(error) throw error;
        /* ⚠️ الاسم والدور يُقرآن من هنا لا من سمة onclick. السبب خطأ وقعتُ
           فيه: كنت أمرّر الاسم بـJSON.stringify داخل سمة محاطة بعلامتَي
           اقتباس مزدوجتين — فأنهت العلامةُ الأولى السمةَ وكسرت المعالج،
           فصار الزر يبدو سليماً ولا يفعل شيئاً عند الضغط. */
        schoolMembersCache.clear();
        (data || []).forEach(m => schoolMembersCache.set(m.id, m));

        /* الفرز يُطبَّق هنا لا في الاستعلام: القائمة صغيرة والفرز فوري بلا
           ذهاب للخادم عند كل ضغطة، والصلاحيات هي التي حدّدت ما وصل أصلاً. */
        const shown = (typeof filterMembers === "function") ? filterMembers(data) : (data || []);
        if(!shown.length){
            box.innerHTML = `<p class="card-sub">${(data||[]).length
                ? (currentLang==='ar'?'لا عضو يطابق الفرز الحالي.':'No member matches the filter.')
                : (currentLang==='ar'?'لا يوجد أعضاء بعد.':'No members yet.')}</p>`;
            if(typeof updateBulkBar === "function") updateBulkBar();
            return;
        }
        box.innerHTML = shown.map(m => `
            <div class="member-row${m.active ? "" : " is-off"}">
                <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                    ${m.role === "student" ? `<input type="checkbox" class="member-pick" value="${escapeHtml(m.id)}"
                        ${selectedStudents.has(m.id) ? "checked" : ""}
                        onchange="toggleStudentPick('${escapeHtml(m.id)}', this.checked)"
                        style="width:20px; height:20px; flex-shrink:0;" aria-label="${currentLang==='ar'?'تحديد':'Select'}">` : ""}
                  <div>
                    <b>${escapeHtml(m.full_name)}</b>
                    <span class="pill">${escapeHtml(schoolRoleLabel(m.role))}</span>
                    ${m.grade ? `<span class="card-sub"> · ${escapeHtml(gradeText(m.grade))}${m.section ? " / " + escapeHtml(m.section) : ""}</span>` : ""}
                    ${m.role === "student" && !m.section ? `<span class="card-sub" style="color:var(--gold-text);"> · ${currentLang==='ar'?'⚠️ بلا شعبة':'⚠️ no section'}</span>` : ""}
                  </div>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${m.role !== "admin" ? `<button type="button" class="btn btn-outline btn-sm"
                        onclick="openAssignClass('${escapeHtml(m.id)}')">
                        <i class="fa-solid fa-chalkboard"></i> ${currentLang==='ar'?'الفصول':'Classes'}</button>` : ""}
                    <button type="button" class="btn btn-ghost btn-sm" onclick="toggleMemberActive('${escapeHtml(m.id)}', ${m.active ? "false" : "true"})">
                        ${m.active ? (currentLang==='ar'?'إيقاف':'Disable') : (currentLang==='ar'?'تفعيل':'Enable')}
                    </button>
                </div>
            </div>`).join("");
        if(typeof updateBulkBar === "function") updateBulkBar();
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
    const role = schoolCtx ? schoolCtx.role : null;
    /* ⚠️ هذا الصنف يشغّل مقاسات اللمس المكبَّرة (44px) لأعضاء المدرسة.
       كانت مشروطة بعنوان النسخة، فماتت حين وحّدنا المنصّتين. */
    document.body.classList.toggle("is-school", !!role);
    /* طالب المدرسة وحده يُميَّز له قسم "منصة المدرسة" في القائمة — لأنه
       القسم الذي جاء من أجله، ولا ينبغي أن يضيع بين أقسام القدرات. */
    document.body.classList.toggle("is-school-student", role === "student");

    /* شاشة تعريف خُطى موجَّهة لطالب جديد. فحين يتبيّن أن الحساب معلّم أو
       إدارة نعلّمها مشاهَدة على هذا الجهاز فلا تظهر لهم لاحقاً — والحالة
       الشائعة أن متصفّح السبورة نظيف، فتُستقبل الإدارة بمقدّمة عن القدرات.
       ⚠️ الطالب مستثنى عمداً: التعريف يخصّه هو، مدرسياً كان أو غير مدرسي. */
    if(role === "teacher" || role === "admin"){
        try{
            localStorage.setItem("khuta_intro_seen", "1");
            if(typeof dismissIntro === "function") dismissIntro();
        }catch(e){}
    }
    // عنصر التنقل لقسم المدرسة يظهر فقط لعضو مدرسة — وهو الشرط الوحيد.
    document.querySelectorAll("[data-school-member]").forEach(el => {
        el.style.display = role ? "" : "none";
    });
    // المعلم والإدارة لا يحتاجان أقسام القدرات (التخصصات والموزونة)،
    // فنخفيها عنهما ونُبقيها للطالب لأنه طالب خُطى أيضاً.
    const hideGat = role === "teacher" || role === "admin";
    document.querySelectorAll('[data-feature="gat"]').forEach(el => {
        if(hideGat) el.style.display = "none";
    });
    document.querySelectorAll("[data-school-role]").forEach(el => {
        const allowed = (el.getAttribute("data-school-role") || "").split(/[\s,]+/).filter(Boolean);
        el.style.display = (role && allowed.includes(role)) ? "" : "none";
    });
    // شارة عدد الطلبات تُخفى مع عنصرها، لكن لا تُظهَر إلا إن كان فيها رقم
    const badge = document.getElementById("admin-requests-count");
    if(badge && !role) badge.style.display = "none";
    if(schoolCtx){
        const label = `${schoolCtx.fullName} — ${schoolRoleLabel(schoolCtx.role)}`;
        ["school-who","school-who-2"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.textContent = label;
        });
    }
    if(role === "admin"){
        loadAccountRequests(); loadSchoolMembers();
        if(typeof loadAdminClasses === "function") loadAdminClasses();
    }
    // شريط "جلسة محدودة" يشرح للمعلّم لماذا لا تعمل بعض الأزرار — والمنع
    // نفسه في قاعدة البيانات لا هنا.
    if(typeof applyLimitedSessionUI === "function"){
        applyLimitedSessionUI().catch(e => console.warn("[خُطى] تعذّر فحص نوع الجلسة:", e));
    }
    // الصفحة الرئيسية تتبدّل للمعلّم والإدارة — انظر js/23-school-home.js
    if(typeof applyStaffHome === "function"){
        try{ applyStaffHome(); }catch(e){ console.warn("[خُطى] تعذّر تهيئة الصفحة الرئيسية:", e); }
    }
    if(typeof loadSchoolWorkspace === "function") loadSchoolWorkspace();
}

/* يُستدعى من مسار الإقلاع بعد اكتمال تسجيل الدخول */
async function initSchoolAfterLogin(){
    const ctx = await loadSchoolContext();
    applySchoolRoleUI();
    // ليس عضواً؟ هذا هو الوضع الطبيعي لمستخدم خُطى — لا شاشة ولا رسالة،
    // يكمل تجربته المعتادة كأن قسم المدرسة غير موجود.
    if(!ctx) return;
    hideSchoolGate();
    if(typeof loadSchoolWorkspace === "function") loadSchoolWorkspace();
}

/* ============================================================
   ملاحظة ترتيب: صرف أحداث المصادقة كان هنا حين كان هذا آخر ملف، ثم انتقل
   إلى js/14-school-work.js لأنه صار الأخير. القاعدة ثابتة: الصرف في آخر ملف.
   ============================================================ */
