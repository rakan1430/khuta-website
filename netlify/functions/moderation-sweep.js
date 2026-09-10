/* ============================================================
   كنس البلاغات المتروكة — دالة مُجدوَلة يومياً
   ------------------------------------------------------------
   قرار المالك: «إذا لم يتم الرد على البلاغ بأسبوع سيتم حذفها بشكل
   تلقائي». وهذا ما يجعل الإخفاء وعداً لا مقبرة: مشاركةٌ أخفاها خمسة
   بلاغات ثم لم يبتّ فيها أحد لا يجوز أن تبقى معلّقة إلى الأبد.

   ⚠️ لماذا خادم لا متصفح؟ لأن الحذف صلاحية خدمة، ولأن الاعتماد على أن
   يفتح المشرف الصندوق يعني ألّا يُكنس شيء في الأسابيع التي لا يفتحه
   فيها — وهي أكثر الأسابيع.

   ⚠️ ومع ذلك تناديه الواجهة أيضاً عند فتح الصندوق. ليس تكراراً عبثياً:
   الجدولة على Netlify تسقط بصمت أحياناً (لا خطأ، لا بريد، لا شيء)،
   وحارسان أحدهما احتياط خيرٌ من حارسٍ نثق به بلا دليل.

   ⚠️ لا يحتاج ضبط أي متغيّر بيئة جديد — نفس SUPABASE_SERVICE_ROLE_KEY
   المضبوط للموقع أصلاً.
   ============================================================ */

const DEFAULT_SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

exports.handler = async () => {
    const base = env("SUPABASE_URL") || env("SCHOOL_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
    const key  = env("SUPABASE_SERVICE_ROLE_KEY") || env("SCHOOL_SERVICE_ROLE_KEY");

    if(!key){
        /* ⚠️ نُرجع 500 لا 200: بلا هذا يبدو الكنس ناجحاً كل يوم في سجلّ
           Netlify بينما لا يُحذف شيء إطلاقاً — وهو أسوأ من عطلٍ ظاهر. */
        console.error("[خُطى][كنس] SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
        return { statusCode: 500, body: JSON.stringify({ error: "SERVICE_KEY_MISSING" }) };
    }

    try{
        const res = await fetch(`${base}/rest/v1/rpc/sweep_expired_moderation`, {
            method: "POST",
            headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: "{}",
        });
        const text = await res.text();
        if(!res.ok){
            console.error("[خُطى][كنس] فشل النداء:", res.status, text.slice(0, 300));
            return { statusCode: 502, body: JSON.stringify({ error: "RPC_FAILED", status: res.status }) };
        }
        const deleted = Number(text) || 0;
        if(deleted) console.log(`[خُطى][كنس] حُذفت ${deleted} مشاركة مضت مهلتها`);
        return { statusCode: 200, body: JSON.stringify({ ok: true, deleted }) };
    }catch(e){
        console.error("[خُطى][كنس] خطأ:", e);
        return { statusCode: 500, body: JSON.stringify({ error: "UNEXPECTED" }) };
    }
};
