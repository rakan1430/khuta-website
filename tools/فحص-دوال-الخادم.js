/* ============================================================
   فحص دوال Netlify بتشغيلها فعلياً
   ------------------------------------------------------------
   لماذا هذا الملف موجود؟

   كان بريد نتيجة الاختبار يستعمل متغيّراً باسم username لا وجود له في
   الملف. الصياغة سليمة تماماً (node --check يمرّ)، والمراجعة بالعين مرّت
   عليه مرّات، ولم يظهر الخلل إلا عند التشغيل: ReferenceError يبتلعه
   catch فيعود 500 — أي أن الرسالة لم تصل طالباً واحداً منذ كُتبت.

   فالدرس: الدوال الخادمية لا تُفحص بالنظر. هذا الملف يشغّلها فعلاً بطلبات
   واقعية وشبكة مُقلَّدة، ويسقط الاختبار عند أي ReferenceError أو 500.

   التشغيل:  node tools/فحص-دوال-الخادم.js
   ============================================================ */

const path = require("path");
const FN_DIR = path.join(__dirname, "..", "netlify", "functions");

let pass = 0, fail = 0;
const failures = [];

function ok(name){ pass++; console.log("  ✅ " + name); }
function bad(name, detail){ fail++; failures.push(name + " — " + detail); console.log("  ❌ " + name + " — " + detail); }

/** شبكة مُقلَّدة: ترد على كل نقطة نهاية بما يكفي ليمضي المسار للنهاية. */
function makeFetch(routes){
    return async (url, opts = {}) => {
        const u = String(url);
        for(const [pattern, handler] of routes){
            if(u.includes(pattern)){
                const r = await handler(u, opts);
                return {
                    ok: r.status >= 200 && r.status < 300,
                    status: r.status,
                    json: async () => r.body,
                    text: async () => JSON.stringify(r.body),
                };
            }
        }
        // نقطة لم نتوقّعها — نُسقط الاختبار بدل تمريرها بصمت
        throw new Error("طلب شبكة غير متوقَّع: " + u);
    };
}

function loadFresh(file){
    const p = path.join(FN_DIR, file);
    delete require.cache[require.resolve(p)];
    return require(p);
}

async function run(file, event, routes, expect){
    const label = file + " — " + expect.label;
    const realFetch = global.fetch;
    global.fetch = makeFetch(routes);
    try{
        const { handler } = loadFresh(file);
        const res = await handler(event, {});
        const body = JSON.parse(res.body || "{}");

        if(res.statusCode === 500 && !expect.allow500){
            bad(label, `عاد 500 — ${body.error || ""} (هذا هو بالضبط شكل خلل ReferenceError المبتلَع)`);
            return;
        }
        if(expect.status && res.statusCode !== expect.status){
            bad(label, `توقّعنا ${expect.status} فجاء ${res.statusCode}: ${res.body}`);
            return;
        }
        if(expect.check){
            const problem = expect.check(body, res);
            if(problem){ bad(label, problem); return; }
        }
        ok(label);
    }catch(e){
        bad(label, (e && e.name === "ReferenceError" ? "ReferenceError خرج من الدالة: " : "استثناء: ") + (e && e.message));
    }finally{
        global.fetch = realFetch;
    }
}

/* ---------------- التجهيزات المشتركة ---------------- */
const UID = "11111111-1111-1111-1111-111111111111";
const post = (body, headers = {}) => ({
    httpMethod: "POST",
    body: JSON.stringify(body),
    headers: { origin: "https://khutaa.netlify.app", ...headers },
});

const authUser = (email) => [
    "/auth/v1/user",
    async () => ({ status: 200, body: { id: UID, email, is_anonymous: false, user_metadata: {} } }),
];
const userDataRow = (username) => [
    "/rest/v1/user_data?id=eq.",
    async () => ({ status: 200, body: [{ username }] }),
];
const cooldownFree = [
    "/rest/v1/email_send_log",
    async () => ({ status: 200, body: [] }),
];
const brevoAccepts = [
    "api.brevo.com",
    async () => ({ status: 201, body: { messageId: "test" } }),
];

