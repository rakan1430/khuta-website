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
// ذاكرة الروابط الموقَّعة: إصدار رابط لكل صورة في كل رسم مكلف وبطيء.
// path → { url, until } — تُنسى قبل انتهاء الرابط بخمس دقائق لا بعده.
const examImgUrlCache = new Map();
const EXAM_IMG_TTL = 3600;              // عمر الرابط الموقَّع بالثواني
const EXAM_IMG_MAX_SIDE = 1600;         // أطول ضلع لصورة تُرفع أو رسمٍ يُصدَّر

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

/** رابط موقَّع لمسار في دلو exam-images: { url } أو { why } بسبب الفشل.
 *  fresh = تجاهل الذاكرة (يُستعمل حين يفشل تحميل رابطٍ محفوظ). */
async function signExamImage(path, fresh){
    if(!path) return { why: "NO_PATH" };
    if(!sb) return { why: "NO_CLIENT" };
    const hit = examImgUrlCache.get(path);
    if(!fresh && hit && hit.until > Date.now()) return { url: hit.url };
    let why = "UNKNOWN";
    for(let attempt = 0; attempt < 2; attempt++){        // تعثّر الشبكة لحظةً لا يُسقط الصورة
        try{
            const { data, error } = await sb.storage.from("exam-images").createSignedUrl(path, EXAM_IMG_TTL);
            if(error) throw error;
            const url = data && (data.signedUrl || data.signedURL);
            if(!url){ why = "NO_URL_IN_RESPONSE"; continue; }
            examImgUrlCache.set(path, { url, until: Date.now() + (EXAM_IMG_TTL - 300) * 1000 });
            return { url };
        }catch(e){
            why = (e && (e.message || e.error || e.name)) || "UNKNOWN";
            console.warn("[خُطى] تعذّر توقيع رابط الصورة:", path, e);
        }
    }
    return { why };
}

async function examImageUrl(path){
    return (await signExamImage(path)).url || null;
}

/* ============================================================
   عرض صورة مخزَّنة — مكوّنٌ واحد للمنشئ ولشاشة الطالب
   ------------------------------------------------------------
   (دليل المالك، الجزء الثاني §٥) ما يفعله، وسبب كلٍّ منها:
   • حالة تحميل: الغلاف .kimg يرسم هيكلاً خافتاً بارتفاعٍ ثابت حتى تصل
     الصورة — لا قفزة في الصفحة ولا مربّعاً أبيض بأيقونة مستند.
   • إعادة توقيع **مرّةً واحدة** عند فشل التحميل: اختبار مدّته ساعة، ورابطٌ
     محفوظ قد ينتهي قبل السؤال الأخير. فإن فشلت الثانية أيضاً فالخطأ حقيقي
     (ملفّ محذوف أو ممنوع) فتظهر رسالة — لا حلقة طلبات بلا نهاية.
   • علم alive: الطالب ينتقل لسؤالٍ آخر قبل وصول الرابط، فيُستبدل العنصر.
     بلا هذا الحارس يُكمل الردّ المتأخّر عمله على عنصرٍ لم يعد معروضاً.
   • loading="lazy": منشئ فيه ٤٠ سؤالاً لا يحمّل ٤٠ صورة دفعةً واحدة.
   img يحمل data-exam-img="<المسار>" ويبدأ hidden؛ onFail(img, why) للفشل.
   ============================================================ */
let kimgSeq = 0;
function mountExamImage(img, onFail){
    const path = img.getAttribute("data-exam-img");
    const token = ++kimgSeq;
    img._kimg = token;
    const alive = () => img.isConnected && img._kimg === token;
    const wrap = img.closest(".kimg");
    if(wrap) wrap.classList.add("is-loading");
    let retried = false;

    const fail = (why) => {
        if(!alive()) return;
        img._kimg = 0;
        if(wrap) wrap.classList.remove("is-loading");
        onFail(img, why);
    };
    const show = (url) => {
        if(!alive()) return;
        img.hidden = false;
        img.src = url;
    };
    img.loading = "lazy";
    img.decoding = "async";
    img.onload = () => {
        if(!alive()) return;
        img.classList.add("is-ready");
        if(wrap) wrap.classList.remove("is-loading");
    };
    img.onerror = async () => {
        if(!alive()) return;
        if(retried){ fail("IMAGE_LOAD_FAILED"); return; }
        retried = true;
        const r = await signExamImage(path, true);
        r.url ? show(r.url) : fail(r.why);
    };
    signExamImage(path).then(r => r.url ? show(r.url) : fail(r.why));
}

