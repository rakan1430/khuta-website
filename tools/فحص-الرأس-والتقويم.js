/* ============================================================
   فحص ملاحظات المالك البصرية (٢٦ سبتمبر) قبل الرفع للموقع الأساسي
   ------------------------------------------------------------
     ١) الساعة: ساعات ودقائق فقط بلا ثوانٍ، في إطار.
     ٢) التقويم: ميلادي افتراضاً، وهجري من الإعدادات — ويشمل كل تاريخ
        (رأس الصفحة ومواعيد الاختبارات) لا الرأس وحده.
     ٣) اسم المنصة في الأعلى: «منصة المتقدمة» لعضو المدرسة، والأصل لطالب خُطى.
     ٤) الصاروخ بجانب الاسم: للطالب لا للمعلّم ولا الإدارة.
     ٥) السبورة على الجوال للمعلّم: لا تُفتح أكبر من الشاشة، وزرّ X ظاهر دائماً.
     ٦) أجهزة اللمس: لا ضبابية خلفية ولا زخارف عائمة (سبب الوميض والتداخل).
     ٧) النص الباهت في خانة المساعد: لا يذكر ما ليس عند المستخدم.
   التشغيل:  node tools/فحص-الرأس-والتقويم.js
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
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const HIJRI_MONTHS = /محرم|صفر|ربيع|جمادى|رجب|شعبان|رمضان|شوال|ذو القعدة|ذو الحجة|هـ/;
const GREG_MONTHS = /يناير|فبراير|مارس|أبريل|إبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر/;

async function openPage(browser, opts){
    const ctx = await browser.newContext(opts.ctx);
    await ctx.addInitScript(o => { try{
        localStorage.setItem("khuta_intro_seen", "1");
        localStorage.setItem("khuta_ast_nudged", '{"__off":1}');
        if(o.calendar) localStorage.setItem("khuta_calendar", o.calendar); else localStorage.removeItem("khuta_calendar");
    }catch(e){} }, { calendar: opts.calendar || null });
    const page = await ctx.newPage();
    const errs = []; page.on("pageerror", e => errs.push(String(e)));
    await page.goto(opts.base + "/index.html", { waitUntil: "load" });
    await page.waitForFunction(() => typeof khutaLocale === "function" && typeof startDemoMode === "function" && typeof astPlaceholder === "function", { timeout: 15000 });
    await page.addStyleTag({ content: "#login-overlay{ display:none !important; }" });
    return { ctx, page, errs };
}
async function demo(page, role){
    await page.evaluate(async r => {
        isDemoMode = () => true; startDemoMode();
        if(typeof khutaLoadGroup === "function") await khutaLoadGroup("school");
        switchDemoRole(r);
        const lo = document.getElementById("login-overlay"); if(lo) lo.style.display = "none";
        localStorage.setItem("khuta_name", r === "student" ? "محمد" : "أحمد"); updateWelcomeText();
    }, role);
    await page.waitForTimeout(250);
}

(async () => {
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers").filter(d => d.startsWith("chromium"))
        .map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome")).find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    try{
        console.log("\n١) الساعة والتقويم (حاسوب)");
        {
            const { ctx, page, errs } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            await page.waitForTimeout(1200);
            const clk = await page.$eval("#live-clock", el => ({ text: el.textContent, hm: el.querySelector(".lc-hm")?.textContent || "",
                border: getComputedStyle(el).borderTopWidth, radius: getComputedStyle(el).borderTopLeftRadius }));
            ok("الساعة ساعات ودقائق فقط — بلا ثوانٍ", /^\d{2}:\d{2}$/.test(clk.hm) && !/\d{1,2}:\d{2}:\d{2}/.test(clk.text), JSON.stringify(clk));
            ok("الساعة في إطار (حدّ وزوايا)", parseFloat(clk.border) >= 1 && parseFloat(clk.radius) >= 10, JSON.stringify(clk));
            ok("ص/م بجانبها", /[صم]/.test(clk.text));
            const ctr = await page.evaluate(() => {
                const c = document.getElementById("live-clock").getBoundingClientRect(), d = document.querySelector("#live-clock .lc-hm").getBoundingClientRect();
                return { dx: (d.left + d.width / 2) - (c.left + c.width / 2), dy: (d.top + d.height / 2) - (c.top + c.height / 2) };
            });
            ok("الأرقام في منتصف الإطار أفقياً (لا تميل يساراً)", Math.abs(ctr.dx) <= 1, JSON.stringify(ctr));
            const d1 = await page.$eval("#live-date", el => el.textContent);
            ok("التاريخ ميلادي افتراضاً", GREG_MONTHS.test(d1) && !HIJRI_MONTHS.test(d1), d1);
            ok("المفتاح المركزي ميلادي افتراضاً", await page.evaluate(() => khutaLocale().includes("ca-gregory")));
            await page.evaluate(() => switchTab("settings"));
            ok("خيار التقويم في الإعدادات والميلادي مختار", await page.evaluate(() =>
                document.getElementById("settings-cal-gregory-btn")?.classList.contains("active") && !document.getElementById("settings-cal-hijri-btn").classList.contains("active")));
            await page.click("#settings-cal-hijri-btn");
            await page.waitForTimeout(200);
            const d2 = await page.$eval("#live-date", el => el.textContent);
            ok("اختيار «هجري» يغيّر تاريخ الرأس فوراً", HIJRI_MONTHS.test(d2), d2);
            ok("…ويُحفظ", await page.evaluate(() => localStorage.getItem("khuta_calendar") === "hijri"));
            ok("…والزرّ صار المختار", await page.evaluate(() => document.getElementById("settings-cal-hijri-btn").classList.contains("active")));
            // شامل: موعد الاختبار عند الطالب يتبع الإعداد (لا الرأس وحده)
            await demo(page, "student");
            const due = await page.evaluate(() => typeof seDueText === "function" ? seDueText("2026-10-05T09:00:00Z") : "(غير محمّلة)");
            ok("موعد الاختبار عند الطالب يتبع التقويم المختار (هجري)", HIJRI_MONTHS.test(due), due);
            await page.evaluate(() => setCalendar("gregory"));
            const due2 = await page.evaluate(() => seDueText("2026-10-05T09:00:00Z"));
            ok("…ويرجع ميلادياً", !HIJRI_MONTHS.test(due2) && /2026/.test(due2), due2);
            const fmts = await page.evaluate(() => [typeof recDate === "function" ? recDate("2026-10-05T09:00:00Z") : "", typeof gradeText === "function" ? "" : ""]);
            ok("السجلّ أيضاً ميلادي", !fmts[0] || !HIJRI_MONTHS.test(fmts[0]), fmts[0]);
            // الإنجليزية
            await page.evaluate(() => { setLang("en"); setCalendar("hijri"); });
            const de = await page.$eval("#live-date", el => el.textContent);
            ok("بالإنجليزية + هجري", /AH|Rabi|Jumada|Muharram|Safar|Rajab|Sha|Ramadan|Shawwal|Dhu/.test(de), de);
            await page.evaluate(() => { setLang("ar"); setCalendar("gregory"); });
            ok("بلا أخطاء", errs.length === 0, errs.join("\n"));
            await ctx.close();
        }

        console.log("\n٢) اسم المنصة والصاروخ");
        {
            const { ctx, page, errs } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            const khutaTag = await page.$eval("#brand-tag", el => el.textContent.trim());
            ok("طالب خُطى: العبارة الأصلية", /رفيق القدرات|QUDRAT/.test(khutaTag), khutaTag);
            await page.evaluate(() => { localStorage.setItem("khuta_name", "سارة"); updateWelcomeText(); });
            ok("طالب خُطى: الصاروخ باقٍ", (await page.$eval("#welcome-text", el => el.textContent)).includes("🚀"));
            for(const role of ["teacher", "admin", "student"]){
                await demo(page, role);
                const tag = await page.$eval("#brand-tag", el => el.textContent.trim());
                ok(`${role}: «منصة المتقدمة» تحت شعار خُطى`, tag === "منصة المتقدمة", tag);
                const w = await page.$eval("#welcome-text", el => el.textContent);
                if(role === "student") ok("طالب المدرسة: الصاروخ باقٍ", w.includes("🚀"), w);
                else ok(`${role}: بلا صاروخ`, !w.includes("🚀") && w.includes("أحمد"), w);
            }
            ok("عنوان التبويب يحمل اسم المنصة", (await page.title()).includes("منصة المتقدمة"));
            // طالب المدرسة: الاسم يتبع الوضع — «مدرستي» اسم المنصة، «القدرات» خُطى كما هي
            await page.evaluate(() => setKhutaMode("khuta"));
            const inGat = await page.$eval("#brand-tag", el => el.textContent.trim());
            ok("طالب المدرسة في «القدرات»: العبارة الأصلية", /رفيق القدرات/.test(inGat), inGat);
            await page.evaluate(() => setKhutaMode("school"));
            ok("…وفي «مدرستي»: اسم المنصة", (await page.$eval("#brand-tag", el => el.textContent.trim())) === "منصة المتقدمة");
            await page.evaluate(() => { schoolCtx.platformNameAr = "منصة النخبة"; applySchoolBrand(); });
            ok("اسم يحدّده المالك لهذه المدرسة يحلّ محلّ المشتقّ", (await page.$eval("#brand-tag", el => el.textContent.trim())) === "منصة النخبة");
            await page.evaluate(() => { schoolCtx.platformNameAr = null; applySchoolBrand(); });
            await page.evaluate(() => setLang("en"));
            ok("تبديل اللغة لا يعيد «رفيق القدرات» لعضو المدرسة", (await page.$eval("#brand-tag", el => el.textContent.trim())) === "School platform");
            await page.evaluate(() => setLang("ar"));
            ok("والعربية تعود «منصة المتقدمة»", (await page.$eval("#brand-tag", el => el.textContent.trim())) === "منصة المتقدمة");
            const ls = await page.$eval("#brand-tag", el => getComputedStyle(el).letterSpacing);
            ok("الاسم العربي بلا تباعد أحرف يقطّعه", ls === "normal" || parseFloat(ls) === 0, ls);
            await page.evaluate(() => { schoolCtx = null; applySchoolBrand(); });
            ok("الخروج من المدرسة يعيد العبارة الأصلية", /رفيق القدرات/.test(await page.$eval("#brand-tag", el => el.textContent)));
            ok("بلا أخطاء", errs.length === 0, errs.join("\n"));
            await ctx.close();
        }

        console.log("\n٣) المساعد: النص الباهت حسب ما يملكه المستخدم");
        {
            const { ctx, page } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            await page.evaluate(() => { const lo = document.getElementById("login-overlay"); if(lo) lo.style.display = "none"; toggleChatbot(); });
            const khutaPh = await page.$eval("#chatbot-input", el => el.placeholder);
            ok("طالب خُطى: لا ذكر للواجبات", !khutaPh.includes("الواجبات") && khutaPh.length > 10, khutaPh);
            await page.evaluate(() => toggleChatbot());
            await demo(page, "student");
            await page.evaluate(() => toggleChatbot());
            const stPh = await page.$eval("#chatbot-input", el => el.placeholder);
            ok("طالب المدرسة: الواجبات مذكورة (عنده قسمها)", stPh.includes("الواجبات"), stPh);
            await page.evaluate(() => toggleChatbot());
            await demo(page, "teacher");
            await page.evaluate(() => toggleChatbot());
            const tPh = await page.$eval("#chatbot-input", el => el.placeholder);
            ok("المعلّم: صياغة الأسئلة والاختبارات", tPh.includes("أسئلة") && tPh.includes("الاختبارات") && !tPh.includes("الموزونة"), tPh);
            ok("المعلّم: لا أجوبة قدرات جاهزة حين يتعطّل الذكاء", await page.evaluate(async () => {
                answerLocally("الجدول", false); await new Promise(r => setTimeout(r, 400));
                const t = [...document.querySelectorAll(".chatbot-msg.bot")].pop().textContent;
                return !t.includes("خطة") && !t.includes("صفحة الروابط");
            }));
            await ctx.close();
        }

        console.log("\n٣ب) الشروط وسياسة الخصوصية وإشعار التحديث");
        {
            const { ctx, page, errs } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            const priv = await page.evaluate(() => { openLegalModal("privacy"); return document.getElementById("legal-modal-body").textContent; });
            ok("الخصوصية لم تعد تقول «لا نجمع اسمك الحقيقي»", !priv.includes("لا نجمع اسمك الحقيقي") && !priv.includes("ولا رقم هويتك"));
            ok("وتذكر ما يُحفظ فعلاً: الاسم، بصمة الهوية المشفّرة، الدرجات، المساعد، الصوت", ["الاسم الكامل", "بصمة مشفّرة", "الدرجات الرسمية", "Gemini", "بالصوت", "بعد أسبوع"].every(w => priv.includes(w)));
            ok("عليها تاريخ التحديث ورقم النسخة", priv.includes("آخر تحديث") && priv.includes(await page.evaluate(() => TERMS_VERSION)));
            const terms = await page.evaluate(() => { closeLegalModal(); openLegalModal("terms"); return document.getElementById("legal-modal-body").textContent; });
            ok("الشروط تذكر منصة المدارس ونور والمساعد", ["منصة المدارس", "نظام نور", "مسودّة يراجعها المعلّم"].every(w => terms.includes(w)));
            await page.evaluate(() => closeLegalModal());
            await page.waitForTimeout(450);

            // مستخدم عائد، وقاعدة مزيّفة فيها إشعار
            const fakeSb = () => {
                window.__rpc = []; window.__posted = [];
                sb = {
                    from: t => ({ select(){ return this; }, eq(){ return this; }, order(){ return this; },
                        limit: async () => ({ data: t === "site_notices" ? [{ version: "2.0", summary_ar: "تغيّرت الشروط\nسطر ثانٍ", published_at: "2026-09-26" }] : [], error: null }) }),
                    rpc: async (n, a) => { window.__rpc.push([n, a]); return { data: { notice_id: 1, message_id: 77, reach: 17 }, error: null }; },
                    auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) },
                };
                window.fetch = async (u, o) => { window.__posted.push(JSON.parse(o.body)); return { ok: true, json: async () => ({ sent: 17, failed: 0, total: 17 }) }; };
            };
            await page.evaluate(fakeSb);
            await page.evaluate(() => { localStorage.setItem("khuta_intro_seen", "1"); localStorage.removeItem("khuta_terms_seen"); return checkTermsNotice(); });
            await page.waitForTimeout(400);
            ok("مستخدم عائد يرى إشعار التحديث", await page.evaluate(() => !!document.querySelector("#terms-notice.show") && document.querySelector(".terms-notice-body").innerHTML.includes("<br>")));
            await page.click('#terms-notice [data-a="ok"]');
            ok("«فهمت» يحفظ أنه قرأ هذه النسخة", await page.evaluate(() => localStorage.getItem("khuta_terms_seen") === "2.0" && !document.getElementById("terms-notice")));
            await page.evaluate(() => checkTermsNotice());
            await page.waitForTimeout(300);
            ok("ولا يظهر له مرة ثانية", await page.evaluate(() => !document.getElementById("terms-notice")));
            await page.evaluate(() => { ["khuta_intro_seen","khuta_name","khuta_plan_days","khuta_terms_seen"].forEach(k => localStorage.removeItem(k)); getSession = () => null; return checkTermsNotice(); });
            await page.waitForTimeout(300);
            ok("زائر جديد لا يُبلَّغ بـ«تحديث» (الشروط الحالية أول ما يقبله)", await page.evaluate(() => !document.getElementById("terms-notice") && localStorage.getItem("khuta_terms_seen") === "2.0"));

            // لوحة المالك
            await page.evaluate(() => { isAdmin = false; openTermsNoticePanel(); });
            ok("اللوحة لا تُفتح لغير المالك", await page.evaluate(() => !document.getElementById("terms-panel")));
            await page.evaluate(() => { isAdmin = true; openTermsNoticePanel(); });
            ok("المالك: اللوحة بنسخة الشروط وملخّص جاهز", await page.evaluate(() => document.getElementById("tn-version").value === TERMS_VERSION && document.getElementById("tn-summary").value.length > 50));
            page.once("dialog", d => d.accept());
            await page.click("#tn-send");
            await page.waitForTimeout(500);
            const pub = await page.evaluate(() => ({ rpc: window.__rpc[0], post: window.__posted[0], out: document.getElementById("tn-result").textContent }));
            ok("النشر عبر دالّة الخادم owner_publish_terms_notice", pub.rpc && pub.rpc[0] === "owner_publish_terms_notice" && pub.rpc[1].p_version === "2.0");
            ok("ثم إرسال البريد برقم الرسالة وحده", pub.post && pub.post.type === "adminSendCampaign" && pub.post.messageId === 77 && !pub.post.recipients);
            ok("والنتيجة تُعرض: نُشر وأُرسل لـ١٧", pub.out.includes("نُشر") && pub.out.includes("17"), pub.out);
            ok("زرّ الإشعار في أدوات المشرف", await page.evaluate(() => !!document.querySelector('#admin-overlay [onclick="openTermsNoticePanel()"]')));
            ok("بلا أخطاء", errs.length === 0, errs.join("\n"));
            await ctx.close();
        }

        console.log("\n٤) الجوال: السبورة للمعلّم");
        for(const vp of [{ w:390, h:664, name:"آيفون (الجزء الظاهر فعلاً)" }, { w:360, h:640, name:"أندرويد صغير" }, { w:820, h:1100, name:"آيباد عمودي" }]){
            const { ctx, page, errs } = await openPage(browser, { base, ctx: { viewport: { width: vp.w, height: vp.h }, isMobile: vp.w < 700, hasTouch: true, userAgent: IPHONE_UA } });
            await demo(page, "teacher");
            await page.evaluate(() => openKhutaBoard(null, true));
            await page.waitForTimeout(600);
            const inView = () => page.evaluate(() => {
                const b = document.querySelector("#khuta-board-overlay .lab-close-btn").getBoundingClientRect();
                return { ok: b.top >= 0 && b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight && b.width > 20, top: b.top, left: b.left, right: b.right };
            });
            const a = await inView();
            ok(`${vp.name}: زرّ X ظاهر عند فتح السبورة`, a.ok, JSON.stringify(a));
            const win = await page.evaluate(() => { const r = document.querySelector(".board-window").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: innerHeight, max: document.querySelector(".board-window").classList.contains("pad-max") }; });
            ok(`${vp.name}: النافذة داخل الشاشة`, win.top >= 0 && win.bottom <= win.h + 1, JSON.stringify(win));
            if(vp.w <= 900) ok(`${vp.name}: لا تُفتح ملء الشاشة تلقائياً`, !win.max);
            await page.evaluate(() => togglePadMax(true));
            await page.waitForTimeout(400);
            const b = await inView();
            ok(`${vp.name}: وحتى بعد «ملء الشاشة» يدوياً يبقى X ظاهراً`, b.ok, JSON.stringify(b));
            await page.click("#khuta-board-overlay .lab-close-btn");
            await page.waitForTimeout(500);
            ok(`${vp.name}: X يغلقها فعلاً`, await page.evaluate(() => document.getElementById("khuta-board-overlay").style.display === "none"));
            ok(`${vp.name}: بلا أخطاء`, errs.length === 0, errs.join("\n"));
            await ctx.close();
        }
        {
            const { ctx, page } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            await demo(page, "teacher");
            await page.evaluate(() => openKhutaBoard(null, true));
            await page.waitForTimeout(500);
            ok("الحاسوب/سبورة الصف: المعلّم ما زال يفتح الدفتر ملء الشاشة", await page.evaluate(() => document.querySelector(".board-window").classList.contains("pad-max")));
            await ctx.close();
        }

        console.log("\n٥) أجهزة اللمس: الزجاج والنجوم باقية، والضبابية الحية فقط تُحاكى");
        {
            const { ctx, page } = await openPage(browser, { base, ctx: { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false }, calendar: null });
            await page.evaluate(() => { setThemeMode("dark"); switchTab("settings"); });
            const r = await page.evaluate(() => {
                // بطاقة عادية لا بطاقة لها لون خاص بمعرّفها (كلوحة تخصيص الرئيسية)
                const card = [...document.querySelectorAll(".view-section.active .card")].find(c => !c.id && c.className.trim() === "card");
                const cs = getComputedStyle(card);
                const input = card.querySelector("button, input, select");
                const decor = document.querySelector(".bg-decor");
                const before = getComputedStyle(document.body, "::before");
                const nav = getComputedStyle(document.querySelector(".mobile-nav"));
                return { touch: document.documentElement.classList.contains("touch-ui"), bf: cs.backdropFilter,
                         inner: input ? getComputedStyle(input).backdropFilter : "none",
                         decor: decor ? getComputedStyle(decor).display : "none", starsAnim: before.animationName, bg: cs.backgroundImage,
                         navBf: nav.backdropFilter };
            });
            ok("الآيباد يُعرف جهاز لمس", r.touch);
            ok("ضبابية البطاقة الحية تُحاكى بلون (سبب التقطيع)", !r.bf || r.bf === "none", r.bf);
            ok("ولا ضبابية فوق ضبابية داخلها", !r.inner || r.inner === "none", r.inner);
            ok("البطاقة ما زالت زجاجاً شفافاً (لا لوناً مصمتاً)", /rgba\(118, 96, 240, 0\.22\)/.test(r.bg), r.bg);
            ok("النجوم ما زالت تومض", r.starsAnim && r.starsAnim !== "none", r.starsAnim);
            ok("الزخارف ما زالت ظاهرة على الآيباد", r.decor !== "none", r.decor);
            ok("الشريط السفلي باقٍ بضبابيته الحية", r.navBf && r.navBf !== "none", r.navBf);
            await ctx.close();
        }
        {
            const { ctx, page } = await openPage(browser, { base, ctx: { viewport: { width: 1366, height: 860 } } });
            const r = await page.evaluate(() => ({ touch: document.documentElement.classList.contains("touch-ui"),
                bf: getComputedStyle(document.querySelector(".view-section.active .card")).backdropFilter }));
            ok("الحاسوب يبقى بتصميمه الزجاجي كما هو", !r.touch && r.bf && r.bf !== "none", JSON.stringify(r));
            await ctx.close();
        }
    }finally{
        await browser.close(); srv.close();
    }
    console.log(`\nالنتيجة: ${pass} نجح، ${fail} فشل`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
