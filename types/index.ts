// types/index.ts

// ============================================================
// 1. Import Zod for runtime schemas
// ============================================================

import { z } from 'zod';

// ============================================================
// 2. Canonical runtime schemas (from schema.ts)
// ============================================================

import {
  AdvancedAuditResultSchema,
  AuditFindingSchema,
  AuditScorecardSchema,
  VerdictSchema as CanonicalVerdictSchema,
  RecommendedActionSchema,
  ComplexitySchema,
  ArchitecturalObservationSchema,
  SuggestedTestSchema,
  ExecutionOverviewSchema,
} from '@/lib/analysis/schema';

// ============================================================
// 3. Canonical types (import type, then re-export)
// ============================================================

import type {
  AdvancedAuditResult,
  AuditFinding,
  AuditScorecard,
  VerdictStatus,
  Severity,
  Confidence,
  FindingCategory,
  EvidenceItem,
  ScoreItem,
  ImprovedCode,
  RecommendedAction,
  Complexity,
  AnalysisCoverageItem,
  ArchitecturalObservation,
  SuggestedTest,
  ExecutionOverview,
} from '@/lib/analysis/types';

// Re-export canonical types from the type-only gateway
export type {
  AdvancedAuditResult,
  AuditFinding,
  AuditScorecard,
  VerdictStatus,
  Severity,
  Confidence,
  FindingCategory,
  EvidenceItem,
  ScoreItem,
  ImprovedCode,
  RecommendedAction,
  Complexity,
  AnalysisCoverageItem,
  ArchitecturalObservation,
  SuggestedTest,
  ExecutionOverview,
};

// ============================================================
// 4. AnalysisMode – UI contract, not canonical
// ============================================================

export type AnalysisMode = 'simple' | 'medium' | 'advanced';

// Runtime schema for AnalysisMode (used at API boundary)
export const AnalysisModeSchema = z.enum(['simple', 'medium', 'advanced']);

// ============================================================
// 5. GenerateRequest – runtime schema and derived type
// ============================================================

export const GenerateRequestSchema = z.object({
  code: z.string().min(1),
  language: z.string().min(1),
  mode: AnalysisModeSchema,
});

// Derive the request type from the runtime schema
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

// ============================================================
// 6. PromptInfo – derived from canonical metadata
// ============================================================

export interface PromptInfo {
  /** UI mode selected when this analysis was run */
  mode: AnalysisMode;
  /** Canonical audit type (currently always 'comprehensive') */
  auditType: AdvancedAuditResult['auditType'];
  /** Specializations applied during analysis */
  appliedSpecializations: AdvancedAuditResult['appliedSpecializations'];
  /** Whether the canonical output was fully completed (not pipeline execution) */
  completionStatus: AdvancedAuditResult['completionStatus'];
  /** Whether repair logic was applied to the final result */
  repairApplied: AdvancedAuditResult['repairApplied'];
  /**
   * Internal pipeline execution status.
   * Actual values from implementation (verified in pipeline.ts):
   * - 'completed' | 'failed' | 'fallback'
   */
  pipelineStatus: 'completed' | 'failed' | 'fallback';
}

// ============================================================
// 7. Legacy persisted schemas (historical data only)
// ============================================================

const LegacyCodeWalkthroughItemSchema = z.object({
  section: z.string(),
  explanation: z.string(),
});

const LegacyBugAndRiskyCaseSchema = z.object({
  issue: z.string(),
  impact: z.string(),
  example: z.string().optional(),
});

const LegacyEdgeCaseSchema = z.object({
  case: z.string(),
  currentBehavior: z.string(),
  expectedBehavior: z.string(),
  risk: z.enum(['Low', 'Medium', 'High']),
});

const LegacyPerformanceAnalysisSchema = z.object({
  timeComplexity: z.array(z.object({
    target: z.string(),
    complexity: z.string(),
    explanation: z.string(),
  })),
  spaceComplexity: z.array(z.object({
    target: z.string(),
    complexity: z.string(),
    explanation: z.string(),
  })),
  scalabilityNotes: z.array(z.string()),
});

const LegacySecurityAnalysisSchema = z.object({
  issues: z.array(z.string()),
  recommendations: z.array(z.string()),
  severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
});

const LegacyProductionReadinessSchema = z.object({
  isProductionReady: z.boolean(),
  reasons: z.array(z.string()),
  requiredChanges: z.array(z.string()),
});

const LegacyRecommendedImprovementSchema = z.object({
  priority: z.enum(['High', 'Medium', 'Low']),
  improvement: z.string(),
  reason: z.string(),
});

const LegacySuggestedTestSchema = z.object({
  name: z.string(),
  input: z.string(),
  expectedOutput: z.string(),
  type: z.enum(['Normal', 'Edge', 'Invalid']),
});

