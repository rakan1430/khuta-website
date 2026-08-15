/* ============================================================
   21) مساعد الأسئلة الشائعة — مطابقة كلمات مفتاحية بسيطة، وليس ذكاءً اصطناعياً
   ============================================================ */
const FAQ_BOT = [
    { kw:["ايهاب","إيهاب","لفظي"], ar:"دورة إيهاب هي مسارك الوحيد المعتمد للفظي في التطبيق — 215 قسم، كل قسم فيه 13-14 سؤال تقريباً.", en:"Ehab's course is your only Verbal track — 215 sections, ~13-14 questions each." },
    { kw:["تأسيس","معاصر"], ar:"كتاب المعاصر 10 للتأسيس الكمي: تحدي 30 يوماً بمعدل 8 صفحات يومياً تقريباً قبل الانتقال للتدريب.", en:"Al-Moaasir Book 10 for Quant foundation: a 30-day challenge, ~8 pages/day, before moving to training." },
    { kw:["منصف"], ar:"المنصف بنك تدريبي كمي: 120 بنكاً، كل بنك فيه 48-50 سؤالاً تقريباً، ويحتاج نحو 50 دقيقة لإنهائه.", en:"Al-Monsif is a Quant training bank: 120 banks, ~48-50 questions each, roughly 50 minutes to finish." },
    { kw:["مفكر"], ar:"المفكر: 90 قسماً (11 سؤال لكل قسم، نحو 30 دقيقة للقسم)، بالإضافة لقائمة الأكثر تكراراً (814 سؤالاً) لمن يريد الاختصار.", en:"Al-Mufakkir: 90 sections (11 questions each, ~30 min/section), plus a 'most repeated' list of 814 questions for a faster track." },
    { kw:["اينشتاين","أينشتاين","einstein"], ar:"أينشتاين مصدر كمي للتأسيس: 57 مقطع فيديو (ساعة تقريباً لكل مقطع)، وفيه أيضاً 9 مقاطع مراجعة سريعة فقط. ملاحظة: هذه الدورة قديمة نسبياً وسيصدر إصدار جديد قريباً، فلا نرشحها حالياً كخيار أول.", en:"Einstein is a Quant foundation source: 57 video lectures (~1 hour each), plus a 9-video quick-review-only subset. Note: this course is somewhat dated and a refreshed version is coming soon, so it's not currently our top recommendation." },
    { kw:["ستيب","step"], ar:"STEP اختبار كفاءة اللغة الإنجليزية من قياس. بعض الجامعات تشترطه إجبارياً لكل البرامج (كفهد وخالد وعبدالعزيز)، وبعضها لبرامج معينة فقط. راجع حاسبة الموزونة لمعرفة حالة جامعتك بالتحديد — التطبيق يفعّله تلقائياً ويمنعك من إلغائه إن كان إجبارياً لجامعتك.", en:"STEP is Qiyas's English proficiency test. Some universities require it for all programs (e.g. KFUPM, KKU, KAU), others only for specific programs. Check the Weighted Score calculator — the app auto-locks it on when it's mandatory for your university." },
    { kw:["موزونة","نسبة الموزونة"], ar:"استخدم قسم 'حساب الموزونة' من القائمة الجانبية — اختر جامعتك وستُعبّأ الأوزان تلقائياً، ثم أدخل درجاتك. الأوزان قابلة للتعديل اليدوي أيضاً.", en:"Use the 'Weighted Score' section from the sidebar — pick your university and the weights auto-fill, then enter your scores. Weights are also manually editable." },
    { kw:["جامعة","جامعات","اي جامعة","افضل جامعة"], ar:"يحتوي التطبيق على أكثر من 30 جامعة سعودية (حكومية وخاصة) مع أوزانها ومتطلبات STEP. اختر جامعتك من قائمة 'حساب الموزونة'، واضغط زر 'عرض التخصصات التي تتطلب STEP' لمزيد من التفاصيل.", en:"The app includes 30+ Saudi universities (public and private) with their weights and STEP requirements. Pick yours from the 'Weighted Score' list, and tap 'Show majors that require STEP' for more detail." },
    { kw:["تخصص","تخصصات","دليل التخصصات"], ar:"افتح 'دليل التخصصات' من القائمة الجانبية — اضغط على أي تخصص لرؤية تفرّعاته، مساره الوظيفي، والجامعات التي توفره.", en:"Open 'Specialty Guide' from the sidebar — tap any major to see its branches, career path, and which universities offer it." },
    { kw:["معدل","gpa","نسبة الثانوية","نسبة ثانوي"], ar:"حاسبة المعدل التراكمي والنسبة الثانوية موجودة داخل قسم 'حساب الموزونة' (زر 'حاسبة المعدل التراكمي' أعلى الصفحة). المعدل النهائي = (معدل أول ثانوي × 20%) + (معدل ثاني ثانوي × 40%) + (معدل ثالث ثانوي × 40%).", en:"The GPA/high-school-percentage calculator is inside 'Weighted Score' (the 'GPA Calculator' button at the top). Final GPA = (Year 1 avg × 20%) + (Year 2 avg × 40%) + (Year 3 avg × 40%)." },
    { kw:["وقت","مذاكرة","جدول","كم ساعة"], ar:"لا يوجد عدد ساعات 'صحيح' واحد — حدّد وقتك اليومي في شاشة تخصيص الخطة وسيوزّع التطبيق المنهج تلقائياً حسب مدة خطتك.", en:"There's no single 'correct' number of hours — set your daily time in the plan setup and the app distributes the material over your plan length automatically." },
    { kw:["استراحة","استراحه","راحة"], ar:"عند تفعيل جلسة تزيد عن ساعة، يبدأ التطبيق استراحات تلقائية بالمدة التي تحددها (1-25 دقيقة). ولديك أيضاً استراحات 5 دقائق قصيرة بعدد محدود تختاره أنت لكل جلسة.", en:"For sessions longer than an hour, the app triggers automatic breaks at the duration you set (1-25 min). You also get short 5-minute breaks, limited to a count you choose per session." },
    { kw:["ايقاف مؤقت","توقف","بوز","pause"], ar:"زر الإيقاف المؤقت للظروف الطارئة فقط. إن تجاوزت 5 دقائق يحذّرك التطبيق، وإن وصلت 10 دقائق يُعتبر يومك غير مكتمل وتنكسر سلسلة مذاكرتك (Streak) — التزم بجلساتك قدر الإمكان.", en:"The pause button is for real emergencies only. Past 5 minutes you'll get a warning; at 10 minutes the day counts as incomplete and your streak breaks — stick to your sessions as much as possible." },
    { kw:["حساب","تسجيل الدخول","مزامنة","دخول"], ar:"يمكنك استخدام التطبيق كضيف بدون حساب إطلاقاً. لحفظ تقدمك ونقله لجهاز آخر، أنشئ حساباً باسم مستخدم وكلمة مرور فقط (أو Google) من الملف الشخصي.", en:"You can use the app fully as a guest, no account needed. To save and carry your progress to another device, create an account with just a username and password (or Google) from Profile." },
    { kw:["مجتمع","صدارة","غرفة مذاكرة","حائط"], ar:"قسم 'المجتمع' فيه لوحة صدارة أسبوعية اختيارية، غرفة مذاكرة تعرض عدد الطلاب المذاكرين معك الآن، وحائط أسئلة سريع.", en:"The 'Community' section has an optional weekly leaderboard, a study room showing how many students are studying with you right now, and a quick questions wall." },
    { kw:["قلق","توتر","خايف","خوف"], ar:"طبيعي جداً أن تشعر بالقلق قبل اختبار مهم. جرّب تقسيم مذاكرتك لجلسات قصيرة مع فواصل راحة (استخدم مؤقّت التركيز في الصفحة الرئيسية)، وتذكّر أن التحضير المتدرج أهم من الكمال.", en:"It's completely normal to feel anxious before an important test. Try short focused sessions with breaks (use the focus timer on the dashboard), and remember steady preparation matters more than perfection." },
    { kw:["xp","نقاط","مستوى","مستويات"], ar:"نقاط الخبرة (XP) تحفيزية فقط ومنفصلة عن نسبة تقدمك الفعلية — تحصل عليها عند إنهاء المهام، وترتفع مستوياتك من 'مستكشف' حتى 'خبير قدرات 🏆'.", en:"XP is purely motivational and separate from your actual progress percentage — you earn it by finishing tasks, leveling up from 'Explorer' to 'Qudrat Expert 🏆'." },
    { kw:["درع","حماية السلسلة","shield"], ar:"يمكنك شراء 'درع' بـ100 نقطة خبرة من صفحة الملف الشخصي — يحمي سلسلة مذاكرتك تلقائياً أول يوم تفوّته دون قصد.", en:"You can buy a 'shield' with 100 XP from your Profile page — it auto-protects your streak the first day you accidentally miss." },
    { kw:["كمي اولا","لفظي اولا","ترتيب الجلسة","تبديل"], ar:"تختار في شاشة تخصيص الخطة أي قسم تبدأ به دائماً (كمي أو لفظي)، وعند تشغيل المؤقت ينتقل تلقائياً للقسم الآخر عند انتهاء وقت الأول مع تنبيه بسيط.", en:"In plan setup you choose which section you always start with (Quant or Verbal) — the timer automatically switches to the other one when the first finishes, with a simple notification." },
    { kw:["يتعلم","ذكاء الجدول","تعديل تلقائي"], ar:"بعد كل جلسة، قد يسألك التطبيق أحياناً هل كان وقت القسم مناسباً — وبعد 3 إجابات متكررة بنفس الاتجاه، يعيد توزيع وقتك تلقائياً بين الكمي واللفظي ليناسب سرعتك الحقيقية.", en:"After some sessions, the app may ask if the section's time felt right — after 3 consistent answers in the same direction, it auto-rebalances your Quant/Verbal time split to match your real pace." },
    { kw:["قالب","قوالب","خطة طالب اخر"], ar:"في قسم 'المجتمع' يمكنك نشر خطتك الحالية كقالب ليستفيد منه غيرك، أو تصفح قوالب طلاب آخرين واستخدامها مباشرة، مع إمكانية تقييمها 👍👎.", en:"In the 'Community' section you can publish your current plan as a template for others, or browse and use other students' templates, with 👍👎 ratings." },
];

function toggleChatbot(){
    const panel = document.getElementById("chatbot-panel");
    const opening = panel.style.display === "none" || panel.classList.contains("panel-closing");
    clearTimeout(panel.__closeT);
    if(opening){
        panel.classList.remove("panel-closing");
        panel.style.display = "flex";
    } else {
        // إغلاق متدرّج بأنيميشن بدل الاختفاء اللحظي
        panel.classList.add("panel-closing");
        panel.__closeT = setTimeout(() => { panel.style.display = "none"; panel.classList.remove("panel-closing"); }, 260);
    }
    if(opening && !panel.dataset.inited){
        panel.dataset.inited = "1";
        addChatbotMessage(currentLang==='ar' ? "أهلاً يا بطل! 👋 أقدر أحل وأشرح لك أي سؤال كمي أو لفظي، أو أدلّك على أي شي في خُطى — بس قلّي وش تبي." : "Hey champ! 👋 I can solve and explain any Quant or Verbal question, or guide you to anything in Khuta — just tell me what you need.", "bot");
        renderChatbotSuggestions();
    }
}

