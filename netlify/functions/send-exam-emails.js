/* ============================================================
   إشعارات اختبارات المدرسة — دالة مُجدوَلة
   ------------------------------------------------------------
   حين يرسل مدرّس اختباراً لفصله، تضع دالة enqueue_exam_notifications في
   قاعدة المدرسة صفاً لكل طالب. هذه الدالة تقرأ الطابور وترسل البريد.

   لماذا خادم لا متصفح؟ لأن الإرسال يحتاج مفتاح خدمة يقرأ بريد الطلاب من
   auth.users ومفتاح Brevo. أي منهما في كود المتصفح يعني تسليمه لكل زائر.

   ⚠️ متغيّرات البيئة اللازمة على Netlify (Site settings → Environment):
     SCHOOL_SUPABASE_URL               رابط مشروع Supabase الذي يحوي جداول المدرسة
     SCHOOL_SUPABASE_SERVICE_ROLE_KEY  مفتاح service_role لذلك المشروع
     BREVO_API_KEY                     موجود أصلاً لخُطى، ويُعاد استخدامه
   بدون أولَين تتوقف الدالة بهدوء وتشرح السبب في السجل — ولا تُسقط النشر.

   ⚠️⚠️ تنبيه يخصّ الإعداد الحالي — اقرأه قبل النشر:
   كان للمدارس مشروع Supabase منفصل (gwbhwshxvlagmoonhfha)، ثم دُمج كل شيء
   في مشروع خُطى نفسه (squhkiwjwwyrgufkaujf). فقيمة SCHOOL_SUPABASE_URL
   المضبوطة على موقع motaqadima-khuta ما زالت تشير إلى المشروع القديم
   الفارغ. والنتيجة أن هذه الدالة ستعمل بلا خطأ ظاهر وتجد الطابور فارغاً
   دائماً، فلا يصل بريد أحداً ولا يشتكي شيء في السجل.
   ➡️ عند فتح رصيد Netlify: صحّح SCHOOL_SUPABASE_URL إلى مشروع خُطى، وضع
      مفتاح service_role الخاص به، ثم احذف المشروع القديم أو أوقفه.

   ⚠️ بلا أي حزم npm عمداً، كبقية دوال هذا المشروع (fetch الأصلي فقط).
   ============================================================ */

const SENDER_EMAIL = "khutaa.platform@gmail.com";
const SENDER_NAME  = "خُطى";
const BATCH_LIMIT  = 40;   // سقف لكل تشغيلة — يحمي حصة Brevo المجانية

function env(name){
    const v = process.env[name];
    return (typeof v === "string" && v.trim()) ? v.trim() : null;
}

async function sbFetch(base, key, path, options){
    const res = await fetch(`${base}/rest/v1/${path}`, {
        ...options,
        headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            ...(options && options.headers ? options.headers : {}),
        },
    });
    return res;
}

