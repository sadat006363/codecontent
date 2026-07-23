// tests/analysis/normalizer.test.ts

import { normalizeAnalysisOutput } from '@/lib/analysis/normalizer';

describe('Normalizer', () => {
  test('should normalize raw output with missing fields', () => {
    const raw = {
      auditType: 'generic',
      language: 'javascript',
      summary: 'Test summary',
      findings: [],
      scorecard: {
        correctness: 80,
        concurrencySafety: 70,
        liveness: 60,
      },
    };
    const result = normalizeAnalysisOutput(raw);
    expect(result.schemaVersion).toBe('1.0');
    expect(result.status).toBe('complete');
    expect(result.linkedin_post).toBe('Check out this code analysis! #Zbloue');
    expect(result.scorecard.correctness.score).toBe(80);
    expect(result.scorecard.correctness.reason).toBe('');
    expect(result.scorecard.correctness.relatedFindings).toEqual([]);
  });

  test('should normalize scorecard to ScoreItem format', () => {
    const raw = {
      scorecard_new: {
        correctness: { score: 85, reason: 'Good', relatedFindings: ['F-001'] },
        concurrencySafety: { score: 70, reason: 'Some issues' },
        liveness: { score: 65, reason: 'Potential deadlock' },
        errorHandling: { score: 75, reason: 'Good' },
        resourceManagement: { score: 80, reason: 'Good' },
        maintainability: { score: 90, reason: 'Excellent' },
        productionReadiness: { score: 70, reason: 'Needs improvements' },
      },
    };
    const result = normalizeAnalysisOutput(raw);
    expect(result.scorecard.correctness.score).toBe(85);
    expect(result.scorecard.correctness.reason).toBe('Good');
    expect(result.scorecard.correctness.relatedFindings).toEqual(['F-001']);
    expect(result.scorecard.concurrencySafety.score).toBe(70);
  });

  test('should normalize findings with generated IDs', () => {
    const raw = {
      findings: [
        { title: 'Finding 1', severity: 'high' },
        { title: 'Finding 2', severity: 'medium' },
      ],
    };
    const result = normalizeAnalysisOutput(raw);
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0].id).toMatch(/^F-\d{3}$/);
    expect(result.findings[1].id).toMatch(/^F-\d{3}$/);
    expect(result.findings[0].id).not.toBe(result.findings[1].id);
  });

  test('should handle duplicate finding IDs', () => {
    const raw = {
      findings: [
        { id: 'F-001', title: 'Finding 1' },
        { id: 'F-001', title: 'Finding 2' },
      ],
    };
    const result = normalizeAnalysisOutput(raw);
    expect(result.findings[0].id).toBe('F-001');
    expect(result.findings[1].id).not.toBe('F-001');
    expect(result.findings[1].id).toMatch(/^F-\d{3}$/);
  });

  test('should normalize executionOverview', () => {
    const raw = {
      executionOverview: {
        entryPoints: ['main'],
        taskSubmissionPoints: ['submitTask'],
      },
    };
    const result = normalizeAnalysisOutput(raw);
    expect(result.executionOverview.entryPoints).toEqual(['main']);
    expect(result.executionOverview.taskSubmissionPoints).toEqual(['submitTask']);
    expect(result.executionOverview.blockingWaitPoints).toEqual([]);
  });
});