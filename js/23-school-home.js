/* ============================================================
   الصفحة الرئيسية للمعلّم والإدارة
   ------------------------------------------------------------
   وصف المالك المشكلة: "إذا كان حساب المعلّم أو الإدارة لا يحتاج أن يرى
   أقساماً لا تخصّه مثل XP والأيام المتتالية، فقد حذفتَها من الشريط العلوي
   وهذا جيد، لكن في قسم الخطة والجدول لم تحذفها ولم تُضِف ما يهمّ المعلّم.
   ويمكن أن يتغيّر اسم القسم إلى الصفحة الرئيسية مثلاً".

   وهو محق: بطاقات نقاط الخبرة والأيام المتتالية ولوحة المتصدّرين والمهام
   اليومية مبنية على رحلة طالب يذاكر للقدرات. عرضُها على معلّم ليس زينةً
   زائدة فحسب، بل يجعل المنصة تبدو "ترقيعاً" لا أداةً بُنيت له.

   ⚠️ وخُطى نفسها لا تتغيّر بحرف: كل ما هنا مشروط بعضوية مدرسة بدور معلّم
   أو إدارة. الطالب — مدرسياً كان أو من طلاب خُطى العاديين — يرى لوحته كما
   هي تماماً.
   ============================================================ */

/* البطاقات التي تخصّ رحلة الطالب وحده */
const STUDENT_ONLY_CARDS = [
    "dash-card-overview-hero",        // نقاط الخبرة والمستوى
    "dash-card-overview-heatmap",     // خريطة النشاط اليومي
    "dash-card-overview-quests",      // المهام اليومية
    "dash-card-overview-leaderboard", // لوحة المتصدّرين
    "dash-card-progress",             // تقدّم خطة القدرات
    "dash-card-badges",
    "dash-card-community",
];

/* ⚠️ "جدول مهامك المخصّص" خرج من هنا بعد ملاحظة المالك:
   «لماذا يوجد بها جدول مهامك؟ ولماذا يحوي أشياء لا يحتاجها المعلّم أو المدير؟»
   وهو محق — ذلك الجدول يُولَّد من خطة الطالب لاختبار القدرات (عدد الأيام،
   الصفحات اليومية، المصادر). لا معنى له لمن لا يذاكر للقدرات أصلاً. */
const STAFF_HIDE_CARDS = ["dash-card-table"];

/* ويبقى المؤقّت وحده: المعلّم يشغّله على السبورة أمام الصف فعلاً */
const STAFF_KEEP_CARDS = ["dash-card-timer"];

/* أقسام رحلة الطالب في القدرات — لا تخصّ معلّماً ولا إدارة.
   وصفها المالك بدقة: «يجب أن يكون الموقع مخصّصاً لكل شخص ولكل فرد».
   ومنها بابان معطّلان أصلاً (التحصيلي وستيب "قريباً") — عرضُ وعدٍ لمنتج
   لن يستعمله المعلّم أبداً يجعل المنصة تبدو وكأنها لم تُبنَ له. */
const STUDENT_ONLY_TABS = ["calculator", "links", "specialties", "community", "examsim", "tutors"];

function isSchoolStaff(){
    return !!(typeof schoolCtx !== "undefined" && schoolCtx &&
              (schoolCtx.role === "teacher" || schoolCtx.role === "admin"));
}

