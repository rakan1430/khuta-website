/* ============================================================
   31) نظام دعوة الأصدقاء
   ============================================================ */
const REFERRAL_XP_REWARD = 50;

function captureReferralParam(){
    const params = new URLSearchParams(location.search);
    const ref = params.get("ref");
    if(ref && ref.length > 10){ // فحص بسيط أنه يشبه UID فعلي
        localStorage.setItem("khuta_pending_referral", ref);
        localStorage.setItem("khuta_pending_referral_ts", Date.now().toString());
    }
}

async function recordPendingReferral(newUid){
    if(!sb) return;
    const referrerId = localStorage.getItem("khuta_pending_referral");
    const capturedAt = parseInt(localStorage.getItem("khuta_pending_referral_ts")) || 0;
    const REFERRAL_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 ساعة — قيمة قديمة أكثر من هذا تُعتبر ملغاة تلقائياً
    if(!referrerId || Date.now() - capturedAt > REFERRAL_EXPIRY_MS){
        localStorage.removeItem("khuta_pending_referral");
        localStorage.removeItem("khuta_pending_referral_ts");
        return;
    }
    if(referrerId === newUid) return; // لا يمكن دعوة نفسك
    try{
        const { error } = await sb.from("referrals").insert({ referrer_id: referrerId, referred_id: newUid });
        if(!error){
            awardXP(REFERRAL_XP_REWARD);
            showToast(currentLang==='ar' ? `🎁 +${REFERRAL_XP_REWARD} XP لانضمامك عبر دعوة صديق!` : `🎁 +${REFERRAL_XP_REWARD} XP for joining via a friend's invite!`);
        }
    }catch(e){ /* فشل تسجيل الدعوة ليس خطأً حرجاً — نتجاهله بصمت */ }
    localStorage.removeItem("khuta_pending_referral");
    localStorage.removeItem("khuta_pending_referral_ts");
}

async function checkAndClaimReferralRewards(){
    if(!sb) return;
    const session = getSession();
    if(!session) return;
    const { data, error } = await sb.from("referrals").select("id").eq("referrer_id", session.uid).eq("referrer_rewarded", false);
    if(error || !data || data.length === 0) return;
    let claimed = 0;
    for(const row of data){
        const { error: updateError } = await sb.from("referrals").update({ referrer_rewarded:true }).eq("id", row.id).eq("referrer_id", session.uid);
        if(!updateError) claimed++;
    }
    if(claimed > 0){
        awardXP(REFERRAL_XP_REWARD * claimed);
        showToast(currentLang==='ar'
            ? `🎉 انضم ${claimed} صديق عبر دعوتك — حصلت على ${REFERRAL_XP_REWARD * claimed} XP!`
            : `🎉 ${claimed} friend(s) joined via your invite — you earned ${REFERRAL_XP_REWARD * claimed} XP!`);
    }
}

function getReferralLink(){
    const session = getSession();
    if(!session) return null;
    return location.origin + location.pathname + "?ref=" + session.uid;
}

async function shareReferralLink(){
    const link = getReferralLink();
    if(!link){ showToast(currentLang==='ar' ? "سجّل دخولك أولاً لمشاركة رابط الدعوة" : "Sign in first to share your invite link"); return; }
    const shareText = currentLang==='ar'
        ? `جرّب خُطى — رفيقك الذكي لمذاكرة القدرات 🚀\n${link}`
        : `Try Khuta — your smart GAT study companion 🚀\n${link}`;
    if(navigator.share){
        try{ await navigator.share({ text: shareText }); return; }catch(e){ /* ألغى المستخدم المشاركة */ return; }
    }
    try{
        await navigator.clipboard.writeText(shareText);
        showToast(currentLang==='ar' ? "📋 نُسخ رابط الدعوة" : "📋 Invite link copied");
    }catch(e){
        prompt(currentLang==='ar' ? "انسخ رابط دعوتك:" : "Copy your invite link:", link);
    }
}

/* ============================================================
   32) الجولة التعريفية للمستخدم الجديد — تظهر مرة واحدة فقط بعد إكمال
   الإعداد لأول مرة، تسلّط الضوء على أهم الميزات التي قد لا يكتشفها
   الطالب بنفسه.
   ============================================================ */
const ONBOARDING_STEPS = [
    {
        id: "dash-card-overview-quests",
        titleAr: "مهام اليوم — نقطة البداية اليومية", titleEn: "Today's tasks — your daily starting point",
        textAr: "هذه القائمة تُبنى تلقائياً من خطتك: كمية محددة من كل مصدر (إيهاب، المنصف، المعاصر...) موزّعة على أيام خطتك بالتساوي. أنجزت مهمة؟ علّم عليها ✓ وتكسب XP فوراً. لو تأخّرت يوماً، الموقع يعيد توزيع الباقي عليك تلقائياً — لا تحتاج تحسب شيئاً بنفسك أبداً.",
        textEn: "This list is built automatically from your plan: a specific amount from each source, spread evenly across your plan's days. Check ✓ a task and earn XP instantly. Fall behind a day, and the site automatically redistributes what's left — you never have to calculate anything yourself.",
    },
    {
        id: "btn-plan-session",
        titleAr: "ابدأ جلستك من هنا", titleEn: "Start your session here",
        textAr: "المؤقت يقسّم وقتك تلقائياً بين اللفظي والكمي، ويتعلّم من أدائك مع الوقت ليُعدّل التوزيع بنفسه. استراحة تلقائية كل ساعة مذاكرة متواصلة، وعدد محدود من استراحات الخمس دقائق تختارها بنفسك.",
        textEn: "The timer auto-splits your time between verbal and quant, and learns from your pace over time to rebalance itself. Automatic breaks every hour of continuous study, plus a limited number of 5-minute breaks you control.",
    },
    {
        id: "chatbot-fab",
        titleAr: "مساعدك الذكي — متاح دائماً", titleEn: "Your AI assistant — always available",
        textAr: "علقت بسؤال كمي أو لفظي؟ اسأله وسيشرحه خطوة بخطوة على سبورة تفاعلية. أو اسأله أي شيء عن الموقع نفسه (\"كيف أحسب موزونتي؟\"، \"وين ألقى دليل التخصصات؟\") وسينقلك للمكان بنفسه مباشرة — جرّب واكتشف حتى الأوسمة السرّية 👀",
        textEn: "Stuck on a quant or verbal question? Ask, and it'll explain step-by-step on an interactive board. Or ask anything about the site itself (\"how do I calculate my weighted score?\") and it'll take you straight there — even the secret badges are worth asking about 👀",
    },
    {
        id: "btn-customize-dashboard",
        titleAr: "خصّص لوحتك", titleEn: "Customize your dashboard",
        textAr: "بدأناك بأبسط لوحة ممكنة. من هنا تقدر تفعّل خريطة النشاط، لوحة الصدارة، مسار التقدم، الأوسمة، أو المجتمع، أو تخفي ما لا تحتاجه.",
        textEn: "We started you with the simplest possible dashboard. From here you can turn on the activity heatmap, leaderboard, progress path, badges, or community — or hide what you don't need.",
    },
    {
        selector: '[data-tab="calculator"]',
        titleAr: "حاسبة الموزونة", titleEn: "Weighted score calculator",
        textAr: "احسب نسبتك الموزونة لأكثر من 30 جامعة سعودية، مع توضيح إن كان STEP مطلوباً لجامعتك أو تخصصك تحديداً.",
        textEn: "Calculate your weighted score for 30+ Saudi universities, with clarity on whether STEP is required for your specific university or major.",
    },
    {
        selector: '[data-tab="links"]',
        titleAr: "روابط كل مصادرك", titleEn: "All your source links",
        textAr: "روابط مباشرة لكل الدورات (إيهاب، المنصف، المعاصر، المفكر) في مكان واحد، بدل البحث عنها كل مرة.",
        textEn: "Direct links to every course (Ehab, Monsif, Moasser, Mufakkir) in one place, instead of searching for them each time.",
    },
    {
        selector: '[data-tab="specialties"]',
        titleAr: "دليل التخصصات", titleEn: "Specialty guide",
        textAr: "أكثر من 20 تخصصاً جامعياً مع وصف كل واحد ومساره الوظيفي والجامعات التي توفره — مفيد إن كنت لم تحسم تخصصك بعد.",
        textEn: "20+ university majors with descriptions, career paths, and which universities offer them — useful if you haven't decided on a major yet.",
    },
    {
        selector: '[data-tab="community"]',
        titleAr: "لست وحدك", titleEn: "You're not alone",
        textAr: "شاهد كم طالباً يذاكر الآن معك، شارك في لوحة الصدارة الأسبوعية، أو اطرح سؤالاً سريعاً على حائط الأسئلة.",
        textEn: "See how many students are studying right now with you, join the weekly leaderboard, or ask a quick question on the community wall.",
    },
];

function shouldShowOnboardingTour(){
    return !localStorage.getItem("khuta_onboarding_done") && !!localStorage.getItem("khuta_plan_days");
}

function startOnboardingTour(){
    if(!shouldShowOnboardingTour()) return;
    if(isLoginOverlayVisible()){ setTimeout(startOnboardingTour, 1000); return; } // انتظر حتى تُغلق شاشة الدخول أولاً
    localStorage.setItem("khuta_onboarding_done", "1"); // نُعلّم فوراً حتى لا تتكرر حتى لو أُغلقت الصفحة منتصف الجولة
    runOnboardingStep(0);
}

