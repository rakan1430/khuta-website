/* ============================================================
   ما يراه وليّ الأمر — تحقّقٌ من التوقيع ثم قراءة بصلاحية الخدمة
   ------------------------------------------------------------
   ⚠️ التوقيع يصل في **جسم الطلب** لا في مساره. والسبب أن الرابط يعيش في
   شريط العنوان: ما بعد ‎#‎ لا يُرسَل إلى أي خادم إطلاقاً، فلا يظهر في
   سجلّات Netlify ولا في ترويسة Referer حين يفتح وليّ الأمر رابطاً آخر
   من الصفحة. ولو وضعناه في ‎?t=‎ لسُجِّل رمزُ دخولٍ دائم في كل سجلّ يمرّ
   به الطلب — وهذا تسريبٌ لا يُلاحَظ أبداً حتى يقع.

   ⚠️ والمقارنة بزمنٍ ثابت: المقارنة العادية تتوقّف عند أول حرف مختلف،
   وفرقُ الزمن يسرّب التوقيع حرفاً حرفاً لمن يقيس بصبر.

   ⚠️ ورقم النسخة جزءٌ من التوقيع لا حقلٌ يُقارَن: من يرفع الرقم في
   الرابط يدوياً يُبطل توقيعه بنفسه. فلا حاجة لمقارنةٍ إضافية تُنسى.
   ============================================================ */

const crypto = require("crypto");
const { signStudent, parentPepper } = require("./parent-links.js");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";

const json = (statusCode, body) => ({
    statusCode,
    headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        /* لا يُفهرَس ولا يُخزَّن في وسيط */
        "X-Robots-Tag": "noindex, nofollow",
    },
    body: JSON.stringify(body),
});

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

function sameToken(a, b){
    if(typeof a !== "string" || typeof b !== "string") return false;
    if(a.length !== b.length) return false;
    let diff = 0;
    for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

exports.handler = async (event) => {
    if(!event || event.httpMethod !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY") || env("SCHOOL_SERVICE_ROLE_KEY");
    if(!serviceKey) return json(500, { error: "SERVICE_KEY_MISSING" });

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return json(400, { error: "BAD_JSON" }); }

    const memberId = String(payload.s || "").trim();
    const version  = String(payload.v || "").trim();
    const token    = String(payload.t || "").trim();

    if(!/^[0-9a-f-]{36}$/i.test(memberId) || !/^\d{1,9}$/.test(version) || !/^[A-Za-z0-9_-]{22}$/.test(token)){
        return json(400, { error: "BAD_LINK" });
    }

    const expected = signStudent(memberId, version, parentPepper(serviceKey));
    if(!sameToken(token, expected)) return json(403, { error: "BAD_LINK" });

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    try{
        /* ⚠️ رقم النسخة الحالي يُقرأ من قاعدة البيانات: التوقيع يثبت أن
           الرابط أُصدر بهذا الرقم، ولا يثبت أنه لم يُلغَ بعد. وبلا هذه
           القراءة يبقى كل رابطٍ قديم صالحاً إلى الأبد — ويصير "الإلغاء"
           زرّاً لا يفعل شيئاً، وهو أسوأ من عدم وجوده. */
        const memRes = await fetch(`${SUPABASE_URL}/rest/v1/school_members` +
            `?id=eq.${encodeURIComponent(memberId)}&select=parent_link_version,active,role`, { headers });
        if(!memRes.ok) return json(502, { error: "READ_FAILED" });
        const member = (await memRes.json())[0];
        if(!member || !member.active || member.role !== "student") return json(404, { error: "NOT_FOUND" });
        if(String(member.parent_link_version) !== version) return json(410, { error: "REVOKED" });

        const rpc = await fetch(`${SUPABASE_URL}/rest/v1/rpc/parent_child_report`, {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ p_member: memberId }),
        });
        if(!rpc.ok){
            const text = await rpc.text();
            console.error("[خُطى][وليّ الأمر] فشل التقرير:", rpc.status, text.slice(0, 200));
            return json(502, { error: "REPORT_FAILED" });
        }
        return json(200, await rpc.json());
    }catch(e){
        console.error("[خُطى][وليّ الأمر] خطأ:", e);
        return json(500, { error: "INTERNAL" });
    }
};
