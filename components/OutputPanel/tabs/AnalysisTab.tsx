// components/OutputPanel/tabs/AnalysisTab.tsx
'use client';
import { GenerateResponse, AuditFinding, EvidenceItem } from '@/types';
import { safeString } from '@/lib/utils';
import { useState } from 'react';

interface AnalysisTabProps {
  fullAnalysis: GenerateResponse | null | undefined;
  isAdvanced: boolean;
  quickAnalysisText: string | null;
  snippet: any;
  onCopyFullAnalysis?: () => void;
  onDownloadFullAnalysis?: () => void;
}

// ===== Clean markdown =====
const cleanMarkdown = (text: string) => {
  if (!text) return '';
  let cleaned = text.replace(/^###\s*/gm, '');
  cleaned = cleaned.replace(/\n###\s*/g, '\n');
  cleaned = cleaned.replace(/^-\s*/gm, '• ');
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  return cleaned;
};

// ===== Clean text for copy =====
const cleanTextForCopy = (text: string) => {
  if (!text) return '';
  let cleaned = text.replace(/^###\s*/gm, '');
  cleaned = cleaned.replace(/\n###\s*/g, '\n');
  cleaned = cleaned.replace(/^-\s*/gm, '• ');
  cleaned = cleaned.replace(/\*\*/g, '');
  return cleaned;
};

// ===== Safe array helper =====
const safeArray = <T,>(arr: T[] | undefined | null): T[] => {
  return Array.isArray(arr) ? arr : [];
};

// ===== Render single finding =====
const FindingCard = ({ finding }: { finding: AuditFinding }) => {
  const severityColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    low: 'bg-blue-100 text-blue-700 border-blue-200',
    info: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const confidenceLabels: Record<string, string> = {
    definite: '✅ Definite',
    likely: '🔶 Likely',
    conditional: '⚠️ Conditional',
  };

  return (
    <div className={`p-4 rounded-lg border ${severityColors[finding.severity] || 'bg-gray-50 border-gray-200'}`}>
      {/* ===== Title & badges ===== */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-[#1a1a2e]">{safeString(finding.title)}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          finding.severity === 'critical' ? 'bg-red-500 text-white' :
          finding.severity === 'high' ? 'bg-orange-500 text-white' :
          finding.severity === 'medium' ? 'bg-yellow-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          {safeString(finding.severity)}
        </span>
        <span className="text-xs text-[#6c7086]">{confidenceLabels[finding.confidence] || safeString(finding.confidence)}</span>
      </div>

      {/* ===== Evidence ===== */}
      {safeArray(finding.evidence).length > 0 && (
        <div className="mt-2 text-xs text-[#6c7086] space-y-1">
          <span className="font-medium text-[#4a86f7]">Evidence:</span>
          {safeArray(finding.evidence).map((ev: EvidenceItem, idx: number) => (
            <div key={idx} className="bg-white/50 p-2 rounded border border-[#e8e8f0] font-mono text-[#1a1a2e]">
              <span className="text-[#6c7086]">Lines {ev.startLine}-{ev.endLine}:</span> {safeString(ev.code)}
              <p className="text-[#4a4a6a] text-xs mt-1">{safeString(ev.explanation)}</p>
            </div>
          ))}
        </div>
      )}

      {/* ===== Execution Path ===== */}
      {safeArray(finding.executionPath).length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-medium text-[#4a86f7]">Execution Path:</span>
          <div className="text-xs text-[#4a4a6a] bg-white/50 p-2 rounded border border-[#e8e8f0] mt-1">
            {safeArray(finding.executionPath).map((step: string, idx: number) => (
              <div key={idx}>→ {safeString(step)}</div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Trigger Conditions ===== */}
      {safeArray(finding.triggerConditions).length > 0 && (
        <div className="mt-2">
          <span className="text-xs font-medium text-[#4a86f7]">Trigger Conditions:</span>
          <ul className="list-disc list-inside text-xs text-[#4a4a6a] mt-1">
            {safeArray(finding.triggerConditions).map((cond: string, idx: number) => (
              <li key={idx}>{safeString(cond)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* ===== Consequence ===== */}
      {finding.consequence && (
        <div className="mt-2">
          <span className="text-xs font-medium text-[#e53935]">Consequence:</span>
          <p className="text-sm text-[#4a4a6a]">{safeString(finding.consequence)}</p>
        </div>
      )}

      {/* ===== Remediation ===== */}
      {finding.remediation && (
        <div className="mt-2">
          <span className="text-xs font-medium text-[#43a047]">💡 Remediation:</span>
          <p className="text-sm text-[#4a4a6a]">{safeString(finding.remediation)}</p>
        </div>
      )}

      {/* ===== Technical Explanation ===== */}
      {finding.technicalExplanation && (
        <div className="mt-2">
          <span className="text-xs font-medium text-[#6c7086]">Technical Details:</span>
          <p className="text-xs text-[#4a4a6a]">{safeString(finding.technicalExplanation)}</p>
        </div>
      )}

      {/* ===== Test to Reproduce ===== */}
      {finding.testToReproduce && (
        <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200">
          <span className="text-xs font-medium text-[#4a86f7]">🧪 Test to Reproduce:</span>
          <div className="text-xs text-[#4a4a6a] mt-1 space-y-1">
            <p><span className="font-medium">Title:</span> {safeString(finding.testToReproduce.title)}</p>
            {safeArray(finding.testToReproduce.setup).length > 0 && (
              <p><span className="font-medium">Setup:</span> {safeArray(finding.testToReproduce.setup).join(', ')}</p>
            )}
            {safeArray(finding.testToReproduce.steps).length > 0 && (
              <p><span className="font-medium">Steps:</span> {safeArray(finding.testToReproduce.steps).join(' → ')}</p>
            )}
            <p><span className="font-medium">Expected:</span> {safeString(finding.testToReproduce.expectedResult)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default function AnalysisTab({
  fullAnalysis,
  isAdvanced,
  quickAnalysisText,
  snippet,
  onCopyFullAnalysis,
  onDownloadFullAnalysis,
}: AnalysisTabProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  // ===== Generate full analysis text for copy/download =====
  const getAnalysisText = () => {
    if (!fullAnalysis) return '';

    let text = '';

    if (isAdvanced && fullAnalysis.findings) {
      text += `📊 Zbloue Advanced Analysis Report\n`;
      text += `═══════════════════════════════════════\n\n`;
      text += `📌 Title: ${safeString(fullAnalysis.title)}\n\n`;
      if (fullAnalysis.summary || fullAnalysis.highLevelSummary) {
        text += `💡 Summary:\n${safeString(fullAnalysis.summary || fullAnalysis.highLevelSummary)}\n\n`;
      }
      text += `🔍 Findings:\n`;
      safeArray(fullAnalysis.findings).forEach((f: AuditFinding) => {
        text += `  • ${safeString(f.title)} [${safeString(f.severity)}] (${safeString(f.confidence)})\n`;
        if (safeArray(f.evidence).length > 0) {
          const lines = safeArray(f.evidence).map((e: EvidenceItem) => `${e.startLine}-${e.endLine}`).join(', ');
          text += `    Lines: ${lines}\n`;
        }
        if (safeArray(f.executionPath).length > 0) {
          text += `    Path: ${safeArray(f.executionPath).join(' → ')}\n`;
        }
        if (safeArray(f.triggerConditions).length > 0) {
          text += `    Triggers: ${safeArray(f.triggerConditions).join('; ')}\n`;
        }
        text += `    Consequence: ${safeString(f.consequence)}\n`;
        if (f.remediation) text += `    Fix: ${safeString(f.remediation)}\n\n`;
      });
      if (fullAnalysis.complexity) {
        text += `⚡ Complexity:\n`;
        text += `  Time: ${safeString(fullAnalysis.complexity.time)}\n`;
        text += `  Space: ${safeString(fullAnalysis.complexity.space)}\n`;
        if (fullAnalysis.complexity.resourceGrowth) {
          text += `  Resource Growth: ${safeString(fullAnalysis.complexity.resourceGrowth)}\n`;
        }
        text += '\n';
      }
      if (fullAnalysis.verdict) {
        text += `🏁 Verdict:\n`;
        text += `  Status: ${safeString(fullAnalysis.verdict.status)}\n`;
        text += `  Explanation: ${safeString(fullAnalysis.verdict.explanation)}\n\n`;
      }
      if (fullAnalysis.scorecard) {
        text += `📊 Scorecard:\n`;
        const sc = fullAnalysis.scorecard;
        text += `  Correctness: ${sc.correctness}/10\n`;
        text += `  Concurrency Safety: ${sc.concurrencySafety}/10\n`;
        text += `  Liveness: ${sc.liveness}/10\n`;
        text += `  Error Handling: ${sc.errorHandling}/10\n`;
        text += `  Resource Management: ${sc.resourceManagement}/10\n`;
        text += `  Maintainability: ${sc.maintainability}/10\n`;
        text += `  Production Readiness: ${sc.productionReadiness}/10\n\n`;
      }
      text += `Audit Type: ${safeString(fullAnalysis.auditType)}\n`;
      text += `Status: ${safeString(fullAnalysis.status)}\n`;
    } else if (fullAnalysis.analysis) {
      text = fullAnalysis.analysis;
    } else {
      text = 'No analysis available.';
    }

    return text;
  };

  const handleCopy = async () => {
    const text = getAnalysisText();
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleDownload = () => {
    const text = getAnalysisText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${snippet?.slug || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== Advanced mode with new structure =====
  if (isAdvanced && fullAnalysis) {
    return (
      <div className="space-y-6">
        {/* ===== Header with Copy/Download ===== */}
        <div className="flex justify-end items-center gap-3 pb-2 border-b-2 border-[#e8e8f0]">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
            title="Copy full analysis"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            <span>{copySuccess ? '✅ Copied!' : 'Copy'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
            title="Download analysis as text file"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Download</span>
          </button>
        </div>

        {/* ===== Title and Summary ===== */}
        <div>
          <h2 className="text-2xl font-bold text-[#1a1a2e]">{safeString(fullAnalysis.title || 'Advanced Analysis')}</h2>
          {fullAnalysis.summary || fullAnalysis.highLevelSummary ? (
            <p className="mt-2 text-[#4a4a6a] bg-blue-50 p-3 rounded-lg border border-blue-200">
              {safeString(fullAnalysis.summary || fullAnalysis.highLevelSummary)}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">Audit: {safeString(fullAnalysis.auditType)}</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">Status: {safeString(fullAnalysis.status)}</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">Language: {safeString(fullAnalysis.language)}</span>
            <span className="bg-gray-100 px-2 py-0.5 rounded-full">Schema: {safeString(fullAnalysis.schemaVersion)}</span>
          </div>
        </div>

        {/* ===== Execution Overview ===== */}
        {fullAnalysis.executionOverview && (
          <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
            <h3 className="font-semibold text-[#4a86f7] mb-2">🔄 Execution Overview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[#4a4a6a]">
              <div>
                <span className="font-medium">Entry Points:</span>
                <ul className="list-disc list-inside mt-1">
                  {safeArray(fullAnalysis.executionOverview.entryPoints).map((ep: string, idx: number) => (
                    <li key={idx}>{safeString(ep)}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium">Task Submission Points:</span>
                <ul className="list-disc list-inside mt-1">
                  {safeArray(fullAnalysis.executionOverview.taskSubmissionPoints).map((tsp: string, idx: number) => (
                    <li key={idx}>{safeString(tsp)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ===== Findings ===== */}
        {safeArray(fullAnalysis.findings).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a2e] mb-3">🔍 Findings</h3>
            <div className="space-y-3">
              {safeArray(fullAnalysis.findings).map((finding: AuditFinding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </div>
        )}

        {/* ===== Architectural Observations ===== */}
        {safeArray(fullAnalysis.architecturalObservations).length > 0 && (
          <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
            <h3 className="font-semibold text-[#4a86f7] mb-2">🏗️ Architectural Observations</h3>
            {safeArray(fullAnalysis.architecturalObservations).map((obs: any, idx: number) => (
              <div key={idx} className="border-b border-[#d0d0d8] pb-2 last:border-0 last:pb-0">
                <p className="font-medium text-[#1a1a2e]">{safeString(obs.title)}</p>
                <p className="text-sm text-[#4a4a6a]">{safeString(obs.explanation)}</p>
              </div>
            ))}
          </div>
        )}

        {/* ===== Recommended Actions ===== */}
        {safeArray(fullAnalysis.recommendedActions).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a2e] mb-3">🔧 Recommended Actions</h3>
            <div className="space-y-2">
              {safeArray(fullAnalysis.recommendedActions)
                .sort((a: any, b: any) => a.priority - b.priority)
                .map((action: any, idx: number) => (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-[#f8f9fa] rounded-lg border border-[#d0d0d8]">
                    <span className="text-sm font-medium text-[#4a86f7]">#{action.priority}</span>
                    <div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        action.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        action.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                        action.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {safeString(action.severity)}
                      </span>
                      <p className="font-medium text-[#1a1a2e] mt-1">{safeString(action.title)}</p>
                      <p className="text-sm text-[#4a4a6a]">{safeString(action.action)}</p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ===== Suggested Tests ===== */}
        {safeArray(fullAnalysis.suggestedTests).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-[#1a1a2e] mb-3">🧪 Suggested Tests</h3>
            <div className="space-y-2">
              {safeArray(fullAnalysis.suggestedTests).map((test: any, idx: number) => (
                <div key={idx} className="p-3 bg-[#f8f9fa] rounded-lg border border-[#d0d0d8]">
                  <p className="font-medium text-[#1a1a2e]">{safeString(test.title || test.name || 'Test')}</p>
                  <p className="text-sm text-[#4a4a6a]">{safeString(test.purpose)}</p>
                  <details className="mt-1">
                    <summary className="text-xs text-[#4a86f7] cursor-pointer">Show details</summary>
                    <div className="mt-1 text-xs text-[#4a4a6a] space-y-1">
                      {safeArray(test.setup).length > 0 && (
                        <div><span className="font-medium">Setup:</span> {safeArray(test.setup).join(', ')}</div>
                      )}
                      {safeArray(test.steps).length > 0 && (
                        <div><span className="font-medium">Steps:</span> {safeArray(test.steps).join(' → ')}</div>
                      )}
                      <div><span className="font-medium">Expected:</span> {safeString(test.expectedResult || test.expectedOutput)}</div>
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Complexity ===== */}
        {fullAnalysis.complexity && (
          <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
            <h3 className="font-semibold text-[#4a86f7] mb-2">⚡ Complexity</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-[#4a4a6a]">
              <div><span className="font-medium">Time:</span> {safeString(fullAnalysis.complexity.time)}</div>
              <div><span className="font-medium">Space:</span> {safeString(fullAnalysis.complexity.space)}</div>
            </div>
            {fullAnalysis.complexity.resourceGrowth && (
              <div className="text-sm text-[#4a4a6a] mt-1">
                <span className="font-medium">Resource Growth:</span> {safeString(fullAnalysis.complexity.resourceGrowth)}
              </div>
            )}
            {safeArray(fullAnalysis.complexity.assumptions).length > 0 && (
              <div className="mt-2 text-xs text-[#6c7086]">
                <span className="font-medium">Assumptions:</span> {safeArray(fullAnalysis.complexity.assumptions).join(', ')}
              </div>
            )}
          </div>
        )}

        {/* ===== Scorecard ===== */}
        {fullAnalysis.scorecard && (
          <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
            <h3 className="font-semibold text-[#4a86f7] mb-2">📊 Scorecard</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(fullAnalysis.scorecard).map(([key, value]) => (
                <div key={key} className="bg-white p-2 rounded text-center border border-[#d0d0d8]">
                  <p className="text-xs text-[#6c7086] capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                  <p className="text-lg font-bold text-[#1a1a2e]">{typeof value === 'number' ? value : 0}/10</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== Verdict ===== */}
        {fullAnalysis.verdict && (
          <div className={`p-4 rounded-lg border ${
            fullAnalysis.verdict.status === 'approved' || fullAnalysis.verdict.status === 'approved-with-suggestions' ? 'bg-green-50 border-green-200' :
            fullAnalysis.verdict.status === 'requires-minor-changes' ? 'bg-yellow-50 border-yellow-200' :
            fullAnalysis.verdict.status === 'requires-major-changes' ? 'bg-orange-50 border-orange-200' :
            fullAnalysis.verdict.status === 'requires-changes' ? 'bg-orange-50 border-orange-200' :
            'bg-red-50 border-red-200'
          }`}>
            <h3 className="font-semibold text-[#1a1a2e]">🏁 Verdict</h3>
            <p className="mt-1 text-sm text-[#4a4a6a]">
              <span className="font-medium">Status:</span> {safeString(fullAnalysis.verdict.status)}
            </p>
            <p className="mt-1 text-sm text-[#4a4a6a]">{safeString(fullAnalysis.verdict.explanation)}</p>
          </div>
        )}

        {/* ===== Limitations ===== */}
        {safeArray(fullAnalysis.limitations).length > 0 && (
          <div className="bg-[#f8f9fa] p-4 rounded-lg border border-[#d0d0d8]">
            <h3 className="font-semibold text-[#4a86f7] mb-2">⚠️ Limitations</h3>
            <ul className="list-disc list-inside text-sm text-[#4a4a6a]">
              {safeArray(fullAnalysis.limitations).map((lim: string, idx: number) => (
                <li key={idx}>{safeString(lim)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ===== Simple / Medium mode =====
  if (!quickAnalysisText) {
    return <div className="text-[#4a4a6a]">No quick analysis available.</div>;
  }

  const cleanedText = cleanMarkdown(quickAnalysisText);
  const cleanedTextForCopy = cleanTextForCopy(quickAnalysisText);

  const handleCopySimple = async () => {
    try {
      await navigator.clipboard.writeText(cleanedTextForCopy);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleDownloadSimple = () => {
    const blob = new Blob([cleanedTextForCopy], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analysis-${snippet?.slug || Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end items-center gap-3 pb-2 border-b-2 border-[#e8e8f0]">
        <button
          onClick={handleCopySimple}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          <span>{copySuccess ? '✅ Copied!' : 'Copy'}</span>
        </button>
        <button
          onClick={handleDownloadSimple}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition border border-[#d0d0d8] text-[#4a4a6a] hover:text-[#4a86f7] hover:bg-[#f1f3f5]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download</span>
        </button>
      </div>
      <div className="space-y-3">
        <h2 className="text-xl font-bold text-[#1a1a2e]">📊 Quick Analysis</h2>
        <div
          className="bg-[#fafbfc] p-4 rounded-md border-2 border-[#d0d0d8] whitespace-pre-wrap leading-relaxed text-sm"
          dangerouslySetInnerHTML={{ __html: cleanedText }}
        />
      </div>
    </div>
  );
}