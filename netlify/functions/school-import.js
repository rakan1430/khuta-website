/* ============================================================
   خُطى — الاستيراد الجماعي لطلاب المدرسة
   ------------------------------------------------------------
   لماذا خادم أصلاً، ولماذا لا يقرأ المتصفّح الملف ويكتب مباشرة؟

   لأن هنا تتحوّل أرقام الهوية إلى بصمات. ولو حدث ذلك في المتصفّح لوجب أن
   يكون المفتاح السرّي في المتصفّح — وما في المتصفّح ليس سرّاً.

   ⚠️ ولماذا بصمة أصلاً ولا نخزّن الرقم؟
   شرطُ المالك حرفياً: "لن يتم إضافة أي بيانات رسمية من نور أو أي بيانات
   شخصية للطالب". وقاعدةُ بيانات فيها أرقام هوية ٦٠٠ قاصر مسؤولية ثقيلة
   على المدرسة وعليه. فالمطابقة تحتاج معرّفاً ثابتاً، والحفظ لا يحتاجه:
   نحسب البصمة، ونستعملها، ونرمي الرقم.

   ⚠️ ولماذا HMAC لا SHA-256 مجرّدة؟
   رقم الهوية السعودي عشر خانات = مليار احتمال. تُجرَّب كلها على بطاقة
   رسوميات في ثوانٍ، فتُعكَس أي تعمية بلا مفتاح. المفتاح السرّي — وهو
   يعيش هنا في بيئة الخادم لا في قاعدة البيانات — هو ما يجعل البصمة
   غير قابلة للتخمين. ولو تسرّبت قاعدة البيانات كاملةً، لا يخرج منها
   رقم هوية واحد.

   متغيّرات البيئة: SUPABASE_SERVICE_ROLE_KEY (مضبوط أصلاً).
   و SCHOOL_ID_PEPPER اختياري — إن لم يُضبط اشتُقّ المفتاح من مفتاح
   الخدمة، تماماً كما تفعل روابط إلغاء الاشتراك في send-email.js.
   ⚠️ ولا تغيّره بعد أول استيراد: تغييره يغيّر كل البصمات، فلا يتطابق
   ملفُ غيابٍ قادم مع طالب واحد.
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

/** يتحقّق من توكن الجلسة عبر Supabase نفسها — لا نثق بأي ادّعاء من الطلب. */
async function verifyUser(accessToken){
    if(!accessToken) return null;
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${accessToken}`, apikey: SUPABASE_ANON_KEY },
    });
    if(!res.ok) return null;
    return res.json();
}

/** عضوية المستخدم في المدرسة — تُقرأ بمفتاح الخدمة لا بصلاحيات المتصفّح. */
async function adminMembership(uid, serviceKey){
    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const url = `${SUPABASE_URL}/rest/v1/school_members` +
        `?uid=eq.${encodeURIComponent(uid)}&role=eq.admin&active=is.true&select=id,school_id`;
    const res = await fetch(url, { headers });
    if(!res.ok) return null;
    const rows = await res.json();
    return rows[0] || null;
}

/* ⚠️ الأرقام العربية والفارسية تصل من ملفات نور كما هي أحياناً، ولو
   عوملت كنصّ مختلف عن نظيرتها اللاتينية لصارت لنفس الطالب بصمتان. */
function normalizeDigits(s){
    return String(s)
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
        .replace(/[^0-9]/g, "");   // مسافات وشرطات وفواصل الملفات
}

function idFingerprint(rawId, pepper){
    const digits = normalizeDigits(rawId);
    if(digits.length < 8 || digits.length > 20) return null;   // ليس رقم هوية
    return {
        hash: crypto.createHmac("sha256", pepper).update(digits).digest("hex"),
        last4: digits.slice(-4),
    };
}

exports.handler = async function(event){
    if(event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey){
        console.error("[school-import] SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
        return json(503, { error: "NOT_CONFIGURED" });
    }
    const pepper = (process.env.SCHOOL_ID_PEPPER || "").trim() || ("khuta-school-id:" + serviceKey);

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return json(400, { error: "BAD_JSON" }); }

    // ١) من المستدعي فعلاً؟ (لا نصدّق أي دور يرسله المتصفّح)
    const user = await verifyUser(payload.accessToken);
    if(!user || !user.id || user.is_anonymous === true) return json(401, { error: "BAD_SESSION" });

    /* ⚠️ الاستيراد الجماعي فعلٌ خطير: يكتب مئات الصفوف دفعة واحدة. فيلزمه
       ما يلزم إضافة عضو يدوياً — تأكيد الهوية بحساب Google. والجلسة
       المحدودة (دخول سريع أو باركود) لا تكفي، لأنها تُفتح على سبورة
       يراها الصف كله. نقرأ amr من التوكن نفسه لا من ادّعاء المتصفّح. */
    if(!hasGoogleAmr(payload.accessToken)) return json(403, { error: "NEEDS_GOOGLE" });

    // ٢) وهل هو إداريّ نشط في مدرسة؟
    const membership = await adminMembership(user.id, serviceKey);
    if(!membership) return json(403, { error: "NOT_ADMIN" });

    // ٣) الصفوف
    const rows = Array.isArray(payload.rows) ? payload.rows : null;
    if(!rows) return json(400, { error: "BAD_ROWS" });
    if(rows.length === 0) return json(400, { error: "EMPTY" });
    if(rows.length > MAX_ROWS) return json(400, { error: "TOO_MANY_ROWS", max: MAX_ROWS });

    const prepared = [];
    const rejected = [];
    rows.forEach((row, i) => {
        const name = String((row && row.name) || "").trim();
        const fp = idFingerprint((row && row.national_id) || "", pepper);
        if(!fp){
            rejected.push({ row: i + 1, reason: "BAD_ID", name: name.slice(0, 60) });
            return;
        }
        prepared.push({
            name: name.slice(0, 120),
            id_hash: fp.hash,
            id_last4: fp.last4,
            grade: String((row && row.grade) || "").trim().slice(0, 10),
            section: String((row && row.section) || "").trim().slice(0, 20),
            email: String((row && row.email) || "").trim().slice(0, 160),
        });
    });

    if(prepared.length === 0){
        return json(200, { added: 0, updated: 0, skipped: rejected.length, errors: rejected });
    }

    // ٤) الكتابة — والتحقّق من الصلاحية يتكرّر داخل الدالة نفسها (دفاع بطبقتين)
    try{
        const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/import_school_students`, {
            method: "POST",
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                p_admin_member: membership.id,
                p_school: membership.school_id,
                p_rows: prepared,
            }),
        });
        const text = await res.text();
        if(!res.ok){
            console.error("[school-import] فشل الاستيراد:", res.status, text);
            return json(502, { error: "IMPORT_FAILED", detail: text.slice(0, 300) });
        }
        const out = JSON.parse(text);
        // نضمّ ما رفضناه هنا إلى ما رفضته قاعدة البيانات — تقريرٌ واحد للمدير
        out.skipped = (out.skipped || 0) + rejected.length;
        out.errors = (out.errors || []).concat(rejected);
        return json(200, out);
    }catch(e){
        console.error("[school-import] خطأ غير متوقّع:", e);
        return json(500, { error: "INTERNAL" });
    }
};

/* ⚠️ نقرأ amr من التوكن مباشرة بدل سؤال المتصفّح: المتصفّح يستطيع أن
   يدّعي أنه دخل بـGoogle. والتوكن موقَّع من Supabase، وقد تحقّقنا من
   صلاحيته أعلاه عبر /auth/v1/user قبل قراءة حمولته. */
function hasGoogleAmr(token){
    try{
        const part = String(token).split(".")[1];
        if(!part) return false;
        const pad = part.length % 4 ? "=".repeat(4 - (part.length % 4)) : "";
        const claims = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8"));
        const amr = Array.isArray(claims.amr) ? claims.amr : [];
        return amr.some(m => (m && (m.method === "oauth" || m.method === "google")) || m === "oauth");
    }catch(e){ return false; }
}