function escapeHtml(str){
    return String(str == null ? "" : str)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// عنوان الاختبار يكتبه مدرّس — يُهرَّب قبل وضعه في بريد HTML
function buildEmail(studentName, examTitle, subject, schoolName){
    return `
    <div style="font-family:Tahoma,Arial,sans-serif; direction:rtl; text-align:right; max-width:560px; margin:auto; padding:24px; color:#2b2b2b;">
        <h2 style="margin:0 0 6px;">اختبار جديد بانتظارك</h2>
        <p style="color:#666; margin:0 0 20px;">${escapeHtml(schoolName || "")}</p>
        <p>مرحباً ${escapeHtml(studentName || "")}،</p>
        <p>أضاف معلّمك اختباراً جديداً لفصلك:</p>
        <div style="background:#faf7ef; border:1px solid #e8dfc8; border-radius:12px; padding:16px; margin:16px 0;">
            <b style="font-size:16px;">${escapeHtml(examTitle)}</b>
            ${subject ? `<div style="color:#777; margin-top:4px;">${escapeHtml(subject)}</div>` : ""}
        </div>
        <p>افتح المنصة وسجّل دخولك لتجده في قسم "مساحتي".</p>
        <p style="font-size:11px; color:#aaa; margin-top:28px;">وصلتك هذه الرسالة لأن حسابك مسجَّل ضمن طلاب المدرسة على المنصة.</p>
    </div>`;
}

exports.handler = async function(){
    const base = env("SCHOOL_SUPABASE_URL");
    const key  = env("SCHOOL_SUPABASE_SERVICE_ROLE_KEY");
    const brevo = env("BREVO_API_KEY");

    // إعداد ناقص ليس خطأً برمجياً: نخرج بهدوء ونقول ما الناقص بالضبط
    const missing = [
        !base  && "SCHOOL_SUPABASE_URL",
        !key   && "SCHOOL_SUPABASE_SERVICE_ROLE_KEY",
        !brevo && "BREVO_API_KEY",
    ].filter(Boolean);
    if(missing.length){
        console.log("[خُطى/مدارس] متغيّرات بيئة ناقصة، لم يُرسل شيء:", missing.join(", "));
        return { statusCode: 200, body: JSON.stringify({ skipped: true, missing }) };
    }

    try{
        // الطابور: ما لم يُرسل بعد، مع بيانات الاختبار والطالب
        const q = `exam_notifications?sent_at=is.null&select=id,email,student_id,exam_id,`
                + `teacher_exams(title,subject,school_id,schools(name_ar)),school_members(full_name)`
                + `&limit=${BATCH_LIMIT}`;
        const res = await sbFetch(base, key, q, { method: "GET" });
        if(!res.ok){
            const t = await res.text();
            console.error("[خُطى/مدارس] تعذّر قراءة الطابور:", res.status, t.slice(0, 300));
            return { statusCode: 200, body: JSON.stringify({ error: "queue_read_failed" }) };
        }
        const rows = await res.json();
        if(!Array.isArray(rows) || !rows.length){
            return { statusCode: 200, body: JSON.stringify({ sent: 0, note: "الطابور فارغ" }) };
        }

        let sent = 0, failed = 0, skipped = 0;
        for(const r of rows){
            const exam = r.teacher_exams || {};
            const student = r.school_members || {};
            const school = exam.schools || {};

            // طالب بلا بريد (لم يربط حسابه بعد): نضع سبباً ونعلّمه مُعالَجاً
            // كي لا يظل يُقرأ في كل تشغيلة إلى الأبد.
            if(!r.email || !exam.title){
                await sbFetch(base, key, `exam_notifications?id=eq.${r.id}`, {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({ sent_at: new Date().toISOString(), error: !r.email ? "no_email" : "no_exam" }),
                });
                skipped++;
                continue;
            }

            // ⚠️ حجز الصف قبل الإرسال لا بعده.
            // السبب: نفس المستودع يُنشر على أكثر من موقع (خُطى ونسخة المدرسة)،
            // فقد تعمل نسختان من هذه الدالة في اللحظة نفسها، تقرأ كلتاهما نفس
            // الصف غير المرسَل وترسلان — فيصل الطالب رسالتان. الشرط
            // sent_at=is.null يجعل أول من يصل يفوز، والثانية لا تجد شيئاً.
            const claim = await sbFetch(base, key, `exam_notifications?id=eq.${r.id}&sent_at=is.null`, {
                method: "PATCH",
                headers: { Prefer: "return=representation" },
                body: JSON.stringify({ sent_at: new Date().toISOString() }),
            });
            const claimed = claim.ok ? await claim.json().catch(() => []) : [];
            if(!Array.isArray(claimed) || claimed.length === 0){
                skipped++;   // حجزها تشغيل آخر — ليست حالة خطأ
                continue;
            }

            let ok = false, errText = null;
            try{
                const mail = await fetch("https://api.brevo.com/v3/smtp/email", {
                    method: "POST",
                    headers: { "api-key": brevo, "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify({
                        sender: { email: SENDER_EMAIL, name: SENDER_NAME },
                        to: [{ email: r.email, name: student.full_name || undefined }],
                        subject: `اختبار جديد: ${exam.title}`,
                        htmlContent: buildEmail(student.full_name, exam.title, exam.subject, school.name_ar),
                    }),
                });
                ok = mail.ok;
                if(!ok) errText = (await mail.text()).slice(0, 200);
            }catch(e){ errText = String(e && e.message || e).slice(0, 200); }

            // sent_at مضبوط أصلاً من الحجز أعلاه؛ نسجّل هنا سبب الفشل فقط.
            // نترك sent_at كما هو حتى لو فشل الإرسال: إعادة المحاولة إلى الأبد
            // على بريد خاطئ تعني تكراراً بلا نهاية، والسبب مسجَّل للمراجعة.
            if(!ok){
                await sbFetch(base, key, `exam_notifications?id=eq.${r.id}`, {
                    method: "PATCH",
                    headers: { Prefer: "return=minimal" },
                    body: JSON.stringify({ error: errText || "send_failed" }),
                });
            }
            if(ok) sent++; else failed++;
        }

        console.log(`[خُطى/مدارس] أُرسل ${sent}، فشل ${failed}، تُخطّي ${skipped}`);
        return { statusCode: 200, body: JSON.stringify({ sent, failed, skipped }) };
    }catch(e){
        console.error("[خُطى/مدارس] خطأ غير متوقع:", e);
        return { statusCode: 200, body: JSON.stringify({ error: "unexpected" }) };
    }
};
