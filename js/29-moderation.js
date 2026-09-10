/* ============================================================
   29) الإشراف على المجتمع — زرّ الإبلاغ وصندوق المراجعة
   ------------------------------------------------------------
   قرار المالك ونصّه: «زر الإبلاغ فلن يقتصر على الإبلاغين، بل خمس
   إبلاغات، بعدها سيذهب إلى صندوق مراجعة الإدارة… وإذا لم يتم الرد على
   البلاغ بأسبوع سيتم حذفها بشكل تلقائي، لكن في البداية لن يتم حذف
   وإنما سيتم إخفاء».

   وهو تصميم صحيح: الحذف ببلاغين يجعل خصمَين قادرَين على إسكات أي أحد،
   والانتظار حتى تردّ الإدارة يُبقي ما لا يليق معروضاً أياماً. فالإخفاء
   يوقف الضرر فوراً ويترك القرار لإنسان، والمهلة تضمن ألّا يعيش المخفيّ
   إلى الأبد لأن أحداً نسي الصندوق.

   ⚠️ ولا شيء من هذا في المتصفّح: العدّ والإخفاء والصلاحيات كلها في
   قاعدة البيانات. وما هنا واجهةٌ لها فقط. من فتح أدوات المطوّر ونادى
   الدالّة مئة مرة سجّل بلاغاً واحداً — القيد unique(post_id, reporter)
   هو الحاجز، لا هذا الملف.
   ============================================================ */

function modLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/* ============================================================
   لماذا رُفضت مشاركتي؟
   ------------------------------------------------------------
   ⚠️ كانت الواجهة تقول "تعذّر النشر" لأي سبب. والطالب الذي كتب رقم
   جوّاله في سؤال بريء يقرأ "تعذّر النشر" فيظنّ الموقع معطّلاً ويعيد
   المحاولة خمس مرات ثم يتركه. السبب الصريح يُصلح المشاركة في ثانية.
   ============================================================ */
const POST_REJECT_TEXT = {
    TOO_SHORT:  ["اكتب سؤالاً أوضح — حرفان على الأقل.", "Too short."],
    TOO_LONG:   ["المشاركة طويلة — ٨٠٠ حرف كحدٍّ أقصى.", "Too long — 800 characters max."],
    NO_TEXT:    ["اكتب سؤالك بحروف.", "Use letters."],
    LINK:       ["لا تُنشر الروابط ولا المعرّفات هنا — الحائط للأسئلة الدراسية.",
                 "Links and handles aren't allowed here."],
    CONTACT:    ["لا تضع رقم جوّالك — يقرأه كل من يفتح الصفحة، ولا أحد يعرف من ينسخه.",
                 "Don't post your phone number — anyone online can read it."],
    ABUSE:      ["فيها كلام مسيء. أعد صياغتها.", "This contains abusive language."],
    IMPERSONATION: ["لا تكتب أنك من إدارة المنصّة أو دعمها.",
                    "Don't claim to be platform staff or support."],
    TOO_FAST:   ["نشرتَ كثيراً في وقت قصير — انتظر قليلاً.",
                 "You've posted a lot recently — wait a bit."],
    DUPLICATE:  ["نشرتَ هذه المشاركة نفسها قبل قليل.", "You just posted the same thing."],
};

function postRejectionText(e){
    const raw = [e && e.message, e && e.details, e && e.hint].filter(Boolean).join(" | ");
    const m = /POST_REJECTED_([A-Z_]+)/.exec(raw);
    const pair = m && POST_REJECT_TEXT[m[1]];
    if(pair) return currentLang === "ar" ? pair[0] : pair[1];
    return modLabel("تعذّر النشر.", "Could not post.");
}

/* ---------- زرّ الإبلاغ ---------- */

async function reportForumPost(id){
    if(!sb) return;
    const why = prompt(modLabel(
        "ما المشكلة في هذه المشاركة؟ (اختياري — يساعد الإدارة على الفهم)",
        "What's wrong with this post? (optional)"));
    if(why === null) return;                       // ضغط "إلغاء"

    try{
        const { data, error } = await sb.rpc("report_forum_post", {
            p_post: id, p_reason: (why || "").slice(0, 300) || null,
        });
        if(error) throw error;

        /* ⚠️ لا نقول له كم بلاغاً بقي قبل الإخفاء. ومن يعرف أن الحدّ
           خمسة ينسّق خمسة حسابات ويُخفي ما يشاء. */
        showToast(data && data.hidden
            ? modLabel("وصل البلاغ، وأُخفيت المشاركة حتى تراجعها الإدارة.",
                       "Reported — the post is hidden pending review.")
            : modLabel("وصل بلاغك. شكراً لك.", "Report received. Thank you."));
        if(typeof refreshForum === "function") refreshForum();
    }catch(e){
        console.error("[خُطى] تعذّر الإبلاغ:", e);
        showToast(reportErrorText(e));
    }
}

