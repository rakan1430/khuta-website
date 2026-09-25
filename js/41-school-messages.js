/* ============================================================
   رسائل البريد لطلاب المدرسة — لإدارة المدرسة (٢٥ سبتمبر)
   ------------------------------------------------------------
   طلب المالك: «حساب الإدارة لدى المدرسة لا يظهر لهم سوى إرسال لطلاب
   المدرسة، ويمكن جدولتها أن يتم إرسالها بشكل تلقائي».

   ⚠️ الواجهة هنا لا تقرّر شيئاً أمنياً — كل قيد مفروض في الخادم:
   • القاعدة (sql/PHASE8_MESSAGES.sql): إدارة المدرسة ترى رسائل مدرستها
     وحدها، وتكتب «لطلاب مدرستها، نصّاً عادياً» فقط، و٣ رسائل في اليوم،
     وبدخول Google حديث.
   • من يستلم: campaign_recipients في القاعدة — طلاب المدرسة النشِطون إلا
     من أوقف رسائلها. والإرسال في netlify/functions/send-email.js.
   • المجدولة: netlify/functions/send-campaigns.js كل ربع ساعة.
   ============================================================ */

let smsgSeq = 0;

function smsgLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/** أسباب الرفض من القاعدة والخادم، بكلام يفهمه المدير. */
function smsgError(e){
    const msg = String((e && (e.message || e.error)) || e || "");
    if(/SCHOOL_DAILY_LIMIT/.test(msg)) return smsgLabel("بلغتم حدّ ٣ رسائل اليوم — جرّبوا غداً.", "Daily limit of 3 messages reached.");
    if(/MESSAGE_TOO_LONG/.test(msg)) return smsgLabel("الرسالة أطول من المسموح (٤٠٠٠ حرف).", "Message too long (4000 chars max).");
    if(/row-level security|violates/.test(msg)) return smsgLabel("أكّد هويتك بحساب Google أولاً ثم أعد المحاولة.", "Confirm with Google first, then retry.");
    if(/over_quota/.test(msg)) return smsgLabel("وصل إرسال اليوم حدّه المسموح — تُرسل غداً.", "Today's sending quota is used up.");
    if(/already_sending_or_sent/.test(msg)) return smsgLabel("أُرسلت هذه الرسالة من قبل.", "This message was already sent.");
    return smsgLabel("تعذّر ذلك: ", "Failed: ") + msg.slice(0, 120);
}

function smsgFmtDate(iso){
    if(!iso) return "";
    try{ return new Date(iso).toLocaleString(currentLang === "ar" ? "ar-SA" : "en-GB", { dateStyle:"medium", timeStyle:"short" }); }
    catch(e){ return iso; }
}

async function renderSchoolMessages(){
    const list = document.getElementById("smsg-list");
    const reach = document.getElementById("smsg-reach");
    if(!list || !sb || typeof schoolCtx === "undefined" || !schoolCtx || schoolCtx.role !== "admin") return;
    const seq = ++smsgSeq;

    // كم طالباً تصله الرسالة فعلاً — قبل أن يكتب المدير شيئاً
    try{
        const { data } = await sb.rpc("campaign_audience_counts", { p_school: schoolCtx.schoolId });
        if(seq !== smsgSeq) return;
        if(reach && data && typeof data === "object" && data.role === "school"){
            reach.textContent = smsgLabel(
                `تصل الرسالة ${data.reach} من ${data.students} طالباً (من لهم حساب مفعَّل ببريد، ولم يوقفوا رسائل المدرسة).`,
                `Reaches ${data.reach} of ${data.students} students (active accounts with email, not opted out).`);
        }
    }catch(e){ /* الأرقام تكميلية — القائمة أهمّ */ }

    list.innerHTML = `<p class="hint">${smsgLabel("جاري التحميل…", "Loading…")}</p>`;
    try{
        const { data, error } = await sb.from("marketing_messages")
            .select("id, subject, body_html, send_after, sent_at, sending_started_at, send_result, created_at")
            .eq("school_id", schoolCtx.schoolId)
            .order("created_at", { ascending:false })
            .limit(20);
        if(seq !== smsgSeq) return;
        if(error) throw error;
        const rows = data || [];
        if(!rows.length){
            list.innerHTML = `<p class="hint">${smsgLabel("لا رسائل بعد.", "No messages yet.")}</p>`;
            return;
        }
        list.innerHTML = rows.map(m => {
            const r = m.send_result || {};
            let status;
            if(m.sent_at) status = `✅ ${smsgLabel("أُرسلت", "Sent")} ${smsgFmtDate(m.sent_at)} — ${smsgLabel(`وصلت ${r.sent || 0} من ${r.total || 0}`, `${r.sent || 0}/${r.total || 0} delivered`)}${r.failed ? smsgLabel(` (فشلت ${r.failed})`, ` (${r.failed} failed)`) : ""}`;
            else if(m.sending_started_at) status = `⏳ ${smsgLabel("قيد الإرسال", "Sending")}`;
            else if(r.error) status = `⚠️ ${smsgError(r.error)}`;
            else if(m.send_after) status = `⏰ ${smsgLabel("مجدولة", "Scheduled")} ${smsgFmtDate(m.send_after)}`;
            else status = smsgLabel("محفوظة — لم تُرسل", "Saved — not sent");
            const open = !m.sent_at && !m.sending_started_at;
            return `
            <div class="sfile-row">
                <div class="sfile-main">
                    <i class="fa-solid fa-envelope"></i>
                    <div>
                        <b>${escapeHtml(m.subject)}</b>
                        <div class="card-sub">${escapeHtml(status)}</div>
                    </div>
                </div>
                ${open ? `<div class="sfile-actions">
                    <button type="button" class="btn btn-sm acc-btn" onclick="sendSchoolMessageNow(${Number(m.id)}, this)">
                        <i class="fa-solid fa-paper-plane"></i> ${smsgLabel("أرسل الآن", "Send now")}</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="testSchoolMessage(${Number(m.id)}, this)"
                        title="${smsgLabel("تصل بريدك أنت فقط", "Goes to your email only")}">
                        <i class="fa-solid fa-flask"></i> ${smsgLabel("جرّبها على بريدي", "Test on my email")}</button>
                    <button type="button" class="btn btn-outline btn-sm" onclick="deleteSchoolMessage(${Number(m.id)})"
                        aria-label="${smsgLabel("حذف", "Delete")}"><i class="fa-solid fa-trash"></i></button>
                </div>` : ""}
            </div>`;
        }).join("");
    }catch(e){
        if(seq !== smsgSeq) return;
        list.innerHTML = `<p class="hint">${escapeHtml(smsgError(e))}</p>`;
    }
}

