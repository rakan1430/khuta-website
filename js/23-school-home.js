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

function applyStaffHome(){
    const staff = isSchoolStaff();
    applyStaffNav(staff);
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
