/* ============================================================
   إدارة الفصول وإسناد الطلاب والمعلّمين
   ------------------------------------------------------------
   ⚠️ هذا القسم كان غائباً تماماً، وغيابه هو السبب الحقيقي لعدّة أعطال بدت
   منفصلة في التجربة:
     • "اختيار الفصل في الجدول الدراسي معطّل" — القائمة فارغة لأن لا فصول.
     • الطالب لا يرى ملفات معلّميه — الرؤية مبنية على عضوية الفصل.
     • المعلّم لا يجد فصولاً يرسل لها اختباراً.
   كلها عرَض واحد: لا وجود لفصل في النظام ولا طريقة لإنشائه.

   وطلب المالك أن تكون الشعبة إجبارية لا اختيارية: "في أول ثانوي هناك أكثر
   من فصل أ ب ج… فستكون إجباري وليس اختياري، حتى عند إضافة طالب جديد يجب
   تحديد فصله تحديداً حتى لا تحدث لخبطة". وهذا صحيح عملياً: طالب بلا فصل
   لا يراه معلّموه ولا تصله اختباراتهم، ولا يظهر خطأ يشرح السبب.
   ============================================================ */

let adminClasses = [];

function classLabel(c){
    const g = (typeof gradeText === "function") ? gradeText(c.grade) : c.grade;
    return `${c.name} — ${g}${c.section ? " / " + c.section : ""}`;
}

async function loadAdminClasses(){
    const box = document.getElementById("admin-classes-list");
    if(!box || !sb || !schoolCtx) return;
    box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'جارٍ التحميل…':'Loading…'}</p>`;
    try{
        const { data, error } = await sb.from("classes")
            .select("id, name, grade, section")
            .eq("school_id", schoolCtx.schoolId)
            .order("grade").order("section").limit(300);
        if(error) throw error;
        adminClasses = data || [];

        if(!adminClasses.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'
                ? 'لا فصول بعد. أنشئ فصلاً واحداً على الأقل — بدونه لا يعمل الجدول الدراسي ولا يرى الطلاب ملفات معلّميهم.'
                : 'No classes yet. Create at least one.'}</p>`;
        }else{
            // عدد الطلاب في كل فصل — رقم يكشف الفصول الفارغة بلمحة
            let counts = {};
            try{
                const { data: cs } = await sb.from("class_students").select("class_id");
                (cs || []).forEach(r => { counts[r.class_id] = (counts[r.class_id] || 0) + 1; });
            }catch(e){}

            box.innerHTML = adminClasses.map(c => `
                <div class="member-row">
                    <div>
                        <b>${escapeHtml(c.name)}</b>
                        <div class="card-sub">${escapeHtml(gradeText(c.grade))}${c.section ? " · " + (currentLang==='ar'?'شعبة ':'Section ') + escapeHtml(c.section) : ""}
                            · ${counts[c.id] || 0} ${currentLang==='ar'?'طالب':'students'}</div>
                    </div>
                    <div class="sfile-actions">
                        <button type="button" class="btn btn-outline btn-sm" onclick="openClassReport('${escapeHtml(c.id)}')">
                            <i class="fa-solid fa-file-lines"></i> ${currentLang==='ar'?'تقرير':'Report'}</button>
                        <button type="button" class="btn btn-outline btn-sm" onclick="deleteSchoolClass('${escapeHtml(c.id)}')">
                            <i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>`).join("");
        }

        // كل قائمة فصول في الموقع تُملأ من هنا
        if(typeof loadSchoolClasses === "function") await loadSchoolClasses();
        fillClassPickers();
        fillSectionFilter();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الفصول:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الفصول.':'Could not load classes.'}</p>`;
    }
}

/** يملأ قوائم اختيار الفصل أينما كانت (إسناد الطلاب والمعلّمين). */
/* ⚠️ كان "bulk-class-select" ناقصاً من هذه القائمة — وهذا كل السبب.
   وصف المالك: "عند تحديد طلاب والضغط على مربع نقل لتحديد شعبة… المربع لا
   يكون واضحاً أبداً ولا تظهر الخيارات". ولم يكن غامضاً ولا مشكلةَ ألوان:
   كان **فارغاً تماماً** لأن أحداً لم يملأه، فتموت ميزة النقل الجماعي كلها
   عند أول استعمال. (أنا كتبتُ الميزة ونسيتُ وصل قائمتها.) */