async function saveSchoolMessage(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    const subjEl = document.getElementById("smsg-subject");
    const bodyEl = document.getElementById("smsg-body");
    const whenEl = document.getElementById("smsg-when");
    const subject = (subjEl.value || "").trim();
    const body = (bodyEl.value || "").trim();
    if(!subject || !body){ showToast(smsgLabel("العنوان والنص مطلوبان", "Subject and text are required")); return; }
    let sendAfter = null;
    if(whenEl.value){
        const d = new Date(whenEl.value);
        if(isNaN(d.getTime())){ showToast(smsgLabel("الموعد غير صالح", "Invalid time")); return; }
        if(d.getTime() < Date.now() - 60000){ showToast(smsgLabel("الموعد مضى — اختر وقتاً قادماً", "That time has passed")); return; }
        sendAfter = d.toISOString();
    }
    const btn = document.getElementById("smsg-save");
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    try{
        const { error } = await sb.from("marketing_messages").insert({
            subject, body_html: body, body_format: "text",
            origin: "school", audience: "school", school_id: schoolCtx.schoolId,
            send_mode: "broadcast", send_after: sendAfter, active: true,
            occasion: smsgLabel("مدرسة", "school"),
        });
        if(error) throw error;
        subjEl.value = ""; bodyEl.value = ""; whenEl.value = "";
        showToast(sendAfter ? smsgLabel("✅ حُفظت، وتُرسل تلقائياً في موعدها", "✅ Saved — it will send on time")
                            : smsgLabel("✅ حُفظت — جرّبها على بريدك ثم أرسلها", "✅ Saved — test it, then send"));
        renderSchoolMessages();
    }catch(e){
        showToast(smsgError(e));
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
    }
}

async function callSchoolEmail(type, messageId){
    const { data } = await sb.auth.getSession();
    const accessToken = data && data.session && data.session.access_token;
    if(!accessToken){ showToast(smsgLabel("سجّل دخولك أولاً", "Sign in first")); return null; }
    const res = await fetch("/.netlify/functions/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, accessToken, messageId }),
    });
    const json = await res.json().catch(() => ({}));
    if(!res.ok){ showToast(smsgError(json.error || res.status)); return null; }
    return json;
}

async function testSchoolMessage(id, btn){
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    try{
        const r = await callSchoolEmail("schoolTest", id);
        if(r && r.ok) showToast(smsgLabel(`🧪 وصلت نسخة تجريبية إلى ${r.email}`, `🧪 Test sent to ${r.email}`));
    }finally{ if(typeof schoolBusy === "function") schoolBusy(btn, false); }
}

async function sendSchoolMessageNow(id, btn){
    if(!confirm(smsgLabel("ستصل هذه الرسالة بريد طلاب المدرسة الآن، ولا يمكن سحبها بعد إرسالها. متأكد؟",
                          "This goes to your students' email now and cannot be recalled. Continue?"))) return;
    if(typeof schoolBusy === "function") schoolBusy(btn, true);
    try{
        const r = await callSchoolEmail("schoolSendCampaign", id);
        if(r && r.ok){
            showToast(r.total === 0 ? smsgLabel("ℹ️ لا يوجد طالب تصله الرسالة حالياً", "ℹ️ No reachable students right now")
                : smsgLabel(`✅ أُرسلت إلى ${r.sent} طالباً${r.failed ? ` (فشلت ${r.failed})` : ""}`, `✅ Sent to ${r.sent}${r.failed ? ` (${r.failed} failed)` : ""}`));
        }
    }finally{
        if(typeof schoolBusy === "function") schoolBusy(btn, false);
        renderSchoolMessages();
    }
}

async function deleteSchoolMessage(id){
    if(!confirm(smsgLabel("حذف هذه الرسالة؟", "Delete this message?"))) return;
    try{
        const { error } = await sb.from("marketing_messages").delete().eq("id", id);
        if(error) throw error;
        renderSchoolMessages();
    }catch(e){ showToast(smsgError(e)); }
}
