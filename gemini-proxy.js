/* ============================================================
   خُطى — دالة وسيطة (Serverless) لحماية مفتاح Gemini API
   ------------------------------------------------------------
   الفكرة: بدل أن يتصل متصفح الطالب بـGemini مباشرة (وهذا يعني أن أي شخص
   يفتح "عرض مصدر الصفحة" يرى مفتاحك كاملاً)، يتصل الآن بهذه الدالة التي
   تعمل على خوادم Netlify، وهي وحدها من يحمل المفتاح الحقيقي (كمتغيّر بيئة
   سري، وليس مكتوباً في أي ملف). المتصفح لا يرى المفتاح أبداً بعد الآن.

   ⚠️ لا تكتب المفتاح هنا في هذا الملف — يُضبط فقط من:
   Netlify Dashboard → Site configuration → Environment variables →
   أضف متغيّراً باسم GEMINI_API_KEY وقيمته مفتاحك من aistudio.google.com/apikey
   ============================================================ */

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "GEMINI_API_KEY غير مضبوط على الخادم — أضفه من Netlify Environment variables" }),
        };
    }

    let payload;
    try {
        payload = JSON.parse(event.body || "{}");
    } catch (e) {
        return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
    }

    if (!payload.contents) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing 'contents' field" }) };
    }

    // نحصر النموذج المسموح به لمنع أي استغلال للدالة للوصول لنماذج أخرى غير مقصودة
    const allowedModels = ["gemini-flash-latest", "gemini-pro-latest"];
    const model = allowedModels.includes(payload.model) ? payload.model : "gemini-flash-latest";

    try {
        const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-goog-api-key": apiKey,
                },
                body: JSON.stringify({
                    system_instruction: payload.system_instruction,
                    contents: payload.contents,
                }),
            }
        );

        const text = await upstream.text();
        return {
            statusCode: upstream.status,
            headers: { "Content-Type": "application/json" },
            body: text,
        };
    } catch (err) {
        return {
            statusCode: 502,
            body: JSON.stringify({ error: "تعذّر الوصول لخدمة Gemini", details: String(err) }),
        };
    }
};
