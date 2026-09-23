/* ============================================================
   منشئ الاختبارات المرئي — بدعم الصور في السؤال وفي الخيارات
   ------------------------------------------------------------
   طلب المالك بالنص: "أضف عليه القدرة على إضافة صورة السؤال في قسم السؤال
   بدل كتابته، ونفس الشيء في الخيارات… فكما تعرف بعض الأسئلة تأتي رسم وحتى
   الخيارات". وهذا صحيح تماماً في الرياضيات والعلوم: سؤال عن مثلث لا يُكتب،
   وخياراته أربعة أشكال لا أربع كلمات.

   فالسؤال هنا يقبل نصاً وصورة معاً أو أحدهما، وكذلك كل خيار على حدة.

   ⚠️ الصور في دلو خاص لا عام. عرضها يمرّ برابط موقَّع قصير العمر، لأن
   الرابط العام يعني أن أي شخص خارج المدرسة يفتح صورة الاختبار قبل موعده.

   ⚠️ ملاحظة على الصياغة السريعة (اللصق): أبقيناها إلى جانب المنشئ المرئي
   لا بدلاً منه — من عنده ٤٠ سؤالاً نصياً جاهزاً في ملف لن يرضى بإدخالها
   واحداً واحداً بالفأرة.
   ============================================================ */

const MAX_EXAM_IMAGE_BYTES = 5 * 1024 * 1024;   // مطابق لحدّ الدلو
const MAX_EXAM_QUESTIONS   = 100;
const MAX_EXAM_CHOICES     = 6;
const MIN_EXAM_CHOICES     = 2;

// مسودّة الاختبار في الذاكرة. لا تُحفظ إلا بضغطة "حفظ".
let examDraft = null;
// ذاكرة الروابط الموقَّعة: إصدار رابط لكل صورة في كل رسم مكلف وبطيء
const examImgUrlCache = new Map();

function newExamQuestion(){
    return {
        id: "q" + Math.random().toString(36).slice(2, 9),
        text: "",
        image: null,                                    // مسار في دلو exam-images
        choices: [{ text:"", image:null }, { text:"", image:null }],
        correct: 0,
        explanation: null,                               // { type:'text'|'image'|'drawing', text, image }
    };
}

function ensureExamDraft(){
    if(!examDraft) examDraft = { questions: [newExamQuestion()] };
    return examDraft;
}

/* ---------- الصور ---------- */

async function examImageUrl(path){
    if(!path || !sb) return null;
    if(examImgUrlCache.has(path)) return examImgUrlCache.get(path);
    try{
        const { data, error } = await sb.storage.from("exam-images").createSignedUrl(path, 3600);
        if(error) throw error;
        examImgUrlCache.set(path, data.signedUrl);
        return data.signedUrl;
    }catch(e){
        console.warn("[خُطى] تعذّر إصدار رابط للصورة:", e);
        return null;
    }
}

/** يرفع صورة ويعيد مسارها داخل الدلو، أو null عند الفشل. */
async function uploadExamImage(file){
    if(!sb || !schoolCtx) return null;
    if(!file) return null;
    if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){
        showToast(currentLang==='ar' ? 'الصورة يجب أن تكون PNG أو JPG أو WEBP' : 'Image must be PNG, JPG or WEBP');
        return null;
    }
    if(file.size > MAX_EXAM_IMAGE_BYTES){
        showToast(currentLang==='ar' ? 'حجم الصورة أكبر من ٥ ميجا' : 'Image larger than 5 MB');
        return null;
    }
    if(typeof schoolStorageAllows === "function" && !(await schoolStorageAllows(file.size))) return null;
    // ⚠️ اسم الملف الأصلي لا يُستعمل إطلاقاً: قد يحمل ../ أو محارف تكسر المسار
    const ext = ({ "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/gif":"gif" })[file.type];
    const path = `${schoolCtx.schoolId}/${schoolCtx.memberId}/${crypto.randomUUID()}.${ext}`;
    try{
        const { error } = await sb.storage.from("exam-images").upload(path, file, {
            cacheControl: "3600", upsert: false, contentType: file.type,
        });
        if(error) throw error;
        return path;
    }catch(e){
        console.error("[خُطى] تعذّر رفع الصورة:", e);
        // الرفع يشترط إثبات Google في قاعدة البيانات — نقولها صراحةً
        showToast(currentLang==='ar'
            ? 'تعذّر رفع الصورة. إن كنت داخلاً بالدخول السريع فأكّد هويتك بحساب Google أولاً.'
            : 'Upload failed. If you signed in quickly, confirm with Google first.');
        return null;
    }
}

