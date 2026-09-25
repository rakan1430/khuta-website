/* ============================================================
   خُطى — دالة وسيطة لإرسال البريد عبر Brevo
   ------------------------------------------------------------
   ⚠️ نفس درس الأمان المستفاد من gemini-proxy.js بالضبط: لا نثق بأي بريد
   أو محتوى يرسله المتصفح مباشرة — لولا ذلك، أي شخص يستدعي هذه الدالة
   مباشرة يقدر يرسل بريداً عشوائياً لأي عنوان عبر حصة Brevo الخاصة بالموقع
   (بريد مزعج/تصيّد باسم خُطى). الإصلاح: نتحقق من هوية المتصل فعلياً عبر
   Supabase (بتوكن الجلسة الحقيقي)، ونشتق بريد المستلم من حساب ذلك
   المستخدم المُتحقَّق منه فقط — لا من أي حقل "to" يرسله الطلب.

   متغيّرات البيئة المطلوبة على Netlify:
   - BREVO_API_KEY (من Brevo → Settings → SMTP & API → API Keys، يبدأ بـ xkeysib-)
   - SUPABASE_SERVICE_ROLE_KEY (نفس المتغيّر المستخدم في gemini-proxy.js)

   ⚠️ إضافة (رسائل الحملات لا تبدو واضحة/موثوقة للطلاب): رسائل adminSendCampaign
   الآن تحمل تذييلاً واضحاً يشرح فعلياً لماذا وصلت هذه الرسالة (موافقة صريحة
   عند التسجيل) + رابط إلغاء اشتراك حقيقي بضغطة واحدة، ورأس بريد
   List-Unsubscribe قياسي (يدعمه Gmail/Outlook/ياهو مجاناً بلا أي خدمة
   مدفوعة أو نطاق بريد مخصص). هذا يرفع شفافية الرسالة (تقلّل شعورها كرسالة
   دعائية مجهولة المصدر) ويحسّن فرص وصولها لصندوق البريد الرئيسي بدل
   التصنيف التلقائي كـ"ترويجية" — رابط الإلغاء موقَّع (HMAC) بمفتاح
   SUPABASE_SERVICE_ROLE_KEY نفسه، فلا يحتاج متغيّر بيئة إضافي، ويُتحقَّق
   منه في netlify/functions/unsubscribe.js.
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84"; // مفتاح عام آمن بالتصميم، نفسه المستخدم في app.js
const USERNAME_EMAIL_DOMAIN = "gmail.com";
/* ⚠️ يجب أن يكون هذا العنوان مُضافاً ومُتحقَّقاً منه فعلياً في Brevo
   (Settings → Senders, domains, IPs → Senders). كان مضبوطاً سابقاً على
   no-reply@khutaa.netlify.app بافتراض خاطئ أن Brevo تقبل أي عنوان — لكنها
   رفضت كل رسالة فعلياً بالسبب الحرفي: "the sender you used ... is not valid"،
   فكانت الرسائل تظهر "أُرسلت" في اللوحة ثم لا تصل أحداً إطلاقاً.
   لتغييره مستقبلاً (مثلاً لنطاق خاص): أضف العنوان الجديد في Brevo وفعّله
   عبر رابط التأكيد أولاً، ثم غيّره هنا. */
const SENDER_EMAIL = "soosrakan1430@gmail.com";
const SENDER_NAME = "خُطى";
const SITE_URL = "https://khutaa.netlify.app";

const ALLOWED_TYPES = ["examScore", "adminTest", "adminSendCampaign", "schoolTest", "schoolSendCampaign", "scheduledRun"];

// رابط إلغاء اشتراك موقَّع لكل مستخدم — لا يحتاج جدول توكنات منفصل، فقط
// HMAC بمفتاح سرّي موجود أصلاً على الخادم (service_role). أي تلاعب بـuid
// في الرابط يُبطل التوقيع فوراً (يُتحقَّق منه في unsubscribe.js).
function buildUnsubscribeToken(userId, secret){
    return crypto.createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}
