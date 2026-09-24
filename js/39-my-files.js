/* ============================================================
   39) «ملفاتي» — مساحة خاصة لطالب خُطى (المرحلة ٤)
   ------------------------------------------------------------
   قرارات المالك:
   • ٣٠ ميجا للطالب، لا تُتجاوز.  • لحسابات Google فقط.
   • PDF وصور فقط، و**لا روابط مشاركة إطلاقاً** — لا يراه إلا صاحبه.
   • خانة «ملفات من خُطى» يرفعها المالك بعد فحصها (بلا شعارات لأحد).

   ⚠️ كل هذه القيود في المخزن نفسه (sql/PHASE4_MY_FILES.sql): السياسة ترفض
   ما يتجاوز ٣٠ ميجا بالبايت، وترفض غير Google، ولا تُقرئ ملفاً لغير صاحبه.
   فحوص هذه الصفحة للإيضاح المبكر فقط — كي لا ينتظر الطالب رفعاً سيُرفض.

   ⚠️ «لا روابط مشاركة»: الملف يُفتح برابط موقَّع عمره ٦٠ ثانية يُنشأ لحظة
   الضغط، ولا يوجد في الواجهة زرّ نسخ رابط ولا مشاركة.
   ============================================================ */

const MYF_LIMIT = 30 * 1048576;
const MYF_FILE_MAX = 10 * 1048576;
const MYF_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif"];

function myfL(ar, en){ return currentLang === "ar" ? ar : en; }
function myfSize(b){
    const n = Number(b) || 0;
    if(n >= 1048576) return (n / 1048576).toFixed(1).replace(/\.0$/, "") + " " + myfL("ميجا", "MB");
    return Math.max(1, Math.round(n / 1024)) + " " + myfL("ك.ب", "KB");
}

let myfStatus = null, myfList = [], khutaFilesList = [];

function myfIsOwnerAdmin(){ return typeof isAdmin !== "undefined" && !!isAdmin; }

async function renderMyFilesTab(){
    const box = document.getElementById("myfiles-body");
    if(!box) return;
    if(!sb){ box.innerHTML = `<p class="card-sub">${myfL("الخدمة غير متاحة حالياً.", "Service unavailable.")}</p>`; return; }
    box.innerHTML = `<p class="card-sub">${myfL("جارٍ التحميل…", "Loading…")}</p>`;

    let session = null;
    try{ const { data } = await sb.auth.getSession(); session = data && data.session; }catch(e){}
    const user = session && session.user;
    if(!user || user.is_anonymous){
        box.innerHTML = myfGoogleGate(myfL("سجّل دخولك بحساب Google لتفتح ملفاتك.", "Sign in with Google to open your files."));
        return;
    }
    try{
        const [st, list, khuta] = await Promise.all([
            sb.rpc("my_files_status"),
            sb.rpc("my_files_list"),
            sb.from("khuta_files").select("id, path, title, description, created_at").order("created_at", { ascending:false }).limit(200),
        ]);
        if(st.error) throw st.error;
        myfStatus = st.data || {};
        if(!myfStatus.google && !myfIsOwnerAdmin()){
            box.innerHTML = myfGoogleGate(myfL(
                "«ملفاتي» لحسابات Google فقط — حسابك الحالي باسم مستخدم وكلمة مرور. سجّل الدخول بحساب Google لتستعملها.",
                "My files is for Google accounts only. Sign in with Google to use it."));
            return;
        }
        myfList = (list && list.data) || [];
        khutaFilesList = (khuta && khuta.data) || [];
        box.innerHTML = renderMyFilesBody();
    }catch(e){
        console.error("[خُطى] تعذّر تحميل ملفاتي:", e);
        box.innerHTML = `<p class="card-sub">${escapeHtml((typeof schoolError === "function")
            ? schoolError(e, myfL("تحميل ملفاتك", "loading your files")) : myfL("تعذّر التحميل.", "Could not load."))}</p>`;
    }
}

function myfGoogleGate(msg){
    return `<div class="uni-note"><p style="margin:0 0 10px;">${escapeHtml(msg)}</p>
        <button type="button" class="btn acc-btn" onclick="signInWithGoogle()"><i class="fa-brands fa-google"></i> ${myfL("الدخول بحساب Google", "Sign in with Google")}</button></div>`;
}

