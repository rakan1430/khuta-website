/* ============================================================
   فحص محرّك رسائل البريد (send-email.js + send-campaigns.js + unsubscribe.js)
   ------------------------------------------------------------
   يشغّل الدوالّ نفسها في Node مع fetch مُحاكى يمثّل Supabase وBrevo — بلا
   شبكة ولا مفاتيح حقيقية. ما يُقاس:
     ١) المجدول: توقيع خاطئ يُرفض، والصحيح يرسل ما حان وقته فقط.
     ٢) القفل: نداءان متزامنان لرسالة واحدة ← تُرسَل مرّة واحدة.
     ٣) الحصّة اليومية: رسالة تتجاوزها لا تُرسل ويُفكّ قفلها.
     ٤) رسالة المدرسة: نصّ مُهرَّب (لا HTML)، واسم المدرسة في العنوان،
        ورابط إيقاف «رسائل المدرسة» بتوقيعه الخاص.
     ٥) الصلاحيات: مدير مدرسة أخرى يُرفض؛ رسالة مدرسة مُرسلة لا تُعاد؛
        رسالة خُطى يعيدها المالك.
     ٦) الإرسال بدفعات متوازية، والسجل دفعةً واحدة.
     ٧) إيقاف رسائل المدرسة: رابط خُطى لا يصلح لها، ورابطها يسجّل «self».
   التشغيل:  node tools/فحص-رسائل-البريد.js
   ============================================================ */
const path = require("path");
const crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c){ pass++; console.log("  ✅ " + n); } else { fail++; console.log("  ❌ " + n + (d ? "\n       " + d : "")); } };

process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.BREVO_API_KEY = "test-brevo";
process.env.BREVO_DAILY_CAP = "50";

const SCHOOL_A = "aaaaaaaa-0000-0000-0000-000000000001";
const SCHOOL_B = "bbbbbbbb-0000-0000-0000-000000000002";
function freshDb(){
    return {
        messages: [
            { id: 1, subject: "وينك يا بطل؟", body_html: "<p>تعال</p>", origin: "owner", audience: "all", body_format: "html",
              school_id: null, active: true, send_mode: "broadcast", send_after: null, sent_at: "2026-09-01T00:00:00Z", sending_started_at: null },
            { id: 2, subject: "اختبار الغد", body_html: "راجعوا الفصل <b>الثاني</b>\n<script>alert(1)</script>", origin: "school", audience: "school",
              body_format: "text", school_id: SCHOOL_A, active: true, send_mode: "broadcast",
              send_after: new Date(Date.now() - 60000).toISOString(), sent_at: null, sending_started_at: null },
            { id: 3, subject: "لاحقاً", body_html: "x", origin: "owner", audience: "khuta", body_format: "html", school_id: null, active: true,
              send_mode: "broadcast", send_after: new Date(Date.now() + 86400000).toISOString(), sent_at: null, sending_started_at: null },
        ],
        recipients: {
            1: Array.from({ length: 20 }, (_, i) => ({ uid: `u-${i}`, email: `s${i}@example.com`, name: `طالب ${i}` })),
            2: [{ uid: "stu-1", email: "stu1@example.com", name: "hrb" }],
            3: [],
        },
        members: [{ uid: "admin-a", school_id: SCHOOL_A, role: "admin", active: true }],
        users: { "tok-admin-a": { id: "admin-a", email: "admin.a@example.com" }, "tok-admin-b": { id: "admin-b", email: "admin.b@example.com" },
                 "tok-owner": { id: "owner", email: "owner@example.com" } },
        owners: ["owner"],
        sentToday: 0,
        brevo: [], logs: [], logPosts: 0, optouts: [],
    };
}
let db;

