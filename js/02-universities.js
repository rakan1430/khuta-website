/* ============================================================
   1) بيانات الجامعات
   ------------------------------------------------------------
   ⚠️ مصدر البيانات: تجميع من الصفحات الرسمية لبعض الجامعات (uqu.edu.sa،
   kau.edu.sa، kkux.kku.edu.sa) بالإضافة إلى تقارير صحفية ومصادر تعليمية متعددة،
   وليست تغذية مباشرة من "قياس" أو وزارة التعليم. بعض الجامعات (كجامعة الملك
   عبدالعزيز) غيّرت شروطها مؤخراً (إضافة STEP اعتباراً من العام الجامعي
   1448-1449هـ)، مما يؤكد أن هذه الشروط تتغير سنوياً.
   القيمة step تكون: true = مطلوب لعموم برامج البكالوريوس المنتظم،
   "partial" = مطلوب لبرامج/كليات معينة فقط (غالباً الطب والتمريض واللغات
   والهندسة الإنجليزية)، false = لم نجد ما يفيد اشتراطه حالياً.
   استخدم REMOTE_UNIVERSITIES_URL أدناه لتحديث هذه البيانات دون تعديل الكود.
   ============================================================ */
const DATA_LAST_UPDATED = "13 يوليو 2026";
const DATA_DISCLAIMER_AR = "هذه الأوزان ومتطلبات STEP مجمّعة من مصادر متعددة (مواقع جامعات رسمية وتقارير تعليمية) وقد لا تعكس آخر تحديث للجامعة، والقبول الفعلي يختلف أحياناً بين الكليات داخل الجامعة نفسها. تحقق دائماً من بوابة القبول الموحد أو موقع الجامعة قبل اتخاذ أي قرار.";
const DATA_DISCLAIMER_EN = "These weights and STEP requirements are aggregated from multiple sources (official university pages and education reports) and may not reflect the latest policy; actual admission often varies between colleges within the same university. Always verify with the unified admission portal or the university's official site before deciding.";

/* قائمة عامة تقريبية للتخصصات التي غالباً تشترط STEP والتي غالباً لا تشترطه —
   نمط عام شائع عبر أغلب الجامعات السعودية، وليست قائمة رسمية لكل جامعة على
   حدة (ذلك يتطلب مراجعة دليل قبول كل جامعة كل عام). تُعرض كمرجع تقريبي فقط. */
const DEFAULT_STEP_MAJORS = {
    yes: {
        ar: ["الطب البشري","طب الأسنان","الصيدلة","الهندسة (المسارات/البرامج الإنجليزية)","علوم الحاسب (في بعض الجامعات)","اللغات والترجمة"],
        en: ["Medicine","Dentistry","Pharmacy","Engineering (English-taught tracks)","Computer Science (at some universities)","Languages & Translation"],
    },
    no: {
        ar: ["الشريعة والدراسات الإسلامية","الآداب واللغة العربية","العلوم الإدارية (غالباً)","التربية (غالباً)","العلوم الاجتماعية"],
        en: ["Sharia & Islamic Studies","Arabic Language & Literature","Business Administration (usually)","Education (usually)","Social Sciences"],
    }
};