// scope=school: إيقاف رسائل إدارة المدرسة وحدها (توقيعه مختلف عمداً فلا يصلح
// رابطٌ لنطاقٍ في الآخر) — يُتحقَّق منه في unsubscribe.js
function buildUnsubscribeUrl(userId, secret, scope){
    if(scope === "school"){
        const token = buildUnsubscribeToken(`${userId}:school`, secret);
        return `${SITE_URL}/.netlify/functions/unsubscribe?uid=${encodeURIComponent(userId)}&scope=school&token=${token}`;
    }
    const token = buildUnsubscribeToken(userId, secret);
    return `${SITE_URL}/.netlify/functions/unsubscribe?uid=${encodeURIComponent(userId)}&token=${token}`;
}

// تذييل شفاف يوضّح فعلياً لماذا وصلت الرسالة ورابط إلغاء حقيقي — يُضاف فقط
// لرسائل الحملات (adminSendCampaign)، وليس لبريد نتيجة الاختبار (معاملاتي
// بحت، لا يخضع لموافقة marketing_consent أصلاً)
function appendUnsubscribeFooter(bodyHtml, unsubscribeUrl){
    return `${bodyHtml}
    <div style="margin-top:28px; padding-top:16px; border-top:1px solid #eee; font-family:sans-serif; direction:rtl; text-align:right; font-size:11px; color:#999; line-height:1.8;">
        وصلتك هذه الرسالة من تطبيق <b>خُطى</b> لأنك وافقت صراحةً على استقبال رسائل تذكيرية عند إنشاء حسابك (أو من إعدادات ملفك الشخصي).
        <a href="${unsubscribeUrl}" style="color:#999; text-decoration:underline;">إلغاء الاشتراك من هذه الرسائل نهائياً</a>
    </div>`;
}

// يتحقق من كون المستخدم مشرفاً فعلياً عبر جدول app_admins على الخادم —
// لا نثق إطلاقاً بأي ادعاء "أنا مشرف" قادم من المتصفح (نفس مبدأ gemini-proxy)
async function verifyAdmin(userId){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey) return false;
    try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/app_admins?uid=eq.${encodeURIComponent(userId)}&select=uid`, {
            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
        });
        if(!res.ok) return false;
        const rows = await res.json();
        return rows.length > 0;
    }catch(e){
        console.error("[send-email] تعذّر التحقق من صلاحية المشرف:", e);
        return false; // فشل التحقق = رفض (لا نفتح الباب عند الشك في مسار إداري)
    }
}

// يسجّل كل محاولة إرسال في email_campaign_log — لتعرف لاحقاً ما أُرسل فعلاً
async function logCampaignSend(messageId, email, status, errorDetail, isTest){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey) return;
    try{
        await fetch(`${SUPABASE_URL}/rest/v1/email_campaign_log`, {
            method: "POST",
            headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ message_id: messageId || null, recipient_email: email, status, error_detail: errorDetail || null, is_test: !!isTest }),
        });
    }catch(e){ console.error("[send-email] تعذّر تسجيل الإرسال:", e); }
}

/* ============================================================
   محرّك الرسائل الجماعية — لمن تصل، وكيف تُرسَل (٢٥ سبتمبر)
   ------------------------------------------------------------
   قاعدة «من يستلم» كلها في قاعدة البيانات (campaign_recipients في
   sql/PHASE8_MESSAGES.sql) لا هنا: رسالة خُطى لمن وافق فقط، ورسالة إدارة
   المدرسة لطلاب تلك المدرسة إلا من أوقفها. هذا الملف يرسل فقط.

   ⚠️ الإرسال بدفعات متوازية لا واحداً واحداً: دالّة Netlify تنتهي مهلتها
   بعد ثوانٍ، و٣٠٠ رسالة متتالية (~٢٠٠ms لكل واحدة) تتجاوزها بكثير فتنقطع
   في منتصف القائمة. والسجل يُكتب دفعةً واحدة في النهاية للسبب نفسه.

   ⚠️ القفل (sending_started_at): يُحجز قبل أول رسالة بتحديث مشروط واحد —
   فلو ضغط المدير «أرسل الآن» والمجدول يعمل في اللحظة نفسها، يفوز أحدهما
   ويعود الآخر بلا شيء، ولا تصل الرسالة مرّتين.
   ============================================================ */
const BREVO_DAILY_CAP = parseInt(process.env.BREVO_DAILY_CAP, 10) || 300;   // خطة Brevo المجانية: 300 رسالة يومياً
const SEND_CONCURRENCY = 8;

function svcHeaders(serviceKey, extra){
    return { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json", ...(extra || {}) };
}

async function svc(path, options){
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options, headers: svcHeaders(key, options && options.headers),
    });
    return res;
}

async function loadMessage(id){
    const res = await svc(`marketing_messages?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" });
    if(!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
}

