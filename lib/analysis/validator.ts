// ============================================================
// 📁 فایل: lib/analysis/validator.ts
// ============================================================
import { z } from 'zod';
import { AdvancedAuditResultSchema } from './schema';
import {
  AdvancedAuditResult,
  AuditValidationResult,
  ValidationIssue,
  DetectorResult,
} from './types';
import { getLineCount, isValidLineRange, getLineContent } from './numberedCode';
import logger from '@/lib/logger';

function validateEvidenceLines(
  result: AdvancedAuditResult,
  code: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const totalLines = getLineCount(code);

  for (const finding of result.findings) {
    for (const evidence of finding.evidence) {
      if (!isValidLineRange(code, evidence.startLine, evidence.endLine)) {
        issues.push({
          code: 'EVIDENCE_LINE_OUT_OF_RANGE',
          severity: 'error',
          message: `Evidence line range ${evidence.startLine}-${evidence.endLine} is out of bounds (total ${totalLines} lines)`,
          relatedLines: [evidence.startLine, evidence.endLine],
          expectedCoverage: 'All evidence lines must be within source code range',
        });
        continue;
      }
      if (evidence.startLine > evidence.endLine) {
        issues.push({
          code: 'EVIDENCE_LINE_REVERSED',
          severity: 'error',
          message: `Evidence startLine ${evidence.startLine} > endLine ${evidence.endLine}`,
          relatedLines: [evidence.startLine, evidence.endLine],
          expectedCoverage: 'startLine must be <= endLine',
        });
        continue;
      }
      const actualCode = getLineContent(code, evidence.startLine, evidence.endLine);
      if (actualCode && !evidence.code.trim()) {
        issues.push({
          code: 'EVIDENCE_CODE_EMPTY',
          severity: 'warning',
          message: `Evidence code is empty for lines ${evidence.startLine}-${evidence.endLine}`,
          relatedLines: [evidence.startLine, evidence.endLine],
          expectedCoverage: 'Evidence code should contain relevant code snippet',
        });
      }
    }
  }

  return issues;
}

