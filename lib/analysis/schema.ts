// ============================================================
// 📁 فایل: lib/analysis/schema.ts
// ============================================================
import { z } from 'zod';

const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);
const ConfidenceSchema = z.enum(['definite', 'likely', 'conditional']);
const FindingCategorySchema = z.enum([
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
const AuditTypeSchema = z.enum(['generic', 'concurrency']);
const AuditStatusSchema = z.enum([
  'complete',
  'repaired',
  'partially_complete',
  'failed_validation',
]);
const VerdictStatusSchema = z.enum([
  'not-production-ready',
  'requires-major-changes',
  'requires-minor-changes',
  'production-ready-with-monitoring',
]);

const EvidenceItemSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  code: z.string(),
  explanation: z.string(),
});

const AuditFindingSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: FindingCategorySchema,
  severity: SeveritySchema,
  confidence: ConfidenceSchema,
  evidence: z.array(EvidenceItemSchema),
  executionPath: z.array(z.string()),
  triggerConditions: z.array(z.string()),
  consequence: z.string(),
  technicalExplanation: z.string(),
  remediation: z.string(),
  relatedSymbols: z.array(z.string()),
  testToReproduce: z
    .object({
      title: z.string(),
      setup: z.array(z.string()),
      steps: z.array(z.string()),
      expectedResult: z.string(),
    })
    .nullable(),
});

const AuditScorecardSchema = z.object({
  correctness: z.number().min(0).max(10),
  concurrencySafety: z.number().min(0).max(10),
  liveness: z.number().min(0).max(10),
  errorHandling: z.number().min(0).max(10),
  resourceManagement: z.number().min(0).max(10),
  maintainability: z.number().min(0).max(10),
  productionReadiness: z.number().min(0).max(10),
});

export const AdvancedAuditResultSchema = z.object({
  schemaVersion: z.literal('1.0'),
  auditType: AuditTypeSchema,
  status: AuditStatusSchema,
  language: z.string(),
  summary: z.string(),
  executionOverview: z.object({
    entryPoints: z.array(z.string()),
    taskSubmissionPoints: z.array(z.string()),
    blockingWaitPoints: z.array(z.string()),
    sharedResources: z.array(z.string()),
    resourceLifecycle: z.array(z.string()),
  }),
  findings: z.array(AuditFindingSchema),
  architecturalObservations: z.array(
    z.object({
      title: z.string(),
      explanation: z.string(),
      relatedFindingIds: z.array(z.string()),
    })
  ),
  recommendedActions: z.array(
    z.object({
      priority: z.number().int().positive(),
      severity: SeveritySchema,
      title: z.string(),
      action: z.string(),
      relatedFindingIds: z.array(z.string()),
    })
  ),
  suggestedTests: z.array(
    z.object({
      title: z.string(),
      purpose: z.string(),
      setup: z.array(z.string()),
      steps: z.array(z.string()),
      expectedResult: z.string(),
    })
  ),
  complexity: z.object({
    time: z.string(),
    space: z.string(),
    resourceGrowth: z.string(),
    assumptions: z.array(z.string()),
  }),
  scorecard: AuditScorecardSchema,
  verdict: z.object({
    status: VerdictStatusSchema,
    explanation: z.string(),
  }),
  limitations: z.array(z.string()),
});

export type AdvancedAuditResult = z.infer<typeof AdvancedAuditResultSchema>;