async function schoolNameOf(schoolId){
    if(!schoolId) return "";
    const res = await svc(`schools?id=eq.${encodeURIComponent(schoolId)}&select=name_ar`, { method: "GET" });
    if(!res.ok) return "";
    const rows = await res.json();
    return (rows[0] && rows[0].name_ar) || "";
}

/** كم رسالة بقيت في حصة اليوم (توقيت UTC كما يعدّها Brevo). */
async function dailyQuotaRemaining(){
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const res = await svc(`email_campaign_log?select=id&is_test=eq.false&status=eq.sent&sent_at=gte.${start.toISOString()}`, {
        method: "HEAD", headers: { "Prefer": "count=exact", "Range": "0-0" },
    });
    const range = res.headers.get("content-range") || "";
    const used = parseInt(range.split("/")[1], 10) || 0;
    return Math.max(0, BREVO_DAILY_CAP - used);
}

// رسالة المدرسة نصّ عادي: يُهرَّب كله ثم تُحوَّل الأسطر — لا HTML من المتصفّح
function schoolTextToHtml(text, schoolName){
    const safe = escapeHtmlServer(text).replace(/\r?\n/g, "<br>");
    return `<div style="font-family:Tahoma,Arial,sans-serif; direction:rtl; text-align:right; max-width:560px; margin:auto; padding:20px; color:#2b2b2b; line-height:1.9;">
        <div style="font-size:12px; color:#8a6212; font-weight:700; margin-bottom:10px;">رسالة من إدارة ${escapeHtmlServer(schoolName || "المدرسة")}</div>
        <div style="font-size:15px;">${safe}</div>
    </div>`;
}

