/* ============================================================
   3) أدوات عامة
   ============================================================ */
/* ============================================================
   تفاعلات دقيقة (Micro Interactions) — اهتزاز خفيف عند الخطأ، صوت رضا عند
   الإنجاز، Confetti عند الأهداف الكبيرة. كلها تتحقق من الدعم أولاً ولا
   تكسر شيئاً على جهاز أو متصفح لا يدعمها (iOS Safari مثلاً لا يدعم
   الاهتزاز إطلاقاً — يتجاهلها بصمت بدل أي خطأ).
   ============================================================ */
function hapticError(){
    if(navigator.vibrate) try{ navigator.vibrate(45); }catch(e){}
}
function hapticSuccess(){
    if(navigator.vibrate) try{ navigator.vibrate([25,40,25]); }catch(e){}
}

let __khutaAudioCtx = null;
// نغمة رضا قصيرة نولّدها برمجياً (Web Audio API) بدل ملف صوتي خارجي — لا
// حاجة لاستضافة أي أصل صوتي، وتعمل فوراً بلا تحميل
function playCompletionSound(){
    try{
        if(!__khutaAudioCtx) __khutaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const ctx = __khutaAudioCtx;
        if(ctx.state === "suspended") ctx.resume();
        const now = ctx.currentTime;
        [523.25, 659.25].forEach((freq, i) => { // مي-صول: نغمتان قصيرتان صاعدتان، رضا لا إلحاح
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0, now + i*0.09);
            gain.gain.linearRampToValueAtTime(0.12, now + i*0.09 + 0.015);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i*0.09 + 0.22);
            osc.connect(gain); gain.connect(ctx.destination);
            osc.start(now + i*0.09); osc.stop(now + i*0.09 + 0.25);
        });
    }catch(e){ /* بعض المتصفحات تمنع الصوت قبل أول تفاعل مباشر من المستخدم — نتجاهل بصمت */ }
}