async function pickExamImage(qIndex, cIndex){
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
        const file = input.files && input.files[0];
        if(!file) return;
        showToast(currentLang==='ar' ? 'جارٍ رفع الصورة…' : 'Uploading…');
        const path = await uploadExamImage(file);
        if(!path) return;
        const q = ensureExamDraft().questions[qIndex];
        if(!q) return;
        if(cIndex == null) q.image = path;
        else if(q.choices[cIndex]) q.choices[cIndex].image = path;
        renderExamBuilder();
    };
    input.click();
}

function removeExamImage(qIndex, cIndex){
    const q = ensureExamDraft().questions[qIndex];
    if(!q) return;
    // ⚠️ لا نحذف الكائن من التخزين هنا عمداً: قد يكون الاختبار محفوظاً أصلاً
    // ويشير إليه، فحذف الملف يكسر اختباراً منشوراً. إزالة المرجع تكفي.
    if(cIndex == null) q.image = null;
    else if(q.choices[cIndex]) q.choices[cIndex].image = null;
    renderExamBuilder();
}

/* ---------- تحرير المسودّة ---------- */

function addExamQuestion(){
    const d = ensureExamDraft();
    if(d.questions.length >= MAX_EXAM_QUESTIONS){
        showToast(currentLang==='ar' ? `الحد ${MAX_EXAM_QUESTIONS} سؤالاً` : `Limit is ${MAX_EXAM_QUESTIONS}`);
        return;
    }
    d.questions.push(newExamQuestion());
    renderExamBuilder();
    // نُنزل الشاشة للسؤال الجديد: على سبورة كبيرة قد يكون خارج الرؤية
    setTimeout(() => {
        const nodes = document.querySelectorAll(".exq-card");
        const last = nodes[nodes.length - 1];
        if(last && last.scrollIntoView) last.scrollIntoView({ behavior:"smooth", block:"center" });
    }, 30);
}

function removeExamQuestion(i){
    const d = ensureExamDraft();
    if(d.questions.length <= 1){
        showToast(currentLang==='ar' ? 'لا يمكن حذف السؤال الوحيد' : 'Cannot delete the only question');
        return;
    }
    d.questions.splice(i, 1);
    renderExamBuilder();
}