function isLoginOverlayVisible(){
    const el = document.getElementById("login-overlay");
    if(!el) return false;
    const display = el.style.display || getComputedStyle(el).display;
    return display !== "none";
}

function runOnboardingStep(index){
    document.getElementById("onboarding-overlay")?.remove();
    if(index >= ONBOARDING_STEPS.length) return;
    if(isLoginOverlayVisible()) return; // ظهرت شاشة الدخول أثناء الجولة (تجديد جلسة مثلاً) — نتوقف بأمان
    const step = ONBOARDING_STEPS[index];
    let target = step.id ? document.getElementById(step.id) : null;
    if((!target || target.offsetParent === null) && step.selector){
        target = Array.from(document.querySelectorAll(step.selector)).find(el => el.offsetParent !== null);
    }
    if((!target || target.offsetParent === null) && step.fallbackId) target = document.getElementById(step.fallbackId);
    if(!target || target.offsetParent === null){ runOnboardingStep(index + 1); return; } // العنصر غير ظاهر في هذا الجهاز — تخطَّ الخطوة

    const rect = target.getBoundingClientRect();
    const overlay = document.createElement("div");
    overlay.id = "onboarding-overlay";
    overlay.className = "onboarding-overlay";
    const pad = 8;
    const isLast = index === ONBOARDING_STEPS.length - 1;
    overlay.innerHTML = `
        <div class="onboarding-spotlight" style="top:${rect.top - pad}px; left:${rect.left - pad}px; width:${rect.width + pad*2}px; height:${rect.height + pad*2}px;"></div>
        <div class="onboarding-card" id="onboarding-card-el">
            <span class="onboarding-step-count">${index + 1} / ${ONBOARDING_STEPS.length}</span>
            <b>${currentLang==='ar' ? step.titleAr : step.titleEn}</b>
            <p>${currentLang==='ar' ? step.textAr : step.textEn}</p>
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; gap:8px;">
                <button type="button" class="btn-ghost" style="font-size:12px;" onclick="document.getElementById('onboarding-overlay').remove()">${currentLang==='ar'?'تخطّي':'Skip'}</button>
                <button type="button" class="btn btn-sm" onclick="runOnboardingStep(${index + 1})">${isLast ? (currentLang==='ar'?'إنهاء':'Done') : (currentLang==='ar'?'التالي':'Next')}</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);

    // ⚠️ إصلاح مهم: كنا نحسب موضع البطاقة العلوي بافتراض ارتفاع ثابت
    // (180px) قبل حتى إدراجها في الصفحة — قد يختلف الارتفاع الفعلي حسب
    // طول النص، فتخرج البطاقة جزئياً عن الشاشة أسفلاً أو حتى أعلاها على
    // الهاتف تحديداً. الآن نقيس البطاقة بعد إدراجها الفعلي، ونُبقيها ضمن
    // حدود الشاشة الآمنة (مع مراعاة حواف الهاتف ذات النتوء) في كل الاتجاهات.
    const card = document.getElementById("onboarding-card-el");
    const cardRect = card.getBoundingClientRect();
    const safeTop = 16, safeBottom = 30, safeSide = 14; // safeBottom أكبر عمداً ليحسب هامش المنطقة الآمنة (شريط الإيماءة/الشريط السفلي) على الهواتف الحديثة
    let top = rect.bottom + 16;
    if(top + cardRect.height > window.innerHeight - safeBottom){
        top = rect.top - cardRect.height - 16; // لا مكان أسفل الهدف — نضعها أعلاه بدلاً
    }
    top = Math.max(safeTop, Math.min(top, window.innerHeight - cardRect.height - safeBottom));
    const left = Math.max(safeSide, Math.min(rect.left, window.innerWidth - cardRect.width - safeSide));
    card.style.top = top + "px";
    card.style.left = left + "px";
}

/* ============================================================
   دليل الموقع بالذكاء الاصطناعي — تنفيذ وسم [[NAVIGATE:key]] الذي قد
   يضيفه مساعد خُطى في نهاية ردّه. يعيد استخدام نفس نمط "بقعة ضوء + بطاقة"
   من الجولة التعريفية أعلاه، لكن كخطوة واحدة مستهدفة بدل جولة كاملة.
   ============================================================ */
// يستخرج وسوم [[NAVIGATE:key]] من نص رد الذكاء، وينفّذ أول واحد صالح منها
// فقط، ويعيد النص بعد حذف الوسم منه (النص المعروض للطالب لا يجب أن يحوي
// صياغة تقنية داخلية كهذه)
function extractNavigateTag(replyText){
    const re = /\[\[NAVIGATE:([a-z_]+)\]\]/gi;
    let cleaned = replyText, matchedKey = null;
    const m = re.exec(replyText);
    if(m && NAV_TARGETS[m[1]]){ matchedKey = m[1]; }
    cleaned = replyText.replace(/\s*\[\[NAVIGATE:[a-z_]+\]\]\s*/gi, " ").trim();
    return { cleaned, key: matchedKey };
}

function aiGuideNavigate(key){
    const cfg = NAV_TARGETS[key];
    if(!cfg) return;

    if(cfg.type === "action"){
        if(typeof window[cfg.action] === "function") window[cfg.action]();
        return;
    }

    // نوع "tab": نبدّل القسم أولاً، ثم — إن كان هناك عنصر محدد — نظلّله
    // ببطاقة تعريفية صغيرة؛ وإلا نكتفي بالانتقال نفسه (واضح بذاته)
    switchTab(cfg.tab);
    if(!cfg.elementId){ showToast(currentLang==='ar' ? `📍 ${cfg.titleAr}` : `📍 Navigated`); return; }

    setTimeout(() => {
        const target = document.getElementById(cfg.elementId);
        if(!target || target.offsetParent === null){
            showToast(currentLang==='ar' ? `📍 ${cfg.titleAr}` : `📍 Navigated`);
            return;
        }
        document.getElementById("onboarding-overlay")?.remove();
        const rect = target.getBoundingClientRect();
        const overlay = document.createElement("div");
        overlay.id = "onboarding-overlay";
        overlay.className = "onboarding-overlay";
        const pad = 8;
        overlay.innerHTML = `
            <div class="onboarding-spotlight" style="top:${rect.top - pad}px; left:${rect.left - pad}px; width:${rect.width + pad*2}px; height:${rect.height + pad*2}px;"></div>
            <div class="onboarding-card ai-guide-card" id="onboarding-card-el">
                <span class="ai-guide-badge"><i class="fa-solid fa-wand-magic-sparkles"></i> ${currentLang==='ar'?'مساعدك دلّك هنا':'Your assistant guided you here'}</span>
                <b>${currentLang==='ar' ? cfg.titleAr : (cfg.titleEn || cfg.titleAr)}</b>
                <p>${currentLang==='ar' ? cfg.textAr : (cfg.textEn || cfg.textAr)}</p>
                <div style="display:flex; justify-content:flex-end; margin-top:12px;">
                    <button type="button" class="btn btn-sm" onclick="document.getElementById('onboarding-overlay').remove()">${currentLang==='ar'?'فهمت 👍':'Got it 👍'}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        // نفس إصلاح القياس بعد الإدراج الفعلي بدل افتراض ارتفاع ثابت (انظر runOnboardingStep)
        const card = document.getElementById("onboarding-card-el");
        const cardRect = card.getBoundingClientRect();
        const safeTop = 16, safeBottom = 30, safeSide = 14; // safeBottom أكبر عمداً ليحسب هامش المنطقة الآمنة (شريط الإيماءة/الشريط السفلي) على الهواتف الحديثة
        let top = rect.bottom + 16;
        if(top + cardRect.height > window.innerHeight - safeBottom) top = rect.top - cardRect.height - 16;
        top = Math.max(safeTop, Math.min(top, window.innerHeight - cardRect.height - safeBottom));
        const left = Math.max(safeSide, Math.min(rect.left, window.innerWidth - cardRect.width - safeSide));
        card.style.top = top + "px";
        card.style.left = left + "px";
        clearTimeout(window.__aiGuideAutoT);
        window.__aiGuideAutoT = setTimeout(() => overlay.remove(), 7000);
    }, 260); // مهلة قصيرة كي يكتمل تبديل القسم وتُقاس أبعاد العنصر بدقة
}

/* ============================================================
   33) إشعارات Push الحقيقية — تصل حتى لو أُغلق الموقع تماماً.
   المفتاح هنا "عام" بطبيعته (VAPID public key) ولا يُشكّل أي خطر أمني
   ظهوره في الكود — هذا هو الاستخدام الصحيح والمُتوقَّع له. المفتاح
   الخاص (Private) موجود فقط في متغيّر بيئة على Netlify، لا يصل هنا إطلاقاً.
   ============================================================ */
const VAPID_PUBLIC_KEY = "BMWllR59gW0Z5EHMNv1CQxEKzGjvoNY8SEznutD9Du1KVVGohKA8lu9Z8Rx7tnBSfW2ZypVGiXIcPdBRE-id9gA";

