/* ============================================================
   فحص واجهة نهاية السنة الدراسية
   ------------------------------------------------------------
   ⚠️ أخطر زرّ في المنصّة: يغيّر مرحلة كل طالب، ويُخرج صفّاً كاملاً من
   المدرسة، ويبدأ عدّاد حذفٍ لا رجعة فيه.

   ومنطقُه كلّه في قاعدة البيانات وقد فُحص هناك بعمليّات حقيقية ثم
   تُراجع عنها. وما يُفحص هنا هو ما لا تراه قاعدة البيانات: هل يعرف
   المدير **بالأرقام** ما سيحدث قبل أن يضغط؟ فمن قرأ "٢١ يتخرّجون"
   يتوقّف إن كان الرقم خاطئاً، ومن قرأ "هل أنت متأكد؟" يضغط نعم.
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

const STUDENTS = [
    { id:"s1", full_name:"أول أ", grade:"1", section:"a" },
    { id:"s2", full_name:"أول ب", grade:"1", section:"a" },
    { id:"s3", full_name:"ثاني أ", grade:"2", section:"a" },
    { id:"s4", full_name:"ثالث أ", grade:"3", section:"a" },
    { id:"s5", full_name:"ثالث ب", grade:"3", section:"a" },
];

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
        await page.waitForFunction(() => typeof openYearPromotion === "function", { timeout:15000 });

        await page.evaluate((students) => {
            window.__students = students;
            window.__calls = [];
            window.__toasts = [];
            window.__confirms = [];
            window.__confirmAnswer = true;
            window.__promoteError = null;

            sb = {                                    // ← معجمي لا window.sb
                rpc: async (name, args) => {
                    window.__calls.push({ name, args });
                    if(name === "school_year_status") return { data: {
                        year_label: "1448",
                        year_started_at: "2026-08-20T00:00:00Z",
                        archive_purge_at: window.__purgeAt || null,
                        archived_exams: 12,
                        students_by_grade: { "1":2, "2":1, "3":2 },
                    }, error:null };
                    if(name === "promote_school_year"){
                        if(window.__promoteError)
                            return { data:null, error:{ message: window.__promoteError } };
                        return { data: { promoted:2, graduated:1, held_back:2, archived:12 }, error:null };
                    }
                    return { data:null, error:null };
                },
                from: () => ({
                    select: function(){ return this; }, eq: function(){ return this; },
                    order: function(){ return this; },
                    limit: async () => ({ data: JSON.parse(JSON.stringify(window.__students)), error:null }),
                }),
            };
            schoolCtx = { schoolId:"sch", memberId:"m", role:"admin", fullName:"مدير" };
            showToast = (m) => window.__toasts.push(String(m));
            schoolBusy = () => {};
            loadAdminClasses = () => {};
            window.confirm = (m) => { window.__confirms.push(String(m)); return window.__confirmAnswer; };
        }, STUDENTS);

        /* ---------- ١) بطاقة حالة السنة ---------- */
        console.log("\nبطاقة السنة في إدارة المدرسة");
        await page.evaluate(async () => { window.__purgeAt = null; await loadYearStatus(); });
        const st = await page.evaluate(() => ({
            html: document.getElementById("year-status").textContent,
            grades: [...document.querySelectorAll(".year-grade b")].map(b => b.textContent),
            purge: !!document.querySelector(".year-purge"),
        }));
        ok("اسم السنة معروض", /1448/.test(st.html), st.html.trim().slice(0,80));
        ok("وعدد طلاب كل مرحلة", JSON.stringify(st.grades) === '["2","1","2"]', JSON.stringify(st.grades));
        ok("ولا يظهر عدّاد حذف قبل الترقية", st.purge === false);

        /* ⚠️ عدّاد الحذف: مهلةٌ لا يراها المدير مهلةٌ لا وجود لها */
        const purge = await page.evaluate(async () => {
            window.__purgeAt = new Date(Date.now() + 5 * 86400000).toISOString();
            await loadYearStatus();
            const el = document.querySelector(".year-purge");
            return { text: el.textContent, urgent: el.classList.contains("urgent") };
        });
        ok("وبعدها يظهر بعدد الأيام المتبقّية", /5 يوم/.test(purge.text), purge.text.trim());
        ok("ويذكر عدد ما سيُحذف", /12/.test(purge.text));
        ok("ويقول إنها مخفيّة عن الطلاب الآن", /مخفيّة عن الطلاب/.test(purge.text));
        ok("ولا يُنذَر ما زال بعيداً", purge.urgent === false);

        const soon = await page.evaluate(async () => {
            window.__purgeAt = new Date(Date.now() + 86400000).toISOString();
            await loadYearStatus();
            return document.querySelector(".year-purge").classList.contains("urgent");
        });
        ok("ويُنذَر حين يقترب", soon === true);

        /* ---------- ٢) نافذة الترقية ---------- */
        console.log("\nنافذة الترقية");
        await page.evaluate(() => openYearPromotion());
        await page.waitForSelector("#year-modal .pick-row", { state:"attached", timeout:5000 });

        const modal = await page.evaluate(() => {
            const rows = [...document.querySelectorAll("#year-modal .pick-row")];
            return {
                n: rows.length,
                fates: rows.map(r => r.querySelector("small").textContent.trim()),
                summary: [...document.querySelectorAll(".year-summary b")].map(b => b.textContent),
                label: document.getElementById("year-label-input").value,
            };
        });
        ok("كل الطلاب معروضون", modal.n === 5, String(modal.n));
        ok("ويُكتب مصير كل طالب لا اسمه فقط",
           /←/.test(modal.fates[0]) && /يتخرّج/.test(modal.fates[3]), JSON.stringify(modal.fates));
        /* ⚠️ الأرقام قبل الزرّ: ٣ يُرقَّون (١+١+٢) و٢ يتخرّجان */
        ok("والأرقام محسوبة قبل الضغط: ٣ يُرقَّى، ٢ يتخرّج، ٠ يبقى",
           JSON.stringify(modal.summary) === '["3","2","0"]', JSON.stringify(modal.summary));
        ok("واسم السنة الحالي معبّأ", modal.label === "1448", modal.label);

        /* إبقاء طالبين */
        const held = await page.evaluate(() => {
            toggleYearHold("s1");   // أول أ يبقى
            toggleYearHold("s4");   // ثالث أ يبقى فلا يتخرّج
            const rows = [...document.querySelectorAll("#year-modal .pick-row")];
            return {
                summary: [...document.querySelectorAll(".year-summary b")].map(b => b.textContent),
                fate1: rows[0].querySelector("small").textContent.trim(),
                on: document.querySelectorAll("#year-modal .pick-row.is-on").length,
            };
        });
        ok("وتحديد طالبين يُنقص المُرقَّى ويزيد الباقين",
           JSON.stringify(held.summary) === '["2","1","2"]', JSON.stringify(held.summary));
        ok("ويتغيّر مصير المحدَّد أمام عينه", /يبقى في مرحلته/.test(held.fate1), held.fate1);
        ok("ويظهر محدَّداً في القائمة", held.on === 2);

        /* ---------- ٣) التأكيد يذكر الأرقام ---------- */
        console.log("\nقبل التنفيذ");
        await page.evaluate(async () => {
            window.__confirmAnswer = false;
            await confirmYearPromotion();
        });
        const asked = await page.evaluate(() => ({
            msg: window.__confirms.slice(-1)[0],
            called: window.__calls.filter(c => c.name === "promote_school_year").length,
        }));
        ok("التأكيد يذكر الأرقام لا «هل أنت متأكد؟»",
           /2/.test(asked.msg) && /1/.test(asked.msg) && /2/.test(asked.msg), asked.msg);
        ok("ويقول إن الإجراء لا رجعة فيه", /لا رجعة/.test(asked.msg));
        ok("ويذكر حذف بيانات العام الماضي", /تُحذف/.test(asked.msg));
        /* ⚠️ الرفض يعني ألّا يُنفَّذ شيء إطلاقاً */
        ok("ورفضُ التأكيد لا يُنفّذ شيئاً", asked.called === 0, String(asked.called));

        /* ---------- ٤) التنفيذ ---------- */
        console.log("\nالتنفيذ");
        await page.evaluate(async () => {
            window.__confirmAnswer = true;
            document.getElementById("year-label-input").value = "1449";
            await confirmYearPromotion();
        });
        const done = await page.evaluate(() => ({
            call: window.__calls.filter(c => c.name === "promote_school_year").slice(-1)[0],
            toast: window.__toasts.slice(-1)[0],
            closed: document.getElementById("year-modal").style.display === "none",
            refreshed: window.__calls.filter(c => c.name === "school_year_status").length,
        }));
        ok("تُرسَل قائمة الباقين كما حدّدها",
           done.call && JSON.stringify([...done.call.args.p_hold_back].sort()) === '["s1","s4"]',
           JSON.stringify(done.call && done.call.args));
        ok("ومعها اسم السنة الجديدة", done.call && done.call.args.p_year_label === "1449");
        ok("وتُغلق النافذة بعد النجاح", done.closed);
        ok("ويُقال ما جرى بالأرقام", /2/.test(done.toast) && /1/.test(done.toast), done.toast);
        ok("وتُحدَّث البطاقة تلقائياً", done.refreshed >= 4, String(done.refreshed));

        /* ---------- ٥) الرفض من قاعدة البيانات ---------- */
        console.log("\nحين يرفض الخادم");
        const denied = await page.evaluate(async () => {
            const out = {};
            for(const err of ["NEEDS_GOOGLE", "NOT_ALLOWED", "some network blip"]){
                window.__promoteError = err;
                await openYearPromotion();
                await new Promise(r => setTimeout(r, 30));
                await confirmYearPromotion();
                out[err] = window.__toasts.slice(-1)[0];
            }
            window.__promoteError = null;
            return out;
        });
        ok("«يلزم Google» تُشرح ويُقال ما يفعل",
           /Google/.test(denied.NEEDS_GOOGLE) && /أعد المحاولة/.test(denied.NEEDS_GOOGLE),
           denied.NEEDS_GOOGLE);
        ok("و«لإدارة المدرسة» تُشرح", /لإدارة المدرسة/.test(denied.NOT_ALLOWED), denied.NOT_ALLOWED);
        /* ⚠️ مهمّ: المدير يجب أن يعرف أن شيئاً لم يتغيّر، وإلا ظنّ المدرسة
           نصفَ مُرقّاة ولم يجرؤ على إعادة المحاولة. */
        ok("والفشل المجهول يقول صراحةً إن شيئاً لم يتغيّر",
           /لم يتغيّر/.test(denied["some network blip"]), denied["some network blip"]);

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

console.log("=== فحص نهاية السنة الدراسية ===");
main();
