/* ============================================================
   خُطى — Service Worker
   ------------------------------------------------------------
   الهدف الوحيد لهذا الملف: السماح بتثبيت الموقع كتطبيق (PWA) وتحسين
   سرعة التحميل. لا يلمس إطلاقاً أي طلب خارج نطاق الموقع نفسه (Supabase،
   Gemini، الخطوط، GitHub) — تمر هذه دائماً مباشرة للشبكة بدون أي تدخل،
   لتفادي أي احتمال لعرض بيانات قديمة مخزَّنة مؤقتاً.
   ============================================================ */
// ارفع رقم النسخة مع أي تغيير في قائمة الملفات أدناه.
const CACHE_NAME = "khuta-shell-v2";
// app.js قُسّم إلى js/*.js فصار لا بد من سردها بالاسم هنا.
//
// ملاحظة للمطوّر: لست مضطراً لتذكّر تحديث هذه القائمة. لو أضفت ملفاً جديداً
// ولم تكتبه هنا، سيُخزَّن تلقائياً بمجرد أول زيارة للموقع باتصال (عبر معالج
// fetch أدناه)، ولو حذفت ملفاً وتركت اسمه هنا فلن يتعطّل شيء أيضاً — انظر
// سبب ذلك في تعليق install أدناه.
const SHELL_FILES = [
  "./", "./index.html", "./styles.css", "./manifest.json",
  "./icon-192.png", "./icon-512.png",
  "./js/01-core-config.js",
  "./js/02-universities.js",
  "./js/03-i18n.js",
  "./js/04-utils.js",
  "./js/05-boot-nav.js",
  "./js/06-schedule.js",
  "./js/07-focus.js",
  "./js/08-calc-profile.js",
  "./js/09-features.js",
  "./js/10-account.js",
  "./js/11-community.js",
  "./js/12-ai.js",
];

self.addEventListener("install", (event) => {
  // ⚠️ نخزّن كل ملف على حدة عمداً بدل cache.addAll: الأخيرة ترفض العملية
  // بالكامل لو فشل ملف واحد فقط من القائمة (اسم خاطئ أو ملف حُذف)، فتضيع
  // كل قدرة العمل بدون إنترنت دفعة واحدة وبصمت. بهذه الطريقة يكلّف أي اسم
  // قديم في القائمة ملفه وحده لا غير، ويبقى الباقي مخزَّناً وشغّالاً.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(SHELL_FILES.map((f) =>
        cache.add(f).catch((e) => console.warn("[خُطى][sw] تعذّر تخزين", f, e))
      ))
    ).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // أي طلب لنطاق آخر (Supabase، Gemini، الخطوط، GitHub، إلخ) — تجاهل تماماً، يذهب للشبكة كالمعتاد
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== "GET") return;

  // شبكة أولاً دائماً (لضمان أحدث نسخة من الكود عند توفر اتصال)، والرجوع
  // للنسخة المخزَّنة فقط عند انقطاع الاتصال بالكامل
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ============================================================
   إشعارات Push الحقيقية — تصل حتى مع إغلاق الموقع تماماً. الإشعار
   يُرسَل من دالة Netlify مجدولة يومياً (netlify/functions/send-reminders.js)،
   وهذا الجزء هنا فقط يستقبله ويعرضه للطالب.
   ============================================================ */
self.addEventListener("push", (event) => {
  let payload = { title: "خُطى", body: "لا تنسَ جلستك اليوم!" };
  try { if (event.data) payload = event.data.json(); } catch (e) { /* نص عادي بدل JSON */ }

  event.waitUntil(
    self.registration.showNotification(payload.title || "خُطى", {
      body: payload.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      dir: "rtl",
      lang: "ar",
      tag: "khuta-daily-reminder",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