function parseQ(u){ return Object.fromEntries([...new URL(u).searchParams.entries()].map(([k, v]) => [k, v])); }
function resp(status, body, headers){
    return { ok: status >= 200 && status < 300, status, headers: { get: (k) => (headers || {})[k.toLowerCase()] || null },
             json: async () => body, text: async () => typeof body === "string" ? body : JSON.stringify(body) };
}
function matches(row, q){
    for(const [k, v] of Object.entries(q)){
        if(["select", "order", "limit"].includes(k)) continue;
        if(v === "is.null"){ if(row[k] != null) return false; continue; }
        if(v === "not.is.null"){ if(row[k] == null) return false; continue; }
        if(v.startsWith("eq.")){ if(String(row[k]) !== v.slice(3)) return false; continue; }
        if(v.startsWith("lte.")){ if(!(row[k] && row[k] <= v.slice(4))) return false; continue; }
    }
    return true;
}
global.fetch = async (url, opt = {}) => {
    const u = String(url), m = (opt.method || "GET").toUpperCase();
    if(u.startsWith("https://api.brevo.com")){
        await new Promise(r => setTimeout(r, 5));
        const b = JSON.parse(opt.body); db.brevo.push(b); return resp(201, { messageId: "x" });
    }
    if(u.includes("/auth/v1/user")){
        const tok = (opt.headers.Authorization || "").replace("Bearer ", "");
        const user = db.users[tok]; return user ? resp(200, user) : resp(401, {});
    }
    const rest = u.split("/rest/v1/")[1] || "";
    const table = rest.split("?")[0];
    const q = u.includes("?") ? parseQ(u) : {};
    if(table === "marketing_messages"){
        // send_after=not.is.null&send_after=lte.X يتكرّر المفتاح — نقرأ الاثنين
        const raw = new URL(u).searchParams.getAll("send_after");
        const rows = db.messages.filter(r => matches(r, q) && raw.every(v => matches(r, { send_after: v })));
        if(m === "GET") return resp(200, rows);
        if(m === "PATCH"){ const patch = JSON.parse(opt.body); rows.forEach(r => Object.assign(r, patch)); return resp(200, rows.map(r => ({ ...r }))); }
    }
    if(table === "rpc/campaign_recipients"){ const id = JSON.parse(opt.body).p_message; return resp(200, db.recipients[id] || []); }
    if(table === "email_campaign_log"){
        if(m === "HEAD") return resp(206, null, { "content-range": `0-0/${db.sentToday}` });
        if(m === "POST"){ db.logPosts++; const b = JSON.parse(opt.body); db.logs.push(...(Array.isArray(b) ? b : [b])); return resp(201, {}); }
    }
    if(table === "schools") return resp(200, [{ name_ar: "مدارس المتقدمة" }]);
    if(table === "school_members") return resp(200, db.members.filter(r => matches(r, q)));
    if(table === "app_admins") return resp(200, db.owners.includes(q.uid && q.uid.slice(3)) ? [{ uid: q.uid.slice(3) }] : []);
    if(table === "notify_optouts" && m === "POST"){ db.optouts.push(JSON.parse(opt.body)); return resp(201, {}); }
    if(table === "user_data" && m === "PATCH") return resp(204, {});
    return resp(404, { error: "mock: " + m + " " + u });
};

const sendEmail = require(path.join(ROOT, "netlify/functions/send-email.js"));
const call = async (body) => { const r = await sendEmail.handler({ httpMethod: "POST", body: JSON.stringify(body) }); return { status: r.statusCode, body: JSON.parse(r.body) }; };
const sig = (bucket) => crypto.createHmac("sha256", "test-service-key").update(`scheduled-run:${bucket ?? Math.floor(Date.now() / 300000)}`).digest("hex");

