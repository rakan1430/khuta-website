/* ============================================================
   26) الوضع: قلب قاعدة الإظهار من الإخفاء إلى التصريح
   ------------------------------------------------------------
   هذا الملف يعالج أعمق مشكلة في الموقع، وقد شخّصها المالك بنفسه:
   «ومنها اكتشفت أن بنيتك سيئة».

   وكان محقاً. انظر أعطالنا كلها: المعلّم يرى XP وأوسمة وبنك أخطاء وجامعة
   هدف، وزرّ "خططي وروتيني" يفتح مصادر القدرات للمدير، ونصوص القدرات في
   السبورة والمساعد. **كلها عطلٌ واحد بأوجه مختلفة**: منتجان يتقاسمان
   صفحةً واحدة و٥٥٢ دالة عامة، فيتسرّب كلٌّ في الآخر.

   وطريقة علاجنا كانت **قائمة إخفاء** تطول بلا نهاية: STUDENT_ONLY_CARDS
   و STAFF_HIDE_PROFILE و STAFF_HIDE_MISC… وكل ميزة جديدة تُضاف لخُطى
   تتسرّب للمعلّم صامتةً حتى يكتشفها المالك بنفسه بعد أسبوع.

   ⚠️ والحل صاغه المالك، وهو أفضل مما اقترحتُه أنا:
   اقترحتُ الإخفاء حسب **الدور**، فاقترح هو حسب **الوضع**:
   «عند اختيار قائمة المنصة يكون كل شيء على الشاشة ما يخص المنصة فقط،
    يختفي الـXP والأيام المتتالية حتى لا يتشتت الطالب بين منصة مدرسته
    وبين القدرات».

   والفرق جوهري: اقتراحي يحلّ مشكلة المعلّم وحده ويترك الطالب المدرسي
   يرى كل شيء مختلطاً. واقتراحه يحلّها للجميع بقاعدة واحدة، **وهو أقرب
   لكيفية تفكير الإنسان**: الطالب شخصٌ واحد له وضعان، لا شخصان.

   القاعدة إذاً:
     • الدور يقرّر أي الأوضاع متاحة لك.
     • الوضع يقرّر ما على الشاشة.
     • وكل عنصر **يصرّح** بوضعه في data-modes — ومن ينسى التصريح تسقطه
       أداة التدقيق فوراً، لا بعد أسبوع في يد المالك.
   ============================================================ */

const MODE_KEY = "khuta_mode";
let khutaMode = null;          // "khuta" أو "school"

/** الأوضاع المتاحة لصاحب الجلسة — الدور هو الذي يقرّرها. */
function availableModes(){
    const ctx = (typeof schoolCtx !== "undefined") ? schoolCtx : null;
    if(!ctx) return ["khuta"];                       // طالب خُطى العادي أو ضيف
    if(ctx.role === "teacher" || ctx.role === "admin") return ["school"];
    return ["school", "khuta"];                      // طالب المدرسة: الوضعان
}

/** الوضع الافتراضي: طالب المدرسة يبدأ في منصّته — هي سبب دخوله. */
function defaultMode(){
    const modes = availableModes();
    let saved = null;
    try{ saved = localStorage.getItem(MODE_KEY); }catch(e){}
    return (saved && modes.includes(saved)) ? saved : modes[0];
}

function setKhutaMode(mode, opts){
    const modes = availableModes();
    if(!modes.includes(mode)) mode = modes[0];
    khutaMode = mode;
    try{ localStorage.setItem(MODE_KEY, mode); }catch(e){}
    document.body.dataset.mode = mode;
    applyMode();
    if(!(opts && opts.silent)) renderModeSwitcher();

    renameHomeForMode(mode);

    /* ⚠️ الوجهة عند تبديل الوضع.
       جرّبتُه فوجدتُ الطالب يهبط في وضع "مدرستي" على لوحةٍ شبه فارغة —
       فيها المؤقّت وحده، لأن كل ما عداها يخصّ القدرات. ومن ضغط "مدرستي"
       يريد منصّة مدرسته لا شاشةً خاوية. فالوجهة هي بيت الوضع نفسه. */
    const home = (mode === "school") ? "schoolwork" : "dashboard";
    const active = document.querySelector(".view-section.active");
    const stranded = active && !elementInMode(active, mode);
    const wantsHome = !(opts && opts.silent) && mode === "school";
    if((stranded || wantsHome) && typeof switchTab === "function"){
        const target = document.getElementById("view-" + home);
        switchTab(target ? home : "dashboard");
    }
}

