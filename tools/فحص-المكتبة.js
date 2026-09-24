/* ============================================================
   فحص المرحلة ٢ — المكتبة (واجهة)
   ------------------------------------------------------------
   الصلاحيات وقيد «رابط منصة عين فقط» مفحوصة في القاعدة بأدوار حقيقية.
   هنا: الكتاب رابطٌ يفتح في نافذة جديدة آمنة، والدروس، والإضافة والترتيب،
   ورفض رابط غير منصة عين قبل الإرسال، وزرّ اختبار الدرس للطالب فقط إن
   أُرسل إليه، والحقن.
   التشغيل:  node tools/فحص-المكتبة.js
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
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderLibraryTab === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
        await page.waitForTimeout(800);

        console.log("\n١) المعلّم: الكتاب والدروس");
        const t = await page.evaluate(async () => {
            const realRpc = sb.rpc;
            sb.rpc = async (fn, a) => fn === "my_teaching" ? { data:[{ subject_id:"S-MATH" }], error:null } : realRpc(fn, a);
            switchTab("schoollib");
            await new Promise(r => setTimeout(r, 400));
            const a = document.querySelector("#lib-list a[href^='https://ien.edu.sa']");
            toggleLibraryBook("B1");
            const lessons = document.querySelectorAll("#lib-list .lib-lesson").length;
            const video = document.querySelector("#lib-list .lib-lesson a[href^='https://www.youtube.com']");
            return { einLink: !!a, target: a && a.target, rel: a && a.rel, lessons, video: !!video,
                     editor: !!document.getElementById("lib-b-title"), lessonForm: !!document.getElementById("lib-l-title"),
                     quizPill: /اختبار الوحدة الثانية/.test(document.getElementById("lib-list").textContent) };
        });
        ok("رابط منصة عين يظهر", t.einLink);
        ok("يفتح في نافذة جديدة بـnoopener", t.target === "_blank" && /noopener/.test(t.rel || ""), `${t.target} ${t.rel}`);
        ok("الدرسان ظاهران بعد «الدروس»، ومعهما رابط الفيديو", t.lessons === 2 && t.video);
        ok("المعلّم يرى المحرّر ونموذج الدرس", t.editor && t.lessonForm);
        ok("المعلّم يرى الاختبار المربوط بالدرس", t.quizPill);

        console.log("\n٢) الإضافة والرفض والترتيب");
        const add = await page.evaluate(async () => {
            const toasts = []; const realToast = showToast; showToast = m => { toasts.push(m); realToast(m); };
            const before = libBooks.length;
            document.getElementById("lib-b-title").value = "كتاب مرفوع";
            document.getElementById("lib-b-url").value = "https://drive.google.com/book.pdf";
            await saveLibraryBook();
            const rejected = libBooks.length === before && /منصة عين/.test(toasts.join(" "));
            document.getElementById("lib-b-title").value = "<img src=x onerror=window.__xss=1>";
            document.getElementById("lib-b-url").value = "https://ien.edu.sa/#/book/9";
            await saveLibraryBook();
            await new Promise(r => setTimeout(r, 300));
            const added = libBooks.length === before + 1;
            libOpenBook = "B1"; renderLibraryList();
            document.getElementById("lib-l-title").value = "درس جديد";
            document.getElementById("lib-l-video").value = "javascript:alert(1)";
            await saveLibraryLesson("B1");
            const badVideo = (libLessons.get("B1") || []).length === 2;
            document.getElementById("lib-l-video").value = "";
            await saveLibraryLesson("B1");
            await new Promise(r => setTimeout(r, 300));
            const three = (libLessons.get("B1") || []).map(l => l.title);
            await moveLibraryLesson((libLessons.get("B1") || []).find(l => l.title === "درس جديد").id, -1);
            await new Promise(r => setTimeout(r, 300));
            const order = (libLessons.get("B1") || []).map(l => l.title);
            return { rejected, added, xss: !!window.__xss, html: document.getElementById("lib-list").innerHTML.includes("&lt;img"),
                     badVideo, three, order };
        });
        ok("رابط غير منصة عين يُرفض قبل الإرسال", add.rejected);
        ok("كتاب برابط منصة عين يُضاف", add.added);
        ok("عنوانٌ فيه وسم يُعرض نصاً", !add.xss && add.html);
        ok("رابط فيديو javascript: يُرفض", add.badVideo);
        ok("الدرس الثالث أُضيف آخراً", add.three.length === 3 && add.three[2] === "درس جديد", add.three.join("، "));
        ok("الترتيب: «درس جديد» صعد درجة", add.order[1] === "درس جديد", add.order.join("، "));

        console.log("\n٣) الطالب");
        const st = await page.evaluate(async () => {
            switchDemoRole("student");
            let assigned = [];
            sb.rpc = async fn => fn === "my_assigned_work" ? { data: assigned.map(id => ({ exam_id:id })), error:null }
                             : fn === "school_settings" ? { data: DEMO_SETTINGS, error:null } : { data:0, error:null };
            switchTab("schoollib");
            await new Promise(r => setTimeout(r, 400));
            libOpenBook = "B1"; renderLibraryList();
            const noAssign = !!document.querySelector("#lib-list [onclick^='openStudentExam']");
            const editor = !!document.getElementById("lib-b-title") || !!document.getElementById("lib-l-title");
            const grade = document.getElementById("lib-grade").value;
            assigned = ["X1"];
            await renderLibraryTab();
            libOpenBook = "B1"; renderLibraryList();
            const withAssign = !!document.querySelector("#lib-list [onclick^='openStudentExam']");
            return { noAssign, withAssign, editor, grade };
        });
        ok("اختبار غير مُرسَل للطالب: لا زرّ", !st.noAssign);
        ok("بعد إرساله: زرّ «اختبار الدرس»", st.withAssign);
        ok("الطالب بلا محرّر", !st.editor);
        ok("الطالب يبدأ بمرحلته", st.grade === "1", st.grade);

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
