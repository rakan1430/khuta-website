/* ============================================================
   رمز تحقق للإجراءات الحساسة — يُرسل إلى بريد المدير
   ------------------------------------------------------------
   قول المالك: «الأزرار التي تقوم بإجراء حساس … لن تظهر بهذه البساطة، وعليها
   طبقة أمان إضافية: يرسل النظام رسالة تأكيد برمز تحقق لإيميل الإداري، يكتبه
   لتأكيد الإجراء الحساس».

   المسار: هنا يُتحقّق أن الطالب مدير نشط بإثبات Google، ويُولَّد رمز من ٦ أرقام،
   وتُحفظ **بصمته فقط** في القاعدة (issue_sensitive_code — بحدّ: مرة في الدقيقة،
   ٥ في الساعة)، ويُرسل الرمز إلى بريد حساب المدير نفسه. والتحقق والاستهلاك في
   القاعدة (consume_sensitive_code داخل promote_school_year) — فلا طريق للترقية
   بلا الرمز حتى لمن يستدعي القاعدة مباشرة.

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY، BREVO_API_KEY (نفس send-email.js).
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84";

const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
});

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

async function verifyUser(accessToken){
    if(!accessToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
    });
    if(!res.ok) return null;
    return res.json();
}

function hasGoogleAmr(token){
    try{
        const part = String(token).split(".")[1];
        if(!part) return false;
        const pad = part.length % 4 ? "=".repeat(4 - (part.length % 4)) : "";
        const claims = JSON.parse(Buffer.from(
            part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8"));
        const amr = Array.isArray(claims.amr) ? claims.amr : [];
        return amr.some(m => (m && (m.method === "oauth" || m.method === "google")) || m === "oauth");
    }catch(e){ return false; }
}

async function adminMembership(uid, serviceKey){
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const url = `${SUPABASE_URL}/rest/v1/school_members` +
        `?uid=eq.${encodeURIComponent(uid)}&role=eq.admin&active=is.true&select=id,school_id`;
    const res = await fetch(url, { headers });
    if(!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
}

const ACTIONS = { promote_year: "ترقية السنة الدراسية" };
const SENDER_EMAIL = "soosrakan1430@gmail.com";   // المرسل الموثَّق في Brevo (انظر send-email.js)
const SENDER_NAME = "خُطى";

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[c]); }

exports.handler = async (event) => {
    if(!event || event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SCHOOL_SERVICE_ROLE_KEY");
    const brevoKey = env("BREVO_API_KEY");
    if(!serviceKey) return json(500, { error: "SERVICE_KEY_MISSING" });
    if(!brevoKey) return json(500, { error: "MAIL_NOT_CONFIGURED" });

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return json(400, { error: "BAD_JSON" }); }

    const action = String(payload.action || "");
    if(!ACTIONS[action]) return json(400, { error: "BAD_ACTION" });

    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id) return json(401, { error: "UNAUTHORIZED" });
    if(user.is_anonymous) return json(401, { error: "ANON_NOT_ALLOWED" });
    if(!hasGoogleAmr(payload.accessToken)) return json(403, { error: "NEEDS_GOOGLE" });
    const email = user.email;
    if(!email) return json(400, { error: "NO_EMAIL" });

    const admin = await adminMembership(user.id, serviceKey);
    if(!admin) return json(403, { error: "NOT_ADMIN" });

    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const hash = crypto.createHash("sha256").update(`${code}:${admin.id}`).digest("hex");

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/issue_sensitive_code`, {
        method: "POST",
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_member: admin.id, p_school: admin.school_id, p_action: action, p_hash: hash }),
    });
    if(!res.ok){
        const text = await res.text();
        if(/CODE_TOO_SOON/.test(text)) return json(429, { error: "CODE_TOO_SOON" });
        if(/CODE_TOO_MANY/.test(text)) return json(429, { error: "CODE_TOO_MANY" });
        console.error("[خُطى][رمز التحقق] فشل الحفظ:", res.status, text.slice(0, 200));
        return json(502, { error: "WRITE_FAILED" });
    }

    const html = `<div dir="rtl" style="font-family:sans-serif; line-height:1.9; color:#222;">
        <h2 style="margin:0 0 8px;">رمز تأكيد: ${esc(ACTIONS[action])}</h2>
        <p>طُلب تنفيذ إجراء حساس في منصة مدرستك على خُطى. رمز التأكيد:</p>
        <p style="font-size:30px; font-weight:800; letter-spacing:6px; direction:ltr; text-align:center; margin:14px 0;">${code}</p>
        <p>صالح لمدة ١٠ دقائق ولمرة واحدة. لا تشاركه مع أحد — ولا أحد من خُطى سيطلبه منك.</p>
        <p style="color:#a00;">إن لم تطلب هذا الإجراء فتجاهل الرسالة، وغيّر كلمة مرور حساب Google الخاص بك.</p>
    </div>`;
    try{
        const mail = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": brevoKey, "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({
                sender: { email: SENDER_EMAIL, name: SENDER_NAME },
                to: [{ email }],
                subject: `رمز تأكيد ${ACTIONS[action]} — خُطى`,
                htmlContent: html,
            }),
        });
        if(!mail.ok){
            console.error("[خُطى][رمز التحقق] فشل الإرسال:", mail.status, (await mail.text()).slice(0, 200));
            return json(502, { error: "MAIL_FAILED" });
        }
    }catch(e){
        console.error("[خُطى][رمز التحقق] خطأ الإرسال:", e);
        return json(502, { error: "MAIL_FAILED" });
    }

    // البريد مقنَّع في الردّ: يكفي المدير ليعرف أين يبحث
    const [u, d] = email.split("@");
    const masked = (u.length <= 2 ? u[0] + "*" : u.slice(0, 2) + "***" + u.slice(-1)) + "@" + d;
    return json(200, { ok: true, sentTo: masked, expiresIn: 600 });
};
