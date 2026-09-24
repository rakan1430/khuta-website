/* ============================================================
   فحص المرحلة ١ — السجلّ والدرجات الرسمية (واجهة)
   ------------------------------------------------------------
   صلاحيات القراءة وسجلّ الاطّلاع مفحوصة في قاعدة البيانات بأدوار حقيقية
   (معلّم المادة، معلّم آخر، الطالب، الإدارة). هنا الواجهة:
     ١) رفع كشف نور: تخمين عمود الهوية والأعمدة، إخفاء الهوية في المعاينة،
        وما يُرسل للخادم هو نصوص الملف كما هي.
     ٢) سجلّ المادة: «الدرجة / المجموع» و«لم يسلّم» و«متأخر»، والدرجات
        الرسمية كما هي — ولا نسبة مئوية ولا معدّل في أي مكان.
     ٣) ملف الطالب: الإدارة ترى من اطّلع، والمعلّم يُنبَّه أن اطّلاعه مسجَّل.
     ٤) اسم يحوي وسماً يُعرض نصاً.
     ٥) الطالب يرى سجلّه.
   التشغيل:  node tools/فحص-السجل.js
   ============================================================ */
let chromium;
try{ ({ chromium } = require("playwright")); }
catch(e){ console.log("⚠️  npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
function ok(name, cond, detail){
    if(cond){ pass++; console.log("  ✅ " + name); }
    else{ fail++; console.log("  ❌ " + name + (detail ? "\n       " + detail : "")); }
}
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json" };
function serve(){
    return new Promise(resolve => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split("?")[0]);
            if(p === "/") p = "/index.html";
            const file = path.join(ROOT, p);
            if(!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); res.end(); return; }
            res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
            res.end(fs.readFileSync(file));
        });
        srv.listen(0, "127.0.0.1", () => resolve(srv));
    });
}

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
        .filter(d => d.startsWith("chromium")).map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome"))
        .find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const csv = path.join(os.tmpdir(), "noor-grades.csv");
    fs.writeFileSync(csv, "م,اسم الطالب,رقم الهوية,المشاركة,الفصل الدراسي الأول,النهائي\n1,طالب أ,1023456789,10,٤٥,ممتاز\n2,طالب ب,1098765432,9,غ,\n");
    try{
        const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        let sentBody = null;
        await page.route("**/.netlify/functions/school-grades", async route => {
            sentBody = JSON.parse(route.request().postData());
            await route.fulfill({ status:200, contentType:"application/json", body: JSON.stringify({ saved:1, unmatched:1, badId:0 }) });
        });
        await page.goto(base + "/index.html", { waitUntil:"load" });
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderRecordTab === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); switchDemoRole("admin"); });
        await page.waitForTimeout(600);
        await page.evaluate(() => {
            schoolSettings = Object.assign({}, schoolSettings || {}, { subjects:[{ id:"11111111-1111-1111-1111-111111111111", name_ar:"الرياضيات", active:true }] });
            sb.auth.getSession = async () => ({ data:{ session:{ access_token:"tok" } } });
            window.__rpc = [];
            sb.rpc = async (fn, args) => { window.__rpc.push(fn); return { data: [], error:null }; };
        });

        console.log("\n١) رفع كشف نور");
        // البطاقة مطويّة افتراضياً (ملاحظة المالك: الطيّ) — يفتحها المدير أولاً
        await page.evaluate(() => { const c = document.getElementById("card-official"); if(c && c.classList.contains("is-collapsed")) c.querySelector(":scope > h3").click(); });
        await page.setInputFiles("#og-file", csv);
        await page.waitForSelector("#og-submit", { timeout:5000 });
        const map = await page.evaluate(() => ({
            id: ogIdCol, picked: [...ogPicked].sort(),
            preview: document.querySelector("#og-mapper .imp-preview").textContent,
        }));
        ok("عمود الهوية خُمّن (الثالث)", map.id === 2, String(map.id));
        ok("الأعمدة المختارة: المشاركة والفصل الأول والنهائي (لا الترقيم ولا الاسم)", JSON.stringify(map.picked) === "[3,4,5]", JSON.stringify(map.picked));
        ok("الهوية مخفيّة في المعاينة", /•••• 6789/.test(map.preview) && !/1023456789/.test(map.preview));
        await page.selectOption("#og-term", "final");
        await page.fill("#og-year", "1447");
        await page.selectOption("#og-subject", "11111111-1111-1111-1111-111111111111");
        await page.evaluate(() => submitOfficialGrades());
        await page.waitForTimeout(400);
        ok("أُرسل: الفترة والعام والمادة", sentBody && sentBody.term === "final" && sentBody.year === "1447"
           && sentBody.subjectId === "11111111-1111-1111-1111-111111111111", JSON.stringify(sentBody && { t:sentBody.term, y:sentBody.year, s:sentBody.subjectId }));
        ok("القيم كما هي حرفياً («٤٥» و«ممتاز» و«غ»)", sentBody && JSON.stringify(sentBody.rows[0].items) ===
           JSON.stringify([{label:"المشاركة",value:"10"},{label:"الفصل الدراسي الأول",value:"٤٥"},{label:"النهائي",value:"ممتاز"}])
           && sentBody.rows[1].items[1].value === "غ", JSON.stringify(sentBody && sentBody.rows[0].items));
        ok("النتيجة تُظهر غير المطابَق", /لم يُطابق/.test(await page.textContent("#og-mapper")));

        console.log("\n٢) سجلّ المادة");
        const book = await page.evaluate(async () => {
            const now = Date.now();
            sb.rpc = async (fn) => fn === "teacher_class_book" ? { data:{
                class:{ id:"C1", name:"أول/أ" }, subject:{ id:"S", name:"الرياضيات" },
                students:[{ id:"A", name:"<img src=x onerror=window.__xss=1>" }, { id:"B", name:"سعد" }],
                works:[{ id:"W1", title:"واجب ١", kind:"homework", due_at:new Date(now-864e5).toISOString() },
                       { id:"W2", title:"اختبار", kind:"exam", due_at:null }],
                cells:[{ w:"W1", st:"A", assigned:true, score:5, total:6, late:true },
                       { w:"W1", st:"B", assigned:true, score:null, total:null },
                       { w:"W2", st:"A", assigned:true, score:0, total:4 },
                       { w:"W2", st:"B", assigned:false }],
                official:[{ st:"A", year:"1447", term:"t1", items:[{ label:"النهائي", value:"٣٨" }] }],
            }, error:null } : { data:[], error:null };
            switchTab("schoolrecord");
            await new Promise(r => setTimeout(r, 600));
            const box = document.getElementById("rec-book");
            return { text: box.textContent, html: box.innerHTML, xss: !!window.__xss };
        });
        ok("«5 / 6» مع «متأخر»", /5 \/ 6/.test(book.text) && /متأخر/.test(book.text));
        ok("الصفر درجة لا «لم يسلّم»: «0 / 4»", /0 \/ 4/.test(book.text));
        ok("فات موعده ولم يسلّم: «لم يسلّم»", /لم يسلّم/.test(book.text));
        ok("عدد المسلّمين «سلّم 1 من 2»", /سلّم 1 من 2/.test(book.text));
        ok("الدرجة الرسمية كما هي «٣٨»", /٣٨/.test(book.text));
        ok("لا نسبة مئوية ولا معدّل", !/%|معدّل|متوسط/.test(book.text.replace(/بلا معدّلات/, "")));
        ok("الاسم الذي يحوي وسماً يُعرض نصاً", !book.xss && /&lt;img/.test(book.html));

        console.log("\n٣) ملف الطالب");
        const file = await page.evaluate(async () => {
            const payload = role => ({ student:{ id:"A", name:"سعد", grade:"1", section:"أ", class:"أول/أ" }, viewer_role:role,
                attendance:{ as_of:"2026-09-20", absent:2, late:1, excused:0 },
                works:[{ title:"واجب ١", kind:"homework", subject:"الرياضيات", score:5, total:6, late:false }],
                official:[{ year:"1447", term:"t1", subject:"الرياضيات", items:[{ label:"النهائي", value:"٣٨" }] }],
                access_log: role === "admin" ? [{ name:"أحمد", role:"teacher", at:new Date().toISOString() }] : null });
            let role = "admin";
            sb.rpc = async (fn, args) => fn === "student_file" ? { data: payload(role), error:null } : { data:null, error:null };
            await openStudentFile("A");
            const a = document.getElementById("student-file-body").textContent;
            closeStudentFile();
            role = "teacher";
            await openStudentFile("A");
            const t = document.getElementById("student-file-body").textContent;
            closeStudentFile();
            sb.rpc = async () => ({ data:null, error:{ message:"NOT_ALLOWED" } });
            await openStudentFile("A");
            const denied = document.getElementById("student-file-body").textContent;
            closeStudentFile();
            return { a, t, denied };
        });
        ok("الإدارة: «من اطّلع» واسم المعلّم", /من اطّلع/.test(file.a) && /أحمد/.test(file.a));
        ok("الإدارة: الغياب والدرجات والأعمال", /غياب/.test(file.a) && /٣٨/.test(file.a) && /5 \/ 6/.test(file.a));
        ok("المعلّم: لا سجلّ اطّلاع، وتنبيه أن اطّلاعه مسجَّل", !/من اطّلع/.test(file.t) && /يُسجَّل/.test(file.t));
        ok("الرفض برسالة مفهومة", /لا تملك الاطّلاع/.test(file.denied), file.denied);

        console.log("\n٤) زرّ «الملف» في قائمة الأعضاء");
        ok("دالّة openStudentFile معرّفة لزرّ الأعضاء", await page.evaluate(() => typeof openStudentFile === "function"));

        console.log("\n٥) الطالب يرى سجلّه");
        const mine = await page.evaluate(async () => {
            switchDemoRole("student");
            sb.rpc = async fn => fn === "my_assigned_work" ? { data:[{ exam_id:"X3", kind:"homework", due_at:new Date().toISOString(), done:true, score:4, total:6, late:false }], error:null }
                             : fn === "my_official_grades" ? { data:[{ year:"1447", term:"final", subject:"الرياضيات", items:[{ label:"المجموع", value:"ممتاز" }] }], error:null }
                             : { data:null, error:null };
            switchTab("schoolrecord");
            await new Promise(r => setTimeout(r, 500));
            return document.getElementById("rec-book").textContent;
        });
        ok("درجاته الرسمية «ممتاز» ونهاية العام", /ممتاز/.test(mine) && /نهاية العام/.test(mine), mine.slice(0, 200));
        ok("وواجبه «4 / 6» بعنوانه", /4 \/ 6/.test(mine) && /واجب الدرس الثالث/.test(mine));

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
