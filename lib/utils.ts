// ============================================================
// 📁 فایل: lib/utils.ts
// ============================================================

/**
 * تبدیل هر مقدار به رشته برای نمایش JSON
 */
export function renderJsonValue(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * تبدیل ایمن هر مقدار به رشته (جلوگیری از خطای نمایش)
 */
export function safeString(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * حذف کامنت‌ها از کد بر اساس زبان
 */
export function removeComments(code: string, language: string): string {
  // پیاده‌سازی ساده برای زبان‌های مختلف
  if (['javascript', 'typescript', 'java', 'c', 'cpp', 'csharp', 'go', 'rust'].includes(language)) {
    // حذف کامنت‌های خطی //
    let result = code.replace(/\/\/.*$/gm, '');
    // حذف کامنت‌های چندخطی /* ... */
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    return result;
  }
  if (['python', 'ruby', 'perl'].includes(language)) {
    return code.replace(/#.*$/gm, '');
  }
  if (['html', 'xml'].includes(language)) {
    return code.replace(/<!--[\s\S]*?-->/g, '');
  }
  if (['css', 'scss', 'less'].includes(language)) {
    return code.replace(/\/\*[\s\S]*?\*\//g, '');
  }
  return code;
}

/**
 * تشخیص اینکه ورودی شبیه کد است یا خیر
 */
export function isCodeLike(text: string): boolean {
  if (!text || text.trim().length === 0) return false;
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  if (lines.length === 0) return false;
  
  // الگوهای رایج کد
  const codePatterns = [
    /\bfunction\b/,
    /\bclass\b/,
    /\bimport\b/,
    /\bexport\b/,
    /\bconst\b/,
    /\blet\b/,
    /\bvar\b/,
    /\bif\s*\(/,
    /\bfor\s*\(/,
    /\bwhile\s*\(/,
    /\breturn\b/,
    /\bdef\b/,
    /\bpublic\b/,
    /\bprivate\b/,
    /\bprotected\b/,
    /\binterface\b/,
    /\btype\b/,
    /\benum\b/,
    /\bpackage\b/,
    /\bnamespace\b/,
    /\btry\s*{/,
    /\bcatch\s*\(/,
    /\bfinally\b/,
    /\basync\b/,
    /\bawait\b/,
    /\byield\b/,
    /\bnew\b/,
    /\bthis\b/,
    /\bsuper\b/,
    /\bextends\b/,
    /\bimplements\b/,
    /\bthrow\b/,
    /\bswitch\s*\(/,
    /\bcase\b/,
    /\bdefault\b/,
    /\bbreak\b/,
    /\bcontinue\b/,
    /\bdo\s*{/,
    /\bwhile\s*\(/,
  ];

  const sample = text.slice(0, 500);
  let matches = 0;
  for (const pattern of codePatterns) {
    if (pattern.test(sample)) matches++;
    if (matches >= 2) return true;
  }
  
  return false;
}