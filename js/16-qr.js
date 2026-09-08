/* ============================================================
   مولّد رمز QR — مكتوب هنا لا مستورَد
   ------------------------------------------------------------
   لماذا لا نستعمل مكتبة جاهزة من CDN؟ لسببين:
     • هذا مسار تسجيل دخول. لو تعطّل CDN أو حجبته شبكة المدرسة، فشل دخول
       المعلّم أمام صفّه. والمدارس تُشدّد على شبكاتها كثيراً.
     • سكربت خارجي على مسار الدخول يعني الوثوق بطرف ثالث في أحسس نقطة.
   الشيفرة كاملة هنا: لا شبكة، لا تبعية، لا مفاجآت.

   النطاق مقصود ومحدود: النمط الثنائي (byte) ومستوى تصحيح الأخطاء M
   والإصدارات 1..10 — يكفي حتى 216 حرفاً، ورابطنا نحو 95. مستوى M اختير
   لأن الرمز يُصوَّر من مسافة وبزاوية على سبورة، فيحتمل ~15% تلفاً.

   مُتحقَّق منه فعلياً: وُلِّد الرمز ثم فُكّ ترميزه بمكتبة قراءة مستقلة
   (jsQR) فطابق النص الأصلي في الإصدارات والأقنعة كلها.
   ============================================================ */

