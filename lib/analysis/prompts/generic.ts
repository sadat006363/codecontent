// ============================================================
// 📁 فایل: lib/analysis/prompts/generic.ts
// ============================================================
import { getBaseSystemInstructions } from './base';

export function buildGenericAdvancedPrompt(
  numberedCode: string,
  language: string
): string {
  return `
${getBaseSystemInstructions()}

==================== GENERIC ADVANCED AUDIT ====================

Analyze the following ${language} code for correctness, security, error handling, performance, resource management, and production readiness.

<untrusted-source-code>
${numberedCode}
</untrusted-source-code>

==================== REQUIRED ANALYSIS DIMENSIONS ====================

1. CORRECTNESS & LOGICAL FLAWS:
   - Are there any runtime bugs or logical errors?
   - How are edge cases handled? (null, undefined, empty inputs, boundary values)
   - Is input validation comprehensive?
   - Are error messages informative and actionable?
   - Are there off-by-one errors or type coercion issues?

2. SECURITY (if applicable):
   - Is sensitive data properly protected?
   - Are there injection vulnerabilities (SQL, XSS, command injection)?
   - Are cryptographic practices secure? (no weak algorithms, proper randomness)
   - Is authentication/authorization correctly implemented?
   - Are there hardcoded secrets or keys?

3. PERFORMANCE & SCALABILITY:
   - What is the time complexity? (Big O notation)
   - What is the space complexity? (Big O notation)
   - Are there any bottlenecks or inefficient algorithms?
   - Does the code scale with larger inputs?
   - Are there any memory leaks or excessive allocations?

4. RESOURCE MANAGEMENT & LIFECYCLE:
   - Are resources properly acquired and released? (connections, files, threads)
   - Is there proper cleanup in error paths?
   - Are there any resource leaks?
   - Is there proper shutdown/cleanup logic?

5. PRODUCTION READINESS:
   - Is the code ready for production deployment?
   - Are there adequate logging and monitoring?
   - Is configuration externalized (no hardcoded values)?
   - Are dependencies properly managed?
   - Is there proper error recovery and retry logic?
   - Is the code testable?

==================== ADDITIONAL CHECKS ====================

6. MAINTAINABILITY:
   - Is the code readable and well-organized?
   - Are there clear comments and documentation?
   - Is the code modular and reusable?
   - Are there any code smells or anti-patterns?

7. DEPENDENCIES & COMPATIBILITY:
   - Are dependencies up-to-date and secure?
   - Is the code compatible with the target environment?
   - Are there any unnecessary dependencies?

==================== OUTPUT FORMAT ====================

Return a JSON object matching the AdvancedAuditResult schema:

{
  "summary": "Executive summary of the analysis",
  "findings": [
    {
      "title": "Descriptive title",
      "severity": "critical|high|medium|low|info",
      "confidence": "definite|high|medium|low",
      "category": "correctness|security|performance|resource|design|maintainability",
      "evidence": [
        {
          "startLine": 42,
          "endLine": 45,
          "code": "relevant code snippet",
          "explanation": "Why this is evidence"
        }
      ],
      "executionPath": ["entry", "step1", "step2"],
      "triggerConditions": ["Condition 1", "Condition 2"],
      "consequence": "What happens when triggered",
      "technicalExplanation": "Detailed explanation",
      "remediation": "How to fix",
      "relatedSymbols": ["symbol1", "symbol2"],
      "testToReproduce": {
        "title": "Test name",
        "setup": ["Setup step 1"],
        "steps": ["Test step 1"],
        "expectedResult": "Expected outcome"
      }
    }
  ],
  "scorecard": {
    "correctness": 0,
    "readability": 0,
    "performance": 0,
    "maintainability": 0,
    "productionReadiness": 0,
    "security": 0,
    "overall": 0
  },
  "verdict": {
    "status": "approved|needs-changes|requires-major-changes|rejected",
    "explanation": "Detailed explanation"
  },
  "linkedin_post": "Professional LinkedIn post (max 300 characters) with 3-5 relevant hashtags. Include hook, key points, and engaging content."
}

==================== CONCURRENCY DETECTION ====================

If the code uses any of the following, the analysis MUST be delegated to the concurrency auditor:
- Threads, executors, thread pools
- Futures, promises, async/await
- Locks, semaphores, queues
- Parallel streams or parallel processing

Flag: "concurrency_detected": true and route to concurrency audit.

==================== ANTI-HALLUCINATION ====================

- Do not invent missing code.
- Do not claim defects without evidence.
- Use "Confidence" levels appropriately.
- Findings without evidence are invalid.

==================== PRIORITY ORDER ====================

Findings must be ordered by:
1. Critical correctness/security defects
2. High-severity performance/resource defects
3. Medium-severity maintainability issues
4. Low-severity style suggestions
`;
}