function urlBase64ToUint8Array(base64String){
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPushNotifications(){
    if(!("serviceWorker" in navigator) || !("PushManager" in window)){
        showToast(currentLang==='ar' ? "متصفحك لا يدعم إشعارات Push" : "Your browser doesn't support push notifications");
        return;
    }
    const session = getSession();
    if(!session || !sb){
        showToast(currentLang==='ar' ? "سجّل دخولك أولاً لتفعيل الإشعارات" : "Sign in first to enable notifications");
        return;
    }
    try{
        const permission = await Notification.requestPermission();
        if(permission !== "granted"){
            showToast(currentLang==='ar' ? "لم تُمنح صلاحية الإشعارات" : "Notification permission not granted");
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        const { error } = await sb.from("push_subscriptions").upsert({
            user_id: session.uid,
            endpoint: subscription.endpoint,
            subscription: subscription.toJSON(),
        }, { onConflict: "endpoint" });
        if(error){ console.error("[خُطى] تعذّر حفظ اشتراك الإشعارات:", error); return; }
        localStorage.setItem("khuta_push_enabled", "1");
        showToast(currentLang==='ar' ? "🔔 فُعِّلت إشعاراتك اليومية" : "🔔 Your daily reminders are on");
    }catch(e){
        console.error("[خُطى] تعذّر تفعيل إشعارات Push:", e);
        showToast(currentLang==='ar' ? "تعذّر تفعيل الإشعارات" : "Couldn't enable notifications");
    }
}

async function openLiveUsersPanel(){
    if(!isAdmin) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("live-users-overlay").style.display = "flex";
    if(!presenceChannel) await startPresenceHeartbeat(); // نضمن اتصال قناة الحضور حتى لو لم يزر المشرف صفحة المجتمع
    const count = presenceChannel ? Object.keys(presenceChannel.presenceState()).length || 1 : 1;
    document.getElementById("live-users-count").textContent = count;
}
function closeLiveUsersPanel(){
    document.getElementById("live-users-overlay").style.display = "none";
}

/* ============================================================
   34) متجر إطارات الصورة الشخصية — يُصرف بها XP بدل الادّخار فقط
   ============================================================ */
const AVATAR_FRAMES = [
    { id:"none", nameAr:"بلا إطار (افتراضي)", nameEn:"No frame (default)", cost:0, cls:"" },
    { id:"silver", nameAr:"حلقة فضية", nameEn:"Silver ring", cost:40, cls:"frame-silver" },
    { id:"fire", nameAr:"حلقة نارية", nameEn:"Fire ring", cost:80, cls:"frame-fire" },
    { id:"diamond", nameAr:"حلقة ماسية", nameEn:"Diamond ring", cost:150, cls:"frame-diamond" },
    { id:"royal", nameAr:"التاج الملكي", nameEn:"Royal crown", cost:300, cls:"frame-royal" },
];

function getOwnedFrames(){
    try{ return JSON.parse(localStorage.getItem("khuta_owned_frames")) || ["none"]; }catch(e){ return ["none"]; }
}
function getEquippedFrame(){ return localStorage.getItem("khuta_equipped_frame") || "none"; }

function applyEquippedFrame(){
    const wrap = document.getElementById("avatar-wrap");
    if(!wrap) return;
    AVATAR_FRAMES.forEach(f => { if(f.cls) wrap.classList.remove(f.cls); });
    const equipped = AVATAR_FRAMES.find(f => f.id === getEquippedFrame());
    if(equipped && equipped.cls) wrap.classList.add(equipped.cls);
}

function renderFrameShop(){
    const box = document.getElementById("frame-shop-list");
    if(!box) return;
    const owned = getOwnedFrames();
    const equipped = getEquippedFrame();
    box.innerHTML = AVATAR_FRAMES.map(f => `
        <button type="button" class="path-card ${equipped===f.id?'selected':''}" style="padding:10px 12px; cursor:pointer;" onclick="${owned.includes(f.id) ? `equipFrame('${f.id}')` : `purchaseFrame('${f.id}')`}">
            <b style="font-size:12px; display:block; color:var(--text-1);">${currentLang==='ar'?f.nameAr:f.nameEn}</b>
            <span style="font-size:11px; color:var(--text-3);">${owned.includes(f.id) ? (equipped===f.id ? (currentLang==='ar'?'مُفعَّل ✓':'Equipped ✓') : (currentLang==='ar'?'تفعيل':'Equip')) : `${f.cost} XP`}</span>
        </button>`).join("");
    applyEquippedFrame();
}

function purchaseFrame(id){
    const frame = AVATAR_FRAMES.find(f => f.id === id);
    if(!frame) return;
    const owned = getOwnedFrames();
    if(owned.includes(id)){ equipFrame(id); return; }
    if(getXP() < frame.cost){
        showToast(currentLang==='ar' ? `تحتاج ${frame.cost} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${frame.cost} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `شراء "${frame.nameAr}" مقابل ${frame.cost} XP؟` : `Buy "${frame.nameEn}" for ${frame.cost} XP?`)) return;
    setXP(getXP() - frame.cost);
    owned.push(id);
    localStorage.setItem("khuta_owned_frames", JSON.stringify(owned));
    equipFrame(id);
    showToast(currentLang==='ar' ? "🖼️ تم الشراء والتفعيل" : "🖼️ Purchased and equipped");
}

function equipFrame(id){
    localStorage.setItem("khuta_equipped_frame", id);
    renderFrameShop();
    debouncedSync();
}

/* ============================================================
   34) التقرير الأسبوعي المتعمّق — يُصرف بها XP مرة واحدة فقط (فتح دائم)،
   يُبنى بالكامل من بيانات حقيقية موجودة أصلاً: سجل الدقائق اليومية،
   ملاحظات المهام السريعة، وتواريخ الإكمال. لا بيانات مُلفَّقة أو مُقدَّرة.
   ============================================================ */
const DEEP_REPORT_COST = 60;
const DAY_NAMES_AR = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const DAY_NAMES_EN = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function isDeepReportUnlocked(){ return localStorage.getItem("khuta_deep_report_unlocked") === "1"; }

function refreshDeepReportButton(){
    const btn = document.getElementById("btn-deep-report");
    if(!btn) return;
    if(isDeepReportUnlocked()){
        btn.innerHTML = `<i class="fa-solid fa-chart-column"></i> ${currentLang==='ar'?'عرض التقرير المتعمّق':'View deep report'}`;
    } else {
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> ${currentLang==='ar'?`فتح التقرير المتعمّق (${DEEP_REPORT_COST} XP)`:`Unlock deep report (${DEEP_REPORT_COST} XP)`}`;
    }
}

function handleDeepReportClick(){
    if(isDeepReportUnlocked()){ showDeepReport(); return; }
    if(getXP() < DEEP_REPORT_COST){
        showToast(currentLang==='ar' ? `تحتاج ${DEEP_REPORT_COST} XP على الأقل — لديك ${getXP()} فقط` : `You need at least ${DEEP_REPORT_COST} XP — you have ${getXP()}`);
        return;
    }
    if(!confirm(currentLang==='ar' ? `فتح التقرير المتعمّق نهائياً مقابل ${DEEP_REPORT_COST} XP؟` : `Permanently unlock the deep report for ${DEEP_REPORT_COST} XP?`)) return;
    setXP(getXP() - DEEP_REPORT_COST);
    localStorage.setItem("khuta_deep_report_unlocked", "1");
    refreshDeepReportButton();
    showDeepReport();
}

function showDeepReport(){
    let dailyLog = {};
    try{ dailyLog = JSON.parse(localStorage.getItem("khuta_daily_minutes_log")) || {}; }catch(e){}
    const dayNames = currentLang==='ar' ? DAY_NAMES_AR : DAY_NAMES_EN;

    // مقارنة 4 أسابيع فعلية
    const weeks = [0,0,0,0];
    const dayTotals = [0,0,0,0,0,0,0];
    const dayCounts = [0,0,0,0,0,0,0];
    for(let i = 0; i < 28; i++){
        const d = new Date(); d.setDate(d.getDate() - i);
        const mins = dailyLog[d.toDateString()] || 0;
        weeks[Math.floor(i/7)] += mins;
        if(mins > 0){ dayTotals[d.getDay()] += mins; dayCounts[d.getDay()]++; }
    }
    const dayAverages = dayTotals.map((t,i) => dayCounts[i] > 0 ? Math.round(t / dayCounts[i]) : 0);
    const maxAvg = Math.max(...dayAverages, 1);
    const bestDayIdx = dayAverages.indexOf(Math.max(...dayAverages));
    const hasEnoughData = Object.keys(dailyLog).length >= 3;

    // آخر 7 أيام كأعمدة (لمحة سريعة، أوضح بصرياً من متوسطات كل التاريخ)
    const last7 = [];
    for(let i = 6; i >= 0; i--){
        const d = new Date(); d.setDate(d.getDate() - i);
        last7.push({ label: dayNames[d.getDay()], mins: dailyLog[d.toDateString()] || 0 });
    }
    const maxBar = Math.max(...last7.map(d => d.mins), 1);
    const barsHtml = last7.map(d => `
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1;">
            <div style="width:100%; height:70px; display:flex; align-items:flex-end;">
                <div style="width:100%; height:${Math.max(4, (d.mins/maxBar)*100)}%; background:linear-gradient(180deg, var(--gold), var(--gold-soft)); border-radius:4px 4px 0 0;"></div>
            </div>
            <span style="font-size:9.5px; color:var(--text-3);">${d.label}</span>
        </div>`).join("");

    const notes = getTaskNotes();
    const noteEntries = Object.values(notes);

    const box = document.getElementById("deep-report-content");
    if(!hasEnoughData){
        box.innerHTML = `<div class="empty-note">${currentLang==='ar'?'تحتاج بضعة أيام إضافية من المذاكرة الفعلية حتى يصبح لدينا بيانات كافية لتقرير حقيقي.':'You need a few more days of real study data before we can build a genuine report.'}</div>`;
    } else {
        const weekBars = weeks.map((w,i) => {
            const label = i===0 ? (currentLang==='ar'?'هذا الأسبوع':'This week') : (currentLang==='ar'?`منذ ${i+1} أسابيع`:`${i+1} weeks ago`);
            const maxW = Math.max(...weeks, 1);
            return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span style="width:90px; font-size:11px; color:var(--text-3);">${label}</span>
                <div class="mini-progress" style="flex:1;"><div style="width:${Math.max(3,(w/maxW)*100)}%; background:var(--gold);"></div></div>
                <span style="width:50px; font-size:11px; text-align:end;">${(w/60).toFixed(1)} ${currentLang==='ar'?'س':'h'}</span>
            </div>`;
        }).join("");

        const dayBars = dayAverages.map((avg,i) => `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:5px;">
                <span style="width:70px; font-size:11px; color:${i===bestDayIdx?'var(--gold)':'var(--text-3)'}; font-weight:${i===bestDayIdx?'700':'400'};">${dayNames[i]}</span>
                <div class="mini-progress" style="flex:1;"><div style="width:${Math.max(3,(avg/maxAvg)*100)}%; background:${i===bestDayIdx?'var(--gold)':'var(--border)'};"></div></div>
                <span style="width:40px; font-size:11px; text-align:end;">${avg} ${currentLang==='ar'?'د':'m'}</span>
            </div>`).join("");

        box.innerHTML = `
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'آخر 7 أيام':'Last 7 days'}</b>
                <div style="display:flex; gap:4px;">${barsHtml}</div>
            </div>
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'مقارنة آخر 4 أسابيع':'Last 4 weeks compared'}</b>
                ${weekBars}
            </div>
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'متوسط دقائق المذاكرة حسب يوم الأسبوع (كل التاريخ)':'Average study minutes by day of week (all-time)'}</b>
                ${dayBars}
                <p class="hint" style="margin-top:8px;">${currentLang==='ar'?`أفضل يوم لديك تاريخياً هو ${dayNames[bestDayIdx]}.`:`Your historically strongest day is ${dayNames[bestDayIdx]}.`}</p>
            </div>
            ${noteEntries.length ? `
            <div>
                <b style="font-size:13px; display:block; margin-bottom:8px;">${currentLang==='ar'?'📝 نقاط وضعت عليها ملاحظات':'📝 Points you flagged with notes'}</b>
                <div style="display:flex; flex-direction:column; gap:6px;">
                    ${noteEntries.slice(0,5).map(n => `<div style="font-size:12px; color:var(--text-2); background:var(--bg-alt); padding:8px 10px; border-radius:8px;">${escapeHtml(n)}</div>`).join("")}
                </div>
            </div>` : ""}`;
    }
    document.getElementById("deep-report-overlay").style.display = "flex";
}

const PRESET_AVATARS = [
    { id:"rocket", icon:"fa-rocket", color:"#C9962E" },
    { id:"book", icon:"fa-book-open", color:"#1C8A72" },
    { id:"star", icon:"fa-star", color:"#C4436B" },
    { id:"bolt", icon:"fa-bolt", color:"#4F46C7" },
    { id:"brain", icon:"fa-brain", color:"#D97B1F" },
    { id:"crown", icon:"fa-crown", color:"#948CE0" },
    { id:"owl", icon:"fa-kiwi-bird", color:"#38B897" },
    { id:"target", icon:"fa-bullseye", color:"#E06B93" },
];

function deleteAvatar(){
    if(!confirm(currentLang==='ar' ? "حذف صورتك الشخصية؟" : "Delete your profile photo?")) return;
    localStorage.removeItem("khuta_avatar");
    localStorage.removeItem("khuta_avatar_preset");
    renderAvatarDisplay();
    debouncedSync();
}

function togglePresetAvatars(){
    const row = document.getElementById("preset-avatars-row");
    const opening = row.style.display === "none";
    row.style.display = opening ? "flex" : "none";
    if(opening){
        row.innerHTML = PRESET_AVATARS.map(p => `
            <button type="button" onclick="choosePresetAvatar('${p.id}')" style="width:52px; height:52px; border-radius:50%; border:2px solid var(--border); background:${p.color}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:18px; cursor:pointer;">
                <i class="fa-solid ${p.icon}"></i>
            </button>`).join("");
    }
}

function choosePresetAvatar(id){
    const preset = PRESET_AVATARS.find(p => p.id === id);
    if(!preset) return;
    localStorage.setItem("khuta_avatar_preset", id);
    localStorage.removeItem("khuta_avatar"); // الصورة المرفوعة والرمز الجاهز لا يجتمعان معاً
    renderAvatarDisplay();
    debouncedSync();
    showToast(currentLang==='ar' ? "✅ تم اختيار الصورة" : "✅ Avatar selected");
}

function renderAvatarDisplay(){
    const img = document.getElementById("avatar-img");
    const placeholder = document.getElementById("avatar-placeholder");
    const deleteBtn = document.getElementById("avatar-delete-btn");
    const uploaded = localStorage.getItem("khuta_avatar");
    const presetId = localStorage.getItem("khuta_avatar_preset");
    const preset = PRESET_AVATARS.find(p => p.id === presetId);

    if(uploaded){
        img.src = uploaded; img.style.display = "block";
        placeholder.style.display = "none";
        deleteBtn.style.display = "flex";
    } else if(preset){
        img.style.display = "none";
        placeholder.style.display = "flex";
        placeholder.style.background = preset.color;
        placeholder.style.color = "#fff";
        placeholder.style.borderColor = preset.color;
        placeholder.innerHTML = `<i class="fa-solid ${preset.icon}"></i>`;
        deleteBtn.style.display = "flex";
    } else {
        img.style.display = "none";
        placeholder.style.display = "flex";
        placeholder.style.background = "var(--bg-alt)";
        placeholder.style.color = "var(--text-3)";
        placeholder.style.borderColor = "var(--border)";
        placeholder.innerHTML = '<i class="fa-solid fa-user"></i>';
        deleteBtn.style.display = "none";
    }
    renderHeaderMiniAvatar();
}

/* نسخة مصغّرة من نفس منطق الأفاتار، للعرض في رأس الصفحة القابل للنقر للانتقال للملف الشخصي */
function renderHeaderMiniAvatar(){
    const el = document.getElementById("header-mini-avatar");
    const focusEl = document.getElementById("focus-header-avatar");
    if(!el && !focusEl) return;
    const uploaded = localStorage.getItem("khuta_avatar");
    const presetId = localStorage.getItem("khuta_avatar_preset");
    const preset = PRESET_AVATARS.find(p => p.id === presetId);
    let html;
    if(uploaded){
        html = `<img src="${uploaded}" style="width:100%;height:100%;object-fit:cover;">`;
    } else if(preset){
        html = `<div style="width:100%;height:100%;background:${preset.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;"><i class="fa-solid ${preset.icon}"></i></div>`;
    } else {
        html = `<div style="width:100%;height:100%;background:var(--bg-alt);color:var(--text-3);display:flex;align-items:center;justify-content:center;font-size:18px;"><i class="fa-solid fa-user"></i></div>`;
    }
    if(el) el.innerHTML = html;
    if(focusEl) focusEl.innerHTML = html;
}

function logSiteVisit(){
    if(!sb) return;
    const isGuest = !getSession();
    sb.from("site_visits").insert({ is_guest: isGuest }).then(() => {}, () => {}); // فشل التسجيل ليس حرجاً، تجاهل بصمت
}

let visitStatsPollTimer = null;
/* ============================================================
   لوحة إدارة رسائل البريد — للمشرفين فقط. الكتابة والقراءة تمر عبر Supabase
   مباشرة (محمية بـRLS)، والإرسال الفعلي عبر send-email.js التي تتحقق من
   صلاحية المشرف على الخادم مستقلةً — لا تكفي إخفاء الزر في الواجهة وحده.
   ============================================================ */
async function openCampaignPanel(){
    if(!isAdmin) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("campaign-overlay").style.display = "flex";
    switchCampaignTab("list", document.querySelector(".campaign-tab"));
    await renderCampaignList();
}

function switchCampaignTab(pane, btn){
    document.querySelectorAll(".campaign-pane").forEach(p => p.style.display = "none");
    document.querySelectorAll(".campaign-tab").forEach(b => b.classList.remove("active"));
    document.getElementById("campaign-pane-" + pane).style.display = "block";
    if(btn) btn.classList.add("active");
    if(pane === "list") renderCampaignList();
    if(pane === "log") renderCampaignLog();
}

function onCampaignModeChange(){
    const mode = document.getElementById("campaign-mode").value;
    document.getElementById("campaign-inactive-group").style.display = mode === "behavior" ? "block" : "none";
}

async function renderCampaignList(){
    const box = document.getElementById("campaign-list");
    if(!sb){ box.innerHTML = "<p class='hint'>الاتصال بقاعدة البيانات غير متاح</p>"; return; }
    box.innerHTML = "<p class='hint'>جاري التحميل…</p>";
    try{
        const { data, error } = await sb.from("marketing_messages").select("*").order("created_at", { ascending:false });
        if(error) throw error;
        if(!data || data.length === 0){ box.innerHTML = "<p class='hint'>لا توجد رسائل بعد — أنشئ واحدة من تبويب \"رسالة جديدة\"</p>"; return; }
        box.innerHTML = data.map(m => {
            const modeLabel = m.send_mode === "behavior" ? `ذكي (غاب ${m.inactive_days || 5} أيام)` : "جماعي";
            const statusLabel = m.sent_at ? `أُرسلت ${new Date(m.sent_at).toLocaleDateString("ar-SA")}`
                : (m.send_after && new Date(m.send_after) > new Date()) ? `مجدولة بعد ${new Date(m.send_after).toLocaleDateString("ar-SA")}`
                : "جاهزة";
            return `<div class="campaign-row">
                <div class="campaign-row-main">
                    <b>${escapeHtml(m.subject)}</b>
                    <span class="campaign-meta">${modeLabel} · ${escapeHtml(m.occasion || "عام")} · ${statusLabel} · ${m.active ? "مفعّلة" : "معطّلة"}</span>
                </div>
                <div class="campaign-row-actions">
                    <button type="button" class="btn btn-sm" onclick="sendCampaignNow(${m.id})">إرسال الآن</button>
                    <button type="button" class="btn btn-sm btn-outline" onclick="toggleCampaignActive(${m.id}, ${!m.active})">${m.active ? "تعطيل" : "تفعيل"}</button>
                </div>
            </div>`;
        }).join("");
    }catch(e){
        box.innerHTML = "<p class='hint'>تعذّر تحميل الرسائل: " + escapeHtml(String(e.message || e)) + "</p>";
    }
}

async function renderCampaignLog(){
    const box = document.getElementById("campaign-log-list");
    if(!sb) return;
    box.innerHTML = "<p class='hint'>جاري التحميل…</p>";
    try{
        const { data, error } = await sb.from("email_campaign_log").select("*").order("sent_at", { ascending:false }).limit(60);
        if(error) throw error;
        if(!data || data.length === 0){ box.innerHTML = "<p class='hint'>لم تُرسل أي رسالة بعد</p>"; return; }
        box.innerHTML = data.map(l => `<div class="campaign-row">
            <div class="campaign-row-main">
                <b>${escapeHtml(l.recipient_email)}</b>
                <span class="campaign-meta">${new Date(l.sent_at).toLocaleString("ar-SA")} · ${l.status === "sent" ? "✅ نجحت" : "❌ فشلت"}${l.is_test ? " · تجريبية" : ""}</span>
            </div>
        </div>`).join("");
    }catch(e){
        box.innerHTML = "<p class='hint'>تعذّر تحميل السجل: " + escapeHtml(String(e.message || e)) + "</p>";
    }
}

async function saveCampaignMessage(){
    if(!isAdmin || !sb) return;
    const subject = document.getElementById("campaign-subject").value.trim();
    const bodyHtml = document.getElementById("campaign-body").value.trim();
    if(!subject || !bodyHtml){ showToast("العنوان والمحتوى مطلوبان"); return; }
    const sendAfterVal = document.getElementById("campaign-send-after").value;
    try{
        const { error } = await sb.from("marketing_messages").insert({
            subject, body_html: bodyHtml,
            occasion: document.getElementById("campaign-occasion").value.trim() || "عام",
            send_mode: document.getElementById("campaign-mode").value,
            inactive_days: parseInt(document.getElementById("campaign-inactive-days").value) || 5,
            send_after: sendAfterVal ? new Date(sendAfterVal).toISOString() : null,
            active: true,
        });
        if(error) throw error;
        showToast("✅ حُفظت الرسالة");
        document.getElementById("campaign-subject").value = "";
        document.getElementById("campaign-body").value = "";
        switchCampaignTab("list", document.querySelector(".campaign-tab"));
    }catch(e){
        showToast("تعذّر الحفظ: " + (e.message || e));
    }
}

async function toggleCampaignActive(id, newState){
    if(!isAdmin || !sb) return;
    try{
        const { error } = await sb.from("marketing_messages").update({ active: newState }).eq("id", id);
        if(error) throw error;
        renderCampaignList();
    }catch(e){ showToast("تعذّر التحديث: " + (e.message || e)); }
}

// نداء موحّد للمسارات الإدارية في send-email.js (تتحقق من صلاحيتك على الخادم)
async function callAdminEmail(type, extra){
    const { data } = await sb.auth.getSession();
    const accessToken = data && data.session && data.session.access_token;
    if(!accessToken){ showToast("سجّل دخولك أولاً"); return null; }
    const res = await fetch("/.netlify/functions/send-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, accessToken, ...extra }),
    });
    const json = await res.json().catch(() => ({}));
    if(!res.ok){ showToast("فشل: " + (json.error || res.status)); return null; }
    return json;
}

async function sendCampaignTest(){
    if(!isAdmin) return;
    const subject = document.getElementById("campaign-subject").value.trim();
    const bodyHtml = document.getElementById("campaign-body").value.trim();
    const emailsRaw = document.getElementById("campaign-test-emails").value.trim();
    if(!subject || !bodyHtml){ showToast("اكتب العنوان والمحتوى أولاً"); return; }
    if(!emailsRaw){ showToast("أدخل بريداً تجريبياً واحداً على الأقل"); return; }
    const testEmails = emailsRaw.split(",").map(s => s.trim()).filter(Boolean);
    showToast("⏳ جاري الإرسال التجريبي…");
    const result = await callAdminEmail("adminTest", { subject, bodyHtml, testEmails });
    if(result){
        const okCount = (result.results || []).filter(r => r.ok).length;
        showToast(`🧪 أُرسلت تجريبياً: ${okCount} من ${testEmails.length}`);
    }
}

async function sendCampaignNow(messageId){
    if(!isAdmin || !sb) return;
    try{
        const { data, error } = await sb.from("marketing_messages").select("*").eq("id", messageId).single();
        if(error) throw error;
        const modeLabel = data.send_mode === "behavior" ? `الطلاب الغائبين ${data.inactive_days || 5} أيام فأكثر` : "كل الطلاب الموافقين";
        if(!confirm(`سترسل "${data.subject}" إلى ${modeLabel}.\n\nهذه رسالة حقيقية ستصل طلاباً فعليين. متأكد؟`)) return;
        showToast("⏳ جاري الإرسال…");
        const result = await callAdminEmail("adminSendCampaign", {
            subject: data.subject, bodyHtml: data.body_html, messageId: data.id,
            message: { send_mode: data.send_mode, inactive_days: data.inactive_days },
        });
        if(result){
            if(result.sent === 0 && result.note){ showToast("ℹ️ " + result.note); }
            else{
                showToast(`✅ أُرسلت لـ${result.sent} طالب${result.failed ? ` (فشل ${result.failed})` : ""}`);
                if(data.send_mode === "broadcast"){
                    await sb.from("marketing_messages").update({ sent_at: new Date().toISOString() }).eq("id", messageId);
                }
                renderCampaignList();
            }
        }
    }catch(e){ showToast("تعذّر الإرسال: " + (e.message || e)); }
}

async function openVisitStatsPanel(){
    if(!isAdmin || !sb) return;
    document.getElementById("admin-overlay").style.display = "none";
    document.getElementById("visit-stats-overlay").style.display = "flex";
    await refreshVisitStats();
    clearInterval(visitStatsPollTimer);
    visitStatsPollTimer = setInterval(refreshVisitStats, 5000);
}
function closeVisitStatsPanel(){
    document.getElementById("visit-stats-overlay").style.display = "none";
    clearInterval(visitStatsPollTimer);
}
async function refreshVisitStats(){
    const { data, error } = await sb.rpc("get_visit_stats");
    if(error || !data) return;
    document.getElementById("visit-today-count").textContent = data.today_count ?? 0;
    document.getElementById("visit-last-time").textContent = data.last_visit
        ? new Date(data.last_visit).toLocaleString("ar-SA")
        : (currentLang==='ar' ? "لا توجد زيارات بعد" : "No visits yet");
}

/* ============================================================
   35) حل تعارض البيانات بين تقدّم ضيف محلي وحساب له بيانات محفوظة —
   يظهر فقط عند وجود تعارض حقيقي (كلاهما لديه تقدّم فعلي)، وليس أبداً
   لزائر جديد بلا أي تقدّم.
   ============================================================ */
function hasMeaningfulLocalProgress(){
    return !!localStorage.getItem("khuta_plan_days");
}
function snapshotHasMeaningfulProgress(snap){
    return !!(snap && snap.khuta_plan_days);
}

function resolveAccountDataConflict(remoteSnapshot){
    return new Promise((resolve) => {
        const guestHasProgress = hasMeaningfulLocalProgress();
        const accountHasProgress = snapshotHasMeaningfulProgress(remoteSnapshot);

        if(!guestHasProgress || !accountHasProgress){
            // لا تعارض حقيقياً — إن كان للحساب بيانات، طبّقها مباشرة؛ وإلا أبقِ تقدّم الضيف كما هو
            if(accountHasProgress) applyRemoteSnapshot(remoteSnapshot);
            resolve();
            return;
        }

        const overlay = document.createElement("div");
        overlay.className = "overlay-screen";
        overlay.style.zIndex = "4900";
        overlay.innerHTML = `
            <div class="wizard-card" style="max-width:440px; text-align:center;">
                <h2 style="margin-bottom:8px;"><i class="fa-solid fa-triangle-exclamation" style="color:var(--gold);"></i> ${currentLang==='ar'?'لديك تقدّمان مختلفان':'You have two different progress records'}</h2>
                <p class="card-sub" style="margin-bottom:20px; line-height:1.9;">${currentLang==='ar'
                    ? "ذاكرت كضيف على هذا الجهاز، ولحسابك أيضاً بيانات محفوظة من قبل. أيهما تريد الاحتفاظ به؟ (الخيار الآخر سيُفقَد نهائياً)"
                    : "You've been studying as a guest on this device, and your account also has previously saved data. Which do you want to keep? (The other will be lost permanently)"}</p>
                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button type="button" class="btn" id="keep-guest-btn">${currentLang==='ar'?'الاحتفاظ بتقدّمي الحالي (كضيف)':'Keep my current progress (as guest)'}</button>
                    <button type="button" class="btn btn-outline" id="load-account-btn">${currentLang==='ar'?'تحميل بيانات حسابي المحفوظة':"Load my account's saved data"}</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#keep-guest-btn").onclick = () => {
            // نُبقي كل شيء محلياً كما هو، لكن نرفع نسخة الضيف الحالية لتصبح بيانات الحساب من الآن فصاعداً
            overlay.remove();
            debouncedSync();
            resolve();
        };
        overlay.querySelector("#load-account-btn").onclick = () => {
            applyRemoteSnapshot(remoteSnapshot);
            overlay.remove();
            resolve();
        };
    });
}