/* ---------- حقل جالوا GF(256) لتصحيح الأخطاء ---------- */
const QR_EXP = new Uint8Array(512);
const QR_LOG = new Uint8Array(256);
(function buildGaloisTables(){
    let x = 1;
    for(let i = 0; i < 255; i++){
        QR_EXP[i] = x;
        QR_LOG[x] = i;
        x <<= 1;
        if(x & 0x100) x ^= 0x11d;   // كثير الحدود البدائي المعتمد في معيار QR
    }
    for(let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
})();

function qrMul(a, b){
    if(a === 0 || b === 0) return 0;
    return QR_EXP[QR_LOG[a] + QR_LOG[b]];
}

// كثير حدود المولّد لعدد معيّن من رموز التصحيح: حاصل ضرب (x + α^i)
// ⚠️ المعاملات مرتّبة من الأعلى درجةً إلى الأدنى. ضربُ كثير حدود في (x + α^i)
// يعني: حدّ x ينزل في نفس الفهرس، وحدّ α^i ينزل في الفهرس التالي. عكسُ
// الاثنين يُنتج كثير حدود مقلوباً — يعمل صدفةً عند الدرجة 1 ويفشل بعدها،
// فينتج رمزاً سليم الشكل لا يقرؤه ماسح. (كشفه فكُّ الترميز، لا المراجعة.)
function qrGeneratorPoly(degree){
    let poly = [1];
    for(let i = 0; i < degree; i++){
        const next = new Array(poly.length + 1).fill(0);
        for(let j = 0; j < poly.length; j++){
            next[j]     ^= poly[j];
            next[j + 1] ^= qrMul(poly[j], QR_EXP[i]);
        }
        poly = next;
    }
    return poly;
}

// قسمة كثيرات الحدود: الباقي هو رموز التصحيح
function qrEcCodewords(data, ecCount){
    const gen = qrGeneratorPoly(ecCount);
    const buf = data.concat(new Array(ecCount).fill(0));
    for(let i = 0; i < data.length; i++){
        const factor = buf[i];
        if(factor === 0) continue;
        for(let j = 0; j < gen.length; j++){
            buf[i + j] ^= qrMul(gen[j], factor);
        }
    }
    return buf.slice(data.length);
}

/* ---------- جداول المعيار للإصدارات 1..10 بمستوى M ----------
   لكل إصدار: [رموز تصحيح لكل كتلة، عدد كتل المجموعة1، بيانات كتلة المجموعة1،
               عدد كتل المجموعة2، بيانات كتلة المجموعة2]                    */
const QR_BLOCKS_M = {
    1:  [10, 1, 16, 0,  0],
    2:  [16, 1, 28, 0,  0],
    3:  [26, 1, 44, 0,  0],
    4:  [18, 2, 32, 0,  0],
    5:  [24, 2, 43, 0,  0],
    6:  [16, 4, 27, 0,  0],
    7:  [18, 4, 31, 0,  0],
    8:  [22, 2, 38, 2, 39],
    9:  [22, 3, 36, 2, 37],
    10: [26, 4, 43, 1, 44],
};

// مراكز أنماط المحاذاة لكل إصدار
const QR_ALIGN = {
    1: [], 2: [6,18], 3: [6,22], 4: [6,26], 5: [6,30],
    6: [6,34], 7: [6,22,38], 8: [6,24,42], 9: [6,26,46], 10: [6,28,50],
};

function qrDataCapacity(version){
    const [, b1, d1, b2, d2] = QR_BLOCKS_M[version];
    return b1 * d1 + b2 * d2;
}

/* ---------- ترميز النص إلى رموز بيانات ---------- */
function qrEncodeData(bytes, version){
    const capacity = qrDataCapacity(version);
    const bits = [];
    const push = (value, length) => {
        for(let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
    };

    push(0b0100, 4);                                  // مؤشر النمط الثنائي
    push(bytes.length, version < 10 ? 8 : 16);        // عدّاد الطول يتّسع من الإصدار 10
    for(const b of bytes) push(b, 8);

    // منهي الرسالة: حتى أربعة أصفار، أو أقل إن قاربنا السعة
    const maxBits = capacity * 8;
    for(let i = 0; i < 4 && bits.length < maxBits; i++) bits.push(0);
    while(bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for(let i = 0; i < bits.length; i += 8){
        let byte = 0;
        for(let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
        codewords.push(byte);
    }
    // حشو المعيار المتناوب
    const pad = [0xEC, 0x11];
    let k = 0;
    while(codewords.length < capacity) codewords.push(pad[k++ % 2]);
    return codewords;
}

// تشابك الكتل كما يفرض المعيار: رمز من كل كتلة بالتناوب
function qrInterleave(codewords, version){
    const [ecCount, b1, d1, b2, d2] = QR_BLOCKS_M[version];
    const dataBlocks = [];
    const ecBlocks = [];
    let pos = 0;
    for(let i = 0; i < b1; i++){
        const block = codewords.slice(pos, pos + d1); pos += d1;
        dataBlocks.push(block); ecBlocks.push(qrEcCodewords(block, ecCount));
    }
    for(let i = 0; i < b2; i++){
        const block = codewords.slice(pos, pos + d2); pos += d2;
        dataBlocks.push(block); ecBlocks.push(qrEcCodewords(block, ecCount));
    }

    const out = [];
    const maxData = Math.max(d1, d2);
    for(let i = 0; i < maxData; i++){
        for(const block of dataBlocks) if(i < block.length) out.push(block[i]);
    }
    for(let i = 0; i < ecCount; i++){
        for(const block of ecBlocks) out.push(block[i]);
    }
    return out;
}

/* ---------- بناء المصفوفة ---------- */
function qrBuildMatrix(version){
    const size = version * 4 + 17;
    const modules  = Array.from({ length: size }, () => new Array(size).fill(0));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFn = (r, c, v) => {
        if(r < 0 || c < 0 || r >= size || c >= size) return;
        modules[r][c] = v ? 1 : 0;
        reserved[r][c] = true;
    };

    // أنماط الكشف الثلاثة وفواصلها
    const finder = (top, left) => {
        for(let r = -1; r <= 7; r++){
            for(let c = -1; c <= 7; c++){
                const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                               (c >= 0 && c <= 6 && (r === 0 || r === 6));
                const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
                setFn(top + r, left + c, inRing || inCore);
            }
        }
    };
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // أنماط التوقيت
    for(let i = 8; i < size - 8; i++){
        setFn(6, i, i % 2 === 0);
        setFn(i, 6, i % 2 === 0);
    }

    // أنماط المحاذاة — عدا ما يتقاطع مع أنماط الكشف
    const centers = QR_ALIGN[version];
    for(const r of centers){
        for(const c of centers){
            const nearFinder = (r <= 8 && c <= 8) ||
                               (r <= 8 && c >= size - 9) ||
                               (r >= size - 9 && c <= 8);
            if(nearFinder) continue;
            for(let dr = -2; dr <= 2; dr++){
                for(let dc = -2; dc <= 2; dc++){
                    const edge = Math.max(Math.abs(dr), Math.abs(dc));
                    setFn(r + dr, c + dc, edge !== 1);
                }
            }
        }
    }

    // الوحدة الداكنة الثابتة
    setFn(size - 8, 8, true);

    // حجز مواضع معلومات النسق (تُملأ بعد اختيار القناع)
    for(let i = 0; i <= 8; i++){
        if(i !== 6){ reserved[8][i] = true; reserved[i][8] = true; }
    }
    for(let i = 0; i < 8; i++){
        reserved[8][size - 1 - i] = true;
        reserved[size - 1 - i][8] = true;
    }

    // معلومات الإصدار للإصدار 7 فأعلى
    if(version >= 7){
        let rem = version;
        for(let i = 0; i < 12; i++){
            rem = (rem << 1) ^ ((rem >>> 11) * 0b1111100100101);
        }
        const info = (version << 12) | rem;
        for(let i = 0; i < 18; i++){
            const bit = (info >> i) & 1;
            const r = Math.floor(i / 3), c = i % 3;
            setFn(size - 11 + c, r, bit);
            setFn(r, size - 11 + c, bit);
        }
    }

    return { modules, reserved, size };
}

// وضع البيانات في مسار متعرّج من أسفل اليمين، مع تخطّي عمود التوقيت
function qrPlaceData(matrix, codewords){
    const { modules, reserved, size } = matrix;
    let bitIndex = 0;
    const nextBit = () => {
        const total = codewords.length * 8;
        if(bitIndex >= total) return 0;   // وحدات الباقي تبقى فاتحة
        const bit = (codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1;
        bitIndex++;
        return bit;
    };

    let upward = true;
    for(let right = size - 1; right >= 1; right -= 2){
        if(right === 6) right = 5;        // العمود 6 نمط توقيت لا يحمل بيانات
        for(let step = 0; step < size; step++){
            const row = upward ? size - 1 - step : step;
            for(let k = 0; k < 2; k++){
                const col = right - k;
                if(reserved[row][col]) continue;
                modules[row][col] = nextBit();
            }
        }
        upward = !upward;
    }
}

const QR_MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

// عقوبات المعيار الأربع — أدناها يفوز، لأنها تقيس صعوبة القراءة
function qrPenalty(modules, size){
    let penalty = 0;

    // 1) خمس وحدات متشابهة متتالية فأكثر
    for(let i = 0; i < size; i++){
        for(const horizontal of [true, false]){
            let run = 1;
            for(let j = 1; j < size; j++){
                const cur  = horizontal ? modules[i][j]     : modules[j][i];
                const prev = horizontal ? modules[i][j - 1] : modules[j - 1][i];
                if(cur === prev){ run++; }
                else { if(run >= 5) penalty += run - 2; run = 1; }
            }
            if(run >= 5) penalty += run - 2;
        }
    }

    // 2) مربّعات 2×2 بلون واحد
    for(let r = 0; r < size - 1; r++){
        for(let c = 0; c < size - 1; c++){
            const v = modules[r][c];
            if(v === modules[r][c+1] && v === modules[r+1][c] && v === modules[r+1][c+1]) penalty += 3;
        }
    }

    // 3) نمط يشبه نمط الكشف (1:1:3:1:1) فيربك الماسح
    const p1 = [1,0,1,1,1,0,1,0,0,0,0];
    const p2 = [0,0,0,0,1,0,1,1,1,0,1];
    const matches = (get, start) => {
        let a = true, b = true;
        for(let k = 0; k < 11; k++){
            const v = get(start + k);
            if(v !== p1[k]) a = false;
            if(v !== p2[k]) b = false;
        }
        return a || b;
    };
    for(let i = 0; i < size; i++){
        for(let j = 0; j + 11 <= size; j++){
            if(matches(k => modules[i][k], j)) penalty += 40;
            if(matches(k => modules[k][i], j)) penalty += 40;
        }
    }

    // 4) اختلال التوازن بين الداكن والفاتح
    let dark = 0;
    for(let r = 0; r < size; r++) for(let c = 0; c < size; c++) dark += modules[r][c];
    const ratio = (dark * 100) / (size * size);
    penalty += Math.floor(Math.abs(ratio - 50) / 5) * 10;

    return penalty;
}

// معلومات النسق: 15 بتاً بتصحيح BCH ثم قناع ثابت من المعيار
function qrFormatBits(mask){
    const data = (0b00 << 3) | mask;      // 00 = مستوى التصحيح M
    let rem = data;
    for(let i = 0; i < 10; i++){
        rem = (rem << 1) ^ ((rem >>> 9) * 0b10100110111);
    }
    return ((data << 10) | rem) ^ 0b101010000010010;
}

function qrApplyFormat(modules, size, mask){
    const bits = qrFormatBits(mask);
    // ⚠️ الترتيب هنا دقيق ولا يقبل التخمين: البتّات الأولى تنزل في العمود 8
    // (صفوف متغيّرة) لا في الصف 8. خلطُ الصف بالعمود يُنتج رمزاً يبدو سليماً
    // للعين تماماً ولا يقرأه أي ماسح — وهو ما وقع فعلاً قبل الاختبار.
    for(let i = 0; i < 15; i++){
        const bit = (bits >> i) & 1;
        // النسخة الأولى حول نمط الكشف الأعلى الأيسر
        if(i < 6)        modules[i][8] = bit;
        else if(i === 6) modules[7][8] = bit;
        else if(i === 7) modules[8][8] = bit;
        else if(i === 8) modules[8][7] = bit;
        else             modules[8][14 - i] = bit;
        // النسخة الثانية موزّعة على النمطين الآخرين
        if(i < 8) modules[8][size - 1 - i] = bit;
        else      modules[size - 15 + i][8] = bit;
    }
    modules[size - 8][8] = 1;   // الوحدة الداكنة الثابتة
}

/**
 * يبني رمز QR ويعيد مصفوفة منطقية (true = وحدة داكنة).
 * يرمي خطأ إن تجاوز النص سعة الإصدار 10.
 */
function qrEncode(text){
    const bytes = Array.from(new TextEncoder().encode(String(text)));

    let version = 0;
    for(let v = 1; v <= 10; v++){
        const headerBytes = v < 10 ? 2 : 3;     // مؤشر النمط + عدّاد الطول
        if(bytes.length + headerBytes <= qrDataCapacity(v)){ version = v; break; }
    }
    if(!version) throw new Error("QR_TOO_LONG");

    const codewords = qrInterleave(qrEncodeData(bytes, version), version);

    let best = null;
    for(let mask = 0; mask < 8; mask++){
        const matrix = qrBuildMatrix(version);
        qrPlaceData(matrix, codewords);
        const { modules, reserved, size } = matrix;
        for(let r = 0; r < size; r++){
            for(let c = 0; c < size; c++){
                if(!reserved[r][c] && QR_MASKS[mask](r, c)) modules[r][c] ^= 1;
            }
        }
        qrApplyFormat(modules, size, mask);
        const score = qrPenalty(modules, size);
        if(!best || score < best.score) best = { score, modules, size };
    }

    return best.modules.map(row => row.map(v => v === 1));
}

/**
 * يرسم الرمز في عنصر <canvas>. الهامش الأبيض (quiet zone) أربع وحدات —
 * بدونه تفشل كثير من الماسحات، وهو خطأ شائع.
 */
function qrDrawCanvas(canvas, text, pixelSize){
    const matrix = qrEncode(text);
    const quiet = 4;
    const modules = matrix.length;
    const scale = pixelSize || 6;
    const side = (modules + quiet * 2) * scale;

    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = "#000000";
    for(let r = 0; r < modules; r++){
        for(let c = 0; c < modules; c++){
            if(matrix[r][c]){
                ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
            }
        }
    }
    return canvas;
}

// للاختبار في Node
if(typeof module !== "undefined" && module.exports){
    module.exports = { qrEncode };
}
