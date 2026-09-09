/* ============================================================
   24) الطالب يفتح اختباره ويحلّه
   ------------------------------------------------------------
   وصف المالك المشكلة: "هناك اختبار رفعته من جهة المعلّم، ومن جهة الطالب
   يظهر في الأسفل، لكن لا يمكن فتحه".

   والسبب أنه لم يكن هناك مسار إطلاقاً: صفّ الاختبار كان يُرسم للطالب بلا
   زرّ واحد. لم يكن عطلاً بل نقصاً — الميزة لم تُكتب أصلاً.

   ⚠️ وحين كتبتُها ظهر ما هو أخطر من النقص:
   عمود questions في teacher_exams يحوي correct لكل سؤال. فلو جلبه المتصفح
   ليعرضه، رأى الطالب الإجابات كلها في ردّ الشبكة قبل أن يبدأ. لذلك:
     • الأسئلة تأتي من get_exam_for_student التي تحذف correct في الخادم.
     • والتصحيح في submit_exam_attempt داخل قاعدة البيانات — لا هنا.
   القاعدة: ما يُحسب في المتصفح يُغيَّر في المتصفح.
   ============================================================ */

let studentExam = null;      // الاختبار المفتوح حالياً
let studentAnswers = {};     // { "0": 2, "1": 0 }
let studentExamTimer = null;

function seLabel(ar, en){ return currentLang === "ar" ? ar : en; }

/** يبني نافذة الاختبار مرة واحدة ويعيد استعمالها. */
function ensureStudentExamOverlay(){
    let ov = document.getElementById("student-exam-overlay");
    if(ov) return ov;
    ov = document.createElement("div");
    ov.id = "student-exam-overlay";
    /* ⚠️ ليست overlay-screen عادية بل شاشة كاملة مستقلة.
       وصف المالك: "واجهة الاختبار غبية وصغيرة جداً بشكل غريب… المفترض أن
       تأخذ الشاشة كاملة بشكل مريح، ليست محشورة وكأنها إشعار". وهو محق:
       الطالب في اختبار، لا يقرأ تنبيهاً — يحتاج كل البكسلات التي أمامه. */
    ov.className = "se-fullscreen";
    ov.style.display = "none";
    ov.innerHTML = `
        <div class="se-sheet" id="student-exam-card">
            <div class="card-head" style="align-items:flex-start;">
                <div style="min-width:0;">
                    <h2 id="se-title" style="margin-bottom:4px;"></h2>
                    <p class="card-sub" id="se-sub"></p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span class="pill" id="se-timer" style="display:none;"></span>
                    <button type="button" class="btn btn-outline btn-sm" onclick="closeStudentExam()">
                        <i class="fa-solid fa-xmark"></i> ${seLabel("إغلاق","Close")}</button>
                </div>
            </div>
            <div id="se-body"></div>
            <div id="se-foot" style="margin-top:18px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;"></div>
        </div>`;
    document.body.appendChild(ov);
    return ov;
}

