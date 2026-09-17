/* ============================================================
   قلّدها — محرّك الصوت
   ------------------------------------------------------------
   كل صوت في اللعبة مُولَّد في المتصفح لحظياً: لا ملفات صوتية
   تُحمَّل، فاللعبة تفتح فوراً وتعمل على شبكة ضعيفة.
   أصوات التحدي تُرسَم مرة واحدة داخل OfflineAudioContext ثم
   تُحفظ كمقطع جاهز — ليسمع اللاعبان نفس الصوت تماماً، ولتكون
   نسخة التحليل هي نسخة التشغيل حرفياً.
   ============================================================ */
(function (global) {
  "use strict";

  let ctx = null;
  let master = null, challengeGain = null, sfxGain = null, musicGain = null;
  const cache = new Map();

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

  /* ---------- لبنات التوليف ---------- */

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

  /* رنّانات تُشبه تجاويف الحلق — هي ما يجعل الموجة المنشارية
     تُسمع "حيواناً" لا أزيزاً إلكترونياً */
  function formants(c, dest, freqs, qs) {
    const input = c.createGain();
    freqs.forEach((f, i) => {
      const bp = c.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = f;
      bp.Q.value = (qs && qs[i]) || 6;
      input.connect(bp);
      bp.connect(dest);
    });
    return input;
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
  /* كل تحدٍّ: اسم يُعرض، ورمز، ومدّة، ودالة ترسم الصوت. */

  const CHALLENGES = [
    {
      id: "cat", name: "مواء قطة", emoji: "🐱", dur: 1.1, hint: "ابدأ ناعماً واصعد ثم اهبط",
      draw(c, dest, t0) {
        const out = adsr(c, dest, t0, 0.9, 0.55, 0.09, 0.32);
        const f = formants(c, out, [760, 1950, 2850], [9, 11, 12]);
        tone(c, f, t0, 0.88, "sawtooth", [[0, 500], [0.22, 780], [0.48, 640], [0.88, 370]], 0.9,
          { attack: 0.07, release: 0.3, vibRate: 6.5, vibDepth: 16 });
      },
    },
    {
      id: "dog", name: "نباح كلب", emoji: "🐶", dur: 1.0, hint: "نباحتان قصيرتان وحاسمتان",
      draw(c, dest, t0) {
        [0, 0.42].forEach((off) => {
          const t = t0 + off;
          const f = formants(c, dest, [520, 1150], [3, 4]);
          tone(c, f, t, 0.2, "sawtooth", [[0, 230], [0.05, 190], [0.2, 130]], 0.75, { attack: 0.006, release: 0.12 });
          const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1800;
          const ng = adsr(c, dest, t, 0.09, 0.32, 0.004, 0.07);
          lp.connect(ng);
          noiseSource(c, t, 0.09).connect(lp);
        });
      },
    },
    {
      id: "rooster", name: "صياح ديك", emoji: "🐓", dur: 1.6, hint: "أربع نغمات: كو كو كو كوووو",
      draw(c, dest, t0) {
        const seq = [[0, 0.18, 660], [0.21, 0.22, 980], [0.46, 0.18, 820], [0.67, 0.62, 560]];
        seq.forEach(([off, d, hz]) => {
          const f = formants(c, dest, [900, 2100], [7, 8]);
          tone(c, f, t0 + off, d, "sawtooth", [[0, hz], [d * 0.6, hz * 1.05], [d, hz * 0.8]], 0.8,
            { attack: 0.02, release: d * 0.4, vibRate: 7, vibDepth: 12 });
        });
      },
    },
    {
      id: "cow", name: "خوار بقرة", emoji: "🐄", dur: 1.5, hint: "صوت عميق وطويل من الصدر",
      draw(c, dest, t0) {
        const f = formants(c, dest, [420, 880, 1300], [6, 7, 8]);
        tone(c, f, t0, 1.35, "sawtooth", [[0, 128], [0.35, 112], [1.0, 104], [1.35, 90]], 0.9,
          { attack: 0.12, release: 0.45, vibRate: 4.5, vibDepth: 5 });
      },
    },
    {
      id: "sheep", name: "مأمأة خروف", emoji: "🐑", dur: 1.2, hint: "اهتزاز سريع: مااااااع",
      draw(c, dest, t0) {
        const f = formants(c, dest, [1000, 1850, 2600], [8, 9, 10]);
        tone(c, f, t0, 1.05, "sawtooth", [[0, 240], [0.3, 225], [1.05, 200]], 0.85,
          { attack: 0.05, release: 0.3, vibRate: 13, vibDepth: 30 });
      },
    },
    {
      id: "monkey", name: "قرد", emoji: "🐵", dur: 1.4, hint: "أوه أوه أوه… آآآه",
      draw(c, dest, t0) {
        [0, 0.2, 0.4].forEach((off) => {
          const f = formants(c, dest, [560, 1100], [8, 9]);
          tone(c, f, t0 + off, 0.15, "sawtooth", [[0, 380], [0.08, 520], [0.15, 430]], 0.7, { attack: 0.01, release: 0.08 });
        });
        const f2 = formants(c, dest, [780, 1400], [7, 8]);
        tone(c, f2, t0 + 0.66, 0.6, "sawtooth", [[0, 620], [0.2, 700], [0.6, 480]], 0.8,
          { attack: 0.03, release: 0.3, vibRate: 9, vibDepth: 22 });
      },
    },
    {
      id: "bird", name: "زقزقة عصفور", emoji: "🐦", dur: 1.0, hint: "زقزقات حادّة ومتقطّعة",
      draw(c, dest, t0) {
        [0, 0.15, 0.3, 0.52, 0.67].forEach((off, i) => {
          tone(c, dest, t0 + off, 0.07, "sine", [[0, 3000 + i * 120], [0.04, 4600], [0.07, 3400]], 0.35,
            { attack: 0.006, release: 0.03 });
        });
      },
    },
    {
      id: "owl", name: "بومة", emoji: "🦉", dur: 1.4, hint: "هوو… هوو، ناعمة وغامضة",
      draw(c, dest, t0) {
        [0, 0.6].forEach((off) => {
          const f = formants(c, dest, [430, 860], [10, 11]);
          tone(c, f, t0 + off, 0.42, "sine", [[0, 360], [0.15, 400], [0.42, 350]], 0.6,
            { attack: 0.1, release: 0.22, vibRate: 5, vibDepth: 6 });
        });
      },
    },
    {
      id: "siren", name: "صفّارة إسعاف", emoji: "🚑", dur: 1.8, hint: "نغمتان تتبادلان بلا توقّف",
      draw(c, dest, t0) {
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2600; lp.connect(dest);
        for (let i = 0; i < 4; i++) {
          const hz = i % 2 === 0 ? 680 : 900;
          tone(c, lp, t0 + i * 0.42, 0.4, "square", [[0, hz]], 0.28, { attack: 0.03, release: 0.05 });
        }
      },
    },
    {
      id: "alarm", name: "إنذار", emoji: "🚨", dur: 1.5, hint: "بيب بيب بيب متساوية",
      draw(c, dest, t0) {
        for (let i = 0; i < 6; i++) {
          tone(c, dest, t0 + i * 0.22, 0.11, "square", [[0, 1040]], 0.22, { attack: 0.005, release: 0.02 });
        }
      },
    },
    {
      id: "horn", name: "بوق سيارة", emoji: "🚗", dur: 0.9, hint: "نفخة واحدة ثابتة",
      draw(c, dest, t0) {
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2000; lp.connect(dest);
        tone(c, lp, t0, 0.7, "sawtooth", [[0, 400]], 0.3, { attack: 0.02, release: 0.06 });
        tone(c, lp, t0, 0.7, "sawtooth", [[0, 505]], 0.26, { attack: 0.02, release: 0.06 });
      },
    },
    {
      id: "bike", name: "دراجة نارية", emoji: "🏍️", dur: 1.8, hint: "زمجرة تعلو ثم تهدأ",
      draw(c, dest, t0) {
        const trem = c.createGain(); trem.gain.value = 0.5; trem.connect(dest);
        const lfo = c.createOscillator(); lfo.type = "sawtooth"; lfo.frequency.value = 24;
        const lg = c.createGain(); lg.gain.value = 0.4;
        lfo.connect(lg); lg.connect(trem.gain); lfo.start(t0); lfo.stop(t0 + 1.7);
        const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1400; lp.connect(trem);
        tone(c, lp, t0, 1.65, "sawtooth", [[0, 75], [0.5, 190], [1.0, 150], [1.65, 95]], 0.5,
          { attack: 0.1, release: 0.4 });
        const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
        const ng = adsr(c, trem, t0, 1.6, 0.16, 0.2, 0.5);
        bp.connect(ng);
        noiseSource(c, t0, 1.6).connect(bp);
      },
    },
    {
      id: "laser", name: "ليزر فضائي", emoji: "👾", dur: 0.7, hint: "هبوط حادّ وسريع",
      draw(c, dest, t0) {
        const o = c.createOscillator(); o.type = "sawtooth";
        o.frequency.setValueAtTime(2600, t0);
        o.frequency.exponentialRampToValueAtTime(160, t0 + 0.4);
        const g = adsr(c, dest, t0, 0.45, 0.3, 0.005, 0.2);
        o.connect(g); o.start(t0); o.stop(t0 + 0.5);
      },
    },
    {
      id: "doorbell", name: "جرس الباب", emoji: "🔔", dur: 1.4, hint: "دِنغ… دونغ",
      draw(c, dest, t0) {
        [[0, 680], [0.42, 540]].forEach(([off, hz]) => {
          const g = c.createGain();
          g.gain.setValueAtTime(0.35, t0 + off);
          g.gain.exponentialRampToValueAtTime(0.001, t0 + off + 0.85);
          g.connect(dest);
          const o = c.createOscillator(); o.type = "sine"; o.frequency.value = hz;
          const o2 = c.createOscillator(); o2.type = "sine"; o2.frequency.value = hz * 2.7;
          const g2 = c.createGain(); g2.gain.value = 0.25; o2.connect(g2); g2.connect(g);
          o.connect(g);
          o.start(t0 + off); o.stop(t0 + off + 0.9);
          o2.start(t0 + off); o2.stop(t0 + off + 0.9);
        });
      },
    },
  ];

  const byId = (id) => CHALLENGES.find((c) => c.id === id) || null;

  /* رسم التحدي مرة واحدة في سياق غير مسموع ثم حفظه مقطعاً جاهزاً */
  async function renderChallenge(id) {
    if (cache.has(id)) return cache.get(id);
    const def = byId(id);
    if (!def) return null;
    const OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    const sr = 44100;
    const oc = new OAC(1, Math.ceil(sr * (def.dur + 0.3)), sr);
    const out = oc.createGain(); out.gain.value = 0.9; out.connect(oc.destination);
    def.draw(oc, out, 0.05);
    const buf = await oc.startRendering();
    cache.set(id, buf);
    return buf;
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
  };

  function sfx(name) {
    const c = context();
    const fn = SFX[name];
    if (fn) fn(c, c.currentTime + 0.02);
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
    CHALLENGES, byId, renderChallenge,
    EFFECTS, playBuffer, stopAll,
    sfx, musicOn, musicOff,
    record, listMics, getStream, releaseMic,
    decode, blobToBase64, base64ToBlob,
    speak, hasArabicVoice,
  };
})(window);
