/* ============================================================
   قلّدها — مجرى اللعبة
   ------------------------------------------------------------
   وضعان يشتركان في كل شيء إلا طريقة التزامن:
   - "شبكة"  : جهازان، غرفة بكود، الخادم يوفّق بينهما.
   - "محلّي" : جهاز واحد يتناوبان عليه، بلا شبكة إطلاقاً.
   ما دون ذلك (الصوت، القياس، النتيجة) كود واحد لا يتكرّر.
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const ar = (n) => String(n).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);

  /* ---------- الحالة ---------- */
  const S = {
    mode: null,
    name: "",
    code: null,
    room: null,
    isHost: false,
    round: 0,
    rounds: 5,
    challengeId: null,
    target: null,          // {buffer, features}
    listened: false,
    busy: false,
    submitted: false,
    myResult: null,
    myClipBuffer: null,
    oppResult: null,
    oppClipBuffer: null,
    revealed: false,
    customs: [],           // [{slot, base64, mime, buffer}]
    localNames: ["اللاعب الأول", "اللاعب الثاني"],
    localTurn: 0,
    localRound: [],        // نتيجتا الجولة الحالية في الوضع المحلّي
    localChallenges: [],
    totals: {},
    counted: [],
    effect: "normal",
    pollTimer: null,
    pollMs: 2000,
  };

  const settings = {
    mic: "", volCh: 90, volSfx: 80, volMusic: 0, dur: 4, tts: true, rounds: 5,
  };

  /* ---------- تخزين محلّي متسامح ---------- */
  function loadSettings() {
    try {
      const raw = localStorage.getItem("qalladha.settings");
      if (raw) Object.assign(settings, JSON.parse(raw));
    } catch (e) {}
  }
  function saveSettings() {
    try { localStorage.setItem("qalladha.settings", JSON.stringify(settings)); } catch (e) {}
  }
  function loadTotals(code) {
    try {
      const raw = localStorage.getItem("qalladha.totals." + code);
      if (raw) {
        const d = JSON.parse(raw);
        return { totals: d.totals || {}, counted: d.counted || [] };
      }
    } catch (e) {}
    return { totals: {}, counted: [] };
  }
  function saveTotals() {
    if (!S.code) return;
    try {
      localStorage.setItem("qalladha.totals." + S.code,
        JSON.stringify({ totals: S.totals, counted: S.counted }));
    } catch (e) {}
  }

  /* ---------- واجهة عامة ---------- */
  const SCREENS = ["screen-home", "screen-lobby", "screen-play", "screen-end"];
  function show(id) {
    SCREENS.forEach((s) => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ---------- اللاعبون ---------- */
  function players() {
    if (S.mode === "local") {
      return [
        { key: "p0", name: S.localNames[0], isMe: true },
        { key: "p1", name: S.localNames[1], isMe: true },
      ];
    }
    const list = (S.room && S.room.players) || [];
    return list.map((p) => ({ key: p.pid, name: p.name, isMe: p.pid === Net.pid }));
  }
  const meKey = () => (S.mode === "local" ? "p0" : Net.pid);
  function oppKey() {
    const p = players().find((x) => !x.isMe);
    return p ? p.key : null;
  }
  const nameOf = (key) => {
    const p = players().find((x) => x.key === key);
    return p ? p.name : "لاعب";
  };

  /* ---------- التعليقات ---------- */
  const LINES = [
    { min: 90, sfx: "airhorn", lines: [
      "يا شيخ! الصوت الأصلي اتصل يسأل عنك.",
      "هذا مو تقليد… هذا انتحال شخصية كامل.",
      "لو فيه بطولة عالمية للتقليد كان سافرت.",
    ]},
    { min: 78, sfx: "applause", lines: [
      "قريب جداً! ناقصك رشّة جنون بس.",
      "والله إنك فنان — والأصل زعلان منك.",
      "نص الحاضرين صدّقوا إنه الأصل.",
    ]},
    { min: 62, sfx: "tada", lines: [
      "تقليد محترم، ما نقدر ننكر.",
      "سمعناه ومشى، ما فيه اعتراض كبير.",
      "لو زوّدت شوي كنت خطفت الجولة.",
    ]},
    { min: 45, sfx: "boing", lines: [
      "سمعنا شيء… وفهمنا نصّه.",
      "أقرب من الصدفة، وأبعد من الإتقان.",
      "الصوت طلع من عندك، وضاع في الطريق.",
    ]},
    { min: 28, sfx: "sad", lines: [
      "هذا مو تقليد، هذا اجتهاد شخصي.",
      "نعتذر لعائلة الصوت الأصلي.",
      "لو فيه جائزة للشجاعة كانت لك.",
    ]},
    { min: 0, sfx: "crickets", lines: [
      "وش كان هذا؟ لا تعيدها بالليل.",
      "المايك يطلب إجازة مفتوحة.",
      "حتى الصوت الأصلي ما عرف نفسه.",
    ]},
  ];
  function bandFor(score) {
    return LINES.find((b) => score >= b.min) || LINES[LINES.length - 1];
  }
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (a) => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* ---------- التحديات ---------- */
  function buildChallenges(rounds) {
    const builtins = shuffle(Sound.CHALLENGES.map((c) => c.id));
    const customs = S.customs.map((c) => "custom:" + c.slot);
    const list = shuffle(customs.concat(builtins)).slice(0, rounds);
    return shuffle(list);
  }

  function challengeMeta(id) {
    if (id && id.indexOf("custom:") === 0) {
      return { emoji: "🎤", name: "تحدّي من عندكم", hint: "صوت سجّلتموه بأنفسكم — قلّدوه!" };
    }
    const def = Sound.byId(id);
    return def
      ? { emoji: def.emoji, name: def.name, hint: def.hint }
      : { emoji: "🎧", name: "صوت", hint: "" };
  }

  async function loadTarget(id) {
    if (id && id.indexOf("custom:") === 0) {
      const slot = id.slice(7);
      const local = S.customs.find((c) => c.slot === slot);
      if (local && local.buffer) return local.buffer;
      const t = await Net.getTarget(S.code, slot);
      const blob = Sound.base64ToBlob(t.audio, t.mime);
      return await Sound.decode(await blob.arrayBuffer());
    }
    return await Sound.loadChallenge(id);
  }

  /* ============================================================
     الصفحة الأولى
     ============================================================ */
  function myName() {
    const v = $("inp-name").value.trim();
    return v || "لاعب";
  }

  async function createRoom() {
    if (S.busy) return;
    S.busy = true;
    try {
      S.name = myName();
      const d = await Net.create(S.name);
      S.mode = "online";
      S.room = d.room;
      S.code = d.room.code;
      S.isHost = true;
      S.totals = {};
      S.counted = [];
      saveTotals();
      try { history.replaceState(null, "", "?r=" + S.code); } catch (e) {}
      enterLobby();
    } catch (e) {
      toast(e.message);
    } finally {
      S.busy = false;
    }
  }

  async function joinRoom() {
    if (S.busy) return;
    const code = $("inp-code").value.trim().toUpperCase();
    if (code.length !== 4) { toast("الكود أربع خانات"); return; }
    S.busy = true;
    try {
      S.name = myName();
      const d = await Net.join(code, S.name);
      S.mode = "online";
      S.room = d.room;
      S.code = code;
      S.isHost = d.room.hostPid === Net.pid;
      const saved = loadTotals(code);
      S.totals = saved.totals;
      S.counted = saved.counted;
      try { history.replaceState(null, "", "?r=" + S.code); } catch (e) {}
      if (d.room.phase === "play") enterRound(d.room.round);
      else enterLobby();
    } catch (e) {
      toast(e.message);
    } finally {
      S.busy = false;
    }
  }

  function startLocal() {
    S.mode = "local";
    S.code = null;
    S.isHost = true;
    S.customs = [];
    S.totals = { p0: 0, p1: 0 };
    S.counted = [];
    enterLobby();
  }

  /* ============================================================
     غرفة الانتظار
     ============================================================ */
  function enterLobby() {
    stopPolling();
    const online = S.mode === "online";
    $("lobby-online").hidden = !online;
    $("lobby-local").hidden = online;
    $("host-controls").hidden = !S.isHost;
    $("guest-wait").hidden = S.isHost;
    $("btn-start").disabled = online && (!S.room || S.room.players.length < 2);
    if (online) {
      $("lobby-code").textContent = S.code;
      renderPlayers();
      startPolling(2000);
    }
    renderCustoms();
    show("screen-lobby");
  }

  function renderPlayers() {
    const ul = $("player-list");
    ul.innerHTML = "";
    const list = players();
    list.forEach((p) => {
      const li = document.createElement("li");
      const dot = document.createElement("span");
      dot.className = "dot";
      const label = document.createElement("span");
      label.textContent = p.name + (p.isMe ? " (أنت)" : "");
      li.append(dot, label);
      ul.appendChild(li);
    });
    if (list.length < 2) {
      const li = document.createElement("li");
      li.className = "is-empty";
      li.textContent = "ننتظر صاحبك يدخل بالكود…";
      ul.appendChild(li);
    }
  }

  function renderCustoms() {
    const ul = $("custom-list");
    ul.innerHTML = "";
    S.customs.forEach((c, i) => {
      const li = document.createElement("li");
      const label = document.createElement("span");
      label.textContent = "تحدّي " + ar(i + 1);
      const wrap = document.createElement("span");
      wrap.className = "clip-btns";
      const play = document.createElement("button");
      play.type = "button";
      play.className = "btn btn-mint";
      play.textContent = "▶️";
      play.setAttribute("aria-label", "استمع للتحدي " + ar(i + 1));
      play.onclick = async () => {
        if (!c.buffer) c.buffer = await Sound.decode(await Sound.base64ToBlob(c.base64, c.mime).arrayBuffer());
        Sound.playBuffer(c.buffer, {});
      };
      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-ghost";
      del.textContent = "حذف";
      del.onclick = () => { S.customs.splice(i, 1); renderCustoms(); };
      wrap.append(play, del);
      li.append(label, wrap);
      ul.appendChild(li);
    });
  }

  async function recordCustom() {
    const btn = $("btn-rec-custom");
    if (S.busy) return;
    S.busy = true;
    const original = btn.textContent;
    try {
      await Sound.unlock();
      for (let i = 3; i >= 1; i--) {
        btn.textContent = "يبدأ بعد " + ar(i) + "…";
        Sound.sfx("tick");
        await wait(700);
      }
      btn.textContent = "🔴 سجّل الآن…";
      Sound.sfx("go");
      const { blob, mime } = await Sound.record(5000, settings.mic, null);
      btn.textContent = "نجهّز…";
      const base64 = await Sound.blobToBase64(blob);
      const buffer = await Sound.decode(await blob.arrayBuffer());
      const slot = "c" + (S.customs.length + 1) + Math.floor(Math.random() * 90 + 10);
      if (S.mode === "online") await Net.target(S.code, slot, base64, mime);
      S.customs.push({ slot, base64, mime, buffer });
      renderCustoms();
      toast("انحفظ! صار أحد التحديات.");
    } catch (e) {
      toast(micError(e));
    } finally {
      btn.textContent = original;
      S.busy = false;
    }
  }

  async function startGame() {
    if (S.busy) return;
    S.busy = true;
    try {
      if (S.mode === "local") {
        S.localNames = [
          $("inp-p1").value.trim() || "اللاعب الأول",
          $("inp-p2").value.trim() || "اللاعب الثاني",
        ];
        S.localChallenges = buildChallenges(settings.rounds);
        S.rounds = S.localChallenges.length;
        S.totals = { p0: 0, p1: 0 };
        enterRound(0);
      } else {
        const list = buildChallenges(settings.rounds);
        const d = await Net.start(S.code, list);
        S.room = d.room;
        S.totals = {};
        S.counted = [];
        saveTotals();
        enterRound(d.room.round);
      }
    } catch (e) {
      toast(e.message);
    } finally {
      S.busy = false;
    }
  }

  /* ============================================================
     الجولة
     ============================================================ */
  async function enterRound(r) {
    stopPolling();
    S.round = r;
    S.listened = false;
    S.submitted = false;
    S.revealed = false;
    S.myResult = null;
    S.oppResult = null;
    S.myClipBuffer = null;
    S.oppClipBuffer = null;
    S.localRound = [];
    S.localTurn = 0;
    S.target = null;
    S.effect = "normal";

    S.challengeId = S.mode === "local" ? S.localChallenges[r] : S.room.challenges[r];
    S.rounds = S.mode === "local" ? S.localChallenges.length : S.room.rounds;

    const meta = challengeMeta(S.challengeId);
    $("ch-emoji").textContent = meta.emoji;
    $("ch-name").textContent = meta.name;
    $("ch-hint").textContent = meta.hint;
    $("round-label").textContent = "الجولة " + ar(r + 1) + " من " + ar(S.rounds);
    $("result").hidden = true;
    $("stage").hidden = false;
    $("btn-next").hidden = false;
    $("wait-note").hidden = true;
    renderScoreboard();
    resetRecordButton();
    show("screen-play");

    if (S.mode === "local") {
      showPass(0);
    } else {
      $("pass-card").hidden = true;
      $("turn-note").hidden = true;
      startPolling(2500);
    }

    /* تحضير الصوت الأصلي وبصمته — بعد رسم الشاشة كي لا تتجمّد */
    setTimeout(async () => {
      try {
        const buffer = await loadTarget(S.challengeId);
        S.target = { buffer, features: Scoring.extract(buffer) };
        $("btn-listen").disabled = false;
      } catch (e) {
        toast("تعذّر تجهيز صوت التحدي");
      }
    }, 30);
    $("btn-listen").disabled = true;
  }

  function showPass(turn) {
    S.localTurn = turn;
    $("pass-card").hidden = false;
    $("stage").hidden = true;
    $("pass-name").textContent = S.localNames[turn];
  }

  function beginTurn() {
    $("pass-card").hidden = true;
    $("stage").hidden = false;
    S.listened = false;
    resetRecordButton();
    if (S.mode === "local") {
      $("turn-note").hidden = false;
      $("turn-note").innerHTML = "الدور على <strong></strong>";
      $("turn-note").querySelector("strong").textContent = S.localNames[S.localTurn];
    }
  }

  function renderScoreboard() {
    const box = $("scoreboard");
    box.innerHTML = "";
    players().forEach((p) => {
      const chip = document.createElement("span");
      chip.className = "score-chip";
      const nm = document.createElement("span");
      nm.textContent = p.name;
      const b = document.createElement("b");
      b.textContent = ar(S.totals[p.key] || 0);
      chip.append(nm, b);
      box.appendChild(chip);
    });
  }

  function resetRecordButton() {
    const btn = $("btn-record");
    btn.className = "rec-btn";
    btn.disabled = true;
    $("rec-label").textContent = "قلّدها!";
    $("rec-ring").style.transform = "scale(0.75)";
    $("rec-note").textContent = "اسمع الصوت أولاً، ثم اضغط وقلّده.";
  }

  async function listen() {
    if (!S.target) { toast("لحظة، نجهّز الصوت…"); return; }
    await Sound.unlock();
    Sound.stopAll();
    Sound.playBuffer(S.target.buffer, {});
    S.listened = true;
    $("btn-record").disabled = false;
    $("rec-note").textContent = "اسمعه كم مرة تبي — وإذا جهزت اضغط الزر.";
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function micError(e) {
    const n = (e && e.name) || "";
    if (n === "NotAllowedError") return "المتصفح رفض المايك — اسمح له من إعدادات الموقع.";
    if (n === "NotFoundError") return "ما لقينا مايكروفون في الجهاز.";
    if (e && e.message === "no-recorder") return "متصفحك ما يدعم التسجيل — جرّب كروم أو سفاري محدّث.";
    return "تعذّر التسجيل — جرّب مرة ثانية.";
  }

  async function doRecord() {
    if (S.busy || !S.listened) return;
    S.busy = true;
    const btn = $("btn-record");
    const label = $("rec-label");
    const ring = $("rec-ring");
    btn.disabled = true;
    $("btn-listen").disabled = true;

    try {
      await Sound.unlock();
      btn.classList.add("is-count");
      for (let i = 3; i >= 1; i--) {
        label.textContent = ar(i);
        Sound.sfx("tick");
        await wait(650);
      }
      btn.classList.remove("is-count");
      btn.classList.add("is-live");
      label.textContent = "قلّد!";
      $("rec-note").textContent = "نسجّل الآن…";
      Sound.sfx("go");
      await wait(180);

      const ms = settings.dur * 1000;
      const started = Date.now();
      const timer = setInterval(() => {
        const left = Math.ceil((ms - (Date.now() - started)) / 1000);
        label.textContent = left > 0 ? ar(left) : "…";
      }, 200);

      const { blob, mime } = await Sound.record(ms, settings.mic, (lvl) => {
        ring.style.transform = "scale(" + (0.75 + Math.min(lvl, 1) * 0.3).toFixed(3) + ")";
      });
      clearInterval(timer);

      btn.classList.remove("is-live");
      label.textContent = "نحسب…";
      $("rec-note").textContent = "نقارن صوتك بالأصل…";
      await wait(30);

      const buffer = await Sound.decode(await blob.arrayBuffer());
      const mine = Scoring.extract(buffer);
      const verdict = mine
        ? Scoring.compare(S.target.features, mine)
        : { score: 0, silent: true, parts: { tone: 0, pitch: null, rhythm: 0 } };

      S.myClipBuffer = buffer;

      if (S.mode === "local") {
        S.localRound[S.localTurn] = { result: verdict, buffer };
        if (S.localTurn === 0) {
          showPass(1);
          $("rec-note").textContent = "";
        } else {
          revealLocal();
        }
      } else {
        S.myResult = verdict;
        const base64 = await Sound.blobToBase64(blob);
        await Net.submit(S.code, S.round, verdict.score, verdict.parts, base64, mime);
        S.submitted = true;
        label.textContent = "تم ✓";
        $("rec-note").textContent = "ننتظر صاحبك يخلّص تسجيله…";
        startPolling(1500);
      }
    } catch (e) {
      toast(micError(e));
      btn.classList.remove("is-live", "is-count");
      btn.disabled = false;
      $("btn-listen").disabled = false;
      $("rec-label").textContent = "أعد المحاولة";
    } finally {
      S.busy = false;
    }
  }

  /* ---------- كشف النتيجة ---------- */

  function revealLocal() {
    const a = S.localRound[0], b = S.localRound[1];
    S.totals.p0 = (S.totals.p0 || 0) + a.result.score;
    S.totals.p1 = (S.totals.p1 || 0) + b.result.score;
    renderResult([
      { key: "p0", name: S.localNames[0], result: a.result, buffer: a.buffer },
      { key: "p1", name: S.localNames[1], result: b.result, buffer: b.buffer },
    ]);
  }

  async function revealOnline(subs) {
    if (S.revealed) return;
    S.revealed = true;
    const ok = oppKey();
    const mySub = subs[meKey()];
    const oppSub = ok ? subs[ok] : null;
    if (!mySub || !oppSub) { S.revealed = false; return; }

    if (!S.oppClipBuffer) {
      try {
        const c = await Net.clip(S.code, S.round, ok);
        S.oppClipBuffer = await Sound.decode(await Sound.base64ToBlob(c.audio, c.mime).arrayBuffer());
      } catch (e) { /* نكمل بلا تسجيله */ }
    }

    /* جولةٌ حُسبت مرة لا تُحسب ثانية — تحديث الصفحة بعد الكشف كان
       يضاعف النقاط لأن المجموع محفوظ في الجهاز. */
    if (S.counted.indexOf(S.round) === -1) {
      S.totals[meKey()] = (S.totals[meKey()] || 0) + mySub.score;
      S.totals[ok] = (S.totals[ok] || 0) + oppSub.score;
      S.counted.push(S.round);
      saveTotals();
    }

    renderResult([
      { key: meKey(), name: nameOf(meKey()) + " (أنت)", result: mySub, buffer: S.myClipBuffer, isMe: true },
      { key: ok, name: nameOf(ok), result: oppSub, buffer: S.oppClipBuffer },
    ]);
  }

  function dialColor(score) {
    if (score >= 78) return "var(--mint)";
    if (score >= 45) return "var(--gold)";
    return "var(--pink)";
  }

  /* شخصية ثابتة لكل لاعب: مشتقّة من معرّفه فلا تتبدّل بين الجولات،
     ولا تحتاج تخزيناً ولا اختياراً من اللاعب. */
  const AVATARS = ["🦁", "🐯", "🐵", "🐻", "🦊", "🐺", "🦉", "🐨", "🐙", "🦖", "🐲", "🤠"];
  function avatarFor(key) {
    let h = 0;
    for (let i = 0; i < String(key).length; i++) h = (h * 31 + String(key).charCodeAt(i)) >>> 0;
    return AVATARS[h % AVATARS.length];
  }

  const reducedMotion = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { return false; }
  };

  /* ---------- تشغيل بحالة ظاهرة ---------- */
  /* بلا هذا كان اللاعب يضغط "اسمع" فلا يتغيّر شيء في الزرّ، فلا يدري
     أبدأ التشغيل أم لم يستجب الزرّ أصلاً. */
  let activePlay = null;

  function resetPlayBtn() {
    if (!activePlay) return;
    activePlay.el.textContent = activePlay.label;
    activePlay.el.classList.remove("is-playing");
    activePlay = null;
  }

  function playWith(btn, label, buffer, effect) {
    const wasThis = activePlay && activePlay.el === btn;
    Sound.stopAll();
    resetPlayBtn();
    if (wasThis || !buffer) return;          // ضغطة ثانية = إيقاف
    activePlay = { el: btn, label };
    btn.textContent = "⏹️ أوقف";
    btn.classList.add("is-playing");
    Sound.playBuffer(buffer, {
      effect: effect,
      onEnded: () => { if (activePlay && activePlay.el === btn) resetPlayBtn(); },
    });
  }

  /* العدّاد يصعد من الصفر إلى النتيجة، وتصعد معه نقرة تعلو طبقتها،
     ثم يستقرّ برنّة. هذا ما يجعل الكشف لحظةً لا مجرّد رقم يظهر. */
  function animateDial(ring, num, score) {
    return new Promise((resolve) => {
      const paint = (v) => {
        ring.style.background =
          "conic-gradient(" + dialColor(score) + " " + (v * 3.6) + "deg, var(--stage) 0)";
        num.textContent = ar(Math.round(v));
      };
      if (reducedMotion() || score <= 0) { paint(score); resolve(); return; }

      const dur = 700 + Math.min(700, score * 8);
      const t0 = performance.now();
      let lastTick = 0;
      const frame = (now) => {
        const t = Math.min(1, (now - t0) / dur);
        const eased = 1 - Math.pow(1 - t, 3);      // يتباطأ عند الاقتراب
        paint(score * eased);
        if (now - lastTick > 80 && t < 0.96) {
          lastTick = now;
          Sound.sfx("count", { frac: eased });
        }
        if (t < 1) requestAnimationFrame(frame);
        else { Sound.sfx("land"); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  function buildCard(e, isTop, many) {
    const card = document.createElement("div");
    card.className = "rcard is-onstage" + (isTop && many ? " is-winner" : "");

    const dial = document.createElement("div");
    dial.className = "dial";
    dial.style.background = "conic-gradient(" + dialColor(e.result.score) + " 0deg, var(--stage) 0)";
    const inner = document.createElement("span");
    inner.className = "dial-num";
    inner.textContent = ar(0);
    dial.appendChild(inner);

    const body = document.createElement("div");
    body.className = "rcard-body";

    const nm = document.createElement("div");
    nm.className = "rcard-name";
    const face = document.createElement("span");
    face.className = "avatar";
    face.textContent = avatarFor(e.key);
    const who = document.createElement("span");
    who.className = "who";
    who.textContent = e.name;
    nm.append(face, who);
    if (isTop && many) {
      const crown = document.createElement("span");
      crown.className = "crown-badge";
      crown.textContent = "👑";
      crown.hidden = true;                 // يظهر بعد أن تُكشف النتيجتان
      nm.appendChild(crown);
    }

    const bars = document.createElement("div");
    bars.className = "bars";
    const parts = e.result.parts || {};
    const fills = [];
    [["النبرة", parts.tone, "var(--mint)"], ["النغمة", parts.pitch, "var(--gold)"], ["الإيقاع", parts.rhythm, "var(--pink)"]]
      .forEach(([label, value, color]) => {
        const row = document.createElement("div");
        row.className = "bar-row";
        const l = document.createElement("span");
        l.textContent = label;
        const track = document.createElement("span");
        track.className = "bar-track";
        const fill = document.createElement("span");
        fill.className = "bar-fill";
        fill.style.width = "0%";
        fill.style.background = color;
        track.appendChild(fill);
        const b = document.createElement("b");
        b.textContent = value == null ? "—" : ar(value);
        row.append(l, track, b);
        bars.appendChild(row);
        fills.push([fill, value == null ? 0 : value]);
      });

    const btns = document.createElement("div");
    btns.className = "clip-btns";
    const label = e.isMe ? "▶️ اسمع تسجيلك" : "▶️ اسمع تسجيله";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "btn btn-mint";
    play.textContent = label;
    play.disabled = !e.buffer;
    play.onclick = () => playWith(play, label, e.buffer, S.effect);

    const orig = document.createElement("button");
    orig.type = "button";
    orig.className = "btn btn-ghost";
    orig.textContent = "🎧 الأصل";
    orig.onclick = () => {
      if (S.target) playWith(orig, "🎧 الأصل", S.target.buffer, "normal");
    };
    btns.append(play, orig);

    body.append(nm, bars, btns);
    card.append(dial, body);
    return { card, ring: dial, num: inner, fills, crown: nm.querySelector(".crown-badge") };
  }

  async function renderResult(entries) {
    stopPolling();
    resetPlayBtn();
    $("stage").hidden = true;
    $("pass-card").hidden = true;
    $("result").hidden = false;
    $("wait-note").hidden = true;
    $("btn-next").hidden = true;          // لا ينتقل أحد قبل أن ينتهي الكشف
    renderScoreboard();

    const box = $("cards");
    box.innerHTML = "";
    const stageNote = $("stage-note");
    const top = Math.max.apply(null, entries.map((e) => e.result.score));
    const many = entries.length > 1;

    const v = $("verdict");
    v.hidden = true;
    v.innerHTML = "";

    /* كشفٌ واحداً تلو الآخر: كلٌّ يصعد المسرح وحده وتُحسب نتيجته
       أمام الاثنين، بدل أن تظهر البطاقتان دفعةً واحدة بلا تشويق. */
    const built = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const c = buildCard(e, e.result.score === top, many);
      built.push(c);
      box.appendChild(c.card);

      if (many) {
        stageNote.hidden = false;
        stageNote.textContent = "على المسرح: " + e.name.replace(" (أنت)", "");
      }
      await wait(reducedMotion() ? 0 : 260);
      c.fills.forEach(([fill, value]) => { fill.style.width = value + "%"; });
      await animateDial(c.ring, c.num, e.result.score);
      c.card.classList.remove("is-onstage");
      await wait(reducedMotion() ? 0 : 320);
    }
    stageNote.hidden = true;
    built.forEach((c) => { if (c.crown) c.crown.hidden = false; });

    renderEffectChips();

    /* الحكم والتعليق */
    const mine = entries.find((e) => e.isMe) || entries[0];
    const band = bandFor(mine.result.score);
    const line = mine.result.silent ? "ما سمعنا ولا صوت — قرّب المايك شوي." : pick(band.lines);

    const sorted = entries.slice().sort((a, b) => b.result.score - a.result.score);
    let head;
    if (!many) head = "نتيجتك";
    else if (sorted[0].result.score === sorted[1].result.score) head = "تعادل! نفس الدرجة بالضبط.";
    else head = sorted[0].name.replace(" (أنت)", "") + " كسب الجولة بفارق " +
      ar(sorted[0].result.score - sorted[1].result.score) + " نقطة";

    const h = document.createElement("span");
    h.className = "verdict-head";
    h.textContent = head;
    const p = document.createElement("span");
    p.textContent = line;
    v.append(h, p);
    v.hidden = false;

    Sound.sfx(mine.result.silent ? "crickets" : band.sfx);
    setTimeout(() => Sound.speak(line, settings.tts), 700);

    const last = S.round + 1 >= S.rounds;
    $("btn-next").textContent = last ? "النتيجة النهائية 🏁" : "الجولة التالية ⏭️";
    $("btn-next").hidden = false;

    /* صوت الجولة القادمة يُحمَّل الآن، والناس تقرأ النتيجة —
       فلا ينتظره أحد عند بداية الجولة. */
    if (!last) {
      const nextId = S.mode === "local" ? S.localChallenges[S.round + 1]
                                        : (S.room && S.room.challenges[S.round + 1]);
      Sound.prefetch(nextId);
    }
  }

  function renderEffectChips() {
    const box = $("effect-chips");
    box.innerHTML = "";
    Object.keys(Sound.EFFECTS).forEach((key) => {
      const e = Sound.EFFECTS[key];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (S.effect === key ? " is-on" : "");
      b.textContent = e.emoji + " " + e.label;
      b.onclick = () => {
        S.effect = key;
        renderEffectChips();
        toast("اضغط « اسمع » الحين");
      };
      box.appendChild(b);
    });
  }

  /* ---------- التالي ---------- */
  async function nextRound() {
    if (S.mode === "local") {
      if (S.round + 1 >= S.rounds) { showEnd(); return; }
      enterRound(S.round + 1);
      return;
    }
    if (S.busy) return;
    S.busy = true;
    try {
      $("btn-next").hidden = true;
      $("wait-note").hidden = false;
      const d = await Net.ready(S.code, S.round);
      S.room = d.room;
      if (d.room.phase === "end") showEnd();
      else if (d.room.round !== S.round) enterRound(d.room.round);
      else startPolling(1500);
    } catch (e) {
      toast(e.message);
      $("btn-next").hidden = false;
      $("wait-note").hidden = true;
    } finally {
      S.busy = false;
    }
  }

  function showEnd() {
    stopPolling();
    const list = players().map((p) => ({ key: p.key, name: p.name, score: S.totals[p.key] || 0 }));
    list.sort((a, b) => b.score - a.score);

    const card = $("winner-card");
    card.innerHTML = "";
    const crown = document.createElement("span");
    crown.className = "crown";
    const h2 = document.createElement("h2");
    const p = document.createElement("p");

    if (list.length > 1 && list[0].score === list[1].score) {
      crown.textContent = "🤝";
      h2.textContent = "تعادل تام!";
      p.textContent = "لا غالب ولا مغلوب — أعيدوها.";
      Sound.sfx("boing");
    } else {
      crown.textContent = "👑";
      h2.textContent = list[0].name.replace(" (أنت)", "") + " هو الفائز";
      p.textContent = "بمجموع " + ar(list[0].score) + " نقطة" +
        (list.length > 1 ? " مقابل " + ar(list[1].score) : "");
      Sound.sfx("airhorn");
      setTimeout(() => Sound.sfx("applause"), 500);
    }
    card.append(crown, h2, p);

    const box = $("final-cards");
    box.innerHTML = "";
    list.forEach((e, i) => {
      const row = document.createElement("div");
      row.className = "rcard" + (i === 0 ? " is-winner" : "");
      const dial = document.createElement("div");
      dial.className = "dial";
      dial.style.background = i === 0 ? "var(--gold)" : "var(--stage-3)";
      dial.style.color = i === 0 ? "var(--edge)" : "var(--cream)";
      dial.textContent = ar(e.score);
      const body = document.createElement("div");
      body.className = "rcard-body";
      const nm = document.createElement("div");
      nm.className = "rcard-name";
      nm.textContent = e.name;
      body.appendChild(nm);
      row.append(dial, body);
      box.appendChild(row);
    });

    show("screen-end");
  }

  async function playAgain() {
    if (S.mode === "local") {
      S.totals = { p0: 0, p1: 0 };
      S.localChallenges = buildChallenges(settings.rounds);
      S.rounds = S.localChallenges.length;
      enterRound(0);
      return;
    }
    try {
      if (S.isHost) {
        const d = await Net.again(S.code);
        S.room = d.room;
      }
      S.totals = {};
      S.counted = [];
      saveTotals();
      enterLobby();
    } catch (e) {
      toast(e.message);
    }
  }

  function goHome() {
    stopPolling();
    S.mode = null;
    S.code = null;
    S.room = null;
    S.customs = [];
    Sound.releaseMic();
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    show("screen-home");
  }

  /* ============================================================
     النداء الدوري
     ============================================================ */
  let pollGen = 0;
  function startPolling(ms) {
    stopPolling();
    if (S.mode !== "online" || !S.code) return;
    S.pollMs = ms || 2000;
    const gen = pollGen;
    S.pollTimer = setTimeout(() => poll(gen), S.pollMs);
  }
  function stopPolling() {
    /* ترقية الجيل تُبطل أي نداء طائر في الهواء: بغيرها كانت كل
       مناداة لـ enterRound تترك خلفها مؤقّتاً ثانياً يعمل بالتوازي. */
    pollGen++;
    if (S.pollTimer) { clearTimeout(S.pollTimer); S.pollTimer = null; }
  }

  async function poll(gen) {
    if (gen !== pollGen || S.mode !== "online" || !S.code) return;
    try {
      const d = await Net.sync(S.code, S.round);
      if (gen !== pollGen) return;
      await handleSync(d);
    } catch (e) { /* انقطاع عابر: نعاود في الدورة القادمة */ }
    if (gen !== pollGen) return;
    S.pollTimer = setTimeout(() => poll(gen), S.pollMs);
  }

  async function handleSync(d) {
    const room = d.room;
    S.room = room;
    S.isHost = room.hostPid === Net.pid;

    if (!$("screen-lobby").hidden) {
      renderPlayers();
      $("host-controls").hidden = !S.isHost;
      $("guest-wait").hidden = S.isHost;
      $("btn-start").disabled = room.players.length < 2;
      if (room.phase === "play") enterRound(room.round);
      return;
    }

    if (!$("screen-play").hidden) {
      /* الترتيب مقصود: الكشف أولاً، فقد يصل تقدّم الجولة في نفس
         النداء الذي يحمل نتيجة الجولة الحالية. */
      if (!S.revealed && d.revealed) { await revealOnline(d.subs); return; }
      if (room.phase === "play" && room.round !== S.round) { enterRound(room.round); return; }
      if (room.phase === "end" && S.revealed) { showEnd(); return; }
    }
  }

  /* ============================================================
     الإعدادات
     ============================================================ */
  function applyVolumes() {
    Sound.setVolume("challenge", settings.volCh / 100);
    Sound.setVolume("sfx", settings.volSfx / 100);
    Sound.setVolume("music", settings.volMusic / 100);
    if (settings.volMusic > 0) Sound.musicOn(); else Sound.musicOff();
  }

  function syncSettingsUI() {
    $("vol-challenge").value = settings.volCh;
    $("vol-sfx").value = settings.volSfx;
    $("vol-music").value = settings.volMusic;
    $("out-vol-ch").textContent = ar(settings.volCh) + "٪";
    $("out-vol-sfx").textContent = ar(settings.volSfx) + "٪";
    $("out-vol-music").textContent = ar(settings.volMusic) + "٪";
    $("chk-tts").checked = settings.tts;
    document.querySelectorAll("#dur-pick .chip").forEach((c) => {
      c.classList.toggle("is-on", Number(c.dataset.dur) === settings.dur);
    });
    document.querySelectorAll("#rounds-pick .chip").forEach((c) => {
      c.classList.toggle("is-on", Number(c.dataset.rounds) === settings.rounds);
    });
  }

  async function fillMics() {
    const sel = $("sel-mic");
    const mics = await Sound.listMics();
    sel.innerHTML = "";
    const def = document.createElement("option");
    def.value = "";
    def.textContent = "الافتراضي";
    sel.appendChild(def);
    mics.forEach((m, i) => {
      const o = document.createElement("option");
      o.value = m.deviceId;
      o.textContent = m.label || "مايكروفون " + ar(i + 1);
      sel.appendChild(o);
    });
    sel.value = settings.mic || "";
    if (mics.length && !mics[0].label) {
      /* الأسماء لا تظهر قبل إذن المايك — نوضّحها للمستخدم بدل صمتٍ محيّر */
      const note = document.createElement("option");
      note.disabled = true;
      note.textContent = "— الأسماء تظهر بعد السماح بالمايك —";
      sel.appendChild(note);
    }
  }

  async function testMic() {
    if (S.busy) return;
    S.busy = true;
    const btn = $("btn-test-mic");
    const meter = $("test-meter");
    const original = btn.textContent;
    try {
      await Sound.unlock();
      btn.textContent = "🔴 تكلّم…";
      const { blob } = await Sound.record(3000, settings.mic, (lvl) => {
        meter.style.width = Math.min(100, lvl * 140) + "%";
      });
      meter.style.width = "0%";
      btn.textContent = "نشغّل ما سجّلناه…";
      const buffer = await Sound.decode(await blob.arrayBuffer());
      Sound.playBuffer(buffer, {});
      await wait(Math.min(3200, buffer.duration * 1000 + 300));
      toast("سمعت نفسك؟ إذا كان الصوت واطي، قرّب المايك.");
    } catch (e) {
      toast(micError(e));
    } finally {
      btn.textContent = original;
      meter.style.width = "0%";
      S.busy = false;
      fillMics();
    }
  }

  /* ============================================================
     الربط
     ============================================================ */
  function wire() {
    /* أول لمسة تفتح قفل الصوت في الجوال */
    const unlockOnce = () => { Sound.unlock(); document.removeEventListener("pointerdown", unlockOnce); };
    document.addEventListener("pointerdown", unlockOnce);

    $("btn-create").onclick = createRoom;
    $("btn-join").onclick = joinRoom;
    $("btn-local").onclick = startLocal;
    /* ⚠️ لوحة المفاتيح العربية على الحاسوب تُخرج حروفاً عربية، وكان
       المرشّح يبتلعها فيبدو الحقل وكأنه يرفض الحروف ويقبل الأرقام
       وحدها. الحلّ أن نقرأ الزرّ الفيزيائي (e.code) لا الحرف الناتج:
       زرّ «ش» هو KeyA مهما كانت لغة اللوحة. */
    const codeInput = $("inp-code");
    const AR_DIGIT_MAP = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9", "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9" };

    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { joinRoom(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const m = /^Key([A-Z])$/.exec(e.code) || /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
      if (!m) return;                       // نترك Backspace والأسهم وغيرها للمتصفح
      e.preventDefault();
      if (codeInput.value.length >= 4) return;
      codeInput.value = (codeInput.value + m[1]).slice(0, 4);
    });

    /* اللصق والكتابة على الجوال يمرّان من هنا: نحوّل الأرقام العربية
       إلى لاتينية بدل حذفها، ثم نُبقي ما يصلح للكود فقط. */
    codeInput.addEventListener("input", (e) => {
      const mapped = String(e.target.value).replace(/[٠-٩۰-۹]/g, (d) => AR_DIGIT_MAP[d] || "");
      e.target.value = mapped.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    });
    $("inp-name").addEventListener("keydown", (e) => { if (e.key === "Enter") createRoom(); });

    $("btn-share").onclick = async () => {
      const url = location.origin + location.pathname + "?r=" + S.code;
      const text = "تعال نلعب قلّدها — كود الغرفة " + S.code + "\n" + url;
      try {
        if (navigator.share) { await navigator.share({ title: "قلّدها", text: "كود الغرفة " + S.code, url }); return; }
        await navigator.clipboard.writeText(text);
        toast("انسخ الرابط وأرسله لصاحبك ✅");
      } catch (e) {
        toast("الرابط: " + url);
      }
    };

    document.querySelectorAll("#rounds-pick .chip").forEach((c) => {
      c.onclick = () => {
        settings.rounds = Number(c.dataset.rounds);
        saveSettings();
        syncSettingsUI();
      };
    });

    $("btn-rec-custom").onclick = recordCustom;
    $("btn-start").onclick = startGame;
    $("btn-leave").onclick = goHome;
    $("btn-listen").onclick = listen;
    $("btn-record").onclick = doRecord;
    $("btn-pass-ok").onclick = beginTurn;
    $("btn-next").onclick = nextRound;
    $("btn-again").onclick = playAgain;
    $("btn-home").onclick = goHome;

    $("btn-settings").onclick = () => { $("sheet-settings").hidden = false; fillMics(); syncSettingsUI(); };
    $("btn-close-settings").onclick = () => { $("sheet-settings").hidden = true; };
    $("btn-help").onclick = () => { $("sheet-help").hidden = false; };
    $("btn-close-help").onclick = () => { $("sheet-help").hidden = true; };
    [$("sheet-settings"), $("sheet-help")].forEach((sheet) => {
      sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.hidden = true; });
    });

    $("sel-mic").onchange = (e) => { settings.mic = e.target.value; saveSettings(); Sound.releaseMic(); };
    $("btn-test-mic").onclick = testMic;

    const volMap = { "vol-challenge": "volCh", "vol-sfx": "volSfx", "vol-music": "volMusic" };
    Object.keys(volMap).forEach((id) => {
      $(id).addEventListener("input", (e) => {
        settings[volMap[id]] = Number(e.target.value);
        applyVolumes();
        syncSettingsUI();
      });
      $(id).addEventListener("change", saveSettings);
    });

    document.querySelectorAll("#dur-pick .chip").forEach((c) => {
      c.onclick = () => { settings.dur = Number(c.dataset.dur); saveSettings(); syncSettingsUI(); };
    });

    $("chk-tts").onchange = (e) => { settings.tts = e.target.checked; saveSettings(); };

    /* الأصوات المنطوقة تصل متأخّرة في بعض المتصفحات */
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  }

  function init() {
    loadSettings();
    wire();
    syncSettingsUI();
    applyVolumes();

    /* نسخة التجربة (ملف واحد بلا خادم): لا غرف ولا كود، وضع الجهاز
       الواحد فقط — نُخفي ما لا يعمل بدل أن نتركه يفشل عند الضغط. */
    if (window.QALLADHA_OFFLINE) {
      const panel = document.querySelector("#screen-home .panel");
      if (panel) panel.hidden = true;
      $("btn-local").textContent = "🎙️ ابدأوا اللعب";
      const fine = document.querySelector("#screen-home .fineprint");
      if (fine) fine.textContent =
        "هذه نسخة التجربة: جهاز واحد تتناوبان عليه. وضع الجهازين بكود غرفة يعمل في النسخة المنشورة على Netlify.";
      show("screen-home");
      return;
    }

    const params = new URLSearchParams(location.search);
    const r = (params.get("r") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
    if (r.length === 4) {
      $("inp-code").value = r;
      toast("الكود جاهز — اكتب اسمك واضغط ادخل");
      setTimeout(() => $("inp-name").focus(), 300);
    }
    show("screen-home");
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