function renderChatbotSuggestions(){
    const box = document.getElementById("chatbot-suggestions");
    const picks = currentLang === "ar" ? ["كم قسم في إيهاب؟","ما هو STEP؟","كيف أحسب موزونتي؟"] : ["How many Ehab sections?","What is STEP?","How do I calculate my score?"];
    box.innerHTML = picks.map(p => `<button type="button" onclick="askChatbot('${p.replace(/'/g,"\\'")}')">${p}</button>`).join("");
}

function addChatbotMessage(text, who){
    const box = document.getElementById("chatbot-messages");
    const div = document.createElement("div");
    div.className = "chatbot-msg " + who;
    div.textContent = text;
    // مع كل رد للمساعد على سؤال فعلي: نعرض زر فتح السبورة ليشرحه المعلّم خطوة بخطوة
    if(who === "bot" && window.__lastChatUserMsg){
        const q = window.__lastChatUserMsg;
        const link = document.createElement("button");
        link.type = "button";
        link.className = "chatbot-msg-board-link";
        link.innerHTML = '<i class="fa-solid fa-chalkboard-user"></i> ' + (currentLang==='ar' ? 'اشرحها على السبورة' : 'Explain on the board');
        link.onclick = () => explainLastOnBoard(q);
        div.appendChild(document.createElement("br"));
        div.appendChild(link);
    }
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

// فقاعة مخصَّصة لتنبيه "سجّل الدخول لاستخدام الذكاء الاصطناعي" — منفصلة عن
// addChatbotMessage عمداً (لا نريد زر "اشرحها على السبورة" غير المناسب هنا،
// ونحتاج HTML فعلي لزر تسجيل الدخول الحقيقي، انظر buildAiAuthPromptHtml)
function addChatbotAuthPrompt(message){
    const box = document.getElementById("chatbot-messages");
    const div = document.createElement("div");
    div.className = "chatbot-msg bot";
    div.innerHTML = buildAiAuthPromptHtml(message);
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

function askChatbot(text){
    document.getElementById("chatbot-input").value = text;
    sendChatbotMessage();
}

let chatHistory = [];
// بدل تعطيل Gemini نهائياً طوال الجلسة بعد أول فشل (كان يجبر الطالب على
// إعادة تحميل الصفحة ليعمل الذكاء الاصطناعي مجدداً حتى لو كان الفشل عارضاً
// وقتياً كبطء شبكة أو استيقاظ بطيء لخادم الدالة الوسيطة على Netlify)، نستخدم
// فترة تهدئة قصيرة: نعيد المحاولة تلقائياً بعد 30 ثانية من آخر فشل
let geminiLastFailAt = 0;
const GEMINI_RETRY_COOLDOWN_MS = 30000;
function isGeminiWorking(){ return (Date.now() - geminiLastFailAt) > GEMINI_RETRY_COOLDOWN_MS; }

async function sendChatbotMessage(){
    /* يُحفظ نص سؤال الطالب ليستعمله زر "اشرحها على السبورة" أسفل رد المساعد */
    const input = document.getElementById("chatbot-input");
    const text = input.value.trim();
    if(!text) return;
    window.__lastChatUserMsg = text;
    addChatbotMessage(text, "user");
    input.value = "";

    if(isGeminiWorking()){
        addChatbotMessage("...", "bot typing-indicator");
        try{
            const reply = await askGemini(text);
            removeTypingIndicator();
            // إن ضمّن الرد وسم توجيه بصري، نفّذه ونعرض النص بعد إزالة الوسم
            // منه فقط (الطالب لا يحتاج يرى الصياغة التقنية الداخلية)
            const { cleaned, key } = extractNavigateTag(reply);
            addChatbotMessage(cleaned, "bot");
            if(key) aiGuideNavigate(key);
            return;
        }catch(e){
            removeTypingIndicator();
            const limitMsg = getAiLimitErrorMessage(e);
            if(limitMsg){
                // تسجيل دخول مطلوب / بلغ الحد — ليست مشكلة اتصال مؤقتة، فلا نرجع
                // للمساعد المحلي (سيبدو مضللاً)، بل نوضّح السبب الحقيقي مباشرة.
                // لا تحويل تلقائي مفاجئ لشاشة الدخول — زر حقيقي يفتحها فقط إن
                // اختار الطالب ذلك بنفسه (كانت الرسالة تختفي فوراً قبل أن تُقرأ)
                if(e.code === "AUTH_REQUIRED") addChatbotAuthPrompt(limitMsg);
                else addChatbotMessage(limitMsg, "bot");
                return;
            }
            geminiLastFailAt = Date.now(); // نتحوّل للمساعد المحلي مؤقتاً، ونعيد محاولة Gemini تلقائياً بعد فترة التهدئة
            console.error("[خُطى] الذكاء الاصطناعي غير متاح مؤقتاً — تفاصيل الخطأ للمطوّر (تحقق من GEMINI_API_KEY ونشر gemini-proxy.js على Netlify):", e);
            answerLocally(text, true);
            return;
        }
    }
    answerLocally(text, false);
}

function answerLocally(text, viaFallback){
    const lower = normalizeArabic(text);
    // مطابقة صارمة أولاً (الكلمة المفتاحية كاملة)، ثم مطابقة بجذر الكلمة (أول
    // 4 أحرف على الأقل) لتغطية اختلاف اللواحق العربية— مثال: "موزونتي" تُطابق
    // كلمة "موزونة" رغم اختلاف اللاحقة، لأن نفس الجذر الأول موجود في الجملة
    let match = FAQ_BOT.find(f => f.kw.some(k => lower.includes(normalizeArabic(k))));
    if(!match){
        match = FAQ_BOT.find(f => f.kw.some(k => {
            const nk = normalizeArabic(k);
            return nk.length >= 4 && lower.includes(nk.slice(0, Math.max(4, nk.length - 2)));
        }));
    }
    setTimeout(() => {
        if(match){
            addChatbotMessage(currentLang==='ar' ? match.ar : match.en, "bot");
        } else if(viaFallback){
            // نوضّح بصراحة أن هذا تعطّل مؤقت بالذكاء الاصطناعي، لا قصوراً دائماً
            // في المساعد — حتى لا يظن الطالب أن الميزة غير موجودة أصلاً
            addChatbotMessage(currentLang==='ar'
                ? "😕 مساعدك الذكي غير متاح مؤقتاً الآن (مشكلة اتصال). جرّب ترسل سؤالك مرة ثانية بعد قليل، أو تواصل معنا مباشرة عبر واتساب من صفحة الروابط."
                : "😕 Your smart assistant is temporarily unavailable (connection issue). Try sending your question again shortly, or reach us directly via WhatsApp from the Links page.", "bot");
        } else {
            addChatbotMessage(currentLang==='ar'
                ? "ما عندي إجابة جاهزة لهذا السؤال تحديداً. جرّب صياغة أخرى، أو تواصل معنا مباشرة عبر واتساب من صفحة الروابط."
                : "I don't have a ready answer for that specific question. Try rephrasing, or reach us directly via WhatsApp from the Links page.", "bot");
        }
    }, 250);
}
// تطبيع بسيط للعربية: توحيد أشكال الألف والهمزة والتاء المربوطة/الألف
// المقصورة، وحذف التشكيل — يرفع دقة المطابقة بين صياغات الطالب المختلفة
function normalizeArabic(s){
    return String(s).toLowerCase()
        .replace(/[\u064B-\u065F]/g, "")           // التشكيل
        .replace(/[إأآا]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .trim();
}

function removeTypingIndicator(){
    const el = document.querySelector(".typing-indicator");
    if(el) el.remove();
}

// نداء موحّد آمن للدالة الوسيطة — يرسل حصراً "mode" (من قائمة محدودة يتحقق
// منها الخادم) والبيانات الفعلية اللازمة لذلك النمط. لا "model" ولا
// "system_instruction" يُرسَلان من المتصفح إطلاقاً بعد الآن (انظر الشرح
// الأمني أعلى الملف) — كلاهما مضبوطان صلباً داخل gemini-proxy.js نفسها.
//
// ⚠️ الذكاء الاصطناعي بكل أنماطه أصبح لحسابات مسجَّلة فقط (بطلب صريح من
// المطوّر — حد يومي/أسبوعي لكل طالب، والمشرفون معفَون كلياً). نرسل توكن
// الجلسة الحقيقي مع كل طلب؛ الخادم هو من يتحقق منه فعلياً ويطبّق الحد —
// هذا فقط يوفّر التوكن اللازم، لا "يثق" العميل بنفسه بأي شيء.
async function callGeminiProxy(mode, extraFields){
    let accessToken = null;
    if(sb){
        const { data } = await sb.auth.getSession();
        const session = data && data.session;
        // الجلسة المجهولة (التي ينشئها التطبيق تلقائياً لكل ضيف من أجل
        // المجتمع) ليست "حساباً مسجَّلاً" — الخادم يرفضها أصلاً، ونتحقق منها
        // هنا أيضاً كي يرى الضيف رسالة تسجيل الدخول فوراً بلا طلب ضائع
        if(session && session.user && session.user.is_anonymous !== true){
            accessToken = session.access_token;
        }
    }
    if(!accessToken){
        const err = new Error("Sign-in required for AI features");
        err.code = "AUTH_REQUIRED";
        throw err;
    }
    const res = await fetch("/.netlify/functions/gemini-proxy", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ mode, accessToken, ...extraFields })
    });
    if(!res.ok){
        const errBody = await res.json().catch(() => ({}));
        console.error("[خُطى] الدالة الوسيطة رفضت الطلب — الحالة:", res.status, "التفاصيل:", errBody);
        const err = new Error(errBody.error || ("Gemini proxy HTTP " + res.status));
        err.code = errBody.code;
        throw err;
    }
    const json = await res.json();
    const reply = json.candidates && json.candidates[0] && json.candidates[0].content && json.candidates[0].content.parts[0].text;
    if(!reply) throw new Error("Empty Gemini response");
    return reply;
}

// رسالة موحّدة لأخطاء الذكاء الاصطناعي "الدائمة" (تسجيل الدخول مطلوب / بلغت
// الحد) — تُعيد null لأي خطأ آخر (عطل اتصال مؤقت مثلاً) ليستمر المستدعي
// بمعالجته بالأسلوب المعتاد (الرجوع للمساعد المحلي، رسالة "جرّب لاحقاً"...)
function getAiLimitErrorMessage(e){
    if(!e || !e.code) return null;
    if(e.code === "AUTH_REQUIRED"){
        return labT(
            "🔒 سجّل الدخول (أو أنشئ حساباً مجانياً بضغطة واحدة) لاستخدام المساعد الذكي — متاح لحسابات مسجَّلة فقط حالياً.",
            "🔒 Sign in (or create a free account in one click) to use the AI assistant — currently available to registered accounts only.");
    }
    if(e.code === "DAILY_LIMIT"){
        return labT("⏳ بلغت حدّك اليومي من استخدام الذكاء الاصطناعي — يتجدد الحد غداً.",
            "⏳ You've reached your daily AI usage limit — it resets tomorrow.");
    }
    if(e.code === "WEEKLY_LIMIT"){
        return labT("📅 بلغت حدّك الأسبوعي من استخدام الذكاء الاصطناعي — يتجدد الحد الأسبوع القادم.",
            "📅 You've reached your weekly AI usage limit — it resets next week.");
    }
    return null;
}

