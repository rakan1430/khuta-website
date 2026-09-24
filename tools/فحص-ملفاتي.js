/* ============================================================
   فحص المرحلة ٤ — «ملفاتي» (واجهة)
   ------------------------------------------------------------
   حدّ الـ٣٠ ميجا بالبايت، ورفض غير Google والمجهول، وعزل الملفات بين
   الطلاب، وصلاحيات «ملفات من خُطى» — مفحوصة في القاعدة بسياسات المخزن
   نفسها. هنا الواجهة:
     ١) بلا دخول / بحساب غير Google: بوابة «الدخول بحساب Google».
     ٢) حساب Google: شريط المساحة، والقائمة، ولا زرّ مشاركة ولا نسخ رابط.
     ٣) الفحص المبكر قبل الرفع: أكبر من ١٠ ميجا، أو لا تتّسع المساحة، أو نوع آخر.
     ٤) الرفع: المسار داخل مجلد الطالب، والاسم يُحفظ.
     ٥) الفتح برابط موقَّع ٦٠ ثانية.
     ٦) «ملفات من خُطى»: نموذج النشر للمالك وحده، والحذف من المخزن قبل السجلّ.
     ٧) الجوّال: الملف لا يُحمَّل إلا عند فتح التبويب.
   التشغيل:  node tools/فحص-ملفاتي.js
   ============================================================ */
let chromium, devices;
try{ ({ chromium, devices } = require("playwright")); }
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


