/* ============================================================
   24) الطالب يفتح اختباره ويحلّه — بواجهة المحاكي نفسها
   ------------------------------------------------------------
   وصف المالك المشكلة أول مرة: "هناك اختبار رفعته من جهة المعلّم، ومن
   جهة الطالب يظهر لكن لا يمكن فتحه". ولم يكن عطلاً بل نقصاً: الميزة لم
   تُكتب أصلاً.

   ثم لاحظتُ في نظرة أوسع ما هو أهمّ: بنينا **محرّك اختبار ثانياً أضعف من
   الموجود**. اختبار المحاكي في خُطى فيه لوحة أرقام وتمييز سؤال للمراجعة
   وتكبير خط ومراجعة إجابات — واختبار المعلّم كان قائمة أزرار وحدها.
   فالطالب الذي جرّب المحاكي يجد اختبار معلّمه بدائياً.

   ⚠️ فهذه الواجهة تستعمل **تنسيقات المحاكي نفسها حرفياً** (exam-layout و
   exam-palette-grid و exam-choice…) لا نسخةً منها. أي أن الاختبارين
   يبدوان واحداً، وأي تحسين في التنسيق يصيبهما معاً، ولا يوجد تنسيق
   مكرَّر يتباعد مع الوقت.

   ⚠️ وما لم يُوحَّد بعد — بصراحة: منطق المحاكي نفسه (الأقسام، بنوك
   الأسئلة، التصحيح في المتصفّح) ما زال منفصلاً في js/08-calc-profile.js.
   دمجه يعني إعادة بناء محرّك يعمل منذ زمن، وخطره أكبر من نفعه اليوم.
   الطبقة المشتركة الآن هي العرض، وهي التي كان المالك يراها.

   ⚠️ والأمان لا يُمسّ: الأسئلة تصل بلا إجاباتها الصحيحة إطلاقاً
   (get_exam_for_student تحذف correct)، والتصحيح في قاعدة البيانات،
   والإجابات لا تُكشف إلا حين يسمح المعلّم — وبعد موعد التسليم افتراضياً،
   وإلا سرّبها أول مسلِّم لبقية الصف.
   ============================================================ */

let seExam = null;          // الاختبار المفتوح
let seAnswers = {};         // { "0": 2 }
let seMarked = new Set();   // أسئلة مُمَيَّزة للمراجعة
let seIndex = 0;
let seFontStep = 0;         // -1 / 0 / +1
let seTimer = null;
let seLeft = 0;
let seReview = null;        // بيانات المراجعة بعد التسليم
const seImgCache = new Map();

function seLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/* ---------- الغلاف ---------- */

