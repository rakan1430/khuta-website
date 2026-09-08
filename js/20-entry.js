/* ============================================================
   مداخل المنصة: المعلّم، والإدارة، والدخول السريع
   ------------------------------------------------------------
   الفكرة التي وضعها المالك: منصة واحدة لا اثنتان. خُطى تبقى كما هي لكل
   مستخدميها، وأقسام المدرسة لا تظهر إلا لمن أضافته الإدارة. والفرق بين
   الفئات في *المدخل* لا في الموقع:

     • الطالب  → يدخل من الموقع العادي بحساب Google، فتظهر له أقسامه بالعضوية.
     • المعلّم → رابط مختلف يقدّم منه طلبه: ‎?apply=teacher
     • الإدارة → رابط غير معلَن: ‎?panel=<الرمز>

   ⚠️ صراحة تامة عن "الرابط المشفَّر" للإدارة: الرابط غير المعلَن ليس حماية
   بحدّ ذاته — من رآه مرة حفظه، ومن ظفر به لا يزال أمامه تسجيل الدخول. قيمته
   أنه يمنع العثور عليه بالتصفّح العادي فقط. الحماية الحقيقية هي كلمة المرور
   وسياسات قاعدة البيانات، لا خفاء العنوان. فلا تعتمد عليه وحده أبداً.
   ============================================================ */

// ⚠️ ليس سرّاً تعموياً بل عنوان يصعب تخمينه. تغييره لا يتطلّب إلا تعديل هنا،
// وأنصح بتغييره لو تسرّب — ولن يُبطل ذلك أي حساب.
const ADMIN_PANEL_KEY = "molqa-2026";

function entryParam(name){
    try{ return new URLSearchParams(location.search).get(name); }
    catch(e){ return null; }
}

function isTeacherApplyEntry(){ return entryParam("apply") === "teacher"; }
function isAdminPanelEntry(){   return entryParam("panel") === ADMIN_PANEL_KEY; }

/* ---------- مدخل المعلّم ---------- */

function initTeacherApplyEntry(){
    if(!isTeacherApplyEntry()) return;
    // نفتح نموذج الطلب مباشرة على دور "معلّم" — لا نجعله يبحث عنه في قائمة
    setTimeout(() => {
        try{
            openAccountRequest();
            const roleEl = document.getElementById("areq-role");
            if(roleEl){ roleEl.value = "teacher"; onRequestRoleChange(); }
            const head = document.getElementById("areq-entry-note");
            if(head){
                head.style.display = "block";
                head.textContent = currentLang === "ar"
                    ? "طلب انضمام معلّم — تصل الإدارة إشعاراً به وتفعّله من لوحتها."
                    : "Teacher application — the school administration will review it.";
            }
        }catch(e){ console.warn("[خُطى] تعذّر فتح نموذج طلب المعلّم:", e); }
    }, 600);
}

/* ---------- مدخل الإدارة ---------- */

function initAdminPanelEntry(){
    if(!isAdminPanelEntry()) return;
    const box = document.getElementById("admin-entry-box");
    if(box) box.style.display = "block";
    // الدخول باسم مستخدم وكلمة مرور متاح أصلاً في خُطى، فنُبقيه ظاهراً هنا
    document.querySelectorAll('[data-feature="passwordAuth"]').forEach(el => {
        el.style.display = "";
    });
}

/* ============================================================
   الدخول السريع للمعلّم — وحدوده
   ------------------------------------------------------------
   المشكلة كما وصفها المالك: المعلّم على السبورة أمام صفّه لا يريد كتابة
   بيانات Google في كل حصة. فيضبط اسم مستخدم وكلمة مرور ويدخل بهما بسرعة.

   ⚠️ لكن ما يُكتب على شاشة يراها الصف كله قد يلتقطه طالب. لذلك الجلسة
   الناتجة "محدودة": تعرض الملفات والروابط والجدول، ولا تحذف ولا ترسل ولا
   تعدّل. وهذا فرضٌ في قاعدة البيانات لا في هذه الواجهة — الشريط والأزرار
   هنا للتوضيح فقط، ومن يعطّلها من أدوات المطوّر لا يكسب شيئاً.

   ⚠️ ولا نخزّن كلمة مرور في أي جدول من جداولنا: الحساب نفسه في Supabase Auth
   بهويّتين (Google وكلمة مرور)، وجدول teacher_quick_login يسجّل التفعيل فقط.
   ============================================================ */

// هل الجلسة الحالية أثبتت Google خلال النافذة المسموحة؟ نفس منطق الخادم.
const GOOGLE_STEPUP_HOURS = 12;

