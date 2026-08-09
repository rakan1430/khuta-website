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
   ============================================================ */

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84"; // مفتاح عام آمن بالتصميم، نفسه المستخدم في app.js
const USERNAME_EMAIL_DOMAIN = "gmail.com";
const SENDER_EMAIL = "no-reply@khutaa.netlify.app"; // اسم المُرسِل الظاهر للطالب — أي عنوان، Brevo لا يشترط تحققه للإرسال بحصة السجل المجاني
const SENDER_NAME = "خُطى";

const ALLOWED_TYPES = ["examScore", "adminTest", "adminSendCampaign"];

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

// يجلب قائمة المستلمين المستحقين فعلاً حسب نمط الرسالة
async function getCampaignRecipients(message){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey) return [];
    const headers = { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}` };
    // من وافق صراحةً فقط — شرط غير قابل للتجاوز مهما كان نمط الرسالة
    const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data?marketing_consent=eq.true&select=id,username,updated_at`, { headers });
    if(!res.ok) return [];
    const rows = await res.json();

    const eligible = [];
    for(const row of rows){
        if(message.send_mode === "behavior"){
            // نمط سلوكي: نرسل فقط لمن غاب فعلاً المدة المحددة. نعتمد على
            // updated_at (عمود حقيقي يُحدَّث مع كل مزامنة) بدل التنقيب داخل
            // حقل JSON — أدق وأبسط وأقل عرضة للكسر إن تغيّرت بنية البيانات
            if(!row.updated_at) continue;
            const daysSince = (Date.now() - new Date(row.updated_at).getTime()) / 86400000;
            if(daysSince < (message.inactive_days || 5)) continue;
        }
        // نجلب البريد الحقيقي من auth عبر معرّف المستخدم
        const uRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${row.id}`, { headers });
        if(!uRes.ok) continue;
        const user = await uRes.json();
        if(!user.email || !isRealEmail(user.email, row.username)) continue;
        eligible.push({ email: user.email, name: row.username });
    }
    return eligible;
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

function isRealEmail(email, username){
    if(!email) return false;
    // البريد الوهمي الداخلي يُبنى دائماً بنمط khuta.{اسم_المستخدم}@gmail.com — أي بريد
    // مختلف عن هذا النمط يعني الطالب ربط بريداً حقيقياً فعلاً
    const clean = (username || "").trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const synthetic = `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`;
    return email.toLowerCase() !== synthetic;
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

async function sendViaBrevo(apiKey, toEmail, toName, subject, html){
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
            sender: { email: SENDER_EMAIL, name: SENDER_NAME },
            to: [{ email: toEmail, name: toName || undefined }],
            subject, htmlContent: html,
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

    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id){
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
            if(!subject || !bodyHtml){
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

            // adminSendCampaign: إرسال فعلي للطلاب المستحقين
            const message = payload.message || {};
            const recipients = await getCampaignRecipients({
                send_mode: message.send_mode || "broadcast",
                inactive_days: message.inactive_days || 5,
            });
            if(recipients.length === 0){
                return { statusCode: 200, body: JSON.stringify({ ok:true, sent:0, note:"لا يوجد مستلمون مستحقون حالياً" }) };
            }
            let sent = 0, failed = 0;
            for(const r of recipients){
                const up = await sendViaBrevo(apiKey, r.email, r.name, subject, bodyHtml);
                if(up.ok){ sent++; await logCampaignSend(payload.messageId, r.email, "sent", null, false); }
                else { failed++; await logCampaignSend(payload.messageId, r.email, "failed", await up.text(), false); }
            }
            return { statusCode: 200, body: JSON.stringify({ ok:true, sent, failed, total: recipients.length }) };
        }catch(err){
            console.error("[send-email] خطأ في المسار الإداري:", err);
            return { statusCode: 500, body: JSON.stringify({ error: "خطأ داخلي: " + String(err.message || err) }) };
        }
    }

    const username = payload.username; // فقط لبناء نمط البريد الوهمي للمقارنة، لا يُستخدم كمعرّف هوية
    if(!isRealEmail(user.email, username)){
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
            const html = buildExamScoreEmail(username, score, total, examTypeLabel);
            const upstream = await sendViaBrevo(apiKey, user.email, username, "نتيجتك في اختبار خُطى المحاكي 🎯", html);
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