function fillClassPickers(){
    ["member-class-select", "teacher-class-select", "bulk-class-select"].forEach(id => {
        const sel = document.getElementById(id);
        if(!sel) return;
        const prev = sel.value;
        sel.textContent = "";
        if(!adminClasses.length){
            const o = document.createElement("option");
            o.value = ""; o.textContent = currentLang==='ar' ? "— لا فصول بعد —" : "— no classes —";
            sel.appendChild(o);
            return;
        }
        // سطر إرشادي في شريط النقل: ألّا يُنقل أحد بالخطأ لأول فصل في القائمة
        if(id === "bulk-class-select"){
            const hint = document.createElement("option");
            hint.value = ""; hint.disabled = true; hint.selected = true;
            hint.textContent = currentLang==='ar' ? "اختر الفصل المقصود…" : "Pick target class…";
            sel.appendChild(hint);
        }
        adminClasses.forEach(c => {
            const o = document.createElement("option");
            o.value = c.id; o.textContent = classLabel(c);
            sel.appendChild(o);
        });
        if(prev) sel.value = prev;
    });
}

async function addSchoolClass(){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    const nameEl    = document.getElementById("class-name");
    const gradeEl   = document.getElementById("class-grade");
    const sectionEl = document.getElementById("class-section");
    const name    = (nameEl.value || "").trim();
    const section = (sectionEl.value || "").trim();
    const grade   = gradeEl.value;

    // ⚠️ الشعبة إجبارية بطلب المالك: "أول ثانوي" وحده لا يكفي لتمييز فصل
    // عن فصل، وطالبٌ في الفصل الخطأ لا يظهر له خطأ — يرى فراغاً فقط.
    if(!section){
        showToast(currentLang==='ar' ? 'اكتب الشعبة (أ، ب، ج…) — إجبارية' : 'Section is required');
        sectionEl.focus(); return;
    }
    const finalName = name || `${gradeText(grade)} / ${section}`;

    const btn = document.getElementById("class-add-btn");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.from("classes").insert({
            school_id: schoolCtx.schoolId, name: finalName, grade, section,
        });
        if(error) throw error;
        nameEl.value = ""; sectionEl.value = "";
        showToast(currentLang==='ar' ? 'أُضيف الفصل ✅' : 'Class added ✅');
        loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّر إضافة الفصل:", e);
        showSchoolError(e, currentLang==='ar'?'العملية':'the action');
    }finally{ schoolBusy(btn, false); }
}

async function deleteSchoolClass(id){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    if(!confirm(currentLang==='ar'
        ? "حذف هذا الفصل؟ سيفقد طلابه ارتباطهم به، ولن يروا ملفات معلّميه بعدها."
        : "Delete this class? Its students lose their link to it.")) return;
    try{
        const { error } = await sb.from("classes").delete().eq("id", id);
        if(error) throw error;
        loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّر حذف الفصل:", e);
        showSchoolError(e, currentLang==='ar'?'العملية':'the action');
    }
}

/* ---------- إسناد عضو إلى فصل ---------- */

let assignTargetMember = null;

async function openAssignClass(memberId){
    if(!sb || !schoolCtx) return;
    // الاسم والدور من الذاكرة لا من سمة onclick — انظر التعليق في 13-school.js
    const m = (typeof schoolMembersCache !== "undefined") ? schoolMembersCache.get(memberId) : null;
    if(!m){ showToast(currentLang==='ar' ? 'حدّث القائمة ثم أعد المحاولة' : 'Refresh the list first'); return; }
    assignTargetMember = { id: memberId, name: m.full_name, role: m.role };
    const modal = document.getElementById("assign-class-modal");
    if(!modal) return;
    modal.style.display = "flex";
    const who = document.getElementById("assign-class-who");
    if(who) who.textContent = `${m.full_name} — ${schoolRoleLabel(m.role)}`;
    // المادة تخصّ المعلّم وحده — إظهارها للطالب يربك ويطلب ما لا لزوم له
    const subjGroup = document.getElementById("assign-subject-group");
    if(subjGroup) subjGroup.style.display = (m.role === "teacher") ? "block" : "none";

    if(!adminClasses.length) await loadAdminClasses(); else fillClassPickers();
    await renderAssignedClasses();
}

