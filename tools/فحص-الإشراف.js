/* ============================================================
   فحص الإشراف على المجتمع — واجهة الإبلاغ وصندوق المراجعة
   ------------------------------------------------------------
   ⚠️ منطق الإشراف كلّه في قاعدة البيانات، وقد فُحص هناك بعملياتٍ حقيقية
   ثم تُراجع عنها: خمسة أشخاص يُخفون، وشخصٌ واحد يبلّغ خمس مرات لا
   يُخفي، والمخفيّ لا يقرؤه أحد ولا كاتبه، والمهلة أسبوع.

   وما يُفحص هنا هو ما لا تراه قاعدة البيانات: هل تقول الواجهة للطالب
   **لماذا** رُفضت مشاركته؟ فقبل هذا كانت تقول "تعذّر النشر" لأي سبب —
   والطالب الذي وضع رقم جوّاله في سؤال بريء يقرأ ذلك فيظنّ الموقع
   معطّلاً، ويعيد المحاولة، ثم يتركه. وهذا عطلٌ لا يظهر في أي سجلّ.

   ⚠️ وفيه ما هو أدقّ: ألّا تكشف الواجهة كم بلاغاً بقي قبل الإخفاء. من
   يعرف أن الحدّ خمسة ينسّق خمسة حسابات ويُخفي ما يشاء.
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

/* نفس الشكل الذي تُرجعه moderation_queue فعلاً */
const QUEUE = [
    { id: 501, author_name:"صقر مثابر 42", message:"مشاركه أُبلغ عنها",
      created_at:"2026-09-08T10:00:00Z", hidden_at:"2026-09-09T10:00:00Z",
      purge_after:"2026-09-16T10:00:00Z", reports:5, reasons:["إعلان","إساءة"] },
    { id: 502, author_name:"نجم هادئ 17", message:"مشاركه ثانيه",
      created_at:"2026-09-01T10:00:00Z", hidden_at:"2026-09-02T10:00:00Z",
      /* مهلتها توشك أن تنتهي — يجب أن تُميَّز */
      purge_after: new Date(Date.now() + 36e5 * 20).toISOString(), reports:6, reasons:[] },
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
        await page.waitForFunction(() => typeof refreshModerationQueue === "function", { timeout:15000 });

        await page.evaluate((queue) => {
            window.__queue = queue;
            window.__calls = [];
            window.__toasts = [];
            window.__reportResult = { count:1, hidden:false, needed:5 };
            window.__rpcError = null;

            sb = {                                   // ← معجمي لا window.sb
                rpc: async (name, args) => {
                    window.__calls.push({ name, args });
                    if(window.__rpcError && name === "report_forum_post")
                        return { data:null, error:{ message: window.__rpcError } };
                    if(name === "moderation_queue")
                        return { data: JSON.parse(JSON.stringify(window.__queue)), error:null };
                    if(name === "report_forum_post")
                        return { data: window.__reportResult, error:null };
                    if(name === "moderate_post"){
                        window.__queue = window.__queue.filter(q => q.id !== args.p_post);
                        return { data: args.p_keep ? "KEPT" : "REMOVED", error:null };
                    }
                    return { data:null, error:null };
                },
            };
            showToast = (m) => window.__toasts.push(String(m));
            refreshForum = () => {};
            window.confirm = () => true;
            window.prompt = () => "إعلان";
        }, QUEUE);

        /* ---------- ١) لماذا رُفضت مشاركتي؟ ---------- */
        console.log("\nسبب رفض المشاركة");
        const reasons = await page.evaluate(() => {
            const mk = code => ({ message: `POST_REJECTED_${code}`, code:"23514" });
            return {
                link:    postRejectionText(mk("LINK")),
                contact: postRejectionText(mk("CONTACT")),
                abuse:   postRejectionText(mk("ABUSE")),
                fast:    postRejectionText(mk("TOO_FAST")),
                dup:     postRejectionText(mk("DUPLICATE")),
                imperson:postRejectionText(mk("IMPERSONATION")),
                unknown: postRejectionText({ message:"some network failure" }),
            };
        });
        ok("الرابط يُقال سببه صراحةً", /روابط/.test(reasons.link), reasons.link);
        ok("ورقم التواصل يُشرح خطره لا يُمنع فقط",
           /جوّال/.test(reasons.contact) && /يقرأه/.test(reasons.contact), reasons.contact);
        ok("والإساءة", /مسيء/.test(reasons.abuse), reasons.abuse);
        ok("والنشر السريع", /انتظر/.test(reasons.fast), reasons.fast);
        ok("والتكرار", /نفسها/.test(reasons.dup), reasons.dup);
        ok("وانتحال الصفة", /إدارة/.test(reasons.imperson), reasons.imperson);
        /* ⚠️ عطلٌ قديم: كل خطأ كان يُقرأ "تعذّر النشر". فما لا نعرفه يبقى
           عاماً، وما نعرفه يُقال — لا العكس. */
        ok("وما لا نعرف سببه يبقى عاماً بلا ادّعاء",
           /تعذّر النشر/.test(reasons.unknown), reasons.unknown);
        ok("ولا رسالتان متطابقتان (كل سبب له نصّه)",
           new Set(Object.values(reasons)).size === Object.keys(reasons).length);

        /* ---------- ٢) الإبلاغ ---------- */
        console.log("\nالإبلاغ");
        await page.evaluate(() => reportForumPost(501));
        const rep = await page.evaluate(() => ({
            call: window.__calls.find(c => c.name === "report_forum_post"),
            toast: window.__toasts.slice(-1)[0],
        }));
        ok("يُرسَل البلاغ بمعرّف المشاركة", rep.call && rep.call.args.p_post === 501,
           JSON.stringify(rep.call));
        ok("ومعه سبب المبلّغ", rep.call && rep.call.args.p_reason === "إعلان");
        /* ⚠️ من يعرف أن الحدّ خمسة ينسّق خمسة حسابات ويُخفي ما يشاء */
        ok("ولا يُكشف كم بلاغاً بقي قبل الإخفاء",
           !/\d/.test(rep.toast || ""), rep.toast);

        const hid = await page.evaluate(async () => {
            window.__reportResult = { count:5, hidden:true, needed:5 };
            await reportForumPost(502);
            return window.__toasts.slice(-1)[0];
        });
        ok("وحين تُخفى يُقال إنها تنتظر مراجعة الإدارة",
           /أُخفيت/.test(hid) && /الإدارة/.test(hid), hid);

        const denied = await page.evaluate(async () => {
            const out = {};
            for(const err of ["OWN_POST","ANON_NOT_ALLOWED","NOT_SIGNED_IN"]){
                window.__rpcError = err;
                await reportForumPost(501);
                out[err] = window.__toasts.slice(-1)[0];
            }
            window.__rpcError = null;
            return out;
        });
        ok("الإبلاغ على مشاركة النفس يُشرح", /مشاركتك/.test(denied.OWN_POST), denied.OWN_POST);
        ok("والضيف يُقال له إنه يحتاج حساباً باسمه",
           /زائر/.test(denied.ANON_NOT_ALLOWED), denied.ANON_NOT_ALLOWED);
        ok("وغير المسجَّل يُطلب منه الدخول",
           /الدخول/.test(denied.NOT_SIGNED_IN), denied.NOT_SIGNED_IN);

        /* ---------- ٣) الصندوق لا يظهر لغير المشرف ---------- */
        console.log("\nصندوق المراجعة");
        await page.evaluate(async () => { isAdmin = false; await refreshModerationQueue(); });
        const asUser = await page.evaluate(() => ({
            hidden: document.getElementById("moderation-card").style.display === "none",
            asked: window.__calls.filter(c => c.name === "moderation_queue").length,
        }));
        ok("مخفيّ عن الطالب العادي", asUser.hidden);
        /* ⚠️ ولا يُنادى الصندوق أصلاً: نداءٌ يُرفض من الخادم يبقى رفضاً
           في السجلّ كل مرة، ويُغري بقراءة الردّ. */
        ok("ولا يُطلب من الخادم إطلاقاً", asUser.asked === 0, String(asUser.asked));

        await page.evaluate(async () => { isAdmin = true; await refreshModerationQueue(); });
        /* ⚠️ "attached" لا "visible": البطاقة داخل قسم المجتمع، وقسمُ أي
           تبويب غير مفتوح مخفيٌّ في هذا الموقع كلّه. فالمقصود هنا أن
           الصفوف بُنيت بمحتواها الصحيح، لا أن التبويب مفتوح. */
        await page.waitForSelector("#moderation-list .mod-row", { state:"attached", timeout:5000 });
        const asAdmin = await page.evaluate(() => {
            const rows = [...document.querySelectorAll("#moderation-list .mod-row")];
            return {
                n: rows.length,
                count: document.getElementById("moderation-count").textContent,
                firstMsg: rows[0].querySelector(".mod-message").textContent,
                reports: rows[0].querySelector(".mod-pill").textContent.trim(),
                reasons: [...rows[0].querySelectorAll(".mod-reasons span")].map(s => s.textContent),
                left0: rows[0].querySelector(".mod-left").textContent.trim(),
                urgent0: rows[0].querySelector(".mod-left").classList.contains("urgent"),
                urgent1: rows[1].querySelector(".mod-left").classList.contains("urgent"),
                swept: window.__calls.some(c => c.name === "sweep_expired_moderation"),
            };
        });
        ok("المشرف يرى المشاركتين", asAdmin.n === 2, String(asAdmin.n));
        ok("والعدّاد يطابق", asAdmin.count === "2", asAdmin.count);
        ok("ونصّ المشاركة معروض ليقرأه قبل أن يقرّر", /أُبلغ عنها/.test(asAdmin.firstMsg));
        ok("وعدد البلاغات", /5/.test(asAdmin.reports), asAdmin.reports);
        ok("وأسباب المبلّغين", asAdmin.reasons.length === 2, JSON.stringify(asAdmin.reasons));
        /* ⚠️ المهلة مكتوبة على الصفّ: مهلةٌ لا تراها الإدارة لا وجود لها */
        ok("ومهلة الحذف مكتوبة على كل صفّ", /يُحذف/.test(asAdmin.left0), asAdmin.left0);
        ok("وما اقترب موعده يُميَّز باللون", asAdmin.urgent1 === true && asAdmin.urgent0 === false);
        ok("ويُكنس المنتهي عند الفتح (لا نتّكل على الجدولة وحدها)", asAdmin.swept);

        /* ---------- ٤) القرار ---------- */
        console.log("\nقرار الإدارة");
        await page.evaluate(() => decideModeration(501, true));
        await page.waitForFunction(() =>
            document.querySelectorAll("#moderation-list .mod-row").length === 1, { timeout:5000 });
        const kept = await page.evaluate(() => ({
            call: window.__calls.filter(c => c.name === "moderate_post").slice(-1)[0],
            toast: window.__toasts.slice(-1)[0],
        }));
        ok("«أعِدها» تُرسل p_keep = true",
           kept.call && kept.call.args.p_post === 501 && kept.call.args.p_keep === true,
           JSON.stringify(kept.call));
        /* ⚠️ ومسحُ البلاغات جزءٌ من القرار: لولاه أخفاها البلاغ السادس
           فوراً وصار قرار الإدارة بلا أثر. */
        ok("ويُقال إن بلاغاتها مُسحت", /بلاغاتها/.test(kept.toast), kept.toast);

        await page.evaluate(() => decideModeration(502, false));
        await page.waitForFunction(() =>
            document.querySelectorAll("#moderation-list .mod-row").length === 0, { timeout:5000 });
        const removed = await page.evaluate(() => ({
            call: window.__calls.filter(c => c.name === "moderate_post").slice(-1)[0],
            empty: document.getElementById("moderation-list").textContent,
            count: document.getElementById("moderation-count").style.display,
        }));
        ok("«احذفها» تُرسل p_keep = false", removed.call && removed.call.args.p_keep === false);
        ok("ويفرغ الصندوق برسالة مفهومة", /لا بلاغات/.test(removed.empty), removed.empty.trim());
        ok("ويختفي العدّاد حين لا يبقى شيء", removed.count === "none");

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

console.log("=== فحص الإشراف على المجتمع ===");
main();
