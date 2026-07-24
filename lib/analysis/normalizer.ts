// lib/analysis/normalizer.ts

import { z } from 'zod';
import {
  AdvancedAuditResultSchema,
  SeveritySchema,
  ConfidenceSchema,
  BroadCategorySchema,
  MechanismSchema,
  VerdictSchema,
  VerdictStatusSchema,
  ComplexitySchema,
  ImprovedCodeSchema,
  CompletionStatusSchema,
  SpecializationSchema,
  AnalysisCoverageItemSchema,
  type AdvancedAuditResult,
  type AuditFinding,
  type AuditScorecard,
  type ScoreItem,
  type ImprovedCode,
  type VerdictStatus,
  type Complexity,
  type AnalysisCoverageItem,
  type ArchitecturalObservation,
  type SuggestedTest,
  type ExecutionOverview,
} from '@/lib/analysis/schema';

import logger from '@/lib/logger';

// ============================================================
// Type aliases for inferred types
// ============================================================

type CompletionStatus = z.infer<typeof CompletionStatusSchema>;
type AppliedSpecialization = z.infer<typeof SpecializationSchema>;
type Mechanism = z.infer<typeof MechanismSchema>;

// ============================================================
// Constants
// ============================================================

const DEFAULT_TITLE = 'Code Analysis Report';
const DEFAULT_LINKEDIN_POST = 'Check out this code analysis! #Zbloue';

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
// Title Normalization
// ============================================================

function normalizeTitle(source: unknown, summary?: string): string {
  const title = getSafeString(source);
  if (title.length > 0) return title;
  if (summary && summary.length > 0) {
    const clean = summary.replace(/[#*`]/g, '').trim();
    return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
  }
  return DEFAULT_TITLE;
}

// ============================================================
// Completion Status Normalization
// ============================================================

function normalizeCompletionStatus(source: unknown): CompletionStatus {
  const status = getSafeString(source);
  if (status === 'complete' || status === 'partially-complete') {
    return status as CompletionStatus;
  }
  return 'complete';
}

// ============================================================
// Repair Applied Normalization
// ============================================================

function normalizeRepairApplied(source: unknown): boolean {
  return Boolean(source);
}

// ============================================================
// Applied Specializations Normalization
// ============================================================

function normalizeAppliedSpecializations(source: unknown): AppliedSpecialization[] {
  const arr = getSafeArray<unknown>(source, []);
  const result: AppliedSpecialization[] = [];
  for (const item of arr) {
    if (item === 'concurrency') {
      result.push(item);
    }
  }
  return result;
}

// ============================================================
// Analysis Coverage Normalization
// ============================================================

const ALL_DIMENSIONS = [
  'correctness',
  'security',
  'concurrency',
  'liveness',
  'performance',
  'resource-management',
  'error-handling',
  'input-validation',
  'data-integrity',
  'api-design',
  'architecture',
  'maintainability',
  'testability',
  'observability',
  'compatibility',
] as const;

type Dimension = typeof ALL_DIMENSIONS[number];

function normalizeAnalysisCoverage(source: unknown): AnalysisCoverageItem[] {
  const input = getSafeObject(source);
  const coverageMap: Record<string, { status: string; summary: string; limitation: string | null }> = {};

  if (Array.isArray(source)) {
    for (const item of source) {
      if (isObject(item)) {
        const dim = getSafeString(item.dimension);
        if (ALL_DIMENSIONS.includes(dim as Dimension)) {
          coverageMap[dim] = {
            status: getSafeString(item.status, 'analyzed'),
            summary: getSafeString(item.summary, `Analysis of ${dim} dimension.`),
            limitation: getSafeString(item.limitation) || null,
          };
        }
      }
    }
  } else if (isObject(source)) {
    for (const key of ALL_DIMENSIONS) {
      const value = input[key];
      if (isObject(value)) {
        coverageMap[key] = {
          status: getSafeString((value as any).status, 'analyzed'),
          summary: getSafeString((value as any).summary, `Analysis of ${key} dimension.`),
          limitation: getSafeString((value as any).limitation) || null,
        };
      }
    }
  }

  const result: AnalysisCoverageItem[] = [];
  for (const dim of ALL_DIMENSIONS) {
    const existing = coverageMap[dim];
    result.push({
      dimension: dim as any,
      status: existing?.status === 'not-applicable' || existing?.status === 'limited'
        ? (existing.status as any)
        : 'analyzed',
      summary: existing?.summary || `Analysis of ${dim} dimension.`,
      limitation: existing?.limitation ?? null,
    });
  }

  return result;
}

// ============================================================
// Score Normalization (0-100 Object with applicable flag)
// ============================================================

function normalizeScore(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && isFinite(value)) {
    if (value <= 10 && value >= 0) {
      return Math.max(0, Math.min(100, Math.round(value * 10)));
    }
    return Math.max(0, Math.min(100, Math.round(value)));
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed) && isFinite(parsed)) {
      if (parsed <= 10 && parsed >= 0) {
        return Math.max(0, Math.min(100, Math.round(parsed * 10)));
      }
      return Math.max(0, Math.min(100, Math.round(parsed)));
    }
  }
  return fallback;
}

