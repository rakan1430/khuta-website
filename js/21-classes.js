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
                    <button type="button" class="btn btn-outline btn-sm" onclick="deleteSchoolClass('${escapeHtml(c.id)}')">
                        <i class="fa-solid fa-trash"></i></button>
                </div>`).join("");
        }

        // كل قائمة فصول في الموقع تُملأ من هنا
        if(typeof loadSchoolClasses === "function") await loadSchoolClasses();
        fillClassPickers();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل الفصول:", e);
        box.innerHTML = `<p class="card-sub">${currentLang==='ar'?'تعذّر تحميل الفصول.':'Could not load classes.'}</p>`;
    }
}

/** يملأ قوائم اختيار الفصل أينما كانت (إسناد الطلاب والمعلّمين). */
function fillClassPickers(){
    ["member-class-select", "teacher-class-select"].forEach(id => {
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
        showToast(schoolWriteError(e));
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
        showToast(schoolWriteError(e));
    }
}

/* ---------- إسناد عضو إلى فصل ---------- */

let assignTargetMember = null;

async function openAssignClass(memberId, memberName, role){
    if(!sb || !schoolCtx) return;
    assignTargetMember = { id: memberId, name: memberName, role };
    const modal = document.getElementById("assign-class-modal");
    if(!modal) return;
    modal.style.display = "flex";
    const who = document.getElementById("assign-class-who");
    if(who) who.textContent = memberName || "";

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
        showToast(schoolWriteError(e));
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
        showToast(schoolWriteError(e));
    }
}

/** رسالة خطأ مفهومة بدل "تعذّر" المبهمة — أكثر أخطاء الكتابة سببها الجلسة المحدودة. */
function schoolWriteError(e){
    const raw = (e && (e.message || e.hint)) || "";
    if(/google|amr|row-level|policy|42501/i.test(raw)){
        return currentLang==='ar'
            ? 'هذه العملية تتطلّب تأكيد هويتك بحساب Google — اضغط "تأكيد بحساب Google" في الأعلى.'
            : 'This action requires confirming with Google.';
    }
    if(/duplicate|23505/i.test(raw)){
        return currentLang==='ar' ? 'موجود مسبقاً' : 'Already exists';
    }
    return currentLang==='ar' ? 'تعذّر تنفيذ العملية' : 'Action failed';
}
