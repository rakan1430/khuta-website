/* ============================================================
   30) روابط أولياء الأمور — إصدارٌ وتصديرٌ وإلغاء
   ------------------------------------------------------------
   وافق المالك على الفكرة: «بخصوص الروابط التي تُنشأ لولي الأمر فأنت محق
   تماماً». والمدير يفتح فصلاً فيحصل على رابطٍ لكل طالب، ويصدّرها ملفاً
   يوزّعه مرّة واحدة.

   ⚠️ ولا يُحسب شيء هنا: التوقيع يحتاج سرّاً، وأي سرّ في المتصفّح ليس
   سرّاً. هذا الملف يطلب من الخادم ويعرض ما يعود.

   ⚠️ والتصدير CSV بترميز UTF-8 مع BOM. والسبب عمليّ بحت: Excel العربي
   على ويندوز يقرأ CSV بترميز النظام لا UTF-8، فبلا BOM تُفتح أسماء
   الطلاب حروفاً مشوّهة تماماً — والمدير سيظنّ الملف تالفاً لا الترميز.
   ============================================================ */

let parentLinks = [];
let parentLinksClass = null;

function plLabel(ar, en){ return currentLang === "ar" ? ar : en; }

function ensureParentLinksModal(){
    let m = document.getElementById("parent-links-modal");
    if(m) return m;
    m = document.createElement("div");
    m.id = "parent-links-modal";
    m.className = "overlay-screen";
    m.style.display = "none";
    document.body.appendChild(m);
    return m;
}

/* ⚠️ الاسم يُقرأ هنا من الذاكرة لا يُمرَّر في onclick: اسم الفصل يكتبه
   المدير، والمتصفّح يفكّ ترميز السمة قبل أن يقرأها محرّك جافاسكربت —
   فعلامةُ اقتباس واحدة في الاسم تكسر النصّ وتُنفّذ ما بعدها. (نفس العلّة
   الموثّقة في عناوين الاختبارات، ولها هناك teacherExamTitles.) */
function classNameById(id){
    const list = (typeof adminClasses !== "undefined" && Array.isArray(adminClasses)) ? adminClasses : [];
    const c = list.find(x => x && x.id === id);
    return (c && c.name) || "";
}

async function openParentLinks(classId){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    parentLinksClass = { id: classId, name: classNameById(classId) };
    parentLinks = [];

    const m = ensureParentLinksModal();
    m.style.display = "flex";
    m.innerHTML = `<div class="wizard-card" style="max-width:640px;">
        <p class="card-sub">${plLabel("جارٍ إصدار الروابط…","Issuing links…")}</p></div>`;

    try{
        const { data: sess } = await sb.auth.getSession();
        const token = sess && sess.session && sess.session.access_token;
        if(!token) throw new Error("NO_SESSION");

        const res = await fetch("/.netlify/functions/parent-links", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accessToken: token, classId }),
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw Object.assign(new Error(data.error || "FAILED"), { code: data.error });

        parentLinks = Array.isArray(data.links) ? data.links : [];
        renderParentLinks();
    }catch(e){
        console.error("[خُطى] تعذّر إصدار الروابط:", e);
        renderParentLinksError(e);
    }
}

function parentLinksErrorText(e){
    const code = (e && e.code) || (e && e.message) || "";
    if(/NEEDS_GOOGLE/.test(code))
        return plLabel("إصدار الروابط يتطلّب تأكيد هويتك بحساب Google — الدخول السريع لا يكفي.",
                       "Issuing links requires Google sign-in.");
    if(/NOT_ADMIN/.test(code))    return plLabel("هذه الصفحة لإدارة المدرسة.", "Admins only.");
    if(/OTHER_SCHOOL/.test(code)) return plLabel("هذا الفصل ليس في مدرستك.", "That class isn't in your school.");
    if(/CLASS_NOT_FOUND/.test(code)) return plLabel("لم نجد هذا الفصل.", "Class not found.");
    if(/NO_SESSION/.test(code))   return plLabel("سجّل الدخول أولاً.", "Sign in first.");
    return plLabel("تعذّر إصدار الروابط.", "Could not issue the links.");
}

function renderParentLinksError(e){
    const m = ensureParentLinksModal();
    m.innerHTML = `<div class="wizard-card" style="max-width:520px;">
        <h3 style="margin-bottom:8px;">${plLabel("روابط أولياء الأمور","Parent links")}</h3>
        <p class="card-sub">${escapeHtml(parentLinksErrorText(e))}</p>
        <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:16px;"
                onclick="closeParentLinks()">${plLabel("إغلاق","Close")}</button>
    </div>`;
}

