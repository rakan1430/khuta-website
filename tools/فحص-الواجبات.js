/* ============================================================
   فحص المرحلة ١ — الواجبات (واجهة)
   ------------------------------------------------------------
   قواعد الواجب نفسها (المهلة، الخلط، كشف الحلّ، منع التزوير) مفحوصة في
   قاعدة البيانات مباشرة كطالب حقيقي. هنا ما يخصّ الواجهة:
     ١) تبويب «الواجبات» ينقل المنشئ نفسه، ويُظهر خيار التأخير ويخفيه.
     ٢) مع الخلط: الإجابة تُحفظ برقم السؤال والخيار **الأصليين** — وهذا
        ما يجعل التصحيح في القاعدة صحيحاً. (لو حُفظت بالموضع على الشاشة
        لصُحِّح الطالب على أسئلة غير التي حلّها.)
     ٣) واجب فاتت مهلته: لا تسليم، وزرّ الحلّ إن أُتيح.
     ٤) واجب متأخر ما زال يُقبل: تنبيه «متأخر».
     ٥) نافذة الإرسال: الموعد إلزامي للواجب، وخيار كشف الإجابات مخفي.
     ٦) قائمة الطالب: الحالات والأزرار الصحيحة.

   التشغيل:  node tools/فحص-الواجبات.js
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
        await page.waitForFunction(() => typeof switchTab === "function" && typeof setExamWorkKind === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
        await page.waitForTimeout(800);

        console.log("\n١) المنشئ بين التبويبين");
        await page.evaluate(() => switchTab("schoolhw"));
        await page.waitForTimeout(300);
        const hw = await page.evaluate(() => ({
            inHw: !!document.querySelector("#shw-builder-host #exam-builder-wrap"),
            late: getComputedStyle(document.getElementById("exam-late-wrap")).display !== "none",
            lateDefault: document.getElementById("exam-late-days").value,
            label: document.getElementById("exam-title-label").textContent,
            list: document.getElementById("shw-list").textContent,
        }));
        ok("المنشئ انتقل لتبويب الواجبات", hw.inHw);
        ok("خيار التأخير ظاهر، وافتراضه «غير مسموح»", hw.late && hw.lateDefault === "0");
        ok("العنوان «عنوان الواجب»", /الواجب/.test(hw.label), hw.label);
        ok("قائمة الواجبات فيها الواجب وحده", /واجب الدرس الثالث/.test(hw.list) && !/اختبار الوحدة/.test(hw.list), hw.list.slice(0, 200));

        await page.evaluate(() => switchTab("schoolexams"));
        await page.waitForTimeout(300);
        const ex = await page.evaluate(() => ({
            inEx: !!document.querySelector("#sexams-builder-host #exam-builder-wrap"),
            late: getComputedStyle(document.getElementById("exam-late-wrap")).display !== "none",
            list: document.getElementById("sexams-list").textContent,
        }));
        ok("وعاد لتبويب الاختبارات", ex.inEx);
        ok("خيار التأخير مخفي للاختبار", !ex.late);
        ok("قائمة الاختبارات بلا الواجب", /اختبار الوحدة/.test(ex.list) && !/واجب الدرس/.test(ex.list));

        console.log("\n٢) الخلط: الإجابة بالأرقام الأصلية");
        /* ما يُرسله الخادم لطالبٍ خُلطت أسئلته: السؤال الأصلي ٢ أولاً،
           وخياراته معكوسة. */
        const sent = await page.evaluate(async () => {
            let captured = null;
            const fake = {
                id:"H1", title:"واجب", kind:"homework", late_days:0, due_at:new Date(Date.now()+864e5).toISOString(),
                past_due:false, closed:false, can_review:false, attempt:null, owner_id:"M1",
                questions:[
                    { i:2, text:"س٣", choices:[{text:"ج", ci:2},{text:"ب", ci:1},{text:"أ", ci:0}] },
                    { i:0, text:"س١", choices:[{text:"ب", ci:1},{text:"أ", ci:0}] },
                    { i:1, text:"س٢", choices:[{text:"أ", ci:0},{text:"ب", ci:1}] },
                ],
            };
            sb.rpc = async (fn, args) => {
                if(fn === "get_exam_for_student"){ window.__client = args.p_client; return { data: fake, error:null }; }
                if(fn === "submit_exam_attempt"){ captured = args.p_answers; return { data:{ score:3, total:3, late:false }, error:null }; }
                return { data:null, error:null };
            };
            await openStudentExam("H1");
            // الطالب يختار الخيار الأول الظاهر في كل سؤال
            for(let k = 0; k < 3; k++){
                seGo(k);
                document.querySelector("#se-area .exam-choice").click();
            }
            const answered = document.querySelectorAll("#se-palette .answered").length;
            await submitStudentExam(true);
            return { captured, client: window.__client, answered,
                     result: document.getElementById("student-exam-overlay").textContent };
        });
        ok("الطلب يعلن فهمه للخلط (p_client = 2)", sent.client === 2);
        ok("الإجابات بأرقامها الأصلية: {2:2, 0:1, 1:0}",
           JSON.stringify(sent.captured) === JSON.stringify({ "2":2, "0":1, "1":0 }), JSON.stringify(sent.captured));
        ok("لوحة الأرقام تعدّ الثلاثة مُجابة", sent.answered === 3, String(sent.answered));
        ok("شاشة النتيجة تقول «واجبك»", /سُلّم واجبك/.test(sent.result));
        ok("وتقول إن الحلّ بعد المهلة", /بعد انتهاء مهلة التسليم/.test(sent.result));
        await page.evaluate(() => closeStudentExam());

        console.log("\n٣) واجب فاتت مهلته ولم يُسلَّم");
        const missed = await page.evaluate(async () => {
            sb.rpc = async (fn) => fn === "get_exam_for_student"
                ? { data:{ id:"H2", title:"واجب فائت", kind:"homework", past_due:true, closed:true, can_review:true,
                          attempt:null, questions:[{ i:0, text:"س", choices:[{text:"أ",ci:0},{text:"ب",ci:1}] }] }, error:null }
                : { data:null, error:null };
            await openStudentExam("H2");
            const ov = document.getElementById("student-exam-overlay");
            return { text: ov.textContent, submit: !!ov.querySelector("[onclick^='submitStudentExam']"),
                     review: !!ov.querySelector("[onclick^='openExamReview']") };
        });
        ok("يقول إن المهلة انتهت", /انتهت مهلة تسليم/.test(missed.text));
        ok("لا زرّ تسليم", !missed.submit);
        ok("وزرّ «اطّلع على الحلّ» متاح", missed.review);
        await page.evaluate(() => closeStudentExam());

        console.log("\n٤) متأخر وما زال يُقبل");
        const late = await page.evaluate(async () => {
            sb.rpc = async (fn) => fn === "get_exam_for_student"
                ? { data:{ id:"H3", title:"واجب", kind:"homework", late_days:2, past_due:true, closed:false,
                          due_at:new Date(Date.now()-36e5).toISOString(), close_at:new Date(Date.now()+864e5).toISOString(),
                          attempt:null, questions:[{ i:0, text:"س", choices:[{text:"أ",ci:0},{text:"ب",ci:1}] }] }, error:null }
                : { data:null, error:null };
            await openStudentExam("H3");
            const ov = document.getElementById("student-exam-overlay");
            return { note: !!ov.querySelector(".se-late-note"), submit: /تسليم الواجب/.test(ov.textContent) };
        });
        ok("تنبيه «فات الموعد — يُقبل حتى…»", late.note);
        ok("زرّ «تسليم الواجب» موجود", late.submit);
        await page.evaluate(() => closeStudentExam());

        console.log("\n٥) نافذة الإرسال");
        const send = await page.evaluate(async () => {
            await openExamSend("X3");
            const r = {
                title: document.querySelector("#exam-send-modal h3").textContent,
                reveal: getComputedStyle(document.getElementById("exam-send-reveal-wrap")).display,
                noDue: readExamSendSettings().error || "",
            };
            document.getElementById("exam-send-due").value = "2020-01-01T10:00";
            r.pastDue = readExamSendSettings().error || "";
            closeExamSend();
            await openExamSend("X1");
            r.examReveal = getComputedStyle(document.getElementById("exam-send-reveal-wrap")).display;
            r.examNoDue = readExamSendSettings().error || "";
            closeExamSend();
            return r;
        });
        ok("العنوان «إرسال الواجب»", /الواجب/.test(send.title), send.title);
        ok("خيار كشف الإجابات مخفي للواجب", send.reveal === "none");
        ok("بلا موعد: يُرفض", /حدّد موعد/.test(send.noDue), send.noDue);
        ok("بموعد مضى: يُرفض", /مضى/.test(send.pastDue), send.pastDue);
        ok("الاختبار: كشف الإجابات ظاهر والموعد اختياري", send.examReveal !== "none" && !send.examNoDue);

        console.log("\n٦) قائمة الطالب");
        const list = await page.evaluate(async () => {
            switchDemoRole("student");
            const now = Date.now();
            sb.rpc = async (fn) => fn === "my_assigned_work" ? { data:[
                { exam_id:"X3", kind:"homework", due_at:new Date(now-2*864e5).toISOString(), close_at:new Date(now-864e5).toISOString(),
                  done:false, score:null, total:null, late:false, can_review:true },
            ], error:null } : { data:null, error:null };
            switchTab("schoolhw");
            await new Promise(r => setTimeout(r, 400));
            const box = document.getElementById("shw-list");
            return { text: box.textContent, start: /ابدأ الواجب/.test(box.textContent),
                     sol: !!box.querySelector("[onclick^='openStudentExam']") };
        });
        ok("الواجب الفائت: «فات الموعد»", /فات الموعد/.test(list.text), list.text.slice(0, 200));
        ok("لا «ابدأ الواجب» له، بل زرّ الحلّ", !list.start && list.sol);

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{
        await browser.close(); srv.close();
    }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
