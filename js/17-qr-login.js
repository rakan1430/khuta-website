/* ============================================================
   دخول السبورة برمز QR
   ------------------------------------------------------------
   المشكلة التي يحلّها (طرحها المالك): المعلّم أمام صفّه على سبورة ذكية،
   وكتابة بريد Google وكلمة مروره أمام الطلاب في كل حصة متعبة ومكشوفة.
   فيختار "الدخول برمز QR": يمسح بجواله، يوافق، فتفتح السبورة على حسابه.

   ✅ ملاحظة المالك صحيحة تماماً: من مسح الرمز من الطلاب لا يكسب شيئاً —
   لأن الموافقة تتطلّب الدخول بحساب Google الخاص بالمعلّم، ولا يعرفه إلا هو.

   ⚠️ لكن أضفنا شيئين لم يُطلبا، لأن اتجاهين آخرين للهجوم لا تغطّيهما تلك
   الملاحظة، وكلاهما واقعي في فصل فيه طلاب أذكياء:

   (١) رقم مطابقة من أربع خانات.
       الهجوم: يفتح طالبٌ الصفحة على جهازه هو فيظهر له رمز، ثم يعرضه على
       المعلّم قائلاً "الشاشة معلّقة، امسح هذا". فيمسحه المعلّم بحسن نيّة
       ويوافق — فتفتح شاشةُ الطالب على حساب المعلّم دون أن يخطئ المعلّم في
       شيء. الرقم يجعل الموافقة فعلاً واعياً مرتبطاً بشاشة بعينها: على
       الجوال يُكتب الرقمُ المعروضُ على السبورة، فإن كان الرمز من جهاز آخر
       اختلف الرقم وفشلت الموافقة.

   (٢) فصل ما يُعرض عمّا يُثبت الملكية.
       الهجوم: رمز QR معروض على سبورة أمام الصف كله — فتصويره وفكّ ترميزه
       سهل. فلو حمل الرمزُ السرَّ نفسه، لسبق الطالبُ السبورةَ إلى الجلسة.
       لذلك يحمل الرمز sha256(السرّ) فقط، والسرّ لا يغادر ذاكرة المتصفح.

   ⚠️ والجلسة الناتجة محدودة عمداً: عرضٌ فقط. حذف ملف أو إرسال اختبار أو
   تعديل جدول يبقى محتاجاً إثبات Google — لأن الشاشة تبقى مفتوحة في الفصل.
   الفرض في قاعدة البيانات (دالة google_verified) لا في هذه الواجهة.
   ============================================================ */

const QR_POLL_MS   = 2500;    // نبض السؤال "هل وافق المعلّم؟"
const QR_LIFE_MS   = 90000;   // عمر الرمز — يطابق ما تفرضه قاعدة البيانات

let qrSecret = null;          // السرّ: لا يُعرض ولا يُرسل إلا عند المطالبة
let qrPollTimer = null;
let qrTickTimer = null;
let qrDeadline = 0;

/* ⚠️ كان زر رمز QR مخفياً إلا على رابط ‎?board=1، وكان ذلك خطأ من وجهين:
   (١) طلب المالك أن يكون متاحاً للجميع: "يمكن لأي طالب… أن يسجّل عن طريق
       هاتفه بشكل طبيعي دون قيود. التقييد يكون في حال كان المسجّل معلّماً".
   (٢) والأسوأ أن الزر كان داخل شاشة الدخول، وهي تُخفى تلقائياً لمن له جلسة
       قائمة — فمن فتح ‎?board=1 وهو مسجَّل دخوله رأى الشاشة تومض وتختفي ولم
       يرَ الزر أبداً. وهذا ما وصفه المالك بـ"يفتح ويغلق على طول".
   فصار الزر ظاهراً لكل من يرى شاشة الدخول، والتقييد كلّه في قاعدة البيانات. */

/** سرّ عشوائي من مصدر التعمية في المتصفح — لا Math.random هنا. */
function qrNewSecret(){
    if(window.crypto && crypto.randomUUID){
        return "scrn_" + crypto.randomUUID() + crypto.randomUUID();
    }
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return "scrn_" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

async function qrSha256Hex(text){
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, "0")).join("");
}

function qrSetStatus(msg, tone){
    const el = document.getElementById("qr-login-status");
    if(!el) return;
    el.textContent = msg || "";
    el.style.color = tone === "bad" ? "var(--danger, #c0392b)"
                   : tone === "good" ? "var(--ok, #1e8449)"
                   : "var(--text-3)";
}

function qrStopTimers(){
    if(qrPollTimer){ clearInterval(qrPollTimer); qrPollTimer = null; }
    if(qrTickTimer){ clearInterval(qrTickTimer); qrTickTimer = null; }
}

function closeQrLogin(){
    qrStopTimers();
    qrSecret = null;
    const modal = document.getElementById("qr-login-modal");
    if(modal) modal.style.display = "none";
}

