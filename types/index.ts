// types/index.ts
export interface Snippet {
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

  // ===== Legacy Advanced fields =====
  code_walkthrough?: any[] | null;
  what_works_well?: string[] | null;
  bugs_and_risky_cases?: any[] | null;
  edge_cases?: any[] | null;
  performance_analysis?: any | null;
  security_analysis?: any | null;
  production_readiness?: any | null;
  recommended_improvements?: any[] | null;
  improved_code?: string | null;
  suggested_tests?: any[] | null;
  scorecard?: any | null;
  final_verdict_summary?: string | null;
  final_verdict_approved?: boolean | null;
  final_verdict_next_steps?: string | null;
  line_explanations?: any[] | null;
  generated_prompt?: string | null;

  // ===== NEW Advanced Audit fields =====
  findings?: any[] | null;
  execution_overview?: any | null;
  architectural_observations?: any[] | null;
  recommended_actions?: any[] | null;
  suggested_tests_new?: any[] | null;
  complexity?: any | null;
  scorecard_new?: any | null;
  verdict?: any | null;
  limitations?: string[] | null;
}

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

// ============ New Types for Advanced Analysis ============

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
  // Legacy fields for compatibility
  title?: string;
  highLevelSummary?: string;
  linkedin_post?: string;
  analysis?: string;
  improvedCode?: { available: boolean; code: string; notes: string };
  scorecardLegacy?: { correctness: number; readability: number; performance: number; maintainability: number; productionReadiness: number; security: number; overall: number };
}

// ============ GenerateResponse ============
export interface GenerateResponse {
  schemaVersion?: '1.0';
  auditType?: AuditType;
  status?: AuditStatus;
  language?: string;
  summary?: string;
  executionOverview?: {
    entryPoints: string[];
    taskSubmissionPoints: string[];
    blockingWaitPoints: string[];
    sharedResources: string[];
    resourceLifecycle: string[];
  };
  findings?: AuditFinding[];
  architecturalObservations?: Array<{
    title: string;
    explanation: string;
    relatedFindingIds: string[];
  }>;
  recommendedActions?: Array<{
    priority: number;
    severity: Severity;
    title: string;
    action: string;
    relatedFindingIds: string[];
  }>;
  suggestedTests?: Array<{
    title: string;
    purpose: string;
    setup: string[];
    steps: string[];
    expectedResult: string;
  }>;
  complexity?: {
    time: string;
    space: string;
    resourceGrowth: string;
    assumptions: string[];
  };
  scorecard?: AuditScorecard;
  verdict?: {
    status:
      | 'not-production-ready'
      | 'requires-major-changes'
      | 'requires-minor-changes'
      | 'production-ready-with-monitoring';
    explanation: string;
  };
  limitations?: string[];
  title?: string;
  highLevelSummary?: string;
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
  scorecardLegacy?: Scorecard;
  finalVerdict?: FinalVerdict;
  analysis?: string;
  linkedin_post?: string;
  card_title?: string;
  key_concept?: string;
  what_this_code_does?: string;
  debug_analysis?: string;
  optimization?: string;
  error?: string;
}

// ============ Existing Types (without changes) ============
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

export interface Scorecard {
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