const LegacyScorecardSchema = z.object({
  correctness: z.number().min(0).max(10),
  readability: z.number().min(0).max(10),
  performance: z.number().min(0).max(10),
  maintainability: z.number().min(0).max(10),
  productionReadiness: z.number().min(0).max(10),
  security: z.number().min(0).max(10).optional(),
  overall: z.number().min(0).max(10).optional(),
});

// ============================================================
// 8. SnippetDataSchema – persistence contract
// ============================================================

/**
 * Persistence model for Supabase snippets table.
 * Database column names are snake_case.
 * JSONB values must match canonical camelCase schemas (no automatic transformation).
 * Unknown columns are stripped by z.object() (intentional).
 *
 * This schema is used to parse raw rows from Supabase.
 * It is not the normalized Domain model; see PersistedSnippetRow below.
 *
 * Note: All fields use .optional() instead of .nullable().optional() because
 * the application normalizes null values from the database to undefined.
 * The conversion from null to undefined happens in app/snippet/[slug]/page.tsx
 * using the `?? undefined` operator.
 */
export const SnippetDataSchema = z.object({
  // Primary identifiers
  id: z.string(),
  slug: z.string(),
  raw_code: z.string(),
  language: z.string(),

  // Display fields
  card_title: z.string(),
  key_concept: z.string(),
  what_this_code_does: z.string(),
  debug_analysis: z.string(),
  optimization: z.string(),
  linkedin_post: z.string(),

  // Metadata
  is_public: z.boolean(),
  created_at: z.string(),

  // User info
  username: z.string().optional(),
  github_username: z.string().optional(),
  avatar_url: z.string().optional(),
  card_image_url: z.string().optional(),

  // ===== Legacy fields (historical rows) =====
  // 🔥 تمام .nullable() حذف شد – فقط .optional()
  code_walkthrough: z.array(LegacyCodeWalkthroughItemSchema).optional(),
  what_works_well: z.array(z.string()).optional(),
  bugs_and_risky_cases: z.array(LegacyBugAndRiskyCaseSchema).optional(),
  edge_cases: z.array(LegacyEdgeCaseSchema).optional(),
  performance_analysis: LegacyPerformanceAnalysisSchema.optional(),
  security_analysis: LegacySecurityAnalysisSchema.optional(),
  production_readiness: LegacyProductionReadinessSchema.optional(),
  recommended_improvements: z.array(LegacyRecommendedImprovementSchema).optional(),
  improved_code: z.string().optional(),
  suggested_tests: z.array(LegacySuggestedTestSchema).optional(),
  scorecard: LegacyScorecardSchema.optional(),
  final_verdict_summary: z.string().optional(),
  final_verdict_approved: z.boolean().optional(),
  final_verdict_next_steps: z.string().optional(),

  // ===== Line explanations (deferred) =====
  // Raw persisted value. Must be normalized via normalizeLineExplanations().
  // Structure: array of { lineNumber, code?, explanation }.
  // See lib/analysis/normalizer.ts for the normalization boundary.
  line_explanations: z.unknown().optional(),

  // ===== Generated prompt (simple string) =====
  generated_prompt: z.string().optional(),

  // ===== Canonical fields (JSONB) =====
  // These store the canonical audit data in snake_case columns.
  // The schemas validate parsed camelCase objects.
  // Precedence: audit_result > exploded fields (enforced by to-snippet.ts).
  // If audit_result is valid and present, it overrides exploded fields.
  findings: z.array(AuditFindingSchema).optional(),
  execution_overview: ExecutionOverviewSchema.optional(),
  architectural_observations: z.array(ArchitecturalObservationSchema).optional(),
  recommended_actions: z.array(RecommendedActionSchema).optional(),
  suggested_tests_new: z.array(SuggestedTestSchema).optional(),
  complexity: ComplexitySchema.optional(),
  scorecard_new: AuditScorecardSchema.optional(),
  verdict: CanonicalVerdictSchema.optional(),
  limitations: z.array(z.string()).optional(),

  // ===== Full canonical audit result =====
  // Authoritative source. Exploded fields are transitional projections.
  // Mapper implementation: lib/analysis/to-snippet.ts (toSnippetInsert)
  // Precedence logic: if audit_result is valid, use it; otherwise fall back to exploded fields.
  audit_result: AdvancedAuditResultSchema.optional(),

  // ===== Debug/diagnostic (unstructured) =====
  debug_trace: z.unknown().optional(),
});

// Persistence row type (raw Supabase row)
export type PersistedSnippetRow = z.infer<typeof SnippetDataSchema>;

/**
 * @deprecated This is a raw transitional Supabase row, not the normalized Domain model.
 * Use PersistedSnippetRow for explicit persistence boundaries.
 * The normalized Domain model is AdvancedAuditResult (from the canonical schema).
 */
export type Snippet = PersistedSnippetRow;

// ============================================================
// 9. Legacy generate response (historical API shape)
// ============================================================

/**
 * Runtime schema for the legacy generate API response.
 * Used to validate incoming responses at the service boundary.
 * This schema is strictly legacy; no canonical shapes are allowed.
 */
