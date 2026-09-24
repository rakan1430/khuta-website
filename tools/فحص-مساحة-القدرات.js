/* ============================================================
   فحص المرحلة ٣ — مساحة القدرات (واجهة)
   ------------------------------------------------------------
   «بلا درجات للطاقم» وإعادة المحاولة واستبعاد التدريب من السجلّ ووليّ
   الأمر مفحوصة في القاعدة بأدوار حقيقية. هنا الواجهة:
     ١) المنشئ بنوع «تدريب»: قسم القدرات ظاهر، والتأخير مخفي، وما يُحفظ.
     ٢) قائمة المعلّم: «اختبره N طالباً» ولا زرّ «النتائج».
     ٣) الإرسال: لا موعد ولا خيار كشف.
     ٤) الطالب: محاولاته السابقة، ومحاولة جديدة، و«تدرّب مجدداً» بعد التسليم.
     ٥) الروابط: تُضاف لمساحة القدرات ولا تظهر في الروابط العامة.
   التشغيل:  node tools/فحص-مساحة-القدرات.js
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
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderGatTab === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
        await page.waitForTimeout(800);

        console.log("\n١) المنشئ بنوع «تدريب»");
        const b = await page.evaluate(async () => {
            await sb.from("teacher_exams").insert({ id:"P1", title:"تدريب التناظر", kind:"practice", gat_section:"verbal",
                question_count:5, published:true, owner_id:"M1", created_at:new Date().toISOString() });
            const realRpc = sb.rpc;
            sb.rpc = async (fn, a) => fn === "practice_takers" ? { data:[{ exam_id:"P1", takers:3 }], error:null } : realRpc(fn, a);
            switchTab("schoolgat");
            await new Promise(r => setTimeout(r, 500));
            const vis = id => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== "none"; };
            const list = document.getElementById("sgat-tests");
            return { inGat: !!document.querySelector("#sgat-builder-host #exam-builder-wrap"),
                     section: vis("exam-gat-wrap"), late: vis("exam-late-wrap"), hint: vis("exam-practice-hint"),
                     label: document.getElementById("exam-title-label").textContent,
                     listText: list.textContent, results: !!list.querySelector("[onclick^='openSchoolExamResults']"),
                     onlyPractice: !/اختبار الوحدة/.test(list.textContent) };
        });
        ok("المنشئ انتقل لمساحة القدرات", b.inGat);
        ok("قسم القدرات ظاهر، والتأخير مخفي، وتنبيه «بلا درجات»", b.section && !b.late && b.hint);
        ok("العنوان «اختبار التدريب»", /التدريب/.test(b.label), b.label);
        ok("المعلّم يرى «اختبره 3 طالباً» والقسم «لفظي»", /اختبره 3 طالباً/.test(b.listText) && /لفظي/.test(b.listText), b.listText.slice(0, 160));
        ok("لا زرّ «النتائج» للتدريب", !b.results);
        ok("قائمة التدريب لا تعرض الاختبارات العادية", b.onlyPractice);

        const saved = await page.evaluate(async () => {
            let row = null;
            const realFrom = sb.from;
            sb.from = t => { const q = realFrom(t); if(t === "teacher_exams"){ const ins = q.insert; q.insert = r => { row = r; return ins(r); }; } return q; };
            document.getElementById("exam-title").value = "تدريب كمّي ١";
            document.getElementById("exam-gat-section").value = "quant";
            examDraft = { questions:[{ id:"q1", text:"٢+٢", image:null, choices:[{ text:"٣", image:null }, { text:"٤", image:null }], correct:1, explanation:null }] };
            await saveExamDraft();
            sb.from = realFrom;
            return row && { kind: row.kind, section: row.gat_section, late: row.late_days };
        });
        ok("يُحفظ kind=practice وقسمه «كمّي» بلا تأخير", saved && saved.kind === "practice" && saved.section === "quant" && saved.late === 0, JSON.stringify(saved));

        console.log("\n٢) الإرسال");
        const send = await page.evaluate(async () => {
            await openExamSend("P1");
            const dueWrap = document.getElementById("exam-send-due").closest(".form-group");
            const r = { title: document.querySelector("#exam-send-modal h3").textContent,
                        due: getComputedStyle(dueWrap).display, reveal: getComputedStyle(document.getElementById("exam-send-reveal-wrap")).display,
                        settings: readExamSendSettings() };
            closeExamSend();
            await openExamSend("X1");
            r.examDue = getComputedStyle(document.getElementById("exam-send-due").closest(".form-group")).display;
            closeExamSend();
            return r;
        });
        ok("العنوان «إرسال اختبار التدريب»", /التدريب/.test(send.title), send.title);
        ok("لا موعد ولا خيار كشف", send.due === "none" && send.reveal === "none");
        ok("الإعداد: بلا موعد، والكشف فوري", send.settings.dueAt === null && send.settings.reveal === "immediately", JSON.stringify(send.settings));
        ok("الاختبار العادي: حقل الموعد عاد", send.examDue !== "none");

        console.log("\n٣) الطالب");
        const st = await page.evaluate(async () => {
            const fake = { id:"P1", title:"تدريب التناظر", kind:"practice", can_review:true, owner_id:"M1",
                attempts:[{ score:3, total:5, at:new Date().toISOString() }, { score:2, total:5, at:new Date(Date.now()-864e5).toISOString() }],
                attempt:{ score:3, total:5 },
                questions:[{ i:0, text:"س", choices:[{ text:"أ", ci:0 }, { text:"ب", ci:1 }] }] };
            let submitted = 0;
            sb.rpc = async fn => fn === "get_exam_for_student" ? { data: fake, error:null }
                             : fn === "submit_exam_attempt" ? (submitted++, { data:{ score:1, total:1 }, error:null })
                             : fn === "get_exam_review" ? { data:{ questions:[{ i:0, text:"س", choices:["أ","ب"], correct:1, given:1 }] }, error:null }
                             : { data:null, error:null };
            await openStudentExam("P1");
            const ov = document.getElementById("student-exam-overlay");
            const intro = { text: ov.textContent, newBtn: !!ov.querySelector("[onclick^='restartPractice']") };
            restartPractice();
            const shell = { finish: /إنهاء التدريب/.test(ov.textContent) };
            document.querySelector("#se-area .exam-choice").click();
            await submitStudentExam(true);
            const result = { again: !!ov.querySelector("[onclick^='restartPractice']"), note: /لا تُسجَّل درجة/.test(ov.textContent),
                             review: !!ov.querySelector("[onclick^='openExamReview']") };
            await openExamReview();
            const reviewAgain = !!ov.querySelector("[onclick^='restartPractice']");
            closeStudentExam();
            return { intro, shell, result, reviewAgain, submitted };
        });
        ok("شاشة المحاولات السابقة: «3 / 5» و«2 / 5»", /3 \/ 5/.test(st.intro.text) && /2 \/ 5/.test(st.intro.text));
        ok("وزرّ «محاولة جديدة»", st.intro.newBtn);
        ok("المحاولة الجديدة تفتح الأسئلة بزرّ «إنهاء التدريب»", st.shell.finish);
        ok("بعد التسليم: «تدرّب مجدداً» و«راجع إجاباتك» وتنبيه «لا تُسجَّل درجة»", st.result.again && st.result.review && st.result.note);
        ok("وفي المراجعة أيضاً «تدرّب مجدداً»", st.reviewAgain);

        const first = await page.evaluate(async () => {
            const fake = { id:"P1", title:"تدريب", kind:"practice", can_review:false, owner_id:"M1", attempts:[],
                questions:[{ i:0, text:"س", choices:[{ text:"أ", ci:0 }, { text:"ب", ci:1 }] }] };
            sb.rpc = async fn => fn === "get_exam_for_student" ? { data: fake, error:null }
                             : fn === "submit_exam_attempt" ? { data:{ score:0, total:1 }, error:null }
                             : fn === "may_review_exam" ? { data:true, error:null } : { data:null, error:null };
            await openStudentExam("P1");
            const ov = document.getElementById("student-exam-overlay");
            const direct = /إنهاء التدريب/.test(ov.textContent);
            document.querySelector("#se-area .exam-choice").click();
            await submitStudentExam(true);
            const review = !!ov.querySelector("[onclick^='openExamReview']");
            closeStudentExam();
            return { direct, review };
        });
        ok("أول محاولة: تبدأ مباشرة بلا شاشة محاولات", first.direct);
        ok("وبعد تسليمها يظهر «راجع إجاباتك» (يُسأل الخادم من جديد)", first.review);

        const stList = await page.evaluate(async () => {
            switchDemoRole("student");
            sb.rpc = async fn => fn === "my_assigned_work" ? { data:[{ exam_id:"P1", kind:"practice", done:true, score:3, total:5 }], error:null }
                             : fn === "school_settings" ? { data: DEMO_SETTINGS, error:null } : { data:null, error:null };
            switchTab("schoolgat");
            await new Promise(r => setTimeout(r, 500));
            const t = document.getElementById("sgat-tests");
            return { text: t.textContent, forms: document.getElementById("sgat-forms").textContent.trim(), builderShown:
                getComputedStyle(document.getElementById("exam-builder-wrap")).display };
        });
        ok("قائمة الطالب: «آخر محاولة 3 / 5» و«تدرّب مجدداً»", /3 \/ 5/.test(stList.text) && /تدرّب مجدداً/.test(stList.text), stList.text.slice(0, 160));
        ok("لا عدد مختبرين ولا نماذج إضافة للطالب", !/اختبره/.test(stList.text) && !stList.forms);
        ok("ولا منشئ اختبارات للطالب", stList.builderShown === "none");

        console.log("\n٤) الروابط والملفات في مساحتها");
        const res = await page.evaluate(async () => {
            switchDemoRole("teacher");
            sb.rpc = async fn => fn === "school_settings" ? { data: DEMO_SETTINGS, error:null } : { data:[], error:null };
            switchTab("schoolgat");
            await new Promise(r => setTimeout(r, 400));
            const toasts = []; const real = showToast; showToast = m => { toasts.push(m); real(m); };
            document.querySelector("#sgat-forms details").open = true;
            document.getElementById("gat-link-label").value = "شرح الخطأ السياقي";
            document.getElementById("gat-link-url").value = "javascript:alert(1)";
            await addGatLink();
            const rejected = /https/.test(toasts.join(" "));
            document.getElementById("gat-link-url").value = "https://youtu.be/abc";
            await addGatLink();
            await new Promise(r => setTimeout(r, 300));
            const inGat = /شرح الخطأ السياقي/.test(document.getElementById("sgat-links").textContent);
            switchTab("schoolwork");
            await new Promise(r => setTimeout(r, 400));
            const general = document.getElementById("tlinks-list");
            return { rejected, inGat, notGeneral: general ? !/شرح الخطأ السياقي/.test(general.textContent) : true };
        });
        ok("رابط javascript: يُرفض", res.rejected);
        ok("الرابط يظهر في مساحة القدرات", res.inGat);
        ok("ولا يظهر في الروابط العامة", res.notGeneral);

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
