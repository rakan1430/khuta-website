const fs=require('fs'), path=require('path');
const ROOT='/home/user/khuta-website';
const js=fs.readdirSync(path.join(ROOT,'js')).filter(f=>f.endsWith('.js')).sort();
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const css=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
// ⚠️ نزع التعليقات قبل الفحص: أول تشغيل بلّغ عن أربع مخالفات "حرجة" كانت
// كلها تعليقات تشرح الأعطال المُصلَحة نفسها. التدقيق الذي يبلّغ عن كلام
// عن الخطأ بدل الخطأ يفقد قيمته سريعاً.
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const all = js.map(f=>({f, src:strip(fs.readFileSync(path.join(ROOT,'js',f),'utf8'))}));
const htmlStripped = html.replace(/<!--[\s\S]*?-->/g,'');
const cssStripped  = css.replace(/\/\*[\s\S]*?\*\//g,'');
const findings=[];
const add=(sev,what,where)=>findings.push({sev,what,where});

// ١) بقايا عهد النسختين
all.forEach(({f,src})=>{
  src.split('\n').forEach((l,i)=>{
    if(/^\s*(?!.*\/\/|.*\*)/.test(l)){}
    const line=l.trim();
    if(line.startsWith('//')||line.startsWith('*')||line.startsWith('/*')) return;
    if(/hasFeature\(\s*["']school["']\s*\)/.test(line)) add('حرج','شرط على ميزة نسخة ميتة hasFeature("school")',`${f}:${i+1}`);
    if(/TENANT\.id/.test(line) && !f.startsWith('00-')) add('متوسط','اعتماد على TENANT.id خارج ملف النسخ',`${f}:${i+1}`);
  });
});
[...htmlStripped.matchAll(/data-tenant-only="([^"]+)"/g)].forEach(m=>
  add('حرج',`data-tenant-only="${m[1]}" — السمة الآن "khuta" فلن يظهر العنصر أبداً`,'index.html'));
[...cssStripped.matchAll(/\[data-tenant="motaqadima"\]/g)].forEach(()=>
  add('حرج','قاعدة CSS معلّقة على نسخة ميتة','styles.css'));

// ٢) معالجات onclick تمرّر نصاً من المستخدم (كسر السمة أو حقن)
all.forEach(({f,src})=>{
  src.split('\n').forEach((l,i)=>{
    if(/on(click|change|input)="[^"]*\$\{JSON\.stringify/.test(l))
      add('حرج','JSON.stringify داخل سمة onclick — علامة الاقتباس تُنهي السمة وتكسر الزر',`${f}:${i+1}`);
  });
});

// ٣) دوال تُستدعى من HTML وغير معرَّفة في أي ملف
const defined=new Set();
all.forEach(({src})=>{
  const re=/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm; let m;
  while((m=re.exec(src))) defined.add(m[1]);
});
const called=new Set();
[...html.matchAll(/on(?:click|change|input|submit)="([^"]+)"/g)].forEach(m=>{
  const re=/([A-Za-z_$][\w$]*)\s*\(/g; let x;
  while((x=re.exec(m[1]))){
    const n=x[1];
    if(!['if','for','while','return','typeof','this','document','getElementById','click','JSON','String','Number'].includes(n)) called.add(n);
  }
});
[...called].forEach(n=>{ if(!defined.has(n) && !(n in global)) add('حرج',`زر يستدعي دالة غير معرَّفة: ${n}()`,'index.html'); });

// ٤) معرّفات في HTML يشير إليها JS ولا وجود لها
// ⚠️ المعرّفات لا تأتي من HTML وحده: كثير منها يُنشئه JS ديناميكياً
// (el.id = "x" أو id="x" داخل قالب نصّي). عدم احتسابها أنتج ٨ إنذارات
// كاذبة في أول تشغيل — والتدقيق الذي يُنذر كذباً يُهمَل بعد مرّتين.
const htmlIds=new Set([...html.matchAll(/id="([^"]+)"/g)].map(m=>m[1]));
all.forEach(({src})=>{
  [...src.matchAll(/\.id\s*=\s*["']([^"']+)["']/g)].forEach(m=>htmlIds.add(m[1]));
  [...src.matchAll(/id="([^"$]+)"/g)].forEach(m=>htmlIds.add(m[1]));
});
all.forEach(({f,src})=>{
  [...src.matchAll(/getElementById\("([^"]+)"\)/g)].forEach(m=>{
    if(!htmlIds.has(m[1]))
      add('متوسط',`getElementById("${m[1]}") — لا وجود لهذا المعرّف في الصفحة`,f);
  });
});

// ٥) ملفات JS غير مُدرجة، وترتيب سطر الصرف
// الوسم العادي، أو khutaEager("js/…") — التحميل عند الحاجة على الجوّال (المرحلة ٠)
const tags=[...html.matchAll(/<script src="js\/([^"]+)"|khutaEager\("js\/([^"]+)"\)/g)].map(m=>m[1]||m[2]);
js.filter(f=>!tags.includes(f)).forEach(f=>add('حرج',`ملف غير مُدرج في الصفحة: ${f}`,'index.html'));
if(tags[tags.length-1]!=='99-boot-flush.js') add('حرج','سطر صرف المصادقة ليس في آخر ملف','index.html');

/* ============================================================
   كل عنصر يقرّر ما يظهر يجب أن يصرّح بوضعه
   ------------------------------------------------------------
   هذا هو الحارس الذي يجعل قلب البنية يصمد. بلا هذا الفحص، أي ميزة جديدة
   تُضاف لخُطى بلا data-modes ستتسرّب للمعلّم صامتةً — ولن يكتشفها أحد
   إلا المالك بعد أسبوع في الاستعمال الحقيقي، وهو أغلى مكان ممكن.
   الآن: من ينسى التصريح يسقط هنا في ثانية.
   ============================================================ */
(function checkModeDeclarations(){
    // (١) أقسام العرض
    const views = [...html.matchAll(/<section\b([^>]*)id="(view-[a-z]+)"/g)];
    views.forEach(m => {
        if(!/data-modes=/.test(m[1])){
            add("حرج", `قسم بلا تصريح وضع: ${m[2]}`, "index.html — أضِف data-modes إليه");
        }
    });

    // (٢) عناصر التنقّل التي تفتح قسماً
    const navs = [...html.matchAll(/<div\b([^>]*class="(?:nav-item|mobile-nav-item)[^"]*"[^>]*)>/g)];
    navs.forEach(m => {
        const tag = m[1];
        if(!/data-tab="/.test(tag) && !/nav-item-board/.test(tag) && !/badge-soon/.test(html.slice(m.index, m.index + 220))) return;
        if(!/data-modes=/.test(tag)){
            const tab = (tag.match(/data-tab="([a-z]+)"/) || [,"(بلا data-tab)"])[1];
            add("حرج", `عنصر تنقّل بلا تصريح وضع: ${tab}`, "index.html");
        }
    });

    // (٣) بطاقات اللوحة
    const cards = [...html.matchAll(/<div\b([^>]*id="((?:dash-card|prof-card)-[a-z-]+)")/g)];
    cards.forEach(m => {
        if(!/data-modes=/.test(m[1])){
            add("حرج", `بطاقة لوحة بلا تصريح وضع: ${m[2]}`, "index.html");
        }
    });

    // (٤) قيم غير معروفة
    [...html.matchAll(/data-modes="([^"]*)"/g)].forEach(m => {
        m[1].split(/\s+/).filter(Boolean).forEach(v => {
            if(v !== "khuta" && v !== "school"){
                add("حرج", `قيمة وضع غير معروفة: "${v}"`, "index.html — المسموح: khuta و school");
            }
        });
    });
})();

// ٨) رقم الإصدار — قاعدة المالك: «كل تحديث جديد يجب تغيير رقم الإصدار»
//    (بقي 1.4.0 ستة أسابيع رغم عشرات التحديثات). يفشل إن تغيّر ما يصل
//    المستخدم ولم يرتفع APP_VERSION، أو لم يتغيّر CACHE_NAME في sw.js.
(function versionRule(){
  const { execSync } = require('child_process');
  const git = cmd => { try{ return execSync(`git -C "${ROOT}" ${cmd}`, { stdio:['ignore','pipe','ignore'] }).toString(); }catch(e){ return null; } };
  const SITE = ['index.html','styles.css','sw.js','parent.html','js','netlify/functions'];
  const verOf = src => { const m = src && src.match(/const APP_VERSION = "(\d+)\.(\d+)\.(\d+)"/); return m ? m.slice(1).map(Number) : null; };
  const cacheOf = src => { const m = src && src.match(/CACHE_NAME = "([^"]+)"/); return m ? m[1] : null; };
  const gt = (a, b) => { for(let i = 0; i < 3; i++){ if(a[i] !== b[i]) return a[i] > b[i]; } return false; };
  const fmt = v => v ? v.join('.') : '؟';
  const now = verOf(fs.readFileSync(path.join(ROOT,'js/05-boot-nav.js'),'utf8'));
  const nowCache = cacheOf(fs.readFileSync(path.join(ROOT,'sw.js'),'utf8'));
  if(!now){ add('حرج','APP_VERSION غير موجود بالصيغة "س.ص.ع"','js/05-boot-nav.js'); return; }
  const checks = [
    // [وصف، مرجع قديم، هل تغيّر الموقع منذه؟، مرجع الإصدار الجديد]
    ['تعديلات لم تُحفظ بعد', 'HEAD', git(`status --porcelain -- ${SITE.join(' ')}`), null],
    ['آخر حفظ (commit)', 'HEAD~1', git(`diff --name-only HEAD~1 HEAD -- ${SITE.join(' ')}`), 'HEAD'],
    ['الموقع الأساسي (origin/main)', 'origin/main', git(`diff --name-only origin/main -- ${SITE.join(' ')}`), null],
  ];
  for(const [label, ref, changed, newRef] of checks){
    if(changed === null || !changed.trim()) continue;
    const oldSrc = git(`show ${ref}:js/05-boot-nav.js`);
    if(oldSrc === null) continue;
    const oldV = verOf(oldSrc);
    const newV = newRef ? verOf(git(`show ${newRef}:js/05-boot-nav.js`)) : now;
    if(oldV && newV && !gt(newV, oldV))
      add('حرج', `الموقع تغيّر (${label}) ورقم الإصدار لم يرتفع: ${fmt(oldV)} → ${fmt(newV)}`, 'js/05-boot-nav.js — APP_VERSION');
    const oldCache = cacheOf(git(`show ${ref}:sw.js`));
    const newCache = newRef ? cacheOf(git(`show ${newRef}:sw.js`)) : nowCache;
    if(oldCache && newCache && oldCache === newCache)
      add('حرج', `الموقع تغيّر (${label}) وCACHE_NAME لم يتغيّر (${newCache}) — العائدون سيبقون على النسخة المخزّنة`, 'sw.js');
  }
})();

const order={'حرج':0,'متوسط':1};
findings.sort((a,b)=>order[a.sev]-order[b.sev]);
const bySev={};
findings.forEach(f=>{ bySev[f.sev]=(bySev[f.sev]||0)+1; });

console.log('=== نتيجة التدقيق ===');
console.log(Object.entries(bySev).map(([k,v])=>`${k}: ${v}`).join(' | ') || 'لا ملاحظات');
console.log();
findings.forEach(f=>console.log(`[${f.sev}] ${f.what}\n         ← ${f.where}`));