/* اسم القسم الأول يتبع الوضع لا الدور: "الخطة والجدول" اسمٌ يخصّ خطة
   القدرات، ولا معنى له لمن هو الآن في منصّة مدرسته — طالباً كان أو معلّماً. */
function renameHomeForMode(mode){
    document.querySelectorAll('[data-tab="dashboard"] span').forEach(sp => {
        if(!sp.getAttribute("data-i18n")) return;
        if(sp.dataset.modePrevText === undefined) sp.dataset.modePrevText = sp.textContent;
        sp.textContent = (mode === "school")
            ? (currentLang === "ar" ? "الصفحة الرئيسية" : "Home")
            : sp.dataset.modePrevText;
    });
}

function elementInMode(el, mode){
    const decl = el.getAttribute("data-modes");
    if(!decl) return true;                            // بلا تصريح = ثابت لا يخصّ وضعاً
    return decl.split(/\s+/).includes(mode);
}

/** يُظهر ما يخصّ الوضع الحالي ويُخفي ما سواه — بلا قوائم إخفاء إطلاقاً.
 *
 * ⚠️ الإخفاء بصنف لا بـstyle.display، وهذا ليس تفصيلاً شكلياً:
 * عناصر أقسام المدرسة يتحكّم في ظهورها أيضاً applySchoolRoleUI بالعضوية
 * والدور (data-school-member و data-school-role). فلو كتب النظامان في
 * نفس الخانة (style.display) لتنازعا: يُظهر أحدهما ما أخفاه الآخر حسب
 * أيّهما جرى أخيراً — وهو بالضبط صنف الأعطال الذي جئنا نقتله.
 *
 * وبالصنف يصير لكل سبب إخفاءٍ خانتُه: العنصر يظهر إن لم يُخفِه أيٌّ منهما،
 * ولا يهمّ ترتيب التنفيذ إطلاقاً.
 */
function applyMode(){
    const mode = khutaMode || defaultMode();
    document.querySelectorAll("[data-modes]").forEach(el => {
        el.classList.toggle("mode-hidden", !elementInMode(el, mode));
    });
}

/* ---------- مبدّل الوضع ---------- */

/** لا يظهر إلا لمن له وضعان فعلاً — أي طالب المدرسة وحده. */
function renderModeSwitcher(){
    const modes = availableModes();
    const host = document.querySelector(".sidebar nav");
    let box = document.getElementById("mode-switcher");

    if(modes.length < 2){
        if(box) box.remove();
        return;
    }
    if(!box){
        box = document.createElement("div");
        box.id = "mode-switcher";
        box.className = "mode-switcher";
        if(host) host.prepend(box);
    }
    const label = (m) => m === "school"
        ? (currentLang === "ar" ? "مدرستي" : "My school")
        : (currentLang === "ar" ? "القدرات" : "Qudrat");
    const icon = (m) => m === "school" ? "fa-school" : "fa-graduation-cap";

    box.innerHTML = modes.map(m => `
        <button type="button" class="mode-btn${m === khutaMode ? " is-on" : ""}"
                onclick="setKhutaMode('${m}')">
            <i class="fa-solid ${icon(m)}"></i> ${label(m)}
        </button>`).join("");
}

/** يُستدعى بعد أن تُعرف عضوية المدرسة (أو يُعرف أنها غير موجودة). */
function initKhutaMode(){
    setKhutaMode(defaultMode(), { silent: true });
    renderModeSwitcher();
}
