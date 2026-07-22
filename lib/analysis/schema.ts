// lib/analysis/schema.ts

import { z } from 'zod';

// ============================================================
// ENUMS
// ============================================================

export const SeveritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
  'info',
]);

export const ConfidenceSchema = z.enum([
  'definite',
  'likely',
  'conditional',
]);

export const FindingCategorySchema = z.enum([
  'liveness',
  'thread-starvation',
  'deadlock',
  'queue-misuse',
  'duplicate-submission',
  'race-condition',
  'shared-state',
  'configuration',
  'resource-lifecycle',
  'timeout',
  'interruption',
  'cancellation',
  'retry',
  'error-handling',
  'architectural-duplication',
  'api-semantics',
  'performance',
  'security',
  'maintainability',
  'other',
]);

export const AuditTypeSchema = z.enum(['generic', 'concurrency']);

export const AuditStatusSchema = z.enum([
  'complete',
  'repaired',
  'partially_complete',
  'failed_validation',
]);

export const VerdictStatusSchema = z.enum([
  'not-production-ready',
  'requires-major-changes',
  'requires-changes',
  'requires-minor-changes',
  'approved-with-suggestions',
  'approved',
]);

// ============================================================
// REUSABLE ID SCHEMA (MISSING PREVIOUSLY)
// ============================================================

export const FindingIdSchema = z.string().regex(/^F-\d{3,}$/, 'Finding ID must match F-XXX');

// ============================================================
// NESTED SCHEMAS
// ============================================================

export const EvidenceItemSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  code: z.string().min(1, 'Evidence code must not be empty'),
  explanation: z.string().min(1, 'Evidence explanation must not be empty'),
}).refine((data) => data.endLine >= data.startLine, {
  message: 'endLine must be >= startLine',
});

export const AuditFindingSchema = z.object({
  id: FindingIdSchema,
  title: z.string().min(1, 'Finding title must not be empty'),
  category: FindingCategorySchema,
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceItemSchema).min(1, 'Finding must have at least one evidence item'),
  executionPath: z.array(z.string().min(1)).min(1, 'Execution path must have at least one step'),
  triggerConditions: z.array(z.string().min(1)).min(1, 'Trigger conditions must have at least one condition'),
  consequence: z.string().min(1, 'Consequence must not be empty'),
  technicalExplanation: z.string().min(1, 'Technical explanation must not be empty'),
  remediation: z.string().min(1, 'Remediation must not be empty'),
  relatedSymbols: z.array(z.string()).default([]),
  testToReproduce: z.object({
    title: z.string().min(1),
    setup: z.array(z.string()),
    steps: z.array(z.string()).min(1),
    expectedResult: z.string().min(1),
  }).nullable(),
});

// ============================================================
// SCORECARD
// ============================================================

export const ScoreItemSchema = z.object({
  score: z.number().int().min(0).max(100),
  reason: z.string().min(1, 'Reason must not be empty'),
  relatedFindings: z.array(z.string()).default([]),
});

export const AuditScorecardSchema = z.object({
  correctness: ScoreItemSchema,
  concurrencySafety: ScoreItemSchema,
  liveness: ScoreItemSchema,
  errorHandling: ScoreItemSchema,
  resourceManagement: ScoreItemSchema,
  maintainability: ScoreItemSchema,
  productionReadiness: ScoreItemSchema,
});

// ============================================================
// IMPROVED CODE
// ============================================================

export const ImprovedCodeSchema = z.object({
  available: z.boolean(),
  code: z.string().nullable().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.available && !data.code) return false;
  return true;
}, { message: 'available must be true only when code is non-empty' });

// ============================================================
// RECOMMENDED ACTION
// ============================================================

export const RecommendedActionSchema = z.object({
  priority: z.number().int().positive(),
  severity: SeveritySchema,
  title: z.string().min(1),
  action: z.string().min(1),
  relatedFindingIds: z.array(z.string()).default([]),
});

// ============================================================
// TOP-LEVEL CANONICAL SCHEMA
// ============================================================

export const AdvancedAuditResultSchema = z.object({
  schemaVersion: z.literal('1.0'),
  auditType: AuditTypeSchema,
  status: AuditStatusSchema,
  language: z.string().min(1, 'Language must not be empty'),
  summary: z.string().min(1, 'Summary must not be empty'),

  executionOverview: z.object({
    entryPoints: z.array(z.string()).default([]),
    taskSubmissionPoints: z.array(z.string()).default([]),
    blockingWaitPoints: z.array(z.string()).default([]),
    sharedResources: z.array(z.string()).default([]),
    resourceLifecycle: z.array(z.string()).default([]),
  }),

  findings: z.array(AuditFindingSchema).default([]),

  architecturalObservations: z.array(
    z.object({
      title: z.string().min(1),
      explanation: z.string().min(1),
      relatedFindingIds: z.array(z.string()).default([]),
    })
  ).default([]),

  recommendedActions: z.array(RecommendedActionSchema).default([]),

  suggestedTests: z.array(
    z.object({
      title: z.string().min(1),
      purpose: z.string().min(1),
      setup: z.array(z.string()).default([]),
      steps: z.array(z.string()).min(1),
      expectedResult: z.string().min(1),
    })
  ).default([]),

  complexity: z.object({
    time: z.string().min(1),
    space: z.string().min(1),
    resourceGrowth: z.string().min(1),
    assumptions: z.array(z.string()).default([]),
  }),

  scorecard: AuditScorecardSchema,

  verdict: z.object({
    status: VerdictStatusSchema,
    explanation: z.string().min(1, 'Verdict explanation must not be empty'),
  }),

  limitations: z.array(z.string().min(1)).default([]),

  improvedCode: ImprovedCodeSchema,

  linkedin_post: z.string().trim().min(1, 'LinkedIn post must not be empty').max(300, 'LinkedIn post must be at most 300 characters'),
}).strict();

// ============================================================
// INFERRED TYPE
// ============================================================

export type AdvancedAuditResult = z.infer<typeof AdvancedAuditResultSchema>;

// ============================================================
// RE-EXPORT ENUM TYPES
// ============================================================

export type Severity = z.infer<typeof SeveritySchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type FindingCategory = z.infer<typeof FindingCategorySchema>;
export type AuditType = z.infer<typeof AuditTypeSchema>;
export type AuditStatus = z.infer<typeof AuditStatusSchema>;
export type VerdictStatus = z.infer<typeof VerdictStatusSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type AuditFinding = z.infer<typeof AuditFindingSchema>;
export type AuditScorecard = z.infer<typeof AuditScorecardSchema>;
export type ImprovedCode = z.infer<typeof ImprovedCodeSchema>;
export type RecommendedAction = z.infer<typeof RecommendedActionSchema>;
export type ScoreItem = z.infer<typeof ScoreItemSchema>;