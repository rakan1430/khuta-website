/* ============================================================
   قلّدها — دالة الغرف
   ------------------------------------------------------------
   كل التواصل بين الجهازين يمرّ من هنا. التخزين على Netlify Blobs
   (لا قاعدة بيانات ولا إعداد). المبدأ الذي يحكم التصميم كله:
   كل لاعب يكتب في مفاتيح تخصّه وحده، ولا أحد يكتب فوق كتابة الآخر.
   وثيقة الغرفة نفسها لا يعدّلها إلا حدثٌ نادر (إنشاء، انضمام، بدء،
   انتقال جولة) — لأن Blobs بلا معاملات: آخر كاتب يفوز.
   ============================================================ */
import { getStore } from "@netlify/blobs";

/* قراءة قوية (strong): اللاعب الثاني يجب أن يرى تسجيل الأول فوراً،
   لا بعد ستين ثانية كما في الاتّساق الافتراضي. */
const st = () => getStore({ name: "qalladha", consistency: "strong" });

/* الغرفة تعيش 12 ساعة ثم تُعدّ منتهية. لا حاجة لمكنسة مجدولة:
   نحذفها عند أول محاولة دخول بعد انتهائها. */
const ROOM_TTL_MS = 12 * 60 * 60 * 1000;

/* سقف حجم المقطع الصوتي بعد ترميز base64 (≈ 700 كيلوبايت خام).
   تسجيل من أربع ثوانٍ لا يقترب من هذا، والسقف يمنع إغراق التخزين. */
const MAX_AUDIO_CHARS = 950_000;

/* حروف كود الغرفة: حذفنا ما يلتبس نطقه أو شكله (O/0, I/1, B/8, S/5)
   لأن الكود يُقال صوتياً في الغالب: "غرفتي كي تسعة..." */
const CODE_ALPHABET = "ACDEFGHJKLMNPQRTUVWXYZ2346799";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const fail = (message, status = 400) => json({ error: message }, status);

const roomKey = (code) => `room/${code}`;
const subKey = (code, round, pid) => `sub/${code}/${round}/${pid}`;
const clipKey = (code, round, pid) => `clip/${code}/${round}/${pid}`;
const readyKey = (code, round, pid) => `ready/${code}/${round}/${pid}`;
const targetKey = (code, slot) => `target/${code}/${slot}`;

const cleanName = (v) => String(v ?? "").trim().slice(0, 14) || "لاعب";
const cleanPid = (v) => (/^[a-z0-9]{6,32}$/i.test(String(v ?? "")) ? String(v) : null);
const cleanCode = (v) => {
  const c = String(v ?? "").toUpperCase().trim();
  return /^[A-Z0-9]{4}$/.test(c) ? c : null;
};
const cleanAudio = (v) => {
  const s = String(v ?? "");
  if (!s || s.length > MAX_AUDIO_CHARS) return null;
  return /^[A-Za-z0-9+/=]+$/.test(s) ? s : null;
};