/* ============================================================
   ⭐ قسم الجامعات — دليلك الكامل لإضافة جامعة جديدة أو تعديل موزونة قائمة
   ------------------------------------------------------------
   ملاحظة: منذ آخر تحديث، أصبحت الجامعات تُدار بشكل أساسي من جدول
   Supabase (Table Editor) — راجع SUPABASE_SETUP.sql. القائمة أدناه هي
   فقط "نسخة احتياطية" يستخدمها التطبيق إن تعذّر الوصول لـ Supabase.
   يمكنك أيضاً استخدام REMOTE_UNIVERSITIES_URL (ملف JSON على GitHub) كطريقة
   بديلة إن فضّلت ذلك على Supabase — كلاهما يعمل، اختر ما يريحك أكثر.

   === لإضافة جامعة جديدة بالكامل ===
   انسخ أي سطر كامل (من { id: إلى },) والصقه، ثم عدّل:
   - id: معرّف فريد بالإنجليزية بدون مسافات (مثال: "new_uni")
   - name / nameEn: اسم الجامعة بالعربي والإنجليزي
   - city: المدينة
   - type: "public" (حكومية) أو "private" (خاصة)

   === لتعديل وزن الموزونة لجامعة معينة (القسم الأهم) ===
   ابحث عن الجامعة بالاسم، وعدّل قيم weights:
   - high: وزن الثانوية (%) — مثال: 30
   - qat: وزن القدرات (%) — مثال: 30
   - tah: وزن التحصيلي (%) — مثال: 40
   - step: (اختياري) وزن STEP بالنسبة المئوية إن كانت الجامعة تخصص له وزناً
     رقمياً ضمن المعادلة (مثال: جامعة الملك عبدالعزيز التي تعطيه 10%)
   ⚠️ يجب أن يكون مجموع high + qat + tah (+ step إن وُجد) = 100 بالضبط

   === لتحديد هل الجامعة تشترط STEP أو لا (حقل step الرئيسي، خارج weights) ===
   - step: true → إجباري لكل برامج البكالوريوس، يُقفل الخيار على الطالب تلقائياً
   - step: "partial" → إجباري لبعض الكليات فقط (كالطب) وليس كل الجامعة
   - step: false → لا يوجد ما يفيد اشتراطه حالياً
   - stepMin: (اختياري) الحد الأدنى التقريبي المطلوب في STEP إن كان معروفاً

   === لتحديد مستوى التنافسية (يظهر كأعمدة ملوّنة في تفاصيل الجامعة) ===
   - comp: رقم من 1 (أقل تنافسية) إلى 5 (الأعلى تنافسية كالطب)

   === لكتابة ملاحظة توضيحية تظهر للطالب أسفل تفاصيل الجامعة ===
   - note / noteEn: أي نص حر بالعربي والإنجليزي (مثال: تفاصيل كلية معينة)
   ============================================================ */
