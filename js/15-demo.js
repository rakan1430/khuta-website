/* ============================================================
   15) وضع العرض التجريبي — لتقديم المنصة للإدارة قبل التفعيل الحقيقي
   ------------------------------------------------------------
   الغرض: عرض المنصة كاملة (مدرّس/طالب/إدارة) على شاشة أمام إدارة المدرسة
   دون حساب ولا قاعدة بيانات ولا تسجيل دخول. البيانات هنا وهمية تماماً
   وتعيش في الذاكرة فقط — لا تُحفظ ولا تُرسل إلى أي مكان.

   ⚠️⚠️ شرطان معاً لتفعيله، وكلاهما إلزامي:
     1) أن يكون العنوان رابط "معاينة" من Netlify (deploy-preview أو رابط
        دائم لنشرة بعينها). أي أن العنوان الحقيقي للموقع لا يُفعّله أبداً.
     2) أن يُكتب ?demo=1 صراحةً في الرابط.

   لماذا هذا التشدّد؟ لأن هذا الوضع يتخطّى تسجيل الدخول. لو أمكن تفعيله على
   الموقع الحقيقي لصار باباً خلفياً يفتحه أي شخص بإضافة كلمة للرابط. الحصر
   في روابط المعاينة يجعله مستحيلاً على العنوان الذي يستعمله الطلاب.

   ➡️ عند الاستغناء عنه: احذف هذا الملف وسطره من index.html وsw.js فقط.
   ============================================================ */

function isNetlifyPreviewHost(){
    const h = (location.hostname || "").toLowerCase();
    // روابط المعاينة في Netlify تأخذ أحد شكلين:
    //   deploy-preview-22--site.netlify.app   (معاينة طلب دمج)
    //   <deploy-id>--site.netlify.app         (رابط دائم لنشرة بعينها)
    // كلاهما يحوي "--" قبل اسم الموقع، والعنوان الحقيقي لا يحويها إطلاقاً.
    return h.endsWith(".netlify.app") && h.includes("--");
}

function isDemoMode(){
    try{
        if(!isNetlifyPreviewHost()) return false;
        return new URLSearchParams(location.search).get("demo") === "1";
    }catch(e){ return false; }
}

/* ── بيانات العرض: واقعية بما يكفي ليفهم الحاضرون الفكرة فوراً ── */
const DEMO_TODAY = new Date();
function demoDateOf(weekday){
    const d = new Date(DEMO_TODAY);
    d.setDate(DEMO_TODAY.getDate() - DEMO_TODAY.getDay() + weekday);
    return d.toISOString().slice(0, 10);
}

