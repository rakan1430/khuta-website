/* ============================================================
   خُطى — "نسيت كلمة المرور" من الخادم
   ------------------------------------------------------------
   لماذا صارت هذه الدالة ضرورية؟

   كان المتصفح يحوّل اسم المستخدم إلى بريده الحقيقي بنفسه ثم يطلب رسالة
   الاسترجاع. ومعنى ذلك أن أي شخص يكتب اسم مستخدم — وأسماء المستخدمين
   معروضة علناً في لوحة المتصدّرين والمجتمع — كان يستطيع قراءة بريد صاحبه
   من ردّ الشبكة. فحُصِّنت دالة التحويل بأن صارت تطلب كلمة المرور، لكن
   مسار "نسيت كلمة المرور" بطبيعته لا يملكها.

   الحل هنا: التحويل يبقى ممكناً لكن على الخادم وحده بمفتاح الخدمة، عبر
   resolve_username_email_admin التي لا يملك تنفيذها إلا service_role.
   المتصفح يرسل اسم المستخدم فقط، ويستقبل ردّاً واحداً لا يتغيّر أبداً —
   سواء وُجد الحساب أم لا — فلا يُستدلّ منه على وجود حساب من عدمه.

   ⚠️ رسالة الاسترجاع نفسها يرسلها Supabase Auth لا Brevo: التوكن لا يجوز
   أن يمرّ من هنا إطلاقاً. نحن نطلب منها الإرسال ولا نرى الرابط.

   ⚠️ redirect_to لا يُؤخذ من جسم الطلب أبداً: من يتحكّم به يوجّه رسالة
   الاسترجاع — ومعها التوكن — إلى موقعه هو. نشتقّه من رأس Origin ونقبله
   فقط إن كان موقعنا (وSupabase تفرض قائمتها البيضاء فوق ذلك).

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY (مضبوط أصلاً). لا جديد.
   ============================================================ */

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84"; // مفتاح عام آمن بالتصميم
const USERNAME_EMAIL_DOMAIN = "gmail.com";
const SITE_URL = "https://khutaa.netlify.app";

// نفس قاعدة send-email.js: البريد المصطنع khuta.{اسم}@gmail.com ليس بريداً
// يملكه صاحب الحساب، فإرسال رابط استرجاع إليه يسلّم حساباً لغريب
const SYNTHETIC_EMAIL_RE = new RegExp(`^khuta\\.[a-z0-9_.\\-]*@${USERNAME_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i");
const isRealEmail = (email) =>
    typeof email === "string" && email.includes("@") && !SYNTHETIC_EMAIL_RE.test(email.trim().toLowerCase());

const IP_LIMIT       = 5;                 // 5 محاولات
const IP_WINDOW_MS   = 15 * 60 * 1000;    // كل ربع ساعة من العنوان نفسه
const USER_LIMIT     = 3;                 // 3 رسائل
const USER_WINDOW_MS = 60 * 60 * 1000;    // كل ساعة للاسم نفسه (منعاً لإغراق بريد شخص)

const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
});

/* ⚠️ الردّ نفسه في كل الحالات الطبيعية — وجود الحساب من عدمه لا يُستدلّ
   عليه لا من النص ولا من رمز الحالة ولا من فرق زمن الاستجابة الملموس */
const GENERIC_OK = () => json(200, { ok: true });

function serviceHeaders(key){
    return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** عدّاد نافذة زمنية على جدول password_reset_log (خادمي بالكامل). */
async function rateLimited(key, limit, windowMs, headers){
    const url = `${SUPABASE_URL}/rest/v1/password_reset_log?key=eq.${encodeURIComponent(key)}&select=key,window_start,request_count`;
    try{
        const res = await fetch(url, { headers });
        if(!res.ok) return false; // فشل العدّاد نفسه لا يمنع طلباً مشروعاً
        const row = (await res.json())[0];
        const now = Date.now();

        if(row && (now - new Date(row.window_start).getTime()) < windowMs){
            if(row.request_count >= limit) return true;
            await fetch(url, {
                method: "PATCH",
                headers,
                body: JSON.stringify({ request_count: row.request_count + 1 }),
            });
            return false;
        }
        // نافذة جديدة (أو أول مرة)
        await fetch(`${SUPABASE_URL}/rest/v1/password_reset_log`, {
            method: "POST",
            headers: { ...headers, Prefer: "resolution=merge-duplicates" },
            body: JSON.stringify({ key, window_start: new Date(now).toISOString(), request_count: 1 }),
        });
        return false;
    }catch(e){
        console.error("[password-reset] تعذّر قياس المعدّل:", e);
        return false;
    }
}

/** يقبل عنوان العودة من Origin فقط، ولا يقبله من جسم الطلب إطلاقاً. */
function safeRedirect(event){
    const origin = (event.headers && (event.headers.origin || event.headers.Origin) || "").trim();
    if(!origin) return SITE_URL;
    try{
        const u = new URL(origin);
        if(u.protocol !== "https:") return SITE_URL;
        if(u.hostname === "khutaa.netlify.app" || u.hostname.endsWith(".netlify.app")) return u.origin;
    }catch(e){ /* عنوان غير صالح — نتجاهله */ }
    return SITE_URL;
}

exports.handler = async function(event){
    if(event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!key){
        console.error("[password-reset] SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
        return json(503, { error: "NOT_CONFIGURED" });
    }

    let username;
    try{
        username = String((JSON.parse(event.body || "{}") || {}).username || "").trim();
    }catch(e){ return json(400, { error: "BAD_JSON" }); }

    if(!username || username.length > 60) return GENERIC_OK();

    const headers = serviceHeaders(key);
    const ip = (event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"] ||
                (event.headers["x-forwarded-for"] || "").split(",")[0] || "unknown").trim();

    if(await rateLimited(`ip:${ip}`, IP_LIMIT, IP_WINDOW_MS, headers)) return GENERIC_OK();
    if(await rateLimited(`user:${username.toLowerCase()}`, USER_LIMIT, USER_WINDOW_MS, headers)) return GENERIC_OK();

    // التحويل بمفتاح الخدمة — البريد لا يغادر الخادم في أي فرع من الفروع
    let email = null;
    try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/resolve_username_email_admin`, {
            method: "POST",
            headers,
            body: JSON.stringify({ p_username: username }),
        });
        if(res.ok){
            const rows = await res.json();
            if(Array.isArray(rows) && rows[0]) email = rows[0].email;
        }
    }catch(e){
        console.error("[password-reset] تعذّر تحويل اسم المستخدم:", e);
    }

    // لا حساب، أو حساب بلا بريد حقيقي مرتبط → نفس الردّ تماماً بلا إرسال
    if(!isRealEmail(email)) return GENERIC_OK();

    try{
        const redirectTo = safeRedirect(event);
        const res = await fetch(`${SUPABASE_URL}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
        });
        // ⚠️ لا نُمرّر خطأ Supabase للمتصفح: نصّه يفرّق بين الحالات فيكشف الحساب
        if(!res.ok) console.error("[password-reset] استجابة recover:", res.status, await res.text());
    }catch(e){
        console.error("[password-reset] تعذّر طلب رسالة الاسترجاع:", e);
    }

    return GENERIC_OK();
};
