/* ============================================================
   صيد المربّع الأبيض في الوضع الداكن
   ------------------------------------------------------------
   شكوى المالك: «المربع الابيض الموجود… له فترة طويلة نحاول حله ولم يُحل،
   حتى إنه لا يتضح في الصورة».

   ⚠️ ولهذا لا يُصاد بالنظر. الطريقة هنا: نصوّر الصفحة فعلاً، ونقرأ
   بكسلاتها واحدةً واحدة، ونجمع الفاتح منها في مستطيلات، ثم نسأل المتصفّح
   «من العنصر الذي يشغل هذه النقطة؟». فالنتيجة عنصرٌ باسمه لا تخمين.

   ⚠️ ولماذا لا نكتفي بالمرور على العناصر وقراءة backgroundColor؟ لأن
   التدرّجات وشبه الشفّاف تكذب: عنصر خلفيته rgba(255,255,255,.05) يُقرأ
   "أبيض" وهو غير مرئي، وعنصر بلا خلفية إطلاقاً قد يُظهر بياض ما تحته.
   البكسل المطبوع وحده هو الحقيقة. (وهذا الدرس كلّفنا بلاغاً كاذباً
   بنسبة تباين 1.19 مستحيلة في فحص سابق.)

   ⚠️ والمتصفّح نفسه هو فاكّ ترميز PNG: نحقن الصورة base64 في الصفحة
   ونرسمها على canvas ونقرأ getImageData — فلا نحتاج مكتبة خارجية.
   ============================================================ */

let chromium;
try{ ({ chromium } = require("playwright")); }
catch(e){
    console.log("⚠️  يحتاج متصفّحاً: npm install playwright --no-save");
    process.exit(2);
}
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
               ".js":"text/javascript; charset=utf-8", ".json":"application/json",
               ".svg":"image/svg+xml", ".png":"image/png", ".webmanifest":"application/manifest+json",
               ".ico":"image/x-icon" };

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

/** يحلّل لقطة الشاشة داخل المتصفّح ويعيد مستطيلات المناطق الفاتحة. */
async function lightRegions(page, b64, minLum){
    return page.evaluate(async ({ b64, minLum }) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();

        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);

        /* شبكة خشنة: نفحص كل 4 بكسلات. المربّع الذي يشكو منه المالك كبير
           بما يكفي، والمسح الكامل لمليوني بكسل بطيء بلا فائدة. */
        const STEP = 4;
        const lum = (r, g, b) => (0.2126*r + 0.7152*g + 0.0722*b) / 255;

        const hits = [];
        for(let y = 0; y < height; y += STEP){
            for(let x = 0; x < width; x += STEP){
                const i = (y*width + x) * 4;
                if(lum(data[i], data[i+1], data[i+2]) >= minLum) hits.push([x, y]);
            }
        }

        /* تجميع النقاط المتجاورة في مستطيلات (بحث عرضي بسيط) */
        const seen = new Set();
        const key = (x, y) => x + "," + y;
        const has = new Set(hits.map(([x,y]) => key(x,y)));
        const boxes = [];

        for(const [sx, sy] of hits){
            if(seen.has(key(sx, sy))) continue;
            const queue = [[sx, sy]];
            seen.add(key(sx, sy));
            let x0=sx, x1=sx, y0=sy, y1=sy, n=0;
            while(queue.length){
                const [x, y] = queue.pop();
                n++;
                if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
                for(const [dx, dy] of [[STEP,0],[-STEP,0],[0,STEP],[0,-STEP]]){
                    const nx = x+dx, ny = y+dy, k = key(nx, ny);
                    if(has.has(k) && !seen.has(k)){ seen.add(k); queue.push([nx, ny]); }
                }
            }
            boxes.push({ x:x0, y:y0, w:x1-x0+STEP, h:y1-y0+STEP, px:n });
        }

        /* نتجاهل الصغير: النصّ الأبيض والأيقونات تُعطي بقعاً صغيرة كثيرة،
           وهي ليست "مربّعاً أبيض". */
        return boxes
            .filter(b => b.w >= 40 && b.h >= 8 && b.px >= 40)
            .sort((a, b) => (b.w*b.h) - (a.w*a.h))
            .slice(0, 12);
    }, { b64, minLum });
}

