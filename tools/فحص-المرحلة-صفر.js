/* ============================================================
   فحص المرحلة ٠ — التحميل عند الحاجة على الجوّال + إعدادات المدرسة
   ------------------------------------------------------------
   قرار المالك: على الجوّال لا تُحمَّل ملفات المدرسة إلا عند الحاجة، وعلى
   الكمبيوتر والتطبيق المثبَّت يُحمَّل كل شيء كما كان.

   ما يُفحص:
     ١) الكمبيوتر: كل ملفات المدرسة محمَّلة وبنفس الترتيب الأصلي.
     ٢) الجوّال (متصفّح): لا ملف مدرسة محمَّل، والموقع يعمل بلا خطأ في كل
        أقسام خُطى.
     ٣) الجوّال (تطبيق مثبَّت): يُحمَّل كل شيء كالكمبيوتر.
     ٤) الجوّال + عضو مدرسة (وضع العرض ‎?demo=1‎): تُحمَّل المجموعة، وتظهر
        أقسام المدرسة، وكل زرّ فيها يجد دالّته.
     ٥) أسماء المراحل من الإعدادات، وقوائمها تُملأ.
     ٦) زرّ «إدارة المدارس» على الجوّال يحمّل ملفه عند الضغط.

   التشغيل:  node tools/فحص-المرحلة-صفر.js
   ============================================================ */

