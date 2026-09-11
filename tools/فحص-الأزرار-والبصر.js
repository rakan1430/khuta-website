/* ============================================================
   فحص الأزرار الوهمية والمشكلات البصرية
   ------------------------------------------------------------
   طلب المالك: «فحص للموقع، خاصّة للمشكلات البصرية والأزرار التي لا تعمل
   أو وهمية».

   والزرّ الوهمي أسوأ من الميزة الناقصة: الميزة الناقصة لا يعرفها أحد،
   والزرّ الوهمي يَعِد ثم يُخلف أمام مدير مدرسة في عرضٍ حيّ. وقد وقع هذا
   فعلاً في هذا المشروع أكثر من مرّة — زرّ «النتائج» يظهر للمدير ثم يقول
   «لم يؤدِّ أحد هذا الاختبار»، وقائمة نقل الطلاب تُفتح فارغة.

   ⚠️ وكيف يُكتشف الزرّ الوهمي؟ كل أزرار هذا الموقع تستدعي دوالّ بأسمائها
   في سمة onclick. فنجمع كل اسم دالّة مُنادى في الصفحة، ثم نسأل المتصفّح
   نفسه: هل هذه الدالّة موجودة؟

   ⚠️ والسؤال يُطرح داخل سكربت كلاسيكي في النطاق العام لا عبر
   ‎window[name]‎. والسبب دقيق: الدوالّ المعرَّفة بـ‎function f(){}‎ تصير
   خصائص لـwindow، أما المعرَّفة بـ‎const f = …‎ فمتغيّرات معجمية ليست في
   window إطلاقاً — ومعالجات onclick تراها رغم ذلك لأنها في سلسلة النطاق
   العام. فالفحص بـwindow وحده يتّهم أزراراً سليمة بأنها وهمية.
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
const problems = [];

function ok(name, cond, detail){
    if(cond){ pass++; console.log("  ✅ " + name); }
    else{
        fail++;
        problems.push(name + (detail ? " — " + detail : ""));
        console.log("  ❌ " + name + (detail ? "\n       " + detail : ""));
    }
}

const MIME = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css",
               ".json":"application/json", ".png":"image/png", ".svg":"image/svg+xml",
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

/* أسماء تُنادى في onclick لكنها ليست دوالّ الموقع */
const BUILTINS = new Set([
    "event","this","window","document","location","history","console","alert",
    "confirm","prompt","true","false","null","undefined","return","if","else",
    "Math","JSON","Date","Number","String","Boolean","Array","Object","setTimeout",
    "navigator","localStorage","sessionStorage","parseInt","parseFloat",
]);

/** يستخرج أسماء الدوالّ المُناداة من نصّ معالج.
 *  ⚠️ ويتجاهل ما سبقته نقطة: ‎document.getElementById(…)‎ نداءُ توصيفة
 *  على كائن لا دالّة عامّة، واتّهامها بأنها "مفقودة" بلاغٌ كاذب يُفقد
 *  الفحص كلّه مصداقيته. (أوّل تشغيل أعطاني getElementById و click.) */
