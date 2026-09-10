/* ============================================================
   32) من يغادر المدرسة — معلّماً كان أو طالباً
   ------------------------------------------------------------
   قرارا المالك:
   • «المعلّم الذي يترك المدرسة ستتحوّل بياناته تلقائياً لدى الإدارة».
   • «الطالب الذي يُنقل: يُحذف حسابه من جهة منصّة المدرسة فقط، ويبقى
     حسابه على منصّة خُطى».

   ⚠️ وهذا الزرّ يحذف صفّاً من قاعدة البيانات فعلاً — لا يوقفه. ولهذا
   لا يُعرض إلا بعد قراءة **معاينة بالأرقام** من الخادم: كم اختباراً
   سينتقل، وكم محاولةً ستُحذف. والفرق بين الحالتين جوهري:

     المعلّم  → لا يضيع شيء، تنتقل ملكيّته إلى الإدارة.
     الطالب   → تُحذف محاولاته من سجلّ المدرسة، ويبقى حسابه في خُطى.

   ومن لا يعرف هذا الفرق قد يحذف طالباً ظنّاً أنه "إيقاف". فالنصّ هنا
   يقوله صراحةً، ولكل حالة لونها ورسالتها.
   ============================================================ */

let leaveTarget = null;
let leavePreview = null;

function lvLabel(ar, en){ return currentLang === "ar" ? ar : en; }

function ensureLeaveModal(){
    let m = document.getElementById("leave-modal");
    if(m) return m;
    m = document.createElement("div");
    m.id = "leave-modal";
    m.className = "overlay-screen";
    m.style.display = "none";
    document.body.appendChild(m);
    return m;
}

async function openMemberLeave(memberId){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    leaveTarget = memberId;
    leavePreview = null;

    const m = ensureLeaveModal();
    m.style.display = "flex";
    m.innerHTML = `<div class="wizard-card" style="max-width:520px;">
        <p class="card-sub">${lvLabel("جارٍ فحص ما سيحدث…","Checking…")}</p></div>`;

    try{
        const { data, error } = await sb.rpc("member_leave_preview", { p_member: memberId });
        if(error) throw error;
        leavePreview = data;
        renderMemberLeave();
    }catch(e){
        console.error("[خُطى] تعذّرت المعاينة:", e);
        m.innerHTML = `<div class="wizard-card" style="max-width:480px;">
            <p class="card-sub">${escapeHtml(leaveErrorText(e))}</p>
            <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:14px;"
                    onclick="closeMemberLeave()">${lvLabel("إغلاق","Close")}</button></div>`;
    }
}

function closeMemberLeave(){
    const m = document.getElementById("leave-modal");
    if(m){ m.style.display = "none"; m.innerHTML = ""; }
    leaveTarget = null;
    leavePreview = null;
}

function renderMemberLeave(){
    const m = ensureLeaveModal();
    const p = leavePreview || {};
    const isStudent = p.role === "student";
    const name = escapeHtml(p.name || "");

    /* ⚠️ ما سيحدث بالأرقام — لا "هل أنت متأكد؟" */
    const facts = isStudent ? [
        [Number(p.attempts) || 0, lvLabel("محاولة اختبار تُحذف من سجلّ المدرسة","exam attempts deleted")],
        [Number(p.classes) || 0,  lvLabel("عضوية فصل تُزال","class memberships removed")],
    ] : [
        [Number(p.exams) || 0, lvLabel("اختباراً ينتقل إلى الإدارة","exams move to admin")],
        [Number(p.files) || 0, lvLabel("ملفاً ينتقل","files move")],
        [Number(p.links) || 0, lvLabel("رابطاً ينتقل","links move")],
    ];

    m.innerHTML = `<div class="wizard-card" style="max-width:520px;">
        <h3 style="margin-bottom:4px;">
            <i class="fa-solid fa-right-from-bracket"></i>
            ${isStudent ? lvLabel("نقل الطالب من المدرسة","Transfer student out")
                        : lvLabel("مغادرة المعلّم للمدرسة","Teacher leaves the school")}
        </h3>
        <p class="card-sub" style="margin-bottom:14px;"><b>${name}</b></p>

        <div class="leave-facts ${isStudent ? "is-loss" : ""}">
            ${facts.map(([n, t]) => `<div><b>${n}</b><span>${escapeHtml(t)}</span></div>`).join("")}
        </div>

        <p class="leave-note">${isStudent
            ? lvLabel(
                "يخرج من منصّة المدرسة نهائياً، ولا يراه معلّموه بعد اليوم. <b>ويبقى حسابه في خُطى كما هو</b> — خططه ونقاطه ومحاكياته ملكُه لا ملكُ المدرسة.",
                "They leave the school platform for good. <b>Their Khuta account stays untouched.</b>")
            : lvLabel(
                "<b>لا يضيع شيء من عمله</b>: تنتقل اختباراته وملفاته وروابطه إلى حسابك أنت، فتبقى متاحةً لطلابه. ويبقى حسابه في خُطى كما هو.",
                "<b>Nothing of their work is lost</b> — exams, files and links move to your account.")}</p>

        <div style="display:flex; gap:10px; margin-top:16px; flex-wrap:wrap;">
            <button type="button" id="leave-confirm" class="btn acc-btn ${isStudent ? "leave-danger" : ""}"
                    style="flex:1; min-width:150px;" onclick="confirmMemberLeave()">
                <i class="fa-solid fa-check"></i>
                ${isStudent ? lvLabel("نفّذ النقل","Transfer out") : lvLabel("نفّذ المغادرة","Confirm")}</button>
            <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:120px;"
                    onclick="closeMemberLeave()">${lvLabel("إلغاء","Cancel")}</button>
        </div>
    </div>`;
}