// ⚠️ لا نحوّل الطالب تلقائياً لشاشة الدخول عند AUTH_REQUIRED (كان هذا
// يبدو انقطاعاً مفاجئاً — الرسالة تختفي فوراً قبل أن يقرأها الطالب أصلاً).
// بدلاً من ذلك: رسالة واضحة + زر حقيقي يفتح شاشة الدخول فقط إن اختار
// الطالب ذلك بنفسه. يُستخدَم في كل نقاط دخول الذكاء الاصطناعي الأربع
// (الدردشة، السبورة، الدفتر، توليد الاختبار) لسلوك موحّد.
function buildAiAuthPromptHtml(message){
    return `<div class="ai-auth-prompt">
        <p>${escapeHtml(message)}</p>
        <button type="button" class="btn btn-sm" onclick="document.getElementById('login-overlay').style.display='flex'">
            <i class="fa-solid fa-right-to-bracket"></i> ${labT("تسجيل الدخول","Sign in")}
        </button>
    </div>`;
}

async function askGemini(userText){
    chatHistory.push({ role:"user", parts:[{ text:userText }] });
    const reply = await callGeminiProxy("chat", { history: chatHistory.slice(-10) });
    chatHistory.push({ role:"model", parts:[{ text: reply }] });
    persistCurrentConversation(); // كل تبادل ناجح مع Gemini يُحفَظ تلقائياً — انظر القسم 42 أدناه
    return reply;
}

/* ============================================================
   42) سجل محادثات المساعد الذكي — حفظ تلقائي، عنوان يولّده Gemini،
   استكمال أو حذف من تبويب "محادثاتي" داخل السبورة الذكية
   ------------------------------------------------------------
   نطاق الحفظ: محادثات Gemini الحقيقية فقط (chatHistory يُملأ حصراً من
   askGemini الناجحة) — ردود المساعد المحلي الاحتياطي عند تعطّل الاتصال
   لا تُحسب "محادثة مع الذكاء الاصطناعي" فلا تُحفَظ.
   ============================================================ */
const CHAT_CONVERSATIONS_KEY = "khuta_chat_conversations";
const MAX_SAVED_CONVERSATIONS = 30;      // حد أقصى لعدد المحادثات المحفوظة
const MAX_MESSAGES_PER_CONVERSATION = 60; // حد أقصى لطول كل محادثة عند الحفظ (يقصّ الأقدم عند الحاجة)
let currentConversationId = null; // null = محادثة لم تُحفظ بعد (ستُنشأ عند أول رد ناجح)

function getChatConversations(){
    try{ return JSON.parse(localStorage.getItem(CHAT_CONVERSATIONS_KEY) || "[]"); }catch(e){ return []; }
}
function saveChatConversations(list){
    try{ localStorage.setItem(CHAT_CONVERSATIONS_KEY, JSON.stringify(list)); }
    catch(e){ console.error("[خُطى] تعذّر حفظ سجل المحادثات (قد تكون مساحة التخزين ممتلئة):", e); }
}

function persistCurrentConversation(){
    const list = getChatConversations();
    let conv = list.find(c => c.id === currentConversationId);
    if(!conv){
        conv = { id: "conv_" + Date.now().toString(36) + Math.random().toString(36).slice(2,6), title: null, messages: [], createdAt: new Date().toISOString() };
        currentConversationId = conv.id;
        list.unshift(conv);
    }
    conv.messages = chatHistory.slice(-MAX_MESSAGES_PER_CONVERSATION);
    conv.updatedAt = new Date().toISOString();
    while(list.length > MAX_SAVED_CONVERSATIONS) list.pop(); // نحذف الأقدم تحديثاً عند تجاوز الحد
    saveChatConversations(list);
    if(!conv.title && chatHistory.length >= 2) generateConversationTitle(conv.id);
    if(document.getElementById("board-tab-chats")?.classList.contains("active")) renderSavedConversationsList();
}

async function generateConversationTitle(convId){
    const list = getChatConversations();
    const conv = list.find(c => c.id === convId);
    if(!conv || conv.title) return;
    try{
        const firstExchange = conv.messages.slice(0, 4)
            .map(m => (m.role === "user" ? "الطالب: " : "المساعد: ") + (m.parts[0] && m.parts[0].text || ""))
            .join("\n");
        const rawTitle = await callGeminiProxy("title", { text: firstExchange });
        const cleanTitle = rawTitle.trim().replace(/^["'«»]+|["'«»]+$/g, "").replace(/\.$/, "").slice(0, 60);
        // نعيد قراءة القائمة (لا نعتمد على `list`/`conv` الملتقطتين قبل النداء
        // غير المتزامن، تحسّباً لأي تعديل آخر طرأ على السجل أثناء الانتظار)
        const freshList = getChatConversations();
        const freshConv = freshList.find(c => c.id === convId);
        if(freshConv && !freshConv.title){
            freshConv.title = cleanTitle || (currentLang==='ar' ? "محادثة بلا عنوان" : "Untitled conversation");
            saveChatConversations(freshList);
            renderSavedConversationsList();
        }
    }catch(e){
        console.error("[خُطى] تعذّر توليد عنوان المحادثة (ليست مشكلة حرجة، ستبقى بلا عنوان):", e);
    }
}

function renderSavedConversationsList(){
    const box = document.getElementById("chat-history-list");
    if(!box) return;
    const list = getChatConversations();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub" style="padding:8px 2px;">${labT("لا محادثات محفوظة بعد — أول محادثة حقيقية مع مساعدك ستُحفَظ هنا تلقائياً","No saved conversations yet — your first real exchange with your assistant will be saved here automatically")}</div>`;
        return;
    }
    box.innerHTML = list.map(c => {
        const dateStr = new Date(c.updatedAt || c.createdAt).toLocaleDateString(currentLang==='ar' ? 'ar-SA' : 'en-US', { day:"numeric", month:"short" });
        const title = c.title || labT("محادثة بلا عنوان بعد…","Untitled conversation…");
        return `
        <div class="chat-history-row ${c.id===currentConversationId?'active':''}">
            <button type="button" class="chat-history-open" onclick="openSavedConversation('${c.id}')">
                <b>${escapeHtml(title)}</b>
                <span>${dateStr} · ${c.messages.length} ${labT("رسالة","messages")}</span>
            </button>
            <button type="button" class="btn-ghost chat-history-del" onclick="deleteSavedConversation('${c.id}')" title="${labT("حذف","Delete")}"><i class="fa-solid fa-trash"></i></button>
        </div>`;
    }).join("");
}

function openSavedConversation(id){
    const conv = getChatConversations().find(c => c.id === id);
    if(!conv) return;
    currentConversationId = conv.id;
    chatHistory = conv.messages.slice();
    const box = document.getElementById("chatbot-messages");
    box.innerHTML = "";
    chatHistory.forEach(m => {
        const text = m.parts && m.parts[0] && m.parts[0].text || "";
        addChatbotMessage(text, m.role === "user" ? "user" : "bot");
    });
    closeKhutaBoard();
    const panel = document.getElementById("chatbot-panel");
    if(panel.style.display === "none" || panel.classList.contains("panel-closing")) toggleChatbot();
    renderSavedConversationsList();
    showToast(labT("📂 تابع من حيث توقفت","📂 Continuing where you left off"));
}

function deleteSavedConversation(id){
    if(!confirm(labT("حذف هذه المحادثة نهائياً؟ لا يمكن التراجع.","Delete this conversation permanently? This can't be undone."))) return;
    saveChatConversations(getChatConversations().filter(c => c.id !== id));
    if(currentConversationId === id){ currentConversationId = null; chatHistory = []; }
    renderSavedConversationsList();
}

function startNewConversation(){
    currentConversationId = null;
    chatHistory = [];
    const box = document.getElementById("chatbot-messages");
    box.innerHTML = "";
    closeKhutaBoard();
    const panel = document.getElementById("chatbot-panel");
    if(panel.style.display === "none" || panel.classList.contains("panel-closing")) toggleChatbot();
    addChatbotMessage(currentLang==='ar'
        ? "أهلاً يا بطل! 👋 محادثة جديدة — قلّي وش تبي."
        : "Hey champ! 👋 New conversation — tell me what you need.", "bot");
    renderSavedConversationsList();
}

/* ============================================================
   22) العلامة المائية
   ============================================================ */
(function initWatermark(){
    const slot = document.getElementById("owner-name-slot");
    if(slot && APP_OWNER_NAME) slot.textContent = APP_OWNER_NAME;
})();

/* تسجيل الـ Service Worker لتفعيل تثبيت الموقع كتطبيق (PWA) على الجوال/سطح
   المكتب — فشل صامت تماماً في أي متصفح لا يدعمه، لا يؤثر على عمل الموقع */
if("serviceWorker" in navigator){
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch(() => { /* تجاهل بصمت */ });
    });
}

/* ============================================================
   40) مختبر خُطى — الميزات الذكية الجديدة
   أ) سبورة يشرح عليها Gemini خطوة بخطوة (من داخل شات المساعد)
   ب) دفتر الطالب: رسم + كتابة، حفظ لوحات متعددة، إرسالها للذكاء ليحلّها
   ج) توليد اختبار محاكي كامل من ملفات الطالب (كمي/لفظي) عبر Gemini
   د) سجل الاختبارات السابقة: الدرجة + الأسئلة الخاطئة بمراجعة تفصيلية
   هـ) خطط متعددة بأسماء: حفظ/تبديل/حذف لقطات كاملة للخطة
   و) الروتين الأسبوعي (عادي/أخف/إجازة) + تواريخ مستثناة + مؤشر الضغط
   — كل النوافذ تفتح وتُغلق بأنيميشن انسيابي، لا ظهور/اختفاء مفاجئ
   ============================================================ */

/* ---------- أدوات مشتركة ---------- */
function labT(ar, en){ return currentLang === "ar" ? ar : en; }

// فتح/إغلاق أي نافذة من نوافذ المختبر بأنيميشن موحّد (فئة .lab-open + إغلاق متدرّج)
function labOverlayOpen(id){
    const el = document.getElementById(id);
    // يُلغي مؤقّت الإغلاق المعلّق من نداء إغلاق سابق سريع (فتح←إغلاق←فتح خلال
    // أقل من 380ms) — بدونه كانت النافذة تُغلَق قسراً رغم إعادة فتحها للتو
    clearTimeout(el.__closeT);
    el.style.display = "flex";
    // إجبار المتصفح على تثبيت حالة البداية قبل إضافة فئة الفتح كي يعمل الانتقال
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("lab-open")));
    document.body.style.overflow = "hidden";
}
function labOverlayClose(id){
    const el = document.getElementById(id);
    el.classList.remove("lab-open");
    clearTimeout(el.__closeT);
    el.__closeT = setTimeout(() => { el.style.display = "none"; }, 380);
    document.body.style.overflow = "";
}
// يلتقط JSON من رد النموذج حتى لو لفّه بأسوار ```json أو كلام زائد
function extractJson(text){
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let raw = fenced ? fenced[1] : text;
    const first = raw.indexOf("{"); const last = raw.lastIndexOf("}");
    if(first === -1 || last === -1) throw new Error("no json braces");
    return JSON.parse(raw.slice(first, last + 1));
}

/* ============================================================
   أ + ب) السبورة الذكية ودفتر الطالب — نافذة واحدة بتبويبين
   ============================================================ */
