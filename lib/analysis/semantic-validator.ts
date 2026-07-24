// lib/analysis/semantic-validator.ts

import { AdvancedAuditResult, AuditFinding, ScoreItem } from './schema';
import { FindingIdSchema } from './schema';
import logger from '@/lib/logger';

/**
 * نتیجه اعتبارسنجی معنایی
 */
export interface SemanticValidationResult {
  isValid: boolean;
  errors: SemanticValidationIssue[];
  warnings: SemanticValidationIssue[];
}

export interface SemanticValidationIssue {
  code: string;
  path: string;
  message: string;
  relatedIds?: string[];
}

/**
 * اعتبارسنجی یکتایی Finding IDs
 */
function validateFindingIds(findings: AuditFinding[]): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    if (!finding.id) {
      issues.push({
        code: 'MISSING_FINDING_ID',
        path: 'findings',
        message: 'Finding is missing an id field',
      });
      continue;
    }

    const idCheck = FindingIdSchema.safeParse(finding.id);
    if (!idCheck.success) {
      issues.push({
        code: 'INVALID_FINDING_ID_FORMAT',
        path: `findings[${findings.indexOf(finding)}].id`,
        message: `Finding ID "${finding.id}" does not match required format F-\\d{3,}`,
      });
      continue;
    }

    if (seen.has(finding.id)) {
      issues.push({
        code: 'DUPLICATE_FINDING_ID',
        path: `findings[${findings.indexOf(finding)}].id`,
        message: `Duplicate finding ID: ${finding.id}`,
        relatedIds: [finding.id],
      });
    } else {
      seen.add(finding.id);
    }
  }

  return issues;
}

/**
 * جمع‌آوری تمام IDs موجود در findings
 */
function getFindingIds(findings: AuditFinding[]): Set<string> {
  return new Set(findings.map((f) => f.id).filter((id): id is string => Boolean(id)));
}

/**
 * بررسی ارجاعات (relatedFindingIds و relatedFindings) به IDs معتبر
 */
function validateReferences(
  findings: AuditFinding[],
  result: AdvancedAuditResult
): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];
  const validFindingIds = getFindingIds(findings);

  function checkReferences(
    refs: string[] | undefined,
    contextPath: string,
    source: string
  ): void {
    if (!refs || refs.length === 0) return;

    for (const ref of refs) {
      if (!validFindingIds.has(ref)) {
        issues.push({
          code: 'INVALID_REFERENCE',
          path: contextPath,
          message: `"${source}" references non-existent finding ID: ${ref}`,
          relatedIds: [ref],
        });
      }
    }
  }

  for (const obs of result.architecturalObservations || []) {
    const path = `architecturalObservations[${result.architecturalObservations.indexOf(obs)}].relatedFindingIds`;
    checkReferences(obs.relatedFindingIds, path, 'architecturalObservation');
  }

  for (const action of result.recommendedActions || []) {
    const path = `recommendedActions[${result.recommendedActions.indexOf(action)}].relatedFindingIds`;
    checkReferences(action.relatedFindingIds, path, 'recommendedAction');
  }

  const scorecard = result.scorecard;
  if (scorecard) {
    const categories: [string, ScoreItem][] = [
      ['correctness', scorecard.correctness],
      ['concurrencySafety', scorecard.concurrencySafety],
      ['liveness', scorecard.liveness],
      ['errorHandling', scorecard.errorHandling],
      ['resourceManagement', scorecard.resourceManagement],
      ['maintainability', scorecard.maintainability],
      ['productionReadiness', scorecard.productionReadiness],
    ];

    for (const [category, item] of categories) {
      if (item && item.relatedFindings) {
        const path = `scorecard.${category}.relatedFindings`;
        checkReferences(item.relatedFindings, path, `scorecard.${category}`);
      }
    }
  }

  for (const test of result.suggestedTests || []) {
    if ('relatedFindingIds' in test && Array.isArray((test as any).relatedFindingIds)) {
      const path = `suggestedTests[${result.suggestedTests.indexOf(test)}].relatedFindingIds`;
      checkReferences((test as any).relatedFindingIds, path, 'suggestedTest');
    }
  }

  return issues;
}

/**
 * اعتبارسنجی improvedCode
 */
function validateImprovedCode(result: AdvancedAuditResult): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];

  if (!result.improvedCode) {
    issues.push({
      code: 'MISSING_IMPROVED_CODE',
      path: 'improvedCode',
      message: 'improvedCode is required but missing',
    });
    return issues;
  }

  const { available, code, notes } = result.improvedCode;

  // وقتی available === true باشد، code باید یک رشته غیرخالی باشد
  if (available) {
    if (typeof code !== 'string' || code.trim().length === 0) {
      issues.push({
        code: 'IMPROVED_CODE_AVAILABLE_BUT_EMPTY',
        path: 'improvedCode',
        message: 'improvedCode.available is true but code is empty, missing, or not a string',
      });
    }
  }
  // وقتی available === false باشد، Zod قبلاً تضمین کرده که code === null است
  // بنابراین نیازی به بررسی مجدد نیست.

  // notes: اگر موجود باشد، باید رشته غیرخالی یا null باشد
  if (notes !== undefined && notes !== null && typeof notes === 'string' && notes.trim().length === 0) {
    issues.push({
      code: 'IMPROVED_CODE_MISSING_NOTES',
      path: 'improvedCode.notes',
      message: 'improvedCode.notes is present but empty',
    });
  }

  return issues;
}

