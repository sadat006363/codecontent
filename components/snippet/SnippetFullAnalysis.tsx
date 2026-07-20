// components/snippet/SnippetFullAnalysis.tsx

'use client';

import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { json } from '@codemirror/lang-json';
import { cpp } from '@codemirror/lang-cpp';
import { php } from '@codemirror/lang-php';
import type { Extension } from '@codemirror/state';

// ============================================================
// Types
// ============================================================

export interface Evidence {
  startLine: number;
  endLine: number;
  code: string;
  explanation: string;
}

export interface Finding {
  id: string;
  title: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: 'definite' | 'likely' | 'conditional';
  evidence: Evidence[];
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

export interface ScorecardLegacy {
  correctness: number;
  readability: number;
  performance: number;
  maintainability: number;
  productionReadiness: number;
  security?: number;
  overall?: number;
}

export interface ScorecardNew {
  correctness: number;
  concurrencySafety: number;
  liveness: number;
  errorHandling: number;
  resourceManagement: number;
  maintainability: number;
  productionReadiness: number;
}

export interface VerdictNew {
  status: 'not-production-ready' | 'requires-major-changes' | 'requires-minor-changes' | 'production-ready-with-monitoring';
  explanation: string;
}

// ============================================================
// Unified test type covering both legacy and new structures
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
// Snippet Data Interface (exported for reuse)
// ============================================================

export interface SnippetData {
  // Basic info
  card_title?: string;
  key_concept?: string;

  // Legacy fields
  code_walkthrough?: Array<{ section: string; explanation: string }>;
  what_works_well?: string[];
  bugs_and_risky_cases?: Array<{ issue: string; impact: string; example: string }>;
  edge_cases?: Array<{ case: string; currentBehavior: string; expectedBehavior: string; risk: 'Low' | 'Medium' | 'High' }>;
  performance_analysis?: {
    timeComplexity: Array<{ target: string; complexity: string; explanation: string }>;
    spaceComplexity: Array<{ target: string; complexity: string; explanation: string }>;
    scalabilityNotes: string[];
  };
  security_analysis?: {
    issues: string[];
    recommendations: string[];
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
  };
  production_readiness?: {
    isProductionReady: boolean;
    reasons: string[];
    requiredChanges: string[];
  };
  recommended_improvements?: Array<{ priority: 'High' | 'Medium' | 'Low'; improvement: string; reason: string }>;
  improved_code?: string;
  suggested_tests?: Array<{ name: string; input: string; expectedOutput: string; type: 'Normal' | 'Edge' | 'Invalid' }>;
  scorecard?: ScorecardLegacy;
  final_verdict_summary?: string;
  final_verdict_approved?: boolean;
  final_verdict_next_steps?: string;

  // New canonical fields
  findings?: Finding[];
  execution_overview?: {
    entryPoints: string[];
    taskSubmissionPoints: string[];
    blockingWaitPoints: string[];
    sharedResources: string[];
    resourceLifecycle: string[];
  };
  architectural_observations?: Array<{ title: string; explanation: string; relatedFindingIds: string[] }>;
  recommended_actions?: Array<{ priority: number; severity: string; title: string; action: string; relatedFindingIds: string[] }>;
  suggested_tests_new?: Array<{ title: string; purpose: string; setup: string[]; steps: string[]; expectedResult: string }>;
  complexity?: { time: string; space: string; resourceGrowth: string; assumptions: string[] };
  scorecard_new?: ScorecardNew;
  verdict?: VerdictNew;
  limitations?: string[];

  // Language for code highlighting
  language?: string;
}

// ============================================================
// Component Props
// ============================================================

export interface SnippetFullAnalysisProps {
  snippet: SnippetData;
}

// ============================================================
// Language extension mapping (type-safe)
// ============================================================

const languageExtensions: Record<string, Extension> = {
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  python: python(),
  java: java(),
  rust: rust(),
  go: go(),
  html: html(),
  css: css(),
  json: json(),
  cpp: cpp(),
  php: php(),
};

// ============================================================
// Helper to render JSON values as formatted lists
// ============================================================

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-[#6c7086]">Not available</span>;
  }