export const LegacyGenerateResponseSchema = z.object({
  analysis: z.string().optional(),
  card_title: z.string().optional(),
  key_concept: z.string().optional(),
  what_this_code_does: z.string().optional(),
  debug_analysis: z.string().optional(),
  optimization: z.string().optional(),
  codeWalkthrough: z.array(LegacyCodeWalkthroughItemSchema).optional(),
  whatWorksWell: z.array(z.string()).optional(),
  bugsAndRiskyCases: z.array(LegacyBugAndRiskyCaseSchema).optional(),
  edgeCases: z.array(LegacyEdgeCaseSchema).optional(),
  performanceAnalysis: LegacyPerformanceAnalysisSchema.optional(),
  securityAnalysis: LegacySecurityAnalysisSchema.optional(),
  productionReadiness: LegacyProductionReadinessSchema.optional(),
  recommendedImprovements: z.array(LegacyRecommendedImprovementSchema).optional(),
  improvedCode: z.object({
    available: z.boolean(),
    code: z.string(),
    notes: z.string(),
  }).optional(),
  suggestedTests: z.array(LegacySuggestedTestSchema).optional(),
  scorecard: LegacyScorecardSchema.optional(),
  finalVerdict: z.object({
    summary: z.string(),
    approved: z.boolean(),
    nextSteps: z.string().optional(),
  }).optional(),
  linkedin_post: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Legacy generate response type (derived from runtime schema).
 * Models the actual current API response from /api/generate.
 *
 * Verified wire keys from repository search:
 * - analysis, card_title, key_concept, what_this_code_does, debug_analysis, optimization
 * - codeWalkthrough, whatWorksWell, bugsAndRiskyCases, edgeCases
 * - performanceAnalysis, securityAnalysis, productionReadiness
 * - recommendedImprovements, improvedCode
 * - suggestedTests, scorecard
 * - linkedin_post, finalVerdict, error
 */
export type LegacyGenerateResponse = z.infer<typeof LegacyGenerateResponseSchema>;

// ============================================================
// 10. CreateSnippetResponse (discriminated union)
// ============================================================

export type CreateSnippetResponse =
  | {
      success: true;
      id: string;
      slug: string;
      url: string;
      username?: string | null;
      github_username?: string | null;
    }
  | {
      success: false;
      error: string;
    };

// ============================================================
// 11. Legacy types (exported for historical data access only)
// ============================================================

export type LegacyCodeWalkthroughItem = z.infer<typeof LegacyCodeWalkthroughItemSchema>;
export type LegacyBugAndRiskyCase = z.infer<typeof LegacyBugAndRiskyCaseSchema>;
export type LegacyEdgeCase = z.infer<typeof LegacyEdgeCaseSchema>;
export type LegacyPerformanceAnalysis = z.infer<typeof LegacyPerformanceAnalysisSchema>;
export type LegacySecurityAnalysis = z.infer<typeof LegacySecurityAnalysisSchema>;
export type LegacyProductionReadiness = z.infer<typeof LegacyProductionReadinessSchema>;
export type LegacyRecommendedImprovement = z.infer<typeof LegacyRecommendedImprovementSchema>;
export type LegacySuggestedTest = z.infer<typeof LegacySuggestedTestSchema>;
export type LegacyScorecard = z.infer<typeof LegacyScorecardSchema>;
export interface LegacyImprovedCode {
  available: boolean;
  code: string;
  notes: string;
}

// ============================================================
// 12. UI State contracts
// ============================================================

export interface LineExplanation {
  lineNumber: number;
  code?: string;
  explanation: string;
}

export interface ModeOutput {
  snippet: PersistedSnippetRow | null;
  fullAnalysis: LegacyGenerateResponse | null;
  lineExplanations: LineExplanation[];
  generatedPrompt: string;
}

export type OutputsByMode = {
  [K in AnalysisMode]: ModeOutput;
};

export interface AppState {
  code: string;
  language: string;
  mode: AnalysisMode;
  loading: boolean;
  isConverting: boolean;
  isExplaining: boolean;
  isGeneratingPrompt: boolean;
  errorMessage: string | null;
  convertError: string | null;
  explainError: string | null;
  promptError: string | null;
  outputs: OutputsByMode;
  username: string;
  githubUsername: string;
  avatarUrl: string | null;
  convertLanguage: string;
  hoveredLine: number | null;
  toastMessage: string | null;
  promptInfo: PromptInfo | null;
}

// ============================================================
// 13. Future canonical API contract (not yet active)
// ============================================================

/**
 * Target API contract for the canonical analysis pipeline.
 * Not currently used; the active contract is LegacyGenerateResponse.
 *
 * When activated, define a z.discriminatedUnion runtime schema and derive
 * the TypeScript type from it.
 * Migrate route, service, state, UI, tests, mocks, and fixtures atomically.
 */
export type CanonicalGenerateResponse =
  | {
      success: true;
      data: AdvancedAuditResult;
    }
  | {
      success: false;
      error: string;
      code?: string;
    };