let boardState = { steps:[], idx:0, playing:false, playTimer:null, typeTimer:null };

function openKhutaBoard(tab, fullMode){
    labOverlayOpen("khuta-board-overlay");
    document.querySelector(".board-window").classList.toggle("full-mode", !!fullMode);
    switchBoardTab(tab || "ai");
    initStudentCanvas(); // آمنة الاستدعاء المتكرر — تُهيّئ مستمعي الرسم مرة واحدة فقط
    renderSavedBoardsList();
    // في الوضع الكامل تُعرض اللوحتان معاً على الكمبيوتر، فنقيس مساحة الرسم
    // فور الفتح (بعد إطارين لضمان اكتمال التخطيط)، لا فقط عند تبديل تبويب
    if(fullMode) requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas));
}
function closeKhutaBoard(){
    stopBoardPlayback();
    labOverlayClose("khuta-board-overlay");
}

/* ⚠️ مخرجان احتياطيان للسبورة — أُضيفا بعد بلاغ حقيقي: على هاتف ضيّق دُفع زر
   الإغلاق خارج الشاشة فحُبس الطالب داخل السبورة بلا أي وسيلة للخروج. أُصلح
   سبب الدفع في CSS، لكن نضيف هنا مخرجين لا يعتمدان على التخطيط إطلاقاً كي
   لا تتكرر الحالة مهما تغيّر العرض مستقبلاً:
   1) مفتاح Escape.
   2) النقر على الخلفية المعتمة خارج نافذة السبورة. */
document.addEventListener("keydown", (e) => {
    if(e.key !== "Escape") return;
    const ov = document.getElementById("khuta-board-overlay");
    if(ov && ov.style.display !== "none") closeKhutaBoard();
});
document.addEventListener("click", (e) => {
    // الخلفية نفسها فقط — لا أي عنصر داخل النافذة
    if(e.target && e.target.id === "khuta-board-overlay") closeKhutaBoard();
});
function switchBoardTab(tab){
    document.querySelectorAll(".board-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    // التبويب النشط قد يكون خارج الجزء المرئي من الصف على الهاتف — نجلبه
    // للعرض تلقائياً كي يرى الطالب دائماً أين هو
    const activeTab = document.querySelector(`.board-tab[data-tab="${tab}"]`);
    if(activeTab && activeTab.scrollIntoView) activeTab.scrollIntoView({ block:"nearest", inline:"nearest", behavior:"smooth" });
    document.getElementById("board-tab-ai").classList.toggle("active", tab === "ai");
    document.getElementById("board-tab-file").classList.toggle("active", tab === "file");
    document.getElementById("board-tab-pad").classList.toggle("active", tab === "pad");
    document.getElementById("board-tab-chats").classList.toggle("active", tab === "chats");
    // في الوضع الكامل، السبورة والدفتر يُعرضان جنباً إلى جنب دوماً — لكن
    // تبويب "محادثاتي" يستثني نفسه من هذا التقسيم ويأخذ العرض كاملاً وحده،
    // مطابقةً لفئة .showing-chats في CSS
    document.querySelector(".board-window").classList.toggle("showing-chats", tab === "chats");
    // تبويب "اشرح ملفي" يستثني نفسه أيضاً من عرض السبورة+الدفتر جنباً إلى جنب
    // ويأخذ عرض النافذة كاملاً — شرح الملف طويل ويحتاج المساحة
    document.querySelector(".board-window").classList.toggle("showing-file", tab === "file");
    if(tab === "chats") renderSavedConversationsList();
    // إصلاح جذري: كانت مساحة الرسم تُقاس مرة واحدة فقط عند فتح النافذة، وغالباً
    // بينما تبويب "دفتري" لا يزال display:none (لأن التبويب الافتراضي هو
    // السبورة) — فتُقرأ أبعاد صندوق صفرية وتسقط اللوحة لحجم احتياطي صغير
    // (300×240)، تاركةً مساحة واسعة غير قابلة للرسم عليها إطلاقاً. الآن نعيد
    // القياس في كل مرة تصبح فيها لوحة "دفتري" ظاهرة فعلياً.
    if(tab === "pad") requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas));
}

/* ---------- السبورة التي يتحكم بها Gemini ---------- */
async function boardExplain(questionText){
    const q = (questionText || document.getElementById("board-ai-input").value).trim();
    if(!q){ showToast(labT("اكتب السؤال أو المفهوم أولاً", "Type the question or concept first")); return; }
    document.getElementById("board-ai-input").value = q;
    stopBoardPlayback();
    const surface = document.getElementById("board-surface");
    surface.innerHTML = `<div class="board-loading"><span class="board-chalk-dot"></span>${labT("المعلّم يحضّر الشرح…","Teacher is preparing…")}</div>`;
    setBoardControlsEnabled(false);
    try{
        const reply = await callGeminiProxy("board", { text: q });
        let data;
        try{ data = extractJson(reply); }
        catch(e){
            // خطة بديلة: نعرض الرد نصاً عادياً على السبورة بدل الفشل الكامل
            data = { title: labT("شرح","Explanation"), steps: [{ say:"", write: reply.split("\n").filter(l=>l.trim()).slice(0,8), mark:"none" }], answer:"" };
        }
        if(!Array.isArray(data.steps) || data.steps.length === 0) throw new Error("bad steps");
        boardState.steps = data.steps;
        boardState.answer = data.answer || "";
        boardState.title = data.title || "";
        boardState.idx = 0;
        surface.innerHTML = `<div class="board-title">${escapeHtml(boardState.title)}</div><div id="board-steps-area"></div>`;
        setBoardControlsEnabled(true);
        playBoardFromStart();
    }catch(e){
        console.error("[خُطى] فشل شرح السبورة:", e);
        const limitMsg = getAiLimitErrorMessage(e);
        if(e.code === "AUTH_REQUIRED"){
            surface.innerHTML = buildAiAuthPromptHtml(limitMsg);
        } else {
            surface.innerHTML = `<div class="board-loading">${limitMsg ? "" : "😕 "}${limitMsg || labT("تعذّر الوصول للذكاء الاصطناعي الآن — جرّب بعد قليل","Couldn't reach the AI right now — try again shortly")}</div>`;
        }
    }
}

function playBoardFromStart(){
    document.getElementById("board-steps-area").innerHTML = "";
    boardState.idx = 0;
    boardState.playing = true;
    updateBoardPlayBtn();
    renderNextBoardStep();
}
function renderNextBoardStep(){
    if(!boardState.playing) return;
    if(boardState.idx >= boardState.steps.length){ renderBoardAnswer(); return; }
    const step = boardState.steps[boardState.idx];
    const area = document.getElementById("board-steps-area");
    const wrap = document.createElement("div");
    wrap.className = "board-step";
    if(step.say) wrap.innerHTML += `<div class="board-say">🧑‍🏫 ${escapeHtml(step.say)}</div>`;
    const linesBox = document.createElement("div");
    linesBox.className = "board-lines" + (step.mark === "box" ? " mark-box" : "") + (step.mark === "underline" ? " mark-underline" : "");
    wrap.appendChild(linesBox);
    area.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("shown"));
    // كتابة الأسطر حرفاً حرفاً كطباشير حقيقي
    const lines = (step.write || []).map(String);
    let li = 0, ci = 0;
    const lineEls = lines.map(() => { const d = document.createElement("div"); d.className = "board-chalk-line"; linesBox.appendChild(d); return d; });
    clearInterval(boardState.typeTimer);
    boardState.typeTimer = setInterval(() => {
        if(li >= lines.length){
            clearInterval(boardState.typeTimer);
            boardState.idx++;
            boardState.playTimer = setTimeout(renderNextBoardStep, 900);
            return;
        }
        lineEls[li].textContent = lines[li].slice(0, ++ci);
        if(ci >= lines[li].length){ li++; ci = 0; }
        area.parentElement.scrollTop = area.parentElement.scrollHeight;
    }, 28);
}
function renderBoardAnswer(){
    boardState.playing = false;
    updateBoardPlayBtn();
    if(!boardState.answer) return;
    const area = document.getElementById("board-steps-area");
    const d = document.createElement("div");
    d.className = "board-answer";
    d.innerHTML = `✅ ${escapeHtml(boardState.answer)}`;
    area.appendChild(d);
    requestAnimationFrame(() => d.classList.add("shown"));
    area.parentElement.scrollTop = area.parentElement.scrollHeight;
}
function toggleBoardPlayback(){
    if(boardState.steps.length === 0) return;
    if(boardState.playing){ stopBoardPlayback(); }
    else{
        // إن كان الشرح انتهى نعيده من البداية، وإلا نكمل من حيث توقفنا
        if(boardState.idx >= boardState.steps.length) playBoardFromStart();
        else { boardState.playing = true; updateBoardPlayBtn(); renderNextBoardStep(); }
    }
}
function stopBoardPlayback(){
    boardState.playing = false;
    clearInterval(boardState.typeTimer);
    clearTimeout(boardState.playTimer);
    updateBoardPlayBtn();
}
function updateBoardPlayBtn(){
    const b = document.getElementById("board-play-btn");
    if(b) b.innerHTML = boardState.playing
        ? `<i class="fa-solid fa-pause"></i> ${labT("إيقاف","Pause")}`
        : `<i class="fa-solid fa-play"></i> ${labT("تشغيل","Play")}`;
}
function setBoardControlsEnabled(on){
    ["board-play-btn","board-replay-btn"].forEach(id => { const b=document.getElementById(id); if(b) b.disabled = !on; });
}
// يُستدعى من زر "اشرحها على السبورة" أسفل ردود المساعد
function explainLastOnBoard(text){
    openKhutaBoard("ai");
    boardExplain(text);
}

/* ---------- دفتر الطالب: رسم + كتابة + حفظ + إرسال للذكاء ---------- */
let padState = { inited:false, drawing:false, strokes:[], current:null, color:"#FFFFFF", size:3, erase:false };

// مستقلة عن initStudentCanvas عمداً كي يمكن استدعاؤها من الخارج (عند تبديل
// التبويب إلى "دفتري"، وعند فتح النافذة مباشرة في الوضع الكامل) وليس فقط
// مرة واحدة عند أول فتح للنافذة — هذا هو إصلاح خلل "لا يمكن الرسم إلا في
// مساحة صغيرة": القياس السابق كان يحدث أحياناً بينما اللوحة لا تزال
// display:none فتُقرأ أبعاد صفرية وتسقط لحجم احتياطي 300×240 صغير.
function resizePadCanvas(){
    const canvas = document.getElementById("student-pad-canvas");
    if(!canvas) return;
    const box = canvas.parentElement.getBoundingClientRect();
    // لا نقيس إن كانت اللوحة غير ظاهرة فعلياً بعد (أبعاد صفرية) — نتجنّب
    // تجميد اللوحة على الحجم الاحتياطي الصغير؛ سيُعاد استدعاؤنا لاحقاً
    // عند تبديل التبويب أو فتح الوضع الكامل فور ظهورها.
    if(box.width < 10 || box.height < 10) return;
    canvas.width = Math.round(box.width - 4);
    canvas.height = Math.round(box.height - 4);
    redrawPad(); // نعيد رسم كل الخطوط المحفوظة بعد تغيّر الأبعاد
}

