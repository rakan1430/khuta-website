/* ============================================================
   إشعار المالك — طريقٌ لا يمرّ بأي وسيط
   ------------------------------------------------------------
   طلب المالك أن يصله بريد عند انتهاء كل ردّ، ثم اشتكى ثلاث مرات أن كل
   رسالة تُلزمه بفتح التطبيق للموافقة. والسبب أن البريد كان يُرسَل عبر
   رابط Gmail في حسابه على claude.ai، وهو يطلب إذناً في كل مرة ولا
   تحكمه إعدادات هذا المشروع إطلاقاً — فلا حلّ له من هنا.

   وهذه الدالّة تُخرج الأمر من ذلك الطريق كلّه: بريدٌ يُرسَل من موقعه هو،
   بمفتاح Brevo الذي يملكه أصلاً، بنداءٍ واحد لا موافقة فيه.

   ⚠️ وتحتاج متغيّراً واحداً يُضبط مرّة: OWNER_NOTIFY_SECRET.
   ولماذا سرّ؟ لأن الدالّة تُرسل بريداً إلى صندوق المالك، وعنوانٌ مفتوح
   للعالم يعني أن أي أحد يملأ بريده. ولأن الحدّ الأدنى للسرّ ٢٤ حرفاً
   ولا قيمة افتراضية له إطلاقاً: قيمةٌ افتراضية في مستودعٍ عامّ ليست
   سرّاً، وغيابُه يعطّل الدالّة بصراحة بدل أن يفتحها للجميع.

   ⚠️ ولا يُذكر السرّ في أي رسالة خطأ ولا سجلّ.
   ============================================================ */

const SENDER_EMAIL = "khutaa.platform@gmail.com";
const SENDER_NAME  = "خُطى";
const OWNER_TO = [
    { email: "soosrakan1430@gmail.com" },
    { email: "RAKAN8022@icloud.com" },
];
const MAX_SUBJECT = 200;
const MAX_BODY    = 20000;

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

/* مقارنة بزمنٍ ثابت: المقارنة العادية تنتهي عند أول حرف مختلف، وفرقُ
   الزمن يسرّب السرّ حرفاً حرفاً لمن يقيس. */
function sameSecret(a, b){
    if(typeof a !== "string" || typeof b !== "string") return false;
    if(a.length !== b.length) return false;
    let diff = 0;
    for(let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

exports.handler = async (event) => {
    if(!event || event.httpMethod !== "POST"){
        return { statusCode: 405, body: JSON.stringify({ error: "METHOD_NOT_ALLOWED" }) };
    }

    const secret = env("OWNER_NOTIFY_SECRET");
    if(!secret || secret.length < 24){
        console.error("[خُطى][إشعار] OWNER_NOTIFY_SECRET غير مضبوط أو أقصر من ٢٤ حرفاً");
        return { statusCode: 500, body: JSON.stringify({ error: "SECRET_NOT_CONFIGURED" }) };
    }

    const headers = event.headers || {};
    const given = headers["x-notify-secret"] || headers["X-Notify-Secret"];
    if(!sameSecret(given || "", secret)){
        return { statusCode: 401, body: JSON.stringify({ error: "BAD_SECRET" }) };
    }

    let payload;
    try{ payload = JSON.parse(event.body || "{}"); }
    catch(e){ return { statusCode: 400, body: JSON.stringify({ error: "BAD_JSON" }) }; }

    const subject = String(payload.subject || "").trim().slice(0, MAX_SUBJECT);
    const body    = String(payload.body || "").trim().slice(0, MAX_BODY);
    if(!subject || !body){
        return { statusCode: 400, body: JSON.stringify({ error: "EMPTY" }) };
    }

    const apiKey = env("BREVO_API_KEY");
    if(!apiKey){
        console.error("[خُطى][إشعار] BREVO_API_KEY غير مضبوط");
        return { statusCode: 500, body: JSON.stringify({ error: "BREVO_NOT_CONFIGURED" }) };
    }

    try{
        const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json", accept: "application/json" },
            body: JSON.stringify({
                sender: { email: SENDER_EMAIL, name: SENDER_NAME },
                to: OWNER_TO,
                subject,
                /* نصّ عادي لا HTML: الرسالة تقرير عمل، وأي وسم فيها يأتي
                   من النصّ نفسه فيُعرض مكسوراً أو يُنفَّذ. */
                textContent: body,
            }),
        });
        if(!res.ok){
            const text = await res.text();
            console.error("[خُطى][إشعار] رفضت Brevo:", res.status, text.slice(0, 300));
            return { statusCode: 502, body: JSON.stringify({ error: "SEND_FAILED", status: res.status }) };
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true, to: OWNER_TO.length }) };
    }catch(e){
        console.error("[خُطى][إشعار] خطأ:", e);
        return { statusCode: 500, body: JSON.stringify({ error: "UNEXPECTED" }) };
    }
};