function makeCode() {
  let out = "";
  for (let i = 0; i < 4; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

async function loadRoom(store, code) {
  const room = await store.get(roomKey(code), { type: "json" });
  if (!room) return null;
  if (Date.now() - room.createdAt > ROOM_TTL_MS) {
    await store.delete(roomKey(code));
    return null;
  }
  return room;
}

const isHost = (room, pid) => room.hostPid === pid;
const inRoom = (room, pid) => room.players.some((p) => p.pid === pid);

export default async (req) => {
  if (req.method !== "POST") return fail("استخدم POST", 405);

  let body;
  try {
    body = await req.json();
  } catch {
    return fail("طلب غير مفهوم");
  }

  const store = st();
  const op = String(body.op ?? "");
  const pid = cleanPid(body.pid);
  if (!pid) return fail("معرّف لاعب غير صالح");

  /* ---------- إنشاء غرفة ---------- */
  if (op === "create") {
    let code = null;
    for (let tries = 0; tries < 8 && !code; tries++) {
      const candidate = makeCode();
      if (!(await store.get(roomKey(candidate)))) code = candidate;
    }
    if (!code) return fail("تعذّر إيجاد كود فارغ، جرّب مرة ثانية", 503);

    const room = {
      code,
      createdAt: Date.now(),
      hostPid: pid,
      players: [{ pid, name: cleanName(body.name) }],
      phase: "lobby",
      round: 0,
      rounds: 5,
      challenges: [],
      v: 1,
    };
    await store.setJSON(roomKey(code), room);
    return json({ room });
  }

  /* كل ما تبقّى يحتاج كوداً وغرفة قائمة */
  const code = cleanCode(body.code);
  if (!code) return fail("كود الغرفة يتكوّن من 4 خانات");
  const room = await loadRoom(store, code);
  if (!room) return fail("ما لقينا غرفة بهذا الكود — تأكّد منه أو أنشئ غرفة جديدة", 404);

  /* ---------- الانضمام ---------- */
  if (op === "join") {
    const existing = room.players.find((p) => p.pid === pid);
    if (existing) {
      existing.name = cleanName(body.name);
    } else {
      if (room.players.length >= 2) return fail("الغرفة ممتلئة — لاعبان فقط", 409);
      if (room.phase !== "lobby") return fail("اللعب بدأ في هذه الغرفة", 409);
      room.players.push({ pid, name: cleanName(body.name) });
    }
    room.v++;
    await store.setJSON(roomKey(code), room);
    return json({ room });
  }

  if (!inRoom(room, pid)) return fail("لست في هذه الغرفة", 403);

  /* ---------- حالة الغرفة (نداء دوري) ---------- */
  if (op === "sync") {
    const round = Number(body.round ?? room.round) | 0;
    const subs = {};
    for (const p of room.players) {
      const s = await store.get(subKey(code, round, p.pid), { type: "json" });
      if (s) subs[p.pid] = s;
    }
    /* لا نكشف نتيجة أحد قبل أن يسجّل الاثنان — كي لا يتسلّل أحد
       فيرى درجة صاحبه قبل أن يسجّل هو. */
    const everyone = room.players.length >= 2 && room.players.every((p) => subs[p.pid]);
    const safeSubs = {};
    for (const p of room.players) {
      if (!subs[p.pid]) continue;
      safeSubs[p.pid] = everyone ? subs[p.pid] : { done: true };
    }
    const ready = [];
    for (const p of room.players) {
      if (await store.get(readyKey(code, round, p.pid))) ready.push(p.pid);
    }
    return json({ room, subs: safeSubs, revealed: everyone, ready });
  }

  /* ---------- رفع صوت التحدي المخصّص (المضيف) ---------- */
  if (op === "target") {
    if (!isHost(room, pid)) return fail("صاحب الغرفة فقط يسجّل صوت التحدي", 403);
    const audio = cleanAudio(body.audio);
    if (!audio) return fail("المقطع الصوتي كبير أو غير صالح", 413);
    const slot = String(body.slot ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    if (!slot) return fail("خانة غير صالحة");
    await store.setJSON(targetKey(code, slot), { mime: String(body.mime ?? "audio/webm").slice(0, 60), audio });
    return json({ ok: true });
  }

  if (op === "gettarget") {
    const slot = String(body.slot ?? "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    const t = await store.get(targetKey(code, slot), { type: "json" });
    if (!t) return fail("لم نجد صوت التحدي", 404);
    return json(t);
  }

  /* ---------- بدء اللعب (المضيف) ---------- */
  if (op === "start") {
    if (!isHost(room, pid)) return fail("صاحب الغرفة هو من يبدأ", 403);
    if (room.players.length < 2) return fail("ننتظر صديقك يدخل أولاً", 409);
    const challenges = Array.isArray(body.challenges) ? body.challenges.slice(0, 12) : [];
    if (!challenges.length) return fail("لا توجد تحديات");
    room.challenges = challenges.map((c) => String(c).slice(0, 24));
    room.rounds = room.challenges.length;
    room.round = 0;
    room.phase = "play";
    room.v++;
    await store.setJSON(roomKey(code), room);
    return json({ room });
  }

  /* ---------- تسليم تسجيل ---------- */
  if (op === "submit") {
    const round = Number(body.round ?? -1) | 0;
    if (round !== room.round || room.phase !== "play") return fail("الجولة تغيّرت — حدّث الصفحة", 409);
    const audio = cleanAudio(body.audio);
    if (!audio) return fail("التسجيل كبير أو غير صالح", 413);
    const score = Math.max(0, Math.min(100, Math.round(Number(body.score) || 0)));
    const parts = body.parts && typeof body.parts === "object" ? body.parts : {};
    await store.setJSON(clipKey(code, round, pid), {
      mime: String(body.mime ?? "audio/webm").slice(0, 60),
      audio,
    });
    await store.setJSON(subKey(code, round, pid), {
      score,
      parts: {
        tone: Math.round(Number(parts.tone) || 0),
        pitch: Math.round(Number(parts.pitch) || 0),
        rhythm: Math.round(Number(parts.rhythm) || 0),
      },
      at: Date.now(),
    });
    return json({ ok: true });
  }

  /* ---------- جلب تسجيل الخصم ---------- */
  if (op === "clip") {
    const round = Number(body.round ?? -1) | 0;
    const who = cleanPid(body.who);
    if (!who || !inRoom(room, who)) return fail("لاعب غير معروف", 404);
    /* لا يُسلَّم التسجيل إلا بعد أن يسجّل الاثنان */
    for (const p of room.players) {
      if (!(await store.get(subKey(code, round, p.pid)))) return fail("لم ينتهِ الجميع بعد", 409);
    }
    const c = await store.get(clipKey(code, round, who), { type: "json" });
    if (!c) return fail("لم نجد التسجيل", 404);
    return json(c);
  }

  /* ---------- جاهز للجولة التالية ---------- */
  if (op === "ready") {
    const round = Number(body.round ?? -1) | 0;
    if (round !== room.round) return json({ room });
    await store.set(readyKey(code, round, pid), "1");

    let count = 0;
    for (const p of room.players) if (await store.get(readyKey(code, round, p.pid))) count++;

    if (count >= room.players.length) {
      /* نقرأ الغرفة من جديد قبل التقديم: لو سبقنا الطرف الآخر إليها
         فالجولة تقدّمت أصلاً ولا يصحّ أن نقدّمها مرتين. */
      const fresh = await loadRoom(store, code);
      if (fresh && fresh.round === round && fresh.phase === "play") {
        const next = round + 1;
        if (next >= fresh.rounds) fresh.phase = "end";
        else fresh.round = next;
        fresh.v++;
        await store.setJSON(roomKey(code), fresh);
        return json({ room: fresh });
      }
      const latest = await loadRoom(store, code);
      return json({ room: latest ?? room });
    }
    return json({ room });
  }

  /* ---------- جولة جديدة من الصفر (المضيف) ---------- */
  if (op === "again") {
    if (!isHost(room, pid)) return fail("صاحب الغرفة هو من يعيد", 403);
    room.phase = "lobby";
    room.round = 0;
    room.challenges = [];
    room.startedAt = Date.now();
    room.v++;
    await store.setJSON(roomKey(code), room);
    /* التسجيلات القديمة تبقى بلا ضرر: مفاتيحها تحمل رقم الجولة
       والغرفة كلها تُمسح بعد اثنتي عشرة ساعة. */
    return json({ room });
  }

  return fail("عملية غير معروفة");
};

export const config = { path: "/api/room" };