function normalizeScoreItem(
  value: unknown,
  fallback: number = 0,
  defaultReason: string = ''
): ScoreItem {
  if (isObject(value)) {
    const score = normalizeScore(value.score, fallback);
    const reason = typeof value.reason === 'string' ? value.reason.trim() : defaultReason;
    const relatedFindings = Array.isArray(value.relatedFindings)
      ? value.relatedFindings.filter((id): id is string => typeof id === 'string')
      : [];

    if (typeof score === 'number' && !isNaN(score) && score >= 0) {
      return {
        applicable: true,
        score,
        reason: reason || 'Score derived from data.',
        relatedFindings,
      };
    } else {
      return {
        applicable: false,
        score: null,
        reason: reason || 'No score available.',
        relatedFindings: [],
      };
    }
  }

  const score = normalizeScore(value, fallback);
  if (typeof score === 'number' && !isNaN(score) && score >= 0) {
    return {
      applicable: true,
      score,
      reason: defaultReason || 'Score derived from legacy data.',
      relatedFindings: [],
    };
  } else {
    return {
      applicable: false,
      score: null,
      reason: defaultReason || 'No score available.',
      relatedFindings: [],
    };
  }
}

function normalizeScorecard(source: unknown): AuditScorecard {
  const input = getSafeObject(source);
  return {
    correctness: normalizeScoreItem(input.correctness, 0, 'Correctness assessment.'),
    concurrencySafety: normalizeScoreItem(input.concurrencySafety ?? input.concurrency, 0, 'Concurrency safety assessment.'),
    liveness: normalizeScoreItem(input.liveness, 0, 'Liveness assessment.'),
    errorHandling: normalizeScoreItem(input.errorHandling, 0, 'Error handling assessment.'),
    resourceManagement: normalizeScoreItem(input.resourceManagement, 0, 'Resource management assessment.'),
    maintainability: normalizeScoreItem(input.maintainability, 0, 'Maintainability assessment.'),
    productionReadiness: normalizeScoreItem(input.productionReadiness, 0, 'Production readiness assessment.'),
  };
}

// ============================================================
// Complexity Normalization
// ============================================================

function normalizeComplexity(source: unknown): Complexity {
  const input = getSafeObject(source);

  if (isObject(input) && 'applicable' in input) {
    try {
      return ComplexitySchema.parse(input);
    } catch {
      // fall through
    }
  }

  const applicable = typeof input.applicable === 'boolean' ? input.applicable : true;

  if (!applicable) {
    return {
      applicable: false,
      expression: null,
      explanation: null,
      variables: [],
      assumptions: [],
    };
  }

  const expression = getSafeString(input.time ?? input.expression, 'unknown');
  const explanation = getSafeString(input.explanation, 'Complexity derived from source code.');
  const variables = Array.isArray(input.variables) ? input.variables : [];
  const assumptions = getStringArray(input.assumptions);

  const parsedVariables = variables.length > 0 ? variables : extractVariables(expression);

  return {
    applicable: true,
    expression,
    explanation,
    variables: parsedVariables,
    assumptions: assumptions.length > 0 ? assumptions : ['Complexity inferred from visible code structure.'],
  };
}

function extractVariables(expression: string): Array<{ symbol: string; definition: string }> {
  const matched = expression.match(/[OΩΘ]\(([^)]+)\)/g);
  if (!matched) return [];

  const variables: Array<{ symbol: string; definition: string }> = [];
  for (const part of matched) {
    const inner = part.replace(/[OΩΘ]\(/, '').replace(/\)$/, '');
    const symbols = inner.split(/[\s,]+/).filter((s) => s.length > 0 && !/^\d+$/.test(s));
    for (const sym of symbols) {
      if (!variables.find((v) => v.symbol === sym)) {
        variables.push({
          symbol: sym,
          definition: `${sym}: size of the relevant input or collection`,
        });
      }
    }
  }
  return variables;
}

// ============================================================
// Verdict Normalization
// ============================================================