/**
 * اعتبارسنجی تضاد بین Verdict و Findings
 */
function validateVerdictConsistency(result: AdvancedAuditResult): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];

  const findings = result.findings || [];
  const verdict = result.verdict;

  if (!verdict) {
    issues.push({
      code: 'MISSING_VERDICT',
      path: 'verdict',
      message: 'Verdict is required but missing',
    });
    return issues;
  }

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');

  if (hasCritical) {
    if (verdict.status === 'approved' || verdict.status === 'approved-with-suggestions' || verdict.status === 'requires-minor-changes') {
      issues.push({
        code: 'VERDICT_INCONSISTENT_CRITICAL',
        path: 'verdict.status',
        message: `Verdict is "${verdict.status}" but critical findings exist`,
        relatedIds: findings.filter((f) => f.severity === 'critical').map((f) => f.id),
      });
    }
  }

  if (hasHigh && verdict.status === 'approved') {
    issues.push({
      code: 'VERDICT_INCONSISTENT_HIGH',
      path: 'verdict.status',
      message: 'Verdict is "approved" but high severity findings exist',
      relatedIds: findings.filter((f) => f.severity === 'high').map((f) => f.id),
    });
  }

  return issues;
}

/**
 * اعتبارسنجی تناقض بین Scorecard و Findings
 */
function validateScorecardConsistency(result: AdvancedAuditResult): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];

  const findings = result.findings || [];
  const scorecard = result.scorecard;

  if (!scorecard) {
    issues.push({
      code: 'MISSING_SCORECARD',
      path: 'scorecard',
      message: 'Scorecard is required but missing',
    });
    return issues;
  }

  const hasCritical = findings.some((f) => f.severity === 'critical');
  const hasHigh = findings.some((f) => f.severity === 'high');

  if (hasCritical && scorecard.productionReadiness?.score > 50) {
    issues.push({
      code: 'SCORECARD_INCONSISTENT_CRITICAL',
      path: 'scorecard.productionReadiness.score',
      message: `Production readiness score ${scorecard.productionReadiness.score} is too high despite critical findings`,
    });
  }

  if (hasHigh && scorecard.productionReadiness?.score > 70) {
    issues.push({
      code: 'SCORECARD_INCONSISTENT_HIGH',
      path: 'scorecard.productionReadiness.score',
      message: `Production readiness score ${scorecard.productionReadiness.score} is too high despite high findings`,
    });
  }

  return issues;
}

/**
 * اعتبارسنجی ارجاعات تکراری
 */
function validateDuplicateReferences(result: AdvancedAuditResult): SemanticValidationIssue[] {
  const issues: SemanticValidationIssue[] = [];

  for (const action of result.recommendedActions || []) {
    if (action.relatedFindingIds && action.relatedFindingIds.length > 0) {
      const seen = new Set<string>();
      for (const id of action.relatedFindingIds) {
        if (seen.has(id)) {
          issues.push({
            code: 'DUPLICATE_REFERENCE',
            path: `recommendedActions[${result.recommendedActions.indexOf(action)}].relatedFindingIds`,
            message: `Duplicate reference to finding ${id}`,
            relatedIds: [id],
          });
        }
        seen.add(id);
      }
    }
  }

  for (const obs of result.architecturalObservations || []) {
    if (obs.relatedFindingIds && obs.relatedFindingIds.length > 0) {
      const seen = new Set<string>();
      for (const id of obs.relatedFindingIds) {
        if (seen.has(id)) {
          issues.push({
            code: 'DUPLICATE_REFERENCE',
            path: `architecturalObservations[${result.architecturalObservations.indexOf(obs)}].relatedFindingIds`,
            message: `Duplicate reference to finding ${id}`,
            relatedIds: [id],
          });
        }
        seen.add(id);
      }
    }
  }

  return issues;
}

/**
 * تابع اصلی اعتبارسنجی معنایی
 */
export function validateSemanticIntegrity(result: AdvancedAuditResult): SemanticValidationResult {
  const errors: SemanticValidationIssue[] = [];
  const warnings: SemanticValidationIssue[] = [];

  const idIssues = validateFindingIds(result.findings || []);
  errors.push(...idIssues);

  const refIssues = validateReferences(result.findings || [], result);
  errors.push(...refIssues);

  const codeIssues = validateImprovedCode(result);
  errors.push(...codeIssues);

  const verdictIssues = validateVerdictConsistency(result);
  warnings.push(...verdictIssues);

  const scorecardIssues = validateScorecardConsistency(result);
  warnings.push(...scorecardIssues);

  const duplicateIssues = validateDuplicateReferences(result);
  warnings.push(...duplicateIssues);

  if (result.summary && result.summary.includes('no issues') && (result.findings || []).length > 0) {
    warnings.push({
      code: 'SUMMARY_FINDINGS_MISMATCH',
      path: 'summary',
      message: 'Summary suggests no issues but findings exist',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function logSemanticValidationResult(
  result: SemanticValidationResult,
  requestId?: string
): void {
  if (result.isValid) {
    logger.debug('[SemanticValidator] Validation passed', { requestId, warnings: result.warnings.length });
    return;
  }

  logger.error('[SemanticValidator] Validation failed', {
    requestId,
    errors: result.errors.length,
    warnings: result.warnings.length,
    errorCodes: result.errors.map((e) => e.code),
  });
}