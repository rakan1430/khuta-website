/* ============================================================
   فحص واجهة رسائل البريد — لوحة المالك وبطاقة إدارة المدرسة
   ------------------------------------------------------------
   طلب المالك (٢٥ سبتمبر):
     • المالك يختار: طلاب المدرسة فقط / طلاب خُطى فقط / الكل، ويرى الفئتين
       ويدير وصول الرسائل لكل طالب.
     • إدارة المدرسة لا ترى إلا الإرسال لطلاب مدرستها، ويمكن جدولتها.
   ما يُقاس (القاعدة والخادم لهما فحصاهما: tools/فحص-رسائل-البريد.js وSQL):
     ١) المالك: الخانة الثلاثية، واختيار المدرسة يظهر مع «طلاب المدرسة»،
        والأرقام تتبدّل، والحفظ يرسل audience/school_id وموعداً كاملاً.
     ٢) المالك: تبويب «المستلمون» — الأرقام، والبحث، وإيقاف/إعادة، و«موقوفة
        منه» لا زرّ لها.
     ٣) المالك: «إرسال الآن» يرسل رقم الرسالة وحده، ورسالة تتجاوز الحصّة
        تقول ذلك صراحةً.
     ٤) المدرسة: البطاقة في «إدارة المدرسة» فقط، ولا خانة جمهور فيها.
        الحفظ نصّ عادي لمدرستها، والقائمة بحالاتها، و«أرسل الآن» و«جرّبها»،
        وحدّ اليوم برسالة مفهومة.
   التشغيل:  node tools/فحص-رسائل-المدرسة.js
   ============================================================ */
let chromium;
try{ ({ chromium } = require("playwright")); }catch(e){ console.log("npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c){ pass++; console.log("  ✅ " + n); } else { fail++; console.log("  ❌ " + n + (d ? "\n       " + d : "")); } };
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json" };
function serve(){
    return new Promise(res => {
        const s = http.createServer((q, r) => {
            let p = decodeURIComponent(q.url.split("?")[0]); if(p === "/") p = "/index.html";
            const f = path.join(ROOT, p);
            if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ r.writeHead(404); r.end(); return; }
            r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); r.end(fs.readFileSync(f));
        });
        s.listen(0, "127.0.0.1", () => res(s));
    });
}