/** يفتح الاختبار للطالب. */
async function openStudentExam(examId){
    if(!sb){ showToast(seLabel("الخدمة غير متاحة حالياً","Service unavailable")); return; }
    const ov = ensureStudentExamOverlay();
    document.getElementById("se-body").innerHTML =
        `<p class="card-sub">${seLabel("جارٍ فتح الاختبار…","Opening…")}</p>`;
    document.getElementById("se-foot").innerHTML = "";
    document.getElementById("se-title").textContent = seLabel("الاختبار","Exam");
    document.getElementById("se-sub").textContent = "";
    ov.style.display = "flex";

    try{
        const { data, error } = await sb.rpc("get_exam_for_student", { p_exam: examId });
        if(error) throw error;
        studentExam = data;
        studentAnswers = {};

        // سلّمه من قبل؟ نعرض نتيجته بدل أن نفتحه من جديد
        if(data.attempt){
            renderStudentExamResult({ score: data.attempt.score, total: data.attempt.total }, true);
            return;
        }
        renderStudentExamQuestions();
    }catch(e){
        console.error("[خُطى] تعذّر فتح الاختبار:", e);
        document.getElementById("se-body").innerHTML =
            `<p class="card-sub">${escapeHtml(studentExamError(e))}</p>`;
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
    return (typeof schoolError === "function")
        ? schoolError(e, seLabel("فتح الاختبار","opening the exam"))
        : seLabel("تعذّر فتح الاختبار.","Could not open the exam.");
}

function renderStudentExamQuestions(){
    const x = studentExam;
    const qs = Array.isArray(x.questions) ? x.questions : [];
    document.getElementById("se-title").textContent = x.title || seLabel("اختبار","Exam");
    document.getElementById("se-sub").textContent =
        `${x.subject ? x.subject + " · " : ""}${qs.length} ${seLabel("سؤالاً","questions")}` +
        (schoolStaffName(x.owner_id) ? ` · ${seLabel("من","from")} ${schoolStaffName(x.owner_id)}` : "");

    /* ⚠️ الصور مسارات في دلو خاص لا روابط عامة — فوضعها في src مباشرة يعطي
       صورةً مكسورة (وهي التي يرسمها كروم مربّعاً فاتحاً بأيقونة مستند).
       نضعها مخفيةً بـhidden ثم نوقّع رابطها ونُظهرها. وصف المالك:
       "الاختبارات التي فيها صورة لا تظهر الصور أثناء إجراء الاختبار". */
    const imgTag = (path, cls) => path
        ? `<img class="${cls}" data-exam-img="${escapeHtml(path)}" alt="" hidden>` : "";

    document.getElementById("se-body").innerHTML = qs.map((q, i) => `
        <div class="se-q" id="se-q-${i}">
            <b class="se-q-text">${i + 1}. ${escapeHtml(q.text || "")}</b>
            ${imgTag(q.image, "se-q-img")}
            <div class="se-choices">
                ${(q.choices || []).map((c, j) => {
                    const txt = (typeof c === "string") ? c : (c.text || "");
                    const img = (typeof c === "string") ? null : c.image;
                    return `
                    <label class="se-choice">
                        <input type="radio" name="se-q${i}" value="${j}" onchange="pickStudentAnswer(${i}, ${j})">
                        <span>${escapeHtml(txt)}${imgTag(img, "se-c-img")}</span>
                    </label>`;
                }).join("")}
            </div>
        </div>`).join("") || `<p class="card-sub">${seLabel("لا أسئلة في هذا الاختبار.","This exam has no questions.")}</p>`;

    resolveExamImages();

    document.getElementById("se-foot").innerHTML = `
        <button type="button" class="btn acc-btn" id="se-submit" onclick="submitStudentExam()">
            <i class="fa-solid fa-paper-plane"></i> ${seLabel("تسليم الاختبار","Submit")}</button>
        <span class="card-sub" id="se-progress"></span>`;
    updateStudentExamProgress();
    startStudentExamTimer(x.duration_min);
}

/** يوقّع روابط صور الأسئلة والخيارات ثم يُظهرها. */
async function resolveExamImages(){
    const nodes = Array.from(document.querySelectorAll("#se-body img[data-exam-img]"));
    if(!nodes.length || !sb) return;
    await Promise.all(nodes.map(async el => {
        const path = el.getAttribute("data-exam-img");
        try{
            const { data, error } = await sb.storage.from("exam-images").createSignedUrl(path, 3600);
            if(error || !data || !data.signedUrl) throw error || new Error("NO_URL");
            el.src = data.signedUrl;
            el.hidden = false;                 // لا تُظهرها قبل وصول الرابط
        }catch(e){
            console.warn("[خُطى] تعذّر عرض صورة السؤال:", path, e);
            el.remove();                       // لا نترك صورة مكسورة مكانها
        }
    }));
}

function pickStudentAnswer(qi, ci){
    studentAnswers[String(qi)] = ci;
    updateStudentExamProgress();
}

function updateStudentExamProgress(){
    const el = document.getElementById("se-progress");
    if(!el || !studentExam) return;
    const total = (studentExam.questions || []).length;
    const done = Object.keys(studentAnswers).length;
    el.textContent = `${done} / ${total} ${seLabel("مُجاب","answered")}`;
}

function startStudentExamTimer(minutes){
    clearInterval(studentExamTimer);
    const pill = document.getElementById("se-timer");
    if(!pill || !minutes || minutes <= 0){ if(pill) pill.style.display = "none"; return; }
    let left = minutes * 60;
    pill.style.display = "";
    const tick = () => {
        const m = Math.floor(left / 60), s = left % 60;
        pill.textContent = `${m}:${String(s).padStart(2, "0")}`;
        if(left <= 0){
            clearInterval(studentExamTimer);
            showToast(seLabel("انتهى الوقت — يُسلَّم اختبارك الآن.","Time's up — submitting now."));
            submitStudentExam();
            return;
        }
        left--;
    };
    tick();
    studentExamTimer = setInterval(tick, 1000);
}

async function submitStudentExam(){
    if(!studentExam || !sb) return;
    const btn = document.getElementById("se-submit");
    const total = (studentExam.questions || []).length;
    const done = Object.keys(studentAnswers).length;

    // ⚠️ تحذير لا منع: قد يقصد الطالب ترك سؤال، لكن ألّا يعرف أنه تركه سهواً
    //    ثم يرى درجته ناقصة — هذا ما يجعل المنصة تبدو ظالمة.
    if(done < total && !confirm(seLabel(
        `تركتَ ${total - done} سؤالاً بلا إجابة. هل تسلّم الآن؟`,
        `${total - done} question(s) unanswered. Submit anyway?`))) return;

    if(btn){ btn.disabled = true; btn.style.opacity = ".6"; }
    clearInterval(studentExamTimer);
    try{
        const { data, error } = await sb.rpc("submit_exam_attempt", {
            p_exam: studentExam.id, p_answers: studentAnswers,
        });
        if(error) throw error;
        renderStudentExamResult(data, false);
    }catch(e){
        console.error("[خُطى] تعذّر تسليم الاختبار:", e);
        showToast(studentExamError(e));
        if(btn){ btn.disabled = false; btn.style.opacity = ""; }
    }
}

function renderStudentExamResult(res, wasEarlier){
    const score = Number(res.score) || 0;
    const total = Number(res.total) || 0;
    const pct = total ? Math.round((score / total) * 100) : 0;
    const x = studentExam || {};

    document.getElementById("se-title").textContent = x.title || seLabel("النتيجة","Result");
    document.getElementById("se-sub").textContent = wasEarlier
        ? seLabel("سلّمتَ هذا الاختبار من قبل.","You already submitted this exam.")
        : seLabel("سُلّم اختبارك.","Your exam was submitted.");
    const pill = document.getElementById("se-timer");
    if(pill) pill.style.display = "none";

    document.getElementById("se-body").innerHTML = `
        <div class="card" style="text-align:center;">
            <div style="font-size:44px; font-weight:800; color:var(--gold-text);">${pct}%</div>
            <div class="card-sub">${score} ${seLabel("من","of")} ${total} ${seLabel("إجابة صحيحة","correct")}</div>
        </div>`;
    document.getElementById("se-foot").innerHTML = `
        <button type="button" class="btn acc-btn" onclick="closeStudentExam()">
            <i class="fa-solid fa-check"></i> ${seLabel("تم","Done")}</button>`;
}

function closeStudentExam(){
    clearInterval(studentExamTimer);
    const ov = document.getElementById("student-exam-overlay");
    if(ov) ov.style.display = "none";
    studentExam = null;
    studentAnswers = {};
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