function initStudentCanvas(){
    if(padState.inited) return;
    padState.inited = true;
    const canvas = document.getElementById("student-pad-canvas");
    const ctx = canvas.getContext("2d");
    window.addEventListener("resize", () => { if(document.getElementById("khuta-board-overlay").style.display !== "none") resizePadCanvas(); });
    requestAnimationFrame(() => requestAnimationFrame(resizePadCanvas)); // إن كان "دفتري" هو التبويب الظاهر فوراً
    const pos = (e) => {
        const r = canvas.getBoundingClientRect();
        const t = e.touches ? e.touches[0] : e;
        return { x: t.clientX - r.left, y: t.clientY - r.top };
    };
    const down = (e) => {
        padState.drawing = true;
        padState.current = { color: padState.erase ? "__erase__" : padState.color, size: padState.erase ? 22 : padState.size, pts: [pos(e)] };
        e.preventDefault();
    };
    const move = (e) => {
        if(!padState.drawing) return;
        padState.current.pts.push(pos(e));
        drawStroke(ctx, padState.current, true);
        e.preventDefault();
    };
    const up = () => {
        if(!padState.drawing) return;
        padState.drawing = false;
        if(padState.current && padState.current.pts.length > 1) padState.strokes.push(padState.current);
        padState.current = null;
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    canvas.addEventListener("touchstart", down, {passive:false});
    canvas.addEventListener("touchmove", move, {passive:false});
    window.addEventListener("touchend", up);
}
function drawStroke(ctx, s, lastSegOnly){
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = s.size;
    ctx.globalCompositeOperation = s.color === "__erase__" ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color === "__erase__" ? "rgba(0,0,0,1)" : s.color;
    const pts = s.pts;
    ctx.beginPath();
    const from = lastSegOnly ? Math.max(0, pts.length - 2) : 0;
    ctx.moveTo(pts[from].x, pts[from].y);
    for(let i = from + 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
}
function redrawPad(){
    const canvas = document.getElementById("student-pad-canvas");
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    padState.strokes.forEach(s => drawStroke(ctx, s, false));
}
function padSetColor(c, btn){
    padState.color = c; padState.erase = false;
    document.querySelectorAll(".pad-color").forEach(b => b.classList.toggle("active", b === btn));
    document.getElementById("pad-eraser-btn").classList.remove("active");
}
function padToggleEraser(btn){
    padState.erase = !padState.erase;
    btn.classList.toggle("active", padState.erase);
}
function padUndo(){ padState.strokes.pop(); redrawPad(); }
function padClear(){ padState.strokes = []; redrawPad(); }

const PAD_STORE_KEY = "khuta_student_boards";
function getSavedBoards(){ try{ return JSON.parse(localStorage.getItem(PAD_STORE_KEY) || "[]"); }catch(e){ return []; } }
function saveCurrentBoard(){
    const name = (document.getElementById("pad-name-input").value || "").trim() || labT("لوحة بدون اسم","Untitled board");
    const canvas = document.getElementById("student-pad-canvas");
    // نصغّر الصورة المحفوظة (جودة 0.75) حتى لا نستهلك مساحة التخزين المحلي
    const img = padState.strokes.length ? canvas.toDataURL("image/jpeg", 0.75) : "";
    const list = getSavedBoards();
    list.unshift({ id: Date.now().toString(36), name, date: new Date().toISOString(), img, text: document.getElementById("pad-text-input").value || "" });
    while(list.length > 12) list.pop();
    try{ localStorage.setItem(PAD_STORE_KEY, JSON.stringify(list)); }
    catch(e){ showToast(labT("مساحة التخزين ممتلئة — احذف لوحات قديمة","Storage full — delete old boards")); return; }
    showToast(labT("💾 حُفظت اللوحة: ","💾 Saved: ") + name);
    document.getElementById("pad-name-input").value = "";
    renderSavedBoardsList();
}
function renderSavedBoardsList(){
    const box = document.getElementById("pad-saved-list");
    if(!box) return;
    const list = getSavedBoards();
    if(list.length === 0){ box.innerHTML = `<div class="card-sub" style="padding:6px 2px;">${labT("لا لوحات محفوظة بعد","No saved boards yet")}</div>`; return; }
    box.innerHTML = list.map(b => `
        <div class="pad-saved-row">
            <button type="button" class="pad-saved-open" onclick="openSavedBoard('${b.id}')" title="${labT("فتح","Open")}">
                <b>${escapeHtml(b.name)}</b>
                <span>${new Date(b.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US')}</span>
            </button>
            <button type="button" class="btn-ghost pad-saved-del" onclick="deleteSavedBoard('${b.id}')" title="${labT("حذف","Delete")}"><i class="fa-solid fa-trash"></i></button>
        </div>`).join("");
}
function openSavedBoard(id){
    const b = getSavedBoards().find(x => x.id === id);
    if(!b) return;
    document.getElementById("pad-text-input").value = b.text || "";
    padState.strokes = [];
    redrawPad();
    if(b.img){
        const canvas = document.getElementById("student-pad-canvas");
        const ctx = canvas.getContext("2d");
        const im = new Image();
        im.onload = () => { ctx.drawImage(im, 0, 0, canvas.width, canvas.height); };
        im.src = b.img;
    }
    showToast(labT("📂 فُتحت: ","📂 Opened: ") + b.name);
}
function deleteSavedBoard(id){
    const list = getSavedBoards().filter(x => x.id !== id);
    localStorage.setItem(PAD_STORE_KEY, JSON.stringify(list));
    renderSavedBoardsList();
}
async function sendPadToAI(){
    const rawText = document.getElementById("pad-text-input").value.trim();
    const hasDrawing = padState.strokes.length > 0;
    if(!rawText && !hasDrawing){ showToast(labT("اكتب أو ارسم شيئاً أولاً","Write or draw something first")); return; }
    const out = document.getElementById("pad-ai-answer");
    out.style.display = "block";
    out.innerHTML = `<span class="board-chalk-dot"></span>${labT("الذكاء يحلّل دفترك…","AI is analyzing your pad…")}`;

    let text = rawText ? (labT("ما كتبه الطالب: ","Student wrote: ") + rawText) : "";
    let image = null;
    if(hasDrawing){
        // نرسل الرسم كصورة — Gemini Flash يدعم الرؤية، والوسيط يبنيها ضمن الطلب.
        // نرسم فوق خلفية داكنة أولاً لأن الشفاف يتحول أسودَ في JPEG فيختفي الحبر الداكن
        const src = document.getElementById("student-pad-canvas");
        const tmp = document.createElement("canvas");
        tmp.width = src.width; tmp.height = src.height;
        const tctx = tmp.getContext("2d");
        tctx.fillStyle = "#1a1440"; tctx.fillRect(0,0,tmp.width,tmp.height);
        tctx.drawImage(src, 0, 0);
        const dataUrl = tmp.toDataURL("image/jpeg", 0.8);
        image = dataUrl.split(",")[1]; // Base64 فقط، بلا بادئة data:URL
        if(!text) text = labT("حلّل الرسم المرفق وحُلّه.","Analyze the attached drawing and solve it.");
    }
    try{
        const reply = await callGeminiProxy("pad", { text, image });
        out.innerHTML = `<b>🧑‍🏫 ${labT("حل المعلّم:","Teacher's solution:")}</b><div class="pad-ai-text">${escapeHtml(reply).replace(/\n/g,"<br>")}</div>`;
    }catch(e){
        console.error("[خُطى] فشل تحليل الدفتر:", e);
        const limitMsg = getAiLimitErrorMessage(e);
        if(e.code === "AUTH_REQUIRED"){
            out.innerHTML = buildAiAuthPromptHtml(limitMsg);
        } else {
            out.innerHTML = limitMsg || (hasDrawing && !rawText
                ? labT("😕 تعذّر إرسال الرسم — جرّب كتابة المسألة نصاً في خانة الكتابة","😕 Couldn't send the drawing — try typing the problem instead")
                : labT("😕 تعذّر الوصول للذكاء الاصطناعي الآن — جرّب بعد قليل","😕 Couldn't reach the AI — try again shortly"));
        }
    }
}

/* ============================================================
   ج) توليد اختبار محاكي من ملفات الطالب (كمي/لفظي)
   ============================================================ */
let customExamFiles = { quant:"", verbal:"" };

async function readStudyFile(input, kind){
    const file = input.files && input.files[0];
    const label = document.getElementById("customexam-" + kind + "-name");
    if(!file){ customExamFiles[kind] = ""; label.textContent = ""; return; }
    label.textContent = "⏳ " + file.name;
    try{
        let text = "";
        if(/\.pdf$/i.test(file.name)){
            text = await extractPdfText(file);
        } else {
            text = await file.text();
        }
        // نقصّ النص لحد آمن يناسب حجم الطلب — كافٍ جداً لتوليد أسئلة متنوعة
        customExamFiles[kind] = text.slice(0, 16000);
        label.textContent = "✅ " + file.name + ` (${Math.min(text.length,16000).toLocaleString()} ${labT("حرف","chars")})`;
    }catch(e){
        console.error("[خُطى] فشل قراءة الملف:", e);
        customExamFiles[kind] = "";
        label.textContent = "❌ " + labT("تعذّرت القراءة — جرّب ملف txt أو pdf نصّي (غير مصوَّر)","Read failed — try a text-based txt/pdf");
    }
}
// تحميل pdf.js كسولاً من CDN عند أول حاجة فقط
let pdfjsReady = null;
function loadPdfJs(){
    if(pdfjsReady) return pdfjsReady;
    pdfjsReady = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            resolve(window.pdfjsLib);
        };
        s.onerror = () => reject(new Error("pdfjs load failed"));
        document.head.appendChild(s);
    });
    return pdfjsReady;
}
async function extractPdfText(file){
    const pdfjs = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    let all = "";
    const maxPages = Math.min(doc.numPages, 40);
    for(let p = 1; p <= maxPages && all.length < 20000; p++){
        const page = await doc.getPage(p);
        const tc = await page.getTextContent();
        all += tc.items.map(i => i.str).join(" ") + "\n";
    }
    if(all.trim().length < 60) throw new Error("pdf has no extractable text (scanned?)");
    return all;
}

/* ============================================================
   اشرح ملفي — يرفع الطالب ملف مادته فيُفحَص ثم يُشرح بالكامل، مع إمكانية
   سؤال المعلّم عن أي شيء فيه بعد ذلك.
   ------------------------------------------------------------
   ⚠️ شرط "مواد دراسية حقيقية فقط" مفروض على الخادم لا هنا (انظر
   FILE_EXPLAIN_SYSTEM_PROMPT في gemini-proxy.js): المتصفح يرسل نص الملف
   فقط، ولا يملك أي وسيلة لتجاوز الشرط. ما نفعله هنا هو عرض سبب الرفض للطالب
   برسالة مفهومة، لا اتخاذ قرار القبول.
   ============================================================ */
let fileExplainState = { text: "", name: "", data: null };

// نص شرح مراحل الفحص — يتبدّل أثناء الانتظار فيبقى الطالب مطمئناً أن العمل جارٍ
const SCAN_STEPS_AR = ["نقرأ صفحات ملفك…", "نتأكد أنه محتوى دراسي…", "نستخرج المفاهيم الأساسية…", "نرتّبها كدرس متسلسل…", "نجهّز الأمثلة والأخطاء الشائعة…"];
const SCAN_STEPS_EN = ["Reading your pages…", "Checking it's study material…", "Extracting key concepts…", "Ordering them into a lesson…", "Preparing examples and pitfalls…"];

