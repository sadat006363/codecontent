// lib/analysis/validator.ts

import { z } from 'zod';
import {
  AdvancedAuditResultSchema,
  type AdvancedAuditResult,
  FindingIdSchema,
} from './schema';
import type {
  AuditValidationResult,
  ValidationIssue,
  DetectorResult,
} from './types';
import { getLineCount, isValidLineRange, getLineContent } from './numberedCode';
import logger from '@/lib/logger';

// ============================================================
// VALIDATION: Evidence lines
// ============================================================

function validateEvidenceLines(
  result: any, // 🔥 Changed from AdvancedAuditResult to any
  code: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const totalLines = getLineCount(code);

  const findings = result?.findings ?? [];

  for (const finding of findings) {
    const evidence = finding?.evidence ?? [];
    for (const ev of evidence) {
      const startLine = ev?.startLine ?? 0;
      const endLine = ev?.endLine ?? 0;

      if (!isValidLineRange(code, startLine, endLine)) {
        issues.push({
          code: 'EVIDENCE_LINE_OUT_OF_RANGE',
          severity: 'error',
          message: `Evidence line range ${startLine}-${endLine} is out of bounds (total ${totalLines} lines)`,
          relatedLines: [startLine, endLine],
          expectedCoverage: 'All evidence lines must be within source code range',
        });
        continue;
      }

      if (startLine > endLine) {
        issues.push({
          code: 'EVIDENCE_LINE_REVERSED',
          severity: 'error',
          message: `Evidence startLine ${startLine} > endLine ${endLine}`,
          relatedLines: [startLine, endLine],
          expectedCoverage: 'startLine must be <= endLine',
        });
        continue;
      }

      const actualCode = getLineContent(code, startLine, endLine);
      const evidenceCode = ev?.code ?? '';
      if (actualCode && evidenceCode.trim()) {
        const normalizedActual = actualCode.replace(/\s+/g, ' ').trim();
        const normalizedEvidence = evidenceCode.replace(/\s+/g, ' ').trim();
        if (!normalizedActual.includes(normalizedEvidence) && !normalizedEvidence.includes(normalizedActual)) {
          issues.push({
            code: 'EVIDENCE_CODE_MISMATCH',
            severity: 'warning',
            message: `Evidence code does not appear to match the actual source at lines ${startLine}-${endLine}`,
            relatedLines: [startLine, endLine],
            expectedCoverage: 'Evidence code should be a snippet from the source',
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================
// VALIDATION: Finding IDs and uniqueness
// ============================================================

function validateFindingIds(
  result: any // 🔥 Changed from AdvancedAuditResult to any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();

  const findings = result?.findings ?? [];

  for (const finding of findings) {
    const id = finding?.id ?? '';
    const idCheck = FindingIdSchema.safeParse(id);
    if (!idCheck.success) {
      issues.push({
        code: 'INVALID_FINDING_ID_FORMAT',
        severity: 'error',
        message: `Finding ID "${id}" does not match required format F-\\d{3,}`,
        relatedLines: [],
        expectedCoverage: 'Finding IDs must follow format F-001, F-002, etc.',
      });
      continue;
    }

    if (ids.has(id)) {
      issues.push({
        code: 'DUPLICATE_FINDING_ID',
        severity: 'error',
        message: `Duplicate finding ID "${id}" found`,
        relatedLines: [],
        expectedCoverage: 'All finding IDs must be unique',
      });
    } else {
      ids.add(id);
    }
  }

  return issues;
}

// ============================================================
// VALIDATION: Related IDs (references)
// ============================================================

function validateRelatedIds(
  result: any // 🔥 Changed from AdvancedAuditResult to any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allIds = new Set((result?.findings ?? []).map((f: any) => f?.id ?? ''));

  const observations = result?.architecturalObservations ?? [];
  for (const obs of observations) {
    const relatedIds = obs?.relatedFindingIds ?? [];
    for (const id of relatedIds) {
      if (!allIds.has(id)) {
        issues.push({
          code: 'RELATED_ID_NOT_FOUND',
          severity: 'warning',
          message: `Architectural observation references non-existent finding ID: ${id}`,
          relatedLines: [],
          expectedCoverage: 'All relatedFindingIds must reference existing findings',
        });
      }
    }
  }

  const actions = result?.recommendedActions ?? [];
  for (const action of actions) {
    const relatedIds = action?.relatedFindingIds ?? [];
    for (const id of relatedIds) {
      if (!allIds.has(id)) {
        issues.push({
          code: 'RELATED_ID_NOT_FOUND',
          severity: 'warning',
          message: `Recommended action references non-existent finding ID: ${id}`,
          relatedLines: [],
          expectedCoverage: 'All relatedFindingIds must reference existing findings',
        });
      }
    }
  }

  return issues;
}

// ============================================================
// VALIDATION: Scorecard ranges
// ============================================================

function validateScorecard(
  result: any // 🔥 Changed from AdvancedAuditResult to any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const scores = result?.scorecard ?? {};

  for (const [key, value] of Object.entries(scores)) {
    if (typeof value !== 'number' || value < 0 || value > 10) {
      issues.push({
        code: 'SCORECARD_VALUE_OUT_OF_RANGE',
        severity: 'error',
        message: `Scorecard field "${key}" has value ${value}, expected between 0 and 10`,
        relatedLines: [],
        expectedCoverage: 'All scorecard values must be between 0 and 10',
      });
    }
  }

  return issues;
}

// ============================================================
// VALIDATION: Verdict consistency
// ============================================================

function validateVerdictConsistency(
  result: any // 🔥 Changed from AdvancedAuditResult to any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const findings = result?.findings ?? [];
  const hasCritical = findings.some((f: any) => f?.severity === 'critical');
  const hasHigh = findings.some((f: any) => f?.severity === 'high');

  const verdictStatus = result?.verdict?.status ?? '';
  if (hasCritical && verdictStatus === 'production-ready-with-monitoring') {
    issues.push({
      code: 'VERDICT_INCONSISTENT',
      severity: 'warning',
      message: 'Production-ready verdict with critical findings',
      relatedLines: [],
      expectedCoverage: 'Critical findings should downgrade production readiness verdict',
    });
  }

  if (hasHigh && verdictStatus === 'production-ready-with-monitoring') {
    issues.push({
      code: 'VERDICT_INCONSISTENT',
      severity: 'warning',
      message: 'Production-ready verdict with high severity findings',
      relatedLines: [],
      expectedCoverage: 'High findings should be resolved before production-ready verdict',
    });
  }

  return issues;
}

// ============================================================
// VALIDATION: Ensure linkedin_post is present and valid
// ============================================================

function validateLinkedInPost(
  result: any // 🔥 Changed from AdvancedAuditResult to any
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const post = result?.linkedin_post ?? '';

  if (!post || post.trim().length === 0) {
    issues.push({
      code: 'LINKEDIN_POST_EMPTY',
      severity: 'error',
      message: 'linkedin_post is required but missing or empty',
      relatedLines: [],
      expectedCoverage: 'linkedin_post must be a non-empty string between 1 and 300 characters',
    });
  } else if (post.length > 300) {
    issues.push({
      code: 'LINKEDIN_POST_TOO_LONG',
      severity: 'error',
      message: `linkedin_post exceeds 300 characters (${post.length})`,
      relatedLines: [],
      expectedCoverage: 'linkedin_post must be at most 300 characters',
    });
  }

  return issues;
}

// ============================================================
// SEMANTIC VALIDATION: Concurrency-specific coverage
// ============================================================

function validateConcurrencyCoverage(
  result: any, // 🔥 Changed from AdvancedAuditResult to any
  detectorResult: DetectorResult
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const signals = detectorResult?.signals ?? [];

  if (detectorResult?.requiresConcurrencyAudit && result?.auditType === 'generic') {
    issues.push({
      code: 'MISSING_CONCURRENCY_ANALYSIS',
      severity: 'error',
      message: 'Concurrency signals detected but audit type is generic',
      relatedLines: signals.map((s: any) => s?.line ?? 0),
      expectedCoverage: 'Should analyze concurrency-related issues',
    });
  }

  const hasExecutorSignals = signals.some(
    (s: any) => s?.type === 'EXECUTOR' || s?.type === 'THREAD_POOL' || s?.type === 'EXECUTOR_SUBMIT'
  );
  const findings = result?.findings ?? [];
  const hasLivenessFindings = findings.some(
    (f: any) => f?.category === 'liveness' || f?.category === 'thread-starvation' || f?.category === 'deadlock'
  );
  if (hasExecutorSignals && !hasLivenessFindings) {
    issues.push({
      code: 'MISSING_LIVENESS_ANALYSIS',
      severity: 'warning',
      message: 'Executor signals detected but no liveness findings reported',
      relatedLines: signals.filter((s: any) =>
        ['EXECUTOR', 'THREAD_POOL', 'EXECUTOR_SUBMIT'].includes(s?.type)
      ).map((s: any) => s?.line ?? 0),
      expectedCoverage: 'Should analyze liveness risks (deadlock, starvation)',
    });
  }

  const hasFutureGet = signals.some((s: any) => s?.type === 'FUTURE_GET');
  const hasBlockingAnalysis = findings.some(
    (f: any) => f?.category === 'thread-starvation' || f?.category === 'liveness'
  );
  if (hasFutureGet && !hasBlockingAnalysis) {
    issues.push({
      code: 'MISSING_BLOCKING_WAIT_ANALYSIS',
      severity: 'warning',
      message: 'Future.get detected but no blocking wait analysis found',
      relatedLines: signals.filter((s: any) => s?.type === 'FUTURE_GET').map((s: any) => s?.line ?? 0),
      expectedCoverage: 'Should analyze blocking waits and nested submission risks',
    });
  }

  return issues;
}

// ============================================================
// MAIN VALIDATION FUNCTION
// ============================================================

export function validateSemanticCompleteness(
  result: any, // 🔥 Changed from AdvancedAuditResult to any
  detectorResult: DetectorResult,
  code: string
): AuditValidationResult {
  const allIssues: ValidationIssue[] = [];

  // --- STRUCTURAL VALIDATION (Zod) ---
  let structurallyValid = true;
  try {
    AdvancedAuditResultSchema.parse(result);
  } catch (error) {
    structurallyValid = false;
    if (error instanceof z.ZodError) {
      for (const issue of error.issues) {
        allIssues.push({
          code: 'SCHEMA_VALIDATION_FAILED',
          severity: 'error',
          message: `${issue.path.join('.')}: ${issue.message}`,
          relatedLines: [],
          expectedCoverage: 'All fields must match the schema',
        });
      }
    } else {
      allIssues.push({
        code: 'SCHEMA_VALIDATION_FAILED',
        severity: 'error',
        message: error instanceof Error ? error.message : 'Schema validation failed',
        relatedLines: [],
        expectedCoverage: 'All fields must match the schema',
      });
    }
  }

  // --- SEMANTIC VALIDATIONS (only if structurally valid to avoid noise) ---
  if (structurallyValid) {
    try {
      const evidenceIssues = validateEvidenceLines(result, code);
      allIssues.push(...evidenceIssues);
    } catch (err) {
      logger.error('[Validator] validateEvidenceLines crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateEvidenceLines crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All evidence validation should complete without crashing',
      });
    }

    try {
      const idIssues = validateFindingIds(result);
      allIssues.push(...idIssues);
    } catch (err) {
      logger.error('[Validator] validateFindingIds crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateFindingIds crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All ID validation should complete without crashing',
      });
    }

    try {
      const relatedIssues = validateRelatedIds(result);
      allIssues.push(...relatedIssues);
    } catch (err) {
      logger.error('[Validator] validateRelatedIds crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateRelatedIds crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All related IDs validation should complete without crashing',
      });
    }

    try {
      const scorecardIssues = validateScorecard(result);
      allIssues.push(...scorecardIssues);
    } catch (err) {
      logger.error('[Validator] validateScorecard crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateScorecard crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All scorecard validation should complete without crashing',
      });
    }

    try {
      const verdictIssues = validateVerdictConsistency(result);
      allIssues.push(...verdictIssues);
    } catch (err) {
      logger.error('[Validator] validateVerdictConsistency crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateVerdictConsistency crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All verdict consistency validation should complete without crashing',
      });
    }

    try {
      const linkedinIssues = validateLinkedInPost(result);
      allIssues.push(...linkedinIssues);
    } catch (err) {
      logger.error('[Validator] validateLinkedInPost crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateLinkedInPost crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All linkedin_post validation should complete without crashing',
      });
    }

    try {
      const concurrencyIssues = validateConcurrencyCoverage(result, detectorResult);
      allIssues.push(...concurrencyIssues);
    } catch (err) {
      logger.error('[Validator] validateConcurrencyCoverage crashed:', err);
      allIssues.push({
        code: 'SEMANTIC_VALIDATION_CRASH',
        severity: 'error',
        message: `validateConcurrencyCoverage crashed: ${err instanceof Error ? err.message : 'unknown error'}`,
        relatedLines: [],
        expectedCoverage: 'All concurrency coverage validation should complete without crashing',
      });
    }
  }

  // 🔥 FIX: repairRequired remains the same
  const repairRequired =
    !structurallyValid ||
    allIssues.some(
      (i) => i.severity === 'error' && i.code !== 'EVIDENCE_LINE_OUT_OF_RANGE'
    );

  // 🔥 FIX: semanticallyComplete MUST include structurallyValid
  const semanticallyComplete =
    structurallyValid &&
    !allIssues.some(
      (i) => i.severity === 'error' && i.code !== 'EVIDENCE_LINE_OUT_OF_RANGE'
    );

  return {
    structurallyValid,
    semanticallyComplete,
    issues: allIssues,
    repairRequired,
  };
}