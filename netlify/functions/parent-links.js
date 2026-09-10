/* ============================================================
   روابط أولياء الأمور — تُولَّد على الخادم وحده
   ------------------------------------------------------------
   وافق المالك على الفكرة: «بخصوص الروابط التي تُنشأ لولي الأمر فأنت
   محق تماماً». والمدير يفتح فصلاً فيحصل على رابطٍ لكل طالب، ويصدّرها
   ملفاً يوزّعه على أولياء الأمور مرّة.

   ⚠️ ولماذا لا يحسبها المتصفّح؟ لأن التوقيع يحتاج سرّاً، وأي سرّ في
   المتصفّح ليس سرّاً — وحينها يولّد أي طالبٍ رابط أي زميل ويقرأ درجاته.
   السرّ هنا في بيئة الخادم ولا يغادرها.

   ⚠️ والرابط محسوب لا مخزَّن: HMAC على (معرّف الطالب + رقم النسخة).
   فلا جدول رموزٍ ينمو، ولا صفّ يُسرَّب، والإلغاء رفعُ رقم النسخة وحده.

   ⚠️ والإصدار يشترط إثبات Google كبقية الأفعال الحسّاسة: الدخول السريع
   على السبورة يكفي لعرض حصّة، ولا يكفي لتوليد روابط تكشف درجات فصل
   كامل. والسبورة تبقى مفتوحةً في الفصل بين الحصص.

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY (مضبوط أصلاً)،
   و PARENT_LINK_PEPPER اختياري — إن غاب اشتُقّ من مفتاح الخدمة.
   ⚠️ وتغييره يُبطل كل الروابط الموزَّعة دفعةً واحدة.
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_4BW-zO8Z5yxFXPHZnhl99A_rWFb2k84";
const SITE_URL = "https://khutaa.netlify.app";
const MAX_STUDENTS = 600;

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

/* ⚠️ ‎base64url‎ مقصوصة إلى ٢٢ حرفاً = ١٣٢ بتاً. تخمينه غير وارد عملياً،
   وطولُه يبقى صالحاً لرسالة واتساب. */
function signStudent(memberId, version, pepper){
    return crypto.createHmac("sha256", pepper)
        .update(`${memberId}:${version}`)
        .digest("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
        .slice(0, 22);
}

function parentPepper(serviceKey){
    return env("PARENT_LINK_PEPPER") || ("khuta-parent-link:" + serviceKey);
}

exports.handler = async (event) => {
    if(!event || event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SCHOOL_SERVICE_ROLE_KEY");
    if(!serviceKey) return json(500, { error: "SERVICE_KEY_MISSING" });

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return json(400, { error: "BAD_JSON" }); }

    /* ⚠️ الترتيب مقصود: هوية ثم صلاحية ثم حمولة. من يفحص الحمولة أولاً
       يُخبر المجهولَ بشكل بياناته قبل أن يعرف من هو. */
    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id) return json(401, { error: "UNAUTHORIZED" });
    if(user.is_anonymous) return json(401, { error: "ANON_NOT_ALLOWED" });
    if(!hasGoogleAmr(payload.accessToken)) return json(403, { error: "NEEDS_GOOGLE" });

    const admin = await adminMembership(user.id, serviceKey);
    if(!admin) return json(403, { error: "NOT_ADMIN" });

    const classId = String(payload.classId || "").trim();
    if(!/^[0-9a-f-]{36}$/i.test(classId)) return json(400, { error: "BAD_CLASS" });

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    try{
        /* الفصل من مدرسة هذا المدير — وإلا ولّد روابط فصلٍ في مدرسة أخرى */
        const clsRes = await fetch(`${SUPABASE_URL}/rest/v1/classes` +
            `?id=eq.${encodeURIComponent(classId)}&select=id,name,school_id`, { headers });
        const cls = clsRes.ok ? (await clsRes.json())[0] : null;
        if(!cls) return json(404, { error: "CLASS_NOT_FOUND" });
        if(cls.school_id !== admin.school_id) return json(403, { error: "OTHER_SCHOOL" });

        const memRes = await fetch(`${SUPABASE_URL}/rest/v1/class_students` +
            `?class_id=eq.${encodeURIComponent(classId)}` +
            `&select=school_members!inner(id,full_name,active,role,parent_link_version)` +
            `&limit=${MAX_STUDENTS}`, { headers });
        if(!memRes.ok) return json(502, { error: "READ_FAILED" });
        const rows = await memRes.json();

        const pepper = parentPepper(serviceKey);
        const links = rows
            .map(r => r.school_members)
            .filter(m => m && m.active && m.role === "student")
            .sort((a, b) => String(a.full_name).localeCompare(String(b.full_name), "ar"))
            .map(m => ({
                name: m.full_name,
                url: `${SITE_URL}/parent.html#s=${m.id}&v=${m.parent_link_version}` +
                     `&t=${signStudent(m.id, m.parent_link_version, pepper)}`,
            }));

        return json(200, { className: cls.name, count: links.length, links });
    }catch(e){
        console.error("[خُطى][روابط أولياء الأمور] خطأ:", e);
        return json(500, { error: "INTERNAL" });
    }
};

/* تُصدَّر ليعيد فحصُ الخادم استعمالَ التوقيع نفسه بدل إعادة كتابته */
exports.signStudent = signStudent;
exports.parentPepper = parentPepper;
