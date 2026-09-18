/* ============================================================
   قلّدها — محرّك الصوت
   ------------------------------------------------------------
   أصوات التحدي **تسجيلات حقيقية** في مجلد sounds/ — كانت مولّدة
   بالتوليف فخرجت أزيزاً إلكترونياً لا يُشبه ما تدّعيه، وهذا يقتل
   اللعبة: من يقلّد صوتاً لا يعرفه؟ التسجيلات من مجموعة ESC-50،
   واخترنا منها المقاطع الموسومة CC0 (ملك عام) وحدها، ثم قُصّت على
   الحدث ووُحّدت جهارتها.

   أمّا المؤثرات والموسيقى فتبقى مُولّدة: هي أصلاً أصوات كرتونية
   مقصودة (بوق ملعب، ترومبون حزين)، ولا ملف يُحمّل من أجلها.
   ============================================================ */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null, challengeGain = null, sfxGain = null, musicGain = null;

  function context() {
    if (!ctx) {
      const AC = global.AudioContext || global.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
      challengeGain = ctx.createGain(); challengeGain.gain.value = 0.9; challengeGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.8; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.0; musicGain.connect(master);
    }
    return ctx;
  }

  /* متصفّحات الجوال تمنع الصوت حتى أول لمسة — نُنادى عند أول ضغطة */
  async function unlock() {
    const c = context();
    if (c.state === "suspended") { try { await c.resume(); } catch (e) {} }
    return c.state;
  }

  const setVolume = (which, v) => {
    context();
    const g = { challenge: challengeGain, sfx: sfxGain, music: musicGain }[which];
    if (g) g.gain.value = Math.max(0, Math.min(1, v));
  };

  /* ---------- لبنات التوليف (للمؤثرات والموسيقى فقط) ---------- */

  function adsr(c, dest, t0, dur, peak, attack, release) {
    const g = c.createGain();
    const p = g.gain;
    const a = Math.min(attack, dur * 0.4);
    const r = Math.min(release, dur * 0.6);
    p.setValueAtTime(0, t0);
    p.linearRampToValueAtTime(peak, t0 + a);
    p.setValueAtTime(peak, Math.max(t0 + a, t0 + dur - r));
    p.linearRampToValueAtTime(0, t0 + dur);
    g.connect(dest);
    return g;
  }

  function noiseSource(c, t0, dur) {
    const n = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource();
    s.buffer = buf;
    s.start(t0);
    return s;
  }

  function tone(c, dest, t0, dur, type, freqPoints, peak, opts) {
    const o = c.createOscillator();
    o.type = type;
    const f = o.frequency;
    f.setValueAtTime(freqPoints[0][1], t0);
    for (let i = 1; i < freqPoints.length; i++) {
      const [dt, hz] = freqPoints[i];
      f.linearRampToValueAtTime(hz, t0 + dt);
    }
    const g = adsr(c, dest, t0, dur, peak, (opts && opts.attack) ?? 0.01, (opts && opts.release) ?? 0.08);
    o.connect(g);
    if (opts && opts.vibRate) {
      const lfo = c.createOscillator();
      lfo.frequency.value = opts.vibRate;
      const lg = c.createGain();
      lg.gain.value = opts.vibDepth || 15;
      lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t0); lfo.stop(t0 + dur);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.02);
    return o;
  }

  /* ---------- التحديات ---------- */
  /* التلميح مكتوب ليقول للاعب كيف يُخرج الصوت بفمه، لا ليصف الحيوان. */

  const CHALLENGES = [
    { id: "dog",             name: "نباح كلب",       emoji: "🐶", hint: "نباحتان قصيرتان وحاسمتان" },
    { id: "cat",             name: "مواء قطة",       emoji: "🐱", hint: "ابدأ ناعماً، اصعد، ثم اهبط" },
    { id: "rooster",         name: "صياح ديك",       emoji: "🐓", hint: "كو كو كو كوووو — أربع نغمات" },
    { id: "cow",             name: "خوار بقرة",      emoji: "🐄", hint: "صوت عميق طويل من الصدر" },
    { id: "sheep",           name: "مأمأة خروف",     emoji: "🐑", hint: "مااااع، باهتزاز سريع" },
    { id: "hen",             name: "قوقأة دجاجة",    emoji: "🐔", hint: "نقّ نقّ متقطّع وسريع" },
    { id: "pig",             name: "نخير خنزير",     emoji: "🐷", hint: "من الأنف، قصير ومتكرّر" },
    { id: "crow",            name: "نعيق غراب",      emoji: "🐦‍⬛", hint: "قااق قااق — خشن ومزعج" },
    { id: "frog",            name: "نقيق ضفدع",      emoji: "🐸", hint: "قرقرة من عمق الحلق" },

    { id: "siren",           name: "صفّارة إسعاف",   emoji: "🚑", hint: "نغمتان تتبادلان بلا توقّف" },
    { id: "car_horn",        name: "بوق سيارة",      emoji: "🚗", hint: "نفخة واحدة ثابتة" },
    { id: "train",           name: "صفير قطار",      emoji: "🚂", hint: "صفير طويل ثم يهبط" },
    { id: "helicopter",      name: "مروحية",         emoji: "🚁", hint: "طقطقة متّصلة لا تتوقّف" },
    { id: "chainsaw",        name: "منشار كهربائي",  emoji: "🪚", hint: "زمجرة تعلو ثم تثبت" },
    { id: "engine",          name: "هدير محرّك",     emoji: "🏍️", hint: "هدير متّصل من الحلق" },

    { id: "crying_baby",     name: "رضيع يبكي",      emoji: "👶", hint: "صراخ متقطّع يعلو ويهبط" },
    { id: "laughing",        name: "ضحكة",           emoji: "😂", hint: "اضحك من قلبك، لا تتصنّع" },
    { id: "sneezing",        name: "عطسة",           emoji: "🤧", hint: "آآآ… تشوو!" },
    { id: "snoring",         name: "شخير نائم",      emoji: "😴", hint: "شهيق طويل خشن" },
    { id: "coughing",        name: "كحّة",           emoji: "😷", hint: "كحّتان جافّتان" },

    { id: "clapping",        name: "تصفيق",          emoji: "👏", hint: "بالفم لا باليد!" },
    { id: "brushing_teeth",  name: "تفريش أسنان",    emoji: "🪥", hint: "حكّ سريع متكرّر" },
    { id: "drinking_sipping", name: "رشفة شرب",      emoji: "🥤", hint: "سحب ثم بلع" },
    { id: "toilet_flush",    name: "سيفون",          emoji: "🚽", hint: "اندفاع ثم هسيس يخفت" },

    { id: "church_bells",    name: "أجراس",          emoji: "🔔", hint: "دِنغ دونغ متكرّر" },
    { id: "clock_alarm",     name: "منبّه",          emoji: "⏰", hint: "بيب بيب متساوية" },
    { id: "door_wood_knock", name: "طرق باب",        emoji: "🚪", hint: "ثلاث طرقات على الخشب" },
    { id: "door_wood_creaks", name: "باب يصرّ",      emoji: "🚪", hint: "صرير طويل يقشعرّ له البدن" },
    { id: "glass_breaking",  name: "كسر زجاج",       emoji: "🥃", hint: "تحطّم مفاجئ ثم رذاذ" },
    { id: "can_opening",     name: "فتح علبة",       emoji: "🥫", hint: "كششش! ثم فقاعات" },
    { id: "vacuum_cleaner",  name: "مكنسة كهربائية", emoji: "🧹", hint: "أزيز متّصل عالٍ" },
    { id: "airplane",        name: "طائرة",          emoji: "✈️", hint: "هدير بعيد يعلو" },
    { id: "thunderstorm",    name: "رعد",            emoji: "⛈️", hint: "قصفة ثم دمدمة تبتعد" },
    { id: "fireworks",       name: "ألعاب نارية",    emoji: "🎆", hint: "طقطقة وانفجارات متفرّقة" },
    { id: "wind",            name: "ريح",            emoji: "🌬️", hint: "نفخ متّصل من الشفتين" },
    { id: "crickets",        name: "صراصير",         emoji: "🦗", hint: "صرير حادّ متقطّع" },
  ];

  const byId = (id) => CHALLENGES.find((c) => c.id === id) || null;

  /* تحميل مقطع التحدي وفكّ ترميزه مرة واحدة ثم حفظه.
     الوعد نفسه يُحفظ لا نتيجته فقط، كي لا يبدأ تحميلان متوازيان
     حين يضغط اللاعب "اسمع" قبل أن ينتهي التحميل الأول. */
  const clipCache = new Map();

  function loadChallenge(id) {
    if (clipCache.has(id)) return clipCache.get(id);
    const p = (async () => {
      const res = await fetch("sounds/" + encodeURIComponent(id) + ".mp3", { cache: "force-cache" });
      if (!res.ok) throw new Error("sound-" + res.status);
      return await decode(await res.arrayBuffer());
    })();
    p.catch(() => clipCache.delete(id));   // فشلٌ لا يُحفظ، كي تنجح إعادة المحاولة
    clipCache.set(id, p);
    return p;
  }

  /* تحميل مسبق بلا انتظار: يهيّئ صوت الجولة القادمة أثناء النتيجة */
  function prefetch(id) {
    if (id && id.indexOf("custom:") !== 0) { try { loadChallenge(id); } catch (e) {} }
  }

  /* ---------- تشغيل مقطع، مع تأثيرات مضحكة ---------- */

  const EFFECTS = {
    normal: { label: "عادي", emoji: "▶️" },
    chipmunk: { label: "سنجاب", emoji: "🐿️" },
    monster: { label: "وحش", emoji: "👹" },
    robot: { label: "روبوت", emoji: "🤖" },
    echo: { label: "كهف", emoji: "🌀" },
  };

  let liveSources = [];
  function stopAll() {
    liveSources.forEach((s) => { try { s.stop(); } catch (e) {} });
    liveSources = [];
  }

  function playBuffer(buffer, opts) {
    const c = context();
    const o = opts || {};
    const bus = o.bus === "sfx" ? sfxGain : challengeGain;
    const src = c.createBufferSource();
    src.buffer = buffer;
    let node = src;

    const effect = o.effect || "normal";
    if (effect === "chipmunk") src.playbackRate.value = 1.65;
    if (effect === "monster") src.playbackRate.value = 0.62;

    if (effect === "robot") {
      const ring = c.createGain();
      ring.gain.value = 0;
      const lfo = c.createOscillator();
      lfo.type = "square";
      lfo.frequency.value = 42;
      const depth = c.createGain(); depth.gain.value = 0.85;
      lfo.connect(depth); depth.connect(ring.gain);
      const base = c.createConstantSource(); base.offset.value = 0.15;
      base.connect(ring.gain);
      src.connect(ring);
      node = ring;
      lfo.start(); base.start();
      liveSources.push(lfo, base);
    }

    if (effect === "echo") {
      const wet = c.createGain(); wet.gain.value = 0.45;
      const delay = c.createDelay(1);
      delay.delayTime.value = 0.19;
      const fb = c.createGain(); fb.gain.value = 0.42;
      src.connect(delay); delay.connect(fb); fb.connect(delay);
      delay.connect(wet); wet.connect(bus);
    }

    node.connect(bus);
    src.start();
    liveSources.push(src);
    if (o.onEnded) src.onended = o.onEnded;
    return src;
  }

  /* ---------- مؤثرات التعليق ---------- */

  const SFX = {
    /* بوق الملعب — للنتيجة العالية */
    airhorn(c, t0) {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3000; lp.connect(sfxGain);
      [380, 478, 572].forEach((hz, i) => {
        tone(c, lp, t0, 0.75, "sawtooth", [[0, hz * 0.94], [0.06, hz], [0.75, hz * 0.97]], 0.16 - i * 0.02,
          { attack: 0.02, release: 0.12 });
      });
    },
    /* ترومبون حزين — للنتيجة الضعيفة */
    sad(c, t0) {
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(sfxGain);
      const notes = [[0, 0.26, 392], [0.26, 0.26, 349], [0.52, 0.26, 311], [0.78, 0.6, 262]];
      notes.forEach(([off, d, hz]) => {
        tone(c, lp, t0 + off, d + 0.05, "sawtooth", [[0, hz * 1.03], [0.06, hz], [d, hz * 0.97]], 0.22,
          { attack: 0.03, release: 0.1, vibRate: 5, vibDepth: 4 });
      });
    },
    drumroll(c, t0) {
      for (let i = 0; i < 26; i++) {
        const t = t0 + i * 0.038;
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200;
        const g = adsr(c, sfxGain, t, 0.035, 0.05 + (i / 26) * 0.14, 0.002, 0.03);
        lp.connect(g);
        noiseSource(c, t, 0.035).connect(lp);
      }
    },
    applause(c, t0) {
      for (let i = 0; i < 60; i++) {
        const t = t0 + Math.random() * 1.4;
        const bp = c.createBiquadFilter(); bp.type = "bandpass";
        bp.frequency.value = 1200 + Math.random() * 2200; bp.Q.value = 1.5;
        const g = adsr(c, sfxGain, t, 0.05, 0.05, 0.003, 0.04);
        bp.connect(g);
        noiseSource(c, t, 0.05).connect(bp);
      }
    },
    crickets(c, t0) {
      for (let i = 0; i < 3; i++) {
        const t = t0 + i * 0.55;
        for (let k = 0; k < 4; k++) {
          tone(c, sfxGain, t + k * 0.045, 0.028, "square", [[0, 4400]], 0.05, { attack: 0.004, release: 0.015 });
        }
      }
    },
    tada(c, t0) {
      [523, 659, 784].forEach((hz) => tone(c, sfxGain, t0, 0.18, "triangle", [[0, hz]], 0.14, { attack: 0.01, release: 0.08 }));
      [659, 784, 1047].forEach((hz) => tone(c, sfxGain, t0 + 0.2, 0.7, "triangle", [[0, hz]], 0.16, { attack: 0.01, release: 0.45 }));
    },
    boing(c, t0) {
      tone(c, sfxGain, t0, 0.5, "sine", [[0, 620], [0.1, 180], [0.3, 320], [0.5, 150]], 0.25,
        { attack: 0.005, release: 0.25, vibRate: 18, vibDepth: 40 });
    },
    tick(c, t0) {
      tone(c, sfxGain, t0, 0.07, "square", [[0, 880]], 0.12, { attack: 0.003, release: 0.04 });
    },
    go(c, t0) {
      tone(c, sfxGain, t0, 0.3, "square", [[0, 1320]], 0.16, { attack: 0.005, release: 0.2 });
    },
    /* نقرة العدّاد وهو يصعد — طبقتها ترتفع مع النتيجة فيُسمع الصعود */
    count(c, t0, opt) {
      const f = 520 + 700 * Math.min(1, Math.max(0, (opt && opt.frac) || 0));
      tone(c, sfxGain, t0, 0.04, "square", [[0, f]], 0.05, { attack: 0.002, release: 0.025 });
    },
    /* رنّة استقرار العدّاد */
    land(c, t0) {
      [880, 1320].forEach((hz, i) =>
        tone(c, sfxGain, t0 + i * 0.05, 0.3, "triangle", [[0, hz]], 0.12, { attack: 0.004, release: 0.22 }));
    },
  };

  function sfx(name, opt) {
    const c = context();
    const fn = SFX[name];
    if (fn) fn(c, c.currentTime + 0.02, opt);
  }

  /* ---------- موسيقى خلفية بسيطة ---------- */
  /* حلقة قصيرة مرحة تُجدوَل مسبقاً بربع ثانية — لا ملف موسيقى. */
  let musicTimer = null, nextNote = 0, step = 0;
  const BASS = [110, 110, 146.8, 110, 130.8, 130.8, 98, 110];
  const BLIP = [440, 0, 523, 0, 659, 587, 0, 523];

  function scheduleMusic() {
    const c = context();
    const spb = 0.26;
    while (nextNote < c.currentTime + 0.4) {
      const t = Math.max(nextNote, c.currentTime + 0.01);
      const i = step % 8;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900; lp.connect(musicGain);
      tone(c, lp, t, spb * 0.8, "triangle", [[0, BASS[i]]], 0.5, { attack: 0.01, release: 0.1 });
      if (BLIP[i]) tone(c, musicGain, t, spb * 0.45, "square", [[0, BLIP[i]]], 0.06, { attack: 0.005, release: 0.06 });
      if (i % 2 === 0) {
        const hp = c.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 5000;
        const g = adsr(c, musicGain, t, 0.04, 0.05, 0.002, 0.03);
        hp.connect(g);
        noiseSource(c, t, 0.04).connect(hp);
      }
      nextNote = t + spb;
      step++;
    }
  }

  function musicOn() {
    context();
    if (musicTimer) return;
    nextNote = ctx.currentTime + 0.1;
    scheduleMusic();
    musicTimer = setInterval(scheduleMusic, 120);
  }
  function musicOff() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  /* ---------- التسجيل ---------- */

  function pickMime() {
    if (typeof MediaRecorder === "undefined") return null;
    const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", ""];
    for (const m of options) {
      if (m === "" || MediaRecorder.isTypeSupported(m)) return m;
    }
    return null;
  }

  let stream = null, currentDeviceId = null;

  async function getStream(deviceId) {
    if (stream && currentDeviceId === (deviceId || null) && stream.active) return stream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    const constraints = {
      audio: deviceId
        ? { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false }
        : { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    currentDeviceId = deviceId || null;
    return stream;
  }

  async function listMics() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    } catch (e) {
      return [];
    }
  }

  /* يسجّل مدّة محدّدة ويرجّع المقطع + مقياس مستوى حيّ أثناء التسجيل */
  async function record(ms, deviceId, onLevel) {
    const s = await getStream(deviceId);
    const c = context();
    const mime = pickMime();
    if (mime === null) throw new Error("no-recorder");

    const src = c.createMediaStreamSource(s);
    const an = c.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const data = new Uint8Array(an.fftSize);
    let raf = 0;
    const tick = () => {
      an.getByteTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
      if (onLevel) onLevel(peak);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

    const done = new Promise((resolve) => {
      rec.onstop = () => {
        cancelAnimationFrame(raf);
        try { src.disconnect(); } catch (e) {}
        resolve(new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" }));
      };
    });

    rec.start();
    await new Promise((r) => setTimeout(r, ms));
    if (rec.state !== "inactive") rec.stop();
    const blob = await done;

    /* ⚠️ إطفاء المايك فور انتهاء التسجيل — لا تأجيل.
       ما دام المايك مفتوحاً يعامل الجوال الصفحة كأنها مكالمة هاتفية،
       فيحوّل الخرج إلى سمّاعة الأذن العلوية بدل مكبّر الصوت، فيسمع
       اللاعب النتيجة همساً ولا يفهم لماذا. إغلاق المسارات هنا يعيد
       الجهاز إلى وضع الوسائط العادي. */
    releaseMic();

    return { blob, mime: blob.type };
  }

  function releaseMic() {
    if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; currentDeviceId = null; }
  }

  /* ---------- تحويلات ---------- */

  async function decode(arrayBuffer) {
    const c = context();
    return await new Promise((resolve, reject) => {
      /* صيغة الوعد غير مدعومة في سفاري القديم — نمرّر النداءين */
      const p = c.decodeAudioData(arrayBuffer, resolve, reject);
      if (p && p.then) p.then(resolve, reject);
    });
  }

  /* ---------- تجهيز صوت جاهز يرفعه اللاعب ---------- */
  /* ملفّ ينزّله اللاعب من الإنترنت قد يكون دقيقتين وستيريو و320 كيلوبت،
     ولا يصلح تحدّياً كما هو: نأخذ منه أعلى مقطع طاقةً في حدود المدّة،
     ونقصّ الصمت حوله، ونوحّد جهارته كبقية الأصوات، ثم نكتبه WAV أحادياً
     خفيفاً. كل ذلك في المتصفّح — لا يُرفع الملف الأصلي إطلاقاً. */

  const CLIP_SR = 22050;

  function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE");
    str(12, "fmt "); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buf;
  }

  async function prepareClip(arrayBuffer, maxSeconds) {
    const audio = await decode(arrayBuffer);
    const maxSec = maxSeconds || 5;

    // دمج القنوات ثم إعادة الأخذ إلى معدّل خفيف
    const ch = audio.numberOfChannels;
    const src = audio.getChannelData(0);
    let mono = src;
    if (ch > 1) {
      mono = new Float32Array(src.length);
      for (let c = 0; c < ch; c++) {
        const d = audio.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += d[i] / ch;
      }
    }
    const ratio = audio.sampleRate / CLIP_SR;
    const x = new Float32Array(Math.floor(mono.length / ratio));
    for (let i = 0; i < x.length; i++) {
      const p = i * ratio, i0 = Math.floor(p), f = p - i0;
      x[i] = (mono[i0] || 0) * (1 - f) + (mono[i0 + 1] || 0) * f;
    }

    // مغلّف الطاقة لاختيار أعلى نافذة وقصّ الصمت حولها
    const hop = Math.round(CLIP_SR * 0.02);
    const env = [];
    for (let i = 0; i + hop <= x.length; i += hop) {
      let s = 0;
      for (let k = i; k < i + hop; k++) s += x[k] * x[k];
      env.push(Math.sqrt(s / hop));
    }
    if (!env.length) throw new Error("clip-empty");

    const want = Math.min(env.length, Math.round(maxSec / 0.02));
    let start = 0;
    if (env.length > want) {
      const acc = [0];
      for (const v2 of env) acc.push(acc[acc.length - 1] + v2);
      let best = -1;
      for (let i = 0; i + want <= env.length; i++) {
        const e = acc[i + want] - acc[i];
        if (e > best) { best = e; start = i; }
      }
    }
    let a = start, b = Math.min(env.length - 1, start + want - 1);
    let peakEnv = 0;
    for (let i = a; i <= b; i++) peakEnv = Math.max(peakEnv, env[i]);
    const gate = peakEnv * 0.10;
    while (a < b && env[a] < gate) a++;
    while (b > a && env[b] < gate) b--;
    a = Math.max(start, a - 4); b = Math.min(start + want - 1, b + 4);

    let seg = x.subarray(a * hop, Math.min(x.length, (b + 1) * hop));
    if (seg.length < CLIP_SR * 0.4) seg = x.subarray(start * hop, Math.min(x.length, (start + want) * hop));
    seg = Float32Array.from(seg);

    // تلاشٍ عند الطرفين، ثم توحيد الجهارة كبقية أصوات اللعبة
    const fi = Math.round(CLIP_SR * 0.02), fo = Math.round(CLIP_SR * 0.05);
    for (let i = 0; i < Math.min(fi, seg.length); i++) seg[i] *= i / fi;
    for (let i = 0; i < Math.min(fo, seg.length); i++) seg[seg.length - 1 - i] *= i / fo;

    let sq = 0, peak = 1e-9;
    for (let i = 0; i < seg.length; i++) { sq += seg[i] * seg[i]; peak = Math.max(peak, Math.abs(seg[i])); }
    const rms = Math.sqrt(sq / Math.max(1, seg.length));
    const gain = Math.min(0.10 / (rms + 1e-9), 0.95 / peak);
    for (let i = 0; i < seg.length; i++) seg[i] *= gain;

    return new Blob([encodeWav(seg, CLIP_SR)], { type: "audio/wav" });
  }

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1] || "");
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  function base64ToBlob(b64, mime) {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime || "audio/webm" });
  }

  /* ---------- التعليق المنطوق ---------- */
  let arabicVoice = undefined;
  function speak(text, enabled) {
    if (!enabled || !global.speechSynthesis) return;
    try {
      if (arabicVoice === undefined) {
        const voices = global.speechSynthesis.getVoices() || [];
        arabicVoice = voices.find((v) => (v.lang || "").toLowerCase().startsWith("ar")) || null;
      }
      if (!arabicVoice) return;          // بلا صوت عربي نكتفي بالمؤثّر والنص
      const u = new SpeechSynthesisUtterance(text);
      u.voice = arabicVoice;
      u.lang = arabicVoice.lang;
      u.rate = 1.06;
      u.pitch = 1.15;
      global.speechSynthesis.cancel();
      global.speechSynthesis.speak(u);
    } catch (e) {}
  }
  function hasArabicVoice() {
    if (!global.speechSynthesis) return false;
    const voices = global.speechSynthesis.getVoices() || [];
    return voices.some((v) => (v.lang || "").toLowerCase().startsWith("ar"));
  }

  global.Sound = {
    context, unlock, setVolume,
    CHALLENGES, byId, loadChallenge, prefetch,
    EFFECTS, playBuffer, stopAll,
    sfx, musicOn, musicOff,
    record, listMics, getStream, releaseMic,
    decode, blobToBase64, base64ToBlob, prepareClip,
    speak, hasArabicVoice,
  };
})(window);
