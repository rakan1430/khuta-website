/* ============================================================
   دخول السبورة برمز QR — الطرف الخادمي
   ------------------------------------------------------------
   لماذا خادم أصلاً؟ لأن الموافقة على جوال المعلّم لا تُنشئ جلسة على
   السبورة. الجلسة لا يصدرها إلا Supabase Auth بمفتاح خدمة، ومفتاح الخدمة
   لا يجوز أن يمسّ كود المتصفح إطلاقاً. فهذه الدالة هي الجسر الوحيد.

   ⚠️ الجلسة الناتجة "محدودة" عمداً — لا كاملة.
   المعلّم أثبت هويته بـGoogle على جواله، لكن الذي سيبقى مفتوحاً هو شاشة
   الفصل أمام الطلاب. فنُصدر جلسة من نوع magiclink، وحقل amr فيها لا يحوي
   "oauth"، فتفشل دالة google_verified في قاعدة البيانات، فتُمنع الأفعال
   الحسّاسة (حذف ملف، إرسال اختبار، تعديل جدول) تماماً كالدخول السريع
   باسم مستخدم وكلمة مرور. العرض متاح، والعبث ممنوع.

   ⚠️ متغيّرات البيئة اللازمة على Netlify:
     SCHOOL_SUPABASE_URL               رابط مشروع Supabase الذي يحوي جداول المدرسة
     SCHOOL_SUPABASE_SERVICE_ROLE_KEY  مفتاح service_role لذلك المشروع
   بدونهما تردّ الدالة بخطأ واضح ولا تُسقط النشر.

   ⚠️ بلا أي حزم npm، كبقية دوال المشروع (fetch الأصلي فقط).
   ============================================================ */

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

const json = (statusCode, body) => ({
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
});

exports.handler = async (event) => {
    if(event.httpMethod !== "POST"){
        return json(405, { error: "METHOD_NOT_ALLOWED" });
    }

    const base = env("SCHOOL_SUPABASE_URL");
    const key  = env("SCHOOL_SUPABASE_SERVICE_ROLE_KEY");
    if(!base || !key){
        console.error("school-screen-login: متغيّرات البيئة ناقصة");
        return json(503, { error: "NOT_CONFIGURED" });
    }

    let secret = null;
    try{
        secret = (JSON.parse(event.body || "{}") || {}).secret;
    }catch(e){
        return json(400, { error: "BAD_JSON" });
    }

    // السرّ يولّده المتصفح من crypto.randomUUID مرتين — أي أقل من ذلك ليس منّا
    if(typeof secret !== "string" || secret.length < 32 || secret.length > 200){
        return json(400, { error: "BAD_SECRET" });
    }

    const sbHeaders = {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
    };

    // 1) المطالبة: تستهلك الطلب مرة واحدة وترجع العضو الذي وافق
    let member = null;
    try{
        const res = await fetch(`${base}/rest/v1/rpc/screen_login_claim`, {
            method: "POST", headers: sbHeaders,
            body: JSON.stringify({ p_secret: secret }),
        });
        if(!res.ok){
            console.error("screen_login_claim فشلت:", res.status, await res.text());
            return json(502, { error: "CLAIM_FAILED" });
        }
        const rows = await res.json();
        member = Array.isArray(rows) ? rows[0] : rows;
    }catch(e){
        console.error("screen_login_claim خطأ شبكة:", e && e.message);
        return json(502, { error: "CLAIM_FAILED" });
    }

    // لا موافقة بعد، أو انتهت المهلة، أو استُهلكت — كلها تبدو واحدة للطالب
    if(!member || !member.email || !member.uid){
        return json(404, { error: "NOT_APPROVED" });
    }

    // 2) إصدار رمز دخول لمرة واحدة لصاحب البريد نفسه
    let tokenHash = null;
    try{
        const res = await fetch(`${base}/auth/v1/admin/generate_link`, {
            method: "POST", headers: sbHeaders,
            body: JSON.stringify({ type: "magiclink", email: member.email }),
        });
        if(!res.ok){
            console.error("generate_link فشلت:", res.status, await res.text());
            return json(502, { error: "LINK_FAILED" });
        }
        const data = await res.json();
        tokenHash = data.hashed_token || (data.properties && data.properties.hashed_token) || null;
    }catch(e){
        console.error("generate_link خطأ شبكة:", e && e.message);
        return json(502, { error: "LINK_FAILED" });
    }

    if(!tokenHash) return json(502, { error: "LINK_FAILED" });

    // ⚠️ لا نعيد البريد للشاشة. الشاشة تحتاج الرمز والاسم فقط، وإظهار بريد
    // المعلّم على سبورة الفصل بلا داعٍ تسريبٌ صغير لا مقابل له.
    return json(200, {
        token_hash: tokenHash,
        member: {
            member_id: member.member_id,
            school_id: member.school_id,
            full_name: member.full_name,
            role: member.role,
        },
    });
};