function reportErrorText(e){
    const raw = [e && e.message, e && e.details, e && e.hint].filter(Boolean).join(" | ");
    if(/OWN_POST/.test(raw))        return modLabel("هذه مشاركتك — احذفها بدل الإبلاغ عنها.",
                                                    "That's your own post.");
    if(/ANON_NOT_ALLOWED/.test(raw))return modLabel("الإبلاغ يحتاج حساباً باسمك — لا حساب زائر.",
                                                    "Reporting requires a real account, not a guest.");
    if(/NOT_SIGNED_IN/.test(raw))   return modLabel("سجّل الدخول أولاً.", "Sign in first.");
    if(/POST_NOT_FOUND/.test(raw))  return modLabel("لم نجد هذه المشاركة.", "Post not found.");
    return modLabel("تعذّر إرسال البلاغ.", "Could not send the report.");
}

/* ---------- صندوق مراجعة الإدارة ---------- */

async function refreshModerationQueue(){
    const card = document.getElementById("moderation-card");
    const box = document.getElementById("moderation-list");
    const count = document.getElementById("moderation-count");
    if(!card || !box) return;

    if(!sb || !isAdmin){ card.style.display = "none"; return; }
    card.style.display = "";
    box.innerHTML = `<p class="card-sub">${modLabel("جارٍ التحميل…","Loading…")}</p>`;

    try{
        /* ⚠️ نكنس المنتهية مهلتها هنا أيضاً لا في الجدولة وحدها: الجدولة
           على Netlify قد تسقط بصمت، فيبقى المخفيّ أشهراً بلا أن يعرف أحد.
           والكنس هنا رخيص (حذفٌ بشرط) ويجري مرة عند فتح الصندوق. */
        try{ await sb.rpc("sweep_expired_moderation"); }
        catch(e){ /* الخدمة وحدها تملك صلاحيته — لا يُفشل عرض الصندوق */ }

        const { data, error } = await sb.rpc("moderation_queue");
        if(error) throw error;
        const rows = Array.isArray(data) ? data : [];

        if(count){
            count.textContent = String(rows.length);
            count.style.display = rows.length ? "" : "none";
        }
        if(!rows.length){
            box.innerHTML = `<p class="card-sub">${modLabel(
                "لا بلاغات تنتظر قرارك.","Nothing waiting for you.")}</p>`;
            return;
        }
        box.innerHTML = rows.map(renderModerationRow).join("");
    }catch(e){
        console.error("[خُطى] تعذّر فتح صندوق المراجعة:", e);
        box.innerHTML = `<p class="card-sub">${modLabel(
            "تعذّر فتح الصندوق.","Could not open the queue.")}</p>`;
    }
}

function modDate(iso){
    if(!iso) return "";
    try{
        return new Date(iso).toLocaleString(
            currentLang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
            { dateStyle:"medium", timeStyle:"short" });
    }catch(e){ return ""; }
}

/** كم بقي قبل الحذف التلقائي — رقمٌ يجعل المهلة حقيقية لا وعداً. */
function modDaysLeft(iso){
    if(!iso) return null;
    const ms = new Date(iso).getTime() - Date.now();
    if(isNaN(ms)) return null;
    return Math.max(0, Math.ceil(ms / 86400000));
}

function renderModerationRow(r){
    const left = modDaysLeft(r.purge_after);
    const reasons = Array.isArray(r.reasons) ? r.reasons.filter(Boolean) : [];
    return `
    <div class="mod-row">
        <div class="mod-main">
            <div class="mod-meta">
                <b>${escapeHtml(r.author_name || "")}</b>
                <span>${modDate(r.created_at)}</span>
                <span class="pill mod-pill">${Number(r.reports) || 0} ${modLabel("بلاغات","reports")}</span>
                ${left === null ? "" : `<span class="mod-left ${left <= 2 ? "urgent" : ""}">${
                    left === 0 ? modLabel("يُحذف اليوم","deleted today")
                               : modLabel(`يُحذف بعد ${left} يوم`, `deleted in ${left}d`)}</span>`}
            </div>
            <div class="mod-message">${escapeHtml(r.message || "")}</div>
            ${reasons.length ? `<div class="mod-reasons">${modLabel("أسباب البلاغ","Reasons")}:
                ${reasons.map(x => `<span>${escapeHtml(String(x))}</span>`).join("")}</div>` : ""}
        </div>
        <div class="mod-actions">
            <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="decideModeration(${Number(r.id)}, true)">
                <i class="fa-solid fa-check"></i> ${modLabel("أعِدها","Keep")}</button>
            <button type="button" class="btn btn-sm acc-btn mod-remove" onclick="decideModeration(${Number(r.id)}, false)">
                <i class="fa-solid fa-trash"></i> ${modLabel("احذفها","Remove")}</button>
        </div>
    </div>`;
}

async function decideModeration(id, keep){
    if(!sb || !isAdmin) return;
    if(!keep && !confirm(modLabel("حذف هذه المشاركة نهائياً؟",
                                  "Permanently delete this post?"))) return;
    try{
        const { error } = await sb.rpc("moderate_post", { p_post: id, p_keep: !!keep });
        if(error) throw error;
        showToast(keep
            ? modLabel("أُعيدت المشاركة ومُسحت بلاغاتها.", "Restored, reports cleared.")
            : modLabel("حُذفت المشاركة.", "Deleted."));
        refreshModerationQueue();
        if(typeof refreshForum === "function") refreshForum();
    }catch(e){
        console.error("[خُطى] تعذّر تنفيذ القرار:", e);
        showToast(modLabel("تعذّر تنفيذ القرار.", "Could not apply the decision."));
    }
}
