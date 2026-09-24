/* ============================================================
   خُطى — إلغاء اشتراك الرسائل التذكيرية بضغطة واحدة (One-Click)
   ------------------------------------------------------------
   يُستدعى من رابط "إلغاء الاشتراك" داخل رسائل الحملات التي يرسلها
   send-email.js (نمط adminSendCampaign فقط)، وأيضاً من رأس بريد
   List-Unsubscribe القياسي الذي يفهمه Gmail/Outlook/ياهو مباشرة —
   الحل مجاني بالكامل ولا يحتاج أي خدمة أو نطاق بريد مدفوع.

   التحقق: رابط كل مستخدم موقَّع بـHMAC-SHA256 (المفتاح: نفس
   SUPABASE_SERVICE_ROLE_KEY السرّي المستخدَم أصلاً في كل الدوال الأخرى —
   لا حاجة لمتغيّر بيئة جديد ولا جدول توكنات منفصل). أي محاولة تعديل uid
   في الرابط تُبطل التوقيع فوراً وتُرفَض.

   متغيّرات البيئة المطلوبة: SUPABASE_SERVICE_ROLE_KEY (نفس المتغيّر
   المستخدم في باقي الدوال).
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";

// نفس منطق buildUnsubscribeToken في send-email.js تماماً — منسوخة هنا
// عمداً (كل دالة Netlify مستقلة بلا اعتماديات مشتركة، انظر تعليق
// gemini-proxy.js لنفس السبب)
function buildUnsubscribeToken(userId, secret){
    return crypto.createHmac("sha256", secret).update(userId).digest("hex").slice(0, 32);
}

function htmlPage(title, message, ok){
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — خُطى</title>
<style>
  body{font-family:sans-serif; background:#121826; color:#f2ede3; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; text-align:center;}
  .card{max-width:420px; background:#1a2233; border-radius:20px; padding:36px 28px; border:1px solid rgba(255,255,255,.08);}
  .icon{font-size:44px; margin-bottom:14px;}
  h1{font-size:19px; margin:0 0 10px;}
  p{font-size:13.5px; color:#b7b0a3; line-height:1.8; margin:0;}
  a{color:#C9962E;}
</style></head>
<body><div class="card">
  <div class="icon">${ok ? "✅" : "⚠️"}</div>
  <h1>${title}</h1>
  <p>${message}</p>
</div></body></html>`;
}

/* ============================================================
   ⚠️ GET لا يغيّر شيئاً — POST وحده يُلغي (٢٤ سبتمبر ٢٠٢٦)
   ------------------------------------------------------------
   كان GET يُلغي فوراً، وPOST يُرفض بـ405. والاثنان خطأ:
   • ماسحات الروابط في البريد (حماية Outlook وغيرها) تفتح كل رابط بـGET قبل
     أن يراه المستخدم — فتُلغي اشتراكه دون علمه. (نبّه عليه تدقيق خارجي.)
   • ورسائلنا تعلن «List-Unsubscribe-Post: List-Unsubscribe=One-Click»
     (send-email.js)، أي أن زرّ «إلغاء الاشتراك» في Gmail نفسه يرسل POST
     — فكان يُرفض، ولا يعمل الزرّ الذي وعدنا به (RFC 8058).
   الآن: GET يعرض صفحة تأكيد بزرّ، والزرّ وزرّ Gmail كلاهما POST يُلغي.
   ============================================================ */