/** يقرأ حقل amr من الرمز نفسه — الخادم وقّعه فلا يمكن للمتصفح تزويره. */
async function currentAuthMethods(){
    if(!sb) return [];
    try{
        const { data } = await sb.auth.getSession();
        const token = data && data.session && data.session.access_token;
        if(!token) return [];
        // فكّ الجزء الأوسط من JWT — قراءة لا تحقّق. التحقق عند الخادم وحده.
        const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
        return Array.isArray(payload.amr) ? payload.amr : [];
    }catch(e){
        console.warn("[خُطى] تعذّرت قراءة طرق المصادقة:", e);
        return [];
    }
}

async function isGoogleVerifiedSession(){
    const amr = await currentAuthMethods();
    const nowSec = Math.floor(Date.now() / 1000);
    return amr.some(e => e && e.method === "oauth"
        && Number(e.timestamp) > nowSec - GOOGLE_STEPUP_HOURS * 3600);
}

/** يُظهر شريطاً يشرح للمعلّم لماذا بعض الأزرار لا تعمل، وكيف يرفع صلاحيته. */
async function applyLimitedSessionUI(){
    const bar = document.getElementById("limited-session-bar");
    if(!bar || !schoolCtx) return;
    if(schoolCtx.role === "student"){ bar.style.display = "none"; return; }

    const full = await isGoogleVerifiedSession();
    bar.style.display = full ? "none" : "flex";
    document.body.classList.toggle("is-limited-session", !full);
}

/** يرفع الصلاحية: يعيد المعلّم إلى Google دون أن يفقد ما هو فيه. */
async function confirmWithGoogle(){
    if(!sb) return;
    try{
        // ⚠️ نعود إلى نفس الصفحة بعد الإثبات — لا إلى الجذر. المعلّم كان في
        // منتصف عمل، وإعادته إلى البداية تجعله يكرّره كلّه.
        await sb.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: location.href },
        });
    }catch(e){
        console.error("[خُطى] تعذّر تأكيد الهوية:", e);
        showToast(currentLang==='ar' ? 'تعذّر فتح تأكيد Google' : 'Could not start Google confirmation');
    }
}

/* ---------- ضبط الدخول السريع ---------- */

/** يضبط كلمة مرور للمعلّم على حسابه نفسه (لا حساب ثانٍ). */
async function setupQuickLogin(){
    if(!sb || !schoolCtx) return;
    const p1 = (document.getElementById("quick-pass") || {}).value || "";
    const p2 = (document.getElementById("quick-pass2") || {}).value || "";
    const msg = document.getElementById("quick-login-msg");
    const say = (t, bad) => {
        if(!msg) return;
        msg.textContent = t;
        msg.style.color = bad ? "var(--danger, #c0392b)" : "var(--text-3)";
    };

    if(p1.length < 8){ say(currentLang==='ar' ? 'كلمة المرور ٨ محارف على الأقل' : 'At least 8 characters', true); return; }
    if(p1 !== p2){ say(currentLang==='ar' ? 'الكلمتان غير متطابقتين' : 'Passwords do not match', true); return; }

    // ⚠️ ضبط كلمة المرور نفسه فعل حسّاس: لولا هذا الشرط لأمكن لمن التقط
    // كلمة المرور القديمة من الشاشة أن يغيّرها ويستولي على الحساب.
    if(!await isGoogleVerifiedSession()){
        say(currentLang==='ar'
            ? 'لضبط كلمة المرور أكّد هويتك بحساب Google أولاً.'
            : 'Confirm with Google first to set a password.', true);
        return;
    }

    const btn = document.getElementById("quick-login-save");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.auth.updateUser({ password: p1 });
        if(error) throw error;
        try{
            // الجدول يسجّل التفعيل فقط: member_id (مفتاح أوّلي) و enabled.
            // ولا كلمة مرور فيه إطلاقاً — هي في Supabase Auth وحدها.
            await sb.from("teacher_quick_login").upsert({
                member_id: schoolCtx.memberId,
                enabled: true,
            }, { onConflict: "member_id" });
        }catch(e){ console.warn("[خُطى] تعذّر تسجيل تفعيل الدخول السريع:", e); }

        document.getElementById("quick-pass").value = "";
        document.getElementById("quick-pass2").value = "";
        say(currentLang==='ar'
            ? 'تم ✅ يمكنك الآن الدخول ببريدك وكلمة المرور — بصلاحية عرض فقط.'
            : 'Done ✅ You can now sign in with your email and password — view only.');
    }catch(e){
        console.error("[خُطى] تعذّر ضبط الدخول السريع:", e);
        say(currentLang==='ar' ? 'تعذّر الحفظ' : 'Could not save', true);
    }finally{ schoolBusy(btn, false); }
}

/* ---------- الإقلاع ---------- */

function initEntryUi(){
    initTeacherApplyEntry();
    initAdminPanelEntry();
}

if(document.readyState === "complete") initEntryUi();
else window.addEventListener("load", initEntryUi);
