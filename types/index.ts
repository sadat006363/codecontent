// types/index.ts

import { z } from 'zod';

// ============================================================
// 🔥 تایپ‌های پایه و مشترک
// ============================================================

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type Confidence = 'definite' | 'likely' | 'conditional';
export type AuditType = 'generic' | 'concurrency';
export type AuditStatus = 'complete' | 'repaired' | 'partially_complete' | 'failed_validation';

export type FindingCategory =
  | 'liveness'
  | 'thread-starvation'
  | 'deadlock'
  | 'queue-misuse'
  | 'duplicate-submission'
  | 'race-condition'
  | 'shared-state'
  | 'configuration'
  | 'resource-lifecycle'
  | 'timeout'
  | 'interruption'
  | 'cancellation'
  | 'retry'
  | 'error-handling'
  | 'architectural-duplication'
  | 'api-semantics'
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'other';

// ============================================================
// 🔥 تایپ DebugTrace (برای ذخیره‌سازی زنجیره تحلیل)
// ============================================================

export interface DebugTraceStage {
  name: string;
  description: string;
  data?: unknown;
  durationMs?: number;
}

export interface DebugTrace {
  timestamp: string;
  stages: DebugTraceStage[];
}

// ============================================================
// 🔥 تایپ‌های ساختار یافته برای Advanced Audit
// ============================================================

export interface EvidenceItem {
  startLine: number;
  endLine: number;
  code: string;
  explanation: string;
}

export interface AuditFinding {
  id: string;
  title: string;
  category: FindingCategory;
  severity: Severity;
  confidence: Confidence;
  evidence: EvidenceItem[];
  executionPath: string[];
  triggerConditions: string[];
  consequence: string;
  technicalExplanation: string;
  remediation: string;
  relatedSymbols: string[];
  testToReproduce: {
    title: string;
    setup: string[];
    steps: string[];
    expectedResult: string;
  } | null;
}

export interface AuditScorecard {
  correctness: number;
  concurrencySafety: number;
  liveness: number;
  errorHandling: number;
  resourceManagement: number;
  maintainability: number;
  productionReadiness: number;
}

// ============================================================
// 🔥 تایپ اصلی AdvancedAuditResult (خروجی پایپلاین)
// ============================================================

export interface AdvancedAuditResult {
  schemaVersion: '1.0';
  auditType: AuditType;
  status: AuditStatus;
  language: string;
  summary: string;
  executionOverview: {
    entryPoints: string[];
    taskSubmissionPoints: string[];
    blockingWaitPoints: string[];
    sharedResources: string[];
    resourceLifecycle: string[];
  };
  findings: AuditFinding[];
  architecturalObservations: Array<{
    title: string;
    explanation: string;
    relatedFindingIds: string[];
  }>;
  recommendedActions: Array<{
    priority: number;
    severity: Severity;
    title: string;
    action: string;
    relatedFindingIds: string[];
  }>;
  suggestedTests: Array<{
    title: string;
    purpose: string;
    setup: string[];
    steps: string[];
    expectedResult: string;
  }>;
  complexity: {
    time: string;
    space: string;
    resourceGrowth: string;
    assumptions: string[];
  };
  scorecard: AuditScorecard;
  verdict: {
    status:
      | 'not-production-ready'
      | 'requires-major-changes'
      | 'requires-minor-changes'
      | 'production-ready-with-monitoring';
    explanation: string;
  };
  limitations: string[];
  linkedin_post?: string;
  title?: string;
  highLevelSummary?: string;
}

// ============================================================
// 🔥 تایپ GenerateResponse (خروجی از AI)
// ============================================================

export interface GenerateResponse extends Partial<AdvancedAuditResult> {
  analysis?: string;
  card_title?: string;
  key_concept?: string;
  what_this_code_does?: string;
  debug_analysis?: string;
  optimization?: string;
  codeWalkthrough?: CodeWalkthroughItem[];
  whatWorksWell?: string[];
  bugsAndRiskyCases?: BugAndRiskyCase[];
  edgeCases?: EdgeCase[];
  performanceAnalysis?: PerformanceAnalysis;
  securityAnalysis?: SecurityAnalysis;
  productionReadiness?: ProductionReadiness;
  recommendedImprovements?: RecommendedImprovement[];
  improvedCode?: ImprovedCode;
  suggestedTestsLegacy?: SuggestedTest[];
  scorecardLegacy?: ScorecardLegacy;
  finalVerdict?: FinalVerdict;
  error?: string;
}