function renderParentLinks(){
    const m = ensureParentLinksModal();
    const cls = parentLinksClass || {};

    m.innerHTML = `<div class="wizard-card" style="max-width:640px;">
        <h3 style="margin-bottom:4px;"><i class="fa-solid fa-link"></i>
            ${plLabel("روابط أولياء الأمور","Parent links")} — ${escapeHtml(cls.name || "")}</h3>
        <p class="card-sub" style="margin-bottom:14px;">${plLabel(
            "رابط لكل طالب يفتحه وليّ أمره بلا حساب ولا كلمة سرّ. يعرض واجبات ابنه ودرجاته فقط.",
            "One link per student — no account needed. Shows only that child's work.")}</p>

        ${parentLinks.length ? `
        <div class="pick-list" id="parent-links-list">
            ${parentLinks.map((l, i) => `
            <div class="pl-row">
                <div class="pl-main">
                    <b>${escapeHtml(l.name || "")}</b>
                    <small class="pl-url">${escapeHtml(l.url)}</small>
                </div>
                <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="copyParentLink(${i})">
                    <i class="fa-regular fa-copy"></i> ${plLabel("نسخ","Copy")}</button>
            </div>`).join("")}
        </div>

        <div style="display:flex; gap:10px; margin-top:14px; flex-wrap:wrap;">
            <button type="button" class="btn acc-btn" style="flex:1; min-width:150px;" onclick="downloadParentLinks()">
                <i class="fa-solid fa-file-arrow-down"></i> ${plLabel("تنزيل ملف Excel","Download Excel")}</button>
            <button type="button" class="btn btn-outline acc-btn" style="flex:1; min-width:150px;" onclick="revokeClassParentLinks()">
                <i class="fa-solid fa-ban"></i> ${plLabel("إلغاء روابط الفصل","Revoke class links")}</button>
        </div>
        <p class="hint" style="margin-top:10px;">${plLabel(
            "الإلغاء يُبطل كل رابط وُزّع لهذا الفصل فوراً، ويُصدر غيره. استعمله إن تسرّبت الروابط أو انتهت السنة.",
            "Revoking kills every link already handed out for this class and issues new ones.")}</p>
        ` : `<p class="card-sub">${plLabel(
            "لا طلاب في هذا الفصل بعد.","No students in this class yet.")}</p>`}

        <button type="button" class="btn btn-outline btn-block acc-btn" style="margin-top:12px;"
                onclick="closeParentLinks()">${plLabel("إغلاق","Close")}</button>
    </div>`;
}

function closeParentLinks(){
    const m = document.getElementById("parent-links-modal");
    if(m){ m.style.display = "none"; m.innerHTML = ""; }
    /* ⚠️ تُمحى من الذاكرة عند الإغلاق: هذه روابط دخول دائمة، ولا داعي
       لبقائها في متغيّر عامّ تقرؤه أي شفرة تعمل في الصفحة بعدها. */
    parentLinks = [];
    parentLinksClass = null;
}

async function copyParentLink(i){
    const l = parentLinks[i];
    if(!l) return;
    try{
        await navigator.clipboard.writeText(l.url);
        showToast(plLabel(`نُسخ رابط ${l.name}`, `Copied ${l.name}'s link`));
    }catch(e){
        /* الحافظة تُرفض خارج HTTPS أو بلا تفاعل — نُظهره ليُنسخ يدوياً */
        prompt(plLabel("انسخ الرابط:", "Copy the link:"), l.url);
    }
}

/** CSV يفتحه Excel مباشرةً — بلا مكتبة ولا تحميل خارجي. */
function parentLinksCsv(){
    const head = currentLang === "ar" ? ["الطالب", "الرابط"] : ["Student", "Link"];
    const esc = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
    const rows = parentLinks.map(l => [esc(l.name), esc(l.url)].join(","));
    /* ⚠️ BOM أولاً — بدونه يقرأ Excel العربي الأسماء حروفاً مشوّهة */
    return "﻿" + [head.map(esc).join(","), ...rows].join("\r\n");
}

function downloadParentLinks(){
    const cls = (parentLinksClass && parentLinksClass.name) || "class";
    const blob = new Blob([parentLinksCsv()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `روابط-أولياء-الأمور-${cls}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function revokeClassParentLinks(){
    if(!sb || !parentLinksClass) return;
    if(!confirm(plLabel(
        "سيتوقّف كل رابط وُزّع لأولياء أمور هذا الفصل، وتُصدر روابط جديدة يجب توزيعها من جديد. أتأكّد؟",
        "Every link already handed out for this class will stop working. Continue?"))) return;
    try{
        const { data, error } = await sb.rpc("revoke_parent_links", {
            p_member: null, p_class: parentLinksClass.id,
        });
        if(error) throw error;
        showToast(plLabel(`أُلغيت روابط ${data || 0} طالباً — وزّع الجديدة.`,
                          `Revoked ${data || 0} links — hand out the new ones.`));
        openParentLinks(parentLinksClass.id);
    }catch(e){
        console.error("[خُطى] تعذّر الإلغاء:", e);
        showToast(/NOT_ALLOWED/.test((e && e.message) || "")
            ? plLabel("هذا الإجراء لإدارة المدرسة.", "Admins only.")
            : plLabel("تعذّر الإلغاء.", "Could not revoke."));
    }
}
