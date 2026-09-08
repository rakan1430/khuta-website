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

        questions.push({ id:q.id, text, image:q.image || null, choices, correct });
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
