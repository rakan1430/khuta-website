/* ============================================================
   رفع الدرجات الرسمية من ملف نور — الهوية تُحوَّل بصمةً هنا ولا تُخزَّن
   ------------------------------------------------------------
   قرار المالك: درجات الفترات والنهائي تُستورد من ملف تصدير نور كما
   الغياب، وتُعرض **كما هي** — لا نحسب درجة ولا متوسطاً ولا تقديراً.
   فالخادم لا يفسّر الأرقام: ينقل الأعمدة التي اختارها المدير بعناوينها
   ونصوصها، ويطابق الطالب ببصمة هويته ثم يرمي الرقم.

   ⚠️ نفس مفتاح البصمة في school-import.js و school-attendance.js حرفاً
   بحرف — ولو اختلف لما طابق ملفُّ درجاتٍ طالباً واحداً.

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY، و SCHOOL_ID_PEPPER.
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

const TERMS = ["t1", "t2", "t3", "final"];
const MAX_ITEMS = 30;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* نصّ الخلية كما هو (مقصوصاً) — لا تحويل لرقم: «ممتاز» و«٣٨» و«غ» كلها
   قيم رسمية تُعرض كما كُتبت في نور. */
function cellText(v, max){
    return String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, max);
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

    const term = TERMS.includes(payload.term) ? payload.term : null;
    if(!term) return json(400, { error: "BAD_TERM" });
    /* «1447» أو «١٤٤٧/١٤٤٨»: الأرقام لاتينية والفواصل تبقى */
    const year = cellText(String(payload.year == null ? "" : payload.year)
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660)), 20);
    if(!year) return json(400, { error: "BAD_YEAR" });
    const subjectId = payload.subjectId == null || payload.subjectId === "" ? null
        : (UUID_RE.test(String(payload.subjectId)) ? String(payload.subjectId) : undefined);
    if(subjectId === undefined) return json(400, { error: "BAD_SUBJECT" });

    const pepper = env("SCHOOL_ID_PEPPER") || ("khuta-school-id:" + serviceKey);
    const prepared = [];
    let badId = 0;

    for(const row of rows){
        const hash = idFingerprint((row && row.national_id) || "", pepper);
        if(!hash){ badId++; continue; }
        const items = (Array.isArray(row.items) ? row.items : []).slice(0, MAX_ITEMS)
            .map(it => ({ label: cellText(it && it.label, 60), value: cellText(it && it.value, 40) }))
            .filter(it => it.label);
        prepared.push({ hash, items });
    }

    if(!prepared.length){
        return json(200, { saved: 0, unmatched: 0, badId, note: "NO_VALID_ROWS" });
    }

    try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/apply_official_grades`, {
            method: "POST",
            headers: {
                apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                p_school: admin.school_id, p_admin: admin.id, p_year: year, p_term: term,
                p_subject: subjectId, p_source: cellText(payload.source, 120) || null, p_rows: prepared,
            }),
        });
        if(!res.ok){
            const text = await res.text();
            console.error("[خُطى][الدرجات] فشلت الكتابة:", res.status, text.slice(0, 300));
            if(/BAD_SUBJECT/.test(text)) return json(400, { error: "BAD_SUBJECT" });
            return json(502, { error: "WRITE_FAILED" });
        }
        const out = await res.json();
        return json(200, { ...out, badId });
    }catch(e){
        console.error("[خُطى][الدرجات] خطأ:", e);
        return json(500, { error: "INTERNAL" });
    }
};
