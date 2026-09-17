/* ============================================================
   قلّدها — قياس قرب التقليد من الصوت الأصلي
   ------------------------------------------------------------
   مصارحة قبل الكود: هذا ليس "تعرّفاً على الصوت". هو مقارنة بين
   بصمتين رقميتين لمقطعين: شكل الطيف (النبرة)، ومسار الطبقة
   (النغمة)، ومنحنى الطاقة (الإيقاع). يعطي نتيجة معقولة ومضحكة،
   ولا يدّعي أكثر من ذلك.

   لماذا هذه العناصر الثلاثة تحديداً:
   - النبرة  : "خشونة" الصوت ولونه — تفصل مواء القطة عن نباح الكلب.
   - النغمة  : صعوداً وهبوطاً — صفارة الإسعاف كلها في مسار الطبقة.
   - الإيقاع : متى يعلو الصوت ومتى يسكت — نباحتان لا نباحة واحدة.

   وكل شيء هنا مُطبَّع ضدّ ارتفاع الصوت: من يصرخ في المايك لا يفوز
   لأنه صرخ. المقارنة على الشكل لا على القوة.
   ============================================================ */
(function (global) {
  "use strict";

  const SR = 16000;      // نحلّل عند 16 كيلوهرتز: يكفي لصوت البشر والحيوان
  const FRAME = 512;     // نافذة 32 مللي ثانية
  const HOP = 160;       // خطوة 10 مللي ثانية
  const BANDS = 24;      // عدد حزم مِل
  const FMIN = 80, FMAX = 6000;
  const MAX_FRAMES = 110; // سقف أطر التحليل — يحمي الجوال من تعليق طويل
  const RESAMPLE_N = 24;  // طول المنحنيات بعد التطبيع الزمني

  /* ---------- أدوات رقمية ---------- */

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* تحويل فوريي سريع (radix-2، في المكان). مكتوب هنا لأن المتصفح
     لا يتيح FFT خارج AnalyserNode الحيّ، ونحن نحلّل ملفاً مسجّلاً. */
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      const half = len >> 1;
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const vr = re[b] * cr - im[b] * ci;
          const vi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr;
          cr = ncr;
        }
      }
    }
  }

  const hzToMel = (f) => 2595 * Math.log10(1 + f / 700);
  const melToHz = (m) => 700 * (Math.pow(10, m / 2595) - 1);

  /* مرشّحات مِل المثلثية — تُبنى مرة واحدة وتُعاد استخدامها */
  const MEL = (function buildMel() {
    const nBins = FRAME / 2;
    const lo = hzToMel(FMIN), hi = hzToMel(FMAX);
    const points = [];
    for (let i = 0; i < BANDS + 2; i++) {
      const hz = melToHz(lo + ((hi - lo) * i) / (BANDS + 1));
      points.push(Math.round((hz / (SR / 2)) * nBins));
    }
    const filters = [];
    for (let b = 0; b < BANDS; b++) {
      const a = points[b], c = points[b + 1], d = points[b + 2];
      const w = [];
      for (let k = a; k <= d; k++) {
        if (k < 0 || k >= nBins) { w.push(0); continue; }
        if (k <= c) w.push(c === a ? 1 : (k - a) / (c - a));
        else w.push(d === c ? 1 : (d - k) / (d - c));
      }
      filters.push({ start: a, weights: w });
    }
    return filters;
  })();

  const HANN = (function () {
    const w = new Float32Array(FRAME);
    for (let i = 0; i < FRAME; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FRAME - 1));
    return w;
  })();

  /* دمج القنوات + إعادة أخذ العيّنات إلى 16 كيلوهرتز (استيفاء خطّي:
     دقّته تكفي لملامح الطيف، ولا يستحق الأمر مرشّحاً أثقل). */
  function toMono16k(audioBuffer) {
    const ch = audioBuffer.numberOfChannels;
    const src = audioBuffer.getChannelData(0);
    let mono = src;
    if (ch > 1) {
      mono = new Float32Array(src.length);
      for (let c = 0; c < ch; c++) {
        const d = audioBuffer.getChannelData(c);
        for (let i = 0; i < mono.length; i++) mono[i] += d[i] / ch;
      }
    }
    const ratio = audioBuffer.sampleRate / SR;
    if (Math.abs(ratio - 1) < 0.001) return Float32Array.from(mono);
    const out = new Float32Array(Math.floor(mono.length / ratio));
    for (let i = 0; i < out.length; i++) {
      const p = i * ratio, i0 = Math.floor(p), f = p - i0;
      out[i] = (mono[i0] || 0) * (1 - f) + (mono[i0 + 1] || 0) * f;
    }
    return out;
  }

  /* قصّ الصمت من الطرفين: العتبة نسبية من أعلى طاقة في المقطع نفسه،
     كي يعمل مع مايك هامس ومع مايك صاخب على السواء. */
  function trim(x) {
    const win = 400, step = 160;
    const rms = [];
    for (let i = 0; i + win <= x.length; i += step) {
      let s = 0;
      for (let k = 0; k < win; k++) s += x[i + k] * x[i + k];
      rms.push(Math.sqrt(s / win));
    }
    if (!rms.length) return x;
    const peak = Math.max.apply(null, rms);
    if (peak < 0.004) return new Float32Array(0); // صمت فعلي
    const gate = Math.max(peak * 0.09, 0.004);
    let a = 0, b = rms.length - 1;
    while (a < rms.length && rms[a] < gate) a++;
    while (b > a && rms[b] < gate) b--;
    const from = Math.max(0, a * step - 800);
    const to = Math.min(x.length, b * step + win + 800);
    return x.subarray(from, to);
  }

  /* تطبيع الذروة: يلغي فرق ارتفاع الصوت بين مايك وآخر */
  function normalizePeak(x) {
    let peak = 0;
    for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; }
    if (peak < 1e-6) return x;
    const out = new Float32Array(x.length), g = 0.97 / peak;
    for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
    return out;
  }

  /* تقدير الطبقة بالارتباط الذاتي المُطبَّع، على نسخة بنصف التردّد
     (8 كيلوهرتز) لأن الطبقة لا تحتاج دقّة أعلى والحساب يصير أخفّ. */
  function pitchAt(x, center) {
    const half = 256;                 // نافذة 64 مللي ثانية عند 8 كيلوهرتز
    const start = Math.max(0, center - half);
    const n = Math.min(half * 2, x.length - start);
    if (n < 200) return { f0: 0, clarity: 0 };
    const w = x.subarray(start, start + n);
    /* المدى 70 – 1000 هرتز. كان ينتهي عند 500 فقط، وهذا وحده كان
       يُفقدنا مواء القطة وصياح الديك وزقزقة العصفور — كلها فوقها. */
    const minLag = 8, maxLag = Math.min(114, n - 60);
    let e0 = 0;
    for (let i = 0; i < n - minLag; i++) e0 += w[i] * w[i];
    if (e0 < 1e-7) return { f0: 0, clarity: 0 };

    const r = new Float64Array(maxLag + 1);
    let best = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let num = 0, e1 = 0;
      const lim = n - lag;
      for (let i = 0; i < lim; i++) { num += w[i] * w[i + lag]; e1 += w[i + lag] * w[i + lag]; }
      r[lag] = num / (Math.sqrt(e0 * e1) || 1e-9);
      if (r[lag] > best) best = r[lag];
    }
    if (best <= 0) return { f0: 0, clarity: 0 };

    /* نأخذ أقصر دورة تبلغ 85٪ من أعلى قمّة، لا أعلى قمّة مطلقاً:
       القمّة الأعلى كثيراً ما تقع عند ضعف الدورة، فتُقرأ الطبقة
       أوكتافاً أخفض مما هي. */
    let lag = 0;
    for (let k = minLag; k <= maxLag; k++) {
      if (r[k] >= best * 0.85 && r[k] > r[k - 1] && (k === maxLag || r[k] >= r[k + 1])) { lag = k; break; }
    }
    if (!lag) return { f0: 0, clarity: 0 };

    /* صقل القمّة بقطع مكافئ — عند الترددات العالية تكون الدورة
       ثماني عيّنات فقط، فخطوة عيّنة واحدة تساوي قفزة كبيرة. */
    const y0 = r[lag - 1] || 0, y1 = r[lag], y2 = r[lag + 1] || 0;
    const denom = y0 - 2 * y1 + y2;
    const shift = denom !== 0 ? (0.5 * (y0 - y2)) / denom : 0;
    const refined = lag + clamp(shift, -0.5, 0.5);

    return { f0: 8000 / refined, clarity: y1 };
  }

  function decimate2(x) {
    const out = new Float32Array(Math.floor(x.length / 2));
    for (let i = 0; i < out.length; i++) out[i] = (x[2 * i] + x[2 * i + 1]) * 0.5;
    return out;
  }

  /* ---------- استخراج البصمة ---------- */
  function extract(audioBuffer) {
    let x = trim(toMono16k(audioBuffer));
    if (x.length < SR * 0.12) return null;   // أقصر من 120 مللي ثانية: لا شيء يُقارن
    x = normalizePeak(x);
    const half = decimate2(x);

    const frames = [];
    const energy = [];
    const pitches = [];
    const re = new Float32Array(FRAME), im = new Float32Array(FRAME);

    for (let pos = 0; pos + FRAME <= x.length; pos += HOP) {
      let rms = 0;
      for (let i = 0; i < FRAME; i++) {
        const v = x[pos + i];
        rms += v * v;
        re[i] = v * HANN[i];
        im[i] = 0;
      }
      energy.push(Math.log(1e-5 + Math.sqrt(rms / FRAME)));
      fft(re, im);

      const band = new Float32Array(BANDS);
      for (let b = 0; b < BANDS; b++) {
        const f = MEL[b];
        let sum = 0;
        for (let k = 0; k < f.weights.length; k++) {
          const bin = f.start + k;
          if (bin < 0 || bin >= FRAME / 2) continue;
          const mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
          sum += mag * f.weights[k];
        }
        band[b] = Math.log(1e-6 + sum);
      }
      /* تطبيع كل إطار وحده: يُلغي أثر ارتفاع الصوت ويُبقي شكل الطيف */
      let m = 0;
      for (let b = 0; b < BANDS; b++) m += band[b];
      m /= BANDS;
      let sd = 0;
      for (let b = 0; b < BANDS; b++) sd += (band[b] - m) * (band[b] - m);
      sd = Math.sqrt(sd / BANDS) || 1;
      for (let b = 0; b < BANDS; b++) band[b] = (band[b] - m) / sd;
      frames.push(band);

      const p = pitchAt(half, (pos + FRAME / 2) >> 1);
      pitches.push(p.clarity > 0.45 && p.f0 > 65 && p.f0 < 1100 ? p.f0 : 0);
    }
    if (frames.length < 4) return null;

    let voiced = 0;
    for (let i = 0; i < pitches.length; i++) if (pitches[i] > 0) voiced++;

    return {
      mel: pool(frames),
      energy: poolNums(energy),
      pitch: pitches,
      voicedRatio: voiced / pitches.length,
      duration: x.length / SR,
    };
  }

  /* تقليل عدد الأطر بالمتوسّط — الدقّة الزمنية العشرية لا تفيد
     المقارنة بقدر ما تُثقل الحساب على الجوال. */
  function pool(frames) {
    if (frames.length <= MAX_FRAMES) return frames;
    const group = Math.ceil(frames.length / MAX_FRAMES);
    const out = [];
    for (let i = 0; i < frames.length; i += group) {
      const acc = new Float32Array(BANDS);
      let n = 0;
      for (let j = i; j < Math.min(i + group, frames.length); j++, n++)
        for (let b = 0; b < BANDS; b++) acc[b] += frames[j][b];
      for (let b = 0; b < BANDS; b++) acc[b] /= n;
      out.push(acc);
    }
    return out;
  }
  function poolNums(arr) {
    if (arr.length <= MAX_FRAMES) return arr;
    const group = Math.ceil(arr.length / MAX_FRAMES);
    const out = [];
    for (let i = 0; i < arr.length; i += group) {
      let s = 0, n = 0;
      for (let j = i; j < Math.min(i + group, arr.length); j++, n++) s += arr[j];
      out.push(s / n);
    }
    return out;
  }

  /* ---------- مقارنات ---------- */

  /* متجهات مِل مُطبَّعة (متوسّطها صفر)، فالجيب هنا معامل ارتباط:
     1 تطابق، 0 لا علاقة، وما دون الصفر تضادّ. كنّا نحوّله سابقاً إلى
     [0،1] بالقسمة على اثنين — فصار "لا علاقة" يساوي نصف درجة، وهو ما
     جعل الضجيج الأبيض يأخذ نتيجة عالية. الآن الصفر صفر. */
  function cosSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na * nb) || 1e-9;
    return dot / d;
  }
  const cosDist = (a, b) => 1 - cosSim(a, b);   // [0، 2]

  /* تطبيع زمني قبل المقارنة: نمدّ الاثنين إلى نفس عدد الأطر.
     بدونه كان DTW يلصق إطاراً واحداً رخيصاً بعشرة أطر ويخفض
     المتوسّط — ثغرة تجعل أي صوت يبدو قريباً. */
  function resampleFrames(frames, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = (i * (frames.length - 1)) / (n - 1 || 1);
      const i0 = Math.floor(p), f = p - i0;
      const a = frames[i0], b = frames[Math.min(i0 + 1, frames.length - 1)];
      const v = new Float32Array(a.length);
      for (let k = 0; k < a.length; k++) v[k] = a[k] * (1 - f) + b[k] * f;
      out.push(v);
    }
    return out;
  }

  /* DTW: يسمح بأن يكون تقليدك أبطأ أو أسرع قليلاً من الأصل دون عقاب.
     الشريط (band) يمنع مسارات منحرفة تُطابق البداية بالنهاية. */
  const ALIGN_N = 36;      // طول التسلسلين بعد التطبيع الزمني
  /* مرونة المحاذاة. كانت خمسة أطر، وهو تسامحٌ يكفي نغمتين مُولّدتين
     ولا يكفي تسجيلين حقيقيين: قياسٌ على تسجيلات حقيقية أظهر أن كلبين
     مختلفين يقعان عند أرضية المقياس لمجرّد اختلاف التوقيت بينهما. */
  const BAND = 16;
  const SKEW = 0.04;       // غرامة صغيرة على كل خطوة غير قُطرية

  /* يرجّع متوسّط التشابه الجيبي على أفضل مسار محاذاة */
  function alignSim(melA, melB) {
    const A = resampleFrames(melA, ALIGN_N);
    const B = resampleFrames(melB, ALIGN_N);
    const n = ALIGN_N, INF = Infinity;
    let pc = new Float64Array(n + 1).fill(INF);
    let pl = new Float64Array(n + 1);
    let cc = new Float64Array(n + 1);
    let cl = new Float64Array(n + 1);
    pc[0] = 0;
    for (let i = 1; i <= n; i++) {
      cc.fill(INF); cl.fill(0);
      const jLo = Math.max(1, i - BAND), jHi = Math.min(n, i + BAND);
      for (let j = jLo; j <= jHi; j++) {
        const d = cosDist(A[i - 1], B[j - 1]);
        let best = pc[j - 1], bl = pl[j - 1], pen = 0;          // قُطري
        if (pc[j] + SKEW < best + pen) { best = pc[j]; bl = pl[j]; pen = SKEW; }
        if (cc[j - 1] + SKEW < best + pen) { best = cc[j - 1]; bl = cl[j - 1]; pen = SKEW; }
        if (best === INF) { best = 0; bl = 0; pen = 0; }
        cc[j] = d + best + pen;
        cl[j] = bl + 1;
      }
      let t = pc; pc = cc; cc = t;
      t = pl; pl = cl; cl = t;
    }
    if (!isFinite(pc[n]) || pl[n] < 1) return 0;
    return 1 - pc[n] / pl[n];     // متوسّط الجيب على المسار
  }

  function resampleTo(arr, n) {
    if (!arr.length) return new Array(n).fill(0);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const p = (i * (arr.length - 1)) / (n - 1 || 1);
      const i0 = Math.floor(p), f = p - i0;
      out[i] = (arr[i0] ?? 0) * (1 - f) + (arr[Math.min(i0 + 1, arr.length - 1)] ?? 0) * f;
    }
    return out;
  }

  function pearson(a, b) {
    const n = Math.min(a.length, b.length);
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      const x = a[i] - ma, y = b[i] - mb;
      num += x * y; da += x * x; db += y * y;
    }
    const den = Math.sqrt(da * db);
    if (den < 1e-9) return 0;
    return clamp(num / den, -1, 1);
  }

  const median = (a) => {
    if (!a.length) return 0;
    const s = a.slice().sort((x, y) => x - y);
    return s[s.length >> 1];
  };

  function pitchScore(fa, fb) {
    const va = fa.pitch.filter((v) => v > 0);
    const vb = fb.pitch.filter((v) => v > 0);
    const ta = fa.voicedRatio >= 0.22, tb = fb.voicedRatio >= 0.22;

    /* الأصل منغَّم وأنت أخرجت ضجيجاً (أو العكس): هذا فارق حقيقي
       يستحق أن يُحسب، لا أن يُحيَّد. */
    if (ta !== tb) return { value: 0.12, weak: false };

    /* كلاهما بلا نغمة واضحة (نباح، ضجيج محرّك): لا نكافئ ولا نعاقب،
       ونوزّع وزن النغمة على النبرة لأنها أصدق ما بقي. */
    if (!ta && !tb) return { value: 0, weak: true };
    if (va.length < 4 || vb.length < 4) return { value: 0, weak: true };

    const la = va.map((v) => Math.log2(v));
    const lb = vb.map((v) => Math.log2(v));
    const ma = median(la), mb = median(lb);
    const shape = pearson(
      resampleTo(la.map((v) => v - ma), RESAMPLE_N),
      resampleTo(lb.map((v) => v - mb), RESAMPLE_N)
    );
    const octaves = Math.abs(ma - mb);
    const absolute = Math.max(0, 1 - octaves / 1.5); // أوكتاف ونصف تسامحاً
    return { value: clamp(0.7 * Math.max(0, shape) + 0.3 * absolute, 0, 1), weak: false };
  }

  function envelopeScore(fa, fb) {
    const norm = (arr) => {
      const lo = Math.min.apply(null, arr), hi = Math.max.apply(null, arr);
      const r = hi - lo || 1;
      return arr.map((v) => (v - lo) / r);
    };
    const a = resampleTo(norm(fa.energy), RESAMPLE_N);
    const b = resampleTo(norm(fb.energy), RESAMPLE_N);
    return clamp(Math.max(0, pearson(a, b)), 0, 1);
  }

  /* منحنى الكرم: تقليد بشري معقول يقع بين 45 و90، لا بين 3 و12.
     اللعبة للضحك؛ صفرٌ في وجه من اجتهد يقتل الجلسة. */
  /* ============================================================
     معايرة النتيجة — الثوابت الثلاثة التي تضبط "كرم" اللعبة.
     FLOOR : المقياس الخام الذي يُعدّ "لا علاقة إطلاقاً" (يعطي 6).
     SPAN  : المسافة فوقه التي تُمدّ على كامل المئة.
     CURVE : أقلّ من 1 يرفع المتوسّطات، أكثر من 1 يشدّها لأسفل.

     مضبوطة على تسجيلات حقيقية لا على نغمات مُولّدة: قِيست ألفا مقارنة
     بين تسجيلات حقيقية، وضُبطت الخريطة كي يقع "تسجيلان لنفس الصنف"
     قرب 72 و"صنفان مختلفان" قرب 18.

     إن وجدتماها قاسية بعد اللعب: أنقصا FLOOR أو CURVE قليلاً.
     ============================================================ */
  const FLOOR = 0.124, SPAN = 0.296, CURVE = 0.85;

  function toPercent(raw) {
    const t = clamp((raw - FLOOR) / SPAN, 0, 1);
    return Math.round(6 + 93 * Math.pow(t, CURVE));
  }
  function partPercent(v) {
    return Math.round(clamp((v - 0.08) / 0.62, 0, 1) * 100);
  }

  /* fa = بصمة الصوت الأصلي، fb = بصمة تقليدك */
  function compare(fa, fb) {
    if (!fa || !fb) return { score: 0, silent: !fb, parts: { tone: 0, pitch: 0, rhythm: 0 } };

    /* أسٌّ خفيف يكبح التشابه العابر: بدونه كان الضجيج الأبيض يطابق
       كل شيء تقريباً. 1.6 كان مبالغة تهبط بكل شيء إلى الأرضية. */
    const tone = Math.pow(clamp(alignSim(fa.mel, fb.mel), 0, 1), 1.3);
    const p = pitchScore(fa, fb);
    const rhythm = envelopeScore(fa, fb);
    const longer = Math.max(fa.duration, fb.duration) || 1;
    const dur = clamp(1 - Math.abs(fa.duration - fb.duration) / longer, 0, 1);

    /* حين تكون الطبقة غير موثوقة نوزّع وزنها على النبرة والإيقاع
       بدل أن نُدخل رقماً محايداً يشوّش النتيجة. */
    const w = p.weak
      ? { tone: 0.62, pitch: 0.0, rhythm: 0.30, dur: 0.08 }
      : { tone: 0.46, pitch: 0.28, rhythm: 0.20, dur: 0.06 };

    const raw = w.tone * tone + w.pitch * p.value + w.rhythm * rhythm + w.dur * dur;

    return {
      score: toPercent(raw),
      silent: false,
      weakPitch: p.weak,
      parts: {
        tone: partPercent(tone),
        pitch: p.weak ? null : partPercent(p.value),
        rhythm: partPercent(rhythm),
      },
    };
  }

  global.Scoring = { extract, compare };
})(window);
