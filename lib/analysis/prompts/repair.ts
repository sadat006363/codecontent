// ============================================================
// 📁 فایل: lib/analysis/prompts/repair.ts
// ============================================================
import { getBaseSystemInstructions } from './base';
import { ValidationIssue } from '../types';

export function buildRepairPrompt(
  numberedCode: string,
  previousAudit: string,
  validationIssues: ValidationIssue[],
  missingCoverage: string[]
): string {
  const hasIssues = validationIssues.length > 0;
  const hasMissingCoverage = missingCoverage.length > 0;

  const issuesText = hasIssues
    ? validationIssues
        .map((i) => `- [${i.severity}] ${i.message} (expected: ${i.expectedCoverage})`)
        .join('\n')
    : '✅ No validation issues found. Audit is valid, but may need refinement.';

  const coverageText = hasMissingCoverage
    ? missingCoverage.map((c) => `- ${c}`).join('\n')
    : '✅ All required coverage areas are addressed.';

  return `
${getBaseSystemInstructions()}

==================== REPAIRING INCOMPLETE TECHNICAL AUDIT ====================

You are repairing an incomplete technical audit.
The previous response failed validation or needs refinement.
Do NOT restart with a generic review.
Correct the specified defects and return the complete corrected JSON object.

==================== ORIGINAL SOURCE CODE ====================

<untrusted-source-code>
${numberedCode}
</untrusted-source-code>

==================== VALIDATION FAILURES ====================

${issuesText}

==================== REQUIRED MISSING COVERAGE ====================

${coverageText}

==================== REPAIR RULES (MANDATORY) ====================

1. PRESERVE valid findings from the previous audit.
2. ADD or correct only what is necessary to fix the validation failures.
3. VERIFY every critical/high finding against the numbered source code.
4. INCLUDE exact evidence (line numbers, code snippets).
5. DO NOT invent line numbers that don't exist in the source.
6. DO NOT include Markdown code fences or comments in the output.
7. RETURN only valid JSON (no text before or after).
8. MAINTAIN the schema version from the previous audit (or use "1.0").
9. PRESERVE the audit type (concurrency or generic) from the previous audit.
10. INCLUDE the linkedin_post field in the final output.

==================== PREVIOUS AUDIT (for reference) ====================

${previousAudit}

==================== OUTPUT SCHEMA ====================

Return a complete corrected JSON object matching the AdvancedAuditResult schema:

{
  "summary": "Executive summary of findings",
  "findings": [
    {
      "title": "Descriptive title",
      "severity": "critical|high|medium|low|info",
      "confidence": "definite|high|medium|low",
      "category": "liveness|security|performance|correctness|resource|design",
      "evidence": [
        {
          "startLine": 42,
          "endLine": 45,
          "code": "code snippet",
          "explanation": "Why this is evidence"
        }
      ],
      "executionPath": ["entry", "step1", "failure"],
      "triggerConditions": ["Condition 1"],
      "consequence": "What happens",
      "technicalExplanation": "Detailed explanation",
      "remediation": "How to fix",
      "relatedSymbols": ["symbol1"],
      "testToReproduce": {
        "title": "Test name",
        "setup": ["Setup"],
        "steps": ["Step 1"],
        "expectedResult": "Expected outcome"
      }
    }
  ],
  "scorecard": {
    "correctness": 0,
    "concurrencySafety": 0,
    "liveness": 0,
    "errorHandling": 0,
    "resourceManagement": 0,
    "maintainability": 0,
    "productionReadiness": 0
  },
  "verdict": {
    "status": "approved|needs-changes|requires-major-changes|rejected",
    "explanation": "Detailed explanation"
  },
  "linkedin_post": "Professional LinkedIn post (max 300 characters) with 3-5 relevant hashtags"
}

==================== REPAIR OUTPUT ====================

Return ONLY the complete corrected JSON object.
Do NOT include any text before or after the JSON.
`;
}