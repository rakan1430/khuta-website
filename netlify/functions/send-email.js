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

const ALLOWED_TYPES = ["examScore"];
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
