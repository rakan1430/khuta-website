/* ============================================================
   فحص صور الاختبارات — هل تسمح سياسة CSP بعرضها؟
   ------------------------------------------------------------
   كشف المالك (٢٤ سبتمبر): كل صورة سؤال أو خيار أو شرح تظهر مكانها
   «تعذّر عرض صورة هذا السؤال — IMAGE_LOAD_FAILED». السبب: الرابط الموقَّع
   يُنشأ بنجاح من مخزن Supabase، ثم يرفض المتصفّح تحميله لأن img-src في
   netlify.toml لم يكن يسمح إلا بالموقع نفسه.
   هنا: خادم محلّي يرسل **ترويسة CSP نفسها من netlify.toml حرفياً**، وصورة
   تُطلب من عنوان المخزن الحقيقي (يُعترض داخل الفحص ويُعاد PNG).
   + فحص ضابط بالترويسة القديمة: يجب أن تفشل الصورة — وإلا فالفحص لا يقيس شيئاً.
   التشغيل:  node tools/فحص-صور-الاختبار.js
   ============================================================ */
let chromium;
try{ ({ chromium } = require("playwright")); }catch(e){ console.log("npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c){ pass++; console.log("  ✅ " + n); } else { fail++; console.log("  ❌ " + n + (d ? "\n       " + d : "")); } };

const toml = fs.readFileSync(path.join(ROOT, "netlify.toml"), "utf8");
const CSP = (toml.match(/Content-Security-Policy = "([^"]+)"/) || [])[1];
const OLD = CSP && CSP.replace(/img-src [^;]*;/, "img-src 'self' data: blob:;");
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

function serve(csp){
    return new Promise(res => {
        const s = http.createServer((q, r) => { r.writeHead(200, { "Content-Type":"text/html", "Content-Security-Policy": csp });
            r.end("<!doctype html><html><body>csp</body></html>"); });
        s.listen(0, "127.0.0.1", () => res(s));
    });
}
async function tryImage(browser, csp){
    const srv = await serve(csp);
    const page = await browser.newPage();
    await page.route("https://squhkiwjwwyrgufkaujf.supabase.co/**", r => r.fulfill({ status:200, contentType:"image/png", body: PNG }));
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    const out = await page.evaluate(() => new Promise(done => {
        const img = new Image();
        img.onload = () => done("loaded");
        img.onerror = () => done("failed");
        img.src = "https://squhkiwjwwyrgufkaujf.supabase.co/storage/v1/object/sign/exam-images/s/m/q.png?token=x";
        setTimeout(() => done("timeout"), 5000);
    }));
    await page.close(); srv.close();
    return out;
}
(async () => {
    ok("وُجدت ترويسة CSP في netlify.toml", !!CSP);
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter(d => d.startsWith("chromium"))
        .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")).find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    try{
        const now = await tryImage(browser, CSP);
        ok("بالترويسة الحالية: صورة المخزن تُعرض", now === "loaded", now);
        const before = await tryImage(browser, OLD);
        ok("ضابط — بالترويسة القديمة: الصورة تُرفض (كما رآها المالك)", before === "failed", before);
    }finally{ await browser.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
})();
