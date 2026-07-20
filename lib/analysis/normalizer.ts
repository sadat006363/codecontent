// lib/analysis/normalizer.ts

import type { AdvancedAuditResult, AuditFinding, AuditScorecard } from './schema';
import {
  SeveritySchema,
  ConfidenceSchema,
  FindingCategorySchema,
  AuditTypeSchema,
  AuditStatusSchema,
  VerdictStatusSchema,
} from './schema';

// ============================================================
// Type Guards & Helpers
// ============================================================

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getSafeString(value: unknown, fallback: string = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getSafeArray<T>(value: unknown, fallback: T[] = []): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string').map((v) => v.trim())
    : [];
}

function getSafeObject(value: unknown, fallback: Record<string, unknown> = {}): Record<string, unknown> {
  return isObject(value) ? value : fallback;
}

function sanitizeEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T
): T {
  if (typeof value === 'string' && allowedValues.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

// ============================================================
// Score normalization: consistent with prompt (0–100)
// ============================================================

function normalizeScore(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && isFinite(value)) {
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }
  return fallback;
}

// ============================================================
// Main Normalizer
// ============================================================

export function normalizeAnalysisOutput(raw: unknown): AdvancedAuditResult {
  const input = getSafeObject(raw);

  // --- 1. Findings ---
  const findingsSource =
    input.findings ??
    input.issues ??
    input.advancedFindings ??
    input.concurrencyFindings ??
    (isObject(input.analysis) ? input.analysis.findings : undefined);

  const findingsArray = getSafeArray<unknown>(findingsSource, []);

  // Track used IDs to enforce uniqueness
  const usedIds = new Set<string>();

  const normalizedFindings: AuditFinding[] = findingsArray
    .map((f: unknown, index: number) => {
      const finding = getSafeObject(f);

      // Evidence
      const evidenceList = getSafeArray<unknown>(finding.evidence, []);
      const normalizedEvidence = evidenceList.map((e: unknown) => {
        const ev = getSafeObject(e);
        let startLine = typeof ev.startLine === 'number' ? ev.startLine : (typeof ev.line === 'number' ? ev.line : 1);
        let endLine = typeof ev.endLine === 'number' ? ev.endLine : startLine;
        // Ensure endLine >= startLine
        if (endLine < startLine) {
          endLine = startLine;
        }
        return {
          startLine: Math.max(1, startLine),
          endLine: Math.max(1, endLine),
          code: getSafeString(ev.code, getSafeString(ev.snippet, '')),
          explanation: getSafeString(ev.explanation, getSafeString(ev.details, '')),
        };
      });

      // Test to reproduce
      let testToReproduce = null;
      const testRaw = finding.testToReproduce ?? finding.test;
      if (isObject(testRaw)) {
        const setup = getStringArray(testRaw.setup);
        const steps = getStringArray(testRaw.steps);
        if (steps.length > 0) {
          testToReproduce = {
            title: getSafeString(testRaw.title, 'Reproduction Test'),
            setup,
            steps,
            expectedResult: getSafeString(testRaw.expectedResult, ''),
          };
        }
      }

      // Generate unique ID
      let id = getSafeString(finding.id, `F-${String(index + 1).padStart(3, '0')}`);
      if (!/^F-\d{3,}$/.test(id)) {
        id = `F-${String(index + 1).padStart(3, '0')}`;
      }
      // Ensure uniqueness
      let counter = 1;
      let finalId = id;
      while (usedIds.has(finalId)) {
        const numericPart = id.replace('F-', '');
        const baseNum = parseInt(numericPart, 10) || 0;
        finalId = `F-${String(baseNum + counter).padStart(3, '0')}`;
        counter++;
      }
      usedIds.add(finalId);

      return {
        id: finalId,
        title: getSafeString(finding.title, getSafeString(finding.name, 'Untitled Finding')),
        category: sanitizeEnum(
          finding.category ?? finding.type,
          FindingCategorySchema.options,
          'other'
        ),
        severity: sanitizeEnum(
          finding.severity ?? finding.priority,
          SeveritySchema.options,
          'medium'
        ),
        confidence: sanitizeEnum(
          finding.confidence,
          ConfidenceSchema.options,
          'conditional'
        ),
        evidence: normalizedEvidence,
        executionPath: getStringArray(finding.executionPath) || getStringArray(finding.path) || [],
        triggerConditions: getStringArray(finding.triggerConditions) || getStringArray(finding.conditions) || [],
        consequence: getSafeString(finding.consequence, getSafeString(finding.impact, getSafeString(finding.effect, ''))),
        technicalExplanation: getSafeString(finding.technicalExplanation, getSafeString(finding.details, '')),
        remediation: getSafeString(finding.remediation, getSafeString(finding.fix, getSafeString(finding.solution, ''))),
        relatedSymbols: getStringArray(finding.relatedSymbols) || getStringArray(finding.symbols) || [],
        testToReproduce,
      };
    })
    .filter((finding) => finding.title.trim().length > 0 || finding.evidence.length > 0);

  // --- 2. Execution Overview ---
  const overviewSource = getSafeObject(input.executionOverview, getSafeObject(input.overview, {}));
  const executionOverview = {
    entryPoints: getStringArray(overviewSource.entryPoints) || [],
    taskSubmissionPoints: getStringArray(overviewSource.taskSubmissionPoints) || [],
    blockingWaitPoints: getStringArray(overviewSource.blockingWaitPoints) || [],
    sharedResources: getStringArray(overviewSource.sharedResources) || [],
    resourceLifecycle: getStringArray(overviewSource.resourceLifecycle) || [],
  };

  // --- 3. Scorecard (canonical 0–100 range, consistent with prompt) ---
  const scorecardSource = getSafeObject(
    input.scorecard_new ?? input.scorecardLegacy ?? input.scorecard ?? {}
  );

  const scorecard: AuditScorecard = {
    correctness: normalizeScore(scorecardSource.correctness, 0),
    concurrencySafety: normalizeScore(scorecardSource.concurrencySafety, 0),
    liveness: normalizeScore(scorecardSource.liveness, 0),
    errorHandling: normalizeScore(scorecardSource.errorHandling, 0),
    resourceManagement: normalizeScore(scorecardSource.resourceManagement, 0),
    maintainability: normalizeScore(scorecardSource.maintainability, 0),
    productionReadiness: normalizeScore(scorecardSource.productionReadiness, 0),
  };

  // --- 4. Verdict ---
  const verdictSource = getSafeObject(input.verdict, getSafeObject(input.finalVerdict, {}));
  const verdict = {
    status: sanitizeEnum(
      verdictSource.status,
      VerdictStatusSchema.options,
      'requires-major-changes'
    ),
    explanation: getSafeString(verdictSource.explanation, getSafeString(verdictSource.summary, '')),
  };

  // --- 5. Complexity ---
  const complexitySource = getSafeObject(input.complexity, {});
  const complexity = {
    time: getSafeString(complexitySource.time, 'unknown'),
    space: getSafeString(complexitySource.space, 'unknown'),
    resourceGrowth: getSafeString(complexitySource.resourceGrowth, 'unknown'),
    assumptions: getStringArray(complexitySource.assumptions) || [],
  };

  // --- 6. linkedin_post ---
  const linkedinPost =
    typeof input.linkedin_post === 'string'
      ? input.linkedin_post.trim()
      : typeof input.linkedinPost === 'string'
        ? input.linkedinPost.trim()
        : '';

  // --- 7. Other arrays with filtering ---
  const architecturalObservations = getSafeArray<unknown>(input.architecturalObservations, [])
    .map((obs: unknown) => {
      const o = getSafeObject(obs);
      const title = getSafeString(o.title, '');
      const explanation = getSafeString(o.explanation, '');
      // Filter related IDs to only those that exist in findings
      const allFindingIds = new Set(normalizedFindings.map((f) => f.id));
      const relatedFindingIds = getStringArray(o.relatedFindingIds).filter((id) => allFindingIds.has(id));
      return { title, explanation, relatedFindingIds };
    })
    .filter((obs) => obs.title.length > 0 || obs.explanation.length > 0);

  const recommendedActions = getSafeArray<unknown>(input.recommendedActions, [])
    .map((act: unknown) => {
      const a = getSafeObject(act);
      let priority = typeof a.priority === 'number' && a.priority > 0 ? Math.round(a.priority) : 1;
      // Sort will be applied later
      const severity = sanitizeEnum(a.severity, SeveritySchema.options, 'medium');
      const title = getSafeString(a.title, '');
      const action = getSafeString(a.action, '');
      const allFindingIds = new Set(normalizedFindings.map((f) => f.id));
      const relatedFindingIds = getStringArray(a.relatedFindingIds).filter((id) => allFindingIds.has(id));
      return { priority, severity, title, action, relatedFindingIds };
    })
    .filter((act) => act.title.length > 0 || act.action.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((act, index) => ({ ...act, priority: index + 1 }));

  const suggestedTests = getSafeArray<unknown>(
    input.suggestedTests ?? input.suggestedTestsLegacy,
    []
  )
    .map((test: unknown) => {
      const t = getSafeObject(test);
      const title = getSafeString(t.title, getSafeString(t.name, ''));
      const purpose = getSafeString(t.purpose, '');
      const setup = getStringArray(t.setup) || [];
      const steps = getStringArray(t.steps) || [];
      const expectedResult = getSafeString(t.expectedResult, getSafeString(t.expectedOutput, ''));
      return { title, purpose, setup, steps, expectedResult };
    })
    .filter((test) => test.title.length > 0 || test.purpose.length > 0);

  const limitations = getStringArray(input.limitations) || [];

  // --- 8. Build final result ---
  // Normalizer always outputs "complete" status; pipeline will override if needed
  const status: 'complete' = 'complete';

  const auditType = sanitizeEnum(input.auditType, AuditTypeSchema.options, 'generic');
  const language = getSafeString(input.language, 'unknown');
  const summary = getSafeString(input.summary, getSafeString(input.highLevelSummary, ''));
  const schemaVersion = getSafeString(input.schemaVersion, '1.0');

  return {
    schemaVersion,
    auditType,
    status,
    language,
    summary,
    executionOverview,
    findings: normalizedFindings,
    architecturalObservations,
    recommendedActions,
    suggestedTests,
    complexity,
    scorecard,
    verdict,
    limitations,
    linkedin_post: linkedinPost,
  };
}