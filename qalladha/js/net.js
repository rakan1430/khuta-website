/* ============================================================
   قلّدها — التخاطب مع الخادم
   ------------------------------------------------------------
   الغرف تعيش في قاعدة بيانات Supabase، ولا نلمس جداولها
   من هنا إطلاقاً: كل عملية دالة مسمّاة تتحقّق من صاحبها قبل
   أن تفعل شيئاً. الجداول نفسها في مخطّط غير مكشوف لواجهة REST،
   فلا يستطيع أحد قراءتها ولا الكتابة فيها ولو عرف المفتاح.

   والمفتاح أدناه علني بطبيعته (publishable) — موضعه الصحيح
   هو كود المتصفّح، ولا يمنح إلا تنفيذ هذه الدوالّ العشر.
   ============================================================ */
(function (global) {
  "use strict";

  const SUPABASE_URL = "https://fyfltprkehjlzhqfvesx.supabase.co";
  const SUPABASE_KEY = "sb_publishable_77ic-Ihi93aQmQJ0NHWv-A_C4pXY1p9";

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

  async function rpc(fn, args) {
    let res;
    try {
      res = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SUPABASE_KEY,
          authorization: "Bearer " + SUPABASE_KEY,
        },
        body: JSON.stringify(args),
      });
    } catch (e) {
      throw new Error("الشبكة مقطوعة — تأكّد من الاتصال");
    }

    let data = null;
    try { data = await res.json(); } catch (e) {}

    if (!res.ok) {
      /* خطأ من القاعدة نفسها (لا من منطق اللعبة) */
      throw new Error((data && (data.message || data.hint)) || "صار خطأ غير متوقّع");
    }
    /* الدوالّ تردّ رفضها في حقل error برسالة تُعرض للاعب كما هي */
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  global.Net = {
    pid,
    create: (name) => rpc("qalladha_create", { p_pid: pid, p_name: name }),
    join: (code, name) => rpc("qalladha_join", { p_pid: pid, p_name: name, p_code: code }),
    sync: (code, round) => rpc("qalladha_sync", { p_pid: pid, p_code: code, p_round: round }),
    start: (code, challenges) => rpc("qalladha_start", { p_pid: pid, p_code: code, p_challenges: challenges }),
    submit: (code, round, score, parts, audio, mime) =>
      rpc("qalladha_submit", { p_pid: pid, p_code: code, p_round: round, p_score: score, p_parts: parts, p_audio: audio, p_mime: mime }),
    clip: (code, round, who) => rpc("qalladha_clip", { p_pid: pid, p_code: code, p_round: round, p_who: who }),
    ready: (code, round) => rpc("qalladha_ready", { p_pid: pid, p_code: code, p_round: round }),
    target: (code, slot, audio, mime, label) =>
      rpc("qalladha_target", { p_pid: pid, p_code: code, p_slot: slot, p_audio: audio, p_mime: mime, p_label: label || null }),
    getTarget: (code, slot) => rpc("qalladha_gettarget", { p_pid: pid, p_code: code, p_slot: slot }),
    again: (code) => rpc("qalladha_again", { p_pid: pid, p_code: code }),
  };
})(window);