// Confetti خفيف بلا أي مكتبة خارجية — جسيمات CSS بسيطة تتساقط وتدور، تُزال
// نفسها تلقائياً بعد انتهاء الحركة
function triggerConfetti(){
    if(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // نحترم تفضيل تقليل الحركة
    const colors = ["#C9962E","#1C8A72","#D6455A","#2E6BE0","#E8C77E"];
    const container = document.createElement("div");
    container.className = "confetti-container";
    for(let i = 0; i < 60; i++){
        const piece = document.createElement("span");
        piece.className = "confetti-piece";
        piece.style.left = (Math.random()*100) + "%";
        piece.style.background = colors[i % colors.length];
        piece.style.animationDelay = (Math.random()*0.4) + "s";
        piece.style.animationDuration = (2.2 + Math.random()*1.2) + "s";
        piece.style.setProperty("--drift", (Math.random()*140 - 70) + "px");
        container.appendChild(piece);
    }
    document.body.appendChild(container);
    setTimeout(() => container.remove(), 3800);
}

function showToast(msg){
    const toast = document.getElementById("toast");
    document.getElementById("toast-text").textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    // مدة أطول للرسائل الأطول حتى يتسنى قراءتها فعلياً قبل اختفائها
    const duration = Math.max(5000, Math.min(9000, msg.length * 80));
    showToast._t = setTimeout(() => toast.classList.remove("show"), duration);
}

/* ============================================================
   38) مركز الإشعارات — سجلّ دائم (30 إشعاراً كحد أقصى) يظهر عبر
   جرس أعلى الصفحة، بالإضافة لعرض الإشعار فوراً كـ toast من الأسفل
   ============================================================ */
const NOTIFICATIONS_MAX = 30;
function getNotifications(){
    try{ return JSON.parse(localStorage.getItem("khuta_notifications")) || []; }catch(e){ return []; }
}
function pushNotification(titleAr, titleEn, bodyAr, bodyEn, icon){
    const list = getNotifications();
    list.unshift({
        id: Date.now() + "-" + Math.random().toString(36).slice(2,7),
        titleAr, titleEn, bodyAr, bodyEn,
        icon: icon || "fa-bell",
        ts: Date.now(),
        read: false,
    });
    localStorage.setItem("khuta_notifications", JSON.stringify(list.slice(0, NOTIFICATIONS_MAX)));
    renderNotificationBell();
    showToast(currentLang==='ar' ? titleAr : titleEn);
}
function markAllNotificationsRead(){
    const list = getNotifications();
    list.forEach(n => n.read = true);
    localStorage.setItem("khuta_notifications", JSON.stringify(list));
    renderNotificationBell();
}
function clearAllNotifications(){
    localStorage.setItem("khuta_notifications", "[]");
    renderNotificationBell();
    toggleNotificationPanel(false);
}
function timeAgoLabel(ts){
    const diffMin = Math.round((Date.now() - ts) / 60000);
    if(diffMin < 1) return currentLang==='ar' ? "الآن" : "now";
    if(diffMin < 60) return currentLang==='ar' ? `قبل ${diffMin} د` : `${diffMin}m ago`;
    const diffH = Math.round(diffMin / 60);
    if(diffH < 24) return currentLang==='ar' ? `قبل ${diffH} س` : `${diffH}h ago`;
    const diffD = Math.round(diffH / 24);
    return currentLang==='ar' ? `قبل ${diffD} يوم` : `${diffD}d ago`;
}
function renderNotificationBell(){
    const badge = document.getElementById("notif-bell-badge");
    const focusBadge = document.getElementById("focus-header-bell-badge");
    const list = getNotifications();
    const unread = list.filter(n => !n.read).length;
    if(badge){
        badge.style.display = unread > 0 ? "flex" : "none";
        badge.textContent = unread > 9 ? "9+" : unread;
    }
    if(focusBadge){
        focusBadge.style.display = unread > 0 ? "flex" : "none";
        focusBadge.textContent = unread > 9 ? "9+" : unread;
    }
    const panelList = document.getElementById("notif-panel-list");
    if(!panelList) return;
    if(!list.length){
        panelList.innerHTML = `<div class="empty-note" style="padding:24px 10px;">${currentLang==='ar'?'لا توجد إشعارات بعد':'No notifications yet'}</div>`;
        return;
    }
    panelList.innerHTML = list.map(n => `
        <div class="notif-row ${n.read?'':'unread'}">
            <div class="notif-row-icon"><i class="fa-solid ${n.icon}"></i></div>
            <div class="notif-row-body">
                <b>${escapeHtml(currentLang==='ar'?n.titleAr:n.titleEn)}</b>
                <p>${escapeHtml(currentLang==='ar'?n.bodyAr:n.bodyEn)}</p>
                <span>${timeAgoLabel(n.ts)}</span>
            </div>
        </div>`).join("");
}
function toggleNotificationPanel(forceState){
    const panel = document.getElementById("notif-panel");
    const isOpen = panel.style.display !== "none" && !panel.classList.contains("panel-closing");
    const show = forceState !== undefined ? forceState : !isOpen;
    // اللوحة مثبَّتة أصلاً بجانب جرس رأس الصفحة الرئيسي — لكن ذلك الرأس يختفي
    // خلف طبقة وضع التركيز الكامل (z-index أعلى بكثير)، فإن فُتحت من هناك
    // نعيد وضعها فعلياً بجانب جرس وضع التركيز العائم بدل أن تظهر خلف كل شيء
    const overlay = document.getElementById("focus-mode-overlay");
    const inFocusMode = overlay && overlay.style.display !== "none";
    const focusBell = document.getElementById("focus-header-bell");
    // نحفظ مكان اللوحة الأصلي (بجانب جرس الرأس الرئيسي) لإعادتها إليه لاحقاً
    if(!panel.__homeParent) panel.__homeParent = panel.parentElement;
    if(show && inFocusMode && focusBell){
        // إصلاح جذري: الرأس الرئيسي عليه backdrop-filter، وهذا يجعله "حاوية
        // احتواء" لأي عنصر position:fixed بداخله ويحبس اللوحة داخل سياق تراصّ
        // يقع تحت طبقة وضع التركيز (z-index:7000) — فتُفتح اللوحة لكنها لا
        // تُرى أبداً. الحل: نقل اللوحة فعلياً داخل طبقة وضع التركيز نفسها.
        overlay.appendChild(panel);
        const r = focusBell.getBoundingClientRect();
        panel.style.position = "fixed";
        panel.style.top = (r.bottom + 12) + "px";
        panel.style.insetInlineEnd = (window.innerWidth - r.right) + "px";
        panel.style.zIndex = "7500";
    } else if(!show || !inFocusMode){
        // ملاحظة: عند الإغلاق لا نعيد اللوحة لمكانها الأصلي فوراً — مؤقّت
        // الإغلاق أدناه يتكفّل بذلك بعد انتهاء أنيميشن الاختفاء، وإلا قفزت
        // اللوحة بصرياً لموضع الرأس الرئيسي في منتصف الحركة
        if(!inFocusMode && panel.parentElement === panel.__homeParent){
            panel.style.position = "";
            panel.style.top = "";
            panel.style.insetInlineEnd = "";
            panel.style.zIndex = "";
        }
    }
    // إظهار/إخفاء بأنيميشن انسيابي بدل الظهور والاختفاء اللحظيين
    clearTimeout(panel.__closeTimer);
    if(show){
        panel.classList.remove("panel-closing");
        panel.style.display = "flex";
        markAllNotificationsRead();
    } else if(panel.style.display !== "none"){
        panel.classList.add("panel-closing");
        panel.__closeTimer = setTimeout(() => {
            panel.style.display = "none";
            panel.classList.remove("panel-closing");
            if(panel.__homeParent && panel.parentElement !== panel.__homeParent){
                panel.__homeParent.appendChild(panel);
                panel.style.position = ""; panel.style.top = "";
                panel.style.insetInlineEnd = ""; panel.style.zIndex = "";
            }
        }, 260);
    }
}
document.addEventListener("click", (e) => {
    const wrap = document.querySelector(".notif-bell-wrap");
    const panel = document.getElementById("notif-panel");
    const focusBell = document.getElementById("focus-header-bell");
    if(!wrap || !panel || panel.style.display === "none") return;
    // كان هذا المستمع يغلق اللوحة فور فتحها من جرس وضع التركيز، لأن ذلك الجرس
    // ليس داخل .notif-bell-wrap — نستثنيه هو واللوحة نفسها (بعد نقلها) صراحةً
    if(wrap.contains(e.target)) return;
    if(focusBell && focusBell.contains(e.target)) return;
    if(panel.contains(e.target)) return;
    toggleNotificationPanel(false);
});

function uniName(u){ return currentLang === "ar" ? u.name : u.nameEn; }
function uniNote(u){ return currentLang === "ar" ? u.note : u.noteEn; }
function uniCity(u){ return (currentLang === "ar" || !u.cityEn) ? u.city : u.cityEn; }

/* يدمج قائمة خارجية فوق القائمة المدمجة بالكود، بمطابقة "id":
     - عنصر بنفس الـid  → النسخة الخارجية تحلّ محل المدمجة (تعديل)
     - عنصر بـid جديد   → يُضاف في النهاية (إضافة)
     - عنصر غائب من الملف الخارجي → يبقى كما هو في الكود

   لماذا دمج لا استبدال؟ لأن الاستبدال يجعل الحذف حادثاً صامتاً: ملف ناقص
   (أو أحد يحذف سطراً بالخطأ) كان سيمحو عشرات العناصر من الموقع دون أي إنذار.
   للإخفاء المتعمَّد استعمل "hidden": true بدل الحذف — صريح وقابل للتراجع. */
function mergeById(builtIn, remote){
    if(!Array.isArray(remote) || !remote.length) return builtIn.filter(x => !x.hidden);
    const overrides = new Map(remote.filter(x => x && isText(x.id)).map(x => [x.id, x]));
    const merged = builtIn.map(x => overrides.has(x.id) ? overrides.get(x.id) : x);
    const known = new Set(builtIn.map(x => x.id));
    for(const x of overrides.values()) if(!known.has(x.id)) merged.push(x);
    return merged.filter(x => !x.hidden);
}

function getUniversitiesList(){
    return mergeById(UNIVERSITIES, window.__REMOTE_UNIS__);
}

async function tryLoadUniversitiesFromSupabase(){
    if(!sb) return;
    try{
        const { data, error } = await sb.from("universities").select("*").order("sort_order");
        if(error || !data || !data.length) return;
        window.__REMOTE_UNIS__ = data.map(row => ({
            id: row.id, name: row.name, nameEn: row.name_en, city: row.city, cityEn: row.city_en, type: row.type,
            weights: row.weight_high == null ? null : {
                high: row.weight_high, qat: row.weight_qat, tah: row.weight_tah,
                ...(row.weight_step != null ? { step: row.weight_step } : {})
            },
            step: row.step === "true" ? true : row.step === "false" ? false : "partial",
            stepMin: row.step_min, comp: row.comp, note: row.note, noteEn: row.note_en,
        }));
        populateUniSelects();
    }catch(e){ console.error("[خُطى] تعذّر جلب الجامعات من Supabase:", e); }
}

/* يفحص جامعة واحدة. يعيد سبب الرفض نصاً، أو null إن كانت سليمة.
   الأوزان تحديداً حرجة: مجموع خاطئ يعني نسبة قبول خاطئة تُعرض للطالب
   ويبني عليها قراره — أخطر بكثير من ظهور خطأ واضح. */
function uniRejectionReason(u, i){
    if(!u || typeof u !== "object") return `العنصر رقم ${i + 1} ليس كائناً`;
    if(!isText(u.id)) return `الجامعة رقم ${i + 1} بلا "id"`;
    if(!isText(u.name)) return `"${u.id}" بلا "name"`;
    // weights = null مقصود وشرعي: جامعات خاصة تعتمد نظام قبول خاص بها بلا
    // معادلة أوزان (الواجهة تعرض لها ملاحظة بديلة). نعاملها كغياب الحقل تماماً.
    if(u.weights !== undefined && u.weights !== null){
        const w = u.weights;
        if(typeof w !== "object" || Array.isArray(w)) return `"${u.id}": "weights" ليس كائناً`;
        const parts = ["high", "qat", "tah", "step"].filter(k => w[k] !== undefined);
        for(const k of parts){
            if(typeof w[k] !== "number" || !isFinite(w[k]) || w[k] < 0)
                return `"${u.id}": الوزن "${k}" ليس رقماً صالحاً`;
        }
        const sum = parts.reduce((a, k) => a + w[k], 0);
        // نسمح بفارق ضئيل جداً تحسّباً لأرقام عشرية
        if(Math.abs(sum - 100) > 0.01)
            return `"${u.id}": مجموع الأوزان ${sum} وليس 100`;
    }
    return null;
}

async function tryLoadRemoteUniversities(){
    if(!REMOTE_UNIVERSITIES_URL) return;
    try{
        const res = await fetch(REMOTE_UNIVERSITIES_URL, {cache:"no-store"});
        if(!res.ok) return;
        const json = await res.json();
        if(!Array.isArray(json) || !json.length)
            return rejectRemote("الجامعات وتخصيصها.json", "الملف ليس قائمة جامعات غير فارغة");

        // نستبعد الجامعات المعطوبة فقط بدل رفض الملف كله — خطأ في جامعة واحدة
        // لا يجب أن يُلغي تحديث الثلاثين الأخرى
        const good = [], bad = [];
        json.forEach((u, i) => {
            const why = uniRejectionReason(u, i);
            if(why) bad.push(why); else good.push(u);
        });
        if(bad.length) console.warn(`[خُطى] استُبعدت ${bad.length} جامعة من ملف GitHub:\n  - ` + bad.join("\n  - "));
        if(!good.length)
            return rejectRemote("الجامعات وتخصيصها.json", "لم تجتز أي جامعة الفحص");

        window.__REMOTE_UNIS__ = good;
        populateUniSelects();
    }catch(e){
        console.warn("[خُطى] تعذّر قراءة \"الجامعات وتخصيصها.json\" (خطأ صياغة JSON غالباً) — نستمر بالقائمة المدمجة.", e);
    }
}

/* ============================================================
   4) الساعة والتاريخ الحيّان
   ============================================================ */
setInterval(() => {
    const now = new Date();
    const locale = currentLang === "ar" ? "ar-SA" : "en-US";
    const timeStr = now.toLocaleTimeString(locale, {hour:"2-digit", minute:"2-digit", second:"2-digit"});
    const dateStr = now.toLocaleDateString(locale, { weekday:"long", year:"numeric", month:"long", day:"numeric" });
    document.getElementById("live-clock").textContent = timeStr;
    document.getElementById("live-date").textContent = dateStr;
    const focusClock = document.getElementById("focus-header-clock");
    const focusDate = document.getElementById("focus-header-date");
    // في وضع التركيز الكامل: ساعات ودقائق فقط (بلا ثوانٍ) لتوفير المساحة وتقليل التشتيت
    if(focusClock) focusClock.textContent = now.toLocaleTimeString(locale, {hour:"2-digit", minute:"2-digit"});
    if(focusDate) focusDate.textContent = dateStr;
}, 1000);

// عبارات تتناوب أسفل حلقة التحميل بينما البيانات الحقيقية لا تزال تُجلَب —
// لمسة بصرية بحتة، لا صلة لها بالتقدّم الفعلي (الحلقة نفسها هي التي تعكسه)
const LOADING_CAPTIONS_AR = ["نجهّز رحلتك…", "نرتب جدولك…", "نحضّر بياناتك…", "على وشك الجاهزية…"];
const LOADING_CAPTIONS_EN = ["Getting your journey ready…", "Setting up your schedule…", "Fetching your data…", "Almost there…"];
let loadingCaptionTimer = null;
function startLoadingCaptionRotation(){
    const el = document.getElementById("loading-caption");
    if(!el) return;
    const list = currentLang === "ar" ? LOADING_CAPTIONS_AR : LOADING_CAPTIONS_EN;
    let i = 0;
    loadingCaptionTimer = setInterval(() => {
        i = (i + 1) % list.length;
        el.style.opacity = "0";
        setTimeout(() => { el.textContent = list[i]; el.style.opacity = "1"; }, 220);
    }, 1600);
}

// يحدّث حلقة التحميل لتعكس نسبة البيانات المكتملة فعلياً (loaded/total) —
// وليست حركة دورانية عشوائية بلا معنى
const LOADING_RING_CIRCUMFERENCE = 263.9; // 2π×42، نفس نصف قطر الدائرة في index.html
function updateLoadingProgress(loaded, total){
    const arc = document.getElementById("loading-ring-arc");
    if(!arc || !total) return;
    const fraction = Math.min(1, loaded / total);
    arc.style.strokeDashoffset = String(LOADING_RING_CIRCUMFERENCE * (1 - fraction));
}

