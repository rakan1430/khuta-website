/* ============================================================
   فحص إرسال الاختبار: الموعد، وكشف الإجابات، والمؤقّت
   ------------------------------------------------------------
   هذا ما لا يستطيع المالك ملاحظته اليوم: ما الذي يُكتب فعلاً في قاعدة
   البيانات حين يضغط المعلّم "إرسال"؟ الواجهة تقول "أُرسل ✅" في كل حال،
   فلا يكشف الفرقَ إلا اعتراضُ الطلبات وقراءتها.

   ⚠️ وأهمّ ما يفحصه عطلٌ كان صامتاً تماماً: الإدخال في PostgreSQL ذرّة
   واحدة. فلو أرسل المعلّم لفصلٍ سبق أن أرسل له وفصلٍ جديد معه، رفع
   الصفُّ القديم خطأ التكرار 23505 — وكانت الشفرة تتجاهله باعتباره
   "إعادة إرسال طبيعية" — فتتراجع العملية بأكملها، بما فيها الفصل
   الجديد. ويرى المعلّم "أُرسل ✅"، وطلاب الفصل الجديد لا اختبار عندهم،
   ولا أحد يعلم. لا سبيل لملاحظته إلا بفحصٍ كهذا.

   ⚠️ وبديل قاعدة البيانات هنا يُسجّل كل طلبٍ ويردّ ردّ PostgREST نفسه —
   بما فيه رفع 23505 على صفٍّ مكرَّر، وإفشالُ الدفعة كلّها كما يفعل
   Postgres حقاً. ولولا محاكاة الذرّية هذه لمرّ العطل في الفحص أيضاً.
   ============================================================ */

let chromium;
try{ ({ chromium } = require("playwright")); }
catch(e){
    console.log("⚠️  هذا الفحص يحتاج متصفّحاً حقيقياً. ثبّته أولاً:\n    npm install playwright --no-save");
    process.exit(2);
}
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;

function ok(name, cond, detail){
    if(cond){ pass++; console.log("  ✅ " + name); }
    else{ fail++; console.log("  ❌ " + name + (detail ? "\n       " + detail : "")); }
}

const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
               ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png",
               ".webmanifest":"application/manifest+json", ".ico":"image/x-icon" };

function serve(){
    return new Promise(resolve => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split("?")[0]);
            if(p === "/") p = "/index.html";
            const file = path.join(ROOT, p);
            if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){
                res.writeHead(404); res.end("no"); return;
            }
            res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
            res.end(fs.readFileSync(file));
        });
        srv.listen(0, "127.0.0.1", () => resolve(srv));
    });
}

const EXAM = "11111111-1111-1111-1111-111111111111";
const CLASS_OLD = "aaaaaaaa-0000-0000-0000-000000000001";   // أُرسل له من قبل
const CLASS_NEW = "bbbbbbbb-0000-0000-0000-000000000002";   // جديد

/* ============================================================
   بديل عميل Supabase — سلسلةُ استدعاءات قابلة للانتظار
   ============================================================ */
function installStub(){
    window.__log = [];
    /* الصف الموجود مسبقاً: هو مصدر خطأ التكرار */
    window.__assignments = [{ exam_id: window.__EXAM, class_id: window.__CLASS_OLD,
                              grade: null, student_id: null, due_at: "2020-01-01T00:00:00Z" }];
    window.__exam = { id: window.__EXAM, timed:false, duration_min:null,
                      reveal_mode:"after_due", published:false };

    const key = r => `${r.class_id || ""}|${r.grade || ""}|${r.student_id || ""}`;

    function builder(table){
        const q = { table, op:null, payload:null, filters:[] };
        const self = {
            select(){ q.op = q.op || "select"; return self; },
            insert(rows){ q.op = "insert"; q.payload = rows; return self; },
            update(patch){ q.op = "update"; q.payload = patch; return self; },
            delete(){ q.op = "delete"; return self; },
            eq(c, v){ q.filters.push(["eq", c, v]); return self; },
            in(c, v){ q.filters.push(["in", c, v]); return self; },
            order(){ return self; },
            limit(){ return self; },
            maybeSingle(){ q.single = true; return self; },
            single(){ q.single = true; return self; },
            then(res, rej){ return run(q).then(res, rej); },
        };
        return self;
    }

    function matches(row, filters){
        return filters.every(([kind, col, val]) =>
            kind === "eq" ? row[col] === val : Array.isArray(val) && val.includes(row[col]));
    }

    async function run(q){
        window.__log.push(JSON.parse(JSON.stringify(q)));

        if(q.table === "school_members") return { data: [], error: null };

        if(q.table === "teacher_exams"){
            if(q.op === "select"){
                return { data: q.single ? { ...window.__exam } : [ { ...window.__exam } ], error:null };
            }
            if(q.op === "update"){ Object.assign(window.__exam, q.payload); return { data:null, error:null }; }
        }

        if(q.table === "exam_assignments"){
            if(q.op === "select"){
                return { data: window.__assignments.map(r => ({
                    class_id:r.class_id, grade:r.grade, student_id:r.student_id })), error:null };
            }
            if(q.op === "insert"){
                const rows = Array.isArray(q.payload) ? q.payload : [q.payload];
                const have = new Set(window.__assignments.map(key));
                /* ⚠️ الذرّية: صفٌّ واحد مكرَّر يُبطل الدفعة كلّها — كما يفعل
                   Postgres تماماً. وهذا بيت القصيد في هذا الفحص. */
                if(rows.some(r => have.has(key(r)))){
                    return { data:null, error:{ code:"23505", message:"duplicate key value violates unique constraint" } };
                }
                rows.forEach(r => window.__assignments.push({ ...r }));
                return { data:null, error:null };
            }
            if(q.op === "update"){
                window.__assignments.forEach(r => {
                    if(matches(r, q.filters)) Object.assign(r, q.payload);
                });
                return { data:null, error:null };
            }
        }
        return { data:null, error:null };
    }

    sb = {                                  // ← معجمي، لا window.sb
        from: builder,
        rpc: async (name, args) => {
            window.__log.push({ rpc:name, args });
            if(name === "enqueue_exam_notifications") return { data: 3, error:null };
            return { data:null, error:null };
        },
    };

    schoolCtx = { schoolId:"s", memberId:"m", role:"teacher", fullName:"معلّم تجريبي" };
    schoolClasses = [
        { id: window.__CLASS_OLD, name:"أول/١", grade:"1", section:"أ" },
        { id: window.__CLASS_NEW, name:"أول/٢", grade:"1", section:"ب" },
    ];
    window.__toasts = [];
    showToast = (m) => window.__toasts.push(String(m));
    loadTeacherExams = () => {};
    loadSchoolClasses = async () => {};
}

