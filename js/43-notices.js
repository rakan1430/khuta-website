/* ============================================================
   43) إشعار تحديث الشروط — يصل كل مستخدمي خُطى
   ------------------------------------------------------------
   طلب المالك (٢٦ سبتمبر): «مع تعديلها يجب أن تصل رسالة لكل مستخدمي خُطى
   توضّح تحديث شروط الخدمة… وتصل لكل الطلاب حتى غير المفعّل استقبال
   الرسائل التذكيرية… وهذا سيكون بيدي أنا، أرسله من داخل الموقع… في
   أدوات المشرف».

   ⚠️ لماذا قناتان لا البريد وحده: من ٥٣٩ حساباً ١٧ فقط لها بريد حقيقي
   (قياس ٢٦ سبتمبر). البقية ضيوف أو حسابات اسم مستخدم بريدها مصطنع
   (khuta.…@gmail.com) — البريد لا يصلها أبداً. فزرّ المالك الواحد:
     ١) ينشر إشعاراً في الموقع (جدول site_notices) يراه كل من يفتح خُطى
        مرة واحدة — ضيفاً كان أو صاحب حساب.
     ٢) ويجهّز رسالة بريد «خدمة» (جمهور service) لكل من له بريد حقيقي،
        بلا شرط موافقة التذكيرات — ثم يرسلها.
   الصلاحية على الخادم (owner_publish_terms_notice): المالك وحده، بدخول
   Google حديث، والنصّ يُهرَّب هناك قبل أن يصل البريد.
   ============================================================ */

const TERMS_SEEN_KEY = "khuta_terms_seen";

/* ---------- ١) الإشعار داخل الموقع ---------- */
async function checkTermsNotice(){
    if(typeof sb === "undefined" || !sb) return;
    let notice;
    try{
        const { data, error } = await sb.from("site_notices").select("version, summary_ar, published_at")
            .eq("kind", "terms").order("published_at", { ascending: false }).limit(1);
        if(error || !data || !data[0]) return;
        notice = data[0];
    }catch(e){ return; }
    let seen = null;
    try{ seen = localStorage.getItem(TERMS_SEEN_KEY); }catch(e){ return; }
    if(seen === notice.version) return;
    /* زائر جديد تماماً لم يستعمل خُطى قبل: الشروط الحالية هي أول ما يقبله،
       فلا «تحديث» يُبلَّغ به — نعلّمه مقروءاً بصمت. */
    const usedBefore = !!(localStorage.getItem("khuta_intro_seen") || localStorage.getItem("khuta_name")
                          || localStorage.getItem("khuta_plan_days") || (typeof getSession === "function" && getSession()));
    if(!usedBefore){ try{ localStorage.setItem(TERMS_SEEN_KEY, notice.version); }catch(e){} return; }
    showTermsNotice(notice);
}

function showTermsNotice(notice){
    document.getElementById("terms-notice")?.remove();
    const ar = currentLang !== "en";
    const box = document.createElement("div");
    box.id = "terms-notice";
    box.className = "terms-notice";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = `
        <div class="terms-notice-card">
            <div class="terms-notice-icon">📜</div>
            <b>${ar ? "حدّثنا شروط الاستخدام وسياسة الخصوصية" : "We've updated our Terms and Privacy Policy"}</b>
            <div class="terms-notice-body">${escapeHtml(notice.summary_ar || "").replace(/\n/g, "<br>")}</div>
            <div class="terms-notice-links">
                <button type="button" class="btn btn-sm btn-outline" data-a="terms"><i class="fa-solid fa-file-contract"></i> ${ar ? "شروط الاستخدام" : "Terms"}</button>
                <button type="button" class="btn btn-sm btn-outline" data-a="privacy"><i class="fa-solid fa-shield-halved"></i> ${ar ? "سياسة الخصوصية" : "Privacy"}</button>
            </div>
            <button type="button" class="btn btn-block" data-a="ok">${ar ? "فهمت 👍" : "Got it 👍"}</button>
        </div>`;
    const done = () => { try{ localStorage.setItem(TERMS_SEEN_KEY, notice.version); }catch(e){} box.remove(); };
    box.querySelector('[data-a="ok"]').onclick = done;
    box.querySelector('[data-a="terms"]').onclick = () => { done(); openLegalModal("terms"); };
    box.querySelector('[data-a="privacy"]').onclick = () => { done(); openLegalModal("privacy"); };
    document.body.appendChild(box);
    requestAnimationFrame(() => box.classList.add("show"));
}

// بعد الإقلاع بهدوء: لا يزاحم شاشة التحميل ولا شاشة الدخول
window.addEventListener("load", () => {
    setTimeout(function tryShow(){
        const login = document.getElementById("login-overlay");
        const loginOpen = login && (login.style.display || getComputedStyle(login).display) !== "none";
        if(loginOpen){ setTimeout(tryShow, 4000); return; }
        checkTermsNotice();
    }, 3500);
});

/* ---------- ٢) لوحة المالك: نشر الإشعار وإرساله ---------- */
const TERMS_NOTICE_DEFAULT = `حدّثنا شروط الاستخدام وسياسة الخصوصية لتواكب ما أُضيف لخُطى:
• منصة المدارس: الاختبارات والواجبات والسجلّ والمكتبة والجدول الدراسي، وما تحفظه المدرسة عن طلابها ومن يطّلع عليه.
• المساعد الذكي الجديد: ما يُرسل له، والإدخال بالصوت.
• رسائل إدارة المدرسة لطلابها، ورسائل الخدمة مثل هذه الرسالة.
• مدة حفظ بيانات المدرسة وحذفها بعد نهاية العام الدراسي.
ومبدؤنا لم يتغيّر: لا نبيع بياناتك ولا نعرض إعلانات.`;

