// lib/analysis/schema.ts

import { z } from 'zod';

// ============================================================
// 1. REUSABLE ENUM SCHEMAS
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

export const AuditTypeSchema = z.enum([
  'generic',
  'concurrency',
]);

// Statuses used by the current pipeline.
// 'failed_validation' indicates a validation failure that cannot be repaired.
// 'partially_complete' is used when repair produced a partial result.
export const AuditStatusSchema = z.enum([
  'complete',
  'repaired',
  'partially_complete',
  'failed_validation',
]);

export const VerdictStatusSchema = z.enum([
  'not-production-ready',
  'requires-major-changes',
  'requires-minor-changes',
  'production-ready-with-monitoring',
]);

// ============================================================
// 2. REUSABLE ID SCHEMA
// ============================================================

export const FindingIdSchema = z
  .string()
  .regex(/^F-\d{3,}$/, 'Finding ID must start with "F-" followed by at least 3 digits');

// ============================================================
// 3. NESTED SCHEMAS
// ============================================================

export const EvidenceItemSchema = z
  .object({
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
    code: z.string().trim().min(1, 'Evidence code must not be empty'),
    explanation: z.string().trim().min(1, 'Evidence explanation must not be empty'),
  })
  .refine((data) => data.endLine >= data.startLine, {
    message: 'endLine must be >= startLine',
  });

export const AuditFindingSchema = z.object({
  id: FindingIdSchema,
  title: z.string().trim().min(1, 'Finding title must not be empty'),
  category: FindingCategorySchema,
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceItemSchema).min(1, 'Finding must have at least one evidence item'),
  executionPath: z.array(z.string().trim().min(1)).min(1, 'Execution path must have at least one step'),
  triggerConditions: z.array(z.string().trim().min(1)).min(1, 'Trigger conditions must have at least one condition'),
  consequence: z.string().trim().min(1, 'Consequence must not be empty'),
  technicalExplanation: z.string().trim().min(1, 'Technical explanation must not be empty'),
  remediation: z.string().trim().min(1, 'Remediation must not be empty'),
  relatedSymbols: z.array(z.string().trim().min(1)),
  testToReproduce: z
    .object({
      title: z.string().trim().min(1, 'Test title must not be empty'),
      setup: z.array(z.string().trim().min(1)),
      steps: z.array(z.string().trim().min(1)).min(1, 'Test steps must have at least one step'),
      expectedResult: z.string().trim().min(1, 'Expected result must not be empty'),
    })
    .nullable(),
});

export const AuditScorecardSchema = z.object({
  correctness: z.number().min(0).max(10),
  concurrencySafety: z.number().min(0).max(10),
  liveness: z.number().min(0).max(10),
  errorHandling: z.number().min(0).max(10),
  resourceManagement: z.number().min(0).max(10),
  maintainability: z.number().min(0).max(10),
  productionReadiness: z.number().min(0).max(10),
});

// ============================================================
// 4. TOP-LEVEL CANONICAL SCHEMA
// ============================================================

export const AdvancedAuditResultSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    auditType: AuditTypeSchema,
    status: AuditStatusSchema,
    language: z.string().trim().min(1, 'Language must not be empty'),
    summary: z.string().trim().min(1, 'Summary must not be empty'),

    executionOverview: z.object({
      entryPoints: z.array(z.string().trim().min(1)),
      taskSubmissionPoints: z.array(z.string().trim().min(1)),
      blockingWaitPoints: z.array(z.string().trim().min(1)),
      sharedResources: z.array(z.string().trim().min(1)),
      resourceLifecycle: z.array(z.string().trim().min(1)),
    }),

    findings: z.array(AuditFindingSchema),

    architecturalObservations: z.array(
      z.object({
        title: z.string().trim().min(1, 'Architectural observation title must not be empty'),
        explanation: z.string().trim().min(1, 'Architectural observation explanation must not be empty'),
        relatedFindingIds: z.array(FindingIdSchema),
      })
    ),

    recommendedActions: z.array(
      z.object({
        priority: z.number().int().positive(),
        severity: SeveritySchema,
        title: z.string().trim().min(1, 'Recommended action title must not be empty'),
        action: z.string().trim().min(1, 'Recommended action description must not be empty'),
        relatedFindingIds: z.array(FindingIdSchema),
      })
    ),

    suggestedTests: z.array(
      z.object({
        title: z.string().trim().min(1, 'Suggested test title must not be empty'),
        purpose: z.string().trim().min(1, 'Suggested test purpose must not be empty'),
        setup: z.array(z.string().trim().min(1)),
        steps: z.array(z.string().trim().min(1)).min(1, 'Test steps must have at least one step'),
        expectedResult: z.string().trim().min(1, 'Expected result must not be empty'),
      })
    ),

    complexity: z.object({
      time: z.string().trim().min(1, 'Time complexity must not be empty'),
      space: z.string().trim().min(1, 'Space complexity must not be empty'),
      resourceGrowth: z.string().trim().min(1, 'Resource growth must not be empty'),
      assumptions: z.array(z.string().trim().min(1)),
    }),

    scorecard: AuditScorecardSchema,

    verdict: z.object({
      status: VerdictStatusSchema,
      explanation: z.string().trim().min(1, 'Verdict explanation must not be empty'),
    }),

    limitations: z.array(z.string().trim().min(1)),

    // Social post required for MVP; max length 300 as per UI/DB expectations.
    linkedin_post: z.string().trim().min(1, 'LinkedIn post must not be empty').max(300, 'LinkedIn post must be at most 300 characters'),
  })
  .strict(); // Reject any unknown top-level fields

// ============================================================
// 5. INFERRED TYPES (canonical source of truth)
// ============================================================

export type AdvancedAuditResult = z.infer<typeof AdvancedAuditResultSchema>;

// Also export nested types for convenience, if needed elsewhere.
export type Severity = z.infer<typeof SeveritySchema>;
export type Confidence = z.infer<typeof ConfidenceSchema>;
export type FindingCategory = z.infer<typeof FindingCategorySchema>;
export type AuditType = z.infer<typeof AuditTypeSchema>;
export type AuditStatus = z.infer<typeof AuditStatusSchema>;
export type VerdictStatus = z.infer<typeof VerdictStatusSchema>;
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type AuditFinding = z.infer<typeof AuditFindingSchema>;
export type AuditScorecard = z.infer<typeof AuditScorecardSchema>;