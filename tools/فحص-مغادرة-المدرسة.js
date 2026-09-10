/* ============================================================
   فحص واجهة مغادرة المدرسة
   ------------------------------------------------------------
   ⚠️ زرّان متجاوران يفعلان شيئين مختلفين تماماً:

     المعلّم يغادر → لا يضيع شيء، تنتقل اختباراته وملفاته إلى الإدارة.
     الطالب يُنقل  → تُحذف محاولاته من سجلّ المدرسة حذفاً لا رجعة فيه.

   ولو تشابه الزرّان في الشكل والنصّ لضغط المديرُ الثاني بخفّة الأول.
   فهذا الفحص يقيس **الفرق** بينهما: الأرقام، واللون، والتأكيد الثاني،
   وأن يُقال في الحالتين إن حساب خُطى باقٍ — وهو شرط المالك الصريح.

   ومنطقُ النقل والحذف كلّه في قاعدة البيانات وقد فُحص هناك بعمليّات
   حقيقية: انتقلت اختبارات المعلّم إلى الإدارة ولم يُحذف اختبار واحد،
   وبقيت محاولات طلابه، وبقي حساب الطالب المنقول في خُطى.
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
               ".json":"application/json", ".png":"image/png" };

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
    const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));

    try{
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"load" });
        await page.waitForFunction(() => typeof openMemberLeave === "function", { timeout:15000 });

        await page.evaluate(() => {
            window.__calls = []; window.__toasts = []; window.__confirms = [];
            window.__confirmAnswer = true; window.__leaveError = null;

            const PREVIEWS = {
                t1: { role:"teacher", name:"أستاذ خالد", exams:7, files:3, links:2, classes:4 },
                s1: { role:"student", name:"عبدالله", attempts:9, classes:1 },
            };
            sb = {                                    // ← معجمي لا window.sb
                rpc: async (name, args) => {
                    window.__calls.push({ name, args });
                    if(window.__leaveError && name === "school_member_leave")
                        return { data:null, error:{ message: window.__leaveError } };
                    if(name === "member_leave_preview")
                        return { data: PREVIEWS[args.p_member] || null, error:null };
                    if(name === "school_member_leave"){
                        const p = PREVIEWS[args.p_member];
                        return { data: p.role === "student"
                            ? { role:"student", name:p.name, attempts_removed:p.attempts }
                            : { role:"teacher", name:p.name, exams_moved:p.exams,
                                files_moved:p.files, links_moved:p.links }, error:null };
                    }
                    return { data:null, error:null };
                },
            };
            schoolCtx = { schoolId:"sch", memberId:"admin1", role:"admin", fullName:"مدير" };
            showToast = (m) => window.__toasts.push(String(m));
            schoolBusy = () => {};
            loadSchoolMembers = () => {}; loadAdminClasses = () => {}; loadTeacherExams = () => {};
            window.confirm = (m) => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
        });

        /* ---------- ١) المعلّم ---------- */
        console.log("\nالمعلّم يغادر");
        await page.evaluate(() => openMemberLeave("t1"));
        await page.waitForSelector("#leave-modal .leave-facts", { state:"attached", timeout:5000 });
        const teacher = await page.evaluate(() => {
            const box = document.querySelector("#leave-modal .leave-facts");
            return {
                nums: [...box.querySelectorAll("b")].map(b => b.textContent),
                loss: box.classList.contains("is-loss"),
                note: document.querySelector(".leave-note").textContent,
                title: document.querySelector("#leave-modal h3").textContent,
                danger: !!document.querySelector("#leave-confirm.leave-danger"),
            };
        });
        ok("تُقرأ الأرقام من الخادم لا من الواجهة",
           JSON.stringify(teacher.nums) === '["7","3","2"]', JSON.stringify(teacher.nums));
        ok("ويُقال صراحةً إن عمله لا يضيع", /لا يضيع شيء/.test(teacher.note), teacher.note.trim());
        ok("وإلى أين ينتقل", /حسابك أنت/.test(teacher.note));
        ok("ويُطمأن على حسابه في خُطى", /حسابه في خُطى/.test(teacher.note));
        /* ⚠️ لا لون خطر هنا: لا شيء يُفقد */
        ok("ولا يُصبغ بلون الخطر", teacher.loss === false && teacher.danger === false);

        await page.evaluate(() => confirmMemberLeave());
        const tDone = await page.evaluate(() => ({
            confirms: window.__confirms.length,
            call: window.__calls.filter(c => c.name === "school_member_leave").slice(-1)[0],
            toast: window.__toasts.slice(-1)[0],
            closed: document.getElementById("leave-modal").style.display === "none",
        }));
        /* ⚠️ لا تأكيد ثانٍ للمعلّم: لا شيء يضيع، وإرهاقُ المدير بتأكيدات
           لا معنى لها يجعله يضغط "نعم" بلا قراءة حين يهمّ الأمر فعلاً. */
        ok("ولا يُطلب تأكيد ثانٍ (لا شيء يُفقد)", tDone.confirms === 0, String(tDone.confirms));
        ok("ويُنفَّذ بمعرّفه", tDone.call && tDone.call.args.p_member === "t1");
        ok("ويُقال كم انتقل إليه", /7/.test(tDone.toast), tDone.toast);
        ok("وتُغلق النافذة", tDone.closed);

        /* ---------- ٢) الطالب ---------- */
        console.log("\nالطالب يُنقل");
        await page.evaluate(() => openMemberLeave("s1"));
        await page.waitForSelector("#leave-modal .leave-facts", { state:"attached", timeout:5000 });
        const student = await page.evaluate(() => {
            const box = document.querySelector("#leave-modal .leave-facts");
            return {
                nums: [...box.querySelectorAll("b")].map(b => b.textContent),
                labels: [...box.querySelectorAll("span")].map(s => s.textContent),
                loss: box.classList.contains("is-loss"),
                note: document.querySelector(".leave-note").textContent,
                danger: !!document.querySelector("#leave-confirm.leave-danger"),
            };
        });
        ok("عدد المحاولات التي ستُحذف معروض",
           student.nums[0] === "9", JSON.stringify(student.nums));
        ok("ويُقال إنها تُحذف لا إنها تنتقل",
           /تُحذف/.test(student.labels[0]), student.labels[0]);
        /* ⚠️ الفرق البصري هو ما يمنع الضغط بخفّة */
        ok("ويُصبغ بلون الخطر خلافاً للمعلّم", student.loss === true && student.danger === true);
        /* ⚠️ شرط المالك الصريح: «يبقى حسابه على منصّة خُطى» */
        ok("ويُقال بوضوح إن حسابه في خُطى باقٍ",
           /حسابه في خُطى كما هو/.test(student.note), student.note.trim());
        ok("وإن خططه ونقاطه ملكُه لا ملكُ المدرسة", /ملكُه لا ملكُ المدرسة/.test(student.note));

        /* رفض التأكيد الثاني */
        await page.evaluate(async () => {
            window.__confirmAnswer = false;
            await confirmMemberLeave();
        });
        const refused = await page.evaluate(() => ({
            msg: window.__confirms.slice(-1)[0],
            called: window.__calls.filter(c => c.name === "school_member_leave" && c.args.p_member === "s1").length,
            open: document.getElementById("leave-modal").style.display !== "none",
        }));
        ok("يُطلب تأكيد ثانٍ للطالب وحده", !!refused.msg);
        ok("ويذكر الرقم والعواقب", /9/.test(refused.msg) && /لا رجعة/.test(refused.msg), refused.msg);
        ok("ويُطمئن على حساب خُطى فيه أيضاً", /خُطى/.test(refused.msg));
        ok("ورفضُه لا يُنفّذ شيئاً", refused.called === 0, String(refused.called));
        ok("وتبقى النافذة مفتوحة", refused.open);

        await page.evaluate(async () => { window.__confirmAnswer = true; await confirmMemberLeave(); });
        const sDone = await page.evaluate(() => window.__toasts.slice(-1)[0]);
        ok("وبعد القبول يُقال إن حسابه في خُطى باقٍ",
           /خُطى/.test(sDone), sDone);

        /* ---------- ٣) رفض الخادم ---------- */
        console.log("\nحين يرفض الخادم");
        const denied = await page.evaluate(async () => {
            const out = {};
            for(const err of ["CANNOT_REMOVE_ADMIN","CANNOT_REMOVE_SELF","NEEDS_GOOGLE","weird network thing"]){
                window.__leaveError = err;
                await openMemberLeave("t1");
                await new Promise(r => setTimeout(r, 30));
                await confirmMemberLeave();
                out[err] = window.__toasts.slice(-1)[0];
            }
            window.__leaveError = null;
            return out;
        });
        /* ⚠️ مديرٌ يُخرج مديراً انقلابٌ صامت — والرسالة تدلّه على الطريق
           الظاهر بدل أن تقول "ممنوع" وحدها. */
        ok("إخراج مديرٍ يُرفض ويُدَلّ على البديل",
           /أنزله إلى معلّم/.test(denied.CANNOT_REMOVE_ADMIN), denied.CANNOT_REMOVE_ADMIN);
        ok("وإخراج النفس يُشرح", /نفسك/.test(denied.CANNOT_REMOVE_SELF), denied.CANNOT_REMOVE_SELF);
        ok("و«يلزم Google» تُشرح", /Google/.test(denied.NEEDS_GOOGLE), denied.NEEDS_GOOGLE);
        ok("والفشل المجهول يقول إن شيئاً لم يتغيّر",
           /لم يتغيّر/.test(denied["weird network thing"]), denied["weird network thing"]);

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

console.log("=== فحص مغادرة المدرسة ===");
main();