const FOCUS_QUOTES = [
    { ar:"النجاح هو محصلة تحضير، واجتهاد، وتعلّم من الفشل.", en:"Success is where preparation and opportunity meet.", authorAr:"كولن باول", authorEn:"Colin Powell" },
    { ar:"لا تنتظر اللحظة المثالية، خذ اللحظة واجعلها مثالية.", en:"Don't wait for the perfect moment, take the moment and make it perfect.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"كل دقيقة تركيز الآن، خطوة أقرب لجامعتك.", en:"Every focused minute now is a step closer to your university.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"من جدّ وجد، ومن زرع حصد.", en:"Whoever strives, finds; whoever sows, reaps.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"العلم في الصغر كالنقش على الحجر.", en:"Learning in youth is like carving into stone — it lasts.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"لست بحاجة لأن تكون رائعاً لتبدأ، لكن عليك أن تبدأ لتصبح رائعاً.", en:"You don't have to be great to start, but you have to start to be great.", authorAr:"زيغ زيغلر", authorEn:"Zig Ziglar" },
    { ar:"الفرق بين المستحيل والممكن يكمن في إصرار الإنسان.", en:"The difference between impossible and possible lies in a person's determination.", authorAr:"توماس أديسون", authorEn:"Thomas Edison" },
    { ar:"لا يهم مدى بطء تقدّمك، طالما أنك لا تتوقف.", en:"It does not matter how slowly you go, as long as you do not stop.", authorAr:"كونفوشيوس", authorEn:"Confucius" },
    { ar:"العقل الذي ينفتح على فكرة جديدة لن يعود لحجمه القديم أبداً.", en:"A mind stretched by a new idea never returns to its original size.", authorAr:"أوليفر هولمز", authorEn:"Oliver Wendell Holmes" },
    { ar:"لا تقس يومك بالمحصول الذي تجنيه، بل بالبذور التي تزرعها.", en:"Don't judge each day by the harvest you reap, but by the seeds you plant.", authorAr:"روبرت لويس ستيفنسون", authorEn:"Robert Louis Stevenson" },
    { ar:"التميّز ليس فعلاً، بل عادة.", en:"Excellence is not an act, but a habit.", authorAr:"أرسطو", authorEn:"Aristotle" },
    { ar:"ابدأ من حيث أنت، استخدم ما لديك، وافعل ما تستطيع.", en:"Start where you are, use what you have, do what you can.", authorAr:"آرثر آش", authorEn:"Arthur Ashe" },
    { ar:"الطريق إلى النجاح دائماً قيد الإنشاء.", en:"The road to success is always under construction.", authorAr:"ليلي توملين", authorEn:"Lily Tomlin" },
    { ar:"لا يوجد مصعد للنجاح، عليك أخذ السلالم.", en:"There's no elevator to success — you have to take the stairs.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"ثق بنفسك، وستعرف كيف تعيش.", en:"Trust yourself, and you will know how to live.", authorAr:"غوته", authorEn:"Goethe" },
    { ar:"من سار على الدرب وصل.", en:"Whoever walks the path arrives.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"النجاح هو أن تنتقل من فشل إلى فشل دون أن تفقد الحماس.", en:"Success is walking from failure to failure with no loss of enthusiasm.", authorAr:"ونستون تشرشل", authorEn:"Winston Churchill" },
    { ar:"لن تكسب المعركة إن لم تخض القتال.", en:"You can't win the battle if you don't fight it.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الإصرار هو الطريق السحري للنجاح.", en:"Persistence is the magic word for success.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"ركّز على الرحلة، لا الوجهة فقط — كل جلسة اليوم تبني غدك.", en:"Focus on the journey, not just the destination — every session today builds your tomorrow.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"العمل الجاد يتغلّب على الموهبة حين لا تعمل الموهبة بجد.", en:"Hard work beats talent when talent doesn't work hard.", authorAr:"تيم نوتك", authorEn:"Tim Notke" },
    { ar:"كل خبير كان يوماً مبتدئاً.", en:"Every expert was once a beginner.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الصبر مفتاح الفرج.", en:"Patience is the key to relief.", authorAr:"مثل عربي", authorEn:"Arabic proverb" },
    { ar:"لا تقارن بدايتك بمنتصف رحلة غيرك.", en:"Don't compare your beginning to someone else's middle.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"الوقت الذي تستمتع فيه بإضاعته ليس وقتاً ضائعاً — لكن وقت المذاكرة استثمار لا يضيع أبداً.", en:"Time you enjoy wasting isn't wasted time — but study time is an investment that never is.", authorAr:"خُطى", authorEn:"Khuta" },
    { ar:"من يرد الحياة يستجب لها.", en:"Whoever wants life must answer its call.", authorAr:"أبو القاسم الشابي", authorEn:"Abu al-Qasim al-Shabbi" },
    { ar:"النجاح رحلة، لا وجهة.", en:"Success is a journey, not a destination.", authorAr:"آرثر آش", authorEn:"Arthur Ashe" },
    { ar:"من يخطط لهدفه يقترب منه كل يوم، ومن لا يخطط يبقى في مكانه.", en:"Those who plan for their goal move closer daily; those who don't stay in place.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"القراءة اليوم، القيادة غداً.", en:"Reading today, leading tomorrow.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"أعظم إنجاز هو ألا تفشل أبداً، بل أن تنهض في كل مرة تسقط فيها.", en:"Our greatest glory is not in never failing, but in rising every time we fall.", authorAr:"كونفوشيوس", authorEn:"Confucius" },
    { ar:"العقول العظيمة تناقش الأفكار، والعقول المتوسطة تناقش الأحداث.", en:"Great minds discuss ideas; average minds discuss events.", authorAr:"مجهول", authorEn:"Unknown" },
    { ar:"من طلب العلا سهر الليالي.", en:"Whoever seeks greatness stays up through the nights.", authorAr:"المتنبي", authorEn:"Al-Mutanabbi" },
];

/* يُعيد توجيه الزر داخل وضع التركيز لنفس أزرار لوحة التحكم تماماً —
   لا تكرار لمنطق الجلسة، فقط "نقرة بالنيابة" لتفادي أي احتمال تعارض حالة */
function focusModeStartOrPause(){
    const pauseBtn = document.getElementById("pause-btn");
    if(pauseBtn.disabled){
        document.getElementById("btn-plan-session").click();
    } else {
        pauseBtn.click();
    }
}

function toggleFocusThemePicker(){
    const picker = document.getElementById("focus-theme-picker");
    picker.style.display = "";  // التحكم بالظهور صار عبر فئة .open (انزلاق جانبي بأنيميشن)
    picker.classList.toggle("open");
}

/* ============================================================
   39) خلفية وضع التركيز الحية — كانفس متحرك ذاتياً باستمرار
   (كتل ضوئية متوهجة تنجرف ببطء + نجوم متلألئة لثيمات مختارة)،
   وتتفاعل بخفة مع موضع الماوس (parallax) دون أن تتوقف الحركة
   الذاتية أبداً حتى مع سكون الماوس تماماً.
   ============================================================ */
const FOCUS_THEME_PRESETS = {
    night:  { base:["#0d0620","#1a0f35","#120a28"], stars:true, blobs:[
        {x:0.3,y:0.3,r:260,color:"124,92,191",drift:22,speed:0.00018,phase:0},
        {x:0.7,y:0.25,r:220,color:"201,150,46",drift:18,speed:0.00022,phase:2},
        {x:0.5,y:0.72,r:300,color:"70,40,130",drift:26,speed:0.00015,phase:4},
        {x:0.18,y:0.7,r:180,color:"94,92,191",drift:20,speed:0.0002,phase:1},
    ]},
    forest: { base:["#0a1f16","#0d2a1c","#081810"], stars:false, blobs:[
        {x:0.3,y:0.28,r:260,color:"94,214,183",drift:20,speed:0.0002,phase:0},
        {x:0.72,y:0.6,r:240,color:"46,120,80",drift:24,speed:0.00017,phase:3},
        {x:0.5,y:0.2,r:200,color:"150,214,120",drift:18,speed:0.00023,phase:1},
    ]},
    sunset: { base:["#2a1030","#5a1f35","#7a3020"], stars:false, blobs:[
        {x:0.5,y:0.55,r:300,color:"253,187,110",drift:16,speed:0.0002,phase:0},
        {x:0.25,y:0.3,r:220,color:"161,58,74",drift:22,speed:0.00018,phase:2},
        {x:0.75,y:0.35,r:200,color:"217,113,63",drift:18,speed:0.00021,phase:4},
    ]},
    desk:   { base:["#1a1408","#241a0a","#0d0904"], stars:false, blobs:[
        {x:0.5,y:0.35,r:280,color:"255,233,176",drift:14,speed:0.00019,phase:0},
        {x:0.7,y:0.6,r:200,color:"201,150,46",drift:18,speed:0.00022,phase:2},
    ]},
    ocean:  { base:["#050a1a","#0a1a33","#123152"], stars:true, blobs:[
        {x:0.5,y:0.25,r:260,color:"220,232,255",drift:16,speed:0.0002,phase:0},
        {x:0.3,y:0.62,r:240,color:"127,166,242",drift:22,speed:0.00017,phase:3},
        {x:0.72,y:0.72,r:220,color:"46,107,224",drift:20,speed:0.00019,phase:1},
    ]},
    dawn:   { base:["#2a1735","#4a2050","#8a4a6a"], stars:false, blobs:[
        {x:0.5,y:0.7,r:300,color:"255,217,194",drift:16,speed:0.0002,phase:0},
        {x:0.25,y:0.35,r:220,color:"224,147,171",drift:20,speed:0.00021,phase:2},
        {x:0.75,y:0.3,r:200,color:"180,155,224",drift:18,speed:0.00023,phase:4},
    ]},
};

let focusCanvasCtx = null;
let focusCanvasAnimId = null;
let focusLastFrameTime = null;
let focusMouseX = 0.5, focusMouseY = 0.5;
let focusMouseXSmooth = 0.5, focusMouseYSmooth = 0.5;
let focusStars = [];

function resizeFocusCanvas(){
    const canvas = document.getElementById("focus-canvas-bg");
    if(!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
function handleFocusMouseMove(e){
    focusMouseX = e.clientX / window.innerWidth;
    focusMouseY = e.clientY / window.innerHeight;
    const glow = document.getElementById("focus-cursor-glow");
    if(glow){
        glow.style.opacity = "1";
        glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
}
function handleFocusMouseLeave(){
    const glow = document.getElementById("focus-cursor-glow");
    if(glow) glow.style.opacity = "0";
}
function generateFocusStars(){
    focusStars = [];
    for(let i = 0; i < 55; i++){
        // انجراف ذاتي بطيء جداً بحدود ~0.1px/ثانية لكل نجمة، بزاوية عشوائية —
        // يجعل الخلفية "حيّة" مع الوقت بدل السكون التام (يبقى غير محسوس
        // خلال ثوانٍ قليلة لكنه واضح على مدى جلسة تركيز كاملة)
        const angle = Math.random() * Math.PI * 2;
        const speedPxPerSec = 0.05 + Math.random() * 0.1;
        focusStars.push({
            x:Math.random(), y:Math.random(), r:Math.random()*1.3+0.4,
            phase:Math.random()*Math.PI*2, speed:Math.random()*0.001+0.0006,
            vx: Math.cos(angle) * speedPxPerSec, vy: Math.sin(angle) * speedPxPerSec,
        });
    }
}
function renderFocusCanvasFrame(time){
    const canvas = document.getElementById("focus-canvas-bg");
    const overlay = document.getElementById("focus-mode-overlay");
    if(!canvas || !focusCanvasCtx || !overlay) return;
    const ctx = focusCanvasCtx;
    const w = canvas.width, h = canvas.height;
    const theme = FOCUS_THEME_PRESETS[overlay.dataset.bgTheme] || FOCUS_THEME_PRESETS.night;

    // دلتا الوقت بين الإطارين بالثواني — أساس حساب الانجراف البطيء جداً
    // للنجوم بوحدة px/ثانية حقيقية بمعزل عن معدل تحديث الشاشة (fps)
    const dt = focusLastFrameTime ? Math.min((time - focusLastFrameTime) / 1000, 0.25) : 0;
    focusLastFrameTime = time;

    focusMouseXSmooth += (focusMouseX - focusMouseXSmooth) * 0.03;
    focusMouseYSmooth += (focusMouseY - focusMouseYSmooth) * 0.03;
    const parallaxX = (focusMouseXSmooth - 0.5) * 60;
    const parallaxY = (focusMouseYSmooth - 0.5) * 40;

    const baseGrad = ctx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, theme.base[0]);
    baseGrad.addColorStop(0.5, theme.base[1]);
    baseGrad.addColorStop(1, theme.base[2]);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, w, h);

    if(theme.stars){
        focusStars.forEach(s => {
            // انجراف بطيء جداً مع التفاف حول الحواف — px/ثانية محوَّلة لنسبة
            // من أبعاد الكانفس الفعلية بما أن إحداثيات النجوم مخزَّنة كنسبة (0-1)
            if(dt > 0){
                s.x += (s.vx * dt) / w;
                s.y += (s.vy * dt) / h;
                if(s.x < -0.02) s.x += 1.04; else if(s.x > 1.02) s.x -= 1.04;
                if(s.y < -0.02) s.y += 1.04; else if(s.y > 1.02) s.y -= 1.04;
            }
            const twinkle = Math.max(0, 0.4 + Math.sin(time * s.speed + s.phase) * 0.35);
            ctx.beginPath();
            ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
            ctx.fill();
        });
    }

    theme.blobs.forEach((b, i) => {
        const driftX = Math.sin(time * b.speed + b.phase) * b.drift;
        const driftY = Math.cos(time * b.speed * 0.8 + b.phase) * b.drift * 0.6;
        const depthFactor = 0.5 + (i % 3) * 0.3;
        const x = b.x * w + driftX + parallaxX * depthFactor;
        const y = b.y * h + driftY + parallaxY * depthFactor;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, b.r);
        grad.addColorStop(0, `rgba(${b.color},0.32)`);
        grad.addColorStop(1, `rgba(${b.color},0)`);
        ctx.fillStyle = grad;
        ctx.fillRect(x - b.r, y - b.r, b.r * 2, b.r * 2);
    });
}
/* محرّك الحلقة منفصل تماماً عن دالة الرسم — يعتمد على علم boolean صريح
   (وليس على قراءة overlay.style.display في كل إطار)، لتفادي أي هشاشة إن
   لمس كود آخر تلك الخاصية لأي سبب مستقبلاً */
let focusCanvasActive = false;
function focusCanvasTick(time){
    if(!focusCanvasActive){ focusCanvasAnimId = null; return; }
    renderFocusCanvasFrame(time);
    focusCanvasAnimId = requestAnimationFrame(focusCanvasTick);
}
function startFocusCanvasBg(){
    if(window.innerWidth <= 700) return; // للكمبيوتر فقط — الهاتف يستخدم الخلفية الثابتة الخفيفة
    const canvas = document.getElementById("focus-canvas-bg");
    if(!canvas) return;
    focusCanvasCtx = canvas.getContext("2d");
    resizeFocusCanvas();
    generateFocusStars();
    focusLastFrameTime = null; // نتفادى قفزة دلتا-وقت ضخمة عند إعادة تشغيل الحلقة بعد إيقاف مؤقّت
    document.getElementById("focus-mode-overlay").addEventListener("mousemove", handleFocusMouseMove);
    document.getElementById("focus-mode-overlay").addEventListener("mouseleave", handleFocusMouseLeave);
    focusCanvasActive = true;
    if(!focusCanvasAnimId) focusCanvasAnimId = requestAnimationFrame(focusCanvasTick);
}
function stopFocusCanvasBg(){
    focusCanvasActive = false;
    if(focusCanvasAnimId){ cancelAnimationFrame(focusCanvasAnimId); focusCanvasAnimId = null; }
    document.getElementById("focus-mode-overlay").removeEventListener("mousemove", handleFocusMouseMove);
    document.getElementById("focus-mode-overlay").removeEventListener("mouseleave", handleFocusMouseLeave);
    const glow = document.getElementById("focus-cursor-glow");
    if(glow) glow.style.opacity = "0";
}
// انعكاس الكرة الزجاجية يتبع الفأرة فعلياً: نحوّل موضع الفأرة داخل مربّع
// الكرة إلى إزاحة صغيرة (px) عبر متغيّرين CSS مخصَّصين يقرأهما ::after في
// تعريف .focus-timer-ring-wrap — بلا أي رسم Canvas إضافي، مجرّد CSS حي
function handleOrbShineMove(e){
    const wrap = document.getElementById("focus-timer-ring-wrap");
    if(!wrap) return;
    const r = wrap.getBoundingClientRect();
    if(r.width === 0 || r.height === 0) return;
    const relX = (e.clientX - r.left) / r.width - 0.5;  // -0.5..0.5
    const relY = (e.clientY - r.top) / r.height - 0.5;
    const maxOffsetPx = 26;
    wrap.style.setProperty("--shine-x", (relX * maxOffsetPx * 2).toFixed(1) + "px");
    wrap.style.setProperty("--shine-y", (relY * maxOffsetPx * 2).toFixed(1) + "px");
    wrap.classList.add("shine-tracking");
}
function resetOrbShine(){
    const wrap = document.getElementById("focus-timer-ring-wrap");
    if(!wrap) return;
    wrap.style.removeProperty("--shine-x");
    wrap.style.removeProperty("--shine-y");
    wrap.classList.remove("shine-tracking");
}
window.addEventListener("resize", resizeFocusCanvas);
document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".focus-theme-picker-wrap");
    const picker = document.getElementById("focus-theme-picker");
    if(wrap && picker && picker.style.display !== "none" && !wrap.contains(e.target)){
        picker.style.display = "none";
    }
});
function setFocusBgTheme(theme){
    document.getElementById("focus-mode-overlay").dataset.bgTheme = theme;
    localStorage.setItem("khuta_focus_bg_theme", theme);
    document.querySelectorAll(".focus-theme-swatch").forEach(el => el.classList.toggle("active", el.dataset.theme === theme));
    const _picker = document.getElementById("focus-theme-picker");
    _picker.style.display = ""; _picker.classList.remove("open");
}