function escapeHtmlServer(s){
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function schoolFooter(bodyHtml, unsubscribeUrl, schoolName){
    return `${bodyHtml}
    <div style="margin-top:28px; padding-top:16px; border-top:1px solid #eee; font-family:sans-serif; direction:rtl; text-align:right; font-size:11px; color:#999; line-height:1.8;">
        وصلتك هذه الرسالة من إدارة <b>${escapeHtmlServer(schoolName || "مدرستك")}</b> عبر منصّة خُطى، لأنك طالب مسجَّل فيها.
        <a href="${unsubscribeUrl}" style="color:#999; text-decoration:underline;">إيقاف رسائل المدرسة</a>
    </div>`;
}

/** محتوى الرسالة لمستلم واحد، مع تذييلها ورؤوس الإلغاء. */
function composeFor(message, recipient, schoolName, serviceKey){
    const isSchool = message.origin === "school";
    const base = message.body_format === "text" ? schoolTextToHtml(message.body_html, schoolName) : message.body_html;
    if(!serviceKey || !recipient.uid) return { html: base };
    const unsubUrl = buildUnsubscribeUrl(recipient.uid, serviceKey, isSchool ? "school" : null);
    return {
        html: isSchool ? schoolFooter(base, unsubUrl, schoolName) : appendUnsubscribeFooter(base, unsubUrl),
        headers: { "List-Unsubscribe": `<${unsubUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    };
}

/** يحجز الرسالة للإرسال. يعيدها إن فاز بالحجز، وnull إن سبقه غيره. */
async function claimMessage(message, { allowResend }){
    let filter = `id=eq.${message.id}&sending_started_at=is.null`;
    if(!allowResend) filter += "&sent_at=is.null";
    const res = await svc(`marketing_messages?${filter}`, {
        method: "PATCH", headers: { "Prefer": "return=representation" },
        body: JSON.stringify({ sending_started_at: new Date().toISOString() }),
    });
    if(!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
}

async function deliverMessage(message, apiKey){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const rres = await svc("rpc/campaign_recipients", { method: "POST", body: JSON.stringify({ p_message: message.id }) });
    if(!rres.ok) return { error: "recipients_failed", detail: (await rres.text()).slice(0, 200) };
    const recipients = await rres.json();
    if(!recipients.length) return { sent: 0, failed: 0, total: 0, note: "لا يوجد مستلمون مستحقون حالياً" };

    const remaining = await dailyQuotaRemaining();
    if(recipients.length > remaining){
        return { error: "over_quota", total: recipients.length, remaining, cap: BREVO_DAILY_CAP };
    }

    const schoolName = message.origin === "school" ? await schoolNameOf(message.school_id) : "";
    const subject = message.origin === "school" && schoolName ? `${message.subject} — ${schoolName}` : message.subject;
    const logs = [];
    let sent = 0, failed = 0;
    for(let i = 0; i < recipients.length; i += SEND_CONCURRENCY){
        const batch = recipients.slice(i, i + SEND_CONCURRENCY);
        await Promise.all(batch.map(async r => {
            const { html, headers } = composeFor(message, r, schoolName, serviceKey);
            try{
                const up = await sendViaBrevo(apiKey, r.email, r.name, subject, html, headers);
                if(up.ok){ sent++; logs.push({ message_id: message.id, recipient_email: r.email, status: "sent", is_test: false }); }
                else{ failed++; logs.push({ message_id: message.id, recipient_email: r.email, status: "failed", error_detail: (await up.text()).slice(0, 300), is_test: false }); }
            }catch(e){
                failed++; logs.push({ message_id: message.id, recipient_email: r.email, status: "failed", error_detail: String(e.message || e).slice(0, 300), is_test: false });
            }
        }));
    }
    if(logs.length) await svc("email_campaign_log", { method: "POST", body: JSON.stringify(logs) });
    return { sent, failed, total: recipients.length };
}

/** يحجز ثم يرسل ثم يسجّل النتيجة على الرسالة. */
async function runMessage(message, apiKey, { manual }){
    // رسالة خُطى يعيد المالك إرسالها يدوياً متى شاء (كما كانت دائماً)؛
    // رسالة المدرسة والرسالة المجدولة تُرسلان مرّة واحدة فقط.
    const allowResend = manual && message.origin === "owner";
    const claimed = await claimMessage(message, { allowResend });
    if(!claimed) return { error: "already_sending_or_sent" };

    let result;
    try{ result = await deliverMessage(claimed, apiKey); }
    catch(e){ result = { error: "send_crashed", detail: String(e.message || e).slice(0, 200) }; }

    const done = !result.error;
    const patch = { send_result: { ...result, at: new Date().toISOString(), manual: !!manual } };
    if(done) patch.sent_at = new Date().toISOString();
    // يُفكّ القفل عند الفشل (ليُعاد لاحقاً)، وبعد رسالة خُطى اليدوية (لتُعاد متى شاء المالك)
    if(!done || allowResend) patch.sending_started_at = null;
    await svc(`marketing_messages?id=eq.${claimed.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    return result;
}

/** توقيع نداء المجدول: HMAC بالمفتاح السرّي على نافذة ٥ دقائق. */
function scheduleSig(serviceKey, bucket){
    return crypto.createHmac("sha256", serviceKey).update(`scheduled-run:${bucket}`).digest("hex");
}
function validScheduleSig(serviceKey, sig){
    if(typeof sig !== "string" || sig.length !== 64) return false;
    const now = Math.floor(Date.now() / 300000);
    return [now, now - 1].some(b => {
        const exp = scheduleSig(serviceKey, b);
        return crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(sig));
    });
}

/** الرسائل المجدولة التي حان وقتها — يناديها send-campaigns.js كل ربع ساعة. */
async function runDueMessages(apiKey){
    const nowIso = new Date().toISOString();
    const res = await svc(`marketing_messages?select=*&active=eq.true&sent_at=is.null&sending_started_at=is.null&send_after=not.is.null&send_after=lte.${nowIso}&order=send_after.asc&limit=3`, { method: "GET" });
    if(!res.ok) return { error: "list_failed" };
    const due = await res.json();
    const results = [];
    for(const m of due) results.push({ id: m.id, ...(await runMessage(m, apiKey, { manual: false })) });
    return { ran: results.length, results };
}

const COOLDOWN_MS = 5 * 60 * 1000; // حماية إضافية: لا يزيد عن رسالة واحدة كل 5 دقائق لنفس المستخدم، حتى لو تكرر الاستدعاء بالخطأ

// يتحقق من توكن الجلسة فعلياً عبر Supabase نفسها (لا نثق بأي id/email يرسله الطلب مباشرة)
async function verifyUser(accessToken){
    if(!accessToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { "Authorization": `Bearer ${accessToken}`, "apikey": SUPABASE_ANON_KEY },
    });
    if(!res.ok) return null;
    return res.json();
}

// ⚠️ إصلاح أمني: هذه الدالة كانت تبني البريد المصطنع المتوقَّع من اسم مستخدم
// قادم من *جسم الطلب* (payload.username) ثم تقارنه ببريد الجلسة. أي طالب مسجَّل
// كان يستطيع إرسال اسم مستخدم مختلف عن اسمه الحقيقي، فتفشل المطابقة ويُعتبَر
// بريده المصطنع "حقيقياً" — فتُرسَل نتيجته فعلياً إلى khuta.{اسمه}@gmail.com،
// وهو عنوان Gmail قابل لأن يخص شخصاً حقيقياً تماماً (Gmail يتجاهل النقاط، أي
// khuta.ali@gmail.com = khutaali@gmail.com). النتيجة: بريد غير مرغوب لطرف ثالث
// + تسريب اسم الطالب ودرجته له + خطر إدراج نطاق المرسِل في القوائم السوداء.
//
// الإصلاح: لا نستقبل اسم المستخدم إطلاقاً في هذا القرار. النمط نفسه يكفي —
// كل البُنى المصطنعة تبدأ بـ"khuta." على نطاق gmail، فنطابقه مباشرة.
const SYNTHETIC_EMAIL_RE = new RegExp(`^khuta\\.[a-z0-9_.\\-]*@${USERNAME_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i");

function isRealEmail(email){
    if(!email || typeof email !== "string") return false;
    return !SYNTHETIC_EMAIL_RE.test(email.trim().toLowerCase());
}

// اسم المخاطَبة في الرسالة — من حساب المستخدم المُتحقَّق منه وحده، لا من
// جسم الطلب (اسمٌ يرسله المتصفح يعني أن أي أحد يكتب ما يشاء في رسالة باسم خُطى)
async function getDisplayName(user){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(serviceKey && user && user.id){
        try{
            const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${encodeURIComponent(user.id)}&select=username`, {
                headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` },
            });
            if(res.ok){
                const rows = await res.json();
                if(rows[0] && rows[0].username) return String(rows[0].username).slice(0, 60);
            }
        }catch(e){ console.error("[send-email] تعذّر جلب اسم المستخدم:", e); }
    }
    const meta = (user && user.user_metadata) || {};
    return String(meta.full_name || meta.name || "بطل").slice(0, 60);
}

async function checkCooldown(userId){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey) return { allowed: true };
    const headers = { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" };
    const restBase = `${SUPABASE_URL}/rest/v1/email_send_log`;
    try{
        const getRes = await fetch(`${restBase}?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers });
        if(!getRes.ok) throw new Error("select failed: " + getRes.status);
        const rows = await getRes.json();
        const row = rows[0];
        const now = new Date();
        if(row && (now - new Date(row.last_sent_at)) < COOLDOWN_MS) return { allowed: false };
        await fetch(restBase, {
            method: "POST",
            headers: { ...headers, "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({ user_id: userId, last_sent_at: now.toISOString() }),
        });
        return { allowed: true };
    }catch(e){
        console.error("[send-email] تعذّر التحقق من فترة التهدئة:", e);
        return { allowed: true }; // فشل التحقق نفسه لا يجب أن يمنع رسالة مشروعة
    }
}

function buildExamScoreEmail(name, score, total, examTypeLabel){
    const pct = Math.round((score / total) * 100);
    return `
    <div style="font-family:sans-serif; direction:rtl; text-align:right; max-width:480px; margin:0 auto; padding:24px; background:#f7f4ee;">
        <h2 style="color:#C9962E;">أهلاً ${name || "بطل"} 👋</h2>
        <p style="font-size:15px; line-height:1.8; color:#333;">أنهيت للتو ${examTypeLabel} في خُطى — هذه نتيجتك:</p>
        <div style="background:#fff; border-radius:16px; padding:20px; text-align:center; margin:20px 0; border:1px solid #eee;">
            <div style="font-size:42px; font-weight:800; color:#C9962E;">${pct}%</div>
            <div style="font-size:13px; color:#888;">${score} من ${total} سؤال إجابة صحيحة</div>
        </div>
        <p style="font-size:13px; color:#888;">استمر في التدريب — كل اختبار محاكي يقرّبك أكثر من اختبارك الحقيقي.</p>
        <p style="font-size:11px; color:#aaa; margin-top:30px;">وصلتك هذه الرسالة لأنك ربطت بريدك الإلكتروني بحسابك في خُطى.</p>
    </div>`;
}

// extraHeaders (اختياري): رؤوس بريد فعلية تُرسَل مع الرسالة نفسها (مثل
// List-Unsubscribe) — Brevo تمرّرها كما هي عبر حقل "headers" في طلبها
async function sendViaBrevo(apiKey, toEmail, toName, subject, html, extraHeaders){
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
            sender: { email: SENDER_EMAIL, name: SENDER_NAME },
            to: [{ email: toEmail, name: toName || undefined }],
            subject, htmlContent: html,
            ...(extraHeaders ? { headers: extraHeaders } : {}),
        }),
    });
    return res;
}

