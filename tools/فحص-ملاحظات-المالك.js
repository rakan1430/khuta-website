/* ============================================================
   فحص ملاحظات المالك (٢٤ سبتمبر) بعد المراحل ٠–٥
   ------------------------------------------------------------
   ١) الجوّال: زرّ «الأقسام» يعرض كل ما يراه المستخدم — للطالب والمدير.
   ٢) الطالب: «منصة المدرسة» وحدها مميَّزة (لا «الاختبارات»).
   ٣) المكتبة للطالب: لا اختيار مرحلة، والمواد ما له كتب في مرحلته.
   ٤) عارض كتاب PDF: الصفحات تُرسم، والرسم فوقها يعمل ولا يُرسل لأي مكان.
   ٥) «ملفاتي» للمالك: إدارة «ملفات من خُطى» وحدها، بلا مساحة شخصية.
   ٦) مساحة القدرات: لا مادة ولا صفّ ولا خلط، و«انشر لكل طلاب المدرسة».
   ٧) الإدارة: البطاقات مطويّة، والمواد مطويّة، والترقية في «إجراءات حساسة».
   التشغيل:  node tools/فحص-ملاحظات-المالك.js   (يحتاج pdfjs-dist@3.11.174 للبند ٤)
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


function samplePdf(){
    const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>"];
    ["A", "B"].forEach((_, i) => objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Contents ${5 + i} 0 R /Resources << /Font << /F1 7 0 R >> >> >>`));
    ["Page One", "Page Two"].forEach(t => { const st = `BT /F1 24 Tf 50 300 Td (${t}) Tj ET`; objs.push(`<< /Length ${st.length} >>\nstream\n${st}\nendstream`); });
    objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    let out = "%PDF-1.4\n"; const offs = [];
    objs.forEach((o, n) => { offs.push(Buffer.byteLength(out)); out += `${n + 1} 0 obj\n${o}\nendobj\n`; });
    const x = Buffer.byteLength(out);
    out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
    out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF\n`;
    return Buffer.from(out);
}

async function main(){
    const srv = await serve();
    const base = `http://127.0.0.1:${srv.address().port}`;
    const exe = fs.existsSync("/opt/pw-browsers") ? fs.readdirSync("/opt/pw-browsers")
        .filter(d => d.startsWith("chromium")).map(d => path.join("/opt/pw-browsers", d, "chrome-linux", "chrome"))
        .find(p => fs.existsSync(p)) : null;
    const browser = await chromium.launch(exe ? { executablePath: exe } : {});
    let pdfDir = null;
    try{ pdfDir = path.dirname(require.resolve("pdfjs-dist/build/pdf.min.js")); }catch(e){}
    try{
        /* ============ ١) الجوّال ============ */
        console.log("\n١) الجوّال: زرّ «الأقسام»");
        const m = await browser.newContext({ ...devices["iPhone 13"] });
        await m.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        const mp = await m.newPage();
        const merrs = []; mp.on("pageerror", e => merrs.push(String(e)));
        await mp.goto(base + "/index.html", { waitUntil:"load" });
        await mp.waitForFunction(() => typeof switchTab === "function" && typeof openNavSheet === "function", { timeout:15000 });
        const phone = await mp.evaluate(async () => {
            isDemoMode = () => true; startDemoMode();
            await new Promise(r => setTimeout(r, 1500));
            const btn = document.getElementById("mobile-nav-sections");
            const out = { btnVisible: !!btn && getComputedStyle(btn).display !== "none" && !btn.classList.contains("mode-hidden") };
            const labels = () => [...document.querySelectorAll(".nav-sheet-item span")].map(s => s.textContent.trim());
            switchDemoRole("student"); await new Promise(r => setTimeout(r, 400));
            openNavSheet(); out.student = labels(); closeNavSheet();
            switchDemoRole("admin"); await new Promise(r => setTimeout(r, 400));
            openNavSheet(); out.admin = labels();
            const lib = [...document.querySelectorAll(".nav-sheet-item")].find(b => /المكتبة/.test(b.textContent));
            if(lib) lib.click();
            await new Promise(r => setTimeout(r, 400));
            out.navigated = document.getElementById("view-schoollib").classList.contains("active");
            out.closed = !document.getElementById("nav-sheet");
            return out;
        });
        ok("زرّ «الأقسام» ظاهر في شريط الجوّال", phone.btnVisible);
        const need = ["الواجبات", "السجلّ", "المكتبة", "مساحة القدرات", "ملفاتي"];
        ok("الطالب يجد الأقسام الجديدة", need.every(n => phone.student.includes(n)), phone.student.join("، "));
        ok("ولا يجد «إدارة المدرسة» ولا «لوحة المرشد»", !phone.student.includes("إدارة المدرسة") && !phone.student.includes("لوحة المرشد"));
        ok("المدير يجد «إدارة المدرسة» و«لوحة المرشد»", phone.admin.includes("إدارة المدرسة") && phone.admin.includes("لوحة المرشد"), phone.admin.join("، "));
        ok("الضغط على قسم يفتحه ويُغلق القائمة", phone.navigated && phone.closed);
        ok("لا خطأ جافاسكربت على الجوّال", merrs.length === 0, merrs.join("\n       "));
        await m.close();

        const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
        await ctx.addInitScript(() => { try{ localStorage.setItem("khuta_intro_seen", "1"); }catch(e){} });
        if(pdfDir){
            await ctx.route("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js", r => r.fulfill({ contentType:"text/javascript", body: fs.readFileSync(path.join(pdfDir, "pdf.min.js")) }));
            await ctx.route("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js", r => r.fulfill({ contentType:"text/javascript", body: fs.readFileSync(path.join(pdfDir, "pdf.worker.min.js")) }));
        }
        const page = await ctx.newPage();
        const errs = []; page.on("pageerror", e => errs.push(String(e)));
        await page.goto(base + "/index.html", { waitUntil:"load" });
        await page.waitForFunction(() => typeof switchTab === "function" && typeof renderLibraryTab === "function", { timeout:15000 });
        await page.evaluate(() => { isDemoMode = () => true; startDemoMode(); });
        await page.waitForTimeout(800);

        /* ============ ٢) التمييز ============ */
        console.log("\n٢) تمييز الطالب");
        const hl = await page.evaluate(async () => {
            switchDemoRole("student"); await new Promise(r => setTimeout(r, 300));
            document.body.classList.add("is-school-student");
            const bw = el => getComputedStyle(el).borderTopWidth;
            return { work: bw(document.querySelector('.sidebar .nav-item[data-tab="schoolwork"]')),
                     exams: bw(document.querySelector('.sidebar .nav-item[data-tab="schoolexams"]')) };
        });
        ok("«منصة المدرسة» مميَّزة بإطار", parseFloat(hl.work) > 0, hl.work);
        ok("و«الاختبارات» بلا إطار", parseFloat(hl.exams) === 0, hl.exams);

        /* ============ ٣) المكتبة للطالب ============ */
        console.log("\n٣) المكتبة للطالب");
        const lib = await page.evaluate(async () => {
            await sb.from("school_books").insert({ id:"B2", subject_id:"S-PHYS", grade:"1", term:"all", title:"الفيزياء ١", ein_url:null, sort_order:1 });
            await sb.from("school_books").insert({ id:"B3", subject_id:"S-PHYS", grade:"3", term:"all", title:"فيزياء ثالث", ein_url:null, sort_order:2 });
            switchTab("schoollib"); await new Promise(r => setTimeout(r, 500));
            const g = document.getElementById("lib-grade");
            const subj = document.getElementById("lib-subject");
            return { gradeIsSelect: g && g.tagName === "SELECT", gradeVal: g && g.value,
                     subjects: subj ? [...subj.options].map(o => o.textContent) : [],
                     list: document.getElementById("lib-list").textContent };
        });
        ok("لا قائمة لاختيار المرحلة للطالب", !lib.gradeIsSelect);
        ok("ويرى كتب مرحلته وحدها", /الرياضيات ١/.test(lib.list) && /الفيزياء ١/.test(lib.list) && !/فيزياء ثالث/.test(lib.list), lib.list.slice(0, 200));
        ok("وقائمة المواد فيها مواد مرحلته (الرياضيات والفيزياء)", lib.subjects.includes("الرياضيات") && lib.subjects.includes("الفيزياء"), lib.subjects.join("، "));

        /* ============ ٤) عارض PDF ============ */
        console.log("\n٤) عارض كتاب PDF");
        if(!pdfDir){ console.log("  ⚠️ تخطّي: npm install pdfjs-dist@3.11.174 --no-save"); }
        else{
            const pdfB64 = samplePdf().toString("base64");
            const v = await page.evaluate(async (b64) => {
                const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
                await sb.from("school_books").insert({ id:"BP", subject_id:"S-MATH", grade:"1", term:"all", title:"ملزمتي", pdf_path:"DEMO-SCHOOL/M1/x.pdf", sort_order:3 });
                const realStorage = sb.storage;
                const sent = [];
                const realFetch = window.fetch;
                window.fetch = (u, o) => { sent.push(String(u)); return realFetch(u, o); };
                sb.storage = { from: () => ({ download: async () => ({ data: new Blob([bytes], { type:"application/pdf" }), error:null }) }) };
                await renderLibraryTab();
                const btn = [...document.querySelectorAll("#lib-list [onclick^='openLibraryPdf']")];
                await openLibraryPdf("BP");
                const wait = ms => new Promise(r => setTimeout(r, ms));
                for(let i = 0; i < 40 && document.querySelectorAll("#lib-pdf-viewer canvas.lib-pdf").length < 2; i++) await wait(150);
                const pages = document.querySelectorAll("#lib-pdf-viewer .lib-page").length;
                const drawn = document.querySelectorAll("#lib-pdf-viewer canvas.lib-pdf").length;
                // هل رُسمت الصفحة فعلاً (بكسلات غير بيضاء)؟
                const c = document.querySelector("#lib-pdf-viewer canvas.lib-pdf");
                const px = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
                let dark = 0; for(let i = 0; i < px.length; i += 4) if(px[i] < 100 && px[i + 3] > 0) dark++;
                // الرسم: قلم ثم سحب
                document.querySelector('#lib-pdf-viewer [data-tool="pen"]').click();
                const ink = document.querySelector("#lib-pdf-viewer canvas.lib-ink");
                const r = ink.getBoundingClientRect();
                const ev = (t, x, y) => ink.dispatchEvent(new PointerEvent(t, { clientX: r.left + x, clientY: r.top + y, pointerId: 1, bubbles: true }));
                ev("pointerdown", 20, 20); ev("pointermove", 80, 80); ev("pointermove", 120, 60); ev("pointerup", 120, 60);
                const ipx = ink.getContext("2d").getImageData(0, 0, ink.width, ink.height).data;
                let inked = 0; for(let i = 3; i < ipx.length; i += 4) if(ipx[i] > 0) inked++;
                const noDownload = !document.querySelector("#lib-pdf-viewer a[download], #lib-pdf-viewer [data-action='download']");
                closeLibraryPdf();
                window.fetch = realFetch; sb.storage = realStorage;
                return { btn: btn.length, pages, drawn, dark, inked, noDownload, closed: !document.getElementById("lib-pdf-viewer"),
                         sent: sent.filter(u => !/cdnjs/.test(u)) };
            }, pdfB64);
            ok("زرّ «افتح الكتاب» للكتاب المرفوع", v.btn >= 1);
            ok("صفحتا الكتاب تُعرضان (pdf.js)", v.pages === 2 && v.drawn === 2, `${v.pages}/${v.drawn}`);
            ok("والصفحة مرسومة فعلاً (نصّ ظاهر)", v.dark > 50, String(v.dark));
            ok("والرسم بالقلم فوقها يعمل", v.inked > 50, String(v.inked));
            ok("ولا يُرسل الرسم لأي مكان", v.sent.length === 0, v.sent.join(" "));
            ok("ولا زرّ تنزيل، والإغلاق يزيل كل شيء", v.noDownload && v.closed);
        }

        /* ============ ٥) ملفاتي للمالك ============ */
        console.log("\n٥) «ملفاتي» للمالك");
        const own = await page.evaluate(async () => {
            const realSb = sb;
            sb = { auth: { getSession: async () => ({ data:{ session:{ user:{ id:"OWNER" } } } }) },
                   rpc: async fn => fn === "my_files_status" ? { data:{ google:true, used:0, limit:31457280 }, error:null } : { data:[], error:null },
                   from: () => { const q = { select(){ return q; }, order(){ return q; }, limit: async () => ({ data:[], error:null }) }; return q; } };
            isAdmin = true;
            await renderMyFilesTab();
            const body = document.getElementById("myfiles-body");
            const r = { khutaForm: !!document.getElementById("kf-title"), personal: !!document.getElementById("myf-file") || /استعملت/.test(body.textContent) };
            isAdmin = false;
            await renderMyFilesTab();
            r.studentPersonal = !!document.getElementById("myf-file"); r.studentKhutaForm = !!document.getElementById("kf-title");
            sb = realSb;
            return r;
        });
        ok("المالك: نموذج «ملفات من خُطى» ظاهر", own.khutaForm);
        ok("المالك: بلا مساحة شخصية ولا رفع لنفسه", !own.personal);
        ok("الطالب: مساحته الشخصية، بلا نموذج النشر", own.studentPersonal && !own.studentKhutaForm);

        /* ============ ٦) مساحة القدرات ============ */
        console.log("\n٦) مساحة القدرات");
        const gat = await page.evaluate(async () => {
            switchDemoRole("teacher");
            await sb.from("teacher_exams").insert({ id:"P9", title:"تدريب", kind:"practice", published:false, owner_id:"M1", question_count:3, created_at:new Date().toISOString() });
            switchTab("schoolgat"); await new Promise(r => setTimeout(r, 400));
            const hidden = id => { const el = document.getElementById(id); const g = el && (el.closest(".form-group") || el.closest("label")); return !g || getComputedStyle(g).display === "none"; };
            const r = { subject: hidden("exam-subject"), grade: hidden("exam-grade"), shuffle: hidden("exam-shuffle"),
                        publishBtn: !!document.querySelector("#sgat-tests [onclick^='publishPractice']"),
                        sendBtn: !!document.querySelector("#sgat-tests [onclick^='openExamSend']") };
            confirm = () => true;
            await publishPractice("P9", true);
            await new Promise(r => setTimeout(r, 300));
            r.published = (await sb.from("teacher_exams").select().eq("id", "P9").limit(1)).data[0].published;
            switchTab("schoolexams"); await new Promise(r => setTimeout(r, 300));
            r.examSubjectBack = !hidden("exam-subject");
            return r;
        });
        ok("لا خانة مادة ولا صفّ ولا خلط لاختبار التدريب", gat.subject && gat.grade && gat.shuffle, JSON.stringify(gat));
        ok("زرّ «انشر لكل طلاب المدرسة» بدل الإرسال لفصول", gat.publishBtn && !gat.sendBtn);
        ok("النشر يعمل", gat.published === true);
        ok("وتعود خانة المادة في الاختبارات العادية", gat.examSubjectBack);

        /* ============ ٧) الإدارة ============ */
        console.log("\n٧) الإدارة: الطيّ والإجراءات الحساسة");
        const adm = await page.evaluate(async () => {
            // سياق متصفّح جديد: لا تفضيلات محفوظة — الحالة الافتراضية كما يراها مدير لأول مرة
            switchDemoRole("admin"); await new Promise(r => setTimeout(r, 300));
            switchTab("schooladmin"); await new Promise(r => setTimeout(r, 500));
            const col = id => document.getElementById(id).classList.contains("is-collapsed");
            const r = { setup: col("card-setup"), classes: col("card-classes"), official: col("card-official"),
                        members: col("card-members"), year: col("year-card") };
            const cards = [...document.querySelectorAll("#view-schooladmin > .card")];
            r.yearLast = cards[cards.length - 1].id === "year-card";
            document.querySelector("#card-setup > h3").click();
            r.setupOpened = !col("card-setup");
            await renderSchoolSettingsAdmin();
            const subj = document.querySelector('details.ss-sec[data-sec="subjects"]');
            r.subjectsCollapsed = subj && !subj.open;
            subj.open = true;
            await renderSchoolSettingsAdmin();
            r.subjectsStayOpen = document.querySelector('details.ss-sec[data-sec="subjects"]').open;
            const btn = document.querySelector("#year-card [onclick^='openYearPromotion']");
            r.yearBtnText = btn ? btn.textContent.trim() : "";
            return r;
        });
        ok("بطاقات الإعداد والفصول ودرجات نور مطويّة افتراضياً", adm.setup && adm.classes && adm.official, JSON.stringify(adm));
        ok("وقائمة الأعضاء مفتوحة", !adm.members);
        ok("والعنوان يفتح البطاقة", adm.setupOpened);
        ok("المواد مطويّة داخل الإعداد، وتبقى مفتوحة بعد التعديل", adm.subjectsCollapsed && adm.subjectsStayOpen);
        ok("الترقية في «إجراءات حساسة» مطويّة آخر الصفحة", adm.year && adm.yearLast);
        ok("وزرّها يذكر رمز التحقق", /رمز تحقق/.test(adm.yearBtnText), adm.yearBtnText);

        ok("لا خطأ جافاسكربت", errs.length === 0, errs.join("\n       "));
        await ctx.close();
    }finally{ await browser.close(); srv.close(); }
    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