/** من العنصر الذي يشغل هذه النقطة؟ ومن أين جاء بياضه؟ */
async function blame(page, x, y, dpr){
    return page.evaluate(({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if(!el) return { none:true };

        const describe = (e) => {
            if(!e || e === document.documentElement) return e ? "html" : "";
            const id = e.id ? "#" + e.id : "";
            const cls = (typeof e.className === "string" && e.className.trim())
                ? "." + e.className.trim().split(/\s+/).slice(0, 3).join(".") : "";
            return e.tagName.toLowerCase() + id + cls;
        };

        /* نصعد السلسلة حتى نجد أوّل عنصر خلفيته غير شفّافة — فهو الطالي */
        const chain = [];
        let cur = el, painter = null;
        while(cur && chain.length < 8){
            const cs = getComputedStyle(cur);
            const bg = cs.backgroundColor;
            const opaque = bg && bg !== "transparent" && !/rgba\(.*,\s*0\)$/.test(bg);
            chain.push({
                sel: describe(cur),
                bg,
                bgImage: cs.backgroundImage === "none" ? "" : cs.backgroundImage.slice(0, 60),
                pos: cs.position,
                z: cs.zIndex,
                rect: (r => ({ x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) }))(cur.getBoundingClientRect()),
            });
            if(!painter && opaque) painter = chain[chain.length-1];
            cur = cur.parentElement;
        }
        return { chain, painter };
    }, { x: x/dpr, y: y/dpr });
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
    /* ⚠️ وضع العرض محصور بحكم الكود في مضيفات Netlify التي تحوي "--"،
       فلا يعمل على 127.0.0.1 إطلاقاً. فنُخبر المتصفّح أن هذا الاسم يقع
       على خادمنا المحلّي: الصفحة تقرأ location.hostname فتراه حقيقياً،
       والطلب يصل إلينا. فنُعيد شاشة المالك نفسها بلا حساب ولا شبكة. */
    const HOST = "deploy-preview-23--khutaa.netlify.app";
    const browser = await chromium.launch({
        ...(guesses.length ? { executablePath: guesses[0] } : {}),
        args: [`--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port}`],
    });

    /* مقاسات: لقطة المالك شاشة عريضة جداً */
    const SIZES = [ { w:1920, h:950 }, { w:1600, h:900 }, { w:1366, h:768 } ];
    let found = 0;

    try{
        for(const size of SIZES){
            const page = await browser.newPage({ viewport:{ width:size.w, height:size.h }, deviceScaleFactor:1 });

            /* ⚠️ الوضع الداكن يُضبط عبر مسار الموقع نفسه لا بإضافة الفئة يدوياً.
               إضافتها يدوياً تُنشئ حالةً لا تحدث لمستخدم حقيقي: body داكن
               وhtml فاتح، لأن applyThemeChrome لم تُستدعَ — فيُبلَّغ عن مربّع
               أبيض من صنع الفحص نفسه. الإقلاع يقرأ khuta_theme فنكتبه قبله. */
            await page.addInitScript(() => {
                try{ localStorage.setItem("khuta_theme", "dark"); }catch(e){}
            });

            await page.goto(`http://${HOST}/index.html?demo=1`, { waitUntil:"load" });
            await page.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
            /* ⚠️ body عليه transition لونية نصف ثانية: القياس قبلها يقرأ
               ألوان منتصف التلاشي لا الألوان النهائية. */
            await page.waitForTimeout(1200);

            const themeOk = await page.evaluate(() => ({
                dark: document.body.classList.contains("dark-mode"),
                html: getComputedStyle(document.documentElement).backgroundColor,
                body: getComputedStyle(document.body).backgroundColor,
            }));
            console.log(`   الوضع الداكن: ${themeOk.dark ? "مُفعَّل" : "لم يُفعَّل ⚠️"}  ·  html: ${themeOk.html}  ·  body: ${themeOk.body}`);

            const demoOn = await page.evaluate(() => !!document.querySelector(".demo-role-btn"));
            console.log(`\n▶ ${size.w}×${size.h} — وضع العرض: ${demoOn ? "يعمل ✅" : "لم يبدأ ⚠️"}`);

            const roles = demoOn ? ["teacher", "student", "admin"] : ["—"];
            for(const role of roles){
                if(demoOn) await page.evaluate(r => { try{ switchDemoRole(r); }catch(e){} }, role);
                await page.waitForTimeout(400);

                for(const tab of ["dashboard", "school", "schooladmin", "profile", "settings"]){
                    await page.evaluate(t => { try{ switchTab(t); }catch(e){} }, tab);
                    await page.waitForTimeout(350);

                    /* نمسح أعلى الصفحة وبعد تمرير — المربّع قد يظهر عند حافة */
                    for(const scroll of [0, 400]){
                        await page.evaluate(y => window.scrollTo(0, y), scroll);
                        await page.waitForTimeout(200);

                        const b64 = (await page.screenshot()).toString("base64");
                        const boxes = await lightRegions(page, b64, 0.72);

                        for(const b of boxes){
                            const info = await blame(page, b.x + Math.floor(b.w/2), b.y + Math.floor(b.h/2), 1);
                            found++;
                            console.log(`\n🔲 ${size.w}px · ${role} · ${tab} · تمرير ${scroll} — ${b.w}×${b.h} عند (${b.x}, ${b.y})`);
                            if(info.none){ console.log("   لا عنصر في هذه النقطة"); continue; }
                            if(info.painter){
                                console.log(`   الطالي: ${info.painter.sel}`);
                                console.log(`     خلفية: ${info.painter.bg}${info.painter.bgImage ? "  تدرّج: " + info.painter.bgImage : ""}`);
                                console.log(`     موضع: ${info.painter.pos}  z:${info.painter.z}  إطار: ${JSON.stringify(info.painter.rect)}`);
                            }
                            console.log("   السلسلة: " + info.chain.map(c => c.sel).join("  ←  "));
                        }
                    }
                }
            }
            await page.close();
        }

        if(!found) console.log("\nلا منطقة فاتحة كبيرة في أي مقاس أو دور أو تبويب.");
        console.log(`\n=== انتهى — ${found} منطقة ===`);
    }catch(e){
        console.error("خطأ:", e && e.message);
        process.exitCode = 1;
    }finally{
        await browser.close();
        srv.close();
    }
}

main();
