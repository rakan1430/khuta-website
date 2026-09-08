/* ============================================================
   رسائل الخطأ: تقول السبب، لا "تعذّر" وحدها
   ------------------------------------------------------------
   وصف المالك المشكلة بدقة: "حاولت رفع اختبار واعتقدت أن الموقع معطّل، وفي
   الأخير اكتشفت أن السبب انتهاء مهلة الجلسة أو أنني سجّلت بالباركود".

   وهذا أسوأ أنواع الأعطال: النظام يعمل تماماً ويرفض لسبب وجيه، لكنه لا
   يقوله. فيظن المستخدم أن البرنامج معطوب، ويعيد المحاولة، ويستنتج أن
   المنصة رديئة — والسبب سطر رسالة ناقص.

   ⚠️ والقاعدة هنا: لكل رفض سببٌ وإجراءٌ. لا يكفي "تعذّر الحفظ"؛ يجب أن
   يعرف المستخدم **لماذا** و**ماذا يفعل الآن**.
   ============================================================ */

/**
 * يحوّل خطأ Supabase إلى رسالة عربية تشرح السبب وتقترح الحل.
 * @param {*} e الخطأ كما جاء من المكتبة
 * @param {string} action وصف قصير لما كان يحاوله (مثل "رفع الملف")
 */
function schoolError(e, action){
    const ar = currentLang === "ar";
    const raw = [
        e && e.message, e && e.hint, e && e.details, e && e.code, e && e.error_description,
    ].filter(Boolean).join(" | ");
    const status = (e && (e.status || e.statusCode)) || 0;
    const act = action || (ar ? "العملية" : "the action");

    // ١) الجلسة انتهت أو لم تُستعد — أشيع سبب وأكثره إرباكاً
    if(status === 401 || /jwt expired|invalid jwt|not authenticated|refresh_token|session_not_found/i.test(raw)){
        return ar ? `انتهت مهلة جلستك. حدّث الصفحة وسجّل دخولك ثم أعد ${act}.`
                  : `Your session expired. Refresh, sign in again, then retry.`;
    }

    // ٢) جلسة محدودة: دخول سريع أو باركود — الأفعال المهمة تحتاج Google
    if(/google_verified|NEEDS_GOOGLE/i.test(raw)){
        return ar ? `${act} تتطلّب تأكيد هويتك بحساب Google. اضغط "تأكيد بحساب Google" في الشريط الأعلى.`
                  : `${act} requires confirming with Google. Use the button in the top bar.`;
    }

    // ٣) رفض من سياسات الصلاحيات — نميّز الجلسة المحدودة عن انعدام الحق
    if(status === 403 || /row-level security|42501|new row violates/i.test(raw)){
        return ar
            ? `لا تملك صلاحية ${act}. إن كنت داخلاً بالدخول السريع أو بالباركود فأكّد هويتك بحساب Google أولاً — الأفعال المهمة تحتاجه.`
            : `You are not allowed to do that. If you signed in quickly or by QR, confirm with Google first.`;
    }

    // ٤) قيود واضحة يفهمها المستخدم
    if(/LINKS_LIMIT_REACHED/i.test(raw))   return ar ? "بلغتَ الحد: ٩ روابط مباشرة. احذف رابطاً لتضيف غيره." : "Limit reached: 9 links.";
    if(/duplicate key|23505/i.test(raw))   return ar ? "هذا العنصر مضاف مسبقاً." : "Already added.";
    if(/23514|violates check/i.test(raw))  return ar ? "بيانات غير مقبولة — راجع الحقول المطلوبة." : "Invalid data — check the fields.";
    if(/23503|foreign key/i.test(raw))     return ar ? "عنصر مرتبط غير موجود — حدّث الصفحة وأعد المحاولة." : "A linked item is missing — refresh.";
    if(/payload too large|413|exceeded the maximum/i.test(raw))
        return ar ? "الملف أكبر من الحد المسموح." : "File too large.";
    if(/mime type|invalid_mime/i.test(raw))
        return ar ? "نوع الملف غير مسموح." : "File type not allowed.";
    if(/Bucket not found/i.test(raw))
        return ar ? "مساحة التخزين غير مهيّأة — أبلغ مطوّر الموقع." : "Storage bucket missing.";

    // ٥) الشبكة
    if(/failed to fetch|networkerror|load failed|timeout/i.test(raw) || status === 0){
        return ar ? "تعذّر الاتصال بالإنترنت. تحقّق من الشبكة ثم أعد المحاولة." : "Network problem. Check your connection.";
    }
    if(status >= 500){
        return ar ? "الخادم لا يستجيب حالياً. أعد المحاولة بعد قليل." : "Server is not responding. Try again shortly.";
    }

    // ٦) غير معروف: نقول ذلك صراحةً بدل ادّعاء معرفة السبب،
    //    ونذكر أن التفصيل في سجل المتصفح لمن يستطيع فتحه.
    return ar ? `تعذّر ${act}. التفاصيل في سجل المتصفح (F12).`
              : `Could not complete ${act}. Details in the browser console.`;
}

/** يعرض رسالة الخطأ المفهومة ويكتب الأصل في السجل للتشخيص. */
function showSchoolError(e, action){
    console.error(`[خُطى] فشل: ${action || ""}`, e);
    showToast(schoolError(e, action));
}