function normalizeVerdict(source: unknown): { status: VerdictStatus; explanation: string } {
  const input = getSafeObject(source);

  if (isObject(input) && 'status' in input && 'explanation' in input) {
    try {
      return VerdictSchema.parse(input);
    } catch {
      // fall through
    }
  }

  const status = sanitizeEnum(
    input.status,
    VerdictStatusSchema.options,
    'requires-changes'
  );

  const explanation = getSafeString(
    input.explanation ?? input.summary,
    'Verdict based on code analysis.'
  );

  return { status, explanation };
}

// ============================================================
// ImprovedCode Normalization
// ============================================================

function normalizeImprovedCode(source: unknown): ImprovedCode {
  const input = getSafeObject(source);

  if (isObject(input) && 'available' in input) {
    try {
      return ImprovedCodeSchema.parse(input);
    } catch {
      // fall through
    }
  }

  const code = getSafeString(input.code ?? input.improved_code);
  const notes = getSafeString(input.notes);

  if (code.length > 0) {
    return {
      available: true,
      code,
      notes: notes || 'Improved code provided.',
    };
  }

  return {
    available: false,
    code: null,
    notes: notes || 'No improved code available from context.',
  };
}

// ============================================================
// Finding Normalization (with validated mechanisms)
// ============================================================