function renderMyFilesBody(){
    const used = Number(myfStatus.used) || 0, limit = Number(myfStatus.limit) || MYF_LIMIT;
    const pct = Math.min(100, Math.round(used * 100 / limit));
    const full = used >= limit;
    return `
    <div class="myf-quota">
        <div class="myf-quota-bar"><span style="width:${pct}%" class="${pct >= 90 ? "is-high" : ""}"></span></div>
        <div class="card-sub">${myfL(`استعملت ${myfSize(used)} من ${myfSize(limit)}`, `${myfSize(used)} of ${myfSize(limit)} used`)}</div>
    </div>

    <div class="myf-upload">
        <div class="input-row">
            <div class="form-group"><label>${myfL("الملف (PDF أو صورة، حتى ١٠ ميجا)", "File (PDF or image, up to 10 MB)")}</label>
                <input type="file" id="myf-file" accept="${MYF_TYPES.join(",")}" ${full ? "disabled" : ""}></div>
            <div class="form-group"><label>${myfL("الاسم (اختياري)", "Name (optional)")}</label>
                <input type="text" id="myf-title" maxlength="120" placeholder="${myfL("ملخص الفيزياء", "Physics notes")}"></div>
        </div>
        <button type="button" id="myf-upload-btn" class="btn acc-btn" onclick="uploadMyFile()" ${full ? "disabled" : ""}>
            <i class="fa-solid fa-upload"></i> ${myfL("ارفع", "Upload")}</button>
        ${full ? `<p class="hint" style="color:var(--rose);">${myfL("امتلأت مساحتك — احذف ملفاً لترفع غيره.", "Your space is full — delete a file first.")}</p>` : ""}
        <p class="hint">${myfL("ملفاتك لك وحدك: لا يراها أحد، ولا روابط مشاركة لها.", "Your files are private: no one else sees them, and there are no share links.")}</p>
    </div>

    <h3 style="margin:16px 0 8px;">${myfL("ملفاتي", "My files")} <span class="pill">${myfList.length}</span></h3>
    ${myfList.length ? myfList.map((f, i) => `
        <div class="sfile-row">
            <div class="sfile-main"><i class="fa-solid ${/pdf/.test(f.mime || "") ? "fa-file-pdf" : "fa-file-image"}"></i>
                <div><b>${escapeHtml(f.title || "")}</b><div class="card-sub">${myfSize(f.size)} · ${escapeHtml(myfDate(f.created_at))}</div></div></div>
            <div class="sfile-actions">
                <button type="button" class="btn btn-sm" onclick="openMyFile(${i})"><i class="fa-solid fa-up-right-from-square"></i> ${myfL("فتح", "Open")}</button>
                <button type="button" class="btn btn-ghost btn-sm" onclick="renameMyFile(${i})" title="${myfL("إعادة تسمية", "Rename")}"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose);" onclick="deleteMyFile(${i})" title="${myfL("حذف", "Delete")}"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`).join("") : `<p class="card-sub">${myfL("لا ملفات بعد.", "No files yet.")}</p>`}

    <h3 style="margin:22px 0 8px;"><i class="fa-solid fa-star" style="color:var(--gold-text);"></i> ${myfL("ملفات من خُطى", "From Khuta")}</h3>
    ${myfIsOwnerAdmin() ? `
    <details class="exq-import">
        <summary>${myfL("أضف ملفاً لكل طلاب خُطى (المالك)", "Add a file for all students (owner)")}</summary>
        <p class="hint" style="margin:10px 0;">${myfL("افحص الملف قبل رفعه: بلا شعارات لأحد، ومحتوى يحق لخُطى نشره.", "Check it first: no third-party logos; content Khuta may publish.")}</p>
        <div class="input-row">
            <div class="form-group"><label>${myfL("العنوان", "Title")}</label><input type="text" id="kf-title" maxlength="160"></div>
            <div class="form-group"><label>${myfL("الملف", "File")}</label><input type="file" id="kf-file" accept="${MYF_TYPES.join(",")}"></div>
        </div>
        <div class="form-group"><label>${myfL("وصف قصير (اختياري)", "Short description (optional)")}</label><input type="text" id="kf-desc" maxlength="400"></div>
        <button type="button" id="kf-upload-btn" class="btn acc-btn" onclick="uploadKhutaFile()"><i class="fa-solid fa-upload"></i> ${myfL("انشر", "Publish")}</button>
    </details>` : ""}
    ${khutaFilesList.length ? khutaFilesList.map((f, i) => `
        <div class="sfile-row">
            <div class="sfile-main"><i class="fa-solid fa-file-circle-check"></i>
                <div><b>${escapeHtml(f.title)}</b>${f.description ? `<div class="card-sub">${escapeHtml(f.description)}</div>` : ""}</div></div>
            <div class="sfile-actions">
                <button type="button" class="btn btn-sm" onclick="openKhutaFile(${i})"><i class="fa-solid fa-up-right-from-square"></i> ${myfL("فتح", "Open")}</button>
                ${myfIsOwnerAdmin() ? `<button type="button" class="btn btn-ghost btn-sm" style="color:var(--rose);" onclick="deleteKhutaFile(${i})"><i class="fa-solid fa-trash"></i></button>` : ""}
            </div>
        </div>`).join("") : `<p class="card-sub">${myfL("لا ملفات بعد — ستُضاف قريباً.", "Nothing yet.")}</p>`}`;
}

function myfDate(iso){
    try{ return new Date(iso).toLocaleDateString(currentLang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
        { day:"numeric", month:"short", year:"numeric" }); }catch(e){ return ""; }
}

function myfExt(file){
    const byType = { "application/pdf":"pdf", "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/gif":"gif" };
    return byType[file.type] || "bin";
}

async function uploadMyFile(){
    const fileEl = document.getElementById("myf-file");
    const file = fileEl && fileEl.files && fileEl.files[0];
    if(!file){ showToast(myfL("اختر ملفاً", "Pick a file")); return; }
    if(!MYF_TYPES.includes(file.type)){ showToast(myfL("PDF أو صورة فقط", "PDF or image only")); return; }
    if(file.size > MYF_FILE_MAX){ showToast(myfL("الملف أكبر من ١٠ ميجا", "File exceeds 10 MB")); return; }
    const used = Number(myfStatus && myfStatus.used) || 0;
    if(used + file.size > MYF_LIMIT){
        showToast(myfL(`لا تتّسع مساحتك: بقي ${myfSize(MYF_LIMIT - used)} والملف ${myfSize(file.size)}.`, "Not enough space left."));
        return;
    }
    const btn = document.getElementById("myf-upload-btn");
    schoolBusy(btn, true);
    try{
        const { data: u } = await sb.auth.getUser();
        const uid = u && u.user && u.user.id;
        if(!uid) throw new Error("NO_SESSION");
        const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        const path = `${uid}/${rand}.${myfExt(file)}`;
        const { error: upErr } = await sb.storage.from("my-files").upload(path, file, { upsert:false, contentType: file.type });
        if(upErr) throw upErr;
        const title = ((document.getElementById("myf-title") || {}).value || "").trim() || file.name.replace(/\.[^.]+$/, "").slice(0, 120) || myfL("ملف", "File");
        const { error } = await sb.from("my_files").insert({ path, title });
        if(error) console.warn("[خُطى] رُفع الملف وتعذّر حفظ اسمه:", error);   // يبقى الملف ويُعرض باسم مخزنه
        showToast(myfL("رُفع ✅", "Uploaded ✅"));
        await renderMyFilesTab();
    }catch(e){
        console.error("[خُطى] تعذّر رفع ملفي:", e);
        const raw = (e && (e.message || e.error)) || "";
        showToast(/row-level|policy|403|Unauthorized/i.test(raw)
            ? myfL("رُفض الرفع: المساحة لا تتّسع أو الحساب ليس حساب Google.", "Upload refused: no space left or not a Google account.")
            : /size|too large|413/i.test(raw) ? myfL("الملف أكبر من المسموح.", "File too large.")
            : (typeof schoolError === "function" ? schoolError(e, myfL("الرفع", "the upload")) : myfL("تعذّر الرفع.", "Upload failed.")));
    }finally{ schoolBusy(btn, false); }
}

/* نفتح النافذة قبل انتظار الرابط: سفاري يحجب النوافذ التي تُفتح بعد انتظار */
async function openSignedFile(bucket, path){
    const w = window.open("", "_blank");
    try{
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60);
        if(error) throw error;
        const url = data && (data.signedUrl || data.signedURL);
        if(!url) throw new Error("NO_URL");
        if(w){ w.opener = null; w.location.href = url; } else window.location.href = url;
    }catch(e){
        if(w) w.close();
        console.error("[خُطى] تعذّر فتح الملف:", e);
        showToast(myfL("تعذّر فتح الملف.", "Could not open the file."));
    }
}

function openMyFile(i){ const f = myfList[i]; if(f) openSignedFile("my-files", f.path); }
function openKhutaFile(i){ const f = khutaFilesList[i]; if(f) openSignedFile("khuta-files", f.path); }

async function renameMyFile(i){
    const f = myfList[i];
    if(!f) return;
    const title = (prompt(myfL("الاسم الجديد:", "New name:"), f.title || "") || "").trim().slice(0, 120);
    if(!title || title === f.title) return;
    try{
        const { error } = await sb.from("my_files").upsert({ path: f.path, title });
        if(error) throw error;
        await renderMyFilesTab();
    }catch(e){ console.error("[خُطى] تعذّرت إعادة التسمية:", e); showToast(myfL("تعذّرت إعادة التسمية.", "Rename failed.")); }
}

async function deleteMyFile(i){
    const f = myfList[i];
    if(!f || !confirm(myfL(`حذف «${f.title}» نهائياً؟`, "Delete this file permanently?"))) return;
    try{
        const { error } = await sb.storage.from("my-files").remove([f.path]);
        if(error) throw error;
        await sb.from("my_files").delete().eq("path", f.path);
        await renderMyFilesTab();
    }catch(e){ console.error("[خُطى] تعذّر الحذف:", e); showToast(myfL("تعذّر الحذف.", "Delete failed.")); }
}

async function uploadKhutaFile(){
    if(!myfIsOwnerAdmin()) return;
    const title = ((document.getElementById("kf-title") || {}).value || "").trim();
    const desc = ((document.getElementById("kf-desc") || {}).value || "").trim();
    const fileEl = document.getElementById("kf-file");
    const file = fileEl && fileEl.files && fileEl.files[0];
    if(title.length < 2){ showToast(myfL("اكتب عنواناً", "Enter a title")); return; }
    if(!file || !MYF_TYPES.includes(file.type)){ showToast(myfL("اختر PDF أو صورة", "Pick a PDF or image")); return; }
    if(file.size > 20 * 1048576){ showToast(myfL("الملف أكبر من ٢٠ ميجا", "File exceeds 20 MB")); return; }
    const btn = document.getElementById("kf-upload-btn");
    schoolBusy(btn, true);
    let path = null;
    try{
        const rand = (crypto && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now());
        path = `k/${rand}.${myfExt(file)}`;
        const { error: upErr } = await sb.storage.from("khuta-files").upload(path, file, { upsert:false, contentType: file.type });
        if(upErr) throw upErr;
        const { error } = await sb.from("khuta_files").insert({ path, title, description: desc || null });
        if(error) throw error;
        path = null;
        showToast(myfL("نُشر ✅", "Published ✅"));
        await renderMyFilesTab();
    }catch(e){
        console.error("[خُطى] تعذّر نشر ملف خُطى:", e);
        if(path){ try{ await sb.storage.from("khuta-files").remove([path]); }catch(err){} }
        showToast((typeof schoolError === "function") ? schoolError(e, myfL("النشر", "publishing")) : myfL("تعذّر النشر.", "Failed."));
    }finally{ schoolBusy(btn, false); }
}

async function deleteKhutaFile(i){
    const f = khutaFilesList[i];
    if(!f || !myfIsOwnerAdmin() || !confirm(myfL(`حذف «${f.title}» من ملفات خُطى؟`, "Delete this file?"))) return;
    try{
        /* المخزن أولاً: سياسة قراءته تشترط وجود السجلّ، والحذف يمرّ بالقراءة —
           فلو حُذف السجلّ أولاً لبقي الملف يتيماً لا يُرى ولا يُحذف */
        const { error: rmErr } = await sb.storage.from("khuta-files").remove([f.path]);
        if(rmErr) throw rmErr;
        const { error } = await sb.from("khuta_files").delete().eq("id", f.id);
        if(error) throw error;
        await renderMyFilesTab();
    }catch(e){ console.error("[خُطى] تعذّر الحذف:", e); showToast(myfL("تعذّر الحذف.", "Delete failed.")); }
}