let currentFocusQuote = null;

function openFocusMode(){
    const overlay = document.getElementById("focus-mode-overlay");
    overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const savedTheme = localStorage.getItem("khuta_focus_bg_theme") || "night";
    overlay.dataset.bgTheme = savedTheme;
    document.querySelectorAll(".focus-theme-swatch").forEach(el => el.classList.toggle("active", el.dataset.theme === savedTheme));
    startFocusCanvasBg();

    // تحديث فوري لكل بيانات الشريط العائم (الصورة، الاسم، XP، السلسلة،
    // الإشعارات) عند فتح وضع التركيز — لا ننتظر التحديث الدوري التالي
    renderHeaderMiniAvatar();
    updateWelcomeText();
    renderGamification();
    renderNotificationBell();

    // نصيحة ثابتة طوال الجلسة الحالية — تُختار مرة واحدة عند بدء الجلسة (startMainSession)،
    // وهنا فقط نعرضها؛ إن فُتح وضع التركيز دون جلسة نشطة بعد، نختار واحدة بشكل استثنائي
    if(!currentFocusQuote) currentFocusQuote = FOCUS_QUOTES[Math.floor(Math.random() * FOCUS_QUOTES.length)];
    document.getElementById("focus-quote-text").textContent = `"${currentLang==='ar' ? currentFocusQuote.ar : currentFocusQuote.en}"`;
    document.getElementById("focus-quote-author").textContent = "— " + (currentLang==='ar' ? currentFocusQuote.authorAr : currentFocusQuote.authorEn);

    const taskCard = document.getElementById("focus-task-card");
    const rows = document.querySelectorAll("#schedule-body tr[data-task-id]");
    if(rows.length){
        const statuses = getTaskStatuses();
        taskCard.style.display = "block";
        document.getElementById("focus-task-count").textContent = rows.length;
        document.getElementById("focus-task-list").innerHTML = Array.from(rows).map(row => {
            const id = row.dataset.taskId;
            const status = statuses[id] || "notstarted";
            const titleInput = row.querySelector(".task-path-cell .task-input");
            const title = titleInput ? titleInput.value : id;
            return `<div class="focus-task-row ${status==='done'?'done':status==='inprogress'?'inprogress':''}">
                <div class="ftr-check"><i class="fa-solid fa-check"></i></div>
                <span>${escapeHtml(title)}</span>
            </div>`;
        }).join("");
    } else {
        taskCard.style.display = "none";
    }
    updateMainDisplay(); // مزامنة فورية عند الفتح، دون انتظار التحديث التالي كل ثانية
}

