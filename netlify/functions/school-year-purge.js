/* ============================================================
   حذف بيانات العام الماضي — دالة مُجدوَلة يومياً
   ------------------------------------------------------------
   قرار المالك: «بيانات العام الماضي أريد أن تُمسح، ولكن ليس بشكل فوري
   بل بعد مرور أسبوع من بدء السنة الدراسية التالية».

   والإخفاء عن الطالب يقع لحظة الترقية (في سياسات قاعدة البيانات)، وهذه
   الدالّة هي التي تُنفّذ الحذف الحقيقي بعد أن يمرّ الأسبوع.

   ⚠️ ولماذا لا نكتفي بالإخفاء؟ لأن أرشيفاً يُخفى ولا يُحذف يكبر كل سنة
   ويبقى فيه عمل معلّمين ودرجات طلاب إلى الأبد. والمالك اشترط الحذف،
   والمهلة إنما هي فرصة المدرسة لتصدير ما تريد.

   ⚠️ ولا يحتاج ضبط أي متغيّر بيئة جديد.
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
        /* ⚠️ ٥٠٠ لا ٢٠٠: بلا هذا يبدو الحذف ناجحاً كل يوم في السجلّ بينما
           لا يُحذف شيء — وهو عطلٌ صامت لا يكتشفه أحد حتى تُسأل المدرسة
           لماذا ما زالت بيانات ثلاث سنوات موجودة. */
        console.error("[خُطى][حذف الأرشيف] SUPABASE_SERVICE_ROLE_KEY غير مضبوط");
        return { statusCode: 500, body: JSON.stringify({ error: "SERVICE_KEY_MISSING" }) };
    }

    try{
        const res = await fetch(`${base}/rest/v1/rpc/purge_archived_school_data`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: "{}",
        });
        const text = await res.text();
        if(!res.ok){
            console.error("[خُطى][حذف الأرشيف] فشل النداء:", res.status, text.slice(0, 300));
            return { statusCode: 502, body: JSON.stringify({ error: "RPC_FAILED", status: res.status }) };
        }
        let out = {};
        try{ out = JSON.parse(text) || {}; }catch(e){}
        const n = (Number(out.exams) || 0) + (Number(out.files) || 0) + (Number(out.links) || 0);
        if(n) console.log(`[خُطى][حذف الأرشيف] حُذف ${n} عنصراً من بيانات العام الماضي`);
        return { statusCode: 200, body: JSON.stringify({ ok: true, ...out }) };
    }catch(e){
        console.error("[خُطى][حذف الأرشيف] خطأ:", e);
        return { statusCode: 500, body: JSON.stringify({ error: "UNEXPECTED" }) };
    }
};
