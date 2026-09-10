/* ============================================================
   فحص تقرير الفصل — على الشاشة وعلى الورق
   ------------------------------------------------------------
   ⚠️ أخطر ما في هذه الميزة أنه لا يراه أحد إلا عند الطباعة. والموقع
   صفحة واحدة، كل واجهاته موجودة في DOM دائماً — فطباعةٌ بلا قواعد
   @media print صحيحة تُخرج عشرات الصفحات من واجهاتٍ مخفيّة قبل أن يصل
   التقرير. ومدير المدرسة هو أول من يكتشف ذلك، أمام من يعرض عليهم.

   ولهذا يُبدّل هذا الفحص وسيط العرض إلى "print" فعلياً
   (emulateMedia) ويقيس ما يظهر وما يختفي — لا يقرأ ملف التنسيقات.

   ⚠️ والمعطيات هنا هي نفسها التي تحقّقتُ من حسابها في قاعدة البيانات
   بعمليةٍ حقيقية ثم تراجعتُ عنها: ثلاثة طلاب، اختباران، ست محاولات
   متوقَّعة وثلاث مسلَّمة. فما يُفحص هنا هو العرض، بعد أن ثبت الحساب.
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
               ".json":"application/json", ".svg":"image/svg+xml", ".png":"image/png",
               ".webmanifest":"application/manifest+json", ".ico":"image/x-icon" };

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

/* مطابقٌ لما أرجعته الدالّة فعلاً في قاعدة البيانات */
const REPORT = {
    school: "مدارس المتقدمة — فرع الملقا",
    class: { id:"c1", name:"ثالث/أ", grade:"3", section:"a" },
    teachers: ["ana btata"],
    generated_at: "2026-09-10T08:30:00Z",
    summary: { students:3, exams:2, expected:6, submitted:3, avg_pct:67 },
    students: [
        { name:"طالب أ", assigned:2, done:2, avg_pct:75, last_at:"2026-09-09T10:00:00Z" },
        { name:"طالب ب", assigned:2, done:1, avg_pct:50, last_at:"2026-09-09T10:00:00Z" },
        { name:"طالب ج", assigned:2, done:0, avg_pct:null, last_at:null },
    ],
    exams: [
        { title:"واجب ١", subject:"رياضيات", teacher:"ana btata", done:2, of:3, avg_pct:70 },
        { title:"واجب ٢", subject:"فيزياء",  teacher:"ana btata", done:1, of:3, avg_pct:60 },
    ],
};

/** يقرأ لون بكسل من الصورة المرسومة فعلاً — لا من ورقة الأنماط.
 *  نُعيد فكّ الصورة داخل المتصفّح نفسه فلا نحتاج مكتبة صور في Node. */
