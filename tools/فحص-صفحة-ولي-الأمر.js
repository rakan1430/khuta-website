/* ============================================================
   فحص صفحة وليّ الأمر
   ------------------------------------------------------------
   ⚠️ هذه الصفحة الوحيدة في المشروع التي تعرض بيانات قاصر **بلا تسجيل
   دخول**. والرابط نفسه هو الرمز. فما يُفحص هنا ليس شكل الجدول، بل:

   • ألّا يظهر الرمز في مسار أي طلب (يُسجَّل في سجلّات الاستضافة أبداً).
   • ألّا يُنفَّذ اسمٌ فيه وسوم — والأسماء تكتبها إدارة المدرسة، وملفُ
     استيرادٍ واحد فيه ‎<script>‎ يكفي.
   • أن يُفرَّق بين "لم يُسلّم" و"صفر"، فالورقة تُقرأ أمام الطالب في بيته.
   • أن تُقال أسباب الرفض بلغةٍ يفهمها وليّ أمر، لا برموز.
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

/* ⚠️ الخادم هنا يسجّل كل مسار يصله — وهو بيت القصيد: لو ظهر الرمز في
   أحدها لظهر في سجلّ الاستضافة الحقيقي أيضاً. */
const seenPaths = [];

function serve(reply){
    return new Promise(resolve => {
        const srv = http.createServer((req, res) => {
            seenPaths.push(req.url);
            if(req.url.startsWith("/.netlify/functions/parent-view")){
                let body = "";
                req.on("data", c => body += c);
                req.on("end", () => {
                    const r = reply(body);
                    res.writeHead(r.status, { "Content-Type": "application/json; charset=utf-8" });
                    res.end(JSON.stringify(r.body));
                });
                return;
            }
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

const TOKEN = "AbCdEfGhIjKlMnOpQrStUv";
const LINK = `#s=dddddddd-1111-2222-3333-444444444444&v=3&t=${TOKEN}`;

let mode = "ok";
let lastBody = null;

const REPORT = {
    student: { name: "عبدالله", grade: "3", section: "a", class: "ثالث/أ" },
    school: "مدارس المتقدمة — فرع الملقا",
    generated_at: "2026-09-10T08:00:00Z",
    summary: { assigned: 3, done: 2, avg_pct: 75 },
    exams: [
        { title:"واجب الوحدة ٣", subject:"رياضيات", teacher:"ana btata",
          due_at:"2026-09-13T09:00:00Z", pct:90, done_at:"2026-09-09T10:00:00Z" },
        { title:"اختبار قصير", subject:"فيزياء", teacher:"ana btata",
          due_at:"2026-09-20T09:00:00Z", pct:60, done_at:"2026-09-10T10:00:00Z" },
        /* لم يُسلّم — ولا يجوز أن يُقرأ صفراً */
        { title:"واجب الفيزياء", subject:"فيزياء", teacher:"ana btata",
          due_at:"2026-09-25T09:00:00Z", pct:null, done_at:null },
    ],
};

function reply(body){
    lastBody = body;
    if(mode === "ok")      return { status:200, body: REPORT };
    if(mode === "revoked") return { status:410, body: { error:"REVOKED" } };
    if(mode === "bad")     return { status:403, body: { error:"BAD_LINK" } };
    if(mode === "xss")     return { status:200, body: { ...REPORT,
        student: { ...REPORT.student, name: '<img src=x onerror="window.__pwned=1">' } } };
    return { status:500, body: { error:"INTERNAL" } };
}

async function main(){
    const srv = await serve(reply);
    const port = srv.address().port;
    const guesses = [
        process.env.CHROMIUM_PATH,
        ...(fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
            .filter(d => d.startsWith("chromium"))
            .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")) : []),
    ].filter(p => p && fs.existsSync(p));
    const browser = await chromium.launch(guesses.length ? { executablePath: guesses[0] } : {});
    /* مقاس جوّال: وليّ الأمر يفتحها من رسالة واتساب */
    const page = await browser.newPage({ viewport:{ width:390, height:780 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));

    try{
        /* ⚠️ رقمٌ متغيّر في كل فتحة. والسبب أن الانتقال إلى العنوان نفسه
           بالجزء نفسه ليس إعادة تحميل في المتصفّح — بل انتقالٌ داخل
           الصفحة، فلا تُنفَّذ الشفرة من جديد ولا يُطلق hashchange (لأن
           الجزء لم يتغيّر). قِستُه: بقيت الصفحة تعرض أول ردٍّ ثلاث مرات. */
        let visit = 0;
        const url = () => `http://127.0.0.1:${port}/parent.html?n=${++visit}`;

        /* ---------- ١) ما يقرؤه وليّ الأمر ---------- */
        console.log("\nالصفحة على جوّال وليّ الأمر");
        await page.goto(url() + LINK, { waitUntil: "networkidle" });
        await page.waitForSelector(".exam", { timeout:5000 });

        const seen = await page.evaluate(() => {
            const exams = [...document.querySelectorAll(".exam")].map(e => ({
                title: e.querySelector("b").textContent,
                meta: e.querySelector("span").textContent,
                score: e.querySelector(".score").textContent.trim(),
                cls: e.querySelector(".score").className,
            }));
            const tiles = [...document.querySelectorAll(".tile")].map(t => t.querySelector("b").textContent);
            return {
                school: document.querySelector("header h1").textContent,
                name: document.querySelector(".who b").textContent,
                tiles, exams,
                note: document.querySelector(".note").textContent,
                wide: document.documentElement.scrollWidth > window.innerWidth + 1,
            };
        });

        ok("اسم المدرسة والابن", /المتقدمة/.test(seen.school) && seen.name === "عبدالله");
        ok("عدد الواجبات ٣", seen.tiles[0] === "3", JSON.stringify(seen.tiles));
        ok("ونسبة ما سُلّم ٢ من ٣ = ٦٧٪", seen.tiles[1] === "67%", seen.tiles[1]);
        ok("والمتوسّط ٧٥٪", seen.tiles[2] === "75%", seen.tiles[2]);
        ok("الواجبات الثلاثة معروضة", seen.exams.length === 3);
        ok("والدرجة العالية خضراء", seen.exams[0].score === "90%" && /good/.test(seen.exams[0].cls));
        /* ⚠️ الفرق بين "لم يُسلّم" و"صفر": الورقة تُقرأ أمام الطالب في بيته */
        ok("وما لم يُسلَّم يُكتب «لم يُسلّم» لا «0%»",
           seen.exams[2].score === "لم يُسلّم", seen.exams[2].score);
        ok("ولا يُلوَّن كدرجة راسبة", /none/.test(seen.exams[2].cls), seen.exams[2].cls);
        ok("ويُذكر موعد تسليمه بدل تاريخ تسليمٍ لم يحدث",
           /موعد التسليم/.test(seen.exams[2].meta), seen.exams[2].meta);
        ok("والتواريخ ميلادية لا هجرية",
           /2026/.test(seen.exams[0].meta) && !/هـ/.test(seen.exams[0].meta), seen.exams[0].meta);
        ok("ويُنبَّه وليّ الأمر ألّا يُشارك الرابط", /لا تُشاركه/.test(seen.note));
        ok("ولا تمرير أفقي على الجوّال", !seen.wide);

        /* ---------- ٢) الرمز لا يظهر في أي مسار ---------- */
        console.log("\nأين ذهب الرمز؟");
        const inPath = seenPaths.filter(p => p.includes(TOKEN));
        ok("لا يظهر الرمز في مسار أي طلب وصل الخادم",
           inPath.length === 0, inPath.join(", "));
        ok("ووصل في جسم الطلب فعلاً (وإلا لما عمل شيء)",
           !!lastBody && lastBody.includes(TOKEN), String(lastBody).slice(0, 80));
        const ref = await page.evaluate(() => document.querySelector('meta[name="referrer"]').content);
        ok("والصفحة لا تُرسل مصدرها لأي موقع", /no-referrer/.test(ref), ref);
        const robots = await page.evaluate(() => document.querySelector('meta[name="robots"]').content);
        ok("ولا تُفهرَس في محرّكات البحث", /noindex/.test(robots), robots);

        /* ---------- ٣) اسمٌ فيه وسوم ---------- */
        console.log("\nاسم فيه وسم HTML");
        mode = "xss";
        await page.goto(url() + LINK, { waitUntil: "networkidle" });
        await page.waitForSelector(".who b", { timeout:5000 });
        const xss = await page.evaluate(() => ({
            pwned: !!window.__pwned,
            imgs: document.querySelectorAll(".who img").length,
            text: document.querySelector(".who b").textContent,
        }));
        ok("لم يُنفَّذ شيء", xss.pwned === false);
        ok("ولم يُدرَج وسم", xss.imgs === 0);
        ok("والاسم يُعرض نصّاً كما هو", /img src=x/.test(xss.text), xss.text);

        /* ---------- ٤) رسائل الرفض ---------- */
        console.log("\nحين لا يعمل الرابط");
        mode = "revoked";
        await page.goto(url() + LINK, { waitUntil: "networkidle" });
        await page.waitForSelector(".state b", { timeout:5000 });
        const rev = await page.evaluate(() => document.querySelector(".state").textContent);
        ok("الرابط الملغى يُقال لصاحبه ما يفعل",
           /انتهت صلاحية/.test(rev) && /المدرسة/.test(rev), rev.trim());

        mode = "bad";
        await page.goto(url() + LINK, { waitUntil: "networkidle" });
        const bad = await page.evaluate(() => document.querySelector(".state").textContent);
        ok("والرابط المكسور يُشرح بلا رموز",
           /غير صحيح/.test(bad) && !/BAD_LINK/.test(bad), bad.trim());

        await page.goto(url(), { waitUntil: "networkidle" });
        const empty = await page.evaluate(() => document.querySelector(".state").textContent);
        ok("وفتحُ الصفحة بلا رابط لا يستدعي الخادم أصلاً",
           /ناقص/.test(empty), empty.trim());

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

console.log("=== فحص صفحة وليّ الأمر ===");
main();