function moveExamQuestion(i, dir){
    const qs = ensureExamDraft().questions;
    const j = i + dir;
    if(j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    renderExamBuilder();
}

function addExamChoice(qi){
    const q = ensureExamDraft().questions[qi];
    if(!q) return;
    if(q.choices.length >= MAX_EXAM_CHOICES){
        showToast(currentLang==='ar' ? `الحد ${MAX_EXAM_CHOICES} خيارات` : `Limit is ${MAX_EXAM_CHOICES} choices`);
        return;
    }
    q.choices.push({ text:"", image:null });
    renderExamBuilder();
}

function removeExamChoice(qi, ci){
    const q = ensureExamDraft().questions[qi];
    if(!q || q.choices.length <= MIN_EXAM_CHOICES){
        showToast(currentLang==='ar' ? 'يحتاج السؤال خيارين على الأقل' : 'A question needs 2 choices');
        return;
    }
    q.choices.splice(ci, 1);
    // ⚠️ تصحيح مؤشّر الإجابة بعد الحذف: لولاه لأشار إلى خيار آخر بصمت،
    // فتُحتسب إجابة الطالب الصحيحة خاطئة ولا يظهر الخلل إلا في الدرجات.
    if(q.correct === ci) q.correct = 0;
    else if(q.correct > ci) q.correct -= 1;
    renderExamBuilder();
}

function setExamCorrect(qi, ci){
    const q = ensureExamDraft().questions[qi];
    if(q) q.correct = ci;
    renderExamBuilder();
}

// الحقول النصية تُحدَّث دون إعادة رسم: إعادة الرسم تفقد موضع المؤشّر
function updateExamText(qi, ci, value){
    const q = ensureExamDraft().questions[qi];
    if(!q) return;
    if(ci == null) q.text = value;
    else if(q.choices[ci]) q.choices[ci].text = value;
}

/* ---------- الرسم ---------- */

function examQuestionIssues(q){
    const issues = [];
    if(!q.text.trim() && !q.image) issues.push(currentLang==='ar' ? 'السؤال بلا نص ولا صورة' : 'no text and no image');
    const empty = q.choices.filter(c => !c.text.trim() && !c.image).length;
    if(empty) issues.push(currentLang==='ar' ? `${empty} خيار فارغ` : `${empty} empty choice(s)`);
    return issues;
}

function renderExamBuilder(){
    const box = document.getElementById("exam-builder");
    if(!box) return;
    const d = ensureExamDraft();

    box.innerHTML = d.questions.map((q, qi) => {
        const issues = examQuestionIssues(q);
        return `
        <div class="exq-card">
            <div class="exq-head">
                <b>${currentLang==='ar' ? 'السؤال' : 'Question'} ${qi + 1}</b>
                <div class="exq-head-actions">
                    <button type="button" class="btn-ghost btn-sm" title="${currentLang==='ar'?'أعلى':'Up'}" onclick="moveExamQuestion(${qi}, -1)"><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" class="btn-ghost btn-sm" title="${currentLang==='ar'?'أسفل':'Down'}" onclick="moveExamQuestion(${qi}, 1)"><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" class="btn-ghost btn-sm" title="${currentLang==='ar'?'حذف':'Delete'}" onclick="removeExamQuestion(${qi})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>

            <textarea class="exq-text" rows="2" placeholder="${currentLang==='ar' ? 'نص السؤال (اتركه فارغاً إن كان السؤال صورة فقط)' : 'Question text (leave empty if the question is only an image)'}"
                oninput="updateExamText(${qi}, null, this.value)">${escapeHtml(q.text)}</textarea>

            <div class="exq-img-row">
                ${q.image
                    ? `<div class="exq-img" data-img-path="${escapeHtml(q.image)}">
                           <img alt="${currentLang==='ar'?'صورة السؤال':'Question image'}" hidden>
                           <button type="button" class="exq-img-x" onclick="removeExamImage(${qi}, null)" title="${currentLang==='ar'?'إزالة الصورة':'Remove image'}"><i class="fa-solid fa-xmark"></i></button>
                       </div>`
                    : `<button type="button" class="btn btn-outline btn-sm" onclick="pickExamImage(${qi}, null)">
                           <i class="fa-solid fa-image"></i> ${currentLang==='ar' ? 'أضف صورة للسؤال' : 'Add question image'}</button>`}
            </div>

            <div class="exq-choices">
                ${q.choices.map((c, ci) => `
                    <div class="exq-choice ${q.correct === ci ? 'is-correct' : ''}">
                        <button type="button" class="exq-radio" onclick="setExamCorrect(${qi}, ${ci})"
                                title="${currentLang==='ar' ? 'اجعله الإجابة الصحيحة' : 'Mark as correct'}"
                                aria-pressed="${q.correct === ci}">
                            <i class="fa-${q.correct === ci ? 'solid fa-circle-check' : 'regular fa-circle'}"></i>
                        </button>
                        <input type="text" class="exq-choice-text" value="${escapeHtml(c.text)}"
                               placeholder="${currentLang==='ar' ? `الخيار ${ci + 1}` : `Choice ${ci + 1}`}"
                               oninput="updateExamText(${qi}, ${ci}, this.value)">
                        ${c.image
                            ? `<div class="exq-img exq-img-sm" data-img-path="${escapeHtml(c.image)}">
                                   <img alt="${currentLang==='ar'?'صورة الخيار':'Choice image'}" hidden>
                                   <button type="button" class="exq-img-x" onclick="removeExamImage(${qi}, ${ci})"><i class="fa-solid fa-xmark"></i></button>
                               </div>`
                            : `<button type="button" class="btn-ghost btn-sm" onclick="pickExamImage(${qi}, ${ci})"
                                       title="${currentLang==='ar' ? 'صورة للخيار' : 'Choice image'}"><i class="fa-solid fa-image"></i></button>`}
                        <button type="button" class="btn-ghost btn-sm" onclick="removeExamChoice(${qi}, ${ci})"
                                title="${currentLang==='ar' ? 'حذف الخيار' : 'Remove choice'}"><i class="fa-solid fa-xmark"></i></button>
                    </div>`).join("")}
            </div>

            <div class="exq-foot">
                <button type="button" class="btn-ghost btn-sm" onclick="addExamChoice(${qi})">
                    <i class="fa-solid fa-plus"></i> ${currentLang==='ar' ? 'خيار آخر' : 'Add choice'}</button>
                ${issues.length ? `<span class="exq-issue"><i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(issues.join(" · "))}</span>` : ""}
            </div>

            ${renderExplanationBlock(q, qi)}
        </div>`;
    }).join("");

    const count = document.getElementById("exam-builder-count");
    if(count){
        count.textContent = currentLang==='ar'
            ? `${d.questions.length} سؤالاً في المسودّة`
            : `${d.questions.length} question(s) in draft`;
    }

    hydrateExamImages(box);
}

/* الروابط الموقَّعة تُجلب بعد الرسم: الرسم متزامن والتوقيع غير متزامن،
   فلو انتظرناه لتجمّدت الواجهة عند كل ضغطة. */