function closeFocusMode(){
    document.getElementById("focus-mode-overlay").style.display = "none";
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
    stopFocusCanvasBg();
}

function shuffleArray(arr){
    const a = [...arr];
    for(let i = a.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* يبني مجموعة أسئلة الاختبار — يتكيّف تلقائياً مع حجم بنك الأسئلة الفعلي
   المتاح (حالياً أمثلة قليلة فقط)، فلا يُكرر نفس السؤال أبداً داخل اختبار واحد */
function buildExamQuestionSet(examType){
    const pool = getExamQuestions();
    const quantPool = shuffleArray(pool.quant || []);
    const verbalPool = shuffleArray(pool.verbal || []);

    if(examType === "verbal"){
        return { sections:[{ quant:[], verbal:verbalPool }], scaledDown: false };
    }
    if(examType === "quant"){
        return { sections:[{ quant:quantPool, verbal:[] }], scaledDown: false };
    }

    // "full": توزيع عشوائي 65/55 أو 55/65 — يتحدَّد مرة واحدة لكل محاولة اختبار
    const quantFirst = Math.random() < 0.5;
    let targetQuant = quantFirst ? 65 : 55;
    let targetVerbal = quantFirst ? 55 : 65;

    // تكيّف مع حجم البنك الفعلي المتاح حالياً — لا تكرار لنفس السؤال إطلاقاً
    const availableQuant = Math.min(targetQuant, quantPool.length);
    const availableVerbal = Math.min(targetVerbal, verbalPool.length);
    const scaledDown = (availableQuant < targetQuant) || (availableVerbal < targetVerbal);

    const sections = splitIntoSections(quantPool.slice(0, availableQuant), verbalPool.slice(0, availableVerbal), EXAM_SECTION_COUNT);
    return { sections, scaledDown, quantFirst };
}

function loadProfileForm(){
    document.getElementById("prof-name").value = localStorage.getItem("khuta_name") || "";
    document.getElementById("prof-last").value = localStorage.getItem("khuta_last") || "";
    document.getElementById("prof-birth").value = localStorage.getItem("khuta_birth") || "";
    document.getElementById("prof-gender").value = localStorage.getItem("khuta_gender") || "male";
    document.getElementById("prof-track").value = localStorage.getItem("khuta_track") || "science";
    document.getElementById("prof-goal-score").value = localStorage.getItem("khuta_goal_score") || "";
    document.getElementById("prof-exam-date").value = localStorage.getItem("khuta_exam_date") || "";

    renderAvatarDisplay();
    updateProfileHeader();
    renderFrameShop();
}

function updateProfileHeader(){
    const name = localStorage.getItem("khuta_name") || "";
    const last = localStorage.getItem("khuta_last") || "";
    document.getElementById("profile-display-name").textContent = `${name} ${last}`.trim() || "—";

    const goalId = localStorage.getItem("khuta_goal_uni");
    const uni = getUniversitiesList().find(u => u.id === goalId);
    const goalScore = localStorage.getItem("khuta_goal_score");
    const goalEl = document.getElementById("profile-display-goal");
    if(uni){
        goalEl.textContent = (currentLang==='ar' ? "الهدف: " : "Target: ") + uniName(uni) + (goalScore ? ` (${goalScore}%)` : "");
    } else {
        goalEl.textContent = t("profile.noGoal");
    }
}

function handleAvatarUpload(e){
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        localStorage.setItem("khuta_avatar", ev.target.result);
        localStorage.removeItem("khuta_avatar_preset"); // الصورة المرفوعة والرمز الجاهز لا يجتمعان معاً
        renderAvatarDisplay();
        debouncedSync();
    };
    reader.readAsDataURL(file);
}

function saveProfile(e){
    e.preventDefault();
    localStorage.setItem("khuta_name", document.getElementById("prof-name").value.trim());
    localStorage.setItem("khuta_last", document.getElementById("prof-last").value.trim());
    localStorage.setItem("khuta_birth", document.getElementById("prof-birth").value);
    localStorage.setItem("khuta_gender", document.getElementById("prof-gender").value);
    localStorage.setItem("khuta_track", document.getElementById("prof-track").value);
    localStorage.setItem("khuta_goal_uni", document.getElementById("prof-goal-uni").value);
    localStorage.setItem("khuta_goal_score", document.getElementById("prof-goal-score").value);

    updateWelcomeText();
    updateProfileHeader();
    showToast(t("toast.saved"));
    debouncedSync();
    return false;
}