/** يصغّر الصورة الكبيرة قبل رفعها: صورة جوّال ٤٠٠٠ بكسل و٨ ميجا تُرفض
 *  عند حدّ الدلو (٥ ميجا)، وإن قُبلت حمّلها الطالب على جوّاله ببطء بلا
 *  فائدة — الشاشة لا تعرض أكثر من ذلك أصلاً. يحافظ على النسبة والنوع؛
 *  وأيّ تعثّر يعيد الملفّ الأصلي كما هو. GIF لا يُمسّ (قد يكون متحرّكاً). */
async function shrinkExamImage(file){
    if(!file || file.type === "image/gif" || typeof createImageBitmap !== "function") return file;
    try{
        const bmp = await createImageBitmap(file);
        const side = Math.max(bmp.width, bmp.height);
        if(side <= EXAM_IMG_MAX_SIDE && file.size <= 1.5 * 1024 * 1024){ bmp.close && bmp.close(); return file; }
        const k = Math.min(1, EXAM_IMG_MAX_SIDE / side);
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bmp.width * k));
        c.height = Math.max(1, Math.round(bmp.height * k));
        const ctx = c.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        bmp.close && bmp.close();
        const out = await new Promise(res => c.toBlob(res, file.type, 0.88));
        return (out && out.type === file.type && out.size < file.size) ? out : file;
    }catch(e){
        return file;
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
    file = await shrinkExamImage(file);
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
                    ? `<div class="exq-img kimg">
                           <img data-exam-img="${escapeHtml(q.image)}" alt="${currentLang==='ar'?'صورة السؤال':'Question image'}" hidden>
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
                            ? `<div class="exq-img exq-img-sm kimg kimg-sm">
                                   <img data-exam-img="${escapeHtml(c.image)}" alt="${currentLang==='ar'?'صورة الخيار':'Choice image'}" hidden>
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
   فلو انتظرناه لتجمّدت الواجهة عند كل ضغطة. الصورة تبقى hidden حتى يصل
   رابطها (لولا ذلك لرسمها كروم مربّعاً أبيض بأيقونة مستند)، والغلاف .kimg
   يُظهر هيكل التحميل مكانها — انظر mountExamImage. */
function hydrateExamImages(root){
    root.querySelectorAll("img[data-exam-img]").forEach(img => mountExamImage(img, (el) => {
        const box = el.closest(".exq-img");
        if(box) box.classList.add("exq-img-broken");
    }));
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

/* ============================================================
   لوحة الرسم بخطّ اليد — مبنيّة على دليل المالك (الجزء الأوّل)
   ------------------------------------------------------------
   كانت اللوحة تكتب البكسلات مباشرة على القماش، فلا تراجع، ولا ممحاة،
   وتصغير النافذة أو تدوير الجوّال يمطّ الرسم، والتصدير = لقطة القماش
   بدقّته المنخفضة. الآن:
   • الرسم **بيانات لا بكسلات**: كل خطّ نقاطٌ نسبية 0..1 من العرض والطول
     (وعرض القلم نسبةٌ من العرض أيضاً) — فيصمد أمام أي تغيّر في المقاس،
     ويُصدَّر بأي دقّة بلا تشويه.
   • paintStrokes دالّةٌ واحدة للعرض الحيّ وللتصدير معاً، فما يراه المعلّم
     هو بالضبط ما يُحفظ — نسختان من منطق الرسم تفترقان يوماً بصمت.
   • الممحاة تمحو إلى الشفافية (destination-out)، والتصدير طبقتان: الخطوط
     على طبقة شفّافة ثم تُركَّب فوق ورقة بيضاء. لو رُسم فوق الأبيض مباشرة
     لثقبت الممحاة الورقة نفسها فظهرت فجوات سوداء في الوضع الليلي.
   • الورق أبيض والحبر داكن ثابتان بلا ارتباطٍ بالسمة: الصورة تُحفظ مرّة
     وتُعرض في الوضعين، وحبرٌ فاتح يختفي تماماً على ورقٍ فاتح.
   • أحداث المؤشّر (Pointer) لإصبعٍ وقلمٍ وفأرة معاً، مع setPointerCapture
     (الخطّ لا ينقطع إن خرج الإصبع من الحافّة) و touch-action:none (السحب
     يرسم لا يمرّر الصفحة)، وتجاهل إصبعٍ ثانٍ أو راحة اليد أثناء الكتابة.
   • الحركة لا تعيد رسم كل شيء: الخطوط المكتملة مرسومة مرّةً على طبقة
     خلفية، ومع كل إطار يُضاف فوقها الخطّ الجاري وحده.
   ============================================================ */
const ED_INKS = ["#16202A", "#C0392B", "#1F5FBF"];   // داكن · أحمر للتنبيه · أزرق
const ED_ERASER_PX = 22;
const ED_MIN_STEP = 0.0015;                          // أقلّ مسافة بين نقطتين (نسبةً)

let edQi = null;                // رقم السؤال المفتوح
let edStrokes = [];             // الخطوط المكتملة
let edLive = null;              // الخطّ الجاري تحت الإصبع
let edCleared = null;           // ما مُسح بـ«مسح الكل» — ليرجع بالتراجع
let edPointer = null;           // المؤشّر الذي يرسم الآن (لا غيره)
let edTool = "pen", edInk = ED_INKS[0];
let edAspect = 760 / 420;       // نسبة العرض للطول، تُثبَّت عند الفتح
let edDirty = false;            // تغيّر منذ آخر حفظ؟
let edBase = null;              // طبقة الخطوط المكتملة
let edFrame = 0;
const edMemory = new Map();     // خطوط كل سؤال في هذه الجلسة، ليُكمل المعلّم رسمه

/** الرسم الوحيد في الملفّ — للشاشة وللتصدير. نقاطٌ وعروضٌ نسبية × المقاس. */
function paintStrokes(ctx, strokes, width, height){
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for(const s of strokes){
        if(!s || !s.points.length) continue;
        ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
        ctx.strokeStyle = s.erase ? "#000" : (s.ink || ED_INKS[0]);
        ctx.lineWidth = Math.max(1, s.w * width);
        const p0 = s.points[0];
        ctx.beginPath();
        ctx.moveTo(p0.x * width, p0.y * height);
        if(s.points.length === 1){
            // نقطة واحدة = خطّ بلا طول لا يُرسم؛ نُزيحها ذرّةً فتظهر نقطة
            ctx.lineTo(p0.x * width + 0.1, p0.y * height);
        }else if(s.points.length === 2){
            ctx.lineTo(s.points[1].x * width, s.points[1].y * height);
        }else{
            // منحنيات بين منتصفات النقاط: خطّ ناعم بدل الزوايا المكسّرة
            for(let i = 1; i < s.points.length - 1; i++){
                const a = s.points[i], b = s.points[i + 1];
                ctx.quadraticCurveTo(a.x * width, a.y * height,
                                     (a.x + b.x) / 2 * width, (a.y + b.y) / 2 * height);
            }
            const last = s.points[s.points.length - 1];
            ctx.lineTo(last.x * width, last.y * height);
        }
        ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
}

function edClamp(v){ return Math.min(1, Math.max(0, v)); }

/** موضع المؤشّر نسبةً من القماش المعروض، محصوراً في 0..1. */
function edPoint(canvas, e){
    const r = canvas.getBoundingClientRect();
    return {
        x: Math.round(edClamp((e.clientX - r.left) / (r.width  || 1)) * 10000) / 10000,
        y: Math.round(edClamp((e.clientY - r.top)  / (r.height || 1)) * 10000) / 10000,
    };
}

function edPenPx(){
    const el = document.getElementById("explain-pen-size");
    return (el && parseInt(el.value, 10)) || 4;
}

function beginStroke(canvas, p){
    const cssW = canvas.getBoundingClientRect().width || 1;
    const erase = edTool === "eraser";
    return { points: [p], erase, ink: erase ? null : edInk, w: (erase ? ED_ERASER_PX : edPenPx()) / cssW };
}

/** يضيف نقطة للخطّ — إلا إن كانت ملاصقةً للسابقة (ارتعاش لا حركة). */
function extendStroke(s, p){
    if(!s) return;
    const q = s.points[s.points.length - 1];
    if(Math.abs(p.x - q.x) < ED_MIN_STEP && Math.abs(p.y - q.y) < ED_MIN_STEP) return;
    s.points.push(p);
}

/** يضبط دقّة القماش على مقاسه الفعلي × كثافة الشاشة، ويعيد الرسم من البيانات. */
function sizeExplainCanvas(){
    const canvas = document.getElementById("explain-draw-canvas");
    if(!canvas) return;
    canvas.style.aspectRatio = String(edAspect);
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if(canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; }
    if(!edBase) edBase = document.createElement("canvas");
    edBase.width = w; edBase.height = h;
    repaintExplainBase();
}

function repaintExplainBase(){
    if(!edBase) return;
    const b = edBase.getContext("2d");
    b.clearRect(0, 0, edBase.width, edBase.height);
    paintStrokes(b, edStrokes, edBase.width, edBase.height);
    drawExplainFrame();
    updateExplainTools();
}

function drawExplainFrame(){
    edFrame = 0;
    const canvas = document.getElementById("explain-draw-canvas");
    if(!canvas || !edBase) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(edBase, 0, 0);
    if(edLive) paintStrokes(ctx, [edLive], canvas.width, canvas.height);
}

function scheduleExplainFrame(){
    if(!edFrame) edFrame = requestAnimationFrame(drawExplainFrame);
}

function updateExplainTools(){
    const undo = document.getElementById("ed-undo");
    if(undo) undo.disabled = !edStrokes.length && !edCleared;
    const clear = document.getElementById("ed-clear");
    if(clear) clear.disabled = !edStrokes.length;
    document.querySelectorAll("#explain-draw-modal [data-ed-tool]").forEach(b =>
        b.classList.toggle("is-active", b.getAttribute("data-ed-tool") === edTool));
    document.querySelectorAll("#explain-draw-modal [data-ed-ink]").forEach(b =>
        b.classList.toggle("is-active", edTool === "pen" && b.getAttribute("data-ed-ink") === edInk));
}

function setExplainTool(tool){ edTool = tool === "eraser" ? "eraser" : "pen"; updateExplainTools(); }
function setExplainInk(ink){ if(ED_INKS.includes(ink)){ edInk = ink; edTool = "pen"; } updateExplainTools(); }

function undoExplainStroke(){
    if(edStrokes.length) edStrokes.pop();
    else if(edCleared){ edStrokes = edCleared; edCleared = null; }
    edDirty = true;
    repaintExplainBase();
}

function clearExplanationCanvas(){
    if(!edStrokes.length) return;
    edCleared = edStrokes;          // «مسح الكل» يُتراجَع عنه كأي خطوة
    edStrokes = [];
    edDirty = true;
    repaintExplainBase();
}

function ensureExplainDrawModal(){
    let modal = document.getElementById("explain-draw-modal");
    if(modal) return modal;
    const ar = currentLang === 'ar';
    modal = document.createElement("div");
    modal.id = "explain-draw-modal";
    modal.className = "overlay-screen";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="wizard-card ed-card">
            <h3 style="margin-bottom:4px;"><i class="fa-solid fa-pen-nib"></i> ${ar ? 'اكتب الشرح بخط يدك' : "Write the explanation by hand"}</h3>
            <p class="card-sub" id="ed-sub" style="margin-bottom:12px;"></p>
            <div class="ed-tools" role="toolbar">
                <button type="button" class="ed-btn" data-ed-tool="pen" onclick="setExplainTool('pen')" title="${ar?'قلم':'Pen'}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="ed-btn" data-ed-tool="eraser" onclick="setExplainTool('eraser')" title="${ar?'ممحاة':'Eraser'}"><i class="fa-solid fa-eraser"></i></button>
                <span class="ed-sep"></span>
                ${ED_INKS.map(c => `<button type="button" class="ed-ink" data-ed-ink="${c}" style="--ink:${c}" onclick="setExplainInk('${c}')" aria-label="${c}"></button>`).join("")}
                <span class="ed-sep"></span>
                <label class="ed-size" title="${ar?'سُمك القلم':'Pen size'}">
                    <i class="fa-solid fa-circle" style="font-size:7px;"></i>
                    <input type="range" id="explain-pen-size" min="2" max="14" value="4">
                    <i class="fa-solid fa-circle" style="font-size:13px;"></i>
                </label>
                <span class="ed-sep"></span>
                <button type="button" class="ed-btn" id="ed-undo" onclick="undoExplainStroke()" title="${ar?'تراجع':'Undo'}"><i class="fa-solid fa-rotate-left"></i></button>
                <button type="button" class="ed-btn" id="ed-clear" onclick="clearExplanationCanvas()" title="${ar?'مسح الكل':'Clear all'}"><i class="fa-solid fa-trash-can"></i></button>
            </div>
            <canvas id="explain-draw-canvas" class="ed-canvas"></canvas>
            <div style="display:flex; gap:10px; margin-top:14px;">
                <button type="button" class="btn btn-outline btn-block acc-btn" onclick="closeExplanationDraw()">${ar ? 'إلغاء' : 'Cancel'}</button>
                <button type="button" class="btn acc-btn btn-block" id="ed-save" onclick="saveExplanationDraw()">
                    <i class="fa-solid fa-floppy-disk"></i> ${ar ? 'حفظ الشرح' : 'Save'}</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    bindExplainCanvasEvents(document.getElementById("explain-draw-canvas"));
    window.addEventListener("resize", () => { if(edQi != null) sizeExplainCanvas(); });
    document.addEventListener("keydown", (e) => {
        if(edQi == null) return;
        if(e.key === "Escape"){ e.preventDefault(); closeExplanationDraw(); }
        else if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z"){ e.preventDefault(); undoExplainStroke(); }
    });
    return modal;
}

function bindExplainCanvasEvents(canvas){
    if(!canvas || canvas.dataset.bound) return;
    canvas.dataset.bound = "1";
    canvas.addEventListener("pointerdown", (e) => {
        if(edPointer !== null) return;                       // إصبع ثانٍ أو راحة اليد
        if(e.pointerType === "mouse" && e.button !== 0) return;
        e.preventDefault();
        edPointer = e.pointerId;
        try{ canvas.setPointerCapture(e.pointerId); }catch(err){}
        edLive = beginStroke(canvas, edPoint(canvas, e));
        scheduleExplainFrame();
    });
    canvas.addEventListener("pointermove", (e) => {
        if(e.pointerId !== edPointer || !edLive) return;
        // الأحداث المدمجة: المتصفح يجمع حركات القلم السريعة في حدثٍ واحد —
        // قراءتها كلها تعطي خطّاً ناعماً بدل خطوطٍ مستقيمة متكسّرة.
        const evs = (typeof e.getCoalescedEvents === "function" && e.getCoalescedEvents()) || [];
        (evs.length ? evs : [e]).forEach(ev => extendStroke(edLive, edPoint(canvas, ev)));
        scheduleExplainFrame();
    });
    const finish = (e) => {
        if(e.pointerId !== edPointer) return;
        edPointer = null;
        try{ canvas.releasePointerCapture(e.pointerId); }catch(err){}
        if(edLive){
            edStrokes.push(edLive);
            edLive = null;
            edCleared = null;
            edDirty = true;
            repaintExplainBase();       // رفعٌ واحد عند الانتهاء، لا مع كل حركة
        }
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", finish);
}

function openExplanationDraw(qi){
    const ex = ensureExplanation(qi);
    if(!ex) return;
    const q = ensureExamDraft().questions[qi];
    edQi = qi;
    const mem = edMemory.get(q.id || qi);
    edStrokes = mem ? mem.strokes.map(s => ({ ...s, points: s.points.slice() })) : [];
    edLive = null; edCleared = null; edPointer = null; edDirty = false;
    edTool = "pen";
    // النسبة تُثبَّت عند الفتح (أعرض على الحاسوب، أطول على الجوّال) وتبقى
    // كما هي حتى لو دار الجوّال — وإلا انمطّ ما رُسم.
    edAspect = mem ? mem.aspect : (window.innerWidth < 640 ? 4 / 3.4 : 760 / 420);

    const modal = ensureExplainDrawModal();
    const sub = document.getElementById("ed-sub");
    if(sub){
        sub.textContent = (ex.image && !mem)
            ? (currentLang==='ar' ? 'للسؤال شرحٌ مرسوم سابقاً — ما ترسمه الآن يحلّ محلّه عند الحفظ.' : 'This question already has a drawing — saving replaces it.')
            : (currentLang==='ar' ? 'اكتب بإصبعك أو بقلم الشاشة. تراجَع بـ↶ أو امحُ بالممحاة، ثم احفظ.' : 'Write with a finger or stylus. Undo with ↶ or use the eraser, then save.');
    }
    modal.style.display = "flex";
    requestAnimationFrame(sizeExplainCanvas);   // المقاس الحقيقي بعد أن يظهر
}

function closeExplanationDraw(force){
    if(!force && edDirty && edStrokes.length &&
       !confirm(currentLang==='ar' ? 'لم تحفظ الرسم. إغلاق بلا حفظ؟' : 'Close without saving the drawing?')) return;
    const modal = document.getElementById("explain-draw-modal");
    if(modal) modal.style.display = "none";
    edQi = null; edLive = null; edPointer = null; edDirty = false;
    if(edFrame){ cancelAnimationFrame(edFrame); edFrame = 0; }
}

/** مقاس التصدير من القماش الفعلي × المقياس، بحدٍّ أعلى للضلع يحفظ النسبة. */
function exportSize(cssWidth, cssHeight, scale, maxSide){
    const w = Math.max(1, cssWidth) * Math.max(1, scale);
    const h = Math.max(1, cssHeight) * Math.max(1, scale);
    const shrink = Math.min(1, maxSide / Math.max(w, h));
    return { width: Math.round(w * shrink), height: Math.round(h * shrink) };
}

/** طبقتان: الخطوط على شفّاف، ثم تُركَّب فوق ورقة بيضاء. PNG. */
function strokesToPng(strokes, size){
    const layer = document.createElement("canvas");
    layer.width = size.width; layer.height = size.height;
    paintStrokes(layer.getContext("2d"), strokes, size.width, size.height);

    const sheet = document.createElement("canvas");
    sheet.width = size.width; sheet.height = size.height;
    const sctx = sheet.getContext("2d");
    sctx.fillStyle = "#FFFFFF";
    sctx.fillRect(0, 0, sheet.width, sheet.height);
    sctx.drawImage(layer, 0, 0);
    return new Promise(res => sheet.toBlob(b => res(b), "image/png"));
}

async function saveExplanationDraw(){
    const canvas = document.getElementById("explain-draw-canvas");
    const qi = edQi;
    if(qi == null || !canvas) return;
    if(!edStrokes.some(s => !s.erase)){
        showToast(currentLang==='ar' ? 'اكتب الشرح أولاً' : 'Draw something first');
        return;
    }
    const r = canvas.getBoundingClientRect();
    // مقياس ٢ على الأقل: الحاسوب كثافته ١، والطالب يراه على جوّالٍ كثافته ٣
    const size = exportSize(r.width, r.height, Math.max(2, window.devicePixelRatio || 1), EXAM_IMG_MAX_SIDE);
    const blob = await strokesToPng(edStrokes, size);
    if(!blob){ showToast(currentLang==='ar' ? 'تعذّر حفظ الرسم' : 'Could not save the drawing'); return; }

    const btn = document.getElementById("ed-save");
    if(btn) btn.disabled = true;
    showToast(currentLang==='ar' ? 'جارٍ الرفع…' : 'Uploading…');
    const path = await uploadExamImage(new File([blob], "drawing.png", { type: "image/png" }));
    if(btn) btn.disabled = false;
    if(!path) return;

    const q = ensureExamDraft().questions[qi];
    const ex = ensureExplanation(qi);
    if(!q || !ex) return;
    ex.image = path; ex.type = "drawing";
    edMemory.set(q.id || qi, { strokes: edStrokes.map(s => ({ ...s, points: s.points.slice() })), aspect: edAspect });
    closeExplanationDraw(true);
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
            ? `<div class="exq-img exq-img-explain kimg">
                   <img data-exam-img="${escapeHtml(ex.image)}" alt="${currentLang==='ar'?'شرح الحل':'Explanation'}" hidden>
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

/* ---------- اختبار أم واجب؟ ----------
   منشئ واحد للنوعين (المالك: «الواجب مبني على محرّك الاختبار»)، يُنقل
   عنصره نفسه بين تبويبَي «الاختبارات» و«الواجبات» فلا تتكرّر الواجهة ولا
   تضيع مسودّة المعلّم إن تنقّل بينهما. */
let examWorkKind = "exam";

/* وثالثها «تدريب» (المرحلة ٣ — مساحة القدرات): بلا درجات، يعيده الطالب متى
   شاء، ولا يرى المعلّم إلا عدد من اختبره. */
const EXAM_KIND_HOSTS = { exam:"sexams-builder-host", homework:"shw-builder-host", practice:"sgat-builder-host" };

function setExamWorkKind(kind){
    examWorkKind = EXAM_KIND_HOSTS[kind] ? kind : "exam";
    const wrap = document.getElementById("exam-builder-wrap");
    const host = document.getElementById(EXAM_KIND_HOSTS[examWorkKind]);
    if(wrap && host && wrap.parentElement !== host) host.appendChild(wrap);
    applyExamKindLabels();
    if(typeof loadTeacherExams === "function") loadTeacherExams();
}

/** نصوص المنشئ حسب النوع — تُعاد عند تبديل اللغة أيضاً (applySchoolSettingsUI). */
function applyExamKindLabels(){
    const hw = examWorkKind === "homework", pr = examWorkKind === "practice";
    const ar = currentLang === "ar";
    const pick = (h, p, e) => hw ? h : pr ? p : e;
    const set = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
    set("exam-title-label", pick(ar ? "عنوان الواجب" : "Homework title", ar ? "عنوان اختبار التدريب" : "Practice test title", ar ? "عنوان الاختبار" : "Exam title"));
    set("exam-save-label",  pick(ar ? "حفظ الواجب" : "Save homework", ar ? "حفظ اختبار التدريب" : "Save practice test", ar ? "حفظ الاختبار" : "Save exam"));
    const title = document.getElementById("exam-title");
    if(title) title.placeholder = pick(ar ? "واجب الدرس الثالث" : "Lesson 3 homework",
                                       ar ? "تدريب التناظر اللفظي ١" : "Verbal analogy drill 1",
                                       ar ? "اختبار الفصل الأول" : "Term 1 exam");
    const show = (id, on) => { const el = document.getElementById(id); if(el) el.style.display = on ? "" : "none"; };
    show("exam-late-wrap", hw);
    show("exam-hw-hint", hw);
    show("exam-gat-wrap", pr);
    show("exam-practice-hint", pr);
    /* التدريب يصل لكل طلاب المدرسة وليس مادة مدرسية: لا مادة ولا صفّ ولا خلط
       (قول المالك: «لماذا يوجد خانة اختيار مادة؟ … ولا يحتاج فيها ميزة خلط») */
    const group = id => { const el = document.getElementById(id); return el && (el.closest(".form-group") || el.closest("label")); };
    [group("exam-subject"), group("exam-grade"), group("exam-shuffle")].forEach(el => { if(el) el.style.display = pr ? "none" : ""; });
}

/* المواد: ما يدرّسه المعلّم أولاً (من إسناد الإدارة)، ثم بقية مواد
   المدرسة — فالمعلّم الذي يدرّس مادة واحدة لا يختار شيئاً. */
let myTeachingRows = null;

async function fillExamSubjectSelect(){
    const sel = document.getElementById("exam-subject");
    if(!sel || typeof schoolSubjectsList !== "function") return;
    if(myTeachingRows === null && sb && schoolCtx && schoolCtx.role !== "student"){
        myTeachingRows = [];
        try{
            const { data, error } = await sb.rpc("my_teaching", { p_school: schoolCtx.schoolId });
            if(error) throw error;
            myTeachingRows = data || [];
        }catch(e){ console.warn("[خُطى] تعذّر جلب موادّي:", e); }
    }
    const mine = new Set((myTeachingRows || []).map(r => r.subject_id).filter(Boolean));
    const all = schoolSubjectsList(false);
    const prev = sel.value;
    sel.textContent = "";
    const add = (value, text) => {
        const o = document.createElement("option");
        o.value = value; o.textContent = text; sel.appendChild(o);
    };
    if(!mine.size) add("", currentLang === "ar" ? "— اختر المادة —" : "— choose subject —");
    [...all.filter(x => mine.has(x.id)), ...all.filter(x => !mine.has(x.id))]
        .forEach(x => add(x.id, subjectName(x)));
    if(prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
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
    const hw = examWorkKind === "homework";
    const pr = examWorkKind === "practice";
    if(title.length < 2){
        showToast(currentLang==='ar' ? (hw ? 'اكتب عنوان الواجب' : 'اكتب عنوان الاختبار') : 'Enter a title');
        return;
    }
    const subjectId = pr ? null : (((document.getElementById("exam-subject") || {}).value || "") || null);
    const subject = subjectId ? schoolSubjectsList(true).find(x => x.id === subjectId) : null;
    /* ⚠️ الواجب بلا مادة لا يظهر في سجلّ المادة عند المعلّم ولا في ملف
       الطالب — وهو ما بُني الواجب لأجله. */
    if(hw && !subject){
        showToast(currentLang==='ar' ? 'اختر مادة الواجب' : 'Choose the subject');
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
            /* النصّ يبقى للواجهة القديمة المنشورة وللعرض؛ والمعرّف هو المرجع */
            subject: subject ? subject.name_ar : null,
            subject_id: subject ? subject.id : null,
            kind: examWorkKind,
            gat_section: pr ? ((document.getElementById("exam-gat-section") || {}).value || "mixed") : null,
            shuffle: !pr && !!(document.getElementById("exam-shuffle") || {}).checked,
            late_days: hw ? (parseInt((document.getElementById("exam-late-days") || {}).value, 10) || 0) : 0,
            grade: pr ? null : ((document.getElementById("exam-grade") || {}).value || null),
            duration_min: parseInt((document.getElementById("exam-duration") || {}).value, 10) || null,
            questions,
            published: false,
        });
        if(error) throw error;

        if(titleEl) titleEl.value = "";
        const shuf = document.getElementById("exam-shuffle"); if(shuf) shuf.checked = false;
        const lateSel = document.getElementById("exam-late-days"); if(lateSel) lateSel.value = "0";
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