exports.handler = async function(event){
    if(event.httpMethod !== "POST") return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };

    const apiKey = process.env.BREVO_API_KEY;
    if(!apiKey) return { statusCode: 500, body: JSON.stringify({ error: "BREVO_API_KEY غير مضبوط على الخادم" }) };

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }catch(e){ return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) }; }

    const type = payload.type;
    if(typeof type !== "string" || !ALLOWED_TYPES.includes(type)){
        return { statusCode: 400, body: JSON.stringify({ error: "قيمة type غير صالحة" }) };
    }

    /* ---------- المجدول (send-campaigns.js) — بلا جلسة مستخدم، بتوقيع خادم ---------- */
    if(type === "scheduledRun"){
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if(!serviceKey || !validScheduleSig(serviceKey, payload.sig)){
            return { statusCode: 403, body: JSON.stringify({ error: "توقيع غير صالح" }) };
        }
        const out = await runDueMessages(apiKey);
        return { statusCode: 200, body: JSON.stringify(out) };
    }

    // is_anonymous مرفوض صراحةً: التطبيق ينشئ جلسة Supabase مجهولة صامتة لكل
    // ضيف (يحتاجها المجتمع)، وتوكنها صحيح تماماً فتعبر verifyUser بنجاح. بدون
    // هذا الشرط يستطيع أي زائر استنزاف حصة Brevo بطلبات متكررة. نفس الإصلاح
    // المطبَّق في gemini-proxy.js للسبب نفسه.
    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id || user.is_anonymous === true){
        return { statusCode: 401, body: JSON.stringify({ error: "جلسة غير صالحة" }) };
    }

    /* ---------- المسارات الإدارية (تحقق صلاحية مستقل على الخادم) ---------- */
    if(type === "adminTest" || type === "adminSendCampaign"){
        const admin = await verifyAdmin(user.id);
        if(!admin){
            return { statusCode: 403, body: JSON.stringify({ error: "هذه العملية للمشرفين فقط" }) };
        }
        try{
            const subject = String(payload.subject || "").slice(0, 300);
            const bodyHtml = String(payload.bodyHtml || "").slice(0, 50000);
            if(type === "adminTest" && (!subject || !bodyHtml)){
                return { statusCode: 400, body: JSON.stringify({ error: "العنوان والمحتوى مطلوبان" }) };
            }

            if(type === "adminTest"){
                // إرسال تجريبي: لعناوين يحددها المشرف فقط، ولا يمس أي طالب حقيقي
                const testEmails = Array.isArray(payload.testEmails) ? payload.testEmails.slice(0, 5) : [];
                if(testEmails.length === 0){
                    return { statusCode: 400, body: JSON.stringify({ error: "أدخل بريداً تجريبياً واحداً على الأقل" }) };
                }
                const results = [];
                for(const email of testEmails){
                    const clean = String(email).trim();
                    if(!clean.includes("@")) { results.push({ email: clean, ok:false, error:"بريد غير صالح" }); continue; }
                    const html = `<div style="background:#fff3cd;border:1px solid #ffc107;padding:10px;border-radius:8px;margin-bottom:14px;font-family:sans-serif;direction:rtl;text-align:right;font-size:12px;"><b>⚠️ رسالة تجريبية</b> — أُرسلت من لوحة إدارة خُطى للاختبار فقط، ولم تصل أي طالب.</div>${bodyHtml}`;
                    const up = await sendViaBrevo(apiKey, clean, null, "[تجريبي] " + subject, html);
                    const ok = up.ok;
                    await logCampaignSend(payload.messageId, clean, ok ? "sent" : "failed", ok ? null : await up.text(), true);
                    results.push({ email: clean, ok });
                }
                return { statusCode: 200, body: JSON.stringify({ ok:true, test:true, results }) };
            }

            // adminSendCampaign: إرسال فعلي — المستلمون من قاعدة البيانات حسب
            // جمهور الرسالة (خُطى / المدارس / الكل)، لا من المتصفّح
            const message = await loadMessage(payload.messageId);
            if(!message) return { statusCode: 404, body: JSON.stringify({ error: "الرسالة غير موجودة" }) };
            const result = await runMessage(message, apiKey, { manual: true });
            return { statusCode: result.error ? 409 : 200, body: JSON.stringify({ ok: !result.error, ...result }) };
        }catch(err){
            console.error("[send-email] خطأ في المسار الإداري:", err);
            return { statusCode: 500, body: JSON.stringify({ error: "خطأ داخلي: " + String(err.message || err) }) };
        }
    }

    /* ---------- إدارة المدرسة: رسائل لطلاب مدرستها وحدهم ---------- */
    if(type === "schoolTest" || type === "schoolSendCampaign"){
        try{
            const message = await loadMessage(payload.messageId);
            if(!message || message.origin !== "school") return { statusCode: 404, body: JSON.stringify({ error: "الرسالة غير موجودة" }) };
            // الصلاحية من قاعدة البيانات لا من المتصفّح: مدير نشِط في مدرسة الرسالة نفسها
            const mres = await svc(`school_members?uid=eq.${encodeURIComponent(user.id)}&school_id=eq.${encodeURIComponent(message.school_id)}&role=eq.admin&active=eq.true&select=id`, { method: "GET" });
            const mine = mres.ok ? await mres.json() : [];
            if(!mine.length) return { statusCode: 403, body: JSON.stringify({ error: "هذه الرسالة ليست لمدرستك" }) };

            if(type === "schoolTest"){
                if(!isRealEmail(user.email)) return { statusCode: 400, body: JSON.stringify({ error: "لا يوجد بريد حقيقي في حسابك" }) };
                const schoolName = await schoolNameOf(message.school_id);
                const html = `<div style="background:#fff3cd;border:1px solid #ffc107;padding:10px;border-radius:8px;margin-bottom:14px;font-family:sans-serif;direction:rtl;text-align:right;font-size:12px;"><b>⚠️ رسالة تجريبية</b> — هكذا ستصل طلابك، ولم تصل أحداً منهم.</div>${schoolTextToHtml(message.body_html, schoolName)}`;
                const up = await sendViaBrevo(apiKey, user.email, null, "[تجريبي] " + message.subject, html);
                await logCampaignSend(message.id, user.email, up.ok ? "sent" : "failed", up.ok ? null : await up.text(), true);
                return { statusCode: up.ok ? 200 : 502, body: JSON.stringify({ ok: up.ok, test: true, email: user.email }) };
            }
            if(message.sent_at) return { statusCode: 409, body: JSON.stringify({ error: "already_sending_or_sent" }) };
            const result = await runMessage(message, apiKey, { manual: true });
            return { statusCode: result.error ? 409 : 200, body: JSON.stringify({ ok: !result.error, ...result }) };
        }catch(err){
            console.error("[send-email] خطأ في مسار المدرسة:", err);
            return { statusCode: 500, body: JSON.stringify({ error: "خطأ داخلي" }) };
        }
    }

    if(!isRealEmail(user.email)){
        return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "لا يوجد بريد حقيقي مرتبط" }) };
    }

    const cooldown = await checkCooldown(user.id);
    if(!cooldown.allowed){
        return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: "cooldown" }) };
    }

    try{
        if(type === "examScore"){
            const score = parseInt(payload.score);
            const total = parseInt(payload.total);
            if(!Number.isFinite(score) || !Number.isFinite(total) || total <= 0){
                return { statusCode: 400, body: JSON.stringify({ error: "بيانات النتيجة غير صالحة" }) };
            }
            const examTypeLabel = payload.examTypeLabel === "verbal" ? "اختباراً لفظياً"
                : payload.examTypeLabel === "quant" ? "اختباراً كمياً" : "اختباراً كاملاً";
            /* ⚠️ خلل حقيقي: كان السطران التاليان يستعملان متغيّراً باسم
               username لا وجود له في هذا الملف إطلاقاً — فيرمي Node خطأ
               ReferenceError يبتلعه catch أدناه ويعيد 500. أي أن بريد نتيجة
               الاختبار لم يصل طالباً واحداً منذ كُتب. نجلب الاسم من حساب
               المستخدم المُتحقَّق منه نفسه (لا من جسم الطلب). */
            const displayName = await getDisplayName(user);
            const html = buildExamScoreEmail(displayName, score, total, examTypeLabel);
            const upstream = await sendViaBrevo(apiKey, user.email, displayName, "نتيجتك في اختبار خُطى المحاكي 🎯", html);
            if(!upstream.ok){
                const text = await upstream.text();
                console.error("[send-email] فشل Brevo:", upstream.status, text);
                return { statusCode: 502, body: JSON.stringify({ error: "فشل إرسال البريد" }) };
            }
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }catch(err){
        console.error("[send-email] خطأ غير متوقع:", err);
        return { statusCode: 500, body: JSON.stringify({ error: "خطأ داخلي" }) };
    }
};
