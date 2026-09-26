/* ============================================================
   فحص سلاسة التمرير على الجوال — بالقياس لا بالنظر
   ------------------------------------------------------------
   بلاغ المالك (٢٦ سبتمبر): تقطيع عند النزول والصعود على الجوال والآيباد.
   مؤقّت الإطارات في الصفحة لا يراه (الخيط الرئيسي خامل أثناء التمرير) —
   التقطيع في عمل الرسم على بطاقة الرسومات، وهو ما يتعثّر فيه الآيفون.
   فنقيسه من تتبّع أداء كروم: مجموع DisplayScheduler::DrawAndSwap أثناء
   تمرير ثابت، بمعالج مُبطّأ ٦×، ونقارنه بالحدّ الأدنى (بلا أي ضبابية).
   ضبابية حية على كل بطاقة كانت تجعله ٧× الحدّ الأدنى؛ بعد الإصلاح ~٢×.
   الفحص يفشل إن تجاوز ٣× — أي إن عادت ضبابية حية ثقيلة لبطاقات الجوال.
   التشغيل:  node tools/فحص-سلاسة-التمرير.js
   ============================================================ */
let chromium;
try{ ({ chromium } = require("playwright")); }catch(e){ console.log("npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c){ pass++; console.log("  ✅ " + n); } else { fail++; console.log("  ❌ " + n + (d ? "\n       " + d : "")); } };
const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split("?")[0]); if(p === "/") p = "/index.html"; const f = path.join(ROOT, p); if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": f.endsWith(".js") ? "text/javascript" : f.endsWith(".css") ? "text/css" : "text/html" }); r.end(fs.readFileSync(f)); });
const NO_BLUR = "*,*::before,*::after{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}";

async function measure(b, port, tab, css){
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await ctx.addInitScript(() => { localStorage.setItem("khuta_intro_seen", "1"); localStorage.setItem("khuta_theme", "dark"); localStorage.setItem("khuta_ast_nudged", '{"__off":1}'); });
    const page = await ctx.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html`);
    await page.waitForFunction(() => typeof startDemoMode === "function" && typeof khutaLoadGroup === "function", { timeout: 15000 });
    await page.addStyleTag({ content: "#login-overlay{display:none!important}" + css });
    await page.evaluate(async t => { isDemoMode = () => true; startDemoMode(); await khutaLoadGroup("school"); switchDemoRole("teacher"); switchTab(t); }, tab);
    await page.waitForTimeout(1500);
    const touch = await page.evaluate(() => document.documentElement.classList.contains("touch-ui"));
    const trace = path.join(os.tmpdir(), `khuta-scroll-${process.pid}-${Date.now()}.json`);
    const cdp = await ctx.newCDPSession(page);
    await b.startTracing(page, { path: trace, categories: ["viz", "gpu", "cc"] });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
    await page.evaluate(() => new Promise(done => {
        const H = document.documentElement.scrollHeight - innerHeight; let y = 0, dir = 1, n = 0;
        (function step(){ y += dir * 60; if(y >= H){ y = H; dir = -1; } if(y < 0) y = 0; scrollTo(0, y); if(++n < 160) requestAnimationFrame(step); else done(); })();
    }));
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    await b.stopTracing();
    let ms = 0;
    for(const e of JSON.parse(fs.readFileSync(trace)).traceEvents) if(e.ph === "X" && e.name === "DisplayScheduler::DrawAndSwap") ms += e.dur / 1000;
    fs.unlinkSync(trace);
    await ctx.close();
    return { ms, touch };
}

s.listen(0, "127.0.0.1", async () => {
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter(d => d.startsWith("chromium"))
        .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")).find(p => fs.existsSync(p)) : null;
    const b = await chromium.launch(exe ? { executablePath: exe } : {});
    try{
        for(const tab of ["schoolexams", "dashboard"]){
            console.log(`\n▶ ${tab} — جوال داكن، تمرير نزولاً وصعوداً`);
            const real = await measure(b, s.address().port, tab, "");
            const floor = await measure(b, s.address().port, tab, NO_BLUR);
            const ratio = real.ms / floor.ms;
            ok("الجوال يُعرف جهاز لمس", real.touch);
            ok(`عمل الرسم ${real.ms.toFixed(0)} مللي = ${ratio.toFixed(1)}× الحدّ الأدنى (${floor.ms.toFixed(0)}) — المسموح ≤ ٣×`, ratio <= 3,
               "عادت ضبابية حية ثقيلة على عناصر الجوال — انظر «أجهزة اللمس» في styles.css");
        }
    }finally{ await b.close(); s.close(); }
    console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
    process.exit(fail ? 1 : 0);
});
