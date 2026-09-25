/* ============================================================
   فحص التذكير اليومي على الجوال (netlify/functions/send-reminders.js)
   ------------------------------------------------------------
   لم يعمل قبل ٢٥ سبتمبر ولا مرة: مكتبتاه (web-push وsupabase-js) لم تُثبَّتا
   على Netlify فكانت الدالّة تسقط عند تحميلها. أُعيدت بلا مكتبات. هنا:
     ١) لا require إلا crypto — وإلا عاد العطل نفسه بصمت.
     ٢) توقيع VAPID (ES256) صحيح رياضياً: يُتحقَّق منه بالمفتاح العام نفسه،
        وaud = أصل خادم الإشعارات، وexp بعد ١٢ ساعة، وsub بريد.
     ٣) تشغيل كامل مع خادم مُحاكى: الإشعار بلا محتوى (Content-Length 0)،
        اشتراك منتهٍ (410) يُحذف، والحارس يرفض تشغيلاً ثانياً خلال ٢٠ ساعة.
     ٤) عامل الخدمة يعرض نصّ التذكير حين يصل الإشعار بلا محتوى.
   التشغيل:  node tools/فحص-إشعارات-الجوال.js
   ============================================================ */
const path = require("path"), fs = require("fs"), crypto = require("crypto");
const ROOT = path.resolve(__dirname, "..");
let pass = 0, fail = 0;
const ok = (n, c, d) => { if(c){ pass++; console.log("  ✅ " + n); } else { fail++; console.log("  ❌ " + n + (d ? "\n       " + d : "")); } };
const b64u = b => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

