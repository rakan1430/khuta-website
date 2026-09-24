/* ============================================================
   فحص لوحة الرسم بخطّ اليد وعرض صور الاختبار — وفق دليل المالك
   ------------------------------------------------------------
   الرسم (js/18-exam-builder.js):
     ١) النقاط نِسَبٌ 0..1 محصورة، حتى لو خرج الإصبع من الحافّة.
     ٢) تراجع خطّ كامل، و«مسح الكل» يُتراجَع عنه.
     ٣) إصبعٌ ثانٍ أثناء الكتابة لا يبدأ خطّاً (راحة اليد).
     ٤) نقرةٌ واحدة = نقطة مرئية.
     ٥) التصدير طبقتان: مكان المحو ورقٌ أبيض معتم (255,255,255,255) لا ثقب.
     ٦) الحبر داكنٌ ثابت والورق أبيض حتى في الوضع الليلي.
     ٧) مقاس التصدير بنسبة القماش الفعلي وسقفه ١٦٠٠.
     ٨) تغيير مقاس النافذة لا يغيّر البيانات ويعيد الرسم من النقاط.
     ٩) الحفظ يرفع PNG ويعيد فتح اللوحة بالخطوط نفسها لتُكمَل.
   الصور (mountExamImage):
     ١٠) رابطٌ محفوظ انتهى → إعادة توقيع **مرّة واحدة** ثم تظهر.
     ١١) ملفّ مفقود فعلاً → توقيعان فقط ثم رسالة (لا حلقة).
     ١٢) علم alive: الانتقال قبل وصول الرابط لا يلمس الصفحة الجديدة.
     ١٣) الذاكرة: نفس المسار لا يُوقَّع مرّتين، ويُوقَّع من جديد بعد انتهائه.
     ١٤) هيكل التحميل، lazy، والأبعاد (max-width/height:auto/max-height).
     ١٥) تصغير صورة ٣٠٠٠ بكسل قبل الرفع إلى ١٦٠٠ بنسبتها.
   التشغيل:  node tools/فحص-الرسم-والصور.js
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
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png" };
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
function serve(){
    return new Promise(resolve => {
        const srv = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split("?")[0]);
            if(p.startsWith("/signed/good")){ res.writeHead(200, { "Content-Type":"image/png" }); res.end(PNG); return; }
            if(p.startsWith("/signed/")){ res.writeHead(400); res.end("expired"); return; }
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
        const ctx = await browser.newContext({ viewport:{ width:1100, height:900 }, deviceScaleFactor:2 });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        await page.goto(base + "/index.html", { waitUntil:"load" });
        await page.waitForFunction(() => typeof openExplanationDraw === "function" && typeof mountExamImage === "function", { timeout:15000 });
        await page.evaluate(async () => {
            isDemoMode = () => true; startDemoMode();
            await new Promise(r => setTimeout(r, 1200));
            switchDemoRole("teacher");
            examDraft = null; ensureExamDraft();
            openExplanationDraw(0);
            await new Promise(r => setTimeout(r, 200));
        });

        /* ============ الرسم ============ */
        console.log("\nلوحة الرسم بخطّ اليد");
        const box = await page.locator("#explain-draw-canvas").boundingBox();
        const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
        async function stroke(pts){
            await page.mouse.move(...at(...pts[0])); await page.mouse.down();
            for(const p of pts.slice(1)) await page.mouse.move(...at(...p), { steps:6 });
            await page.mouse.up();
        }
        const canvasInfo = await page.evaluate(() => {
            const c = document.getElementById("explain-draw-canvas");
            return { touch: getComputedStyle(c).touchAction, w: c.width, cssW: c.getBoundingClientRect().width };
        });
        ok("touch-action:none على القماش", canvasInfo.touch === "none", canvasInfo.touch);
        ok("دقّة القماش = مقاسه × كثافة الشاشة (2)", Math.abs(canvasInfo.w - Math.round(canvasInfo.cssW * 2)) <= 1, JSON.stringify(canvasInfo));

        // خطّ يتجاوز الحافّة اليمنى — يجب أن يُحصر في 1
        await stroke([[0.1, 0.5], [0.5, 0.5], [1.3, 0.5]]);
        let st = await page.evaluate(() => ({ n: edStrokes.length, pts: edStrokes[0] && edStrokes[0].points }));
        ok("١) خطّ واحد بعد السحب", st.n === 1, st.n);
        ok("١) كل النقاط نِسَبٌ داخل 0..1 (المتجاوز حُصر في 1)",
            st.pts && st.pts.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1) && st.pts.some(p => p.x === 1),
            JSON.stringify(st.pts && st.pts.slice(-2)));

        await stroke([[0.2, 0.2], [0.4, 0.3]]);
        await page.evaluate(() => undoExplainStroke());
        ok("٢) التراجع يحذف الخطّ الأخير كاملاً", await page.evaluate(() => edStrokes.length) === 1);
        await page.evaluate(() => clearExplanationCanvas());
        ok("٢) «مسح الكل» يُفرغ", await page.evaluate(() => edStrokes.length) === 0);
        await page.evaluate(() => undoExplainStroke());
        ok("٢) والتراجع يعيد ما مُسح", await page.evaluate(() => edStrokes.length) === 1);

        // ٣) إصبع ثانٍ أثناء الكتابة
        const second = await page.evaluate(() => {
            const c = document.getElementById("explain-draw-canvas"), r = c.getBoundingClientRect();
            const ev = (type, id, fx, fy) => c.dispatchEvent(new PointerEvent(type, { pointerId:id, pointerType:"touch", isPrimary:id === 11,
                clientX: r.left + r.width * fx, clientY: r.top + r.height * fy, bubbles:true, cancelable:true }));
            const before = edStrokes.length;
            ev("pointerdown", 11, 0.3, 0.8); ev("pointermove", 11, 0.5, 0.8);
            ev("pointerdown", 12, 0.9, 0.1); ev("pointermove", 12, 0.95, 0.15); ev("pointerup", 12, 0.95, 0.15);
            ev("pointermove", 11, 0.7, 0.8); ev("pointerup", 11, 0.7, 0.8);
            const last = edStrokes[edStrokes.length - 1];
            return { added: edStrokes.length - before, maxX: Math.max(...last.points.map(p => p.x)), minY: Math.min(...last.points.map(p => p.y)) };
        });
        ok("٣) الإصبع الثاني تُجوهل: خطّ واحد فقط، ولم يدخل نقاطه", second.added === 1 && second.maxX < 0.8 && second.minY > 0.7, JSON.stringify(second));

        // ٤) نقرة = نقطة
        await page.mouse.click(...at(0.85, 0.2));
        const dot = await page.evaluate(() => {
            const s = edStrokes[edStrokes.length - 1];
            const c = document.getElementById("explain-draw-canvas");
            const d = c.getContext("2d").getImageData(Math.round(s.points[0].x * c.width), Math.round(s.points[0].y * c.height), 1, 1).data;
            return { n: s.points.length, alpha: d[3] };
        });
        ok("٤) نقرةٌ واحدة تُرسم نقطةً مرئية", dot.n === 1 && dot.alpha > 200, JSON.stringify(dot));

        // ٥+٦) ممحاة عبر منتصف الخطّ الأوّل، ثم تصدير في الوضع الليلي
        await page.evaluate(() => { document.body.classList.add("dark-mode"); setExplainTool("eraser"); });
        await stroke([[0.3, 0.42], [0.3, 0.58]]);
        await page.evaluate(() => setExplainTool("pen"));
        const px = await page.evaluate(async () => {
            const size = { width: 800, height: 440 };
            const blob = await strokesToPng(edStrokes, size);
            const bmp = await createImageBitmap(blob);
            const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
            const g = c.getContext("2d"); g.drawImage(bmp, 0, 0);
            const read = (fx, fy) => Array.from(g.getImageData(Math.round(fx * c.width), Math.round(fy * c.height), 1, 1).data);
            return { type: blob.type, erased: read(0.3, 0.5), ink: read(0.45, 0.5), paper: read(0.6, 0.15), w: bmp.width, h: bmp.height };
        });
        ok("٥) مكان المحو ورقٌ أبيض معتم لا ثقب شفّاف", px.erased.join() === "255,255,255,255", px.erased.join());
        ok("٦) الحبر داكن (#16202A) في الوضع الليلي", px.ink[0] < 60 && px.ink[1] < 60 && px.ink[2] < 70 && px.ink[3] === 255, px.ink.join());
        ok("٦) والورق أبيض معتم", px.paper.join() === "255,255,255,255", px.paper.join());
        ok("٥) الناتج PNG", px.type === "image/png");

        // ٧) مقاس التصدير
        const sz = await page.evaluate(() => [exportSize(1200, 660, 3, 1600), exportSize(400, 220, 1, 1600), exportSize(300, 900, 3, 1600)]);
        ok("٧) السقف ١٦٠٠ مع حفظ النسبة", sz[0].width === 1600 && Math.abs(sz[0].height - 880) <= 1, JSON.stringify(sz[0]));
        ok("٧) الصغير لا يُكبَّر فوق مقياسه", sz[1].width === 400 && sz[1].height === 220, JSON.stringify(sz[1]));
        ok("٧) الطولي يُقصّ على طوله", sz[2].height === 1600 && Math.abs(sz[2].width - 533) <= 1, JSON.stringify(sz[2]));

        // ٨) تغيير المقاس
        const beforeResize = await page.evaluate(() => JSON.stringify(edStrokes));
        await page.setViewportSize({ width: 700, height: 900 });
        await page.waitForTimeout(250);
        const rs = await page.evaluate(() => {
            const c = document.getElementById("explain-draw-canvas");
            const r = c.getBoundingClientRect();
            return { data: JSON.stringify(edStrokes), w: c.width, cssW: r.width, ratio: r.width / r.height, aspect: edAspect };
        });
        ok("٨) البيانات لم تتغيّر بتغيير المقاس", rs.data === beforeResize);
        ok("٨) القماش أُعيد ضبطه على المقاس الجديد وبالنسبة نفسها",
            Math.abs(rs.w - Math.round(rs.cssW * 2)) <= 1 && Math.abs(rs.ratio - rs.aspect) < 0.02, JSON.stringify(rs));

        // ٩) الحفظ ثم إعادة الفتح
        const saved = await page.evaluate(async () => {
            let got = null;
            const real = uploadExamImage;
            uploadExamImage = async (f) => { got = f; return "s/m/drawing-test.png"; };
            renderExamBuilder = () => {};
            const n = edStrokes.length;
            await saveExplanationDraw();
            uploadExamImage = real;
            const ex = examDraft.questions[0].explanation;
            const open = document.getElementById("explain-draw-modal").style.display;
            const bmp = got && await createImageBitmap(got);
            openExplanationDraw(0);
            await new Promise(r => setTimeout(r, 100));
            const reopened = edStrokes.length;
            closeExplanationDraw(true);
            return { type: got && got.type, w: bmp && bmp.width, h: bmp && bmp.height, exType: ex.type, exImage: ex.image, open, n, reopened };
        });
        ok("٩) رُفع PNG بدقّة ≥ ٢× وضلعه ≤ ١٦٠٠",
            saved.type === "image/png" && saved.w <= 1600 && saved.h <= 1600 && saved.w >= 1000, JSON.stringify(saved));
        ok("٩) الشرح صار «رسماً» بالمسار المرفوع وأُغلقت اللوحة",
            saved.exType === "drawing" && saved.exImage === "s/m/drawing-test.png" && saved.open === "none", JSON.stringify(saved));
        ok("٩) إعادة الفتح تُرجع الخطوط نفسها ليُكمَل الرسم", saved.reopened === saved.n && saved.n > 0, JSON.stringify(saved));

        /* ============ الصور ============ */
        console.log("\nعرض صور الاختبار");
        await page.evaluate((b) => {
            document.body.classList.remove("dark-mode");
            window.__signs = [];
            window.__mode = {};          // path → "good" | "bad" | "slow"
            window.__count = {};
            sb = { storage: { from: () => ({ createSignedUrl: async (p) => {
                window.__signs.push(p);
                window.__count[p] = (window.__count[p] || 0) + 1;
                const mode = window.__mode[p] || "good";
                if(mode === "slow") await new Promise(r => setTimeout(r, 400));
                // «bad-once»: أوّل رابط منتهٍ، والثاني سليم
                const good = mode === "good" || mode === "slow" || (mode === "bad-once" && window.__count[p] > 1);
                return { data: { signedUrl: `${b}/signed/${good ? "good" : "expired"}?p=${encodeURIComponent(p)}&n=${window.__count[p]}` }, error: null };
            } }) } };
            examImgUrlCache.clear();
        }, base);

        const mountIn = async (paths) => page.evaluate(async (paths) => {
            const area = document.createElement("div");
            area.id = "kimg-test";
            // ثابت أعلى الشاشة: loading="lazy" لا يحمّل صورةً خارج الشاشة — وهذا مقصود
            area.style.cssText = "position:fixed; top:0; left:0; width:600px; z-index:9999; background:#fff;";
            area.innerHTML = paths.map(p => `<span class="kimg kimg-q"><img class="se-q-img" data-exam-img="${p}" alt="" hidden></span>`).join("");
            (document.getElementById("kimg-test") || {}).remove && document.getElementById("kimg-test").remove();
            document.body.appendChild(area);
            const failed = [];
            area.querySelectorAll("img").forEach(img => mountExamImage(img, (el, why) => { failed.push(why); markExamImageFailed(el, why); }));
            window.__failed = failed;
        }, paths);

        // ١٠) رابط منتهٍ مرّة → إعادة توقيع واحدة → تظهر
        await page.evaluate(() => { window.__mode["a/b/once.png"] = "bad-once"; });
        await mountIn(["a/b/once.png"]);
        await page.waitForTimeout(800);
        let r = await page.evaluate(() => {
            const img = document.querySelector('#kimg-test img');
            return { ready: img && img.classList.contains("is-ready"), signs: window.__count["a/b/once.png"], failed: window.__failed.length,
                     loading: img && img.loading, wrapLoading: img && img.closest(".kimg").classList.contains("is-loading") };
        });
        ok("١٠) انتهى الرابط → أُعيد التوقيع مرّة واحدة وظهرت الصورة", r.ready && r.signs === 2 && r.failed === 0, JSON.stringify(r));
        ok("١٤) loading=lazy وأُزيل هيكل التحميل بعد الظهور", r.loading === "lazy" && !r.wrapLoading, JSON.stringify(r));

        // ١١) ملفّ مفقود فعلاً
        await page.evaluate(() => { window.__mode["a/b/gone.png"] = "bad"; });
        await mountIn(["a/b/gone.png"]);
        await page.waitForTimeout(1200);
        r = await page.evaluate(() => ({ signs: window.__count["a/b/gone.png"], failed: window.__failed,
                                        box: !!document.querySelector("#kimg-test .se-img-failed"), wrap: !!document.querySelector("#kimg-test .kimg") }));
        ok("١١) توقيعان فقط ثم رسالة واضحة — لا حلقة", r.signs === 2 && r.failed.join() === "IMAGE_LOAD_FAILED" && r.box && !r.wrap, JSON.stringify(r));

        // ١٢) alive: التوقيع بطيء، والعنصر يُستبدل قبل وصوله
        await page.evaluate(() => { window.__mode["a/b/slow.png"] = "slow"; });
        await mountIn(["a/b/slow.png"]);
        const stale = await page.evaluate(async () => {
            const old = document.querySelector('#kimg-test img');
            document.getElementById("kimg-test").innerHTML = "<p id='next-q'>السؤال التالي</p>";
            await new Promise(r => setTimeout(r, 700));
            return { oldSrc: old.getAttribute("src"), oldHidden: old.hidden, page: document.getElementById("kimg-test").innerHTML, failed: window.__failed.length };
        });
        ok("١٢) الردّ المتأخّر لم يلمس العنصر القديم ولا الصفحة الجديدة",
            !stale.oldSrc && stale.oldHidden && stale.page === "<p id=\"next-q\">السؤال التالي</p>" && stale.failed === 0, JSON.stringify(stale));

        // ١٣) الذاكرة وانتهاؤها
        await mountIn(["a/b/cache.png", "a/b/cache.png"]);
        await page.waitForTimeout(500);
        await mountIn(["a/b/cache.png"]);
        await page.waitForTimeout(400);
        const c1 = await page.evaluate(() => window.__count["a/b/cache.png"]);
        await page.evaluate(() => { const h = examImgUrlCache.get("a/b/cache.png"); h.until = Date.now() - 1; });
        await mountIn(["a/b/cache.png"]);
        await page.waitForTimeout(400);
        const c2 = await page.evaluate(() => window.__count["a/b/cache.png"]);
        ok("١٣) نفس المسار لا يُوقَّع مرّتين في الذاكرة", c1 <= 2, "توقيعات: " + c1);
        ok("١٣) ويُوقَّع من جديد بعد انتهاء صلاحيته", c2 === c1 + 1, `${c1} → ${c2}`);

        // ١٤) الأبعاد وهيكل التحميل
        const dims = await page.evaluate(async () => {
            window.__mode["a/b/pending.png"] = "slow";
            const area = document.createElement("div");
            area.style.cssText = "position:fixed; top:0; left:0; width:600px; z-index:9999;";
            area.innerHTML = `<span class="kimg kimg-q"><img class="se-q-img" data-exam-img="a/b/pending.png" alt="" hidden></span>`;
            document.body.appendChild(area);
            const img = area.querySelector("img");
            mountExamImage(img, () => {});
            const wrap = img.closest(".kimg");
            const loadingH = wrap.getBoundingClientRect().height;
            const cs = getComputedStyle(img);
            await new Promise(r => setTimeout(r, 900));
            const out = { loadingH, maxW: cs.maxWidth, h: cs.height === "auto" || img.style.height === "" , maxH: cs.maxHeight, bg: cs.backgroundColor, fit: cs.objectFit,
                          ready: img.classList.contains("is-ready") };
            area.remove();
            return out;
        });
        ok("١٤) هيكل تحميل بارتفاعٍ ثابت قبل وصول الصورة", dims.loadingH >= 100, JSON.stringify(dims));
        ok("١٤) max-width:100% وسقفٌ للطول وخلفية بيضاء", dims.maxW === "100%" && dims.maxH !== "none" && dims.bg === "rgb(255, 255, 255)" && dims.fit === "contain", JSON.stringify(dims));

        // ١٥) تصغير قبل الرفع
        const shr = await page.evaluate(async () => {
            const c = document.createElement("canvas"); c.width = 3000; c.height = 2000;
            const g = c.getContext("2d");
            for(let i = 0; i < 400; i++){ g.fillStyle = `hsl(${i * 7},70%,50%)`; g.fillRect((i * 97) % 3000, (i * 53) % 2000, 120, 90); }
            const big = await new Promise(r => c.toBlob(r, "image/jpeg", 0.95));
            const out = await shrinkExamImage(new File([big], "p.jpg", { type:"image/jpeg" }));
            const bmp = await createImageBitmap(out);
            const small = await new Promise(r => { const k = document.createElement("canvas"); k.width = 50; k.height = 40; k.toBlob(r, "image/png"); });
            const same = await shrinkExamImage(new File([small], "s.png", { type:"image/png" }));
            return { w: bmp.width, h: bmp.height, type: out.type, smaller: out.size < big.size, keepSmall: same.size === small.size };
        });
        ok("١٥) صورة ٣٠٠٠×٢٠٠٠ صارت ١٦٠٠×١٠٦٧ بنوعها وأصغر حجماً",
            shr.w === 1600 && Math.abs(shr.h - 1067) <= 1 && shr.type === "image/jpeg" && shr.smaller, JSON.stringify(shr));
        ok("١٥) الصغيرة لا تُمسّ", shr.keepSmall, JSON.stringify(shr));

        /* ============ شاشة الطالب: الترتيب والتكبير ============ */
        console.log("\nشاشة الطالب");
        const se = await page.evaluate(async () => {
            window.__mode = {};
            examImgUrlCache.clear();
            ensureStudentExamOverlay();
            seExam = { id:"x", title:"t", questions:[{ i:0, text:"سؤال", image:"a/b/q.png", choices:[{ text:"أ", ci:0, image:"a/b/c.png" }, { text:"ب", ci:1 }] }] };
            seAnswers = {}; seMarked = new Set(); seIndex = 0; seReview = null;
            const ov = document.getElementById("student-exam-overlay");
            ov.innerHTML = `<div id="se-qnum"></div><div id="se-area"></div><input type="checkbox" id="se-mark"><div id="se-review-note"></div>`;
            ov.style.display = "flex";
            renderSeQuestion();
            await new Promise(r => setTimeout(r, 700));
            const q = document.querySelector("#se-area .se-q-img"), c = document.querySelector("#se-area .se-c-img");
            q.click();
            const zoom = document.querySelector(".se-zoom img");
            const zoomOk = !!zoom && zoom.src === q.src && getComputedStyle(document.querySelector(".se-zoom")).zIndex === "7000";
            document.querySelector(".se-zoom").click();
            return { q: q.classList.contains("is-ready"), c: c.classList.contains("is-ready"), qAlt: q.alt, zoomOk, zoomGone: !document.querySelector(".se-zoom") };
        });
        ok("صورتا السؤال والخيار ظهرتا في شاشة الطالب", se.q && se.c, JSON.stringify(se));
        ok("لمس صورة السؤال يكبّرها فوق الاختبار، ولمسةٌ تغلقه", se.zoomOk && se.zoomGone, JSON.stringify(se));

        ok("لا أخطاء JavaScript في الصفحة", errs.length === 0, errs.join(" | "));
        await ctx.close();
    }finally{
        await browser.close(); srv.close();
    }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
