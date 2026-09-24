/* ============================================================
   37) المكتبة — كتب المدرسة ودروسها (المرحلة ٢)
   ------------------------------------------------------------
   قرارات المالك:
   • ⚖️ الكتاب الوزاري لا يُرفع إلى خُطى — شروط منصة عين تمنع إعادة النشر.
     الكتاب هنا **رابط منصة عين**، وقاعدة البيانات نفسها ترفض أي رابط آخر
     (sql/PHASE2_LIBRARY.sql).
   • وخُطى تحمل ما حوله: دروس الكتاب بصفحاتها، ورابط فيديو لكل درس،
     واختبار لكل درس، وملف من ملفات المعلّم.
   • الكتاب ملك **المدرسة**: يعدّله كل من يدرّس المادة والإدارة، ويبقى لمن
     يخلف المعلّم وللسنة القادمة.

   ⚠️ الطالب يرى زرّ «اختبار الدرس» فقط إن كان الاختبار مُرسَلاً إليه فعلاً
   (my_assigned_work) — وإلا وعدناه بشيء يُرفض عند الضغط. والملف يظهر إن
   سمحت صلاحيات teacher_files بقراءته.
   ============================================================ */

function libL(ar, en){ return currentLang === "ar" ? ar : en; }

const LIB_TERMS = { all:["كل الفصول","All terms"], t1:["الفصل الأول","Term 1"], t2:["الفصل الثاني","Term 2"], t3:["الفصل الثالث","Term 3"] };
function libTermName(t){ const x = LIB_TERMS[t]; return x ? libL(x[0], x[1]) : ""; }

let libBooks = [], libLessons = new Map(), libExamInfo = new Map(), libFileInfo = new Map();
let libAssigned = new Set(), libEditSubjects = new Set(), libMyExams = [], libMyFiles = [];
let libOpenBook = null, libEditingLesson = null, libEditingBook = null;
let libRenderedFor = null;   // العضو الذي رُسمت له المكتبة — تتغيّر ⇒ تُصفَّر الحالة

function libCanEdit(subjectId){
    if(!schoolCtx || schoolCtx.role === "student") return false;
    return schoolCtx.role === "admin" || libEditSubjects.has(subjectId);
}

function libSubjectName(id){
    const s = (typeof schoolSubjectsList === "function" ? schoolSubjectsList(true) : []).find(x => x.id === id);
    return s ? subjectName(s) : "";
}

/* الرابط من القاعدة (مفحوص هناك)، ويُهرَّب هنا أيضاً لأنه يدخل سمة href */
function libSafeHref(url){
    return /^https:\/\//i.test(String(url || "")) ? escapeHtml(url) : "";
}

async function renderLibraryTab(){
    const box = document.getElementById("lib-list");
    if(!box || !sb || !schoolCtx) return;
    box.innerHTML = `<p class="card-sub">${libL("جارٍ التحميل…", "Loading…")}</p>`;
    try{
        await loadLibraryData();
        renderLibraryFilters();
        renderLibraryEditor();
        renderLibraryList();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل المكتبة:", e);
        box.innerHTML = `<p class="card-sub">${escapeHtml((typeof schoolError === "function")
            ? schoolError(e, libL("تحميل المكتبة", "loading the library")) : libL("تعذّر تحميل المكتبة.", "Could not load."))}</p>`;
    }
}

