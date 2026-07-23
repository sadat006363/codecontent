// lib/analysis/normalize-snippet-audit.ts

import { AdvancedAuditResult, AdvancedAuditResultSchema } from './schema';
import { legacyRowToAudit } from './to-snippet';
import logger from '@/lib/logger';

/**
 * وضعیت اعتبارسنجی Audit ذخیره‌شده
 */
export type StoredAuditStatus =
  | { type: 'valid'; audit: AdvancedAuditResult }
  | { type: 'legacy'; audit: Partial<AdvancedAuditResult> }
  | { type: 'unavailable' }
  | { type: 'invalid'; error: string };

/**
 * نتیجه نرمالایز شده برای UI
 */
export interface NormalizedSnippetAudit {
  /**
   * وضعیت اعتبارسنجی
   */
  status: StoredAuditStatus;

  /**
   * آیا Full Analysis در دسترس است؟
   */
  hasFullAnalysis: boolean;

  /**
   * تعداد یافته‌ها
   */
  findingsCount: number;

  /**
   * وضعیت رأی نهایی (برای نمایش)
   */
  verdictStatus?: string;

  /**
   * امتیاز کلی (برای نمایش)
   */
  overallScore?: number;

  /**
   * پست لینکدین (اگر موجود باشد)
   */
  linkedinPost?: string;

  /**
   * خلاصه (برای نمایش)
   */
  summary?: string;
}

/**
 * نرمالایز کردن ردیف Snippet از دیتابیس به ساختار یکپارچه برای UI
 */
export function normalizeSnippetAudit(row: any): NormalizedSnippetAudit {
  // 1. بررسی وجود audit_result (فیلد جدید)
  if (row.audit_result) {
    try {
      // اگر audit_result یک string است، آن را parse کن
      let auditData = row.audit_result;
      if (typeof auditData === 'string') {
        auditData = JSON.parse(auditData);
      }

      // اعتبارسنجی با Zod
      const validation = AdvancedAuditResultSchema.safeParse(auditData);
      if (validation.success) {
        logger.debug('[NormalizeSnippetAudit] Valid canonical audit found', {
          slug: row.slug,
          version: validation.data.schemaVersion,
        });
        return {
          status: { type: 'valid', audit: validation.data },
          hasFullAnalysis: true,
          findingsCount: validation.data.findings?.length || 0,
          verdictStatus: validation.data.verdict?.status,
          overallScore: validation.data.scorecard?.productionReadiness?.score,
          linkedinPost: validation.data.linkedin_post,
          summary: validation.data.summary,
        };
      }

      // اگر validation شکست خورد، لاگ کن و به legacy برگرد
      logger.warn('[NormalizeSnippetAudit] Invalid audit_result, falling back to legacy', {
        slug: row.slug,
        errors: validation.error.issues,
      });
    } catch (error) {
      logger.error('[NormalizeSnippetAudit] Failed to parse audit_result', {
        slug: row.slug,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // 2. Fallback به داده‌های Legacy
  // 🔥 اصلاح: اگر legacyRowToAudit null برگرداند، به جای آن یک آبجکت خالی استفاده کن
  const legacyAudit = legacyRowToAudit(row);
  const hasLegacyData = legacyAudit !== null && Object.keys(legacyAudit).length > 0;

  if (hasLegacyData) {
    logger.debug('[NormalizeSnippetAudit] Using legacy audit data', { slug: row.slug });
    return {
      status: { type: 'legacy', audit: legacyAudit as Partial<AdvancedAuditResult> },
      hasFullAnalysis: true,
      findingsCount: legacyAudit.findings?.length || 0,
      verdictStatus: legacyAudit.verdict?.status,
      linkedinPost: legacyAudit.linkedin_post || row.linkedin_post,
      summary: legacyAudit.summary,
    };
  }

  // 3. بدون داده تحلیل
  logger.debug('[NormalizeSnippetAudit] No audit data available', { slug: row.slug });
  return {
    status: { type: 'unavailable' },
    hasFullAnalysis: false,
    findingsCount: 0,
  };
}

/**
 * بررسی سریع اینکه آیا یک ردیف دارای Full Analysis است
 */
export function hasFullAnalysis(row: any): boolean {
  if (row.audit_result) {
    try {
      const auditData = typeof row.audit_result === 'string'
        ? JSON.parse(row.audit_result)
        : row.audit_result;
      const validation = AdvancedAuditResultSchema.safeParse(auditData);
      if (validation.success) {
        return true;
      }
    } catch {
      // ادامه به بررسی Legacy
    }
  }

  // بررسی فیلدهای Legacy
  return !!(
    row.findings ||
    row.execution_overview ||
    row.scorecard_new ||
    row.verdict ||
    row.recommended_actions ||
    row.architectural_observations ||
    row.suggested_tests_new ||
    row.complexity ||
    row.limitations ||
    row.improved_code
  );
}

/**
 * دریافت تعداد یافته‌ها از ردیف Snippet
 */
export function getFindingsCount(row: any): number {
  // 1. از audit_result
  if (row.audit_result) {
    try {
      const auditData = typeof row.audit_result === 'string'
        ? JSON.parse(row.audit_result)
        : row.audit_result;
      if (auditData.findings && Array.isArray(auditData.findings)) {
        return auditData.findings.length;
      }
    } catch {
      // ادامه
    }
  }

  // 2. از فیلد findings
  if (row.findings && Array.isArray(row.findings)) {
    return row.findings.length;
  }

  return 0;
}