async function hydrateExamImages(root){
    const nodes = root.querySelectorAll("[data-img-path]");
    for(const node of nodes){
        const img = node.querySelector("img");
        if(!img) continue;
        /* ⚠️ الصورة تبقى hidden حتى يصل رابطها الموقَّع. لولا ذلك لظهرت
           <img> بلا src، وكروم يرسمها **مربّعاً أبيض بأيقونة مستند** —
           وهو أحد مصادر "المربّع الأبيض" الذي لاحظه المالك. */
        const url = await examImageUrl(node.getAttribute("data-img-path"));
        if(url){ img.src = url; img.hidden = false; }
        else node.classList.add("exq-img-broken");
    }
}

/* ============================================================
   شرح الحل — نص أو صورة أو رسم بخط يد المعلّم
   ------------------------------------------------------------
   يظهر للطالب بعد التسليم عند مراجعة إجاباته (js/24-student-exam.js)،
   ولا يصل إطلاقاً قبل ذلك — نفس القناة الآمنة التي تحذف "correct" أصلاً
   (get_exam_for_student)، فحجبه عن الطالب قبل التسليم مسؤولية الخادم لا
   الواجهة هنا.

   ⚠️ التخزين: لا عمود جديد ولا هجرة — q.explanation جزء من نفس JSONB
   "questions" الذي يُحفَظ أصلاً في teacher_exams. والصورة (مرفوعة أو رسم
   مصدَّر PNG) تذهب لنفس دلو exam-images بنفس آلية توقيع الروابط.
   ============================================================ */

function ensureExplanation(qi){
    const q = ensureExamDraft().questions[qi];
    if(!q) return null;
    if(!q.explanation) q.explanation = { type:"text", text:"", image:null };
    return q.explanation;
}

function setExplanationType(qi, type){
    const ex = ensureExplanation(qi);
    if(ex) ex.type = type;
    renderExamBuilder();
}

function updateExplanationText(qi, value){
    const q = ensureExamDraft().questions[qi];
    if(q && q.explanation) q.explanation.text = value;
}

function clearExplanation(qi){
    const q = ensureExamDraft().questions[qi];
    if(q) q.explanation = null;
    renderExamBuilder();
}

async function pickExplanationImage(qi){
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp,image/gif";
    input.onchange = async () => {
        const file = input.files && input.files[0];
        if(!file) return;
        showToast(currentLang==='ar' ? 'جارٍ رفع الصورة…' : 'Uploading…');
        const path = await uploadExamImage(file);
        if(!path) return;
        const ex = ensureExplanation(qi);
        ex.image = path; ex.type = "image";
        renderExamBuilder();
    };
    input.click();
}

function removeExplanationImage(qi){
    const q = ensureExamDraft().questions[qi];
    if(q && q.explanation) q.explanation.image = null;
    renderExamBuilder();
}

/* ---------- لوحة الرسم بخط اليد ---------- */
let edQi = null, edCtx = null, edDrawing = false, edLastX = 0, edLastY = 0;

function ensureExplainDrawModal(){
    let modal = document.getElementById("explain-draw-modal");
    if(modal) return modal;
    modal = document.createElement("div");
    modal.id = "explain-draw-modal";
    modal.className = "overlay-screen";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="wizard-card" style="max-width:760px;">
            <h3 style="margin-bottom:4px;"><i class="fa-solid fa-pen-nib"></i> ${currentLang==='ar' ? 'اكتب الشرح بخط يدك' : "Write the explanation by hand"}</h3>
            <p class="card-sub" style="margin-bottom:12px;">${currentLang==='ar' ? 'ارسم بإصبعك أو بقلم الشاشة، ثم احفظ.' : 'Draw with your finger or a stylus, then save.'}</p>
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <button type="button" class="btn btn-outline btn-sm acc-btn" onclick="clearExplanationCanvas()">
                    <i class="fa-solid fa-eraser"></i> ${currentLang==='ar' ? 'مسح' : 'Clear'}</button>
                <label class="hint" style="display:flex; align-items:center; gap:6px;">
                    ${currentLang==='ar' ? 'سُمك القلم' : 'Pen size'}
                    <input type="range" id="explain-pen-size" min="2" max="14" value="4">
                </label>
            </div>
            <canvas id="explain-draw-canvas" width="760" height="420"
                style="background:#fff; border-radius:14px; touch-action:none; width:100%; max-width:760px; border:1px solid var(--border); cursor:crosshair;"></canvas>
            <div style="display:flex; gap:10px; margin-top:14px;">
                <button type="button" class="btn btn-outline btn-block acc-btn" onclick="closeExplanationDraw()">${currentLang==='ar' ? 'إلغاء' : 'Cancel'}</button>
                <button type="button" class="btn acc-btn btn-block" onclick="saveExplanationDraw()">
                    <i class="fa-solid fa-floppy-disk"></i> ${currentLang==='ar' ? 'حفظ الشرح' : 'Save'}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    return modal;
}

