/* ============================================================
   خُطى — دالة مجدولة (Scheduled Function) لإرسال التذكير اليومي
   ------------------------------------------------------------
   تعمل تلقائياً كل يوم (الجدولة مضبوطة في netlify.toml)، وترسل إشعار
   Push حقيقياً لكل طالب فعّل الإشعارات — يصله حتى لو أغلق الموقع تماماً.

   ⚠️ صدق تام حول حدود هذه النسخة: الإصدار الحالي يرسل تذكيراً عاماً لكل
   المشتركين يومياً، وليس "ذكياً" (أي لا يتحقق حالياً من أكمل الطالب جلسته
   اليوم أم لا) — لأن حالة الإنجاز مخزَّنة محلياً على جهاز كل طالب وليست
   متزامنة بشكل قابل للاستعلام السهل من الخادم بعد. تحسين مستقبلي ممكن،
   لكن هذه النسخة تعمل فعلياً وترسل تذكيرات حقيقية الآن.

   ⚠️ متغيّرات بيئة مطلوبة (Netlify → Environment variables):
   - SUPABASE_SERVICE_ROLE_KEY: مفتاح service_role من Supabase (Settings → API)
     — مختلف تماماً عن مفتاح anon المستخدم في الموقع، له صلاحية تجاوز RLS،
     لذا لا يجب أن يظهر أبداً في أي كود عميل (client-side)، فقط هنا كمتغيّر سرّي.
   - VAPID_PRIVATE_KEY: المفتاح الخاص المطابق للمفتاح العام في app.js
   ============================================================ */

const webpush = require("web-push");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
const VAPID_PUBLIC_KEY = "BMWllR59gW0Z5EHMNv1CQxEKzGjvoNY8SEznutD9Du1KVVGohKA8lu9Z8Rx7tnBSfW2ZypVGiXIcPdBRE-id9gA";

exports.handler = async function () {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

    if (!serviceKey || !vapidPrivateKey) {
        console.error("SUPABASE_SERVICE_ROLE_KEY أو VAPID_PRIVATE_KEY غير مضبوطين على Netlify");
        return { statusCode: 500, body: "Missing environment variables" };
    }

    webpush.setVapidDetails("mailto:support@khuta.app", VAPID_PUBLIC_KEY, vapidPrivateKey);

    const supabase = createClient(SUPABASE_URL, serviceKey);
    const { data: subscriptions, error } = await supabase.from("push_subscriptions").select("*");

    if (error) {
        console.error("تعذّر جلب الاشتراكات:", error);
        return { statusCode: 500, body: "Failed to fetch subscriptions" };
    }

    const payload = JSON.stringify({
        title: "خُطى 🚀",
        body: "لا تنسَ جلستك اليوم — حتى 20 دقيقة تفرق!",
    });

    let sent = 0, failed = 0, cleaned = 0;
    for (const row of subscriptions || []) {
        try {
            await webpush.sendNotification(row.subscription, payload);
            sent++;
        } catch (err) {
            failed++;
            // الاشتراك لم يعد صالحاً (الطالب ألغى الإذن أو غيّر جهازه) — نحذفه لتفادي محاولات فاشلة متكررة
            if (err.statusCode === 404 || err.statusCode === 410) {
                await supabase.from("push_subscriptions").delete().eq("id", row.id);
                cleaned++;
            }
        }
    }

    console.log(`تم الإرسال: ${sent}، فشل: ${failed}، اشتراكات مُنظَّفة: ${cleaned}`);
    return { statusCode: 200, body: JSON.stringify({ sent, failed, cleaned }) };
};