(async () => {
    console.log("\n=== فحص دوال Netlify بالتشغيل الفعلي ===\n");

    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    process.env.BREVO_API_KEY = "test-brevo-key";

    /* ---------- send-email: بريد نتيجة الاختبار ---------- */
    console.log("send-email.js");
    await run("send-email.js",
        post({ type: "examScore", accessToken: "tok", score: 42, total: 65, examTypeLabel: "verbal" }),
        [authUser("rakan@example.com"), userDataRow("راكان"), cooldownFree, brevoAccepts],
        {
            label: "نتيجة اختبار لحساب ببريد حقيقي تُرسَل فعلاً",
            status: 200,
            check: (b) => b.ok ? null : `لم تُرسَل: ${JSON.stringify(b)}`,
        });

    await run("send-email.js",
        post({ type: "examScore", accessToken: "tok", score: 10, total: 20 }),
        [authUser("khuta.rewo@gmail.com")],
        {
            label: "بريد مصطنع لا يُرسَل إليه شيء",
            status: 200,
            check: (b) => b.skipped ? null : "كان يجب تخطّيه (بريد مصطنع لا يملكه صاحب الحساب)",
        });

    await run("send-email.js",
        post({ type: "examScore", accessToken: "tok", score: 10, total: 20 }),
        [["/auth/v1/user", async () => ({ status: 200, body: { id: UID, email: "g@x.com", is_anonymous: true } })]],
        {
            label: "الضيف المجهول مرفوض (لا يستنزف حصة Brevo)",
            status: 401,
        });

    await run("send-email.js",
        post({ type: "adminSendCampaign", accessToken: "tok", subject: "س", bodyHtml: "<p>ن</p>" }),
        [authUser("rakan@example.com"), ["/rest/v1/app_admins", async () => ({ status: 200, body: [] })]],
        {
            label: "غير المشرف لا يرسل حملة",
            status: 403,
        });

    /* ---------- password-reset ---------- */
    console.log("\npassword-reset.js");
    const rlEmpty = ["/rest/v1/password_reset_log", async () => ({ status: 200, body: [] })];

    let recoverCalled = null;
    await run("password-reset.js",
        post({ username: "Rewo" }),
        [
            rlEmpty,
            ["/rest/v1/rpc/resolve_username_email_admin", async () => ({ status: 200, body: [{ email: "real@example.com", user_id: UID }] })],
            ["/auth/v1/recover", async (u, o) => { recoverCalled = { url: u, body: JSON.parse(o.body) }; return { status: 200, body: {} }; }],
        ],
        {
            label: "اسم موجود ببريد حقيقي → تُطلَب رسالة الاسترجاع",
            status: 200,
            check: (b) => {
                if(!recoverCalled) return "لم تُطلَب رسالة الاسترجاع إطلاقاً";
                if(recoverCalled.body.email !== "real@example.com") return "أُرسلت لبريد خاطئ";
                if(JSON.stringify(b).includes("@")) return "🚨 الردّ سرّب بريداً للمتصفح: " + JSON.stringify(b);
                return null;
            },
        });

    let leaked = null;
    await run("password-reset.js",
        post({ username: "لا-يوجد" }),
        [rlEmpty, ["/rest/v1/rpc/resolve_username_email_admin", async () => ({ status: 200, body: [] })]],
        {
            label: "اسم غير موجود → نفس الردّ تماماً بلا إرسال",
            status: 200,
            check: (b) => { leaked = JSON.stringify(b); return leaked === '{"ok":true}' ? null : "الردّ يختلف عن حالة النجاح فيكشف وجود الحساب: " + leaked; },
        });

    await run("password-reset.js",
        post({ username: "Rewo" }),
        [rlEmpty, ["/rest/v1/rpc/resolve_username_email_admin", async () => ({ status: 200, body: [{ email: "khuta.rewo@gmail.com", user_id: UID }] })]],
        {
            label: "حساب ببريد مصطنع → لا تُرسَل رسالة لغريب",
            status: 200,
            check: (b) => JSON.stringify(b) === '{"ok":true}' ? null : "الردّ مختلف: " + JSON.stringify(b),
        });

    await run("password-reset.js",
        post({ username: "Rewo" }),
        [
            ["/rest/v1/password_reset_log", async () => ({ status: 200, body: [{ key: "ip:1.2.3.4", window_start: new Date().toISOString(), request_count: 99 }] })],
        ],
        {
            label: "تجاوز الحدّ يوقف الطلب قبل أي تحويل أو إرسال",
            status: 200,
        });

    // ⚠️ الاختبار الحاسم: عنوان عودة من طرف مهاجم يجب ألا يُقبل إطلاقاً
    let redirectUsed = null;
    await run("password-reset.js",
        { httpMethod: "POST", body: JSON.stringify({ username: "Rewo", redirectTo: "https://evil.example/steal" }), headers: { origin: "https://evil.example" } },
        [
            rlEmpty,
            ["/rest/v1/rpc/resolve_username_email_admin", async () => ({ status: 200, body: [{ email: "real@example.com", user_id: UID }] })],
            ["/auth/v1/recover", async (u) => { redirectUsed = u; return { status: 200, body: {} }; }],
        ],
        {
            label: "عنوان عودة خبيث مرفوض (لا يُسرَق توكن الاسترجاع)",
            status: 200,
            check: () => {
                if(!redirectUsed) return null; // لم تُرسَل أصلاً — مقبول
                if(redirectUsed.includes("evil.example")) return "🚨 قُبل عنوان المهاجم: " + redirectUsed;
                return null;
            },
        });

    /* ---------- school-screen-login ---------- */
    console.log("\nschool-screen-login.js");
    await run("school-screen-login.js",
        post({ secret: "x" }),
        [],
        { label: "سرّ قصير مرفوض", status: 400 });

    await run("school-screen-login.js",
        { httpMethod: "GET", headers: {} },
        [],
        { label: "GET مرفوض", status: 405 });

    console.log(`\n=== النتيجة: ${pass} ناجح، ${fail} فاشل ===`);
    if(fail){
        console.log("\nالإخفاقات:");
        failures.forEach(f => console.log("  • " + f));
        process.exit(1);
    }
})();