const DEMO_DATA = {
    classes: [
        { id:"C1", name:"أول ثانوي - أ", grade:"1", section:"أ" },
        { id:"C2", name:"أول ثانوي - ب", grade:"1", section:"ب" },
        { id:"C3", name:"ثاني ثانوي - أ", grade:"2", section:"أ" },
    ],
    teacher_files: [
        { id:"F1", title:"ملزمة الوحدة الثالثة — المتتاليات", subject:"الرياضيات", grade:"1",
          storage_path:"demo/f1.pdf", external_url:null, size_bytes:1843200, shared:true,
          owner_id:"M1", created_at:new Date().toISOString() },
        { id:"F2", title:"كتاب الرياضيات — المسار الوطني", subject:"الرياضيات", grade:"1",
          storage_path:null, external_url:"https://ien.edu.sa", size_bytes:null, shared:true,
          owner_id:"M1", created_at:new Date().toISOString() },
        { id:"F3", title:"أوراق عمل إضافية", subject:"الرياضيات", grade:"2",
          storage_path:"demo/f3.pdf", external_url:null, size_bytes:524288, shared:true,
          owner_id:"M1", created_at:new Date().toISOString() },
    ],
    teacher_links: [
        { id:"L1", label:"منصة مدرستي", url:"https://schools.madrasati.sa", icon:"fa-graduation-cap", sort_order:0, shared:true, owner_id:"M1" },
        { id:"L2", label:"بوابة عين التعليمية", url:"https://ien.edu.sa", icon:"fa-book", sort_order:1, shared:true, owner_id:"M1" },
        { id:"L3", label:"عرض الوحدة الثالثة", url:"https://example.com/unit3.pdf", icon:"fa-file-powerpoint", sort_order:2, shared:true, owner_id:"M1" },
        { id:"L4", label:"قناة الشرح المرئي", url:"https://youtube.com", icon:"fa-video", sort_order:3, shared:true, owner_id:"M1" },
        { id:"L5", label:"نماذج اختبارات سابقة", url:"https://example.com/exams", icon:"fa-file-lines", sort_order:4, shared:true, owner_id:"M1" },
    ],
    timetable: [
        { id:"P1", weekday:0, period_no:1, subject:"الرياضيات", room:"ب-12", class_id:"C1" },
        { id:"P2", weekday:0, period_no:3, subject:"الفيزياء",  room:"ب-14", class_id:"C1" },
        { id:"P3", weekday:1, period_no:2, subject:"الرياضيات", room:"ب-12", class_id:"C1" },
        { id:"P4", weekday:1, period_no:5, subject:"اللغة العربية", room:"أ-3", class_id:"C1" },
        { id:"P5", weekday:2, period_no:1, subject:"الكيمياء",  room:"معمل 2", class_id:"C1" },
        { id:"P6", weekday:2, period_no:4, subject:"الرياضيات", room:"ب-12", class_id:"C1" },
        { id:"P7", weekday:3, period_no:2, subject:"الأحياء",   room:"معمل 1", class_id:"C1" },
        { id:"P8", weekday:4, period_no:1, subject:"الرياضيات", room:"ب-12", class_id:"C1" },
    ],
    day_notes: [
        { id:"N1", on_date: demoDateOf(1), kind:"reminder", text:"تسليم واجب الوحدة الثانية", color:null },
        { id:"N2", on_date: demoDateOf(3), kind:"highlight", text:null, color:"#C9A227" },
        { id:"N3", on_date: demoDateOf(3), kind:"note", text:"مراجعة شاملة قبل الاختبار", color:null },
    ],
    teacher_exams: [
        { id:"X1", title:"اختبار الوحدة الثانية", subject:"الرياضيات", grade:"1",
          questions:new Array(10).fill(0), published:true, owner_id:"M1", created_at:new Date().toISOString() },
        { id:"X2", title:"اختبار قصير — المتتاليات", subject:"الرياضيات", grade:"1",
          questions:new Array(5).fill(0), published:false, owner_id:"M1", created_at:new Date().toISOString() },
    ],
    account_requests: [
        { id:"R1", full_name:"عبدالله محمد الشمري", role_wanted:"student", grade:"1", section:"أ",
          contact:"05xxxxxxxx", note:null, status:"pending", created_at:new Date().toISOString() },
        { id:"R2", full_name:"خالد سعد المطيري", role_wanted:"teacher", grade:null, section:null,
          contact:"khaled@example.com", note:"أدرّس الفيزياء للصف الثاني", status:"pending", created_at:new Date().toISOString() },
    ],
    school_members: [
        { id:"M1", full_name:"أحمد العتيبي", role:"teacher", grade:null, section:null, active:true },
        { id:"M2", full_name:"سارة القحطاني", role:"teacher", grade:null, section:null, active:true },
        { id:"M3", full_name:"محمد الدوسري", role:"student", grade:"1", section:"أ", active:true },
        { id:"M4", full_name:"نورة الزهراني", role:"student", grade:"1", section:"أ", active:true },
        { id:"M5", full_name:"فهد الحربي", role:"student", grade:"1", section:"ب", active:false },
    ],
};

/* عميل وهمي بنفس شكل عميل Supabase. الكتابة تعدّل الذاكرة فقط، فيستطيع
   الحاضر أن يجرّب الإضافة والحذف ويرى النتيجة حيّة دون أن يُحفظ شيء. */
function makeDemoClient(){
    const store = JSON.parse(JSON.stringify(DEMO_DATA));
    // الاستعلامات الحقيقية تُرشّح بـschool_id، فنضعه على كل صف وإلا عادت
    // القوائم فارغة أمام الحضور (وقع هذا فعلاً في أول تجربة للوحة الإدارة).
    Object.keys(store).forEach(t => store[t].forEach(r => { r.school_id = "DEMO-SCHOOL"; }));
    let seq = 100;

    function table(name){
        const rows = () => store[name] || [];
        const api = {
            _filters: [],
            select(){ return api; },
            eq(col, val){ api._filters.push([col, val]); return api; },
            order(){ return api; },
            limit(){ return Promise.resolve({ data: api._apply(), error:null }); },
            maybeSingle(){ return Promise.resolve({ data: api._apply()[0] || null, error:null }); },
            _apply(){
                return rows().filter(r => api._filters.every(([c, v]) => r[c] === v || v === undefined));
            },
            insert(row){
                if(name === "teacher_links" && rows().filter(r => r.owner_id === row.owner_id).length >= 9){
                    return Promise.resolve({ error:{ message:"LINKS_LIMIT_REACHED" } });
                }
                store[name] = rows().concat([Object.assign({ id:"D" + (seq++) }, row)]);
                return Promise.resolve({ error:null });
            },
            update(patch){
                const p = Promise.resolve({ error:null });
                p.eq = (c, v) => { store[name] = rows().map(r => r[c] === v ? Object.assign({}, r, patch) : r); return Promise.resolve({ error:null }); };
                return p;
            },
            delete(){
                const p = { eq:(c, v) => { store[name] = rows().filter(r => r[c] !== v); return Promise.resolve({ error:null }); } };
                return p;
            },
        };
        return api;
    }

    return {
        __demo: true,
        from: table,
        rpc: async (fn) => fn === "school_id_by_slug" ? { data:"DEMO-SCHOOL", error:null } : { data:0, error:null },
        auth: {
            getUser: async () => ({ data:{ user:{ id:"DEMO-USER", is_anonymous:false } } }),
            getSession: async () => ({ data:{ session:null } }),
            onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
            signOut: async () => ({ error:null }),
        },
        storage: {
            from: () => ({
                upload: async () => ({ error:null }),
                createSignedUrl: async () => ({ data:{ signedUrl:"#" }, error:null }),
                remove: async () => ({ error:null }),
            }),
        },
    };
}