function calledNames(code){
    const out = new Set();
    const re = /(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g;
    let m;
    while((m = re.exec(code))){
        const name = m[2];
        if(!BUILTINS.has(name)) out.add(name);
        re.lastIndex = m.index + m[0].length - 1;   // لا نبتلع الحرف الفاصل
    }
    return [...out];
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
    const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
    const jsErrors = [];
    page.on("pageerror", e => jsErrors.push(String(e)));

    try{
        await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil:"load" });
        await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });

        /* ============================================================
           ١) أزرار تستدعي دوالّ لا وجود لها
           ============================================================ */
        console.log("\nأزرار تَعِد ولا تفعل");

        const handlers = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll("[onclick],[onchange],[oninput],[onsubmit]").forEach(el => {
                ["onclick","onchange","oninput","onsubmit"].forEach(attr => {
                    const code = el.getAttribute(attr);
                    if(!code) return;
                    out.push({
                        attr, code,
                        tag: el.tagName.toLowerCase(),
                        id: el.id || "",
                        label: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
                    });
                });
            });
            return out;
        });

        const nameToUses = new Map();
        handlers.forEach(h => {
            calledNames(h.code).forEach(n => {
                if(!nameToUses.has(n)) nameToUses.set(n, []);
                nameToUses.get(n).push(h);
            });
        });
        const names = [...nameToUses.keys()];

        /* ⚠️ داخل سكربت كلاسيكي في النطاق العام — لا عبر window.
           و‎typeof‎ على اسمٍ غير معرَّف لا يرمي خطأً، فالفحص آمن. */
        await page.addScriptTag({ content:
            "window.__exists = {" +
            names.map(n => `${JSON.stringify(n)}:(typeof ${n} === "function")`).join(",") +
            "};" });
        const exists = await page.evaluate(() => window.__exists);

        const missing = names.filter(n => !exists[n]);
        ok(`كل دالّة تُنادى من الواجهة موجودة (${names.length} دالّة)`,
           missing.length === 0,
           missing.map(n => {
               const u = nameToUses.get(n)[0];
               return `${n}()  ← <${u.tag}${u.id ? " #" + u.id : ""}> "${u.label}"`;
           }).join("\n       "));

        /* ============================================================
           ٢) تبويبات تشير إلى أقسام غير موجودة
           ============================================================ */
        const tabs = await page.evaluate(() => {
            /* ⚠️ في الموقع نظاما تبويب: قائمة التنقّل الرئيسية تنادي
               switchTab وتفتح ‎#view-*‎، وتبويبات السبورة تنادي
               switchBoardTab وتفتح ألواحاً داخل نافذتها. وخلطُهما يتّهم
               تبويبات السبورة الأربعة بأنها بلا أقسام — وهي سليمة. */
            const wanted = [...document.querySelectorAll("[data-tab]")]
                .filter(el => /switchTab\s*\(/.test(el.getAttribute("onclick") || ""))
                .map(el => el.getAttribute("data-tab"));
            const have = [...document.querySelectorAll(".view-section[id^='view-']")]
                .map(el => el.id.replace(/^view-/, ""));
            return { wanted: [...new Set(wanted)], have };
        });
        const deadTabs = tabs.wanted.filter(t => !tabs.have.includes(t));
        ok(`كل تبويب في القائمة له قسمٌ يفتحه (${tabs.wanted.length} تبويباً)`,
           deadTabs.length === 0, deadTabs.join("، "));

        /* ============================================================
           ٣) أزرار بلا نصّ ولا وصف — لا يعرف قارئ الشاشة ولا المستخدم
           ============================================================ */
        const mute = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll("button, [role='button']").forEach(el => {
                const text = (el.textContent || "").trim();
                const icon = el.querySelector("i[class*='fa-']");
                const label = el.getAttribute("aria-label") || el.getAttribute("title") || "";
                if(!text && !label){
                    out.push((el.id ? "#" + el.id : el.className.toString().slice(0, 40)) +
                             (icon ? "  أيقونة: " + (/fa-[\w-]+/.exec(icon.className) || [""])[0] : ""));
                }
            });
            return out;
        });
        ok(`كل زرّ له نصّ أو وصف (${mute.length} بلا أيّهما)`,
           mute.length === 0, mute.slice(0, 10).join("، "));

        /* ============================================================
           ٤) روابط لا تذهب إلى شيء
           ============================================================ */
        const deadLinks = await page.evaluate(() => {
            const out = [];
            document.querySelectorAll("a[href]").forEach(a => {
                /* ⚠️ المخفيّ لا يُحاسَب: رابط الدعم يبقى ‎href="#"‎ ومخفيّاً
                   حتى يُضبط عنوانه في الإعدادات، ثم يُعرض بعنوانه. واتّهامه
                   وهو مخفيّ بلاغٌ كاذب. */
                const st = getComputedStyle(a);
                if(st.display === "none" || st.visibility === "hidden") return;
                const href = a.getAttribute("href");
                if((href === "#" || href === "") && !a.getAttribute("onclick")){
                    out.push((a.textContent || "").trim().slice(0, 30) || a.className);
                }
            });
            return out;
        });
        ok(`لا رابط فارغ يوهم بوجهة (${deadLinks.length})`,
           deadLinks.length === 0, deadLinks.slice(0, 10).join("، "));

        /* ============================================================
           ٥) المشكلات البصرية — على ثلاثة مقاسات حقيقية
           ------------------------------------------------------------
           ⚠️ ويُفتح كل تبويب بـswitchTab كما يفتحه المستخدم، لا بإظهارٍ
           قسري: القسر يُظهر ما صُمّم ليبقى مخفيّاً فيولّد بلاغات كاذبة.
           ============================================================ */
        const SIZES = [
            { w: 1920, h: 1080, name: "سبورة الفصل" },
            { w: 1280, h: 800,  name: "حاسوب" },
            { w: 390,  h: 780,  name: "جوّال" },
        ];

        for(const size of SIZES){
            console.log(`\nالتخطيط على ${size.name} (${size.w}×${size.h})`);
            await page.setViewportSize({ width: size.w, height: size.h });

            const found = await page.evaluate(async (tabsList) => {
                const bad = { overflow: [], offscreen: [], tiny: [], overlap: [] };
                const isVisible = (el) => {
                    const s = getComputedStyle(el);
                    if(s.display === "none" || s.visibility === "hidden" || s.opacity === "0") return false;
                    const r = el.getBoundingClientRect();
                    return r.width > 0 && r.height > 0;
                };
                const label = (el) =>
                    (el.id ? "#" + el.id : "") ||
                    (el.className && el.className.toString().split(" ")[0] ? "." + el.className.toString().split(" ")[0] : el.tagName);

                for(const tab of tabsList){
                    try{ switchTab(tab); }catch(e){ continue; }
                    await new Promise(r => setTimeout(r, 60));

                    /* تمرير أفقي في الصفحة كلّها */
                    if(document.documentElement.scrollWidth > window.innerWidth + 1){
                        bad.overflow.push(`${tab}: ${document.documentElement.scrollWidth}px > ${window.innerWidth}px`);
                    }

                    const view = document.getElementById("view-" + tab);
                    if(!view || !isVisible(view)) continue;

                    view.querySelectorAll("*").forEach(el => {
                        if(!isVisible(el)) return;
                        const r = el.getBoundingClientRect();
                        /* عنصر يخرج عن يمين الشاشة أو يسارها */
                        if(r.right > window.innerWidth + 2 || r.left < -2){
                            const tag = `${tab} ${label(el)}`;
                            if(!bad.offscreen.some(x => x.startsWith(tag))){
                                bad.offscreen.push(`${tag} (${Math.round(r.left)}→${Math.round(r.right)})`);
                            }
                        }
                    });

                    /* أهداف اللمس على الجوّال والسبورة اللمسية */
                    if(window.innerWidth <= 500){
                        view.querySelectorAll("button, [role='button'], a, input[type='checkbox']").forEach(el => {
                            if(!isVisible(el)) return;
                            /* ⚠️ يُقاس الهدف الفعلي لا العنصر وحده: مربّع
                               الاختيار داخل <label> يجعل الصفّ كلّه قابلاً
                               للّمس، فقياس المربّع وحده يُبلّغ عن ٢٤ بكسل
                               بينما يلمس المستخدم صفّاً أعرض وأعلى. */
                            const target = (el.tagName === "INPUT" && el.closest("label")) || el;
                            const r = target.getBoundingClientRect();
                            if(r.height < 32 || r.width < 32){
                                const tag = `${tab} ${label(el)}`;
                                if(!bad.tiny.some(x => x.startsWith(tag))){
                                    bad.tiny.push(`${tag} ${Math.round(r.width)}×${Math.round(r.height)}`);
                                }
                            }
                        });
                    }
                }
                return bad;
            }, tabs.have);

            ok("لا تمرير أفقي في أي تبويب", found.overflow.length === 0,
               found.overflow.slice(0, 6).join("\n       "));
            ok("لا عنصر يخرج عن حافة الشاشة", found.offscreen.length === 0,
               found.offscreen.slice(0, 8).join("\n       "));
            if(size.w <= 500){
                ok("أهداف اللمس ٣٢ بكسل فأكثر", found.tiny.length === 0,
                   found.tiny.slice(0, 8).join("\n       "));
            }
        }

        /* ============================================================
           ٦) تباين النصّ — ما لا يُقرأ كأنه غير موجود
           ============================================================ */
        console.log("\nوضوح النصّ");
        await page.setViewportSize({ width: 1280, height: 900 });
        const contrast = await page.evaluate(async (tabsList) => {
            const lum = (c) => {
                const [r, g, b] = c.map(v => {
                    v /= 255;
                    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const parse = (s) => {
                const m = /rgba?\(([^)]+)\)/.exec(s);
                if(!m) return null;
                const p = m[1].split(",").map(x => parseFloat(x));
                return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
            };
            /* ⚠️ التدرّجات تُقرأ أيضاً. وبدونها يمشي الفحص فوق زرٍّ ذهبيّ
               متدرّج ويحسب النصّ الأبيض على خلفية البطاقة البيضاء تحته،
               فيُخرج نسبة 1.00:1 — رقمٌ مستحيل يعني "أبيض على أبيض".
               رأيتُه في أول تشغيل على «جلسة الخطة». ونأخذ أغمق لونٍ في
               التدرّج لا أوّله: الأسوأ هو ما يُحاسَب عليه. */
            const fromGradient = (s) => {
                if(!s || s === "none") return null;
                /* ⚠️ الشفافية تُحترم: كثير من بطاقات الموقع عليها طبقة
                   ‎rgba(0,0,0,.05)‎ زخرفية. وتجاهلُ قناة الشفافية يجعلها
                   "خلفية سوداء"، فيُبلَّغ عن نصٍّ داكن على أسود بنسبة
                   1.19:1 — وهو في الواقع نصٌّ داكن على بطاقة فاتحة.
                   ثلاثة من بلاغاتي الأولى كانت من هذا. */
                const stops = [...s.matchAll(/rgba?\(([^)]+)\)/g)]
                    .map(m => m[1].split(",").map(x => parseFloat(x)))
                    .filter(p => (p.length > 3 ? p[3] : 1) > 0.5)
                    .map(p => p.slice(0, 3));
                if(!stops.length) return null;
                return stops.reduce((a, b) => (lum(a) <= lum(b) ? a : b));
            };
            const bgOf = (el) => {
                let n = el;
                while(n && n !== document.documentElement){
                    const st = getComputedStyle(n);
                    const g = fromGradient(st.backgroundImage);
                    if(g) return g;
                    const c = parse(st.backgroundColor);
                    if(c && c.a > 0.5) return c.rgb;
                    n = n.parentElement;
                }
                const c = parse(getComputedStyle(document.body).backgroundColor);
                return c ? c.rgb : [255, 255, 255];
            };
            const out = [];
            const seen = new Set();
            for(const tab of tabsList){
                try{ switchTab(tab); }catch(e){ continue; }
                await new Promise(r => setTimeout(r, 50));
                const view = document.getElementById("view-" + tab);
                if(!view) continue;
                view.querySelectorAll("p, span, b, small, label, h1, h2, h3, h4, li, td, th, div").forEach(el => {
                    const s = getComputedStyle(el);
                    if(s.display === "none" || s.visibility === "hidden") return;
                    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
                    if(!own) return;
                    const r = el.getBoundingClientRect();
                    if(r.width === 0 || r.height === 0) return;
                    const fg = parse(s.color);
                    if(!fg || fg.a < 0.5) return;
                    const bg = bgOf(el);
                    const l1 = lum(fg.rgb), l2 = lum(bg);
                    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
                    const size = parseFloat(s.fontSize);
                    const bold = parseInt(s.fontWeight, 10) >= 700;
                    const large = size >= 24 || (size >= 18.66 && bold);
                    const need = large ? 3 : 4.5;
                    if(ratio < need){
                        const key = `${tab}|${s.color}|${Math.round(size)}`;
                        if(seen.has(key)) return;
                        seen.add(key);
                        out.push(`${tab}: "${(el.textContent || "").trim().slice(0, 26)}" ` +
                                 `${ratio.toFixed(2)}:1 (المطلوب ${need}) حجم ${Math.round(size)}`);
                    }
                });
            }
            return out;
        }, tabs.have);
        ok(`كل نصّ يحقّق حدّ WCAG AA (${contrast.length} مخالفة)`,
           contrast.length === 0, contrast.slice(0, 12).join("\n       "));

        /* ============================================================
           ٧) لا أخطاء جافاسكربت أثناء تصفّح كل التبويبات
           ============================================================ */
        console.log("\nوحدة التحكّم");
        ok("لا خطأ جافاسكربت أثناء فتح كل الأقسام",
           jsErrors.length === 0, jsErrors.slice(0, 5).join("\n       "));

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

console.log("=== فحص الأزرار الوهمية والمشكلات البصرية ===");
main();
