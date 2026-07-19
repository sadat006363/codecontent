// ============================================================
// 📁 فایل: lib/analysis/normalizer.ts
// ============================================================
import { AdvancedAuditResult } from '@/types';

export function normalizeAnalysisOutput(raw: any): AdvancedAuditResult {
  let findings = raw.findings || raw.issues || raw.advancedFindings || raw.concurrencyFindings || raw.analysis?.findings || [];

  const normalizedFindings = findings.map((f: any) => ({
    id: f.id || `FIND-${Math.random().toString(36).substr(2, 6)}`,
    title: f.title || f.name || 'Untitled Finding',
    category: f.category || f.type || 'other',
    severity: f.severity || f.priority || 'medium',
    confidence: f.confidence || 'conditional',
    evidence: f.evidence || [],
    executionPath: f.executionPath || f.path || [],
    triggerConditions: f.triggerConditions || f.conditions || [],
    consequence: f.consequence || f.impact || f.effect || '',
    technicalExplanation: f.technicalExplanation || f.details || '',
    remediation: f.remediation || f.fix || f.solution || '',
    relatedSymbols: f.relatedSymbols || f.symbols || [],
    testToReproduce: f.testToReproduce || f.test || null,
  }));

  return {
    schemaVersion: raw.schemaVersion || '1.0',
    auditType: raw.auditType || raw.type || 'concurrency',
    status: raw.status || 'complete',
    language: raw.language || 'unknown',
    summary: raw.summary || raw.highLevelSummary || '',
    executionOverview: raw.executionOverview || raw.overview || { entryPoints: [], taskSubmissionPoints: [], blockingWaitPoints: [], sharedResources: [], resourceLifecycle: [] },
    findings: normalizedFindings,
    architecturalObservations: raw.architecturalObservations || [],
    recommendedActions: raw.recommendedActions || [],
    suggestedTests: raw.suggestedTests || [],
    complexity: raw.complexity || { time: 'O(1)', space: 'O(1)', resourceGrowth: 'Constant', assumptions: [] },
    scorecard: raw.scorecard || { correctness: 0, concurrencySafety: 0, liveness: 0, errorHandling: 0, resourceManagement: 0, maintainability: 0, productionReadiness: 0 },
    verdict: raw.verdict || { status: 'requires-major-changes', explanation: '' },
    limitations: raw.limitations || [],
  };
}