const DEMO_ROLES = {
    admin:   { memberId:"M1", fullName:"إدارة مدارس المتقدمة", grade:null, section:null },
    teacher: { memberId:"M1", fullName:"أحمد العتيبي",        grade:null, section:null },
    student: { memberId:"M3", fullName:"محمد الدوسري",        grade:"1",  section:"أ" },
};

function switchDemoRole(role){
    if(!isDemoMode() || !DEMO_ROLES[role]) return;
    const r = DEMO_ROLES[role];
    schoolCtx = { schoolId:"DEMO-SCHOOL", memberId:r.memberId, role, fullName:r.fullName, grade:r.grade, section:r.section };
    localStorage.setItem("khuta_name", r.fullName);
    if(typeof updateWelcomeText === "function") updateWelcomeText();
    applySchoolRoleUI();
    document.querySelectorAll(".demo-role-btn").forEach(b => {
        b.classList.toggle("is-on", b.getAttribute("data-role") === role);
    });
    switchTab(role === "admin" ? "schooladmin" : "schoolwork");
    window.scrollTo(0, 0);
}

function buildDemoBar(){
    const bar = document.createElement("div");
    bar.className = "demo-bar";
    bar.innerHTML = `
        <span class="demo-tag"><i class="fa-solid fa-eye"></i> عرض تجريبي</span>
        <span class="demo-hint">بيانات وهمية للعرض فقط — لا تُحفظ</span>
        <span class="demo-roles">
            <button type="button" class="demo-role-btn is-on" data-role="teacher" onclick="switchDemoRole('teacher')">مدرّس</button>
            <button type="button" class="demo-role-btn" data-role="student" onclick="switchDemoRole('student')">طالب</button>
            <button type="button" class="demo-role-btn" data-role="admin" onclick="switchDemoRole('admin')">إدارة</button>
        </span>`;
    document.body.appendChild(bar);
    document.body.classList.add("has-demo-bar");
}

function startDemoMode(){
    if(!isDemoMode()) return;
    try{
        // نستبدل العميل الحقيقي بالوهمي قبل أي قراءة، فلا يُلمس أي خادم
        sb = makeDemoClient();
        window.sb = sb;

        // نتخطّى شاشات الدخول ونُعلن أن الجلسة جاهزة
        ["login-overlay", "school-gate-overlay", "setup-overlay", "intro-overlay"].forEach(id => {
            const el = document.getElementById(id);
            if(el) el.style.display = "none";
        });
        const loading = document.getElementById("app-loading-screen");
        if(loading) loading.classList.add("hidden");

        buildDemoBar();
        switchDemoRole("teacher");
        console.log("[خُطى] وضع العرض التجريبي مُفعَّل — لا اتصال بأي قاعدة بيانات.");
    }catch(e){
        console.error("[خُطى] تعذّر تشغيل وضع العرض:", e);
    }
}

// ننتظر استقرار الواجهة: منطق الإقلاع يُظهر شاشة الدخول بعد جلب البيانات،
// فلو بدأنا قبله لأعادها فوقنا. التأخير هنا بعد اكتمال دورة الإقلاع.
if(isDemoMode()){
    if(document.readyState === "complete") setTimeout(startDemoMode, 400);
    else window.addEventListener("load", () => setTimeout(startDemoMode, 400));
}

/* ============================================================
   ⚠️ آخر سطر في آخر ملف — صرف أحداث المصادقة المؤجَّلة
   ------------------------------------------------------------
   نُقل إلى هنا من js/14-school-work.js لأن هذا صار آخر ملف يُحمَّل.
   القاعدة ثابتة: الصرف بعد اكتمال كل التعريفات، وإلا وصل حدث دخول قبل
   تعريف دالة يحتاجها فسقطت معالجة الدخول (خلل وقع فعلاً في الإنتاج).
   ➡️ إن أضفت ملفاً بعد هذا، انقل السطر إلى نهايته.
   ============================================================ */
if(typeof flushPendingAuthEvents === "function") flushPendingAuthEvents();
