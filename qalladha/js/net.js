/* ============================================================
   قلّدها — التخاطب مع الخادم
   كل النداءات POST واحدة على /api/room، والفارق بينها حقل op.
   ============================================================ */
(function (global) {
  "use strict";

  function makePid() {
    const s = "abcdefghijklmnopqrstuvwxyz0123456789";
    let out = "";
    for (let i = 0; i < 16; i++) out += s[Math.floor(Math.random() * s.length)];
    return out;
  }

  /* معرّف اللاعب يثبت في الجهاز: لو حدّث الصفحة وسط اللعب يرجع
     إلى مكانه في الغرفة بدل أن يُحسب لاعباً ثالثاً. */
  let pid;
  try {
    pid = localStorage.getItem("qalladha.pid");
    if (!pid) { pid = makePid(); localStorage.setItem("qalladha.pid", pid); }
  } catch (e) {
    pid = makePid();
  }

  async function call(op, params) {
    let res;
    try {
      res = await fetch("/api/room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(Object.assign({ op, pid }, params || {})),
      });
    } catch (e) {
      throw new Error("الشبكة مقطوعة — تأكّد من الاتصال");
    }
    let data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((data && data.error) || "صار خطأ غير متوقّع");
    return data;
  }

  global.Net = {
    pid,
    create: (name) => call("create", { name }),
    join: (code, name) => call("join", { code, name }),
    sync: (code, round) => call("sync", { code, round }),
    start: (code, challenges) => call("start", { code, challenges }),
    submit: (code, round, score, parts, audio, mime) => call("submit", { code, round, score, parts, audio, mime }),
    clip: (code, round, who) => call("clip", { code, round, who }),
    ready: (code, round) => call("ready", { code, round }),
    target: (code, slot, audio, mime) => call("target", { code, slot, audio, mime }),
    getTarget: (code, slot) => call("gettarget", { code, slot }),
    again: (code) => call("again", { code }),
  };
})(window);