let scanTimer = null;
function startScanAnimation(stageId, captionId){
    const stage = document.getElementById(stageId);
    const caption = document.getElementById(captionId);
    if(!stage) return;
    stage.style.display = "flex";
    const list = currentLang === "ar" ? SCAN_STEPS_AR : SCAN_STEPS_EN;
    let i = 0;
    if(caption) caption.textContent = list[0];
    clearInterval(scanTimer);
    scanTimer = setInterval(() => {
        i = (i + 1) % list.length;
        if(!caption) return;
        caption.style.opacity = "0";
        setTimeout(() => { caption.textContent = list[i]; caption.style.opacity = "1"; }, 200);
    }, 2200);
}
function stopScanAnimation(stageId){
    clearInterval(scanTimer);
    scanTimer = null;
    const stage = document.getElementById(stageId);
    if(stage) stage.style.display = "none";
}

async function onFileExplainPicked(event){
    const file = event.target.files && event.target.files[0];
    if(!file) return;
    const label = document.getElementById("filex-file-label");
    const btn = document.getElementById("filex-analyze-btn");
    label.textContent = "⏳ " + labT("نقرأ الملف…","Reading the file…");
    btn.style.display = "none";
    try{
        const text = file.name.toLowerCase().endsWith(".pdf")
            ? await extractPdfText(file)
            : await file.text();
        if(!text || text.trim().length < 80) throw new Error("too short");
        fileExplainState = { text, name: file.name, data: null };
        label.textContent = `📄 ${file.name} — ${labT(`${text.length.toLocaleString("en")} حرفاً جاهزة للفحص`, `${text.length.toLocaleString("en")} characters ready`)}`;
        btn.style.display = "";
    }catch(e){
        console.error("[خُطى] تعذّرت قراءة الملف:", e);
        fileExplainState = { text: "", name: "", data: null };
        label.textContent = "❌ " + labT("تعذّرت القراءة — جرّب ملف txt أو PDF نصّي (غير مصوَّر)","Read failed — try a txt or text-based PDF");
    }
}

// رسائل رفض واضحة لكل سبب يرجعه الخادم — لا نعرض رمز السبب الخام للطالب
function fileRejectionMessage(reason, note){
    const map = {
        not_study:  labT("هذا الملف لا يبدو مادة دراسية 📚 — ارفع ملزمة أو محاضرة أو ملخص مادة.",
                         "This doesn't look like study material 📚 — upload a lecture, summary, or course file."),
        harmful:    labT("لا أستطيع شرح هذا الملف لأنه يحتوي محتوى غير مناسب أو بيانات شخصية حسّاسة.",
                         "I can't explain this file — it contains unsuitable content or sensitive personal data."),
        misleading: labT("محتوى هذا الملف يبدو غير دقيق علمياً، ولا أريد أن أبني عليه شرحاً يضلّلك.",
                         "This file looks scientifically inaccurate — I won't build an explanation on it."),
        unreadable: labT("النص المستخرج غير واضح — تأكد أن الـPDF نصّي وليس صوراً ممسوحة.",
                         "The extracted text is unclear — make sure the PDF is text, not scanned images."),
    };
    return (map[reason] || labT("تعذّر قبول هذا الملف.","This file couldn't be accepted.")) + (note ? " " + note : "");
}

async function analyzeUploadedFile(){
    if(!fileExplainState.text){ showToast(labT("ارفع ملفاً أولاً","Upload a file first")); return; }
    const btn = document.getElementById("filex-analyze-btn");
    const upload = document.getElementById("filex-upload");
    const result = document.getElementById("filex-result");
    btn.disabled = true;
    upload.style.display = "none";
    result.style.display = "none";
    startScanAnimation("filex-scan", "filex-scan-caption");

    try{
        const reply = await callGeminiProxy("fileExplain", { text: fileExplainState.text });
        const data = extractJson(reply);
        stopScanAnimation("filex-scan");

        if(!data || data.accepted !== true){
            upload.style.display = "";
            document.getElementById("filex-file-label").innerHTML =
                `<span class="filex-rejected">⛔ ${escapeHtml(fileRejectionMessage(data && data.reject_reason, data && data.rejection_note))}</span>`;
            document.getElementById("filex-analyze-btn").style.display = "none";
            fileExplainState.text = "";
            btn.disabled = false;
            return;
        }

        fileExplainState.data = data;
        renderFileExplanation(data);
        result.style.display = "";
        document.getElementById("filex-answers").innerHTML = "";
    }catch(e){
        console.error("[خُطى] فشل شرح الملف:", e);
        stopScanAnimation("filex-scan");
        upload.style.display = "";
        const limitMsg = getAiLimitErrorMessage(e);
        const label = document.getElementById("filex-file-label");
        if(e.code === "AUTH_REQUIRED") label.innerHTML = buildAiAuthPromptHtml(limitMsg);
        else label.textContent = limitMsg || labT("😕 تعذّر الشرح — حاول مرة أخرى","😕 Explanation failed — try again");
    }
    btn.disabled = false;
}

function renderFileExplanation(d){
    const esc = escapeHtml;
    const sections = Array.isArray(d.sections) ? d.sections : [];
    const terms = Array.isArray(d.key_terms) ? d.key_terms : [];
    const mistakes = Array.isArray(d.common_mistakes) ? d.common_mistakes : [];

    let html = `<div class="filex-head">
        <div class="filex-badge"><i class="fa-solid fa-circle-check"></i> ${labT("محتوى دراسي مقبول","Accepted study material")}</div>
        <h3>${esc(d.subject || labT("ملفك","Your file"))}</h3>
        ${d.level ? `<span class="filex-level">${esc(d.level)}</span>` : ""}
        ${d.summary ? `<p class="filex-summary">${esc(d.summary)}</p>` : ""}
    </div>`;

    sections.forEach((s, i) => {
        const pts = (Array.isArray(s.points) ? s.points : []).map(p => `<li>${esc(p)}</li>`).join("");
        html += `<div class="filex-section" style="--i:${i}">
            <h4><span class="filex-num">${i + 1}</span> ${esc(s.title || "")}</h4>
            ${pts ? `<ul>${pts}</ul>` : ""}
            ${s.example ? `<div class="filex-example"><b>${labT("مثال","Example")}:</b> ${esc(s.example)}</div>` : ""}
        </div>`;
    });

    if(terms.length){
        html += `<div class="filex-block"><h4><i class="fa-solid fa-book"></i> ${labT("مصطلحات مهمة","Key terms")}</h4><dl class="filex-terms">` +
            terms.map(t => `<dt>${esc(t.term || "")}</dt><dd>${esc(t.meaning || "")}</dd>`).join("") + `</dl></div>`;
    }
    if(mistakes.length){
        html += `<div class="filex-block filex-warn"><h4><i class="fa-solid fa-triangle-exclamation"></i> ${labT("أخطاء شائعة","Common mistakes")}</h4><ul>` +
            mistakes.map(m => `<li>${esc(m)}</li>`).join("") + `</ul></div>`;
    }
    if(d.study_tip){
        html += `<div class="filex-block filex-tip"><h4><i class="fa-solid fa-lightbulb"></i> ${labT("نصيحة للمذاكرة","Study tip")}</h4><p>${esc(d.study_tip)}</p></div>`;
    }
    document.getElementById("filex-result-body").innerHTML = html;
}

async function askAboutFile(){
    const input = document.getElementById("filex-question");
    const q = input.value.trim();
    if(!q) return;
    if(!fileExplainState.text){ showToast(labT("ارفع ملفاً أولاً","Upload a file first")); return; }
    const box = document.getElementById("filex-answers");
    input.value = "";

    const row = document.createElement("div");
    row.className = "filex-qa";
    row.innerHTML = `<div class="filex-q">${escapeHtml(q)}</div><div class="filex-a filex-a-loading"><span class="board-chalk-dot"></span>${labT("المعلّم يراجع ملفك…","Checking your file…")}</div>`;
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;

    try{
        const reply = await callGeminiProxy("fileQA", { text: q, fileText: fileExplainState.text });
        row.querySelector(".filex-a").className = "filex-a";
        row.querySelector(".filex-a").textContent = reply;
    }catch(e){
        console.error("[خُطى] فشل سؤال الملف:", e);
        const a = row.querySelector(".filex-a");
        a.className = "filex-a";
        const limitMsg = getAiLimitErrorMessage(e);
        if(e.code === "AUTH_REQUIRED") a.innerHTML = buildAiAuthPromptHtml(limitMsg);
        else a.textContent = limitMsg || labT("😕 تعذّرت الإجابة — حاول مرة أخرى","😕 Couldn't answer — try again");
    }
    box.scrollTop = box.scrollHeight;
}

function resetFileExplain(){
    fileExplainState = { text: "", name: "", data: null };
    document.getElementById("filex-input").value = "";
    document.getElementById("filex-file-label").textContent = "";
    document.getElementById("filex-analyze-btn").style.display = "none";
    document.getElementById("filex-result").style.display = "none";
    document.getElementById("filex-answers").innerHTML = "";
    document.getElementById("filex-upload").style.display = "";
}

async function generateCustomExam(){
    const qCount = parseInt(document.getElementById("customexam-qcount").value) || 10;
    const hasQ = !!customExamFiles.quant, hasV = !!customExamFiles.verbal;
    if(!hasQ && !hasV){ showToast(labT("ارفع ملفاً واحداً على الأقل (كمي أو لفظي)","Upload at least one file")); return; }
    const btn = document.getElementById("customexam-generate-btn");
    const status = document.getElementById("customexam-status");
    btn.disabled = true;
    status.textContent = "";
    // نفس الأنيميشن المستخدم في "اشرح ملفي" — الانتظار هنا قد يبلغ دقيقة،
    // فالحركة تُطمئن الطالب أن العمل جارٍ بدل شاشة ساكنة
    startScanAnimation("customexam-scan", "customexam-scan-caption");
    const pool = { quant:[], verbal:[] };
    try{
        const jobs = [];
        if(hasQ) jobs.push(["quant", customExamFiles.quant]);
        if(hasV) jobs.push(["verbal", customExamFiles.verbal]);
        for(const [kind, content] of jobs){
            const label = kind === "quant" ? "كمية (رياضيات/حساب/هندسة/تحليل)" : "لفظية (استيعاب/تناظر/إكمال/معنى)";
            const reply = await callGeminiProxy("exam",
                { text: `ولّد ${qCount} سؤالاً من نوع أسئلة القدرات ال${label} من هذا المحتوى:\n\n${content}`, section: kind });
            const data = extractJson(reply);
            const valid = (data.questions || []).filter(q =>
                q && typeof q.text === "string" && Array.isArray(q.choices) && q.choices.length === 4 &&
                Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3
            ).map((q, i) => ({
                id: "cf_" + kind + "_" + i + "_" + Date.now().toString(36),
                text: q.text, choices: q.choices.map(String), correct: q.correct,
                explain: typeof q.explain === "string" ? q.explain : "",
                source: labT("مولَّد من ملفك 📄","Generated from your file 📄"),
            }));
            pool[kind] = valid;
        }
        const total = pool.quant.length + pool.verbal.length;
        if(total === 0) throw new Error("no valid questions");
        localStorage.setItem("khuta_custom_exam_pool", JSON.stringify(pool));
        stopScanAnimation("customexam-scan");
        status.innerHTML = `✅ ${labT(`جاهز! تولّد ${total} سؤالاً (${pool.quant.length} كمي، ${pool.verbal.length} لفظي)`, `Ready! ${total} questions generated`)}`;
        document.getElementById("customexam-start-btn").style.display = "inline-flex";
    }catch(e){
        console.error("[خُطى] فشل توليد الاختبار:", e);
        stopScanAnimation("customexam-scan");
        const limitMsg = getAiLimitErrorMessage(e);
        if(e.code === "AUTH_REQUIRED"){
            status.innerHTML = buildAiAuthPromptHtml(limitMsg);
        } else {
            status.textContent = limitMsg || labT("😕 تعذّر التوليد — تأكد أن الملف نصّي واضح وجرّب مجدداً","😕 Generation failed — make sure the file is clear text and retry");
        }
    }
    btn.disabled = false;
}
function startCustomExam(){
    let pool = null;
    try{ pool = JSON.parse(localStorage.getItem("khuta_custom_exam_pool") || "null"); }catch(e){}
    const quantPool = shuffleArray(pool && pool.quant || []);
    const verbalPool = shuffleArray(pool && pool.verbal || []);
    const totalQ = quantPool.length + verbalPool.length;
    if(totalQ === 0){
        showToast(labT("ولّد الاختبار من ملفاتك أولاً","Generate the exam from your files first")); return;
    }
    // نفس بنية "5 أقسام" الحقيقية إن كان البنك كبيراً بما يكفي ليكون لها معنى
    // (على الأقل ~3 أسئلة لكل قسم)، وإلا قسم واحد فقط لتفادي أقسام شبه فارغة
    const sectionCount = totalQ >= 15 ? EXAM_SECTION_COUNT : 1;
    const sections = splitIntoSections(quantPool, verbalPool, sectionCount);
    examState = buildSectionedExamState({ sections, scaledDown:false }, "custom", false, true);
    openExamOverlay();
}