const UNIVERSITIES = [
    { id:"ksu", name:"جامعة الملك سعود", nameEn:"King Saud University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:5,
      note:"الوزن العام لأغلب الكليات العلمية. بعض الكليات (كالطب والهندسة وبرامج اللغة الإنجليزية) قد تشترط درجة معينة في STEP أو IELTS/TOEFL، وتضيف كليات كالطب مقابلة شخصية.",
      noteEn:"General weighting for most scientific colleges. Some colleges (Medicine, Engineering, English-taught programs) may require a STEP/IELTS/TOEFL score, and Medicine typically adds a personal interview." },
    { id:"kau", name:"جامعة الملك عبدالعزيز", nameEn:"King Abdulaziz University", city:"جدة", cityEn:"Jeddah", type:"public",
      weights:{high:30, qat:30, tah:30, step:10}, step:true, stepMin:60, comp:4,
      note:"⚡ حدّثت الجامعة رسمياً معايير القبول اعتباراً من العام الجامعي 1448-1449هـ لتصبح: 30% ثانوية + 30% قدرات + 30% تحصيلي + 10% STEP، لبرامج البكالوريوس انتظام والسنة التأهيلية والدبلوم الصباحي. راجع الموقع الرسمي لتأكيد سريان هذا القرار على دفعتك.",
      noteEn:"The university officially updated its admission formula starting the 1448-1449H academic year to: 30% high-school + 30% Qudrat + 30% Tahsili + 10% STEP, for regular bachelor's, foundation-year and morning diploma programs. Verify on the official site that this applies to your intake." },
    { id:"kfupm", name:"جامعة الملك فهد للبترول والمعادن", nameEn:"King Fahd University of Petroleum & Minerals", city:"الظهران", cityEn:"Dhahran", type:"public",
      weights:{high:10, qat:50, tah:40}, step:true, stepMin:55, comp:5,
      note:"يُشترط اجتياز اختبار STEP (أو ما يعادله من IELTS/TOEFL/Duolingo) كشرط أساسي للتقديم بغض النظر عن الموزونة. مسار القبول الأساسي يعتمد غالباً على القدرات والتحصيلي فقط (50%/50%) دون الثانوية.",
      noteEn:"STEP (or equivalent IELTS/TOEFL/Duolingo) is a mandatory admission gate regardless of the weighted score. The basic admission track often uses Qudrat/Tahsili only (50%/50%)." },
    { id:"imamu", name:"جامعة الإمام محمد بن سعود الإسلامية", nameEn:"Imam Mohammad Ibn Saud Islamic University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"الوزن العام لمعظم الكليات. مسار اللغات والترجمة يشترط تقريباً 55 درجة في STEP وفق مصادر تعليمية (يُنصح بالتأكيد من الجامعة).",
      noteEn:"General weighting for most colleges. The Languages & Translation track reportedly requires around 55 in STEP per education sources (verify with the university)." },
    { id:"uqu", name:"جامعة أم القرى", nameEn:"Umm Al-Qura University", city:"مكة المكرمة", cityEn:"Mecca", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"✅ مؤكد من الموقع الرسمي للجامعة: يُشترط اجتياز STEP بدرجة 60 فأعلى للقبول في التخصصات الطبية تحديداً؛ باقي الكليات لا تشترطه عادة.",
      noteEn:"✅ Confirmed on the official university site: STEP score of 60+ is required specifically for medical-college admission; other colleges generally don't require it." },
    { id:"kku", name:"جامعة الملك خالد", nameEn:"King Khalid University", city:"أبها", cityEn:"Abha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:true, comp:3,
      note:"تشترط الجامعة اجتياز اختبار تحديد مستوى اللغة الإنجليزية ضمن شروط القبول (STEP أو ما يعادله)، ويُلغى ترشيح من لا يحضره — مذكور في دليل القبول الرسمي ومركز STEP التابع للجامعة (KKUx).",
      noteEn:"The university requires an English proficiency test (STEP or equivalent) as an admission condition — noted in the official admission guide and the university's own STEP training center (KKUx)." },
    { id:"qu", name:"جامعة القصيم", nameEn:"Qassim University", city:"بريدة", cityEn:"Buraidah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. بعض الكليات الصحية والهندسية قد تضيف شرط STEP.", noteEn:"General weighting. Some health/engineering colleges may add a STEP requirement." },
    { id:"pnu", name:"جامعة الأميرة نورة بنت عبدالرحمن", nameEn:"Princess Nourah bint Abdulrahman University", city:"الرياض", cityEn:"Riyadh", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"جامعة نسائية بالكامل. كلية اللغات تشترط وفق مصادر تعليمية حوالي 83 درجة في STEP؛ التخصصات الأخرى غالباً لا تشترطه.",
      noteEn:"Women-only university. The College of Languages reportedly requires around 83 in STEP per education sources; other majors generally don't require it." },
    { id:"kfu", name:"جامعة الملك فيصل", nameEn:"King Faisal University", city:"الأحساء", cityEn:"Al-Ahsa", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية والإنجليزية غالباً تضيف شرط لغة.", noteEn:"General weighting. Health and English-taught colleges often add a language requirement." },
    { id:"ksauhs", name:"جامعة الملك سعود بن عبدالعزيز للعلوم الصحية", nameEn:"King Saud bin Abdulaziz University for Health Sciences", city:"الرياض / جدة / الأحساء", cityEn:"Riyadh / Jeddah / Al-Ahsa", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:5,
      note:"✅ مؤكد من الموقع الرسمي للجامعة (ksau-hs.edu.sa): 30% ثانوية + 30% قدرات + 40% تحصيلي. جامعة صحية متخصصة (طب، تمريض، علوم صحية) بالكامل تقريباً باللغة الإنجليزية، وتُضاف مقابلة شخصية للبرامج التي تتطلب ذلك، وقد تُطلب درجة لغة إنجليزية لبعض البرامج.",
      noteEn:"✅ Confirmed on the official university site (ksau-hs.edu.sa): 30% high-school + 30% Qudrat + 40% Tahsili. A specialized health-sciences university taught almost entirely in English; a personal interview is added for programs that require it, and some programs may require an English score." },
    { id:"taibah", name:"جامعة طيبة", nameEn:"Taibah University", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"iumadinah", name:"الجامعة الإسلامية بالمدينة المنورة", nameEn:"Islamic University of Madinah", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"بعض الكليات الشرعية قد تتطلب اختباراً في التلاوة والحفظ أو مقابلة إضافية بدل STEP.", noteEn:"Some Sharia colleges may require a Quran recitation/memorization test or an interview instead of STEP." },
    { id:"jazanu", name:"جامعة جازان", nameEn:"Jazan University", city:"جازان", cityEn:"Jazan", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"najranu", name:"جامعة نجران", nameEn:"Najran University", city:"نجران", cityEn:"Najran", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"tabuku", name:"جامعة تبوك", nameEn:"University of Tabuk", city:"تبوك", cityEn:"Tabuk", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"hailu", name:"جامعة حائل", nameEn:"University of Hail", city:"حائل", cityEn:"Hail", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"bau", name:"جامعة الباحة", nameEn:"Al Baha University", city:"الباحة", cityEn:"Al Baha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"nbu", name:"جامعة الحدود الشمالية", nameEn:"Northern Border University", city:"عرعر", cityEn:"Arar", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"su", name:"جامعة شقراء", nameEn:"Shaqra University", city:"شقراء", cityEn:"Shaqra", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"mu", name:"جامعة المجمعة", nameEn:"Majmaah University", city:"المجمعة", cityEn:"Majmaah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"iau", name:"جامعة الإمام عبدالرحمن بن فيصل", nameEn:"Imam Abdulrahman Bin Faisal University", city:"الدمام", cityEn:"Dammam", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4,
      note:"تضم كليات صحية (كالطب) قد تعتمد أوزاناً مختلفة وتشترط STEP وتضيف مقابلة شخصية.", noteEn:"Includes health colleges (e.g. Medicine) that may use different weights, require STEP, and add an interview." },
    { id:"tu", name:"جامعة الطائف", nameEn:"Taif University", city:"الطائف", cityEn:"Taif", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"الوزن العام. قسم اللغة الإنجليزية يشترط وفق مصادر تعليمية حوالي 40 درجة في STEP.", noteEn:"General weighting. The English department reportedly requires around 40 in STEP per education sources." },
    { id:"ju", name:"جامعة الجوف", nameEn:"Jouf University", city:"سكاكا", cityEn:"Sakaka", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"bu", name:"جامعة بيشة", nameEn:"University of Bisha", city:"بيشة", cityEn:"Bisha", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"الوزن العام. الكليات الصحية قد تضيف شرط لغة.", noteEn:"General weighting. Health colleges may add a language requirement." },
    { id:"psau", name:"جامعة الأمير سطام بن عبدالعزيز", nameEn:"Prince Sattam Bin Abdulaziz University", city:"الخرج", cityEn:"Al-Kharj", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:3,
      note:"الوزن العام. كلية الطب تشترط وفق مصادر تعليمية حوالي 70 درجة في STEP، وطب الأسنان حوالي 65.", noteEn:"General weighting. The College of Medicine reportedly requires around 70 in STEP, and Dentistry around 65, per education sources." },
    { id:"uj", name:"جامعة جدة", nameEn:"University of Jeddah", city:"جدة", cityEn:"Jeddah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:4, note:"الوزن العام. الكليات الصحية والهندسية قد تضيف شرط لغة.", noteEn:"General weighting. Health/engineering colleges may add a language requirement." },
    { id:"pmu_madinah", name:"جامعة الأمير مقرن بن عبدالعزيز", nameEn:"Prince Mugrin University", city:"المدينة المنورة", cityEn:"Madinah", type:"public",
      weights:{high:30, qat:30, tah:40}, step:"partial", comp:2, note:"جامعة حديثة نسبياً — الوزن العام المعتاد.", noteEn:"Relatively new public university — standard general weighting." },
    { id:"alfaisal", name:"جامعة الفيصل", nameEn:"Alfaisal University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:true, comp:4,
      note:"جامعة خاصة بنظام قبول مستقل (SAT/STEP + مقابلة)، الدراسة باللغة الإنجليزية بالكامل غالباً. لا تنطبق صيغة الموزونة الموحدة مباشرة.",
      noteEn:"Private university with an independent admission system (SAT/STEP + interview), mostly English-taught. The unified weighted formula does not directly apply." },
    { id:"effat", name:"جامعة أفق (عفت)", nameEn:"Effat University", city:"جدة", cityEn:"Jeddah", type:"private",
      weights:null, step:true, comp:3,
      note:"جامعة خاصة للطالبات، تتطلب عادة اختبار لغة إنجليزية ومقابلة ضمن نظام قبول مستقل.",
      noteEn:"Private women's university, typically requires an English test and interview under its own admission system." },
    { id:"psu_riyadh", name:"جامعة الأمير سلطان", nameEn:"Prince Sultan University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:true, comp:3,
      note:"جامعة خاصة بنظام قبول مستقل يعتمد اختبار قبول داخلي ومقابلة.", noteEn:"Private university with its own entrance exam and interview." },
    { id:"dau", name:"جامعة دار العلوم", nameEn:"Dar Al Uloom University", city:"الرياض", cityEn:"Riyadh", type:"private",
      weights:null, step:"partial", comp:2,
      note:"جامعة خاصة بنظام قبول مستقل، يُفضل مراجعة الموقع الرسمي للتفاصيل.", noteEn:"Private university with its own admission system — check the official website for details." },
];