let chromium, devices;
try{ ({ chromium, devices } = require("playwright")); }
catch(e){
    console.log("⚠️  يحتاج متصفّحاً حقيقياً:\n    npm install playwright --no-save");
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
               ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml" };

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

const SCHOOL_FILES = ["14-school-work","18-exam-builder","19-exam-send","21-classes","23-school-home",
    "24-student-exam","25-import","28-report","30-parent-links","31-year","32-member-leave",
    "33-attendance","34-school-settings","36-records","37-library","38-gat-space"].map(n => `js/${n}.js`);

/** ملفات جافاسكربت الموقع التي طلبها المتصفّح فعلاً، بالترتيب. */
function trackScripts(page){
    const seen = [];
    page.on("request", r => {
        const u = new URL(r.url());
        if(u.pathname.startsWith("/js/")) seen.push(u.pathname.slice(1));
    });
    return seen;
}

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const guesses = [
        process.env.CHROMIUM_PATH,
        ...(fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
            .filter(d => d.startsWith("chromium"))
            .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")) : []),
    ].filter(p => p && fs.existsSync(p));
    const browser = await chromium.launch(guesses.length ? { executablePath: guesses[0] } : {});
    const iphone = devices["iPhone 13"];

    try{
        /* ============================================================ */
        console.log("\n١) الكمبيوتر: كل شيء كما كان");
        {
            const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
            const page = await ctx.newPage();
            const errs = []; page.on("pageerror", e => errs.push(String(e)));
            const seen = trackScripts(page);
            await page.goto(base + "/index.html", { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            ok("KHUTA_LAZY = false", await page.evaluate(() => window.KHUTA_LAZY === false));
            const missing = SCHOOL_FILES.filter(f => !seen.includes(f));
            ok("كل ملفات المدرسة حُمّلت", missing.length === 0, missing.join("، "));
            /* الترتيب: كل ملف مدرسة يُطلب بين الملف الدائم الذي قبله والذي بعده —
               أي في موضع وسمه الأصلي حرفياً */
            const order = await page.evaluate(() =>
                [...document.querySelectorAll("script[src^='js/']")].map(s => s.getAttribute("src")));
            const expected = fs.readdirSync(path.join(ROOT, "js")).filter(f => /^\d\d-.*\.js$/.test(f)).sort().map(f => "js/" + f);
            ok("ترتيب الملفات في الصفحة يطابق ترتيبها الأصلي", JSON.stringify(order) === JSON.stringify(expected),
               `الفعلي: ${order.join(" ")}`);
            ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
            await ctx.close();
        }

        /* ============================================================ */
        console.log("\n٢) الجوّال في المتصفّح: ملفات المدرسة لا تُحمَّل");
        {
            const ctx = await browser.newContext({ ...iphone });
            const page = await ctx.newPage();
            const errs = []; page.on("pageerror", e => errs.push(String(e)));
            const seen = trackScripts(page);
            await page.goto(base + "/index.html", { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            await page.waitForTimeout(1500);
            ok("KHUTA_LAZY = true", await page.evaluate(() => window.KHUTA_LAZY === true));
            const loaded = SCHOOL_FILES.filter(f => seen.includes(f));
            ok("لا ملف مدرسة طُلب", loaded.length === 0, loaded.join("، "));
            ok("دالّة من ملف مدرسة غير معرَّفة", await page.evaluate(() => typeof loadSchoolWorkspace === "undefined"));
            ok("schoolBusy متاحة رغم ذلك (نُقلت للملف الدائم)", await page.evaluate(() => typeof schoolBusy === "function"));

            // التنقّل في كل أقسام خُطى التي يراها الطالب العادي
            const tabs = await page.evaluate(() => [...document.querySelectorAll(".mobile-nav-item[data-tab]")]
                .filter(el => getComputedStyle(el).display !== "none").map(el => el.getAttribute("data-tab")));
            for(const t of tabs){
                await page.evaluate(t => switchTab(t), t);
                await page.waitForTimeout(150);
            }
            ok(`التنقّل في ${tabs.length} أقسام بلا خطأ جافاسكربت`, errs.length === 0, errs.join("\n       "));

            // كل زرّ ظاهر لطالب خُطى يجد دالّته (أقسام المدرسة مخفية أصلاً)
            const deadVisible = await page.evaluate(() => {
                const out = [];
                document.querySelectorAll("[onclick]").forEach(el => {
                    if(el.closest("[data-modes='school'], [data-school-member], [data-school-role], #view-schoolwork, #view-schoolexams, #view-schooltt, #view-schooladmin, .overlay-screen")) return;
                    const m = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(el.getAttribute("onclick"));
                    if(m && !["event","this","document","window"].includes(m[1])){
                        let exists = false;
                        try{ exists = typeof (0, eval)(m[1]) === "function"; }catch(e){}
                        if(!exists) out.push(m[1]);
                    }
                });
                return [...new Set(out)];
            });
            ok("كل زرّ ظاهر لطالب خُطى يجد دالّته", deadVisible.length === 0, deadVisible.join("، "));
            await ctx.close();
        }

        /* ============================================================ */
        console.log("\n٣) الجوّال في التطبيق المثبَّت: يُحمَّل كل شيء");
        {
            const ctx = await browser.newContext({ ...iphone });
            await ctx.addInitScript(() => {
                const real = window.matchMedia.bind(window);
                window.matchMedia = q => /display-mode:\s*standalone/.test(q)
                    ? { matches:true, media:q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} }
                    : real(q);
            });
            const page = await ctx.newPage();
            const seen = trackScripts(page);
            await page.goto(base + "/index.html", { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            ok("KHUTA_LAZY = false في التطبيق المثبَّت", await page.evaluate(() => window.KHUTA_LAZY === false));
            ok("كل ملفات المدرسة حُمّلت", SCHOOL_FILES.every(f => seen.includes(f)));
            await ctx.close();
        }

        /* ============================================================ */
        console.log("\n٤) الجوّال + عضو مدرسة (وضع العرض): تُحمَّل عند الحاجة");
        {
            const ctx = await browser.newContext({ ...iphone });
            const page = await ctx.newPage();
            const errs = []; page.on("pageerror", e => errs.push(String(e)));
            const seen = trackScripts(page);
            await page.goto(base + "/index.html?demo=1", { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            /* وضع العرض محصور بحكم الكود في روابط معاينة Netlify (بها "--")،
               فلا يعمل على 127.0.0.1. نشغّله يدوياً بنفس دوالّه: عميل وهمي
               ثم عضوية وهمية ثم applySchoolRoleUI — المسار الحقيقي نفسه. */
            await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
            // وضع العرض يضع عضوية وهمية ويستدعي applySchoolRoleUI
            // ننتظر آخر ملف في المجموعة لا أوّلها: الطلبات تُرسل معاً وتُنفَّذ بالترتيب
            await page.waitForFunction(() => typeof loadSchoolWorkspace === "function"
                && typeof renderSchoolSettingsAdmin === "function", { timeout:15000 }).catch(() => {});
            const groupLoaded = await page.evaluate(() => typeof loadSchoolWorkspace === "function"
                && typeof renderSchoolSettingsAdmin === "function");
            ok("مجموعة المدرسة حُمّلت بعد ثبوت العضوية", groupLoaded,
               `طُلب: ${SCHOOL_FILES.filter(f => seen.includes(f)).length}/${SCHOOL_FILES.length}`);
            await page.waitForTimeout(800);
            const navShown = await page.evaluate(() => [...document.querySelectorAll("[data-school-member]")]
                .some(el => getComputedStyle(el).display !== "none"));
            ok("أقسام المدرسة ظهرت", navShown);

            for(const t of ["schoolwork", "schoolexams", "schooltt", "schooladmin"]){
                await page.evaluate(t => { if(document.getElementById("view-" + t)) switchTab(t); }, t);
                await page.waitForTimeout(200);
            }
            const dead = await page.evaluate(() => {
                const out = [];
                document.querySelectorAll("#view-schoolwork [onclick], #view-schoolexams [onclick], #view-schooltt [onclick], #view-schooladmin [onclick]").forEach(el => {
                    const m = /^\s*([A-Za-z_$][\w$]*)\s*\(/.exec(el.getAttribute("onclick"));
                    if(m){
                        let exists = false;
                        try{ exists = typeof (0, eval)(m[1]) === "function"; }catch(e){}
                        if(!exists) out.push(m[1]);
                    }
                });
                return [...new Set(out)];
            });
            ok("كل زرّ في أقسام المدرسة يجد دالّته", dead.length === 0, dead.join("، "));

            /* ============================================================ */
            console.log("\n٥) المراحل من الإعدادات");
            const g = await page.evaluate(() => ({
                name: gradeName("1"),
                legacy: typeof gradeText === "function" ? gradeText("2") : null,
                opts: [...(document.getElementById("exam-grade") || { options:[] }).options].map(o => o.value + ":" + o.textContent),
                unknown: gradeName("99"),
            }));
            ok("gradeName('1') = أول ثانوي", g.name === "أول ثانوي", g.name);
            ok("gradeText القديمة تمرّ عبر الإعدادات", g.legacy === "ثاني ثانوي", g.legacy);
            ok("قائمة المراحل في منشئ الاختبار مُلئت", g.opts.length === 3, g.opts.join(" | "));
            ok("رمز غير معروف يُعرض كما هو لا فارغاً", g.unknown === "99", g.unknown);

            // مدرسة متوسطة: الأسماء تتبدّل فوراً في كل القوائم
            const mid = await page.evaluate(() => {
                schoolSettings = { grades:[
                    { code:"1", label_ar:"أول متوسط", label_en:"Grade 7", sort:1 },
                    { code:"2", label_ar:"ثاني متوسط", label_en:"Grade 8", sort:2 },
                    { code:"3", label_ar:"ثالث متوسط", label_en:"Grade 9", sort:3 },
                    { code:"4", label_ar:"مرحلة <img src=x onerror=alert(1)>", label_en:"x", sort:4 }], subjects:[] };
                applySchoolSettingsUI();
                return {
                    opts: [...document.getElementById("class-grade").options].map(o => o.textContent),
                    next3: typeof yrNextGrade === "function" ? yrNextGrade("3") : "n/a",
                    next4: typeof yrNextGrade === "function" ? yrNextGrade("4") : "n/a",
                };
            });
            ok("قائمة الفصول تعرض مراحل المتوسط", mid.opts[0] === "أول متوسط", mid.opts.join(" | "));
            ok("ملخّص الترقية: الثالث يصعد للرابع لا يتخرّج", mid.next3 === "4", String(mid.next3));
            ok("ملخّص الترقية: الأخيرة تتخرّج", mid.next4 === null, String(mid.next4));
            // اسم مرحلة خبيث يكتبه مدير: يُعرض نصاً لا يُنفَّذ
            await page.evaluate(() => { examSendMode = "grades"; if(typeof renderExamSend === "function"){
                const b = document.getElementById("exam-send-body"); if(b) renderExamSend(); } });
            const inj = await page.evaluate(() => {
                const b = document.getElementById("exam-send-body");
                return { img: !!(b && b.querySelector("img[src='x']")),
                         asText: !!(b && b.textContent.includes("<img src=x onerror=alert(1)>")) };
            });
            // ⚠️ الشرط الثاني يمنع النجاح الفارغ: لو لم تُرسم القائمة أصلاً لما وُجد وسمٌ ولا نص
            ok("اسم مرحلة يحوي وسماً يُعرض نصاً (لا حقن)", !inj.img && inj.asText, JSON.stringify(inj));
            ok("لا خطأ جافاسكربت في مسار المدرسة", errs.length === 0, errs.join("\n       "));
            await ctx.close();
        }

        /* ============================================================ */
        console.log("\n٦) «إدارة المدارس» على الجوّال: تُحمَّل عند الضغط");
        {
            const ctx = await browser.newContext({ ...iphone });
            const page = await ctx.newPage();
            const errs = []; page.on("pageerror", e => errs.push(String(e)));
            await page.goto(base + "/index.html", { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            ok("قبل الضغط: ملف اللوحة غير محمَّل", await page.evaluate(() => typeof ownerSchoolCard === "undefined"));
            await page.evaluate(() => { isAdmin = true; openOwnerSchools(); });
            await page.waitForFunction(() => typeof ownerSchoolCard === "function", { timeout:10000 }).catch(() => {});
            ok("بعد الضغط: الملف حُمّل ودالّته الحقيقية حلّت محلّ البديل",
               await page.evaluate(() => typeof ownerSchoolCard === "function" && !/khutaLoadGroup/.test(String(openOwnerSchools))));
            await page.waitForTimeout(1500);
            ok("اللوحة فُتحت", await page.evaluate(() => {
                const ov = document.getElementById("owner-schools-overlay");
                return !!ov && ov.style.display === "flex";
            }));
            ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
            await ctx.close();
        }
    }finally{
        await browser.close();
        srv.close();
    }
    console.log(`\n=== النتيجة: ${pass} ناجح، ${fail} فاشل ===`);
    process.exit(fail ? 1 : 0);
}

console.log("=== فحص المرحلة ٠ ===");
main().catch(e => { console.error(e); process.exit(1); });