function explainCanvasPos(canvas, e){
    const r = canvas.getBoundingClientRect();
    const scaleX = canvas.width / r.width, scaleY = canvas.height / r.height;
    return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
}

function bindExplainCanvasEvents(canvas){
    if(canvas.dataset.bound) return;
    canvas.dataset.bound = "1";
    canvas.addEventListener("pointerdown", (e) => {
        edDrawing = true;
        try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
        const p = explainCanvasPos(canvas, e);
        edLastX = p.x; edLastY = p.y;
    });
    canvas.addEventListener("pointermove", (e) => {
        if(!edDrawing || !edCtx) return;
        const sizeEl = document.getElementById("explain-pen-size");
        edCtx.lineWidth = (sizeEl && parseInt(sizeEl.value, 10)) || 4;
        edCtx.lineCap = "round"; edCtx.lineJoin = "round"; edCtx.strokeStyle = "#1a1a1a";
        const p = explainCanvasPos(canvas, e);
        edCtx.beginPath(); edCtx.moveTo(edLastX, edLastY); edCtx.lineTo(p.x, p.y); edCtx.stroke();
        edLastX = p.x; edLastY = p.y;
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
        canvas.addEventListener(ev, () => { edDrawing = false; }));
}

function openExplanationDraw(qi){
    ensureExplanation(qi);
    edQi = qi;
    const modal = ensureExplainDrawModal();
    modal.style.display = "flex";
    const canvas = document.getElementById("explain-draw-canvas");
    edCtx = canvas.getContext("2d");
    edCtx.fillStyle = "#fff";
    edCtx.fillRect(0, 0, canvas.width, canvas.height);
    bindExplainCanvasEvents(canvas);
}

function clearExplanationCanvas(){
    if(!edCtx) return;
    edCtx.fillStyle = "#fff";
    edCtx.fillRect(0, 0, edCtx.canvas.width, edCtx.canvas.height);
}

function closeExplanationDraw(){
    const modal = document.getElementById("explain-draw-modal");
    if(modal) modal.style.display = "none";
    edQi = null; edCtx = null;
}

async function saveExplanationDraw(){
    const canvas = document.getElementById("explain-draw-canvas");
    const qi = edQi;
    if(qi == null || !canvas) return;
    const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
    if(!blob){ showToast(currentLang==='ar' ? 'تعذّر حفظ الرسم' : 'Could not save the drawing'); return; }
    showToast(currentLang==='ar' ? 'جارٍ الرفع…' : 'Uploading…');
    const path = await uploadExamImage(blob);
    if(!path) return;
    const ex = ensureExplanation(qi);
    ex.image = path; ex.type = "drawing";
    closeExplanationDraw();
    renderExamBuilder();
}

function renderExplanationBlock(q, qi){
    const ex = q.explanation;
    const type = ex ? ex.type : null;
    return `
    <div class="exq-explain">
        <div class="exq-explain-head">
            <i class="fa-solid fa-lightbulb"></i>
            <b>${currentLang==='ar' ? 'شرح الحل (اختياري)' : 'Solution explanation (optional)'}</b>
            <span class="hint">${currentLang==='ar' ? 'يظهر للطالب بعد التسليم عند مراجعة أخطائه' : 'Shown to the student when reviewing mistakes after submitting'}</span>
            ${ex ? `<button type="button" class="btn-ghost btn-sm" onclick="clearExplanation(${qi})" title="${currentLang==='ar'?'إزالة الشرح':'Remove explanation'}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
        <div class="exq-explain-tabs">
            <button type="button" class="exq-tab ${type==='text'?'is-active':''}" onclick="setExplanationType(${qi},'text')"><i class="fa-solid fa-font"></i> ${currentLang==='ar'?'نص':'Text'}</button>
            <button type="button" class="exq-tab ${type==='image'?'is-active':''}" onclick="setExplanationType(${qi},'image')"><i class="fa-solid fa-image"></i> ${currentLang==='ar'?'صورة':'Image'}</button>
            <button type="button" class="exq-tab ${type==='drawing'?'is-active':''}" onclick="openExplanationDraw(${qi})"><i class="fa-solid fa-pen-nib"></i> ${currentLang==='ar'?'بخط اليد':'Handwritten'}</button>
        </div>
        ${type==='text' ? `
        <textarea class="exq-text" rows="2" placeholder="${currentLang==='ar'?'اكتب شرح الحل هنا…':'Write the explanation…'}"
            oninput="updateExplanationText(${qi}, this.value)">${escapeHtml((ex && ex.text) || "")}</textarea>` : ""}
        ${(type==='image' || type==='drawing') ? (
            ex.image
            ? `<div class="exq-img" data-img-path="${escapeHtml(ex.image)}">
                   <img alt="${currentLang==='ar'?'شرح الحل':'Explanation'}" hidden>
                   <button type="button" class="exq-img-x" onclick="removeExplanationImage(${qi})"><i class="fa-solid fa-xmark"></i></button>
               </div>`
            : (type==='image'
                ? `<button type="button" class="btn btn-outline btn-sm" onclick="pickExplanationImage(${qi})"><i class="fa-solid fa-upload"></i> ${currentLang==='ar'?'ارفع صورة الشرح':'Upload explanation image'}</button>`
                : `<button type="button" class="btn btn-outline btn-sm" onclick="openExplanationDraw(${qi})"><i class="fa-solid fa-pen"></i> ${currentLang==='ar'?'افتح لوحة الرسم':'Open drawing pad'}</button>`)
          ) : ""}
    </div>`;
}

/* ============================================================
   تحويل ملف إلى مسودّة اختبار — بالذكاء الاصطناعي أو يدوياً بالمعاينة
   ------------------------------------------------------------
   طريقتان جنباً إلى جنب كما طلب المالك: (١) استخراج/توليد آلي عبر
   gemini-proxy.js (نمط schoolExamFile)، أسئلته تدخل المسودّة كأي سؤال
   آخر فلا تُرسَل للطلاب إلا بعد مراجعة المعلّم وحفظه وإرساله يدوياً —
   نفس بوابة المراجعة الموجودة أصلاً، بلا حاجة لأي بناء إضافي.
   (٢) معاينة الملف نفسه بجانب المنشئ لمن يفضّل النسخ يدوياً بلا استخراج آلي.

   ⚠️ الملف لا يُرفع لأي تخزين هنا — يذهب Base64 مباشرة داخل جسم الطلب
   لدالّة Netlify (حدّها 6 ميجا)، فحصرنا الحجم الخام بـ4 ميجا هنا يطابق
   MAX_SCHOOL_EXAM_FILE_B64_LENGTH في gemini-proxy.js بعد تضخّم Base64.
   ============================================================ */
const MAX_EXAM_AI_FILE_BYTES = 4 * 1024 * 1024;
const EXAM_AI_FILE_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

function fileToBase64(file){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(new Error("FILE_READ_FAILED"));
        reader.readAsDataURL(file);
    });
}

/** معاينة الملف المرفوع بجانب المنشئ — للنسخ اليدوي بلا استخراج آلي. */
function previewExamAiFile(){
    const input = document.getElementById("exam-ai-file");
    const box = document.getElementById("exam-ai-preview");
    if(!box) return;
    const file = input && input.files && input.files[0];
    if(!file){ box.innerHTML = ""; return; }

    const url = URL.createObjectURL(file);
    if(/^image\//.test(file.type)){
        box.innerHTML = `<img src="${url}" alt="" style="max-width:100%; border-radius:12px; border:1px solid var(--border);">`;
    }else if(file.type === "application/pdf"){
        box.innerHTML = `<a href="${url}" target="_blank" rel="noopener" class="btn btn-outline btn-sm acc-btn">
            <i class="fa-solid fa-file-pdf"></i> ${currentLang==='ar' ? 'فتح الملف في نافذة جديدة للنسخ منه' : 'Open the file in a new tab to copy from'}</a>`;
    }else{
        box.innerHTML = `<span class="hint">${escapeHtml(file.name)}</span>`;
    }
}

async function convertFileToExamAI(){
    const input = document.getElementById("exam-ai-file");
    const file = input && input.files && input.files[0];
    if(!file){
        showToast(currentLang==='ar' ? 'اختر ملفاً أولاً' : 'Choose a file first');
        return;
    }
    if(!EXAM_AI_FILE_TYPES.includes(file.type)){
        showToast(currentLang==='ar' ? 'نوع الملف غير مدعوم للاستخراج الآلي (PNG/JPG/WEBP/PDF)' : 'File type not supported for AI extraction (PNG/JPG/WEBP/PDF)');
        return;
    }
    if(file.size > MAX_EXAM_AI_FILE_BYTES){
        showToast(currentLang==='ar' ? 'حجم الملف أكبر من ٤ ميجا — الاستخراج الآلي محدود، لكن يمكنك نسخ الأسئلة يدوياً من المعاينة' : 'File larger than 4 MB for AI extraction — you can still copy questions manually from the preview');
        return;
    }

    const btn = document.getElementById("exam-ai-convert-btn");
    schoolBusy(btn, true);
    showToast(currentLang==='ar' ? 'جارٍ تحليل الملف بالذكاء الاصطناعي…' : 'Analyzing the file with AI…');
    try{
        const fileData = await fileToBase64(file);
        const reply = await callGeminiProxy("schoolExamFile", { fileMime: file.type, fileData });
        const data = extractJson(reply);

        if(!data.accepted){
            showToast(data.rejection_note || (currentLang==='ar' ? 'تعذّر قبول هذا الملف' : 'This file was not accepted'));
            return;
        }
        const raw = Array.isArray(data.questions) ? data.questions : [];
        const imported = raw
            .filter(q => q && typeof q.text === "string" && q.text.trim()
                && Array.isArray(q.choices) && q.choices.length >= 2
                && Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.choices.length)
            .map(q => ({
                id: "q" + Math.random().toString(36).slice(2, 9),
                text: String(q.text).trim().slice(0, 2000),
                image: null,
                choices: q.choices.slice(0, MAX_EXAM_CHOICES).map(t => ({ text: String(t).trim().slice(0, 500), image: null })),
                correct: Math.min(q.correct, Math.min(q.choices.length, MAX_EXAM_CHOICES) - 1),
                explanation: null,
            }));

        if(!imported.length){
            showToast(currentLang==='ar' ? 'لم يستخرج الذكاء الاصطناعي أي سؤال صالح من هذا الملف' : 'AI could not extract any valid question from this file');
            return;
        }

        const d = ensureExamDraft();
        const onlyEmpty = d.questions.length === 1 && !d.questions[0].text.trim()
                          && !d.questions[0].image && d.questions[0].choices.every(c => !c.text.trim() && !c.image);
        d.questions = onlyEmpty ? imported : d.questions.concat(imported);
        renderExamBuilder();
        showToast(currentLang==='ar'
            ? `أُضيف ${imported.length} سؤالاً من الملف — راجعها وعدّلها قبل الحفظ ✅`
            : `${imported.length} question(s) added from the file — review before saving ✅`);
    }catch(e){
        console.error("[خُطى] تعذّر تحويل الملف إلى اختبار:", e);
        const authMsg = (typeof getAiLimitErrorMessage === "function") ? getAiLimitErrorMessage(e) : null;
        showToast(authMsg || (currentLang==='ar' ? 'تعذّر تحليل الملف — تأكّد من الاتصال وحاول مجدداً' : 'Could not analyze the file — check your connection and try again'));
    }finally{ schoolBusy(btn, false); }
}

/* ---------- الاستيراد السريع ---------- */

/** يحوّل اللصق النصي إلى أسئلة في المسودّة بدل الحفظ المباشر. */
function importExamFromText(){
    const raw = (document.getElementById("exam-raw") || {}).value || "";
    if(!raw.trim()){
        showToast(currentLang==='ar' ? 'الصق الأسئلة أولاً' : 'Paste questions first');
        return;
    }
    const { questions, problems } = parseExamQuestions(raw);
    const errBox = document.getElementById("exam-parse-errors");
    if(errBox){
        errBox.innerHTML = problems.length
            ? `<b>${currentLang==='ar' ? 'أسطر لم تُقبل:' : 'Rejected lines:'}</b><br>` + problems.map(escapeHtml).join("<br>")
            : "";
        errBox.style.display = problems.length ? "block" : "none";
    }
    if(!questions.length){
        showToast(currentLang==='ar' ? 'لم يُقبل أي سؤال' : 'No valid questions');
        return;
    }

    const d = ensureExamDraft();
    // المسودّة الفارغة الافتراضية تُستبدل لا تُضاف إليها
    const onlyEmpty = d.questions.length === 1 && !d.questions[0].text.trim()
                      && !d.questions[0].image && d.questions[0].choices.every(c => !c.text.trim() && !c.image);
    const imported = questions.map(q => ({
        id: "q" + Math.random().toString(36).slice(2, 9),
        text: q.text,
        image: null,
        choices: q.choices.map(t => ({ text:t, image:null })),
        correct: q.correct,
    }));
    d.questions = onlyEmpty ? imported : d.questions.concat(imported);
    document.getElementById("exam-raw").value = "";
    showToast(currentLang==='ar' ? `أُضيف ${imported.length} سؤالاً للمسودّة` : `${imported.length} questions added`);
    renderExamBuilder();
}

/* ---------- الحفظ ---------- */

/** يحوّل المسودّة إلى الشكل المخزَّن، أو يعيد قائمة أخطاء. */
function validateExamDraft(){
    const d = ensureExamDraft();
    const problems = [];
    const questions = [];

    d.questions.forEach((q, i) => {
        const label = (currentLang==='ar' ? `السؤال ${i+1}` : `Question ${i+1}`);
        const text = (q.text || "").trim();
        if(!text && !q.image){ problems.push(`${label}: ${currentLang==='ar' ? 'بلا نص ولا صورة' : 'no text and no image'}`); return; }

        const choices = q.choices
            .map(c => ({ text:(c.text || "").trim(), image:c.image || null }))
            .filter(c => c.text || c.image);
        if(choices.length < MIN_EXAM_CHOICES){
            problems.push(`${label}: ${currentLang==='ar' ? 'يحتاج خيارين غير فارغين على الأقل' : 'needs 2 non-empty choices'}`);
            return;
        }

        // ⚠️ الفلترة أعلاه قد تُزيح مؤشّر الإجابة. نتتبّع الخيار الصحيح بعينه
        // لا برقمه — وإلا صُحِّحت إجابات الطلاب على خيار خاطئ بصمت.
        const originalCorrect = q.choices[q.correct];
        const correct = originalCorrect
            ? choices.findIndex(c => c.text === (originalCorrect.text || "").trim()
                                  && c.image === (originalCorrect.image || null))
            : -1;
        if(correct < 0){
            problems.push(`${label}: ${currentLang==='ar' ? 'الخيار المعلَّم صحيحاً فارغ — علّم خياراً آخر' : 'the correct choice is empty'}`);
            return;
        }

        // شرح فارغ (بلا نص وبلا صورة) لا يُحفَظ — يبقى null كأنه لم يُضَف قط
        let explanation = null;
        if(q.explanation){
            const exText = (q.explanation.text || "").trim();
            const exImage = q.explanation.image || null;
            if(exText || exImage) explanation = { type: q.explanation.type || "text", text: exText, image: exImage };
        }

        questions.push({ id:q.id, text, image:q.image || null, choices, correct, explanation });
    });

    return { questions, problems };
}

async function saveExamDraft(){
    if(!sb || !schoolCtx || schoolCtx.role === "student") return;
    const titleEl = document.getElementById("exam-title");
    const title = (titleEl && titleEl.value || "").trim();
    if(title.length < 2){
        showToast(currentLang==='ar' ? 'اكتب عنوان الاختبار' : 'Enter a title');
        return;
    }

    const { questions, problems } = validateExamDraft();
    const errBox = document.getElementById("exam-parse-errors");
    if(errBox){
        errBox.innerHTML = problems.length
            ? `<b>${currentLang==='ar' ? 'أسئلة لم تُحفظ:' : 'Questions not saved:'}</b><br>` + problems.map(escapeHtml).join("<br>")
            : "";
        errBox.style.display = problems.length ? "block" : "none";
    }
    if(!questions.length){
        showToast(currentLang==='ar' ? 'لا يوجد سؤال مكتمل' : 'No complete question');
        return;
    }
    // ⚠️ نمنع الحفظ الجزئي الصامت: لو سقط سؤال فليقرّر المعلّم لا نحن
    if(problems.length && !confirm(currentLang==='ar'
        ? `${problems.length} سؤالاً لن يُحفَظ. أحفظ الباقي (${questions.length})؟`
        : `${problems.length} question(s) will be dropped. Save the remaining ${questions.length}?`)) return;

    const btn = document.getElementById("exam-save");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("teacher_exams").insert({
            school_id: schoolCtx.schoolId,
            owner_id: schoolCtx.memberId,
            title,
            subject: ((document.getElementById("exam-subject") || {}).value || "").trim() || null,
            grade: (document.getElementById("exam-grade") || {}).value || null,
            duration_min: parseInt((document.getElementById("exam-duration") || {}).value, 10) || null,
            questions,
            published: false,
        });
        if(error) throw error;

        if(titleEl) titleEl.value = "";
        examDraft = null;
        renderExamBuilder();
        showToast(currentLang==='ar' ? `حُفظ ${questions.length} سؤالاً ✅` : `Saved ${questions.length} questions ✅`);
        loadTeacherExams();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ الاختبار:", e);
        showToast(currentLang==='ar'
            ? 'تعذّر الحفظ. إن كنت داخلاً بالدخول السريع فأكّد هويتك بحساب Google.'
            : 'Save failed. If you signed in quickly, confirm with Google.');
    }finally{ schoolBusy(btn, false); }
}
