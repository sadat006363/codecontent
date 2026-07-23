// types/index.ts

import { z } from 'zod';
import {
  // ===== Import از Schema اصلی =====
  AdvancedAuditResultSchema,
  AuditFindingSchema,
  AuditScorecardSchema,
  AuditTypeSchema,
  AuditStatusSchema,
  VerdictStatusSchema,
  SeveritySchema,
  ConfidenceSchema,
  FindingCategorySchema,
  EvidenceItemSchema,
  ScoreItemSchema,
  ImprovedCodeSchema,
  RecommendedActionSchema,
  type AdvancedAuditResult,
  type AuditFinding,
  type AuditScorecard,
  type AuditType,
  type AuditStatus,
  type VerdictStatus,
  type Severity,
  type Confidence,
  type FindingCategory,
  type EvidenceItem,
  type ScoreItem,
  type ImprovedCode,
  type RecommendedAction,
} from '@/lib/analysis/schema';

// ============================================================
// 🔥 تایپ‌های اصلی (از Schema اصلی استخراج شده‌اند)
// ============================================================

export type {
  AdvancedAuditResult,
  AuditFinding,
  AuditScorecard,
  AuditType,
  AuditStatus,
  VerdictStatus,
  Severity,
  Confidence,
  FindingCategory,
  EvidenceItem,
  ScoreItem,
  ImprovedCode,
  RecommendedAction,
};

// ============================================================
// 🔥 تایپ‌های Legacy (برای سازگاری با عقب و UI)
// ============================================================

export interface LegacyScorecard {
  correctness: number;
  readability: number;
  performance: number;
  maintainability: number;
  productionReadiness: number;
  security?: number;
  overall?: number;
}

export interface LegacySuggestedTest {
  name: string;
  input: string;
  expectedOutput: string;
  type: 'Normal' | 'Edge' | 'Invalid';
}

export interface LegacyBugAndRiskyCase {
  issue: string;
  impact: string;
  example?: string;
}

export interface LegacyEdgeCase {
  case: string;
  currentBehavior: string;
  expectedBehavior: string;
  risk: 'Low' | 'Medium' | 'High';
}

export interface LegacyCodeWalkthroughItem {
  section: string;
  explanation: string;
}

export interface LegacyPerformanceAnalysis {
  timeComplexity: Array<{ target: string; complexity: string; explanation: string }>;
  spaceComplexity: Array<{ target: string; complexity: string; explanation: string }>;
  scalabilityNotes: string[];
}

export interface LegacySecurityAnalysis {
  issues: string[];
  recommendations: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
}

export interface LegacyProductionReadiness {
  isProductionReady: boolean;
  reasons: string[];
  requiredChanges: string[];
}

export interface LegacyRecommendedImprovement {
  priority: 'High' | 'Medium' | 'Low';
  improvement: string;
  reason: string;
}

// ============================================================
// 🔥 Exportهای Legacy با نام‌های اصلی (برای سازگاری با UI)
// ============================================================

export type CodeWalkthroughItem = LegacyCodeWalkthroughItem;
export type BugAndRiskyCase = LegacyBugAndRiskyCase;
export type EdgeCase = LegacyEdgeCase;
export type PerformanceAnalysis = LegacyPerformanceAnalysis;
export type SecurityAnalysis = LegacySecurityAnalysis;
export type ProductionReadiness = LegacyProductionReadiness;
export type RecommendedImprovement = LegacyRecommendedImprovement;
export type SuggestedTest = LegacySuggestedTest;
export type ScorecardLegacy = LegacyScorecard;

// ============================================================
// 🔥 Snippet Schema (برای اعتبارسنجی داده‌های دیتابیس)
// ============================================================

/**
 * Schema برای داده‌های Snippet در دیتابیس
 * این Schema برای اعتبارسنجی داده‌های خوانده‌شده از Supabase است
 * و با AdvancedAuditResultSchema یکی نیست
 */