(async () => {
    const file = path.join(ROOT, "netlify/functions/send-reminders.js");
    const src = fs.readFileSync(file, "utf8");
    console.log("\n١) بلا مكتبات خارجية");
    const reqs = [...src.matchAll(/require\(["']([^"']+)["']\)/g)].map(m => m[1]);
    ok("require الوحيد هو crypto", reqs.length === 1 && reqs[0] === "crypto", reqs.join(", "));

    const fn = require(file);
    const { vapidSigningKey, vapidAuthHeader } = fn._test;

    console.log("\n٢) توقيع VAPID");
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = privateKey.export({ format: "jwk" });
    const pubRaw = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]);
    const key = vapidSigningKey(jwk.d, b64u(pubRaw));
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc123";
    const hdr = vapidAuthHeader(endpoint, key, b64u(pubRaw));
    const m = hdr.match(/^vapid t=([^,]+), k=(.+)$/);
    ok("شكل الرأس vapid t=…, k=…", !!m, hdr.slice(0, 40));
    const [h, c, s] = m[1].split(".");
    const verified = crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"));
    ok("التوقيع يُتحقَّق منه بالمفتاح العام (ES256، 64 بايت)", verified && Buffer.from(s, "base64url").length === 64);
    const claims = JSON.parse(Buffer.from(c, "base64url"));
    ok("aud = أصل خادم الإشعارات", claims.aud === "https://fcm.googleapis.com", claims.aud);
    const left = claims.exp - Math.floor(Date.now() / 1000);
    ok("exp بعد ١٢ ساعة (أقل من ٢٤ كما يشترط المعيار)", left > 11 * 3600 && left <= 12 * 3600, String(left));
    ok("sub بريد mailto", /^mailto:.+@.+/.test(claims.sub));
    ok("k = المفتاح العام نفسه", m[2] === b64u(pubRaw));
    ok("المفتاح العام في الدالّة مطابق لما يشترك به المتصفّح (js/09-features.js)",
        (src.match(/VAPID_PUBLIC_KEY_OVERRIDE \|\|\s*"([^"]+)"/) || [])[1] === (fs.readFileSync(path.join(ROOT, "js/09-features.js"), "utf8").match(/VAPID_PUBLIC_KEY = "([^"]+)"/) || [])[1]);

    console.log("\n٣) تشغيل كامل مع خادم مُحاكى");
    process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
    // مفتاح خاص حقيقي يطابق المفتاح العام المثبّت؟ لا نملكه هنا — فنمرّر الذي ولّدناه:
    // الدالّة تبني المفتاح من d + النقطة العامة المثبّتة؛ الفحص هنا لمسار الإرسال لا للمطابقة.
    process.env.VAPID_PRIVATE_KEY = jwk.d;
    // مفتاح لا يطابق المفتاح العام المثبّت ← يُرفض برسالة صريحة قبل أي إرسال
    let mis = await fn.handler();
    ok("مفتاح خاص لا يطابق العام ← يتوقف برسالة صريحة", mis.statusCode === 500 && mis.body === "VAPID key pair mismatch", JSON.stringify(mis));
    // ثم زوج متطابق (الذي ولّدناه) لفحص مسار الإرسال كاملاً — الدالّة تُحمَّل من جديد
    process.env.VAPID_PUBLIC_KEY_OVERRIDE = b64u(pubRaw);
    delete require.cache[require.resolve(file)];
    const fn2 = require(file);
    let lastRun = null; const pushes = [], deletes = [];
    global.fetch = async (url, opt = {}) => {
        const u = String(url), meth = (opt.method || "GET").toUpperCase();
        const r = (status, body) => ({ ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) });
        if(u.includes("/rest/v1/job_runs")){
            if(meth === "GET") return r(200, lastRun ? [{ last_run_at: lastRun }] : []);
            lastRun = JSON.parse(opt.body).last_run_at; return r(201, {});
        }
        if(u.includes("/rest/v1/push_subscriptions")){
            if(meth === "DELETE"){ deletes.push(u); return r(204, {}); }
            return r(200, [
                { id: 1, endpoint: "https://fcm.googleapis.com/fcm/send/live", subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/live" } },
                { id: 2, endpoint: "https://updates.push.services.mozilla.com/wpush/v2/gone", subscription: { endpoint: "https://updates.push.services.mozilla.com/wpush/v2/gone" } },
            ]);
        }
        pushes.push({ u, opt });
        return u.includes("/gone") ? r(410, {}) : r(201, {});
    };
    let res;
    try{ res = await fn2.handler(); }catch(e){ res = { statusCode: "THREW", body: e.message }; }
    const out = res.statusCode === 200 ? JSON.parse(res.body) : {};
    ok("الدالّة تعمل حتى النهاية", res.statusCode === 200, JSON.stringify(res));
    ok("أُرسل إشعار واحد ونُظّف المنتهي", out.sent === 1 && out.cleaned === 1 && deletes.length === 1 && deletes[0].includes("id=eq.2"), JSON.stringify(out));
    const p0 = pushes[0] || { opt: { headers: {} } };
    ok("الإشعار بلا محتوى (Content-Length 0، بلا body)", p0.opt.headers["Content-Length"] === "0" && !p0.opt.body);
    ok("TTL يوم كامل (يصل إن فتح الجوال لاحقاً)", p0.opt.headers.TTL === "86400");
    ok("كل خادم إشعارات بـaud أصله هو", pushes.every(p => {
        const t = p.opt.headers.Authorization.match(/t=([^,]+)/)[1].split(".")[1];
        return JSON.parse(Buffer.from(t, "base64url")).aud === new URL(p.u).origin;
    }));
    ok("سُجّل التشغيل في job_runs", !!lastRun);
    const again = await fn2.handler();
    ok("تشغيل ثانٍ خلال ٢٠ ساعة يُرفض (429)", again.statusCode === 429);

    console.log("\n٤) عامل الخدمة");
    const sw = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
    const push = sw.slice(sw.indexOf('addEventListener("push"'), sw.indexOf('addEventListener("notificationclick"'));
    ok("بلا محتوى ← يعرض «لا تنسَ جلستك اليوم»", /let payload = \{ title: "خُطى[^"]*", body: "لا تنسَ جلستك اليوم[^"]*" \}/.test(push) && /if \(event\.data\)/.test(push));

    console.log(`\n${pass} نجح · ${fail} فشل`);
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
