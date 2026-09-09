/* ============================================================
   فحص واجهة اختبار المعلّم في متصفّح حقيقي
   ------------------------------------------------------------
   لماذا متصفّح لا قراءةَ شفرة؟ لأن كل أعطال هذه الواجهة التي وصفها
   المالك كانت **أعطال تخطيط لا منطق**: «الشاشة محشورة في زاوية غير
   واضحة»، «واجهة الاختبار صغيرة جداً بشكل غريب». وشفرةُ مثل هذه الأعطال
   تبدو سليمة تماماً عند القراءة — لا تظهر إلا حين يحسب المتصفّح المقاسات.
   وقد قِستُ من قبل ‎grid-template-columns‎ فوجدتها ‎300px 456px‎ بدل
   ‎300px 1620px‎، ولم يكن ليكشفها إلا القياس.

   ⚠️ ويشمل الفحص ما لا يستطيع المالك رؤيته اليوم: أن الإجابة الصحيحة
   **لا تصل المتصفّح إطلاقاً** قبل التسليم. فحتى لو فتح الطالب أدوات
   المطوّر وقرأ ما في الذاكرة، لا يجد فيها ما يغشّ به.

   ⚠️ والمعطيات هنا مصطنعة: نضع بديلاً لعميل قاعدة البيانات في المتغيّر
   المعجمي ‎sb‎ نفسه — لا في ‎window.sb‎. فملفات الموقع تُحمَّل بوسم
   ‎<script>‎ عادي، و‎let sb‎ فيها متغيّر معجمي لا خاصيّةَ نافذة، وكتابة
   ‎window.sb‎ تصنع متغيّراً آخر لا يراه أحد. (أضعتُ وقتاً على هذا مرّة.)
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

/* اختبار مصطنع: أربعة أسئلة، وأحدها بصورة كي نفحص لوحة "تعذّر العرض" */
const FAKE_EXAM = {
    id: "11111111-1111-1111-1111-111111111111",
    title: "واجب الوحدة الثالثة",
    subject: "رياضيات",
    timed: true, duration_min: 25,
    due_at: "2099-01-01T09:00:00Z",
    owner_id: "22222222-2222-2222-2222-222222222222",
    can_review: false,
    attempt: null,
    questions: [
        { i:0, text:"ما ناتج ٢ + ٢؟", choices:["٣","٤","٥","٦"] },
        { i:1, text:"أي عدد أوّلي؟",  choices:["٩","١٥","١٧","٢١"] },
        { i:2, text:"سؤال بصورة",     choices:["أ","ب"], image:"school/x/lost.png" },
        { i:3, text:"سؤال رابع",      choices:["نعم","لا"] },
    ],
};

const FAKE_REVIEW = {
    questions: [
        { i:0, text:"ما ناتج ٢ + ٢؟", choices:["٣","٤","٥","٦"],  correct:1, given:1 },
        { i:1, text:"أي عدد أوّلي؟",  choices:["٩","١٥","١٧","٢١"], correct:2, given:0 },
        { i:2, text:"سؤال بصورة",     choices:["أ","ب"],            correct:0, given:null },
        { i:3, text:"سؤال رابع",      choices:["نعم","لا"],         correct:0, given:0 },
    ],
};

