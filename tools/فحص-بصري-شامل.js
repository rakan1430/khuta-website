/* ============================================================
   فحص بصري شامل — كل تبويب، لكل دور، على الجوّال والحاسوب، فاتحاً وداكناً
   ------------------------------------------------------------
   طلب المالك بعد الإطلاق (٢٤ سبتمبر): «فحص شامل والتأكد حتى من المشاكل
   البصرية». فيمرّ هذا الفحص على كل قسم يظهر في القائمة لكل دور (طالب،
   معلّم، إدارة) في وضع العرض التجريبي — ٣ أدوار × ٢ مقاس × ٢ سمة — ويقيس:
     • تجاوز عرض الشاشة (تمرير أفقي أو عنصر يخرج عن الحافة)
     • «جارٍ التحميل…» عالق بعد ثلاث ثوانٍ
     • صورة مكسورة ظاهرة
     • نصّ أبيض على أبيض أو داكن على داكن (تباين أقلّ من ٢:١ لنصّ ظاهر)
     • أخطاء JavaScript
   ويحفظ لقطة لكل تبويب في مجلّد يُمرَّر أولَ وسيطٍ (ليُراجَع بالعين أيضاً).
   التشغيل:  node tools/فحص-بصري-شامل.js [مجلّد-اللقطات]
   ⚠️ في بيئة بلا إنترنت تظهر الأيقونات مربّعات فارغة (Font Awesome من CDN) —
   ليس عطلاً في الموقع.
   ============================================================ */
let chromium, devices;
try{ ({ chromium, devices } = require("playwright")); }
catch(e){ console.log("⚠️  npm install playwright --no-save"); process.exit(2); }
const http = require("http"), fs = require("fs"), path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SHOTS = process.argv[2] || null;
if(SHOTS) fs.mkdirSync(SHOTS, { recursive:true });
let pass = 0, fail = 0;
function ok(name, cond, detail){
    if(cond){ pass++; console.log("  ✅ " + name); }
    else{ fail++; console.log("  ❌ " + name + (detail ? "\n       " + detail : "")); }
}
const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".json":"application/json", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml" };
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

