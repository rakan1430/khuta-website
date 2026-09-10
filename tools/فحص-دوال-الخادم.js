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

    /* ---------- school-import: الاستيراد الجماعي ---------- */
    console.log("\nschool-import.js");

    // توكن مزيّف بحمولة amr — الدالة تقرأها من التوكن لا من جسم الطلب
    const tok = (amr) => "x." + Buffer.from(JSON.stringify({ sub: UID, amr })).toString("base64") + ".y";
    const GOOGLE = tok([{ method: "oauth" }]);
    const PASSWORD = tok([{ method: "password" }]);

    const adminRow = ["/rest/v1/school_members?uid=eq.", async () =>
        ({ status: 200, body: [{ id: "MEM1", school_id: "SCH1" }] })];
    const noAdminRow = ["/rest/v1/school_members?uid=eq.", async () => ({ status: 200, body: [] })];

    let sentRows = null;
    const importOk = ["/rest/v1/rpc/import_school_students", async (u, o) => {
        sentRows = JSON.parse(o.body);
        return { status: 200, body: { added: sentRows.p_rows.length, updated: 0, skipped: 0, errors: [] } };
    }];

    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: [
            { name: "طالب", national_id: "1012345678", grade: "1", section: "أ" },
        ]}),
        [authUser("admin@example.com"), adminRow, importOk],
        {
            label: "استيراد سليم — والهوية لا تغادر الخادم أبداً",
            status: 200,
            check: (b) => {
                if(!sentRows) return "لم يُستدعَ الاستيراد";
                const body = JSON.stringify(sentRows);
                if(body.includes("1012345678")) return "🚨 رقم الهوية أُرسل لقاعدة البيانات!";
                const row = sentRows.p_rows[0];
                if(!/^[0-9a-f]{64}$/.test(row.id_hash)) return "البصمة ليست HMAC صالحاً: " + row.id_hash;
                if(row.id_last4 !== "5678") return "آخر أربعة أرقام خاطئة: " + row.id_last4;
                if(JSON.stringify(b).includes("1012345678")) return "🚨 الردّ سرّب رقم الهوية";
                return null;
            },
        });

    // الأرقام العربية يجب أن تعطي البصمة نفسها — وإلا صار للطالب بصمتان
    let arabicHash = null;
    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: [{ name: "طالب", national_id: "١٠١٢٣٤٥٦٧٨" }] }),
        [authUser("admin@example.com"), adminRow,
         ["/rest/v1/rpc/import_school_students", async (u, o) => {
            arabicHash = JSON.parse(o.body).p_rows[0].id_hash;
            return { status: 200, body: { added: 1, updated: 0, skipped: 0, errors: [] } }; }]],
        {
            label: "الأرقام العربية تعطي بصمة الأرقام اللاتينية نفسها",
            status: 200,
            check: () => (arabicHash && sentRows && arabicHash === sentRows.p_rows[0].id_hash)
                ? null : "🚨 بصمتان مختلفتان لنفس الهوية — الغياب لن يتطابق",
        });

    await run("school-import.js",
        post({ accessToken: PASSWORD, rows: [{ name: "طالب", national_id: "1012345678" }] }),
        [authUser("admin@example.com")],
        { label: "جلسة محدودة (بلا Google) مرفوضة", status: 403 });

    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: [{ name: "طالب", national_id: "1012345678" }] }),
        [authUser("t@example.com"), noAdminRow],
        { label: "غير الإداري مرفوض", status: 403 });

    await run("school-import.js",
        { httpMethod: "POST", body: JSON.stringify({ accessToken: GOOGLE, rows: [] }), headers: {} },
        [authUser("admin@example.com"), adminRow],
        { label: "ملف فارغ مرفوض", status: 400 });

    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: Array.from({ length: 2500 }, () => ({ name: "ط", national_id: "1012345678" })) }),
        [authUser("admin@example.com"), adminRow],
        { label: "أكثر من ٢٠٠٠ صف مرفوض", status: 400 });

    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: [
            { name: "بلا هوية", national_id: "" },
            { name: "هوية قصيرة", national_id: "12" },
        ]}),
        [authUser("admin@example.com"), adminRow],
        {
            label: "صفوف بلا هوية صالحة تُرفَض بأسبابها بلا استدعاء الكتابة",
            status: 200,
            check: (b) => (b.skipped === 2 && b.errors.length === 2 && b.errors[0].reason === "BAD_ID")
                ? null : "التقرير غير صحيح: " + JSON.stringify(b),
        });

    await run("school-import.js",
        post({ accessToken: GOOGLE, rows: [{ name: "ط", national_id: "1012345678" }] }),
        [["/auth/v1/user", async () => ({ status: 200, body: { id: UID, is_anonymous: true } })]],
        { label: "الضيف المجهول مرفوض", status: 401 });

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

    /* ---------- moderation-sweep ---------- */
    /* ⚠️ أخطر ما في عملٍ مجدول أن يفشل ناجحاً: يعود 200 كل يوم في سجلّ
       Netlify بينما لا يُحذف شيء، فلا أحد ينظر، ويبقى المخفيّ أشهراً.
       فالفحص هنا على الحالات الفاشلة أكثر منه على الناجحة. */
    console.log("\nmoderation-sweep.js");
    await run("moderation-sweep.js",
        { httpMethod: "POST", headers: {} },
        [["/rest/v1/rpc/sweep_expired_moderation", async () => ({ status: 200, body: 3 })]],
        { label: "يكنس ويُبلّغ بعدد ما حُذف",
          status: 200,
          check: (b) => b.ok === true && b.deleted === 3 ? null : "التقرير غير صحيح: " + JSON.stringify(b) });

    {
        const saved = process.env.SUPABASE_SERVICE_ROLE_KEY;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        await run("moderation-sweep.js",
            { httpMethod: "POST", headers: {} },
            [],   // ⚠️ بلا مسارات: أي نداء شبكة هنا يُسقط الفحص
            { label: "بلا مفتاح الخدمة يفشل صراحةً لا صامتاً",
              status: 500, allow500: true,
              check: (b) => b.error === "SERVICE_KEY_MISSING" ? null : "سببٌ غامض: " + JSON.stringify(b) });
        process.env.SUPABASE_SERVICE_ROLE_KEY = saved;
    }

    await run("moderation-sweep.js",
        { httpMethod: "POST", headers: {} },
        [["/rest/v1/rpc/sweep_expired_moderation", async () => ({ status: 403, body: { message: "denied" } })]],
        { label: "ورفضُ قاعدة البيانات لا يُعَدّ نجاحاً",
          status: 502,
          check: (b) => b.error === "RPC_FAILED" ? null : "سببٌ غامض: " + JSON.stringify(b) });

    /* ---------- notify-owner ---------- */
    /* ⚠️ هذه الدالّة تُرسل بريداً إلى صندوق المالك بلا تسجيل دخول، فكل
       خطأ فيها يعني أن أي أحد يملأ بريده. الفحص هنا على الباب لا على
       الرسالة. */
    console.log("\nnotify-owner.js");
    const SECRET = "s".repeat(32);
    process.env.OWNER_NOTIFY_SECRET = SECRET;
    const notify = (body, headers) => ({
        httpMethod: "POST", body: JSON.stringify(body), headers: headers || {},
    });
    const brevoSeen = [];
    const brevoSpy = ["api.brevo.com", async (u, opts) => {
        brevoSeen.push(JSON.parse(opts.body));
        return { status: 201, body: { messageId: "t" } };
    }];

    await run("notify-owner.js",
        notify({ subject: "انتهيت", body: "تفاصيل الردّ" }, { "x-notify-secret": SECRET }),
        [brevoSpy],
        { label: "بالسرّ الصحيح تُرسَل إلى العنوانين معاً",
          status: 200,
          check: (b) => {
              const sent = brevoSeen[brevoSeen.length - 1];
              if(b.ok !== true) return "لم تُبلّغ بالنجاح: " + JSON.stringify(b);
              if(!sent || sent.to.length !== 2) return "لم تصل العنوانين: " + JSON.stringify(sent);
              if(sent.htmlContent) return "أُرسلت HTML لا نصاً عادياً";
              return sent.subject === "انتهيت" ? null : "العنوان تغيّر: " + sent.subject;
          } });

    /* ⚠️ بلا مسارات شبكة: أي محاولة إرسال في الحالات المرفوضة تُسقط الفحص */
    await run("notify-owner.js",
        notify({ subject: "س", body: "ب" }, { "x-notify-secret": "wrong-but-32-chars-long-aaaaaaaa" }),
        [],
        { label: "وبسرٍّ خاطئ لا تُرسَل شيئاً", status: 401 });

    await run("notify-owner.js",
        notify({ subject: "س", body: "ب" }, {}),
        [],
        { label: "وبلا سرٍّ إطلاقاً مرفوضة", status: 401 });

    await run("notify-owner.js",
        { httpMethod: "GET", headers: { "x-notify-secret": SECRET } },
        [],
        { label: "وGET مرفوض", status: 405 });

    await run("notify-owner.js",
        notify({ subject: "", body: "" }, { "x-notify-secret": SECRET }),
        [],
        { label: "ورسالة فارغة لا تُرسَل", status: 400 });

    {
        process.env.OWNER_NOTIFY_SECRET = "short";
        await run("notify-owner.js",
            notify({ subject: "س", body: "ب" }, { "x-notify-secret": "short" }),
            [],
            { label: "وسرٌّ قصير يعطّل الدالّة بدل أن يفتحها للجميع",
              status: 500, allow500: true,
              check: (b) => b.error === "SECRET_NOT_CONFIGURED" ? null : JSON.stringify(b) });
        process.env.OWNER_NOTIFY_SECRET = SECRET;
    }

    console.log(`\n=== النتيجة: ${pass} ناجح، ${fail} فاشل ===`);
    if(fail){
        console.log("\nالإخفاقات:");
        failures.forEach(f => console.log("  • " + f));
        process.exit(1);
    }
})();