async function main(){
    const srv = await serve();
    const port = srv.address().port;
    /* متصفّح البيئة مثبَّت مسبقاً برقم مراجعة قد لا يطابق ما تتوقّعه هذه
       النسخة من playwright — فنبحث عنه بدل أن نُثبّت مساراً يتعفّن */
    const guesses = [
        process.env.CHROMIUM_PATH,
        ...(fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
            .filter(d => d.startsWith("chromium"))
            .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")) : []),
    ].filter(p => p && fs.existsSync(p));
    const browser = await chromium.launch(guesses.length ? { executablePath: guesses[0] } : {});
    /* مقاس سبورة الفصل تقريباً — وهو المقاس الذي انكشف فيه عطل الزاوية */
    const page = await browser.newPage({ viewport: { width:1920, height:1080 } });
    const errors = [];
    page.on("pageerror", e => errors.push(String(e)));

    try{
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"load" });
        await page.waitForFunction(() => typeof openStudentExam === "function", { timeout:15000 });

        /* بديل قاعدة البيانات — يُسجّل ما طُلب منه كي نتحقّق من الاستدعاءات */
        await page.evaluate(({ exam, review }) => {
            window.__calls = [];
            const submitted = { score:2, total:4 };
            sb = {                                  // ← معجمي لا window.sb
                rpc: async (name, args) => {
                    window.__calls.push({ name, args });
                    if(name === "get_exam_for_student") return { data: JSON.parse(JSON.stringify(exam)), error:null };
                    if(name === "submit_exam_attempt")  return { data: submitted, error:null };
                    if(name === "get_exam_review")      return { data: JSON.parse(JSON.stringify(review)), error:null };
                    return { data:null, error:null };
                },
                storage: { from: () => ({
                    createSignedUrl: async () => ({ data:null, error:{ message:"Object not found" } }),
                }) },
                from: () => ({ update: () => ({ eq: async () => ({ error:null }) }) }),
            };
            schoolCtx = { schoolId:"s", memberId:"m", role:"student", fullName:"طالب تجريبي" };
            window.confirm = () => true;             // "تركتَ سؤالاً" لا يوقف الفحص
        }, { exam: FAKE_EXAM, review: FAKE_REVIEW });

        /* ---------- ١) الفتح والتخطيط ---------- */
        console.log("\nالتخطيط على مقاس السبورة (1920×1080)");
        await page.evaluate(() => openStudentExam("11111111-1111-1111-1111-111111111111"));
        await page.waitForSelector("#se-palette .exam-palette-item", { timeout:5000 });

        const layout = await page.evaluate(() => {
            const ov = document.getElementById("student-exam-overlay");
            const lay = ov.querySelector(".exam-layout");
            const main = ov.querySelector(".exam-main");
            const area = ov.querySelector(".exam-question-area");
            const cs = getComputedStyle(lay);
            return {
                overlayW: ov.getBoundingClientRect().width,
                layoutW: lay.getBoundingClientRect().width,
                cols: cs.gridTemplateColumns,
                mainW: main.getBoundingClientRect().width,
                areaW: area.getBoundingClientRect().width,
                /* ⚠️ يُقاس داخل العمود لا داخل الشاشة: الشريط الجانبي يأخذ
                   ٣٠٠ بكسل من اليسار، فالتوسيط الصحيح غيرُ موسَّطٍ بالنظر
                   إلى النافذة. (قِستُه أول مرة بالنافذة فبدا العطل عطلاً
                   وليس به شيء.) */
                areaLeft: area.getBoundingClientRect().left - main.getBoundingClientRect().left,
                areaRight: main.getBoundingClientRect().right - area.getBoundingClientRect().right,
            };
        });
        ok("الغلاف يملأ الشاشة", layout.overlayW >= 1900, `العرض ${layout.overlayW}`);
        ok("التخطيط يملأ الغلاف (لا انكماش لعرض المحتوى)",
           layout.layoutW >= 1900, `عرض .exam-layout = ${layout.layoutW}`);
        ok("العمود الثاني يأخذ ما بقي من الشاشة",
           layout.mainW > 1500, `عرض .exam-main = ${layout.mainW} — الأعمدة: ${layout.cols}`);
        ok("منطقة السؤال موسَّطة داخل العمود لا ملتصقة بحافة (عطل rtl القديم)",
           Math.abs(layout.areaLeft - layout.areaRight) < 40,
           `يسار ${Math.round(layout.areaLeft)} / يمين ${Math.round(layout.areaRight)} داخل عمودٍ عرضه ${Math.round(layout.mainW)}`);

        /* ---------- ٢) الإجابة الصحيحة لا تصل المتصفّح ---------- */
        console.log("\nما وصل المتصفّح فعلاً");
        const leak = await page.evaluate(() => {
            const s = JSON.stringify(seExam);
            return { hasCorrect: /"correct"/.test(s), n: seQuestions().length };
        });
        /* ⚠️ وحدُّ ما يثبته هذا السطر: أن الواجهة لا تجلب الإجابات بطريقٍ
           ثانٍ ولا تحتفظ بها. أما أن الخادم نفسه لا يرسلها فيثبته الفحص في
           قاعدة البيانات على get_exam_for_student — لا هذا. */
        ok("الواجهة لا تحمل حقل correct قبل التسليم", !leak.hasCorrect);
        ok("وصلت الأسئلة الأربعة", leak.n === 4);

        /* ---------- ٣) لوحة الأرقام والتمييز ---------- */
        console.log("\nلوحة الأرقام وتمييز السؤال");
        ok("اللوحة فيها زرّ لكل سؤال",
           (await page.locator("#se-palette .exam-palette-item").count()) === 4);

        await page.evaluate(() => sePick(1));
        const afterPick = await page.evaluate(() => ({
            selected: !!document.querySelectorAll("#se-area .exam-choice")[1].classList.contains("selected"),
            paletteAnswered: document.querySelectorAll("#se-palette .exam-palette-item.answered").length,
            stat: document.querySelector("#se-stats .exam-stat-box b").textContent,
        }));
        ok("اختيار الإجابة يلوّن الخيار", afterPick.selected);
        ok("ويُضيء رقم السؤال في اللوحة", afterPick.paletteAnswered === 1);
        ok("ويرفع عدّاد «مُجاب»", afterPick.stat === "1");

        await page.evaluate(() => { seGo(2); seToggleMark(true); });
        ok("تمييز السؤال للمراجعة يظهر في اللوحة",
           (await page.locator("#se-palette .exam-palette-item.marked").count()) === 1);

        /* ---------- ٤) تكبير الخط ---------- */
        console.log("\nتكبير الخط");
        const fonts = await page.evaluate(() => {
            const t = () => parseFloat(getComputedStyle(document.querySelector("#se-area .exam-question-text")).fontSize);
            seSetFont(0);  const mid = t();
            seSetFont(1);  const big = t();
            seSetFont(-1); const small = t();
            seSetFont(0);
            return { small, mid, big };
        });
        ok("A+ يكبّر و A- يصغّر فعلاً",
           fonts.big > fonts.mid && fonts.mid > fonts.small,
           `${fonts.small} / ${fonts.mid} / ${fonts.big}`);

        /* ---------- ٥) المؤقّت ---------- */
        console.log("\nالمؤقّت (بيد المعلّم)");
        const timer = await page.evaluate(() => ({
            shown: !!document.getElementById("se-timer"),
            text: (document.getElementById("se-timer") || {}).textContent,
        }));
        ok("يظهر حين يشغّله المعلّم", timer.shown);
        ok("ويبدأ من المدّة المحدَّدة (٢٥ دقيقة)", timer.text === "25:00", `القيمة: ${timer.text}`);

        /* ---------- ٦) الصورة المفقودة تقول سببها ---------- */
        console.log("\nالصورة التي تعذّر عرضها");
        await page.evaluate(() => seGo(2));
        await page.waitForSelector("#se-area .se-img-failed", { timeout:5000 });
        const imgFail = await page.evaluate(() => ({
            box: !!document.querySelector("#se-area .se-img-failed"),
            why: (document.querySelector("#se-area .se-img-failed small") || {}).textContent || "",
            stillImg: !!document.querySelector("#se-area img[data-exam-img]"),
        }));
        ok("لوحة بديلة مكان الصورة لا فراغ", imgFail.box);
        ok("وتُظهر السبب لا «تعذّر» وحدها", /Object not found/i.test(imgFail.why), imgFail.why);
        ok("ولا تبقى صورة مكسورة في الصفحة", !imgFail.stillImg);

        /* ---------- ٧) التسليم والنتيجة ---------- */
        console.log("\nالتسليم");
        await page.evaluate(() => submitStudentExam());
        await page.waitForSelector(".se-result-card", { timeout:5000 });
        const result = await page.evaluate(() => {
            const card = document.querySelector(".se-result-card");
            const r = card.getBoundingClientRect();
            return {
                pct: document.querySelector(".se-score").textContent,
                reviewBtn: /راجع إجاباتك/.test(card.textContent),
                hint: card.textContent.includes("بعد موعد التسليم"),
                left: r.left, right: window.innerWidth - r.right,
                sent: (window.__calls.find(c => c.name === "submit_exam_attempt") || {}).args,
            };
        });
        ok("النسبة تُحسب من درجة الخادم (٢ من ٤)", result.pct === "50%", result.pct);
        /* اختِير الخيار رقم ١ والطالبُ على السؤال رقم ٠ — فالمفتاح رقم
           السؤال والقيمةُ رقم الخيار، لا العكس */
        ok("الإجابات المُرسَلة هي ما اختاره الطالب (السؤال ٠ ← الخيار ١)",
           JSON.stringify(result.sent && result.sent.p_answers) === '{"0":1}',
           JSON.stringify(result.sent));
        ok("بطاقة النتيجة موسَّطة لا ملتصقة بحافة",
           Math.abs(result.left - result.right) < 40,
           `يسار ${Math.round(result.left)} / يمين ${Math.round(result.right)}`);
        ok("لا زرّ مراجعة حين يمنعها المعلّم", !result.reviewBtn);
        ok("ويُقال للطالب متى تظهر له الإجابات", result.hint);

        /* ---------- ٨) المراجعة حين يسمح المعلّم ---------- */
        console.log("\nالمراجعة بعد أن يسمح المعلّم");
        await page.evaluate(async () => {
            seExam.can_review = true;
            await showStudentExamResult({ score:2, total:4 }, true);
            await openExamReview();
        });
        await page.waitForSelector("#se-area .exam-choice.correct", { timeout:5000 });
        const rev = await page.evaluate(() => {
            seGo(1);
            const ch = [...document.querySelectorAll("#se-area .exam-choice")];
            return {
                correctIdx: ch.findIndex(c => c.classList.contains("correct")),
                wrongIdx: ch.findIndex(c => c.classList.contains("incorrect")),
                flags: document.querySelectorAll("#se-palette .exam-palette-item.incorrect-flag").length,
                right: document.querySelector("#se-stats .exam-stat-box b").textContent,
                noMark: !document.getElementById("se-mark"),
                note: (document.getElementById("se-review-note") || {}).textContent || "",
            };
        });
        ok("الصحيح يُظلَّل أخضر في موضعه", rev.correctIdx === 2, `الموضع ${rev.correctIdx}`);
        ok("وإجابة الطالب الخاطئة تُظلَّل أحمر", rev.wrongIdx === 0, `الموضع ${rev.wrongIdx}`);
        ok("اللوحة تُعلّم الأسئلة الخاطئة (٢ من ٤)", rev.flags === 2, `العدد ${rev.flags}`);
        ok("عدّاد الصحيح يطابق (٢)", rev.right === "2", rev.right);
        ok("لا خانة تمييز أثناء المراجعة", rev.noMark);
        ok("ويُقال للطالب إن إجابته خاطئة", /خاطئة/.test(rev.note), rev.note);

        /* الضغط على خيار أثناء المراجعة لا يغيّر شيئاً */
        const before = await page.evaluate(() => JSON.stringify(seAnswers));
        await page.evaluate(() => sePick(3));
        const after = await page.evaluate(() => JSON.stringify(seAnswers));
        ok("الضغط على الخيارات أثناء المراجعة لا يبدّل إجابة", before === after);

        /* ---------- ٩) الشاشة الضيّقة (جوّال الطالب) ---------- */
        console.log("\nالشاشة الضيّقة");
        await page.setViewportSize({ width:400, height:720 });
        await page.evaluate(async () => {
            seReview = null;
            await openStudentExam("11111111-1111-1111-1111-111111111111");
        });
        await page.waitForSelector("#se-palette .exam-palette-item", { timeout:5000 });
        const narrow = await page.evaluate(() => {
            const ov = document.getElementById("student-exam-overlay");
            const foot = ov.querySelector(".exam-question-footer");
            return {
                /* ⚠️ الغلاف overflow:hidden في المقاس الواسع. وتحت ٩٠٠ بكسل
                   يصير التخطيط بارتفاع محتواه، فلولا overflow-y:auto لبقي
                   زرّ "التالي" مقتطعاً أسفل الشاشة بلا تمرير إليه. */
                canScroll: ov.scrollHeight > ov.clientHeight + 2,
                overflowY: getComputedStyle(ov).overflowY,
                docWide: document.documentElement.scrollWidth > window.innerWidth + 1,
                footReachable: !!foot,
            };
        });
        ok("الغلاف قابل للتمرير على الجوّال", narrow.overflowY === "auto", narrow.overflowY);
        ok("لا تمرير أفقي (لا شيء أعرض من الشاشة)", !narrow.docWide);
        ok("تذييل التنقّل موجود لا مقتطَع", narrow.footReachable);

        /* ---------- ١٠) لا أخطاء جافاسكربت ---------- */
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

console.log("=== فحص واجهة اختبار المعلّم في متصفّح حقيقي ===");
main();
