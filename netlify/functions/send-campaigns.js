/* ============================================================
   خُطى — مُرسِل الرسائل المجدولة (كل ربع ساعة، netlify.toml)
   ------------------------------------------------------------
   طلب المالك (٢٥ سبتمبر): «ويمكن جدولتها أن يتم إرسالها بشكل تلقائي».
   الرسالة التي حدّد لها المالك أو إدارة المدرسة موعداً تُرسَل هنا حين يحين.

   ⚠️ لا منطق إرسال هنا عمداً: هذا الملف يطرق send-email.js فقط، بتوقيع
   HMAC من المفتاح السرّي على نافذة ٥ دقائق. فقاعدة «من يستلم» والتذييل
   والحصّة اليومية والقفل ضد الإرسال المزدوج — كلها في مكان واحد يستعمله
   زرّ «أرسل الآن» والمجدول معاً، فلا يفترقان يوماً بصمت.
   ولا مكتبات خارجية (fetch وcrypto فقط): send-reminders.js لم يعمل منذ
   كُتب لأن مكتبتَيه لم تُثبَّتا على Netlify.
   ============================================================ */
const crypto = require("crypto");

exports.handler = async function(){
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!serviceKey){
        console.error("[send-campaigns] SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
        return { statusCode: 500, body: "missing env" };
    }
    const bucket = Math.floor(Date.now() / 300000);
    const sig = crypto.createHmac("sha256", serviceKey).update(`scheduled-run:${bucket}`).digest("hex");
    const base = process.env.URL || "https://khutaa.netlify.app";
    try{
        const res = await fetch(`${base}/.netlify/functions/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "scheduledRun", sig }),
        });
        const text = await res.text();
        if(!res.ok) console.error("[send-campaigns] فشل:", res.status, text.slice(0, 300));
        else if(!/"ran":0/.test(text)) console.log("[send-campaigns]", text.slice(0, 500));
        return { statusCode: 200, body: text };
    }catch(e){
        console.error("[send-campaigns] خطأ:", e);
        return { statusCode: 500, body: "error" };
    }
};