async function confirmMemberLeave(){
    if(!sb || !leaveTarget || !leavePreview) return;
    const p = leavePreview;
    const isStudent = p.role === "student";

    /* ⚠️ تأكيدٌ ثانٍ للطالب وحده: حالته هي الوحيدة التي يضيع فيها شيء. */
    if(isStudent && !confirm(lvLabel(
        `سيُحذف ${p.name} من منصّة المدرسة ومعه ${Number(p.attempts) || 0} محاولة اختبار.\n` +
        `ويبقى حسابه في خُطى.\n\nلا رجعة في هذا. أُنفّذه؟`,
        `${p.name} will be removed from the school platform along with ${Number(p.attempts) || 0} exam attempts.\n` +
        `Their Khuta account stays.\n\nThis cannot be undone. Continue?`))) return;

    const btn = document.getElementById("leave-confirm");
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    try{
        const { data, error } = await sb.rpc("school_member_leave", { p_member: leaveTarget });
        if(error) throw error;
        closeMemberLeave();
        showToast(data && data.role === "student"
            ? lvLabel(`نُقل ${data.name} من المدرسة — وحسابه في خُطى باقٍ.`,
                      `${data.name} removed — their Khuta account is untouched.`)
            : lvLabel(`غادر ${data.name}، وانتقل ${Number(data.exams_moved) || 0} اختباراً إليك.`,
                      `${data.name} left; ${Number(data.exams_moved) || 0} exams moved to you.`));
        if(typeof loadSchoolMembers === "function") loadSchoolMembers();
        if(typeof loadAdminClasses === "function") loadAdminClasses();
        if(typeof loadTeacherExams === "function") loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّرت المغادرة:", e);
        showToast(leaveErrorText(e));
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
    }
}

function leaveErrorText(e){
    const raw = [e && e.message, e && e.details, e && e.hint].filter(Boolean).join(" | ");
    if(/CANNOT_REMOVE_SELF/.test(raw))
        return lvLabel("لا يمكنك إخراج نفسك من المدرسة.", "You can't remove yourself.");
    /* ⚠️ ولا يُخرج مديرٌ مديراً: انقلابٌ صامت. ويُقال له الطريق الظاهر. */
    if(/CANNOT_REMOVE_ADMIN/.test(raw))
        return lvLabel("لا يُخرَج مديرٌ مباشرةً — أنزله إلى معلّم أولاً ثم أخرجه.",
                       "Demote the admin to teacher first, then remove them.");
    if(/NEEDS_GOOGLE/.test(raw))
        return lvLabel("هذا الإجراء يتطلّب تأكيد هويتك بحساب Google.",
                       "This requires a fresh Google sign-in.");
    if(/NOT_ALLOWED/.test(raw)) return lvLabel("هذا الإجراء لإدارة المدرسة.", "Admins only.");
    if(/NOT_FOUND/.test(raw))   return lvLabel("لم نجد هذا العضو.", "Member not found.");
    return lvLabel("تعذّر تنفيذ الإجراء — لم يتغيّر شيء.", "Failed — nothing changed.");
}