function ensureStudentExamOverlay(){
    let ov = document.getElementById("student-exam-overlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.id = "student-exam-overlay";
    /* نفس صنف غلاف المحاكي: يرث موضعه وطبقته وخلفيته كاملةً */
    ov.className = "exam-mode-overlay";
    ov.style.display = "none";
    document.body.appendChild(ov);
    return ov;
}

/** يفتح الاختبار للطالب. */
async function openStudentExam(examId){
    if(!sb){ showToast(seLabel("الخدمة غير متاحة حالياً","Service unavailable")); return; }
    const ov = ensureStudentExamOverlay();
    ov.innerHTML = `<div class="se-loading">${seLabel("جارٍ فتح الاختبار…","Opening…")}</div>`;
    ov.style.display = "flex";
    document.body.style.overflow = "hidden";

    try{
        const { data, error } = await sb.rpc("get_exam_for_student", { p_exam: examId });
        if(error) throw error;
        seExam = data;
        seAnswers = {}; seMarked = new Set(); seIndex = 0; seReview = null;
        seImgCache.clear();

        if(data.attempt){
            // سلّمه من قبل — نعرض نتيجته، ومراجعته إن سمح معلّمه
            await showStudentExamResult({ score: data.attempt.score, total: data.attempt.total }, true);
            return;
        }
        renderExamShell();
    }catch(e){
        console.error("[خُطى] تعذّر فتح الاختبار:", e);
        ov.innerHTML = `<div class="se-loading">${escapeHtml(studentExamError(e))}
            <button type="button" class="btn btn-outline btn-sm acc-btn" style="margin-top:16px;"
                    onclick="closeStudentExam()">${seLabel("إغلاق","Close")}</button></div>`;
    }
}

/* رسائل مفهومة لكل سبب رفض — لا "تعذّر" وحدها (نفس مبدأ js/22-errors.js) */
function studentExamError(e){
    const raw = [e && e.message, e && e.hint, e && e.details].filter(Boolean).join(" | ");
    if(/NOT_ASSIGNED/i.test(raw))      return seLabel("هذا الاختبار ليس مُرسَلاً إليك.","This exam wasn't sent to you.");
    if(/NOT_PUBLISHED/i.test(raw))     return seLabel("لم ينشره معلّمك بعد — سيظهر لك حين يرسله.","Your teacher hasn't published it yet.");
    if(/ALREADY_SUBMITTED/i.test(raw)) return seLabel("سلّمتَ هذا الاختبار من قبل.","You already submitted this exam.");
    if(/NOT_IN_SCHOOL/i.test(raw))     return seLabel("حسابك غير مرتبط بمدرسة.","Your account isn't linked to a school.");
    if(/EXAM_NOT_FOUND/i.test(raw))    return seLabel("لم نجد هذا الاختبار — ربما حذفه معلّمك.","Exam not found — your teacher may have deleted it.");
    if(/REVIEW_NOT_ALLOWED/i.test(raw))return seLabel("المراجعة غير متاحة الآن.","Review isn't available yet.");
    return (typeof schoolError === "function")
        ? schoolError(e, seLabel("فتح الاختبار","opening the exam"))
        : seLabel("تعذّر فتح الاختبار.","Could not open the exam.");
}

/* ---------- بناء الواجهة ---------- */

function seQuestions(){
    const src = seReview ? seReview.questions : (seExam && seExam.questions);
    return Array.isArray(src) ? src : [];
}

function renderExamShell(){
    const ov = ensureStudentExamOverlay();
    const x = seExam || {};
    const qs = seQuestions();
    const teacher = (typeof schoolStaffName === "function") ? schoolStaffName(x.owner_id) : "";

    ov.innerHTML = `
    <div class="exam-layout">
        <aside class="exam-sidebar">
            ${x.timed && x.duration_min ? `
            <div class="exam-timer-block" id="se-timer-block">
                <div class="exam-timer-label">${seLabel("الوقت المتبقي","Time left")}</div>
                <div class="exam-timer-display" id="se-timer">--:--</div>
            </div>` : ""}

            <div class="exam-user-card">
                <div class="exam-user-avatar"><i class="fa-solid fa-user"></i></div>
                <div class="exam-user-row">
                    <b>${escapeHtml((schoolCtx && schoolCtx.fullName) || "")}</b>
                    ${teacher ? `<div>${seLabel("من","from")} ${escapeHtml(teacher)}</div>` : ""}
                </div>
            </div>

            <div class="exam-section-info">
                <span>${escapeHtml(x.title || "")}</span>
                ${x.subject ? `<span>${escapeHtml(x.subject)}</span>` : ""}
                ${x.due_at ? `<span>${seLabel("التسليم","Due")}: ${seDueText(x.due_at)}</span>` : ""}
            </div>

            <div class="exam-stats-grid" id="se-stats"></div>
            <div class="exam-palette-grid" id="se-palette"></div>

            <div class="exam-sidebar-actions">
                ${seReview ? "" : `<button type="button" class="btn-examside" onclick="submitStudentExam()">
                    <i class="fa-solid fa-paper-plane"></i> ${seLabel("تسليم الاختبار","Submit")}</button>`}
                <button type="button" class="btn-examside outline" onclick="closeStudentExam()">
                    <i class="fa-solid fa-right-from-bracket"></i> ${seLabel("خروج","Exit")}</button>
            </div>
        </aside>

        <main class="exam-main">
            <div class="exam-main-topbar">
                <span class="exam-question-number" id="se-qnum"></span>
                <div class="exam-fontsize-controls">
                    <button type="button" onclick="seSetFont(-1)" title="${seLabel("تصغير","Smaller")}">A-</button>
                    <button type="button" onclick="seSetFont(0)" title="${seLabel("عادي","Normal")}">A</button>
                    <button type="button" onclick="seSetFont(1)" title="${seLabel("تكبير","Larger")}">A+</button>
                </div>
            </div>
            <div class="exam-question-scroll">
                <div class="exam-question-area" id="se-area"></div>
            </div>
            <div class="exam-question-footer">
                ${seReview ? `<span class="card-sub" id="se-review-note"></span>` : `
                <label class="exam-mark-review">
                    <input type="checkbox" id="se-mark" onchange="seToggleMark(this.checked)">
                    <span>${seLabel("تمييز السؤال للمراجعة","Mark for review")}</span>
                </label>`}
                <div style="display:flex; gap:8px;">
                    <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="seGo(seIndex - 1)">
                        <i class="fa-solid fa-arrow-right rtl-flip"></i> ${seLabel("السابق","Previous")}</button>
                    <button type="button" class="btn acc-btn exam-save-next-btn" onclick="seGo(seIndex + 1)">
                        ${seLabel("التالي","Next")} <i class="fa-solid fa-arrow-left rtl-flip"></i></button>
                </div>
            </div>
        </main>
    </div>`;

    if(!qs.length){
        document.getElementById("se-area").innerHTML =
            `<p class="card-sub">${seLabel("لا أسئلة في هذا الاختبار.","This exam has no questions.")}</p>`;
        return;
    }
    seSetFont(seFontStep, true);
    seGo(0);
    if(!seReview && seExam.timed && seExam.duration_min) startSeTimer(seExam.duration_min);
}

/* ⚠️ ميلادي صراحةً: "ar-SA" وحدها تُعطي هجرياً، والمعلّم أدخل الموعد
   بالميلادي — فيقرأ الطالب تاريخاً لا يطابق ما قاله له معلّمه. */
function seDueText(iso){
    try{
        return new Date(iso).toLocaleString(currentLang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-US",
            { dateStyle: "medium", timeStyle: "short" });
    }catch(e){ return ""; }
}

/* ---------- التنقّل والعرض ---------- */

function seGo(i){
    const qs = seQuestions();
    if(!qs.length) return;
    seIndex = Math.max(0, Math.min(qs.length - 1, i));
    renderSeQuestion();
    renderSePalette();
    renderSeStats();
}

function renderSeQuestion(){
    const qs = seQuestions();
    const q = qs[seIndex];
    const area = document.getElementById("se-area");
    const num = document.getElementById("se-qnum");
    if(!q || !area) return;

    if(num) num.textContent = `${seLabel("السؤال","Question")} ${seIndex + 1} ${seLabel("من","of")} ${qs.length}`;

    const given = seReview ? q.given : seAnswers[String(seIndex)];
    const correct = seReview ? q.correct : null;

    area.innerHTML = `
        ${q.text ? `<div class="exam-question-text">${escapeHtml(q.text)}</div>` : ""}
        ${q.image ? `<img class="se-q-img" data-exam-img="${escapeHtml(q.image)}" alt="" hidden>` : ""}
        <div class="exam-choices">
            ${(q.choices || []).map((c, j) => {
                const txt = (typeof c === "string") ? c : (c.text || "");
                const img = (typeof c === "string") ? null : c.image;
                /* في المراجعة نلوّن الصحيح والخطأ بأصناف المحاكي نفسها */
                let cls = "exam-choice";
                if(seReview){
                    if(j === correct) cls += " correct";
                    else if(j === given) cls += " incorrect";
                }else if(given === j) cls += " selected";
                return `
                <label class="${cls}" ${seReview ? "" : `onclick="sePick(${j})"`}>
                    <span>${escapeHtml(txt)}
                        ${img ? `<img class="se-c-img" data-exam-img="${escapeHtml(img)}" alt="" hidden>` : ""}</span>
                    <span class="choice-letter">${seChoiceLetter(j)}</span>
                </label>`;
            }).join("")}
        </div>`;

    const mark = document.getElementById("se-mark");
    if(mark) mark.checked = seMarked.has(seIndex);

    const note = document.getElementById("se-review-note");
    if(note && seReview){
        const ok = given !== null && given !== undefined && given === correct;
        note.innerHTML = (given === null || given === undefined)
            ? `<span style="color:var(--text-3);">${seLabel("لم تُجب على هذا السؤال","You didn't answer this one")}</span>`
            : (ok ? `<span style="color:var(--teal-text); font-weight:700;">${seLabel("إجابتك صحيحة","Correct")}</span>`
                  : `<span style="color:var(--rose); font-weight:700;">${seLabel("إجابتك خاطئة — الصحيح مظلَّل بالأخضر","Wrong — the correct answer is highlighted")}</span>`);
    }
    resolveExamImages();
}

function seChoiceLetter(j){
    const ar = ["أ","ب","ج","د","هـ","و"];
    return currentLang === "ar" ? (ar[j] || (j + 1)) : String.fromCharCode(65 + j);
}

function sePick(j){
    if(seReview) return;
    seAnswers[String(seIndex)] = j;
    renderSeQuestion();
    renderSePalette();
    renderSeStats();
}

function seToggleMark(on){
    if(on) seMarked.add(seIndex); else seMarked.delete(seIndex);
    renderSePalette();
    renderSeStats();
}

/** لوحة أرقام الأسئلة — نفس ألوان المحاكي ومعانيها. */
function renderSePalette(){
    const box = document.getElementById("se-palette");
    if(!box) return;
    const qs = seQuestions();
    box.innerHTML = qs.map((q, i) => {
        let cls = "exam-palette-item";
        if(seReview){
            const ok = q.given !== null && q.given !== undefined && q.given === q.correct;
            cls += ok ? " answered" : " incorrect-flag";
        }else{
            if(seAnswers[String(i)] !== undefined) cls += " answered";
            if(seMarked.has(i)) cls += " marked";
        }
        if(i === seIndex) cls += " current";
        return `<div class="${cls}" onclick="seGo(${i})" role="button" tabindex="0">${i + 1}</div>`;
    }).join("");
}

function renderSeStats(){
    const box = document.getElementById("se-stats");
    if(!box) return;
    const qs = seQuestions();
    if(seReview){
        const right = qs.filter(q => q.given !== null && q.given !== undefined && q.given === q.correct).length;
        box.innerHTML = `
            <div class="exam-stat-box teal"><b>${right}</b><span>${seLabel("صحيحة","correct")}</span></div>
            <div class="exam-stat-box orange"><b>${qs.length - right}</b><span>${seLabel("خاطئة","wrong")}</span></div>`;
        return;
    }
    const done = Object.keys(seAnswers).length;
    box.innerHTML = `
        <div class="exam-stat-box teal"><b>${done}</b><span>${seLabel("مُجاب","answered")}</span></div>
        <div class="exam-stat-box orange"><b>${qs.length - done}</b><span>${seLabel("متبقٍ","left")}</span></div>
        <div class="exam-stat-box blue"><b>${seMarked.size}</b><span>${seLabel("مُميَّز","marked")}</span></div>
        <div class="exam-stat-box neutral"><b>${qs.length}</b><span>${seLabel("الكل","total")}</span></div>`;
}

/** تكبير الخط — نفس أصناف المحاكي، فيتغيّر السؤال والخيارات معاً. */
function seSetFont(step, silent){
    seFontStep = Math.max(-1, Math.min(1, silent ? step : step));
    const area = document.getElementById("se-area");
    if(!area) return;
    area.classList.remove("font-sm", "font-lg");
    if(seFontStep === -1) area.classList.add("font-sm");
    if(seFontStep === 1)  area.classList.add("font-lg");
}

/* ---------- الصور ---------- */

/* ⚠️ الصور مسارات في دلو خاص لا روابط عامة، فوضعها في src مباشرة يعطي
   صورةً مكسورة. نوقّعها ونُظهرها، ونحفظ الرابط كي لا يُوقَّع مرتين حين
   يتنقّل الطالب بين الأسئلة ذهاباً وإياباً. */
async function resolveExamImages(){
    const nodes = Array.from(document.querySelectorAll("#se-area img[data-exam-img]"));
    if(!nodes.length) return;
    if(!sb){ nodes.forEach(el => markExamImageFailed(el, "NO_CLIENT")); return; }

    await Promise.all(nodes.map(async el => {
        const path = el.getAttribute("data-exam-img");
        let url = seImgCache.get(path) || null, why = "";
        for(let attempt = 0; attempt < 2 && !url; attempt++){
            try{
                const { data, error } = await sb.storage.from("exam-images").createSignedUrl(path, 3600);
                if(error) throw error;
                url = (data && (data.signedUrl || data.signedURL)) || null;
                if(url) seImgCache.set(path, url); else why = "NO_URL_IN_RESPONSE";
            }catch(e){
                why = (e && (e.message || e.error || e.name)) || "UNKNOWN";
                console.warn("[خُطى] تعذّر توقيع رابط الصورة:", path, e);
            }
        }
        if(!url){ markExamImageFailed(el, why); return; }
        el.addEventListener("error", () => markExamImageFailed(el, "IMAGE_LOAD_FAILED"), { once:true });
        el.addEventListener("load", () => el.classList.add("is-ready"), { once:true });
        el.removeAttribute("hidden");
        el.src = url;
    }));
}

/** يضع مكان الصورة التي تعذّر عرضها لوحةً تقول السبب — لا فراغاً.
 *  الفشل الصامت يُعمي الطرفين: الطالب لا يفهم، وأنا لا أعرف. */
function markExamImageFailed(el, why){
    const box = document.createElement("div");
    box.className = "se-img-failed";
    box.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ` +
        `<span>${seLabel("تعذّر عرض صورة هذا السؤال", "This question's image could not load")}</span>` +
        `<small>${escapeHtml(String(why || "").slice(0, 120))}</small>`;
    if(el.parentElement) el.parentElement.replaceChild(box, el);
}

/* ---------- المؤقّت ---------- */

function startSeTimer(minutes){
    clearInterval(seTimer);
    seLeft = minutes * 60;
    const tick = () => {
        const el = document.getElementById("se-timer");
        const block = document.getElementById("se-timer-block");
        if(el){
            const m = Math.floor(seLeft / 60), s = seLeft % 60;
            el.textContent = `${m}:${String(s).padStart(2, "0")}`;
        }
        if(block) block.classList.toggle("low-time", seLeft <= 60);
        if(seLeft <= 0){
            clearInterval(seTimer);
            showToast(seLabel("انتهى الوقت — يُسلَّم اختبارك الآن.","Time's up — submitting now."));
            submitStudentExam(true);
            return;
        }
        seLeft--;
    };
    tick();
    seTimer = setInterval(tick, 1000);
}

/* ---------- التسليم والنتيجة ---------- */

async function submitStudentExam(auto){
    if(!seExam || !sb || seReview) return;
    const qs = seQuestions();
    const done = Object.keys(seAnswers).length;

    /* ⚠️ تحذير لا منع: قد يقصد الطالب ترك سؤال، لكن ألّا يعرف أنه تركه
       سهواً ثم يرى درجته ناقصة — هذا ما يجعل المنصة تبدو ظالمة. */
    if(!auto && done < qs.length && !confirm(seLabel(
        `تركتَ ${qs.length - done} سؤالاً بلا إجابة. هل تسلّم الآن؟`,
        `${qs.length - done} question(s) unanswered. Submit anyway?`))) return;

    clearInterval(seTimer);
    try{
        const { data, error } = await sb.rpc("submit_exam_attempt", {
            p_exam: seExam.id, p_answers: seAnswers,
        });
        if(error) throw error;
        await showStudentExamResult(data, false);
    }catch(e){
        console.error("[خُطى] تعذّر تسليم الاختبار:", e);
        showToast(studentExamError(e));
    }
}

async function showStudentExamResult(res, wasEarlier){
    const score = Number(res.score) || 0;
    const total = Number(res.total) || 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const canReview = !!(seExam && seExam.can_review);
    const ov = ensureStudentExamOverlay();

    /* ⚠️ لماذا نسأل الخادم عن can_review بدل أن نقرّر هنا؟
       لأن القرار يعتمد على وضع المعلّم وعلى موعد التسليم، وكلاهما لا
       يُوثق به من المتصفّح. والدالة نفسها ترفض المراجعة إن لم تُسمح،
       فحتى من نادى الزرّ يدوياً لا يحصل على شيء. */
    ov.innerHTML = `
        <div class="se-result">
            <div class="se-result-card">
                <h2 style="margin-bottom:6px;">${escapeHtml((seExam && seExam.title) || seLabel("النتيجة","Result"))}</h2>
                <p class="card-sub">${wasEarlier
                    ? seLabel("سلّمتَ هذا الاختبار من قبل.","You already submitted this exam.")
                    : seLabel("سُلّم اختبارك.","Your exam was submitted.")}</p>
                <div class="se-score">${pct}%</div>
                <div class="card-sub">${score} ${seLabel("من","of")} ${total} ${seLabel("إجابة صحيحة","correct")}</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center; margin-top:22px;">
                    ${canReview ? `<button type="button" class="btn acc-btn" onclick="openExamReview()">
                        <i class="fa-solid fa-list-check"></i> ${seLabel("راجع إجاباتك","Review answers")}</button>` : ""}
                    <button type="button" class="btn btn-outline acc-btn" onclick="closeStudentExam()">
                        <i class="fa-solid fa-check"></i> ${seLabel("تم","Done")}</button>
                </div>
                ${canReview ? "" : `<p class="hint" style="margin-top:16px;">${
                    seExam && seExam.due_at
                        ? seLabel(`تظهر لك إجاباتك الصحيحة بعد موعد التسليم (${seDueText(seExam.due_at)}).`,
                                  `Correct answers appear after the due date (${seDueText(seExam.due_at)}).`)
                        : seLabel("معلّمك اختار ألّا تُعرض الإجابات الصحيحة لهذا الاختبار.",
                                  "Your teacher chose not to show the correct answers for this exam.")}</p>`}
            </div>
        </div>`;
}

async function openExamReview(){
    if(!seExam || !sb) return;
    try{
        const { data, error } = await sb.rpc("get_exam_review", { p_exam: seExam.id });
        if(error) throw error;
        seReview = data;
        seIndex = 0;
        renderExamShell();
    }catch(e){
        console.error("[خُطى] تعذّرت المراجعة:", e);
        showToast(studentExamError(e));
    }
}

function closeStudentExam(){
    clearInterval(seTimer);
    const ov = document.getElementById("student-exam-overlay");
    if(ov){ ov.style.display = "none"; ov.innerHTML = ""; }
    document.body.style.overflow = "";
    seExam = null; seReview = null; seAnswers = {}; seMarked = new Set();
    if(typeof loadTeacherExams === "function") loadTeacherExams();
}

/* ============================================================
   من أرسل هذا؟ — أسماء المعلّمين
   ------------------------------------------------------------
   وصف المالك: "يجب أن يُكتب للطالب مصدر الملف، أو بأوضح: من هو المعلّم
   المرفق لهذا الملف. فربما يكون لدى الطالب أكثر من ملف لكن لا يعرف كل
   ملف من أي معلّم".

   ⚠️ ولا يمكن جلبها بقراءة school_members: سياسات الصلاحيات تسمح للطالب
   بقراءة صفّه هو فقط (وهذا صحيح — لا يجوز أن يقرأ الطلاب سجلّ بعضهم).
   فالأسماء تأتي من دالة school_staff_names التي تُرجع أسماء طاقم مدرسته
   وحدهم، بلا بريد ولا معرّفات حساب.
   ============================================================ */
const schoolStaffNames = new Map();

async function loadSchoolStaffNames(){
    if(!sb || !schoolCtx) return;
    try{
        const { data, error } = await sb.rpc("school_staff_names");
        if(error) throw error;
        schoolStaffNames.clear();
        (data || []).forEach(m => schoolStaffNames.set(m.member_id, m.full_name));
    }catch(e){ console.warn("[خُطى] تعذّر جلب أسماء المعلّمين:", e); }
}

/** اسم صاحب العنصر، أو "" إن لم يُعرف (فلا نكتب سطراً فارغاً). */
function schoolStaffName(memberId){
    return schoolStaffNames.get(memberId) || "";
}

/** سطر "من: فلان" جاهزاً للإدراج — يختفي وحده إن لم نعرف الاسم. */
function schoolSourceLine(memberId){
    const name = schoolStaffName(memberId);
    if(!name) return "";
    return ` · <span style="color:var(--gold-text); font-weight:700;">${
        currentLang === "ar" ? "من" : "from"} ${escapeHtml(name)}</span>`;
}

/* ============================================================
   تقسيم ما يصل الطالب حسب معلّمه
   ------------------------------------------------------------
   وصف المالك: «ربما يكون لدى الطالب أكثر من ملف لكن لا يعرف كل ملف من أي
   معلّم… يكون مقسّماً بشكل أفضل من الحالي».

   وسطر "من فلان" تحت كل عنصر لم يكن كافياً: حين تجتمع ملفات ثلاثة معلّمين
   في قائمة واحدة يظل الطالب يقرأ سطراً سطراً ليجد ملف معلّم الرياضيات.

   ⚠️ ولا يُطبَّق إلا على الطالب: المعلّم يرى ملفاته هو، فتقسيمها باسمه
   عنوانٌ فوق قائمة كلها له — ضجيج لا فائدة فيه.
   ============================================================ */
function groupByTeacher(rows, renderRow){
    const groups = new Map();
    rows.forEach(r => {
        const key = r.owner_id || "";
        if(!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    });
    const keys = [...groups.keys()].sort((a, b) => {
        const na = schoolStaffName(a), nb = schoolStaffName(b);
        if(!na && nb) return 1;
        if(na && !nb) return -1;
        return na.localeCompare(nb, "ar");
    });
    return keys.map(k => {
        const name = schoolStaffName(k);
        const head = `<div class="school-group-head">
            <i class="fa-solid fa-chalkboard-user"></i>
            <b>${name ? escapeHtml(name) : (currentLang==='ar' ? "المدرسة" : "School")}</b>
            <span class="pill">${groups.get(k).length}</span>
        </div>`;
        return head + groups.get(k).map(renderRow).join("");
    }).join("");
}

/** يقسّم للطالب ويترك القائمة كما هي لغيره. */
function renderSchoolList(rows, renderRow){
    const isStudent = typeof schoolCtx !== "undefined" && schoolCtx && schoolCtx.role === "student";
    const many = new Set(rows.map(r => r.owner_id)).size > 1;
    return (isStudent && many) ? groupByTeacher(rows, renderRow) : rows.map(renderRow).join("");
}
