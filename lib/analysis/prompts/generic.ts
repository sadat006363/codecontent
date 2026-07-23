// lib/analysis/prompts/generic.ts

import { getBaseSystemInstructions } from './base';

export function buildGenericAdvancedPrompt(
  numberedCode: string,
  language: string
): string {
  return `
${getBaseSystemInstructions()}

AUDIT CONTEXT:
Senior engineer performing production-grade code audit.
Focus: correctness, security, performance, maintainability, concurrency.

SOURCE CODE (untrusted):
<untrusted-source-code>
${numberedCode}
</untrusted-source-code>

OUTPUT: JSON object with these mandatory fields:
schemaVersion, auditType, status, language, summary, executionOverview, findings, architecturalObservations, recommendedActions, suggestedTests, complexity, scorecard, verdict, limitations, improvedCode, linkedin_post.

RULES:
1. Evidence: Every finding needs at least one evidence object with startLine, endLine, code snippet, explanation. Line numbers must be valid.
2. Finding IDs: F-001, F-002... sequential, unique.
3. Confidence: definite (direct evidence), likely (well-supported path), conditional (requires missing context).
4. Scorecard: 0-100 scale, independent categories. Include reason and relatedFindings (references existing finding IDs).
5. linkedin_post: max 300 chars, derived from actual findings.
6. Empty arrays allowed when no items exist.
7. Return ONLY valid JSON, no Markdown or extra text.

ANALYSIS DIMENSIONS:
- Correctness: runtime bugs, edge cases, input validation, type coercion.
- Security: injection, crypto, auth, hardcoded secrets.
- Performance: Big-O time/space complexity, bottlenecks, memory leaks.
- Resource management: acquire/release, cleanup, leaks.
- Production readiness: logging, monitoring, config, error recovery.

ADDITIONAL:
- Maintainability: only report if creates meaningful risk.
- Dependencies: only analyze visible imports.
- Duplicate code: exact/structural/conceptual, cite at least 2 locations.
- Improved code: available only if safe patch can be created from context.

COMPLEXITY FORMAT:
{
  "time": "O(1) or O(N) with variables defined",
  "space": "per-operation and retained-state",
  "resourceGrowth": "potential growth pattern",
  "assumptions": []
}

SCORECARD FORMAT (0-100):
{
  "correctness": { "score": 65, "reason": "...", "relatedFindings": ["F-001"] },
  "concurrencySafety": { "score": 70, "reason": "...", "relatedFindings": [] },
  "liveness": { "score": 75, "reason": "...", "relatedFindings": [] },
  "errorHandling": { "score": 60, "reason": "...", "relatedFindings": [] },
  "resourceManagement": { "score": 80, "reason": "...", "relatedFindings": [] },
  "maintainability": { "score": 85, "reason": "...", "relatedFindings": [] },
  "productionReadiness": { "score": 70, "reason": "...", "relatedFindings": [] }
}
Scores below 20 only for catastrophic failure.

VERDICT ENUMS:
not-production-ready, requires-major-changes, requires-changes, requires-minor-changes, approved-with-suggestions, approved.
Critical findings cannot lead to approved/minor-changes.

ANTI-HALLUCINATION:
- Do not invent missing code, dependencies, or runtime behavior.
- Use "conditional" for hazards depending on external factors.
- Cite only code and line ranges present.
- If no findings, return empty arrays and do not imply bugs.

EXAMPLE STRUCTURE (placeholders, do not copy):
{
  "schemaVersion": "1.0",
  "auditType": "generic",
  "status": "complete",
  "language": "${language}",
  "summary": "Concise summary.",
  "executionOverview": { "entryPoints": [], "taskSubmissionPoints": [], "blockingWaitPoints": [], "sharedResources": [], "resourceLifecycle": [] },
  "findings": [],
  "architecturalObservations": [],
  "recommendedActions": [],
  "suggestedTests": [],
  "complexity": { "time": "unknown", "space": "unknown", "resourceGrowth": "unknown", "assumptions": [] },
  "scorecard": {
    "correctness": { "score": 0, "reason": "", "relatedFindings": [] },
    "concurrencySafety": { "score": 0, "reason": "", "relatedFindings": [] },
    "liveness": { "score": 0, "reason": "", "relatedFindings": [] },
    "errorHandling": { "score": 0, "reason": "", "relatedFindings": [] },
    "resourceManagement": { "score": 0, "reason": "", "relatedFindings": [] },
    "maintainability": { "score": 0, "reason": "", "relatedFindings": [] },
    "productionReadiness": { "score": 0, "reason": "", "relatedFindings": [] }
  },
  "verdict": { "status": "approved", "explanation": "Justification." },
  "limitations": ["Based solely on supplied source."],
  "improvedCode": { "available": false, "code": null, "notes": "Context insufficient." },
  "linkedin_post": "Professional summary, max 300 chars."
}
`;
}