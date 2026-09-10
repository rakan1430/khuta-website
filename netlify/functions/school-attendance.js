/* ============================================================
   رفع غياب نور — الهوية تُحوَّل بصمةً هنا ولا تُخزَّن
   ------------------------------------------------------------
   وافق المالك: «الاستيراد والغياب — الفكرة التي اقترحتها أنت ممتازة
   ووافقتك فيها بشدّة، عن طريق الهوية ولكن بطريقة مشفّرة كما ذكرت أنت
   تماماً». وشرطه الأصلي قائم: «لن تُضاف أي بيانات رسمية من نور ولا أي
   بيانات شخصية للطالب».

   ⚠️ فالمطابقة تحتاج معرّفاً ثابتاً، والحفظ لا يحتاجه: نحسب البصمة،
   ونطابق بها، ونرمي الرقم. ونفس مفتاح school-import.js حرفاً بحرف —
   ولو اختلف لما طابق ملفُّ غيابٍ طالباً واحداً استُورد من قبل.

   ⚠️ ولماذا لا يحسبها المتصفّح؟ لأن المفتاح حينها في المتصفّح، ومن
   يملكه يولّد بصمة أي رقم هوية يخمّنه — وعشر خانات تُجرَّب كلّها في
   ثوانٍ. المفتاح هنا في بيئة الخادم ولا يغادرها.

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY، و SCHOOL_ID_PEPPER
   (نفس المستعمل في الاستيراد — لا تغيّره بعد أول استيراد).
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84";
const MAX_ROWS = 2000;

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

/* ⚠️ الأرقام العربية والفارسية تُصبح لاتينية قبل أي حساب — وإلا أعطى
   الرقم نفسه بصمتين مختلفتين حسب لوحة مفاتيح من كتبه. */
function normalizeDigits(s){
    return String(s == null ? "" : s)
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
        .replace(/\D/g, "");
}

function idFingerprint(rawId, pepper){
    const digits = normalizeDigits(rawId);
    if(digits.length < 8 || digits.length > 14) return null;
    return crypto.createHmac("sha256", pepper).update(digits).digest("hex");
}

/* أرقام الغياب قد تأتي فارغة أو بفواصل أو بأرقام عربية */
function toCount(v){
    const n = parseInt(normalizeDigits(v), 10);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 400) : 0;
}

exports.handler = async (event) => {
    if(!event || event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SCHOOL_SERVICE_ROLE_KEY");
    if(!serviceKey) return json(500, { error: "SERVICE_KEY_MISSING" });

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return json(400, { error: "BAD_JSON" }); }

    /* الترتيب: هوية ثم صلاحية ثم حمولة */
    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id) return json(401, { error: "UNAUTHORIZED" });
    if(user.is_anonymous) return json(401, { error: "ANON_NOT_ALLOWED" });
    if(!hasGoogleAmr(payload.accessToken)) return json(403, { error: "NEEDS_GOOGLE" });

    const admin = await adminMembership(user.id, serviceKey);
    if(!admin) return json(403, { error: "NOT_ADMIN" });

    const rows = Array.isArray(payload.rows) ? payload.rows : null;
    if(!rows || !rows.length) return json(400, { error: "NO_ROWS" });
    if(rows.length > MAX_ROWS) return json(400, { error: "TOO_MANY_ROWS", max: MAX_ROWS });

    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(payload.asOf || "")) ? payload.asOf : null;

    const pepper = env("SCHOOL_ID_PEPPER") || ("khuta-school-id:" + serviceKey);
    const prepared = [];
    let badId = 0;

    for(const row of rows){
        const hash = idFingerprint((row && row.national_id) || "", pepper);
        if(!hash){ badId++; continue; }
        prepared.push({
            hash,
            absent:  toCount(row.absent),
            late:    toCount(row.late),
            excused: toCount(row.excused),
        });
    }

    /* ⚠️ لا نستدعي الكتابة بصفرِ صفوفٍ صالحة: نداءٌ فارغ يبدو ناجحاً
       فيظنّ المدير الغياب رُفع وهو لم يُقرأ منه سطر. */
    if(!prepared.length){
        return json(200, { saved: 0, unmatched: 0, badId, note: "NO_VALID_ROWS" });
    }

    try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_attendance_snapshot`, {
            method: "POST",
            headers: {
                apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                p_school: admin.school_id, p_admin: admin.id,
                p_as_of: asOf, p_rows: prepared,
            }),
        });
        if(!res.ok){
            const text = await res.text();
            console.error("[خُطى][الغياب] فشلت الكتابة:", res.status, text.slice(0, 300));
            return json(502, { error: "WRITE_FAILED" });
        }
        const out = await res.json();
        return json(200, { ...out, badId });
    }catch(e){
        console.error("[خُطى][الغياب] خطأ:", e);
        return json(500, { error: "INTERNAL" });
    }
};