function confirmPage(uid, token){
    const action = `?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`;
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>إلغاء الاشتراك — خُطى</title>
<style>
  body{font-family:sans-serif; background:#121826; color:#f2ede3; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; padding:24px; text-align:center;}
  .card{max-width:420px; background:#1a2233; border-radius:20px; padding:36px 28px; border:1px solid rgba(255,255,255,.08);}
  h1{font-size:19px; margin:0 0 10px;}
  p{font-size:13.5px; color:#b7b0a3; line-height:1.8; margin:0 0 18px;}
  button{background:#C9962E; color:#121826; border:0; border-radius:12px; padding:12px 22px; font-size:15px; font-weight:700; cursor:pointer;}
</style></head>
<body><div class="card">
  <h1>إلغاء الاشتراك في رسائل خُطى</h1>
  <p>اضغط الزرّ لتأكيد إيقاف الرسائل التذكيرية. تقدر تعيد تفعيلها متى شئت من إعدادات ملفك الشخصي.</p>
  <form method="POST" action="${action}"><input type="hidden" name="confirm" value="1">
    <button type="submit">تأكيد إلغاء الاشتراك</button></form>
</div></body></html>`;
}

const HTML = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

exports.handler = async function (event) {
    const method = event.httpMethod;
    if (method !== "GET" && method !== "POST") {
        return { statusCode: 405, headers: HTML, body: htmlPage("طريقة طلب غير صالحة", "جرّب الرابط مباشرة من الرسالة الأصلية.", false) };
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
        return { statusCode: 500, headers: HTML, body: htmlPage("تعذّر الإلغاء الآن", "خلل مؤقت في الخادم — جرّب لاحقاً.", false) };
    }

    const params = event.queryStringParameters || {};
    const uid = params.uid;
    const token = params.token;
    if (!uid || !token) {
        return { statusCode: 400, headers: HTML, body: htmlPage("رابط غير مكتمل", "هذا الرابط ناقص — استخدم رابط إلغاء الاشتراك كما وصلك بالضبط في الرسالة.", false) };
    }

    const expected = buildUnsubscribeToken(uid, serviceKey);
    // مقارنة بزمن ثابت لتفادي هجمات توقيت نظرية على التوقيع
    const validSignature = expected.length === token.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
    if (!validSignature) {
        return { statusCode: 403, headers: HTML, body: htmlPage("رابط غير صالح", "هذا الرابط لا يبدو صحيحاً أو تم تعديله. لو نسخته من رسالة قديمة، جرّب أحدث رسالة وصلتك.", false) };
    }

    // GET: تأكيد فقط — لا تغيير في الحالة
    if (method === "GET") {
        return { statusCode: 200, headers: HTML, body: confirmPage(uid, token) };
    }

    // POST: من زرّ صفحة التأكيد، أو من زرّ «إلغاء الاشتراك» في Gmail/Outlook
    // (جسمه «List-Unsubscribe=One-Click» — RFC 8058)
    let body = event.body || "";
    if (event.isBase64Encoded) { try { body = Buffer.from(body, "base64").toString("utf8"); } catch (e) { body = ""; } }
    const oneClick = /List-Unsubscribe=One-Click/i.test(body);

    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/user_data?id=eq.${encodeURIComponent(uid)}`, {
            method: "PATCH",
            headers: {
                "apikey": serviceKey,
                "Authorization": `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ marketing_consent: false }),
        });
        if (!res.ok) {
            console.error("[unsubscribe] فشل تحديث marketing_consent:", res.status, await res.text());
            return { statusCode: 502, headers: HTML, body: htmlPage("تعذّر الإلغاء الآن", "حدث خلل مؤقت — جرّب مجدداً بعد قليل، أو أوقف الرسائل من ملفك الشخصي داخل خُطى.", false) };
        }
    } catch (e) {
        console.error("[unsubscribe] خطأ غير متوقع:", e);
        return { statusCode: 500, headers: HTML, body: htmlPage("تعذّر الإلغاء الآن", "حدث خلل مؤقت — جرّب مجدداً بعد قليل.", false) };
    }

    if (oneClick) return { statusCode: 200, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "unsubscribed" };
    return {
        statusCode: 200,
        headers: HTML,
        body: htmlPage("تم إلغاء اشتراكك", "لن تصلك رسائل تذكيرية بعد الآن. تقدر تفعّلها مجدداً في أي وقت من إعدادات ملفك الشخصي داخل خُطى.", true),
    };
};