/* عميل وهمي بما تحتاجه الصفحة فقط، يسجّل كل نداء */
const FAKE = `
window.__calls = [];
window.makeFakeSb = function(opts){
    const log = (k, v) => window.__calls.push([k, v]);
    return {
        auth: {
            getSession: async () => ({ data:{ session: opts.user ? { user: opts.user } : null } }),
            getUser: async () => ({ data:{ user: opts.user || null } }),
        },
        rpc: async (fn) => fn === "my_files_status" ? { data: opts.status, error:null }
                         : fn === "my_files_list" ? { data: opts.list || [], error:null } : { data:null, error:null },
        from: (t) => {
            const q = { select(){ return q; }, order(){ return q; }, eq(){ return q; },
                limit: async () => ({ data: t === "khuta_files" ? (opts.khuta || []) : [], error:null }),
                insert: async (r) => { log("insert:" + t, r); return { error:null }; },
                upsert: async (r) => { log("upsert:" + t, r); return { error:null }; },
                delete(){ return { eq: async (c, v) => { log("delete:" + t, v); return { error:null }; } }; } };
            return q;
        },
        storage: { from: (b) => ({
            upload: async (p, f, o) => { log("upload:" + b, { p, size: f.size, type: o.contentType }); return { error:null }; },
            remove: async (ps) => { log("remove:" + b, ps); return { error:null }; },
            createSignedUrl: async (p, s) => { log("sign:" + b, { p, s }); return { data:{ signedUrl:"about:blank#" + p }, error:null }; },
        }) },
    };
};`;

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
        .filter(d => d.startsWith("chromium")).map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome"))
        .find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    const UID = "11111111-2222-3333-4444-555555555555";
    try{
        const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        await page.goto(base + "/index.html", { waitUntil:"load" });
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderMyFilesTab === "function", { timeout:15000 });
        await page.addScriptTag({ content: FAKE });

        console.log("\n١) البوابة");
        const gate = await page.evaluate(async (UID) => {
            sb = makeFakeSb({ user:null });
            switchTab("myfiles"); await new Promise(r => setTimeout(r, 300));
            const none = document.getElementById("myfiles-body").textContent;
            sb = makeFakeSb({ user:{ id:UID }, status:{ google:false, used:0, limit:31457280 } });
            await renderMyFilesTab();
            const email = document.getElementById("myfiles-body").textContent;
            return { none, email, btn: !!document.querySelector("#myfiles-body [onclick^='signInWithGoogle']"),
                     upload: !!document.getElementById("myf-file") };
        }, UID);
        ok("بلا دخول: «سجّل دخولك بحساب Google»", /بحساب Google/.test(gate.none));
        ok("حساب غير Google: «لحسابات Google فقط» وزرّ الدخول، ولا رفع", /لحسابات Google فقط/.test(gate.email) && gate.btn && !gate.upload);

        console.log("\n٢) حساب Google");
        const g = await page.evaluate(async (UID) => {
            sb = makeFakeSb({ user:{ id:UID }, status:{ google:true, used:20971520, limit:31457280, count:1 },
                list:[{ path: UID + "/a.pdf", title:"<img src=x onerror=window.__xss=1>", size:20971520, mime:"application/pdf", created_at:new Date().toISOString() }],
                khuta:[{ id:"K1", path:"k/g.pdf", title:"دليل القدرات", description:"من خُطى" }] });
            isAdmin = false;
            await renderMyFilesTab();
            const body = document.getElementById("myfiles-body");
            return { text: body.textContent, xss: !!window.__xss, escaped: body.innerHTML.includes("&lt;img"),
                     share: /مشاركة الرابط|نسخ الرابط|share link/i.test(body.innerHTML.replace(/لا روابط مشاركة لها/, "")),
                     khutaForm: !!document.getElementById("kf-title") };
        }, UID);
        ok("شريط المساحة: «استعملت 20 ميجا من 30 ميجا»", /استعملت 20 ميجا من 30 ميجا/.test(g.text), g.text.slice(0, 120));
        ok("اسمٌ فيه وسم يُعرض نصاً", !g.xss && g.escaped);
        ok("لا زرّ مشاركة ولا نسخ رابط", !g.share);
        ok("«ملفات من خُطى» تظهر، وبلا نموذج نشر لغير المالك", /دليل القدرات/.test(g.text) && !g.khutaForm);

        console.log("\n٣) الفحص المبكر قبل الرفع");
        const pre = await page.evaluate(async () => {
            const toasts = []; const real = showToast; showToast = m => { toasts.push(m); real(m); };
            const put = (size, type, name) => {
                const dt = new DataTransfer();
                dt.items.add(new File([new Uint8Array(size)], name, { type }));
                document.getElementById("myf-file").files = dt.files;
            };
            window.__calls = [];
            put(11 * 1048576, "application/pdf", "big.pdf"); await uploadMyFile();
            put(1000, "text/plain", "x.txt"); await uploadMyFile();
            put(9 * 1048576 + 1, "application/pdf", "nine.pdf"); await uploadMyFile();   // ٢٠ + ٩ = ٢٩ < ٣٠ ⇒ يُقبل
            const firstUploads = window.__calls.filter(c => c[0].startsWith("upload")).length;
            myfStatus.used = 28 * 1048576;
            put(3 * 1048576, "image/png", "p.png"); await uploadMyFile();
            return { toasts, firstUploads, uploads: window.__calls.filter(c => c[0].startsWith("upload")).length, calls: window.__calls };
        });
        ok("أكبر من ١٠ ميجا يُرفض قبل الرفع", /١٠ ميجا/.test(pre.toasts[0] || ""), pre.toasts[0]);
        ok("غير PDF/صورة يُرفض", /PDF أو صورة/.test(pre.toasts[1] || ""), pre.toasts[1]);
        ok("ملف يتّسع يُرفع مرة واحدة", pre.firstUploads === 1, String(pre.firstUploads));
        ok("لا تتّسع المساحة (٢٨ + ٣): «لا تتّسع مساحتك» ولا رفع", pre.uploads === 1 && pre.toasts.some(t => /لا تتّسع مساحتك/.test(t)), pre.toasts.join(" | "));

        console.log("\n٤) الرفع والفتح");
        const up = pre.calls.find(c => c[0] === "upload:my-files");
        const ins = pre.calls.find(c => c[0] === "insert:my_files");
        ok("المسار داخل مجلد الطالب: <uid>/<رمز>.pdf", up && new RegExp("^" + UID + "/[0-9a-f-]+\\.pdf$").test(up[1].p), up && up[1].p);
        ok("الاسم يُحفظ من اسم الملف بلا امتداد", ins && ins[1].title === "nine", ins && JSON.stringify(ins[1]));
        const open = await page.evaluate(async () => {
            window.__calls = []; window.open = () => ({ close(){}, location:{} });
            openMyFile(0); await new Promise(r => setTimeout(r, 50));
            return window.__calls.find(c => c[0] === "sign:my-files");
        });
        ok("الفتح برابط موقَّع عمره ٦٠ ثانية", open && open[1].s === 60, JSON.stringify(open));

        console.log("\n٥) «ملفات من خُطى» للمالك");
        const own = await page.evaluate(async () => {
            isAdmin = true; confirm = () => true;
            await renderMyFilesTab();
            const form = !!document.getElementById("kf-title");
            window.__calls = [];
            await deleteKhutaFile(0);
            const order = window.__calls.map(c => c[0]).filter(k => /khuta/.test(k));
            isAdmin = false;
            return { form, order };
        });
        ok("المالك يرى نموذج النشر", own.form);
        ok("الحذف: من المخزن أولاً ثم السجلّ", own.order[0] === "remove:khuta-files" && own.order[1] === "delete:khuta_files", own.order.join(" ← "));
        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();

        console.log("\n٦) الجوّال: يُحمَّل عند فتح التبويب فقط");
        const m = await browser.newContext({ ...devices["iPhone 13"] });
        await m.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const mp = await m.newPage();
        const merrs = []; mp.on("pageerror", e => merrs.push(String(e)));
        const seen = []; mp.on("request", r => { const u = new URL(r.url()); if(u.pathname.startsWith("/js/")) seen.push(u.pathname); });
        await mp.goto(base + "/index.html", { waitUntil:"load" });
        await mp.waitForFunction(() => typeof switchTab === "function", { timeout:15000 });
        await mp.waitForTimeout(800);
        const before = seen.includes("/js/39-my-files.js");
        await mp.evaluate(() => switchTab("myfiles"));
        await mp.waitForFunction(() => typeof renderMyFilesTab === "function", { timeout:10000 }).catch(() => {});
        await mp.waitForTimeout(500);
        ok("قبل الفتح: لم يُطلب", !before);
        ok("بعد الفتح: حُمّل ورُسمت الصفحة", seen.includes("/js/39-my-files.js") && (await mp.textContent("#myfiles-body")).trim().length > 0);
        ok("لا خطأ جافاسكربت على الجوّال", merrs.length === 0, merrs.join("\n       "));
        await m.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
