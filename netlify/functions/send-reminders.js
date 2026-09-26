/* ============================================================
   خُطى — دالة مجدولة (Scheduled Function) لإرسال التذكير اليومي
   ------------------------------------------------------------
   تعمل تلقائياً كل يوم (الجدولة مضبوطة في netlify.toml)، وترسل إشعار
   Push حقيقياً لكل طالب فعّل الإشعارات — يصله حتى لو أغلق الموقع تماماً.

   ⚠️ (٢٥ سبتمبر) لماذا أُعيدت كتابتها: لم تعمل ولا مرة منذ كُتبت. كانت
   تعتمد على مكتبتين خارجيتين (web-push و@supabase/supabase-js) لا يثبّتهما
   Netlify — لا package.json في جذر المشروع ولا أمر بناء — فتسقط الدالّة
   عند تحميلها قبل أن تفعل شيئاً. الدليل: جدول job_runs (أوّل ما تكتبه)
   فارغ منذ يوليو، وحجم حزمتها المنشورة مطابق للدوالّ التي لا مكتبات لها.
   المفتاح VAPID_PRIVATE_KEY كان مضبوطاً على Netlify طوال الوقت.

   الآن بلا أي مكتبة: fetch وcrypto المدمجان في Node فقط، كبقية الدوالّ.
   والإشعار يُرسل **بلا محتوى مشفّر**: بروتوكول Web Push يسمح بذلك، وعامل
   الخدمة (sw.js) يعرض حينها نصّ التذكير الثابت. هذا يُغني عن تشفير
   المحتوى (RFC 8291) كله — والتذكير نصّه واحد لكل الطلاب أصلاً.
   التوقيع (VAPID، RFC 8292): JWT بخوارزمية ES256 من المفتاح الخاص.

   ⚠️ متغيّرات بيئة مطلوبة (Netlify → Environment variables):
   - SUPABASE_SERVICE_ROLE_KEY: مفتاح service_role من Supabase
   - VAPID_PRIVATE_KEY: المفتاح الخاص المطابق للمفتاح العام أدناه وفي js/09-features.js
   ============================================================ */

const crypto = require("crypto");

const SUPABASE_URL = "https://squhkiwjwwyrgufkaujf.supabase.co";
// نفس المفتاح في js/09-features.js (به يشترك المتصفّح). المتغيّر البيئي للفحص فقط.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY_OVERRIDE ||
    "BMWllR59gW0Z5EHMNv1CQxEKzGjvoNY8SEznutD9Du1KVVGohKA8lu9Z8Rx7tnBSfW2ZypVGiXIcPdBRE-id9gA";
const VAPID_SUBJECT = "mailto:soosrakan1430@gmail.com";

// ⚠️ حارس أمني: الدالّة ترسل لكل مشترك ولا يوجد مستخدم في التشغيل المجدول.
// يسجّل وقت آخر تشغيل ويرفض أي تشغيل قبل مرور 20 ساعة — فلو استُدعيت
// بطريقة غير متوقعة لن تُغرق الطلاب بإشعارات متكررة.
const MIN_HOURS_BETWEEN_RUNS = 20;

function b64urlToBuf(s){
    return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
function bufToB64url(b){
    return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** مفتاح توقيع ES256 من زوج VAPID (الخاص 32 بايت، العام نقطة غير مضغوطة 65 بايت). */
function vapidSigningKey(privateB64url, publicB64url = VAPID_PUBLIC_KEY){
    const pub = b64urlToBuf(publicB64url);
    return crypto.createPrivateKey({
        format: "jwk",
        key: {
            kty: "EC", crv: "P-256",
            d: bufToB64url(b64urlToBuf(privateB64url)),
            x: bufToB64url(pub.subarray(1, 33)),
            y: bufToB64url(pub.subarray(33, 65)),
        },
    });
}

/** رأس Authorization لخادم إشعارات بعينه (aud = أصل عنوان الاشتراك). */
function vapidAuthHeader(endpoint, key, publicB64url = VAPID_PUBLIC_KEY){
    const aud = new URL(endpoint).origin;
    const header = bufToB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
    const claims = bufToB64url(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT }));
    const unsigned = `${header}.${claims}`;
    // ieee-p1363 = التوقيع بصيغة r||s الخام (64 بايت) كما يطلبها JWT، لا DER
    const sig = crypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
    return `vapid t=${unsigned}.${bufToB64url(sig)}, k=${publicB64url}`;
}

async function sb(path, serviceKey, options){
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...options,
        headers: { "apikey": serviceKey, "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json",
                   ...((options && options.headers) || {}) },
    });
}