(async () => {
    // كل مفتاح ترجمة في الصفحة له نصّ بالعربية والإنجليزية — وإلا ظهر المفتاح
    // نفسه للمستخدم («smsg.title») كما حدث في أوّل نسخة من بطاقة المدرسة
    {
        const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
        const dict = fs.readFileSync(path.join(ROOT, "js/03-i18n.js"), "utf8");
        const keys = [...new Set([...html.matchAll(/data-i18n(?:-placeholder|-title)?="([^"]+)"/g)].map(m => m[1]))];
        const missing = keys.filter(k => dict.split(JSON.stringify(k) + ":").length - 1 < 2);
        ok(`كل مفاتيح الترجمة (${keys.length}) لها عربي وإنجليزي`, missing.length === 0, missing.join(", "));
    }
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter(d => d.startsWith("chromium"))
        .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")).find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    try{
        const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        const posted = [];
        await page.route("**/.netlify/functions/send-email", async route => {
            const body = JSON.parse(route.request().postData() || "{}"); posted.push(body);
            const reply = body.type === "adminSendCampaign" ? { status: 409, json: { ok: false, error: "over_quota", total: 40, remaining: 12 } }
                : body.type === "schoolTest" ? { status: 200, json: { ok: true, test: true, email: "admin@school.sa" } }
                : { status: 200, json: { ok: true, sent: 3, failed: 0, total: 3 } };
            await route.fulfill({ status: reply.status, contentType: "application/json", body: JSON.stringify(reply.json) });
        });
        await page.goto(base + "/index.html", { waitUntil: "load" });
        await page.waitForFunction(() => typeof openCampaignPanel === "function" && typeof startDemoMode === "function", { timeout: 15000 });

        /* ===== المالك ===== */
        console.log("\n١) المالك: لمن تصل");
        await page.evaluate(() => {
            window.__calls = { rpc: [], inserts: [] };
            const counts = { role: "owner", khuta: 7, school: 2, all: 9,
                schools: [{ id: "S1", name: "مدارس المتقدمة", students: 30, reach_owner: 2, reach_school: 25 },
                          { id: "S2", name: "مدرسة أخرى", students: 10, reach_owner: 0, reach_school: 8 }] };
            const people = [
                { uid: "U1", name: "هيا", email: "haya@x.com", grp: "مدارس المتقدمة", consent: true, stop_school: null, stop_khuta: null },
                { uid: "U2", name: "سعد", email: "saad@x.com", grp: "مدارس المتقدمة", consent: false, stop_school: "self", stop_khuta: "owner" },
                { uid: "U3", name: "نورة", email: "noura@x.com", grp: "خُطى", consent: true, stop_school: null, stop_khuta: null },
            ];
            const msgs = [
                { id: 5, subject: "مجدولة", origin: "owner", audience: "khuta", send_mode: "broadcast", occasion: "عام", active: true,
                  send_after: new Date(Date.now() + 86400000).toISOString(), sent_at: null, sending_started_at: null, send_result: null },
                { id: 6, subject: "من المدرسة", origin: "school", audience: "school", school_id: "S1", send_mode: "broadcast", occasion: "مدرسة", active: true,
                  send_after: null, sent_at: new Date().toISOString(), sending_started_at: new Date().toISOString(), send_result: { sent: 25, total: 25 } },
            ];
            const q = (rows) => {
                const api = { select(){ return api; }, eq(){ return api; }, order(){ return api; }, limit(){ return api; },
                    single(){ return Promise.resolve({ data: rows[0], error: null }); },
                    then(res, rej){ return Promise.resolve({ data: rows, error: null }).then(res, rej); },
                    insert(row){ window.__calls.inserts.push(row); return Promise.resolve({ error: null }); },
                    update(){ return { eq: () => Promise.resolve({ error: null }) }; } };
                return api;
            };
            sb = {
                rpc: async (fn, args) => { window.__calls.rpc.push([fn, args]);
                    if(fn === "campaign_audience_counts") return { data: counts, error: null };
                    if(fn === "notify_people") return { data: people, error: null };
                    if(fn === "set_notify_optout") return { data: args.p_stop ? "stopped" : "resumed", error: null };
                    return { data: null, error: null }; },
                from: (t) => q(t === "marketing_messages" ? msgs : []),
                auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
            };
            isAdmin = true;
            document.getElementById("admin-overlay").style.display = "flex";
            openCampaignPanel();
        });
        await page.waitForTimeout(400);
        const list = await page.evaluate(() => document.getElementById("campaign-list").innerText);
        ok("القائمة تعرض الجمهور والموعد", list.includes("طلاب خُطى") && list.includes("تُرسل تلقائياً") && list.includes("من إدارة مدرسة لطلابها"), list.slice(0, 200));
        ok("رسالة مدرسة أُرسلت: لا زرّ «إرسال الآن» لها", await page.evaluate(() =>
            [...document.querySelectorAll("#campaign-list .campaign-row")].filter(r => r.innerText.includes("من المدرسة")).every(r => !r.innerText.includes("إرسال الآن"))));

        await page.evaluate(() => switchCampaignTab("new", document.querySelectorAll(".campaign-tab")[1]));
        const opts = await page.evaluate(() => [...document.querySelectorAll("#campaign-audience option")].map(o => o.value));
        ok("الخانة الثلاثية: الكل / خُطى / المدرسة", opts.join() === "all,khuta,school", opts.join());
        let st = await page.evaluate(() => ({ school: getComputedStyle(document.getElementById("campaign-school-group")).display, reach: document.getElementById("campaign-reach").textContent }));
        ok("«الكل»: لا اختيار مدرسة، والوصول 9", st.school === "none" && st.reach.includes("9"), JSON.stringify(st));
        await page.selectOption("#campaign-audience", "school");
        st = await page.evaluate(() => ({ school: getComputedStyle(document.getElementById("campaign-school-group")).display, reach: document.getElementById("campaign-reach").textContent,
            schools: [...document.querySelectorAll("#campaign-school option")].map(o => o.textContent) }));
        ok("«طلاب المدرسة»: يظهر اختيار المدرسة بأسماء المدارس", st.school !== "none" && st.schools.join() === "كل المدارس,مدارس المتقدمة,مدرسة أخرى", JSON.stringify(st));
        await page.selectOption("#campaign-school", "S1");
        st = await page.evaluate(() => document.getElementById("campaign-reach").textContent);
        ok("مدرسة بعينها: الوصول رقمها (2)", st.includes("2"), st);

        await page.fill("#campaign-subject", "رسالة للمدرسة");
        await page.fill("#campaign-body", "<p>مرحباً</p>");
        const soon = new Date(Date.now() + 2 * 3600e3); soon.setSeconds(0, 0);
        const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        await page.fill("#campaign-send-after", local);
        await page.evaluate(() => saveCampaignMessage());
        await page.waitForTimeout(200);
        const ins = await page.evaluate(() => window.__calls.inserts.pop());
        ok("الحفظ: audience=school وschool_id=S1 وorigin=owner", ins && ins.audience === "school" && ins.school_id === "S1" && ins.origin === "owner", JSON.stringify(ins));
        ok("الحفظ: الموعد بالساعة لا باليوم فقط", ins && new Date(ins.send_after).getTime() === soon.getTime(), ins && ins.send_after);

        console.log("\n٢) المالك: المستلمون");
        await page.evaluate(() => switchCampaignTab("people", document.querySelectorAll(".campaign-tab")[2]));
        await page.waitForTimeout(500);
        const pp = await page.evaluate(() => ({
            counts: document.getElementById("campaign-counts").innerText,
            rows: [...document.querySelectorAll("#campaign-people-list .campaign-row")].map(r => r.innerText),
        }));
        ok("الأرقام: خُطى 7، المدرسة 2، ولكل مدرسة وصول إدارتها (25/30)", pp.counts.includes("7") && pp.counts.includes("25/30") && pp.counts.includes("8/10"), pp.counts);
        ok("ثلاثة طلاب، وطالب خُطى بلا خانة «المدرسة»", pp.rows.length === 3 && !pp.rows[2].includes("المدرسة:") && pp.rows[0].includes("المدرسة:"), JSON.stringify(pp.rows));
        ok("«موقوفة منه» بلا زرّ، و«إعادة» لإيقاف المالك", pp.rows[1].includes("موقوفة منه") && pp.rows[1].includes("إعادة"));
        await page.evaluate(() => toggleCampaignPerson("U1", "school", true));
        await page.waitForTimeout(300);
        const call = await page.evaluate(() => window.__calls.rpc.find(c => c[0] === "set_notify_optout"));
        ok("الإيقاف ينادي set_notify_optout بالطالب والنطاق", call && call[1].p_uid === "U1" && call[1].p_scope === "school" && call[1].p_stop === true, JSON.stringify(call));
        await page.fill("#campaign-people-q", "هيا");
        await page.waitForTimeout(500);
        const lastQ = await page.evaluate(() => window.__calls.rpc.filter(c => c[0] === "notify_people").pop());
        ok("البحث يمرّر النصّ", lastQ && lastQ[1].p_query === "هيا");

        console.log("\n٣) المالك: إرسال الآن");
        const toastBefore = await page.evaluate(() => { window.confirm = () => true; return 0; });
        await page.evaluate(() => sendCampaignNow(5));
        await page.waitForTimeout(500);
        const sent = posted.find(p => p.type === "adminSendCampaign");
        ok("يرسل رقم الرسالة وحده (لا قائمة ولا محتوى)", sent && sent.messageId === 5 && !sent.subject && !sent.message, JSON.stringify(sent));
        const toast = await page.evaluate(() => (document.querySelector(".toast, #toast") || {}).textContent || "");
        ok("تجاوز الحصّة يُقال صراحةً", /حصّة اليوم/.test(toast) && /40/.test(toast) && /12/.test(toast), toast);
        await page.evaluate(() => { document.getElementById("campaign-overlay").style.display = "none"; });

        /* ===== إدارة المدرسة ===== */
        console.log("\n٤) إدارة المدرسة");
        await page.evaluate(async () => {
            isDemoMode = () => true; startDemoMode();
            await new Promise(r => setTimeout(r, 1000));
            if(typeof khutaLoadGroup === "function") await khutaLoadGroup("school");
        });
        const vis = async (role) => page.evaluate(async (role) => {
            switchDemoRole(role); await new Promise(r => setTimeout(r, 300));
            if(role !== "admin") switchTab("schoolwork");
            const c = document.getElementById("card-school-msgs");
            return !!c && c.offsetParent !== null;
        }, role);
        ok("البطاقة لا تظهر للمعلّم", !(await vis("teacher")));
        ok("ولا للطالب", !(await vis("student")));
        ok("وتظهر لإدارة المدرسة", await vis("admin"));
        ok("لا خانة جمهور في بطاقة المدرسة (طلابها فقط)", await page.evaluate(() =>
            !document.querySelector("#card-school-msgs select") && !document.querySelector("#card-school-msgs #campaign-audience")));

        await page.evaluate(() => {
            window.__s = { inserts: [], deletes: [] };
            const rows = [
                { id: 11, subject: "مجدولة الأحد", send_after: new Date(Date.now() + 3600e3).toISOString(), sent_at: null, sending_started_at: null, send_result: null },
                { id: 12, subject: "أُرسلت", send_after: null, sent_at: new Date().toISOString(), sending_started_at: new Date().toISOString(), send_result: { sent: 24, failed: 1, total: 25 } },
                { id: 13, subject: "حصّة", send_after: null, sent_at: null, sending_started_at: null, send_result: { error: "over_quota" } },
            ];
            let failNext = false;
            window.__failInsert = () => { failNext = true; };
            const q = () => { const api = { select(){ return api; }, eq(){ return api; }, order(){ return api; },
                limit(){ return Promise.resolve({ data: rows, error: null }); },
                insert(row){ window.__s.inserts.push(row); if(failNext){ failNext = false; return Promise.resolve({ error: { message: "SCHOOL_DAILY_LIMIT" } }); } return Promise.resolve({ error: null }); },
                delete(){ return { eq: (c, v) => { window.__s.deletes.push(v); return Promise.resolve({ error: null }); } }; } }; return api; };
            sb = Object.assign({}, sb, {
                from: () => q(),
                rpc: async (fn, args) => fn === "campaign_audience_counts" ? { data: { role: "school", students: 30, reach: 25 }, error: null } : { data: null, error: null },
                auth: { getSession: async () => ({ data: { session: { access_token: "tok" } } }) },
            });
            renderSchoolMessages();
        });
        await page.waitForTimeout(400);
        const card = await page.evaluate(() => ({ reach: document.getElementById("smsg-reach").textContent,
            rows: [...document.querySelectorAll("#smsg-list .sfile-row")].map(r => ({ t: r.innerText, btns: r.querySelectorAll("button").length })) }));
        ok("الوصول: 25 من 30", card.reach.includes("25") && card.reach.includes("30"), card.reach);
        ok("الحالات: مجدولة بموعدها · أُرسلت 24 من 25 (فشلت 1) · تجاوز الحصّة", card.rows.length === 3 && /مجدولة/.test(card.rows[0].t)
            && /24 من 25/.test(card.rows[1].t) && /فشلت 1/.test(card.rows[1].t) && /حدّه/.test(card.rows[2].t), JSON.stringify(card.rows.map(r => r.t)));
        ok("المُرسلة بلا أزرار، وغيرها: أرسل/جرّب/احذف", card.rows[1].btns === 0 && card.rows[0].btns === 3);

        // البطاقة مطويّة افتراضياً كبقية بطاقات الإدارة — تُفتح بضغط رأسها كما يفعل المدير
        await page.evaluate(() => { const c = document.getElementById("card-school-msgs");
            if(c.classList.contains("is-collapsed")) c.querySelector(".collapse-head").click(); });
        ok("البطاقة مطويّة افتراضياً وتُفتح برأسها", await page.evaluate(() =>
            !document.getElementById("card-school-msgs").classList.contains("is-collapsed")));
        await page.fill("#smsg-subject", "اختبار الرياضيات");
        await page.fill("#smsg-body", "يوم الأحد\n<b>الفصل الثاني</b>");
        await page.evaluate(() => saveSchoolMessage());
        await page.waitForTimeout(300);
        const si = await page.evaluate(() => window.__s.inserts.pop());
        ok("الحفظ: لطلاب مدرستها، نصّ عادي، من المدرسة", si && si.origin === "school" && si.audience === "school" && si.body_format === "text"
            && si.school_id === schoolCtxId(), JSON.stringify(si));
        ok("النصّ يُحفظ كما كُتب (يُهرَّب عند الإرسال لا هنا)", si && si.body_html === "يوم الأحد\n<b>الفصل الثاني</b>");
        await page.fill("#smsg-subject", "رابعة"); await page.fill("#smsg-body", "x");
        await page.evaluate(() => { window.__failInsert(); saveSchoolMessage(); });
        await page.waitForTimeout(300);
        const t2 = await page.evaluate(() => (document.querySelector(".toast, #toast") || {}).textContent || "");
        ok("حدّ اليوم برسالة مفهومة", /٣ رسائل/.test(t2), t2);

        await page.evaluate(() => { window.confirm = () => true; });
        await page.evaluate(() => sendSchoolMessageNow(11, null));
        await page.waitForTimeout(400);
        const ss = posted.filter(p => p.type === "schoolSendCampaign").pop();
        ok("«أرسل الآن» ينادي مسار المدرسة برقم الرسالة", ss && ss.messageId === 11, JSON.stringify(ss));
        await page.evaluate(() => testSchoolMessage(11, null));
        await page.waitForTimeout(400);
        const t3 = await page.evaluate(() => (document.querySelector(".toast, #toast") || {}).textContent || "");
        ok("«جرّبها على بريدي» تقول أين وصلت", t3.includes("admin@school.sa"), t3);
        await page.evaluate(() => deleteSchoolMessage(11));
        await page.waitForTimeout(200);
        ok("الحذف برقم الرسالة", await page.evaluate(() => window.__s.deletes.includes(11)));

        ok("لا أخطاء JavaScript", errs.length === 0, errs.join(" | "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

function schoolCtxId(){ return "DEMO-SCHOOL"; }