function normalizeFinding(finding: unknown, index: number, usedIds: Set<string>): AuditFinding {
  const f = getSafeObject(finding);

  const evidenceList = getSafeArray<unknown>(f.evidence, []);
  const normalizedEvidence = evidenceList.map((e: unknown) => {
    const ev = getSafeObject(e);
    let startLine = typeof ev.startLine === 'number' ? ev.startLine : (typeof ev.line === 'number' ? ev.line : 1);
    let endLine = typeof ev.endLine === 'number' ? ev.endLine : startLine;
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

  let testToReproduce = null;
  const testRaw = f.testToReproduce ?? f.test;
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

  let id = getSafeString(f.id, `F-${String(index + 1).padStart(3, '0')}`);
  if (!/^F-\d{3,}$/.test(id)) {
    id = `F-${String(index + 1).padStart(3, '0')}`;
  }
  let counter = 1;
  let finalId = id;
  while (usedIds.has(finalId)) {
    const numericPart = id.replace('F-', '');
    const baseNum = parseInt(numericPart, 10) || 0;
    finalId = `F-${String(baseNum + counter).padStart(3, '0')}`;
    counter++;
  }
  usedIds.add(finalId);

  const legacyCategory = getSafeString(f.category ?? f.type, 'other');
  const broadCategory = mapToBroadCategory(legacyCategory);
  
  // Extract and validate mechanisms
  const rawMechanisms = extractMechanisms(f);
  const validMechanisms: Mechanism[] = rawMechanisms
    .filter((m): m is Mechanism => {
      const result = MechanismSchema.safeParse(m);
      return result.success;
    });

  return {
    id: finalId,
    title: getSafeString(f.title, getSafeString(f.name, 'Untitled Finding')),
    category: broadCategory,
    mechanisms: validMechanisms,
    severity: sanitizeEnum(
      f.severity ?? f.priority,
      SeveritySchema.options,
      'medium'
    ),
    confidence: sanitizeEnum(
      f.confidence,
      ConfidenceSchema.options,
      'conditional'
    ),
    evidence: normalizedEvidence,
    executionPath: getStringArray(f.executionPath) || getStringArray(f.path) || [],
    triggerConditions: getStringArray(f.triggerConditions) || getStringArray(f.conditions) || [],
    consequence: getSafeString(f.consequence, getSafeString(f.impact, getSafeString(f.effect, ''))),
    technicalExplanation: getSafeString(f.technicalExplanation, getSafeString(f.details, '')),
    remediation: getSafeString(f.remediation, getSafeString(f.fix, getSafeString(f.solution, ''))),
    relatedSymbols: getStringArray(f.relatedSymbols) || getStringArray(f.symbols) || [],
    testToReproduce,
  };
}

function mapToBroadCategory(legacy: string): AuditFinding['category'] {
  const mapping: Record<string, any> = {
    'liveness': 'concurrency',
    'thread-starvation': 'concurrency',
    'deadlock': 'concurrency',
    'race-condition': 'concurrency',
    'duplicate-submission': 'concurrency',
    'queue-misuse': 'concurrency',
    'race condition': 'concurrency',
    'shared-state': 'concurrency',
    'shared state': 'concurrency',
    'configuration': 'configuration',
    'resource-lifecycle': 'resource-management',
    'resource lifecycle': 'resource-management',
    'resource leak': 'resource-management',
    'timeout': 'error-handling',
    'interruption': 'error-handling',
    'cancellation': 'error-handling',
    'retry': 'error-handling',
    'error-handling': 'error-handling',
    'api-semantics': 'api-design',
    'api-design': 'api-design',
    'performance': 'performance',
    'security': 'security',
    'maintainability': 'maintainability',
    'architectural-duplication': 'architecture',
  };
  return mapping[legacy] || 'other';
}

/**
 * Extract mechanism strings from a finding, then filter to only those valid.
 */
function extractMechanisms(finding: Record<string, unknown>): string[] {
  const mechanisms: string[] = [];
  const legacyCategory = getSafeString(finding.category ?? finding.type);

  const mechanismMapping: Record<string, string[]> = {
    'deadlock': ['deadlock'],
    'thread-starvation': ['thread-starvation'],
    'race-condition': ['race-condition'],
    'race condition': ['race-condition'],
    'duplicate-submission': ['duplicate-submission'],
    'queue-misuse': ['queue-misuse'],
    'blocking-wait': ['blocking-wait'],
    'shared-state': ['shared-state'],
    'shared state': ['shared-state'],
    'configuration': ['configuration-collision'],
    'resource-lifecycle': ['resource-leak'],
    'resource lifecycle': ['resource-leak'],
    'timeout': ['timeout-misuse'],
    'interruption': ['interruption-loss'],
    'cancellation': ['cancellation-failure'],
    'retry': ['retry-amplification'],
  };

  const fromCategory = mechanismMapping[legacyCategory] || [];
  mechanisms.push(...fromCategory);

  const explicit = getSafeArray(finding.mechanisms, []);
  for (const m of explicit) {
    if (typeof m === 'string' && !mechanisms.includes(m)) {
      mechanisms.push(m);
    }
  }

  return mechanisms;
}

// ============================================================
// Execution Overview Normalization
// ============================================================

function normalizeExecutionOverview(source: unknown): ExecutionOverview {
  const input = getSafeObject(source);
  return {
    entryPoints: getStringArray(input.entryPoints),
    taskSubmissionPoints: getStringArray(input.taskSubmissionPoints),
    blockingWaitPoints: getStringArray(input.blockingWaitPoints),
    sharedResources: getStringArray(input.sharedResources),
    resourceLifecycle: getStringArray(input.resourceLifecycle),
  };
}

// ============================================================
// Architectural Observations Normalization
// ============================================================

function normalizeArchitecturalObservations(
  source: unknown,
  findingIds: Set<string>
): ArchitecturalObservation[] {
  const arr = getSafeArray<unknown>(source, []);
  return arr
    .map((obs: unknown) => {
      const o = getSafeObject(obs);
      const title = getSafeString(o.title, '');
      const explanation = getSafeString(o.explanation, '');
      const relatedFindingIds = getStringArray(o.relatedFindingIds).filter((id) => findingIds.has(id));
      return { title, explanation, relatedFindingIds };
    })
    .filter((obs) => obs.title.length > 0 || obs.explanation.length > 0);
}

// ============================================================
// Recommended Actions Normalization
// ============================================================

function normalizeRecommendedActions(
  source: unknown,
  findingIds: Set<string>
): Array<{ priority: number; severity: any; title: string; action: string; relatedFindingIds: string[] }> {
  const arr = getSafeArray<unknown>(source, []);
  return arr
    .map((act: unknown) => {
      const a = getSafeObject(act);
      let priority = typeof a.priority === 'number' && a.priority > 0 ? Math.round(a.priority) : 1;
      const severity = sanitizeEnum(a.severity, SeveritySchema.options, 'medium');
      const title = getSafeString(a.title, '');
      const action = getSafeString(a.action, '');
      const relatedFindingIds = getStringArray(a.relatedFindingIds).filter((id) => findingIds.has(id));
      return { priority, severity, title, action, relatedFindingIds };
    })
    .filter((act) => act.title.length > 0 || act.action.length > 0)
    .sort((a, b) => a.priority - b.priority)
    .map((act, index) => ({ ...act, priority: index + 1 }));
}

// ============================================================
// Suggested Tests Normalization
// ============================================================

function normalizeSuggestedTests(
  source: unknown,
  findingIds: Set<string>
): SuggestedTest[] {
  const arr = getSafeArray<unknown>(source, []);
  return arr
    .map((test: unknown) => {
      const t = getSafeObject(test);
      const title = getSafeString(t.title, getSafeString(t.name, ''));
      const purpose = getSafeString(t.purpose, '');
      const setup = getStringArray(t.setup) || [];
      const steps = getStringArray(t.steps) || [];
      const expectedResult = getSafeString(t.expectedResult, getSafeString(t.expectedOutput, ''));
      const relatedFindingIds = getStringArray(t.relatedFindingIds).filter((id) => findingIds.has(id));
      return { title, purpose, setup, steps, expectedResult, relatedFindingIds };
    })
    .filter((test) => test.title.length > 0 || test.purpose.length > 0);
}

// ============================================================
// Language Normalization
// ============================================================

function normalizeLanguage(source: unknown): string {
  return getSafeString(source, 'unknown');
}

function normalizeResponseLanguage(source: unknown): 'English' | 'Persian' | null {
  const value = getSafeString(source);
  if (value === 'English' || value === 'Persian') {
    return value;
  }
  return null;
}

// ============================================================
// Main Normalizer
// ============================================================

export function normalizeAnalysisOutput(raw: unknown): AdvancedAuditResult {
  const startTime = Date.now();
  logger.debug('[Normalizer] Starting normalization');

  const input = getSafeObject(raw);

  const summary = getSafeString(input.summary, getSafeString(input.highLevelSummary, 'No summary provided.'));
  const title = normalizeTitle(input.title, summary);
  const completionStatus = normalizeCompletionStatus(input.status ?? input.completionStatus);
  const repairApplied = normalizeRepairApplied(input.repairApplied ?? false);
  const appliedSpecializations = normalizeAppliedSpecializations(
    input.appliedSpecializations ?? input.specializations ?? []
  );

  const language = normalizeLanguage(input.language);
  const responseLanguage = normalizeResponseLanguage(input.responseLanguage);

  const findingsSource =
    input.findings ??
    input.issues ??
    input.advancedFindings ??
    input.concurrencyFindings ??
    (isObject(input.analysis) ? input.analysis.findings : undefined);

  const findingsArray = getSafeArray<unknown>(findingsSource, []);
  const usedIds = new Set<string>();

  const normalizedFindings: AuditFinding[] = findingsArray
    .map((f: unknown, index: number) => normalizeFinding(f, index, usedIds))
    .filter((finding) => finding.title.trim().length > 0 || finding.evidence.length > 0);

  const findingIds = new Set(normalizedFindings.map((f) => f.id));

  const scorecardSource = getSafeObject(
    input.scorecard ??
    input.scorecard_new ??
    input.scorecardLegacy ??
    {}
  );
  const scorecard = normalizeScorecard(scorecardSource);

  const verdictSource = getSafeObject(input.verdict ?? input.finalVerdict ?? {});
  const verdict = normalizeVerdict(verdictSource);

  const complexitySource = getSafeObject(input.complexity ?? {});
  const complexity = normalizeComplexity(complexitySource);

  const improvedCodeSource = getSafeObject(
    input.improvedCode ??
    input.improved_code ??
    {}
  );
  const improvedCode = normalizeImprovedCode(improvedCodeSource);

  const executionOverviewSource = getSafeObject(
    input.executionOverview ??
    input.execution_overview ??
    input.overview ??
    {}
  );
  const executionOverview = normalizeExecutionOverview(executionOverviewSource);

  const architecturalObservations = normalizeArchitecturalObservations(
    input.architecturalObservations ?? input.architectural_observations,
    findingIds
  );

  const recommendedActions = normalizeRecommendedActions(
    input.recommendedActions ?? input.recommended_actions,
    findingIds
  );

  const suggestedTests = normalizeSuggestedTests(
    input.suggestedTests ??
    input.suggested_tests ??
    input.suggestedTestsNew ??
    input.suggested_tests_new,
    findingIds
  );

  const limitations = getStringArray(input.limitations);

  let linkedinPost =
    typeof input.linkedin_post === 'string'
      ? input.linkedin_post.trim()
      : typeof input.linkedinPost === 'string'
        ? input.linkedinPost.trim()
        : '';

  if (!linkedinPost) {
    linkedinPost = DEFAULT_LINKEDIN_POST;
  }

  const analysisCoverage = normalizeAnalysisCoverage(
    input.analysisCoverage ?? input.coverage ?? {}
  );

  const result: AdvancedAuditResult = {
    schemaVersion: '1.0',
    auditType: 'comprehensive',
    appliedSpecializations,
    completionStatus,
    repairApplied,
    title,
    language,
    responseLanguage,
    analysisCoverage,
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
    improvedCode,
    linkedin_post: linkedinPost,
  };

  try {
    const validated = AdvancedAuditResultSchema.parse(result);
    const duration = Date.now() - startTime;
    logger.debug('[Normalizer] Completed in', duration, 'ms, findings:', normalizedFindings.length);
    return validated;
  } catch (error) {
    logger.error('[Normalizer] Schema validation failed:', error);
    return result;
  }
}