function closeAssignClass(){
    assignTargetMember = null;
    const modal = document.getElementById("assign-class-modal");
    if(modal) modal.style.display = "none";
}

async function renderAssignedClasses(){
    const box = document.getElementById("assign-class-current");
    if(!box || !assignTargetMember) return;
    const table = assignTargetMember.role === "student" ? "class_students" : "class_teachers";
    const col   = assignTargetMember.role === "student" ? "student_id" : "teacher_id";
    try{
        const { data, error } = await sb.from(table)
            .select("class_id").eq(col, assignTargetMember.id);
        if(error) throw error;
        const ids = (data || []).map(r => r.class_id);
        if(!ids.length){
            box.innerHTML = `<p class="card-sub">${currentLang==='ar'
                ? '⚠️ غير مسنَد لأي فصل — لن يرى شيئاً حتى تُسنِده.'
                : '⚠️ Not assigned to any class yet.'}</p>`;
            return;
        }
        box.innerHTML = ids.map(id => {
            const c = adminClasses.find(x => x.id === id);
            return `<div class="member-row">
                <b>${escapeHtml(c ? classLabel(c) : id)}</b>
                <button type="button" class="btn btn-outline btn-sm" onclick="unassignClass('${escapeHtml(id)}')">
                    <i class="fa-solid fa-xmark"></i></button>
            </div>`;
        }).join("");
    }catch(e){
        console.error("[خُطى] تعذّر قراءة الإسناد:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر التحميل.':'Could not load.'}</p>`;
    }
}

async function assignMemberToClass(){
    if(!sb || !assignTargetMember) return;
    const sel = document.getElementById("member-class-select");
    const classId = sel && sel.value;
    if(!classId){ showToast(currentLang==='ar' ? 'أنشئ فصلاً أولاً' : 'Create a class first'); return; }

    const btn = document.getElementById("assign-class-btn");
    schoolBusy(btn, true);
    try{
        if(assignTargetMember.role === "student"){
            const { error } = await sb.from("class_students")
                .insert({ class_id: classId, student_id: assignTargetMember.id });
            if(error && error.code !== "23505") throw error;
        }else{
            const subjEl = document.getElementById("assign-subject");
            const subject = (subjEl && subjEl.value || "").trim();
            if(!subject){
                showToast(currentLang==='ar' ? 'اكتب المادة التي يدرّسها' : 'Enter the subject');
                schoolBusy(btn, false); return;
            }
            const { error } = await sb.from("class_teachers")
                .insert({ class_id: classId, teacher_id: assignTargetMember.id, subject });
            if(error && error.code !== "23505") throw error;
        }
        showToast(currentLang==='ar' ? 'تم الإسناد ✅' : 'Assigned ✅');
        renderAssignedClasses();
        loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّر الإسناد:", e);
        showSchoolError(e, currentLang==='ar'?'العملية':'the action');
    }finally{ schoolBusy(btn, false); }
}

async function unassignClass(classId){
    if(!sb || !assignTargetMember) return;
    const table = assignTargetMember.role === "student" ? "class_students" : "class_teachers";
    const col   = assignTargetMember.role === "student" ? "student_id" : "teacher_id";
    try{
        const { error } = await sb.from(table).delete()
            .eq("class_id", classId).eq(col, assignTargetMember.id);
        if(error) throw error;
        renderAssignedClasses();
        loadAdminClasses();
    }catch(e){
        console.error("[خُطى] تعذّر إلغاء الإسناد:", e);
        showSchoolError(e, currentLang==='ar'?'العملية':'the action');
    }
}

/* ============================================================
   الفرز والنقل الجماعي
   ------------------------------------------------------------
   طلب المالك: "المطلوب القدرة على فرز الطلاب وشعبهم… ونقل طلاب من شعبة
   لشعبة عند الحاجة… لا مانع من نقل جماعي أو تحديد عدد من الطلاب".

   ⚠️ والنقل نفسه في قاعدة البيانات لا هنا: عمليتان (فكّ القديم وربط
   الجديد) لو نُفّذتا من المتصفح واحدةً واحدةً وانقطع الاتصال في المنتصف
   لبقي نصف الطلاب بلا فصل — لا يرون شيئاً ولا يعرف أحد لماذا.
   ============================================================ */

let memberFilter = { role:"", grade:"", section:"", q:"" };
const selectedStudents = new Set();

function setMemberFilter(key, value){
    memberFilter[key] = value;
    selectedStudents.clear();          // التحديد يخصّ قائمة بعينها
    if(typeof loadSchoolMembers === "function") loadSchoolMembers();
}

/** يطبّق الفرز على قائمة الأعضاء قبل عرضها. */
function filterMembers(list){
    const f = memberFilter;
    const q = (f.q || "").trim().toLowerCase();
    return (list || []).filter(m => {
        if(f.role && m.role !== f.role) return false;
        if(f.grade && String(m.grade || "") !== f.grade) return false;
        if(f.section && (m.section || "").trim().toLowerCase() !== f.section.trim().toLowerCase()) return false;
        if(q && !(m.full_name || "").toLowerCase().includes(q)
             && !(m.email || "").toLowerCase().includes(q)) return false;
        return true;
    });
}

function toggleStudentPick(id, on){
    if(on) selectedStudents.add(id); else selectedStudents.delete(id);
    updateBulkBar();
}

function toggleAllStudents(on){
    document.querySelectorAll(".member-pick").forEach(cb => {
        cb.checked = on;
        if(on) selectedStudents.add(cb.value); else selectedStudents.delete(cb.value);
    });
    updateBulkBar();
}

function updateBulkBar(){
    const bar = document.getElementById("bulk-move-bar");
    const count = document.getElementById("bulk-move-count");
    if(!bar) return;
    bar.style.display = selectedStudents.size ? "flex" : "none";
    if(count){
        count.textContent = currentLang==='ar'
            ? `${selectedStudents.size} طالباً محدَّداً`
            : `${selectedStudents.size} selected`;
    }
    fillClassPickers();
}

/** ينقل المحدَّدين إلى فصل واحد. */
async function bulkMoveStudents(replace){
    if(!sb || !schoolCtx || schoolCtx.role !== "admin") return;
    const sel = document.getElementById("bulk-class-select");
    const classId = sel && sel.value;
    if(!classId){ showToast(currentLang==='ar' ? 'اختر الفصل المقصود' : 'Pick a class'); return; }
    if(!selectedStudents.size) return;

    const ids = [...selectedStudents];
    const cls = adminClasses.find(c => c.id === classId);
    const label = cls ? classLabel(cls) : "";
    if(!confirm(currentLang==='ar'
        ? (replace ? `نقل ${ids.length} طالباً إلى "${label}"؟ سيُفكّ ارتباطهم بفصولهم الحالية.`
                   : `إسناد ${ids.length} طالباً إلى "${label}" مع إبقاء فصولهم الحالية؟`)
        : `Move ${ids.length} students?`)) return;

    const btn = document.getElementById("bulk-move-btn");
    schoolBusy(btn, true);
    try{
        const { error } = await sb.rpc("move_students_to_class", {
            p_students: ids, p_class: classId, p_replace: !!replace,
        });
        if(error) throw error;
        showToast(currentLang==='ar' ? `تم نقل ${ids.length} طالباً ✅` : `Moved ${ids.length} ✅`);
        selectedStudents.clear();
        loadSchoolMembers();
        loadAdminClasses();
    }catch(e){
        showSchoolError(e, currentLang==='ar' ? 'نقل الطلاب' : 'moving students');
    }finally{ schoolBusy(btn, false); }
}

/** يملأ قائمة الشعب في شريط الفرز من الفصول الموجودة فعلاً. */
function fillSectionFilter(){
    const sel = document.getElementById("filter-section");
    if(!sel) return;
    const prev = sel.value;
    const sections = [...new Set(adminClasses.map(c => (c.section || "").trim()).filter(Boolean))].sort();
    sel.textContent = "";
    const any = document.createElement("option");
    any.value = ""; any.textContent = currentLang==='ar' ? "كل الشعب" : "All sections";
    sel.appendChild(any);
    sections.forEach(s => {
        const o = document.createElement("option");
        o.value = s; o.textContent = s;
        sel.appendChild(o);
    });
    if(prev) sel.value = prev;
}