  if (typeof value === 'string') {
    return <p className="whitespace-pre-wrap text-[#cdd6f4]">{value}</p>;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return <span className="text-[#cdd6f4]">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-[#6c7086]">No items</span>;
    }

    const firstItem = value[0];
    if (typeof firstItem === 'object' && firstItem !== null) {
      return (
        <ul className="space-y-2 text-[#cdd6f4]">
          {value.map((item, idx) => (
            <li key={idx} className="border-b border-[#313244] pb-2 last:border-0">
              {Object.entries(item).map(([k, v]) => {
                const display = typeof v === 'string' ? v : JSON.stringify(v);
                return (
                  <div key={k} className="text-sm">
                    <span className="text-[#6c7086]">{k}:</span>{' '}
                    <span className="text-[#cdd6f4]">{display}</span>
                  </div>
                );
              })}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul className="list-disc list-inside space-y-1 text-[#cdd6f4]">
        {value.map((item, idx) => (
          <li key={idx}>{String(item)}</li>
        ))}
      </ul>
    );
  }

  if (typeof value === 'object' && value !== null) {
    return (
      <div className="text-sm text-[#cdd6f4] space-y-1">
        {Object.entries(value).map(([key, val]) => {
          const display = typeof val === 'string' ? val : JSON.stringify(val);
          return (
            <div key={key}>
              <span className="text-[#6c7086]">{key}:</span> {display}
            </div>
          );
        })}
      </div>
    );
  }

  return <span className="text-[#cdd6f4]">{String(value)}</span>;
}

// ============================================================
// Helper to normalize tests from legacy and new structures
// ============================================================

function normalizeTests(
  testsNew: SnippetData['suggested_tests_new'],
  testsLegacy: SnippetData['suggested_tests']
): UnifiedTest[] {
  if (testsNew && testsNew.length > 0) {
    return testsNew.map((t) => ({
      title: t.title || 'Test',
      purpose: t.purpose || '',
      setup: t.setup || [],
      steps: t.steps || [],
      expectedResult: t.expectedResult || '',
      _legacy: undefined,
    }));
  }

  if (testsLegacy && testsLegacy.length > 0) {
    return testsLegacy.map((t) => ({
      title: t.name || 'Test',
      purpose: t.input || '',
      setup: [],
      steps: [],
      expectedResult: t.expectedOutput || '',
      _legacy: {
        name: t.name,
        input: t.input,
        expectedOutput: t.expectedOutput,
        type: t.type,
      },
    }));
  }

  return [];
}

// ============================================================
// Severity badge helper
// ============================================================

function severityBadge(severity: string): string {
  const map: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    info: 'bg-gray-500/20 text-gray-400 border border-gray-500/30',
  };
  return map[severity] || map.info;
}

// ============================================================
// Main Component
// ============================================================

export default function SnippetFullAnalysis({ snippet }: SnippetFullAnalysisProps) {
  // ===== useMemo for coalescing to avoid unnecessary recalculations =====

  // Scorecard: prefer scorecard_new (0-100), fallback to scorecard (0-10)
  const { scorecardDisplay, scorecardIsNew, scorecardMax } = useMemo(() => {
    const display = snippet.scorecard_new || snippet.scorecard;
    const isNew = !!snippet.scorecard_new;
    const max = isNew ? 100 : 10;
    return { scorecardDisplay: display, scorecardIsNew: isNew, scorecardMax: max };
  }, [snippet.scorecard_new, snippet.scorecard]);

  // Suggested Tests: use unified normalization
  const suggestedTests = useMemo(
    () => normalizeTests(snippet.suggested_tests_new, snippet.suggested_tests),
    [snippet.suggested_tests_new, snippet.suggested_tests]
  );

  // Verdict: prefer new verdict, fallback to legacy final_verdict
  const verdictDisplay = useMemo(() => {
    if (snippet.verdict) return snippet.verdict;
    if (snippet.final_verdict_summary) {
      return {
        status: snippet.final_verdict_approved ? 'production-ready-with-monitoring' : 'requires-major-changes',
        explanation: snippet.final_verdict_summary + (snippet.final_verdict_next_steps ? ` Next steps: ${snippet.final_verdict_next_steps}` : ''),
      };
    }
    return null;
  }, [snippet.verdict, snippet.final_verdict_summary, snippet.final_verdict_approved, snippet.final_verdict_next_steps]);

  // Findings: if present, override legacy bug/edge sections
  const hasFindings = useMemo(
    () => snippet.findings && snippet.findings.length > 0,
    [snippet.findings]
  );
  const showLegacyBugEdge = !hasFindings;

  // --- Check if there is any content ---
  const hasContent = useMemo(() => {
    return !!(
      snippet.card_title ||
      snippet.key_concept ||
      snippet.code_walkthrough ||
      snippet.what_works_well ||
      (!hasFindings && (snippet.bugs_and_risky_cases || snippet.edge_cases)) ||
      snippet.performance_analysis ||
      snippet.security_analysis ||
      snippet.production_readiness ||
      snippet.recommended_improvements ||
      snippet.improved_code ||
      snippet.suggested_tests ||
      snippet.scorecard ||
      snippet.final_verdict_summary ||
      hasFindings ||
      snippet.execution_overview ||
      snippet.architectural_observations ||
      snippet.recommended_actions ||
      snippet.suggested_tests_new ||
      snippet.complexity ||
      snippet.scorecard_new ||
      snippet.verdict ||
      snippet.limitations
    );
  }, [
    snippet,
    hasFindings,
  ]);

  if (!hasContent) {
    return (
      <div className="mt-8 pt-6 border-t border-[#313244]">
        <div className="bg-[#11111b] p-6 rounded-lg border border-[#313244] text-center">
          <p className="text-[#a6adc8] text-sm">
            📊 Full report has not been generated for this snippet yet.
          </p>
          <p className="text-[#6c7086] text-xs mt-2">
            Generate a full analysis to see detailed insights including code walkthrough,
            performance analysis, security review, and more.
          </p>
        </div>
      </div>
    );
  }

  // --- Language for code highlighting ---
  const language = snippet.language || 'javascript';
  const langExtension = languageExtensions[language] || javascript();

  return (
    <div className="mt-8 pt-6 border-t border-[#313244]">
      <h2 className="text-2xl font-bold text-white mb-4">📊 Full Analysis</h2>

      <div className="space-y-4 text-[#cdd6f4]">
        {/* --- Title --- */}
        {snippet.card_title && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">📌 Title</h3>
            <p className="text-[#cdd6f4]">{snippet.card_title}</p>
          </div>
        )}

        {/* --- High-Level Summary --- */}
        {snippet.key_concept && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">💡 High-Level Summary</h3>
            <p className="text-[#cdd6f4] whitespace-pre-wrap">{snippet.key_concept}</p>
          </div>
        )}

        {/* --- Code Walkthrough --- */}
        {snippet.code_walkthrough && snippet.code_walkthrough.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🧩 Code Walkthrough</h3>
            <div className="space-y-2 mt-2">
              {snippet.code_walkthrough.map((item, idx) => (
                <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                  <p className="font-medium text-[#89b4fa]">{item.section}</p>
                  <p className="text-sm text-[#cdd6f4]">{item.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- What Works Well --- */}
        {snippet.what_works_well && snippet.what_works_well.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#a6e3a1]">✅ What Works Well</h3>
            <ul className="list-disc list-inside space-y-1 text-[#cdd6f4]">
              {snippet.what_works_well.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Legacy Bugs & Edge Cases (only if no findings) --- */}
        {showLegacyBugEdge && (
          <>
            {snippet.bugs_and_risky_cases && snippet.bugs_and_risky_cases.length > 0 && (
              <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                <h3 className="text-lg font-semibold text-[#f38ba8]">🐛 Bugs and Risky Cases</h3>
                {snippet.bugs_and_risky_cases.map((item, idx) => (
                  <div key={idx} className="mt-2 border-b border-[#313244] pb-2 last:border-0">
                    <p className="font-medium text-[#f38ba8]">{item.issue}</p>
                    <p className="text-sm text-[#cdd6f4]">Impact: {item.impact}</p>
                    {item.example && <p className="text-sm text-[#6c7086]">Example: {item.example}</p>}
                  </div>
                ))}
              </div>
            )}

            {snippet.edge_cases && snippet.edge_cases.length > 0 && (
              <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
                <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Edge Cases</h3>
                {snippet.edge_cases.map((item, idx) => (
                  <div key={idx} className="mt-2 border-b border-[#313244] pb-2 last:border-0">
                    <p className="font-medium text-[#89b4fa]">{item.case}</p>
                    <p className="text-sm text-[#cdd6f4]">Current: {item.currentBehavior}</p>
                    <p className="text-sm text-[#cdd6f4]">Expected: {item.expectedBehavior}</p>
                    <p className="text-sm text-[#6c7086]">Risk: {item.risk}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* --- Findings (NEW) --- */}
        {hasFindings && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🔍 Findings</h3>
            <div className="space-y-4 mt-2">
              {snippet.findings!.map((finding) => (
                <div key={finding.id} className="bg-[#1e1e2e] p-3 rounded-md border border-[#313244]">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-[#89b4fa]">{finding.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${severityBadge(finding.severity)}`}>
                      {finding.severity}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium mt-1">{finding.title}</p>
                  <p className="text-sm text-[#a6adc8] mt-1">{finding.technicalExplanation || finding.consequence}</p>

                  {/* Evidence */}
                  {finding.evidence && finding.evidence.length > 0 && (
                    <div className="mt-2 text-xs text-[#6c7086]">
                      <span>Evidence: lines {finding.evidence.map((e) => `${e.startLine}-${e.endLine}`).join(', ')}</span>
                      <pre className="mt-1 text-[#cdd6f4] bg-[#11111b] p-2 rounded border border-[#313244] overflow-x-auto whitespace-pre-wrap max-h-[150px]">
                        {finding.evidence[0].code}
                      </pre>
                      <p className="text-xs text-[#6c7086] mt-1">{finding.evidence[0].explanation}</p>
                    </div>
                  )}

                  {/* Execution Path */}
                  {finding.executionPath && finding.executionPath.length > 0 && (
                    <div className="mt-2 text-xs">
                      <span className="text-[#6c7086]">Path: </span>
                      <span className="text-[#cdd6f4]">{finding.executionPath.join(' → ')}</span>
                    </div>
                  )}

                  {/* Trigger Conditions */}
                  {finding.triggerConditions && finding.triggerConditions.length > 0 && (
                    <div className="mt-1 text-xs">
                      <span className="text-[#6c7086]">Triggers: </span>
                      <span className="text-[#cdd6f4]">{finding.triggerConditions.join('; ')}</span>
                    </div>
                  )}

                  {/* Remediation */}
                  {finding.remediation && (
                    <div className="mt-2 text-xs text-[#a6e3a1]">
                      <strong>Fix:</strong> {finding.remediation}
                    </div>
                  )}

                  {/* Confidence */}
                  <div className="mt-1 text-xs text-[#6c7086]">
                    Confidence: {finding.confidence}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Execution Overview (NEW) - with null-safe rendering --- */}
        {snippet.execution_overview && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">⚡ Execution Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm">
              <div>
                <span className="text-[#6c7086]">Entry Points:</span>
                <ul className="list-disc list-inside text-[#cdd6f4]">
                  {(snippet.execution_overview.entryPoints ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-[#6c7086]">Task Submission Points:</span>
                <ul className="list-disc list-inside text-[#cdd6f4]">
                  {(snippet.execution_overview.taskSubmissionPoints ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-[#6c7086]">Blocking Wait Points:</span>
                <ul className="list-disc list-inside text-[#cdd6f4]">
                  {(snippet.execution_overview.blockingWaitPoints ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="text-[#6c7086]">Shared Resources:</span>
                <ul className="list-disc list-inside text-[#cdd6f4]">
                  {(snippet.execution_overview.sharedResources ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className="md:col-span-2">
                <span className="text-[#6c7086]">Resource Lifecycle:</span>
                <ul className="list-disc list-inside text-[#cdd6f4]">
                  {(snippet.execution_overview.resourceLifecycle ?? []).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* --- Architectural Observations (NEW) --- */}
        {snippet.architectural_observations && snippet.architectural_observations.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🏗️ Architectural Observations</h3>
            <div className="space-y-2 mt-2">
              {snippet.architectural_observations.map((obs, idx) => (
                <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                  <p className="font-medium text-[#89b4fa]">{obs.title}</p>
                  <p className="text-sm text-[#cdd6f4]">{obs.explanation}</p>
                  {obs.relatedFindingIds.length > 0 && (
                    <p className="text-xs text-[#6c7086]">Related findings: {obs.relatedFindingIds.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Recommended Actions (NEW) --- */}
        {snippet.recommended_actions && snippet.recommended_actions.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#a6e3a1]">🔧 Recommended Actions</h3>
            <div className="space-y-2 mt-2">
              {snippet.recommended_actions.map((action, idx) => (
                <div key={idx} className="flex items-start gap-2 border-b border-[#313244] pb-2 last:border-0">
                  <span className="text-xs text-[#6c7086] min-w-[24px]">#{action.priority}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#a6e3a1]">{action.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${severityBadge(action.severity)}`}>
                        {action.severity}
                      </span>
                    </div>
                    <p className="text-sm text-[#cdd6f4]">{action.action}</p>
                    {action.relatedFindingIds.length > 0 && (
                      <p className="text-xs text-[#6c7086]">Related: {action.relatedFindingIds.join(', ')}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Complexity (NEW) --- */}
        {snippet.complexity && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">📈 Complexity</h3>
            <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
              <div>
                <span className="text-[#6c7086]">Time:</span>
                <span className="text-[#cdd6f4] ml-2">{snippet.complexity.time}</span>
              </div>
              <div>
                <span className="text-[#6c7086]">Space:</span>
                <span className="text-[#cdd6f4] ml-2">{snippet.complexity.space}</span>
              </div>
              <div className="col-span-2">
                <span className="text-[#6c7086]">Resource Growth:</span>
                <span className="text-[#cdd6f4] ml-2">{snippet.complexity.resourceGrowth}</span>
              </div>
              {snippet.complexity.assumptions.length > 0 && (
                <div className="col-span-2">
                  <span className="text-[#6c7086]">Assumptions:</span>
                  <ul className="list-disc list-inside text-[#cdd6f4]">
                    {snippet.complexity.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Performance Analysis (Legacy) --- */}
        {snippet.performance_analysis && !snippet.complexity && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">⚡ Performance Analysis</h3>
            {renderValue(snippet.performance_analysis)}
          </div>
        )}

        {/* --- Security Analysis (Legacy) --- */}
        {snippet.security_analysis && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#f38ba8]">🔒 Security Analysis</h3>
            {renderValue(snippet.security_analysis)}
          </div>
        )}

        {/* --- Production Readiness (Legacy) --- */}
        {snippet.production_readiness && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🛡️ Production Readiness</h3>
            {renderValue(snippet.production_readiness)}
          </div>
        )}

        {/* --- Recommended Improvements (Legacy) --- */}
        {snippet.recommended_improvements && snippet.recommended_improvements.length > 0 && !snippet.recommended_actions && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#a6e3a1]">🔧 Recommended Improvements</h3>
            <ul className="list-disc list-inside space-y-1 text-[#cdd6f4]">
              {snippet.recommended_improvements.map((item, idx) => (
                <li key={idx}>
                  <span className="font-medium text-[#a6e3a1]">{item.improvement}</span>
                  <span className="text-xs text-[#6c7086] ml-2">({item.priority})</span>
                  <p className="text-sm text-[#cdd6f4] ml-4">{item.reason}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Improved Code with Syntax Highlighter --- */}
        {snippet.improved_code && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">✨ Improved Code</h3>
            <div className="mt-2 border border-[#313244] rounded-lg overflow-hidden">
              <CodeMirror
                value={snippet.improved_code}
                height="auto"
                theme="dark"
                extensions={[langExtension, EditorView.lineWrapping]}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: false,
                  foldGutter: true,
                  autocompletion: false,
                  tabSize: 2,
                }}
                readOnly={true}
                className="text-sm"
              />
            </div>
          </div>
        )}

        {/* --- Suggested Tests (unified) --- */}
        {suggestedTests.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🧪 Suggested Tests</h3>
            <div className="space-y-2 mt-2">
              {suggestedTests.map((test, idx) => (
                <div key={idx} className="border-b border-[#313244] pb-2 last:border-0">
                  <p className="font-medium text-[#89b4fa]">{test.title}</p>
                  {test.purpose && <p className="text-sm text-[#cdd6f4]">{test.purpose}</p>}
                  {test.setup.length > 0 && (
                    <div className="text-xs text-[#6c7086] mt-1">
                      Setup: {test.setup.join('; ')}
                    </div>
                  )}
                  {test.steps.length > 0 && (
                    <div className="text-xs text-[#6c7086] mt-1">
                      Steps: {test.steps.join('; ')}
                    </div>
                  )}
                  {test.expectedResult && (
                    <div className="text-xs text-[#a6e3a1] mt-1">
                      Expected: {test.expectedResult}
                    </div>
                  )}
                  {test._legacy && test._legacy.type && (
                    <div className="text-xs text-[#6c7086] mt-1">
                      Type: {test._legacy.type}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- Scorecard (coalesced) --- */}
        {scorecardDisplay && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">
              📊 Scorecard {scorecardIsNew ? '(New)' : '(Legacy)'}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
              {Object.entries(scorecardDisplay).map(([key, value]) => {
                const num = typeof value === 'number' ? value : 0;
                return (
                  <div key={key} className="bg-[#1e1e2e] p-2 rounded-md text-center border border-[#313244]">
                    <p className="text-xs text-[#6c7086] capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </p>
                    <p className="text-lg font-bold text-white">
                      {num}/{scorecardMax}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- Verdict (coalesced) --- */}
        {verdictDisplay && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#89b4fa]">🏁 Verdict</h3>
            <div className="mt-2 space-y-1">
              <p className="text-sm">
                <span className="text-[#6c7086]">Status:</span>{' '}
                <span className={`font-medium ${
                  verdictDisplay.status === 'production-ready-with-monitoring' ? 'text-[#a6e3a1]' :
                  verdictDisplay.status === 'requires-minor-changes' ? 'text-[#f9e2af]' :
                  verdictDisplay.status === 'requires-major-changes' ? 'text-[#f38ba8]' :
                  'text-[#f38ba8]'
                }`}>
                  {verdictDisplay.status}
                </span>
              </p>
              {verdictDisplay.explanation && (
                <p className="text-sm text-[#a6adc8]">{verdictDisplay.explanation}</p>
              )}
            </div>
          </div>
        )}

        {/* --- Limitations (NEW) --- */}
        {snippet.limitations && snippet.limitations.length > 0 && (
          <div className="bg-[#11111b] p-4 rounded-lg border border-[#313244]">
            <h3 className="text-lg font-semibold text-[#f38ba8]">⚠️ Limitations</h3>
            <ul className="list-disc list-inside space-y-1 mt-2 text-sm text-[#a6adc8]">
              {snippet.limitations.map((lim: string, idx: number) => (
                <li key={idx}>{lim}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}