/* ============================================================
   د) سجل الاختبارات السابقة
   ============================================================ */
const EXAM_HISTORY_KEY = "khuta_exam_history";
function getExamHistory(){ try{ return JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY) || "[]"); }catch(e){ return []; } }
function recordExamAttempt(state){
    if(!state || !state.score) return;
    const wrong = state.questions
        .filter(q => state.answers[q.id] !== q.correct)
        .map(q => ({
            text: q.text, choices: q.choices, correct: q.correct,
            chosen: (q.id in state.answers) ? state.answers[q.id] : null,
            type: q.type, explain: q.explain || "", source: q.source || "",
        }));
    const list = getExamHistory();
    list.unshift({
        id: Date.now().toString(36),
        date: new Date().toISOString(),
        type: state.type,
        fromFiles: !!state.fromFiles,
        score: state.score,
        wrong,
    });
    while(list.length > 30) list.pop();
    try{ localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(list)); }catch(e){ /* التخزين ممتلئ — نتجاهل بصمت */ }
    renderExamHistory();
}
function examTypeLabel(a){
    if(a.fromFiles || a.type === "custom") return labT("من ملفاتك 📄","From your files 📄");
    return a.type === "full" ? labT("قدرات كامل","Full GAT") : a.type === "quant" ? labT("كمي","Quant") : labT("لفظي","Verbal");
}
function renderExamHistory(){
    const box = document.getElementById("exam-history-list");
    if(!box) return;
    const list = getExamHistory();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub">${labT("لم تختبر بعد — أول اختبار لك سيُسجَّل هنا تلقائياً","No attempts yet — your first exam will be recorded here")}</div>`;
        return;
    }
    box.innerHTML = list.map(a => `
        <div class="examhist-row" id="examhist-${a.id}">
            <button type="button" class="examhist-head" onclick="toggleExamHistRow('${a.id}')">
                <span class="examhist-pct" style="color:${a.score.pct >= 70 ? 'var(--teal)' : a.score.pct >= 50 ? 'var(--gold)' : 'var(--rose)'}">${a.score.pct}%</span>
                <span class="examhist-meta">
                    <b>${examTypeLabel(a)}</b>
                    <span>${new Date(a.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US', {weekday:"short", day:"numeric", month:"short"})} · ${a.score.correctCount}/${a.score.total} · ${labT("أخطاء:","Wrong:")} ${a.wrong.length}</span>
                </span>
                <i class="fa-solid fa-chevron-down examhist-chev"></i>
            </button>
            <div class="examhist-body">
                <div class="examhist-body-inner">
                    ${a.wrong.length === 0
                        ? `<div class="card-sub">🎉 ${labT("لا أخطاء في هذه المحاولة!","No mistakes this attempt!")}</div>`
                        : a.wrong.map(w => `
                        <div class="examhist-q">
                            <div class="examhist-qtext">${escapeHtml(w.text)}</div>
                            <div class="examhist-qrow wrong">✗ ${labT("إجابتك:","Your answer:")} ${w.chosen === null ? labT("(لم تُجب)","(unanswered)") : escapeHtml(String(w.choices[w.chosen]))}</div>
                            <div class="examhist-qrow right">✓ ${labT("الصحيحة:","Correct:")} ${escapeHtml(String(w.choices[w.correct]))}</div>
                            ${w.explain ? `<div class="examhist-qrow expl">💡 ${escapeHtml(w.explain)}</div>` : ""}
                        </div>`).join("")}
                    <button type="button" class="btn-ghost examhist-del" onclick="deleteExamAttempt('${a.id}')"><i class="fa-solid fa-trash"></i> ${labT("حذف المحاولة","Delete attempt")}</button>
                </div>
            </div>
        </div>`).join("");
}
function toggleExamHistRow(id){
    document.getElementById("examhist-" + id).classList.toggle("open");
}
function deleteExamAttempt(id){
    localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(getExamHistory().filter(a => a.id !== id)));
    renderExamHistory();
}

/* ============================================================
   هـ) خطط متعددة بأسماء (لقطات كاملة) + و) الروتين الأسبوعي
   ============================================================ */
// نفس مجموعة مفاتيح الخطة المعتمدة في "البدء من جديد" — هي تعريف "الخطة" الرسمي في التطبيق
const PLAN_SNAPSHOT_KEYS = [
    "khuta_config", "khuta_plan_days", "khuta_plan_start", "khuta_session_minutes",
    "khuta_task_status", "khuta_task_status_date", "khuta_xp_awarded_today",
    "khuta_completed_dates", "khuta_missed_days_count", "khuta_postponed_dates", "khuta_redday_tracking_start",
    "khuta_today_scale", "khuta_streak", "khuta_streak_last",
    "khuta_checkin_verbal", "khuta_checkin_quant", "khuta_quant_share",
    "khuta_last_session_minutes", "khuta_custom_tasks", "khuta_start_section",
    "khuta_exam_date", "khuta_autobreak_minutes", "khuta_short_break_limit",
    "khuta_week_routine", "khuta_excluded_dates",
];
const PLANS_STORE_KEY = "khuta_saved_plans";
function getSavedPlans(){ try{ return JSON.parse(localStorage.getItem(PLANS_STORE_KEY) || "[]"); }catch(e){ return []; } }

// ملاحظة: openPlansOverlay()/closePlansOverlay() القديمتان أُزيلتا — نافذتهما
// المستقلة دُمجت بالكامل داخل خطوتي "الخطط المحفوظة" و"الروتين الأسبوعي"
// ضمن المعالج التدريجي (انظر openSetupOverlay وgoToWizStep أعلى الملف).

function saveCurrentPlanAs(){
    const name = (document.getElementById("plan-name-input").value || "").trim();
    if(!name){ showToast(labT("اكتب اسماً للخطة أولاً","Name the plan first")); return; }
    const snapshot = {};
    PLAN_SNAPSHOT_KEYS.forEach(k => {
        const v = localStorage.getItem(k);
        if(v !== null) snapshot[k] = v;
    });
    const list = getSavedPlans().filter(p => p.name !== name); // نفس الاسم = تحديث
    list.unshift({ id: Date.now().toString(36), name, date: new Date().toISOString(), snapshot });
    while(list.length > 8) list.pop();
    try{ localStorage.setItem(PLANS_STORE_KEY, JSON.stringify(list)); }
    catch(e){ showToast(labT("مساحة التخزين ممتلئة","Storage full")); return; }
    document.getElementById("plan-name-input").value = "";
    showToast(labT("💾 حُفظت الخطة: ","💾 Plan saved: ") + name);
    renderSavedPlansList();
}
function applySavedPlan(id){
    const p = getSavedPlans().find(x => x.id === id);
    if(!p) return;
    // نمسح مفاتيح الخطة الحالية ثم نكتب اللقطة — دون أي location.reload
    // (الدرس الموثَّق: إعادة التحميل كانت تُظهر شاشة الدخول خطأً أحياناً)
    PLAN_SNAPSHOT_KEYS.forEach(k => localStorage.removeItem(k));
    Object.entries(p.snapshot).forEach(([k, v]) => localStorage.setItem(k, v));
    // نفس تسلسل إعادة البناء المجرَّب في "البدء من جديد"
    buildScheduleTable();
    renderProgress();
    renderGamification();
    renderBadges();
    switchTab("dashboard");
    renderRoutineEditor();
    renderExcludedDates();
    updateRoutinePressure();
    // إغلاق مباشر للمعالج التدريجي نفسه (وليس النافذة المنفصلة القديمة التي
    // حُذفت بعد دمج "خططي والروتين" داخل المعالج) — آمن دائماً هنا لأن
    // الخطة أصبحت فعّالة للتو (khuta_plan_days مضبوط من اللقطة أعلاه)
    document.getElementById("setup-overlay").style.display = "none";
    showToast(labT("📚 انتقلت للخطة: ","📚 Switched to plan: ") + p.name);
}
function deleteSavedPlan(id){
    localStorage.setItem(PLANS_STORE_KEY, JSON.stringify(getSavedPlans().filter(p => p.id !== id)));
    renderSavedPlansList();
}
function renderSavedPlansList(){
    const box = document.getElementById("plans-saved-list");
    if(!box) return;
    const list = getSavedPlans();
    if(list.length === 0){
        box.innerHTML = `<div class="card-sub">${labT("لا خطط محفوظة بعد — احفظ خطتك الحالية باسم لتعود لها متى شئت","No saved plans yet")}</div>`;
        return;
    }
    box.innerHTML = list.map(p => `
        <div class="plan-row">
            <div class="plan-row-info">
                <b>${escapeHtml(p.name)}</b>
                <span>${new Date(p.date).toLocaleDateString(currentLang==='ar'?'ar-SA':'en-US')} · ${p.snapshot.khuta_plan_days ? p.snapshot.khuta_plan_days + " " + labT("يوم","days") : ""}</span>
            </div>
            <button type="button" class="btn btn-sm btn-outline" onclick="applySavedPlan('${p.id}')">${labT("تفعيل","Activate")}</button>
            <button type="button" class="btn-ghost pad-saved-del" onclick="deleteSavedPlan('${p.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>`).join("");
}