/** يبني بطاقة مختصرة أعلى الصفحة الرئيسية: ما رفعه المعلّم وروابطه واختباراته. */
async function renderStaffHomeSummary(){
    const host = document.getElementById("dash-overview");
    if(!host || !sb || !schoolCtx) return;

    let card = document.getElementById("staff-home-card");
    if(!card){
        card = document.createElement("div");
        card.className = "card";
        card.id = "staff-home-card";
        host.prepend(card);
    }

    const roleLabel = (typeof schoolRoleLabel === "function") ? schoolRoleLabel(schoolCtx.role) : "";
    card.innerHTML = `
        <h2 style="margin-bottom:4px;">
            <i class="fa-solid fa-school" style="color:var(--gold-text);"></i>
            ${escapeHtml(schoolCtx.fullName || "")}
        </h2>
        <p class="card-sub" style="margin-bottom:14px;">
            ${escapeHtml(schoolCtx.schoolName || "")} — ${escapeHtml(roleLabel)}
        </p>
        <div id="staff-home-stats" class="staff-stats">
            <div class="staff-stat"><b>…</b><small>${currentLang==='ar'?'ملفات':'Files'}</small></div>
            <div class="staff-stat"><b>…</b><small>${currentLang==='ar'?'روابط':'Links'}</small></div>
            <div class="staff-stat"><b>…</b><small>${currentLang==='ar'?'اختبارات':'Exams'}</small></div>
            <div class="staff-stat"><b>…</b><small>${currentLang==='ar'?'فصول':'Classes'}</small></div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:14px;">
            <button type="button" class="btn btn-sm acc-btn" onclick="switchTab('schoolwork')">
                <i class="fa-solid fa-chalkboard-user"></i> ${currentLang==='ar'?'منصة المدرسة':'School platform'}</button>
            ${schoolCtx.role === "admin" ? `<button type="button" class="btn btn-outline btn-sm acc-btn" onclick="switchTab('schooladmin')">
                <i class="fa-solid fa-user-shield"></i> ${currentLang==='ar'?'إدارة المدرسة':'School admin'}</button>` : ""}
        </div>`;

    // الأرقام تأتي من قاعدة البيانات — والصلاحيات هي التي تقرّر ما يُعدّ
    const counts = await Promise.all([
        sb.from("teacher_files").select("id", { count:"exact", head:true }),
        sb.from("teacher_links").select("id", { count:"exact", head:true }),
        sb.from("teacher_exams").select("id", { count:"exact", head:true }),
        sb.from("classes").select("id", { count:"exact", head:true }),
    ].map(q => q.then(r => (r && typeof r.count === "number") ? r.count : 0).catch(() => 0)));

    const stats = document.getElementById("staff-home-stats");
    if(stats){
        const labels = currentLang==='ar'
            ? ["ملفات","روابط","اختبارات","فصول"]
            : ["Files","Links","Exams","Classes"];
        stats.innerHTML = counts.map((n, i) =>
            `<div class="staff-stat"><b>${n}</b><small>${labels[i]}</small></div>`).join("");
    }
}

/** يبدّل لوحة الطالب إلى صفحة رئيسية تخصّ المعلّم/الإدارة. */
/** يُخفي أو يُعيد عنصراً مع حفظ حالته الأصلية — كي يعود بلا أثر لو تبدّل الحساب. */
function staffToggle(el, hide){
    if(!el) return;
    if(hide){
        if(el.dataset.staffPrev === undefined) el.dataset.staffPrev = el.style.display || "";
        el.style.display = "none";
    }else if(el.dataset.staffPrev !== undefined){
        el.style.display = el.dataset.staffPrev;
        delete el.dataset.staffPrev;
    }
}

/** يُخفي أقسام رحلة الطالب من القائمتين الجانبية والسفلية. */
function applyStaffNav(staff){
    STUDENT_ONLY_TABS.forEach(tab => {
        document.querySelectorAll(`.nav-item[data-tab="${tab}"], .mobile-nav-item[data-tab="${tab}"]`)
            .forEach(el => staffToggle(el, staff));
    });

    // "التحصيلي" و"ستيب" — بابان معطّلان بشارة "قريباً"، ولا id لهما،
    // فنتعرّف عليهما بأنهما عناصر تنقّل معطّلة تحمل تلك الشارة
    document.querySelectorAll(".nav-item.disabled").forEach(el => {
        if(el.querySelector(".badge-soon")) staffToggle(el, staff);
    });

    // ⚠️ ولو كان المعلّم واقفاً على قسم أخفيناه للتوّ، لا نتركه أمام شاشة
    // فارغة — نعيده إلى صفحته الرئيسية
    if(staff){
        const active = document.querySelector(".view-section.active");
        if(active && STUDENT_ONLY_TABS.includes(active.id.replace("view-", ""))){
            if(typeof switchTab === "function") switchTab("dashboard");
        }
    }
}

/* ============================================================
   الصقل الشامل: كل ما يخصّ رحلة الطالب لا يظهر لمعلّم ولا لإدارة
   ------------------------------------------------------------
   وصف المالك: «هناك بعض النصوص التي لا لازمة لها تظهر لدى المعلّم… في
   الملف الشخصي تظهر أشياء لا علاقة لها مثل أوسمتك وإنجازاتك، فلماذا قد
   يحتاج المعلّم أوسمة؟ … وبنك الأخطاء الشخصية، وإحصائياتك، وجامعة الهدف،
   والمسار الدراسي، والنسبة المستهدفة، وتاريخ اختبارك».

   وهو محق في كل بند. وقد كشف ما هو أهم منها: أنّ الإخفاء كان يُعالَج بندًا
   بندًا حيثما ظهرت شكوى، لا كقاعدة واحدة. فصارت هنا قاعدةٌ واحدة تُطبَّق
   على كل موضع دفعةً واحدة، وتُعاد بلا أثر لو تبدّل الحساب.
   ============================================================ */

