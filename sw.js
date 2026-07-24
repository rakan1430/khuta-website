/* ============================================================
   خُطى — Service Worker
   ------------------------------------------------------------
   الهدف الوحيد لهذا الملف: السماح بتثبيت الموقع كتطبيق (PWA) وتحسين
   سرعة التحميل. لا يلمس إطلاقاً أي طلب خارج نطاق الموقع نفسه (Supabase،
   Gemini، الخطوط، GitHub) — تمر هذه دائماً مباشرة للشبكة بدون أي تدخل،
   لتفادي أي احتمال لعرض بيانات قديمة مخزَّنة مؤقتاً.
   ============================================================ */
const CACHE_NAME = "khuta-shell-v1";
const SHELL_FILES = ["./", "./index.html", "./app.js", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
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