async function main(){
    const srv = await serve();
    const port = srv.address().port;
    const guesses = [
        process.env.CHROMIUM_PATH,
        ...(fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
            .filter(d => d.startsWith("chromium"))
            .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")) : []),
    ].filter(p => p && fs.existsSync(p));
    const browser = await chromium.launch(guesses.length ? { executablePath: guesses[0] } : {});
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));

    try{
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"load" });
        await page.waitForFunction(() => typeof confirmExamSend === "function", { timeout:15000 });
        await page.evaluate(({ e, co, cn }) => {
            window.__EXAM = e; window.__CLASS_OLD = co; window.__CLASS_NEW = cn;
        }, { e:EXAM, co:CLASS_OLD, cn:CLASS_NEW });
        await page.evaluate(installStub);

        /* ---------- ١) الافتراضات ---------- */
        console.log("\nالافتراضات حين يفتح المعلّم النافذة");
        await page.evaluate(async (id) => { await openExamSend(id); }, EXAM);
        const defaults = await page.evaluate(() => ({
            reveal: document.getElementById("exam-send-reveal").value,
            timed: document.getElementById("exam-send-timed").checked,
            due: document.getElementById("exam-send-due").value,
            durHidden: document.getElementById("exam-send-duration-wrap").offsetParent === null,
        }));
        ok("كشف الإجابات افتراضاً بعد موعد التسليم", defaults.reveal === "after_due", defaults.reveal);
        ok("المؤقّت مطفأ افتراضاً (الاختبار واجب لا حصّة)", defaults.timed === false);
        ok("ومدّة المؤقّت مخفيّة ما دام مطفأً", defaults.durHidden);
        ok("لا موعد تسليم مفروض", defaults.due === "");

        /* ---------- ٢) مدّة غير صالحة تُوقف الإرسال ---------- */
        console.log("\nالتحقّق من الإدخال");
        const bad = await page.evaluate(async (cid) => {
            toggleExamPick("classes", cid);
            document.getElementById("exam-send-timed").checked = true;
            document.getElementById("exam-send-duration").value = "0";
            const before = window.__log.length;
            await confirmExamSend();
            return { wrote: window.__log.length - before, toast: window.__toasts.slice(-1)[0] };
        }, CLASS_NEW);
        ok("مدّة صفر لا تُرسِل شيئاً إلى قاعدة البيانات", bad.wrote === 0, `طلبات: ${bad.wrote}`);
        ok("ويُقال للمعلّم السبب", /دقيقة/.test(bad.toast || ""), bad.toast);

        const badDate = await page.evaluate(async () => {
            document.getElementById("exam-send-timed").checked = false;
            const r = readExamSendSettings();
            return { err: r.error || null, dueNull: r.dueAt === null };
        });
        ok("بلا مؤقّت يعود الإدخال صالحاً", badDate.err === null, String(badDate.err));
        ok("وموعد فارغ يعني «بلا موعد» لا خطأً", badDate.dueNull);

        /* ---------- ٣) العطل الصامت: فصل قديم + فصل جديد ---------- */
        console.log("\nإرسال لفصلٍ سبق أن أُرسل له وفصلٍ جديد معه");
        const send = await page.evaluate(async ({ co, cn }) => {
            examSendPicked = { classes:new Set([co, cn]), grades:new Set(), students:new Set() };
            document.getElementById("exam-send-due").value = "2026-10-01T13:30";
            document.getElementById("exam-send-reveal").value = "after_due";
            document.getElementById("exam-send-timed").checked = false;
            window.__log = [];
            await confirmExamSend();
            return {
                assignments: window.__assignments,
                exam: window.__exam,
                toast: window.__toasts.slice(-1)[0],
                inserts: window.__log.filter(l => l.op === "insert"),
            };
        }, { co:CLASS_OLD, cn:CLASS_NEW });

        const forNew = send.assignments.filter(a => a.class_id === CLASS_NEW);
        const forOld = send.assignments.filter(a => a.class_id === CLASS_OLD);
        ok("الفصل الجديد وصله الاختبار فعلاً (العطل الصامت)",
           forNew.length === 1, JSON.stringify(send.assignments));
        ok("ولم يتكرّر صفّ الفصل القديم", forOld.length === 1);
        ok("والإدخال حمل الجديد وحده لا الاثنين",
           send.inserts.length === 1 && send.inserts[0].payload.length === 1,
           JSON.stringify(send.inserts.map(i => i.payload)));

        /* الموعد بتوقيت المتصفّح: ١:٣٠ ظهراً في الرياض = 10:30Z.
           ⚠️ وتُقرأ القيمتان بحذر: لو سقط الصفّ (كما في العطل أعلاه) فلا
           نريد أن ينهار الفحص فيُخفي بقيّة الملاحظات. */
        const expected = new Date("2026-10-01T13:30").toISOString();
        ok("موعد التسليم كُتب على الفصل الجديد",
           !!forNew[0] && forNew[0].due_at === expected,
           `${forNew[0] && forNew[0].due_at} ≠ ${expected}`);
        ok("وصُحِّح على الفصل القديم أيضاً (لا يبقى موعد إرسالٍ سابق)",
           !!forOld[0] && forOld[0].due_at === expected,
           String(forOld[0] && forOld[0].due_at));
        ok("الاختبار نُشر", send.exam.published === true);
        ok("ووضع كشف الإجابات كُتب كما اختاره المعلّم",
           send.exam.reveal_mode === "after_due", send.exam.reveal_mode);
        ok("والمؤقّت مطفأ بلا مدّة معلّقة",
           send.exam.timed === false && send.exam.duration_min === null,
           JSON.stringify({ t:send.exam.timed, d:send.exam.duration_min }));
        ok("ويُقال للمعلّم إنه أُرسل", /أُرسل/.test(send.toast || ""), send.toast);

        /* ---------- ٤) المؤقّت حين يشغّله المعلّم ---------- */
        console.log("\nحين يشغّل المعلّم المؤقّت");
        const timed = await page.evaluate(async ({ cn, id }) => {
            /* الإرسال الناجح يُغلق النافذة ويُصفّر examSendTarget — فلا بدّ
               من فتحها من جديد كما يفعل المعلّم تماماً */
            await openExamSend(id);
            examSendPicked = { classes:new Set([cn]), grades:new Set(), students:new Set() };
            document.getElementById("exam-send-timed").checked = true;
            document.getElementById("exam-send-duration").value = "45";
            document.getElementById("exam-send-reveal").value = "immediately";
            await confirmExamSend();
            return window.__exam;
        }, { cn:CLASS_NEW, id:EXAM });
        ok("المدّة تُكتب كما أدخلها", timed.timed === true && timed.duration_min === 45,
           JSON.stringify({ t:timed.timed, d:timed.duration_min }));
        ok("و«فور التسليم» يُكتب حين يختاره صراحةً", timed.reveal_mode === "immediately");

        /* ---------- ٥) ما يُعرض عند إعادة الفتح ---------- */
        console.log("\nإعادة فتح النافذة تُظهر الإعداد الحالي");
        const reopened = await page.evaluate(async (id) => {
            await openExamSend(id);
            return {
                reveal: document.getElementById("exam-send-reveal").value,
                timed: document.getElementById("exam-send-timed").checked,
                dur: document.getElementById("exam-send-duration").value,
                due: document.getElementById("exam-send-due").value,
                durShown: document.getElementById("exam-send-duration-wrap").offsetParent !== null,
            };
        }, EXAM);
        ok("يرى المعلّم وضع الكشف الذي اختاره سابقاً", reopened.reveal === "immediately", reopened.reveal);
        ok("ويرى المؤقّت مشغّلاً بمدّته", reopened.timed === true && reopened.dur === "45");
        ok("وحقل المدّة ظاهر تبعاً له", reopened.durShown);
        ok("والموعد يبدأ فارغاً (صفةُ إرسالٍ لا صفةُ اختبار)", reopened.due === "");

        console.log("\nوحدة التحكّم");
        ok("لا خطأ جافاسكربت طوال الفحص", errors.length === 0, errors.join("\n       "));

    }catch(e){
        fail++;
        console.log("  ❌ تعطّل الفحص نفسه: " + (e && e.stack || e));
    }finally{
        await browser.close();
        srv.close();
    }

    console.log(`\n=== النتيجة: ${pass} ناجح، ${fail} فاشل ===`);
    process.exit(fail ? 1 : 0);
}

console.log("=== فحص إرسال الاختبار وإعداداته ===");
main();