/* بطاقات الملف الشخصي التي تخصّ طالب القدرات وحده */
const STAFF_HIDE_PROFILE = [
    "prof-card-stats",     // إحصائياتك (ساعات مذاكرة، أسئلة محلولة…)
    "prof-card-badges",    // أوسمتك وإنجازاتك
    "prof-card-mistakes",  // بنك أخطائك الشخصية
    "prof-card-invite",    // ادعُ صديقاً
];

/* حقول الملف الشخصي التي لا معنى لها لمعلّم: كلها عن اختبار القدرات */
const STAFF_HIDE_PROFILE_FIELDS = ["prof-track", "prof-goal-uni", "prof-goal-score", "prof-exam-date"];

/* عناصر متفرّقة في اللوحة ووضع التركيز */
const STAFF_HIDE_MISC = [
    "btn-plans-routine",   // "خططي وروتيني" — يفتح اختيار مصادر القدرات
    "focus-task-card",     // مهام اليوم داخل وضع التركيز
    "focus-xp-value",      // نقاط XP على شاشة التركيز
];

/** يُخفي الحقل مع تسميته — أي أقرب .form-group يحويه. */
function staffToggleField(id, hide){
    const el = document.getElementById(id);
    if(!el) return;
    staffToggle(el.closest(".form-group") || el, hide);
}

function applyStaffProfileAndFocus(staff){
    STAFF_HIDE_PROFILE.forEach(id => staffToggle(document.getElementById(id), staff));
    STAFF_HIDE_PROFILE_FIELDS.forEach(id => staffToggleField(id, staff));
    STAFF_HIDE_MISC.forEach(id => staffToggle(document.getElementById(id), staff));

    // بطاقة XP كاملة لا الرقم وحده (وإلا بقي عنوانها معلّقاً بلا قيمة)
    const xp = document.getElementById("focus-xp-value");
    if(xp) staffToggle(xp.closest(".focus-mode-xp-card") || xp, staff);

    /* الاقتباس على شاشة التركيز يخاطب طالباً يذاكر ("وقت المذاكرة استثمار").
       المعلّم يشغّل المؤقّت على السبورة لحصة أو مسألة — لا لمذاكرته هو. */
    const quote = document.querySelector(".focus-mode-quote");
    if(quote) staffToggle(quote, staff);

    // سطر "لم تحدد جامعة الهدف بعد" تحت اسم المعلّم في ملفه — لا معنى له
    const goalLine = document.getElementById("profile-display-goal");
    if(goalLine) staffToggle(goalLine, staff);
}

function applyStaffHome(){
    const staff = isSchoolStaff();
    applyStaffNav(staff);
    applyStaffProfileAndFocus(staff);
    STAFF_HIDE_CARDS.forEach(id => staffToggle(document.getElementById(id), staff));

    STUDENT_ONLY_CARDS.forEach(id => {
        const el = document.getElementById(id);
        if(!el) return;
        if(staff){
            // ⚠️ نحفظ ما كان عليه كي نُرجعه بلا أثر لو تبدّل الحساب
            if(el.dataset.staffPrev === undefined) el.dataset.staffPrev = el.style.display || "";
            el.style.display = "none";
        }else if(el.dataset.staffPrev !== undefined){
            el.style.display = el.dataset.staffPrev;
            delete el.dataset.staffPrev;
        }
    });

    // اسم القسم في القائمتين: "الخطة والجدول" لا معنى له لمعلّم
    document.querySelectorAll('[data-tab="dashboard"] span').forEach(sp => {
        const key = sp.getAttribute("data-i18n");
        if(!key) return;
        if(staff){
            if(sp.dataset.staffPrevText === undefined) sp.dataset.staffPrevText = sp.textContent;
            sp.textContent = currentLang==='ar' ? "الصفحة الرئيسية" : "Home";
        }else if(sp.dataset.staffPrevText !== undefined){
            sp.textContent = sp.dataset.staffPrevText;
            delete sp.dataset.staffPrevText;
        }
    });

    // زرّ "تخصيص لوحتك" يخصّ بطاقات الطالب — لا معنى له بعد إخفائها
    const custom = document.getElementById("btn-customize-dashboard");
    if(custom) custom.style.display = staff ? "none" : "";

    const card = document.getElementById("staff-home-card");
    if(staff){
        renderStaffHomeSummary().catch(e => console.warn("[خُطى] تعذّر بناء الصفحة الرئيسية:", e));
    }else if(card){
        card.remove();
    }

    // ⚠️ مؤقّت الجلسة والجدول يبقيان: المعلّم يشغّل المؤقّت على السبورة فعلاً
    STAFF_KEEP_CARDS.forEach(id => {
        const el = document.getElementById(id);
        if(el && staff && el.style.display === "none") el.style.display = "";
    });
}