// ============================================================
// 🔥 تایپ‌های قدیمی (SnippetLegacy - برای سازگاری با عقب)
// ============================================================

export interface SnippetLegacy {
  id: string;
  slug: string;
  raw_code: string;
  language: string;
  card_title: string;
  key_concept: string;
  what_this_code_does: string;
  debug_analysis: string;
  optimization: string;
  linkedin_post: string;
  is_public: boolean;
  created_at: string;
  username?: string | null;
  github_username?: string | null;
  avatar_url?: string | null;
  card_image_url?: string | null;
  code_walkthrough?: CodeWalkthroughItem[] | null;
  what_works_well?: string[] | null;
  bugs_and_risky_cases?: BugAndRiskyCase[] | null;
  edge_cases?: EdgeCase[] | null;
  performance_analysis?: PerformanceAnalysis | null;
  security_analysis?: SecurityAnalysis | null;
  production_readiness?: ProductionReadiness | null;
  recommended_improvements?: RecommendedImprovement[] | null;
  improved_code?: string | null;
  suggested_tests?: SuggestedTest[] | null;
  scorecard?: ScorecardLegacy | null;
  final_verdict_summary?: string | null;
  final_verdict_approved?: boolean | null;
  final_verdict_next_steps?: string | null;
  line_explanations?: LineExplanation[] | null;
  generated_prompt?: string | null;
  findings?: AuditFinding[] | null;
  execution_overview?: AdvancedAuditResult['executionOverview'] | null;
  architectural_observations?: AdvancedAuditResult['architecturalObservations'] | null;
  recommended_actions?: AdvancedAuditResult['recommendedActions'] | null;
  suggested_tests_new?: AdvancedAuditResult['suggestedTests'] | null;
  complexity?: AdvancedAuditResult['complexity'] | null;
  scorecard_new?: AuditScorecard | null;
  verdict?: AdvancedAuditResult['verdict'] | null;
  limitations?: string[] | null;
  debug_trace?: DebugTrace | null;
}

// ============================================================
// 🔥 تعریف Schemas با Zod برای اعتبارسنجی داده‌ها
// ============================================================

// --- Schema برای LineExplanation ---
export const LineExplanationSchema = z.object({
  lineNumber: z.number().int().positive(),
  code: z.string().optional(),
  explanation: z.string(),
});

// --- Schema برای Evidence ---
const EvidenceSchema = z.object({
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
  code: z.string(),
  explanation: z.string(),
});

