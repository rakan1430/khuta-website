/* ============================================================
   12) نموذج الملاحظات — إرسال مباشر وبسيط
   ------------------------------------------------------------
   يحاول أولاً عبر fetch (الطريقة الحديثة الموصى بها من Formspree).
   إن فشلت لأي سبب (شبكة، CORS، فتح الملف مباشرة بدون سيرفر محلي...)
   يلجأ تلقائياً لطريقة احتياطية قديمة وموثوقة: نموذج مخفي يُرسل داخل
   iframe مخفي، وهي طريقة لا تتأثر بقيود CORS إطلاقاً.
   ⚠️ تذكير: أول رسالة يُرسلها أي أحد يجب أن "تُفعّل" النموذج — افتح بريد
   sonyaloy9@gmail.com (وتحقق من الأرشيف/Spam) وابحث عن رسالة من Formspree
   واضغط رابط التأكيد فيها. قبل هذه الخطوة لن تصل أي رسائل مهما كان الكود.
   ============================================================ */
// أقل فاصل مسموح بين ملاحظتين من نفس المتصفح — يمنع إغراق صندوق المطوّر
// بالضغط المتكرر (سهواً أو عمداً) دون إزعاج طالب يرسل ملاحظة واحدة صادقة
const FEEDBACK_COOLDOWN_MS = 60 * 1000;