async function claimRunSlot(serviceKey){
    const res = await sb("job_runs?job_name=eq.send-reminders&select=last_run_at", serviceKey, { method: "GET" });
    // فشل قراءة الحارس نفسه لا يجب أن يمنع التذكير اليومي المشروع — نسمح ونسجّل
    if(!res.ok){
        console.error("[خُطى] تعذّرت قراءة حارس التشغيل، نكمل:", res.status);
        return true;
    }
    const rows = await res.json();
    if(rows[0] && rows[0].last_run_at){
        const hours = (Date.now() - new Date(rows[0].last_run_at).getTime()) / 36e5;
        if(hours < MIN_HOURS_BETWEEN_RUNS){
            console.warn(`[خُطى] رُفض تشغيل مبكر: مضت ${hours.toFixed(1)} ساعة فقط منذ آخر إرسال`);
            return false;
        }
    }
    await sb("job_runs", serviceKey, {
        method: "POST", headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ job_name: "send-reminders", last_run_at: new Date().toISOString() }),
    });
    return true;
}

exports.handler = async function () {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    if(!serviceKey || !vapidPrivateKey){
        console.error("SUPABASE_SERVICE_ROLE_KEY أو VAPID_PRIVATE_KEY غير مضبوطين على Netlify");
        return { statusCode: 500, body: "Missing environment variables" };
    }

    // المفتاح الخاص يجب أن يُنتج المفتاح العام نفسه — وإلا رفضت خوادم الإشعارات
    // كل إشعار بـ401/403 بلا سبب ظاهر. نقولها صريحةً في سجل Netlify بدل ذلك.
    try{
        const ecdh = crypto.createECDH("prime256v1");
        ecdh.setPrivateKey(b64urlToBuf(vapidPrivateKey));
        if(bufToB64url(ecdh.getPublicKey()) !== VAPID_PUBLIC_KEY){
            console.error("[خُطى] VAPID_PRIVATE_KEY على Netlify لا يطابق المفتاح العام في js/09-features.js — أعد توليد الزوج.");
            return { statusCode: 500, body: "VAPID key pair mismatch" };
        }
    }catch(e){
        console.error("[خُطى] VAPID_PRIVATE_KEY غير صالح:", e.message);
        return { statusCode: 500, body: "Invalid VAPID key" };
    }

    let key;
    try{ key = vapidSigningKey(vapidPrivateKey); }
    catch(e){
        console.error("[خُطى] VAPID_PRIVATE_KEY غير صالح أو لا يطابق المفتاح العام:", e.message);
        return { statusCode: 500, body: "Invalid VAPID key" };
    }

    if(!(await claimRunSlot(serviceKey))){
        return { statusCode: 429, body: JSON.stringify({ skipped: "too soon since last run" }) };
    }

    const res = await sb("push_subscriptions?select=id,endpoint,subscription", serviceKey, { method: "GET" });
    if(!res.ok){
        console.error("تعذّر جلب الاشتراكات:", res.status, await res.text());
        return { statusCode: 500, body: "Failed to fetch subscriptions" };
    }
    const subscriptions = await res.json();

    let sent = 0, failed = 0, cleaned = 0;
    for(const row of subscriptions){
        const endpoint = (row.subscription && row.subscription.endpoint) || row.endpoint;
        if(!endpoint){ failed++; continue; }
        try{
            const up = await fetch(endpoint, {
                method: "POST",
                headers: { "Authorization": vapidAuthHeader(endpoint, key), "TTL": "86400", "Urgency": "normal", "Content-Length": "0" },
            });
            if(up.ok){ sent++; continue; }
            failed++;
            // الاشتراك لم يعد صالحاً (ألغى الطالب الإذن أو غيّر جهازه) — نحذفه
            if(up.status === 404 || up.status === 410){
                await sb(`push_subscriptions?id=eq.${row.id}`, serviceKey, { method: "DELETE" });
                cleaned++;
            }else{
                console.error("[خُطى] رفض خادم الإشعارات:", up.status, (await up.text()).slice(0, 200));
            }
        }catch(err){
            failed++;
            console.error("[خُطى] تعذّر إرسال إشعار:", err.message);
        }
    }

    console.log(`تم الإرسال: ${sent}، فشل: ${failed}، اشتراكات مُنظَّفة: ${cleaned}`);
    return { statusCode: 200, body: JSON.stringify({ sent, failed, cleaned }) };
};

// للفحص فقط (tools/فحص-إشعارات-الجوال.js)
exports._test = { vapidSigningKey, vapidAuthHeader, b64urlToBuf, bufToB64url };
