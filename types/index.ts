// ============ Existing Types ============
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

  // ===== فیلدهای جدید برای تب Analysis (Advanced) =====
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

  // ===== فیلدهای جدید برای تب Line by Line =====
  line_explanations?: any[] | null;

  // ===== فیلدهای جدید برای تب Prompt =====
  generated_prompt?: string | null;
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

// ============ New Types ============

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

// ============ GenerateResponse ============
export interface GenerateResponse {
  // For Advanced mode
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
  suggestedTests?: SuggestedTest[];
  scorecard?: Scorecard;
  finalVerdict?: FinalVerdict;

  // For Simple and Medium modes
  analysis?: string;

  // LinkedIn post for all modes
  linkedin_post: string;

  // Legacy fields for compatibility
  card_title?: string;
  key_concept?: string;
  what_this_code_does?: string;
  debug_analysis?: string;
  optimization?: string;
  error?: string;
}