async function sendFeedback(){
    const textEl = document.getElementById("feedback-text");
    const text = textEl.value.trim();
    if(!text){ showToast(t("feedback.empty")); return; }

    const last = parseInt(localStorage.getItem("khuta_feedback_last") || "0", 10);
    const waited = Date.now() - last;
    if(last && waited < FEEDBACK_COOLDOWN_MS){
        const secs = Math.ceil((FEEDBACK_COOLDOWN_MS - waited) / 1000);
        showToast(labT(`أرسلت ملاحظة للتو — انتظر ${secs} ثانية قبل التالية 🙏`,
                       `You just sent one — wait ${secs}s before the next 🙏`));
        return;
    }
    // نصوص قصيرة جداً غالباً ضغط عابر لا ملاحظة حقيقية
    if(text.length < 10){
        showToast(labT("اكتب ملاحظة أوضح قليلاً كي أفهمها 🙏","Please write a bit more detail 🙏"));
        return;
    }

    const btn = document.getElementById("feedback-send-btn");
    const name = `${localStorage.getItem("khuta_name")||""} ${localStorage.getItem("khuta_last")||""}`.trim() || "طالب خُطى";

    if(!FEEDBACK_ENDPOINT){
        const subject = encodeURIComponent("ملاحظة على تطبيق خُطى من " + name);
        const body = encodeURIComponent(text + "\n\n---\nمرسلة عبر تطبيق خُطى");
        window.location.href = `mailto:${APP_OWNER_EMAIL}?subject=${subject}&body=${body}`;
        showToast(t("feedback.opened"));
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (currentLang==='ar' ? 'جارٍ الإرسال...' : 'Sending...');

    // نمرّر حقل المصيدة كما هو: إن كان مملوءاً فالمرسِل روبوت، ويتجاهله
    // Formspree تلقائياً. الطالب الحقيقي لا يراه فيبقى فارغاً دائماً.
    const gotcha = (document.getElementById("feedback-gotcha") || {}).value || "";
    const payload = { name, message: text, app: "خُطى — ملاحظة طالب", _subject: "ملاحظة جديدة من تطبيق خُطى", _gotcha: gotcha };
    let success = false;

    try{
        const formData = new FormData();
        Object.keys(payload).forEach(k => formData.append(k, payload[k]));
        const res = await fetch(FEEDBACK_ENDPOINT, { method:"POST", headers:{ "Accept":"application/json" }, body: formData });
        if(res.ok){
            success = true;
            localStorage.setItem("khuta_feedback_last", String(Date.now()));
        } else {
            const bodyText = await res.text().catch(() => "");
            console.error("[خُطى] Formspree رفض الطلب — الحالة:", res.status, "التفاصيل:", bodyText);
        }
    }catch(err){
        console.error("[خُطى] فشل fetch إلى Formspree (على الأغلب CORS أو تشغيل الملف مباشرة بدون سيرفر):", err);
    }

    if(!success){
        try{
            await submitViaHiddenIframe(FEEDBACK_ENDPOINT, payload);
            success = true; // لا يمكن قراءة استجابة الـ iframe لتأكيد النجاح فعلياً، نفترض النجاح
            console.warn("[خُطى] تم الإرسال عبر الطريقة الاحتياطية (iframe) — لا يمكن تأكيد الوصول برمجياً، تحقق من بريدك.");
        }catch(err2){
            console.error("[خُطى] فشلت الطريقة الاحتياطية أيضاً:", err2);
        }
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> <span>' + t("feedback.send") + "</span>";

    if(success){
        textEl.value = "";
        showFeedbackSuccess();
    } else {
        showToast(t("feedback.error"));
    }
}

/* إرسال نموذج مخفي داخل iframe مخفي — لا يخضع لقيود CORS لأنه ليس طلب fetch،
   يُستخدم فقط كحل احتياطي إن فشل fetch. */
function submitViaHiddenIframe(url, fields){
    return new Promise((resolve) => {
        const iframeName = "khuta-hidden-frame-" + Date.now();
        const iframe = document.createElement("iframe");
        iframe.name = iframeName;
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        const form = document.createElement("form");
        form.action = url;
        form.method = "POST";
        form.target = iframeName;
        Object.keys(fields).forEach(key => {
            const input = document.createElement("input");
            input.type = "hidden";
            input.name = key;
            input.value = fields[key];
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();

        setTimeout(() => {
            form.remove();
            iframe.remove();
            resolve(true);
        }, 1200);
    });
}

/* تقرير صامت للمطوّر عند إضافة الطالب مصدراً مخصصاً (لفظياً أو كمياً) وكتب
   اسمه — يساعدك على ملاحظة تكرار نفس المصدر بين طلاب مختلفين لتقييم إضافته
   رسمياً للتطبيق. لا يُرسل شيئاً إن ترك الطالب اسم المصدر فارغاً. */
async function reportCustomSource(kind, data){
    if(!data || !data.name) return;
    const name = `${localStorage.getItem("khuta_name")||""} ${localStorage.getItem("khuta_last")||""}`.trim() || "طالب خُطى";
    // تخزين منظّم في Supabase (راجعه من Table Editor → custom_source_reports)
    if(sb){
        try{
            await sb.from("custom_source_reports").insert({
                kind, source_name: data.name, origin: data.origin || null,
                unit: data.unit, total: data.total, qper: data.qper || null, reporter_name: name,
            });
        }catch(e){ /* تجاهل بصمت — البريد أدناه هو النسخة الاحتياطية */ }
    }
    if(!FEEDBACK_ENDPOINT) return;
    const payload = {
        name,
        app: "خُطى — تقرير مصدر مخصص",
        _subject: `مصدر ${kind === "verbal" ? "لفظي" : "كمي"} مخصص جديد: ${data.name}`,
        message: `القسم: ${kind === "verbal" ? "لفظي" : "كمي"}\nاسم المصدر: ${data.name}\nمصدره (من أين): ${data.origin || "لم يُذكر"}\nوحدة العد: ${data.unit}\nالإجمالي: ${data.total}\nملاحظة الأسئلة لكل وحدة: ${data.qper || "—"}`
    };
    try{
        const formData = new FormData();
        Object.keys(payload).forEach(k => formData.append(k, payload[k]));
        await fetch(FEEDBACK_ENDPOINT, { method:"POST", headers:{ "Accept":"application/json" }, body: formData });
    }catch(err){
        try{ await submitViaHiddenIframe(FEEDBACK_ENDPOINT, payload); }catch(e2){ /* تجاهل — تقرير غير حرج */ }
    }
}

function showFeedbackSuccess(){
    const box = document.getElementById("feedback-success");
    box.style.display = "flex";
    setTimeout(() => { box.style.display = "none"; }, 4000);
}

function initContactLinks(){
    const digits = APP_WHATSAPP_NUMBER.replace(/\D/g, "");
    const intl = digits.startsWith("966") ? digits : "966" + digits.replace(/^0/, "");
    const waLink = document.getElementById("whatsapp-link");
    if(waLink){
        waLink.href = `https://wa.me/${intl}`;
        document.getElementById("whatsapp-number-display").textContent = APP_WHATSAPP_NUMBER;
    }
    const tkLink = document.getElementById("tiktok-link");
    if(tkLink && APP_TIKTOK_URL){
        tkLink.href = APP_TIKTOK_URL;
        tkLink.style.display = "";
    }
    const tgLink = document.getElementById("telegram-link");
    if(tgLink && APP_TELEGRAM_URL){
        tgLink.href = APP_TELEGRAM_URL;
        tgLink.style.display = "";
    }
    const supportLink = document.getElementById("support-link");
    if(supportLink && APP_SUPPORT_URL){
        supportLink.href = APP_SUPPORT_URL;
        supportLink.style.display = "inline-block";
    }
}

/* ============================================================
   14) لوحة المطوّر — محلية فقط، مخفية خلف رابط سرّي
   ------------------------------------------------------------
   ⚠️ صادقة بوضوح: بما أن كل بيانات الطلاب مخزّنة محلياً في متصفح كل طالب
   (localStorage) ولا يوجد خادم مركزي، فهذه اللوحة لا تعرض إلا بيانات
   الجهاز الحالي الذي تفتح منه — لا يمكن لأي صفحة أن "ترى" بيانات أجهزة
   طلاب آخرين. للاطلاع على ملاحظات الطلاب والمصادر المخصصة عبر الجميع،
   المصدر الحقيقي الموحد هو بريدك المرتبط بـ Formspree.
   الوصول: أضف #khuta-dev-2026 في نهاية رابط الصفحة. غيّر هذا النص
   السرّي إلى أي شيء تريده في DEV_PANEL_HASH أدناه.
   ============================================================ */
const DEV_PANEL_HASH = "#khuta-dev-2026";

function checkDevPanel(){
    if(window.location.hash === DEV_PANEL_HASH){
        const box = document.getElementById("dev-data-box");
        const dump = {};
        Object.keys(localStorage).filter(k => k.startsWith("khuta_")).forEach(k => {
            try{ dump[k] = JSON.parse(localStorage.getItem(k)); }catch(e){ dump[k] = localStorage.getItem(k); }
        });
        box.textContent = JSON.stringify(dump, null, 2);
        document.getElementById("dev-overlay").style.display = "flex";
    }
}

function copyDevData(){
    const text = document.getElementById("dev-data-box").textContent;
    if(navigator.clipboard){
        navigator.clipboard.writeText(text).then(() => showToast("تم نسخ البيانات ✅"));
    }
}

function clearAllLocalData(){
    if(!confirm("سيُحذف كل شيء مخزّن في هذا الجهاز (الاسم، الخطة، الملف الشخصي...) نهائياً. متابعة؟")) return;
    Object.keys(localStorage).filter(k => k.startsWith("khuta_")).forEach(k => localStorage.removeItem(k));
    showToast("تم مسح بيانات هذا الجهاز");
    setTimeout(() => window.location.reload(), 800);
}

/* ============================================================
   16) الحساب السحابي — تسجيل دخول، تسجيل خروج، مزامنة
   ------------------------------------------------------------
   الفكرة: الطالب يستخدم التطبيق كضيف بشكل طبيعي بالكامل (localStorage
   فقط، بدون حساب). إن أراد حفظ تقدمه ونقله لجهاز آخر، ينشئ "حساباً"
   باسم مستخدم وكلمة مرور فقط. داخلياً نحوّل اسم المستخدم إلى بريد وهمي
   (username@khuta.local) ونستخدم نظام Supabase Auth الحقيقي والآمن
   (تشفير كلمات المرور وجلسات JWT مُدارة من Supabase نفسها) — هذا أأمن
   بكثير من بناء نظام تحقق مخصص من الصفر.
   ============================================================ */
let signupMode = false;
function toggleSignupMode(){
    signupMode = !signupMode;
    document.getElementById("acc-password2-group").style.display = signupMode ? "block" : "none";
    document.getElementById("signup-toggle-label").textContent = signupMode
        ? (currentLang==='ar' ? "لدي حساب بالفعل" : "I already have an account")
        : t("account.signup");
    const signInBtn = document.querySelector('[onclick="signInAccount()"]');
    if(signInBtn){
        signInBtn.setAttribute("onclick", signupMode ? "signUpAccount()" : "signInAccount()");
        signInBtn.querySelector("span").textContent = signupMode ? t("account.createBtn") : t("account.signin");
    }
}

let loginSignupMode = false;
function toggleLoginSignupMode(){
    loginSignupMode = !loginSignupMode;
    document.getElementById("login-password2-group").style.display = loginSignupMode ? "block" : "none";
    document.getElementById("login-signup-toggle-label").textContent = loginSignupMode
        ? (currentLang==='ar' ? "لدي حساب بالفعل" : "I already have an account")
        : t("account.signup");
}
async function completePasswordRecovery(){
    if(!sb) return;
    const p1 = document.getElementById("recovery-new-pass-1").value;
    const p2 = document.getElementById("recovery-new-pass-2").value;
    if(p1.length < 6){ showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(p1 !== p2){ showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){
        console.error("[خُطى] تعذّر تعيين كلمة المرور الجديدة:", error);
        showToast(currentLang==='ar' ? "تعذّر حفظ كلمة المرور" : "Couldn't save the password");
        return;
    }
    document.getElementById("password-recovery-overlay").style.display = "none";
    showToast(currentLang==='ar' ? "✅ تم تعيين كلمة مرورك الجديدة" : "✅ Your new password is set");
    location.reload();
}

function toggleForgotPasswordForm(){
    const box = document.getElementById("forgot-password-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

/* ⚠️ التحويل من اسم مستخدم إلى بريد لم يعد يحدث في المتصفح إطلاقاً.
   كان هذا المسار يقرأ بريد صاحب الاسم ثم يطلب الرسالة بنفسه — أي أن كتابة
   اسم من لوحة المتصدّرين كانت تكشف بريد صاحبه في ردّ الشبكة. الآن نرسل
   الاسم وحده إلى /.netlify/functions/password-reset، والخادم يحوّله بمفتاح
   الخدمة ويطلب من Supabase إرسال الرسالة، ولا يُعيد لنا بريداً ولا يفرّق
   ردّه بين حسابٍ موجود وآخر غير موجود. */
async function sendPasswordReset(){
    const input = document.getElementById("forgot-username-input");
    const username = input.value.trim();
    if(!username){
        showToast(currentLang==='ar' ? "أدخل اسم المستخدم" : "Enter your username");
        return;
    }

    let networkFailed = false;
    try{
        const res = await fetch("/.netlify/functions/password-reset", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username }),
        });
        if(!res.ok) networkFailed = true;
    }catch(e){
        console.error("[خُطى] تعذّر الوصول لخدمة استرجاع كلمة المرور:", e);
        networkFailed = true;
    }

    if(networkFailed){
        // خطأ شبكة/خدمة حقيقي — نقوله صراحةً بدل ادّعاء إرسالٍ لم يحدث
        showToast(currentLang==='ar'
            ? "⚠️ تعذّر الوصول لخدمة الاسترجاع الآن. تحقّق من اتصالك وحاول بعد قليل."
            : "⚠️ Couldn't reach the recovery service. Check your connection and try again shortly.");
        return;
    }

    input.value = "";
    document.getElementById("forgot-password-form").style.display = "none";
    // الرسالة نفسها في كل الحالات — لا يُستدلّ منها على وجود حساب من عدمه
    showToast(currentLang==='ar'
        ? "📧 إن وُجد هذا الحساب وربط بريداً حقيقياً من قبل، وصلته رسالة إعادة التعيين. إن لم يصلك شيء، سجّل الدخول واربط بريداً من ملفك الشخصي أولاً."
        : "📧 If this account exists and previously linked a real email, a reset message was sent. If nothing arrives, sign in and link an email from your profile first.");
}

function loginScreenSignIn(){
    if(loginSignupMode){
        signUpWithCreds("login-username", "login-password", "login-password2", true, "login-email");
    } else {
        signInWithCreds("login-username", "login-password", true);
    }
}

function continueAsGuest(){
    document.getElementById("login-overlay").style.display = "none";
    if(!localStorage.getItem("khuta_name")) localStorage.setItem("khuta_name", currentLang === "ar" ? "ضيف" : "Guest");
    updateWelcomeText();
    if(!localStorage.getItem("khuta_plan_days")){
        document.getElementById("setup-overlay").style.display = "flex";
    }
}

async function signInWithGoogle(){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable"); return; }
    const { error } = await sb.auth.signInWithOAuth({ provider:"google", options:{ redirectTo: window.location.href.split("#")[0] } });
    if(error) showToast(currentLang==='ar' ? "تعذّر الدخول عبر Google — تأكد أن المزوّد مفعّل في Supabase" : "Google sign-in failed — check the provider is enabled in Supabase");
}
/* ============================================================
   ⚠️ إصلاح شكوى حقيقية: بعد تسجيل الدخول كان الطالب مضطراً لتحديث الصفحة
   يدوياً حتى تظهر بياناته المحفوظة في قاعدة البيانات.
   ------------------------------------------------------------
   السبب أن مسار الدخول كان يجلب البيانات ويحفظها محلياً، لكنه لا يُعيد رسم
   الأقسام التي رُسمت قبل الدخول ببيانات فارغة. تحديث الصفحة كان يُعيد
   الرسم صدفةً لا قصداً.

   هذه الدالة تُعيد رسم كل ما يعتمد على بيانات الحساب دفعة واحدة، وتُستدعى
   من كل مسارات الدخول. كل استدعاء محاط بحمايته لأن بعض الأقسام قد لا تكون
   مفعّلة (أعلام الميزات)، ولا يجوز أن يُسقط فشل قسمٍ بقيةَ الشاشة.
   ============================================================ */
function refreshAllViewsAfterLogin(){
    const steps = [
        "updateWelcomeText", "renderAccountUI", "loadProfileForm",
        "buildScheduleTable", "renderProgress", "renderGamification",
        "applyDashboardCardVisibility", "updateExamCountdownWidget",
        "renderLeaderboard", "renderForumPosts",
    ];
    steps.forEach(name => {
        try{ if(typeof window[name] === "function") window[name](); }
        catch(e){ console.warn("[خُطى] تعذّر تحديث " + name + " بعد الدخول:", e); }
    });
    // قسم المدرسة يُحمَّل بعد معرفة العضوية (طلب شبكة)، فله مساره الخاص
    try{ if(typeof initSchoolAfterLogin === "function") initSchoolAfterLogin(); }
    catch(e){ console.warn("[خُطى] تعذّر تحديث قسم المدرسة بعد الدخول:", e); }
}

function finishLoginBoot(){
    // يُعيد رسم كل ما يعتمد على بيانات الحساب فور الدخول — بلا تحديث يدوي.
    refreshAllViewsAfterLogin();
    if(!localStorage.getItem("khuta_plan_days")){
        document.getElementById("setup-overlay").style.display = "flex";
    } else {
        buildScheduleTable();
        renderProgress();
        setTimeout(startOnboardingTour, 900);
    }
    updateShortBreakLabel();
    updateCustomMinHint();
    initDashboardReorder();
    applyDashboardCardVisibility();
    updateExamCountdownWidget();
    applyFeatureFlags();
    initOverlayScrollLock();
}

/* التقاط نجاح تسجيل الدخول عبر Google/Apple عند العودة من صفحة المزوّد */
function usernameToEmail(username){
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    return `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`;
}

// يحدّد البريد الفعلي المرتبط باسم مستخدم عبر جدول username_lookup (يُزامَن
// تلقائياً من الخادم — انظر SUPABASE_MIGRATION_password_recovery.sql).
// نرجع للبريد المصطنع فقط إن لم يوجد صف بعد (حساب أُنشئ قبل هذا الإصلاح
// ولم يُسجَّل دخول أو يُحدَّث منذ تشغيل الترحيل) — يحافظ هذا على عمل تسجيل
// الدخول لكل الحسابات القديمة بلا استثناء، مع تفعيل الاسترجاع الحقيقي
// تلقائياً لأي حساب دخل جدول username_lookup (كل حساب جديد، وأي حساب قديم
// بعد أول تسجيل دخول ناجح له بفضل تعبئة الترحيل الرجعية)
async function resolveUsernameEmail(username, password){
    if(!sb) return usernameToEmail(username);
    try{
        // ⚠️ عبر دالة محمية لا بقراءة الجدول مباشرة: سياسة القراءة العامة على
        // username_lookup كانت تسمح لأي شخص بسحب الجدول كاملاً — كل أسماء
        // المستخدمين ومعرّفاتهم وبريدهم الحقيقي. أُلغيت السياسة، وصار التحويل
        // عبر resolve_username_email التي تُرجع البريد وحده لاسم واحد مطابق.
        //
        // وكان الاستدعاء السابق يمرّر مدخل الطالب مباشرة إلى .ilike()، فأي "%"
        // يكتبه يعمل كمحرف بدل يطابق صفوفاً ليست له — الدالة تستعمل مساواة
        // تامة غير حساسة لحالة الأحرف، فتحفظ سلوك الدخول القائم وتُلغي ذلك.
        /* ⚠️ كلمة المرور تُمرَّر عمداً: كانت الدالة تُرجع بريد أي مستخدم لمن
           يعرف اسمه فقط — وأسماء المستخدمين معروضة علناً في لوحة المتصدّرين
           والمجتمع. فمن يقرأ اللوحة كان يحصد بريد كل مستخدم في المنصة.
           الآن لا يُرجَع البريد إلا لمن يعرف كلمة المرور أصلاً، فمن يعرفها
           لا يكسب شيئاً جديداً ومن لا يعرفها لا يحصد شيئاً. */
        const { data } = await sb.rpc("resolve_username_email", {
            p_username: username.trim(),
            p_password: password || "",
        });
        if(data) return data;
    }catch(e){ /* الجدول قد لا يكون منشأً بعد على مواقع لم تُشغّل الترحيل — نتجاهل بصمت */ }
    return usernameToEmail(username);
}

function getSession(){ try{ return JSON.parse(localStorage.getItem("khuta_session")) || null; }catch(e){ return null; } }

// يرسل نتيجة الاختبار الكامل بالبريد — فقط إن كان هناك جلسة Supabase حقيقية
// (يتحقق الخادم من كون البريد المرتبط حقيقياً فعلاً، هذا مجرد استدعاء أولي)
/* ============================================================
   نظام الموافقة على الرسائل + المستندات القانونية
   ------------------------------------------------------------
   الموافقة تُحفظ في user_data (المزامَن مع الحساب) لا في localStorage فقط —
   حتى تبقى صحيحة عبر أجهزة الطالب كلها، ولأن الوظيفة المجدولة على الخادم
   ستحتاج قراءتها لاحقاً لتقرير من يستحق رسالة تذكيرية.
   ============================================================ */
async function updateMarketingConsent(consented){
    try{
        localStorage.setItem("khuta_marketing_consent", consented ? "1" : "0");
        localStorage.setItem("khuta_consent_asked", "1");
        const session = getSession();
        if(sb && session && session.uid){
            await sb.from("user_data").update({ marketing_consent: !!consented }).eq("id", session.uid);
        }
        showToast(consented
            ? labT("👍 تمام — نرسل لك أحياناً تذكيراً بسيطاً","👍 Got it — we'll send occasional reminders")
            : labT("✅ ما راح نرسل لك أي رسائل تذكيرية","✅ We won't send you any reminder emails"));
    }catch(e){
        console.error("[خُطى] تعذّر حفظ تفضيل الرسائل:", e);
    }
}

function respondToConsentPrompt(consented){
    document.getElementById("consent-prompt-modal").style.display = "none";
    document.body.style.overflow = "";
    updateMarketingConsent(consented);
}

// يسأل الحسابات القائمة (التي لديها بريد حقيقي مرتبط) مرة واحدة فقط
async function maybeAskForMarketingConsent(){
    try{
        if(localStorage.getItem("khuta_consent_asked") === "1") return; // سُئل من قبل، لا نكرر أبداً
        const session = getSession();
        if(!sb || !session || !session.username) return;
        const { data } = await sb.auth.getUser();
        const email = data && data.user && data.user.email;
        if(!email) return;
        // لا نسأل إلا من ربط بريداً حقيقياً فعلاً — سؤال من لا بريد له بلا معنى
        const clean = session.username.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
        if(email.toLowerCase() === `khuta.${clean}@${USERNAME_EMAIL_DOMAIN}`) return;
        document.getElementById("consent-prompt-modal").style.display = "flex";
        document.body.style.overflow = "hidden";
    }catch(e){ /* لا نُزعج الطالب بأي خطأ هنا — الميزة ثانوية بالكامل */ }
}

function renderPrivacyCard(){
    const row = document.getElementById("profile-marketing-row");
    const note = document.getElementById("profile-marketing-note");
    const box = document.getElementById("profile-marketing-consent");
    if(!row || !box) return;
    const session = getSession();
    if(!session){
        row.style.display = "none";
        note.style.display = "block";
        note.textContent = labT("سجّل دخولك أولاً للتحكم بتفضيلات الرسائل.","Sign in first to manage email preferences.");
        return;
    }
    row.style.display = "flex";
    note.style.display = "none";
    box.checked = localStorage.getItem("khuta_marketing_consent") === "1";
}

/* ============================================================
   شروط الاستخدام وسياسة الخصوصية
   ------------------------------------------------------------
   ⚠️ (٢٦ سبتمبر) أُعيدت كتابتهما بطلب المالك: «أعتقد أنها قديمة جداً الآن».
   وكانت فعلاً غير صحيحة لا قديمة فقط: قالت «لا نجمع اسمك الحقيقي ولا رقم
   هويتك» — ومنصة المدارس تحفظ الاسم الكامل، وتستعمل الهوية عند الاستيراد
   (بصمة مشفّرة)، والدرجات والغياب. النصّ هنا يطابق ما يفعله الموقع اليوم.
   ⚠️ عند تغيير أيّ منهما: ارفع TERMS_VERSION وTERMS_UPDATED، ثم يرسل المالك
   الإشعار من «أدوات المشرف ← إشعار تحديث الشروط» (js/43-notices.js).
   ============================================================ */
const TERMS_VERSION = "2.0";
const TERMS_UPDATED = { ar: "٢٦ سبتمبر ٢٠٢٦", en: "26 September 2026" };

const LEGAL_DOCS = {
    terms: {
        titleAr: "شروط الاستخدام", titleEn: "Terms of Use",
        bodyAr: `
            <h3>١. ما هي خُطى</h3>
            <p>خُطى منصة تعليمية سعودية لها وجهان: <b>رفيق القدرات</b> لتنظيم مذاكرة اختبار القدرات العامة، و<b>منصة المدارس</b> التي تستعملها المدرسة لعملها اليومي مع طلابها (الملفات، الاختبارات، الواجبات، السجلّ، المكتبة، الجدول الدراسي). خُطى <b>غير تابعة</b> لهيئة تقويم التعليم والتدريب (قياس) ولا لوزارة التعليم، و<b>لا ترتبط بنظام نور</b>: ما يظهر منه (كالدرجات الرسمية والغياب) ترفعه المدرسة بنفسها من ملفاتها.</p>
            <h3>٢. الحسابات</h3>
            <p>تستطيع استعمال رفيق القدرات ضيفاً بلا حساب، أو بحساب (اسم مستخدم أو Google). أما منصة المدارس فحساباتها تنشئها إدارة المدرسة أو توافق عليها، وتستطيع إيقافها. أنت مسؤول عن سرّية دخولك، ومنه كلمة «الدخول السريع» على سبورة الفصل.</p>
            <h3>٣. ما ترفعه وتكتبه</h3>
            <p>أنت مسؤول عمّا ترفعه أو تكتبه (ملفات، أسئلة، روابط، مشاركات). يجب أن يكون تعليمياً ونظامياً، وألّا ينتهك حقوق غيرك أو خصوصيته. ملفات المعلّم المشارَكة تظهر لطلاب فصوله. المشاركات التي يبلّغ عنها خمسة تُخفى وتُراجع وقد تُحذف، ولنا حذف أي محتوى مخالف.</p>
            <h3>٤. الاختبارات والواجبات والدرجات</h3>
            <p>تصحيح الاختبارات الإلكترونية آلي حسب الإجابة التي حدّدها المعلّم، والمعلّم والمدرسة هما المسؤولان عن الأسئلة والدرجات ومواعيدها. الدرجات الرسمية تُعرض كما رفعتها المدرسة دون تعديل منّا. أي اعتراض على درجة يكون للمدرسة. ويُمنع تسريب أسئلة اختبار أو إجاباته أثناء وقته، أو أي محاولة للغشّ أو للالتفاف على المؤقّت.</p>
            <h3>٥. المساعد الذكي</h3>
            <p>المساعد أداة مساعدة قد تُخطئ. ما يصوغه من أسئلة أو شرح هو <b>مسودّة يراجعها المعلّم</b> قبل أن يحفظها أو يرسلها — المساعد لا يحفظ ولا يرسل شيئاً بنفسه. لا تعتمد عليه وحده في قرار مهم، ولا ترسل له بيانات شخصية حسّاسة. لاستعماله حدّ يومي وأسبوعي، وقد تحدّد المدرسة حدّاً لأعضائها.</p>
            <h3>٦. دقّة المعلومات العامة</h3>
            <p>بيانات الجامعات وأوزان النسب الموزونة ومتطلبات القبول تقريبية وقد تتغيّر — <b>تحقّق دائماً من الموقع الرسمي للجامعة</b>. والاختبارات المحاكية للتدريب لا تعكس الاختبار الحقيقي حرفياً.</p>
            <h3>٧. الرسائل</h3>
            <p>رسائل خُطى التذكيرية لا تصلك إلا إن وافقت عليها. رسائل إدارة مدرستك تصل طلابها ويمكن إيقافها برابط في أسفلها. ورسائل الخدمة (مثل إشعار تحديث هذه الشروط) تصل كل مستخدم.</p>
            <h3>٨. الاستخدام المقبول</h3>
            <p>يُمنع استعمال خُطى لأي غرض غير نظامي، أو الإساءة لأحد، أو محاولة تعطيلها أو تجاوز صلاحياتك، أو إساءة استعمال مواردها (كالإكثار المتعمّد من طلبات الذكاء الاصطناعي أو الرسائل).</p>
            <h3>٩. التغييرات</h3>
            <p>قد تُحدَّث هذه الشروط مع تطوّر خُطى. نُبلغك بالتحديث داخل الموقع، وبالبريد لمن له بريد. استمرارك في الاستعمال بعد الإبلاغ موافقة على النسخة المحدّثة.</p>
            <p class="legal-updated">آخر تحديث: ${TERMS_UPDATED.ar} · النسخة ${TERMS_VERSION}</p>`,
        bodyEn: `
            <h3>1. What Khuta is</h3>
            <p>Khuta is a Saudi learning platform with two sides: a <b>GAT study companion</b>, and a <b>school platform</b> schools use with their students (files, exams, homework, records, library, timetable). It is <b>not affiliated</b> with Qiyas (ETEC) or the Ministry of Education, and <b>is not connected to Noor</b>: official grades and attendance appear only if the school uploads them.</p>
            <h3>2. Accounts</h3>
            <p>The GAT companion works as a guest or with an account. School accounts are created or approved by the school, which can suspend them. Keep your sign-in private, including any classroom quick-login password.</p>
            <h3>3. What you upload</h3>
            <p>You are responsible for what you upload or write. It must be educational, lawful and respect others' rights and privacy. Posts reported five times are hidden, reviewed and may be removed.</p>
            <h3>4. Exams, homework and grades</h3>
            <p>Online exams are auto-graded against the teacher's answer key; teachers and the school are responsible for questions, grades and deadlines. Official grades are shown as uploaded by the school. Leaking questions or answers during an exam, or cheating, is prohibited.</p>
            <h3>5. AI assistant</h3>
            <p>The assistant may make mistakes. What it drafts is a draft the teacher reviews — it never saves or sends anything by itself. Don't share sensitive personal data with it. Usage limits apply.</p>
            <h3>6. General information</h3>
            <p>University data and weighted-score formulas are approximate — always verify officially. Practice exams are for training only.</p>
            <h3>7. Messages</h3>
            <p>Khuta reminders only with your consent. School messages reach its students and can be stopped from their footer. Service notices (like terms updates) reach everyone.</p>
            <h3>8. Acceptable use</h3>
            <p>No unlawful use, abuse, attempts to disrupt Khuta or exceed your permissions, or abuse of its resources.</p>
            <h3>9. Changes</h3>
            <p>We notify you of updates in the app, and by email where available. Continued use after notice means acceptance.</p>
            <p class="legal-updated">Last updated: ${TERMS_UPDATED.en} · version ${TERMS_VERSION}</p>`,
    },
    privacy: {
        titleAr: "سياسة الخصوصية", titleEn: "Privacy Policy",
        bodyAr: `
            <h3>ما نحفظه — حسب طريقة استعمالك</h3>
            <p><b>ضيفاً بلا حساب:</b> خطتك وتقدّمك وملاحظاتك تبقى <b>في متصفحك أنت</b>. ولكي يعمل المجتمع (من يذاكر الآن، لوحة الصدارة) يُنشأ لك معرّف مجهول بلا أي معلومة شخصية.</p>
            <p><b>بحساب خُطى:</b> اسم المستخدم أو بريد Google، وكلمة مرور مشفّرة لا نراها، وتقدّمك الدراسي (الخطة، ساعات المذاكرة، النقاط، نتائج الاختبارات المحاكية) لمزامنته بين أجهزتك، وملفاتك الخاصة في «ملفاتي» (لا يراها غيرك).</p>
            <p><b>عضواً في مدرسة:</b> ما تدخله المدرسة عنك — الاسم الكامل والبريد والدور والصف والشعبة. ورقم الهوية عند استيراد الطلاب <b>لا يُحفظ</b>؛ تُحفظ منه بصمة مشفّرة للمطابقة فقط. ونحفظ أعمالك على المنصة (إجاباتك ودرجاتك ومواعيد تسليمك)، والدرجات الرسمية والغياب إن رفعتها المدرسة، والملفات التي يرفعها المعلّمون والطلاب، وسجلّاً بمن اطّلع على ملف الطالب من المدرسة.</p>
            <h3>من يرى ماذا</h3>
            <p>الطالب يرى بياناته. المعلّم يرى طلاب فصوله في مادته. الإدارة ترى مدرستها. المرشد الطلابي يرى مواطن الضعف ومن يحتاج متابعة. وليّ الأمر يرى أعمال ابنه فقط برابط خاص تصدره المدرسة (للقراءة، ويمكن إلغاؤه). ونحن نطّلع لتشغيل الخدمة ودعمها فقط. <b>لا نبيع بياناتك ولا نعرض إعلانات.</b></p>
            <h3>المساعد الذكي والصوت</h3>
            <p>ما ترسله للمساعد (نص، صورة، ملف) يُرسل إلى Google Gemini ليولّد الرد، ولا نحفظه عندنا؛ نحفظ <b>عدد</b> استعمالاتك فقط لتطبيق الحدّ. محادثاتك معه محفوظة في جهازك. والأسئلة التي يولّدها الاختبار المحاكي من ملف ترفعه قد يُضاف السليم منها — <b>بلا أي معلومة عنك</b> — إلى بنك أسئلة القدرات المشترك ليتدرّب عليه غيرك. والإدخال بالصوت يعالجه متصفحك وخدمة التعرّف على الكلام التابعة له (Google في كروم، Apple في سفاري) — لا يصلنا الصوت ولا نحفظه.</p>
            <h3>البريد والإشعارات</h3>
            <p>نرسل عبر Brevo: نتيجة اختبارك، والرسائل التذكيرية لمن وافق، ورسائل إدارة المدرسة لطلابها، ورسائل الخدمة للجميع. وإن فعّلت إشعارات الجوال نحفظ عنوان اشتراك جهازك في الإشعارات فقط.</p>
            <h3>سجلّات تقنية</h3>
            <p>نسجّل الأعطال البرمجية (نصّ الخطأ، الصفحة، نوع المتصفح) لإصلاحها، وعدد الزيارات مجمّعاً (زائر أو صاحب حساب فقط) — بلا اسم ولا عنوان IP.</p>
            <h3>مدة الحفظ والحذف</h3>
            <p>بيانات العام الدراسي في المدرسة تُحذف نهائياً بعد أسبوع من بدء العام التالي (مهلة للمدرسة لتصدير ما تحتاجه). تستطيع حذف حسابك وكل بياناته في أي وقت من ملفك الشخصي. والمشاركات المخفية بسبب البلاغات تُحذف بعد أسبوع.</p>
            <h3>خدمات نعتمد عليها</h3>
            <p>Supabase (قاعدة البيانات والحسابات والملفات)، Netlify (الاستضافة)، Google (الدخول بحساب Google، وGemini للمساعد)، Brevo (البريد).</p>
            <h3>حقوقك</h3>
            <p>الاطّلاع على بياناتك، وحذف حسابك، وإيقاف الرسائل التذكيرية ورسائل المدرسة في أي وقت. وسجلّاتك المدرسية (الدرجات، الغياب) تديرها مدرستك — اطلب تصحيحها منها.</p>
            <h3>ما لا نجمعه</h3>
            <p>لا نجمع موقعك الجغرافي ولا رقم جوالك، ولا نتتبّعك خارج خُطى.</p>
            <p class="legal-updated">آخر تحديث: ${TERMS_UPDATED.ar} · النسخة ${TERMS_VERSION}</p>`,
        bodyEn: `
            <h3>What we keep</h3>
            <p><b>As a guest:</b> your plan and progress stay in your browser; an anonymous ID (no personal data) powers the community features.</p>
            <p><b>With a Khuta account:</b> username or Google email, an encrypted password we can't see, your study progress to sync devices, and your private “My files”.</p>
            <p><b>As a school member:</b> what the school enters — full name, email, role, grade and section. National IDs used when importing students are <b>not stored</b>, only an encrypted fingerprint for matching. We keep your platform work (answers, grades, deadlines), official grades and attendance if the school uploads them, uploaded files, and a log of who in the school opened a student's file.</p>
            <h3>Who sees what</h3>
            <p>Students see their own data; teachers their classes in their subject; the admin their school; the counselor weak areas; parents only their child via a revocable read-only link from the school. We access data only to run and support the service. <b>We never sell data or show ads.</b></p>
            <h3>AI and voice</h3>
            <p>What you send the assistant goes to Google Gemini to generate a reply; we don't keep it — only a usage count for limits. Valid questions generated from a file you upload for a practice exam may be added, with nothing about you, to a shared GAT question bank. Voice input is processed by your browser's speech service (Google in Chrome, Apple in Safari); we never receive audio.</p>
            <h3>Email and notifications</h3>
            <p>Via Brevo: exam results, reminders if you consent, school messages, and service notices. Push notifications store only your device's subscription address.</p>
            <h3>Technical logs</h3>
            <p>Error reports (message, page, browser type) and aggregate visit counts — no name or IP address.</p>
            <h3>Retention</h3>
            <p>A school year's data is deleted a week after the next year starts. Delete your account anytime from your profile.</p>
            <h3>Providers</h3>
            <p>Supabase, Netlify, Google (sign-in, Gemini), Brevo.</p>
            <h3>Your rights</h3>
            <p>Access your data, delete your account, stop reminders and school messages anytime. School records are managed by your school.</p>
            <p class="legal-updated">Last updated: ${TERMS_UPDATED.en} · version ${TERMS_VERSION}</p>`,
    },
};

function openLegalModal(kind){
    const doc = LEGAL_DOCS[kind];
    if(!doc) return;
    document.getElementById("legal-modal-title").textContent = currentLang==='ar' ? doc.titleAr : doc.titleEn;
    document.getElementById("legal-modal-body").innerHTML = currentLang==='ar' ? doc.bodyAr : doc.bodyEn;
    labOverlayOpen("legal-modal");
}
function closeLegalModal(){ labOverlayClose("legal-modal"); }

async function sendExamScoreEmail(score){
    try{
        if(!sb) return;
        const { data } = await sb.auth.getSession();
        const accessToken = data && data.session && data.session.access_token;
        if(!accessToken) return; // ضيف بلا حساب فعلي
        const session = getSession();
        await fetch("/.netlify/functions/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "examScore",
                accessToken,
                username: session ? session.username : null,
                score: score.correctCount, total: score.total,
                examTypeLabel: "full",
            }),
        });
    }catch(e){
        console.error("[خُطى] تعذّر إرسال بريد النتيجة (لا يؤثر على تجربة الطالب):", e);
    }
}

// ⚠️ manualAuthInProgress نُقل تعريفه إلى js/01-core-config.js عمداً (بجوار
// مستمع onAuthStateChange الذي يقرأه). إعادة تعريفه هنا بـlet ستُسقط الملف
// كاملاً بخطأ "Identifier has already been declared" — لا تُعِده.

function setSession(s){
    localStorage.setItem("khuta_session", JSON.stringify(s));
    // شبكة أمان: تأكد أن khuta_name معبّأ دائماً أيضاً — إن اختفت الجلسة لأي
    // سبب مستقبلاً، يبقى الطالب "معروفاً" محلياً بدل أن يُعامَل كزائر جديد بالكامل
    if(!localStorage.getItem("khuta_name") && s.username) localStorage.setItem("khuta_name", s.username);
}
function clearSession(){ localStorage.removeItem("khuta_session"); }

/* ---------- القفل التصاعدي ضد محاولات التخمين ---------- */
function getLockState(username){
    try{ return JSON.parse(localStorage.getItem("khuta_lock_" + username)) || { fails:0, lockUntil:0, lastAttempt:0 }; }
    catch(e){ return { fails:0, lockUntil:0, lastAttempt:0 }; }
}
function saveLockState(username, state){ localStorage.setItem("khuta_lock_" + username, JSON.stringify(state)); }

function lockDurationMs(fails){
    // 3 محاولات فاشلة → دقيقة، ثم 5 دقائق، ثم 30 دقيقة، وتبقى 30 دقيقة كحد أقصى بعدها
    if(fails < 3) return 0;
    if(fails === 3) return 60 * 1000;
    if(fails === 4) return 5 * 60 * 1000;
    return 30 * 60 * 1000;
}

function checkLock(username){
    const state = getLockState(username);
    const now = Date.now();
    // تصفير تلقائي كامل بعد مرور 24 ساعة على آخر محاولة
    if(state.lastAttempt && (now - state.lastAttempt) > 24 * 60 * 60 * 1000){
        saveLockState(username, { fails:0, lockUntil:0, lastAttempt:0 });
        return { locked:false };
    }
    if(state.lockUntil && now < state.lockUntil){
        return { locked:true, remainingMs: state.lockUntil - now };
    }
    return { locked:false };
}

function registerFailedAttempt(username){
    const state = getLockState(username);
    state.fails = (state.fails || 0) + 1;
    state.lastAttempt = Date.now();
    const dur = lockDurationMs(state.fails);
    if(dur > 0) state.lockUntil = Date.now() + dur;
    saveLockState(username, state);
    return state;
}
function clearFailedAttempts(username){
    saveLockState(username, { fails:0, lockUntil:0, lastAttempt:0 });
}

function formatDuration(ms){
    const totalSec = Math.ceil(ms / 1000);
    if(totalSec < 60) return totalSec + (currentLang==='ar' ? " ثانية" : "s");
    const min = Math.ceil(totalSec / 60);
    return min + (currentLang==='ar' ? " دقيقة" : "m");
}

/* ---------- التسجيل ---------- */
async function signUpAccount(){ return signUpWithCreds("acc-username", "acc-password", "acc-password2", false, "acc-email"); }

async function signUpWithCreds(userId, passId, pass2Id, fromLoginScreen, emailId){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable right now"); return; }
    const username = document.getElementById(userId).value.trim();
    const pass = document.getElementById(passId).value;
    const pass2 = document.getElementById(pass2Id).value;
    const realEmailInput = emailId ? document.getElementById(emailId) : null;
    const realEmail = realEmailInput ? realEmailInput.value.trim() : "";
    if(username.length < 3){ hapticError(); showToast(currentLang==='ar' ? "اسم المستخدم يجب أن يكون 3 أحرف على الأقل" : "Username must be at least 3 characters"); return; }
    if(pass.length < 6){ hapticError(); showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(pass !== pass2){ hapticError(); showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    if(realEmail && !realEmail.includes("@")){ showToast(currentLang==='ar' ? "البريد المدخل غير صالح — اتركه فارغاً إن أردت المتابعة بدونه" : "Invalid email — leave it blank to continue without one"); return; }

    setAccountBusy(true);
    manualAuthInProgress = true;
    // إن أدخل الطالب بريداً حقيقياً، يصبح هو هوية الحساب الفعلية في Supabase
    // منذ التسجيل (فيعمل استرجاع كلمة المرور فوراً بلا خطوة إضافية لاحقاً).
    // إن تركه فارغاً، السلوك القديم تماماً بلا أي تغيير: بريد مصطنع داخلي،
    // ولا يُطلب بريد حقيقي إطلاقاً — نفس فلسفة الخصوصية الأصلية للموقع.
    const email = realEmail || usernameToEmail(username);
    const { data, error } = await sb.auth.signUp({ email, password: pass });
    if(error){
        manualAuthInProgress = false;
        setAccountBusy(false);
        console.error("[خُطى] خطأ Supabase الكامل عند التسجيل (أرسل هذا للمطوّر إن استمرت المشكلة):", error);
        const msg = /already|registered/i.test(error.message) ? (currentLang==='ar'?"اسم المستخدم مُستخدم بالفعل":"Username already taken")
            : /rate limit/i.test(error.message) ? (currentLang==='ar'?"محاولات كثيرة جداً من هذا الجهاز، حاول بعد قليل (أو تأكد أن Confirm email مُعطّل في Supabase)":"Too many attempts from this device — wait a bit (or make sure Confirm Email is disabled in Supabase)")
            : `${error.message} (كود: ${error.status || "؟"}) — افتح Console (F12) للتفاصيل الكاملة`;
        showToast((currentLang==='ar'?"تعذّر إنشاء الحساب: ":"Sign-up failed: ") + msg);
        return;
    }
    const uid = data.user && data.user.id;
    if(uid){
        // نلتقط موافقة الرسائل من نفس النموذج (غير مفعّلة افتراضياً — موافقة
        // حقيقية لا مفروضة)، ونعتبر الطالب "سُئل" فلا تظهر له نافذة السؤال لاحقاً
        const consentBox = document.getElementById(fromLoginScreen ? "login-marketing-consent" : "acc-marketing-consent");
        const consented = !!(consentBox && consentBox.checked && realEmail);
        localStorage.setItem("khuta_marketing_consent", consented ? "1" : "0");
        localStorage.setItem("khuta_consent_asked", "1");
        await sb.from("user_data").insert({ id: uid, username, data: collectLocalSnapshot(), marketing_consent: consented });
        setSession({ uid, username });
        recordPendingReferral(uid);
    }
    setAccountBusy(false);

    if(!data.session){
        // Supabase لم يُرجع جلسة فورية — يعني "Confirm email" لا يزال مفعّلاً، وهذا الحساب
        // لن يعمل لتسجيل الدخول لاحقاً لأن بريد التأكيد يذهب لعنوان وهمي لا يملكه الطالب.
        manualAuthInProgress = false;
        showToast(currentLang==='ar'
            ? "⚠️ تم إنشاء الحساب لكنه غير مفعّل — يتطلب Supabase تأكيد بريد لن يصل أبداً. اذهب لإعدادات Supabase وأطفئ 'Confirm email' ثم أعد المحاولة."
            : "⚠️ Account created but not activated — Supabase still requires email confirmation you'll never receive. Go to Supabase settings and turn off 'Confirm email', then try again.");
        return;
    }

    showToast(currentLang==='ar' ? "🎉 تم إنشاء حسابك وتسجيل دخولك" : "🎉 Account created and signed in");
    if(fromLoginScreen){ document.getElementById("login-overlay").style.display = "none"; }
    renderAccountUI();
    finishLoginBoot();
    manualAuthInProgress = false;
}

/* ---------- تسجيل الدخول ---------- */
async function signInAccount(){ return signInWithCreds("acc-username", "acc-password", false); }

async function signInWithCreds(userId, passId, fromLoginScreen){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable right now"); return; }
    const username = document.getElementById(userId).value.trim();
    const pass = document.getElementById(passId).value;
    if(!username || !pass) return;

    const lock = checkLock(username);
    if(lock.locked){
        showToast((currentLang==='ar' ? "⏳ محاولات كثيرة، حاول بعد " : "⏳ Too many attempts, try again in ") + formatDuration(lock.remainingMs));
        return;
    }

    setAccountBusy(true);
    manualAuthInProgress = true;
    // كلمة المرور تُمرَّر للتحويل نفسه: resolve_username_email لم تعد تُرجع
    // بريد أحد لمجرّد معرفة اسمه (انظر شرحها في resolveUsernameEmail)
    const email = await resolveUsernameEmail(username, pass);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setAccountBusy(false);

    if(error){
        manualAuthInProgress = false;
        console.error("[خُطى] خطأ Supabase الكامل عند تسجيل الدخول:", error);
        if(/confirm/i.test(error.message)){
            showToast(currentLang==='ar'
                ? "⚠️ هذا الحساب لم يُفعَّل بعد (يتطلب تأكيد بريد لن يصلك أبداً) — اذهب لإعدادات Supabase وأطفئ 'Confirm email'، ثم أنشئ الحساب من جديد."
                : "⚠️ This account was never confirmed (needs a confirmation email you'll never receive) — go to Supabase settings and turn off 'Confirm email', then create the account again.");
            return;
        }
        registerFailedAttempt(username);
        hapticError();
        showToast(currentLang==='ar' ? `بيانات الدخول غير صحيحة (${error.message})` : `Invalid username or password (${error.message})`);
        return;
    }
    clearFailedAttempts(username);
    const uid = data.user.id;
    setSession({ uid, username });

    const { data: row } = await sb.from("user_data").select("data, username").eq("id", uid).maybeSingle();
    if(row && row.data){
        await resolveAccountDataConflict(row.data);
    }
    // ⚠️ لم نعد نُعيد تحميل الصفحة إطلاقاً بعد الآن — كانت هذه المقامرة على
    // توقيت حفظ Supabase لجلسته الداخلية في التخزين هي السبب الجذري الحقيقي
    // لعودة الطالب لشاشة الدخول رغم دخوله الناجح. بدلاً من ذلك، نُكمل كل شيء
    // في نفس الصفحة مباشرة (بنفس أسلوب إنشاء الحساب الذي كان يعمل بثبات دائماً)
    if(fromLoginScreen){ document.getElementById("login-overlay").style.display = "none"; }
    updateWelcomeText();
    loadProfileForm();
    renderAccountUI();
    checkAdminStatus();
    renderGamification();
    checkBadges();
    finishLoginBoot();
    manualAuthInProgress = false;
    showToast(currentLang==='ar' ? "أهلاً بعودتك 👋" : "Welcome back 👋");
}

function toggleRecoveryEmailForm(){
    const box = document.getElementById("recovery-email-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function linkRecoveryEmail(){
    if(!sb) return;
    const email = document.getElementById("recovery-email-input").value.trim();
    if(!email || !email.includes("@")){
        showToast(currentLang==='ar' ? "أدخل بريداً إلكترونياً صحيحاً" : "Enter a valid email address");
        return;
    }
    const { error } = await sb.auth.updateUser({ email });
    if(error){
        console.error("[خُطى] تعذّر ربط البريد:", error);
        showToast(currentLang==='ar' ? "تعذّر إرسال رابط التأكيد" : "Couldn't send the confirmation link");
        return;
    }
    document.getElementById("recovery-email-form").style.display = "none";
    document.getElementById("recovery-email-input").value = "";
    showToast(currentLang==='ar'
        ? "📧 أرسلنا رابط تأكيد لبريدك — اضغط عليه لتفعيل استرجاع كلمة المرور"
        : "📧 Confirmation link sent to your email — click it to activate password recovery");
}

function toggleChangePasswordForm(){
    const box = document.getElementById("change-password-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
}

async function changePassword(){
    if(!sb) return;
    const p1 = document.getElementById("new-pass-1").value;
    const p2 = document.getElementById("new-pass-2").value;
    if(p1.length < 6){ showToast(currentLang==='ar' ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters"); return; }
    if(p1 !== p2){ showToast(currentLang==='ar' ? "كلمتا المرور غير متطابقتين" : "Passwords don't match"); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if(error){
        console.error("[خُطى] تعذّر تغيير كلمة المرور:", error);
        showToast(currentLang==='ar' ? "تعذّر تغيير كلمة المرور" : "Couldn't change password");
        return;
    }
    document.getElementById("new-pass-1").value = "";
    document.getElementById("new-pass-2").value = "";
    document.getElementById("change-password-form").style.display = "none";
    showToast(currentLang==='ar' ? "✅ تم تغيير كلمة المرور" : "✅ Password changed");
}

function signOutAccount(){
    if(sb) sb.auth.signOut();
    clearSession();
    // لا نكتفي بمسح الجلسة فقط — يجب مسح الاسم المحلي أيضاً، وإلا فحص "هل يوجد
    // اسم؟" عند الإقلاع التالي سيظنّ خطأً أن هناك مستخدماً "ضيفاً" شرعياً ويتخطى
    // شاشة الدخول رغم أن الشخص خرج من حسابه فعلياً للتو
    localStorage.removeItem("khuta_name");
    showToast(currentLang==='ar' ? "تم تسجيل الخروج — بياناتك المحلية باقية على هذا الجهاز" : "Signed out — your local data stays on this device");
    renderAccountUI();
    document.getElementById("login-overlay").style.display = "flex";
}

/* ---------- المزامنة ---------- */
function collectLocalSnapshot(){
    const snap = {};
    Object.keys(localStorage).filter(k => k.startsWith("khuta_") && k !== "khuta_session").forEach(k => {
        snap[k] = localStorage.getItem(k);
    });
    return snap;
}
function applyRemoteSnapshot(snap){
    Object.keys(snap).forEach(k => localStorage.setItem(k, snap[k]));
}

async function syncNow(showMsg){
    const session = getSession();
    if(!sb || !session) return;
    const { error } = await sb.from("user_data")
        .update({ data: collectLocalSnapshot(), updated_at: new Date().toISOString() })
        .eq("id", session.uid);
    if(!error){
        localStorage.setItem("khuta_last_sync", new Date().toISOString());
        if(showMsg) showToast(currentLang==='ar' ? "✅ تمت المزامنة" : "✅ Synced");
        renderAccountUI();
        if(document.getElementById("lb-share-toggle") && document.getElementById("lb-share-toggle").checked){
            upsertLeaderboardRow();
        }
    } else if(showMsg){
        showToast(currentLang==='ar' ? "تعذّرت المزامنة" : "Sync failed");
    }
}

let syncDebounceTimer = null;
function debouncedSync(){
    clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => syncNow(false), 2500);
}

function setAccountBusy(busy){
    document.querySelectorAll(".acc-btn").forEach(b => b.disabled = busy);
}

function renderAccountUI(){
    const session = getSession();
    const guestBox = document.getElementById("account-guest-box");
    const inBox = document.getElementById("account-signedin-box");
    if(!guestBox || !inBox) return;
    if(session){
        guestBox.style.display = "none";
        inBox.style.display = "block";
        document.getElementById("acc-current-username").textContent = session.username;
        const last = localStorage.getItem("khuta_last_sync");
        document.getElementById("acc-last-sync").textContent = last
            ? (currentLang==='ar' ? "آخر مزامنة: " : "Last synced: ") + new Date(last).toLocaleString(khutaLocale())
            : (currentLang==='ar' ? "لم تتم المزامنة بعد" : "Not synced yet");
        updateAccountAuthButtonsVisibility();
    } else {
        guestBox.style.display = "block";
        inBox.style.display = "none";
    }
    // بطاقة الخصوصية صارت مجاورة لبطاقة الحساب في قسم الإعدادات، وحالتها تتبع
    // وجود جلسة — نحدّثها من هنا كي تُصيب كل مسارات الدخول/الخروج دفعة واحدة
    // بدل إضافة الاستدعاء في ستة مواضع منفصلة
    renderPrivacyCard();
}

/* حسابات Google لا تملك "كلمة مرور" ندير نحن استرجاعها (Google تدير ذلك
   بالكامل بنفسها)، ولديها أصلاً بريد حقيقي مؤكَّد — فلا داعي لعرض زري
   "تغيير كلمة المرور" و"ربط بريد للاسترجاع" لهذا النوع من الحسابات. */
async function updateAccountAuthButtonsVisibility(){
    if(!sb) return;
    try{
        const { data: userData } = await sb.auth.getUser();
        const provider = userData && userData.user && userData.user.app_metadata && userData.user.app_metadata.provider;
        const isPasswordAccount = provider !== "google";
        const changePassBtn = document.querySelector('[onclick="toggleChangePasswordForm()"]');
        const linkEmailBtn = document.querySelector('[onclick="toggleRecoveryEmailForm()"]');
        if(changePassBtn) changePassBtn.style.display = isPasswordAccount ? "" : "none";
        if(linkEmailBtn) linkEmailBtn.style.display = isPasswordAccount ? "" : "none";
    }catch(e){ /* تجاهل بصمت — الأزرار تبقى بحالتها الافتراضية */ }
}

/* استرجاع الجلسة تلقائياً عند فتح التطبيق (إن كان قد سجّل دخوله سابقاً) */
async function restoreSession(){
    if(!sb) return;
    const session = getSession();

    // ⚠️ إعادة تصميم كاملة: khuta_session (تعرّفنا المحلي على الطالب) أصبح
    // الآن مصدر الحقيقة الوحيد لقرار "هل يبقى الطالب مسجَّل الدخول من منظور
    // الواجهة" — لم يعد فحص جلسة Supabase الداخلية قادراً على إجباره على
    // الخروج تلقائياً بعد الآن. كنا نعتمد على أن جلسة Supabase "تُثبت" ذاتها
    // دائماً عبر التخزين المحلي، لكن اتضح أن هذا لا يحدث بثبات لكل الحالات
    // (خصوصاً بعد إغلاق المتصفح وإعادة فتحه) — فكان الطالب يُعاد لشاشة
    // الدخول رغم بقاء تعرّفنا المحلي عليه سليماً تماماً. الآن: إن كان
    // khuta_session موجوداً، يبقى الطالب مسجَّل الدخول من منظوره هو، بغض
    // النظر عن حالة Supabase الداخلية، ونحاول فقط تجديد الجلسة بصمت في
    // الخلفية دون أي تأثير مرئي على تجربته.
    if(session){
        renderAccountUI();
        const { data } = await sb.auth.getSession();
        if(!data || !data.session){
            // نحاول تجديداً صامتاً؛ إن فشل، يبقى الطالب مسجَّلاً محلياً على أي حال،
            // وستُستأنف المزامنة تلقائياً بمجرد نجاح أي محاولة تالية
            try{ await sb.auth.refreshSession(); }catch(e){ /* فشل صامت — لا يؤثر على تجربة الطالب */ }
        }
        return;
    }

    // لا جلسة محلية إطلاقاً (ضيف حقيقي) — دخول مجهول صامت لازم لميزات المجتمع
    const { data } = await sb.auth.getSession();
    if(!data || !data.session){
        try{ await sb.auth.signInAnonymously(); }catch(e){ /* المزوّد غير مفعّل، تجاهل بصمت */ }
    }
}