// --- Schema برای Finding ---
const FindingSchema = z.object({
  id: z.string().regex(/^F-\d{3,}$/),
  title: z.string().min(1),
  category: z.string(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
  confidence: z.enum(['definite', 'likely', 'conditional']),
  evidence: z.array(EvidenceSchema),
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

// --- Schema برای Scorecard Legacy (0-10) ---
const ScorecardLegacySchema = z.object({
  correctness: z.number().min(0).max(10),
  readability: z.number().min(0).max(10),
  performance: z.number().min(0).max(10),
  maintainability: z.number().min(0).max(10),
  productionReadiness: z.number().min(0).max(10),
  security: z.number().min(0).max(10).optional(),
  overall: z.number().min(0).max(10).optional(),
});

// --- Schema برای Scorecard New (0-100) ---
const ScorecardNewSchema = z.object({
  correctness: z.number().min(0).max(100),
  concurrencySafety: z.number().min(0).max(100),
  liveness: z.number().min(0).max(100),
  errorHandling: z.number().min(0).max(100),
  resourceManagement: z.number().min(0).max(100),
  maintainability: z.number().min(0).max(100),
  productionReadiness: z.number().min(0).max(100),
});

// --- Schema برای Verdict New ---
const VerdictNewSchema = z.object({
  status: z.enum([
    'not-production-ready',
    'requires-major-changes',
    'requires-minor-changes',
    'production-ready-with-monitoring',
  ]),
  explanation: z.string(),
});

// --- Schema برای Execution Overview ---
const ExecutionOverviewSchema = z.object({
  entryPoints: z.array(z.string()),
  taskSubmissionPoints: z.array(z.string()),
  blockingWaitPoints: z.array(z.string()),
  sharedResources: z.array(z.string()),
  resourceLifecycle: z.array(z.string()),
});

// --- Schema برای Code Walkthrough ---
const CodeWalkthroughItemSchema = z.object({
  section: z.string(),
  explanation: z.string(),
});

// --- Schema برای Architectural Observation ---
const ArchitecturalObservationSchema = z.object({
  title: z.string(),
  explanation: z.string(),
  relatedFindingIds: z.array(z.string()),
});

// --- Schema برای Recommended Action ---
const RecommendedActionSchema = z.object({
  priority: z.number().int().positive(),
  severity: z.string(),
  title: z.string(),
  action: z.string(),
  relatedFindingIds: z.array(z.string()),
});

// --- Schema برای Suggested Test (New) ---
const SuggestedTestNewSchema = z.object({
  title: z.string(),
  purpose: z.string(),
  setup: z.array(z.string()),
  steps: z.array(z.string()),
  expectedResult: z.string(),
});

// --- Schema برای Complexity ---
const ComplexitySchema = z.object({
  time: z.string(),
  space: z.string(),
  resourceGrowth: z.string(),
  assumptions: z.array(z.string()),
});

// ============================================================
// 🔥 Schema اصلی برای داده‌های Snippet (منبع واحد حقیقت)
// ============================================================

export const SnippetDataSchema = z.object({
  // فیلدهای اصلی (همیشه وجود دارند)
  id: z.string(),
  slug: z.string(),
  raw_code: z.string(),
  language: z.string(),
  card_title: z.string(),
  key_concept: z.string(),
  what_this_code_does: z.string(),
  debug_analysis: z.string(),
  optimization: z.string(),
  linkedin_post: z.string(),
  is_public: z.boolean(),
  created_at: z.string(),

  // فیلدهای nullable کاربر
  username: z.string().nullable().optional(),
  github_username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  card_image_url: z.string().nullable().optional(),

  // ===== Legacy فیلدها =====
  code_walkthrough: z.array(CodeWalkthroughItemSchema).optional(),
  what_works_well: z.array(z.string()).optional(),
  bugs_and_risky_cases: z
    .array(
      z.object({
        issue: z.string(),
        impact: z.string(),
        example: z.string(),
      })
    )
    .optional(),
  edge_cases: z
    .array(
      z.object({
        case: z.string(),
        currentBehavior: z.string(),
        expectedBehavior: z.string(),
        risk: z.enum(['Low', 'Medium', 'High']),
      })
    )
    .optional(),
  performance_analysis: z
    .object({
      timeComplexity: z.array(
        z.object({
          target: z.string(),
          complexity: z.string(),
          explanation: z.string(),
        })
      ),
      spaceComplexity: z.array(
        z.object({
          target: z.string(),
          complexity: z.string(),
          explanation: z.string(),
        })
      ),
      scalabilityNotes: z.array(z.string()),
    })
    .optional(),
  security_analysis: z
    .object({
      issues: z.array(z.string()),
      recommendations: z.array(z.string()),
      severity: z.enum(['Low', 'Medium', 'High', 'Critical']),
    })
    .optional(),
  production_readiness: z
    .object({
      isProductionReady: z.boolean(),
      reasons: z.array(z.string()),
      requiredChanges: z.array(z.string()),
    })
    .optional(),
  recommended_improvements: z
    .array(
      z.object({
        priority: z.enum(['High', 'Medium', 'Low']),
        improvement: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  improved_code: z.string().optional(),
  suggested_tests: z
    .array(
      z.object({
        name: z.string(),
        input: z.string(),
        expectedOutput: z.string(),
        type: z.enum(['Normal', 'Edge', 'Invalid']),
      })
    )
    .optional(),
  scorecard: ScorecardLegacySchema.optional(),
  final_verdict_summary: z.string().optional(),
  final_verdict_approved: z.boolean().optional(),
  final_verdict_next_steps: z.string().optional(),
  line_explanations: z.array(LineExplanationSchema).nullable().optional(),
  generated_prompt: z.string().nullable().optional(),

  // ===== NEW Advanced فیلدها =====
  findings: z.array(FindingSchema).optional(),
  execution_overview: ExecutionOverviewSchema.optional(),
  architectural_observations: z.array(ArchitecturalObservationSchema).optional(),
  recommended_actions: z.array(RecommendedActionSchema).optional(),
  suggested_tests_new: z.array(SuggestedTestNewSchema).optional(),
  complexity: ComplexitySchema.optional(),
  scorecard_new: ScorecardNewSchema.optional(),
  verdict: VerdictNewSchema.optional(),
  limitations: z.array(z.string()).optional(),

  // ===== Debug Trace (برای عیب‌یابی) =====
  debug_trace: z.any().nullable().optional(),
});

// ============================================================
// 🔥 استخراج تایپ از Schema (منبع واحد حقیقت)
// ============================================================

export type Snippet = z.infer<typeof SnippetDataSchema>;

// ============================================================
// 🔥 تایپ‌های کمکی و یکپارچه برای تست‌ها
// ============================================================

export interface UnifiedTest {
  title: string;
  purpose: string;
  setup: string[];
  steps: string[];
  expectedResult: string;
  _legacy?: {
    name?: string;
    input?: string;
    expectedOutput?: string;
    type?: 'Normal' | 'Edge' | 'Invalid';
  };
}

// ============================================================
// 🔥 تایپ‌های درخواست و پاسخ
// ============================================================

export interface GenerateRequest {
  code: string;
  language: string;
  mode: 'simple' | 'medium' | 'advanced';
}

export interface CreateSnippetResponse {
  success: boolean;
  id: string;
  slug: string;
  url: string;
  username?: string | null;
  github_username?: string | null;
  error?: string;
}

// ============================================================
// 🔥 تایپ‌های Legacy (ساختار قدیمی)
// ============================================================

export interface CodeWalkthroughItem {
  section: string;
  explanation: string;
}

export interface BugAndRiskyCase {
  issue: string;
  impact: string;
  example: string;
}

export interface EdgeCase {
  case: string;
  currentBehavior: string;
  expectedBehavior: string;
  risk: 'Low' | 'Medium' | 'High';
}

export interface ComplexityItem {
  target: string;
  complexity: string;
  explanation: string;
}

export interface PerformanceAnalysis {
  timeComplexity: ComplexityItem[];
  spaceComplexity: ComplexityItem[];
  scalabilityNotes: string[];
}

export interface SecurityAnalysis {
  issues: string[];
  recommendations: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface ProductionReadiness {
  isProductionReady: boolean;
  reasons: string[];
  requiredChanges: string[];
}

export interface RecommendedImprovement {
  priority: 'High' | 'Medium' | 'Low';
  improvement: string;
  reason: string;
}

export interface ImprovedCode {
  available: boolean;
  code: string;
  notes: string;
}

export interface SuggestedTest {
  name: string;
  input: string;
  expectedOutput: string;
  type: 'Normal' | 'Edge' | 'Invalid';
}

export interface ScorecardLegacy {
  correctness: number;
  readability: number;
  performance: number;
  maintainability: number;
  productionReadiness: number;
  security: number;
  overall: number;
}

export interface FinalVerdict {
  summary: string;
  approved: boolean;
  nextSteps: string;
}

export interface LineExplanation {
  lineNumber: number;
  code: string;
  explanation: string;
}

// ============================================================
// 🔥 تایپ‌های کمکی برای Validator (هماهنگ با lib/analysis/types.ts)
// ============================================================

export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  relatedLines: number[];
  expectedCoverage: string;
}

export interface ValidationResult {
  structurallyValid: boolean;
  semanticallyComplete: boolean;
  issues: ValidationIssue[];
  repairRequired: boolean;
}

// ============================================================
// 🔥 تایپ‌های Detector (هماهنگ با lib/analysis/detector.ts)
// ============================================================

export interface DetectorSignal {
  type: string;
  value: string;
  line: number;
  weight: number;
}

export interface DetectorResult {
  requiresConcurrencyAudit: boolean;
  score: number;
  signals: DetectorSignal[];
}

// ============================================================
// 🔥 تایپ PromptInfo (برای نمایش وضعیت پرامپت در صفحه اصلی)
// ============================================================

export interface PromptInfo {
  auditType: 'simple' | 'medium' | 'advanced' | 'concurrency' | 'generic' | null;
  status: 'complete' | 'repaired' | 'partially_complete' | 'failed_validation' | 'fallback' | null;
  isPipeline: boolean;
}

// ============================================================
// 🔥 تایپ‌های OutputsByMode (برای مدیریت خروجی‌های هر mode)
// ============================================================

export interface ModeOutput {
  snippet: Snippet | null;
  fullAnalysis: GenerateResponse | null;
  lineExplanations: LineExplanation[];
  generatedPrompt: string;
}

export type OutputsByMode = {
  [K in 'simple' | 'medium' | 'advanced']: ModeOutput;
};

// ============================================================
// 🔥 تایپ AppState (برای State Management در صفحه اصلی)
// ============================================================

export interface AppState {
  code: string;
  language: string;
  mode: 'simple' | 'medium' | 'advanced';
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