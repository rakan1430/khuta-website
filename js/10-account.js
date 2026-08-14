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
async function sendFeedback(){
    const textEl = document.getElementById("feedback-text");
    const text = textEl.value.trim();
    if(!text){ showToast(t("feedback.empty")); return; }

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

    const payload = { name, message: text, app: "خُطى — ملاحظة طالب", _subject: "ملاحظة جديدة من تطبيق خُطى" };
    let success = false;

    try{
        const formData = new FormData();
        Object.keys(payload).forEach(k => formData.append(k, payload[k]));
        const res = await fetch(FEEDBACK_ENDPOINT, { method:"POST", headers:{ "Accept":"application/json" }, body: formData });
        if(res.ok){
            success = true;
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

async function sendPasswordReset(){
    if(!sb){ showToast(currentLang==='ar' ? "خدمة الحساب غير متاحة حالياً" : "Account service unavailable"); return; }
    const username = document.getElementById("forgot-username-input").value.trim();
    if(!username){
        showToast(currentLang==='ar' ? "أدخل اسم المستخدم" : "Enter your username");
        return;
    }
    const resolvedEmail = await resolveUsernameEmail(username);
    // إن كان البريد المُحلَّل مطابقاً تماماً للبريد المصطنع، فهذا يعني أن
    // هذا الحساب لم يربط بريداً حقيقياً بعد (لا فرق هنا بين "حساب غير
    // موجود" و"حساب موجود بلا بريد مرتبط" — عمداً، لعدم كشف أي حساب فعلي)
    if(resolvedEmail === usernameToEmail(username)){
        document.getElementById("forgot-username-input").value = "";
        document.getElementById("forgot-password-form").style.display = "none";
        showToast(currentLang==='ar'
            ? "📧 إن وُجد هذا الحساب وربط بريداً حقيقياً من قبل، وصلته رسالة إعادة التعيين. إن لم يصلك شيء، سجّل الدخول واربط بريداً من ملفك الشخصي أولاً."
            : "📧 If this account exists and previously linked a real email, a reset message was sent. If nothing arrives, sign in and link an email from your profile first.");
        return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(resolvedEmail, { redirectTo: window.location.href.split("#")[0] });
    document.getElementById("forgot-username-input").value = "";
    document.getElementById("forgot-password-form").style.display = "none";
    showToast(currentLang==='ar'
        ? "📧 وصلتك رسالة إعادة تعيين كلمة المرور على بريدك المرتبط."
        : "📧 A password reset message was sent to your linked email.");
    if(error) console.error("[خُطى] استجابة resetPasswordForEmail:", error);
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
function finishLoginBoot(){
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
async function resolveUsernameEmail(username){
    if(!sb) return usernameToEmail(username);
    try{
        // مطابقة غير حساسة لحالة الأحرف عمداً: user_data.username يُخزَّن
        // بحالة الأحرف الأصلية كما كتبها الطالب، لكن تسجيل الدخول كان دائماً
        // غير حساس لحالة الأحرف ضمنياً (usernameToEmail تصغّر الأحرف قبل بناء
        // البريد المصطنع) — .ilike تحافظ على هذا السلوك بالضبط فلا ينكسر
        // الدخول لأي حساب قائم بسبب اختلاف طفيف في حالة الأحرف
        const { data } = await sb.from("username_lookup").select("email").ilike("username", username.trim()).maybeSingle();
        if(data && data.email) return data.email;
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

const LEGAL_DOCS = {
    terms: {
        titleAr: "شروط الاستخدام", titleEn: "Terms of Use",
        bodyAr: `
            <h3>١. طبيعة الخدمة</h3>
            <p>خُطى أداة مساعدة لتنظيم مذاكرة اختبار القدرات العامة (GAT). التطبيق <b>غير تابع لهيئة تقويم التعليم والتدريب (قياس)</b> ولا لأي جهة رسمية، ولا يمثّلها بأي شكل.</p>
            <h3>٢. دقة المحتوى</h3>
            <p>بيانات الجامعات وأوزان النسب الموزونة ومتطلبات القبول تقريبية وقد تتغيّر. <b>تحقّق دائماً من الموقع الرسمي للجامعة</b> قبل اتخاذ أي قرار فعلي. الاختبارات المحاكية والأسئلة هي للتدريب فقط ولا تعكس الاختبار الحقيقي حرفياً.</p>
            <h3>٣. الذكاء الاصطناعي</h3>
            <p>المساعد الذكي أداة مساعدة قد تُخطئ. لا تعتمد على إجاباته وحدها في قرار مصيري، وراجع دائماً مصادرك الدراسية الأساسية.</p>
            <h3>٤. حسابك</h3>
            <p>أنت مسؤول عن الحفاظ على كلمة مرورك. التطبيق يعمل كاملاً بدون حساب (كضيف)، والحساب اختياري لمزامنة تقدّمك بين أجهزتك فقط.</p>
            <h3>٥. الاستخدام المقبول</h3>
            <p>يُمنع استخدام التطبيق لأي غرض غير قانوني، أو محاولة تعطيله، أو إساءة استخدام مواردة (مثل الإكثار المتعمّد من طلبات الذكاء الاصطناعي).</p>
            <h3>٦. التغييرات</h3>
            <p>قد تُحدَّث هذه الشروط مع تطوّر التطبيق. استمرارك في الاستخدام يعني موافقتك على النسخة المحدّثة.</p>`,
        bodyEn: `
            <h3>1. Nature of the service</h3>
            <p>Khuta is a study-organization tool for the Saudi GAT exam. It is <b>not affiliated with Qiyas (ETEC)</b> or any official body.</p>
            <h3>2. Content accuracy</h3>
            <p>University data, weighted-score formulas, and admission requirements are approximate and subject to change. <b>Always verify with the university's official website.</b> Practice exams are for training only.</p>
            <h3>3. AI assistant</h3>
            <p>The AI assistant may make mistakes. Don't rely on it alone for important decisions.</p>
            <h3>4. Your account</h3>
            <p>You are responsible for your password. The app works fully without an account; accounts are optional and only sync progress across devices.</p>
            <h3>5. Acceptable use</h3>
            <p>Don't use the app for unlawful purposes, attempt to disrupt it, or abuse its resources.</p>
            <h3>6. Changes</h3>
            <p>These terms may be updated as the app evolves.</p>`,
    },
    privacy: {
        titleAr: "سياسة الخصوصية", titleEn: "Privacy Policy",
        bodyAr: `
            <h3>ما الذي نجمعه فعلاً؟</h3>
            <p><b>إن استخدمت التطبيق كضيف (بدون حساب):</b> لا نجمع عنك شيئاً إطلاقاً على خوادمنا. كل بياناتك (خطتك، تقدّمك، ملاحظاتك) محفوظة <b>داخل متصفحك أنت فقط</b> ولا تغادر جهازك.</p>
            <p><b>إن أنشأت حساباً:</b> نحفظ اسم المستخدم، وكلمة مرور مشفّرة (لا نراها إطلاقاً)، وبيانات تقدّمك الدراسي (خطتك، ساعات مذاكرتك، نقاط الخبرة، نتائج اختباراتك) لمزامنتها بين أجهزتك.</p>
            <p><b>البريد الإلكتروني اختياري بالكامل.</b> نستخدمه فقط لاسترجاع كلمة المرور، ولإرسال نتيجة اختبارك المحاكي، وللرسائل التذكيرية <b>إن وافقت عليها صراحةً فقط</b>.</p>
            <h3>ما الذي لا نجمعه أبداً</h3>
            <p>لا نجمع اسمك الحقيقي، ولا رقم هويتك، ولا رقم جوالك، ولا موقعك الجغرافي، ولا نبيع بياناتك لأي جهة إطلاقاً.</p>
            <h3>خدمات خارجية نستخدمها</h3>
            <p>Supabase (تخزين الحسابات والبيانات)، Netlify (استضافة الموقع)، Google Gemini (المساعد الذكي — تُرسَل أسئلتك له لتوليد الإجابة)، Brevo (إرسال البريد فقط لمن ربط بريده).</p>
            <h3>حقوقك</h3>
            <p>تقدر تحذف حسابك وكل بياناته في أي وقت من ملفك الشخصي. تقدر توقف الرسائل التذكيرية في أي لحظة. تقدر تستخدم التطبيق كاملاً بدون أي حساب من الأساس.</p>`,
        bodyEn: `
            <h3>What we actually collect</h3>
            <p><b>As a guest (no account):</b> nothing at all reaches our servers. All your data stays in your own browser.</p>
            <p><b>With an account:</b> username, an encrypted password (never visible to us), and your study progress, to sync across your devices.</p>
            <p><b>Email is fully optional</b> — used only for password recovery, exam results, and reminders <b>only if you explicitly consent</b>.</p>
            <h3>What we never collect</h3>
            <p>No real name, national ID, phone number, or location. We never sell your data.</p>
            <h3>Third-party services</h3>
            <p>Supabase (accounts/data), Netlify (hosting), Google Gemini (AI assistant), Brevo (email delivery only).</p>
            <h3>Your rights</h3>
            <p>Delete your account and all data anytime from your profile. Stop reminder emails anytime. Use the app fully without an account.</p>`,
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
    const email = await resolveUsernameEmail(username);
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
            ? (currentLang==='ar' ? "آخر مزامنة: " : "Last synced: ") + new Date(last).toLocaleString(currentLang==='ar'?"ar-SA":"en-US")
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