async function samplePixel(page){
    /* ⚠️ نقطة فارغة من الورقة أسفل التذييل — لا الزاوية العليا.
       قِستُ الزاوية أول مرّة فوقعت على حرفٍ من اسم الفصل، فقرأتُ لون نصّ
       وظننتُه لون ورق. */
    const shot = (await page.screenshot({ clip:{ x:600, y:820, width:60, height:60 } })).toString("base64");
    return page.evaluate(async ({ b64, px, py }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width; c.height = img.height;
        const g = c.getContext("2d");
        g.drawImage(img, 0, 0);
        const d = g.getImageData(px, py, 1, 1).data;
        return [d[0], d[1], d[2]];
    }, { b64: shot, px: 30, py: 30 });
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
    const page = await browser.newPage({ viewport:{ width:1440, height:900 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));

    try{
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"load" });
        await page.waitForFunction(() => typeof openClassReport === "function", { timeout:15000 });

        await page.evaluate((rep) => {
            window.__rep = rep;
            window.__fail = null;                    // يُملأ لفحص الرفض لاحقاً
            sb = { rpc: async (name) => {            // ← معجمي لا window.sb
                if(name !== "school_class_report") return { data:null, error:null };
                if(window.__fail) return { data:null, error:{ message: window.__fail } };
                return { data: JSON.parse(JSON.stringify(window.__rep)), error:null };
            } };
            schoolCtx = { schoolId:"s", memberId:"m", role:"admin", fullName:"مدير" };
            window.print = () => { window.__printed = true; };   // لا نفتح حواراً
        }, REPORT);

        /* ---------- ١) ما يقرؤه المدير ---------- */
        console.log("\nالتقرير على الشاشة");
        await page.evaluate(() => openClassReport("c1"));
        await page.waitForSelector("#class-report-page .report-table", { timeout:5000 });

        const shown = await page.evaluate(() => {
            const tiles = [...document.querySelectorAll(".report-tile")].map(t => ({
                v: t.querySelector("b").textContent, k: t.querySelector("span").textContent }));
            const rows = [...document.querySelectorAll(".report-table")][0]
                .querySelectorAll("tbody tr");
            const cells = r => [...r.querySelectorAll("td")].map(td => td.textContent.trim());
            const page_ = document.querySelector(".report-page").getBoundingClientRect();
            return {
                tiles,
                head: document.querySelector(".report-head h1").textContent,
                teachers: document.querySelector(".report-teachers").textContent,
                note: (document.querySelector(".report-note") || {}).textContent || "",
                first: cells(rows[0]),
                last: cells(rows[2]),
                lastCls: rows[2].querySelectorAll("td")[4].className,
                behind: document.querySelectorAll("tr.cr-behind").length,
                left: page_.left, right: window.innerWidth - page_.right,
                examRows: document.querySelectorAll(".report-table")[1].querySelectorAll("tbody tr").length,
            };
        });

        ok("اسم المدرسة في الترويسة", /المتقدمة/.test(shown.head), shown.head);
        ok("ومعلّم الفصل مذكور", /ana btata/.test(shown.teachers), shown.teachers);
        ok("عدد الطلاب ٣", shown.tiles[0] && shown.tiles[0].v === "3", JSON.stringify(shown.tiles));
        ok("عدد الاختبارات ٢", shown.tiles[1] && shown.tiles[1].v === "2");
        /* ٣ من ٦ = ٥٠٪ — وهذا الرقم هو ما يمنع «متوسّط ٩٠٪» من خداع المدير */
        ok("نسبة التسليم محسوبة ٣ من ٦ = ٥٠٪", shown.tiles[2] && shown.tiles[2].v === "50%",
           shown.tiles[2] && shown.tiles[2].v);
        ok("متوسّط الصف ٦٧٪ كما حسبته قاعدة البيانات", shown.tiles[3] && shown.tiles[3].v === "67%");
        ok("ويُقال صراحةً إن ٣ محاولات لم تصل، وإن المتوسّط على المسلَّم وحده",
           /3/.test(shown.note) && /سُلِّم|سلّم/.test(shown.note), shown.note);

        ok("أول طالب في الجدول هو الأعلى متوسّطاً", shown.first[1] === "طالب أ", JSON.stringify(shown.first));
        ok("وصفّه يقرأ ٢ / ٢ / ٧٥٪",
           shown.first[2] === "2" && shown.first[3] === "2" && shown.first[4] === "75%",
           JSON.stringify(shown.first));
        /* ⚠️ فرقٌ يهمّ المدير: من لم يسلّم ليس «صفراً» — الصفر درجةٌ نالها
           بعد محاولة، وهذا لم يحاول. وخلطهما يظلم الطالب في اجتماع. */
        ok("من لم يسلّم يُكتب «لم يسلّم» لا «0%»",
           shown.last[4] === "لم يسلّم", JSON.stringify(shown.last));
        ok("ولا يُلوَّن كدرجة منخفضة", /cr-none/.test(shown.lastCls), shown.lastCls);
        ok("والمتأخّرون عن التسليم مميَّزون (طالبان)", shown.behind === 2, String(shown.behind));
        ok("جدول الاختبارات فيه صفّان", shown.examRows === 2, String(shown.examRows));
        /* ⚠️ المعلّم يُدخل الموعد بالميلادي، والسنة الدراسية ميلادية —
           و"ar-SA" وحدها تعرضه هجرياً. رأيتُها في أول ورقة طبعتُها:
           "٢٧ ربيع الأول ١٤٤٨" مكان ٩ سبتمبر. */
        ok("التواريخ ميلادية لا هجرية",
           /2026/.test(shown.first[5]) && !/هـ/.test(shown.first[5]), shown.first[5]);
        ok("الورقة موسَّطة لا ملتصقة بحافة (فخّ rtl)",
           Math.abs(shown.left - shown.right) < 20,
           `يسار ${Math.round(shown.left)} / يمين ${Math.round(shown.right)}`);

        /* ---------- ٢) الطباعة ---------- */
        console.log("\nعلى الورق");
        await page.evaluate(() => printClassReport());
        ok("زرّ الطباعة استدعى الطباعة فعلاً", await page.evaluate(() => window.__printed === true));
        ok("وُضع صنف الطباعة على <html>",
           await page.evaluate(() => document.documentElement.classList.contains("printing-report")));

        await page.emulateMedia({ media: "print" });
        /* ⚠️ على <body> انتقالٌ لونيّ مدّته نصف ثانية (تبديل الوضع الليلي).
           فالقياس فور تبديل الوسيط يقرأ نقطةً في منتصف التلاشي لا القيمة
           النهائية. قِستُ فوراً فقرأتُ 247,244,238 وظننتُ الورقة غير
           بيضاء، والتنسيق سليم — كان القياس متعجّلاً. */
        await page.waitForTimeout(700);
        const printed = await page.evaluate(() => {
            const vis = el => el && getComputedStyle(el).display !== "none";
            const siblings = [...document.body.children]
                .filter(el => el.id !== "class-report-overlay" && vis(el))
                .map(el => el.tagName + "#" + (el.id || "") + "." + (el.className || "").toString().slice(0,30));
            const ov = document.getElementById("class-report-overlay");
            const low = document.querySelector(".cr-low") || document.querySelector(".cr-mid");
            const thead = document.querySelector(".report-table thead");
            const tile = document.querySelector(".report-tile");
            return {
                overlayVisible: vis(ov),
                overlayPosition: getComputedStyle(ov).position,
                leaked: siblings,
                toolbarHidden: !vis(document.querySelector(".report-toolbar")),
                scoreColor: low ? getComputedStyle(low).color : "",
                theadDisplay: thead ? getComputedStyle(thead).display : "",
                rowBreak: getComputedStyle(document.querySelector(".report-table tbody tr")).breakInside,
                tileBg: tile ? getComputedStyle(tile).backgroundColor : "",
            };
        });

        ok("التقرير هو الظاهر عند الطباعة", printed.overlayVisible);
        /* ⚠️ لولا هذا لخرجت من الطابعة عشرات الصفحات من واجهاتٍ مخفيّة */
        ok("ولا يتسرّب معه أي قسم آخر من الموقع",
           printed.leaked.length === 0, printed.leaked.join(", "));
        ok("والغلاف يصير في مجرى الصفحة لا مثبّتاً (وإلا طُبعت ورقة واحدة)",
           printed.overlayPosition === "static", printed.overlayPosition);
        ok("شريط الأزرار لا يُطبع", printed.toolbarHidden);

        /* ⚠️ لون الورقة يُقاس بالبكسل المرسوم لا بـgetComputedStyle.
           والسبب قاعدة في CSS نفسها: خلفية <body> تنتقل إلى لوحة الصفحة
           (canvas) حين لا يكون للجذر خلفية — فتبقى الاستعلامات تُرجع لون
           الموقع الكريمي بينما المرسوم فعلاً أبيض. قِستُه بالاستعلام أولاً
           فبدا العطل عطلاً وليس به شيء، والبكسل هو ما تراه الطابعة. */
        const cornerPrint = await samplePixel(page);
        ok("الورقة المرسومة بيضاء عند الطباعة",
           cornerPrint.every(v => v >= 250), `RGB ${cornerPrint.join(",")}`);
        /* الطابعة المدرسية بالأبيض والأسود غالباً — فالنسب تُقرأ بالسُّمك */
        ok("النِّسَب تُطبع سوداء لا ملوّنة",
           /rgb\(0,\s*0,\s*0\)/.test(printed.scoreColor), printed.scoreColor);
        ok("بطاقات الملخّص بلا خلفية (المتصفّح لا يطبعها)",
           /rgba\(0,\s*0,\s*0,\s*0\)|transparent/.test(printed.tileBg), printed.tileBg);
        ok("رأس الجدول يتكرّر في كل ورقة",
           printed.theadDisplay === "table-header-group", printed.theadDisplay);
        ok("ولا يُقطع صفُّ طالبٍ بين ورقتين",
           printed.rowBreak === "avoid", printed.rowBreak);

        /* ---------- ٣) بعد الطباعة ---------- */
        console.log("\nبعد الطباعة");
        await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
        const after = await page.evaluate(() => ({
            cls: document.documentElement.classList.contains("printing-report"),
            /* ⚠️ لو بقي الصنف لخرجت أي طباعةٍ لاحقة من الموقع ورقةً بيضاء */
            homeVisible: getComputedStyle(document.body.children[0]).display !== "none",
        }));
        ok("رُفع صنف الطباعة", after.cls === false);
        ok("وعاد باقي الموقع قابلاً للطباعة", after.homeVisible);

        /* ⚠️ قياسٌ ضابط: لولاه لما عرفنا هل البكسل الأبيض أعلاه نتيجةُ
           قواعد الطباعة أم أن الصفحة بيضاء أصلاً فيمرّ الفحص بلا معنى.
           الموقع كريميّ اللون، فالفرق هو الدليل. */
        await page.emulateMedia({ media: "screen" });
        await page.waitForTimeout(700);            // الانتقال اللوني نفسه
        const cornerScreen = await samplePixel(page);
        ok("وعلى الشاشة الصفحة ليست بيضاء (فالقياس أعلاه دليل لا صدفة)",
           !cornerScreen.every(v => v >= 250), `RGB ${cornerScreen.join(",")}`);

        /* ---------- ٤) من لا يحقّ له ---------- */
        console.log("\nمن لا يحقّ له");
        const denied = await page.evaluate(async () => {
            closeClassReport();
            window.__fail = "NOT_ALLOWED";
            await openClassReport("c1");
            return {
                text: document.querySelector(".report-loading").textContent,
                noTable: !document.querySelector(".report-table"),
            };
        });
        ok("يُقال له إن التقرير للإدارة ولمعلّم الفصل",
           /الإدارة|معلّم/.test(denied.text), denied.text.trim());
        ok("ولا يُعرض شيء من بيانات الفصل", denied.noTable);

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

console.log("=== فحص تقرير الفصل ===");
main();