function validateCriticalFindings(result: AdvancedAuditResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const finding of result.findings) {
    if (finding.severity === 'critical' || finding.severity === 'high') {
      if (finding.evidence.length === 0) {
        issues.push({
          code: 'CRITICAL_NO_EVIDENCE',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no evidence`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must have at least one evidence item',
        });
      }
      if (!finding.executionPath || finding.executionPath.length === 0) {
        issues.push({
          code: 'MISSING_EXECUTION_PATH',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no execution path`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must include executionPath',
        });
      }
      if (!finding.triggerConditions || finding.triggerConditions.length === 0) {
        issues.push({
          code: 'MISSING_TRIGGER_CONDITIONS',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no trigger conditions`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must include triggerConditions',
        });
      }
      if (!finding.consequence || finding.consequence.trim() === '') {
        issues.push({
          code: 'CRITICAL_NO_CONSEQUENCE',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no consequence`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must include consequence',
        });
      }
      if (!finding.remediation || finding.remediation.trim() === '') {
        issues.push({
          code: 'CRITICAL_NO_REMEDIATION',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no remediation`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must include remediation',
        });
      }
      if (!finding.testToReproduce) {
        issues.push({
          code: 'CRITICAL_NO_TEST_TO_REPRODUCE',
          severity: 'error',
          message: `Critical/high finding "${finding.title}" has no test to reproduce`,
          relatedLines: [],
          expectedCoverage: 'Critical/high findings must include testToReproduce',
        });
      }
    }
  }

  return issues;
}

function validateRelatedIds(result: AdvancedAuditResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allIds = new Set(result.findings.map((f) => f.id));

  for (const obs of result.architecturalObservations) {
    for (const id of obs.relatedFindingIds) {
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

  for (const action of result.recommendedActions) {
    for (const id of action.relatedFindingIds) {
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

function validateVerdictConsistency(result: AdvancedAuditResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const hasCritical = result.findings.some((f) => f.severity === 'critical');
  const hasHigh = result.findings.some((f) => f.severity === 'high');

  if (hasCritical && result.verdict.status === 'production-ready-with-monitoring') {
    issues.push({
      code: 'VERDICT_INCONSISTENT',
      severity: 'warning',
      message: 'Production-ready verdict with critical findings',
      relatedLines: [],
      expectedCoverage: 'Critical findings should downgrade production readiness verdict',
    });
  }

  if (hasHigh && result.verdict.status === 'production-ready-with-monitoring') {
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

export function validateSemanticCompleteness(
  result: AdvancedAuditResult,
  detectorResult: DetectorResult,
  code: string
): AuditValidationResult {
  const allIssues: ValidationIssue[] = [];

  let structurallyValid = true;
  try {
    AdvancedAuditResultSchema.parse(result);
  } catch (error) {
    structurallyValid = false;
    allIssues.push({
      code: 'SCHEMA_VALIDATION_FAILED',
      severity: 'error',
      message: error instanceof Error ? error.message : 'Schema validation failed',
      relatedLines: [],
      expectedCoverage: 'All fields must match the schema',
    });
  }

  const evidenceIssues = validateEvidenceLines(result, code);
  allIssues.push(...evidenceIssues);

  const criticalIssues = validateCriticalFindings(result);
  allIssues.push(...criticalIssues);

  const relatedIssues = validateRelatedIds(result);
  allIssues.push(...relatedIssues);

  const verdictIssues = validateVerdictConsistency(result);
  allIssues.push(...verdictIssues);

  let semanticallyComplete = true;
  const semanticIssues: ValidationIssue[] = [];

  if (detectorResult.requiresConcurrencyAudit && result.auditType === 'generic') {
    semanticIssues.push({
      code: 'MISSING_CONCURRENCY_ANALYSIS',
      severity: 'error',
      message: 'Concurrency signals detected but audit type is generic (not concurrency)',
      relatedLines: detectorResult.signals.map((s) => s.line),
      expectedCoverage: 'Should analyze concurrency-related issues',
    });
  }

  const hasExecutorSignals = detectorResult.signals.some(
    (s) => s.type === 'EXECUTOR' || s.type === 'THREAD_POOL' || s.type === 'EXECUTOR_SUBMIT'
  );
  const hasLivenessFindings = result.findings.some(
    (f) => f.category === 'liveness' || f.category === 'thread-starvation' || f.category === 'deadlock'
  );
  if (hasExecutorSignals && !hasLivenessFindings) {
    semanticIssues.push({
      code: 'MISSING_LIVENESS_ANALYSIS',
      severity: 'warning',
      message: 'Executor signals detected but no liveness findings reported',
      relatedLines: detectorResult.signals.filter((s) =>
        ['EXECUTOR', 'THREAD_POOL', 'EXECUTOR_SUBMIT'].includes(s.type)
      ).map((s) => s.line),
      expectedCoverage: 'Should analyze liveness risks (deadlock, starvation)',
    });
  }

  const hasFutureGet = detectorResult.signals.some((s) => s.type === 'FUTURE_GET');
  const hasBlockingAnalysis = result.findings.some(
    (f) => f.category === 'thread-starvation' || f.category === 'liveness'
  );
  if (hasFutureGet && !hasBlockingAnalysis) {
    semanticIssues.push({
      code: 'MISSING_BLOCKING_WAIT_ANALYSIS',
      severity: 'warning',
      message: 'Future.get detected but no blocking wait analysis found',
      relatedLines: detectorResult.signals.filter((s) => s.type === 'FUTURE_GET').map((s) => s.line),
      expectedCoverage: 'Should analyze blocking waits and nested submission risks',
    });
  }

  const hasQueueOffer = detectorResult.signals.some((s) => s.type === 'QUEUE_OFFER' || s.value.includes('offer'));
  const hasQueueAnalysis = result.findings.some((f) => f.category === 'queue-misuse');
  if (hasQueueOffer && !hasQueueAnalysis) {
    semanticIssues.push({
      code: 'MISSING_QUEUE_ANALYSIS',
      severity: 'warning',
      message: 'Queue offer detected but no queue-misuse analysis found',
      relatedLines: detectorResult.signals.filter((s) => s.value.includes('offer')).map((s) => s.line),
      expectedCoverage: 'Should analyze queue manipulation and execute mismatch',
    });
  }

  allIssues.push(...semanticIssues);

  if (semanticIssues.some((i) => i.severity === 'error')) {
    semanticallyComplete = false;
  }

  const repairRequired =
    !structurallyValid ||
    allIssues.some(
      (i) => i.severity === 'error' && i.code !== 'EVIDENCE_LINE_OUT_OF_RANGE'
    );

  return {
    structurallyValid,
    semanticallyComplete,
    issues: allIssues,
    repairRequired,
  };
}