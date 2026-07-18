// lib/constants.ts

// ============================================================
// 📋 محدودیت‌های سراسری پروژه Zbloue
// ============================================================

/**
 * حداکثر خطوط مجاز برای تحلیل کد (Generate)
 * - Simple, Medium, Advanced modes
 */
export const MAX_LINES_GENERATE = 500;

/**
 * حداکثر خطوط مجاز برای توضیح خط به خط (Line-by-Line)
 * ← اگر کد شما بیش از ۳۰۰ خط غیرخالی دارد، این مقدار را افزایش دهید
 */
export const MAX_LINES_EXPLAIN = 1000; // ← می‌توانید به ۵۰۰ یا ۱۰۰۰ افزایش دهید

/**
 * حداکثر خطوط مجاز برای تولید پرامپت (Prompt)
 */
export const MAX_LINES_PROMPT = 300;

/**
 * حداکثر کاراکتر مجاز برای کد ورودی
 */
export const MAX_CODE_LENGTH = 50000;

/**
 * حداکثر حجم مجاز برای Payload (بر حسب بایت)
 */
export const MAX_PAYLOAD_SIZE = 100000;

/**
 * حداکثر تعداد درخواست در ۲۴ ساعت (Rate Limiting)
 */
export const MAX_REQUESTS_PER_IP = 20;

/**
 * زمان پنجره Rate Limiting (بر حسب میلی‌ثانیه)
 */
export const TIME_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

/**
 * زبان‌های پشتیبانی‌شده
 */
export const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java',
  'rust', 'go', 'html', 'css', 'json', 'bash',
  'c', 'cpp', 'csharp', 'php', 'ruby',
  'swift', 'kotlin', 'dart', 'r', 'sql',
  'yaml', 'toml', 'xml', 'markdown',
  'shell', 'powershell', 'dockerfile',
  'graphql', 'vue', 'svelte',
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];