export const SnippetDataSchema = z.object({
  // ===== فیلدهای اصلی =====
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

  // ===== فیلدهای کاربر =====
  username: z.string().nullable().optional(),
  github_username: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  card_image_url: z.string().nullable().optional(),

  // ===== Legacy فیلدها =====
  code_walkthrough: z.any().optional().nullable(),
  what_works_well: z.any().optional().nullable(),
  bugs_and_risky_cases: z.any().optional().nullable(),
  edge_cases: z.any().optional().nullable(),
  performance_analysis: z.any().optional().nullable(),
  security_analysis: z.any().optional().nullable(),
  production_readiness: z.any().optional().nullable(),
  recommended_improvements: z.any().optional().nullable(),
  improved_code: z.string().optional().nullable(),
  suggested_tests: z.any().optional().nullable(),
  scorecard: z.any().optional().nullable(),
  final_verdict_summary: z.string().optional().nullable(),
  final_verdict_approved: z.boolean().optional().nullable(),
  final_verdict_next_steps: z.string().optional().nullable(),
  line_explanations: z.any().optional().nullable(),
  generated_prompt: z.string().optional().nullable(),

  // ===== فیلدهای Advanced (JSONB) =====
  findings: z.any().optional().nullable(),
  execution_overview: z.any().optional().nullable(),
  architectural_observations: z.any().optional().nullable(),
  recommended_actions: z.any().optional().nullable(),
  suggested_tests_new: z.any().optional().nullable(),
  complexity: z.any().optional().nullable(),
  scorecard_new: z.any().optional().nullable(),
  verdict: z.any().optional().nullable(),
  limitations: z.array(z.string()).optional().nullable(),

  // ===== audit_result (فیلد جدید) =====
  audit_result: z.any().optional().nullable(),

  // ===== Debug =====
  debug_trace: z.any().optional().nullable(),
});

export type Snippet = z.infer<typeof SnippetDataSchema>;

// ============================================================
// 🔥 تایپ‌های درخواست و پاسخ API
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

/**
 * GenerateResponse (برای سازگاری با عقب)
 * این تایپ ترکیبی از Legacy و Advanced است
 */
export interface GenerateResponse extends Partial<AdvancedAuditResult> {
  // ===== Legacy فیلدها =====
  analysis?: string;
  card_title?: string;
  key_concept?: string;
  what_this_code_does?: string;
  debug_analysis?: string;
  optimization?: string;
  codeWalkthrough?: LegacyCodeWalkthroughItem[];
  whatWorksWell?: string[];
  bugsAndRiskyCases?: LegacyBugAndRiskyCase[];
  edgeCases?: LegacyEdgeCase[];
  performanceAnalysis?: LegacyPerformanceAnalysis;
  securityAnalysis?: LegacySecurityAnalysis;
  productionReadiness?: LegacyProductionReadiness;
  recommendedImprovements?: LegacyRecommendedImprovement[];
  improvedCode?: LegacyImprovedCode | ImprovedCode;
  suggestedTestsLegacy?: LegacySuggestedTest[];
  scorecardLegacy?: LegacyScorecard;
  finalVerdict?: {
    summary: string;
    approved: boolean;
    nextSteps?: string;
  };
  error?: string;
}

/**
 * Legacy ImprovedCode (برای سازگاری)
 */
export interface LegacyImprovedCode {
  available: boolean;
  code: string;
  notes: string;
}

// ============================================================
// 🔥 تایپ‌های Line Explanation
// ============================================================

export interface LineExplanation {
  lineNumber: number;
  code?: string;
  explanation: string;
}

// ============================================================
// 🔥 تایپ‌های کمکی برای State Management
// ============================================================

export interface PromptInfo {
  auditType: 'simple' | 'medium' | 'advanced' | 'concurrency' | 'generic' | null;
  status: 'complete' | 'repaired' | 'partially_complete' | 'failed_validation' | 'fallback' | null;
  isPipeline: boolean;
}

export interface ModeOutput {
  snippet: Snippet | null;
  fullAnalysis: GenerateResponse | null;
  lineExplanations: LineExplanation[];
  generatedPrompt: string;
}

export type OutputsByMode = {
  [K in 'simple' | 'medium' | 'advanced']: ModeOutput;
};

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

// ============================================================
// 🔥 Export تایپ‌های مورد نیاز توسط app/page.tsx
// ============================================================

// این exportها برای سازگاری با صفحه اصلی اضافه شده‌اند
// و به تایپ‌های Legacy اشاره می‌کنند
export type { 
  LegacyCodeWalkthroughItem,
  LegacyBugAndRiskyCase,
  LegacyEdgeCase,
  LegacyPerformanceAnalysis,
  LegacySecurityAnalysis,
  LegacyProductionReadiness,
  LegacyRecommendedImprovement,
  LegacySuggestedTest,
  LegacyScorecard,
};

// همچنین برای راحتی، نام‌های کوتاه‌تر را نیز صادر می‌کنیم
// که همان تایپ‌های Legacy هستند
export type { 
  LegacyCodeWalkthroughItem as CodeWalkthroughItem,
  LegacyBugAndRiskyCase as BugAndRiskyCase,
  LegacyEdgeCase as EdgeCase,
  LegacyPerformanceAnalysis as PerformanceAnalysis,
  LegacySecurityAnalysis as SecurityAnalysis,
  LegacyProductionReadiness as ProductionReadiness,
  LegacyRecommendedImprovement as RecommendedImprovement,
  LegacySuggestedTest as SuggestedTest,
  LegacyScorecard as ScorecardLegacy,
};