/* ---------- الروتين الأسبوعي + التواريخ المستثناة + مؤشر الضغط ---------- */
const ROUTINE_KEY = "khuta_week_routine";       // مصفوفة 7 قيم: 0=عادي، 1=أخف، 2=إجازة (الفهرس 0=الأحد)
const EXCLUDED_KEY = "khuta_excluded_dates";     // مصفوفة تواريخ YYYY-MM-DD (سفر/ظروف)
function getWeekRoutine(){
    try{
        const r = JSON.parse(localStorage.getItem(ROUTINE_KEY) || "null");
        if(Array.isArray(r) && r.length === 7) return r;
    }catch(e){}
    return [0,0,0,0,0,0,0];
}
function getExcludedDates(){ try{ return JSON.parse(localStorage.getItem(EXCLUDED_KEY) || "[]"); }catch(e){ return []; } }

function renderRoutineEditor(){
    const box = document.getElementById("routine-days-grid");
    if(!box) return;
    const routine = getWeekRoutine();
    const days = currentLang === "ar"
        ? ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"]
        : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const modes = [
        { v:0, label: labT("عادي","Normal"),  cls:"mode-normal" },
        { v:1, label: labT("أخف","Lighter"),  cls:"mode-light" },
        { v:2, label: labT("إجازة","Off"),    cls:"mode-off" },
    ];
    box.innerHTML = days.map((d, i) => `
        <div class="routine-day">
            <div class="routine-day-name">${d}</div>
            <div class="routine-day-modes">
                ${modes.map(m => `<button type="button" class="routine-mode ${m.cls} ${routine[i]===m.v?'active':''}" onclick="setRoutineDay(${i},${m.v})">${m.label}</button>`).join("")}
            </div>
        </div>`).join("");
}
function setRoutineDay(dayIdx, mode){
    const r = getWeekRoutine();
    r[dayIdx] = mode;
    localStorage.setItem(ROUTINE_KEY, JSON.stringify(r));
    renderRoutineEditor();
    updateRoutinePressure();
    updateTodayRoutinePill();
}
function addExcludedDate(){
    const val = document.getElementById("excluded-date-input").value;
    if(!val) return;
    const list = getExcludedDates();
    if(!list.includes(val)) list.push(val);
    list.sort();
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(list));
    document.getElementById("excluded-date-input").value = "";
    renderExcludedDates();
    updateRoutinePressure();
}
function removeExcludedDate(d){
    localStorage.setItem(EXCLUDED_KEY, JSON.stringify(getExcludedDates().filter(x => x !== d)));
    renderExcludedDates();
    updateRoutinePressure();
}
function renderExcludedDates(){
    const box = document.getElementById("excluded-dates-list");
    if(!box) return;
    const list = getExcludedDates();
    box.innerHTML = list.length === 0
        ? `<span class="card-sub">${labT("لا تواريخ مستثناة","No excluded dates")}</span>`
        : list.map(d => `<span class="excluded-chip">${d} <button type="button" onclick="removeExcludedDate('${d}')" aria-label="حذف">×</button></span>`).join("");
}
/* مؤشر الضغط: يقارن أيام الخطة المتبقية بأيام المذاكرة الفعلية المتاحة حتى
   موعد الاختبار (بعد خصم أيام الإجازة الأسبوعية والتواريخ المستثناة،
   واحتساب "الأخف" نصف يوم) — ويخبر الطالب بصراحة: مضغوط / متوازن / مرتاح */
function computeRoutinePressure(){
    const routine = getWeekRoutine();
    const excluded = new Set(getExcludedDates());
    const planDays = parseInt(localStorage.getItem("khuta_plan_days") || "0");
    const startStr = localStorage.getItem("khuta_plan_start");
    const examStr = localStorage.getItem("khuta_exam_date");
    const now = (typeof khutaNow === "function") ? khutaNow() : new Date();
    let daysDone = 0;
    if(startStr){
        daysDone = Math.max(0, Math.floor((now - new Date(startStr)) / 86400000));
    }
    const remainingPlanDays = Math.max(0, planDays - daysDone);
    if(!examStr || !planDays){
        return { ok:false, remainingPlanDays };
    }
    const exam = new Date(examStr + "T00:00:00");
    let effective = 0, calendar = 0;
    const cur = new Date(now); cur.setHours(0,0,0,0);
    while(cur < exam && calendar < 400){
        const iso = cur.toISOString().slice(0,10);
        const mode = excluded.has(iso) ? 2 : routine[cur.getDay()];
        if(mode === 0) effective += 1;
        else if(mode === 1) effective += 0.5;
        cur.setDate(cur.getDate() + 1);
        calendar++;
    }
    effective = Math.round(effective * 2) / 2;
    // كم يوماً من أيام الأسبوع السبعة إجازة كاملة في الروتين الثابت نفسه
    // (بمعزل عن التواريخ المستثناة المؤقتة) — يُستخدم لرسائل الحالات القصوى
    const offDaysInRoutine = routine.filter(m => m === 2).length;

    let level, msg;
    if(offDaysInRoutine === 7){
        // الحالة القصوى: كل أيام الأسبوع إجازة في الروتين الثابت — رسالة
        // ساخنة صريحة بدل رسالة "مضغوط" العامة، لأن الرقم وحده (0 فعلياً)
        // لا يوصل حجم المفارقة بنفس وضوح جملة مباشرة
        level = "tight";
        msg = labT("🤨 خطتك كلها إجازة! سبعة أيام إجازة في نفس الأسبوع؟ يعطيك العافية بس... متى بالضبط ناوي تذاكر؟ رجّع يوماً واحداً على الأقل عادي.",
                   "🤨 Your whole week is off?! Seven vacation days in the same week — respect the hustle, but... when exactly do you plan to study? Bring back at least one normal day.");
    } else if(remainingPlanDays === 0){
        level = "ok"; msg = labT("خطتك مكتملة تقريباً 🎉","Plan nearly complete 🎉");
    } else if(offDaysInRoutine >= 4){
        // أغلب الأسبوع إجازة (4 أيام فأكثر من 7) — تنبيه واضح لكن أهدأ من
        // الحالة القصوى أعلاه، بغضّ النظر عن نتيجة حساب الأيام الفعلية
        level = "tight";
        msg = labT(`⚠️ ${offDaysInRoutine} من أيام أسبوعك إجازة — هذا كثير. تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} فعلياً؛ فكّر تحوّل بعضها لـ"أخف" بدل الإجازة الكاملة`,
                   `⚠️ ${offDaysInRoutine} of your 7 days are off — that's a lot. You need ${remainingPlanDays} study days but only have ${effective}; consider switching some to "Lighter" instead of fully off`);
    } else if(effective < remainingPlanDays){
        level = "tight";
        msg = labT(`مضغوط: تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} فعلياً قبل الاختبار — قلّل الإجازات أو خفّف أقل`,
                   `Tight: need ${remainingPlanDays} study days but only ${effective} available`);
    }
    else if(effective > remainingPlanDays * 1.6){
        level = "loose";
        msg = labT(`مرتاح جداً: تحتاج ${remainingPlanDays} يوماً ولديك ${effective} — لا بأس، لكن لا تخفف أكثر من اللازم`,
                   `Very relaxed: need ${remainingPlanDays}, have ${effective}`);
    }
    else{
        level = "ok";
        msg = labT(`متوازن: تحتاج ${remainingPlanDays} يوم مذاكرة ولديك ${effective} متاحة قبل الاختبار 👌`,
                   `Balanced: need ${remainingPlanDays}, have ${effective} 👌`);
    }
    return { ok:true, level, msg, needed: remainingPlanDays, available: effective };
}
function updateRoutinePressure(){
    const box = document.getElementById("routine-pressure");
    if(!box) return;
    const p = computeRoutinePressure();
    if(!p.ok){
        box.className = "routine-pressure";
        box.innerHTML = labT("حدّد موعد اختبارك وخطتك أولاً ليظهر مؤشر الضغط هنا","Set your exam date and plan first to see the pressure meter");
        return;
    }
    box.className = "routine-pressure level-" + p.level;
    const fill = Math.min(100, Math.round((p.needed / Math.max(p.available, 0.5)) * 100));
    box.innerHTML = `
        <div class="routine-pressure-msg">${p.msg}</div>
        <div class="routine-pressure-bar"><div style="width:${fill}%"></div></div>`;
}
// شارة صغيرة على لوحة اليوم حين يكون اليوم "أخف" أو "إجازة" حسب روتينك
function updateTodayRoutinePill(){
    const pill = document.getElementById("today-routine-pill");
    if(!pill) return;
    const now = (typeof khutaNow === "function") ? khutaNow() : new Date();
    const iso = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,10);
    const mode = getExcludedDates().includes(iso) ? 2 : getWeekRoutine()[now.getDay()];
    if(mode === 0){ pill.style.display = "none"; return; }
    pill.style.display = "inline-flex";
    pill.textContent = mode === 2 ? labT("🏖️ اليوم إجازة حسب روتينك","🏖️ Off day per your routine")
                                  : labT("🍃 اليوم أخف حسب روتينك","🍃 Lighter day per your routine");
}

/* ---------- تهيئة الوحدة عند الإقلاع ---------- */
window.addEventListener("load", () => {
    // متأخرة قليلاً بعد إقلاع التطبيق الأساسي
    setTimeout(() => {
        renderExamHistory();
        updateTodayRoutinePill();
        const pool = localStorage.getItem("khuta_custom_exam_pool");
        if(pool){ const b = document.getElementById("customexam-start-btn"); if(b) b.style.display = "inline-flex"; }
    }, 400);
});

/* ============================================================
   41) الوصولية — دعم لوحة المفاتيح لكل العناصر القابلة للنقر المبنية على
   div/span (قوائم التنقّل، رقائق الاختيار، عيّنات الألوان) بدل <button>
   ------------------------------------------------------------
   هذه العناصر أُضيف لها role="button" و tabindex="0" في HTML (بدل تحويلها
   فعلياً إلى <button> تفادياً لأي كسر بصري في تنسيقاتها الحالية القائمة
   على div/span) — هذا المستمع الوحيد يفعّل تشغيلها بمفتاحي Enter/Space
   كأي زر حقيقي، لأي عنصر كهذا حالياً أو يُضاف مستقبلاً بنفس النمط، دون
   حاجة لتكرار معالج لكل عنصر على حدة.
   ============================================================ */
document.addEventListener("keydown", function(e){
    if(e.key !== "Enter" && e.key !== " ") return;
    const el = e.target;
    if(el && el.getAttribute && el.getAttribute("role") === "button" && el.hasAttribute("onclick")){
        e.preventDefault(); // تفادي تمرير الصفحة عند الضغط على مسطرة المسافة
        el.click();
    }
});

/* ============================================================
   نهاية آخر ملف سكربت — نقطة "اكتمل تحميل التطبيق"
   ------------------------------------------------------------
   هنا فقط نضمن أن كل تعريفات الملفات الاثني عشر نُفِّذت فعلاً. عندها نُعلم
   مستمع المصادقة (المُسجَّل مبكراً في js/01-core-config.js) أنه يستطيع
   المعالجة مباشرة، ونصرف أي أحداث وصلت قبل ذلك وحُفظت في الطابور.

   ⚠️ لا تنقل هذا الاستدعاء إلى ملف أسبق: هذا بالضبط سبب الخلل الذي ظهر في
   الإنتاج بعد التقسيم (حدث تسجيل دخول يصل قبل تعريف الدوال التي يحتاجها).
   ============================================================ */
if(typeof flushPendingAuthEvents === "function") flushPendingAuthEvents();