function openTermsNoticePanel(){
    if(typeof isAdmin === "undefined" || !isAdmin){ showToast("للمالك فقط"); return; }
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("terms-panel")?.remove();
    const ov = document.createElement("div");
    ov.id = "terms-panel";
    ov.className = "overlay-screen";
    ov.style.cssText = "display:flex; z-index:5100;";
    ov.innerHTML = `
        <div class="wizard-card" style="max-width:600px; text-align:start;">
            <h2 style="margin-bottom:6px;"><i class="fa-solid fa-file-contract"></i> إشعار تحديث الشروط</h2>
            <p class="card-sub" style="margin-bottom:14px;">يصل <b>كل</b> مستخدمي خُطى — حتى من أوقف الرسائل التذكيرية:
                بإشعار داخل الموقع يراه كل من يفتحه (ضيفاً أو بحساب) مرة واحدة، وببريد لكل من له بريد حقيقي.
                ⚠️ لا يُرسل إلا بعد تعديل نصّ الشروط نفسه في الموقع (النسخة الحالية في الكود: <b>${escapeHtml(TERMS_VERSION)}</b>).</p>
            <div class="form-group"><label for="tn-version">رقم نسخة الشروط</label>
                <input type="text" id="tn-version" maxlength="20" dir="ltr" value="${escapeHtml(TERMS_VERSION)}"></div>
            <div class="form-group"><label for="tn-summary">ملخّص ما تغيّر (يظهر في الإشعار والبريد)</label>
                <textarea id="tn-summary" rows="8" maxlength="1500">${escapeHtml(TERMS_NOTICE_DEFAULT)}</textarea></div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button type="button" class="btn btn-sm btn-outline" onclick="openLegalModal('terms')">راجع الشروط</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="openLegalModal('privacy')">راجع سياسة الخصوصية</button>
            </div>
            <div id="tn-result" class="uni-note" style="display:none; margin-top:12px;"></div>
            <div style="display:flex; gap:10px; margin-top:16px;">
                <button type="button" id="tn-send" class="btn btn-sm acc-btn" onclick="publishTermsNotice()"><i class="fa-solid fa-paper-plane"></i> انشر الإشعار وأرسل البريد</button>
                <button type="button" class="btn btn-sm btn-outline" onclick="document.getElementById('terms-panel').remove()">إغلاق</button>
            </div>
        </div>`;
    document.body.appendChild(ov);
}

async function publishTermsNotice(){
    if(!sb || typeof isAdmin === "undefined" || !isAdmin) return;
    const version = (document.getElementById("tn-version").value || "").trim();
    const summary = (document.getElementById("tn-summary").value || "").trim();
    const out = document.getElementById("tn-result");
    const say = html => { out.style.display = "block"; out.innerHTML = html; };
    if(!version || summary.length < 10){ say("اكتب رقم النسخة وملخّصاً لا يقلّ عن ١٠ أحرف."); return; }
    if(!confirm(`سينشر إشعار «تحديث الشروط — النسخة ${version}» داخل الموقع لكل المستخدمين، ويُرسل بريداً لكل من له بريد.\n\nلا يمكن التراجع عن الإرسال. متأكد؟`)) return;
    const btn = document.getElementById("tn-send");
    btn.disabled = true; btn.style.opacity = ".6";
    try{
        const { data, error } = await sb.rpc("owner_publish_terms_notice", { p_version: version, p_summary_ar: summary });
        if(error) throw error;
        say(`✅ نُشر الإشعار داخل الموقع. جارٍ إرسال البريد إلى ${data.reach} …`);
        const { data: sess } = await sb.auth.getSession();
        const accessToken = sess && sess.session && sess.session.access_token;
        const res = await fetch("/.netlify/functions/send-email", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "adminSendCampaign", accessToken, messageId: data.message_id }),
        });
        const r = await res.json().catch(() => ({}));
        if(r.error === "over_quota")
            say(`✅ نُشر الإشعار داخل الموقع.<br>⚠️ البريد لم يُرسل: ${r.total} مستلماً وبقي من حصّة اليوم ${r.remaining}. أرسله غداً من «إدارة رسائل البريد» (الرسالة محفوظة هناك).`);
        else if(!res.ok || r.error) say(`✅ نُشر الإشعار داخل الموقع.<br>⚠️ تعذّر البريد: ${escapeHtml(String(r.error || res.status))} — أعد إرساله من «إدارة رسائل البريد».`);
        else say(`✅ نُشر الإشعار داخل الموقع، وأُرسل البريد إلى ${r.sent} مستخدماً${r.failed ? ` (فشل ${r.failed})` : ""}.`);
    }catch(e){
        const m = String((e && e.message) || e);
        say(m.includes("NEEDS_GOOGLE") ? "أعد تسجيل الدخول بحساب Google ثم أعد المحاولة (حماية للإرسال الجماعي)."
          : m.includes("NOT_OWNER") ? "للمالك فقط." : "تعذّر النشر: " + escapeHtml(m));
    }finally{ btn.disabled = false; btn.style.opacity = ""; }
}