async function loadLibraryData(){
    /* ⚠️ لا يبقى شيء من مستخدم سابق في الذاكرة: صلاحيات تعديله، وفلاتره،
       والكتاب المفتوح (كشفه فحص تبديل الأدوار: ظهر المحرّر للطالب). */
    const who = `${schoolCtx.memberId}|${schoolCtx.role}`;
    if(libRenderedFor !== who){
        libRenderedFor = who;
        libEditSubjects = new Set(); libMyExams = []; libMyFiles = []; libAssigned = new Set();
        libOpenBook = null; libEditingBook = null; libEditingLesson = null;
        const f = document.getElementById("lib-filters"); if(f) f.innerHTML = "";
    }
    const [books, lessons] = await Promise.all([
        sb.from("school_books").select("id, subject_id, grade, term, title, ein_url, sort_order")
            .order("sort_order").order("title").limit(500),
        sb.from("school_lessons").select("id, book_id, title, pages, video_url, exam_id, file_id, sort_order")
            .order("sort_order").order("created_at").limit(3000),
    ]);
    if(books.error) throw books.error;
    if(lessons.error) throw lessons.error;
    libBooks = books.data || [];
    libLessons = new Map();
    (lessons.data || []).forEach(l => {
        if(!libLessons.has(l.book_id)) libLessons.set(l.book_id, []);
        libLessons.get(l.book_id).push(l);
    });
    // الترتيب هنا أيضاً لا في الخادم وحده: الترقيم وتبديل الأسهم يعتمدان عليه
    libLessons.forEach(list => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

    const examIds = [...new Set((lessons.data || []).map(l => l.exam_id).filter(Boolean))];
    const fileIds = [...new Set((lessons.data || []).map(l => l.file_id).filter(Boolean))];
    const jobs = [];
    // العناوين: ما تسمح الصلاحيات بقراءته فقط — وما لا يُقرأ لا يُعرض
    if(examIds.length) jobs.push(sb.from("teacher_exams").select("id, title, kind").in("id", examIds)
        .then(r => { libExamInfo = new Map((r.data || []).map(x => [x.id, x])); }));
    else libExamInfo = new Map();
    if(fileIds.length) jobs.push(sb.from("teacher_files").select("id, title").in("id", fileIds)
        .then(r => { libFileInfo = new Map((r.data || []).map(x => [x.id, x])); }));
    else libFileInfo = new Map();

    if(schoolCtx.role === "student"){
        jobs.push(sb.rpc("my_assigned_work", { p_school: schoolCtx.schoolId })
            .then(r => { libAssigned = new Set((r.data || []).map(w => w.exam_id)); }));
    }else{
        if(schoolCtx.role === "teacher") jobs.push(sb.rpc("my_teaching", { p_school: schoolCtx.schoolId })
            .then(r => { libEditSubjects = new Set((r.data || []).map(x => x.subject_id).filter(Boolean)); }));
        // ما يربطه المحرّر بالدرس: اختباراته وملفاته (الإدارة: الكل — كما تسمح الصلاحيات)
        jobs.push(sb.from("teacher_exams").select("id, title, kind").order("created_at", { ascending:false }).limit(200)
            .then(r => { libMyExams = r.data || []; }));
        jobs.push(sb.from("teacher_files").select("id, title, owner_id").order("created_at", { ascending:false }).limit(200)
            .then(r => { libMyFiles = r.data || []; }));
    }
    await Promise.all(jobs);
}

function renderLibraryFilters(){
    const box = document.getElementById("lib-filters");
    if(!box) return;
    const prevG = (document.getElementById("lib-grade") || {}).value;
    const prevS = (document.getElementById("lib-subject") || {}).value;
    const grades = (typeof schoolGradesList === "function") ? schoolGradesList() : [];
    const usedSubjects = [...new Set(libBooks.map(b => b.subject_id))];
    box.innerHTML = `<div class="input-row">
        <div class="form-group"><label>${libL("المرحلة", "Grade")}</label>
            <select id="lib-grade" onchange="renderLibraryList()">
                <option value="">${libL("كل المراحل", "All grades")}</option>
                ${grades.map(g => `<option value="${escapeHtml(g.code)}">${escapeHtml(gradeName(g.code))}</option>`).join("")}
            </select></div>
        <div class="form-group"><label>${libL("المادة", "Subject")}</label>
            <select id="lib-subject" onchange="renderLibraryList()">
                <option value="">${libL("كل المواد", "All subjects")}</option>
                ${usedSubjects.map(id => `<option value="${escapeHtml(id)}">${escapeHtml(libSubjectName(id))}</option>`).join("")}
            </select></div>
    </div>`;
    const g = document.getElementById("lib-grade"), s = document.getElementById("lib-subject");
    // الطالب يبدأ بمرحلته
    if(prevG !== undefined) g.value = prevG;
    else if(schoolCtx.role === "student" && schoolCtx.grade) g.value = schoolCtx.grade;
    if(prevS !== undefined && [...s.options].some(o => o.value === prevS)) s.value = prevS;
}

/* ---------- إضافة كتاب / تعديله ---------- */
function renderLibraryEditor(){
    const box = document.getElementById("lib-editor");
    if(!box) return;
    const subjects = (typeof schoolSubjectsList === "function" ? schoolSubjectsList(false) : []).filter(s => libCanEdit(s.id));
    if(schoolCtx.role === "student" || !subjects.length){
        box.innerHTML = schoolCtx.role === "teacher" && !subjects.length
            ? `<p class="hint">${libL("تضيف كتب المادة التي أسندتها لك الإدارة — لم تُسنَد لك مادة بعد.",
                                      "You can add books for subjects assigned to you — none yet.")}</p>` : "";
        return;
    }
    const b = libEditingBook ? libBooks.find(x => x.id === libEditingBook) : null;
    const grades = (typeof schoolGradesList === "function") ? schoolGradesList() : [];
    box.innerHTML = `
    <details class="exq-import" ${b ? "open" : ""}>
        <summary>${b ? libL("تعديل الكتاب", "Edit book") : libL("أضف كتاباً", "Add a book")}</summary>
        <div class="uni-note" style="margin:10px 0;">
            <b>${libL("⚖️ لا ترفع نسخة الكتاب", "⚖️ Don't upload the book")}</b>
            <p style="margin:6px 0 0;">${libL(
                "الكتاب الوزاري ملك وزارة التعليم، وشروط منصة عين تمنع إعادة نشره. ضع رابطه من منصة عين، وأضف دروسه وشرحك واختباراتك هنا.",
                "Ministry books can't be republished. Paste the book's link from the Ein platform; add lessons, videos and quizzes here.")}</p>
        </div>
        <div class="input-row">
            <div class="form-group"><label>${libL("عنوان الكتاب", "Title")}</label>
                <input type="text" id="lib-b-title" maxlength="160" placeholder="${libL("الرياضيات ٣ — الفصل الأول", "Math 3 — Term 1")}" value="${b ? escapeHtml(b.title) : ""}"></div>
            <div class="form-group"><label>${libL("المادة", "Subject")}</label>
                <select id="lib-b-subject">${subjects.map(s => `<option value="${escapeHtml(s.id)}" ${b && b.subject_id === s.id ? "selected" : ""}>${escapeHtml(subjectName(s))}</option>`).join("")}</select></div>
        </div>
        <div class="input-row">
            <div class="form-group"><label>${libL("المرحلة", "Grade")}</label>
                <select id="lib-b-grade">${grades.map(g => `<option value="${escapeHtml(g.code)}" ${b && String(b.grade) === String(g.code) ? "selected" : ""}>${escapeHtml(gradeName(g.code))}</option>`).join("")}</select></div>
            <div class="form-group"><label>${libL("الفصل الدراسي", "Term")}</label>
                <select id="lib-b-term">${Object.keys(LIB_TERMS).map(t => `<option value="${t}" ${b && b.term === t ? "selected" : ""}>${escapeHtml(libTermName(t))}</option>`).join("")}</select></div>
        </div>
        <div class="form-group"><label>${libL("رابط الكتاب في منصة عين", "Ein platform link")}</label>
            <input type="url" id="lib-b-url" dir="ltr" placeholder="https://ien.edu.sa/…" value="${b && b.ein_url ? escapeHtml(b.ein_url) : ""}">
            <p class="hint">${libL("يُقبل رابط منصة عين (ien.edu.sa) أو بوابات الوزارة فقط.", "Only ien.edu.sa or moe.gov.sa links.")}</p></div>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" id="lib-b-save" class="btn acc-btn" onclick="saveLibraryBook()"><i class="fa-solid fa-floppy-disk"></i> ${libL("حفظ الكتاب", "Save book")}</button>
            ${b ? `<button type="button" class="btn btn-outline acc-btn" onclick="cancelLibraryBookEdit()">${libL("إلغاء", "Cancel")}</button>` : ""}
        </div>
    </details>`;
}

function libValidEinUrl(u){
    return /^https:\/\/([a-z0-9-]+\.)*(ien\.edu\.sa|moe\.gov\.sa)(\/|$)/i.test(u);
}

async function saveLibraryBook(){
    const val = id => ((document.getElementById(id) || {}).value || "").trim();
    const title = val("lib-b-title"), url = val("lib-b-url");
    if(title.length < 2){ showToast(libL("اكتب عنوان الكتاب", "Enter a title")); return; }
    if(url && !libValidEinUrl(url)){
        showToast(libL("الرابط يجب أن يكون من منصة عين (ien.edu.sa) — لا يُرفع الكتاب ولا يُربط بموقع آخر.", "Link must be from ien.edu.sa."));
        return;
    }
    const row = { title, subject_id: val("lib-b-subject"), grade: val("lib-b-grade"), term: val("lib-b-term") || "all", ein_url: url || null };
    const btn = document.getElementById("lib-b-save");
    schoolBusy(btn, true);
    try{
        const q = libEditingBook
            ? sb.from("school_books").update(row).eq("id", libEditingBook)
            : sb.from("school_books").insert(Object.assign({ school_id: schoolCtx.schoolId, created_by: schoolCtx.memberId }, row));
        const { error } = await q;
        if(error) throw error;
        showToast(libL("حُفظ الكتاب ✅", "Saved ✅"));
        libEditingBook = null;
        await renderLibraryTab();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ الكتاب:", e);
        showSchoolError(e, libL("حفظ الكتاب", "saving the book"));
    }finally{ schoolBusy(btn, false); }
}

function editLibraryBook(id){ libEditingBook = id; renderLibraryEditor(); document.getElementById("lib-editor").scrollIntoView({ behavior:"smooth" }); }
function cancelLibraryBookEdit(){ libEditingBook = null; renderLibraryEditor(); }

async function deleteLibraryBook(id){
    const b = libBooks.find(x => x.id === id);
    const n = (libLessons.get(id) || []).length;
    if(!b || !confirm(libL(`حذف «${b.title}» ودروسه (${n})؟ لا يمسّ الاختبارات والملفات المربوطة.`, "Delete this book and its lessons?"))) return;
    try{
        const { error } = await sb.from("school_books").delete().eq("id", id);
        if(error) throw error;
        await renderLibraryTab();
    }catch(e){ console.error("[خُطى] تعذّر حذف الكتاب:", e); showSchoolError(e, libL("الحذف", "the delete")); }
}

/* ---------- القائمة ---------- */
function renderLibraryList(){
    const box = document.getElementById("lib-list");
    if(!box) return;
    const g = (document.getElementById("lib-grade") || {}).value || "";
    const s = (document.getElementById("lib-subject") || {}).value || "";
    const books = libBooks.filter(b => (!g || String(b.grade) === g) && (!s || b.subject_id === s));
    if(!books.length){
        box.innerHTML = `<p class="card-sub">${libBooks.length
            ? libL("لا كتب تطابق الاختيار.", "No books match.")
            : libL("لم تُضف كتب بعد.", "No books yet.")}</p>`;
        return;
    }
    box.innerHTML = books.map(renderLibraryBook).join("");
}

function renderLibraryBook(b){
    const lessons = libLessons.get(b.id) || [];
    const edit = libCanEdit(b.subject_id);
    const open = libOpenBook === b.id;
    const href = libSafeHref(b.ein_url);
    return `<div class="lib-book">
        <div class="lib-book-head">
            <div class="lib-book-main">
                <i class="fa-solid fa-book"></i>
                <div><b>${escapeHtml(b.title)}</b>
                    <div class="card-sub">${escapeHtml(libSubjectName(b.subject_id))} · ${escapeHtml(gradeName(b.grade))}${b.term !== "all" ? " · " + escapeHtml(libTermName(b.term)) : ""} · ${lessons.length} ${libL("درساً", "lessons")}</div></div>
            </div>
            <div class="sfile-actions">
                ${href ? `<a class="btn btn-sm acc-btn" href="${href}" target="_blank" rel="noopener noreferrer">
                    <i class="fa-solid fa-up-right-from-square"></i> ${libL("الكتاب في منصة عين", "Open on Ein")}</a>` : ""}
                <button type="button" class="btn btn-outline btn-sm" onclick="toggleLibraryBook('${escapeHtml(b.id)}')">
                    <i class="fa-solid fa-list"></i> ${open ? libL("إخفاء الدروس", "Hide lessons") : libL("الدروس", "Lessons")}</button>
                ${edit ? `<button type="button" class="btn btn-ghost btn-sm" onclick="editLibraryBook('${escapeHtml(b.id)}')" title="${libL("تعديل", "Edit")}"><i class="fa-solid fa-pen"></i></button>
                    <button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose);" onclick="deleteLibraryBook('${escapeHtml(b.id)}')" title="${libL("حذف", "Delete")}"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
        </div>
        ${open ? `<div class="lib-lessons">
            ${lessons.length ? lessons.map((l, i) => renderLibraryLesson(b, l, i, lessons.length, edit)).join("")
                             : `<p class="card-sub">${libL("لا دروس بعد.", "No lessons yet.")}</p>`}
            ${edit ? renderLessonForm(b) : ""}
        </div>` : ""}
    </div>`;
}

function renderLibraryLesson(b, l, i, n, edit){
    const student = schoolCtx.role === "student";
    const exam = l.exam_id ? libExamInfo.get(l.exam_id) : null;
    const file = l.file_id ? libFileInfo.get(l.file_id) : null;
    const video = libSafeHref(l.video_url);
    // الطالب: الاختبار إن أُرسل إليه فقط. المعلّم: يرى الربط ليتأكّد منه.
    const showExam = l.exam_id && (student ? libAssigned.has(l.exam_id) : true);
    return `<div class="lib-lesson">
        <div class="lib-lesson-main">
            <span class="lib-num">${i + 1}</span>
            <div><b>${escapeHtml(l.title)}</b>${l.pages ? `<div class="card-sub">${escapeHtml(l.pages)}</div>` : ""}</div>
        </div>
        <div class="sfile-actions">
            ${video ? `<a class="btn btn-outline btn-sm" href="${video}" target="_blank" rel="noopener noreferrer"><i class="fa-solid fa-circle-play"></i> ${libL("الشرح", "Video")}</a>` : ""}
            ${showExam ? (student
                ? `<button type="button" class="btn btn-sm acc-btn" onclick="openStudentExam('${escapeHtml(l.exam_id)}')"><i class="fa-solid fa-pen-to-square"></i> ${libL("اختبار الدرس", "Lesson quiz")}</button>`
                : `<span class="pill" title="${escapeHtml(exam ? exam.title : "")}"><i class="fa-solid fa-clipboard-question"></i> ${escapeHtml(exam ? exam.title : libL("اختبار", "quiz"))}</span>`) : ""}
            ${file ? `<button type="button" class="btn btn-outline btn-sm" onclick="openTeacherFile('${escapeHtml(l.file_id)}')"><i class="fa-solid fa-file"></i> ${escapeHtml(file.title)}</button>` : ""}
            ${edit ? `
                <button type="button" class="btn btn-ghost btn-sm" ${i === 0 ? "disabled" : ""} onclick="moveLibraryLesson('${escapeHtml(l.id)}', -1)" title="${libL("أعلى", "Up")}"><i class="fa-solid fa-arrow-up"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" ${i === n - 1 ? "disabled" : ""} onclick="moveLibraryLesson('${escapeHtml(l.id)}', 1)" title="${libL("أسفل", "Down")}"><i class="fa-solid fa-arrow-down"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="editLibraryLesson('${escapeHtml(l.id)}')" title="${libL("تعديل", "Edit")}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose);" onclick="deleteLibraryLesson('${escapeHtml(l.id)}')" title="${libL("حذف", "Delete")}"><i class="fa-solid fa-trash"></i></button>` : ""}
        </div>
    </div>`;
}

function renderLessonForm(b){
    const l = libEditingLesson ? (libLessons.get(b.id) || []).find(x => x.id === libEditingLesson) : null;
    const opt = (list, sel, label) => `<option value="">${label}</option>` + list.map(x =>
        `<option value="${escapeHtml(x.id)}" ${sel === x.id ? "selected" : ""}>${escapeHtml(x.title || "")}${x.kind === "homework" ? libL(" (واجب)", " (homework)") : ""}</option>`).join("");
    return `<div class="lib-lesson-form">
        <b>${l ? libL("تعديل الدرس", "Edit lesson") : libL("أضف درساً", "Add a lesson")}</b>
        <div class="input-row">
            <div class="form-group"><label>${libL("عنوان الدرس", "Lesson title")}</label>
                <input type="text" id="lib-l-title" maxlength="160" value="${l ? escapeHtml(l.title) : ""}"></div>
            <div class="form-group"><label>${libL("الصفحات (اختياري)", "Pages (optional)")}</label>
                <input type="text" id="lib-l-pages" maxlength="40" placeholder="${libL("ص ١٢–١٨", "p. 12–18")}" value="${l && l.pages ? escapeHtml(l.pages) : ""}"></div>
        </div>
        <div class="form-group"><label>${libL("رابط فيديو الشرح (اختياري)", "Video link (optional)")}</label>
            <input type="url" id="lib-l-video" dir="ltr" placeholder="https://youtu.be/…" value="${l && l.video_url ? escapeHtml(l.video_url) : ""}"></div>
        <div class="input-row">
            <div class="form-group"><label>${libL("اختبار الدرس (اختياري)", "Lesson quiz (optional)")}</label>
                <select id="lib-l-exam">${opt(libMyExams, l && l.exam_id, libL("— بلا اختبار —", "— none —"))}</select></div>
            <div class="form-group"><label>${libL("ملف (اختياري)", "File (optional)")}</label>
                <select id="lib-l-file">${opt(libMyFiles, l && l.file_id, libL("— بلا ملف —", "— none —"))}</select></div>
        </div>
        <p class="hint">${libL("الاختبار يظهر للطالب في الدرس بعد أن ترسله له من «الاختبارات» أو «الواجبات».",
            "Students see the quiz here once you send it to them.")}</p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button type="button" id="lib-l-save" class="btn acc-btn" onclick="saveLibraryLesson('${escapeHtml(b.id)}')"><i class="fa-solid fa-plus"></i> ${l ? libL("حفظ الدرس", "Save lesson") : libL("أضف الدرس", "Add lesson")}</button>
            ${l ? `<button type="button" class="btn btn-outline acc-btn" onclick="cancelLibraryLessonEdit()">${libL("إلغاء", "Cancel")}</button>` : ""}
        </div>
    </div>`;
}

function toggleLibraryBook(id){
    libOpenBook = libOpenBook === id ? null : id;
    libEditingLesson = null;
    renderLibraryList();
}

async function saveLibraryLesson(bookId){
    const val = id => ((document.getElementById(id) || {}).value || "").trim();
    const title = val("lib-l-title"), video = val("lib-l-video");
    if(!title){ showToast(libL("اكتب عنوان الدرس", "Enter a lesson title")); return; }
    if(video && !/^https:\/\/[^\s<>"]+$/i.test(video)){ showToast(libL("رابط الفيديو يجب أن يبدأ بـ https://", "Video link must start with https://")); return; }
    const row = { title, pages: val("lib-l-pages") || null, video_url: video || null,
                  exam_id: val("lib-l-exam") || null, file_id: val("lib-l-file") || null };
    const btn = document.getElementById("lib-l-save");
    schoolBusy(btn, true);
    try{
        let q;
        if(libEditingLesson) q = sb.from("school_lessons").update(row).eq("id", libEditingLesson);
        else{
            const list = libLessons.get(bookId) || [];
            const next = list.length ? Math.max(...list.map(x => x.sort_order || 0)) + 1 : 0;
            q = sb.from("school_lessons").insert(Object.assign({ book_id: bookId, school_id: schoolCtx.schoolId,
                created_by: schoolCtx.memberId, sort_order: next }, row));
        }
        const { error } = await q;
        if(error) throw error;
        libEditingLesson = null;
        libOpenBook = bookId;
        await renderLibraryTab();
    }catch(e){
        console.error("[خُطى] تعذّر حفظ الدرس:", e);
        showSchoolError(e, libL("حفظ الدرس", "saving the lesson"));
    }finally{ schoolBusy(btn, false); }
}

function editLibraryLesson(id){ libEditingLesson = id; renderLibraryList(); }
function cancelLibraryLessonEdit(){ libEditingLesson = null; renderLibraryList(); }

async function deleteLibraryLesson(id){
    if(!confirm(libL("حذف هذا الدرس؟", "Delete this lesson?"))) return;
    try{
        const { error } = await sb.from("school_lessons").delete().eq("id", id);
        if(error) throw error;
        await renderLibraryTab();
    }catch(e){ console.error("[خُطى] تعذّر حذف الدرس:", e); showSchoolError(e, libL("الحذف", "the delete")); }
}

/* الترتيب: يُعاد ترقيم دروس الكتاب كلّها ٠،١،٢… — فلا تتعادل أرقام قديمة */
async function moveLibraryLesson(id, dir){
    let bookId = null;
    libLessons.forEach((list, b) => { if(list.some(x => x.id === id)) bookId = b; });
    const list = [...(libLessons.get(bookId) || [])];
    const i = list.findIndex(x => x.id === id), j = i + dir;
    if(i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    try{
        const changed = list.map((x, k) => ({ x, k })).filter(({ x, k }) => x.sort_order !== k);
        const results = await Promise.all(changed.map(({ x, k }) => sb.from("school_lessons").update({ sort_order: k }).eq("id", x.id)));
        const bad = results.find(r => r && r.error);
        if(bad) throw bad.error;
        await renderLibraryTab();
    }catch(e){ console.error("[خُطى] تعذّر الترتيب:", e); showSchoolError(e, libL("الترتيب", "reordering")); }
}