/** يفتح النافذة ويولّد رمزاً جديداً. */
async function openQrLogin(){
    const modal = document.getElementById("qr-login-modal");
    if(!modal) return;
    modal.style.display = "flex";
    await qrRegenerate();
}

async function qrRegenerate(){
    qrStopTimers();
    const canvas = document.getElementById("qr-login-canvas");
    const codeEl = document.getElementById("qr-login-code");
    if(!canvas) return;

    qrSetStatus("جارٍ تجهيز الرمز…");
    if(codeEl) codeEl.textContent = "····";

    if(typeof sb === "undefined" || !sb){
        qrSetStatus("الاتصال بالخادم غير متاح الآن.", "bad");
        return;
    }

    qrSecret = qrNewSecret();
    let publicId;
    try{
        publicId = await qrSha256Hex(qrSecret);
    }catch(e){
        // crypto.subtle لا يعمل إلا على HTTPS — نقولها صراحةً بدل صمت محيّر
        qrSetStatus("هذه الميزة تتطلّب اتصالاً آمناً (HTTPS).", "bad");
        return;
    }

    let pairCode;
    try{
        const { data, error } = await sb.rpc("screen_login_start", { p_public_id: publicId });
        if(error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        pairCode = row && row.out_pair_code;
        if(!pairCode) throw new Error("NO_CODE");
    }catch(e){
        console.error("[خُطى] تعذّر إنشاء رمز الدخول:", e);
        qrSetStatus("تعذّر إنشاء الرمز. حدّث الصفحة وحاول مجدداً.", "bad");
        return;
    }

    // ما يدخل الرمز هو المعرّف العلني فقط — لا السرّ
    const url = `${location.origin}${location.pathname}?screen=${publicId}`;
    try{
        qrDrawCanvas(canvas, url, 5);
    }catch(e){
        console.error("[خُطى] تعذّر رسم الرمز:", e);
        qrSetStatus("تعذّر رسم الرمز.", "bad");
        return;
    }

    if(codeEl) codeEl.textContent = pairCode;
    qrDeadline = Date.now() + QR_LIFE_MS;
    qrSetStatus("امسح الرمز بجوّالك، ثم اكتب فيه الرقم المعروض هنا.");

    qrTickTimer = setInterval(qrTick, 1000);
    qrPollTimer = setInterval(qrPoll, QR_POLL_MS);
}

function qrTick(){
    const left = Math.max(0, Math.ceil((qrDeadline - Date.now()) / 1000));
    const el = document.getElementById("qr-login-countdown");
    if(el) el.textContent = left ? `ينتهي خلال ${left} ثانية` : "";
    if(left <= 0){
        qrStopTimers();
        qrSetStatus("انتهت صلاحية الرمز.", "bad");
        const btn = document.getElementById("qr-login-renew");
        if(btn) btn.style.display = "inline-flex";
    }
}

/** يسأل الخادم: هل وافق المعلّم؟ فإن وافق، طالبنا بالجلسة. */
async function qrPoll(){
    if(!qrSecret) return;
    let res;
    try{
        res = await fetch("/.netlify/functions/school-screen-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ secret: qrSecret }),
        });
    }catch(e){
        return;   // انقطاع لحظي — النبضة القادمة تعيد المحاولة
    }

    if(res.status === 404) return;   // لم يوافق بعد، وهو الوضع الطبيعي
    if(!res.ok){
        qrStopTimers();
        const body = await res.json().catch(() => ({}));
        qrSetStatus(body.error === "NOT_CONFIGURED"
            ? "الدخول برمز QR غير مُهيَّأ على الخادم بعد."
            : "تعذّر إتمام الدخول. جرّب رمزاً جديداً.", "bad");
        return;
    }

    qrStopTimers();
    qrSecret = null;                 // استُهلك، فلا يُعاد إرساله أبداً
    const payload = await res.json();
    qrSetStatus("تمّت الموافقة… جارٍ فتح الحساب.", "good");

    try{
        const { error } = await sb.auth.verifyOtp({
            token_hash: payload.token_hash,
            type: "magiclink",
        });
        if(error) throw error;
    }catch(e){
        console.error("[خُطى] تعذّر تفعيل الجلسة:", e);
        qrSetStatus("تعذّر فتح الجلسة. جرّب رمزاً جديداً.", "bad");
        return;
    }

    closeQrLogin();
    // نفس مسار الدخول العادي: تحديث فوري بلا أن يحدّث المعلّم الصفحة يدوياً
    try{ if(typeof refreshAllViewsAfterLogin === "function") refreshAllViewsAfterLogin(); }catch(e){}
}

/* ============================================================
   الطرف الآخر: جوّال المعلّم
   الرابط في الرمز يفتح الموقع نفسه ومعه ?screen=<المعرّف العلني>.
   ============================================================ */

function qrPendingScreenId(){
    try{ return new URLSearchParams(location.search).get("screen"); }
    catch(e){ return null; }
}

