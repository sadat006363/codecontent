// tests/analysis/validator.test.ts

import { validateSemanticCompleteness } from '@/lib/analysis/validator';
import { DetectorResult } from '@/lib/analysis/types';
import { AdvancedAuditResult } from '@/lib/analysis/schema';

describe('Validator', () => {
  const mockDetectorResult: DetectorResult = {
    requiresConcurrencyAudit: false,
    score: 0,
    signals: [],
  };

  const sampleCode = `function add(a, b) {\n  return a + b;\n}\n`;

  const validResult: AdvancedAuditResult = {
    schemaVersion: '1.0',
    auditType: 'generic',
    status: 'complete',
    language: 'javascript',
    summary: 'Simple add function',
    executionOverview: {
      entryPoints: ['add'],
      taskSubmissionPoints: [],
      blockingWaitPoints: [],
      sharedResources: [],
      resourceLifecycle: [],
    },
    findings: [],
    architecturalObservations: [],
    recommendedActions: [],
    suggestedTests: [],
    complexity: {
      time: 'O(1)',
      space: 'O(1)',
      resourceGrowth: 'O(1)',
      assumptions: [],
    },
    scorecard: {
      correctness: { score: 80, reason: 'Correct', relatedFindings: [] },
      concurrencySafety: { score: 80, reason: 'No concurrency', relatedFindings: [] },
      liveness: { score: 80, reason: 'No liveness issues', relatedFindings: [] },
      errorHandling: { score: 80, reason: 'No error handling', relatedFindings: [] },
      resourceManagement: { score: 80, reason: 'No resources', relatedFindings: [] },
      maintainability: { score: 80, reason: 'Simple', relatedFindings: [] },
      productionReadiness: { score: 80, reason: 'Simple', relatedFindings: [] },
    },
    verdict: {
      status: 'approved',
      explanation: 'Simple function, no issues',
    },
    limitations: [],
    improvedCode: {
      available: false,
      code: null,
      notes: 'Not applicable',
    },
    linkedin_post: 'Simple add function',
  };

  test('should validate a valid result', () => {
    const result = validateSemanticCompleteness(validResult, mockDetectorResult, sampleCode);
    expect(result.structurallyValid).toBe(true);
    expect(result.semanticallyComplete).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.repairRequired).toBe(false);
  });

  test('should detect missing LinkedIn post', () => {
    const invalidResult = { ...validResult, linkedin_post: '' };
    const result = validateSemanticCompleteness(invalidResult, mockDetectorResult, sampleCode);
    expect(result.issues.some((i) => i.code === 'LINKEDIN_POST_MISSING')).toBe(true);
    expect(result.repairRequired).toBe(true);
  });

  test('should detect LinkedIn post too long', () => {
    const invalidResult = { ...validResult, linkedin_post: 'a'.repeat(301) };
    const result = validateSemanticCompleteness(invalidResult, mockDetectorResult, sampleCode);
    expect(result.issues.some((i) => i.code === 'LINKEDIN_POST_TOO_LONG')).toBe(true);
    expect(result.repairRequired).toBe(true);
  });

  test('should detect evidence code mismatch with tolerance', () => {
    const resultWithMismatch: AdvancedAuditResult = {
      ...validResult,
      findings: [
        {
          id: 'F-001',
          title: 'Test finding',
          category: 'other',
          severity: 'medium',
          confidence: 'definite',
          evidence: [
            {
              startLine: 1,
              endLine: 1,
              code: 'function add(a, b) { return a + b; }',
              explanation: 'This is the function definition',
            },
          ],
          executionPath: ['add'],
          triggerConditions: ['a and b are numbers'],
          consequence: 'Returns sum',
          technicalExplanation: 'Simple addition',
          remediation: 'None',
          relatedSymbols: ['add'],
          testToReproduce: null,
        },
      ],
    };
    const result = validateSemanticCompleteness(resultWithMismatch, mockDetectorResult, sampleCode);
    // با تشابه، نباید خطا بدهد (چون کد مشابه است)
    expect(result.issues.some((i) => i.code === 'EVIDENCE_CODE_MISMATCH')).toBe(false);
  });
});