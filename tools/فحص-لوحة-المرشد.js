/* ============================================================
   فحص المرحلة ٥ — لوحة المرشد (واجهة)
   ------------------------------------------------------------
   الحساب في القاعدة (المُسنَد، المُسلَّم، الفائت، استبعاد التدريب) وصلاحيات
   المدير/المرشد/المعلّم/الطالب مفحوصة بأدوار حقيقية. هنا:
     ١) من يرى التبويب: المدير والمرشد نعم، المعلّم العادي والطالب لا.
     ٢) خلية الفصل×المادة: متوسط موزون بعدد التسليمات، و«بيانات قليلة» تحت ٥.
     ٣) الطلاب للمتابعة: ضعف في مادة (≥ تسليمين) أو فائت ≥ ٢، وترتيبهم.
     ٤) فلتر المرحلة، والحقن، وحالة «لا بيانات».
     ٥) زرّ «اجعله مرشداً» في قائمة الأعضاء للمعلّمين.
   التشغيل:  node tools/فحص-لوحة-المرشد.js
   ============================================================ */
let chromium;
try{ ({ chromium } = require("playwright")); }
catch(e){ console.log("⚠️  npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path");

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


const DATA = {
    classes:[{ id:"C1", name:"أول/أ", grade:"1" }, { id:"C2", name:"ثاني/أ", grade:"2" }],
    subjects:[{ id:"S-MATH", name:"الرياضيات" }, { id:"S-PHYS", name:"الفيزياء" }],
    students:[
        { id:"A", name:"<img src=x onerror=window.__xss=1>", grade:"1", class:"C1", absent:"4" },
        { id:"B", name:"بدر", grade:"1", class:"C1" },
        { id:"D", name:"دانة", grade:"1", class:"C1" },
        { id:"C", name:"جود", grade:"2", class:"C2" },
        { id:"E", name:"عمر", grade:"2", class:"C2" },
    ],
    ss:[
        { st:"A", sub:"S-MATH", a:3, d:3, m:0, p:40 },
        { st:"B", sub:"S-MATH", a:3, d:3, m:0, p:45 },
        { st:"D", sub:"S-MATH", a:2, d:2, m:0, p:90 },
        { st:"A", sub:"S-PHYS", a:2, d:1, m:1, p:20 },
        { st:"C", sub:"S-MATH", a:5, d:5, m:0, p:85 },
        { st:"E", sub:"S-MATH", a:3, d:1, m:2, p:70 },
    ],
};

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
        .filter(d => d.startsWith("chromium")).map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome"))
        .find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    try{
        const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        await page.goto(base + "/index.html", { waitUntil:"load" });
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderCounselorTab === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
        await page.waitForTimeout(700);

        console.log("\n١) من يرى التبويب");
        const vis = await page.evaluate(async () => {
            const shown = () => getComputedStyle(document.getElementById("nav-counselor")).display !== "none";
            const out = {};
            switchDemoRole("admin"); await initCounselorAccess(); out.admin = shown();
            let flag = false;
            const realRpc = sb.rpc;
            sb.rpc = async (fn, a) => fn === "is_school_counselor" ? { data: flag, error:null } : realRpc(fn, a);
            switchDemoRole("teacher"); await initCounselorAccess();
            await new Promise(r => setTimeout(r, 400));
            out.teacher = shown();
            flag = true; await initCounselorAccess();
            await new Promise(r => setTimeout(r, 400));   // يستقرّ أي فحص جارٍ من تبديل الدور
            out.counselor = shown();
            switchDemoRole("student"); await initCounselorAccess();
            await new Promise(r => setTimeout(r, 400));   // فحص المرشد السابق يعود متأخراً — يجب ألّا يُظهره
            out.student = shown();
            return out;
        });
        ok("المدير يراه", vis.admin);
        ok("المعلّم العادي لا يراه", !vis.teacher);
        ok("المعلّم المرشد يراه", vis.counselor);
        ok("الطالب لا يراه", !vis.student);

        console.log("\n٢) الحساب والعرض");
        const r = await page.evaluate(async (DATA) => {
            switchDemoRole("admin");
            sb.rpc = async fn => fn === "counselor_overview" ? { data: DATA, error:null }
                             : fn === "school_settings" ? { data: DEMO_SETTINGS, error:null } : { data:null, error:null };
            switchTab("schoolcounselor");
            await new Promise(r => setTimeout(r, 400));
            const rows = [...document.querySelectorAll(".cns-heat tbody tr")].map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, " ").trim()));
            const cellClass = [...document.querySelectorAll(".cns-heat tbody tr")].map(tr => [...tr.querySelectorAll("td")].map(td => td.className));
            const att = [...document.querySelectorAll(".cns-student")].map(el => el.textContent.replace(/\s+/g, " ").trim());
            const body = document.getElementById("cns-body");
            return { rows, cellClass, att, weakest: [...document.querySelectorAll(".cns-subj")].map(e => e.textContent.replace(/\s+/g, " ").trim()),
                     xss: !!window.__xss, escaped: body.innerHTML.includes("&lt;img") };
        }, DATA);
        ok("أول/أ × الرياضيات: متوسط موزون 54% (لا 58%) وتسليم 100%", /54%/.test(r.rows[0][1]) && /100%/.test(r.rows[0][1]), JSON.stringify(r.rows[0]));
        ok("وتُلوَّن «يحتاج متابعة» (بين ٥٠ و٦٥)", /watch/.test(r.cellClass[0][0]), r.cellClass[0][0]);
        ok("أول/أ × الفيزياء: تسليم واحد ⇒ «بيانات قليلة» لا نسبة", /بيانات قليلة/.test(r.rows[0][2]) && !/%/.test(r.rows[0][2]), r.rows[0][2]);
        ok("ثاني/أ × الرياضيات: 83% «جيد»", /83%/.test(r.rows[1][1]) && /ok/.test(r.cellClass[1][0]), JSON.stringify(r.rows[1]) + " " + r.cellClass[1][0]);
        ok("للمتابعة ٣ طلاب: الضعيفان في الرياضيات وصاحب الفائتَين", r.att.length === 3, r.att.join(" | "));
        ok("الترتيب: من فاته أكثر مع ضعفه أولاً", /onerror|img/.test(r.att[0]) && /بدر/.test(r.att[1]) && /عمر/.test(r.att[2]), r.att.join(" | "));
        ok("الغياب من نور يظهر مع الطالب", /غياب 4 يوم/.test(r.att[0]), r.att[0]);
        ok("الفيزياء لا تُحسب ضعفاً بتسليم واحد", !/الفيزياء/.test(r.att[0]), r.att[0]);
        ok("الاسم الذي يحوي وسماً يُعرض نصاً", !r.xss && r.escaped);
        ok("«المواد الأضعف»: الفيزياء مستبعدة لقلة البيانات", r.weakest.length === 1 && /الرياضيات/.test(r.weakest[0]), r.weakest.join(" | "));

        console.log("\n٣) الفلتر وحالة «لا بيانات»");
        const f = await page.evaluate(async () => {
            document.getElementById("cns-grade").value = "2"; renderCounselorBody();
            const rows = document.querySelectorAll(".cns-heat tbody tr").length;
            const att = document.querySelectorAll(".cns-student").length;
            cnsData = { classes:[], subjects:[], students:[], ss:[] }; renderCounselorBody();
            return { rows, att, empty: /لا بيانات بعد/.test(document.getElementById("cns-body").textContent) };
        });
        ok("مرحلة «ثاني»: فصل واحد وطالب واحد للمتابعة", f.rows === 1 && f.att === 1, JSON.stringify(f));
        ok("بلا بيانات: رسالة تشرح متى تمتلئ", f.empty);

        console.log("\n٤) تعيين المرشد من قائمة الأعضاء");
        const m = await page.evaluate(async () => {
            switchTab("schooladmin");
            await loadSchoolMembers();
            await new Promise(r => setTimeout(r, 300));
            const list = document.getElementById("admin-members-list");
            return { btn: !!list.querySelector("[onclick^='toggleCounselor']"), text: list.textContent };
        });
        ok("زرّ «اجعله مرشداً» يظهر للمعلّمين", m.btn && /اجعله مرشداً/.test(m.text));

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