(async () => {
    console.log("\n١) المجدول");
    db = freshDb();
    let r = await call({ type: "scheduledRun", sig: "0".repeat(64) });
    ok("توقيع خاطئ يُرفض (403)", r.status === 403, JSON.stringify(r));
    r = await call({ type: "scheduledRun", sig: sig(Math.floor(Date.now() / 300000) - 5) });
    ok("توقيع قديم (٢٥ دقيقة) يُرفض", r.status === 403);
    r = await call({ type: "scheduledRun", sig: sig() });
    ok("الصحيح يرسل ما حان وقته فقط (رسالة المدرسة، لا رسالة الغد)", r.status === 200 && r.body.ran === 1 && r.body.results[0].id === 2, JSON.stringify(r.body));
    const m2 = db.messages.find(x => x.id === 2), m3 = db.messages.find(x => x.id === 3);
    ok("رسالة المدرسة: sent_at مضبوط والقفل باقٍ (لا تُعاد)", !!m2.sent_at && !!m2.sending_started_at && m2.send_result.sent === 1);
    ok("رسالة الغد لم تُلمس", !m3.sent_at && !m3.sending_started_at);
    r = await call({ type: "scheduledRun", sig: sig() });
    ok("تشغيل ثانٍ: لا شيء يُعاد إرساله", r.body.ran === 0, JSON.stringify(r.body));

    console.log("\n٤) شكل رسالة المدرسة");
    const mail = db.brevo[0];
    ok("اسم المدرسة في العنوان", mail.subject === "اختبار الغد — مدارس المتقدمة", mail.subject);
    ok("HTML من المعلّم مُهرَّب لا مُنفَّذ", !mail.htmlContent.includes("<script>") && mail.htmlContent.includes("&lt;script&gt;") && mail.htmlContent.includes("&lt;b&gt;"));
    ok("الأسطر صارت <br>", mail.htmlContent.includes("<br>"));
    const unsub = (mail.headers || {})["List-Unsubscribe"] || "";
    ok("رابط إيقاف «رسائل المدرسة» (scope=school) في الرأس والتذييل", unsub.includes("scope=school") && mail.htmlContent.includes("إيقاف رسائل المدرسة"), unsub);
    const tok = new URL(unsub.slice(1, -1)).searchParams.get("token");
    const expect = crypto.createHmac("sha256", "test-service-key").update("stu-1:school").digest("hex").slice(0, 32);
    ok("توقيعه على «uid:school» لا على uid وحده", tok === expect);

    console.log("\n٢+٦) القفل والدفعات");
    db = freshDb();
    const [a, b] = await Promise.all([
        call({ type: "adminSendCampaign", accessToken: "tok-owner", messageId: 1 }),
        call({ type: "adminSendCampaign", accessToken: "tok-owner", messageId: 1 }),
    ]);
    const wins = [a, b].filter(x => x.status === 200);
    ok("نداءان متزامنان: واحد يرسل والآخر يُرفض", wins.length === 1 && [a, b].some(x => x.body.error === "already_sending_or_sent"), JSON.stringify([a.status, b.status]));
    ok("وصلت ٢٠ رسالة بالضبط (لا تكرار)", db.brevo.length === 20, String(db.brevo.length));
    ok("السجل كُتب دفعةً واحدة (٢٠ صفاً في نداء واحد)", db.logPosts === 1 && db.logs.length === 20, `${db.logPosts} / ${db.logs.length}`);
    ok("رسالة خُطى: فُكّ القفل بعد الإرسال (يعيدها المالك متى شاء)", db.messages[0].sending_started_at === null);
    r = await call({ type: "adminSendCampaign", accessToken: "tok-owner", messageId: 1 });
    ok("المالك يعيد إرسالها", r.status === 200 && db.brevo.length === 40);
    ok("رابط إيقاف رسائل خُطى بلا scope=school", !((db.brevo[0].headers || {})["List-Unsubscribe"] || "").includes("scope=school"));

    console.log("\n٣) الحصّة اليومية");
    db = freshDb(); db.sentToday = 45;   // الحدّ 50 ← بقي 5، والرسالة لعشرين
    r = await call({ type: "adminSendCampaign", accessToken: "tok-owner", messageId: 1 });
    ok("تتجاوز الحصّة ← لا تُرسل، والسبب واضح", r.status === 409 && r.body.error === "over_quota" && r.body.remaining === 5 && db.brevo.length === 0, JSON.stringify(r.body));
    ok("ويُفكّ القفل لتُرسل لاحقاً", db.messages[0].sending_started_at === null);

    console.log("\n٥) صلاحيات إدارة المدرسة");
    db = freshDb(); db.messages[1].send_after = null;
    r = await call({ type: "schoolSendCampaign", accessToken: "tok-admin-b", messageId: 2 });
    ok("مدير مدرسة أخرى يُرفض (403)", r.status === 403 && db.brevo.length === 0, JSON.stringify(r));
    r = await call({ type: "schoolSendCampaign", accessToken: "tok-admin-a", messageId: 1 });
    ok("مدير المدرسة لا يرسل رسالة خُطى (404)", r.status === 404);
    r = await call({ type: "schoolTest", accessToken: "tok-admin-a", messageId: 2 });
    ok("التجربة تصل بريده هو وحده", r.status === 200 && db.brevo.length === 1 && db.brevo[0].to[0].email === "admin.a@example.com" && db.brevo[0].subject.startsWith("[تجريبي]"));
    r = await call({ type: "schoolSendCampaign", accessToken: "tok-admin-a", messageId: 2 });
    ok("مديرها يرسلها لطلابها", r.status === 200 && r.body.sent === 1);
    r = await call({ type: "schoolSendCampaign", accessToken: "tok-admin-a", messageId: 2 });
    ok("ولا تُعاد بعد إرسالها (409)", r.status === 409);
    r = await call({ type: "adminSendCampaign", accessToken: "tok-admin-a", messageId: 1 });
    ok("مدير المدرسة لا يصل مسار المالك (403)", r.status === 403);

    console.log("\n٧) إيقاف رسائل المدرسة");
    const unsubFn = require(path.join(ROOT, "netlify/functions/unsubscribe.js"));
    const khutaTok = crypto.createHmac("sha256", "test-service-key").update("stu-1").digest("hex").slice(0, 32);
    let u = await unsubFn.handler({ httpMethod: "POST", queryStringParameters: { uid: "stu-1", scope: "school", token: khutaTok }, body: "" });
    ok("رابط رسائل خُطى لا يصلح لإيقاف رسائل المدرسة (403)", u.statusCode === 403);
    u = await unsubFn.handler({ httpMethod: "GET", queryStringParameters: { uid: "stu-1", scope: "school", token: expect } });
    ok("GET يعرض صفحة تأكيد فقط", u.statusCode === 200 && u.body.includes("إيقاف رسائل إدارة المدرسة") && db.optouts.length === 0);
    u = await unsubFn.handler({ httpMethod: "POST", queryStringParameters: { uid: "stu-1", scope: "school", token: expect }, body: "List-Unsubscribe=One-Click" });
    ok("POST (زرّ Gmail) يسجّل إيقافاً بقرار الطالب", u.statusCode === 200 && db.optouts[0] && db.optouts[0].scope === "school" && db.optouts[0].source === "self");

    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