async function initQrApprovalPage(){
    const publicId = qrPendingScreenId();
    if(!publicId || !/^[0-9a-f]{64}$/.test(publicId)) return;

    const panel = document.getElementById("qr-approve-panel");
    if(!panel) return;
    panel.style.display = "flex";

    const msg = document.getElementById("qr-approve-msg");
    const setMsg = (t, tone) => {
        if(!msg) return;
        msg.textContent = t;
        msg.style.color = tone === "bad" ? "var(--danger, #c0392b)"
                        : tone === "good" ? "var(--ok, #1e8449)" : "var(--text-3)";
    };

    // ⚠️ اللوحة تظهر أولاً ثم نفحص الاتصال — لأن المعلّم وصل هنا بمسح رمز،
    // فأسوأ ما يمكن أن يراه هو شاشة دخول عادية بلا تفسير لِمَ لم يحدث شيء.
    if(typeof sb === "undefined" || !sb){
        setMsg("تعذّر الاتصال بالخادم. تحقّق من الشبكة ثم أعد تحميل الصفحة.", "bad");
        const btn = document.getElementById("qr-approve-btn");
        if(btn) btn.disabled = true;
        return;
    }

    // هل الرمز حيّ أصلاً؟ نقولها قبل أن يكتب المعلّم شيئاً
    try{
        const { data } = await sb.rpc("screen_login_peek", { p_public_id: publicId });
        const row = Array.isArray(data) ? data[0] : data;
        if(!row){ setMsg("انتهت صلاحية هذا الرمز. أنشئ رمزاً جديداً على الشاشة.", "bad"); return; }
        if(row.out_already_approved){ setMsg("هذا الرمز استُعمل بالفعل.", "bad"); return; }
    }catch(e){
        setMsg("تعذّر التحقق من الرمز.", "bad");
        return;
    }

    const { data: { user } } = await sb.auth.getUser();
    if(!user || user.is_anonymous){
        setMsg("سجّل دخولك بحساب Google أولاً، ثم أكّد الرقم.");
    }else{
        setMsg("اكتب الرقم المعروض على الشاشة التي أمامك.");
    }
}

async function submitQrApproval(){
    const publicId = qrPendingScreenId();
    const input = document.getElementById("qr-approve-code");
    const msg = document.getElementById("qr-approve-msg");
    const setMsg = (t, tone) => {
        if(!msg) return;
        msg.textContent = t;
        msg.style.color = tone === "bad" ? "var(--danger, #c0392b)"
                        : tone === "good" ? "var(--ok, #1e8449)" : "var(--text-3)";
    };
    if(!publicId || !input) return;

    const code = (input.value || "").trim();
    if(!/^[0-9]{4}$/.test(code)){ setMsg("الرقم أربع خانات.", "bad"); return; }

    try{
        const { error } = await sb.rpc("screen_login_approve", {
            p_public_id: publicId, p_pair_code: code,
        });
        if(error) throw error;
    }catch(e){
        const raw = (e && (e.message || e.error_description)) || "";
        // ⚠️ رسائل الخطأ تشرح للمعلّم ما جرى — والفرض نفسه في قاعدة البيانات
        const text =
            raw.includes("NEEDS_GOOGLE")   ? "هذه الموافقة تتطلّب الدخول بحساب Google، لا باسم مستخدم وكلمة مرور." :
            raw.includes("NOT_A_TEACHER")  ? "هذا الحساب ليس حساب معلّم في المدرسة." :
            raw.includes("CODE_MISMATCH")  ? "الرقم لا يطابق الشاشة. تأكّد أنك تنظر إلى السبورة التي تريد فتحها." :
            raw.includes("EXPIRED_OR_USED")? "انتهت صلاحية الرمز أو استُعمل. أنشئ رمزاً جديداً." :
            "تعذّرت الموافقة.";
        setMsg(text, "bad");
        return;
    }

    setMsg("تمّت الموافقة. ستفتح الشاشة خلال ثوانٍ.", "good");
    if(input) input.value = "";
    const btn = document.getElementById("qr-approve-btn");
    if(btn) btn.disabled = true;
}

/* ---------- الإقلاع ---------- */
function initQrLoginUi(){
    const entry = document.getElementById("qr-login-entry");
    if(entry) entry.style.display = "flex";   // متاح للجميع
    initQrApprovalPage();
}

// ⚠️ كل السكربتات تحمل defer، فحالة المستند وقت تنفيذها "interactive" لا
// "loading" — الاعتماد على DOMContentLoaded وحده يفوّت الحدث أحياناً.
if(document.readyState === "complete") initQrLoginUi();
else window.addEventListener("load", initQrLoginUi);

/* ⚠️ سطر صرف أحداث المصادقة انتقل إلى js/99-boot-flush.js — ملف مستقل
   يبقى الأخير دائماً، فلا يُنقل يدوياً كلّما أُضيف ملف جديد. */