/* يُنفَّذ داخل الصفحة: كل ما يُقاس على التبويب المعروض */
function inspect(scopeSel){
    const W = window.innerWidth;
    const visible = (el) => {
        if(!el.isConnected) return false;
        const cs = getComputedStyle(el);
        if(cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    // عنصر داخل حاوية تمرير أفقي مقصودة (جدول عريض مثلاً) ليس تجاوزاً
    const inScroller = (el) => {
        for(let p = el.parentElement; p && p !== document.body; p = p.parentElement){
            const cs = getComputedStyle(p);
            // تمرير أفقي حقيقي فقط. ‎hidden/clip‎ لا يُعفى: عنصرٌ يخرج عن الشاشة داخل
            // حاوية تقصّه = محتوى مقطوع يراه المستخدم ناقصاً (هكذا فات الضابطَ أوّل مرّة).
            if(/(auto|scroll)/.test(cs.overflowX)) return true;
            if(cs.position === "fixed") return true;
        }
        return false;
    };
    const name = (el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") +
        (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "");

    const out = { overflow: [], stuck: [], broken: [], contrast: [], squeezed: [] };
    const docW = document.documentElement.scrollWidth;
    if(docW > W + 1) out.overflow.push(`الصفحة ${docW}px > ${W}px`);

    // ⚠️ ‎.main-content‎ تحديداً: أوّل ‎<main>‎ في الصفحة هو شاشة الاختبار المخفيّة،
    // فكان الفحص الأوّل يقيس عنصراً غير معروض وينجح في كل شيء بلا معنى.
    const main = document.querySelector(scopeSel || ".main-content") || document.body;
    main.querySelectorAll("*").forEach(el => {
        if(!visible(el)) return;
        const r = el.getBoundingClientRect();
        if((r.right > W + 2 || r.left < -2) && !inScroller(el) && out.overflow.length < 4)
            out.overflow.push(`${name(el)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    });

    document.querySelectorAll("body *").forEach(el => {
        if(el.children.length || !visible(el)) return;
        const t = (el.textContent || "").trim();
        if(/جار[ٍي]? ?التحميل|Loading…/.test(t) && out.stuck.length < 3) out.stuck.push(name(el) + ": " + t.slice(0, 40));
    });

    // نصٌّ منضغط: فقرة طويلة حُشرت في عمودٍ ضيّق فصارت كلمةً في كل سطر
    // (هكذا ظهر عنوان الواجب بجانب أزراره على الجوّال قبل الإصلاح)
    main.querySelectorAll("b, strong, .card-sub, p, h3, h4").forEach(el => {
        if(out.squeezed.length >= 3 || !visible(el) || inScroller(el)) return;
        const t = (el.textContent || "").trim();
        if(t.split(/\s+/).length < 3) return;
        const r = el.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
        if(r.width < Math.min(140, W * 0.3) && r.height > lh * 2.6) out.squeezed.push(`${name(el)} «${t.slice(0, 20)}» ${Math.round(r.width)}px`);
    });

    document.querySelectorAll("img").forEach(img => {
        if(visible(img) && img.complete && img.getAttribute("src") && img.naturalWidth === 0) out.broken.push(img.getAttribute("src").slice(0, 60));
    });

    // التباين: لون النصّ مقابل أوّل خلفية معتمة فوقه
    // ⚠️ color-mix() يعود بصيغة ‎color(srgb 0.96 0.95 0.9)‎ — قيم 0..1 لا 0..255.
    // قراءتها كـrgb جعلت خلفيةً فاتحة «سوداء» فاتّهم الفحصُ شريطاً سليماً.
    const rgb = (s) => {
        const m = s.match(/[\d.]+/g); if(!m) return null;
        const v = m.map(Number);
        if(/^color\(srgb/.test(s)) return [v[0] * 255, v[1] * 255, v[2] * 255].concat(v.length > 3 ? [v[3]] : []);
        return v;
    };
    const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(r) + .7152 * f(g) + .0722 * f(b); };
    const bgOf = (el) => {
        for(let p = el; p; p = p.parentElement){
            const cs = getComputedStyle(p);
            if(cs.backgroundImage && cs.backgroundImage !== "none") return null;   // تدرّج أو صورة: لا نحكم
            const c = rgb(cs.backgroundColor);
            if(c && (c.length < 4 || c[3] > .85)) return c;
        }
        return rgb(getComputedStyle(document.body).backgroundColor);
    };
    document.body.querySelectorAll("p, span, label, h1, h2, h3, h4, b, strong, small, a, button, td, th, li, div").forEach(el => {
        if(out.contrast.length >= 4 || !visible(el)) return;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
        if(!own) return;
        const cs = getComputedStyle(el);
        const fg = rgb(cs.color), bg = bgOf(el);
        if(!fg || !bg || (fg[3] !== undefined && fg[3] < .5)) return;
        const a = lum(fg), b = lum(bg);
        const ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
        if(ratio < 2) out.contrast.push(`${name(el)} «${el.textContent.trim().slice(0, 24)}» ${ratio.toFixed(2)}`);
    });
    return out;
}

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
        .filter(d => d.startsWith("chromium")).map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome"))
        .find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const sizes = [
        { key:"phone",   ctx: { ...devices["iPhone 13"] } },
        { key:"desktop", ctx: { viewport:{ width:1366, height:850 } } },
    ];
    let total = 0;
    try{
        for(const size of sizes){
            for(const theme of ["light", "dark"]){
                const ctx = await browser.newContext(size.ctx);
                await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
                const page = await ctx.newPage();
                const errs = [];
                page.on("pageerror", e => errs.push(String(e).slice(0, 160)));
                const boot = async () => {
                    await page.goto(base + "/index.html", { waitUntil:"load" });
                    await page.waitForFunction(() => typeof switchTab === "function" && typeof startDemoMode === "function", { timeout:15000 });
                    await page.evaluate(async (dark) => {
                        isDemoMode = () => true; startDemoMode();
                        await new Promise(r => setTimeout(r, 1200));
                        if(typeof khutaLoadGroup === "function"){ await khutaLoadGroup("school"); }
                        document.body.classList.toggle("dark-mode", dark);
                    }, theme === "dark");
                };
                await boot();

                // ضابط: عيوب مزروعة عمداً يجب أن يلتقطها الفحص — وإلا فنجاحه بلا معنى
                const ctl = await page.evaluate((inspectSrc) => {
                    const probe = document.createElement("div");
                    probe.innerHTML = `<div style="width:${window.innerWidth + 300}px;height:10px"></div>
                        <p style="color:#fff;background:#fafafa">نص غير مقروء للضابط</p>
                        <span>جارٍ التحميل…</span>
                        <div style="display:flex"><div style="flex:1;min-width:0"><b>عنوان واجبٍ طويل بعض الشيء هنا</b></div>
                            <div style="flex-shrink:0;width:${window.innerWidth - 100}px;height:20px"></div></div>`;
                    document.querySelector(".main-content").appendChild(probe);
                    const r = (0, eval)("(" + inspectSrc + ")")();
                    probe.remove();
                    return r;
                }, inspect.toString());
                ok("ضابط: الفحص يلتقط التجاوز والتباين والتحميل العالق والنصّ المنضغط المزروعة",
                    ctl.overflow.length > 0 && ctl.contrast.length > 0 && ctl.stuck.length > 0 && ctl.squeezed.length > 0, JSON.stringify(ctl));

                // SWEEP_ONLY=overlays: النوافذ وحدها (دقيقتان بدل ٢٥) للتحقّق السريع من إصلاحٍ فيها
                for(const role of (process.env.SWEEP_ONLY === "overlays" ? [] : ["student", "teacher", "admin"])){
                    console.log(`\n${size.key} · ${theme} · ${role}`);
                    const tabs = await page.evaluate(async (role) => {
                        switchDemoRole(role);
                        await new Promise(r => setTimeout(r, 500));
                        const vis = typeof navItemVisible === "function" ? navItemVisible : (el => getComputedStyle(el).display !== "none");
                        return [...new Set([...document.querySelectorAll(".sidebar .nav-item[data-tab]")]
                            .filter(el => vis(el)).map(el => el.getAttribute("data-tab")))];
                    }, role);
                    for(const tab of tabs){
                        total++;
                        const before = errs.length;
                        await page.evaluate(async (tab) => {
                            try{ switchTab(tab); }catch(e){ console.error(e); }
                            window.scrollTo(0, 0);
                            await new Promise(r => setTimeout(r, 3000));
                        }, tab);
                        const r = await page.evaluate(inspect);
                        const newErrs = errs.slice(before);
                        const bad = [];
                        if(r.overflow.length) bad.push("تجاوز: " + r.overflow.join(" · "));
                        if(r.stuck.length) bad.push("تحميل عالق: " + r.stuck.join(" · "));
                        if(r.broken.length) bad.push("صورة مكسورة: " + r.broken.join(" · "));
                        if(r.squeezed.length) bad.push("نصّ منضغط: " + r.squeezed.join(" · "));
                        if(r.contrast.length) bad.push("تباين: " + r.contrast.join(" · "));
                        if(newErrs.length) bad.push("JS: " + newErrs.join(" · "));
                        ok(`${tab}`, !bad.length, bad.join("\n       "));
                        if(SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size.key}-${theme}-${role}-${tab}.png`), fullPage: true });
                    }
                }

                /* النوافذ المنبثقة: لا تظهر في مرور التبويبات. كل نافذة من صفحةٍ جديدة
                   كي لا تتسرّب حالة نافذة إلى التي بعدها. */
                console.log(`\n${size.key} · ${theme} · نوافذ`);
                const overlays = [
                    { key:"sections-sheet", label:"قائمة الأقسام", role:"student", run:"openNavSheet()", phoneOnly:true },
                    { key:"draw-pad",       label:"لوحة الكتابة بخط اليد", role:"teacher", tab:"schoolexams",
                      run:"examDraft = null; ensureExamDraft(); openExplanationDraw(0)" },
                    { key:"exam-send",      label:"إرسال اختبار", role:"teacher", tab:"schoolexams", click:"openExamSend" },
                    { key:"exam-results",   label:"نتائج اختبار", role:"teacher", tab:"schoolexams", click:"openSchoolExamResults" },
                    { key:"student-exam",   label:"الاختبار عند الطالب", role:"student", tab:"schoolexams", click:"openStudentExam" },
                    { key:"student-hw",     label:"الواجب عند الطالب", role:"student", tab:"schoolhw", click:"openStudentExam" },
                ];
                for(const ov of overlays){
                    if(ov.phoneOnly && size.key !== "phone") continue;
                    total++;
                    await boot();
                    const before = errs.length;
                    const opened = await page.evaluate(async (ov) => {
                        const big = () => [...document.querySelectorAll("body *")].filter(el => {
                            const cs = getComputedStyle(el);
                            if(cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return false;
                            const r = el.getBoundingClientRect();
                            return r.width * r.height > innerWidth * innerHeight * 0.35;
                        }).length;
                        switchDemoRole(ov.role);
                        await new Promise(r => setTimeout(r, 400));
                        if(ov.tab){ switchTab(ov.tab); await new Promise(r => setTimeout(r, 1800)); }
                        const bigSet = () => new Set([...document.querySelectorAll("body *")].filter(el => {
                            const cs = getComputedStyle(el);
                            if(cs.position !== "fixed" || cs.display === "none" || cs.visibility === "hidden") return false;
                            const r = el.getBoundingClientRect();
                            return r.width * r.height > innerWidth * innerHeight * 0.35;
                        }));
                        const s0 = bigSet();
                        const n0 = big();
                        if(ov.click){
                            const b = [...document.querySelectorAll(`[onclick^="${ov.click}"]`)].find(x => x.offsetParent !== null);
                            if(!b) return "NO_BUTTON";
                            b.click();
                        }else (0, eval)(ov.run);
                        await new Promise(r => setTimeout(r, 2000));
                        if(big() <= n0) return "NOT_OPEN";
                        // مغطّاة؟ لكل عنوان ونصّ وزرّ ظاهر في النافذة: هل هي فعلاً ما يقع
                        // تحت مركزه؟ (هكذا غطّى شريط «دخول سريع» رأس نافذة النتائج)
                        const win = [...bigSet()].filter(el => !s0.has(el)).pop();
                        const covered = [];
                        if(win) win.querySelectorAll("h1, h2, h3, h4, p, button, label").forEach(el => {
                            if(covered.length >= 3) return;
                            const r = el.getBoundingClientRect();
                            if(!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return;
                            const cs = getComputedStyle(el);
                            if(cs.visibility === "hidden" || +cs.opacity === 0) return;
                            const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                            if(top && !win.contains(top) && !top.closest(".demo-bar"))
                                covered.push(`«${(el.textContent || "").trim().slice(0, 18)}» تحت ${top.id || top.className || top.tagName}`);
                        });
                        return covered.length ? "COVERED: " + covered.join(" · ") : "OPEN";
                    }, ov);
                    const r = await page.evaluate(inspect, "body");
                    const newErrs = errs.slice(before);
                    const bad = [];
                    if(opened !== "OPEN") bad.push(opened === "NO_BUTTON" ? "لا زرّ يفتحها في بيانات العرض"
                        : opened.startsWith("COVERED") ? "مغطّاة: " + opened.slice(9) : "لم تُفتح");
                    if(r.overflow.length) bad.push("تجاوز: " + r.overflow.join(" · "));
                    if(r.stuck.length) bad.push("تحميل عالق: " + r.stuck.join(" · "));
                    if(r.broken.length) bad.push("صورة مكسورة: " + r.broken.join(" · "));
                    if(r.squeezed.length) bad.push("نصّ منضغط: " + r.squeezed.join(" · "));
                    if(newErrs.length) bad.push("JS: " + newErrs.join(" · "));
                    ok(ov.label, !bad.length, bad.join("\n       "));
                    if(SHOTS) await page.screenshot({ path: path.join(SHOTS, `${size.key}-${theme}-overlay-${ov.key}.png`) });
                }
                await ctx.close();
            }
        }
    }finally{
        await browser.close(); srv.close();
    }
    console.log(`\n${total} شاشة · ${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
